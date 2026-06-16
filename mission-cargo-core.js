// Mission Cargo Core
// Extrahierte Cargo-/Manifest-/Payload-/Outcome-Logik aus sync.js.
// Ziel: Strukturgewinn ohne Verhaltensaenderung.

function _missionCargoMissionKey() {
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

function _missionCargoHasActiveMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
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
    const titleCandidates = itemType === 'cargo' && typeof _missionSceneSafeBoardingCargoCandidates === 'function'
        ? _missionSceneSafeBoardingCargoCandidates(rawTitleCandidates.concat(MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard']))
        : rawTitleCandidates;
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
        log: item.log && typeof item.log === 'object' ? item.log : {},
        objectTitle: title,
        titleCandidates,
        forwardOffsetM: Number.isFinite(Number(item.forwardOffsetM)) ? Number(item.forwardOffsetM) : (items.length * 0.45),
        rightOffsetM: Number.isFinite(Number(item.rightOffsetM)) ? Number(item.rightOffsetM) : (items.length % 2 ? -0.8 : 0),
        pickupLocation: item.pickupLocation === 'target' ? 'target' : '',
        deliverAtHome: item.deliverAtHome === true
    });
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

function _missionCargoExpiryDate(seed = '', monthsMin = 9, monthsRange = 24) {
    const date = new Date();
    const offset = monthsMin + (_stableHashText(`${_missionCargoMissionKey()}|${seed}`) % Math.max(1, monthsRange));
    date.setMonth(date.getMonth() + offset);
    return date.toISOString().slice(0, 10);
}

function _missionCargoGenerateManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
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
        _missionCargoPushItem(items, {
            id: 'primary-cargo',
            sceneKind: 'cargo',
            label: primaryLabel,
            storyName: primaryLabel,
            weightLbs: _missionCargoExtractWeight(cargoText, cargoAsset?.cargoWeightLbs || 20),
            required: true,
            deliverAtDestination: !isPoi && !isBushReturnHomeRecon,
            objectTitle: primaryTitle,
            titleCandidates: primaryCandidates,
            forwardOffsetM: 0,
            rightOffsetM: 0
        });
    }

    _missionCargoPushItem(items, { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', weightLbs: 3, required: false, deliverAtDestination: false, forwardOffsetM: 0.35, rightOffsetM: -0.75 });
    _missionCargoPushItem(items, { id: 'first-aid', label: 'Verbandzeug', weightLbs: 2, required: false, deliverAtDestination: false, equipmentType: 'expiry', expiresAt: _missionCargoExpiryDate('first-aid', 6, 18), forwardOffsetM: 0.65, rightOffsetM: -0.55 });
    _missionCargoPushItem(items, { id: 'fire-extinguisher', label: 'Feuerloescher', weightLbs: 5, required: false, deliverAtDestination: false, equipmentType: 'expiry', expiresAt: _missionCargoExpiryDate('fire-extinguisher', 4, 20), forwardOffsetM: 0.95, rightOffsetM: 0.55 });
    _missionCargoPushItem(items, { id: 'chocks', label: 'Chocks / Radkeile', weightLbs: 6, required: false, deliverAtDestination: false, equipmentType: 'ground', forwardOffsetM: 1.25, rightOffsetM: -0.25 });
    if (/(cargo|freight|fracht|animal_transport)/.test(taskDomain) && !isBushPickupCargo) {
        _missionCargoPushItem(items, { id: 'cargo-docs', label: 'Frachtpapiere und Uebergabeunterlagen', weightLbs: 4, required: true, deliverAtDestination: !isPoi, forwardOffsetM: 0.75, rightOffsetM: 0.8 });
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
        _missionCargoPushItem(items, { id: 'patient-docs', label: 'Patientenakte / Kuehlhinweis', weightLbs: 3, required: true, deliverAtDestination: !isPoi, forwardOffsetM: 0.75, rightOffsetM: 0.85 });
    }
    if (!items.length) {
        _missionCargoPushItem(items, { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', weightLbs: 3, required: false, deliverAtDestination: false });
    }
    return {
        version: 1,
        key,
        taskDomain,
        isPoi,
        createdAt: Date.now(),
        items
    };
}

function _missionCargoGetManifest() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.cargoManifest && typeof md.cargoManifest === 'object') return md.cargoManifest;
    if (md?.missionContract?.cargoManifest && typeof md.missionContract.cargoManifest === 'object') return md.missionContract.cargoManifest;
    if (window.activeMissionContract?.cargoManifest && typeof window.activeMissionContract.cargoManifest === 'object') return window.activeMissionContract.cargoManifest;
    return null;
}

function _missionCargoPersistManifest(manifest) {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md && typeof md === 'object') {
        md.cargoManifest = manifest;
        if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.cargoManifest = manifest;
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.cargoManifest = manifest;
    }
    try {
        window.dispatchEvent(new CustomEvent('missioncargochange', { detail: { manifest } }));
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
    return manifest;
}

function _missionCargoEnsureUiSyncHook() {
    if (missionCargoUiSyncHooked) return;
    missionCargoUiSyncHooked = true;
    window.addEventListener('missioncargochange', () => {
        const overlay = document.getElementById('missionCargoOverlay');
        if (!overlay || overlay.style.display !== 'flex') return;
        const mode = window.missionCargoStatus?.lastMode === 'unload'
            ? 'unload'
            : (window.missionCargoStatus?.lastMode === 'pickup' ? 'pickup' : 'load');
        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
    });
}

function _missionCargoEnsureManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
    let manifest = _missionCargoGetManifest();
    if (!manifest || manifest.key !== key || !Array.isArray(manifest.items) || !manifest.items.length) {
        manifest = _missionCargoGenerateManifest(cargoAsset || _missionSceneCargoAsset());
        _missionCargoPersistManifest(manifest);
    }
    window.missionCargoStatus.manifestKey = manifest.key || key;
    _missionCargoResetPayloadPlanForMissionKey(manifest.key || key);
    return manifest;
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
    if (!manifest || !manifest.dispatchSignature) return false;
    manifest.dispatchSignature = null;
    return true;
}

function _missionCargoClearSignatureAnimation() {
    if (window.missionCargoStatus?.signatureAnimationTimer) {
        clearTimeout(window.missionCargoStatus.signatureAnimationTimer);
        window.missionCargoStatus.signatureAnimationTimer = 0;
    }
    if (window.missionCargoStatus) window.missionCargoStatus.signatureAnimationEndsAt = 0;
}

function _missionCargoStartSignatureAnimation(options = {}) {
    const durationMs = Math.max(300, Number(options.durationMs) || 1600);
    _missionCargoClearSignatureAnimation();
    if (!window.missionCargoStatus) return;
    window.missionCargoStatus.signatureAnimationEndsAt = Date.now() + durationMs;
    window.missionCargoStatus.signatureAnimationTimer = window.setTimeout(() => {
        if (window.missionCargoStatus) {
            window.missionCargoStatus.signatureAnimationTimer = 0;
            window.missionCargoStatus.signatureAnimationEndsAt = 0;
        }
        if (options.render !== false && document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
            _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        }
    }, durationMs + 40);
}

window.missionCargoSignDispatchList = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    manifest.dispatchSignature = {
        by: _missionCargoPilotId(),
        at: Date.now(),
        aircraft: _missionCargoAircraftLabel(),
        note: String(options?.note || '').trim()
    };
    _missionCargoPersistManifest(manifest);
    if (options.animate !== false) _missionCargoStartSignatureAnimation({ render: options.render !== false });
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoClearDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    if (!manifest.dispatchSignature) return false;
    _missionCargoClearSignatureAnimation();
    manifest.dispatchSignature = null;
    _missionCargoPersistManifest(manifest);
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    if (manifest.dispatchSignature) return window.missionCargoClearDispatchSignature(options);
    return window.missionCargoSignDispatchList(options);
};

function _missionCargoSceneId() {
    return window.missionSceneStatus?.sceneId || _missionSceneId();
}

function _missionCargoUnloadSceneId() {
    return `${_missionSceneId()}-cargo-unload`;
}

function _missionCargoLivePos() {
    const pos = window.lastLiveGpsPos || {};
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
    const unloadLat = Number(item?.unloadLat);
    const unloadLon = Number(item?.unloadLon);
    if (!Number.isFinite(unloadLat) || !Number.isFinite(unloadLon)) return null;
    const pos = livePos || _missionCargoLivePos();
    if (!pos) return null;
    return _haversineNmLocal(pos.lat, pos.lon, unloadLat, unloadLon) * 1852;
}

function _missionCargoCanReloadUnloadedItem(item, maxDistanceM = MISSION_CARGO_RELOAD_MAX_DISTANCE_M) {
    if (!item || item.status !== 'unloaded') return true;
    if (!window.liveTrackerConnected) return true;
    const unloadLat = Number(item.unloadLat);
    const unloadLon = Number(item.unloadLon);
    if (!Number.isFinite(unloadLat) || !Number.isFinite(unloadLon)) return true;
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

function _missionCargoPassengerSpawnPlacement(item = null) {
    const cfg = _missionSceneBoardingConfig();
    const target = cfg?.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
    const targetForward = Number.isFinite(Number(target.forwardM)) ? Number(target.forwardM) : 4.5;
    const targetRight = Number.isFinite(Number(target.rightM)) ? Number(target.rightM) : 8.5;
    const targetAlt = Number.isFinite(Number(target.altOffsetFt)) ? Number(target.altOffsetFt) : 0;
    const itemAlt = Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0;
    return {
        forwardM: targetForward + _missionCargoItemForwardM(item),
        rightM: targetRight + _missionCargoItemRightM(item),
        altOffsetFt: targetAlt + itemAlt
    };
}

function _missionCargoVisibleKind(item = null, options = {}) {
    const base = String(item?.sceneKind || item?.id || 'cargo').trim() || 'cargo';
    return options.unloaded ? `unloaded_${base}` : base;
}

function _missionCargoVisibleSelectors(item = null, options = {}) {
    const visibleKind = _missionCargoVisibleKind(item, options);
    const baseKind = String(item?.sceneKind || '').trim();
    const extraKinds = Array.isArray(options.extraKinds) ? options.extraKinds.map(v => String(v || '').trim()).filter(Boolean) : [];
    return {
        kinds: Array.from(new Set([visibleKind, baseKind, ...extraKinds].filter(Boolean))),
        labels: [item?.label, item?.storyName].filter(Boolean),
        itemIds: [item?.id].filter(Boolean),
        cargoSceneKinds: Array.from(new Set([baseKind, visibleKind].filter(Boolean)))
    };
}

function _missionCargoRemoveVisibleItem(item = null, options = {}) {
    if (!item || window.simModeActive || !window.liveTrackerConnected || _missionCargoIsPassengerItem(item)) return false;
    const sceneId = options.sceneId || (options.unloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_remove',
        sceneId,
        reason: options.reason || 'cargo-visible-remove',
        ..._missionCargoVisibleSelectors(item, { unloaded: !!options.unloaded, extraKinds: options.extraKinds })
    });
    window.missionCargoStatus.lastCommandAt = Date.now();
    window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_remove', commandId, itemId: item.id };
    return !!commandId;
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
    const placement = _missionCargoGroundSpawnPlacement(item);
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_spawn',
        sceneId,
        reason: options.reason || 'cargo-visible-spawn',
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        items: [{
            kind,
            itemId: item.id || '',
            cargoItemId: item.id || '',
            cargoSceneKind: item.sceneKind || kind,
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
    window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId: item.id };
    return !!commandId;
}

function _missionCargoLoadedItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => item.status === 'loaded' || item.status === 'unloaded');
}

function _missionCargoItemCanLoadAtCurrentStage(item = null) {
    if (!item || typeof item !== 'object') return false;
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
    const loadedPassengerItem = manifest && Array.isArray(manifest.items)
        ? manifest.items.find(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded')
        : null;
    if (loadedPassengerItem) return Math.max(0, Math.min(6, Math.round(Number(loadedPassengerItem.passengerCount) || 1)));
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
    window.missionCargoStatus.payloadMissionKey = manifestKey;
    window.missionCargoStatus.payloadBaseline = null;
    window.missionCargoStatus.payloadLayout = null;
    window.missionCargoStatus.payloadPlan = null;
    window.missionCargoStatus.payloadSyncQueued = '';
    window.missionCargoStatus.payloadPendingResetStations = null;
    window.missionCargoStatus.payloadPendingResetMaxStations = 0;
    window.missionCargoStatus.payloadVerification = null;
    window.missionCargoStatus.payloadVerificationRunning = false;
    if (manifestKey) window.missionCargoStatus.payloadNeedsSync = false;
}

function _missionCargoNormalizePayloadSnapshot(snapshot = null) {
    const raw = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if (!raw) return null;
    const rawCount = (raw.payloadStationCount ?? raw.sampledStationCount ?? (Array.isArray(raw.stations) ? raw.stations.length : 0));
    const stationCount = Math.max(1, Math.min(15, Math.round(Number(rawCount || 0))));
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
    return {
        totalWeightLbs: Number.isFinite(Number(raw.totalWeightLbs)) ? Number(raw.totalWeightLbs) : null,
        emptyWeightLbs: Number.isFinite(Number(raw.emptyWeightLbs)) ? Number(raw.emptyWeightLbs) : null,
        fuelWeightLbs: Number.isFinite(Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs)) ? Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs) : null,
        payloadWeightLbs: Number.isFinite(Number(raw.payloadWeightLbs)) ? Number(raw.payloadWeightLbs) : null,
        payloadStationCount: stationCount,
        sampledStationCount: Math.max(stationCount, Math.min(15, Math.round(Number(raw.sampledStationCount || stationCount)))),
        stations
    };
}

function _missionCargoBuildPayloadLayout(snapshot = null) {
    const count = Math.max(1, Math.min(15, Math.round(Number(snapshot?.payloadStationCount ?? 1) || 1)));
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

function _missionCargoBuildMissionExtraPlan(manifest, layout) {
    const missionByStation = new Map();
    const assignments = [];
    const passengerItems = (manifest?.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
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

    const loadedItems = (manifest?.items || []).filter(item => item.status === 'loaded' && !_missionCargoIsPassengerItem(item));
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

function _missionCargoBuildPlanFromManifest(manifest, baseline) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(baseline);
    if (!snapshot) return null;
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

async function _missionCargoVerifyPayloadStable(targetStations = [], options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadGet !== 'function') {
        return { status: 'skipped' };
    }
    const targets = (Array.isArray(targetStations) ? targetStations : [])
        .map(row => ({
            index: Math.round(Number(row?.index)),
            weightLbs: Math.round(Math.max(0, Number(row?.weightLbs || 0)) * 10) / 10
        }))
        .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 15 && Number.isFinite(row.weightLbs));
    if (!targets.length) return { status: 'no_targets' };
    const delays = Array.isArray(options.delaysMs) && options.delaysMs.length
        ? options.delaysMs
        : [900, 2400];
    const maxStations = Math.max(1, Math.min(15, Math.round(Number(options.maxStations || targets.length || 12)) || 12));
    const startedAt = Date.now();
    let lastAck = null;
    let lastCheck = null;
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
            lastAck = await _missionCargoRefreshPayloadSnapshot({
                force: true,
                maxStations,
                timeoutMs: Number(options.timeoutMs) || 12000
            });
            const snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
            lastCheck = _missionCargoComparePayloadStations(snapshot, targets, options.toleranceLbs || 1);
            if (!lastCheck.ok) break;
        }
        const result = {
            status: lastCheck?.ok ? 'ok' : 'unstable',
            reason: lastCheck?.ok ? 'stable' : (lastCheck?.reason || lastAck?.error || lastAck?.status || 'payload_unstable'),
            elapsedMs: Date.now() - startedAt,
            check: lastCheck,
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
    if (!window.missionCargoStatus.payloadBaseline || Number(window.missionCargoStatus.payloadBaseline?.payloadStationCount || 0) !== Number(normalized.payloadStationCount || 0)) {
        window.missionCargoStatus.payloadBaseline = normalized;
        window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(normalized);
    }
    return window.missionCargoStatus.payloadBaseline;
}

function _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshotNow) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(snapshotNow);
    if (!snapshot) return [];
    const layout = _missionCargoBuildPayloadLayout(snapshot);
    const missionPlan = _missionCargoBuildMissionExtraPlan(manifestBeforeReset, layout);
    return snapshot.stations.map((row) => {
        const missionExtra = Number(missionPlan.missionByStation.get(row.index) || 0);
        const currentWeight = Math.max(0, Number(row.weightLbs || 0));
        return {
            index: row.index,
            weightLbs: Math.round(Math.max(0, currentWeight - missionExtra) * 10) / 10
        };
    });
}

function _missionCargoResetManifestState(manifest) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    let changed = false;
    manifest.items.forEach((item) => {
        const nextStatus = 'pending';
        if (item.status !== nextStatus) changed = true;
        item.status = nextStatus;
        if (item.loadedAt || item.unloadedAt || item.droppedAt) changed = true;
        item.loadedAt = 0;
        item.unloadedAt = 0;
        item.droppedAt = 0;
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
    if (baseline && Array.isArray(baseline.stations) && baseline.stations.length && (!snapshot || baseline.payloadStationCount === snapshot.payloadStationCount)) {
        targetStations = baseline.stations.map(row => ({ index: row.index, weightLbs: Math.max(0, Number(row.weightLbs || 0)) }));
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
    window.missionCargoStatus.payloadNeedsSync = !!window.missionCargoStatus.payloadPendingResetStations;

    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function' || !targetStations.length) {
        return { status: changed ? 'reset_app_only' : 'noop' };
    }

    const setAck = await window.trackerPayloadSet(targetStations, {
        maxStations: targetMaxStations || 12,
        timeoutMs: 15000,
        refreshAfter: true
    });
    if (setAck?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
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
    if (!rows.length) return { status: 'no_pending_reset' };
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') return { status: 'skipped' };
    const ack = await window.trackerPayloadSet(rows, {
        maxStations: Math.max(1, Number(window.missionCargoStatus?.payloadPendingResetMaxStations || rows.length) || rows.length),
        timeoutMs: 15000,
        refreshAfter: true
    });
    if (ack?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
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

function _missionCargoPayloadStatusMessageHtml() {
    const verification = window.missionCargoStatus?.payloadVerification || null;
    const running = !!window.missionCargoStatus?.payloadVerificationRunning;
    if (running || verification?.status === 'running') {
        return '<div class="mission-cargo-payload-message is-pending">Sim-Zuladung wird nach dem Setzen erneut geprueft ...</div>';
    }
    if (verification?.status === 'unstable') {
        const mismatch = Array.isArray(verification?.check?.mismatches) ? verification.check.mismatches[0] : null;
        const detail = mismatch
            ? ` S${Math.round(Number(mismatch.index) || 0)} Ziel ${Math.round(Number(mismatch.targetWeightLbs) || 0)} lbs, Sim ${Number.isFinite(Number(mismatch.actualWeightLbs)) ? Math.round(Number(mismatch.actualWeightLbs)) : '-'} lbs.`
            : '';
        return `<div class="mission-cargo-payload-message is-warn">Sim hat die Zuladung kurz angenommen, aber wieder zurueckgesetzt.${detail} Dieses Flugzeug verwaltet Weight & Balance vermutlich selbst; bitte im aircraft-eigenen Lade-/Tablet-Menue setzen.</div>`;
    }
    if (verification?.status === 'ok') {
        return '<div class="mission-cargo-payload-message is-ok">Sim-Zuladung stabil uebernommen.</div>';
    }
    const error = String(window.missionCargoStatus?.error || window.aircraftPayloadStatus?.error || '').trim();
    if (window.missionCargoStatus?.payloadNeedsSync && error) {
        const text = error === 'payload_unstable_aircraft_override'
            ? 'Sim-Zuladung wurde vom Flugzeug wieder ueberschrieben.'
            : `Sim-Zuladung noch nicht synchron (${error}).`;
        return `<div class="mission-cargo-payload-message is-warn">${_missionCargoEscape(text)}</div>`;
    }
    return '';
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
    const fuelWeight = Number.isFinite(Number(snapshot.fuelWeightLbs)) ? Number(snapshot.fuelWeightLbs) : Number(window.lastLiveFlightData?.fuelWeightLbs);
    const stationRows = (plan?.stations || snapshot.stations || []).map((row) => {
        const target = Number(row?.weightLbs);
        const base = Number(row?.baselineWeightLbs);
        const extra = Number(row?.missionExtraLbs);
        const detail = Number.isFinite(base) && Number.isFinite(extra)
            ? ` (Basis ${Math.round(base)} + ${Math.round(extra)} lbs)`
            : '';
        return `<span>S${Math.round(Number(row?.index) || 0)}: ${Number.isFinite(target) ? Math.round(target) : '-'} lbs${detail}</span>`;
    }).join(' · ');
    const missionExtra = Number.isFinite(Number(plan?.missionWeightLbs)) ? Number(plan.missionWeightLbs) : null;
    const paxPart = Number.isFinite(Number(plan?.paxWeightLbs)) ? `Pax ${Math.round(plan.paxWeightLbs)} lbs` : 'Pax n/a';
    const cargoPart = Number.isFinite(Number(plan?.cargoWeightLbs)) ? `Cargo ${Math.round(plan.cargoWeightLbs)} lbs` : 'Cargo n/a';
    return `
        <div class="mission-cargo-payload-summary">
            <div>Sim aktuell: Gesamt ${Number.isFinite(Number(snapshot.totalWeightLbs)) ? Math.round(snapshot.totalWeightLbs) : '-'} lbs · Leer ${Number.isFinite(Number(snapshot.emptyWeightLbs)) ? Math.round(snapshot.emptyWeightLbs) : '-'} lbs · Fuel ${Number.isFinite(fuelWeight) ? Math.round(fuelWeight) : '-'} lbs</div>
            <div>Nutzlaststationen: ${snapshot.payloadStationCount} · Verteilung: Copilot S${layout.copilotIndex} · Ruecksitze ${_missionCargoFormatStationList(layout.rearSeatIndices)} · Cargo ${_missionCargoFormatStationList(layout.cargoIndices)}</div>
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
        maxStations: Math.max(4, Math.min(15, Math.round(Number(options?.maxStations ?? 12) || 12))),
        timeoutMs: Number(options?.timeoutMs) || 12000
    });
}

async function _missionCargoSyncPayloadToSim(reason = 'cargo-sync') {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') {
        window.missionCargoStatus.payloadNeedsSync = true;
        return { status: 'skipped' };
    }
    if (window.missionCargoStatus.payloadSyncRunning) {
        window.missionCargoStatus.payloadSyncQueued = reason;
        return { status: 'queued' };
    }
    window.missionCargoStatus.payloadSyncRunning = true;
    window.missionCargoStatus.payloadSyncQueued = '';
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
            const getAck = await _missionCargoRefreshPayloadSnapshot({ force: true, maxStations: 12, timeoutMs: 12000 });
            if (getAck?.status !== 'ok' && !window.aircraftPayloadStatus?.snapshot) {
                window.missionCargoStatus.payloadNeedsSync = true;
                return getAck || { status: 'no_snapshot' };
            }
        }
        const baseline = _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
        if (!baseline) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_baseline' };
        }
        const plan = _missionCargoBuildPlanFromManifest(manifest, baseline);
        if (!plan || !Array.isArray(plan.stations) || !plan.stations.length) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_plan' };
        }
        window.missionCargoStatus.payloadLayout = plan.layout;
        window.missionCargoStatus.payloadPlan = plan;
        const setAck = await window.trackerPayloadSet(
            plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })),
            { maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12, timeoutMs: 15000, refreshAfter: true }
        );
        window.missionCargoStatus.payloadSyncAt = Date.now();
        if (setAck?.status === 'ok') {
            const verifyAck = await _missionCargoVerifyPayloadStable(
                plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })),
                {
                    reason,
                    maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12,
                    timeoutMs: 12000
                }
            );
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
        window.missionCargoStatus.payloadNeedsSync = true;
        window.missionCargoStatus.error = err?.message || String(err);
        return { status: 'error', error: err?.message || String(err) };
    } finally {
        window.missionCargoStatus.payloadSyncRunning = false;
        const queued = window.missionCargoStatus.payloadSyncQueued;
        window.missionCargoStatus.payloadSyncQueued = '';
        if (queued) setTimeout(() => { _missionCargoSyncPayloadToSim(`queued:${queued}`); }, 180);
    }
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
        totalWeightLbs: Math.round(items.reduce((sum, item) => sum + Number(item.weightLbs || 0), 0))
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
            deliverAtHome: item.deliverAtHome === true
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
    if (!_missionCargoHasActiveMission()) return null;
    _missionCargoApplyStressSnapshot();
    return JSON.parse(JSON.stringify(_missionCargoEnsureManifest()));
};

function _missionCargoNeedsUnload() {
    const manifest = _missionCargoEnsureManifest();
    if (manifest.isPoi) return false;
    return _missionCargoLoadedItems(manifest).some(item => _missionCargoItemNeedsUnloadHere(item) && item.status !== 'unloaded');
}
window.missionCargoNeedsUnload = _missionCargoNeedsUnload;

function _missionCargoAutoLoadEnabled() {
    try {
        return localStorage.getItem(MISSION_CARGO_AUTO_LOAD_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function _updateMissionCargoAutoLoadButton() {
    const btn = document.getElementById('missionCargoAutoLoadBtn');
    if (!btn) return;
    const enabled = _missionCargoAutoLoadEnabled();
    btn.textContent = enabled ? 'AUTO LOAD: AN' : 'AUTO LOAD: AUS';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.classList.toggle('is-on', enabled);
    btn.classList.toggle('is-off', !enabled);
}

window.toggleMissionCargoAutoLoadOption = function() {
    const next = !_missionCargoAutoLoadEnabled();
    try {
        if (next) localStorage.setItem(MISSION_CARGO_AUTO_LOAD_KEY, '1');
        else localStorage.removeItem(MISSION_CARGO_AUTO_LOAD_KEY);
    } catch (_) {}
    _updateMissionCargoAutoLoadButton();
    if (next && document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
        _missionCargoMarkAllLoaded({ despawn: false });
        _missionCargoRenderDialog('load');
    }
    return next;
};

function _missionCargoMarkAllLoaded({ despawn = true } = {}) {
    const manifest = _missionCargoEnsureManifest();
    let changed = false;
    manifest.items.forEach(item => {
        if (!_missionCargoItemCanLoadAtCurrentStage(item)) return;
        if (item.status !== 'loaded' && item.status !== 'unloaded') {
            item.status = 'loaded';
            item.loadedAt = Date.now();
            changed = true;
            if (despawn) _missionCargoRemoveVisibleItem(item, { reason: 'cargo-auto-load' });
        }
    });
    if (_missionCargoInvalidateDispatchSignature(manifest)) changed = true;
    if (changed) {
        _missionCargoPersistManifest(manifest);
        _missionCargoSyncPayloadToSim('cargo-mark-all-loaded').catch(() => {});
    }
    return changed;
}

function _missionCargoMarkPassengerLoaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(_missionCargoIsPassengerItem);
    if (!item) return false;
    if (!_missionCargoItemCanLoadAtCurrentStage(item)) return false;
    if (item.status === 'loaded') return false;
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
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
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
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-load-sync').catch(() => {});
    return true;
}

function _missionCargoMarkPassengerUnloaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(entry => _missionCargoIsPassengerItem(entry) && entry.status === 'loaded');
    if (!item) return false;
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
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
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
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-unload-sync').catch(() => {});
    return true;
}

function _missionCargoEscape(text = '') {
    if (typeof escapeHtmlLite === 'function') return escapeHtmlLite(text);
    return String(text || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function _missionCargoRenderDialog(mode = 'load', options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const groundHandlingAllowed = _missionCargoGroundHandlingAllowed();
    const isPickup = mode === 'pickup';
    if (!isPickup && mode !== 'unload' && groundHandlingAllowed && _missionCargoAutoLoadEnabled()) {
        _missionCargoMarkAllLoaded({ despawn: false });
        if (window.missionSceneStatus?.spawned) _missionCargoRemoveLoadedSceneObjects('cargo-auto-load-open');
    }
    _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
    if (window.missionCargoStatus.payloadBaseline) {
        window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(manifest, window.missionCargoStatus.payloadBaseline);
    }
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
    const isUnload = mode === 'unload';
    const missionStartReady = (isUnload || isPickup) ? true : _missionCargoLoadInteractionReady();
    const visibleItems = isUnload
        ? manifest.items.filter(item => (item.status === 'loaded' || item.status === 'unloaded' || item.status === 'dropped') && _missionCargoItemNeedsUnloadHere(item))
        : (isPickup
            ? manifest.items.filter(item => item.pickupLocation === 'target')
            : manifest.items);
    const requiredMissing = manifest.items.filter(item => item.required && item.pickupLocation !== 'target' && item.status !== 'loaded' && item.status !== 'unloaded').length;
    const requiredUnloadMissing = manifest.items.filter(item => item.required && _missionCargoItemNeedsUnloadHere(item) && item.status === 'loaded').length;
    const requiredPickupMissing = visibleItems.filter(item => item.required && item.status !== 'loaded' && item.status !== 'unloaded').length;
    const signature = manifest.dispatchSignature && typeof manifest.dispatchSignature === 'object' ? manifest.dispatchSignature : null;
    const signatureAnimating = !!signature && !isUnload && !isPickup && Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now();
    const signatureReady = !!signature && !signatureAnimating;
    const assignmentMap = new Map(
        ((window.missionCargoStatus?.payloadPlan?.assignments) || [])
            .filter(row => (row?.type === 'cargo' && row?.itemId) || row?.type === 'pax')
            .map(row => [row?.itemId ? String(row.itemId) : 'mission-passenger', Array.isArray(row.stations) ? row.stations.join('/') : '-'])
    );
    const livePos = _missionCargoLivePos();
    const pickupBoardingActive = isPickup && _missionBushIsPickupPassengerMission() && !!(window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive);
    const pickupItemTypeLabel = _missionBushIsPickupCargoMission() ? 'Rueckholfracht' : 'wartenden Pickup-Gast';
    const rows = visibleItems.map(item => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const loaded = item.status === 'loaded' || item.status === 'unloaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const reloadDistanceM = _missionCargoDistanceToUnloadM(item, livePos);
        const canReloadNearby = _missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
        const action = isUnload
            ? (dropped
                ? `<button class="mission-cargo-row-btn" disabled>Abgeworfen</button>`
                : (unloaded
                ? `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canReloadNearby) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'unload-reload' })">${!groundHandlingAllowed ? 'Nur am Boden' : (canReloadNearby ? (isPassenger ? 'Einsteigen' : 'Wieder laden') : 'Zu weit weg')}</button>`
                : `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed && isPassenger) ? 'disabled' : ''} onclick="window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}')">${groundHandlingAllowed ? (isPassenger ? 'Aussteigen' : 'Ausladen') : (isPassenger ? 'Nur am Boden' : 'Abwerfen')}</button>`))
            : `<button class="mission-cargo-row-btn" ${(loaded || dropped || !groundHandlingAllowed || !_missionCargoItemCanLoadAtCurrentStage(item) || pickupBoardingActive) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: '${isPickup ? 'pickup' : 'load'}' })">${pickupBoardingActive ? '… Boarding' : (!groundHandlingAllowed ? 'Nur am Boden' : (!_missionCargoItemCanLoadAtCurrentStage(item) ? 'Am Ziel' : (dropped ? 'Abgeworfen' : (loaded ? (isPassenger ? 'An Bord' : 'Geladen') : (isPassenger ? 'Einsteigen' : 'Laden')))))}</button>`;
        const status = dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (loaded ? (isPassenger ? 'an bord' : 'geladen') : 'offen'));
        const distanceMeta = (isUnload && unloaded && Number.isFinite(reloadDistanceM))
            ? ` · Distanz ${Math.round(reloadDistanceM)} m`
            : '';
        return `
            <div class="mission-cargo-row ${item.required ? 'is-required' : 'is-optional'} ${loaded ? 'is-loaded' : ''} ${dropped ? 'is-dropped' : ''}">
                <div class="mission-cargo-row-main">
                    <div class="mission-cargo-row-title">${_missionCargoEscape(item.storyName || item.label)}</div>
                    <div class="mission-cargo-row-meta">${item.required ? 'Pflicht' : 'Optional'} · ${Math.round(Number(item.weightLbs) || 0)} lbs · ${status}${distanceMeta}</div>
                </div>
                ${action}
            </div>`;
    }).join('') || `<div class="mission-cargo-empty">${isUnload ? 'Keine geladene Zielfracht offen.' : 'Keine Ladung fuer diese Mission.'}</div>`;
    const clipboardRows = visibleItems.map((item, idx) => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const loaded = item.status === 'loaded' || item.status === 'unloaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const status = dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (loaded ? (isPassenger ? 'an bord' : 'geladen') : 'offen'));
        const stationText = assignmentMap.get(String(item.id)) || (loaded ? 'auto' : '-');
        const rowAction = (!isUnload && !isPickup && groundHandlingAllowed && _missionCargoItemCanLoadAtCurrentStage(item)) ? ` onclick="window.missionCargoToggleItemLoadState && missionCargoToggleItemLoadState('${item.id}')"` : '';
        return `
            <tr class="${loaded ? 'is-loaded' : ''} ${(!isUnload && groundHandlingAllowed) ? 'is-interactive' : ''}"${rowAction}>
                <td>${idx + 1}</td>
                <td>${_missionCargoEscape(item.storyName || item.label || item.id)}</td>
                <td>${isPassenger ? `PAX${Number(item.passengerCount || 0) > 1 ? ` x${Number(item.passengerCount)}` : ''}` : (item.required ? 'Pflicht' : 'Optional')}</td>
                <td>${Math.round(Number(item.weightLbs) || 0)} lbs</td>
                <td>${_missionCargoEscape(stationText)}</td>
                <td>${status}</td>
            </tr>`;
    }).join('') || `<tr><td colspan="6">Keine Ladung fuer diese Mission.</td></tr>`;
    const metaAircraft = _missionCargoAircraftLabel();
    const metaPilot = _missionCargoPilotId();
    const metaDate = _missionCargoFormatDate(signature?.at || Date.now());
    const signatureName = _missionCargoEscape(signature?.by || metaPilot);
    const signaturePanel = (!isUnload && !isPickup) ? `
        <div class="mission-cargo-signature ${signature ? 'is-signed' : ''} ${signatureAnimating ? 'is-animating' : ''} ${signatureAnimating ? '' : 'is-clickable'}" onclick="${signatureAnimating ? '' : 'window.missionCargoToggleDispatchSignature && missionCargoToggleDispatchSignature()'}">
            <div class="mission-cargo-signature-line">${signature ? `<span class="mission-cargo-signature-name">${signatureName}</span>` : '&nbsp;'}</div>
            <div class="mission-cargo-signature-meta">Unterschrift Pilot · ${signature ? _missionCargoEscape(_missionCargoFormatDate(signature.at)) : 'noch offen'} · ${signatureAnimating ? 'wird eingetragen' : (signatureReady ? 'Klick: Signatur loeschen' : 'Klick: unterschreiben')}</div>
        </div>` : '';
    const pickupReadyToConfirm = isPickup && requiredPickupMissing === 0 && visibleItems.length > 0;
    const unloadCompletesMission = isUnload && _missionRuntimeGroundEndReady();
    const primaryActionJs = (!isUnload && !isPickup && !signatureReady)
        ? 'window.missionCargoSignDispatchList && missionCargoSignDispatchList()'
        : (isUnload
        ? 'window.finishMissionCargoUnloadAndEnd && finishMissionCargoUnloadAndEnd()'
        : (isPickup
            ? 'window.finishMissionCargoPickupAndContinue && finishMissionCargoPickupAndContinue()'
            : 'window.finishMissionCargoLoadingAndStart && finishMissionCargoLoadingAndStart()'));
    const primaryActionLabel = (!isUnload && !isPickup && !signatureReady)
        ? (signatureAnimating ? 'Unterschrift wird eingetragen ...' : 'Unterschrift eintragen')
        : (isUnload
        ? (unloadCompletesMission ? 'Entladung abgeschlossen - Mission beenden' : 'Entladung abschliessen')
        : (isPickup ? 'Pickup bestaetigen und Rueckflug freigeben' : 'Verladung abschliessen'));
    const secondaryAction = (!isUnload && !isPickup && signatureReady)
        ? `<button class="mission-cargo-secondary" onclick="window.missionCargoClearDispatchSignature && missionCargoClearDispatchSignature()">Zurueck zur Liste</button>`
        : '';
    const listMarkup = (!isUnload && !isPickup)
        ? ''
        : `<div class="mission-cargo-list">${rows}</div>`;
    const modeHint = isUnload
        ? (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Im Flug kann Ladung nur abgeworfen werden. Als geliefert gilt sie erst nach Ausladen am Boden.</div>' : '')
        : (isPickup
            ? (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Pickup ist nur im Stillstand am Zielstrip moeglich.</div>' : '<div class="mission-cargo-summary">Zum Treffpunkt rollen, Pickup laden und danach den Rueckflug bestaetigen.</div>')
            : (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Verladung ist nur am Boden moeglich. Im Flug bleibt diese Liste nur zur Dokumentation sichtbar.</div>' : ''));
    overlay.innerHTML = `
        <div class="mission-cargo-panel">
            <div class="mission-cargo-head">
                <div>
                    <div class="mission-cargo-kicker">${isUnload ? 'Ankunft' : 'Abflug'}</div>
                    <div class="mission-cargo-title">${isUnload ? 'Ladung entladen' : (isPickup ? 'Pickup am Zielstrip' : 'Verladung')}</div>
                </div>
                <button class="mission-cargo-close" onclick="window.closeMissionCargoDialog && closeMissionCargoDialog()" title="Schliessen">×</button>
            </div>
            ${modeHint}
            <div class="mission-cargo-copy">${isUnload
                ? `Entlade die am Ziel benoetigten Gegenstaende. Wiederladen geht im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m.`
                : (isPickup
                    ? `Hier laedst du ${pickupItemTypeLabel} am Zielstrip ein. Nach der Bestaetigung wird der Rueckflug freigegeben.`
                    : (window.missionCargoStatus?.loadConfirmed
                        ? (missionStartReady
                            ? 'Verladung ist bestaetigt. Die Mission ist jetzt startbereit.'
                            : 'Verladung ist bestaetigt. Mission starten wird freigegeben, sobald Boarding und Ansage fertig sind.')
                        : (missionStartReady
                            ? 'Die Boarding-Animation ist abgeschlossen. Nach dem Abschliessen der Verladung ist die Mission startbereit.'
                            : 'Verladen ist bereits moeglich. Die eigentliche Missionsaktivierung wird erst nach Boarding und Verladung freigeschaltet.')))}</div>
            ${(!isUnload && !isPickup) ? `
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
            ${_missionCargoPayloadSummaryHtml(mode)}
            ${listMarkup}
            <div class="mission-cargo-summary">
                <span>${isUnload ? `${requiredUnloadMissing} Pflicht-Items noch an Bord` : (isPickup ? `${requiredPickupMissing} Pickup-Items offen` : `${requiredMissing} Pflicht-Items offen`)}</span>
                <span>${manifest.items.reduce((sum, item) => sum + ((item.status === 'loaded' || item.status === 'unloaded') ? Number(item.weightLbs || 0) : 0), 0)} lbs geladen</span>
            </div>
            <div class="mission-cargo-actions">
                ${secondaryAction}
                <button class="mission-cargo-primary" ${((isUnload && !groundHandlingAllowed) || (isPickup && (!groundHandlingAllowed || !pickupReadyToConfirm)) || (!isUnload && !isPickup && (!groundHandlingAllowed || signatureAnimating))) ? 'disabled' : ''} onclick="${primaryActionJs}">${primaryActionLabel}</button>
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
    _updateMissionCargoAutoLoadButton();
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

window.openMissionCargoDialog = function(mode = 'load') {
    _missionCargoEnsureUiSyncHook();
    const normalizedMode = mode === 'unload' ? 'unload' : (mode === 'pickup' ? 'pickup' : 'load');
    _missionCargoRenderDialog(normalizedMode, { preserveScroll: false });
    _updateMissionRuntimeUi();
};

window.closeMissionCargoDialog = function() {
    const overlay = document.getElementById('missionCargoOverlay');
    if (overlay) overlay.style.display = 'none';
};

window.missionCargoLoadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status === 'loaded') return false;
    if (!_missionCargoItemCanLoadAtCurrentStage(item)) {
        window.missionCargoStatus.error = item.pickupLocation === 'target'
            ? 'Dieser Pickup ist erst am Zielstrip verfügbar.'
            : 'Dieses Item ist in der aktuellen Missionsphase noch nicht verfügbar.';
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'pickup' ? 'pickup' : (options.mode === 'unload-reload' ? 'unload' : 'load'), { skipPayloadRefresh: true });
        return false;
    }
    if (!options.skipAnimation && item.pickupLocation === 'target' && _missionCargoIsPassengerItem(item)) {
        _missionBushPickupBoarding(item, { reason: 'bush-pickup-load' }).catch?.(() => {});
        return true;
    }
    if (item.status === 'dropped') {
        window.missionCargoStatus.error = 'Dieses Item wurde im Flug abgeworfen und kann nicht wieder geladen werden.';
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'unload-reload' ? 'unload' : 'load', { skipPayloadRefresh: true });
        return false;
    }
    if (item.status === 'unloaded' && !_missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M)) {
        const dM = _missionCargoDistanceToUnloadM(item);
        window.missionCargoStatus.error = Number.isFinite(dM)
            ? `Zu weit vom entladenen Item entfernt (${Math.round(dM)} m, max ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m).`
            : `Position fehlt: fuer Wiederladen im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m bleiben.`;
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'unload-reload' ? 'unload' : 'load', { skipPayloadRefresh: true });
        return false;
    }
    const wasUnloaded = item.status === 'unloaded';
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
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        const isTargetPickup = item.pickupLocation === 'target';
        const removeSceneId = isTargetPickup
            ? (window.missionAptArrivalSceneStatus?.sceneId || _missionAptArrivalSceneId())
            : (wasUnloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
        _missionCargoRemoveVisibleItem(item, {
            sceneId: removeSceneId,
            reason: isTargetPickup ? 'pickup-cargo-load' : (wasUnloaded ? 'cargo-reload' : 'cargo-load'),
            unloaded: wasUnloaded,
            extraKinds: isTargetPickup ? ['arrival_equipment_1'] : []
        });
    }
    _missionCargoSyncPayloadToSim(wasUnloaded ? 'cargo-reload-item' : 'cargo-load-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog(options.mode === 'pickup' ? 'pickup' : (options.mode === 'unload-reload' ? 'unload' : 'load'), { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleItemLoadState = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item) return false;
    if (item.status === 'unloaded') {
        return window.missionCargoLoadItem(itemId, options);
    }
    if (item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped') {
        return window.missionCargoLoadItem(itemId, options);
    }
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
    _missionCargoSpawnVisibleItem(item, { reason: 'cargo-toggle-unload' });
    _missionCargoSyncPayloadToSim('cargo-toggle-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

function _missionCargoIsAirborneNow() {
    const fd = window.lastLiveFlightData || {};
    if (typeof fd.onGround === 'boolean') return !fd.onGround;
    const agl = Number(fd.aglFt);
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs ?? 0);
    return (Number.isFinite(agl) && agl > 80) || (missionRuntime.active && Number.isFinite(gs) && gs > 35);
}

function _missionCargoRemoveLoadedSceneObjects(reason = 'cargo-loaded-sync') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const manifest = _missionCargoEnsureManifest();
    let sent = false;
    manifest.items
        .filter(item => item.status === 'loaded' || item.status === 'unloaded')
        .forEach(item => {
            sent = _missionCargoRemoveVisibleItem(item, {
                reason,
                unloaded: item.status === 'unloaded',
                sceneId: item.status === 'unloaded' ? _missionCargoUnloadSceneId() : _missionCargoSceneId()
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
        .forEach(item => {
            _missionCargoRemoveVisibleItem(item, {
                sceneId: _missionCargoUnloadSceneId(),
                reason: `${reason}-refresh-remove`,
                unloaded: true
            });
            sent = _missionCargoSpawnVisibleItem(item, {
                sceneId: _missionCargoUnloadSceneId(),
                reason,
                unloaded: true,
                pos
            }) || sent;
        });
    return sent;
}

function _missionCargoPassengerAlreadyUnloaded() {
    return _missionCargoPassengerUnloadedItems().length > 0 && _missionCargoLoadedPassengerItems().length === 0;
}

window.missionCargoAutoLoad = function() {
    _missionCargoMarkAllLoaded({ despawn: true });
    _missionCargoRenderDialog('load');
    return true;
};

window.missionCargoUnloadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status !== 'loaded') return false;
    if (_missionCargoIsPassengerItem(item) && !options.drop && !_missionCargoGroundHandlingAllowed()) return false;
    const dropped = options.drop === true || _missionCargoIsAirborneNow();
    if (_missionCargoIsPassengerItem(item) && dropped) return false;
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
        _missionCargoSyncPayloadToSim('cargo-drop-item').catch(() => {});
        if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return true;
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
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        _missionCargoRemoveVisibleItem(item, {
            sceneId: _missionCargoUnloadSceneId(),
            reason: 'cargo-unload-refresh-remove',
            unloaded: true
        });
        _missionCargoSpawnVisibleItem(item, {
            sceneId: _missionCargoUnloadSceneId(),
            reason: 'cargo-unload',
            unloaded: true
        });
    }
    _missionCargoSyncPayloadToSim('cargo-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog('unload', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoSetBoardBookTime = function(itemId, field) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || !/bordbuch/i.test(`${item.id} ${item.label} ${item.storyName}`)) return false;
    const key = field === 'landing' ? 'landingTime' : 'startTime';
    item.log = item.log && typeof item.log === 'object' ? item.log : {};
    item.log[key] = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    _missionCargoPersistManifest(manifest);
    return true;
};

window.finishMissionCargoLoadingAndStart = function() {
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoLoadingAndStart' });
    const manifest = _missionCargoEnsureManifest();
    if (typeof window.missionPrepareEmptyPickupStart === 'function' && window.missionPrepareEmptyPickupStart('cargo-finish-loading')) {
        window.closeMissionCargoDialog?.();
        return true;
    }
    if (!manifest.dispatchSignature) {
        window.missionCargoSignDispatchList?.();
        return false;
    }
    if (Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now()) {
        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return false;
    }
    window.missionCargoStatus.loadConfirmed = true;
    _missionCargoRemoveLoadedSceneObjects('cargo-finish-loading');
    _missionCargoSyncPayloadToSim('cargo-finish-loading').catch(() => {});
    window.closeMissionCargoDialog?.();
    if (!_missionCargoMaybePromoteStartReady('cargo-finish-loading')) {
        _missionCargoScheduleStartReadyPromotion('cargo-finish-loading');
    }
    _updateMissionRuntimeUi();
    return true;
};

window.finishMissionCargoPickupAndContinue = function() {
    if (!_missionBushIsPickupMission()) return false;
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoPickupAndContinue' });
    const manifest = _missionCargoEnsureManifest();
    const pickupItem = _missionBushPickupItem(manifest);
    if (!pickupItem || (pickupItem.status !== 'loaded' && pickupItem.status !== 'unloaded')) return false;
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
    if (_missionBushIsPickupPassengerMission() && !window.activePassenger) {
        const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const passenger = md?.passenger || md?.missionContract?.passenger || window.activeMissionContract?.passenger || null;
        if (passenger && typeof passenger === 'object') {
            window.activePassenger = { ...passenger };
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
        }
    }
    if (typeof window.paxVoiceResetLeg === 'function') {
        try { window.paxVoiceResetLeg(); } catch (_) {}
    }
    if (_missionBushIsPickupPassengerMission() && typeof window.triggerPaxPickupBoarding === 'function') {
        setTimeout(() => {
            try {
                if (!window.activePassenger) return;
                window.triggerPaxPickupBoarding();
            } catch (_) {}
        }, 400);
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
    if (_missionBushIsPickupPassengerMission() && typeof window.triggerPaxPickupDeparture === 'function') {
        setTimeout(() => {
            try {
                if (!window.activePassenger) return;
                window.triggerPaxPickupDeparture();
            } catch (_) {}
        }, 4500);
    }
    if (_missionBushIsPickupCargoMission() && typeof window.triggerPaxCargoPickupDeparture === 'function') {
        setTimeout(() => {
            try {
                window.triggerPaxCargoPickupDeparture();
            } catch (_) {}
        }, 4500);
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

window.finishMissionCargoUnloadAndEnd = function() {
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd' });
    _missionCargoSpawnUnloadedSceneObjects('cargo-finish-unload');
    window.closeMissionCargoDialog?.();
    if (_missionSceneIsBushMission() && typeof _missionBushUpdateProgress === 'function') {
        try { _missionBushUpdateProgress(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon, Date.now()); } catch (_) {}
    }
    if (!_missionRuntimeGroundEndReady()) {
        _updateMissionRuntimeUi();
        return true;
    }
    const pos = window.lastLiveGpsPos || {};
    const shouldRunBushHomeDeboarding = !!(
        _missionBushIsPickupPassengerMission()
        && Number.isFinite(Number(pos.lat))
        && Number.isFinite(Number(pos.lon))
        && _isAtMissionHome(Number(pos.lat), Number(pos.lon))
        && !window.missionSceneStatus?.deboardingRequested
        && !window.missionSceneStatus?.deboardingActive
        && typeof window.missionSceneDeboarding === 'function'
    );
    if (shouldRunBushHomeDeboarding) {
        let cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
            ? _missionCargoFinalizeMissionOutcome({ source: 'bush-home-unload-preview' })
            : null;
        cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
            endedAtHome: _missionPoiEndedAtHome(),
            needsRideHome: _missionPoiGroundEndReady() && !_missionPoiEndedAtHome()
        });
        const endReady = _missionEndReadiness();
        cargoOutcome = _missionOutcomeApplyEndReadiness(cargoOutcome, endReady);
        _setMissionClosePending({ reason: 'bush-home-unload-preview', outcome: cargoOutcome });

        let farewellStarted = false;
        if (typeof _triggerPaxFarewellAndWaitForDeboard === 'function') {
            _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd:start-bush-home-farewell' });
            farewellStarted = !!_triggerPaxFarewellAndWaitForDeboard({
                missionCargoOutcome: cargoOutcome,
                missionFailed: !!cargoOutcome?.failed
            }, 'bush-home-unload-farewell');
            _missionPhaseDebugPush('trigger', {
                name: 'finishMissionCargoUnloadAndEnd:bush-home-farewell-result',
                started: farewellStarted
            });
        }
        if (!farewellStarted) {
            _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd:start-bush-home-deboarding' });
            const started = !!window.missionSceneDeboarding('bush-home-unload');
            _missionPhaseDebugPush('trigger', {
                name: 'finishMissionCargoUnloadAndEnd:bush-home-deboarding-result',
                started
            });
            if (started) {
                _updateMissionRuntimeUi();
                return true;
            }
        }
        _updateMissionRuntimeUi();
        if (farewellStarted) return true;
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
            return !!window.manualMissionEnd({ skipCargoUnload: true });
        }
        return true;
    }
    window.manualMissionEnd({ skipCargoUnload: true });
};

function _missionCargoGroundHandlingAllowed() {
    return !_missionCargoIsAirborneNow();
}
