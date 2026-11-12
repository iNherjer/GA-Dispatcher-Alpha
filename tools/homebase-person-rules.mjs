// Prüfregeln für Personen-Figuren im Homebase-Pack (gleiche Grenzen wie Tracker und App).
// Genutzt von tools/release-homebase-pack.mjs; Wortlisten in data/mission-person-vocabulary.json.
export const PACK_PERSON_TITLE = /^(?!tarmac_|termac_)[A-Za-z0-9][A-Za-z0-9 _.-]{0,159}$/i;
export const PERSON_ROLES = new Set(['passenger', 'scene-person', 'ground-crew']);
const NARRATIVE_WORDS = /\b(mission|ideal|geeignet|perfekt|passend f[üu]r|eignet sich)\b/i;

export function isPersonAsset(asset) {
  return !!asset?.person || asset?.group === 'Personen'
    || (Array.isArray(asset?.missionRoles) && asset.missionRoles.some((role) => PERSON_ROLES.has(role)));
}

// Liefert { errors: [], warnings: [] } für einen Katalogeintrag.
export function checkPersonAsset(asset, vocabulary) {
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(`${label}: ${message}`);
  const label = `${asset?.key} (${asset?.title})`;
  const roles = Array.isArray(asset?.missionRoles) ? asset.missionRoles : [];
  const person = asset?.person;
  if (!person || typeof person !== 'object' || Array.isArray(person)) { fail('person-Block fehlt'); return { errors, warnings }; }
  if (!PACK_PERSON_TITLE.test(String(asset.title || ''))) fail('Titel ist für Personen nicht erlaubt');
  if (asset.kind !== 'object') fail('kind muss object sein');
  if (roles.includes('scene-prop') || roles.includes('cargo')) fail('Personen dürfen nicht scene-prop oder cargo sein');
  if (!roles.some((role) => PERSON_ROLES.has(role))) fail('missionRoles braucht passenger, scene-person oder ground-crew');
  if (!['female', 'male'].includes(person.gender)) fail('person.gender muss female oder male sein');
  const loco = person.locomotion || {};
  if (loco.type !== 'waypoint-ground') fail('locomotion.type muss waypoint-ground sein');
  const max = Number(loco.maxWalkKts);
  if (!(max >= 1 && max <= 5)) fail('maxWalkKts muss zwischen 1 und 5 liegen');
  const clean = loco.cleanWalkKts;
  if (!Array.isArray(clean) || clean.length !== 2 || !(clean[0] < clean[1]) || clean[1] > max) fail('cleanWalkKts muss [min, max] bis maxWalkKts sein');
  if (!(Number(person.heightM) > 0.5 && Number(person.heightM) < 2.3)) fail('heightM unplausibel');
  if (!(Number(person.footprintRadiusM) > 0.1 && Number(person.footprintRadiusM) < 1.5)) fail('footprintRadiusM unplausibel');

  const look = person.appearance;
  if (!look) { warnings.push(`${label}: person.appearance fehlt – für Missionen später nötig`); return { errors, warnings }; }
  const inList = (value, list) => Object.prototype.hasOwnProperty.call(vocabulary[list] || {}, value);
  if (!inList(look.look, 'looks')) fail(`appearance.look "${look.look}" nicht in der Liste`);
  if (!inList(look.ageBand, 'ageBands')) fail(`appearance.ageBand "${look.ageBand}" nicht in der Liste`);
  if (!inList(look.season, 'seasons')) fail(`appearance.season "${look.season}" nicht in der Liste`);
  if (!Array.isArray(look.props)) fail('appearance.props muss eine Liste sein (darf leer sein)');
  for (const prop of look.props || []) if (!inList(prop, 'props')) fail(`appearance.props "${prop}" nicht in der Liste`);
  if (!Array.isArray(look.uses) || !look.uses.length) fail('appearance.uses fehlt');
  for (const use of look.uses || []) if (!inList(use, 'uses')) fail(`appearance.uses "${use}" nicht in der Liste`);
  const text = String(look.description || '').trim();
  if (!text) fail('appearance.description fehlt');
  if (text.length > (vocabulary.description?.maxLength || 200)) fail('appearance.description zu lang');
  if (NARRATIVE_WORDS.test(text)) warnings.push(`${label}: appearance.description klingt nach Einsatzzweck – nur beschreiben, was man sieht`);
  return { errors, warnings };
}
