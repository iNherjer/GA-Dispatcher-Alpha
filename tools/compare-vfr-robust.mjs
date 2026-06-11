import fs from 'node:fs/promises';

const DATASET_PATH = new URL('../data/gafor-sector-dataset-de.json', import.meta.url);
const DWD_HTML_PATH = '/private/tmp/dwd_fbeu40_latest.html';

const TARGET_DATE = '2026-05-06';
const SLOT_TIMES_UTC = ['16:00', '18:00', '20:00']; // midpoint for 15-17 / 17-19 / 19-21 UTC

const WX_SUPPORT_CODES = new Set([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99]);
const WX_DOWN_2_STRONG = new Set([82, 86, 67, 65, 75]);
const WX_DOWN_1 = new Set([80, 81, 61, 63, 71, 73, 51, 53, 55, 56, 57, 66]);
const WX_HARSH_X_CAP = new Set([95, 96, 99, 65, 67, 75, 82, 86]);

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

function classifyBase(parts = {}) {
  const mosmixVisibilityM = Number(parts.mosmixVisibilityM);
  const visMRaw = Number.isFinite(mosmixVisibilityM) && mosmixVisibilityM > 0
    ? mosmixVisibilityM
    : Number(parts.visibility);
  const visKm = (Number.isFinite(visMRaw) && visMRaw > 0) ? (visMRaw / 1000) : null;

  const cloudBaseMRaw = Number(parts.cloudBaseM);
  const cloudBaseFtAgl = (Number.isFinite(cloudBaseMRaw) && cloudBaseMRaw > 0) ? (cloudBaseMRaw * 3.28084) : null;
  const sectorRefFt = Number(parts.sectorRefFt);
  const terrainPointFt = Number(parts.terrainPointFt);
  const cloudLow = Number(parts.cloudLow || 0);
  const cloudMid = Number(parts.cloudMid || 0);
  const cloudTotal = Number(parts.cloudTotal || 0);
  const mosmixLowCloudPct = Number(parts.mosmixLowCloudPct);
  const lowCoverForCeiling = Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : cloudLow;
  const coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
  const hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;

  const wxForN05 = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  const precipForN05 = Math.max(
    0,
    Number(parts.precipitation || parts.rain || 0),
    Number(parts.mosmixPrecipitationMm || 0)
  );
  const mosmixHasBknBelow500 = hasReliableMosmixN05(parts, visKm, precipForN05, wxForN05, lowCoverForCeiling);

  let cloudAboveRefFt = cloudBaseFtAgl;
  if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
    cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
  }

  const visKnown = Number.isFinite(visKm);
  const cloudKnown = mosmixHasBknBelow500 || (hasCeilingCondition && Number.isFinite(cloudAboveRefFt));
  if (!visKnown && !cloudKnown) {
    return { major: '?' };
  }

  const visBand = !visKnown ? null : (
    visKm < 1.5 ? 'x'
      : visKm < 5 ? 'v15_5'
        : visKm < 8 ? 'v5_8'
          : visKm < 10 ? 'v8_10'
            : 'v10_plus'
  );
  const cloudBand = !cloudKnown ? null : (
    mosmixHasBknBelow500 ? 'c_below_500'
      : cloudAboveRefFt < 500 ? 'c_below_500'
        : cloudAboveRefFt < 1000 ? 'c500_1000'
          : cloudAboveRefFt < 2000 ? 'c1000_2000'
            : cloudAboveRefFt >= 5000 ? 'c5000_plus'
              : 'c2000_5000'
  );

  const fullMatrix = {
    v15_5: { c_below_500: 'X', c500_1000: 'M8', c1000_2000: 'M7', c2000_5000: 'M6', c5000_plus: 'M6' },
    v5_8: { c_below_500: 'X', c500_1000: 'M5', c1000_2000: 'D4', c2000_5000: 'D3', c5000_plus: 'D3' },
    v8_10: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'O' },
    v10_plus: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'C' }
  };

  let code = null;
  if (visBand === 'x' || cloudBand === 'c_below_500') {
    code = 'X';
  } else if (visBand && cloudBand && fullMatrix[visBand]?.[cloudBand]) {
    code = fullMatrix[visBand][cloudBand];
  } else if (visBand && !cloudBand) {
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

  return { major: majorFromCode(code), visKm };
}

function classifyRobust(parts = {}) {
  const base = classifyBase(parts);
  if (base.major === '?') return { major: '?', baseMajor: '?' };

  const wxCandidates = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
  const wxWorst = wxCandidates.length ? Math.max(...wxCandidates) : null;
  const precipOm = Number(parts.precipitation || parts.rain || 0);
  const precipMx = Number(parts.mosmixPrecipitationMm || 0);
  const precipMax = Math.max(0, Number.isFinite(precipOm) ? precipOm : 0, Number.isFinite(precipMx) ? precipMx : 0);
  const n05 = Number(parts.mosmixN05Pct);
  const lowCloud = Number(parts.mosmixLowCloudPct);
  const lowCloudFallback = Number(parts.cloudLow || 0);
  const lowCover = Number.isFinite(lowCloud) ? lowCloud : lowCloudFallback;
  const visKm = base.visKm;

  let downgrade = 0;
  if (wxCandidates.some((c) => c === 95 || c === 96 || c === 99)) {
    downgrade = Math.max(downgrade, 2);
  } else if (wxCandidates.some((c) => WX_DOWN_2_STRONG.has(c))) {
    downgrade = Math.max(downgrade, 2);
  } else if (wxCandidates.some((c) => WX_DOWN_1.has(c))) {
    downgrade = Math.max(downgrade, 1);
  } else if (Number.isFinite(wxWorst) && wxWorst >= 45 && wxWorst <= 48) {
    downgrade = Math.max(downgrade, 1);
  }

  if (precipMax >= 1.8) downgrade = Math.max(downgrade, 2);
  else if (precipMax >= 0.3) downgrade = Math.max(downgrade, 1);

  if (Number.isFinite(n05) && n05 >= 62.5) downgrade = Math.max(downgrade, 1);
  if (Number.isFinite(lowCover) && lowCover >= 92 && Number.isFinite(visKm) && visKm <= 8) downgrade = Math.max(downgrade, 2);

  let forcedMajor = null;
  if (Number.isFinite(visKm)) {
    if (visKm < 2.0) forcedMajor = 'X';
    else if (visKm < 4.5) forcedMajor = 'M';
    else if (visKm < 6.5) forcedMajor = 'D';
  }

  const baseSeverity = majorSeverity(base.major);
  const downgradedSeverity = Math.min(4, baseSeverity + downgrade);
  let finalSeverity = downgradedSeverity;
  if (forcedMajor) finalSeverity = Math.max(finalSeverity, majorSeverity(forcedMajor));

  const harsh = wxCandidates.some((c) => WX_HARSH_X_CAP.has(c)) || precipMax >= 1.8;
  if (finalSeverity >= 4 && Number.isFinite(visKm) && visKm >= 4.5 && !harsh) {
    finalSeverity = 3;
  }
  return { major: majorFromSeverity(finalSeverity), baseMajor: base.major };
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

function isoSlot(dateIso, hm) {
  return `${dateIso}T${hm}:00Z`;
}

async function getJsonWithRetry(url, tries = 4) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 180)}`);
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
  let idx = 0;
  const n = Math.max(1, Math.min(Number(limit) || 6, items.length || 1));
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

function pickNearestTarget(rec, targetSec) {
  const targets = Array.isArray(rec?.targets) ? rec.targets : [];
  if (!targets.length) return rec?.current || null;
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
  return best || rec?.current || null;
}

async function main() {
  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, 'utf8'));
  const html = await fs.readFile(DWD_HTML_PATH, 'utf8');
  const dwdRows = parseDwdRows(html);
  const dwdSectorIds = [...dwdRows.keys()].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));

  const sectorIds = dwdSectorIds.filter((id) => dataset?.sectorMeta?.[id]?.probe);
  const targetsSec = SLOT_TIMES_UTC.map((hm) => Math.floor(Date.parse(isoSlot(TARGET_DATE, hm)) / 1000));

  const points = sectorIds.map((id) => {
    const p = dataset.sectorMeta[id].probe;
    return { id, lat: Number(p.lat), lon: Number(p.lon), refFt: Number(dataset.sectorMeta[id].refFt) };
  });
  const pointMap = new Map(points.map((p) => [p.id, p]));

  const mosmixUrl = `https://ga-proxy.einherjer.workers.dev/api/mosmix?points=${points.map((p) => `${p.lat},${p.lon}`).join(';')}&targets=${targetsSec.join(',')}`;
  const mosmix = await getJsonWithRetry(mosmixUrl, 5);
  const mosmixById = new Map();
  if (Array.isArray(mosmix?.points)) {
    for (const rec of mosmix.points) {
      const lat = Number(rec?.lat);
      const lon = Number(rec?.lon);
      const id = points.find((p) => Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lon - lon) < 1e-6)?.id;
      if (id) mosmixById.set(id, rec);
    }
  }
  const mosmixCoverage = `${mosmixById.size}/${points.length}`;

  const openMeteoResults = await runPool(points, 6, async (p) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=visibility,weather_code,cloud_cover_low,cloud_cover_mid,cloud_cover,precipitation,rain,cloud_base&timezone=UTC&forecast_days=2`;
    const data = await getJsonWithRetry(url, 4);
    return { id: p.id, data };
  });
  const openMeteoById = new Map(openMeteoResults.map((r) => [r.id, r.data]));

  const metrics = {
    legacy: {
      totalSlots: 0, exactSlots: 0, totalSectors: 0, exactSectors: 0,
      confusion: new Map(), mismatches: [], watch: new Map()
    },
    terrain: {
      totalSlots: 0, exactSlots: 0, totalSectors: 0, exactSectors: 0,
      confusion: new Map(), mismatches: [], watch: new Map()
    }
  };
  let mosmixMissingSlots = 0;
  let changedByTerrain = 0;
  const changedRows = [];

  function feedMetric(bucket, row) {
    bucket.totalSlots++;
    if (row.ours === row.off) bucket.exactSlots++;
    const cKey = `${row.off}->${row.ours}`;
    bucket.confusion.set(cKey, (bucket.confusion.get(cKey) || 0) + 1);
    const delta = majorSeverity(row.ours) - majorSeverity(row.off);
    if (delta !== 0) {
      bucket.mismatches.push({ ...row, delta });
    }
    if (row.id === '10' || row.id === '11' || row.id === '44') {
      if (!bucket.watch.has(row.id)) bucket.watch.set(row.id, []);
      bucket.watch.get(row.id).push({ slot: row.slot, off: row.off, ours: row.ours, base: row.base });
    }
    return delta === 0;
  }

  for (const id of sectorIds) {
    const officialCodes = dwdRows.get(id) || [];
    const officialMajors = officialCodes.map(majorFromCode);
    const om = openMeteoById.get(id);
    const mxRec = mosmixById.get(id);
    const meta = pointMap.get(id);
    if (!om?.hourly || !Array.isArray(om.hourly.time)) continue;

    let sectorAll3MatchLegacy = true;
    let sectorAll3MatchTerrain = true;
    const slotRows = [];
    for (let s = 0; s < SLOT_TIMES_UTC.length; s++) {
      const hm = SLOT_TIMES_UTC[s];
      const isoNoZ = `${TARGET_DATE}T${hm}`;
      const idx = om.hourly.time.indexOf(isoNoZ);
      if (idx < 0) continue;
      const targetSec = targetsSec[s];
      const mx = pickNearestTarget(mxRec, targetSec) || {};
      if (!Number.isFinite(Number(mx.visibilityM)) && !Number.isFinite(Number(mx.n05Pct)) && !Number.isFinite(Number(mx.weatherCode))) {
        mosmixMissingSlots++;
      }

      const elevationM = Number(om.elevation);
      const terrainProbeFt = Number.isFinite(elevationM) ? Math.max(0, Math.round(elevationM * 3.28084)) : null;
      const baseParts = {
        visibility: Number(om.hourly.visibility?.[idx]),
        weatherCode: Number(om.hourly.weather_code?.[idx]),
        cloudLow: Number(om.hourly.cloud_cover_low?.[idx]),
        cloudMid: Number(om.hourly.cloud_cover_mid?.[idx]),
        cloudTotal: Number(om.hourly.cloud_cover?.[idx]),
        precipitation: Number(om.hourly.precipitation?.[idx]),
        rain: Number(om.hourly.rain?.[idx]),
        cloudBaseM: Number(om.hourly.cloud_base?.[idx]),
        mosmixVisibilityM: Number(mx.visibilityM),
        mosmixN05Pct: Number(mx.n05Pct),
        mosmixLowCloudPct: Number(mx.lowCloudPct),
        mosmixPrecipitationMm: Number(mx.precipitationMm),
        mosmixWeatherCode: Number(mx.weatherCode),
        mosmixStationDistKm: Number(mxRec?.station?.distKm),
        sectorRefFt: meta.refFt,
        terrainPointFt: meta.refFt
      };

      const off = officialMajors[s] || '?';
      const legacyOut = classifyRobust(baseParts);
      const legacyMatch = feedMetric(metrics.legacy, {
        id,
        slot: hm,
        off,
        ours: legacyOut.major,
        base: legacyOut.baseMajor,
        visKm: Number(baseParts.mosmixVisibilityM > 0 ? baseParts.mosmixVisibilityM / 1000 : baseParts.visibility / 1000),
        n05: Number(baseParts.mosmixN05Pct),
        wxOm: Number(baseParts.weatherCode),
        wxMx: Number(baseParts.mosmixWeatherCode),
        rrOm: Number(baseParts.precipitation),
        rrMx: Number(baseParts.mosmixPrecipitationMm)
      });
      if (!legacyMatch) sectorAll3MatchLegacy = false;

      const terrainParts = {
        ...baseParts,
        terrainPointFt: Number.isFinite(terrainProbeFt) ? terrainProbeFt : meta.refFt
      };
      const terrainOut = classifyRobust(terrainParts);
      if (terrainOut.major !== legacyOut.major) {
        changedByTerrain++;
        if (changedRows.length < 25) {
          changedRows.push({
            id,
            slot: hm,
            legacy: legacyOut.major,
            terrain: terrainOut.major,
            off
          });
        }
      }
      const terrainMatch = feedMetric(metrics.terrain, {
        id,
        slot: hm,
        off,
        ours: terrainOut.major,
        base: terrainOut.baseMajor,
        visKm: Number(terrainParts.mosmixVisibilityM > 0 ? terrainParts.mosmixVisibilityM / 1000 : terrainParts.visibility / 1000),
        n05: Number(terrainParts.mosmixN05Pct),
        wxOm: Number(terrainParts.weatherCode),
        wxMx: Number(terrainParts.mosmixWeatherCode),
        rrOm: Number(terrainParts.precipitation),
        rrMx: Number(terrainParts.mosmixPrecipitationMm)
      });
      if (!terrainMatch) sectorAll3MatchTerrain = false;

      slotRows.push(terrainOut.major);
    }

    metrics.legacy.totalSectors++;
    metrics.terrain.totalSectors++;
    if (sectorAll3MatchLegacy) metrics.legacy.exactSectors++;
    if (sectorAll3MatchTerrain) metrics.terrain.exactSectors++;
  }

  metrics.legacy.mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  metrics.terrain.mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const confusionSortedLegacy = [...metrics.legacy.confusion.entries()].sort((a, b) => b[1] - a[1]);
  const confusionSortedTerrain = [...metrics.terrain.confusion.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`Snapshot-Datum (DWD): ${TARGET_DATE}`);
  console.log(`Sektoren im Vergleich: ${metrics.legacy.totalSectors}`);
  console.log(`MOSMIX-Abdeckung (Sektor-Punkte): ${mosmixCoverage}`);
  console.log(`MOSMIX fehlend in Slots: ${mosmixMissingSlots}/${metrics.legacy.totalSlots} (${((mosmixMissingSlots / Math.max(1, metrics.legacy.totalSlots)) * 100).toFixed(1)}%)`);
  console.log(`Durch Terrain geaenderte Slots: ${changedByTerrain}/${metrics.legacy.totalSlots} (${((changedByTerrain / Math.max(1, metrics.legacy.totalSlots)) * 100).toFixed(1)}%)`);
  console.log('');
  console.log('Trefferquote (legacy terrain=refFt):');
  console.log(`  Slot: ${metrics.legacy.exactSlots}/${metrics.legacy.totalSlots} (${((metrics.legacy.exactSlots / Math.max(1, metrics.legacy.totalSlots)) * 100).toFixed(1)}%)`);
  console.log(`  Sektor-3er: ${metrics.legacy.exactSectors}/${metrics.legacy.totalSectors} (${((metrics.legacy.exactSectors / Math.max(1, metrics.legacy.totalSectors)) * 100).toFixed(1)}%)`);
  console.log('Trefferquote (terrain probe from elevation):');
  console.log(`  Slot: ${metrics.terrain.exactSlots}/${metrics.terrain.totalSlots} (${((metrics.terrain.exactSlots / Math.max(1, metrics.terrain.totalSlots)) * 100).toFixed(1)}%)`);
  console.log(`  Sektor-3er: ${metrics.terrain.exactSectors}/${metrics.terrain.totalSectors} (${((metrics.terrain.exactSectors / Math.max(1, metrics.terrain.totalSectors)) * 100).toFixed(1)}%)`);
  console.log('');
  console.log('Watch (10/11/44):');
  for (const id of ['10', '11', '44']) {
    const rowsLegacy = metrics.legacy.watch.get(id) || [];
    const rowsTerrain = metrics.terrain.watch.get(id) || [];
    if (rowsLegacy.length) {
      console.log(`  Sektor ${id} legacy: ${rowsLegacy.map((r) => `${r.slot} ${r.off}->${r.ours} (base ${r.base})`).join(' | ')}`);
    }
    if (rowsTerrain.length) {
      console.log(`  Sektor ${id} terrain: ${rowsTerrain.map((r) => `${r.slot} ${r.off}->${r.ours} (base ${r.base})`).join(' | ')}`);
    }
  }
  console.log('');
  console.log('Häufigste Abweichungen (legacy offiziell->unser):');
  for (const [k, v] of confusionSortedLegacy.slice(0, 10)) {
    if (k.endsWith('->?') || k.startsWith('?-')) continue;
    if (k.split('->')[0] === k.split('->')[1]) continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log('');
  console.log('Häufigste Abweichungen (terrain offiziell->unser):');
  for (const [k, v] of confusionSortedTerrain.slice(0, 10)) {
    if (k.endsWith('->?') || k.startsWith('?-')) continue;
    if (k.split('->')[0] === k.split('->')[1]) continue;
    console.log(`  ${k}: ${v}`);
  }
  console.log('');
  if (changedRows.length) {
    console.log('Beispiele geaenderter Slots (legacy -> terrain):');
    for (const row of changedRows) {
      console.log(`  ${row.id} ${row.slot} off ${row.off}: ${row.legacy} -> ${row.terrain}`);
    }
    console.log('');
  }
  console.log('');
  console.log('Top-Ausreißer (terrain):');
  for (const row of metrics.terrain.mismatches.slice(0, 20)) {
    const sign = row.delta > 0 ? '+' : '';
    console.log(`  ${row.id} ${row.slot} off ${row.off} vs ours ${row.ours} (base ${row.base}) delta ${sign}${row.delta} vis ${Number(row.visKm).toFixed(1)} n05 ${row.n05} wx ${row.wxOm}/${row.wxMx} rr ${row.rrOm}/${row.rrMx}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
