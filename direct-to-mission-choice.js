/* Direct-To with an existing mission: ask "discard" / "keep (detour)" / "cancel".
   Shared by App and EFB (Coherent): ES5 only, no mission effects. */
(function(root) {
    'use strict';
    var open = null;

    function button(label, kind, onClick) {
        var el = document.createElement('button');
        el.type = 'button';
        el.textContent = label;
        el.setAttribute('data-choice', kind);
        var colors = { discard: '#b3261e', keep: '#0b7fa8', cancel: '#444' };
        el.style.cssText = 'display:block;width:100%;margin:8px 0 0;padding:11px 12px;border:0;border-radius:6px;'
            + 'font:600 14px/1.25 Arial,sans-serif;color:#fff;cursor:pointer;text-align:left;background:' + (colors[kind] || '#444') + ';';
        el.addEventListener('click', onClick);
        return el;
    }
    function hint(text) {
        var el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'margin:3px 2px 0;font:12px/1.35 Arial,sans-serif;color:#b9c7d2;';
        return el;
    }

    // texts: { title, body, discard, discardHint, keep, keepHint, cancel }
    function ask(texts) {
        texts = texts || {};
        if (open) open.finish('cancel');
        return new Promise(function(resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'ga-direct-to-choice';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
                + 'background:rgba(0,0,0,.55);padding:16px;box-sizing:border-box;';
            var box = document.createElement('div');
            box.style.cssText = 'max-width:380px;width:100%;background:#13202b;color:#eef6fb;border:1px solid rgba(120,190,230,.45);'
                + 'border-radius:10px;padding:16px 16px 14px;box-shadow:0 12px 40px rgba(0,0,0,.5);';
            var title = document.createElement('div');
            title.textContent = texts.title || 'Direct To';
            title.style.cssText = 'font:700 16px/1.3 Arial,sans-serif;margin-bottom:6px;';
            var body = document.createElement('div');
            body.textContent = texts.body || '';
            body.style.cssText = 'font:13px/1.45 Arial,sans-serif;color:#cfdde7;white-space:pre-line;';
            box.appendChild(title);
            box.appendChild(body);
            function finish(choice) {
                if (open !== handle) return;
                open = null;
                document.removeEventListener('keydown', onKey, true);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(choice);
            }
            function onKey(event) {
                if (event.key === 'Escape') { event.preventDefault(); finish('cancel'); }
            }
            box.appendChild(button(texts.keep || 'Mission erhalten', 'keep', function() { finish('keep'); }));
            if (texts.keepHint) box.appendChild(hint(texts.keepHint));
            box.appendChild(button(texts.discard || 'Mission verwerfen', 'discard', function() { finish('discard'); }));
            if (texts.discardHint) box.appendChild(hint(texts.discardHint));
            box.appendChild(button(texts.cancel || 'Abbrechen', 'cancel', function() { finish('cancel'); }));
            overlay.addEventListener('click', function(event) { if (event.target === overlay) finish('cancel'); });
            overlay.appendChild(box);
            var handle = { finish: finish };
            open = handle;
            document.addEventListener('keydown', onKey, true);
            (document.body || document.documentElement).appendChild(overlay);
        });
    }

    var api = { ask: ask, isOpen: function() { return !!open; } };
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GADirectToChoice = api;
})(typeof window !== 'undefined' ? window : null);
