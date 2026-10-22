"""Export the guide, onboarding and welcome as portable HTML files. No network."""

from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parent.parent
APP_URL = "https://inherjer.github.io/GA-Dispatcher-Alpha/"
PAGES = {
    "readme.html": "VFR-Multitool-Anleitung.html",
    "onboarding.html": "VFR-Multitool-Onboarding.html",
    "willkommen.html": "VFR-Multitool-Info.html",
}


def export_page(source_name, target_name):
    source = (ROOT / source_name).read_text(encoding="utf-8")
    images = set(re.findall(r"assets/(?:onboarding|welcome)/[a-z-]+\.png", source))
    for relative in sorted(images):
        data = base64.b64encode((ROOT / relative).read_bytes()).decode("ascii")
        source = source.replace(relative, "data:image/png;base64," + data)
    icon = base64.b64encode((ROOT / "IconDRK.PNG").read_bytes()).decode("ascii")
    source = source.replace('href="IconDRK.PNG"', 'href="data:image/png;base64,' + icon + '"')

    def local_link(match):
        name, fragment = match.group(1), match.group(2) or ""
        destination = PAGES.get(name, APP_URL + name)
        return f'href="{destination}{fragment}"'

    source = re.sub(r'href="((?:readme|onboarding|willkommen|index|legal)\.html)(#[^"]*)?"', local_link, source)
    target = ROOT / "exports" / target_name
    target.parent.mkdir(exist_ok=True)
    target.write_text(source, encoding="utf-8")
    print(f"Created {target.name}: {len(images)} embedded screenshots, {target.stat().st_size:,} bytes")


def main():
    for source_name, target_name in PAGES.items():
        export_page(source_name, target_name)


if __name__ == "__main__":
    main()
