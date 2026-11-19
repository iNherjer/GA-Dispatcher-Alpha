'use strict';
// Rolling away before the mission is ready: in phase prepare (passenger still
// waiting) or boarding (boarding and loading not finished) the tracker warns
// once per stand when the aircraft taxis, a second time when it rolls off
// again after stopping, and once when it lifts off anyway. Pure policy: no
// mission mutation; the run stays where it is and the pilot has to return.
// Packets are the 1 Hz start readiness samples, so two packets are ~2 s.
const { haversineNm } = require('../mission-location-core');

const PREMATURE_TAXI_MIN_KTS = 2;
const PREMATURE_TAXI_PACKETS = 2;
const PREMATURE_TAXI_MIN_METERS = 3;
const PREMATURE_TAXI_PHASES = new Set(['prepare', 'boarding']);
const MAX_PACKET_GAP_MS = 6000;
const STAGES = ['taxi', 'taxi_again', 'airborne'];

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function createPrematureTaxiWatch({ minKts = PREMATURE_TAXI_MIN_KTS, packets = PREMATURE_TAXI_PACKETS,
  minMeters = PREMATURE_TAXI_MIN_METERS } = {}) {
  let runId = null, phase = null, anchor = null, streak = 0, streakKind = null, lastAt = null;
  let away = false, pending = null, standWarned = false;
  let done = new Set();
  const clearStreak = () => { streak = 0; streakKind = null; };
  const reset = () => { runId = null; phase = null; anchor = null; clearStreak(); lastAt = null; away = false; pending = null; standWarned = false; done = new Set(); };
  // context: { runId, phase, suppressed } of the active tracker run; done: stages already committed.
  // suppressed: nothing left for the pilot to wait for (see runtime), or no scene yet.
  const observe = (sample, readiness, context = {}) => {
    const run = context.runId || null;
    if (run !== runId) { reset(); runId = run; }
    (Array.isArray(context.done) ? context.done : []).forEach(stage => { if (STAGES.includes(stage)) done.add(stage); });
    phase = context.phase || null;
    if (!run || !PREMATURE_TAXI_PHASES.has(phase) || context.suppressed === true) { clearStreak(); away = false; pending = null; anchor = null; return snapshot(); }
    const at = finite(sample?.observedAt);
    const live = Boolean(readiness && readiness.worldReady === true && at !== null);
    if (!live) { clearStreak(); return snapshot(); }
    if (lastAt !== null && (at < lastAt || at - lastAt > MAX_PACKET_GAP_MS)) clearStreak();
    lastAt = at;
    const lat = finite(sample.lat), lon = finite(sample.lon), gs = finite(sample.gsKts);
    // Standing at a stand: the next roll may warn again (taxi_again).
    if (readiness.ready === true) {
      anchor = lat !== null && lon !== null ? { lat, lon } : anchor;
      clearStreak(); away = false; pending = null; standWarned = false;
      return snapshot();
    }
    const airborne = sample.onGround === false;
    const movedM = anchor && lat !== null && lon !== null ? haversineNm(anchor.lat, anchor.lon, lat, lon) * 1852 : null;
    const rolling = !airborne && sample.onGround === true && gs !== null && gs >= minKts;
    const kind = airborne ? 'airborne' : rolling ? 'taxi' : null;
    if (!kind) { if (!away) clearStreak(); return snapshot(); }
    streak = streakKind === kind ? streak + 1 : 1;
    streakKind = kind;
    // Speed alone can spike while the sim settles: the aircraft must also have left the stand.
    if (streak < packets || (kind === 'taxi' && movedM !== null && movedM < minMeters)) return snapshot();
    away = true;
    // One ground warning per stand; the second one needs a stop in between.
    // taxi_again also needs a stand seen by this watch: after a tracker restart while
    // rolling, the remembered first warning must not turn into an instant second one.
    const stage = kind === 'airborne' ? 'airborne' : standWarned ? null
      : done.has('taxi') ? (anchor ? 'taxi_again' : null) : 'taxi';
    if (stage && !done.has(stage)) { if (!pending || pending.stage !== stage) pending = { stage, phase, at }; }
    else if (pending && pending.stage !== 'airborne') pending = null;
    return snapshot();
  };
  // The runtime calls this once the voice event was accepted (or must be dropped).
  const settle = (stage, ok) => {
    if (ok) done.add(stage);
    if (ok && stage !== 'airborne') standWarned = true;
    if (pending && pending.stage === stage) pending = null;
  };
  const snapshot = () => away && PREMATURE_TAXI_PHASES.has(phase) && runId
    ? { status: 'away', phase, runId, airborne: streakKind === 'airborne' }
    : null;
  return { observe, settle, snapshot, reset, due: () => pending };
}

// The local passenger only when one is still here (not a bush pickup at the target).
function speakerRole(manifest, flightContext) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const localPax = items.some(item => item && String(item.itemType || '').toLowerCase() === 'passenger'
    && item.pickupLocation !== 'target');
  const speaker = flightContext?.speaker || flightContext?.passenger;
  return localPax && flightContext?.supported === true && speaker && String(flightContext.baseContext || '').trim()
    ? 'passenger' : 'dispatcher';
}

const DISPATCHER_SPEAKER = Object.freeze({ name: 'Dispatch', role: 'Dispatcher der Leitstelle', gender: 'male', roleProfile: 'dispatcher', taskDomain: '' });

const TTS_STYLE = {
  passenger: 'Sprich auf Deutsch erschrocken und laut rufend, hastig und empört, als würdest du dem Piloten hinterherrufen. Nicht witzig. Wortlaut beibehalten; diese Regieanweisung nicht mitsprechen.',
  dispatcher: 'Sprich auf Deutsch wie ein Dispatcher über Funk: knapp, bestimmt, dringlich und sachlich, ohne Gefühlsausbruch. Wortlaut beibehalten; diese Regieanweisung nicht mitsprechen.'
};
const TTS_STYLE_EN = {
  passenger: 'Speak in English, startled and calling out loudly, hurried and indignant, as if shouting after the pilot. Not funny. Keep the wording exactly; do not speak this direction.',
  dispatcher: 'Speak in English like a dispatcher on the radio: short, firm, urgent and businesslike, without emotional outburst. Keep the wording exactly; do not speak this direction.'
};

const LINES = {
  passenger: {
    prepare: {
      taxi: 'Halt, stopp! Ich bin doch noch gar nicht eingestiegen!',
      taxi_again: 'Hey! Schon wieder? Warten Sie, ich bin noch nicht an Bord!',
      airborne: 'Moment, Sie sind ohne mich losgeflogen? Kehren Sie um, ich stehe noch am Platz!'
    },
    boarding: {
      taxi: 'Halt, stopp! Wir haben das Verladen noch nicht abgeschlossen!',
      taxi_again: 'Halt! Schon wieder? Die Verladung ist immer noch nicht fertig!',
      airborne: 'Wir sind in der Luft, aber die Verladung war nicht abgeschlossen! Wir müssen umkehren!'
    }
  },
  dispatcher: {
    prepare: {
      taxi: 'Dispatch an Piloten: Sofort anhalten! Boarding und Verladung haben noch nicht begonnen.',
      taxi_again: 'Dispatch, ich wiederhole: Anhalten! Ihre Ladung ist noch nicht an Bord.',
      airborne: 'Dispatch an Piloten: Sie sind ohne Ladung gestartet. Kehren Sie um und landen Sie am Abflugplatz.'
    },
    boarding: {
      taxi: 'Dispatch an Piloten: Sofort anhalten! Die Verladung ist noch nicht abgeschlossen.',
      taxi_again: 'Dispatch, ich wiederhole: Anhalten! Die Verladung ist noch nicht bestätigt.',
      airborne: 'Dispatch an Piloten: Sie sind vor Abschluss der Verladung gestartet. Kehren Sie um und landen Sie am Abflugplatz.'
    }
  }
};

const MOMENT = {
  prepare: {
    taxi: 'Moment: Du wartest noch draußen am Flugzeug auf das Einsteigen, und der Pilot rollt plötzlich ohne dich los.',
    taxi_again: 'Moment: Der Pilot hatte angehalten, rollt jetzt aber schon wieder los, obwohl du immer noch nicht eingestiegen bist.',
    airborne: 'Moment: Der Pilot ist tatsächlich ohne dich gestartet, du stehst noch am Abflugplatz.'
  },
  boarding: {
    taxi: 'Moment: Boarding und Verladen laufen noch, die Verladung ist nicht abgeschlossen, und der Pilot rollt einfach los.',
    taxi_again: 'Moment: Der Pilot hatte angehalten, rollt aber schon wieder los, obwohl die Verladung immer noch nicht abgeschlossen ist.',
    airborne: 'Moment: Der Pilot ist gestartet, obwohl die Verladung nicht abgeschlossen war. Ihr müsst umkehren und zurück zum Abflugplatz.'
  }
};

function effectPayload({ stage, phase, role, context } = {}) {
  const linePhase = phase === 'prepare' ? 'prepare' : 'boarding';
  const speaker = role === 'passenger' ? 'passenger' : 'dispatcher';
  const fallbackText = LINES[speaker][linePhase][stage];
  if (!fallbackText) return null;
  const base = String(context?.baseContext || '').trim();
  const prompt = speaker === 'passenger' && base
    ? `${base}\n\n${MOMENT[linePhase][stage]}\nRufe dem Piloten in einem kurzen, empörten Satz zu, dass er anhalten${stage === 'airborne' ? ' bzw. umkehren' : ''} soll, sinngemäß: „${fallbackText}“ Keine Witze, keine Erklärungen.${context?.toneHint ? ' ' + context.toneHint : ''}`
    : '';
  return {
    kind: 'premature_taxi', stage, phase: linePhase, speakerRole: speaker, prompt, fallbackText,
    label: stage === 'airborne' ? 'Umkehren' : 'Verladung offen', ttsStyle: TTS_STYLE[speaker], delayMs: 0
  };
}

// The English delivery for one of these styles; any other style comes back unchanged.
function ttsStyleForLanguage(style, language) {
  if (language !== 'en') return style;
  const key = Object.keys(TTS_STYLE).find(name => TTS_STYLE[name] === style);
  return key ? TTS_STYLE_EN[key] : style;
}

module.exports = { createPrematureTaxiWatch, speakerRole, effectPayload, ttsStyleForLanguage, DISPATCHER_SPEAKER,
  TTS_STYLE, TTS_STYLE_EN, LINES, STAGES, PREMATURE_TAXI_MIN_KTS, PREMATURE_TAXI_PACKETS, PREMATURE_TAXI_MIN_METERS };
