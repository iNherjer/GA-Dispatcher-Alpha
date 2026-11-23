// Weather marker geometry and the internal VFR classifier shared by Web and EFB.

const VP_VFR_REF_FINE_TRIM_FT_DE = {
    // Leichte sektorbezogene Referenz-Feinjustierung aus Drift-Beobachtungen.
    '00': -180, '01': -180, '02': -140, '03': -120, '04': -120, '05': -110, '06': -100, '07': -80, '09': -80, '11': -100, '12': -110,
    '14': 120, '33': 220, '35': 200, '37': 220, '38': 200, '41': 180, '44': 160
};

function vpComputeVfrIndexScoreFromParts(parts = {}) {
    let score = 100;
    const low = Number(parts.cloudLow || 0);
    const mid = Number(parts.cloudMid || 0);
    const cloud = Math.max(low, mid);
    const precip = Number(parts.precipitation || parts.rain || 0);
    const snow = Number(parts.snow || 0);
    const wind = Number(parts.wind || 0);
    const vis = Number(parts.visibility || 0);
    const wx = Number(parts.weatherCode);

    if (cloud > 90) score -= 42;
    else if (cloud > 75) score -= 32;
    else if (cloud > 60) score -= 20;
    else if (cloud > 45) score -= 10;

    if (precip > 2.5) score -= 34;
    else if (precip > 1.2) score -= 22;
    else if (precip > 0.5) score -= 12;
    else if (precip > 0.2) score -= 6;

    if (snow > 0.1) score -= 30;
    if (wind > 35) score -= 30;
    else if (wind > 25) score -= 20;
    else if (wind > 18) score -= 10;
    if (vis > 0 && vis < 3000) score -= 36;
    else if (vis > 0 && vis < 5000) score -= 24;
    else if (vis > 0 && vis < 8000) score -= 12;
    if (wx === 45 || wx === 48) score -= 22;
    if (wx === 95 || wx === 96 || wx === 99) score -= 30;
    if (wx === 65 || wx === 67 || wx === 75 || wx === 82 || wx === 86) score -= 16;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function vpInternalMajorRank(code) {
    const c = String(code || '').toUpperCase();
    const rank = { C: 0, O: 1, D: 2, M: 3, X: 4 };
    return Object.prototype.hasOwnProperty.call(rank, c) ? rank[c] : 2;
}

function vpInternalMajorFromScore(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return 'D';
    if (s >= 90) return 'C';
    if (s >= 74) return 'O';
    if (s >= 58) return 'D';
    if (s >= 38) return 'M';
    return 'X';
}

function vpInternalMajorFromVisKm(visKm) {
    const v = Number(visKm);
    if (!Number.isFinite(v)) return null;
    if (v < 1.5) return 'X';
    if (v < 5) return 'M';
    if (v < 8) return 'D';
    if (v < 10) return 'O';
    return 'C';
}

function vpInternalMajorFromCeilingFt(ceilingFt) {
    const c = Number(ceilingFt);
    if (!Number.isFinite(c)) return null;
    if (c < 500) return 'X';
    if (c < 1000) return 'M';
    if (c < 2000) return 'D';
    if (c < 5000) return 'O';
    return 'C';
}

function vpInternalMajorFromMetarFlightCat(fltCat) {
    const cat = String(fltCat || '').trim().toUpperCase();
    if (cat === 'LIFR') return 'X';
    if (cat === 'IFR') return 'M';
    if (cat === 'MVFR') return 'D';
    if (cat === 'VFR') return 'O';
    return null;
}

function vpWorstInternalMajor(majors = []) {
    let out = null;
    (Array.isArray(majors) ? majors : [majors]).forEach((m) => {
        const code = String(m || '').toUpperCase();
        if (!['C', 'O', 'D', 'M', 'X'].includes(code)) return;
        if (!out || vpInternalMajorRank(code) > vpInternalMajorRank(out)) out = code;
    });
    return out;
}

function vpInternalMajorFromRank(rank) {
    const r = Math.max(0, Math.min(4, Number(rank) || 0));
    const codes = ['C', 'O', 'D', 'M', 'X'];
    return codes[r] || 'D';
}

function vpHasReliableMosmixN05(parts = {}, visKm = null, precipMm = 0, wxCandidates = [], lowCoverPct = null) {
    const n05 = Number(parts.mosmixN05Pct);
    if (!Number.isFinite(n05)) return false;
    const stationDistKm = Number(parts.mosmixStationDistKm);
    const nearStation = !Number.isFinite(stationDistKm) || stationDistKm <= 32;
    if (n05 >= 82.5 && nearStation) return true;
    const wxSupportCodes = new Set([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99]);
    const wxSupport = Array.isArray(wxCandidates) && wxCandidates.some(c => wxSupportCodes.has(Number(c)));
    const support = (Number.isFinite(visKm) && visKm <= 8)
        || (Number.isFinite(precipMm) && precipMm >= 0.2)
        || wxSupport
        || (Number.isFinite(lowCoverPct) && lowCoverPct >= 75);
    return n05 >= 62.5 && nearStation && support;
}

function vpEstimateCloudBaseFtFromTempDew(parts = {}) {
    const tempC = Number(parts.temp2mC);
    const dewC = Number(parts.dewPoint2mC);
    if (!Number.isFinite(tempC) || !Number.isFinite(dewC)) return null;
    // Nutzer-Formel: (T - Td) * 400 ft AGL (vereinfachte Annaeherung).
    const spreadC = Math.max(0, tempC - dewC);
    const windKtRaw = Number(parts.wind);
    const windKt = Number.isFinite(windKtRaw) ? Math.max(0, Math.min(30, windKtRaw)) : 0;
    const rh = Number(parts.rh2mPct);
    const ref = Number(parts.sectorRefFt);

    // Dynamische Abschwaechung: bei mehr Wind wird die rein statische
    // T/Td-Basis weniger streng (Mischung/Advektion), besonders im Flachland.
    const windBoostRaw = 1 + (windKt / 30) * 0.85; // 1.00 .. 1.85
    let windBoost = windBoostRaw;
    if (Number.isFinite(rh)) {
        if (rh >= 97) windBoost -= 0.22;
        else if (rh >= 93) windBoost -= 0.12;
        else if (rh >= 88) windBoost -= 0.06;
    }
    if (Number.isFinite(ref) && ref <= 900) windBoost += 0.08;
    windBoost = Math.max(1.0, Math.min(1.9, windBoost));

    // Bei kleinem Spread greift die Wind-Abschwaechung staerker.
    const spreadWeight = spreadC <= 2.5 ? 1.0 : (spreadC <= 4.0 ? 0.65 : 0.35);
    const effBoost = 1 + ((windBoost - 1) * spreadWeight);
    return spreadC * 400 * effBoost;
}

function vpResolveCloudBaseFtAgl(parts = {}) {
    const cloudBaseMRaw = Number(parts.cloudBaseM);
    const cloudBaseFtAgl = (Number.isFinite(cloudBaseMRaw) && cloudBaseMRaw > 0) ? (cloudBaseMRaw * 3.28084) : null;
    if (Number.isFinite(cloudBaseFtAgl)) return { valueFt: cloudBaseFtAgl, source: 'openmeteo_cloud_base' };
    const tdDerived = vpEstimateCloudBaseFtFromTempDew(parts);
    if (Number.isFinite(tdDerived)) return { valueFt: tdDerived, source: 'temp_dew_spread' };
    return { valueFt: null, source: null };
}

function vpEstimateFogRiskMajor(parts = {}, visKm = null) {
    const wxCandidates = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
    if (wxCandidates.some(c => c === 45 || c === 48)) return { major: 'M', reason: 'Nebelcode' };

    const tempC = Number(parts.temp2mC);
    const dewC = Number(parts.dewPoint2mC);
    const spreadC = (Number.isFinite(tempC) && Number.isFinite(dewC)) ? Math.max(0, tempC - dewC) : null;
    const rh = Number(parts.rh2mPct);
    const windKt = Number(parts.wind);
    const pressure = Number(parts.mslPressureHpa);

    if (!Number.isFinite(spreadC) && !Number.isFinite(rh)) return { major: null, reason: '' };
    if (Number.isFinite(visKm) && visKm > 6) return { major: null, reason: '' };
    // Kein Nebel-Proxy ohne echte Feuchte-Indizien.
    if (!(Number.isFinite(spreadC) && spreadC <= 2.5) && !(Number.isFinite(rh) && rh >= 90)) return { major: null, reason: '' };

    let score = 0;
    if (Number.isFinite(spreadC)) {
        if (spreadC <= 0.8) score += 3;
        else if (spreadC <= 1.5) score += 2;
        else if (spreadC <= 2.5) score += 1;
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

    if (score >= 8 && Number.isFinite(visKm) && visKm <= 1.5) return { major: 'M', reason: 'Nebelrisiko hoch' };
    if (score >= 7 && Number.isFinite(visKm) && visKm <= 4) return { major: 'D', reason: 'Nebelrisiko' };
    return { major: null, reason: '' };
}

function vpMapVfrCategory(score) {
    const major = vpInternalMajorFromScore(score);
    const labels = {
        C: { key: 'vfr_c', label: 'VFR-Index C (intern)', color: '#6aaeff', letter: 'C', code: 'C' },
        O: { key: 'vfr_o', label: 'VFR-Index O (intern)', color: '#8ecb4b', letter: 'O', code: 'O' },
        D: { key: 'vfr_d', label: 'VFR-Index D (intern)', color: '#e0c93b', letter: 'D', code: 'D' },
        M: { key: 'vfr_m', label: 'VFR-Index M (intern)', color: '#e08a3b', letter: 'M', code: 'M' },
        X: { key: 'vfr_x', label: 'VFR-Index X (intern)', color: '#d14a4a', letter: 'X', code: 'X' }
    };
    const cat = labels[major] || labels.D;
    return { ...cat, displayCode: cat.code };
}

function vpClassifyInternalVfr(parts = {}) {
    const score = vpComputeVfrIndexScoreFromParts(parts);
    const scoreMajor = vpInternalMajorFromScore(score);

    const mosmixVisibilityM = Number(parts.mosmixVisibilityM);
    const visMRaw = Number.isFinite(mosmixVisibilityM) && mosmixVisibilityM > 0
        ? mosmixVisibilityM
        : Number(parts.visibility);
    const visKm = (Number.isFinite(visMRaw) && visMRaw > 0) ? (visMRaw / 1000) : null;

    const cloudBaseResolved = vpResolveCloudBaseFtAgl(parts);
    const cloudBaseFtAgl = Number(cloudBaseResolved.valueFt);
    const cloudBaseSource = cloudBaseResolved.source;
    const sectorRefFtRaw = Number(parts.sectorRefFt);
    const sectorRefFt = vpAdjustedSectorRefFt(parts);
    const terrainPointFt = Number(parts.terrainPointFt);
    const cloudLow = Number(parts.cloudLow || 0);
    const cloudMid = Number(parts.cloudMid || 0);
    const cloudTotal = Number(parts.cloudTotal || 0);
    const mosmixN05Pct = Number(parts.mosmixN05Pct);
    const mosmixLowCloudPct = Number(parts.mosmixLowCloudPct);
    const coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
    const lowCoverForCeiling = Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : cloudLow;
    const wxForN05 = [Number(parts.weatherCode), Number(parts.mosmixWeatherCode)].filter(Number.isFinite);
    const precipForN05 = Math.max(
        0,
        Number(parts.precipitation || parts.rain || 0),
        Number(parts.mosmixPrecipitationMm || 0)
    );
    const mosmixHasBknBelow500 = vpHasReliableMosmixN05(parts, visKm, precipForN05, wxForN05, lowCoverForCeiling);
    const fogRisk = vpEstimateFogRiskMajor(parts, visKm);
    const hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;
    const hasDenseLowWithoutBase = Number.isFinite(lowCoverForCeiling)
        && lowCoverForCeiling >= 75
        && !Number.isFinite(cloudBaseFtAgl)
        && !mosmixHasBknBelow500;
    let cloudAboveRefFt = cloudBaseFtAgl;
    if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
        cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
    }

    const visMajor = vpInternalMajorFromVisKm(visKm);
    const cloudMajor = mosmixHasBknBelow500
        ? 'X'
        : (hasCeilingCondition ? vpInternalMajorFromCeilingFt(cloudAboveRefFt) : null);

    let wxMajor = null;
    const wx = Number(parts.weatherCode);
    const precip = Number(parts.precipitation || parts.rain || 0);
    const snow = Number(parts.snow || 0);
    const wind = Number(parts.wind || 0);
    if (wx === 95 || wx === 96 || wx === 99) wxMajor = vpWorstInternalMajor([wxMajor, 'X']);
    if (wx === 45 || wx === 48) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
    if ([65, 67, 75, 82, 86].includes(wx)) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
    if (precip > 2.5 || snow > 0.2) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
    else if (precip > 1.2 || snow > 0.05) wxMajor = vpWorstInternalMajor([wxMajor, 'D']);
    if (wind > 35) wxMajor = vpWorstInternalMajor([wxMajor, 'M']);
    else if (wind > 25) wxMajor = vpWorstInternalMajor([wxMajor, 'D']);
    if (fogRisk && fogRisk.major) wxMajor = vpWorstInternalMajor([wxMajor, fogRisk.major]);

    const metarFlightCat = String(parts.metarFlightCat || '').trim().toUpperCase();
    const metarByCat = vpInternalMajorFromMetarFlightCat(metarFlightCat);
    const metarVisibilityM = Number(parts.metarVisibilityM);
    const metarByVis = (Number.isFinite(metarVisibilityM) && metarVisibilityM > 0)
        ? vpInternalMajorFromVisKm(metarVisibilityM / 1000)
        : null;
    const metarByCeiling = vpInternalMajorFromCeilingFt(parts.metarCeilingFtAgl);
    const metarMajor = vpWorstInternalMajor([metarByCat, metarByVis, metarByCeiling]);

    const baseMajor = vpWorstInternalMajor([visMajor, cloudMajor, wxMajor, scoreMajor]) || scoreMajor || 'D';
    let major = baseMajor;
    // METAR nur als konservative Korrektur, aber maximal eine Klasse strenger,
    // damit ein entfernter/zeitversetzter Report das Modell nicht komplett ueberfaehrt.
    if (metarMajor) {
        const baseRank = vpInternalMajorRank(baseMajor);
        const metarRank = vpInternalMajorRank(metarMajor);
        const boundedRank = Math.min(metarRank, Math.min(4, baseRank + 1));
        major = vpWorstInternalMajor([baseMajor, vpInternalMajorFromRank(boundedRank)]) || baseMajor;
    }
    if (hasDenseLowWithoutBase) major = vpWorstInternalMajor([major, 'D']) || 'D';
    const baseCat = vpMapVfrCategory(score);
    const cat = { ...baseCat, code: major, letter: major, displayCode: major };
    const labels = {
        C: 'VFR-Index C (intern)',
        O: 'VFR-Index O (intern)',
        D: 'VFR-Index D (intern)',
        M: 'VFR-Index M (intern)',
        X: 'VFR-Index X (intern)'
    };
    cat.label = labels[major] || labels.D;
    cat.key = `vfr_${String(major || 'd').toLowerCase()}`;
    cat.color = (vpMapVfrCategory(major === 'C' ? 95 : major === 'O' ? 80 : major === 'D' ? 62 : major === 'M' ? 45 : 20).color || cat.color);

    let dataQuality = 'valid';
    if (!Number.isFinite(visKm) && !Number.isFinite(cloudAboveRefFt) && !mosmixHasBknBelow500 && !metarMajor) {
        dataQuality = hasDenseLowWithoutBase || wxMajor ? 'estimated' : 'fallback';
    } else if (hasDenseLowWithoutBase) {
        dataQuality = 'estimated';
    }
    return {
        ...cat,
        score: Math.round(score),
        mode: 'internal',
        dataQuality,
        dataWarning: hasDenseLowWithoutBase
            ? 'Wolkenbasis fehlt trotz dichter Low-Bewoelkung; Einstufung konservativ abgesichert.'
            : (cloudBaseSource === 'temp_dew_spread'
                ? 'Wolkenbasis aus Temperatur/Taupunkt geschaetzt.'
                : (fogRisk && fogRisk.reason ? fogRisk.reason : '')),
        visKm: Number.isFinite(visKm) ? visKm : null,
        cloudBaseFtAgl: Number.isFinite(cloudBaseFtAgl) ? cloudBaseFtAgl : null,
        cloudAboveRefFt: Number.isFinite(cloudAboveRefFt) ? cloudAboveRefFt : null,
        cloudBaseSource: cloudBaseSource || null,
        sectorRefFtRaw: Number.isFinite(sectorRefFtRaw) ? sectorRefFtRaw : null,
        sectorRefTrimFt: vpRefFineTrimFt(parts),
        metarFlightCat: metarFlightCat || null,
        metarStation: parts.metarStation ? String(parts.metarStation) : null,
        metarDistKm: Number.isFinite(Number(parts.metarDistKm)) ? Number(parts.metarDistKm) : null
    };
}

function vpRefFineTrimFt(parts = {}) {
    const country = String((parts && parts.countryCode) || (window.vpVfrIndexState && window.vpVfrIndexState.country) || '').toUpperCase();
    if (country !== 'DE') return 0;
    const sidRaw = String(parts && parts.sectorId || '').trim();
    const sid = sidRaw ? sidRaw.padStart(2, '0') : '';
    let trim = Number(VP_VFR_REF_FINE_TRIM_FT_DE[sid] || 0);

    // Dynamischer Mikro-Trim: nur kleine Korrektur fuer feuchte Flachland-/trockene Hochlagen.
    const ref = Number(parts && parts.sectorRefFt);
    const tempC = Number(parts && parts.temp2mC);
    const dewC = Number(parts && parts.dewPoint2mC);
    const rh = Number(parts && parts.rh2mPct);
    const spread = (Number.isFinite(tempC) && Number.isFinite(dewC)) ? Math.max(0, tempC - dewC) : null;
    if (Number.isFinite(ref) && ref <= 1200 && Number.isFinite(rh) && Number.isFinite(spread) && rh >= 93 && spread <= 1.5) {
        trim += 80;
    }
    if (Number.isFinite(ref) && ref >= 2200 && Number.isFinite(rh) && Number.isFinite(spread) && rh <= 55 && spread >= 4.0) {
        trim -= 80;
    }
    return Math.max(-300, Math.min(300, trim));
}

function vpAdjustedSectorRefFt(parts = {}) {
    const ref = Number(parts && parts.sectorRefFt);
    if (!Number.isFinite(ref)) return ref;
    return ref + vpRefFineTrimFt(parts);
}

function vpSampleToParts(sample = {}) {
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

let wxCloudFieldSvgSeq = 0;

const WX_WEATHER_DOMAIN_ROUTE_NM = 50;

const WX_WEATHER_DOMAIN_GPS_NM = 50;

const WX_GRID_SPACING_SCALE = 1.5;

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
}

function mixChannel(a, b, t) {
    return Math.round(a + (b - a) * clamp01(t));
}

function windBarbStyleFromSpeed(speedKt) {
    const t = clamp01(speedKt / 42);
    const r = mixChannel(168, 26, t);
    const g = mixChannel(214, 120, t);
    const b = mixChannel(255, 255, t);
    const alpha = 0.86 + 0.14 * t;
    const shadow = 0.62 + 0.28 * t;
    const strokeWidth = 2.2 + 1.2 * t;
    return {
        stroke: `rgba(${r},${g},${b},${alpha.toFixed(3)})`,
        fill: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.12).toFixed(3)})`,
        core: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.2).toFixed(3)})`,
        shadow: shadow.toFixed(3),
        strokeWidth: strokeWidth.toFixed(2)
    };
}

function buildWindBarbIcon(directionDeg, speedKt) {
    const dirFrom = Number.isFinite(directionDeg) ? directionDeg : 0;
    // Open-Meteo liefert "coming from"; auf der Karte zeigen wir die Bewegungsrichtung (to).
    const renderDir = (dirFrom + 180) % 360;
    const speed = Math.max(0, Number.isFinite(speedKt) ? speedKt : 0);
    const style = windBarbStyleFromSpeed(speed);
    let rem = Math.round(speed / 5) * 5;
    let y = 20.4;
    let feathers = '';
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

    const svg = `
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
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    if (v < 34) return 0; // leer
    if (v < 67) return 1; // halb
    return 2;             // voll
}

function cloudBandOpacity(level) {
    if (level <= 0) return 0;
    if (level === 1) return 0.42;
    return 0.86;
}

function createCloudFieldMarker(lat, lon, lowPct, midPct, highPct, sizePx) {
    const highLevel = cloudBandFillLevel(highPct);
    const midLevel = cloudBandFillLevel(midPct);
    const lowLevel = cloudBandFillLevel(lowPct);
    const anyFill = (highLevel + midLevel + lowLevel) > 0;
    if (!anyFill) return null;

    const topA = cloudBandOpacity(highLevel).toFixed(3);
    const midA = cloudBandOpacity(midLevel).toFixed(3);
    const lowA = cloudBandOpacity(lowLevel).toFixed(3);
    const id = `wx-cloud-clip-${(++wxCloudFieldSvgSeq)}`;
    const size = Math.max(40, Math.min(72, Math.round(sizePx)));

    const svg = `
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

    const icon = L.divIcon({
        className: 'wx-cloudfield-icon',
        html: `<div style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.58));">${svg}</div>`,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)]
    });
    return L.marker([lat, lon], { icon, interactive: false, keyboard: false, opacity: 0.98 });
}

function pickWeatherGridStep(spanDeg, targetLines) {
    const raw = Math.max(0.02, spanDeg / Math.max(2, targetLines - 1));
    const steps = [0.02, 0.03, 0.05, 0.075, 0.1, 0.125, 0.2, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
    for (const s of steps) {
        if (raw <= s) return s;
    }
    return Math.ceil(raw / 5) * 5;
}

function normalizeLon180(lon) {
    let x = lon;
    while (x > 180) x -= 360;
    while (x <= -180) x += 360;
    return x;
}

function nmToLatDeg(nm) {
    return Number(nm || 0) / 60;
}

function nmToLonDegAtLat(nm, latDeg) {
    const cosLat = Math.max(0.2, Math.abs(Math.cos((Number(latDeg || 0) * Math.PI) / 180)));
    return Number(nm || 0) / (60 * cosLat);
}

function buildRouteWeatherBounds() {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const wp of routeWaypoints) {
        const lat = Number(wp && wp.lat);
        const lon = Number(wp && (wp.lng ?? wp.lon));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
    const midLat = (minLat + maxLat) * 0.5;
    const padLatDeg = nmToLatDeg(WX_WEATHER_DOMAIN_ROUTE_NM);
    const padLonDeg = nmToLonDegAtLat(WX_WEATHER_DOMAIN_ROUTE_NM, midLat);
    return {
        minLat: Math.max(-89.5, minLat - padLatDeg),
        maxLat: Math.min(89.5, maxLat + padLatDeg),
        minLon: normalizeLon180(minLon - padLonDeg),
        maxLon: normalizeLon180(maxLon + padLonDeg),
        wrapsDateline: (minLon - padLonDeg) < -180 || (maxLon + padLonDeg) > 180
    };
}

function pointInsideBounds(lat, lon, b) {
    if (!b) return false;
    const latOk = lat >= b.minLat && lat <= b.maxLat;
    if (!latOk) return false;
    if (!b.wrapsDateline) return lon >= b.minLon && lon <= b.maxLon;
    return lon >= b.minLon || lon <= b.maxLon;
}

function filterWeatherPointsByActiveDomain(points) {
    if (!Array.isArray(points) || points.length === 0) return points;
    const routeBounds = buildRouteWeatherBounds();
    const gps = window.lastLiveGpsPos;
    const hasRecentGps = !!(gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon) && Number.isFinite(gps.t) && (Date.now() - gps.t < 15 * 60 * 1000));
    const gpsLatPad = hasRecentGps ? nmToLatDeg(WX_WEATHER_DOMAIN_GPS_NM) : 0;
    const gpsLonPad = hasRecentGps ? nmToLonDegAtLat(WX_WEATHER_DOMAIN_GPS_NM, gps.lat) : 0;
    const gpsLatMin = hasRecentGps ? Math.max(-89.5, gps.lat - gpsLatPad) : 0;
    const gpsLatMax = hasRecentGps ? Math.min(89.5, gps.lat + gpsLatPad) : 0;
    const gpsLonMin = hasRecentGps ? normalizeLon180(gps.lon - gpsLonPad) : 0;
    const gpsLonMax = hasRecentGps ? normalizeLon180(gps.lon + gpsLonPad) : 0;
    const gpsWrap = hasRecentGps ? ((gps.lon - gpsLonPad) < -180 || (gps.lon + gpsLonPad) > 180) : false;

    if (!routeBounds && !hasRecentGps) return points;
    const filtered = points.filter(p => {
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

function getMapWeatherGridPoints(cols = 8, rows = 6) {
    if (!map) return { points: [], key: '' };
    const b = map.getBounds();
    if (!b || !b.isValid()) return { points: [], key: '' };
    const north = b.getNorth();
    const south = b.getSouth();
    const west = b.getWest();
    const east = b.getEast();

    const latSpan = Math.max(0.05, Math.abs(north - south));
    let lonSpan = east - west;
    if (lonSpan < 0) lonSpan += 360;
    lonSpan = Math.max(0.05, lonSpan);

    const latStep = pickWeatherGridStep(latSpan, rows) * WX_GRID_SPACING_SCALE;
    const lonStep = pickWeatherGridStep(lonSpan, cols) * WX_GRID_SPACING_SCALE;
    const latStart = Math.floor(south / latStep) * latStep;
    const latEnd = Math.ceil(north / latStep) * latStep;

    const westN = ((west % 360) + 360) % 360;
    const eastN = westN + lonSpan;
    const lonStart = Math.floor(westN / lonStep) * lonStep;
    const lonEnd = Math.ceil(eastN / lonStep) * lonStep;

    const pts = [];
    for (let lat = latStart; lat <= latEnd + (latStep * 0.25); lat += latStep) {
        const clampedLat = Math.max(-89.5, Math.min(89.5, lat));
        for (let lon = lonStart; lon <= lonEnd + (lonStep * 0.25); lon += lonStep) {
            pts.push({
                lat: Math.round(clampedLat * 1e5) / 1e5,
                lon: Math.round(normalizeLon180(lon) * 1e5) / 1e5
            });
        }
    }
    const filteredPts = filterWeatherPointsByActiveDomain(pts);
    const maxPoints = 48;
    const reducedPts = filteredPts.length > maxPoints
        ? filteredPts.filter((_, idx) => (idx % Math.ceil(filteredPts.length / maxPoints)) === 0).slice(0, maxPoints)
        : filteredPts;
    return {
        points: reducedPts,
        latStep,
        lonStep,
        key: [
            latStep.toFixed(3),
            lonStep.toFixed(3),
            latStart.toFixed(3),
            latEnd.toFixed(3),
            lonStart.toFixed(3),
            lonEnd.toFixed(3),
            reducedPts.length
        ].join('|')
    };
}
