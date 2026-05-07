import fs from 'node:fs/promises';

const DATASET_PATH = new URL('../data/gafor-sector-dataset-de.json', import.meta.url);
const DWD_HTML_PATH = '/private/tmp/dwd_fbeu40_latest.html';
const TARGET_DATE_DEFAULT = '2026-05-06';
const SLOT_TIMES_UTC = ['16:00', '18:00', '20:00'];

const WX_SUPPORT_CODES = new Set([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99]);
const WX_DOWN_2_STRONG = new Set([82, 86, 67, 65, 75]);
const WX_DOWN_1 = new Set([80, 81, 61, 63, 71, 73, 51, 53, 55, 56, 57, 66]);
const WX_HARSH_X_CAP = new Set([95, 96, 99, 65, 67, 75, 82, 86]);
const REF_FINE_TRIM_FT_DE = {
  '00': -120, '01': -120, '02': -80, '07': -80, '09': -80,
  '14': 120, '33': 220, '35': 200, '37': 220, '38': 200, '41': 180, '44': 160
};

function pointKey(lat, lon) {
  return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
}

function majorFromCode(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'C' || c === 'O' || c === 'X') return c;
  if (c.startsWith('D')) return 'D';
  if (c.startsWith('M')) return 'M';
  return '?';
}

function majorSeverity(major) {
  return ({ C: 0, O: 1, D: 2, M: 3, X: 4 })[String(major || '').toUpperCase()] ?? 2;
}

function majorFromSeverity(level) {
  const n = Math.max(0, Math.min(4, Math.round(Number(level) || 0)));
  return ['C', 'O', 'D', 'M', 'X'][n] || 'D';
}

function sectorRefTuneFactor(refFt) {
  const ref = Number(refFt);
  if (!Number.isFinite(ref)) return 0;
  const norm = (ref - 800) / 2400;
  return Math.max(0, Math.min(1, norm));
}

function sectorRegionalRefFactor(refFt) {
  const ref = Number(refFt);
  let f = sectorRefTuneFactor(refFt);
  if (Number.isFinite(ref)) {
    if (ref <= 900) f += 0.22;
    else if (ref <= 1400) f += 0.10;
    else if (ref >= 2800) f -= 0.10;
    else if (ref >= 2200) f -= 0.05;
  }
  return Math.max(0, Math.min(1, f));
}

function refFineTrimFt(parts = {}) {
  const sid = String(parts.sectorId || '').padStart(2, '0');
  let trim = Number(REF_FINE_TRIM_FT_DE[sid] || 0);
  const ref = Number(parts.sectorRefFt);
  const t = Number(parts.temp2mC);
  const td = Number(parts.dewPoint2mC);
  const rh = Number(parts.rh2mPct);
  const spread = (Number.isFinite(t) && Number.isFinite(td)) ? Math.max(0, t - td) : null;
  if (Number.isFinite(ref) && ref <= 1200 && Number.isFinite(rh) && Number.isFinite(spread) && rh >= 93 && spread <= 1.5) trim += 80;
  if (Number.isFinite(ref) && ref >= 2200 && Number.isFinite(rh) && Number.isFinite(spread) && rh <= 55 && spread >= 4.0) trim -= 80;
  return Math.max(-300, Math.min(300, trim));
}

function adjustedSectorRefFt(parts = {}) {
  const ref = Number(parts.sectorRefFt);
  if (!Number.isFinite(ref)) return ref;
  return ref + refFineTrimFt(parts);
}

function parseMetarVisibilityM(rawText) {
  const raw = String(rawText || '').toUpperCase();
  if (!raw) return null;
  if (/\bCAVOK\b/.test(raw) || /\bP6SM\b/.test(raw)) return 10000;
  const smFrac = raw.match(/\b(?:(\d+)\s+)?(\d\/\d)SM\b/);
  if (smFrac) {
    const whole = Number(smFrac[1] || 0);
    const [a, b] = String(smFrac[2] || '').split('/').map(Number);
    const frac = (Number.isFinite(a) && Number.isFinite(b) && b > 0) ? (a / b) : 0;
    const miles = whole + frac;
    if (Number.isFinite(miles) && miles > 0) return Math.round(miles * 1609.34);
  }
  const smWhole = raw.match(/\b(\d+)SM\b/);
  if (smWhole) {
    const miles = Number(smWhole[1]);
    if (Number.isFinite(miles) && miles >= 0) return Math.round(miles * 1609.34);
  }
  const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    const m = tok.match(/^(\d{4})(?:NDV)?$/);
    if (!m) continue;
    const vis = Number(m[1]);
    if (Number.isFinite(vis) && vis >= 0) return vis;
  }
  return null;
}

function internalMajorRank(code) {
  const c = String(code || '').toUpperCase();
  return ({ C: 0, O: 1, D: 2, M: 3, X: 4 })[c] ?? 2;
}

function internalMajorFromVisKm(visKm) {
  const v = Number(visKm);
  if (!Number.isFinite(v)) return null;
  if (v < 1.5) return 'X';
  if (v < 5) return 'M';
  if (v < 8) return 'D';
  if (v < 10) return 'O';
  return 'C';
}

function internalMajorFromCeilingFt(ceilingFt) {
  const c = Number(ceilingFt);
  if (!Number.isFinite(c)) return null;
  if (c < 500) return 'X';
  if (c < 1000) return 'M';
  if (c < 2000) return 'D';
  if (c < 5000) return 'O';
  return 'C';
}

function internalMajorFromMetarFlightCat(fltCat) {
  const cat = String(fltCat || '').trim().toUpperCase();
  if (cat === 'LIFR') return 'X';
  if (cat === 'IFR') return 'M';
  if (cat === 'MVFR') return 'D';
  if (cat === 'VFR') return 'O';
  return null;
}

function worstInternalMajor(list) {
  let out = null;
  for (const m of (Array.isArray(list) ? list : [list])) {
    const c = String(m || '').toUpperCase();
    if (!['C', 'O', 'D', 'M', 'X'].includes(c)) continue;
    if (!out || internalMajorRank(c) > internalMajorRank(out)) out = c;
  }
  return out;
}

function metarCeilingFt(rec) {
  let out = null;
  const clouds = Array.isArray(rec?.clouds) ? rec.clouds : [];
  clouds.forEach((c) => {
    const cover = String(c?.cover || '').toUpperCase();
    if (!['BKN', 'OVC', 'VV'].includes(cover)) return;
    const base = Number(c?.base);
    if (!Number.isFinite(base) || base < 0) return;
    if (!Number.isFinite(out) || base < out) out = base;
  });
  return Number.isFinite(out) ? out : null;
}

function nmBetween(aLat, aLon, bLat, bLon) {
  const toRad = Math.PI / 180;
  const lat1 = Number(aLat) * toRad;
  const lat2 = Number(bLat) * toRad;
  const dLat = (Number(bLat) - Number(aLat)) * toRad;
  const dLon = (Number(bLon) - Number(aLon)) * toRad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2);
  const km = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
  return km / 1.852;
}

function buildSectorMetarGuardrail(samplePoints, metars, sectorRefFt = null) {
  const pts = Array.isArray(samplePoints) ? samplePoints : [];
  if (!pts.length || !Array.isArray(metars) || !metars.length) return null;
  const refRaw = Number(sectorRefFt);
  const refFactor = sectorRegionalRefFactor(sectorRefFt);
  const isFlatland = Number.isFinite(refRaw) && refRaw <= 900;
  const isHighland = Number.isFinite(refRaw) && refRaw >= 2400;
  const rows = [];
  for (const rec of metars) {
    const lat = Number(rec?.lat);
    const lon = Number(rec?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let bestNm = Infinity;
    for (const p of pts) {
      const d = nmBetween(p.lat, p.lon, lat, lon);
      if (Number.isFinite(d) && d < bestNm) bestNm = d;
    }
    if (!Number.isFinite(bestNm) || bestNm > 45) continue;
    const visM = parseMetarVisibilityM(rec?.rawOb || '');
    const ceiling = metarCeilingFt(rec);
    const byCat = internalMajorFromMetarFlightCat(rec?.fltCat);
    const byVis = (Number.isFinite(visM) && visM > 0) ? internalMajorFromVisKm(visM / 1000) : null;
    const byCeil = internalMajorFromCeilingFt(ceiling);
    const major = worstInternalMajor([byCat, byVis, byCeil]);
    if (!major) continue;
    rows.push({
      icao: String(rec?.icaoId || ''),
      distNm: bestNm,
      major
    });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.distNm - b.distNm);
  const top = rows.slice(0, 4);
  const nearest = top[0];
  const strongCount = top.filter((r) => internalMajorRank(r.major) >= internalMajorRank('M')).length;
  const moderateCount = top.filter((r) => internalMajorRank(r.major) >= internalMajorRank('D')).length;
  const needModerateCount = isFlatland ? 1 : (isHighland ? 2 : (refFactor >= 0.6 ? 1 : 2));
  const nearDnm = (isHighland ? 24 : 28) + (8 * refFactor);
  let floorMajor = null;
  if (nearest && nearest.major === 'X' && nearest.distNm <= 10 && strongCount >= 2) floorMajor = 'M';
  else if (nearest && internalMajorRank(nearest.major) >= internalMajorRank('M') && nearest.distNm <= 18 && strongCount >= 2) floorMajor = 'M';
  else if (nearest && internalMajorRank(nearest.major) >= internalMajorRank('D') && nearest.distNm <= nearDnm && moderateCount >= needModerateCount) floorMajor = 'D';
  if (!floorMajor) return null;
  return { floorMajor };
}

function applyGuardrail(major, guardrail) {
  if (!guardrail || !guardrail.floorMajor) return major;
  const cur = internalMajorRank(major);
  const floor = internalMajorRank(guardrail.floorMajor);
  if (cur >= floor) return major;
  const bounded = Math.min(floor, Math.min(4, cur + 1));
  return ['C', 'O', 'D', 'M', 'X'][bounded] || major;
}

function parseDwdRows(html) {
  const rowRe = /<tr><td>(\d{2})<\/td>[\s\S]*?<\/tr>/gi;
  const out = new Map();
  let m;
  while ((m = rowRe.exec(html))) {
    const sectorId = m[1];
    const row = m[0];
    const codes = [...row.matchAll(/<b>([A-Z0-9]+)<\/b>/g)].map((x) => String(x[1] || '').toUpperCase());
    if (codes.length >= 3) out.set(sectorId, codes.slice(0, 3));
  }
  return out;
}

function buildSamplePoints(sectorMeta, polygon) {
  const out = [];
  const push = (lat, lon, role) => {
    const a = Number(lat);
    const b = Number(lon);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const key = pointKey(a, b);
    if (out.some((p) => p.key === key)) return;
    out.push({ lat: a, lon: b, key, role });
  };
  const probe = sectorMeta?.probe;
  push(probe?.lat, probe?.lon, 'probe');

  const poly = Array.isArray(polygon) ? polygon : [];
  if (poly.length) {
    const clat = poly.reduce((s, p) => s + Number(p?.[0] || 0), 0) / poly.length;
    const clon = poly.reduce((s, p) => s + Number(p?.[1] || 0), 0) / poly.length;
    push(clat, clon, 'center');
    const pLat = Number(probe?.lat);
    const pLon = Number(probe?.lon);
    if (Number.isFinite(pLat) && Number.isFinite(pLon)) {
      let far = null;
      let farD = -1;
      for (const v of poly) {
        const lat = Number(v?.[0]);
        const lon = Number(v?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const d2 = ((lat - pLat) ** 2) + ((lon - pLon) ** 2);
        if (d2 > farD) {
          farD = d2;
          far = { lat, lon };
        }
      }
      if (far) {
        const m = 0.62;
        push((pLat * (1 - m)) + (far.lat * m), (pLon * (1 - m)) + (far.lon * m), 'edge');
      }
    }
  }
  return out.slice(0, 3);
}

function hasReliableMosmixN05(parts, visKm, precipMm, wxCandidates, lowCoverPct) {
  const n05 = Number(parts.mosmixN05Pct);
  if (!Number.isFinite(n05)) return false;
  const stationDistKm = Number(parts.mosmixStationDistKm);
  const nearStation = !Number.isFinite(stationDistKm) || stationDistKm <= 32;
  if (n05 >= 82.5 && nearStation) return true;
  const wxSupport = wxCandidates.some((c) => WX_SUPPORT_CODES.has(Number(c)));
  const support = (Number.isFinite(visKm) && visKm <= 8)
    || (Number.isFinite(precipMm) && precipMm >= 0.2)
    || wxSupport
    || (Number.isFinite(lowCoverPct) && lowCoverPct >= 75);
  return n05 >= 62.5 && nearStation && support;
}

function estimateCloudBaseFtFromTempDew(parts = {}) {
  const t = Number(parts.temp2mC);
  const td = Number(parts.dewPoint2mC);
  if (!Number.isFinite(t) || !Number.isFinite(td)) return null;
  return Math.max(0, t - td) * 400;
}

function estimateFogRiskMajor(parts = {}, visKm = null) {
  const wxCandidates = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  if (wxCandidates.some((c) => c === 45 || c === 48)) return 'M';
  const t = Number(parts.temp2mC);
  const td = Number(parts.dewPoint2mC);
  const spread = (Number.isFinite(t) && Number.isFinite(td)) ? Math.max(0, t - td) : null;
  const rh = Number(parts.rh2mPct);
  const windKt = Number(parts.wind10mKt);
  const pressure = Number(parts.mslPressureHpa);
  if (!Number.isFinite(spread) && !Number.isFinite(rh)) return null;
  if (Number.isFinite(visKm) && visKm > 10) return null;
  let score = 0;
  if (Number.isFinite(spread)) {
    if (spread <= 0.8) score += 3;
    else if (spread <= 1.5) score += 2;
    else if (spread <= 2.5) score += 1;
  }
  if (Number.isFinite(rh)) {
    if (rh >= 97) score += 2;
    else if (rh >= 93) score += 1;
  }
  if (Number.isFinite(windKt)) {
    if (windKt <= 4) score += 2;
    else if (windKt <= 8) score += 1;
  }
  if (Number.isFinite(pressure) && pressure >= 1020) score += 1;
  if (Number.isFinite(visKm)) {
    if (visKm <= 3) score += 2;
    else if (visKm <= 6) score += 1;
  }
  if (score >= 7 && Number.isFinite(visKm) && visKm <= 2.0) return 'M';
  if (score >= 6 && Number.isFinite(visKm) && visKm <= 5) return 'D';
  return null;
}

function classifyRobust(parts = {}) {
  const visMRaw = (Number(parts.mosmixVisibilityM) > 0) ? Number(parts.mosmixVisibilityM) : Number(parts.visibility);
  const visKm = (Number.isFinite(visMRaw) && visMRaw > 0) ? (visMRaw / 1000) : null;
  const cloudBaseMRaw = Number(parts.cloudBaseM);
  const cloudBaseFtAglRaw = (Number.isFinite(cloudBaseMRaw) && cloudBaseMRaw > 0) ? (cloudBaseMRaw * 3.28084) : null;
  const cloudBaseFtAgl = Number.isFinite(cloudBaseFtAglRaw) ? cloudBaseFtAglRaw : estimateCloudBaseFtFromTempDew(parts);
  const sectorRefFt = adjustedSectorRefFt(parts);
  const terrainPointFt = Number(parts.terrainPointFt);
  const cloudLow = Number(parts.cloudLow || 0);
  const cloudMid = Number(parts.cloudMid || 0);
  const cloudTotal = Number(parts.cloudTotal || 0);
  const lowCoverForCeiling = Number.isFinite(Number(parts.mosmixLowCloudPct)) ? Number(parts.mosmixLowCloudPct) : cloudLow;
  const coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
  const hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;
  const wxForN05 = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  const precipForN05 = Math.max(0, Number(parts.precipitation || parts.rain || 0), Number(parts.mosmixPrecipitationMm || 0));
  const mosmixHasBknBelow500 = hasReliableMosmixN05(parts, visKm, precipForN05, wxForN05, lowCoverForCeiling);

  let cloudAboveRefFt = cloudBaseFtAgl;
  if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
    cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
  }
  const visKnown = Number.isFinite(visKm);
  const cloudKnown = mosmixHasBknBelow500 || (hasCeilingCondition && Number.isFinite(cloudAboveRefFt));
  if (!visKnown && !cloudKnown) return { major: '?', baseMajor: '?' };

  const visBand = !visKnown ? null : (
    visKm < 1.5 ? 'x' : visKm < 5 ? 'v15_5' : visKm < 8 ? 'v5_8' : visKm < 10 ? 'v8_10' : 'v10_plus'
  );
  const cloudBand = !cloudKnown ? null : (
    mosmixHasBknBelow500 ? 'c_below_500'
      : cloudAboveRefFt < 500 ? 'c_below_500'
        : cloudAboveRefFt < 1000 ? 'c500_1000'
          : cloudAboveRefFt < 2000 ? 'c1000_2000'
            : cloudAboveRefFt >= 5000 ? 'c5000_plus' : 'c2000_5000'
  );
  const fullMatrix = {
    v15_5: { c_below_500: 'X', c500_1000: 'M8', c1000_2000: 'M7', c2000_5000: 'M6', c5000_plus: 'M6' },
    v5_8: { c_below_500: 'X', c500_1000: 'M5', c1000_2000: 'D4', c2000_5000: 'D3', c5000_plus: 'D3' },
    v8_10: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'O' },
    v10_plus: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'C' }
  };
  let code = null;
  if (visBand === 'x' || cloudBand === 'c_below_500') code = 'X';
  else if (visBand && cloudBand && fullMatrix[visBand]?.[cloudBand]) code = fullMatrix[visBand][cloudBand];
  else if (visBand && !cloudBand) {
    if (visBand === 'v10_plus') code = 'C';
    else if (visBand === 'v8_10') code = 'O';
    else if (visBand === 'v5_8') code = 'D3';
    else if (visBand === 'v15_5') code = 'M6';
  } else if (!visBand && cloudBand) {
    if (cloudBand === 'c5000_plus') code = 'C';
    else if (cloudBand === 'c2000_5000') code = 'O';
    else if (cloudBand === 'c1000_2000') code = 'D1';
    else if (cloudBand === 'c500_1000') code = 'M2';
    else code = 'X';
  }
  if (!code) code = 'D4';
  const baseMajor = majorFromCode(code);

  const wxCandidates = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  const wxWorst = wxCandidates.length ? Math.max(...wxCandidates) : null;
  const precipMax = Math.max(0, Number(parts.precipitation || parts.rain || 0), Number(parts.mosmixPrecipitationMm || 0));
  const n05 = Number(parts.mosmixN05Pct);
  const lowCover = Number.isFinite(Number(parts.mosmixLowCloudPct)) ? Number(parts.mosmixLowCloudPct) : Number(parts.cloudLow || 0);
  const refFactor = sectorRegionalRefFactor(sectorRefFt);

  let downgrade = 0;
  if (wxCandidates.some((c) => c === 95 || c === 96 || c === 99)) downgrade = Math.max(downgrade, 2);
  else if (wxCandidates.some((c) => WX_DOWN_2_STRONG.has(c))) downgrade = Math.max(downgrade, 2);
  else if (wxCandidates.some((c) => WX_DOWN_1.has(c))) downgrade = Math.max(downgrade, 1);
  else if (Number.isFinite(wxWorst) && wxWorst >= 45 && wxWorst <= 48) downgrade = Math.max(downgrade, 1);
  const fogMajor = estimateFogRiskMajor(parts, visKm);
  if (fogMajor === 'M') downgrade = Math.max(downgrade, 2);
  else if (fogMajor === 'D') downgrade = Math.max(downgrade, 1);

  if (precipMax >= 1.8) downgrade = Math.max(downgrade, 2);
  else if (precipMax >= 0.3) downgrade = Math.max(downgrade, 1);
  const n05Threshold = Math.max(50, 62.5 - (refFactor * 8));
  if (Number.isFinite(n05) && n05 >= n05Threshold) downgrade = Math.max(downgrade, 1);
  if (Number.isFinite(lowCover) && lowCover >= 92 && Number.isFinite(visKm) && visKm <= 8) downgrade = Math.max(downgrade, 2);
  if (refFactor >= 0.45 && ['C', 'O'].includes(baseMajor)) {
    const hasModerateSignal = (
      (Number.isFinite(precipMax) && precipMax >= 0.2)
      || (Number.isFinite(n05) && n05 >= n05Threshold)
      || wxCandidates.some(c => [80, 81, 61, 63, 71, 73, 51, 53, 55, 56, 57, 66].includes(c))
    );
    if (hasModerateSignal) downgrade = Math.max(downgrade, 1);
  }

  let forcedMajor = null;
  if (Number.isFinite(visKm)) {
    if (visKm < 2.0) forcedMajor = 'X';
    else if (visKm < (4.5 + (0.4 * refFactor))) forcedMajor = 'M';
    else if (visKm < (6.5 + (0.6 * refFactor))) forcedMajor = 'D';
  }
  let finalSeverity = Math.min(4, majorSeverity(baseMajor) + downgrade);
  if (forcedMajor) finalSeverity = Math.max(finalSeverity, majorSeverity(forcedMajor));
  const harsh = wxCandidates.some((c) => WX_HARSH_X_CAP.has(c)) || precipMax >= 1.8;
  if (finalSeverity >= 4 && Number.isFinite(visKm) && visKm >= 4.5 && !harsh) finalSeverity = 3;
  return { major: majorFromSeverity(finalSeverity), baseMajor, visKm };
}

async function getJsonWithRetry(url, tries = 4) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`);
      return JSON.parse(txt);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, (i + 1) * 650));
    }
  }
  throw lastErr;
}

async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  const n = Math.max(1, Math.min(Number(limit) || 8, items.length || 1));
  let cursor = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await worker(items[idx], idx);
    }
  }));
  return out;
}

function pickNearestTarget(rec, targetSec) {
  const targets = Array.isArray(rec?.targets) ? rec.targets : [];
  if (!targets.length) return rec?.current || {};
  let best = targets[0];
  let bestDiff = Infinity;
  for (const t of targets) {
    const cand = Number(t?.time || t?.target);
    if (!Number.isFinite(cand)) continue;
    const d = Math.abs(cand - targetSec);
    if (d < bestDiff) {
      best = t;
      bestDiff = d;
    }
  }
  return best || rec?.current || {};
}

async function main() {
  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, 'utf8'));
  const html = await fs.readFile(DWD_HTML_PATH, 'utf8');
  const dwdRows = parseDwdRows(html);
  const argSectors = (process.argv || []).find((a) => String(a || '').startsWith('--sectors=')) || '';
  const argDate = (process.argv || []).find((a) => String(a || '').startsWith('--date=')) || '';
  const requestedFromArg = argSectors ? String(argSectors).slice('--sectors='.length) : '';
  const dateFromArg = argDate ? String(argDate).slice('--date='.length) : '';
  const requested = String(requestedFromArg || process.env.SECTORS || '').trim();
  const targetDate = String(dateFromArg || process.env.TARGET_DATE || TARGET_DATE_DEFAULT).trim();
  const requestedIds = requested
    ? requested.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.padStart(2, '0'))
    : null;
  const allSectorIds = [...dwdRows.keys()].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const sectorIds = requestedIds
    ? allSectorIds.filter((id) => requestedIds.includes(id))
    : allSectorIds;

  const sectorDefs = sectorIds
    .map((id) => {
      const meta = dataset?.sectorMeta?.[id];
      const polygon = dataset?.sectors?.[id];
      if (!meta?.probe || !Array.isArray(polygon) || !polygon.length) return null;
      const samplePoints = buildSamplePoints(meta, polygon);
      return {
        id,
        name: String(meta.name || `Sektor ${id}`),
        refFt: Number(meta.refFt),
        samplePoints
      };
    })
    .filter(Boolean);

  const uniquePoints = [];
  const uniqueByKey = new Map();
  for (const s of sectorDefs) {
    for (const p of s.samplePoints) {
      if (uniqueByKey.has(p.key)) continue;
      const rec = { key: p.key, lat: p.lat, lon: p.lon };
      uniqueByKey.set(p.key, rec);
      uniquePoints.push(rec);
    }
  }

  const targetsSec = SLOT_TIMES_UTC.map((hm) => Math.floor(Date.parse(`${targetDate}T${hm}:00Z`) / 1000));
  const metars = await getJsonWithRetry('https://aviationweather.gov/api/data/metar?format=json&bbox=47,5,55,16', 4);

  const omDataByPoint = new Map();
  const omRows = await runPool(uniquePoints, 4, async (p) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=visibility,weather_code,cloud_cover_low,cloud_cover_mid,cloud_cover,precipitation,rain,cloud_base,wind_speed_10m,temperature_2m,dew_point_2m,relative_humidity_2m,pressure_msl,cape,freezing_level_height&timezone=UTC&forecast_days=2&wind_speed_unit=kn`;
    const data = await getJsonWithRetry(url, 4);
    return { key: p.key, data, elevationFt: Number.isFinite(Number(data?.elevation)) ? Math.round(Number(data.elevation) * 3.28084) : null };
  });
  omRows.forEach((r) => omDataByPoint.set(r.key, r));

  const mxDataByPoint = new Map();
  const mxBatchSize = 70;
  for (let i = 0; i < uniquePoints.length; i += mxBatchSize) {
    const batch = uniquePoints.slice(i, i + mxBatchSize);
    const pointsParam = batch.map((p) => `${p.lat},${p.lon}`).join(';');
    const mxUrl = `https://ga-proxy.einherjer.workers.dev/api/mosmix?points=${pointsParam}&targets=${targetsSec.join(',')}`;
    const mx = await getJsonWithRetry(mxUrl, 5);
    const rows = Array.isArray(mx?.points) ? mx.points : [];
    rows.forEach((rec) => {
      const key = pointKey(rec?.lat, rec?.lon);
      mxDataByPoint.set(key, rec);
    });
  }

  const stats = {
    base: { totalSlots: 0, exactSlots: 0, totalSectors: 0, exactSectors: 0, mismatches: [], confusion: new Map() },
    guard: { totalSlots: 0, exactSlots: 0, totalSectors: 0, exactSectors: 0, mismatches: [], confusion: new Map() }
  };
  const drift = {
    base: { optimistic: 0, conservative: 0, equal: 0 },
    guard: { optimistic: 0, conservative: 0, equal: 0 }
  };
  const watch = new Map();

  for (const sector of sectorDefs) {
    const officialMajors = (dwdRows.get(sector.id) || []).map(majorFromCode);
    let all3Base = true;
    let all3Guard = true;
    const guardrail = buildSectorMetarGuardrail(sector.samplePoints, Array.isArray(metars) ? metars : [], Number(sector.refFt));
    for (let sIdx = 0; sIdx < SLOT_TIMES_UTC.length; sIdx++) {
      const hm = SLOT_TIMES_UTC[sIdx];
      const isoNoZ = `${targetDate}T${hm}`;
      const targetSec = targetsSec[sIdx];
      const perPoint = [];
      for (const p of sector.samplePoints) {
        const om = omDataByPoint.get(p.key);
        if (!om?.data?.hourly?.time) continue;
        const idx = om.data.hourly.time.indexOf(isoNoZ);
        if (idx < 0) continue;
        const mxRec = mxDataByPoint.get(p.key);
        const mx = pickNearestTarget(mxRec, targetSec);
        const parts = {
          sectorId: String(sector.id || ''),
          visibility: Number(om.data.hourly.visibility?.[idx]),
          weatherCode: Number(om.data.hourly.weather_code?.[idx]),
          cloudLow: Number(om.data.hourly.cloud_cover_low?.[idx]),
          cloudMid: Number(om.data.hourly.cloud_cover_mid?.[idx]),
          cloudTotal: Number(om.data.hourly.cloud_cover?.[idx]),
          precipitation: Number(om.data.hourly.precipitation?.[idx]),
          rain: Number(om.data.hourly.rain?.[idx]),
          cloudBaseM: Number(om.data.hourly.cloud_base?.[idx]),
          wind10mKt: Number(om.data.hourly.wind_speed_10m?.[idx]) * 0.5399568,
          temp2mC: Number(om.data.hourly.temperature_2m?.[idx]),
          dewPoint2mC: Number(om.data.hourly.dew_point_2m?.[idx]),
          rh2mPct: Number(om.data.hourly.relative_humidity_2m?.[idx]),
          mslPressureHpa: Number(om.data.hourly.pressure_msl?.[idx]),
          cape: Number(om.data.hourly.cape?.[idx]),
          freezingLevelM: Number(om.data.hourly.freezing_level_height?.[idx]),
          mosmixVisibilityM: Number(mx.visibilityM),
          mosmixN05Pct: Number(mx.n05Pct),
          mosmixLowCloudPct: Number(mx.lowCloudPct),
          mosmixPrecipitationMm: Number(mx.precipitationMm),
          mosmixWeatherCode: Number(mx.weatherCode),
          mosmixStationDistKm: Number(mxRec?.station?.distKm),
          sectorRefFt: Number(sector.refFt),
          terrainPointFt: Number.isFinite(om.elevationFt) ? Number(om.elevationFt) : Number(sector.refFt)
        };
        const cat = classifyRobust(parts);
        perPoint.push({ p, cat, parts });
      }
      if (!perPoint.length) continue;
      perPoint.sort((a, b) => majorSeverity(b.cat.major) - majorSeverity(a.cat.major));
      const worst = perPoint[0];
      const off = officialMajors[sIdx] || '?';
      const guardedMajor = applyGuardrail(worst.cat.major, guardrail);

      const feed = (bucket, ours, roleTag) => {
        bucket.totalSlots++;
        if (ours === off) {
          bucket.exactSlots++;
          return true;
        }
        const cKey = `${off}->${ours}`;
        bucket.confusion.set(cKey, (bucket.confusion.get(cKey) || 0) + 1);
        const delta = majorSeverity(ours) - majorSeverity(off);
        bucket.mismatches.push({
          id: sector.id,
          slot: hm,
          off,
          ours,
          base: worst.cat.baseMajor,
          role: roleTag,
          delta,
          visKm: Number(worst.cat.visKm),
          n05: Number(worst.parts.mosmixN05Pct),
          wxOm: Number(worst.parts.weatherCode),
          wxMx: Number(worst.parts.mosmixWeatherCode),
          rrOm: Number(worst.parts.precipitation),
          rrMx: Number(worst.parts.mosmixPrecipitationMm),
          windKt: Number(worst.parts.wind10mKt),
          tempC: Number(worst.parts.temp2mC),
          dewC: Number(worst.parts.dewPoint2mC),
          rhPct: Number(worst.parts.rh2mPct),
          cape: Number(worst.parts.cape),
          frzM: Number(worst.parts.freezingLevelM)
        });
        return false;
      };
      const trackDrift = (target, ours) => {
        const delta = majorSeverity(ours) - majorSeverity(off);
        if (delta < 0) target.optimistic++;
        else if (delta > 0) target.conservative++;
        else target.equal++;
      };
      if (!feed(stats.base, worst.cat.major, worst.p.role)) all3Base = false;
      if (!feed(stats.guard, guardedMajor, `${worst.p.role}${guardrail ? '+metar' : ''}`)) all3Guard = false;
      trackDrift(drift.base, worst.cat.major);
      trackDrift(drift.guard, guardedMajor);

      if (sector.id === '10' || sector.id === '11' || sector.id === '44') {
        if (!watch.has(sector.id)) watch.set(sector.id, []);
        watch.get(sector.id).push({
          slot: hm,
          off,
          oursBase: worst.cat.major,
          oursGuard: guardedMajor,
          role: worst.p.role,
          base: worst.cat.baseMajor,
          guard: guardrail ? guardrail.floorMajor : null
        });
      }
    }
    stats.base.totalSectors++;
    stats.guard.totalSectors++;
    if (all3Base) stats.base.exactSectors++;
    if (all3Guard) stats.guard.exactSectors++;
  }

  stats.base.mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  stats.guard.mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const confusionSortedBase = [...stats.base.confusion.entries()].sort((a, b) => b[1] - a[1]);
  const confusionSortedGuard = [...stats.guard.confusion.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`Snapshot-Datum (DWD): ${targetDate}`);
  if (requestedIds && requestedIds.length) {
    console.log(`Gefilterte Sektoren: ${requestedIds.join(', ')}`);
  }
  console.log(`Sektoren im Vergleich: ${stats.base.totalSectors}`);
  console.log(`Sample-Punkte gesamt: ${uniquePoints.length}`);
  console.log(`METAR-Reports geladen: ${Array.isArray(metars) ? metars.length : 0}`);
  console.log(`Slot-Treffer ohne Guardrail: ${stats.base.exactSlots}/${stats.base.totalSlots} (${((stats.base.exactSlots / Math.max(1, stats.base.totalSlots)) * 100).toFixed(1)}%)`);
  console.log(`Slot-Treffer mit Guardrail:  ${stats.guard.exactSlots}/${stats.guard.totalSlots} (${((stats.guard.exactSlots / Math.max(1, stats.guard.totalSlots)) * 100).toFixed(1)}%)`);
  console.log(`Sektor-3er ohne Guardrail: ${stats.base.exactSectors}/${stats.base.totalSectors} (${((stats.base.exactSectors / Math.max(1, stats.base.totalSectors)) * 100).toFixed(1)}%)`);
  console.log(`Sektor-3er mit Guardrail:  ${stats.guard.exactSectors}/${stats.guard.totalSectors} (${((stats.guard.exactSectors / Math.max(1, stats.guard.totalSectors)) * 100).toFixed(1)}%)`);
  console.log(`Drift ohne Guardrail: optimistisch ${drift.base.optimistic}, konservativ ${drift.base.conservative}`);
  console.log(`Drift mit Guardrail:  optimistisch ${drift.guard.optimistic}, konservativ ${drift.guard.conservative}`);
  console.log('');
  console.log('Watch (10/11/44):');
  for (const id of ['10', '11', '44']) {
    const rows = watch.get(id) || [];
    if (!rows.length) continue;
    console.log(`  ${id}: ${rows.map((r) => `${r.slot} ${r.off}->${r.oursBase}/${r.oursGuard} (${r.role}, floor ${r.guard || '-'})`).join(' | ')}`);
  }
  console.log('');
  console.log('Häufigste Abweichungen ohne Guardrail:');
  for (const [k, v] of confusionSortedBase.slice(0, 10)) {
    const [a, b] = k.split('->');
    if (a === b) continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log('');
  console.log('Häufigste Abweichungen mit Guardrail:');
  for (const [k, v] of confusionSortedGuard.slice(0, 10)) {
    const [a, b] = k.split('->');
    if (a === b) continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log('');
  console.log('Top-Ausreißer mit Guardrail:');
  for (const r of stats.guard.mismatches.slice(0, 20)) {
    const sign = r.delta > 0 ? '+' : '';
    console.log(`  ${r.id} ${r.slot} off ${r.off} vs ours ${r.ours} (${r.role}, base ${r.base}) delta ${sign}${r.delta} vis ${Number(r.visKm).toFixed(1)} n05 ${r.n05} wx ${r.wxOm}/${r.wxMx} rr ${r.rrOm}/${r.rrMx}`);
  }
  const gm = stats.guard.mismatches;
  const opt = gm.filter((r) => Number(r.delta) < 0);
  const con = gm.filter((r) => Number(r.delta) > 0);
  const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  const avg = (rows, key) => {
    const vals = rows.map((r) => Number(r && r[key])).filter(Number.isFinite);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const pct = (rows, fn) => {
    if (!rows.length) return null;
    return (rows.filter(fn).length / rows.length) * 100;
  };
  console.log('');
  console.log('Faktoren (Guardrail-Mismatches):');
  console.log(`  Optimistisch: n=${opt.length} | vis ${fmt(avg(opt, 'visKm'))}km | wind ${fmt(avg(opt, 'windKt'))}kt | rr ${fmt(avg(opt, 'rrOm'), 2)}mm | rh ${fmt(avg(opt, 'rhPct'))}% | CAPE ${fmt(avg(opt, 'cape'), 0)} | FL ${fmt(avg(opt, 'frzM'), 0)}m`);
  console.log(`  Konservativ: n=${con.length} | vis ${fmt(avg(con, 'visKm'))}km | wind ${fmt(avg(con, 'windKt'))}kt | rr ${fmt(avg(con, 'rrOm'), 2)}mm | rh ${fmt(avg(con, 'rhPct'))}% | CAPE ${fmt(avg(con, 'cape'), 0)} | FL ${fmt(avg(con, 'frzM'), 0)}m`);
  console.log(`  Optimistisch mit wx risk (45/48/51/53/55/56/57/61/63/65/66/67/75/80/82/85/95/96/99): ${fmt(pct(opt, (r) => WX_SUPPORT_CODES.has(Number(r.wxOm))), 1)}%`);
  console.log(`  Konservativ mit wx risk (gleiche Liste): ${fmt(pct(con, (r) => WX_SUPPORT_CODES.has(Number(r.wxOm))), 1)}%`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
