const PILOT_PIN_PATTERN = /^\d{4,8}$/;
const PILOT_PIN_REQUIREMENT = 'Der PIN muss aus 4 bis 8 Ziffern bestehen.';

function normalizePilotPin(value) {
  return String(value || '').trim();
}

function isValidPilotPin(value) {
  return PILOT_PIN_PATTERN.test(normalizePilotPin(value));
}

module.exports = {
  PILOT_PIN_PATTERN,
  PILOT_PIN_REQUIREMENT,
  isValidPilotPin,
  normalizePilotPin
};
