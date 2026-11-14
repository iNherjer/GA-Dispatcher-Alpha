'use strict';
// Threshold remarks during the flight: the passenger reports nausea when the
// comfort score falls below 50 % / 30 %, and notices broken cargo when the
// live cargo condition reaches 50 % / 35 % (35 % is the existing mission
// failure line for required cargo, mission-flight-recorder-core / cargo core).
// Pure policy: no mission mutation, no new failure rule. Each stage speaks
// once per run; skipping a lower stage marks it done as well.
const flightRecorderCore = require('../mission-flight-recorder-core.js');

const PAX_STAGES = [{ id: 'sick', below: 30 }, { id: 'queasy', below: 50 }];
const CARGO_STAGES = [{ id: 'broken', atOrBelow: 35 }, { id: 'damaged', atOrBelow: 50 }];
const MIN_SPACING_MS = 20000;

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function itemName(item) {
  return String(item?.storyName || item?.label || item?.id || 'Ladung').trim().slice(0, 120);
}

// Same record the arrival evaluation uses: the arrival record once present,
// otherwise the current recorder segment (it already honours the resume grace).
function stressRecord(recorderState, arrivalRecord, now) {
  if (arrivalRecord && typeof arrivalRecord === 'object') return arrivalRecord;
  if (!recorderState || typeof recorderState !== 'object') return {};
  return flightRecorderCore.buildRecord(recorderState, { now, depLabel: 'START', arrLabel: 'LANDUNG' }) || {};
}

function cargoCondition(manifest, record, options = {}) {
  const items = (Array.isArray(manifest?.items) ? manifest.items : []).filter(item => item
    && String(item.itemType || '').toLowerCase() !== 'passenger' && item.persistentEquipment !== true
    && item.status === 'loaded');
  if (!items.length) return null;
  const damage = flightRecorderCore.stressDamage(record || {}, { motionProtectionEnabled: options.motionProtectionEnabled === true });
  const rows = items.map(item => ({
    name: itemName(item),
    required: item.required === true,
    healthPct: Math.max(0, Math.min(100, Math.round(Math.min(finite(item.healthPct) ?? 100, 100 - damage))))
  }));
  const conditionPct = Math.min(...rows.map(row => row.healthPct));
  const required = rows.filter(row => row.required);
  const worst = rows.filter(row => row.healthPct <= conditionPct + 2).slice(0, 3);
  return {
    conditionPct,
    requiredConditionPct: required.length ? Math.min(...required.map(row => row.healthPct)) : null,
    worstItems: worst.map(row => row.name),
    worstRequired: worst.some(row => row.required),
    requiredBroken: required.filter(row => row.healthPct <= 35).map(row => row.name)
  };
}

function paxStage(score) {
  const value = finite(score);
  if (value == null) return null;
  return PAX_STAGES.find(stage => value < stage.below)?.id || null;
}

function cargoStage(condition) {
  const value = finite(condition?.conditionPct);
  if (value == null) return null;
  return CARGO_STAGES.find(stage => value <= stage.atOrBelow)?.id || null;
}

function normalizeState(previous) {
  const source = previous && typeof previous === 'object' ? previous : {};
  return {
    pax: { queasy: source.pax?.queasy === true, sick: source.pax?.sick === true },
    cargo: { damaged: source.cargo?.damaged === true, broken: source.cargo?.broken === true },
    lastAt: Math.max(0, finite(source.lastAt) || 0)
  };
}

function markDone(state, group, stage) {
  const order = group === 'pax' ? ['queasy', 'sick'] : ['damaged', 'broken'];
  for (const id of order.slice(0, order.indexOf(stage) + 1)) state[group][id] = true;
}

/**
 * facts: { now, speakerReady, airborne, comfortScore, cargo, committed: [{kind, stage}] }
 * speakerReady = passenger aboard, pax voice on, no other voice pending.
 */
function observe(previous, facts = {}) {
  const state = normalizeState(previous);
  for (const entry of Array.isArray(facts.committed) ? facts.committed : []) {
    if (entry?.kind === 'pax_distress' && ['queasy', 'sick'].includes(entry.stage)) markDone(state, 'pax', entry.stage);
    if (entry?.kind === 'cargo_distress' && ['damaged', 'broken'].includes(entry.stage)) markDone(state, 'cargo', entry.stage);
  }
  const now = Math.max(0, finite(facts.now) || 0);
  if (facts.speakerReady !== true || now - state.lastAt < MIN_SPACING_MS) return { state, event: null };
  const candidates = [];
  const pax = facts.airborne === true ? paxStage(facts.comfortScore) : null;
  if (pax && !state.pax[pax]) candidates.push({ kind: 'pax_distress', group: 'pax', stage: pax });
  const cargo = cargoStage(facts.cargo);
  if (cargo && !state.cargo[cargo]) candidates.push({ kind: 'cargo_distress', group: 'cargo', stage: cargo });
  // Broken required cargo decides the mission and goes first; otherwise the passenger's own state.
  const event = candidates.find(c => c.stage === 'broken' && facts.cargo?.worstRequired) || candidates[0] || null;
  if (!event) return { state, event: null };
  markDone(state, event.group, event.stage);
  state.lastAt = now;
  return { state, event: { kind: event.kind, stage: event.stage } };
}

function attribution(summary) {
  const pilot = Number(summary?.pilotEvents) || 0;
  const weather = Number(summary?.weatherEvents) || 0;
  if (pilot > 0 && weather > 0) return 'Ursache waren sowohl harte Flugmanöver als auch unruhiges Wetter. Du darfst den Flugstil ansprechen, Wind und Turbulenz aber nicht dem Piloten anlasten.';
  if (pilot > 0) return 'Ursache waren harte Flugmanöver (G-Last, steile Kurven oder starker Sinkflug). Du darfst den Piloten bitten, sanfter zu fliegen.';
  return 'Ursache ist das unruhige Wetter. Gib dem Piloten keine Schuld und kritisiere nicht den Flugstil.';
}

const TTS_STYLE = {
  queasy: 'Sprich auf Deutsch angeschlagen und leicht gequält: etwas leiser und langsamer, mit hörbarem Unwohlsein im Magen und gelegentlich einem schweren Ausatmen. Nicht witzig, nicht übertrieben gespielt. Wortlaut beibehalten; diese Regieanweisung nicht mitsprechen.',
  sick: 'Sprich auf Deutsch völlig fertig und elend: schwach, gepresst und kurzatmig, mit deutlich hörbarer Übelkeit, kurzen Pausen und schwerem Schlucken oder Atmen zwischen den Worten. Man muss hören, dass es dir richtig schlecht geht. Wortlaut beibehalten; diese Regieanweisung nicht mitsprechen.'
};

function paxPrompt(context, stage, summary) {
  const base = String(context?.baseContext || '').trim();
  if (!base || !TTS_STYLE[stage]) return null;
  const score = Math.round(Number(summary?.comfortScore));
  const scoreText = Number.isFinite(score) ? ` (Komfortwert nur noch ${score} %)` : '';
  const moment = stage === 'sick'
    ? `Moment: Der Flug hat dich komplett fertig gemacht${scoreText}. Dir ist so übel, dass du dich gleich übergeben musst. Du brauchst jetzt sofort eine Spucktüte und möchtest, dass der Pilot so bald wie möglich landet.`
    : `Moment: Der Flug ist dir inzwischen zu unruhig geworden${scoreText}. Dir ist flau im Magen, dir wird langsam richtig übel.`;
  const task = stage === 'sick'
    ? 'Bitte den Piloten in 1-2 kurzen, gepressten Sätzen um eine Tüte und darum, bald zu landen. Keine Witze, keine langen Erklärungen: du bist fix und fertig.'
    : 'Sag dem Piloten in 1-2 kurzen Sätzen, dass dir schlecht wird, und bitte ihn, möglichst ruhig weiterzufliegen. Kein Humor, du fühlst dich elend.';
  return `${base}\n\n${moment}\n${attribution(summary)}\n${task} Erfinde keine Flugdaten.${context?.toneHint ? ' ' + context.toneHint : ''}`;
}

function cargoPrompt(context, stage, cargo) {
  const base = String(context?.baseContext || '').trim();
  if (!base || !cargo) return null;
  const names = (cargo.worstItems || []).join(', ') || 'die Ladung';
  const pct = Math.round(Number(cargo.conditionPct));
  const requiredHit = stage === 'broken' ? (cargo.requiredBroken || []).length > 0 : cargo.worstRequired === true;
  if (stage === 'broken') {
    const consequence = requiredHit
      ? `Das war Pflichtladung für diesen Auftrag (${(cargo.requiredBroken || []).join(', ')}). Mach unmissverständlich klar, dass das für den Auftrag ein echtes Problem ist: so kann die Ladung nicht abgeliefert werden.`
      : 'Es war keine Pflichtladung: ärgerlich und peinlich, aber der Auftrag hängt nicht daran.';
    return `${base}\n\nMoment: Hinten im Laderaum hat es eben richtig gekracht. ${names} ist durch die harten Belastungen jetzt wirklich kaputt (Ladungszustand etwa ${pct} %).\n${consequence}\nSag das dem Piloten in 1-2 kurzen, betroffenen Sätzen. Erfinde keine Flugdaten.${context?.toneHint ? ' ' + context.toneHint : ''}`;
  }
  const requiredHint = requiredHit ? ' Ausgerechnet die Pflichtladung ist betroffen, das macht dich nervös.' : '';
  return `${base}\n\nMoment: Aus dem Laderaum hat es eben hörbar gerumpelt und geklappert. Bei ${names} ist durch die Flugbewegungen wohl irgendwas zu Bruch gegangen (Ladungszustand etwa ${pct} %).${requiredHint}\nSag dem Piloten in 1-2 kurzen Sätzen besorgt, dass da hinten wohl etwas kaputt gegangen ist und er vorsichtiger fliegen sollte. Noch keine Katastrophe. Erfinde keine Flugdaten.${context?.toneHint ? ' ' + context.toneHint : ''}`;
}

function effectPayload(context, event, summary, cargo) {
  if (!event) return null;
  const prompt = event.kind === 'pax_distress' ? paxPrompt(context, event.stage, summary) : cargoPrompt(context, event.stage, cargo);
  if (!prompt) return null;
  return {
    kind: event.kind,
    stage: event.stage,
    prompt,
    fallbackText: '',
    label: event.kind === 'pax_distress' ? (event.stage === 'sick' ? 'Spucktüte' : 'Übelkeit') : (event.stage === 'broken' ? 'Ladung kaputt' : 'Ladung beschädigt'),
    ...(event.kind === 'pax_distress' ? { ttsStyle: TTS_STYLE[event.stage] } : {}),
    delayMs: 0
  };
}

// EFB rows: visible with or without a passenger aboard.
function feedbackRows(cargo) {
  const stage = cargoStage(cargo);
  if (!stage) return [];
  const names = (cargo.worstItems || []).join(', ') || 'Ladung';
  if (stage === 'broken') return [{ label: 'Ladung kaputt', tone: 'danger',
    detail: (cargo.requiredBroken || []).length
      ? `${(cargo.requiredBroken || []).join(', ')} bei ${cargo.conditionPct} %: Pflichtladung zerstört, der Auftrag ist so nicht mehr erfüllbar.`
      : `${names} bei ${cargo.conditionPct} %: kaputt. Keine Pflichtladung, der Auftrag hängt nicht daran.` }];
  return [{ label: 'Ladung beschädigt', tone: 'warn',
    detail: `${names} bei ${cargo.conditionPct} %: da ist wohl etwas zu Bruch gegangen. Bei 35 % ist Pflichtladung verloren.` }];
}

module.exports = { observe, cargoCondition, stressRecord, effectPayload, feedbackRows, paxStage, cargoStage, TTS_STYLE, MIN_SPACING_MS };
