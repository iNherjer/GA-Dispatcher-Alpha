/* Shared font-stack rule, shipped as source as well as used by Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.gaEfbFontFallback = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  var FALLBACK = '"GA EFB Text", "GA EFB Emoji", "GA EFB Symbols", "GA EFB Math"';

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

  fontFallback.FALLBACK = FALLBACK;
  return fontFallback;
});
