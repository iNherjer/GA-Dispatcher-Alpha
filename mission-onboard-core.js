(function(root){
'use strict';
// Bordliste: neutral beschrieben, wer und was mitfliegt. Wird aus der fertigen Idee bzw.
// dem Passagierprofil abgeleitet – die Ideen-KI sieht keinen Katalog. Grundlage für den
// Boden-Composer (Pax-Looks + Packstücke) und für die feste Rollenliste ohne KI.
const SCHEMA = 'mission-onboard.v1';
const MAX_PASSENGERS = 6;

function text(value, max = 600) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : ''; }
function join(parts, max = 600) { return parts.map((part) => text(part, max)).filter(Boolean).join(' – ').slice(0, max); }
function gender(value) { const g = String(value || '').toLowerCase(); return g === 'male' || g === 'female' ? g : ''; }
function count(value, fallback = 1) { const n = Math.round(Number(value)); return Number.isFinite(n) ? Math.max(1, Math.min(MAX_PASSENGERS, n)) : fallback; }

// Hauptperson + weitere Mitreisende. Die Hauptperson hat ein festes Geschlecht (Stimme);
// Mitreisende übernehmen Rolle/Geschlecht aus idea.companions, sonst bleiben sie offen und
// der Composer leitet sie aus groupLabel ab.
function passengersFor({ lead = null, passengerCount = 1, groupLabel = '', companions = [] } = {}) {
  const total = count(passengerCount);
  const list = [];
  for (let index = 0; index < total; index += 1) {
    const isLead = index === 0;
    const companion = !isLead && Array.isArray(companions) ? companions[index - 1] : null;
    list.push({
      id: `pax${index + 1}`,
      lead: isLead,
      role: text(isLead ? lead?.role : companion?.role, 100) || (total > 1 ? text(groupLabel, 100) : ''),
      gender: gender(isLead ? lead?.gender : companion?.gender),
      appearance: isLead ? text(lead?.appearance, 200) : '',
      ageHint: ''
    });
  }
  return list;
}

function cargoPost(id, { description = '', packaging = '', handling = '', weightLbs = 0, use = 'passenger_gear', owner = 'pax1' } = {}) {
  const weight = Number(weightLbs);
  if (!text(description, 160) || !(weight > 0)) return null;
  return { id, owner, description: text(description, 160), packaging: text(packaging, 300) || undefined,
    handling: text(handling, 300) || undefined, weightLbs: weight, use };
}

const ADAPTERS = {
  'charter-idea.v1': (idea) => ({
    occasion: join([idea.reason, idea.background, idea.travelCharacter]),
    task: text(idea.arrival, 300),
    groupLabel: text(idea.groupLabel, 100),
    passengers: passengersFor({ lead: idea.passenger, passengerCount: idea.passengerCount, groupLabel: idea.groupLabel, companions: idea.companions }),
    cargo: [cargoPost('c1', { description: idea.luggageLabel, weightLbs: idea.luggageWeightLbs })].filter(Boolean)
  }),
  'sightseeing-idea.v1': (idea) => ({
    occasion: join([idea.theme, idea.summary]),
    task: text(idea.groundPlan, 300),
    groupLabel: text(idea.groupLabel, 100),
    passengers: passengersFor({ lead: idea.passenger, passengerCount: idea.passengerCount, groupLabel: idea.groupLabel, companions: idea.companions }),
    cargo: [cargoPost('c1', { description: idea.luggageLabel, weightLbs: idea.luggageWeightLbs })].filter(Boolean)
  }),
  // Privatflug: genau ein Mitflieger (Rolle = Beziehung, Geschlecht fest), persönliches Gepäck.
  // Gilt auch für den Rückflug (privateReturn.outing trägt dieselbe Begleitung).
  'private-outing.v1': (idea) => ({
    occasion: join([idea.occasion, idea.personalReason, idea.storyIdentity?.activity]),
    task: join([idea.groundPlan?.intent, idea.firstStep], 300),
    groupLabel: '',
    passengers: passengersFor({ lead: { role: idea.companion?.relationship, gender: idea.companion?.gender }, passengerCount: 1 }),
    cargo: [cargoPost('c1', { description: idea.luggage?.label, weightLbs: idea.luggage?.weightLbs })].filter(Boolean)
  }),
  // Verein: Pilot plus genau ein Vereinskollege (Rolle/Geschlecht aus der Idee). Erster Posten
  // ist der Hauptposten der Ladeliste (primary-cargo): Lieferung, sonst Gepäck.
  'club-idea.v1': (idea) => ({
    occasion: join([idea.occasion, idea.clubConnection]),
    task: join([idea.groundPlan, idea.passengerIntent], 300),
    groupLabel: '',
    passengers: idea.passenger ? passengersFor({ lead: idea.passenger, passengerCount: 1 }) : [],
    cargo: [
      idea.delivery ? cargoPost('c1', { description: idea.delivery.label, handling: idea.delivery.purpose, weightLbs: idea.delivery.weightLbs,
        use: 'freight', owner: text(idea.delivery.receiver, 100) || 'Lieferung' }) : null,
      idea.luggage ? cargoPost('c2', { description: idea.luggage.label, weightLbs: idea.luggage.weightLbs,
        owner: text(idea.passenger?.role, 100) || 'Vereinskollege' }) : null
    ].filter(Boolean)
  }),
  // Medizin: Fachperson bzw. Kurier; beim Patiententransfer zusätzlich der sitzende Patient
  // (Geschlecht aus der Idee). Die Sendung hat einen eigenen Medizin-Pool → kein Gepäckposten.
  'medical-transfer-idea.v1': (idea) => ({
    occasion: join([idea.purpose, idea.background, idea.character]),
    task: join([idea.arrival, idea.recipient], 300),
    groupLabel: idea.patient ? 'Patient mit medizinischer Begleitung' : '',
    passengers: passengersFor({ lead: idea.passenger, passengerCount: idea.patient ? 2 : 1,
      companions: idea.patient ? [{ role: 'Patient, sitzend mit Begleitung', gender: idea.patient.gender }] : [] }),
    cargo: []
  }),
  // Fracht: keine Person an Bord; Sendung mit Verpackung (entscheidet die Form) und Handhabung.
  'cargo-idea.v1': (idea) => ({
    occasion: join([idea.purpose, idea.background, idea.character]),
    task: join([idea.arrival, idea.recipient], 300),
    groupLabel: '',
    passengers: [],
    cargo: [cargoPost('c1', { description: idea.shipment?.label, packaging: idea.shipment?.packaging, handling: idea.shipment?.handling,
      weightLbs: idea.shipment?.weightLbs, use: 'freight', owner: text(idea.sender, 100) || 'Absender' })].filter(Boolean)
  }),
  // Zerbrechliche Fracht: genau ein Kurier (Rolle/Geschlecht aus der Idee) mit der Sendung.
  'fragile-cargo-idea.v1': (idea) => ({
    occasion: join([idea.purpose, idea.background, idea.character]),
    task: join([idea.arrival, idea.recipient], 300),
    groupLabel: '',
    passengers: passengersFor({ lead: idea.passenger, passengerCount: 1 }),
    cargo: [cargoPost('c1', { description: idea.shipment?.label, packaging: idea.shipment?.packaging,
      handling: join([idea.shipment?.handling, idea.shipment?.fragility], 300), weightLbs: idea.shipment?.weightLbs,
      use: 'freight', owner: text(idea.passenger?.role, 100) || 'Kurier' })].filter(Boolean)
  }),
  // Tiertransport: Begleitperson aus der Idee; die Tiere haben einen eigenen Pool → kein Gepäckposten.
  'animal-transport-idea.v1': (idea) => ({
    occasion: join([idea.purpose, idea.background, idea.character]),
    task: join([idea.arrival, idea.recipient], 300),
    groupLabel: '',
    passengers: passengersFor({ lead: idea.passenger, passengerCount: 1 }),
    cargo: []
  }),
  // Alle übrigen Missionen (mission-ground-composer-browser.js): Profil, Personenzahl, Ladeliste.
  // Reine Frachtflüge haben keine Personen, nur Gepäck/Fracht.
  'mission-ground-source.v1': (src) => ({
    occasion: text(src.occasion, 600),
    task: text(src.task, 300),
    groupLabel: text(src.groupLabel, 100),
    passengers: Number(src.passengerCount) > 0
      ? passengersFor({ lead: src.lead, passengerCount: src.passengerCount, groupLabel: src.groupLabel, companions: src.companions }) : [],
    cargo: [src.cargoPost ? cargoPost('c1', src.cargoPost) : null].filter(Boolean),
    scenes: src.groundCast || null
  }),
  'apt-news-idea.v1': (idea) => ({
    occasion: join([idea.purpose, idea.background, idea.angle]),
    task: join([idea.groundPlan, idea.publication], 300),
    groupLabel: text(idea.groupLabel || idea.passenger?.role, 100),
    passengers: passengersFor({ lead: idea.passenger, passengerCount: 1 }),
    cargo: [cargoPost('c1', { description: idea.shipment?.label, packaging: idea.shipment?.packaging,
      handling: idea.shipment?.handling, weightLbs: idea.shipment?.weightLbs })].filter(Boolean)
  })
};

function fromIdea(idea = null) {
  if (!idea || typeof idea !== 'object') return null;
  const adapter = ADAPTERS[idea.schema];
  if (!adapter) return null;
  return normalize({ schema: SCHEMA, source: idea.schema, scenes: idea.groundCast || null, ...adapter(idea) });
}

// Bodenszenen am Start und am Ziel: wer außer den Mitreisenden dort steht (Bringer bzw.
// Empfänger, fährt mit dem Szenenfahrzeug). Kommt strukturiert aus der Idee (groundCast:
// { start: [{ role, gender }], arrival: [...] }); fehlt sie, je Szene eine neutrale Person.
// Start und Ziel sind unabhängig – anderes Fahrzeug, andere Personen.
const MAX_CREW = 3;
const DEFAULT_CREW_ROLE = {
  start: 'bringt die Mitreisenden bzw. die Sendung zum Flugzeug und fährt danach weg',
  arrival: 'holt am Ziel ab und fährt mit Mitreisenden bzw. Sendung weg'
};
function crewFor(list, scene) {
  const prefix = scene === 'start' ? 's' : 'a';
  const raw = Array.isArray(list) ? list.filter((entry) => entry && typeof entry === 'object').slice(0, MAX_CREW) : null;
  const entries = raw && raw.length ? raw : (Array.isArray(list) ? [] : [{}]);
  return entries.map((entry, index) => ({
    id: `${prefix}${index + 1}`,
    role: text(entry.role, 100) || DEFAULT_CREW_ROLE[scene],
    gender: gender(entry.gender),
    appearance: text(entry.appearance, 200),
    fromIdea: !!(raw && raw.length)
  }));
}
// Prüft groundCast aus einer Ideen-Antwort: je Szene 0–3 Personen mit Rolle und Geschlecht.
// Ungültiges fällt still weg (dann Standardperson); eine leere Liste bleibt „niemand“.
// Prompt-Baustein für die Ideen-Stufen: GROUND_CAST_PROMPT.
function groundCastFrom(raw = null) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const scene of ['start', 'arrival']) {
    if (!Array.isArray(raw[scene])) continue;
    const list = raw[scene].filter((p) => p && typeof p === 'object' && text(p.role, 100) && gender(p.gender))
      .slice(0, MAX_CREW).map((p) => ({ role: text(p.role, 100), gender: gender(p.gender) }));
    if (list.length || !raw[scene].length) out[scene] = list;
  }
  return Object.keys(out).length ? out : null;
}
const GROUND_CAST_PROMPT = 'groundCast nennt die Menschen am Boden, die die Szene zeigt: start = wer am Startflugplatz bringt bzw. anliefert, arrival = wer am Zielflugplatz entgegennimmt bzw. abholt; jeweils 0–2 Personen (meist eine; sie kommen mit einem eigenen Fahrzeug), [] wenn dort niemand wartet. Je Person role (kurze Rolle aus der Geschichte, bis 100 Zeichen) und gender "female" oder "male". Ist eine Person anderswo in der Idee genannt, ist es dieselbe Person mit demselben Geschlecht; sonst wähle das Geschlecht unabhängig von Berufsklischees.';

function scenesFor(raw = null) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return { start: { crew: crewFor(src.start, 'start') }, arrival: { crew: crewFor(src.arrival, 'arrival') } };
}

// Allgemeiner Rückfall ohne passende Idee: Hauptperson und Gruppengröße aus dem Missionsprofil.
function fromPassenger(passenger = null, { passengerCount = null, party = null, cargo = [] } = {}) {
  if (!passenger || typeof passenger !== 'object') return null;
  const total = count(party?.count ?? passengerCount ?? 1);
  return normalize({
    schema: SCHEMA,
    source: 'passenger-profile',
    occasion: text(passenger.storySeed || passenger.personalStoryCue, 400),
    task: '',
    groupLabel: text(party?.label, 100),
    passengers: passengersFor({ lead: passenger, passengerCount: total, groupLabel: party?.label }),
    cargo: (Array.isArray(cargo) ? cargo : []).map((post, index) => cargoPost(`c${index + 1}`, post)).filter(Boolean)
  });
}

function normalize(raw = null) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.passengers)) return null;
  if (!raw.passengers.length && !(Array.isArray(raw.cargo) && raw.cargo.length)) return null;
  const passengers = raw.passengers.slice(0, MAX_PASSENGERS).map((pax, index) => ({
    id: `pax${index + 1}`,
    lead: index === 0,
    role: text(pax?.role, 100),
    gender: gender(pax?.gender),
    appearance: text(pax?.appearance, 200),
    ageHint: text(pax?.ageHint, 40)
  }));
  const cargo = (Array.isArray(raw.cargo) ? raw.cargo : []).slice(0, 6)
    .map((post, index) => cargoPost(`c${index + 1}`, post || {})).filter(Boolean);
  return { schema: SCHEMA, source: text(raw.source, 60), occasion: text(raw.occasion, 600), task: text(raw.task, 300),
    groupLabel: text(raw.groupLabel, 100), passengers, cargo, scenes: scenesFor(raw.scenes) };
}

const api = { SCHEMA, MAX_PASSENGERS, MAX_CREW, GROUND_CAST_PROMPT, groundCastFrom, fromIdea, scenesFor, fromPassenger, normalize, adapters: Object.keys(ADAPTERS) };
root.MissionOnboardCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
