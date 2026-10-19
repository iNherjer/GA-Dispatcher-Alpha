// Generated from display-clock.js by sync-efb-web-assets.js. Do not edit.
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;else {
    root.GADisplayClockCore = api;
    api.install(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'ga_display_clock_v1';
  var MAX_AGE_MS = 8000;
  var finite = value => typeof value === 'number' && Number.isFinite(value);
  var wrap = seconds => (seconds % 86400 + 86400) % 86400;
  function normalize() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    value = value || {};
    return {
      source: value.source === 'device' ? 'device' : 'simulator',
      zone: value.zone === 'local' ? 'local' : 'utc'
    };
  }
  // ABSOLUTE TIME is UTC seconds since midnight Jan 1, year 1.
  // Only time of day is needed here; no simulator dates become runtime timestamps.
  function resolve(settings, sample) {
    var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
    var choice = normalize(settings);
    var fd = sample && sample.flight;
    var fresh = sample && finite(sample.receivedAt) && now >= sample.receivedAt && now - sample.receivedAt <= MAX_AGE_MS;
    var absolute = fd && fd.simAbsoluteTimeSeconds;
    var local = fd && fd.simLocalTimeSeconds;
    var usable = fresh && fd && fd.simRunning !== 0 && fd.inMenuOrMap !== true && finite(absolute) && absolute >= 86400 && (choice.zone === 'utc' || finite(local) && local >= 0 && local < 86400);
    if (choice.source === 'simulator' && usable) {
      return {
        source: 'simulator',
        zone: choice.zone,
        fallback: false,
        seconds: choice.zone === 'local' ? local : wrap(absolute)
      };
    }
    var fallback = choice.source === 'simulator';
    var zone = fallback ? 'utc' : choice.zone;
    var date = new Date(now);
    var seconds = zone === 'utc' ? date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds() : date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return {
      source: 'device',
      zone,
      fallback,
      seconds
    };
  }
  // Prefer the flight region; without valid simulator data use device local time.
  function resolveRegional(settings, sample) {
    var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
    var choice = normalize(settings);
    var simulator = resolve({
      source: 'simulator',
      zone: 'local'
    }, sample, now);
    if (simulator.fallback) return _objectSpread(_objectSpread({}, resolve({
      source: 'device',
      zone: 'local'
    }, null, now)), {}, {
      fallback: true
    });
    if (choice.source === 'simulator') return _objectSpread(_objectSpread({}, simulator), {}, {
      zone: 'regional'
    });
    var utc = resolve({
      source: 'device',
      zone: 'utc'
    }, null, now);
    return {
      source: 'device',
      zone: 'regional',
      fallback: false,
      seconds: wrap(utc.seconds + sample.flight.simLocalTimeSeconds - wrap(sample.flight.simAbsoluteTimeSeconds))
    };
  }
  function format(clock) {
    var minutes = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var withSeconds = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if (!clock || !finite(clock.seconds) || !finite(minutes)) return '--:--';
    var seconds = Math.floor(wrap(clock.seconds + Math.max(0, minutes) * 60));
    var pad = value => String(value).padStart(2, '0');
    return pad(Math.floor(seconds / 3600)) + ':' + pad(Math.floor(seconds / 60) % 60) + (withSeconds ? ':' + pad(seconds % 60) : '');
  }
  function install(win) {
    var _settings = normalize(),
      sample = null;
    try {
      _settings = normalize(JSON.parse(win.localStorage.getItem(STORAGE_KEY)) || {});
    } catch (_) {}
    var current = zone => resolve(zone ? {
      source: _settings.source,
      zone
    } : _settings, sample);
    var setText = (id, text) => {
      var node = win.document.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    };
    function refreshClocks() {
      var utc = current('utc'),
        local = current('local');
      setText('mapStopwatchUtc', format(utc, 0, true));
      setText('mapStopwatchLocal', format(local, 0, true));
      setText('mapStopwatchLocalLabel', local.fallback ? 'UTC (Fallback)' : 'LOCAL');
      setText('mapStopwatchClockSource', utc.source === 'simulator' ? 'Simulator' : utc.fallback ? 'Gerät · Fallback' : 'Gerät');
    }
    function refresh() {
      var clock = current();
      var basis = (clock.source === 'simulator' ? 'SIM' : 'GER') + ' ' + (clock.zone === 'utc' ? 'UTC' : 'Lokal');
      setText('mapClockStatus', format(clock, 0, true) + ' · ' + basis + (clock.fallback ? ' · Fallback' : ''));
      setText('routeProgressTimeBasis', basis + (clock.fallback ? ' ↩' : ''));
      var source = win.document.getElementById('mapClockSource');
      var zone = win.document.getElementById('mapClockZone');
      if (source && source.value !== _settings.source) source.value = _settings.source;
      if (zone && zone.value !== _settings.zone) zone.value = _settings.zone;
      refreshClocks();
      if (typeof win.refreshRouteProgressBar === 'function') win.refreshRouteProgressBar();
    }
    win.GADisplayClock = {
      settings: () => _objectSpread({}, _settings),
      set: function set(patch) {
        var persistToTracker = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        _settings = normalize(_objectSpread(_objectSpread({}, _settings), patch));
        try {
          win.localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
        } catch (_) {}
        if (persistToTracker && typeof win.gaPersistDisplayClockSetting === 'function') {
          if (patch.source) win.gaPersistDisplayClockSetting('clockSource', _settings.source);
          if (patch.zone) win.gaPersistDisplayClockSetting('clockZone', _settings.zone);
        }
        refresh();
      },
      // Snapshot receipt is separate from the simulator clock. Never advance a
      // paused/missing sample with wall time or simulation rate.
      observe: function observe(flight) {
        var receivedAt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
        sample = flight ? {
          flight: _objectSpread({}, flight),
          receivedAt
        } : null;
        refresh();
      },
      clear: () => {
        sample = null;
        refresh();
      },
      regional: () => resolveRegional(_settings, sample),
      context: () => {
        var time = resolveRegional(_settings, sample);
        var fresh = sample && Date.now() >= sample.receivedAt && Date.now() - sample.receivedAt <= MAX_AGE_MS;
        var flight = fresh && sample.flight && sample.flight.simRunning !== 0 && sample.flight.inMenuOrMap !== true ? sample.flight : null;
        var utc = resolve({
          source: 'simulator',
          zone: 'utc'
        }, sample);
        var instantMs = time.source === 'simulator' && flight ? flight.simAbsoluteTimeSeconds * 1000 - 62135596800000 : Date.now();
        var offsetSeconds = time.zone === 'regional' && flight && !utc.fallback ? flight.simLocalTimeSeconds - (flight.simAbsoluteTimeSeconds % 86400 + 86400) % 86400 : -new Date().getTimezoneOffset() * 60;
        if (offsetSeconds < -43200) offsetSeconds += 86400;
        if (offsetSeconds > 50400) offsetSeconds -= 86400;
        return {
          time,
          instantMs,
          offsetSeconds,
          flight
        };
      },
      current,
      eta: minutes => format(current(), minutes),
      refresh,
      refreshClocks
    };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', refresh);else refresh();
    var timer = win.setInterval(refresh, 1000);
    win.addEventListener('pagehide', () => {
      win.clearInterval(timer);
      timer = null;
    });
    win.addEventListener('pageshow', () => {
      if (timer === null) timer = win.setInterval(refresh, 1000);
      refresh();
    });
  }
  return {
    normalize,
    resolve,
    resolveRegional,
    format,
    install,
    MAX_AGE_MS
  };
});
