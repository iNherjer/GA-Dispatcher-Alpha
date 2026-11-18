// bush-idea.v1: idea from the Bush planner contract, writer rules, acceptance without prose rewrites.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../mission-bush-ideas-core.js');

const reportDir = path.join(__dirname, '..', 'analysis', 'bush-profile-personality-20261009');
const reportContract = profile => {
    const file = path.join(reportDir, `${profile}-composer-${profile === 'bush_pickup_strip' || profile === 'bush_charter_strip' || profile === 'bush_supply_strip' ? '20261113' : '20261114'}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).contract : null;
};
const syntheticContract = (profileId, extra = {}) => ({
    mode: 'bush', profile: { id: profileId }, target: { isPOI: false },
    storyFrame: { subjectDetail: 'Mark, USFS-Funktechniker', incidentContext: 'Relaiswartung abgeschlossen', whyNow: 'Akkus getauscht', soughtOutcome: 'Daten in McCall übergeben', focusSubject: 'Mark' },
    ...extra
});

// Switch: default on, only an explicit "off" returns to the old path.
const store = v => ({ getItem: () => v });
assert.equal(core.enabled(store(null)), true);
assert.equal(core.enabled(store('off')), false);
assert.equal(core.enabled(store('on')), true);
assert.equal(core.enabled({ getItem() { throw Error('blocked'); } }), true);

// All six Bush profiles accept a complete plan; others and incomplete plans do not.
for (const id of core.PROFILES) assert.equal(core.fromContract(syntheticContract(id)).profileId, id);
assert.equal(core.fromContract(syntheticContract('apt_charter')), null);
assert.equal(core.fromContract({ ...syntheticContract('bush_supply_strip'), mode: 'apt' }), null);
assert.equal(core.fromContract({ ...syntheticContract('bush_supply_strip'), target: { isPOI: true } }), null);
const incomplete = syntheticContract('bush_charter_strip'); delete incomplete.storyFrame.whyNow;
assert.equal(core.fromContract(incomplete), null, 'incomplete plan keeps the old path');
assert.equal(core.fromContract({ mode: 'bush', profile: { id: 'bush_supply_strip' }, missionPlan: { plan: { storyFrame: syntheticContract('x').storyFrame } } }).schema, 'bush-idea.v1');

// Real planner contracts from the stored live reports (Oct/Nov 2026) produce an idea.
for (const id of core.PROFILES) {
    const contract = reportContract(id);
    if (!contract) continue;
    const idea = core.fromContract(contract);
    assert.ok(idea, `${id}: stored planner contract yields an idea`);
    assert.ok(idea.storyFrame.subjectDetail.length > 10);
}

// Writer seed: no candidate-list person; a locked follow-up passenger stays.
const pickupIdea = core.fromContract(syntheticContract('bush_pickup_strip', { varietyHints: { passengerNameCandidates: [{ name: 'Elias Thorne', gender: 'male' }, { name: 'Sierra Lane', gender: 'female' }] } }));
assert.deepEqual(core.writerPassengerSeed(pickupIdea), {});
const lockedIdea = core.fromContract(syntheticContract('bush_pickup_strip', { followUpContext: { lockedPassenger: { name: 'Frank Miller', role: 'Trail-Crew-Leiter', gender: 'male' } } }));
assert.deepEqual(core.writerPassengerSeed(lockedIdea), { name: 'Frank Miller', role: 'Trail-Crew-Leiter', gender: 'male' });

// Writer rules: only the pickup profile gets the idea block, voice fields and name list.
const contractWithNames = { varietyHints: { passengerNameCandidates: [{ name: 'Elias Thorne', gender: 'male' }] } };
const pickupPrompt = core.writerPrompt(pickupIdea, contractWithNames);
assert.match(pickupPrompt, /BUSH_IDEA/);
assert.match(pickupPrompt, /passenger\.pickupStory/);
assert.match(pickupPrompt, /Elias Thorne/);
assert.doesNotMatch(core.writerPrompt(lockedIdea, contractWithNames), /NAME_CANDIDATES/, 'locked passenger gets no name list');
const supplyPrompt = core.writerPrompt(core.fromContract(syntheticContract('bush_supply_strip')), contractWithNames);
for (const id of core.PROFILES.filter(p => p !== 'bush_pickup_strip')) {
    assert.equal(core.writerPrompt(core.fromContract(syntheticContract(id)), contractWithNames), '', `${id}: writer prompt unchanged`);
}
assert.equal(supplyPrompt, '');
assert.equal(core.writerPrompt(null), '');

// Acceptance: pickup fields from the writer, person data unchanged, prose untouched.
const raw = { passenger: { pickupStory: { exactWhere: 'am Funkmast am Striprand', whyThere: 'Ich habe die Relais gewartet.', returnReason: 'Die Daten müssen nach McCall.', boardingCue: 'Alles verstaut, wir können.', departureCue: 'Ab nach Hause.' } } };
const mission = { s: 'Elias Thorne wartet am Striprand.', passenger: { name: 'Elias Thorne', role: 'USFS-Funktechniker', greetingText: 'Hallo!' } };
core.accept(mission, raw, pickupIdea);
assert.equal(mission.s, 'Elias Thorne wartet am Striprand.');
assert.equal(mission.passenger.greetingText, 'Hallo!');
assert.equal(mission.passenger.pickupStory.personName, 'Elias Thorne');
assert.equal(mission.passenger.pickupStory.role, 'USFS-Funktechniker');
assert.equal(mission.passenger.pickupStory.exactWhere, 'am Funkmast am Striprand');
assert.ok(core.owns(mission));
assert.deepEqual(mission._missionWriterV4Debug.bushIdea.diagnostics, []);

const missing = { s: 'Jemand wartet.', passenger: { name: 'Elias Thorne', role: 'Techniker' } };
core.accept(missing, { passenger: { pickupStory: { exactWhere: 'x' } } }, pickupIdea);
assert.equal(missing.passenger.pickupStory, undefined, 'incomplete fields are not half-applied');
assert.deepEqual(missing._missionWriterV4Debug.bushIdea.diagnostics, ['pickup_story_fields_missing', 'passenger_name_not_in_story']);

const lockedMission = { s: 'Paul kommt.', passenger: { name: 'Paul', role: 'x' } };
core.accept(lockedMission, {}, lockedIdea);
assert.ok(lockedMission._missionWriterV4Debug.bushIdea.diagnostics.includes('locked_passenger_changed'));

const supplyMission = { s: 'Ben wartet auf die Kanister.', passenger: null, cargo: 'Treibstoffkanister (118 lbs)' };
core.accept(supplyMission, {}, core.fromContract(syntheticContract('bush_supply_strip')));
assert.equal(supplyMission.s, 'Ben wartet auf die Kanister.');
assert.equal(supplyMission.cargo, 'Treibstoffkanister (118 lbs)');
assert.equal(supplyMission.bushIdea.profileId, 'bush_supply_strip');

console.log('mission-bush-ideas test passed');
