// Live-Probe je Missionsstrang: Liefert die Stufe, die Personen und Gepäck festlegt (Idee bzw.
// Writer), die Daten sauber strukturiert – und wählt der Boden-Composer darauf passende Looks
// und Packstücke? Aufruf: node tools/ground-composer-strand-probe.mjs --run --strand=club
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ground = require('../mission-ground-visual-core.js');
const onboard = require('../mission-onboard-core.js');
const visual = require('../mission-cargo-visual-core.js');

if (process.argv[2] !== '--run') throw Error('Use --run');
const strand = process.argv.find((x) => x.startsWith('--strand='))?.slice(9) || 'club';
const output = process.argv.find((x) => x.startsWith('--out='))?.slice(6) || `analysis/ground-composer-${strand}-20261113.json`;
if (fs.existsSync(output)) throw Error('Output exists; do not repeat paid calls');
function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const file of ['key.env.local', '.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
    const line = lines.find((x) => /^GEMINI_API_KEY\s*=/.test(x));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (lines.length === 1 && !lines[0].includes('=')) return lines[0];
  }
  throw Error('Kein lokaler Gemini-Key');
}
const apiKey = key();
const report = { strand, scope: 'Produktive Prompts/Validatoren, gemini-3-flash-preview, thinking low', requests: [], runs: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
const parse = (raw) => JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
async function json(prompt, stage) {
  const entry = { stage, prompt }; report.requests.push(entry); save();
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: 'application/json', maxOutputTokens: 8000, thinkingConfig: { thinkingLevel: 'low' } } }),
    signal: AbortSignal.timeout(90000)
  });
  entry.status = res.status; if (!res.ok) throw Error('HTTP ' + res.status);
  const body = await res.json();
  entry.raw = (body.candidates?.[0]?.content?.parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join(''); save();
  return parse(entry.raw);
}

const airports = JSON.parse(fs.readFileSync('airports.json', 'utf8'));
const apt = (icao) => ({ name: airports[icao].n || icao, icao, lat: airports[icao].lat, lon: airports[icao].lon });

// Je Strang: Ideen erzeugen und prüfen → Liste von { idea, taskDomain, roleProfile, check }.
const STRANDS = {
  async club() {
    const core = require('../mission-club-ideas-core.js');
    const frames = ['EDSH', 'EDTF', 'EDTH'].map((icao, i) => ({ candidateId: 'club-' + i, ...core.frame({ start: apt('EDTW'), target: apt(icao) }, [], null, '2026-11-14') }));
    const batch = await json(core.ideaPrompt(frames), 'club-ideas');
    return frames.map((input) => {
      const raw = (batch.ideas || []).find((x) => x.candidateId === input.candidateId);
      const idea = core.validate(raw, input);
      return { name: input.candidateId + ' → ' + input.route.target.icao, idea, taskDomain: 'club_utility', roleProfile: 'club_utility_v1',
        check: idea ? { passenger: idea.passenger && { role: idea.passenger.role, gender: idea.passenger.gender }, luggage: idea.luggage, delivery: idea.delivery } : { invalid: raw || 'fehlt' } };
    });
  }
};
if (!STRANDS[strand]) throw Error('Unbekannter Strang ' + strand);

try {
  const cases = await STRANDS[strand]();
  for (const c of cases) {
    const run = { name: c.name, source: c.check };
    console.log(c.name, JSON.stringify(c.check));
    if (!c.idea) { run.error = 'Idee ungültig'; report.runs.push(run); save(); continue; }
    const board = onboard.fromIdea(c.idea);
    run.onboard = board && { passengers: board.passengers.map((p) => `${p.role}/${p.gender}`), cargo: board.cargo.map((x) => `${x.id} ${x.description} ${x.weightLbs} lbs (${x.owner})`) };
    const plan = await ground.ensure(c.idea, (p) => json(p, 'composer'), { taskDomain: c.taskDomain, roleProfile: c.roleProfile });
    run.aiLooks = !!plan?.aiLooks;
    run.passengers = (plan?.passengers || []).map((p) => ({ look: p.look, source: p.lookSource, gender: p.gender, ageBand: p.ageBand, note: p.note }));
    run.cargo = Object.fromEntries(Object.entries(plan?.cargo || {}).map(([id, x]) => [id, `${x.sourceLabel}: ` + x.pieces.map((p) => `${p.form} ${p.weightLbs} lbs`).join(', ')]));
    run.figures = ground.resolveFigures(plan, { season: 'winter', seed: c.name }).map((f) => f.title);
    run.manifestMainMatches = !!(c.idea.cargoVisual && visual.planMatches(c.idea.cargoVisual, visual.postFromIdea(c.idea)?.description, visual.postFromIdea(c.idea)?.weightLbs));
    console.log('  ', JSON.stringify({ pax: run.passengers.map((p) => `${p.gender}/${p.look}/${p.ageBand}`), cargo: run.cargo, figures: run.figures }));
    report.runs.push(run); save();
  }
} catch (error) { report.error = String(error.message).replaceAll(apiKey, '[redacted]'); save(); throw Error(report.error); }

const md = [`# Boden-Composer Strang-Probe: ${strand}`, '', report.scope, ''];
for (const r of report.runs) {
  md.push(`## ${r.name}`, '', '- Quelle: `' + JSON.stringify(r.source) + '`');
  if (r.error) { md.push(`- Fehler: ${r.error}`, ''); continue; }
  md.push(`- Bordliste: ${r.onboard.passengers.join(', ') || 'keine Personen'}; ${r.onboard.cargo.join('; ') || 'kein Gepäck'}`);
  for (const p of r.passengers) md.push(`- Look: **${p.look}** (${p.source}), ${p.gender}, ${p.ageBand || '–'} – ${p.note || ''}`);
  for (const [id, line] of Object.entries(r.cargo)) md.push(`- Packstücke ${id}: ${line}`);
  md.push(`- Figuren: ${r.figures.join(', ') || '–'}`, `- KI-Looks: ${r.aiLooks}, Hauptposten passt zur Ladeliste: ${r.manifestMainMatches}`, '');
}
fs.writeFileSync(output.replace(/\.json$/, '.md'), md.join('\n'));
