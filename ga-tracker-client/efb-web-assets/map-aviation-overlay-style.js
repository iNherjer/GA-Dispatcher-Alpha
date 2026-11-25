// Generated from map-aviation-overlay-style.js by sync-efb-web-assets.js. Do not edit.
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
// Customisable OpenAIP overlay in the web map table: airspace colours per
// category, border/fill transparency, line width, and an ICAO-style symbol set
// for airfields (instead of the yellow dots). Map rendering only: airspace
// warnings and the side drawer keep their own fixed colours.
(function (root) {
  'use strict';

  var STORAGE_KEY = 'ga_openaip_overlay_style_v1';

  // OpenAIP types: 0 other, 1 restricted, 2 danger, 3 prohibited, 4 CTR, 5 TMZ,
  // 6 RMZ, 7 TMA, 8 TRA, 9 TSA, 21 gliding sector, 26 CTA, 27/28 (legacy TMZ/RMZ
  // mapping of the map), 33 FIS. Controlled airspace (0, 7, 26) by ICAO class
  // (0 A ... 6 G), so single classes such as E can be hidden.
  var CLASSED_TYPES = [0, 7, 26];
  var AIRSPACE_CATEGORIES = Object.freeze([{
    id: 'prohibited',
    label: 'Verbotsgebiet (ED-P)',
    short: 'ED-P',
    color: '#ef4444',
    fill: 0.16,
    weight: 2,
    match: t => t === 3
  }, {
    id: 'restricted',
    label: 'ED-R / ED-D',
    short: 'ED-R',
    color: '#f97316',
    fill: 0.12,
    weight: 2,
    match: t => t === 1 || t === 2
  }, {
    id: 'ctr',
    label: 'CTR',
    short: 'CTR',
    color: '#3b82f6',
    fill: 0.10,
    weight: 2,
    match: t => t === 4
  }, {
    id: 'classC',
    label: 'Klasse A–C (TMA/CTA)',
    short: 'C',
    color: '#0ea5e9',
    fill: 0.08,
    weight: 1.8,
    match: (t, c) => CLASSED_TYPES.includes(t) && c >= 0 && c <= 2
  }, {
    id: 'classD',
    label: 'Klasse D',
    short: 'D',
    color: '#2563eb',
    fill: 0.08,
    weight: 1.8,
    match: (t, c) => CLASSED_TYPES.includes(t) && c === 3
  }, {
    id: 'classE',
    label: 'Klasse E',
    short: 'E',
    color: '#64748b',
    fill: 0.03,
    weight: 1.4,
    dash: '8,5',
    match: (t, c) => CLASSED_TYPES.includes(t) && c === 4
  }, {
    id: 'classFG',
    label: 'Klasse F / G',
    short: 'G',
    color: '#94a3b8',
    fill: 0.03,
    weight: 1.2,
    dash: '4,4',
    match: (t, c) => CLASSED_TYPES.includes(t)
  }, {
    id: 'tmz',
    label: 'TMZ',
    short: 'TMZ',
    color: '#a855f7',
    fill: 0.08,
    weight: 1.6,
    dash: '5,4',
    match: t => t === 5 || t === 27
  }, {
    id: 'para',
    label: 'Fallschirm',
    short: 'PJA',
    color: '#f59e0b',
    fill: 0.10,
    weight: 1.6,
    dash: '3,3',
    match: (t, c, para) => (t === 6 || t === 28) && para
  }, {
    id: 'rmz',
    label: 'RMZ',
    short: 'RMZ',
    color: '#a855f7',
    fill: 0.08,
    weight: 1.6,
    dash: '5,4',
    match: t => t === 6 || t === 28
  }, {
    id: 'glider',
    label: 'Segelflugsektor',
    short: 'GLD',
    color: '#16a34a',
    fill: 0.06,
    weight: 1.4,
    dash: '6,3',
    visible: false,
    match: t => t === 21
  }, {
    id: 'tra',
    label: 'TRA / TSA',
    short: 'TRA',
    color: '#db2777',
    fill: 0.06,
    weight: 1.4,
    dash: '6,3',
    visible: false,
    match: t => t === 8 || t === 9
  }, {
    id: 'fis',
    label: 'FIS / Sonstige',
    short: '',
    color: '#94a3b8',
    fill: 0.05,
    weight: 1.4,
    match: () => true
  }]);
  var RENDERED_TYPES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 21, 26, 27, 28, 33]);
  var DEFAULTS = Object.freeze({
    airspaces: Object.freeze(AIRSPACE_CATEGORIES.reduce((out, category) => {
      out[category.id] = Object.freeze({
        color: category.color,
        visible: category.visible !== false
      });
      return out;
    }, {})),
    borderStyle: 'band',
    borderOpacity: 100,
    bandWidth: 10,
    bandOpacity: 35,
    fill: 100,
    lineWidth: 100,
    labels: true,
    labelSize: 100,
    labelMinZoom: 10,
    labelPlacement: 'border',
    vfrHandoff: true,
    vfrHandoffZoom: 12,
    vrpVisible: true,
    vrpColor: '#1d4ed8',
    vrpMinZoom: 9,
    airportSymbols: 'icao',
    airportColor: '#1d4ed8',
    airportSize: 100,
    airportLabels: true
  });

  // Airfield kinds (airportKind) that can be shown or hidden in the panel.
  var AIRPORT_KINDS = [{
    id: 'intl',
    label: 'Verkehrsflughäfen'
  }, {
    id: 'civil',
    label: 'Flugplätze'
  }, {
    id: 'glider',
    label: 'Segelfluggelände'
  }, {
    id: 'ul',
    label: 'UL-Gelände'
  }, {
    id: 'strip',
    label: 'Landestreifen'
  }, {
    id: 'heli',
    label: 'Hubschrauberlandeplätze'
  }, {
    id: 'water',
    label: 'Wasserflugplätze'
  }, {
    id: 'military',
    label: 'Militärflugplätze'
  }, {
    id: 'closed',
    label: 'Geschlossene Plätze'
  }];
  function storageGet() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }
  function storageSet(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
  }
  var isColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  var percent = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;
  function read() {
    var stored = {};
    try {
      stored = JSON.parse(storageGet() || '{}') || {};
    } catch (_) {
      stored = {};
    }
    var airspaces = {};
    AIRSPACE_CATEGORIES.forEach(category => {
      var value = stored.airspaces && stored.airspaces[category.id] || {};
      airspaces[category.id] = {
        color: isColor(value.color) ? value.color.toLowerCase() : category.color,
        visible: typeof value.visible === 'boolean' ? value.visible : category.visible !== false
      };
    });
    return {
      airspaces,
      borderStyle: stored.borderStyle === 'line' ? 'line' : 'band',
      borderOpacity: percent(stored.borderOpacity, DEFAULTS.borderOpacity, 0, 100),
      bandWidth: percent(stored.bandWidth, DEFAULTS.bandWidth, 2, 40),
      bandOpacity: percent(stored.bandOpacity, DEFAULTS.bandOpacity, 0, 100),
      fill: percent(stored.fill, DEFAULTS.fill, 0, 300),
      lineWidth: percent(stored.lineWidth, DEFAULTS.lineWidth, 50, 500),
      labels: stored.labels !== false,
      labelSize: percent(stored.labelSize, DEFAULTS.labelSize, 60, 220),
      labelMinZoom: percent(stored.labelMinZoom, DEFAULTS.labelMinZoom, 7, 14),
      labelPlacement: stored.labelPlacement === 'center' ? 'center' : 'border',
      vfrHandoff: stored.vfrHandoff !== false,
      vfrHandoffZoom: percent(stored.vfrHandoffZoom, DEFAULTS.vfrHandoffZoom, 9, 14),
      vrpVisible: stored.vrpVisible !== false,
      vrpColor: isColor(stored.vrpColor) ? stored.vrpColor.toLowerCase() : DEFAULTS.vrpColor,
      vrpMinZoom: percent(stored.vrpMinZoom, DEFAULTS.vrpMinZoom, 7, 14),
      airportSymbols: stored.airportSymbols === 'dots' ? 'dots' : 'icao',
      airportColor: isColor(stored.airportColor) ? stored.airportColor.toLowerCase() : DEFAULTS.airportColor,
      airportSize: percent(stored.airportSize, DEFAULTS.airportSize, 60, 300),
      airportLabels: stored.airportLabels !== false,
      airportKinds: AIRPORT_KINDS.reduce((out, kind) => {
        out[kind.id] = !(stored.airportKinds && stored.airportKinds[kind.id] === false);
        return out;
      }, {})
    };
  }
  var cache = null;
  function settings() {
    if (!cache) cache = read();
    return cache;
  }
  function save(next) {
    cache = next;
    storageSet(JSON.stringify(next));
  }
  function categoryFor(airspace) {
    var type = Number(airspace && airspace.type);
    var icaoClass = Number(airspace && airspace.icaoClass);
    var para = /\bPARA\b/i.test(String(airspace && airspace.name || ''));
    return AIRSPACE_CATEGORIES.find(c => c.match(type, icaoClass, para));
  }

  // Leaflet path options for one airspace, or null when its category is hidden.
  function airspaceStyle(airspace) {
    var s = settings();
    var category = categoryFor(airspace);
    var chosen = s.airspaces[category.id];
    if (!chosen.visible) return null;
    return {
      category: category.id,
      color: chosen.color,
      opacity: s.borderOpacity / 100,
      weight: Math.round(category.weight * s.lineWidth) / 100,
      fillColor: chosen.color,
      fillOpacity: Math.min(0.9, category.fill * s.fill / 100),
      dashArray: category.dash || null,
      band: s.borderStyle === 'band' ? {
        width: s.bandWidth,
        opacity: s.bandOpacity / 100
      } : null
    };
  }

  // ---- Border band: a wide, transparent stroke clipped to the inside of
  // the airspace (SVG clipPath that reuses the outline path via <use>).
  var clipCounter = 0;
  function airspaceLayers(L, latlngs, style, pane, tooltip) {
    var outline = L.polygon(latlngs, {
      pane,
      color: style.color,
      opacity: style.opacity,
      weight: style.weight,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      dashArray: style.dashArray,
      interactive: false
    });
    if (tooltip) outline.bindTooltip(tooltip, {
      sticky: true,
      className: 'airspace-tooltip'
    });
    if (!style.band || style.band.opacity <= 0) return [outline];
    var band = L.polygon(latlngs, {
      pane,
      color: style.color,
      opacity: Math.min(1, style.band.opacity * Math.max(style.opacity, 0.15)),
      weight: style.band.width * 2,
      fill: false,
      lineJoin: 'round',
      interactive: false
    });
    band.on('add', () => {
      var path = band._path;
      var source = outline._path;
      var svg = path && path.ownerSVGElement;
      if (!path || !source || !svg) return;
      clipCounter += 1;
      var id = 'ga-airspace-clip-' + clipCounter;
      if (!source.id) source.id = id + '-outline';
      var defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }
      var clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clip.id = id;
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + source.id);
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + source.id);
      clip.appendChild(use);
      defs.appendChild(clip);
      path.setAttribute('clip-path', 'url(#' + id + ')');
      band._gaClip = clip;
    });
    band.on('remove', () => {
      if (band._gaClip && band._gaClip.parentNode) band._gaClip.parentNode.removeChild(band._gaClip);
      band._gaClip = null;
    });
    return [outline, band];
  }

  // ---- Labels: category or name plus vertical limits ----
  function formatLimit(limit) {
    if (!limit || limit.value === undefined || limit.value === null) return '?';
    var value = Number(limit.value);
    var unit = Number(limit.unit);
    var datum = Number(limit.referenceDatum);
    if (unit === 6) return 'FL' + String(Math.round(value)).padStart(3, '0').replace(/^0(?=\d{3})/, '');
    var feet = unit === 0 ? Math.round(value * 3.28084) : Math.round(value);
    if (datum === 0) return feet === 0 ? 'GND' : feet + ' AGL';
    return String(feet);
  }
  function airspaceLabel(airspace, category) {
    var name = String(airspace && airspace.name || '').replace(/\s+/g, ' ').trim();
    var title = category.short;
    if (['prohibited', 'restricted', 'tra', 'glider'].includes(category.id)) {
      var code = /^(ED|LS|LO|LF|EB|EH|EP|LK)[- ]?[RDP]\s*\d+[A-Z]?/i.exec(name);
      title = code ? code[0].toUpperCase().replace(/\s+/, ' ') : name.slice(0, 20) || category.short;
    } else if (category.id === 'ctr') {
      title = 'CTR ' + name.replace(/\bCTR\b/i, '').trim().slice(0, 18);
    }
    var limits = formatLimit(airspace.lowerLimit) + '–' + formatLimit(airspace.upperLimit);
    return {
      title: title.trim(),
      limits
    };
  }

  // Area centroid of a ring (planar, fine at airspace scale).
  function ringCentroid(L, latlngs) {
    var area = 0,
      x = 0,
      y = 0;
    for (var i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
      var f = latlngs[j][1] * latlngs[i][0] - latlngs[i][1] * latlngs[j][0];
      area += f;
      x += (latlngs[j][1] + latlngs[i][1]) * f;
      y += (latlngs[j][0] + latlngs[i][0]) * f;
    }
    if (Math.abs(area) < 1e-12) return null;
    return L.latLng(y / (3 * area), x / (3 * area));
  }
  function pointInRing(point, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i],
        b = ring[j];
      if (a.y > point.y !== b.y > point.y && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
    }
    return inside;
  }

  // Point on the boundary nearest to the view centre, with the segment angle
  // and the inward normal (screen coordinates).
  function borderAnchor(ring, centre, width, height, margin) {
    var best = null;
    for (var i = 0; i < ring.length - 1; i++) {
      var a = ring[i],
        b = ring[i + 1];
      var dx = b.x - a.x,
        dy = b.y - a.y;
      var length2 = dx * dx + dy * dy;
      if (length2 < 400) continue;
      var t = Math.max(0.1, Math.min(0.9, ((centre.x - a.x) * dx + (centre.y - a.y) * dy) / length2));
      var p = {
        x: a.x + dx * t,
        y: a.y + dy * t
      };
      if (p.x < margin || p.y < margin || p.x > width - margin || p.y > height - margin) continue;
      var distance = Math.pow(p.x - centre.x, 2) + Math.pow(p.y - centre.y, 2);
      if (!best || distance < best.distance) best = {
        p,
        dx,
        dy,
        distance
      };
    }
    if (!best) return null;
    var length = Math.sqrt(best.dx * best.dx + best.dy * best.dy);
    var normal = {
      x: -best.dy / length,
      y: best.dx / length
    };
    if (!pointInRing({
      x: best.p.x + normal.x * 6,
      y: best.p.y + normal.y * 6
    }, ring)) normal = {
      x: -normal.x,
      y: -normal.y
    };
    var angle = Math.atan2(best.dy, best.dx) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle <= -90) angle += 180;
    return {
      p: best.p,
      normal,
      angle
    };
  }

  // Keeps the label markers inside the airspace layer group (toggles with the overlay).
  function updateAirspaceLabels(L, map, group, airspaces, pane) {
    if (!map || !group) return;
    (group._gaLabels || []).forEach(marker => group.removeLayer(marker));
    group._gaLabels = [];
    var s = settings();
    if (!s.labels || !Array.isArray(airspaces) || map.getZoom() < s.labelMinZoom) return;
    var size = map.getSize();
    var centre = {
      x: size.x / 2,
      y: size.y / 2
    };
    var view = map.getBounds();
    var scale = s.labelSize / 100;
    var placed = [];
    var candidates = [];
    airspaces.forEach(airspace => {
      var type = Number(airspace && airspace.type);
      if (!RENDERED_TYPES.includes(type) || type === 33) return;
      var style = airspaceStyle(airspace);
      if (!style) return;
      var geometry = airspace.geometry;
      var coords = geometry && (geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0] : null);
      if (!Array.isArray(coords) || coords.length < 3) return;
      var latlngs = coords.map(p => [Number(p[1]), Number(p[0])]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      var bounds = L.latLngBounds(latlngs);
      if (!view.intersects(bounds)) return;
      var ring = latlngs.map(ll => map.latLngToContainerPoint(ll));
      var xs = ring.map(p => p.x),
        ys = ring.map(p => p.y);
      var boxW = Math.max.apply(Math, _toConsumableArray(xs)) - Math.min.apply(Math, _toConsumableArray(xs)),
        boxH = Math.max.apply(Math, _toConsumableArray(ys)) - Math.min.apply(Math, _toConsumableArray(ys));
      if (boxW < 50 || boxH < 30) return;
      var label = airspaceLabel(airspace, categoryFor(airspace));
      var textWidth = Math.max(label.title.length, label.limits.length) * 6.6 * scale + 12;
      var textHeight = 28 * scale;
      var anchorPoint = null,
        angle = 0;
      if (s.labelPlacement === 'border') {
        var anchor = borderAnchor(ring, centre, size.x, size.y, 24);
        if (!anchor) return;
        var offset = textHeight / 2 + 2;
        anchorPoint = {
          x: anchor.p.x + anchor.normal.x * offset,
          y: anchor.p.y + anchor.normal.y * offset
        };
        angle = anchor.angle;
      } else {
        var c = ringCentroid(L, latlngs) || bounds.getCenter();
        anchorPoint = map.latLngToContainerPoint(c);
        if (anchorPoint.x < 0 || anchorPoint.y < 0 || anchorPoint.x > size.x || anchorPoint.y > size.y) return;
      }
      var distance = Math.pow(anchorPoint.x - centre.x, 2) + Math.pow(anchorPoint.y - centre.y, 2);
      candidates.push({
        airspace,
        style,
        label,
        anchorPoint,
        angle,
        textWidth,
        textHeight,
        distance
      });
    });
    candidates.sort((a, b) => a.distance - b.distance);
    candidates.forEach(candidate => {
      if (group._gaLabels.length >= 60) return;
      // Simple collision check on the (unrotated) box radius.
      var radius = Math.max(candidate.textWidth, candidate.textHeight) / 2;
      if (placed.some(p => Math.hypot(p.x - candidate.anchorPoint.x, p.y - candidate.anchorPoint.y) < (p.r + radius) * 0.8)) return;
      placed.push({
        x: candidate.anchorPoint.x,
        y: candidate.anchorPoint.y,
        r: radius
      });
      var marker = L.marker(map.containerPointToLatLng(L.point(candidate.anchorPoint.x, candidate.anchorPoint.y)), {
        pane,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'ga-airspace-label',
          html: '<span style="--ga-airspace-color:' + candidate.style.color + ';font-size:' + Math.round(11 * scale * 10) / 10 + 'px;transform:translate(-50%,-50%) rotate(' + Math.round(candidate.angle) + 'deg)"><b>' + escapeText(candidate.label.title) + '</b><i>' + escapeText(candidate.label.limits) + '</i></span>',
          iconSize: null
        })
      });
      group.addLayer(marker);
      group._gaLabels.push(marker);
    });
  }

  // ---- VFR reporting points: open flightmaps (with type and aerodrome) where
  // published, OpenAIP names elsewhere. OFMA licence: attribution and a way
  // to report errors (popup link); not a primary navigation source.
  var OFM_POINTS_URL = './data/ofm-reporting-points.json';
  var OFM_ATTRIBUTION = 'Meldepunkte &copy; <a href="https://www.openflightmaps.org/" target="_blank" rel="noopener noreferrer">open flightmaps</a>';
  var KIND_LABEL = {
    compulsory: 'Pflichtmeldepunkt',
    request: 'Bedarfsmeldepunkt',
    enroute: 'Streckenmeldepunkt'
  };
  var ofmState = {
    points: null,
    promise: null,
    meta: null
  };
  function loadOfmPoints(onLoaded) {
    var url = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : OFM_POINTS_URL;
    if (ofmState.points) return Promise.resolve(ofmState.points);
    if (!ofmState.promise) {
      ofmState.promise = fetch(url).then(r => r.ok ? r.json() : null).then(data => {
        ofmState.points = data && Array.isArray(data.points) ? data.points : [];
        ofmState.meta = data ? {
          airac: data.airac,
          regions: data.regions
        } : null;
        return ofmState.points;
      }).catch(() => {
        ofmState.points = [];
        return ofmState.points;
      });
    }
    return typeof onLoaded === 'function' ? ofmState.promise.then(points => {
      onLoaded();
      return points;
    }) : ofmState.promise;
  }
  function vrpSvg(kind, color, source) {
    var filled = kind === 'compulsory';
    var small = kind === 'enroute' || source === 'openaip';
    var points = small ? '14,7 20.5,19 7.5,19' : '14,5 22,20 6,20';
    return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true"><polygon points="' + points + '" fill="' + (filled ? color : '#ffffff') + '" fill-opacity="' + (filled ? 1 : 0.85) + '" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"/>' + (filled ? '' : '<circle cx="14" cy="15.5" r="1.8" fill="' + color + '"/>') + '</svg>';
  }
  function updateReportingPoints(L, map, overlayGroup, pane, openAipPoints) {
    var options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
    if (!map || !overlayGroup) return;
    if (!overlayGroup._gaVrpLayer) {
      overlayGroup._gaVrpLayer = L.layerGroup();
      overlayGroup._gaVrpLayer.on('remove', function (event) {
        var layer = event.target;
        if (layer._gaAttribution && map.attributionControl) map.attributionControl.removeAttribution(OFM_ATTRIBUTION);
        layer._gaAttribution = false;
      });
      overlayGroup.addLayer(overlayGroup._gaVrpLayer);
    }
    var layer = overlayGroup._gaVrpLayer;
    layer.clearLayers();
    var s = settings();
    var attribution = map.attributionControl;
    var showOfm = on => {
      if (!attribution) return;
      if (on && !layer._gaAttribution) {
        attribution.addAttribution(OFM_ATTRIBUTION);
        layer._gaAttribution = true;
      }
      if (!on && layer._gaAttribution) {
        attribution.removeAttribution(OFM_ATTRIBUTION);
        layer._gaAttribution = false;
      }
    };
    if (!s.vrpVisible || map.getZoom() < s.vrpMinZoom) {
      showOfm(false);
      return;
    }
    if (!ofmState.points) {
      loadOfmPoints(() => {
        if (!options.isActive || options.isActive()) updateReportingPoints(L, map, overlayGroup, pane, openAipPoints, options);
      }, options.ofmUrl);
      return;
    }
    var view = map.getBounds().pad(0.05);
    var ofm = ofmState.points.filter(p => view.contains([p.lat, p.lon]));
    var near = p => ofm.some(o => Math.abs(o.lat - p.lat) < 0.02 && Math.abs(o.lon - p.lon) < 0.03);
    var fallback = (Array.isArray(openAipPoints) ? openAipPoints : []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && view.contains([Number(p.lat), Number(p.lon)]) && !near(p)).map(p => ({
      id: '',
      name: String(p.name || ''),
      kind: 'request',
      airport: '',
      lat: Number(p.lat),
      lon: Number(p.lon),
      source: 'openaip'
    }));
    var scale = s.airportSize / 100;
    var zoom = map.getZoom();
    var size = Math.round((zoom >= 11 ? 24 : 20) * scale);
    var entries = ofm.map(p => _objectSpread(_objectSpread({}, p), {}, {
      source: 'ofm'
    })).concat(fallback).slice(0, 400);
    entries.forEach(point => {
      var short = point.id || point.name;
      var label = zoom >= 10 && short ? '<span class="ga-vrp-label" style="color:' + s.vrpColor + '">' + escapeText(short.length > 10 ? short.slice(0, 10) : short) + '</span>' : '';
      var marker = L.marker([point.lat, point.lon], {
        pane,
        keyboard: false,
        bubblingMouseEvents: false,
        icon: L.divIcon({
          className: 'ga-vrp-symbol',
          html: '<span class="ga-airport-symbol-glyph" style="width:' + size + 'px;height:' + size + 'px">' + vrpSvg(point.kind, s.vrpColor, point.source) + '</span>' + label,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      });
      var kind = point.source === 'ofm' ? phrase(KIND_LABEL[point.kind] || 'Meldepunkt') : phrase('Meldepunkt');
      var lines = ['<b>' + escapeText(point.name || point.id) + (point.id && point.name && point.id !== point.name ? ' (' + escapeText(point.id) + ')' : '') + '</b>', escapeText(kind) + (point.airport ? ' · ' + escapeText(point.airport) : '')];
      lines.push(point.source === 'ofm' ? phrase('Quelle') + ': open flightmaps · <a href="https://www.openflightmaps.org/contact/" target="_blank" rel="noopener noreferrer">' + phrase('Fehler melden') + '</a>' : phrase('Quelle') + ': OpenAIP');
      lines.push('<small>' + phrase('Nicht zur realen Navigation verwenden.') + '</small>');
      marker.bindPopup(lines.join('<br>'), {
        className: 'ga-vrp-popup'
      });
      marker.bindTooltip(escapeText(point.name || point.id) + (point.airport ? ' · ' + escapeText(point.airport) : ''), {
        direction: 'top',
        offset: [0, -size / 2],
        className: 'airspace-tooltip'
      });
      layer.addLayer(marker);
    });
    showOfm(ofm.length > 0);
  }

  // ---- Airfield symbols (simplified ICAO chart symbols) ----
  // OurAirports type names in the stored airport base (airports.json).
  var OURAIRPORTS_TYPES = {
    large_airport: 3,
    medium_airport: 2,
    small_airport: 2,
    heliport: 7,
    seaplane_base: 10,
    closed: 8
  };
  function airportKind(airport) {
    var _airport$type;
    var raw = airport && ((_airport$type = airport.type) !== null && _airport$type !== void 0 ? _airport$type : airport.openAipType);
    var type = typeof raw === 'string' && OURAIRPORTS_TYPES[raw] !== undefined ? OURAIRPORTS_TYPES[raw] : Number(raw);
    // OurAirports has no glider/UL/military kinds and some stored entries
    // carry no type: take the kind from the name there (symbol only).
    if (typeof raw === 'string' || raw === undefined || raw === null || raw === '') {
      var name = String(airport && airport.name || '');
      if (/glider|segelflug|gliding/i.test(name)) type = 1;else if (/ultra ?light|\bUL[- ]|ultraleicht|microlight/i.test(name)) type = 6;else if (/heli(port|pad)|hubschrauber|klinik|hospital/i.test(name)) type = 7;else if (/air base|air force|army|military|fliegerhorst|\bAB\b|\bAAF\b/i.test(name)) type = 5;else if (/seaplane|wasserflug/i.test(name)) type = 10;
    }
    if (type === 3 || type === 9) return 'intl';
    if (type === 1) return 'glider';
    if (type === 6) return 'ul';
    if (type === 4 || type === 7) return 'heli';
    if (type === 5) return 'military';
    if (type === 10) return 'water';
    if (type === 8) return 'closed';
    if (type === 11 || type === 12 || type === 13) return 'strip';
    return 'civil';
  }
  function runwayHeading(airport) {
    var _main$trueHeading;
    var runways = Array.isArray(airport && airport.runways) ? airport.runways.filter(Boolean) : [];
    var main = runways.find(r => r.mainRunway) || runways[0];
    if (!main) return null;
    var heading = Number((_main$trueHeading = main.trueHeading) !== null && _main$trueHeading !== void 0 ? _main$trueHeading : main.heading);
    if (Number.isFinite(heading)) return heading;
    var match = /^(\d{2})/.exec(String(main.designator || ''));
    return match ? Number(match[1]) * 10 : null;
  }
  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }
  function symbolSvg(kind, color, heading) {
    var ring = '<circle cx="14" cy="14" r="8" fill="#ffffff" fill-opacity="0.9" stroke="' + color + '" stroke-width="2.4"/>';
    var runway = length => heading === null ? '' : '<rect x="12.6" y="' + (14 - length) + '" width="2.8" height="' + length * 2 + '" rx="1" fill="' + color + '" transform="rotate(' + heading + ' 14 14)"/>';
    var text = t => '<text x="14" y="17.6" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="' + (t.length > 1 ? 8 : 10) + '" fill="' + color + '">' + t + '</text>';
    var inner = '';
    if (kind === 'intl') inner = runway(12.5);else if (kind === 'civil') inner = runway(10);else if (kind === 'glider') inner = '<path d="M7 15 Q14 10 21 15 M14 12.3 L14 18" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"/>';else if (kind === 'ul') inner = text('UL');else if (kind === 'heli') inner = text('H');else if (kind === 'military') inner = runway(10) + ['M14 2.5 L14 5.5', 'M14 22.5 L14 25.5', 'M2.5 14 L5.5 14', 'M22.5 14 L25.5 14'].map(d => '<path d="' + d + '" stroke="' + color + '" stroke-width="2.2"/>').join('');else if (kind === 'water') inner = '<path d="M8.5 15 q1.4 -2 2.8 0 t2.8 0 t2.8 0 t2.8 0" fill="none" stroke="' + color + '" stroke-width="1.8"/>';else if (kind === 'closed') inner = '<path d="M9.5 9.5 L18.5 18.5 M18.5 9.5 L9.5 18.5" stroke="' + color + '" stroke-width="2.2"/>';else if (kind === 'strip') return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true"><circle cx="14" cy="14" r="6.5" fill="#ffffff" fill-opacity="0.85" stroke="' + color + '" stroke-width="1.8" stroke-dasharray="2.5 2"/>' + runway(8) + '</svg>';
    return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true">' + ring + inner + '</svg>';
  }

  // Marker for one airfield; the caller keeps tooltip and click handling.
  function airportVisible(airport) {
    return settings().airportKinds[airportKind(airport)] !== false;
  }
  function airportMarker(L, latlng, airport, zoom, pane, className) {
    var s = settings();
    var scale = s.airportSize / 100;
    if (s.airportSymbols === 'dots') {
      return L.circleMarker(latlng, {
        pane,
        radius: (zoom >= 12 ? 7 : zoom >= 10 ? 6.2 : 5.5) * scale,
        color: s.airportColor === DEFAULTS.airportColor ? '#fde047' : s.airportColor,
        fillColor: '#07131d',
        fillOpacity: 0.96,
        weight: 2,
        className,
        interactive: true,
        bubblingMouseEvents: false
      });
    }
    var size = Math.round((zoom >= 12 ? 30 : zoom >= 10 ? 26 : 22) * scale);
    var icao = String(airport && (airport.icaoCode || airport.icao) || '').trim().toUpperCase();
    // Only real location indicators (EDTW), not internal OpenAIP ids (OA-...).
    var label = s.airportLabels && zoom >= 10 && /^[A-Z]{2}[A-Z0-9]{2}$/.test(icao) ? '<span class="ga-airport-symbol-label" style="color:' + s.airportColor + '">' + escapeText(icao) + '</span>' : '';
    var icon = L.divIcon({
      className: 'ga-airport-symbol ' + className,
      html: '<span class="ga-airport-symbol-glyph" style="width:' + size + 'px;height:' + size + 'px">' + symbolSvg(airportKind(airport), s.airportColor, runwayHeading(airport)) + '</span>' + label,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
    return L.marker(latlng, {
      pane,
      icon,
      interactive: true,
      bubblingMouseEvents: false,
      keyboard: false
    });
  }
  function phrase(text) {
    return root.GAI18n && typeof root.GAI18n.phrase === 'function' ? root.GAI18n.phrase(text) : text;
  }

  // Collapsible settings panel for the layer menu (title toggle handled by
  // map-basemap-catalog.js group logic, key "openaip-style").
  function createPanel(createTitle, onChange) {
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      _ref$stepControls = _ref.stepControls,
      stepControls = _ref$stepControls === void 0 ? false : _ref$stepControls;
    var wrap = document.createElement('div');
    wrap.className = 'ga-vfr-style ga-openaip-style';
    var toggle = createTitle('OpenAIP: Darstellung anpassen', 'openaip-style');
    toggle.classList.add('ga-vfr-style-toggle');
    var panel = document.createElement('div');
    panel.className = 'ga-vfr-style-panel';
    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    var controls = [];
    var changed = () => {
      var next = collect();
      save(next);
      refreshValues();
      onChange(next);
    };
    var heading = text => {
      var node = document.createElement('div');
      node.className = 'ga-vfr-style-heading';
      node.textContent = phrase(text);
      panel.appendChild(node);
    };
    var line = (label, inputs) => {
      var row = document.createElement('div');
      row.className = 'ga-vfr-style-row';
      var name = document.createElement('span');
      name.className = 'ga-vfr-style-name';
      name.textContent = phrase(label);
      row.appendChild(name);
      inputs.forEach(input => {
        row.appendChild(input._gaControl || input);
        if (input._gaControl) input._gaControl.setAttribute('aria-label', phrase(label));
      });
      panel.appendChild(row);
      return row;
    };
    var input = (type, attrs, read, write) => {
      var tag = type === 'color' && stepControls ? 'button' : type === 'select' ? 'select' : 'input';
      var node = document.createElement(tag);
      if (tag !== 'select') node.type = tag === 'button' ? 'button' : type;
      Object.keys(attrs || {}).forEach(key => {
        node[key] = attrs[key];
      });
      node.addEventListener(type === 'checkbox' || type === 'select' ? 'change' : 'input', changed);
      if (tag === 'button') {
        var palette = Array.from(new Set(AIRSPACE_CATEGORIES.map(category => category.color).concat(['#ffffff', '#263340'])));
        node.classList.add('ga-openaip-color-step');
        node.addEventListener('click', () => {
          node.value = palette[(palette.indexOf(node.value) + 1) % palette.length];
          changed();
        });
      }
      if (type === 'range' && stepControls) {
        var group = document.createElement('span');
        group.className = 'ga-openaip-range-steps';
        group.setAttribute('role', 'group');
        [-1, 1].forEach(direction => {
          var button = document.createElement('button');
          button.type = 'button';
          button.textContent = direction < 0 ? '−' : '+';
          button.addEventListener('click', () => {
            node.value = Math.max(Number(node.min), Math.min(Number(node.max), Number(node.value) + direction * Number(node.step)));
            changed();
          });
          group.appendChild(button);
        });
        node._gaControl = group;
      }
      controls.push({
        node,
        read,
        write
      });
      return node;
    };
    var valueLabel = () => {
      var span = document.createElement('span');
      span.className = 'ga-vfr-style-value';
      return span;
    };

    // Close in, the VFR overlay tiles show circuits and approach routes that
    // OpenAIP lacks: hide the OpenAIP drawing there and show those tiles.
    heading('Nahbereich');
    var handoff = input('checkbox', {}, s => s.vfrHandoff, (s, node) => {
      s.vfrHandoff = node.checked;
    });
    handoff.setAttribute('aria-label', phrase('Beim Reinzoomen auf VFR-Overlay umschalten'));
    line('Beim Reinzoomen auf VFR-Overlay umschalten', [handoff]).classList.add('ga-openaip-check-row');
    var handoffZoom = input('range', {
      min: '9',
      max: '14',
      step: '1'
    }, s => s.vfrHandoffZoom, (s, el) => {
      s.vfrHandoffZoom = Number(el.value);
    });
    handoffZoom.setAttribute('aria-label', phrase('Umschalten ab Zoomstufe'));
    var handoffZoomValue = valueLabel();
    handoffZoom._gaValue = handoffZoomValue;
    handoffZoom._gaUnit = '';
    line('Ab Zoomstufe', [handoffZoom, handoffZoomValue]);
    heading('Lufträume');
    AIRSPACE_CATEGORIES.forEach(category => {
      var visible = input('checkbox', {
        className: 'ga-openaip-visible'
      }, s => s.airspaces[category.id].visible, (s, node) => {
        s.airspaces[category.id].visible = node.checked;
      });
      visible.setAttribute('aria-label', phrase(category.label) + ' ' + phrase('anzeigen'));
      var color = input('color', {}, s => s.airspaces[category.id].color, (s, node) => {
        s.airspaces[category.id].color = node.value;
      });
      color.setAttribute('aria-label', phrase(category.label));
      var row = line(category.label, [color, visible]);
      row.classList.add('ga-openaip-airspace-row');
    });
    var slider = (label, key, min, max) => {
      var node = input('range', {
        min: String(min),
        max: String(max),
        step: '5'
      }, s => s[key], (s, el) => {
        s[key] = Number(el.value);
      });
      node.setAttribute('aria-label', phrase(label));
      var value = valueLabel();
      node._gaValue = value;
      line(label, [node, value]);
    };
    var select = (label, key, options) => {
      var node = input('select', {}, s => s[key], (s, el) => {
        s[key] = el.value;
      });
      options.forEach(_ref2 => {
        var _ref3 = _slicedToArray(_ref2, 2),
          value = _ref3[0],
          text = _ref3[1];
        var option = document.createElement('option');
        option.value = value;
        option.textContent = phrase(text);
        node.appendChild(option);
      });
      node.setAttribute('aria-label', phrase(label));
      line(label, [node]).classList.add('ga-openaip-select-row');
    };
    select('Randstil', 'borderStyle', [['band', 'Linie + Band innen'], ['line', 'Nur Linie']]);
    slider('Rand-Deckkraft', 'borderOpacity', 0, 100);
    slider('Linienstärke', 'lineWidth', 50, 500);
    var pxSlider = (label, key, min, max) => {
      var node = input('range', {
        min: String(min),
        max: String(max),
        step: '1'
      }, s => s[key], (s, el) => {
        s[key] = Number(el.value);
      });
      node.setAttribute('aria-label', phrase(label));
      var value = valueLabel();
      node._gaValue = value;
      node._gaUnit = ' px';
      line(label, [node, value]);
    };
    pxSlider('Bandbreite', 'bandWidth', 2, 40);
    slider('Band-Deckkraft', 'bandOpacity', 0, 100);
    slider('Füllung', 'fill', 0, 300);
    var airspaceLabels = input('checkbox', {}, s => s.labels, (s, node) => {
      s.labels = node.checked;
    });
    airspaceLabels.setAttribute('aria-label', phrase('Bezeichnung und Höhen'));
    line('Bezeichnung und Höhen', [airspaceLabels]).classList.add('ga-openaip-check-row');
    select('Beschriftung', 'labelPlacement', [['border', 'An der Grenzlinie'], ['center', 'In der Mitte']]);
    slider('Schriftgröße', 'labelSize', 60, 220);
    var zoomSlider = input('range', {
      min: '7',
      max: '14',
      step: '1'
    }, s => s.labelMinZoom, (s, el) => {
      s.labelMinZoom = Number(el.value);
    });
    zoomSlider.setAttribute('aria-label', phrase('Ab Zoomstufe'));
    var zoomValue = valueLabel();
    zoomSlider._gaValue = zoomValue;
    zoomSlider._gaUnit = '';
    line('Ab Zoomstufe', [zoomSlider, zoomValue]);
    heading('Meldepunkte');
    var vrpVisible = input('checkbox', {}, s => s.vrpVisible, (s, node) => {
      s.vrpVisible = node.checked;
    });
    vrpVisible.setAttribute('aria-label', phrase('Meldepunkte anzeigen'));
    var vrpColor = input('color', {}, s => s.vrpColor, (s, node) => {
      s.vrpColor = node.value;
    });
    vrpColor.setAttribute('aria-label', phrase('Farbe Meldepunkte'));
    line('Meldepunkte anzeigen', [vrpColor, vrpVisible]).classList.add('ga-openaip-airspace-row');
    var vrpZoom = input('range', {
      min: '7',
      max: '14',
      step: '1'
    }, s => s.vrpMinZoom, (s, el) => {
      s.vrpMinZoom = Number(el.value);
    });
    vrpZoom.setAttribute('aria-label', phrase('Meldepunkte ab Zoomstufe'));
    var vrpZoomValue = valueLabel();
    vrpZoom._gaValue = vrpZoomValue;
    vrpZoom._gaUnit = '';
    line('Ab Zoomstufe', [vrpZoom, vrpZoomValue]);
    heading('Flugplätze');
    var symbols = input('select', {}, s => s.airportSymbols, (s, node) => {
      s.airportSymbols = node.value;
    });
    [['icao', 'ICAO-Symbole'], ['dots', 'Punkte (bisher)']].forEach(_ref4 => {
      var _ref5 = _slicedToArray(_ref4, 2),
        value = _ref5[0],
        text = _ref5[1];
      var option = document.createElement('option');
      option.value = value;
      option.textContent = phrase(text);
      symbols.appendChild(option);
    });
    symbols.setAttribute('aria-label', phrase('Darstellung'));
    line('Darstellung', [symbols]).classList.add('ga-openaip-select-row');
    var airportColor = input('color', {}, s => s.airportColor, (s, node) => {
      s.airportColor = node.value;
    });
    airportColor.setAttribute('aria-label', phrase('Symbolfarbe'));
    line('Symbolfarbe', [airportColor]);
    slider('Symbolgröße', 'airportSize', 60, 300);
    var labels = input('checkbox', {}, s => s.airportLabels, (s, node) => {
      s.airportLabels = node.checked;
    });
    labels.setAttribute('aria-label', phrase('Kennung anzeigen'));
    line('Kennung anzeigen', [labels]).classList.add('ga-openaip-check-row');
    AIRPORT_KINDS.forEach(kind => {
      var visible = input('checkbox', {
        className: 'ga-openaip-visible'
      }, s => s.airportKinds[kind.id], (s, node) => {
        s.airportKinds[kind.id] = node.checked;
      });
      visible.setAttribute('aria-label', phrase(kind.label) + ' ' + phrase('anzeigen'));
      var row = line(kind.label, [visible]);
      row.classList.add('ga-openaip-check-row', 'ga-openaip-airport-kind-row');
      var glyph = document.createElement('span');
      glyph.className = 'ga-openaip-kind-glyph';
      glyph.innerHTML = symbolSvg(kind.id, '#1d4ed8', kind.id === 'heli' || kind.id === 'water' ? null : 45);
      row.insertBefore(glyph, row.firstChild);
    });
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'ga-vfr-style-reset';
    reset.textContent = phrase('Standard wiederherstellen');
    reset.addEventListener('click', () => {
      storageSet('{}');
      cache = null;
      load();
      onChange(settings());
    });
    panel.appendChild(reset);
    function collect() {
      var next = JSON.parse(JSON.stringify(settings()));
      controls.forEach(_ref6 => {
        var node = _ref6.node,
          write = _ref6.write;
        return write(next, node);
      });
      return next;
    }
    function refreshValues() {
      controls.forEach(_ref7 => {
        var node = _ref7.node;
        if (node._gaValue) node._gaValue.textContent = node.value + (node._gaUnit === undefined ? ' %' : node._gaUnit);
        if (stepControls && node.type === 'button') {
          node.style.backgroundColor = node.value;
          node.title = node.value;
        }
      });
    }
    function load() {
      var s = settings();
      controls.forEach(_ref8 => {
        var node = _ref8.node,
          read = _ref8.read;
        var value = read(s);
        if (node.type === 'checkbox') node.checked = !!value;else node.value = String(value);
      });
      refreshValues();
    }
    load();
    if (root.L && root.L.DomEvent) {
      root.L.DomEvent.disableClickPropagation(wrap);
      root.L.DomEvent.disableScrollPropagation(wrap);
    }
    return wrap;
  }
  root.gaOpenAipOverlayStyle = Object.freeze({
    AIRSPACE_CATEGORIES,
    RENDERED_TYPES,
    DEFAULTS,
    airspaceLayers,
    airspaceLabel,
    categoryFor,
    formatLimit,
    updateAirspaceLabels,
    updateReportingPoints,
    loadOfmPoints,
    settings,
    airspaceStyle,
    airportKind,
    airportVisible,
    AIRPORT_KINDS,
    airportMarker,
    runwayHeading,
    symbolSvg,
    createPanel
  });
})(typeof window !== 'undefined' ? window : globalThis);
