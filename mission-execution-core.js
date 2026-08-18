(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionExecutionCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var CORE_VERSION = 1;
    var BUNDLE_SCHEMA = 'ga.mission-execution-bundle.v1';
    var STATE_SCHEMA = 'ga.mission-execution-state.v1';
    var SHADOW_SCHEMA = 'ga.mission-execution-shadow.v1';
    var MAX_EVENTS = 160;
    var MAX_EFFECTS = 48;
    var KNOWN_PHASES = Object.freeze([
        'planned', 'prepare', 'boarding', 'boarded', 'active', 'enroute',
        'on_task', 'return_leg', 'end_unloading', 'end_ready', 'closing', 'closed'
    ]);
    var KNOWN_EVENT_TYPES = Object.freeze([
        'MISSION_ACCEPTED', 'PREPARE_REQUESTED', 'BOARDING_STARTED',
        'BOARDING_CONFIRMED', 'LOAD_CONFIRMED', 'MISSION_STARTED', 'AIRBORNE',
        'TARGET_ENTERED', 'TASK_PROGRESS', 'TOUCHDOWN', 'GROUND_STILL',
        'PICKUP_CONFIRMED', 'UNLOAD_CONFIRMED', 'FAREWELL_STARTED', 'FAREWELL_COMPLETED',
        'CARGO_STATE_CHANGED', 'COMPLIANCE_EVENT', 'EFFECT_ACKNOWLEDGED', 'CLOSE_REQUESTED', 'MISSION_CLOSED',
        'AUTHORITATIVE_SNAPSHOT_IMPORTED'
    ]);
    var EVENT_SET = new Set(KNOWN_EVENT_TYPES);
    var PHASE_SET = new Set(KNOWN_PHASES);
    var CARGO_STATUSES = new Set(['pending', 'loaded', 'unloaded', 'dropped', 'lost', 'handed_off']);

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function text(value, maxLength) {
        var limit = Number.isFinite(Number(maxLength)) ? Math.max(0, Math.round(Number(maxLength))) : 180;
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, limit);
    }

    function finite(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function integer(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? Math.round(number) : fallback;
    }

    function round(value, digits, fallback) {
        var number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        var factor = Math.pow(10, Math.max(0, Math.min(6, integer(digits, 0))));
        return Math.round(number * factor) / factor;
    }

    function clone(value, fallback) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return fallback;
        }
    }

    function canonicalValue(value) {
        if (value == null) return null;
        if (typeof value === 'string' || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (Array.isArray(value)) return value.map(canonicalValue);
        if (typeof value !== 'object') return null;
        var result = {};
        Object.keys(value).sort().forEach(function (key) {
            var item = value[key];
            if (typeof item !== 'undefined' && typeof item !== 'function') result[key] = canonicalValue(item);
        });
        return result;
    }

    function canonicalStringify(value) {
        return JSON.stringify(canonicalValue(value));
    }

    function hashValue(value) {
        var raw = canonicalStringify(value);
        var hash = 2166136261;
        for (var index = 0; index < raw.length; index += 1) {
            hash ^= raw.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return 'mex1-' + (hash >>> 0).toString(16).padStart(8, '0') + '-' + raw.length;
    }

    function normalizePhase(value, fallback) {
        var phase = text(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
        var aliases = {
            idle: 'planned',
            accepted: 'planned',
            preparation: 'prepare',
            preparing: 'prepare',
            loading: 'boarding',
            started: 'active',
            airborne: 'enroute',
            task: 'on_task',
            target: 'on_task',
            pickup: 'on_task',
            rtb: 'return_leg',
            inspection: 'end_ready',
            ready_to_close: 'end_ready',
            completed: 'closed',
            ended: 'closed'
        };
        phase = aliases[phase] || phase;
        if (PHASE_SET.has(phase)) return phase;
        return PHASE_SET.has(fallback) ? fallback : 'planned';
    }

    function phaseIndex(phase) {
        var index = KNOWN_PHASES.indexOf(normalizePhase(phase, 'planned'));
        return index >= 0 ? index : 0;
    }

    function normalizeCargoItem(raw, index) {
        var source = object(raw);
        var id = text(source.id || source.cargoItemId || ('item-' + (index + 1)), 120).toLowerCase()
            .replace(/[^a-z0-9_.:-]+/g, '-')
            .replace(/^-+|-+$/g, '') || ('item-' + (index + 1));
        var itemType = text(source.itemType, 30).toLowerCase() === 'passenger' ? 'passenger' : 'cargo';
        var status = text(source.status || 'pending', 30).toLowerCase();
        if (source.handoffComplete === true || Number(source.handedOffAt || 0) > 0) status = 'handed_off';
        if (!CARGO_STATUSES.has(status)) status = 'pending';
        var pickup = source.pickup === 'target' || source.pickupLocation === 'target' ? 'target' : 'departure';
        var delivery = source.delivery === 'home' || source.deliverAtHome === true
            ? 'home'
            : (source.delivery === 'none' || source.deliverAtDestination === false ? 'none' : 'destination');
        return {
            id: id,
            itemType: itemType,
            status: status,
            required: source.required === true,
            pickup: pickup,
            delivery: delivery,
            persistentEquipment: source.persistentEquipment === true,
            passengerCount: itemType === 'passenger'
                ? Math.max(1, Math.min(6, integer(source.passengerCount, 1)))
                : 0,
            weightLbs: Math.max(0, round(source.weightLbs, 1, 0)),
            healthPct: Math.max(0, Math.min(100, integer(source.healthPct, 100)))
        };
    }

    function normalizeCargo(raw) {
        var source = object(raw);
        var items = (Array.isArray(source.items) ? source.items : [])
            .slice(0, 160)
            .map(normalizeCargoItem)
            .sort(function (left, right) {
                if (left.id < right.id) return -1;
                if (left.id > right.id) return 1;
                return 0;
            });
        var signature = object(source.dispatchSignature);
        var rawSignatureScope = text(source.signatureScope || signature.scope, 20).toLowerCase();
        var signatureScope = ['departure', 'pickup', 'arrival'].includes(rawSignatureScope)
            ? rawSignatureScope
            : null;
        var requiredItems = items.filter(function (item) { return item.required; });
        var departureItems = requiredItems.filter(function (item) { return item.pickup !== 'target'; });
        var pickupItems = requiredItems.filter(function (item) { return item.pickup === 'target'; });
        var destinationItems = requiredItems.filter(function (item) { return item.delivery === 'destination'; });
        var homeItems = requiredItems.filter(function (item) { return item.delivery === 'home'; });
        var countStatus = function (status) {
            return items.filter(function (item) { return item.status === status; }).length;
        };
        var manifestKey = text(source.manifestKey || source.key, 160);
        return {
            schemaVersion: Math.max(0, integer(source.schemaVersion || source.version, 0)),
            manifestKeyHash: text(source.manifestKeyHash, 180) || (manifestKey ? hashValue(manifestKey) : null),
            signatureScope: signatureScope,
            items: items,
            summary: {
                total: items.length,
                requiredTotal: requiredItems.length,
                loaded: countStatus('loaded'),
                unloaded: countStatus('unloaded') + countStatus('handed_off'),
                pending: countStatus('pending'),
                dropped: countStatus('dropped'),
                lost: countStatus('lost'),
                departureTotal: departureItems.length,
                departureMissing: departureItems.filter(function (item) { return item.status !== 'loaded'; }).length,
                pickupTotal: pickupItems.length,
                pickupMissing: pickupItems.filter(function (item) { return item.status !== 'loaded'; }).length,
                destinationTotal: destinationItems.length,
                destinationRemaining: destinationItems.filter(function (item) { return item.status === 'loaded'; }).length,
                homeTotal: homeItems.length,
                homeRemaining: homeItems.filter(function (item) { return item.status === 'loaded'; }).length,
                departureReady: departureItems.every(function (item) { return item.status === 'loaded'; }),
                pickupReady: pickupItems.every(function (item) { return item.status === 'loaded'; }),
                failed: requiredItems.some(function (item) {
                    return item.status === 'dropped' || item.status === 'lost' || item.healthPct <= 35;
                })
            }
        };
    }

    function normalizeCompliance(raw) {
        var source = object(raw);
        var phase = text(source.phase || 'none', 60).toLowerCase().replace(/[\s-]+/g, '_') || 'none';
        return {
            selected: source.selected === true ? true : (source.selected === false ? false : null),
            phase: phase,
            revision: Math.max(0, integer(source.revision, 0)),
            inspectorsWaiting: source.inspectorsWaiting === true,
            farewellComplete: source.farewellComplete === true,
            remediationRequired: source.remediationRequired === true || object(source.remediation).required === true,
            result: text(
                typeof source.result === 'string' ? source.result : (object(source.result).status || object(source.result).result),
                60
            ).toLowerCase() || null,
            released: source.released === true || phase === 'released' || Number(source.releasedAt || 0) > 0
        };
    }

    function normalizeProgress(runtimeRoot) {
        var root = object(runtimeRoot);
        var poi = object(root.poiProgress);
        var bush = object(root.bushProgress);
        var recorder = object(root.flightRecorder);
        return {
            targetSatisfied: poi.satisfied === true || bush.targetSatisfied === true || bush.targetCompleted === true,
            taskAborted: poi.aborted === true || bush.aborted === true,
            manualConfirmed: poi.manualConfirmed === true || bush.manualConfirmed === true,
            atTargetDone: poi.atTargetDone === true || bush.atTargetDone === true,
            pickupCompleted: bush.pickupCompleted === true || bush.pickupConfirmed === true,
            returnLeg: bush.returnLeg === true || text(bush.status, 60).toLowerCase() === 'return_leg',
            airborneSeen: recorder.hadAirbornePhase === true || Number(recorder.airborneEvidenceSec || 0) > 0,
            dwellSec: Math.max(0, round(poi.dwellSec, 1, 0)),
            attempts: Math.max(0, integer(poi.attempts, 0))
        };
    }

    function baseState(missionId, recipe) {
        return {
            schema: STATE_SCHEMA,
            version: CORE_VERSION,
            missionId: text(missionId, 180),
            recipe: text(recipe || 'apt', 80).toLowerCase() || 'apt',
            phase: 'planned',
            subphase: 'accepted',
            revision: 0,
            flags: {
                accepted: true,
                prepared: false,
                boardingConfirmed: false,
                loadConfirmed: false,
                started: false,
                active: false,
                closingPending: false,
                closed: false,
                onGround: null,
                groundStill: false,
                farewellCompleted: false
            },
            progress: normalizeProgress(null),
            cargo: normalizeCargo(null),
            workflows: { complianceInspection: normalizeCompliance(null) },
            effects: [],
            processedEventIds: []
        };
    }

    function projectLegacyBundle(rawBundle) {
        var bundle = object(rawBundle);
        var runtimeRoot = object(bundle.runtime);
        var runtime = object(runtimeRoot.runtime);
        var missionId = text(bundle.missionId || runtimeRoot.missionId || runtime.missionId, 180);
        if (!missionId) return null;
        var state = baseState(missionId, bundle.adapter || 'apt');
        var startPhase = normalizePhase(runtimeRoot.startPhase, 'planned');
        var phase = normalizePhase(runtime.phase || startPhase, startPhase);
        var active = runtime.active === true;
        var closing = runtime.closingPending === true || phase === 'closing';
        var closed = phase === 'closed';
        var progress = normalizeProgress(runtimeRoot);
        var cargo = normalizeCargo(runtimeRoot.cargoManifest);
        var liveFlight = object(runtimeRoot.lastLiveFlightData);
        var onGround = typeof liveFlight.onGround === 'boolean' ? liveFlight.onGround : null;
        var groundSpeed = finite(liveFlight.gsKts, null);
        var groundStill = onGround === true
            && (groundSpeed == null || groundSpeed <= 5)
            && liveFlight.simPaused !== true
            && liveFlight.inMenuOrMap !== true;
        if (active && phase === 'active' && progress.airborneSeen && onGround !== true) phase = 'enroute';
        if (phase === 'end_ready' && cargo.summary.destinationRemaining > 0) phase = 'end_unloading';
        var phaseAtLeastBoarded = phaseIndex(phase) >= phaseIndex('boarded');
        var phaseAtLeastActive = phaseIndex(phase) >= phaseIndex('active');
        state.phase = phase;
        var subphases = {
            prepare: 'ground_preparation',
            boarding: 'boarding',
            boarded: 'start_ready',
            active: 'departure',
            enroute: onGround === true ? (groundStill ? 'ground_still' : 'touchdown') : 'outbound_flight',
            end_unloading: 'ground_still',
            end_ready: cargo.summary.destinationTotal > 0 ? 'unload_complete' : 'ground_still',
            closing: 'close_requested',
            closed: 'closed'
        };
        state.subphase = runtime.deboardingAfterFarewellStarted === true
            ? 'farewell_complete'
            : (runtime.waitingFarewellDeboarding === true ? 'farewell_wait' : (subphases[phase] || phase));
        state.flags = {
            accepted: true,
            prepared: phaseIndex(phase) >= phaseIndex('prepare'),
            boardingConfirmed: phaseAtLeastBoarded,
            loadConfirmed: phaseAtLeastBoarded,
            started: active || phaseAtLeastActive || Number(runtime.startedAt || runtimeRoot.startedAt || 0) > 0,
            active: active,
            closingPending: closing,
            closed: closed,
            onGround: onGround,
            groundStill: groundStill,
            farewellCompleted: runtime.deboardingAfterFarewellStarted === true
        };
        state.progress = progress;
        state.cargo = cargo;
        state.workflows = {
            complianceInspection: normalizeCompliance(runtimeRoot.complianceInspection)
        };
        return normalizeState(state);
    }

    function normalizeEffect(raw, index) {
        var source = object(raw);
        return {
            effectId: text(source.effectId || ('effect-' + (index + 1)), 220),
            type: text(source.type, 100).toLowerCase(),
            status: text(source.status || 'requested', 40).toLowerCase(),
            sourceEventId: text(source.sourceEventId, 220) || null,
            payload: canonicalValue(object(source.payload))
        };
    }

    function normalizeState(raw) {
        var source = object(raw);
        var state = baseState(source.missionId, source.recipe);
        state.phase = normalizePhase(source.phase, 'planned');
        state.subphase = text(source.subphase || state.phase, 80).toLowerCase().replace(/[\s-]+/g, '_') || state.phase;
        state.revision = Math.max(0, integer(source.revision, 0));
        var flags = object(source.flags);
        Object.keys(state.flags).forEach(function (key) {
            if (key === 'onGround') {
                state.flags.onGround = typeof flags.onGround === 'boolean' ? flags.onGround : null;
            } else {
                state.flags[key] = flags[key] === true;
            }
        });
        var progress = object(source.progress);
        state.progress = {
            targetSatisfied: progress.targetSatisfied === true,
            taskAborted: progress.taskAborted === true,
            manualConfirmed: progress.manualConfirmed === true,
            atTargetDone: progress.atTargetDone === true,
            pickupCompleted: progress.pickupCompleted === true,
            returnLeg: progress.returnLeg === true,
            airborneSeen: progress.airborneSeen === true,
            dwellSec: Math.max(0, round(progress.dwellSec, 1, 0)),
            attempts: Math.max(0, integer(progress.attempts, 0))
        };
        state.cargo = normalizeCargo(source.cargo);
        var workflows = object(source.workflows);
        state.workflows = { complianceInspection: normalizeCompliance(workflows.complianceInspection) };
        state.effects = (Array.isArray(source.effects) ? source.effects : []).slice(-MAX_EFFECTS).map(normalizeEffect);
        state.processedEventIds = (Array.isArray(source.processedEventIds) ? source.processedEventIds : [])
            .map(function (value) { return text(value, 220); })
            .filter(Boolean)
            .slice(-MAX_EVENTS);
        return state;
    }

    function normalizeEvent(raw, fallbackSequence) {
        var source = object(raw);
        var type = text(source.type, 100).toUpperCase().replace(/[\s.-]+/g, '_');
        if (!EVENT_SET.has(type)) return null;
        var sequence = Math.max(0, integer(source.sequence, integer(fallbackSequence, 0)));
        var occurredAt = Math.max(0, integer(source.occurredAt || source.at, 0));
        var payload = canonicalValue(object(source.payload));
        var eventId = text(source.eventId || source.id, 220);
        if (!eventId) eventId = 'evt-' + hashValue({ type: type, sequence: sequence, occurredAt: occurredAt, payload: payload });
        return {
            schema: 'ga.mission-execution-event.v1',
            version: CORE_VERSION,
            eventId: eventId,
            type: type,
            sequence: sequence,
            occurredAt: occurredAt,
            payload: payload
        };
    }

    function createEffect(state, event, type, payload) {
        var effectType = text(type, 100).toLowerCase();
        return {
            effectId: 'mfx-' + hashValue({ missionId: state.missionId, eventId: event.eventId, type: effectType }),
            type: effectType,
            status: 'requested',
            sourceEventId: event.eventId,
            payload: canonicalValue(object(payload))
        };
    }

    function appendEffect(state, effect) {
        if (!effect || !effect.effectId) return;
        if (state.effects.some(function (item) { return item.effectId === effect.effectId; })) return;
        state.effects.push(effect);
        state.effects = state.effects.slice(-MAX_EFFECTS);
    }

    function applyCargoFromEvent(state, event) {
        var cargo = object(event.payload).cargo;
        if (cargo && typeof cargo === 'object' && !Array.isArray(cargo)) state.cargo = normalizeCargo(cargo);
    }

    function eventAllowed(state, event) {
        var phase = state.phase;
        var eventCargo = object(event.payload).cargo && typeof object(event.payload).cargo === 'object'
            ? normalizeCargo(object(event.payload).cargo)
            : state.cargo;
        var compliance = state.workflows.complianceInspection;
        if (event.type === 'MISSION_ACCEPTED' || event.type === 'AUTHORITATIVE_SNAPSHOT_IMPORTED') return true;
        if (state.flags.closed && event.type !== 'MISSION_CLOSED' && event.type !== 'EFFECT_ACKNOWLEDGED') return false;
        if (event.type === 'CARGO_STATE_CHANGED') return true;
        if (event.type === 'PREPARE_REQUESTED') return phase === 'planned';
        if (event.type === 'BOARDING_STARTED') return phase === 'prepare' || phase === 'boarding';
        if (event.type === 'BOARDING_CONFIRMED') return phase === 'boarding' || phase === 'prepare';
        if (event.type === 'LOAD_CONFIRMED') {
            return (phase === 'prepare' || phase === 'boarding' || phase === 'boarded')
                && eventCargo.summary.departureReady
                && (eventCargo.summary.departureTotal === 0 || eventCargo.signatureScope === 'departure');
        }
        if (event.type === 'MISSION_STARTED') return phase === 'boarded' && state.flags.loadConfirmed && state.flags.boardingConfirmed;
        if (event.type === 'AIRBORNE') return state.flags.started || phase === 'active' || phase === 'enroute';
        if (event.type === 'TARGET_ENTERED' || event.type === 'TASK_PROGRESS') return state.flags.active;
        if (event.type === 'TOUCHDOWN' || event.type === 'GROUND_STILL') return state.flags.started || state.flags.active;
        if (event.type === 'PICKUP_CONFIRMED') {
            return state.flags.active
                && state.flags.groundStill
                && eventCargo.summary.pickupTotal > 0
                && eventCargo.summary.pickupMissing === 0
                && eventCargo.signatureScope === 'pickup';
        }
        if (event.type === 'UNLOAD_CONFIRMED') {
            return state.flags.active
                && state.flags.groundStill
                && eventCargo.summary.destinationTotal > 0
                && eventCargo.summary.destinationRemaining === 0
                && eventCargo.signatureScope === 'arrival';
        }
        if (event.type === 'FAREWELL_STARTED' || event.type === 'FAREWELL_COMPLETED') {
            return phase === 'end_ready' || phase === 'end_unloading' || phase === 'closing';
        }
        if (event.type === 'COMPLIANCE_EVENT') return !state.flags.closed;
        if (event.type === 'EFFECT_ACKNOWLEDGED') {
            var effectId = text(object(event.payload).effectId, 220);
            var effectStatus = text(object(event.payload).status, 40).toLowerCase();
            return !!effectId
                && (effectStatus === 'completed' || effectStatus === 'failed')
                && state.effects.some(function (effect) {
                    return effect.effectId === effectId && effect.status === 'requested';
                });
        }
        if (event.type === 'CLOSE_REQUESTED') {
            return (phase === 'end_ready' || phase === 'closing')
                && eventCargo.summary.destinationRemaining === 0
                && !(compliance.selected === true && !compliance.released)
                && !compliance.remediationRequired;
        }
        if (event.type === 'MISSION_CLOSED') return phase === 'closing' || phase === 'end_ready';
        return false;
    }

    function reduce(rawState, rawEvent) {
        var state = normalizeState(rawState);
        var event = normalizeEvent(rawEvent, state.revision + 1);
        if (!event || state.processedEventIds.includes(event.eventId) || !eventAllowed(state, event)) return state;
        if (event.type === 'AUTHORITATIVE_SNAPSHOT_IMPORTED') {
            var imported = projectLegacyBundle(object(event.payload).resumeBundle);
            if (!imported || imported.missionId !== state.missionId) return state;
            imported.revision = state.revision + 1;
            imported.processedEventIds = state.processedEventIds.concat(event.eventId).slice(-MAX_EVENTS);
            return normalizeState(imported);
        }
        if (event.type === 'MISSION_ACCEPTED') {
            state.phase = 'planned';
            state.subphase = 'accepted';
            state.flags.accepted = true;
        } else if (event.type === 'PREPARE_REQUESTED') {
            state.phase = 'prepare';
            state.subphase = 'ground_preparation';
            state.flags.prepared = true;
            appendEffect(state, createEffect(state, event, 'scene.prepare', { operation: 'prepare' }));
        } else if (event.type === 'BOARDING_STARTED') {
            state.phase = 'boarding';
            state.subphase = 'boarding';
            state.flags.prepared = true;
            appendEffect(state, createEffect(state, event, 'scene.boarding', { operation: 'boarding' }));
        } else if (event.type === 'BOARDING_CONFIRMED') {
            applyCargoFromEvent(state, event);
            state.flags.boardingConfirmed = true;
            state.phase = state.flags.loadConfirmed ? 'boarded' : 'boarding';
            state.subphase = state.flags.loadConfirmed ? 'start_ready' : 'awaiting_load_confirmation';
        } else if (event.type === 'LOAD_CONFIRMED') {
            applyCargoFromEvent(state, event);
            state.flags.loadConfirmed = true;
            state.phase = state.flags.boardingConfirmed ? 'boarded' : 'boarding';
            state.subphase = state.flags.boardingConfirmed ? 'start_ready' : 'awaiting_boarding_confirmation';
        } else if (event.type === 'MISSION_STARTED') {
            state.phase = 'active';
            state.subphase = 'departure';
            state.flags.started = true;
            state.flags.active = true;
        } else if (event.type === 'AIRBORNE') {
            state.phase = state.progress.returnLeg ? 'return_leg' : 'enroute';
            state.subphase = state.progress.returnLeg ? 'return_flight' : 'outbound_flight';
            state.flags.started = true;
            state.flags.active = true;
            state.flags.onGround = false;
            state.flags.groundStill = false;
            state.progress.airborneSeen = true;
        } else if (event.type === 'TARGET_ENTERED') {
            state.phase = 'on_task';
            state.subphase = 'target_entered';
            state.progress.atTargetDone = true;
        } else if (event.type === 'TASK_PROGRESS') {
            state.progress.targetSatisfied = object(event.payload).satisfied === true || state.progress.targetSatisfied;
            state.progress.taskAborted = object(event.payload).aborted === true || state.progress.taskAborted;
            state.progress.manualConfirmed = object(event.payload).manualConfirmed === true || state.progress.manualConfirmed;
            state.progress.dwellSec = Math.max(state.progress.dwellSec, Math.max(0, round(object(event.payload).dwellSec, 1, 0)));
            state.progress.attempts = Math.max(state.progress.attempts, Math.max(0, integer(object(event.payload).attempts, 0)));
            state.subphase = state.progress.targetSatisfied ? 'task_satisfied' : 'task_progress';
        } else if (event.type === 'TOUCHDOWN') {
            state.flags.onGround = true;
            state.flags.groundStill = false;
            state.subphase = 'touchdown';
        } else if (event.type === 'GROUND_STILL') {
            state.flags.onGround = true;
            state.flags.groundStill = true;
            if (object(event.payload).atDestination === true && state.progress.airborneSeen) {
                state.phase = state.cargo.summary.destinationRemaining > 0 ? 'end_unloading' : 'end_ready';
            }
            state.subphase = 'ground_still';
        } else if (event.type === 'PICKUP_CONFIRMED') {
            applyCargoFromEvent(state, event);
            state.phase = 'return_leg';
            state.subphase = 'pickup_complete';
            state.progress.pickupCompleted = true;
            state.progress.returnLeg = true;
            appendEffect(state, createEffect(state, event, 'cargo.pickup_confirmed', { operation: 'pickup' }));
        } else if (event.type === 'UNLOAD_CONFIRMED') {
            applyCargoFromEvent(state, event);
            state.phase = 'end_ready';
            state.subphase = 'unload_complete';
            appendEffect(state, createEffect(state, event, 'cargo.unload_confirmed', { operation: 'unload' }));
        } else if (event.type === 'FAREWELL_STARTED') {
            state.subphase = 'farewell_wait';
        } else if (event.type === 'FAREWELL_COMPLETED') {
            state.flags.farewellCompleted = true;
            state.subphase = 'farewell_complete';
            appendEffect(state, createEffect(state, event, 'scene.deboarding_continue', { operation: 'farewell' }));
        } else if (event.type === 'CARGO_STATE_CHANGED') {
            applyCargoFromEvent(state, event);
        } else if (event.type === 'COMPLIANCE_EVENT') {
            var compliance = object(event.payload);
            state.workflows.complianceInspection = normalizeCompliance({
                selected: compliance.selected,
                phase: compliance.phase,
                revision: Object.prototype.hasOwnProperty.call(compliance, 'revision')
                    ? Math.max(0, integer(compliance.revision, 0))
                    : state.workflows.complianceInspection.revision + 1,
                inspectorsWaiting: compliance.inspectorsWaiting,
                farewellComplete: compliance.farewellComplete,
                remediation: { required: compliance.remediationRequired === true },
                result: { status: compliance.result },
                releasedAt: compliance.released === true ? event.occurredAt || 1 : 0
            });
        } else if (event.type === 'EFFECT_ACKNOWLEDGED') {
            var acknowledgedEffectId = text(object(event.payload).effectId, 220);
            var acknowledgedStatus = text(object(event.payload).status, 40).toLowerCase();
            state.effects = state.effects.map(function (effect) {
                if (effect.effectId !== acknowledgedEffectId || effect.status !== 'requested') return effect;
                return {
                    effectId: effect.effectId,
                    type: effect.type,
                    status: acknowledgedStatus,
                    sourceEventId: effect.sourceEventId,
                    payload: effect.payload
                };
            });
        } else if (event.type === 'CLOSE_REQUESTED') {
            state.phase = 'closing';
            state.subphase = 'close_requested';
            state.flags.active = false;
            state.flags.closingPending = true;
            appendEffect(state, createEffect(state, event, 'mission.close_requested', { operation: 'close' }));
        } else if (event.type === 'MISSION_CLOSED') {
            state.phase = 'closed';
            state.subphase = 'closed';
            state.flags.active = false;
            state.flags.closingPending = false;
            state.flags.closed = true;
        }
        state.revision += 1;
        state.processedEventIds.push(event.eventId);
        state.processedEventIds = state.processedEventIds.slice(-MAX_EVENTS);
        return normalizeState(state);
    }

    function blockingReasons(state) {
        var result = [];
        var phase = state.phase;
        if ((phase === 'prepare' || phase === 'boarding') && !state.cargo.summary.departureReady) result.push('departure_manifest_incomplete');
        if ((phase === 'prepare' || phase === 'boarding') && state.cargo.signatureScope !== 'departure') result.push('departure_signature_missing');
        if (phase === 'boarding' && !state.flags.boardingConfirmed) result.push('boarding_not_confirmed');
        if (phase === 'boarding' && !state.flags.loadConfirmed) result.push('load_not_confirmed');
        if (phase === 'on_task' && state.cargo.summary.pickupMissing > 0) result.push('pickup_manifest_incomplete');
        if ((phase === 'end_unloading' || phase === 'end_ready') && state.cargo.summary.destinationRemaining > 0) result.push('destination_unload_incomplete');
        var compliance = state.workflows.complianceInspection;
        if (compliance.selected === true && !compliance.released) result.push('compliance_inspection_active');
        if (compliance.remediationRequired) result.push('compliance_remediation_required');
        if (state.progress.taskAborted) result.push('task_aborted');
        if (state.cargo.summary.failed) result.push('cargo_failure');
        return Array.from(new Set(result)).sort();
    }

    function allowedActions(rawState) {
        var state = normalizeState(rawState);
        var actions = [];
        var phase = state.phase;
        if (phase === 'planned') actions.push('prepare_mission');
        if (phase === 'prepare' || phase === 'boarding') {
            actions.push('set_manifest_item');
            if (state.cargo.summary.departureReady) actions.push('sign_manifest');
            if (state.cargo.summary.departureReady && state.cargo.signatureScope === 'departure') actions.push('confirm_load');
        }
        if (phase === 'boarded') actions.push('start_mission');
        if (state.flags.active) {
            actions.push('request_pax_interaction', 'request_voice_playback');
            if (state.flags.groundStill && state.phase === 'on_task' && state.cargo.summary.pickupTotal > 0) {
                actions.push('set_manifest_item');
                if (state.cargo.summary.pickupMissing === 0) actions.push('sign_manifest');
                if (state.cargo.summary.pickupMissing === 0 && state.cargo.signatureScope === 'pickup') actions.push('confirm_pickup');
            }
            if (state.flags.groundStill && state.progress.airborneSeen && state.cargo.summary.destinationTotal > 0) {
                actions.push('set_manifest_item');
                if (state.cargo.summary.destinationRemaining === 0) actions.push('sign_manifest');
                if (state.cargo.summary.destinationRemaining === 0 && state.cargo.signatureScope === 'arrival') actions.push('confirm_unload');
            }
        }
        if (phase === 'end_ready' && blockingReasons(state).every(function (reason) {
            return reason !== 'destination_unload_incomplete' && reason !== 'compliance_inspection_active' && reason !== 'compliance_remediation_required';
        })) actions.push('request_close');
        if (!state.flags.closed) actions.push('abort_mission', 'reset_mission');
        return Array.from(new Set(actions)).sort();
    }

    function nextStep(state) {
        if (state.phase === 'planned') return 'prepare';
        if (state.phase === 'prepare' || state.phase === 'boarding') {
            if (!state.cargo.summary.departureReady) return 'complete_departure_manifest';
            if (state.cargo.signatureScope !== 'departure') return 'sign_departure_manifest';
            if (!state.flags.loadConfirmed) return 'confirm_load';
            if (!state.flags.boardingConfirmed) return 'await_boarding';
            return 'start_mission';
        }
        if (state.phase === 'boarded') return 'start_mission';
        if (state.phase === 'active' || state.phase === 'enroute') return 'fly_to_target';
        if (state.phase === 'on_task') return state.cargo.summary.pickupMissing > 0 ? 'complete_pickup' : 'complete_task';
        if (state.phase === 'return_leg') return 'return_and_land';
        if (state.phase === 'end_unloading') return 'complete_unload';
        if (state.phase === 'end_ready') return 'close_mission';
        if (state.phase === 'closing') return 'await_close';
        return 'complete';
    }

    function deriveView(rawState) {
        var state = normalizeState(rawState);
        return {
            phase: state.phase,
            subphase: state.subphase,
            nextStep: nextStep(state),
            allowedActions: allowedActions(state),
            blockingReasons: blockingReasons(state),
            cargo: clone(state.cargo.summary, {}),
            workflows: clone(state.workflows, {})
        };
    }

    function stateForHash(rawState) {
        var state = normalizeState(rawState);
        return {
            schema: state.schema,
            version: state.version,
            missionId: state.missionId,
            recipe: state.recipe,
            phase: state.phase,
            subphase: state.subphase,
            revision: state.revision,
            flags: state.flags,
            progress: state.progress,
            cargo: state.cargo,
            workflows: state.workflows,
            effects: state.effects,
            processedEventIds: state.processedEventIds
        };
    }

    function stateHash(rawState) {
        return hashValue(stateForHash(rawState));
    }

    function semanticState(rawState) {
        var state = normalizeState(rawState);
        return {
            missionId: state.missionId,
            recipe: state.recipe,
            phase: state.phase,
            subphase: state.subphase,
            flags: {
                accepted: state.flags.accepted,
                prepared: state.flags.prepared,
                boardingConfirmed: state.flags.boardingConfirmed,
                loadConfirmed: state.flags.loadConfirmed,
                started: state.flags.started,
                active: state.flags.active,
                closingPending: state.flags.closingPending,
                closed: state.flags.closed,
                onGround: state.flags.onGround,
                groundStill: state.flags.groundStill
            },
            progress: state.progress,
            cargo: state.cargo,
            workflows: state.workflows
        };
    }

    function semanticHash(rawState) {
        return hashValue(semanticState(rawState));
    }

    function semanticDriftFields(leftState, rightState) {
        var left = semanticState(leftState);
        var right = semanticState(rightState);
        return Object.keys(left).filter(function (field) {
            return canonicalStringify(left[field]) !== canonicalStringify(right[field]);
        });
    }

    function createExecutionBundle(resumeBundle, options) {
        var config = object(options);
        var initialState = projectLegacyBundle(resumeBundle);
        if (!initialState) return null;
        var events = (Array.isArray(config.events) ? config.events : [])
            .slice(0, MAX_EVENTS)
            .map(function (event, index) { return normalizeEvent(event, index + 1); })
            .filter(Boolean);
        return {
            schema: BUNDLE_SCHEMA,
            version: CORE_VERSION,
            missionId: initialState.missionId,
            recipe: initialState.recipe,
            initialState: initialState,
            events: events
        };
    }

    function normalizeBundle(raw) {
        var source = object(raw);
        if (source.schema !== BUNDLE_SCHEMA || Number(source.version) !== CORE_VERSION) return null;
        var state = normalizeState(source.initialState);
        if (!state.missionId || text(source.missionId, 180) !== state.missionId) return null;
        return {
            schema: BUNDLE_SCHEMA,
            version: CORE_VERSION,
            missionId: state.missionId,
            recipe: state.recipe,
            initialState: state,
            events: (Array.isArray(source.events) ? source.events : [])
                .slice(0, MAX_EVENTS)
                .map(function (event, index) { return normalizeEvent(event, index + 1); })
                .filter(Boolean)
        };
    }

    function validateBundle(raw) {
        var bundle = normalizeBundle(raw);
        return bundle
            ? { ok: true, bundle: bundle }
            : { ok: false, error: 'mission_execution_bundle_invalid' };
    }

    function replay(rawBundle, extraEvents) {
        var bundle = normalizeBundle(rawBundle);
        if (!bundle) return { ok: false, error: 'mission_execution_bundle_invalid' };
        var state = normalizeState(bundle.initialState);
        var events = bundle.events.concat(Array.isArray(extraEvents) ? extraEvents : []);
        var accepted = [];
        var rejected = [];
        events.slice(0, MAX_EVENTS).forEach(function (rawEvent, index) {
            var event = normalizeEvent(rawEvent, index + 1);
            if (!event) {
                rejected.push({ type: text(object(rawEvent).type, 100).toUpperCase() || 'INVALID', reason: 'invalid_event' });
                return;
            }
            var beforeHash = stateHash(state);
            var next = reduce(state, event);
            if (stateHash(next) === beforeHash) {
                rejected.push({ type: event.type, eventId: event.eventId, reason: state.processedEventIds.includes(event.eventId) ? 'duplicate_event' : 'transition_blocked' });
            } else {
                accepted.push({ type: event.type, eventId: event.eventId, sequence: event.sequence });
                state = next;
            }
        });
        return {
            ok: true,
            state: state,
            view: deriveView(state),
            effects: clone(state.effects, []),
            stateHash: stateHash(state),
            acceptedEvents: accepted,
            rejectedEvents: rejected
        };
    }

    function createShadowEnvelope(resumeBundle, options) {
        var config = object(options);
        var bundle = createExecutionBundle(resumeBundle, { events: config.events });
        if (!bundle) return null;
        var result = replay(bundle);
        if (!result.ok) return null;
        return createReplayShadowEnvelope(bundle, {
            sourceRevision: config.sourceRevision,
            legacyBundle: resumeBundle
        });
    }

    function createReplayShadowEnvelope(rawBundle, options) {
        var config = object(options);
        var bundle = normalizeBundle(rawBundle);
        if (!bundle) return null;
        var result = replay(bundle);
        if (!result.ok) return null;
        var legacyComparison = text(config.legacyComparison, 60).toLowerCase()
            || (config.legacyBundle ? 'compared' : 'unavailable');
        var legacyState = legacyComparison === 'compared' && config.legacyBundle
            ? projectLegacyBundle(config.legacyBundle)
            : null;
        var legacyDrift = legacyState ? semanticDriftFields(result.state, legacyState) : [];
        return {
            schema: SHADOW_SCHEMA,
            version: CORE_VERSION,
            coreVersion: CORE_VERSION,
            missionId: result.state.missionId,
            recipe: result.state.recipe,
            sourceRevision: Math.max(0, integer(config.sourceRevision, 0)),
            stateRevision: result.state.revision,
            phase: result.state.phase,
            subphase: result.state.subphase,
            allowedActions: result.view.allowedActions,
            blockingReasons: result.view.blockingReasons,
            cargo: result.state.cargo,
            workflows: result.state.workflows,
            effects: result.effects,
            stateHash: result.stateHash,
            replaySemanticHash: semanticHash(result.state),
            legacyStateHash: legacyState ? semanticHash(legacyState) : null,
            legacyDriftFields: legacyDrift,
            legacyComparison: legacyComparison,
            eventTrace: result.acceptedEvents.slice(-32).map(function (event) {
                return { type: event.type, traceId: hashValue(event.eventId), sequence: event.sequence };
            })
        };
    }

    function serializeState(rawState) {
        return canonicalStringify(normalizeState(rawState));
    }

    function deserializeState(raw) {
        try {
            var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!parsed || parsed.schema !== STATE_SCHEMA || Number(parsed.version) !== CORE_VERSION) return null;
            return normalizeState(parsed);
        } catch (_) {
            return null;
        }
    }

    return Object.freeze({
        CORE_VERSION: CORE_VERSION,
        BUNDLE_SCHEMA: BUNDLE_SCHEMA,
        STATE_SCHEMA: STATE_SCHEMA,
        SHADOW_SCHEMA: SHADOW_SCHEMA,
        KNOWN_EVENT_TYPES: KNOWN_EVENT_TYPES,
        canonicalStringify: canonicalStringify,
        hashValue: hashValue,
        normalizeEvent: normalizeEvent,
        normalizeState: normalizeState,
        projectLegacyBundle: projectLegacyBundle,
        createExecutionBundle: createExecutionBundle,
        normalizeBundle: normalizeBundle,
        validateBundle: validateBundle,
        reduce: reduce,
        replay: replay,
        deriveView: deriveView,
        allowedActions: allowedActions,
        stateHash: stateHash,
        semanticState: semanticState,
        semanticHash: semanticHash,
        semanticDriftFields: semanticDriftFields,
        createShadowEnvelope: createShadowEnvelope,
        createReplayShadowEnvelope: createReplayShadowEnvelope,
        serializeState: serializeState,
        deserializeState: deserializeState
    });
}));
