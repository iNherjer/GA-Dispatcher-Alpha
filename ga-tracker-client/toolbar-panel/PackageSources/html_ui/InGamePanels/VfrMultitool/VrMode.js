(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAVrMode = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function booleanMode(value) {
    return value === true || value === 1 ? true : value === false || value === 0 ? false : null;
  }
  function read(runtime) {
    try {
      if (runtime.SimVar && typeof runtime.SimVar.GetSimVarValue === 'function') {
        var value = booleanMode(runtime.SimVar.GetSimVarValue('E:IS IN VR', 'boolean'));
        if (value !== null) return value;
      }
    } catch (_) {}
    var vars = runtime.g_externalVariables || runtime.globalVars;
    return vars ? booleanMode(vars.vrMode) : null;
  }
  function watch(runtime, notify) {
    var current = null, stopped = false, subscription = null;
    function accept(value) {
      var mode = booleanMode(value);
      if (stopped || mode === null || mode === current) return;
      current = mode; notify(mode);
    }
    function refresh() { accept(read(runtime)); }
    if (runtime.Coherent && typeof runtime.Coherent.on === 'function') {
      subscription = runtime.Coherent.on('SwitchVRModeState', accept);
    }
    refresh();
    var timer = runtime.setInterval(refresh, 1000);
    return {
      read: function () { refresh(); return current; },
      stop: function () {
        stopped = true; runtime.clearInterval(timer);
        if (subscription && typeof subscription.clear === 'function') subscription.clear();
        else if (runtime.Coherent && typeof runtime.Coherent.off === 'function') runtime.Coherent.off('SwitchVRModeState', accept);
      }
    };
  }
  return { read: read, watch: watch };
});
