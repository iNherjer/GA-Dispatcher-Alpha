'use strict';

// Coherent has no browser/OS-wide Unicode fallback. Keep the original face
// first (including instrument fonts) and supply missing glyphs locally.
const fontFallback = require('./tracker-efb-font-fallback');
const FALLBACK = fontFallback.FALLBACK;

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
  // pkg bytecode functions stringify as [native code]. Serve packaged source,
  // never reconstruct browser scripts from runtime function objects.
  return require('node:fs').readFileSync(require('node:path').join(__dirname, 'tracker-efb-font-fallback.js'), 'utf8') + '\n';
}

function canvasFontPlugin({ types: t, template }) {
  return { visitor: { Program(p) {
    const helper = `function gaEfbProfileFont(value) {
      // Coherent canvas accepts one family. Retain the App face instead of a
      // comma-separated fallback list (symbols are drawn separately).
      return value.replace(/(\\d+(?:\\.\\d+)?px)\\s+(.+)$/, function(_, size, family) {
        return size + ' ' + family.split(',')[0];
      });
    }`;
    p.unshiftContainer('body', template.statement.ast(helper));
  }, CallExpression(p) {
    const c=p.node.callee;
    if (!t.isMemberExpression(c) || c.computed || !t.isIdentifier(c.property,{name:'fillText'})) return;
    p.replaceWith(t.callExpression(t.identifier('gaEfbCanvasFillText'), [c.object, ...p.node.arguments]));
  }, AssignmentExpression(p) {
    const left = p.node.left;
    if (p.node.operator !== '=' || !t.isMemberExpression(left) || left.computed || !t.isIdentifier(left.property, {name:'font'})) return;
    // Shared profile code uses canvas .font assignments. The browser source is
    // unchanged; its Coherent build retains a single supported font family.
    p.node.right = t.callExpression(t.identifier('gaEfbProfileFont'), [p.node.right]);
  } } };
}

module.exports = { FALLBACK, fontFallback, fontDeclarations, htmlFontDeclarations, canvasFontPlugin, clientFontSource };
