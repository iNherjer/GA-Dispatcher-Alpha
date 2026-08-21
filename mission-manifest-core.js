(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionManifestCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var CORE_VERSION = 1;
    var CORE_SCHEMA = 'ga.mission-manifest-core.v1';
    var TRANSITION_SCHEMA = 'ga.mission-manifest-transition.v1';
    var EQUIPMENT_REPLACE_THRESHOLD_DAYS = 5;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    }

    function items(manifest) {
        return Array.isArray(manifest && manifest.items)
            ? manifest.items.filter(function (item) { return object(item); })
            : [];
    }

    function normalizeMode(mode) {
        var normalized = String(mode || '').toLowerCase();
        if (normalized === 'unload') return 'unload';
        if (normalized === 'pickup') return 'pickup';
        return 'load';
    }

    function signatureScope(mode) {
        var normalized = normalizeMode(mode);
        if (normalized === 'unload') return 'arrival';
        if (normalized === 'pickup') return 'pickup';
        return 'departure';
    }

    function signatureMatchesMode(signature, mode) {
        if (!object(signature)) return false;
        var recordedScope = String(signature.scope || 'departure').toLowerCase();
        return recordedScope === signatureScope(mode);
    }

    function isPassengerItem(item) {
        return !!object(item) && String(item.itemType || '').toLowerCase() === 'passenger';
    }

    function isHandoffLocked(item) {
        return !!object(item) && (item.handoffComplete === true || Number(item.handedOffAt || 0) > 0);
    }

    function isTargetPickupItem(item) {
        return !!object(item) && item.pickupLocation === 'target';
    }

    function itemCanLoadAtCurrentStage(item, context) {
        if (!object(item) || isHandoffLocked(item)) return false;
        if (isTargetPickupItem(item)) return object(context) && context.atTarget === true;
        return true;
    }

    function itemNeedsUnloadHere(item, context) {
        if (!object(item)) return false;
        if (item.deliverAtHome === true) return !!object(context) && context.atHome === true;
        return item.deliverAtDestination !== false;
    }

    function clearDispatchSignature(manifest) {
        if (!object(manifest)) return false;
        var changed = !!manifest.dispatchSignature;
        manifest.dispatchSignature = null;
        return changed;
    }

    function findItem(manifest, itemId) {
        var manifestItems = items(manifest);
        for (var index = 0; index < manifestItems.length; index += 1) {
            if (manifestItems[index].id === itemId) return manifestItems[index];
        }
        return null;
    }

    function transitionError(action, item, code, details) {
        return Object.assign({
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: false,
            action: action,
            itemId: item && item.id != null ? item.id : null,
            previousStatus: item ? String(item.status || 'pending') : null,
            error: code
        }, object(details) || {});
    }

    function finiteNumber(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function calendarDayNumber(value) {
        var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    }

    function expiryDaysRemaining(expiresAt, now) {
        var expiryDay = calendarDayNumber(expiresAt);
        var date = new Date(finiteNumber(now, Date.now()));
        var todayDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
        return Number.isFinite(expiryDay) ? expiryDay - todayDay : null;
    }

    function formatExpiryDate(expiresAt) {
        var match = String(expiresAt || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? match[3] + ' ' + match[2] + ' ' + match[1] : '-- -- ----';
    }

    function hasFiniteNumber(value) {
        return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
    }

    function positionPatch(context, prefix) {
        var source = object(context) || {};
        var position = object(source.position) || {};
        var patch = {};
        patch[prefix + 'Lat'] = finiteNumber(position.lat, null);
        patch[prefix + 'Lon'] = finiteNumber(position.lon, null);
        patch[prefix + 'AltFt'] = finiteNumber(position.altFt, null);
        return patch;
    }

    function transitionPlan(action, item, patch, details) {
        return Object.assign({
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: action,
            itemId: item.id,
            previousStatus: String(item.status || 'pending'),
            nextStatus: patch && patch.status ? patch.status : String(item.status || 'pending'),
            patch: patch || {},
            invalidatesSignature: true,
            requiresEffect: null
        }, object(details) || {});
    }

    function planItemTransition(manifest, request, context) {
        var source = object(request) || {};
        var facts = object(context) || {};
        var action = String(source.action || '').toLowerCase();
        var item = findItem(manifest, source.itemId);
        var status = item ? String(item.status || 'pending') : '';
        var now = finiteNumber(facts.now, 0);

        if (!item) return transitionError(action, null, 'manifest_item_not_found', { itemId: source.itemId });
        if (action !== 'load' && action !== 'unload' && action !== 'drop' && action !== 'reset_to_pending') {
            return transitionError(action, item, 'manifest_transition_not_supported');
        }

        if (action === 'load') {
            if (status === 'loaded') return transitionError(action, item, 'manifest_item_already_loaded');
            if (isHandoffLocked(item)) return transitionError(action, item, 'manifest_item_handoff_locked');
            if (facts.groundHandlingAllowed !== true) {
                return transitionError(action, item, 'manifest_ground_handling_required');
            }
            if (facts.complianceAllowed !== true) return transitionError(action, item, 'manifest_compliance_locked');
            if (status === 'lost') return transitionError(action, item, 'manifest_lost_item_replacement_required');
            if (!itemCanLoadAtCurrentStage(item, facts)) {
                return transitionError(action, item, 'manifest_pickup_not_available');
            }
            if (isPassengerItem(item) && !isTargetPickupItem(item) && status !== 'unloaded'
                && facts.missionActive !== true && facts.skipPassengerEffect !== true
                && facts.effectAcknowledged !== 'passenger.board') {
                return transitionError(action, item, 'manifest_passenger_boarding_required');
            }
            if (status === 'dropped') return transitionError(action, item, 'manifest_item_dropped');
            if (status === 'unloaded' && facts.reloadAllowed !== true) {
                return transitionError(action, item, 'manifest_reload_too_far', {
                    distanceM: finiteNumber(facts.reloadDistanceM, null),
                    allowedDistanceM: finiteNumber(facts.reloadAllowedDistanceM, null)
                });
            }
            if (isPassengerItem(item) && facts.skipPassengerEffect !== true
                && facts.effectAcknowledged !== 'passenger.board'
                && facts.effectAcknowledged !== 'passenger.board_at_target') {
                return transitionPlan(action, item, {}, {
                    nextStatus: 'loaded',
                    invalidatesSignature: false,
                    requiresEffect: isTargetPickupItem(item) && status !== 'unloaded'
                        ? 'passenger.board_at_target'
                        : 'passenger.board'
                });
            }
            if (!hasFiniteNumber(facts.now)) {
                return transitionError(action, item, 'manifest_transition_timestamp_required');
            }
            if (isPassengerItem(item)) {
                return transitionPlan(action, item, {
                    status: 'loaded',
                    loadedAt: now,
                    unloadedAt: 0,
                    droppedAt: 0,
                    unloadLat: null,
                    unloadLon: null,
                    unloadAltFt: null,
                    droppedLat: null,
                    droppedLon: null,
                    droppedAltFt: null,
                    handoffComplete: false,
                    handedOffAt: 0
                }, { wasUnloaded: status === 'unloaded', acknowledgedEffect: facts.effectAcknowledged || null });
            }
            var loadPatch = {
                status: 'loaded',
                loadedAt: now,
                unloadedAt: 0,
                droppedAt: 0,
                unloadLat: null,
                unloadLon: null,
                unloadAltFt: null,
                droppedLat: null,
                droppedLon: null,
                droppedAltFt: null,
                lostAt: 0,
                handoffComplete: false,
                handedOffAt: 0
            };
            if (item.persistentEquipment === true) loadPatch.persistentEquipmentInherited = false;
            return transitionPlan(action, item, loadPatch, { wasUnloaded: status === 'unloaded' });
        }

        if (status !== 'loaded') return transitionError(action, item, 'manifest_item_not_loaded');
        if (facts.complianceAllowed !== true) return transitionError(action, item, 'manifest_compliance_locked');

        if (action === 'reset_to_pending') {
            if (facts.groundHandlingAllowed !== true) {
                return transitionError(action, item, 'manifest_ground_handling_required');
            }
            if (isPassengerItem(item)) {
                return transitionPlan(action, item, {}, {
                    nextStatus: 'unloaded',
                    invalidatesSignature: false,
                    requiresEffect: 'passenger.deboard'
                });
            }
            var resetPatch = {
                status: 'pending',
                loadedAt: 0,
                unloadedAt: 0,
                droppedAt: 0,
                unloadLat: null,
                unloadLon: null,
                unloadAltFt: null,
                droppedLat: null,
                droppedLon: null,
                droppedAltFt: null,
                healthPct: 100
            };
            if (item.persistentEquipment === true) resetPatch.persistentEquipmentInherited = false;
            return transitionPlan(action, item, resetPatch);
        }

        var dropped = action === 'drop' || facts.drop === true || facts.airborne === true;
        if (!dropped && facts.groundHandlingAllowed !== true) {
            return transitionError(action, item, 'manifest_ground_handling_required');
        }
        if (isPassengerItem(item) && dropped) {
            return transitionError(action, item, 'manifest_passenger_drop_not_allowed');
        }
        if (isPassengerItem(item)
            && facts.effectAcknowledged !== 'passenger.deboard'
            && facts.effectAcknowledged !== 'passenger.farewell_then_deboard') {
            if (facts.passengerFarewellPending === true) {
                return transitionPlan(action, item, {}, {
                    nextStatus: 'unloaded',
                    invalidatesSignature: false,
                    requiresEffect: 'passenger.farewell_then_deboard'
                });
            }
            return transitionPlan(action, item, {}, {
                nextStatus: 'unloaded',
                invalidatesSignature: false,
                requiresEffect: 'passenger.deboard'
            });
        }
        if (!hasFiniteNumber(facts.now)) {
            return transitionError(action, item, 'manifest_transition_timestamp_required');
        }
        if (dropped) {
            var dropPatch = Object.assign({
                status: 'dropped',
                droppedAt: now,
                unloadLat: null,
                unloadLon: null,
                unloadAltFt: null,
                healthPct: 0
            }, positionPatch(facts, 'dropped'));
            if (item.persistentEquipment === true) dropPatch.persistentEquipmentInherited = false;
            return transitionPlan('drop', item, dropPatch, { dropped: true });
        }
        var unloadPatch = Object.assign({
            status: 'unloaded',
            unloadedAt: now,
            droppedAt: 0,
            droppedLat: null,
            droppedLon: null,
            droppedAltFt: null
        }, positionPatch(facts, 'unload'));
        if (isPassengerItem(item)) {
            unloadPatch.handoffComplete = false;
            unloadPatch.handedOffAt = 0;
        }
        if (item.persistentEquipment === true) unloadPatch.persistentEquipmentInherited = false;
        return transitionPlan('unload', item, unloadPatch, {
            dropped: false,
            acknowledgedEffect: facts.effectAcknowledged || null
        });
    }

    function commitItemTransition(manifest, plan) {
        var transition = object(plan);
        if (!transition || transition.schema !== TRANSITION_SCHEMA || transition.ok !== true) {
            return transitionError('', null, 'manifest_transition_invalid');
        }
        if (transition.requiresEffect) {
            return transitionError(transition.action, findItem(manifest, transition.itemId), 'manifest_transition_effect_pending', {
                requiresEffect: transition.requiresEffect
            });
        }
        var item = findItem(manifest, transition.itemId);
        if (!item) return transitionError(transition.action, null, 'manifest_item_not_found', { itemId: transition.itemId });
        if (String(item.status || 'pending') !== transition.previousStatus) {
            return transitionError(transition.action, item, 'manifest_transition_conflict', {
                expectedStatus: transition.previousStatus
            });
        }
        Object.assign(item, object(transition.patch) || {});
        if (transition.invalidatesSignature === true) clearDispatchSignature(manifest);
        return {
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: transition.action,
            itemId: transition.itemId,
            previousStatus: transition.previousStatus,
            nextStatus: String(item.status || 'pending'),
            item: item,
            signatureInvalidated: transition.invalidatesSignature === true
        };
    }

    function currentBoardBookLog(item, currentFlightId) {
        var log = object(item && item.log) || {};
        return String(log.flightId || '') === String(currentFlightId || '') ? log : {};
    }

    function boardBookActionState(item, manifest, context) {
        var facts = object(context) || {};
        var currentFlightId = String(facts.currentFlightId || (object(manifest && manifest.flightEvents) || {}).flightId || '');
        var log = currentBoardBookLog(item, currentFlightId);
        var hasStart = Number(log.startAt || 0) > 0;
        var hasLanding = Number(log.landingAt || 0) > 0;
        var field = !hasStart ? 'start' : (!hasLanding ? 'landing' : '');
        var availableStatus = item && (item.status === 'loaded' || item.status === 'unloaded');
        var missionAvailable = facts.missionAvailable !== false && manifest && manifest.groundInventory !== true;
        return {
            field: field,
            allowed: !!field && availableStatus && missionAvailable && facts.complianceAllowed !== false,
            complete: hasStart && hasLanding,
            label: field === 'landing' ? 'Landezeit eintragen' : 'Startzeit eintragen',
            log: log,
            currentFlightId: currentFlightId
        };
    }

    function metadataPlan(action, item, patch, manifestPatch, details) {
        return Object.assign({
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: action,
            itemId: item.id,
            previousStatus: String(item.status || 'pending'),
            nextStatus: String(item.status || 'pending'),
            patch: patch || {},
            manifestPatch: manifestPatch || {},
            invalidatesSignature: false,
            requiresEffect: null
        }, object(details) || {});
    }

    function planBoardBookEntry(manifest, request, context) {
        var source = object(request) || {};
        var facts = object(context) || {};
        var item = findItem(manifest, source.itemId || 'bordbuch');
        var field = source.field === 'landing' ? 'landing' : 'start';
        if (!item || !/bordbuch/i.test(String(item.id || '') + ' ' + String(item.label || '') + ' ' + String(item.storyName || ''))) {
            return transitionError('set_boardbook_time', item, 'manifest_boardbook_not_found');
        }
        if (manifest && manifest.groundInventory === true) {
            return transitionError('set_boardbook_time', item, 'manifest_boardbook_mission_required');
        }
        var sourceName = String(source.source || 'cargo');
        var directCargoSource = sourceName === 'cargo-manifest' || sourceName === 'cargo-equipment' || sourceName === 'tracker';
        if (sourceName === 'banner') {
            if (item.status !== 'loaded') return transitionError('set_boardbook_time', item, 'manifest_boardbook_item_not_loaded');
        } else if (directCargoSource) {
            if (item.status !== 'loaded' && item.status !== 'unloaded') {
                return transitionError('set_boardbook_time', item, 'manifest_boardbook_item_unavailable');
            }
        } else if (item.status !== 'unloaded') {
            return transitionError('set_boardbook_time', item, 'manifest_boardbook_item_not_unloaded');
        }
        if (facts.complianceAllowed === false) {
            return transitionError('set_boardbook_time', item, 'manifest_boardbook_compliance_locked');
        }
        var currentFlightId = String(facts.currentFlightId || (object(manifest && manifest.flightEvents) || {}).flightId || '');
        if (!currentFlightId) return transitionError('set_boardbook_time', item, 'manifest_boardbook_flight_id_required');
        var timestamp = finiteNumber(facts.timestamp, null);
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            return transitionError('set_boardbook_time', item, 'manifest_boardbook_timestamp_required');
        }
        var log = currentBoardBookLog(item, currentFlightId);
        var key = field === 'landing' ? 'landingTime' : 'startTime';
        var atKey = field === 'landing' ? 'landingAt' : 'startAt';
        var endpointKey = field === 'landing' ? 'destination' : 'origin';
        var nextLog = Object.assign({}, log, {
            flightId: currentFlightId,
            loggedAt: finiteNumber(facts.loggedAt, timestamp),
            lastSource: sourceName,
            backfilled: sourceName !== 'banner'
        });
        nextLog[key] = String(facts.formattedTime || '');
        nextLog[atKey] = timestamp;
        nextLog[endpointKey] = String(facts.endpointLabel || '');
        var flightEvents = Object.assign({}, object(manifest && manifest.flightEvents) || {});
        if (String(flightEvents.flightId || '') !== currentFlightId) flightEvents = {};
        flightEvents.flightId = currentFlightId;
        if (!Number(flightEvents[atKey] || 0)) flightEvents[atKey] = timestamp;
        return metadataPlan('set_boardbook_time', item, { log: nextLog }, { flightEvents: flightEvents }, { field: field });
    }

    function planEquipmentReplacement(manifest, request, context) {
        var source = object(request) || {};
        var facts = object(context) || {};
        var item = findItem(manifest, source.itemId);
        if (!item || (item.id !== 'first-aid' && item.id !== 'fire-extinguisher')) {
            return transitionError('replace_equipment', item, 'manifest_equipment_not_replaceable');
        }
        var offboardInventoryAvailable = item.status === 'pending' && facts.offboardInventoryAvailable === true;
        if ((item.status !== 'unloaded' && !offboardInventoryAvailable) || item.equipmentType !== 'expiry') {
            return transitionError('replace_equipment', item, 'manifest_equipment_not_presented');
        }
        if (facts.complianceAllowed === false) {
            return transitionError('replace_equipment', item, 'manifest_equipment_compliance_locked');
        }
        var now = finiteNumber(facts.now, null);
        if (!Number.isFinite(now) || now <= 0) return transitionError('replace_equipment', item, 'manifest_equipment_timestamp_required');
        var daysRemaining = expiryDaysRemaining(item.expiresAt, now);
        var threshold = Math.max(1, Math.round(finiteNumber(facts.thresholdDays, EQUIPMENT_REPLACE_THRESHOLD_DAYS)));
        if (Number.isFinite(daysRemaining) && daysRemaining >= threshold) {
            return transitionError('replace_equipment', item, 'manifest_equipment_replacement_too_early', {
                daysRemaining: daysRemaining,
                thresholdDays: threshold
            });
        }
        var expiresAt = String(facts.expiresAt || '');
        var serialId = String(facts.serialId || '');
        if (!expiresAt || !serialId) {
            return transitionError('replace_equipment', item, 'manifest_equipment_replacement_identity_required');
        }
        return metadataPlan('replace_equipment', item, {
            issuedAt: now,
            serialId: serialId,
            expiresAt: expiresAt,
            replacedAt: now
        }, {}, { daysRemaining: daysRemaining, thresholdDays: threshold });
    }

    function commitMetadataTransition(manifest, plan) {
        var transition = object(plan);
        if (!object(manifest) || !transition || transition.schema !== TRANSITION_SCHEMA || transition.ok !== true) {
            return transitionError('', null, 'manifest_transition_invalid');
        }
        var item = findItem(manifest, transition.itemId);
        if (!item) return transitionError(transition.action, null, 'manifest_item_not_found', { itemId: transition.itemId });
        if (String(item.status || 'pending') !== transition.previousStatus) {
            return transitionError(transition.action, item, 'manifest_transition_conflict', {
                expectedStatus: transition.previousStatus
            });
        }
        Object.assign(item, object(transition.patch) || {});
        Object.assign(manifest, object(transition.manifestPatch) || {});
        return {
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: transition.action,
            itemId: transition.itemId,
            previousStatus: transition.previousStatus,
            nextStatus: String(item.status || 'pending'),
            item: item,
            signatureInvalidated: false
        };
    }

    function planSignatureTransition(manifest, request, context) {
        var source = object(request) || {};
        var action = String(source.action || '').toLowerCase();
        var mode = normalizeMode(source.mode);
        if (!object(manifest)) return transitionError(action, null, 'manifest_not_available');
        if (action === 'clear') {
            if (!signatureMatchesMode(manifest.dispatchSignature, mode)) {
                return transitionError(action, null, 'manifest_signature_scope_mismatch', { mode: mode });
            }
            return {
                schema: TRANSITION_SCHEMA,
                version: CORE_VERSION,
                ok: true,
                action: action,
                mode: mode,
                scope: signatureScope(mode),
                signature: null
            };
        }
        if (action !== 'sign') return transitionError(action, null, 'manifest_signature_action_invalid');
        var gates = deriveGateState(manifest, context);
        var missingItems = mode === 'unload'
            ? gates.requiredUnloadBlockingItems
            : (mode === 'pickup' ? gates.requiredPickupMissingItems : gates.requiredDepartureMissingItems);
        if (missingItems.length > 0) {
            return transitionError(action, null, mode === 'unload'
                ? 'manifest_required_unload_pending'
                : (mode === 'pickup' ? 'manifest_required_pickup_pending' : 'manifest_required_load_pending'), {
                mode: mode,
                missingItems: missingItems
            });
        }
        var suppliedSignature = object(source.signature) || {};
        if (!hasFiniteNumber(suppliedSignature.at)) {
            return transitionError(action, null, 'manifest_signature_timestamp_required', { mode: mode });
        }
        return {
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: action,
            mode: mode,
            scope: signatureScope(mode),
            signature: {
                by: suppliedSignature.by,
                at: finiteNumber(suppliedSignature.at, 0),
                aircraft: suppliedSignature.aircraft,
                scope: signatureScope(mode),
                note: String(suppliedSignature.note || '').trim()
            }
        };
    }

    function commitSignatureTransition(manifest, plan) {
        var transition = object(plan);
        if (!object(manifest) || !transition || transition.schema !== TRANSITION_SCHEMA || transition.ok !== true) {
            return transitionError('', null, 'manifest_transition_invalid');
        }
        if (transition.action === 'clear') {
            if (!signatureMatchesMode(manifest.dispatchSignature, transition.mode)) {
                return transitionError('clear', null, 'manifest_transition_conflict');
            }
            manifest.dispatchSignature = null;
        } else if (transition.action === 'sign' && object(transition.signature)) {
            manifest.dispatchSignature = Object.assign({}, transition.signature);
        } else {
            return transitionError(transition.action, null, 'manifest_signature_action_invalid');
        }
        return {
            schema: TRANSITION_SCHEMA,
            version: CORE_VERSION,
            ok: true,
            action: transition.action,
            mode: transition.mode,
            scope: transition.scope,
            signature: manifest.dispatchSignature
        };
    }

    function deriveGateState(manifest, context) {
        var source = object(context) || {};
        var manifestItems = items(manifest);
        var requiredItems = manifestItems.filter(function (item) { return item.required === true; });
        var departureItems = requiredItems.filter(function (item) { return !isTargetPickupItem(item); });
        var pickupItems = requiredItems.filter(isTargetPickupItem);
        var requiredDepartureMissingItems = departureItems.filter(function (item) { return item.status !== 'loaded'; });
        var requiredPickupMissingItems = pickupItems.filter(function (item) { return item.status !== 'loaded'; });
        var unloadOpenItems = manifestItems.filter(function (item) {
            return item.status === 'loaded' && itemNeedsUnloadHere(item, source);
        });
        var unloadOpenNonPassengerItems = unloadOpenItems.filter(function (item) { return !isPassengerItem(item); });
        var requiredUnloadBlockingItems = unloadOpenNonPassengerItems.filter(function (item) { return item.required === true; });
        var signature = object(manifest) ? manifest.dispatchSignature : null;
        var departureSigned = signatureMatchesMode(signature, 'load');
        var pickupSigned = signatureMatchesMode(signature, 'pickup');
        var arrivalSigned = signatureMatchesMode(signature, 'unload');
        return {
            schema: CORE_SCHEMA,
            version: CORE_VERSION,
            total: manifestItems.length,
            requiredTotal: requiredItems.length,
            departureItems: departureItems,
            pickupItems: pickupItems,
            requiredDepartureMissingItems: requiredDepartureMissingItems,
            requiredPickupMissingItems: requiredPickupMissingItems,
            unloadOpenItems: unloadOpenItems,
            unloadOpenNonPassengerItems: unloadOpenNonPassengerItems,
            requiredUnloadBlockingItems: requiredUnloadBlockingItems,
            departureSigned: departureSigned,
            pickupSigned: pickupSigned,
            arrivalSigned: arrivalSigned,
            departureItemsComplete: requiredDepartureMissingItems.length === 0,
            pickupItemsComplete: pickupItems.length > 0 && requiredPickupMissingItems.length === 0,
            requiredUnloadComplete: requiredUnloadBlockingItems.length === 0,
            loadReady: requiredDepartureMissingItems.length === 0 && departureSigned,
            pickupReady: pickupItems.length > 0 && requiredPickupMissingItems.length === 0 && pickupSigned,
            unloadReady: requiredUnloadBlockingItems.length === 0 && arrivalSigned,
            needsUnload: unloadOpenItems.length > 0,
            needsUnloadIgnoringPassenger: unloadOpenNonPassengerItems.length > 0,
            arrivalWorkflowRequired: unloadOpenItems.length > 0 || !arrivalSigned,
            arrivalWorkflowRequiredIgnoringPassenger: unloadOpenNonPassengerItems.length > 0 || !arrivalSigned
        };
    }

    function needsUnload(manifest, options) {
        var source = object(options) || {};
        var gates = deriveGateState(manifest, source);
        return source.ignorePassenger === true ? gates.needsUnloadIgnoringPassenger : gates.needsUnload;
    }

    function needsArrivalWorkflow(manifest, options) {
        var source = object(options) || {};
        var gates = deriveGateState(manifest, source);
        return source.ignorePassenger === true
            ? gates.arrivalWorkflowRequiredIgnoringPassenger
            : gates.arrivalWorkflowRequired;
    }

    return Object.freeze({
        schema: CORE_SCHEMA,
        version: CORE_VERSION,
        EQUIPMENT_REPLACE_THRESHOLD_DAYS: EQUIPMENT_REPLACE_THRESHOLD_DAYS,
        normalizeMode: normalizeMode,
        signatureScope: signatureScope,
        signatureMatchesMode: signatureMatchesMode,
        isPassengerItem: isPassengerItem,
        isHandoffLocked: isHandoffLocked,
        isTargetPickupItem: isTargetPickupItem,
        itemCanLoadAtCurrentStage: itemCanLoadAtCurrentStage,
        itemNeedsUnloadHere: itemNeedsUnloadHere,
        clearDispatchSignature: clearDispatchSignature,
        planItemTransition: planItemTransition,
        commitItemTransition: commitItemTransition,
        boardBookActionState: boardBookActionState,
        planBoardBookEntry: planBoardBookEntry,
        planEquipmentReplacement: planEquipmentReplacement,
        commitMetadataTransition: commitMetadataTransition,
        expiryDaysRemaining: expiryDaysRemaining,
        formatExpiryDate: formatExpiryDate,
        planSignatureTransition: planSignatureTransition,
        commitSignatureTransition: commitSignatureTransition,
        deriveGateState: deriveGateState,
        needsUnload: needsUnload,
        needsArrivalWorkflow: needsArrivalWorkflow
    });
}));
