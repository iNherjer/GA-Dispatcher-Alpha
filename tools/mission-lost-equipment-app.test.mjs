import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import manifestCore from '../mission-manifest-core.js';
import { extractOriginalFunction } from './extract-original-function.mjs';

const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const persistence = source.slice(source.indexOf('const MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY'),
    source.indexOf('function _missionCargoPlayAudioCueNow'));
const load = source.slice(source.indexOf('window.missionCargoLoadItem = function'),
    source.indexOf('window.missionCargoToggleItemLoadState = function'));

function fixture(runtime = {}) {
    const storage = new Map();
    const manifest = { aircraftSlot: 'C172', key: 'preflight', dispatchSignature: { scope: 'departure' },
        items: ['bordbuch', 'chocks', 'first-aid', 'fire-extinguisher'].map(id => ({
            id, status: 'lost', persistentEquipment: true, lostAt: 123, log: { flightId: 'old', startAt: 123 },
            ...(id === 'first-aid' || id === 'fire-extinguisher'
                ? { equipmentType: 'expiry', serialId: 'OLD', expiresAt: '2020-01-01' } : {})
        })) };
    const context = {
        window: { selectedAC: 'C172', GAMissionManifestCore: manifestCore, missionCargoStatus: {},
            gaTrackerExecutionHandlesMission: () => false,
            missionComplianceGetCargoUiState: () => ({ active: false }) },
        missionRuntime: { active: false, startedAt: 0, ...runtime },
        localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        document: { getElementById: () => null },
        _missionCargoEnsureManifest: () => manifest,
        _missionCargoManifestCore: () => manifestCore,
        _missionCargoIsPassengerHandoffLocked: manifestCore.isHandoffLocked,
        _missionCargoGroundHandlingAllowed: () => true,
        _missionCargoItemCanLoadAtCurrentStage: item => manifestCore.itemCanLoadAtCurrentStage(item, {}),
        _missionCargoIsPassengerItem: manifestCore.isPassengerItem,
        _missionCargoSyncPayloadToSim: () => Promise.resolve(),
        setTimeout: () => 0, clearTimeout: () => {}
    };
    vm.createContext(context);
    vm.runInContext(persistence + '\n' + [
        '_missionCargoLostEquipmentReplacementFacts', '_missionCargoActionDialogMode',
        '_missionCargoCommitCoreItemTransition', '_missionCargoRejectCoreItemTransition'
    ].map(name => extractOriginalFunction(source, name)).join('\n') + '\n' + load, context);
    context._missionCargoPersistManifest = value => context._missionCargoPersistOnboardEquipment(value);
    return { context, manifest, storage };
}

test('actual legacy App loader replaces all lost board items and persists replacements per aircraft', () => {
    const { context, manifest } = fixture();
    for (const item of manifest.items) {
        assert.equal(context.window.missionCargoLoadItem(item.id, { render: false, playAudioCue: false }), true);
        assert.equal(item.status, 'loaded');
        assert.equal(item.lostAt, 0);
        if (item.equipmentType === 'expiry') {
            assert.notEqual(item.serialId, 'OLD');
            assert.notEqual(item.expiresAt, '2020-01-01');
        }
    }
    assert.equal(manifest.dispatchSignature, null);
    assert.equal(Object.keys(manifest.items[0].log).length, 0);
    const stored = context.window.missionCargoGetOnboardEquipmentForSync();
    for (const item of manifest.items) assert.equal(stored.aircraft.C172.items[item.id].onboard, true);
    const nextManifestItems = manifest.items.map(item => ({ id: item.id, persistentEquipment: true, status: 'lost' }));
    context._missionCargoApplyStoredOnboardEquipment(nextManifestItems, 'C172');
    assert.ok(nextManifestItems.every(item => item.status === 'loaded'));
});

test('legacy App refuses replacement during a run or inspection without partially reviving the item', () => {
    for (const scenario of ['active', 'inspection']) {
        const { context, manifest } = fixture(scenario === 'active' ? { active: true, startedAt: 123 } : {});
        if (scenario === 'inspection') context.window.missionComplianceGetCargoUiState = () => ({ active: true });
        const before = JSON.stringify(manifest);
        assert.equal(context.window.missionCargoLoadItem('bordbuch', { render: false }), false);
        assert.equal(JSON.stringify(manifest), before);
    }
});
