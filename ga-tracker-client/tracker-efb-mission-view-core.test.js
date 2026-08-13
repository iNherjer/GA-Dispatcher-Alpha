'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MISSION_VIEW_SCHEMA,
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
