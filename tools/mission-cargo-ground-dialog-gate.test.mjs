// Verladefenster (Bordbestand) oeffnen: Im Tracker-Modus entscheidet in den
// Bodenphasen der Tracker, nicht die lueckenhafte App-Telemetrie. Feldtest
// 22.10.2026: "nur am Boden und im Stillstand", obwohl der Tracker weder Pause
// noch Menue sah.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { extractOriginalFunction } from './extract-original-function.mjs';

const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const gate = source.slice(source.indexOf('const MISSION_CARGO_TRACKER_GROUND_PHASES'),
    source.indexOf('window.closeMissionCargoDialog = function'));

function fixture({ tracker = true, phase = 'boarding', allowed = ['set_manifest_item'], local = null, reason = 'no_sim_data', label = 'Warte auf Sim-Daten' } = {}) {
    const opened = [], debug = [];
    const context = {
        window: {
            missionCargoStatus: {},
            gaTrackerExecutionHandlesMission: () => tracker,
            gaTrackerExecutionControl: { phase, allowedActions: allowed },
            openMissionCargoDialog: mode => opened.push(mode),
            missionComplianceGetCargoUiState: () => ({ active: false })
        },
        missionRuntime: { active: true },
        _missionCargoGroundHandlingStatus: () => local || { ready: false, onGround: reason === 'moving', gs: reason === 'moving' ? 12 : null, label },
        _missionStartGroundStatus: () => ({ ready: false, reason, label }),
        _missionCargoHasActiveMission: () => true,
        _missionRuntimeGroundEndReady: () => false,
        _missionPhaseDebugPush: (name, data) => debug.push({ name, ...data })
    };
    vm.createContext(context);
    vm.runInContext(extractOriginalFunction(source, '_missionCargoTrackerIntentAllowed') + '\n' + gate, context);
    return { context, opened, debug };
}

test('Tracker-Bodenphase: fehlende App-Flugdaten sperren das Verladefenster nicht mehr', () => {
    for (const phase of ['prepare', 'boarding', 'end_unloading', 'end_ready']) {
        for (const reason of ['no_sim_data', 'tracker_offline', 'menu_or_map', 'paused', 'unknown']) {
            const x = fixture({ phase, reason });
            assert.equal(x.context.window.openMissionGroundCargoDialog(), true, `${phase}/${reason}`);
            assert.equal(x.opened.length, 1);
            assert.equal(x.debug[0].source, 'tracker-phase');
            assert.equal(x.debug[0].reason, reason);
        }
    }
});

test('Tracker-Bodenphase: eindeutiges Rollen sperrt weiterhin', () => {
    const x = fixture({ reason: 'moving', label: 'Nicht im Stillstand' });
    assert.equal(x.context.window.openMissionGroundCargoDialog(), false);
    assert.equal(x.opened.length, 0);
    assert.equal(x.context.window.missionCargoStatus.error, 'Bordbestand kann nur am Boden und im Stillstand geoeffnet werden.');
});

test('ausserhalb der Bodenphasen oder ohne Tracker-Freigabe bleibt die lokale Pruefung, mit konkretem Grund', () => {
    const enroute = fixture({ phase: 'enroute' });
    assert.equal(enroute.context.window.openMissionGroundCargoDialog(), false);
    assert.equal(enroute.context.window.missionCargoStatus.error, 'Bordbestand derzeit nicht verfuegbar: Warte auf Sim-Daten.');
    assert.equal(enroute.debug[0].allowed, false);
    const notAllowed = fixture({ allowed: ['abort_mission'] });
    assert.equal(notAllowed.context.window.openMissionGroundCargoDialog(), false);
});

test('Web-Modus unveraendert: nur lokale Pruefung', () => {
    const blocked = fixture({ tracker: false });
    assert.equal(blocked.context.window.openMissionGroundCargoDialog(), false);
    const ready = fixture({ tracker: false, local: { ready: true, onGround: true, gs: 0, label: 'Am Boden bereit' } });
    assert.equal(ready.context.window.openMissionGroundCargoDialog(), true);
    assert.deepEqual(ready.debug, [], 'normaler Fall ohne Debug-Rauschen');
});
