// Mission Runtime Core
// Extrahierte Runtime-/Bush-/Ground-Action-Helfer aus sync.js.
// Ziel: Strukturgewinn ohne Verhaltensaenderung.

function _missionBushAreaRef() {
    const bush = _activeBushMissionSpec();
    const area = bush?.areaRef;
    if (!area || typeof area !== 'object') return null;
    const lat = Number(area.lat);
    const lon = Number(area.lon);
    const radiusNm = Math.max(0.5, Number(area.radiusNm) || 3);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { ...area, lat, lon, radiusNm };
}

function _missionBushAreaDistanceNm(lat, lon) {
    const area = _missionBushAreaRef();
    if (!area || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    return _haversineNmLocal(Number(lat), Number(lon), area.lat, area.lon);
}

function _missionBushIsPickupMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && ['passenger', 'cargo'].includes(String(bush.pickupKind || '').toLowerCase()));
}

function _missionBushIsPickupPassengerMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
}

function _missionBushIsPickupCargoMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
}

function _missionBushUsesPoiTaskRecipe() {
    if (!_missionSceneIsBushMission()) return false;
    const bush = _activeBushMissionSpec();
    if (!bush || typeof bush !== 'object') return false;
    const targetMode = String(bush.targetMode || '').toLowerCase();
    const completionMode = String(bush.completionMode || '').toLowerCase();
    const profileId = String(bush.profileId || '').toLowerCase();
    return !!(
        targetMode === 'area_then_return'
        && completionMode === 'return_home'
        && profileId === 'bush_recon_return'
    );
}
window.missionBushUsesPoiTaskRecipe = _missionBushUsesPoiTaskRecipe;

function _missionPoiTaskProgressState() {
    if (typeof window.paxVoiceGetPoiMissionProgress !== 'function') return null;
    try {
        const progress = window.paxVoiceGetPoiMissionProgress();
        return progress && typeof progress === 'object' ? progress : null;
    } catch (_) {
        return null;
    }
}

function _missionBushPickupItem(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items.find(item => item && item.pickupLocation === 'target') || null;
}

function _missionBushPickupAtTargetNow(lat = null, lon = null) {
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    const ready = _missionEndReadiness(curLat, curLon);
    if (!ready?.groundStill) return false;
    const bush = _activeBushMissionSpec();
    const targetLat = Number(bush?.targetRef?.lat);
    const targetLon = Number(bush?.targetRef?.lon);
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        const atArrivalPoint = _isAtAptArrivalPoint(curLat, curLon, 0.12);
        const dTargetNm = _haversineNmLocal(curLat, curLon, targetLat, targetLon);
        return !!(atArrivalPoint || (Number.isFinite(dTargetNm) && dTargetNm <= 0.35));
    }
    if (!ready?.atTarget) return false;
    if (ready.hasAptArrival) return _isAtAptArrivalPoint(curLat, curLon, 0.12);
    return true;
}

function _missionBushPickupReadyForAction() {
    if (!_missionBushIsPickupMission()) return false;
    const progress = _activeBushMissionProgress();
    return !!(_missionBushPickupAtTargetNow() && (progress?.pickupReady || (progress?.pickupCompleted && !progress?.pickupConfirmed)));
}

function _missionResolveGroundAction(options = {}) {
    const active = options?.active ?? missionRuntime.active;
    const deboardingBusy = options?.deboardingBusy ?? _missionEndDeboardingBusy();
    const endReady = options?.endReady ?? (active ? _missionEndReadiness() : null);
    const runtimeGroundEndReady = active ? _missionRuntimeGroundEndReady(endReady) : false;
    const bushProgress = _missionSceneIsBushMission() ? _activeBushMissionProgress() : null;
    const pickupActionReady = active && _missionBushPickupReadyForAction();
    const pickupConfirmOnly = !!(pickupActionReady && bushProgress?.pickupCompleted && !bushProgress?.pickupConfirmed);
    const unloadActionReady = active && _missionCargoGroundHandlingAllowed() && _missionCargoNeedsUnload();

    let resolved = null;
    if (missionRuntime.closingPending) {
        resolved = { phase: 'closing', action: 'close', endReady: false, pickupConfirmOnly: false };
    } else if (!active) {
        resolved = { phase: _missionRuntimePhaseSnapshot(), action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (deboardingBusy) {
        resolved = { phase: 'deboarding', action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (pickupActionReady) {
        resolved = {
            phase: pickupConfirmOnly ? 'pickup_complete' : 'pickup_ready',
            action: 'pickup',
            endReady: false,
            pickupConfirmOnly
        };
    } else if (runtimeGroundEndReady) {
        if (unloadActionReady) {
            resolved = {
                phase: String(bushProgress?.status || '') === 'home_unloading' ? 'home_unloading' : 'end_unloading',
                action: 'unload',
                endReady: true,
                pickupConfirmOnly: false
            };
        } else {
            resolved = {
                phase: String(bushProgress?.status || '') === 'ready_to_close' ? 'ready_to_close' : 'end_ready',
                action: 'end',
                endReady: true,
                pickupConfirmOnly: false
            };
        }
    } else if (unloadActionReady) {
        resolved = {
            phase: String(bushProgress?.status || '') || 'ground_unloading',
            action: 'unload',
            endReady: false,
            pickupConfirmOnly: false
        };
    } else {
        resolved = {
            phase: String(bushProgress?.status || '') || 'active',
            action: 'end',
            endReady: false,
            pickupConfirmOnly: false
        };
    }
    const dbg = _missionPhaseDebugState();
    const sig = JSON.stringify([
        resolved.action,
        resolved.phase,
        resolved.endReady ? 1 : 0,
        resolved.pickupConfirmOnly ? 1 : 0,
        endReady?.reason || '',
        endReady?.groundStill ? 1 : 0,
        endReady?.atTarget ? 1 : 0,
        String(bushProgress?.status || '')
    ]);
    if (dbg.lastGroundActionSig !== sig) {
        dbg.lastGroundActionSig = sig;
        _missionPhaseDebugPush('ground_action', _missionPhaseDebugSummarizeGroundAction(resolved, {
            trigger: options?.trigger || 'resolve-ground-action',
            endReady,
            bushStatus: String(bushProgress?.status || '')
        }));
    }
    return resolved;
}
window.missionResolveGroundAction = _missionResolveGroundAction;

function _missionBushUpdateProgress(lat = null, lon = null, now = Date.now()) {
    if (!_missionSceneIsBushMission()) return null;
    const bush = _activeBushMissionSpec();
    const progress = _activeBushMissionProgress();
    if (!bush || !progress) return null;
    const next = { ...progress };
    const curLat = Number(lat ?? window.lastLiveGpsPos?.lat);
    const curLon = Number(lon ?? window.lastLiveGpsPos?.lon);
    const endReady = _missionEndReadiness(curLat, curLon);
    if (endReady?.atTarget) next.targetReached = true;
    if (_missionBushIsPickupMission()) {
        const pickupItem = _missionBushPickupItem();
        const pickupLoaded = pickupItem?.status === 'loaded' || pickupItem?.status === 'unloaded';
        const pickupUnloadedHome = pickupItem?.status === 'unloaded' && _isAtMissionHome(curLat, curLon);
        const pickupIsPassenger = _missionCargoIsPassengerItem(pickupItem);
        const atPickup = _missionBushPickupAtTargetNow(curLat, curLon);
        next.pickupReady = !!(atPickup && !pickupLoaded);
        next.pickupCompleted = !!pickupLoaded;
        if (next.pickupReady && !pickupLoaded) next.status = 'pickup_ready';
        if (pickupLoaded && !next.pickupConfirmed) next.status = 'pickup_complete';
        if (pickupLoaded && next.pickupConfirmed && bush.requiresReturnHome && !pickupUnloadedHome) next.status = 'return_leg';
        if (pickupLoaded && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.status = pickupUnloadedHome ? 'ready_to_close' : 'home_unloading';
            next.groundStopQualified = !!pickupUnloadedHome;
        }
        if (pickupUnloadedHome) {
            if (pickupIsPassenger) next.passengerDropped = true;
            else next.cargoDelivered = true;
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        }
        const prevJson = JSON.stringify(progress);
        const nextJson = JSON.stringify(next);
        if (prevJson !== nextJson) _persistBushMissionProgress(next);
        return next;
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'return_home') {
        if (_missionBushUsesPoiTaskRecipe()) {
            const poiProgress = _missionPoiTaskProgressState();
            const taskResolved = !!(poiProgress?.trackingActive && (poiProgress?.satisfied || poiProgress?.aborted));
            if (endReady?.atTarget) {
                next.targetReached = true;
                if (!taskResolved) next.status = 'on_task';
            }
            next.areaDwellSec = Math.max(0, Number(poiProgress?.dwellSec || next.areaDwellSec || 0));
            next.areaTrackNm = Math.max(0, Number(poiProgress?.trackNm || next.areaTrackNm || 0));
            if (taskResolved) {
                next.areaQualified = true;
                next.status = bush.requiresReturnHome ? 'return_leg' : 'ready_to_close';
            }
            if (next.areaQualified && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
                next.returnHomeQualified = true;
                next.groundStopQualified = true;
                next.status = 'ready_to_close';
            } else if (next.areaQualified && bush.requiresReturnHome) {
                next.status = 'return_leg';
            }
            const prevJson = JSON.stringify(progress);
            const nextJson = JSON.stringify(next);
            if (prevJson !== nextJson) _persistBushMissionProgress(next);
            return next;
        }
        const area = _missionBushAreaRef();
        const canSampleArea = !endReady?.groundStill;
        const insideArea = canSampleArea && area && Number.isFinite(curLat) && Number.isFinite(curLon)
            ? (_missionBushAreaDistanceNm(curLat, curLon) <= area.radiusNm)
            : false;
        if (insideArea) {
            if (!next.areaEnteredAt) next.areaEnteredAt = now;
            if (Number.isFinite(next.lastAreaSampleTs) && next.lastAreaSampleTs > 0) {
                const dtSec = Math.max(0, Math.min(10, (now - next.lastAreaSampleTs) / 1000));
                next.areaDwellSec = Math.max(0, Number(next.areaDwellSec || 0) + dtSec);
            }
            if (Number.isFinite(next.lastAreaSampleLat) && Number.isFinite(next.lastAreaSampleLon)) {
                const legNm = _haversineNmLocal(next.lastAreaSampleLat, next.lastAreaSampleLon, curLat, curLon);
                if (Number.isFinite(legNm) && legNm > 0 && legNm <= 2.5) {
                    next.areaTrackNm = Math.max(0, Number(next.areaTrackNm || 0) + legNm);
                }
            }
            next.lastAreaSampleLat = curLat;
            next.lastAreaSampleLon = curLon;
            next.lastAreaSampleTs = now;
            next.targetReached = true;
            if (!next.areaQualified) next.status = 'on_task';
        } else {
            next.lastAreaSampleLat = NaN;
            next.lastAreaSampleLon = NaN;
            next.lastAreaSampleTs = 0;
        }
        const minAreaTimeSec = Math.max(0, Number(bush?.success?.minAreaTimeSec) || 0);
        const minAreaTrackNm = Math.max(0, Number(bush?.success?.minAreaTrackNm) || 0);
        if (!next.areaQualified && next.areaDwellSec >= minAreaTimeSec && next.areaTrackNm >= minAreaTrackNm) {
            next.areaQualified = true;
            next.status = bush.requiresReturnHome ? 'return_leg' : 'ready_to_close';
        }
        if (next.areaQualified && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        } else if (next.areaQualified && bush.requiresReturnHome) {
            next.status = 'return_leg';
        }
    } else if (endReady?.groundStill && endReady?.atTarget) {
        next.groundStopQualified = true;
        next.status = 'ready_to_close';
    }
    const prevJson = JSON.stringify(progress);
    const nextJson = JSON.stringify(next);
    if (prevJson !== nextJson) _persistBushMissionProgress(next);
    return next;
}
window.missionBushUpdateProgress = _missionBushUpdateProgress;

function _missionPoiGroundEndReady(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    return !!(ready?.groundStill && _missionHasReachedEndEligibleFlightPhase());
}

function _missionBushEffectiveCompletionMode() {
    const bush = _activeBushMissionSpec();
    const profileId = String(bush?.profileId || '').toLowerCase();
    const completionMode = String(bush?.completionMode || '').toLowerCase();
    if (completionMode) return completionMode;
    if (profileId === 'bush_supply_strip') return 'unload_at_target';
    if (profileId === 'bush_charter_strip') return 'passenger_dropoff';
    if (profileId === 'bush_scenic_hopper') return 'land_at_target';
    return '';
}

function _missionBushRequiresReturnHome() {
    return _missionSceneIsBushMission() && _missionBushEffectiveCompletionMode() === 'return_home';
}

function _missionBushEndReadyText() {
    if (_missionBushIsPickupMission()) {
        return _missionBushIsPickupCargoMission()
            ? 'Bush-Cargo-Pickup abgeschlossen. Rueckkehr und Ausladen am Heimatplatz bestaetigt.'
            : 'Bush-Pickup abgeschlossen. Rueckkehr und Ausstieg am Heimatplatz bestaetigt.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung jetzt entladen.'
            : 'Bush-Zielstrip erreicht. Versorgung kann abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier-Dropoff kann jetzt abgeschlossen werden.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg kann jetzt abgeschlossen werden.';
    }
    if (mode === 'return_home') {
        return 'Bush-Recon abgeschlossen. Mission kann jetzt am Heimatplatz beendet werden.';
    }
    return 'Bush-Zielstrip erreicht. Mission kann abgeschlossen werden.';
}

function _missionBushRuntimeDetailText() {
    if (_missionBushIsPickupMission()) {
        const p = _activeBushMissionProgress();
        const pickupNoun = _missionBushIsPickupCargoMission() ? 'Fracht' : 'Gast';
        const pickupVerb = _missionBushIsPickupCargoMission() ? 'ausladen' : 'aussteigen lassen';
        const pickupLoadedLabel = _missionBushIsPickupCargoMission() ? 'Pickup-Fracht' : 'Pickup';
        if (p?.groundStopQualified && (p?.passengerDropped || p?.cargoDelivered)) return _missionBushIsPickupCargoMission()
            ? 'Pickup-Rueckflug abgeschlossen. Die Rueckholfracht ist am Heimatplatz ausgeladen.'
            : 'Pickup-Rueckflug abgeschlossen. Der Gast ist am Heimatplatz ausgestiegen.';
        if (p?.returnHomeQualified) return `Heimatplatz erreicht. ${pickupNoun} jetzt ${pickupVerb}.`;
        if (String(p?.status || '') === 'pickup_loading') return _missionBushIsPickupCargoMission()
            ? 'Pickup-Ladung wird jetzt am Treffpunkt aufgenommen.'
            : 'Pickup-Boarding laeuft. Der Gast bewegt sich jetzt zum Flugzeug.';
        if (p?.pickupCompleted && p?.pickupConfirmed) return 'Pickup bestaetigt. Rueckflug zum Heimatplatz laeuft.';
        if (p?.pickupCompleted) return `${pickupLoadedLabel} geladen. Rueckflug nach kurzer Bestaetigung freigeben.`;
        if (p?.pickupReady) return _missionBushIsPickupCargoMission()
            ? 'Zielstrip erreicht. Zum Treffpunkt rollen und die Rueckholfracht aufnehmen.'
            : 'Zielstrip erreicht. Zum Treffpunkt rollen und den Pickup starten.';
        return 'Leerflug zum Zielstrip laeuft. Pickup wird erst nach Landung am Treffpunkt freigegeben.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung wartet auf Entladung.'
            : 'Bush-Zielstrip erreicht. Versorgung kann regulaer abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier wartet auf Farewell und Deboarding.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg ist sauber beendet.';
    }
    if (mode === 'return_home') {
        const p = _activeBushMissionProgress();
        if (p?.returnHomeQualified) return 'Bush-Recon abgeschlossen. Rueckkehr und Stillstand am Heimatplatz bestaetigt.';
        if (p?.areaQualified) return 'Recon im Zielgebiet abgeschlossen. Rueckflug zum Heimatplatz laeuft.';
        if (_missionBushUsesPoiTaskRecipe()) {
            const poiProgress = _missionPoiTaskProgressState();
            const dwellSec = Math.round(Number(poiProgress?.dwellSec || 0));
            const attempts = Math.max(0, Number(poiProgress?.attempts || 0));
            return `Recon noch offen. Im Zielgebiet in der Luft bleiben: bisher ${dwellSec}s${attempts > 0 ? ` · Hinweise ${attempts}` : ''}.`;
        }
        return `Recon noch offen. Fuer den Auftrag im Zielgebiet in der Luft bleiben: bisher ${Math.round(Number(p?.areaDwellSec || 0))}s · ${Number(p?.areaTrackNm || 0).toFixed(1)} NM im Arbeitsbereich.`;
    }
    return 'Bush-Zielstrip erreicht. Auftrag kann regulaer abgeschlossen werden.';
}

function _missionBushGroundEndReady(endReady = null) {
    if (!_missionSceneIsBushMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const progress = _activeBushMissionProgress();
    if (_missionBushIsPickupMission()) {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        if (progress?.status === 'ready_to_close' && ready?.groundStill && Number.isFinite(curLat) && Number.isFinite(curLon) && _isAtMissionHome(curLat, curLon)) {
            return true;
        }
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.pickupCompleted
            && (progress?.passengerDropped || progress?.cargoDelivered)
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    const completionMode = _missionBushEffectiveCompletionMode();
    const isSupportedBushCompletion = completionMode === 'unload_at_target'
        || completionMode === 'passenger_dropoff'
        || completionMode === 'land_at_target'
        || completionMode === 'return_home';
    if (!isSupportedBushCompletion) return false;
    if (progress?.status === 'ready_to_close' && ready?.groundStill) {
        if (completionMode === 'return_home') {
            const pos = window.lastLiveGpsPos || {};
            const curLat = Number(pos.lat);
            const curLon = Number(pos.lon);
            return !!(
                Number.isFinite(curLat)
                && Number.isFinite(curLon)
                && _isAtMissionHome(curLat, curLon)
            );
        }
        return !!ready?.atTarget;
    }
    if (completionMode === 'return_home') {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.areaQualified
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    return !!(ready?.groundStill && ready?.atTarget && _missionHasReachedEndEligibleFlightPhase());
}

function _missionRuntimeGroundEndReady(endReady = null) {
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    if (_missionSceneIsPoiMission()) return !!(ready?.ready || _missionPoiGroundEndReady(ready));
    if (_missionSceneIsBushMission()) return _missionBushGroundEndReady(ready);
    return !!ready?.ready;
}

function _missionPoiEndedAtHome(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const pos = window.lastLiveGpsPos || {};
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const curLat = Number(pos.lat);
    const curLon = Number(pos.lon);
    if (!ready?.groundStill || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    return _isAtMissionHome(curLat, curLon);
}

function _aptArrivalPointForRuntime() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.poiName || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI')) return null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const truth = md?.missionTruth || contract?.missionTruth || null;
    const plan = md?.aptArrivalPlan || contract?.aptArrivalPlan || truth?.arrivalScene || null;
    const lat = Number(plan?.lat);
    const lon = Number(plan?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, plan };
}

function _distanceToAptArrivalNm(lat, lon) {
    const p = _aptArrivalPointForRuntime();
    if (!p) return null;
    return _haversineNmLocal(Number(lat), Number(lon), p.lat, p.lon);
}

function _hasAptArrivalRuntimePoint() {
    return !!_aptArrivalPointForRuntime();
}

function _isAtAptArrivalPoint(lat, lon, thresholdNm = 0.08) {
    const dNm = _distanceToAptArrivalNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _isAtMissionTarget(lat, lon, thresholdNm = 1.2) {
    const dNm = _distanceToMissionTargetNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _missionEndReadiness(lat = null, lon = null) {
    const fd = window.lastLiveFlightData || {};
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) {
        return { ready: false, reason: 'no_position', atTarget: false, groundStill: false, hasAptArrival: false };
    }
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
        : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs) : Number(pos.gs || 0));
    const agl = Number.isFinite(Number(fd.aglFt)) ? Math.max(0, Number(fd.aglFt)) : null;
    const onGround = typeof fd.onGround === 'boolean' ? !!fd.onGround : (!Number.isFinite(agl) || agl <= 40);
    const parkingBrakeSet = fd.parkingBrake === true || fd.parkingBrake === 1;
    const groundStill = onGround && (gs <= 2.0 || parkingBrakeSet);
    const hasAptArrival = _hasAptArrivalRuntimePoint();
    const dArrivalNm = hasAptArrival ? _distanceToAptArrivalNm(curLat, curLon) : null;
    const dMissionNm = _distanceToMissionTargetNm(curLat, curLon);
    const atArrivalPoint = hasAptArrival && Number.isFinite(dArrivalNm) && dArrivalNm <= 0.16;
    const atAirportFallback = hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 0.35;
    const atMissionTarget = !hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 1.2;
    const atTarget = atArrivalPoint || atAirportFallback || atMissionTarget;
    const reason = !groundStill ? 'not_stopped'
        : (!atTarget ? 'not_at_target'
            : (atArrivalPoint ? 'apt_arrival_point'
                : (atAirportFallback ? 'apt_airport_fallback' : 'mission_target')));
    return {
        ready: groundStill && atTarget,
        reason,
        atTarget,
        groundStill,
        hasAptArrival,
        dArrivalNm,
        dMissionNm,
        gs,
        onGround,
        parkingBrakeSet
    };
}

function _missionSceneFinishRuntimeAfterDeboard(reason = 'mission-end-after-farewell') {
    _missionPhaseDebugPush('trigger', { name: '_missionSceneFinishRuntimeAfterDeboard', reason });
    _missionCargoMarkPassengerUnloaded({ reason: `${reason}-passenger-sync` });
    let cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
        ? _missionCargoFinalizeMissionOutcome({ source: reason })
        : null;
    cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
        endedAtHome: _missionPoiEndedAtHome(),
        needsRideHome: _missionPoiGroundEndReady() && !_missionPoiEndedAtHome()
    });
    _missionPhaseDebugPush('trigger', {
        name: '_missionSceneFinishRuntimeAfterDeboard:outcome',
        reason,
        failed: !!cargoOutcome?.failed,
        missingRequired: (cargoOutcome?.missingRequired || []).join(','),
        notDeliveredRequired: (cargoOutcome?.notDeliveredRequired || []).join(','),
        droppedRequired: (cargoOutcome?.droppedRequired || []).join(','),
        damagedRequired: (cargoOutcome?.damagedRequired || []).join(',')
    });
    const endSceneStarted = _tryStartMissionEndScene(reason, { force: true });
    _setMissionClosePending({ reason, outcome: cargoOutcome });
    return endSceneStarted || cargoOutcome || true;
}

function _missionFarewellRecordWithCargoOutcome(record) {
    const baseRecord = (record && typeof record === 'object') ? { ...record } : {};
    if (typeof _missionCargoEvaluateFarewellOutcome === 'function') {
        try {
            const outcome = _missionCargoEvaluateFarewellOutcome();
            if (outcome && typeof outcome === 'object' && outcome.status !== 'none') {
                baseRecord.missionCargoOutcome = outcome;
                baseRecord.missionFailed = !!outcome.failed;
            }
        } catch (_) {}
    }
    if (typeof _missionPoiProgressState === 'function') {
        try {
            const poiProgress = _missionPoiProgressState();
            if (poiProgress && typeof poiProgress === 'object' && typeof poiProgress.aborted === 'boolean') {
                baseRecord.poiAborted = !!poiProgress.aborted;
            }
        } catch (_) {}
    }
    return Object.keys(baseRecord).length ? baseRecord : null;
}

function _triggerPaxFarewellAndWaitForDeboard(record, reason = 'pax-farewell') {
    _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard', reason });
    if (typeof window.triggerPaxFarewell !== 'function') return false;
    if (typeof _missionCargoNeedsUnload === 'function' && _missionCargoNeedsUnload()) {
        _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard:blocked-unload', reason });
        return false;
    }
    const farewellRecord = _missionFarewellRecordWithCargoOutcome(record);
    missionRuntime.waitingFarewellDeboarding = true;
    missionRuntime.deboardingAfterFarewellStarted = false;
    try {
        window.triggerPaxFarewell(farewellRecord);
        _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard:started', reason });
    } catch (err) {
        missionRuntime.waitingFarewellDeboarding = false;
        _missionPhaseDebugPush('trigger', {
            name: '_triggerPaxFarewellAndWaitForDeboard:error',
            reason,
            error: err?.message || String(err)
        });
        console.warn('[MissionRuntime] Pax farewell trigger failed:', err);
        return false;
    }
    setTimeout(() => {
        if (missionRuntime.waitingFarewellDeboarding && !missionRuntime.deboardingAfterFarewellStarted) {
            window.missionSceneStartDeboardingAfterFarewell(`${reason}-timeout`);
        }
    }, 90000);
    return true;
}

window.missionSceneStartDeboardingAfterFarewell = function(reason = 'pax-farewell-complete') {
    _missionPhaseDebugPush('trigger', {
        name: 'missionSceneStartDeboardingAfterFarewell',
        reason,
        waitingFarewellDeboarding: !!missionRuntime.waitingFarewellDeboarding,
        deboardingAfterFarewellStarted: !!missionRuntime.deboardingAfterFarewellStarted
    });
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    if (missionRuntime.deboardingAfterFarewellStarted) return false;
    missionRuntime.deboardingAfterFarewellStarted = true;
    return _missionSceneFinishRuntimeAfterDeboard(reason);
};
