// Mission Cargo Core
// Extrahierte Cargo-/Manifest-/Payload-/Outcome-Logik aus sync.js.
// Ziel: Strukturgewinn ohne Verhaltensaenderung.

let missionCargoComplianceDebugManifest = null;
let missionCargoGroundInventoryManifest = null;

function _missionCargoMissionKey() {
    if (missionCargoComplianceDebugManifest?.key) {
        return String(missionCargoComplianceDebugManifest.key);
    }
    if (missionCargoGroundInventoryManifest?.key && !_missionCargoHasActiveMission()) {
        return String(missionCargoGroundInventoryManifest.key);
    }
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const stableKey = String(
        md?.cargoManifest?.key
        || md?.missionContract?.cargoManifest?.key
        || window.activeMissionContract?.cargoManifest?.key
        || md?.missionKey
        || md?.missionContract?.missionKey
        || window.activeMissionContract?.missionKey
        || ''
    ).trim();
    if (stableKey) return stableKey;
    try {
        if (typeof _missionStartUiKey === 'function') return _missionStartUiKey() || '';
    } catch (_) {}
    return [md?.start, md?.dest, md?.poiName || md?.targetName, md?.mission].filter(Boolean).join('|');
}

function _missionCargoAudioCueId(scope = 'cargo', event = 'event', fallbackCueId = 'none') {
    if (typeof window.paxResolveMissionAudioCue === 'function') {
        try { return window.paxResolveMissionAudioCue(scope, event, fallbackCueId) || 'none'; } catch (_) {}
    }
    return String(fallbackCueId || 'none');
}

const _MISSION_CARGO_AUDIO_QUEUE = {
    active: false,
    pending: []
};
const MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY = 'ga_aircraft_onboard_equipment_v1';
const MISSION_CARGO_EQUIPMENT_VALIDITY_MIN_DAYS = 21;
const MISSION_CARGO_EQUIPMENT_VALIDITY_MAX_DAYS = 42;
const MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS = 5;
const MISSION_CARGO_PERSISTENT_EQUIPMENT_IDS = Object.freeze([
    'bordbuch',
    'first-aid',
    'fire-extinguisher',
    'chocks'
]);
let missionCargoManualPaxRollbackTimer = null;
let missionCargoOnboardEquipmentCloudTimer = null;
const MISSION_CARGO_PAYLOAD_SYNC_DEBOUNCE_MS = 500;
const MISSION_CARGO_PAYLOAD_SYNC_MAX_WAIT_MS = 2000;
const MISSION_CARGO_PA24_VERIFY_DELAYS_MS = Object.freeze([350, 650]);
const MISSION_CARGO_PA24_SEAT_REASSERT_DELAY_MS = 220;
const MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS = 180;
const _MISSION_CARGO_PAYLOAD_SYNC_QUEUE = {
    timer: null,
    burstStartedAt: 0,
    lastRequestedAt: 0,
    pendingReason: '',
    revision: 0,
    settledRevision: 0,
    forceImmediate: false,
    waiters: [],
    lastResult: { status: 'idle' }
};
const _MISSION_CARGO_OBJECT_ACTION_QUEUE = new Map();
let missionCargoObjectActionRevision = 0;
let missionCargoBoardBookBannerTimer = null;

function _missionCargoAircraftSlot(value = window.selectedAC || window.activeAircraftPresetSettingsSlot || 'PA-24') {
    return String(value || 'PA-24')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'PA-24';
}

function _missionCargoCalendarDayNumber(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function _missionCargoRandomIntInclusive(min, max, seed = '') {
    const low = Math.ceil(Number(min));
    const high = Math.floor(Number(max));
    if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) return low || 0;
    const span = high - low + 1;
    if (seed) {
        let hash = 2166136261;
        for (const char of String(seed)) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return low + ((hash >>> 0) % span);
    }
    try {
        if (window.crypto?.getRandomValues) {
            const value = new Uint32Array(1);
            window.crypto.getRandomValues(value);
            return low + (value[0] % span);
        }
    } catch (_) {}
    return low + Math.floor(Math.random() * span);
}

function _missionCargoNewExpiryDate(seed = '', issuedAt = Date.now()) {
    const days = _missionCargoRandomIntInclusive(
        MISSION_CARGO_EQUIPMENT_VALIDITY_MIN_DAYS,
        MISSION_CARGO_EQUIPMENT_VALIDITY_MAX_DAYS,
        seed
    );
    const date = new Date(Number(issuedAt) || Date.now());
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function _missionCargoNewEquipmentSerial(itemId = '', issuedAt = Date.now()) {
    const randomPart = _missionCargoRandomIntInclusive(1000, 9999);
    return `${String(itemId || 'equipment').replace(/[^a-z0-9]+/gi, '-').toUpperCase()}-${Math.round(Number(issuedAt) || Date.now()).toString(36).toUpperCase()}-${randomPart}`;
}

function _missionCargoExpiryDaysRemaining(expiresAt, now = Date.now()) {
    const expiryDay = _missionCargoCalendarDayNumber(expiresAt);
    const date = new Date(Number(now) || Date.now());
    const todayDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return Number.isFinite(expiryDay) ? expiryDay - todayDay : null;
}

function _missionCargoFormatExpiryDate(expiresAt = '') {
    const match = String(expiresAt || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]} ${match[2]} ${match[1]}` : '-- -- ----';
}

function _missionCargoNullableNumber(value) {
    if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function _missionCargoNormalizeOnboardEquipmentState(raw = null) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const sourceVersion = Number(source.version || 0);
    const aircraftSource = source.aircraft && typeof source.aircraft === 'object' ? source.aircraft : {};
    const aircraft = {};
    Object.entries(aircraftSource).slice(0, 12).forEach(([rawSlot, rawEntry]) => {
        const slot = _missionCargoAircraftSlot(rawSlot);
        const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
        const itemSource = entry.items && typeof entry.items === 'object' ? entry.items : {};
        const items = {};
        MISSION_CARGO_PERSISTENT_EQUIPMENT_IDS.forEach((id) => {
            const rawItem = itemSource[id];
            if (!rawItem || typeof rawItem !== 'object') return;
            const loadedAt = Number(rawItem.loadedAt);
            const updatedAt = Number(rawItem.updatedAt);
            const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(String(rawItem.expiresAt || ''))
                ? String(rawItem.expiresAt)
                : '';
            const issuedAt = Number(rawItem.issuedAt);
            const effectiveIssuedAt = Number.isFinite(issuedAt) && issuedAt > 0
                ? Math.round(issuedAt)
                : (Number.isFinite(updatedAt) && updatedAt > 0 ? Math.round(updatedAt) : Date.now());
            const isExpiryItem = id === 'first-aid' || id === 'fire-extinguisher';
            const migratedExpiry = isExpiryItem && sourceVersion < 2
                ? _missionCargoNewExpiryDate(`${slot}|${id}|migration|${effectiveIssuedAt}`, effectiveIssuedAt)
                : expiresAt;
            const onboard = rawItem.onboard === true;
            const storedStatus = onboard
                ? 'onboard'
                : (String(rawItem.status || '').toLowerCase() === 'lost' ? 'lost' : 'offboard');
            let unloadLat = _missionCargoNullableNumber(rawItem.unloadLat);
            let unloadLon = _missionCargoNullableNumber(rawItem.unloadLon);
            const unloadAltFt = _missionCargoNullableNumber(rawItem.unloadAltFt);
            if (unloadLat === 0 && unloadLon === 0) {
                unloadLat = null;
                unloadLon = null;
            }
            const lostAt = Number(rawItem.lostAt);
            items[id] = {
                onboard,
                status: storedStatus,
                loadedAt: Number.isFinite(loadedAt) && loadedAt > 0 ? Math.round(loadedAt) : 0,
                expiresAt: migratedExpiry,
                issuedAt: isExpiryItem ? effectiveIssuedAt : 0,
                serialId: isExpiryItem
                    ? (String(rawItem.serialId || '').trim() || _missionCargoNewEquipmentSerial(id, effectiveIssuedAt))
                    : '',
                unloadLat,
                unloadLon,
                unloadAltFt,
                lostAt: Number.isFinite(lostAt) && lostAt > 0 ? Math.round(lostAt) : 0,
                updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.round(updatedAt) : 0
            };
        });
        const entryUpdatedAt = Number(entry.updatedAt);
        aircraft[slot] = {
            updatedAt: Number.isFinite(entryUpdatedAt) && entryUpdatedAt > 0 ? Math.round(entryUpdatedAt) : 0,
            items
        };
    });
    const updatedAt = Number(source.updatedAt);
    return {
        version: 3,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.round(updatedAt) : 0,
        aircraft
    };
}

function _missionCargoReadOnboardEquipmentState() {
    try {
        return _missionCargoNormalizeOnboardEquipmentState(
            JSON.parse(localStorage.getItem(MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY) || '{}')
        );
    } catch (_) {
        return _missionCargoNormalizeOnboardEquipmentState(null);
    }
}

function _missionCargoScheduleOnboardEquipmentCloudSync() {
    const toggle = document.getElementById('syncToggle');
    if (toggle && !toggle.checked) return;
    if (missionCargoOnboardEquipmentCloudTimer) clearTimeout(missionCargoOnboardEquipmentCloudTimer);
    missionCargoOnboardEquipmentCloudTimer = setTimeout(() => {
        missionCargoOnboardEquipmentCloudTimer = null;
        try {
            if (typeof triggerCloudSave === 'function') triggerCloudSave(true);
        } catch (_) {}
    }, 1200);
}

function _missionCargoWriteOnboardEquipmentState(raw = null, options = {}) {
    const normalized = _missionCargoNormalizeOnboardEquipmentState(raw);
    const next = JSON.stringify(normalized);
    let previous = '';
    try { previous = localStorage.getItem(MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY) || ''; } catch (_) {}
    if (previous === next) return false;
    try {
        localStorage.setItem(MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY, next);
    } catch (_) {
        return false;
    }
    if (options.scheduleCloud === true) _missionCargoScheduleOnboardEquipmentCloudSync();
    return true;
}

function _missionCargoStoredEquipmentItems(aircraftSlot = '') {
    const slot = _missionCargoAircraftSlot(aircraftSlot);
    return _missionCargoReadOnboardEquipmentState().aircraft?.[slot]?.items || {};
}

function _missionCargoApplyStoredOnboardEquipment(items = [], aircraftSlot = '') {
    const storedItems = _missionCargoStoredEquipmentItems(aircraftSlot);
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (item?.persistentEquipment !== true) return;
        const stored = storedItems[item.id];
        if (!stored) return;
        if (stored.expiresAt) item.expiresAt = stored.expiresAt;
        if (stored.issuedAt) item.issuedAt = stored.issuedAt;
        if (stored.serialId) item.serialId = stored.serialId;
        if (stored.onboard === true) {
            item.status = 'loaded';
            item.loadedAt = Number(stored.loadedAt || 0) || Date.now();
            item.persistentEquipmentInherited = true;
        } else if (stored.status === 'lost') {
            item.status = 'lost';
            item.loadedAt = 0;
            item.unloadedAt = 0;
            item.unloadLat = null;
            item.unloadLon = null;
            item.unloadAltFt = null;
            item.lostAt = Number(stored.lostAt || 0) || Number(stored.updatedAt || 0) || Date.now();
            item.persistentEquipmentInherited = false;
        } else {
            item.status = 'unloaded';
            item.loadedAt = 0;
            item.unloadedAt = Number(stored.updatedAt || 0) || Date.now();
            item.unloadLat = _missionCargoNullableNumber(stored.unloadLat);
            item.unloadLon = _missionCargoNullableNumber(stored.unloadLon);
            item.unloadAltFt = _missionCargoNullableNumber(stored.unloadAltFt);
            item.lostAt = 0;
            item.persistentEquipmentInherited = false;
        }
    });
    return items;
}

function _missionCargoPersistOnboardEquipment(manifest = null) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    const slot = _missionCargoAircraftSlot(manifest.aircraftSlot);
    const state = _missionCargoReadOnboardEquipmentState();
    const previousEntry = state.aircraft[slot] || { updatedAt: 0, items: {} };
    const nextItems = { ...previousEntry.items };
    const now = Date.now();
    let changed = false;
    MISSION_CARGO_PERSISTENT_EQUIPMENT_IDS.forEach((id) => {
        const item = manifest.items.find(entry => entry?.id === id && entry.persistentEquipment === true);
        if (!item) return;
        const previous = previousEntry.items?.[id] || {};
        const onboard = item.status === 'loaded';
        const equipmentStatus = onboard ? 'onboard' : (item.status === 'lost' ? 'lost' : 'offboard');
        const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(String(item.expiresAt || '')) ? String(item.expiresAt) : '';
        const issuedAt = Number(item.issuedAt || previous.issuedAt || 0);
        const serialId = String(item.serialId || previous.serialId || '');
        const loadedAt = onboard
            ? (Number(item.loadedAt || previous.loadedAt || 0) || now)
            : 0;
        const unloadLat = equipmentStatus === 'offboard' ? _missionCargoNullableNumber(item.unloadLat) : null;
        const unloadLon = equipmentStatus === 'offboard' ? _missionCargoNullableNumber(item.unloadLon) : null;
        const unloadAltFt = equipmentStatus === 'offboard' ? _missionCargoNullableNumber(item.unloadAltFt) : null;
        const lostAt = equipmentStatus === 'lost'
            ? (Number(item.lostAt || previous.lostAt || 0) || now)
            : 0;
        const itemChanged = previous.onboard !== onboard
            || String(previous.status || (previous.onboard ? 'onboard' : 'offboard')) !== equipmentStatus
            || Number(previous.loadedAt || 0) !== loadedAt
            || String(previous.expiresAt || '') !== expiresAt
            || Number(previous.issuedAt || 0) !== issuedAt
            || String(previous.serialId || '') !== serialId
            || String(previous.unloadLat ?? '') !== String(unloadLat ?? '')
            || String(previous.unloadLon ?? '') !== String(unloadLon ?? '')
            || String(previous.unloadAltFt ?? '') !== String(unloadAltFt ?? '')
            || Number(previous.lostAt || 0) !== lostAt;
        nextItems[id] = {
            onboard,
            status: equipmentStatus,
            loadedAt,
            expiresAt,
            issuedAt,
            serialId,
            unloadLat,
            unloadLon,
            unloadAltFt,
            lostAt,
            updatedAt: itemChanged ? now : Number(previous.updatedAt || 0)
        };
        changed = itemChanged || changed;
    });
    if (!changed) return false;
    state.aircraft[slot] = { updatedAt: now, items: nextItems };
    state.updatedAt = now;
    return _missionCargoWriteOnboardEquipmentState(state, { scheduleCloud: true });
}

window.missionCargoGetOnboardEquipmentForSync = function() {
    return _missionCargoReadOnboardEquipmentState();
};

window.missionCargoApplyOnboardEquipmentFromSync = function(raw = null) {
    if (!raw || typeof raw !== 'object') return false;
    return _missionCargoWriteOnboardEquipmentState(raw, { scheduleCloud: false });
};

function _missionCargoPlayAudioCueNow(fallbackCueId = 'none', item = null, event = 'event', options = {}) {
    const cueId = _missionCargoAudioCueId('cargo', event, fallbackCueId);
    if (!cueId || cueId === 'none' || typeof window.paxPlayAudioCue !== 'function') return Promise.resolve(false);
    const seed = [
        _missionCargoMissionKey(),
        event,
        item?.id || item?.label || '',
        item?.pickupLocation || '',
        item?.itemType || ''
    ].join('|');
    try {
        const result = window.paxPlayAudioCue(cueId, {
            seed,
            minCount: 1,
            maxCount: 1,
            firstDelayMs: 0,
            minDelayMs: 0,
            maxDelayMs: 0,
            variantScope: options.variantScope || 'event',
            gain: Number.isFinite(Number(options.gain)) ? Number(options.gain) : undefined
        });
        if (result && typeof result.then === 'function') return result.catch(() => false);
        return Promise.resolve(!!result);
    } catch (_) {
        return Promise.resolve(false);
    }
}

function _missionCargoBundleAudioCue(batch = []) {
    const first = batch[0] || {};
    const itemSeed = batch
        .map(entry => entry?.item?.id || entry?.item?.label || entry?.event || '')
        .filter(Boolean)
        .join('-');
    return {
        fallbackCueId: 'boarding_cargo',
        item: null,
        event: `${first.event || 'cargo'}_batch_${batch.length}_${itemSeed || 'items'}`,
        options: { gain: 0.46, variantScope: 'event' }
    };
}

function _missionCargoFlushAudioCueQueue() {
    const batch = _MISSION_CARGO_AUDIO_QUEUE.pending.splice(0);
    if (!batch.length) {
        _MISSION_CARGO_AUDIO_QUEUE.active = false;
        return;
    }
    const next = batch.length === 1 ? batch[0] : _missionCargoBundleAudioCue(batch);
    _missionCargoPlayAudioCueNow(next.fallbackCueId, next.item, next.event, next.options || {})
        .then(() => _missionCargoFlushAudioCueQueue())
        .catch(() => _missionCargoFlushAudioCueQueue());
}

function _missionCargoPlayAudioCue(fallbackCueId = 'none', item = null, event = 'event', options = {}) {
    const entry = { fallbackCueId, item, event, options };
    if (options.queue !== true) {
        _missionCargoPlayAudioCueNow(fallbackCueId, item, event, options).catch(() => {});
        return true;
    }
    if (_MISSION_CARGO_AUDIO_QUEUE.active) {
        _MISSION_CARGO_AUDIO_QUEUE.pending.push(entry);
        return true;
    }
    _MISSION_CARGO_AUDIO_QUEUE.active = true;
    _missionCargoPlayAudioCueNow(fallbackCueId, item, event, options)
        .then(() => _missionCargoFlushAudioCueQueue())
        .catch(() => _missionCargoFlushAudioCueQueue());
    return true;
}

function _missionCargoTrackManualPassengerCommand(commandId, item = null, previousItem = null, action = 'load') {
    if (!commandId || !item || !previousItem) return false;
    if (missionCargoManualPaxRollbackTimer) clearTimeout(missionCargoManualPaxRollbackTimer);
    window.missionCargoStatus.manualPaxPending = {
        commandId: String(commandId),
        manifestKey: _missionCargoMissionKey(),
        itemId: String(item.id || ''),
        action: String(action || 'load'),
        previousItem: JSON.parse(JSON.stringify(previousItem))
    };
    missionCargoManualPaxRollbackTimer = setTimeout(() => {
        missionCargoManualPaxRollbackTimer = null;
        window.missionCargoResolveManualPassengerAck?.({
            type: 'mission_scene_manual_pax_ack',
            commandId,
            action,
            status: 'timeout',
            error: 'manual_pax_timeout'
        });
    }, 70000);
    return true;
}

window.missionCargoResolveManualPassengerAck = function(ack = {}) {
    const pending = window.missionCargoStatus?.manualPaxPending;
    if (!pending || String(pending.commandId || '') !== String(ack.commandId || '')) return false;
    if (missionCargoManualPaxRollbackTimer) clearTimeout(missionCargoManualPaxRollbackTimer);
    missionCargoManualPaxRollbackTimer = null;
    window.missionCargoStatus.manualPaxPending = null;
    const success = ack.status === 'ok' || ack.status === 'noop';
    const sameManifest = !pending.manifestKey || pending.manifestKey === _missionCargoMissionKey();
    if (!success && sameManifest) {
        const manifest = _missionCargoEnsureManifest();
        const itemIndex = (manifest.items || []).findIndex(item => String(item.id || '') === String(pending.itemId || ''));
        if (itemIndex >= 0) {
            manifest.items[itemIndex] = JSON.parse(JSON.stringify(pending.previousItem));
            _missionCargoPersistManifest(manifest);
        }
        if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
            window.missionSceneStatus.personBoarded = pending.previousItem?.status === 'loaded';
        }
        window.missionCargoStatus.error = ack.error || ack.status || 'manual_pax_failed';
        _missionCargoSyncPayloadToSim('manual-passenger-rollback').catch(() => {});
    }
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.manualPaxRequested = false;
        window.missionSceneStatus.manualPaxActive = false;
        window.missionSceneStatus.manualPaxError = success ? null : (ack.error || ack.status || 'manual_pax_failed');
        if (success && sameManifest) window.missionSceneStatus.personBoarded = String(ack.action || pending.action || '').toLowerCase() === 'load';
    }
    const overlayOpen = document.getElementById('missionCargoOverlay')?.style.display === 'flex';
    if (overlayOpen) _missionCargoRenderDialog(window.missionCargoStatus?.lastMode || 'load', { skipPayloadRefresh: true });
    _updateMissionRuntimeUi();
    return true;
};

function _missionCargoHasActiveMission() {
    if (missionCargoComplianceDebugManifest) return true;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (typeof window.missionIsFreeflightOnly === 'function' && window.missionIsFreeflightOnly(md)) return false;
    return !!(md || window.activeMissionContract);
}

function _missionCargoIsPoiMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return !!(md?.poiName || md?.poiSource || md?.isPOI || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI'));
}

function _missionCargoCleanLabel(text = '') {
    return String(text || '')
        .replace(/\([^)]*\b(?:lb|lbs|pound|pfund)\b[^)]*\)/ig, '')
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pfund)\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function _missionCargoPrimaryText() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const values = [
        md?.cargoText,
        md?.cargo,
        md?.missionContract?.cargoText,
        window.activeMissionContract?.cargoText,
        document.getElementById('mWeight')?.innerText
    ];
    return String(values.find(value => String(value || '').trim()) || '').trim();
}

function _missionCargoExtractWeight(text = '', fallback = 5) {
    const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pfund)/i);
    if (!match) return fallback;
    const n = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(n) ? Math.max(1, Math.round(n)) : fallback;
}

function _missionCargoSmallTitle(label = '') {
    if (/unterlagen|papier|mappe|bordbuch|akte|karten|tablet|speicher|akku|protokoll/i.test(label)) return 'Cardboard';
    if (/spanngurt|net|netz|gurt/i.test(label)) return 'Pallet01_03';
    return 'Cardboard';
}

function _missionCargoPushItem(items, item) {
    const id = String(item.id || item.label || `item-${items.length + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${items.length + 1}`;
    if (items.some(existing => existing.id === id)) return;
    const sceneKind = item.sceneKind || (items.length === 0 ? 'cargo' : `cargo_extra_${items.length}`);
    const title = item.objectTitle || _missionCargoSmallTitle(item.label || item.storyName || '');
    const itemType = String(item.itemType || 'cargo').trim().toLowerCase() === 'passenger' ? 'passenger' : 'cargo';
    const rawTitleCandidates = _sceneAssetCandidates(title, item.titleCandidates || MISSION_SCENE_ASSET_POOLS.smallCargo || MISSION_SCENE_ASSET_POOLS.cargo);
    const titleCandidates = itemType === 'cargo' && typeof _missionSceneBoardingCargoCandidates === 'function'
        ? _missionSceneBoardingCargoCandidates(title, rawTitleCandidates)
        : (itemType === 'cargo' && typeof _missionSceneSafeBoardingCargoCandidates === 'function'
            ? _missionSceneSafeBoardingCargoCandidates(rawTitleCandidates.concat(MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard']))
            : rawTitleCandidates);
    items.push({
        id,
        itemType,
        sceneKind,
        label: String(item.label || item.storyName || id).trim(),
        storyName: String(item.storyName || item.label || id).trim(),
        weightLbs: Math.max(1, Math.round(Number(item.weightLbs) || 1)),
        passengerCount: itemType === 'passenger' ? Math.max(1, Math.min(6, Math.round(Number(item.passengerCount) || 1))) : 0,
        required: item.required === true,
        deliverAtDestination: item.deliverAtDestination !== false,
        status: item.status || 'pending',
        healthPct: Number.isFinite(Number(item.healthPct)) ? Math.max(0, Math.min(100, Math.round(Number(item.healthPct)))) : 100,
        equipmentType: item.equipmentType || '',
        expiresAt: item.expiresAt || '',
        issuedAt: Number.isFinite(Number(item.issuedAt)) ? Number(item.issuedAt) : 0,
        serialId: String(item.serialId || ''),
        log: item.log && typeof item.log === 'object' ? item.log : {},
        objectTitle: title,
        titleCandidates,
        forwardOffsetM: Number.isFinite(Number(item.forwardOffsetM)) ? Number(item.forwardOffsetM) : (items.length * 0.45),
        rightOffsetM: Number.isFinite(Number(item.rightOffsetM)) ? Number(item.rightOffsetM) : (items.length % 2 ? -0.8 : 0),
        pickupLocation: item.pickupLocation === 'target' ? 'target' : '',
        deliverAtHome: item.deliverAtHome === true,
        persistentEquipment: item.persistentEquipment === true,
        persistentEquipmentInherited: item.persistentEquipmentInherited === true,
        passengerOwned: item.passengerOwned === true,
        handoffWithPassenger: item.handoffWithPassenger === true || item.passengerOwned === true,
        handoffComplete: item.handoffComplete === true,
        handedOffAt: Number.isFinite(Number(item.handedOffAt)) ? Math.max(0, Number(item.handedOffAt)) : 0
    });
}

function _missionCargoBushPickupCompanionItem(bush = null) {
    const spec = bush && typeof bush === 'object' ? bush : {};
    const label = String(
        spec.pickupCargoLabel
        || 'Persönliche Ausrüstung und Unterlagen'
    ).trim();
    return {
        id: 'pickup-companion-cargo',
        itemType: 'cargo',
        sceneKind: 'cargo.equipment_case',
        label,
        storyName: label,
        weightLbs: Math.max(1, Math.round(Number(spec.pickupCargoWeightLbs) || 18)),
        required: true,
        deliverAtDestination: false,
        deliverAtHome: true,
        pickupLocation: 'target',
        objectTitle: MISSION_SCENE_ASSET_POOLS.equipmentCases?.[0] || 'Cardboard',
        titleCandidates: MISSION_SCENE_ASSET_POOLS.equipmentCases?.length
            ? MISSION_SCENE_ASSET_POOLS.equipmentCases
            : MISSION_SCENE_ASSET_POOLS.cargo,
        forwardOffsetM: 0.25,
        rightOffsetM: 1.0
    };
}

function _missionCargoHasPassengerMission() {
    return _missionScenePaxCount() > 0;
}

function _missionCargoPassengerLabel() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const paxText = String([
        md?.paxText,
        md?.missionContract?.paxText,
        window.activeMissionContract?.paxText
    ].find(v => String(v || '').trim()) || '').trim();
    if (paxText) return paxText;
    const paxCount = _missionScenePaxCount();
    return paxCount === 1 ? '1 PAX' : `${paxCount} PAX`;
}

function _missionCargoPassengerCount() {
    return Math.max(0, Math.min(6, _missionScenePaxCount()));
}

function _missionCargoPassengerTotalWeightLbs() {
    const count = _missionCargoPassengerCount();
    if (count <= 0) return 0;
    return Math.max(1, Math.round(_missionCargoPaxWeightLbs() * count));
}

function _missionCargoIsPassengerItem(item = null) {
    return !!item && String(item.itemType || '').toLowerCase() === 'passenger';
}

function _missionCargoPrimaryTravelsWithPassenger(taskDomain = '') {
    if (!_missionCargoHasPassengerMission()) return false;
    const domain = String(taskDomain || '').trim().toLowerCase();
    return !/(^|_)(?:cargo|freight|fracht|medical_transfer|animal_transport|fire_watch|search_and_rescue)(?:_|$)/.test(domain);
}

function _missionCargoIsPassengerHandoffLocked(item = null) {
    return !!item && (item.handoffComplete === true || Number(item.handedOffAt || 0) > 0);
}

function _missionCargoIsPassengerHandoffItem(item = null, manifest = _missionCargoEnsureManifest()) {
    if (!item || _missionCargoIsPassengerItem(item) || item.persistentEquipment === true || item.required !== true) return false;
    if (item.handoffWithPassenger === true || item.passengerOwned === true) return true;
    if (Object.prototype.hasOwnProperty.call(item, 'handoffWithPassenger')
        || Object.prototype.hasOwnProperty.call(item, 'passengerOwned')) {
        return false;
    }
    if (String(item.id || '') !== 'primary-cargo') return false;
    const hasPassenger = Array.isArray(manifest?.items)
        && manifest.items.some(entry => _missionCargoIsPassengerItem(entry));
    return hasPassenger && _missionCargoPrimaryTravelsWithPassenger(manifest?.taskDomain || '');
}

function _missionCargoExpiryDate(seed = '') {
    const issuedAt = Date.now();
    return _missionCargoNewExpiryDate(`${_missionCargoAircraftSlot()}|${seed}|${issuedAt}`, issuedAt);
}

function _missionCargoPersistentEquipmentDefinitions() {
    const pool = (key, fallbackTitle) => {
        try {
            const values = (typeof MISSION_SCENE_ASSET_POOLS !== 'undefined' && Array.isArray(MISSION_SCENE_ASSET_POOLS?.[key]))
                ? MISSION_SCENE_ASSET_POOLS[key]
                : [];
            return values.length ? values : [fallbackTitle];
        } catch (_) {
            return [fallbackTitle];
        }
    };
    return [
        {
            id: 'bordbuch',
            sceneKind: 'cargo.aircraft_logbook',
            label: 'Bordbuch / Dispatch-Mappe',
            weightLbs: 3,
            required: false,
            deliverAtDestination: false,
            status: 'loaded',
            persistentEquipment: true,
            objectTitle: 'VFR Multitool Mission Aircraft Logbook Cargo',
            titleCandidates: pool('aircraftLogbooks', 'VFR Multitool Mission Aircraft Logbook Cargo'),
            forwardOffsetM: 0.35,
            rightOffsetM: -0.75
        },
        {
            id: 'first-aid',
            sceneKind: 'cargo.first_aid_case',
            label: 'Verbandzeug',
            weightLbs: 2,
            required: false,
            deliverAtDestination: false,
            status: 'loaded',
            persistentEquipment: true,
            equipmentType: 'expiry',
            issuedAt: Date.now(),
            expiresAt: _missionCargoExpiryDate('first-aid'),
            serialId: _missionCargoNewEquipmentSerial('first-aid'),
            objectTitle: 'VFR Multitool Homebase First Aid Case',
            titleCandidates: pool('firstAidCases', 'VFR Multitool Homebase First Aid Case'),
            forwardOffsetM: 0.65,
            rightOffsetM: -0.55
        },
        {
            id: 'fire-extinguisher',
            sceneKind: 'cargo.fire_extinguisher',
            label: 'Feuerloescher',
            weightLbs: 5,
            required: false,
            deliverAtDestination: false,
            status: 'loaded',
            persistentEquipment: true,
            equipmentType: 'expiry',
            issuedAt: Date.now(),
            expiresAt: _missionCargoExpiryDate('fire-extinguisher'),
            serialId: _missionCargoNewEquipmentSerial('fire-extinguisher'),
            objectTitle: 'VFR Multitool Homebase Fire Extinguisher',
            titleCandidates: pool('fireExtinguishers', 'VFR Multitool Homebase Fire Extinguisher'),
            forwardOffsetM: 0.95,
            rightOffsetM: 0.55
        },
        {
            id: 'chocks',
            sceneKind: 'cargo.wheel_chocks',
            label: 'Chocks / Radkeile',
            weightLbs: 6,
            required: false,
            deliverAtDestination: false,
            persistentEquipment: true,
            equipmentType: 'ground',
            objectTitle: 'VFR Multitool Homebase Aircraft Wheel Chocks',
            titleCandidates: pool('wheelChocks', 'VFR Multitool Homebase Aircraft Wheel Chocks'),
            forwardOffsetM: 1.25,
            rightOffsetM: -0.25
        }
    ];
}

function _missionCargoGenerateManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
    const aircraftSlot = _missionCargoAircraftSlot();
    const taskDomain = _missionSceneTaskDomain();
    const bush = _activeBushMissionSpec();
    const bushCompletionMode = String(bush?.completionMode || '').toLowerCase();
    const isBushPickupPassenger = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
    const isBushPickupCargo = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
    const isBushReturnHomeRecon = !!(bush && bush.targetMode === 'area_then_return' && bushCompletionMode === 'return_home');
    const cargoText = _missionCargoPrimaryText() || _missionSceneCargoText();
    const cleanedCargo = _missionCargoCleanLabel(cargoText);
    const hasCargo = !isBushPickupPassenger && !isBushPickupCargo && cleanedCargo && !/^(?:-|none|kein cargo|keine fracht|standard-ausruestung|standard ausruestung)$/i.test(cleanedCargo);
    const isPoi = _missionCargoIsPoiMission();
    const items = [];
    if (_missionCargoHasPassengerMission()) {
        const paxCount = _missionCargoPassengerCount();
        const primaryGender = _missionScenePassengerGender();
        const paxTitle = _missionScenePersonTitle(primaryGender, 'cargo-passenger-manifest');
        _missionCargoPushItem(items, {
            id: 'mission-passenger',
            itemType: 'passenger',
            sceneKind: 'mission_passenger',
            label: _missionCargoPassengerLabel(),
            storyName: _missionCargoPassengerLabel(),
            weightLbs: _missionCargoPassengerTotalWeightLbs(),
            passengerCount: paxCount,
            required: true,
            deliverAtDestination: true,
            objectTitle: paxTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, paxTitle),
            forwardOffsetM: -0.4,
            rightOffsetM: -1.2
        });
    }
    if (isBushPickupPassenger) {
        const pickupCount = Math.max(1, Math.min(6, Math.round(Number(bush.pickupPassengerCount) || 1)));
        const primaryGender = _missionScenePassengerGender();
        const paxTitle = _missionScenePersonTitle(primaryGender, 'pickup-passenger-manifest');
        _missionCargoPushItem(items, {
            id: 'pickup-passenger',
            itemType: 'passenger',
            sceneKind: 'pickup_passenger',
            label: String(bush.pickupLabel || bush.pickupRole || 'Pickup Passenger').trim(),
            storyName: String(bush.pickupLabel || bush.pickupRole || 'Pickup Passenger').trim(),
            weightLbs: Math.max(1, Math.round(_missionCargoPaxWeightLbs() * pickupCount)),
            passengerCount: pickupCount,
            required: true,
            deliverAtDestination: false,
            deliverAtHome: true,
            pickupLocation: 'target',
            objectTitle: paxTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, paxTitle),
            forwardOffsetM: -0.2,
            rightOffsetM: 1.1
        });
        _missionCargoPushItem(items, _missionCargoBushPickupCompanionItem(bush));
    }
    if (isBushPickupCargo) {
        const pickupLabel = String(bush.pickupLabel || cleanedCargo || 'Rueckholfracht').trim();
        _missionCargoPushItem(items, {
            id: 'pickup-cargo',
            itemType: 'cargo',
            sceneKind: 'cargo.small_box',
            label: pickupLabel,
            storyName: pickupLabel,
            weightLbs: _missionCargoExtractWeight(pickupLabel, 42),
            required: true,
            deliverAtDestination: false,
            deliverAtHome: true,
            pickupLocation: 'target',
            objectTitle: 'Cardboard',
            titleCandidates: MISSION_SCENE_ASSET_POOLS.cargo,
            forwardOffsetM: 0.2,
            rightOffsetM: 1.0
        });
    }
    if (hasCargo) {
        let primaryTitle = cargoAsset?.title || cargoAsset?.sizePrimary || 'Cardboard';
        let primaryCandidates = cargoAsset?.candidates || MISSION_SCENE_ASSET_POOLS.cargo;
        let primaryLabel = cleanedCargo || 'Missionsladung';
        if (taskDomain === 'fire_watch') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.fireCargo, 'Drop_Container', 'fire-cargo-primary', 'Drop_Container');
            primaryCandidates = typeof _missionSceneSafeBoardingCargoCandidates === 'function'
                ? _missionSceneSafeBoardingCargoCandidates(MISSION_SCENE_ASSET_POOLS.fireCargo)
                : MISSION_SCENE_ASSET_POOLS.fireCargo;
            primaryLabel = cleanedCargo || 'Einsatzladung';
        } else if (taskDomain === 'search_and_rescue') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.sarCargo, 'Drop_Container', 'sar-cargo-primary', 'Drop_Container');
            primaryCandidates = typeof _missionSceneSafeBoardingCargoCandidates === 'function'
                ? _missionSceneSafeBoardingCargoCandidates(MISSION_SCENE_ASSET_POOLS.sarCargo)
                : MISSION_SCENE_ASSET_POOLS.sarCargo;
            primaryLabel = cleanedCargo || 'SAR Ausruestung';
        } else if (taskDomain === 'medical_transfer') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.medicalEquipment, 'Cardboard', 'medical-cargo-primary', 'Cardboard');
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.medicalEquipment;
            primaryLabel = cleanedCargo || 'Medizinische Transportkiste';
        } else if (taskDomain === 'animal_transport') {
            const animal = _missionSceneAnimalTransportSpec('animal-cargo-primary');
            primaryTitle = animal.cargoTitle || 'Cardboard';
            primaryCandidates = animal.cargoCandidates || MISSION_SCENE_ASSET_POOLS.animalTransportBoxes;
            primaryLabel = animal.cargoLabel || cleanedCargo || 'Tiertransportbox';
        }
        const primaryWeightLbs = _missionCargoExtractWeight(cargoText, cargoAsset?.cargoWeightLbs || 20);
        if (
            !cargoAsset?.semanticAsset
            &&
            typeof _missionSceneCargoLooksLikeSmallLoosePayload === 'function'
            && _missionSceneCargoLooksLikeSmallLoosePayload(primaryLabel, primaryWeightLbs)
        ) {
            primaryTitle = 'Cardboard';
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard'];
        } else if (
            typeof _missionSceneCargoTitleIsTruckContainer === 'function'
            && _missionSceneCargoTitleIsTruckContainer(primaryTitle)
        ) {
            primaryTitle = 'Cardboard';
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard'];
        }
        _missionCargoPushItem(items, {
            id: 'primary-cargo',
            sceneKind: 'cargo',
            label: primaryLabel,
            storyName: primaryLabel,
            weightLbs: primaryWeightLbs,
            required: true,
            deliverAtDestination: !isBushReturnHomeRecon,
            deliverAtHome: isBushReturnHomeRecon,
            passengerOwned: _missionCargoPrimaryTravelsWithPassenger(taskDomain),
            handoffWithPassenger: _missionCargoPrimaryTravelsWithPassenger(taskDomain),
            objectTitle: primaryTitle,
            titleCandidates: primaryCandidates,
            forwardOffsetM: 0,
            rightOffsetM: 0
        });
    }

    _missionCargoPersistentEquipmentDefinitions().forEach(item => _missionCargoPushItem(items, item));
    if (/(cargo|freight|fracht|animal_transport)/.test(taskDomain) && !isBushPickupCargo) {
        _missionCargoPushItem(items, { id: 'cargo-docs', label: 'Frachtpapiere und Uebergabeunterlagen', weightLbs: 4, required: true, deliverAtDestination: !isBushReturnHomeRecon, deliverAtHome: isBushReturnHomeRecon, forwardOffsetM: 0.75, rightOffsetM: 0.8 });
        _missionCargoPushItem(items, { id: 'tie-downs', label: 'Spanngurte / Ladungsnetz', weightLbs: 8, required: false, deliverAtDestination: false, forwardOffsetM: 1.1, rightOffsetM: -0.9, objectTitle: 'Pallet01_03', titleCandidates: MISSION_SCENE_ASSET_POOLS.palletCargo });
    }
    if (/(news_coverage|media|photo)/.test(taskDomain)) {
        _missionCargoPushItem(items, { id: 'media-batteries', label: 'Akkukoffer und Speicherkarten', weightLbs: 9, required: false, deliverAtDestination: false, forwardOffsetM: 0.85, rightOffsetM: 0.9 });
    }
    if (/(survey|inspection|science|mapping)/.test(taskDomain)) {
        _missionCargoPushItem(items, { id: 'survey-docs', label: 'Messprotokolle und Referenzkarten', weightLbs: 5, required: false, deliverAtDestination: false, forwardOffsetM: 0.8, rightOffsetM: 0.85 });
    }
    if (isBushReturnHomeRecon) {
        _missionCargoPushItem(items, {
            id: 'recon-checklist',
            label: 'Recon-Checkliste und Platznotizen',
            weightLbs: 3,
            required: false,
            deliverAtDestination: false,
            forwardOffsetM: 0.95,
            rightOffsetM: 0.85
        });
    }
    if (taskDomain === 'medical_transfer') {
        _missionCargoPushItem(items, { id: 'patient-docs', label: 'Patientenakte / Kuehlhinweis', weightLbs: 3, required: true, deliverAtDestination: !isBushReturnHomeRecon, deliverAtHome: isBushReturnHomeRecon, forwardOffsetM: 0.75, rightOffsetM: 0.85 });
    }
    if (!items.length) {
        _missionCargoPushItem(items, { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', weightLbs: 3, required: false, deliverAtDestination: false });
    }
    _missionCargoApplyStoredOnboardEquipment(items, aircraftSlot);
    return {
        version: 6,
        key,
        aircraftSlot,
        taskDomain,
        isPoi,
        createdAt: Date.now(),
        items
    };
}

function _missionCargoUpgradePersistentEquipmentManifest(manifest = null) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    const previousVersion = Number(manifest.version || 0);
    const needsPersistentEquipmentUpgrade = previousVersion < 4 || !manifest.aircraftSlot;
    const needsPoiDeliveryUpgrade = previousVersion < 5;
    if (!needsPersistentEquipmentUpgrade && !needsPoiDeliveryUpgrade) return false;
    if (needsPersistentEquipmentUpgrade) {
        const definitions = _missionCargoPersistentEquipmentDefinitions();
        definitions.forEach((definition) => {
            let item = manifest.items.find(entry => entry?.id === definition.id);
            if (!item) {
                _missionCargoPushItem(manifest.items, definition);
                return;
            }
            const hydrated = [];
            _missionCargoPushItem(hydrated, {
                ...definition,
                status: item.status,
                healthPct: item.healthPct,
                expiresAt: item.expiresAt || definition.expiresAt,
                issuedAt: item.issuedAt || definition.issuedAt,
                serialId: item.serialId || definition.serialId,
                log: item.log,
                persistentEquipmentInherited: false
            });
            const metadata = hydrated[0] || {};
            [
                'itemType',
                'sceneKind',
                'label',
                'storyName',
                'weightLbs',
                'required',
                'deliverAtDestination',
                'equipmentType',
                'expiresAt',
                'issuedAt',
                'serialId',
                'objectTitle',
                'titleCandidates',
                'forwardOffsetM',
                'rightOffsetM',
                'persistentEquipment',
                'persistentEquipmentInherited'
            ].forEach((key) => {
                item[key] = metadata[key];
            });
        });
    }
    if (needsPoiDeliveryUpgrade && manifest.isPoi === true) {
        const bush = _activeBushMissionSpec();
        const isBushReturnHomeRecon = !!(
            bush
            && String(bush.targetMode || '').toLowerCase() === 'area_then_return'
            && String(bush.completionMode || '').toLowerCase() === 'return_home'
        );
        manifest.items
            .filter(item => item?.required === true && item?.persistentEquipment !== true && !_missionCargoIsPassengerItem(item))
            .forEach((item) => {
                item.deliverAtDestination = !isBushReturnHomeRecon;
                item.deliverAtHome = isBushReturnHomeRecon;
            });
    }
    manifest.aircraftSlot = _missionCargoAircraftSlot(manifest.aircraftSlot);
    if (needsPersistentEquipmentUpgrade) {
        _missionCargoApplyStoredOnboardEquipment(manifest.items, manifest.aircraftSlot);
    }
    manifest.version = 5;
    return true;
}

function _missionCargoGetManifest() {
    if (missionCargoComplianceDebugManifest) return missionCargoComplianceDebugManifest;
    if (missionCargoGroundInventoryManifest && !_missionCargoHasActiveMission()) return missionCargoGroundInventoryManifest;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.cargoManifest && typeof md.cargoManifest === 'object') return md.cargoManifest;
    if (md?.missionContract?.cargoManifest && typeof md.missionContract.cargoManifest === 'object') return md.missionContract.cargoManifest;
    if (window.activeMissionContract?.cargoManifest && typeof window.activeMissionContract.cargoManifest === 'object') return window.activeMissionContract.cargoManifest;
    return null;
}

function _missionCargoPersistManifest(manifest) {
    const isComplianceDebugManifest = !!(
        missionCargoComplianceDebugManifest
        && String(manifest?.key || '') === String(missionCargoComplianceDebugManifest.key || '')
    );
    const isGroundInventoryManifest = !!(
        missionCargoGroundInventoryManifest
        && String(manifest?.key || '') === String(missionCargoGroundInventoryManifest.key || '')
    );
    const isTransientManifest = isComplianceDebugManifest || isGroundInventoryManifest;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (isComplianceDebugManifest) {
        missionCargoComplianceDebugManifest = manifest;
    } else if (isGroundInventoryManifest) {
        missionCargoGroundInventoryManifest = manifest;
    } else if (md && typeof md === 'object') {
        md.cargoManifest = manifest;
        if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.cargoManifest = manifest;
    }
    if (!isTransientManifest && window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.cargoManifest = manifest;
    }
    _missionCargoPersistOnboardEquipment(manifest);
    try {
        window.dispatchEvent(new CustomEvent('missioncargochange', { detail: { manifest } }));
    } catch (_) {}
    if (!isTransientManifest) {
        try {
            window.requestTrackerTelemetryWake?.('mission-cargo-change');
        } catch (_) {}
        try {
            if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
            else if (typeof saveMissionState === 'function') saveMissionState();
        } catch (_) {}
        try {
            if (typeof window.missionPersistRuntimeSnapshot === 'function') {
                window.missionPersistRuntimeSnapshot('cargo-manifest');
            }
        } catch (_) {}
    }
    return manifest;
}

function _missionCargoEnsureUiSyncHook() {
    if (missionCargoUiSyncHooked) return;
    missionCargoUiSyncHooked = true;
    window.addEventListener('missioncargochange', () => {
        const overlay = document.getElementById('missionCargoOverlay');
        if (!overlay || overlay.style.display !== 'flex') return;
        const requestedMode = String(window.missionCargoStatus?.lastMode || 'load');
        const mode = ['unload', 'pickup', 'equipment'].includes(requestedMode) ? requestedMode : 'load';
        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
    });
}

function _missionCargoEnsureManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (missionCargoComplianceDebugManifest) {
        window.missionCargoStatus.manifestKey = missionCargoComplianceDebugManifest.key || key;
        _missionCargoResetPayloadPlanForMissionKey(missionCargoComplianceDebugManifest.key || key);
        return missionCargoComplianceDebugManifest;
    }
    if (missionCargoGroundInventoryManifest && _missionCargoHasActiveMission()) {
        missionCargoGroundInventoryManifest = null;
    }
    if (missionCargoGroundInventoryManifest && !_missionCargoHasActiveMission()) {
        window.missionCargoStatus.manifestKey = missionCargoGroundInventoryManifest.key || key;
        _missionCargoResetPayloadPlanForMissionKey(missionCargoGroundInventoryManifest.key || key);
        return missionCargoGroundInventoryManifest;
    }
    if (typeof window.missionIsFreeflightOnly === 'function' && window.missionIsFreeflightOnly(md)) {
        return {
            version: 1,
            key,
            taskDomain: 'freeflight_planning',
            isPoi: false,
            createdAt: Date.now(),
            items: []
        };
    }
    let manifest = _missionCargoGetManifest();
    const bushPickupCompanionUpgraded = !!(
        manifest
        && manifest.key === key
        && Array.isArray(manifest.items)
        && _missionCargoUpgradeBushPickupCompanionCargo(manifest)
    );
    if (!manifest || manifest.key !== key || !Array.isArray(manifest.items) || !manifest.items.length || !_missionCargoManifestMatchesMissionRecipe(manifest)) {
        manifest = _missionCargoGenerateManifest(cargoAsset || _missionSceneCargoAsset());
        _missionCargoPersistManifest(manifest);
    } else if (bushPickupCompanionUpgraded) {
        _missionCargoPersistManifest(manifest);
    } else if (_missionCargoUpgradePersistentEquipmentManifest(manifest)) {
        _missionCargoPersistManifest(manifest);
    } else if (manifest.items.some(item => item?.persistentEquipment === true && item.status === 'pending')) {
        const previousStates = manifest.items
            .filter(item => item?.persistentEquipment === true)
            .map(item => `${item.id}:${item.status}`)
            .join('|');
        _missionCargoApplyStoredOnboardEquipment(manifest.items, manifest.aircraftSlot);
        const nextStates = manifest.items
            .filter(item => item?.persistentEquipment === true)
            .map(item => `${item.id}:${item.status}`)
            .join('|');
        if (nextStates !== previousStates) _missionCargoPersistManifest(manifest);
    }
    window.missionCargoStatus.manifestKey = manifest.key || key;
    _missionCargoResetPayloadPlanForMissionKey(manifest.key || key);
    return manifest;
}

window.missionCargoBeginComplianceDebugSession = function(options = {}) {
    if (missionCargoComplianceDebugManifest) {
        return JSON.parse(JSON.stringify(missionCargoComplianceDebugManifest));
    }
    missionCargoGroundInventoryManifest = null;
    const startedAt = Math.round(Number(options.startedAt || 0) || Date.now());
    const landingAt = Math.max(startedAt, Math.round(Number(options.landingAt || 0) || startedAt));
    const flightId = String(options.flightId || `debug-authority|${startedAt}`);
    const key = String(options.key || `debug-authority-${startedAt}`);
    const aircraftSlot = _missionCargoAircraftSlot();
    const items = _missionCargoPersistentEquipmentDefinitions();
    _missionCargoApplyStoredOnboardEquipment(items, aircraftSlot);
    missionCargoComplianceDebugManifest = {
        version: 4,
        key,
        aircraftSlot,
        taskDomain: 'flight_compliance',
        isPoi: false,
        debugCompliance: true,
        flightId,
        createdAt: startedAt,
        flightEvents: {
            flightId,
            startAt: startedAt,
            landingAt
        },
        items
    };
    window.missionCargoStatus.error = null;
    window.missionCargoStatus.manifestKey = key;
    _missionCargoPersistManifest(missionCargoComplianceDebugManifest);
    return JSON.parse(JSON.stringify(missionCargoComplianceDebugManifest));
};

window.missionCargoEndComplianceDebugSession = function(flightId = '') {
    if (!missionCargoComplianceDebugManifest) return false;
    const expectedFlightId = String(flightId || '');
    if (expectedFlightId && expectedFlightId !== String(missionCargoComplianceDebugManifest.flightId || '')) return false;
    missionCargoComplianceDebugManifest = null;
    window.missionCargoStatus.manifestKey = '';
    window.missionCargoStatus.error = null;
    return true;
};

window.missionCargoBeginGroundInventorySession = function() {
    const aircraftSlot = _missionCargoAircraftSlot();
    if (missionCargoGroundInventoryManifest?.aircraftSlot === aircraftSlot) {
        return JSON.parse(JSON.stringify(missionCargoGroundInventoryManifest));
    }
    const createdAt = Date.now();
    const key = `ground-inventory-${aircraftSlot}-${createdAt}`;
    const items = _missionCargoPersistentEquipmentDefinitions();
    _missionCargoApplyStoredOnboardEquipment(items, aircraftSlot);
    missionCargoGroundInventoryManifest = {
        version: 4,
        key,
        aircraftSlot,
        taskDomain: 'ground_inventory',
        isPoi: false,
        groundInventory: true,
        createdAt,
        items
    };
    window.missionCargoStatus.error = null;
    window.missionCargoStatus.manifestKey = key;
    _missionCargoPersistManifest(missionCargoGroundInventoryManifest);
    setTimeout(() => _missionCargoSpawnUnloadedSceneObjects('ground-inventory-open'), 0);
    return JSON.parse(JSON.stringify(missionCargoGroundInventoryManifest));
};

window.missionCargoEndGroundInventorySession = function() {
    if (!missionCargoGroundInventoryManifest) return false;
    missionCargoGroundInventoryManifest = null;
    window.missionCargoStatus.manifestKey = '';
    window.missionCargoStatus.error = null;
    return true;
};

function _missionCargoManifestMatchesMissionRecipe(manifest = null) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    const bush = _activeBushMissionSpec();
    const isPickupPassenger = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
    const isPickupCargo = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
    if (isPickupPassenger) {
        const targetItems = manifest.items.filter(item => item && item.pickupLocation === 'target');
        return targetItems.some(item => String(item.itemType || '').toLowerCase() === 'passenger')
            && targetItems.some(item => String(item.itemType || '').toLowerCase() === 'cargo');
    }
    if (isPickupCargo) {
        return manifest.items.some(item => item && item.pickupLocation === 'target' && String(item.itemType || '').toLowerCase() === 'cargo');
    }
    return true;
}

function _missionCargoUpgradeBushPickupCompanionCargo(manifest = null) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    const bush = _activeBushMissionSpec();
    const isPickupPassenger = !!(
        bush
        && bush.targetMode === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'passenger'
    );
    if (!isPickupPassenger) return false;
    const targetItems = manifest.items.filter(item => item?.pickupLocation === 'target');
    const passengerItem = targetItems.find(item => _missionCargoIsPassengerItem(item));
    const cargoItem = targetItems.find(item => !_missionCargoIsPassengerItem(item));
    if (!passengerItem || cargoItem) return false;
    _missionCargoPushItem(manifest.items, _missionCargoBushPickupCompanionItem(bush));
    const companion = manifest.items.find(item => item?.id === 'pickup-companion-cargo');
    if (!companion) return false;
    if (passengerItem.status === 'loaded') {
        companion.status = 'loaded';
        companion.loadedAt = Number(passengerItem.loadedAt) || Date.now();
    } else if (passengerItem.status === 'unloaded' || passengerItem.handoffComplete === true) {
        companion.status = 'unloaded';
        companion.loadedAt = Number(passengerItem.loadedAt) || 0;
        companion.unloadedAt = Number(passengerItem.unloadedAt || passengerItem.handedOffAt) || Date.now();
        companion.unloadLat = Number.isFinite(Number(passengerItem.unloadLat)) ? Number(passengerItem.unloadLat) : null;
        companion.unloadLon = Number.isFinite(Number(passengerItem.unloadLon)) ? Number(passengerItem.unloadLon) : null;
        companion.unloadAltFt = Number.isFinite(Number(passengerItem.unloadAltFt)) ? Number(passengerItem.unloadAltFt) : null;
    }
    manifest.version = Math.max(6, Number(manifest.version) || 0);
    return true;
}

function _missionCargoPilotId() {
    try {
        if (typeof getSyncId === 'function') {
            const id = String(getSyncId() || '').trim();
            if (id) return id;
        }
    } catch (_) {}
    try {
        const id = String(localStorage.getItem('ga_sync_id') || '').trim();
        if (id) return id;
    } catch (_) {}
    return 'UNBEKANNT';
}

function _missionCargoAircraftLabel() {
    const slot = String(window.selectedAC || window.activeAircraftPresetSettingsSlot || 'N/A').trim() || 'N/A';
    let presetName = '';
    try {
        const presets = JSON.parse(localStorage.getItem('ga_aircraft_presets_v1') || '{}') || {};
        const rawName = presets?.[slot]?.name;
        if (rawName != null) presetName = String(rawName).trim();
    } catch (_) {}
    if (presetName && presetName !== slot) return `${slot} · ${presetName}`;
    return slot;
}

function _missionCargoFormatDate(ts = Date.now()) {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function _missionCargoInvalidateDispatchSignature(manifest) {
    if (!manifest) return false;
    const hadSignature = !!manifest.dispatchSignature;
    manifest.dispatchSignature = null;
    if (window.missionCargoStatus) {
        window.missionCargoStatus.loadConfirmed = false;
    }
    return hadSignature;
}

function _missionCargoSignatureScope(mode = 'load') {
    const normalizedMode = String(mode || '').toLowerCase();
    if (normalizedMode === 'unload') return 'arrival';
    if (normalizedMode === 'pickup') return 'pickup';
    return 'departure';
}

function _missionCargoSignatureMatchesMode(signature = null, mode = 'load') {
    if (!signature || typeof signature !== 'object') return false;
    const recordedScope = String(signature.scope || 'departure').toLowerCase();
    return recordedScope === _missionCargoSignatureScope(mode);
}

function _missionCargoClearSignatureAnimation() {
    if (window.missionCargoStatus?.signatureAnimationTimer) {
        clearTimeout(window.missionCargoStatus.signatureAnimationTimer);
        window.missionCargoStatus.signatureAnimationTimer = 0;
    }
    if (window.missionCargoStatus) window.missionCargoStatus.signatureAnimationEndsAt = 0;
    if (window.missionCargoStatus) window.missionCargoStatus.signatureAnimationMode = '';
}

function _missionCargoStartSignatureAnimation(options = {}) {
    const durationMs = Math.max(300, Number(options.durationMs) || 1600);
    const renderMode = _missionCargoActionDialogMode({ mode: options.mode }, 'load');
    _missionCargoClearSignatureAnimation();
    if (!window.missionCargoStatus) return;
    window.missionCargoStatus.signatureAnimationEndsAt = Date.now() + durationMs;
    window.missionCargoStatus.signatureAnimationMode = renderMode;
    window.missionCargoStatus.signatureAnimationTimer = window.setTimeout(() => {
        if (window.missionCargoStatus) {
            window.missionCargoStatus.signatureAnimationTimer = 0;
            window.missionCargoStatus.signatureAnimationEndsAt = 0;
            window.missionCargoStatus.signatureAnimationMode = '';
        }
        if (options.render !== false
            && document.getElementById('missionCargoOverlay')?.style.display === 'flex'
            && window.missionCargoStatus?.lastMode === renderMode) {
            _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        }
    }, durationMs + 40);
}

window.missionCargoSignDispatchList = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const renderMode = _missionCargoActionDialogMode({ mode: options.mode }, 'load');
    const isArrival = renderMode === 'unload';
    const isPickup = renderMode === 'pickup';
    const requiredMissing = isArrival
        ? (manifest.items || []).filter(item => (
            item.required
            && item.status === 'loaded'
            && !_missionCargoIsPassengerItem(item)
            && _missionCargoItemNeedsUnloadHere(item)
        ))
        : (manifest.items || []).filter(item => (
            item.required
            && (isPickup ? item.pickupLocation === 'target' : item.pickupLocation !== 'target')
            && item.status !== 'loaded'
        ));
    if (requiredMissing.length > 0) {
        window.missionCargoStatus.error = isArrival
            ? `Pflichtladung noch zu entladen: ${requiredMissing.map(item => item.storyName || item.label || item.id).join(', ')}`
            : (isPickup
                ? `Pickup noch offen: ${requiredMissing.map(item => item.storyName || item.label || item.id).join(', ')}`
                : `Pflichtladung noch offen: ${requiredMissing.map(item => item.storyName || item.label || item.id).join(', ')}`);
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    manifest.dispatchSignature = {
        by: _missionCargoPilotId(),
        at: Date.now(),
        aircraft: _missionCargoAircraftLabel(),
        scope: _missionCargoSignatureScope(renderMode),
        note: String(options?.note || '').trim()
    };
    _missionCargoPersistManifest(manifest);
    if (options.animate !== false) {
        _missionCargoStartSignatureAnimation({
            render: options.render !== false,
            mode: renderMode
        });
    }
    if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

window.missionCargoClearDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const renderMode = _missionCargoActionDialogMode({ mode: options.mode }, 'load');
    if (!_missionCargoSignatureMatchesMode(manifest.dispatchSignature, renderMode)) return false;
    _missionCargoClearSignatureAnimation();
    manifest.dispatchSignature = null;
    if (renderMode === 'load' && window.missionCargoStatus) {
        window.missionCargoStatus.loadConfirmed = false;
    }
    _missionCargoPersistManifest(manifest);
    if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const renderMode = _missionCargoActionDialogMode({ mode: options.mode }, 'load');
    if (_missionCargoSignatureMatchesMode(manifest.dispatchSignature, renderMode)) {
        return window.missionCargoClearDispatchSignature({ ...options, mode: renderMode });
    }
    return window.missionCargoSignDispatchList(options);
};

function _missionCargoSceneId() {
    return window.missionSceneStatus?.sceneId || _missionSceneId();
}

function _missionCargoUnloadSceneId() {
    if (missionCargoGroundInventoryManifest && !_missionCargoHasActiveMission()) {
        return `scene-ground-inventory-${_missionCargoAircraftSlot(missionCargoGroundInventoryManifest.aircraftSlot)}-cargo-unload`;
    }
    return `${_missionSceneId()}-cargo-unload`;
}

function _missionCargoStableObjectKey(item = null, manifest = null) {
    const itemId = String(item?.id || item?.cargoItemId || item?.sceneKind || 'cargo-item')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'cargo-item';
    const activeManifest = manifest || _missionCargoGetManifest();
    if (item?.persistentEquipment === true) {
        return `aircraft-equipment:${_missionCargoAircraftSlot(activeManifest?.aircraftSlot)}:${itemId}`;
    }
    const missionKey = String(activeManifest?.key || _missionCargoMissionKey() || 'active-mission')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'active-mission';
    return `mission-cargo:${missionKey}:${itemId}`;
}

function _missionCargoLivePos() {
    const pos = (window.simModeActive && window.gaSimGpsPos)
        ? window.gaSimGpsPos
        : (window.lastLiveGpsPos || {});
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat,
        lon,
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0
    };
}

function _missionCargoCommandBasePos() {
    const livePos = _missionCargoLivePos();
    if (livePos) return livePos;
    const gate = window.missionSceneStatus?.lastGate || {};
    const lat = Number(gate.lat);
    const lon = Number(gate.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const pos = window.lastLiveGpsPos || {};
    return {
        lat,
        lon,
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0
    };
}

function _missionCargoDistanceToUnloadM(item, livePos = null) {
    const unloadLat = _missionCargoNullableNumber(item?.unloadLat);
    const unloadLon = _missionCargoNullableNumber(item?.unloadLon);
    if (unloadLat === null || unloadLon === null || (unloadLat === 0 && unloadLon === 0)) return null;
    const pos = livePos || _missionCargoLivePos();
    if (!pos) return null;
    return _haversineNmLocal(pos.lat, pos.lon, unloadLat, unloadLon) * 1852;
}

function _missionCargoCanReloadUnloadedItem(item, maxDistanceM = MISSION_CARGO_RELOAD_MAX_DISTANCE_M) {
    if (!item || item.status !== 'unloaded') return true;
    if (!window.simModeActive && !window.liveTrackerConnected) return true;
    const unloadLat = _missionCargoNullableNumber(item.unloadLat);
    const unloadLon = _missionCargoNullableNumber(item.unloadLon);
    if (unloadLat === null || unloadLon === null || (unloadLat === 0 && unloadLon === 0)) return true;
    const dM = _missionCargoDistanceToUnloadM(item);
    return Number.isFinite(dM) && dM <= Number(maxDistanceM || MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
}

function _missionCargoFindItem(itemId) {
    const manifest = _missionCargoEnsureManifest();
    return manifest.items.find(item => item.id === itemId) || null;
}

function _missionCargoItemForwardM(item = null) {
    if (!item || typeof item !== 'object') return 0;
    if (Number.isFinite(Number(item.forwardM))) return Number(item.forwardM);
    if (Number.isFinite(Number(item.forwardOffsetM))) return Number(item.forwardOffsetM);
    return 0;
}

function _missionCargoItemRightM(item = null) {
    if (!item || typeof item !== 'object') return 0;
    if (Number.isFinite(Number(item.rightM))) return Number(item.rightM);
    if (Number.isFinite(Number(item.rightOffsetM))) return Number(item.rightOffsetM);
    return 0;
}

function _missionCargoGroundSpawnPlacement(item = null) {
    const cfg = _missionSceneBoardingConfig();
    const cargo = cfg?.cargo || { forwardM: 4, rightM: 4, altOffsetFt: 0 };
    const cargoForward = Number.isFinite(Number(cargo.forwardM)) ? Number(cargo.forwardM) : 4;
    const cargoRight = Number.isFinite(Number(cargo.rightM)) ? Number(cargo.rightM) : 4;
    const cargoAlt = Number.isFinite(Number(cargo.altOffsetFt)) ? Number(cargo.altOffsetFt) : 0;
    const itemAlt = Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0;
    return {
        forwardM: cargoForward + _missionCargoItemForwardM(item),
        rightM: cargoRight + _missionCargoItemRightM(item),
        altOffsetFt: cargoAlt + itemAlt
    };
}

function _missionCargoPassengerBoardingPoint() {
    const cfg = _missionSceneBoardingConfig();
    const target = cfg?.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
    return {
        forwardM: Number.isFinite(Number(target.forwardM)) ? Number(target.forwardM) : 4.5,
        rightM: Number.isFinite(Number(target.rightM)) ? Number(target.rightM) : 8.5,
        altOffsetFt: Number.isFinite(Number(target.altOffsetFt)) ? Number(target.altOffsetFt) : 0
    };
}

function _missionCargoPassengerSpawnPlacement(item = null) {
    const target = _missionCargoPassengerBoardingPoint();
    const itemAlt = Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0;
    return {
        forwardM: target.forwardM + _missionCargoItemForwardM(item),
        rightM: target.rightM + _missionCargoItemRightM(item),
        altOffsetFt: target.altOffsetFt + itemAlt
    };
}

function _missionCargoManualPassengerSceneBusy() {
    const status = window.missionSceneStatus || {};
    return !!(
        missionRuntime.waitingFarewellDeboarding
        || missionRuntime.deboardingAfterFarewellStarted
        || status.boardingPreparing
        || status.boardingRequested
        || status.boardingActive
        || status.deboardingRequested
        || status.deboardingActive
        || status.manualPaxRequested
        || status.manualPaxActive
    );
}

function _missionCargoManualPassengerBusyMessage() {
    const status = window.missionSceneStatus || {};
    if (status.boardingPreparing) return 'Boarding wird vorbereitet.';
    if (status.boardingRequested || status.boardingActive) return 'Boarding laeuft bereits.';
    if (status.deboardingRequested || status.deboardingActive) return 'Deboarding laeuft bereits.';
    return 'Passenger-Animation laeuft bereits.';
}

function _missionCargoPassengerBusyLabel() {
    const status = window.missionSceneStatus || {};
    if (status.boardingPreparing || status.boardingRequested || status.boardingActive) return 'Boarding läuft';
    if (status.deboardingRequested || status.deboardingActive) return 'Aussteigen läuft';
    const action = String(window.missionCargoStatus?.lastCommand?.type === 'mission_scene_manual_pax'
        ? window.missionCargoStatus.lastCommand.action || ''
        : '').toLowerCase();
    if (action === 'load') return 'Einsteigen läuft';
    if (action === 'unload') return 'Aussteigen läuft';
    return 'PAX-Aktion läuft';
}

function _missionCargoSendManualPassengerCommand(item = null, action = 'unload', options = {}) {
    if (!item || window.simModeActive || !window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    if (_missionCargoManualPassengerSceneBusy()) {
        window.missionCargoStatus.error = _missionCargoManualPassengerBusyMessage();
        return false;
    }
    const pos = _missionCargoCommandBasePos();
    if (!Number.isFinite(Number(pos?.lat)) || !Number.isFinite(Number(pos?.lon))) {
        window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Passenger-Animation.';
        return false;
    }
    const normalizedAction = String(action || '').toLowerCase() === 'load' ? 'load' : 'unload';
    const commonFields = (typeof _missionSceneCommonSceneCommandFields === 'function')
        ? _missionSceneCommonSceneCommandFields()
        : {};
    const boardingPoint = options.boardingPoint || _missionCargoPassengerBoardingPoint();
    const gender = _missionScenePassengerGender();
    const requestedPersonTitle = String(options.personTitle || item.objectTitle || '').trim();
    const personTitle = /^tarmac_/i.test(requestedPersonTitle)
        ? requestedPersonTitle
        : (typeof _missionSceneMovingPersonTitle === 'function'
            ? _missionSceneMovingPersonTitle(gender, `manual-passenger-${normalizedAction}`)
            : _missionScenePersonTitle(gender, `manual-passenger-${normalizedAction}`));
    const defaultPersonKind = `unloaded_${item.sceneKind || item.id}`;
    const personKind = String(options.personKind || defaultPersonKind).trim() || defaultPersonKind;
    const personKinds = Array.isArray(options.personKinds) ? options.personKinds.map(v => String(v || '').trim()).filter(Boolean) : [];
    const personLabel = String(options.personLabel || item.storyName || item.label || 'Passenger').trim() || 'Passenger';
    const personLabels = Array.isArray(options.personLabels) ? options.personLabels.map(v => String(v || '').trim()).filter(Boolean) : [];
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_manual_pax',
        action: normalizedAction,
        sceneId: options.sceneId || _missionCargoUnloadSceneId(),
        reason: options.reason || `passenger-manual-${normalizedAction}`,
        ...commonFields,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        boardingPoint,
        targetPoint: boardingPoint,
        personKind,
        personKinds,
        personLabel,
        personLabels,
        personTitle,
        personTitleCandidates: typeof _missionSceneMovingPersonCandidates === 'function'
            ? _missionSceneMovingPersonCandidates(gender, personTitle)
            : _missionScenePersonCandidates(gender, personTitle),
        doorOpenWaitMs: 2000,
        doorCloseWaitMs: 1000,
        hdgOffsetDeg: 165
    });
    if (!commandId) return false;
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.manualPaxRequested = true;
        window.missionSceneStatus.manualPaxActive = true;
        window.missionSceneStatus.manualPaxError = null;
    }
    window.missionCargoStatus.lastCommandAt = Date.now();
    window.missionCargoStatus.lastCommand = { type: 'mission_scene_manual_pax', commandId, itemId: item.id, action: normalizedAction };
    window.missionCargoStatus.error = null;
    return commandId;
}

function _missionCargoVisibleKind(item = null, options = {}) {
    const base = String(item?.sceneKind || item?.id || 'cargo').trim() || 'cargo';
    return options.unloaded ? `unloaded_${base}` : base;
}

function _missionCargoVisibleSelectors(item = null, options = {}) {
    const visibleKind = _missionCargoVisibleKind(item, options);
    const baseKind = String(item?.sceneKind || '').trim();
    const objectKey = String(options.objectKey || _missionCargoStableObjectKey(item)).trim();
    const extraKinds = Array.isArray(options.extraKinds) ? options.extraKinds.map(v => String(v || '').trim()).filter(Boolean) : [];
    return {
        objectKeys: objectKey ? [objectKey] : [],
        kinds: Array.from(new Set([visibleKind, baseKind, ...extraKinds].filter(Boolean))),
        labels: [item?.label, item?.storyName].filter(Boolean),
        itemIds: [item?.id].filter(Boolean),
        cargoSceneKinds: Array.from(new Set([baseKind, visibleKind].filter(Boolean)))
    };
}

function _missionCargoRemoveVisibleItem(item = null, options = {}) {
    if (!item || window.simModeActive || !window.liveTrackerConnected || _missionCargoIsPassengerItem(item)) return false;
    const sceneId = options.sceneId || (options.unloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
    const objectKey = String(options.objectKey || _missionCargoStableObjectKey(item)).trim();
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_remove',
        sceneId,
        reason: options.reason || 'cargo-visible-remove',
        objectKey,
        objectRevision: Math.max(0, Math.round(Number(options.objectRevision || 0))),
        allScenes: options.allScenes !== false,
        ..._missionCargoVisibleSelectors(item, {
            objectKey,
            unloaded: !!options.unloaded,
            extraKinds: options.extraKinds
        })
    });
    window.missionCargoStatus.lastCommandAt = Date.now();
    window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_remove', commandId, itemId: item.id, objectKey };
    return commandId || false;
}

function _missionCargoSpawnVisibleItem(item = null, options = {}) {
    if (!item || window.simModeActive || !window.liveTrackerConnected || _missionCargoIsPassengerItem(item)) return false;
    const pos = options.pos || _missionCargoCommandBasePos();
    const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
    if (!hasPos) {
        window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Cargo-Spawn.';
        return false;
    }
    const sceneId = options.sceneId || (options.unloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
    const kind = _missionCargoVisibleKind(item, { unloaded: !!options.unloaded });
    const objectKey = String(options.objectKey || _missionCargoStableObjectKey(item)).trim();
    const placement = _missionCargoGroundSpawnPlacement(item);
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_spawn',
        sceneId,
        reason: options.reason || 'cargo-visible-spawn',
        objectKey,
        objectRevision: Math.max(0, Math.round(Number(options.objectRevision || 0))),
        replaceExisting: options.replaceExisting !== false,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        items: [{
            kind,
            itemId: item.id || '',
            cargoItemId: item.id || '',
            cargoSceneKind: item.sceneKind || kind,
            objectKey,
            objectRevision: Math.max(0, Math.round(Number(options.objectRevision || 0))),
            label: item.storyName || item.label || item.id,
            objectTitle: item.objectTitle || 'Cardboard',
            titleCandidates: item.titleCandidates || _sceneAssetCandidates(item.objectTitle || 'Cardboard', MISSION_SCENE_ASSET_POOLS.cargo),
            forwardM: Number.isFinite(Number(options.forwardM)) ? Number(options.forwardM) : placement.forwardM,
            rightM: Number.isFinite(Number(options.rightM)) ? Number(options.rightM) : placement.rightM,
            headingMode: 'with_aircraft',
            altOffsetFt: Number.isFinite(Number(options.altOffsetFt)) ? Number(options.altOffsetFt) : placement.altOffsetFt
        }]
    });
    window.missionCargoStatus.lastCommandAt = Date.now();
    window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId: item.id, objectKey };
    return commandId || false;
}

function _missionCargoFlushVisibleItemState(objectKey) {
    const key = String(objectKey || '').trim();
    const state = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(key);
    if (!state) return false;
    state.timer = null;
    const desired = state.desired;
    if (!desired) {
        _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(key);
        return false;
    }
    const sendOptions = {
        ...(desired.options || {}),
        objectKey: key,
        objectRevision: desired.revision
    };
    const commandId = desired.visible
        ? _missionCargoSpawnVisibleItem(desired.item, sendOptions)
        : _missionCargoRemoveVisibleItem(desired.item, { ...sendOptions, allScenes: true });
    if (!commandId) {
        _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(key);
        return false;
    }
    state.pendingCommandId = String(commandId);
    state.pendingRevision = desired.revision;
    state.sentAt = Date.now();
    return commandId;
}

function _missionCargoQueueVisibleItemState(item = null, visible = false, options = {}) {
    if (!item || window.simModeActive || !window.liveTrackerConnected || _missionCargoIsPassengerItem(item)) return false;
    const objectKey = _missionCargoStableObjectKey(item);
    const previous = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(objectKey);
    if (previous?.timer) clearTimeout(previous.timer);
    const revision = ++missionCargoObjectActionRevision;
    const state = previous || {
        objectKey,
        pendingCommandId: '',
        pendingRevision: 0,
        sentAt: 0,
        timer: null,
        desired: null
    };
    state.desired = {
        visible: visible === true,
        revision,
        item: JSON.parse(JSON.stringify(item)),
        options: { ...options }
    };
    const delayMs = options.immediate === true
        ? 0
        : Math.max(0, Number(options.delayMs ?? MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS));
    state.timer = setTimeout(() => _missionCargoFlushVisibleItemState(objectKey), delayMs);
    _MISSION_CARGO_OBJECT_ACTION_QUEUE.set(objectKey, state);
    return true;
}

window.missionCargoResolveVisibleItemAck = function(ack = {}) {
    if (ack.type !== 'mission_scene_object_spawn_ack' && ack.type !== 'mission_scene_object_remove_ack') return false;
    const commandId = String(ack.commandId || '');
    if (!commandId) return false;
    for (const [objectKey, state] of _MISSION_CARGO_OBJECT_ACTION_QUEUE.entries()) {
        if (String(state?.pendingCommandId || '') !== commandId) continue;
        state.pendingCommandId = '';
        state.pendingRevision = 0;
        if (!state.timer && Number(state.desired?.revision || 0) <= Number(ack.objectRevision || state.desired?.revision || 0)) {
            _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(objectKey);
        }
        return true;
    }
    return false;
};

function _missionCargoCancelVisibleItemActions() {
    for (const state of _MISSION_CARGO_OBJECT_ACTION_QUEUE.values()) {
        if (state?.timer) clearTimeout(state.timer);
    }
    _MISSION_CARGO_OBJECT_ACTION_QUEUE.clear();
    missionCargoObjectActionRevision += 1;
}

function _missionCargoLoadedItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => item.status === 'loaded' || item.status === 'unloaded');
}

function _missionCargoItemCanLoadAtCurrentStage(item = null) {
    if (!item || typeof item !== 'object') return false;
    if (_missionCargoIsPassengerHandoffLocked(item)) return false;
    if (item.pickupLocation === 'target') return _missionBushPickupAtTargetNow();
    return true;
}

function _missionCargoItemNeedsUnloadHere(item = null) {
    if (!item || typeof item !== 'object') return false;
    if (item.deliverAtHome === true) {
        const pos = window.lastLiveGpsPos || {};
        const lat = Number(pos.lat);
        const lon = Number(pos.lon);
        return Number.isFinite(lat) && Number.isFinite(lon) && _isAtMissionHome(lat, lon);
    }
    return item.deliverAtDestination !== false;
}

function _missionCargoLoadedPassengerItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
}

function _missionCargoPassengerUnloadedItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'unloaded');
}

function _lbsFromKg(kg) {
    const n = Number(kg);
    if (!Number.isFinite(n)) return null;
    return n * 2.2046226218;
}

function _missionCargoParseWeightFromText(text = '') {
    const raw = String(text || '');
    const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilogramm?|lb|lbs|pounds?|pfund)/i);
    if (!match) return null;
    const value = Number(String(match[1]).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = String(match[2] || '').toLowerCase();
    if (unit.startsWith('k')) return _lbsFromKg(value);
    return value;
}

function _missionCargoPaxWeightLbs() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const pax = window.activePassenger || md?.passenger || md?.missionContract?.passenger || window.activeMissionContract?.passenger || {};
    const directLbs = [pax?.weightLbs, pax?.weightLb, pax?.massLbs, pax?.weight]
        .map(v => Number(v))
        .find(v => Number.isFinite(v) && v > 20);
    if (Number.isFinite(directLbs)) return Math.round(directLbs);
    const directKg = [pax?.weightKg, pax?.massKg]
        .map(v => Number(v))
        .find(v => Number.isFinite(v) && v > 10);
    if (Number.isFinite(directKg)) return Math.round(_lbsFromKg(directKg));
    const text = [
        pax?.weightText,
        pax?.notes,
        md?.paxText,
        md?.missionContract?.paxText,
        window.activeMissionContract?.paxText,
        document.getElementById('mPay')?.innerText
    ].filter(Boolean).join(' ');
    const parsed = _missionCargoParseWeightFromText(text);
    return Number.isFinite(parsed) ? Math.round(parsed) : 180;
}

function _missionCargoBoardedPaxCount() {
    const manifest = _missionCargoGetManifest();
    const passengerItems = manifest && Array.isArray(manifest.items)
        ? manifest.items.filter(_missionCargoIsPassengerItem)
        : [];
    const loadedPassengerItem = manifest && Array.isArray(manifest.items)
        ? passengerItems.find(item => item.status === 'loaded')
        : null;
    if (loadedPassengerItem) return Math.max(0, Math.min(6, Math.round(Number(loadedPassengerItem.passengerCount) || 1)));
    if (passengerItems.length) return 0;
    const paxCount = Math.max(0, Math.min(2, _missionScenePaxCount()));
    if (paxCount <= 0) return 0;
    if (window.missionSceneStatus?.personBoarded) return 1;
    try {
        if (_missionStartPhase() === 'boarded') return 1;
    } catch (_) {}
    return 0;
}

function _missionCargoResetPayloadPlanForMissionKey(manifestKey = '') {
    if (window.missionCargoStatus.payloadMissionKey === manifestKey) return;
    if (window.missionCargoStatus?.manualPaxPending
        && window.missionCargoStatus.manualPaxPending.manifestKey !== manifestKey) {
        if (missionCargoManualPaxRollbackTimer) clearTimeout(missionCargoManualPaxRollbackTimer);
        missionCargoManualPaxRollbackTimer = null;
        window.missionCargoStatus.manualPaxPending = null;
        if (window.missionSceneStatus) {
            window.missionSceneStatus.manualPaxRequested = false;
            window.missionSceneStatus.manualPaxActive = false;
        }
    }
    if (window.missionCargoStatus.payloadFinalizeRunning) {
        window.missionCargoStatus.payloadFinalizeSeq = Number(window.missionCargoStatus.payloadFinalizeSeq || 0) + 1;
    }
    window.missionCargoStatus.payloadMissionKey = manifestKey;
    window.missionCargoStatus.payloadBaseline = null;
    window.missionCargoStatus.payloadLayout = null;
    window.missionCargoStatus.payloadPlan = null;
    window.missionCargoStatus.payloadSyncQueued = '';
    window.missionCargoStatus.payloadSyncScheduledAt = 0;
    window.missionCargoStatus.payloadFinalizeRunning = false;
    window.missionCargoStatus.payloadStartOverride = false;
    window.missionCargoStatus.payloadPendingResetStations = null;
    window.missionCargoStatus.payloadPendingResetMaxStations = 0;
    window.missionCargoStatus.payloadPendingResetAdapter = '';
    window.missionCargoStatus.payloadPendingResetPa24State = null;
    window.missionCargoStatus.payloadVerification = null;
    window.missionCargoStatus.payloadVerificationRunning = false;
    if (manifestKey) window.missionCargoStatus.payloadNeedsSync = false;
}

function _missionCargoNormalizePayloadSnapshot(snapshot = null) {
    const raw = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if (!raw) return null;
    const rawCount = (raw.payloadStationCount ?? raw.sampledStationCount ?? (Array.isArray(raw.stations) ? raw.stations.length : 0));
    const stationCount = Math.max(1, Math.min(20, Math.round(Number(rawCount || 0))));
    if (!Number.isFinite(stationCount) || stationCount < 1) return null;
    const byIndex = new Map();
    const inputStations = Array.isArray(raw.stations) ? raw.stations : [];
    inputStations.forEach((row) => {
        const idx = Math.round(Number(row?.index));
        const w = Number(row?.weightLbs);
        if (!Number.isFinite(idx) || idx < 1 || idx > stationCount) return;
        byIndex.set(idx, Number.isFinite(w) ? Math.max(0, w) : 0);
    });
    const stations = [];
    for (let i = 1; i <= stationCount; i += 1) {
        stations.push({ index: i, weightLbs: Math.round((Number(byIndex.get(i) || 0)) * 10) / 10 });
    }
    const pa24Raw = raw.pa24 && typeof raw.pa24 === 'object' ? raw.pa24 : null;
    const pa24Seats = pa24Raw?.seats && typeof pa24Raw.seats === 'object' ? pa24Raw.seats : {};
    const pa24Weights = pa24Raw?.characterWeights && typeof pa24Raw.characterWeights === 'object'
        ? pa24Raw.characterWeights
        : {};
    const pa24 = pa24Raw ? {
        seats: {
            1: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[1] ?? pa24Seats['1'] ?? 0) || 0))),
            2: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[2] ?? pa24Seats['2'] ?? 0) || 0))),
            3: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[3] ?? pa24Seats['3'] ?? 0) || 0))),
            4: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[4] ?? pa24Seats['4'] ?? 0) || 0)))
        },
        characterWeights: {
            1: Math.max(0, Number(pa24Weights[1] ?? pa24Weights['1'] ?? 0) || 0),
            2: Math.max(0, Number(pa24Weights[2] ?? pa24Weights['2'] ?? 0) || 0),
            3: Math.max(0, Number(pa24Weights[3] ?? pa24Weights['3'] ?? 0) || 0),
            4: Math.max(0, Number(pa24Weights[4] ?? pa24Weights['4'] ?? 0) || 0)
        },
        baggageWeightLbs: Math.max(0, Number(pa24Raw.baggageWeightLbs || 0)),
        baggageAWeightLbs: Math.max(0, Number(pa24Raw.baggageAWeightLbs || 0)),
        baggageBWeightLbs: Math.max(0, Number(pa24Raw.baggageBWeightLbs || 0)),
        baggageCWeightLbs: Math.max(0, Number(pa24Raw.baggageCWeightLbs || 0)),
        payloadWeightLbs: Number.isFinite(Number(pa24Raw.payloadWeightLbs)) ? Number(pa24Raw.payloadWeightLbs) : null,
        totalWeightLbs: Number.isFinite(Number(pa24Raw.totalWeightLbs)) ? Number(pa24Raw.totalWeightLbs) : null,
        grossWeightLbs: Number.isFinite(Number(pa24Raw.grossWeightLbs)) ? Number(pa24Raw.grossWeightLbs) : null,
        emptyWeightLbs: Number.isFinite(Number(pa24Raw.emptyWeightLbs)) ? Number(pa24Raw.emptyWeightLbs) : null
    } : null;
    return {
        payloadAdapter: String(raw.payloadAdapter || 'msfs_payload_stations'),
        aircraft: raw.aircraft && typeof raw.aircraft === 'object' ? { ...raw.aircraft } : null,
        pa24,
        totalWeightLbs: Number.isFinite(Number(raw.totalWeightLbs)) ? Number(raw.totalWeightLbs) : null,
        emptyWeightLbs: Number.isFinite(Number(raw.emptyWeightLbs)) ? Number(raw.emptyWeightLbs) : null,
        fuelWeightLbs: Number.isFinite(Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs)) ? Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs) : null,
        payloadWeightLbs: Number.isFinite(Number(raw.payloadWeightLbs)) ? Number(raw.payloadWeightLbs) : null,
        payloadStationCount: stationCount,
        sampledStationCount: Math.max(stationCount, Math.min(20, Math.round(Number(raw.sampledStationCount || stationCount)))),
        stations
    };
}

function _missionCargoBuildPayloadLayout(snapshot = null) {
    const count = Math.max(1, Math.min(20, Math.round(Number(snapshot?.payloadStationCount ?? 1) || 1)));
    const allIndices = Array.from({ length: count }, (_, idx) => idx + 1);
    const pilotIndex = 1;
    const copilotIndex = count >= 2 ? 2 : 1;
    const rearSeatIndices = count >= 4 ? [3, 4] : (count === 3 ? [3] : []);
    const cargoIndices = count >= 5 ? allIndices.slice(4) : [];
    return { count, allIndices, pilotIndex, copilotIndex, rearSeatIndices, cargoIndices };
}

function _missionCargoItemIsBulky(item) {
    const weight = Number(item?.weightLbs || 0);
    const text = String(`${item?.label || ''} ${item?.storyName || ''} ${item?.objectTitle || ''}`).toLowerCase();
    if (weight >= 35) return true;
    return /(palette|pallet|kiste|sperrig|gross|box|netz|gurt|container|transport)/i.test(text);
}

function _missionCargoAllocateWeightToStations(map, stationIndices = [], totalWeightLbs = 0, splitAcross = 1) {
    const weight = Math.max(0, Number(totalWeightLbs) || 0);
    const slots = [...new Set((Array.isArray(stationIndices) ? stationIndices : [])
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1))];
    if (!weight || !slots.length) return [];
    const split = Math.max(1, Math.min(slots.length, Math.round(Number(splitAcross) || 1)));
    const chosen = slots.slice(0, split);
    const unit = weight / chosen.length;
    chosen.forEach((idx) => {
        map.set(idx, (Number(map.get(idx) || 0) + unit));
    });
    return chosen;
}

function _missionCargoBuildMissionExtraPlan(manifest, layout, options = {}) {
    const missionByStation = new Map();
    const assignments = [];
    const persistentOnly = options.persistentOnly === true;
    const passengerItems = persistentOnly
        ? []
        : (manifest?.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    let paxTotalLbs = passengerItems.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    let paxCount = passengerItems.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.passengerCount) || 1)), 0);
    if (paxTotalLbs <= 0) {
        const fallbackCount = _missionCargoBoardedPaxCount();
        if (fallbackCount > 0) {
            paxCount = fallbackCount;
            paxTotalLbs = fallbackCount * _missionCargoPaxWeightLbs();
        }
    }
    if (paxTotalLbs > 0) {
        _missionCargoAllocateWeightToStations(missionByStation, [layout.copilotIndex].concat(layout.rearSeatIndices), paxTotalLbs, Math.max(1, Math.min(1 + layout.rearSeatIndices.length, paxCount || 1)));
        assignments.push({ type: 'pax', label: paxCount > 1 ? `${paxCount} Passagiere` : 'Passagier', weightLbs: Math.round(paxTotalLbs), stations: [layout.copilotIndex].concat(layout.rearSeatIndices).slice(0, Math.max(1, Math.min(1 + layout.rearSeatIndices.length, paxCount || 1))) });
    }

    const loadedItems = (manifest?.items || [])
        .filter(item => item.status === 'loaded' && !_missionCargoIsPassengerItem(item))
        .filter(item => options.excludePersistent !== true || item.persistentEquipment !== true)
        .filter(item => !persistentOnly || item.persistentEquipment === true)
        .filter(item => options.includeInheritedPersistent === true || item.persistentEquipmentInherited !== true);
    const allNonPilotIndices = layout.allIndices.filter(idx => idx !== layout.pilotIndex);
    const cargoPrimary = layout.cargoIndices.length ? layout.cargoIndices : (layout.rearSeatIndices.length ? layout.rearSeatIndices : allNonPilotIndices);
    const nonCopilotCargo = cargoPrimary.filter(idx => idx !== layout.copilotIndex);
    const cargoFallback = nonCopilotCargo.length ? nonCopilotCargo : cargoPrimary;
    loadedItems.forEach((item) => {
        const itemWeight = Math.max(0, Number(item?.weightLbs || 0));
        if (!itemWeight) return;
        const bulky = _missionCargoItemIsBulky(item);
        const prefersRear = bulky && layout.rearSeatIndices.length > 0;
        const candidateSlots = prefersRear
            ? layout.rearSeatIndices
            : (cargoFallback.length ? cargoFallback : allNonPilotIndices);
        const splitAcross = (prefersRear && candidateSlots.length >= 2) ? 2 : 1;
        const usedStations = _missionCargoAllocateWeightToStations(missionByStation, candidateSlots, itemWeight, splitAcross);
        assignments.push({
            type: 'cargo',
            itemId: item.id,
            label: item.storyName || item.label || item.id || 'Cargo',
            weightLbs: Math.round(itemWeight),
            bulky,
            stations: usedStations
        });
    });
    return {
        missionByStation,
        assignments,
        loadedItems,
        paxCount,
        paxTotalLbs
    };
}

function _missionCargoDetachInheritedEquipmentFromBaseline(item = null) {
    if (!item || item.persistentEquipment !== true || item.persistentEquipmentInherited !== true) return false;
    const baseline = _missionCargoNormalizePayloadSnapshot(
        window.missionCargoStatus?.payloadBaseline || window.aircraftPayloadStatus?.snapshot
    );
    item.persistentEquipmentInherited = false;
    if (!baseline) return false;
    if (baseline.payloadAdapter === MISSION_CARGO_PA24_ADAPTER && baseline.pa24) {
        const removedLbs = Math.min(
            Math.max(0, Number(item.weightLbs || 0)),
            Math.max(0, Number(baseline.pa24.baggageWeightLbs || 0))
        );
        if (!removedLbs) return false;
        const nextBaseline = {
            ...baseline,
            totalWeightLbs: Number.isFinite(Number(baseline.totalWeightLbs))
                ? Math.max(0, Number(baseline.totalWeightLbs) - removedLbs)
                : null,
            payloadWeightLbs: Number.isFinite(Number(baseline.payloadWeightLbs))
                ? Math.max(0, Number(baseline.payloadWeightLbs) - removedLbs)
                : null,
            pa24: {
                ...baseline.pa24,
                baggageWeightLbs: Math.round(Math.max(
                    0,
                    Number(baseline.pa24.baggageWeightLbs || 0) - removedLbs
                ) * 10) / 10
            },
            stations: baseline.stations.map(row => ({
                ...row,
                weightLbs: row.index === 5
                    ? Math.round(Math.max(0, Number(row.weightLbs || 0) - removedLbs) * 10) / 10
                    : Number(row.weightLbs || 0)
            }))
        };
        window.missionCargoStatus.payloadBaseline = nextBaseline;
        window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(nextBaseline);
        window.missionCargoStatus.payloadPlan = null;
        return true;
    }
    const layout = _missionCargoBuildPayloadLayout(baseline);
    const plan = _missionCargoBuildMissionExtraPlan({
        items: [{ ...item, status: 'loaded', persistentEquipmentInherited: false }]
    }, layout, {
        persistentOnly: true,
        includeInheritedPersistent: true
    });
    const removedLbs = baseline.stations.reduce(
        (sum, row) => sum + Math.max(0, Number(plan.missionByStation.get(row.index) || 0)),
        0
    );
    const nextBaseline = {
        ...baseline,
        totalWeightLbs: Number.isFinite(Number(baseline.totalWeightLbs))
            ? Math.max(0, Number(baseline.totalWeightLbs) - removedLbs)
            : null,
        payloadWeightLbs: Number.isFinite(Number(baseline.payloadWeightLbs))
            ? Math.max(0, Number(baseline.payloadWeightLbs) - removedLbs)
            : null,
        stations: baseline.stations.map(row => ({
            index: row.index,
            weightLbs: Math.round(Math.max(
                0,
                Number(row.weightLbs || 0) - Number(plan.missionByStation.get(row.index) || 0)
            ) * 10) / 10
        }))
    };
    window.missionCargoStatus.payloadBaseline = nextBaseline;
    window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(nextBaseline);
    window.missionCargoStatus.payloadPlan = null;
    return removedLbs > 0;
}

const MISSION_CARGO_PA24_ADAPTER = 'pa24_accusim';
const MISSION_CARGO_PA24_BAGGAGE_MAX_LBS = 200;
const MISSION_CARGO_PA24_SEAT_MAX_LBS = 300;

function _missionCargoPa24StateFromSnapshot(snapshot = null) {
    const normalized = _missionCargoNormalizePayloadSnapshot(snapshot);
    if (!normalized || normalized.payloadAdapter !== MISSION_CARGO_PA24_ADAPTER || !normalized.pa24) return null;
    return {
        seats: {
            2: Number(normalized.pa24.seats?.[2] || 0),
            3: Number(normalized.pa24.seats?.[3] || 0),
            4: Number(normalized.pa24.seats?.[4] || 0)
        },
        characterWeights: {
            2: Number(normalized.pa24.characterWeights?.[2] || 0),
            3: Number(normalized.pa24.characterWeights?.[3] || 0),
            4: Number(normalized.pa24.characterWeights?.[4] || 0)
        },
        baggageWeightLbs: Math.round(Math.max(0, Number(normalized.pa24.baggageWeightLbs || 0)) * 10) / 10
    };
}

function _missionCargoBuildPa24PlanFromManifest(manifest, baseline, options = {}) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(baseline);
    const baselineState = _missionCargoPa24StateFromSnapshot(snapshot);
    if (!snapshot || !baselineState) return null;

    const persistentOnly = options.persistentOnly === true;
    const state = JSON.parse(JSON.stringify(baselineState));
    const assignments = [];
    const occupiedSeats = new Set();
    const occupiedCharacters = new Set();
    const changedSeats = new Set();
    [2, 3, 4].forEach((seat) => {
        const character = Math.round(Number(state.seats[seat] || 0));
        if (character > 0) {
            occupiedSeats.add(seat);
            occupiedCharacters.add(character);
        }
    });

    const assignSeat = (seat, weightLbs, assignment = {}) => {
        const weight = Math.round(Math.max(0, Number(weightLbs || 0)) * 10) / 10;
        if (!Number.isFinite(seat) || occupiedSeats.has(seat)) return { ok: false, error: 'pa24_no_free_seat' };
        if (!weight || weight > MISSION_CARGO_PA24_SEAT_MAX_LBS) {
            return { ok: false, error: 'pa24_seat_weight_exceeded' };
        }
        const preferredCharacter = seat;
        const character = !occupiedCharacters.has(preferredCharacter)
            ? preferredCharacter
            : [2, 3, 4].find(candidate => !occupiedCharacters.has(candidate));
        if (!Number.isFinite(character)) return { ok: false, error: 'pa24_no_free_character' };
        state.seats[seat] = character;
        state.characterWeights[character] = weight;
        occupiedSeats.add(seat);
        occupiedCharacters.add(character);
        changedSeats.add(seat);
        assignments.push({
            ...assignment,
            weightLbs: weight,
            stations: [seat],
            seat,
            character
        });
        return { ok: true, seat, character, weightLbs: weight };
    };

    const passengerItems = persistentOnly
        ? []
        : (manifest?.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    let paxCount = passengerItems.reduce(
        (sum, item) => sum + Math.max(1, Math.round(Number(item.passengerCount) || 1)),
        0
    );
    let paxTotalLbs = passengerItems.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    if (!persistentOnly && paxTotalLbs <= 0) {
        const fallbackCount = _missionCargoBoardedPaxCount();
        if (fallbackCount > 0) {
            paxCount = fallbackCount;
            paxTotalLbs = fallbackCount * _missionCargoPaxWeightLbs();
        }
    }
    if (paxCount > 0) {
        const unitWeight = paxTotalLbs / paxCount;
        for (let index = 0; index < paxCount; index += 1) {
            const seat = [2, 3, 4].find(candidate => !occupiedSeats.has(candidate));
            const result = assignSeat(seat, unitWeight, {
                type: 'pax',
                label: paxCount > 1 ? `Passagier ${index + 1}` : 'Passagier'
            });
            if (!result.ok) {
                return { payloadAdapter: MISSION_CARGO_PA24_ADAPTER, error: result.error, assignments };
            }
        }
    }

    const loadedItems = (manifest?.items || [])
        .filter(item => item.status === 'loaded' && !_missionCargoIsPassengerItem(item))
        .filter(item => options.excludePersistent !== true || item.persistentEquipment !== true)
        .filter(item => !persistentOnly || item.persistentEquipment === true)
        .filter(item => options.includeInheritedPersistent === true || item.persistentEquipmentInherited !== true);
    let baggageTargetLbs = Number(state.baggageWeightLbs || 0);
    for (const item of loadedItems) {
        const itemWeight = Math.round(Math.max(0, Number(item?.weightLbs || 0)) * 10) / 10;
        if (!itemWeight) continue;
        const bulky = _missionCargoItemIsBulky(item);
        if (!bulky && (baggageTargetLbs + itemWeight) <= MISSION_CARGO_PA24_BAGGAGE_MAX_LBS) {
            baggageTargetLbs += itemWeight;
            assignments.push({
                type: 'cargo',
                itemId: item.id,
                label: item.storyName || item.label || item.id || 'Cargo',
                weightLbs: itemWeight,
                bulky: false,
                stations: [5],
                baggage: true
            });
            continue;
        }
        const seat = [4, 3, 2].find(candidate => !occupiedSeats.has(candidate));
        const result = assignSeat(seat, itemWeight, {
            type: 'cargo',
            itemId: item.id,
            label: item.storyName || item.label || item.id || 'Cargo',
            bulky,
            baggage: false
        });
        if (!result.ok) {
            return { payloadAdapter: MISSION_CARGO_PA24_ADAPTER, error: result.error, assignments };
        }
    }
    state.baggageWeightLbs = Math.round(baggageTargetLbs * 10) / 10;

    const missionCargoWeightLbs = loadedItems.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    const missionWeightLbs = Math.round((paxTotalLbs + missionCargoWeightLbs) * 10) / 10;
    const targetTotalWeightLbs = Number.isFinite(Number(snapshot.totalWeightLbs))
        ? Number(snapshot.totalWeightLbs) + missionWeightLbs
        : null;
    const grossWeightLbs = Number(snapshot.pa24?.grossWeightLbs);
    if (Number.isFinite(targetTotalWeightLbs) && Number.isFinite(grossWeightLbs) && grossWeightLbs > 0 && targetTotalWeightLbs > grossWeightLbs + 0.5) {
        return {
            payloadAdapter: MISSION_CARGO_PA24_ADAPTER,
            error: 'pa24_gross_weight_exceeded',
            targetTotalWeightLbs,
            grossWeightLbs,
            assignments
        };
    }

    const baselineByStation = new Map(snapshot.stations.map(row => [Number(row.index), Number(row.weightLbs || 0)]));
    const stationTargets = [2, 3, 4, 5].map((index) => {
        let targetWeight = Number(baselineByStation.get(index) || 0);
        if (index >= 2 && index <= 4 && changedSeats.has(index) && Number(state.seats[index] || 0) > 0) {
            targetWeight = Number(state.characterWeights[state.seats[index]] || 0);
        }
        if (index === 5) targetWeight = state.baggageWeightLbs;
        const baselineWeight = Number(baselineByStation.get(index) || 0);
        return {
            index,
            baselineWeightLbs: Math.round(baselineWeight * 10) / 10,
            missionExtraLbs: Math.round((targetWeight - baselineWeight) * 10) / 10,
            weightLbs: Math.round(targetWeight * 10) / 10
        };
    });
    return {
        payloadAdapter: MISSION_CARGO_PA24_ADAPTER,
        snapshot,
        layout: _missionCargoBuildPayloadLayout(snapshot),
        stations: stationTargets,
        pa24State: state,
        pa24BaselineState: baselineState,
        assignments,
        boardedPaxCount: paxCount,
        paxWeightLbs: Math.round(paxTotalLbs * 10) / 10,
        cargoWeightLbs: Math.round(missionCargoWeightLbs * 10) / 10,
        missionWeightLbs,
        payloadWeightLbs: Number.isFinite(Number(snapshot.payloadWeightLbs))
            ? Math.round((Number(snapshot.payloadWeightLbs) + missionWeightLbs) * 10) / 10
            : null,
        targetTotalWeightLbs,
        grossWeightLbs: Number.isFinite(grossWeightLbs) ? grossWeightLbs : null
    };
}

function _missionCargoBuildPlanFromManifest(manifest, baseline) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(baseline);
    if (!snapshot) return null;
    if (snapshot.payloadAdapter === MISSION_CARGO_PA24_ADAPTER) {
        return _missionCargoBuildPa24PlanFromManifest(manifest, snapshot);
    }
    const layout = _missionCargoBuildPayloadLayout(snapshot);
    const missionPlan = _missionCargoBuildMissionExtraPlan(manifest, layout);
    const missionByStation = missionPlan.missionByStation;
    const assignments = missionPlan.assignments;
    const loadedItems = missionPlan.loadedItems;

    const stations = snapshot.stations.map((row) => {
        const missionExtra = Number(missionByStation.get(row.index) || 0);
        const baselineWeight = Number(row.weightLbs || 0);
        const targetWeight = Math.max(0, baselineWeight + missionExtra);
        return {
            index: row.index,
            baselineWeightLbs: Math.round(baselineWeight * 10) / 10,
            missionExtraLbs: Math.round(missionExtra * 10) / 10,
            weightLbs: Math.round(targetWeight * 10) / 10
        };
    });
    const payloadWeightLbs = stations.reduce((sum, row) => sum + Number(row.weightLbs || 0), 0);
    return {
        snapshot,
        layout,
        stations,
        assignments,
        boardedPaxCount: missionPlan.paxCount,
        paxWeightLbs: Math.round(missionPlan.paxTotalLbs),
        cargoWeightLbs: Math.round(loadedItems.reduce((sum, item) => sum + Number(item.weightLbs || 0), 0)),
        missionWeightLbs: Math.round(stations.reduce((sum, row) => sum + Number(row.missionExtraLbs || 0), 0)),
        payloadWeightLbs: Math.round(payloadWeightLbs * 10) / 10
    };
}

function _missionCargoComparePayloadStations(snapshot = null, targetStations = [], toleranceLbs = 1) {
    const normalized = _missionCargoNormalizePayloadSnapshot(snapshot);
    const targets = (Array.isArray(targetStations) ? targetStations : [])
        .map(row => ({
            index: Math.round(Number(row?.index)),
            weightLbs: Math.round(Math.max(0, Number(row?.weightLbs || 0)) * 10) / 10
        }))
        .filter(row => Number.isFinite(row.index) && row.index >= 1 && Number.isFinite(row.weightLbs));
    if (!normalized || !targets.length) {
        return { ok: false, reason: normalized ? 'no_targets' : 'no_snapshot', mismatches: [], checked: 0, maxDeltaLbs: null };
    }
    const byIndex = new Map((normalized.stations || []).map(row => [Math.round(Number(row.index)), Number(row.weightLbs)]));
    const tolerance = Math.max(0.25, Number(toleranceLbs) || 1);
    const mismatches = [];
    targets.forEach((target) => {
        const actual = byIndex.get(target.index);
        const delta = Number.isFinite(actual) ? (actual - target.weightLbs) : null;
        if (!Number.isFinite(actual) || Math.abs(delta) > tolerance) {
            mismatches.push({
                index: target.index,
                targetWeightLbs: target.weightLbs,
                actualWeightLbs: Number.isFinite(actual) ? Math.round(actual * 10) / 10 : null,
                deltaLbs: Number.isFinite(delta) ? Math.round(delta * 10) / 10 : null
            });
        }
    });
    const maxDelta = mismatches.reduce((max, row) => Math.max(max, Math.abs(Number(row.deltaLbs || 0))), 0);
    return {
        ok: mismatches.length === 0,
        reason: mismatches.length ? 'station_mismatch' : 'matched',
        mismatches,
        checked: targets.length,
        maxDeltaLbs: mismatches.length ? Math.round(maxDelta * 10) / 10 : 0
    };
}

function _missionCargoComparePa24State(snapshot = null, targetState = null, toleranceLbs = 1) {
    const normalized = _missionCargoNormalizePayloadSnapshot(snapshot);
    const target = targetState && typeof targetState === 'object' ? targetState : null;
    if (!normalized?.pa24 || !target) {
        return {
            ok: false,
            reason: normalized?.pa24 ? 'no_pa24_target' : 'no_pa24_snapshot',
            mismatches: [],
            checked: 0
        };
    }
    const targetSeats = target.seats && typeof target.seats === 'object' ? target.seats : {};
    const targetWeights = target.characterWeights && typeof target.characterWeights === 'object'
        ? target.characterWeights
        : {};
    const tolerance = Math.max(0.25, Number(toleranceLbs) || 1);
    const mismatches = [];
    let checked = 0;
    [2, 3, 4].forEach((seat) => {
        const expectedCharacter = Math.max(0, Math.min(4, Math.round(Number(targetSeats[seat] ?? targetSeats[String(seat)] ?? 0) || 0)));
        const actualCharacter = Math.max(0, Math.min(4, Math.round(Number(normalized.pa24.seats?.[seat] || 0) || 0)));
        checked += 1;
        if (actualCharacter !== expectedCharacter) {
            mismatches.push({
                field: `Seat${seat}Character`,
                seat,
                expected: expectedCharacter,
                actual: actualCharacter
            });
        }
        if (expectedCharacter <= 0) return;
        const expectedWeight = Number(targetWeights[expectedCharacter] ?? targetWeights[String(expectedCharacter)]);
        const actualWeight = Number(normalized.pa24.characterWeights?.[expectedCharacter]);
        checked += 1;
        if (!Number.isFinite(expectedWeight) || !Number.isFinite(actualWeight) || Math.abs(actualWeight - expectedWeight) > tolerance) {
            mismatches.push({
                field: `Character${expectedCharacter}Weight`,
                character: expectedCharacter,
                expected: Number.isFinite(expectedWeight) ? Math.round(expectedWeight * 10) / 10 : null,
                actual: Number.isFinite(actualWeight) ? Math.round(actualWeight * 10) / 10 : null
            });
        }
    });
    const expectedBaggage = Number(target.baggageWeightLbs);
    const actualBaggage = Number(normalized.pa24.baggageWeightLbs);
    if (Number.isFinite(expectedBaggage)) {
        checked += 1;
        if (!Number.isFinite(actualBaggage) || Math.abs(actualBaggage - expectedBaggage) > tolerance) {
            mismatches.push({
                field: 'BaggageWeight',
                expected: Math.round(expectedBaggage * 10) / 10,
                actual: Number.isFinite(actualBaggage) ? Math.round(actualBaggage * 10) / 10 : null
            });
        }
    }
    return {
        ok: mismatches.length === 0,
        reason: mismatches.length ? 'pa24_state_mismatch' : 'matched',
        mismatches,
        checked
    };
}

async function _missionCargoReassertPa24Seats(targetState = null, options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerDebugSetVar !== 'function') {
        return { status: 'skipped' };
    }
    const target = targetState && typeof targetState === 'object' ? targetState : null;
    const seats = target?.seats && typeof target.seats === 'object' ? target.seats : null;
    if (!seats) return { status: 'no_pa24_target' };
    const revision = Math.max(0, Math.round(Number(options.revision || 0)));
    const isCurrentRevision = () => !revision || _missionCargoPayloadSyncIsCurrentRevision(revision);
    const delayMs = Math.max(0, Number(options.delayMs ?? MISSION_CARGO_PA24_SEAT_REASSERT_DELAY_MS) || 0);
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (!isCurrentRevision()) {
        return { status: 'superseded', reason: 'newer_payload_state_pending', revision };
    }
    const applied = [];
    for (const seat of [2, 3, 4]) {
        const character = Math.max(0, Math.min(4, Math.round(Number(seats[seat] ?? seats[String(seat)] ?? 0) || 0)));
        if (character <= 0) continue;
        const ack = await window.trackerDebugSetVar({
            name: `L:Seat${seat}Character`,
            value: character,
            units: 'enum',
            reason: options.reason || 'pa24-payload-seat-reassert',
            timeoutMs: Number(options.timeoutMs) || 7000
        });
        if (!isCurrentRevision()) {
            return { status: 'superseded', reason: 'newer_payload_state_pending', revision, applied };
        }
        if (ack?.status !== 'ok' && ack?.status !== 'noop') {
            return {
                status: 'error',
                reason: ack?.error || ack?.status || 'pa24_seat_reassert_failed',
                seat,
                character,
                applied
            };
        }
        applied.push({ seat, character });
    }
    return { status: 'ok', applied };
}

async function _missionCargoVerifyPayloadStable(targetStations = [], options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadGet !== 'function') {
        return { status: 'skipped' };
    }
    const targets = (Array.isArray(targetStations) ? targetStations : [])
        .map(row => ({
            index: Math.round(Number(row?.index)),
            weightLbs: Math.round(Math.max(0, Number(row?.weightLbs || 0)) * 10) / 10
        }))
        .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 20 && Number.isFinite(row.weightLbs));
    if (!targets.length) return { status: 'no_targets' };
    const delays = Array.isArray(options.delaysMs) && options.delaysMs.length
        ? options.delaysMs
        : [900, 2400];
    const maxStations = Math.max(1, Math.min(20, Math.round(Number(options.maxStations || targets.length || 12)) || 12));
    const startedAt = Date.now();
    const revision = Math.max(0, Math.round(Number(options.revision || 0)));
    const isCurrentRevision = () => !revision || _MISSION_CARGO_PAYLOAD_SYNC_QUEUE.revision === revision;
    const pa24TargetState = options.pa24State && typeof options.pa24State === 'object'
        ? options.pa24State
        : null;
    let lastAck = null;
    let lastCheck = null;
    let lastPa24Check = null;
    let pa24ReassertAttempts = 0;
    const renderStatus = () => {
        if (document.getElementById('missionCargoOverlay')?.style.display !== 'flex') return;
        const mode = window.missionCargoStatus?.lastMode === 'unload'
            ? 'unload'
            : (window.missionCargoStatus?.lastMode === 'pickup' ? 'pickup' : 'load');
        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
    };
    window.missionCargoStatus.payloadVerificationRunning = true;
    window.missionCargoStatus.payloadVerification = {
        status: 'running',
        reason: options.reason || 'payload-stability-check',
        startedAt
    };
    renderStatus();
    try {
        for (const delayMs of delays) {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, Number(delayMs) || 0)));
            if (!isCurrentRevision()) {
                const result = {
                    status: 'superseded',
                    reason: 'newer_payload_state_pending',
                    elapsedMs: Date.now() - startedAt,
                    revision
                };
                window.missionCargoStatus.payloadVerification = null;
                window.missionCargoStatus.payloadVerificationRunning = false;
                renderStatus();
                return result;
            }
            lastAck = await _missionCargoRefreshPayloadSnapshot({
                force: true,
                maxStations,
                timeoutMs: Number(options.timeoutMs) || 12000
            });
            if (!isCurrentRevision()) {
                const result = {
                    status: 'superseded',
                    reason: 'newer_payload_state_pending',
                    elapsedMs: Date.now() - startedAt,
                    revision
                };
                window.missionCargoStatus.payloadVerification = null;
                window.missionCargoStatus.payloadVerificationRunning = false;
                renderStatus();
                return result;
            }
            const snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
            lastCheck = _missionCargoComparePayloadStations(snapshot, targets, options.toleranceLbs || 1);
            lastPa24Check = pa24TargetState
                ? _missionCargoComparePa24State(snapshot, pa24TargetState, options.toleranceLbs || 1)
                : null;
            if (lastCheck.ok && (!lastPa24Check || lastPa24Check.ok)) continue;
            if (lastCheck.ok && lastPa24Check && !lastPa24Check.ok && pa24ReassertAttempts < 1) {
                pa24ReassertAttempts += 1;
                const reassertAck = await _missionCargoReassertPa24Seats(pa24TargetState, {
                    revision,
                    delayMs: 0,
                    reason: 'pa24-payload-seat-verify-retry',
                    timeoutMs: Number(options.timeoutMs) || 12000
                });
                if (reassertAck?.status === 'superseded') {
                    window.missionCargoStatus.payloadVerification = null;
                    window.missionCargoStatus.payloadVerificationRunning = false;
                    renderStatus();
                    return reassertAck;
                }
                continue;
            }
            break;
        }
        const stable = !!lastCheck?.ok && (!lastPa24Check || lastPa24Check.ok);
        const result = {
            status: stable ? 'ok' : 'unstable',
            reason: stable ? 'stable' : (lastPa24Check?.reason || lastCheck?.reason || lastAck?.error || lastAck?.status || 'payload_unstable'),
            elapsedMs: Date.now() - startedAt,
            check: lastCheck,
            pa24Check: lastPa24Check,
            pa24ReassertAttempts,
            lastAckStatus: lastAck?.status || null,
            maxStations
        };
        window.missionCargoStatus.payloadVerification = result;
        window.missionCargoStatus.payloadVerificationRunning = false;
        renderStatus();
        return result;
    } catch (err) {
        const result = {
            status: 'unstable',
            reason: err?.message || String(err) || 'payload_verification_failed',
            elapsedMs: Date.now() - startedAt,
            check: lastCheck,
            pa24Check: lastPa24Check,
            pa24ReassertAttempts,
            lastAckStatus: lastAck?.status || null,
            maxStations
        };
        window.missionCargoStatus.payloadVerification = result;
        window.missionCargoStatus.payloadVerificationRunning = false;
        renderStatus();
        return result;
    } finally {
        window.missionCargoStatus.payloadVerificationRunning = false;
    }
}

function _missionCargoStorePayloadBaselineIfNeeded(snapshot, manifestKey = '') {
    const normalized = _missionCargoNormalizePayloadSnapshot(snapshot);
    if (!normalized) return null;
    _missionCargoResetPayloadPlanForMissionKey(manifestKey);
    if (!window.missionCargoStatus.payloadBaseline
        || Number(window.missionCargoStatus.payloadBaseline?.payloadStationCount || 0) !== Number(normalized.payloadStationCount || 0)
        || String(window.missionCargoStatus.payloadBaseline?.payloadAdapter || '') !== String(normalized.payloadAdapter || '')
        || String(window.missionCargoStatus.payloadBaseline?.aircraft?.title || '') !== String(normalized.aircraft?.title || '')) {
        window.missionCargoStatus.payloadBaseline = normalized;
        window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(normalized);
    }
    return _missionCargoMergeFuelIntoPayloadBaseline(window.lastLiveFlightData);
}

function _missionCargoMergeFuelIntoPayloadBaseline(source = null) {
    const baseline = _missionCargoNormalizePayloadSnapshot(window.missionCargoStatus?.payloadBaseline);
    const fuelWeightLbs = Number(source?.fuelWeightLbs);
    if (!baseline || !Number.isFinite(fuelWeightLbs) || fuelWeightLbs < 0) return baseline;
    const previousFuelWeightLbs = baseline.fuelWeightLbs == null ? Number.NaN : Number(baseline.fuelWeightLbs);
    if (!Number.isFinite(previousFuelWeightLbs)) {
        const nextBaseline = {
            ...baseline,
            fuelWeightLbs: Math.round(fuelWeightLbs * 10) / 10
        };
        window.missionCargoStatus.payloadBaseline = nextBaseline;
        return nextBaseline;
    }
    const fuelDeltaLbs = fuelWeightLbs - previousFuelWeightLbs;
    if (Math.abs(fuelDeltaLbs) <= 0.05) return baseline;
    const nextBaseline = {
        ...baseline,
        fuelWeightLbs: Math.round(fuelWeightLbs * 10) / 10,
        totalWeightLbs: baseline.totalWeightLbs != null && Number.isFinite(Number(baseline.totalWeightLbs))
            ? Math.round((Number(baseline.totalWeightLbs) + fuelDeltaLbs) * 10) / 10
            : null,
        pa24: baseline.pa24 ? {
            ...baseline.pa24,
            totalWeightLbs: baseline.pa24.totalWeightLbs != null && Number.isFinite(Number(baseline.pa24.totalWeightLbs))
                ? Math.round((Number(baseline.pa24.totalWeightLbs) + fuelDeltaLbs) * 10) / 10
                : baseline.pa24.totalWeightLbs
        } : null
    };
    window.missionCargoStatus.payloadBaseline = nextBaseline;
    window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(nextBaseline);
    return nextBaseline;
}

function _missionCargoMergeFuelIntoCurrentSnapshot(source = null) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    const fuelWeightLbs = Number(source?.fuelWeightLbs);
    if (!snapshot || !Number.isFinite(fuelWeightLbs) || fuelWeightLbs < 0) return snapshot;
    const previousFuelWeightLbs = snapshot.fuelWeightLbs == null ? Number.NaN : Number(snapshot.fuelWeightLbs);
    if (!Number.isFinite(previousFuelWeightLbs)) {
        const nextSnapshot = {
            ...snapshot,
            fuelWeightLbs: Math.round(fuelWeightLbs * 10) / 10
        };
        window.aircraftPayloadStatus.snapshot = nextSnapshot;
        return nextSnapshot;
    }
    if (Math.abs(fuelWeightLbs - previousFuelWeightLbs) <= 0.05) {
        return snapshot;
    }
    const fuelDeltaLbs = fuelWeightLbs - previousFuelWeightLbs;
    const nextSnapshot = {
        ...snapshot,
        fuelWeightLbs: Math.round(fuelWeightLbs * 10) / 10,
        totalWeightLbs: snapshot.totalWeightLbs != null && Number.isFinite(Number(snapshot.totalWeightLbs))
            ? Math.round((Number(snapshot.totalWeightLbs) + fuelDeltaLbs) * 10) / 10
            : snapshot.totalWeightLbs,
        pa24: snapshot.pa24 ? {
            ...snapshot.pa24,
            totalWeightLbs: snapshot.pa24.totalWeightLbs != null && Number.isFinite(Number(snapshot.pa24.totalWeightLbs))
                ? Math.round((Number(snapshot.pa24.totalWeightLbs) + fuelDeltaLbs) * 10) / 10
                : snapshot.pa24.totalWeightLbs
        } : null
    };
    window.aircraftPayloadStatus.snapshot = nextSnapshot;
    return nextSnapshot;
}

function _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshotNow) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(snapshotNow);
    if (!snapshot) return [];
    const layout = _missionCargoBuildPayloadLayout(snapshot);
    const missionPlan = _missionCargoBuildMissionExtraPlan(manifestBeforeReset, layout, {
        excludePersistent: true,
        includeInheritedPersistent: true
    });
    return snapshot.stations.map((row) => {
        const missionExtra = Number(missionPlan.missionByStation.get(row.index) || 0);
        const currentWeight = Math.max(0, Number(row.weightLbs || 0));
        return {
            index: row.index,
            weightLbs: Math.round(Math.max(0, currentWeight - missionExtra) * 10) / 10
        };
    });
}

function _missionCargoEstimatePersistentStationsFromBaseline(manifestBeforeReset, baselineSnapshot) {
    const baseline = _missionCargoNormalizePayloadSnapshot(baselineSnapshot);
    if (!baseline) return [];
    const layout = _missionCargoBuildPayloadLayout(baseline);
    const persistentPlan = _missionCargoBuildMissionExtraPlan(manifestBeforeReset, layout, {
        persistentOnly: true
    });
    return baseline.stations.map(row => ({
        index: row.index,
        weightLbs: Math.round(Math.max(
            0,
            Number(row.weightLbs || 0) + Number(persistentPlan.missionByStation.get(row.index) || 0)
        ) * 10) / 10
    }));
}

function _missionCargoResetManifestState(manifest) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    const storedItems = _missionCargoStoredEquipmentItems(manifest.aircraftSlot);
    let changed = false;
    manifest.items.forEach((item) => {
        const stored = item.persistentEquipment === true ? storedItems[item.id] : null;
        const nextStatus = stored?.onboard === true ? 'loaded' : 'pending';
        if (item.status !== nextStatus) changed = true;
        item.status = nextStatus;
        if (item.loadedAt || item.unloadedAt || item.droppedAt) changed = true;
        item.loadedAt = nextStatus === 'loaded' ? (Number(stored?.loadedAt || 0) || Date.now()) : 0;
        item.unloadedAt = 0;
        item.droppedAt = 0;
        if (_missionCargoIsPassengerHandoffLocked(item)) changed = true;
        item.handoffComplete = false;
        item.handedOffAt = 0;
        const inherited = nextStatus === 'loaded' && item.persistentEquipment === true;
        if (item.persistentEquipmentInherited !== inherited) changed = true;
        item.persistentEquipmentInherited = inherited;
        if (Number.isFinite(Number(item.droppedLat)) || Number.isFinite(Number(item.droppedLon)) || Number.isFinite(Number(item.droppedAltFt))) changed = true;
        item.droppedLat = null;
        item.droppedLon = null;
        item.droppedAltFt = null;
        if (Number.isFinite(Number(item.unloadLat)) || Number.isFinite(Number(item.unloadLon)) || Number.isFinite(Number(item.unloadAltFt))) changed = true;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        if (Number(item.healthPct) !== 100) changed = true;
        item.healthPct = 100;
        if (item.log && Object.keys(item.log).length) changed = true;
        item.log = {};
    });
    if (Number(manifest.maxStressDamagePct || 0) !== 0) changed = true;
    manifest.maxStressDamagePct = 0;
    if (manifest.dispatchSignature) changed = true;
    manifest.dispatchSignature = null;
    return changed;
}

async function _missionCargoResetForMissionReset(reason = 'mission-runtime-reset') {
    if (missionCargoManualPaxRollbackTimer) clearTimeout(missionCargoManualPaxRollbackTimer);
    missionCargoManualPaxRollbackTimer = null;
    window.missionCargoStatus.manualPaxPending = null;
    window.missionCargoStatus.payloadFinalizeRunning = false;
    window.missionCargoStatus.payloadFinalizeSeq = Number(window.missionCargoStatus.payloadFinalizeSeq || 0) + 1;
    window.missionCargoStatus.payloadStartOverride = false;
    _missionCargoCancelVisibleItemActions();
    _missionCargoCancelPayloadSyncQueue(reason);
    if (window.missionCargoStatus.payloadSyncRunning) {
        const waitUntil = Date.now() + 2600;
        while (window.missionCargoStatus.payloadSyncRunning && Date.now() < waitUntil) {
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }
    window.missionCargoStatus.payloadSyncQueued = '';
    let manifest = _missionCargoGetManifest();
    if ((!manifest || !Array.isArray(manifest.items)) && _missionCargoHasActiveMission()) {
        manifest = _missionCargoEnsureManifest();
    }
    if (!manifest || !Array.isArray(manifest.items) || !manifest.items.length) {
        _missionCargoResetPayloadPlanForMissionKey('');
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadPendingResetAdapter = '';
        window.missionCargoStatus.payloadPendingResetPa24State = null;
        window.missionCargoStatus.payloadNeedsSync = false;
        return { status: 'no_manifest' };
    }
    const manifestBeforeReset = JSON.parse(JSON.stringify(manifest));
    const baseline = _missionCargoNormalizePayloadSnapshot(window.missionCargoStatus?.payloadBaseline);
    let snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    if (!snapshot && !window.simModeActive && window.liveTrackerConnected && typeof window.trackerPayloadGet === 'function') {
        const ack = await _missionCargoRefreshPayloadSnapshot({ force: true, maxStations: 12, timeoutMs: 12000 });
        if (ack?.status === 'ok' || ack?.status === 'cached') snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    }
    let targetStations = [];
    let targetMaxStations = 0;
    let targetAdapter = '';
    let targetPa24State = null;
    const hasLoadedPersistentEquipment = manifestBeforeReset.items.some(
        item => item?.persistentEquipment === true && item.status === 'loaded'
    );
    if (baseline?.payloadAdapter === MISSION_CARGO_PA24_ADAPTER && baseline?.pa24) {
        const resetPlan = _missionCargoBuildPa24PlanFromManifest(
            hasLoadedPersistentEquipment ? manifestBeforeReset : { items: [] },
            baseline,
            { persistentOnly: true }
        );
        if (resetPlan?.error || !resetPlan?.pa24State) {
            window.missionCargoStatus.payloadNeedsSync = true;
            window.missionCargoStatus.error = resetPlan?.error || 'pa24_reset_plan_failed';
            return { status: 'pa24_reset_plan_failed', error: window.missionCargoStatus.error };
        }
        targetStations = resetPlan.stations || [];
        targetMaxStations = baseline.sampledStationCount || baseline.payloadStationCount || 20;
        targetAdapter = MISSION_CARGO_PA24_ADAPTER;
        targetPa24State = resetPlan.pa24State;
    } else if (snapshot && hasLoadedPersistentEquipment) {
        targetStations = _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshot);
        targetMaxStations = snapshot.sampledStationCount || snapshot.payloadStationCount || targetStations.length;
    } else if (baseline && Array.isArray(baseline.stations) && baseline.stations.length && (!snapshot || baseline.payloadStationCount === snapshot.payloadStationCount)) {
        targetStations = hasLoadedPersistentEquipment
            ? _missionCargoEstimatePersistentStationsFromBaseline(manifestBeforeReset, baseline)
            : baseline.stations.map(row => ({ index: row.index, weightLbs: Math.max(0, Number(row.weightLbs || 0)) }));
        targetMaxStations = baseline.sampledStationCount || baseline.payloadStationCount || targetStations.length;
    } else if (snapshot) {
        targetStations = _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshot);
        targetMaxStations = snapshot.sampledStationCount || snapshot.payloadStationCount || targetStations.length;
    }

    const changed = _missionCargoResetManifestState(manifest);
    if (changed) _missionCargoPersistManifest(manifest);
    _missionCargoResetPayloadPlanForMissionKey('');
    window.missionCargoStatus.payloadPendingResetStations = targetStations.length ? targetStations : null;
    window.missionCargoStatus.payloadPendingResetMaxStations = targetMaxStations || 0;
    window.missionCargoStatus.payloadPendingResetAdapter = targetAdapter;
    window.missionCargoStatus.payloadPendingResetPa24State = targetPa24State;
    window.missionCargoStatus.payloadNeedsSync = !!window.missionCargoStatus.payloadPendingResetStations;

    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function' || !targetStations.length) {
        return { status: changed ? 'reset_app_only' : 'noop' };
    }

    const setAck = await window.trackerPayloadSet(targetStations, {
        maxStations: targetMaxStations || 12,
        timeoutMs: 15000,
        refreshAfter: true,
        payloadAdapter: targetAdapter,
        pa24State: targetPa24State
    });
    if (setAck?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadPendingResetAdapter = '';
        window.missionCargoStatus.payloadPendingResetPa24State = null;
        window.missionCargoStatus.payloadBaseline = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
        window.missionCargoStatus.payloadLayout = window.missionCargoStatus.payloadBaseline ? _missionCargoBuildPayloadLayout(window.missionCargoStatus.payloadBaseline) : null;
        window.missionCargoStatus.payloadPlan = null;
        window.missionCargoStatus.payloadSyncAt = Date.now();
        return { status: changed ? 'reset_app_and_sim' : 'sim_synced', ack: setAck };
    }
    window.missionCargoStatus.payloadNeedsSync = true;
    return { status: 'sim_reset_failed', ack: setAck };
}

async function _missionCargoApplyPendingResetStations(reason = 'payload-pending-reset') {
    const rows = Array.isArray(window.missionCargoStatus?.payloadPendingResetStations) ? window.missionCargoStatus.payloadPendingResetStations : [];
    const payloadAdapter = String(window.missionCargoStatus?.payloadPendingResetAdapter || '');
    const pa24State = window.missionCargoStatus?.payloadPendingResetPa24State || null;
    if (!rows.length && !pa24State) return { status: 'no_pending_reset' };
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') return { status: 'skipped' };
    const ack = await window.trackerPayloadSet(rows, {
        maxStations: Math.max(1, Number(window.missionCargoStatus?.payloadPendingResetMaxStations || rows.length) || rows.length),
        timeoutMs: 15000,
        refreshAfter: true,
        payloadAdapter,
        pa24State
    });
    if (ack?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadPendingResetAdapter = '';
        window.missionCargoStatus.payloadPendingResetPa24State = null;
        window.missionCargoStatus.payloadBaseline = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
        window.missionCargoStatus.payloadLayout = window.missionCargoStatus.payloadBaseline ? _missionCargoBuildPayloadLayout(window.missionCargoStatus.payloadBaseline) : null;
        window.missionCargoStatus.payloadPlan = null;
        window.missionCargoStatus.payloadSyncAt = Date.now();
    } else {
        window.missionCargoStatus.payloadNeedsSync = true;
    }
    return ack || { status: 'unknown' };
}

function _missionCargoFormatStationList(indices = []) {
    const list = [...new Set((Array.isArray(indices) ? indices : [])
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1))];
    return list.length ? list.join(', ') : '-';
}

function _missionCargoFormatSheetStationAssignment(indices = [], payloadAdapter = '') {
    const stations = [...new Set((Array.isArray(indices) ? indices : [])
        .map(value => Math.round(Number(value)))
        .filter(value => Number.isFinite(value) && value >= 1))];
    if (!stations.length) return '-';
    if (String(payloadAdapter || '') !== MISSION_CARGO_PA24_ADAPTER) {
        return stations.join('/');
    }
    const pa24Labels = {
        2: 'Sitz 2',
        3: 'Sitz 3',
        4: 'Sitz 4',
        5: 'Gepäckfach'
    };
    return stations.map(station => pa24Labels[station] || `S${station}`).join(' / ');
}

function _missionCargoGroupPayloadAssignmentStations(plan = null) {
    const grouped = new Map();
    (Array.isArray(plan?.assignments) ? plan.assignments : [])
        .filter(row => (row?.type === 'cargo' && row?.itemId) || row?.type === 'pax')
        .forEach((row) => {
            const key = row?.itemId ? String(row.itemId) : 'mission-passenger';
            const stations = grouped.get(key) || [];
            (Array.isArray(row?.stations) ? row.stations : []).forEach((station) => {
                const normalized = Math.round(Number(station));
                if (Number.isFinite(normalized) && normalized >= 1 && !stations.includes(normalized)) {
                    stations.push(normalized);
                }
            });
            grouped.set(key, stations);
        });
    return grouped;
}

function _missionCargoRememberPayloadAssignments(manifest = null, plan = null) {
    if (!manifest || !Array.isArray(manifest.items) || plan?.error) return false;
    const grouped = _missionCargoGroupPayloadAssignmentStations(plan);
    if (!grouped.size) return false;
    const payloadAdapter = String(plan?.payloadAdapter || '');
    let changed = false;
    grouped.forEach((stations, key) => {
        const targets = manifest.items.filter(item => (
            String(item?.id || '') === key
            || (key === 'mission-passenger' && _missionCargoIsPassengerItem(item) && item.status === 'loaded')
        ));
        targets.forEach((item) => {
            const previous = Array.isArray(item.payloadStations)
                ? item.payloadStations.map(value => Math.round(Number(value))).filter(Number.isFinite)
                : [];
            const sameStations = previous.length === stations.length
                && previous.every((value, index) => value === stations[index]);
            if (sameStations && String(item.payloadStationAdapter || '') === payloadAdapter) return;
            item.payloadStations = [...stations];
            item.payloadStationAdapter = payloadAdapter;
            changed = true;
        });
    });
    if (changed) _missionCargoPersistManifest(manifest);
    return changed;
}

function _missionCargoPayloadStatusMessageHtml() {
    const verification = window.missionCargoStatus?.payloadVerification || null;
    const running = !!window.missionCargoStatus?.payloadVerificationRunning;
    if (running || verification?.status === 'running') {
        return '<div class="mission-cargo-payload-message is-pending">Sim-Zuladung wird nach dem Setzen erneut geprueft ...</div>';
    }
    if (window.missionCargoStatus?.payloadSyncRunning) {
        return '<div class="mission-cargo-payload-message is-pending">Aktueller Ladezustand wird an den Simulator uebertragen ...</div>';
    }
    if (window.missionCargoStatus?.payloadSyncQueued) {
        return '<div class="mission-cargo-payload-message is-pending">Ladeaenderungen werden kurz gebuendelt ...</div>';
    }
    if (verification?.status === 'unstable') {
        const plan = window.missionCargoStatus?.payloadPlan || null;
        const missionWeight = Number(plan?.missionWeightLbs);
        const stationTargets = (Array.isArray(plan?.stations) ? plan.stations : [])
            .filter(row => Number.isFinite(Number(row?.weightLbs)))
            .map(row => `S${Math.round(Number(row.index) || 0)} ${Math.round(Number(row.weightLbs))} lbs`)
            .join(' · ');
        const weightHint = Number.isFinite(missionWeight)
            ? ` Missionszuladung: ${Math.round(missionWeight)} lbs.`
            : '';
        const stationHint = stationTargets ? ` Zielwerte: ${stationTargets}.` : '';
        return `<div class="mission-cargo-payload-message is-warn">Die automatische Sim-Zuladung ist bei diesem Flugzeug nicht moeglich.${weightHint}${stationHint} Wenn du die Zuladung im Simulator abbilden moechtest, setze diese Werte bitte manuell im Weight-&amp;-Balance- oder Tablet-Menue. Die Mission kann trotzdem gestartet werden.</div>`;
    }
    if (verification?.status === 'ok') {
        return '<div class="mission-cargo-payload-message is-ok">Sim-Zuladung stabil uebernommen.</div>';
    }
    const error = String(window.missionCargoStatus?.error || window.aircraftPayloadStatus?.error || '').trim();
    if (window.missionCargoStatus?.payloadNeedsSync && error) {
        const errorMessages = {
            payload_unstable_aircraft_override: 'Sim-Zuladung wurde vom Flugzeug wieder ueberschrieben.',
            pa24_no_free_seat: 'In der Comanche ist kein freier Sitz fuer die geplante Zuladung vorhanden.',
            pa24_no_free_character: 'In der Comanche ist keine freie Character-Zuordnung fuer die geplante Zuladung vorhanden.',
            pa24_seat_weight_exceeded: `Eine einzelne Fracht ueberschreitet das Sitzlimit von ${MISSION_CARGO_PA24_SEAT_MAX_LBS} lbs.`,
            pa24_gross_weight_exceeded: 'Die geplante Zuladung wuerde das zulaessige Gesamtgewicht der Comanche ueberschreiten.'
        };
        const text = errorMessages[error] || `Sim-Zuladung noch nicht synchron (${error}).`;
        return `<div class="mission-cargo-payload-message is-warn">${_missionCargoEscape(text)}</div>`;
    }
    return '';
}

function _missionCargoPayloadRequestedWeights(manifest = null) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    const passengers = items.filter(item => item.status === 'loaded' && _missionCargoIsPassengerItem(item));
    const cargo = items
        .filter(item => item.status === 'loaded' && !_missionCargoIsPassengerItem(item))
        .filter(item => item.persistentEquipmentInherited !== true);
    const paxCount = passengers.reduce(
        (sum, item) => sum + Math.max(1, Math.round(Number(item.passengerCount) || 1)),
        0
    );
    let paxWeightLbs = passengers.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    if (paxCount > 0 && paxWeightLbs <= 0) paxWeightLbs = paxCount * _missionCargoPaxWeightLbs();
    const cargoWeightLbs = cargo.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    return {
        paxWeightLbs: Math.round(paxWeightLbs * 10) / 10,
        cargoWeightLbs: Math.round(cargoWeightLbs * 10) / 10,
        missionWeightLbs: Math.round((paxWeightLbs + cargoWeightLbs) * 10) / 10
    };
}

function _missionCargoPayloadSummaryHtml(mode = 'load') {
    const snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    if (!snapshot) {
        const trackerConnected = !!window.liveTrackerConnected;
        const fd = window.lastLiveFlightData || {};
        const simRunning = Number(fd?.simRunning);
        const payloadError = String(window.aircraftPayloadStatus?.error || '').trim();
        const lastCommandAt = Number(window.aircraftPayloadStatus?.lastCommandAt || 0);
        const lastSnapshotAt = Number(window.aircraftPayloadStatus?.lastSnapshotAt || 0);
        const waitingForReply = lastCommandAt > 0 && lastSnapshotAt < lastCommandAt;
        const waitingAgeMs = waitingForReply ? (Date.now() - lastCommandAt) : 0;
        let message = 'Noch keine Sim-Gewichte empfangen.';
        if (!trackerConnected) message = 'Tracker nicht verbunden. Sim-Gewichte werden nicht abgefragt.';
        else if (Number.isFinite(simRunning) && simRunning === 0) message = 'Simulator liefert aktuell keine Live-Daten.';
        else if (payloadError) message = `Sim-Gewichte nicht verfügbar (${payloadError}).`;
        else if (waitingForReply && waitingAgeMs < 14000) message = 'Sim-Gewichte werden abgerufen ...';
        else if (waitingForReply) message = 'Abruf der Sim-Gewichte fehlgeschlagen oder abgelaufen.';
        return `<div class="mission-cargo-payload-empty">${_missionCargoEscape(message)}</div>`;
    }
    const layout = window.missionCargoStatus.payloadLayout || _missionCargoBuildPayloadLayout(snapshot);
    const plan = window.missionCargoStatus.payloadPlan;
    const liveFuelWeight = Number(window.lastLiveFlightData?.fuelWeightLbs);
    const fuelWeight = Number.isFinite(liveFuelWeight) ? liveFuelWeight : Number(snapshot.fuelWeightLbs);
    const requestedWeights = _missionCargoPayloadRequestedWeights(_missionCargoGetManifest());
    const paxWeight = Number.isFinite(Number(plan?.paxWeightLbs))
        ? Number(plan.paxWeightLbs)
        : requestedWeights.paxWeightLbs;
    const cargoWeight = Number.isFinite(Number(plan?.cargoWeightLbs))
        ? Number(plan.cargoWeightLbs)
        : requestedWeights.cargoWeightLbs;
    const missionExtra = Number.isFinite(Number(plan?.missionWeightLbs))
        ? Number(plan.missionWeightLbs)
        : requestedWeights.missionWeightLbs;
    const paxPart = Number.isFinite(paxWeight) ? `Pax ${Math.round(paxWeight)} lbs` : 'Pax n/a';
    const cargoPart = Number.isFinite(cargoWeight) ? `Cargo ${Math.round(cargoWeight)} lbs` : 'Cargo n/a';
    if (snapshot.payloadAdapter === MISSION_CARGO_PA24_ADAPTER) {
        const maximumWeight = Number.isFinite(Number(plan?.grossWeightLbs))
            ? Number(plan.grossWeightLbs)
            : Number(snapshot.pa24?.grossWeightLbs);
        const totalWeight = Number.isFinite(Number(snapshot.totalWeightLbs))
            ? Number(snapshot.totalWeightLbs)
            : Number(snapshot.pa24?.totalWeightLbs);
        const emptyWeight = Number.isFinite(Number(snapshot.emptyWeightLbs))
            ? Number(snapshot.emptyWeightLbs)
            : Number(snapshot.pa24?.emptyWeightLbs);
        return `
            <div class="mission-cargo-payload-summary is-pa24">
                <div class="mission-cargo-payload-metrics">
                    <span><small>Max. Gewicht</small><strong>${Number.isFinite(maximumWeight) ? Math.round(maximumWeight) : '—'} lbs</strong></span>
                    <span><small>PAX</small><strong>${Number.isFinite(paxWeight) ? Math.round(paxWeight) : '—'} lbs</strong></span>
                    <span><small>Payload</small><strong>${Number.isFinite(cargoWeight) ? Math.round(cargoWeight) : '—'} lbs</strong></span>
                    <span><small>Fuel</small><strong>${Number.isFinite(fuelWeight) ? Math.round(fuelWeight) : '—'} lbs</strong></span>
                    <span class="is-half"><small>Gesamt</small><strong>${Number.isFinite(totalWeight) ? Math.round(totalWeight) : '—'} lbs</strong></span>
                    <span class="is-half"><small>Leer</small><strong>${Number.isFinite(emptyWeight) ? Math.round(emptyWeight) : '—'} lbs</strong></span>
                </div>
                ${_missionCargoPayloadStatusMessageHtml()}
            </div>`;
    }
    const stationRows = (plan?.stations || snapshot.stations || []).map((row) => {
        const target = Number(row?.weightLbs);
        const base = Number(row?.baselineWeightLbs);
        const extra = Number(row?.missionExtraLbs);
        const detail = Number.isFinite(base) && Number.isFinite(extra)
            ? ` (Basis ${Math.round(base)} + ${Math.round(extra)} lbs)`
            : '';
        return `<span>S${Math.round(Number(row?.index) || 0)}: ${Number.isFinite(target) ? Math.round(target) : '-'} lbs${detail}</span>`;
    }).join(' · ');
    const distributionText = snapshot.payloadAdapter === MISSION_CARGO_PA24_ADAPTER
        ? `Accu-Sim Comanche · Sitze S2/S3/S4 · Baggage S5 (max. ${MISSION_CARGO_PA24_BAGGAGE_MAX_LBS} lbs)`
        : `Nutzlaststationen: ${snapshot.payloadStationCount} · Verteilung: Copilot S${layout.copilotIndex} · Ruecksitze ${_missionCargoFormatStationList(layout.rearSeatIndices)} · Cargo ${_missionCargoFormatStationList(layout.cargoIndices)}`;
    return `
        <div class="mission-cargo-payload-summary">
            <div>Sim aktuell: Gesamt ${Number.isFinite(Number(snapshot.totalWeightLbs)) ? Math.round(snapshot.totalWeightLbs) : '-'} lbs · Leer ${Number.isFinite(Number(snapshot.emptyWeightLbs)) ? Math.round(snapshot.emptyWeightLbs) : '-'} lbs · Fuel ${Number.isFinite(fuelWeight) ? Math.round(fuelWeight) : '-'} lbs</div>
            <div>${distributionText}</div>
            <div>Mission-Plan (${mode === 'unload' ? 'Entladen' : 'Verladen'}): ${paxPart} · ${cargoPart}${missionExtra == null ? '' : ` · Zusatz ${Math.round(missionExtra)} lbs`}</div>
            <div>Stationen: ${stationRows || '-'}</div>
            ${_missionCargoPayloadStatusMessageHtml()}
        </div>`;
}

async function _missionCargoRefreshPayloadSnapshot(options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadGet !== 'function') return { status: 'skipped' };
    const force = options?.force === true;
    const ageMs = Date.now() - Number(window.aircraftPayloadStatus?.lastSnapshotAt || 0);
    if (!force && ageMs >= 0 && ageMs < 4500 && window.aircraftPayloadStatus?.snapshot) {
        return { status: 'cached', snapshot: window.aircraftPayloadStatus.snapshot };
    }
    return window.trackerPayloadGet({
        maxStations: Math.max(4, Math.min(20, Math.round(Number(options?.maxStations ?? 12) || 12))),
        timeoutMs: Number(options?.timeoutMs) || 12000
    });
}

function _missionCargoPayloadSyncDelayMs(now, burstStartedAt, lastRequestedAt, forceImmediate = false) {
    if (forceImmediate) return 0;
    const current = Math.max(0, Number(now) || 0);
    const burstStart = Math.max(0, Number(burstStartedAt) || current);
    const lastRequest = Math.max(burstStart, Number(lastRequestedAt) || current);
    const quietDueAt = lastRequest + MISSION_CARGO_PAYLOAD_SYNC_DEBOUNCE_MS;
    const maxDueAt = burstStart + MISSION_CARGO_PAYLOAD_SYNC_MAX_WAIT_MS;
    return Math.max(0, Math.min(quietDueAt, maxDueAt) - current);
}

function _missionCargoPayloadSyncIsCurrentRevision(revision) {
    return Math.max(0, Math.round(Number(revision || 0))) === _MISSION_CARGO_PAYLOAD_SYNC_QUEUE.revision;
}

function _missionCargoResolvePayloadSyncWaiters(revision, result = { status: 'unknown' }) {
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    const settledRevision = Math.max(0, Math.round(Number(revision || 0)));
    if (settledRevision >= queue.settledRevision) {
        queue.settledRevision = settledRevision;
        queue.lastResult = result || { status: 'unknown' };
    }
    const pending = queue.waiters.splice(0);
    pending.forEach((waiter) => {
        if (waiter.revision <= settledRevision) {
            waiter.resolve(result || { status: 'unknown' });
        } else {
            queue.waiters.push(waiter);
        }
    });
}

function _missionCargoWaitForPayloadSyncRevision(revision) {
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    const targetRevision = Math.max(0, Math.round(Number(revision || 0)));
    if (targetRevision <= queue.settledRevision) return Promise.resolve(queue.lastResult);
    return new Promise(resolve => queue.waiters.push({ revision: targetRevision, resolve }));
}

function _missionCargoCancelPayloadSyncQueue(reason = 'cancelled') {
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = null;
    queue.burstStartedAt = 0;
    queue.lastRequestedAt = 0;
    queue.pendingReason = '';
    queue.forceImmediate = false;
    queue.revision += 1;
    const result = { status: 'cancelled', reason, revision: queue.revision };
    queue.settledRevision = queue.revision;
    queue.lastResult = result;
    queue.waiters.splice(0).forEach(waiter => waiter.resolve(result));
    if (window.missionCargoStatus) {
        window.missionCargoStatus.payloadSyncQueued = '';
        window.missionCargoStatus.payloadSyncScheduledAt = 0;
        window.missionCargoStatus.payloadSyncRevision = queue.revision;
    }
    return result;
}

function _missionCargoArmPayloadSyncQueue() {
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = null;
    if (window.missionCargoStatus?.payloadSyncRunning || queue.revision <= queue.settledRevision) return false;
    const delayMs = _missionCargoPayloadSyncDelayMs(
        Date.now(),
        queue.burstStartedAt,
        queue.lastRequestedAt,
        queue.forceImmediate
    );
    window.missionCargoStatus.payloadSyncScheduledAt = Date.now() + delayMs;
    queue.timer = setTimeout(() => {
        queue.timer = null;
        _missionCargoFlushPayloadSyncQueue().catch(() => {});
    }, delayMs);
    return true;
}

async function _missionCargoRunPayloadSync(reason = 'cargo-sync', revision = 0) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') {
        window.missionCargoStatus.payloadNeedsSync = true;
        return { status: 'skipped' };
    }
    window.missionCargoStatus.payloadVerification = null;
    window.missionCargoStatus.payloadVerificationRunning = false;
    try {
        const hasPendingReset = Array.isArray(window.missionCargoStatus?.payloadPendingResetStations) && window.missionCargoStatus.payloadPendingResetStations.length > 0;
        if (hasPendingReset) {
            const pendingAck = await _missionCargoApplyPendingResetStations(`${reason}-pre`);
            if (pendingAck?.status && pendingAck.status !== 'ok' && pendingAck.status !== 'no_pending_reset') {
                window.missionCargoStatus.payloadNeedsSync = true;
                return pendingAck;
            }
        }
        const manifest = _missionCargoEnsureManifest();
        _missionCargoResetPayloadPlanForMissionKey(manifest?.key || '');
        if (!window.missionCargoStatus.payloadBaseline) {
            const getAck = await _missionCargoRefreshPayloadSnapshot({ force: true, maxStations: 20, timeoutMs: 12000 });
            if (getAck?.status !== 'ok' && !window.aircraftPayloadStatus?.snapshot) {
                window.missionCargoStatus.payloadNeedsSync = true;
                return getAck || { status: 'no_snapshot' };
            }
        }
        _missionCargoMergeFuelIntoCurrentSnapshot(window.lastLiveFlightData);
        const baseline = _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
        if (!baseline) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_baseline' };
        }
        const plan = _missionCargoBuildPlanFromManifest(manifest, baseline);
        if (plan?.error) {
            window.missionCargoStatus.payloadNeedsSync = true;
            window.missionCargoStatus.error = plan.error;
            window.missionCargoStatus.payloadPlan = plan;
            return { status: 'invalid_plan', error: plan.error, plan };
        }
        if (!plan || !Array.isArray(plan.stations) || !plan.stations.length) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_plan' };
        }
        window.missionCargoStatus.payloadLayout = plan.layout;
        window.missionCargoStatus.payloadPlan = plan;
        const setAck = await window.trackerPayloadSet(
            plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })),
            {
                maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12,
                timeoutMs: 15000,
                refreshAfter: false,
                payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter || '',
                pa24State: plan.pa24State || null
            }
        );
        window.missionCargoStatus.payloadSyncAt = Date.now();
        if (!_missionCargoPayloadSyncIsCurrentRevision(revision)) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return {
                status: 'superseded',
                reason: 'newer_payload_state_pending',
                revision,
                ack: setAck || null
            };
        }
        if (setAck?.status === 'ok') {
            if ((plan.payloadAdapter || baseline.payloadAdapter) === MISSION_CARGO_PA24_ADAPTER && plan.pa24State) {
                const reassertAck = await _missionCargoReassertPa24Seats(plan.pa24State, {
                    revision,
                    reason: 'pa24-payload-seat-post-write'
                });
                if (reassertAck?.status === 'superseded' || !_missionCargoPayloadSyncIsCurrentRevision(revision)) {
                    window.missionCargoStatus.payloadNeedsSync = true;
                    return reassertAck?.status === 'superseded'
                        ? reassertAck
                        : { status: 'superseded', reason: 'newer_payload_state_pending', revision };
                }
            }
            const verifyAck = await _missionCargoVerifyPayloadStable(
                plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })),
                {
                    reason,
                    revision,
                    maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12,
                    timeoutMs: 12000,
                    delaysMs: (plan.payloadAdapter || baseline.payloadAdapter) === MISSION_CARGO_PA24_ADAPTER
                        ? MISSION_CARGO_PA24_VERIFY_DELAYS_MS
                        : undefined,
                    pa24State: (plan.payloadAdapter || baseline.payloadAdapter) === MISSION_CARGO_PA24_ADAPTER
                        ? plan.pa24State
                        : null
                }
            );
            if (verifyAck?.status === 'superseded' || !_missionCargoPayloadSyncIsCurrentRevision(revision)) {
                window.missionCargoStatus.payloadNeedsSync = true;
                return verifyAck?.status === 'superseded'
                    ? verifyAck
                    : { status: 'superseded', reason: 'newer_payload_state_pending', revision };
            }
            if (verifyAck?.status === 'ok' || verifyAck?.status === 'skipped') {
                window.missionCargoStatus.payloadNeedsSync = false;
                if (verifyAck?.status === 'ok') window.missionCargoStatus.error = null;
            } else {
                window.missionCargoStatus.payloadNeedsSync = true;
                window.missionCargoStatus.error = 'payload_unstable_aircraft_override';
                return verifyAck || { status: 'unstable', error: 'payload_unstable_aircraft_override' };
            }
        } else {
            window.missionCargoStatus.payloadNeedsSync = true;
            window.missionCargoStatus.error = setAck?.error || setAck?.status || 'payload_set_failed';
        }
        return setAck || { status: 'unknown' };
    } catch (err) {
        if (!_missionCargoPayloadSyncIsCurrentRevision(revision)) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return {
                status: 'superseded',
                reason: 'newer_payload_state_pending',
                revision,
                error: err?.message || String(err)
            };
        }
        window.missionCargoStatus.payloadNeedsSync = true;
        window.missionCargoStatus.error = err?.message || String(err);
        return { status: 'error', error: err?.message || String(err) };
    }
}

async function _missionCargoFlushPayloadSyncQueue() {
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    if (window.missionCargoStatus?.payloadSyncRunning) return { status: 'running' };
    if (queue.revision <= queue.settledRevision) return queue.lastResult;
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = null;
    const revision = queue.revision;
    const reason = queue.pendingReason || 'cargo-sync';
    queue.pendingReason = '';
    queue.burstStartedAt = 0;
    queue.lastRequestedAt = 0;
    queue.forceImmediate = false;
    window.missionCargoStatus.payloadSyncRunning = true;
    window.missionCargoStatus.payloadSyncQueued = '';
    window.missionCargoStatus.payloadSyncScheduledAt = 0;
    let result = { status: 'unknown', revision };
    try {
        result = await _missionCargoRunPayloadSync(reason, revision);
        return result;
    } finally {
        window.missionCargoStatus.payloadSyncRunning = false;
        _missionCargoResolvePayloadSyncWaiters(revision, result);
        if (queue.revision > revision && queue.revision > queue.settledRevision) {
            window.missionCargoStatus.payloadSyncQueued = queue.pendingReason || 'latest-payload-state';
            _missionCargoArmPayloadSyncQueue();
        } else {
            window.missionCargoStatus.payloadSyncQueued = '';
            window.missionCargoStatus.payloadSyncScheduledAt = 0;
        }
    }
}

function _missionCargoSyncPayloadToSim(reason = 'cargo-sync', options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') {
        window.missionCargoStatus.payloadNeedsSync = true;
        return Promise.resolve({ status: 'skipped' });
    }
    const queue = _MISSION_CARGO_PAYLOAD_SYNC_QUEUE;
    const now = Date.now();
    queue.revision += 1;
    queue.pendingReason = String(reason || 'cargo-sync');
    queue.lastRequestedAt = now;
    if (!queue.burstStartedAt) queue.burstStartedAt = now;
    if (options?.immediate === true) queue.forceImmediate = true;
    window.missionCargoStatus.payloadNeedsSync = true;
    window.missionCargoStatus.payloadSyncQueued = queue.pendingReason;
    window.missionCargoStatus.payloadSyncRevision = queue.revision;
    try {
        const manifest = _missionCargoEnsureManifest();
        const baseline = _missionCargoNormalizePayloadSnapshot(window.missionCargoStatus?.payloadBaseline);
        if (manifest && baseline) {
            window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(baseline);
            window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(manifest, baseline);
        }
    } catch (_) {}
    const waitPromise = _missionCargoWaitForPayloadSyncRevision(queue.revision);
    _missionCargoArmPayloadSyncQueue();
    return waitPromise;
}

async function _missionCargoSyncPayloadBeforeStart(reason = 'cargo-finish-loading') {
    const ack = await _missionCargoSyncPayloadToSim(reason, { immediate: true });
    const deadline = Date.now() + 60000;
    let idleSince = 0;
    while (Date.now() < deadline) {
        const busy = !!(
            window.missionCargoStatus?.payloadSyncRunning
            || window.missionCargoStatus?.payloadSyncQueued
            || window.missionCargoStatus?.payloadVerificationRunning
        );
        if (busy) {
            idleSince = 0;
        } else if (!idleSince) {
            idleSince = Date.now();
        } else if ((Date.now() - idleSince) >= 450) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 120));
    }
    const stillBusy = !!(
        window.missionCargoStatus?.payloadSyncRunning
        || window.missionCargoStatus?.payloadSyncQueued
        || window.missionCargoStatus?.payloadVerificationRunning
    );
    if (stillBusy) {
        window.missionCargoStatus.payloadNeedsSync = true;
        window.missionCargoStatus.error = 'payload_sync_timeout';
        return { status: 'timeout', error: 'payload_sync_timeout' };
    }
    return ack || { status: 'unknown' };
}

function _missionCargoStressDamage(record = null) {
    const fd = window.lastLiveFlightData || {};
    const maxG = Math.max(Number(record?.maxGForce || 1), Number(flightRecorder?.maxGForce || 1), Number(fd.gForce || 1));
    const maxBank = Math.max(Math.abs(Number(record?.maxBankDeg || 0)), Math.abs(Number(flightRecorder?.maxBankDeg || 0)), Math.abs(Number(fd.bankDeg || 0)));
    const maxDescent = Math.max(Math.abs(Math.min(0, Number(record?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(flightRecorder?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(fd.vsFpm ?? fd.vs ?? 0))));
    const touchdown = Math.abs(Number(record?.touchdownVsFpm || flightRecorder?.touchdownVsFpm || fd.touchdownFpm || 0));
    let damage = 0;
    if (Number.isFinite(maxG) && maxG > 1.45) damage += (maxG - 1.45) * 22;
    if (Number.isFinite(maxBank) && maxBank > 45) damage += (maxBank - 45) * 0.45;
    if (Number.isFinite(maxDescent) && maxDescent > 1300) damage += (maxDescent - 1300) * 0.008;
    if (Number.isFinite(touchdown) && touchdown > 450) damage += (touchdown - 450) * 0.045;
    return Math.max(0, Math.min(85, Math.round(damage)));
}

function _missionCargoApplyStressSnapshot(record = null) {
    const manifest = _missionCargoEnsureManifest();
    const damage = _missionCargoStressDamage(record);
    const prev = Number(manifest.maxStressDamagePct || 0);
    if (!Number.isFinite(damage) || damage <= prev) return manifest;
    manifest.maxStressDamagePct = damage;
    (manifest.items || []).forEach(item => {
        if (item.status === 'loaded') {
            item.healthPct = Math.max(0, Math.min(Number(item.healthPct ?? 100), 100 - damage));
        }
    });
    _missionCargoPersistManifest(manifest);
    return manifest;
}

window.missionCargoApplyCurrentStress = function(record = null) {
    if (!_missionCargoHasActiveMission()) return null;
    return JSON.parse(JSON.stringify(_missionCargoApplyStressSnapshot(record)));
};

function _missionCargoEvaluateOutcome(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    const required = items.filter(item => item.required);
    const missing = required.filter(item => item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped');
    const dropped = required.filter(item => item.status === 'dropped');
    const notDelivered = required.filter(item => _missionCargoItemNeedsUnloadHere(item) && item.status === 'loaded');
    const damaged = required.filter(item => Number(item.healthPct ?? 100) <= 35);
    const failed = missing.length > 0 || dropped.length > 0 || notDelivered.length > 0 || damaged.length > 0;
    const loadedWeightLbs = items.reduce((sum, item) => sum + ((item.status === 'loaded' || item.status === 'unloaded') ? Number(item.weightLbs || 0) : 0), 0);
    const healthValues = items
        .filter(item => !_missionCargoIsPassengerItem(item))
        .filter(item => item.status === 'loaded' || item.status === 'unloaded' || item.status === 'dropped')
        .map(item => Math.max(0, Math.min(100, Number(item.healthPct ?? 100))))
        .filter(Number.isFinite);
    const minHealthPct = healthValues.length ? Math.min(...healthValues) : 100;
    const stressDamagePct = Math.max(0, Math.min(100, Number(manifest?.maxStressDamagePct || 0)));
    return {
        status: failed ? 'failed' : 'completed',
        failed,
        requiredTotal: required.length,
        requiredLoaded: required.filter(item => item.status === 'loaded' || item.status === 'unloaded').length,
        missingRequired: missing.map(item => item.storyName || item.label),
        droppedRequired: dropped.map(item => item.storyName || item.label),
        notDeliveredRequired: notDelivered.map(item => item.storyName || item.label),
        damagedRequired: damaged.map(item => item.storyName || item.label),
        loadedWeightLbs: Math.round(loadedWeightLbs),
        totalWeightLbs: Math.round(items.reduce((sum, item) => sum + Number(item.weightLbs || 0), 0)),
        stressDamagePct: Math.round(stressDamagePct),
        minHealthPct: Math.round(minHealthPct),
        conditionPct: Math.round(Math.min(minHealthPct, 100 - stressDamagePct))
    };
}

function _missionCargoEvaluateFarewellOutcome() {
    const manifest = _missionCargoEnsureManifest();
    if (!manifest || !Array.isArray(manifest.items)) return _missionCargoEvaluateOutcome(manifest);
    const projected = JSON.parse(JSON.stringify(manifest));
    const passenger = (projected.items || []).find(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    if (passenger) {
        passenger.status = 'unloaded';
        passenger.unloadedAt = Date.now();
        passenger.droppedAt = 0;
    }
    return _missionCargoEvaluateOutcome(projected);
}

function _missionCargoRequiredStatusSnapshot(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items
        .filter(item => item && item.required)
        .map(item => ({
            id: String(item.id || ''),
            label: String(item.storyName || item.label || item.id || ''),
            status: String(item.status || 'pending'),
            itemType: String(item.itemType || 'cargo'),
            pickupLocation: String(item.pickupLocation || ''),
            deliverAtDestination: item.deliverAtDestination !== false,
            deliverAtHome: item.deliverAtHome === true,
            handoffWithPassenger: _missionCargoIsPassengerHandoffItem(item, manifest),
            handoffComplete: _missionCargoIsPassengerHandoffLocked(item),
            handedOffAt: Number(item.handedOffAt || 0)
        }));
}

window.missionCargoEvaluateOutcome = function() {
    if (!_missionCargoHasActiveMission()) {
        return { status: 'none', failed: false, requiredTotal: 0, requiredLoaded: 0, missingRequired: [], droppedRequired: [], notDeliveredRequired: [], damagedRequired: [], loadedWeightLbs: 0, totalWeightLbs: 0 };
    }
    _missionCargoApplyStressSnapshot();
    return _missionCargoEvaluateOutcome();
};

function _missionCargoFinalizeMissionOutcome(options = {}) {
    const manifest = _missionCargoApplyStressSnapshot(options.record || null);
    const outcome = _missionCargoEvaluateOutcome(manifest);
    if (typeof _missionPhaseDebugPush === 'function') {
        _missionPhaseDebugPush('trigger', {
            name: 'missionCargoFinalizeMissionOutcome',
            source: options.source || 'mission-end',
            failed: !!outcome.failed,
            missingRequired: (outcome.missingRequired || []).join(','),
            notDeliveredRequired: (outcome.notDeliveredRequired || []).join(','),
            droppedRequired: (outcome.droppedRequired || []).join(','),
            damagedRequired: (outcome.damagedRequired || []).join(','),
            requiredStatus: JSON.stringify(_missionCargoRequiredStatusSnapshot(manifest))
        });
    }
    outcome.finalizedAt = Date.now();
    outcome.source = options.source || 'mission-end';
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md && typeof md === 'object') {
        md.cargoOutcome = outcome;
        md.cargoManifest = manifest;
        md.missionResult = outcome.failed ? 'failed' : 'completed';
        md.missionFailed = !!outcome.failed;
        if (md.missionContract && typeof md.missionContract === 'object') {
            md.missionContract.cargoOutcome = outcome;
            md.missionContract.cargoManifest = manifest;
        }
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.cargoOutcome = outcome;
        window.activeMissionContract.cargoManifest = manifest;
    }
    _missionCargoPersistManifest(manifest);
    return outcome;
}
window.missionCargoFinalizeMissionOutcome = _missionCargoFinalizeMissionOutcome;

window.missionCargoGetManifestSnapshot = function() {
    if (missionCargoGroundInventoryManifest && !_missionCargoHasActiveMission()) {
        return JSON.parse(JSON.stringify(missionCargoGroundInventoryManifest));
    }
    if (!_missionCargoHasActiveMission()) return null;
    _missionCargoApplyStressSnapshot();
    return JSON.parse(JSON.stringify(_missionCargoEnsureManifest()));
};

window.missionCargoCurrentFlightId = function() {
    if (missionCargoComplianceDebugManifest?.flightId) {
        return String(missionCargoComplianceDebugManifest.flightId);
    }
    const recordedFlightId = String(_missionCargoGetManifest()?.flightEvents?.flightId || '').trim();
    if (recordedFlightId) return recordedFlightId;
    const startedAt = Number(
        (typeof missionRuntime !== 'undefined' && missionRuntime?.startedAt)
        || (typeof flightRecorder !== 'undefined' && flightRecorder?.startTs)
        || 0
    );
    return `${_missionCargoMissionKey()}|${startedAt > 0 ? Math.round(startedAt) : 'flight'}`;
};

function _missionCargoFlightEventTimestamp(field = 'start', manifest = _missionCargoEnsureManifest()) {
    const normalized = field === 'landing' ? 'landing' : 'start';
    const stored = Number(manifest?.flightEvents?.[`${normalized}At`] || 0);
    if (stored > 0) return stored;
    if (normalized === 'start') {
        const runtimeStart = Number(
            (typeof missionRuntime !== 'undefined' && missionRuntime?.startedAt)
            || (typeof flightRecorder !== 'undefined' && flightRecorder?.startTs)
            || 0
        );
        if (runtimeStart > 0) return runtimeStart;
    } else {
        const landingAt = Number(
            (typeof missionRuntime !== 'undefined' && missionRuntime?.arrivalFlightRecord?.endTs)
            || (typeof flightRecorder !== 'undefined' && flightRecorder?.endTs)
            || 0
        );
        if (landingAt > 0) return landingAt;
    }
    return Date.now();
}

function _missionCargoFormatLogTime(timestamp) {
    return new Date(Number(timestamp) || Date.now()).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function _missionCargoBoardBookActionState(item = null, manifest = null, source = 'cargo') {
    const currentFlightId = window.missionCargoCurrentFlightId?.() || '';
    const log = item?.log && typeof item.log === 'object' ? item.log : {};
    const currentLog = String(log.flightId || '') === String(currentFlightId) ? log : {};
    const hasStart = Number(currentLog.startAt || 0) > 0;
    const hasLanding = Number(currentLog.landingAt || 0) > 0;
    const field = !hasStart ? 'start' : (!hasLanding ? 'landing' : '');
    const availableStatus = item?.status === 'loaded' || item?.status === 'unloaded';
    const missionAvailable = manifest?.groundInventory !== true && _missionCargoHasActiveMission();
    const allowed = !!field
        && availableStatus
        && missionAvailable
        && window.missionComplianceBoardBookWriteAllowed?.(field, { source }) !== false;
    return {
        field,
        allowed,
        complete: hasStart && hasLanding,
        label: field === 'landing' ? 'Landezeit eintragen' : 'Startzeit eintragen',
        log: currentLog
    };
}

function _missionCargoFlightEndpointLabel(which = 'start') {
    if (missionCargoComplianceDebugManifest) return 'Debug-Standort';
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (which === 'landing') {
        return String(
            (typeof currentDestICAO !== 'undefined' && currentDestICAO)
            || md?.dest
            || md?.poiName
            || md?.targetName
            || 'Ziel'
        ).trim();
    }
    return String(
        (typeof currentStartICAO !== 'undefined' && currentStartICAO)
        || md?.start
        || 'Start'
    ).trim();
}

function _missionCargoDismissBoardBookBanner() {
    if (missionCargoBoardBookBannerTimer) clearTimeout(missionCargoBoardBookBannerTimer);
    missionCargoBoardBookBannerTimer = null;
    const banner = document.getElementById('missionBoardBookReminder');
    if (banner) banner.hidden = true;
    const host = document.getElementById('awmFreqBanner');
    if (host && !Array.from(host.children).some(child => child.hidden !== true)) {
        host.style.display = 'none';
    }
}

function _missionCargoShowBoardBookBanner(field = 'start') {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(entry => String(entry?.id || '') === 'bordbuch');
    if (!item || item.status !== 'loaded') return false;
    const normalized = field === 'landing' ? 'landing' : 'start';
    const log = item.log && typeof item.log === 'object' ? item.log : {};
    const currentFlightId = window.missionCargoCurrentFlightId?.() || '';
    if (String(log.flightId || '') === String(currentFlightId) && Number(log[`${normalized}At`] || 0) > 0) return false;
    const host = document.getElementById('awmFreqBanner');
    let banner = document.getElementById('missionBoardBookReminder');
    if (!banner) {
        banner = document.createElement('section');
        banner.id = 'missionBoardBookReminder';
        banner.className = 'awm-freq-entry mission-boardbook-reminder';
        banner.setAttribute('role', 'status');
        banner.addEventListener('click', (event) => {
            if (event.target?.closest?.('button')) return;
            _missionCargoDismissBoardBookBanner();
        });
        (host || document.body).appendChild(banner);
    } else if (host && banner.parentElement !== host) {
        host.appendChild(banner);
    }
    banner.dataset.field = normalized;
    banner.innerHTML = `
        <div class="mission-boardbook-reminder-copy">
            <strong>BORDBUCH</strong>
            <span>${normalized === 'landing' ? 'Landezeit' : 'Startzeit'} des aktuellen Fluges eintragen?</span>
        </div>
        <button type="button">${normalized === 'landing' ? 'Landezeit' : 'Startzeit'} eintragen</button>
    `;
    banner.querySelector('button')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const ok = window.missionCargoSetBoardBookTime?.('bordbuch', normalized, { source: 'banner' });
        if (ok) _missionCargoDismissBoardBookBanner();
    });
    banner.hidden = false;
    if (host) host.style.display = 'block';
    if (missionCargoBoardBookBannerTimer) clearTimeout(missionCargoBoardBookBannerTimer);
    missionCargoBoardBookBannerTimer = setTimeout(_missionCargoDismissBoardBookBanner, 15000);
    return true;
}

window.missionCargoRecordFlightEvent = function(field = 'start', timestamp = Date.now(), options = {}) {
    if (!_missionCargoHasActiveMission()) return false;
    const manifest = _missionCargoEnsureManifest();
    const normalized = field === 'landing' ? 'landing' : 'start';
    const currentFlightId = window.missionCargoCurrentFlightId?.() || '';
    manifest.flightEvents = manifest.flightEvents && typeof manifest.flightEvents === 'object'
        ? manifest.flightEvents
        : {};
    if (String(manifest.flightEvents.flightId || '') !== String(currentFlightId)) {
        manifest.flightEvents = {};
    }
    const key = `${normalized}At`;
    const created = !Number(manifest.flightEvents[key] || 0);
    if (created) {
        manifest.flightEvents[key] = Math.round(Number(timestamp) || Date.now());
    }
    manifest.flightEvents.flightId = currentFlightId;
    _missionCargoPersistManifest(manifest);
    if (options.showBanner !== false) {
        setTimeout(() => _missionCargoShowBoardBookBanner(normalized), Math.max(0, Number(options.delayMs || 0)));
    }
    return true;
};

window.missionCargoReplaceEquipment = function(itemId) {
    const id = String(itemId || '');
    if (id !== 'first-aid' && id !== 'fire-extinguisher') return false;
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(entry => String(entry?.id || '') === id);
    const offboardInventoryAvailable = item?.status === 'pending'
        && window.missionCargoStatus?.lastMode === 'equipment'
        && missionRuntime.active !== true;
    if (!item || (item.status !== 'unloaded' && !offboardInventoryAvailable) || item.equipmentType !== 'expiry') return false;
    const renderMode = _missionCargoActionDialogMode({ mode: window.missionCargoStatus?.lastMode }, 'load');
    if (window.missionComplianceBeforeEquipmentReplace?.() === false) {
        window.missionCargoStatus.error = 'Austausch gesperrt: Fuer diesen Flug findet eine Behoerdenkontrolle statt.';
        _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const daysRemaining = _missionCargoExpiryDaysRemaining(item.expiresAt);
    if (Number.isFinite(daysRemaining) && daysRemaining >= MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS) {
        window.missionCargoStatus.error = `Austausch erst bei weniger als ${MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS} Tagen Restgueltigkeit moeglich.`;
        _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const now = Date.now();
    const itemWasUnloaded = item.status === 'unloaded';
    item.issuedAt = now;
    item.serialId = _missionCargoNewEquipmentSerial(id, now);
    item.expiresAt = _missionCargoNewExpiryDate('', now);
    item.replacedAt = now;
    _missionCargoPersistManifest(manifest);
    if (itemWasUnloaded && !window.simModeActive && window.liveTrackerConnected) {
        const pos = _missionCargoCommandBasePos();
        _missionCargoQueueVisibleItemState(item, true, {
            sceneId: _missionCargoUnloadSceneId(),
            reason: 'equipment-replace-spawn-new',
            unloaded: true,
            pos: {
                lat: _missionCargoNullableNumber(item.unloadLat) ?? Number(pos?.lat),
                lon: _missionCargoNullableNumber(item.unloadLon) ?? Number(pos?.lon),
                altFt: _missionCargoNullableNumber(item.unloadAltFt) ?? Number(pos?.altFt || 0),
                hdg: Number(pos?.hdg || 0)
            }
        });
    }
    window.missionCargoStatus.error = null;
    _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

function _missionCargoNeedsUnload(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const ignorePassenger = !!options?.ignorePassenger;
    return _missionCargoLoadedItems(manifest).some(item => {
        if (!_missionCargoItemNeedsUnloadHere(item) || item.status === 'unloaded') return false;
        if (ignorePassenger && _missionCargoIsPassengerItem(item)) return false;
        return true;
    });
}
window.missionCargoNeedsUnload = _missionCargoNeedsUnload;

function _missionCargoNeedsArrivalWorkflow(options = {}) {
    if (!_missionCargoHasActiveMission()) return false;
    const manifest = _missionCargoEnsureManifest();
    return _missionCargoNeedsUnload(options)
        || !_missionCargoSignatureMatchesMode(manifest.dispatchSignature, 'unload');
}
window.missionCargoNeedsArrivalWorkflow = _missionCargoNeedsArrivalWorkflow;

function _missionCargoManualPassengerLoadOptions(item = null, wasUnloaded = false, reason = '') {
    const unloadedKind = `unloaded_${item?.sceneKind || item?.id || 'passenger'}`;
    return {
        reason: reason || (wasUnloaded ? 'passenger-manual-load' : 'passenger-manual-board'),
        manualAnimation: true,
        sceneId: wasUnloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId(),
        boardingPoint: _missionCargoPassengerBoardingPoint(),
        personKind: wasUnloaded ? unloadedKind : 'person_boarder_1',
        personKinds: wasUnloaded
            ? [unloadedKind, item?.sceneKind].filter(Boolean)
            : ['person_boarder_1', 'person_boarder_2'],
        personLabel: wasUnloaded ? (item?.storyName || item?.label || 'Passenger') : 'Boarding Pax 1',
        personLabels: wasUnloaded
            ? [item?.label, item?.storyName].filter(Boolean)
            : ['Boarding Pax 1', 'Boarding Pax 2', item?.label, item?.storyName].filter(Boolean)
    };
}

function _missionCargoMarkPassengerLoaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(_missionCargoIsPassengerItem);
    if (!item) {
        window.gaMissionPhaseDebugRecord?.('pax_manifest_load_blocked', { reason: 'no_passenger_item', source: options.reason || null });
        return false;
    }
    if (_missionCargoIsPassengerHandoffLocked(item)) {
        window.missionCargoStatus.error = 'Der verabschiedete Passagier ist nicht mehr am Flugzeug.';
        window.gaMissionPhaseDebugRecord?.('pax_manifest_load_blocked', {
            reason: 'farewell_handoff_complete',
            itemId: item.id || null,
            source: options.reason || null
        });
        return false;
    }
    if (!_missionCargoItemCanLoadAtCurrentStage(item)) {
        window.gaMissionPhaseDebugRecord?.('pax_manifest_load_blocked', { reason: 'wrong_stage', itemId: item.id || null, status: item.status || null, source: options.reason || null });
        return false;
    }
    if (item.status === 'loaded') {
        window.gaMissionPhaseDebugRecord?.('pax_manifest_load_blocked', { reason: 'already_loaded', itemId: item.id || null, source: options.reason || null });
        return false;
    }
    const wasUnloaded = item.status === 'unloaded';
    if (options.manualAnimation === true && _missionCargoManualPassengerSceneBusy()) {
        window.missionCargoStatus.error = _missionCargoManualPassengerBusyMessage();
        return false;
    }
    const previousItem = options.manualAnimation === true ? JSON.parse(JSON.stringify(item)) : null;
    item.status = 'loaded';
    item.loadedAt = Date.now();
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    item.handoffComplete = false;
    item.handedOffAt = 0;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    window.gaMissionPhaseDebugRecord?.('pax_manifest_status', {
        action: 'load',
        itemId: item.id || null,
        from: wasUnloaded ? 'unloaded' : 'planned',
        to: 'loaded',
        passengerCount: Number(item.passengerCount || 1),
        manualAnimation: options.manualAnimation === true,
        source: options.reason || null
    });
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
        if (options.manualAnimation === true) {
            const commandId = _missionCargoSendManualPassengerCommand(item, 'load', {
                reason: options.reason || 'passenger-manual-load',
                sceneId: options.sceneId,
                boardingPoint: options.boardingPoint,
                personKind: options.personKind,
                personKinds: options.personKinds,
                personLabel: options.personLabel,
                personLabels: options.personLabels,
                personTitle: options.personTitle,
                personTitleCandidates: options.personTitleCandidates
            });
            if (!commandId) {
                const itemIndex = manifest.items.findIndex(entry => String(entry.id || '') === String(previousItem?.id || ''));
                if (itemIndex >= 0) manifest.items[itemIndex] = previousItem;
                _missionCargoPersistManifest(manifest);
                window.missionSceneStatus.personBoarded = previousItem?.status === 'loaded';
                return false;
            }
            _missionCargoTrackManualPassengerCommand(commandId, item, previousItem, 'load');
        } else {
            const commandId = window.sendTrackerCommand({
                type: 'mission_scene_object_remove',
                sceneId: _missionCargoUnloadSceneId(),
                reason: options.reason || 'passenger-load-sync',
                kinds: [`unloaded_${item.sceneKind || item.id}`],
                labels: [item.label, item.storyName]
            });
            if (commandId) {
                window.missionCargoStatus.lastCommandAt = Date.now();
                window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_remove', commandId, itemId: item.id };
            }
        }
    }
    if (options.playAudioCue !== false) {
        _missionCargoPlayAudioCue('boarding_pax', item, wasUnloaded ? 'passenger_reload' : 'passenger_load', {
            gain: 0.38,
            variantScope: 'event'
        });
    }
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-load-sync').catch(() => {});
    return true;
}

function _missionCargoMarkPassengerUnloaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(entry => _missionCargoIsPassengerItem(entry) && entry.status === 'loaded');
    if (!item) {
        window.gaMissionPhaseDebugRecord?.('pax_manifest_unload_blocked', { reason: 'no_loaded_passenger_item', source: options.reason || null });
        return false;
    }
    if (options.manualAnimation === true && _missionCargoManualPassengerSceneBusy()) {
        window.missionCargoStatus.error = _missionCargoManualPassengerBusyMessage();
        return false;
    }
    const previousItem = options.manualAnimation === true ? JSON.parse(JSON.stringify(item)) : null;
    const livePos = _missionCargoCommandBasePos();
    item.status = 'unloaded';
    item.unloadedAt = Date.now();
    item.droppedAt = 0;
    item.unloadLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
    item.unloadLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
    item.unloadAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    item.handoffComplete = false;
    item.handedOffAt = 0;
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    window.gaMissionPhaseDebugRecord?.('pax_manifest_status', {
        action: 'unload',
        itemId: item.id || null,
        from: 'loaded',
        to: 'unloaded',
        passengerCount: Number(item.passengerCount || 1),
        manualAnimation: options.manualAnimation === true,
        source: options.reason || null,
        position: {
            lat: item.unloadLat,
            lon: item.unloadLon,
            altFt: item.unloadAltFt
        }
    });
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
        if (options.manualAnimation === true) {
            const commandId = _missionCargoSendManualPassengerCommand(item, 'unload', {
                reason: options.reason || 'passenger-manual-unload',
                boardingPoint: options.boardingPoint || _missionCargoPassengerBoardingPoint()
            });
            if (!commandId) {
                const itemIndex = manifest.items.findIndex(entry => String(entry.id || '') === String(previousItem?.id || ''));
                if (itemIndex >= 0) manifest.items[itemIndex] = previousItem;
                _missionCargoPersistManifest(manifest);
                window.missionSceneStatus.personBoarded = previousItem?.status === 'loaded';
                return false;
            }
            _missionCargoTrackManualPassengerCommand(commandId, item, previousItem, 'unload');
        } else if (options.spawnUnloadedObject !== false) {
            const pos = _missionCargoCommandBasePos();
            const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
            if (hasPos) {
                window.sendTrackerCommand({
                    type: 'mission_scene_object_remove',
                    sceneId: _missionCargoUnloadSceneId(),
                    reason: `${options.reason || 'passenger-unload-sync'}-refresh-remove`,
                    kinds: [`unloaded_${item.sceneKind || item.id}`],
                    labels: [item.label, item.storyName]
                });
                const placement = _missionCargoPassengerSpawnPlacement(item);
                const commandId = window.sendTrackerCommand({
                    type: 'mission_scene_object_spawn',
                    sceneId: _missionCargoUnloadSceneId(),
                    reason: options.reason || 'passenger-unload-sync',
                    lat: Number(pos.lat),
                    lon: Number(pos.lon),
                    altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
                    hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
                    items: [{
                        kind: `unloaded_${item.sceneKind || item.id}`,
                        label: item.storyName || item.label,
                        objectTitle: item.objectTitle || _missionScenePersonTitle(_missionScenePassengerGender(), 'cargo-passenger-unloaded'),
                        titleCandidates: item.titleCandidates || _missionScenePersonCandidates(_missionScenePassengerGender(), item.objectTitle || ''),
                        forwardM: placement.forwardM,
                        rightM: placement.rightM,
                        headingMode: 'with_aircraft',
                        hdgOffsetDeg: 165,
                        altOffsetFt: placement.altOffsetFt
                    }]
                });
                if (commandId) {
                    window.missionCargoStatus.lastCommandAt = Date.now();
                    window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId: item.id };
                }
            } else {
                window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Passenger-Spawn.';
            }
        }
    }
    if (options.playAudioCue !== false) {
        _missionCargoPlayAudioCue('deboarding_pax', item, 'passenger_unload', {
            gain: 0.38,
            variantScope: 'event'
        });
    }
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-unload-sync').catch(() => {});
    return true;
}

function _missionCargoCompletePassengerHandoff(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const passengers = (manifest.items || []).filter(item => (
        _missionCargoIsPassengerItem(item)
        && (item.status === 'loaded' || _missionCargoIsPassengerHandoffLocked(item))
    ));
    if (!passengers.length) return false;
    const handedOffAt = Math.max(1, Number(options.handedOffAt || 0) || Date.now());
    const reason = String(options.reason || 'passenger-vehicle-handoff');
    let changed = false;
    let passengerStatusChanged = false;
    const passengerIds = [];
    const cargoIds = [];

    passengers.forEach((item) => {
        const alreadyComplete = _missionCargoIsPassengerHandoffLocked(item);
        if (item.status === 'loaded') {
            item.status = 'unloaded';
            item.loadedAt = 0;
            item.unloadedAt = handedOffAt;
            passengerStatusChanged = true;
            changed = true;
        }
        if (!alreadyComplete) changed = true;
        item.handoffComplete = true;
        item.handedOffAt = alreadyComplete
            ? Math.max(1, Number(item.handedOffAt || 0) || handedOffAt)
            : handedOffAt;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        passengerIds.push(String(item.id || 'mission-passenger'));
    });

    (manifest.items || [])
        .filter(item => _missionCargoIsPassengerHandoffItem(item, manifest))
        .filter(item => item.status === 'unloaded')
        .forEach((item) => {
            const alreadyComplete = _missionCargoIsPassengerHandoffLocked(item);
            item.handoffComplete = true;
            item.handedOffAt = alreadyComplete
                ? Math.max(1, Number(item.handedOffAt || 0) || handedOffAt)
                : handedOffAt;
            item.unloadLat = null;
            item.unloadLon = null;
            item.unloadAltFt = null;
            cargoIds.push(String(item.id || ''));
            if (!alreadyComplete) {
                changed = true;
                if (!window.simModeActive && window.liveTrackerConnected) {
                    _missionCargoQueueVisibleItemState(item, false, {
                        sceneId: _missionCargoUnloadSceneId(),
                        reason: `${reason}-cargo-taken`,
                        unloaded: true,
                        immediate: true
                    });
                }
            }
        });

    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    if (changed) _missionCargoPersistManifest(manifest);
    window.gaMissionPhaseDebugRecord?.('passenger_handoff_complete', {
        reason,
        commandId: options.commandId || null,
        handedOffAt,
        passengerIds,
        cargoIds,
        passengerStatusChanged
    });
    if (passengerStatusChanged) {
        _missionCargoSyncPayloadToSim(`${reason}-payload`).catch(() => {});
    }
    return {
        changed,
        handedOffAt,
        passengerIds,
        cargoIds
    };
}
window.missionCargoCompletePassengerHandoff = _missionCargoCompletePassengerHandoff;

function _missionCargoEscape(text = '') {
    if (typeof escapeHtmlLite === 'function') return escapeHtmlLite(text);
    return String(text || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function _missionCargoConfirmCriticalAction(action = 'cargo-end') {
    if (typeof window.confirmMissionCriticalAction === 'function') {
        return !!window.confirmMissionCriticalAction(action);
    }
    const msg = action === 'cargo-unload'
        ? 'Entladung wirklich abschliessen?'
        : 'Entladung abschliessen und Mission beenden?';
    try { return !!confirm(msg); } catch (_) { return false; }
}

function _missionCargoRenderDialog(mode = 'load', options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const groundHandlingAllowed = _missionCargoGroundHandlingAllowed();
    const isPickup = mode === 'pickup';
    const isUnload = mode === 'unload';
    const isEquipment = mode === 'equipment';
    const isLoad = mode === 'load';
    const usesManifestSheet = isLoad || isUnload || isPickup || isEquipment;
    const complianceUi = typeof window.missionComplianceGetCargoUiState === 'function'
        ? (window.missionComplianceGetCargoUiState() || { active: false })
        : { active: false };
    _missionCargoMergeFuelIntoCurrentSnapshot(window.lastLiveFlightData);
    _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
    if (window.missionCargoStatus.payloadBaseline) {
        window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(manifest, window.missionCargoStatus.payloadBaseline);
    }
    _missionCargoRememberPayloadAssignments(manifest, window.missionCargoStatus?.payloadPlan);
    let overlay = document.getElementById('missionCargoOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'missionCargoOverlay';
        overlay.className = 'mission-cargo-overlay';
        document.body.appendChild(overlay);
    }
    const sameModeRepaint = window.missionCargoStatus?.lastMode === mode && overlay.style.display === 'flex';
    const preserveScroll = options?.preserveScroll !== false && sameModeRepaint;
    const previousScroll = preserveScroll ? {
        panelTop: Number(overlay.querySelector('.mission-cargo-panel')?.scrollTop || 0),
        panelLeft: Number(overlay.querySelector('.mission-cargo-panel')?.scrollLeft || 0),
        clipboardTop: Number(overlay.querySelector('.mission-cargo-clipboard')?.scrollTop || 0),
        clipboardLeft: Number(overlay.querySelector('.mission-cargo-clipboard')?.scrollLeft || 0),
        listTop: Number(overlay.querySelector('.mission-cargo-list')?.scrollTop || 0),
        listLeft: Number(overlay.querySelector('.mission-cargo-list')?.scrollLeft || 0)
    } : null;
    const missionStartReady = (isUnload || isPickup || isEquipment) ? true : _missionCargoLoadInteractionReady();
    const visibleItems = isEquipment
        ? manifest.items.filter(item => item.persistentEquipment === true)
        : (isPickup
            ? manifest.items.filter(item => item.pickupLocation === 'target')
            : manifest.items);
    const rowItems = usesManifestSheet ? [] : visibleItems;
    const requiredMissing = manifest.items.filter(item => item.required && item.pickupLocation !== 'target' && item.status !== 'loaded').length;
    const requiredUnloadBlockingMissing = manifest.items.filter(item => item.required && _missionCargoItemNeedsUnloadHere(item) && item.status === 'loaded' && !_missionCargoIsPassengerItem(item)).length;
    const requiredPickupMissing = visibleItems.filter(item => item.required && item.status !== 'loaded').length;
    const unloadCompletesMission = isUnload && _missionRuntimeGroundEndReady();
    const passengerDeboardPending = isUnload && unloadCompletesMission && visibleItems.some(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    const signatureMode = isUnload ? 'unload' : (isPickup ? 'pickup' : 'load');
    const storedSignature = manifest.dispatchSignature && typeof manifest.dispatchSignature === 'object'
        ? manifest.dispatchSignature
        : null;
    const signature = _missionCargoSignatureMatchesMode(storedSignature, signatureMode)
        ? storedSignature
        : null;
    const signatureAnimating = !!signature
        && (isLoad || isUnload || isPickup)
        && String(window.missionCargoStatus?.signatureAnimationMode || signatureMode) === signatureMode
        && Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now();
    const signatureReady = !!signature && !signatureAnimating;
    const payloadFinalizeRunning = !!window.missionCargoStatus?.payloadFinalizeRunning;
    const payloadAdapter = String(
        window.missionCargoStatus?.payloadPlan?.payloadAdapter
        || window.missionCargoStatus?.payloadBaseline?.payloadAdapter
        || window.aircraftPayloadStatus?.snapshot?.payloadAdapter
        || ''
    );
    const assignmentMap = new Map(
        [..._missionCargoGroupPayloadAssignmentStations(window.missionCargoStatus?.payloadPlan)]
            .map(([key, stations]) => [
                key,
                _missionCargoFormatSheetStationAssignment(stations, payloadAdapter)
            ])
    );
    const livePos = _missionCargoLivePos();
    const pickupBoardingActive = isPickup && _missionBushIsPickupPassengerMission() && !!(window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive);
    const manualPassengerSceneBusy = _missionCargoManualPassengerSceneBusy();
    const pickupHasPassenger = visibleItems.some(item => _missionCargoIsPassengerItem(item));
    const pickupHasCargo = visibleItems.some(item => !_missionCargoIsPassengerItem(item));
    const pickupItemTypeLabel = pickupHasPassenger && pickupHasCargo
        ? 'wartenden Pickup-Gast und seine Begleitfracht'
        : (_missionBushIsPickupCargoMission() ? 'Rueckholfracht' : 'wartenden Pickup-Gast');
    const rows = rowItems.map(item => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const loaded = item.status === 'loaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const handedOff = _missionCargoIsPassengerHandoffLocked(item);
        const pending = !loaded && !unloaded && !dropped;
        const reloadDistanceM = _missionCargoDistanceToUnloadM(item, livePos);
        const canReloadNearby = _missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
        const passengerSceneBusy = isPassenger && manualPassengerSceneBusy;
        const passengerUsesMainBoarding = isPassenger
            && item.pickupLocation !== 'target'
            && item.status !== 'unloaded'
            && !missionRuntime.active;
        const passengerSceneBusyLabel = passengerSceneBusy ? _missionCargoPassengerBusyLabel() : '';
        const canComplianceLoad = window.missionComplianceCanMutateCargo?.(item.id, 'load') !== false;
        const canComplianceUnload = window.missionComplianceCanMutateCargo?.(item.id, 'unload') !== false;
        const managesPersistentEquipment = item.persistentEquipment === true && (isLoad || isEquipment);
        const pendingEquipmentLocked = isEquipment && pending && (missionRuntime.active || complianceUi.active === true);
        const actionMode = isEquipment ? 'equipment' : 'load';
        let action = '';
        if (handedOff) {
            action = `<button class="mission-cargo-row-btn" disabled>${isPassenger ? 'Verabschiedet' : 'Mitgenommen'}</button>`;
        } else if (isUnload && isPassenger && !unloaded && unloadCompletesMission) {
            action = '<button class="mission-cargo-row-btn" disabled>Nach Farewell</button>';
        } else if (managesPersistentEquipment) {
            action = dropped
                ? '<button class="mission-cargo-row-btn" disabled>Abgeworfen</button>'
                : (loaded
                    ? `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canComplianceUnload) ? 'disabled' : ''} onclick="window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}', { mode: '${actionMode}' })">${!canComplianceUnload ? 'Kontrolle läuft' : (!groundHandlingAllowed ? 'Nur am Boden' : 'Ausladen & prüfen')}</button>`
                    : (unloaded
                        ? `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canReloadNearby || !canComplianceLoad) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: '${actionMode}' })">${!canComplianceLoad ? 'Kontrolle läuft' : (!groundHandlingAllowed ? 'Nur am Boden' : (canReloadNearby ? 'Wieder laden' : 'Zu weit weg'))}</button>`
                        : `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canComplianceLoad || pendingEquipmentLocked) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: '${actionMode}' })">${pendingEquipmentLocked ? 'Nicht an Bord' : (!canComplianceLoad ? 'Kontrolle läuft' : (!groundHandlingAllowed ? 'Nur am Boden' : 'Einladen'))}</button>`));
        } else {
            action = isUnload
                ? (dropped
                    ? `<button class="mission-cargo-row-btn" disabled>Abgeworfen</button>`
                    : (unloaded
                    ? `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canReloadNearby || passengerSceneBusy || !canComplianceLoad) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'unload-reload' })">${!canComplianceLoad ? 'Kontrolle läuft' : (passengerSceneBusy ? passengerSceneBusyLabel : (!groundHandlingAllowed ? 'Nur am Boden' : (canReloadNearby ? (isPassenger ? 'Einsteigen' : 'Wieder laden') : 'Zu weit weg')))}</button>`
                    : `<button class="mission-cargo-row-btn" ${((!groundHandlingAllowed && isPassenger) || passengerSceneBusy || !canComplianceUnload) ? 'disabled' : ''} onclick="window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}')">${!canComplianceUnload ? 'Kontrolle läuft' : (passengerSceneBusy ? passengerSceneBusyLabel : (groundHandlingAllowed ? (isPassenger ? 'Aussteigen' : 'Ausladen') : (isPassenger ? 'Nur am Boden' : 'Abwerfen')))}</button>`))
                : `<button class="mission-cargo-row-btn" ${(loaded || dropped || !groundHandlingAllowed || !_missionCargoItemCanLoadAtCurrentStage(item) || pickupBoardingActive || passengerSceneBusy || passengerUsesMainBoarding) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: '${isPickup ? 'pickup' : 'load'}' })">${passengerSceneBusy ? passengerSceneBusyLabel : (passengerUsesMainBoarding ? 'Via Boarding' : (pickupBoardingActive ? 'Boarding läuft' : (!groundHandlingAllowed ? 'Nur am Boden' : (!_missionCargoItemCanLoadAtCurrentStage(item) ? 'Am Ziel' : (dropped ? 'Abgeworfen' : (loaded ? (isPassenger ? 'An Bord' : 'Geladen') : (isPassenger ? 'Einsteigen' : 'Laden')))))))}</button>`;
        }
        const status = handedOff
            ? (isPassenger ? 'verabschiedet' : 'mitgenommen')
            : (dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (loaded ? (isPassenger ? 'an bord' : 'geladen') : 'offen')));
        const distanceMeta = (isUnload && unloaded && Number.isFinite(reloadDistanceM))
            ? ` · Distanz ${Math.round(reloadDistanceM)} m`
            : '';
        let equipmentDetail = '';
        const isBoardBook = /bordbuch/i.test(`${item.id} ${item.label} ${item.storyName}`);
        const groundInventoryItemAvailable = isEquipment
            && pending
            && missionRuntime.active !== true
            && complianceUi.active !== true;
        if (isBoardBook && item.persistentEquipment === true) {
            const boardBookAction = _missionCargoBoardBookActionState(item, manifest, 'cargo-equipment');
            const boardBookLabel = boardBookAction.complete ? 'Flug eingetragen' : boardBookAction.label;
            equipmentDetail = `
                <div class="mission-cargo-equipment-detail is-boardbook">
                    <span>Start: <b>${_missionCargoEscape(boardBookAction.log.startTime || '--')}</b> · Landung: <b>${_missionCargoEscape(boardBookAction.log.landingTime || '--')}</b></span>
                    <div>
                        <button type="button" ${boardBookAction.allowed ? '' : 'disabled'} onclick="event.stopPropagation(); window.missionCargoSetBoardBookTime && missionCargoSetBoardBookTime('${item.id}', '${boardBookAction.field || 'landing'}', { source: 'cargo-equipment' })">${boardBookLabel}</button>
                    </div>
                </div>`;
        } else if ((unloaded || groundInventoryItemAvailable) && item.persistentEquipment === true) {
            if (item.equipmentType === 'expiry') {
                const daysRemaining = _missionCargoExpiryDaysRemaining(item.expiresAt);
                const expiryTone = !Number.isFinite(daysRemaining) || daysRemaining < 0
                    ? 'is-expired'
                    : (daysRemaining < MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS ? 'is-due' : 'is-valid');
                const expiryText = Number.isFinite(daysRemaining)
                    ? (daysRemaining < 0
                        ? `seit ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'Tag' : 'Tagen'} abgelaufen`
                        : `noch ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tage'} gueltig`)
                    : 'Ablaufdatum fehlt';
                const replaceEligible = !Number.isFinite(daysRemaining) || daysRemaining < MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS;
                const replaceLocked = complianceUi.replacementLocked === true;
                equipmentDetail = `
                    <div class="mission-cargo-equipment-detail ${expiryTone}">
                        <span>Ablaufdatum: <b>${_missionCargoEscape(_missionCargoFormatExpiryDate(item.expiresAt))}</b> · ${_missionCargoEscape(expiryText)}</span>
                        ${replaceEligible && !replaceLocked
                            ? `<button type="button" onclick="window.missionCargoReplaceEquipment && missionCargoReplaceEquipment('${item.id}')">Erneuern</button>`
                            : ''}
                    </div>`;
            }
        }
        return `
            <div class="mission-cargo-row ${item.required ? 'is-required' : 'is-optional'} ${loaded ? 'is-loaded' : ''} ${unloaded ? 'is-unloaded' : ''} ${handedOff ? 'is-handed-off' : ''} ${dropped ? 'is-dropped' : ''}">
                <div class="mission-cargo-row-main">
                    <div class="mission-cargo-row-title">${_missionCargoEscape(item.storyName || item.label)}</div>
                    <div class="mission-cargo-row-meta">${item.persistentEquipment === true ? 'Bordbestand' : (item.required ? 'Pflicht' : 'Optional')} · ${Math.round(Number(item.weightLbs) || 0)} lbs · ${status}${distanceMeta}</div>
                </div>
                ${action}
            </div>
            ${equipmentDetail}`;
    }).join('') || `<div class="mission-cargo-empty">${isEquipment || isLoad ? 'Kein Bordbestand vorhanden.' : (isUnload ? 'Keine geladene Zielfracht offen.' : 'Keine Ladung fuer diese Mission.')}</div>`;
    const clipboardRows = visibleItems.map((item, idx) => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const isBoardBook = /bordbuch/i.test(`${item.id} ${item.label} ${item.storyName}`);
        const onboard = item.status === 'loaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const lost = item.status === 'lost';
        const handedOff = _missionCargoIsPassengerHandoffLocked(item);
        const pending = !onboard && !unloaded && !dropped && !lost;
        const status = handedOff
            ? (isPassenger ? 'verabschiedet' : 'mitgenommen')
            : (lost
                ? 'verloren'
                : (dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (onboard ? (isPassenger ? 'an bord' : 'geladen') : 'offen'))));
        const rememberedStationText = _missionCargoFormatSheetStationAssignment(
            item.payloadStations,
            item.payloadStationAdapter || payloadAdapter
        );
        const stationText = assignmentMap.get(String(item.id))
            || (rememberedStationText !== '-' ? rememberedStationText : ((onboard || unloaded) ? 'auto' : '-'));
        const expiryDate = unloaded && item.equipmentType === 'expiry'
            ? _missionCargoFormatExpiryDate(item.expiresAt)
            : '';
        const itemName = `
            <span>${_missionCargoEscape(item.storyName || item.label || item.id)}</span>
            ${expiryDate ? `<span class="mission-cargo-sheet-item-date">Gültig bis ${_missionCargoEscape(expiryDate)}</span>` : ''}
        `;
        const daysRemaining = item.equipmentType === 'expiry'
            ? _missionCargoExpiryDaysRemaining(item.expiresAt)
            : null;
        const replaceEligible = unloaded
            && item.equipmentType === 'expiry'
            && (!Number.isFinite(daysRemaining) || daysRemaining < MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS)
            && complianceUi.replacementLocked !== true;
        const boardBookAction = isBoardBook
            ? _missionCargoBoardBookActionState(item, manifest, 'cargo-manifest')
            : null;
        const stationAction = replaceEligible
            ? `<button type="button" class="mission-cargo-sheet-action" onclick="event.stopPropagation(); window.missionCargoReplaceEquipment && missionCargoReplaceEquipment('${item.id}')">Erneuern</button>`
            : (boardBookAction
                ? `<button type="button" class="mission-cargo-sheet-action" ${boardBookAction.allowed ? '' : 'disabled'} onclick="event.stopPropagation(); window.missionCargoSetBoardBookTime && missionCargoSetBoardBookTime('${item.id}', '${boardBookAction.field || 'landing'}', { source: 'cargo-manifest' })">${boardBookAction.complete ? 'Flug eingetragen' : boardBookAction.label}</button>`
                : '');
        const stationMarkup = `
            <span class="mission-cargo-sheet-station">${_missionCargoEscape(stationText)}</span>
            ${stationAction}
        `;
        const rowBusy = isPassenger && manualPassengerSceneBusy;
        const canComplianceLoad = window.missionComplianceCanMutateCargo?.(item.id, 'load') !== false;
        const canComplianceUnload = window.missionComplianceCanMutateCargo?.(item.id, 'unload') !== false;
        const canLoadAtStage = _missionCargoItemCanLoadAtCurrentStage(item);
        const canReloadNearby = !unloaded || _missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
        const pendingEquipmentLocked = isEquipment && pending && (missionRuntime.active || complianceUi.active === true);
        const usesArrivalDeboarding = isUnload && isPassenger && onboard && unloadCompletesMission;
        let rowActionJs = '';
        let rowActionLabel = '';
        let rowActionDisabled = true;
        if (handedOff) {
            rowActionLabel = isPassenger ? 'Verabschiedet' : 'Vom PAX mitgenommen';
        } else if (dropped) {
            rowActionLabel = 'Abgeworfen';
        } else if (lost) {
            const replacementAvailable = isEquipment
                && manifest.groundInventory === true
                && missionRuntime.active !== true
                && complianceUi.active !== true;
            rowActionJs = replacementAvailable
                ? `window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'equipment', replaceLost: true })`
                : '';
            rowActionLabel = replacementAvailable ? 'Ersatz einladen' : 'Verloren';
            rowActionDisabled = !replacementAvailable || !groundHandlingAllowed;
        } else if (isUnload) {
            if (usesArrivalDeboarding) {
                const passengerEndReleased = signatureReady
                    && requiredUnloadBlockingMissing === 0
                    && canComplianceUnload;
                rowActionJs = passengerEndReleased
                    ? "window.finishMissionCargoUnloadAndEnd && finishMissionCargoUnloadAndEnd({ source: 'passenger-row', skipConfirm: true })"
                    : '';
                rowActionLabel = requiredUnloadBlockingMissing > 0
                    ? 'Pflichtfracht zuerst'
                    : (signatureReady ? 'Aussteigen' : 'Nach Unterschrift');
                rowActionDisabled = !passengerEndReleased || !groundHandlingAllowed || rowBusy;
            } else if (onboard) {
                rowActionJs = `window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}', { mode: 'unload' })`;
                rowActionLabel = !canComplianceUnload
                    ? 'Kontrolle läuft'
                    : (rowBusy
                        ? _missionCargoPassengerBusyLabel()
                        : (groundHandlingAllowed
                            ? (isPassenger ? 'Aussteigen' : 'Ausladen')
                            : (isPassenger ? 'Nur am Boden' : 'Abwerfen')));
                rowActionDisabled = !canComplianceUnload || rowBusy || (!groundHandlingAllowed && isPassenger);
            } else if (unloaded) {
                rowActionJs = `window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'unload-reload' })`;
                rowActionLabel = !canComplianceLoad
                    ? 'Kontrolle läuft'
                    : (rowBusy
                        ? _missionCargoPassengerBusyLabel()
                        : (!groundHandlingAllowed
                            ? 'Nur am Boden'
                            : (canReloadNearby ? (isPassenger ? 'Einsteigen' : 'Wieder laden') : 'Zu weit weg')));
                rowActionDisabled = !canComplianceLoad || rowBusy || !groundHandlingAllowed || !canReloadNearby || !canLoadAtStage;
            } else {
                rowActionLabel = 'Nicht an Bord';
            }
        } else if (isPickup) {
            if (onboard) {
                rowActionLabel = isPassenger ? 'An Bord' : 'Geladen';
            } else if (pending || unloaded) {
                rowActionJs = `window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'pickup' })`;
                rowActionLabel = rowBusy
                    ? _missionCargoPassengerBusyLabel()
                    : (pickupBoardingActive
                        ? 'Boarding läuft'
                        : (!groundHandlingAllowed
                            ? 'Nur am Boden'
                            : (!canLoadAtStage
                                ? 'Am Ziel'
                                : (isPassenger ? 'Einsteigen' : 'Laden'))));
                rowActionDisabled = rowBusy
                    || pickupBoardingActive
                    || !groundHandlingAllowed
                    || !canLoadAtStage
                    || !canComplianceLoad;
            } else {
                rowActionLabel = 'Nicht verfügbar';
            }
        } else if (isEquipment) {
            if (onboard) {
                rowActionJs = `window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}', { mode: 'equipment' })`;
                rowActionLabel = !canComplianceUnload ? 'Kontrolle läuft' : (groundHandlingAllowed ? 'Ausladen' : 'Nur am Boden');
                rowActionDisabled = !canComplianceUnload || !groundHandlingAllowed;
            } else {
                rowActionJs = `window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'equipment' })`;
                rowActionLabel = pendingEquipmentLocked
                    ? 'Nicht an Bord'
                    : (!canComplianceLoad
                        ? 'Kontrolle läuft'
                        : (!groundHandlingAllowed
                            ? 'Nur am Boden'
                            : (canReloadNearby ? (unloaded ? 'Wieder laden' : 'Einladen') : 'Zu weit weg')));
                rowActionDisabled = pendingEquipmentLocked || !canComplianceLoad || !groundHandlingAllowed || !canReloadNearby || !canLoadAtStage;
            }
        } else if (isLoad) {
            if (item.persistentEquipment === true) {
                if (onboard) {
                    rowActionJs = `window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}', { mode: 'load' })`;
                    rowActionLabel = !canComplianceUnload ? 'Kontrolle läuft' : (groundHandlingAllowed ? 'Ausladen' : 'Nur am Boden');
                    rowActionDisabled = !canComplianceUnload || !groundHandlingAllowed;
                } else {
                    rowActionJs = `window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'load' })`;
                    rowActionLabel = !canComplianceLoad
                        ? 'Kontrolle läuft'
                        : (!groundHandlingAllowed
                            ? 'Nur am Boden'
                            : (canReloadNearby ? (unloaded ? 'Wieder laden' : 'Einladen') : 'Zu weit weg'));
                    rowActionDisabled = !canComplianceLoad || !groundHandlingAllowed || !canReloadNearby || !canLoadAtStage;
                }
            } else {
                rowActionJs = `window.missionCargoToggleItemLoadState && missionCargoToggleItemLoadState('${item.id}', { mode: 'load' })`;
                rowActionLabel = rowBusy
                    ? _missionCargoPassengerBusyLabel()
                    : (!groundHandlingAllowed
                        ? 'Nur am Boden'
                        : (!canLoadAtStage
                            ? 'Am Ziel'
                            : (onboard ? (isPassenger ? 'Aussteigen' : 'Ausladen') : (isPassenger ? 'Einsteigen' : 'Laden'))));
                rowActionDisabled = rowBusy
                    || !groundHandlingAllowed
                    || !canLoadAtStage
                    || (onboard ? !canComplianceUnload : !canComplianceLoad);
            }
        }
        const rowCanInteract = !!rowActionJs && !rowActionDisabled;
        const rowAction = rowCanInteract ? ` onclick="${rowActionJs}"` : '';
        const statusHint = rowActionLabel
            ? `<span class="mission-cargo-sheet-status-hint">${_missionCargoEscape(rowActionLabel)}</span>`
            : '';
        const rowClasses = [
            onboard ? 'is-loaded' : '',
            unloaded ? 'is-unloaded' : '',
            handedOff ? 'is-handed-off' : '',
            lost ? 'is-lost' : '',
            rowCanInteract ? 'is-interactive' : '',
            rowBusy ? 'is-disabled' : ''
        ].filter(Boolean).join(' ');
        return `
            <tr class="${rowClasses}"${rowBusy ? ' aria-disabled="true"' : ''}${rowAction}${rowActionLabel ? ` title="${_missionCargoEscape(rowActionLabel)}"` : ''}>
                <td>${idx + 1}</td>
                <td>${itemName}</td>
                <td>${isPassenger ? `PAX${Number(item.passengerCount || 0) > 1 ? ` x${Number(item.passengerCount)}` : ''}` : (item.persistentEquipment === true ? 'Bordbestand' : (item.required ? 'Pflicht' : 'Optional'))}</td>
                <td>${Math.round(Number(item.weightLbs) || 0)} lbs</td>
                <td>${stationMarkup}</td>
                <td><div class="mission-cargo-sheet-status"><span>${status}</span>${statusHint}</div></td>
            </tr>`;
    }).join('') || `<tr><td colspan="6">${isEquipment ? 'Kein Bordbestand vorhanden.' : 'Keine Ladung fuer diese Mission.'}</td></tr>`;
    const metaAircraft = _missionCargoAircraftLabel();
    const metaPilot = _missionCargoPilotId();
    const metaDate = _missionCargoFormatDate(signature?.at || Date.now());
    const signatureName = _missionCargoEscape(signature?.by || metaPilot);
    const signatureBlockingMissing = isUnload
        ? requiredUnloadBlockingMissing
        : (isPickup ? requiredPickupMissing : requiredMissing);
    const signatureActionEnabled = (!!signature || signatureBlockingMissing === 0) && !manualPassengerSceneBusy;
    const signaturePanel = (isLoad || isUnload || isPickup) ? `
        <div class="mission-cargo-signature ${signature ? 'is-signed' : ''} ${signatureAnimating ? 'is-animating' : ''} ${(!signatureAnimating && signatureActionEnabled) ? 'is-clickable' : ''}" onclick="${(!signatureAnimating && signatureActionEnabled) ? `window.missionCargoToggleDispatchSignature && missionCargoToggleDispatchSignature({ mode: '${signatureMode}' })` : ''}">
            <div class="mission-cargo-signature-line">${signature ? `<span class="mission-cargo-signature-name">${signatureName}</span>` : '&nbsp;'}</div>
            <div class="mission-cargo-signature-meta">Unterschrift Pilot · ${signature ? _missionCargoEscape(_missionCargoFormatDate(signature.at)) : 'noch offen'} · ${signatureAnimating ? 'wird eingetragen' : (signatureReady ? 'Klick: Signatur löschen' : (signatureActionEnabled ? 'Klick: unterschreiben' : (isUnload ? 'Pflichtladung zuerst vollständig entladen' : (isPickup ? 'Pickup zuerst vollständig laden' : 'Pflichtladung zuerst vollständig laden'))))}</div>
        </div>` : '';
    const pickupItemsComplete = isPickup && requiredPickupMissing === 0 && visibleItems.length > 0;
    const complianceEvidenceOpen = isUnload && complianceUi.active === true && complianceUi.phase === 'evidence_open';
    const complianceActionBusy = isUnload && complianceUi.active === true && !complianceEvidenceOpen
        && (complianceUi.phase === 'request_playing' || complianceUi.phase === 'result_playing' || complianceUi.phase === 'departing');
    let primaryActionJs = 'window.finishMissionCargoLoadingAndStart && finishMissionCargoLoadingAndStart()';
    let primaryActionLabel = 'Verladung abschließen';
    if (isEquipment) {
        primaryActionJs = 'window.closeMissionCargoDialog && closeMissionCargoDialog()';
        primaryActionLabel = 'Fenster schließen';
    } else if (complianceEvidenceOpen) {
        primaryActionJs = 'window.missionComplianceSubmitEvidence && missionComplianceSubmitEvidence()';
        primaryActionLabel = complianceUi.actionLabel || 'Der Kontrolle vorlegen';
    } else if (complianceActionBusy) {
        primaryActionJs = '';
        primaryActionLabel = complianceUi.phase === 'departing' ? 'Abfahrt abwarten ...' : 'Kontrolle läuft ...';
    } else if (isLoad && window.missionCargoStatus?.loadConfirmed) {
        primaryActionJs = 'window.closeMissionCargoDialog && closeMissionCargoDialog()';
        primaryActionLabel = 'Fenster schließen';
    } else if ((isLoad || isUnload || isPickup) && !signatureReady) {
        primaryActionJs = `window.missionCargoSignDispatchList && missionCargoSignDispatchList({ mode: '${signatureMode}' })`;
        primaryActionLabel = signatureAnimating ? 'Unterschrift wird eingetragen ...' : 'Unterschrift eintragen';
    } else if (isUnload) {
        primaryActionJs = 'window.finishMissionCargoUnloadAndEnd && finishMissionCargoUnloadAndEnd()';
        primaryActionLabel = unloadCompletesMission && passengerDeboardPending && requiredUnloadBlockingMissing === 0
            ? 'Abschied und Deboarding starten'
            : (unloadCompletesMission ? 'Entladung abgeschlossen - Mission beenden' : 'Entladung abschliessen');
    } else if (isPickup) {
        primaryActionJs = 'window.finishMissionCargoPickupAndContinue && finishMissionCargoPickupAndContinue()';
        primaryActionLabel = 'Pickup bestätigen und Rückflug freigeben';
    } else if (payloadFinalizeRunning) {
        primaryActionLabel = 'Sim-Zuladung wird geprüft ...';
    }
    const secondaryAction = ((isLoad || isUnload || isPickup) && signatureReady && !(isLoad && window.missionCargoStatus?.loadConfirmed))
        ? `<button class="mission-cargo-secondary" onclick="window.missionCargoClearDispatchSignature && missionCargoClearDispatchSignature({ mode: '${signatureMode}' })">Zurueck zur Liste</button>`
        : '';
    const listMarkup = usesManifestSheet ? '' : `<div class="mission-cargo-list">${rows}</div>`;
    const pickupPlaceLabel = String(_activeBushMissionSpec()?.profileId || '').toLowerCase() === 'apt_charter_pickup'
        ? 'Zielplatz'
        : 'Zielstrip';
    const modeHint = isEquipment
        ? '<div class="mission-cargo-summary">Bordbestand zum Pruefen zuerst ausladen. Gültigkeit und Aktionen erscheinen direkt unter dem jeweiligen Item.</div>'
        : (isUnload
        ? (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Im Flug kann Ladung nur abgeworfen werden. Als geliefert gilt sie erst nach Ausladen am Boden.</div>' : '')
        : (isPickup
            ? (!groundHandlingAllowed ? `<div class="mission-cargo-summary">Pickup ist nur im Stillstand am ${pickupPlaceLabel} moeglich.</div>` : '<div class="mission-cargo-summary">Zum Treffpunkt rollen, Pickup vollständig laden, unterschreiben und danach den Rueckflug bestaetigen.</div>')
            : (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Verladung ist nur am Boden moeglich. Im Flug bleibt diese Liste nur zur Dokumentation sichtbar.</div>' : '<div class="mission-cargo-summary">Bordbestand direkt in der Frachtgutliste anklicken. Nach dem Ausladen erscheint das Gueltigkeitsdatum unter dem Namen.</div>')));
    const onboardWeightLbs = manifest.items.reduce((sum, item) => sum + (item.status === 'loaded' ? Number(item.weightLbs || 0) : 0), 0);
    const unloadedWeightLbs = manifest.items.reduce((sum, item) => sum + (item.status === 'unloaded' ? Number(item.weightLbs || 0) : 0), 0);
    const weightSummary = `${Math.round(onboardWeightLbs)} lbs an Bord${unloadedWeightLbs > 0 ? ` · ${Math.round(unloadedWeightLbs)} lbs entladen` : ''}`;
    overlay.innerHTML = `
        <div class="mission-cargo-panel">
            <div class="mission-cargo-head">
                <div>
                    <div class="mission-cargo-kicker">${isPickup ? 'Pickup' : 'Bodenservice'}</div>
                    <div class="mission-cargo-title">${isPickup ? `Pickup am ${pickupPlaceLabel}` : 'Verladung'}</div>
                </div>
                <button class="mission-cargo-close" onclick="window.closeMissionCargoDialog && closeMissionCargoDialog()" title="Schliessen">×</button>
            </div>
            ${modeHint}
            ${complianceUi.active === true ? `<div class="mission-cargo-summary mission-cargo-compliance-summary">${_missionCargoEscape(complianceUi.message || 'Behoerdenkontrolle laeuft.')}</div>` : ''}
            <div class="mission-cargo-copy">${isEquipment
                ? 'Hier kannst du Bordbuch, Feuerloescher und Verbandzeug ausladen, pruefen, bei Bedarf austauschen und wieder einladen.'
                : (isUnload
                ? `Entlade die am Ziel benoetigten Gegenstaende. Bordbestand bleibt beim Flugzeug gespeichert, solange du ihn nicht auslaedst. Wiederladen geht im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m.`
                : (isPickup
                    ? `Hier laedst du ${pickupItemTypeLabel} am ${pickupPlaceLabel} ein. Erst nach Unterschrift und Bestaetigung wird der Rueckflug freigegeben.`
                    : (window.missionCargoStatus?.loadConfirmed
                        ? (missionStartReady
                            ? 'Verladung ist bestaetigt. Die Mission ist jetzt startbereit.'
                            : 'Verladung ist bestaetigt. Mission starten wird freigegeben, sobald Boarding und Ansage fertig sind.')
                        : (missionStartReady
                            ? 'Die Boarding-Animation ist abgeschlossen. Nach dem Abschliessen der Verladung ist die Mission startbereit.'
                            : 'Verladen ist bereits moeglich. Die eigentliche Missionsaktivierung wird erst nach Boarding und Verladung freigeschaltet.'))))}</div>
            ${usesManifestSheet ? `
            <div class="mission-cargo-clipboard">
                <div class="mission-cargo-sheet-title">Frachtgutliste</div>
                <div class="mission-cargo-sheet-meta">
                    <span><b>Flugzeug Kennung:</b> ${_missionCargoEscape(metaAircraft)}</span>
                    <span><b>Pilot-ID:</b> ${_missionCargoEscape(metaPilot)}</span>
                    <span><b>Datum:</b> ${_missionCargoEscape(metaDate)}</span>
                </div>
                <table class="mission-cargo-sheet-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Position</th>
                            <th>Typ</th>
                            <th>Gewicht</th>
                            <th>Station</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${clipboardRows}</tbody>
                </table>
                ${signaturePanel}
            </div>` : ''}
            ${isEquipment ? '' : _missionCargoPayloadSummaryHtml(mode)}
            ${listMarkup}
            <div class="mission-cargo-summary">
                <span>${isEquipment ? `${manifest.items.filter(item => item.persistentEquipment === true && item.status === 'loaded').length} Bord-Items an Bord` : (isUnload ? `${requiredUnloadBlockingMissing} Pflicht-Items noch zu entladen${passengerDeboardPending ? ' · PAX via Deboarding' : ''}` : (isPickup ? `${requiredPickupMissing} Pickup-Items offen` : `${requiredMissing} Pflicht-Items offen`))}</span>
                <span>${weightSummary}</span>
            </div>
            <div class="mission-cargo-actions">
                ${secondaryAction}
                <button class="mission-cargo-primary" ${((isUnload && (!groundHandlingAllowed || signatureAnimating || manualPassengerSceneBusy || complianceActionBusy || requiredUnloadBlockingMissing > 0)) || (isPickup && (!groundHandlingAllowed || !pickupItemsComplete || signatureAnimating || manualPassengerSceneBusy)) || (isLoad && (!groundHandlingAllowed || signatureAnimating || payloadFinalizeRunning || manualPassengerSceneBusy || requiredMissing > 0))) ? 'disabled' : ''} onclick="${primaryActionJs}">${primaryActionLabel}</button>
            </div>
        </div>`;
    overlay.style.display = 'flex';
    if (previousScroll) {
        window.missionCargoStatus.dialogScroll = previousScroll;
        const applyScroll = () => {
            const panelEl = overlay.querySelector('.mission-cargo-panel');
            const clipboardEl = overlay.querySelector('.mission-cargo-clipboard');
            const listEl = overlay.querySelector('.mission-cargo-list');
            if (panelEl) {
                panelEl.scrollTop = previousScroll.panelTop;
                panelEl.scrollLeft = previousScroll.panelLeft;
            }
            if (clipboardEl) {
                clipboardEl.scrollTop = previousScroll.clipboardTop;
                clipboardEl.scrollLeft = previousScroll.clipboardLeft;
            }
            if (listEl) {
                listEl.scrollTop = previousScroll.listTop;
                listEl.scrollLeft = previousScroll.listLeft;
            }
        };
        applyScroll();
        requestAnimationFrame(applyScroll);
    } else {
        window.missionCargoStatus.dialogScroll = null;
    }
    window.missionCargoStatus.lastMode = mode;
    if (options?.skipPayloadRefresh !== true) {
        _missionCargoRefreshPayloadSnapshot({ force: false, maxStations: 12, timeoutMs: 12000 })
            .then((ack) => {
                if (ack?.status === 'ok' || ack?.status === 'cached') {
                    const refreshedManifest = _missionCargoEnsureManifest();
                    _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, refreshedManifest?.key || '');
                    if (window.missionCargoStatus.payloadBaseline) {
                        window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(refreshedManifest, window.missionCargoStatus.payloadBaseline);
                    }
                    if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
                        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
                    }
                }
            })
            .catch(() => {});
    }
}

let _missionCargoLiveFuelRenderTimer = null;
window.missionCargoHandleLiveFuelUpdate = function(flightData = null) {
    const baselineFuel = window.missionCargoStatus?.payloadBaseline?.fuelWeightLbs;
    const beforeFuel = baselineFuel == null ? Number.NaN : Number(baselineFuel);
    _missionCargoMergeFuelIntoCurrentSnapshot(flightData);
    const baseline = _missionCargoMergeFuelIntoPayloadBaseline(flightData);
    const nextFuel = baseline?.fuelWeightLbs == null ? Number.NaN : Number(baseline.fuelWeightLbs);
    if (!Number.isFinite(nextFuel) || (Number.isFinite(beforeFuel) && Math.abs(nextFuel - beforeFuel) <= 0.05)) return false;
    const overlay = document.getElementById('missionCargoOverlay');
    if (!overlay || overlay.style.display !== 'flex') return true;
    if (_missionCargoLiveFuelRenderTimer) clearTimeout(_missionCargoLiveFuelRenderTimer);
    _missionCargoLiveFuelRenderTimer = setTimeout(() => {
        _missionCargoLiveFuelRenderTimer = null;
        if (document.getElementById('missionCargoOverlay')?.style.display !== 'flex') return;
        _missionCargoRenderDialog(window.missionCargoStatus?.lastMode || 'load', {
            skipPayloadRefresh: true,
            preserveScroll: true
        });
    }, 250);
    return true;
};

window.openMissionCargoDialog = function(mode = 'load') {
    _missionCargoEnsureUiSyncHook();
    const requestedMode = String(mode || 'load');
    const normalizedMode = ['unload', 'pickup', 'equipment'].includes(requestedMode) ? requestedMode : 'load';
    if (normalizedMode === 'unload' && !_missionCargoHasActiveMission()) {
        return window.openMissionGroundCargoDialog?.() || false;
    }
    if (normalizedMode === 'unload') {
        try {
            window.missionComplianceEnsureFinalDecision?.();
            window.missionComplianceStartArrival?.('cargo-unload-open');
        } catch (_) {}
    }
    _missionCargoRenderDialog(normalizedMode, { preserveScroll: false });
    _updateMissionRuntimeUi();
    return true;
};

window.openMissionGroundCargoDialog = function() {
    if (!_missionCargoGroundHandlingAllowed()) {
        window.missionCargoStatus.error = 'Bordbestand kann nur am Boden und im Stillstand geoeffnet werden.';
        return false;
    }
    if (_missionCargoHasActiveMission()) {
        window.missionCargoEndGroundInventorySession?.();
        const complianceActive = window.missionComplianceGetCargoUiState?.()?.active === true;
        let groundAction = null;
        try {
            groundAction = missionRuntime.active
                ? window.missionResolveGroundAction?.({ active: true, trigger: 'cargo-ground-window' })
                : null;
        } catch (_) {}
        const arrivalWork = complianceActive
            || groundAction?.action === 'unload'
            || (missionRuntime.active && _missionRuntimeGroundEndReady());
        const mode = arrivalWork ? 'unload' : 'load';
        window.openMissionCargoDialog?.(mode);
    } else {
        window.missionCargoBeginGroundInventorySession?.();
        window.openMissionCargoDialog?.('equipment');
    }
    return true;
};

window.closeMissionCargoDialog = function() {
    const overlay = document.getElementById('missionCargoOverlay');
    if (overlay) overlay.style.display = 'none';
};

function _missionCargoActionDialogMode(options = {}, fallback = 'load') {
    const requestedMode = String(options?.mode || '');
    if (requestedMode === 'unload-reload' || requestedMode === 'unload') return 'unload';
    if (requestedMode === 'pickup') return 'pickup';
    if (requestedMode === 'equipment') return 'equipment';
    if (requestedMode === 'load') return 'load';
    return fallback;
}

window.missionCargoLoadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status === 'loaded') return false;
    const renderMode = _missionCargoActionDialogMode(options, 'load');
    if (_missionCargoIsPassengerHandoffLocked(item)) {
        window.missionCargoStatus.error = _missionCargoIsPassengerItem(item)
            ? 'Der verabschiedete Passagier ist bereits abgefahren.'
            : 'Dieses Item wurde dem Passagier übergeben und mitgenommen.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (!_missionCargoGroundHandlingAllowed()) {
        window.missionCargoStatus.error = 'Verladen ist nur am Boden und im Stillstand moeglich.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (window.missionComplianceCanMutateCargo?.(itemId, 'load') === false) {
        window.missionCargoStatus.error = 'Aenderung gesperrt, solange das Kontrollergebnis bekanntgegeben wird.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const replacingLostEquipment = item.status === 'lost';
    if (replacingLostEquipment) {
        const replacementAllowed = options.replaceLost === true
            && manifest.groundInventory === true
            && missionRuntime.active !== true
            && window.missionComplianceGetCargoUiState?.()?.active !== true;
        if (!replacementAllowed) {
            window.missionCargoStatus.error = 'Verlorener Bordbestand kann erst beim naechsten Bodenservice ersetzt werden.';
            if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
            return false;
        }
        const issuedAt = Date.now();
        item.status = 'pending';
        item.lostAt = 0;
        item.loadedAt = 0;
        item.unloadedAt = 0;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        if (item.equipmentType === 'expiry') {
            item.issuedAt = issuedAt;
            item.serialId = _missionCargoNewEquipmentSerial(item.id, issuedAt);
            item.expiresAt = _missionCargoNewExpiryDate(`${manifest.aircraftSlot}|${item.id}|lost-replacement|${issuedAt}`, issuedAt);
            item.replacedAt = issuedAt;
        }
    }
    if (!_missionCargoItemCanLoadAtCurrentStage(item)) {
        const pickupPlaceLabel = String(_activeBushMissionSpec()?.profileId || '').toLowerCase() === 'apt_charter_pickup'
            ? 'Zielplatz'
            : 'Zielstrip';
        window.missionCargoStatus.error = item.pickupLocation === 'target'
            ? `Dieser Pickup ist erst am ${pickupPlaceLabel} verfügbar.`
            : 'Dieses Item ist in der aktuellen Missionsphase noch nicht verfügbar.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (_missionCargoIsPassengerItem(item)
        && item.pickupLocation !== 'target'
        && item.status !== 'unloaded'
        && !missionRuntime.active
        && options.skipAnimation !== true) {
        window.missionCargoStatus.error = 'Der Passagier steigt über den regulären Boarding-Ablauf ein.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (!options.skipAnimation && item.pickupLocation === 'target' && _missionCargoIsPassengerItem(item) && item.status !== 'unloaded') {
        _missionBushPickupBoarding(item, { reason: 'bush-pickup-load' }).catch?.(() => {});
        return true;
    }
    if (item.status === 'dropped') {
        window.missionCargoStatus.error = 'Dieses Item wurde im Flug abgeworfen und kann nicht wieder geladen werden.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (item.status === 'unloaded' && !_missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M)) {
        const dM = _missionCargoDistanceToUnloadM(item);
        window.missionCargoStatus.error = Number.isFinite(dM)
            ? `Zu weit vom entladenen Item entfernt (${Math.round(dM)} m, max ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m).`
            : `Position fehlt: fuer Wiederladen im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m bleiben.`;
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const wasUnloaded = item.status === 'unloaded';
    if (_missionCargoIsPassengerItem(item) && !options.skipAnimation) {
        const ok = _missionCargoMarkPassengerLoaded(_missionCargoManualPassengerLoadOptions(item, wasUnloaded, options.reason));
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return ok;
    }
    if (item.persistentEquipment === true) item.persistentEquipmentInherited = false;
    item.status = 'loaded';
    item.loadedAt = Date.now();
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    item.lostAt = 0;
    item.handoffComplete = false;
    item.handedOffAt = 0;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (options.playAudioCue !== false) {
        _missionCargoPlayAudioCue(
            item.pickupLocation === 'target' ? 'cargo_pickup' : 'cargo_load',
            item,
            item.pickupLocation === 'target' ? 'pickup' : (wasUnloaded ? 'reload' : 'load'),
            { queue: true }
        );
    }
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        const isTargetPickup = item.pickupLocation === 'target';
        const removeSceneId = isTargetPickup
            ? (window.missionAptArrivalSceneStatus?.sceneId || _missionAptArrivalSceneId())
            : (wasUnloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
        _missionCargoQueueVisibleItemState(item, false, {
            sceneId: removeSceneId,
            reason: isTargetPickup ? 'pickup-cargo-load' : (wasUnloaded ? 'cargo-reload' : 'cargo-load'),
            unloaded: wasUnloaded,
            extraKinds: isTargetPickup ? ['arrival_equipment_1'] : []
        });
    }
    _missionCargoSyncPayloadToSim(wasUnloaded ? 'cargo-reload-item' : 'cargo-load-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleItemLoadState = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item) return false;
    const renderMode = _missionCargoActionDialogMode(options, 'load');
    if (!_missionCargoGroundHandlingAllowed()) {
        window.missionCargoStatus.error = 'Verladen ist nur am Boden und im Stillstand moeglich.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const complianceAction = item.status === 'loaded' ? 'unload' : 'load';
    if (window.missionComplianceCanMutateCargo?.(itemId, complianceAction) === false) {
        window.missionCargoStatus.error = 'Aenderung gesperrt, solange das Kontrollergebnis bekanntgegeben wird.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (_missionCargoIsPassengerItem(item) && _missionCargoManualPassengerSceneBusy()) {
        window.missionCargoStatus.error = _missionCargoManualPassengerBusyMessage();
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (item.status === 'unloaded') {
        return window.missionCargoLoadItem(itemId, options);
    }
    if (item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped') {
        return window.missionCargoLoadItem(itemId, options);
    }
    if (_missionCargoIsPassengerItem(item) && item.status === 'loaded') {
        const ok = _missionCargoMarkPassengerUnloaded({
            reason: options.reason || 'passenger-manual-unboard',
            manualAnimation: true
        });
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return ok;
    }
    _missionCargoDetachInheritedEquipmentFromBaseline(item);
    item.status = 'pending';
    item.loadedAt = 0;
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    item.healthPct = 100;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    _missionCargoQueueVisibleItemState(item, true, {
        reason: 'cargo-toggle-unload',
        sceneId: _missionCargoSceneId(),
        unloaded: false
    });
    _missionCargoPlayAudioCue('cargo_unload', item, 'unload', { queue: true });
    _missionCargoSyncPayloadToSim('cargo-toggle-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

function _missionCargoIsAirborneNow() {
    const fd = (window.simModeActive && window.gaSimFlightData)
        ? window.gaSimFlightData
        : (window.lastLiveFlightData || {});
    if (typeof fd.onGround === 'boolean') return !fd.onGround;
    const agl = Number(fd.aglFt);
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs ?? 0);
    return (Number.isFinite(agl) && agl > 80) || (missionRuntime.active && Number.isFinite(gs) && gs > 35);
}

window.missionCargoHandleAircraftMovement = function(rawFlightData = null) {
    const fd = rawFlightData && typeof rawFlightData === 'object'
        ? rawFlightData
        : (window.lastLiveFlightData || {});
    const onGroundKnown = typeof fd.onGround === 'boolean';
    const agl = Number(fd.aglFt);
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs ?? 0);
    const departed = onGroundKnown
        ? fd.onGround === false
        : ((Number.isFinite(agl) && agl > 80) || (Number.isFinite(gs) && gs > 35));
    const groundUiKey = `${departed ? 'air' : 'ground'}:${!departed && (!Number.isFinite(gs) || gs <= 5) ? 'still' : 'moving'}`;
    if (window.missionCargoStatus?.groundUiKey !== groundUiKey) {
        window.missionCargoStatus.groundUiKey = groundUiKey;
        setTimeout(() => {
            try { _updateMissionRuntimeUi(); } catch (_) {}
        }, 0);
    }
    if (!departed) return false;

    const aircraftSlot = _missionCargoAircraftSlot();
    const state = _missionCargoReadOnboardEquipmentState();
    const storedEntry = state.aircraft?.[aircraftSlot];
    const lostIds = MISSION_CARGO_PERSISTENT_EQUIPMENT_IDS.filter((id) => {
        const stored = storedEntry?.items?.[id];
        return !!stored && stored.onboard !== true && stored.status !== 'lost';
    });
    if (!lostIds.length) return false;

    const now = Date.now();
    lostIds.forEach((id) => {
        const stored = storedEntry.items[id];
        stored.onboard = false;
        stored.status = 'lost';
        stored.loadedAt = 0;
        stored.unloadLat = null;
        stored.unloadLon = null;
        stored.unloadAltFt = null;
        stored.lostAt = now;
        stored.updatedAt = now;
    });
    storedEntry.updatedAt = now;
    state.updatedAt = now;
    _missionCargoWriteOnboardEquipmentState(state, { scheduleCloud: true });

    const manifests = Array.from(new Set([
        missionCargoGroundInventoryManifest,
        _missionCargoGetManifest()
    ].filter(manifest => manifest && Array.isArray(manifest.items))));
    manifests.forEach((manifest) => {
        let changed = false;
        lostIds.forEach((id) => {
            const item = manifest.items.find(entry => entry?.id === id && entry.persistentEquipment === true);
            if (!item || item.status === 'loaded' || item.status === 'lost') return;
            _missionCargoQueueVisibleItemState(item, false, {
                sceneId: _missionCargoUnloadSceneId(),
                reason: 'ground-equipment-left-behind',
                unloaded: true
            });
            item.status = 'lost';
            item.loadedAt = 0;
            item.unloadedAt = 0;
            item.unloadLat = null;
            item.unloadLon = null;
            item.unloadAltFt = null;
            item.lostAt = now;
            changed = true;
        });
        if (changed) _missionCargoPersistManifest(manifest);
    });
    window.missionCargoStatus.lastEquipmentLossAt = now;
    window.missionCargoStatus.lastEquipmentLossIds = lostIds.slice();
    return true;
};

window.missionCargoStageSimEquipmentAtAircraft = function(reason = 'sim-boarding-stage') {
    if (!window.simModeActive || !_missionCargoGroundHandlingAllowed()) return false;
    const pos = _missionCargoLivePos();
    if (!pos) return false;
    const manifest = _missionCargoEnsureManifest();
    const staged = [];
    (manifest.items || [])
        .filter(item => item?.persistentEquipment === true && item.status === 'unloaded')
        .forEach(item => {
            const previousDistanceM = _missionCargoDistanceToUnloadM(item, pos);
            item.unloadLat = pos.lat;
            item.unloadLon = pos.lon;
            item.unloadAltFt = pos.altFt;
            item.unloadedAt = Number(item.unloadedAt || 0) || Date.now();
            staged.push({
                id: item.id,
                previousDistanceM: Number.isFinite(previousDistanceM) ? Math.round(previousDistanceM) : null
            });
        });
    if (!staged.length) return false;
    _missionCargoPersistManifest(manifest);
    _missionPhaseDebugPush('cargo_sim_equipment_staged', {
        reason,
        position: { lat: pos.lat, lon: pos.lon, altFt: pos.altFt },
        items: staged
    });
    return true;
};

function _missionCargoRemoveLoadedSceneObjects(reason = 'cargo-loaded-sync') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const manifest = _missionCargoEnsureManifest();
    let sent = false;
    manifest.items
        .filter(item => item.status === 'loaded' && item.persistentEquipment !== true && !_missionCargoIsPassengerItem(item))
        .forEach(item => {
            sent = _missionCargoQueueVisibleItemState(item, false, {
                reason,
                unloaded: false,
                sceneId: _missionCargoSceneId(),
                immediate: true
            }) || sent;
        });
    return sent;
}

function _missionCargoEnsurePendingSceneObjects(spawnedObjects = [], reason = 'cargo-pending-sync') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const manifest = _missionCargoEnsureManifest();
    const visibleObjectKeys = new Set((Array.isArray(spawnedObjects) ? spawnedObjects : [])
        .map(object => String(object?.objectKey || '').trim())
        .filter(Boolean));
    let sent = false;
    (manifest.items || [])
        .filter(item => item.status === 'pending')
        .filter(item => item.persistentEquipment !== true)
        .filter(item => item.pickupLocation !== 'target')
        .filter(item => !_missionCargoIsPassengerItem(item))
        .forEach(item => {
            const objectKey = _missionCargoStableObjectKey(item, manifest);
            if (visibleObjectKeys.has(objectKey)) return;
            sent = _missionCargoQueueVisibleItemState(item, true, {
                sceneId: _missionCargoSceneId(),
                reason,
                unloaded: false,
                immediate: true
            }) || sent;
        });
    return sent;
}

function _missionCargoSpawnUnloadedSceneObjects(reason = 'cargo-unloaded-sync') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const manifest = _missionCargoEnsureManifest();
    const pos = _missionCargoCommandBasePos();
    const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
    if (!hasPos) {
        window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Cargo-Spawn.';
        return false;
    }
    let sent = false;
    (manifest.items || [])
        .filter(item => item.status === 'unloaded' && !_missionCargoIsPassengerItem(item))
        .filter(item => !_missionCargoIsPassengerHandoffLocked(item))
        .forEach(item => {
            const storedLat = _missionCargoNullableNumber(item.unloadLat);
            const storedLon = _missionCargoNullableNumber(item.unloadLon);
            if (storedLat !== null && storedLon !== null && !_missionCargoCanReloadUnloadedItem(item)) return;
            const storedAltFt = _missionCargoNullableNumber(item.unloadAltFt);
            sent = _missionCargoQueueVisibleItemState(item, true, {
                sceneId: _missionCargoUnloadSceneId(),
                reason,
                unloaded: true,
                pos: storedLat !== null && storedLon !== null
                    ? {
                        lat: storedLat,
                        lon: storedLon,
                        altFt: storedAltFt ?? Number(pos.altFt || 0),
                        hdg: Number(pos.hdg || 0)
                    }
                    : pos
            }) || sent;
        });
    return sent;
}

function _missionCargoPassengerAlreadyUnloaded() {
    return _missionCargoPassengerUnloadedItems().length > 0 && _missionCargoLoadedPassengerItems().length === 0;
}

window.missionCargoUnloadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status !== 'loaded') return false;
    const renderMode = _missionCargoActionDialogMode(options, 'unload');
    if (window.missionComplianceCanMutateCargo?.(itemId, 'unload') === false) {
        window.missionCargoStatus.error = 'Aenderung gesperrt, solange das Kontrollergebnis bekanntgegeben wird.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    const dropped = options.drop === true || _missionCargoIsAirborneNow();
    if (!dropped && !_missionCargoGroundHandlingAllowed()) {
        window.missionCargoStatus.error = 'Entladen ist nur am Boden und im Stillstand moeglich.';
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return false;
    }
    if (_missionCargoIsPassengerItem(item) && dropped) return false;
    if (!_missionCargoIsPassengerItem(item)) _missionCargoDetachInheritedEquipmentFromBaseline(item);
    if (dropped) {
        const livePos = _missionCargoCommandBasePos();
        item.status = 'dropped';
        item.droppedAt = Date.now();
        item.droppedLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
        item.droppedLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
        item.droppedAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        item.healthPct = 0;
        _missionCargoInvalidateDispatchSignature(manifest);
        _missionCargoPersistManifest(manifest);
        if (item.required && typeof window.triggerPaxCargoEvent === 'function') {
            try {
                window.triggerPaxCargoEvent({ type: 'dropped_required', item: JSON.parse(JSON.stringify(item)), manifest: JSON.parse(JSON.stringify(manifest)) });
            } catch (_) {}
        }
        _missionCargoPlayAudioCue('cargo_drop', item, 'drop');
        _missionCargoSyncPayloadToSim('cargo-drop-item').catch(() => {});
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return true;
    }
    if (_missionCargoIsPassengerItem(item)) {
        const ok = _missionCargoMarkPassengerUnloaded({
            reason: options.reason || 'passenger-manual-unload',
            manualAnimation: true
        });
        if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
        return ok;
    }
    const livePos = _missionCargoCommandBasePos();
    item.status = 'unloaded';
    item.unloadedAt = Date.now();
    item.droppedAt = 0;
    item.unloadLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
    item.unloadLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
    item.unloadAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    _missionCargoPlayAudioCue('cargo_unload', item, 'unload', { queue: true });
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        _missionCargoQueueVisibleItemState(item, true, {
            sceneId: _missionCargoUnloadSceneId(),
            reason: 'cargo-unload',
            unloaded: true,
            pos: livePos
        });
    }
    _missionCargoSyncPayloadToSim('cargo-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog(renderMode, { skipPayloadRefresh: true });
    return true;
};

window.missionCargoSetBoardBookTime = function(itemId, field, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || !/bordbuch/i.test(`${item.id} ${item.label} ${item.storyName}`)) return false;
    if (manifest.groundInventory === true) {
        window.missionCargoStatus.error = 'Kein laufender Missionsflug fuer einen Bordbucheintrag.';
        return false;
    }
    const normalized = field === 'landing' ? 'landing' : 'start';
    const source = String(options.source || 'cargo');
    const directCargoSource = source === 'cargo-manifest' || source === 'cargo-equipment';
    if (source === 'banner') {
        if (item.status !== 'loaded') return false;
    } else if (directCargoSource) {
        if (item.status !== 'loaded' && item.status !== 'unloaded') return false;
    } else if (item.status !== 'unloaded') {
        return false;
    }
    if (window.missionComplianceBoardBookWriteAllowed?.(normalized, options) === false) {
        window.missionCargoStatus.error = 'Der Bordbucheintrag ist in dieser Kontrollphase gesperrt.';
        return false;
    }
    const timestamp = Number(options.timestamp || 0) || _missionCargoFlightEventTimestamp(normalized, manifest);
    const key = normalized === 'landing' ? 'landingTime' : 'startTime';
    const atKey = normalized === 'landing' ? 'landingAt' : 'startAt';
    item.log = item.log && typeof item.log === 'object' ? item.log : {};
    const currentFlightId = window.missionCargoCurrentFlightId?.() || '';
    if (!currentFlightId) return false;
    if (String(item.log.flightId || '') !== String(currentFlightId)) {
        item.log = {};
    }
    item.log.flightId = currentFlightId;
    item.log[key] = _missionCargoFormatLogTime(timestamp);
    item.log[atKey] = timestamp;
    item.log[normalized === 'landing' ? 'destination' : 'origin'] = _missionCargoFlightEndpointLabel(normalized);
    item.log.loggedAt = Date.now();
    item.log.lastSource = source;
    item.log.backfilled = source !== 'banner';
    manifest.flightEvents = manifest.flightEvents && typeof manifest.flightEvents === 'object'
        ? manifest.flightEvents
        : {};
    if (String(manifest.flightEvents.flightId || '') !== String(currentFlightId)) {
        manifest.flightEvents = {};
    }
    manifest.flightEvents.flightId = currentFlightId;
    if (!Number(manifest.flightEvents[atKey] || 0)) {
        manifest.flightEvents[atKey] = timestamp;
    }
    _missionCargoPersistManifest(manifest);
    if (document.getElementById('missionBoardBookReminder')?.dataset?.field === normalized) {
        _missionCargoDismissBoardBookBanner();
    }
    if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
        _missionCargoRenderDialog(window.missionCargoStatus?.lastMode || 'unload', { skipPayloadRefresh: true });
    }
    return true;
};

window.finishMissionCargoLoadingAndStart = async function() {
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoLoadingAndStart' });
    if (typeof window.missionIsFreeflightOnly === 'function' && window.missionIsFreeflightOnly()) {
        window.closeMissionCargoDialog?.();
        return false;
    }
    const manifest = _missionCargoEnsureManifest();
    const requiredMissing = (manifest.items || []).filter(item => item.required && item.pickupLocation !== 'target' && item.status !== 'loaded');
    if (requiredMissing.length > 0) {
        window.missionCargoStatus.error = `Pflichtladung noch offen: ${requiredMissing.map(item => item.storyName || item.label || item.id).join(', ')}`;
        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return false;
    }
    if (!_missionCargoSignatureMatchesMode(manifest.dispatchSignature, 'load')) {
        window.missionCargoSignDispatchList?.({ mode: 'load' });
        return false;
    }
    if (Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now()) {
        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return false;
    }
    if (window.missionCargoStatus?.payloadFinalizeRunning) return false;
    const payloadFinalizeSeq = Number(window.missionCargoStatus.payloadFinalizeSeq || 0) + 1;
    window.missionCargoStatus.payloadFinalizeSeq = payloadFinalizeSeq;
    window.missionCargoStatus.payloadFinalizeRunning = true;
    window.missionCargoStatus.payloadStartOverride = false;
    _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    let payloadAck = null;
    try {
        payloadAck = await _missionCargoSyncPayloadBeforeStart('cargo-finish-loading');
    } finally {
        if (window.missionCargoStatus.payloadFinalizeSeq === payloadFinalizeSeq) {
            window.missionCargoStatus.payloadFinalizeRunning = false;
        }
    }
    if (window.missionCargoStatus.payloadFinalizeSeq !== payloadFinalizeSeq) return false;
    if (!window.simModeActive && window.missionCargoStatus?.payloadNeedsSync) {
        if (!window.liveTrackerConnected) {
            window.missionCargoStatus.error = 'Tracker-Verbindung während der Zuladungsprüfung verloren.';
            _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
            return false;
        }
        window.missionCargoStatus.payloadStartOverride = true;
    }
    window.missionCargoStatus.loadConfirmed = true;
    _missionCargoRemoveLoadedSceneObjects('cargo-finish-loading');
    if (!_missionCargoMaybePromoteStartReady('cargo-finish-loading')) {
        _missionCargoScheduleStartReadyPromotion('cargo-finish-loading');
    }
    window.closeMissionCargoDialog?.();
    _updateMissionRuntimeUi();
    return true;
};

window.missionCargoActivatePickupPassenger = function() {
    if (!_missionBushIsPickupPassengerMission()) return null;
    if (window.activePassenger) return window.activePassenger;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const passenger = md?.passenger || md?.missionContract?.passenger || window.activeMissionContract?.passenger || null;
    if (!passenger || typeof passenger !== 'object') return null;
    window.activePassenger = { ...passenger };
    try { window.attachMissionStorageIdentity?.(window.activePassenger, md); } catch (_) {}
    const pickupPaxText = passenger?.role ? `1 PAX (${passenger.role})` : '1 PAX';
    if (md && typeof md === 'object') {
        md.paxText = pickupPaxText;
        if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.paxText = pickupPaxText;
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.paxText = pickupPaxText;
    }
    try { localStorage.setItem('ga_active_passenger', JSON.stringify(window.activePassenger)); } catch (_) {}
    try { window.paxVoiceRefreshWidget?.(); } catch (_) {}
    return window.activePassenger;
};

window.finishMissionCargoPickupAndContinue = function() {
    if (!_missionBushIsPickupMission()) return false;
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoPickupAndContinue' });
    const manifest = _missionCargoEnsureManifest();
    const pickupItems = (manifest.items || []).filter(item => item?.pickupLocation === 'target');
    const requiredPickupMissing = pickupItems.filter(item => item.required && item.status !== 'loaded');
    if (!pickupItems.length || requiredPickupMissing.length > 0) {
        window.missionCargoStatus.error = requiredPickupMissing.length
            ? `Pickup noch offen: ${requiredPickupMissing.map(item => item.storyName || item.label || item.id).join(', ')}`
            : 'Keine Pickup-Items im Manifest gefunden.';
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
    if (!_missionCargoSignatureMatchesMode(manifest.dispatchSignature, 'pickup')) {
        window.missionCargoSignDispatchList?.({ mode: 'pickup' });
        return false;
    }
    if (Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now()) {
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
    const progress = _activeBushMissionProgress();
    if (progress) {
        _persistBushMissionProgress({
            ...progress,
            pickupReady: false,
            pickupCompleted: true,
            pickupConfirmed: true,
            targetReached: true,
            status: 'return_leg'
        });
    }
    const bush = _activeBushMissionSpec();
    window.missionCargoActivatePickupPassenger?.();
    if (_missionBushIsPickupCargoMission() && typeof window.paxVoiceResetLeg === 'function') {
        try { window.paxVoiceResetLeg(); } catch (_) {}
    }
    if (_missionBushIsPickupCargoMission() && typeof window.triggerPaxCargoPickupBoarding === 'function') {
        setTimeout(() => {
            try {
                window.triggerPaxCargoPickupBoarding();
            } catch (_) {}
        }, 400);
    }
    if (window.simModeActive && typeof window.resumeSimMissionAfterPickup === 'function') {
        try { window.resumeSimMissionAfterPickup(); } catch (_) {}
    }
    if (typeof window.missionArmPickupDepartureVoice === 'function') {
        window.missionArmPickupDepartureVoice(_missionBushIsPickupCargoMission() ? 'cargo' : 'passenger');
        if (window.simModeActive) {
            setTimeout(() => window.missionMaybeTriggerPickupDepartureVoice?.({ onGround: false, gsKts: 80, aglFt: 500 }), 1800);
        }
    }
    if (bush?.requiresReturnHome && bush?.homeRef) {
        const pos = window.lastLiveGpsPos || {};
        const homeLat = Number(bush.homeRef.lat);
        const homeLon = Number(bush.homeRef.lon);
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        if (Number.isFinite(homeLat) && Number.isFinite(homeLon) && Number.isFinite(curLat) && Number.isFinite(curLon)) {
            routeWaypoints = [
                { lat: curLat, lng: curLon, name: 'Pickup RTB' },
                { lat: homeLat, lng: homeLon, name: String(bush.homeRef.name || bush.homeRef.icao || 'Home') }
            ];
            if (typeof currentDestICAO !== 'undefined') currentDestICAO = String(bush.homeRef.icao || currentStartICAO || '').trim().toUpperCase();
            if (typeof currentDName !== 'undefined') currentDName = String(bush.homeRef.name || bush.homeRef.icao || 'Home').trim();
            if (typeof currentMissionData !== 'undefined' && currentMissionData) {
                currentMissionData.routeWaypoints = JSON.parse(JSON.stringify(routeWaypoints));
                currentMissionData.dest = String(bush.homeRef.icao || currentMissionData.dest || '').trim().toUpperCase();
                const nav = (typeof calcNav === 'function') ? calcNav(curLat, curLon, homeLat, homeLon) : null;
                if (nav) {
                    currentMissionData.dist = Number(nav.dist) || currentMissionData.dist;
                    currentMissionData.heading = Number(nav.brng) || currentMissionData.heading;
                }
            }
            try { renderMainRoute?.(); } catch (_) {}
            try { fitMapToRouteWaypoints?.([60, 60]); } catch (_) {}
            try { updateMiniMap?.(); } catch (_) {}
            try { refreshGPSAfterDispatch?.(); } catch (_) {}
            try { window.debouncedSaveMissionState?.(); } catch (_) {}
        }
    }
    if (typeof window.missionAptArrivalClear === 'function') {
        try { window.missionAptArrivalClear('bush-pickup-complete'); } catch (_) {}
    }
    window.closeMissionCargoDialog?.();
    _updateMissionRuntimeUi();
    return true;
};

window.finishMissionCargoUnloadAndEnd = function(options = {}) {
    const source = String(options.source || 'cargo-primary');
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd', source });
    if (!_missionCargoHasActiveMission()) {
        window.closeMissionCargoDialog?.();
        window.openMissionGroundCargoDialog?.();
        return false;
    }
    const complianceUi = window.missionComplianceGetCargoUiState?.() || { active: false };
    if (complianceUi.active === true && complianceUi.phase === 'evidence_open') {
        return !!window.missionComplianceSubmitEvidence?.();
    }
    if (complianceUi.active === true && (
        complianceUi.phase === 'request_playing'
        || complianceUi.phase === 'result_playing'
        || complianceUi.phase === 'departing'
    )) {
        return false;
    }
    const manifest = _missionCargoEnsureManifest();
    const requiredUnloadBlocking = (manifest.items || []).filter(item => (
        item.required
        && item.status === 'loaded'
        && !_missionCargoIsPassengerItem(item)
        && _missionCargoItemNeedsUnloadHere(item)
    ));
    if (requiredUnloadBlocking.length > 0) {
        window.missionCargoStatus.error = `Pflichtladung noch zu entladen: ${requiredUnloadBlocking.map(item => item.storyName || item.label || item.id).join(', ')}`;
        _missionCargoRenderDialog('unload', { skipPayloadRefresh: true });
        return false;
    }
    if (!_missionCargoSignatureMatchesMode(manifest.dispatchSignature, 'unload')) {
        window.missionCargoSignDispatchList?.({ mode: 'unload' });
        return false;
    }
    if (Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now()) {
        _missionCargoRenderDialog('unload', { skipPayloadRefresh: true });
        return false;
    }
    const completesMission = _missionRuntimeGroundEndReady();
    if (options.skipConfirm !== true && !_missionCargoConfirmCriticalAction(completesMission ? 'cargo-end' : 'cargo-unload')) {
        _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd:cancelled', completesMission: !!completesMission, source });
        return false;
    }
    _missionCargoSpawnUnloadedSceneObjects('cargo-finish-unload');
    window.closeMissionCargoDialog?.();
    if (_missionSceneIsBushMission() && typeof _missionBushUpdateProgress === 'function') {
        try { _missionBushUpdateProgress(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon, Date.now()); } catch (_) {}
    }
    if (!_missionRuntimeGroundEndReady()) {
        _updateMissionRuntimeUi();
        return true;
    }
    if (window.simModeActive && typeof window.completeSimMissionEnd === 'function') {
        const completed = !!window.completeSimMissionEnd();
        _missionPhaseDebugPush('trigger', {
            name: 'finishMissionCargoUnloadAndEnd:complete-sim-end-result',
            completed
        });
        if (completed) return true;
        _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd:sim-fallback-manual-end' });
        if (typeof window.manualMissionEnd === 'function') {
            return !!window.manualMissionEnd({ skipCargoUnload: true, skipConfirm: true });
        }
        return true;
    }
    return !!window.manualMissionEnd({ skipCargoUnload: true, skipConfirm: true });
};

function _missionCargoGroundHandlingStatus() {
    const fd = (window.simModeActive && window.gaSimFlightData)
        ? window.gaSimFlightData
        : (window.lastLiveFlightData || {});
    const pos = (window.simModeActive && window.gaSimGpsPos)
        ? window.gaSimGpsPos
        : (window.lastLiveGpsPos || {});
    const gs = Number(fd.gsKts ?? fd.gs ?? pos.gs);
    const agl = Number(fd.aglFt);
    const hasOnGroundFlag = typeof fd.onGround === 'boolean';
    let onGround = hasOnGroundFlag
        ? fd.onGround === true
        : (Number.isFinite(agl) ? agl <= 35 : !_missionCargoIsAirborneNow());
    let ready = onGround && (!Number.isFinite(gs) || gs <= 5);
    let label = ready ? 'Am Boden bereit' : (onGround ? 'Nicht im Stillstand' : 'Nicht am Boden');
    if (!window.simModeActive && typeof _missionStartGroundStatus === 'function') {
        try {
            const groundStatus = _missionStartGroundStatus() || {};
            ready = groundStatus.ready === true;
            onGround = groundStatus.onGround === true
                || groundStatus.reason === 'moving'
                || groundStatus.reason === 'paused'
                || groundStatus.reason === 'menu_or_map';
            label = String(groundStatus.label || label);
        } catch (_) {}
    }
    return { ready, onGround, gs: Number.isFinite(gs) ? gs : null, label };
}
window.missionCargoGroundHandlingStatus = _missionCargoGroundHandlingStatus;

function _missionCargoGroundHandlingAllowed() {
    return _missionCargoGroundHandlingStatus().ready === true;
}
window.missionCargoGroundHandlingAllowed = _missionCargoGroundHandlingAllowed;

window.missionCargoDebugSnapshot = function() {
    const manifest = _missionCargoGetManifest();
    const cargoPos = _missionCargoLivePos();
    const rawPos = window.lastLiveGpsPos || null;
    const simPos = window.gaSimGpsPos || null;
    const formatPos = (pos = null) => {
        const lat = _missionCargoNullableNumber(pos?.lat);
        const lon = _missionCargoNullableNumber(pos?.lon);
        return (lat === null || lon === null)
            ? null
            : {
                lat,
                lon,
                altFt: _missionCargoNullableNumber(pos?.altFt ?? pos?.alt),
                hdg: _missionCargoNullableNumber(pos?.hdg),
                t: Number(pos?.t || 0) || 0
            };
    };
    const items = Array.isArray(manifest?.items)
        ? manifest.items
            .filter(item => item?.persistentEquipment === true)
            .map(item => {
                const unloadLat = _missionCargoNullableNumber(item.unloadLat);
                const unloadLon = _missionCargoNullableNumber(item.unloadLon);
                const distanceM = _missionCargoDistanceToUnloadM(item, cargoPos);
                return {
                    id: String(item.id || ''),
                    label: String(item.storyName || item.label || item.id || 'Bordbestand'),
                    status: String(item.status || ''),
                    unloadLat,
                    unloadLon,
                    unloadAltFt: _missionCargoNullableNumber(item.unloadAltFt),
                    distanceM: Number.isFinite(distanceM) ? Math.round(distanceM) : null,
                    reloadAllowed: _missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M)
                };
            })
        : [];
    const source = window.simModeActive && simPos ? 'sim' : 'live';
    const objectActions = Array.from(_MISSION_CARGO_OBJECT_ACTION_QUEUE.values()).map(state => ({
        objectKey: String(state?.objectKey || ''),
        desiredVisible: state?.desired?.visible === true,
        revision: Number(state?.desired?.revision || 0),
        pendingCommandId: String(state?.pendingCommandId || ''),
        pendingRevision: Number(state?.pendingRevision || 0),
        sentAt: Number(state?.sentAt || 0)
    }));
    return {
        ts: Date.now(),
        source,
        simMode: !!window.simModeActive,
        trackerConnected: !!window.liveTrackerConnected,
        cargoPos: formatPos(cargoPos),
        simPos: formatPos(simPos),
        rawPos: formatPos(rawPos),
        objectActions,
        items
    };
};
