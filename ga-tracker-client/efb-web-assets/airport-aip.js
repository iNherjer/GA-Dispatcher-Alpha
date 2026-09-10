// Generated from airport-aip.js by sync-efb-web-assets.js. Do not edit.
var AIP_POPUP_ROUTES = {
  AT: '/at/en/vfr/',
  DE: '/de/en/vfr/',
  FR: '/fr/aeroports/',
  GB: '/uk/vfr/',
  NL: '/nl/en/vfr/'
};
function getAirportCountryCode(icao) {
  var _globalAirports;
  var fallbackCountry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var cc = String(fallbackCountry || typeof globalAirports !== 'undefined' && ((_globalAirports = globalAirports) === null || _globalAirports === void 0 || (_globalAirports = _globalAirports[icao]) === null || _globalAirports === void 0 ? void 0 : _globalAirports.country) || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : '';
}
function hasAipCoverageForAirport(icao) {
  var fallbackCountry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  if (!icao || icao === 'GPS' || icao === 'POI') return false;
  return Boolean(resolveAipCountryCode(icao, fallbackCountry));
}
function resolveAipCountryCode(icao) {
  var fallbackCountry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var cc = getAirportCountryCode(icao, fallbackCountry);
  if (cc && AIP_POPUP_ROUTES[cc]) return cc;
  var code = String(icao || '').trim().toUpperCase();
  if (code.startsWith('LO')) return 'AT';
  if (code.startsWith('LF')) return 'FR';
  if (code.startsWith('EH')) return 'NL';
  if (code.startsWith('EG')) return 'GB';
  if (code.startsWith('ED') || code.startsWith('ET')) return 'DE';
  return null;
}
function getAipPopupUrl(icao) {
  var fallbackCountry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var cc = resolveAipCountryCode(icao, fallbackCountry);
  if (!cc) return null;
  var route = AIP_POPUP_ROUTES[cc];
  return `https://aip.aero${route}?${encodeURIComponent(String(icao).trim().toUpperCase())}=`;
}
if (typeof module === 'object' && module.exports) module.exports = {
  getAipPopupUrl
};
