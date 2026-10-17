// Generated from navcom-preferences-client.js by sync-efb-web-assets.js. Do not edit.
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
/* Shared Web/EFB preference sync. Radio tuning itself remains explicit. */
(function () {
  'use strict';

  var nativeEfb = document.body.classList.contains('ga-efb-tracker-host');
  var identity = '',
    cloud = null,
    pendingKey = '',
    busy = false,
    generation = 0,
    nativePending = null;
  function visible() {
    return document.visibilityState !== 'hidden';
  }
  function request(_x, _x2) {
    return _request.apply(this, arguments);
  }
  function _request() {
    _request = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(url, init) {
      var controller, timeout, response, data, _t;
      return _regenerator().w(function (_context3) {
        while (1) switch (_context3.p = _context3.n) {
          case 0:
            controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
            _context3.p = 1;
            _context3.n = 2;
            return fetch(url, _objectSpread(_objectSpread({}, init), {}, {
              signal: controller.signal,
              cache: 'no-store'
            }));
          case 2:
            response = _context3.v;
            _t = JSON;
            _context3.n = 3;
            return response.text();
          case 3:
            data = _t.parse.call(_t, _context3.v);
            return _context3.a(2, {
              ok: response.ok,
              status: response.status,
              json: function () {
                var _json = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
                  return _regenerator().w(function (_context2) {
                    while (1) switch (_context2.n) {
                      case 0:
                        return _context2.a(2, data);
                    }
                  }, _callee2);
                }));
                function json() {
                  return _json.apply(this, arguments);
                }
                return json;
              }()
            });
          case 4:
            _context3.p = 4;
            clearTimeout(timeout);
            return _context3.f(4);
          case 5:
            return _context3.a(2);
        }
      }, _callee3, null, [[1,, 4, 5]]);
    }));
    return _request.apply(this, arguments);
  }
  function connect() {
    if (nativeEfb) return true;
    var id = typeof getSyncId === 'function' ? getSyncId() : '';
    var pin = typeof getSyncPin === 'function' ? getSyncPin() : '';
    var next = JSON.stringify([id, pin]);
    if (next !== identity) {
      identity = next;
      generation++;
      pendingKey = 'ga_navcom_pending_v1:' + id.toUpperCase();
      cloud = null;
      if (id && pin && window.GACloudSyncClient && window.GANavcomPreferencesCore) {
        var baseUrl = typeof SYNC_URL === 'string' ? SYNC_URL : 'https://ga-proxy.einherjer.workers.dev/api/sync/';
        var client = window.GACloudSyncClient.create({
          request,
          pilotId: id,
          pin,
          baseUrl: baseUrl.replace(/\/sync\/?$/, '/sync-v2/')
        });
        cloud = window.GANavcomPreferencesCore.createCloud({
          client,
          readLegacy: function () {
            var _readLegacy = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
              var response;
              return _regenerator().w(function (_context) {
                while (1) switch (_context.n) {
                  case 0:
                    _context.n = 1;
                    return request(baseUrl + encodeURIComponent(id), {
                      headers: {
                        'X-Pilot-PIN': pin
                      }
                    });
                  case 1:
                    response = _context.v;
                    if (response.ok) {
                      _context.n = 2;
                      break;
                    }
                    throw new Error('navcom_profile_unavailable');
                  case 2:
                    return _context.a(2, response.json());
                }
              }, _callee);
            }));
            function readLegacy() {
              return _readLegacy.apply(this, arguments);
            }
            return readLegacy;
          }()
        });
      }
    }
    return !!cloud;
  }
  function readPending() {
    try {
      return JSON.parse(localStorage.getItem(pendingKey) || 'null');
    } catch (_) {
      return null;
    }
  }
  function sync() {
    return _sync.apply(this, arguments);
  }
  function _sync() {
    _sync = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      var epoch, key, adapter, mode, pending, saved, result, response, _pending, _t2;
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.p = _context4.n) {
          case 0:
            if (!(!visible() || busy || !connect() || typeof window.gaSetNavcomMode !== 'function')) {
              _context4.n = 1;
              break;
            }
            return _context4.a(2);
          case 1:
            busy = true;
            epoch = generation, key = pendingKey, adapter = cloud;
            _context4.p = 2;
            if (!nativeEfb) {
              _context4.n = 10;
              break;
            }
            pending = nativePending;
            if (!(pending !== null)) {
              _context4.n = 6;
              break;
            }
            _context4.n = 3;
            return request('/api/v1/navcom/settings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                mode: pending
              })
            });
          case 3:
            saved = _context4.v;
            _context4.n = 4;
            return saved.json();
          case 4:
            result = _context4.v;
            if (!(!saved.ok || !result.ok)) {
              _context4.n = 5;
              break;
            }
            throw new Error('navcom_settings_write_failed');
          case 5:
            if (nativePending === pending) nativePending = null;
          case 6:
            _context4.n = 7;
            return request('/api/v1/navcom/settings');
          case 7:
            response = _context4.v;
            if (response.ok) {
              _context4.n = 8;
              break;
            }
            throw new Error('navcom_settings_unavailable');
          case 8:
            _context4.n = 9;
            return response.json();
          case 9:
            mode = _context4.v.mode;
            _context4.n = 14;
            break;
          case 10:
            _pending = readPending();
            if (!_pending) {
              _context4.n = 12;
              break;
            }
            _context4.n = 11;
            return adapter.write(_pending.mode);
          case 11:
            if (localStorage.getItem(key) === JSON.stringify(_pending)) localStorage.removeItem(key);
            mode = _pending.mode;
            _context4.n = 14;
            break;
          case 12:
            _context4.n = 13;
            return adapter.read();
          case 13:
            mode = _context4.v;
          case 14:
            connect();
            if (epoch === generation && (nativeEfb ? nativePending === null : !readPending())) window.gaSetNavcomMode(mode, false);
            _context4.n = 16;
            break;
          case 15:
            _context4.p = 15;
            _t2 = _context4.v;
          case 16:
            _context4.p = 16;
            busy = false;
            return _context4.f(16);
          case 17:
            return _context4.a(2);
        }
      }, _callee4, null, [[2, 15, 16, 17]]);
    }));
    return _sync.apply(this, arguments);
  }
  window.gaPersistNavcomMode = function (mode) {
    connect();
    generation++;
    if (nativeEfb) {
      nativePending = mode;
      void sync();
    } else if (cloud) {
      try {
        localStorage.setItem(pendingKey, JSON.stringify({
          mode,
          at: Date.now()
        }));
      } catch (_) {}
      void sync();
    }
  };
  function install() {
    void sync();
    setInterval(sync, 15000);
    document.addEventListener('visibilitychange', () => {
      if (visible()) void sync();
    });
    window.addEventListener('pageshow', sync);
    window.addEventListener('online', sync);
    window.addEventListener('storage', () => {
      connect();
      void sync();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);else install();
})();
