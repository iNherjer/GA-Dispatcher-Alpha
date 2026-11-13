// Etappe B: Live-Proben des Boden-Composers (Pax-Looks + Packstücke) für Charter,
// Sightseeing und Reporter mit ungewöhnlichen Anlässen. Ein Gemini-Abruf je Szenario,
// danach Rückflug-Prüfung ohne Abruf. Aufruf: node tools/ground-composer-live-probe.mjs --run
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ground = require('../mission-ground-visual-core.js');
const onboard = require('../mission-onboard-core.js');
const figures = require('../mission-person-figure-core.js');

if (process.argv[2] !== '--run') throw Error('Use --run');
const output = process.argv.find((x) => x.startsWith('--out='))?.slice(6) || 'analysis/ground-composer-live-20261113.json';
if (fs.existsSync(output) && !process.argv.includes('--resume')) throw Error('Output exists; do not repeat paid calls');
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
const report = process.argv.includes('--resume') ? JSON.parse(fs.readFileSync(output, 'utf8')) : { scope: 'Boden-Composer live, gemini-3-flash-preview, thinking low', requests: [], runs: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
const parse = (raw) => JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
async function json(prompt) {
  const prior = report.requests.find((x) => x.prompt === prompt && x.raw);
  if (prior) return parse(prior.raw);
  const entry = { prompt }; report.requests.push(entry); save();
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: 'application/json', maxOutputTokens: 4000, thinkingConfig: { thinkingLevel: 'low' } } }),
    signal: AbortSignal.timeout(60000)
  });
  entry.status = res.status; if (!res.ok) throw Error('HTTP ' + res.status);
  const body = await res.json();
  entry.raw = (body.candidates?.[0]?.content?.parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join(''); save();
  return parse(entry.raw);
}

const charter = (o) => ({ schema: 'charter-idea.v1', ...o });
const scenarios = [
  { name: 'Charter Hochzeit', taskDomain: 'charter', roleProfile: 'charter_professional_neutral_v1', idea: charter({
    reason: 'Hochzeit auf einem Weingut an der Mosel', background: 'Das Brautpaar wünscht Luftaufnahmen der Trauung', travelCharacter: 'festlich',
    arrival: 'Abholung durch die Hochzeitsplanerin', passengerCount: 2, groupLabel: 'Hochzeitsfotograf mit Assistentin',
    passenger: { name: 'Jonas Weber', role: 'Hochzeitsfotograf', gender: 'male' }, luggageLabel: 'Kameraausrüstung mit Drohne im Hartschalenkoffer', luggageWeightLbs: 28 }) },
  { name: 'Charter Firmenjubiläum', taskDomain: 'charter', roleProfile: 'charter_professional_neutral_v1', idea: charter({
    reason: '50 Jahre Maschinenbau Krämer', background: 'Die Geschäftsführung fliegt zur Jubiläumsfeier im Werk Nord', travelCharacter: 'repräsentativ',
    arrival: 'Empfang durch den Werksleiter am Vorfeld', passengerCount: 3, groupLabel: 'Geschäftsführerin mit zwei Prokuristen',
    passenger: { name: 'Dr. Sabine Krämer', role: 'Geschäftsführerin', gender: 'female' }, luggageLabel: 'Festschrift-Kartons und zwei Kleidersäcke', luggageWeightLbs: 46 }) },
  { name: 'Charter Trauerflug', taskDomain: 'charter', roleProfile: 'charter_private_neutral_v1', idea: charter({
    reason: 'Beisetzung des Vaters in seinem Heimatdorf', background: 'Die Familie reist zur Trauerfeier, die Stimmung ist still', travelCharacter: 'ruhig, gedrückt',
    arrival: 'Ein Cousin holt die Familie am Platz ab', passengerCount: 3, groupLabel: 'Witwe mit Sohn und Tochter',
    passenger: { name: 'Helga Brandt', role: 'Witwe', gender: 'female' }, luggageLabel: 'Kleine Reisetaschen für zwei Nächte', luggageWeightLbs: 34 }) },
  { name: 'Charter Junggesellenabschied', taskDomain: 'charter', roleProfile: 'charter_private_neutral_v1', idea: charter({
    reason: 'Junggesellenabschied mit Kanutour auf der Lahn', background: 'Fünf Freunde, gute Laune, Wochenende draußen', travelCharacter: 'ausgelassen',
    arrival: 'Der Kanuverleih wartet am Flugplatz', passengerCount: 5, groupLabel: 'Bräutigam mit vier Freunden',
    passenger: { name: 'Timo Lenz', role: 'Bräutigam', gender: 'male' }, luggageLabel: 'Rucksäcke, Zelt und eine Kühlbox', luggageWeightLbs: 88 }) },
  { name: 'Sightseeing Familienausflug', taskDomain: 'sightseeing', roleProfile: 'sightseeing_guest_v1', idea: { schema: 'sightseeing-idea.v1',
    theme: 'Burgen am Rhein von oben', summary: 'Geburtstagsgeschenk für Oma, die ganze Familie fliegt mit', groundPlan: 'Picknick am Flugplatz nach der Landung',
    passengerCount: 4, groupLabel: 'Großmutter mit Tochter und zwei Enkeln', passenger: { name: 'Erika Haas', role: 'Geburtstagskind', gender: 'female' },
    luggageLabel: 'Picknickkorb und Decken', luggageWeightLbs: 18 } },
  { name: 'Sightseeing Fotokurs Winter', taskDomain: 'sightseeing', roleProfile: 'sightseeing_guest_v1', idea: { schema: 'sightseeing-idea.v1',
    theme: 'Verschneite Hochmoore im Morgenlicht', summary: 'Ein Volkshochschul-Fotokurs bucht einen Fotoflug', groundPlan: 'Bildbesprechung im Flugplatzcafé',
    passengerCount: 3, groupLabel: 'Kursleiter mit zwei Teilnehmerinnen', passenger: { name: 'Rainer Ost', role: 'Kursleiter', gender: 'male' },
    luggageLabel: 'Fotorucksäcke und Stative', luggageWeightLbs: 30 } },
  { name: 'Reporter Hochwasser', taskDomain: 'news', roleProfile: 'reporter_field_v1', idea: { schema: 'apt-news-idea.v1',
    purpose: 'Luftbilder vom Hochwasser an der Ahr', background: 'Pegel steigen seit zwei Tagen', angle: 'Lage der Deiche',
    groundPlan: 'Interview mit dem Einsatzleiter am Platz', publication: 'Regionalfernsehen, Abendnachrichten',
    passenger: { name: 'Lea Sommer', role: 'TV-Reporterin', gender: 'female' },
    shipment: { label: 'Kamera, Akkus und Regenschutz', packaging: 'wetterfeste Rucksäcke', weightLbs: 24 } } },
  { name: 'Reporter Gala', taskDomain: 'news', roleProfile: 'reporter_field_v1', idea: { schema: 'apt-news-idea.v1',
    purpose: 'Bericht von der Opernball-Gala', background: 'Prominenz trifft am Flugplatz ein', angle: 'Ankunft der Gäste',
    groundPlan: 'Fotos am roten Teppich vor dem Hangar', publication: 'Gesellschaftsmagazin',
    passenger: { name: 'Marco Vitale', role: 'Society-Fotograf', gender: 'male' },
    shipment: { label: 'Blitzanlage und Objektive', packaging: 'Alukoffer', weightLbs: 32 } } }
];

for (const [index, s] of scenarios.entries()) {
  if (report.runs.find((r) => r.name === s.name && !r.error)) continue;
  console.log(`${index + 1}. ${s.name}`);
  const idea = JSON.parse(JSON.stringify(s.idea));
  const run = { name: s.name };
  try {
    const before = report.requests.length;
    const plan = await ground.ensure(idea, json, { taskDomain: s.taskDomain, roleProfile: s.roleProfile });
    run.calls = report.requests.length - before;
    run.raw = report.requests.at(-1)?.raw ? parse(report.requests.at(-1).raw) : null;
    run.passengers = plan.passengers.map((p) => ({ id: p.id, look: p.look, source: p.lookSource, ageBand: p.ageBand, gender: p.gender, note: p.note }));
    run.cargo = Object.fromEntries(Object.entries(plan.cargo).map(([id, c]) => [id, c.pieces.map((p) => `${p.form} ${p.weightLbs} lbs`)]));
    run.figures = ground.resolveFigures(plan, { season: 'summer', seed: s.name }).map((f) => f.title);
    // Rückflug: Anlass ändert sich, Personen bleiben → kein neuer Abruf, gleiche Looks.
    const back = { ...JSON.parse(JSON.stringify(idea)), reason: 'Rückflug', theme: 'Rückflug', purpose: 'Rückflug' };
    let backCalls = 0;
    const backPlan = await ground.ensure(back, async (p) => { backCalls += 1; return json(p); }, { taskDomain: s.taskDomain, roleProfile: s.roleProfile });
    run.returnFlight = { calls: backCalls, sameLooks: JSON.stringify(backPlan.passengers.map((p) => [p.look, p.gender])) === JSON.stringify(plan.passengers.map((p) => [p.look, p.gender])) };
  } catch (e) { run.error = String(e.message).replaceAll(apiKey, '[redacted]'); }
  report.runs.push(run); save();
  console.log('   ' + JSON.stringify({ looks: run.passengers?.map((p) => `${p.gender}/${p.look}/${p.ageBand}`), cargo: run.cargo, back: run.returnFlight, error: run.error }));
}
const md = ['# Boden-Composer Live-Proben 13.11.2026', '', 'gemini-3-flash-preview, thinking low; ein Abruf je Szenario; Rückflug ohne Abruf.', ''];
for (const r of report.runs) {
  md.push(`## ${r.name}`, '');
  if (r.error) { md.push(`Fehler: ${r.error}`, ''); continue; }
  for (const p of r.passengers) md.push(`- ${p.id}: **${p.look}** (${p.source}), ${p.gender}, ${p.ageBand || '–'} – ${p.note || ''}`);
  for (const [id, pieces] of Object.entries(r.cargo)) md.push(`- Gepäck ${id}: ${pieces.join(', ')}`);
  md.push(`- Figuren: ${r.figures.join(', ')}`, `- Rückflug: ${r.returnFlight.calls} Abrufe, Looks gleich: ${r.returnFlight.sameLooks}`, '');
}
fs.writeFileSync(output.replace(/\.json$/, '.md'), md.join('\n'));
