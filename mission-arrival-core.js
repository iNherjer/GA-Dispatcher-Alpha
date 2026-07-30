// Extrahierte APT-Arrival-/Handoff-Planung aus app.js.

function buildAptArrivalSceneItems(role = {}) {
    const roleId = String(role?.role || '').toLowerCase();
    const personRole = String(role?.personRole || 'person.ground_crew');
    const vehicleRole = String(role?.vehicleRole || '');
    const equipmentRole = String(role?.equipmentRole || '');
    const explicitEquipmentLabel = String(role?.equipmentLabel || '').trim();
    const isBushStripRole = /^bush_strip_/.test(roleId);
    const explicitVehicleLabel = String(role?.vehicleLabel || '').trim();
    const vehicleLabel = roleId === 'media_pickup'
        ? 'Medien-Van'
        : (roleId === 'medical_handoff'
            ? 'Medizinisches Empfangsfahrzeug'
            : (roleId === 'cargo_handoff'
                ? 'Fracht-Van'
                : (roleId === 'animal_handoff'
                    ? 'Tierpflege-Van'
                    : (explicitVehicleLabel || (isBushStripRole ? 'Bush-Fahrzeug' : 'Abholfahrzeug')))));
    const out = [];
    if (vehicleRole) {
        out.push({
            kind: 'arrival_vehicle',
            label: vehicleLabel,
            role: vehicleRole,
            objectTitle: vehicleLabel,
            forwardM: isBushStripRole ? 6 : -7,
            rightM: isBushStripRole ? 8 : 5,
            hdgOffsetDeg: isBushStripRole ? 150 : 205
        });
    }
    if (roleId === 'media_pickup') {
        out.push(
            {
                kind: 'arrival_person_editor',
                label: 'Redaktionsteam',
                role: personRole,
                objectTitle: 'Redaktionsteam',
                forwardM: 1,
                rightM: 3,
                hdgOffsetDeg: 190
            },
            {
                kind: 'arrival_person_camera',
                label: 'Kamerateam',
                role: personRole,
                objectTitle: 'Kamerateam',
                forwardM: 3,
                rightM: 4,
                hdgOffsetDeg: 215
            }
        );
        if (equipmentRole) {
            out.push({
                kind: 'arrival_equipment_camera',
                label: 'Kameraausruestung',
                role: equipmentRole,
                objectTitle: 'Kameraausruestung',
                forwardM: 0,
                rightM: 5
            });
        }
        return out;
    }
    out.push({
        kind: 'arrival_person_1',
        label: role.expectedBy || 'Empfangskontakt',
        role: personRole,
        objectTitle: role.expectedBy || 'Empfangskontakt',
        forwardM: isBushStripRole ? 0 : 2,
        rightM: isBushStripRole ? 5 : 3,
        hdgOffsetDeg: isBushStripRole ? 165 : 200
    });
    if (equipmentRole) {
        const animalSpec = roleId === 'animal_handoff'
            ? (role.animalSpec || pickAnimalTransportSceneSpec(`${role.expectedBy || ''} ${role.visibleCue || ''}`))
            : null;
        const equipmentLabel = roleId === 'cargo_handoff'
            ? 'Frachtuebergabe'
            : (roleId === 'medical_handoff'
                ? 'Medizinische Uebergabekiste'
                : (roleId === 'animal_handoff'
                    ? (animalSpec?.cargoLabel || 'Tiertransportbox')
                    : (explicitEquipmentLabel || 'Uebergabeausruestung')));
        const fixedBoxEquipment = roleId === 'medical_handoff' || roleId === 'animal_handoff';
        const equipmentTitle = roleId === 'animal_handoff'
            ? (animalSpec?.cargoTitle || 'Cardboard')
            : (fixedBoxEquipment ? 'Cardboard' : equipmentLabel);
        const equipmentCandidates = fixedBoxEquipment
            ? (roleId === 'animal_handoff' ? [equipmentTitle, 'Cardboard', 'Pallet01_03'] : ['Cardboard'])
            : undefined;
        out.push({
            kind: 'arrival_equipment_1',
            label: equipmentLabel,
            role: equipmentRole,
            objectTitle: equipmentTitle,
            titleCandidates: equipmentCandidates,
            forwardM: isBushStripRole ? -2 : 0,
            rightM: isBushStripRole ? 10 : 5,
            altOffsetFt: 1
        });
    }
    return out;
}

function offsetAptArrivalLatLon(originLat, originLon, hdgDeg, forwardM = 0, rightM = 0) {
    const lat = Number(originLat);
    const lon = Number(originLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const hdg = (Number.isFinite(Number(hdgDeg)) ? Number(hdgDeg) : 0) * Math.PI / 180;
    const f = Number.isFinite(Number(forwardM)) ? Number(forwardM) : 0;
    const r = Number.isFinite(Number(rightM)) ? Number(rightM) : 0;
    const northM = f * Math.cos(hdg) - r * Math.sin(hdg);
    const eastM = f * Math.sin(hdg) + r * Math.cos(hdg);
    const metersPerDegLat = 111320;
    const metersPerDegLon = Math.max(1, metersPerDegLat * Math.cos(lat * Math.PI / 180));
    return {
        lat: lat + northM / metersPerDegLat,
        lon: lon + eastM / metersPerDegLon
    };
}

function representativeAptArrivalAnchor(lat, lon, hdg) {
    const offset = { forwardM: -28, rightM: 32 };
    const shifted = offsetAptArrivalLatLon(lat, lon, hdg, offset.forwardM, offset.rightM);
    return {
        lat: Number.isFinite(Number(shifted?.lat)) ? shifted.lat : lat,
        lon: Number.isFinite(Number(shifted?.lon)) ? shifted.lon : lon,
        offset
    };
}

function representativeBushStripArrivalAnchor(lat, lon, hdg) {
    const offset = { forwardM: 0, rightM: 18 };
    const shifted = offsetAptArrivalLatLon(lat, lon, hdg, offset.forwardM, offset.rightM);
    return {
        lat: Number.isFinite(Number(shifted?.lat)) ? shifted.lat : lat,
        lon: Number.isFinite(Number(shifted?.lon)) ? shifted.lon : lon,
        offset
    };
}

function buildAptArrivalPlan({ isPOI = false, dest = null, mission = null, passenger = null, paxText = '', cargoText = '', profileId = '', heading = 0, missionPlanV2 = null, missionType = '', bushSpec = null } = {}) {
    if (isPOI) return null;
    const lat = Number(dest?.lat);
    const lon = Number(dest?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const role = normalizeAptArrivalRole({ profileId, passenger, paxText, cargoText, mission, missionPlanV2, missionType, bushSpec, dest });
    if (!role || role.role === 'none') return null;
    const normalizedMissionType = normalizeMissionType(missionType || mission?.missionType || passenger?.missionType || '', false);
    const bush = normalizedMissionType === 'bush'
        ? sanitizeBushMissionSpec(bushSpec || mission?.bush || passenger?.bush || null)
        : null;
    const isBushStripRole = normalizedMissionType === 'bush' && /^bush_strip_/.test(String(role.role || ''));
    const icao = String(dest?.icao || (typeof currentDestICAO !== 'undefined' ? currentDestICAO : '') || '').trim();
    const airportName = String(dest?.n || dest?.name || icao || 'Zielflugplatz').trim();
    const airportElev = (icao && typeof globalAirports !== 'undefined' && globalAirports && globalAirports[icao])
        ? globalAirports[icao].elevation
        : null;
    const rawElev = dest?.elevFt ?? dest?.elevationFt ?? dest?.elevation ?? airportElev ?? (typeof currentDestElev !== 'undefined' ? currentDestElev : null);
    const altFt = Number.isFinite(Number(rawElev)) ? Math.round(Number(rawElev)) : null;
    const hdg = Number.isFinite(Number(heading)) ? Math.round(Number(heading)) : 0;
    const anchor = isBushStripRole
        ? representativeBushStripArrivalAnchor(lat, lon, hdg)
        : representativeAptArrivalAnchor(lat, lon, hdg);
    const cues = [
        role.visibleCue,
        isBushStripRole ? 'seitlich versetzt zur Bahnmitte / Grasrand' : 'Vorfeld oder sicherer Parking-Bereich',
        isBushStripRole ? 'nicht direkt auf der aktiven Bahn oder in Hindernissen' : 'nicht auf Runway, Taxiway oder Gebaeuden'
    ].filter(Boolean);
    return {
        version: 1,
        status: 'planned',
        source: isBushStripRole ? 'remote_strip_side_offset' : 'airport-representative-offset',
        confidence: 0.5,
        icao,
        airportName,
        anchorType: isBushStripRole ? 'remote_strip_side_offset' : 'airport_representative',
        semantic: isBushStripRole ? 'strip_side_handoff' : 'apron_or_parking',
        lat: anchor.lat,
        lon: anchor.lon,
        airportLat: lat,
        airportLon: lon,
        representativeOffsetM: anchor.offset,
        footprintRadiusM: isBushStripRole ? 34 : 55,
        altFt,
        hdg,
        role: role.role,
        roleLabel: role.roleLabel,
        expectedBy: role.expectedBy,
        visibleCue: role.visibleCue,
        cues,
        roles: [role.personRole, role.vehicleRole, role.equipmentRole].filter(Boolean),
        items: buildAptArrivalSceneItems(role),
        narrativeHint: role.narrativeHint,
        snapPolicy: {
            prefer: isBushStripRole ? ['parking_position', 'apron', 'pavement'] : ['taxi_parking', 'apron', 'pavement', 'parking_position'],
            avoid: isBushStripRole ? ['occupied', 'building', 'water'] : ['occupied', 'runway', 'taxiway', 'building', 'water'],
            liveResolver: 'simconnect_facility_or_osm_apron'
        },
        bushProfileId: bush?.profileId || '',
        debug: isBushStripRole
            ? 'Bush-Strip-Fallback seitlich der Bahnmitte, bis ein Live-Snap auf OSM-Parking/Apron verfuegbar ist.'
            : 'Kompakter repraesentativer Zielflugplatzpunkt bis ein Live-Snap auf SimConnect-Parking/OSM-Apron verfuegbar ist.'
    };
}

const APT_ARRIVAL_GEO_CONTEXT_RADIUS_M = 1400;
const APT_ARRIVAL_GEO_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000;
const APT_ARRIVAL_GEO_CONTEXT_CACHE_PREFIX = 'ga_apt_arrival_geo_context_v1_';
const APT_ARRIVAL_GEO_CONTEXT_SESSION_MAX_ENTRIES = 8;
const aptArrivalGeoContextInflight = new Map();

function aptArrivalClearPersistentGeoContextCache() {
    if (typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return 0;
    let removed = 0;
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(APT_ARRIVAL_GEO_CONTEXT_CACHE_PREFIX)) {
                localStorage.removeItem(key);
                removed++;
            }
        }
    } catch (err) {
        try { console.warn('[APT ARRIVAL GEO] Persistenter Cache konnte nicht vollstaendig entfernt werden.', err); } catch (_) {}
    }
    if (removed > 0) {
        try { console.info(`[APT ARRIVAL GEO] ${removed} persistente Cache-Eintraege entfernt.`); } catch (_) {}
    }
    return removed;
}

function aptArrivalPruneSessionGeoContextCache(keepKey = '') {
    if (typeof sessionStorage === 'undefined' || typeof sessionStorage.key !== 'function') return 0;
    const entries = [];
    try {
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (!key || !key.startsWith(APT_ARRIVAL_GEO_CONTEXT_CACHE_PREFIX)) continue;
            let fetchedAt = 0;
            try { fetchedAt = Number(JSON.parse(sessionStorage.getItem(key) || 'null')?.fetchedAt || 0); } catch (_) {}
            entries.push({ key, fetchedAt });
        }
        entries.sort((a, b) => {
            if (a.key === keepKey) return -1;
            if (b.key === keepKey) return 1;
            return b.fetchedAt - a.fetchedAt;
        });
        let removed = 0;
        entries.slice(APT_ARRIVAL_GEO_CONTEXT_SESSION_MAX_ENTRIES).forEach(entry => {
            sessionStorage.removeItem(entry.key);
            removed++;
        });
        return removed;
    } catch (_) {
        return 0;
    }
}

try { window.gaAptArrivalPersistentCacheRemoved = aptArrivalClearPersistentGeoContextCache(); } catch (_) {}

function aptArrivalGeoContextCacheKey(icao = '', lat = null, lon = null, radiusM = APT_ARRIVAL_GEO_CONTEXT_RADIUS_M) {
    const code = String(icao || '').trim().toUpperCase() || 'APT';
    const la = Math.round(Number(lat) * 1000) / 1000;
    const lo = Math.round(Number(lon) * 1000) / 1000;
    return `${APT_ARRIVAL_GEO_CONTEXT_CACHE_PREFIX}${code}_${la}_${lo}_${Math.round(Number(radiusM) || radiusM)}`;
}

function aptArrivalRoundPoint(point = null) {
    const lat = Number(point?.lat);
    const lon = Number(point?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat: Math.round(lat * 1000000) / 1000000,
        lon: Math.round(lon * 1000000) / 1000000
    };
}

function aptArrivalNavM(lat1, lon1, lat2, lon2) {
    const aLat = Number(lat1), aLon = Number(lon1), bLat = Number(lat2), bLon = Number(lon2);
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
    try {
        const nav = calcNav(aLat, aLon, bLat, bLon);
        const distM = Number(nav?.dist) * 1852;
        const bearingDeg = Number(nav?.brng);
        if (Number.isFinite(distM) && Number.isFinite(bearingDeg)) return { distM, bearingDeg };
    } catch (_) {}
    const r = 6371000;
    const phi1 = aLat * Math.PI / 180;
    const phi2 = bLat * Math.PI / 180;
    const dPhi = (bLat - aLat) * Math.PI / 180;
    const dLam = (bLon - aLon) * Math.PI / 180;
    const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    const distM = 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    const y = Math.sin(dLam) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
    const bearingDeg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { distM, bearingDeg };
}

function aptArrivalGeoCategory(tags = {}) {
    const aeroway = String(tags.aeroway || '').toLowerCase();
    if (aeroway === 'parking_position') return 'parking_position';
    if (aeroway === 'apron') return 'apron';
    if (aeroway === 'runway') return 'runway';
    if (aeroway === 'taxiway') return 'taxiway';
    if (aeroway === 'hangar' || tags.building) return 'building';
    if (tags.waterway || tags.water || /water|reservoir|basin/.test(String(tags.natural || tags.landuse || '').toLowerCase())) return 'water';
    return '';
}

function aptArrivalTagSummary(tags = {}) {
    return [
        tags.name,
        tags.ref,
        tags.aeroway,
        tags.operator,
        tags.description,
        tags.note,
        tags.parking,
        tags.service,
        tags.access,
        tags.surface
    ].filter(Boolean).join(' ').toLowerCase();
}

function aptArrivalGeoElementPoint(el = {}) {
    const lat = Number(el.lat ?? el.center?.lat);
    const lon = Number(el.lon ?? el.center?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    const geom = Array.isArray(el?.geometry) ? el.geometry : [];
    const clean = geom.map(aptArrivalRoundPoint).filter(Boolean);
    if (!clean.length) return null;
    const sum = clean.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
    return { lat: sum.lat / clean.length, lon: sum.lon / clean.length };
}

function aptArrivalGeoRing(points = [], maxPoints = 80) {
    const clean = (Array.isArray(points) ? points : [])
        .map(aptArrivalRoundPoint)
        .filter(Boolean);
    if (clean.length < 4) return [];
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.abs(first.lat - last.lat) > 0.000001 || Math.abs(first.lon - last.lon) > 0.000001) return [];
    if (clean.length <= maxPoints) return clean;
    const step = Math.ceil((clean.length - 1) / (maxPoints - 1));
    const out = [];
    for (let i = 0; i < clean.length - 1; i += step) out.push(clean[i]);
    out.push(first);
    return out;
}

function aptArrivalGeoLine(points = [], maxPoints = 80) {
    const clean = (Array.isArray(points) ? points : [])
        .map(aptArrivalRoundPoint)
        .filter(Boolean);
    if (clean.length < 2) return [];
    if (clean.length <= maxPoints) return clean;
    const step = Math.ceil(clean.length / maxPoints);
    const out = [];
    for (let i = 0; i < clean.length; i += step) out.push(clean[i]);
    const last = clean[clean.length - 1];
    if (out[out.length - 1]?.lat !== last.lat || out[out.length - 1]?.lon !== last.lon) out.push(last);
    return out;
}

function aptArrivalGeoCentroid(points = []) {
    const clean = (Array.isArray(points) ? points : []).map(aptArrivalRoundPoint).filter(Boolean);
    if (!clean.length) return null;
    const usable = clean.length > 1 && clean[0].lat === clean[clean.length - 1].lat && clean[0].lon === clean[clean.length - 1].lon
        ? clean.slice(0, -1)
        : clean;
    const sum = usable.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
    return { lat: sum.lat / usable.length, lon: sum.lon / usable.length };
}

function aptArrivalPointInPolygon(point = null, polygon = []) {
    const lat = Number(point?.lat);
    const lon = Number(point?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Array.isArray(polygon) || polygon.length < 4) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const yi = Number(polygon[i]?.lat), xi = Number(polygon[i]?.lon);
        const yj = Number(polygon[j]?.lat), xj = Number(polygon[j]?.lon);
        if (![yi, xi, yj, xj].every(Number.isFinite)) continue;
        const crosses = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
        if (crosses) inside = !inside;
    }
    return inside;
}

function aptArrivalPointLineDistanceM(point = null, line = []) {
    const p = aptArrivalRoundPoint(point);
    const pts = (Array.isArray(line) ? line : []).map(aptArrivalRoundPoint).filter(Boolean);
    if (!p || pts.length < 2) return Infinity;
    const latScale = 111320;
    const lonScale = Math.max(1, latScale * Math.cos(p.lat * Math.PI / 180));
    const toXY = q => ({ x: (q.lon - p.lon) * lonScale, y: (q.lat - p.lat) * latScale });
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
        const a = toXY(pts[i]);
        const b = toXY(pts[i + 1]);
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, (-(a.x) * vx + -(a.y) * vy) / len2)) : 0;
        const x = a.x + vx * t;
        const y = a.y + vy * t;
        best = Math.min(best, Math.hypot(x, y));
    }
    return best;
}

function aptArrivalGeoZone(el = {}, category = '', airportLat = null, airportLon = null) {
    const tags = el?.tags || {};
    const center = aptArrivalGeoElementPoint(el);
    if (!center) return null;
    const ring = aptArrivalGeoRing(el?.geometry || []);
    const line = ring.length ? [] : aptArrivalGeoLine(el?.geometry || []);
    const nav = aptArrivalNavM(airportLat, airportLon, center.lat, center.lon);
    let radiusM = 0;
    (ring.length ? ring : line).forEach(p => {
        const d = aptArrivalNavM(center.lat, center.lon, p.lat, p.lon)?.distM;
        if (Number.isFinite(d)) radiusM = Math.max(radiusM, d);
    });
    return {
        type: category,
        name: String(tags.name || tags.ref || tags.aeroway || tags.building || tags.natural || tags.landuse || '').slice(0, 80),
        center: aptArrivalRoundPoint(center),
        radiusM: Math.round(radiusM),
        distM: Number.isFinite(Number(nav?.distM)) ? Math.round(Number(nav.distM)) : null,
        bearingDeg: Number.isFinite(Number(nav?.bearingDeg)) ? Math.round(Number(nav.bearingDeg)) : null,
        polygon: ring,
        line,
        bufferM: category === 'runway' ? 45 : (category === 'taxiway' ? 18 : 6)
    };
}

function normalizeAptArrivalGeoContext(raw = null, airportLat = null, airportLon = null, radiusM = APT_ARRIVAL_GEO_CONTEXT_RADIUS_M) {
    const lat = Number(airportLat);
    const lon = Number(airportLon);
    if (!raw || !Array.isArray(raw.elements) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const parkingPositions = [];
    const aprons = [];
    const avoidZones = [];
    raw.elements.forEach(el => {
        const tags = el?.tags || {};
        const category = aptArrivalGeoCategory(tags);
        if (!category) return;
        const center = aptArrivalGeoElementPoint(el);
        if (!center) return;
        const nav = aptArrivalNavM(lat, lon, center.lat, center.lon);
        const common = {
            id: `${el.type || 'el'}/${el.id || ''}`,
            name: String(tags.name || tags.ref || tags.aeroway || '').slice(0, 80),
            lat: Math.round(center.lat * 1000000) / 1000000,
            lon: Math.round(center.lon * 1000000) / 1000000,
            distM: Number.isFinite(Number(nav?.distM)) ? Math.round(Number(nav.distM)) : null,
            bearingDeg: Number.isFinite(Number(nav?.bearingDeg)) ? Math.round(Number(nav.bearingDeg)) : null,
            tags: {
                ref: tags.ref || '',
                name: tags.name || '',
                aeroway: tags.aeroway || '',
                operator: tags.operator || '',
                service: tags.service || '',
                access: tags.access || '',
                parking: tags.parking || '',
                summary: aptArrivalTagSummary(tags)
            }
        };
        if (category === 'parking_position') {
            parkingPositions.push(common);
            return;
        }
        if (category === 'apron') {
            const polygon = aptArrivalGeoRing(el?.geometry || []);
            if (polygon.length >= 4) aprons.push({ ...common, polygon, center: { lat: common.lat, lon: common.lon } });
            return;
        }
        if (['building', 'runway', 'taxiway', 'water'].includes(category)) {
            const zone = aptArrivalGeoZone(el, category, lat, lon);
            if (zone && ((zone.polygon && zone.polygon.length >= 4) || (zone.line && zone.line.length >= 2))) avoidZones.push(zone);
        }
    });
    parkingPositions.sort((a, b) => Number(a.distM ?? 999999) - Number(b.distM ?? 999999));
    aprons.sort((a, b) => Number(a.distM ?? 999999) - Number(b.distM ?? 999999));
    avoidZones.sort((a, b) => Number(a.distM ?? 999999) - Number(b.distM ?? 999999));
    return {
        source: 'overpass',
        radiusM: Math.round(Number(radiusM) || APT_ARRIVAL_GEO_CONTEXT_RADIUS_M),
        center: { lat: Math.round(lat * 100000) / 100000, lon: Math.round(lon * 100000) / 100000 },
        parkingPositions: parkingPositions.slice(0, 80),
        aprons: aprons.slice(0, 30),
        avoidZones: avoidZones.slice(0, 96),
        summary: `${parkingPositions.length} parking_position, ${aprons.length} apron, ${avoidZones.length} avoid`,
        fetchedAt: Date.now()
    };
}

async function fetchAptArrivalGeoContext(plan = null) {
    const airportLat = Number(plan?.airportLat ?? plan?.targetLat);
    const airportLon = Number(plan?.airportLon ?? plan?.targetLon);
    if (!Number.isFinite(airportLat) || !Number.isFinite(airportLon)) return null;
    const radiusM = APT_ARRIVAL_GEO_CONTEXT_RADIUS_M;
    const key = aptArrivalGeoContextCacheKey(plan?.icao || plan?.airportIcao || '', airportLat, airportLon, radiusM);
    const readCache = (store) => {
        try {
            const raw = store?.getItem?.(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || (Date.now() - Number(parsed.fetchedAt || 0)) > APT_ARRIVAL_GEO_CONTEXT_TTL_MS) {
                try { store?.removeItem?.(key); } catch (_) {}
                return null;
            }
            return parsed;
        } catch (_) {
            try { store?.removeItem?.(key); } catch (_) {}
            return null;
        }
    };
    const cached = readCache(sessionStorage);
    if (cached) return cached;
    if (aptArrivalGeoContextInflight.has(key)) return aptArrivalGeoContextInflight.get(key);
    const query = `[out:json][timeout:8];
(
  node(around:${radiusM},${airportLat},${airportLon})["aeroway"="parking_position"];
  way(around:${radiusM},${airportLat},${airportLon})["aeroway"="parking_position"];
  relation(around:${radiusM},${airportLat},${airportLon})["aeroway"="parking_position"];
  way(around:${radiusM},${airportLat},${airportLon})["aeroway"="apron"];
  relation(around:${radiusM},${airportLat},${airportLon})["aeroway"="apron"];
  way(around:${radiusM},${airportLat},${airportLon})["aeroway"~"runway|taxiway"];
  relation(around:${radiusM},${airportLat},${airportLon})["aeroway"~"runway|taxiway"];
  way(around:${radiusM},${airportLat},${airportLon})["building"];
  relation(around:${radiusM},${airportLat},${airportLon})["building"];
  way(around:${radiusM},${airportLat},${airportLon})["natural"~"water"];
  relation(around:${radiusM},${airportLat},${airportLon})["natural"~"water"];
);
out tags center geom 240;`;
    const promise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9500);
        try {
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`overpass_http_${res.status}`);
            const raw = await res.json();
            const normalized = normalizeAptArrivalGeoContext(raw, airportLat, airportLon, radiusM);
            if (normalized) {
                try { sessionStorage.setItem(key, JSON.stringify(normalized)); } catch (_) {}
                aptArrivalPruneSessionGeoContextCache(key);
            }
            return normalized;
        } catch (err) {
            console.warn('[APT ARRIVAL GEO] Overpass context unavailable', err);
            return null;
        } finally {
            clearTimeout(timeoutId);
            aptArrivalGeoContextInflight.delete(key);
        }
    })();
    aptArrivalGeoContextInflight.set(key, promise);
    return promise;
}

function aptArrivalBlockedZone(ctx = null, point = null) {
    const p = aptArrivalRoundPoint(point);
    if (!ctx || !p) return null;
    const zones = Array.isArray(ctx.avoidZones) ? ctx.avoidZones : [];
    for (const zone of zones) {
        if (Array.isArray(zone?.polygon) && zone.polygon.length >= 4 && aptArrivalPointInPolygon(p, zone.polygon)) return zone;
        if (Array.isArray(zone?.line) && zone.line.length >= 2 && aptArrivalPointLineDistanceM(p, zone.line) <= Number(zone.bufferM || 8)) return zone;
    }
    return null;
}

function aptArrivalContainingApron(ctx = null, point = null) {
    const p = aptArrivalRoundPoint(point);
    if (!ctx || !p) return null;
    return (Array.isArray(ctx.aprons) ? ctx.aprons : []).find(apron => aptArrivalPointInPolygon(p, apron.polygon)) || null;
}

function aptArrivalApronCandidatePoints(apron = null) {
    const polygon = Array.isArray(apron?.polygon) ? apron.polygon : [];
    const centroid = aptArrivalGeoCentroid(polygon) || apron?.center || null;
    const out = [];
    if (centroid) out.push(centroid);
    const vertices = polygon.slice(0, -1);
    const stride = Math.max(1, Math.floor(vertices.length / 18));
    for (let i = 0; i < vertices.length; i += stride) {
        const v = vertices[i];
        if (!v || !centroid) continue;
        out.push({
            lat: centroid.lat + (Number(v.lat) - centroid.lat) * 0.35,
            lon: centroid.lon + (Number(v.lon) - centroid.lon) * 0.35
        });
    }
    return out.map(aptArrivalRoundPoint).filter(Boolean);
}

function aptArrivalNarrativeScore(plan = null, candidate = null, source = '') {
    const role = String(plan?.role || '').toLowerCase();
    const haystack = [
        candidate?.name,
        candidate?.sourceId,
        candidate?.tags?.summary,
        candidate?.tags?.name,
        candidate?.tags?.ref,
        candidate?.tags?.operator,
        candidate?.tags?.service,
        candidate?.tags?.parking,
        candidate?.tags?.access
    ].filter(Boolean).join(' ').toLowerCase();
    let bonusM = 0;
    let penaltyM = 0;
    const hits = [];
    const hit = (label, re, bonus = 0, penalty = 0) => {
        if (!re.test(haystack)) return;
        hits.push(label);
        bonusM += bonus;
        penaltyM += penalty;
    };
    if (source === 'osm_parking_position') {
        bonusM += 70;
        hits.push('parking_position');
    }
    if (role === 'medical_handoff') {
        hit('medical_or_emergency', /medical|medizin|ambulance|rettung|rescue|emergency|hospital|clinic|helipad|heli/, 140);
        hit('general_apron', /ga|general|visitor|terminal|apron|parking|stand/, 45);
        hit('maintenance_or_fuel', /fuel|maintenance|workshop|run.?up|holding|engine/, 0, 80);
    } else if (role === 'cargo_handoff') {
        hit('cargo_or_logistics', /cargo|fracht|freight|logistic|delivery|courier|goods|hangar|service/, 130);
        hit('vehicle_access', /parking|stand|apron|access|service|delivery/, 55);
        hit('passenger_terminal', /terminal|visitor|club/, 15);
        hit('fuel_or_runup', /fuel|run.?up|holding|engine/, 0, 90);
    } else if (role === 'animal_handoff') {
        hit('quiet_or_club', /club|visitor|ga|general|parking|stand|apron|hangar|service/, 115);
        hit('animal_context', /animal|tier|veterinary|veterinaer|rescue|verein/, 160);
        hit('fuel_or_runup', /fuel|run.?up|holding|engine/, 0, 110);
    } else if (role === 'media_pickup') {
        hit('visitor_or_terminal', /visitor|terminal|club|ga|general|parking|stand|apron/, 115);
        hit('media_context', /media|press|presse|tv|news|crew/, 150);
        hit('cargo_or_fuel', /cargo|freight|fuel|maintenance|run.?up|holding/, 0, 70);
    } else if (role === 'tour_pickup') {
        hit('visitor_or_club', /visitor|terminal|club|ga|general|parking|stand|apron/, 130);
        hit('industrial', /cargo|freight|fuel|maintenance|run.?up|holding/, 0, 80);
    } else {
        hit('ga_or_club', /club|ga|general|visitor|parking|stand|apron/, 100);
        hit('utility_bad_fit', /fuel|run.?up|holding|engine/, 0, 70);
    }
    if (!haystack.trim()) penaltyM += 20;
    return {
        adjustmentM: Math.max(-180, Math.min(160, penaltyM - bonusM)),
        hits: hits.slice(0, 5)
    };
}

function pickAptArrivalOsmPlacement(ctx = null, plan = null) {
    if (!ctx || typeof ctx !== 'object' || !plan) return null;
    const airportLat = Number(plan.airportLat);
    const airportLon = Number(plan.airportLon);
    const baseHdg = Number.isFinite(Number(plan.hdg)) ? Number(plan.hdg) : 0;
    const parking = Array.isArray(ctx.parkingPositions) ? ctx.parkingPositions : [];
    const apronCount = Array.isArray(ctx.aprons) ? ctx.aprons.length : 0;
    const parkingCandidates = parking.map(p => {
        const point = aptArrivalRoundPoint(p);
        const blocked = aptArrivalBlockedZone(ctx, point);
        const apron = aptArrivalContainingApron(ctx, point);
        const distM = aptArrivalNavM(airportLat, airportLon, point?.lat, point?.lon)?.distM;
        const narrative = aptArrivalNarrativeScore(plan, p, 'osm_parking_position');
        return {
            point,
            sourceId: p.id || '',
            name: p.name || p.tags?.ref || '',
            tags: p.tags || {},
            blocked,
            apron,
            contextMatch: narrative.hits,
            score: (Number.isFinite(distM) ? distM : 999999) + (apron ? 0 : 180) + narrative.adjustmentM + (blocked ? 999999 : 0)
        };
    }).filter(c => c.point && !c.blocked).sort((a, b) => a.score - b.score);
    const apronCandidates = [];
    (Array.isArray(ctx.aprons) ? ctx.aprons : []).forEach(apron => {
        aptArrivalApronCandidatePoints(apron).forEach(point => {
            if (!aptArrivalPointInPolygon(point, apron.polygon)) return;
            const blocked = aptArrivalBlockedZone(ctx, point);
            if (blocked) return;
            const distM = aptArrivalNavM(airportLat, airportLon, point.lat, point.lon)?.distM;
            const narrative = aptArrivalNarrativeScore(plan, apron, 'osm_apron');
            apronCandidates.push({
                point,
                sourceId: apron.id || '',
                name: apron.name || '',
                tags: apron.tags || {},
                contextMatch: narrative.hits,
                score: (Number.isFinite(distM) ? distM : 999999) + narrative.adjustmentM
            });
        });
    });
    apronCandidates.sort((a, b) => a.score - b.score);
    const alternates = {
        parking: parkingCandidates.slice(0, 24).map(c => ({
            lat: c.point.lat,
            lon: c.point.lon,
            sourceId: c.sourceId || '',
            name: c.name || '',
            source: 'osm_parking_position',
            contextMatch: Array.isArray(c.contextMatch) ? c.contextMatch : []
        })),
        apron: apronCandidates.slice(0, 18).map(c => ({
            lat: c.point.lat,
            lon: c.point.lon,
            sourceId: c.sourceId || '',
            name: c.name || '',
            source: 'osm_apron',
            contextMatch: Array.isArray(c.contextMatch) ? c.contextMatch : []
        }))
    };
    if (parkingCandidates.length) {
        const best = parkingCandidates[0];
        return {
            source: 'osm_parking_position',
            anchorType: 'osm_parking_position',
            point: best.point,
            hdg: baseHdg,
            confidence: best.apron ? 0.84 : 0.76,
            reason: best.apron ? 'nearest_osm_parking_position_on_apron' : 'nearest_osm_parking_position',
            sourceId: best.sourceId,
            name: best.name,
            contextMatch: best.contextMatch || [],
            counts: { parking: parking.length, aprons: apronCount, avoidZones: Array.isArray(ctx.avoidZones) ? ctx.avoidZones.length : 0 },
            alternates
        };
    }
    if (apronCandidates.length) {
        const best = apronCandidates[0];
        return {
            source: 'osm_apron',
            anchorType: 'osm_apron',
            point: best.point,
            hdg: baseHdg,
            confidence: 0.72,
            reason: parking.length ? 'all_osm_parking_positions_blocked_use_apron' : 'no_osm_parking_position_use_apron',
            sourceId: best.sourceId,
            name: best.name,
            contextMatch: best.contextMatch || [],
            counts: { parking: parking.length, aprons: apronCount, avoidZones: Array.isArray(ctx.avoidZones) ? ctx.avoidZones.length : 0 },
            alternates
        };
    }
    return null;
}

async function resolveAptArrivalPlanPlacement(plan = null) {
    if (!plan || typeof plan !== 'object') return plan || null;
    const ctx = await fetchAptArrivalGeoContext(plan);
    const placement = pickAptArrivalOsmPlacement(ctx, plan);
    if (!placement?.point) {
        return {
            ...plan,
            snapStatus: {
                status: ctx ? 'fallback' : 'unavailable',
                source: plan.source || 'airport-representative-offset',
                reason: ctx ? 'no_safe_osm_parking_or_apron_candidate' : 'overpass_unavailable',
                osmContextSummary: ctx?.summary || '',
                resolvedAt: Date.now()
            }
        };
    }
    const snapStatus = {
        status: 'resolved',
        source: placement.source,
        reason: placement.reason,
        sourceId: placement.sourceId || '',
        name: placement.name || '',
        contextMatch: Array.isArray(placement.contextMatch) ? placement.contextMatch : [],
        counts: placement.counts || null,
        liveOccupancy: 'pending_tracker_or_simconnect',
        osmContextSummary: ctx?.summary || '',
        resolvedAt: Date.now()
    };
    return {
        ...plan,
        source: placement.source,
        confidence: placement.confidence,
        anchorType: placement.anchorType,
        semantic: placement.source === 'osm_apron' ? 'safe_osm_apron' : 'safe_osm_parking_position',
        lat: placement.point.lat,
        lon: placement.point.lon,
        hdg: placement.hdg,
        footprintRadiusM: placement.source === 'osm_apron' ? 42 : 34,
        osmPlacement: {
            source: placement.source,
            point: placement.point,
            reason: placement.reason,
            sourceId: placement.sourceId || '',
            name: placement.name || '',
            contextMatch: Array.isArray(placement.contextMatch) ? placement.contextMatch : []
        },
        placementCandidates: placement.alternates || null,
        snapStatus,
        snapPolicy: {
            ...(plan.snapPolicy || {}),
            resolvedBy: 'app_osm_preflight',
            resolvedAt: snapStatus.resolvedAt,
            requiresLiveOccupancyCheck: true
        },
        debug: `APT placement via ${placement.source}: ${placement.reason}.`
    };
}

function attachAptArrivalPlanToMissionTruth(missionTruth = null, aptArrivalPlan = null) {
    if (!aptArrivalPlan || typeof aptArrivalPlan !== 'object') return missionTruth || null;
    const base = (missionTruth && typeof missionTruth === 'object') ? { ...missionTruth } : {};
    base.arrivalScene = {
        type: 'apt_arrival_plan',
        role: aptArrivalPlan.role || '',
        roleLabel: aptArrivalPlan.roleLabel || '',
        expectedBy: aptArrivalPlan.expectedBy || '',
        anchorType: aptArrivalPlan.anchorType || '',
        source: aptArrivalPlan.source || '',
        confidence: aptArrivalPlan.confidence ?? null,
        lat: aptArrivalPlan.lat,
        lon: aptArrivalPlan.lon,
        altFt: aptArrivalPlan.altFt,
        snapPolicy: aptArrivalPlan.snapPolicy || null,
        snapStatus: aptArrivalPlan.snapStatus || null,
        osmPlacement: aptArrivalPlan.osmPlacement || null,
        placementCandidates: aptArrivalPlan.placementCandidates || null,
        items: Array.isArray(aptArrivalPlan.items) ? aptArrivalPlan.items : []
    };
    const cues = Array.isArray(base.visibleCues) ? base.visibleCues.slice() : [];
    (Array.isArray(aptArrivalPlan.cues) ? aptArrivalPlan.cues : []).forEach(cue => {
        const s = String(cue || '').trim();
        if (s && !cues.includes(s)) cues.push(s);
    });
    if (cues.length) base.visibleCues = cues;
    return base;
}
