(function (root) {
'use strict';
// Boden-Composer für alle Missionen ohne eigenen Composer-Anschluss (Bush,
// Training, POI-Aufträge …). Läuft nach dem Erstellen im Hintergrund: Bordliste aus
// Passagierprofil, Personenzahl und der Ladeliste, ein KI-Abruf für Looks + Packstücke.
// Charter, Sightseeing, Reporter, Privatflug, Verein, Medizin, Fracht und Tiere wählen schon beim Schreiben selbst.
// Testschalter ga_person_figures_v1; ohne KI-Modus gilt die feste Rollenliste.
const SCHEMA = 'mission-ground-source.v1';
// Diese Stränge haben eigene Objekt-Pools für die Hauptladung; der Composer wählt dort nur Looks.
const OWN_CARGO_POOLS = new Set(['fire_watch', 'search_and_rescue', 'medical_transfer', 'animal_transport']);
const OWN_COMPOSER_SCHEMAS = new Set(['charter-idea.v1', 'sightseeing-idea.v1', 'apt-news-idea.v1', 'private-outing.v1', 'club-idea.v1', 'medical-transfer-idea.v1',
  'cargo-idea.v1', 'fragile-cargo-idea.v1', 'animal-transport-idea.v1']);
const ACCEPT_WAIT_MS = 8000;

function text(value, max = 400) { return typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
function join(parts, max = 600) { return parts.map((part) => text(part, max)).filter(Boolean).join(' – ').slice(0, max); }

function hasOwnComposer(md) {
  const contract = md?.missionContract || {};
  return [md?.charterIdea, md?.sightseeingIdea, md?.aptNewsIdea, md?.privateOuting, md?.privateReturn?.outing,
    md?.clubIdea, md?.medicalTransferIdea, md?.cargoIdea, md?.fragileCargoIdea, md?.animalTransportIdea, contract.charterIdea, contract.sightseeingIdea, contract.aptNewsIdea, contract.privateOuting, contract.clubIdea, contract.medicalTransferIdea,
    contract.cargoIdea, contract.fragileCargoIdea, contract.animalTransportIdea]
    .some((idea) => idea && typeof idea === 'object' && (idea.groundVisual || OWN_COMPOSER_SCHEMAS.has(idea.schema)));
}

function taskDomainOf(md) {
  const pax = md?.passenger || md?.missionContract?.passenger || {};
  return text(md?.taskDomain || pax.taskDomain || md?.missionContract?.profile?.taskDomain || md?.missionContract?.taskDomain, 60);
}

// Gepäck so, wie es die Ladeliste später führt (gleicher Text, gleiches Gewicht) – nur dann
// greift die Composer-Wahl beim Manifest (planMatches).
function cargoPost(md, taskDomain) {
  if (OWN_CARGO_POOLS.has(taskDomain)) return null;
  try {
    const generate = root._missionCargoGenerateManifest;
    if (typeof generate !== 'function') return null;
    const item = (generate(null)?.items || []).find((entry) => ['pickup-companion-cargo', 'pickup-cargo', 'primary-cargo'].includes(entry?.id));
    const weightLbs = Number(item?.weightLbs);
    if (!item || !text(item.label, 160) || !(weightLbs > 0)) return null;
    return { owner: 'pax1', description: text(item.label, 160), weightLbs };
  } catch (_) {
    return null;
  }
}

function source(md) {
  if (!md || typeof md !== 'object') return null;
  const pax = md.passenger || md.missionContract?.passenger || null;
  const bush = md.bush && typeof md.bush === 'object' ? md.bush : null;
  const pickup = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
  const taskDomain = taskDomainOf(md);
  let passengerCount = 0;
  try { passengerCount = pickup ? Math.round(Number(bush.pickupPassengerCount) || 1) : (root._missionCargoPassengerCount?.() || 0); } catch (_) {}
  const gender = String(pax?.gender || (typeof root._missionScenePassengerGender === 'function' ? root._missionScenePassengerGender() : '') || '').toLowerCase();
  const cargo = cargoPost(md, taskDomain);
  if (!(passengerCount > 0) && !cargo) return null;
  return {
    schema: SCHEMA,
    taskDomain,
    roleProfile: text(pax?.roleProfile, 80),
    occasion: join([md.missionTitle || md.title, pax?.storySeed || pax?.personalStoryCue, text(md.missionStory || md.story, 500)]),
    task: join([pax?.role, pickup ? (bush.pickupLabel || bush.pickupRole) : '', md.targetName], 300),
    groupLabel: text(md.party?.label, 100),
    passengerCount: passengerCount > 0 ? passengerCount : 0,
    lead: passengerCount > 0 ? { role: text(pax?.role, 100), gender: gender === 'male' || gender === 'female' ? gender : '' } : null,
    cargoPost: cargo,
    // Wo die Bodenszenen sind; Rückkehr-Missionen enden wieder am Abflugplatz (dort holt die Start-Szene ab).
    places: { start: placeName(bush?.homeRef?.name, md.startName, md.start), arrival: placeName(bush?.targetRef?.name, md.targetName, md.destName, md.dest) },
    returnHome: bush?.requiresReturnHome === true
  };
}
function placeName(...values) {
  for (const value of values) {
    const name = typeof value === 'string' ? value : (value && typeof value === 'object' ? value.n || value.name : '');
    if (text(name, 80)) return text(name, 80);
  }
  return '';
}

// Folgemission mit derselben Person (z. B. Abholung des Bush-Gasts, POI-Fortsetzung): Die Anfrage
// trägt die Wahl der Hauptperson aus dem ersten Flug (mission-followup.js groundCarryFrom, auch im Tracker).
const CARRY_SCHEMA = 'ground-carry.v1';
function personName(value) { return text(value, 80).toLowerCase(); }
function carryFor(md) {
  try {
    const req = md?.followUpRequestId ? root.missionFollowupGetRequest?.(md.followUpRequestId) : null;
    const carry = req?.groundCarry;
    if (carry?.schema !== CARRY_SCHEMA) return null;
    // Nur dieselbe Person: Folgeaufträge mit anderer Person (Techniker nach Recon) wählen neu.
    return carry.name && carry.name === personName(md.passenger?.name || md.missionContract?.passenger?.name) ? carry : null;
  } catch (_) { return null; }
}
function applyCarry(plan, carry) {
  const lead = Array.isArray(plan?.passengers) ? plan.passengers.find((p) => p?.lead) || plan.passengers[0] : null;
  if (!lead || !carry || (carry.gender && lead.gender && carry.gender !== lead.gender)) return false;
  lead.look = carry.look;
  if (carry.ageBand) lead.ageBand = carry.ageBand;
  lead.lookSource = 'followup';
  if (carry.figureSeed) plan.figureSeed = carry.figureSeed;
  return true;
}

function json(prompt) {
  if (typeof root.fetchGeminiJsonWithFallback !== 'function') return Promise.reject(new Error('KI nicht verfügbar'));
  return root.fetchGeminiJsonWithFallback(prompt, root.getSelectedAiApiKey?.(), { promptVersion: 'ground-visual-generic-v1', timeoutMs: 26000 })
    .then((result) => { if (!result?.parsed) throw new Error('Boden-Composer ohne Antwort'); return result.parsed; });
}

let pending = null;

// Nach dem Erstellen aufrufen. Wartet nicht; das Ergebnis landet in md.groundComposer.
function start(md, { aiModeEnabled = false } = {}) {
  const visual = root.MissionGroundVisualCore;
  if (!md) return null;
  // Diagnose (Tracker-Log GROUND_COMPOSER): warum der allgemeine Schritt nicht lief.
  const skip = (reason) => { md.groundComposerStatus = { status: 'skipped', reason, at: Date.now() }; return null; };
  if (!visual?.enabled?.()) return skip('disabled');
  if (hasOwnComposer(md)) return skip('own-composer');
  if (md.groundComposer?.groundVisual) return null;
  if (!aiModeEnabled) return skip('no-ai');
  const src = source(md);
  if (!src) return skip('no-source');
  delete md.groundComposerStatus;
  md.groundComposer = src;
  const missionId = md.missionId;
  const carry = carryFor(md);
  const promise = visual.ensure(src, json, { taskDomain: src.taskDomain, roleProfile: src.roleProfile })
    .catch((error) => { console.warn('[GroundComposer] Auswahl fehlgeschlagen, feste Liste:', error?.message || error); return null; })
    .then((plan) => {
      if (plan && carry) applyCarry(plan, carry);
      if (root.currentMissionData?.missionId === missionId) { try { root.saveMissionState?.(); } catch (_) {} }
      return plan;
    });
  pending = { missionId, promise };
  return promise;
}

// Vor dem Annehmen: kurz auf einen laufenden Abruf warten, damit die Ladeliste ihn nutzt.
async function settle(md, waitMs = ACCEPT_WAIT_MS) {
  if (!pending || !md || pending.missionId !== md.missionId) return null;
  return Promise.race([pending.promise, new Promise((resolve) => setTimeout(() => resolve(null), waitMs))]);
}

const api = { SCHEMA, OWN_CARGO_POOLS, hasOwnComposer, source, start, settle, carryFor, applyCarry };
root.MissionGroundComposerBrowser = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
