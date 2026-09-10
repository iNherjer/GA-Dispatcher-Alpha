"""Export the bundled, licensed font artwork as SVG (build only, FontTools).
Coherent GT need not implement color-font shaping/fallback to draw these icons.
"""
from pathlib import Path
import json,re,html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
root=Path(__file__).resolve().parents[1]; dest=root/'ga-tracker-client/efb-fonts'
emoji=TTFont(dest/'OpenMoji-color-glyf_colr_0.ttf')
fonts=[emoji]+[TTFont(dest/n) for n in ['NotoSansMath-Regular.ttf','NotoSansSymbols2-Regular.ttf','NotoSans-Regular.ttf']]
source=''.join(p.read_text(errors='replace') for p in list(root.glob('*.js'))+list(root.glob('*.html'))+list((root/'ga-tracker-client').glob('tracker-efb-*.js')))
chars=set(c for c in source if ord(c)>=0x2190 or c in '×±°')
# Also cover the controls used in E6B and character-escaped instrument strings.
chars.update('−×↻→←↑↓⚠🔎🧑✈')
sequences=set(re.findall(r'[\U00010000-\U0010ffff\u2600-\u27ff]\ufe0f?(?:\u200d[\U00010000-\U0010ffff\u2600-\u27ff]\ufe0f?)+',source));sequences.add('🧑‍✈️')
cmaps=[f.getBestCmap() for f in fonts]
ligatures={}
for lookup in emoji['GSUB'].table.LookupList.Lookup:
 for sub in lookup.SubTable:
  for first,entries in getattr(sub,'ligatures',{}).items():
   for entry in entries:ligatures[tuple([first]+entry.Component)]=entry.LigGlyph

def svg(font,glyph):
 glyphs=font.getGlyphSet(); em=font['head'].unitsPerEm
 layers=getattr(font.get('COLR'),'ColorLayers',{}).get(glyph)
 paths=[]; bounds=[]
 for name,fill in ([(l.name, '#%02x%02x%02x'%(font['CPAL'].palettes[0][l.colorID].red,font['CPAL'].palettes[0][l.colorID].green,font['CPAL'].palettes[0][l.colorID].blue)) for l in layers] if layers else [(glyph,'#eeeeee')]):
  bp=BoundsPen(glyphs);glyphs[name].draw(bp)
  if bp.bounds:bounds.append(bp.bounds)
  pen=SVGPathPen(glyphs);glyphs[name].draw(pen);paths.append('<path fill="'+fill+'" d="'+pen.getCommands()+'"/>')
 if layers and bounds:
  x0=min(b[0] for b in bounds);y0=min(b[1] for b in bounds);x1=max(b[2] for b in bounds);y1=max(b[3] for b in bounds)
  pad=max(x1-x0,y1-y0)*0.04
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s"><g transform="scale(1 -1)">%s</g></svg>'%(x0-pad,-y1-pad,x1-x0+2*pad,y1-y0+2*pad,''.join(paths))
 advance=font['hmtx'].metrics[glyph][0] or em
 asc=font['hhea'].ascent; desc=font['hhea'].descent
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s"><g transform="translate(0 %s) scale(1 -1)">%s</g></svg>'%(advance,asc-desc,asc,''.join(paths))
result={}
for ch in sorted(chars):
 for font,cmap in zip(fonts,cmaps):
  if ord(ch) in cmap:
   result[ch]=svg(font,cmap[ord(ch)]);break
for seq in sequences:
 for spelling in [seq,seq.replace('\ufe0f','')]:
  glyphs=tuple(cmaps[0].get(ord(c),'') for c in spelling)
  if glyphs in ligatures:
   result[seq]=svg(emoji,ligatures[glyphs]);break
# A sequence's artwork is atomic; variation selectors do not change its key.
result={k.replace('\ufe0f',''):v for k,v in sorted(result.items()) if k.replace('\ufe0f','') and k!='\ufffd'}
(dest/'symbols.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print('EFB symbol artwork:',len(result),'glyphs;', (dest/'symbols.json').stat().st_size,'bytes')
