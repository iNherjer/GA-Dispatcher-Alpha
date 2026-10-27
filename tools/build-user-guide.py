"""Build readme.html from README.md. Requires markdown-it-py; no network I/O."""

from collections import Counter
from html import escape
from pathlib import Path
import re
import struct
import unicodedata
from urllib.parse import unquote

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent.parent


def slug(text):
    plain = unicodedata.normalize("NFKD", text.replace("ß", "ss"))
    plain = plain.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-") or "kapitel"


def main():
    source = (ROOT / "README.md").read_text(encoding="utf-8").split("<!-- maintenance:start -->")[0]
    markdown = MarkdownIt("commonmark", {"html": False})
    tokens = markdown.parse(source)
    headings = Counter()
    for index, token in enumerate(tokens):
        if token.type == "heading_open":
            base = slug(tokens[index + 1].content)
            headings[base] += 1
            token.attrSet("id", base if headings[base] == 1 else f"{base}-{headings[base]}")
        for child in token.children or []:
            if child.type == "link_open" and ((child.attrGet("href") or "").startswith("https://") or child.attrGet("href") == "index.html"):
                child.attrSet("target", "_blank")
                child.attrSet("rel", "noopener noreferrer")
            if child.type == "image":
                child.attrSet("loading", "lazy")
                child.attrSet("decoding", "async")
                image = ROOT / unquote(child.attrGet("src") or "")
                if not image.is_file():
                    raise ValueError(f"Missing guide image: {image}")
                header = image.read_bytes()[:24]
                if header.startswith(b"\x89PNG\r\n\x1a\n"):
                    width, height = struct.unpack(">II", header[16:24])
                    child.attrSet("width", str(width))
                    child.attrSet("height", str(height))
    starts = [i for i, token in enumerate(tokens) if token.type == "heading_open" and token.tag == "h2"]
    if not starts or not tokens or tokens[0].tag != "h1":
        raise ValueError("Guide needs one leading H1 and H2 chapters")
    intro = markdown.renderer.render(tokens[3:starts[0]], markdown.options, {})
    chapters, toc = [], []
    for position, begin in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(tokens)
        section_id = tokens[begin].attrGet("id")
        heading_id = section_id + "-titel"
        tokens[begin].attrSet("id", heading_id)
        title = tokens[begin + 1].content
        body = markdown.renderer.render(tokens[begin:end], markdown.options, {})
        chapters.append(f'<section class="chapter" id="{escape(section_id)}" aria-labelledby="{escape(heading_id)}">{body}</section>')
        toc.append(f'<li><a href="#{escape(section_id)}" data-chapter="{escape(section_id)}">{escape(title)}</a></li>')
    template = (ROOT / "tools/user-guide-template.html").read_text(encoding="utf-8")
    result = template.replace("<!-- GUIDE_INTRO -->", intro).replace("<!-- GUIDE_CONTENT -->", "\n".join(chapters)).replace("<!-- GUIDE_TOC -->", "\n".join(toc))
    ids = re.findall(r'\bid="([^"]+)"', result)
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate guide IDs")
    for anchor in re.findall(r'href="#([^"]+)"', result):
        if unquote(anchor) not in ids:
            raise ValueError(f"Broken guide anchor: {anchor}")
    (ROOT / "readme.html").write_text(result, encoding="utf-8")
    print(f"Created readme.html: {len(chapters)} chapters, {len(ids)} anchors")


if __name__ == "__main__":
    main()
