"use strict";

const farewellCore = require('../mission-farewell-voice-core.js');

// Standard APT branch of passenger-voice.js::_atTargetPrompt. Context and role
// hints come from the App recipe; live weather/motion come from the tracker.
function buildApproachPrompt(context, flightData = {}) {
  if (!context?.supported || context.mode !== 'passenger' || !context.baseContext) return null;
  const pax = context.passenger || {};
  let notes = '';
  if (pax.gTolerance === 'niedrig' && Number((flightData.gForce || 1).toFixed(2)) > 1.55) notes += ' Die G-Belastung vorhin war spürbar für mich.';
  if (pax.bankTolerance === 'niedrig' && Number(Math.abs(flightData.bankDeg || 0).toFixed(1)) > 34) notes += ' Die Kurven haben mich etwas mitgenommen.';
  const wx = farewellCore.weatherContext(flightData);
  if (wx) notes += ` ${wx}`;
  notes += farewellCore.weatherMismatchHint({ ...context, briefingWeather: context.briefingWeather || {} }, flightData);
  return `${context.baseContext}

Moment: Wir nähern uns ${context.dest || 'dem Flughafen'} — Landung gleich.${notes}
Reagiere spontan auf diesen Augenblick — was siehst du, was geht dir durch den Kopf? Wenn Wetter oder Bedingungen nicht ideal sind, erwähne es kurz aber bleib positiv.${context.aptArrivalApproachHint || ''}${context.inspectionLiveHint || ''}${context.professionalProgressHint || ''}${context.bushContinuityHint || ''}${context.driftGuard || ''} Max 2-3 Sätze.${context.toneHint || ''}`;
}

module.exports = { buildApproachPrompt };
