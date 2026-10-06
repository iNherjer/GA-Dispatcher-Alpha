(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GAHostSurface = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function read(runtime) {
    try {
      var value = runtime.PanelInfo && runtime.PanelInfo.is2D && runtime.PanelInfo.is2D.get();
      return value === true ? 'popout' : value === false ? 'physical' : 'unknown';
    } catch (_) { return 'unknown'; }
  }
  function watch(runtime, callback) {
    var stopped = false, last = null, subscription = null;
    function notify() { var next = read(runtime); if (!stopped && next !== last) { last = next; callback(next); } }
    try { if (runtime.PanelInfo && runtime.PanelInfo.is2D) subscription = runtime.PanelInfo.is2D.sub(notify, true); } catch (_) {}
    notify();
    // Also covers SDK initialization after the view was constructed.
    var timer = runtime.setInterval(notify, 1000);
    return { read: function () { return read(runtime); }, stop: function () {
      stopped = true; runtime.clearInterval(timer);
      if (subscription && subscription.destroy) subscription.destroy();
    } };
  }
  return { read: read, watch: watch };
});
