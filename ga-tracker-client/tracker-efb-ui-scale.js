(function (root) {
  'use strict';
  var factor = 1, user = 1, surface = 'unknown', vr = false;
  var lastLayout = null, lastBody = null;
  function normalizeSurface(value) {
    return ['physical', 'popout', 'toolbar', 'unknown'].indexOf(value) >= 0 ? value : 'unknown';
  }
  function base(value, isVr) {
    return isVr && (value === 'popout' || value === 'toolbar') ? 1.5 : 1;
  }
  function viewport() { return { width: root.innerWidth / factor, height: root.innerHeight / factor }; }
  function layout() {
    var body = root.document.body;
    if (!body) return;
    var signature = [root.innerWidth, root.innerHeight, root.devicePixelRatio || 1, factor, surface].join('|');
    if (body === lastBody && signature === lastLayout) return;
    lastBody = body; lastLayout = signature;
    var size = viewport(), floating = surface === 'popout' || surface === 'toolbar';
    body.style.setProperty('width', size.width + 'px', 'important');
    body.style.setProperty('height', size.height + 'px', 'important');
    body.style.setProperty('min-height', size.height + 'px', 'important');
    body.style.setProperty('position', 'absolute');
    body.style.setProperty('left', '0'); body.style.setProperty('top', '0');
    body.style.setProperty('transform-origin', '0 0');
    body.style.setProperty('transform', 'scale(' + factor + ')', 'important');
    body.style.setProperty('--ga-efb-vw', size.width / 100 + 'px');
    body.style.setProperty('--ga-efb-vh', size.height / 100 + 'px');
    ['dvh','svh','lvh','dvw','svw','lvw'].forEach(function(unit) {
      body.style.setProperty('--ga-efb-' + unit, floating ? (unit.slice(-1) === 'h' ? size.height : size.width) / 100 + 'px' : '1' + unit);
    });
    body.style.setProperty('--ga-efb-native-inset', 28 / factor + 'px');
    body.setAttribute('data-ga-efb-layout', floating ? 'floating' : 'physical');
    body.setAttribute('data-ga-efb-surface', surface);
    body.setAttribute('data-ga-efb-effective-scale', String(factor));
    if (typeof root.gaEfbRefreshDrawerLayout === 'function') root.gaEfbRefreshDrawerLayout();
    if (root.GAEfbFloatingLayout) root.GAEfbFloatingLayout.refresh();
    // Root scaling changes logical geometry without a native window resize.
    // Tools subscribe explicitly; identical telemetry polls never reach here.
    if (root.dispatchEvent && root.document.createEvent) {
      var event = root.document.createEvent('Event');
      event.initEvent('ga-efb-layout-change', false, false);
      root.dispatchEvent(event);
    }
  }
  function apply(value, nextSurface, isVr) {
    user = Math.max(0.9, Math.min(3, Number(value) || 1));
    surface = normalizeSurface(nextSurface); vr = isVr === true;
    var next = user * base(surface, vr), changed = next !== factor;
    factor = next; layout();
    if (changed) {
      // Leaflet already converts client coordinates using its container rectangle.
      // Keep its geographic zoom/center; only refresh the available layout size.
      if (root.map && root.map.invalidateSize) root.map.invalidateSize({ pan: false });
      if (typeof root.renderMapProfile === 'function') root.renderMapProfile();
    }
    return factor;
  }
  var api = { apply: apply, viewport: viewport, normalizeSurface: normalizeSurface,
    delta: function (value) { return value / factor; },
    state: function () { return { user: user, surface: surface, vr: vr, base: base(surface, vr), effective: factor }; } };
  root.GAEfbUiScale = api;
  root.addEventListener('resize', layout);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
