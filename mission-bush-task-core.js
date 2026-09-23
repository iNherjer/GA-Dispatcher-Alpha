// Generated from mission-runtime-core.js by tools/generate-bush-task-core.mjs.
// Keep app-owned state and geometry behind explicit evaluate() inputs.
(function(root, factory) {
  const api=factory(typeof module==='object'&&module.exports?require('./mission-manifest-core.js'):root.GAMissionManifestCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GAMissionBushTaskCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(manifestCore){
'use strict';
const PRODUCTION_PROFILE_IDS=Object.freeze(['bush_supply_strip','bush_charter_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo','bush_recon_return']);
function haversineNm(lat1,lon1,lat2,lon2){const p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p,a=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;return 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*3440.065;}
function evaluate(input={}){
  const spec=input.spec||null;let progress=input.progress&&typeof input.progress==='object'?{...input.progress}:null;
  const position=input.position||{};const endReady=input.endReady||{};
  if(!spec||!progress)return{progress,canEndHere:false,pickupReady:false};
  const window={lastLiveGpsPos:position};let poiProgress=input.poiProgress||null;
  const _activeBushMissionSpec=()=>spec;const _activeBushMissionProgress=()=>progress;
  const _persistBushMissionProgress=next=>{progress=next;};const _missionEndReadiness=()=>endReady;
  const _isAtMissionHome=()=>input.atHome===true;const _missionHasReachedEndEligibleFlightPhase=()=>input.endEligibleFlightPhase===true;
  const _missionCargoEnsureManifest=()=>input.manifest||{items:[]};
  const _missionCargoManifestCore=()=>manifestCore;
  const _isAtAptArrivalPoint=()=>input.atArrivalPoint===true;
  const _missionPoiTaskProgressState=()=>poiProgress;
  const _haversineNmLocal=haversineNm;
  const _missionSceneIsBushMission=()=>true;
function _missionCargoIsPassengerItem(item = null) {
    const core = _missionCargoManifestCore();
    if (typeof core?.isPassengerItem === 'function') return core.isPassengerItem(item);
    return !!item && String(item.itemType || '').toLowerCase() === 'passenger';
}

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

function _missionBushPickupItems(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items.filter(item => item && item.pickupLocation === 'target');
}

function _missionBushPickupLoadState(manifest = _missionCargoEnsureManifest()) {
    const pickupItems = _missionBushPickupItems(manifest);
    const requiredItems = pickupItems.filter(item => item.required === true);
    const blockingItems = requiredItems.length ? requiredItems : pickupItems;
    const pickedItems = blockingItems.filter(item => item.status === 'loaded' || item.status === 'unloaded');
    const unloadedItems = blockingItems.filter(item => item.status === 'unloaded');
    return {
        pickupItems,
        requiredItems: blockingItems,
        hasItems: blockingItems.length > 0,
        pickedCount: pickedItems.length,
        complete: blockingItems.length > 0 && pickedItems.length === blockingItems.length,
        unloaded: blockingItems.length > 0 && unloadedItems.length === blockingItems.length,
        hasPassenger: blockingItems.some(item => _missionCargoIsPassengerItem(item)),
        hasCargo: blockingItems.some(item => !_missionCargoIsPassengerItem(item))
    };
}

function _missionBushPickupAtTargetNow(lat = null, lon = null) {
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    const ready = _missionEndReadiness(curLat, curLon);
    if (!ready?.groundStill) return false;
    if (
        ready?.atTarget
        && (ready.reason === 'apt_arrival_point' || ready.reason === 'apt_airport_fallback')
    ) return true;
    const bush = _activeBushMissionSpec();
    const targetLat = Number(bush?.targetRef?.lat);
    const targetLon = Number(bush?.targetRef?.lon);
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        const atArrivalPoint = _isAtAptArrivalPoint(curLat, curLon, 0.16);
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
    if (!progress) return false;
    const pickupState = _missionBushPickupLoadState();
    if (pickupState.complete && !progress?.pickupConfirmed) {
        return !!_missionEndReadiness()?.groundStill;
    }
    if (!_missionBushPickupAtTargetNow()) return false;
    if (!pickupState.hasItems || pickupState.complete) return false;
    if (progress?.pickupReady && !progress?.pickupCompleted) return true;
    _persistBushMissionProgress({
        ...progress,
        targetReached: true,
        pickupReady: true,
        pickupCompleted: false,
        pickupConfirmed: false,
        status: pickupState.pickedCount > 0 ? 'pickup_loading' : 'pickup_ready'
    });
    return true;
}

function _missionBushUsesPoiTaskRecipe() {
    if (!_missionSceneIsBushMission()) return false;
    const bush = _activeBushMissionSpec();
    if (!bush || typeof bush !== 'object') return false;
    if (typeof _bushRecipeIdFromSpec === 'function') {
        return _bushRecipeIdFromSpec(bush) === 'poi_on_task_return';
    }
    const targetMode = String(bush.targetMode || '').toLowerCase();
    const completionMode = String(bush.completionMode || '').toLowerCase();
    return !!(targetMode === 'area_then_return' && completionMode === 'return_home');
}

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
        const pickupState = _missionBushPickupLoadState();
        const pickupLoaded = pickupState.complete;
        const atHome = Number.isFinite(curLat) && Number.isFinite(curLon) && _isAtMissionHome(curLat, curLon);
        const pickupUnloadedHome = pickupState.unloaded && atHome;
        const arrivedHomeNow = pickupLoaded && endReady?.groundStill && atHome;
        const atPickup = _missionBushPickupAtTargetNow(curLat, curLon);
        next.pickupReady = !!(atPickup && pickupState.hasItems && !pickupLoaded);
        next.pickupCompleted = !!pickupLoaded;
        if (!pickupLoaded) next.pickupConfirmed = false;
        if (next.pickupReady && !pickupLoaded) {
            next.status = pickupState.pickedCount > 0 ? 'pickup_loading' : 'pickup_ready';
        }
        if (pickupLoaded && !next.pickupConfirmed) next.status = 'pickup_complete';
        if (pickupLoaded && next.pickupConfirmed && bush.requiresReturnHome && !pickupUnloadedHome && !next.returnHomeQualified) {
            next.status = 'return_leg';
        }
        if (arrivedHomeNow) {
            next.returnHomeQualified = true;
            next.status = pickupUnloadedHome ? 'ready_to_close' : 'home_unloading';
            next.groundStopQualified = !!(next.groundStopQualified || pickupUnloadedHome);
        } else if (next.returnHomeQualified) {
            next.status = pickupUnloadedHome ? 'ready_to_close' : 'home_unloading';
        }
        if (pickupUnloadedHome) {
            if (pickupState.hasPassenger) next.passengerDropped = true;
            if (pickupState.hasCargo) next.cargoDelivered = true;
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
            } else if (next.returnHomeQualified && next.groundStopQualified) {
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
        } else if (next.returnHomeQualified && next.groundStopQualified) {
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

function _missionBushGroundEndReady(endReady = null) {
    if (!_missionSceneIsBushMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const progress = _activeBushMissionProgress();
    if (_missionBushIsPickupMission()) {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        const atHome = Number.isFinite(curLat) && Number.isFinite(curLon) && _isAtMissionHome(curLat, curLon);
        const nearSurfaceAfterQualifiedArrival = ready?.onGround === true
            || (Number.isFinite(Number(ready?.agl)) && Number(ready.agl) <= 60);
        const stationaryAfterQualifiedArrival = !!(
            progress?.returnHomeQualified
            && atHome
            && nearSurfaceAfterQualifiedArrival
            && (
                ready?.parkingBrakeSet
                || (Number.isFinite(Number(ready?.gs)) && Number(ready.gs) <= 2)
            )
        );
        const groundStopHeld = !!(ready?.groundStill || stationaryAfterQualifiedArrival);
        if (progress?.status === 'ready_to_close' && groundStopHeld && atHome) {
            return true;
        }
        return !!(
            groundStopHeld
            && atHome
            && progress?.pickupCompleted
            && progress?.pickupConfirmed
            && (_missionHasReachedEndEligibleFlightPhase() || progress?.returnHomeQualified)
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
        const atHome = Number.isFinite(curLat) && Number.isFinite(curLon) && _isAtMissionHome(curLat, curLon);
        const nearSurfaceAfterQualifiedArrival = ready?.onGround === true
            || (Number.isFinite(Number(ready?.agl)) && Number(ready.agl) <= 60);
        const groundStopHeld = !!(
            ready?.groundStill
            || (
                progress?.groundStopQualified
                && progress?.returnHomeQualified
                && atHome
                && nearSurfaceAfterQualifiedArrival
                && (
                    ready?.parkingBrakeSet
                    || (Number.isFinite(Number(ready?.gs)) && Number(ready.gs) <= 2)
                )
            )
        );
        return !!(
            groundStopHeld
            && atHome
            && progress?.areaQualified
            && (_missionHasReachedEndEligibleFlightPhase() || progress?.returnHomeQualified)
        );
    }
    return !!(ready?.groundStill && ready?.atTarget && _missionHasReachedEndEligibleFlightPhase());
}
  _missionBushUpdateProgress(position.lat??null,position.lon??null,input.now);
  const pickupReady=_missionBushPickupReadyForAction();
  const canEndHere=_missionBushGroundEndReady(endReady);
  return{progress,canEndHere,pickupReady};
}
function isProductionSupported(spec){return PRODUCTION_PROFILE_IDS.includes(String(spec?.profileId||''));}
return Object.freeze({PRODUCTION_PROFILE_IDS,evaluate,isProductionSupported});
});
