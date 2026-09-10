const AIP_POPUP_ROUTES = {
    AT: '/at/en/vfr/',
    DE: '/de/en/vfr/',
    FR: '/fr/aeroports/',
    GB: '/uk/vfr/',
    NL: '/nl/en/vfr/'
};

function getAirportCountryCode(icao, fallbackCountry = '') {
    const cc = String(fallbackCountry || (typeof globalAirports !== 'undefined' && globalAirports?.[icao]?.country) || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(cc) ? cc : '';
}

function hasAipCoverageForAirport(icao, fallbackCountry = '') {
    if (!icao || icao === 'GPS' || icao === 'POI') return false;
    return Boolean(resolveAipCountryCode(icao, fallbackCountry));
}

function resolveAipCountryCode(icao, fallbackCountry = '') {
    const cc = getAirportCountryCode(icao, fallbackCountry);
    if (cc && AIP_POPUP_ROUTES[cc]) return cc;

    const code = String(icao || '').trim().toUpperCase();
    if (code.startsWith('LO')) return 'AT';
    if (code.startsWith('LF')) return 'FR';
    if (code.startsWith('EH')) return 'NL';
    if (code.startsWith('EG')) return 'GB';
    if (code.startsWith('ED') || code.startsWith('ET')) return 'DE';
    return null;
}

function getAipPopupUrl(icao, fallbackCountry = '') {
    const cc = resolveAipCountryCode(icao, fallbackCountry);
    if (!cc) return null;
    const route = AIP_POPUP_ROUTES[cc];
    return `https://aip.aero${route}?${encodeURIComponent(String(icao).trim().toUpperCase())}=`;
}


if (typeof module === 'object' && module.exports) module.exports = { getAipPopupUrl };
