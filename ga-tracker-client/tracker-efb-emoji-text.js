(function () {
  'use strict';
  // Render the existing glyph artwork as images; no color-font or font-fallback dependency.
  var sequence = window.gaEfbSymbolPattern();
  function update(node) {
    if (node.nodeType === 1) {
      if (!/^(http:\/\/www.w3.org\/1999\/xhtml|http:\/\/www.w3.org\/2000\/svg)$/.test(node.namespaceURI) || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(node.tagName) || node.classList.contains('ga-efb-emoji-sequence') || node.classList.contains('ga-efb-symbol')) return;
      // Only explicit inline/SVG overrides need work; stylesheet inheritance
      // already has fallbacks. Process added subtrees, not every telemetry tick.
      if (node.style && node.style.fontFamily) {
        var font = node.style.fontFamily;
        var fallback = gaEfbFontFallback(font);
        if (font !== fallback) node.style.setProperty('font-family', fallback, node.style.getPropertyPriority('font-family'));
      }
      if (node.hasAttribute('font-family')) node.setAttribute('font-family', gaEfbFontFallback(node.getAttribute('font-family')));
      if (node.classList.contains('route-tool-warning-row')) {
        // Exact standalone mix: airspace color 34%, transparent 66%.
        var color = node.style.getPropertyValue('--airspace-color').trim();
        var hex = /^#([0-9a-f]{6})$/i.exec(color);
        if (hex) {
          var n = parseInt(hex[1], 16);
          node.style.borderColor = 'rgba(' + [(n>>16)&255,(n>>8)&255,n&255,0.34].join(',') + ')';
        }
      }
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(update);
      return;
    }
    if (node.nodeType !== 3 || !/[\u00b0\u00b1\u00d7\u2190-\uffff\ud800-\udfff]/.test(node.nodeValue) || !node.parentNode) return;
    if (node.parentNode.namespaceURI !== 'http://www.w3.org/1999/xhtml' || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(node.parentNode.tagName)) return;
    if (node.parentNode.classList.contains('ga-efb-emoji-sequence') || node.parentNode.classList.contains('ga-efb-symbol')) return;
    var value = node.nodeValue, match, offset = 0, fragment = document.createDocumentFragment();
    sequence.lastIndex = 0;
    while ((match = sequence.exec(value))) {
      fragment.appendChild(document.createTextNode(value.slice(offset, match.index)));
      var span = document.createElement('span');
      span.className = 'ga-efb-symbol';
      var original = document.createElement('span');
      original.className = 'ga-efb-symbol-text';
      original.textContent = match[0];
      span.appendChild(original);
      var picture = window.gaEfbSymbolImage(match[0],getComputedStyle(node.parentNode).color).cloneNode(false);
      picture.setAttribute('aria-hidden', 'true');
      span.appendChild(picture);
      fragment.appendChild(span);
      offset = sequence.lastIndex;
      if (value.charAt(offset) === '\uFE0F') { original.textContent += '\uFE0F'; offset++; sequence.lastIndex = offset; }
    }
    if (!offset) return;
    fragment.appendChild(document.createTextNode(value.slice(offset)));
    node.parentNode.replaceChild(fragment, node);
  }
  update(document.body);
  if (typeof MutationObserver === 'function') new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === 'characterData') update(record.target);
      else Array.prototype.forEach.call(record.addedNodes, update);
    });
  }).observe(document.body, {childList: true, subtree: true, characterData: true});
})();
