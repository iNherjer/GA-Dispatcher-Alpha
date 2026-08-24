(function (root, factory) {
    'use strict';
    var manifestCore = typeof module === 'object' && module.exports
        ? require('./mission-manifest-core.js')
        : (root && root.GAMissionManifestCore);
    var startCore = typeof module === 'object' && module.exports
        ? require('./mission-start-core.js')
        : (root && root.GAMissionStartCore);
    var payloadCore = typeof module === 'object' && module.exports
        ? require('./mission-payload-core.js')
        : (root && root.GAMissionPayloadCore);
    var complianceCore = typeof module === 'object' && module.exports
        ? require('./mission-compliance-domain-core.js')
        : (root && root.GAMissionComplianceDomainCore);
    var api = factory(manifestCore, startCore, payloadCore, complianceCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionExecutionCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (manifestCore, startCore, payloadCore, complianceCore) {
    'use strict';

    var CORE_VERSION = 1;
    var BUNDLE_SCHEMA = 'ga.mission-execution-bundle.v1';
    var STATE_SCHEMA = 'ga.mission-execution-state.v1';
    var SHADOW_SCHEMA = 'ga.mission-execution-shadow.v1';
    var MAX_EVENTS = 160;
    var MAX_EFFECTS = 48;
    // The shared APT policies and local effect chain have reached the parity
    // level required for an explicit Alpha field test. This gate only becomes
    // effective together with the Alpha runtime channel and the desktop
    // VFR_MULTITOOL_APT_EXECUTION opt-in. It is not a Stable promotion signal;
    // the remaining real In-Sim and multi-instance checks are tracked
    // separately below.
    var TRACKER_AUTHORITY_READY = true;
    var TRACKER_AUTHORITY_PENDING = Object.freeze([]);
    var TRACKER_AUTHORITY_FIELD_VALIDATION_PENDING = Object.freeze([
        'standard_apt_end_to_end',
        'app_efb_multi_instance',
        'reload_and_duplicate_intents',
        'voice_playback_lease',
        'abort_clear_new_mission',
        'forced_compliance'
    ]);
    var KNOWN_PHASES = Object.freeze([
        'planned', 'prepare', 'boarding', 'boarded', 'active', 'enroute',
        'on_task', 'return_leg', 'end_unloading', 'end_ready', 'closing', 'closed'
    ]);
    var KNOWN_EVENT_TYPES = Object.freeze([
        'MISSION_ACCEPTED', 'PREPARE_REQUESTED', 'BOARDING_STARTED',
        'BOARDING_SCENE_CONFIRMED', 'BOARDING_CONFIRMED',
        'LOAD_CONFIRMATION_REQUESTED', 'LOAD_CONFIRMED', 'MISSION_STARTED', 'AIRBORNE',
        'TARGET_ENTERED', 'TASK_PROGRESS', 'TOUCHDOWN', 'GROUND_STILL',
        'PICKUP_CONFIRMED', 'UNLOAD_CONFIRMED', 'FAREWELL_STARTED', 'FAREWELL_COMPLETED',
        'PAX_DEBOARDING_REQUESTED', 'PAX_DEBOARDING_CONFIRMED',
        'CARGO_STATE_CHANGED', 'COMPLIANCE_EVENT', 'COMPLIANCE_INSPECTORS_WAITING',
        'COMPLIANCE_REQUEST_COMPLETED', 'COMPLIANCE_RESULT_COMPLETED', 'COMPLIANCE_RELEASED',
        'EFFECT_ACKNOWLEDGED', 'CLOSE_REQUESTED', 'MISSION_CLOSED',
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

    function normalizeManifest(raw) {
        var source = object(raw);
        var manifest = canonicalValue(source);
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) manifest = {};
        manifest.items = (Array.isArray(source.items) ? source.items : [])
            .slice(0, 160)
            .filter(function (item) { return item && typeof item === 'object' && !Array.isArray(item); })
            .map(function (item) { return canonicalValue(item); });
        manifest.dispatchSignature = source.dispatchSignature && typeof source.dispatchSignature === 'object'
            && !Array.isArray(source.dispatchSignature)
            ? canonicalValue(source.dispatchSignature)
            : null;
        return manifest;
    }

    function normalizeFlightEvents(raw) {
        var source = object(raw);
        return {
            flightId: text(source.flightId, 220) || null,
            startAt: Math.max(0, integer(source.startAt, 0)) || null,
            landingAt: Math.max(0, integer(source.landingAt, 0)) || null
        };
    }

    function currentFlightEvents(state) {
        var events = normalizeFlightEvents(state && state.flightEvents);
        var manifestEvents = normalizeFlightEvents(object(state && state.manifest).flightEvents);
        if (!events.flightId) events.flightId = manifestEvents.flightId;
        if (!events.startAt) events.startAt = manifestEvents.startAt;
        if (!events.landingAt) events.landingAt = manifestEvents.landingAt;
        if (!events.flightId) {
            var manifestKey = text(object(state && state.manifest).key, 180) || text(state && state.missionId, 180);
            events.flightId = manifestKey ? manifestKey + '|' + (events.startAt || 'flight') : null;
        }
        return events;
    }

    function manifestFromCargo(raw) {
        var source = object(raw);
        return normalizeManifest({
            version: source.schemaVersion,
            key: source.manifestKey,
            dispatchSignature: source.signatureScope ? { scope: source.signatureScope } : null,
            items: (Array.isArray(source.items) ? source.items : []).map(function (item) {
                var entry = object(item);
                return {
                    id: entry.id,
                    itemType: entry.itemType,
                    status: entry.status,
                    required: entry.required === true,
                    pickupLocation: entry.pickup === 'target' ? 'target' : undefined,
                    deliverAtHome: entry.delivery === 'home',
                    deliverAtDestination: entry.delivery === 'destination',
                    persistentEquipment: entry.persistentEquipment === true,
                    passengerCount: entry.passengerCount,
                    weightLbs: entry.weightLbs,
                    healthPct: entry.healthPct,
                    handoffComplete: entry.status === 'handed_off'
                };
            })
        });
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
        var gateManifest = normalizeManifest({
            dispatchSignature: signatureScope ? { scope: signatureScope } : null,
            items: items.map(function (item) {
                return {
                    id: item.id,
                    itemType: item.itemType,
                    status: item.status,
                    required: item.required,
                    pickupLocation: item.pickup === 'target' ? 'target' : undefined,
                    deliverAtHome: item.delivery === 'home',
                    deliverAtDestination: item.delivery === 'destination',
                    handoffComplete: item.status === 'handed_off',
                    persistentEquipment: item.persistentEquipment,
                    passengerCount: item.passengerCount,
                    weightLbs: item.weightLbs,
                    healthPct: item.healthPct
                };
            })
        });
        var manifestGates = manifestCore && typeof manifestCore.deriveGateState === 'function'
            ? manifestCore.deriveGateState(gateManifest, { atHome: false })
            : null;
        var requiredDestinationRemaining = manifestGates
            ? manifestGates.requiredUnloadBlockingItems.length
            : destinationItems.filter(function (item) {
                return item.itemType !== 'passenger' && item.status === 'loaded';
            }).length;
        var destinationPassengerRemaining = destinationItems.filter(function (item) {
            return item.itemType === 'passenger' && item.status === 'loaded';
        }).length;
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
                destinationRemaining: requiredDestinationRemaining,
                destinationPassengerRemaining: destinationPassengerRemaining,
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
        var sourceRemediation = object(source.remediation);
        var domainSource = Object.keys(sourceRemediation).length
            ? source
            : {
                ...source,
                remediation: {
                    required: source.remediationRequired === true,
                    missingFields: Array.isArray(source.missingFields) ? source.missingFields : []
                }
            };
        var normalized = complianceCore && typeof complianceCore.normalizeState === 'function'
            ? complianceCore.normalizeState(domainSource, {
                missionKey: text(source.missionKey, 180),
                flightId: text(source.flightId, 220)
            })
            : null;
        if (!normalized) {
            var remediation = object(source.remediation);
            var phase = text(source.phase || 'none', 60).toLowerCase().replace(/[\s-]+/g, '_') || 'none';
            normalized = {
                selected: source.selected === true ? true : (source.selected === false ? false : null),
                phase: phase,
                revision: Math.max(0, integer(source.revision, 0)),
                inspectorsWaiting: source.inspectorsWaiting === true,
                farewellComplete: source.farewellComplete === true,
                remediation: {
                    required: source.remediationRequired === true || remediation.required === true,
                    missingFields: (Array.isArray(source.missingFields) ? source.missingFields : remediation.missingFields || [])
                        .filter(function (field) { return field === 'start' || field === 'landing'; })
                },
                result: source.result && typeof source.result === 'object' ? clone(source.result, null) : null,
                releasedAt: Math.max(0, integer(source.releasedAt, 0))
            };
        }
        var legacyResult = text(
            typeof source.result === 'string'
                ? source.result
                : (object(source.result).status || object(source.result).result),
            60
        ).toLowerCase() || null;
        normalized.remediationRequired = normalized.remediation && normalized.remediation.required === true;
        normalized.missingFields = clone(object(normalized.remediation).missingFields, []);
        normalized.resultStatus = legacyResult;
        normalized.released = source.released === true
            || normalized.phase === 'released'
            || Number(normalized.releasedAt || 0) > 0;
        return normalized;
    }

    function normalizeVoiceOutcome(raw) {
        var source = object(raw);
        var speaker = object(source.speaker);
        var rawStatus = text(source.status || 'idle', 40).toLowerCase();
        var statuses = ['idle', 'pending', 'ok', 'warning', 'failed', 'skipped'];
        return {
            schema: 'ga.mission-voice-outcome.v1',
            kind: text(source.kind || 'boarding', 40).toLowerCase() || 'boarding',
            status: statuses.includes(rawStatus) ? rawStatus : 'idle',
            text: text(source.text, 4000),
            speaker: {
                name: text(speaker.name, 120),
                role: text(speaker.role, 160),
                gender: text(speaker.gender, 20).toLowerCase() === 'male' ? 'male' : 'female',
                roleProfile: text(speaker.roleProfile, 120),
                taskDomain: text(speaker.taskDomain, 120).toLowerCase()
            },
            provider: text(source.provider, 40).toLowerCase(),
            textModel: text(source.textModel, 100),
            model: text(source.model, 100),
            voiceName: text(source.voiceName, 80),
            playback: text(source.playback, 80).toLowerCase() || null,
            error: text(source.error, 180) || null,
            updatedAt: Math.max(0, integer(source.updatedAt, 0)) || null
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
                boardingSceneConfirmed: false,
                boardingVoiceComplete: false,
                boardingConfirmed: false,
                payloadSyncRequested: false,
                loadConfirmed: false,
                unloadConfirmed: false,
                started: false,
                active: false,
                closingPending: false,
                closed: false,
                onGround: null,
                groundStill: false,
                farewellStarted: false,
                farewellCompleted: false,
                deboardingCompleted: false
            },
            progress: normalizeProgress(null),
            manifest: normalizeManifest(null),
            flightEvents: normalizeFlightEvents(null),
            cargo: normalizeCargo(null),
            payload: payloadCore && typeof payloadCore.normalizeOutcome === 'function'
                ? payloadCore.normalizeOutcome(null)
                : { schema: 'ga.mission-payload-outcome.v1', status: 'idle', override: false, adapter: null, error: null, plan: null, verification: null, updatedAt: null },
            voice: {
                boarding: normalizeVoiceOutcome(null),
                farewell: normalizeVoiceOutcome({ kind: 'farewell' })
            },
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
        var manifest = normalizeManifest(runtimeRoot.cargoManifest);
        var cargo = normalizeCargo(manifest);
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
            boardingSceneConfirmed: phaseAtLeastBoarded || runtimeRoot.missionSceneStatus?.boardingComplete === true,
            boardingVoiceComplete: phaseAtLeastBoarded || runtimeRoot.missionSceneStatus?.boardingVoiceComplete === true,
            boardingConfirmed: phaseAtLeastBoarded,
            payloadSyncRequested: false,
            loadConfirmed: phaseAtLeastBoarded,
            unloadConfirmed: closing || closed || (
                phase === 'end_ready'
                && cargo.summary.destinationTotal > 0
                && cargo.summary.destinationRemaining === 0
                && cargo.signatureScope === 'arrival'
            ),
            started: active || phaseAtLeastActive || Number(runtime.startedAt || runtimeRoot.startedAt || 0) > 0,
            active: active,
            closingPending: closing,
            closed: closed,
            onGround: onGround,
            groundStill: groundStill,
            farewellStarted: runtime.farewellSpeechStarted === true,
            farewellCompleted: runtime.deboardingAfterFarewellStarted === true
                || runtime.farewellSpeechComplete === true,
            deboardingCompleted: runtime.endDeboardingCompleted === true
        };
        state.progress = progress;
        state.manifest = manifest;
        state.cargo = cargo;
        state.payload = payloadCore && typeof payloadCore.normalizeOutcome === 'function'
            ? payloadCore.normalizeOutcome(runtimeRoot.missionCargoPayloadOutcome)
            : state.payload;
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
        var sourceCargo = object(source.cargo);
        var cargoLooksLikeManifest = Object.prototype.hasOwnProperty.call(sourceCargo, 'dispatchSignature')
            || Object.prototype.hasOwnProperty.call(sourceCargo, 'key')
            || (Array.isArray(sourceCargo.items) && sourceCargo.items.some(function (item) {
                return item && (Object.prototype.hasOwnProperty.call(item, 'pickupLocation')
                    || Object.prototype.hasOwnProperty.call(item, 'deliverAtDestination')
                    || Object.prototype.hasOwnProperty.call(item, 'deliverAtHome'));
            }));
        state.manifest = Object.prototype.hasOwnProperty.call(source, 'manifest')
            ? normalizeManifest(source.manifest)
            : (cargoLooksLikeManifest ? normalizeManifest(sourceCargo) : manifestFromCargo(sourceCargo));
        state.flightEvents = normalizeFlightEvents(
            Object.prototype.hasOwnProperty.call(source, 'flightEvents')
                ? source.flightEvents
                : state.manifest.flightEvents
        );
        state.cargo = normalizeCargo(state.manifest);
        state.payload = payloadCore && typeof payloadCore.normalizeOutcome === 'function'
            ? payloadCore.normalizeOutcome(source.payload)
            : clone(source.payload, state.payload);
        state.voice = {
            boarding: normalizeVoiceOutcome(object(source.voice).boarding),
            farewell: normalizeVoiceOutcome({
                ...object(object(source.voice).farewell),
                kind: 'farewell'
            })
        };
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

    function appendPayloadManifestSyncEffect(state, event, transition) {
        var transitionSource = object(transition);
        var detachedSource = object(transitionSource.detachedInheritedEquipment);
        var transitionAction = text(transitionSource.action, 40).toLowerCase() || null;
        var transitionItemId = text(transitionSource.itemId, 120) || null;
        var detachedId = text(detachedSource.id, 120) || null;
        state.payload = payloadCore && typeof payloadCore.normalizeOutcome === 'function'
            ? payloadCore.normalizeOutcome({ status: 'pending' }, { updatedAt: event.occurredAt })
            : state.payload;
        appendEffect(state, createEffect(state, event, 'payload.sync_manifest_state', {
            operation: 'payload_sync_manifest_state',
            manifestStateHash: hashValue(state.manifest),
            transition: transitionAction || transitionItemId || detachedId ? {
                action: transitionAction,
                itemId: transitionItemId,
                detachedInheritedEquipment: detachedId ? {
                    id: detachedId,
                    weightLbs: Math.max(0, round(detachedSource.weightLbs, 1, 0)),
                    label: text(detachedSource.label, 180) || null,
                    storyName: text(detachedSource.storyName, 180) || null,
                    objectTitle: text(detachedSource.objectTitle, 180) || null,
                    itemType: text(detachedSource.itemType, 40).toLowerCase() || 'cargo',
                    persistentEquipment: true,
                    persistentEquipmentInherited: true
                } : null
            } : null
        }));
    }

    function applyCargoFromEvent(state, event) {
        var payload = object(event.payload);
        var manifest = payload.manifest;
        var cargo = payload.cargo;
        if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
            state.manifest = normalizeManifest(manifest);
            var manifestFlightEvents = normalizeFlightEvents(state.manifest.flightEvents);
            if (manifestFlightEvents.flightId || manifestFlightEvents.startAt || manifestFlightEvents.landingAt) {
                state.flightEvents = manifestFlightEvents;
            }
            state.cargo = normalizeCargo(state.manifest);
        } else if (cargo && typeof cargo === 'object' && !Array.isArray(cargo)) {
            state.manifest = manifestFromCargo(cargo);
            state.cargo = normalizeCargo(state.manifest);
        }
    }

    function commitManifestItemTransition(state, event, itemId, action, context) {
        var manifest = normalizeManifest(state.manifest);
        if (manifestCore && typeof manifestCore.planItemTransition === 'function'
            && typeof manifestCore.commitItemTransition === 'function') {
            var plan = manifestCore.planItemTransition(manifest, { action: action, itemId: itemId }, context);
            if (!plan || plan.ok !== true) return false;
            var committed = manifestCore.commitItemTransition(manifest, plan);
            if (!committed || committed.ok !== true) return false;
        } else {
            var item = manifest.items.find(function (candidate) { return candidate.id === itemId; });
            if (!item) return false;
            item.status = action === 'load' ? 'loaded' : 'unloaded';
        }
        state.manifest = manifest;
        state.cargo = normalizeCargo(manifest);
        return true;
    }

    function hasDeparturePassenger(state) {
        return state.cargo.items.some(function (item) {
            return item.itemType === 'passenger' && item.pickup !== 'target';
        });
    }

    function hasBoardingVoiceContext(state) {
        return state.cargo.items.some(function (item) {
            return item.pickup !== 'target';
        });
    }

    function applyStartReadiness(state) {
        var readiness = startCore && typeof startCore.deriveStartReadiness === 'function'
            ? startCore.deriveStartReadiness({
                loadConfirmed: state.flags.loadConfirmed,
                dispatchSigned: state.cargo.signatureScope === 'departure',
                loadInteractionReady: state.flags.boardingSceneConfirmed,
                boardingVoiceComplete: state.flags.boardingVoiceComplete,
                alreadyBoarded: state.phase === 'boarded'
            })
            : { ready: state.flags.loadConfirmed && state.flags.boardingConfirmed };
        if (readiness.ready) {
            state.flags.boardingConfirmed = true;
            state.phase = 'boarded';
            state.subphase = 'start_ready';
            return true;
        }
        state.phase = 'boarding';
        if (!state.flags.boardingSceneConfirmed) state.subphase = 'awaiting_boarding_confirmation';
        else if (!state.flags.boardingVoiceComplete) state.subphase = 'awaiting_boarding_voice';
        else if (!state.flags.loadConfirmed) state.subphase = 'awaiting_load_confirmation';
        return false;
    }

    function requestMissionCloseAfterFarewell(state, event, reason) {
        var compliance = state.workflows.complianceInspection;
        if (compliance.selected === true && !compliance.released) {
            compliance.farewellComplete = true;
            compliance.revision += 1;
            if (compliance.inspectorsWaiting && (compliance.phase === 'approach_started'
                || compliance.phase === 'inspectors_waiting')) {
                compliance.phase = 'request_playing';
                compliance.phaseAt = event.occurredAt;
                compliance.requestText = compliance.requestText
                    || (complianceCore && complianceCore.REQUEST_TEXT)
                    || '';
                appendEffect(state, createEffect(state, event, 'voice.compliance_request', {
                    operation: 'compliance_request',
                    text: compliance.requestText,
                    speaker: complianceCore && complianceCore.INSPECTOR_SPEAKER
                }));
            }
            state.phase = 'end_ready';
            state.subphase = 'inspection_wait';
            state.flags.active = true;
            state.flags.closingPending = false;
            return false;
        }
        if (compliance.remediationRequired) {
            state.phase = 'end_ready';
            state.subphase = 'inspection_remediation';
            state.flags.active = true;
            state.flags.closingPending = false;
            return false;
        }
        state.phase = 'closing';
        state.subphase = 'close_requested';
        state.flags.active = false;
        state.flags.closingPending = true;
        // App parity: _setMissionClosePending() clears the transient Farewell /
        // deboarding runtime markers once the close hand-off has completed.
        // The completed effect history remains available for diagnostics, but
        // these flags must describe the new closing phase rather than the
        // preceding ground sequence.
        state.flags.farewellStarted = false;
        state.flags.farewellCompleted = false;
        state.flags.deboardingCompleted = false;
        appendEffect(state, createEffect(state, event, 'mission.close_requested', {
            operation: 'close',
            reason: text(reason || 'farewell_deboarding_complete', 120)
        }));
        return true;
    }

    function startComplianceArrival(state, event) {
        var compliance = normalizeCompliance(state.workflows.complianceInspection);
        if (compliance.selected == null && complianceCore && typeof complianceCore.decide === 'function') {
            compliance = normalizeCompliance(complianceCore.decide(compliance, {
                roll: finite(object(event.payload).complianceRoll, 0),
                force: object(event.payload).complianceForced === true,
                now: event.occurredAt,
                missionKey: state.missionId,
                flightId: currentFlightEvents(state).flightId
            }));
        }
        if (compliance.selected !== true || compliance.phase === 'released') {
            state.workflows.complianceInspection = compliance;
            return false;
        }
        if (!compliance.snapshot && complianceCore && typeof complianceCore.createSnapshot === 'function') {
            compliance.snapshot = complianceCore.createSnapshot(compliance, state.manifest, {
                now: event.occurredAt,
                flightId: currentFlightEvents(state).flightId
            });
        }
        if (compliance.phase === 'selected') {
            compliance.phase = 'approach_started';
            compliance.phaseAt = event.occurredAt;
            compliance.requestText = compliance.requestText
                || (complianceCore && complianceCore.REQUEST_TEXT)
                || '';
            compliance.revision += 1;
            appendEffect(state, createEffect(state, event, 'scene.compliance_visit', {
                operation: 'authority_inspection',
                approachFallbackMs: 75000
            }));
        }
        state.workflows.complianceInspection = normalizeCompliance(compliance);
        return true;
    }

    function beginComplianceRequest(state, event) {
        var compliance = normalizeCompliance(state.workflows.complianceInspection);
        if (compliance.selected !== true || compliance.phase === 'released'
            || !compliance.inspectorsWaiting || !compliance.farewellComplete) return false;
        if (compliance.phase === 'request_playing' || compliance.phase === 'evidence_open'
            || compliance.phase === 'result_playing' || compliance.phase === 'departing') return true;
        compliance.phase = 'request_playing';
        compliance.phaseAt = event.occurredAt;
        compliance.requestText = compliance.requestText
            || (complianceCore && complianceCore.REQUEST_TEXT)
            || '';
        compliance.revision += 1;
        state.workflows.complianceInspection = normalizeCompliance(compliance);
        appendEffect(state, createEffect(state, event, 'voice.compliance_request', {
            operation: 'compliance_request',
            text: compliance.requestText,
            speaker: complianceCore && complianceCore.INSPECTOR_SPEAKER
        }));
        return true;
    }

    function eventAllowed(state, event) {
        var phase = state.phase;
        var eventPayload = object(event.payload);
        var eventCargo = eventPayload.manifest && typeof eventPayload.manifest === 'object'
            ? normalizeCargo(eventPayload.manifest)
            : (eventPayload.cargo && typeof eventPayload.cargo === 'object'
                ? normalizeCargo(eventPayload.cargo)
                : state.cargo);
        var compliance = state.workflows.complianceInspection;
        if (event.type === 'MISSION_ACCEPTED' || event.type === 'AUTHORITATIVE_SNAPSHOT_IMPORTED') return true;
        if (state.flags.closed && event.type !== 'MISSION_CLOSED' && event.type !== 'EFFECT_ACKNOWLEDGED') return false;
        if (event.type === 'CARGO_STATE_CHANGED') return true;
        if (event.type === 'PREPARE_REQUESTED') return phase === 'planned';
        if (event.type === 'BOARDING_STARTED') {
            return phase === 'prepare' && state.effects.some(function (effect) {
                return effect.type === 'scene.prepare' && effect.status === 'completed';
            });
        }
        if (event.type === 'BOARDING_SCENE_CONFIRMED') {
            return phase === 'boarding' && !state.flags.boardingSceneConfirmed;
        }
        if (event.type === 'BOARDING_CONFIRMED') {
            // Retained for deterministic replay of pre-migration App bundles.
            // Tracker authority itself can only reach this event through the
            // scene/voice effect chain enforced by its adapter.
            return phase === 'boarding' || phase === 'prepare';
        }
        if (event.type === 'LOAD_CONFIRMATION_REQUESTED') {
            var departureGate = startCore && typeof startCore.deriveDepartureConfirmationGate === 'function'
                ? startCore.deriveDepartureConfirmationGate({
                    requiredMissingCount: eventCargo.summary.departureMissing,
                    signatureMatches: eventCargo.signatureScope === 'departure',
                    signatureAnimating: false,
                    payloadFinalizeRunning: state.flags.payloadSyncRequested
                })
                : { ok: eventCargo.summary.departureReady && (eventCargo.summary.departureTotal === 0 || eventCargo.signatureScope === 'departure') };
            return (phase === 'prepare' || phase === 'boarding') && !state.flags.loadConfirmed && departureGate.ok === true;
        }
        if (event.type === 'LOAD_CONFIRMED') {
            return (phase === 'prepare' || phase === 'boarding' || phase === 'boarded')
                && eventCargo.summary.departureReady
                && eventCargo.signatureScope === 'departure';
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
                && !state.flags.unloadConfirmed
                && eventCargo.summary.destinationTotal > 0
                && eventCargo.summary.destinationRemaining === 0
                && eventCargo.signatureScope === 'arrival';
        }
        if (event.type === 'PAX_DEBOARDING_REQUESTED') {
            return state.flags.active
                && state.flags.groundStill
                && (phase === 'end_unloading' || phase === 'end_ready')
                && state.cargo.items.some(function (item) {
                    return item.itemType === 'passenger' && item.status === 'loaded' && item.delivery === 'destination';
                });
        }
        if (event.type === 'PAX_DEBOARDING_CONFIRMED') {
            return state.flags.active
                && state.flags.groundStill
                && (phase === 'end_unloading' || phase === 'end_ready')
                && (
                    state.cargo.items.some(function (item) {
                        return item.itemType === 'passenger' && item.status === 'loaded' && item.delivery === 'destination';
                    })
                    || state.effects.some(function (effect) {
                        return effect.type === 'scene.deboarding' && effect.status === 'requested';
                    })
                );
        }
        if (event.type === 'FAREWELL_STARTED') {
            return !state.flags.farewellStarted
                && (phase === 'end_ready' || phase === 'end_unloading' || phase === 'closing')
                && state.effects.some(function (effect) {
                    return effect.type === 'scene.deboarding' && effect.status === 'requested';
                });
        }
        if (event.type === 'FAREWELL_COMPLETED') {
            return state.flags.farewellStarted
                && !state.flags.farewellCompleted
                && (phase === 'end_ready' || phase === 'end_unloading' || phase === 'closing')
                && state.effects.some(function (effect) {
                    return effect.type === 'voice.farewell' && effect.status === 'requested';
                });
        }
        if (event.type === 'COMPLIANCE_EVENT') return !state.flags.closed;
        if (event.type === 'COMPLIANCE_INSPECTORS_WAITING') {
            return compliance.selected === true
                && (compliance.phase === 'approach_started' || compliance.phase === 'inspectors_waiting');
        }
        if (event.type === 'COMPLIANCE_REQUEST_COMPLETED') {
            return compliance.selected === true
                && compliance.phase === 'request_playing'
                && state.effects.some(function (effect) {
                    return effect.type === 'voice.compliance_request' && effect.status === 'requested';
                });
        }
        if (event.type === 'COMPLIANCE_RESULT_COMPLETED') {
            return compliance.selected === true
                && compliance.phase === 'result_playing'
                && state.effects.some(function (effect) {
                    return effect.type === 'voice.compliance_result' && effect.status === 'requested';
                });
        }
        if (event.type === 'COMPLIANCE_RELEASED') {
            return compliance.selected === true && compliance.phase === 'departing';
        }
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
            var closeDeboardingPending = state.effects.some(function (effect) {
                return (effect.type === 'scene.deboarding'
                    || effect.type === 'voice.farewell'
                    || effect.type === 'scene.deboarding_continue')
                    && effect.status === 'requested';
            });
            return (phase === 'end_ready' || phase === 'closing')
                && !closeDeboardingPending
                && eventCargo.summary.destinationRemaining === 0
                && (eventCargo.summary.destinationTotal === 0
                    || (eventCargo.signatureScope === 'arrival' && state.flags.unloadConfirmed))
                && (!(compliance.selected === true && !compliance.released)
                    || ['selected', 'approach_started', 'inspectors_waiting'].includes(compliance.phase))
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
            state.flags.boardingSceneConfirmed = false;
            state.flags.boardingVoiceComplete = false;
            state.flags.boardingConfirmed = false;
            appendEffect(state, createEffect(state, event, 'scene.boarding', { operation: 'boarding' }));
        } else if (event.type === 'BOARDING_SCENE_CONFIRMED') {
            applyCargoFromEvent(state, event);
            var boardingScenePayloadChanged = false;
            state.manifest.items.forEach(function (item) {
                if (!item || String(item.itemType || '').toLowerCase() !== 'passenger'
                    || String(item.status || 'pending') !== 'pending'
                    || item.pickupLocation === 'target') return;
                boardingScenePayloadChanged = commitManifestItemTransition(state, event, item.id, 'load', {
                    now: event.occurredAt,
                    groundHandlingAllowed: true,
                    complianceAllowed: true,
                    missionActive: false,
                    atTarget: false,
                    reloadAllowed: true,
                    effectAcknowledged: 'passenger.board'
                }) || boardingScenePayloadChanged;
            });
            if (boardingScenePayloadChanged) appendPayloadManifestSyncEffect(state, event, { action: 'passenger_load' });
            state.flags.boardingSceneConfirmed = true;
            var boardingPlan = startCore && typeof startCore.deriveBoardingAckPlan === 'function'
                ? startCore.deriveBoardingAckPlan({
                    sceneConfirmed: true,
                    hasBoardingPassenger: hasDeparturePassenger(state),
                    hasBoardingVoiceContext: hasBoardingVoiceContext(state),
                    boardingVoiceComplete: false
                })
                : { action: hasBoardingVoiceContext(state) ? 'play_boarding_voice' : 'complete_boarding' };
            if (boardingPlan.action === 'play_boarding_voice') {
                state.subphase = 'awaiting_boarding_voice';
                state.voice.boarding = normalizeVoiceOutcome({ status: 'pending', kind: 'boarding' });
                appendEffect(state, createEffect(state, event, 'voice.boarding', { operation: 'boarding_voice' }));
            } else {
                state.flags.boardingVoiceComplete = true;
                state.flags.boardingConfirmed = true;
                applyStartReadiness(state);
            }
        } else if (event.type === 'BOARDING_CONFIRMED') {
            applyCargoFromEvent(state, event);
            var boardingPayloadChanged = false;
            state.manifest.items.forEach(function (item) {
                if (!item || String(item.itemType || '').toLowerCase() !== 'passenger'
                    || String(item.status || 'pending') !== 'pending'
                    || item.pickupLocation === 'target') return;
                boardingPayloadChanged = commitManifestItemTransition(state, event, item.id, 'load', {
                    now: event.occurredAt,
                    groundHandlingAllowed: true,
                    complianceAllowed: true,
                    missionActive: false,
                    atTarget: false,
                    reloadAllowed: true,
                    effectAcknowledged: 'passenger.board'
                }) || boardingPayloadChanged;
            });
            if (boardingPayloadChanged) appendPayloadManifestSyncEffect(state, event, { action: 'passenger_load' });
            state.flags.boardingSceneConfirmed = true;
            state.flags.boardingVoiceComplete = true;
            state.flags.boardingConfirmed = true;
            applyStartReadiness(state);
        } else if (event.type === 'LOAD_CONFIRMATION_REQUESTED') {
            applyCargoFromEvent(state, event);
            state.flags.payloadSyncRequested = true;
            state.subphase = 'payload_sync';
            state.payload = payloadCore && typeof payloadCore.normalizeOutcome === 'function'
                ? payloadCore.normalizeOutcome({ status: 'pending' }, { updatedAt: event.occurredAt })
                : state.payload;
            var payloadSyncContext = object(event.payload).payloadContext;
            appendEffect(state, createEffect(state, event, 'payload.sync_before_start', {
                operation: 'payload_sync_before_start',
                manifestStateHash: hashValue(state.manifest),
                payloadContext: payloadSyncContext ? {
                    fallbackPaxCount: Math.max(0, Math.min(6, integer(payloadSyncContext.fallbackPaxCount, 0))),
                    fallbackPaxWeightLbs: Math.max(1, round(payloadSyncContext.fallbackPaxWeightLbs, 1, 180))
                } : null
            }));
        } else if (event.type === 'LOAD_CONFIRMED') {
            applyCargoFromEvent(state, event);
            if (object(event.payload).payloadOutcome && payloadCore && typeof payloadCore.normalizeOutcome === 'function') {
                state.payload = payloadCore.normalizeOutcome(object(event.payload).payloadOutcome);
            }
            state.flags.payloadSyncRequested = false;
            state.flags.loadConfirmed = true;
            applyStartReadiness(state);
        } else if (event.type === 'MISSION_STARTED') {
            state.flightEvents = normalizeFlightEvents(state.flightEvents);
            if (!state.flightEvents.startAt) state.flightEvents.startAt = event.occurredAt || null;
            if (!state.flightEvents.flightId) {
                var flightManifestKey = text(state.manifest.key, 180) || state.missionId;
                state.flightEvents.flightId = flightManifestKey + '|' + (state.flightEvents.startAt || 'flight');
            }
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
            if (object(event.payload).recordLandingEvent === true) {
                state.flightEvents = currentFlightEvents(state);
                if (!state.flightEvents.landingAt) state.flightEvents.landingAt = event.occurredAt || null;
            }
        } else if (event.type === 'GROUND_STILL') {
            state.flags.onGround = true;
            state.flags.groundStill = true;
            if (object(event.payload).atDestination === true && state.progress.airborneSeen) {
                state.flightEvents = currentFlightEvents(state);
                if (!state.flightEvents.landingAt) state.flightEvents.landingAt = event.occurredAt || null;
                state.phase = state.cargo.summary.destinationRemaining > 0 ? 'end_unloading' : 'end_ready';
                startComplianceArrival(state, event);
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
            state.flags.unloadConfirmed = true;
            appendEffect(state, createEffect(state, event, 'cargo.unload_confirmed', { operation: 'unload' }));
        } else if (event.type === 'PAX_DEBOARDING_REQUESTED') {
            state.subphase = 'pax_deboarding';
            appendEffect(state, createEffect(state, event, 'scene.deboarding', {
                operation: 'pax_deboarding',
                coordinateFarewell: false,
                position: object(event.payload).position
            }));
        } else if (event.type === 'PAX_DEBOARDING_CONFIRMED') {
            var deboardingEffect = state.effects.find(function (effect) {
                return effect.type === 'scene.deboarding' && effect.status === 'requested';
            });
            var deboardingPosition = object(deboardingEffect && deboardingEffect.payload).position;
            var deboardingPayloadChanged = false;
            state.manifest.items.forEach(function (item) {
                if (!item || String(item.itemType || '').toLowerCase() !== 'passenger'
                    || String(item.status || '') !== 'loaded'
                    || item.deliverAtDestination === false) return;
                deboardingPayloadChanged = commitManifestItemTransition(state, event, item.id, 'unload', {
                    now: event.occurredAt,
                    groundHandlingAllowed: true,
                    complianceAllowed: true,
                    effectAcknowledged: 'passenger.deboard',
                    position: deboardingPosition
                }) || deboardingPayloadChanged;
            });
            if (deboardingPayloadChanged) appendPayloadManifestSyncEffect(state, event, { action: 'passenger_unload' });
            state.flags.deboardingCompleted = true;
            state.phase = state.cargo.summary.destinationRemaining > 0 ? 'end_unloading' : 'end_ready';
            state.subphase = 'pax_deboarded';
            if (state.phase === 'end_ready'
                && state.flags.unloadConfirmed
                && state.flags.farewellCompleted) {
                requestMissionCloseAfterFarewell(state, event, 'passenger_handoff_complete');
            }
        } else if (event.type === 'FAREWELL_STARTED') {
            state.flags.farewellStarted = true;
            state.subphase = 'farewell_wait';
            appendEffect(state, createEffect(state, event, 'voice.farewell', { operation: 'farewell' }));
        } else if (event.type === 'FAREWELL_COMPLETED') {
            state.flags.farewellCompleted = true;
            state.subphase = 'farewell_complete';
            var pendingFarewellDeboarding = state.effects.find(function (effect) {
                return effect.type === 'scene.deboarding' && effect.status === 'requested';
            }) || null;
            if (pendingFarewellDeboarding) {
                appendEffect(state, createEffect(state, event, 'scene.deboarding_continue', {
                    operation: 'farewell',
                    deboardingEffectId: pendingFarewellDeboarding.effectId
                }));
            } else if (state.flags.deboardingCompleted || state.cargo.summary.destinationPassengerRemaining === 0) {
                requestMissionCloseAfterFarewell(state, event, 'farewell_complete');
            }
        } else if (event.type === 'CARGO_STATE_CHANGED') {
            applyCargoFromEvent(state, event);
            var cargoCompliance = normalizeCompliance(state.workflows.complianceInspection);
            if (cargoCompliance.selected === true && cargoCompliance.phase !== 'released'
                && cargoCompliance.phase !== 'result_playing' && cargoCompliance.phase !== 'departing') {
                cargoCompliance.revision += 1;
                if (cargoCompliance.phase === 'evidence_open'
                    && complianceCore && typeof complianceCore.remediationState === 'function') {
                    cargoCompliance.remediation = complianceCore.remediationState(cargoCompliance, state.manifest, {
                        flightId: currentFlightEvents(state).flightId
                    });
                }
                state.workflows.complianceInspection = normalizeCompliance(cargoCompliance);
            }
            var cargoPayloadTransition = object(event.payload).payloadTransition;
            if (text(object(cargoPayloadTransition).action, 40)) {
                appendPayloadManifestSyncEffect(state, event, cargoPayloadTransition);
            }
            if ((state.phase === 'prepare' || state.phase === 'boarding') && state.cargo.signatureScope !== 'departure') {
                state.flags.loadConfirmed = false;
                state.flags.payloadSyncRequested = false;
            }
            if ((state.phase === 'end_unloading' || state.phase === 'end_ready') && state.cargo.signatureScope !== 'arrival') {
                state.flags.unloadConfirmed = false;
            }
        } else if (event.type === 'COMPLIANCE_EVENT') {
            var compliancePayload = object(event.payload);
            var complianceStatePayload = object(compliancePayload.state);
            var compliance = Object.keys(complianceStatePayload).length ? complianceStatePayload : compliancePayload;
            var previousCompliance = state.workflows.complianceInspection;
            var remediationPayload = object(compliance.remediation);
            var nextCompliance = {
                ...previousCompliance,
                ...compliance,
                revision: Object.prototype.hasOwnProperty.call(compliance, 'revision')
                    ? Math.max(0, integer(compliance.revision, 0))
                    : previousCompliance.revision + 1,
                remediation: Object.keys(remediationPayload).length
                    ? remediationPayload
                    : {
                        required: compliance.remediationRequired === true
                            || previousCompliance.remediationRequired === true,
                        missingFields: Array.isArray(compliance.missingFields)
                            ? compliance.missingFields
                            : previousCompliance.missingFields
                    },
                releasedAt: compliance.released === true
                    ? (Number(compliance.releasedAt || 0) || event.occurredAt || 1)
                    : Number(compliance.releasedAt || previousCompliance.releasedAt || 0)
            };
            if (compliance.released === true && !compliance.phase) nextCompliance.phase = 'released';
            state.workflows.complianceInspection = normalizeCompliance(nextCompliance);
            if (text(compliancePayload.action, 80).toLowerCase() === 'evidence_complete'
                && state.workflows.complianceInspection.phase === 'result_playing') {
                var sanction = object(compliancePayload.sanction);
                if (sanction.type === 'authority_sanction' && text(sanction.flightId, 220)) {
                    appendEffect(state, createEffect(state, event, 'crewboard.authority_sanction', {
                        operation: 'authority_sanction',
                        record: sanction
                    }));
                }
                appendEffect(state, createEffect(state, event, 'voice.compliance_result', {
                    operation: 'compliance_result',
                    text: state.workflows.complianceInspection.resultText,
                    speaker: complianceCore && complianceCore.INSPECTOR_SPEAKER,
                    label: Number(object(state.workflows.complianceInspection.result).entryCount || 0) > 0
                        ? 'Kontrolle: Beanstandung'
                        : (Number(object(state.workflows.complianceInspection.result).warningCount || 0) > 0
                            ? 'Kontrolle: Verwarnung'
                            : 'Kontrolle abgeschlossen')
                }));
            }
            if (state.phase === 'end_ready'
                && state.flags.farewellCompleted
                && state.flags.deboardingCompleted
                && state.workflows.complianceInspection.released
                && !state.workflows.complianceInspection.remediationRequired) {
                requestMissionCloseAfterFarewell(state, event, 'compliance_released');
            }
        } else if (event.type === 'COMPLIANCE_INSPECTORS_WAITING') {
            var waitingCompliance = normalizeCompliance(state.workflows.complianceInspection);
            waitingCompliance.inspectorsWaiting = true;
            waitingCompliance.sceneFallback = object(event.payload).sceneFallback === true || waitingCompliance.sceneFallback;
            waitingCompliance.phase = 'inspectors_waiting';
            waitingCompliance.phaseAt = event.occurredAt;
            waitingCompliance.revision += 1;
            state.workflows.complianceInspection = normalizeCompliance(waitingCompliance);
            beginComplianceRequest(state, event);
        } else if (event.type === 'COMPLIANCE_REQUEST_COMPLETED') {
            var evidenceCompliance = normalizeCompliance(state.workflows.complianceInspection);
            evidenceCompliance.requestSpokenAt = event.occurredAt;
            evidenceCompliance.phase = 'evidence_open';
            evidenceCompliance.phaseAt = event.occurredAt;
            evidenceCompliance.revision += 1;
            evidenceCompliance.remediation = complianceCore && typeof complianceCore.remediationState === 'function'
                ? complianceCore.remediationState(evidenceCompliance, state.manifest, {
                    flightId: currentFlightEvents(state).flightId
                })
                : { required: false, missingFields: [] };
            state.workflows.complianceInspection = normalizeCompliance(evidenceCompliance);
            state.phase = 'end_ready';
            state.subphase = 'inspection_evidence';
        } else if (event.type === 'COMPLIANCE_RESULT_COMPLETED') {
            var departingCompliance = normalizeCompliance(state.workflows.complianceInspection);
            departingCompliance.resultSpokenAt = event.occurredAt;
            departingCompliance.phase = 'departing';
            departingCompliance.phaseAt = event.occurredAt;
            departingCompliance.revision += 1;
            state.workflows.complianceInspection = normalizeCompliance(departingCompliance);
            state.phase = 'end_ready';
            state.subphase = 'inspection_departing';
            if (departingCompliance.sceneFallback) {
                appendEffect(state, createEffect(state, event, 'compliance.logical_release', {
                    operation: 'compliance_release',
                    delayMs: 900
                }));
            } else {
                appendEffect(state, createEffect(state, event, 'scene.compliance_departure', {
                    operation: 'authority_inspection_departure'
                }));
            }
        } else if (event.type === 'COMPLIANCE_RELEASED') {
            var releasedCompliance = normalizeCompliance(state.workflows.complianceInspection);
            releasedCompliance.phase = 'released';
            releasedCompliance.phaseAt = event.occurredAt;
            releasedCompliance.releasedAt = event.occurredAt || 1;
            releasedCompliance.inspectorsWaiting = false;
            releasedCompliance.revision += 1;
            state.workflows.complianceInspection = normalizeCompliance(releasedCompliance);
            if (state.phase === 'end_ready'
                && state.flags.farewellCompleted
                && (state.flags.deboardingCompleted || state.cargo.summary.destinationPassengerRemaining === 0)
                && !state.workflows.complianceInspection.remediationRequired) {
                requestMissionCloseAfterFarewell(state, event, 'compliance_released');
            }
        } else if (event.type === 'EFFECT_ACKNOWLEDGED') {
            var acknowledgedEffectId = text(object(event.payload).effectId, 220);
            var acknowledgedStatus = text(object(event.payload).status, 40).toLowerCase();
            var acknowledgedEffect = state.effects.find(function (effect) {
                return effect.effectId === acknowledgedEffectId && effect.status === 'requested';
            }) || null;
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
            if (acknowledgedEffect && (acknowledgedEffect.type === 'payload.sync_before_start'
                || acknowledgedEffect.type === 'payload.sync_manifest_state')
                && payloadCore && typeof payloadCore.normalizeOutcome === 'function') {
                var payloadResult = object(event.payload).result;
                if (payloadResult || acknowledgedEffect.type === 'payload.sync_before_start') {
                    state.payload = payloadCore.normalizeOutcome(payloadResult || {
                        status: acknowledgedStatus === 'completed' ? 'ok' : 'error',
                        error: acknowledgedStatus === 'failed' ? 'payload_sync_failed' : null
                    }, { updatedAt: event.occurredAt });
                }
            }
            if (acknowledgedEffect && acknowledgedEffect.type === 'voice.boarding') {
                state.voice.boarding = normalizeVoiceOutcome({
                    ...object(object(event.payload).result),
                    kind: 'boarding',
                    status: object(object(event.payload).result).status
                        || (acknowledgedStatus === 'completed' ? 'ok' : 'failed'),
                    error: object(object(event.payload).result).error
                        || (acknowledgedStatus === 'failed' ? 'boarding_voice_failed' : null),
                    updatedAt: event.occurredAt
                });
            }
            if (acknowledgedEffect && acknowledgedEffect.type === 'voice.farewell') {
                state.voice.farewell = normalizeVoiceOutcome({
                    ...object(object(event.payload).result),
                    kind: 'farewell',
                    status: object(object(event.payload).result).status
                        || (acknowledgedStatus === 'completed' ? 'ok' : 'failed'),
                    error: object(object(event.payload).result).error
                        || (acknowledgedStatus === 'failed' ? 'farewell_voice_failed' : null),
                    updatedAt: event.occurredAt
                });
            }
            if (acknowledgedStatus === 'failed' && acknowledgedEffect) {
                if (acknowledgedEffect.type === 'payload.sync_before_start') {
                    state.flags.payloadSyncRequested = false;
                    state.flags.loadConfirmed = false;
                    state.phase = 'boarding';
                    state.subphase = 'payload_sync_failed';
                } else if (acknowledgedEffect.type === 'voice.boarding') {
                    // App parity: paxVoicePlayBoarding() is best effort. Its
                    // failure is caught and the boarding voice gate is still
                    // completed, so a muted/offline voice service cannot lock
                    // the mission start forever.
                    state.flags.boardingVoiceComplete = true;
                    state.flags.boardingConfirmed = true;
                    applyStartReadiness(state);
                } else if (acknowledgedEffect.type === 'voice.farewell') {
                    // App parity: a failed or disabled Farewell is best effort
                    // and must release the waiting deboarding gate.
                    state.flags.farewellCompleted = true;
                } else if (acknowledgedEffect.type === 'scene.boarding') {
                    state.phase = 'prepare';
                    state.subphase = 'boarding_failed';
                    state.flags.boardingSceneConfirmed = false;
                    state.flags.boardingVoiceComplete = false;
                    state.flags.boardingConfirmed = false;
                }
            }
        } else if (event.type === 'CLOSE_REQUESTED') {
            var loadedDestinationPax = state.cargo.summary.destinationPassengerRemaining > 0;
            state.flags.farewellStarted = false;
            state.flags.farewellCompleted = false;
            state.flags.deboardingCompleted = false;
            if (loadedDestinationPax) {
                state.subphase = 'deboarding_prepare';
                appendEffect(state, createEffect(state, event, 'scene.deboarding', {
                    operation: 'pax_deboarding',
                    coordinateFarewell: true,
                    position: object(event.payload).position
                }));
            } else {
                state.flags.farewellStarted = true;
                state.subphase = 'farewell_wait';
                appendEffect(state, createEffect(state, event, 'voice.farewell', { operation: 'farewell' }));
            }
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
        if (phase === 'boarding' && !state.cargo.summary.departureReady) result.push('departure_manifest_incomplete');
        if (phase === 'boarding' && state.cargo.signatureScope !== 'departure') result.push('departure_signature_missing');
        if (phase === 'boarding' && !state.flags.boardingConfirmed) result.push('boarding_not_confirmed');
        if (phase === 'boarding' && !state.flags.loadConfirmed) result.push('load_not_confirmed');
        if (phase === 'on_task' && state.cargo.summary.pickupMissing > 0) result.push('pickup_manifest_incomplete');
        if ((phase === 'end_unloading' || phase === 'end_ready') && state.cargo.summary.destinationRemaining > 0) result.push('destination_unload_incomplete');
        if ((phase === 'end_unloading' || phase === 'end_ready')
            && state.cargo.summary.destinationTotal > 0
            && state.cargo.summary.destinationRemaining === 0
            && state.cargo.signatureScope !== 'arrival') result.push('arrival_signature_missing');
        if (phase === 'end_ready'
            && state.cargo.summary.destinationTotal > 0
            && !state.flags.unloadConfirmed) result.push('arrival_unload_not_confirmed');
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
        if (phase === 'prepare' && state.effects.some(function (effect) {
            return effect.type === 'scene.prepare' && effect.status === 'completed';
        })) actions.push('start_boarding');
        if (phase === 'boarding') {
            if (!state.flags.payloadSyncRequested) {
                actions.push('set_manifest_item');
                if (state.cargo.summary.departureReady && state.cargo.signatureScope !== 'departure') actions.push('sign_manifest');
                if (state.cargo.signatureScope === 'departure') actions.push('clear_manifest_signature');
                if (state.cargo.summary.departureReady && state.cargo.signatureScope === 'departure' && !state.flags.loadConfirmed) actions.push('confirm_load');
            }
        }
        if (phase === 'boarded') actions.push('start_mission');
        if (state.flags.active) {
            if (state.flags.onGround === false
                && (phase === 'active' || phase === 'enroute' || phase === 'return_leg')) {
                actions.push('set_manifest_item');
            }
            if (state.flags.groundStill && state.phase === 'on_task' && state.cargo.summary.pickupTotal > 0) {
                actions.push('set_manifest_item');
                if (state.cargo.summary.pickupMissing === 0) actions.push('sign_manifest');
                if (state.cargo.summary.pickupMissing === 0 && state.cargo.signatureScope === 'pickup') actions.push('confirm_pickup');
            }
            if (state.flags.groundStill && state.progress.airborneSeen && state.cargo.summary.destinationTotal > 0) {
                actions.push('set_manifest_item');
                var deboardingPending = state.effects.some(function (effect) {
                    return effect.type === 'scene.deboarding' && effect.status === 'requested';
                });
                var loadedDestinationPax = state.cargo.items.some(function (item) {
                    return item.itemType === 'passenger' && item.status === 'loaded' && item.delivery === 'destination';
                });
                if ((phase === 'end_unloading' || phase === 'end_ready') && loadedDestinationPax && !deboardingPending) {
                    actions.push('request_pax_interaction');
                }
                if (state.cargo.summary.destinationRemaining === 0 && state.cargo.signatureScope !== 'arrival') actions.push('sign_manifest');
                if (state.cargo.signatureScope === 'arrival') actions.push('clear_manifest_signature');
                if (state.cargo.summary.destinationRemaining === 0 && state.cargo.signatureScope === 'arrival' && !state.flags.unloadConfirmed) actions.push('confirm_unload');
            }
        }
        var closeDeboardingPending = state.effects.some(function (effect) {
            return (effect.type === 'scene.deboarding'
                || effect.type === 'voice.farewell'
                || effect.type === 'scene.deboarding_continue')
                && effect.status === 'requested';
        });
        var compliance = state.workflows.complianceInspection;
        var boardBook = state.manifest.items.find(function (item) {
            return /bordbuch/i.test(String(item && item.id || '') + ' ' + String(item && item.label || '') + ' ' + String(item && item.storyName || ''));
        }) || null;
        if (!state.flags.closed && boardBook && (boardBook.status === 'loaded' || boardBook.status === 'unloaded')) {
            var currentFlightId = currentFlightEvents(state).flightId;
            var boardBookInitial = manifestCore && typeof manifestCore.boardBookActionState === 'function'
                ? manifestCore.boardBookActionState(boardBook, state.manifest, { currentFlightId: currentFlightId, missionAvailable: true })
                : null;
            var boardBookField = boardBookInitial && boardBookInitial.field;
            var boardBookComplianceAllowed = compliance.selected !== true || compliance.released === true
                || !['request_playing', 'evidence_open', 'result_playing', 'departing'].includes(compliance.phase)
                || (compliance.phase === 'evidence_open'
                    && compliance.remediationRequired
                    && compliance.missingFields.includes(boardBookField));
            if (!boardBookInitial || (boardBookInitial.allowed && boardBookComplianceAllowed)) actions.push('set_boardbook_time');
        }
        if (!state.flags.closed && (compliance.selected !== true || compliance.released === true)
            && state.manifest.items.some(function (item) {
                return item && (item.id === 'first-aid' || item.id === 'fire-extinguisher')
                    && item.equipmentType === 'expiry' && item.status === 'unloaded';
            })) actions.push('replace_equipment');
        if (!state.flags.closed && compliance.selected === true && compliance.phase === 'evidence_open') {
            actions.push('submit_compliance_evidence');
        }
        var closeReasons = blockingReasons(state);
        var complianceCloseStart = compliance.selected === true
            && !compliance.released
            && ['selected', 'approach_started', 'inspectors_waiting'].includes(compliance.phase)
            && closeReasons.every(function (reason) { return reason === 'compliance_inspection_active'; });
        if (phase === 'end_ready' && (closeReasons.length === 0 || complianceCloseStart) && !closeDeboardingPending) {
            actions.push('request_close');
        }
        // The visible reset control is deliberately mapped to abort_mission by
        // the shared UI core. Do not publish a second reset intent until its
        // own transactional semantics exist in the tracker runtime.
        if (!state.flags.closed) actions.push('abort_mission');
        return Array.from(new Set(actions)).sort();
    }

    function nextStep(state) {
        if (state.phase === 'planned') return 'prepare';
        if (state.phase === 'prepare') return 'start_boarding';
        if (state.phase === 'boarding') {
            if (state.flags.payloadSyncRequested) return 'await_payload_sync';
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
        if (state.phase === 'end_unloading' || state.phase === 'end_ready') {
            if (state.flags.farewellStarted && !state.flags.farewellCompleted) return 'await_farewell';
            if (state.flags.farewellCompleted && !state.flags.deboardingCompleted) return 'await_deboarding';
            if (state.cargo.summary.destinationRemaining > 0) return 'complete_unload';
            if (state.cargo.summary.destinationTotal > 0 && state.cargo.signatureScope !== 'arrival') return 'sign_arrival_manifest';
            if (state.cargo.summary.destinationTotal > 0 && !state.flags.unloadConfirmed) return 'confirm_unload';
            return 'close_mission';
        }
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
            flightEvents: currentFlightEvents(state),
            payload: payloadCore && typeof payloadCore.projectOutcome === 'function'
                ? payloadCore.projectOutcome(state.payload)
                : clone(state.payload, {}),
            voice: clone(state.voice, {}),
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
            manifest: state.manifest,
            flightEvents: currentFlightEvents(state),
            cargo: state.cargo,
            payload: state.payload,
            voice: state.voice,
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
                boardingSceneConfirmed: state.flags.boardingSceneConfirmed,
                boardingVoiceComplete: state.flags.boardingVoiceComplete,
                boardingConfirmed: state.flags.boardingConfirmed,
                payloadSyncRequested: state.flags.payloadSyncRequested,
                loadConfirmed: state.flags.loadConfirmed,
                unloadConfirmed: state.flags.unloadConfirmed,
                started: state.flags.started,
                active: state.flags.active,
                closingPending: state.flags.closingPending,
                closed: state.flags.closed,
                onGround: state.flags.onGround,
                groundStill: state.flags.groundStill,
                farewellStarted: state.flags.farewellStarted,
                farewellCompleted: state.flags.farewellCompleted,
                deboardingCompleted: state.flags.deboardingCompleted
            },
            progress: state.progress,
            manifest: state.manifest,
            cargo: state.cargo,
            payload: state.payload,
            voice: state.voice,
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
            voice: result.state.voice,
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
        TRACKER_AUTHORITY_READY: TRACKER_AUTHORITY_READY,
        TRACKER_AUTHORITY_PENDING: TRACKER_AUTHORITY_PENDING,
        TRACKER_AUTHORITY_FIELD_VALIDATION_PENDING: TRACKER_AUTHORITY_FIELD_VALIDATION_PENDING,
        canonicalStringify: canonicalStringify,
        hashValue: hashValue,
        normalizeManifest: normalizeManifest,
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
