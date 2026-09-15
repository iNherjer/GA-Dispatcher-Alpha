// Frozen App actions before Tracker intent migration. Do not regenerate.
function _poiMissionStatusAction() {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Das ist keine POI-Mission. Fuer diesen Flug ist eher Wohlbefinden, Ladung oder Wetter relevant.', 'Missionsstatus');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternStatusText(ctx), 'Missionsstatus');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainStatusText(ctx), 'Missionsstatus');
        return;
    }
    const facts = _missionStatusFacts(ctx);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach dem aktuellen Missionsstatus.
Live-Fakten: ${facts}
Antworte als Passagier/Rollenperson dynamisch zum Kontext: Anflug, Datenaufnahme, Hoehenkorrektur, Abschluss oder Rueckflug. Wenn die Hoehe deutlich nicht passt, darfst du freundlich hoeher/tiefer bitten. Keine internen Variablennamen. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = _poiSatisfied
        ? 'Mission ist abgeschlossen, ich habe alles. Wir koennen zurueck beziehungsweise weiter zum Platz.'
        : `${_missionVectorText(ctx)} ${_poiInRadius ? 'Datenaufnahme laeuft, halte den Flug ruhig und stabil.' : 'Wir sind noch im Anflug, ich melde mich am Ziel.'}`;
    _missionActionSpeak(prompt, 'Missionsstatus', fallback);
}

function _poiMissionOrientationAction(_cityRetry = false) {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Orientierungshilfe ist aktuell nur fuer POI-Ziele sinnvoll.', 'Orientierung');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternOrientationText(ctx), 'Orientierung');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainOrientationText(ctx), 'Orientierung');
        return;
    }
    if (!_cityRetry && !_paxCityDatasetAvailable() && typeof loadGlobalCities === 'function') {
        loadGlobalCities().finally(() => window.paxMissionOrientationHelp(true));
        return;
    }
    const base = _baseContext();
    const vector = _missionVectorText(ctx);
    const factLine = _missionOrientationFactLine(ctx);
    const prompt = base ? `${base}

Button-Frage: Der Pilot bittet um Orientierungshilfe zum POI.
Pflichtdaten: ${vector}
Ziel: ${ctx.targetName}
${factLine || 'Keine bestaetigte Landmarke verfuegbar; beschreibe das Ziel anhand Auftrag, Zielname und Umgebung nur vorsichtig.'}
Orientierungsregel: Wenn die Entfernung groesser als 6 NM ist, nenne nach Steuerkurs/Entfernung zuerst den groben Kartenbezug zu Ort/Region. Danach darf genau ein lokaler Nahbereichs-Hinweis kommen, wenn er bestaetigt ist. Lokale Felsen, Bachnamen, Wege oder Aussichtspunkte nicht als primaere Orientierung verwenden, ausser wir sind im Nahbereich oder sie sind das Ziel selbst.
Antworte zuerst mit Steuerkurs und Entfernung in ganzen NM, danach eine kurze Zielbeschreibung oder Landmarkenhilfe. Keine langen Stories, keine erfundenen Landmarken. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = factLine && /^GROBER KARTENBEZUG:/i.test(factLine)
        ? `${vector} ${factLine.split('\n')[0].replace(/^GROBER KARTENBEZUG:\s*/i, '').replace(/\s*Nutze diesen Ort.*$/i, '')}`
        : `${vector} Ziel ist ${ctx.targetName}; nutze die naechste markante Struktur im Zielgebiet als Bezug und halte weiter Ausschau.`;
    _missionActionSpeak(prompt, 'Orientierung', fallback);
}

function _missionActionContext(flightData = null) {
    const md = _activeMissionData();
    const dest = _getDestCoords();
    const pos = window.lastLiveGpsPos || {};
    const fd = flightData || window.lastLiveFlightData || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const targetName = md.poiName || md.targetName || md.dest || 'Ziel';
    const out = {
        md,
        fd,
        targetName,
        dest,
        hasPosition: false,
        mslFt: Number.isFinite(Number(fd.mslFt ?? pos.alt ?? fd.alt)) ? Math.round(Number(fd.mslFt ?? pos.alt ?? fd.alt)) : null,
        aglFt: Number.isFinite(Number(fd.aglFt)) ? Math.round(Number(fd.aglFt)) : null
    };
    if (!dest || !Number.isFinite(lat) || !Number.isFinite(lon)) return out;
    const distNm = _haversineNm(lat, lon, dest.lat, dest.lon);
    const bearingDeg = _bearingDeg(lat, lon, dest.lat, dest.lon);
    const hdg = Number(fd.hdg || fd.heading || fd.trackDeg || fd.trkDeg || pos.hdg || bearingDeg);
    return {
        ...out,
        hasPosition: true,
        lat,
        lon,
        distNm,
        roundedDistNm: Math.max(0, Math.round(distNm)),
        bearingDeg,
        roundedBearingDeg: Math.round((((bearingDeg % 360) + 360) % 360)),
        clockPos: _relativeClockPos(bearingDeg, hdg),
        hdg
    };
}

function _missionVectorText(ctx) {
    if (!ctx?.hasPosition) return 'Mir fehlen gerade Live-Positionsdaten vom Tracker.';
    const nm = ctx.roundedDistNm <= 0 ? 'unter 1 NM' : `${ctx.roundedDistNm} NM`;
    return `Steuerkurs ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Entfernung ${nm}.`;
}

function _missionStatusFacts(ctx) {
    const pax = window.activePassenger || {};
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        const progress = typeof window.missionSarHeliProgressSnapshot === 'function' ? window.missionSarHeliProgressSnapshot() : null;
        const parts = [];
        if (ctx?.hasPosition) parts.push(`Distanz zur Fundstelle ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
        if (progress?.patientLoaded) parts.push(`Status: Patient aufgenommen, Ziel ${_sarHeliHospitalName()}`);
        else if (progress?.targetConfirmed) parts.push(`Status: Fund bestätigt, Bergung läuft, Position ruhig halten`);
        else parts.push('Status: Such-/Fundphase, Fundmeldung oder Auto-Markierung offen');
        const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
        if (wx) parts.push(wx);
        return parts.join(' | ');
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        const survey = _surveyPatternProgressSummary(ctx);
        if (survey) return survey;
    }
    const chainSummary = _poiChainProgressSummary(ctx);
    if (chainSummary) return chainSummary;
    const radius = Number(pax.targetRadiusNm || 1.5) || 1.5;
    const targetAlt = Number(pax.targetAltFt || 0);
    const dwellReq = Number(pax.targetDwellMin || 0) * 60;
    const dwell = Math.max(0, Math.round(_poiDwellSec || 0));
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Lage ${ctx.clockPos}`);
    if (_poiSatisfied) parts.push('Status: POI-Aufgabe abgeschlossen, Rueckflug/Weiterflug freigegeben');
    else if (_poiAborted) parts.push('Status: abgebrochen, Rueckflug sinnvoll');
    else if (_poiInRadius) parts.push(`Status: im Zielradius (${radius.toFixed(1)} NM), Datenaufnahme laeuft`);
    else parts.push('Status: noch im Anflug zum Zielgebiet');
    if (dwellReq > 0) parts.push(`Verweilzeit ${dwell}/${Math.round(dwellReq)} Sekunden`);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = ctx.mslFt - targetAlt;
        if (Math.abs(diff) <= 150) parts.push(`Hoehe passt: ${ctx.mslFt} ft MSL bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
    if (wx) parts.push(wx);
    return parts.join(' | ');
}

function _missionOrientationFactLine(ctx = null) {
    const mapPlace = _paxMapPlaceOrientationLine();
    if (mapPlace && (!ctx?.hasPosition || Number(ctx.distNm) > 6)) {
        const near = _paxNearLandmarkOrientationLine();
        return [mapPlace, near].filter(Boolean).join('\n');
    }
    const near = _paxNearLandmarkOrientationLine();
    if (near) return near;
    if (mapPlace) return mapPlace;
    return '';
}

function _weatherContext(fd) {
    if (!fd) return '';
    const parts = [];
    if (fd.windKts != null) {
        const desc = fd.windKts > 20 ? ' (kräftig)' : fd.windKts > 10 ? ' (mäßig)' : ' (schwach)';
        parts.push(`Wind ${fd.windKts} kts aus ${fd.windDeg ?? '?'}°${desc}`);
    }
    if (fd.windGustKts != null && fd.windKts != null) {
        const spread = Math.max(0, Number(fd.windGustKts) - Number(fd.windKts));
        if (spread >= 4) parts.push(`Böen bis ${fd.windGustKts} kts`);
    } else if (fd.windGustKts != null) {
        parts.push(`Böen bis ${fd.windGustKts} kts`);
    }
    if (fd.tempC   != null) parts.push(`${fd.tempC}°C`);
    if (fd.visKm   != null) {
        const desc = fd.visKm < 3 ? ' (sehr schlecht)' : fd.visKm < 8 ? ' (eingeschränkt)' : fd.visKm > 20 ? ' (ausgezeichnet)' : '';
        parts.push(`Sicht ${fd.visKm} km${desc}`);
    }
    if (fd.precipRateMmH != null) {
        const p = Number(fd.precipRateMmH);
        const state = p >= 4 ? 'stark' : p >= 1.5 ? 'mäßig' : p > 0.05 ? 'leicht' : '';
        if (state) parts.push(`Niederschlag ${state}`);
    } else if (fd.precipActive === true) {
        parts.push('Niederschlag');
    }
    if (fd.inCloud === true) parts.push('in Wolken');
    if (fd.turbulencePct != null) {
        const t = Number(fd.turbulencePct);
        if (t >= 60) parts.push('Turbulenz stark');
        else if (t >= 35) parts.push('Turbulenz spürbar');
    }
    return parts.length ? `Wetter: ${parts.join(', ')}.` : '';
}

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _bearingDeg(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function _relativeClockPos(targetBearingDeg, headingDeg) {
    if (!Number.isFinite(targetBearingDeg) || !Number.isFinite(headingDeg)) return '12 Uhr';
    const rel = (targetBearingDeg - headingDeg + 360) % 360;
    const hour = Math.round(rel / 30) || 12;
    return `${hour > 12 ? hour - 12 : hour} Uhr`;
}
