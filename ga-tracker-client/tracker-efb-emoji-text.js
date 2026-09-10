(function () {
  'use strict';
  // A ZWJ sequence must use one font for every component. Text-font fallback
  // alone can split e.g. the pilot into a person and a separate aircraft.
  var sequence = /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])\uFE0F?(?:\u200D(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])\uFE0F?)+/g;
  function update(node) {
    if (node.nodeType === 1) {
      if (!/^(http:\/\/www.w3.org\/1999\/xhtml|http:\/\/www.w3.org\/2000\/svg)$/.test(node.namespaceURI) || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(node.tagName) || node.classList.contains('ga-efb-emoji-sequence')) return;
      // Only explicit inline/SVG overrides need work; stylesheet inheritance
      // already has fallbacks. Process added subtrees, not every telemetry tick.
      if (node.style && node.style.fontFamily) {
        var font = node.style.fontFamily;
        var fallback = gaEfbFontFallback(font);
        if (font !== fallback) node.style.setProperty('font-family', fallback, node.style.getPropertyPriority('font-family'));
      }
      if (node.hasAttribute('font-family')) node.setAttribute('font-family', gaEfbFontFallback(node.getAttribute('font-family')));
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(update);
      return;
    }
    if (node.nodeType !== 3 || node.nodeValue.indexOf('\u200D') < 0 || !node.parentNode) return;
    if (node.parentNode.namespaceURI !== 'http://www.w3.org/1999/xhtml' || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(node.parentNode.tagName)) return;
    if (node.parentNode.classList.contains('ga-efb-emoji-sequence')) return;
    var value = node.nodeValue, match, offset = 0, fragment = document.createDocumentFragment();
    sequence.lastIndex = 0;
    while ((match = sequence.exec(value))) {
      fragment.appendChild(document.createTextNode(value.slice(offset, match.index)));
      var span = document.createElement('span');
      span.className = 'ga-efb-emoji-sequence';
      span.textContent = match[0];
      fragment.appendChild(span);
      offset = sequence.lastIndex;
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
