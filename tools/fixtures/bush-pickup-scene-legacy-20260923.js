'use strict';

// Frozen 2026-09-23 copy of the original sync.js command fragment and its
// original geometry dependencies. This file is intentionally independent of
// tools/generate-bush-pickup-scene-core.mjs.
function legacyCalcNav(lat1, lon1, lat2, lon2) {
    const R = 3440, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return { dist, brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) };
}

function legacyWorldPointToRelative(originLat, originLon, originHdgDeg, worldLat, worldLon) {
    const oLat = Number(originLat);
    const oLon = Number(originLon);
    const hdgDeg = Number(originHdgDeg);
    const wLat = Number(worldLat);
    const wLon = Number(worldLon);
    if (![oLat, oLon, hdgDeg, wLat, wLon].every(Number.isFinite)) return null;
    let nav = null;
    try { nav = legacyCalcNav(oLat, oLon, wLat, wLon); } catch (_) {}
    const distNm = Number(nav?.dist);
    const brngDeg = Number(nav?.brng);
    if (!Number.isFinite(distNm) || !Number.isFinite(brngDeg)) return null;
    const distM = distNm * 1852;
    const deltaRad = ((brngDeg - hdgDeg) * Math.PI) / 180;
    return {
        forwardM: Math.cos(deltaRad) * distM,
        rightM: Math.sin(deltaRad) * distM
    };
}

function buildFrozenLegacyCommand(recipe = {}, livePosition = {}) {
    const aptSceneId = recipe.sceneId;
    const personPoint = recipe.personPoint;
    const pos = livePosition || {};
    const hdg = Number(pos.hdg);
    if (!aptSceneId || !personPoint || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon)) || !Number.isFinite(hdg)) return null;
    const personRel = legacyWorldPointToRelative(Number(pos.lat), Number(pos.lon), hdg, personPoint.worldLat, personPoint.worldLon);
    if (!personRel) return null;
    const boardingConfig = recipe.boardingConfig || {};
    const options = { reason: recipe.reason };
    const _missionSceneCommonSceneCommandFields = () => recipe.commonFields || {};
    const spawnPoint = {
        forwardM: Number(personRel.forwardM.toFixed(1)),
        rightM: Number(personRel.rightM.toFixed(1)),
        altOffsetFt: 0
    };
    const joinPoint = boardingConfig.spawn || { forwardM: 16, rightM: -8, altOffsetFt: 0 };
    const targetPoint = boardingConfig.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
    const command = {
        type: 'mission_scene_boarding',
        sceneId: aptSceneId,
        reason: options.reason || 'bush-pickup-boarding',
        ..._missionSceneCommonSceneCommandFields(),
        path: [spawnPoint, joinPoint, targetPoint],
        pathLabels: ['Pickup', 'Join', 'Boarding'],
        spawnPoint,
        targetPoint,
        cargoPathIndex: 1,
        boarderCount: 1,
        passengerCount: 1,
        durationMs: 14000,
        finalHoldMs: 450,
        removePerson: true,
        removeCargoAtWaypoint: false,
        splitCargoRoute: false,
        cargoArrivalSlackMs: 250,
        cargoTimingFactor: 1,
        cargoHoldMs: 0,
        cargoObjectKind: 'cargo',
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg
    };
    return command;
}

module.exports = Object.freeze({ buildFrozenLegacyCommand });
