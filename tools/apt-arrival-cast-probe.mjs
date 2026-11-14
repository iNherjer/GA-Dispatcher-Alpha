// Live-Probe Etappe E Schritt 3: Hält sich der Szenenplaner V3 an die feste Empfangsbesetzung
// (receptionCast) und platziert nur noch? Echte Freiburg-Geometrie (Fixture), Produktiv-Prompt,
// echter Tool-Aufruf get_scene_context_bundle, Produktiv-Sanitizer.
// Aufruf: node tools/apt-arrival-cast-probe.mjs --run
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
if (process.argv[2] !== '--run') throw Error('Use --run');
const output = process.argv.find((x) => x.startsWith('--out='))?.slice(6) || 'analysis/apt-arrival-cast-probe-20261114.json';
const only = process.argv.find((x) => x.startsWith('--case='))?.slice(7);
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
const app = fs.readFileSync('app.js', 'utf8');
const c = vm.createContext({ window: {}, console, Map, Set });
vm.runInContext(fs.readFileSync('mission-arrival-core.js', 'utf8'), c);
vm.runInContext(app.slice(app.indexOf('const SCENE_PLANNER_V3_CAST_VEHICLE_ROLES'), app.indexOf('\nfunction scenePlannerV3ReceptionCast(')), c);
for (const name of ['scenePlannerV3CleanText', 'scenePlannerV3Prompt', 'scenePlannerV3ToolDeclarations', 'scenePlannerV3CompactAptPlan',
  'scenePlannerV3ReceptionCast', 'scenePlannerV3PreferredAptPlacement', 'sanitizeScenePlannerV3AptArrivalPlan']) vm.runInContext(declaration(app, name), c);
c.normalizeMissionType = () => 'apt';
const raw = JSON.parse(fs.readFileSync('tools/fixtures/arrival-edtf-osm-20261017.json', 'utf8'));

const CASES = [
  { name: 'Reporter-Abholung, offene Besetzung (Pkw, Standardperson)', role: { role: 'media_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.van', equipmentRole: 'cargo.camera_equipment' },
    mission: { title: 'Reportage Regionalflugplatz', story: 'Eine Reporterin fliegt nach Freiburg; die Redaktion holt sie ab.', taskDomain: 'news' },
    arrival: { vehicle: 'car', vehicleSource: 'composer', seatsNeeded: 2, seats: 5, castFixed: false, persons: [{ id: 'a1', role: 'holt am Ziel ab', gender: 'female' }] } },
  { name: 'Frachtübergabe, feste Besetzung (Pick-up, Lagerleiter)', role: { role: 'cargo_handoff', personRole: 'person.ground_crew', vehicleRole: 'vehicle.van', equipmentRole: 'cargo.small_box' },
    mission: { title: 'Ersatzteile für die Werft', story: 'Ein Getriebeteil in einer Holzkiste wird nach Freiburg geflogen; der Lagerleiter der Werft nimmt es mit dem Pick-up entgegen.', taskDomain: 'cargo' },
    arrival: { vehicle: 'truck', vehicleSource: 'composer', seatsNeeded: 1, seats: 3, castFixed: true, persons: [{ id: 'a1', role: 'Lagerleiter der Werft', gender: 'male' }] } },
  { name: 'Charter-Abholung, feste Besetzung (Van, Planerin + Fahrer)', role: { role: 'charter_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.car', equipmentRole: '' },
    mission: { title: 'Hochzeitsfotograf', story: 'Ein Fotograf mit Assistentin kommt zu einer Hochzeit; die Hochzeitsplanerin holt beide mit Fahrer im Van ab.', taskDomain: 'charter' },
    arrival: { vehicle: 'van', vehicleSource: 'composer', seatsNeeded: 4, seats: 8, castFixed: true, persons: [{ id: 'a1', role: 'Hochzeitsplanerin', gender: 'female' }, { id: 'a2', role: 'Fahrer', gender: 'male' }] } }
];

const report = { scope: 'Scene Planner V3 Produktiv-Prompt + Sanitizer, gemini-3-flash-preview thinking low, EDTF-Fixture', runs: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
async function call(contents, turn) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents, tools: [{ functionDeclarations: c.scenePlannerV3ToolDeclarations() }],
      toolConfig: { functionCallingConfig: turn === 0 ? { mode: 'ANY', allowedFunctionNames: ['get_scene_context_bundle'] } : { mode: 'NONE' } },
      generationConfig: { maxOutputTokens: 4800, thinkingConfig: { thinkingLevel: 'low' } } }),
    signal: AbortSignal.timeout(90000)
  });
  if (!res.ok) throw Error('HTTP ' + res.status);
  return res.json();
}
try {
  for (const k of CASES.filter((_, i) => !only || String(i + 1) === only)) {
    c.normalizeAptArrivalRole = () => k.role;
    const initial = c.buildAptArrivalPlan({ dest: { lat: 48.0227775574, lon: 7.8324999809, icao: 'EDTF' }, heading: 237 });
    const geo = c.normalizeAptArrivalGeoContext(raw, initial.airportLat, initial.airportLon);
    c.fetchAptArrivalGeoContext = async () => geo;
    const base = await c.resolveAptArrivalPlanPlacement(initial);
    const md = { groundComposer: { groundVisual: { scenes: { arrival: k.arrival } } } };
    const cast = c.scenePlannerV3ReceptionCast(md, {});
    const bundle = { schema: 'scenePlannerV3.contextBundle.v1', mode: 'apt', mission: k.mission, aptArrivalPlan: c.scenePlannerV3CompactAptPlan(base),
      receptionCast: cast, arrivalPlacementGeometry: c.aptArrivalComposerGeometry(geo, base) };
    const contents = [{ role: 'user', parts: [{ text: c.scenePlannerV3Prompt({ isPOI: false, missionMode: 'apt' }) }] }];
    const first = await call(contents, 0);
    const modelContent = first.candidates?.[0]?.content;
    const fnCall = (modelContent?.parts || []).find((p) => p.functionCall);
    if (!fnCall) throw Error('kein Tool-Aufruf');
    contents.push(modelContent, { role: 'user', parts: [{ functionResponse: { name: fnCall.functionCall.name, response: { content: bundle } } }] });
    // Wie produktiv: bei apt_arrival_scene_invalid Korrekturrunde mit Kandidaten und Geometrie.
    let parsed = null, result = null, error = '';
    const rounds = [];
    for (let turn = 1; turn <= 3 && !result; turn++) {
      const reply = await call(contents, turn);
      const text = (reply.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
      parsed = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
      try { result = c.sanitizeScenePlannerV3AptArrivalPlan(parsed.aptArrivalPlan || null, base, cast); error = ''; } catch (e) { error = e.message; }
      rounds.push({ turn, items: (parsed.aptArrivalPlan?.items || []).map((i) => `${i.kind}:${i.role} @${i.forwardM}/${i.rightM}`), error });
      if (result || !error.startsWith('apt_arrival_scene_invalid:')) break;
      contents.push({ role: 'model', parts: [{ text: JSON.stringify(parsed) }] }, { role: 'user', parts: [{ text: 'Korrigiere die räumliche Planung anhand der vorhandenen Geometrie: ' + error
        + '. Waehle eine angebotene Flaeche, passe headingDeg und alle Offsets an. Erhalte Rollen und Auftrag. Kein erfundener Ersatzstandort. '
        + JSON.stringify({ candidates: c.scenePlannerV3CompactAptPlan(base)?.placementCandidates, geometry: c.aptArrivalComposerGeometry(base.placementGeometry, base) }) }] });
    }
    const run = { name: k.name, cast, baseItems: base.items.map((i) => `${i.kind}:${i.role}`),
      plannerItems: (parsed.aptArrivalPlan?.items || []).map((i) => `${i.kind}:${i.role}:${i.label || ''} @${i.forwardM}/${i.rightM}`),
      placement: parsed.aptArrivalPlan?.preferredPlacement || null,
      sanitized: result ? result.items.map((i) => `${i.kind}:${i.role}:${i.label || ''} @${i.forwardM}/${i.rightM}`) : null, error, rounds };
    console.log(JSON.stringify(run, null, 1));
    report.runs.push(run); save();
  }
} catch (error) { report.error = String(error.message).replaceAll(apiKey, '[redacted]'); save(); throw Error(report.error); }
const md = ['# Szenenplaner V3 mit fester Empfangsbesetzung (Live-Probe)', '', report.scope, ''];
for (const r of report.runs) md.push(`## ${r.name}`, '', `- Vorgabe: \`${JSON.stringify(r.cast)}\``, `- Grundrolle: ${r.baseItems.join(', ')}`,
  `- Planer: ${r.plannerItems.join(', ')}`, `- Platz: ${r.placement ? `${r.placement.source}#${r.placement.index} – ${r.placement.reason || ''}` : '–'}`,
  `- Nach Prüfung: ${r.sanitized ? r.sanitized.join(', ') : 'verworfen: ' + r.error}`,
  ...(r.rounds && r.rounds.length > 1 ? [`- Runden: ${r.rounds.map((x) => `${x.turn}: ${x.error || 'ok'}`).join(' · ')}`] : []), '');
fs.writeFileSync(output.replace(/\.json$/, '.md'), md.join('\n'));
