/* Accepted shared mission identity; profile revisions never imply mission replacement. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAMissionCloudControlCore = api;
})(globalThis, function() {
    'use strict';
    const SCHEMA = 'ga.cloud-mission-control.v1';
    function identities(state) {
        if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
        const md = state.currentMissionData || state, contract = state.activeMissionContract || md.missionContract || {};
        return [state.missionId, state.missionKey, state.id, md.missionId, md.missionKey, md.id,
            contract.missionId, contract.missionKey, contract.id].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    }
    function validate(control, missionHash = null) {
        if (!control || control.schema !== SCHEMA || control.version !== 1
            || typeof control.epoch !== 'string' || !control.epoch || control.epoch.length > 100
            || !Number.isSafeInteger(control.revision) || control.revision < 1
            || !['active','deleted'].includes(control.status)
            || !Number.isSafeInteger(control.updatedAt) || control.updatedAt < 1
            || !/^[a-f0-9]{64}$/.test(control.missionHash || '')
            || (missionHash !== null && control.missionHash !== missionHash)
            || (control.status === 'active' ? typeof control.missionId !== 'string' || !control.missionId.trim() : control.missionId !== null)) {
            throw new Error('cloud_mission_control_invalid');
        }
        return control;
    }
    function matchesProfile(control, profile) {
        if (control.status === 'deleted') return profile.activeMission === null && profile.activeMissionTrackerSeed === null;
        return identities(profile.activeMission).includes(control.missionId.toLowerCase())
            && (!profile.activeMissionTrackerSeed || String(profile.activeMissionTrackerSeed.missionId || '').toLowerCase() === control.missionId.toLowerCase());
    }
    function transition(previous, change, profile, missionHash, now, epoch) {
        if (previous) validate(previous);
        if (!change) {
            if (previous && !matchesProfile(previous, profile)) throw new Error('mission_change_required');
            return previous ? { ...previous, missionHash } : null;
        }
        if (!['activate','clear'].includes(change.action) || !Number.isSafeInteger(change.expectedMissionRevision)
            || change.expectedMissionRevision !== (previous?.revision || 0)) throw new Error('mission_revision_conflict');
        if (typeof change.operationId !== 'string' || !change.operationId || change.operationId.length > 240) throw new Error('mission_change_invalid');
        const ids = identities(profile.activeMission);
        if (change.action === 'clear' ? profile.activeMission !== null || profile.activeMissionTrackerSeed !== null : !ids.length) throw new Error('mission_change_invalid');
        const control = { schema: SCHEMA, version: 1, epoch: previous?.epoch || epoch,
            revision: (previous?.revision || 0) + 1, status: change.action === 'clear' ? 'deleted' : 'active',
            missionId: change.action === 'activate' ? String(profile.activeMissionTrackerSeed?.missionId || ids[0]).trim() : null,
            missionHash, updatedAt: now, operationId: change.operationId };
        validate(control, missionHash);
        if (!matchesProfile(control, profile)) throw new Error('mission_change_invalid');
        return control;
    }
    function same(a, b) { return !!(a && b && a.epoch === b.epoch && a.revision === b.revision); }
    return { SCHEMA, identities, validate, matchesProfile, transition, same };
});
