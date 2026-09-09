#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const before = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const plain = value => JSON.parse(JSON.stringify(value));
function load(text, config) {
    const commands = [];
    const calls = [];
    const context = {
        Date: { now: () => 123456789 },
        window: {
            liveTrackerConnected: true, liveTrackerVersionCode: 999,
            lastLiveGpsPos: { lat: 48, lon: 8, alt: 500, hdg: 90 },
            missionSceneStatus: { sceneId: 'departure' },
            missionAptArrivalSceneStatus: {
                spawned: config.arrival, error: config.failed ? 'spawn_failed' : null,
                spawnedByKind: { arrival_vehicle: config.vehicle ? 1 : 0 }
            },
            sendTrackerCommand: command => { commands.push(plain(command)); return 'command-1'; }
        },
        MIN_TRACKER_VERSION_CODE: 356, MIN_TRACKER_VERSION_LABEL: 'v356',
        MISSION_SCENE_DEFAULT_VEHICLE_TITLE: 'Default car',
        _missionSceneGroupCapabilityMissing: () => false,
        _missionPhaseDebugPush: () => {},
        _missionSceneDeboardingPaxCount: () => config.pax,
        _missionScenePaxCount: () => config.pax,
        _missionBushIsPickupPassengerMission: () => false,
        _missionCargoPassengerAlreadyUnloaded: () => false,
        _missionSceneId: () => 'departure',
        _isAtAptArrivalPoint: () => config.near,
        _missionAptArrivalPickupPoint: () => ({ forwardM: 3, rightM: 8, label: 'Club' }),
        _missionAptArrivalSceneId: () => 'arrival',
        _missionSceneVehicleAsset: () => config.asset ? { title: 'Car', candidates: ['Van'] } : null,
        _missionSceneCommonSceneCommandFields: () => ({ openDoor: true, boardingSpeedKts: 2, aircraftSlot: 'PA-24' }),
        _missionSceneVehiclePoint: () => ({ forwardM: 22, rightM: -12 }),
        _missionSceneVehicleDeparturePath: () => [{ forwardM: 22, rightM: -12 }, { forwardM: 80, rightM: -12 }],
        _missionScenePassengerGender: () => config.gender,
        _missionSceneMovingPersonTitle: (gender, stage) => `${gender}-${stage}`,
        _missionSceneMovingPersonCandidates: (gender, title) => [title, `${gender}-fallback`],
        _sceneAssetCandidates: (title, candidates) => [title, ...candidates],
        _missionSceneArmDeboardingWatchdog: (...args) => calls.push(args)
    };
    vm.createContext(context);
    const begin = text.includes('function _missionSceneBuildDeboardingCommand(')
        ? 'function _missionSceneBuildDeboardingCommand(' : 'function _missionSceneBuildDeboardingEffectCommand(';
    const builders = text.slice(text.indexOf(begin), text.indexOf('function _buildMissionAptExecutionEffectPlan('));
    const start = text.indexOf('window.missionSceneDeboarding = ');
    const standalone = text.slice(start, text.indexOf('window.missionSceneContinueDeboarding = ', start));
    vm.runInContext(builders + standalone, context);
    return { context, commands, calls };
}
let count = 0;
for (const arrival of [false, true]) for (const near of [false, true])
for (const vehicle of [false, true]) for (const failed of [false, true])
for (const asset of [false, true]) for (const pax of [0, 1, 5])
for (const coordinateFarewell of [false, true]) for (const gender of ['male', 'female']) {
    const config = { arrival, near, vehicle, failed, asset, pax, gender };
    const actual = load(source, config);
    const result = actual.context.window.missionSceneDeboarding('mission-end', { coordinateFarewell });
    assert.equal(result, pax ? 'command-1' : false);
    if (before) {
        const expected = load(before, config);
        assert.equal(result, expected.context.window.missionSceneDeboarding('mission-end', { coordinateFarewell }));
        assert.deepEqual(actual.commands, expected.commands, JSON.stringify(config));
        assert.deepEqual(plain(actual.context.window.missionSceneStatus), plain(expected.context.window.missionSceneStatus));
        assert.deepEqual(actual.calls, expected.calls);
    }
    if (pax) {
        const command = actual.commands[0];
        const staged = arrival && near && vehicle && !failed;
        assert.equal(command.vehicleArrival, !staged);
        assert.equal(command.coordinateFarewell, coordinateFarewell);
        assert.equal(command.passengerCount, pax);
        assert.equal(command.deboardingPickupSceneId, staged ? 'arrival' : undefined);
        const planned = actual.context._missionSceneBuildDeboardingEffectCommand('mission-end', actual.context.window.lastLiveGpsPos, 'departure');
        if (!staged) assert.deepEqual(plain(planned), { ...command, coordinateFarewell: false });
        if (before) {
            const previous = load(before, config);
            assert.deepEqual(plain(planned), plain(previous.context._missionSceneBuildDeboardingEffectCommand('mission-end', previous.context.window.lastLiveGpsPos, 'departure')));
        }
    }
    count++;
}
console.log(`PASS ${count} deboarding configurations: shared commands, staged/fallback vehicles, Pax counts and farewell coordination${before ? '; before/after standalone and tracker templates identical' : ''}.`);
