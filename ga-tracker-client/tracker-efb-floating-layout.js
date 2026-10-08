/* Layout adaptation for the detached EFB and toolbar only. The attached tablet
   retains its existing DOM, sizes, preferences and native SDK surface contract. */
(function (root) {
  'use strict';
  var queued = false, controls = null, original = null, inputs = null, actions = null;
  var saved = [], observer = null, observed = [];
  function byId(id) { return document.getElementById(id); }
  function floating() {
    var state = root.GAEfbUiScale && root.GAEfbUiScale.state();
    return !!state && (state.surface === 'popout' || state.surface === 'toolbar');
  }
  function remember(node, key) {
    for (var i = 0; i < saved.length; i++) if (saved[i].node === node && saved[i].key === key) return;
    saved.push({ node: node, key: key, value: node.style.getPropertyValue(key), priority: node.style.getPropertyPriority(key) });
  }
  function set(node, key, value, priority) {
    if (!node) return;
    remember(node, key);
    if (node.style.getPropertyValue(key) !== value || node.style.getPropertyPriority(key) !== (priority || '')) node.style.setProperty(key, value, priority || '');
  }
  function restore() {
    if (original && controls) {
      original.forEach(function(node) { controls.appendChild(node); });
      inputs.remove(); actions.remove(); original = null;
    }
    saved.forEach(function(item) {
      if (item.value) item.node.style.setProperty(item.key, item.value, item.priority);
      else item.node.style.removeProperty(item.key);
    });
    saved = [];
  }
  function profileActions() {
    controls = document.querySelector('.map-profile-controls');
    if (!controls || original) return;
    var gear = byId('btnVpSettings'), mode = byId('btnToggleVpMode');
    if (!gear || !mode) return;
    original = Array.prototype.slice.call(controls.childNodes);
    inputs = document.createElement('div'); inputs.className = 'ga-efb-profile-inputs';
    actions = document.createElement('div'); actions.className = 'ga-efb-profile-actions';
    var gearWrapper = gear.parentElement, reachedActions = false;
    original.forEach(function(node) {
      if (node === gearWrapper) reachedActions = true;
      if (node === gearWrapper || node === mode) actions.appendChild(node);
      else if (!reachedActions) inputs.appendChild(node);
      // The trailing separators and hidden simulator controls stay in the DOM.
    });
    controls.insertBefore(inputs, controls.firstChild); controls.appendChild(actions);
    // Wheel/trackpad access to the overflow; keyboard focus also scrolls controls.
    inputs.addEventListener('wheel', function(event) {
      if (inputs.scrollWidth <= inputs.clientWidth || event.ctrlKey) return;
      var before = inputs.scrollLeft;
      inputs.scrollLeft += (event.deltaX || event.deltaY) / root.GAEfbUiScale.state().effective;
      if (inputs.scrollLeft !== before) event.preventDefault();
    }, { passive: false });
  }
  function observe(node) {
    if (!observer || !node || observed.indexOf(node) >= 0) return;
    observed.push(node); observer.observe(node);
  }
  function visible(node) { return node && getComputedStyle(node).display !== 'none' && !node.hidden; }
  function infoBoxes(area) {
    var telemetry = byId('liveTelemetryBox'), next = byId('liveNextWpBox'), current = byId('liveCurrentBox');
    var width = area.clientWidth, height = area.clientHeight, pad = 6, gap = 6, bottom = pad;
    var defaultNodes = [telemetry, next].filter(function(node) { return visible(node) && !node.classList.contains('tele-dragged'); });
    var total = defaultNodes.reduce(function(sum, node) { return sum + node.offsetWidth; }, 0) + Math.max(0, defaultNodes.length - 1) * gap;
    var row = total + pad * 2 <= width, x = row ? Math.max(pad, (width - total) / 2) : pad;
    defaultNodes.forEach(function(node) {
      set(node, 'max-width', Math.max(1, width - pad * 2) + 'px', 'important');
      set(node, 'max-height', Math.max(24, height * .4) + 'px', 'important');
      set(node, 'overflow-y', 'auto');
      set(node, 'transform', 'none', 'important');
      set(node, 'left', (row ? x : Math.max(pad, (width - node.offsetWidth) / 2)) + 'px', 'important');
      set(node, 'right', 'auto'); set(node, 'top', (row ? pad : bottom) + 'px', 'important');
      bottom = Math.max(bottom, node.offsetTop + node.offsetHeight + gap); x += node.offsetWidth + gap;
      observe(node);
    });
    if (visible(current) && !current.classList.contains('tele-dragged')) {
      set(current, 'max-width', Math.max(1, width - pad * 2) + 'px', 'important');
      set(current, 'max-height', Math.max(24, height - bottom - pad) + 'px', 'important');
      set(current, 'overflow-y', 'auto');
      set(current, 'left', Math.max(pad, (width - current.offsetWidth) / 2) + 'px', 'important');
      set(current, 'right', 'auto'); set(current, 'top', bottom + 'px', 'important');
      set(current, 'transform', 'none', 'important'); observe(current);
    }
    // Saved, manually dragged boxes must be reachable after a smaller viewport.
    [telemetry, next, current].forEach(function(node) {
      if (!visible(node) || !node.classList.contains('tele-dragged')) return;
      set(node, 'left', Math.max(0, Math.min(node.offsetLeft, width - node.offsetWidth)) + 'px');
      set(node, 'top', Math.max(0, Math.min(node.offsetTop, height - node.offsetHeight)) + 'px');
    });
  }
  function clampRail(area) {
    var rail = byId('mapDrawRail'), button = byId('mapDrawFloatingBtn');
    if (!rail || !button) return;
    var margin = 6, width = area.clientWidth, height = area.clientHeight;
    set(rail, 'max-width', Math.max(1, width - margin * 2) + 'px');
    var x = Math.max(margin, Math.min(rail.offsetLeft, width - rail.offsetWidth - margin));
    var y = Math.max(margin, Math.min(rail.offsetTop, height - button.offsetHeight - margin));
    set(rail, 'left', x + 'px'); set(rail, 'top', y + 'px');
    set(rail, 'right', 'auto'); set(rail, 'bottom', 'auto');
  }
  function positionPax(area) {
    var widget = byId('paxVoiceWidget');
    // A left/top position belongs to the existing user drag preference.
    if (!visible(widget) || widget.style.left) return;
    var size = root.GAEfbUiScale.viewport(), bottom = root.GAEfbUiScale.delta(area.getBoundingClientRect().bottom);
    // Stack above the map's target button, leaving profile actions uncovered.
    var inset = Math.max(8, Math.min(size.height - widget.offsetHeight - 8, size.height - bottom + 76));
    set(widget, 'bottom', inset + 'px', 'important');
  }
  function menuStyle(menu, name, value) {
    if (menu.style[name] !== value) menu.style[name] = value;
  }
  function constrainMenu(menu) {
    if (!floating() || !menu || menu.style.display !== 'block') return;
    var size = root.GAEfbUiScale.viewport(), pad = Math.min(6, size.height / 4);
    var limit = Math.max(1, size.height - pad * 2);
    menuStyle(menu, 'maxHeight', Math.min(parseFloat(menu.style.maxHeight) || limit, limit) + 'px');
    menuStyle(menu, 'top', Math.round(Math.max(pad, Math.min(menu.offsetTop, size.height - menu.offsetHeight - pad))) + 'px');
    menuStyle(menu, 'left', Math.round(Math.max(pad, Math.min(menu.offsetLeft, size.width - menu.offsetWidth - pad))) + 'px');
  }
  var originalOpenMenu = root._openFloatingMenuInViewport;
  if (typeof originalOpenMenu === 'function') root._openFloatingMenuInViewport = function(menu) {
    originalOpenMenu.apply(this, arguments);
    constrainMenu(menu);
  };
  function positionMenus() {
    [['mapHintsMenu','mapHintsBtn',false],['mapVoiceMenu','mapVoiceBtn',false],['vpSettingsMenu','btnVpSettings',true]].forEach(function(pair) {
      var menu = byId(pair[0]), button = byId(pair[1]);
      if (menu && button && menu.style.display === 'block' && typeof root._positionFloatingMenuInViewport === 'function') {
        root._positionFloatingMenuInViewport(menu, button, pair[2]);
        constrainMenu(menu);
      }
    });
  }
  function layout() {
    queued = false;
    if (!floating()) { restore(); return; }
    profileActions();
    var size = root.GAEfbUiScale.viewport(), header = document.querySelector('.pinboard-header');
    if (header) set(header, 'max-height', Math.max(1, Math.min(90, size.height * .24)) + 'px', 'important');
    var content = document.querySelector('.maptable-content'), strip = byId('mapProfileStrip');
    if (content && strip) {
      set(strip, 'max-height', Math.max(24, content.clientHeight * .6) + 'px', 'important');
      set(strip, 'min-height', '0px', 'important');
    }
    var area = byId('mapArea');
    if (area) { infoBoxes(area); clampRail(area); positionPax(area); observe(area); }
    observe(header); observe(controls); observe(content);
    if (typeof root.gaEfbRefreshDrawerLayout === 'function') root.gaEfbRefreshDrawerLayout();
    positionMenus();
    // Canvas layout changes independently of the backing pixel buffer.
    if (typeof root.renderMapProfile === 'function') root.renderMapProfile();
  }
  function refresh() {
    // Restore synchronously when the SDK reattaches the same iframe to the tablet.
    if (!floating()) { restore(); return; }
    if (queued) return; queued = true;
    (root.requestAnimationFrame || function(fn) { root.setTimeout(fn, 0); })(layout);
  }
  if (root.ResizeObserver) observer = new root.ResizeObserver(refresh);
  root.GAEfbFloatingLayout = { refresh: refresh };
  root.addEventListener('resize', refresh);
})(window);
