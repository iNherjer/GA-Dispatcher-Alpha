(function (root, factory) {
    'use strict';
    var api = typeof module === 'object' && module.exports
        ? factory(require('./mission-execution-core.js'))
        : factory(root && root.GAMissionExecutionCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionExecutionShadowJournal = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';

    var JOURNAL_SCHEMA = 'ga.mission-execution-journal.v1';
    var JOURNAL_VERSION = 1;
    var MAX_EVENTS = 160;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function clone(value, fallback) {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
    }

    function text(value, maxLength) {
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, Math.max(0, Number(maxLength) || 180));
    }

    function executionBundle(journal) {
        var source = object(journal);
        if (!core || !source.missionId || !source.initialState) return null;
        return core.normalizeBundle({
            schema: core.BUNDLE_SCHEMA,
            version: core.CORE_VERSION,
            missionId: source.missionId,
            recipe: source.recipe,
            initialState: source.initialState,
            events: source.events
        });
    }

    function normalizeJournal(raw) {
        var source = object(raw);
        if (!core || source.schema !== JOURNAL_SCHEMA || Number(source.version) !== JOURNAL_VERSION) return null;
        var bundle = executionBundle(source);
        if (!bundle) return null;
        var lastProjection = core.normalizeState(source.lastProjection || bundle.initialState);
        if (lastProjection.missionId !== bundle.missionId) return null;
        return {
            schema: JOURNAL_SCHEMA,
            version: JOURNAL_VERSION,
            missionId: bundle.missionId,
            recipe: bundle.recipe,
            initialState: bundle.initialState,
            events: bundle.events,
            lastProjection: lastProjection,
            lastProjectionHash: core.semanticHash(lastProjection),
            nextSequence: Math.max(
                bundle.events.length + 1,
                Math.round(Number(source.nextSequence) || 1),
                bundle.events.reduce(function (max, event) { return Math.max(max, Number(event.sequence) || 0); }, 0) + 1
            )
        };
    }

    function create(resumeBundle) {
        if (!core) return null;
        var bundle = core.createExecutionBundle(resumeBundle);
        if (!bundle) return null;
        return normalizeJournal({
            schema: JOURNAL_SCHEMA,
            version: JOURNAL_VERSION,
            missionId: bundle.missionId,
            recipe: bundle.recipe,
            initialState: bundle.initialState,
            events: [],
            lastProjection: bundle.initialState,
            nextSequence: 1
        });
    }

    function recover(rawExecutionBundle, resumeBundle) {
        if (!core) return null;
        var bundle = core.normalizeBundle(rawExecutionBundle);
        var latest = core.projectLegacyBundle(resumeBundle);
        if (!bundle || !latest || bundle.missionId !== latest.missionId) return null;
        return normalizeJournal({
            schema: JOURNAL_SCHEMA,
            version: JOURNAL_VERSION,
            missionId: bundle.missionId,
            recipe: bundle.recipe,
            initialState: bundle.initialState,
            events: bundle.events,
            lastProjection: latest,
            nextSequence: bundle.events.length + 1
        });
    }

    function same(left, right) {
        return core.canonicalStringify(left) === core.canonicalStringify(right);
    }

    function isAtOrAfter(phase, expected) {
        var order = ['planned', 'prepare', 'boarding', 'boarded', 'active', 'enroute', 'on_task', 'return_leg', 'end_unloading', 'end_ready', 'closing', 'closed'];
        return order.indexOf(phase) >= order.indexOf(expected);
    }

    function advance(rawJournal, resumeBundle, options) {
        var config = object(options);
        var desired = core && core.projectLegacyBundle(resumeBundle);
        var journal = normalizeJournal(rawJournal) || create(resumeBundle);
        if (!journal || !desired || journal.missionId !== desired.missionId) journal = create(resumeBundle);
        if (!journal || !desired) return null;
        var replay = core.replay(executionBundle(journal));
        if (!replay.ok) return null;
        if (desired.phase === 'planned' && replay.state.phase !== 'planned') {
            journal = create(resumeBundle);
            replay = core.replay(executionBundle(journal));
            if (!journal || !replay.ok) return null;
        }
        var state = replay.state;
        var previous = journal.lastProjection;
        var occurredAt = Math.max(0, Math.round(Number(config.occurredAt) || 0));
        var accepted = [];
        var rejected = [];

        function append(type, payload) {
            if (journal.events.length >= MAX_EVENTS) {
                rejected.push({ type: type, reason: 'journal_full' });
                return false;
            }
            var sequence = journal.nextSequence;
            var cleanPayload = payload && typeof payload === 'object' ? payload : {};
            var event = core.normalizeEvent({
                eventId: 'mxj-' + core.hashValue({
                    missionId: journal.missionId,
                    type: type,
                    sequence: sequence,
                    payload: cleanPayload
                }),
                type: type,
                sequence: sequence,
                occurredAt: occurredAt,
                payload: cleanPayload
            }, sequence);
            var next = core.reduce(state, event);
            if (core.stateHash(next) === core.stateHash(state)) {
                rejected.push({ type: type, reason: 'transition_blocked' });
                return false;
            }
            journal.events.push(event);
            journal.nextSequence += 1;
            state = next;
            accepted.push(type);
            return true;
        }

        if (isAtOrAfter(desired.phase, 'prepare') && state.phase === 'planned') append('PREPARE_REQUESTED');
        if (isAtOrAfter(desired.phase, 'boarding') && (state.phase === 'prepare' || state.phase === 'boarding')) {
            if (state.phase === 'prepare') append('BOARDING_STARTED');
        }
        if (!same(state.cargo, desired.cargo)) append('CARGO_STATE_CHANGED', { cargo: desired.cargo });
        if (!same(state.workflows.complianceInspection, desired.workflows.complianceInspection)) {
            append('COMPLIANCE_EVENT', desired.workflows.complianceInspection);
        }
        if (isAtOrAfter(desired.phase, 'boarded') && !state.flags.loadConfirmed) {
            append('LOAD_CONFIRMED', { cargo: desired.cargo });
        }
        if (isAtOrAfter(desired.phase, 'boarded') && !state.flags.boardingConfirmed) {
            append('BOARDING_CONFIRMED', { cargo: desired.cargo });
        }
        if (isAtOrAfter(desired.phase, 'active') && !state.flags.started) append('MISSION_STARTED');

        if (desired.progress.airborneSeen && (!state.progress.airborneSeen || (state.flags.onGround === true && desired.flags.onGround === false))) {
            append('AIRBORNE');
        }
        if (desired.flags.onGround === true && state.flags.onGround !== true && desired.progress.airborneSeen) append('TOUCHDOWN');
        if (desired.flags.groundStill && !state.flags.groundStill && desired.progress.airborneSeen) {
            append('GROUND_STILL', {
                atDestination: desired.phase === 'end_unloading' || desired.phase === 'end_ready' || desired.phase === 'closing'
            });
        }

        var previousDestinationRemaining = Number(object(object(previous).cargo).summary?.destinationRemaining || 0);
        if (desired.cargo.summary.destinationTotal > 0
            && desired.cargo.summary.destinationRemaining === 0
            && desired.cargo.signatureScope === 'arrival'
            && (previousDestinationRemaining > 0 || state.phase === 'end_unloading')) {
            append('UNLOAD_CONFIRMED', { cargo: desired.cargo });
        }
        if (desired.subphase === 'farewell_wait' && state.subphase !== 'farewell_wait') append('FAREWELL_STARTED');
        if ((desired.flags.farewellCompleted
            || ((desired.phase === 'closing' || desired.phase === 'closed') && previous.subphase === 'farewell_wait'))
            && !state.flags.farewellCompleted) append('FAREWELL_COMPLETED');
        if ((desired.phase === 'closing' || desired.phase === 'closed') && !state.flags.closingPending) {
            append('CLOSE_REQUESTED', { cargo: desired.cargo });
        }
        if (desired.phase === 'closed' && !state.flags.closed) append('MISSION_CLOSED');

        journal.lastProjection = desired;
        journal.lastProjectionHash = core.semanticHash(desired);
        var normalized = normalizeJournal(journal);
        return normalized ? {
            journal: normalized,
            bundle: executionBundle(normalized),
            state: state,
            stateHash: core.stateHash(state),
            legacyStateHash: core.semanticHash(desired),
            legacyDriftFields: core.semanticDriftFields(state, desired),
            acceptedEvents: accepted,
            rejectedEvents: rejected
        } : null;
    }

    function finalize(rawJournal, resumeBundle, options) {
        var advanced = advance(rawJournal, resumeBundle, options);
        if (!advanced) return null;
        var journal = advanced.journal;
        var replay = core.replay(executionBundle(journal));
        if (!replay.ok || replay.state.flags.closed) return advanced;
        if (replay.state.phase !== 'closing' && replay.state.phase !== 'end_ready') return advanced;
        var sequence = journal.nextSequence;
        var event = core.normalizeEvent({
            eventId: 'mxj-' + core.hashValue({ missionId: journal.missionId, type: 'MISSION_CLOSED', sequence: sequence }),
            type: 'MISSION_CLOSED',
            sequence: sequence,
            occurredAt: Math.max(0, Math.round(Number(object(options).occurredAt) || 0))
        }, sequence);
        var next = core.reduce(replay.state, event);
        if (core.stateHash(next) !== core.stateHash(replay.state) && journal.events.length < MAX_EVENTS) {
            journal.events.push(event);
            journal.nextSequence += 1;
        }
        var normalized = normalizeJournal(journal);
        var bundle = executionBundle(normalized);
        var result = core.replay(bundle);
        return {
            journal: normalized,
            bundle: bundle,
            state: result.state,
            stateHash: result.stateHash,
            legacyStateHash: advanced.legacyStateHash,
            legacyDriftFields: core.semanticDriftFields(result.state, advanced.journal.lastProjection),
            acceptedEvents: advanced.acceptedEvents.concat(result.state.flags.closed ? ['MISSION_CLOSED'] : []),
            rejectedEvents: advanced.rejectedEvents
        };
    }

    return Object.freeze({
        JOURNAL_SCHEMA: JOURNAL_SCHEMA,
        JOURNAL_VERSION: JOURNAL_VERSION,
        MAX_EVENTS: MAX_EVENTS,
        normalizeJournal: normalizeJournal,
        create: create,
        recover: recover,
        advance: advance,
        finalize: finalize,
        executionBundle: executionBundle
    });
}));
