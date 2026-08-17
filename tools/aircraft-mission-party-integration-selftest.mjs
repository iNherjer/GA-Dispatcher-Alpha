#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const context = {
    Math,
    Number,
    String,
    Object,
    RegExp,
    normalizeMissionText: value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    _cleanupNarrativeArtifacts: value => String(value || '').replace(/\s+/g, ' ').trim()
};
vm.createContext(context);
for (const name of [
    'buildMissionPartyNarrativeContext',
    'synchronizeMissionPartyPresentation',
    'formatPaxBriefingText'
]) {
    vm.runInContext(functionSource(appSource, name), context, { filename: 'app.js' });
}

const party = { count: 3, kind: 'family', label: 'Sightseeing-Familie' };
const mission = {
    s: 'Mara freut sich auf den ruhigen Rundflug.',
    passenger: { name: 'Mara Stein', role: 'Ausflugsgast', gender: 'female' }
};
context.synchronizeMissionPartyPresentation(mission, party);
assert.deepEqual(JSON.parse(JSON.stringify(mission.passenger.party)), party);
assert.equal(mission.passenger.partyLead, true);
assert.match(mission.s, /Mara Stein reist als Hauptpassagierin/);
assert.match(mission.s, /Sightseeing-Familie/);
assert.match(mission.s, /insgesamt sind 3 Personen an Bord/);

const alignedStory = mission.s;
context.synchronizeMissionPartyPresentation(mission, party);
assert.equal(mission.s, alignedStory, 'party presentation must be idempotent');

const storyWithoutLead = {
    s: 'Die Sightseeing-Familie besteht aus 3 Personen und erwartet einen ruhigen Rundflug.',
    passenger: { name: 'Mara Stein', role: 'Ausflugsgast', gender: 'female' }
};
context.synchronizeMissionPartyPresentation(storyWithoutLead, party);
assert.match(storyWithoutLead.s, /Mara Stein reist als Hauptpassagierin/);
assert.equal(
    context.formatPaxBriefingText('3 PAX (Sightseeing-Familie)', mission.passenger, party),
    '3 PAX (Sightseeing-Familie · Hauptperson: Mara Stein)'
);

assert.match(appSource, /groupCapability:\s*missionTrackerSupportsGroupGeneration\(\)/);
assert.match(appSource, /passengerCount:\s*generatedMissionPartyPlan\?\.eligible\s*\?\s*preWriterPassengerPlan\.passengerCount/s);
assert.match(appSource, /party:\s*generatedMissionPartyPlan\?\.eligible\s*\?\s*preWriterPassengerPlan\.party/s);
assert.match(appSource, /missionContractV4\.party\s*=\s*finalPassengerPlan\.party/);
assert.match(appSource, /synchronizeMissionPartyPresentation\(m, finalPassengerPlan\.party\)/);
assert.match(cargoSource, /passengerCount:\s*paxCount/);
assert.match(syncSource, /expectedPassengerCount:\s*partyCount/);
assert.match(syncSource, /if \(!_trackerSupportsMissionSceneGroup\(\)\) return null/);

console.log('aircraft mission party integration selftest: ok');
