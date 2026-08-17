import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../aircraft-mission-profile-core.js');

const profileIds = result => result.candidates.map(candidate => candidate.profileId);
const candidateFor = (result, profileId) => result.candidates.find(candidate => candidate.profileId === profileId);

assert.equal(core.shouldFilterAutoMissionPicker({ baseType: 'apt', category: 'all', profile: 'auto' }), true);
assert.equal(core.shouldFilterAutoMissionPicker({ baseType: 'poi', category: 'bridge', profile: 'auto' }), false);
assert.equal(core.shouldFilterAutoMissionPicker({ baseType: 'bush', category: 'all', profile: 'bush_supply_strip' }), false);

const unrestricted = core.getAutoMissionCandidatePool({ baseType: 'apt', aircraftTags: [] });
assert.equal(unrestricted.restricted, false);
assert.deepEqual(unrestricted.candidates, []);

const touringApt = core.getAutoMissionCandidatePool({ baseType: 'apt', aircraftTags: ['touring'] });
assert.equal(touringApt.restricted, true);
assert.deepEqual(new Set(profileIds(touringApt)), new Set(['private_outing', 'sightseeing_tour']));
assert.equal(profileIds(touringApt).includes('club_utility'), false);
assert.equal(profileIds(touringApt).includes('cargo_fragile'), false);

const businessApt = core.getAutoMissionCandidatePool({ baseType: 'apt', aircraftTags: ['business'] });
assert.deepEqual(businessApt.candidates.map(({ category, profileId }) => ({ category, profileId })), [
    { category: 'charter', profileId: 'auto' }
]);

const cargoApt = core.getAutoMissionCandidatePool({ baseType: 'apt', aircraftTags: ['cargo'] });
assert.deepEqual(new Set(profileIds(cargoApt)), new Set(['auto', 'cargo_fragile', 'animal_transport', 'medical_transfer']));
assert.equal(cargoApt.candidates.every(candidate => candidate.category === 'cargo'), true);
assert.equal(profileIds(cargoApt).includes('private_outing'), false);

const utilityPoi = core.getAutoMissionCandidatePool({ baseType: 'poi', aircraftTags: ['utility'] });
assert.equal(profileIds(utilityPoi).includes('inspection_infra'), true);
assert.equal(profileIds(utilityPoi).includes('mapping_survey'), true);
assert.equal(profileIds(utilityPoi).includes('sightseeing_tour'), false);
assert.equal(profileIds(utilityPoi).includes('sar_heli'), false);

const heliUtilityPoi = core.getAutoMissionCandidatePool({
    baseType: 'poi',
    aircraftTags: ['utility'],
    aircraftClass: 'heli',
    allowSarHeli: true
});
assert.equal(profileIds(heliUtilityPoi).includes('sar_heli'), true);

const fixedWingUtilityPoi = core.getAutoMissionCandidatePool({
    baseType: 'poi',
    aircraftTags: ['utility'],
    aircraftClass: 'sep',
    allowSarHeli: true
});
assert.equal(profileIds(fixedWingUtilityPoi).includes('sar_heli'), false);

const mergedBush = core.getAutoMissionCandidatePool({ baseType: 'bush', aircraftTags: ['bush', 'cargo'] });
assert.equal(profileIds(mergedBush).includes('bush_charter_strip'), true);
assert.equal(profileIds(mergedBush).includes('bush_pickup_cargo'), true);
assert.equal(candidateFor(mergedBush, 'bush_supply_strip').weight, 7);
assert.equal(candidateFor(mergedBush, 'bush_pickup_cargo').weight, 3);

const incompatible = core.getAutoMissionCandidatePool({ baseType: 'bush', aircraftTags: ['touring'] });
assert.equal(incompatible.restricted, true);
assert.deepEqual(incompatible.candidates, []);

assert.equal(core.getMissionSelectionMinimumPassengerCount({ baseType: 'apt', category: 'cargo', profileId: 'auto' }), 0);
assert.equal(core.getMissionSelectionMinimumPassengerCount({ baseType: 'apt', category: 'charter', profileId: 'auto' }), 1);
assert.equal(core.getMissionSelectionMinimumPassengerCount({ baseType: 'bush', profileId: 'bush_pickup_cargo' }), 0);
assert.equal(core.getMissionSelectionMinimumPassengerCount({ baseType: 'poi', profileId: 'inspection_infra' }), 1);

const soloCargoAuto = core.getAutoMissionCandidatePool({
    baseType: 'apt',
    aircraftTags: ['cargo'],
    passengerCapacity: 0
});
assert.deepEqual(soloCargoAuto.candidates.map(({ category, profileId }) => ({ category, profileId })), [
    { category: 'cargo', profileId: 'auto' }
]);

const soloUnrestrictedAuto = core.getAutoMissionCandidatePool({
    baseType: 'apt',
    aircraftTags: [],
    passengerCapacity: 0
});
assert.equal(soloUnrestrictedAuto.restricted, true);
assert.equal(soloUnrestrictedAuto.capacityOnlyRestriction, true);
assert.deepEqual(soloUnrestrictedAuto.candidates.map(({ category, profileId }) => ({ category, profileId })), [
    { category: 'cargo', profileId: 'auto' }
]);

const soloTouring = core.getAutoMissionCandidatePool({
    baseType: 'apt',
    aircraftTags: ['touring'],
    passengerCapacity: 0
});
assert.equal(soloTouring.restricted, true);
assert.deepEqual(soloTouring.candidates, []);

console.log('aircraft mission profile selftest: ok');
