import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../aircraft-mission-capability-core.js');

const oneSeat = core.buildAircraftCapabilitySnapshot({
    slotId: 'CUB',
    preset: { name: 'Solo Cub', pax: 1, maxPayloadKg: 180, aircraftClass: 'sep', aircraftTags: ['bush'] }
});
assert.equal(oneSeat.totalSeats, 1);
assert.equal(oneSeat.passengerCapacity, 0);

const cub = core.buildAircraftCapabilitySnapshot({
    slotId: 'CUB',
    preset: { name: 'Cub', pax: 2, maxPayloadKg: 220, aircraftClass: 'sep', aircraftTags: ['bush'] }
});
assert.equal(cub.passengerCapacity, 1);

const fourSeat = core.buildAircraftCapabilitySnapshot({ preset: { pax: 4 } });
const sixSeat = core.buildAircraftCapabilitySnapshot({ preset: { pax: 6 } });
assert.equal(fourSeat.passengerCapacity, 3);
assert.equal(sixSeat.passengerCapacity, 5);

const cubSightseeingParty = core.resolveMissionPartyPlan({
    profileId: 'sightseeing_tour',
    baseType: 'apt',
    passengerCapacity: cub.passengerCapacity,
    groupCapability: true,
    randomValues: [0.99, 0.99]
});
assert.equal(cubSightseeingParty.eligible, true);
assert.equal(cubSightseeingParty.passengerCount, 1);
assert.deepEqual(cubSightseeingParty.party, { count: 1, kind: 'single', label: 'Sightseeing-Gast' });

const legacySightseeingParty = core.resolveMissionPartyPlan({
    profileId: 'sightseeing_tour',
    baseType: 'apt',
    passengerCapacity: fourSeat.passengerCapacity,
    groupCapability: false,
    randomValues: [0.99, 0.99]
});
assert.equal(legacySightseeingParty.groupEnabled, false);
assert.equal(legacySightseeingParty.passengerCount, 1);

const sightseeingCouple = core.resolveMissionPartyPlan({
    profileId: 'sightseeing_tour',
    baseType: 'poi',
    passengerCapacity: fourSeat.passengerCapacity,
    groupCapability: true,
    randomValues: [0.5, 0.5]
});
assert.equal(sightseeingCouple.passengerCount, 2);
assert.deepEqual(sightseeingCouple.party, { count: 2, kind: 'couple', label: 'Sightseeing-Paar' });

const sightseeingFamily = core.resolveMissionPartyPlan({
    profileId: 'sightseeing_tour',
    baseType: 'apt',
    passengerCapacity: fourSeat.passengerCapacity,
    groupCapability: true,
    randomValues: [0.95, 0.1]
});
assert.equal(sightseeingFamily.passengerCount, 3);
assert.deepEqual(sightseeingFamily.party, { count: 3, kind: 'family', label: 'Sightseeing-Familie' });

const charterTeam = core.resolveMissionPartyPlan({
    profileId: 'auto',
    taskDomain: 'charter',
    category: 'charter',
    baseType: 'apt',
    passengerCapacity: sixSeat.passengerCapacity,
    groupCapability: true,
    randomValues: [0.99, 0.1]
});
assert.equal(charterTeam.passengerCount, 5);
assert.deepEqual(charterTeam.party, { count: 5, kind: 'business_team', label: 'Business-Team' });

const privateClub = core.resolveMissionPartyPlan({
    profileId: 'private_outing',
    baseType: 'apt',
    passengerCapacity: sixSeat.passengerCapacity,
    groupCapability: true,
    randomValues: [0.99, 0.99]
});
assert.equal(privateClub.passengerCount, 5);
assert.deepEqual(privateClub.party, { count: 5, kind: 'club', label: 'Vereinsgruppe' });

const utilityParty = core.resolveMissionPartyPlan({
    profileId: 'club_utility',
    taskDomain: 'club_utility',
    category: 'club',
    baseType: 'apt',
    passengerCapacity: sixSeat.passengerCapacity,
    groupCapability: true,
    randomValues: [0.99, 0.99]
});
assert.equal(utilityParty.eligible, false);
assert.equal(utilityParty.party, null);

assert.deepEqual(core.extractPassengerCounts('0 PAX am Start · 1 PAX Pickup'), [0, 1]);
assert.deepEqual(core.extractPassengerCounts('2 PAX (Sightseeing-Gäste)'), [2]);

const cubGroup = core.resolveMissionPassengerPlan({
    paxText: '2 PAX (Sightseeing-Gäste)',
    passengerCapacity: cub.passengerCapacity,
    maxPartySize: 1
});
assert.equal(cubGroup.blocked, false);
assert.equal(cubGroup.passengerCount, 1);
assert.equal(cubGroup.paxText, '1 PAX (Sightseeing-Gast)');
assert.deepEqual(cubGroup.party, { count: 1, kind: 'single', label: 'Passagier' });

const preservedGroup = core.resolveMissionPassengerPlan({
    paxText: '1 PAX (Sightseeing-Gast)',
    passengerCount: sightseeingFamily.passengerCount,
    passengerCapacity: fourSeat.passengerCapacity,
    maxPartySize: sightseeingFamily.maxPartySize,
    party: sightseeingFamily.party
});
assert.equal(preservedGroup.passengerCount, 3);
assert.equal(preservedGroup.paxText, '3 PAX (Sightseeing-Familie)');
assert.deepEqual(preservedGroup.party, sightseeingFamily.party);

const soloBlocked = core.resolveMissionPassengerPlan({
    paxText: '1 PAX (Instruktor)',
    passengerCapacity: oneSeat.passengerCapacity,
    maxPartySize: 1
});
assert.equal(soloBlocked.blocked, true);
assert.equal(soloBlocked.passengerCount, 0);

const noPax = core.resolveMissionPassengerPlan({
    paxText: '0 PAX',
    passengerCapacity: 0,
    maxPartySize: 1
});
assert.equal(noPax.blocked, false);
assert.equal(noPax.passengerCount, 0);
assert.equal(noPax.paxText, '0 PAX');

const pickup = core.resolveMissionPassengerPlan({
    paxText: '0 PAX am Start · 1 PAX Pickup (Rangerin)',
    passengerCapacity: 1,
    maxPartySize: 1
});
assert.equal(pickup.passengerCount, 0);
assert.equal(pickup.pickupPassengerCount, 1);
assert.equal(pickup.plannedPassengerCount, 1);
assert.equal(pickup.paxText, '0 PAX am Start · 1 PAX Pickup (Rangerin)');

console.log('aircraft mission capability selftest: ok');
