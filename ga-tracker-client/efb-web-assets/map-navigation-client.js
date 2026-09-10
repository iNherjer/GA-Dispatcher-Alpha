// Generated from map-navigation-client.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./map-route-edit-core') : root.GAMapRouteEditCore);
  if (typeof module === 'object' && module.exports) module.exports = api;else root.GAMapNavigationClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  function create(options) {
    var state = null,
      queue = [],
      sending = false,
      deferred = null;
    function display() {
      if (!state) return;
      var points = state.points;
      try {
        queue.forEach(entry => {
          points = core.apply(points, entry.edit, state.resetPoints);
        });
      } catch (_) {
        points = state.points;
      }
      options.render(_objectSpread(_objectSpread({}, state), {}, {
        points
      }), queue.length > 0);
    }
    function receive(next) {
      if (!next || !Array.isArray(next.points)) return;
      if (sending) {
        if (state && next.id === state.id && next.revision < state.revision) return;
        if (deferred && next.id === deferred.id && next.revision < deferred.revision) return;
        // Once a new route has arrived, a late poll of the previous
        // route must not replace it while its last edit is still in flight.
        if (deferred && state && deferred.id !== state.id && next.id === state.id) return;
        deferred = next;
        return;
      }
      if (state && next.id === state.id && next.revision < state.revision) return;
      if (state && next.id !== state.id) queue = [];
      state = next;
      display();
    }
    function drain() {
      return _drain.apply(this, arguments);
    }
    function _drain() {
      _drain = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
        var entry, result, _options$refresh, _t;
        return _regenerator().w(function (_context) {
          while (1) switch (_context.p = _context.n) {
            case 0:
              if (!(sending || !queue.length)) {
                _context.n = 1;
                break;
              }
              return _context.a(2);
            case 1:
              sending = true;
              entry = queue[0];
              _context.p = 2;
              _context.n = 3;
              return options.request('navigation_edit', {
                routeId: state.id,
                edit: entry.edit
              }, state.revision);
            case 3:
              result = _context.v;
              if (result.navigation) state = result.navigation;
              if (result.ok) {
                _context.n = 4;
                break;
              }
              throw new Error(result.error || 'navigation_failed');
            case 4:
              queue.shift();
              if (!(deferred && (deferred.id !== state.id || deferred.revision > state.revision))) {
                _context.n = 5;
                break;
              }
              state = deferred;
              if (!queue.length) {
                _context.n = 5;
                break;
              }
              throw new Error('navigation_revision_conflict');
            case 5:
              _context.n = 7;
              break;
            case 6:
              _context.p = 6;
              _t = _context.v;
              queue = [];
              if (deferred && (deferred.id !== state.id || deferred.revision >= state.revision)) state = deferred;
              display();
              options.error(_t);
              (_options$refresh = options.refresh) === null || _options$refresh === void 0 || _options$refresh.call(options);
            case 7:
              _context.p = 7;
              deferred = null;
              sending = false;
              display();
              drain();
              return _context.f(7);
            case 8:
              return _context.a(2);
          }
        }, _callee, null, [[2, 6, 7, 8]]);
      }));
      return _drain.apply(this, arguments);
    }
    function edit(value) {
      if (!state || !state.editable) return false;
      try {
        var points = state.points;
        queue.forEach(entry => {
          points = core.apply(points, entry.edit, state.resetPoints);
        });
        core.apply(points, value, state.resetPoints);
      } catch (error) {
        options.error(error);
        return false;
      }
      queue.push({
        edit: value
      });
      display();
      drain();
      return true;
    }
    return {
      receive,
      edit,
      snapshot: () => state,
      pending: () => sending || queue.length > 0
    };
  }
  return {
    create
  };
});
