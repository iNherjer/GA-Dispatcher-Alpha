// Coherent-specific presentation and legacy input for the shared media devices.
(function(root) {
  'use strict';
  var instances = [], viewport = null, settings = null, lastPointer = 0, legacy = null, synthetic = false;
  function delta(value) { return root.GAEfbUiScale ? root.GAEfbUiScale.delta(value) : value; }
  function layout() {
    if (!viewport) return;
    var size = root.GAEfbUiScale ? root.GAEfbUiScale.viewport() : {width:root.innerWidth,height:root.innerHeight};
    var header = root.document.querySelector('#mapTableOverlay .pinboard-header');
    var top = header ? delta(header.getBoundingClientRect().bottom) + 8 : 56;
    top = Math.min(Math.max(0, top), Math.max(0, size.height - 80));
    viewport.style.left = '0px'; viewport.style.top = top + 'px';
    viewport.style.width = size.width + 'px'; viewport.style.height = Math.max(1, size.height - top) + 'px';
    instances.forEach(function(ui) { if (ui.refresh) ui.refresh(); });
  }
  function host() {
    if (!viewport) {
      viewport = root.document.createElement('div'); viewport.className = 'ga-efb-media-viewport';
      root.document.body.appendChild(viewport);
    }
    layout(); return viewport;
  }
  function pointer(type, original, point) {
    if (!legacy) return;
    var event = root.document.createEvent('MouseEvents');
    event.initMouseEvent(type, true, true, root, 0, 0, 0, point.clientX, point.clientY, false, false, false, false, 0, null);
    Object.defineProperty(event, 'pointerId', {value: 9101});
    Object.defineProperty(event, 'pointerType', {value: original.touches || original.changedTouches ? 'touch' : 'mouse'});
    synthetic = true;
    try { legacy.target.dispatchEvent(event); } finally { synthetic = false; }
  }
  function point(event) { return event.touches && event.touches[0] || event.changedTouches && event.changedTouches[0] || event; }
  function begin(event) {
    if (Date.now() - lastPointer < 600 || legacy || event.button !== undefined && event.button !== 0) return;
    legacy = {target:event.target}; pointer('pointerdown', event, point(event));
  }
  function move(event) { if (legacy) { pointer('pointermove',event,point(event)); event.preventDefault(); } }
  function end(event) { if (!legacy) return; pointer(event.type === 'touchcancel' ? 'pointercancel' : 'pointerup',event,point(event)); legacy = null; }
  function wire(ui) {
    var layer = ui.element.parentNode;
    layer.addEventListener('pointerdown', function() { if (!synthetic) lastPointer = Date.now(); }, true);
    layer.addEventListener('mousedown', begin, true); layer.addEventListener('touchstart', begin, true);
    var destroy = ui.destroy;
    ui.destroy = function() {
      instances = instances.filter(function(value) { return value !== ui; });
      if (legacy && layer.contains(legacy.target)) legacy = null;
      layer.removeEventListener('mousedown',begin,true); layer.removeEventListener('touchstart',begin,true);
      destroy();
    };
    instances.push(ui); return ui;
  }
  var create = root.GAMediaPlayerUI.create;
  root.GAMediaPlayerUI.create = function(options) {
    options = Object.assign({}, options, {host:host()});
    return wire(create(options));
  };
  root.addEventListener('mousemove',move,true); root.addEventListener('mouseup',end,true);
  root.addEventListener('touchmove',move,true); root.addEventListener('touchend',end,true); root.addEventListener('touchcancel',end,true);
  root.addEventListener('resize',layout); root.addEventListener('ga-efb-layout-change',layout);
  function refreshSettings() {
    if (!settings) return;
    if (root.gaRefreshLocalAudioCheckboxes) root.gaRefreshLocalAudioCheckboxes();
    Array.prototype.forEach.call(settings.querySelectorAll('select'),function(select) {
      var group = select._gaEfbChoices;
      if (!group) {
        group = root.document.createElement('span'); group.className = 'ga-efb-media-choices';
        group.setAttribute('role','group'); group.setAttribute('aria-label',select.getAttribute('aria-label') || 'Restlautstärke');
        select.parentNode.insertBefore(group,select); select.style.display = 'none'; select._gaEfbChoices = group;
      }
      var signature = Array.prototype.map.call(select.options,function(option) { return option.value + ':' + option.text; }).join('|');
      if (group._gaOptions !== signature) {
        group._gaOptions = signature; while (group.firstChild) group.removeChild(group.firstChild);
        Array.prototype.forEach.call(select.options,function(option) {
          var button = root.document.createElement('button'); button.type = 'button'; button.textContent = option.text;
          button.setAttribute('data-value',option.value); button.setAttribute('aria-label',option.text);
          button.onclick = function(event) {
            event.preventDefault(); event.stopPropagation(); select.value = option.value;
            if (typeof select.onchange === 'function') select.onchange.call(select);
            refreshSettings();
          };
          group.appendChild(button);
        });
      }
      Array.prototype.forEach.call(group.children,function(button) {
        button.disabled = select.disabled;
        button.setAttribute('aria-pressed',button.getAttribute('data-value') === select.value ? 'true' : 'false');
      });
    });
  }
  root.gaEfbMediaSettings = function(container) {
    settings = container;
    container.querySelector('.ga-media-enable').id = 'gaMediaEnabledCheck';
    container.querySelector('.ga-media-duck').id = 'gaMediaDuckCheck';
    refreshSettings();
  };
  root.gaEfbRefreshMediaSettings = refreshSettings;
})(window);
