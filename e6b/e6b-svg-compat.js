/* Keep the original dark labels and light halo on SVG engines without paint-order. */
(function(root) {
    root.gaE6BPrepareSvg = function(text) {
        // Coherent can accept the CSS declaration without rendering paint order.
        // Its EFB path always uses separate halo/ink nodes, in the same colors.
        var coherent = /(?:[?&])coherent=1(?:&|$)/.test(root.location.search);
        if (!coherent && root.CSS && root.CSS.supports && root.CSS.supports('paint-order', 'stroke')) return text;
        // Saved workbench SVGs use xlink:href without declaring its namespace.
        // HTML insertion accepts this; XML parsing (and SVG images) does not.
        if (/\bxlink:/.test(text) && !/\bxmlns:xlink=/.test(text)) {
            text = text.replace(/<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }
        var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        if (doc.querySelector('parsererror')) return text;
        var labels = doc.querySelectorAll('text.trace-number, text.trace-label, text.trace-index-label');
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i], halo = label.cloneNode(true);
            halo.removeAttribute('id');
            halo.setAttribute('aria-hidden', 'true');
            halo.style.setProperty('fill', 'none', 'important');
            halo.style.setProperty('pointer-events', 'none');
            label.parentNode.insertBefore(halo, label);
            // Coherent does not reliably inherit SVG text paint into nested tspans.
            // Set both layers explicitly, including multiline explanation fields.
            var inkNodes = [label].concat(Array.prototype.slice.call(label.querySelectorAll('tspan, textPath')));
            var haloNodes = [halo].concat(Array.prototype.slice.call(halo.querySelectorAll('tspan, textPath')));
            inkNodes.forEach(function(node) {
                node.style.setProperty('fill', '#101418', 'important');
                node.style.setProperty('stroke', 'none', 'important');
            });
            haloNodes.forEach(function(node) {
                node.style.setProperty('fill', 'none', 'important');
                node.style.setProperty('stroke', 'rgba(229,233,236,.68)', 'important');
                node.style.setProperty('stroke-width', '3px', 'important');
            });
        }
        return new XMLSerializer().serializeToString(doc);
    };
})(window);
