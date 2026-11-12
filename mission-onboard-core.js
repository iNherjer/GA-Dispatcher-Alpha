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

// Hauptperson + weitere Mitreisende. Nur die Hauptperson hat ein festes Geschlecht
// (Stimme); Mitreisende lässt die Idee offen, der Composer darf es aus groupLabel ableiten.
function passengersFor({ lead = null, passengerCount = 1, groupLabel = '' } = {}) {
  const total = count(passengerCount);
  const list = [];
  for (let index = 0; index < total; index += 1) {
    const isLead = index === 0;
    list.push({
      id: `pax${index + 1}`,
      lead: isLead,
      role: text(isLead ? lead?.role : '', 100) || (total > 1 ? text(groupLabel, 100) : ''),
      gender: isLead ? gender(lead?.gender) : '',
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
    passengers: passengersFor({ lead: idea.passenger, passengerCount: idea.passengerCount, groupLabel: idea.groupLabel }),
    cargo: [cargoPost('c1', { description: idea.luggageLabel, weightLbs: idea.luggageWeightLbs })].filter(Boolean)
  }),
  'sightseeing-idea.v1': (idea) => ({
    occasion: join([idea.theme, idea.summary]),
    task: text(idea.groundPlan, 300),
    groupLabel: text(idea.groupLabel, 100),
    passengers: passengersFor({ lead: idea.passenger, passengerCount: idea.passengerCount, groupLabel: idea.groupLabel }),
    cargo: [cargoPost('c1', { description: idea.luggageLabel, weightLbs: idea.luggageWeightLbs })].filter(Boolean)
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
  return normalize({ schema: SCHEMA, source: idea.schema, ...adapter(idea) });
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
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.passengers) || !raw.passengers.length) return null;
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
    groupLabel: text(raw.groupLabel, 100), passengers, cargo };
}

const api = { SCHEMA, MAX_PASSENGERS, fromIdea, fromPassenger, normalize, adapters: Object.keys(ADAPTERS) };
root.MissionOnboardCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
