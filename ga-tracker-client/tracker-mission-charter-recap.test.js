'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const core = require('../mission-charter-continuation-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createCharterRecapWorker, parseJson } = require('./tracker-mission-charter-recap.js');
const { mergeRequests, needsRecap } = require('./tracker-mission-followup.js');

const now = Date.now();
const A = { icao: 'EDTW', name: 'Winzeln', lat: 48.27, lon: 8.42 }, B = { icao: 'EDTE', name: 'Eutingen', lat: 48.48, lon: 8.77 };
const idea = { schema: 'charter-idea.v1', reason: 'Eine Gruppe reist zum persönlichen Austausch.', background: 'Der gemeinsame Aufenthalt bietet Zeit für die geplante Zusammenarbeit.',
  arrival: 'Die Gruppe setzt ihre Reise nach der Ankunft zusammen fort.', passengerCount: 3, groupLabel: 'Reisegruppe',
  passenger: { name: 'Ada', role: 'Auftraggeberin', gender: 'female', personality: 'Offen und zugewandt' }, luggageLabel: 'Reisetaschen', luggageWeightLbs: 42,
  memory: 'Eine gemeinsame Reise mit persönlichen Gesprächen.', geoAnchors: [], narrativeEvents: [], route: { start: A, target: B },
  returnPlan: { offered: true, reason: 'Die Gruppe hat auch die gemeinsame Rückreise gebucht.', stayHours: 2, stayText: 'Zwei Stunden Aufenthalt' } };
const md = { missionId: 'charter-one', mission: 'Reise', charterIdea: idea, passenger: { ...idea.passenger, narrativeSchema: idea.schema }, departureAirport: A, destinationAirport: B };
const draft = { experience: 'Die Gruppe hat ihren geplanten Aufenthalt gemeinsam verbracht und sich ausgetauscht.',
  reason: 'Nach dem gemeinsamen Aufenthalt ist die Gruppe bereit für die gebuchte Rückreise.',
  nextStep: 'Nach der Ankunft fahren die Reisenden gemeinsam zu ihrem ursprünglichen Ausgangspunkt.',
  memory: 'Der Rückblick knüpft an die Zusammenarbeit und die persönlichen Gespräche an.',
  narrativeEvents: [{ atPercent: 65, intent: 'Ein persönliches Detail aus dem gespeicherten Aufenthalt erzählen.' }],
  offerText: 'Ada und ihre Gruppe haben in Eutingen bis zuletzt diskutiert und bitten jetzt um den Rückflug nach Winzeln.' };

function gemini(answers) {
  const calls = [];
  const fetchRemote = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const text = answers.length > 1 ? answers.shift() : answers[0];
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
  };
  return { fetchRemote, calls };
}

function closedCharterManager(t, extra = { followupRecapEnabled: true }, phase = 'closed') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'charter-recap-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let clock = now;
  const options = { storageFile: path.join(dir, 'authority.json'), executionAuthorityEnabled: true, now: () => clock, ...extra };
  let manager = createMissionAuthorityManager(options);
  manager.acquire({ missionId: md.missionId, clientId: 'app', resumeBundle: { missionState: { currentMissionData: md } } });
  const stored = JSON.parse(fs.readFileSync(options.storageFile, 'utf8'));
  stored.activeRun.executionAuthority = 'tracker';
  stored.activeRun.executionState = { phase, flags: { closed: phase === 'closed', groundStill: true }, effects: [], manifest: { items: [] } };
  stored.activeRun.executionRuntimeContext = { schema: 'ga.mission-runtime-context.v1', version: 1, missionId: md.missionId, runId: stored.activeRun.runId,
    missionFlightRecord: { createdAt: now, durationSec: 600, telemetrySampleCount: 100, distanceNm: 20, distanceSource: 'gps' }, latestDestination: { atDestination: true } };
  fs.writeFileSync(options.storageFile, JSON.stringify(stored));
  manager = createMissionAuthorityManager(options);
  const close = () => {
    const current = JSON.parse(fs.readFileSync(options.storageFile, 'utf8'));
    current.activeRun.executionState = { ...current.activeRun.executionState, phase: 'closed', flags: { closed: true, groundStill: true } };
    fs.writeFileSync(options.storageFile, JSON.stringify(current));
    return createMissionAuthorityManager(options);
  };
  return { manager, file: options.storageFile, close, reload: () => createMissionAuthorityManager(options), advance: ms => { clock += ms; } };
}

test('card text: written retrospective wins, otherwise the neutral stay-is-over text; old drafts stay valid', () => {
  const req = core.request(md, { missionId: md.missionId, completionId: 'done', endedAt: now, result: 'completed', privateOutingEvidence: { flown: true, atTarget: true, groundStill: true } }, now);
  const c = core.context(req);
  assert.equal(core.offerPreview(c), 'Ada und die Mitreisenden haben ihren Aufenthalt in Eutingen hinter sich und bitten um den Rückflug nach Winzeln.');
  assert.doesNotMatch(req.ui.previewText, /persönlichen Austausch/);
  assert.equal(core.offerPreview({ ...c, experience: draft }), draft.offerText);
  const { offerText, ...older } = draft;
  assert.ok(core.validateDraft(older, c));
  assert.equal(core.offerPreview({ ...c, experience: older }), core.offerPreview(c));
  assert.ok(needsRecap(req));
  assert.equal(needsRecap({ ...req, charterContinuation: { ...c, experience: draft } }), false);
});

test('landing queues the retrospective; the tracker writes it and the cloud merge keeps it on the pending offer', async t => {
  const { manager, reload } = closedCharterManager(t);
  assert.equal(manager.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  const [offer] = manager.getFollowupOutbox('PILOT');
  assert.equal(offer.requests[0].followUpKind, 'apt_charter_pickup');
  assert.equal(manager.nextFollowupRecap('OTHER'), null);
  // The queue survives a tracker restart.
  const restarted = reload();
  assert.equal(restarted.nextFollowupRecap('PILOT').id, offer.requests[0].id);

  const ai = gemini([`\`\`\`json\n${JSON.stringify(draft)}\n\`\`\``]);
  const worker = createCharterRecapWorker({ authorityManager: restarted, pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: ai.fetchRemote });
  assert.equal((await worker.tick()).status, 'written');
  assert.equal(ai.calls.length, 1);
  assert.match(ai.calls[0].body.contents[0].parts[0].text, /offerText ist der kurze/);
  assert.equal(restarted.nextFollowupRecap('PILOT'), null);
  assert.equal((await worker.tick()).status, 'idle');

  const outbox = restarted.getFollowupOutbox('PILOT');
  assert.deepEqual(outbox.map(entry => entry.id), [offer.id, `recap:${offer.requests[0].id}`]);
  // Cloud already holds the plain offer (first flush); the later recap entry merges into it.
  const cloud = mergeRequests([], offer.requests, now);
  const merged = mergeRequests(cloud, outbox[1].requests, now + 1000);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].charterContinuation.experience.offerText, draft.offerText);
  assert.equal(core.offerPreview(core.context(merged[0])), draft.offerText);
  // A dismissed offer stays dismissed.
  assert.equal(mergeRequests([{ ...cloud[0], status: 'dismissed', updatedAt: now + 500 }], outbox[1].requests, now + 1000)[0].status, 'dismissed');
});

test('failed writing backs off, gives up after three attempts and never blocks the offer', async t => {
  const { manager, advance } = closedCharterManager(t);
  assert.equal(manager.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  const ai = gemini(['{"experience":"zu kurz"}']);
  const worker = createCharterRecapWorker({ authorityManager: manager, pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: ai.fetchRemote });
  assert.equal((await worker.tick()).status, 'failed');
  assert.equal(ai.calls.length, 2, 'one structural correction like in the App');
  assert.equal((await worker.tick()).status, 'idle', 'backoff before the next attempt');
  advance(10 * 60000); assert.equal((await worker.tick()).status, 'failed');
  advance(60 * 60000); assert.equal((await worker.tick()).status, 'failed');
  assert.equal(manager.nextFollowupRecap('PILOT'), null);
  advance(24 * 3600000); assert.equal((await worker.tick()).status, 'idle');
  assert.equal(manager.getFollowupOutbox('PILOT').length, 1, 'plain offer remains');
});

test('without a voice key the worker stays off', async () => {
  const worker = createCharterRecapWorker({ authorityManager: {}, pilotId: 'PILOT', provider: 'gemini', apiKey: '' });
  assert.equal(worker.configured, false);
  assert.equal((await worker.tick()).status, 'unconfigured');
  assert.deepEqual(parseJson('Antwort: {"a":1} Ende'), { a: 1 });
});

// In the tracker the authority core runs in the mission worker: every call returns a Promise.
function viaIpc(manager) {
  const proxy = {};
  for (const [name, fn] of Object.entries(manager)) if (typeof fn === 'function') proxy[name] = async (...args) => JSON.parse(JSON.stringify(fn(...args) ?? null));
  return proxy;
}

test('worker awaits the out-of-process authority core', async t => {
  const { manager } = closedCharterManager(t);
  assert.equal(manager.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  const ai = gemini([JSON.stringify(draft)]);
  const worker = createCharterRecapWorker({ authorityManager: viaIpc(manager), pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: ai.fetchRemote });
  assert.equal((await worker.tick()).status, 'written');
  assert.equal(manager.getFollowupOutbox('PILOT').length, 2);
  assert.equal((await worker.tick()).status, 'idle');
});

test('no voice key: nothing is queued; full outbox keeps the job queued', async t => {
  const off = closedCharterManager(t, {});
  assert.equal(off.manager.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  assert.equal(off.manager.nextFollowupRecap('PILOT'), null);
  const { manager, file, reload } = closedCharterManager(t);
  assert.equal(manager.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  const item = manager.nextFollowupRecap('PILOT');
  assert.ok(item);
  // Fill the outbox through the stored state, as a long offline phase would.
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  stored.followupOutbox.push(...Array.from({ length: 63 }, (_, i) => ({ id: `x${i}`, pilotId: 'PILOT', createdAt: now, requests: [] })));
  fs.writeFileSync(file, JSON.stringify(stored));
  const full = reload();
  assert.equal(full.completeFollowupRecap(item.id, 'PILOT', draft), false);
  assert.equal(full.nextFollowupRecap('PILOT').id, item.id);
  full.acknowledgeFollowupOutbox('x0', 'PILOT');
  assert.equal(full.completeFollowupRecap(item.id, 'PILOT', draft), true);
  assert.equal(full.nextFollowupRecap('PILOT'), null);
});

test('deboarding: written before close, the offer leaves the tracker with its retrospective already attached', async t => {
  const { manager, close } = closedCharterManager(t, { followupRecapEnabled: true }, 'end_unloading');
  const ai = gemini([JSON.stringify(draft)]);
  const worker = createCharterRecapWorker({ authorityManager: viaIpc(manager), pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: ai.fetchRemote });
  assert.equal((await worker.tick()).status, 'written');
  assert.equal((await worker.tick()).status, 'idle', 'one job per landing');
  assert.equal(ai.calls.length, 1);
  assert.deepEqual(manager.getFollowupOutbox('PILOT'), [], 'no offer before close');
  const closed = close();
  assert.equal(closed.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  const outbox = closed.getFollowupOutbox('PILOT');
  assert.equal(outbox.length, 1, 'no addendum needed');
  assert.equal(outbox[0].requests[0].charterContinuation.experience.offerText, draft.offerText);
  assert.equal(closed.nextFollowupRecap('PILOT'), null);
});

test('deboarding: close while still writing turns the job into an addendum for the real offer', async t => {
  const { manager, close } = closedCharterManager(t, { followupRecapEnabled: true }, 'end_unloading');
  assert.equal(manager.prepareFollowupRecap('PILOT'), true);
  assert.equal(manager.prepareFollowupRecap('PILOT'), false, 'queued once');
  const job = manager.nextFollowupRecap('PILOT');
  assert.equal(job.provisional, true);
  const closed = close();
  assert.equal(closed.finalizeExecutionRun({ pilotId: 'PILOT' }).ok, true);
  assert.equal(closed.getFollowupOutbox('PILOT')[0].requests[0].charterContinuation.experience, null);
  assert.equal(closed.nextFollowupRecap('PILOT').provisional, false);
  assert.equal(closed.completeFollowupRecap(job.id, 'PILOT', draft), true);
  const outbox = closed.getFollowupOutbox('PILOT');
  assert.equal(outbox.length, 2);
  assert.equal(outbox[1].requests[0].charterContinuation.experience.offerText, draft.offerText);
  assert.equal(outbox[1].requests[0].charterContinuation.sourceCompletionId, outbox[0].requests[0].charterContinuation.sourceCompletionId, 'real offer, not the preview');
});

test('no prewrite before standing at the target or without voice key', t => {
  assert.equal(closedCharterManager(t, { followupRecapEnabled: true }, 'enroute').manager.prepareFollowupRecap('PILOT'), false);
  assert.equal(closedCharterManager(t, {}, 'end_unloading').manager.prepareFollowupRecap('PILOT'), false);
});

test('touchdown: starts with the farewell prewarm and passes the farewell words as heard speech', async t => {
  const { manager } = closedCharterManager(t, { followupRecapEnabled: true }, 'enroute');
  const ai = gemini([JSON.stringify(draft)]);
  const worker = createCharterRecapWorker({ authorityManager: viaIpc(manager), pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: ai.fetchRemote });
  let polls = 0;
  const farewell = 'Danke fürs Mitnehmen, ich gehe jetzt gleich als Erstes in den Dom.';
  assert.equal(await worker.onTouchdown({ getFarewellText: () => (++polls < 3 ? '' : farewell), pollMs: 1 }), true);
  assert.equal(polls, 3, 'waits briefly for the generated farewell text');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(ai.calls.length, 1);
  const prompt = ai.calls[0].body.contents[0].parts[0].text;
  assert.ok(prompt.includes('gleich als Erstes in den Dom'), 'farewell is continuity data for the stay');
  assert.equal(await worker.onTouchdown({ getFarewellText: () => farewell, pollMs: 1 }), false, 'only once per landing');
});

test('touchdown: no farewell text within the wait still starts the retrospective', async t => {
  const { manager } = closedCharterManager(t, { followupRecapEnabled: true }, 'enroute');
  const worker = createCharterRecapWorker({ authorityManager: manager, pilotId: 'PILOT', provider: 'gemini', apiKey: 'test-key', fetchRemote: gemini([JSON.stringify(draft)]).fetchRemote });
  assert.equal(await worker.onTouchdown({ getFarewellText: () => '', farewellWaitMs: 3, pollMs: 1 }), true);
  assert.equal(closedCharterManager(t, { followupRecapEnabled: true }, 'boarding').manager.prepareFollowupRecap('PILOT', { touchdown: true }), false, 'no touchdown before departure');
});
