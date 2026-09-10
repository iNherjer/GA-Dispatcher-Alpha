'use strict';

// Coherent has no browser/OS-wide Unicode fallback. Keep the original face
// first (including instrument fonts) and supply missing glyphs locally.
const FALLBACK = '"GA EFB Text", "GA EFB Emoji", "GA EFB Symbols", "GA EFB Math"';

function fontFallback(value) {
  if (!value || value.includes('GA EFB Emoji') || /^(inherit|initial|unset|normal)$/i.test(value.trim())) return value;
  var important = /\s*!important\s*$/.test(value) ? ' !important' : '';
  var family = value.replace(/\s*!important\s*$/, '').trim();
  var fallback = /\bmonospace$/.test(family) ? FALLBACK.replace('GA EFB Text', 'GA EFB Mono') : FALLBACK;
  // A generic family may resolve to Coherent's last-resort tofu face. Our
  // explicit fallbacks must precede it, while named original fonts stay first.
  return family.replace(/(^|,\s*|\s+)(sans-serif|serif|monospace|cursive|fantasy)\s*$/, '$1' + fallback + ', $2')
    + (/\b(sans-serif|serif|monospace|cursive|fantasy)$/.test(family) ? '' : ', ' + fallback) + important;
}

function fontDeclarations(source) {
  source = source.replace(/@import\s+url\((['"]?)https:\/\/fonts\.googleapis\.com\/[^)]*\)\s*;/g, '');
  // Preserve @font-face family identifiers; only extend consuming stacks.
  return source.replace(/@font-face\s*\{[^}]*\}|((?:^|[;{])\s*(?:font(?:-family)?|--[\w-]*font[\w-]*)\s*:\s*)([^;{}]+)(?=[;}]|$)/gm,
    (match, prefix, value) => {
      if (prefix) return prefix + fontFallback(value);
      // The shared App stylesheet declares DSEG via a remote WOFF2. Keep its
      // exact font family/weight, but serve the same release's TrueType file.
      if (/font-family:\s*['"]DSEG7['"]/.test(match)) return match.replace(/src:\s*[^;]+;/, "src: url('/efb/v1/assets/fonts/DSEG7Classic-Bold.ttf') format('truetype');");
      return match;
    });
}

function htmlFontDeclarations(source) {
  return source.replace(/style=("[^"]*"|'[^']*')/g, (match, quoted) => {
    const quote = quoted[0];
    const css = fontDeclarations(quoted.slice(1, -1));
    return 'style=' + quote + css.replace(new RegExp(quote, 'g'), quote === '"' ? '&quot;' : '&#39;') + quote;
  });
}

function clientFontSource() {
  // Reuse the same stack rule for dynamic DOM/SVG text without a second copy.
  return 'var gaEfbFontFallback = ' + fontFallback.toString().replace(/\bFALLBACK\b/g, JSON.stringify(FALLBACK)) + ';\n';
}

function canvasFontPlugin({ types: t, template }) {
  return { visitor: { Program(p) {
    const helper = fontFallback.toString().replace('function fontFallback', 'function gaEfbProfileFont')
      .replace(/\bFALLBACK\b/g, JSON.stringify(FALLBACK));
    p.unshiftContainer('body', template.statement.ast(helper));
  }, AssignmentExpression(p) {
    const left = p.node.left;
    if (p.node.operator !== '=' || !t.isMemberExpression(left) || left.computed || !t.isIdentifier(left.property, {name:'font'})) return;
    // Shared profile code uses canvas .font assignments. The browser source is
    // unchanged; only its Coherent build gains the missing glyph families.
    p.node.right = t.callExpression(t.identifier('gaEfbProfileFont'), [p.node.right]);
  } } };
}

module.exports = { FALLBACK, fontFallback, fontDeclarations, htmlFontDeclarations, canvasFontPlugin, clientFontSource };
