'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fontFallback, fontDeclarations, htmlFontDeclarations, canvasFontPlugin} = require('./tracker-efb-fonts');
const {getTrackerEfbWebClientAsset, createTrackerEfbWebClientPage} = require('./tracker-efb-web-client');

function table(font, tag) {
  for(let i=0;i<font.readUInt16BE(4);i++) {
    const p=12+i*16;
    if(font.toString('ascii',p,p+4)===tag) return font.readUInt32BE(p+8);
  }
  return null;
}
function hasGlyph(font, cp) {
  const cmap=table(font,'cmap');
  for(let i=0;i<font.readUInt16BE(cmap+2);i++) {
    const p=cmap+font.readUInt32BE(cmap+8+i*8),format=font.readUInt16BE(p);
    if(format===12) {
      for(let j=0;j<font.readUInt32BE(p+12);j++) {
        const k=p+16+j*12,start=font.readUInt32BE(k),end=font.readUInt32BE(k+4);
        if(cp>=start&&cp<=end&&font.readUInt32BE(k+8)+cp-start!==0) return true;
      }
    } else if(format===4&&cp<=0xffff) {
      const n=font.readUInt16BE(p+6)/2;
      for(let j=0;j<n;j++) {
        const start=font.readUInt16BE(p+16+2*n+2*j),end=font.readUInt16BE(p+14+2*j);
        if(cp<start||cp>end) continue;
        const delta=font.readInt16BE(p+16+4*n+2*j),offsetAt=p+16+6*n+2*j,offset=font.readUInt16BE(offsetAt);
        const glyph=offset?font.readUInt16BE(offsetAt+offset+2*(cp-start)):cp;
        if((!offset||glyph)&&((glyph+delta)&0xffff)) return true;
      }
    }
  }
  return false;
}

test('fallback preserves named/instrument faces and comes before generic last resort', () => {
  const stack = fontFallback("'MS33558', Arial, sans-serif !important");
  assert.match(stack, /^'MS33558', Arial, "GA EFB Text"/);
  assert.match(stack, /"GA EFB Math", sans-serif !important$/);
  assert.equal(fontFallback(stack), stack);
  assert.equal(fontFallback('inherit'), 'inherit');
  assert.match(fontFallback('bold 12px Arial'), /^bold 12px Arial, "GA EFB Text"/);
});

test('CSS and inline HTML retain declarations, quotes, accents and face registration', () => {
  const face = "@font-face {font-family: 'MS33558';src:url(font.ttf)}";
  const css = fontDeclarations(face + 'a{font:12px Arial;color:red;font-weight:bold;--drawer-font:monospace}');
  assert.ok(css.startsWith(face));
  assert.match(css, /font-weight:bold/);
  assert.match(css, /--drawer-font:"GA EFB Mono"/);
  const html = htmlFontDeclarations('<span style="font:12px Arial;color:red">ÄÖÜ äöü ß − 📻</span>');
  assert.match(html, /&quot;GA EFB Emoji&quot;/);
  assert.match(html, />ÄÖÜ äöü ß − 📻<\/span>$/);
});

test('canvas uses one font family and routes icons through the image renderer', () => {
  const source = 'ctx.font = size + "px Arial"; ctx.fillText("🏔️", 1, 2);';
  const code = require('@babel/core').transformSync(source, {configFile:false,babelrc:false,plugins:[canvasFontPlugin]}).code;
  const calls = [], ctx = {fillText(...args){calls.push(args)}};
  new Function('ctx','size','gaEfbCanvasFillText',code)(ctx,15,(target,...args)=>target.fillText(...args));
  assert.equal(ctx.font, '15px Arial');
  assert.deepEqual(calls,[['🏔️',1,2]]);
});

test('fonts are locally routable, COLRv0 is packaged, and styles load before the UI', () => {
  const page = createTrackerEfbWebClientPage();
  assert.ok(page.indexOf('/assets/fonts.css') < page.indexOf('/assets/app-styles.css'));
  const pkg = require('./package.json');
  assert.ok(pkg.pkg.assets.includes('efb-fonts/*'));
  for(const file of ['NotoSans-Regular.ttf','NotoSansMono-Regular.ttf','NotoSansSymbols2-Regular.ttf','NotoSansMath-Regular.ttf','OpenMoji-color-glyf_colr_0.ttf']) {
    const asset = getTrackerEfbWebClientAsset('/efb/v1/assets/fonts/'+file);
    assert.equal(asset.contentType,'font/ttf');
    assert.equal(asset.body.readUInt32BE(0),0x00010000);
    if(file.startsWith('OpenMoji')) {
      let found = false;
      for(let i=0;i<asset.body.readUInt16BE(4);i++) {
        const p=12+i*16;
        if(asset.body.toString('ascii',p,p+4)==='COLR') {found=true;assert.equal(asset.body.readUInt16BE(asset.body.readUInt32BE(p+8)),0);}
      }
      assert.ok(found,'Retain the licensed COLRv0 source used by the SVG exporter');
    }
  }
  assert.equal(getTrackerEfbWebClientAsset('/efb/v1/assets/fonts/../../tracker.js'),null);
});

test('original App faces are static local TTFs and external font imports are removed only in EFB', () => {
  const names=['Caveat-SemiBold.ttf','OleoScript-Regular.ttf','OleoScript-Bold.ttf','ShareTechMono-Regular.ttf','DSEG7Classic-Bold.ttf'];
  for(const name of names) {
    const font=getTrackerEfbWebClientAsset('/efb/v1/assets/fonts/'+name).body;
    assert.equal(font.readUInt32BE(0),0x10000,name);
    assert.equal(table(font,'fvar'),null,name+' must not require variable-font support');
    for(const ch of (name.startsWith('DSEG')?'0123456789':'ÄÖÜäöüß')) assert.ok(hasGlyph(font,ch.codePointAt(0)),name+' missing '+ch);
  }
  const shared=require('node:fs').readFileSync(require('node:path').join(__dirname,'../styles.css'),'utf8');
  assert.match(shared,/fonts.googleapis.com/);
  const css=getTrackerEfbWebClientAsset('/efb/v1/assets/app-styles.css').body.toString('utf8');
  assert.doesNotMatch(css,/fonts.googleapis.com|cdn.jsdelivr.net\/npm\/dseg/);
  assert.match(css,/\/efb\/v1\/assets\/fonts\/DSEG7Classic-Bold.ttf/);
});

test('bundled fallback glyphs cover reported UI symbols and German characters', () => {
  const fonts=['NotoSans-Regular.ttf','NotoSansSymbols2-Regular.ttf','NotoSansMath-Regular.ttf','OpenMoji-color-glyf_colr_0.ttf'].map(name=>getTrackerEfbWebClientAsset('/efb/v1/assets/fonts/'+name).body);
  const missing=Array.from('ÄÖÜäöüß−×→↻°±📻🔊🏔🛡📍🧑✈🔔⚙').filter(ch=>!fonts.some(font=>hasGlyph(font,ch.codePointAt(0))));
  assert.deepEqual(missing,[]);
});

test('symbol artwork covers controls and atomic pilot sequences without empty matches', () => {
  const artwork=require('./efb-fonts/symbols.json');
  assert.ok(!Object.hasOwn(artwork,''));
  for(const symbol of ['🧑‍✈','📻','🔊','🔎','⚙','−','×','↻','°','🏔']) {
    assert.match(artwork[symbol],/^<svg /,symbol);
    assert.match(artwork[symbol],/<path /,symbol);
    assert.doesNotMatch(artwork[symbol],/<text|https?:\/\/(?!www.w3.org)/,symbol);
  }
  const page=createTrackerEfbWebClientPage();
  assert.ok(page.indexOf('/assets/symbols.js')<page.indexOf('/assets/emoji-text.js'));
  const script=getTrackerEfbWebClientAsset('/efb/v1/assets/symbols.js').body.toString();
  assert.match(script,/var gaEfbSymbolArtwork = /);
  assert.ok(require('./package.json').pkg.assets.includes('tracker-efb-symbols.js'));
});
