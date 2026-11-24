// Generated from map-weather-fields.js by sync-efb-web-assets.js. Do not edit.
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Weather marker geometry and the internal VFR classifier shared by Web and EFB.

var VP_VFR_REF_FINE_TRIM_FT_DE = {
  // Leichte sektorbezogene Referenz-Feinjustierung aus Drift-Beobachtungen.
  '00': -180,
  '01': -180,
  '02': -140,
  '03': -120,
  '04': -120,
  '05': -110,
  '06': -100,
  '07': -80,
  '09': -80,
  '11': -100,
  '12': -110,
  '14': 120,
  '33': 220,
  '35': 200,
  '37': 220,
  '38': 200,
  '41': 180,
  '44': 160
};
function vpComputeVfrIndexScoreFromParts() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var score = 100;
  var low = Number(parts.cloudLow || 0);
  var mid = Number(parts.cloudMid || 0);
  var cloud = Math.max(low, mid);
  var precip = Number(parts.precipitation || parts.rain || 0);
  var snow = Number(parts.snow || 0);
  var wind = Number(parts.wind || 0);
  var vis = Number(parts.visibility || 0);
  var wx = Number(parts.weatherCode);
  if (cloud > 90) score -= 42;else if (cloud > 75) score -= 32;else if (cloud > 60) score -= 20;else if (cloud > 45) score -= 10;
  if (precip > 2.5) score -= 34;else if (precip > 1.2) score -= 22;else if (precip > 0.5) score -= 12;else if (precip > 0.2) score -= 6;
  if (snow > 0.1) score -= 30;
  if (wind > 35) score -= 30;else if (wind > 25) score -= 20;else if (wind > 18) score -= 10;
  if (vis > 0 && vis < 3000) score -= 36;else if (vis > 0 && vis < 5000) score -= 24;else if (vis > 0 && vis < 8000) score -= 12;
  if (wx === 45 || wx === 48) score -= 22;
  if (wx === 95 || wx === 96 || wx === 99) score -= 30;
  if (wx === 65 || wx === 67 || wx === 75 || wx === 82 || wx === 86) score -= 16;
  return Math.max(0, Math.min(100, Math.round(score)));
}
function vpInternalMajorRank(code) {
  var c = String(code || '').toUpperCase();
  var rank = {
    C: 0,
    O: 1,
    D: 2,
    M: 3,
    X: 4
  };
  return Object.prototype.hasOwnProperty.call(rank, c) ? rank[c] : 2;
}
function vpInternalMajorFromScore(score) {
  var s = Number(score);
  if (!Number.isFinite(s)) return 'D';
  if (s >= 90) return 'C';
  if (s >= 74) return 'O';
  if (s >= 58) return 'D';
  if (s >= 38) return 'M';
  return 'X';
}
function vpInternalMajorFromVisKm(visKm) {
  var v = Number(visKm);
  if (!Number.isFinite(v)) return null;
  if (v < 1.5) return 'X';
  if (v < 5) return 'M';
  if (v < 8) return 'D';
  if (v < 10) return 'O';
  return 'C';
}
function vpInternalMajorFromCeilingFt(ceilingFt) {
  var c = Number(ceilingFt);
  if (!Number.isFinite(c)) return null;
  if (c < 500) return 'X';
  if (c < 1000) return 'M';
  if (c < 2000) return 'D';
  if (c < 5000) return 'O';
  return 'C';
}
function vpInternalMajorFromMetarFlightCat(fltCat) {
  var cat = String(fltCat || '').trim().toUpperCase();
  if (cat === 'LIFR') return 'X';
  if (cat === 'IFR') return 'M';
  if (cat === 'MVFR') return 'D';
  if (cat === 'VFR') return 'O';
  return null;
}
function vpWorstInternalMajor() {
  var majors = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var out = null;
  (Array.isArray(majors) ? majors : [majors]).forEach(m => {
    var code = String(m || '').toUpperCase();
    if (!['C', 'O', 'D', 'M', 'X'].includes(code)) return;
    if (!out || vpInternalMajorRank(code) > vpInternalMajorRank(out)) out = code;
  });
  return out;
}
function vpInternalMajorFromRank(rank) {
  var r = Math.max(0, Math.min(4, Number(rank) || 0));
  var codes = ['C', 'O', 'D', 'M', 'X'];
  return codes[r] || 'D';
}
function vpHasReliableMosmixN05() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var visKm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var precipMm = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  var wxCandidates = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var lowCoverPct = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
  var n05 = Number(parts.mosmixN05Pct);
  if (!Number.isFinite(n05)) return false;
  var stationDistKm = Number(parts.mosmixStationDistKm);
  var nearStation = !Number.isFinite(stationDistKm) || stationDistKm <= 32;
  if (n05 >= 82.5 && nearStation) return true;
  var wxSupportCodes = new Set([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99]);
  var wxSupport = Array.isArray(wxCandidates) && wxCandidates.some(c => wxSupportCodes.has(Number(c)));
  var support = Number.isFinite(visKm) && visKm <= 8 || Number.isFinite(precipMm) && precipMm >= 0.2 || wxSupport || Number.isFinite(lowCoverPct) && lowCoverPct >= 75;
  return n05 >= 62.5 && nearStation && support;
}
function vpEstimateCloudBaseFtFromTempDew() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var tempC = Number(parts.temp2mC);
  var dewC = Number(parts.dewPoint2mC);
  if (!Number.isFinite(tempC) || !Number.isFinite(dewC)) return null;
  // Nutzer-Formel: (T - Td) * 400 ft AGL (vereinfachte Annaeherung).
  var spreadC = Math.max(0, tempC - dewC);
  var windKtRaw = Number(parts.wind);
  var windKt = Number.isFinite(windKtRaw) ? Math.max(0, Math.min(30, windKtRaw)) : 0;
  var rh = Number(parts.rh2mPct);
  var ref = Number(parts.sectorRefFt);

  // Dynamische Abschwaechung: bei mehr Wind wird die rein statische
  // T/Td-Basis weniger streng (Mischung/Advektion), besonders im Flachland.
  var windBoostRaw = 1 + windKt / 30 * 0.85; // 1.00 .. 1.85
  var windBoost = windBoostRaw;
  if (Number.isFinite(rh)) {
    if (rh >= 97) windBoost -= 0.22;else if (rh >= 93) windBoost -= 0.12;else if (rh >= 88) windBoost -= 0.06;
  }
  if (Number.isFinite(ref) && ref <= 900) windBoost += 0.08;
  windBoost = Math.max(1.0, Math.min(1.9, windBoost));

  // Bei kleinem Spread greift die Wind-Abschwaechung staerker.
  var spreadWeight = spreadC <= 2.5 ? 1.0 : spreadC <= 4.0 ? 0.65 : 0.35;
  var effBoost = 1 + (windBoost - 1) * spreadWeight;
  return spreadC * 400 * effBoost;
}
function vpResolveCloudBaseFtAgl() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var cloudBaseMRaw = Number(parts.cloudBaseM);
  var cloudBaseFtAgl = Number.isFinite(cloudBaseMRaw) && cloudBaseMRaw > 0 ? cloudBaseMRaw * 3.28084 : null;
  if (Number.isFinite(cloudBaseFtAgl)) return {
    valueFt: cloudBaseFtAgl,
    source: 'openmeteo_cloud_base'
  };
  var tdDerived = vpEstimateCloudBaseFtFromTempDew(parts);
  if (Number.isFinite(tdDerived)) return {
    valueFt: tdDerived,
    source: 'temp_dew_spread'
  };
  return {
    valueFt: null,
    source: null
  };
}
function vpEstimateFogRiskMajor() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var visKm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var wxCandidates = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  if (wxCandidates.some(c => c === 45 || c === 48)) return {
    major: 'M',
    reason: 'Nebelcode'
  };
  var tempC = Number(parts.temp2mC);
  var dewC = Number(parts.dewPoint2mC);
  var spreadC = Number.isFinite(tempC) && Number.isFinite(dewC) ? Math.max(0, tempC - dewC) : null;
  var rh = Number(parts.rh2mPct);
  var windKt = Number(parts.wind);
  var pressure = Number(parts.mslPressureHpa);
  if (!Number.isFinite(spreadC) && !Number.isFinite(rh)) return {
    major: null,
    reason: ''
  };
  if (Number.isFinite(visKm) && visKm > 6) return {
    major: null,
    reason: ''
  };
  // Kein Nebel-Proxy ohne echte Feuchte-Indizien.
  if (!(Number.isFinite(spreadC) && spreadC <= 2.5) && !(Number.isFinite(rh) && rh >= 90)) return {
    major: null,
    reason: ''
  };
  var score = 0;
  if (Number.isFinite(spreadC)) {
    if (spreadC <= 0.8) score += 3;else if (spreadC <= 1.5) score += 2;else if (spreadC <= 2.5) score += 1;
  }
  if (Number.isFinite(rh)) {
    if (rh >= 97) score += 2;else if (rh >= 93) score += 1;
  }
  if (Number.isFinite(windKt)) {
    if (windKt <= 4) score += 2;else if (windKt <= 8) score += 1;
  }
  if (Number.isFinite(pressure) && pressure >= 1020) score += 1;
  if (Number.isFinite(visKm)) {
    if (visKm <= 3) score += 2;else if (visKm <= 6) score += 1;
  }
  if (score >= 8 && Number.isFinite(visKm) && visKm <= 1.5) return {
    major: 'M',
    reason: 'Nebelrisiko hoch'
  };
  if (score >= 7 && Number.isFinite(visKm) && visKm <= 4) return {
    major: 'D',
    reason: 'Nebelrisiko'
  };
  return {
    major: null,
    reason: ''
  };
}
function vpMapVfrCategory(score) {
  var major = vpInternalMajorFromScore(score);
  var labels = {
    C: {
      key: 'vfr_c',
      label: 'VFR-Index C (intern)',
      color: '#6aaeff',
      letter: 'C',
      code: 'C'
    },
    O: {
      key: 'vfr_o',
      label: 'VFR-Index O (intern)',
      color: '#8ecb4b',
      letter: 'O',
      code: 'O'
    },
    D: {
      key: 'vfr_d',
      label: 'VFR-Index D (intern)',
      color: '#e0c93b',
      letter: 'D',
      code: 'D'
    },
    M: {
      key: 'vfr_m',
      label: 'VFR-Index M (intern)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M'
    },
    X: {
      key: 'vfr_x',
      label: 'VFR-Index X (intern)',
      color: '#d14a4a',
      letter: 'X',
      code: 'X'
    }
  };
  var cat = labels[major] || labels.D;
  return _objectSpread(_objectSpread({}, cat), {}, {
    displayCode: cat.code
  });
}
function vpClassifyInternalVfr() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var score = vpComputeVfrIndexScoreFromParts(parts);
  var scoreMajor = vpInternalMajorFromScore(score);
  var mosmixVisibilityM = Number(parts.mosmixVisibilityM);
  var visMRaw = Number.isFinite(mosmixVisibilityM) && mosmixVisibilityM > 0 ? mosmixVisibilityM : Number(parts.visibility);
  var visKm = Number.isFinite(visMRaw) && visMRaw > 0 ? visMRaw / 1000 : null;
  var cloudBaseResolved = vpResolveCloudBaseFtAgl(parts);
  var cloudBaseFtAgl = Number(cloudBaseResolved.valueFt);
  var cloudBaseSource = cloudBaseResolved.source;
  var sectorRefFtRaw = Number(parts.sectorRefFt);
  var sectorRefFt = vpAdjustedSectorRefFt(parts);
  var terrainPointFt = Number(parts.terrainPointFt);
  var cloudLow = Number(parts.cloudLow || 0);
  var cloudMid = Number(parts.cloudMid || 0);
  var cloudTotal = Number(parts.cloudTotal || 0);
  var mosmixN05Pct = Number(parts.mosmixN05Pct);
  var mosmixLowCloudPct = Number(parts.mosmixLowCloudPct);
  var coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
  var lowCoverForCeiling = Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : cloudLow;
  var wxForN05 = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  var precipForN05 = Math.max(0, Number(parts.precipitation || parts.rain || 0), Number(parts.mosmixPrecipitationMm || 0));
  var mosmixHasBknBelow500 = vpHasReliableMosmixN05(parts, visKm, precipForN05, wxForN05, lowCoverForCeiling);
  var fogRisk = vpEstimateFogRiskMajor(parts, visKm);
  var hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;
  var hasDenseLowWithoutBase = Number.isFinite(lowCoverForCeiling) && lowCoverForCeiling >= 75 && !Number.isFinite(cloudBaseFtAgl) && !mosmixHasBknBelow500;
  var cloudAboveRefFt = cloudBaseFtAgl;
  if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
    cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
  }
  var visMajor = vpInternalMajorFromVisKm(visKm);
  var cloudMajor = mosmixHasBknBelow500 ? 'X' : hasCeilingCondition ? vpInternalMajorFromCeilingFt(cloudAboveRefFt) : null;
  var wxMajor = null;
  var wx = Number(parts.weatherCode);
  var precip = Number(parts.precipitation || parts.rain || 0);
  var snow = Number(parts.snow || 0);
  var wind = Number(parts.wind || 0);
  if (wx === 95 || wx === 96 || wx === 99) wxMajor = vpWorstInternalMajor([wxMajor, 'X']);
  if (wx === 45 || wx === 48) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
  if ([65, 67, 75, 82, 86].includes(wx)) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
  if (precip > 2.5 || snow > 0.2) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);else if (precip > 1.2 || snow > 0.05) wxMajor = vpWorstInternalMajor([wxMajor, 'D']);
  if (wind > 35) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);else if (wind > 25) wxMajor = vpWorstInternalMajor([wxMajor, 'D']);
  if (fogRisk && fogRisk.major) wxMajor = vpWorstInternalMajor([wxMajor, fogRisk.major]);
  var metarFlightCat = String(parts.metarFlightCat || '').trim().toUpperCase();
  var metarByCat = vpInternalMajorFromMetarFlightCat(metarFlightCat);
  var metarVisibilityM = Number(parts.metarVisibilityM);
  var metarByVis = Number.isFinite(metarVisibilityM) && metarVisibilityM > 0 ? vpInternalMajorFromVisKm(metarVisibilityM / 1000) : null;
  var metarByCeiling = vpInternalMajorFromCeilingFt(parts.metarCeilingFtAgl);
  var metarMajor = vpWorstInternalMajor([metarByCat, metarByVis, metarByCeiling]);
  var baseMajor = vpWorstInternalMajor([visMajor, cloudMajor, wxMajor, scoreMajor]) || scoreMajor || 'D';
  var major = baseMajor;
  // METAR nur als konservative Korrektur, aber maximal eine Klasse strenger,
  // damit ein entfernter/zeitversetzter Report das Modell nicht komplett ueberfaehrt.
  if (metarMajor) {
    var baseRank = vpInternalMajorRank(baseMajor);
    var metarRank = vpInternalMajorRank(metarMajor);
    var boundedRank = Math.min(metarRank, Math.min(4, baseRank + 1));
    major = vpWorstInternalMajor([baseMajor, vpInternalMajorFromRank(boundedRank)]) || baseMajor;
  }
  if (hasDenseLowWithoutBase) major = vpWorstInternalMajor([major, 'D']) || 'D';
  var baseCat = vpMapVfrCategory(score);
  var cat = _objectSpread(_objectSpread({}, baseCat), {}, {
    code: major,
    letter: major,
    displayCode: major
  });
  var labels = {
    C: 'VFR-Index C (intern)',
    O: 'VFR-Index O (intern)',
    D: 'VFR-Index D (intern)',
    M: 'VFR-Index M (intern)',
    X: 'VFR-Index X (intern)'
  };
  cat.label = labels[major] || labels.D;
  cat.key = `vfr_${String(major || 'd').toLowerCase()}`;
  cat.color = vpMapVfrCategory(major === 'C' ? 95 : major === 'O' ? 80 : major === 'D' ? 62 : major === 'M' ? 45 : 20).color || cat.color;
  var dataQuality = 'valid';
  if (!Number.isFinite(visKm) && !Number.isFinite(cloudAboveRefFt) && !mosmixHasBknBelow500 && !metarMajor) {
    dataQuality = hasDenseLowWithoutBase || wxMajor ? 'estimated' : 'fallback';
  } else if (hasDenseLowWithoutBase) {
    dataQuality = 'estimated';
  }
  return _objectSpread(_objectSpread({}, cat), {}, {
    score: Math.round(score),
    mode: 'internal',
    dataQuality,
    dataWarning: hasDenseLowWithoutBase ? 'Wolkenbasis fehlt trotz dichter Low-Bewoelkung; Einstufung konservativ abgesichert.' : cloudBaseSource === 'temp_dew_spread' ? 'Wolkenbasis aus Temperatur/Taupunkt geschaetzt.' : fogRisk && fogRisk.reason ? fogRisk.reason : '',
    visKm: Number.isFinite(visKm) ? visKm : null,
    cloudBaseFtAgl: Number.isFinite(cloudBaseFtAgl) ? cloudBaseFtAgl : null,
    cloudAboveRefFt: Number.isFinite(cloudAboveRefFt) ? cloudAboveRefFt : null,
    cloudBaseSource: cloudBaseSource || null,
    sectorRefFtRaw: Number.isFinite(sectorRefFtRaw) ? sectorRefFtRaw : null,
    sectorRefTrimFt: vpRefFineTrimFt(parts),
    metarFlightCat: metarFlightCat || null,
    metarStation: parts.metarStation ? String(parts.metarStation) : null,
    metarDistKm: Number.isFinite(Number(parts.metarDistKm)) ? Number(parts.metarDistKm) : null
  });
}
function vpRefFineTrimFt() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var country = String(parts && parts.countryCode || window.vpVfrIndexState && window.vpVfrIndexState.country || '').toUpperCase();
  if (country !== 'DE') return 0;
  var sidRaw = String(parts && parts.sectorId || '').trim();
  var sid = sidRaw ? sidRaw.padStart(2, '0') : '';
  var trim = Number(VP_VFR_REF_FINE_TRIM_FT_DE[sid] || 0);

  // Dynamischer Mikro-Trim: nur kleine Korrektur fuer feuchte Flachland-/trockene Hochlagen.
  var ref = Number(parts && parts.sectorRefFt);
  var tempC = Number(parts && parts.temp2mC);
  var dewC = Number(parts && parts.dewPoint2mC);
  var rh = Number(parts && parts.rh2mPct);
  var spread = Number.isFinite(tempC) && Number.isFinite(dewC) ? Math.max(0, tempC - dewC) : null;
  if (Number.isFinite(ref) && ref <= 1200 && Number.isFinite(rh) && Number.isFinite(spread) && rh >= 93 && spread <= 1.5) {
    trim += 80;
  }
  if (Number.isFinite(ref) && ref >= 2200 && Number.isFinite(rh) && Number.isFinite(spread) && rh <= 55 && spread >= 4.0) {
    trim -= 80;
  }
  return Math.max(-300, Math.min(300, trim));
}
function vpAdjustedSectorRefFt() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var ref = Number(parts && parts.sectorRefFt);
  if (!Number.isFinite(ref)) return ref;
  return ref + vpRefFineTrimFt(parts);
}
function vpClassifyGaforLike() {
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var mosmixVisibilityM = Number(parts.mosmixVisibilityM);
  var visMRaw = Number.isFinite(mosmixVisibilityM) && mosmixVisibilityM > 0 ? mosmixVisibilityM : Number(parts.visibility);
  var visKm = Number.isFinite(visMRaw) && visMRaw > 0 ? visMRaw / 1000 : null;
  var cloudBaseResolved = vpResolveCloudBaseFtAgl(parts);
  var cloudBaseFtAgl = Number(cloudBaseResolved.valueFt);
  var cloudBaseSource = cloudBaseResolved.source;
  var sectorRefFtRaw = Number(parts.sectorRefFt);
  var sectorRefFt = vpAdjustedSectorRefFt(parts);
  var terrainPointFt = Number(parts.terrainPointFt);
  var cloudLow = Number(parts.cloudLow || 0);
  var cloudMid = Number(parts.cloudMid || 0);
  var cloudTotal = Number(parts.cloudTotal || 0);
  var mosmixN05Pct = Number(parts.mosmixN05Pct);
  var mosmixLowCloudPct = Number(parts.mosmixLowCloudPct);
  var coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
  var lowCoverForCeiling = Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : cloudLow;
  var wxForN05 = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  var precipForN05 = Math.max(0, Number(parts.precipitation || parts.rain || 0), Number(parts.mosmixPrecipitationMm || 0));
  var mosmixHasBknBelow500 = vpHasReliableMosmixN05(parts, visKm, precipForN05, wxForN05, lowCoverForCeiling);
  var fogRisk = vpEstimateFogRiskMajor(parts, visKm);
  // Ceiling erst ab BKN/OVC (>=5/8) bewerten.
  var hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;
  // Open-Meteo liefert cloud_base oft leer. Ein sichtbares '?' nur setzen,
  // wenn wirklich die tiefe Wolkenschicht dicht genug ist; Mid-Cloud allein
  // ist fuer Ceiling-Bewertung als Unsicherheitsausloeser zu breit.
  var hasDenseLowWithoutBase = Number.isFinite(lowCoverForCeiling) && lowCoverForCeiling >= 75 && !Number.isFinite(cloudBaseFtAgl) && !mosmixHasBknBelow500;
  var cloudAboveRefFt = cloudBaseFtAgl;
  if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
    cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
  }
  var labels = {
    UNKNOWN: {
      key: 'gafor_unknown',
      label: 'VFR-Index unklar',
      color: '#9aa3ad',
      letter: '?',
      code: '?'
    },
    C: {
      key: 'gafor_c',
      label: 'VFR-Index C (frei)',
      color: '#6aaeff',
      letter: 'C',
      code: 'C'
    },
    O: {
      key: 'gafor_o',
      label: 'VFR-Index O (offen)',
      color: '#8ecb4b',
      letter: 'O',
      code: 'O'
    },
    D1: {
      key: 'gafor_d',
      label: 'VFR-Index D1 (schwierig)',
      color: '#e0c93b',
      letter: 'D',
      code: 'D1'
    },
    D3: {
      key: 'gafor_d',
      label: 'VFR-Index D3 (schwierig)',
      color: '#e0c93b',
      letter: 'D',
      code: 'D3'
    },
    D4: {
      key: 'gafor_d',
      label: 'VFR-Index D4 (schwierig)',
      color: '#e0c93b',
      letter: 'D',
      code: 'D4'
    },
    M2: {
      key: 'gafor_m',
      label: 'VFR-Index M2 (kritisch)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M2'
    },
    M5: {
      key: 'gafor_m',
      label: 'VFR-Index M5 (kritisch)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M5'
    },
    M6: {
      key: 'gafor_m',
      label: 'VFR-Index M6 (kritisch)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M6'
    },
    M7: {
      key: 'gafor_m',
      label: 'VFR-Index M7 (kritisch)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M7'
    },
    M8: {
      key: 'gafor_m',
      label: 'VFR-Index M8 (kritisch)',
      color: '#e08a3b',
      letter: 'M',
      code: 'M8'
    },
    X: {
      key: 'gafor_x',
      label: 'VFR-Index X (geschlossen)',
      color: '#d14a4a',
      letter: 'X',
      code: 'X'
    }
  };
  var majorRank = {
    C: 0,
    O: 1,
    D: 2,
    M: 3,
    X: 4
  };
  var visKnown = Number.isFinite(visKm);
  var cloudKnown = mosmixHasBknBelow500 || hasCeilingCondition && Number.isFinite(cloudAboveRefFt);
  if (!visKnown && !cloudKnown) {
    var neutral = labels.UNKNOWN;
    return _objectSpread(_objectSpread({}, neutral), {}, {
      score: null,
      mode: 'gafor_like',
      dataQuality: 'unknown',
      ceilingQuality: hasDenseLowWithoutBase ? 'unknown_dense_low_cloud' : 'unknown',
      displayCode: '?',
      dataWarning: hasDenseLowWithoutBase ? 'Sicht und Wolkenbasis fehlen; dichte Low-Bewoelkung erkannt.' : 'Sicht und Wolkenbasis fehlen.',
      visKm,
      cloudBaseFtAgl,
      cloudAboveRefFt,
      cloudBaseSource: cloudBaseSource || null,
      sectorRefFt: Number.isFinite(sectorRefFt) ? sectorRefFt : null,
      sectorRefFtRaw: Number.isFinite(sectorRefFtRaw) ? sectorRefFtRaw : null,
      sectorRefTrimFt: vpRefFineTrimFt(parts),
      terrainPointFt: Number.isFinite(terrainPointFt) ? terrainPointFt : null,
      coverForCeiling,
      lowCoverForCeiling,
      mosmixN05Pct: Number.isFinite(mosmixN05Pct) ? mosmixN05Pct : null,
      mosmixLowCloudPct: Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : null,
      visSource: Number.isFinite(mosmixVisibilityM) ? 'mosmix' : 'openmeteo',
      cloudSource: null,
      hasCeilingCondition,
      visClass: null,
      cloudClass: null
    });
  }
  var visBand = !visKnown ? null : visKm < 1.5 ? 'x' : visKm < 5 ? 'v15_5' : visKm < 8 ? 'v5_8' : visKm < 10 ? 'v8_10' : 'v10_plus';
  var cloudBand = !cloudKnown ? null : mosmixHasBknBelow500 ? 'c_below_500' : cloudAboveRefFt < 500 ? 'c_below_500' : cloudAboveRefFt < 1000 ? 'c500_1000' : cloudAboveRefFt < 2000 ? 'c1000_2000' : cloudAboveRefFt >= 5000 ? 'c5000_plus' : 'c2000_5000';
  var fullMatrix = {
    v15_5: {
      c_below_500: 'X',
      c500_1000: 'M8',
      c1000_2000: 'M7',
      c2000_5000: 'M6',
      c5000_plus: 'M6'
    },
    v5_8: {
      c_below_500: 'X',
      c500_1000: 'M5',
      c1000_2000: 'D4',
      c2000_5000: 'D3',
      c5000_plus: 'D3'
    },
    v8_10: {
      c_below_500: 'X',
      c500_1000: 'M2',
      c1000_2000: 'D1',
      c2000_5000: 'O',
      c5000_plus: 'O'
    },
    v10_plus: {
      c_below_500: 'X',
      c500_1000: 'M2',
      c1000_2000: 'D1',
      c2000_5000: 'O',
      c5000_plus: 'C'
    }
  };
  var code = null;
  if (visBand === 'x' || cloudBand === 'c_below_500') {
    code = 'X';
  } else if (visBand && cloudBand && fullMatrix[visBand] && fullMatrix[visBand][cloudBand]) {
    code = fullMatrix[visBand][cloudBand];
  } else if (visBand && !cloudBand) {
    if (visBand === 'v10_plus') code = 'C';else if (visBand === 'v8_10') code = 'O';else if (visBand === 'v5_8') code = 'D3';else if (visBand === 'v15_5') code = 'M6';
  } else if (!visBand && cloudBand) {
    if (cloudBand === 'c5000_plus') code = 'C';else if (cloudBand === 'c2000_5000') code = 'O';else if (cloudBand === 'c1000_2000') code = 'D1';else if (cloudBand === 'c500_1000') code = 'M2';else code = 'X';
  }
  if (!code || !labels[code]) code = 'D4';
  if (fogRisk && fogRisk.major) {
    var curMajor = vpMajorFromGaforCode(code);
    if (vpMajorSeverity(fogRisk.major) > vpMajorSeverity(curMajor)) {
      code = vpRepresentativeCodeFromMajor(fogRisk.major);
    }
  }
  var cat = labels[code];
  var major = String(cat.letter || 'D');
  var dataQuality = hasDenseLowWithoutBase ? 'estimated' : 'valid';
  var displayCode = dataQuality === 'valid' ? cat.code : String(cat.code || cat.letter || '?').length > 1 ? `${String(cat.letter || cat.code || '?').slice(0, 1)}?` : `${String(cat.code || cat.letter || '?').slice(0, 1)}?`;
  var dataWarning = hasDenseLowWithoutBase ? 'Wolkenbasis fehlt trotz dichter Low-Bewoelkung; Klasse nur aus Sicht/Restdaten abgeleitet.' : cloudBaseSource === 'temp_dew_spread' ? 'Wolkenbasis aus Temperatur/Taupunkt geschaetzt.' : fogRisk && fogRisk.reason ? fogRisk.reason : '';
  var cloudSource = mosmixHasBknBelow500 ? 'mosmix_n05' : Number.isFinite(cloudAboveRefFt) ? cloudBaseSource || 'openmeteo_cloud_base' : null;
  return _objectSpread(_objectSpread({}, cat), {}, {
    label: dataQuality === 'valid' ? cat.label : `${cat.label} (unsicher)`,
    score: Math.max(0, 100 - (majorRank[major] || 2) * 25),
    mode: 'gafor_like',
    dataQuality,
    ceilingQuality: mosmixHasBknBelow500 ? 'mosmix_n05' : cloudKnown ? 'valid' : hasDenseLowWithoutBase ? 'unknown_dense_low_cloud' : 'not_relevant',
    displayCode,
    dataWarning,
    visKm,
    cloudBaseFtAgl,
    cloudAboveRefFt,
    cloudBaseSource: cloudBaseSource || null,
    sectorRefFt: Number.isFinite(sectorRefFt) ? sectorRefFt : null,
    sectorRefFtRaw: Number.isFinite(sectorRefFtRaw) ? sectorRefFtRaw : null,
    sectorRefTrimFt: vpRefFineTrimFt(parts),
    terrainPointFt: Number.isFinite(terrainPointFt) ? terrainPointFt : null,
    coverForCeiling,
    lowCoverForCeiling,
    mosmixN05Pct: Number.isFinite(mosmixN05Pct) ? mosmixN05Pct : null,
    mosmixLowCloudPct: Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : null,
    visSource: Number.isFinite(mosmixVisibilityM) ? 'mosmix' : 'openmeteo',
    cloudSource,
    hasCeilingCondition,
    visClass: visBand,
    cloudClass: cloudBand
  });
}
function vpMajorFromGaforCode(code) {
  var c = String(code || '').toUpperCase();
  if (c === 'C' || c === 'O' || c === 'X') return c;
  if (c.startsWith('D')) return 'D';
  if (c.startsWith('M')) return 'M';
  return '?';
}
function vpRepresentativeCodeFromMajor(major) {
  var m = String(major || '').toUpperCase();
  if (m === 'C') return 'C';
  if (m === 'O') return 'O';
  if (m === 'D') return 'D3';
  if (m === 'M') return 'M5';
  if (m === 'X') return 'X';
  return '?';
}
function vpMajorSeverity(major) {
  var m = String(major || '').toUpperCase();
  var map = {
    C: 0,
    O: 1,
    D: 2,
    M: 3,
    X: 4
  };
  return Object.prototype.hasOwnProperty.call(map, m) ? map[m] : 2;
}
function vpSampleToParts() {
  var sample = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return {
    cloudLow: sample.cloudLowPct,
    cloudMid: sample.cloudMidPct,
    cloudTotal: sample.cloudTotalPct,
    precipitation: sample.precipitationMm,
    rain: sample.rainMm,
    snow: sample.snowfallCm,
    wind: sample.wspd,
    visibility: sample.visibilityM,
    weatherCode: sample.weatherCode,
    temp2mC: sample.temp2mC,
    dewPoint2mC: sample.dewPoint2mC,
    rh2mPct: sample.rh2mPct,
    mslPressureHpa: sample.mslPressureHpa,
    sectorId: sample.sectorId,
    countryCode: sample.countryCode,
    cloudBaseM: sample.cloudBaseM,
    mosmixVisibilityM: sample.mosmixVisibilityM,
    mosmixN05Pct: sample.mosmixN05Pct,
    mosmixLowCloudPct: sample.mosmixLowCloudPct,
    mosmixPrecipitationMm: sample.mosmixPrecipitationMm,
    mosmixWeatherCode: sample.mosmixWeatherCode,
    mosmixStation: sample.mosmixStation,
    mosmixStationDistKm: sample.mosmixStationDistKm,
    metarFlightCat: sample.metarFlightCat,
    metarVisibilityM: sample.metarVisibilityM,
    metarCeilingFtAgl: sample.metarCeilingFtAgl,
    metarStation: sample.metarStation,
    metarDistKm: sample.metarDistKm,
    sectorRefFt: sample.sectorRefFt,
    terrainPointFt: sample.terrainPointFt
  };
}
var wxCloudFieldSvgSeq = 0;
var WX_WEATHER_DOMAIN_ROUTE_NM = 50;
var WX_WEATHER_DOMAIN_GPS_NM = 50;
var WX_GRID_SPACING_SCALE = 1.5;
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * clamp01(t));
}
function windBarbStyleFromSpeed(speedKt) {
  var t = clamp01(speedKt / 42);
  var r = mixChannel(168, 26, t);
  var g = mixChannel(214, 120, t);
  var b = mixChannel(255, 255, t);
  var alpha = 0.86 + 0.14 * t;
  var shadow = 0.62 + 0.28 * t;
  var strokeWidth = 2.2 + 1.2 * t;
  return {
    stroke: `rgba(${r},${g},${b},${alpha.toFixed(3)})`,
    fill: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.12).toFixed(3)})`,
    core: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.2).toFixed(3)})`,
    shadow: shadow.toFixed(3),
    strokeWidth: strokeWidth.toFixed(2)
  };
}
function buildWindBarbIcon(directionDeg, speedKt) {
  var dirFrom = Number.isFinite(directionDeg) ? directionDeg : 0;
  // Open-Meteo liefert "coming from"; auf der Karte zeigen wir die Bewegungsrichtung (to).
  var renderDir = (dirFrom + 180) % 360;
  var speed = Math.max(0, Number.isFinite(speedKt) ? speedKt : 0);
  var style = windBarbStyleFromSpeed(speed);
  var rem = Math.round(speed / 5) * 5;
  var y = 20.4;
  var feathers = '';
  while (rem >= 50) {
    feathers += `<path d="M12 ${y} L19 ${y + 2.7} L12 ${y + 5.4} Z" fill="${style.fill}"/>`;
    y -= 5.4;
    rem -= 50;
  }
  while (rem >= 10) {
    feathers += `<line x1="12" y1="${y}" x2="19" y2="${y + 3.4}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>`;
    y -= 3.5;
    rem -= 10;
  }
  if (rem >= 5) {
    feathers += `<line x1="12" y1="${y}" x2="16.6" y2="${y + 2.1}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>`;
  }
  var svg = `
        <svg width="36" height="36" viewBox="0 0 24 24" style="overflow:visible;">
            <g transform="rotate(${renderDir} 12 12)">
                <circle cx="12" cy="12" r="1.8" fill="${style.core}"/>
                <line x1="12" y1="21.2" x2="12" y2="2.2" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>
                ${feathers}
            </g>
        </svg>`;
  return L.divIcon({
    className: 'wx-windbarb-icon',
    html: `<div style="filter: drop-shadow(0 1px 3px rgba(0,0,0,${style.shadow}));">${svg}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}
function cloudBandFillLevel(pct) {
  var v = Math.max(0, Math.min(100, Number(pct) || 0));
  if (v < 34) return 0; // leer
  if (v < 67) return 1; // halb
  return 2; // voll
}
function cloudBandOpacity(level) {
  if (level <= 0) return 0;
  if (level === 1) return 0.42;
  return 0.86;
}
function createCloudFieldMarker(lat, lon, lowPct, midPct, highPct, sizePx) {
  var highLevel = cloudBandFillLevel(highPct);
  var midLevel = cloudBandFillLevel(midPct);
  var lowLevel = cloudBandFillLevel(lowPct);
  var anyFill = highLevel + midLevel + lowLevel > 0;
  if (!anyFill) return null;
  var topA = cloudBandOpacity(highLevel).toFixed(3);
  var midA = cloudBandOpacity(midLevel).toFixed(3);
  var lowA = cloudBandOpacity(lowLevel).toFixed(3);
  var id = `wx-cloud-clip-${++wxCloudFieldSvgSeq}`;
  var size = Math.max(40, Math.min(72, Math.round(sizePx)));
  var svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="overflow:visible;">
            <defs>
                <clipPath id="${id}">
                    <circle cx="50" cy="50" r="46"></circle>
                </clipPath>
            </defs>
            <circle cx="50" cy="50" r="46" fill="rgba(128,128,128,0.10)" stroke="rgba(214,214,214,0.72)" stroke-width="2.8"></circle>
            <g clip-path="url(#${id})">
                <rect x="4" y="4" width="92" height="30.67" fill="rgba(170,170,170,${topA})"></rect>
                <rect x="4" y="34.67" width="92" height="30.66" fill="rgba(160,160,160,${midA})"></rect>
                <rect x="4" y="65.33" width="92" height="30.67" fill="rgba(150,150,150,${lowA})"></rect>
                <line x1="6" y1="34.67" x2="94" y2="34.67" stroke="rgba(230,230,230,0.62)" stroke-width="1"></line>
                <line x1="6" y1="65.33" x2="94" y2="65.33" stroke="rgba(230,230,230,0.62)" stroke-width="1"></line>
            </g>
        </svg>`;
  var icon = L.divIcon({
    className: 'wx-cloudfield-icon',
    html: `<div style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.58));">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)]
  });
  return L.marker([lat, lon], {
    icon,
    interactive: false,
    keyboard: false,
    opacity: 0.98
  });
}
function pickWeatherGridStep(spanDeg, targetLines) {
  var raw = Math.max(0.02, spanDeg / Math.max(2, targetLines - 1));
  var steps = [0.02, 0.03, 0.05, 0.075, 0.1, 0.125, 0.2, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
  for (var _i = 0, _steps = steps; _i < _steps.length; _i++) {
    var s = _steps[_i];
    if (raw <= s) return s;
  }
  return Math.ceil(raw / 5) * 5;
}
function normalizeLon180(lon) {
  var x = lon;
  while (x > 180) x -= 360;
  while (x <= -180) x += 360;
  return x;
}
function nmToLatDeg(nm) {
  return Number(nm || 0) / 60;
}
function nmToLonDegAtLat(nm, latDeg) {
  var cosLat = Math.max(0.2, Math.abs(Math.cos(Number(latDeg || 0) * Math.PI / 180)));
  return Number(nm || 0) / (60 * cosLat);
}
function buildRouteWeatherBounds() {
  if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
  var minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  var _iterator = _createForOfIteratorHelper(routeWaypoints),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _wp$lng;
      var wp = _step.value;
      var lat = Number(wp && wp.lat);
      var lon = Number(wp && ((_wp$lng = wp.lng) !== null && _wp$lng !== void 0 ? _wp$lng : wp.lon));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  var midLat = (minLat + maxLat) * 0.5;
  var padLatDeg = nmToLatDeg(WX_WEATHER_DOMAIN_ROUTE_NM);
  var padLonDeg = nmToLonDegAtLat(WX_WEATHER_DOMAIN_ROUTE_NM, midLat);
  return {
    minLat: Math.max(-89.5, minLat - padLatDeg),
    maxLat: Math.min(89.5, maxLat + padLatDeg),
    minLon: normalizeLon180(minLon - padLonDeg),
    maxLon: normalizeLon180(maxLon + padLonDeg),
    wrapsDateline: minLon - padLonDeg < -180 || maxLon + padLonDeg > 180
  };
}
function pointInsideBounds(lat, lon, b) {
  if (!b) return false;
  var latOk = lat >= b.minLat && lat <= b.maxLat;
  if (!latOk) return false;
  if (!b.wrapsDateline) return lon >= b.minLon && lon <= b.maxLon;
  return lon >= b.minLon || lon <= b.maxLon;
}
function filterWeatherPointsByActiveDomain(points) {
  if (!Array.isArray(points) || points.length === 0) return points;
  var routeBounds = buildRouteWeatherBounds();
  var gps = window.lastLiveGpsPos;
  var hasRecentGps = !!(gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon) && Number.isFinite(gps.t) && Date.now() - gps.t < 15 * 60 * 1000);
  var gpsLatPad = hasRecentGps ? nmToLatDeg(WX_WEATHER_DOMAIN_GPS_NM) : 0;
  var gpsLonPad = hasRecentGps ? nmToLonDegAtLat(WX_WEATHER_DOMAIN_GPS_NM, gps.lat) : 0;
  var gpsLatMin = hasRecentGps ? Math.max(-89.5, gps.lat - gpsLatPad) : 0;
  var gpsLatMax = hasRecentGps ? Math.min(89.5, gps.lat + gpsLatPad) : 0;
  var gpsLonMin = hasRecentGps ? normalizeLon180(gps.lon - gpsLonPad) : 0;
  var gpsLonMax = hasRecentGps ? normalizeLon180(gps.lon + gpsLonPad) : 0;
  var gpsWrap = hasRecentGps ? gps.lon - gpsLonPad < -180 || gps.lon + gpsLonPad > 180 : false;
  if (!routeBounds && !hasRecentGps) return points;
  var filtered = points.filter(p => {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
    if (routeBounds && pointInsideBounds(p.lat, p.lon, routeBounds)) return true;
    if (hasRecentGps) {
      if (p.lat < gpsLatMin || p.lat > gpsLatMax) return false;
      if (!gpsWrap) return p.lon >= gpsLonMin && p.lon <= gpsLonMax;
      return p.lon >= gpsLonMin || p.lon <= gpsLonMax;
    }
    return false;
  });
  // Wenn durch Domain-Filter zu stark ausgedünnt wird, auf das Viewport-Raster zurückfallen.
  if (filtered.length >= 8) return filtered;
  return points;
}
function getMapWeatherGridPoints() {
  var cols = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 8;
  var rows = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 6;
  if (!map) return {
    points: [],
    key: ''
  };
  var b = map.getBounds();
  if (!b || !b.isValid()) return {
    points: [],
    key: ''
  };
  var north = b.getNorth();
  var south = b.getSouth();
  var west = b.getWest();
  var east = b.getEast();
  var latSpan = Math.max(0.05, Math.abs(north - south));
  var lonSpan = east - west;
  if (lonSpan < 0) lonSpan += 360;
  lonSpan = Math.max(0.05, lonSpan);
  var latStep = pickWeatherGridStep(latSpan, rows) * WX_GRID_SPACING_SCALE;
  var lonStep = pickWeatherGridStep(lonSpan, cols) * WX_GRID_SPACING_SCALE;
  var latStart = Math.floor(south / latStep) * latStep;
  var latEnd = Math.ceil(north / latStep) * latStep;
  var westN = (west % 360 + 360) % 360;
  var eastN = westN + lonSpan;
  var lonStart = Math.floor(westN / lonStep) * lonStep;
  var lonEnd = Math.ceil(eastN / lonStep) * lonStep;
  var pts = [];
  for (var lat = latStart; lat <= latEnd + latStep * 0.25; lat += latStep) {
    var clampedLat = Math.max(-89.5, Math.min(89.5, lat));
    for (var lon = lonStart; lon <= lonEnd + lonStep * 0.25; lon += lonStep) {
      pts.push({
        lat: Math.round(clampedLat * 1e5) / 1e5,
        lon: Math.round(normalizeLon180(lon) * 1e5) / 1e5
      });
    }
  }
  var filteredPts = filterWeatherPointsByActiveDomain(pts);
  var maxPoints = 48;
  var reducedPts = filteredPts.length > maxPoints ? filteredPts.filter((_, idx) => idx % Math.ceil(filteredPts.length / maxPoints) === 0).slice(0, maxPoints) : filteredPts;
  return {
    points: reducedPts,
    latStep,
    lonStep,
    key: [latStep.toFixed(3), lonStep.toFixed(3), latStart.toFixed(3), latEnd.toFixed(3), lonStart.toFixed(3), lonEnd.toFixed(3), reducedPts.length].join('|')
  };
}
