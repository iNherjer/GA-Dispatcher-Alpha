'use strict';

const PA24_DETECTION_PATTERN = /(?:\bpa\s*-?\s*24\b|\bpa24\b|comanche)/i;

function detectPa24Aircraft(aircraft = {}) {
  const title = String(aircraft.title || '').trim();
  const model = String(aircraft.model || '').trim();
  const type = String(aircraft.type || '').trim();
  const haystack = [title, model, type].filter(Boolean).join(' ');
  return {
    detected: PA24_DETECTION_PATTERN.test(haystack),
    title,
    model,
    type,
    haystack
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function chooseProbeValue(baseline, options = {}) {
  const min = finiteNumber(options.min, 0);
  const max = Math.max(min, finiteNumber(options.max, 200));
  const delta = Math.max(0.1, finiteNumber(options.delta, 5));
  const current = Math.min(max, Math.max(min, finiteNumber(baseline, min)));
  if (current + delta <= max) return Math.round((current + delta) * 1000) / 1000;
  if (current - delta >= min) return Math.round((current - delta) * 1000) / 1000;
  return current === min ? max : min;
}

function chooseFreeSeatAndCharacter(lvars = {}) {
  const occupiedCharacters = new Set();
  const freeSeats = [];
  for (let seat = 1; seat <= 4; seat += 1) {
    const character = Math.round(finiteNumber(lvars[`Seat${seat}Character`], 0));
    if (character > 0) occupiedCharacters.add(character);
    if (seat >= 2 && character <= 0) freeSeats.push(seat);
  }
  const seat = [4, 3, 2].find((candidate) => freeSeats.includes(candidate)) || null;
  let character = null;
  for (let candidate = 4; candidate >= 1; candidate -= 1) {
    if (!occupiedCharacters.has(candidate)) {
      character = candidate;
      break;
    }
  }
  return {
    seat,
    character,
    available: Number.isFinite(seat) && Number.isFinite(character),
    occupiedCharacters: [...occupiedCharacters].sort((a, b) => a - b)
  };
}

function round(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function payloadSummary(snapshot = {}) {
  const lvars = snapshot.lvars || {};
  const sim = snapshot.sim || {};
  const stations = Array.isArray(sim.payloadStations) ? sim.payloadStations : [];
  return {
    at: snapshot.at || new Date().toISOString(),
    title: String(snapshot.aircraft?.title || ''),
    seats: [1, 2, 3, 4].map((seat) => Math.round(finiteNumber(lvars[`Seat${seat}Character`], 0))),
    baggageWeightLbs: round(lvars.BaggageWeight),
    baggageAWeightLbs: round(lvars.BaggageAWeight),
    baggageBWeightLbs: round(lvars.BaggageBWeight),
    baggageCWeightLbs: round(lvars.BaggageCWeight),
    accuPayloadWeightLbs: round(lvars.PayloadWeight),
    accuTotalWeightLbs: round(lvars.TotalWeight),
    accuEmptyWeightLbs: round(lvars.EmptyWeight),
    accuGrossWeightLbs: round(lvars.GrossWeight),
    simTotalWeightLbs: round(sim.totalWeightLbs),
    simEmptyWeightLbs: round(sim.emptyWeightLbs),
    simFuelWeightLbs: round(sim.fuelWeightLbs),
    simPayloadStationCount: Math.round(finiteNumber(sim.payloadStationCount, 0)),
    simPayloadWeightLbs: round(stations.reduce((sum, row) => {
      const index = Math.round(finiteNumber(row?.index, 0));
      if (index < 1 || index > Math.round(finiteNumber(sim.payloadStationCount, 0))) return sum;
      return sum + finiteNumber(row?.weightLbs, 0);
    }, 0))
  };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = {
  PA24_DETECTION_PATTERN,
  chooseFreeSeatAndCharacter,
  chooseProbeValue,
  csvEscape,
  detectPa24Aircraft,
  finiteNumber,
  payloadSummary,
  round
};
