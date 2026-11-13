// Bio, Infrastruktur, Reporter-POI und Foto: Die Idee liefert das Geschlecht der Person,
// damit Stimme (_normSpeakerGender) und Boden-Figur übereinstimmen.
const { test } = require('node:test');
const assert = require('node:assert/strict');
for (const key of ['bio', 'infra', 'news', 'poi']) {
  test(`${key}: Ideen-Prompt verlangt gender`, () => {
    const core = require(`../mission-${key}-briefing-core.js`);
    const c = { id: 't', target: { name: 'Ziel', lat: 48, lon: 8 }, targetFacts: [], environmentFacts: [], limitations: [] };
    assert.match(core.ideaPrompt([core.frame(c, [])]), /gender/);
  });
}
