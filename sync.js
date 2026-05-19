/* === CLOUD SYNC & MULTIPLAYER FETCH LOGIC (v220) === */
/* =========================================================
   CLOUD SYNC LOGIC (Adaptive, Diffing, Debounce & Toggle)
   ========================================================= */
const SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync/';
let localSyncTime = localStorage.getItem('ga_sync_time') ? parseInt(localStorage.getItem('ga_sync_time')) : 0;
let lastSyncedPayloadStr = "";

function saveSyncToggle() {
    const t = document.getElementById('syncToggle');
    const label = document.getElementById('autoSyncLabel');
    if (t) {
        localStorage.setItem('ga_sync_enabled', t.checked);
        if (label) label.style.color = t.checked ? '#4caf50' : '#888';
    }
    if (t && t.checked) silentSyncLoad();
}

function getSyncId() {
    return document.getElementById('syncIdInput')?.value.trim() || localStorage.getItem('ga_sync_id') || "";
}

function getSyncPin() {
    return document.getElementById('syncPinInput')?.value.trim() || localStorage.getItem('ga_sync_pin') || "";
}

let liveSnailTrail = null;
let lastTrailPoint = null;
let isAutoFollow = true;
let lastGpsTickDetails = null;
let lastTelemetryUpdateAt = 0;
const PLANE_ICON_COLOR_KEY = 'ga_plane_color';
const PLANE_ICON_SIZE_KEY = 'ga_plane_size';
const PLANE_ICON_DEFAULT_COLOR = '#f2c12e';
const PLANE_ICON_DEFAULT_SIZE = 40;
const PLANE_ICON_MIN_SIZE = 20;
const PLANE_ICON_MAX_SIZE = 100;
const MISSION_AUTO_START_KEY = 'ga_mission_auto_start_enabled';

function isMissionAutoStartEnabled() {
    return localStorage.getItem(MISSION_AUTO_START_KEY) !== 'false';
}

function setMissionAutoStartEnabled(enabled) {
    const next = !!enabled;
    localStorage.setItem(MISSION_AUTO_START_KEY, next ? 'true' : 'false');
    if (!next && !missionRuntime.active) {
        missionRuntime.armed = false;
        missionRuntime.readySince = 0;
    }
    _updateMissionRuntimeUi();
}

window.isMissionAutoStartEnabled = isMissionAutoStartEnabled;
window.setMissionAutoStartEnabled = setMissionAutoStartEnabled;
window.toggleMissionAutoStart = function() {
    setMissionAutoStartEnabled(!isMissionAutoStartEnabled());
};

// --- PREDICTION VECTORS ---
let predictionLine = null;
let predictionMarkers = [];
let lastPredictionUpdate = 0;
let smoothedGS = 0;
let smoothedVS = 0;
let liveToWpLine = null;
let vpProfileLockIdx = -1;
let vpProfileLockSig = '';

// --- FLIGHT RECORDER (Snail Trail + Stats) ---
let flightRecorder = {
    active: false,
    armed: false,
    startCandidateSince: 0,
    lastUpdateTs: 0,
    pauseActive: false,
    airborneEvidenceSec: 0,
    hadAirbornePhase: false,
    startTs: 0,
    endTs: 0,
    lowSpeedSince: 0,
    wasOnGround: false,
    farewellTriggered: false,
    touchdownVsFpm: null,
    maxGs: 0,
    maxAltFt: 0,
    sumGs: 0,
    gsSamples: 0,
    distNm: 0,
    track: [],
    lastSample: null,
    maxBankDeg: 0,
    maxGForce: 1.0,
    sumGForce: 0,
    gForceSamples: 0,
    maxAglFt: 0,
    maxClimbFpm: 0,
    maxDescentFpm: 0
};

let missionRuntime = {
    armed: false,
    active: false,
    manual: false,
    readySince: 0,
    pendingEndAt: 0,
    lastOffDestAt: 0
};

let missionSmokeCommandSeq = 0;
window.missionSmokeStatus = {
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null
};

function _normalizeFireTruthOverride(value) {
    const s = String(value || '').trim().toLowerCase();
    if (/^(fire|smoke|rauch|true|1|yes|ja)$/.test(s)) return 'fire';
    if (/^(false_alarm|falsealarm|no_smoke|kein_rauch|none|false|0|no|nein)$/.test(s)) return 'false_alarm';
    return null;
}

function _initFireMissionDebugFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.has('fireDebug')) {
            const raw = String(params.get('fireDebug') || '').toLowerCase();
            localStorage.setItem('ga_fire_debug', raw === '0' || raw === 'false' || raw === 'off' ? '0' : '1');
        }
        if (params.has('fireTruth')) {
            const override = _normalizeFireTruthOverride(params.get('fireTruth'));
            if (override) localStorage.setItem('ga_fire_truth_override', override);
            else localStorage.removeItem('ga_fire_truth_override');
        }
    } catch (_) {}
}
_initFireMissionDebugFromUrl();

window.fireMissionDebugEnabled = function() {
    try { return localStorage.getItem('ga_fire_debug') === '1'; } catch (_) { return false; }
};

window.fireMissionTruthOverride = function() {
    try { return _normalizeFireTruthOverride(localStorage.getItem('ga_fire_truth_override')); } catch (_) { return null; }
};

function _activeFireScenario() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const fs = md?.fireScenario;
    return (fs && typeof fs === 'object' && fs.enabled) ? fs : null;
}

function _persistMissionSmokeState() {
    try {
        if (typeof saveMissionState === 'function') saveMissionState();
        else if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            localStorage.setItem('ga_active_mission', JSON.stringify({ currentMissionData }));
        }
    } catch (_) {}
}

window.sendTrackerCommand = function(command = {}) {
    const ws = liveGpsSocket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const fs = _activeFireScenario();
    const pos = window.lastLiveGpsPos || {};
    const lat = Number.isFinite(Number(pos.lat)) ? Number(pos.lat)
        : (Number.isFinite(Number(command.lat)) ? Number(command.lat)
            : (Number.isFinite(Number(fs?.target?.lat)) ? Number(fs.target.lat) : null));
    const lon = Number.isFinite(Number(pos.lon)) ? Number(pos.lon)
        : (Number.isFinite(Number(command.lon)) ? Number(command.lon)
            : (Number.isFinite(Number(fs?.target?.lon)) ? Number(fs.target.lon) : null));
    const alt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt)
        : (Number.isFinite(Number(command.altFt)) ? Number(command.altFt)
            : (Number.isFinite(Number(fs?.target?.altFt)) ? Number(fs.target.altFt) : 0));
    const hdg = Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg)
        : (Number.isFinite(Number(command.hdg ?? command.heading)) ? Number(command.hdg ?? command.heading) : 0);
    const commandId = command.commandId || `cmd-${Date.now()}-${++missionSmokeCommandSeq}`;
    const payload = {
        type: 'gps',
        syncId: getSyncId(),
        pin: getSyncPin(),
        target: 'tracker',
        commandOnly: true,
        trackerCommand: {
            ...command,
            commandId,
            pin: getSyncPin()
        }
    };
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.lat = lat;
        payload.lon = lon;
        payload.alt = Math.round(Number.isFinite(alt) ? alt : 0);
        payload.hdg = Math.round(Number.isFinite(hdg) ? hdg : 0);
    }
    ws.send(JSON.stringify(payload));
    return commandId;
};

window.missionSmokeEnsureSpawned = function(reason = 'mission-active') {
    const fs = _activeFireScenario();
    if (!fs || fs.truth !== 'fire' || !fs.smoke || fs.smoke.spawned) return false;
    if (fs.smoke.spawnRequestedAt && (Date.now() - fs.smoke.spawnRequestedAt) < 15000) return false;
    const commandId = window.sendTrackerCommand({
        type: 'mission_smoke_spawn',
        missionId: fs.missionId,
        reason,
        objectTitle: fs.smoke.objectTitle || 'Chimney_Smoke_V1',
        lat: fs.smoke.lat,
        lon: fs.smoke.lon,
        altFt: fs.smoke.altFt,
        hdg: fs.smoke.hdg || 0,
        count: fs.smoke.count || 5,
        radiusM: fs.smoke.radiusM || 120
    });
    if (!commandId) return false;
    fs.smoke.spawnRequestedAt = Date.now();
    fs.smoke.spawnCommandId = commandId;
    window.missionSmokeStatus.lastCommandAt = Date.now();
    _persistMissionSmokeState();
    return true;
};

window.missionSmokeClear = function(reason = 'mission-end') {
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke || (!fs.smoke.spawned && !fs.smoke.spawnRequestedAt)) return false;
    const commandId = window.sendTrackerCommand({
        type: 'mission_smoke_clear',
        missionId: fs.missionId,
        reason
    });
    if (!commandId) return false;
    fs.smoke.clearRequestedAt = Date.now();
    fs.smoke.clearCommandId = commandId;
    _persistMissionSmokeState();
    return true;
};

function _handleTrackerAck(ack) {
    if (!ack || typeof ack !== 'object') return;
    window.missionSmokeStatus.lastAckAt = Date.now();
    window.missionSmokeStatus.lastAck = ack;
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke || (ack.missionId && ack.missionId !== fs.missionId)) return;
    if (ack.type === 'mission_smoke_spawn_ack') {
        fs.smoke.spawnAckAt = Date.now();
        fs.smoke.spawned = ack.status === 'ok';
        fs.smoke.spawnedCount = Number(ack.spawned || 0);
        fs.smoke.spawnError = ack.status === 'ok' ? null : (ack.error || ack.status || 'spawn_failed');
    } else if (ack.type === 'mission_smoke_clear_ack') {
        fs.smoke.clearAckAt = Date.now();
        fs.smoke.spawned = false;
        fs.smoke.cleared = ack.status === 'ok' || ack.status === 'noop';
    }
    _persistMissionSmokeState();
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
}

window.fireMissionDebugForceSmoke = function(reason = 'debug-force-smoke') {
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke) return false;
    fs.truth = 'fire';
    fs.debugOverride = 'force_fire_runtime';
    fs.smoke.spawned = false;
    fs.smoke.spawnRequestedAt = 0;
    fs.smoke.spawnError = null;
    fs.smoke.cleared = false;
    _persistMissionSmokeState();
    const sent = window.missionSmokeEnsureSpawned(reason);
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

window.fireMissionDebugClearSmoke = function(reason = 'debug-clear-smoke') {
    const sent = window.missionSmokeClear(reason);
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

window.fireMissionSmokeDebugSummary = function() {
    const fs = _activeFireScenario();
    if (!fs) return 'Keine Fire-Mission aktiv.';
    const smoke = fs.smoke || {};
    const ack = window.missionSmokeStatus?.lastAck || null;
    const parts = [
        `truth=${fs.truth || 'n/a'}${fs.debugOverride ? ` (${fs.debugOverride})` : ''}`,
        `requested=${smoke.spawnRequestedAt ? new Date(smoke.spawnRequestedAt).toLocaleTimeString('de-DE') : 'nein'}`,
        `spawned=${smoke.spawned ? `ja (${smoke.spawnedCount || '?'})` : 'nein'}`,
        smoke.spawnError ? `error=${smoke.spawnError}` : '',
        ack ? `lastAck=${ack.type || '?'}:${ack.status || '?'}` : 'lastAck=keins'
    ].filter(Boolean);
    return parts.join(' | ');
};

function _updateMissionRuntimeUi() {
    const autoStartEnabled = isMissionAutoStartEnabled();
    const st = document.getElementById('missionRuntimeStatus');
    if (st) {
        st.textContent = missionRuntime.active
            ? (missionRuntime.manual || !autoStartEnabled ? 'Aktiv (manuell)' : 'Aktiv')
            : (!autoStartEnabled ? 'Manuell bereit' : (missionRuntime.armed ? 'Scharf (bereit)' : 'Wartet auf Boden-Stabilisierung'));
        st.style.color = missionRuntime.active ? '#4caf50' : (!autoStartEnabled ? '#8ec5ff' : (missionRuntime.armed ? '#f2c12e' : '#888'));
    }
    const bStart = document.getElementById('missionStartBtn');
    const bEnd = document.getElementById('missionEndBtn');
    const bAuto = document.getElementById('missionAutoStartBtn');
    const bMap = document.getElementById('mapMissionToggleBtn');
    if (bStart) bStart.disabled = missionRuntime.active;
    if (bEnd) bEnd.disabled = !missionRuntime.active;
    if (bAuto) {
        bAuto.textContent = autoStartEnabled ? 'AUTO START: AN' : 'AUTO START: AUS';
        bAuto.title = autoStartEnabled
            ? 'Automatische Missions-Erkennung ist aktiv'
            : 'Automatische Missions-Erkennung ist aus';
        bAuto.setAttribute('aria-pressed', autoStartEnabled ? 'true' : 'false');
        bAuto.classList.toggle('is-on', autoStartEnabled);
        bAuto.classList.toggle('is-off', !autoStartEnabled);
    }
    if (bMap) {
        bMap.style.display = autoStartEnabled ? 'none' : 'inline-flex';
        bMap.textContent = missionRuntime.active ? '■ Mission stoppen' : '▶ Mission starten';
        bMap.title = missionRuntime.active ? 'Mission manuell stoppen' : 'Mission manuell starten';
        bMap.classList.toggle('is-active', missionRuntime.active);
    }
}

function _resetMissionRuntime() {
    missionRuntime = {
        armed: false,
        active: false,
        manual: false,
        readySince: 0,
        pendingEndAt: 0,
        lastOffDestAt: 0
    };
    _updateMissionRuntimeUi();
}

function _targetPointForMission() {
    const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : null;
    if (!wps || wps.length < 1) return null;
    const isPoi = (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI');
    const wp = isPoi ? wps[0] : wps[wps.length - 1];
    const lat = Number(wp?.lat), lon = Number(wp?.lng ?? wp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

function _haversineNmLocal(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _distanceToMissionTargetNm(lat, lon) {
    const t = _targetPointForMission();
    if (!t) return null;
    return _haversineNmLocal(lat, lon, t.lat, t.lon);
}

function _isAtMissionTarget(lat, lon, thresholdNm = 1.2) {
    const dNm = _distanceToMissionTargetNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

window.missionRuntimeReset = function() {
    if (typeof window.missionSmokeClear === 'function') window.missionSmokeClear('mission-runtime-reset');
    _resetMissionRuntime();
    resetFlightRecorder();
};

window.manualMissionStart = function() {
    missionRuntime.armed = true;
    missionRuntime.active = true;
    missionRuntime.manual = true;
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    resetFlightRecorder();
    const pos = window.lastLiveGpsPos;
    if (pos && typeof window.triggerPaxGreeting === 'function') {
        setTimeout(() => window.triggerPaxGreeting(pos.lat, pos.lon), 200);
    }
    if (typeof window.missionSmokeEnsureSpawned === 'function') window.missionSmokeEnsureSpawned('manual-mission-start');
    _updateMissionRuntimeUi();
};

window.manualMissionEnd = function() {
    if (typeof window.missionSmokeClear === 'function') window.missionSmokeClear('manual-mission-end');
    const pos = window.lastLiveGpsPos;
    const shouldFinalize = !!(flightRecorder && (flightRecorder.active || flightRecorder.hadAirbornePhase || (Array.isArray(flightRecorder.track) && flightRecorder.track.length > 1)));
    missionRuntime.active = false;
    missionRuntime.armed = false;
    missionRuntime.manual = false;
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    if (shouldFinalize) finalizeFlightRecorder(Date.now(), pos?.lat ?? null, pos?.lon ?? null);
    else resetFlightRecorder();
    _updateMissionRuntimeUi();
};

window.toggleManualMissionRuntime = function() {
    if (missionRuntime.active) window.manualMissionEnd();
    else window.manualMissionStart();
};

// --- LIVE TRAFFIC ---
let liveTrafficMarkers = {}; // key → { marker }
window.vpTrafficData = [];
window.vpTrafficMapVisible = true;

function isMapHintOn(key, fallback = true) {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled(key);
    return fallback;
}

function isLowFpsModeActive() {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled('lowFps');
    return localStorage.getItem('ga_map_hint_lowFps') === 'true';
}

function normalizePlaneIconColor(value) {
    const v = String(value || '').trim();
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

function normalizePlaneIconSize(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(PLANE_ICON_MAX_SIZE, Math.max(PLANE_ICON_MIN_SIZE, n));
}

function getCurrentPlaneIconDefaults() {
    const rootStyle = getComputedStyle(document.documentElement);
    const colorCss = normalizePlaneIconColor(rootStyle.getPropertyValue('--plane-color').trim());
    const sizeCss = normalizePlaneIconSize(rootStyle.getPropertyValue('--plane-size'));
    return {
        color: colorCss || PLANE_ICON_DEFAULT_COLOR,
        size: sizeCss || PLANE_ICON_DEFAULT_SIZE
    };
}

function applyPlaneIconSettings({ color, size, persist = false } = {}) {
    const defaults = getCurrentPlaneIconDefaults();
    const nextColor = normalizePlaneIconColor(color) || defaults.color;
    const nextSize = normalizePlaneIconSize(size) || defaults.size;
    document.documentElement.style.setProperty('--plane-color', nextColor);
    document.documentElement.style.setProperty('--plane-size', `${nextSize}px`);
    if (persist) {
        localStorage.setItem(PLANE_ICON_COLOR_KEY, nextColor);
        localStorage.setItem(PLANE_ICON_SIZE_KEY, String(nextSize));
    }

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && colorPicker.value !== nextColor) colorPicker.value = nextColor;

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider) sizeSlider.value = String(nextSize);

    const sizeLabel = document.getElementById('vpPlaneSizeValue');
    if (sizeLabel) sizeLabel.textContent = `${nextSize} px`;
}

function initPlaneIconSettingsUi() {
    const defaults = getCurrentPlaneIconDefaults();
    const storedColor = normalizePlaneIconColor(localStorage.getItem(PLANE_ICON_COLOR_KEY));
    const storedSize = normalizePlaneIconSize(localStorage.getItem(PLANE_ICON_SIZE_KEY));
    applyPlaneIconSettings({
        color: storedColor || defaults.color,
        size: storedSize || defaults.size
    });

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && !colorPicker.dataset.boundPlaneIcon) {
        colorPicker.dataset.boundPlaneIcon = '1';
        colorPicker.addEventListener('input', (e) => {
            applyPlaneIconSettings({ color: e.target.value, persist: true });
        });
    }

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider && !sizeSlider.dataset.boundPlaneIcon) {
        sizeSlider.dataset.boundPlaneIcon = '1';
        sizeSlider.addEventListener('input', (e) => {
            applyPlaneIconSettings({ size: e.target.value, persist: true });
        });
    }
}

window.clearLiveToWpLine = function() {
    if (liveToWpLine) {
        try { liveToWpLine.remove(); } catch (e) {}
        liveToWpLine = null;
    }
};

function toggleAutoFollow() {
    isAutoFollow = !isAutoFollow;
    if (isAutoFollow) {
        lastAutoFollowPanAt = 0;
        lastAutoFollowPanPos = null;
    }
    const btn = document.getElementById('autoFollowBtn');
    if (btn) {
        btn.style.background = isAutoFollow ? 'var(--blue)' : '#666';
        btn.innerHTML = isAutoFollow ? '🎯' : '📍';
    }
}

function saveSyncId() {
    const id = document.getElementById('syncIdInput').value.trim();
    const pin = document.getElementById('syncPinInput').value.trim();
    
    localStorage.setItem('ga_sync_id', id);
    localStorage.setItem('ga_sync_pin', pin);
    
    // Wir setzen den Status auf Offline zurück, wenn sich die ID ändert,
    // außer wir sind gerade mitten im Login-Check.
    setSyncLoginState(false);
}

async function triggerLoginFlow(isAutoLogin = false) {
    const id = getSyncId();
    const pin = getSyncPin();

    if (!id || !pin) {
        if (!isAutoLogin) alert("Bitte Pilot-ID und PIN eingeben.");
        return;
    }

    const loginBtn = document.getElementById('loginSyncBtn');
    if (loginBtn) {
        loginBtn.innerText = "🔑 Prüfe...";
        loginBtn.disabled = true;
    }

    try {
        // Fall A: Existenz-Prüfung & PIN-Check (GET)
        const res = await fetch(SYNC_URL + id + "?pin=" + pin, {
            headers: { 'X-Pilot-PIN': pin }
        });

        if (res.status === 200) {
            // Erfolg (Existiert & PIN stimmt)
            localStorage.setItem('ga_saved_id', id);
            localStorage.setItem('ga_saved_pin', pin);
            if (!isAutoLogin) alert("✅ Erfolgreich angemeldet!");
            setSyncLoginState(true);
        } else if (res.status === 401) {
            // ID existiert, aber PIN falsch
            if (!isAutoLogin) {
                alert("❌ Zugriff verweigert: Passwort falsch oder ID bereits vergeben!");
            } else {
                // Bei stillem Auto-Login Fehler: Daten löschen, damit nicht bei jedem Load der Fehler passiert
                localStorage.removeItem('ga_saved_id');
                localStorage.removeItem('ga_saved_pin');
            }
            setSyncLoginState(false);
        } else if (res.status === 404) {
            // ID ist noch frei! -> Fall C: Registrieren (POST)
            const registerRes = await fetch(SYNC_URL + id, {
                method: 'POST',
                headers: { 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, flights: [], lastModified: Date.now() })
            });
            if (registerRes.ok) {
                localStorage.setItem('ga_saved_id', id);
                localStorage.setItem('ga_saved_pin', pin);
                if (!isAutoLogin) alert("✅ Neuer Pilot erfolgreich registriert!");
                setSyncLoginState(true);
            } else {
                throw new Error("Registrierung fehlgeschlagen");
            }
        } else {
            throw new Error("Server-Fehler");
        }
    } catch (e) {
        console.error("[Login] Fehler:", e);
        if (!isAutoLogin) alert("⚠️ Verbindung zum Sync-Server fehlgeschlagen.");
        setSyncLoginState(false);
    } finally {
        if (loginBtn) {
            loginBtn.innerText = "🔑 Login / Verknüpfen";
            loginBtn.disabled = false;
        }
    }
}

function setSyncLoginState(isLoggedIn) {
    const led = document.getElementById('loginLed');
    const txt = document.getElementById('loginText');
    const syncStatus = document.getElementById('syncStatus');
    const syncId = getSyncId();
    const loginBtn = document.getElementById('loginSyncBtn');

    if (isLoggedIn) {
        if (led) { led.style.background = "#00ff41"; led.style.boxShadow = "0 0 8px #00ff41"; }
        if (txt) { txt.innerText = "Verbunden"; txt.style.color = "#00ff41"; }
        if (syncStatus) syncStatus.innerText = "Bereit (" + syncId + ")";
        
        // Buttons aktivieren, Login-Button bleibt immer aktiv
        document.querySelectorAll('.sync-req-btn').forEach(btn => btn.disabled = false);
        if (loginBtn) loginBtn.disabled = false; // Ensure login button is enabled

        const toggle = document.getElementById('syncToggle');
        if (toggle) toggle.disabled = false;

        // Hint aktualisieren
        const hint = document.getElementById('loginHint');
        if (hint) hint.innerText = "Du bist als " + syncId + " angemeldet. Daten werden synchronisiert.";

        // Sync & GPS starten falls gewünscht
        const t = document.getElementById('syncToggle');
        if (t) {
            const savedToggle = localStorage.getItem('ga_sync_enabled') === 'true';
            t.checked = savedToggle;
            const label = document.getElementById('autoSyncLabel');
            if (label) label.style.color = savedToggle ? '#4caf50' : '#888';
        }
        if (t && t.checked) silentSyncLoad();
        if (typeof connectToLiveGPS === 'function') connectToLiveGPS(syncId);
    } else {
        if (led) { led.style.background = "#d93829"; led.style.boxShadow = "0 0 5px #d93829"; }
        if (txt) { txt.innerText = "Offline"; txt.style.color = "#888"; }
        if (syncStatus) syncStatus.innerText = "Anmeldung erforderlich";
        
        // Buttons deaktivieren, Login-Button bleibt immer aktiv
        document.querySelectorAll('.sync-req-btn').forEach(btn => {
            if (btn.id !== 'loginSyncBtn') btn.disabled = true;
        });
        if (loginBtn) loginBtn.disabled = false; // Ensure login button is enabled

        const toggle = document.getElementById('syncToggle');
        if (toggle) { toggle.disabled = true; toggle.checked = false; }

        const hint = document.getElementById('loginHint');
        if (hint) hint.innerText = "Bitte logge dich ein, um Cloud-Sync zu nutzen.";
    }
}
function updateSyncStatus(msg, isError = false) {
    const el = document.getElementById('syncStatus');
    if (el) {
        el.innerText = msg;
        el.style.color = isError ? "var(--red)" : "var(--green)";
        setTimeout(() => { if(el.innerText === msg) el.style.color = "#888"; }, 4000);
    }
}
function flashSyncIndicator(direction) {
    const ind = document.getElementById('syncTrafficIndicator');
    if (!ind) return;
    ind.innerText = direction === 'up' ? '⬆️' : '⬇️';
    ind.style.opacity = '1';
    setTimeout(() => { ind.style.opacity = '0'; }, 800);
}
function setLastSyncedPayload() {
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
        activeMission: JSON.parse(localStorage.getItem('ga_active_mission') || 'null'),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]')
    };
    lastSyncedPayloadStr = JSON.stringify(payloadToCompare);
}
async function triggerCloudSave(immediate = false) {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id) return;
    // SOFT-SYNC FIX: Normale Spielaktionen (wie Zettel bewegen) rufen dies ohne Parameter auf.
    // Diese blockieren wir jetzt hart. Ein Upload findet NUR noch beim Schließen (true)
    // oder durch manuelle Buttons ('manual') statt!
    if (!immediate) return;
    if (immediate !== 'manual' && t && !t.checked) return;
    if (immediate === 'manual') {
        if (!confirm("⬆️ CLOUD UPLOAD\nMöchtest du deinen aktuellen, lokalen Stand hochladen und das bisherige Cloud-Backup überschreiben?")) return;
        setNavComLed('navcomSaveBtn', 'syncing');
    }
    localSyncTime = Date.now();
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
        activeMission: JSON.parse(localStorage.getItem('ga_active_mission') || 'null'),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]')
    };

    const currentPayloadStr = JSON.stringify(payloadToCompare);
    if (currentPayloadStr === lastSyncedPayloadStr && immediate !== 'manual') {
        updateSyncStatus("Cloud: Aktuell ✅");
        return;
    }
    updateSyncStatus("Speichere in Cloud...");
    localStorage.setItem('ga_sync_time', localSyncTime);
    const payload = { ...payloadToCompare, lastModified: localSyncTime, pin: getSyncPin() };
    try {
        const id = getSyncId();
        const pin = getSyncPin();
        const res = await fetch(SYNC_URL + id + "?pin=" + pin, { 
            method: 'POST', 
            headers: { 'X-Pilot-PIN': pin },
            body: JSON.stringify(payload), 
            keepalive: true 
        });
        if (res.ok) {
            lastSyncedPayloadStr = currentPayloadStr;
            updateSyncStatus("Cloud: Gespeichert ✅");
            flashSyncIndicator('up');
            if (immediate === 'manual') {
                setNavComLed('navcomSaveBtn', 'success');
                setTimeout(() => setNavComLed('navcomSaveBtn', 'off'), 3000);
            }
        } else if (res.status === 401) {
            updateSyncStatus("Cloud: PIN falsch! ❌", true);
            alert("Zugriff verweigert: PIN falsch!");
        } else {
            throw new Error("Server Error");
        }
    } catch (e) {
        updateSyncStatus("Cloud: Speicher-Fehler", true);
        if (immediate === 'manual') {
            setNavComLed('navcomSaveBtn', 'error');
            setTimeout(() => setNavComLed('navcomSaveBtn', 'off'), 3000);
        }
    }
}
async function forceSyncLoad() {
    if (!confirm("⬇️ CLOUD DOWNLOAD\nMöchtest du deinen Spielstand aus der Cloud laden? Alle lokalen Änderungen (die nicht hochgeladen wurden) gehen dabei verloren!")) return;
    const id = getSyncId();
    if (!id) { alert("Bitte zuerst eine Pilot-ID eingeben oder generieren (🎲)."); return; }

    setNavComLed('navcomLoadBtn', 'syncing');
    updateSyncStatus("Lade Daten...");

    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            setNavComLed('navcomLoadBtn', 'error');
            setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
            return;
        }
        if (res.status === 404) {
            alert("Zu dieser ID wurden keine Daten gefunden.");
            updateSyncStatus("Nicht gefunden", true);
            setNavComLed('navcomLoadBtn', 'error');
            setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
            return;
        }
        if (!res.ok) throw new Error("Netzwerkfehler");
        const data = await res.json();

        if (data.lastModified) {
            localSyncTime = data.lastModified;
            localStorage.setItem('ga_sync_time', localSyncTime);
        }
        if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
        if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
        if (data.activeMission) {
            localStorage.setItem('ga_active_mission', JSON.stringify(data.activeMission));
            restoreMissionState(data.activeMission);
        } else {
            localStorage.removeItem('ga_active_mission');
            document.getElementById("briefingBox").style.display = "none";
        }
        if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
        if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));

        if (data.groupName !== undefined) {
            updateGroupUIFromSync(data.groupName, data.groupNick);
        }
        setLastSyncedPayload();
        updateGroupBadgeUI();
        updateSyncStatus("Cloud: Geladen ✅");
        flashSyncIndicator('down');

        setNavComLed('navcomLoadBtn', 'success');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
        if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
        renderLog();
    } catch (e) {
        updateSyncStatus("Cloud: Lade-Fehler", true);
        alert("Fehler beim Laden aus der Cloud.");
        setNavComLed('navcomLoadBtn', 'error');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
    }
}
async function silentSyncLoad() {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id || (t && !t.checked)) return;
    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.lastModified && data.lastModified > localSyncTime) {
            localSyncTime = data.lastModified;
            localStorage.setItem('ga_sync_time', localSyncTime);
            if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
            if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
            if (data.activeMission) {
                localStorage.setItem('ga_active_mission', JSON.stringify(data.activeMission));
                restoreMissionState(data.activeMission);
            } else {
                localStorage.removeItem('ga_active_mission');
                document.getElementById("briefingBox").style.display = "none";
            }
            if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
            if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));

            if (data.groupName !== undefined) {
                updateGroupUIFromSync(data.groupName, data.groupNick);
            }

            setLastSyncedPayload();
            updateGroupBadgeUI();
            if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
            renderLog();
            updateSyncStatus("Auto-Sync: Aktualisiert 🔄");
            flashSyncIndicator('down');
        }
    } catch (e) {}
}
// === GROUP SYNC LOGIC ===
let groupSyncTime = 0;
let isGroupSyncing = false;
async function silentGroupSync() {
    const gName = getGroupName();
    const gNick = getGroupNick();
    if(!gName || isGroupSyncing) return;

    try {
        const res = await fetch(SYNC_URL + "GROUP_" + gName + "?pin=" + getSyncPin() + "&syncId=" + getSyncId(), {
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() }
        });
        if (res.status === 401) {
            updateSyncStatus("Crew Auth Fehler", true);
            leaveGroup(true);
            return;
        }
        if (!res.ok) return;
        const data = await res.json();

        if (data.lastModified && data.lastModified > groupSyncTime) {
            groupSyncTime = data.lastModified;
            let knownNotes = JSON.parse(localStorage.getItem('ga_known_group_notes')) || [];
            let newBadges = JSON.parse(localStorage.getItem('ga_group_new')) || [];
            let changed = false;
            if (data.kicked && data.kicked.includes(getSyncId())) {
                alert("❌ Du wurdest vom Admin aus der Crew entfernt.");
                leaveGroup(true);
                return;
            }
            const downloadedNotes = data.notes || [];
            const activeNoteIds = downloadedNotes.map(n => n.id);

            // Ghost-Badge Fix: Entferne alte Badges von Zetteln, die gelöscht wurden
            const originalBadgeCount = newBadges.length;
            newBadges = newBadges.filter(id => activeNoteIds.includes(id));
            if (originalBadgeCount !== newBadges.length) changed = true;
            downloadedNotes.forEach(dn => {
                if(!knownNotes.includes(dn.id)) {
                    knownNotes.push(dn.id);
                    if (dn.author !== gNick) {
                        newBadges.push(dn.id);
                    }
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem('ga_known_group_notes', JSON.stringify(knownNotes));
                localStorage.setItem('ga_group_new', JSON.stringify(newBadges));
                triggerCloudSave(true); // Ins Profil sichern
            }
            groupDataCache = data;
            updateGroupBadgeUI();
            if (document.getElementById('pinboardOverlay').classList.contains('active') && currentBoardMode === 'group') {
                renderNotes();
            }
        }
    } catch(e) {}
}
async function triggerGroupSave(immediate = false) {
    const gName = getGroupName();
    const gNick = getGroupNick();
    if(!gName) return;
    isGroupSyncing = true;
    try {
        const syncId = getSyncId();
        const pin = getSyncPin();
        const res = await fetch(SYNC_URL + "GROUP_" + gName + "?pin=" + pin + "&syncId=" + syncId, {
            headers: { 'X-Pilot-PIN': pin, 'X-Pilot-ID': syncId }
        });
        let latestData = { members: [], notes: [] };
        if (res.ok) latestData = await res.json();

        let members = latestData.members || [];
        // Veraltete Mitglieder (außer Admin) herausfiltern
        members = members.filter(m => {
            const timeoutMs = m.isAdmin ? (365 * 24 * 60 * 60 * 1000) : (28 * 24 * 60 * 60 * 1000);
            return (Date.now() - m.lastSeen) < timeoutMs && m.syncId !== syncId;
        });

        let amIAdmin = false;
        const existingMe = (latestData.members || []).find(m => m.syncId === syncId);
        if (existingMe && existingMe.isAdmin) amIAdmin = true;
        if (members.length === 0) amIAdmin = true; // Wer die Gruppe belebt, wird Admin
        members.push({ nick: gNick, syncId: syncId, lastSeen: Date.now(), isAdmin: amIAdmin });

        // Max 10 Mitglieder (älteste Nicht-Admins fliegen zuerst)
        if(members.length > 10) {
            members.sort((a,b) => b.lastSeen - a.lastSeen); // Neueste zuerst
            members = members.slice(0, 10);
        }

        // Kicked-Liste behalten
        const kickedList = latestData.kicked || [];

        let cloudNotes = latestData.notes || [];
        let localNotes = groupDataCache.notes || [];

        const myLocalNotes = localNotes.filter(n => n.author === gNick);
        const theirCloudNotes = cloudNotes.filter(n => n.author !== gNick);
        let mergedNotes = [...myLocalNotes, ...theirCloudNotes];

        const payload = { members: members, notes: mergedNotes, kicked: kickedList, lastModified: Date.now(), pin: getSyncPin(), syncId: getSyncId() };

        groupDataCache = payload;
        groupSyncTime = payload.lastModified;
        await fetch(SYNC_URL + "GROUP_" + gName, { 
            method: 'POST', 
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() },
            body: JSON.stringify(payload), 
            keepalive: true 
        });
    } catch(e) {}
    isGroupSyncing = false;
}
async function forceGroupSync() {
    await triggerGroupSave(true);
    await silentGroupSync();
}
// === Auto-Sync Trigger (Adaptive Polling & Idle-Conflict-Check) ===
let syncLastActivityTime = Date.now();
let syncLastFetchTime = Date.now();
let syncIsSleeping = false;
let idleCheckInProgress = false;
async function checkCloudAfterIdle() {
    const id = getSyncId();
    if (!id) return;
    idleCheckInProgress = true;
    updateSyncStatus("Prüfe Cloud...");
    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            return;
        }
        if (!res.ok) throw new Error("Netzwerkfehler");
        const data = await res.json();
        if (data.lastModified && data.lastModified > localSyncTime) {
            // Lokalen Status abgleichen (Habe ich hier ungespeicherte Änderungen?)
            const payloadToCompare = {
                pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
                logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
                activeMission: JSON.parse(localStorage.getItem('ga_active_mission') || 'null'),
                groupName: getGroupName(),
                groupNick: getGroupNick(),
                knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
                newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]')
            };
            const currentPayloadStr = JSON.stringify(payloadToCompare);
            const hasLocalUnsavedChanges = (currentPayloadStr !== lastSyncedPayloadStr);
            let msg = "☁️ NEUE CLOUD DATEN VERFÜGBAR\n\nEin anderes Gerät hat in der Zwischenzeit neue Daten gespeichert.\nMöchtest du deinen aktuellen Bildschirm aktualisieren?";
            if (hasLocalUnsavedChanges) {
                msg = "⚠️ CLOUD KONFLIKT\n\nEin anderes Gerät hat in der Zwischenzeit neue Daten gespeichert. Du hast hier aber UNGESPEICHERTE lokale Änderungen!\n\nMöchtest du die Cloud-Daten laden? (Deine lokalen Änderungen hier gehen dann verloren!)";
            }
            if (confirm(msg)) {
                // User will laden -> Daten anwenden
                localSyncTime = data.lastModified;
                localStorage.setItem('ga_sync_time', localSyncTime);
                if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
                if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
                if (data.activeMission) {
                    localStorage.setItem('ga_active_mission', JSON.stringify(data.activeMission));
                    restoreMissionState(data.activeMission);
                } else {
                    localStorage.removeItem('ga_active_mission');
                    document.getElementById("briefingBox").style.display = "none";
                }
                if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
                if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
                if (data.groupName !== undefined) {
                    updateGroupUIFromSync(data.groupName, data.groupNick);
                }
                setLastSyncedPayload();
                updateGroupBadgeUI();
                if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
                renderLog();
                updateSyncStatus("Cloud-Update geladen ✅");
                flashSyncIndicator('down');
            } else {
                // User lehnt ab -> Behalte lokale Daten.
                // Wir setzen die Sync-Zeit künstlich hoch, damit der lokale Stand als der "neueste" gilt und beim Schließen gepusht wird.
                localSyncTime = Date.now();
                localStorage.setItem('ga_sync_time', localSyncTime);
                updateSyncStatus("Lokaler Stand behalten");
            }
        } else {
            updateSyncStatus("Auto-Sync: Aktuell ✅");
        }
    } catch(e) {
        updateSyncStatus("Cloud-Prüfung fehlgeschlagen", true);
    }
    // 10 Sekunden Cooldown, damit man bei vielen Klicks nicht bombardiert wird
    setTimeout(() => { idleCheckInProgress = false; }, 10000);
}
function resetSyncTimer() {
    try {
        const now = Date.now();
        const idleTime = now - syncLastActivityTime;
        if (idleTime > 30000 && !idleCheckInProgress) {
            const t = document.getElementById('syncToggle');
            if (getSyncId() && t && t.checked) {
                checkCloudAfterIdle();
            }
        }
        syncLastActivityTime = now;
        if (syncIsSleeping) {
            syncIsSleeping = false;
            syncLastFetchTime = now;
        }
    } catch(e) {
        console.warn("Sync Timer Error intercepted", e);
    }
}
['click', 'touchstart', 'scroll', 'keydown'].forEach(evt => {
    document.addEventListener(evt, resetSyncTimer, { passive: true, capture: true });
});

// Globale Variablen für das Live-Tracking
let liveGpsSocket = null;
let liveGpsMarker = null;
window.liveTrackerConnected = false;
let lastAutoFollowPanAt = 0;
let lastAutoFollowPanPos = null;
let lastLivePlaneHeadingUpdateAt = 0;
let gpsWatchdog;
let gpsReconnectDelay = 2000; // Start: 2s, wächst bei wiederholtem Fehlschlag
let liveNextLegIndex = 0;
let liveNextRouteKey = '';
let liveActiveWpIndex = null; // null = automatisch (aus Leg), sonst manuell gewählter Ziel-Wegpunkt
const ROUTE_PROGRESS_TARGET_KEY = 'ga_route_progress_target';
let routeProgressTarget = localStorage.getItem(ROUTE_PROGRESS_TARGET_KEY) === 'end' ? 'end' : 'wpt';
let lastRouteProgressContext = null;
let liveCurrentNavFetchAt = 0;
let liveCurrentNavFetchKey = '';
let liveCurrentNavData = [];
let liveCurrentAirportCacheKey = '';
let liveCurrentAirportCandidates = [];
const liveFreqLookupPending = {};
const MIN_TRACKER_VERSION_CODE = 211;
const MIN_TRACKER_VERSION_LABEL = 'v211';
let trackerVersionPromptShown = false;

window.updateLivePlanePerformanceMode = function(forceState = null) {
    const on = (typeof forceState === 'boolean') ? forceState : isLowFpsModeActive();
    const el = liveGpsMarker && typeof liveGpsMarker.getElement === 'function' ? liveGpsMarker.getElement() : null;
    if (el) el.classList.toggle('low-fps-plane', !!on);
};

function _extractTrackerVersionCode(pkt) {
    if (!pkt || typeof pkt !== 'object') return null;
    const codeRaw = pkt.trackerVersionCode;
    if (Number.isFinite(codeRaw)) return Math.round(codeRaw);
    const verRaw = String(pkt.trackerVersion || '').trim().toLowerCase();
    const m = verRaw.match(/(\d{2,})/);
    if (m) {
        const parsed = parseInt(m[1], 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function _maybePromptTrackerUpdate(pkt) {
    const code = _extractTrackerVersionCode(pkt);
    const reportedLabel = String(pkt?.trackerVersion || '').trim() || (Number.isFinite(code) ? `v${code}` : 'keine Versionsnummer');
    const outdated = !Number.isFinite(code) || code < MIN_TRACKER_VERSION_CODE;
    if (!outdated || trackerVersionPromptShown) return;
    trackerVersionPromptShown = true;
    updateSyncStatus(`Tracker veraltet (${reportedLabel}) – Update auf ${MIN_TRACKER_VERSION_LABEL} empfohlen.`, true);
    alert(
        `Neue Tracker-Version verfügbar.\n\n` +
        `Erkannt: ${reportedLabel}\n` +
        `Empfohlen: mindestens ${MIN_TRACKER_VERSION_LABEL}\n\n` +
        `Bitte den Tracker aktualisieren.`
    );
}

function clampLiveLegIndex(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
    const maxLeg = routeWaypoints.length - 2;
    return Math.max(0, Math.min(Number(idx) || 0, maxLeg));
}

function clampLiveWpIndex(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 1) return 0;
    const maxWp = routeWaypoints.length - 1;
    return Math.max(0, Math.min(Number(idx) || 0, maxWp));
}

function setNextLegButtonStates(activeWp, maxWp) {
    const prevBtn = document.getElementById('nextLegPrevBtn');
    const nextBtn = document.getElementById('nextLegNextBtn');
    if (prevBtn) prevBtn.disabled = activeWp <= 0;
    if (nextBtn) nextBtn.disabled = activeWp >= maxWp;
}

window.stepLiveNextLegPreview = function(delta, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return;

    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    const currentWpIdx = (liveActiveWpIndex == null) ? autoWpIdx : liveActiveWpIndex;
    liveActiveWpIndex = clampLiveWpIndex(currentWpIdx + (delta < 0 ? -1 : 1));

    const pos = window.lastLiveGpsPos;
    if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
        const nextInfo = updateNextWpTelemetry(pos.lat, pos.lon);
        updateRouteProgressBar(pos.lat, pos.lon, pos.gs, nextInfo);
    }
};

function hideNextWpTelemetry() {
    const box = document.getElementById('liveNextWpBox');
    if (box) box.style.display = 'none';
    hideCurrentInfoTelemetry();
    setNextLegButtonStates(0, 0);
    if (liveToWpLine) {
        try { liveToWpLine.remove(); } catch (e) {}
        liveToWpLine = null;
    }
    liveActiveWpIndex = null;
    hideCompassRose();
}

function hideRouteProgressBar() {
    const bar = document.getElementById('routeProgressBar');
    if (bar) bar.style.display = 'none';
    setRouteProgressLayoutVisible(false);
}

function routeProgressTargetLabel() {
    return routeProgressTarget === 'end' ? 'END' : 'WPT';
}

function updateRouteProgressTargetLabels() {
    document.querySelectorAll('#routeProgressBar .route-progress-target').forEach(el => {
        el.textContent = routeProgressTargetLabel();
    });
}

function setRouteProgressLayoutVisible(visible) {
    const on = !!visible;
    document.body.classList.toggle('route-progress-visible', on);
    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
        requestAnimationFrame(() => {
            try { map.invalidateSize({ pan: false }); } catch (_) { map.invalidateSize(); }
        });
    }
}

function getLiveRouteTargetIndex(fallbackInfo = null) {
    if (fallbackInfo && Number.isFinite(Number(fallbackInfo.wpIdx))) {
        return clampLiveWpIndex(fallbackInfo.wpIdx);
    }
    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    return (liveActiveWpIndex == null) ? autoWpIdx : clampLiveWpIndex(liveActiveWpIndex);
}

function routeProgressLegDistanceNm(a, b) {
    const aLon = a?.lng ?? a?.lon;
    const bLon = b?.lng ?? b?.lon;
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(aLon) || !Number.isFinite(b.lat) || !Number.isFinite(bLon)) return 0;
    const nav = calcNav(a.lat, aLon, b.lat, bLon);
    return Number.isFinite(nav?.dist) ? nav.dist : 0;
}

function routeProgressShortIdent(value) {
    const ident = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z0-9]{2,4}$/.test(ident) ? ident : '';
}

function findRouteProgressPositionReference(lat, lon) {
    if (typeof calcNav !== 'function' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const candidates = [];
    const seen = new Set();
    const mapNavItems = (typeof cachedNavData !== 'undefined' && Array.isArray(cachedNavData)) ? cachedNavData : [];
    const navItems = [...mapNavItems, ...liveCurrentNavData];

    navItems.forEach(nav => {
        const parsed = parseCurrentNavLabel(nav);
        if (!parsed || (parsed.kind !== 'APT' && parsed.kind !== 'VOR')) return;
        const ident = routeProgressShortIdent(parsed.label);
        if (!ident) return;
        addCurrentNavCandidate(candidates, seen, ident, nav.lat, nav.lng ?? nav.lon, parsed.kind);
    });

    getCurrentNearbyAirportCandidates(lat, lon).forEach(apt => {
        const ident = routeProgressShortIdent(apt.label);
        if (ident) addCurrentNavCandidate(candidates, seen, ident, apt.lat, apt.lon, 'APT');
    });

    let best = null;
    for (const c of candidates) {
        const nav = calcNav(c.lat, c.lon, lat, lon);
        if (!Number.isFinite(nav?.dist)) continue;
        if (!best || nav.dist < best.dist) best = { ...c, dist: nav.dist, brngFromRef: nav.brng };
    }

    if (!navItems.length || !best || best.dist > 35) maybeRefreshCurrentNavData(lat, lon);
    return best && best.dist <= 35 ? best : null;
}

function formatRouteProgressPosition(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '--';
    const ref = findRouteProgressPositionReference(lat, lon);
    const ident = routeProgressShortIdent(ref?.label);
    if (!ref || !ident) return '--';
    const dir = currentInfoCardinalFromBearing(ref.brngFromRef);
    return `${currentInfoNm(ref.dist)} NM ${dir} ${ident}`.replace(/\s+/g, ' ').trim();
}

function formatRouteProgressFrequency(lat, lon, alt = null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '--';
    const freq = getCurrentFrequencyInfo(lat, lon, alt);
    return freq?.value ? String(freq.value).toUpperCase() : '--';
}

function getRouteProgressDistanceNm(lat, lon, wpIdx, fallbackInfo = null) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2 || typeof calcNav !== 'function') return null;
    const safeWpIdx = clampLiveWpIndex(wpIdx);
    const wp = routeWaypoints[safeWpIdx];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(wp.lat) || !Number.isFinite(wpLon)) return null;

    const directToWp = (fallbackInfo && Number(fallbackInfo.wpIdx) === safeWpIdx && Number.isFinite(Number(fallbackInfo.distToWpNm)))
        ? Number(fallbackInfo.distToWpNm)
        : calcNav(lat, lon, wp.lat, wpLon).dist;

    if (!Number.isFinite(directToWp)) return null;
    if (routeProgressTarget !== 'end') return Math.max(0, directToWp);

    let remaining = Math.max(0, directToWp);
    for (let i = safeWpIdx; i < routeWaypoints.length - 1; i++) {
        remaining += routeProgressLegDistanceNm(routeWaypoints[i], routeWaypoints[i + 1]);
    }
    return remaining;
}

function formatRouteProgressDistance(distNm) {
    const n = Number(distNm);
    if (!Number.isFinite(n)) return '--.- NM';
    if (n >= 100) return `${Math.round(n)} NM`;
    return `${n.toFixed(1)} NM`;
}

function formatRouteProgressDuration(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n)) return '--';
    const mins = Math.max(0, Math.round(n));
    if (mins < 1) return '<1 MIN';
    if (mins < 60) return `${mins} MIN`;
    const h = Math.floor(mins / 60);
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m} H`;
}

function formatRouteProgressEta(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n)) return '--:--';
    const eta = new Date(Date.now() + Math.max(0, n) * 60000);
    return `${String(eta.getHours()).padStart(2, '0')}:${String(eta.getMinutes()).padStart(2, '0')}`;
}

function getRouteProgressMinutes(distNm, gsKts) {
    const gs = Number(gsKts);
    const dist = Number(distNm);
    if (!Number.isFinite(gs) || gs < 5 || !Number.isFinite(dist)) return null;
    return (dist / gs) * 60;
}

window.toggleRouteProgressTarget = function() {
    routeProgressTarget = routeProgressTarget === 'wpt' ? 'end' : 'wpt';
    localStorage.setItem(ROUTE_PROGRESS_TARGET_KEY, routeProgressTarget);
    window.refreshRouteProgressBar();
};

window.refreshRouteProgressBar = function() {
    if (!lastRouteProgressContext) {
        const pos = window.lastLiveGpsPos;
        if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) {
            updateRouteProgressTargetLabels();
            updateRouteProgressBar(null, null, null, null);
            return;
        }
        updateRouteProgressBar(pos.lat, pos.lon, pos.gs, null);
        return;
    }
    updateRouteProgressBar(
        lastRouteProgressContext.lat,
        lastRouteProgressContext.lon,
        lastRouteProgressContext.gs,
        lastRouteProgressContext.nextInfo
    );
};

function updateRouteProgressBar(lat, lon, gsKts = null, nextInfo = null) {
    const bar = document.getElementById('routeProgressBar');
    if (!bar) return;

    updateRouteProgressTargetLabels();
    const hintOn = isMapHintOn('routeProgress', true);
    bar.classList.toggle('route-progress-hidden', !hintOn);
    setRouteProgressLayoutVisible(hintOn);
    if (!hintOn) {
        bar.style.display = 'none';
        return;
    }

    const hasPosition = Number.isFinite(lat) && Number.isFinite(lon);
    if (hasPosition) lastRouteProgressContext = { lat, lon, gs: gsKts, nextInfo };
    const posEl = document.getElementById('routeProgressPos');
    if (posEl) posEl.textContent = formatRouteProgressPosition(lat, lon);
    const freqEl = document.getElementById('routeProgressFreq');
    if (freqEl) freqEl.textContent = formatRouteProgressFrequency(lat, lon, window.lastLiveGpsPos?.alt);

    const wpIdx = getLiveRouteTargetIndex(nextInfo);
    const distNm = getRouteProgressDistanceNm(lat, lon, wpIdx, nextInfo);

    const gs = Number.isFinite(Number(gsKts)) ? Number(gsKts) : Number(window.lastLiveGpsPos?.gs ?? smoothedGS);
    const minutes = getRouteProgressMinutes(distNm, gs);
    const distEl = document.getElementById('routeProgressDst');
    const etaEl = document.getElementById('routeProgressEta');
    const durEl = document.getElementById('routeProgressDur');
    if (distEl) distEl.textContent = formatRouteProgressDistance(distNm);
    if (etaEl) etaEl.textContent = formatRouteProgressEta(minutes);
    if (durEl) durEl.textContent = formatRouteProgressDuration(minutes);
    bar.style.display = 'grid';
}

// ── Compass Rose ──────────────────────────────────────────────────────────────
let _compassRot = 0;

function buildCompassSvg() {
    const svg = document.getElementById('compassSvg');
    if (!svg || svg.childElementCount > 0) return;
    const CX = 150, CY = 150, NS = 'http://www.w3.org/2000/svg';

    function e(tag, attrs, text) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        if (text != null) el.textContent = text;
        return el;
    }

    // ── Background ───────────────────────────────────────────────────────────
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 149,
        fill: 'rgba(2,5,10,0.97)', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 1.5 }));
    // Thin inner rings (HSI reference circles)
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 108,
        fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 0.8 }));
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 62,
        fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 0.8 }));

    // ── Tick marks + labels ───────────────────────────────────────────────────
    // Label graduation: every 30° (N/E/S/W + heading÷10 without zero-pad)
    const CARDS  = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    const OR = 143; // outer ring radius

    for (let deg = 0; deg < 360; deg += 5) {
        const r = (deg - 90) * Math.PI / 180;
        const isCard = deg % 90 === 0;
        const is30   = !isCard && deg % 30 === 0;
        const is10   = !isCard && !is30 && deg % 10 === 0;

        // Tick sizes: cardinal 18 px, 30° 12 px, 10° 7 px, 5° 4 px
        const tLen    = isCard ? 18 : is30 ? 12 : is10 ? 7 : 4;
        const tStroke = isCard ? 2.2 : is30 ? 1.6 : is10 ? 1.0 : 0.7;
        const tColor  = '#ffffff';   // all ticks pure white like the reference

        svg.appendChild(e('line', {
            x1: (CX + OR * Math.cos(r)).toFixed(1),          y1: (CY + OR * Math.sin(r)).toFixed(1),
            x2: (CX + (OR - tLen) * Math.cos(r)).toFixed(1), y2: (CY + (OR - tLen) * Math.sin(r)).toFixed(1),
            stroke: tColor, 'stroke-width': tStroke,
            opacity: isCard ? 1 : is30 ? 0.9 : is10 ? 0.65 : 0.35
        }));

        // Labels only at every 30° (matches reference image graduation)
        if (deg % 30 === 0) {
            const lr = OR - tLen - (isCard ? 14 : 11);
            const lx = CX + lr * Math.cos(r), ly = CY + lr * Math.sin(r);
            // heading÷10 without leading zero for non-cardinals (3, 6, 12, 15 …)
            const label = CARDS[deg] ?? String(deg / 10);
            svg.appendChild(e('text', {
                x: lx.toFixed(1), y: ly.toFixed(1),
                'text-anchor': 'middle', 'dominant-baseline': 'middle',
                transform: `rotate(${deg},${lx.toFixed(1)},${ly.toFixed(1)})`,
                fill: deg === 0 ? '#ff4d4d' : '#ffffff',
                'font-size': isCard ? 21 : 14,
                'font-family': "'MS33558', 'Arial Narrow', Arial, sans-serif",
                'font-weight': isCard ? 'bold' : '600',
                'letter-spacing': isCard ? '0.5' : '0'
            }, label));
        }
    }

    // ── HDG bug (bearing to next WP, on outer ring at 12 o'clock before rotation) ──
    const bugG = e('g', { id: 'compassBugGroup', transform: `rotate(0,${CX},${CY})` });
    bugG.style.display = 'none';
    // Orange upward-pointing hollow triangle (apex toward disc centre)
    bugG.appendChild(e('polygon', { points: `${CX-10},30 ${CX+10},30 ${CX},8`,
        fill: 'none', stroke: '#f07800', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    svg.appendChild(bugG);

    // ── Aircraft symbol (fixed centre reference) ──────────────────────────────
    const ac = e('g', { 'pointer-events': 'none' });
    ac.appendChild(e('line',    { x1: CX, y1: CY - 18, x2: CX, y2: CY + 14, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 18, y1: CY + 2, x2: CX + 18, y2: CY + 2, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 7, y1: CY + 12, x2: CX + 7, y2: CY + 12, stroke: '#f0a800', 'stroke-width': 2 }));
    svg.appendChild(ac);

    // Centre dot
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 2.8, fill: 'rgba(180,205,230,0.55)' }));
}

// Update HDG bug + fixed CDI bar
// bearingToWp: bearing° to next WP (disc angle for bug)
// courseDeg:   planned track bearing° (unused – CDI is fixed horizontal)
// xteNm:       cross-track error in NM, positive = right of track
window.updateCompassInstruments = function(bearingToWp, courseDeg, xteNm) {
    const bugG = document.getElementById('compassBugGroup');
    if (bugG) {
        bugG.setAttribute('transform', `rotate(${bearingToWp},150,150)`);
        bugG.style.display = '';
    }

    const cdiBar = document.getElementById('compassCdiBarFixed');
    if (cdiBar) {
        const MAX_PX = 44, FULL_NM = 2.0;
        // positive xte (right of track) → CDI deflects left (negative x)
        const offset = Math.max(-MAX_PX, Math.min(MAX_PX, -(xteNm / FULL_NM) * MAX_PX));
        cdiBar.setAttribute('x1', offset.toFixed(1));
        cdiBar.setAttribute('x2', offset.toFixed(1));
        const cdiSvg = document.getElementById('compassCdiSvg');
        if (cdiSvg) cdiSvg.style.display = '';
    }
};

function buildCompassFixed() {
    const svg = document.getElementById('compassCdiSvg');
    if (!svg || svg.childElementCount > 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    function e(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        return el;
    }
    // Background pill
    svg.appendChild(e('rect', { x: -52, y: -12, width: 104, height: 24, rx: 5,
        fill: 'rgba(2,5,10,0.82)', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 }));
    // Centre track line (thin, white)
    svg.appendChild(e('line', { x1: 0, y1: -8, x2: 0, y2: 8,
        stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
    // Scale dots at ±22 and ±44 px
    for (const dx of [-44, -22, 22, 44]) {
        svg.appendChild(e('circle', { cx: dx, cy: 0, r: 2.5,
            fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.5 }));
    }
    // CDI bar (vertical, moves horizontally)
    svg.appendChild(e('line', { id: 'compassCdiBarFixed', x1: 0, y1: -10, x2: 0, y2: 10,
        stroke: '#ccd8ea', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    // Heading readout below CDI strip — DSEG7 7-segment LED font
    svg.appendChild(e('text', { id: 'compassHdgReadout', x: 0, y: 25,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#f5e97a', 'font-size': 15, 'font-family': "'DSEG7', 'Courier New', monospace",
        'font-weight': 'bold', 'letter-spacing': '2' }, '---°'));
    svg.style.display = 'none';
}

function updateCompassBottom() {
    // mapArea shrinks/grows with profile via flex — bottom:0 tracks the map edge automatically
}

window.updateCompassHeading = function(hdg) {
    if (hdg == null || isNaN(hdg)) return;
    const wrap = document.getElementById('compassRoseWrap');
    const disc = document.getElementById('compassDisc');
    if (!wrap || !disc) return;

    const target = -hdg;
    const delta = ((target - _compassRot) % 360 + 540) % 360 - 180;
    _compassRot += delta;
    disc.style.transform = `rotate(${_compassRot}deg)`;

    const hdgText = document.getElementById('compassHdgReadout');
    if (hdgText) hdgText.textContent = String(Math.round(hdg) % 360).padStart(3, '0') + '°';

    if (isMapHintOn('compass', true) && wrap.style.display !== 'block') {
        wrap.style.display = 'block';
        updateCompassBottom();
    }
};

window.hideCompassRose = function() {
    const wrap = document.getElementById('compassRoseWrap');
    if (wrap) wrap.style.display = 'none';
    const bugG = document.getElementById('compassBugGroup');
    if (bugG) bugG.style.display = 'none';
    const cdiSvg = document.getElementById('compassCdiSvg');
    if (cdiSvg) cdiSvg.style.display = 'none';
};

function routeKeyForLiveNav() {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return '';
    return routeWaypoints.map((wp, i) => `${i}:${(wp.lat || 0).toFixed(4)},${((wp.lng || wp.lon) || 0).toFixed(4)}`).join('|');
}

function legDistanceToSegmentNm(lat, lon, a, b) {
    const refLat = (a.lat + b.lat + lat) / 3;
    const cosRef = Math.cos(refLat * Math.PI / 180);

    const ax = (a.lng || a.lon) * cosRef * 60;
    const ay = a.lat * 60;
    const bx = (b.lng || b.lon) * cosRef * 60;
    const by = b.lat * 60;
    const px = lon * cosRef * 60;
    const py = lat * 60;

    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const denom = abx * abx + aby * aby;
    const t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
    const cx = ax + t * abx, cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
}

function nearestLegIndexBySegment(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const d = legDistanceToSegmentNm(lat, lon, routeWaypoints[i], routeWaypoints[i + 1]);
        if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function getWpDisplayName(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || !routeWaypoints[idx]) return `WP ${idx}`;
    const isLast = idx === routeWaypoints.length - 1;
    if (idx === 0 && typeof currentStartICAO !== 'undefined' && currentStartICAO) return currentStartICAO;
    if (isLast) {
        if (typeof currentDestICAO !== 'undefined' && currentDestICAO) return currentDestICAO;
        if (typeof currentDName !== 'undefined' && currentDName) return currentDName;
    }
    return routeWaypoints[idx].name || `WP ${idx}`;
}

function getExplicitFrequencyFromText(txt) {
    if (!txt) return '';
    const m = String(txt).match(/\((\d{3}\.\d{2,3}|\d{3}\.\d{1}|\d{3})\)/);
    return m ? m[1] : '';
}

function getPrimaryAirportFrequency(icao, typeHint = null) {
    if (!icao || typeof freqCache === 'undefined') return '';
    const cached = freqCache[icao];
    if (Array.isArray(cached) && cached.length > 0) {
        const pref = cached.find(f => /turm|tower|info|radio|ctaf|unicom/i.test(String(f.label || '')));
        const best = pref || cached[0];
        return best?.value || '';
    }

    if (typeof fetchAirportFreq === 'function' && !liveFreqLookupPending[icao]) {
        liveFreqLookupPending[icao] = true;
        Promise.resolve(fetchAirportFreq(icao, null, typeHint)).finally(() => {
            liveFreqLookupPending[icao] = false;
        });
    }
    return '';
}

function getRegionalFisFrequency(lat, lon) {
    if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces) || activeAirspaces.length === 0) return '';
    const withFreq = activeAirspaces.filter(as => as?.type === 33 && Array.isArray(as.frequencies) && as.frequencies.length > 0);
    if (withFreq.length === 0) return '';

    // 1) Erst: Punkt-in-Polygon, falls Geometrie verfügbar
    if (typeof vpPointInPoly === 'function') {
        for (const as of withFreq) {
            if (!as.geometry) continue;
            const polys = [];
            if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);
            else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
            for (const poly of polys) {
                if (vpPointInPoly({ lat, lon }, poly)) {
                    const primary = as.frequencies.find(f => f.primary) || as.frequencies[0];
                    if (primary?.value) return `${primary.value}`;
                }
            }
        }
    }

    // 2) Fallback: nächstgelegene FIS-Zone über groben Schwerpunkt
    let best = null;
    let bestNm = Infinity;
    for (const as of withFreq) {
        if (!as.geometry) continue;
        let ring = null;
        if (as.geometry.type === 'Polygon') ring = as.geometry.coordinates[0];
        else if (as.geometry.type === 'MultiPolygon' && as.geometry.coordinates[0]) ring = as.geometry.coordinates[0][0];
        if (!ring || ring.length < 3) continue;
        let sumLat = 0, sumLon = 0;
        ring.forEach(c => { sumLon += c[0]; sumLat += c[1]; });
        const cLat = sumLat / ring.length;
        const cLon = sumLon / ring.length;
        if (typeof calcNav !== 'function') continue;
        const d = calcNav(lat, lon, cLat, cLon).dist;
        if (d < bestNm) {
            bestNm = d;
            best = as;
        }
    }
    if (best) {
        const primary = best.frequencies.find(f => f.primary) || best.frequencies[0];
        if (primary?.value) return `${primary.value}`;
    }
    return '';
}

function stripNavFrequencyFromName(s) {
    return String(s || '').replace(/\s*\(\d{3}(?:[.,]\d{1,3})?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function currentInfoCardinalFromBearing(brng) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const n = Number(brng);
    if (!Number.isFinite(n)) return '';
    return dirs[Math.round((((n % 360) + 360) % 360) / 45) % dirs.length];
}

function currentInfoNm(dist) {
    const n = Number(dist);
    if (!Number.isFinite(n)) return '--';
    if (n < 1) return n.toFixed(1);
    return String(Math.round(n));
}

function addCurrentNavCandidate(list, seen, label, lat, lon, kind = 'NAV') {
    const la = Number(lat), lo = Number(lon);
    const cleanLabel = stripNavFrequencyFromName(label).replace(/^APT\s+/i, '').replace(/^RPP\s+/i, '').trim();
    if (!cleanLabel || !Number.isFinite(la) || !Number.isFinite(lo)) return;
    const key = `${kind}:${cleanLabel.toUpperCase()}:${la.toFixed(4)}:${lo.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ label: cleanLabel, lat: la, lon: lo, kind });
}

function parseCurrentNavLabel(nav) {
    const raw = String(nav?.name || '').trim();
    if (!raw) return null;
    if (/^APT\s+/i.test(raw)) {
        const label = stripNavFrequencyFromName(raw.replace(/^APT\s+/i, ''));
        return { label, kind: 'APT' };
    }
    if (/^RPP\s+/i.test(raw) || nav?.type === 'RPP') {
        const label = stripNavFrequencyFromName(raw.replace(/^RPP\s+/i, ''));
        return { label, kind: 'RPP' };
    }
    const ident = raw.match(/\[([^\]]+)\]/);
    if (ident) return { label: ident[1].trim().split(/\s+/)[0], kind: 'VOR' };
    return { label: stripNavFrequencyFromName(raw), kind: 'NAV' };
}

function currentInfoReadFreq(item) {
    if (!item) return '';
    if (item.frequency !== undefined && item.frequency !== null) {
        return (typeof item.frequency === 'object' && item.frequency.value) ? item.frequency.value : item.frequency;
    }
    if (Array.isArray(item.frequencies) && item.frequencies.length > 0) {
        return item.frequencies[0]?.value || item.frequencies[0] || '';
    }
    return '';
}

function currentInfoCoords(item) {
    const c = item?.geometry?.coordinates;
    return Array.isArray(c) && c.length >= 2 ? { lat: Number(c[1]), lng: Number(c[0]) } : null;
}

function maybeRefreshCurrentNavData(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof fetch !== 'function') return;
    const now = Date.now();
    const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
    if (key === liveCurrentNavFetchKey && now - liveCurrentNavFetchAt < 45000) return;
    liveCurrentNavFetchAt = now;
    liveCurrentNavFetchKey = key;

    const w = Math.max(-180, lon - 0.65);
    const s = Math.max(-90, lat - 0.45);
    const e = Math.min(180, lon + 0.65);
    const n = Math.min(90, lat + 0.45);
    const bbox = `${w},${s},${e},${n}`;
    const proxy = 'https://ga-proxy.einherjer.workers.dev';

    Promise.all([
        fetch(`${proxy}/api/navaids?bbox=${bbox}&limit=250&t=${Date.now()}`),
        fetch(`${proxy}/api/reporting-points?bbox=${bbox}&limit=250&t=${Date.now()}`),
        fetch(`${proxy}/api/airports?bbox=${bbox}&limit=250&t=${Date.now()}`)
    ]).then(async ([navRes, repRes, aptRes]) => {
        if (!navRes.ok || !repRes.ok || !aptRes.ok) return;
        const [navJson, repJson, aptJson] = await Promise.all([navRes.json(), repRes.json(), aptRes.json()]);
        const next = [];

        (navJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            const freqVal = currentInfoReadFreq(i);
            const freq = freqVal ? ` (${freqVal})` : '';
            const idVal = i.identifier || i.designator || '';
            const ident = idVal ? ` [${idVal}]` : '';
            next.push({ name: `${i.name || 'NAV'}${ident}${freq}`, lat: c.lat, lng: c.lng });
        });

        (repJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            next.push({
                name: `RPP ${i.name || ''}`.trim(),
                lat: c.lat,
                lng: c.lng,
                type: 'RPP',
                rppAirportIcao: (typeof extractRppAirportIcao === 'function') ? extractRppAirportIcao(i) : ''
            });
        });

        (aptJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            const freqVal = currentInfoReadFreq(i);
            const freq = freqVal ? ` (${freqVal})` : '';
            const displayName = i.icaoCode || i.name || 'APT';
            next.push({ name: `APT ${displayName}${freq}`, lat: c.lat, lng: c.lng });
        });

        liveCurrentNavData = next;
    }).catch(() => {});
}

function getCurrentNearbyAirportCandidates(lat, lon) {
    if (typeof globalAirports !== 'object' || !globalAirports) return [];
    const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
    if (key === liveCurrentAirportCacheKey) return liveCurrentAirportCandidates;

    liveCurrentAirportCacheKey = key;
    liveCurrentAirportCandidates = [];
    for (const aptKey in globalAirports) {
        const apt = globalAirports[aptKey];
        const aLat = Number(apt?.lat), aLon = Number(apt?.lon);
        if (!Number.isFinite(aLat) || !Number.isFinite(aLon)) continue;
        if (Math.abs(aLat - lat) > 0.8 || Math.abs(aLon - lon) > 1.2) continue;
        const icao = String(apt?.icao || aptKey || '').trim().toUpperCase();
        liveCurrentAirportCandidates.push({ label: icao || apt?.name || 'APT', lat: aLat, lon: aLon });
    }
    return liveCurrentAirportCandidates;
}

function findNearestCurrentReference(lat, lon) {
    if (typeof calcNav !== 'function') return null;
    const candidates = [];
    const seen = new Set();
    const mapNavItems = (typeof cachedNavData !== 'undefined' && Array.isArray(cachedNavData)) ? cachedNavData : [];
    const navItems = [...mapNavItems, ...liveCurrentNavData];

    navItems.forEach(nav => {
        const parsed = parseCurrentNavLabel(nav);
        if (!parsed) return;
        addCurrentNavCandidate(candidates, seen, parsed.label, nav.lat, nav.lng ?? nav.lon, parsed.kind);
    });

    getCurrentNearbyAirportCandidates(lat, lon).forEach(apt => {
        addCurrentNavCandidate(candidates, seen, apt.label, apt.lat, apt.lon, 'APT');
    });

    let best = null;
    for (const c of candidates) {
        const nav = calcNav(c.lat, c.lon, lat, lon);
        if (!Number.isFinite(nav?.dist)) continue;
        if (!best || nav.dist < best.dist) best = { ...c, dist: nav.dist, brngFromRef: nav.brng };
    }

    if (!navItems.length || !best || best.dist > 35) maybeRefreshCurrentNavData(lat, lon);
    return best;
}

function currentAirspacePriority(as) {
    const t = as?.type;
    if (t === 4) return 0;                 // CTR
    if (as?.icaoClass === 2 || as?.icaoClass === 3 || t === 0) return 1;
    if (t === 5 || t === 27) return 2;     // TMZ
    if (t === 6 || t === 28) return 3;     // RMZ
    if (t === 7 || t === 26) return 4;     // TMA/CTA
    return 8;
}

function compactCurrentFrequencyLabel(rawName) {
    const raw = String(rawName || '').trim();
    const up = raw.toUpperCase();
    if (/XPDR|SQK|SQUAWK|TRANSP/.test(up)) return 'SQWK';
    if (/\b(TWR|TOWER|TURM)\b/.test(up)) return 'TWR';
    if (/\b(APP|APPROACH|ANFLUG)\b/.test(up)) return 'APP';
    if (/\b(ATIS)\b/.test(up)) return 'ATIS';
    if (/\b(RADIO|CTAF|UNICOM)\b/.test(up)) return 'RADIO';
    if (/\b(FIS|INFO|INFORMATION)\b/.test(up)) return 'INFO';
    return raw || 'INFO';
}

function pickCurrentAirspaceFrequency(lat, lon, alt) {
    if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return null;
    if (typeof isPointInsideAirspace !== 'function') return null;

    const terrainFt = Number(window.lastLiveTerrainFt) || 0;
    const hasAlt = Number.isFinite(Number(alt));
    const hits = [];

    for (const as of activeAirspaces) {
        if (!as?.geometry || as.type === 33) continue;
        if (!Array.isArray(as.frequencies) || as.frequencies.length === 0) continue;
        if (!isPointInsideAirspace(as, lat, lon)) continue;

        if (hasAlt && typeof getAirspaceVerticalBandFt === 'function') {
            const band = getAirspaceVerticalBandFt(as, terrainFt);
            if (!band) continue;
            if (alt < band.lowerFt - 200 || alt > band.upperFt + 200) continue;
        }

        const primary = (typeof pickPreferredAirspaceFrequency === 'function')
            ? pickPreferredAirspaceFrequency(as.frequencies, as.type)
            : (as.frequencies.find(f => f.primary) || as.frequencies[0]);
        if (!primary?.value) continue;
        hits.push({ as, primary, priority: currentAirspacePriority(as) });
    }

    if (!hits.length) return null;
    hits.sort((a, b) => a.priority - b.priority);
    const hit = hits[0];
    const label = compactCurrentFrequencyLabel(hit.primary.name);
    const source = (typeof getAirspaceDisplayName === 'function') ? getAirspaceDisplayName(hit.as) : (hit.as.name || 'Luftraum');
    return {
        value: `${label}: ${hit.primary.value}`,
        source,
        color: (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(hit.as).color : '#9fd3ff'
    };
}

function getCurrentFrequencyInfo(lat, lon, alt) {
    const airspaceFreq = pickCurrentAirspaceFrequency(lat, lon, alt);
    if (airspaceFreq) return airspaceFreq;
    const fis = getRegionalFisFrequency(lat, lon);
    return fis ? { value: `FIS ${fis}`, source: 'Offenes Gebiet', color: '#66cccc' } : null;
}

function hideCurrentInfoTelemetry() {
    const box = document.getElementById('liveCurrentBox');
    if (box) box.style.display = 'none';
}

function updateCurrentInfoTelemetry(lat, lon, alt = null) {
    const box = document.getElementById('liveCurrentBox');
    const posEl = document.getElementById('currentPosRef');
    const freqEl = document.getElementById('currentFreqValue');
    const sourceEl = document.getElementById('currentFreqSource');
    if (!box || !posEl || !freqEl || !sourceEl) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        hideCurrentInfoTelemetry();
        return;
    }

    const shouldShow = isMapHintOn('currentInfo', true);
    box.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;

    const ref = findNearestCurrentReference(lat, lon);
    if (ref) {
        const dir = currentInfoCardinalFromBearing(ref.brngFromRef);
        posEl.textContent = `${currentInfoNm(ref.dist)} NM ${dir} ${ref.label}`.replace(/\s+/g, ' ').trim();
    } else {
        posEl.textContent = 'Position aktiv';
    }

    const freq = getCurrentFrequencyInfo(lat, lon, alt);
    if (freq) {
        freqEl.textContent = freq.value;
        freqEl.style.color = freq.color || '#9fd3ff';
        sourceEl.textContent = freq.source || '';
    } else {
        freqEl.textContent = '—';
        freqEl.style.color = '#777';
        sourceEl.textContent = '';
    }

    box.style.display = 'block';
}

function normalizeTextToken(s) {
    return String(s || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getAssociatedAirportIcaoForRpp(wp) {
    if (!wp) return '';
    const direct = String(wp.rppAirportIcao || '').trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(direct)) return direct;
    if (wp._rppAssocIcao && /^[A-Z]{4}$/.test(wp._rppAssocIcao)) return wp._rppAssocIcao;
    if (typeof globalAirports !== 'object' || !globalAirports || typeof calcNav !== 'function') return '';

    const label = String(wp.name || '').replace(/^RPP\s+/i, '');
    const normLabel = normalizeTextToken(label);
    const tokens = normLabel.split(' ').filter(t => t.length >= 4);

    let bestIcao = '';
    let bestScore = Infinity;

    for (const key in globalAirports) {
        const apt = globalAirports[key];
        const icao = String(apt?.icao || key || '').trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(icao)) continue;
        if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng || wp.lon)) continue;
        if (!Number.isFinite(apt.lat) || !Number.isFinite(apt.lon)) continue;

        const dNm = calcNav(wp.lat, wp.lng || wp.lon, apt.lat, apt.lon).dist;
        if (!Number.isFinite(dNm) || dNm > 35) continue;

        const aptText = normalizeTextToken(`${apt.name || ''} ${apt.city || ''} ${icao}`);
        const tokenHit = tokens.length > 0 && tokens.some(t => aptText.includes(t));
        if (!tokenHit && dNm > 8) continue;

        const score = dNm + (tokenHit ? 0 : 12);
        if (score < bestScore) {
            bestScore = score;
            bestIcao = icao;
        }
    }

    wp._rppAssocIcao = bestIcao || '';
    return bestIcao;
}

function getWpFrequencyText(wpIdx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || !routeWaypoints[wpIdx]) return '';
    const wp = routeWaypoints[wpIdx];
    const lastIdx = routeWaypoints.length - 1;
    const wpName = String(getWpDisplayName(wpIdx) || '');

    // Wenn im Namen bereits eine Frequenz steckt (z.B. gesnappter APT-WP), nichts doppeln.
    if (getExplicitFrequencyFromText(wpName)) return '';

    if (wpIdx === 0) {
        const icao = (typeof currentStartICAO !== 'undefined') ? currentStartICAO : '';
        const f = (typeof currentDepFreq !== 'undefined' && currentDepFreq) ? currentDepFreq : getPrimaryAirportFrequency(icao, 'dep');
        return f ? `📻 ${f}` : '';
    }
    if (wpIdx === lastIdx) {
        const icao = (typeof currentDestICAO !== 'undefined') ? currentDestICAO : '';
        const f = (typeof currentDestFreq !== 'undefined' && currentDestFreq) ? currentDestFreq : getPrimaryAirportFrequency(icao, 'dest');
        return f ? `📻 ${f}` : '';
    }

    if (/^RPP\s+/i.test(wpName)) {
        const rppIcao = getAssociatedAirportIcaoForRpp(wp);
        if (rppIcao) {
            const f = getPrimaryAirportFrequency(rppIcao, null);
            if (f) return `📻 ${rppIcao} ${f}`;
        }
    }

    const fis = getRegionalFisFrequency(wp.lat, wp.lng || wp.lon);
    return fis ? `🌐 FIS ${fis}` : '';
}

function escapeHtmlLite(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function updateLiveToActiveWpLine(lat, lon, activeWpIdx = null) {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (!isMapHintOn('magentaLine', true)) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }
    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    const wpIdx = (activeWpIdx == null) ? ((liveActiveWpIndex == null) ? autoWpIdx : clampLiveWpIndex(liveActiveWpIndex)) : clampLiveWpIndex(activeWpIdx);
    const wp = routeWaypoints[wpIdx];
    const wpLon = wp.lng || wp.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !wp || !Number.isFinite(wp.lat) || !Number.isFinite(wpLon)) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }

    const pts = [[lat, lon], [wp.lat, wpLon]];
    if (!liveToWpLine) {
        liveToWpLine = L.polyline(pts, {
            color: '#ff3fd9',
            weight: 2,
            opacity: 0.9,
            interactive: false
        }).addTo(map);
    } else {
        liveToWpLine.setLatLngs(pts);
    }
}

function updateNextWpTelemetry(lat, lon) {
    const box = document.getElementById('liveNextWpBox');
    const nameEl = document.getElementById('nextWpName');
    const courseEl = document.getElementById('nextWpCourse');
    const distEl = document.getElementById('nextWpDist');
    if (!box || !nameEl || !courseEl || !distEl) return;
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2 || typeof calcNav !== 'function') {
        box.style.display = 'none';
        if (liveToWpLine) {
            try { liveToWpLine.remove(); } catch (e) {}
            liveToWpLine = null;
        }
        return;
    }

    const key = routeKeyForLiveNav();
    if (key !== liveNextRouteKey) {
        liveNextRouteKey = key;
        liveNextLegIndex = nearestLegIndexBySegment(lat, lon);
        liveActiveWpIndex = null;
    }

    const maxLeg = routeWaypoints.length - 2;
    let legIdx = Math.max(0, Math.min(liveNextLegIndex, maxLeg));
    const maxWp = routeWaypoints.length - 1;
    let wpIdx = (liveActiveWpIndex == null) ? Math.min(legIdx + 1, maxWp) : clampLiveWpIndex(liveActiveWpIndex);

    // Auto-Advance: senkrechte Triggerlinie 0.5 NM vor Wegpunkt, 5 NM breit
    const target    = routeWaypoints[wpIdx];
    const navToTarget = calcNav(lat, lon, target.lat, target.lng || target.lon);

    // Anflugkurs vom vorherigen Wegpunkt (oder aktueller Bearing wenn erster WP)
    let inboundBrng = navToTarget.brng;
    if (wpIdx > 0) {
        const prev = routeWaypoints[wpIdx - 1];
        inboundBrng = calcNav(prev.lat, prev.lng || prev.lon, target.lat, target.lng || target.lon).brng;
    }

    // Projektion auf Anflugachse: entlang = Abstand bis WP, quer = seitliche Abweichung
    const angleDiffRad = ((navToTarget.brng - inboundBrng + 540) % 360 - 180) * Math.PI / 180;
    const alongTrack   = navToTarget.dist * Math.cos(angleDiffRad); // positiv = noch vor WP
    const crossTrack   = Math.abs(navToTarget.dist * Math.sin(angleDiffRad));

    // Linie überflogen wenn: ≤ 0.5 NM vor (oder bis 0.5 NM nach) dem WP, max. 2.5 NM seitlich
    if (alongTrack <= 0.5 && alongTrack >= -0.5 && crossTrack <= 2.5 && wpIdx < maxWp) {
        const isAutoAdvance = (liveActiveWpIndex == null);
        wpIdx += 1;
        if (liveActiveWpIndex == null) legIdx = Math.max(0, wpIdx - 1);
        else liveActiveWpIndex = wpIdx;

        // Ansage nur bei automatischem Advance, nicht bei manuellem Wegpunktwechsel
        if (isAutoAdvance && typeof window.awmAnnounceWpAdvance === 'function') {
            const nextWp    = routeWaypoints[wpIdx];
            const navToNext = calcNav(lat, lon, nextWp.lat, nextWp.lng || nextWp.lon);
            window.awmAnnounceWpAdvance(navToNext.brng, navToNext.dist);
        }
    }
    liveNextLegIndex = legIdx;

    const wp  = routeWaypoints[wpIdx];
    const wpLon = wp.lng ?? wp.lon;
    const nav = calcNav(lat, lon, wp.lat, wpLon);
    const crs = `${String(nav.brng).padStart(3, '0')}°`;
    const dist = nav.dist.toFixed(1);
    const nextInfo = { wpIdx, maxWp, distToWpNm: nav.dist, brng: nav.brng };

    const wpName = getWpDisplayName(wpIdx);
    const freqInfo = getWpFrequencyText(wpIdx);
    if (freqInfo) {
        nameEl.innerHTML = `${escapeHtmlLite(wpName)}<div style="font-size:11px; color:#9fd3ff; margin-top:1px; line-height:1.1;">${escapeHtmlLite(freqInfo)}</div>`;
    } else {
        nameEl.textContent = wpName;
    }
    courseEl.textContent = crs;
    distEl.textContent = dist;
    box.style.display = (window.simModeActive || isMapHintOn('nextLeg', true)) ? 'block' : 'none';
    setNextLegButtonStates(wpIdx, maxWp);
    updateLiveToActiveWpLine(lat, lon, wpIdx);

    // Compass HSI instruments
    if (typeof window.updateCompassInstruments === 'function') {
        let xteNm = 0;
        if (wpIdx > 0 && typeof calcNav === 'function') {
            try {
                const prevWp = routeWaypoints[wpIdx - 1];
                const fromPrev = calcNav(prevWp.lat, prevWp.lng || prevWp.lon, lat, lon);
                const R = 3440.065;
                const diffRad = (fromPrev.brng - inboundBrng) * Math.PI / 180;
                xteNm = Math.asin(Math.sin(fromPrev.dist / R) * Math.sin(diffRad)) * R;
            } catch (_) {}
        }
        window.updateCompassInstruments(nav.brng, inboundBrng, xteNm);
    }
    return nextInfo;
}

// Diese Funktion aufrufen, sobald eine Route per Sync ID geladen wurde (z.B. connectToLiveGPS("4815"))
window.connectToLiveGPS = async function(syncId) {
    if (!syncId) return;

    const wsUrl = 'wss://websocketrelais.onrender.com/';

    // Alte Verbindung schließen, falls wir die ID wechseln
    if (liveGpsSocket) liveGpsSocket.close();

    console.log(`[GPS] 📡 Verbinde mit Live-Tracking für Pilot-ID ${syncId}...`);

    // Wake-up Ping: Render.com Free Tier aus dem Schlaf holen bevor WebSocket versucht wird
    const ind0 = document.getElementById('liveGpsIndicator');
    if (ind0) { ind0.innerHTML = '🛰️ WAKE'; ind0.style.color = '#f2c12e'; ind0.style.textShadow = 'none'; }
    try {
        await fetch('https://websocketrelais.onrender.com/', { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) });
    } catch(e) { /* Server schläft evtl. noch – WebSocket versucht es trotzdem */ }

    liveGpsSocket = new WebSocket(wsUrl);

    liveGpsSocket.onopen = () => {
        console.log(`[GPS] ✅ Verbunden! Warte auf Flugzeug-Daten...`);
        gpsReconnectDelay = 2000; // Erfolg → Backoff zurücksetzen
        window.liveTrackerConnected = true;
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        // Dem Server mitteilen, in welchen Raum wir wollen (mit PIN!)
        liveGpsSocket.send(JSON.stringify({ type: 'join', syncId: syncId, pin: getSyncPin() }));

        const ind = document.getElementById('liveGpsIndicator');
        if (ind) {
            ind.innerHTML = '🛰️ WAIT';
            ind.style.color = '#f2c12e'; // Orange
            ind.style.textShadow = 'none';
        }
        if (missionRuntime.active && typeof window.missionSmokeEnsureSpawned === 'function') {
            setTimeout(() => window.missionSmokeEnsureSpawned('websocket-open'), 500);
        }
    };

    liveGpsSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
                alert(data.message);
                if (liveGpsSocket) liveGpsSocket.close();
                return;
            }
            if (data.trackerAck) {
                _handleTrackerAck(data.trackerAck);
                if (data.commandAckOnly) return;
                if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
            }
            if (data.trackerCommand || data.commandOnly) return;
            if (data.type === 'gps') {
                if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
                _maybePromptTrackerUpdate(data);
                updateLivePlanePosition(data.lat, data.lon, data.alt, data.hdg);
                if (data.flight && typeof data.flight === 'object') {
                    window.lastLiveFlightData = data.flight;
                    if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
                }

                // Traffic-Daten die im GPS-Paket eingebettet sind (Relay-kompatibler Weg)
                if (data.traffic && Array.isArray(data.traffic)) {
                    // Eigenes Flugzeug + irrelevanten Traffic herausfiltern
                    const filteredTraffic = data.traffic.filter(ac => {
                        const dLat = Math.abs((ac.lat ?? 0) - data.lat);
                        const dLon = Math.abs((ac.lon ?? 0) - data.lon);
                        if (dLat < 0.0015 && dLon < 0.0015) return false; // eigene Position ~0.1 NM
                        // Nur Flieger innerhalb ±5000 ft anzeigen – außer sie sind sehr nah (<5 NM)
                        const dAlt = Math.abs((ac.alt ?? 0) - data.alt);
                        const nearBy = dLat < 0.08 && dLon < 0.08; // ~5 NM box
                        if (!nearBy && dAlt > 5000) return false;
                        return true;
                    });
                    window.vpTrafficData = filteredTraffic;
                    if (window.vpTrafficMapVisible) {
                        updateTrafficOnMap(filteredTraffic, data.alt);
                    }
                }

                const ind = document.getElementById('liveGpsIndicator');
                if (ind) {
                    ind.innerHTML = '🛰️ LIVE'; 
                    ind.style.color = '#44ff44'; // Grün
                    ind.style.textShadow = '0 0 8px #44ff44';
                    
                    // Watchdog: Timer bei jedem neuen Paket zurücksetzen
                    clearTimeout(gpsWatchdog);
                    gpsWatchdog = setTimeout(() => {
                        // Wenn 3 Sekunden lang kein Paket mehr kam -> Zurück auf WAIT
                        if (ind.innerHTML === '🛰️ LIVE') {
                            ind.innerHTML = '🛰️ WAIT';
                            ind.style.color = '#f2c12e';
                            ind.style.textShadow = 'none';
                        }
                    }, 3000);
                }
            }
            if (data.type === 'traffic') {
                window.vpTrafficData = data.aircraft || [];
                if (window.vpTrafficMapVisible) {
                    updateTrafficOnMap(window.vpTrafficData, window.lastLiveGpsPos?.alt);
                }
            }
        } catch (e) {
            console.error('[GPS] Fehler beim Lesen der Daten:', e);
        }
    };

    liveGpsSocket.onclose = () => {
        clearTimeout(gpsWatchdog);
        window.liveTrackerConnected = false;
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        const ind = document.getElementById('liveGpsIndicator');
        if (ind) {
            ind.innerHTML = '🛰️ OFF';
            ind.style.color = '#666';
            ind.style.textShadow = 'none';
        }
        hideNextWpTelemetry();

        // Auto-HDG zurücksetzen damit es bei der nächsten Verbindung wieder greift
        window._hdgAutoActivated = false;

        // Exponentielles Backoff: 2s → 4s → 8s → max 15s (fängt Render.com Cold Starts sauber ab)
        console.warn(`[GPS] ❌ Verbindung getrennt. Reconnect in ${(gpsReconnectDelay/1000).toFixed(0)}s...`);
        setTimeout(() => connectToLiveGPS(syncId), gpsReconnectDelay);
        gpsReconnectDelay = Math.min(gpsReconnectDelay * 2, 15000);
    };

    liveGpsSocket.onerror = () => {
        clearTimeout(gpsWatchdog);
        window.liveTrackerConnected = false;
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        const ind = document.getElementById('liveGpsIndicator');
        if (ind) { 
            ind.innerHTML = '🛰️ OFF'; 
            ind.style.color = '#666'; // Grau
            ind.style.textShadow = 'none';
        }
        hideNextWpTelemetry();
    };
};

function _headingDiffDeg(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
}

function _profileSegmentCourseDeg(ed, i) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(ed.length - 1, i + 1);
    if (i0 === i1) return null;
    const a = ed[i0], b = ed[i1];
    const aLon = a.lon ?? a.lng;
    const bLon = b.lon ?? b.lng;
    if (!Number.isFinite(a?.lat) || !Number.isFinite(aLon) || !Number.isFinite(b?.lat) || !Number.isFinite(bLon)) return null;
    const refLat = ((a.lat + b.lat) * 0.5) * Math.PI / 180;
    const dLon = (bLon - aLon) * Math.cos(refLat);
    const dLat = (b.lat - a.lat);
    if (Math.abs(dLon) < 1e-9 && Math.abs(dLat) < 1e-9) return null;
    return (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
}

function _profileIdxScore(ed, i, lat, lon, hdg) {
    const p = ed[i];
    const pLon = p.lon ?? p.lng;
    const dLat = lat - p.lat;
    const dLon = lon - pLon;
    const distNm = Math.sqrt(dLat * dLat + dLon * dLon) * 59.9;
    let score = distNm;

    if (Number.isFinite(hdg)) {
        const segCourse = _profileSegmentCourseDeg(ed, i);
        if (Number.isFinite(segCourse)) {
            const diff = _headingDiffDeg(hdg, segCourse);
            if (diff > 20) {
                // Gegenkurs-Segmente in Nähe bekommen eine klare, aber nicht harte Strafe.
                score += Math.min(2.5, ((diff - 20) / 160) * 2.5);
            }
        }
    }
    return { score, distNm };
}

function updateLivePlanePosition(lat, lon, alt, hdg) {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;

    const now = Date.now();
    const simGsNow = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
    const curGs = Number.isFinite(simGsNow) ? simGsNow : smoothedGS;
    window.lastLiveGpsPos = { lat, lon, alt, hdg, t: now, gs: curGs };
    if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(false);
    if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
    window.updateCompassHeading(hdg);

    // --- FEATURE 1: SNAIL TRAIL ---
    if (!liveSnailTrail) {
        liveSnailTrail = L.polyline([], {
            color: '#1a4bb3',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10',
            interactive: false
        }).addTo(map);
    }
    
    // Nur Punkt hinzufügen, wenn > 20 Meter vom letzten Punkt entfernt
    if (!lastTrailPoint || map.distance(lastTrailPoint, [lat, lon]) > 20) {
        liveSnailTrail.addLatLng([lat, lon]);
        lastTrailPoint = [lat, lon];
    }

    // --- FEATURE 2: AUTO-FOLLOW ---
    const lowFpsMode = isLowFpsModeActive();
    if (isAutoFollow) {
        if (!lowFpsMode) {
            map.panTo([lat, lon]);
        } else {
            const movedM = lastAutoFollowPanPos ? map.distance(lastAutoFollowPanPos, [lat, lon]) : Number.POSITIVE_INFINITY;
            const canPanByTime = (now - lastAutoFollowPanAt) >= 320;
            const canPanByDist = movedM >= 45;
            if (canPanByTime && canPanByDist) {
                map.panTo([lat, lon], { animate: false });
                lastAutoFollowPanAt = now;
                lastAutoFollowPanPos = [lat, lon];
            }
        }
    }

    // --- FEATURE 3: TELEMETRY (GS & VS) ---
    if (lastGpsTickDetails) {
        const dt = (now - lastGpsTickDetails.t) / 1000; // Sekunden
        if (dt > 1.0) { // UI-Update-Schutz & Smoothing (ca. 1 Sekunde)
            const distM = map.distance([lastGpsTickDetails.lat, lastGpsTickDetails.lon], [lat, lon]);
            const calcGs = (distM / dt) * 1.94384;
            const simGs = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
            const gs = Number.isFinite(simGs) ? simGs : calcGs;
            const vs = ((alt - lastGpsTickDetails.alt) / dt) * 60;

            const box = document.getElementById('liveTelemetryBox');
            if (box) {
                box.style.display = (window.simModeActive || isMapHintOn('telemetry', true)) ? 'block' : 'none';
                const gsEl = document.getElementById('teleGS');
                const vsEl = document.getElementById('teleVS');
                if (gsEl) gsEl.textContent = gs.toFixed(1);
                if (vsEl) {
                    vsEl.textContent = Math.round(vs);
                    vsEl.style.color = vs > 100 ? 'var(--green)' : (vs < -100 ? 'var(--red)' : '#fff');
                }
                // AGL wird in updateLivePlanePosition weiter unten gesetzt (nach bestIdx-Suche)
            }
            const nextInfo = updateNextWpTelemetry(lat, lon);
            updateRouteProgressBar(lat, lon, gs, nextInfo);
            updateCurrentInfoTelemetry(lat, lon, alt);
            // Smoothed GS/VS for prediction (EMA α=0.3)
            smoothedGS = smoothedGS === 0 ? gs : smoothedGS * 0.7 + gs * 0.3;
            smoothedVS = smoothedVS === 0 ? vs : smoothedVS * 0.7 + vs * 0.3;

            // Auto-HDG: Bei erster echter GPS-Bewegung HDG-Modus aktivieren (nicht im Sim-Modus)
            if (smoothedGS > 20 && !window._hdgAutoActivated
                && !window.simModeActive
                && typeof vpMode !== 'undefined' && vpMode === 'ROUTE'
                && typeof vpToggleMode === 'function') {
                window._hdgAutoActivated = true;
                vpToggleMode();
            }

            // Update last info for speed calculation
            lastGpsTickDetails = { lat, lon, alt, t: now };
        }
    } else {
        lastGpsTickDetails = { lat, lon, alt, t: now };
        const nextInfo = updateNextWpTelemetry(lat, lon);
        updateRouteProgressBar(lat, lon, curGs, nextInfo);
        updateCurrentInfoTelemetry(lat, lon, alt);
    }

    // --- PREDICTION VECTORS ---
    // Hilfsfunktion: Luftraum-Farbe für einen Vorhersagepunkt (synchron, für Marker-Einfärbung)
    function _getAirspaceColorForPredPoint(pt) {
        if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return null;
        if (typeof getAirspaceVerticalBandFt === 'undefined' || typeof isPointInsideAirspace === 'undefined') return null;
        for (const as of activeAirspaces) {
            if (!as.geometry || !as.lowerLimit || !as.upperLimit) continue;
            if (as.type === 33) continue; // FIS überspringen
            const terrainBase = Number(pt.terrainFt ?? window.lastLiveTerrainFt) || 0;
            const band = getAirspaceVerticalBandFt(as, terrainBase);
            if (!band) continue;
            if (pt.alt < band.lowerFt - 500 || pt.alt > band.upperFt + 500) continue;
            if (isPointInsideAirspace(as, pt.lat, pt.lon))
                return typeof getAirspaceStyle === 'function' ? getAirspaceStyle(as).color : '#f2c12e';
        }
        return null;
    }
    if (smoothedGS > 30 && typeof getDestinationPoint === 'function' && now - lastPredictionUpdate > 1000) {
        lastPredictionUpdate = now;
        const horizons = [1, 2, 5, 10];
        const predPoints = horizons.map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            const predAlt = alt + (smoothedVS * min);
            return { lat: pt.lat, lon: pt.lon, min, distNMAhead: distNM, altFt: Math.max(0, predAlt), alt: Math.max(0, predAlt), threat: 'green' };
        });

        // Für Vertikalprofil-Rendering bereitstellen
        window.vpPredictionData = predPoints;

        // Erweiterte Punkte für AWM (3 und 4 min) — nur intern, nicht auf Karte
        const _awmExtra = [3, 4].map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            return { lat: pt.lat, lon: pt.lon, min, alt: Math.max(0, alt + smoothedVS * min) };
        });
        const _awmPredPoints = [...predPoints, ..._awmExtra];
        // Zusätzlicher TAWS-Feinpunkt für 15s "time-to-impact" Warnung.
        const _tawsExtra = [0.25].map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            return { lat: pt.lat, lon: pt.lon, min, alt: Math.max(0, alt + smoothedVS * min) };
        });
        const _tawsPredPoints = [..._awmPredPoints, ..._tawsExtra];

        const lineCoords = [[lat, lon], ...predPoints.map(p => [p.lat, p.lon])];

        // Linie zeichnen/updaten
        if (!predictionLine) {
            predictionLine = L.polyline(lineCoords, {
                color: '#ffffff',
                weight: 2,
                opacity: 0.7,
                dashArray: '8, 6',
                interactive: false
            }).addTo(map);
        } else {
            predictionLine.setLatLngs(lineCoords);
        }

        // Lufträume positions-basiert nachladen wenn:
        //   a) HDG-Modus — activeAirspaces muss positions-basiert sein, oder
        //   b) Keine Route gesetzt — ohne Route wird fetchRouteAirspaces nie aufgerufen
        //      → activeAirspaces bleibt sonst dauerhaft leer
        // Im ROUTE-Modus MIT Route: NICHT aufrufen, sonst überschreibt der 10-NM-Ausschnitt
        // die komplette Routen-Luftraumliste und Lufträume verschwinden aus dem Vertikalprofil.
        const _isHdgModeNow = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
        const _hasRoute = !!(window._lastVpRouteKey);
        if ((_isHdgModeNow || !_hasRoute) && typeof fetchRouteAirspaces === 'function') {
            const hdgKey = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
            if (window._lastHdgAirspaceKey !== hdgKey) {
                window._lastHdgAirspaceKey = hdgKey;
                const hdgPts = [{ lat, lng: lon }, ...predPoints.map(p => ({ lat: p.lat, lng: p.lon }))];
                fetchRouteAirspaces(hdgPts);
            }
        }

        // Hindernisse + Städte positions-basiert laden wenn kein Flugplan gesetzt oder HDG-Modus
        const _needsGpsData = _isHdgModeNow || !_hasRoute;
        if (_needsGpsData) {
            // Hindernisse: max. alle 2 Minuten UND bei Positionsänderung >~6km
            const _obsKey = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
            const _obsNow = Date.now();
            if ((window._lastGpsObsKey !== _obsKey || !window._lastGpsObsTime || (_obsNow - window._lastGpsObsTime) > 120000)
                && typeof window.fetchGpsObstacles === 'function') {
                window._lastGpsObsKey = _obsKey;
                window._lastGpsObsTime = _obsNow;
                window.fetchGpsObstacles(lat, lon);
            }
            // Städte: bei Positionsänderung >~700m (RAM-only, kein API-Limit)
            const _cityKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
            if (window._lastGpsCityKey !== _cityKey && typeof window.updateGpsCities === 'function') {
                window._lastGpsCityKey = _cityKey;
                window.updateGpsCities(lat, lon);
            }
        } else {
            // Zurücksetzen damit beim nächsten Eintritt in GPS-Modus sofort geladen wird
            window._lastGpsObsKey = null;
            window._lastGpsCityKey = null;
        }

        // TAWS-Check: Prediction-Linie einfärben wenn taws.js geladen
        if (typeof checkTerrainAlongPath === 'function') {
            checkTerrainAlongPath(_tawsPredPoints).then(results => {
                if (!results || !predictionLine) return;
                // Airspace-Warnungen mit Terrain-Info füttern (AGL-Limits korrekt auswerten).
                if (typeof checkAirspaceWarnings === 'function') {
                    const terrainFallback = Number(window.lastLiveTerrainFt) || 0;
                    const awmPts = _awmPredPoints.map((p, idx) => ({
                        ...p,
                        terrainFt: Number(results[idx]?.terrainFt ?? terrainFallback) || 0
                    }));
                    checkAirspaceWarnings(awmPts);
                }

                // Worst-case Threat bestimmt Linienfarbe
                let worst = 'green';
                for (const r of results.slice(0, predPoints.length)) {
                    if (r.threat === 'red') { worst = 'red'; break; }
                    if (r.threat === 'amber') worst = 'amber';
                }
                const color = worst === 'red' ? '#ff2222' : worst === 'amber' ? '#ffaa00' : '#ffffff';
                predictionLine.setStyle({ color });

                // Marker-Farben: Terrain hat Priorität, danach Luftraum-Farbe
                predictionMarkers.forEach((m, i) => {
                    const pt = predPoints[i];
                    const terrain = results[i];
                    let c = '#ffffff';
                    if (terrain?.threat === 'red')   c = '#ff2222';
                    else if (terrain?.threat === 'amber') c = '#ffaa00';
                    else if (pt) {
                        // Luftraum-Check für visuelle Rückmeldung
                        const asC = _getAirspaceColorForPredPoint(pt);
                        if (asC) c = asC;
                    }
                    m.setStyle({ color: c, fillColor: c });
                });

                // Threats + Airspace-Farbe ans Vertikalprofil weitergeben
                if (window.vpPredictionData) {
                    results.forEach((r, i) => {
                        if (!window.vpPredictionData[i]) return;
                        window.vpPredictionData[i].threat = r.threat;
                        // Airspace-Farbe: nur setzen wenn kein Terrain-Threat
                        if (r.threat === 'green') {
                            window.vpPredictionData[i].asColor = _getAirspaceColorForPredPoint(predPoints[i]) || null;
                        } else {
                            window.vpPredictionData[i].asColor = null;
                        }
                    });
                }
            });
        } else {
            // Fallback ohne Terrain-Resolver
            if (typeof checkAirspaceWarnings === 'function') checkAirspaceWarnings(_awmPredPoints);
        }

        // Zeitmarker zeichnen/updaten
        while (predictionMarkers.length < predPoints.length) {
            const idx = predictionMarkers.length;
            const m = L.circleMarker([0, 0], {
                radius: 4,
                color: '#ffffff',
                fillColor: '#ffffff',
                fillOpacity: 0.9,
                weight: 1.5,
                interactive: false
            }).addTo(map);
            m.bindTooltip('', { permanent: true, direction: 'top', offset: [0, -8], className: 'prediction-tooltip' });
            predictionMarkers.push(m);
        }
        predPoints.forEach((p, i) => {
            predictionMarkers[i].setLatLng([p.lat, p.lon]);
            predictionMarkers[i].setTooltipContent(`${p.min}m`);
        });
    } else if (smoothedGS <= 30) {
        // Zu langsam → Prediction ausblenden
        if (predictionLine) { predictionLine.remove(); predictionLine = null; }
        predictionMarkers.forEach(m => m.remove());
        predictionMarkers = [];
    }

    // --- ICON A: KARTE ---
    // SVG nur einmal bauen, danach nur per CSS-Transform rotieren (kein innerHTML-Rebuild pro Paket!)
    const _planeSvgTemplate = `
        <div class="live-plane-inner" style="width: var(--plane-size); height: var(--plane-size); filter: drop-shadow(0 0 5px rgba(0,0,0,0.6)); position: relative; transform: translate(-50%, -37%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 447.74 339.91" style="transform-origin: 50% 37%; width: 100%; height: 100%; will-change: transform;">
                <path fill="var(--plane-color)" stroke="#000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="M447.22,118.14a2,2,0,0,0-1.48-.65H443a61.87,61.87,0,0,0-6.2-19.62,8.66,8.66,0,0,0-7.67-4.6H290.3a13.4,13.4,0,0,1-4.61-.81L259.8,83a10.84,10.84,0,0,1-7.09-8.94c-1.44-12.06-4.15-34.18-6.06-46.78a16.45,16.45,0,0,0-10.94-13.17c-.9-.31-1.81-.59-2.69-.82a1.94,1.94,0,0,1-1.4-1.37,29.46,29.46,0,0,0-5.37-10.72,3.45,3.45,0,0,0-5.28,0A29.37,29.37,0,0,0,215.6,12a2,2,0,0,1-1.4,1.37c-.88.23-1.79.51-2.69.82a16.46,16.46,0,0,0-10.95,13.17C198.67,39.84,196,62,194.51,74.09A10.84,10.84,0,0,1,187.42,83l-25.89,9.43a13.4,13.4,0,0,1-4.61.81H18a8.66,8.66,0,0,0-7.66,4.6,61.62,61.62,0,0,0-6.2,19.62H2a2,2,0,0,0-2,2.19l.63,6.83a2,2,0,0,0,2,1.82h.72v.33A71.32,71.32,0,0,0,6.5,150a49.32,49.32,0,0,0,8.4,16.31,5.49,5.49,0,0,0,4.28,2H196.94c.84,5.65,13.56,91.52,17.94,122h-50.2a11.94,11.94,0,0,0-11.92,11.92v13.57a11.94,11.94,0,0,0,11.92,11.92H224.5v11.4c0,.37.64.71,1,.71s1.1-.34,1.1-.71V327.8h59.82a11.94,11.94,0,0,0,11.92-11.92V302.31a11.94,11.94,0,0,0-11.92-11.92H232.34c4.38-30.49,17.1-116.36,17.93-122H428a5.53,5.53,0,0,0,4.29-2,49.32,49.32,0,0,0,8.4-16.31,71.64,71.64,0,0,0,3.14-21.38v-.33h1.24a2,2,0,0,0,2-1.82l.63-6.83A2,2,0,0,0,447.22,118.14Zm-4.62,1c0,.27.07.54.1.81l.09.87C442.74,120.3,442.67,119.74,442.6,119.19ZM443,123c0,.14,0,.29,0,.44s0,.58.05.86h0C443,123.9,443,123.46,443,123Zm.09,1.32v.06c0,.12,0,.24,0,.37C443.08,124.63,443.08,124.49,443.07,124.35Z"/>
            </svg>
            <div style="position:absolute; left:50%; top:37%; width:4px; height:4px; background:#000; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none;"></div>
        </div>
    `;

    if (!liveGpsMarker) {
        const planeIcon = L.divIcon({
            html: _planeSvgTemplate,
            className: 'live-plane-marker',
            iconSize: [0, 0],
            iconAnchor: [0, 0]     // Geo-Koordinate = top-left des Divs; inner div verschiebt sich per translate(-50%,-37%)
        });
        liveGpsMarker = L.marker([lat, lon], {
            icon: planeIcon,
            zIndexOffset: 9999,
            interactive: false
        }).addTo(map);
        // Initiale Rotation setzen
        const svgEl = liveGpsMarker.getElement()?.querySelector('svg');
        if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
        if (typeof window.updateLivePlanePerformanceMode === 'function') window.updateLivePlanePerformanceMode(lowFpsMode);
        const planeEl = liveGpsMarker.getElement();
        if (planeEl) planeEl.style.pointerEvents = 'none';

        map.on('dragstart', () => { if (isAutoFollow) toggleAutoFollow(); });
    } else {
        liveGpsMarker.setLatLng([lat, lon]);
        // Im Low-FPS-Mode die Heading-Rotation leicht drosseln, um Repaint-Spitzen zu vermeiden.
        if (!lowFpsMode || (now - lastLivePlaneHeadingUpdateAt) >= 120) {
            const svgEl = liveGpsMarker.getElement()?.querySelector('svg');
            if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
            lastLivePlaneHeadingUpdateAt = now;
        }
        if (typeof window.updateLivePlanePerformanceMode === 'function') window.updateLivePlanePerformanceMode(lowFpsMode);
        const planeEl = liveGpsMarker.getElement();
        if (planeEl) planeEl.style.pointerEvents = 'none';
    }

    // --- ICON B: HÖHENPROFIL ---
    // Richtungssensitives Lock-on: verhindert Sprünge zwischen nahen Hin-/Rück-Segmenten.
    if (typeof vpElevationData !== 'undefined' && vpElevationData && vpElevationData.length > 2) {
        const ed = vpElevationData;
        const totalDist = ed[ed.length - 1].distNM;
        const routeSig = `${ed.length}:${Math.round(totalDist * 10)}`;
        if (routeSig !== vpProfileLockSig) {
            vpProfileLockSig = routeSig;
            vpProfileLockIdx = -1;
        }

        const coarseStep = Math.max(1, Math.floor(ed.length / 8));
        let coarseIdx = 0, coarseBest = Infinity;
        for (let i = 0; i < ed.length; i += coarseStep) {
            const p = ed[i];
            const pLon = p.lon ?? p.lng;
            const dLat = lat - p.lat;
            const dLon = lon - pLon;
            const d2 = dLat * dLat + dLon * dLon;
            if (d2 < coarseBest) { coarseBest = d2; coarseIdx = i; }
        }

        const localWindow = Math.max(40, coarseStep * 4);
        const hasLock = Number.isFinite(vpProfileLockIdx) && vpProfileLockIdx >= 0 && vpProfileLockIdx < ed.length;
        let searchLo = Math.max(0, coarseIdx - coarseStep);
        let searchHi = Math.min(ed.length - 1, coarseIdx + coarseStep);
        if (hasLock) {
            searchLo = Math.max(0, vpProfileLockIdx - localWindow);
            searchHi = Math.min(ed.length - 1, vpProfileLockIdx + localWindow);
        }

        let bestIdx = searchLo;
        let bestScore = Infinity;
        let bestDistNm = Infinity;
        for (let i = searchLo; i <= searchHi; i++) {
            const s = _profileIdxScore(ed, i, lat, lon, hdg);
            if (s.score < bestScore) {
                bestScore = s.score;
                bestDistNm = s.distNm;
                bestIdx = i;
            }
        }

        // Wenn Lock-Fenster zu weit weg liegt, einmal global neu einloggen.
        if (hasLock && bestDistNm > 2.2) {
            let globalBestIdx = 0;
            let globalBestScore = Infinity;
            let globalBestDistNm = Infinity;
            for (let i = 0; i < ed.length; i += 1) {
                const s = _profileIdxScore(ed, i, lat, lon, hdg);
                if (s.score < globalBestScore) {
                    globalBestScore = s.score;
                    globalBestDistNm = s.distNm;
                    globalBestIdx = i;
                }
            }
            bestIdx = globalBestIdx;
            bestDistNm = globalBestDistNm;
        }
        vpProfileLockIdx = bestIdx;
        window.vpLiveRouteDistNM = bestDistNm;

        // Terrain-Höhe weiterhin intern vorhalten (z.B. für Warnlogik),
        // Telemetrie zeigt aber MSL-Höhe.
        const terrainFt = bestDistNm < 10 ? (ed[bestIdx].elevFt ?? 0) : 0;
        window.lastLiveTerrainFt = terrainFt;
        const mslFt = Math.max(0, Math.round(alt));
        const aglEl = document.getElementById('teleAGL');
        if (aglEl) {
            aglEl.textContent = mslFt;
            aglEl.style.color = mslFt < 1500 ? '#ff4444' : (mslFt < 3000 ? '#ffcc44' : '#8ec5ff');
        }

        if (bestDistNm < 10) { // ~10 NM Schwelle für Icon-Anzeige
            if (typeof vpUpdateLiveAircraft === 'function') {
                vpUpdateLiveAircraft(ed[bestIdx].distNM / totalDist, alt, hdg);
            }
        } else {
            window.vpLiveRouteDistNM = 999;
            if (typeof vpUpdateLiveAircraft === 'function') {
                vpUpdateLiveAircraft(-1, alt, hdg);  // -1 = ausblenden
            }
        }
    }

    updateFlightRecorder(lat, lon, alt);
    if (missionRuntime.active && typeof window.missionSmokeEnsureSpawned === 'function') {
        window.missionSmokeEnsureSpawned('gps-tick');
    }
    if (typeof window.checkPaxPoiProximity === 'function') {
        const _paxAlt = Math.max(0, Math.round(alt));
        const _aglFromTracker = Number(window.lastLiveFlightData?.aglFt);
        const _paxFd  = Object.assign({}, window.lastLiveFlightData || {}, {
            mslFt: _paxAlt,
            aglFt: Number.isFinite(_aglFromTracker) ? Math.max(0, Math.round(_aglFromTracker)) : _paxAlt
        });
        window.checkPaxPoiProximity(lat, lon, _paxFd);
    }
}

function resetFlightRecorder() {
    flightRecorder = {
        active: false,
        armed: false,
        startCandidateSince: 0,
        lastUpdateTs: 0,
        pauseActive: false,
        airborneEvidenceSec: 0,
        hadAirbornePhase: false,
        startTs: 0,
        endTs: 0,
        lowSpeedSince: 0,
        wasOnGround: false,
        farewellTriggered: false,
        touchdownVsFpm: null,
        maxGs: 0,
        maxAltFt: 0,
        sumGs: 0,
        gsSamples: 0,
        distNm: 0,
        track: [],
        lastSample: null,
        maxBankDeg: 0,
        maxGForce: 1.0,
        sumGForce: 0,
        gForceSamples: 0,
        maxAglFt: 0,
        maxClimbFpm: 0,
        maxDescentFpm: 0
    };
}

function addFlightTrackPoint(lat, lon, alt, now, force = false) {
    const r = flightRecorder;
    const prev = r.track.length ? r.track[r.track.length - 1] : null;
    if (!force && prev) {
        const prevLatLng = [prev[0], prev[1]];
        const dM = map && typeof map.distance === 'function' ? map.distance(prevLatLng, [lat, lon]) : 0;
        const dtMs = now - ((prev[3] || 0) + r.startTs);
        if (dtMs < 1000) return; // max 1 Punkt/s
        if (dM < 180 && dtMs < 15000) return;
    }
    const relSec = Math.max(0, Math.round((now - r.startTs) / 1000));
    r.track.push([
        Number(lat.toFixed(5)),
        Number(lon.toFixed(5)),
        Math.round(alt),
        relSec
    ]);
    if (r.track.length > 1200) {
        // Sanftes Decimation wenn sehr lang: jeden zweiten Punkt verwerfen
        const compact = [];
        for (let i = 0; i < r.track.length; i += 2) compact.push(r.track[i]);
        r.track = compact;
    }
}

function compactFlightTrackForStorage(track, maxPoints = 220) {
    const src = Array.isArray(track) ? track : [];
    if (src.length < 2) return src.slice();
    // 1s-Bucket: nur erster Punkt je Sekunde behalten.
    const bySec = [];
    let lastSec = null;
    for (const p of src) {
        if (!Array.isArray(p) || p.length < 4) continue;
        const sec = Number.isFinite(p[3]) ? Math.round(p[3]) : null;
        if (sec == null) continue;
        if (sec === lastSec) continue;
        lastSec = sec;
        bySec.push([
            Number(Number(p[0]).toFixed(4)),
            Number(Number(p[1]).toFixed(4)),
            Math.round(Number(p[2]) / 10) * 10,
            sec
        ]);
    }
    if (bySec.length <= maxPoints) return bySec;
    const step = Math.ceil(bySec.length / maxPoints);
    const out = [];
    for (let i = 0; i < bySec.length; i += step) out.push(bySec[i]);
    const last = bySec[bySec.length - 1];
    if (out.length && out[out.length - 1][3] !== last[3]) out.push(last);
    return out;
}

function nearestAirportLabel(lat, lon) {
    if (typeof globalAirports === 'undefined' || !globalAirports) {
        return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    }
    let bestIcao = null;
    let bestNm = Infinity;
    for (const [icao, a] of Object.entries(globalAirports)) {
        if (!a || !Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        const dLat = a.lat - lat;
        const dLon = a.lon - lon;
        const nm = Math.hypot(dLat, dLon) * 59.9;
        if (nm < bestNm) { bestNm = nm; bestIcao = icao; }
    }
    if (bestIcao && bestNm <= 35) return bestIcao;
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function _buildFlightRecordSnapshot(now) {
    const r = flightRecorder;
    const endTs = Number.isFinite(now) ? now : Date.now();
    const durationSec = Math.max(1, Math.round((endTs - r.startTs) / 1000));
    const avgGs = r.gsSamples > 0 ? (r.sumGs / r.gsSamples) : 0;
    if (r.distNm < 2 || durationSec < 120 || r.track.length < 2) {
        return null;
    }

    const track = compactFlightTrackForStorage(r.track, 220);

    const dep = track[0];
    const arr = track[track.length - 1];
    const depLabel = (typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : nearestAirportLabel(dep[0], dep[1]);
    const arrLabel = (typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI')
        ? currentDestICAO
        : nearestAirportLabel(arr[0], arr[1]);

    return {
        id: Date.now(),
        createdAt: Date.now(),
        dateLabel: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        depLabel,
        arrLabel,
        durationSec,
        distanceNm: Number(r.distNm.toFixed(1)),
        avgGs: Number(avgGs.toFixed(1)),
        maxGs: Number(r.maxGs.toFixed(1)),
        maxAltFt: Math.round(r.maxAltFt),
        touchdownVsFpm: Number.isFinite(r.touchdownVsFpm) ? Math.round(r.touchdownVsFpm) : null,
        track,
        maxBankDeg: Number((r.maxBankDeg || 0).toFixed(1)),
        maxGForce: Number((r.maxGForce || 1.0).toFixed(2)),
        avgGForce: r.gForceSamples > 0 ? Number((r.sumGForce / r.gForceSamples).toFixed(2)) : 1.0,
        maxClimbFpm: Number.isFinite(r.maxClimbFpm) ? Math.round(r.maxClimbFpm) : 0,
        maxDescentFpm: Number.isFinite(r.maxDescentFpm) ? Math.round(r.maxDescentFpm) : 0
    };
}

function finalizeFlightRecorder(now, endLat = null, endLon = null) {
    const r = flightRecorder;
    try {
        r.endTs = now;

        // Nur echte Fluege finalisieren, nicht reine Repositions-/Bodenartefakte.
        if (!r.hadAirbornePhase) return;

        const record = _buildFlightRecordSnapshot(now);
        if (!record) return;

        const hist = JSON.parse(localStorage.getItem('ga_flight_history') || '[]');
        hist.unshift(record);
        localStorage.setItem('ga_flight_history', JSON.stringify(hist.slice(0, 80)));

        if (typeof window.pinCompletedFlightRecord === 'function') {
            window.pinCompletedFlightRecord(record);
            console.log(`[FlightRec] 🧾 Flug ausgewertet & an Pinwand gehängt: ${record.depLabel} ➔ ${record.arrLabel} (${record.distanceNm} NM, ${Math.round(record.durationSec / 60)} min)`);
        } else {
            console.warn('[FlightRec] pinCompletedFlightRecord() nicht verfügbar.');
        }
        triggerCloudSave();
        // Farewell nur am korrekten Zielplatz triggern.
        const atTargetForFarewell = _isAtMissionTarget(Number(endLat), Number(endLon), 1.2);
        if (!r.farewellTriggered && atTargetForFarewell && typeof window.triggerPaxFarewell === 'function') {
            window.triggerPaxFarewell(record);
        }
    } finally {
        resetFlightRecorder();
    }
}

function updateFlightRecorder(lat, lon, alt) {
    if (window.simModeActive) return; // Sim-Flüge laufen über sim-route Debrief/Prompt

    const now = Date.now();
    const autoMissionStartEnabled = isMissionAutoStartEnabled();
    const _lfd = window.lastLiveFlightData;
    const gs = Number.isFinite(_lfd?.gsKts) ? Number(_lfd.gsKts) : (Number(smoothedGS) || 0);
    const agl = Number.isFinite(_lfd?.aglFt)
        ? Math.max(0, Number(_lfd.aglFt))
        : Math.max(0, (Number(alt) || 0) - (Number(window.lastLiveTerrainFt) || 0));
    const hasOnGroundFlag = typeof _lfd?.onGround === 'boolean';
    const onGroundNow = hasOnGroundFlag ? !!_lfd.onGround : false;
    const simPaused = !!_lfd?.simPaused || (Number(_lfd?.pauseFlags || 0) > 0);
    const inMenuOrMap = !!_lfd?.inMenuOrMap || (Number(_lfd?.simRunning) === 0) || (Number(_lfd?.dialogMode) === 1);
    const r = flightRecorder;
    const dtSec = r.lastUpdateTs ? Math.max(0, (now - r.lastUpdateTs) / 1000) : 0;
    r.lastUpdateTs = now;

    // Pause im Sim: Recorder einfrieren und keine Trigger auslösen.
    if (simPaused || inMenuOrMap) {
        r.pauseActive = true;
        r.wasOnGround = onGroundNow;
        r.lowSpeedSince = 0;
        return;
    }

    // Nach Pause unterscheiden: echter Neustart vs. normale Fortsetzung.
    if (r.pauseActive) {
        r.pauseActive = false;
        const restartPattern = onGroundNow && gs <= 2.5 && agl <= 120;
        if (restartPattern) {
            console.log('[FlightRec] Pause-Ende mit Neustart-Muster erkannt -> Mission reset bereit');
            resetFlightRecorder();
            if (typeof window.paxVoiceResetMission === 'function') window.paxVoiceResetMission();
            _resetMissionRuntime();
            return;
        }
        r.lastUpdateTs = now; // dt-Sprung nach Pause vermeiden
    }

    // Mission wird erst "scharf", wenn stabile Bodenlage erkannt wurde:
    // stillstandnah, very low AGL, on ground.
    if (!autoMissionStartEnabled && !missionRuntime.active) {
        if (missionRuntime.armed || missionRuntime.readySince) {
            missionRuntime.armed = false;
            missionRuntime.readySince = 0;
            _updateMissionRuntimeUi();
        }
    } else if (!missionRuntime.active) {
        const readyNow = onGroundNow && gs <= 2.0 && agl <= 10;
        if (readyNow) {
            if (!missionRuntime.readySince) missionRuntime.readySince = now;
            if (!missionRuntime.armed && (now - missionRuntime.readySince) >= 2500) {
                missionRuntime.armed = true;
                missionRuntime.manual = false;
                _updateMissionRuntimeUi();
            }
        } else {
            missionRuntime.readySince = 0;
        }
    }

    // Erstes echtes Rollen/Bewegen startet die Mission (Begrüßung ab 10 kn).
    if (autoMissionStartEnabled && !missionRuntime.active && missionRuntime.armed && !simPaused && !inMenuOrMap && gs >= 10) {
        missionRuntime.active = true;
        missionRuntime.manual = false;
        missionRuntime.pendingEndAt = 0;
        missionRuntime.lastOffDestAt = 0;
        resetFlightRecorder();
        if (typeof window.triggerPaxGreeting === 'function') {
            setTimeout(() => window.triggerPaxGreeting(lat, lon), 300);
        }
        if (typeof window.missionSmokeEnsureSpawned === 'function') window.missionSmokeEnsureSpawned('auto-mission-start');
        _updateMissionRuntimeUi();
    }

    // Ohne aktive Mission keine Recorder-/Landungs-/Debrief-Logik.
    if (!missionRuntime.active) return;

    // Aktivierung: erst nach stabilem Startkandidaten (kein GPS-Spike/Spawn)
    if (!r.active) {
        const taxiStartCandidate = hasOnGroundFlag && onGroundNow && gs > 6;
        const airborneStartCandidate = hasOnGroundFlag
            ? (!onGroundNow && (gs > 20 || agl > 120))
            : (gs > 28 || agl > 220);
        const startCandidate = taxiStartCandidate || airborneStartCandidate;
        if (startCandidate) {
            if (!r.startCandidateSince) r.startCandidateSince = now;
        } else {
            r.startCandidateSince = 0;
        }

        const stableMs = taxiStartCandidate ? 1800 : 3000;
        if (r.startCandidateSince && (now - r.startCandidateSince) >= stableMs) {
            r.active = true;
            r.armed = false;
            r.startCandidateSince = 0;
            r.startTs = now;
            r.maxGs = gs;
            r.maxAltFt = alt;
            r.maxAglFt = agl;
            r.sumGs = gs;
            r.gsSamples = 1;
            r.track = [];
            r.lastSample = [lat, lon];
            r.wasOnGround = onGroundNow;
            addFlightTrackPoint(lat, lon, alt, now, true);
        }
        return;
    }

    // Reposition/Teleport erkannt (typisch nach falschem Start + neu laden): Recorder sauber verwerfen.
    if (r.lastSample && map && typeof map.distance === 'function') {
        const dM = map.distance(r.lastSample, [lat, lon]);
        const dNm = dM / 1852;
        if (dNm > 5 && gs < 40 && (hasOnGroundFlag ? onGroundNow : agl < 200)) {
            console.warn(`[FlightRec] Reposition erkannt (${dNm.toFixed(1)} NM Sprung) -> Recorder reset`);
            resetFlightRecorder();
            return;
        }
        if (Number.isFinite(dM) && dM > 0) r.distNm += (dM / 1852);
    }
    r.lastSample = [lat, lon];

    r.maxGs = Math.max(r.maxGs, gs);
    r.maxAltFt = Math.max(r.maxAltFt, Number(alt) || 0);
    r.maxAglFt = Math.max(r.maxAglFt || 0, agl);
    r.sumGs += gs;
    r.gsSamples += 1;
    const airborneNow = hasOnGroundFlag ? !onGroundNow : (agl > 180 || gs > 35);
    if (airborneNow && dtSec > 0) r.airborneEvidenceSec += dtSec;
    if (!airborneNow && r.airborneEvidenceSec > 0) r.airborneEvidenceSec = Math.max(0, r.airborneEvidenceSec - dtSec * 0.5);
    if (!r.hadAirbornePhase && (r.airborneEvidenceSec >= 8 || r.maxAglFt >= 500)) r.hadAirbornePhase = true;
    r.armed = r.hadAirbornePhase;

    if (_lfd) {
        if (Number.isFinite(_lfd.bankDeg)) r.maxBankDeg = Math.max(r.maxBankDeg, Math.abs(_lfd.bankDeg));
        if (Number.isFinite(_lfd.gForce) && _lfd.gForce > 0.1) {
            r.maxGForce = Math.max(r.maxGForce, _lfd.gForce);
            r.sumGForce += _lfd.gForce;
            r.gForceSamples += 1;
        }
    }
    if (Number.isFinite(smoothedVS)) {
        if (smoothedVS > 0) r.maxClimbFpm = Math.max(r.maxClimbFpm, smoothedVS);
        if (smoothedVS < 0) r.maxDescentFpm = Math.min(r.maxDescentFpm, smoothedVS);
    }

    addFlightTrackPoint(lat, lon, alt, now, false);

    // Touchdown-Trigger (Live-Tracker): Farewell sofort beim ersten Bodenkontakt.
    if (r.armed && r.hadAirbornePhase && onGroundNow && !r.wasOnGround) {
        if (Number.isFinite(_lfd?.touchdownFpm)) r.touchdownVsFpm = _lfd.touchdownFpm;
        else if (Number.isFinite(smoothedVS)) r.touchdownVsFpm = smoothedVS;
        const atTargetForFarewell = _isAtMissionTarget(lat, lon, 1.2);
        if (!r.farewellTriggered && atTargetForFarewell && typeof window.triggerPaxFarewell === 'function') {
            const earlyRecord = _buildFlightRecordSnapshot(now);
            if (earlyRecord) {
                r.farewellTriggered = true;
                window.triggerPaxFarewell(earlyRecord);
            }
        }
    }
    r.wasOnGround = onGroundNow;

    // Missionsende / Bodenfall:
    // - am Ziel + stillstand -> mission schließen (nach kurzer Verabschiedungslatenz)
    // - woanders + stillstand -> humorvoller Hinweis, mission bleibt offen
    const groundStill = onGroundNow && gs <= 2.0;
    if (autoMissionStartEnabled && groundStill) {
        const dTargetNm = _distanceToMissionTargetNm(lat, lon);
        const atTarget = Number.isFinite(dTargetNm) ? dTargetNm <= 1.2 : false;
        if (atTarget) {
            if (!missionRuntime.pendingEndAt) missionRuntime.pendingEndAt = now + 5000;
            if (now >= missionRuntime.pendingEndAt) {
                if (typeof window.missionSmokeClear === 'function') window.missionSmokeClear('auto-mission-end');
                missionRuntime.active = false;
                missionRuntime.armed = false;
                missionRuntime.manual = false;
                missionRuntime.readySince = 0;
                missionRuntime.pendingEndAt = 0;
                _updateMissionRuntimeUi();
            }
        } else {
            missionRuntime.pendingEndAt = 0;
            if (r.hadAirbornePhase && (now - missionRuntime.lastOffDestAt) > 90000) {
                missionRuntime.lastOffDestAt = now;
                if (typeof window.triggerPaxOffDestinationLanding === 'function') {
                    window.triggerPaxOffDestinationLanding(dTargetNm);
                }
            }
        }
    } else if (autoMissionStartEnabled) {
        missionRuntime.pendingEndAt = 0;
    }

    // Landing-Detection: erst wenn der Flug wirklich "airborne" war
    if (!r.armed || !r.hadAirbornePhase) return;
    if (!autoMissionStartEnabled) return;

    const landingCandidate = gs < 18 && agl < 140;
    if (landingCandidate) {
        if (!r.lowSpeedSince) {
            r.lowSpeedSince = now;
            if (Number.isFinite(smoothedVS)) r.touchdownVsFpm = smoothedVS;
            // Fallback-AtTarget nur in Zielnähe zulassen, damit ein Absturz/Touchdown
            // fern vom Ziel keine "4-NM-vor-Landung"-Meldung auslöst.
            const dTargetNm = _distanceToMissionTargetNm(lat, lon);
            const nearTargetForAtTarget = Number.isFinite(dTargetNm) ? dTargetNm <= 4.5 : false;
            if (nearTargetForAtTarget && typeof window.triggerPaxAtTarget === 'function') {
                window.triggerPaxAtTarget(window.lastLiveFlightData || {});
            }
        }
        if ((now - r.lowSpeedSince) >= 5000) {
            addFlightTrackPoint(lat, lon, alt, now, true);
            finalizeFlightRecorder(now, lat, lon);
        }
    } else {
        r.lowSpeedSince = 0;
    }
}

// ─── TRAFFIC AUF KARTE ────────────────────────────────────────────────────────
// Proximity-Matching: statt exaktem Key-Lookup wird der nächstgelegene
// bestehende Marker gefunden und geupdated. Damit funktioniert es auch bei
// wechselnden SimConnect-IDs (MSFS Online-Traffic) und Formationsflug.
const TRAFFIC_MATCH_DEG = 0.025; // ~2 km Matching-Schwelle

function _trafficIconHtml(hdg, relAltStr, relAltColor, callsign) {
    return `<div style="position:relative; transform:translate(-10px,-13px); pointer-events:none; text-align:center;">
        <svg class="trf-svg" viewBox="-8 -12 16 24" width="20" height="26"
             style="transform:rotate(${hdg}deg); display:block; margin:0 auto;
                    filter:drop-shadow(0 0 2px rgba(0,0,0,0.9));">
            <ellipse cx="0" cy="0"  rx="1.8" ry="10" fill="#00ccff" opacity="0.95"/>
            <ellipse cx="0" cy="-1" rx="8"   ry="1.8" fill="#00ccff" opacity="0.95"/>
            <ellipse cx="0" cy="8"  rx="4"   ry="1.2" fill="#00ccff" opacity="0.85"/>
        </svg>
        <div class="trf-alt" style="font-size:8px;font-weight:bold;color:${relAltColor};
             text-shadow:1px 1px 2px #000;line-height:1.1;white-space:nowrap;">${relAltStr}</div>
        <div style="font-size:7px;color:#aaddff;text-shadow:1px 1px 2px #000;
             line-height:1;white-space:nowrap;">${callsign}</div>
    </div>`;
}

function updateTrafficOnMap(aircraft, ownAlt) {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (!isMapHintOn('traffic', true) || !window.vpTrafficMapVisible) {
        Object.values(liveTrafficMarkers).forEach(t => t.marker.remove());
        liveTrafficMarkers = {};
        return;
    }

    const claimedKeys = new Set(); // Marker die in diesem Update bereits belegt wurden

    for (const ac of aircraft) {
        const relAlt = ownAlt != null ? ac.alt - ownAlt : null;
        const relAltStr = relAlt != null
            ? (relAlt >= 0 ? '+' : '') + Math.round(relAlt / 100) * 100 : '';
        const relAltColor = relAlt == null ? '#aaa'
            : Math.abs(relAlt) < 300 ? '#ff8800'
            : relAlt > 0 ? '#44ff44' : '#aaaaaa';
        const hdg = ac.hdg ?? 0;
        const callsign = ac.callsign ?? ('AI-' + String(ac.id ?? (ac.lat + ',' + ac.lon)));

        // Nächstgelegenen unbelegten Marker suchen
        let bestKey = null, bestDist = TRAFFIC_MATCH_DEG;
        for (const [key, t] of Object.entries(liveTrafficMarkers)) {
            if (claimedKeys.has(key)) continue;
            const d = Math.hypot(t.lat - ac.lat, t.lon - ac.lon);
            if (d < bestDist) { bestDist = d; bestKey = key; }
        }

        if (bestKey) {
            // Bestehenden Marker in-place aktualisieren
            claimedKeys.add(bestKey);
            liveTrafficMarkers[bestKey].lat = ac.lat;
            liveTrafficMarkers[bestKey].lon = ac.lon;
            liveTrafficMarkers[bestKey].marker.setLatLng([ac.lat, ac.lon]);
            const el = liveTrafficMarkers[bestKey].marker.getElement();
            if (el) {
                const svgEl = el.querySelector('.trf-svg');
                if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
                const altEl = el.querySelector('.trf-alt');
                if (altEl) { altEl.textContent = relAltStr; altEl.style.color = relAltColor; }
            }
        } else {
            // Neuen Marker erstellen
            const newKey = String(ac.id ?? (Date.now() + Math.random()));
            claimedKeys.add(newKey);
            const icon = L.divIcon({
                html: _trafficIconHtml(hdg, relAltStr, relAltColor, callsign),
                className: 'traffic-marker',
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });
            const marker = L.marker([ac.lat, ac.lon], {
                icon, interactive: false, zIndexOffset: 5000
            }).addTo(map);
            liveTrafficMarkers[newKey] = { marker, lat: ac.lat, lon: ac.lon };
        }
    }

    // Nicht beanspruchte Marker entfernen (Flieger aus der Range verschwunden)
    for (const key of Object.keys(liveTrafficMarkers)) {
        if (!claimedKeys.has(key)) {
            liveTrafficMarkers[key].marker.remove();
            delete liveTrafficMarkers[key];
        }
    }
}

window.applyTrafficVisibility = function() {
    if (!isMapHintOn('traffic', true) || !window.vpTrafficMapVisible) {
        Object.values(liveTrafficMarkers).forEach(t => t.marker.remove());
        liveTrafficMarkers = {};
        return;
    }
    if (window.vpTrafficData?.length) updateTrafficOnMap(window.vpTrafficData, window.lastLiveGpsPos?.alt);
};

window.toggleTrafficMap = function(forceState = null) {
    window.vpTrafficMapVisible = (typeof forceState === 'boolean') ? forceState : !window.vpTrafficMapVisible;
    if (window.mapHints && typeof window.mapHints === 'object') {
        window.mapHints.traffic = window.vpTrafficMapVisible;
        localStorage.setItem('ga_map_hint_traffic', String(window.vpTrafficMapVisible));
        if (typeof refreshMapHintMenuUi === 'function') refreshMapHintMenuUi();
    }
    const btn = document.getElementById('btnToggleTrafficMap');
    if (btn) btn.classList.toggle('active', window.vpTrafficMapVisible);
    window.applyTrafficVisibility();
};

// Sim-Modus: Flugzeug-Icon, Trail und Profil zurücksetzen
window.hideLivePlane = function () {
    if (liveGpsMarker) { liveGpsMarker.remove(); liveGpsMarker = null; }
    lastAutoFollowPanAt = 0;
    lastAutoFollowPanPos = null;
    lastLivePlaneHeadingUpdateAt = 0;
    if (liveSnailTrail) { liveSnailTrail.setLatLngs([]); }
    if (liveToWpLine) { liveToWpLine.remove(); liveToWpLine = null; }
    // Prediction-Vektoren entfernen
    if (predictionLine) { predictionLine.setLatLngs([]); }
    predictionMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
    predictionMarkers = [];
    // Profil zurücksetzen
    if (typeof vpUpdateLiveAircraft === 'function') vpUpdateLiveAircraft(-1, 0, 0);
    window.lastLiveGpsPos = null;
    window.lastLiveFlightData = null;
    vpProfileLockIdx = -1;
    vpProfileLockSig = '';
    lastGpsTickDetails = null;
    lastTrailPoint = null;
    resetFlightRecorder();
    _resetMissionRuntime();
    hideNextWpTelemetry();
};

// Auto-Start & Login on app load
document.addEventListener('DOMContentLoaded', () => {
    _updateMissionRuntimeUi();
    initPlaneIconSettingsUi();
    // Felder aus dem bestätigten Speicher vorbefüllen
    const savedId = localStorage.getItem('ga_saved_id') || localStorage.getItem('ga_sync_id');
    const savedPin = localStorage.getItem('ga_saved_pin') || localStorage.getItem('ga_sync_pin');
    
    if (savedId) {
        const idInp = document.getElementById('syncIdInput');
        if (idInp) idInp.value = savedId;
    }
    if (savedPin) {
        const pinInp = document.getElementById('syncPinInput');
        if (pinInp) pinInp.value = savedPin;
    }

    // Falls Daten vorhanden -> Auto-Login Versuch im Hintergrund
    if (savedId && savedPin) {
        setTimeout(() => {
            console.log("[Sync] Starte Auto-Login...");
            triggerLoginFlow(true); 
        }, 800);
    }

    const currentBox = document.getElementById('liveCurrentBox');
    const nextBox = document.getElementById('liveNextWpBox');
    [currentBox, nextBox].filter(Boolean).forEach(navBox => {
        ['pointerdown', 'click', 'touchstart', 'mousedown'].forEach(evt => {
            navBox.addEventListener(evt, e => {
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
            }, { passive: false });
        });
    });

    initTelemetryBoxDrag(document.getElementById('liveTelemetryBox'), 'ga_tele_pos');
    initTelemetryBoxDrag(document.getElementById('liveCurrentBox'), 'ga_current_pos');
    initTelemetryBoxDrag(document.getElementById('liveNextWpBox'), 'ga_nextwp_pos');

    buildCompassSvg();
    buildCompassFixed();
    updateCompassBottom();

    const compassWrap = document.getElementById('compassRoseWrap');
    if (compassWrap) {
        compassWrap.addEventListener('click', () => {
            compassWrap.classList.toggle('compass-minimized');
        });
    }

    // Profil-Toggle: Kompass-Position neu berechnen
    const _origToggleProfile = window.toggleMapProfile;
    if (typeof _origToggleProfile === 'function') {
        window.toggleMapProfile = function() {
            _origToggleProfile.apply(this, arguments);
            setTimeout(updateCompassBottom, 150);
        };
    }
});

function initTelemetryBoxDrag(el, storageKey) {
    if (!el) return;

    const DEFAULT_STYLES = {
        liveTelemetryBox: { top: '10px', left: '50%', transform: 'translateX(-50%)', right: 'auto' },
        liveCurrentBox:   { top: '10px', left: 'calc(50% - 230px)', transform: 'none', right: 'auto' },
        liveNextWpBox:    { top: '10px', left: 'calc(50% + 128px)', transform: 'none', right: 'auto' }
    };

    function applyPosition(top, left) {
        el.style.top = top;
        el.style.left = left;
        el.style.transform = 'none';
        el.style.right = 'auto';
    }

    function savePosition() {
        localStorage.setItem(storageKey, JSON.stringify({ top: el.style.top, left: el.style.left }));
    }

    function restorePosition() {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return;
        try {
            const { top, left } = JSON.parse(saved);
            applyPosition(top, left);
            el.classList.add('tele-dragged');
        } catch(e) {}
    }

    function resetPosition() {
        localStorage.removeItem(storageKey);
        el.classList.remove('tele-dragged');
        const def = DEFAULT_STYLES[el.id];
        if (def) {
            el.style.top = def.top;
            el.style.left = def.left;
            el.style.transform = def.transform;
            el.style.right = def.right;
        }
    }

    restorePosition();

    let dragging = false, startX, startY, startTop, startLeft;

    el.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        dragging = true;
        el.classList.add('tele-dragging');
        startX = e.clientX;
        startY = e.clientY;
        startTop = el.offsetTop;
        startLeft = el.offsetLeft;
    });

    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        e.stopPropagation();
        const parent = el.parentElement;
        const maxLeft = parent.offsetWidth - el.offsetWidth - 5;
        const maxTop = parent.offsetHeight - el.offsetHeight - 5;
        const newLeft = Math.max(5, Math.min(maxLeft, startLeft + (e.clientX - startX)));
        const newTop  = Math.max(5, Math.min(maxTop,  startTop  + (e.clientY - startY)));
        applyPosition(newTop + 'px', newLeft + 'px');
        el.classList.add('tele-dragged');
    });

    el.addEventListener('pointerup', e => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('tele-dragging');
        el.releasePointerCapture(e.pointerId);
        savePosition();
    });

    el.addEventListener('dblclick', e => {
        if (e.target.closest('button')) return;
        resetPosition();
    });
}
