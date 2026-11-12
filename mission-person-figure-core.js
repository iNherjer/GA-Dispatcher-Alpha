(function(root){
'use strict';
// Personen-Figurwahl: aus Look, Geschlecht, Jahreszeit, Alter und Einsatz die passende
// Figur aus MISSION_PERSON_ASSETS (Pack-Figuren + Tarmac-Standard). Keine KI, keine
// Stichwortsuche – der Aufrufer liefert die Merkmale (Composer, Rolle oder feste Liste).
const SCHEMA = 'person-figure-pick.v1';
const GENDERS = ['female', 'male'];

function catalog() {
  return root.MISSION_PERSON_ASSETS || (typeof module !== 'undefined' && module.exports ? require('./data/mission-person-assets.js') : null);
}
function hash(value) { let h = 2166136261; for (const ch of String(value || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function normGender(value) { const g = String(value || '').toLowerCase(); return GENDERS.includes(g) ? g : ''; }

// Jahreszeit für die Kleidung: Temperatur zuerst, sonst Monat und Halbkugel.
function seasonFromContext({ tempC = null, month = null, lat = null, snow = false } = {}) {
  if (snow === true) return 'winter';
  const temp = Number(tempC);
  if (tempC !== null && tempC !== '' && Number.isFinite(temp)) {
    if (temp <= 8) return 'winter';
    if (temp >= 15) return 'summer';
  }
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) return 'summer';
  const southern = Number(lat) < 0;
  const northernWinter = m >= 11 || m <= 3;
  return (southern ? !northernWinter : northernWinter) ? 'winter' : 'summer';
}

function figures(source = catalog()) { return Array.isArray(source?.figures) ? source.figures : []; }

// Bewertet eine Figur gegen die Wunschmerkmale; höher ist besser.
function score(figure, want) {
  let points = 0;
  if (want.look && figure.look === want.look) points += 8;
  if (want.season) points += figure.season === want.season ? 4 : (figure.season === 'all' ? 3 : 0);
  if (want.ageBand && figure.ageBand === want.ageBand) points += 2;
  // Eigene Figur mit anderem Look wirkt fehl am Platz (Wanderin beim Geschäftstermin);
  // dann lieber die neutrale Standardfigur.
  if (figure.source === 'pack') points += (!want.look || figure.look === want.look) ? 1 : -6;
  return points;
}

// Wählt eine Figur. Geschlecht ist Pflicht und wird nie getauscht; Einsatz (use) filtert,
// solange es Treffer gibt. Unter gleich guten Figuren streut der Seed stabil.
// Liefert { title, candidates, source, look, season, maxWalkKts, matched } oder null.
function pickPersonFigure(request = {}, source = catalog()) {
  const gender = normGender(request.gender) || 'female';
  const exclude = new Set(Array.isArray(request.exclude) ? request.exclude : []);
  const all = figures(source).filter((figure) => figure.gender === gender);
  if (!all.length) return null;
  const want = { look: request.look || '', season: request.season || '', ageBand: request.ageBand || '' };
  const byUse = request.use ? all.filter((figure) => (figure.uses || []).includes(request.use)) : all;
  let pool = (byUse.length ? byUse : all).filter((figure) => !exclude.has(figure.title));
  if (!pool.length) pool = byUse.length ? byUse : all;
  // Saisonfalsche Kleidung nur, wenn es gar nichts anderes gibt.
  if (want.season) {
    const seasonal = pool.filter((figure) => figure.season === want.season || figure.season === 'all');
    if (seasonal.length) pool = seasonal;
  }
  const best = Math.max(...pool.map((figure) => score(figure, want)));
  const top = pool.filter((figure) => score(figure, want) === best).sort((a, b) => a.title.localeCompare(b.title));
  const chosen = top[hash(`${request.seed || ''}|${gender}|${want.look}|${want.season}`) % top.length];
  // Ersatztitel für Spawn-Fehler: gleiche Saison/Geschlecht, Standardfiguren zuletzt.
  const fallbackPool = all.filter((figure) => figure.title !== chosen.title
    && (!want.season || figure.season === want.season || figure.season === 'all'))
    .sort((a, b) => score(b, want) - score(a, want) || a.title.localeCompare(b.title));
  return {
    schema: SCHEMA,
    title: chosen.title,
    candidates: [chosen.title, ...fallbackPool.map((figure) => figure.title)].slice(0, 6),
    source: chosen.source,
    gender,
    look: chosen.look,
    season: chosen.season,
    maxWalkKts: Number(chosen.maxWalkKts) || 5,
    matched: { look: !!want.look && chosen.look === want.look, season: !want.season || chosen.season === want.season || chosen.season === 'all', ageBand: !!want.ageBand && chosen.ageBand === want.ageBand }
  };
}

// Mehrere Personen einer Gruppe: jede bekommt eine eigene Figur, Dopplungen werden vermieden,
// solange der Pool reicht.
function pickGroupFigures(people = [], context = {}, source = catalog()) {
  const used = [];
  return (Array.isArray(people) ? people : []).map((person, index) => {
    const pick = pickPersonFigure({ ...context, ...person, seed: `${context.seed || ''}|${index}`, exclude: used }, source);
    if (pick) used.push(pick.title);
    return pick;
  });
}

// Feste Zuordnungsliste Rolle → Look. Rückfall ohne KI-Wahl und Grundlage für Missionen
// ohne KI-Modus. roleProfile hat Vorrang vor taskDomain; unbekannt → casual.
const LOOK_BY_ROLE_PROFILE = Object.freeze({
  instructor_calm_precise_v1: 'aviation',
  charter_professional_neutral_v1: 'business',
  authority_inspector_calm_precise_v1: 'business',
  bush_pickup_guest_v1: 'outdoor',
  bush_charter_guest_v1: 'outdoor',
  bush_adventure_guest_v1: 'outdoor',
  science_field_v1: 'outdoor',
  technical_inspector_v1: 'workwear',
  photogrammetry_precision_v1: 'workwear',
  club_utility_v1: 'workwear',
  cargo_loadmaster_v1: 'workwear',
  cargo_receiver_v1: 'workwear',
  cargo_charter_v1: 'workwear',
  cargo_fragile_highcare_v1: 'workwear',
  medical_sensitive_v1: 'medical',
  rescue_coordination_v1: 'fire_rescue',
  fire_observer_ops_v1: 'fire_rescue',
  news_reporter_professional_v1: 'casual',
  media_observer_v1: 'casual',
  reporter: 'casual',
  tour_guide_learning_v1: 'casual',
  tour_guide_relaxed_v1: 'casual',
  historian_storyteller_v1: 'casual',
  general_passenger_v1: 'casual'
});
const LOOK_BY_TASK_DOMAIN = Object.freeze({
  training: 'aviation',
  charter: 'business',
  bush_adventure: 'outdoor',
  bush_pickup_return: 'outdoor',
  science_bio: 'outdoor',
  science_geo: 'outdoor',
  inspection_infra: 'workwear',
  infra_chain_recon: 'workwear',
  mapping_survey: 'workwear',
  club_utility: 'workwear',
  cargo: 'workwear',
  cargo_fragile: 'workwear',
  transport: 'workwear',
  animal_transport: 'workwear',
  medical_transfer: 'medical',
  search_and_rescue: 'fire_rescue',
  fire_watch: 'fire_rescue',
  news_coverage: 'casual',
  reporter: 'casual',
  media_photo: 'casual',
  sightseeing_tour: 'casual',
  poi_learning_guide: 'casual',
  historian_guided_tour: 'casual',
  private_outing: 'casual',
  private_return: 'casual',
  general: 'casual'
});
function defaultLookForRole({ roleProfile = '', taskDomain = '' } = {}) {
  return LOOK_BY_ROLE_PROFILE[String(roleProfile || '').trim()]
    || LOOK_BY_TASK_DOMAIN[String(taskDomain || '').trim()]
    || 'casual';
}

function isPersonFigureTitle(title, source = catalog()) {
  return figures(source).some((figure) => figure.title === String(title || '').trim());
}

function figureForTitle(title, source = catalog()) {
  return figures(source).find((figure) => figure.title === String(title || '').trim()) || null;
}

const api = { SCHEMA, seasonFromContext, pickPersonFigure, pickGroupFigures, defaultLookForRole, LOOK_BY_ROLE_PROFILE, LOOK_BY_TASK_DOMAIN, isPersonFigureTitle, figureForTitle };
root.MissionPersonFigureCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
