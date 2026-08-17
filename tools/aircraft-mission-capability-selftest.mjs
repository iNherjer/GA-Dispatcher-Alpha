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
