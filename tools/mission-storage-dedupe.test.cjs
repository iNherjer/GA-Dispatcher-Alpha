'use strict';
// Storage-only deduplication of mission states: exact round trip, separate copies, plain passthrough.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../mission-storage-dedupe-core.js');

const big = (tag, n = 60) => ({ tag, rows: Array.from({ length: n }, (_, i) => ({ i, name: `${tag} Zeile ${i} – Ümlaut ✈`, v: i * 1.5, ok: i % 2 === 0, none: null })) });

function missionState() {
    const v4 = { ...big('v4'), airportInfoContext: big('apt', 20), departureAirportInfoContext: { pilotHints: big('hints', 15) } };
    v4.departureAirportInfoContext.pilotHints = JSON.parse(JSON.stringify(v4.airportInfoContext));
    const contract = { missionContractV4: v4, missionPlanV4: JSON.parse(JSON.stringify(v4)), cargoManifest: big('cargo', 25), aptArrivalPlan: big('arrival', 20) };
    return {
        mTitle: 'Charter nach Saulgau',
        currentMissionData: {
            missionId: 'mission-1', missionContract: JSON.parse(JSON.stringify(contract)),
            missionContractV4: JSON.parse(JSON.stringify(v4)), missionPlanV4: JSON.parse(JSON.stringify(v4)),
            cargoManifest: JSON.parse(JSON.stringify(contract.cargoManifest)), story: 'x'.repeat(2000)
        },
        activeMissionContract: JSON.parse(JSON.stringify(contract)),
        activePassenger: big('pax', 10), routeWaypoints: [{ lat: 48.1, lon: 9.2 }], tiny: { a: 1 }, num: [0, -0.5, 1e-7, 12345678901234]
    };
}

test('round trip reproduces the exact text and saves the repeated contract copies', () => {
    const text = JSON.stringify(missionState());
    const packed = D.packText(text);
    assert.ok(D.isPackedText(packed), 'packed');
    assert.ok(packed.length < text.length * 0.45, `packed ${packed.length} of ${text.length}`);
    assert.equal(D.unpackText(packed), text);
});

test('restored state has separate copies, not shared objects', () => {
    const state = JSON.parse(D.unpackText(D.packText(JSON.stringify(missionState()))));
    assert.notEqual(state.activeMissionContract, state.currentMissionData.missionContract);
    assert.deepEqual(state.activeMissionContract, state.currentMissionData.missionContract);
    state.activeMissionContract.cargoManifest.tag = 'changed';
    assert.equal(state.currentMissionData.missionContract.cargoManifest.tag, 'cargo');
    assert.equal(state.currentMissionData.cargoManifest.tag, 'cargo');
});

test('nested references inside a referenced object resolve (plan -> contract -> hints)', () => {
    const state = missionState();
    const back = JSON.parse(D.unpackText(D.packText(JSON.stringify(state))));
    assert.deepEqual(back, state);
    assert.deepEqual(back.currentMissionData.missionPlanV4.departureAirportInfoContext.pilotHints, state.currentMissionData.missionContractV4.airportInfoContext);
});

test('plain, small, non-object and unrepeated texts are stored unchanged', () => {
    for (const text of ['', 'null', '{"a":1}', JSON.stringify({ localStorageFallbackId: 'tok-1' }), JSON.stringify(big('only', 80)), '[1,2,3]', 'not json {']) {
        assert.equal(D.packText(text), text);
        assert.equal(D.unpackText(text), text);
    }
    assert.equal(D.unpackText(null), null);
});

test('data that already looks like a reference is never misread: falls back to plain text', () => {
    const state = missionState();
    state.currentMissionData.weird = { $gaRef: ['activeMissionContract'] };
    const text = JSON.stringify(state);
    const stored = D.packText(text);
    assert.equal(D.unpackText(stored), text);
});

test('non-canonical JSON text (whitespace) is kept as is', () => {
    const text = JSON.stringify(missionState(), null, 2);
    assert.equal(D.packText(text), text);
});

test('packing a packed text is a no-op; corrupted packed text throws', () => {
    const packed = D.packText(JSON.stringify(missionState()));
    assert.equal(D.packText(packed), packed);
    assert.throws(() => D.unpackText(D.MARKER + '"data":{"x":{"$gaRef":["missing"]}}}'));
});

test('storage wrapper packs only its key and returns plain JSON', () => {
    const map = new Map();
    const raw = { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
    const store = D.wrapStorage(raw, 'draft');
    const text = JSON.stringify({ version: 1, phase: 'review', state: missionState() });
    store.setItem('draft', text);
    store.setItem('other', text);
    assert.ok(D.isPackedText(map.get('draft')));
    assert.equal(map.get('other'), text);
    assert.equal(store.getItem('draft'), text);
    store.removeItem('draft');
    assert.equal(store.getItem('draft'), null);
});

test('draft core keeps working through the wrapper (save, reload, read)', async () => {
    global.GAMissionDraftCore = undefined;
    const Draft = require('../mission-draft-core.js');
    const map = new Map();
    const raw = { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
    const vault = { save: () => { throw new Error('no vault'); }, load: async () => null };
    const a = Draft.create({ storage: D.wrapStorage(raw, 'k'), key: 'k', vault });
    a.begin();
    const state = missionState();
    a.save(state);
    assert.ok(D.isPackedText(map.get('k')), 'draft stored packed');
    const b = Draft.create({ storage: D.wrapStorage(raw, 'k'), key: 'k', vault });
    assert.deepEqual(await b.read(), state);
});
