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
  },
  // Medizin: Idee legt Fachperson/Kurier fest, beim Patiententransfer zusätzlich den Patienten.
  async medical() {
    const core = require('../mission-medical-transfer-ideas-core.js');
    const aircraft = { name: 'PA-24 Comanche', maxPayloadKg: 380, passengerCapacity: 3, patientTransferEnabled: true };
    const frames = ['EDSH', 'EDTF', 'EDTH', 'EDTQ'].filter((icao) => airports[icao]).slice(0, 3)
      .map((icao, i) => ({ candidateId: 'med-' + i, ...core.frame({ start: apt('EDTW'), target: apt(icao) }, aircraft, []) }));
    const batch = await json(core.ideaPrompt(frames), 'medical-ideas');
    return frames.map((input) => {
      const raw = (batch.ideas || []).find((x) => x.candidateId === input.candidateId);
      const idea = core.validate(raw, input);
      return { name: input.candidateId + ' ' + (idea?.transportKind || '?'), idea, taskDomain: 'medical_transfer', roleProfile: 'medical_sensitive_v1',
        check: idea ? { kind: idea.transportKind, passenger: { role: idea.passenger.role, gender: idea.passenger.gender }, patient: idea.patient, shipment: idea.shipment.label } : { invalid: raw || 'fehlt' } };
    });
  },
  // POI-Aufträge mit einer Person aus der Idee (Bio, Infrastruktur, Reporter-POI, Foto):
  // eine Idee je Strang, Person läuft wie in der App über die allgemeine Composer-Quelle.
  async poi() {
    const composer = require('../mission-ground-composer-browser.js');
    const defs = [
      { key: 'bio', file: '../mission-bio-briefing-core.js', taskDomain: 'science_bio', roleProfile: 'science_field_v1', cargo: ['Kamera, Feldnotizen und Tablet', 18],
        target: { name: 'Wollmatinger Ried', lat: 47.6936, lon: 9.1361 }, category: 'nature' },
      { key: 'infra', file: '../mission-infra-briefing-core.js', taskDomain: 'inspection_infra', roleProfile: 'technical_inspector_v1', cargo: ['Inspektionskamera und Tablet', 26],
        target: { name: 'Sommerbergtunnel', lat: 48.28977, lon: 8.17377 }, category: 'road' },
      { key: 'news', file: '../mission-news-briefing-core.js', taskDomain: 'news_coverage', roleProfile: 'news_reporter_professional_v1', cargo: ['Kamera- und Audio-Set', 32],
        target: { name: 'Schluchsee-Staumauer', lat: 47.8183, lon: 8.1586 }, category: 'dam' },
      { key: 'photo', file: '../mission-poi-briefing-core.js', taskDomain: 'media_photo', roleProfile: 'media_observer_v1', cargo: ['Foto-/Videoausrüstung', 12],
        target: { name: 'Burg Hohenzollern', lat: 48.3233, lon: 8.9675 }, category: 'castle' }
    ];
    const out = [];
    for (const d of defs) {
      const core = require(d.file);
      const c = { id: 'poi-' + d.key, target: { ...d.target, poiCategory: d.category }, targetCategory: d.category, targetFacts: [], environmentFacts: [], limitations: [] };
      let idea = null, error = '';
      try { idea = core.readIdea(await json(core.ideaPrompt([core.frame(c, [])]), d.key + '-idea'), c); } catch (e) { error = String(e.message || e); }
      const person = idea?.person || null;
      globalThis._missionCargoGenerateManifest = () => ({ items: [{ id: 'primary-cargo', label: d.cargo[0], weightLbs: d.cargo[1] }] });
      globalThis._missionCargoPassengerCount = () => 1;
      const src = person ? composer.source({ missionTitle: d.target.name, missionStory: idea.situation || '',
        passenger: { ...person, taskDomain: d.taskDomain, roleProfile: d.roleProfile } }) : null;
      out.push({ name: d.key + ' → ' + d.target.name, idea: src, taskDomain: d.taskDomain, roleProfile: d.roleProfile,
        check: person ? { name: person.name, role: person.role, gender: person.gender || 'FEHLT' } : { invalid: error || 'fehlt' } });
    }
    return out;
  },
  // Fracht, zerbrechliche Fracht, Tiertransport: je zwei Ideen aus dem produktiven Ideen-Prompt.
  async freight() {
    const aircraft = { name: 'PA-24 Comanche', maxPayloadKg: 380, passengerCapacity: 3 };
    const defs = [
      ['cargo', '../mission-cargo-ideas-core.js', 'cargo', ''],
      ['fragile', '../mission-fragile-cargo-ideas-core.js', 'cargo_fragile', 'cargo_fragile_highcare_v1'],
      ['animal', '../mission-animal-transport-ideas-core.js', 'animal_transport', 'general_passenger_v1']
    ];
    const out = [];
    for (const [key, file, taskDomain, roleProfile] of defs) {
      const core = require(file);
      const frames = ['EDSH', 'EDTF'].map((icao, i) => ({ candidateId: key + '-' + i, ...core.frame({ start: apt('EDTW'), target: apt(icao) }, aircraft, []) }));
      let batch = {};
      try { batch = await json(core.ideaPrompt(frames), key + '-ideas'); } catch (e) { batch = { error: String(e.message || e) }; }
      for (const input of frames) {
        const raw = (batch.ideas || []).find((x) => x.candidateId === input.candidateId);
        const idea = raw ? core.validate(raw, input) : null;
        out.push({ name: input.candidateId, idea, taskDomain, roleProfile,
          check: idea ? { passenger: idea.passenger ? { role: idea.passenger.role, gender: idea.passenger.gender } : null,
            shipment: { label: idea.shipment.label, packaging: idea.shipment.packaging, weightLbs: idea.shipment.weightLbs } } : { invalid: batch.error || raw || 'fehlt' } });
      }
    }
    return out;
  },
  // Training: Fluglehrer aus der festen Personenliste, Gepäck aus TRAINING_CARGO_ITEMS (app.js).
  // Kein Writer entscheidet Personen → allgemeine Quelle (mission-ground-composer-browser.js).
  async training() {
    const vm = await import('node:vm');
    const app = fs.readFileSync('app.js', 'utf8');
    const grab = (name) => { const start = app.indexOf(`const ${name} = [`); const end = app.indexOf('\n];', start); return vm.runInNewContext(app.slice(start + `const ${name} = `.length, end + 3)); };
    const personas = grab('INSTRUCTOR_PERSONA_LIBRARY'), items = grab('TRAINING_CARGO_ITEMS');
    const composer = require('../mission-ground-composer-browser.js');
    return personas.slice(0, 3).map((persona, i) => {
      const cargoText = items[i % items.length];
      const label = cargoText.replace(/\s*\((\d+)\s*lbs\)\s*$/, ''), weightLbs = Number(cargoText.match(/\((\d+)\s*lbs\)/)?.[1]);
      globalThis._missionCargoGenerateManifest = () => ({ items: [{ id: 'primary-cargo', label, weightLbs }] });
      globalThis._missionCargoPassengerCount = () => 1;
      const md = { missionTitle: 'Trainingsflug nach Zielplatz', missionStory: persona.storySeed.replaceAll('{name}', persona.name),
        passenger: { ...persona, roleProfile: 'instructor_calm_precise_v1', taskDomain: 'training' } };
      const idea = composer.source(md);
      return { name: `${persona.role} ${persona.name}`, idea, taskDomain: 'training', roleProfile: 'instructor_calm_precise_v1',
        check: idea && { lead: idea.lead, passengerCount: idea.passengerCount, cargo: idea.cargoPost } };
    });
  },
  // Bush: Personen legt der echte V4-Writer fest (passenger.gender). Grundlage sind die Live-Läufe
  // von tools/bush-profile-personality-live.mjs --run=composer-20261113; die Pickup-Übernahme der
  // Writer-Person (app.js, Dispatch) und die Ladeliste (Pickup-Gepäck aus bush.pickupCargoLabel)
  // werden hier nachgebildet → allgemeine Quelle (mission-ground-composer-browser.js).
  async bush(profiles = ['bush_pickup_strip', 'bush_charter_strip', 'bush_supply_strip'], run = 'composer-20261113') {
    const composer = require('../mission-ground-composer-browser.js');
    return profiles.map((profile) => {
      const r = JSON.parse(fs.readFileSync(`analysis/bush-profile-personality-20261009/${profile}-${run}.json`, 'utf8'));
      const m = r.mission, pax = m.passenger || null;
      const pickup = m.bush?.targetMode === 'strip_then_return' && m.bush?.pickupKind === 'passenger';
      const ideas = r.contract?.pickupCreativeBrief?.candidateShortlist?.[0]?.objectIdeas || [];
      const bush = pickup ? { ...m.bush, pickupRole: pax?.role || m.bush.pickupRole, pickupLabel: pax ? `${pax.name} (${pax.role})` : m.bush.pickupLabel,
        pickupCargoLabel: ideas.slice(0, 3).map(String).filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' und $1') || m.bush.pickupCargoLabel || 'Persönliche Ausrüstung und Unterlagen' } : m.bush;
      const cargoMatch = String(m.cargo || '').match(/^(.*?)\s*\((\d+)\s*lbs\)\s*$/);
      const cargoPickup = m.bush?.targetMode === 'strip_then_return' && m.bush?.pickupKind === 'cargo';
      const item = pickup ? { id: 'pickup-companion-cargo', label: bush.pickupCargoLabel, weightLbs: Number(bush.pickupCargoWeightLbs) || 18 }
        : cargoPickup ? { id: 'pickup-cargo', label: m.bush.pickupLabel, weightLbs: Number(String(m.bush.pickupLabel).match(/\((\d+)\s*lbs\)/)?.[1]) || 42 }
        : cargoMatch ? { id: 'primary-cargo', label: cargoMatch[1], weightLbs: Number(cargoMatch[2]) } : null;
      globalThis._missionCargoGenerateManifest = () => ({ items: item ? [item] : [] });
      globalThis._missionCargoPassengerCount = () => (pax && !pickup ? 1 : 0);
      const md = { missionTitle: m.t, missionStory: m.s, passenger: pax, bush, targetName: m.targetName || m.dest?.n || '' };
      const idea = composer.source(md);
      return { name: `${profile}: ${pax ? `${pax.role} ${pax.name}` : 'ohne Person'}`, idea, taskDomain: idea?.taskDomain || '', roleProfile: idea?.roleProfile || '',
        check: idea && { writerPassenger: pax && { role: pax.role, gender: pax.gender }, lead: idea.lead, passengerCount: idea.passengerCount, cargo: idea.cargoPost } };
    });
  },
  // Übrige Bush-Profile (Live-Läufe --run=composer-20261114): Abenteuer-Hopper, Fracht-Abholung, Aufklärung.
  bushRest() { return STRANDS.bush(['bush_scenic_hopper', 'bush_pickup_cargo', 'bush_recon_return'], 'composer-20261114'); }
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
    // Etappe E: Bringer/Empfänger und Fahrzeug je Szene.
    run.scenes = Object.fromEntries(Object.entries(plan?.scenes || {}).map(([scene, x]) => [scene, {
      vehicle: `${x.vehicle} (${x.vehicleSource}, ${x.seatsNeeded} Plätze)`, offered: ground.vehicleOptions(board, scene, c),
      persons: x.persons.map((p) => `${p.gender}/${p.look}/${p.ageBand || '-'}(${p.lookSource})`),
      figures: ground.resolveSceneCrew(plan, scene, { season: 'winter', seed: c.name, exclude: run.figures }).map((f) => f.title), note: x.note }]));
    run.manifestMainMatches = !!(c.idea.cargoVisual && visual.planMatches(c.idea.cargoVisual, visual.postFromIdea(c.idea)?.description, visual.postFromIdea(c.idea)?.weightLbs));
    console.log('  ', JSON.stringify({ pax: run.passengers.map((p) => `${p.gender}/${p.look}/${p.ageBand}`), cargo: run.cargo, figures: run.figures, scenes: run.scenes }));
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
  for (const [scene, x] of Object.entries(r.scenes || {})) md.push(`- Szene ${scene}: Fahrzeug **${x.vehicle}** aus [${x.offered.join(', ')}]; Personen ${x.persons.join(', ') || '–'} → ${x.figures.join(', ') || '–'}${x.note ? ` – ${x.note}` : ''}`);
  md.push(`- Figuren: ${r.figures.join(', ') || '–'}`, `- KI-Looks: ${r.aiLooks}, Hauptposten passt zur Ladeliste: ${r.manifestMainMatches}`, '');
}
fs.writeFileSync(output.replace(/\.json$/, '.md'), md.join('\n'));
