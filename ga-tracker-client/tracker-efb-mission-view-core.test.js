'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MISSION_VIEW_SCHEMA,
  projectMissionManifest,
  projectTrackerEfbMissionView,
  sanitizeMissionView
} = require('./tracker-efb-mission-view-core');

test('rich app mission views are bounded before the EFB receives them', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'mission-42',
    runId: 'run-42',
    state: 'active',
    active: true,
    phase: 'active',
    revision: 8,
    updatedAt: 123,
    resumeBundle: {
      efbMission: {
        title: 'Fotoauftrag Schwarzwald',
        story: '<b>Eine ruhige Mission</b>',
        status: 'Mission aktiv',
        currentTask: 'Zielgebiet anfliegen',
        phase: { current: 1, stages: [{ id: 'prep', label: 'Vorbereitung' }, { id: 'work', label: 'Arbeitsbereich' }] },
        target: { name: 'Hornisgrinde', distanceNm: 12.34, bearingDeg: 275 },
        progress: [{ label: 'Fotopunkte', percent: 50, detail: '2 von 4' }],
        requirements: [{ label: 'Arbeitshoehe', value: '4500 ft MSL', state: 'good' }],
        feedback: [{ tone: 'warn', text: 'Noch etwas zu hoch.' }],
        comfort: { score: 82, mood: 'zufrieden', detail: '0 Pilot | 1 Wetter' },
        cargo: { conditionPct: 94, state: 'gesichert', requiredLoaded: 2, requiredTotal: 2 }
      },
      runtime: {
        cargoManifest: {
          dispatchSignature: { scope: 'departure' },
          items: [{ id: 'medical-box', storyName: '<b>Medizin-Kiste</b>', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24 }]
        }
      }
    }
  }, { alt: 4400, flight: { aglFt: 1770, gsKts: 101, onGround: false } }, { sceneCount: 2, scenes: [{ sceneId: 'start', objectCount: 3 }] });
  assert.equal(result.schema, 'ga.mission-snapshot.v2');
  assert.equal(result.view.schema, MISSION_VIEW_SCHEMA);
  assert.equal(result.view.story, 'Eine ruhige Mission');
  assert.equal(result.view.phase.stages[1].label, 'Arbeitsbereich');
  assert.equal(result.view.feedback[0].detail, 'Noch etwas zu hoch.');
  assert.equal(result.view.comfort.score, 82);
  assert.equal(result.view.flight.mslFt, 4400);
  assert.equal(result.view.flight.aglFt, 1770);
  assert.equal(result.view.flight.gsKts, 101);
  assert.equal(result.view.flight.trackerLive, true);
  assert.equal(result.sceneCount, 2);
  assert.equal(result.available, true);
  assert.equal(result.manifest.signatureScope, 'departure');
  assert.equal(result.manifest.items[0].label, 'Medizin-Kiste');
  assert.equal(result.manifest.items[0].weightLbs, 24);
});

test('legacy authority bundles still produce a useful read-only mission menu', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'legacy', runId: 'run', state: 'active', active: true, phase: 'active', revision: 1,
    resumeBundle: {
      missionState: {
        currentMissionData: {
          mission: 'Versorgungsflug', missionStory: 'Material zum Ziel bringen.', start: 'EDTW', dest: 'EDTL', targetName: 'Lahr'
        }
      },
      runtime: { runtime: { active: true, phase: 'active' }, poiProgress: { satisfied: false } }
    }
  }, { alt: 3500, flight: { gsKts: 95, onGround: false } });
  assert.equal(result.title, 'Versorgungsflug');
  assert.equal(result.view.target.name, 'Lahr');
  assert.equal(result.view.target.route, 'EDTW -> EDTL');
  assert.equal(result.view.flight.gsKts, 95);
});

test('tracker execution control overrides stale legacy phase and cargo presentation', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'apt-control', runId: 'run-control', state: 'active', active: true, phase: 'planned', revision: 3,
    resumeBundle: {
      missionState: { currentMissionData: { mission: 'APT Test', start: 'EDTW', dest: 'EDTL' } },
      runtime: {
        runtime: { active: false, phase: 'planned' },
        cargoManifest: { items: [{ id: 'box-one', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 12 }] }
      }
    }
  }, null, null, {
    missionId: 'apt-control',
    runId: 'run-control',
    executionAuthority: 'tracker',
    authorityRevision: 12,
    phase: 'end_unloading',
    nextStep: 'complete_unload',
    allowedActions: ['set_manifest_item'],
    flags: { active: true },
    voice: {
      boarding: {
        kind: 'boarding',
        status: 'ok',
        text: '<b>Die Kühlbox ist an Bord.</b>',
        speaker: { name: 'Loadmaster', role: 'Lademeister', gender: 'male' },
        playback: 'completed',
        updatedAt: 1234
      }
    },
    cargo: {
      signatureScope: 'arrival',
      items: [{ id: 'box-one', itemType: 'cargo', status: 'unloaded', required: true, pickup: 'departure', delivery: 'destination', weightLbs: 12 }],
      summary: { total: 2, requiredTotal: 2, loaded: 1, unloaded: 1, pending: 0, failed: false }
    }
  });
  assert.equal(result.phase, 'end_unloading');
  assert.equal(result.revision, 12);
  assert.equal(result.view.status, 'Mission aktiv');
  assert.equal(result.view.currentTask, 'Ladung am Ziel entladen');
  assert.equal(result.view.cargo.state, '1 geladen / 1 entladen');
  assert.equal(result.manifest.items[0].label, 'Kühlbox');
  assert.equal(result.manifest.items[0].status, 'unloaded');
  assert.equal(result.manifest.signatureScope, 'arrival');
  assert.equal(result.voice.text, 'Die Kühlbox ist an Bord.');
  assert.equal(result.voice.speaker.name, 'Loadmaster');
  assert.equal(result.voice.playback, 'completed');
  assert.equal(result.ui.schema, 'ga.mission-apt-ui.v1');
  assert.equal(result.ui.banner.kicker, 'Ladung entladen');
  assert.equal(result.ui.banner.button, 'Ausladen');
  assert.equal(result.ui.cargo.presentation, 'app-cargo-dialog-v1');
  assert.equal(result.ui.cargo.header.title, 'Verladung');
  assert.equal(result.ui.cargo.items[0].statusLabel, 'ausgeladen');
});

test('tracker execution projects the full authoritative manifest without rewriting item ids', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'apt-manifest', runId: 'run-manifest', state: 'active', active: true, phase: 'boarding', revision: 3,
    resumeBundle: {
      missionState: { currentMissionData: { mission: 'APT Manifest', start: 'EDTW', dest: 'EDTL' } },
      runtime: { cargoManifest: { items: [{ id: 'Box-ONE', label: 'Veraltete Bezeichnung', status: 'pending' }] } }
    }
  }, null, null, {
    missionId: 'apt-manifest',
    runId: 'run-manifest',
    executionAuthority: 'tracker',
    authorityRevision: 9,
    phase: 'boarding',
    nextStep: 'confirm_load',
    flags: { active: false },
    manifest: {
      dispatchSignature: { scope: 'departure', by: 'Pilot' },
      items: [{
        id: 'Box-ONE',
        storyName: 'Autoritative Kühlbox',
        itemType: 'cargo',
        status: 'loaded',
        required: true,
        deliverAtDestination: true,
        weightLbs: 12
      }]
    },
    cargo: {
      signatureScope: 'departure',
      items: [{ id: 'Box-ONE', itemType: 'cargo', status: 'loaded', required: true, pickup: 'departure', delivery: 'destination', weightLbs: 12 }],
      summary: { total: 1, requiredTotal: 1, loaded: 1, unloaded: 0, pending: 0, failed: false }
    }
  });
  assert.equal(result.manifest.items[0].id, 'Box-ONE');
  assert.equal(result.manifest.items[0].label, 'Autoritative Kühlbox');
  assert.equal(result.manifest.dispatchSignature.by, 'Pilot');
  assert.equal(result.ui.cargo.signature.name, 'Pilot');
  assert.equal(result.ui.cargo.actions.primary.label, 'Verladung abschließen');
});

test('cloud-pending tracker mission projects the activation task and original manifest', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'cloud-apt', runId: 'cloud-pending', state: 'cloud_ready', active: false, phase: 'planned', revision: 0,
    resumeBundle: {
      missionState: { currentMissionData: { missionId: 'cloud-apt', mission: 'Cloud APT', start: 'EDTW', dest: 'EDTL' } },
      runtime: {
        runtime: { active: false, phase: 'planned' },
        cargoManifest: { items: [{ id: 'box', storyName: 'Ersatzteil', itemType: 'cargo', required: true, status: 'pending', weightLbs: 18 }] }
      }
    }
  }, null, null, {
    missionId: 'cloud-apt',
    runId: 'cloud-pending',
    executionAuthority: 'tracker',
    authorityRevision: 0,
    phase: 'planned',
    nextStep: 'activate_cloud_mission',
    flags: { active: false },
    cargo: {
      items: [{ id: 'box', itemType: 'cargo', required: true, status: 'pending', pickup: 'departure', delivery: 'destination', weightLbs: 18 }],
      summary: { total: 1, requiredTotal: 1, loaded: 0, unloaded: 0, pending: 1 }
    }
  });
  assert.equal(result.view.currentTask, 'Mission aus der Cloud übernehmen und vorbereiten');
  assert.equal(result.manifest.items[0].label, 'Ersatzteil');
  assert.equal(result.manifest.items[0].status, 'pending');
});

test('mission view row and phase counts are capped', () => {
  const sanitized = sanitizeMissionView({
    phase: { current: 99, stages: Array.from({ length: 20 }, (_, index) => ({ label: `Phase ${index}` })) },
    progress: Array.from({ length: 30 }, (_, index) => ({ label: `P${index}`, percent: index }))
  });
  assert.equal(sanitized.phase.stages.length, 8);
  assert.equal(sanitized.phase.current, 7);
  assert.equal(sanitized.progress.length, 12);
});

test('German mission text keeps composed and decomposed umlauts', () => {
  const decomposed = 'U\u0308berprüfung für Öl, Straße und Kühlgerät';
  const sanitized = sanitizeMissionView({
    title: 'Überführungsflug',
    story: decomposed,
    currentTask: 'Zurückkehren und Mission abschließen'
  });
  assert.equal(sanitized.title, 'Überführungsflug');
  assert.equal(sanitized.story, decomposed);
  assert.equal(sanitized.currentTask, 'Zurückkehren und Mission abschließen');
});

test('projected reload action follows the App 200 m ground-item radius', () => {
  const activeRun = { resumeBundle: {} };
  const control = {
    manifest: {
      items: [{
        id: 'box', storyName: 'Kühlbox', status: 'unloaded', required: true,
        unloadLat: 48, unloadLon: 8, weightLbs: 12,
        payloadStations: [2, 4], payloadStationAdapter: 'pa24_accusim'
      }]
    },
    cargo: { items: [{ id: 'box', status: 'unloaded', required: true, itemType: 'cargo' }] }
  };
  const nearby = projectMissionManifest(activeRun, control, { lat: 48, lon: 8.001 });
  const far = projectMissionManifest(activeRun, control, { lat: 48, lon: 8.01 });
  assert.equal(nearby.items[0].reloadAllowed, true);
  assert.equal(nearby.items[0].station, 'Sitz 2 / Sitz 4');
  assert.ok(nearby.items[0].reloadDistanceM < 200);
  assert.equal(far.items[0].reloadAllowed, false);
  assert.ok(far.items[0].reloadDistanceM > 200);

  const legacyWithoutPosition = projectMissionManifest(activeRun, {
    manifest: { items: [{ id: 'legacy-box', status: 'unloaded', unloadLat: null, unloadLon: null }] },
    cargo: { items: [{ id: 'legacy-box', status: 'unloaded', itemType: 'cargo' }] }
  }, { lat: 48, lon: 8 });
  assert.equal(legacyWithoutPosition.items[0].reloadAllowed, true);
  assert.equal(legacyWithoutPosition.items[0].reloadDistanceM, null);
});

test('live tracker payload snapshot feeds the EFB App-style weight-and-balance block before confirmation', () => {
  const result = projectTrackerEfbMissionView({
    missionId: 'apt-wb', runId: 'run-wb', active: false, phase: 'boarding', revision: 2,
    resumeBundle: {
      missionState: { currentMissionData: { missionId: 'apt-wb', start: 'EDTW', dest: 'EDTL' } },
      runtime: { cargoManifest: { items: [] } }
    }
  }, null, null, {
    missionId: 'apt-wb', runId: 'run-wb', executionAuthority: 'tracker', authorityRevision: 2,
    phase: 'boarding', flags: { groundStill: true, boardingConfirmed: true },
    cargo: { items: [], summary: { departureMissing: 0 } },
    payload: {
      status: 'idle',
      plan: {
        paxWeightLbs: 180, cargoWeightLbs: 42, missionWeightLbs: 222,
        stations: [{ index: 2, baselineWeightLbs: 0, missionExtraLbs: 180, weightLbs: 180 }]
      }
    },
    allowedActions: []
  }, {
    payloadAdapter: 'msfs_payload_stations', totalWeightLbs: 2400, emptyWeightLbs: 1500,
    fuelWeightLbs: 300, payloadStationCount: 5, sampledStationCount: 5,
    stations: [{ index: 1, weightLbs: 170 }, { index: 2, weightLbs: 180 }]
  });
  assert.equal(result.ui.cargo.payload.summary.totalWeightLbs, 2400);
  assert.equal(result.ui.cargo.payload.summary.payloadStationCount, 5);
  assert.equal(result.ui.cargo.payload.summary.stations[0].weightLbs, 180);
});
