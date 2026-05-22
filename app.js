/* =========================================================
   GLOBAL HELPERS
   ========================================================= */
if (!document.getElementById('vp-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'vp-pulse-style';
    style.innerHTML = `@keyframes vpPulse { 0% {opacity:1; transform:scale(1);} 50% {opacity:0.4; transform:scale(0.85);} 100% {opacity:1; transform:scale(1);} } .vp-loading-pulse { animation: vpPulse 1.2s infinite; pointer-events: none; }`;
    document.head.appendChild(style);
}

window.formatAsLimit = function(lim) {
    if (!lim) return '?';
    if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
    if (lim.unit === 6) return `FL ${lim.value}`;
    let u = lim.unit === 1 ? 'FT' : 'M';
    let r = lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '');
    return `${lim.value} ${u}${r}`;
};

// V77: Globale Flag – true, solange der Nutzer irgendeinen Slider/Knob berührt
window.vpUIInteractionActive = false;
const MAIN_PERF_SETTING_KEYS = {
    tas: 'ga_perf_tas',
    gph: 'ga_perf_gph',
    alt: 'ga_perf_alt',
    rate: 'ga_perf_rate',
    maxSeats: 'ga_perf_max_seats',
    aircraft: 'ga_perf_aircraft'
};
const AIRCRAFT_PRESET_STORAGE_KEY = 'ga_aircraft_presets_v1';
const AIRCRAFT_PRESET_DEFAULTS = {
    'C172': { name: 'C172', tas: 115, gph: 9, pax: 4 },
    'PA-24': {
        name: 'Comanche',
        tas: 160,
        gph: 14,
        pax: 4,
        boarding: {
            spawn: { forwardM: 18, rightM: -8 },
            cargo: { forwardM: 7, rightM: 3 },
            target: { forwardM: 0.5, rightM: 1.5 },
            waypoints: [{ forwardM: 4, rightM: 3.5, beforeCargo: false }]
        }
    },
    'AERO': { name: 'Aerostar', tas: 220, gph: 25, pax: 6 }
};
const AIRCRAFT_BOARDING_DEFAULT = {
    spawn: { forwardM: 16, rightM: -8 },
    cargo: { forwardM: 4, rightM: 4 },
    target: { forwardM: 4.5, rightM: 8.5 },
    waypoints: [],
    walkSpeedKts: 3.1,
    durationMs: 18000,
    openDoor: true
};
const AIRCRAFT_BOARDING_LEGACY_DEFAULT = {
    spawn: { forwardM: 16, rightM: -8 },
    cargo: { forwardM: 4, rightM: 4 },
    target: { forwardM: 4.5, rightM: 8.5 },
    waypoints: []
};
const AIRCRAFT_PRESET_SLOT_ORDER = ['C172', 'PA-24', 'AERO'];
let aircraftPresets = {};
let activeAircraftPresetSettingsSlot = 'C172';
window.activeAircraftPresetSettingsSlot = activeAircraftPresetSettingsSlot;
let activeBoardingPointKey = 'spawn';
let aircraftPresetCloudSyncTimer = null;
const AIRCRAFT_PRESET_SLOT_LABELS = {
    'C172': 'Slot 1',
    'PA-24': 'Slot 2',
    'AERO': 'Slot 3'
};

function sanitizeAircraftPresetName(slotId, value) {
    const fallback = AIRCRAFT_PRESET_DEFAULTS[slotId]?.name || slotId;
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return text ? text.slice(0, 20) : fallback;
}

function clampBoardingOffset(value, fallback = 0) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    n = Math.max(-45, Math.min(45, n));
    return Math.round(n * 2) / 2;
}

function normalizeBoardingPoint(source, fallback) {
    const src = source && typeof source === 'object' ? source : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : { forwardM: 0, rightM: 0 };
    return {
        forwardM: clampBoardingOffset(src.forwardM ?? src.forward ?? src.x, fb.forwardM),
        rightM: clampBoardingOffset(src.rightM ?? src.right ?? src.y, fb.rightM),
        altOffsetFt: clampMainPerfSetting(src.altOffsetFt ?? src.altOffset ?? 0, -20, 20, 1, 0)
    };
}

function normalizeBoardingWaypoint(source, fallback, beforeCargo = false) {
    return {
        ...normalizeBoardingPoint(source, fallback),
        beforeCargo: source && typeof source === 'object' && typeof source.beforeCargo === 'boolean'
            ? source.beforeCargo
            : !!beforeCargo
    };
}

function normalizeAircraftBoardingConfig(source) {
    const src = source && typeof source === 'object' ? source : {};
    const hasExplicitRouteWaypoints = Array.isArray(src.routeWaypoints) || Array.isArray(src.extraWaypoints);
    const legacyWaypointsAsPath = !Array.isArray(src.path)
        && !hasExplicitRouteWaypoints
        && Array.isArray(src.waypoints)
        && src.waypoints.length >= 2
        && !src.cargo;
    const rawPath = Array.isArray(src.path) ? src.path : (legacyWaypointsAsPath ? src.waypoints : null);
    const spawn = normalizeBoardingPoint(src.spawn || src.person || rawPath?.[0], AIRCRAFT_BOARDING_DEFAULT.spawn);
    const cargoFallback = rawPath && rawPath.length >= 3 ? rawPath[1] : AIRCRAFT_BOARDING_DEFAULT.cargo;
    const cargo = normalizeBoardingPoint(src.cargo || cargoFallback, AIRCRAFT_BOARDING_DEFAULT.cargo);
    const targetFallback = rawPath && rawPath.length >= 2 ? rawPath[rawPath.length - 1] : AIRCRAFT_BOARDING_DEFAULT.target;
    const target = normalizeBoardingPoint(src.target || src.boarding || targetFallback, AIRCRAFT_BOARDING_DEFAULT.target);
    const cargoIndexRaw = Number(src.cargoIndex ?? src.cargoPathIndex);
    const rawCargoIndex = rawPath && rawPath.length >= 3 && Number.isFinite(cargoIndexRaw)
        ? Math.max(1, Math.min(rawPath.length - 2, Math.round(cargoIndexRaw)))
        : 1;
    const rawWaypoints = Array.isArray(src.routeWaypoints) ? src.routeWaypoints
        : (Array.isArray(src.extraWaypoints) ? src.extraWaypoints
            : (!legacyWaypointsAsPath && Array.isArray(src.waypoints) ? src.waypoints
                : (rawPath && rawPath.length > 3
                    ? rawPath.slice(1, -1).filter((_, index) => index + 1 !== rawCargoIndex)
                    : [])));
    const waypoints = rawWaypoints
        .slice(0, 8)
        .map((point, index) => {
            const rawPathIndex = rawPath && rawPath.length > 3 ? rawPath.indexOf(point) : -1;
            const beforeCargo = rawPathIndex > 0 ? rawPathIndex < rawCargoIndex : !!point?.beforeCargo;
            return normalizeBoardingWaypoint(point, cargo, beforeCargo || (index === 0 && point?.phase === 'beforeCargo'));
        })
        .filter(point => Number.isFinite(point.forwardM) && Number.isFinite(point.rightM));
    const beforeCargoWaypoints = waypoints.filter(point => point.beforeCargo);
    const afterCargoWaypoints = waypoints.filter(point => !point.beforeCargo);
    const path = [spawn, ...beforeCargoWaypoints, cargo, ...afterCargoWaypoints, target];
    const cargoIndex = Math.max(1, path.length - afterCargoWaypoints.length - 2);
    return {
        spawn,
        cargo,
        target,
        waypoints,
        path,
        cargoIndex,
        walkSpeedKts: Math.max(2.8, Math.min(4, Number(src.walkSpeedKts ?? src.speedKts ?? AIRCRAFT_BOARDING_DEFAULT.walkSpeedKts) || AIRCRAFT_BOARDING_DEFAULT.walkSpeedKts)),
        durationMs: clampMainPerfSetting(src.durationMs ?? AIRCRAFT_BOARDING_DEFAULT.durationMs, 8000, 20000, 500, AIRCRAFT_BOARDING_DEFAULT.durationMs),
        openDoor: src.openDoor !== false
    };
}

function normalizeAircraftPreset(slotId, source) {
    const defaults = AIRCRAFT_PRESET_DEFAULTS[slotId] || AIRCRAFT_PRESET_DEFAULTS['C172'];
    const preset = source && typeof source === 'object' ? source : {};
    let boardingSource = preset.boarding || preset.boardingScene || defaults.boarding;
    if (slotId === 'PA-24' && shouldMigrateComancheBoardingDefaults(boardingSource)) {
        boardingSource = defaults.boarding;
    }
    return {
        name: sanitizeAircraftPresetName(slotId, preset.name ?? defaults.name),
        tas: clampMainPerfSetting(preset.tas, 80, 260, 5, defaults.tas),
        gph: clampMainPerfSetting(preset.gph, 5, 35, 1, defaults.gph),
        pax: clampMainPerfSetting(preset.pax, 1, 6, 1, defaults.pax),
        boarding: normalizeAircraftBoardingConfig(boardingSource)
    };
}

function boardingPointNear(point, expected) {
    const p = normalizeBoardingPoint(point, expected);
    return Math.abs(p.forwardM - expected.forwardM) <= 0.1 && Math.abs(p.rightM - expected.rightM) <= 0.1;
}

function shouldMigrateComancheBoardingDefaults(source) {
    if (!source || typeof source !== 'object') return true;
    if (source.comancheRouteVersion >= 2) return false;
    const cfg = normalizeAircraftBoardingConfig(source);
    const noCustomWaypoints = !Array.isArray(cfg.waypoints) || cfg.waypoints.length === 0;
    return noCustomWaypoints
        && boardingPointNear(cfg.spawn, AIRCRAFT_BOARDING_LEGACY_DEFAULT.spawn)
        && boardingPointNear(cfg.cargo, AIRCRAFT_BOARDING_LEGACY_DEFAULT.cargo)
        && boardingPointNear(cfg.target, AIRCRAFT_BOARDING_LEGACY_DEFAULT.target);
}

function buildDefaultAircraftPresets() {
    const out = {};
    AIRCRAFT_PRESET_SLOT_ORDER.forEach(slotId => {
        out[slotId] = normalizeAircraftPreset(slotId, AIRCRAFT_PRESET_DEFAULTS[slotId]);
    });
    return out;
}

function saveAircraftPresets() {
    try {
        localStorage.setItem(AIRCRAFT_PRESET_STORAGE_KEY, JSON.stringify(aircraftPresets));
    } catch (_) {}
}
window.saveAircraftPresets = saveAircraftPresets;

function loadAircraftPresets() {
    const defaults = buildDefaultAircraftPresets();
    let parsed = {};
    try {
        parsed = JSON.parse(localStorage.getItem(AIRCRAFT_PRESET_STORAGE_KEY) || '{}') || {};
    } catch (_) {
        parsed = {};
    }
    aircraftPresets = {};
    AIRCRAFT_PRESET_SLOT_ORDER.forEach(slotId => {
        aircraftPresets[slotId] = normalizeAircraftPreset(slotId, parsed[slotId] || defaults[slotId]);
    });
    saveAircraftPresets();
}
window.loadAircraftPresets = loadAircraftPresets;

function getAircraftPreset(slotId) {
    const resolvedSlot = AIRCRAFT_PRESET_SLOT_ORDER.includes(slotId) ? slotId : 'C172';
    if (!aircraftPresets[resolvedSlot]) {
        aircraftPresets[resolvedSlot] = normalizeAircraftPreset(resolvedSlot, AIRCRAFT_PRESET_DEFAULTS[resolvedSlot]);
    }
    return aircraftPresets[resolvedSlot];
}

function setAircraftPresetStatus(msg, color = '#888') {
    const el = document.getElementById('aircraftPresetStatus');
    if (!el) return;
    el.innerText = String(msg || '');
    el.style.color = color;
}

function formatBoardingMeters(value) {
    return `${Math.abs(Number(value) || 0).toFixed(1).replace('.', ',')} m`;
}

function describeBoardingPoint(point) {
    const forward = Number(point?.forwardM || 0);
    const right = Number(point?.rightM || 0);
    const fLabel = forward >= 0 ? `vorn ${formatBoardingMeters(forward)}` : `hinten ${formatBoardingMeters(forward)}`;
    const rLabel = right >= 0 ? `rechts ${formatBoardingMeters(right)}` : `links ${formatBoardingMeters(right)}`;
    return `${fLabel} / ${rLabel}`;
}

function boardingRoutePointList(config) {
    const cfg = normalizeAircraftBoardingConfig(config);
    const beforeCargo = cfg.waypoints
        .map((point, index) => ({ point, index }))
        .filter(item => item.point.beforeCargo);
    const afterCargo = cfg.waypoints
        .map((point, index) => ({ point, index }))
        .filter(item => !item.point.beforeCargo);
    return [
        { key: 'spawn', label: 'Spawn', point: cfg.spawn, fixed: true },
        ...beforeCargo.map(item => ({ key: `waypoint:${item.index}`, label: `Wegpunkt ${item.index + 1}`, point: item.point, fixed: false })),
        { key: 'cargo', label: 'Cargo', point: cfg.cargo, fixed: true },
        ...afterCargo.map(item => ({ key: `waypoint:${item.index}`, label: `Wegpunkt ${item.index + 1}`, point: item.point, fixed: false })),
        { key: 'target', label: 'Boarding', point: cfg.target, fixed: true }
    ];
}

function getBoardingPointRef(boarding, key) {
    if (key === 'spawn') return boarding.spawn;
    if (key === 'cargo') return boarding.cargo;
    if (key === 'target') return boarding.target;
    const match = String(key || '').match(/^waypoint:(\d+)$/);
    if (match) return boarding.waypoints[Number(match[1])] || null;
    return null;
}

function setBoardingPointRef(boarding, key, point) {
    const previous = getBoardingPointRef(boarding, key);
    const normalized = normalizeBoardingWaypoint(point, AIRCRAFT_BOARDING_DEFAULT.spawn, previous?.beforeCargo);
    if (key === 'spawn') boarding.spawn = normalized;
    else if (key === 'cargo') boarding.cargo = normalized;
    else if (key === 'target') boarding.target = normalized;
    else {
        const match = String(key || '').match(/^waypoint:(\d+)$/);
        if (match && boarding.waypoints[Number(match[1])]) boarding.waypoints[Number(match[1])] = normalized;
    }
}

function ensureBoardingPointSelection(config) {
    const keys = boardingRoutePointList(config).map(item => item.key);
    if (!keys.includes(activeBoardingPointKey)) activeBoardingPointKey = keys[0] || 'spawn';
    return activeBoardingPointKey;
}

function updateBoardingPresetEditorUI(config = null) {
    const cfg = normalizeAircraftBoardingConfig(config || getAircraftPreset(activeAircraftPresetSettingsSlot).boarding);
    const spawnReadout = document.getElementById('boardingSpawnReadout');
    const targetReadout = document.getElementById('boardingTargetReadout');
    const doorToggle = document.getElementById('boardingDoorOpenToggle');
    const markerToggle = document.getElementById('boardingMarkerToggle');
    const pointSelect = document.getElementById('boardingPointSelect');
    const selectedReadout = document.getElementById('boardingSelectedPointReadout');
    const deleteBtn = document.getElementById('boardingDeletePointBtn');
    const moveBackBtn = document.getElementById('boardingMovePointBackBtn');
    const moveForwardBtn = document.getElementById('boardingMovePointForwardBtn');
    if (spawnReadout) spawnReadout.textContent = describeBoardingPoint(cfg.spawn);
    if (targetReadout) targetReadout.textContent = describeBoardingPoint(cfg.target);
    if (doorToggle) doorToggle.checked = cfg.openDoor !== false;
    if (markerToggle && typeof window.isBoardingMarkerEnabled === 'function') markerToggle.checked = window.isBoardingMarkerEnabled();
    const selectedKey = ensureBoardingPointSelection(cfg);
    const route = boardingRoutePointList(cfg);
    const selected = route.find(item => item.key === selectedKey) || route[0];
    if (pointSelect) {
        pointSelect.innerHTML = '';
        route.forEach(item => {
            const option = document.createElement('option');
            option.value = item.key;
            option.textContent = item.label;
            pointSelect.appendChild(option);
        });
        pointSelect.value = selected?.key || 'spawn';
    }
    if (selectedReadout) selectedReadout.textContent = selected ? `${selected.label}: ${describeBoardingPoint(selected.point)}` : '-';
    const selectedIsWaypoint = /^waypoint:\d+$/.test(selected?.key || '');
    if (deleteBtn) deleteBtn.disabled = !selectedIsWaypoint;
    if (moveBackBtn) moveBackBtn.disabled = !selectedIsWaypoint;
    if (moveForwardBtn) moveForwardBtn.disabled = !selectedIsWaypoint;
}

function scheduleAircraftPresetCloudSync() {
    const toggle = document.getElementById('syncToggle');
    if (!toggle || !toggle.checked || typeof triggerCloudSave !== 'function') return;
    clearTimeout(aircraftPresetCloudSyncTimer);
    aircraftPresetCloudSyncTimer = setTimeout(() => {
        try { triggerCloudSave(true); } catch (_) {}
    }, 1200);
}

function updateAircraftPresetBoarding(slotId, updater, statusText) {
    const resolvedSlot = AIRCRAFT_PRESET_SLOT_ORDER.includes(slotId) ? slotId : 'C172';
    const preset = getAircraftPreset(resolvedSlot);
    const boarding = normalizeAircraftBoardingConfig(preset.boarding);
    updater(boarding);
    const nextBoarding = normalizeAircraftBoardingConfig(boarding);
    aircraftPresets[resolvedSlot] = normalizeAircraftPreset(resolvedSlot, { ...preset, boarding: nextBoarding });
    saveAircraftPresets();
    updateBoardingPresetEditorUI(aircraftPresets[resolvedSlot].boarding);
    updateAircraftPresetButtonsUI();
    setAircraftPresetStatus(statusText || `${getAircraftPresetSlotLabel(resolvedSlot)} Boarding gespeichert`, '#4caf50');
    scheduleAircraftPresetCloudSync();
    if (typeof window.scheduleBoardingMarkerRefresh === 'function') window.scheduleBoardingMarkerRefresh('preset-adjust');
}

function nudgeBoardingPresetPoint(pointKey, axis, delta) {
    if (!pointKey || !['forwardM', 'rightM'].includes(axis)) return;
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    updateAircraftPresetBoarding(slotId, (boarding) => {
        const point = getBoardingPointRef(boarding, pointKey);
        if (!point) return;
        point[axis] = clampBoardingOffset(Number(point[axis] || 0) + Number(delta || 0), point[axis]);
        setBoardingPointRef(boarding, pointKey, point);
    }, `${getAircraftPresetSlotLabel(slotId)} Boarding-Punkt angepasst`);
}
window.nudgeBoardingPresetPoint = nudgeBoardingPresetPoint;

function selectBoardingPresetPoint(pointKey) {
    activeBoardingPointKey = String(pointKey || 'spawn');
    updateBoardingPresetEditorUI();
}
window.selectBoardingPresetPoint = selectBoardingPresetPoint;

function nudgeSelectedBoardingPoint(axis, delta) {
    nudgeBoardingPresetPoint(activeBoardingPointKey, axis, delta);
}
window.nudgeSelectedBoardingPoint = nudgeSelectedBoardingPoint;

function midpointBoardingPoint(a, b) {
    return normalizeBoardingPoint({
        forwardM: ((Number(a?.forwardM) || 0) + (Number(b?.forwardM) || 0)) / 2,
        rightM: ((Number(a?.rightM) || 0) + (Number(b?.rightM) || 0)) / 2,
        altOffsetFt: ((Number(a?.altOffsetFt) || 0) + (Number(b?.altOffsetFt) || 0)) / 2
    }, AIRCRAFT_BOARDING_DEFAULT.cargo);
}

function addBoardingWaypointAfterSelected() {
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    updateAircraftPresetBoarding(slotId, (boarding) => {
        const route = boardingRoutePointList(boarding);
        const selectedIndex = Math.max(0, route.findIndex(item => item.key === activeBoardingPointKey));
        const insertRouteIndex = Math.min(route.length - 1, selectedIndex + 1);
        const previous = route[selectedIndex] || route[0];
        const next = route[insertRouteIndex] || route[route.length - 1];
        const cargoRouteIndex = route.findIndex(item => item.key === 'cargo');
        const nextWaypointIndex = route
            .slice(insertRouteIndex)
            .find(item => /^waypoint:\d+$/.test(item.key || ''))?.key
            ?.match(/^waypoint:(\d+)$/)?.[1];
        const insertIndex = Number.isFinite(Number(nextWaypointIndex)) ? Number(nextWaypointIndex) : boarding.waypoints.length;
        const waypoint = midpointBoardingPoint(previous?.point, next?.point);
        waypoint.beforeCargo = cargoRouteIndex >= 0 && insertRouteIndex <= cargoRouteIndex;
        boarding.waypoints.splice(insertIndex, 0, waypoint);
        activeBoardingPointKey = `waypoint:${insertIndex}`;
    }, `${getAircraftPresetSlotLabel(slotId)} Wegpunkt hinzugefügt`);
}
window.addBoardingWaypointAfterSelected = addBoardingWaypointAfterSelected;

function deleteSelectedBoardingWaypoint() {
    const match = String(activeBoardingPointKey || '').match(/^waypoint:(\d+)$/);
    if (!match) return;
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    updateAircraftPresetBoarding(slotId, (boarding) => {
        const index = Number(match[1]);
        if (!boarding.waypoints[index]) return;
        boarding.waypoints.splice(index, 1);
        activeBoardingPointKey = boarding.waypoints[index] ? `waypoint:${index}` : (boarding.waypoints[index - 1] ? `waypoint:${index - 1}` : 'cargo');
    }, `${getAircraftPresetSlotLabel(slotId)} Wegpunkt gelöscht`);
}
window.deleteSelectedBoardingWaypoint = deleteSelectedBoardingWaypoint;

function moveSelectedBoardingWaypoint(direction) {
    const match = String(activeBoardingPointKey || '').match(/^waypoint:(\d+)$/);
    if (!match) return;
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    updateAircraftPresetBoarding(slotId, (boarding) => {
        const route = boardingRoutePointList(boarding);
        const currentIndex = route.findIndex(item => item.key === activeBoardingPointKey);
        const targetIndex = currentIndex + Number(direction || 0);
        if (currentIndex < 0 || targetIndex <= 0 || targetIndex >= route.length - 1) return;
        const [selected] = route.splice(currentIndex, 1);
        route.splice(targetIndex, 0, selected);
        const cargoIndex = route.findIndex(item => item.key === 'cargo');
        const orderedWaypoints = [];
        route.forEach((item, routeIndex) => {
            if (!/^waypoint:\d+$/.test(item.key || '')) return;
            orderedWaypoints.push({
                ...item.point,
                beforeCargo: cargoIndex >= 0 && routeIndex < cargoIndex
            });
        });
        const selectedRouteIndex = route.findIndex(item => item.key === selected.key);
        let nextSelectedIndex = 0;
        for (let i = 0; i < selectedRouteIndex; i++) {
            if (/^waypoint:\d+$/.test(route[i]?.key || '')) nextSelectedIndex++;
        }
        boarding.waypoints = orderedWaypoints;
        activeBoardingPointKey = `waypoint:${Math.max(0, nextSelectedIndex)}`;
    }, `${getAircraftPresetSlotLabel(slotId)} Wegpunkt sortiert`);
}
window.moveSelectedBoardingWaypoint = moveSelectedBoardingWaypoint;

function resetBoardingPresetConfig() {
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    const slotDefault = normalizeAircraftBoardingConfig(AIRCRAFT_PRESET_DEFAULTS[slotId]?.boarding || AIRCRAFT_BOARDING_DEFAULT);
    updateAircraftPresetBoarding(slotId, (boarding) => {
        boarding.spawn = { ...slotDefault.spawn };
        boarding.cargo = { ...slotDefault.cargo };
        boarding.target = { ...slotDefault.target };
        boarding.waypoints = slotDefault.waypoints.map(point => ({ ...point }));
        boarding.walkSpeedKts = slotDefault.walkSpeedKts;
        boarding.durationMs = slotDefault.durationMs;
        boarding.openDoor = slotDefault.openDoor;
        activeBoardingPointKey = 'spawn';
    }, `${getAircraftPresetSlotLabel(slotId)} Boarding reset`);
}
window.resetBoardingPresetConfig = resetBoardingPresetConfig;

function setBoardingDoorOption(enabled) {
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    updateAircraftPresetBoarding(slotId, (boarding) => {
        boarding.openDoor = !!enabled;
    }, `${getAircraftPresetSlotLabel(slotId)} Tür ${enabled ? 'aktiv' : 'aus'}`);
}
window.setBoardingDoorOption = setBoardingDoorOption;

function previewBoardingPresetScene() {
    if (typeof window.clearMissionSceneObjects === 'function') window.clearMissionSceneObjects('boarding-preset-preview-clear');
    else if (typeof window.missionSceneClear === 'function') window.missionSceneClear('boarding-preset-preview-clear');
    setTimeout(() => {
        if (typeof window.missionSceneSpawn === 'function') window.missionSceneSpawn('boarding-preset-preview');
        if (typeof window.scheduleBoardingMarkerRefresh === 'function') window.scheduleBoardingMarkerRefresh('boarding-preset-preview');
    }, 900);
}
window.previewBoardingPresetScene = previewBoardingPresetScene;

function getAircraftDoorProfile(slotId = selectedAC) {
    const preset = getAircraftPreset(slotId);
    const haystack = `${slotId || ''} ${preset?.name || ''}`.toLowerCase();
    if (haystack.includes('pa-24') || haystack.includes('pa24') || haystack.includes('comanche')) {
        return 'pa24_comanche';
    }
    return 'default';
}

function getMissionSceneBoardingConfig(slotId = selectedAC) {
    const cfg = normalizeAircraftBoardingConfig(getAircraftPreset(slotId).boarding);
    const preset = getAircraftPreset(slotId);
    return {
        ...cfg,
        doorProfile: getAircraftDoorProfile(slotId),
        aircraftSlot: slotId,
        aircraftName: preset?.name || slotId,
        spawn: { ...cfg.spawn },
        cargo: { ...cfg.cargo },
        target: { ...cfg.target },
        waypoints: cfg.waypoints.map(point => ({ ...point })),
        path: (cfg.path && cfg.path.length >= 2 ? cfg.path : [cfg.spawn, cfg.target]).map(point => ({ ...point })),
        cargoIndex: cfg.cargoIndex,
        pathLabels: boardingRoutePointList(cfg).map(item => item.label)
    };
}
window.getMissionSceneBoardingConfig = getMissionSceneBoardingConfig;

function getAircraftPresetSlotLabel(slotId) {
    return AIRCRAFT_PRESET_SLOT_LABELS[slotId] || String(slotId || '');
}

function updateNavComAircraftButtons() {
    const slotToNavButtonId = {
        'C172': 'btnAC-C172',
        'PA-24': 'btnAC-PA24',
        'AERO': 'btnAC-AERO'
    };
    Object.values(slotToNavButtonId).forEach(btnId => {
        document.getElementById(btnId)?.classList.remove('active');
    });
    const activeBtnId = slotToNavButtonId[selectedAC];
    if (activeBtnId) document.getElementById(activeBtnId)?.classList.add('active');
}

function updateAircraftPresetButtonsUI() {
    AIRCRAFT_PRESET_SLOT_ORDER.forEach(slotId => {
        const preset = getAircraftPreset(slotId);
        document.querySelectorAll(`.btn-preset[data-aircraft-slot="${slotId}"]`).forEach(btn => {
            btn.textContent = preset.name;
            btn.title = `${preset.name} · ${preset.tas} TAS · ${String(preset.gph).padStart(2, '0')} GPH · ${preset.pax} PAX`;
        });
        document.querySelectorAll(`.audio-btn[data-aircraft-slot="${slotId}"]`).forEach(btn => {
            const led = btn.querySelector('.audio-led');
            btn.textContent = preset.name;
            if (led) btn.appendChild(led);
            btn.title = `${preset.name} · ${preset.tas} TAS · ${String(preset.gph).padStart(2, '0')} GPH · ${preset.pax} PAX`;
        });
    });
    if (typeof updateOpsAircraftSwitches === 'function') updateOpsAircraftSwitches();
    updateNavComAircraftButtons();
}
window.updateAircraftPresetButtonsUI = updateAircraftPresetButtonsUI;

function selectAircraftPresetSlotFromSettings(slotId) {
    if (!AIRCRAFT_PRESET_SLOT_ORDER.includes(slotId)) slotId = 'C172';
    activeAircraftPresetSettingsSlot = slotId;
    window.activeAircraftPresetSettingsSlot = slotId;
    const preset = getAircraftPreset(slotId);
    const slotSelect = document.getElementById('aircraftPresetSlot');
    const nameInput = document.getElementById('aircraftPresetName');
    const tasInput = document.getElementById('aircraftPresetTas');
    const gphInput = document.getElementById('aircraftPresetGph');
    const paxInput = document.getElementById('aircraftPresetPax');
    if (slotSelect && slotSelect.value !== slotId) slotSelect.value = slotId;
    if (nameInput) nameInput.value = preset.name;
    if (tasInput) tasInput.value = String(preset.tas);
    if (gphInput) gphInput.value = String(preset.gph);
    if (paxInput) paxInput.value = String(preset.pax);
    updateBoardingPresetEditorUI(preset.boarding);
    setAircraftPresetStatus(`${getAircraftPresetSlotLabel(slotId)} geladen`, '#9aa3ad');
}
window.selectAircraftPresetSlotFromSettings = selectAircraftPresetSlotFromSettings;

function saveAircraftPresetFromSettings() {
    const slotId = AIRCRAFT_PRESET_SLOT_ORDER.includes(activeAircraftPresetSettingsSlot) ? activeAircraftPresetSettingsSlot : 'C172';
    const defaults = AIRCRAFT_PRESET_DEFAULTS[slotId] || AIRCRAFT_PRESET_DEFAULTS['C172'];
    const nameInput = document.getElementById('aircraftPresetName');
    const tasInput = document.getElementById('aircraftPresetTas');
    const gphInput = document.getElementById('aircraftPresetGph');
    const paxInput = document.getElementById('aircraftPresetPax');

    const candidate = {
        name: nameInput?.value ?? defaults.name,
        tas: tasInput?.value ?? defaults.tas,
        gph: gphInput?.value ?? defaults.gph,
        pax: paxInput?.value ?? defaults.pax,
        boarding: getAircraftPreset(slotId).boarding
    };
    const next = normalizeAircraftPreset(slotId, candidate);
    aircraftPresets[slotId] = next;
    saveAircraftPresets();
    updateAircraftPresetButtonsUI();
    selectAircraftPresetSlotFromSettings(slotId);
    setAircraftPresetStatus(`${getAircraftPresetSlotLabel(slotId)} gespeichert`, '#4caf50');
    if (selectedAC === slotId) {
        applyPreset(next.tas, next.gph, next.pax, slotId);
    }
    scheduleAircraftPresetCloudSync();
}
window.saveAircraftPresetFromSettings = saveAircraftPresetFromSettings;

function applyAircraftPresetSlot(slotId) {
    const preset = getAircraftPreset(slotId);
    applyPreset(preset.tas, preset.gph, preset.pax, slotId);
}
window.applyAircraftPresetSlot = applyAircraftPresetSlot;

function clampMainPerfSetting(value, min, max, step = 1, fallback = min) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) n = fallback;
    n = Math.max(min, Math.min(max, n));
    if (step > 1) n = Math.round(n / step) * step;
    return Math.max(min, Math.min(max, n));
}

function persistMainPerformanceSetting(type, value) {
    const key = MAIN_PERF_SETTING_KEYS[type];
    if (!key) return;
    localStorage.setItem(key, String(value));
}
window.persistMainPerformanceSetting = persistMainPerformanceSetting;

function applyPersistedMainPerformanceSettings() {
    const tas = clampMainPerfSetting(localStorage.getItem(MAIN_PERF_SETTING_KEYS.tas), 80, 260, 5, 115);
    const gph = clampMainPerfSetting(localStorage.getItem(MAIN_PERF_SETTING_KEYS.gph), 5, 35, 1, 9);
    const alt = clampMainPerfSetting(localStorage.getItem(MAIN_PERF_SETTING_KEYS.alt), 1500, 13500, 100, 4500);
    const rate = clampMainPerfSetting(localStorage.getItem(MAIN_PERF_SETTING_KEYS.rate), 200, 1500, 50, 500);
    const seats = clampMainPerfSetting(localStorage.getItem(MAIN_PERF_SETTING_KEYS.maxSeats), 1, 6, 1, 4);
    const aircraft = localStorage.getItem(MAIN_PERF_SETTING_KEYS.aircraft);

    const tasSlider = document.getElementById('tasSlider');
    const gphSlider = document.getElementById('gphSlider');
    const altSlider = document.getElementById('altSlider');
    const rateSlider = document.getElementById('rateSlider');
    const maxSeatsEl = document.getElementById('maxSeats');
    const altMapInput = document.getElementById('altMapInput');
    const rateMapInput = document.getElementById('rateMapInput');

    if (tasSlider) tasSlider.value = tas;
    if (gphSlider) gphSlider.value = gph;
    if (altSlider) altSlider.value = alt;
    if (rateSlider) rateSlider.value = rate;
    if (maxSeatsEl) maxSeatsEl.value = seats;
    if (altMapInput) altMapInput.textContent = alt;
    if (rateMapInput) rateMapInput.textContent = rate;
    if (Number.isFinite(rate)) {
        vpClimbRate = rate;
        vpDescentRate = rate;
    }
    if (AIRCRAFT_PRESET_SLOT_ORDER.includes(aircraft)) {
        selectedAC = aircraft;
        window.selectedAC = selectedAC;
    }
    updateAircraftPresetButtonsUI();
    selectAircraftPresetSlotFromSettings(selectedAC);
}

document.addEventListener('DOMContentLoaded', () => {
    // Erkennt, wenn der Nutzer an einem klassischen Slider zieht
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('mousedown', () => window.vpUIInteractionActive = true);
        slider.addEventListener('touchstart', () => window.vpUIInteractionActive = true, {passive: true});
        const onEnd = () => {
            window.vpUIInteractionActive = false;
            if (slider.id === 'altSlider' || slider.id === 'rateSlider') {
                if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
                if (typeof vpDrawClouds === 'function' && document.getElementById('verticalProfileCanvas')) {
                    renderMapProfile(); renderVerticalProfile('verticalProfileCanvas');
                }
            }
        };
        slider.addEventListener('mouseup', onEnd);
        slider.addEventListener('touchend', onEnd);
        slider.addEventListener('touchcancel', onEnd); // Verhindert Einfrieren beim Scrollen
    });
});

/* =========================================================
   1. THEME TOGGLE & NOTIZEN TOGGLE
   ========================================================= */
function changeThemeFromSlider(val) {
    const v = parseInt(val);
    if (v === 0) setTheme('classic');
    else if (v === 1) setTheme('retro');
    else if (v === 2) setTheme('navcom');
    else if (v === 3) setTheme('ops1940');
}

function setSettingsPanelOpen(open, persist = true) {
    const shell = document.querySelector('.settings-shell');
    const panel = document.getElementById('settingsPanel');
    const btn = document.getElementById('settingsToggleBtn');
    const chevron = document.getElementById('settingsToggleChevron');
    if (!shell || !panel) return;
    shell.classList.toggle('is-open', !!open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.innerText = '▾';
    if (persist) localStorage.setItem('ga_settings_open', open ? 'true' : 'false');
}

function toggleSettingsPanel() {
    const shell = document.querySelector('.settings-shell');
    setSettingsPanelOpen(!(shell && shell.classList.contains('is-open')));
}

function setTheme(mode) {
    const wasNavcom = document.body.classList.contains('theme-navcom');
    document.body.classList.remove('theme-retro', 'theme-navcom', 'theme-ops1940');
    const lblClassic = document.getElementById('lbl-classic');
    const lblRetro = document.getElementById('lbl-retro');
    const lblNavcom = document.getElementById('lbl-navcom');
    const lblOps1940 = document.getElementById('lbl-ops1940');
    const slider = document.getElementById('themeSlider');

    if (lblClassic) lblClassic.style.color = '#888';
    if (lblRetro) lblRetro.style.color = '#888';
    if (lblNavcom) lblNavcom.style.color = '#888';
    if (lblOps1940) lblOps1940.style.color = '#888';

    if (mode === 'retro') {
        document.body.classList.add('theme-retro');
        localStorage.setItem('ga_theme', 'retro');
        if (slider) slider.value = 1;
        if (lblRetro) lblRetro.style.color = '#d93829';
    } else if (mode === 'navcom') {
        document.body.classList.add('theme-navcom', 'theme-retro');
        localStorage.setItem('ga_theme', 'navcom');
        if (slider) slider.value = 2;
        if (lblNavcom) lblNavcom.style.color = '#33ff33';
    } else if (mode === 'ops1940') {
        document.body.classList.add('theme-ops1940');
        localStorage.setItem('ga_theme', 'ops1940');
        if (slider) slider.value = 3;
        if (lblOps1940) lblOps1940.style.color = '#d0a44f';
    } else {
        localStorage.setItem('ga_theme', 'classic');
        if (slider) slider.value = 0;
        if (lblClassic) lblClassic.style.color = '#4da6ff';
    }
    applySavedPanelTheme();
    updateDynamicColors();
    refreshAllDrums();
    syncGPSWithTheme(mode, wasNavcom);
    if (typeof updateOps1940Panel === 'function') updateOps1940Panel();

    // --- NEU: Wetter-Widgets beim Theme-Wechsel sofort neu rendern ---
    if (typeof currentStartICAO !== 'undefined' && currentStartICAO) {
        const depP = routeWaypoints && routeWaypoints.length > 0 ? routeWaypoints[0] : null;
        loadMetarWidget(currentStartICAO, 'metarContainerDep', depP?.lat, depP?.lng || depP?.lon);
    }
    if (typeof currentDestICAO !== 'undefined' && currentDestICAO) {
        const isPOI = document.getElementById("destRwyContainer")?.style.display === "none";
        const destP = routeWaypoints && routeWaypoints.length > 1 ? routeWaypoints[routeWaypoints.length - 1] : null;
        loadMetarWidget(isPOI ? null : currentDestICAO, 'metarContainerDest', destP?.lat, destP?.lng || destP?.lon);
    }
}

function syncGPSWithTheme(newMode, wasNavcom) {
    const fp = document.querySelector('.flightplan-container');
    const mod = document.getElementById('kln90bModule');
    if (newMode === 'navcom') {
        if (gpsState.visible) {
            if (mod) mod.style.display = 'flex';
            if (fp) fp.style.display = 'none';
            renderGPS();
        } else {
            if (mod) mod.style.display = 'none';
            if (fp) fp.style.display = '';
        }
    } else {
        if (mod) mod.style.display = 'none';
        if (fp) fp.style.display = '';
    }
}

function syncToNavCom(radioId, value) {
    const el = document.getElementById(radioId);
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = value;
    } else {
        el.innerText = value;
    }
}

function applyNavComPreset(t, g, s, n, btnElement) {
    if (arguments.length === 1 && typeof t === 'string') {
        applyAircraftPresetSlot(t);
        return;
    }
    applyPreset(t, g, s, n);
    document.getElementById('tasSlider').value = t;
    document.getElementById('gphSlider').value = g;
    handleSliderChange('tas', t);
    handleSliderChange('gph', g);
    syncToNavCom('tasRadioDisplay', t);
    syncToNavCom('gphRadioDisplay', g.toString().padStart(2, '0'));
    updateNavComAircraftButtons();
    saveAudioButtonStates();
}

function toggleNavComAI(btnElement) {
    const aiToggleBtn = document.getElementById('aiToggle');
    if (aiToggleBtn) {
        aiToggleBtn.checked = !aiToggleBtn.checked;
        saveAiToggle();
        if (aiToggleBtn.checked) btnElement.classList.add('active');
        else btnElement.classList.remove('active');
        saveAudioButtonStates();
    }
}

function swapDepDest() {
    const depRadio = document.getElementById('startLocRadio');
    const destRadio = document.getElementById('destLocRadio');
    const depClassic = document.getElementById('startLoc');
    const destClassic = document.getElementById('destLoc');
    if (!depRadio || !destRadio) return;

    if (!destRadio.value || !destRadio.value.trim()) {
        destRadio.value = depRadio.value;
        if (destClassic) destClassic.value = depRadio.value;
        const targetTypeSel = document.getElementById('targetType');
        if (targetTypeSel) {
            targetTypeSel.value = 'poi';
            targetTypeSel.dispatchEvent(new Event('change'));
        }
        updateMapFromInputs();
        return;
    }

    const tempVal = depRadio.value;
    depRadio.value = destRadio.value;
    destRadio.value = tempVal;
    if (depClassic) depClassic.value = depRadio.value;
    if (destClassic) destClassic.value = destRadio.value;
    updateMapFromInputs();
}

function cycleRadioOption(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    let nextIndex = selectEl.selectedIndex + 1;
    if (nextIndex >= selectEl.options.length) nextIndex = 0;
    selectEl.selectedIndex = nextIndex;
    selectEl.dispatchEvent(new Event('change'));
}

const MISSION_PICKER_STORAGE_KEY = 'ga_mission_picker_mode';
const MISSION_PICKER_OPTIONS = {
    basic: [
        { value: 'apt', classic: 'Flugplatz (A ➔ B)', radioShort: 'APT', radioFull: 'Airport (alle Kategorien)' },
        { value: 'poi', classic: 'POI (Rundflug)', radioShort: 'POI', radioFull: 'POI (alle Kategorien)' },
        { value: 'apt+freeflight_planning', classic: 'APT · Freiflug/Planung', radioShort: 'APT FREE', radioFull: 'Airport · Freiflug/Planung' },
        { value: 'poi+freeflight_planning', classic: 'POI · Freiflug/Planung', radioShort: 'POI FREE', radioFull: 'POI · Freiflug/Planung' }
    ],
    full: [
        { value: 'apt:all', classic: 'APT (alle Kategorien)', radioShort: 'APT ALL', radioFull: 'Airport (alle Kategorien)' },
        { value: 'apt:all+freeflight_planning', classic: 'APT · Freiflug/Planung', radioShort: 'APT FREE', radioFull: 'Airport · Freiflug/Planung' },
        { value: 'apt:club', classic: 'APT · Verein', radioShort: 'APT CLUB', radioFull: 'Airport · Verein' },
        { value: 'apt:private', classic: 'APT · Privat', radioShort: 'APT PRIV', radioFull: 'Airport · Privat' },
        { value: 'apt:charter', classic: 'APT · Charter', radioShort: 'APT CHR', radioFull: 'Airport · Charter' },
        { value: 'apt:cargo', classic: 'APT · Cargo (ohne PAX)', radioShort: 'APT CARGO', radioFull: 'Airport · Cargo (ohne PAX)' },
        { value: 'apt:trn', classic: 'APT · Training', radioShort: 'APT TRN', radioFull: 'Airport · Training' },
        { value: 'apt:all+medical_transfer', classic: 'APT · Medizin-Transfer', radioShort: 'APT MED', radioFull: 'Airport · Medizin-Transfer' },
        { value: 'apt:cargo+cargo_fragile', classic: 'APT · Cargo fragil', radioShort: 'APT FRG', radioFull: 'Airport · Cargo fragil' },
        { value: 'apt:all+animal_transport', classic: 'APT · Tiertransport', radioShort: 'APT ANM', radioFull: 'Airport · Tiertransport' },
        { value: 'apt:all+news_coverage', classic: 'APT · Reporter', radioShort: 'APT NEWS', radioFull: 'Airport · Reporter' },
        { value: 'apt:all+sightseeing_tour', classic: 'APT · Sightseeing', radioShort: 'APT TOUR', radioFull: 'Airport · Sightseeing' },
        { value: 'poi:all', classic: 'POI (alle Kategorien)', radioShort: 'POI ALL', radioFull: 'POI (alle Kategorien)' },
        { value: 'poi:all+freeflight_planning', classic: 'POI · Freiflug/Planung', radioShort: 'POI FREE', radioFull: 'POI · Freiflug/Planung' },
        { value: 'poi:all+inspection_infra', classic: 'POI · Inspektion', radioShort: 'POI INSP', radioFull: 'POI · Infrastruktur-Inspektion' },
        { value: 'poi:all+media_photo', classic: 'POI · Foto/Film', radioShort: 'POI CAM', radioFull: 'POI · Foto/Film' },
        { value: 'poi:bridge', classic: 'POI · Brücken', radioShort: 'POI BRG', radioFull: 'POI · Brücken' },
        { value: 'poi:road', classic: 'POI · Straße/Autobahn', radioShort: 'POI ROAD', radioFull: 'POI · Straße/Autobahn' },
        { value: 'poi:dam', classic: 'POI · Staudamm/Talsperre', radioShort: 'POI DAM', radioFull: 'POI · Staudamm/Talsperre' },
        { value: 'poi:telecom', classic: 'POI · Funkmast/Funkturm', radioShort: 'POI TEL', radioFull: 'POI · Funkmast/Funkturm' },
        { value: 'poi:industry', classic: 'POI · Industrie/Anlagen', radioShort: 'POI IND', radioFull: 'POI · Industrie/Anlagen' },
        { value: 'poi:infrastructure', classic: 'POI · Infrastruktur (Straße/Bahn/Strom)', radioShort: 'POI INF', radioFull: 'POI · Infrastruktur (Straße/Bahn/Strom)' },
        { value: 'poi:castle', classic: 'POI · Burg/Schloss', radioShort: 'POI CST', radioFull: 'POI · Burg/Schloss' },
        { value: 'poi:water', classic: 'POI · Fluss/See/Küste', radioShort: 'POI WTR', radioFull: 'POI · Fluss/See/Küste' },
        { value: 'poi:mountain', classic: 'POI · Berg/Tal', radioShort: 'POI MTN', radioFull: 'POI · Berg/Tal' },
        { value: 'poi:city', classic: 'POI · Stadt/Turm', radioShort: 'POI CITY', radioFull: 'POI · Stadt/Turm' },
        { value: 'poi:trn', classic: 'POI · Training (Platznah)', radioShort: 'POI TRN', radioFull: 'POI · Training (platznah)' },
        { value: 'poi:generic', classic: 'POI · Sonstige', radioShort: 'POI GEN', radioFull: 'POI · Sonstige' },
        { value: 'poi:all+mapping_survey', classic: 'POI · Mapping/Survey', radioShort: 'POI MAP', radioFull: 'POI · Mapping/Survey' },
        { value: 'poi:all+news_coverage', classic: 'POI · Reporter', radioShort: 'POI NEWS', radioFull: 'POI · Reporter' },
        { value: 'poi:all+sightseeing_tour', classic: 'POI · Sightseeing', radioShort: 'POI TOUR', radioFull: 'POI · Sightseeing' },
        { value: 'poi:all+tour_guide_knowledge', classic: 'POI · Lern-Guide', radioShort: 'POI EDU', radioFull: 'POI · Lern-Guide (Wissen/Fakten)' },
        { value: 'poi:all+historian_guided_tour', classic: 'POI · Historiker', radioShort: 'POI HIST', radioFull: 'POI · Historiker-Rundflug' },
        { value: 'poi:all+science_bio', classic: 'POI · Bio/Umwelt', radioShort: 'POI BIO', radioFull: 'POI · Biologie/Umwelt' },
        { value: 'poi:all+science_geo', classic: 'POI · Geo/Relief', radioShort: 'POI GEO', radioFull: 'POI · Geologie/Relief' },
        { value: 'poi:all+search_and_rescue', classic: 'POI · SAR/Rescue', radioShort: 'POI SAR', radioFull: 'POI · SAR/Rescue' },
        { value: 'poi:fire+fire_watch', classic: 'POI · Fire Watch (Wald/Berg)', radioShort: 'POI FIRE', radioFull: 'POI · Fire Watch (Wald/Berg)' }
    ]
};

function parseMissionPickerValue(raw) {
    const value = String(raw || '').trim().toLowerCase();
    const [leftPart, rightPart] = value.split('+');
    const profile = String(rightPart || 'auto').trim() || 'auto';
    if (leftPart === 'apt') return { baseType: 'apt', category: 'all', profile };
    if (leftPart === 'poi') return { baseType: 'poi', category: 'all', profile };
    if (leftPart.startsWith('apt:')) return { baseType: 'apt', category: leftPart.split(':')[1] || 'all', profile };
    if (leftPart.startsWith('poi:')) return { baseType: 'poi', category: leftPart.split(':')[1] || 'all', profile };
    return { baseType: 'apt', category: 'all', profile: 'auto' };
}

function missionTaskPoiCategoryPolicy(profileId = 'auto') {
    const id = String(profileId || 'auto').toLowerCase();
    const policies = {
        search_and_rescue: ['mountain', 'water'],
        mapping_survey: ['infrastructure', 'industry', 'road', 'bridge', 'dam'],
        inspection_infra: ['infrastructure', 'bridge', 'dam', 'telecom', 'industry', 'road'],
        fire_watch: ['fire'],
        science_bio: ['water', 'mountain'],
        science_geo: ['mountain', 'dam', 'water'],
        media_photo: ['city', 'castle', 'industry', 'road'],
        news_coverage: ['road', 'city', 'industry'],
        tour_guide_knowledge: ['castle', 'city', 'mountain', 'water'],
        historian_guided_tour: ['castle', 'city'],
        sightseeing_tour: ['castle', 'mountain', 'water', 'city']
    };
    return (policies[id] || []).filter(Boolean);
}

function pickPoiCategoryForTaskProfile(profileId = 'auto', requestedCategory = 'all') {
    const requested = String(requestedCategory || 'all').toLowerCase();
    if (requested && requested !== 'all') return requested;
    const categories = missionTaskPoiCategoryPolicy(profileId);
    if (!categories.length) return requested || 'all';
    const historyKey = `ga_poi_profile_cat_${String(profileId || 'auto').toLowerCase()}`;
    let history = {};
    try { history = JSON.parse(localStorage.getItem(historyKey) || '{}'); } catch (_) { history = {}; }
    if (!history || typeof history !== 'object') history = {};
    const minCount = Math.min(...categories.map(cat => Number(history[cat] || 0)));
    const pool = categories.filter(cat => Number(history[cat] || 0) === minCount);
    const pick = pool[Math.floor(Math.random() * pool.length)] || categories[0];
    history[pick] = Number(history[pick] || 0) + 1;
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch (_) {}
    return pick;
}

const MISSION_ROLE_TASK_PROFILES = {
    auto: {
        id: 'auto',
        label: 'Auto',
        appliesTo: ['apt', 'poi']
    },
    inspection_infra: {
        id: 'inspection_infra',
        label: 'Infrastruktur-Inspektion',
        appliesTo: ['poi'],
        roleProfile: 'technical_inspector_v1',
        taskDomain: 'inspection_infra',
        personas: [
            { name: 'Nora Feldmann', role: 'Bauwerksprüferin', gender: 'female', personality: 'präzise, nüchtern, aufmerksam' },
            { name: 'Martin Seidel', role: 'Infrastruktur-Techniker', gender: 'male', personality: 'ruhig, technisch, direkt' }
        ],
        greetingText: 'Hi, wir prüfen heute den Zustand des Zielobjekts aus der Luft. Bitte stabile Passes, damit Schäden, Wartungspunkte und Baufortschritt sauber dokumentiert werden.',
        paxText: '1 PAX (Infrastruktur-Inspektion)',
        cargoPool: ['Wärmebildkamera und Tablet (26 lbs)', 'Inspektionskamera und Checklisten (18 lbs)', 'Kamera-Gimbal und Messkoffer (42 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: technische Sichtprüfung, Schadensdokumentation, Wartungsstatus oder Baufortschritt.'
    },
    media_photo: {
        id: 'media_photo',
        label: 'Foto/Film',
        appliesTo: ['poi'],
        roleProfile: 'media_observer_v1',
        taskDomain: 'media_photo',
        personas: [
            { name: 'Lena Vogt', role: 'Luftbild-Fotografin', gender: 'female', personality: 'konzentriert, visuell, ruhig' },
            { name: 'Ben Kramer', role: 'Kameramann', gender: 'male', personality: 'präzise, sachlich, geduldig' }
        ],
        greetingText: 'Hi, wir brauchen heute verwertbare Foto- und Filmwinkel vom Ziel. Bitte ruhig fliegen, mit sauberen Bögen und genug Zeit für stabile Takes.',
        paxText: '1 PAX (Foto/Film)',
        cargoPool: ['Kamera-Gimbal (34 lbs)', 'Film- und Akkukoffer (28 lbs)', 'Teleobjektiv-Set (22 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: professionelle Luftbilder, Firmenaufnahmen, Dokumentation oder Establishing Shots.'
    },
    freeflight_planning: {
        id: 'freeflight_planning',
        label: 'Freiflug/Planung',
        appliesTo: ['apt', 'poi'],
        roleProfile: 'none',
        taskDomain: 'freeflight_planning',
        personas: [],
        greetingText: '',
        paxText: '',
        cargoPool: [],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'niedrig', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'niedrig' },
        storyCue: 'Kein Missionsauftrag: reiner Freiflug-/Planungsmodus.'
    },
    medical_transfer: {
        id: 'medical_transfer',
        label: 'Medizin-Transfer',
        appliesTo: ['apt'],
        roleProfile: 'medical_sensitive_v1',
        taskDomain: 'medical_transfer',
        personas: [
            { name: 'Dr. Lena Roth', role: 'Notärztin', gender: 'female', personality: 'fokussiert, ruhig, empathisch' },
            { name: 'Dr. Jonas Weber', role: 'Notarzt', gender: 'male', personality: 'präzise, ruhig, professionell' }
        ],
        greetingText: 'Hi, danke fürs Fliegen. Wir transportieren medizinische Begleitung und zeitkritisches Material, der Flug muss ruhig und sauber laufen.',
        paxText: '1 PAX (medizinische Begleitung)',
        cargoPool: ['Kühlbox mit Blutkonserven (18 lbs)', 'Medizinischer Notfallkoffer (22 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'hoch', comfortPriority: 'hoch', urgencyPriority: 'hoch' },
        storyCue: 'Fokus: medizinische Begleitung oder Materialtransfer; keine Patientin und kein Patient an Bord; ruhig und effizient fliegen.'
    },
    news_coverage: {
        id: 'news_coverage',
        label: 'Reporter-Einsatz',
        appliesTo: ['apt', 'poi'],
        roleProfile: 'news_reporter_professional_v1',
        taskDomain: 'news_coverage',
        personas: [
            { name: 'Mara Feld', role: 'Reporterin', gender: 'female', personality: 'neugierig, sachlich, schnell' },
            { name: 'Timo Berger', role: 'TV-Reporter', gender: 'male', personality: 'präzise, präsent, professionell' }
        ],
        greetingText: 'Hi, ich sammle heute O-Töne und Fakten. Bring mich bitte zum Ziel, dann kann ich vor Ort direkt loslegen.',
        paxText: '1 PAX (Reporter)',
        cargoPool: ['Kamera- und Audio-Set (32 lbs)', 'Live-Übertragungsrucksack (26 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: nüchterne Beobachtung und klare Lageeinschätzung.'
    },
    sightseeing_tour: {
        id: 'sightseeing_tour',
        label: 'Sightseeing',
        appliesTo: ['apt', 'poi'],
        roleProfile: 'tour_guide_relaxed_v1',
        taskDomain: 'sightseeing_tour',
        personas: [
            { name: 'Sophie Lang', role: 'Tour-Guide', gender: 'female', personality: 'freundlich, gelassen, kommunikativ' },
            { name: 'Felix Braun', role: 'Stadtführer', gender: 'male', personality: 'locker, charmant, aufmerksam' }
        ],
        greetingText: 'Hi, heute gehts um entspannten Ausblick. Bitte eher weich fliegen, damit alle die Aussicht genießen.',
        paxText: '2 PAX (Sightseeing-Gäste)',
        cargoPool: ['Kleine Kamerataschen (12 lbs)', 'Tagesrucksäcke (15 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'niedrig', stomachSensitivity: 'hoch', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: ruhiger Rundflug mit angenehmem Tempo.'
    },
    tour_guide_knowledge: {
        id: 'tour_guide_knowledge',
        label: 'POI-Lern-Guide',
        appliesTo: ['poi'],
        roleProfile: 'tour_guide_learning_v1',
        taskDomain: 'poi_learning_guide',
        personas: [
            { name: 'Mila Hartung', role: 'Lern-Guide', gender: 'female', personality: 'klar, neugierig, anschaulich' },
            { name: 'Jonas Keller', role: 'Tour-Guide', gender: 'male', personality: 'ruhig, faktenstark, freundlich' }
        ],
        greetingText: 'Hi, heute geht es nur darum, dass du zum Ziel etwas lernst. Ich gebe dir kurze Fakten und Einordnung, ohne Extra-Wuensche.',
        paxText: '1 PAX (Lern-Guide)',
        cargoPool: ['Notizbuch und Reisefuehrer (4 lbs)', 'Tablet mit Ortsfakten (3 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: reiner Bildungsflug am POI mit Fakten, Kontext und Orientierung ohne Arbeitsauftrag.'
    },
    historian_guided_tour: {
        id: 'historian_guided_tour',
        label: 'Historiker-Rundflug',
        appliesTo: ['poi'],
        roleProfile: 'historian_storyteller_v1',
        taskDomain: 'historian_guided_tour',
        personas: [
            { name: 'Dr. Hannah Voss', role: 'Historikerin', gender: 'female', personality: 'kenntnisreich, ruhig, anschaulich' },
            { name: 'Prof. Lukas Brenner', role: 'Historiker', gender: 'male', personality: 'präzise, erzählstark, gelassen' }
        ],
        greetingText: 'Hi, wir machen heute einen Geschichtsflug zum POI. Ich gebe dir unterwegs kurze historische Einordnungen, du fliegst bitte ruhig und stabil.',
        paxText: '1 PAX (Historiker)',
        cargoPool: ['Archivunterlagen und Karten (14 lbs)', 'Tablet mit historischen Luftbildern (9 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'niedrig', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: kurze, sachliche historische Einordnung waehrend des POI-Flugs.'
    },
    science_bio: {
        id: 'science_bio',
        label: 'Biologie/Umwelt',
        appliesTo: ['poi'],
        roleProfile: 'science_field_v1',
        taskDomain: 'science_bio',
        personas: [
            { name: 'Dr. Elena Kurz', role: 'Biologin', gender: 'female', personality: 'aufmerksam, sachlich, ruhig' },
            { name: 'Dr. Paul Reiter', role: 'Ökologe', gender: 'male', personality: 'analytisch, präzise, gelassen' }
        ],
        greetingText: 'Hi, wir machen heute Umweltbeobachtung am POI. Bitte ruhig und stabil fliegen, damit die Beobachtung verwertbar ist.',
        paxText: '1 PAX (Biologe)',
        cargoPool: ['Umweltsensorik und Kamera (18 lbs)', 'Feldnotizen und GPS-Logger (9 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: Natur-/Umweltbeobachtung mit klarer, sachlicher Einordnung.'
    },
    science_geo: {
        id: 'science_geo',
        label: 'Geologie/Relief',
        appliesTo: ['poi'],
        roleProfile: 'science_field_v1',
        taskDomain: 'science_geo',
        personas: [
            { name: 'Dr. Mira Hahn', role: 'Geologin', gender: 'female', personality: 'präzise, ruhig, strukturiert' },
            { name: 'Dr. Nils Vogt', role: 'Geomorphologe', gender: 'male', personality: 'analytisch, klar, professionell' }
        ],
        greetingText: 'Hi, wir schauen uns heute Relief, Erosion und Hangstruktur an. Bitte sauber und reproduzierbar fliegen.',
        paxText: '1 PAX (Geologe)',
        cargoPool: ['Geologie-Mapset und Tablet (12 lbs)', 'Kamera und Laser-Entfernungsmesser (14 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: geologische/geomorphologische Beobachtung mit ruhiger Arbeitsweise.'
    },
    mapping_survey: {
        id: 'mapping_survey',
        label: 'Mapping/Survey',
        appliesTo: ['poi'],
        roleProfile: 'photogrammetry_precision_v1',
        taskDomain: 'mapping_survey',
        personas: [
            { name: 'Nina Eckert', role: 'Geodatentechnikerin', gender: 'female', personality: 'strukturiert, präzise, ruhig' },
            { name: 'David Kern', role: 'Vermessungstechniker', gender: 'male', personality: 'genau, konzentriert, sachlich' }
        ],
        greetingText: 'Hi, ich brauche heute reproduzierbare Linien und einen ruhigen Plattformflug für saubere Daten.',
        paxText: '1 PAX (Survey-Technik)',
        cargoPool: ['Lidar-Scanner (65 lbs)', 'Photogrammetrie-Kamera (34 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: stabile Fluglage und präzise Passes.'
    },
    cargo_fragile: {
        id: 'cargo_fragile',
        label: 'Fragile Fracht',
        appliesTo: ['apt'],
        roleProfile: 'cargo_fragile_highcare_v1',
        taskDomain: 'cargo_fragile',
        personas: [
            { name: 'Miriam Stahl', role: 'Logistik-Kurierin', gender: 'female', personality: 'gewissenhaft, direkt, professionell' },
            { name: 'Ralf König', role: 'Frachtbegleiter', gender: 'male', personality: 'ruhig, organisiert, präzise' }
        ],
        greetingText: 'Hi, die Ladung ist empfindlich. Bitte möglichst ruhig und ohne harte Manöver.',
        paxText: '1 PAX (Frachtbegleitung)',
        cargoPool: ['Präzisionsoptik im Stoßschutz-Case (28 lbs)', 'Laborgerät in Schutzverpackung (35 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'mittel', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: sichere, erschütterungsarme Frachtführung.'
    },
    club_utility: {
        id: 'club_utility',
        label: 'Vereins-/Utility-Flug',
        appliesTo: ['apt'],
        roleProfile: 'club_utility_v1',
        taskDomain: 'club_utility',
        personas: [
            { name: 'Lena Hartig', role: 'Vereinskoordinatorin', gender: 'female', personality: 'pragmatisch, freundlich, organisiert' },
            { name: 'Tobias Kern', role: 'Flugplatzkoordinator', gender: 'male', personality: 'ruhig, zuverlässig, lösungsorientiert' }
        ],
        greetingText: 'Hi, heute ist ein klassischer Vereins- und Utility-Flug. Bitte sauber und entspannt, wir haben einen klaren Ablauf.',
        paxText: '1 PAX (Vereinskoordination)',
        cargoPool: ['Werkzeug- und Dokumententasche (24 lbs)', 'Ersatzteilkiste (32 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'niedrig' },
        storyCue: 'Am Ziel ist ein kurzer Vereins- oder Utility-Termin am Flugplatz eingeplant.'
    },
    search_and_rescue: {
        id: 'search_and_rescue',
        label: 'Search and Rescue',
        appliesTo: ['poi'],
        roleProfile: 'rescue_coordination_v1',
        taskDomain: 'search_and_rescue',
        personas: [
            { name: 'Lea Winter', role: 'SAR-Koordinatorin', gender: 'female', personality: 'klar, belastbar, fokussiert' },
            { name: 'Jan Ritter', role: 'Rettungskoordinator', gender: 'male', personality: 'ruhig, strukturiert, entschlossen' }
        ],
        greetingText: 'Hi, wir arbeiten heute nach Suchmuster und klaren Calls. Stabilität und Übersicht sind entscheidend.',
        paxText: '1 PAX (SAR-Koordination)',
        cargoPool: ['Optik- und SAR-Kit (24 lbs)', 'Signalmittel und Kartenpaket (16 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'hoch' },
        storyCue: 'Fokus: Suchmuster, Lagebild und sichere Durchführung.'
    },
    fire_watch: {
        id: 'fire_watch',
        label: 'Fire Watch',
        appliesTo: ['poi'],
        roleProfile: 'fire_observer_ops_v1',
        taskDomain: 'fire_watch',
        personas: [
            { name: 'Klara Stein', role: 'Brandbeobachterin', gender: 'female', personality: 'sachlich, wachsam, präzise' },
            { name: 'Markus Adler', role: 'Einsatzbeobachter', gender: 'male', personality: 'ruhig, analytisch, professionell' }
        ],
        greetingText: 'Hi, wir halten heute nach Rauchfahnen und Hotspots Ausschau. Bitte möglichst sauber und stabil fliegen.',
        paxText: '1 PAX (Brandbeobachtung)',
        cargoPool: ['IR-Kamera und Tablet (21 lbs)', 'Feuerlage-Mapset (10 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: Frühwarnung, Hotspots und klare Meldungen.'
    },
    animal_transport: {
        id: 'animal_transport',
        label: 'Tiertransport',
        appliesTo: ['apt'],
        roleProfile: 'general_passenger_v1',
        taskDomain: 'animal_transport',
        personas: [
            { name: 'Eva Maurer', role: 'Tierpflegerin', gender: 'female', personality: 'einfühlsam, organisiert, ruhig' },
            { name: 'Tom Falk', role: 'Tierschutz-Kurier', gender: 'male', personality: 'ruhig, verantwortungsvoll, freundlich' }
        ],
        greetingText: 'Hi, wir haben heute Tiere an Bord. Bitte möglichst ruhig fliegen, damit sie entspannt bleiben.',
        paxText: '1 PAX (Tierbegleitung)',
        cargoPool: [
            'Transportbox mit junger Ziege (34 lbs)',
            'kleines Schaf in enger Transportbox (42 lbs)',
            'ruhige Reh-Verlegung in Transportbox (38 lbs)',
            'Moewe fuer die Wildvogelstation (18 lbs)',
            'Gans fuer die Auffangstation (24 lbs)',
            'Enten-Reha-Transferbox (22 lbs)',
            'Pferde-Vet-Dokumente fuer Einsatz am Zielort (12 lbs)',
            'Veterinaertasche und Tierfutter (18 lbs)'
        ],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'hoch', comfortPriority: 'hoch', urgencyPriority: 'niedrig' },
        storyCue: 'Fokus: stressarme Beförderung für ein konkretes, Piper-taugliches Tier; bei Ziege oder Schaf darf der enge Kabinenraum humorvoll anklingen.'
    }
};

function getMissionTaskProfile(profileId, baseType) {
    const id = String(profileId || 'auto').toLowerCase();
    const mode = String(baseType || '').toLowerCase();
    const profile = MISSION_ROLE_TASK_PROFILES[id] || MISSION_ROLE_TASK_PROFILES.auto;
    if (!profile) return null;
    if (!Array.isArray(profile.appliesTo) || profile.appliesTo.includes(mode)) return profile;
    return MISSION_ROLE_TASK_PROFILES.auto;
}

function _missionPickerMode() {
    const m = localStorage.getItem(MISSION_PICKER_STORAGE_KEY);
    if (m === 'full' || m === 'basic') return m;
    return 'full';
}

function _setMissionPickerMode(nextMode) {
    localStorage.setItem(MISSION_PICKER_STORAGE_KEY, nextMode === 'full' ? 'full' : 'basic');
}

function _optionByValue(mode, value) {
    return (MISSION_PICKER_OPTIONS[mode] || []).find(o => o.value === value) || null;
}

function _populateMissionTypeSelects(mode, preferredValue = null) {
    const classic = document.getElementById('targetType');
    const radio = document.getElementById('targetTypeRadio');
    if (!classic || !radio) return;

    const currentClassic = preferredValue || classic.value || radio.value || 'apt';
    const parsed = parseMissionPickerValue(currentClassic);
    let normalizedTarget = currentClassic;

    if (mode === 'basic') {
        const withProfile = (parsed.profile && parsed.profile !== 'auto') ? `${parsed.baseType}+${parsed.profile}` : '';
        normalizedTarget = _optionByValue(mode, withProfile) ? withProfile : parsed.baseType;
    } else if (!String(normalizedTarget).includes(':')) {
        const withProfile = (parsed.profile && parsed.profile !== 'auto')
            ? `${parsed.baseType}:all+${parsed.profile}`
            : `${parsed.baseType}:all`;
        normalizedTarget = _optionByValue(mode, withProfile) ? withProfile : `${parsed.baseType}:all`;
    }

    const options = MISSION_PICKER_OPTIONS[mode] || MISSION_PICKER_OPTIONS.basic;
    classic.innerHTML = '';
    radio.innerHTML = '';
    options.forEach(opt => {
        const c = document.createElement('option');
        c.value = opt.value;
        c.textContent = opt.classic;
        classic.appendChild(c);

        const r = document.createElement('option');
        r.value = opt.value;
        r.dataset.shortLabel = opt.radioShort || opt.radioFull || opt.classic;
        r.dataset.fullLabel = opt.radioFull || opt.classic;
        r.textContent = r.dataset.shortLabel;
        radio.appendChild(r);
    });

    if (!_optionByValue(mode, normalizedTarget)) {
        normalizedTarget = mode === 'full' ? `${parsed.baseType}:all` : parsed.baseType;
    }
    if (!_optionByValue(mode, normalizedTarget)) normalizedTarget = options[0]?.value || 'apt';

    classic.value = normalizedTarget;
    radio.value = normalizedTarget;
    _setNavcomTypeOptionsExpanded(false);
}

function refreshMissionPickerOptions(preferredValue = null) {
    _populateMissionTypeSelects(_missionPickerMode(), preferredValue);
}

function _setNavcomTypeOptionsExpanded(expanded) {
    const radio = document.getElementById('targetTypeRadio');
    if (!radio) return;
    for (const opt of radio.options) {
        const shortLabel = opt.dataset.shortLabel || opt.textContent;
        const fullLabel = opt.dataset.fullLabel || shortLabel;
        opt.textContent = expanded ? fullLabel : shortLabel;
    }
}

function setMissionTypeSelection(value) {
    const mode = _missionPickerMode();
    const classic = document.getElementById('targetType');
    const radio = document.getElementById('targetTypeRadio');
    if (!classic || !radio) return;
    const parsed = parseMissionPickerValue(value);
    let normalized = String(value || '').trim().toLowerCase();
    if (!_optionByValue(mode, normalized)) {
        if (mode === 'full') {
            const withProfile = (parsed.profile && parsed.profile !== 'auto')
                ? `${parsed.baseType}:all+${parsed.profile}`
                : `${parsed.baseType}:all`;
            normalized = _optionByValue(mode, withProfile) ? withProfile : `${parsed.baseType}:all`;
        } else {
            const withProfile = (parsed.profile && parsed.profile !== 'auto')
                ? `${parsed.baseType}+${parsed.profile}`
                : '';
            normalized = _optionByValue(mode, withProfile) ? withProfile : parsed.baseType;
        }
    }
    if (!_optionByValue(mode, normalized)) return;
    classic.value = normalized;
    radio.value = normalized;
    localStorage.setItem('ga_target_type', normalized);
    _setNavcomTypeOptionsExpanded(false);
    if (typeof updateOps1940Panel === 'function') updateOps1940Panel();
}

function toggleMissionPickerMode() {
    const curMode = _missionPickerMode();
    const nextMode = curMode === 'full' ? 'basic' : 'full';
    const currentValue = document.getElementById('targetType')?.value || 'apt';
    _setMissionPickerMode(nextMode);
    refreshMissionPickerOptions(currentValue);
    localStorage.setItem('ga_target_type', document.getElementById('targetType')?.value || 'apt');
    if (typeof updateOps1940Panel === 'function') updateOps1940Panel();
    const indicator = document.getElementById('searchIndicator');
    if (indicator) {
        indicator.innerText = nextMode === 'full'
            ? 'Mission Picker: Kategorien aktiviert'
            : 'Mission Picker: Basisansicht (APT/POI/Freiflug)';
        setTimeout(() => {
            if (indicator.innerText.includes('Mission Picker:')) indicator.innerText = 'System bereit.';
        }, 1600);
    }
}

function classifyAptMissionCategory(ms) {
    const t = normalizeMissionText(ms?.t || '');
    const s = normalizeMissionText(ms?.s || '');
    const all = `${t} ${s}`;
    if ((ms?.cat || '') === 'trn' || /training|ueb|checkflug|flight review|stall|vor|pattern|touch|go|steep|avionics|no-flap|crosswind/.test(all)) return 'trn';
    if (/organtransport|aog|labor|urgent mail|medicine|archive transport|flower delivery|high priority courier|art transfer|relocation flight|fracht|dokumente|ersatzteil|medikament|plasma|proben|transport/.test(all)) return 'cargo';
    if (/business charter|vip transfer|investor|unternehmer|meeting|bauabnahme|charter|kunde/.test(all)) return 'charter';
    if (/flugplatzfest|vereinsmaschine|kollegen-hilfe|piloten-stammtisch|fly-in|aeroclub|vereins/.test(all)) return 'club';
    return 'private';
}

function _offlineAptCategoryFallbacks(category = 'all') {
    const cat = String(category || 'all').toLowerCase();
    const byCat = {
        private: [
            { t: 'Panorama-Ausflug', i: '🌄', cat: 'std', s: 'Ein ruhiger Ausflugsflug mit Kaffee-Stop am Zielplatz. Fokus auf entspannte Anreise und schöne Aussicht.' },
            { t: 'Wochenend-Trip', i: '🧳', cat: 'std', s: 'Du bringst zwei Freunde für einen kurzen City-Trip zum Ziel. Kein Zeitdruck, komfortabel und sauber fliegen.' }
        ],
        club: [
            { t: 'Vereins-Shuttle', i: '🛩️', cat: 'std', s: 'Ein Vereinsmitglied muss zum Nachbarplatz, um Unterlagen für den Fliegerverein abzuholen.' },
            { t: 'Fly-In Vorbereitung', i: '🎪', cat: 'std', s: 'Für das nächste Fly-In fehlen noch Banner und Material vom Partnerverein am Zielplatz.' }
        ],
        charter: [
            { t: 'Business Charter', i: '🧑‍💼', cat: 'std', s: 'Ein Geschäftstermin am Ziel ist fix. Der Kunde braucht einen ruhigen, pünktlichen Charterflug.' },
            { t: 'Executive Transfer', i: '💼', cat: 'std', s: 'Ein Projektleiter mit engem Terminplan reist per Charter. Stabiler Flug und klare Zeitplanung sind wichtig.' }
        ],
        cargo: [
            { t: 'Kurierflug Dokumente', i: '📂', cat: 'std', s: 'Zeitkritische Dokumente müssen als Kurier zum Zielplatz. Kein Passagier an Bord.' },
            { t: 'Ersatzteil-Transport', i: '🔧', cat: 'std', s: 'Ein Ersatzteil wird dringend für eine abgestellte Maschine benötigt. Reiner Frachtflug ohne PAX.' }
        ],
        trn: [
            { t: 'Training: Airwork Basic', i: '🎓', cat: 'trn', s: 'Heute stehen saubere Airwork-Manöver an: stabile Kurven, Trimmarbeit und saubere Höhenhaltung.' },
            { t: 'Training: Pattern & Landing', i: '🛬', cat: 'trn', s: 'Trainingsflug mit Platzrundenfokus am Zielplatz, inklusive Go-Around-Entscheidung und sauberem Endanflug.' }
        ]
    };
    if (cat === 'all') {
        return []
            .concat(byCat.private, byCat.club, byCat.charter, byCat.cargo, byCat.trn)
            .map(x => ({ ...x }));
    }
    return (byCat[cat] || []).map(x => ({ ...x }));
}

function _offlineAptProfileFallbacks(profileId = 'auto') {
    const id = String(profileId || 'auto').toLowerCase();
    const byProfile = {
        medical_transfer: [
            { t: 'Organtransport', i: '🚑', cat: 'std', s: 'Medizinischer Notfall: Ein Organtransport muss ohne Verzögerung zur Klinik am Ziel gebracht werden.' },
            { t: 'Medicine Emergency', i: '💊', cat: 'std', s: 'Dringender Medizin-Transfer mit zeitkritischer Lieferung für die Notaufnahme am Zielort.' }
        ],
        cargo_fragile: [
            { t: 'Fragile Lab Cargo', i: '🧪', cat: 'std', s: 'Empfindliche Laborgeräte werden als fragile Fracht transportiert. Sanfte Flugführung ist Pflicht.' },
            { t: 'Art Transfer', i: '🖼️', cat: 'std', s: 'Zerbrechliches Kunstobjekt im Kurierflug. Harte Manöver und ruppige Landung vermeiden.' }
        ],
        animal_transport: [
            { t: 'Ziegenkurier', i: '🐐', cat: 'std', s: 'Eine junge Ziege muss zur Auffangstation. Ruhiger Flug, wenig Drama, aber bitte keine Rodeo-Landung.' },
            { t: 'Wildvogel-Transfer', i: '🪽', cat: 'std', s: 'Eine Möwe aus der Wildvogelstation reist in gesicherter Box zum Zielplatz. Sanft fliegen, sie kommentiert ohnehin schon genug.' },
            { t: 'Rehkitz-Verlegung', i: '🦌', cat: 'std', s: 'Ein kleines Wildtier wird mit Begleitung verlegt. Ruhig und weich fliegen, damit die Box nicht zur Achterbahn wird.' },
            { t: 'Horse-Vet Shuttle', i: '🐎', cat: 'std', s: 'Ein Tierarzt muss zu einem dringenden Einsatz auf ein Gestüt am Zielort.' }
        ],
        news_coverage: [
            { t: 'Reporter Shuttle', i: '📰', cat: 'std', s: 'Ein Reporterteam wird zum Zielplatz geflogen, um dort am Boden über ein Ereignis zu berichten.' },
            { t: 'Medien-Transfer', i: '🎥', cat: 'std', s: 'Kamerateam und Equipment müssen pünktlich am Ziel sein; die eigentliche Berichterstattung startet nach der Landung.' }
        ],
        sightseeing_tour: [
            { t: 'Sightseeing Charter', i: '🌤️', cat: 'std', s: 'Entspannter Ausflugsflug mit Fokus auf Aussicht und angenehmer Fluglage.' },
            { t: 'Panorama-Rundflug Transfer', i: '🏞️', cat: 'std', s: 'Ruhiger Tourflug zum Ziel mit anschließendem lokalen Ausflugsprogramm am Boden.' }
        ]
    };
    return (byProfile[id] || []).map(x => ({ ...x }));
}

function buildOfflineAptMissionPool(selectedAptCategory = 'all', dispatchProfileId = 'auto') {
    const profileId = String(dispatchProfileId || 'auto').toLowerCase();
    const aptCategories = ['private', 'club', 'charter', 'cargo', 'trn'];
    const requestedCategory = String(selectedAptCategory || 'all').toLowerCase();
    const rolledCategory = (requestedCategory === 'all')
        ? aptCategories[Math.floor(Math.random() * aptCategories.length)]
        : requestedCategory;
    const categoryPool = _offlineAptCategoryFallbacks(rolledCategory);
    const profilePool = _offlineAptProfileFallbacks(profileId);
    // Wichtig: Bei explizitem Profil nicht mit Kategoriepool mischen.
    // So bleibt das Auftragsthema konsistent (z.B. Medizin bleibt Medizin).
    if (profileId !== 'auto' && profilePool.length >= 2) return profilePool;
    if (profileId !== 'auto' && profilePool.length > 0) {
        return [...profilePool, ..._offlineAptProfileFallbacks(profileId)].slice(0, 2);
    }
    // Bei AUTO strikt in einer (gewürfelten oder expliziten) Kategorie bleiben.
    if (categoryPool.length >= 2) return categoryPool.slice(0, 2);
    const fallbackCat = _offlineAptCategoryFallbacks('private');
    return fallbackCat.slice(0, 2);
}

function _offlinePoiCategoryFallbacks(category = 'all', poiName = 'Zielgebiet') {
    const cat = String(category || 'all').toLowerCase();
    const n = String(poiName || 'Zielgebiet');
    const byCat = {
        bridge: [
            { t: `Brücken-Inspektion: ${n}`, i: '🌉', cat: 'poi', s: `Ein Technikteam dokumentiert mögliche Schäden an ${n}. Fliege ruhige Passes für klare Sichtfenster auf Bauwerk, Widerlager und Fahrbahnrand.`, payloadText: '1 PAX (Inspektion)', cargoText: 'Kamera-Gimbal (120 lbs)' },
            { t: `Pfeilerfundamente: ${n}`, i: '🧱', cat: 'poi', s: `Die Bauwerksprüfung braucht aktuelle Luftbilder der Pfeiler, Fundamente und Widerlager von ${n}. Halte stabile Blickwinkel entlang des Bauwerks.`, payloadText: '1 PAX (Bauwerksprüfung)', cargoText: 'Inspektionskamera und Checklisten (18 lbs)' },
            { t: `Bahnviadukt-Dokumentation: ${n}`, i: '🚄', cat: 'poi', s: `Für ${n} sollen Trasse, Viaduktbogen und angrenzende Zufahrten sauber dokumentiert werden. Fokus ist das Brückenbauwerk, nicht die Straße darunter.`, payloadText: '1 PAX (Infrastruktur-Technik)', cargoText: 'Teleobjektiv-Set (22 lbs)' },
            { t: `Unterführung / Hochstraße: ${n}`, i: '🛣️', cat: 'poi', s: `Bei ${n} soll die Lage von Unterführung, Hochstraße oder Brückendeck aus der Luft erfasst werden. Fliege so, dass Zufahrten und Bauwerksränder getrennt erkennbar bleiben.`, payloadText: '1 PAX (Verkehrsplanung)', cargoText: 'Tablet mit Planunterlagen (16 lbs)' },
            { t: `Brückensperrung: ${n}`, i: '🚧', cat: 'poi', s: `Die Leitstelle benötigt ein nüchternes Luftlagebild zu einer möglichen Sperrung an ${n}. Dokumentiere Zufahrt, Rückstau und sichtbare Absperrbereiche ohne Einsatzdramatisierung.`, payloadText: '1 PAX (Lagebeobachtung)', cargoText: 'Live-Link Set (40 lbs)' },
            { t: `Hochwasser an Pfeilern: ${n}`, i: '💧', cat: 'poi', s: `Nach Starkregen sollen Wasserstand, Treibgutlage und Anströmung an den Brückenpfeilern von ${n} geprüft werden. Fliege gleichmäßige Beobachtungskreise.`, payloadText: '1 PAX (Wasserbau)', cargoText: 'Sensorpaket (50 lbs)' },
            { t: `Denkmalschutz-Doku: ${n}`, i: '🏛️', cat: 'poi', s: `Für den Denkmalschutz werden aktuelle Luftbilder von ${n} benötigt. Wichtig sind klare Perspektiven auf Bögen, Pfeiler, Materialzustand und Einbindung ins Umfeld.`, payloadText: '1 PAX (Denkmalpflege)', cargoText: 'Fotoausrüstung (35 lbs)' },
            { t: `Betreiber-Fotos: ${n}`, i: '📸', cat: 'poi', s: `Der Betreiber braucht verwertbare Luftbilder von ${n} für Dokumentation und Bericht. Ruhige Bögen und stabile Takes sind wichtiger als Tempo.`, payloadText: '1 PAX (Fotografie)', cargoText: 'Kamera-Gimbal (34 lbs)' }
        ],
        road: [
            { t: `Trassen-Check: ${n}`, i: '🛣️', cat: 'poi', s: `Für ${n} sollen Engstellen und Baustellen dokumentiert werden. Fliege systematisch entlang der Haupttrasse.`, payloadText: '1 PAX (Straßenbau)', cargoText: 'Dokukit (35 lbs)' },
            { t: `Stau-Lagebild: ${n}`, i: '🚗', cat: 'poi', s: `Ein Lagezentrum braucht ein aktuelles Verkehrsbild über ${n}. Klare, ruhige Reporting-Passes sind gefragt.`, payloadText: '1 PAX (Lagebeobachtung)', cargoText: 'Live-Link Set (40 lbs)' }
        ],
        dam: [
            { t: `Dammkontrolle: ${n}`, i: '🧱', cat: 'poi', s: `Für ${n} wird eine Luftsichtkontrolle der Bauwerksstruktur angefordert. Bitte stabil und präzise anfliegen.`, payloadText: '1 PAX (Wasserbau)', cargoText: 'Messkoffer (60 lbs)' },
            { t: `Hochwasser-Scan: ${n}`, i: '💧', cat: 'poi', s: `Die Behörde prüft Überläufe und Uferkanten bei ${n}. Fliege gleichmäßige Linien für belastbare Vergleichsbilder.`, payloadText: '1 PAX (Behörde)', cargoText: 'Sensorpaket (50 lbs)' }
        ],
        telecom: [
            { t: `Funkmast-Prüfung: ${n}`, i: '📡', cat: 'poi', s: `An ${n} stehen Wartungsarbeiten an. Das Team braucht eine Sichtkontrolle aus der Luft vor dem Einsatz.`, payloadText: '1 PAX (Netztechnik)', cargoText: 'Richtantenne (35 lbs)' },
            { t: `Signalabdeckung: ${n}`, i: '🛰️', cat: 'poi', s: `Die Netzqualität rund um ${n} soll gemessen werden. Halte ruhige Bahnen für konsistente Messreihen.`, payloadText: '1 PAX (Messflug)', cargoText: 'Spektrumanalysator (55 lbs)' }
        ],
        industry: [
            { t: `Anlagen-Dokumentation: ${n}`, i: '🏭', cat: 'poi', s: `Für ${n} werden aktuelle Luftaufnahmen des Anlagenzustands benötigt. Fokus auf strukturierte Überflüge.`, payloadText: '1 PAX (Inspektion)', cargoText: 'Kamera-Set (70 lbs)' },
            { t: `Sicherheitsbegehung Luft: ${n}`, i: '🦺', cat: 'poi', s: `Das Sicherheitsteam bewertet kritische Bereiche von ${n} aus der Luft. Fliege präzise und ohne Hektik.`, payloadText: '1 PAX (Safety)', cargoText: 'Checklisten & Tablet (20 lbs)' }
        ],
        infrastructure: [
            { t: `Infrastruktur-Inspektion: ${n}`, i: '🛠️', cat: 'poi', s: `Entlang ${n} werden Straße, Bahn und Energieinfrastruktur auf Auffälligkeiten geprüft. Fliege stabil mit klaren Beobachtungsfenstern.`, payloadText: '1 PAX (Infrastruktur-Techniker)', cargoText: 'Inspektionskoffer und Tablet (42 lbs)' },
            { t: `Trassen-Vermessung: ${n}`, i: '📐', cat: 'poi', s: `Für ${n} ist ein Kontroll- und Vermessungsflug entlang von Trassen und Netzknoten geplant. Fokus auf saubere, reproduzierbare Linien.`, payloadText: '1 PAX (Vermessung)', cargoText: 'Lidar- und Messpaket (88 lbs)' }
        ],
        castle: [
            { t: `Denkmaldoku: ${n}`, i: '🏰', cat: 'poi', s: `Für ${n} werden aktuelle Luftbilder für den Denkmalschutz benötigt. Ruhige Kreise für saubere Perspektiven.`, payloadText: '1 PAX (Denkmalpflege)', cargoText: 'Fotoausrüstung (35 lbs)' },
            { t: `Tourismus-Aufnahmen: ${n}`, i: '📸', cat: 'poi', s: `Der Tourismusverband plant neues Bildmaterial für ${n}. Fliege einen ruhigen Fotoeinsatz.`, payloadText: '1 PAX (Fotograf)', cargoText: 'Teleobjektive (40 lbs)' }
        ],
        water: [
            { t: `Gewässerbeobachtung: ${n}`, i: '🌊', cat: 'poi', s: `Bei ${n} sollen Wasserstand und Uferentwicklung dokumentiert werden. Fokus auf klare, reproduzierbare Linien.`, payloadText: '1 PAX (Umweltamt)', cargoText: 'Sensorik (45 lbs)' },
            { t: `Schifffahrtslage: ${n}`, i: '🚢', cat: 'poi', s: `Für ${n} wird ein aktuelles Lagebild der Schifffahrt benötigt. Halte ruhige Beobachtungsmuster.`, payloadText: '1 PAX (Lagezentrum)', cargoText: 'Beobachtungskit (30 lbs)' }
        ],
        mountain: [
            { t: `Topo-Scan: ${n}`, i: '⛰️', cat: 'poi', s: `Für ${n} wird ein Vermessungsflug durchgeführt. Fliege ein sauberes Muster für belastbare Topodaten.`, payloadText: '1 PAX (Vermessung)', cargoText: 'Lidar-Scanner (180 lbs)' },
            { t: `Forstlage: ${n}`, i: '🌲', cat: 'poi', s: `Im Gebiet ${n} soll der Waldzustand aus der Luft dokumentiert werden. Fokus auf klare Sichtachsen und stabile Höhe.`, payloadText: '1 PAX (Forst)', cargoText: 'Kamera/IR-Kit (65 lbs)' }
        ],
        city: [
            { t: `Stadtlage-Report: ${n}`, i: '🏙️', cat: 'poi', s: `Für ${n} wird ein aktuelles Luft-Lagebild für Planung und Verkehrslenkung benötigt.`, payloadText: '1 PAX (Stadtplanung)', cargoText: 'Dokuset (25 lbs)' },
            { t: `Event-Überblick: ${n}`, i: '🎤', cat: 'poi', s: `Rund um ${n} soll ein Event aus der Luft beobachtet werden. Ruhige Kreise und klare Meldepunkte.`, payloadText: '1 PAX (Koordination)', cargoText: 'Kamera-Set (30 lbs)' }
        ],
        generic: [
            { t: `POI-Dokumentation: ${n}`, i: '📍', cat: 'poi', s: `Für ${n} wird eine strukturierte Luftdokumentation angefordert. Fliege präzise und stabil.`, payloadText: '1 PAX (Beobachter)', cargoText: 'Kamera-Set (25 lbs)' },
            { t: `Luftlage vor Ort: ${n}`, i: '🗺️', cat: 'poi', s: `Ein kurzer Lageflug über ${n} soll die aktuelle Situation erfassen.`, payloadText: '1 PAX (Lagebeobachtung)', cargoText: 'Tablet & Karten (15 lbs)' }
        ]
    };
    if (cat === 'all') {
        return Object.values(byCat).flat().map(x => ({ ...x }));
    }
    return (byCat[cat] || byCat.generic || []).map(x => ({ ...x }));
}

function _offlinePoiProfileFallbacks(profileId = 'auto', poiName = 'Zielgebiet') {
    const id = String(profileId || 'auto').toLowerCase();
    const n = String(poiName || 'Zielgebiet');
    const byProfile = {
        mapping_survey: [
            { t: `Mapping-Survey: ${n}`, i: '📏', cat: 'poi', s: `Für ${n} läuft ein Vermessungsflug mit Scan- und Kartierfokus. Fliege reproduzierbare Linien.`, payloadText: '1 PAX (Survey-Technik)', cargoText: 'Lidar-Scanner (180 lbs)' },
            { t: `Photogrammetrie-Pass: ${n}`, i: '🛰️', cat: 'poi', s: `Ein Team erstellt ein neues Orthofoto-Mosaik von ${n}. Stabilität und exakte Passes sind entscheidend.`, payloadText: '1 PAX (Photogrammetrie)', cargoText: 'Photogrammetrie-Kamera (34 lbs)' },
            { t: `Korridor-Mapping: ${n}`, i: '📐', cat: 'poi', s: `Bei ${n} wird ein kurzer Korridor für die Kartenaktualisierung abgeflogen. Wichtig sind gleichmäßige Linien und ein sauberer Blick auf das Hauptziel.`, payloadText: '1 PAX (Geodaten-Technik)', cargoText: 'GPS-Logger und Kamera (22 lbs)' },
            { t: `Bestandsaufnahme/Dokumentation: ${n}`, i: '🗺️', cat: 'poi', s: `Für ${n} sollen aktuelle Vergleichsbilder und eine kurze Luftdokumentation entstehen. Wir fliegen ruhig, damit Gebäude, Ufer, Trassen oder Geländeformen sauber zugeordnet werden können.`, payloadText: '1 PAX (Vermessung)', cargoText: 'Tablet und Referenzkarten (18 lbs)' }
        ],
        news_coverage: [
            { t: `Reporter-POI: ${n}`, i: '📰', cat: 'poi', s: `Ein Reporterteam beobachtet die Lage rund um ${n} aus der Luft, bevor die Berichterstattung am Boden startet.`, payloadText: '1 PAX (Reporter)', cargoText: 'Live-Übertragungsrucksack (26 lbs)' },
            { t: `Medienlage: ${n}`, i: '🎥', cat: 'poi', s: `Für ${n} wird eine nüchterne Luftbeobachtung für einen TV-Beitrag benötigt.`, payloadText: '1 PAX (TV-Reporter)', cargoText: 'Kamera- und Audio-Set (32 lbs)' },
            { t: `Redaktionsflug: ${n}`, i: '📷', cat: 'poi', s: `Die Lokalredaktion braucht ein aktuelles Luftbild von ${n} und der direkten Umgebung. Der Auftrag bleibt sachlich: Überblick, Orientierung, keine dramatische Zuspitzung.`, payloadText: '1 PAX (Reporterin)', cargoText: 'Foto- und Audio-Set (24 lbs)' },
            { t: `Establishing Shots: ${n}`, i: '🎬', cat: 'poi', s: `Ein kleines TV-Team sammelt ruhige Establishing Shots von ${n}. Wir liefern kurze, klare Perspektiven, ohne den Flug zu einem Touristenrundflug zu machen.`, payloadText: '1 PAX (Kamera-Redaktion)', cargoText: 'Kamerarucksack (28 lbs)' }
        ],
        inspection_infra: [
            { t: `Zustandsprüfung: ${n}`, i: '🛠️', cat: 'poi', s: `Bei ${n} soll der aktuelle Zustand aus der Luft dokumentiert werden: Schäden, Wartungspunkte und auffällige Veränderungen. Fliege ruhige Passes mit klaren Sichtfenstern.`, payloadText: '1 PAX (Bauwerksprüfung)', cargoText: 'Inspektionskamera und Checklisten (18 lbs)' },
            { t: `Wartungsdoku: ${n}`, i: '🔧', cat: 'poi', s: `Ein Technikteam braucht aktuelle Luftbilder von ${n}, um Wartung und mögliche Störungen zu priorisieren. Fokus auf stabile Blickwinkel, nicht auf Geologie.`, payloadText: '1 PAX (Infrastruktur-Technik)', cargoText: 'Wärmebildkamera und Tablet (26 lbs)' },
            { t: `Sturmschaden-Check: ${n}`, i: '🌬️', cat: 'poi', s: `Nach dem letzten Sturm sollen Dächer, Trassen, Anlagenkanten und exponierte Bauteile bei ${n} visuell geprüft werden. Dokumentiere Auffälligkeiten sauber aus der Luft.`, payloadText: '1 PAX (Schadensgutachter)', cargoText: 'Kamera-Gimbal und Messkoffer (42 lbs)' },
            { t: `Baufortschritt: ${n}`, i: '🏗️', cat: 'poi', s: `Für ${n} werden Vergleichsbilder zum Bau- oder Instandhaltungsfortschritt benötigt. Fliege reproduzierbare Blickachsen für die Projektdokumentation.`, payloadText: '1 PAX (Projektleitung)', cargoText: 'Tablet mit Bauplänen (16 lbs)' }
        ],
        media_photo: [
            { t: `Firmenaufnahmen: ${n}`, i: '🎥', cat: 'poi', s: `Ein kleines Medienteam braucht professionelle Luftaufnahmen von ${n} für Firmenkommunikation und Dokumentation. Ruhige Bögen und stabile Takes sind wichtiger als Tempo.`, payloadText: '1 PAX (Kamera)', cargoText: 'Kamera-Gimbal (34 lbs)' },
            { t: `Luftbildserie: ${n}`, i: '📸', cat: 'poi', s: `Für ${n} entsteht eine aktuelle Foto- und Filmserie aus der Luft. Ziel sind klare Perspektiven auf Anlage, Bauwerk und Umgebung.`, payloadText: '1 PAX (Fotografie)', cargoText: 'Teleobjektiv-Set (22 lbs)' },
            { t: `Dokufilm-Shots: ${n}`, i: '🎬', cat: 'poi', s: `Eine Produktionsfirma sammelt ruhige Establishing Shots von ${n}. Fliege saubere Kreise und vermeide hektische Manöver.`, payloadText: '1 PAX (Filmcrew)', cargoText: 'Film- und Akkukoffer (28 lbs)' },
            { t: `PR-Dokumentation: ${n}`, i: '🏢', cat: 'poi', s: `Der Betreiber von ${n} benötigt aktuelle Luftbilder für Bericht, Webseite oder interne Präsentation. Es geht um verwertbare Aufnahmen, nicht um technische Diagnose.`, payloadText: '1 PAX (Medienproduktion)', cargoText: 'Kamerarucksack (20 lbs)' }
        ],
        search_and_rescue: [
            { t: `SAR-Suchmuster: ${n}`, i: '🛟', cat: 'poi', s: `Im Bereich ${n} wird entlang von Trassen, Flusslauf und Bahnstrecke gesucht. Fliege ein strukturiertes SAR-Suchmuster und melde Auffälligkeiten sofort.`, payloadText: '1 PAX (SAR-Koordination)', cargoText: 'Optik- und SAR-Kit (24 lbs)' },
            { t: `Rettungsaufklärung: ${n}`, i: '🚨', cat: 'poi', s: `Für ${n} wird ein Luftlagebild möglicher Unfallkorridore an Straße, Fluss und Schiene benötigt. Priorität liegt auf klaren Calls und Suchsektoren.`, payloadText: '1 PAX (Rettungskoordinator)', cargoText: 'Signalmittel und Kartenpaket (16 lbs)' },
            { t: `Vermisstensuche: ${n}`, i: '🔎', cat: 'poi', s: `Rund um ${n} wird eine vermisste Person gesucht. Wir prüfen Ufer, Waldrand, Wege oder Böschungen mit ruhigen Kreisen und geben nur klare Sichtmeldungen weiter.`, payloadText: '1 PAX (SAR-Koordination)', cargoText: 'Fernglas und Kartenpaket (14 lbs)' },
            { t: `Hinweis-Check: ${n}`, i: '📍', cat: 'poi', s: `Die Leitstelle hat einen möglichen Hinweis im Bereich ${n}. Wir fliegen einen kurzen Suchsektor ab und achten auf einzelne Personen, Fahrzeuge oder Ausrüstung am Boden.`, payloadText: '1 PAX (Rettungskoordinator)', cargoText: 'Optik- und Funkkit (20 lbs)' }
        ],
        fire_watch: [
            { t: `Fire Watch: ${n}`, i: '🔥', cat: 'poi', s: `Im Gebiet ${n} wird Feuerwacht geflogen. Halte Ausschau nach Rauchfahnen, Hotspots und neuen Brandherden.`, payloadText: '1 PAX (Brandbeobachtung)', cargoText: 'Feuerlage-Mapset (10 lbs)' },
            { t: `Waldbrand-Frühwarnung: ${n}`, i: '🌲', cat: 'poi', s: `Für ${n} läuft ein Frühwarnflug wegen erhöhter Waldbrandgefahr. Fokus auf Hotspots und klare Meldungen.`, payloadText: '1 PAX (Einsatzbeobachter)', cargoText: 'IR-Kamera und Tablet (21 lbs)' },
            { t: `Rauchmelderunde: ${n}`, i: '🌫️', cat: 'poi', s: `Im Umfeld von ${n} wurde leichter Rauchgeruch gemeldet. Wir prüfen Waldrand, Hang und offene Flächen aus sicherer Höhe, ohne eine Großlage anzunehmen.`, payloadText: '1 PAX (Brandbeobachter)', cargoText: 'Wärmebild-Tablet (16 lbs)' },
            { t: `Hotspot-Check: ${n}`, i: '🧯', cat: 'poi', s: `Nach trockenen Tagen soll ${n} auf mögliche Hotspots kontrolliert werden. Gesucht werden kleine Rauchfahnen oder auffällige warme Stellen, keine Einsatzkolonne.`, payloadText: '1 PAX (Einsatzbeobachtung)', cargoText: 'IR-Kamera und Karten (19 lbs)' }
        ],
        historian_guided_tour: [
            { t: `Historikerflug: ${n}`, i: '📜', cat: 'poi', s: `Ein Historiker begleitet den Flug zu ${n} und gibt unterwegs kurze geschichtliche Einordnungen zu Ort, Nutzung und Entwicklung.`, payloadText: '1 PAX (Historiker)', cargoText: 'Archivunterlagen und Karten (14 lbs)' },
            { t: `Zeitreise aus der Luft: ${n}`, i: '🏛️', cat: 'poi', s: `Für ${n} ist ein ruhiger Rundflug mit historischer Kontext-Erklärung geplant. Fokus liegt auf Orientierung und klaren Sichtachsen.`, payloadText: '1 PAX (Historikerin)', cargoText: 'Tablet mit historischen Luftbildern (9 lbs)' },
            { t: `Ortsgeschichte: ${n}`, i: '🏺', cat: 'poi', s: `Rund um ${n} soll die historische Entwicklung der Landschaft, Bebauung oder Nutzung aus der Luft eingeordnet werden. Es geht um Geschichte, nicht um Inspektion.`, payloadText: '1 PAX (Historiker)', cargoText: 'Notizen und Karten (8 lbs)' },
            { t: `Kulturroute: ${n}`, i: '🏛️', cat: 'poi', s: `Eine Historikerin nutzt den Flug nach ${n}, um sichtbare Spuren von Siedlung, Verkehr oder Wasserbau zu erklären. Wir bleiben ruhig und gut orientierbar.`, payloadText: '1 PAX (Historikerin)', cargoText: 'Archivmappe (11 lbs)' }
        ],
        science_bio: [
            { t: `Umweltbeobachtung: ${n}`, i: '🧪', cat: 'poi', s: `Bei ${n} wird ein biologischer Beobachtungsflug durchgeführt. Fokus auf Vegetation, Gewässerrand und mögliche Stressindikatoren.`, payloadText: '1 PAX (Biologe)', cargoText: 'Umweltsensorik und Kamera (18 lbs)' },
            { t: `Ökologie-Check: ${n}`, i: '🦉', cat: 'poi', s: `Für ${n} soll eine kurze ökologische Lageeinschätzung aus der Luft erstellt werden. Wir fliegen ruhig und dokumentieren sauber.`, payloadText: '1 PAX (Ökologin)', cargoText: 'Feldnotizen und GPS-Logger (9 lbs)' },
            { t: `Habitat-Runde: ${n}`, i: '🌿', cat: 'poi', s: `Die Biologin möchte bei ${n} Ufer, Waldrand oder offene Vegetationsflächen vergleichen. Wir achten auf Muster im Bewuchs, nicht auf technische Schäden.`, payloadText: '1 PAX (Biologin)', cargoText: 'Kamera und GPS-Logger (12 lbs)' },
            { t: `Vegetationsmonitoring: ${n}`, i: '🍃', cat: 'poi', s: `Bei ${n} werden Baumkronen, Uferzonen oder trockene Randstreifen dokumentiert. Der Flug bleibt ruhig, damit die Beobachtung später auswertbar ist.`, payloadText: '1 PAX (Ökologe)', cargoText: 'Umweltsensorik (15 lbs)' }
        ],
        science_geo: [
            { t: `Geologie-Pass: ${n}`, i: '🪨', cat: 'poi', s: `Rund um ${n} werden Erosion, Hangformen und Reliefmerkmale aus der Luft beurteilt. Wir brauchen reproduzierbare Linien.`, payloadText: '1 PAX (Geologe)', cargoText: 'Geologie-Mapset und Tablet (12 lbs)' },
            { t: `Relief-Analyse: ${n}`, i: '🏔️', cat: 'poi', s: `Für ${n} wird eine geomorphologische Kurzaufnahme geflogen, um markante Strukturen und mögliche Veränderungen zu bewerten.`, payloadText: '1 PAX (Geomorphologin)', cargoText: 'Kamera und Laser-Entfernungsmesser (14 lbs)' },
            { t: `Erosionsblick: ${n}`, i: '🪨', cat: 'poi', s: `Bei ${n} sollen Uferkanten, Hänge oder Einschnitte auf sichtbare Erosionsspuren geprüft werden. Wir liefern ruhige Vergleichsperspektiven.`, payloadText: '1 PAX (Geologin)', cargoText: 'Geologie-Tablet (10 lbs)' },
            { t: `Geländekanten-Check: ${n}`, i: '⛰️', cat: 'poi', s: `Der Geomorphologe bewertet bei ${n} Geländekanten, Sedimentflächen oder frühere Abbauzonen. Der Flug braucht klare Blickwinkel, aber keine Einsatzdramaturgie.`, payloadText: '1 PAX (Geomorphologe)', cargoText: 'Kamera und Karten (13 lbs)' }
        ],
        sightseeing_tour: [
            { t: `Panorama-Rundflug: ${n}`, i: '🌤️', cat: 'poi', s: `Ein ruhiger Sightseeingflug über ${n} mit Fokus auf angenehme Fluglage und gute Aussicht.`, payloadText: '2 PAX (Sightseeing-Gäste)', cargoText: 'Kleine Kamerataschen (12 lbs)' },
            { t: `Aussichtsflug: ${n}`, i: '🏞️', cat: 'poi', s: `Die Gäste wünschen einen entspannten Rundflug über ${n}, ohne Hektik und mit weichen Manövern.`, payloadText: '2 PAX (Tour-Gäste)', cargoText: 'Tagesrucksäcke (15 lbs)' },
            { t: `Foto-Ausflug: ${n}`, i: '📸', cat: 'poi', s: `Die Gäste möchten ${n} aus der Luft sehen und ein paar ruhige Fotos machen. Kein Auftrag, keine Inspektion, einfach ein sauber geflogener Ausblick.`, payloadText: '2 PAX (Ausflugsgäste)', cargoText: 'Kleine Kamerataschen (10 lbs)' },
            { t: `Orientierungsrunde: ${n}`, i: '🧭', cat: 'poi', s: `Ein entspannter Rundflug zu ${n}: kurz zeigen, wie Ziel und Umgebung zusammenliegen, dann wieder zurück. Weiche Kurven und gute Sicht sind wichtiger als Tempo.`, payloadText: '2 PAX (Sightseeing-Gäste)', cargoText: 'Tagesrucksäcke (12 lbs)' }
        ],
        tour_guide_knowledge: [
            { t: `Wissensflug: ${n}`, i: '📚', cat: 'poi', s: `Der Lern-Guide erklärt bei ${n} kurze Fakten zu Lage, Nutzung und sichtbarer Umgebung. Es gibt keinen Arbeitsauftrag, nur Orientierung und Einordnung.`, payloadText: '1 PAX (Lern-Guide)', cargoText: 'Tablet mit Ortsfakten (3 lbs)' },
            { t: `POI-Erklärung: ${n}`, i: '🧭', cat: 'poi', s: `Bei ${n} geht es um verständliche Ortskunde aus der Luft. Wir fliegen ruhig, damit Ziel, Nachbarschaft und Landschaft gut zu erkennen sind.`, payloadText: '1 PAX (Tour-Guide)', cargoText: 'Notizbuch und Reiseführer (4 lbs)' },
            { t: `Faktenrunde: ${n}`, i: '💬', cat: 'poi', s: `Der Guide nutzt ${n} als Lernpunkt und ordnet sichtbare Merkmale knapp ein. Keine Suche, keine Messung, keine Einsatzlage.`, payloadText: '1 PAX (Lern-Guide)', cargoText: 'Tablet mit Karten (5 lbs)' },
            { t: `Kontextflug: ${n}`, i: '🗺️', cat: 'poi', s: `Wir besuchen ${n}, um den Ort im Gelände zu verstehen: was liegt daneben, welche Wege oder Gewässer rahmen das Ziel ein, und warum ist es auffällig.`, payloadText: '1 PAX (Tour-Guide)', cargoText: 'Reiseführer und Tablet (5 lbs)' }
        ]
    };
    return (byProfile[id] || []).map(x => ({ ...x }));
}

function buildOfflinePoiMissionPool(selectedPoiCategory = 'all', dispatchProfileId = 'auto', poiName = 'Zielgebiet') {
    const profileId = String(dispatchProfileId || 'auto').toLowerCase();
    const poiCategories = ['bridge', 'road', 'dam', 'telecom', 'industry', 'infrastructure', 'castle', 'water', 'mountain', 'city', 'generic'];
    const requestedCategory = String(selectedPoiCategory || 'all').toLowerCase();
    const rolledCategory = (requestedCategory === 'all')
        ? poiCategories[Math.floor(Math.random() * poiCategories.length)]
        : requestedCategory;
    const categoryPool = _offlinePoiCategoryFallbacks(rolledCategory, poiName);
    const profilePool = _offlinePoiProfileFallbacks(profileId, poiName);
    // Wichtig: Bei explizitem Profil nicht mit Kategoriepool mischen.
    // Verhindert Themenbruch wie "Fotoshooting + Hotspot-Suche".
    if (profileId !== 'auto' && profilePool.length >= 2) return profilePool;
    if (profileId !== 'auto' && profilePool.length > 0) {
        return [...profilePool, ..._offlinePoiProfileFallbacks(profileId, poiName)].slice(0, 2);
    }
    // Bei AUTO strikt in einer (gewürfelten oder expliziten) Kategorie bleiben.
    if (categoryPool.length >= 2) return categoryPool.slice(0, 2);
    const fallbackCat = _offlinePoiCategoryFallbacks('generic', poiName);
    return fallbackCat.slice(0, 2);
}

function pickOfflineMissionFromPool(pool = [], historyKey = 'ga_offline_mission_history') {
    const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
    if (!src.length) return null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch (_) { history = []; }
    if (!Array.isArray(history)) history = [];
    const fresh = src.filter(m => !history.includes(String(m.t || '')));
    const effective = fresh.length ? fresh : src;
    const pick = effective[Math.floor(Math.random() * effective.length)] || src[0];
    history.push(String(pick.t || ''));
    if (history.length > 16) history.shift();
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch (_) {}
    return pick;
}

const MISSION_NOTE_IDS = ['notePage1', 'notePage2', 'notePage3', 'notePage4', 'notePage5'];
const MISSION_NOTE_CLASSES = ['front-note', 'back-note', 'third-note', 'fourth-note', 'fifth-note'];

function setMissionNoteFrontIndex(frontIdx = 0) {
    const pages = MISSION_NOTE_IDS.map(id => document.getElementById(id)).filter(Boolean);
    if (pages.length < 2) return;
    const normalizedIdx = ((frontIdx % pages.length) + pages.length) % pages.length;
    for (let i = 0; i < pages.length; i++) {
        const pageIdx = (normalizedIdx + i) % pages.length;
        pages[pageIdx].className = 'mission-note-page ' + MISSION_NOTE_CLASSES[i];
    }
}

function turnMissionNotePage(direction = 1) {
    const pages = MISSION_NOTE_IDS.map(id => document.getElementById(id)).filter(Boolean);
    if (pages.length < 2) return;
    let frontIdx = pages.findIndex(p => p.classList.contains('front-note'));
    if (frontIdx < 0) frontIdx = 0;
    const step = direction < 0 ? -1 : 1;
    setMissionNoteFrontIndex(frontIdx + step);
}

function turnOpsBriefingPage(event, direction = 1) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    turnMissionNotePage(direction);
}

function toggleNotes(event) {
    // Wenn wir auf einen Link, Button oder ein Pin-Icon klicken, umblättern hart blockieren
    if (event && event.target && (
        event.target.tagName === 'A' ||
        event.target.tagName === 'BUTTON' ||
        event.target.classList.contains('briefing-save-pin') ||
        event.target.classList.contains('briefing-export-pin') ||
        event.target.classList.contains('briefing-pdf-pin')
    )) return;

    let forward = true;
    if (event && event.target && event.target.classList.contains('paperclip')) {
        forward = false;
    } else if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        if (clickX < rect.width / 2) forward = false;
    } else if (event) {
        if (event.clientX < window.innerWidth / 2) forward = false;
    }

    turnMissionNotePage(forward ? 1 : -1);
}

function toggleWikiPhoto(event, containerId) {
    const container = document.getElementById(containerId);
    if (!container) { event.stopPropagation(); return; }

    // ── ZOOM-OUT: Placeholder im DOM → Element ist gerade gezoomt ──
    const placeholder = document.getElementById('photo-zoom-placeholder');
    if (placeholder) {
        event.stopPropagation();
        const origTransform = container.dataset.wikiOrigTransform || '';
        const rotMatch  = origTransform.match(/rotate\(([^)]+)\)/);
        const origAngle = rotMatch ? rotMatch[1] : '0deg';

        // Viewport-Mitte und Startskalierung aus Zoom-In wiederverwenden
        const vpCx       = parseFloat(container.dataset.wikiVpCx  || window.innerWidth  / 2);
        const vpCy       = parseFloat(container.dataset.wikiVpCy  || window.innerHeight * 0.42);
        const startScale = parseFloat(container.dataset.wikiZoomStartScale || 0.35);

        // Platzhalter-Mitte = Viewport-Position der Originalstelle (dank margin-left:auto im Platzhalter korrekt)
        const phRect = placeholder.getBoundingClientRect();
        const phCx   = phRect.left + phRect.width  / 2;
        const phCy   = phRect.top  + phRect.height / 2;

        // Schliess-Transform: von Mitte (translate 0,0 scale 1) zurück zur Originalposition (startScale)
        void container.offsetWidth;
        container.style.transform = `translate(${(phCx - vpCx).toFixed(1)}px, ${(phCy - vpCy).toFixed(1)}px) scale(${startScale.toFixed(4)}) rotate(${origAngle})`;
        container.style.boxShadow = '';
        container.style.cursor    = '';

        setTimeout(() => {
            placeholder.parentNode.insertBefore(container, placeholder);
            placeholder.remove();
            // Outer-Container-Style vollständig wiederherstellen (width, position, margin, transform …)
            container.style.cssText = container.dataset.wikiOrigCssText || '';
            // Inner photo-img-Höhe wiederherstellen
            const imgEl = container.querySelector('.photo-img');
            if (imgEl) imgEl.style.height = container.dataset.wikiPhotoImgOrigHeight || '';
        }, 430);

        const bd = document.getElementById('photo-backdrop');
        if (bd) { bd.style.opacity = '0'; setTimeout(() => bd.remove(), 400); }
        return;
    }

    // Zoom-In nur auf aktiver Seite
    const page = container.closest('.mission-note-page');
    if (page && !page.classList.contains('front-note')) return;

    event.stopPropagation();

    // ── ZOOM-IN ──
    // Strategie: Element auf Ziel-Displaygröße setzen (scale 1 im Endzustand) statt
    // kleines Element hochzuskalieren. background-size:cover rendert dann nativ in
    // voller Zielauflösung → gestochen scharfes Bild, keine GPU-Upscale-Unschärfe.
    const rect = container.getBoundingClientRect();
    container.dataset.wikiOrigTransform = container.style.transform || '';
    container.dataset.wikiOrigCssText   = container.style.cssText;

    const noteRef = container.closest('.notes-stack') || container.closest('.mission-note-page');
    const noteW   = noteRef ? noteRef.getBoundingClientRect().width : window.innerWidth * 0.7;

    const isMobile   = window.innerWidth <= 767;
    const targetW    = isMobile ? (window.innerWidth - 24) : (noteW * 1.2);
    const scaleRatio = targetW / rect.width;

    // Photo-img proportional skalieren, damit background-size:cover die Zielgröße füllt
    const imgEl = container.querySelector('.photo-img');
    container.dataset.wikiPhotoImgOrigHeight = imgEl ? (imgEl.style.height || '') : '';
    const origPhotoH = imgEl
        ? (parseFloat(imgEl.style.height) || parseFloat(window.getComputedStyle(imgEl).height) || 100)
        : 100;
    const newPhotoH = Math.round(origPhotoH * scaleRatio);
    if (imgEl) imgEl.style.height = newPhotoH + 'px';

    // Platzhalter mit korrektem margin-left → Zoom-Out landet exakt an Originalposition
    const mlMatch = (container.dataset.wikiOrigCssText || '').match(/margin-left\s*:\s*([^;]+)/i);
    const origML  = mlMatch ? mlMatch[1].trim() : 'auto';
    const ph = document.createElement('div');
    ph.id = 'photo-zoom-placeholder';
    ph.style.cssText = `width:${rect.width}px;height:${rect.height}px;flex-shrink:0;margin-left:${origML};visibility:hidden;`;
    container.parentNode.insertBefore(ph, container);

    // Gesamthöhe analytisch berechnen (padding-top 6 + padding-bottom 22 + border 2 = 30px)
    const actualTargetH = newPhotoH + 30;

    // Viewport-Mitte für Zoom (wird für Zoom-Out gespeichert)
    const vpCx = window.innerWidth  / 2;
    const vpCy = window.innerHeight * 0.42;
    container.dataset.wikiVpCx = vpCx;
    container.dataset.wikiVpCy = vpCy;

    const startScale = rect.width / targetW;   // < 1 → lässt Element in Originalgröße erscheinen
    container.dataset.wikiZoomStartScale = startScale.toFixed(6);

    // Element nach <body> verschieben – kein overflow-clipping durch Ancestors
    document.body.appendChild(container);

    // Transition unterdrücken während Setup (überschreibt das !important der CSS-Klasse)
    container.classList.add('wiki-zoom-setup');

    container.style.position = 'fixed';
    // Breite mit !important setzen, damit das mobile CSS (!important: 100px) überschrieben wird.
    // Inline-!important schlägt Stylesheet-!important in der CSS-Kaskade.
    container.style.setProperty('width', Math.round(targetW) + 'px', 'important');
    container.style.top      = Math.round(vpCy - actualTargetH / 2) + 'px';
    container.style.left     = Math.round(vpCx - targetW        / 2) + 'px';
    container.style.margin   = '0';
    container.style.float    = 'none';
    container.style.zIndex   = '10000';
    container.style.cursor   = 'zoom-out';

    // Starttransform: Element erscheint an Originalposition in Originalgröße
    const origCx = rect.left + rect.width  / 2;
    const origCy = rect.top  + rect.height / 2;
    const rotIn  = (container.dataset.wikiOrigTransform || '').match(/rotate\(([^)]+)\)/);
    const startAngle = rotIn ? rotIn[1] : '3deg';
    container.style.transform = `translate(${(origCx - vpCx).toFixed(1)}px, ${(origCy - vpCy).toFixed(1)}px) scale(${startScale.toFixed(4)}) rotate(${startAngle})`;

    // Startzustand einfrieren, dann Transition wieder aktivieren
    void container.offsetWidth;
    container.classList.remove('wiki-zoom-setup');

    // Hintergrund-Verdunkelung
    const bd = document.createElement('div');
    bd.id = 'photo-backdrop';
    bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;opacity:0;transition:opacity 0.4s;';
    document.body.appendChild(bd);
    void bd.offsetWidth;
    bd.style.opacity = '1';
    bd.onclick = e => { e.stopPropagation(); toggleWikiPhoto(e, containerId); };

    // Zielzustand: Element in voller Zielgröße, zentriert im Viewport – kein GPU-Upscaling
    void container.offsetWidth;
    container.style.transform = `translate(0px, 0px) scale(1) rotate(2deg)`;
    container.style.boxShadow = '5px 20px 50px rgba(0, 0, 0, 0.8)';
}

function updateDynamicColors() {
    const isNavcom = document.body.classList.contains('theme-navcom');
    const isOps1940 = document.body.classList.contains('theme-ops1940');
    const isRetro = document.body.classList.contains('theme-retro') && !isNavcom;

    const primColor = isNavcom ? '#33ff33' : (isOps1940 ? '#e2c27b' : (isRetro ? 'var(--piper-white)' : 'var(--blue)'));
    const titleColor = isNavcom ? '#33ff33' : (isOps1940 ? '#d0a44f' : (isRetro ? 'var(--piper-white)' : 'var(--blue)'));
    const hlColor = isNavcom ? '#33ff33' : (isOps1940 ? '#f5d78a' : (isRetro ? 'var(--piper-yellow)' : 'var(--green)'));

    const mainTitle = document.getElementById('mainTitle');
    if (mainTitle) mainTitle.style.color = isRetro || isNavcom || isOps1940 ? '' : titleColor;
    document.querySelectorAll('.theme-color-text').forEach(el => el.style.color = isRetro || isNavcom || isOps1940 ? '' : primColor);
    document.querySelectorAll('.theme-green-text').forEach(el => el.style.color = hlColor);
}

function applySavedPanelTheme() {
    const panel = document.querySelector('.container');
    if (!panel) return;

    const retroThemes = ['panel-med', 'panel-creme', 'panel-light', 'panel-dark'];
    const opsThemes = ['ops1940-olive-1', 'ops1940-olive-2', 'ops1940-olive-3', 'ops1940-olive-4'];

    panel.classList.remove(...retroThemes, ...opsThemes);

    if (document.body.classList.contains('theme-ops1940')) {
        const savedOps = localStorage.getItem('ga_ops1940_panel_theme');
        panel.classList.add((savedOps && opsThemes.includes(savedOps)) ? savedOps : 'ops1940-olive-1');
        return;
    }

    const savedPanel = localStorage.getItem('ga_panel_theme') || 'panel-med';
    if (retroThemes.includes(savedPanel)) panel.classList.add(savedPanel);
}

function cyclePanelColor() {
    const panel = document.querySelector('.container');
    if (!panel) return;

    if (document.body.classList.contains('theme-ops1940')) {
        const opsThemes = ['ops1940-olive-1', 'ops1940-olive-2', 'ops1940-olive-3', 'ops1940-olive-4'];
        let currentIndex = -1;
        for (let i = 0; i < opsThemes.length; i++) {
            if (panel.classList.contains(opsThemes[i])) {
                currentIndex = i;
                panel.classList.remove(opsThemes[i]);
                break;
            }
        }
        const nextTheme = opsThemes[(currentIndex + 1) % opsThemes.length];
        panel.classList.add(nextTheme);
        localStorage.setItem('ga_ops1940_panel_theme', nextTheme);
        return;
    }

    if (!document.body.classList.contains('theme-retro')) return;

    const themes = ['panel-med', 'panel-creme', 'panel-light', 'panel-dark'];
    let currentIndex = 0;
    for (let i = 0; i < themes.length; i++) {
        if (panel.classList.contains(themes[i])) {
            currentIndex = i;
            panel.classList.remove(themes[i]);
            break;
        }
    }
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    panel.classList.add(nextTheme);
    localStorage.setItem('ga_panel_theme', nextTheme);
}

/* =========================================================
   2. GLOBALE VARIABLEN & INITIALISIERUNG
   ========================================================= */
let map, polyline, markers = [], currentStartICAO, currentDestICAO, currentMissionData = null, selectedAC = "PA-24";
window.selectedAC = selectedAC;
let currentDepFreq = "";
let currentDestFreq = "";
let currentDepElev = null;
let currentDestElev = null;
let globalAirports = null, runwayCache = {}, freqCache = {};
let globalAirportsLoadPromise = null;
const openAipAirportDispatchCache = new Map();
window.drumCache = {};

/* =========================================================
   PWA UPDATE TRIGGER & SOFT AUTO SYNC EVENTS
   ========================================================= */
// SOFT AUTO SYNC: Lädt beim Öffnen, Speichert beim Schließen (oder in den Hintergrund wischen)
window.addEventListener('visibilitychange', () => {
    const t = document.getElementById('syncToggle');
    if (t && t.checked && getSyncId()) {
        if (document.visibilityState === 'hidden') {
            triggerCloudSave(true); // Push in die Cloud (nur wenn sich Daten wirklich geändert haben)
        } else if (document.visibilityState === 'visible') {
            silentSyncLoad(); // Pull aus der Cloud
        }
    }
});
window.addEventListener('pagehide', () => {
    const t = document.getElementById('syncToggle');
    if (t && t.checked && getSyncId()) {
        triggerCloudSave(true); // Letzter Rettungs-Push beim Schließen des Tabs
    }
});
/* ========================================================= */

async function fetchWithTimeout(url, ms = 6000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        return res;
    } catch (e) { clearTimeout(tid); throw e; }
}

let measureMode = false, measurePoints = [], measurePolyline = null, measureMarkers = [], measureTooltip = null;
let routeWaypoints = [], routeMarkers = [], currentSName = "", currentDName = "";
let miniMap, miniRoutePolyline, miniMapMarkers = [];

/* =========================================================
   DRAG-KNOB LOGIK
   ========================================================= */
let navcomAltMode = 'alt'; // 'alt' or 'rate'

function toggleAltRateMode() {
    const label = document.getElementById('altRateToggle');
    const display = document.getElementById('altRadioDisplay');
    if (!label || !display) return;
    if (navcomAltMode === 'alt') {
        navcomAltMode = 'rate';
        label.textContent = 'V/S';
        label.style.color = '#ff8800';
        display.textContent = vpClimbRate;
    } else {
        navcomAltMode = 'alt';
        label.textContent = 'ALT';
        label.style.color = '';
        display.textContent = document.getElementById('altSlider')?.value || '4500';
    }
}

function initDragKnob(knobId, displayId, sliderId, min, max, type) {
    const knob = document.getElementById(knobId);
    const display = document.getElementById(displayId);
    const slider = document.getElementById(sliderId);
    if (!knob || !display || !slider) return;

    let isDragging = false;
    let startY = 0, startX = 0;
    let startVal = 0;
    let currentRotation = 0;

    function onStart(e) {
        window.vpUIInteractionActive = true;
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = e.touches ? e.touches[0].clientX : e.clientX;

        if (type === 'alt' && navcomAltMode === 'rate') {
            startVal = vpClimbRate || 500;
        } else {
            startVal = parseInt(slider.value) || min;
        }
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        // Listener NUR WÄHREND des Drags aktivieren
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
    }

    function onMove(e) {
        if (!isDragging) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        if (type === 'alt' && navcomAltMode === 'rate') {
            let delta = Math.round((startY - clientY) + (clientX - startX));
            delta = Math.round(delta * 3);
            let newVal = startVal + delta;
            newVal = Math.max(200, Math.min(1500, newVal));
            newVal = Math.round(newVal / 50) * 50;
            display.innerText = newVal;
            currentRotation = (delta / 3) * 5;
            knob.style.transform = `rotate(${currentRotation}deg)`;
            handleRateChange(newVal);
            return;
        }

        let delta = Math.round((startY - clientY) + (clientX - startX));
        if (type === 'gph') delta = Math.round(delta * 0.3);
        if (type === 'alt') delta = Math.round(delta * 10);

        let newVal = startVal + delta;
        if (newVal < min) newVal = min;
        if (newVal > max) newVal = max;

        const step = parseInt(slider.step) || 1;
        if (step > 1) newVal = Math.round(newVal / step) * step;

        let displayVal = newVal;
        if (type === 'gph') displayVal = newVal.toString().padStart(2, '0');

        display.innerText = displayVal;
        slider.value = newVal;

        currentRotation = delta * 5;
        knob.style.transform = `rotate(${currentRotation}deg)`;

        handleSliderChange(type, newVal);
        if (gpsState.visible && gpsState.mode === 'FPL') {
            refreshGPSAfterDispatch();
        }
    }

    function onEnd() {
        if (!isDragging) return;
        window.vpUIInteractionActive = false;
        isDragging = false;
        document.body.style.cursor = 'default';
        knob.style.transition = 'transform 0.3s ease';
        knob.style.transform = `rotate(0deg)`;
        setTimeout(() => knob.style.transition = '', 300);

        if (type === 'alt' || (type === 'alt' && typeof navcomAltMode !== 'undefined' && navcomAltMode === 'rate')) {
            if (typeof renderVerticalProfile === 'function') renderVerticalProfile('verticalProfileCanvas');
            if (typeof renderMapProfile === 'function') renderMapProfile();
            if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
        }
        // Listener nach dem Drag wieder entfernen, um Konflikte zu vermeiden
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
    }

    knob.addEventListener('mousedown', onStart);
    knob.addEventListener('touchstart', onStart, { passive: false });
}

function focusOpsControl(controlId) {
    const control = document.getElementById(controlId);
    if (!control) return;
    control.focus();
    if (typeof control.select === 'function') control.select();
    if (control.tagName === 'SELECT') control.click();
}

function getSelectedOptionText(selectId, fallback = '') {
    const select = document.getElementById(selectId);
    if (!select) return fallback;
    const option = select.options[select.selectedIndex];
    return (option?.textContent || fallback).trim();
}

function compactOpsLabel(text, maxLength = 13) {
    const normalized = String(text || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '----';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}.` : normalized;
}

function updateOpsRangeCard(value) {
    const card = document.getElementById('opsRangeCard');
    if (!card) return;
    card.classList.remove('range-auto', 'range-short', 'range-medium', 'range-long');
    card.classList.add(`range-${['short', 'medium', 'long'].includes(value) ? value : 'auto'}`);
}

function updateOpsTypeCard(value) {
    const card = document.querySelector('.ops-picto-type');
    if (!card) return;
    const parsed = typeof parseMissionPickerValue === 'function' ? parseMissionPickerValue(value || 'apt') : { baseType: value };
    const isPoi = String(parsed.baseType || value || '').startsWith('poi');
    card.classList.toggle('type-poi', isPoi);
    card.classList.toggle('type-apt', !isPoi);
}

function syncOpsSelectOptions(sourceId, targetId, maxLabelLength = 18) {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    const signature = Array.from(source.options).map(opt => `${opt.value}:${opt.textContent}`).join('|');
    if (target.dataset.optionSignature !== signature) {
        target.innerHTML = '';
        Array.from(source.options).forEach(opt => {
            const clone = document.createElement('option');
            clone.value = opt.value;
            clone.textContent = compactOpsLabel(opt.textContent, maxLabelLength).toUpperCase();
            target.appendChild(clone);
        });
        target.dataset.optionSignature = signature;
    }
    target.value = source.value;
}

function syncOpsTextField(classicId, value) {
    const classic = document.getElementById(classicId);
    if (!classic) return;
    const next = String(value || '').toUpperCase();
    classic.value = next;
    if (classicId === 'startLoc') syncToNavCom('startLocRadio', next);
    if (classicId === 'destLoc') syncToNavCom('destLocRadio', next);
    updateOps1940Panel();
}

function syncOpsSelectField(classicId, value) {
    const classic = document.getElementById(classicId);
    if (!classic) return;
    if (classicId === 'targetType') {
        setMissionTypeSelection(value);
    } else {
        classic.value = value;
        if (classicId === 'distRange') syncToNavCom('distRangeRadio', value);
        if (classicId === 'regionFilter') syncToNavCom('regionFilterRadio', value);
        if (classicId === 'dirPref') syncToNavCom('dirPrefRadio', value);
    }
    updateOps1940Panel();
}

function setOpsOption(selectId, value) {
    syncOpsSelectField(selectId, value);
}

function cycleOpsSelect(sourceId, targetId) {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (!source) return;
    if (target) syncOpsSelectOptions(sourceId, targetId);
    if (!source.options.length) return;
    const selectedIndex = source.selectedIndex >= 0
        ? source.selectedIndex
        : Array.from(source.options).findIndex(opt => opt.value === source.value);
    const nextIndex = ((selectedIndex >= 0 ? selectedIndex : 0) + 1) % source.options.length;
    const nextValue = source.options[nextIndex].value;
    syncOpsSelectField(sourceId, nextValue);
}

function cycleOpsMissionType(event) {
    if (event?.target?.matches?.('select, input')) return;
    cycleOpsSelect('targetType', 'opsTypeSelect');
}

function cycleOpsRange(event) {
    if (event?.target?.matches?.('select, input')) return;
    cycleOpsSelect('distRange', 'opsRangeSelect');
}

function updateOpsSelectorDials() {
    const regionValue = document.getElementById('regionFilter')?.value || 'de';
    const directionValue = document.getElementById('dirPref')?.value || 'any';
    const regionKnob = document.getElementById('opsRegionKnob');
    const directionKnob = document.getElementById('opsDirectionKnob');
    const regionAngles = { any: -120, de: 0, int: 120 };
    const directionAngles = { N: 0, E: 90, S: 180, W: 270, any: 45 };

    if (regionKnob) {
        regionKnob.style.setProperty('--ops-switch-angle', `${regionAngles[regionValue] ?? 0}deg`);
        regionKnob.dataset.value = regionValue;
    }
    if (directionKnob) {
        directionKnob.style.setProperty('--ops-switch-angle', `${directionAngles[directionValue] ?? 0}deg`);
        directionKnob.dataset.value = directionValue;
    }

    document.querySelectorAll('.ops-selector-choice, .ops-dir-choice, .ops-dir-random').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.ops-selector-choice.region-${regionValue === 'any' ? 'any' : regionValue}`)?.classList.add('active');
    document.querySelector(`.ops-dir-choice.dir-${String(directionValue).toLowerCase()}`)?.classList.add('active');
    if (directionValue === 'any') document.querySelector('.ops-dir-random')?.classList.add('active');
}

function updateOpsAircraftSwitches() {
    document.querySelectorAll('.preset-row .btn-preset[data-aircraft]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.aircraft === selectedAC);
    });
}

function updateOps1940Panel() {
    const dep = document.getElementById('startLoc')?.value?.trim().toUpperCase() || '----';
    const destRaw = document.getElementById('destLoc')?.value?.trim().toUpperCase();
    const dist = document.getElementById('distRange')?.value || 'any';

    const depInput = document.getElementById('opsDepInput');
    const destInput = document.getElementById('opsDestInput');

    if (depInput && depInput.value !== dep) depInput.value = dep;
    if (destInput && destInput.value !== (destRaw || '')) destInput.value = destRaw || '';
    syncOpsSelectOptions('targetType', 'opsTypeSelect', 18);
    syncOpsSelectOptions('distRange', 'opsRangeSelect', 15);
    updateOpsTypeCard(document.getElementById('targetType')?.value || 'apt');
    updateOpsRangeCard(dist);
    updateOpsSelectorDials();
    updateOpsAircraftSwitches();
    updateOpsRotaryReadouts();
}

function initOps1940Panel() {
    ['startLoc', 'destLoc', 'targetType', 'distRange', 'maxSeats'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.opsPanelBound === '1') return;
        el.addEventListener('input', updateOps1940Panel);
        el.addEventListener('change', updateOps1940Panel);
        el.dataset.opsPanelBound = '1';
    });

    const depInput = document.getElementById('opsDepInput');
    if (depInput && depInput.dataset.opsSyncBound !== '1') {
        depInput.addEventListener('input', () => syncOpsTextField('startLoc', depInput.value));
        depInput.dataset.opsSyncBound = '1';
    }
    const destInput = document.getElementById('opsDestInput');
    if (destInput && destInput.dataset.opsSyncBound !== '1') {
        destInput.addEventListener('input', () => syncOpsTextField('destLoc', destInput.value));
        destInput.dataset.opsSyncBound = '1';
    }
    const typeSelect = document.getElementById('opsTypeSelect');
    if (typeSelect && typeSelect.dataset.opsSyncBound !== '1') {
        typeSelect.addEventListener('change', () => syncOpsSelectField('targetType', typeSelect.value));
        typeSelect.dataset.opsSyncBound = '1';
    }
    const rangeSelect = document.getElementById('opsRangeSelect');
    if (rangeSelect && rangeSelect.dataset.opsSyncBound !== '1') {
        rangeSelect.addEventListener('change', () => syncOpsSelectField('distRange', rangeSelect.value));
        rangeSelect.dataset.opsSyncBound = '1';
    }
    document.querySelectorAll('.ops-picto-card[data-focus], .ops-picto-card[data-cycle]').forEach(card => {
        if (card.dataset.opsCardBound === '1') return;
        card.addEventListener('click', event => {
            if (event.target?.matches?.('input, select, option')) return;
            const focusTarget = card.dataset.focus;
            if (focusTarget) focusOpsControl(focusTarget);
            if (card.dataset.cycle === 'type') cycleOpsMissionType(event);
            if (card.dataset.cycle === 'range') cycleOpsRange(event);
        });
        card.dataset.opsCardBound = '1';
    });
    document.querySelectorAll('.ops-picto-label[data-ops-label-action]').forEach(label => {
        if (label.dataset.opsLabelBound === '1') return;
        label.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (label.dataset.opsLabelAction === 'swap-route') {
                swapDepDest();
                updateOps1940Panel();
            }
            if (label.dataset.opsLabelAction === 'toggle-picker') {
                toggleMissionPickerMode();
                updateOps1940Panel();
            }
        });
        label.dataset.opsLabelBound = '1';
    });
    updateOps1940Panel();
}

function getOpsRotaryConfigs() {
    return [
        { sliderId: 'gphSlider', label: 'GPH', type: 'gph', min: 5, max: 35, format: value => String(value).padStart(2, '0') },
        { sliderId: 'tasSlider', label: 'TAS', type: 'tas', min: 80, max: 260, format: value => String(value) },
        { sliderId: 'altSlider', label: 'ALT', type: 'alt', min: 1500, max: 13500, format: value => String(value) },
        { sliderId: 'rateSlider', label: 'V/S', type: 'rate', min: 200, max: 1500, format: value => String(value) }
    ];
}

function setOpsRotaryAngle(knob, slider, config) {
    if (!knob || !slider || !config) return;
    const min = Number(slider.min || config.min);
    const max = Number(slider.max || config.max);
    const value = Number(slider.value || min);
    const pct = max > min ? (value - min) / (max - min) : 0;
    const angle = -132 + (Math.max(0, Math.min(1, pct)) * 264);
    knob.style.setProperty('--ops-angle', `${angle.toFixed(1)}deg`);
    const readout = knob.querySelector('.ops-rotary-readout');
    if (readout) readout.textContent = config.format ? config.format(value) : String(value);
}

function updateOpsRotaryReadouts() {
    getOpsRotaryConfigs().forEach(config => {
        const slider = document.getElementById(config.sliderId);
        const knob = document.querySelector(`.ops-rotary-control[data-slider="${config.sliderId}"]`);
        setOpsRotaryAngle(knob, slider, config);
    });
}

function initOpsRotaryControls() {
    getOpsRotaryConfigs().forEach(config => {
        const slider = document.getElementById(config.sliderId);
        const container = slider?.closest('.slider-container');
        if (!slider || !container || container.querySelector(`.ops-rotary-control[data-slider="${config.sliderId}"]`)) return;

        const knob = document.createElement('button');
        knob.type = 'button';
        knob.className = 'ops-rotary-control';
        knob.dataset.slider = config.sliderId;
        knob.title = `${config.label} ziehen`;
        knob.innerHTML = `
            <span class="ops-rotary-scale" aria-hidden="true"></span>
            <span class="ops-rotary-knob" aria-hidden="true"></span>
            <span class="ops-rotary-label">${config.label}</span>
            <span class="ops-rotary-readout"></span>
        `;
        container.prepend(knob);

        let isDragging = false;
        let startY = 0;
        let startX = 0;
        let startVal = 0;

        const moveToValue = (value) => {
            const min = Number(slider.min || config.min);
            const max = Number(slider.max || config.max);
            const step = Number(slider.step || 1);
            let next = Math.max(min, Math.min(max, value));
            next = Math.round(next / step) * step;
            slider.value = String(next);
            setOpsRotaryAngle(knob, slider, config);
            if (config.type === 'rate') handleRateChange(next);
            else handleSliderChange(config.type, next);
            if (gpsState.visible && gpsState.mode === 'FPL') refreshGPSAfterDispatch();
        };

        const onMove = (event) => {
            if (!isDragging) return;
            const point = event.touches ? event.touches[0] : event;
            const range = Number(slider.max || config.max) - Number(slider.min || config.min);
            const delta = (startY - point.clientY) + ((point.clientX - startX) * 0.55);
            moveToValue(startVal + (delta * (range / 160)));
            event.preventDefault();
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            window.vpUIInteractionActive = false;
            knob.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('touchcancel', onEnd);
            if (config.type === 'alt' || config.type === 'rate') {
                if (typeof renderVerticalProfile === 'function') renderVerticalProfile('verticalProfileCanvas');
                if (typeof renderMapProfile === 'function') renderMapProfile();
                if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
            }
        };

        const onStart = (event) => {
            const point = event.touches ? event.touches[0] : event;
            isDragging = true;
            window.vpUIInteractionActive = true;
            startY = point.clientY;
            startX = point.clientX;
            startVal = Number(slider.value || slider.min || config.min);
            knob.classList.add('is-dragging');
            document.body.style.cursor = 'ns-resize';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
            document.addEventListener('touchcancel', onEnd);
            event.preventDefault();
        };

        knob.addEventListener('mousedown', onStart);
        knob.addEventListener('touchstart', onStart, { passive: false });
        slider.addEventListener('input', () => setOpsRotaryAngle(knob, slider, config));
        setOpsRotaryAngle(knob, slider, config);
    });
}

const GA_LAST_VIEW_KEY = 'ga_last_view';
const GA_VIEW_MAIN = 'main';
const GA_VIEW_MAP = 'map';
const GA_VIEW_PINBOARD = 'pinboard';

function saveLastMainView(view) {
    if (![GA_VIEW_MAIN, GA_VIEW_MAP, GA_VIEW_PINBOARD].includes(view)) return;
    try {
        localStorage.setItem(GA_LAST_VIEW_KEY, view);
    } catch (_) {}
}

function getLastMainView() {
    try {
        const view = localStorage.getItem(GA_LAST_VIEW_KEY);
        if ([GA_VIEW_MAIN, GA_VIEW_MAP, GA_VIEW_PINBOARD].includes(view)) return view;
    } catch (_) {}
    return GA_VIEW_MAIN;
}

window.persistMainViewFromOverlays = function persistMainViewFromOverlays() {
    const mapOpen = !!document.getElementById('mapTableOverlay')?.classList.contains('active');
    const pinboardOpen = !!document.getElementById('pinboardOverlay')?.classList.contains('active');
    const view = pinboardOpen ? GA_VIEW_PINBOARD : (mapOpen ? GA_VIEW_MAP : GA_VIEW_MAIN);
    saveLastMainView(view);
    return view;
};

window.restoreMainViewFromStorage = function restoreMainViewFromStorage() {
    const view = getLastMainView();
    if (view === GA_VIEW_MAP && typeof toggleMapTable === 'function') {
        const mapOpen = !!document.getElementById('mapTableOverlay')?.classList.contains('active');
        if (!mapOpen) toggleMapTable();
        return;
    }
    if (view === GA_VIEW_PINBOARD && typeof togglePinboard === 'function') {
        const pinboardOpen = !!document.getElementById('pinboardOverlay')?.classList.contains('active');
        if (!pinboardOpen) togglePinboard();
        return;
    }
    saveLastMainView(GA_VIEW_MAIN);
};

window.hideBootSplash = function hideBootSplash() {
    const splash = document.getElementById('bootSplash');
    if (!splash || splash.dataset.hidden === '1' || splash.dataset.hiding === '1') return;

    const BOOT_SPLASH_MIN_VISIBLE_MS = 500;
    const shownAt = Number(window.__bootSplashShownAt) || performance.now();
    const elapsed = performance.now() - shownAt;
    const waitMs = Math.max(0, BOOT_SPLASH_MIN_VISIBLE_MS - elapsed);
    splash.dataset.hiding = '1';

    setTimeout(() => {
        if (!splash || splash.dataset.hidden === '1') return;
        splash.dataset.hidden = '1';
        splash.classList.add('is-hidden');
        document.body.classList.remove('boot-splash-active');
        setTimeout(() => {
            if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
        }, 260);
    }, waitMs);
};

function bootAppOnce() {
    if (window.__gaAppBooted) return;
    window.__gaAppBooted = true;

    const savedTheme = localStorage.getItem('ga_theme') || 'classic';
    setTheme(savedTheme);
    setSettingsPanelOpen(localStorage.getItem('ga_settings_open') === 'true', false);
    applySavedPanelTheme();
    loadAircraftPresets();
    applyPersistedMainPerformanceSettings();
    setTimeout(() => { loadGlobalAirports(); }, 2000);
    const lastDest = localStorage.getItem('last_icao_dest');
    if (lastDest) document.getElementById('startLoc').value = lastDest;

    const savedKey = localStorage.getItem('ga_gemini_key');
    if (savedKey) {
        document.getElementById('apiKeyInput').value = savedKey;
        const cache = _readApiKeyValidationCache();
        const sameKey = cache && cache.sig === _apiKeyValidationSignature(savedKey);
        const ageMs = sameKey ? (Date.now() - Number(cache.ts || 0)) : Number.POSITIVE_INFINITY;
        if (sameKey && Number.isFinite(ageMs) && ageMs >= 0 && ageMs < API_KEY_VALIDATION_TTL_MS) {
            const minutesAgo = Math.max(1, Math.round(ageMs / 60000));
            if (cache.ok === true) {
                setApiKeyValidationStatus(`API-Key zuletzt vor ${minutesAgo} min geprueft (ok).`, 'ok');
            } else {
                setApiKeyValidationStatus(`Letzte API-Key Pruefung vor ${minutesAgo} min fehlgeschlagen.`, 'error');
            }
        } else {
            queueApiKeyValidation(savedKey);
        }
    } else {
        setApiKeyValidationStatus('Kein API-Key gesetzt. Lokale Missionsdatenbank aktiv.', 'neutral');
    }
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput && !apiKeyInput.dataset.validationBound) {
        apiKeyInput.addEventListener('input', () => {
            saveApiKey(false);
            if (_apiKeyValidationDebounceTimer) clearTimeout(_apiKeyValidationDebounceTimer);
            _apiKeyValidationDebounceTimer = setTimeout(() => {
                queueApiKeyValidation(apiKeyInput.value);
            }, 700);
        });
        apiKeyInput.dataset.validationBound = '1';
    }

    const aiEnabled = localStorage.getItem('ga_ai_enabled');
    const aiToggleBtn = document.getElementById('aiToggle');
    if (aiToggleBtn) { aiToggleBtn.checked = (aiEnabled !== 'false'); }

    const savedTargetType = localStorage.getItem('ga_target_type') || document.getElementById('targetType')?.value || 'apt';
    refreshMissionPickerOptions(savedTargetType);
    setMissionTypeSelection(document.getElementById('targetType')?.value || savedTargetType);
    const navTypeSel = document.getElementById('targetTypeRadio');
    if (navTypeSel && !navTypeSel.dataset.expandHandlersBound) {
        navTypeSel.addEventListener('mousedown', () => _setNavcomTypeOptionsExpanded(true));
        navTypeSel.addEventListener('touchstart', () => _setNavcomTypeOptionsExpanded(true), { passive: true });
        navTypeSel.addEventListener('focus', () => _setNavcomTypeOptionsExpanded(true));
        navTypeSel.addEventListener('blur', () => _setNavcomTypeOptionsExpanded(false));
        navTypeSel.addEventListener('change', () => _setNavcomTypeOptionsExpanded(false));
        navTypeSel.dataset.expandHandlersBound = '1';
    }

    renderLog();
    updateApiFuelMeter();

    if (!localStorage.getItem('ga_pinboard_init')) {
        localStorage.setItem('ga_pinboard', JSON.stringify(tutorialNotes));
        localStorage.setItem('ga_pinboard_init', 'true');
    }

    const activeMission = localStorage.getItem('ga_active_mission');
    if (activeMission) {
        setTimeout(() => {
            const parsedMission = JSON.parse(activeMission);
            if (isMissionDraftPending(parsedMission)) {
                clearDraftMissionPersistence('startup-draft-rejected');
                return;
            }
            restoreMissionState(parsedMission);
            // Clear destination input on initial load to allow easy random route generation
            const dInp = document.getElementById('destLoc');
            if (dInp) dInp.value = '';
        }, 300);
    }

    requestAnimationFrame(() => {
        setTimeout(() => { refreshAllDrums(); }, 50);
    });

    syncToNavCom('startLocRadio', document.getElementById('startLoc').value);
    syncToNavCom('targetTypeRadio', document.getElementById('targetType').value);
    syncToNavCom('tasRadioDisplay', document.getElementById('tasSlider').value);
    syncToNavCom('gphRadioDisplay', document.getElementById('gphSlider').value.toString().padStart(2, '0'));
    syncToNavCom('maxSeatsRadio', document.getElementById('maxSeats').value);

    initDragKnob('tasDragKnob', 'tasRadioDisplay', 'tasSlider', 80, 260, 'tas');
    initDragKnob('gphDragKnob', 'gphRadioDisplay', 'gphSlider', 5, 35, 'gph');
    initDragKnob('altDragKnob', 'altRadioDisplay', 'altSlider', 1500, 13500, 'alt');
    initOpsRotaryControls();
    initOps1940Panel();
    syncToNavCom('altRadioDisplay', document.getElementById('altSlider') ? document.getElementById('altSlider').value : '4500');

    if (aiToggleBtn && aiToggleBtn.checked) {
        const btnAI = document.getElementById('btnToggleAI');
        if (btnAI) btnAI.classList.add('active');
    }

    const savedSyncId = localStorage.getItem('ga_sync_id');
    if (savedSyncId) {
        const syncInput = document.getElementById('syncIdInput');
        if(syncInput) syncInput.value = savedSyncId;
    }

    // Sync Toggle Status laden (Standardmäßig auf AUS / false)
    const syncTggl = document.getElementById('syncToggle');
    if (syncTggl) { syncTggl.checked = (localStorage.getItem('ga_sync_enabled') === 'true'); }

    // Lade Gruppen-Settings
    const gName = localStorage.getItem('ga_group_name');
    const gNick = localStorage.getItem('ga_group_nick');
    if (gName && gNick) {
        const inpN = document.getElementById('groupNameInput');
        const inpU = document.getElementById('groupNickInput');
        const stat = document.getElementById('groupStatus');
        if (inpN) inpN.value = gName;
        if (inpU) inpU.value = gNick;
        if (stat) { stat.innerText = "Verbunden als " + gNick; stat.style.color = "var(--green)"; }
    }

    setTimeout(() => {
        if (typeof window.restoreMainViewFromStorage === 'function') window.restoreMainViewFromStorage();
    }, 0);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (typeof window.hideBootSplash === 'function') window.hideBootSplash();
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAppOnce, { once: true });
} else {
    setTimeout(bootAppOnce, 0);
}
window.addEventListener('load', bootAppOnce, { once: true });

let _apiKeyValidationRunId = 0;
let _apiKeyValidationDebounceTimer = null;
const API_KEY_VALIDATION_CACHE_KEY = 'ga_gemini_key_validation';
const API_KEY_VALIDATION_TTL_MS = 24 * 60 * 60 * 1000;

function _apiKeyValidationSignature(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) return '';
    const prefix = key.slice(0, 6);
    const suffix = key.slice(-4);
    return `${prefix}|${suffix}|${key.length}`;
}

function _readApiKeyValidationCache() {
    try {
        const raw = localStorage.getItem(API_KEY_VALIDATION_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function _writeApiKeyValidationCache(payload) {
    try {
        localStorage.setItem(API_KEY_VALIDATION_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

function _clearApiKeyValidationCache() {
    try { localStorage.removeItem(API_KEY_VALIDATION_CACHE_KEY); } catch (_) {}
}

function setApiKeyValidationStatus(message, tone = 'neutral') {
    const statusEl = document.getElementById('apiKeyStatus');
    if (!statusEl) return;
    const colorByTone = {
        neutral: '#888',
        pending: '#f2c12e',
        ok: '#4caf50',
        error: '#ff6b6b'
    };
    statusEl.textContent = String(message || '').trim();
    statusEl.style.color = colorByTone[tone] || colorByTone.neutral;
}

async function queueApiKeyValidation(rawKey) {
    const apiKey = String(rawKey || '').trim();
    const keySig = _apiKeyValidationSignature(apiKey);
    const runId = ++_apiKeyValidationRunId;
    if (!apiKey) {
        _clearApiKeyValidationCache();
        setApiKeyValidationStatus('Kein API-Key gesetzt. Lokale Missionsdatenbank aktiv.', 'neutral');
        return { ok: null, reason: 'empty' };
    }

    setApiKeyValidationStatus('Pruefe API-Key...', 'pending');

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        if (runId !== _apiKeyValidationRunId) return { ok: null, reason: 'stale' };

        if (res.ok) {
            _writeApiKeyValidationCache({
                sig: keySig,
                ts: Date.now(),
                ok: true,
                status: res.status
            });
            setApiKeyValidationStatus('API-Key ist gueltig und einsatzbereit.', 'ok');
            return { ok: true };
        }

        let apiMessage = '';
        try {
            const payload = await res.json();
            apiMessage = String(payload?.error?.message || '').trim();
        } catch (_) {}
        const suffix = apiMessage ? ` (${apiMessage})` : '';
        if (res.status === 400 || res.status === 401 || res.status === 403) {
            setApiKeyValidationStatus(`API-Key ungueltig oder ohne Gemini-Berechtigung${suffix}`, 'error');
        } else {
            setApiKeyValidationStatus(`API-Key Pruefung fehlgeschlagen (HTTP ${res.status})${suffix}`, 'error');
        }
        _writeApiKeyValidationCache({
            sig: keySig,
            ts: Date.now(),
            ok: false,
            status: res.status,
            message: apiMessage
        });
        return { ok: false, status: res.status, message: apiMessage };
    } catch (err) {
        if (runId !== _apiKeyValidationRunId) return { ok: null, reason: 'stale' };
        const timedOut = err && err.name === 'AbortError';
        setApiKeyValidationStatus(timedOut ? 'API-Key Pruefung Zeitlimit erreicht. Bitte erneut versuchen.' : 'API-Key Pruefung fehlgeschlagen (Netzwerk/CORS).', 'error');
        _writeApiKeyValidationCache({
            sig: keySig,
            ts: Date.now(),
            ok: false,
            status: 0,
            message: String(err?.message || err || '')
        });
        return { ok: false, status: 0, message: String(err?.message || err || '') };
    } finally {
        clearTimeout(timeoutId);
    }
}

function saveApiKey(shouldValidate = true) {
    const input = document.getElementById('apiKeyInput');
    if (!input) return;
    const key = input.value.trim();
    const previousKey = String(localStorage.getItem('ga_gemini_key') || '').trim();
    localStorage.setItem('ga_gemini_key', key);
    if (key !== previousKey) {
        _clearApiKeyValidationCache();
        if (!key) setApiKeyValidationStatus('Kein API-Key gesetzt. Lokale Missionsdatenbank aktiv.', 'neutral');
        else setApiKeyValidationStatus('API-Key geaendert. Warte auf Pruefung...', 'neutral');
    }
    if (shouldValidate) queueApiKeyValidation(key);
}
function saveAiToggle() { const t = document.getElementById('aiToggle'); if (t) localStorage.setItem('ga_ai_enabled', t.checked); }

/* =========================================================
   3. PERSISTENZ (SPEICHERN, LADEN & RESET)
   ========================================================= */
let saveMissionTimeout = null;
window.debouncedSaveMissionState = function() {
    if (saveMissionTimeout) clearTimeout(saveMissionTimeout);
    saveMissionTimeout = setTimeout(() => {
        saveMissionState();
    }, 800);
};

function _missionDataFromStateCandidate(candidate) {
    if (!candidate) return null;
    if (candidate.currentMissionData && typeof candidate.currentMissionData === 'object') return candidate.currentMissionData;
    return (typeof candidate === 'object') ? candidate : null;
}

function isMissionDraftPending(candidate = currentMissionData) {
    const md = _missionDataFromStateCandidate(candidate);
    if (!md || typeof md !== 'object') return false;
    if (md.sceneAccepted === false) return true;
    const status = String(md.sceneCompositionStatus || '').toLowerCase();
    return status === 'draft' || status === 'composing';
}
window.isMissionDraftPending = isMissionDraftPending;

function clearDraftMissionPersistence(reason = 'draft') {
    try { localStorage.removeItem('ga_active_mission'); } catch (_) {}
    try { localStorage.removeItem('ga_active_mission_contract'); } catch (_) {}
    try { localStorage.removeItem('ga_active_passenger'); } catch (_) {}
    try { console.debug('[MISSION DRAFT] Persistenz blockiert:', reason); } catch (_) {}
    if (reason === 'new-mission-draft' && typeof window.triggerCloudSave === 'function') {
        setTimeout(() => {
            try { window.triggerCloudSave(true); } catch (_) {}
        }, 0);
    }
}
window.clearDraftMissionPersistence = clearDraftMissionPersistence;

function saveMissionState() {
    if (document.getElementById("briefingBox").style.display !== "block") return;
    if (isMissionDraftPending()) {
        clearDraftMissionPersistence('saveMissionState');
        return;
    }

    const imgDepEl = document.getElementById("wikiDepImage");
    const imgDepUrl = (imgDepEl && imgDepEl.style.backgroundImage !== 'url("")') ? imgDepEl.style.backgroundImage : "";
    const imgDestEl = document.getElementById("wikiDestImage");
    const imgDestUrl = (imgDestEl && imgDestEl.style.backgroundImage !== 'url("")') ? imgDestEl.style.backgroundImage : "";

    const state = {
        mTitle: document.getElementById('mTitle').innerHTML,
        mStory: document.getElementById('mStory').innerText,
        mDepICAO: document.getElementById("mDepICAO").innerText,
        mDepName: document.getElementById("mDepName").innerText,
        mDepCoords: document.getElementById("mDepCoords").innerText,
        mDepRwy: '',
        destIcon: document.getElementById("destIcon").innerText,
        mDestICAO: document.getElementById("mDestICAO").innerText,
        mDestName: document.getElementById("mDestName").innerText,
        mDestCoords: document.getElementById("mDestCoords").innerText,
        mDestRwy: '',
        mPay: document.getElementById("mPay").innerText,
        mWeight: document.getElementById("mWeight").innerText,
        mDistNote: document.getElementById("mDistNote").innerText,
        mHeadingNote: document.getElementById("mHeadingNote").innerText,
        mETENote: document.getElementById("mETENote").innerText,
        wikiDepDescText: document.getElementById("wikiDepDescText") ? document.getElementById("wikiDepDescText").innerText : "",
        wikiDestDescText: document.getElementById("wikiDestDescText") ? document.getElementById("wikiDestDescText").innerText : "",
        wikiDepFreqText: document.getElementById("wikiDepFreqText") ? document.getElementById("wikiDepFreqText").innerHTML : "",
        wikiDestFreqText: document.getElementById("wikiDestFreqText") ? document.getElementById("wikiDestFreqText").innerHTML : "",
        wikiDepImageUrl: imgDepUrl,
        wikiDestImageUrl: imgDestUrl,
        isPOI: document.getElementById("destRwyContainer").style.display === "none",
        currentMissionData: currentMissionData,
        routeWaypoints: routeWaypoints,
        missionRouteWaypoints: window._missionRouteWaypoints || null,
        currentStartICAO: currentStartICAO,
        currentDestICAO: currentDestICAO,
        currentSName: currentSName,
        currentDName: currentDName,
        currentDepFreq: currentDepFreq,
        currentDestFreq: currentDestFreq,
        currentDepElev: currentDepElev,
        currentDestElev: currentDestElev,
        freqCache: freqCache,
        vpAltWaypoints: typeof vpAltWaypoints !== 'undefined' ? vpAltWaypoints : [],
        vpSegmentAlts: typeof vpSegmentAlts !== 'undefined' ? vpSegmentAlts : [],
        vpElevationData: typeof vpElevationData !== 'undefined' ? vpElevationData : null,
        activePassenger: window.activePassenger || null,
        activeMissionContract: window.activeMissionContract || currentMissionData?.missionContract || null
    };
    localStorage.setItem('ga_active_mission', JSON.stringify(state));
    triggerCloudSave();
}

async function restoreMissionState(state) {
    if (isMissionDraftPending(state)) {
        clearDraftMissionPersistence('restore-draft-rejected');
        const indicator = document.getElementById('searchIndicator');
        if (indicator) indicator.innerText = 'Entwurf verworfen: Mission muss zuerst akzeptiert werden.';
        return;
    }
    document.getElementById('mTitle').innerHTML = state.mTitle; document.getElementById('mStory').innerText = state.mStory;
    document.getElementById("mDepICAO").innerText = state.mDepICAO; document.getElementById("mDepName").innerText = state.mDepName;
    document.getElementById("mDepCoords").innerText = state.mDepCoords; document.getElementById("mDepRwy").innerText = "Sucht Pisten...";
    const rDepName = document.getElementById('wikiDepNameDisplay');
    if (rDepName) rDepName.innerText = `${state.mDepICAO} – ${state.mDepName}`;
    document.getElementById("destIcon").innerText = state.destIcon; document.getElementById("mDestICAO").innerText = state.mDestICAO;
    document.getElementById("mDestName").innerText = state.mDestName; document.getElementById("mDestCoords").innerText = state.mDestCoords;
    const rDestName = document.getElementById('wikiDestNameDisplay');
    if (rDestName) rDestName.innerText = `${state.mDestICAO} – ${state.mDestName}`;
    document.getElementById("mDestRwy").innerText = state.isPOI ? "" : "Sucht Pisten..."; document.getElementById("mPay").innerText = state.mPay;
    document.getElementById("mWeight").innerText = state.mWeight; document.getElementById("mDistNote").innerText = state.mDistNote;
    document.getElementById("mHeadingNote").innerText = state.mHeadingNote; document.getElementById("mETENote").innerText = state.mETENote;

    if (document.getElementById("wikiDepDescText")) document.getElementById("wikiDepDescText").innerText = state.wikiDepDescText || "";
    if (document.getElementById("wikiDestDescText")) document.getElementById("wikiDestDescText").innerText = state.wikiDestDescText || "";

    if (document.getElementById("wikiDepFreqText")) document.getElementById("wikiDepFreqText").innerHTML = state.wikiDepFreqText || "";
    if (document.getElementById("wikiDestFreqText")) document.getElementById("wikiDestFreqText").innerHTML = state.wikiDestFreqText || "";

    const imgDepContainer = document.getElementById("wikiDepImageContainer");
    const imgDepEl = document.getElementById("wikiDepImage");
    if (state.wikiDepImageUrl && imgDepContainer && imgDepEl) {
        imgDepEl.style.backgroundImage = state.wikiDepImageUrl;
        imgDepContainer.style.display = 'block';
    } else if (imgDepContainer) { imgDepContainer.style.display = 'none'; }

    const imgDestContainer = document.getElementById("wikiDestImageContainer");
    const imgDestEl = document.getElementById("wikiDestImage");
    if (state.wikiDestImageUrl && imgDestContainer && imgDestEl) {
        imgDestEl.style.backgroundImage = state.wikiDestImageUrl;
        imgDestContainer.style.display = 'block';
    } else if (imgDestContainer) { imgDestContainer.style.display = 'none'; }

    document.getElementById("destRwyContainer").style.display = state.isPOI ? "none" : "block";
    if (document.getElementById("wikiDestRwyText")) document.getElementById("wikiDestRwyText").style.display = state.isPOI ? "none" : "block";
    const depLinks = document.getElementById("wikiDepLinks"); if (depLinks) depLinks.style.display = currentStartICAO === 'GPS' ? "none" : "block";
    const destSwitchRow = document.getElementById("destSwitchRow"); if (destSwitchRow) destSwitchRow.style.display = "flex";
    const destLinks = document.getElementById("wikiDestLinks"); if (destLinks) destLinks.style.display = state.isPOI ? "none" : "block";

    currentMissionData = state.currentMissionData; routeWaypoints = state.routeWaypoints;
    window._missionRouteWaypoints = state.missionRouteWaypoints || null;
    const restoredHasPassenger = missionHasPassengerByPaxText(state.mPay || '');
    let restoredPassenger = null;
    if (restoredHasPassenger) {
        restoredPassenger = (state.activePassenger && typeof state.activePassenger === 'object') ? state.activePassenger : null;
        if (!restoredPassenger) {
            try {
                const lsPassenger = JSON.parse(localStorage.getItem('ga_active_passenger') || 'null');
                if (lsPassenger && typeof lsPassenger === 'object') restoredPassenger = lsPassenger;
            } catch (_) {}
        }
    }
    window.activePassenger = restoredPassenger;

    let restoredMissionContract = (state.activeMissionContract && typeof state.activeMissionContract === 'object')
        ? state.activeMissionContract
        : ((state.currentMissionData?.missionContract && typeof state.currentMissionData.missionContract === 'object')
            ? state.currentMissionData.missionContract
            : null);
    if (!restoredMissionContract) {
        try {
            const lsContract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null');
            if (lsContract && typeof lsContract === 'object') restoredMissionContract = lsContract;
        } catch (_) {}
    }
    window.activeMissionContract = restoredMissionContract || null;
    if (currentMissionData && typeof currentMissionData === 'object') {
        currentMissionData.missionContract = window.activeMissionContract;
        if (currentMissionData.fireScenario && !missionDataAllowsFireWatchScenario(currentMissionData, window.activePassenger, window.activeMissionContract)) {
            delete currentMissionData.fireScenario;
        }
    }
    try {
        if (window.activePassenger) localStorage.setItem('ga_active_passenger', JSON.stringify(window.activePassenger));
        else localStorage.removeItem('ga_active_passenger');
    } catch (_) {}
    try {
        if (window.activeMissionContract) localStorage.setItem('ga_active_mission_contract', JSON.stringify(window.activeMissionContract));
        else localStorage.removeItem('ga_active_mission_contract');
    } catch (_) {}
    if (typeof window.paxVoiceRefreshWidget === 'function') window.paxVoiceRefreshWidget();
    currentStartICAO = state.currentStartICAO; currentDestICAO = state.currentDestICAO;
    currentSName = state.currentSName; currentDName = state.currentDName;
    currentDepFreq = state.currentDepFreq || ""; currentDestFreq = state.currentDestFreq || "";
    currentDepElev = state.currentDepElev ?? null; currentDestElev = state.currentDestElev ?? null;
    freqCache = state.freqCache || {};
    vpAltWaypoints = state.vpAltWaypoints || [];
    vpSegmentAlts  = state.vpSegmentAlts  || [];
    vpElevationData = state.vpElevationData || null;
    // Routenwechsel-Detektor vorbelegen – verhindert, dass vpAltWaypoints nach dem Restore
    // sofort wieder gelöscht werden (window._lastVpRouteKey ist nach Reload undefined)
    if (state.routeWaypoints && state.routeWaypoints.length > 0) {
        window._lastVpRouteKey = state.routeWaypoints.map(p =>
            `${(p.lat || 0).toFixed(4)},${((p.lng || p.lon) || 0).toFixed(4)}`
        ).join('|');
    }

    // Fallback: Wenn Frequenzen im Briefing fehlen (z.B. alte Pinnwand-Daten), neu laden
    if (!state.wikiDepFreqText && currentStartICAO && currentStartICAO !== 'GPS') {
        fetchAirportFreq(currentStartICAO, 'wikiDepFreqText', 'dep');
    } else if (currentStartICAO === 'GPS' && document.getElementById("wikiDepFreqText")) {
        document.getElementById("wikiDepFreqText").innerHTML = '<span style="color:#888;">Live GPS Start</span>';
    }
    if (!state.wikiDestFreqText && currentDestICAO && !state.isPOI) {
        fetchAirportFreq(currentDestICAO, 'wikiDestFreqText', 'dest');
    }

    const startLocEl = document.getElementById('startLoc');
    const destLocEl = document.getElementById('destLoc');
    const startLocRadioEl = document.getElementById('startLocRadio');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (startLocEl) startLocEl.value = currentStartICAO || '';
    if (destLocEl) destLocEl.value = (currentDestICAO && currentDestICAO !== currentStartICAO) ? currentDestICAO : '';
    if (startLocRadioEl) startLocRadioEl.value = currentStartICAO || '';
    if (destLocRadioEl) destLocRadioEl.value = (currentDestICAO && currentDestICAO !== currentStartICAO) ? currentDestICAO : '';

    document.getElementById("briefingBox").style.display = "block";
    if (typeof window.updateMissionAcceptanceUi === 'function') window.updateMissionAcceptanceUi();
    renderMainRoute(); setDrumCounter('distDrum', state.currentMissionData.dist);
    recalculatePerformance(); document.getElementById('searchIndicator').innerText = "📋 Gespeichertes Briefing geladen.";
    if (typeof window.updateMissionAcceptanceUi === 'function') window.updateMissionAcceptanceUi();

    gpsState.mode = 'FPL';
    gpsState.subPage = 0;
    gpsState.maxPages = { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 };
    gpsState.wikiCache = {};
    gpsState.metarCache = {};
    runwayCache = {};
    document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));

    setTimeout(() => {
        refreshGPSAfterDispatch();
        vpUpdatePosition(0);
    }, 200);

    if (currentStartICAO && currentStartICAO !== 'GPS') {
        const depPoint = routeWaypoints && routeWaypoints.length > 0 ? routeWaypoints[0] : null;
        const depLat = Number(depPoint?.lat);
        const depLon = Number(depPoint?.lng ?? depPoint?.lon);
        if (Number.isFinite(depLat) && Number.isFinite(depLon)) {
            fetchRunwayDetails(depLat, depLon, 'mDepRwy', currentStartICAO);
        } else {
            getAirportData(currentStartICAO).then(d => {
                if (d) fetchRunwayDetails(d.lat, d.lon, 'mDepRwy', currentStartICAO);
            });
        }
    } else if (currentStartICAO === 'GPS') {
        document.getElementById("mDepRwy").innerText = "Live-Start";
    }
    if (currentDestICAO && currentDestICAO !== currentStartICAO && !state.isPOI) {
        const destPoint = routeWaypoints && routeWaypoints.length > 1 ? routeWaypoints[routeWaypoints.length - 1] : null;
        const destLat = Number(destPoint?.lat);
        const destLon = Number(destPoint?.lng ?? destPoint?.lon);
        if (Number.isFinite(destLat) && Number.isFinite(destLon)) {
            fetchRunwayDetails(destLat, destLon, 'mDestRwy', currentDestICAO);
        } else {
            getAirportData(currentDestICAO).then(d => {
                if (d) fetchRunwayDetails(d.lat, d.lon, 'mDestRwy', currentDestICAO);
            });
        }
    }

    // --- NEU: Restore METAR Widgets ---
    const depP = routeWaypoints && routeWaypoints.length > 0 ? routeWaypoints[0] : null;
    loadMetarWidget(currentStartICAO === 'GPS' ? null : currentStartICAO, 'metarContainerDep', depP?.lat, depP?.lng || depP?.lon);

    const destP = routeWaypoints && routeWaypoints.length > 1 ? routeWaypoints[routeWaypoints.length - 1] : null;
    loadMetarWidget(state.isPOI ? null : currentDestICAO, 'metarContainerDest', destP?.lat, destP?.lng || destP?.lon);
    if (typeof window.updateMissionAcceptanceUi === 'function') window.updateMissionAcceptanceUi();

}

function resetApp() {
    if (!confirm("Möchtest du das aktuelle Briefing wirklich verwerfen und alles auf Anfang setzen?")) return;
    _abortDispatchRun('Clear');
    if (window.meterInterval) {
        clearInterval(window.meterInterval);
        window.meterInterval = null;
    }
    const needle = document.getElementById('meterNeedle');
    if (needle) needle.style.transform = 'translateX(-50%) rotate(-45deg)';
    const led = document.getElementById('meterLed');
    if (led) led.classList.remove('led-green', 'led-blue', 'led-red', 'led-flash3');
    document.querySelectorAll('.marker-light').forEach(l => l.classList.remove('blinking', 'on'));
    localStorage.removeItem('ga_active_mission'); document.getElementById("briefingBox").style.display = "none";
    currentMissionData = null; routeWaypoints = []; window._missionRouteWaypoints = null;
    window.activeMissionContract = null;
    localStorage.removeItem('ga_active_mission_contract');
    if (typeof window.updateMissionAcceptanceUi === 'function') window.updateMissionAcceptanceUi();
    if (typeof window.clearPinnedFlightReplay === 'function') window.clearPinnedFlightReplay();
    window._lastReplayRouteKey = '';
    vpAltWaypoints = []; vpSegmentAlts = [];
    vpElevationData = null; window.vpElevationData = null;
    window._lastVpRouteKey = null; window.vpBgNeedsUpdate = true;
    if (map) { routeMarkers.forEach(m => map.removeLayer(m)); if (polyline) { map.removeLayer(polyline); polyline = null; } if (window.hitBoxPolyline) { map.removeLayer(window.hitBoxPolyline); window.hitBoxPolyline = null; } clearAirspaceMapLayers(); if (typeof wxMapMarkers !== 'undefined') { wxMapMarkers.forEach(m => map.removeLayer(m)); wxMapMarkers = []; } }
    if (miniMap) { if (miniRoutePolyline) miniMap.removeLayer(miniRoutePolyline); miniMapMarkers.forEach(m => miniMap.removeLayer(m)); miniMapMarkers = []; }

    const destLocEl = document.getElementById('destLoc');
    const destLocRadioEl = document.getElementById('destLocRadio');
    setMissionNoteFrontIndex(0);
    if (destLocEl) destLocEl.value = '';
    if (destLocRadioEl) destLocRadioEl.value = '';

    document.getElementById('searchIndicator').innerText = "System bereit."; setDrumCounter('distDrum', 0); recalculatePerformance();
    setDispatchLampState('idle');
    if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
    const rBtn = document.getElementById('radioGenerateBtn');
    if (rBtn) rBtn.classList.remove('active');

    gpsState.wikiCache = {};
    gpsState.metarCache = {};
    runwayCache = {};
    gpsState.mode = 'FPL';
    gpsState.subPage = 0;
    gpsState.maxPages = { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 };
    document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));
    renderGPS();

    // --- NEU: METAR Widgets resetten ---
    loadMetarWidget(null, 'metarContainerDep');
    loadMetarWidget(null, 'metarContainerDest');

    // Position Marker im Profil zurücksetzen
    vpPositionFraction = 0;
    if (vpPositionLeafletMarker && map) {
        map.removeLayer(vpPositionLeafletMarker);
        vpPositionLeafletMarker = null;
    }

    // Höhenband: Bereitschaftsstand (leeres Profil)
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
/* =========================================================
   4. HELPER-FUNKTIONEN (UI & Mathe)
   ========================================================= */
function setDrumCounter(elementId, valueStr) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const normalizeDisplayValue = () => {
        if (elementId !== 'distDrum') return String(valueStr ?? '0');
        const parsed = Number(String(valueStr ?? '').replace(',', '.'));
        if (!Number.isFinite(parsed)) return '0.0';
        return (Math.round(parsed * 10) / 10).toFixed(1);
    };
    const displayValue = normalizeDisplayValue();
    const renderFallback = () => {
        container.textContent = displayValue;
        container.dataset.lastVal = displayValue;
    };

    try {
        if (!document.body.classList.contains('theme-retro')) {
            // Im Modern-Design immer als reinen Text rendern, damit keine Drum-HTML
            // (aus vorherigem Retro-Render) in UI-Elemente wie TAS/ALT/VS hineinragt.
            if (container.textContent !== displayValue || container.querySelector('.drum-window')) {
                container.textContent = displayValue;
            }
            container.dataset.lastVal = displayValue;
            if (window.drumCache && window.drumCache[elementId]) delete window.drumCache[elementId];
            return;
        }

        let tokenValue = displayValue.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        if (!tokenValue) tokenValue = (elementId === 'distDrum') ? '0.0' : '0';
        const tokens = tokenValue.split('');
        const digitHeight = 22;

        let cache = window.drumCache[elementId];
        
        // Wenn Element nicht im Cache ist oder der Container geleert wurde: Neu aufbauen
        if (!cache || !cache.windowEl || !container.contains(cache.windowEl)) {
            container.innerHTML = '<div class="drum-window"></div>';
            cache = {
                windowEl: container.querySelector('.drum-window'),
                strips: [],
                layoutKey: ''
            };
            window.drumCache[elementId] = cache;
        }

        const layoutKey = tokens.map(ch => (/\d/.test(ch) ? '#' : ch)).join('');
        if (cache.layoutKey !== layoutKey) {
            cache.windowEl.innerHTML = '';
            cache.strips = [];
            tokens.forEach((token) => {
                if (/\d/.test(token)) {
                    const strip = document.createElement('div');
                    strip.className = 'drum-strip';
                    strip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<div class="drum-digit">${d}</div>`).join('');
                    cache.windowEl.appendChild(strip);
                    cache.strips.push(strip);
                    return;
                }
                const sep = document.createElement('div');
                sep.className = 'drum-separator';
                sep.textContent = token;
                cache.windowEl.appendChild(sep);
            });
            cache.layoutKey = layoutKey;
        }

        // Werte (CSS Transform) aktualisieren
        const digits = tokens.filter(token => /\d/.test(token));
        digits.forEach((digit, index) => {
            if (!cache.strips[index]) return;
            const translateY = -(parseInt(digit) * digitHeight);
            const transformStr = `translateY(${translateY}px)`;
            if (cache.strips[index].style.transform !== transformStr) {
                cache.strips[index].style.transform = transformStr;
            }
        });
        container.dataset.lastVal = displayValue;
    } catch (err) {
        console.error('setDrumCounter failed:', err);
        renderFallback();
        if (window.drumCache && window.drumCache[elementId]) delete window.drumCache[elementId];
    }
}
let vpRenderPending = false;
window.throttledRenderProfiles = function() {
    if (vpRenderPending) return;
    vpRenderPending = true;
    requestAnimationFrame(() => {
        const perf = window.gaPerfStart ? window.gaPerfStart('Profile render batch') : null;
        const mapTable = document.getElementById('mapTableOverlay');
        const mapTableOpen = !!(mapTable && mapTable.classList.contains('active'));

        // Stabilitaet vor Micro-Optimierung: das Hauptprofil immer frisch halten,
        // auch wenn Drawer-/Overlay-Zustaende kurzzeitig hinterherhaengen.
        if (document.getElementById('verticalProfileCanvas')) {
            const smallPerf = window.gaPerfStart ? window.gaPerfStart('Profile render small canvas') : null;
            renderVerticalProfile('verticalProfileCanvas');
            if (window.gaPerfEnd) window.gaPerfEnd(smallPerf);
        }
        if (mapTableOpen && typeof renderMapProfile === 'function') {
            const mapPerf = window.gaPerfStart ? window.gaPerfStart('Profile render map canvas schedule') : null;
            renderMapProfile();
            if (window.gaPerfEnd) window.gaPerfEnd(mapPerf);
        }
        if (window.gaPerfEnd) window.gaPerfEnd(perf, { mapTableOpen });
        vpRenderPending = false;
    });
};

window.vpIsFastRendering = false;
let vpFastRenderTimeout = null;
window.activateFastRender = function() {
    window.vpIsFastRendering = true;
    window.vpBgNeedsUpdate = true; // Zwingt Layer 1 zum Update
    if (vpFastRenderTimeout) clearTimeout(vpFastRenderTimeout);
    vpFastRenderTimeout = setTimeout(() => {
        window.vpIsFastRendering = false;
        window.vpBgNeedsUpdate = true; 
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }, 350);
};

function handleSliderChange(type, val) {
    let drumVal = val;
    if (type === 'tas' || type === 'gph' || type === 'alt') persistMainPerformanceSetting(type, val);
    if (type === 'gph') {
        drumVal = val.toString().padStart(2, '0');
        syncToNavCom('gphRadioDisplay', drumVal);
    }
    setDrumCounter(type + 'Drum', drumVal);
    if (type !== 'alt') recalculatePerformance();
    syncToNavCom(type + 'Radio', val);
    if (type === 'alt') {
        syncToNavCom('altRadioDisplay', val);
        const mInp = document.getElementById('altMapInput');
        if (mInp && mInp.innerText != val) mInp.innerText = val;

        // Direkter Render-Aufruf! KEIN 3-Sekunden triggerVerticalProfileUpdate() mehr!
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
        // Terrain-Avoid Overlay an die geänderte CRZ-Höhe koppeln.
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        // Lufträume nur prüfen, wenn wir nicht gerade aktiv ziehen
        if (!window.vpUIInteractionActive && typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
    }
    if (type === 'tas' && typeof renderRouteLegLabels === 'function') renderRouteLegLabels();
    if (typeof updateOpsRotaryReadouts === 'function') updateOpsRotaryReadouts();
}

function handleRateChange(val) {
    val = parseInt(val);
    persistMainPerformanceSetting('rate', val);
    vpClimbRate = val;
    vpDescentRate = val;
    // Sync displays
    setDrumCounter('rateDrum', val);
    const rateMapDisplay = document.getElementById('rateMapDisplay');
    if (rateMapDisplay) rateMapDisplay.textContent = val;
    // Sync sliders
    const rateSlider = document.getElementById('rateSlider');
    const rateMapInp = document.getElementById('rateMapInput');
    if (rateSlider) rateSlider.value = val;
    if (rateMapInp && rateMapInp.innerText != val) rateMapInp.innerText = val;
    // Sync NAVCOM if in rate mode
    if (typeof navcomAltMode !== 'undefined' && navcomAltMode === 'rate') {
        const altRadioDisplay = document.getElementById('altRadioDisplay');
        if (altRadioDisplay) altRadioDisplay.textContent = val;
    }
    // Re-render profiles
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    if (!window.vpUIInteractionActive && typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
    if (typeof updateOpsRotaryReadouts === 'function') updateOpsRotaryReadouts();
}

function recalculatePerformance() {
    if (!currentMissionData) return;
    const tas = parseInt(document.getElementById("tasSlider").value), gph = parseInt(document.getElementById("gphSlider").value), dist = currentMissionData.dist;
    setDrumCounter('timeDrum', Math.round((dist / tas) * 60)); setDrumCounter('fuelDrum', Math.ceil((dist / tas * gph) + (0.75 * gph)));
    if (gpsState.visible && gpsState.mode === 'FPL') renderGPS();
    window.debouncedSaveMissionState();
}

function refreshAllDrums() {
    setDrumCounter('tasDrum', document.getElementById('tasSlider').value);
    setDrumCounter('gphDrum', document.getElementById('gphSlider').value.toString().padStart(2, '0'));
    const altSlider = document.getElementById('altSlider'); if (altSlider) setDrumCounter('altDrum', altSlider.value);
    const rateSlider = document.getElementById('rateSlider'); if (rateSlider) setDrumCounter('rateDrum', rateSlider.value);
    if (currentMissionData) { setDrumCounter('distDrum', currentMissionData.dist); recalculatePerformance(); }
}

function applyPreset(t, g, s, n) {
    document.getElementById('tasSlider').value = t; document.getElementById('gphSlider').value = g;
    document.getElementById('maxSeats').value = s;
    if (AIRCRAFT_PRESET_SLOT_ORDER.includes(n)) {
        selectedAC = n;
        window.selectedAC = selectedAC;
    }
    persistMainPerformanceSetting('maxSeats', s);
    persistMainPerformanceSetting('aircraft', selectedAC);
    handleSliderChange('tas', t); handleSliderChange('gph', g);
    syncToNavCom('tasRadio', t);
    syncToNavCom('gphRadio', g);
    syncToNavCom('maxSeatsRadio', s);
    updateNavComAircraftButtons();
    selectAircraftPresetSlotFromSettings(selectedAC);
    if (typeof updateOpsAircraftSwitches === 'function') updateOpsAircraftSwitches();
    updateOps1940Panel();
    saveAudioButtonStates();
}

function copyCoords(elementId) {
    const txt = document.getElementById(elementId).innerText;
    if (txt && txt !== "-") { navigator.clipboard.writeText(txt).then(() => alert("Koordinaten kopiert:\n" + txt)); }
}

function checkBearing(b, dirPref) {
    if (dirPref === 'any') return true;
    if (dirPref === 'N' && (b <= 45 || b >= 315)) return true;
    if (dirPref === 'E' && (b >= 45 && b <= 135)) return true;
    if (dirPref === 'S' && (b >= 135 && b <= 225)) return true;
    if (dirPref === 'W' && (b >= 225 && b <= 315)) return true;
    return false;
}

function resetBtn(btn) {
    if (btn) { btn.disabled = false; btn.innerText = "Auftrag generieren"; }
    const rBtn = document.getElementById('radioGenerateBtn');
    if (rBtn) {
        rBtn.classList.remove('disabled');
        rBtn.style.pointerEvents = '';
        const label = rBtn.querySelector('.audio-btn-label');
        if (label) label.textContent = "DISPATCH";
    }
}

function setDispatchLampState(state = 'idle', dataSource = '') {
    const btn = document.getElementById('generateBtn');
    if (!btn) return;
    const classes = [
        'dispatch-lamp-working',
        'dispatch-lamp-ai-g3',
        'dispatch-lamp-ai-g25',
        'dispatch-lamp-ai-lite',
        'dispatch-lamp-local',
        'dispatch-lamp-error'
    ];
    btn.classList.remove(...classes);

    if (state === 'working') {
        btn.classList.add('dispatch-lamp-working');
        return;
    }
    if (state === 'error') {
        btn.classList.add('dispatch-lamp-error');
        return;
    }
    if (state === 'done') {
        if (dataSource === "Gemini 3.0 Flash") btn.classList.add('dispatch-lamp-ai-g3');
        else if (dataSource === "Gemini 2.5 Flash") btn.classList.add('dispatch-lamp-ai-g25');
        else if (dataSource === "Gemini 2.5 Flash Lite") btn.classList.add('dispatch-lamp-ai-lite');
        else btn.classList.add('dispatch-lamp-local');
    }
}

let _dispatchRunId = 0;
let _dispatchState = { active: false, cancelled: false, runId: 0 };
const MISSION_PIPELINE_V2_STORAGE_KEY = 'ga_debug_mission_pipeline_v2';

function _startDispatchRun() {
    _dispatchRunId += 1;
    _dispatchState = { active: true, cancelled: false, runId: _dispatchRunId };
    return _dispatchRunId;
}

function _isDispatchRunAlive(runId) {
    return !!(_dispatchState && _dispatchState.active && !_dispatchState.cancelled && _dispatchState.runId === runId);
}

function _abortDispatchRun(reason = 'Abbruch') {
    if (!_dispatchState.active) return false;
    _dispatchState.cancelled = true;
    _dispatchState.active = false;
    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = `Dispatch abgebrochen (${reason}).`;
    const btn = document.getElementById('generateBtn');
    resetBtn(btn);
    if (window.meterInterval) clearInterval(window.meterInterval);
    const needle = document.getElementById('meterNeedle');
    if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;
    setDispatchLampState('idle');
    return true;
}

function isMissionPipelineV2Enabled() {
    try { return localStorage.getItem(MISSION_PIPELINE_V2_STORAGE_KEY) === 'true'; } catch (_) { return false; }
}
window.isMissionPipelineV2Enabled = isMissionPipelineV2Enabled;

function updateMissionPipelineV2ButtonUi() {
    const btn = document.getElementById('btnMissionPipelineV2');
    if (!btn) return;
    const on = isMissionPipelineV2Enabled();
    btn.textContent = on ? 'Pipeline V2 An' : 'Pipeline V2 Aus';
    btn.style.background = on ? '#3d2463' : '#241b3b';
    btn.style.color = on ? '#f0e6ff' : '#d8c7ff';
}
window.updateMissionPipelineV2ButtonUi = updateMissionPipelineV2ButtonUi;

window.toggleMissionPipelineV2 = function(forceState) {
    const next = (typeof forceState === 'boolean') ? forceState : !isMissionPipelineV2Enabled();
    try { localStorage.setItem(MISSION_PIPELINE_V2_STORAGE_KEY, String(!!next)); } catch (_) {}
    updateMissionPipelineV2ButtonUi();
    if (typeof window.vpRefreshWeatherDebugReport === 'function') {
        try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
    }
    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = next
        ? 'Debug: Mission Pipeline V2 aktiv.'
        : 'Debug: Klassische Mission Pipeline aktiv.';
    return !!next;
};

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', updateMissionPipelineV2ButtonUi);
}

async function loadMetarWidget(icao, containerId, lat, lon, forceModern = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Zwingt das Widget ins "Modern"-Design, auch wenn das Retro-Theme aktiv ist (wichtig für Karten-Popups)
    const isRetro = !forceModern && document.body.classList.contains('theme-retro');
    const isOps1940 = !forceModern && document.body.classList.contains('theme-ops1940');
    if (isRetro || isOps1940) {
        container.style.boxShadow = 'none';
        container.style.background = 'transparent';
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-family: \'Caveat\', cursive; font-size:22px; transform: rotate(-1deg);">Sucht lokales Wetter...</div>';
    } else {
        container.style.boxShadow = '';
        container.style.background = '';
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#888; font-size:12px; background:#1a1a1a; border-radius:6px;">Sucht lokales Wetter...</div>';
    }

    if (!icao || icao === 'POI') {
        container.style.display = 'none';
        return;
    }
    const icaoNorm = String(icao || '').trim().toUpperCase();
    const looksLikeIcao = /^[A-Z0-9]{4}$/.test(icaoNorm);
    container.style.display = 'block';

    try {
        let metarDataList = [];
        let isFallback = false;
        let foundIcao = icaoNorm;

        // --- CACHE LOGIK: Bulk-Daten aus dem Profil nutzen oder Theme-Wechsel abfangen ---
        const cacheKey = icaoNorm + (lat ? `_${lat.toFixed(2)}` : '') + (lon ? `_${lon.toFixed(2)}` : '');
        const cachedEntry = gpsState.metarCache[cacheKey] || gpsState.metarCache[icaoNorm];
        if (cachedEntry) {
            metarDataList = cachedEntry.data;
            isFallback = cachedEntry.isFallback;
            foundIcao = cachedEntry.foundIcao;
        } else {

            function parseMetarTextToArray(txt) {
                if (typeof txt !== 'string') return null;
                const t = txt.trim();
                if (!t) return null;
                try {
                    const parsed = JSON.parse(t);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && Array.isArray(parsed.data)) return parsed.data;
                    if (parsed && Array.isArray(parsed.results)) return parsed.results;
                    if (parsed && typeof parsed.contents === 'string') {
                        const nested = JSON.parse(parsed.contents);
                        return Array.isArray(nested) ? nested : null;
                    }
                } catch (_) {}
                return null;
            }

            async function safeFetch(urlObj, retries = 3) {
                const skipDirectMetarFetch = true;
                const proxyUrls = [
                    (u) => `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(u)}`,
                    (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
                ];
                for (let i = 0; i < retries; i++) {
                    if (!skipDirectMetarFetch) {
                        try {
                            const r = await fetch(urlObj);
                            if (r.ok && r.status !== 204) {
                                const t = await r.text();
                                const arr = parseMetarTextToArray(t);
                                if (arr) return arr;
                            }
                        } catch (_) {}
                    }

                    for (const mkProxyUrl of proxyUrls) {
                        try {
                            const pr = await fetch(mkProxyUrl(urlObj));
                            if (!pr.ok || pr.status === 204) continue;
                            const t = await pr.text();
                            const arr = parseMetarTextToArray(t);
                            if (arr) return arr;
                        } catch (_) {}
                    }
                    if (i < retries - 1) await new Promise(res => setTimeout(res, 600));
                }
                return null;
            }

            if (looksLikeIcao) {
                const directUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoNorm}&format=json&t=${Date.now()}`;
                const mainData = await safeFetch(directUrl);
                if (Array.isArray(mainData)) metarDataList = mainData;
            }

            if ((!metarDataList || metarDataList.length === 0) && lat !== undefined && lon !== undefined) {
                const latMin = lat - 0.6, latMax = lat + 0.6;
                const lonMin = lon - 0.8, lonMax = lon + 0.8;
                const fbUrl = `https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`;
                const fbData = await safeFetch(fbUrl);
                if (Array.isArray(fbData)) {
                    try {
                        if (fbData.length > 0) {
                            const candidates = fbData.filter(m =>
                                m &&
                                Number.isFinite(Number(m.lat)) &&
                                Number.isFinite(Number(m.lon))
                            );
                            if (candidates.length > 0) {
                                let closest = candidates[0];
                                let minDist = calcNav(lat, lon, Number(closest.lat), Number(closest.lon)).dist;
                                for (let i = 1; i < candidates.length; i++) {
                                    let d = calcNav(lat, lon, Number(candidates[i].lat), Number(candidates[i].lon)).dist;
                                    if (d < minDist) { minDist = d; closest = candidates[i]; }
                                }
                                metarDataList = [closest];
                                foundIcao = closest.icaoId || icaoNorm;
                                isFallback = true;
                            }
                        }
                    } catch (parseErr) {
                        console.error("Failed to process fallback METAR JSON", parseErr);
                    }
                }
            }

            // Ergebnis in den Cache legen
            gpsState.metarCache[cacheKey] = { data: metarDataList, isFallback, foundIcao };

        } // Ende der Cache-Else-Bedingung

        if (!Array.isArray(metarDataList)) metarDataList = [];
        metarDataList = metarDataList.filter(m => m && typeof m === 'object');

        if (!metarDataList || metarDataList.length === 0) {
            if (isRetro) {
                container.innerHTML = `
                    <div style="padding:15px; text-align:center; font-family: 'Caveat', cursive; transform: rotate(1deg);">
                        <div style="color:#d93829; font-weight:bold; font-size: 22px; margin-bottom:5px;">Kein METAR in der Nähe von ${icao}</div>
                        <div style="font-size:18px; color:#555; margin-bottom:12px;">Kein automatisches Wetter verfügbar.</div>
                        <a href="https://metar-taf.com/de/${icao}" target="_blank" style="display:inline-block; color:#0b1f65; font-size:20px; font-weight:bold; text-decoration:underline;">Manuell suchen ➔</a>
                    </div>`;
            } else {
                container.innerHTML = `
                    <div style="background:#1a1a1a; border-radius:6px; padding:15px; text-align:center; border: 1px solid #333;">
                        <div style="color:#d93829; font-weight:bold; margin-bottom:5px;">Kein METAR in der Nähe von ${icao}</div>
                        <div style="font-size:11px; color:#888; margin-bottom:12px;">Für diesen Bereich steht kein automatisches Wetter zur Verfügung.</div>
                        <a href="https://metar-taf.com/de/${icao}" target="_blank" style="display:inline-block; background:#4da6ff; color:#111; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; transition: background 0.2s;">Manuell suchen ➔</a>
                    </div>`;
            }
            return;
        }

        const metar = metarDataList[0];
        if (!metar || typeof metar !== 'object') {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Kein verwertbares METAR für ${icao} gefunden.</div>`;
            return;
        }
        const raw = typeof metar.rawOb === 'string'
            ? metar.rawOb
            : (typeof metar.raw === 'string' ? metar.raw : "");
        const temp = metar.temp != null ? metar.temp + '°C' : '--';
        const dewp = metar.dewp != null ? metar.dewp + '°C' : '--';
        let catColor = "#fff";
        let catText = metar.fltCat || "N/A";
        if (catText === "VFR") catColor = "#33ff33";
        else if (catText === "MVFR") catColor = "#4da6ff";
        else if (catText === "IFR") catColor = "#ff3333";
        else if (catText === "LIFR") catColor = "#ff33ff";

        let cover = metar.cover || "--";
        if (cover === "Clear") cover = "CLR";

        let visib = metar.visib !== undefined && metar.visib !== null ? metar.visib + ' sm' : '--';
        const visMatch = raw.match(/\s(\d{4})\s/);
        if (raw.includes(' 9999 ')) visib = '> 10 km';
        else if (visMatch && !visMatch[1].startsWith('0000')) visib = parseInt(visMatch[1], 10) + ' m';
        let wx = metar.wxString ? metar.wxString.replace(/,/g, ' ') : 'NIL';

        let qnhStr = "--";
        const qMatch = raw.match ? raw.match(/Q(\d{4})/) : null;
        const aMatch = raw.match ? raw.match(/A(\d{4})/) : null;
        if (qMatch) qnhStr = qMatch[1] + ' hPa';
        else if (aMatch) qnhStr = Math.round((parseInt(aMatch[1]) / 100) * 33.8639) + ' hPa';

        let wdir = metar.wdir, wspd = metar.wspd || 0, wgst = metar.wgst ? `G${metar.wgst}` : '';
        let isVRB = raw.match ? /VRB\d{2,3}KT/.test(raw) : (wdir === "VRB");
        let windText = isVRB ? `VRB / ${wspd}${wgst} kt` : `${wdir}° / ${wspd}${wgst} kt`;
        if (wspd === 0) windText = "Calm (0 kt)";

        const isMini = containerId.startsWith('wxPopup');
        
        // Für Vollansicht: auf Pisten-Daten warten; für Mini-Popup direkt aus Cache lesen
        let retries = 0;
        if (!isMini) {
            while (!runwayCache[foundIcao] && !runwayCache[icao] && retries < 15) {
                await new Promise(r => setTimeout(r, 200));
                retries++;
            }
        }

        let rwyHdg = 0; let rwy1 = ""; let rwy2 = "";
        {
            const rData = runwayCache[foundIcao] || runwayCache[icao];
            if (rData && !rData.includes('Keine Daten')) {
                const match = rData.match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
                if (match) { rwyHdg = parseInt(match[1], 10) * 10; rwy1 = match[1] + match[2]; rwy2 = match[3]; }
            }
        }

        const headerText = isFallback ? `Nearest: ${foundIcao}` : `Station: ${icaoNorm}`;
        const modernHeaderText = isFallback ? `▶ NEAREST: ${foundIcao}` : `▶ STATION: ${icaoNorm}`;

        if (isRetro) {
            let svgTicks = `
                <circle cx="80" cy="80" r="70" stroke="#444" stroke-width="1.5" fill="none" stroke-dasharray="30.65 6" transform="rotate(2.45 80 80)"/>
                <circle cx="80" cy="80" r="3" fill="#444" />`;
            
            // Füge N, O, S, W und 30-Grad-Schritte rotierend hinzu
            for (let i = 0; i < 360; i += 30) {
                const angleRad = (i - 90) * Math.PI / 180;
                const radius = 61;
                const tx = 80 + radius * Math.cos(angleRad);
                const ty = 80 + radius * Math.sin(angleRad);
                
                // dx="-2" gleicht den kursiven Schwung (Slant) von Caveat aus, der sonst wie eine Rechtsrotation wirkt
                if (i % 90 === 0) {
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-2" font-family="'Caveat', cursive" font-size="22" fill="#222" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                } else {
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-1.5" font-family="'Caveat', cursive" font-size="14" fill="#666" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                }
            }
            
            let rwyHtml = '';
            if (rwy1 && rwy2) {
                // Piste wurde oben und unten gekürzt (y="29", height="102") um Abstand zu den Zahlen zu gewinnen
                rwyHtml = `
                    <g transform="translate(80,80) rotate(${rwyHdg}) translate(-80,-80)">
                        <rect x="68" y="29" width="24" height="102" fill="none" stroke="#222" stroke-width="1.5" stroke-dasharray="30 4 15 4"/>
                        <text x="80" y="43" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" transform="rotate(180 80 39)">${rwy2}</text>
                        <text x="80" y="125" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle">${rwy1}</text>
                    </g>`;
            }

            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <g transform="rotate(${wdir} 80 80)">
                    <path d="M 80 10 C 77 30, 83 50, 80 65" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <path d="M 74 54 L 80 68 L 86 52" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </g>`;
            }

            container.innerHTML = `
                <div style="font-family: 'Caveat', cursive; color: #222; padding: 5px; position:relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(0,0,0,0.5); padding-bottom: 2px; margin-bottom: 12px;">
                        <span style="font-size: 24px; font-weight: bold; color: #0b1f65; transform: rotate(-1deg); display: inline-block;">${headerText}</span>
                        <span style="font-size: 18px; font-weight: bold; color: ${catColor}; border: 2px solid ${catColor}; padding: 0 6px; border-radius: 3px; transform: rotate(2deg); display: inline-block; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    <div style="font-size: 17px; line-height: 1.25; margin-bottom: 15px; color: #333; padding-left: 12px; border-left: 2px solid rgba(0,0,0,0.2); transform: rotate(0.5deg);">
                        ${raw}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="font-size: 20px; line-height: 1.3; display: flex; flex-direction: column; gap: 2px;">
                            <div><span style="color:#666; font-size: 16px;">Wind:</span> <b style="color:#1a73e8; font-size:22px;">${windText}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Vis:</span> <b>${visib}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Wx:</span> <b>${wx}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Temp:</span> <b>${temp}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Dew:</span> <b>${dewp}</b></div>
                            <div><span style="color:#666; font-size: 16px;">QNH:</span> <b>${qnhStr}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Cloud:</span> <b>${cover}</b></div>
                        </div>
                        <div style="position:relative; width: 130px; height: 130px; flex-shrink: 0;">
                            <svg viewBox="0 0 160 160" style="width:100%; height:100%; overflow:visible;">
                                ${svgTicks}${rwyHtml}${arrowHtml}
                            </svg>
                        </div>
                    </div>
                </div>`;
        } else {
            let svgTicks = '';
            for (let i = 0; i < 360; i += 5) {
                const isCard = i % 90 === 0, isLong = i % 10 === 0;
                const len = isCard ? 8 : (isLong ? 5 : 3), sw = isCard ? 2 : 1, col = isCard ? '#111' : '#888';
                svgTicks += `<line x1="80" y1="2" x2="80" y2="${2 + len}" stroke="${col}" stroke-width="${sw}" transform="rotate(${i} 80 80)" />`;
                if (i % 30 === 0 && !isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="10" fill="#333" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                } else if (isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                }
            }
            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; pointer-events:none;">
                    <g transform="rotate(${wdir} 80 80)">
                        <line x1="80" y1="6" x2="80" y2="70" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"/>
                        <polygon points="72,55 80,80 88,55" fill="#1a73e8" />
                    </g>
                </svg>`;
            }

            let rwyHtmlModern = '';
            if (rwy1 && rwy2) {
                const rwyW = isMini ? '15px' : '26px';
                const rwyH = isMini ? '60px' : '105px';
                const rwyFSize = isMini ? '8px' : '10px';
                rwyHtmlModern = `
                <div style="position:absolute; top:50%; left:50%; width:${rwyW}; height:${rwyH}; background:#444; border:1px solid #111; border-radius: 3px; transform: translate(-50%, -50%) rotate(${rwyHdg}deg); transform-origin: center center; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding: 3px 0; box-sizing: border-box; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; transform: rotate(180deg); font-family: sans-serif;">${rwy2}</div>
                    <div style="width:2px; flex-grow:1; margin: 3px 0; background: repeating-linear-gradient(to bottom, #d4d4d4 0, #d4d4d4 6px, transparent 6px, transparent 12px);"></div>
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; font-family: sans-serif;">${rwy1}</div>
                </div>`;
            }

            let cSize = isMini ? 90 : 160;
            let gap = isMini ? 4 : 8;
            let fVal = isMini ? 12 : 15;
            let fLbl = isMini ? 9 : 10;
            let pPad = isMini ? '10px' : '15px 15px 20px 15px';
            const weatherFont = isOps1940 ? "'Caveat', cursive" : "'Courier New', Courier, monospace";
            const weatherOuterFont = isOps1940 ? "'Caveat', cursive" : "'Arial', sans-serif";
            const rawTextSafe = raw && raw.trim() ? raw : 'RAW nicht verfügbar';
            const miniDecoded = `${visib} · ${wx} · ${temp} / ${dewp} · ${cover}`;

            container.innerHTML = `
                <div style="${isMini ? 'background:none; border:none; box-shadow:none; padding:4px 0;' : `background:#f0eada; border-radius:12px; padding:${pPad}; border: 3px solid #c2bba8; box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.5);`} font-family:${weatherOuterFont}; color: #333; position:relative; overflow:hidden;">

                    ${!isMini ? `
                    <div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    ` : ''}

                    <div style="color: #8a1a12; font-size: 14px; font-weight: bold; margin-bottom: ${isMini?6:12}px; ${isMini ? '' : 'border-bottom: 2px dashed #c2bba8;'} padding-bottom: ${isMini?0:8}px; font-family:${weatherFont}; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px;">
                        <span>${modernHeaderText}</span>
                        <span style="color:${catColor}; font-size:14px; padding: 2px 8px; border: 2px solid ${catColor}; border-radius: 4px; background: rgba(255,255,255,0.7); box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    ${!isMini ? `<div style="background:#e6e0ce; color:#333; font-family:${weatherFont}; padding:10px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border: 1px inset #c2bba8; line-height: 1.4; letter-spacing: 0.5px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">${rawTextSafe}</div>` : ''}
                    ${isMini ? `<div style="background:#ece6d6; color:#2f2f2f; font-family:${weatherFont}; padding:6px 8px; border-radius:4px; font-size:10px; margin-bottom:8px; border:1px solid #c8c0ac; line-height:1.35; word-break:break-word;">${rawTextSafe}<br><span style="color:#555;">${miniDecoded}</span></div>` : ''}
                    <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="display:flex; flex-direction:column; gap:${gap}px; font-family:${weatherFont}; flex-shrink: 1; min-width: 0;">
                            <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WIND</div><div style="color:#1a73e8; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${windText}</div></div>
                            ${!isMini ? `
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">VIS</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${visib}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WX</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${wx}</div></div>
                            </div>
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">TEMP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${temp}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">DEWP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${dewp}</div></div>
                            </div>` : ''}
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">QNH</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${qnhStr}</div></div>
                                ${!isMini ? `<div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">COVER</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${cover}</div></div>` : ''}
                            </div>
                        </div>
                        <div style="position:relative; width:${cSize}px; height:${cSize}px; flex-shrink: 0; ${isMini ? 'margin-left: auto;' : ''} border:4px solid #a8a291; border-radius:50%; background:#fcfaf5; box-shadow: inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2);">
                            <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                ${svgTicks}
                            </svg>
                            ${rwyHtmlModern}
                            ${arrowHtml}
                        </div>
                    </div>
                </div>`;
        }
    } catch (err) {
        console.error("METAR fetch error:", err);
        const isRetro = document.body.classList.contains('theme-retro');
        const isOps1940 = document.body.classList.contains('theme-ops1940');
        if (isRetro || isOps1940) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-family: 'Caveat', cursive; font-size:20px; transform: rotate(-1deg);">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        } else {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        }
    }
}
function calcNav(lat1, lon1, lat2, lon2) {
    const R = 3440, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return { dist, brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) };
}

function getDestinationPoint(lat, lon, distNM, bearing) {
    const R = 3440.065, lat1 = lat * Math.PI / 180, lon1 = lon * Math.PI / 180, brng = bearing * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNM / R) + Math.cos(lat1) * Math.sin(distNM / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNM / R) * Math.cos(lat1), Math.cos(distNM / R) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function randomBearingForDirection(dirPref = 'any') {
    const d = String(dirPref || 'any').toUpperCase();
    if (d === 'N') {
        // North wraps around 0°.
        return (Math.random() < 0.5)
            ? (Math.random() * 45)
            : (315 + Math.random() * 45);
    }
    if (d === 'E') return 45 + Math.random() * 90;
    if (d === 'S') return 135 + Math.random() * 90;
    if (d === 'W') return 225 + Math.random() * 90;
    return Math.random() * 360;
}

function buildPoiRingSearchAnchor(startLat, startLon, minNm, maxNm, dirPref = 'any', localRadiusNm = 20) {
    const minD = Math.max(1, Number(minNm) || 5);
    const maxD = Math.max(minD + 0.5, Number(maxNm) || (minD + 20));
    const distNm = minD + Math.random() * (maxD - minD);
    const bearingDeg = randomBearingForDirection(dirPref);
    const p = getDestinationPoint(startLat, startLon, distNm, bearingDeg);
    return {
        lat: Number(p.lat),
        lon: Number(p.lon),
        distNm: Number(distNm),
        bearingDeg: Number(bearingDeg),
        localRadiusNm: Math.max(8, Number(localRadiusNm) || 20),
        strategy: 'ring-quadrant-anchor'
    };
}

function pickRandomTrainingPoiNearAirport(startLat, startLon, dirPref, minNm = 4, maxNm = 18) {
    const safeMin = Math.max(2, Number(minNm) || 4);
    const safeMax = Math.max(safeMin + 1, Number(maxNm) || 18);
    for (let i = 0; i < 24; i++) {
        const dist = safeMin + Math.random() * (safeMax - safeMin);
        const brg = Math.random() * 360;
        if (!checkBearing(brg, dirPref)) continue;
        const p = getDestinationPoint(startLat, startLon, dist, brg);
        return { n: 'Übungsgebiet', lat: p.lat, lon: p.lon, icao: 'POI', poiCategory: 'trn' };
    }
    const fallback = getDestinationPoint(startLat, startLon, Math.max(5, safeMin), 45);
    return { n: 'Übungsgebiet', lat: fallback.lat, lon: fallback.lon, icao: 'POI', poiCategory: 'trn' };
}

/* =========================================================
   5. DATEN-FETCHING (APIs & GEMINI KI)
   ========================================================= */
async function loadGlobalAirports() {
    if (globalAirports && Object.keys(globalAirports).length > 0) return;
    if (globalAirportsLoadPromise) {
        await globalAirportsLoadPromise;
        return;
    }

    const isValidAirportMap = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return false;
        const keys = Object.keys(parsed);
        if (keys.length < 1000) return false;
        // Mindest-Sanitycheck für das bekannte Schema.
        const sample = parsed.EDDM || parsed.EDDF || parsed.EDNY || parsed.LOWW;
        return !!(sample && typeof sample.lat === 'number' && typeof sample.lon === 'number');
    };

    const tryParseResponse = async (res) => {
        if (!res || !res.ok) return null;
        try {
            const parsed = await res.json();
            return isValidAirportMap(parsed) ? parsed : null;
        } catch (_) {
            return null;
        }
    };

    globalAirportsLoadPromise = (async () => {
        // Safari/Browser blocken fetch() auf lokale Dateien unter file://.
        // Dann direkt auf Online-Fallbacks gehen und keine Console-Error-Flut erzeugen.
        if (window.location && window.location.protocol === 'file:') {
            globalAirports = null;
            return;
        }

        const urls = [
            './airports.json',
            'airports.json',
            '/airports.json',
            `./airports.json?t=${Date.now()}`
        ];

        // 1) Erst SW/Browser-Cache direkt prüfen (robust bei Netzproblemen).
        if (typeof caches !== 'undefined' && caches && typeof caches.match === 'function') {
            for (const url of urls) {
                try {
                    const cached = await caches.match(url, { ignoreSearch: true });
                    const parsed = await tryParseResponse(cached);
                    if (parsed) {
                        globalAirports = parsed;
                        return;
                    }
                } catch (_) { }
            }
        }

        // 2) Normale Fetches (cache darf genutzt werden).
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'default' });
                const parsed = await tryParseResponse(res);
                if (parsed) {
                    globalAirports = parsed;
                    return;
                }
            } catch (_) { }
        }

        // 3) Letzter Versuch hart neu laden.
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'reload' });
                const parsed = await tryParseResponse(res);
                if (parsed) {
                    globalAirports = parsed;
                    return;
                }
            } catch (_) { }
        }

        // WICHTIG: Kein dauerhaftes "{}", sonst bleibt APT-Dispatch den ganzen
        // Session-Lauf defekt. Bei Fehler auf null lassen, damit spätere Retries
        // weiter möglich bleiben.
        globalAirports = null;
    })().finally(() => {
        globalAirportsLoadPromise = null;
    });

    await globalAirportsLoadPromise;
}

function getOpenAipDispatchBBox(lat, lon, maxNM) {
    const radiusNm = Math.max(90, Math.min(420, (Number(maxNM) || 120) * 1.25));
    const dLat = radiusNm / 60;
    const cosLat = Math.max(0.2, Math.abs(Math.cos((lat * Math.PI) / 180)));
    const dLon = radiusNm / (60 * cosLat);
    return {
        west: Math.max(-180, lon - dLon),
        south: Math.max(-90, lat - dLat),
        east: Math.min(180, lon + dLon),
        north: Math.min(90, lat + dLat)
    };
}

async function fetchOpenAipDispatchAirports(lat, lon, maxNM, regionPref = 'any') {
    const key = [
        Math.round(lat * 10) / 10,
        Math.round(lon * 10) / 10,
        Math.round((Number(maxNM) || 120) / 10) * 10,
        regionPref || 'any'
    ].join('|');
    const now = Date.now();
    const cached = openAipAirportDispatchCache.get(key);
    if (cached && (now - cached.ts) < 15 * 60 * 1000) {
        return cached.items;
    }

    const { west, south, east, north } = getOpenAipDispatchBBox(lat, lon, maxNM);
    const bbox = `${west},${south},${east},${north}`;
    const proxy = 'https://ga-proxy.einherjer.workers.dev';

    try {
        const res = await fetch(`${proxy}/api/airports?bbox=${bbox}&limit=1000&t=${now}`);
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const parsed = [];
        for (const item of items) {
            const coords = item?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const lonV = Number(coords[0]);
            const latV = Number(coords[1]);
            if (!Number.isFinite(latV) || !Number.isFinite(lonV)) continue;
            const icao = String(item?.icaoCode || item?.designator || '').trim().toUpperCase();
            if (!icao) continue;
            const isDE = icao.startsWith('ED') || icao.startsWith('ET');
            if (regionPref === 'de' && !isDE) continue;
            if (regionPref === 'int' && isDE) continue;
            parsed.push({
                icao,
                name: String(item?.name || icao),
                lat: latV,
                lon: lonV
            });
        }
        openAipAirportDispatchCache.set(key, { ts: now, items: parsed });
        return parsed;
    } catch (_) {
        return [];
    }
}

async function getAirportData(icao) {
    await loadGlobalAirports();
    if (globalAirports && globalAirports[icao]) {
        return {
            icao: icao,
            n: globalAirports[icao].name || globalAirports[icao].city,
            lat: globalAirports[icao].lat,
            lon: globalAirports[icao].lon
        };
    }
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${icao}+airport`); const data = await res.json();
        if (data && data.length > 0) return { icao: icao, n: data[0].display_name.split(',')[0], lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch (e) { }
    return null;
}

async function findGithubAirport(lat, lon, minNM, maxNM, dirPref, regionPref) {
    await loadGlobalAirports();
    if (!globalAirports || Object.keys(globalAirports).length === 0) {
        const fallbackAirports = await fetchOpenAipDispatchAirports(lat, lon, maxNM, regionPref);
        const validFromFallback = [];
        for (const apt of fallbackAirports) {
            if (apt.icao === currentStartICAO) continue;
            const navCalc = calcNav(lat, lon, apt.lat, apt.lon);
            if (navCalc.dist >= minNM && navCalc.dist <= maxNM && checkBearing(navCalc.brng, dirPref)) {
                validFromFallback.push({ icao: apt.icao, n: apt.name, lat: apt.lat, lon: apt.lon });
            }
        }
        if (validFromFallback.length > 0) {
            return validFromFallback[Math.floor(Math.random() * validFromFallback.length)];
        }
        // Einmal harter Retry lokal, falls sich der Modus/Host geändert hat.
        await loadGlobalAirports();
    }
    if (!globalAirports || Object.keys(globalAirports).length === 0) return null;

    let validAirports = [];
    for (const key in globalAirports) {
        const apt = globalAirports[key]; if (apt.icao === currentStartICAO) continue;
        const isDE = apt.icao.startsWith('ED') || apt.icao.startsWith('ET');
        if (regionPref === "de" && !isDE) continue; if (regionPref === "int" && isDE) continue;
        const navCalc = calcNav(lat, lon, apt.lat, apt.lon);
        if (navCalc.dist >= minNM && navCalc.dist <= maxNM && checkBearing(navCalc.brng, dirPref)) { validAirports.push({ icao: apt.icao, n: apt.name || apt.city || "Unbekannt", lat: apt.lat, lon: apt.lon }); }
    }
    if (validAirports.length > 0) return validAirports[Math.floor(Math.random() * validAirports.length)];
    return null;
}

function normalizeMissionText(txt) {
    return (txt || "")
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss');
}

function _hasWordToken(text, token) {
    const t = String(text || '');
    const w = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t);
}

function classifyPOITitleCategory(title) {
    const t = normalizeMissionText(title);
    if (t.includes("bruecke") || t.includes("brucke") || t.includes("bridge") || t.includes("viadukt") || t.includes("aquadukt") || t.includes("steg") || t.includes("pont") || t.includes("puente")) return "bridge";
    if (t.includes("autobahn") || t.includes("kreuz") || t.includes("dreieck") || t.includes("kreuzung") || t.includes("strasse") || t.includes("highway") || t.includes("motorway") || t.includes("interstate") || t.includes("freeway") || t.includes("ring") || t.includes("junction") || t.includes("interchange") || t.includes("tunnel") || t.includes("bahn") || t.includes("rail") || t.includes("railway") || t.includes("gleis") || t.includes("bahnhof")) return "road";
    if (
        _hasWordToken(t, "staudamm") ||
        _hasWordToken(t, "talsperre") ||
        _hasWordToken(t, "stausee") ||
        _hasWordToken(t, "sperrmauer") ||
        _hasWordToken(t, "reservoir") ||
        _hasWordToken(t, "damm") ||
        _hasWordToken(t, "dam") ||
        _hasWordToken(t, "wehr")
    ) return "dam";
    if (t.includes("funkturm") || t.includes("fernsehturm") || t.includes("sendemast") || t.includes("funkmast") || t.includes("mast")) return "telecom";
    if (t.includes("industrie") || t.includes("werk") || t.includes("fabrik") || t.includes("kraftwerk") || t.includes("anlage") || t.includes("mine") || t.includes("tagebau")) return "industry";
    if (
        _hasWordToken(t, "burg") ||
        _hasWordToken(t, "schloss") ||
        _hasWordToken(t, "ruine") ||
        _hasWordToken(t, "festung") ||
        _hasWordToken(t, "kloster") ||
        _hasWordToken(t, "dom") ||
        _hasWordToken(t, "monument") ||
        _hasWordToken(t, "denkmal")
    ) return "castle";
    if (t.includes("fluss") || t.includes("strom") || t.includes("kanal") || t.includes("see") || t.includes("talsperre") || t.includes("teich") || t.includes("insel") || t.includes("weiher") || t.includes("kueste") || t.includes("hafen") || t.includes("river") || t.includes("lake") || t.includes("bay") || t.includes("fjord") || t.includes("meer") || t.includes("rhein") || t.includes("donau") || t.includes("elbe") || t.includes("isar") || t.includes("neckar")) return "water";
    if (
        _hasWordToken(t, "berg") ||
        _hasWordToken(t, "spitze") ||
        _hasWordToken(t, "horn") ||
        _hasWordToken(t, "gipfel") ||
        _hasWordToken(t, "kogel") ||
        _hasWordToken(t, "wald") ||
        _hasWordToken(t, "tal") ||
        _hasWordToken(t, "schlucht") ||
        _hasWordToken(t, "alpen") ||
        _hasWordToken(t, "pass")
    ) return "mountain";
    if (t.includes("stadt") || t.includes("turm") || t.includes("park") || t.includes("stadion") || t.includes("arena") || t.includes("zentrum") || t.includes("city")) return "city";
    return "generic";
}

function _isRemoteSettlementPOITitle(title) {
    const t = normalizeMissionText(title);
    const remoteHints = [
        'hof', 'weiler', 'huette', 'huetten', 'hutte', 'huette', 'alm', 'alpe', 'alp',
        'forsthaus', 'jagdhaus', 'ranch', 'cabin', 'lodge', 'farm', 'hamlet'
    ];
    const urbanHints = [
        'stadt', 'city', 'zentrum', 'bahnhof', 'arena', 'stadion', 'industrie', 'fabrik',
        'gewerbe', 'hafen', 'flugplatz', 'airport'
    ];
    if (urbanHints.some(k => t.includes(k))) return false;
    return remoteHints.some(k => _hasWordToken(t, k) || t.includes(k));
}

function _looksLikePersonForstName(title) {
    const raw = String(title || '').trim();
    const t = normalizeMissionText(raw);
    if (!_hasWordToken(t, 'forst')) return false;
    if (/\bgeb\.?\b/i.test(raw)) return true;
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 4) return false;
    if (normalizeMissionText(parts[parts.length - 1]) !== 'forst') return false;
    const firstNames = new Set([
        'anna', 'bella', 'else', 'erich', 'eva', 'friedrich', 'georg', 'hans', 'heinrich',
        'josef', 'joseph', 'karl', 'maria', 'paul', 'peter', 'wilhelm'
    ]);
    return parts.some(part => firstNames.has(normalizeMissionText(part)));
}

function isFirePOITitle(title) {
    const cat = classifyPOITitleCategory(title);
    if (cat === 'mountain') return true;
    const t = normalizeMissionText(title);
    if (_looksLikePersonForstName(title)) return false;
    if (t.includes('wald') || t.includes('forst') || t.includes('heide') || t.includes('moor')) return true;
    return _isRemoteSettlementPOITitle(title);
}

function scoreFirePOITitle(title) {
    const t = normalizeMissionText(title);
    const cat = classifyPOITitleCategory(title);
    let score = 0;
    if (_looksLikePersonForstName(title)) score -= 10;
    if (cat === 'mountain') score += 4;
    if (t.includes('wald') || t.includes('forst')) score += 3;
    if (t.includes('berg') || t.includes('tal') || t.includes('schlucht')) score += 2;
    if (_isRemoteSettlementPOITitle(title)) score += 1;
    if (cat === 'city' || cat === 'castle') score -= 3;
    return score;
}

function _isInfrastructurePOITitle(title) {
    const t = normalizeMissionText(title);
    const byCategory = classifyPOITitleCategory(title);
    if (byCategory === 'road' || byCategory === 'telecom' || byCategory === 'industry' || byCategory === 'bridge') return true;
    return (
        _hasWordToken(t, 'bahn') ||
        _hasWordToken(t, 'bahnhof') ||
        _hasWordToken(t, 'gleis') ||
        _hasWordToken(t, 'schiene') ||
        _hasWordToken(t, 'rail') ||
        _hasWordToken(t, 'railway') ||
        _hasWordToken(t, 'strom') ||
        _hasWordToken(t, 'hochspannung') ||
        _hasWordToken(t, 'freileitung') ||
        _hasWordToken(t, 'umspannwerk') ||
        _hasWordToken(t, 'kraftwerk')
    );
}

function poiTitleMatchesCategory(title, category) {
    const wanted = String(category || '').toLowerCase();
    if (!wanted || wanted === 'all') return true;
    if (wanted === 'fire') return isFirePOITitle(title);
    if (wanted === 'infrastructure') return _isInfrastructurePOITitle(title);
    return classifyPOITitleCategory(title) === wanted;
}

function pickBalancedByCategory(items, categoryOf, storagePrefix) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const countsKey = `${storagePrefix}_counts`;
    const lastKey = `${storagePrefix}_last`;
    const counts = JSON.parse(localStorage.getItem(countsKey) || '{}');
    const lastCat = localStorage.getItem(lastKey) || '';

    const categories = [...new Set(items.map(categoryOf))];
    const minCount = Math.min(...categories.map(cat => parseInt(counts[cat] || 0, 10)));
    let candidateCats = categories.filter(cat => parseInt(counts[cat] || 0, 10) === minCount);
    if (candidateCats.length > 1 && candidateCats.includes(lastCat)) {
        candidateCats = candidateCats.filter(cat => cat !== lastCat);
    }
    const selectedCat = candidateCats[Math.floor(Math.random() * candidateCats.length)] || categories[0];
    const pool = items.filter(item => categoryOf(item) === selectedCat);
    const picked = pool[Math.floor(Math.random() * pool.length)] || items[0];

    counts[selectedCat] = parseInt(counts[selectedCat] || 0, 10) + 1;
    localStorage.setItem(countsKey, JSON.stringify(counts));
    localStorage.setItem(lastKey, selectedCat);
    return { item: picked, category: selectedCat };
}

function _poiAnchorBucketKey(anchor = null) {
    if (!anchor || !Number.isFinite(Number(anchor.lat)) || !Number.isFinite(Number(anchor.lon))) return 'global';
    // Coarse bucket to keep local rotation stable inside nearby anchors.
    const qLat = Math.round(Number(anchor.lat) * 10) / 10;
    const qLon = Math.round(Number(anchor.lon) * 10) / 10;
    return `${qLat.toFixed(1)}|${qLon.toFixed(1)}`;
}

function _poiCandidateKindTag(p = null) {
    const n = normalizeMissionText(String(p?.n || ''));
    const layer = String(p?.featureLayer || '').toLowerCase();
    const source = String(p?.featureSourceKind || '').toLowerCase();
    if (layer === 'rail' || n.includes('bahn') || n.includes('rail') || n.includes('gleis')) return `rail:${source}`;
    if (layer === 'road' || n.includes('autobahn') || n.includes('strasse') || n.includes('highway')) return `road:${source}`;
    if (n.includes('mast') || n.includes('tower') || n.includes('funkturm') || n.includes('wind')) return `tower:${source}`;
    if (n.includes('umspannwerk') || n.includes('kraftwerk') || n.includes('werk')) return `power:${source}`;
    if (layer === 'hydro' || n.includes('fluss') || n.includes('river') || n.includes('kanal')) return `water:${source}`;
    return `${layer || 'poi'}:${source}`;
}

function _poiCandidateClusterTag(p = null) {
    const raw = String(p?.n || '').trim();
    const n = normalizeMissionText(raw);
    const layer = String(p?.featureLayer || '').toLowerCase();
    const source = String(p?.featureSourceKind || '').toLowerCase();
    let base = n
        .replace(/\banlage\s*\d+\b/g, 'anlage')
        .replace(/\b(mast|tower|pole)\s*#?\s*\d+\b/g, '$1')
        .replace(/\b(leitung|trasse)\s*#?\s*\d+\b/g, '$1')
        .replace(/\bsegment\s*#?\s*\d+\b/g, 'segment')
        .replace(/\s+/g, ' ')
        .trim();
    if (!base) {
        const qLat = (Math.round(Number(p?.lat || 0) * 20) / 20).toFixed(2);
        const qLon = (Math.round(Number(p?.lon || 0) * 20) / 20).toFixed(2);
        base = `${layer || 'poi'}@${qLat}|${qLon}`;
    }
    return `${base}|${layer || 'poi'}|${source}`;
}

function _poiLimitPerCluster(pool = [], maxPerCluster = 2) {
    const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
    const cap = Math.max(1, Number(maxPerCluster || 2));
    const out = [];
    const counts = new Map();
    for (const p of src) {
        const ck = _poiCandidateClusterTag(p);
        const used = Number(counts.get(ck) || 0);
        if (used >= cap) continue;
        counts.set(ck, used + 1);
        out.push(p);
    }
    return out.length ? out : src;
}

function _pickPoiCandidateWithHistory(pool = [], category = 'generic', topN = 8, anchor = null) {
    const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
    if (!src.length) return null;
    const candidates = src.slice(0, Math.max(1, Number(topN || 8)));
    const cat = String(category || 'generic').toLowerCase();
    const anchorBucket = _poiAnchorBucketKey(anchor);
    const historyKey = `ga_poi_target_history_${cat}`;
    const localHistoryKey = `ga_poi_target_history_${cat}_${anchorBucket}`;
    const localKindKey = `ga_poi_target_last_kind_${cat}_${anchorBucket}`;
    const localClusterKey = `ga_poi_target_last_cluster_${cat}_${anchorBucket}`;
    let history = [];
    let localHistory = [];
    try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch (_) { history = []; }
    try { localHistory = JSON.parse(localStorage.getItem(localHistoryKey) || '[]'); } catch (_) { localHistory = []; }
    if (!Array.isArray(history)) history = [];
    if (!Array.isArray(localHistory)) localHistory = [];
    const lastKind = String(localStorage.getItem(localKindKey) || '');
    const lastCluster = String(localStorage.getItem(localClusterKey) || '');
    const clusterSensitive = (cat === 'infrastructure' || cat === 'telecom');

    const sigOf = (p) => `${String(p?.n || '').toLowerCase()}|${Number(p?.lat || 0).toFixed(4)}|${Number(p?.lon || 0).toFixed(4)}`;
    const bestRank = Number(candidates[0]?.rank || 0);
    const scoreBand = candidates.filter(p => Number(p?.rank || -9999) >= (bestRank - 2.2));
    const scorePool = scoreBand.length ? scoreBand : candidates;
    let fresh = scorePool.filter(p => !localHistory.includes(sigOf(p)));
    if (!fresh.length) fresh = scorePool.filter(p => !history.includes(sigOf(p)));
    if (!fresh.length) {
        fresh = scorePool;
        history = [];
        localHistory = [];
    }
    let diversified = fresh;
    if (lastKind) {
        const altKind = fresh.filter(p => _poiCandidateKindTag(p) !== lastKind);
        if (altKind.length) diversified = altKind;
    }
    if (clusterSensitive && lastCluster) {
        const altCluster = diversified.filter(p => _poiCandidateClusterTag(p) !== lastCluster);
        if (altCluster.length) diversified = altCluster;
    }
    const pick = diversified[Math.floor(Math.random() * diversified.length)] || scorePool[0] || candidates[0];
    const sig = sigOf(pick);
    const kind = _poiCandidateKindTag(pick);
    const cluster = _poiCandidateClusterTag(pick);
    history.push(sig);
    localHistory.push(sig);
    if (history.length > 24) history.shift();
    if (localHistory.length > 12) localHistory.shift();
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch (_) {}
    try { localStorage.setItem(localHistoryKey, JSON.stringify(localHistory)); } catch (_) {}
    try { localStorage.setItem(localKindKey, kind); } catch (_) {}
    try { localStorage.setItem(localClusterKey, cluster); } catch (_) {}
    return pick;
}

function _nmToLatDeg(nm) {
    return Number(nm || 0) / 60;
}

function _nmToLonDeg(nm, latDeg) {
    const c = Math.max(0.2, Math.cos((Number(latDeg || 0) * Math.PI) / 180));
    return Number(nm || 0) / (60 * c);
}

function _buildViewBoxAround(lat, lon, radiusNm) {
    const dLat = _nmToLatDeg(radiusNm);
    const dLon = _nmToLonDeg(radiusNm, lat);
    return {
        west: Number(lon) - dLon,
        east: Number(lon) + dLon,
        south: Number(lat) - dLat,
        north: Number(lat) + dLat
    };
}

const POI_TILE_EDGE_NM = 25;
const POI_TILE_STEP_LAT = POI_TILE_EDGE_NM / 60;
const POI_TILE_STEP_LON = POI_TILE_EDGE_NM / 60;
const POI_TILE_FETCH_PARALLEL = 4;
const POI_TILE_MAX_KEYS = 36;
const POI_TILE_CACHE_TTL_MS = 30 * 60 * 1000;
// Default ON: split-worker als Standardquelle nutzen, außer explizit deaktiviert.
const POI_TILE_WORKER_ENABLED = localStorage.getItem('ga_poi_worker_split_enabled') !== 'false';
const POI_TILE_POI_ENDPOINTS = [
    './obstacles/poi-tiles/{latI}/{lonI}.json',
    './obstacles/poi-tiles/{latI}/{lonI}.json.gz'
];
const POI_TILE_CORE_ENDPOINTS = [
    './obstacles/core-tiles/{latI}/{lonI}.json',
    './obstacles/core-tiles/{latI}/{lonI}.json.gz'
];
if (POI_TILE_WORKER_ENABLED) {
    POI_TILE_POI_ENDPOINTS.push('https://ga-proxy.einherjer.workers.dev/api/obstacles/tile');
    POI_TILE_CORE_ENDPOINTS.push('https://ga-proxy.einherjer.workers.dev/api/obstacles/tile');
}
const POI_TILE_LEGACY_ENDPOINTS = [
    'https://ga-proxy.einherjer.workers.dev/api/obstacles/tile'
];
const _poiTileMemCache = new Map();

function _poiDebugState() {
    if (!window.gaPoiTileDebug || typeof window.gaPoiTileDebug !== 'object') {
        window.gaPoiTileDebug = {
            requests: 0,
            hits: 0,
            cacheHits: 0,
            splitHits: 0,
            legacyHits: 0,
            fallbackHits: 0,
            misses: 0,
            errors: 0,
            lastSource: '',
            localPoiSplitHits: 0,
            localCoreSplitHits: 0,
            workerPoiSplitHits: 0,
            workerCoreSplitHits: 0,
            cacheMissSources: 0
        };
    }
    window.gaPoiTileDebug.cacheEntries = _poiTileMemCache.size;
    return window.gaPoiTileDebug;
}

function _poiDebugMarkSource(src = '') {
    const dbg = _poiDebugState();
    dbg.lastSource = String(src || '');
}

function _poiDebugBumpSourceCounter(src = '') {
    const dbg = _poiDebugState();
    const s = String(src || '').toLowerCase();
    if (s === 'local-poi-split') dbg.localPoiSplitHits = Number(dbg.localPoiSplitHits || 0) + 1;
    else if (s === 'local-core-split') dbg.localCoreSplitHits = Number(dbg.localCoreSplitHits || 0) + 1;
    else if (s === 'worker-poi-split') dbg.workerPoiSplitHits = Number(dbg.workerPoiSplitHits || 0) + 1;
    else if (s === 'worker-core-split') dbg.workerCoreSplitHits = Number(dbg.workerCoreSplitHits || 0) + 1;
    else if (s === 'split-only-miss') dbg.cacheMissSources = Number(dbg.cacheMissSources || 0) + 1;
}

function _poiTrackTileCoverage(tileKey, src = 'poi-unknown') {
    try {
        const cfg = (window.vpObsTileConfig && typeof window.vpObsTileConfig === 'object') ? window.vpObsTileConfig : null;
        const storageKey = String(cfg?.storageKey || 'ga_obs_tile_cov_v1');
        const now = Date.now();
        let list = [];
        try {
            const raw = localStorage.getItem(storageKey);
            const parsed = JSON.parse(raw || '[]');
            list = Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            list = [];
        }
        const idx = list.findIndex(e => e && e.k === tileKey);
        const next = {
            k: tileKey,
            ts: now,
            usedTs: now,
            src: String(src || 'poi-unknown')
        };
        if (idx >= 0) list[idx] = { ...(list[idx] || {}), ...next };
        else list.push(next);
        if (list.length > 2200) list = list.slice(list.length - 2200);
        localStorage.setItem(storageKey, JSON.stringify(list));
        if (typeof window.vpNotifyObsTileCoverageChanged === 'function') window.vpNotifyObsTileCoverageChanged();
    } catch (_) {}
}

function _poiTileKey(lat, lon) {
    const latI = Math.floor((Number(lat) + 90) / POI_TILE_STEP_LAT);
    const lonI = Math.floor((Number(lon) + 180) / POI_TILE_STEP_LON);
    return `${latI}|${lonI}`;
}

function _poiTileBoundsFromKey(key) {
    const [latI, lonI] = String(key || '').split('|').map(Number);
    if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
    const south = (latI * POI_TILE_STEP_LAT) - 90;
    const west = (lonI * POI_TILE_STEP_LON) - 180;
    return {
        latI,
        lonI,
        south,
        west,
        north: south + POI_TILE_STEP_LAT,
        east: west + POI_TILE_STEP_LON
    };
}

function _poiCollectTileKeysAround(lat, lon, radiusNm) {
    const out = [];
    const center = _poiTileKey(lat, lon);
    const [cLatI, cLonI] = center.split('|').map(Number);
    const span = Math.max(1, Math.ceil(Number(radiusNm || 25) / POI_TILE_EDGE_NM) + 1);
    for (let dy = -span; dy <= span; dy++) {
        for (let dx = -span; dx <= span; dx++) {
            out.push(`${cLatI + dy}|${cLonI + dx}`);
        }
    }
    return out.slice(0, POI_TILE_MAX_KEYS);
}

function _poiNormalizeFeatureName(raw, fallbackCategory = 'poi') {
    const n = String(raw || '').trim();
    if (n) return n;
    const c = String(fallbackCategory || 'poi').toLowerCase();
    if (c === 'dam') return 'Staudamm/Talsperre';
    if (c === 'water') return 'Gewässer';
    if (c === 'telecom') return 'Funkmast/Funkturm/Windrad';
    if (c === 'road') return 'Straßen-/Verkehrsknoten';
    if (c === 'mountain') return 'Berg-/Talgebiet';
    if (c === 'castle') return 'Burg/Schloss';
    if (c === 'industry') return 'Industrieanlage';
    if (c === 'city') return 'Stadtgebiet';
    if (c === 'bridge') return 'Brücke/Viadukt';
    if (c === 'infrastructure') return 'Infrastrukturkorridor';
    return 'POI';
}

function _poiIsGenericFallbackName(name) {
    const n = normalizeMissionText(name || '');
    return (
        n === 'poi' ||
        n === 'zielgebiet' ||
        n === 'staudamm talsperre' ||
        n === 'gewasser' ||
        n === 'gewaesser' ||
        n === 'berg talgebiet' ||
        n === 'funkmast funkturm windrad' ||
        n === 'industrieanlage' ||
        n === 'strassen verkehrsknoten' ||
        n === 'infrastrukturkorridor' ||
        n === 'stadtgebiet' ||
        n === 'burg schloss'
    );
}

function _poiIsSettlementOnlyFeature(feature) {
    const t = feature?.tags || {};
    const name = String(feature?.name || '').trim();
    const placeKind = String(t.place || '').toLowerCase();
    const isPlacePoint = ['city', 'town', 'village', 'suburb', 'hamlet', 'locality', 'neighbourhood', 'quarter'].includes(placeKind);
    if (!isPlacePoint) return false;
    const hasInfraTags = (
        !!t.highway ||
        !!t.railway ||
        ['line', 'minor_line', 'cable', 'tower', 'pole', 'substation', 'plant', 'generator', 'transformer'].includes(String(t.power || '').toLowerCase()) ||
        ['bridge', 'tower', 'mast'].includes(String(t.man_made || '').toLowerCase()) ||
        ['dam', 'weir'].includes(String(t.waterway || '').toLowerCase()) ||
        ['road', 'rail', 'power', 'hydro'].includes(String(t.layer || '').toLowerCase())
    );
    if (hasInfraTags) return false;
    // Extra Guard: City-like names without infra tags should not satisfy road/infra selection.
    return classifyPOITitleCategory(name) === 'city';
}

function _poiIsHumanMemorialFeature(feature) {
    const t = feature?.tags || {};
    const historic = String(t.historic || '').toLowerCase();
    const tourism = String(t.tourism || '').toLowerCase();
    const amenity = String(t.amenity || '').toLowerCase();
    const natural = String(t.natural || '').toLowerCase();
    const landuse = String(t.landuse || '').toLowerCase();
    const hasNatureSurface = ['wood', 'heath', 'water'].includes(natural) || ['forest', 'meadow', 'grassland', 'farmland', 'orchard', 'vineyard'].includes(landuse);
    if (hasNatureSurface) return false;
    if (historic === 'memorial' || historic === 'monument') return true;
    if (tourism === 'artwork' || amenity === 'grave_yard') return true;
    return _looksLikePersonForstName(feature?.name || '');
}

function _poiIsNumericLikeName(name) {
    const s = String(name || '').trim();
    if (!s) return false;
    const compact = s.replace(/\s+/g, '');
    return /^[0-9]+([a-z])?$/i.test(compact);
}

function _poiIsCodeLikeName(name) {
    const s = String(name || '').trim();
    if (!s) return false;
    // kurze technische IDs wie "M 401", "5200/30", "P259", "26 W6"
    if (/^[A-Z]?\s*\d{1,5}(?:[\/.-]\d{1,5})?$/i.test(s)) return true;
    if (/^\d{1,4}\s*[A-Z]\d{0,3}$/i.test(s)) return true;
    if (/^[A-Z]{1,3}\s*\d{1,4}$/i.test(s)) return true;
    return false;
}

function _poiLooksJunctionLabel(name) {
    const s = String(name || '').trim();
    if (!s) return false;
    if (s.includes(' / ')) return true;
    if (/^\s*[A-ZÄÖÜ][a-zäöüß.-]+\s*\/\s*[A-ZÄÖÜ][a-zäöüß.-]+\s*$/i.test(s)) return true;
    return false;
}

function _poiFeatureFromTileNode(node, src = 'tile') {
    const lat = Number(node?.lat);
    const lon = Number(node?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat,
        lon,
        name: String(node?.name || node?.n || '').trim(),
        sourceKind: String(node?.sourceKind || src),
        fetchSource: String(node?.fetchSource || ''),
        rawType: String(node?.type || '').toLowerCase(),
        tags: {
            layer: String(node?.layer || '').toLowerCase(),
            highway: String(node?.highway || '').toLowerCase(),
            waterway: String(node?.waterway || '').toLowerCase(),
            water: String(node?.water || '').toLowerCase(),
            natural: String(node?.natural || '').toLowerCase(),
            landuse: String(node?.landuse || '').toLowerCase(),
            power: String(node?.power || '').toLowerCase(),
            railway: String(node?.railway || '').toLowerCase(),
            man_made: String(node?.man_made || '').toLowerCase(),
            tourism: String(node?.tourism || '').toLowerCase(),
            historic: String(node?.historic || '').toLowerCase(),
            amenity: String(node?.amenity || '').toLowerCase(),
            leisure: String(node?.leisure || '').toLowerCase(),
            place: String(node?.place || '').toLowerCase(),
            obstacle_type: String(node?.obstacle_type || node?.type || '').toLowerCase()
        }
    };
}

function _poiParseTilePayload(payload) {
    const out = [];
    if (!payload || typeof payload !== 'object') return out;
    const coreObj = (payload.core && typeof payload.core === 'object') ? payload.core : null;
    const poiObj = (payload.poi && typeof payload.poi === 'object' && Array.isArray(payload.poi.poi))
        ? payload.poi
        : null;
    const obs = Array.isArray(payload.obs) ? payload.obs : (Array.isArray(coreObj?.obs) ? coreObj.obs : []);
    const lin = Array.isArray(payload.lin) ? payload.lin : (Array.isArray(coreObj?.lin) ? coreObj.lin : []);
    const poi = Array.isArray(payload.poi) ? payload.poi : (Array.isArray(poiObj?.poi) ? poiObj.poi : []);

    for (const e of obs) {
        const f = _poiFeatureFromTileNode({
            ...e,
            sourceKind: 'obs',
            layer: 'obs',
            man_made: (String(e?.type || '').toLowerCase().includes('mast') || String(e?.type || '').toLowerCase().includes('tower')) ? 'tower' : '',
            power: String(e?.type || '').toLowerCase().includes('power') ? 'tower' : ''
        }, 'obs');
        if (f) out.push(f);
    }
    for (const e of lin) {
        const legacyType = String(e?.type || '').toLowerCase();
        const isRoadLike = ['highway', 'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'service'].includes(legacyType);
        const isHydroLike = ['river', 'stream', 'canal', 'ditch', 'drain', 'water', 'lake', 'reservoir', 'dam', 'weir'].includes(legacyType);
        const isRailLike = ['railway', 'rail', 'tram', 'light_rail', 'subway'].includes(legacyType);
        const isPowerLike = ['power', 'powerline', 'power_line', 'line', 'minor_line', 'cable'].includes(legacyType);
        const layer = String(e?.layer || '').toLowerCase() || (
            isRoadLike ? 'road' :
            isHydroLike ? 'hydro' :
            isRailLike ? 'rail' :
            isPowerLike ? 'power' : ''
        );
        const f = _poiFeatureFromTileNode({
            ...e,
            sourceKind: 'lin',
            layer,
            highway: isRoadLike ? (String(e?.highway || '').toLowerCase() || legacyType) : String(e?.highway || '').toLowerCase(),
            waterway: isHydroLike
                ? (String(e?.waterway || '').toLowerCase() || (['dam', 'weir'].includes(legacyType) ? legacyType : (['river', 'stream', 'canal', 'ditch', 'drain'].includes(legacyType) ? legacyType : '')))
                : String(e?.waterway || '').toLowerCase(),
            water: isHydroLike
                ? (String(e?.water || '').toLowerCase() || (['lake', 'reservoir'].includes(legacyType) ? legacyType : ''))
                : String(e?.water || '').toLowerCase(),
            natural: isHydroLike
                ? (String(e?.natural || '').toLowerCase() || (['water', 'lake', 'reservoir'].includes(legacyType) ? 'water' : ''))
                : String(e?.natural || '').toLowerCase(),
            power: isPowerLike
                ? (String(e?.power || '').toLowerCase() || (legacyType === 'power' ? 'line' : legacyType))
                : String(e?.power || '').toLowerCase(),
            railway: isRailLike ? (String(e?.railway || '').toLowerCase() || legacyType) : String(e?.railway || '').toLowerCase(),
            man_made: (legacyType === 'bridge')
                ? (String(e?.man_made || '').toLowerCase() || 'bridge')
                : String(e?.man_made || '').toLowerCase()
        }, 'lin');
        if (f) out.push(f);
    }
    for (const e of poi) {
        const f = _poiFeatureFromTileNode({ ...e, sourceKind: 'poi', layer: 'poi' }, 'poi');
        if (f) out.push(f);
    }
    return out;
}

async function _poiReadTilePayload(url, res) {
    const isGz = String(url || '').toLowerCase().endsWith('.gz');
    if (!isGz) return await res.json();

    // Manche Hosts liefern *.json.gz ohne Content-Encoding-Header.
    // In dem Fall den Body explizit entpacken.
    const enc = String(res.headers.get('content-encoding') || '').toLowerCase();
    if (enc.includes('gzip')) return await res.json();

    if (typeof DecompressionStream !== 'undefined' && res.body) {
        const ds = new DecompressionStream('gzip');
        return await new Response(res.body.pipeThrough(ds)).json();
    }

    // Fallback (falls Browser kein DecompressionStream hat): normal versuchen.
    return await res.json();
}

function _poiFeatureMatchesCategory(feature, category) {
    const cat = String(category || '').toLowerCase();
    if (!cat || cat === 'all') return true;
    const t = feature?.tags || {};
    const rawType = String(feature?.rawType || '').toLowerCase();
    const n = normalizeMissionText(feature?.name || '');

    const isWater = (
        ['river', 'stream', 'canal', 'dam', 'weir'].includes(t.waterway) ||
        t.natural === 'water' ||
        ['lake', 'reservoir', 'pond', 'basin'].includes(t.water) ||
        ['reservoir', 'basin'].includes(t.landuse) ||
        t.layer === 'hydro'
    );
    const damNameStrong = (
        _hasWordToken(n, 'talsperre') ||
        _hasWordToken(n, 'staudamm') ||
        _hasWordToken(n, 'stausee') ||
        _hasWordToken(n, 'sperrmauer') ||
        _hasWordToken(n, 'reservoir')
    );
    const isDam = (
        ['dam', 'weir'].includes(t.waterway) ||
        ['reservoir', 'basin'].includes(t.landuse) ||
        t.water === 'reservoir' ||
        (damNameStrong && !t.highway)
    );
    const isRoad = (
        !!t.highway ||
        t.layer === 'road' ||
        rawType === 'highway'
    );
    const isSettlementOnly = _poiIsSettlementOnlyFeature(feature);
    const isRail = (
        !!t.railway ||
        t.layer === 'rail' ||
        rawType === 'railway' ||
        _hasWordToken(n, 'bahn') ||
        _hasWordToken(n, 'bahnhof') ||
        _hasWordToken(n, 'gleis') ||
        _hasWordToken(n, 'schiene') ||
        _hasWordToken(n, 'rail') ||
        _hasWordToken(n, 'railway')
    );
    const isTransportCorridor = (
        isRoad ||
        isRail ||
        ['line', 'minor_line', 'cable'].includes(t.power) ||
        t.layer === 'road' ||
        t.layer === 'rail'
    );
    const isHumanMemorial = _poiIsHumanMemorialFeature(feature);
    const isTelecom = (
        !(
            t.highway === 'speed_camera' ||
            t.amenity === 'speed_camera' ||
            t.man_made === 'surveillance' ||
            ['signal', 'switch', 'level_crossing'].includes(t.railway)
        ) && (
        ['tower', 'mast'].includes(t.man_made) ||
        ['tower', 'pole'].includes(t.power) ||
        t.obstacle_type.includes('wind') ||
        rawType.includes('mast') ||
        rawType.includes('tower') ||
        rawType.includes('wind') ||
        _hasWordToken(n, 'windrad') ||
        _hasWordToken(n, 'windkraft') ||
        _hasWordToken(n, 'windturbine')
        )
    );
    const isBridge = (
        t.man_made === 'bridge' ||
        _hasWordToken(n, 'bruecke') ||
        _hasWordToken(n, 'brucke') ||
        _hasWordToken(n, 'bridge') ||
        _hasWordToken(n, 'viadukt')
    );
    const isMountain = (
        ['peak', 'valley', 'cliff', 'ridge', 'saddle'].includes(t.natural) ||
        (
            !isTransportCorridor && (
                _hasWordToken(n, 'berg') ||
                _hasWordToken(n, 'gipfel') ||
                _hasWordToken(n, 'tal') ||
                _hasWordToken(n, 'schlucht')
            )
        )
    );
    const isCastle = (
        ['castle', 'ruins', 'fort', 'monument'].includes(t.historic) ||
        (!isTransportCorridor && t.tourism === 'attraction' && (_hasWordToken(n, 'burg') || _hasWordToken(n, 'schloss'))) ||
        (!isTransportCorridor && (_hasWordToken(n, 'burg') || _hasWordToken(n, 'schloss')))
    );
    const isCity = ['city', 'town', 'village', 'suburb'].includes(t.place);
    const isIndustry = (
        ['industrial', 'quarry', 'brownfield', 'landfill'].includes(t.landuse) ||
        ['substation', 'plant', 'generator', 'transformer'].includes(t.power) ||
        ['water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo', 'chimney'].includes(t.man_made) ||
        ['wastewater_plant', 'waste_transfer_station', 'water_works'].includes(t.amenity) ||
        _hasWordToken(n, 'umspannwerk') ||
        _hasWordToken(n, 'wasserwerk') ||
        _hasWordToken(n, 'klaerwerk') ||
        _hasWordToken(n, 'klärwerk') ||
        _hasWordToken(n, 'kraftwerk') ||
        _hasWordToken(n, 'heizkraftwerk') ||
        _hasWordToken(n, 'industrie') ||
        _hasWordToken(n, 'werk') ||
        _hasWordToken(n, 'fabrik') ||
        _hasWordToken(n, 'anlage')
    );
    const isInfrastructure = (
        isRoad ||
        isRail ||
        isTelecom ||
        isIndustry ||
        isBridge ||
        ['line', 'minor_line', 'cable'].includes(t.power) ||
        _hasWordToken(n, 'strom') ||
        _hasWordToken(n, 'hochspannung') ||
        _hasWordToken(n, 'freileitung')
    );
    const isFire = (
        !isHumanMemorial && (
            isMountain ||
            (!isTransportCorridor && (_hasWordToken(n, 'wald') || _hasWordToken(n, 'forst'))) ||
            t.natural === 'wood' ||
            t.natural === 'heath'
        )
    );

    if (cat === 'water') return isWater;
    if (cat === 'dam') return isDam;
    if (cat === 'road') return isRoad && !isSettlementOnly;
    if (cat === 'rail') return isRail;
    if (cat === 'telecom') return isTelecom;
    if (cat === 'bridge') return isBridge;
    if (cat === 'mountain') return isMountain;
    if (cat === 'castle') return isCastle;
    if (cat === 'city') return isCity;
    if (cat === 'industry') return isIndustry;
    if (cat === 'infrastructure') return isInfrastructure && !isSettlementOnly;
    if (cat === 'sar_corridor') return (isRoad || isRail || isBridge || isWater || isInfrastructure);
    if (cat === 'fire') return isFire;
    return false;
}

function _poiInferCategoryFromFeature(feature) {
    const t = feature?.tags || {};
    const placeKind = String(t.place || '').toLowerCase();
    const placeOnly = (
        ['city', 'town', 'village', 'suburb', 'hamlet', 'locality', 'neighbourhood', 'quarter'].includes(placeKind) &&
        !t.highway &&
        !t.railway &&
        !t.waterway &&
        !t.water &&
        t.natural !== 'water' &&
        !['reservoir', 'basin'].includes(String(t.landuse || '').toLowerCase()) &&
        !t.power &&
        !t.man_made
    );
    if (placeOnly) return 'city';
    if (_poiIsSettlementOnlyFeature(feature)) return 'city';
    const order = ['dam', 'water', 'telecom', 'bridge', 'road', 'castle', 'mountain', 'industry', 'city', 'infrastructure', 'fire'];
    for (const cat of order) {
        if (_poiFeatureMatchesCategory(feature, cat)) return cat;
    }
    return classifyPOITitleCategory(feature?.name || '');
}

function _poiFeatureScore(feature, category) {
    const cat = String(category || 'all').toLowerCase();
    const t = feature?.tags || {};
    const n = normalizeMissionText(feature?.name || '');
    let score = 0;
    if (cat === 'dam') {
        if (['dam', 'weir'].includes(t.waterway)) score += 8;
        if (t.water === 'reservoir') score += 6;
        if (['reservoir', 'basin'].includes(t.landuse)) score += 5;
        if (_hasWordToken(n, 'talsperre') || _hasWordToken(n, 'staudamm') || _hasWordToken(n, 'stausee') || _hasWordToken(n, 'sperrmauer') || _hasWordToken(n, 'reservoir')) score += 8;
    } else if (cat === 'water') {
        if (['dam', 'weir'].includes(t.waterway)) score += 8;
        if (['lake', 'reservoir', 'pond'].includes(t.water)) score += 9;
        if (['reservoir', 'basin'].includes(t.landuse)) score += 6;
        if (t.natural === 'water') score += 7;
        if (['river', 'stream', 'canal'].includes(t.waterway)) score += 4;
        if (_hasWordToken(n, 'see') || _hasWordToken(n, 'weiher') || _hasWordToken(n, 'teich') || _hasWordToken(n, 'talsperre') || _hasWordToken(n, 'stausee')) score += 6;
        if (_hasWordToken(n, 'karsee') || _hasWordToken(n, 'stausee') || _hasWordToken(n, 'talsperre')) score += 4;
        if (['fire_water_pond', 'suction_point'].includes(String(t.water || '').toLowerCase())) score -= 7;
        if (_hasWordToken(n, 'loeschwasser') || _hasWordToken(n, 'löschwasser')) score -= 5;
        if (!n && t.water === 'pond') score -= 3;
        if (!n && ['reservoir', 'basin'].includes(t.landuse)) score -= 2;
    } else if (cat === 'road') {
        const major = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'];
        if (major.includes(t.highway)) score += 6;
        if (t.highway) score += 2;
        if (t.highway === 'motorway_junction') score -= 5;
        if (_hasWordToken(n, 'stadt') || _hasWordToken(n, 'zentrum') || _hasWordToken(n, 'city')) score -= 4;
        if (String(n || '').includes(' / ')) score -= 3;
    } else if (cat === 'rail') {
        const majorRail = ['rail', 'light_rail', 'subway', 'tram'];
        if (majorRail.includes(t.railway)) score += 7;
        if (t.railway) score += 3;
        if (['signal', 'switch', 'level_crossing', 'crossing'].includes(String(t.railway || '').toLowerCase())) score -= 4;
        if (!n && ['signal', 'switch', 'level_crossing', 'crossing'].includes(String(t.railway || '').toLowerCase())) score -= 3;
    } else if (cat === 'telecom') {
        if (['tower', 'mast'].includes(t.man_made)) score += 7;
        if (['tower', 'pole'].includes(t.power)) score += 4;
        if (t.obstacle_type.includes('wind') || String(feature?.rawType || '').toLowerCase().includes('wind')) score += 6;
    } else if (cat === 'infrastructure') {
        const majorRoad = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'];
        const majorRail = ['rail', 'light_rail', 'subway', 'tram'];
        if (majorRoad.includes(t.highway)) score += 6;
        if (t.highway) score += 2;
        if (majorRail.includes(t.railway)) score += 7;
        if (t.railway) score += 3;
        if (['line', 'minor_line', 'cable'].includes(t.power)) score += 5;
        if (['tower', 'pole'].includes(t.power)) score += 4;
        if (['substation', 'plant', 'generator', 'transformer'].includes(t.power)) score += 5;
        if (['tower', 'mast', 'bridge'].includes(t.man_made)) score += 4;
        if (!_hasWordToken(n, 'anlage') && !_hasWordToken(n, 'mast') && !_hasWordToken(n, 'werk') && !_hasWordToken(n, 'umspannwerk') && !_hasWordToken(n, 'bahn') && !_hasWordToken(n, 'leitung') && !_hasWordToken(n, 'trasse')) score -= 2;
    } else if (cat === 'mountain') {
        if (['peak', 'valley', 'cliff', 'ridge'].includes(t.natural)) score += 6;
    } else if (cat === 'castle') {
        if (['castle', 'ruins', 'fort', 'monument'].includes(t.historic)) score += 7;
    } else if (cat === 'industry') {
        if (['industrial', 'quarry', 'brownfield', 'landfill'].includes(t.landuse)) score += 6;
        if (['substation', 'plant', 'generator', 'transformer'].includes(t.power)) score += 8;
        if (['water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo', 'chimney'].includes(t.man_made)) score += 7;
        if (['wastewater_plant', 'waste_transfer_station', 'water_works'].includes(t.amenity)) score += 7;
    } else if (cat === 'fire') {
        if (t.natural === 'wood' || t.landuse === 'forest') score += 10;
        if (['heath', 'scrub'].includes(t.natural)) score += 6;
        if (['peak', 'valley', 'cliff', 'ridge'].includes(t.natural)) score += 5;
        if (_hasWordToken(n, 'wald')) score += 5;
        if (_hasWordToken(n, 'forst')) score += 3;
        if (_poiIsHumanMemorialFeature(feature)) score -= 14;
        if (['city', 'town', 'suburb', 'neighbourhood', 'quarter'].includes(String(t.place || '').toLowerCase())) score -= 6;
    }
    if (n) score += 1;
    if (!n && cat === 'infrastructure') score -= 4;
    if (feature?.sourceKind === 'poi') score += 2;
    if (feature?.sourceKind === 'obs') score -= 1;
    return score;
}

async function _poiFetchTileFeatures(tileKey, options = null) {
    const includeCore = !!(options && options.includeCore);
    const allowLegacyFallback = options && Object.prototype.hasOwnProperty.call(options, 'allowLegacyFallback')
        ? !!options.allowLegacyFallback
        : true;
    const now = Date.now();
    const dbg = _poiDebugState();
    const cacheKey = `${tileKey}|${includeCore ? '1' : '0'}`;
    const cached = _poiTileMemCache.get(cacheKey);
    if (cached && (now - Number(cached.ts || 0)) <= POI_TILE_CACHE_TTL_MS && Array.isArray(cached.features)) {
        dbg.hits = Number(dbg.hits || 0) + 1;
        dbg.cacheHits = Number(dbg.cacheHits || 0) + 1;
        _poiDebugMarkSource(`cache:${String(cached.source || 'unknown')}`);
        return cached.features;
    }
    const b = _poiTileBoundsFromKey(tileKey);
    if (!b) return [];
    let mergedFeatures = [];
    let tileSourceTag = '';
    // 1) Prefer dedicated split POI tiles.
    for (const endpoint of POI_TILE_POI_ENDPOINTS) {
        try {
            let url = '';
            if (endpoint.includes('{latI}') || endpoint.includes('{lonI}')) {
                url = endpoint
                    .replaceAll('{latI}', encodeURIComponent(String(b.latI)))
                    .replaceAll('{lonI}', encodeURIComponent(String(b.lonI)));
            } else {
                const u = new URL(endpoint);
                u.searchParams.set('layer', 'poi');
                u.searchParams.set('tile', tileKey);
                u.searchParams.set('lat_i', String(b.latI));
                u.searchParams.set('lon_i', String(b.lonI));
                u.searchParams.set('south', b.south.toFixed(5));
                u.searchParams.set('west', b.west.toFixed(5));
                u.searchParams.set('north', b.north.toFixed(5));
                u.searchParams.set('east', b.east.toFixed(5));
                u.searchParams.set('v', '3');
                url = u.toString();
            }
            dbg.requests = Number(dbg.requests || 0) + 1;
            const res = await fetch(url);
            if (!res.ok) continue;
            const payload = await _poiReadTilePayload(url, res);
            let features = _poiParseTilePayload(payload);
            if (features.length) {
                const fetchSource = String((payload && payload.sourceKind) || '').toLowerCase() === 'legacy'
                    ? 'worker-poi-legacy'
                    : (endpoint.includes('{latI}') ? 'local-poi-split' : 'worker-poi-split');
                features = features.map(f => ({ ...f, fetchSource }));
                mergedFeatures = mergedFeatures.concat(features);
                dbg.hits = Number(dbg.hits || 0) + 1;
                dbg.splitHits = Number(dbg.splitHits || 0) + 1;
                tileSourceTag = fetchSource;
                _poiDebugBumpSourceCounter(fetchSource);
                _poiDebugMarkSource(fetchSource);
                break;
            }
        } catch (_) {
            dbg.errors = Number(dbg.errors || 0) + 1;
        }
    }
    if (includeCore) {
        for (const endpoint of POI_TILE_CORE_ENDPOINTS) {
            try {
                let url = '';
                if (endpoint.includes('{latI}') || endpoint.includes('{lonI}')) {
                    url = endpoint
                        .replaceAll('{latI}', encodeURIComponent(String(b.latI)))
                        .replaceAll('{lonI}', encodeURIComponent(String(b.lonI)));
                } else {
                    const u = new URL(endpoint);
                    u.searchParams.set('layer', 'core');
                    u.searchParams.set('tile', tileKey);
                    u.searchParams.set('lat_i', String(b.latI));
                    u.searchParams.set('lon_i', String(b.lonI));
                    u.searchParams.set('south', b.south.toFixed(5));
                    u.searchParams.set('west', b.west.toFixed(5));
                    u.searchParams.set('north', b.north.toFixed(5));
                    u.searchParams.set('east', b.east.toFixed(5));
                    u.searchParams.set('v', '3');
                    url = u.toString();
                }
                dbg.requests = Number(dbg.requests || 0) + 1;
                const res = await fetch(url);
                if (!res.ok) continue;
                const payload = await _poiReadTilePayload(url, res);
                let features = _poiParseTilePayload(payload);
                if (features.length) {
                    const fetchSource = endpoint.includes('{latI}') ? 'local-core-split' : 'worker-core-split';
                    features = features.map(f => ({ ...f, fetchSource }));
                    mergedFeatures = mergedFeatures.concat(features);
                    dbg.hits = Number(dbg.hits || 0) + 1;
                    dbg.splitHits = Number(dbg.splitHits || 0) + 1;
                    if (!tileSourceTag) tileSourceTag = fetchSource;
                    _poiDebugBumpSourceCounter(fetchSource);
                    _poiDebugMarkSource(fetchSource);
                    break;
                }
            } catch (_) {
                dbg.errors = Number(dbg.errors || 0) + 1;
            }
        }
    }
    if (mergedFeatures.length) {
        const dedup = [];
        const seen = new Set();
        for (const f of mergedFeatures) {
            const k = `${Number(f?.lat).toFixed(5)}|${Number(f?.lon).toFixed(5)}|${String(f?.name || '').toLowerCase()}|${String(f?.rawType || '').toLowerCase()}|${String(f?.sourceKind || '').toLowerCase()}`;
            if (seen.has(k)) continue;
            seen.add(k);
            dedup.push(f);
        }
        const sourceTag = String(tileSourceTag || dbg.lastSource || 'worker');
        _poiTileMemCache.set(cacheKey, { ts: now, features: dedup, source: sourceTag });
        _poiTrackTileCoverage(tileKey, sourceTag);
        return dedup;
    }
    if (!allowLegacyFallback) {
        dbg.misses = Number(dbg.misses || 0) + 1;
        _poiDebugBumpSourceCounter('split-only-miss');
        _poiDebugMarkSource('split-only-miss');
        _poiTileMemCache.set(cacheKey, { ts: now, features: [], source: 'split-only-miss' });
        return [];
    }
    // 2) Fallback: legacy combined/obstacle tiles.
    for (const endpoint of POI_TILE_LEGACY_ENDPOINTS) {
        try {
            const u = new URL(endpoint);
            u.searchParams.set('tile', tileKey);
            u.searchParams.set('lat_i', String(b.latI));
            u.searchParams.set('lon_i', String(b.lonI));
            u.searchParams.set('south', b.south.toFixed(5));
            u.searchParams.set('west', b.west.toFixed(5));
            u.searchParams.set('north', b.north.toFixed(5));
            u.searchParams.set('east', b.east.toFixed(5));
            u.searchParams.set('v', '2');
            dbg.requests = Number(dbg.requests || 0) + 1;
            const res = await fetch(u.toString());
            if (!res.ok) continue;
            const payload = await _poiReadTilePayload(u.toString(), res);
            const features = _poiParseTilePayload(payload);
            _poiTileMemCache.set(cacheKey, { ts: now, features, source: 'worker-legacy-fallback' });
            if (features.length) {
                dbg.hits = Number(dbg.hits || 0) + 1;
                dbg.legacyHits = Number(dbg.legacyHits || 0) + 1;
                dbg.fallbackHits = Number(dbg.fallbackHits || 0) + 1;
                _poiDebugBumpSourceCounter('worker-poi-legacy');
                _poiDebugMarkSource('worker-legacy-fallback');
                _poiTrackTileCoverage(tileKey, 'worker-legacy-fallback');
            }
            return features;
        } catch (_) {
            dbg.errors = Number(dbg.errors || 0) + 1;
        }
    }
    dbg.misses = Number(dbg.misses || 0) + 1;
    _poiDebugMarkSource('none');
    _poiTileMemCache.set(cacheKey, { ts: now, features: [], source: 'none' });
    return [];
}

function _shouldIncludeCoreForPoiSearch(forcedCategory = null, dispatchProfileId = 'auto') {
    const cat = String(forcedCategory || '').toLowerCase();
    const profile = String(dispatchProfileId || 'auto').toLowerCase();
    if (cat === 'trn') return false;
    if (cat && cat !== 'all') return true;
    if (profile === 'inspection_infra') return true;
    if (profile === 'search_and_rescue') return true;
    if (profile === 'mapping_survey') return true;
    if (profile === 'fire_watch') return true;
    if (profile === 'tour_guide_knowledge') return true;
    return false;
}

async function findTaggedTilePOI(lat, lon, minNM, maxNM, dirPref, forcedCategory = null, dispatchProfileId = 'auto', searchAnchor = null) {
    const forceCat = String(forcedCategory || '').toLowerCase();
    const profileId = String(dispatchProfileId || '').toLowerCase();
    const isKnowledgeGuideProfile = profileId === 'tour_guide_knowledge';
    const sarCorridorMode = profileId === 'search_and_rescue' && (!forceCat || forceCat === 'all');
    if (forceCat === 'trn') return null;
    const includeCore = _shouldIncludeCoreForPoiSearch(forceCat, dispatchProfileId);
    const allowLegacyFallback =
        !forceCat ||
        forceCat === 'all' ||
        forceCat === 'telecom' ||
        forceCat === 'infrastructure';
    const dbgStart = { ..._poiDebugState() };
    const anchor = (searchAnchor && Number.isFinite(Number(searchAnchor.lat)) && Number.isFinite(Number(searchAnchor.lon)))
        ? {
            lat: Number(searchAnchor.lat),
            lon: Number(searchAnchor.lon),
            localRadiusNm: Math.max(8, Number(searchAnchor.localRadiusNm) || 20),
            distNm: Number(searchAnchor.distNm || 0),
            bearingDeg: Number(searchAnchor.bearingDeg || 0),
            strategy: String(searchAnchor.strategy || 'ring-quadrant-anchor')
        }
        : {
            lat: Number(lat),
            lon: Number(lon),
            localRadiusNm: Math.max(18, Math.min(26, Number(maxNM || 40) * 0.45)),
            distNm: 0,
            bearingDeg: 0,
            strategy: 'route-centered'
        };
    const tileKeys = _poiCollectTileKeysAround(anchor.lat, anchor.lon, Math.max(anchor.localRadiusNm + 4, 18));
    if (!tileKeys.length) return null;

    const features = [];
    let cursor = 0;
    const workers = [];
    const workerCount = Math.min(POI_TILE_FETCH_PARALLEL, tileKeys.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push((async () => {
            while (cursor < tileKeys.length) {
                const idx = cursor++;
                const key = tileKeys[idx];
                const rows = await _poiFetchTileFeatures(key, { includeCore, allowLegacyFallback });
                if (rows && rows.length) features.push(...rows);
            }
        })());
    }
    await Promise.all(workers);
    if (!features.length) return null;

    const candidates = [];
    const seen = new Set();
    for (const f of features) {
        const flat = Number(f?.lat);
        const flon = Number(f?.lon);
        if (!Number.isFinite(flat) || !Number.isFinite(flon)) continue;
        const navStart = calcNav(lat, lon, flat, flon);
        if (!Number.isFinite(navStart?.dist)) continue;
        if (navStart.dist < Number(minNM || 0) || navStart.dist > Number(maxNM || 9999)) continue;
        if (!checkBearing(navStart.brng, dirPref)) continue;
        const navAnchor = calcNav(anchor.lat, anchor.lon, flat, flon);
        if (!Number.isFinite(navAnchor?.dist) || navAnchor.dist > Number(anchor.localRadiusNm || 20)) continue;

        const inferredCat = _poiInferCategoryFromFeature(f);
        if (isKnowledgeGuideProfile && inferredCat === 'generic') continue;
        const wantedCat = (!forceCat || forceCat === 'all') ? inferredCat : forceCat;
        if (forceCat && forceCat !== 'all' && !_poiFeatureMatchesCategory(f, forceCat)) continue;
        if (sarCorridorMode && !_poiFeatureMatchesCategory(f, 'sar_corridor')) continue;

        const rawName = String(f?.name || '').trim();
        const name = _poiNormalizeFeatureName(rawName, wantedCat);
        const hasName = !!rawName;
        const tf = f?.tags || {};
        const railTag = String(tf.railway || '').toLowerCase();
        const isRailOpPoint = ['signal', 'switch', 'level_crossing', 'crossing'].includes(railTag);
        const isSarLikeProfile = (profileId === 'search_and_rescue');
        const isInfraOpsProfile = (profileId === 'inspection_infra' || profileId === 'mapping_survey');

        if (forceCat === 'dam' && !hasName && String(f?.sourceKind || '') === 'lin') continue;
        if (forceCat === 'road' && _poiIsSettlementOnlyFeature(f)) continue;
        if (forceCat === 'road' && !isSarLikeProfile) {
            if (!hasName) continue;
            if (String(f?.sourceKind || '') === 'poi' && !String(tf.highway || '').trim()) continue;
            if (String(tf.highway || '').toLowerCase() === 'motorway_junction') continue;
            if (_poiLooksJunctionLabel(name)) continue;
            if (_poiIsCodeLikeName(name)) continue;
        }
        if (forceCat === 'infrastructure' && !hasName) {
            const strongInfra = (
                !!tf.highway ||
                !!tf.railway ||
                ['line', 'minor_line', 'cable', 'tower', 'pole', 'substation', 'plant', 'generator', 'transformer'].includes(String(tf.power || '').toLowerCase()) ||
                ['tower', 'mast', 'bridge'].includes(String(tf.man_made || '').toLowerCase())
            );
            if (!strongInfra) continue;
        }
        if (forceCat === 'infrastructure' && !isSarLikeProfile && !isInfraOpsProfile) {
            if (!hasName) continue;
            if (String(tf.highway || '').toLowerCase() === 'motorway_junction') continue;
            if (_poiLooksJunctionLabel(name)) continue;
            if (_poiIsCodeLikeName(name)) continue;
        }
        if (forceCat === 'rail' && !isSarLikeProfile && !isInfraOpsProfile) {
            if (isRailOpPoint && !hasName) continue;
            if (_poiIsNumericLikeName(name)) continue;
            if (_poiIsCodeLikeName(name)) continue;
        }
        if (forceCat === 'telecom' && !isSarLikeProfile) {
            if (!hasName && !String(tf.obstacle_type || '').includes('wind')) continue;
            if (_poiIsNumericLikeName(name)) continue;
            if (_poiIsCodeLikeName(name)) continue;
        }
        const dedupeKey = `${wantedCat}|${name.toLowerCase()}|${flat.toFixed(4)}|${flon.toFixed(4)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        if (isKnowledgeGuideProfile) {
            if (!hasName || _poiIsGenericFallbackName(name)) continue;
            if (_poiIsCodeLikeName(name) || _poiIsNumericLikeName(name) || _poiLooksJunctionLabel(name)) continue;
        }

        const baseScore = _poiFeatureScore(f, wantedCat);
        const distMin = Number(minNM || 0);
        const distMax = Number(maxNM || 9999);
        const distMid = (distMin + distMax) / 2;
        const distHalf = Math.max(4, (distMax - distMin) / 2);
        const bandDeviation = Math.abs(Number(navStart.dist || 0) - distMid);
        const bandBonus = Math.max(-1.5, 2.5 - ((bandDeviation / distHalf) * 3.5));
        const distPenalty = (Math.min(80, Number(navAnchor.dist || 0)) * 0.30) + (Math.min(120, Number(navStart.dist || 0)) * 0.03);
        const nameBonus = hasName ? 2.0 : -1.5;
        const unnamedInfraPenalty = (forceCat === 'infrastructure' && !hasName) ? 7 : 0;
        const unnamedTelecomPenalty = (forceCat === 'telecom' && !hasName) ? 5 : 0;
        const isRailPointOp = isRailOpPoint;
        const railOpPenalty = (
            forceCat === 'rail' &&
            isRailPointOp &&
            profileId !== 'search_and_rescue' &&
            profileId !== 'inspection_infra' &&
            profileId !== 'mapping_survey'
        ) ? 7 : 0;
        const rank = baseScore + nameBonus + bandBonus - distPenalty - unnamedInfraPenalty - unnamedTelecomPenalty - railOpPenalty;
        candidates.push({
            n: name,
            lat: flat,
            lon: flon,
            dist: navStart.dist,
            brng: navStart.brng,
            anchorDistNm: navAnchor.dist,
            category: wantedCat,
            score: baseScore,
            rank,
            hasName,
            tags: tf && typeof tf === 'object' ? { ...tf } : {},
            fetchSource: String(f?.fetchSource || ''),
            featureSourceKind: String(f?.sourceKind || ''),
            featureLayer: String(f?.tags?.layer || '')
        });
    }
    if (!candidates.length) return null;

    // Wenn genug benannte Ziele vorhanden sind, bevorzugen wir diese strikt.
    // Das reduziert generische Ziele wie "Gewässer"/"Wasserreservoir", die später
    // häufig zu unpräzisen Story-Ortsnamen führen.
    let scoredCandidates = candidates;
    const namedCandidates = candidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n));
    const forceStrictNamed = !!forceCat && forceCat !== 'all';
    if (forceStrictNamed && namedCandidates.length >= 3) {
        scoredCandidates = namedCandidates;
    }
    if (forceCat === 'infrastructure') {
        const namedInfra = scoredCandidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n));
        if (namedInfra.length >= 1) scoredCandidates = namedInfra;
    }
    if (forceCat === 'telecom') {
        const namedTelecom = scoredCandidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n));
        if (namedTelecom.length >= 1) scoredCandidates = namedTelecom;
    }
    if (forceCat === 'road' && profileId !== 'search_and_rescue') {
        const namedRoad = scoredCandidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n) && !_poiLooksJunctionLabel(c.n));
        if (namedRoad.length >= 2) scoredCandidates = namedRoad;
    }
    if (forceCat === 'rail' && profileId !== 'search_and_rescue' && profileId !== 'inspection_infra' && profileId !== 'mapping_survey') {
        const namedRail = scoredCandidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n) && !_poiIsNumericLikeName(c.n));
        if (namedRail.length >= 2) scoredCandidates = namedRail;
    }
    if (isKnowledgeGuideProfile) {
        const educationalNamed = scoredCandidates.filter(c => !!c.hasName && !_poiIsGenericFallbackName(c.n) && !_poiIsCodeLikeName(c.n) && !_poiIsNumericLikeName(c.n));
        if (educationalNamed.length >= 1) scoredCandidates = educationalNamed;
    }
    if (!scoredCandidates.length) return null;

    let pool = scoredCandidates;
    if (!forceCat || forceCat === 'all') {
        const balanced = pickBalancedByCategory(pool, p => p.category || 'generic', 'ga_poi_tag_cat');
        const targetCat = balanced?.category || pool[0]?.category || 'generic';
        pool = pool.filter(p => p.category === targetCat);
    }
    pool.sort((a, b) => (b.rank - a.rank) || (b.score - a.score) || (a.dist - b.dist));
    const topRaw = pool.slice(0, Math.min(12, pool.length));
    const top = (forceCat === 'infrastructure' || forceCat === 'telecom')
        ? _poiLimitPerCluster(topRaw, 2)
        : topRaw;
    let pick = _pickPoiCandidateWithHistory(top, (top[0]?.category || forceCat || 'generic'), 12, anchor) || top[0] || pool[0];
    if (isKnowledgeGuideProfile) {
        const shortlist = top.slice(0, Math.min(8, top.length));
        let contextualPick = null;
        for (const cand of shortlist) {
            const ctx = await _resolveEducationalPoiContext(cand.n, cand.lat, cand.lon);
            if (!ctx?.ok) continue;
            contextualPick = { ...cand, n: String(ctx.title || cand.n || '').trim() || cand.n };
            break;
        }
        if (!contextualPick) return null;
        pick = contextualPick;
    }
    const usedCat = String((pick && pick.category) || forceCat || 'generic').toLowerCase();
    const dbgBeforeFinalMark = { ..._poiDebugState() };
    _poiDebugMarkSource(String(pick?.fetchSource || '').trim() || String(dbgBeforeFinalMark.lastSource || ''));
    const dbgEnd = { ..._poiDebugState() };
    const selectedFetchSource = String(pick?.fetchSource || '');
    let sourceLabel = `Hosted POI Tiles (split, tagged:${usedCat})`;
    if (selectedFetchSource.startsWith('local-')) {
        sourceLabel = `Local POI Tiles (split, tagged:${usedCat})`;
    } else if (selectedFetchSource.includes('legacy')) {
        sourceLabel = `Hosted POI Tiles (legacy fallback, tagged:${usedCat})`;
    } else if (selectedFetchSource.startsWith('worker-')) {
        sourceLabel = `Hosted POI Tiles (worker split, tagged:${usedCat})`;
    }
    const lookupDebug = {
        includeCore,
        allowLegacyFallback,
        anchorStrategy: anchor.strategy,
        anchorDistNm: Number(anchor.distNm || 0),
        anchorBearingDeg: Number(anchor.bearingDeg || 0),
        anchorRadiusNm: Number(anchor.localRadiusNm || 0),
        anchorLat: Number(anchor.lat || 0),
        anchorLon: Number(anchor.lon || 0),
        tileKeys: tileKeys.length,
        features: features.length,
        candidates: candidates.length,
        requestsDelta: Math.max(0, Number(dbgEnd.requests || 0) - Number(dbgStart.requests || 0)),
        hitsDelta: Math.max(0, Number(dbgEnd.hits || 0) - Number(dbgStart.hits || 0)),
        splitHitsDelta: Math.max(0, Number(dbgEnd.splitHits || 0) - Number(dbgStart.splitHits || 0)),
        legacyHitsDelta: Math.max(0, Number(dbgEnd.legacyHits || 0) - Number(dbgStart.legacyHits || 0)),
        fallbackHitsDelta: Math.max(0, Number(dbgEnd.fallbackHits || 0) - Number(dbgStart.fallbackHits || 0)),
        errorsDelta: Math.max(0, Number(dbgEnd.errors || 0) - Number(dbgStart.errors || 0)),
        lastSource: String(dbgEnd.lastSource || ''),
        selectedFetchSource: selectedFetchSource || 'n/a',
        localPoiSplitHits: Number(dbgEnd.localPoiSplitHits || 0),
        localCoreSplitHits: Number(dbgEnd.localCoreSplitHits || 0),
        workerPoiSplitHits: Number(dbgEnd.workerPoiSplitHits || 0),
        workerCoreSplitHits: Number(dbgEnd.workerCoreSplitHits || 0),
        cacheEntries: Number(dbgEnd.cacheEntries || 0)
    };
    return {
        icao: 'POI',
        n: pick.n,
        lat: pick.lat,
        lon: pick.lon,
        poiCategory: usedCat,
        poiSource: sourceLabel,
        poiLookup: {
            engine: 'hosted-poi-tiles',
            featureSourceKind: String(pick?.featureSourceKind || ''),
            featureLayer: String(pick?.featureLayer || ''),
            selectedDistNm: Number(pick?.dist || 0),
            selectedAnchorDistNm: Number(pick?.anchorDistNm || 0),
            selectedBrgDeg: Number(pick?.brng || 0),
            selectedHasName: !!pick?.hasName,
            selectedTags: pick?.tags && typeof pick.tags === 'object' ? Object.fromEntries(
                Object.entries(pick.tags)
                    .filter(([k, v]) => k && v !== undefined && v !== null && String(v).length <= 80)
                    .slice(0, 18)
            ) : null,
            ...lookupDebug
        }
    };
}

function _isDamLikeNominatimItem(item) {
    if (!item) return false;
    const hay = normalizeMissionText([
        item.name,
        item.display_name,
        item.class,
        item.category,
        item.type,
        item.addresstype
    ].filter(Boolean).join(' '));
    if (
        _hasWordToken(hay, 'staudamm') ||
        _hasWordToken(hay, 'talsperre') ||
        _hasWordToken(hay, 'stausee') ||
        _hasWordToken(hay, 'sperrmauer') ||
        _hasWordToken(hay, 'reservoir') ||
        _hasWordToken(hay, 'damm') ||
        _hasWordToken(hay, 'dam') ||
        _hasWordToken(hay, 'wehr')
    ) return true;
    const cls = String(item.class || item.category || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    return (
        (cls === 'waterway' && (type === 'dam' || type === 'weir')) ||
        (cls === 'landuse' && type === 'reservoir') ||
        (cls === 'water' && (type === 'dam' || type === 'reservoir'))
    );
}

async function findNominatimDamPOI(lat, lon) {
    const vb = _buildViewBoxAround(lat, lon, 18);
    const queries = ['staudamm', 'talsperre', 'stausee', 'reservoir', 'dam', 'wehr'];
    const seen = new Set();
    const candidates = [];

    for (const q of queries) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&bounded=1&q=${encodeURIComponent(q)}&viewbox=${encodeURIComponent(`${vb.west},${vb.north},${vb.east},${vb.south}`)}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const list = await res.json();
            if (!Array.isArray(list)) continue;
            for (const it of list) {
                const key = `${it.osm_type || '?'}:${it.osm_id || '?'}:${it.lat || '?'}:${it.lon || '?'}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (!_isDamLikeNominatimItem(it)) continue;
                const ilat = Number(it.lat);
                const ilon = Number(it.lon);
                if (!Number.isFinite(ilat) || !Number.isFinite(ilon)) continue;
                const dNm = calcNav(lat, lon, ilat, ilon).dist;
                if (!Number.isFinite(dNm) || dNm > 18.5) continue;
                const name = String(it.name || it.display_name || '').split(',')[0].trim();
                candidates.push({
                    n: name || 'Staudamm/Talsperre',
                    lat: ilat,
                    lon: ilon,
                    dNm,
                    importance: Number(it.importance || 0)
                });
            }
        } catch (_) {}
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.dNm - b.dNm) || (b.importance - a.importance));
    const pick = candidates[0];
    return { icao: 'POI', n: pick.n, lat: pick.lat, lon: pick.lon, poiCategory: 'dam', poiSource: 'Nominatim (dam typed)' };
}

function _parseWktPoint(wkt) {
    const m = String(wkt || '').match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (!m) return null;
    const lon = Number(m[1]);
    const lat = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

function _wikidataTypeQidsForPoiCategory(category = '') {
    const cat = String(category || '').toLowerCase();
    if (cat === 'water') {
        // reservoir, lake, river, sea, dam
        return ['Q131681', 'Q23397', 'Q4022', 'Q165', 'Q12323'];
    }
    if (cat === 'mountain') {
        // mountain, valley, mountain pass, mountain range
        return ['Q8502', 'Q39816', 'Q133056', 'Q46831'];
    }
    if (cat === 'castle') {
        // castle, fortress, ruins
        return ['Q23413', 'Q1785071', 'Q839954'];
    }
    if (cat === 'dam') {
        // dam, reservoir
        return ['Q12323', 'Q131681'];
    }
    return [];
}

const _poiEducationalContextCache = new Map();

function _isUsefulWikiExtract(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return false;
    if (raw.length < 140) return false;
    if (/(keine regionalen wikipedia-daten gefunden|artikel konnte nicht|wiki-daten konnten nicht geladen|nicht abrufbar)/i.test(raw)) return false;
    return true;
}

async function _fetchWikiExtractByTitle(title) {
    const t = String(title || '').trim();
    if (!t) return null;
    try {
        const extRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&exsentences=4&titles=${encodeURIComponent(t)}&format=json&origin=*`);
        if (!extRes.ok) return null;
        const extData = await extRes.json();
        const pages = extData?.query?.pages || null;
        if (!pages || typeof pages !== 'object') return null;
        const pageId = Object.keys(pages)[0];
        if (!pageId || pageId === '-1') return null;
        const extract = String(pages?.[pageId]?.extract || '').trim();
        return _isUsefulWikiExtract(extract) ? { title: t, extract } : null;
    } catch (_) {
        return null;
    }
}

async function _resolveEducationalPoiContext(title, lat, lon) {
    const t = String(title || '').trim();
    const latN = Number(lat);
    const lonN = Number(lon);
    const key = `${t.toLowerCase()}|${Number.isFinite(latN) ? latN.toFixed(4) : 'nan'}|${Number.isFinite(lonN) ? lonN.toFixed(4) : 'nan'}`;
    if (_poiEducationalContextCache.has(key)) return _poiEducationalContextCache.get(key);

    let best = await _fetchWikiExtractByTitle(t);
    if (!best && Number.isFinite(latN) && Number.isFinite(lonN)) {
        try {
            const geoRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${latN}|${lonN}&gsradius=8000&gslimit=4&format=json&origin=*`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                const list = Array.isArray(geoData?.query?.geosearch) ? geoData.query.geosearch : [];
                for (const item of list) {
                    const cTitle = String(item?.title || '').trim();
                    if (!cTitle) continue;
                    const hit = await _fetchWikiExtractByTitle(cTitle);
                    if (hit) { best = hit; break; }
                }
            }
        } catch (_) {}
    }
    const out = best ? { ok: true, title: best.title, extract: best.extract } : { ok: false, title: t, extract: '' };
    _poiEducationalContextCache.set(key, out);
    return out;
}

async function findWikidataTypedPOI(lat, lon, minNM, maxNM, dirPref, forcedCategory) {
    const cat = String(forcedCategory || '').toLowerCase();
    const qids = _wikidataTypeQidsForPoiCategory(cat);
    if (!qids.length) return null;

    const radiusKm = Math.max(5, Math.min(350, Number(maxNM || 50) * 1.852));
    const values = qids.map(q => `wd:${q}`).join(' ');
    const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?item ?itemLabel ?coord ?distance WHERE {
  VALUES ?wantedType { ${values} }
  ?item wdt:P31/wdt:P279* ?wantedType ;
        wdt:P625 ?coord .
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${Number(lon)} ${Number(lat)})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
    bd:serviceParam wikibase:distance ?distance .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY ?distance
LIMIT 120
`.trim();

    try {
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        if (!res.ok) return null;
        const data = await res.json();
        const bindings = Array.isArray(data?.results?.bindings) ? data.results.bindings : [];
        if (!bindings.length) return null;

        const candidates = [];
        for (const b of bindings) {
            const label = String(b?.itemLabel?.value || '').trim();
            const parsed = _parseWktPoint(b?.coord?.value || '');
            if (!parsed || !label) continue;
            const nav = calcNav(lat, lon, parsed.lat, parsed.lon);
            if (!Number.isFinite(nav?.dist) || nav.dist < Number(minNM || 0) || nav.dist > Number(maxNM || 9999)) continue;
            if (!checkBearing(nav.brng, dirPref)) continue;
            candidates.push({
                n: label,
                lat: parsed.lat,
                lon: parsed.lon,
                dist: nav.dist
            });
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => a.dist - b.dist);
        const top = candidates.slice(0, Math.min(6, candidates.length));
        const pick = top[Math.floor(Math.random() * top.length)] || candidates[0];
        return { icao: 'POI', n: pick.n, lat: pick.lat, lon: pick.lon, poiCategory: cat, poiSource: `Wikidata typed (${cat})` };
    } catch (_) {
        return null;
    }
}

async function findWikipediaPOI(lat, lon, minNM, maxNM, dirPref, forcedCategory = null) {
    const scoredKeywords = [
        "bruecke", "brucke", "bridge", "viadukt", "autobahn", "autobahnkreuz", "kreuz", "kreuzung", "dreieck", "strasse", "tunnel", "highway", "motorway", "interstate", "freeway", "interchange",
        "staudamm", "talsperre", "stausee", "sperrmauer", "reservoir", "dam", "wehr",
        "funkturm", "fernsehturm", "sendemast", "funkmast",
        "fluss", "river", "strom", "kanal", "see", "lake", "hafen", "bay", "fjord", "insel", "kueste",
        "burg", "schloss", "dom", "denkmal", "monument", "festung", "kloster",
        "berg", "gipfel", "tal", "schlucht", "wald", "spitze",
        "stadt", "city", "turm", "arena", "stadion", "zentrum"
    ];
    const weakKeywords = ["liste", "begriffsklarung", "jahr", "person", "verwaltungsgemeinschaft", "gemeinde"];
    const scorePOITitle = (title) => {
        const t = normalizeMissionText(title);
        let score = 0;
        for (const kw of scoredKeywords) {
            if (t.includes(kw)) score += 1;
        }
        for (const kw of weakKeywords) {
            if (t.includes(kw)) score -= 1;
        }
        return score;
    };
    const forceCat = String(forcedCategory || '').trim().toLowerCase();
    // Bei expliziter Kategorie bevorzugen wir typisierte Objekt-Datenquellen,
    // damit z.B. "water" echte Gewaesser/Talsperren liefert.
    if (forceCat && forceCat !== 'all' && forceCat !== 'fire' && forceCat !== 'trn') {
        const typedPoi = await findWikidataTypedPOI(lat, lon, minNM, maxNM, dirPref, forceCat);
        if (typedPoi) return typedPoi;
    }
    const dist = Math.floor(Math.random() * (maxNM - minNM + 1)) + minNM;
    let minB = 0, maxB = 360;
    if (dirPref === 'N') { minB = 315; maxB = 405; } else if (dirPref === 'E') { minB = 45; maxB = 135; } else if (dirPref === 'S') { minB = 135; maxB = 225; } else if (dirPref === 'W') { minB = 225; maxB = 315; }
    let bearing = Math.floor(Math.random() * (maxB - minB + 1)) + minB; bearing = bearing % 360;
    const target = getDestinationPoint(lat, lon, dist, bearing);
    if (forceCat === 'dam') {
        const damPoi = await findNominatimDamPOI(target.lat, target.lon);
        if (damPoi) return damPoi;
    }
    const url = `https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${target.lat}|${target.lon}&gsradius=10000&gslimit=30&format=json&origin=*`;
    try {
        const res = await fetch(url); const data = await res.json();
        if (data.query && data.query.geosearch && data.query.geosearch.length > 0) {
            const geosearch = data.query.geosearch;
            let poiPool = geosearch;
            if (forceCat && forceCat !== 'all') {
                const forcedPool = geosearch.filter(p => poiTitleMatchesCategory(p.title, forceCat));
                if (forcedPool.length > 0) {
                    poiPool = forcedPool;
                } else {
                    // Kein unpassender Rückfall bei explizitem Category-Picker.
                    return null;
                }
            }
            let bestScore = -999;
            const scoreFn = (forceCat === 'fire') ? scoreFirePOITitle : scorePOITitle;
            for (const p of poiPool) {
                const s = scoreFn(p.title);
                if (s > bestScore) bestScore = s;
            }
            if (bestScore > 0) {
                poiPool = poiPool.filter(p => scoreFn(p.title) === bestScore);
            }
            const balancedPoi = pickBalancedByCategory(poiPool, p => classifyPOITitleCategory(p.title), 'ga_poi_cat');
            const poi = balancedPoi ? balancedPoi.item : poiPool[Math.floor(Math.random() * poiPool.length)];
            return {
                icao: "POI",
                n: poi.title,
                lat: poi.lat,
                lon: poi.lon,
                poiCategory: balancedPoi ? balancedPoi.category : classifyPOITitleCategory(poi.title),
                poiSource: `Wikipedia GeoSearch${forceCat ? ` (forced:${forceCat})` : ''}`
            };
        }
    } catch (e) { }
    return null;
}

async function fetchAreaDescription(lat, lon, elementId, exactTitle = null, icaoCode = null, imgContainerId = 'wikiDestImageContainer', imgElId = 'wikiDestImage') {
    const imgContainer = document.getElementById(imgContainerId);
    const imgElement = document.getElementById(imgElId);
    const textElement = document.getElementById(elementId);
    if (imgContainer) imgContainer.style.display = 'none';
    if (!textElement) return;

    try {
        let titleToFetch = exactTitle;
        if (!titleToFetch && icaoCode) titleToFetch = await getWikiTitleForAirport(icaoCode, lat, lon);

        if (!titleToFetch) {
            const geoRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=1&format=json&origin=*`);
            const geoData = await geoRes.json();
            if (geoData?.query?.geosearch?.length > 0) titleToFetch = geoData.query.geosearch[0].title;
            else { textElement.innerText = "Keine regionalen Wikipedia-Daten gefunden."; return; }
        }

        if (titleToFetch) {
            const extRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=true&explaintext=true&exsentences=4&pithumbsize=1200&titles=${encodeURIComponent(titleToFetch)}&format=json&origin=*`);
            const extData = await extRes.json();

            if (extData?.query?.pages) {
                const pageId = Object.keys(extData.query.pages)[0];
                if (pageId !== "-1" && extData.query.pages[pageId].extract) {
                    let prefix = exactTitle ? "" : `Region (${titleToFetch}):\n\n`;
                    textElement.innerText = prefix + extData.query.pages[pageId].extract;

                    const imgUrl = extData.query.pages[pageId].thumbnail?.source;
                    if (imgUrl && imgContainer && imgElement) {
                        imgElement.style.backgroundImage = `url('${imgUrl}')`;
                        imgContainer.style.display = 'block';
                    }
                    return;
                }
            }
        }
        textElement.innerText = "Der Artikel konnte nicht von Wikipedia abgerufen werden.";
    } catch (e) { textElement.innerText = "Wiki-Daten konnten nicht geladen werden."; }
}

async function fetchRunwayDetails(lat, lon, elementId, icaoCode) {
    const domEl = document.getElementById(elementId);
    if (!domEl) return;
    const hColor = document.body.classList.contains('theme-retro') ? 'var(--piper-yellow)' : 'var(--warn)';

    // Check Cache first
    if (icaoCode && runwayCache[icaoCode]) {
        domEl.innerHTML = runwayCache[icaoCode].replace(/\n/g, '<br>');
        domEl.style.color = hColor;
        if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        return;
    }

    const wikiResult = await fetchRunwayFromWikipedia(icaoCode, lat, lon);
    if (wikiResult) {
        if (icaoCode) runwayCache[icaoCode] = wikiResult;
        domEl.innerHTML = wikiResult.replace(/\n/g, '<br>');
        domEl.style.color = hColor;
        if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        return;
    }

    try {
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:5];way["aeroway"="runway"](around:2000,${lat},${lon});out tags;`)}`);
        const data = await res.json();
        if (data?.elements?.length > 0) {
            const trans = {
                "asphalt": "Asphalt", "concrete": "Beton", "grass": "Gras",
                "paved": "Asphalt", "unpaved": "Unbefestigt", "dirt": "Erde", "gravel": "Schotter"
            };
            const seen = new Set();
            const parts = [];
            for (const el of data.elements) {
                if (!el.tags?.ref) continue;
                const key = el.tags.ref;
                if (seen.has(key)) continue;
                seen.add(key);
                const surf = el.tags.surface ? (trans[el.tags.surface.toLowerCase()] || el.tags.surface) : '?';
                const len = el.tags.length ? ` · ${Math.round(el.tags.length)}m` : '';
                parts.push(`${key} – ${surf}${len}`);
            }
            if (parts.length > 0) {
                const rwyString = parts.join('\n');
                if (icaoCode) runwayCache[icaoCode] = rwyString;
                domEl.innerHTML = rwyString.replace(/\n/g, '<br>');
                domEl.style.color = hColor;
                if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
                if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
                return;
            }
        }
    } catch (e) { }

    const notFoundStr = "Keine Daten gefunden";
    domEl.innerText = notFoundStr;
    domEl.style.color = "#888";
    if (icaoCode) runwayCache[icaoCode] = notFoundStr;
    if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerText = 'Pisten: ' + notFoundStr;
    if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerText = 'Pisten: ' + notFoundStr;
}

const wikiTitleCache = {};

async function getWikiTitleForAirport(icao, lat, lon) {
    if (wikiTitleCache[icao]) return wikiTitleCache[icao];

    try {
        const wdRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P239=${icao}&format=json&origin=*`, 4000);
        const wdData = await wdRes.json();
        if (wdData?.query?.search?.length > 0) {
            wikiTitleCache[icao] = wdData.query.search[0].title;
            return wdData.query.search[0].title;
        }

        const isAirport = (t) => ['flugplatz', 'flughafen', 'airport', 'air base', 'aerodrome', 'segelflug', 'landeplatz', 'fliegerhorst', icao.toLowerCase()].some(kw => t.toLowerCase().includes(kw));

        const geoRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=10&format=json&origin=*`, 4000);
        const geoData = await geoRes.json();
        const geoResults = geoData?.query?.geosearch || [];

        let hit = geoResults.find(r => isAirport(r.title));
        if (hit) {
            wikiTitleCache[icao] = hit.title;
            return hit.title;
        }

        const txtRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(icao + ' Flughafen OR Flugplatz')}&srlimit=5&format=json&origin=*`, 4000);
        const txtData = await txtRes.json();
        const txtResults = txtData?.query?.search || [];

        hit = txtResults.find(r => isAirport(r.title));
        if (hit) {
            wikiTitleCache[icao] = hit.title;
            return hit.title;
        } else if (txtResults.length > 0 && !txtResults[0].title.includes("Terminal")) {
            wikiTitleCache[icao] = txtResults[0].title;
            return txtResults[0].title;
        }
    } catch (e) { }
    return null;
}

async function fetchRunwayFromWikipedia(icaoCode, lat, lon) {
    if (!icaoCode) return null;
    try {
        const title = await getWikiTitleForAirport(icaoCode, lat, lon);
        if (!title) return null;

        const r = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&format=json&origin=*`, 5000);
        const d = await r.json();
        const pages = d?.query?.pages;

        if (pages) {
            const pageId = Object.keys(pages)[0];
            const wikitext = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'];
            if (wikitext) return parseRunwayFromWikitext(wikitext);
        }
    } catch (e) { }
    return null;
}

function parseRunwayFromWikitext(wikitext) {
    const runways = [];
    const commentRegex = new RegExp('<' + '!--[\\s\\S]*?--' + '>', 'g');
    let text = wikitext.replace(commentRegex, '');
    text = text.replace(/<br\s*\/?>/gi, ' ');
    text = text.replace(/&#160;/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&times;/gi, '×');
    text = text.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ');

    const HDG_PATTERN = /\b((?:0?[1-9]|[12]\d|3[0-6])[LRC]?\s*\/\s*(?:0?[1-9]|[12]\d|3[0-6])[LRC]?)\b/g;
    const SURFACES = /\b(asphalt|beton|gras|grass|schotter|gravel|concrete|paved|unpaved|dirt|erde|sand|wasser|water|eis|ice)\b/i;
    const LEN_PATTERN = /(?:(?:länge|length|len)\d*\s*=\s*([1-9][\d.,]*))|(?:([1-9][\d.,]*)\s*(?:m|Meter)\b)|(?:([1-9][\d.,]*)\s*(?:x|×)\s*\d+)/i;

    let matches = [];
    let match;
    while ((match = HDG_PATTERN.exec(text)) !== null) {
        let cleanHdg = match[1].replace(/\s+/g, '');
        let parts = cleanHdg.split('/');
        if (Math.abs(parseInt(parts[0], 10) - parseInt(parts[1], 10)) === 18) {
            matches.push({ hdg: cleanHdg, index: match.index, raw: match[1] });
        }
    }

    for (let i = 0; i < matches.length; i++) {
        const hdg = matches[i].hdg;
        const startIdx = matches[i].index;

        let endIdx = Math.min(startIdx + 200, text.length);
        if (i + 1 < matches.length) {
            if (matches[i + 1].index < endIdx) endIdx = matches[i + 1].index;
        }
        let contextFwd = text.substring(startIdx, endIdx);

        let preStartIdx = Math.max(0, startIdx - 60);
        if (i > 0) {
            const prevEnd = matches[i - 1].index + matches[i - 1].raw.length;
            if (prevEnd > preStartIdx) preStartIdx = prevEnd;
        }
        let contextBwd = text.substring(preStartIdx, startIdx);

        let length = '';
        let surface = '';

        let lenMatch = contextFwd.match(LEN_PATTERN);
        if (!lenMatch) lenMatch = contextBwd.match(LEN_PATTERN);

        let rawLen = lenMatch ? (lenMatch[1] || lenMatch[2] || lenMatch[3]) : null;

        if (!rawLen) {
            let isolatedNum = contextFwd.match(/(?:\||\s|^)([1-9][\d.]{2,3})(?:\s|\||$)/);
            if (!isolatedNum) isolatedNum = contextBwd.match(/(?:\||\s|^)([1-9][\d.]{2,3})(?:\s|\||$)/);
            if (isolatedNum) rawLen = isolatedNum[1];
        }

        if (rawLen) length = rawLen.replace(/[.,]/g, '') + 'm';

        let surfMatch = contextFwd.match(SURFACES);
        if (!surfMatch) surfMatch = contextBwd.match(SURFACES);

        if (surfMatch) surface = surfMatch[1].charAt(0).toUpperCase() + surfMatch[1].slice(1).toLowerCase();

        if (length || surface || matches.length === 1) {
            runways.push([hdg, length, surface].filter(Boolean).join(' · '));
        }
    }

    if (runways.length === 0) return null;

    const uniqueRunways = [...new Set(runways)];
    uniqueRunways.sort((a, b) => b.length - a.length);

    const finalRunways = [];

    for (const rwy of uniqueRunways) {
        const parts = rwy.split(' · ');
        const currentHdg = parts[0];

        const currentSurfMatch = rwy.match(new RegExp(SURFACES.source, 'i'));
        const currentSurf = currentSurfMatch ? currentSurfMatch[1].toLowerCase() : null;

        let isSubsetOrHistory = false;

        for (const existing of finalRunways) {
            const existingParts = existing.split(' · ');
            if (existingParts[0] === currentHdg) {

                let allAttrMatch = true;
                for (let j = 1; j < parts.length; j++) {
                    if (!existing.includes(parts[j])) {
                        allAttrMatch = false;
                        break;
                    }
                }

                if (allAttrMatch) {
                    isSubsetOrHistory = true;
                    break;
                }

                const existingSurfMatch = existing.match(new RegExp(SURFACES.source, 'i'));
                const existingSurf = existingSurfMatch ? existingSurfMatch[1].toLowerCase() : null;

                if (existingSurf === currentSurf || !currentSurf) {
                    isSubsetOrHistory = true;
                    break;
                }
            }
        }

        if (!isSubsetOrHistory) {
            finalRunways.push(rwy);
        }
    }

    return finalRunways.slice(0, 5).join('\n');
}

const _poiTerrainCache = new Map();
const _missionWxCache = new Map();
const _dwdWbiStationCache = { ts: 0, stations: [] };
const _dwdWbiByStationCache = new Map();

function _isLikelyGermanyLatLon(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    return lat >= 46.0 && lat <= 56.3 && lon >= 5.0 && lon <= 15.8;
}

function _wbiRiskLabel(level) {
    const l = Number(level || 0);
    if (l <= 1) return 'sehr gering';
    if (l === 2) return 'gering';
    if (l === 3) return 'mittel';
    if (l === 4) return 'hoch';
    if (l >= 5) return 'sehr hoch';
    return 'n/a';
}

function _formatWbiDate(yyyymmdd) {
    const s = String(yyyymmdd || '');
    if (!/^\d{8}$/.test(s)) return null;
    return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
}

function _looksLikeWbiCsvText(txt) {
    const t = String(txt || '').slice(0, 220).toLowerCase();
    return t.includes('stationsindex;') || t.includes('stationsid;') || t.includes(';wbi');
}

async function _fetchTextMaybeGzip(urls = []) {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    for (const url of list) {
        try {
            const res = await fetch(url);
            if (!res.ok || res.status === 204) continue;
            const buf = await res.arrayBuffer();
            if (!buf || buf.byteLength === 0) continue;

            // Versuch 1: Direkttext (bei Proxy oft bereits entpackt).
            try {
                const direct = new TextDecoder('utf-8', { fatal: false }).decode(buf);
                if (_looksLikeWbiCsvText(direct) || direct.includes('Stationsindex;')) return direct;
            } catch (_) {}

            // Versuch 2: gzip entpacken (Browser mit DecompressionStream).
            if (typeof DecompressionStream !== 'undefined') {
                try {
                    const ds = new DecompressionStream('gzip');
                    const stream = new Blob([buf]).stream().pipeThrough(ds);
                    const unzipped = await new Response(stream).text();
                    if (_looksLikeWbiCsvText(unzipped)) return unzipped;
                } catch (_) {}
            }

            // Versuch 3: Latin-1 Fallback fuer Stationsliste.
            try {
                const latin = new TextDecoder('latin1', { fatal: false }).decode(buf);
                if (_looksLikeWbiCsvText(latin) || latin.includes('Stationsindex;')) return latin;
            } catch (_) {}
        } catch (_) {}
    }
    return null;
}

async function fetchDwdWbiStations() {
    const now = Date.now();
    if (Array.isArray(_dwdWbiStationCache.stations) && _dwdWbiStationCache.stations.length > 50 && (now - _dwdWbiStationCache.ts) < 24 * 3600 * 1000) {
        return _dwdWbiStationCache.stations;
    }
    const src = 'https://opendata.dwd.de/climate_environment/CDC/derived_germany/fire_danger_index/woodland/forecast/historical/derived_germany_fire_danger_index_woodland_forecast_historical_v2-3--0_stations_list.txt';
    const txt = await _fetchTextMaybeGzip([
        src,
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(src)}`
    ]);
    if (!txt) return [];
    const lines = txt.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
        if (!/^\d/.test(line)) continue;
        const cols = line.split(';');
        if (cols.length < 6) continue;
        const id = parseInt(String(cols[0] || '').trim(), 10);
        const lat = parseFloat(String(cols[2] || '').trim().replace(',', '.'));
        const lon = parseFloat(String(cols[3] || '').trim().replace(',', '.'));
        if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
            id,
            lat,
            lon,
            name: String(cols[4] || '').trim(),
            state: String(cols[5] || '').trim()
        });
    }
    _dwdWbiStationCache.ts = now;
    _dwdWbiStationCache.stations = out;
    return out;
}

function findNearestDwdWbiStation(lat, lon, stations = []) {
    const src = Array.isArray(stations) ? stations : [];
    if (!src.length || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    let best = null;
    let bestNm = Infinity;
    for (const st of src) {
        const dNm = calcNav(lat, lon, Number(st.lat), Number(st.lon)).dist;
        if (!Number.isFinite(dNm)) continue;
        if (dNm < bestNm) {
            bestNm = dNm;
            best = st;
        }
    }
    if (!best) return null;
    return { ...best, distanceNm: bestNm };
}

async function fetchDwdWbiForLocation(lat, lon) {
    if (!_isLikelyGermanyLatLon(lat, lon)) return null;
    const stations = await fetchDwdWbiStations();
    const nearest = findNearestDwdWbiStation(lat, lon, stations);
    if (!nearest) return null;
    const stationKey = String(nearest.id);
    if (_dwdWbiByStationCache.has(stationKey)) return _dwdWbiByStationCache.get(stationKey);

    const fileUrl = `https://opendata.dwd.de/climate_environment/CDC/derived_germany/fire_danger_index/woodland/recomputed/recent/derived_germany_fire_danger_index_woodland_recomputed_recent_${nearest.id}_v2-3--0.csv.gz`;
    const txt = await _fetchTextMaybeGzip([
        fileUrl,
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(fileUrl)}`
    ]);
    if (!txt) return null;

    const lines = txt.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    let bestDate = '';
    let bestLevel = null;
    for (const line of lines) {
        if (!/^\d/.test(line)) continue;
        const cols = line.split(';').map(s => String(s || '').trim());
        if (cols.length < 3) continue;
        const dateRaw = cols[1];
        const date8 = dateRaw.slice(0, 8);
        const level = parseInt(cols[2], 10);
        if (!/^\d{8}$/.test(date8) || !Number.isFinite(level)) continue;
        if (date8 >= bestDate) {
            bestDate = date8;
            bestLevel = level;
        }
    }
    if (!bestDate || !Number.isFinite(bestLevel)) return null;

    const out = {
        source: 'DWD WBI',
        stationId: nearest.id,
        stationName: nearest.name || null,
        state: nearest.state || null,
        distanceNm: Math.round(Number(nearest.distanceNm || 0) * 10) / 10,
        level: Math.max(1, Math.min(5, Math.round(bestLevel))),
        label: _wbiRiskLabel(bestLevel),
        date: bestDate,
        dateIso: `${bestDate.slice(0, 4)}-${bestDate.slice(4, 6)}-${bestDate.slice(6, 8)}`
    };
    _dwdWbiByStationCache.set(stationKey, out);
    return out;
}

async function fetchPoiTerrainElevationFt(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (_poiTerrainCache.has(key)) return _poiTerrainCache.get(key);

    let elevFt = null;
    try {
        if (typeof sampleTerrainElevation === 'function') {
            elevFt = await Promise.race([
                sampleTerrainElevation(lat, lon),
                new Promise((_, reject) => setTimeout(() => reject(new Error('terrain-timeout')), 2500))
            ]);
        }
    } catch (e) {}

    if (!Number.isFinite(elevFt)) {
        try {
            const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data?.elevation) && Number.isFinite(data.elevation[0])) {
                    elevFt = Math.round(data.elevation[0] * 3.28084);
                } else if (Number.isFinite(data?.elevation)) {
                    elevFt = Math.round(data.elevation * 3.28084);
                }
            }
        } catch (e) {}
    }

    const normalized = Number.isFinite(elevFt) ? Math.max(0, Math.round(elevFt)) : null;
    _poiTerrainCache.set(key, normalized);
    return normalized;
}

function _summarizeMissionWeather(wx) {
    if (!wx) return 'Keine aktuellen Wetterdaten verfügbar.';
    const visTxt = Number.isFinite(wx.visKm)
        ? (wx.visKm >= 10 ? 'Sicht >10 km' : `Sicht ${wx.visKm.toFixed(1)} km`)
        : 'Sicht n/a';
    const windTxt = (Number.isFinite(wx.windDeg) && Number.isFinite(wx.windKts))
        ? `Wind ${wx.windDeg}°/${Math.round(wx.windKts)} kt`
        : 'Wind n/a';
    const tempTxt = Number.isFinite(wx.tempC) ? `${Math.round(wx.tempC)}°C` : 'Temp n/a';
    const wxTxt = wx.wxCode ? `WX ${wx.wxCode}` : 'WX NIL';
    const catTxt = wx.fltCat ? `Kategorie ${wx.fltCat}` : 'Kategorie n/a';
    return `${windTxt}, ${visTxt}, ${tempTxt}, ${wxTxt}, ${catTxt}`;
}

function _looksLikeIcao(icao) {
    return /^[A-Z0-9]{4}$/.test(String(icao || '').trim().toUpperCase());
}

async function fetchMissionWeatherSnapshot(icao, lat, lon) {
    const normIcao = String(icao || '').trim().toUpperCase();
    const key = `${normIcao || 'POI'}_${Number(lat || 0).toFixed(3)}_${Number(lon || 0).toFixed(3)}`;
    if (_missionWxCache.has(key)) return _missionWxCache.get(key);

    const parsePayload = (txt) => {
        if (typeof txt !== 'string' || !txt.trim()) return null;
        try {
            const p = JSON.parse(txt);
            if (Array.isArray(p)) return p;
            if (Array.isArray(p?.data)) return p.data;
            if (Array.isArray(p?.results)) return p.results;
            if (typeof p?.contents === 'string') {
                const nested = JSON.parse(p.contents);
                return Array.isArray(nested) ? nested : null;
            }
        } catch (e) {}
        return null;
    };

    const tryFetch = async (url) => {
        const variants = [
            `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`
        ];
        for (const u of variants) {
            try {
                const res = await fetch(u);
                if (!res.ok || res.status === 204) continue;
                const txt = await res.text();
                const arr = parsePayload(txt);
                if (Array.isArray(arr) && arr.length) return arr;
            } catch (e) {}
        }
        return null;
    };

    let metar = null;
    if (_looksLikeIcao(normIcao)) {
        const arr = await tryFetch(`https://aviationweather.gov/api/data/metar?ids=${normIcao}&format=json&t=${Date.now()}`);
        if (arr && arr[0]) metar = arr[0];
    }
    if (!metar && Number.isFinite(lat) && Number.isFinite(lon)) {
        const latMin = lat - 0.6, latMax = lat + 0.6;
        const lonMin = lon - 0.8, lonMax = lon + 0.8;
        const arr = await tryFetch(`https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`);
        if (arr && arr[0]) {
            const cands = arr.filter(m => Number.isFinite(Number(m?.lat)) && Number.isFinite(Number(m?.lon)));
            if (cands.length) {
                let best = cands[0];
                let bestD = calcNav(lat, lon, Number(best.lat), Number(best.lon)).dist;
                for (let i = 1; i < cands.length; i++) {
                    const d = calcNav(lat, lon, Number(cands[i].lat), Number(cands[i].lon)).dist;
                    if (d < bestD) { bestD = d; best = cands[i]; }
                }
                metar = best;
            }
        }
    }

    let out = null;
    if (metar) {
        const raw = typeof metar.rawOb === 'string' ? metar.rawOb : (typeof metar.raw === 'string' ? metar.raw : '');
        let visKm = null;
        if (raw.includes(' 9999 ')) visKm = 10;
        else {
            const vm = raw.match(/\s(\d{4})\s/);
            if (vm && vm[1] !== '0000') visKm = Math.round((parseInt(vm[1], 10) / 1000) * 10) / 10;
        }
        let windDeg = Number.isFinite(Number(metar.wdir)) ? Number(metar.wdir) : null;
        let windKts = Number.isFinite(Number(metar.wspd)) ? Number(metar.wspd) : null;
        const vrb = /VRB\d{2,3}KT/.test(raw || '');
        if (vrb) windDeg = null;
        out = {
            station: String(metar.icaoId || normIcao || '').toUpperCase() || null,
            raw: raw || null,
            windDeg,
            windKts,
            visKm,
            tempC: Number.isFinite(Number(metar.temp)) ? Number(metar.temp) : null,
            wxCode: metar.wxString || null,
            fltCat: metar.fltCat || null
        };
    }

    _missionWxCache.set(key, out);
    return out;
}

function enforcePoiPassengerAltitudeRule(passenger, isPOI, poiTerrainFt = null) {
    if (!passenger || typeof passenger !== 'object') return passenger;
    const ROLE_PROFILE_VALUES = new Set([
        'general_passenger_v1',
        'instructor_calm_precise_v1',
        'charter_professional_neutral_v1',
        'technical_inspector_v1',
        'media_observer_v1',
        'science_field_v1',
        'vip_business_v1',
        'club_utility_v1',
        'medical_sensitive_v1',
        'news_reporter_professional_v1',
        'tour_guide_relaxed_v1',
        'tour_guide_learning_v1',
        'historian_storyteller_v1',
        'photogrammetry_precision_v1',
        'cargo_fragile_highcare_v1',
        'rescue_coordination_v1',
        'fire_observer_ops_v1',
        'club_student_v1'
    ]);
    const TASK_DOMAIN_VALUES = new Set([
        'general',
        'training',
        'charter',
        'inspection_infra',
        'media_photo',
        'science_bio',
        'science_geo',
        'science_general',
        'club_utility',
        'medical_transfer',
        'news_coverage',
        'sightseeing_tour',
        'poi_learning_guide',
        'historian_guided_tour',
        'mapping_survey',
        'cargo_fragile',
        'search_and_rescue',
        'fire_watch',
        'animal_transport',
        'club_training_basic',
        'club_training_advanced'
    ]);
    const _normRoleProfile = (v, fallback = 'general_passenger_v1') => {
        const s = String(v || '').trim().toLowerCase();
        return ROLE_PROFILE_VALUES.has(s) ? s : fallback;
    };
    const _normTaskDomain = (v, fallback = 'general') => {
        const s = String(v || '').trim().toLowerCase();
        return TASK_DOMAIN_VALUES.has(s) ? s : fallback;
    };
    const _deriveRoleProfileFromRole = (roleRaw, storyRaw) => {
        const hay = `${String(roleRaw || '').toLowerCase()} ${String(storyRaw || '').toLowerCase()}`;
        if (/(fluglehrer|fluglehrerin|instructor|instruktor|checkpilot)/.test(hay)) return 'instructor_calm_precise_v1';
        if (/(notarzt|notaerzt|sanitaet|rettung|mediz|arzt)/.test(hay)) return 'medical_sensitive_v1';
        if (/(report|journal|news|moderator|tv|presse)/.test(hay)) return 'news_reporter_professional_v1';
        if (/(lern-?guide|wissensflug|bildungsflug|faktenflug|kulturguide|museum aus der luft|lerntour)/.test(hay)) return 'tour_guide_learning_v1';
        if (/(tour|reiseleitung|stadtfuehr|guide|sightseeing)/.test(hay)) return 'tour_guide_relaxed_v1';
        if (/(historiker|historikerin|geschichte|denkmal|zeitreise|kultur)/.test(hay)) return 'historian_storyteller_v1';
        if (/(mapping|survey|photogram|lidar|geodaten|vermessung)/.test(hay)) return 'photogrammetry_precision_v1';
        if (/(fragil|zerbrech|praezision|kunstwerk|laborgeraet|stoßempfind)/.test(hay)) return 'cargo_fragile_highcare_v1';
        if (/(sar|search|rescue|rettungseinsatz|suchmuster)/.test(hay)) return 'rescue_coordination_v1';
        if (/(brand|rauch|hotspot|fire watch|waldbrand)/.test(hay)) return 'fire_observer_ops_v1';
        if (/(flugschueler|schueler|student|ausbildung)/.test(hay)) return 'club_student_v1';
        if (/(berater|anwalt|architekt|projektleiter|unternehmer|geschaeft|business|vip)/.test(hay)) return 'vip_business_v1';
        if (/(mechan|wartung|inspekt|techn|vermess|ingenieur|facility|pruef|prüfung|statik)/.test(hay)) return 'technical_inspector_v1';
        if (/(foto|film|medien|report|journal|immobilien)/.test(hay)) return 'media_observer_v1';
        if (/(wissenschaft|forschung|biolog|oekolog|ökolog|geolog|hydrolog|meteorolog|kartograf|analyst)/.test(hay)) return 'science_field_v1';
        if (/(verein|stammtisch|hangar|ersatzteil)/.test(hay)) return 'club_utility_v1';
        return 'general_passenger_v1';
    };
    const _deriveTaskDomain = (roleRaw, storyRaw, roleProfileRaw) => {
        const roleProfile = _normRoleProfile(roleProfileRaw, '');
        if (roleProfile === 'instructor_calm_precise_v1') return 'training';
        if (roleProfile === 'charter_professional_neutral_v1') return 'charter';
        if (roleProfile === 'medical_sensitive_v1') return 'medical_transfer';
        if (roleProfile === 'news_reporter_professional_v1') return 'news_coverage';
        if (roleProfile === 'tour_guide_relaxed_v1') return 'sightseeing_tour';
        if (roleProfile === 'tour_guide_learning_v1') return 'poi_learning_guide';
        if (roleProfile === 'historian_storyteller_v1') return 'historian_guided_tour';
        if (roleProfile === 'photogrammetry_precision_v1') return 'mapping_survey';
        if (roleProfile === 'cargo_fragile_highcare_v1') return 'cargo_fragile';
        if (roleProfile === 'rescue_coordination_v1') return 'search_and_rescue';
        if (roleProfile === 'fire_observer_ops_v1') return 'fire_watch';
        if (roleProfile === 'club_student_v1') return 'club_training_basic';
        const hay = `${String(roleRaw || '').toLowerCase()} ${String(storyRaw || '').toLowerCase()}`;
        if (/(notarzt|notaerzt|mediz|sanitaet|blutkonserve|klinik|patient)/.test(hay)) return 'medical_transfer';
        if (/(report|news|presse|tv|journal|moderator)/.test(hay)) return 'news_coverage';
        if (/(sightseeing|tour|stadtfuehr|ausflug|panorama)/.test(hay)) return 'sightseeing_tour';
        if (/(lern-?guide|wissensflug|bildungsflug|faktenflug|geschichte am ziel|kulturelle einordnung)/.test(hay)) return 'poi_learning_guide';
        if (/(historiker|historikerin|geschichte|zeitreise|denkmal|kulturhistor)/.test(hay)) return 'historian_guided_tour';
        if (/(mapping|survey|photogram|lidar|geodaten|kartier)/.test(hay)) return 'mapping_survey';
        if (/(fragil|zerbrech|praezision|kunstwerk|stoß|stoss|erschuetter)/.test(hay)) return 'cargo_fragile';
        if (/(sar|search|rescue|rettung|suchmuster|vermisst)/.test(hay)) return 'search_and_rescue';
        if (/(brand|rauch|hotspot|waldbrand|feuerwacht)/.test(hay)) return 'fire_watch';
        if (/(tiertransport|tierschutz|welpen|katze|hund|ziege|reh|hirsch|möwe|moewe|gans|ente|schwan|pferd|wildvogel|auffangstation|tierarzt|animal)/.test(hay)) return 'animal_transport';
        if (/(biolog|oekolog|ökolog|ornitholog|naturschutz|umwelt)/.test(hay)) return 'science_bio';
        if (/(geolog|hydrolog|erosion|hangstabil|gestein|sediment|rutsch)/.test(hay)) return 'science_geo';
        if (/(wissenschaft|forschung|meteorolog|kartograf|analyst)/.test(hay)) return 'science_general';
        if (/(inspekt|wartung|techn|vermess|brueck|bruck|autobahn|strass|funk|mast|damm|talsperre|schaden|sturm|stoer|stör|baufortschritt|waermebild|wärmebild|dach)/.test(hay)) return 'inspection_infra';
        if (/(foto|film|medien|immobilien|report|journal)/.test(hay)) return 'media_photo';
        if (/(verein|stammtisch|ersatzteil|mechaniker|hangar)/.test(hay)) return 'club_utility';
        return 'general';
    };
    const _normLevel = (v, fallback = 'mittel') => {
        const s = String(v || '').trim().toLowerCase();
        return (s === 'niedrig' || s === 'mittel' || s === 'hoch') ? s : fallback;
    };
    const _normUrgencyPriority = (v, fallback = 'niedrig') => {
        const s = String(v || '').trim().toLowerCase();
        if (s === 'hoch') return 'hoch';
        if (s === 'niedrig' || s === 'mittel' || s === 'normal' || s === 'medium') return 'niedrig';
        return fallback;
    };
    const _deriveStomachSensitivity = (gToleranceRaw) => {
        const gTol = _normLevel(gToleranceRaw, 'mittel');
        if (gTol === 'niedrig') return 'hoch';
        if (gTol === 'hoch') return 'niedrig';
        return 'mittel';
    };
    const normalized = {
        ...passenger,
        roleProfile: _normRoleProfile(
            passenger.roleProfile,
            _deriveRoleProfileFromRole(passenger.role, passenger.storyHint)
        ),
        taskDomain: _normTaskDomain(
            passenger.taskDomain,
            _deriveTaskDomain(passenger.role, passenger.storyHint, passenger.roleProfile)
        ),
        targetAltFt: Number(passenger.targetAltFt) || 0,
        targetRadiusNm: Number(passenger.targetRadiusNm) || 0,
        targetDwellMin: Number(passenger.targetDwellMin) || 0,
        dialectHint: typeof passenger.dialectHint === 'string' ? passenger.dialectHint.trim() : '',
        gTolerance: _normLevel(passenger.gTolerance, 'mittel'),
        bankTolerance: _normLevel(passenger.bankTolerance, 'mittel'),
        cargoSensitivity: _normLevel(passenger.cargoSensitivity, 'mittel'),
        stomachSensitivity: _normLevel(passenger.stomachSensitivity, _deriveStomachSensitivity(passenger.gTolerance)),
        comfortPriority: _normLevel(passenger.comfortPriority, 'mittel'),
        urgencyPriority: _normUrgencyPriority(passenger.urgencyPriority, 'niedrig')
    };

    // A-B Flüge: keine Arbeitsvorgaben am Ziel (nur Komfort/Charakter).
    if (!isPOI) {
        normalized.targetAltFt = 0;
        normalized.targetRadiusNm = 0;
        normalized.targetDwellMin = 0;
        return normalized;
    }

    if (normalized.targetAltFt < 0) normalized.targetAltFt = 0;
    if (normalized.targetRadiusNm < 0) normalized.targetRadiusNm = 0;
    if (normalized.targetDwellMin < 0) normalized.targetDwellMin = 0;

    if (normalized.targetAltFt > 0) {
        const minMslByTerrain = Number.isFinite(poiTerrainFt) ? Math.round(poiTerrainFt + 500) : 0;
        const minRequired = Math.max(500, minMslByTerrain);
        if (normalized.targetAltFt < minRequired) normalized.targetAltFt = minRequired;
    }
    if (!normalized.dialectHint) normalized.dialectHint = 'neutral';
    return normalized;
}

const TRAINING_AIRWORK_ITEMS = [
    'Stall-Training',
    'Steep Turns (Vollkreis)',
    'Slow Flight',
    'Haengekurven rechts/links',
    'Clean/Dirty Configuration Changes',
    'VFR-Navigationsaufgabe mit Kurskorrektur'
];
const TRAINING_PATTERN_ITEMS = [
    'No-Flaps-Approach',
    'Engine-Out-Approach (simuliert)',
    'Touch-and-Go',
    'Missed Approach / Go-Around',
    'Extra-Platzrunde mit stabilisiertem Endanflug'
];
const INSTRUCTOR_PERSONA_LIBRARY = [
    {
        name: 'Alex Kramer',
        role: 'Fluglehrer',
        gender: 'male',
        personality: 'ruhig, präzise, motivierend',
        dialectHint: 'neutral',
        greetingText: 'Morgen! Heute fliegen wir Training und ich gebe dir die Aufgaben unterwegs.'
    },
    {
        name: 'Lea Hartmann',
        role: 'Fluglehrerin',
        gender: 'female',
        personality: 'ruhig, präzise, motivierend',
        dialectHint: 'neutral',
        greetingText: 'Hi, ich bin Lea. Heute trainieren wir strukturiert und ich gebe dir die Aufgaben Schritt für Schritt.'
    }
];
const CHARTER_PERSONA_LIBRARY = [
    {
        name: 'Martin Vogt',
        role: 'Unternehmensberater',
        gender: 'male',
        personality: 'ruhig, fokussiert, höflich',
        dialectHint: 'neutral',
        greetingText: 'Hi, danke dir fürs Fliegen heute. Ich brauch einen ruhigen, sauberen Charterflug.'
    },
    {
        name: 'Nora Seidel',
        role: 'Projektleiterin',
        gender: 'female',
        personality: 'ruhig, strukturiert, freundlich',
        dialectHint: 'neutral',
        greetingText: 'Hi, danke fürs Mitnehmen. Mir ist ein ruhiger, planbarer Flug wichtig.'
    }
];

function _pickNextInstructorPersona() {
    const list = Array.isArray(INSTRUCTOR_PERSONA_LIBRARY) && INSTRUCTOR_PERSONA_LIBRARY.length
        ? INSTRUCTOR_PERSONA_LIBRARY
        : [{
            name: 'Alex Kramer',
            role: 'Fluglehrer',
            gender: 'male',
            personality: 'ruhig, präzise, motivierend',
            dialectHint: 'neutral',
            greetingText: 'Morgen! Heute fliegen wir Training und ich gebe dir die Aufgaben unterwegs.'
        }];
    let idx = -1;
    try { idx = parseInt(localStorage.getItem('ga_instructor_persona_idx') || '-1', 10); } catch (_) { idx = -1; }
    if (!Number.isFinite(idx)) idx = -1;
    idx = (idx + 1) % list.length;
    try { localStorage.setItem('ga_instructor_persona_idx', String(idx)); } catch (_) {}
    return { ...list[idx] };
}

function buildInstructorPassenger(trainingPlan = null) {
    const persona = _pickNextInstructorPersona();
    return {
        ...persona,
        gTolerance: 'mittel',
        bankTolerance: 'mittel',
        cargoSensitivity: 'niedrig',
        stomachSensitivity: 'mittel',
        comfortPriority: 'mittel',
        urgencyPriority: 'niedrig',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        roleProfile: 'instructor_calm_precise_v1',
        taskDomain: 'training',
        trainingPlan: sanitizeTrainingPlan(trainingPlan, true)
    };
}

function _pickNextCharterPersona() {
    const list = Array.isArray(CHARTER_PERSONA_LIBRARY) && CHARTER_PERSONA_LIBRARY.length
        ? CHARTER_PERSONA_LIBRARY
        : [{
            name: 'Martin Vogt',
            role: 'Unternehmensberater',
            gender: 'male',
            personality: 'ruhig, fokussiert, höflich',
            dialectHint: 'neutral',
            greetingText: 'Hi, danke dir fürs Fliegen heute. Ich brauch einen ruhigen, sauberen Charterflug.'
        }];
    let idx = -1;
    try { idx = parseInt(localStorage.getItem('ga_charter_persona_idx') || '-1', 10); } catch (_) { idx = -1; }
    if (!Number.isFinite(idx)) idx = -1;
    idx = (idx + 1) % list.length;
    try { localStorage.setItem('ga_charter_persona_idx', String(idx)); } catch (_) {}
    return { ...list[idx] };
}

function buildCharterPassenger(basePassenger = null) {
    const base = (basePassenger && typeof basePassenger === 'object') ? basePassenger : {};
    const persona = _pickNextCharterPersona();
    return {
        ...persona,
        ...base,
        name: String(base.name || '').trim() || persona.name,
        role: String(base.role || '').trim() || persona.role,
        gender: (String(base.gender || '').toLowerCase() === 'female' || String(base.gender || '').toLowerCase() === 'male')
            ? String(base.gender || '').toLowerCase()
            : persona.gender,
        personality: String(base.personality || '').trim() || persona.personality,
        greetingText: String(base.greetingText || '').trim() || persona.greetingText,
        dialectHint: 'neutral',
        gTolerance: String(base.gTolerance || 'mittel').toLowerCase(),
        bankTolerance: String(base.bankTolerance || 'mittel').toLowerCase(),
        cargoSensitivity: String(base.cargoSensitivity || 'mittel').toLowerCase(),
        stomachSensitivity: String(base.stomachSensitivity || 'mittel').toLowerCase(),
        comfortPriority: String(base.comfortPriority || 'mittel').toLowerCase(),
        urgencyPriority: (String(base.urgencyPriority || '').toLowerCase() === 'hoch') ? 'hoch' : 'niedrig',
        roleProfile: 'charter_professional_neutral_v1',
        taskDomain: 'charter',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        trainingPlan: null
    };
}

function _pickRandomProfilePersona(profileSpec) {
    const list = Array.isArray(profileSpec?.personas) ? profileSpec.personas.filter(Boolean) : [];
    if (!list.length) return null;
    return { ...list[Math.floor(Math.random() * list.length)] };
}

function buildMissionProfilePassenger(basePassenger = null, profileSpec = null, isPOI = false, storyHint = '') {
    if (!profileSpec || !profileSpec.id || profileSpec.id === 'auto') {
        return (basePassenger && typeof basePassenger === 'object') ? basePassenger : null;
    }
    const base = (basePassenger && typeof basePassenger === 'object') ? basePassenger : {};
    const persona = _pickRandomProfilePersona(profileSpec) || {};
    const tol = profileSpec.tolerances || {};
    const baseGender = String(base.gender || '').toLowerCase();
    const personaGender = String(persona.gender || '').toLowerCase();
    const merged = {
        ...base,
        name: String(persona.name || base.name || '').trim() || 'Alex Neumann',
        role: String(persona.role || base.role || '').trim() || 'Passagier',
        gender: (personaGender === 'female' || personaGender === 'male')
            ? personaGender
            : ((baseGender === 'female' || baseGender === 'male') ? baseGender : 'male'),
        personality: String(persona.personality || base.personality || 'ruhig, freundlich, professionell').trim(),
        dialectHint: 'neutral',
        greetingText: String(profileSpec.greetingText || base.greetingText || '').trim() || 'Hi, danke fürs Fliegen heute.',
        roleProfile: String(profileSpec.roleProfile || base.roleProfile || 'general_passenger_v1').toLowerCase(),
        taskDomain: String(profileSpec.taskDomain || base.taskDomain || 'general').toLowerCase(),
        gTolerance: String(tol.gTolerance || base.gTolerance || 'mittel').toLowerCase(),
        bankTolerance: String(tol.bankTolerance || base.bankTolerance || 'mittel').toLowerCase(),
        cargoSensitivity: String(tol.cargoSensitivity || base.cargoSensitivity || 'mittel').toLowerCase(),
        stomachSensitivity: String(tol.stomachSensitivity || base.stomachSensitivity || 'mittel').toLowerCase(),
        comfortPriority: String(tol.comfortPriority || base.comfortPriority || 'mittel').toLowerCase(),
        urgencyPriority: (String(tol.urgencyPriority || base.urgencyPriority || '').toLowerCase() === 'hoch') ? 'hoch' : 'niedrig',
        targetAltFt: isPOI ? Number(base.targetAltFt || 0) : 0,
        targetRadiusNm: isPOI ? Number(base.targetRadiusNm || 0) : 0,
        targetDwellMin: isPOI ? Number(base.targetDwellMin || 0) : 0,
        trainingPlan: null,
        storyHint: String(storyHint || '')
    };
    return merged;
}

function _escapeMissionNamePattern(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _replaceMissionPassengerNameText(value, fromName, toName) {
    const text = String(value || '');
    const from = String(fromName || '').trim();
    const to = String(toName || '').trim();
    if (!text || !from || !to || from === to) return value;
    const parts = from.split(/\s+/).filter(Boolean);
    const replacements = [from];
    if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        replacements.push(`Frau ${last}`, `Herr ${last}`);
        if (first.length >= 4) replacements.push(first);
    }
    let out = text;
    replacements.forEach(pattern => {
        if (!pattern) return;
        const replacement = /^Frau\s+/i.test(pattern)
            ? `Frau ${to.split(/\s+/).slice(-1)[0] || to}`
            : (/^Herr\s+/i.test(pattern) ? `Herr ${to.split(/\s+/).slice(-1)[0] || to}` : to);
        out = out.replace(new RegExp(`\\b${_escapeMissionNamePattern(pattern)}\\b`, 'g'), replacement);
    });
    return out;
}

function synchronizeMissionPassengerName(mission, oldPassenger = null, newPassenger = null) {
    if (!mission || typeof mission !== 'object') return mission;
    const oldName = String(oldPassenger?.name || '').trim();
    const newName = String(newPassenger?.name || '').trim();
    if (!oldName || !newName || oldName === newName) return mission;
    ['t', 'title', 's', 'story'].forEach(key => {
        if (typeof mission[key] === 'string') {
            mission[key] = _replaceMissionPassengerNameText(mission[key], oldName, newName);
        }
    });
    if (mission.passenger && typeof mission.passenger === 'object' && typeof mission.passenger.greetingText === 'string') {
        mission.passenger.greetingText = _replaceMissionPassengerNameText(mission.passenger.greetingText, oldName, newName);
    }
    return mission;
}

function _normUrgencyBinary(v) {
    return String(v || '').toLowerCase() === 'hoch' ? 'hoch' : 'niedrig';
}

function _hasTimePressureText(txt) {
    return /\b(zeitkrit|dringend|eilig|pünkt|puenkt|zeitnah|sofort|unverzueglich|unverzüglich|hoechste\s+prioritaet|höchste\s+priorität|so bald wie moeglich|so schnell wie moeglich)\b/i.test(String(txt || ''));
}

function _hasCargoSensitivityText(txt) {
    return /\b(empfindlich(?:e|er|en)?|fragil(?:e|er|en)?|stoss(?:-|\s)?empfindlich(?:e|er|en)?|stoß(?:-|\s)?empfindlich(?:e|er|en)?|erschuetterungsarm|erschütterungsarm|vorsichtig\s+mit\s+der\s+fracht)\b/i.test(String(txt || ''));
}

function _stripCargoSensitivityText(txt) {
    return String(txt || '')
        .replace(/\b(empfindlich(?:e|er|en)?|fragil(?:e|er|en)?|stoss(?:-|\s)?empfindlich(?:e|er|en)?|stoß(?:-|\s)?empfindlich(?:e|er|en)?|erschuetterungsarm|erschütterungsarm)\b/gi, '')
        .replace(/\b(vorsichtig|behutsam|sanft)\s+(mit|bei)\s+der\s+fracht\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

function _cleanupNarrativeArtifacts(txt) {
    return String(txt || '')
        .replace(/\bFokus:\s*/gi, '')
        .replace(/<\s*\/?\s*(INSTRUKTIONEN|KONTEXT|OUTPUT)\s*>/gi, '')
        .replace(/\b(OUTPUT-HYGIENE|KONSISTENZ-PFLICHT|PROFIL-FIX|OPERATIONS-REGEL)\b[^.?!]*/gi, '')
        .replace(/\bverlaesslicher\s+vereins-?\/?utility-?einsatz\s+ohne\s+themenmix\b[.!?]?/gi, '')
        .replace(/\bverlässlicher\s+vereins-?\/?utility-?einsatz\s+ohne\s+themenmix\b[.!?]?/gi, '')
        .replace(/\bohne\s+themenmix\b[.!?]?/gi, '')
        .replace(/\bder\s+auftrag\s+ist\s*,?\s*wir\s+sollten\b/gi, '')
        .replace(/\bder\s+auftrag\s+ist\b\s*,?/gi, '')
        .replace(/\bwir\s+sollten\b\s*,?/gi, '')
        .replace(/,\s*aber\s*([.?!])/gi, '$1')
        .replace(/\s+\baber\s*([.?!])/gi, '$1')
        .replace(/(?:^|[.!?]\s*)[,;:]+/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/^[,.;:\-]\s*/g, '')
        .trim();
}

function _enforceProfileNarrativeContract(storyText, profileId, isPOI = false) {
    let s = _cleanupNarrativeArtifacts(storyText);
    if (String(profileId || '') === 'news_coverage' && !isPOI) {
        s = s
            .replace(/\bund\s+ohne\s+kreisen\s+über\s+dem\s+ziel\b/gi, '')
            .replace(/\bund\s+ohne\s+kreisen\s+ueber\s+dem\s+ziel\b/gi, '')
            .replace(/\bohne\s+kreisen\s+über\s+dem\s+ziel\b/gi, '')
            .replace(/\bohne\s+kreisen\s+ueber\s+dem\s+ziel\b/gi, '')
            .replace(/\bkein(?:en|e|)\s+arbeitsauftrag\s+in\s+der\s+luft(?:\s+am\s+ziel)?\b/gi, '')
            .replace(/\bkein(?:en|e|)\s+kreisen\b/gi, '')
            .replace(/\bkein(?:en|e|)\s+verweilen(?:\/überflug|\/ueberflug)?(?:\s+als\s+missionsziel)?\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();
        if (!/berichterstattung\s+am\s+boden/i.test(s)) {
            s = `${s}${s ? ' ' : ''}Am Ziel startet die Berichterstattung am Boden.`.trim();
        }
    }
    return _cleanupNarrativeArtifacts(s);
}

function _stripTimePressureText(txt) {
    return String(txt || '')
        .replace(/\b(h(?:oe|ö)chste\s+priorit(?:ae|ä)t)\s*:?\s*/gi, '')
        .replace(/\b(zeitkritisch|dringend|eilig|zeitnah)\b/gi, '')
        .replace(/\b(sofort|unverz(?:ue|ü)glich)\b/gi, '')
        .replace(/\bso\s+bald\s+wie\s+m(?:oe|ö)glich\b/gi, '')
        .replace(/\bso\s+schnell\s+wie\s+m(?:oe|ö)glich\b/gi, '')
        .replace(/\bwir\s+m(?:ue|ü)ssen\s+(jetzt\s+)?(dringend|schnell|z(?:ue|ü)gig)\b[^.?!]*/gi, '')
        .replace(/\bp(?:ue|ü)nktlich(?:es|e|er|en)?\s+(ankommen|ankunft|eintreffen|sein)\s+(hilft|ist|waere|wäre|bleibt|macht)\b[^.?!]*/gi, '')
        .replace(/\bp(?:ue|ü)nktlich(?:e|er|es|en)?\s+(ankunft|uebergabe|übergabe|termin|eintreffen)\b[^.?!]*/gi, '')
        .replace(/\bp(?:ue|ü)nktlich\s+(am\s+ziel\s+)?(ankommen|sein)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

function _finalizeMissionNarrative(mission, profile, isPOI = false) {
    const m = (mission && typeof mission === 'object') ? mission : {};
    let title = _cleanupNarrativeArtifacts(String(m.t || m.title || '').trim());
    let story = _cleanupNarrativeArtifacts(String(m.s || m.story || '').trim());
    const urgency = _normUrgencyBinary(m?.passenger?.urgencyPriority);
    const cargoSensitivity = String(m?.passenger?.cargoSensitivity || '').toLowerCase() === 'hoch' ? 'hoch' : 'niedrig';
    const guard = {
        urgency,
        cargoSensitivity,
        timeHintAdded: false,
        timePressureStripped: false,
        cargoHintStripped: false,
        profileContractApplied: false
    };

    if (urgency === 'hoch') {
        if (!_hasTimePressureText(title) && !_hasTimePressureText(story)) {
            story = `${story}${story ? ' ' : ''}Der Auftrag ist zeitkritisch, wir sollten pünktlich ankommen.`.trim();
            guard.timeHintAdded = true;
        }
    } else {
        const before = `${title} ${story}`;
        title = _stripTimePressureText(title);
        story = _stripTimePressureText(story);
        guard.timePressureStripped = before !== `${title} ${story}`;
    }

    if (cargoSensitivity !== 'hoch') {
        const before = `${title} ${story}`;
        if (_hasCargoSensitivityText(title)) title = _stripCargoSensitivityText(title);
        if (_hasCargoSensitivityText(story)) story = _stripCargoSensitivityText(story);
        guard.cargoHintStripped = before !== `${title} ${story}`;
    }

    if (String(profile?.id || '') === 'cargo_fragile') {
        const before = `${title} ${story}`;
        const medicalUrgencyDrift = /\b(organtransport|spenderorgan|notaufnahme|notfall|emergency|medizinischer\s+notfall|patient(?:in|en)?)\b/i.test(before);
        if (medicalUrgencyDrift) {
            if (/\b(organtransport|spenderorgan|notfall|emergency)\b/i.test(title)) title = 'Empfindliche Fracht';
            story = 'Empfindliche Fracht wird zur sicheren Uebergabe am Ziel gebracht. Der Fokus liegt auf ruhiger, erschuetterungsarmer Flugfuehrung.';
            guard.profileContractApplied = true;
        }
    }

    const beforeProfile = story;
    story = _enforceProfileNarrativeContract(story, String(profile?.id || ''), isPOI);
    guard.profileContractApplied = guard.profileContractApplied || beforeProfile !== story;
    title = _cleanupNarrativeArtifacts(title);
    story = _cleanupNarrativeArtifacts(story);

    m.t = title || m.t || '';
    m.s = story || m.s || '';
    m._narrativeGuard = guard;
    return m;
}

function applyMissionTaskProfileToMission(mission, isPOI, profileId, paxText, cargoText) {
    const m = (mission && typeof mission === 'object') ? { ...mission } : {};
    const baseType = isPOI ? 'poi' : 'apt';
    const profile = getMissionTaskProfile(profileId, baseType);
    if (!profile || profile.id === 'auto') {
        return { mission: m, paxText, cargoText, appliedProfile: 'auto' };
    }

    const sourcePassenger = (m.passenger && typeof m.passenger === 'object') ? { ...m.passenger } : null;
    const passenger = buildMissionProfilePassenger(sourcePassenger || null, profile, isPOI, m.s || '');
    if (passenger) {
        if (profile.id === 'tour_guide_knowledge') {
            passenger.targetAltFt = 0;
            if (!(Number(passenger.targetRadiusNm) > 0)) passenger.targetRadiusNm = 3;
            if (!(Number(passenger.targetDwellMin) > 0)) passenger.targetDwellMin = 4;
        }
        m.passenger = passenger;
        synchronizeMissionPassengerName(m, sourcePassenger, passenger);
    }
    if (profile.paxText) {
        paxText = profile.paxText;
    } else if (m.passenger?.role) {
        paxText = `1 PAX (${m.passenger.role})`;
    }
    const cargoPool = Array.isArray(profile.cargoPool) ? profile.cargoPool.filter(Boolean) : [];
    if (cargoPool.length) cargoText = cargoPool[Math.floor(Math.random() * cargoPool.length)];
    const cue = _profileStoryCue(profile, isPOI);
    if (cue) {
        const story = String(m.s || '').trim();
        if (cue && story && !story.toLowerCase().includes(cue.toLowerCase())) {
            m.s = `${story} ${cue}`.trim();
        } else if (cue && !story) {
            m.s = cue;
        }
    }
    _finalizeMissionNarrative(m, profile, isPOI);
    if (m.passenger && typeof m.passenger === 'object') {
        m.passenger.storyHint = String(m.s || '').trim();
    }
    m.profileId = profile.id;
    return { mission: m, paxText, cargoText, appliedProfile: profile.id };
}

function _profileStoryCue(profile, isPOI = false) {
    if (!profile || profile.id === 'auto') return '';
    if (profile.id === 'news_coverage') {
        return isPOI
            ? 'Nüchterne Beobachtung und klare Lageeinschätzung aus der Luft.'
            : '';
    }
    if (profile.id === 'sightseeing_tour') {
        return isPOI
            ? 'Ruhiger Rundflug mit angenehmem Tempo und guter Sicht.'
            : 'Entspannter Ausflugsflug mit angenehmem Ablauf am Ziel.';
    }
    if (profile.id === 'tour_guide_knowledge') {
        return isPOI
            ? 'Bildungsflug am POI: kurze, klare Fakten und Einordnung ohne Arbeitsanweisungen, ohne Inspektionsauftrag.'
            : '';
    }
    if (profile.id === 'historian_guided_tour') {
        return isPOI
            ? 'Bildungsauftrag: historische Einordnung und lokale Geschichte am POI, ohne technischen Inspektionsfokus.'
            : 'Bildungsauftrag: historische Einordnung des Ziels mit ruhigem, stabilem Flugprofil.';
    }
    return String(profile.storyCue || '').replace(/\bFokus:\s*/gi, '').trim();
}

function _profileOpsRuleForPrompt(profile, isPOI = false) {
    if (!profile || profile.id === 'auto') return '';
    if (profile.id === 'news_coverage' && !isPOI) {
        return '16. OPERATIONS-REGEL REPORTER A-B: Dies ist ein reiner Transport zum Zielflugplatz. KEIN Arbeitsauftrag in der Luft am Ziel, KEIN Kreisen, KEIN Verweilen/Überflug als Missionsziel. Die eigentliche Berichterstattung findet nach der Landung am Boden statt.';
    }
    if (profile.id === 'news_coverage' && isPOI) {
        return '16. OPERATIONS-REGEL REPORTER POI: Luftbeobachtung am POI ist erlaubt; Auftrag bleibt sachlich, keine Touri-Rhetorik.';
    }
    if (profile.id === 'historian_guided_tour' && isPOI) {
        return '16. OPERATIONS-REGEL HISTORIKER POI: Auftrag ist ein ruhiger POI-Rundflug mit historischen Fakten und lokaler Geschichte. Briefing/Greeting/Folgeansagen bleiben historisch-bildend. Kein SAR/Feuer/Inspektionsauftrag daraus machen.';
    }
    if (profile.id === 'tour_guide_knowledge' && isPOI) {
        return '16. OPERATIONS-REGEL LERN-GUIDE POI: Rolle ist reine Wissensvermittlung zum Ziel (Fakten, Orientierung, Einordnung). Keine Arbeitsanweisungen an den Piloten, keine feste Arbeitshoehe verlangen, keine technische Inspektions- oder Einsatzsprache.';
    }
    if (profile.id === 'inspection_infra' && isPOI) {
        return '16. OPERATIONS-REGEL INSPEKTION POI: Auftrag ist technische Betreiberarbeit. Nutze Schäden, Sturmschaden-Check, Wartung, Störung, Baufortschritt, Wärmebild, Dach-/Bauwerks-/Trassenprüfung oder Dokumentation. Bei Brücken/Viadukten sind Pfeiler, Widerlager, Fundamente, Brückendeck, Unterführung/Hochstraße, Bahnviadukt, Sperrung oder Hochwasser an Pfeilern passende Varianten. Keine Geologie-/Relief-/Bodenforschungsstory, ausser das Ziel ist ausdrücklich Berg, Steinbruch, Hang oder Naturgebiet.';
    }
    if (profile.id === 'media_photo' && isPOI) {
        return '16. OPERATIONS-REGEL FOTO/FILM POI: Auftrag sind verwertbare Foto-/Filmaufnahmen fuer Firma, Betreiber, Redaktion, Dokumentation oder PR. Bei Brücken/Viadukten sind Betreiberfotos, Denkmalschutz-Doku, Bahnviadukt-Establishing-Shots oder Bauwerksdokumentation passende Motive. Keine technische Diagnose, keine Geologie-/Reliefstory, keine Einsatzdramatisierung.';
    }
    return '';
}

function _pickFromWeighted(values = [], fallback = 'auto') {
    const src = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!src.length) return fallback;
    return src[Math.floor(Math.random() * src.length)] || fallback;
}

function _pickFromWeightedWithRecentGuard(values = [], storageKey = '', { fallback = 'auto', recentLimit = 3 } = {}) {
    const src = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!src.length) return fallback;

    const unique = [...new Set(src)];
    if (!storageKey || unique.length <= 1) return _pickFromWeighted(src, fallback);

    const guardLimit = Math.max(1, Math.min(parseInt(recentLimit, 10) || 1, unique.length - 1));
    let history = [];
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(parsed)) history = parsed.map(x => String(x || '')).filter(Boolean);
    } catch (_) {
        history = [];
    }

    const recent = new Set(history.slice(-guardLimit));
    let pool = src.filter(id => !recent.has(String(id)));
    if (!pool.length) {
        pool = src;
        history = [];
    }

    const selected = _pickFromWeighted(pool, fallback);
    try {
        const nextHistory = history
            .filter(id => unique.includes(id))
            .concat(selected)
            .slice(-Math.max(unique.length, guardLimit + 1));
        localStorage.setItem(storageKey, JSON.stringify(nextHistory));
    } catch (_) {}

    return selected;
}

function _poiCategoryTaskPool(category = 'generic') {
    const c = String(category || 'generic').toLowerCase();
    // Kategorie bleibt fix, Task rotiert innerhalb passender Missionsfamilien.
    if (c === 'bridge' || c === 'road' || c === 'dam' || c === 'industry') {
        return ['inspection_infra', 'inspection_infra', 'mapping_survey', 'media_photo', 'news_coverage', 'tour_guide_knowledge'];
    }
    if (c === 'telecom') {
        return ['inspection_infra', 'inspection_infra', 'mapping_survey', 'media_photo', 'news_coverage', 'tour_guide_knowledge'];
    }
    if (c === 'infrastructure') {
        return ['inspection_infra', 'inspection_infra', 'mapping_survey', 'media_photo', 'news_coverage', 'search_and_rescue', 'tour_guide_knowledge'];
    }
    if (c === 'castle' || c === 'city') {
        return ['historian_guided_tour', 'historian_guided_tour', 'tour_guide_knowledge', 'sightseeing_tour', 'news_coverage'];
    }
    if (c === 'water') {
        return ['science_bio', 'science_bio', 'search_and_rescue', 'sightseeing_tour', 'historian_guided_tour', 'tour_guide_knowledge'];
    }
    if (c === 'mountain') {
        return ['science_geo', 'science_bio', 'sightseeing_tour', 'historian_guided_tour', 'search_and_rescue', 'mapping_survey', 'tour_guide_knowledge'];
    }
    if (c === 'fire') {
        return ['fire_watch', 'fire_watch', 'search_and_rescue', 'science_bio'];
    }
    if (c === 'generic') {
        return ['mapping_survey', 'news_coverage', 'sightseeing_tour', 'historian_guided_tour', 'tour_guide_knowledge'];
    }
    return ['mapping_survey', 'news_coverage'];
}

function pickAutoMissionTaskProfileId({ isPOI = false, selectedAptCategory = 'all', selectedPoiCategory = 'all', missionCat = '' } = {}) {
    const cat = String(missionCat || '').toLowerCase();
    const aptSel = String(selectedAptCategory || 'all').toLowerCase();
    const poiSel = String(selectedPoiCategory || 'all').toLowerCase();

    // Harte Picker-Regel fuer POI-Location-Filter:
    // Kategorie fix, Task daraus passend rotieren.
    if (isPOI && poiSel !== 'all' && poiSel !== 'trn') {
        const key = `ga_poi_auto_profile_history_${poiSel || cat || 'generic'}`;
        return _pickFromWeightedWithRecentGuard(_poiCategoryTaskPool(poiSel || cat), key, {
            fallback: 'mapping_survey',
            recentLimit: 3
        });
    }

    // Harte Picker-Regeln: explizite APT-Kategorien nicht mischen.
    if (!isPOI && (aptSel === 'club' || cat === 'club')) return 'club_utility';
    // "Cargo (ohne PAX)" bleibt bewusst ein eigener, neutraler Cargo-Flow.
    // "cargo_fragile" darf nur über den expliziten Fragile-Picker gewählt werden.
    if (!isPOI && (aptSel === 'cargo' || cat === 'cargo')) return 'auto';
    if (!isPOI && (aptSel === 'private')) return 'sightseeing_tour';

    const weighted = [];
    const pushMany = (id, n) => { for (let i = 0; i < n; i++) weighted.push(id); };

    if (isPOI) {
        if (poiSel === 'trn' || cat === 'trn') return 'auto';
        // POI Default-Mix (all): breit, aber profilerhaltend.
        pushMany('mapping_survey', 3);
        pushMany('news_coverage', 2);
        pushMany('inspection_infra', 2);
        pushMany('media_photo', 2);
        pushMany('search_and_rescue', 2);
        pushMany('fire_watch', 2);
        pushMany('sightseeing_tour', 1);
        pushMany('historian_guided_tour', 2);
        pushMany('tour_guide_knowledge', 2);
        pushMany('science_bio', 2);
        pushMany('science_geo', 1);
    } else {
        if (aptSel === 'trn' || cat === 'trn') return 'auto';
        if (aptSel === 'charter' || cat === 'charter') return 'auto';
        // APT Default-Mix
        pushMany('sightseeing_tour', 3);
        pushMany('news_coverage', 2);
        pushMany('cargo_fragile', 2);
        pushMany('animal_transport', 1);
        pushMany('medical_transfer', 1);
        pushMany('club_utility', 1);
        // Category-bias
        if (aptSel === 'cargo' || cat === 'cargo') {
            pushMany('club_utility', 2);
            pushMany('news_coverage', 1);
        }
        if (aptSel === 'private' || cat === 'std') {
            pushMany('sightseeing_tour', 2);
        }
        if (aptSel === 'club' || cat === 'club') {
            pushMany('club_utility', 3);
        }
    }

    if (!isPOI && aptSel === 'all' && (!cat || cat === 'all')) {
        return _pickFromWeightedWithRecentGuard(weighted, 'ga_apt_auto_profile_history', {
            fallback: 'auto',
            recentLimit: 4
        });
    }

    if (isPOI && poiSel === 'all' && (!cat || cat === 'all')) {
        return _pickFromWeightedWithRecentGuard(weighted, 'ga_poi_auto_profile_history', {
            fallback: 'mapping_survey',
            recentLimit: 5
        });
    }

    return _pickFromWeighted(weighted, 'auto');
}

const ANIMAL_TRANSPORT_SCENE_OPTIONS = [
    { title: 'CHircusHircusFemale', label: 'Ziege', role: 'animal.grazing', keywords: /ziege|geiss|geiß|bock|goat|hircus/i },
    { title: 'CHircusHircusJuvenile', label: 'junge Ziege', role: 'animal.grazing', keywords: /kitz|jungziege|zicklein/i },
    { title: 'OHemionusFemale', label: 'Reh', role: 'animal.deer', keywords: /reh|hirsch|wildtier|deer|wild/i },
    { title: 'OHemionusJuvenile', label: 'junges Reh', role: 'animal.deer', keywords: /rehkitz|kitz|junges\s+reh/i },
    { title: 'Seagull', label: 'Moewe', role: 'animal.waterfowl', keywords: /möwe|moewe|seagull|wildvogel|vogelstation/i },
    { title: 'Goose', label: 'Gans', role: 'animal.waterfowl', keywords: /gans|goose|wasservogel/i },
    { title: 'Goose', label: 'Gans', role: 'animal.waterfowl', keywords: /ente|enten|duck|mallard|schwan|swan|heimischer\s+wasservogel/i },
    { visible: false, label: 'Schaf-Transportbox', cargoLabel: 'Schaf-Transportbox', cargoTitle: 'Pallet01_03', keywords: /schaf|sheep/i },
    { visible: false, label: 'Luchs-Transportbox', cargoLabel: 'Luchs-Transportbox', cargoTitle: 'Cardboard', keywords: /luchs|lux|lynx/i },
    { visible: false, label: 'Tiertransportbox', cargoLabel: 'Tiertransportbox', cargoTitle: 'Cardboard', keywords: /hund|katze|dackel|welpe|dog|cat/i },
    { visible: false, label: 'Auffangstations-Kiste', cargoLabel: 'Auffangstations-Kiste', cargoTitle: 'Pallet01_03', keywords: /seelöwe|seeloewe|seal|sealion/i },
    { visible: false, label: 'Pferde-Vet-Material', cargoLabel: 'Pferde-Vet-Material', cargoTitle: 'Pallet01_03', keywords: /pferd|gestuet|gestüt|horse/i }
];

function pickAnimalTransportSceneSpec(text = '') {
    const hay = String(text || '');
    const byText = ANIMAL_TRANSPORT_SCENE_OPTIONS.find(opt => opt.keywords && opt.keywords.test(hay));
    if (byText) return byText;
    const safe = ANIMAL_TRANSPORT_SCENE_OPTIONS.filter(opt => opt.visible !== false);
    const seed = Array.from(hay || 'animal_transport').reduce((sum, ch) => ((sum << 5) - sum + ch.charCodeAt(0)) | 0, 0);
    return safe[Math.abs(seed) % safe.length] || safe[0] || ANIMAL_TRANSPORT_SCENE_OPTIONS[0];
}

function normalizeAptArrivalRole({ profileId = '', passenger = null, paxText = '', cargoText = '', mission = null } = {}) {
    const id = String(profileId || passenger?.taskDomain || passenger?.roleProfile || '').toLowerCase();
    const text = [
        id,
        passenger?.role,
        passenger?.taskDomain,
        passenger?.roleProfile,
        paxText,
        cargoText,
        mission?.t,
        mission?.s
    ].filter(Boolean).join(' ').toLowerCase();
    if (!text.trim() || /freeflight|freiflug|kein\s+pax|0\s*pax|\bnone\b/.test(text)) {
        return { role: 'none' };
    }
    if (/medical|medizin|notarzt|blut|notfall/.test(text)) {
        return {
            role: 'medical_handoff',
            roleLabel: 'medizinische Uebergabe',
            expectedBy: 'medizinisches Empfangsteam',
            visibleCue: 'Rettungswagen oder medizinisches Empfangsteam',
            vehicleRole: 'vehicle.emergency.medical',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.medical_kit',
            narrativeHint: 'Am Ziel ist eine ruhige medizinische Uebergabe am Vorfeld geplant.'
        };
    }
    if (/cargo|fracht|logistik|kurier|labor|praezisionsoptik|schutzverpackung/.test(text)) {
        return {
            role: 'cargo_handoff',
            roleLabel: 'Frachtuebergabe',
            expectedBy: 'Frachtkontakt am Vorfeld',
            visibleCue: 'Fracht-Van oder Abholfahrzeug',
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.small_box',
            narrativeHint: 'Am Ziel wartet die Frachtuebergabe an einem sicheren Vorfeld- oder Parkingbereich.'
        };
    }
    if (/animal|tier|veterinaer|tierschutz|transportbox|ziege|reh|hirsch|möwe|moewe|gans|ente|schwan|pferd|wildvogel|auffangstation/.test(text)) {
        const animalSpec = pickAnimalTransportSceneSpec(text);
        const handoffLabel = animalSpec.visible === false
            ? (animalSpec.cargoLabel || animalSpec.label || 'Transportbox')
            : `${animalSpec.label} / Transportbox`;
        return {
            role: 'animal_handoff',
            roleLabel: 'Tiertransport-Uebergabe',
            expectedBy: 'Tierpflege- oder Vereinskontakt',
            visibleCue: `${handoffLabel} am Tierpflege-Van`,
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.animal_transport_box',
            animalSpec,
            narrativeHint: `Am Ziel ist eine stressarme Uebergabe fuer ${handoffLabel} am Vorfeld vorgesehen.`
        };
    }
    if (/news|report|presse|tv|kamera|live/.test(text)) {
        return {
            role: 'media_pickup',
            roleLabel: 'Medien-Abholung',
            expectedBy: 'Redaktions- und Kamerateam',
            visibleCue: 'kleiner Medien-Van mit Kamerateam',
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.small_box',
            narrativeHint: 'Am Ziel wartet ein kleines Redaktions- und Kamerateam mit Medien-Van am Vorfeld.'
        };
    }
    if (/sightseeing|tour|guide|stadtfuehrer|stadtführer|gaeste|gäste/.test(text)) {
        return {
            role: 'tour_pickup',
            roleLabel: 'Tour-Abholung',
            expectedBy: 'lokaler Kontakt oder Shuttle',
            visibleCue: 'kleines Shuttle- oder Abholfahrzeug',
            vehicleRole: 'vehicle.car',
            personRole: 'person.ground_crew',
            equipmentRole: '',
            narrativeHint: 'Am Ziel ist ein lokaler Kontakt am Vorfeld als Treffpunkt vorgesehen.'
        };
    }
    return {
        role: 'club_meetup',
        roleLabel: 'Vereins-/Utility-Treffpunkt',
        expectedBy: 'Vereinskollege oder Platzkontakt',
        visibleCue: 'Vereinskontakt am Vorfeld',
        vehicleRole: 'vehicle.car',
        personRole: 'person.ground_crew',
        equipmentRole: 'cargo.small_box',
        narrativeHint: 'Am Ziel wartet ein Platz- oder Vereinskontakt an einem sicheren Vorfeldbereich.'
    };
}

function buildAptArrivalSceneItems(role = {}) {
    const roleId = String(role?.role || '').toLowerCase();
    const personRole = String(role?.personRole || 'person.ground_crew');
    const vehicleRole = String(role?.vehicleRole || '');
    const equipmentRole = String(role?.equipmentRole || '');
    const vehicleLabel = roleId === 'media_pickup'
        ? 'Medien-Van'
        : (roleId === 'medical_handoff'
            ? 'Medizinisches Empfangsfahrzeug'
            : (roleId === 'cargo_handoff'
                ? 'Fracht-Van'
                : (roleId === 'animal_handoff' ? 'Tierpflege-Van' : 'Abholfahrzeug')));
    const out = [];
    if (vehicleRole) {
        out.push({
            kind: 'arrival_vehicle',
            label: vehicleLabel,
            role: vehicleRole,
            objectTitle: vehicleLabel,
            forwardM: -11,
            rightM: 8,
            hdgOffsetDeg: 205
        });
    }
    if (roleId === 'media_pickup') {
        out.push(
            {
                kind: 'arrival_person_editor',
                label: 'Redaktionsteam',
                role: personRole,
                objectTitle: 'Redaktionsteam',
                forwardM: 2,
                rightM: 5,
                hdgOffsetDeg: 190
            },
            {
                kind: 'arrival_person_camera',
                label: 'Kamerateam',
                role: personRole,
                objectTitle: 'Kamerateam',
                forwardM: 5,
                rightM: 7,
                hdgOffsetDeg: 215
            }
        );
        if (equipmentRole) {
            out.push({
                kind: 'arrival_equipment_camera',
                label: 'Kameraausruestung',
                role: equipmentRole,
                objectTitle: 'Kameraausruestung',
                forwardM: 1,
                rightM: 9
            });
        }
        return out;
    }
    out.push({
        kind: 'arrival_person_1',
        label: role.expectedBy || 'Empfangskontakt',
        role: personRole,
        objectTitle: role.expectedBy || 'Empfangskontakt',
        forwardM: 3,
        rightM: 6,
        hdgOffsetDeg: 200
    });
    if (equipmentRole) {
        const animalSpec = roleId === 'animal_handoff'
            ? (role.animalSpec || pickAnimalTransportSceneSpec(`${role.expectedBy || ''} ${role.visibleCue || ''}`))
            : null;
        const equipmentLabel = roleId === 'cargo_handoff'
            ? 'Frachtuebergabe'
            : (roleId === 'medical_handoff'
                ? 'Medizinische Uebergabekiste'
                : (roleId === 'animal_handoff' ? (animalSpec?.cargoLabel || 'Tiertransportbox') : 'Uebergabeausruestung'));
        const fixedBoxEquipment = roleId === 'medical_handoff' || roleId === 'animal_handoff';
        const equipmentTitle = roleId === 'animal_handoff'
            ? (animalSpec?.cargoTitle || 'Cardboard')
            : (fixedBoxEquipment ? 'Cardboard' : equipmentLabel);
        const equipmentCandidates = fixedBoxEquipment
            ? (roleId === 'animal_handoff' ? [equipmentTitle, 'Cardboard', 'Pallet01_03'] : ['Cardboard'])
            : undefined;
        out.push({
            kind: 'arrival_equipment_1',
            label: equipmentLabel,
            role: equipmentRole,
            objectTitle: equipmentTitle,
            titleCandidates: equipmentCandidates,
            forwardM: 1,
            rightM: 9,
            altOffsetFt: 1
        });
    }
    if (roleId === 'animal_handoff') {
        const animalSpec = role.animalSpec || pickAnimalTransportSceneSpec(`${role.expectedBy || ''} ${role.visibleCue || ''}`);
        if (animalSpec.visible !== false) {
            out.push({
                kind: 'arrival_animal_1',
                label: animalSpec.label || 'Transporttier',
                role: animalSpec.role || 'animal.grazing',
                objectTitle: animalSpec.title || 'CHircusHircusFemale',
                titleCandidates: [animalSpec.title || 'CHircusHircusFemale'],
                forwardM: 4,
                rightM: 9,
                hdgOffsetDeg: 225
            });
        }
    }
    return out;
}

function offsetAptArrivalLatLon(originLat, originLon, hdgDeg, forwardM = 0, rightM = 0) {
    const lat = Number(originLat);
    const lon = Number(originLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const hdg = (Number.isFinite(Number(hdgDeg)) ? Number(hdgDeg) : 0) * Math.PI / 180;
    const f = Number.isFinite(Number(forwardM)) ? Number(forwardM) : 0;
    const r = Number.isFinite(Number(rightM)) ? Number(rightM) : 0;
    const northM = f * Math.cos(hdg) - r * Math.sin(hdg);
    const eastM = f * Math.sin(hdg) + r * Math.cos(hdg);
    const metersPerDegLat = 111320;
    const metersPerDegLon = Math.max(1, metersPerDegLat * Math.cos(lat * Math.PI / 180));
    return {
        lat: lat + northM / metersPerDegLat,
        lon: lon + eastM / metersPerDegLon
    };
}

function representativeAptArrivalAnchor(lat, lon, hdg) {
    const offset = { forwardM: -75, rightM: 95 };
    const shifted = offsetAptArrivalLatLon(lat, lon, hdg, offset.forwardM, offset.rightM);
    return {
        lat: Number.isFinite(Number(shifted?.lat)) ? shifted.lat : lat,
        lon: Number.isFinite(Number(shifted?.lon)) ? shifted.lon : lon,
        offset
    };
}

function buildAptArrivalPlan({ isPOI = false, dest = null, mission = null, passenger = null, paxText = '', cargoText = '', profileId = '', heading = 0 } = {}) {
    if (isPOI) return null;
    const lat = Number(dest?.lat);
    const lon = Number(dest?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const role = normalizeAptArrivalRole({ profileId, passenger, paxText, cargoText, mission });
    if (!role || role.role === 'none') return null;
    const icao = String(dest?.icao || (typeof currentDestICAO !== 'undefined' ? currentDestICAO : '') || '').trim();
    const airportName = String(dest?.n || dest?.name || icao || 'Zielflugplatz').trim();
    const airportElev = (icao && typeof globalAirports !== 'undefined' && globalAirports && globalAirports[icao])
        ? globalAirports[icao].elevation
        : null;
    const rawElev = dest?.elevFt ?? dest?.elevationFt ?? dest?.elevation ?? airportElev ?? (typeof currentDestElev !== 'undefined' ? currentDestElev : null);
    const altFt = Number.isFinite(Number(rawElev)) ? Math.round(Number(rawElev)) : null;
    const hdg = Number.isFinite(Number(heading)) ? Math.round(Number(heading)) : 0;
    const anchor = representativeAptArrivalAnchor(lat, lon, hdg);
    const cues = [
        role.visibleCue,
        'Vorfeld oder sicherer Parking-Bereich',
        'nicht auf Runway, Taxiway oder Gebaeuden'
    ].filter(Boolean);
    return {
        version: 1,
        status: 'planned',
        source: 'airport-representative-offset',
        confidence: 0.4,
        icao,
        airportName,
        anchorType: 'airport_representative',
        semantic: 'apron_or_parking',
        lat: anchor.lat,
        lon: anchor.lon,
        airportLat: lat,
        airportLon: lon,
        representativeOffsetM: anchor.offset,
        altFt,
        hdg,
        role: role.role,
        roleLabel: role.roleLabel,
        expectedBy: role.expectedBy,
        visibleCue: role.visibleCue,
        cues,
        roles: [role.personRole, role.vehicleRole, role.equipmentRole].filter(Boolean),
        items: buildAptArrivalSceneItems(role),
        narrativeHint: role.narrativeHint,
        snapPolicy: {
            prefer: ['taxi_parking', 'apron', 'pavement', 'parking_position'],
            avoid: ['occupied', 'runway', 'taxiway', 'building', 'water'],
            liveResolver: 'simconnect_facility_or_osm_apron'
        },
        debug: 'Repraesentativer Zielflugplatzpunkt bis ein Live-Snap auf SimConnect-Parking/OSM-Apron verfuegbar ist.'
    };
}

function attachAptArrivalPlanToMissionTruth(missionTruth = null, aptArrivalPlan = null) {
    if (!aptArrivalPlan || typeof aptArrivalPlan !== 'object') return missionTruth || null;
    const base = (missionTruth && typeof missionTruth === 'object') ? { ...missionTruth } : {};
    base.arrivalScene = {
        type: 'apt_arrival_plan',
        role: aptArrivalPlan.role || '',
        roleLabel: aptArrivalPlan.roleLabel || '',
        expectedBy: aptArrivalPlan.expectedBy || '',
        anchorType: aptArrivalPlan.anchorType || '',
        source: aptArrivalPlan.source || '',
        confidence: aptArrivalPlan.confidence ?? null,
        lat: aptArrivalPlan.lat,
        lon: aptArrivalPlan.lon,
        altFt: aptArrivalPlan.altFt,
        snapPolicy: aptArrivalPlan.snapPolicy || null,
        items: Array.isArray(aptArrivalPlan.items) ? aptArrivalPlan.items : []
    };
    const cues = Array.isArray(base.visibleCues) ? base.visibleCues.slice() : [];
    (Array.isArray(aptArrivalPlan.cues) ? aptArrivalPlan.cues : []).forEach(cue => {
        const s = String(cue || '').trim();
        if (s && !cues.includes(s)) cues.push(s);
    });
    if (cues.length) base.visibleCues = cues;
    return base;
}

function buildMissionContract({ isPOI = false, requestedProfileId = 'auto', appliedProfileId = 'auto', mission = null, passenger = null, paxText = '', cargoText = '', category = '', targetSceneOverride = undefined, sceneIntentOverride = undefined, sceneAccepted = true, targetGeoContext = null, missionTruth = null, aptArrivalPlan = null, missionPlanV2 = null } = {}) {
    const profile = getMissionTaskProfile(appliedProfileId, isPOI ? 'poi' : 'apt') || getMissionTaskProfile('auto', isPOI ? 'poi' : 'apt');
    const taskDomain = String(passenger?.taskDomain || profile?.taskDomain || 'general').toLowerCase();
    const roleProfile = String(passenger?.roleProfile || profile?.roleProfile || 'general_passenger_v1').toLowerCase();
    const urgencyPriority = (String(passenger?.urgencyPriority || '').toLowerCase() === 'hoch') ? 'hoch' : 'niedrig';
    const title = String(mission?.t || mission?.title || '').trim();
    const story = String(mission?.s || mission?.story || '').trim();
    const rawTargetScene = targetSceneOverride !== undefined ? targetSceneOverride : (mission?.targetScene || passenger?.targetScene || null);
    const targetScene = sanitizeMissionTargetSceneSpec(rawTargetScene, { isPOI, taskDomain, targetGeoContext });
    const sceneIntent = sanitizeMissionSceneIntentSpec(
        sceneIntentOverride !== undefined ? sceneIntentOverride : (mission?.sceneIntent || passenger?.sceneIntent || null),
        { isPOI, taskDomain }
    );
    const summaryBase = profile?.label || (isPOI ? 'POI-Einsatz' : 'A-B Einsatz');
    const summary = `${summaryBase} | ${isPOI ? 'POI' : 'A-B'} | cat:${String(category || 'std')}`;
    const constraints = [
        `Rollenkonsistenz: roleProfile=${roleProfile}, taskDomain=${taskDomain}, urgency=${urgencyPriority}`,
        'Kein Themenmix zwischen Auftrag, PAX und Fracht',
        'Alle Folgeansagen bleiben im gleichen Auftragsrahmen'
    ];
    return {
        requestedProfileId: String(requestedProfileId || 'auto').toLowerCase(),
        appliedProfileId: String(appliedProfileId || 'auto').toLowerCase(),
        summary,
        taskDomain,
        roleProfile,
        urgencyPriority,
        paxText: String(paxText || ''),
        cargoText: String(cargoText || ''),
        missionTitle: title,
        missionStory: story,
        sceneIntent,
        sceneAccepted: !!sceneAccepted,
        targetGeoContext: targetGeoContext || mission?.targetGeoContext || passenger?.targetGeoContext || null,
        missionTruth: attachAptArrivalPlanToMissionTruth(missionTruth || mission?.missionTruth || passenger?.missionTruth || null, aptArrivalPlan),
        missionPlanV2: missionPlanV2 || mission?._missionPlanV2 || mission?.missionPlanV2 || passenger?.missionPlanV2 || null,
        aptArrivalPlan: aptArrivalPlan || mission?.aptArrivalPlan || passenger?.aptArrivalPlan || null,
        targetScene,
        constraints
    };
}

function pickFireWatchExtent(truth, hazardLevel) {
    if (truth !== 'fire') return 'false_alarm';
    const h = Number.isFinite(Number(hazardLevel)) ? Number(hazardLevel) : 3;
    const r = Math.random();
    if (h >= 4) {
        if (r < 0.22) return 'major_fire';
        if (r < 0.58) return 'multi_smoke';
        return 'single_smoke';
    }
    if (h >= 3) {
        if (r < 0.12) return 'major_fire';
        if (r < 0.42) return 'multi_smoke';
        return 'single_smoke';
    }
    if (r < 0.05) return 'major_fire';
    if (r < 0.25) return 'multi_smoke';
    return 'single_smoke';
}

function fireWatchSiteCountForExtent(extent) {
    if (extent === 'major_fire') return 3;
    if (extent === 'multi_smoke') return 2;
    if (extent === 'single_smoke') return 1;
    return 0;
}

function buildFireWatchSmokeSites(dest, altFt, heading, extent) {
    const siteCount = fireWatchSiteCountForExtent(extent);
    if (!siteCount) return [];
    const baseBearing = Number.isFinite(Number(heading)) ? Number(heading) : Math.random() * 360;
    const sites = [];
    for (let i = 0; i < siteCount; i++) {
        const bearing = (baseBearing + 55 + i * 125 + Math.random() * 55) % 360;
        const distM = i === 0 ? Math.random() * 35 : (260 + i * 170 + Math.random() * 160);
        const p = getDestinationPoint(Number(dest.lat), Number(dest.lon), distM / 1852, bearing);
        const denseMajor = extent === 'major_fire';
        sites.push({
            siteId: `smoke-${i + 1}`,
            label: siteCount === 1 ? 'Rauchentwicklung' : `Rauchentwicklung ${i + 1}`,
            objectTitle: 'Chimney_Smoke_V1',
            lat: Number(p.lat),
            lon: Number(p.lon),
            altFt,
            hdg: Math.round((baseBearing + i * 35) % 360),
            count: denseMajor ? 9 : 8,
            radiusM: denseMajor ? 55 : 35
        });
    }
    return sites;
}

function buildFireWatchFireSites(smokeSites, extent, fireConfig = {}) {
    if (!Array.isArray(smokeSites) || smokeSites.length === 0) return [];
    const n = extent === 'major_fire' ? Math.min(2, smokeSites.length) : (extent === 'multi_smoke' ? 1 : 0);
    const ladderTest = fireConfig.testMode === 'offset_ladder' || fireConfig.testMode === 'fire_only_ladder';
    if (!n && !ladderTest) return [];
    const objectTitle = String(fireConfig.objectTitle || 'VO_Fire_R1_40').trim() || 'VO_Fire_R1_40';
    const altOffsetFt = Number.isFinite(Number(fireConfig.altOffsetFt)) ? Math.round(Number(fireConfig.altOffsetFt)) : 0;
    const count = Number.isFinite(Number(fireConfig.count)) ? Math.max(1, Math.min(6, Math.round(Number(fireConfig.count)))) : (extent === 'major_fire' ? 2 : 1);
    const radiusM = Number.isFinite(Number(fireConfig.radiusM)) ? Math.max(0, Math.min(80, Math.round(Number(fireConfig.radiusM)))) : (count > 1 ? 8 : 0);
    if (ladderTest) {
        const base = smokeSites[0];
        const offsets = [80, 40, 0, -40, -80, -120];
        return offsets.map((offset, idx) => {
            const sideM = (idx - (offsets.length - 1) / 2) * 55;
            const p = getDestinationPoint(Number(base.lat), Number(base.lon), Math.abs(sideM) / 1852, sideM >= 0 ? 90 : 270);
            return {
                siteId: `fire-offset-${offset}`,
                smokeSiteId: base.siteId,
                label: `Fire Offset ${offset} ft`,
                objectTitle,
                lat: Number(p.lat),
                lon: Number(p.lon),
                altFt: base.altFt,
                altOffsetFt: offset,
                hdg: base.hdg || 0,
                count: 1,
                radiusM: 0
            };
        });
    }
    return smokeSites.slice(0, n).map((site, idx) => ({
        siteId: `fire-${idx + 1}`,
        smokeSiteId: site.siteId,
        objectTitle,
        lat: site.lat,
        lon: site.lon,
        altFt: site.altFt,
        altOffsetFt,
        hdg: site.hdg || 0,
        count,
        radiusM
    }));
}

function missionAllowsFireWatchScenario({ mission = null, passenger = null } = {}) {
    const taskDomain = String(passenger?.taskDomain || mission?.passenger?.taskDomain || '').toLowerCase();
    const profileId = String(passenger?.roleProfile || mission?.profileId || mission?._appliedProfile || mission?._requestedProfile || '').toLowerCase();
    if (taskDomain === 'fire_watch' || profileId === 'fire_watch') return true;
    if (/(mapping|survey|photogrammetry|sightseeing|tour_guide|cargo|medical|search_and_rescue|rescue|sar)/.test(`${taskDomain} ${profileId}`)) return false;
    const titleStory = normalizeMissionText(`${mission?.t || ''} ${mission?.s || ''}`);
    return /(waldbrand|feuerwacht|rauchfahne|rauchentwicklung|brandherd|brandmeldung|hotspot|fire watch|smoke report)/.test(titleStory);
}

function missionDataAllowsFireWatchScenario(md = null, passenger = null, contract = null) {
    if (!md || typeof md !== 'object') return false;
    return missionAllowsFireWatchScenario({
        passenger: passenger || md?.passenger || contract?.passenger || null,
        mission: {
            t: md?.mission || contract?.missionTitle || contract?.summary || '',
            s: [contract?.missionStory, contract?.summary, md?.poiName, md?.targetName].filter(Boolean).join(' '),
            passenger: passenger || md?.passenger || contract?.passenger || null,
            profileId: contract?.appliedProfileId || contract?.requestedProfileId || md?.appliedProfile || md?.profile || ''
        }
    });
}

function buildFireWatchScenario({ isPOI = false, mission = null, passenger = null, dest = null, poiTerrainFt = null, heading = 0, fireHazard = null } = {}) {
    const isFireMission = isPOI && missionAllowsFireWatchScenario({ mission, passenger });
    if (!isFireMission || !dest || !Number.isFinite(Number(dest.lat)) || !Number.isFinite(Number(dest.lon))) return null;

    const hazardLevel = Number(fireHazard?.level);
    const fireProbability = Number.isFinite(hazardLevel)
        ? Math.max(0.25, Math.min(0.82, 0.18 + hazardLevel * 0.13))
        : 0.55;
    const debugTruthOverride = (typeof window.fireMissionTruthOverride === 'function')
        ? window.fireMissionTruthOverride()
        : null;
    const truth = debugTruthOverride || (Math.random() < fireProbability ? 'fire' : 'false_alarm');
    const debugExtentOverride = (typeof window.fireMissionExtentOverride === 'function')
        ? window.fireMissionExtentOverride()
        : null;
    const extent = (truth === 'fire' && debugExtentOverride && debugExtentOverride !== 'false_alarm')
        ? debugExtentOverride
        : pickFireWatchExtent(truth, hazardLevel);
    const altFt = Number.isFinite(Number(poiTerrainFt))
        ? Math.max(0, Math.round(Number(poiTerrainFt)))
        : Math.max(0, Math.round(Number(dest.elevation ?? currentDestElev ?? currentDepElev ?? 0)));
    const missionId = `fire-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const smokeSites = buildFireWatchSmokeSites(dest, altFt, heading, extent);
    const fireConfig = (typeof window.fireMissionFireOverride === 'function')
        ? (window.fireMissionFireOverride() || {})
        : {};
    const fireSites = buildFireWatchFireSites(smokeSites, extent, fireConfig);
    const fireObjectTitle = String(fireConfig.objectTitle || 'VO_Fire_R1_40').trim() || 'VO_Fire_R1_40';
    const fireAltOffsetFt = Number.isFinite(Number(fireConfig.altOffsetFt)) ? Math.round(Number(fireConfig.altOffsetFt)) : 0;

    return {
        enabled: true,
        type: 'fire_watch',
        missionId,
        truth,
        extent,
        smokeSiteCount: smokeSites.length,
        fireSiteCount: fireSites.length,
        state: 'enroute',
        createdAt: Date.now(),
        debugOverride: [debugTruthOverride || null, debugExtentOverride || null].filter(Boolean).join(',') || null,
        fireProbability: Math.round(fireProbability * 100) / 100,
        paxAwarenessRangeNm: 4,
        confirmRangeNm: 2,
        targetAreaNm: Number(passenger?.targetRadiusNm || 1.5) || 1.5,
        searchDwellSec: Math.max(120, Math.round(Number(passenger?.targetDwellMin || 3) * 60)),
        assessmentDwellSec: 240,
        target: {
            name: String(dest.n || dest.name || 'Zielgebiet'),
            lat: Number(dest.lat),
            lon: Number(dest.lon),
            altFt
        },
        smoke: {
            objectTitle: 'Chimney_Smoke_V1',
            lat: Number(dest.lat),
            lon: Number(dest.lon),
            altFt,
            hdg: Number.isFinite(Number(heading)) ? Math.round(Number(heading)) : 0,
            count: smokeSites[0]?.count || 0,
            radiusM: smokeSites[0]?.radiusM || 0,
            sites: smokeSites,
            spawned: false,
            spawnRequestedAt: 0,
            clearRequestedAt: 0
        },
        fire: {
            enabled: fireSites.length > 0,
            objectTitle: fireObjectTitle,
            altOffsetFt: fireAltOffsetFt,
            count: Number.isFinite(Number(fireConfig.count)) ? Math.round(Number(fireConfig.count)) : null,
            radiusM: Number.isFinite(Number(fireConfig.radiusM)) ? Math.round(Number(fireConfig.radiusM)) : null,
            testMode: fireConfig.testMode || null,
            sites: fireSites
        },
        observations: []
    };
}

function missionMatchesTaskProfile(missionLike, profileId, isPOI = false) {
    const id = String(profileId || 'auto').toLowerCase();
    if (!id || id === 'auto') return true;
    const expectedProfile = getMissionTaskProfile(id, isPOI ? 'poi' : 'apt') || null;
    const rp = String(missionLike?.passenger?.roleProfile || '').toLowerCase().trim();
    const td = String(missionLike?.passenger?.taskDomain || '').toLowerCase().trim();
    if (expectedProfile && (rp || td)) {
        const rpOk = !expectedProfile.roleProfile || rp === String(expectedProfile.roleProfile || '').toLowerCase();
        const tdOk = !expectedProfile.taskDomain || td === String(expectedProfile.taskDomain || '').toLowerCase();
        if (rpOk && tdOk) return true;
    }
    const t = normalizeMissionText(missionLike?.t || missionLike?.title || '');
    const s = normalizeMissionText(missionLike?.s || missionLike?.story || '');
    const hay = `${t} ${s}`;
    const has = (re) => re.test(hay);

    if (id === 'medical_transfer') {
        return has(/organtransport|medicine emergency|medizin|medical|notfall|blut|plasma|anti serum|klinik|arzt|notarzt|labor kurier/);
    }
    if (id === 'cargo_fragile') {
        return has(/aog|ersatzteil|fracht|transport|kurier|urgent mail|high priority courier|archive transport|art transfer|uhren|flower delivery|labor/);
    }
    if (id === 'animal_transport') {
        return has(/hund|hunderettung|welpen|katze|ziege|reh|hirsch|möwe|moewe|gans|ente|schwan|pferd|wildvogel|auffangstation|tier|tierarzt|horse vet|animal|tierrettung/);
    }
    if (id === 'news_coverage') {
        if (isPOI) return has(/report|medien|kamera|dreh|event|lage|dokument|live|beobacht/);
        return has(/report|medien|kamera|dreh|event|verkehr|stau|city|festival|skydiver/);
    }
    if (id === 'sightseeing_tour') {
        const positive = has(/ausflug|stadtetrip|stadttrip|sightseeing|panorama|rundflug|aussicht|kuchen|burger|wellness|romant|tour/);
        const negative = has(/aog|ersatzteil|organtransport|medicine|notfall|urgent|kurier|fracht|transport/);
        return positive && !negative;
    }
    if (id === 'tour_guide_knowledge') {
        const positive = has(/bildungsflug|wissensflug|lernflug|fakten|einordnung|hintergrund|geschichte des ortes|kultur|reiseguide|ortskunde/);
        const negative = has(/sar|search|rescue|rettung|hotspot|brand|rauch|feuer|notfall|inspekt|schaden|riss|vermess/);
        return positive && !negative;
    }
    if (id === 'historian_guided_tour') {
        const positive = has(/histor|geschichte|zeitreise|denkmal|kultur|stadtfuehr|stadtfuehrung|schloss|burg|turm|fluss|tal|berg/);
        const negative = has(/sar|search|rescue|rettung|hotspot|brand|rauch|feuer|notfall/);
        return positive && !negative;
    }
    if (id === 'science_bio') {
        const positive = has(/biolog|oekolog|ökolog|naturschutz|umwelt|vegetation|fauna|flora|habitat|gewasser|gewaesser/);
        const negative = has(/sar|search|rescue|rettung|hotspot|brand|rauch|feuer|notfall/);
        return positive && !negative;
    }
    if (id === 'science_geo') {
        const positive = has(/geolog|geomorph|erosion|relief|hang|sediment|gestein|tal|berg|bruchkante/);
        const negative = has(/sar|search|rescue|rettung|hotspot|brand|rauch|feuer|notfall/);
        return positive && !negative;
    }
    if (id === 'mapping_survey') {
        return has(/scan|vermess|lidar|photogram|kartier|topo|mess|dokumentation/);
    }
    if (id === 'inspection_infra') {
        return has(/inspekt|prüfung|pruef|wartung|schaden|sturm|stör|stoer|baufortschritt|zustand|waermebild|wärmebild|brueck|bruck|viadukt|pfeiler|widerlager|fundament|sperrung|unterfuehr|unterführ|hochstrass|hochstraß|damm|talsperre|industrie|anlage|infrastruktur|trasse/);
    }
    if (id === 'media_photo') {
        const positive = has(/foto|film|kamera|luftbild|aufnahmen|shots|dreh|pr|medien|jahresbericht|firmen|doku/);
        const negative = has(/sar|search|rescue|rettung|hotspot|brand|rauch|feuer|notfall/);
        return positive && !negative;
    }
    if (id === 'search_and_rescue') {
        return has(/sar|search|rescue|rettung|vermisst|suchmuster|einsatz|lagebild|polizei support/);
    }
    if (id === 'fire_watch') {
        return has(/brand|rauch|hotspot|feuer|waldbrand|fruhwarn|aufklar/);
    }
    return true;
}

function _pickUniqueTrainingItems(pool, count, used = new Set()) {
    const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
    const shuffled = src
        .filter(item => !used.has(item))
        .sort(() => Math.random() - 0.5);
    const out = [];
    for (const item of shuffled) {
        out.push(item);
        used.add(item);
        if (out.length >= count) break;
    }
    return out;
}

function _isPatternFocusItem(text) {
    const s = String(text || '').toLowerCase();
    return /pattern|platzrunde|touch|go-around|missed|no-flap|engine-out|anflug|landung|final/.test(s);
}

function buildDistributedTrainingPlan(seedMode = 'airwork') {
    const totalCount = 2 + Math.floor(Math.random() * 3); // 2..4
    const preferPattern = String(seedMode || '').toLowerCase() === 'pattern';
    let patternCount = 0;

    if (preferPattern) {
        patternCount = Math.min(totalCount - 1, totalCount >= 4 ? 2 : 1);
    } else if (totalCount >= 3 && Math.random() < 0.55) {
        // Airwork bleibt dominant, aber oft mit einer Landeuebung gemischt.
        patternCount = 1;
    }
    const airworkCount = Math.max(1, totalCount - patternCount);
    const used = new Set();
    const focus = [
        ..._pickUniqueTrainingItems(TRAINING_AIRWORK_ITEMS, airworkCount, used),
        ..._pickUniqueTrainingItems(TRAINING_PATTERN_ITEMS, patternCount, used)
    ];
    const mode = patternCount > 0 ? 'pattern' : 'airwork';
    const trigger = mode === 'pattern' ? 'five_nm_before_landing' : 'half_route';
    const instructorLine = mode === 'pattern'
        ? 'Wir machen erst die Uebungen in der Luft und gehen dann in eine Landeuebung am Platz.'
        : 'Wir bleiben heute beim Airwork: sauber, ruhig und mit klarem Ablauf.';
    return { mode, trigger, focus, instructorLine };
}

function sanitizeTrainingPlan(rawPlan, isTrainingMission) {
    if (!isTrainingMission) return null;
    if (!rawPlan || typeof rawPlan !== 'object') {
        return buildDistributedTrainingPlan('airwork');
    }
    const modeRaw = String(rawPlan.mode || '').toLowerCase();
    const requestedMode = (modeRaw === 'airwork' || modeRaw === 'pattern') ? modeRaw : 'airwork';
    const focusRaw = Array.isArray(rawPlan.focus) ? rawPlan.focus : [];
    let focus = focusRaw
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 4);
    // Trainingsvielfalt erzwingen: insgesamt 2-4 Manoever, oft Airwork + optional 1 Pattern.
    if (focus.length < 2) {
        const fallback = buildDistributedTrainingPlan(requestedMode);
        focus = fallback.focus;
    } else {
        const hasPattern = focus.some(_isPatternFocusItem);
        if (!hasPattern && focus.length >= 3 && requestedMode === 'airwork' && Math.random() < 0.45) {
            const add = _pickUniqueTrainingItems(TRAINING_PATTERN_ITEMS, 1, new Set(focus));
            focus = focus.concat(add).slice(0, 4);
        }
    }
    const mode = focus.some(_isPatternFocusItem) ? 'pattern' : requestedMode;
    const triggerRaw = String(rawPlan.trigger || '').toLowerCase();
    const trigger = (triggerRaw === 'half_route' || triggerRaw === 'five_nm_before_landing')
        ? triggerRaw
        : (mode === 'pattern' ? 'five_nm_before_landing' : 'half_route');
    const instructorLine = String(rawPlan.instructorLine || '').trim().slice(0, 220);
    const instructorFallback = mode === 'pattern'
        ? 'Heute mit gemischtem Programm: Airwork im Uebungsgebiet, dann eine saubere Landeuebung am Platz.'
        : 'Heute konzentrieren wir uns auf Airwork mit ruhigem, sauberem Ablauf.';
    return { mode, trigger, focus, instructorLine: instructorLine || instructorFallback };
}

function formatPaxBriefingText(paxText, passenger) {
    const base = String(paxText || '').trim();
    const name = String(passenger?.name || '').trim();
    const role = String(passenger?.role || '').trim();
    if (!base || !name) return base;
    if (/^\s*0\s*PAX\b/i.test(base)) return base;
    if (base.toLowerCase().includes(name.toLowerCase())) return base;
    const m = base.match(/^(.*)\(([^)]*)\)\s*$/);
    if (m) {
        const left = String(m[1] || '').trim();
        const inner = String(m[2] || '').trim();
        const descriptor = role || inner;
        if (!descriptor) return `${left} (${name})`.trim();
        return `${left} (${descriptor}: ${name})`.trim();
    }
    return `${base} (${name})`;
}

function missionHasPassengerByPaxText(paxText) {
    const txt = String(paxText || '').trim();
    if (!txt) return true;
    const m = txt.match(/^\s*(\d+)\s*PAX\b/i);
    if (m) return parseInt(m[1], 10) > 0;
    return !/^\s*0\s*PAX\b/i.test(txt);
}

function missionSceneTargetKindCatalog() {
    const fromAssetCatalog = window.MISSION_SCENE_ASSETS?.targetSceneKinds;
    if (fromAssetCatalog && typeof fromAssetCatalog === 'object') return fromAssetCatalog;
    return {
        none: { roles: [] },
        fire_watch: { roles: ['vfx.smoke', 'vfx.fire'] },
        road_incident: { roles: ['vehicle.car', 'vehicle.emergency.medical', 'marker.cone'] },
        sar_water: { roles: ['sar.liferaft', 'watercraft.small_boat', 'watercraft.service_ship'] },
        sar_land: { roles: ['vehicle.emergency.medical', 'vehicle.quad', 'cargo.container'] },
        medical_pickup: { roles: ['vehicle.emergency.medical', 'cargo.medical_kit'] },
        cargo_site: { roles: ['vehicle.truck', 'cargo.container', 'cargo.pallet_medium', 'cargo.animal_transport_box'] },
        construction_site: { roles: ['construction.crane', 'construction.earthmoving', 'vehicle.truck', 'cargo.pallet_medium', 'cargo.pallet_small'] },
        powerline_inspection: { roles: ['utility.powerline', 'utility.generator', 'vehicle.truck'] },
        wind_turbine_site: { roles: ['utility.wind_turbine', 'vehicle.truck', 'marker.cone'] },
        erosion_damage: { roles: ['nature.log', 'debris.light'] },
        debris_field: { roles: ['debris.light', 'cargo.small_box'] },
        infra_bridge: { roles: ['vehicle.truck', 'marker.cone'] },
        infra_dam: { roles: ['marker.cone', 'utility.generator', 'watercraft.small_boat'] },
        industry_site: { roles: ['vehicle.truck', 'cargo.container', 'utility.generator'] },
        water_pollution: { roles: ['watercraft.small_boat', 'nature.log', 'animal.waterfowl'] },
        water_context: { roles: ['watercraft.small_boat', 'nature.log', 'animal.waterfowl'] },
        wildlife_site: { roles: ['nature.log', 'animal.wildlife', 'animal.grazing', 'animal.waterfowl', 'debris.light'] },
        media_site: { roles: ['vehicle.van', 'cargo.small_box'] },
        event_site: { roles: ['vehicle.bus', 'vehicle.van', 'marker.cone'] },
        survey_context: { roles: ['marker.cone', 'nature.log', 'debris.light'] }
    };
}

function missionSceneTargetPresetCatalog() {
    const fromAssetCatalog = window.MISSION_SCENE_ASSETS?.targetScenePresets;
    if (fromAssetCatalog && typeof fromAssetCatalog === 'object') return fromAssetCatalog;
    return {
        construction_powerline: { kind: 'construction_site', features: ['powerline', 'generator', 'cones'] },
        wind_turbine_construction: { kind: 'wind_turbine_site', features: ['wind_turbine', 'construction_truck'] },
        road_incident_smoke: { kind: 'road_incident', features: ['smoke_light', 'emergency_response', 'debris'] },
        erosion_debris: { kind: 'erosion_damage', features: ['logs', 'debris', 'cones'] },
        bridge_worksite: { kind: 'infra_bridge', features: ['utility_truck', 'generator', 'cones'] },
        industry_smoke: { kind: 'industry_site', features: ['smoke_light', 'cargo_material', 'utility_truck'] },
        water_sar_ship: { kind: 'sar_water', features: ['liferaft', 'service_ship'] },
        event_traffic: { kind: 'event_site', features: ['bus', 'road_vehicles', 'cones'] },
        wildlife_herd: { kind: 'wildlife_site', features: ['wildlife_animals', 'animal_herd'] }
    };
}

function missionSceneTargetFeatureCatalog() {
    const fromAssetCatalog = window.MISSION_SCENE_ASSETS?.targetSceneFeatures;
    if (fromAssetCatalog && typeof fromAssetCatalog === 'object') return fromAssetCatalog;
    return {
        construction_crane: { roles: ['construction.crane'] },
        earthmoving: { roles: ['construction.earthmoving'] },
        construction_truck: { roles: ['vehicle.truck'] },
        cargo_material: { roles: ['cargo.container', 'cargo.pallet_large', 'cargo.pallet_medium', 'cargo.pallet_small', 'cargo.small_box'] },
        pallet_stack: { roles: ['cargo.pallet_medium', 'cargo.pallet_small', 'cargo.pallet_large'] },
        powerline: { roles: ['utility.powerline', 'utility.generator', 'vehicle.truck', 'marker.cone'] },
        wind_turbine: { roles: ['utility.wind_turbine'] },
        generator: { roles: ['utility.generator'] },
        utility_truck: { roles: ['vehicle.truck', 'vehicle.van'] },
        road_vehicles: { roles: ['vehicle.car', 'vehicle.van'] },
        emergency_response: { roles: ['vehicle.emergency.medical', 'person.ground_crew', 'marker.cone'] },
        people: { roles: ['person.ground_crew'] },
        cones: { roles: ['marker.cone'] },
        debris: { roles: ['debris.light', 'cargo.small_box', 'cargo.pallet_small'] },
        logs: { roles: ['nature.log', 'material.log'] },
        liferaft: { roles: ['sar.liferaft'] },
        watercraft: { roles: ['watercraft.small_boat'] },
        service_ship: { roles: ['watercraft.service_ship', 'watercraft.ship'] },
        waterfowl: { roles: ['animal.waterfowl', 'animal.bird'] },
        wildlife_animals: { roles: ['animal.wildlife', 'animal.deer'] },
        animal_herd: { roles: ['animal.grazing'] },
        tent: { roles: ['camp.tent'] },
        parked_vehicle: { roles: ['vehicle.car'] },
        small_equipment: { roles: ['cargo.small_box'] },
        campfire: { roles: ['vfx.fire'] },
        bus: { roles: ['vehicle.bus'] },
        smoke_light: { roles: ['vfx.smoke'] },
        fire_small: { roles: ['vfx.fire'] }
    };
}

function normalizeMissionTargetSceneKind(value) {
    const s = String(value || '').trim().toLowerCase();
    if (!s || /^(none|no|off|false|null|keine|kein)$/i.test(s)) return 'none';
    const aliases = {
        accident: 'road_incident',
        traffic: 'road_incident',
        traffic_site: 'road_incident',
        water_sar: 'sar_water',
        land_sar: 'sar_land',
        medical_site: 'medical_pickup',
        cargo: 'cargo_site',
        construction: 'construction_site',
        building_site: 'construction_site',
        powerline: 'powerline_inspection',
        power_pylon: 'powerline_inspection',
        pylon: 'powerline_inspection',
        wind_turbine: 'wind_turbine_site',
        wind_turbine_site: 'wind_turbine_site',
        windrad: 'wind_turbine_site',
        windkraft: 'wind_turbine_site',
        windpark: 'wind_turbine_site',
        erosion: 'erosion_damage',
        shore_damage: 'erosion_damage',
        landslide: 'erosion_damage',
        debris: 'debris_field',
        bridge: 'infra_bridge',
        dam: 'infra_dam',
        industry: 'industry_site',
        water: 'water_pollution',
        water_context: 'water_context',
        shoreline: 'water_context',
        waterline: 'water_context',
        wildlife: 'wildlife_site',
        animals: 'wildlife_site',
        nature: 'wildlife_site',
        media: 'media_site',
        event: 'event_site',
        survey: 'survey_context',
        survey_site: 'survey_context'
    };
    const normalized = aliases[s] || s;
    const catalog = missionSceneTargetKindCatalog();
    return catalog[normalized] ? normalized : 'none';
}

function normalizeMissionTargetScenePreset(value) {
    const s = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) return '';
    const aliases = {
        construction_with_powerline: 'construction_powerline',
        baustelle_strommast: 'construction_powerline',
        wind_turbine_construction: 'wind_turbine_construction',
        windrad_bau: 'wind_turbine_construction',
        windrad_baustelle: 'wind_turbine_construction',
        windkraft_baustelle: 'wind_turbine_construction',
        road_smoke: 'road_incident_smoke',
        accident_smoke: 'road_incident_smoke',
        erosion_logs: 'erosion_debris',
        bridge_service: 'bridge_worksite',
        industrial_smoke: 'industry_smoke',
        sar_water_ship: 'water_sar_ship',
        event_shuttle: 'event_traffic'
    };
    const normalized = aliases[s] || s;
    const catalog = missionSceneTargetPresetCatalog();
    return catalog[normalized] ? normalized : '';
}

function normalizeMissionTargetSceneFeature(value) {
    const s = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) return '';
    const aliases = {
        crane: 'construction_crane',
        kran: 'construction_crane',
        dozer: 'earthmoving',
        bulldozer: 'earthmoving',
        bagger: 'earthmoving',
        material: 'cargo_material',
        cargo: 'cargo_material',
        pallets: 'pallet_stack',
        pallet: 'pallet_stack',
        paletten: 'pallet_stack',
        palette: 'pallet_stack',
        pallet_stack: 'pallet_stack',
        material_stack: 'pallet_stack',
        materiallager: 'pallet_stack',
        power: 'powerline',
        power_pylon: 'powerline',
        pylon: 'powerline',
        strommast: 'powerline',
        freileitung: 'powerline',
        wind_turbine: 'wind_turbine',
        windrad: 'wind_turbine',
        windraeder: 'wind_turbine',
        windrader: 'wind_turbine',
        windkraft: 'wind_turbine',
        windpark: 'wind_turbine',
        windenergie: 'wind_turbine',
        utility_vehicle: 'utility_truck',
        service_vehicle: 'utility_truck',
        cars: 'road_vehicles',
        vehicles: 'road_vehicles',
        traffic: 'road_vehicles',
        emergency: 'emergency_response',
        medic: 'emergency_response',
        ambulance: 'emergency_response',
        missing_person: 'missing_person',
        missing: 'missing_person',
        lost_person: 'missing_person',
        vermisste_person: 'missing_person',
        vermisst: 'missing_person',
        person_waving: 'missing_person',
        waving_person: 'missing_person',
        winkende_person: 'missing_person',
        crew: 'people',
        persons: 'people',
        person: 'people',
        marker: 'cones',
        cone: 'cones',
        cones_marker: 'cones',
        truemmer: 'debris',
        rubble: 'debris',
        treibgut: 'logs',
        log: 'logs',
        raft: 'liferaft',
        boat: 'watercraft',
        boats: 'watercraft',
        small_boat: 'watercraft',
        small_watercraft: 'watercraft',
        ship: 'service_ship',
        ships: 'service_ship',
        service_ship: 'service_ship',
        work_ship: 'service_ship',
        coast_guard: 'service_ship',
        kuestenwache: 'service_ship',
        kustwache: 'service_ship',
        arbeitsschiff: 'service_ship',
        birds: 'waterfowl',
        bird: 'waterfowl',
        waterfowl: 'waterfowl',
        wasservoegel: 'waterfowl',
        wasservogel: 'waterfowl',
        enten: 'waterfowl',
        ente: 'waterfowl',
        ducks: 'waterfowl',
        duck: 'waterfowl',
        geese: 'waterfowl',
        goose: 'waterfowl',
        wildlife_animals: 'wildlife_animals',
        wildlife: 'wildlife_animals',
        wildtiere: 'wildlife_animals',
        wildtier: 'wildlife_animals',
        animals: 'wildlife_animals',
        animal: 'wildlife_animals',
        herd: 'animal_herd',
        herde: 'animal_herd',
        grazing: 'animal_herd',
        weidetiere: 'animal_herd',
        camp: 'tent',
        camping: 'tent',
        tent: 'tent',
        tents: 'tent',
        zelt: 'tent',
        zelte: 'tent',
        ufercamp: 'tent',
        shore_camp: 'tent',
        shore_car: 'parked_vehicle',
        shore_vehicle: 'parked_vehicle',
        parking_car: 'parked_vehicle',
        parked_car: 'parked_vehicle',
        parked_vehicle: 'parked_vehicle',
        parkendes_auto: 'parked_vehicle',
        auto_am_ufer: 'parked_vehicle',
        box: 'small_equipment',
        boxes: 'small_equipment',
        equipment: 'small_equipment',
        ausruestung: 'small_equipment',
        picknick: 'small_equipment',
        picnic: 'small_equipment',
        lagerfeuer: 'campfire',
        campfire: 'campfire',
        firepit: 'campfire',
        feuerstelle: 'campfire',
        bus_shuttle: 'bus',
        smoke: 'smoke_light',
        light_smoke: 'smoke_light',
        signal_smoke: 'signal_smoke',
        smoke_signal: 'signal_smoke',
        rauchsignal: 'signal_smoke',
        signalrauch: 'signal_smoke',
        farbiger_rauch: 'signal_smoke',
        fire: 'fire_small',
        small_fire: 'fire_small'
    };
    const normalized = aliases[s] || s;
    const catalog = missionSceneTargetFeatureCatalog();
    return catalog[normalized] ? normalized : '';
}

function missionSceneTextHasPowerlineContext(text = '') {
    const t = String(text || '').toLowerCase();
    return /(strommast|stromtrasse|stromleitung|freileitung|hochspann|hochspannung|powerline|power\s+line|power\s+pylon|power\s+tower|umspannwerk|transformator|energieinfrastruktur|leitungsmast|stromnetz)/.test(t);
}

function missionSceneTextHasWindTurbineContext(text = '') {
    const t = String(text || '').toLowerCase();
    return /(wind_turbine|windrad|windraeder|windräder|windturbine|wind\s+turbine|windkraft|windpark|windenergie|rotorblatt|rotor|turbine)/.test(t);
}

function missionSceneTextHasWindTurbineTerrain(text = '') {
    const t = String(text || '').toLowerCase();
    return /(berg|gipfel|ruecken|rücken|kuppe|hochflaeche|hochfläche|hoehe|höhe|wiese|wiesen|feld|felder|acker|farmland|meadow|offenes gelaende|offenes gelände|weide|landwirtschaft)/.test(t);
}

function missionSceneTextHasWindTurbineBadTerrain(text = '') {
    const t = String(text || '').toLowerCase();
    return /(stadt|innenstadt|city|wohngebiet|siedlung|urban|bebauung|tal|talsohle|schlucht|enge lage|industriegebiet)/.test(t);
}

function missionSceneGeoAllowsWindTurbine(ctx = null) {
    const anchors = ctx?.anchors || {};
    const meadow = Number(anchors.meadow?.distM);
    const farmland = Number(anchors.farmland?.distM);
    const openM = Math.min(Number.isFinite(meadow) ? meadow : Infinity, Number.isFinite(farmland) ? farmland : Infinity);
    const building = Number(anchors.building?.distM);
    const urbanClose = Number.isFinite(building) && building < 180 && !(Number.isFinite(openM) && openM <= building + 80);
    return Number.isFinite(openM) && openM < 450 && !urbanClose;
}

function missionSceneAllowsWindTurbine(text = '', ctx = null) {
    if (!missionSceneTextHasWindTurbineContext(text)) return false;
    if (missionSceneTextHasWindTurbineBadTerrain(text)) return false;
    return missionSceneTextHasWindTurbineTerrain(text) || missionSceneGeoAllowsWindTurbine(ctx);
}

function missionSceneSpecialFeatureAllowed(feature, { powerlineAllowed = false, windTurbineAllowed = false } = {}) {
    if (feature === 'powerline') return powerlineAllowed;
    if (feature === 'wind_turbine') return windTurbineAllowed;
    return true;
}

function missionSceneSpecialRoleAllowed(role, { powerlineAllowed = false, windTurbineAllowed = false } = {}) {
    if (role === 'utility.powerline') return powerlineAllowed;
    if (role === 'utility.wind_turbine') return windTurbineAllowed;
    return true;
}

function missionSceneRequirementCountLimit(feature, kind = '') {
    const f = String(feature || '').toLowerCase();
    const k = String(kind || '').toLowerCase();
    if (f === 'pallet_stack') return k === 'construction_site' ? 8 : 6;
    if (f === 'cargo_material') return k === 'construction_site' ? 8 : 6;
    if (f === 'cones') return 8;
    return 6;
}

function missionSceneDefaultArrangement(feature, kind = '', layout = '') {
    const f = String(feature || '').toLowerCase();
    const k = String(kind || '').toLowerCase();
    const l = String(layout || '').toLowerCase();
    if (f === 'pallet_stack' || (f === 'cargo_material' && k === 'construction_site')) return 'cluster';
    if (f === 'cones' && (l === 'perimeter' || k === 'road_incident' || k === 'construction_site')) return 'perimeter';
    if (f === 'logs' && l === 'waterline') return 'waterline';
    if (f === 'waterfowl') return 'cluster';
    return '';
}

function sanitizeMissionTargetSceneSpec(raw, { isPOI = false, taskDomain = '', targetGeoContext = null } = {}) {
    if (!isPOI) return { kind: 'none', roles: [], density: 'none', notes: '' };
    const src = raw && typeof raw === 'object' ? raw : {};
    const task = String(taskDomain || '').toLowerCase();
    const natureTask = missionTruthIsNatureTask('', task);
    const rawSceneText = [
        src.kind,
        src.type,
        src.preset,
        src.notes,
        src.reason,
        src.context,
        Array.isArray(src.features) ? src.features.join(' ') : '',
        Array.isArray(src.roles) ? src.roles.join(' ') : '',
        Array.isArray(src.requirements) ? src.requirements.map(req => typeof req === 'string' ? req : `${req?.feature || ''} ${req?.notes || ''} ${req?.placement || ''}`).join(' ') : '',
        targetGeoContext?.summary || ''
    ].join(' ').toLowerCase();
    const powerlineAllowed = missionSceneTextHasPowerlineContext(rawSceneText);
    const windTurbineAllowed = missionSceneAllowsWindTurbine(rawSceneText, targetGeoContext);
    const explicitRoadIncident = /unfall|crash|kollision|verkehrsunfall|fahrzeugschaden|sperrung|einsatzlage/.test(rawSceneText);
    const suppressNatureRoadNoise = natureTask && !explicitRoadIncident && /road_incident|road_vehicles|parked_vehicle|powerline|generator|traffic|strasse|straße/.test(rawSceneText);
    const noisyNatureFeatures = new Set(['road_vehicles', 'parked_vehicle', 'emergency_response', 'cones', 'powerline', 'generator']);
    let preset = normalizeMissionTargetScenePreset(src.preset || src.scenePreset || src.template || '');
    if (preset === 'construction_powerline' && !powerlineAllowed) preset = '';
    if (preset === 'wind_turbine_construction' && !windTurbineAllowed) preset = '';
    const presetSpec = preset ? missionSceneTargetPresetCatalog()[preset] : null;
    let kind = normalizeMissionTargetSceneKind(src.kind || src.type || presetSpec?.kind || '');
    if (task === 'fire_watch') kind = 'fire_watch';
    if (kind === 'powerline_inspection' && !powerlineAllowed) kind = 'survey_context';
    if (kind === 'wind_turbine_site' && !windTurbineAllowed) kind = 'survey_context';
    if (suppressNatureRoadNoise && kind === 'road_incident') kind = 'survey_context';
    const catalog = missionSceneTargetKindCatalog();
    const featureCatalog = missionSceneTargetFeatureCatalog();
    const spec = catalog[kind] || catalog.none || { roles: [] };
    const featuresRaw = [
        ...(Array.isArray(presetSpec?.features) ? presetSpec.features : []),
        ...(Array.isArray(src.features) ? src.features : []),
        ...(Array.isArray(src.modifiers) ? src.modifiers : [])
    ];
    const requirementsRaw = Array.isArray(src.requirements)
        ? src.requirements
        : (Array.isArray(src.specialRequirements) ? src.specialRequirements : []);
    const requirements = requirementsRaw
        .map(req => {
            if (typeof req === 'string') {
                const feature = normalizeMissionTargetSceneFeature(req);
                return feature ? { feature, count: 1, placement: '', notes: '' } : null;
            }
            if (!req || typeof req !== 'object') return null;
            const feature = normalizeMissionTargetSceneFeature(req.feature || req.kind || req.type || req.name || req.role || '');
            if (!feature) return null;
            const countLimit = missionSceneRequirementCountLimit(feature, kind);
            const count = Math.max(1, Math.min(countLimit, Math.round(Number(req.count || req.qty || req.amount || 1) || 1)));
            const arrangementRaw = String(req.arrangement || req.layout || req.pattern || '').trim().toLowerCase();
            const arrangement = /^(cluster|scattered|line|roadside|waterline|perimeter|mixed)$/.test(arrangementRaw)
                ? arrangementRaw
                : missionSceneDefaultArrangement(feature, kind, String(src.layout || src.arrangement || ''));
            return {
                feature,
                count,
                placement: String(req.placement || req.position || req.where || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                arrangement,
                notes: String(req.notes || req.reason || req.detail || '').replace(/\s+/g, ' ').trim().slice(0, 100)
            };
        })
        .filter(Boolean)
        .filter(req => missionSceneSpecialFeatureAllowed(req.feature, { powerlineAllowed, windTurbineAllowed }))
        .filter(req => !suppressNatureRoadNoise || !noisyNatureFeatures.has(req.feature))
        .slice(0, 8);
    const features = [...new Set(featuresRaw
        .map(normalizeMissionTargetSceneFeature)
        .concat(requirements.map(req => req.feature))
        .filter(Boolean)
        .filter(feature => missionSceneSpecialFeatureAllowed(feature, { powerlineAllowed, windTurbineAllowed }))
        .filter(feature => !suppressNatureRoadNoise || !noisyNatureFeatures.has(feature)))]
        .slice(0, 10);
    const rolesRaw = Array.isArray(src.roles) ? src.roles : (Array.isArray(src.sceneRoles) ? src.sceneRoles : []);
    const allowedRoles = new Set([
        ...Object.keys(window.MISSION_SCENE_ASSETS?.roles || {}),
        ...Object.values(catalog).flatMap(entry => Array.isArray(entry.roles) ? entry.roles : []),
        ...Object.values(featureCatalog).flatMap(entry => Array.isArray(entry.roles) ? entry.roles : [])
    ]);
    const roles = rolesRaw
        .map(role => String(role || '').trim())
        .filter(role => role && allowedRoles.has(role))
        .filter(role => missionSceneSpecialRoleAllowed(role, { powerlineAllowed, windTurbineAllowed }))
        .filter(role => !suppressNatureRoadNoise || !/^(vehicle\.|utility\.|marker\.cone)/.test(role))
        .slice(0, 8);
    const featureRoles = features.flatMap(feature => Array.isArray(featureCatalog[feature]?.roles) ? featureCatalog[feature].roles : []);
    const derivedRoles = [...new Set(featureRoles)]
        .filter(role => allowedRoles.has(role))
        .filter(role => missionSceneSpecialRoleAllowed(role, { powerlineAllowed, windTurbineAllowed }))
        .slice(0, 12);
    const densityRaw = String(src.density || '').trim().toLowerCase();
    const density = /^(sparse|normal|busy|none)$/.test(densityRaw) ? densityRaw : (kind === 'none' ? 'none' : 'normal');
    const layoutRaw = String(src.layout || src.arrangement || '').trim().toLowerCase();
    const layout = /^(cluster|scattered|line|roadside|waterline|perimeter|mixed)$/.test(layoutRaw) ? layoutRaw : '';
    const notes = String(src.notes || src.reason || src.context || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    return {
        preset,
        kind,
        features,
        requirements,
        roles: roles.length ? roles : derivedRoles,
        density,
        layout,
        notes
    };
}

function sanitizeMissionSceneIntentSpec(raw, { isPOI = false, taskDomain = '' } = {}) {
    const task = String(taskDomain || '').toLowerCase();
    if (!isPOI) {
        return {
            summary: 'A-B-Flug ohne Zielszene.',
            environment: '',
            visibleIdeas: [],
            avoid: [],
            densityHint: 'none',
            notes: ''
        };
    }
    let src = raw;
    if (typeof src === 'string') {
        src = { summary: src };
    } else if (!src || typeof src !== 'object') {
        src = {};
    }
    const cleanText = (value, max = 220) => String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
    const cleanList = (value, maxItems = 8, maxChars = 90) => {
        const arr = Array.isArray(value) ? value : (value ? [value] : []);
        return arr
            .map(item => cleanText(typeof item === 'object' ? (item.summary || item.name || item.feature || item.notes || JSON.stringify(item)) : item, maxChars))
            .filter(Boolean)
            .slice(0, maxItems);
    };
    const densityRaw = String(src.densityHint || src.density || '').trim().toLowerCase();
    const densityHint = /^(none|sparse|normal|busy)$/.test(densityRaw)
        ? densityRaw
        : (task === 'fire_watch' ? 'normal' : 'sparse');
    const summary = cleanText(src.summary || src.scene || src.description || src.intent || src.notes || '', 260);
    return {
        summary,
        environment: cleanText(src.environment || src.terrain || src.setting || src.context || '', 120),
        visibleIdeas: cleanList(src.visibleIdeas || src.visible || src.objects || src.groundContext || src.sceneElements || [], 10, 100),
        avoid: cleanList(src.avoid || src.doNotAdd || src.exclude || [], 8, 90),
        densityHint,
        notes: cleanText(src.notes || src.reason || src.rationale || '', 220)
    };
}

function buildMissionSceneIntentPromptGuide(isPOI, forcedProfile = null) {
    if (!isPOI) {
        return `17. SCENE-INTENT: Gib sceneIntent.summary als "A-B-Flug ohne Zielszene" aus, densityHint="none", visibleIdeas=[] und avoid=[]. Keine targetScene erzeugen.`;
    }
    const forced = forcedProfile?.taskDomain ? String(forcedProfile.taskDomain).toLowerCase() : '';
    const profileHint = forced
        ? `Profilkontext: ${forced}.`
        : 'Profilkontext aus Story und passenger.taskDomain ableiten.';
    return `17. SCENE-INTENT-PFLICHT: Gib KEINE fertige targetScene aus. Gib stattdessen ein Objekt "sceneIntent" aus: eine knappe Klartext-Beschreibung dessen, was am Ziel aus Missionskontext wirklich sichtbar sein sollte.
${profileHint}
sceneIntent Felder:
- summary: 1-2 Saetze, was im Zielgebiet visuell plausibel ist.
- environment: kurzer Landschafts-/Umgebungstyp, z.B. Wald, Seeufer, Baustelle, Strasse, Industrie, leer.
- visibleIdeas: 0-8 konkrete sichtbare Ideen als Klartext, z.B. "zwei kleine private Boote am Ufer", "ein Zelt und kleine Ausruestung", "ein Baufahrzeug an einer Erdbaustelle", "nur natuerliches Ufer und Wasservoegel". Keine Asset-Namen, keine Kategorien.
- avoid: Dinge, die NICHT auftauchen sollen, wenn sie unplausibel waeren, z.B. "keine Kuestenwache", "keine Einsatzfahrzeuge", "keine Deko".
- densityHint: none|sparse|normal|busy.
- notes: kurzer Grund.
Wichtig: Keine Standard-Deko. Bei Lern-/Sightseeing-Fluegen darf sceneIntent sehr sparsam oder "none" sein. Kleine Kontextdetails sind erlaubt, wenn sie aus dem Text entstehen: Enten, Zelt, parkendes Auto, Holz, Kisten, Lagerfeuer, Tiere, Baufahrzeuge, Unfallfahrzeuge usw.
Spezialobjekte sind keine Deko: Strommast/Freileitung nur bei ausdruecklichem Stromleitungs-, Umspannwerks-, Energieinfrastruktur-, Wartungs-, Inspektions- oder Bau-Kontext. Windrad/Windpark nur bei ausdruecklichem Windenergie-, Neubau-, Wartungs-, Inspektions- oder Bau-Kontext und nur in plausibler offener/hochgelegener Umgebung wie Bergkuppe, Wiese oder Feld; nicht in Stadt, Wohngebiet oder Tal.
Wichtig: Story und sceneIntent muessen denselben Sachverhalt beschreiben. Das gilt fuer alle Missionstypen: Hauptziel, Kontextobjekte und Support muessen zusammenpassen. Wenn visibleIdeas Suchtrupps, Fahrzeuge, Zelte, Rauchsignale, Tiere, Menschen, Werkzeug oder Ausruestung enthalten, muss die Story diese Dinge entweder vorher plausibel machen oder sceneIntent muss erklaeren, warum sie dort sichtbar sind.`;
}

function buildMissionTargetScenePromptGuide(isPOI, forcedProfile = null) {
    const catalog = missionSceneTargetKindCatalog();
    const presets = missionSceneTargetPresetCatalog();
    const features = missionSceneTargetFeatureCatalog();
    const lines = Object.entries(catalog).map(([kind, spec]) => {
        const roles = Array.isArray(spec.roles) ? spec.roles.join(', ') : '';
        const useFor = Array.isArray(spec.useFor) ? ` useFor=${spec.useFor.join('|')}` : '';
        const label = String(spec.label || kind);
        return `- ${kind}: ${label}${roles ? `; roles=[${roles}]` : ''}${useFor}`;
    });
    const presetLines = Object.entries(presets).map(([preset, spec]) => {
        const label = String(spec.label || preset);
        const kind = String(spec.kind || '');
        const featureList = Array.isArray(spec.features) ? spec.features.join(', ') : '';
        return `- ${preset}: ${label}; kind=${kind}${featureList ? `; features=[${featureList}]` : ''}`;
    });
    const featureLines = Object.entries(features).map(([feature, spec]) => {
        const label = String(spec.label || feature);
        const roles = Array.isArray(spec.roles) ? spec.roles.join(', ') : '';
        return `- ${feature}: ${label}${roles ? `; roles=[${roles}]` : ''}`;
    });
    const forced = forcedProfile?.taskDomain ? String(forcedProfile.taskDomain).toLowerCase() : '';
    const defaultHint = forced === 'fire_watch'
        ? 'fire_watch'
        : (forced === 'search_and_rescue'
            ? 'sar_water oder sar_land'
            : (forced === 'mapping_survey' ? 'construction_site, erosion_damage, infra_bridge, infra_dam, wind_turbine_site bei Windenergie-Kontext, powerline_inspection nur bei Strom-/Energie-Kontext oder survey_context' : (forced === 'poi_learning_guide' || forced === 'sightseeing_tour' ? 'none oder sehr sparsam water_context/wildlife_site' : 'passend zum Kontext')));
    return isPOI
        ? `17. TARGET-SCENE-PFLICHT: Gib ein Objekt "targetScene" aus. Wähle genau einen kind als Grundszene und optional ein preset/features/requirements fuer sichtbare Besonderheiten. Die KI entscheidet bewusst, was im Ziel wirklich sichtbar und plausibel ist. Nutze "none" bei reinen Sightseeing-/Historien-/Lernfluegen ohne konkreten sichtbaren Boden-Kontext; fuege keine Deko hinzu, nur weil ein POI eine Kategorie hat. Bei Lern-/Sightseeing-Fluegen: sehr sparsam bleiben, density meist "sparse", count meist 0-3; keine Einsatzfahrzeuge, keine grossen Schiffe, keine Marker/Cones, ausser sie sind im Kontext wirklich sichtbar. Szene und Story muessen logisch dieselbe Lage zeigen: keine Fahrzeuge, Personen, Zelte, Rauchsignale, Tiere, Werkzeug, Ladung oder Absperrungen hinzufuegen, wenn sie weder in Story noch sceneIntent vorkommen. Kleine Bausteine wie tent, parked_vehicle, small_equipment, pallet_stack, campfire, waterfowl, logs oder watercraft sind kontextfreie Vokabeln: nutze sie ueberall dort, wo sie aus der Missionslage plausibel sind (Wald, SAR, Ufer, Baustelle, Unfall, POI), nicht nur in einer festen Katalog-Szene. Spezialobjekte sind keine Deko: powerline/powerline_inspection nur wenn der Auftrag konkret Strommast, Freileitung, Stromtrasse, Umspannwerk, Energieinfrastruktur, Bau, Wartung oder Inspektion nennt; nie fuer generische Survey-/Natur-/Waldkulisse. wind_turbine/wind_turbine_site nur wenn Windrad/Windpark/Windenergie/Bau/Wartung/Inspektion konkret Thema ist und targetGeoContext oder Story offene/hochgelegene Flaeche, Wiese, Feld, Acker, Kuppe oder Gipfel plausibel macht; nicht in Stadt, Wohngebiet, dichter Bebauung oder Tal. Erfinde keine festen Sonder-Szenen; beschreibe stattdessen genau die sichtbaren Einzelobjekte und ihre Anordnung. Allgemeine Szenenlogik: Bestimme zuerst das Primaerziel der Mission, dann Kontextobjekte, dann optional Support. Support-Objekte wie Fahrzeuge, Crew, Technik, Absperrungen oder Material duerfen nur erscheinen, wenn sie die Geschichte tragen und nicht den Auftrag logisch erledigen, bevor der Pilot ankommt. Bei Inspection/Survey sind Messobjekte, Infrastruktur oder Referenzpunkte wichtiger als zufaellige Crew; bei Cargo/Medical muessen Fracht, Uebergabe und Personen zur PAX/Fracht-Lage passen; bei News/Event muessen Fahrzeuge/Menschen aus dem Ereignis hervorgehen; bei Natur/Sightseeing bleibt es ruhig und objektarm. SAR-Land: Wenn die Story eine vermisste Person beschreibt, ist missing_person oder ein klarer Hinweis wie small_equipment/tent/signal_smoke das Primaerziel. Suchtrupps/Fahrzeuge duerfen nur als Support/Perimeter/auf Anfahrt vorkommen, wenn Story oder sceneIntent sie nennen; sie duerfen nicht so wirken, als haetten sie die Person schon gefunden. Wasser-Kontext: water_context nur fuer Ufer/Treibgut/kleine zivile Boote/heimische Wasservoegel. watercraft meint kleine zivile Boote. service_ship/grosse Schiffe nur bei Hafen, SAR, Kuestenwache, Arbeitsschiff oder klarer Textgrundlage. Natur-Kontext: wildlife_site darf passende lokale Tiere, Wasservoegel oder kleine Herden bekommen, aber keine exotischen Tiere ohne klaren Grund. Bei Mapping/Survey steht am Ziel NICHT automatisch ein Techniker mit Auto; der PAX sitzt bei uns im Flugzeug. Wähle stattdessen sichtbare Kontextobjekte: z.B. Baustelle -> construction_site mit Baufahrzeug und gebuendeltem Materiallager, echte Stromtrasse -> powerline_inspection, Windradbau auf offenem Feld -> wind_turbine_site, Uferbruch/Hangrutsch -> erosion_damage, Brücke -> infra_bridge, Staudamm -> infra_dam. Kombis sind erlaubt: z.B. Baustelle => kind="construction_site", layout="cluster", requirements=[{"feature":"earthmoving","count":1},{"feature":"pallet_stack","count":6,"placement":"am Materiallager","arrangement":"cluster"}], Wald-SAR => kind="sar_land", requirements=[{"feature":"missing_person","count":1},{"feature":"small_equipment","count":1},{"feature":"signal_smoke","count":1}], Seeufer-Lernkontext => kind="water_context", requirements=[{"feature":"waterfowl","count":2,"arrangement":"cluster"},{"feature":"parked_vehicle","count":1}] oder nur ["logs"]. Empfehlung fuer dieses Profil: ${defaultHint}.
Erlaubte targetScene.kind:
${lines.join('\n')}
Erlaubte targetScene.preset (optional):
${presetLines.join('\n')}
Erlaubte targetScene.features / requirements[].feature (optional, additiv):
${featureLines.join('\n')}
requirements[].count ist keine Fuellmenge, sondern eine bewusste sichtbare Menge. Wenn unsicher, lieber weniger oder keine Objekte. Fuer Baustellen-/Materiallager duerfen pallet_stack/cargo_material bewusst 6-8 Objekte als gebuendelter Cluster sein. requirements[].arrangement und targetScene.layout optional: cluster|scattered|line|roadside|waterline|perimeter|mixed. density: sparse|normal|busy.`
        : `17. TARGET-SCENE: Bei A-B-Missionen targetScene.kind immer "none" setzen.`;
}

function deriveMissionTargetSceneFromIntent(sceneIntent, { isPOI = false, taskDomain = '', targetGeoContext = null } = {}) {
    if (!isPOI) return sanitizeMissionTargetSceneSpec(null, { isPOI, taskDomain, targetGeoContext });
    const intent = sanitizeMissionSceneIntentSpec(sceneIntent, { isPOI, taskDomain });
    const text = [
        intent.summary,
        intent.environment,
        intent.notes,
        ...(Array.isArray(intent.visibleIdeas) ? intent.visibleIdeas : [])
    ].join(' ').toLowerCase();
    const task = String(taskDomain || '').toLowerCase();
    const has = (re) => re.test(text);
    const natureTask = missionTruthIsNatureTask('', task);
    let kind = 'none';
    if (task === 'fire_watch' || has(/waldbrand|rauch|feuer|brandherd|hotspot/)) kind = 'fire_watch';
    else if (has(/sar|rettung|vermisst|notfall|rettungsinsel|liferaft/)) kind = has(/wasser|see|fluss|ufer|boot|insel/) ? 'sar_water' : 'sar_land';
    else if (natureTask && has(/wald|forst|vegetation|baum|bäume|baeume|natur|bio|oekolog|ökolog|umwelt/)) kind = 'survey_context';
    else if (has(/unfall|crash|kollision|verkehrsunfall|fahrzeugschaden|sperrung/)) kind = 'road_incident';
    else if (missionSceneTextHasPowerlineContext(text)) kind = 'powerline_inspection';
    else if (missionSceneAllowsWindTurbine(text, targetGeoContext)) kind = 'wind_turbine_site';
    else if (has(/baustell|kran|bagger|bulldozer|bauarbeiten|materiallager/)) kind = 'construction_site';
    else if (has(/erosion|uferbruch|hangrutsch|abrutsch|treibholz|bruchkante/)) kind = 'erosion_damage';
    else if (has(/bruecke|brücke|viadukt/)) kind = 'infra_bridge';
    else if (has(/damm|talsperre|staudamm/)) kind = 'infra_dam';
    else if (has(/industrie|werk|fabrik|container|generator/)) kind = 'industry_site';
    else if (has(/wasser|see|fluss|ufer|boot|boote|ente|enten|wasservogel|treibgut/)) kind = 'water_context';
    else if (has(/tier|tiere|wild|herde|reh|hirsch|elch|weide|natur/)) kind = 'wildlife_site';
    else if (has(/event|veranstaltung|bus|shuttle|menschenmenge/)) kind = 'event_site';
    else if (has(/survey|vermessung|inspektion|kontrolle|referenz/)) kind = 'survey_context';

    const featureTests = [
        ['construction_crane', /kran/],
        ['earthmoving', /bagger|bulldozer|erdbeweg/],
        ['construction_truck', /lkw|truck|baustellenfahrzeug/],
        ['cargo_material', /palette|paletten|container|baumaterial|material/],
        ['powerline', /strommast|stromleitung|stromtrasse|freileitung|hochspann|powerline|power\s+pylon|umspannwerk|energieinfrastruktur/],
        ['wind_turbine', /windrad|windraeder|windräder|windturbine|wind\s+turbine|windkraft|windpark|windenergie/],
        ['generator', /generator|stromaggregat/],
        ['road_vehicles', /auto|autos|fahrzeug|fahrzeuge|van|transporter/],
        ['emergency_response', /rettung|polizei|feuerwehr|ambulanz|einsatz/],
        ['missing_person', /vermisst|verloren|gesucht|wink|hilfezeichen|hilferuf/],
        ['people', /person|personen|crew|team|menschen/],
        ['cones', /kegel|absperr|marker|markierung/],
        ['debris', /debris|truemmer|trümmer|schutt|kisten|karton|ausruestung|ausrüstung/],
        ['logs', /holz|log|baumstamm|treibholz/],
        ['liferaft', /rettungsinsel|liferaft/],
        ['watercraft', /boot|boote|kleines boot|private boote/],
        ['service_ship', /schiff|kuestenwache|küstenwache|arbeitsschiff|service/],
        ['waterfowl', /ente|enten|wasservogel|wasservoegel|vogel|voegel|gans|gaense/],
        ['wildlife_animals', /wildtier|wildtiere|reh|hirsch|elch/],
        ['animal_herd', /herde|weidetiere|weide/],
        ['tent', /zelt|zelte|camp|camping|biwak/],
        ['parked_vehicle', /parkendes auto|auto am ufer|parkendes fahrzeug|parkt/],
        ['small_equipment', /ausruestung|ausrüstung|picknick|box|kiste|karton|kleine sachen/],
        ['campfire', /lagerfeuer|feuerstelle|campfire/],
        ['bus', /bus|shuttle/],
        ['signal_smoke', /rauchsignal|signalrauch|farbiger rauch|signalfackel/],
        ['smoke_light', /rauch|rauchfahne|qualm/],
        ['fire_small', /feuer|brandherd|flamme/]
    ];
    const features = [...new Set(featureTests.filter(([, re]) => has(re)).map(([feature]) => feature))].slice(0, 8);
    const requirements = features.slice(0, 6).map(feature => ({
        feature,
        count: /waterfowl|animal_herd|people|road_vehicles/.test(feature) ? 2 : 1,
        placement: '',
        notes: ''
    }));
    return sanitizeMissionTargetSceneSpec({
        kind,
        features,
        requirements,
        density: intent.densityHint || (kind === 'none' ? 'none' : 'sparse'),
        layout: has(/ufer|wasser|see|fluss/) ? 'waterline' : '',
        notes: intent.summary || intent.notes || ''
    }, { isPOI, taskDomain, targetGeoContext });
}

const MISSION_TARGET_GEO_CONTEXT_RADIUS_M = 750;
const MISSION_TARGET_GEO_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000;
const MISSION_SCENE_COMPOSER_MODEL_TIMEOUT_MS = 9000;
const MISSION_SCENE_COMPOSER_TOTAL_TIMEOUT_MS = 18000;
const missionTargetGeoContextInflight = new Map();

function missionTargetGeoContextCacheKey(lat, lon, radiusM = MISSION_TARGET_GEO_CONTEXT_RADIUS_M) {
    const la = Math.round(Number(lat) * 1000) / 1000;
    const lo = Math.round(Number(lon) * 1000) / 1000;
    return `ga_target_geo_context_v2_${la}_${lo}_${Math.round(Number(radiusM) || radiusM)}`;
}

function missionTargetGeoContextCategory(tags = {}) {
    const bridge = String(tags.bridge || '').toLowerCase();
    const manMade = String(tags.man_made || '').toLowerCase();
    if ((bridge && !/^(no|false|0)$/i.test(bridge)) || manMade === 'bridge') return 'bridge';
    const highway = String(tags.highway || '').toLowerCase();
    if (highway) {
        if (/path|footway|cycleway|bridleway|steps|track/.test(highway)) return 'path';
        return 'road';
    }
    if (String(tags.amenity || '').toLowerCase() === 'parking') return 'parking';
    if (tags.waterway || tags.water || /water|reservoir|basin/.test(String(tags.natural || tags.landuse || '').toLowerCase())) return 'water';
    if (/wood|forest/.test(String(tags.natural || tags.landuse || '').toLowerCase())) return 'forest';
    if (/meadow|grassland|grass|village_green/.test(String(tags.natural || tags.landuse || '').toLowerCase())) return 'meadow';
    if (/farmland|farmyard|orchard|vineyard/.test(String(tags.landuse || '').toLowerCase())) return 'farmland';
    if (tags.building) return 'building';
    if (tags.power) return 'power';
    if (tags.railway) return 'railway';
    return '';
}

function missionTargetGeoContextElementPoint(el = {}) {
    const lat = Number(el.lat ?? el.center?.lat);
    const lon = Number(el.lon ?? el.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

function missionTargetGeoContextSimplifyRing(points = [], maxPoints = 28) {
    const clean = (Array.isArray(points) ? points : [])
        .map(p => ({
            lat: Math.round(Number(p.lat) * 1000000) / 1000000,
            lon: Math.round(Number(p.lon) * 1000000) / 1000000
        }))
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (clean.length < 4) return [];
    const last = clean[clean.length - 1];
    const first = clean[0];
    if (Math.abs(first.lat - last.lat) > 0.000001 || Math.abs(first.lon - last.lon) > 0.000001) return [];
    if (clean.length <= maxPoints) return clean;
    const step = Math.ceil((clean.length - 1) / (maxPoints - 1));
    const out = [];
    for (let i = 0; i < clean.length - 1; i += step) out.push(clean[i]);
    out.push(first);
    return out;
}

function missionTargetGeoContextAvoidZone(el = {}, category = '', centerLat = null, centerLon = null) {
    if (category !== 'building' && category !== 'water') return null;
    const tags = el?.tags || {};
    const ring = missionTargetGeoContextSimplifyRing(el?.geometry || []);
    if (ring.length < 4) return null;
    let latSum = 0;
    let lonSum = 0;
    ring.slice(0, -1).forEach(p => {
        latSum += p.lat;
        lonSum += p.lon;
    });
    const count = Math.max(1, ring.length - 1);
    const center = { lat: latSum / count, lon: lonSum / count };
    let radiusM = 0;
    ring.forEach(p => {
        try {
            const dM = Number(calcNav(center.lat, center.lon, p.lat, p.lon)?.dist) * 1852;
            if (Number.isFinite(dM)) radiusM = Math.max(radiusM, dM);
        } catch (_) {}
    });
    const nav = (Number.isFinite(Number(centerLat)) && Number.isFinite(Number(centerLon)))
        ? calcNav(Number(centerLat), Number(centerLon), center.lat, center.lon)
        : null;
    return {
        type: category,
        name: String(tags.name || tags.ref || tags.building || tags.natural || tags.water || tags.landuse || '').slice(0, 60),
        center: {
            lat: Math.round(center.lat * 1000000) / 1000000,
            lon: Math.round(center.lon * 1000000) / 1000000
        },
        radiusM: Math.round(radiusM),
        distM: Number.isFinite(Number(nav?.dist)) ? Math.round(Number(nav.dist) * 1852) : null,
        bearingDeg: Number.isFinite(Number(nav?.brng)) ? Math.round(Number(nav.brng)) : null,
        polygon: ring
    };
}

function summarizeMissionTargetGeoContext(ctx = null) {
    if (!ctx || typeof ctx !== 'object') return '';
    if (ctx.summary) return String(ctx.summary);
    const anchors = ctx.anchors && typeof ctx.anchors === 'object' ? ctx.anchors : {};
    return Object.entries(anchors)
        .filter(([, a]) => a && a.present)
        .map(([k, a]) => `${k}:${Math.round(Number(a.distM) || 0)}m/${Math.round(Number(a.bearingDeg) || 0)}deg`)
        .slice(0, 8)
        .join(', ');
}

function missionTruthDistanceBearing(lat1, lon1, lat2, lon2) {
    const aLat = Number(lat1), aLon = Number(lon1), bLat = Number(lat2), bLon = Number(lon2);
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
    const r = 6371000;
    const phi1 = aLat * Math.PI / 180;
    const phi2 = bLat * Math.PI / 180;
    const dPhi = (bLat - aLat) * Math.PI / 180;
    const dLam = (bLon - aLon) * Math.PI / 180;
    const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    const distM = 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    const y = Math.sin(dLam) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
    const bearingDeg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { distM, bearingDeg };
}

function missionTruthRoundPoint(point = null) {
    const lat = Number(point?.lat);
    const lon = Number(point?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat: Math.round(lat * 1000000) / 1000000,
        lon: Math.round(lon * 1000000) / 1000000
    };
}

function missionTruthAnchorToPoint(anchor = null, origin = null) {
    const lat = Number(origin?.lat);
    const lon = Number(origin?.lon);
    const distM = Number(anchor?.distM);
    const bearingDeg = Number(anchor?.bearingDeg);
    if (![lat, lon, distM, bearingDeg].every(Number.isFinite)) return null;
    return missionTruthRoundPoint(getDestinationPoint(lat, lon, distM / 1852, bearingDeg));
}

function missionTruthClosestPolygonPoint(zone = null, origin = null) {
    const polygon = Array.isArray(zone?.polygon) ? zone.polygon : [];
    const originLat = Number(origin?.lat);
    const originLon = Number(origin?.lon);
    if (!polygon.length || !Number.isFinite(originLat) || !Number.isFinite(originLon)) return null;
    let best = null;
    let bestDistM = Infinity;
    for (const p of polygon) {
        const pt = missionTruthRoundPoint(p);
        if (!pt) continue;
        const nav = missionTruthDistanceBearing(originLat, originLon, pt.lat, pt.lon);
        if (!nav || nav.distM >= bestDistM) continue;
        best = pt;
        bestDistM = nav.distM;
    }
    return best;
}

function missionTruthNearestZone(ctx = null, type = '') {
    const wanted = String(type || '').toLowerCase();
    const zones = Array.isArray(ctx?.avoidZones) ? ctx.avoidZones : [];
    return zones
        .filter(z => String(z?.type || '').toLowerCase() === wanted && z?.center)
        .sort((a, b) => Number(a.distM ?? 999999) - Number(b.distM ?? 999999))[0] || null;
}

function missionTruthRequestedCategory(md = {}) {
    const summary = String(md?.missionContract?.summary || window.activeMissionContract?.summary || '');
    const summaryCat = (summary.match(/cat:([a-z0-9_-]+)/i) || [])[1] || '';
    return String(md.requestedCategory || md.poiRequestedCategory || md.poiCategory || md.category || summaryCat || '').toLowerCase();
}

function missionTruthIsNatureTask(category = '', taskDomain = '') {
    const cat = String(category || '').toLowerCase();
    const task = String(taskDomain || '').toLowerCase();
    return cat === 'fire' || cat === 'mountain' || task === 'fire_watch' || task.includes('science_bio');
}

function missionTruthAnchorForCategory(ctx = null, category = '', taskDomain = '') {
    const anchors = ctx?.anchors && typeof ctx.anchors === 'object' ? ctx.anchors : {};
    const cat = String(category || '').toLowerCase();
    const task = String(taskDomain || '').toLowerCase();
    const natureTask = missionTruthIsNatureTask(cat, task);
    const lists = [];
    if (cat === 'bridge') lists.push(['bridge']);
    if (cat !== 'bridge') {
        if (cat === 'water' || task.includes('science_geo')) lists.push(['water']);
        if (cat === 'infrastructure' || cat === 'telecom' || task.includes('inspection')) lists.push(['power', 'road', 'parking', 'building', 'rail']);
        if (cat === 'industry') lists.push(['building', 'power', 'road', 'parking']);
        if (cat === 'road') lists.push(['road', 'parking', 'building']);
        if (cat === 'rail') lists.push(['rail', 'road', 'building']);
        if (natureTask) lists.push(['forest', 'meadow', 'farmland', 'water']);
        if (task.includes('search_and_rescue')) lists.push(['forest', 'meadow', 'farmland', 'road', 'water']);
        lists.push(natureTask
            ? ['forest', 'meadow', 'farmland', 'water']
            : ['water', 'road', 'parking', 'forest', 'meadow', 'building', 'power']);
    }
    for (const list of lists) {
        for (const key of list) {
            const a = anchors[key];
            if (a && a.present && Number.isFinite(Number(a.distM))) return { key, anchor: a };
        }
    }
    return null;
}

function missionTruthSceneVisibleCues(sceneSpec = null) {
    const text = [
        sceneSpec?.kind,
        sceneSpec?.preset,
        Array.isArray(sceneSpec?.features) ? sceneSpec.features.join(' ') : '',
        Array.isArray(sceneSpec?.roles) ? sceneSpec.roles.join(' ') : '',
        Array.isArray(sceneSpec?.requirements) ? sceneSpec.requirements.map(r => r?.feature).join(' ') : ''
    ].join(' ').toLowerCase();
    const cues = [];
    const add = (cue, re) => {
        if (re.test(text) && !cues.includes(cue)) cues.push(cue);
    };
    add('Person am Boden', /(missing_person|people|person|ground_crew|crew)/);
    add('Fahrzeug am Boden', /(vehicle|truck|bus|van|car|emergency_response|utility_truck)/);
    add('Boot auf dem Wasser', /(watercraft|boat|ship|raft|liferaft)/);
    add('Windenergieanlage', /(wind_turbine|windrad|windpark)/);
    add('Rauch oder Feuerzeichen', /(smoke|fire|campfire)/);
    return cues.slice(0, 3);
}

function missionTruthBaseVisibleCues(ctx = null, category = '', taskDomain = '') {
    const cues = [];
    const anchors = ctx?.anchors || {};
    const cat = String(category || '').toLowerCase();
    const task = String(taskDomain || '').toLowerCase();
    const natureTask = missionTruthIsNatureTask(cat, task);
    const hasContextAnchors = !!ctx && Object.keys(anchors).length > 0;
    const add = cue => { if (cue && !cues.includes(cue)) cues.push(cue); };
    if (natureTask) {
        if (anchors.forest || (!hasContextAnchors && (cat === 'fire' || cat === 'mountain'))) add('Waldrand');
        if (anchors.meadow || anchors.farmland) add('offenes Gelaende');
        if (anchors.water) add('Wasserflaeche oder Uferlinie');
        return cues.slice(0, 3);
    }
    if (cat === 'bridge') {
        add('Brueckenbauwerk');
        if (anchors.road || anchors.parking || anchors.railway) add('Zufahrt oder Trasse');
        if (anchors.water) add('Wasserflaeche oder Uferlinie');
        return cues.slice(0, 3);
    }
    if (cat === 'water' || anchors.water) add('Wasserflaeche oder Uferlinie');
    if (anchors.road || anchors.parking) add('Strasse oder Zufahrt');
    if (anchors.power) add('Strom- oder Infrastrukturpunkt');
    if (anchors.forest) add('Waldrand');
    if (anchors.meadow || anchors.farmland) add('offenes Gelaende');
    if (task.includes('search_and_rescue')) add('Person oder Hinweis am Boden');
    return cues.slice(0, 3);
}

function buildMissionTruth(missionData = null, geoContext = null, sceneSpec = null) {
    const md = missionData || currentMissionData || {};
    if (!md || !md.isPOI) return null;
    const poiLat = Number(md.targetLat);
    const poiLon = Number(md.targetLon);
    if (!Number.isFinite(poiLat) || !Number.isFinite(poiLon)) return null;
    const taskDomain = String(md.missionContract?.taskDomain || window.activePassenger?.taskDomain || '').toLowerCase();
    const requestedCategory = missionTruthRequestedCategory(md);
    const poiCategory = String(md.poiCategory || requestedCategory || '').toLowerCase();
    const origin = { lat: poiLat, lon: poiLon };
    const poiName = String(md.targetName || md.poiName || 'POI').trim() || 'POI';
    const truth = {
        source: 'mission-truth-v1',
        requestedCategory,
        poiCategory,
        pickedPoi: {
            name: poiName,
            lat: Math.round(poiLat * 1000000) / 1000000,
            lon: Math.round(poiLon * 1000000) / 1000000,
            source: String(md.poiSource || ''),
            lookup: md.poiLookup || null
        },
        mainTarget: null,
        sceneAnchor: null,
        visibleCues: [],
        constraints: [
            'Missionstexte duerfen nur diese Lage als Primaerziel verwenden.',
            'Sichtbare Objekte nur grob aus Pilotensicht nennen, nicht vollstaendig aufzaehlen.'
        ]
    };
    const waterZone = missionTruthNearestZone(geoContext, 'water');
    const isBridgeTarget = requestedCategory === 'bridge' || poiCategory === 'bridge';
    let mainKind = isBridgeTarget ? 'bridge' : 'poi';
    let mainPoint = { lat: poiLat, lon: poiLon };
    let mainName = poiName;
    let anchorKind = isBridgeTarget ? 'bridge' : 'poi';
    let anchorPoint = mainPoint;
    let reason = isBridgeTarget ? 'original_bridge_poi' : 'original_poi';
    if ((requestedCategory === 'water' || poiCategory === 'water') && waterZone) {
        const shoreline = missionTruthClosestPolygonPoint(waterZone, origin) || missionTruthRoundPoint(waterZone.center);
        if (shoreline) {
            mainKind = 'water_edge';
            mainPoint = shoreline;
            mainName = String(waterZone.name || poiName || 'Wasserziel').trim() || poiName;
            anchorKind = 'shoreline';
            anchorPoint = shoreline;
            reason = 'nearest_water_geometry';
        }
    } else {
        const pickedAnchor = missionTruthAnchorForCategory(geoContext, requestedCategory || poiCategory, taskDomain);
        const anchorPointFromCtx = missionTruthAnchorToPoint(pickedAnchor?.anchor, origin);
        if (pickedAnchor && anchorPointFromCtx) {
            mainKind = pickedAnchor.key;
            mainPoint = anchorPointFromCtx;
            mainName = String(pickedAnchor.anchor?.name || poiName).trim() || poiName;
            anchorKind = (pickedAnchor.key === 'power' || pickedAnchor.key === 'building') ? 'perimeter' : pickedAnchor.key;
            anchorPoint = anchorPointFromCtx;
            reason = `nearest_${pickedAnchor.key}_anchor`;
        }
    }
    const nav = missionTruthDistanceBearing(poiLat, poiLon, mainPoint.lat, mainPoint.lon);
    truth.mainTarget = {
        name: mainName,
        kind: mainKind,
        ...missionTruthRoundPoint(mainPoint),
        refinedFromPoi: !!nav && nav.distM > 35,
        distanceFromPoiM: nav ? Math.round(nav.distM) : 0,
        bearingFromPoiDeg: nav ? Math.round(nav.bearingDeg) : 0,
        reason
    };
    truth.sceneAnchor = {
        kind: anchorKind,
        ...missionTruthRoundPoint(anchorPoint),
        reason
    };
    truth.visibleCues = [
        ...missionTruthBaseVisibleCues(geoContext, requestedCategory || poiCategory, taskDomain),
        ...missionTruthSceneVisibleCues(sceneSpec)
    ].filter((cue, idx, arr) => cue && arr.indexOf(cue) === idx).slice(0, 4);
    return truth;
}

function enrichMissionTruthWithScene(missionTruth = null, sceneSpec = null) {
    if (!missionTruth || typeof missionTruth !== 'object') return missionTruth;
    const cues = [
        ...(Array.isArray(missionTruth.visibleCues) ? missionTruth.visibleCues : []),
        ...missionTruthSceneVisibleCues(sceneSpec)
    ].filter((cue, idx, arr) => cue && arr.indexOf(cue) === idx).slice(0, 4);
    return { ...missionTruth, visibleCues: cues };
}

function compactMissionTruthForPrompt(truth = null) {
    if (!truth || typeof truth !== 'object') return null;
    return {
        requestedCategory: truth.requestedCategory || '',
        poiCategory: truth.poiCategory || '',
        pickedPoi: truth.pickedPoi ? {
            name: truth.pickedPoi.name,
            lat: truth.pickedPoi.lat,
            lon: truth.pickedPoi.lon,
            source: truth.pickedPoi.source
        } : null,
        mainTarget: truth.mainTarget || null,
        sceneAnchor: truth.sceneAnchor || null,
        visibleCues: Array.isArray(truth.visibleCues) ? truth.visibleCues : [],
        constraints: Array.isArray(truth.constraints) ? truth.constraints : []
    };
}

function compactSceneComposerStory(text = '') {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const sentences = raw
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => !/^(Arbeits-Hinweis|Ankunfts-Hinweis):/i.test(s))
        .filter(s => !/^(sichere|stabile|ruhige)\b/i.test(s))
        .filter(s => !/^(zeitkritisch|pünktlich|puenktlich)\b/i.test(s));
    const picked = sentences.slice(0, 3).join(' ') || raw;
    return picked.slice(0, 520);
}

function normalizeMissionTargetGeoContext(raw = null, centerLat = null, centerLon = null, radiusM = MISSION_TARGET_GEO_CONTEXT_RADIUS_M) {
    const lat = Number(centerLat);
    const lon = Number(centerLon);
    if (!raw || !Array.isArray(raw.elements) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const anchors = {};
    const counts = {};
    const avoidZones = [];
    raw.elements.forEach(el => {
        const tags = el?.tags || {};
        const category = missionTargetGeoContextCategory(tags);
        if (!category) return;
        const zone = missionTargetGeoContextAvoidZone(el, category, lat, lon);
        if (zone) avoidZones.push(zone);
        const pt = missionTargetGeoContextElementPoint(el);
        if (!pt) return;
        let nav = null;
        try { nav = calcNav(lat, lon, pt.lat, pt.lon); } catch (_) {}
        const distM = Number(nav?.dist) * 1852;
        const bearingDeg = Number(nav?.brng);
        if (!Number.isFinite(distM) || !Number.isFinite(bearingDeg)) return;
        counts[category] = (counts[category] || 0) + 1;
        const name = String(tags.name || tags.ref || tags.operator || tags.highway || tags.landuse || tags.natural || tags.waterway || tags.amenity || tags.power || tags.railway || tags.building || '').slice(0, 80);
        if (!anchors[category] || distM < Number(anchors[category].distM || Infinity)) {
            anchors[category] = {
                present: true,
                count: counts[category],
                distM: Math.round(distM),
                bearingDeg: Math.round(bearingDeg),
                name,
                tag: category
            };
        } else {
            anchors[category].count = counts[category];
        }
    });
    Object.keys(counts).forEach(k => {
        if (anchors[k]) anchors[k].count = counts[k];
    });
    avoidZones.sort((a, b) => Number(a.distM || 999999) - Number(b.distM || 999999));
    const compactAvoidZones = avoidZones.slice(0, 48);
    const hints = [];
    if (anchors.road || anchors.parking) hints.push('roadside/vehicle placement plausible near the road or parking anchor');
    if (anchors.water) hints.push('waterline placement plausible near the water anchor');
    if (anchors.forest) hints.push('forest-edge placement plausible near the forest anchor');
    if (anchors.meadow || anchors.farmland) hints.push('animals/tents/reference objects plausible on meadow or farmland anchors');
    if (anchors.power) hints.push('powerline/pylon placement plausible near the power anchor');
    const summary = Object.entries(anchors)
        .filter(([, a]) => a && a.present)
        .sort((a, b) => Number(a[1].distM || 999999) - Number(b[1].distM || 999999))
        .map(([k, a]) => `${k} ${Math.round(Number(a.distM) || 0)}m bearing ${Math.round(Number(a.bearingDeg) || 0)}deg`)
        .slice(0, 8)
        .join('; ');
    return {
        source: 'overpass',
        radiusM: Math.round(Number(radiusM) || MISSION_TARGET_GEO_CONTEXT_RADIUS_M),
        center: {
            lat: Math.round(lat * 100000) / 100000,
            lon: Math.round(lon * 100000) / 100000
        },
        anchors,
        avoidZones: compactAvoidZones,
        hints,
        summary,
        fetchedAt: Date.now()
    };
}

async function fetchMissionTargetGeoContext(missionData = null) {
    const md = missionData || currentMissionData || {};
    if (!md || !md.isPOI) return null;
    const lat = Number(md.targetLat);
    const lon = Number(md.targetLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const radiusM = MISSION_TARGET_GEO_CONTEXT_RADIUS_M;
    const key = missionTargetGeoContextCacheKey(lat, lon, radiusM);
    const readCache = (store) => {
        try {
            const raw = store?.getItem?.(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || (Date.now() - Number(parsed.fetchedAt || 0)) > MISSION_TARGET_GEO_CONTEXT_TTL_MS) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    };
    const cached = readCache(sessionStorage) || readCache(localStorage);
    if (cached) return cached;
    if (missionTargetGeoContextInflight.has(key)) return missionTargetGeoContextInflight.get(key);

    const query = `[out:json][timeout:7];
(
  way(around:${radiusM},${lat},${lon})["highway"];
  node(around:${radiusM},${lat},${lon})["highway"];
  way(around:${radiusM},${lat},${lon})["waterway"];
  way(around:${radiusM},${lat},${lon})["natural"~"water|wood|scrub|heath|grassland"];
  relation(around:${radiusM},${lat},${lon})["natural"~"water|wood"];
  way(around:${radiusM},${lat},${lon})["landuse"~"forest|meadow|farmland|grass|orchard|vineyard|reservoir"];
  relation(around:${radiusM},${lat},${lon})["landuse"~"forest|meadow|farmland|grass|orchard|vineyard|reservoir"];
  way(around:${radiusM},${lat},${lon})["amenity"="parking"];
  way(around:${radiusM},${lat},${lon})["building"];
  node(around:${radiusM},${lat},${lon})["power"];
  way(around:${radiusM},${lat},${lon})["power"];
  way(around:${radiusM},${lat},${lon})["railway"];
  way(around:${radiusM},${lat},${lon})["bridge"];
);
out tags center geom 160;`;

    const promise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);
        try {
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`overpass_http_${res.status}`);
            const raw = await res.json();
            const normalized = normalizeMissionTargetGeoContext(raw, lat, lon, radiusM);
            if (normalized) {
                try { sessionStorage.setItem(key, JSON.stringify(normalized)); } catch (_) {}
                try { localStorage.setItem(key, JSON.stringify(normalized)); } catch (_) {}
            }
            return normalized;
        } catch (err) {
            console.warn('[MISSION GEO] Overpass context unavailable', err);
            return null;
        } finally {
            clearTimeout(timeoutId);
            missionTargetGeoContextInflight.delete(key);
        }
    })();
    missionTargetGeoContextInflight.set(key, promise);
    return promise;
}

async function composeMissionTargetSceneWithGemini({ missionData = null, missionContract = null, passenger = null } = {}) {
    const md = missionData || currentMissionData || {};
    const contract = missionContract || window.activeMissionContract || md.missionContract || {};
    const pax = passenger || window.activePassenger || {};
    const isPOI = !!(md.poiName || md.poiSource || md.isPOI);
    const taskDomain = String(pax.taskDomain || contract.taskDomain || '').toLowerCase();
    const sceneIntent = sanitizeMissionSceneIntentSpec(md.sceneIntent || contract.sceneIntent || null, { isPOI, taskDomain });
    const targetGeoContext = md.targetGeoContext || contract.targetGeoContext || null;
    const missionTruth = md.missionTruth || contract.missionTruth || null;
    const missionPlanV2 = md.missionPlanV2 || contract.missionPlanV2 || null;
    const fallback = deriveMissionTargetSceneFromIntent(sceneIntent, { isPOI, taskDomain, targetGeoContext });
    const apiKey = String(document.getElementById('apiKeyInput')?.value || '').trim();
    const baseDebug = {
        source: 'local-fallback',
        sceneIntent,
        targetGeoContext,
        missionTruth,
        missionPlanV2,
        fallback,
        promptVersion: 'scene-composer-v1'
    };
    if (!isPOI) {
        return {
            targetScene: fallback,
            debug: {
                ...baseDebug,
                source: 'local-none'
            }
        };
    }
    if (!apiKey) {
        return {
            targetScene: fallback,
            debug: {
                ...baseDebug,
                error: 'missing_api_key'
            }
        };
    }

    const forcedProfile = { taskDomain };
    const sceneGuide = buildMissionTargetScenePromptGuide(true, forcedProfile);
    const prompt = `<INSTRUKTIONEN>
Du bist Scene Composer fuer einen MSFS-Missionsgenerator.
Aufgabe: Erzeuge aus der Missionsbeschreibung und sceneIntent eine konkrete, sparsame targetScene.
Antwortsprache intern egal, aber JSON-Felder muessen exakt passen.

Regeln:
1. Szene muss aus dem Kontext entstehen, nicht aus Standard-Deko.
2. Keine grossen Einsatzmittel, Schiffe, Kegel, Personen oder Fahrzeuge, wenn sceneIntent/Story sie nicht tragen.
3. Kleine Primitive wie Zelt, parkendes Auto, Wasservoegel, Holz, Kisten, Lagerfeuer, Tiere und Baufahrzeuge duerfen frei kombiniert werden, wenn plausibel.
4. Bei Lern-/Sightseeing-Fluegen lieber sparse oder none; 0-3 sichtbare Akzente sind oft genug.
5. requirements[].count ist bewusst: fuer Natur/Sightseeing klein halten; fuer Materiallager/Baustellen duerfen 6-8 Paletten als gebuendelter Cluster erscheinen. Nutze arrangement/layout, damit Objekte logisch zusammenstehen statt zufaellig verteilt zu wirken.
6. Wenn sceneIntent.avoid etwas verbietet, respektieren.
7. Fuer alle Missionstypen gilt: Primaerziel zuerst, Kontext danach, Support zuletzt. Support-Objekte wie Fahrzeuge, Crew, Material, Rauch, Tiere oder Absperrungen muessen aus Story/sceneIntent hervorgehen und duerfen den Auftrag nicht logisch schon geloest haben.
8. Bei SAR ist die vermisste Person, ein Hinweis oder ein Signal das Primaerziel. Suchtrupps/Fahrzeuge sind Support und muessen aus Story/sceneIntent hervorgehen.
9. Wenn targetGeoContext vorhanden ist, nutze ihn nur als lokale Plausibilitaetskarte: road/parking fuer Fahrzeuge, water fuer Ufer/Wasser, forest/meadow/farmland fuer Natur/Tiere/Zelte, power fuer Leitungen. Erfinde keine exakten OSM-Daten und ignoriere Anker, die nicht zur Geschichte passen.
10. Wenn missionTruth vorhanden ist, ist missionTruth.mainTarget das kanonische Ziel und missionTruth.sceneAnchor der bevorzugte Platzierungsbereich. Sichtbare Objekte nur grob und situationsbezogen aus missionTruth.visibleCues ableiten; nicht alle Objekte aufzaehlen.
10a. Bei Natur-/Wald-/Bio-Missionen sind Strassen, Strom und Gebaeude nur Kontext, nie automatisch Zielszene. Waehle road_incident, Fahrzeuge, Strommast oder Kegel nur bei ausdruecklichem Unfall-/Einsatz-/Inspektionsgrund.
10b. Strommast/Freileitung und Windrad/Windpark sind Spezialobjekte, keine Dekoration. Strommast nur bei konkretem Strom-/Umspannwerks-/Energieinfrastruktur-Kontext. Windrad nur bei konkretem Windenergie-/Bau-/Wartungs-/Inspektions-Kontext und passender offener/hochgelegener Umgebung; nicht in Stadt, Wohngebiet oder Tal.
10c. Wenn missionPlanV2 vorhanden ist, beachte primaryObjective, sceneKind, objectFamilies und placementPolicy als Planformular. requirements duerfen diese Objektfamilien konkretisieren, aber nicht ein neues Missionsthema erfinden.
11. Gib AUSSCHLIESSLICH JSON aus.

${sceneGuide}
</INSTRUKTIONEN>

<KONTEXT>
Mission: ${String(md.mission || contract.missionTitle || '').slice(0, 140)}
Story: ${compactSceneComposerStory(contract.missionStory || md.story || '')}
Ziel: ${String(md.targetName || md.poiName || '').slice(0, 140)}
Koordinaten: ${Number(md.targetLat || 0).toFixed(5)}, ${Number(md.targetLon || 0).toFixed(5)}
taskDomain: ${taskDomain || 'general'}
roleProfile: ${String(pax.roleProfile || contract.roleProfile || 'general_passenger_v1')}
PAX: ${String(contract.paxText || '').slice(0, 160)}
Cargo: ${String(contract.cargoText || '').slice(0, 160)}
sceneIntent: ${JSON.stringify(sceneIntent)}
missionTruth: ${JSON.stringify(compactMissionTruthForPrompt(missionTruth))}
missionPlanV2: ${JSON.stringify(compactMissionPlanV2ForPrompt(missionPlanV2))}
targetGeoContext: ${JSON.stringify(targetGeoContext ? {
    summary: summarizeMissionTargetGeoContext(targetGeoContext),
    anchors: targetGeoContext.anchors || {},
    avoidZoneCounts: (Array.isArray(targetGeoContext.avoidZones) ? targetGeoContext.avoidZones : []).reduce((acc, z) => {
        const k = z?.type || 'unknown';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {}),
    hints: targetGeoContext.hints || []
} : null)}
</KONTEXT>

<OUTPUT>
{
  "targetScene": {
    "kind": "none|fire_watch|road_incident|sar_water|sar_land|medical_pickup|cargo_site|construction_site|powerline_inspection|wind_turbine_site|erosion_damage|debris_field|infra_bridge|infra_dam|industry_site|water_pollution|water_context|wildlife_site|media_site|event_site|survey_context",
    "preset": "",
    "features": ["optional"],
    "requirements": [{"feature": "tent", "count": 1, "placement": "am Ufer", "arrangement": "cluster", "notes": "nur wenn plausibel"}],
    "roles": [],
    "density": "none|sparse|normal|busy",
    "layout": "cluster|scattered|line|roadside|waterline|perimeter|mixed oder leer",
    "notes": "kurzer Grund"
  }
}
</OUTPUT>`;

    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } };
    const reqOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    const models = [
        ['gemini-3-flash-preview', 'Gemini 3.0 Flash Scene Composer', 'flash'],
        ['gemini-2.5-flash', 'Gemini 2.5 Flash Scene Composer', 'flash'],
        ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite Scene Composer', 'lite']
    ];
    let lastError = '';
    const composerStartedAt = Date.now();
    for (const [model, source, usageKey] of models) {
        const remainingMs = MISSION_SCENE_COMPOSER_TOTAL_TIMEOUT_MS - (Date.now() - composerStartedAt);
        if (remainingMs <= 0) {
            lastError = 'composer_timeout';
            break;
        }
        const timeoutMs = Math.min(MISSION_SCENE_COMPOSER_MODEL_TIMEOUT_MS, Math.max(2500, remainingMs));
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                ...reqOptions,
                signal: controller.signal
            });
            if (!res.ok) {
                lastError = `http_${res.status}_${model}`;
                continue;
            }
            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const parsed = JSON.parse(rawText);
            const targetScene = sanitizeMissionTargetSceneSpec(parsed.targetScene || parsed, { isPOI, taskDomain, targetGeoContext });
            incrementApiUsage(usageKey);
            return {
                targetScene,
                debug: {
                    source,
                    sceneIntent,
                    targetGeoContext,
                    missionTruth,
                    missionPlanV2,
                    aiRaw: parsed.targetScene || parsed,
                    normalized: targetScene,
                    fallback,
                    promptVersion: 'scene-composer-v1'
                }
            };
        } catch (err) {
            lastError = err?.name === 'AbortError'
                ? `timeout_${model}`
                : (err?.message || String(err || 'unknown'));
        } finally {
            clearTimeout(timeoutId);
        }
    }
    return {
        targetScene: fallback,
        debug: {
            ...baseDebug,
            error: lastError || 'composer_failed'
        }
    };
}

function updateMissionAcceptanceUi() {
    const panel = document.getElementById('missionAcceptPanel');
    if (!panel) return;
    const btn = document.getElementById('missionAcceptBtn');
    const text = document.getElementById('missionAcceptText');
    const md = currentMissionData || null;
    const needsAccept = !!(md && md.sceneAccepted === false);
    panel.style.display = needsAccept ? 'flex' : 'none';
    if (!needsAccept) return;
    let composing = md.sceneCompositionStatus === 'composing';
    const composingStartedAt = Number(md.sceneCompositionStartedAt || 0);
    if (composing && composingStartedAt && (Date.now() - composingStartedAt) > 60000) {
        md.sceneCompositionStatus = 'draft';
        md.sceneCompositionStartedAt = 0;
        composing = false;
    }
    if (btn) {
        btn.disabled = composing;
        btn.textContent = composing ? 'Szene wird gebaut...' : 'Mission akzeptieren';
    }
    if (text) {
        const intent = sanitizeMissionSceneIntentSpec(md.sceneIntent || md.missionContract?.sceneIntent || null, {
            isPOI: !!md.poiName,
            taskDomain: md.missionContract?.taskDomain || window.activePassenger?.taskDomain || ''
        });
        text.textContent = composing
            ? 'Scene Composer baut die konkrete Zielszene fuer den Tracker.'
            : (intent.summary || 'Mission als Entwurf. Beim Akzeptieren wird die Zielszene vorbereitet.');
    }
}
window.updateMissionAcceptanceUi = updateMissionAcceptanceUi;

function applyMissionTargetSceneComposition(composition = {}, reason = 'accept') {
    if (!currentMissionData) return false;
    const taskDomain = currentMissionData.missionContract?.taskDomain || window.activePassenger?.taskDomain || '';
    const isPOI = !!currentMissionData.poiName;
    const targetScene = sanitizeMissionTargetSceneSpec(composition.targetScene || null, {
        isPOI,
        taskDomain,
        targetGeoContext: currentMissionData.targetGeoContext || currentMissionData.missionContract?.targetGeoContext || null
    });
    currentMissionData.targetScene = targetScene;
    currentMissionData.sceneAccepted = true;
    currentMissionData.sceneCompositionStatus = composition.debug?.error ? 'accepted_fallback' : 'accepted';
    currentMissionData.sceneCompositionStartedAt = 0;
    currentMissionData.targetSceneComposerDebug = composition.debug || null;
    currentMissionData.targetSceneAiRaw = composition.debug?.aiRaw || currentMissionData.targetSceneAiRaw || null;
    currentMissionData.targetSceneAiNormalized = targetScene;
    currentMissionData.missionTruth = enrichMissionTruthWithScene(
        currentMissionData.missionTruth || currentMissionData.missionContract?.missionTruth || buildMissionTruth(currentMissionData, currentMissionData.targetGeoContext || null, targetScene),
        targetScene
    );
    if (currentMissionData.missionContract && typeof currentMissionData.missionContract === 'object') {
        currentMissionData.missionContract.targetScene = targetScene;
        currentMissionData.missionContract.sceneAccepted = true;
        currentMissionData.missionContract.targetGeoContext = currentMissionData.targetGeoContext || currentMissionData.missionContract.targetGeoContext || null;
        currentMissionData.missionContract.missionTruth = currentMissionData.missionTruth || currentMissionData.missionContract.missionTruth || null;
        currentMissionData.missionContract.missionPlanV2 = currentMissionData.missionPlanV2 || currentMissionData.missionContract.missionPlanV2 || null;
        currentMissionData.missionContract.sceneIntent = sanitizeMissionSceneIntentSpec(
            currentMissionData.sceneIntent || currentMissionData.missionContract.sceneIntent || null,
            { isPOI, taskDomain }
        );
        window.activeMissionContract = currentMissionData.missionContract;
    }
    try { localStorage.setItem('ga_active_mission_contract', JSON.stringify(window.activeMissionContract || currentMissionData.missionContract || null)); } catch (_) {}
    try { localStorage.setItem('ga_active_passenger', window.activePassenger ? JSON.stringify(window.activePassenger) : ''); } catch (_) {}
    const debugInfo = {
        sceneAccepted: true,
        sceneCompositionStatus: currentMissionData.sceneCompositionStatus,
        sceneIntent: currentMissionData.sceneIntent || currentMissionData.missionContract?.sceneIntent || null,
        targetGeoContext: currentMissionData.targetGeoContext || currentMissionData.missionContract?.targetGeoContext || null,
        missionTruth: currentMissionData.missionTruth || currentMissionData.missionContract?.missionTruth || null,
        missionPlanV2: currentMissionData.missionPlanV2 || currentMissionData.missionContract?.missionPlanV2 || null,
        sceneComposer: composition.debug || null,
        composerReason: reason,
        aiRequested: currentMissionData.targetSceneAiRaw || null,
        aiNormalized: targetScene,
        contractTargetScene: targetScene,
        missionContext: {
            source: currentMissionData.source || 'n/a',
            mode: currentMissionData.poiName ? 'POI' : 'A-B',
            profile: currentMissionData.missionContract?.appliedProfileId || 'auto',
            taskDomain,
            mission: currentMissionData.mission || '',
            target: currentMissionData.targetName || currentMissionData.poiName || '',
            poi: !!currentMissionData.poiName
        }
    };
    if (typeof window.gaMissionSceneDebugRecordAi === 'function') {
        window.gaMissionSceneDebugRecordAi(debugInfo);
    } else {
        window.gaMissionSceneDebug = { ...(window.gaMissionSceneDebug || {}), ...debugInfo, ts: Date.now() };
    }
    try {
        const snapshotRaw = localStorage.getItem('ga_mission_debug_snapshot');
        const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : (window.vpMissionDebugSnapshot || {});
        snapshot.sceneAccepted = true;
        snapshot.sceneCompositionStatus = currentMissionData.sceneCompositionStatus;
        snapshot.targetScene = targetScene;
        snapshot.targetGeoContext = currentMissionData.targetGeoContext || null;
        snapshot.missionTruth = currentMissionData.missionTruth || null;
        snapshot.missionPlanV2 = currentMissionData.missionPlanV2 || currentMissionData.missionContract?.missionPlanV2 || null;
        snapshot.targetSceneComposerDebug = composition.debug || null;
        snapshot.targetSceneDebug = {
            ...(snapshot.targetSceneDebug || {}),
            aiRequested: currentMissionData.targetSceneAiRaw || null,
            aiNormalized: targetScene,
            contractTargetScene: targetScene
        };
        window.vpMissionDebugSnapshot = snapshot;
        localStorage.setItem('ga_mission_debug_snapshot', JSON.stringify(snapshot));
    } catch (_) {}
    saveMissionState();
    updateMissionAcceptanceUi();
    if (typeof window.refreshMissionRuntimeUi === 'function') window.refreshMissionRuntimeUi();
    if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
    return true;
}

window.acceptMissionDraft = async function() {
    if (!currentMissionData || currentMissionData.sceneAccepted !== false) {
        updateMissionAcceptanceUi();
        return true;
    }
    currentMissionData.sceneCompositionStatus = 'composing';
    currentMissionData.sceneCompositionStartedAt = Date.now();
    updateMissionAcceptanceUi();
    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = 'Lokaler Kartenkontext wird geprueft...';
    try {
        const geoContext = await fetchMissionTargetGeoContext(currentMissionData);
        if (geoContext) {
            currentMissionData.targetGeoContext = geoContext;
            if (currentMissionData.missionContract && typeof currentMissionData.missionContract === 'object') {
                currentMissionData.missionContract.targetGeoContext = geoContext;
                window.activeMissionContract = currentMissionData.missionContract;
            }
        }
        currentMissionData.missionTruth = buildMissionTruth(currentMissionData, currentMissionData.targetGeoContext || geoContext || null, currentMissionData.targetScene || null);
        if (currentMissionData.missionContract && typeof currentMissionData.missionContract === 'object') {
            currentMissionData.missionContract.missionTruth = currentMissionData.missionTruth || null;
            window.activeMissionContract = currentMissionData.missionContract;
        }
        if (indicator) indicator.innerText = 'Scene Composer baut Zielszene...';
        const composition = await composeMissionTargetSceneWithGemini({
            missionData: currentMissionData,
            missionContract: currentMissionData.missionContract || window.activeMissionContract || null,
            passenger: window.activePassenger || null
        });
        applyMissionTargetSceneComposition(composition, 'mission-accepted');
        if (indicator) {
            indicator.innerText = composition?.debug?.error
                ? 'Mission akzeptiert. Zielszene per Fallback vorbereitet.'
                : 'Mission akzeptiert. Zielszene bereit.';
        }
        return true;
    } catch (err) {
        const fallback = {
            targetScene: deriveMissionTargetSceneFromIntent(currentMissionData.sceneIntent || null, {
                isPOI: !!currentMissionData.poiName,
                taskDomain: currentMissionData.missionContract?.taskDomain || window.activePassenger?.taskDomain || '',
                targetGeoContext: currentMissionData.targetGeoContext || currentMissionData.missionContract?.targetGeoContext || null
            }),
            debug: {
                source: 'local-fallback',
                error: err?.message || String(err || 'composer_failed'),
                sceneIntent: currentMissionData.sceneIntent || null,
                missionPlanV2: currentMissionData.missionPlanV2 || currentMissionData.missionContract?.missionPlanV2 || null,
                promptVersion: 'scene-composer-v1'
            }
        };
        applyMissionTargetSceneComposition(fallback, 'mission-accepted-error-fallback');
        if (indicator) indicator.innerText = 'Mission akzeptiert. Scene Composer Fehler, Fallback genutzt.';
        return true;
    }
};

const MISSION_PIPELINE_V2_ALLOWED_NEEDS = new Set([
    'geo_context',
    'mission_truth',
    'weather_snapshot',
    'target_elevation',
    'poi_metadata',
    'airport_details',
    'fire_hazard'
]);

function compactMissionPlanV2ForPrompt(planResult = null) {
    if (!planResult || typeof planResult !== 'object') return null;
    const plan = (planResult.plan && typeof planResult.plan === 'object') ? planResult.plan : {};
    const resolvedNeeds = (planResult.resolvedNeeds && typeof planResult.resolvedNeeds === 'object') ? planResult.resolvedNeeds : {};
    return {
        status: String(planResult.status || 'ready'),
        pipelineVersion: String(planResult.pipelineVersion || 'mission-v2-planner-2026-05-22'),
        plan: {
            taskDomain: String(plan.taskDomain || ''),
            roleProfile: String(plan.roleProfile || ''),
            missionType: String(plan.missionType || ''),
            targetCategory: String(plan.targetCategory || ''),
            primaryObjective: String(plan.primaryObjective || '').slice(0, 260),
            targetLabel: String(plan.targetLabel || '').slice(0, 120),
            sceneKind: String(plan.sceneKind || ''),
            sceneDensity: String(plan.sceneDensity || ''),
            requiredAnchors: Array.isArray(plan.requiredAnchors) ? plan.requiredAnchors.slice(0, 6).map(String) : [],
            objectFamilies: Array.isArray(plan.objectFamilies) ? plan.objectFamilies.slice(0, 8).map(String) : [],
            placementPolicy: String(plan.placementPolicy || '').slice(0, 260),
            narrativeRules: Array.isArray(plan.narrativeRules) ? plan.narrativeRules.slice(0, 6).map(x => String(x).slice(0, 160)) : [],
            lockedFields: (plan.lockedFields && typeof plan.lockedFields === 'object') ? plan.lockedFields : {},
            confidence: Number.isFinite(Number(plan.confidence)) ? Math.max(0, Math.min(1, Number(plan.confidence))) : null
        },
        needs: Array.isArray(planResult.needs) ? planResult.needs.slice(0, 6) : [],
        resolvedNeedTypes: Object.keys(resolvedNeeds).slice(0, 8)
    };
}

function sanitizeMissionPlannerV2Result(raw = null, draft = null, resolvedNeeds = {}) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    const statusRaw = String(src.status || '').toLowerCase();
    const status = ['ready', 'needs_data', 'invalid'].includes(statusRaw) ? statusRaw : 'ready';
    const needs = (Array.isArray(src.needs) ? src.needs : [])
        .map(item => {
            const obj = (item && typeof item === 'object') ? item : { type: String(item || '') };
            const type = String(obj.type || '').trim().toLowerCase();
            if (!MISSION_PIPELINE_V2_ALLOWED_NEEDS.has(type)) return null;
            return {
                type,
                target: String(obj.target || draft?.target?.name || '').slice(0, 120),
                reason: String(obj.reason || '').slice(0, 180)
            };
        })
        .filter(Boolean)
        .slice(0, 6);
    const rawPlan = (src.plan && typeof src.plan === 'object') ? src.plan : {};
    const lockedFields = (rawPlan.lockedFields && typeof rawPlan.lockedFields === 'object') ? rawPlan.lockedFields : {};
    const fallbackTask = String(draft?.profile?.taskDomain || draft?.profile?.id || 'general').toLowerCase();
    const fallbackRole = String(draft?.profile?.roleProfile || 'general_passenger_v1').toLowerCase();
    const plan = {
        taskDomain: String(rawPlan.taskDomain || fallbackTask || 'general').toLowerCase(),
        roleProfile: String(rawPlan.roleProfile || fallbackRole || 'general_passenger_v1').toLowerCase(),
        missionType: String(rawPlan.missionType || draft?.mode || '').toLowerCase(),
        targetCategory: String(rawPlan.targetCategory || draft?.category || '').toLowerCase(),
        primaryObjective: String(rawPlan.primaryObjective || '').trim().slice(0, 360),
        targetLabel: String(rawPlan.targetLabel || draft?.target?.name || '').trim().slice(0, 160),
        sceneKind: String(rawPlan.sceneKind || '').toLowerCase(),
        sceneDensity: String(rawPlan.sceneDensity || '').toLowerCase(),
        requiredAnchors: Array.isArray(rawPlan.requiredAnchors) ? rawPlan.requiredAnchors.slice(0, 8).map(x => String(x).slice(0, 80)) : [],
        objectFamilies: Array.isArray(rawPlan.objectFamilies) ? rawPlan.objectFamilies.slice(0, 10).map(x => String(x).slice(0, 80)) : [],
        placementPolicy: String(rawPlan.placementPolicy || '').trim().slice(0, 360),
        narrativeRules: Array.isArray(rawPlan.narrativeRules) ? rawPlan.narrativeRules.slice(0, 8).map(x => String(x).slice(0, 180)) : [],
        lockedFields,
        confidence: Number.isFinite(Number(rawPlan.confidence)) ? Math.max(0, Math.min(1, Number(rawPlan.confidence))) : null
    };
    return {
        pipelineVersion: 'mission-v2-planner-2026-05-22',
        status,
        needs,
        resolvedNeeds: resolvedNeeds || {},
        plan,
        debug: {
            source: String(src.debug?.source || src.source || 'Gemini Planner V2'),
            rawStatus: src.status || null
        }
    };
}

function buildMissionPlannerV2Draft({
    start = null,
    dest = null,
    isPOI = false,
    dist = 0,
    missionPicker = null,
    dispatchProfileId = 'auto',
    selectedCategory = 'all',
    requestedCategory = 'all',
    poiTerrainFt = null,
    missionWeather = null,
    missionFireHazard = null,
    targetGeoContext = null,
    missionTruth = null
} = {}) {
    const profile = getMissionTaskProfile(dispatchProfileId, isPOI ? 'poi' : 'apt') || {};
    return {
        schema: 'missionDraft.v2',
        mode: isPOI ? 'poi' : 'apt',
        route: {
            startIcao: currentStartICAO || '',
            startName: String(start?.n || ''),
            targetIcao: isPOI ? 'POI' : String(dest?.icao || ''),
            distanceNm: Number.isFinite(Number(dist)) ? Number(dist) : 0
        },
        target: {
            name: String(dest?.n || ''),
            lat: Number.isFinite(Number(dest?.lat)) ? Number(dest.lat) : null,
            lon: Number.isFinite(Number(dest?.lon)) ? Number(dest.lon) : null,
            terrainFt: Number.isFinite(Number(poiTerrainFt)) ? Math.round(Number(poiTerrainFt)) : null,
            poiSource: String(dest?.poiSource || ''),
            poiCategory: String(dest?.poiCategory || '')
        },
        picker: {
            baseType: String(missionPicker?.baseType || (isPOI ? 'poi' : 'apt')),
            category: String(selectedCategory || 'all'),
            categoryRequested: String(requestedCategory || selectedCategory || 'all'),
            profile: String(dispatchProfileId || 'auto')
        },
        profile: {
            id: String(profile.id || dispatchProfileId || 'auto'),
            label: String(profile.label || ''),
            roleProfile: String(profile.roleProfile || ''),
            taskDomain: String(profile.taskDomain || '')
        },
        category: String(selectedCategory || 'all'),
        weather: {
            dep: _summarizeMissionWeather(missionWeather?.dep || null),
            dest: _summarizeMissionWeather(missionWeather?.dest || null)
        },
        fireHazard: missionFireHazard || null,
        targetGeoContext: targetGeoContext ? {
            summary: summarizeMissionTargetGeoContext(targetGeoContext),
            hints: targetGeoContext.hints || [],
            anchors: targetGeoContext.anchors || {}
        } : null,
        missionTruth: compactMissionTruthForPrompt(missionTruth)
    };
}

async function fetchGeminiJsonWithFallback(prompt, apiKey, { promptVersion = 'planner-v2', timeoutMs = 14000 } = {}) {
    const models = [
        ['gemini-3-flash-preview', 'Gemini 3.0 Flash', 'flash'],
        ['gemini-2.5-flash', 'Gemini 2.5 Flash', 'flash'],
        ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 'lite']
    ];
    let lastError = '';
    for (const [model, source, usageKey] of models) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } };
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            if (!res.ok) {
                lastError = `http_${res.status}_${model}`;
                continue;
            }
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const parsed = JSON.parse(text);
            incrementApiUsage(usageKey);
            return { parsed, source, promptVersion };
        } catch (err) {
            lastError = err?.name === 'AbortError' ? `timeout_${model}` : (err?.message || String(err || 'unknown'));
        } finally {
            clearTimeout(timeoutId);
        }
    }
    return { parsed: null, source: 'none', promptVersion, error: lastError || 'planner_failed' };
}

async function resolveMissionPlannerV2Needs(needs = [], context = {}) {
    const out = {};
    for (const need of Array.isArray(needs) ? needs : []) {
        const type = String(need?.type || '').toLowerCase();
        if (!MISSION_PIPELINE_V2_ALLOWED_NEEDS.has(type)) continue;
        if (type === 'geo_context') {
            out.geo_context = context.targetGeoContext || (context.isPOI ? await fetchMissionTargetGeoContext({
                isPOI: true,
                targetLat: Number(context.dest?.lat),
                targetLon: Number(context.dest?.lon)
            }) : null);
        } else if (type === 'mission_truth') {
            const geo = out.geo_context || context.targetGeoContext || null;
            out.mission_truth = context.missionTruth || buildMissionTruth({
                isPOI: !!context.isPOI,
                poiName: context.dest?.n || null,
                targetName: context.dest?.n || null,
                targetLat: Number(context.dest?.lat),
                targetLon: Number(context.dest?.lon),
                poiSource: String(context.dest?.poiSource || ''),
                poiCategory: String(context.dest?.poiCategory || context.selectedCategory || ''),
                requestedCategory: String(context.selectedCategory || 'all'),
                poiLookup: context.dest?.poiLookup || null
            }, geo, null);
        } else if (type === 'weather_snapshot') {
            out.weather_snapshot = context.missionWeather || null;
        } else if (type === 'target_elevation') {
            out.target_elevation = Number.isFinite(Number(context.poiTerrainFt)) ? Math.round(Number(context.poiTerrainFt)) : null;
        } else if (type === 'poi_metadata') {
            out.poi_metadata = context.isPOI ? {
                name: String(context.dest?.n || ''),
                category: String(context.dest?.poiCategory || context.selectedCategory || ''),
                requestedCategory: String(context.selectedCategory || ''),
                source: String(context.dest?.poiSource || ''),
                lookup: context.dest?.poiLookup || null
            } : null;
        } else if (type === 'airport_details') {
            out.airport_details = {
                start: context.start ? { icao: currentStartICAO || '', name: context.start.n || '', lat: context.start.lat, lon: context.start.lon } : null,
                dest: (!context.isPOI && context.dest) ? { icao: context.dest.icao || '', name: context.dest.n || '', lat: context.dest.lat, lon: context.dest.lon } : null
            };
        } else if (type === 'fire_hazard') {
            out.fire_hazard = context.missionFireHazard || null;
        }
    }
    return out;
}

function buildMissionPlannerV2Prompt(draft = {}, resolvedNeeds = null) {
    return `<INSTRUKTIONEN>
Du bist Mission Planner V2 fuer einen GA-Missionsgenerator.
Du schreibst noch keine fertige Story. Du fuellst ein kompaktes Plan-Formular aus, das spaetere KI-Schritte bindet.
Du hast kein Gedaechtnis ausser dem JSON in <DRAFT> und <RESOLVED_NEEDS>.

Regeln:
1. Wenn wichtige Daten fehlen, antworte status="needs_data" und nutze nur erlaubte needs: geo_context, mission_truth, weather_snapshot, target_elevation, poi_metadata, airport_details, fire_hazard.
2. Stelle keine freien Internetfragen und erfinde keine neuen Datenquellen.
3. Wenn genug Kontext vorhanden ist, antworte status="ready".
4. plan.primaryObjective beschreibt genau einen Hauptauftrag.
5. plan.objectFamilies sind semantische Objektgruppen, keine MSFS-Assetnamen.
6. plan.lockedFields darf nur wirklich festgelegte Dinge enthalten, z.B. taskDomain, targetCategory, targetName, noLandingAtPoi.
7. Keine Markdown-Ausgabe, nur JSON.
</INSTRUKTIONEN>

<DRAFT>
${JSON.stringify(draft)}
</DRAFT>

<RESOLVED_NEEDS>
${JSON.stringify(resolvedNeeds || null)}
</RESOLVED_NEEDS>

<OUTPUT>
{
  "status": "ready|needs_data|invalid",
  "needs": [{"type": "geo_context", "target": "Ziel", "reason": "kurz"}],
  "plan": {
    "taskDomain": "mapping_survey",
    "roleProfile": "photogrammetry_precision_v1",
    "missionType": "poi|apt",
    "targetCategory": "bridge|water|cargo|...",
    "primaryObjective": "Ein konkreter Hauptauftrag",
    "targetLabel": "kanonischer Zielname",
    "sceneKind": "none|construction_site|sar_land|water_context|...",
    "sceneDensity": "none|sparse|normal|busy",
    "requiredAnchors": ["welcher Platzierungsanker wichtig ist"],
    "objectFamilies": ["z.B. palettencluster", "kleiner lkw"],
    "placementPolicy": "kurze Logik, wie Objekte gruppiert werden sollen",
    "narrativeRules": ["Regeln fuer Story/Pax, max 6"],
    "lockedFields": {"noLandingAtPoi": true},
    "confidence": 0.0
  }
}
</OUTPUT>`;
}

async function fetchMissionPlannerV2(context = {}) {
    if (!isMissionPipelineV2Enabled()) return null;
    const apiKey = String(document.getElementById('apiKeyInput')?.value || '').trim();
    if (!apiKey || !document.getElementById('aiToggle')?.checked) return null;
    const draft = buildMissionPlannerV2Draft(context);
    const first = await fetchGeminiJsonWithFallback(buildMissionPlannerV2Prompt(draft, null), apiKey, { promptVersion: 'planner-v2-pass1' });
    if (!first.parsed) {
        return {
            pipelineVersion: 'mission-v2-planner-2026-05-22',
            status: 'invalid',
            needs: [],
            resolvedNeeds: {},
            plan: {},
            debug: { source: first.source || 'none', error: first.error || 'planner_failed', pass: 1 }
        };
    }
    let normalized = sanitizeMissionPlannerV2Result({ ...first.parsed, debug: { source: first.source } }, draft, {});
    if (normalized.status === 'needs_data' && normalized.needs.length) {
        const resolvedNeeds = await resolveMissionPlannerV2Needs(normalized.needs, context);
        const second = await fetchGeminiJsonWithFallback(buildMissionPlannerV2Prompt(draft, resolvedNeeds), apiKey, { promptVersion: 'planner-v2-pass2' });
        if (second.parsed) {
            normalized = sanitizeMissionPlannerV2Result({ ...second.parsed, debug: { source: second.source } }, draft, resolvedNeeds);
            normalized.debug.pass = 2;
        } else {
            normalized.resolvedNeeds = resolvedNeeds;
            normalized.debug.error = second.error || 'planner_pass2_failed';
            normalized.debug.pass = 2;
        }
    } else {
        normalized.debug.pass = 1;
    }
    window.gaMissionPipelineV2Last = normalized;
    return normalized;
}
window.fetchMissionPlannerV2 = fetchMissionPlannerV2;

async function fetchGeminiMission(startName, destName, dist, isPOI, paxText, cargoText, poiTerrainFt = null, missionWeather = null, missionPicker = null, missionFireHazard = null, poiTargetMeta = null) {
    const aiToggleBtn = document.getElementById('aiToggle');
    if (!aiToggleBtn || !aiToggleBtn.checked) return null;
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
    if (!apiKey) return null;

    const poiCategories = [
        "Tourismus & Sightseeing", "Natur- & Umweltschutz (Beobachtung)",
        "Luftbildfotografie (Medien/Immobilien)", "Infrastruktur-Inspektion (Straßen/Brücken/Leitungen)",
        "Wissenschaftliche Datenerfassung", "Lokales Event / Großveranstaltung von oben",
        "Kurioses / Verrückte Suchaktion"
    ];

    const aptCategories = [
        "Kulinarischer Ausflug ($100 Burger, legendäre Pizza, Steak oder BBQ am Ziel)",
        "Kaffee & Kuchen Run (Klassischer Nachmittagsausflug zum Flugplatz-Café)",
        "Tagesausflug mit Freunden (Wandern, Action oder einfach abhängen am Zielort)",
        "Städtetrip (Sightseeing, Kultur, 1-2 echte Highlights der Zielstadt erkunden)",
        "Wellness-Urlaub / Romantischer Wochenendausflug mit der Frau/dem Partner",
        "Besuch bei einem befreundeten Fliegerverein (Stammtisch, Fly-In, Austausch)",
        "Flugplatz-Logistik (Ersatzteil für die Vereinsmaschine holen, Mechaniker-Shuttle)",
        "Spezielles Flugtraining (Seitenwind, Navigation, Platzrunden-Drill am fremden Platz)",
        "Business-Charter (Geschäftsmann/Geschäftsfrau rechtzeitig zu einem Termin fliegen)",
        "Business-Charter (Alltäglicher Flug für einen Architekten, Anwalt oder Bauleiter)",
        "Eilige, aber unspektakuläre Kleinfracht (Dokumente, Ersatzteile)",
        "Kurioses / Verrückter, aber friedlicher Privatflug",
        "Tierrettung / Tiertransport"
    ];

    const missionSel = missionPicker || { baseType: isPOI ? 'poi' : 'apt', category: 'all', profile: 'auto' };
    const isAptTrainingMission = !isPOI && missionSel.baseType === 'apt' && missionSel.category === 'trn';
    const isAptCharterMission = !isPOI && missionSel.baseType === 'apt' && missionSel.category === 'charter';
    const isPoiTrainingMission = isPOI && missionSel.baseType === 'poi' && missionSel.category === 'trn';
    const isTrainingMission = isAptTrainingMission || isPoiTrainingMission;
    const forcedProfile = getMissionTaskProfile(missionSel.profile || 'auto', isPOI ? 'poi' : 'apt');
    const profileThemeOverrides = {
        medical_transfer: ['Medizinischer Personal- oder Materialtransfer mit hoher Prioritaet und ruhigem Flug, ohne Patient an Bord'],
        cargo_fragile: ['Empfindliche Fracht sicher und erschuetterungsarm transportieren'],
        animal_transport: [
            'Tiertransport mit stressarmer, ruhiger Flugfuehrung',
            'Wildtier- oder Vogeltransfer fuer Auffangstation, mit konkreter Tierart',
            'Nutztier- oder Zoo-/Auffangstations-Transfer mit leicht humorvollem, aber glaubhaftem Ton'
        ],
        news_coverage: isPOI ? [
            'Reporter-/Medieneinsatz mit sachlicher Lagebeobachtung',
            'Medienflug fuer ein kurzes aktuelles Luftlagebild am POI',
            'Lokale Redaktion dokumentiert Verkehr, Besucherandrang oder sichtbare Veraenderungen am Ziel',
            'TV-Team sammelt neutrale Establishing Shots, ohne Tourismus- oder Einsatzsprache'
        ] : [
            'Reporter-Shuttle zum Zielflugplatz fuer eine sachliche Berichterstattung am Boden',
            'Medien-Transfer mit Kamera- und Audioausruestung, ohne Luftarbeitsauftrag am Ziel',
            'Redaktioneller A-B-Flug zu einem Termin oder Drehort nahe dem Zielflugplatz'
        ],
        inspection_infra: [
            'Technische Sichtpruefung mit Fokus auf Schaeden, Wartungsbedarf und Stoerungen',
            'Sturmschaden-Check an Bauwerk, Dach, Trasse, Anlage oder exponierten Bauteilen',
            'Wartungsdokumentation fuer Betreiber mit stabilen Foto- und Waermebild-Passes',
            'Baufortschritts- oder Instandhaltungsdokumentation fuer Projektleitung und Betrieb',
            'Sicherheits- und Zustandskontrolle von Bruecke, Damm, Industrieanlage oder Infrastruktur',
            'Brueckenpruefung mit Fokus auf Pfeiler, Widerlager, Fundamente und Brueckendeck',
            'Lagebild zu Brueckensperrung, Rueckstau oder Unterfuehrung ohne Einsatzdramatisierung',
            'Hochwasser-Check an Brueckenpfeilern mit Blick auf Wasserstand und Treibgutlage'
        ],
        media_photo: [
            'Professionelle Foto-/Filmaufnahmen fuer Betreiber, Firma oder Dokumentation',
            'Luftbildserie mit ruhigen Establishing Shots von Zielobjekt und Umgebung',
            'PR- oder Jahresbericht-Aufnahmen mit klaren Perspektiven auf das Objekt',
            'Dokufilm-Shots mit stabilen Boegen, ohne technischen Inspektionsauftrag',
            'Denkmalschutz- oder Betreiberfotos von Bruecke, Viadukt und Umfeld',
            'Bahnviadukt-Establishing-Shots mit klarer Trennung von Bauwerk und Zufahrt'
        ],
        sightseeing_tour: isPOI ? [
            'Entspannter Ausflugs- und Sightseeingflug',
            'Ruhiger Fotostopp fuer Gaeste mit Fokus auf Aussicht und Orientierung',
            'Privater Rundflug zu einem markanten POI ohne Arbeitsauftrag',
            'Panorama-Tour mit weichen Manoevern und gutem Blick auf Ziel und Umgebung'
        ] : [
            'Entspannter Ausflugs- und Sightseeingflug',
            'Privater Tagesausflug mit Fokus auf angenehmen Ablauf und Aussicht',
            'Ruhiger A-B-Ausflug zum Zielflugplatz ohne Arbeitsauftrag'
        ],
        historian_guided_tour: [
            'Historiker-Rundflug mit Bildungsauftrag: historische Fakten, lokale Anekdoten und zeitliche Einordnung am POI',
            'Kulturhistorische Einordnung des POI aus der Luft, ohne technischen Inspektionsauftrag',
            'Vergleich historischer Nutzung und heutiger Landschaftsstruktur am Ziel',
            'Ruhiger Erzaehlflug zu Denkmal, Altstadt, Gewaesser- oder Infrastrukturgeschichte'
        ],
        science_bio: [
            'Biologischer Beobachtungsflug mit ruhiger, sauberer Dokumentation',
            'Oekologische Kurzaufnahme von Vegetation, Ufer, Habitat oder Waldrand',
            'Umweltmonitoring mit Fokus auf Stressindikatoren, Bewuchs und Randzonen',
            'Naturschutz-Beobachtung am POI ohne Einsatzdramatisierung'
        ],
        science_geo: [
            'Geologischer Beobachtungsflug mit Fokus auf Relief und Erosion',
            'Geomorphologische Reliefstudie mit Hang-, Ufer- oder Abbruchkanten',
            'Dokumentation von Kiesgrube, Steinbruch, Talform, Sediment oder Gelaendekante',
            'Ruhige Vergleichsfotos fuer geologische Veraenderungen im Zielgebiet'
        ],
        mapping_survey: [
            'Praeziser Mapping-/Survey-Flug mit stabilen Passes',
            'Photogrammetrie-Flug fuer Orthofoto, Korridor oder Anlagenuebersicht',
            'Lidar- oder Vermessungspass mit reproduzierbaren Linien',
            'Dokumentationsflug zur Kartenaktualisierung mit klarer Zielgeometrie'
        ],
        tour_guide_knowledge: [
            'Bildungsflug zum POI: lernorientierte Fakten, Kontext und Orientierung ohne Arbeitsauftrag',
            'Wissensflug mit kurzen Ortsfakten und sichtbarer Orientierung am Ziel',
            'Lern-Guide erklaert Nutzung, Landschaft und Umgebung des POI ohne Inspektion',
            'Ruhiger Erklaerflug mit Fakten, aber ohne Auftrag zum Suchen, Messen oder Pruefen'
        ],
        search_and_rescue: [
            'SAR-Suchflug entlang Trassen, Flussläufen und Bahnstrecken mit strukturiertem Muster und klarem Lagebild',
            'Rettungsaufklaerung mit Suchsektoren an Waldrand, Ufer, Weg oder Bahnlinie',
            'Vermisstensuche mit klaren Calls, wenigen sichtbaren Hinweisen und ohne ueberladene Einsatzszene',
            'Lagebild fuer Bodenkraefte, bei dem die Zielperson oder ein Hinweis plausibel am Randbereich liegt'
        ],
        fire_watch: [
            'Feuerwacht mit Fokus auf Rauchfahnen und Hotspots',
            'Waldbrand-Frueherkennung entlang Waldrand, Hang oder trockenem Vegetationsstreifen',
            'Brandwache nach Meldung von Rauchgeruch oder moeglicher Glutstelle',
            'Ruhiger Beobachtungsflug fuer Hotspot-Check ohne Grossschadenslage'
        ]
    };
    const poiThemesByCat = {
        bridge: [
            "Infrastruktur-Inspektion (Brücke/Viadukt)",
            "Sturmschaden-Check an Brücke/Viadukt",
            "Baufortschritts- oder Wartungsdokumentation an Brücke/Viadukt",
            "Foto-/Filmaufnahmen für Betreiber oder Ingenieurbüro",
            "Denkmalschutz-Dokumentation eines historischen Viadukts",
            "Pfeilerfundamente und Widerlager aus der Luft dokumentieren",
            "Bahnviadukt mit Trasse, Bögen und Zufahrten erfassen",
            "Unterführung oder Hochstraße als eigenständiges Bauwerk dokumentieren",
            "Brückensperrung mit Zufahrt, Rückstau und Absperrbereichen beobachten",
            "Hochwasser-Check an Brückenpfeilern mit Treibgut- und Wasserstandslage"
        ],
        road: [
            "Infrastruktur-Inspektion (Straßen/Autobahnknoten)",
            "Baustellen- und Verkehrsfluss-Dokumentation",
            "Sturmschaden- oder Hindernis-Check entlang Straße/Trasse",
            "Foto-/Filmaufnahmen für Planungsbüro oder Betreiber"
        ],
        dam: [
            "Infrastruktur-Inspektion (Staudamm/Talsperre)",
            "Wartungs- und Schieberdokumentation an Staudamm/Talsperre",
            "Starkregen-/Sturmschaden-Check an Krone, Wasserseite und Ufer",
            "Foto-/Filmaufnahmen für Wasserbehörde oder Betreiber"
        ],
        telecom: ["Infrastruktur-Inspektion (Funkmast/Funkturm)"],
        industry: [
            "Infrastruktur-Inspektion (Industrieanlage)",
            "Wärmebild- oder Emissionsmessung an Industrieanlage",
            "Baufortschritts- oder Wartungsdokumentation am Werksgelände",
            "Foto-/Filmaufnahmen für Betreiber, Bericht oder PR"
        ],
        infrastructure: [
            "Infrastruktur-Inspektion (Straße/Bahn/Strom)",
            "Kontroll- und Vermessungsflug entlang Verkehrs- und Energietrassen",
            "Sturmschaden-Check an Trasse, Knoten, Dach oder Anlage",
            "Wartungsdokumentation und Störungsprüfung für Betreiber"
        ],
        castle: ["Tourismus & Sightseeing", "Luftbildfotografie (Medien/Immobilien)"],
        water: ["Natur- & Umweltschutz (Beobachtung)", "Wissenschaftliche Datenerfassung"],
        mountain: ["Natur- & Umweltschutz (Beobachtung)", "Luftbildfotografie (Medien/Immobilien)"],
        fire: ["Feuerwacht mit Fokus auf Rauchfahnen und Hotspots", "Natur- & Umweltschutz (Beobachtung)"],
        city: ["Lokales Event / Großveranstaltung von oben", "Luftbildfotografie (Medien/Immobilien)"],
        trn: [
            "Platznahes VFR-Training im Übungsgebiet (Orientierung, Luftraumbezug, saubere Verfahren)",
            "Trainingsflug mit Instructor im Nahbereich des Startflugplatzes"
        ],
        generic: poiCategories
    };
    const aptThemesByCat = {
        club: [
            "Besuch bei einem befreundeten Fliegerverein (Stammtisch, Fly-In, Austausch)",
            "Flugplatz-Logistik (Ersatzteil für die Vereinsmaschine holen, Mechaniker-Shuttle)"
        ],
        private: [
            "Kulinarischer Ausflug ($100 Burger, legendäre Pizza, Steak oder BBQ am Ziel)",
            "Kaffee & Kuchen Run (Klassischer Nachmittagsausflug zum Flugplatz-Café)",
            "Tagesausflug mit Freunden (Wandern, Action oder einfach abhängen am Zielort)",
            "Städtetrip (Sightseeing, Kultur, 1-2 echte Highlights der Zielstadt erkunden)",
            "Wellness-Urlaub / Romantischer Wochenendausflug mit der Frau/dem Partner",
            "Kurioses / Verrückter, aber friedlicher Privatflug"
        ],
        charter: [
            "Business-Charter (Geschäftsmann/Geschäftsfrau rechtzeitig zu einem Termin fliegen)",
            "Business-Charter (Alltäglicher Flug für einen Architekten, Anwalt oder Bauleiter)"
        ],
        cargo: [
            "Eilige, aber unspektakuläre Kleinfracht (Dokumente, Ersatzteile)",
            "Kurierflug ohne Passagiere (zeitkritische Fracht)"
        ],
        trn: [
            "Spezielles Flugtraining (Seitenwind, Navigation, Platzrunden-Drill am fremden Platz)",
            "Trainingsflug mit Instructor (Workload-Management & SOPs)",
            "Reiner Übungsflug ohne Charter-Story"
        ],
        all: aptCategories
    };
    const themePoolBase = isPOI
        ? (poiThemesByCat[missionSel.category] || poiCategories)
        : (aptThemesByCat[missionSel.category] || aptCategories);
    const forcedThemePool = (forcedProfile && forcedProfile.id !== 'auto')
        ? (profileThemeOverrides[forcedProfile.id] || null)
        : null;
    const themePool = Array.isArray(forcedThemePool) && forcedThemePool.length ? forcedThemePool : themePoolBase;
    const randomTheme = themePool[Math.floor(Math.random() * themePool.length)];
    const categoryRule = isPOI
        ? (missionSel.category && missionSel.category !== 'all'
            ? `3b. KATEGORIE-FIX: Die Mission muss zur POI-Kategorie "${missionSel.category}" passen.`
            : '')
        : (missionSel.category && missionSel.category !== 'all'
            ? `3b. KATEGORIE-FIX: Die Mission muss zur APT-Kategorie "${missionSel.category}" passen.`
            : '');

    const maxPaxLimit = paxText.split(' ')[0];
    const targetMissionCat = (missionSel.category && missionSel.category !== 'all')
        ? missionSel.category
        : (isPOI ? 'poi' : 'std');
    const forcedProfileRule = (forcedProfile && forcedProfile.id !== 'auto')
        ? `14. PROFIL-FIX (zwingend): Setze passenger.roleProfile auf "${forcedProfile.roleProfile}" und passenger.taskDomain auf "${forcedProfile.taskDomain}". Rolle/Story daran ausrichten: ${forcedProfile.label}.`
        : '';
    const forcedProfileConsistencyRule = (forcedProfile && forcedProfile.id !== 'auto')
        ? `15. KONSISTENZ-PFLICHT: Kein Themenmix gegen das Profil. Beispiel: Bei Sightseeing KEIN Ersatzteil-/Kurier-/Notfallauftrag; bei Reporter KEIN reiner Touri-Text; bei Mapping/SAR nur passende Einsatzinhalte.`
        : '';
    const forcedProfileOpsRule = (forcedProfile && forcedProfile.id !== 'auto')
        ? _profileOpsRuleForPrompt(forcedProfile, isPOI)
        : '';
    const medicalProfileRule = (forcedProfile?.id === 'medical_transfer')
        ? `16. MEDICAL-KONSISTENZ: Wenn pax nur 1 PAX ist, ist diese Person medizinische Begleitung/Notarzt, NICHT Patient. Keine Patientin/keinen Patienten im Flugzeug erwaehnen, ausser pax ist explizit mindestens 2 PAX und die Story modelliert Patient plus medizinische Begleitung. Bei 1 PAX keine Formulierung "Notarztteam"; nutze "medizinische Begleitung", "Notarzt" oder "Notaerztin".`
        : '';
    const animalProfileRule = (forcedProfile?.id === 'animal_transport')
        ? `16b. TIERTRANSPORT-KONSISTENZ: Nenne eine konkrete Tierart statt generischem Haustier-Standard. Sichtbar spawnbar sind nur Piper-taugliche Katalogtiere: Ziege, Reh/junges Reh, Moewe, Gans. Ente/Schwan werden als heimischer Wasservogel auf Gans/Moewe oder als Transportbox umgesetzt. Schaf ist erlaubt, wird aber als Transportbox/Frachtobjekt umgesetzt. Pferd/Seeloewe niemals als lebendes Bordtier in der Piper; wenn so ein Thema vorkommt, dann nur als Vet-Einsatz, Dokumente oder geschlossene Uebergabekiste. Nicht vorhandene Tiere werden als Cargo-Objekt ersetzt: Cardboard oder Pallet01_03. Bei Ziege oder Schaf darf der Text die engen Bedingungen im Flieger leicht humorvoll erwaehnen. Pax bleibt Tierpfleger/Tierschutz-Kurier und der Flugauftrag bleibt stressarm und glaubhaft.`
        : '';
    const fireHazardRule = (forcedProfile?.id === 'fire_watch' && Number.isFinite(Number(missionFireHazard?.level)))
        ? `16. FEUERLAGE-KONTEXT: Nutze den offiziellen DWD-Waldbrandgefahrenindex am Einsatzgebiet als Realitätsanker (Stufe ${Math.round(Number(missionFireHazard.level))} von 5, Risiko: ${String(missionFireHazard.label || '').trim() || 'n/a'}). Erwaehne den Index natuerlich und knapp in story/greetingText. Keine Dramatisierung.`
        : '';
    const sceneIntentRule = buildMissionSceneIntentPromptGuide(isPOI, forcedProfile);

    const sanitizePassengerProfile = (passenger, storyText = '') => {
        if (!passenger || typeof passenger !== 'object') return null;
        const normalized = enforcePoiPassengerAltitudeRule({ ...passenger, storyHint: String(storyText || '') }, isPOI, poiTerrainFt);
        if (!normalized || typeof normalized !== 'object') return normalized;
        const gRaw = String(normalized.gender || '').trim().toLowerCase();
        normalized.gender = (/^(male|m|mann|maennlich|männlich)$/.test(gRaw))
            ? 'male'
            : (/^(female|f|frau|weiblich)$/.test(gRaw) ? 'female' : 'male');
        delete normalized.storyHint;
        normalized.trainingPlan = sanitizeTrainingPlan(passenger.trainingPlan, isTrainingMission);
        if (isTrainingMission) {
            normalized.roleProfile = 'instructor_calm_precise_v1';
            normalized.taskDomain = 'training';
        } else if (isAptCharterMission) {
            normalized.roleProfile = 'charter_professional_neutral_v1';
            normalized.taskDomain = 'charter';
        }
        if (normalized.trainingPlan) {
            normalized.targetAltFt = 0;
            normalized.targetRadiusNm = 0;
            normalized.targetDwellMin = 0;
        }
        if (isAptCharterMission) {
            const charter = buildCharterPassenger(normalized);
            charter.trainingPlan = null;
            return charter;
        }
        return normalized;
    };
    const stripPilotNameFromText = (text) => {
        const s = String(text || '').trim();
        if (!s) return s;
        return s
            .replace(/\b(Moin|Morgen|Hallo|Hi|Hey|Servus|Sali)\s*,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/g, '$1')
            .replace(/\bdanke\s+fuers\s+mitnehmen,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/gi, 'danke fuers Mitnehmen')
            .replace(/\bdanke\s+fürs\s+mitnehmen,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/gi, 'danke fürs Mitnehmen')
            .replace(/\bmit\s+[A-ZÄÖÜ][a-zäöüß'-]{2,}\s+raus\b/g, 'mit dir raus')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };
    const sanitizeGenericPoiNarrative = (text) => {
        let s = String(text || '').trim();
        if (!s) return s;
        const genericDest = /^(poi|zielgebiet|staudamm\/talsperre|gewaesser|gewasser|berg-\/talgebiet|funkmast\/funkturm\/windrad|industrieanlage|wasserreservoir)$/i.test(String(destName || '').trim());
        if (!isPOI || !genericDest) return s;
        s = s
            .replace(/\b(?:bei|nahe|rund um|im bereich von|entlang(?:\s+der|\s+des)?)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]*){0,3}\b/g, 'im Zielgebiet')
            .replace(/\b(?:im|ins|am|an der|entlang der)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]*tal\b/g, 'im Zielgebiet')
            .replace(/\b(?:Donau|Rhein|Elbe|Isar|Neckar|Murgtal|Renchtal|Mühlbachtal)\b/gi, 'Zielgebiet')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();
        if (!/\bZielgebiet\b/i.test(s)) {
            s = `${s}${s ? ' ' : ''}Wir bleiben im markierten Zielgebiet.`;
        }
        return s;
    };
    const sanitizeMissionPayloadText = (payload) => {
        if (!payload || typeof payload !== 'object') return payload;
        const p = { ...payload };
        p.title = stripPilotNameFromText(p.title || '');
        p.story = stripPilotNameFromText(p.story || '');
        p.title = _cleanupNarrativeArtifacts(p.title || '');
        p.story = _cleanupNarrativeArtifacts(p.story || '');
        p.title = sanitizeGenericPoiNarrative(p.title || '');
        p.story = sanitizeGenericPoiNarrative(p.story || '');
        if (p.passenger && typeof p.passenger === 'object') {
            p.passenger = { ...p.passenger };
            p.passenger.greetingText = stripPilotNameFromText(p.passenger.greetingText || '');
            p.passenger.greetingText = sanitizeGenericPoiNarrative(p.passenger.greetingText || '');
        }
        return p;
    };
    const greetingObjectiveTokens = (...texts) => {
        const stop = new Set([
            'heute', 'fliegen', 'flug', 'ziel', 'zielgebiet', 'einsatz', 'auftrag',
            'bitte', 'ruhig', 'sauber', 'stabil', 'klar', 'calls', 'muster',
            'aussicht', 'aussichten', 'ausblick', 'ausblicke', 'panorama', 'panoramablick',
            'entspannt', 'entspannter', 'geniessen', 'genieszen', 'genießen', 'sicht',
            'tempo', 'sightseeing', 'gaeste', 'gaste', 'gaesten', 'gasten', 'rundflug',
            'ueber', 'uber', 'eine', 'einen', 'einer', 'der', 'die', 'das', 'und',
            'mit', 'zum', 'zur', 'von', 'fuer', 'fur', 'nach', 'entlang', 'bereich'
        ]);
        return [...new Set(texts
            .join(' ')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9äöüß ]/g, ' ')
            .split(/\s+/)
            .map(t => t.trim())
            .filter(t => t.length >= 5 && !stop.has(t))
        )].slice(0, 24);
    };
    const greetingLooksMissionSpecific = (greeting, storyText = '', targetLabel = '', intent = null) => {
        const gNorm = String(greeting || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const intentText = [
            intent?.summary,
            intent?.environment,
            Array.isArray(intent?.visibleIdeas) ? intent.visibleIdeas.join(' ') : ''
        ].join(' ');
        const tokens = greetingObjectiveTokens(targetLabel, storyText, intentText);
        return tokens.some(t => gNorm.includes(t));
    };
    const objectiveSentenceForGreeting = (storyText = '', titleText = '', targetLabel = '', intent = null) => {
        const normalize = (value) => String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const intentText = [
            intent?.summary,
            intent?.environment,
            Array.isArray(intent?.visibleIdeas) ? intent.visibleIdeas.join(' ') : ''
        ].join(' ');
        const objectiveTokens = greetingObjectiveTokens(targetLabel, titleText, intentText);
        const storySentences = String(storyText || '')
            .replace(/\s+/g, ' ')
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s && !/^(hi|hallo|moin|morgen|servus|sali|hey)[!.]?$/i.test(s));
        const missionSentence = storySentences.find(s => {
                const n = normalize(s);
                return objectiveTokens.some(t => n.includes(t));
            })
            || storySentences.find(s => /(such|inspek|kontroll|kartier|lagebild|beobacht|versorg|trasse|leitung|strom|wind|rauch|brand|unfall|rett|sar|ufer|brueck|brück|baustell|rundflug|aussicht|ausblick|panorama|wander|wald|wiese|weide|vieh|kueh|kühe|gehoeft|gehöft)/i.test(s))
            || storySentences[0]
            || String(intent?.summary || titleText || targetLabel || '').trim();
        let s = String(missionSentence || '').replace(/\s+/g, ' ').trim();
        s = s
            .replace(/^Wir haben einen Einsatzbefehl für die\s+/i, 'heute fliegen wir die ')
            .replace(/^Wir haben einen Einsatzbefehl fuer die\s+/i, 'heute fliegen wir die ')
            .replace(/^Wir haben einen Einsatzbefehl für den\s+/i, 'heute fliegen wir den ')
            .replace(/^Wir haben einen Einsatzbefehl fuer den\s+/i, 'heute fliegen wir den ')
            .replace(/^Wir haben einen Einsatzbefehl für das\s+/i, 'heute fliegen wir das ')
            .replace(/^Wir haben einen Einsatzbefehl fuer das\s+/i, 'heute fliegen wir das ')
            .replace(/^Wir haben einen Auftrag für die\s+/i, 'heute fliegen wir die ')
            .replace(/^Wir haben einen Auftrag fuer die\s+/i, 'heute fliegen wir die ');
        s = s.replace(/\.$/, '').trim();
        if (s.length > 230) s = `${s.slice(0, 227).replace(/\s+\S*$/, '')}...`;
        return s;
    };
    const enrichPassengerGreetingText = (passenger, { storyText = '', titleText = '', targetLabel = '', sceneIntent = null } = {}) => {
        if (!passenger || typeof passenger !== 'object') return passenger;
        const g = String(passenger.greetingText || '').trim();
        if (!g) return passenger;
        if (greetingLooksMissionSpecific(g, storyText, targetLabel, sceneIntent)) return passenger;
        const objective = objectiveSentenceForGreeting(storyText, titleText, targetLabel, sceneIntent);
        if (!objective) return passenger;
        const openerMatch = g.match(/^(hi|hallo|moin|morgen|servus|sali)\b/i);
        const opener = openerMatch ? openerMatch[0] : 'Hi';
        return {
            ...passenger,
            greetingText: `${opener}, ${objective}.`
        };
    };
    const enforceTrainingInstructorPayload = (payload) => {
        if (!isTrainingMission || !payload || typeof payload !== 'object') return payload;
        const normalized = { ...payload };
        normalized.pax = '1 PAX (Instruktor)';
        if (!normalized.cargo || /kein cargo|none|0 lbs/i.test(String(normalized.cargo))) {
            normalized.cargo = 'Trainingsunterlagen (10 lbs)';
        }
        const aiPassenger = (normalized.passenger && typeof normalized.passenger === 'object') ? normalized.passenger : {};
        const personaPassenger = buildInstructorPassenger(aiPassenger.trainingPlan || null);
        normalized.passenger = {
            ...personaPassenger,
            // KI-Trainingsplan bevorzugen, damit Aufgabeninhalt erhalten bleibt.
            trainingPlan: sanitizeTrainingPlan(aiPassenger.trainingPlan || personaPassenger.trainingPlan, true),
            // Komfortwerte aus KI optional übernehmen, ansonsten Persona-Defaults.
            gTolerance: String(aiPassenger.gTolerance || personaPassenger.gTolerance || 'mittel').toLowerCase(),
            bankTolerance: String(aiPassenger.bankTolerance || personaPassenger.bankTolerance || 'mittel').toLowerCase(),
            cargoSensitivity: String(aiPassenger.cargoSensitivity || personaPassenger.cargoSensitivity || 'niedrig').toLowerCase(),
            stomachSensitivity: String(aiPassenger.stomachSensitivity || personaPassenger.stomachSensitivity || 'mittel').toLowerCase(),
            comfortPriority: String(aiPassenger.comfortPriority || personaPassenger.comfortPriority || 'mittel').toLowerCase(),
            urgencyPriority: String(personaPassenger.urgencyPriority || 'niedrig').toLowerCase(),
            roleProfile: 'instructor_calm_precise_v1',
            taskDomain: 'training'
        };
        return normalized;
    };
    const enforceCharterPayload = (payload) => {
        if (!isAptCharterMission || !payload || typeof payload !== 'object') return payload;
        const normalized = { ...payload };
        normalized.passenger = buildCharterPassenger(normalized.passenger || null);
        if (!normalized.pax || /^\s*0\s*PAX\b/i.test(String(normalized.pax))) {
            normalized.pax = `1 PAX (${normalized.passenger.role})`;
        }
        return normalized;
    };
    const enforceMedicalTransferPayload = (payload) => {
        if (forcedProfile?.id !== 'medical_transfer' || !payload || typeof payload !== 'object') return payload;
        const normalized = { ...payload };
        normalized.title = String(normalized.title || '').replace(/\bKrankentransport\b/gi, 'Medizintransfer').trim();
        normalized.pax = '1 PAX (medizinische Begleitung)';
        if (!normalized.cargo || /kein cargo|none|0 lbs/i.test(String(normalized.cargo))) {
            normalized.cargo = 'Medizinischer Notfallkoffer (22 lbs)';
        }
        if (normalized.passenger && typeof normalized.passenger === 'object') {
            normalized.passenger = {
                ...normalized.passenger,
                roleProfile: 'medical_sensitive_v1',
                taskDomain: 'medical_transfer'
            };
        }
        const story = String(normalized.story || '').trim();
        if (/\bpatient(?:in|en|)\b/i.test(story)) {
            const material = String(normalized.cargo || 'medizinisches Material').replace(/\s*\([^)]*\)\s*$/, '').trim();
            normalized.story = `Wir bringen heute medizinische Begleitung und ${material} nach ${promptDestName}. Der Transfer ist zeitkritisch, aber der Flug muss ruhig und sauber bleiben. Am Ziel wartet das medizinische Empfangsteam am Flugplatz, damit die Uebergabe ohne Umwege klappt.`;
        }
        return normalized;
    };

    const poiAltRule = (isPOI && !isTrainingMission)
        ? (Number.isFinite(poiTerrainFt)
            ? `POI-Einsatzparameter: targetAltFt (MSL) darf NICHT unter ${Math.round(poiTerrainFt + 500)} ft liegen, weil am POI mindestens 500 ft AGL gelten. targetRadiusNm (2 präzise Punkte, 3 Stadtgebiet, 4-5 Landschaft), targetDwellMin (0 Überflug, 1-2 kurz, 3-5 professionell).`
            : "POI-Einsatzparameter: targetAltFt konservativ wählen; niemals so niedrig, dass es unter 500 ft AGL wäre. targetRadiusNm (2 präzise Punkte, 3 Stadtgebiet, 4-5 Landschaft), targetDwellMin (0 Überflug, 1-2 kurz, 3-5 professionell).")
        : "A-B-REGEL: Kein POI-Arbeitsauftrag. targetAltFt MUSS 0 sein, targetRadiusNm MUSS 0 sein, targetDwellMin MUSS 0 sein.";

    const trainingHardRules = isTrainingMission
        ? `10. TRAININGSFLUG-PFLICHT: Das ist ein klarer Trainingsflug mit Fluglehrer.${isPoiTrainingMission ? ` POI liegt im platznahen Übungsgebiet bei ${startName}, am Ende wieder Landung in ${startName}.` : ' Keine Charter-, Cargo- oder POI-Sightseeing-Story.'}
    11. TRAININGSINHALT MUSS KONKRET SEIN:
       - Wähle mode: "airwork" ODER "pattern".
       - Bei mode "airwork": Übungen in der Luft, z.B. Stall-Training, Steep Turns/Vollkreis, Slow Flight, Navigationsaufgabe.
         trigger MUSS "half_route" sein (Instruktor meldet sich auf halber Strecke).
       - Bei mode "pattern": Übungen platznah im Anflug/Platzrunde, z.B. Engine-Out-Approach, No-Flaps, Extra-Platzrunden, Touch-and-Go, Missed Approach.
         trigger MUSS "five_nm_before_landing" sein (Instruktor meldet sich 5 NM vor Ziel).
         Wichtig: Die eigentliche Landung erfolgt ERST nach Abschluss der Übung am Platz.
       - Gib 2-4 konkrete Übungen in "focus" an (keine Dubletten).
       - Verteile sinnvoll:
         * Option A: nur Airwork (z.B. 2 reine Airwork-Uebungen)
         * Option B: Mix aus Airwork + genau 1 Landeuebung (z.B. 3 Uebungen: 2 Airwork, 1 Pattern/Landung)
       - Gib dazu eine kurze Instruktor-Ansage in "instructorLine".
    12. TRAININGS-PAX: Es MUSS genau EIN Passagier mitfliegen: der Instruktor / die Instruktorin. pax MUSS "1 PAX (Instruktor)" oder gleichwertig sein.
        Der passenger darf NICHT null sein und role MUSS klar Instructor/Fluglehrer sein.
        Variiere das Geschlecht gelegentlich (auch Fluglehrerin).
        cargo nur unkritisch (z.B. "Trainingsunterlagen"), kein echter Frachtauftrag.`
        : `10. KEIN TRAININGSDRIFT: Falls es kein Trainingsflug ist, darf KEIN Trainingsauftrag mit Fluglehrer, Übungen, Platzrunden-Drills oder Checkflug-Inhalten erzeugt werden.`;
    const poiNoTrainingRule = (isPOI && !isTrainingMission)
        ? `13. POI-GUARDRAIL: Bei POI-Missionen sind Trainingsinhalte strikt verboten (kein Instructor, keine Airwork-/Platzrunden-Aufgaben).`
        : '';
    const promptDestName = isPoiTrainingMission ? `Übungsgebiet nahe ${startName}` : destName;
    const poiLat = Number(poiTargetMeta?.lat);
    const poiLon = Number(poiTargetMeta?.lon);
    const poiHasCoords = Number.isFinite(poiLat) && Number.isFinite(poiLon);
    const missionTruth = poiTargetMeta?.missionTruth || null;
    const targetGeoContext = poiTargetMeta?.targetGeoContext || null;
    const missionPlanV2 = poiTargetMeta?.missionPlanV2 || null;
    const compactMissionPlanV2 = compactMissionPlanV2ForPrompt(missionPlanV2);
    const compactTruth = compactMissionTruthForPrompt(missionTruth);
    const poiNameIsGeneric = /^(poi|zielgebiet|staudamm\/talsperre|gewaesser|gewasser|berg-\/talgebiet|funkmast\/funkturm\/windrad|industrieanlage)$/i.test(String(promptDestName || '').trim());
    const poiConsistencyRule = isPOI
        ? (compactTruth?.mainTarget
            ? `4b. POI-KONSISTENZ (zwingend): Der urspruengliche Suchtreffer ist "${promptDestName}" bei ${poiHasCoords ? `${poiLat.toFixed(5)}, ${poiLon.toFixed(5)}` : 'unbekannten Koordinaten'}, aber die gepruefte Hauptlage ist missionTruth.mainTarget. Story, greetingText und sceneIntent muessen diese Hauptlage als Arbeits-/Sichtziel nutzen. Wenn mainTarget vom Suchtreffer abweicht, erklaere es natuerlich als Ufer, Rand, Zufahrt oder naheliegenden Zielbereich; keinen zweiten Primaerort erfinden.`
            : (poiHasCoords
            ? (poiNameIsGeneric
                ? `4b. POI-KONSISTENZ (zwingend): Zielpunkt ist exakt bei ${poiLat.toFixed(5)}, ${poiLon.toFixed(5)}. Nenne KEINEN konkreten Orts-/Gewässernamen, wenn keiner vorgegeben ist; keine Formulierungen wie "bei <Ort>", "im <Tal>" oder konkrete Flussnamen. Bleibe strikt bei "das Zielgebiet"/"${promptDestName}".`
                : `4b. POI-KONSISTENZ (zwingend): Ziel ist exakt "${promptDestName}" bei ${poiLat.toFixed(5)}, ${poiLon.toFixed(5)}. Story und Begrüßung dürfen KEINEN anderen Orts-/Gewässernamen als Primärziel nennen.`)
            : `4b. POI-KONSISTENZ (zwingend): Verwende exakt "${promptDestName}" als Zielbezug und nenne keinen alternativen Primär-Ortsnamen.`))
        : '';
    const missionTruthRule = (isPOI && compactTruth)
        ? `4c. MISSION-TRUTH: Nutze missionTruth als Gedaechtnis fuer diesen Auftrag. Sichtbare Objekte nur situativ und grob aus visibleCues ableiten (z.B. Person, Fahrzeug, Boot, Rauch), niemals alle Spawn-Objekte listen.`
        : '';
    const missionPlanV2Rule = (compactMissionPlanV2 && compactMissionPlanV2.status === 'ready')
        ? `4d. PIPELINE-V2-PLAN: Nutze missionPlanV2 als ausgefuelltes Planformular. taskDomain, roleProfile, primaryObjective, targetLabel, sceneKind, objectFamilies und lockedFields sind Leitplanken. Weiche nur ab, wenn sie technisch widerspruechlich sind.`
        : '';
    const localKnowledgeRule = isPoiTrainingMission
        ? `4. FOKUS-REGEL TRAINING: Kein Ortswissen, keine Sehenswürdigkeiten, keine Geschichte zum Punkt. Fokus nur auf Übungsthema, Verfahren, Luftraum, Maschine und Sicherheit.`
        : `4. LOKALES WISSEN: Baue 1-2 echte geografische, infrastrukturelle oder kulturelle Fakten zu "${promptDestName}" ganz natürlich ein.`;

    const prompt = `<INSTRUKTIONEN>
Du bist ein freundlicher, entspannter Flugdienstleiter in einem lokalen Fliegerclub oder kleinen Charterunternehmen.
Antwortsprache: Deutsch.
Ton: alltagsnah, locker, glaubwürdig; keine Actionfilm-Rhetorik.

REGELN:
1) Thema-Pflicht: Der Auftrag MUSS zum Thema "${randomTheme}" passen.
2) ${localKnowledgeRule}
3) ${categoryRule || 'Kategorienkonsistenz beachten.'}
3b) ${poiConsistencyRule || 'Zielkonsistenz beachten.'}
3c) ${missionTruthRule || 'Gepruefte Zielinformationen beachten, falls vorhanden.'}
3d) ${missionPlanV2Rule || 'Kein Pipeline-V2-Plan aktiv.'}
4) ${isPOI ? `RUNDFLUG-REGEL: Start/Landung in ${startName}; am POI wird nicht gelandet.` : `ROUTEN-REGEL: Normaler Streckenflug von ${startName} nach ${promptDestName}.`}
5) Erfinde passende PAX/Fracht (max ${maxPaxLimit} Personen). Falls niemand mitfliegt: "0 PAX".
6) Erfinde genau einen Hauptpassagier.${isTrainingMission ? ' Bei Training IMMER Instruktor (nicht null).' : ' (oder null bei 0 PAX).'}
6b) passenger.gender ist PFLICHT und MUSS exakt "male" oder "female" sein (keine anderen Werte).
7) Leite diese Felder datengetrieben aus Auftrag/Rolle/Fracht/Wetter ab:
   - gTolerance, bankTolerance, cargoSensitivity, stomachSensitivity, comfortPriority: jeweils niedrig|mittel|hoch
   - urgencyPriority: niedrig|hoch
   - roleProfile aus erlaubter Liste
   - taskDomain aus erlaubter Liste
   ${poiAltRule}
8) DRINGLICHKEITS-REGEL FÜR STORY:
   - Wenn urgencyPriority = hoch: story MUSS genau einen kurzen Zeitkritik-Hinweis enthalten (z.B. "zeitkritisch", "müssen pünktlich ankommen").
   - Wenn urgencyPriority = niedrig: story DARF keinen Zeitdruck erwähnen.
9) Wetter als Realitätsanker nutzen, aber nicht überdramatisieren.
10) Optional dialectHint: neutral oder leichte regionale Färbung; nie starker Dialekt.
11) Keine zusätzlichen Eigennamen für den Piloten erfinden (nur "du").
12) Interne Regel-/Verbotssätze NIE wörtlich im story-Feld wiederholen.
13) Trennung strikt einhalten: Alles in <INSTRUKTIONEN> sind Arbeitsregeln und dürfen nicht als Storytext erscheinen.
13b) greetingText MUSS die konkrete Aufgabe kurz nennen: was suchen, beobachten, prüfen oder fotografieren wir und in welchem Zielkontext. Keine rein generischen Begrüßungen wie "Suchmuster und klare Calls" ohne Objekt/Ort/Trasse/Anlass.
13c) Story, greetingText und sceneIntent muessen dieselbe Lage beschreiben. Das gilt fuer alle Missionstypen. Erst das Primaerziel definieren, dann passende Kontextobjekte, dann nur bei Bedarf Support. Wenn sceneIntent sichtbare Personen, Suchtrupps, Fahrzeuge, Zelte, Rauchsignale, Tiere, Werkzeug, Fracht oder Ausruestung vorsieht, muss die Story/Greeting diese Elemente natuerlich stuetzen. Fuege keine Support-Objekte hinzu, die den Auftrag schon erledigt wirken lassen oder im Briefing nicht vorkommen.
${trainingHardRules}
${poiNoTrainingRule}
${forcedProfileRule}
${forcedProfileConsistencyRule}
${forcedProfileOpsRule}
${medicalProfileRule}
${animalProfileRule}
${fireHazardRule}
${sceneIntentRule}
</INSTRUKTIONEN>

<KONTEXT>
Start: ${startName}
Ziel: ${promptDestName} ${isPOI ? '(POI/Wendepunkt)' : '(Zielflughafen)'}
Distanz: ${dist} NM
Wetter Start (${startName}): ${_summarizeMissionWeather(missionWeather?.dep || null)}
Wetter Ziel (${promptDestName}): ${_summarizeMissionWeather(missionWeather?.dest || null)}
missionTruth: ${JSON.stringify(compactTruth)}
missionPlanV2: ${JSON.stringify(compactMissionPlanV2)}
targetGeoContext: ${JSON.stringify(targetGeoContext ? {
    summary: summarizeMissionTargetGeoContext(targetGeoContext),
    anchors: targetGeoContext.anchors || {},
    hints: targetGeoContext.hints || []
} : null)}
Erlaubte roleProfile:
["general_passenger_v1","instructor_calm_precise_v1","charter_professional_neutral_v1","technical_inspector_v1","media_observer_v1","science_field_v1","vip_business_v1","club_utility_v1","medical_sensitive_v1","news_reporter_professional_v1","tour_guide_relaxed_v1","tour_guide_learning_v1","historian_storyteller_v1","photogrammetry_precision_v1","cargo_fragile_highcare_v1","rescue_coordination_v1","fire_observer_ops_v1","club_student_v1"]
Erlaubte taskDomain:
["general","training","charter","inspection_infra","media_photo","science_bio","science_geo","science_general","club_utility","medical_transfer","news_coverage","sightseeing_tour","poi_learning_guide","historian_guided_tour","mapping_survey","cargo_fragile","search_and_rescue","fire_watch","animal_transport","club_training_basic","club_training_advanced"]
</KONTEXT>

<OUTPUT>
Antworte AUSSCHLIESSLICH als JSON ohne Markdown.
{
  "title": "Kreativer Titel",
  "story": "Briefing, max 3-4 Sätze",
  "pax": "z.B. '2 PAX (...)' oder '0 PAX'",
  "cargo": "z.B. 'Kamera-Gimbal (80 lbs)'",
  "sceneIntent": {
    "summary": "Kurze Klartextbeschreibung, was am Ziel sichtbar sein soll oder warum nichts gespawnt werden sollte",
    "environment": "z.B. Seeufer, Wald, Baustelle, Strasse, leer",
    "visibleIdeas": ["konkrete Ideen als Klartext, keine Asset-Namen"],
    "avoid": ["unpassende Dinge, die nicht auftauchen sollen"],
    "densityHint": "none|sparse|normal|busy",
    "notes": "kurzer Grund"
  },
  "passenger": {
    "name": "Vollständiger Name",
    "role": "Beruf/Rolle",
    "gender": "male|female",
    "personality": "3 Adjektive",
    "dialectHint": "neutral oder leicht regional",
    "roleProfile": "aus erlaubter Liste",
    "taskDomain": "aus erlaubter Liste",
    "gTolerance": "niedrig|mittel|hoch",
    "bankTolerance": "niedrig|mittel|hoch",
    "cargoSensitivity": "niedrig|mittel|hoch",
    "stomachSensitivity": "niedrig|mittel|hoch",
    "comfortPriority": "niedrig|mittel|hoch",
    "urgencyPriority": "niedrig|hoch",
    "targetAltFt": 3500,
    "targetRadiusNm": 3.0,
    "targetDwellMin": 2,
    "greetingText": "Persönliche Begrüßung an den Piloten, mit konkretem Auftrag und Zielkontext",
    "trainingPlan": {
      "mode": "airwork|pattern",
      "trigger": "half_route|five_nm_before_landing",
      "focus": ["Übung 1", "Übung 2"],
      "instructorLine": "Kurze konkrete Instruktoranweisung"
    }
  }
}
</OUTPUT>`;

    const buildGeminiMissionResult = (parsed, sourceLabel) => {
        let passenger = sanitizePassengerProfile(parsed.passenger, parsed.story);
        const sceneIntent = sanitizeMissionSceneIntentSpec(
            parsed.sceneIntent || parsed.targetSceneIntent || parsed.sceneDescription || parsed.targetScene || null,
            { isPOI, taskDomain: passenger?.taskDomain || parsed.passenger?.taskDomain }
        );
        passenger = enrichPassengerGreetingText(passenger, {
            storyText: parsed.story,
            titleText: parsed.title,
            targetLabel: promptDestName,
            sceneIntent
        });
        const draftTargetScene = sanitizeMissionTargetSceneSpec(null, { isPOI, taskDomain: passenger?.taskDomain || parsed.passenger?.taskDomain });
        return {
            t: parsed.title,
            s: parsed.story,
            pax: parsed.pax,
            cargo: parsed.cargo,
            sceneIntent,
            targetScene: draftTargetScene,
            sceneCompositionStatus: 'draft',
            targetSceneDebug: {
                source: sourceLabel,
                sceneIntentRaw: parsed.sceneIntent || parsed.targetSceneIntent || parsed.sceneDescription || null,
                sceneIntent,
                aiRaw: parsed.targetScene || null,
                normalized: draftTargetScene,
                pendingComposer: true
            },
            passenger,
            i: "📋",
            cat: targetMissionCat,
            _missionPlanV2: missionPlanV2 || null,
            _source: sourceLabel
        };
    };

    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } };
    const reqOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    try {
        const resFlash3 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, reqOptions);
        if (resFlash3.ok) {
            const data = await resFlash3.json();
            const parsed = sanitizeMissionPayloadText(enforceMedicalTransferPayload(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text)))));
            incrementApiUsage('flash');
            return buildGeminiMissionResult(parsed, "Gemini 3.0 Flash");
        }
    } catch (e) { }

    try {
        const resFlash = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, reqOptions);
        if (resFlash.ok) {
            const data = await resFlash.json();
            const parsed = sanitizeMissionPayloadText(enforceMedicalTransferPayload(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text)))));
            incrementApiUsage('flash');
            return buildGeminiMissionResult(parsed, "Gemini 2.5 Flash");
        }
    } catch (e) { }

    try {
        const resLite = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, reqOptions);
        if (resLite.ok) {
            const data = await resLite.json();
            const parsed = sanitizeMissionPayloadText(enforceMedicalTransferPayload(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text)))));
            incrementApiUsage('lite');
            return buildGeminiMissionResult(parsed, "Gemini 2.5 Flash Lite");
        }
    } catch (e) { }
    return null;
}

/* =========================================================
   6. HAUPT-LOGIK & ZÄHLER
   ========================================================= */
function getQuotaDay() {
    const now = new Date();
    if (now.getHours() < 9) now.setDate(now.getDate() - 1);
    return now.toISOString().split('T')[0];
}

function getApiUsage() {
    const today = getQuotaDay();
    let data = JSON.parse(localStorage.getItem('ga_api_fuel'));

    if (!data || data.date !== today || data.flash === undefined) {
        data = { date: today, flash: 0, lite: 0 };
        localStorage.setItem('ga_api_fuel', JSON.stringify(data));
    }
    return data;
}

function incrementApiUsage(modelType) {
    const today = getQuotaDay();
    let data = getApiUsage();
    if (modelType === 'flash') data.flash++;
    else if (modelType === 'lite') data.lite++;
    localStorage.setItem('ga_api_fuel', JSON.stringify({ date: today, flash: data.flash, lite: data.lite }));
    updateApiFuelMeter();
}

function updateApiFuelMeter() {
    const needle = document.getElementById('apiNeedle');
    if (!needle) return;
    const data = getApiUsage();
    let used = data.flash + data.lite;
    const maxCalls = 40;

    if (used > maxCalls) used = maxCalls;
    let percentage = used / maxCalls;

    let angle = 45 - (percentage * 90);
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
}

async function fetchAirportFreq(icao, elementId, type) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = '📻 Sucht Frequenz...';
    const proxy = 'https://ga-proxy.einherjer.workers.dev';
    const icaoQuery = String(icao || '').trim().toUpperCase();

    const freqLabelMap = {
        'TWR': 'Turm', 'TOWER': 'Turm',
        'GND': 'Rollkontrolle', 'GROUND': 'Rollkontrolle',
        'ATIS': 'Information', 'INFO': 'Information',
        'RADIO': 'Radio', 'CTAF': 'Radio', 'UNICOM': 'Radio', 'MULTICOM': 'Radio',
        'APP': 'Anflug', 'APPROACH': 'Anflug',
        'DEP': 'Abflug', 'DEPARTURE': 'Abflug',
        'FIS': 'FIS', 'APRON': 'Vorfeld', 'AWOS': 'AWOS'
    };

    try {
        const res = await fetch(`${proxy}/api/airports?search=${encodeURIComponent(icaoQuery)}&limit=25&t=${Date.now()}`);
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
            const items = Array.isArray(data.items) ? data.items : [];
            const pickIcao = (apt) => String(
                apt?.icao ||
                apt?.icaoCode ||
                apt?.ident ||
                apt?.code ||
                apt?.designator ||
                apt?.gpsCode ||
                apt?.localCode ||
                ''
            ).trim().toUpperCase();
            const exact = items.find(apt => pickIcao(apt) === icaoQuery);
            // Für 4-stellige ICAO-Abfragen nur exakte Treffer zulassen
            const strictIcaoSearch = /^[A-Z0-9]{4}$/.test(icaoQuery);
            const apt = exact || (!strictIcaoSearch ? items[0] : null);
            if (!apt) {
                if (el) el.innerText = '';
                freqCache[icaoQuery] = [];
                return null;
            }

            // Elevation aus OpenAIP (unit 0 = Meter, 1 = Fuß)
            if (apt.elevation != null) {
                const ev = apt.elevation.value;
                const elevFt = apt.elevation.unit === 1 ? ev : Math.round(ev * 3.28084);
                if (type === 'dep')  { currentDepElev  = elevFt; }
                if (type === 'dest') { currentDestElev = elevFt; }
            }

            if (apt.frequencies && apt.frequencies.length > 0) {

                // Bestimme die relevanteste Frequenz (Tower > Info > Radio)
                const prio = { 'TOWER': 1, 'TWR': 1, 'INFO': 2, 'INFORMATION': 2, 'ATIS': 2, 'RADIO': 3, 'CTAF': 3, 'UNICOM': 3, 'MULTICOM': 3, 'APP': 4, 'APPROACH': 4 };
                let bestF = apt.frequencies[0];
                let bestScore = 99;
                apt.frequencies.forEach(f => {
                    const n = (f.name || '').toUpperCase().trim();
                    const score = prio[n] || 99;
                    if (score < bestScore) { bestScore = score; bestF = f; }
                });

                // Speichere NUR den Zahlenwert für die Routen-Tabelle
                const bestFreqValue = bestF.value;
                if (type === 'dep') currentDepFreq = bestFreqValue;
                if (type === 'dest') currentDestFreq = bestFreqValue;

                updateRoutePerformance();

                // Für die Detail-Anzeige auf der Karte alle formatieren
                const labeledFreqs = apt.frequencies.map(f => {
                    const fName = (f.name || '').toUpperCase().trim();
                    const label = freqLabelMap[fName] || f.name || 'Freq';
                    return { label: label, value: f.value };
                });
                const lines = labeledFreqs.map(lf => `📻 ${lf.label}: ${lf.value}`);
                if (el) el.innerHTML = lines.join('<br>');

                freqCache[icaoQuery] = labeledFreqs;
                return bestFreqValue;
            }
        }
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    } catch (e) {
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    }
    return null;
}

/* =========================================================
   OPENAIP AIRSPACE LOGIC
   ========================================================= */
let activeAirspaces = [];
let airspaceMapLayers = [];
let routeToolFocusLayer = null;
let highlightedAirspaceIdx = -1; // track which airspace is toggled on
let vpHighlightPulseIdx = -1; // airspace index pulsing in profile canvas
let vpPulseAnimFrame = null; // requestAnimationFrame ID
let vpPulsePhase = 0; // 0..1 for pulse animation
const _airspaceFreqFallbackInFlight = new Set();

function vpStartHighlightPulse() {
    vpStopHighlightPulse();
    vpPulsePhase = 0.25; // Startet direkt mit voller Leuchtkraft

    function toggleBlink() {
        vpPulsePhase = (vpPulsePhase === 0.25) ? 0 : 0.25; // Wechselt zwischen 0 und 0.25 (an/aus)
        if (typeof renderMapProfile === 'function') renderMapProfile();
        if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
    }

    toggleBlink(); // Sofortiges erstes Rendern
    vpPulseAnimFrame = setInterval(toggleBlink, 700); // Alle 700ms entspannt umschalten statt 60x pro Sekunde
}

function vpStopHighlightPulse() {
    if (vpPulseAnimFrame) {
        clearInterval(vpPulseAnimFrame);
        vpPulseAnimFrame = null;
    }
    vpPulsePhase = 0;
}

function clearAirspaceMapLayers() {
    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    highlightedAirspaceIdx = -1;
    vpHighlightPulseIdx = -1;
    vpStopHighlightPulse();
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));
    if (typeof renderMapProfile === 'function') renderMapProfile();
    if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
}

function clearRouteToolPointFocus() {
    if (map && routeToolFocusLayer) {
        map.removeLayer(routeToolFocusLayer);
    }
    routeToolFocusLayer = null;
}

function clearRouteToolMapFocus() {
    clearRouteToolPointFocus();
    if (highlightedAirspaceIdx !== -1 || airspaceMapLayers.length) clearAirspaceMapLayers();
}

window.gaClearRouteToolMapFocus = clearRouteToolMapFocus;

function toggleAirspaceHighlight(idx) {
    if (!activeAirspaces[idx]) return;

    // If same airspace is already highlighted, toggle it off
    if (highlightedAirspaceIdx === idx) {
        clearAirspaceMapLayers();
        return;
    }

    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));

    const airspace = activeAirspaces[idx];
    highlightedAirspaceIdx = idx;

    if (map) {
        const coords = airspace.geometry.coordinates;
        let polys = [];
        if (airspace.geometry.type === 'Polygon') {
            polys = [coords[0].map(c => [c[1], c[0]])];
        } else if (airspace.geometry.type === 'MultiPolygon') {
            polys = coords.map(pc => pc[0].map(c => [c[1], c[0]]));
        }
        const info = getAirspaceStyle(airspace);
        polys.forEach(ring => {
            const layer = L.polygon(ring, {
                color: info.mapColor || '#ff4444', weight: 3, fillColor: info.mapColor || '#ff4444',
                fillOpacity: 0.25, dashArray: '6,4', className: 'airspace-highlight-pulse'
            }).addTo(map);
            const displayName = getAirspaceDisplayName(airspace);
            layer.bindTooltip(`<b>${info.icon} ${displayName}</b>`, { sticky: true, className: 'airspace-tooltip' });
            airspaceMapLayers.push(layer);
        });
    }

    const row = document.querySelector(`.as-row[data-as-idx="${idx}"]`);
    if (row) row.classList.add('as-active');

    vpHighlightPulseIdx = idx;
    vpStartHighlightPulse();
}

function getAirspaceLeafletBounds(airspace) {
    if (!airspace?.geometry || typeof L === 'undefined') return null;
    const bounds = L.latLngBounds([]);
    const addRing = (ring) => {
        if (!Array.isArray(ring)) return;
        ring.forEach(c => {
            if (!Array.isArray(c) || c.length < 2) return;
            const lat = Number(c[1]);
            const lon = Number(c[0]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) bounds.extend([lat, lon]);
        });
    };
    if (airspace.geometry.type === 'Polygon') {
        addRing(airspace.geometry.coordinates?.[0]);
    } else if (airspace.geometry.type === 'MultiPolygon') {
        airspace.geometry.coordinates.forEach(poly => addRing(poly?.[0]));
    }
    return bounds.isValid() ? bounds : null;
}

window.gaFocusAirspaceOnMap = function(idx) {
    const numericIdx = Number(idx);
    const airspace = activeAirspaces[numericIdx];
    if (!airspace || !map) return false;
    clearRouteToolPointFocus();
    if (highlightedAirspaceIdx !== numericIdx) toggleAirspaceHighlight(numericIdx);
    const bounds = getAirspaceLeafletBounds(airspace);
    if (bounds) {
        map.fitBounds(bounds.pad(0.18), {
            padding: [48, 48],
            maxZoom: 12,
            animate: true,
            duration: 0.45
        });
    }
    return true;
};

window.gaFocusAirportOnMap = function(airport) {
    const lat = Number(airport?.lat);
    const lon = Number(airport?.lon ?? airport?.lng);
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lon) || typeof L === 'undefined') return false;
    clearRouteToolMapFocus();
    routeToolFocusLayer = L.circleMarker([lat, lon], {
        radius: 13,
        color: '#ffffff',
        weight: 3,
        fillColor: '#ff334f',
        fillOpacity: 0.72,
        className: 'route-tool-map-focus-pulse'
    }).addTo(map);
    const label = `${airport?.icao || ''}${airport?.name ? ` · ${airport.name}` : ''}`.trim();
    if (label) routeToolFocusLayer.bindTooltip(label, { permanent: false, sticky: true, className: 'airspace-tooltip' });
    map.setView([lat, lon], Math.max(map.getZoom() || 10, 12), { animate: true });
    return true;
};

// Erkennt Fallschirmsprunggebiete an Namen wie "PARA SCHWENNINGEN", "PARA ROTTWEIL"
function isParaAirspace(a) {
    return /\bPARA\b/i.test(a.name || '');
}

function getAirspaceDisplayName(a) {
    const style = getAirspaceStyle(a);
    let name = a.name || 'Unbekannt';
    // Entferne überflüssige Begriffe, ABER behalte die Klassen-Buchstaben (wie C oder D) bei!
    name = name.replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS)\b/ig, '');
    if (isParaAirspace(a)) name = name.replace(/\bPARA\b/ig, '').trim();
    return `${name.trim()} [${style.category}]`;
}

function normalizeAirspaceNameForFreq(name) {
    return String(name || '')
        .toUpperCase()
        .replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS|HX)\b/g, ' ')
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function inferAirspaceLimitIsAgl(as, lim, boundary) {
    if (!as || !lim) return false;
    if (lim.referenceDatum === 0) return true;
    if (lim.referenceDatum !== 1) return false;

    const t = as.type;
    const isTypicalLowAirspace = [0, 4, 5, 6, 7, 26, 27, 28].includes(t);
    if (!isTypicalLowAirspace) return false;

    const value = Number(lim.value);
    if (!Number.isFinite(value)) return false;

    // OpenAIP liefert "GND" vereinzelt als 0 FT MSL statt 0 FT AGL.
    if (boundary === 'lower' && value === 0) return true;

    // Obergrenze nur bei TMZ/RMZ heuristisch auf AGL drehen.
    // Für CTR/TMA/CTA nie auto-AGL, sonst werden legitime MSL-Decken verfälscht.
    if (boundary === 'upper' && lim.unit !== 6 && value > 0) {
        const canAutoUpperAgl = [5, 6, 27, 28].includes(t);
        if (!canAutoUpperAgl) return false;
        const lower = as.lowerLimit || null;
        const lowerLooksGnd = !!lower && Number(lower.value) === 0 && (lower.referenceDatum === 0 || lower.referenceDatum === 1);
        const upperFt = lim.unit === 1 ? value : (lim.unit === 0 ? value * 3.28084 : value);
        if (lowerLooksGnd && upperFt <= 4000) return true;
    }

    return false;
}

function applyAirspaceLimitHeuristics(as) {
    if (!as) return;
    const lowerIsAgl = inferAirspaceLimitIsAgl(as, as.lowerLimit, 'lower');
    const upperIsAgl = inferAirspaceLimitIsAgl(as, as.upperLimit, 'upper');
    as._lowerIsAgl = !!lowerIsAgl;
    as._upperIsAgl = !!upperIsAgl;
    if (as.lowerLimit && lowerIsAgl) as.lowerLimit.referenceDatum = 0;
    if (as.upperLimit && upperIsAgl) as.upperLimit.referenceDatum = 0;
}

function getAirspaceApproxCenter(as) {
    if (!as?.geometry) return null;
    const pts = [];
    if (as.geometry.type === 'Polygon' && Array.isArray(as.geometry.coordinates?.[0])) {
        as.geometry.coordinates[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
    } else if (as.geometry.type === 'MultiPolygon') {
        as.geometry.coordinates.forEach(poly => {
            if (Array.isArray(poly?.[0])) poly[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
        });
    }
    if (!pts.length) return null;
    let sumLon = 0, sumLat = 0;
    pts.forEach(p => { sumLon += Number(p[0]) || 0; sumLat += Number(p[1]) || 0; });
    return { lon: sumLon / pts.length, lat: sumLat / pts.length };
}

function approxNmBetween(lat1, lon1, lat2, lon2) {
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
    const meanLatRad = ((lat1 + lat2) * 0.5) * Math.PI / 180;
    const dLatNm = (lat2 - lat1) * 60;
    const dLonNm = (lon2 - lon1) * 60 * Math.cos(meanLatRad);
    return Math.hypot(dLatNm, dLonNm);
}

function toAirspaceFreqList(freqEntries) {
    if (!Array.isArray(freqEntries)) return [];
    return freqEntries
        .filter(f => f && f.value)
        .map(f => ({ name: f.name || f.label || 'INFO', value: f.value, primary: !!f.primary }));
}

function getAirportFrequencyFallbackByIcao(icao) {
    const code = String(icao || '').trim().toUpperCase();
    if (!code) return [];
    const cached = freqCache?.[code];
    return toAirspaceFreqList(cached);
}

function pickAirportForAirspaceFallback(as) {
    if (!as || !globalAirports) return null;
    const center = getAirspaceApproxCenter(as);
    const asNorm = normalizeAirspaceNameForFreq(as.name);
    const tokens = asNorm.split(' ').filter(t => t.length >= 4);
    if (!tokens.length && !center) return null;

    let best = null;
    let bestScore = Infinity;

    for (const key in globalAirports) {
        const apt = globalAirports[key];
        const icao = String(apt?.icao || key || '').trim().toUpperCase();
        if (!icao) continue;

        const aptNorm = normalizeAirspaceNameForFreq(`${apt.name || ''} ${apt.city || ''} ${icao}`);
        const nameHit = tokens.length ? tokens.some(t => aptNorm.includes(t) || asNorm.includes(icao)) : true;
        if (!nameHit) continue;

        let distScore = 0;
        if (center && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
            const nm = approxNmBetween(center.lat, center.lon, Number(apt.lat), Number(apt.lon));
            if (!Number.isFinite(nm) || nm > 40) continue;
            distScore = nm;
        }

        const score = distScore;
        if (score < bestScore) {
            bestScore = score;
            best = { icao, apt };
        }
    }
    return best;
}

function pickPreferredAirspaceFrequency(freqs, airspaceType) {
    if (!Array.isArray(freqs) || freqs.length === 0) return null;
    const list = freqs.filter(f => f && f.value);
    if (!list.length) return null;

    const wantsTowerLike = [4, 7, 26].includes(airspaceType) || airspaceType === 0;
    if (wantsTowerLike) {
        const towerRx = /\b(TWR|TOWER|TURM)\b/i;
        const appRx = /\b(APP|APPROACH|ANFLUG)\b/i;
        const infoRx = /\b(INFO|INFORMATION|RADIO)\b/i;
        return list.find(f => towerRx.test(f.name || ''))
            || list.find(f => appRx.test(f.name || ''))
            || list.find(f => infoRx.test(f.name || ''))
            || list.find(f => f.primary)
            || list[0];
    }

    return list.find(f => f.primary) || list[0];
}

function getAirspaceFreqInfo(a) {
    const t = a.type;
    if (!a.frequencies || a.frequencies.length === 0) return '';

    // For CTR/TMA/CTA (type 4, 7, 26) and type 0 with icaoClass 3: show Tower/Approach freq
    if ([4, 7, 26].includes(t) || (t === 0 && a.icaoClass === 3)) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            const label = primary.name || 'TWR';
            return `<span style="color:#f2c12e; font-weight:bold; font-size:10px;">📻 ${label}: ${primary.value}</span>`;
        }
    }

    // For TMZ (type 5 or 27): show squawk if available, otherwise freq
    if (t === 5 || t === 27) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            return `<span style="color:#9966ff; font-weight:bold; font-size:10px;">📻 ${primary.name || 'XPDR'}: ${primary.value}</span>`;
        }
    }
    // For RMZ (type 6 or 28) and FIS (type 33): show freq
    // Para-Zonen (PARA-RMZ): orangene Farbe + 🪂 Icon
    if ([6, 28, 33].includes(t)) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            const isPara = isParaAirspace(a);
            const col  = isPara ? '#ffaa00' : '#66cccc';
            const icon = isPara ? '🪂' : '📻';
            return `<span style="color:${col}; font-weight:bold; font-size:10px;">${icon} ${primary.name || 'INFO'}: ${primary.value}</span>`;
        }
    }

    return '';
}

function getAirspaceStyle(a) {
    const t = a.type;
    const classLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const cls = (a.icaoClass !== undefined && classLetters[a.icaoClass]) ? '-' + classLetters[a.icaoClass] : '';
    
    if (t === 1) return { color: '#ff3333', icon: '⛔', mapColor: '#ff3333', category: 'ED-R / Restricted' };
    if (t === 2) return { color: '#ff6600', icon: '⛔', mapColor: '#ff6600', category: 'Danger' };
    if (t === 3) return { color: '#cc0000', icon: '🚫', mapColor: '#cc0000', category: 'Prohibited' };
    
    // CTRs (Kontrollzonen am Boden) bleiben gelb
    if (t === 4) return { color: '#f2c12e', icon: '⚠️', mapColor: '#f2c12e', category: `CTR${cls}` };
    
    // Class C und D (die keine CTR sind) als eigenständige Lufträume hervorheben (Blautöne)
    if (a.icaoClass === 2) return { color: '#0055ff', icon: '⚠️', mapColor: '#0055ff', category: 'Class C' };
    if (a.icaoClass === 3) return { color: '#1a73e8', icon: '⚠️', mapColor: '#1a73e8', category: 'Class D' };

    if (t === 7) return { color: '#4da6ff', icon: '⚠️', mapColor: '#4da6ff', category: `TMA${cls}` };
    if (t === 26) return { color: '#4da6ff', icon: '⚠️', mapColor: '#4da6ff', category: `CTA${cls}` };
    if (t === 5 || t === 27) return { color: '#9966ff', icon: '📡', mapColor: '#9966ff', category: 'TMZ' };
    if ((t === 6 || t === 28) && isParaAirspace(a)) return { color: '#ffaa00', icon: '🪂', mapColor: '#ffaa00', category: 'Para' };
    if (t === 6 || t === 28) return { color: '#66cccc', icon: '📡', mapColor: '#66cccc', category: 'RMZ' };
    if (t === 33) return { color: '#888', icon: '🌐', mapColor: '#888', category: 'FIS' };
    
    return { color: '#aaa', icon: '📋', mapColor: '#aaa', category: `Type ${t}` };
}

async function fetchRouteAirspaces(routePts) {
    const listEl = document.getElementById('routeAirspacesList');
    const container = document.getElementById('routeAirspacesContainer');

    if (!routePts || routePts.length < 2) return;

    if (container) {
        container.style.display = 'block';
        listEl.innerHTML = '<span style="color:#888;">Berechne Lufträume (OpenAIP)...</span>';
    }

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    routePts.forEach(p => {
        let lat = p.lat, lon = p.lng || p.lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    });

    minLat -= 0.15; maxLat += 0.15;
    minLon -= 0.25; maxLon += 0.25;

    try {
        let allItems = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages && page <= 5) {
            const url = `https://ga-proxy.einherjer.workers.dev/api/airspaces?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=200&page=${page}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            if (!data || !data.items) break;
            allItems = allItems.concat(data.items);
            totalPages = data.totalPages || 1;
            page++;
        }

        if (allItems.length === 0) {
            listEl.innerHTML = '<span style="color:#888;">Keine Daten gefunden.</span>';
            return;
        }

        const airspaces = allItems;
        const intersecting = [];

        const testPoints = [];
        for (let i = 0; i < routePts.length - 1; i++) {
            const p1 = routePts[i], p2 = routePts[i + 1];
            const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
            const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
            const dist = calcNav(lat1, lon1, lat2, lon2).dist;

            const steps = Math.max(2, Math.ceil(dist));
            for (let j = 0; j <= steps; j++) {
                const f = j / steps;
                testPoints.push({ lat: lat1 + (lat2 - lat1) * f, lon: lon1 + (lon2 - lon1) * f });
            }
        }

        function pointInPolygon(pt, polygon) {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i][0], yi = polygon[i][1];
                const xj = polygon[j][0], yj = polygon[j][1];
                const intersect = ((yi > pt.lat) !== (yj > pt.lat))
                    && (pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        // Segment-segment intersection (for catching small airspaces between sample points)
        function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
            const d1x = x2-x1, d1y = y2-y1, d2x = x4-x3, d2y = y4-y3;
            const cross = d1x*d2y - d1y*d2x;
            if (Math.abs(cross) < 1e-12) return false;
            const t = ((x3-x1)*d2y - (y3-y1)*d2x) / cross;
            const u = ((x3-x1)*d1y - (y3-y1)*d1x) / cross;
            return t >= 0 && t <= 1 && u >= 0 && u <= 1;
        }
        function routeCrossesPolygon(polygon) {
            for (let i = 0; i < routePts.length - 1; i++) {
                const p1 = routePts[i], p2 = routePts[i + 1];
                const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
                const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
                if (pointInPolygon({lat: lat1, lon: lon1}, polygon)) return true;
                if (pointInPolygon({lat: lat2, lon: lon2}, polygon)) return true;
                for (let j = 0, k = polygon.length - 1; j < polygon.length; k = j++) {
                    if (segmentsIntersect(lon1, lat1, lon2, lat2, polygon[k][0], polygon[k][1], polygon[j][0], polygon[j][1])) return true;
                }
            }
            return false;
        }

        // Relevant: 0 (CTR HX sectors), 1 (ED-R), 2 (Danger), 3 (Prohibited),
        // 4 (CTR), 5 (TMZ), 6 (RMZ alt code), 7 (TMA), 26 (CTA), 27 (TMZ alt code), 28 (RMZ), 33 (FIS)
        // Excluded: 10 (FIR)
        const relevantTypes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33]);

        const addedIds = new Set();
        for (const as of airspaces) {
            if (addedIds.has(as._id)) continue;
            if (!relevantTypes.has(as.type)) continue;
            // Type 0: Class C (2) und Class D (3) explizit zulassen
            if (as.type === 0 && as.icaoClass !== 2 && as.icaoClass !== 3) continue;

            let hits = false;
            if (as.geometry && as.geometry.type === 'Polygon') {
                hits = routeCrossesPolygon(as.geometry.coordinates[0]);
            } else if (as.geometry && as.geometry.type === 'MultiPolygon') {
                for (const polyContainer of as.geometry.coordinates) {
                    if (routeCrossesPolygon(polyContainer[0])) { hits = true; break; }
                }
            }

            if (hits) {
                intersecting.push(as);
                addedIds.add(as._id);
            }
        }

        const sortOrder = { 3: 1, 1: 2, 2: 3, 4: 4, 0: 5, 5: 8, 7: 6, 26: 7, 27: 8, 6: 9, 28: 9, 33: 10 };
        intersecting.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99));

        // Deduplicate by name: type 0 (icaoClass 3) and type 4 often represent the same CTR in OpenAIP
        // Keep type 4, but inherit frequencies from the duplicate if type 4 has none
        const byName = new Map();
        for (const as of intersecting) {
            // Deduplizierungs-Key:
            // • Typ 0 / Typ 4 (Airspace/CTR): Name + Klasse + untere Grenze — fasst OpenAIP-Duplikate
            //   desselben CTRs zusammen (type 0 ↔ type 4 mit gleichen Grenzen).
            // • Alle anderen Typen (TMA, TMZ, RMZ …): _id verwenden — jeder Sektor bleibt erhalten,
            //   auch wenn mehrere Sektoren denselben Namen tragen (z.B. Stuttgart TMA Außenring Nord/Süd).
            const lowerVal = (as.lowerLimit && as.lowerLimit.value !== undefined) ? as.lowerLimit.value : 0;
            const isCtrlDup = (as.type === 0 || as.type === 4);
            const key = isCtrlDup
                ? (as.name || as._id) + '_' + (as.icaoClass || as.type) + '_' + lowerVal
                : (as._id || (as.name || 'x') + '_' + (as.icaoClass || as.type) + '_' + lowerVal);
            if (!byName.has(key)) {
                byName.set(key, as);
            } else {
                const existing = byName.get(key);
                if (as.type === 4 && existing.type !== 4) {
                    if ((!as.frequencies || as.frequencies.length === 0) && existing.frequencies?.length > 0)
                        as.frequencies = existing.frequencies;
                    byName.set(key, as);
                } else if (existing.type === 4 && as.type !== 4) {
                    if ((!existing.frequencies || existing.frequencies.length === 0) && as.frequencies?.length > 0)
                        existing.frequencies = as.frequencies;
                }
            }
        }
        activeAirspaces = [...byName.values()];

        // Zusätzlicher Frequenz-Fallback:
        // Wenn ein CTR/TMA/CTA-Eintrag ohne Frequenz durchrutscht, versuche aus
        // gleich benannten/intersektierenden Sektoren die Frequenzen zu übernehmen.
        const byNormNameWithFreq = new Map();
        for (const src of intersecting) {
            if (!src?.frequencies || src.frequencies.length === 0) continue;
            const norm = normalizeAirspaceNameForFreq(src.name);
            if (!norm) continue;
            if (!byNormNameWithFreq.has(norm)) byNormNameWithFreq.set(norm, src.frequencies);
        }
        activeAirspaces.forEach(as => {
            if (as?.frequencies && as.frequencies.length > 0) return;
            const isCtaCtrFamily = [0, 4, 7, 26].includes(as?.type);
            if (!isCtaCtrFamily) return;
            const norm = normalizeAirspaceNameForFreq(as.name);
            const fallbackFreqs = norm ? byNormNameWithFreq.get(norm) : null;
            if (fallbackFreqs && fallbackFreqs.length > 0) {
                as.frequencies = fallbackFreqs;
            }
        });

        // AGL-/GND-Heuristik auf gematchte Airspaces anwenden.
        activeAirspaces.forEach(as => applyAirspaceLimitHeuristics(as));

        // Zweiter Frequenz-Fallback: CTR/TMA/CTA ohne Frequenz → passender Flugplatz.
        activeAirspaces.forEach(as => {
            if (!as || (as.frequencies && as.frequencies.length > 0)) return;
            if (![0, 4, 7, 26].includes(as.type)) return;

            const pick = pickAirportForAirspaceFallback(as);
            if (!pick?.icao) return;

            const immediate = getAirportFrequencyFallbackByIcao(pick.icao);
            if (immediate.length > 0) {
                as.frequencies = immediate;
                return;
            }

            // Noch nicht im Cache: einmalig nachladen und Liste danach neu rendern.
            if (typeof fetchAirportFreq !== 'function') return;
            if (freqCache[pick.icao] !== undefined) return;
            if (_airspaceFreqFallbackInFlight.has(pick.icao)) return;

            _airspaceFreqFallbackInFlight.add(pick.icao);
            const asId = as._id;
            fetchAirportFreq(pick.icao, null, null)
                .catch(() => null)
                .finally(() => {
                    _airspaceFreqFallbackInFlight.delete(pick.icao);
                    const fetched = getAirportFrequencyFallbackByIcao(pick.icao);
                    if (!fetched.length) return;
                    const target = activeAirspaces.find(a => a && a._id === asId);
                    if (target && (!target.frequencies || target.frequencies.length === 0)) {
                        target.frequencies = fetched;
                    }
                    if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
                });
        });

        window._activeAirspacesVersion = (window._activeAirspacesVersion || 0) + 1;
        clearAirspaceMapLayers();
        renderAirspaceWarningsList();
        if (typeof renderMapProfile === 'function' && typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible) renderMapProfile();
        if (typeof renderVerticalProfile === 'function' && document.getElementById('vpCanvas')) renderVerticalProfile();

    } catch (e) {
        console.error("OpenAIP Error", e);
        listEl.innerHTML = '<span style="color:#d93829;">Fehler beim Laden der Luftraumdaten.</span>';
    }
}

function renderAirspaceWarningsList() {
        // Performance-Fix: Keine schweren DOM-Updates während User-Scroll/Drag!
        if (window.vpIsFastRendering || window.vpUIInteractionActive) return;
        const listEl = document.getElementById('routeAirspacesList');
        if (!listEl) return;

        if (!activeAirspaces || activeAirspaces.length === 0) {
            listEl.innerHTML = '<span style="color:#33ff33;">✅ Route frei – keine Konflikte erkannt.</span>';
            return;
        }

        const filterCheckbox = document.getElementById('navLogAirspaceFilter');
        const filterActive = filterCheckbox && filterCheckbox.checked;

        // FIX: Wir müssen garantieren, dass wir dasselbe Array (Normal oder High-Res Zoom) nutzen wie das visuelle Profil!
        const elevDataToUse = (typeof vpZoomLevel !== 'undefined' && vpZoomLevel < 100 && typeof vpHighResData !== 'undefined' && vpHighResData) ? vpHighResData : vpElevationData;

        let fpResult = null;
        if (filterActive && elevDataToUse && elevDataToUse.length >= 2) {
            const cruiseAlt = parseInt(document.getElementById('altSliderMap')?.value || document.getElementById('altSlider')?.value || 4500);
            const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
            fpResult = computeFlightProfile(elevDataToUse, cruiseAlt, vpClimbRate, vpDescentRate, tas);
        }

        let finalAirspaces = activeAirspaces;

        if (filterActive && fpResult && fpResult.profile) {
            // PERFORMANCE FIX: Kompletten Polygon-Check entfernt! Wir nutzen den bestehenden 2D-Schnittstellen-Cache.
            const totalDist = elevDataToUse[elevDataToUse.length - 1].distNM;
            const cachedAirspaces = getCachedAirspaceIntersections(elevDataToUse, totalDist);

        finalAirspaces = activeAirspaces.filter(a => {
            // 1. Ist der Luftraum überhaupt im 2D-Cache? (Wenn nicht, überfliegen wir ihn in 2D gar nicht)
            const cached = cachedAirspaces.find(ca => ca.as === a);
            if (!cached) return false; 

            // 2. Hat der Luftraum gültige Höhengrenzen?
            if (cached.lowerFt === null || cached.upperFt === null) return true;

            let intersects = false;
            
            // 3. Prüfe NUR die paar Wegpunkte, die in 2D bereits als "innerhalb des Luftraums" markiert wurden!
            for (const pt of cached.relevantPts) {
                // Finde die Flughöhe an diesem spezifischen Punkt
                const pp = fpResult.profile.find(profPt => profPt.distNM === pt.distNM);
                if (!pp) continue;
                
                const realLower = cached.isLowerAgl ? pt.elevFt + cached.lowerFt : cached.lowerFt;
                const realUpper = cached.isUpperAgl ? pt.elevFt + cached.upperFt : cached.upperFt;
                
                // Wenn unsere Flug-Linie zwischen Boden und Decke des Luftraums liegt -> Konflikt!
                if (pp.altFt >= realLower && pp.altFt <= realUpper) {
                    intersects = true; 
                    break;
                }
            }
            return intersects;
        });
    }

    if (finalAirspaces.length === 0) {
        listEl.innerHTML = '<span style="color:#33ff33;">✅ Route auf dieser Flughöhe frei.</span>';
        return;
    }

    let html = '';
    finalAirspaces.forEach((a) => {
        const idx = activeAirspaces.indexOf(a); // Keep original idx for map toggling
        const style = getAirspaceStyle(a);
        const displayName = getAirspaceDisplayName(a);
        const freqInfo = getAirspaceFreqInfo(a);

        let limitStr = '';
        const fmtLmt = (lim) => {
            if (!lim) return '?';
            if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
            if (lim.unit === 6) return `FL ${lim.value}`;
            let u = lim.unit === 1 ? 'FT' : (lim.unit === 6 ? 'FL ' : 'M');
            let r = lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '');
            return `${lim.value} ${u}${r}`;
        };

        if (a.lowerLimit && a.upperLimit) {
            limitStr = `<span style="color:#555; font-size:9px; white-space:nowrap;">[${fmtLmt(a.lowerLimit)} – ${fmtLmt(a.upperLimit)}]</span>`;
        }

        const catLabel = `<span style="font-size:9px; color:#888;">${style.category}</span>`;
        const freqLine = freqInfo ? `<div style="margin-top:1px;">${freqInfo}</div>` : '';

        html += `<div class="as-row" data-as-idx="${idx}" 
                    onclick="toggleAirspaceHighlight(${idx}); event.stopPropagation();"
                    style="padding: 5px 4px; border-bottom: 1px dashed #bbb; cursor:pointer; transition: background 0.15s;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span style="color:${style.color}; line-height:1.3;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${style.color}; margin-right:4px; vertical-align:middle;"></span>${style.icon} <b>${displayName}</b>
                            <span style="margin-left:4px;">${catLabel}</span>
                        </span>
                        ${limitStr}
                    </div>
                    ${freqLine}
                </div>`;
    });
    listEl.innerHTML = html;
}

async function generateMission() {
    const dispatchRunId = _startDispatchRun();
    let _dispatchDeferredFinalize = false;
    const _ensureDispatchAlive = () => {
        if (_isDispatchRunAlive(dispatchRunId)) return;
        const err = new Error('Dispatch abgebrochen');
        err.name = 'AbortError';
        throw err;
    };
    try {
    const btn = document.getElementById('generateBtn');
    const rBtn = document.getElementById('radioGenerateBtn');
    if (btn) { btn.disabled = true; btn.innerText = "Sucht Route & Daten..."; }
    setDispatchLampState('working');
    if (rBtn) {
        rBtn.classList.add('disabled');
        rBtn.style.pointerEvents = 'none';
        const label = rBtn.querySelector('.audio-btn-label');
        if (label) label.textContent = "CALC...";
    }
    document.getElementById("briefingBox").style.display = "none";

    setMissionNoteFrontIndex(0);

    document.getElementById("mDepRwy").innerText = "Sucht Pisten-Infos..."; document.getElementById("mDepRwy").style.color = "#fff";
    document.getElementById("mDestRwy").innerText = "Sucht Pisten-Infos..."; document.getElementById("mDestRwy").style.color = "#fff";

    if (document.getElementById("wikiDepDescText")) document.getElementById("wikiDepDescText").innerText = "Lade Start-Info...";
    if (document.getElementById("wikiDestDescText")) document.getElementById("wikiDestDescText").innerText = "Lade Ziel-Info...";

    const indicator = document.getElementById('searchIndicator');
    const needle = document.getElementById('meterNeedle');
    const led = document.getElementById('meterLed');
    if (led) led.classList.remove('led-green', 'led-blue', 'led-red');

    document.querySelectorAll('.marker-light').forEach(l => {
        l.classList.remove('on');
        l.classList.add('blinking');
    });

    if (window.meterInterval) clearInterval(window.meterInterval);
    window.meterInterval = setInterval(() => {
        const randomAngle = Math.floor(Math.random() * 60) - 20;
        if (needle) needle.style.transform = `translateX(-50%) rotate(${randomAngle}deg)`;
    }, 120);

    currentStartICAO = document.getElementById("startLoc").value.toUpperCase();
    const start = await getAirportData(currentStartICAO);
    _ensureDispatchAlive();
    if (!start) {
        setDispatchLampState('error');
        alert("Startplatz unbekannt!"); resetBtn(btn);
        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`; return;
    }

    const rangePref = document.getElementById("distRange").value, regionPref = document.getElementById("regionFilter").value;
    const targetType = document.getElementById("targetType").value, dirPref = document.getElementById("dirPref").value;
    const missionPicker = parseMissionPickerValue(targetType);
    const maxSeats = parseInt(document.getElementById("maxSeats").value);
    const selectedTas = parseInt(document.getElementById("tasSlider").value) || 160;
    const selectedGph = parseInt(document.getElementById("gphSlider").value) || 14;

    let targetDest = document.getElementById("destLoc").value.toUpperCase();
    let forcePOI = false;
    if (targetDest && targetDest === currentStartICAO) {
        targetDest = '';
        forcePOI = true;
    }
    let dataSource = targetDest ? "Manuell" : "Generiert";

    let minNM, maxNM;
    if (rangePref === "any") {
        const roll = Math.random(); if (roll < 0.33) { minNM = 10; maxNM = 50; } else if (roll < 0.66) { minNM = 50; maxNM = 100; } else { minNM = 100; maxNM = 250; }
    } else {
        if (rangePref === "short") { minNM = 10; maxNM = 50; } if (rangePref === "medium") { minNM = 50; maxNM = 100; } if (rangePref === "long") { minNM = 100; maxNM = 250; }
    }

    const effectiveType = (forcePOI || missionPicker.baseType === "poi") ? "poi" : "apt";
    let selectedPoiCategory = effectiveType === 'poi' ? (missionPicker.category || 'all') : 'all';
    const selectedAptCategory = effectiveType === 'apt' ? (missionPicker.category || 'all') : 'all';
    const selectedMissionProfile = String(missionPicker.profile || 'auto').toLowerCase();
    const seededProfileId = (selectedMissionProfile === 'auto')
        ? pickAutoMissionTaskProfileId({
            isPOI: effectiveType === 'poi',
            selectedAptCategory,
            selectedPoiCategory,
            missionCat: ''
        })
        : selectedMissionProfile;
    const dispatchProfileId = String(seededProfileId || 'auto').toLowerCase();
    const requestedPoiCategory = selectedPoiCategory;
    if (effectiveType === 'poi') {
        selectedPoiCategory = pickPoiCategoryForTaskProfile(dispatchProfileId, selectedPoiCategory);
    }
    // POI-Category-Guard: Bei "all" und explizitem Fire-Watch-Profil vermeiden wir
    // unpassende POI-Typen (z.B. Castle) und suchen primär in berg-/waldnahen Zielen.
    if (effectiveType === 'poi' && selectedPoiCategory === 'all' && dispatchProfileId === 'fire_watch') {
        selectedPoiCategory = 'fire';
    }
    const missionPickerResolved = {
        ...missionPicker,
        category: selectedPoiCategory,
        profile: dispatchProfileId,
        profileRequested: selectedMissionProfile,
        categoryRequested: requestedPoiCategory
    };
    // Guardrail: Bei POI-Missionen darf ein evtl. noch befülltes Zielfeld
    // (z.B. vom vorherigen A-B-Flug) NICHT als Ziel ausgewertet werden.
    if (effectiveType === "poi" && targetDest) {
        targetDest = '';
        dataSource = "Generiert";
    }
    let searchMin = effectiveType === "poi" ? minNM / 2 : minNM, searchMax = effectiveType === "poi" ? maxNM / 2 : maxNM, dest = null;
    let missionFireHazard = null;
    if (effectiveType === 'poi' && selectedPoiCategory === 'trn') {
        // Platznahes POI-Training: Übungsgebiet bewusst nahe am Startplatz halten.
        searchMin = Math.max(3, Math.round(minNM * 0.2));
        searchMax = Math.min(22, Math.max(searchMin + 2, Math.round(maxNM * 0.35)));
    }

    if (targetDest) { dest = await getAirportData(targetDest); _ensureDispatchAlive(); } else {
        if (effectiveType === "apt") {
            dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, dirPref, regionPref);
            _ensureDispatchAlive();
        } else if (selectedPoiCategory === 'trn') {
            // POI-Training nutzt absichtlich nur ein synthetisches Übungsgebiet, kein echtes Objekt.
            dest = pickRandomTrainingPoiNearAirport(start.lat, start.lon, dirPref, searchMin, searchMax);
            dataSource = "Training Area RNG";
        } else {
            // Primär: eigene gehostete, tag-basierte Tiles.
            // Fallback: bestehendes Wiki/Wikidata/Nominatim-System.
            const poiSearchAnchor = buildPoiRingSearchAnchor(start.lat, start.lon, searchMin, searchMax, dirPref, 20);
            const taggedTilePoi = await findTaggedTilePOI(start.lat, start.lon, searchMin, searchMax, dirPref, selectedPoiCategory, dispatchProfileId, poiSearchAnchor);
            _ensureDispatchAlive();
            if (taggedTilePoi) {
                dest = taggedTilePoi;
            } else if (selectedPoiCategory === 'fire') {
                const fireCandidates = [];
                for (let i = 0; i < 3; i++) {
                    const c = await findWikipediaPOI(start.lat, start.lon, searchMin, searchMax, dirPref, 'fire');
                    _ensureDispatchAlive();
                    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) fireCandidates.push(c);
                }
                const seen = new Set();
                const dedup = [];
                for (const c of fireCandidates) {
                    const key = `${String(c.n || '').trim().toLowerCase()}|${Number(c.lat).toFixed(4)}|${Number(c.lon).toFixed(4)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    dedup.push(c);
                }
                let bestPick = null;
                for (const c of dedup) {
                    const hz = await fetchDwdWbiForLocation(c.lat, c.lon);
                    _ensureDispatchAlive();
                    const fireScore = scoreFirePOITitle(c.n);
                    const hazardLevel = Number.isFinite(Number(hz?.level)) ? Number(hz.level) : 0;
                    const totalScore = (fireScore * 10) + (hazardLevel * 20) + Math.random();
                    if (!bestPick || totalScore > bestPick.totalScore) {
                        bestPick = { poi: c, fireHazard: hz || null, totalScore };
                    }
                }
                if (bestPick && bestPick.poi) {
                    dest = bestPick.poi;
                    missionFireHazard = bestPick.fireHazard || null;
                } else {
                    dest = await findWikipediaPOI(start.lat, start.lon, searchMin, searchMax, dirPref, selectedPoiCategory);
                    _ensureDispatchAlive();
                }
            } else {
                dest = await findWikipediaPOI(start.lat, start.lon, searchMin, searchMax, dirPref, selectedPoiCategory);
                _ensureDispatchAlive();
            }
        }
    }

    // APT-Fallbackkette: reduziert "Kein Ziel gefunden" bei engen Filtern
    // oder wenn Richtung/Region aktuell zu restriktiv sind.
    if (!dest && !targetDest && effectiveType === "apt") {
        dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, 'any', regionPref);
        _ensureDispatchAlive();
    }
    if (!dest && !targetDest && effectiveType === "apt" && regionPref !== 'any') {
        dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, 'any', 'any');
        _ensureDispatchAlive();
    }
    if (!dest && !targetDest && effectiveType === "apt") {
        dest = await findGithubAirport(start.lat, start.lon, 5, 350, 'any', 'any');
        _ensureDispatchAlive();
    }

    if (!dest && !targetDest && effectiveType === "poi" && selectedPoiCategory === 'trn') {
        dest = pickRandomTrainingPoiNearAirport(start.lat, start.lon, dirPref, searchMin, searchMax);
        dataSource = "Training Area RNG";
    }

    if (!dest && !targetDest && effectiveType === "poi" && selectedPoiCategory !== 'trn' && typeof fallbackPOIs !== 'undefined') {
        dataSource = "Fallback POIs";
        const fallbackWithNav = fallbackPOIs
            .map(p => {
                const nav = calcNav(start.lat, start.lon, p.lat, p.lon);
                return { ...p, _distNm: Number(nav?.dist || 0), _brng: Number(nav?.brng || 0) };
            })
            .filter(p =>
                Number.isFinite(p._distNm) &&
                p._distNm >= searchMin &&
                p._distNm <= searchMax &&
                checkBearing(p._brng, dirPref)
            );
        let validPOIs = fallbackWithNav.slice();
        if (selectedPoiCategory !== 'all') {
            validPOIs = validPOIs.filter(p => poiTitleMatchesCategory(p.n, selectedPoiCategory));
        }
        if (validPOIs.length === 0 && selectedPoiCategory !== 'all') {
            // Nicht auf globale Fernziele aufweichen: Kategorie-Fallback bleibt im Ring.
            validPOIs = fallbackWithNav.filter(p => poiTitleMatchesCategory(p.n, selectedPoiCategory));
        }
        // Bei expliziter Kategorie (z.B. water) nicht auf Fremdkategorien aufweichen.
        if (validPOIs.length === 0 && selectedPoiCategory === 'all') validPOIs = fallbackWithNav;
        if (validPOIs.length === 0 && selectedPoiCategory !== 'all') {
            dest = null;
        } else {
        const balancedFallbackPoi = pickBalancedByCategory(validPOIs, p => classifyPOITitleCategory(p.n), 'ga_poi_cat');
        dest = balancedFallbackPoi ? balancedFallbackPoi.item : validPOIs[Math.floor(Math.random() * validPOIs.length)];
        dest.poiCategory = balancedFallbackPoi ? balancedFallbackPoi.category : classifyPOITitleCategory(dest.n);
        dest.icao = "POI";
            dest.poiSource = `Local fallback POIs${selectedPoiCategory !== 'all' ? ` (forced:${selectedPoiCategory})` : ''}`;
        }
    }
    if (dest && effectiveType === 'poi' && selectedPoiCategory === 'trn') {
        dest.poiCategory = 'trn';
    }
    if (!missionFireHazard && effectiveType === 'poi' && selectedPoiCategory === 'fire' && Number.isFinite(dest?.lat) && Number.isFinite(dest?.lon)) {
        missionFireHazard = await fetchDwdWbiForLocation(dest.lat, dest.lon);
        _ensureDispatchAlive();
    }
    if (dest && effectiveType === 'poi' && dispatchProfileId === 'tour_guide_knowledge' && selectedPoiCategory !== 'trn') {
        const contextOk = await _resolveEducationalPoiContext(dest.n, dest.lat, dest.lon);
        _ensureDispatchAlive();
        if (!contextOk?.ok) {
            let replacement = null;
            for (let i = 0; i < 3; i++) {
                const retry = await findWikipediaPOI(start.lat, start.lon, searchMin, searchMax, dirPref, selectedPoiCategory);
                _ensureDispatchAlive();
                if (!retry) continue;
                const retryCtx = await _resolveEducationalPoiContext(retry.n, retry.lat, retry.lon);
                _ensureDispatchAlive();
                if (retryCtx?.ok) {
                    replacement = { ...retry, n: String(retryCtx.title || retry.n || '').trim() || retry.n };
                    break;
                }
            }
            if (replacement) {
                dest = replacement;
            } else {
                dest = null;
            }
        } else {
            dest.n = String(contextOk.title || dest.n || '').trim() || dest.n;
        }
    }

    if (!dest) {
        setDispatchLampState('error');
        indicator.innerText = "Fehler: Kein passendes Ziel gefunden.";
        if (effectiveType === "apt" && (!globalAirports || Object.keys(globalAirports).length === 0)) {
            indicator.innerText = "Fehler: Airport-Daten nicht geladen (airports.json).";
        }
        resetBtn(btn);
        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`; return;
    }

    const isPOI = forcePOI || (effectiveType === 'poi' && !targetDest);
    const nav = calcNav(start.lat, start.lon, dest.lat, dest.lon);
    let totalDist = isPOI ? nav.dist * 2 : nav.dist;
    currentDestICAO = isPOI ? currentStartICAO : dest.icao;
    let poiTerrainFt = null;
    if (isPOI && Number.isFinite(dest?.lat) && Number.isFinite(dest?.lon)) {
        poiTerrainFt = await fetchPoiTerrainElevationFt(dest.lat, dest.lon);
        _ensureDispatchAlive();
    }
    const [depWeatherSnap, destWeatherSnap] = await Promise.all([
        fetchMissionWeatherSnapshot(currentStartICAO, start.lat, start.lon),
        fetchMissionWeatherSnapshot(isPOI ? 'POI' : currentDestICAO, dest.lat, dest.lon)
    ]);
    _ensureDispatchAlive();
    const missionWeather = { dep: depWeatherSnap, dest: destWeatherSnap };
    let preMissionTargetGeoContext = null;
    let preMissionTruth = null;
    if (isPOI && selectedPoiCategory !== 'trn') {
        preMissionTargetGeoContext = await fetchMissionTargetGeoContext({
            isPOI,
            targetLat: Number(dest?.lat),
            targetLon: Number(dest?.lon)
        });
        _ensureDispatchAlive();
        preMissionTruth = buildMissionTruth({
            isPOI,
            poiName: dest?.n || null,
            targetName: dest?.n || null,
            targetLat: Number(dest?.lat),
            targetLon: Number(dest?.lon),
            poiSource: String(dest?.poiSource || ''),
            poiCategory: String(dest?.poiCategory || selectedPoiCategory || ''),
            requestedCategory: String(selectedPoiCategory || 'all'),
            poiLookup: dest?.poiLookup || null
        }, preMissionTargetGeoContext, null);
    }

    const maxPax = Math.max(1, maxSeats - 1), randomPax = Math.floor(Math.random() * maxPax) + 1;
    let paxText = `${randomPax} PAX`, cargoText = `${Math.floor(Math.random() * 300) + 20} lbs`;
    const aiModeEnabled = !!document.getElementById('aiToggle')?.checked;

    const isPlanningOnlyMode = dispatchProfileId === 'freeflight_planning';
    let missionPlanV2 = null;
    if (!isPlanningOnlyMode && aiModeEnabled && isMissionPipelineV2Enabled()) {
        indicator.innerText = `Pipeline V2: Missionsformular planen...`;
        try {
            missionPlanV2 = await fetchMissionPlannerV2({
                start,
                dest,
                isPOI,
                dist: totalDist,
                missionPicker: missionPickerResolved,
                dispatchProfileId,
                selectedCategory: isPOI ? selectedPoiCategory : selectedAptCategory,
                requestedCategory: isPOI ? requestedPoiCategory : selectedAptCategory,
                poiTerrainFt,
                missionWeather,
                missionFireHazard,
                targetGeoContext: preMissionTargetGeoContext,
                missionTruth: preMissionTruth
            });
            _ensureDispatchAlive();
            if (missionPlanV2?.resolvedNeeds?.geo_context && !preMissionTargetGeoContext) {
                preMissionTargetGeoContext = missionPlanV2.resolvedNeeds.geo_context;
            }
            if (missionPlanV2?.resolvedNeeds?.mission_truth && !preMissionTruth) {
                preMissionTruth = missionPlanV2.resolvedNeeds.mission_truth;
            }
        } catch (err) {
            missionPlanV2 = {
                pipelineVersion: 'mission-v2-planner-2026-05-22',
                status: 'invalid',
                needs: [],
                resolvedNeeds: {},
                plan: {},
                debug: { error: err?.message || String(err || 'planner_failed') }
            };
            console.warn('[MISSION PIPELINE V2] Planner failed, using classic pipeline context.', err);
        }
    }
    let m = null;
    if (isPlanningOnlyMode) {
        indicator.innerText = `Planungsmodus aktiv: erstelle Freiflug-Briefing...`;
        dataSource = "Freiflug/Planung";
        m = {
            i: '🧭',
            t: isPOI ? 'Freiflug · POI-Ziel' : 'Freiflug · APT-Ziel',
            s: isPOI
                ? 'Kein Missionsauftrag erstellt. Das POI-Ziel wurde fuer einen freien Flug bzw. zur reinen Planung generiert.'
                : 'Kein Missionsauftrag erstellt. Das APT-Ziel wurde fuer einen freien Flug bzw. zur reinen Planung generiert.',
            cat: isPOI ? String(dest?.poiCategory || 'poi') : 'freeflight',
            _requestedProfile: 'freeflight_planning',
            _appliedProfile: 'freeflight_planning'
        };
        paxText = '-';
        cargoText = '-';
    } else {
        indicator.innerText = `Kontaktiere KI-Dispatcher...`;
        m = await fetchGeminiMission(
            start.n,
            dest.n,
            totalDist,
            isPOI,
            paxText,
            cargoText,
            poiTerrainFt,
            missionWeather,
            missionPickerResolved,
            missionFireHazard,
            {
                lat: Number(dest?.lat),
                lon: Number(dest?.lon),
                name: String(dest?.n || ''),
                requestedCategory: String(selectedPoiCategory || 'all'),
                poiCategory: String(dest?.poiCategory || ''),
                targetGeoContext: preMissionTargetGeoContext,
                missionTruth: preMissionTruth,
                missionPlanV2
            }
        );
        _ensureDispatchAlive();
        if (m && dispatchProfileId !== 'auto' && !missionMatchesTaskProfile(m, dispatchProfileId, isPOI)) {
            console.warn('[DISPATCH] KI-Mission nicht profilkonsistent, falle auf lokale Missionen zurueck.', { dispatchProfileId, mission: m?.t || 'n/a' });
            m = null;
        }

        if (m) {
            dataSource = m._source;
            if (m.pax) paxText = m.pax;
            if (m.cargo) cargoText = m.cargo;
        } else {
            indicator.innerText = `Lade Auftrag aus lokaler Datenbank...`;
            dataSource = "Lokale DB";
            if (isPOI) {
                if (selectedPoiCategory === 'trn') {
                    const fallbackPlan = sanitizeTrainingPlan(null, true);
                    const instructor = buildInstructorPassenger(fallbackPlan);
                    m = {
                        i: '🧑‍✈️',
                        t: 'Trainingsflug im Übungsgebiet',
                        s: 'Heute trainieren wir Verfahren und Flugpraezision im platznahen Uebungsgebiet. Ich gebe dir die Uebungsschritte unterwegs, wir arbeiten sauber nach Verfahren und landen danach wieder am Startplatz.',
                        cat: 'trn',
                        passenger: instructor
                    };
                    paxText = "1 PAX (Instruktor)";
                    cargoText = "Trainingsunterlagen (10 lbs)";
                    dataSource = "Lokale Training DB";
                } else {
                    const offlinePoiPool = buildOfflinePoiMissionPool(selectedPoiCategory, dispatchProfileId, dest.n);
                    m = pickOfflineMissionFromPool(offlinePoiPool, 'ga_offline_poi_mission_history') || generateDynamicPOIMission(dest.n, maxSeats, dest.poiCategory);
                    paxText = m.payloadText || paxText;
                    cargoText = m.cargoText || cargoText;
                    dataSource = "Lokale POI DB";
                }
            } else if (typeof missions !== 'undefined') {
                // A->B-Missionen gleichmäßig über Kategorien rotieren (inkl. Trainingsflüge).
                const availDbMissions = missions.filter(ms => {
                    if (!ms || ms.cat === 'poi') return false;
                    if (dispatchProfileId !== 'auto' && selectedAptCategory === 'all') {
                        const inferred = classifyAptMissionCategory(ms);
                        if (inferred === 'trn') return false;
                    }
                    if (selectedAptCategory === 'all') return true;
                    return classifyAptMissionCategory(ms) === selectedAptCategory;
                });
                const offlineFallbackMissions = buildOfflineAptMissionPool(selectedAptCategory, dispatchProfileId);
                const availM = [...availDbMissions, ...offlineFallbackMissions];
                const profFilteredAvailM = (dispatchProfileId && dispatchProfileId !== 'auto')
                    ? availM.filter(ms => missionMatchesTaskProfile(ms, dispatchProfileId, false))
                    : availM;
                const missionPoolByProfile = profFilteredAvailM.length ? profFilteredAvailM : availM;
                if (missionPoolByProfile.length === 0) {
                    m = missions[0];
                } else {
                    const availCats = [...new Set(missionPoolByProfile.map(ms => ms.cat || "std"))];
                    const catCounts = JSON.parse(localStorage.getItem('ga_mission_cat_counts') || '{}');
                    const lastCat = localStorage.getItem('ga_last_mission_cat') || '';

                    const minCount = Math.min(...availCats.map(cat => parseInt(catCounts[cat] || 0, 10)));
                    let candidateCats = availCats.filter(cat => parseInt(catCounts[cat] || 0, 10) === minCount);
                    if (candidateCats.length > 1 && candidateCats.includes(lastCat)) {
                        candidateCats = candidateCats.filter(cat => cat !== lastCat);
                    }
                    const selectedCat = candidateCats[Math.floor(Math.random() * candidateCats.length)] || availCats[0];

                    const pool = missionPoolByProfile.filter(ms => (ms.cat || "std") === selectedCat);
                    const historyByCat = JSON.parse(localStorage.getItem('ga_mission_history_by_cat') || '{}');
                    let catHistory = Array.isArray(historyByCat[selectedCat]) ? historyByCat[selectedCat] : [];
                    let freshM = pool.filter(ms => !catHistory.includes(ms.t));

                    if (freshM.length === 0) {
                        freshM = pool;
                        catHistory = [];
                    }

                    m = freshM[Math.floor(Math.random() * freshM.length)] || pool[0] || missions[0];

                    catHistory.push(m.t);
                    if (catHistory.length > 20) catHistory.shift();
                    historyByCat[selectedCat] = catHistory;
                    localStorage.setItem('ga_mission_history_by_cat', JSON.stringify(historyByCat));

                    catCounts[selectedCat] = parseInt(catCounts[selectedCat] || 0, 10) + 1;
                    localStorage.setItem('ga_mission_cat_counts', JSON.stringify(catCounts));
                    localStorage.setItem('ga_last_mission_cat', selectedCat);
                }

                if (dataSource === "Generiert") dataSource = "Lokale DB";
                const aptCatOfMission = classifyAptMissionCategory(m || {});
                if (m.cat === "cargo" || aptCatOfMission === 'cargo') { paxText = "0 PAX"; }
                if (m.cat === "charter" || aptCatOfMission === 'charter' || selectedAptCategory === 'charter') {
                    if (!m.passenger || typeof m.passenger !== 'object') {
                        m.passenger = buildCharterPassenger(null);
                    } else {
                        m.passenger = buildCharterPassenger(m.passenger);
                    }
                    if (!paxText || /^\s*0\s*PAX\b/i.test(String(paxText))) {
                        paxText = `1 PAX (${m.passenger.role})`;
                    }
                }
                if (m.cat === "trn" || aptCatOfMission === 'trn' || selectedAptCategory === 'trn') {
                    paxText = "1 PAX (Instruktor)";
                    if (!cargoText || /kein cargo|none|0 lbs/i.test(String(cargoText))) cargoText = "Trainingsunterlagen (10 lbs)";
                    if (!m.passenger || typeof m.passenger !== 'object') {
                        m.passenger = buildInstructorPassenger(null);
                    }
                }
            }
        }
        if (!isPOI && selectedAptCategory === 'cargo') paxText = "0 PAX";
        if (!isPOI && selectedAptCategory === 'trn') paxText = "1 PAX (Instruktor)";
        {
            const effectiveProfileId = dispatchProfileId;
            const profApplied = applyMissionTaskProfileToMission(m, isPOI, effectiveProfileId, paxText, cargoText);
            m = profApplied.mission || m;
            paxText = profApplied.paxText || paxText;
            cargoText = profApplied.cargoText || cargoText;
            m._requestedProfile = selectedMissionProfile;
            m._appliedProfile = profApplied.appliedProfile || effectiveProfileId || 'auto';
            m._missionPlanV2 = missionPlanV2 || m._missionPlanV2 || null;
        }
    }
    _ensureDispatchAlive();

    const poolCategory = isPOI ? (dest.poiCategory || classifyPOITitleCategory(dest.n)) : (m?.cat || 'std');
    const poiSource = isPOI ? String(dest?.poiSource || dataSource || 'n/a') : '';
    const poiLookup = isPOI && dest && typeof dest.poiLookup === 'object' ? dest.poiLookup : null;
    const dispatchSnapshot = {
        mode: isPOI ? 'POI' : 'A-B',
        category: poolCategory,
        requestedCategory: isPOI ? String(selectedPoiCategory || 'all') : String(selectedAptCategory || 'all'),
        profile: m?._requestedProfile || selectedMissionProfile || 'auto',
        appliedProfile: m?._appliedProfile || 'auto',
        mission: m?.t || 'n/a',
        target: dest?.n || 'n/a',
        poiSource,
        poiLookup
    };
    console.debug('[DISPATCH]', dispatchSnapshot);

    const fuel = Math.ceil((totalDist / selectedTas * selectedGph) + (0.75 * selectedGph));
    const totalMinutes = Math.round((totalDist / selectedTas) * 60);
    const hrs = Math.floor(totalMinutes / 60), mins = totalMinutes % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} Min.`;

    const missionTaskDomain = String(m?.passenger?.taskDomain || '').toLowerCase();
    let missionSceneIntent = sanitizeMissionSceneIntentSpec(
        m?.sceneIntent || m?.targetSceneDebug?.sceneIntent || m?.targetScene || m?.s || '',
        { isPOI, taskDomain: missionTaskDomain }
    );
    if (isPOI && !missionSceneIntent.summary && (!missionSceneIntent.visibleIdeas || missionSceneIntent.visibleIdeas.length === 0)) {
        missionSceneIntent = sanitizeMissionSceneIntentSpec(m?.s || '', { isPOI, taskDomain: missionTaskDomain });
    }
    const missionNeedsAccept = !isPlanningOnlyMode;
    const initialTargetScene = sanitizeMissionTargetSceneSpec(
        missionNeedsAccept ? null : (m?.targetScene || null),
        { isPOI, taskDomain: missionTaskDomain, targetGeoContext: preMissionTargetGeoContext || null }
    );
    if (missionNeedsAccept) {
        clearDraftMissionPersistence('new-mission-draft');
    }

    currentMissionData = {
        start: currentStartICAO,
        dest: currentDestICAO,
        isPOI,
        poiName: isPOI ? dest.n : null,
        poiSource: isPOI ? poiSource : null,
        poiCategory: isPOI ? poolCategory : null,
        requestedCategory: isPOI ? String(selectedPoiCategory || 'all') : String(selectedAptCategory || 'all'),
        poiLookup: poiLookup || null,
        targetName: dest.n,
        targetLat: Number(dest.lat),
        targetLon: Number(dest.lon),
        targetAltFt: isPOI && Number.isFinite(Number(poiTerrainFt)) ? Math.round(Number(poiTerrainFt)) : null,
        poiTerrainFt: isPOI && Number.isFinite(Number(poiTerrainFt)) ? Math.round(Number(poiTerrainFt)) : null,
        mission: m.t,
        dist: totalDist,
        ac: selectedAC,
        heading: nav.brng,
        weatherBriefing: missionWeather,
        fireHazard: missionFireHazard || null,
        source: dataSource || null,
        sceneIntent: missionSceneIntent,
        sceneAccepted: !missionNeedsAccept,
        sceneCompositionStatus: missionNeedsAccept ? 'draft' : 'accepted',
        targetGeoContext: preMissionTargetGeoContext || null,
        missionTruth: preMissionTruth || null,
        missionPlanV2: missionPlanV2 || null,
        targetScene: initialTargetScene,
        targetSceneDraftRaw: m?.targetScene || null,
        targetSceneAiRaw: m?.targetSceneDebug?.aiRaw || null,
        targetSceneAiNormalized: initialTargetScene,
        sceneIntentDebug: {
            aiRaw: m?.targetSceneDebug?.sceneIntentRaw || m?.sceneIntent || null,
            normalized: missionSceneIntent
        }
    };

    const missionHasPassenger = missionHasPassengerByPaxText(paxText);
    const isAiGeneratedMission = !!(m && typeof m._source === 'string' && /^Gemini\b/i.test(String(m._source)));
    const forceFireWatchPassenger = !!(missionHasPassenger && m && m.passenger && String(m.passenger.taskDomain || '').toLowerCase() === 'fire_watch');
    const shouldActivateMissionPassenger = !!(
        missionHasPassenger
        && m
        && m.passenger
        && typeof m.passenger === 'object'
        && (
            (aiModeEnabled && isAiGeneratedMission)
            || forceFireWatchPassenger
            || m._appliedProfile
        )
    );
    window.activePassenger = shouldActivateMissionPassenger
        ? enforcePoiPassengerAltitudeRule(m.passenger, isPOI, poiTerrainFt)
        : null;
    if (typeof window.paxVoiceRefreshWidget === 'function') window.paxVoiceRefreshWidget();
    const aptArrivalPlan = buildAptArrivalPlan({
        isPOI,
        dest,
        mission: m,
        passenger: window.activePassenger || m?.passenger || null,
        paxText,
        cargoText,
        profileId: m?._appliedProfile || dispatchProfileId || selectedMissionProfile || 'auto',
        heading: nav.brng
    });
    if (aptArrivalPlan) {
        currentMissionData.aptArrivalPlan = aptArrivalPlan;
        currentMissionData.missionTruth = attachAptArrivalPlanToMissionTruth(currentMissionData.missionTruth || null, aptArrivalPlan);
    } else {
        delete currentMissionData.aptArrivalPlan;
    }
    const activeMissionContract = buildMissionContract({
        isPOI,
        requestedProfileId: m?._requestedProfile || selectedMissionProfile || 'auto',
        appliedProfileId: m?._appliedProfile || dispatchProfileId || 'auto',
        mission: m,
        passenger: window.activePassenger,
        paxText,
        cargoText,
        category: poolCategory,
        targetSceneOverride: initialTargetScene,
        sceneIntentOverride: missionSceneIntent,
        sceneAccepted: !missionNeedsAccept,
        targetGeoContext: currentMissionData.targetGeoContext || null,
        missionTruth: currentMissionData.missionTruth || null,
        aptArrivalPlan,
        missionPlanV2
    });
    const fireScenario = buildFireWatchScenario({
        isPOI,
        mission: m,
        passenger: window.activePassenger || m?.passenger || null,
        dest,
        poiTerrainFt,
        heading: nav.brng,
        fireHazard: missionFireHazard
    });
    if (fireScenario) currentMissionData.fireScenario = fireScenario;
    else delete currentMissionData.fireScenario;
    currentMissionData.missionContract = activeMissionContract;
    currentMissionData.targetScene = activeMissionContract.targetScene;
    window.activeMissionContract = activeMissionContract;
    {
        const sceneDebugInfo = {
            sceneAccepted: currentMissionData.sceneAccepted,
            sceneCompositionStatus: currentMissionData.sceneCompositionStatus,
            sceneIntent: currentMissionData.sceneIntent || null,
            targetGeoContext: currentMissionData.targetGeoContext || null,
            missionTruth: currentMissionData.missionTruth || null,
            missionPlanV2: currentMissionData.missionPlanV2 || activeMissionContract.missionPlanV2 || null,
            aptArrivalPlan: currentMissionData.aptArrivalPlan || activeMissionContract.aptArrivalPlan || null,
            aiRequested: m?.targetSceneDebug?.aiRaw || null,
            aiNormalized: m?.targetSceneDebug?.normalized || currentMissionData.targetScene || null,
            contractTargetScene: activeMissionContract.targetScene || null,
            missionContext: {
                source: m?._source || dataSource || 'n/a',
                mode: isPOI ? 'POI' : 'A-B',
                profile: m?._appliedProfile || dispatchProfileId || 'auto',
                taskDomain: window.activePassenger?.taskDomain || m?.passenger?.taskDomain || null,
                mission: m?.t || '',
                target: dest?.n || '',
                poi: !!isPOI
            }
        };
        if (typeof window.gaMissionSceneDebugRecordAi === 'function') {
            window.gaMissionSceneDebugRecordAi(sceneDebugInfo);
        } else {
            window.gaMissionSceneDebug = { ...(window.gaMissionSceneDebug || {}), ...sceneDebugInfo, ts: Date.now() };
        }
        console.debug('[MISSION SCENE AI]', sceneDebugInfo);
    }
    if (fireScenario && typeof window.paxVoiceRefreshWidget === 'function') {
        window.paxVoiceRefreshWidget();
    }
    if (missionNeedsAccept) {
        clearDraftMissionPersistence('draft-contract-not-persisted');
    } else {
        try { localStorage.setItem('ga_active_passenger', window.activePassenger ? JSON.stringify(window.activePassenger) : ''); } catch(e) {}
        try { localStorage.setItem('ga_active_mission_contract', JSON.stringify(activeMissionContract)); } catch(e) {}
    }
    try {
        const p = window.activePassenger || {};
        const missionDebugSnapshot = {
            ts: Date.now(),
            mode: dispatchSnapshot.mode,
            category: dispatchSnapshot.category,
            profile: dispatchSnapshot.profile,
            appliedProfile: dispatchSnapshot.appliedProfile,
            mission: dispatchSnapshot.mission,
            target: dispatchSnapshot.target,
            targetCoords: (isPOI && Number.isFinite(dest?.lat) && Number.isFinite(dest?.lon))
                ? `${Number(dest.lat).toFixed(5)}, ${Number(dest.lon).toFixed(5)}`
                : null,
            source: m?._source || dataSource || 'n/a',
            poiSource: poiSource || null,
            poiLookup: poiLookup || null,
            story: String(m?.s || ''),
            narrativeGuard: m?._narrativeGuard || null,
            contract: activeMissionContract || null,
            sceneAccepted: currentMissionData.sceneAccepted,
            sceneCompositionStatus: currentMissionData.sceneCompositionStatus,
            sceneIntent: currentMissionData.sceneIntent || null,
            targetGeoContext: currentMissionData.targetGeoContext || null,
            missionTruth: currentMissionData.missionTruth || null,
            missionPlanV2: currentMissionData.missionPlanV2 || activeMissionContract.missionPlanV2 || null,
            missionPipelineV2Enabled: isMissionPipelineV2Enabled(),
            aptArrivalPlan: currentMissionData.aptArrivalPlan || activeMissionContract.aptArrivalPlan || null,
            targetScene: currentMissionData.targetScene || null,
            targetSceneDebug: {
                sceneIntentRaw: m?.targetSceneDebug?.sceneIntentRaw || m?.sceneIntent || null,
                aiRequested: m?.targetSceneDebug?.aiRaw || null,
                aiNormalized: m?.targetSceneDebug?.normalized || null,
                contractTargetScene: currentMissionData.targetScene || null
            },
            paxText: String(paxText || ''),
            cargoText: String(cargoText || ''),
            passenger: {
                name: p.name || null,
                role: p.role || null,
                gender: p.gender || null,
                roleProfile: p.roleProfile || 'general_passenger_v1',
                taskDomain: p.taskDomain || 'general',
                gTolerance: p.gTolerance || 'mittel',
                bankTolerance: p.bankTolerance || 'mittel',
                cargoSensitivity: p.cargoSensitivity || 'mittel',
                stomachSensitivity: p.stomachSensitivity || 'mittel',
                comfortPriority: p.comfortPriority || 'mittel',
                urgencyPriority: p.urgencyPriority || 'niedrig',
                targetAltFt: Number(p.targetAltFt || 0),
                targetRadiusNm: Number(p.targetRadiusNm || 0),
                targetDwellMin: Number(p.targetDwellMin || 0)
            },
            fireHazard: missionFireHazard || null
        };
        window.vpMissionDebugSnapshot = missionDebugSnapshot;
        localStorage.setItem('ga_mission_debug_snapshot', JSON.stringify(missionDebugSnapshot));
        console.debug('[MISSION SNAPSHOT]', missionDebugSnapshot);
        if (typeof window.vpRefreshWeatherDebugReport === 'function') window.vpRefreshWeatherDebugReport();
    } catch (_) {}
    if (typeof window.paxVoiceResetMission === 'function') window.paxVoiceResetMission();
    if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
    const paxBriefingText = formatPaxBriefingText(paxText, window.activePassenger);

    document.getElementById("mTitle").innerHTML = `${m.i ? m.i + ' ' : ''}${m.t}`;
    let storyForBriefing = String(m.s || '');
    if (isPOI && Number(window.activePassenger?.targetAltFt || 0) > 0) {
        const plannedAltFt = Math.round(Number(window.activePassenger.targetAltFt));
        if (!new RegExp(`\\b${plannedAltFt}\\s*ft\\b`, 'i').test(storyForBriefing)) {
            storyForBriefing = `${storyForBriefing}${storyForBriefing ? '\n\n' : ''}Arbeits-Hinweis: Für das Zielgebiet ist eine geplante Höhe von ungefähr ${plannedAltFt} ft vorgesehen.`;
        }
    }
    if (String(window.activePassenger?.taskDomain || '').toLowerCase() === 'fire_watch' && Number.isFinite(Number(missionFireHazard?.level))) {
        const fireDate = _formatWbiDate(missionFireHazard?.date) || String(missionFireHazard?.dateIso || '').trim();
        const fireLine = `Feuerlage-Hinweis (DWD): Waldbrandgefahrenindex Stufe ${Math.round(Number(missionFireHazard.level))} von 5 (${String(missionFireHazard.label || 'n/a')})${fireDate ? `, Stand ${fireDate}` : ''}.`;
        if (!/waldbrandgefahrenindex|dwd/i.test(storyForBriefing)) {
            storyForBriefing = `${storyForBriefing}${storyForBriefing ? '\n\n' : ''}${fireLine}`;
        }
    }
    const arrivalHint = !isPOI ? String(currentMissionData?.aptArrivalPlan?.narrativeHint || '').trim() : '';
    if (arrivalHint && !/ankunft|uebergabe|übergabe|vorfeld|parking/i.test(storyForBriefing)) {
        storyForBriefing = `${storyForBriefing}${storyForBriefing ? '\n\n' : ''}Ankunfts-Hinweis: ${arrivalHint}`;
    }
    document.getElementById("mStory").innerText = storyForBriefing;
    document.getElementById("mDepICAO").innerText = currentStartICAO;
    document.getElementById("mDepName").innerText = start.n;
    document.getElementById("mDepCoords").innerText = `${start.lat.toFixed(4)}, ${start.lon.toFixed(4)}`;
    const wikiDepNameEl = document.getElementById('wikiDepNameDisplay');
    if (wikiDepNameEl) wikiDepNameEl.innerText = `${currentStartICAO} – ${start.n}`;

    setDrumCounter('distDrum', totalDist);
    recalculatePerformance();

    document.getElementById("destIcon").innerText = isPOI ? "🎯" : "🛬";
    document.getElementById("mDestICAO").innerText = isPOI ? "POI" : currentDestICAO;
    document.getElementById("mDestName").innerText = dest.n;
    document.getElementById("mDestCoords").innerText = `${dest.lat.toFixed(4)}, ${dest.lon.toFixed(4)}`;
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    if (wikiDestNameEl) wikiDestNameEl.innerText = `${isPOI ? 'POI' : currentDestICAO} – ${dest.n}`;

    document.getElementById("mPay").innerText = paxBriefingText; document.getElementById("mWeight").innerText = cargoText;
    document.getElementById("mDistNote").innerText = `${totalDist} NM`;
    document.getElementById("mETENote").innerText = timeStr;
    const mHeadingNote = document.getElementById("mHeadingNote");
    if (mHeadingNote) mHeadingNote.innerText = `${nav.brng}°`;

    document.getElementById("destRwyContainer").style.display = isPOI ? "none" : "block";
    if (document.getElementById("wikiDestRwyText")) document.getElementById("wikiDestRwyText").style.display = isPOI ? "none" : "block";
    const depLinks = document.getElementById("wikiDepLinks"); if (depLinks) depLinks.style.display = "block";
    const destSwitchRow = document.getElementById("destSwitchRow"); if (destSwitchRow) destSwitchRow.style.display = isPOI ? "none" : "flex";

    document.getElementById("briefingBox").style.display = "block";

    const destLocEl = document.getElementById('destLoc');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (destLocEl) destLocEl.value = '';
    if (destLocRadioEl) destLocRadioEl.value = '';

    updateMap(start.lat, start.lon, dest.lat, dest.lon, currentStartICAO, dest.n);

    currentDepElev  = (globalAirports && globalAirports[currentStartICAO])  ? (globalAirports[currentStartICAO].elevation  ?? null) : null;
    currentDestElev = (globalAirports && globalAirports[currentDestICAO])   ? (globalAirports[currentDestICAO].elevation   ?? null) : null;

    const destLinks = document.getElementById("wikiDestLinks");
    if (destLinks) destLinks.style.display = isPOI ? "none" : "block";

    indicator.innerText = `Flugplan bereit (${dataSource}). Lade Infos...`;
    fetchRunwayDetails(start.lat, start.lon, 'mDepRwy', currentStartICAO);

    _dispatchDeferredFinalize = true;
    setTimeout(() => {
        if (!_isDispatchRunAlive(dispatchRunId)) return;
        if (!isPOI) fetchRunwayDetails(dest.lat, dest.lon, 'mDestRwy', currentDestICAO);

        fetchAreaDescription(start.lat, start.lon, 'wikiDepDescText', null, currentStartICAO, 'wikiDepImageContainer', 'wikiDepImage');
        fetchAreaDescription(dest.lat, dest.lon, 'wikiDestDescText', isPOI ? dest.n : null, isPOI ? null : currentDestICAO, 'wikiDestImageContainer', 'wikiDestImage');

        currentDepFreq = "";
        currentDestFreq = "";

        fetchAirportFreq(currentStartICAO, 'wikiDepFreqText', 'dep');

        // --- NEU: METAR Start laden ---
        loadMetarWidget(currentStartICAO, 'metarContainerDep', start.lat, start.lon);

        if (!isPOI) {
            fetchAirportFreq(currentDestICAO, 'wikiDestFreqText', 'dest');
        } else {
            const df = document.getElementById('wikiDestFreqText');
            if (df) df.innerHTML = '';
        }

        // --- NEU: METAR Ziel laden (nur wenn kein POI) ---
        loadMetarWidget(isPOI ? null : currentDestICAO, 'metarContainerDest', dest.lat, dest.lon);

        indicator.innerText = `Briefing komplett.`; resetBtn(btn);
        setDispatchLampState('done', dataSource);
        const rBtnLed = document.getElementById('radioGenerateBtn');
        if (rBtnLed) rBtnLed.classList.add('active');

        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;

        if (led) {
            led.classList.remove('led-green', 'led-blue', 'led-red', 'led-flash3');
            if (dataSource === "Gemini 3.0 Flash") { led.classList.add('led-flash3'); }
            else if (dataSource === "Gemini 2.5 Flash") { led.classList.add('led-blue'); }
            else if (dataSource === "Gemini 2.5 Flash Lite") { led.classList.add('led-green'); }
            else { led.classList.add('led-red'); }
        }

        document.querySelectorAll('.marker-light').forEach(l => l.classList.remove('blinking', 'on'));
        if (dataSource === "Gemini 3.0 Flash") {
            document.getElementById('mkO').classList.add('on');
            document.getElementById('mkM').classList.add('on');
        }
        else if (dataSource === "Gemini 2.5 Flash") document.getElementById('mkO').classList.add('on');
        else if (dataSource === "Gemini 2.5 Flash Lite") document.getElementById('mkM').classList.add('on');
        else document.getElementById('mkI').classList.add('on');

        window.debouncedSaveMissionState();
        if (typeof window.updateMissionAcceptanceUi === 'function') window.updateMissionAcceptanceUi();
        refreshGPSAfterDispatch();
        // Position im Profil auf Start zurücksetzen
        vpUpdatePosition(0);
        if (_isDispatchRunAlive(dispatchRunId)) {
            _dispatchState.active = false;
        }
    }, 800);
    } catch (e) {
        if (e && e.name === 'AbortError') {
            // Benutzerabbruch über Clear: kein zusätzlicher Fehlerdialog.
        } else {
            console.error('[Dispatch] Fehler:', e);
            const indicator = document.getElementById('searchIndicator');
            if (indicator) indicator.innerText = 'Fehler beim Dispatch. Bitte erneut versuchen.';
            const btn = document.getElementById('generateBtn');
            resetBtn(btn);
            setDispatchLampState('error');
            if (window.meterInterval) clearInterval(window.meterInterval);
            const needle = document.getElementById('meterNeedle');
            if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;
        }
    } finally {
        if (!_dispatchDeferredFinalize && _dispatchState.runId === dispatchRunId) {
            _dispatchState.active = false;
        }
    }
}



/* =========================================================
   9. EXTERNE LINKS & LOGBUCH
   ========================================================= */
function openAIP(t) {
    const icao = t === 'dep' ? currentStartICAO : currentDestICAO;
    const url = (typeof getAipPopupUrl === 'function')
        ? getAipPopupUrl(icao, globalAirports?.[icao]?.country || '')
        : null;
    if (!url) return;
    window.open(url, '_blank');
}
function openMetar(t) { window.open(`https://metar-taf.com/de/${t === 'dep' ? currentStartICAO : currentDestICAO}`, '_blank'); }

function logCurrentFlight() {
    if (!currentMissionData) return;
    const log = JSON.parse(localStorage.getItem('ga_logbook')) || [];
    log.unshift({ ...currentMissionData, date: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem('ga_logbook', JSON.stringify(log.slice(0, 50)));
    localStorage.setItem('last_icao_dest', currentMissionData.dest);
    const newStart = currentMissionData.dest || '';
    document.getElementById('startLoc').value = newStart;
    document.getElementById('destLoc').value = "";
    const startLocRadioEl = document.getElementById('startLocRadio');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (startLocRadioEl) startLocRadioEl.value = newStart;
    if (destLocRadioEl) destLocRadioEl.value = '';
    renderLog(); alert(`Flug geloggt! Du bist in ${currentMissionData.dest}.`);
    triggerCloudSave();
}

function renderLog() {
    const log = JSON.parse(localStorage.getItem('ga_logbook')) || [];
    const container = document.getElementById('logContent');
    container.innerHTML = log.length ? '' : '<div style="color:#888; font-size:11px;">Keine Einträge vorhanden.</div>';
    const isRetro = document.body.classList.contains('theme-retro');
    log.forEach(e => {
        const div = document.createElement('div'); div.className = 'log-entry';
        const routeStr = e.poiName ? `<b>${e.start} ➔ ${e.poiName} ➔ ${e.dest}</b>` : `<b>${e.start} ➔ ${e.dest}</b>`;
        const hlColor = isRetro ? 'var(--piper-yellow)' : 'var(--blue)', subColor = isRetro ? '#aaa' : '#888';
        div.innerHTML = `<span style="color:${subColor};">${e.date} • ${e.ac}</span><br>${routeStr}<br><span style="color:${hlColor}">${e.mission} (${e.dist} NM)</span>`;
        container.appendChild(div);
    });
}
function clearLog() { if (confirm("Gesamtes Logbuch löschen?")) { localStorage.removeItem('ga_logbook'); localStorage.removeItem('last_icao_dest'); renderLog(); triggerCloudSave(); } }

/* =========================================================
   10. HANGAR PINNWAND & CREW BOARD MULTIPLAYER
   ========================================================= */
/* =========================================================
   KLN 90B GPS MODULE
   ========================================================= */
const gpsState = {
    mode: 'FPL',
    subPage: 0,
    visible: false,
    maxPages: { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 },
    metarCache: {},
    wikiCache: {}
};

function toggleGPSModule(btnEl) {
    gpsState.visible = !gpsState.visible;
    const mod = document.getElementById('kln90bModule');
    const fp = document.querySelector('.flightplan-container');
    if (gpsState.visible) {
        if (mod) mod.style.display = 'flex';
        if (fp) fp.style.display = 'none';
        if (btnEl) btnEl.classList.add('active');
    } else {
        if (mod) mod.style.display = 'none';
        if (fp) fp.style.display = '';
        if (btnEl) btnEl.classList.remove('active');
    }
    saveAudioButtonStates();
    renderGPS();
}

function saveAudioButtonStates() {
    const states = {};
    document.querySelectorAll('.audio-btn-grid .audio-btn').forEach(btn => {
        const id = btn.id;
        if (id) states[id] = btn.classList.contains('active');
    });
    localStorage.setItem('ga_navcom_buttons', JSON.stringify(states));
}

function restoreAudioButtonStates() {
    const saved = JSON.parse(localStorage.getItem('ga_navcom_buttons') || '{}');
    const aircraftButtonIds = new Set(['btnAC-C172', 'btnAC-PA24', 'btnAC-AERO']);
    for (const [id, active] of Object.entries(saved)) {
        if (aircraftButtonIds.has(id)) continue;
        const btn = document.getElementById(id);
        if (!btn) continue;
        if (active) btn.classList.add('active');
        else btn.classList.remove('active');
    }
    updateNavComAircraftButtons();
    if (saved['btnToggleGPS']) {
        gpsState.visible = true;
        const mod = document.getElementById('kln90bModule');
        const fp = document.querySelector('.flightplan-container');
        if (mod) mod.style.display = 'flex';
        if (fp) fp.style.display = 'none';
        renderGPS();
    }
    if (saved['btnToggleAI']) {
        const aiToggle = document.getElementById('aiToggle');
        if (aiToggle) aiToggle.checked = true;
    }
}

function initGPSButtons() {
    document.querySelectorAll('.kln90b-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetMode = btn.dataset.mode;

            if (targetMode === 'AIP') {
                if (gpsState.mode === 'DEP' && currentStartICAO) {
                    const depUrl = (typeof getAipPopupUrl === 'function')
                        ? getAipPopupUrl(currentStartICAO, globalAirports?.[currentStartICAO]?.country || '')
                        : null;
                    if (depUrl) window.open(depUrl, '_blank');
                    return;
                }
                if (gpsState.mode === 'DEST' && currentDestICAO) {
                    const destUrl = (typeof getAipPopupUrl === 'function')
                        ? getAipPopupUrl(currentDestICAO, globalAirports?.[currentDestICAO]?.country || '')
                        : null;
                    if (destUrl) window.open(destUrl, '_blank');
                    return;
                }
            }

            if (targetMode === 'WX') {
                if (gpsState.mode === 'DEP' && currentStartICAO) {
                    window.open(`https://metar-taf.com/de/${currentStartICAO}`, '_blank');
                    return;
                }
                if (gpsState.mode === 'DEST' && currentDestICAO) {
                    window.open(`https://metar-taf.com/de/${currentDestICAO}`, '_blank');
                    return;
                }
            }

            document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gpsState.mode = targetMode;
            gpsState.subPage = 0;
            if (gpsState.mode === 'DEP' || gpsState.mode === 'DEST') {
                gpsState.maxPages[gpsState.mode] = 2;
            }
            renderGPS();
        });
    });
}

function initGPSEncoders() {
    const encL = document.getElementById('gpsEncoderL');
    const encR = document.getElementById('gpsEncoderR');

    const prevPage = () => {
        const max = gpsState.maxPages[gpsState.mode] || 1;
        gpsState.subPage = (gpsState.subPage - 1 + max) % max;
        renderGPS();
    };
    const nextPage = () => {
        const max = gpsState.maxPages[gpsState.mode] || 1;
        gpsState.subPage = (gpsState.subPage + 1) % max;
        renderGPS();
    };

    if (encL) {
        encL.addEventListener('click', () => prevPage());
        encL.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.deltaY > 0 ? nextPage() : prevPage();
        });
    }
    if (encR) {
        encR.addEventListener('click', () => nextPage());
        encR.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.deltaY > 0 ? nextPage() : prevPage();
        });
    }
}

function initCom2Knob() {
    const knob = document.getElementById('com2Knob');
    if (!knob) return;
    knob.addEventListener('click', () => {
        currentDestICAO = '';
        const destLocEl = document.getElementById('destLoc');
        const destLocRadioEl = document.getElementById('destLocRadio');
        if (destLocEl) destLocEl.value = '';
        if (destLocRadioEl) destLocRadioEl.value = '';
        if (gpsState.mode === 'DEST') {
            document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));
            gpsState.mode = 'FPL';
            gpsState.subPage = 0;
            if (gpsState.visible) renderGPS();
        }
    });
}

function renderGPS() {
    const left = document.getElementById('gpsLeft');
    const right = document.getElementById('gpsRight');
    const modeLbl = document.getElementById('gpsModeLbl');
    const pageLbl = document.getElementById('gpsPageLbl');
    if (!left || !right) return;

    const max = gpsState.maxPages[gpsState.mode] || 1;
    modeLbl.textContent = gpsState.mode;
    pageLbl.textContent = `PG ${gpsState.subPage + 1}/${max}`;

    switch (gpsState.mode) {
        case 'FPL': renderFPL(left, right); break;
        case 'DEP': renderAirportInfo(left, right, 'dep'); break;
        case 'DEST': renderAirportInfo(left, right, 'dest'); break;
        case 'AIP': renderAIP(left, right); break;
        case 'WX': renderWX(left, right); break;
    }
}

const FPL_LEGS_PER_PAGE = 6;

function renderFPL(left, right) {
    if (!currentMissionData) { left.innerHTML = '<div class="kln90b-line dim">NO FLIGHTPLAN</div>'; right.innerHTML = '<div class="kln90b-line dim">DISPATCH FIRST</div>'; return; }

    const wps = routeWaypoints, legs = [];
    if (wps && wps.length >= 2) {
        for (let i = 0; i < wps.length - 1; i++) {
            const p1 = wps[i], p2 = wps[i + 1], nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);
            let n1 = i === 0 ? (currentStartICAO || 'DEP') : (wps[i].name || `WP${i}`);
            let n2 = i === wps.length - 2 ? (currentMissionData?.poiName ? 'POI' : (currentDestICAO || 'DEST')) : (wps[i + 1].name || `WP${i + 1}`);

            n1 = n1.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');
            n2 = n2.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');

            let m1 = n1.match(/\[([^\]]+)\]/); if (m1) n1 = `[${m1[1]}]`;
            let m2 = n2.match(/\[([^\]]+)\]/); if (m2) n2 = `[${m2[1]}]`;

            n1 = n1.replace(/\s*\([^)]+\)/, '');
            n2 = n2.replace(/\s*\([^)]+\)/, '');

            const n1Short = n1.length > 8 ? n1.substring(0, 7) + '.' : n1;
            const n2Short = n2.length > 8 ? n2.substring(0, 7) + '.' : n2;
            legs.push({ n1: n1Short, n2: n2Short, brng: nav.brng, dist: nav.dist });
        }
    }

    const legPages = Math.max(1, Math.ceil(legs.length / 6));
    gpsState.maxPages['FPL'] = legPages;
    if (gpsState.subPage >= legPages) gpsState.subPage = legPages - 1;
    const pageLbl = document.getElementById('gpsPageLbl');
    if (pageLbl) pageLbl.textContent = `PG ${gpsState.subPage + 1}/${legPages}`;

    if (gpsState.subPage < legPages) {
        const start = gpsState.subPage * 6;
        const visible = legs.slice(start, start + 6);
        left.innerHTML = visible.map((l, idx) => {
            const isEnd = (start + idx) === 0 || (start + idx) === legs.length - 1;
            return `<div class="kln90b-line ${isEnd ? 'highlight' : ''}" style="font-size:10px; line-height:1.5; white-space:nowrap;">${l.n1}\u2192${l.n2}&nbsp;&nbsp;<span class="dim">${l.brng}\u00b0&thinsp;${l.dist}&thinsp;NM</span></div>`;
        }).join('');
        if (legs.length === 0) left.innerHTML = `<div class="kln90b-line highlight">${currentStartICAO}</div><div class="kln90b-line dim">→${currentMissionData?.poiName ? 'POI' : currentDestICAO}</div>`;

        const _d = Math.round((currentMissionData.dist || 0) * 10) / 10, _t = parseInt(document.getElementById('tasSlider')?.value) || 115, _g = parseInt(document.getElementById('gphSlider')?.value) || 9;
        right.innerHTML = `<div class="kln90b-line dim" style="font-size:9px;">TOTAL:</div><div class="kln90b-line" style="font-size:10px;">DST ${_d}NM</div><div class="kln90b-line" style="font-size:10px;">TME ${Math.round((_d / _t) * 60)}m</div><div class="kln90b-line" style="font-size:10px;">FUL ${Math.ceil((_d / _t) * _g + 0.75 * _g)}G</div><div class="kln90b-line" style="font-size:10px;">HDG ${currentMissionData.heading || 0}°</div>`;
    }
}
async function renderAirportInfo(left, right, type) {
    const isPOIMission = currentMissionData?.poiName && type === 'dest';
    const icao = type === 'dep' ? currentStartICAO : (isPOIMission ? 'POI' : currentDestICAO);
    if (!icao) {
        left.innerHTML = '<div class="kln90b-line dim">NO DATA</div>';
        right.innerHTML = '<div class="kln90b-line dim">DISPATCH</div>';
        return;
    }

    const mode = gpsState.mode;
    const realIcao = type === 'dep' ? currentStartICAO : currentDestICAO;
    const data = await getAirportData(realIcao);
    const name = isPOIMission ? currentMissionData.poiName : ((data && data.n) ? data.n : (type === 'dep' ? currentSName : currentDName) || icao);
    const lat = data ? data.lat.toFixed(4) : '---';
    const lon = data ? data.lon.toFixed(4) : '---';

    left.innerHTML =
        `<div class="kln90b-line highlight" style="font-size:11px;">${icao}</div>` +
        `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.35;">${name}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; margin-top:2px;">${lat}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">${lon}</div>`;

    right.innerHTML = '<div class="kln90b-line dim kln-loading-dots" style="margin-top:8px;"><span>●</span><span>●</span><span>●</span></div>';

    // POI-Missionen: Keine Runway/Freq-Daten, nur Wiki-Info
    if (isPOIMission) {
        const wikiKey = currentMissionData.poiName || 'POI';
        if (!gpsState.wikiCache[wikiKey] && data) {
            await fetchAndCacheWikiPages(realIcao, data.lat, data.lon);
            if (gpsState.wikiCache[realIcao]) gpsState.wikiCache[wikiKey] = gpsState.wikiCache[realIcao];
        }
        const wikiArr = gpsState.wikiCache[wikiKey] || gpsState.wikiCache[realIcao] || ['Keine Daten.'];
        const total = wikiArr.length;
        gpsState.maxPages[mode] = total;
        const lbl = document.getElementById('gpsPageLbl');
        if (lbl) lbl.textContent = `PG ${gpsState.subPage + 1}/${total}`;
        if (gpsState.subPage >= total) gpsState.subPage = total - 1;
        const sp = gpsState.subPage;
        if (sp >= 0 && sp < wikiArr.length) {
            right.innerHTML =
                `<div class="kln90b-line" style="font-size:9px; line-height:1.5; white-space:normal;">${wikiArr[sp]}</div>`;
        } else {
            right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>';
        }
        return;
    }

    if (!runwayCache[icao] && data) {
        const wikiResult = await fetchRunwayFromWikipedia(icao, data.lat, data.lon);

        if (wikiResult) {
            runwayCache[icao] = wikiResult;
            if (gpsState.mode === mode) renderGPS();
        } else {
            try {
                const ov = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:8];way["aeroway"="runway"](around:3000,${data.lat},${data.lon});out tags;`)}`).then(r => r.json());
                if (ov?.elements?.length > 0) {
                    const trans = { asphalt: 'Asphalt', concrete: 'Beton', grass: 'Gras', paved: 'Asphalt', unpaved: 'Unbefestigt', dirt: 'Erde', gravel: 'Schotter' };
                    const seen = new Set(), parts = [];
                    for (const e of ov.elements) {
                        if (!e.tags?.ref || seen.has(e.tags.ref)) continue;
                        seen.add(e.tags.ref);
                        const surf = e.tags.surface ? (trans[e.tags.surface.toLowerCase()] || e.tags.surface) : '?';
                        const len = e.tags.length ? ' · ' + Math.round(e.tags.length) + 'm' : '';
                        parts.push(`${e.tags.ref} – ${surf}${len}`);
                    }
                    if (parts.length > 0) {
                        runwayCache[icao] = parts.join('\n');
                        if (gpsState.mode === mode) renderGPS();
                    }
                } else {
                    runwayCache[icao] = "Keine Daten gefunden";
                    if (gpsState.mode === mode) renderGPS();
                }
            } catch (e) {
                runwayCache[icao] = "Keine Daten gefunden";
                if (gpsState.mode === mode) renderGPS();
            }
        }
    }

    // Frequenz-Fallback: Wenn nicht im Cache, nachladen
    if (freqCache[icao] === undefined && (!gpsState.fetchingFreqs || !gpsState.fetchingFreqs.has(icao))) {
        if (!gpsState.fetchingFreqs) gpsState.fetchingFreqs = new Set();
        gpsState.fetchingFreqs.add(icao);
        fetchAirportFreq(icao, null, null).then(() => {
            gpsState.fetchingFreqs.delete(icao);
            if (gpsState.mode === mode) renderGPS();
        });
    }

    const RWYS_PER_PAGE = 4;
    const FREQS_PER_PAGE = 4;
    const allRunways = runwayCache[icao] ? runwayCache[icao].split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(r => r.trim()) : [];
    const allFreqs = freqCache[icao] || [];
    const rwyPages = Math.max(1, Math.ceil(allRunways.length / RWYS_PER_PAGE));
    const freqPages = allFreqs.length > 0 ? Math.ceil(allFreqs.length / FREQS_PER_PAGE) : 0;
    const sp = gpsState.subPage;

    if (sp < rwyPages) {
        const slice = allRunways.slice(sp * RWYS_PER_PAGE, (sp + 1) * RWYS_PER_PAGE);
        const label = rwyPages > 1 ? `RUNWAYS (${sp + 1}/${rwyPages}):` : 'RUNWAYS:';
        right.innerHTML =
            `<div class="kln90b-line dim" style="font-size:9px; margin-bottom:1px;">${label}</div>` +
            (slice.length
                ? slice.map(r => `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.4;">▸ ${r}</div>`).join('')
                : '<div class="kln90b-line dim">NO RWY DATA</div>');

        const wikiN = gpsState.wikiCache[icao]?.length || 1;
        const total = rwyPages + freqPages + wikiN;
        if (gpsState.maxPages[mode] !== total) {
            gpsState.maxPages[mode] = total;
            const lbl = document.getElementById('gpsPageLbl');
            if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
        }
        return;
    }

    const freqIdx = sp - rwyPages;
    if (freqPages > 0 && freqIdx >= 0 && freqIdx < freqPages) {
        const fSlice = allFreqs.slice(freqIdx * FREQS_PER_PAGE, (freqIdx + 1) * FREQS_PER_PAGE);
        const fLabel = freqPages > 1 ? `FREQ (${freqIdx + 1}/${freqPages}):` : 'FREQ:';
        right.innerHTML =
            `<div class="kln90b-line dim" style="font-size:9px; margin-bottom:1px;">${fLabel}</div>` +
            fSlice.map(f => `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.4;">▸ ${f.label}: ${f.value}</div>`).join('');

        const wikiN = gpsState.wikiCache[icao]?.length || 1;
        const total = rwyPages + freqPages + wikiN;
        if (gpsState.maxPages[mode] !== total) {
            gpsState.maxPages[mode] = total;
            const lbl = document.getElementById('gpsPageLbl');
            if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
        }
        return;
    }

    if (!gpsState.wikiCache[icao] && data) {
        await fetchAndCacheWikiPages(icao, data.lat, data.lon);
    }
    const wikiArr = gpsState.wikiCache[icao] || ['Keine Daten.'];
    const total = rwyPages + freqPages + wikiArr.length;
    if (gpsState.maxPages[mode] !== total) {
        gpsState.maxPages[mode] = total;
        const lbl = document.getElementById('gpsPageLbl');
        if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
    }
    if (gpsState.subPage >= total) gpsState.subPage = total - 1;

    const wikiPageIdx = sp - rwyPages - freqPages;
    if (wikiPageIdx >= 0 && wikiPageIdx < wikiArr.length) {
        right.innerHTML =
            `<div class="kln90b-line" style="font-size:9px; line-height:1.5; white-space:normal;">${wikiArr[wikiPageIdx]}</div>`;
    } else {
        right.innerHTML = '<div class="kln90b-line dim">NO WIKI DATA</div>';
    }
}

async function fetchAndCacheWikiPages(icao, lat, lon) {
    try {
        let title = wikiTitleCache[icao];

        if (!title) {
            const wdRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P239=${icao}&format=json&origin=*`, 4000);
            const wdData = await wdRes.json();

            if (wdData?.query?.search?.length > 0) {
                title = wdData.query.search[0].title;
            } else {
                const fallRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(icao + ' Flugplatz OR Flugplatz')}&srlimit=1&format=json&origin=*`, 4000);
                const fallData = await fallRes.json();
                if (fallData?.query?.search?.length > 0) title = fallData.query.search[0].title;
            }
            if (title) wikiTitleCache[icao] = title;
        }

        if (!title) {
            gpsState.wikiCache[icao] = ['Keine Wikipedia-Daten gefunden.'];
            return;
        }

        const extRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&exsentences=12&titles=${encodeURIComponent(title)}&format=json&origin=*`, 5000);
        const extData = await extRes.json();

        const pageId = Object.keys(extData.query.pages)[0];
        const txt = extData.query.pages[pageId]?.extract?.trim() || 'Keine Information verfügbar.';

        gpsState.wikiCache[icao] = splitTextIntoPages(txt, 170);
    } catch (e) {
        gpsState.wikiCache[icao] = ['Fetch-Fehler – bitte erneut versuchen.'];
    }
}

function splitTextIntoPages(text, charsPerPage = 360) {
    const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
    const pages = [];
    let remaining = cleaned;
    while (remaining.length > 0) {
        if (remaining.length <= charsPerPage) {
            pages.push(remaining);
            break;
        }
        let cut = charsPerPage;
        const lo = Math.max(cut - 60, 1), hi = Math.min(cut + 40, remaining.length - 1);
        for (let i = hi; i >= lo; i--) {
            if (('.!?').includes(remaining[i]) && remaining[i + 1] === ' ') {
                cut = i + 1; break;
            }
        }
        if (cut === charsPerPage) {
            while (cut > 0 && remaining[cut] !== ' ' && remaining[cut] !== '\n') cut--;
            if (cut === 0) cut = charsPerPage;
        }
        pages.push(remaining.substring(0, cut).trim());
        remaining = remaining.substring(cut).trim();
    }
    return pages.length > 0 ? pages : ['Keine Info'];
}

function renderAIP(left, right) {
    const isDep = gpsState.subPage === 0;
    const icao = isDep ? currentStartICAO : currentDestICAO;
    const name = isDep ? currentSName : currentDName;
    const label = isDep ? 'DEP' : 'DEST';
    gpsState.maxPages['AIP'] = 2;

    left.innerHTML =
        `<div class="kln90b-line highlight">${label}</div>` +
        `<div class="kln90b-line" style="font-size:10px;">${icao || '----'}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; white-space:normal;">${name || ''}</div>`;

    if (!icao) { right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>'; return; }
    const aipUrl = (typeof getAipPopupUrl === 'function')
        ? getAipPopupUrl(icao, globalAirports?.[icao]?.country || '')
        : null;
    if (!aipUrl) { right.innerHTML = '<div class="kln90b-line dim">AIP N/A</div>'; return; }

    right.innerHTML =
        `<div class="kln90b-line dim">AIP VFR</div>` +
        `<div class="kln90b-line highlight" style="cursor:pointer;" onclick="window.open('${aipUrl}','_blank')">OPEN ▸</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">aip.aero</div>`;
}

function renderWX(left, right) {
    const isDep = gpsState.subPage === 0;
    const icao = isDep ? currentStartICAO : currentDestICAO;
    const name = isDep ? currentSName : currentDName;
    const label = isDep ? 'DEP' : 'DEST';
    gpsState.maxPages['WX'] = 2;

    left.innerHTML =
        `<div class="kln90b-line highlight">${label}</div>` +
        `<div class="kln90b-line" style="font-size:10px;">${icao || '----'}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; white-space:normal;">${name || ''}</div>`;

    if (!icao) { right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>'; return; }

    right.innerHTML =
        `<div class="kln90b-line dim">METAR/TAF</div>` +
        `<div class="kln90b-line highlight" style="cursor:pointer;" onclick="window.open('https://metar-taf.com/de/${icao}','_blank')">OPEN ▸</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">metar-taf.com</div>`;
}

function refreshGPSAfterDispatch() {
    if (gpsState.visible) {
        setTimeout(() => renderGPS(), 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGPSButtons();
    initGPSEncoders();
    initCom2Knob();
    restoreAudioButtonStates();

    const el = document.getElementById('swVersionDisplay');
    if (/^https?:$/i.test(window.location.protocol)) {
        // SW Version auslesen und sofort anzeigen (wartet nicht auf Bilder)
        fetch('sw.js', { cache: 'no-store' })
            .then(r => r.text())
            .then(text => {
                const match = text.match(/const CACHE = ['"]([^'"]+)['"]/);
                if (match && el) el.innerText = match[1];
            }).catch(() => {
                if (el) el.innerText = "Offline";
            });
    } else if (el) {
        el.innerText = "FILE-MODE";
    }
});




// === FORCE UPDATE (V53) ===
window.forceAppUpdate = function() {
    if (confirm("Möchtest du ein Update erzwingen? Der Zwischenspeicher wird geleert und die App neu geladen.")) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) { registration.unregister(); }
                caches.keys().then(function(names) {
                    for (let name of names) caches.delete(name);
                    window.location.reload(true);
                });
            });
        } else {
            window.location.reload(true);
        }
    }
};


// === AUTO-RESIZE FÜR CANVAS & KARTE (z.B. bei Rotation in Landscape) ===
let vpWindowResizeTimeout = null;
window.addEventListener('resize', () => {
    if (vpWindowResizeTimeout) clearTimeout(vpWindowResizeTimeout);
    vpWindowResizeTimeout = setTimeout(() => {
        // 1. Leaflet Karte an neue Dimensionen anpassen
        if (typeof map !== 'undefined' && map) map.invalidateSize();
        
        // 2. Profile Canvas an neue Dimensionen anpassen (falls Kartentisch offen)
        const mapTableOverlay = document.getElementById('mapTableOverlay');
        if (mapTableOverlay && mapTableOverlay.classList.contains('active')) {
            if (typeof window.throttledRenderProfiles === 'function') {
                window.throttledRenderProfiles();
            }
        }
    }, 200); // 200ms warten, bis das mobile Gerät die Drehung visuell abgeschlossen hat
});

// Verstecke zielgenau die Zoom- und Y-Achsen-Steuerung inkl. Text-Labels auf mobilen Geräten
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 767) {
        const hideSpecificControls = (displayId, labelKeywords) => {
            const el = document.getElementById(displayId);
            if (!el) return;

            el.style.display = 'none';

            // 1. Rückwärts durch echte Elemente gehen (versteckt Buttons und Label-Spans/Divs)
            let prev = el.previousElementSibling;
            while (prev) {
                if (prev.tagName === 'BUTTON' || labelKeywords.some(kw => prev.textContent.toUpperCase().includes(kw))) {
                    prev.style.display = 'none';
                    prev = prev.previousElementSibling;
                } else {
                    break; // Stop, wenn ein völlig anderes Element (z.B. ein Toggle-Icon) erreicht wird
                }
            }

            // 2. Rückwärts durch alle Nodes gehen (erwischt "nackte" Text-Nodes ohne HTML-Tag)
            let prevNode = el.previousSibling;
            while (prevNode) {
                if (prevNode.nodeType === 3 && labelKeywords.some(kw => prevNode.textContent.toUpperCase().includes(kw))) {
                    prevNode.textContent = ''; // Rohen Text löschen
                }
                // Abbrechen, wenn wir ein echtes Element treffen, das weder Button noch gesuchtes Label ist
                if (prevNode.nodeType === 1 && prevNode.tagName !== 'BUTTON' && !labelKeywords.some(kw => prevNode.textContent.toUpperCase().includes(kw))) {
                    break; 
                }
                prevNode = prevNode.previousSibling;
            }

            // 3. Vorwärts gehen (versteckt nachfolgende Plus-Buttons)
            let next = el.nextElementSibling;
            while (next) {
                if (next.tagName === 'BUTTON') {
                    next.style.display = 'none';
                    next = next.nextElementSibling;
                } else {
                    break;
                }
            }
        };

        // Suche nach den Elementen und lösche auch die zugehörigen Texte/Labels davor
        hideSpecificControls('vpZoomDisplay', ['ZOOM']);
        hideSpecificControls('yAxisDisplay', ['MAX', 'FT', 'ALT']);
    }
});
