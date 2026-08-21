(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionStartCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function nonNegativeInteger(value) {
        var number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    }

    // Exact ordering of the legacy App checks in
    // finishMissionCargoLoadingAndStart(). Keeping this pure lets the App and
    // tracker reducer reject the same user intent before any payload effect.
    function deriveDepartureConfirmationGate(rawFacts) {
        var facts = rawFacts && typeof rawFacts === 'object' ? rawFacts : {};
        if (facts.freeflightOnly === true) return { ok: false, reason: 'freeflight_only' };
        if (nonNegativeInteger(facts.requiredMissingCount) > 0) {
            return { ok: false, reason: 'departure_manifest_incomplete' };
        }
        if (facts.signatureMatches !== true) return { ok: false, reason: 'departure_signature_missing' };
        if (facts.signatureAnimating === true) return { ok: false, reason: 'signature_animation_running' };
        if (facts.payloadFinalizeRunning === true) return { ok: false, reason: 'payload_finalize_running' };
        return { ok: true, reason: null };
    }

    // Exact post-sync policy of the App: a lost tracker is terminal for this
    // attempt; an attached tracker may continue with the existing manual
    // payload override warning when an aircraft refuses stable payload values.
    function derivePayloadCompletion(rawFacts) {
        var facts = rawFacts && typeof rawFacts === 'object' ? rawFacts : {};
        var needsSync = facts.payloadNeedsSync === true;
        if (facts.simModeActive !== true && needsSync && facts.liveTrackerConnected !== true) {
            return { ok: false, reason: 'tracker_disconnected_during_payload_check', startOverride: false };
        }
        return {
            ok: true,
            reason: null,
            startOverride: facts.simModeActive !== true && needsSync && facts.liveTrackerConnected === true
        };
    }

    // Mirrors _missionCargoMaybePromoteStartReady(). No UI concern belongs in
    // this decision; callers retain the existing labels, animation and render.
    function deriveStartReadiness(rawFacts) {
        var facts = rawFacts && typeof rawFacts === 'object' ? rawFacts : {};
        var missing = [];
        if (facts.loadConfirmed !== true) missing.push('load_not_confirmed');
        if (facts.dispatchSigned !== true) missing.push('departure_signature_missing');
        if (facts.loadInteractionReady !== true) missing.push('boarding_scene_not_complete');
        if (facts.boardingVoiceComplete !== true) missing.push('boarding_voice_not_complete');
        return {
            ready: missing.length === 0,
            alreadyBoarded: facts.alreadyBoarded === true,
            missing: missing
        };
    }

    // Scene ACK precedes voice completion in the App. The legacy App calls
    // paxVoicePlayBoarding() for passenger and cargo-only contexts; a truly
    // empty departure is the only path that completes without that effect.
    function deriveBoardingAckPlan(rawFacts) {
        var facts = rawFacts && typeof rawFacts === 'object' ? rawFacts : {};
        if (facts.sceneConfirmed !== true) return { action: 'await_scene', complete: false };
        var hasVoiceContext = facts.hasBoardingVoiceContext === true || facts.hasBoardingPassenger === true;
        if (hasVoiceContext && facts.boardingVoiceComplete !== true) {
            return { action: 'play_boarding_voice', complete: false };
        }
        return { action: 'complete_boarding', complete: true };
    }

    return Object.freeze({
        deriveBoardingAckPlan: deriveBoardingAckPlan,
        deriveDepartureConfirmationGate: deriveDepartureConfirmationGate,
        derivePayloadCompletion: derivePayloadCompletion,
        deriveStartReadiness: deriveStartReadiness
    });
}));
