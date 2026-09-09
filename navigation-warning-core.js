(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./navigation-warning-audio') : root && root.GANavigationWarningAudio);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GANavigationWarnings = api;
})(typeof window !== 'undefined' ? window : null, function(audio) {
'use strict';
// Extracted standalone rules; no DOM, network or playback dependencies.
function vpPointInPoly(pt, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > pt.lat) !== (yj > pt.lat)) && (pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function airspaceLimitToFt(lim) {
    if (!lim) return null;
    if (lim.referenceDatum === 0 && lim.value === 0) return 0;
    if (lim.unit === 6) return lim.value * 100;
    if (lim.unit === 1) return lim.value;
    if (lim.unit === 0) return Math.round(lim.value * 3.28084);
    return lim.value;
}

function getAirspaceVerticalBandFt(as, terrainFt) {
    if (!as?.lowerLimit || !as?.upperLimit) return null;
    const baseLowerFt = airspaceLimitToFt(as.lowerLimit);
    const baseUpperFt = airspaceLimitToFt(as.upperLimit);
    if (baseLowerFt === null || baseUpperFt === null) return null;
    const groundFt = Number(terrainFt) || 0;
    const isLowerAgl = !!(as._lowerIsAgl || as.lowerLimit.referenceDatum === 0);
    const isUpperAgl = !!(as._upperIsAgl || as.upperLimit.referenceDatum === 0);
    const lowerFt = isLowerAgl ? (groundFt + baseLowerFt) : baseLowerFt;
    const upperFt = isUpperAgl ? (groundFt + baseUpperFt) : baseUpperFt;
    return { lowerFt, upperFt, baseLowerFt, baseUpperFt, isLowerAgl, isUpperAgl };
}

function isPointInsideAirspace(as, lat, lon) {
    if (!as?.geometry) return false;
    const polys = [];
    if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);
    else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
    for (const poly of polys) {
        if (vpPointInPoly({ lat, lon }, poly)) return true;
    }
    return false;
}

function _awTypeKey(as) {
    const t = as.type, cls = as.icaoClass;
    if (t === 4)                return 'aw-ctr';      // CTR (Kontrollzone)
    if (cls === 2)              return 'aw-charlie';  // Class C
    if (cls === 3 || t === 0)   return 'aw-delta';    // Class D
    if (t === 7 || t === 26)    return 'aw-ctr';      // TMA / CTA → wie CTR ansagen
    if (t === 5 || t === 27)    return 'aw-tmz';      // TMZ
    if ((t === 6 || t === 28) && /\bPARA\b/i.test(as.name || '')) return 'aw-para'; // Fallschirmgebiet
    if (t === 6 || t === 28)    return 'aw-rmz';      // RMZ
    if (t === 1)                return 'aw-edr';      // ED-R Restricted (Buchstaben E-D-R)
    return null;   // Danger/Prohibited/FIS → kein Sprach-Alert
}

function _awTypeClips(as) {
    const key = _awTypeKey(as);
    return key ? [key] : [];
}

function _awMinKey(min) {
    const n = Math.round(min);
    const k = ['','aw-1min','aw-2min','aw-3min','aw-4min','aw-5min',
                  'aw-6min','aw-7min','aw-8min','aw-9min','aw-10min'];
    return (n >= 1 && n <= 10) ? k[n] : null;
}

function _awFreqToClips(valueStr, isSquawk) {
    const prefix = isSquawk ? 'aw-sqwk' : 'aw-freq';
    const clips = [prefix];
    // Trailing-Nullen nach dem Komma entfernen (130.000 → 130)
    let s = valueStr.toString().trim().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    for (const ch of s) {
        if (ch >= '0' && ch <= '9') clips.push(_awDigitClip(parseInt(ch, 10)));
        else if (ch === '.' || ch === ',') clips.push('aw-komma');
        // Sonstige Zeichen (Leerzeichen, Bindestrich) überspringen
    }
    return clips.filter(Boolean);
}

function calcNav(lat1, lon1, lat2, lon2) {
    const R = 3440, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return { dist, brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) };
}

function getDestinationPoint(lat, lon, distNM, bearing) {
    const R = 3440.065, lat1 = lat * Math.PI / 180, lon1 = lon * Math.PI / 180, brng = bearing * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNM / R) + Math.cos(lat1) * Math.sin(distNM / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNM / R) * Math.cos(lat1), Math.cos(distNM / R) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function legDistanceToSegmentNm(lat, lon, a, b) {
    const refLat = (a.lat + b.lat + lat) / 3;
    const cosRef = Math.cos(refLat * Math.PI / 180);

    const ax = (a.lng || a.lon) * cosRef * 60;
    const ay = a.lat * 60;
    const bx = (b.lng || b.lon) * cosRef * 60;
    const by = b.lat * 60;
    const px = lon * cosRef * 60;
    const py = lat * 60;

    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const denom = abx * abx + aby * aby;
    const t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
    const cx = ax + t * abx, cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
}
function _awDigitClip(d) { return Number.isInteger(d) && d >= 0 && d <= 9 ? (d === 2 ? 'aw-zwo' : `aw-d${d}`) : null; }
function digits(s) { return String(s).split('').map(c => _awDigitClip(parseInt(c, 10))).filter(Boolean); }
function frequencyClips(as, enabled = true) {
    const primary = enabled && (as.frequencies?.find(f => f.primary) || as.frequencies?.[0]);
    return primary?.value ? _awFreqToClips(primary.value, /XPDR|SQK|SQUAWK|TRANSP/.test((primary.name || '').toUpperCase())) : [];
}
function waypointClips(brng, dist) {
    return ['aw-wp-erreicht', 'aw-neuer-kurs', ...digits(String(Math.round(brng)).padStart(3, '0')), 'aw-grad', 'aw-fuer', ...digits(String(Math.round(dist))), 'aw-meilen'];
}
function createAirspaceDetector() {
    const _awState = new Map(), _awTypeChain = new Map(), _AW_CHAIN_GAP = 45000;
    return { reset() { _awState.clear(); _awTypeChain.clear(); },
      evaluate({ airspaces: activeAirspaces = [], points: predPoints = [], gps = null, lastTerrainFt = 0, now = Date.now(), readFreq = true }) {
        const events = [];
    const PERSIST = 5000;
    const STICKY  = 3000;

    const getTerrainForPoint = (pt) => Number(pt?.terrainFt ?? lastTerrainFt) || 0;

    // ── Pass 1: Schnittstellen für alle Lufträume berechnen ───────────────────
    const crossings = [];
    for (const as of activeAirspaces) {
        if (!as.geometry) continue;
        if (as.type === 33) continue;

        const typeKey = _awTypeKey(as) || 'aw-ctr';
        const bandBase = getAirspaceVerticalBandFt(as, 0);
        if (!bandBase) continue;
        const lowerFt = bandBase.baseLowerFt;
        const upperFt = bandBase.baseUpperFt;
        const lowerIsAgl = bandBase.isLowerAgl;
        const upperIsAgl = bandBase.isUpperAgl;

        let earliest5 = null, earliest2 = null, insideNow = false;

        // insideNow: Flugzeug befindet sich JETZT in diesem Luftraum (GPS-Position, nicht Prediction)
        // Nur so wird sichergestellt, dass der zweite Luftraum erst angesagt wird wenn der erste
        // tatsächlich durchflogen wird — nicht schon 1 Minute vorher.
        const _gps = gps;
        if (_gps && _gps.alt !== undefined && _gps.lat !== undefined) {
            const bandNow = getAirspaceVerticalBandFt(as, getTerrainForPoint(_gps));
            if (!bandNow) continue;
            const _gAlt = _gps.alt; // bereits in Feet (sync.js)
            if (_gAlt >= bandNow.lowerFt - 200 && _gAlt <= bandNow.upperFt + 200) {
                if (isPointInsideAirspace(as, _gps.lat, _gps.lon)) insideNow = true;
            }
        }

        for (const pt of predPoints) {
            const bandPt = getAirspaceVerticalBandFt(as, getTerrainForPoint(pt));
            if (!bandPt) continue;
            if (pt.alt < bandPt.lowerFt - 500 || pt.alt > bandPt.upperFt + 300) continue;
            if (!isPointInsideAirspace(as, pt.lat, pt.lon)) continue;
            if (pt.min <= 5 && (earliest5 === null || pt.min < earliest5)) earliest5 = pt.min;
            if (pt.min <= 2 && (earliest2 === null || pt.min < earliest2)) earliest2 = pt.min;
        }

        if (earliest5 === null && earliest2 === null && !insideNow) continue;

        const asKey = `${as.type}_${as.name || 'x'}_${Math.round(lowerFt)}`;
        crossings.push({ as, typeKey, lowerFt, upperFt, lowerIsAgl, upperIsAgl, earliest5, earliest2, insideNow, asKey });
    }

    // ── Pass 2: Nächsten noch nicht eingetretenen Luftraum bestimmen ──────────
    // Lufträume in denen man schon drin ist dürfen weiterhin passieren.
    // Von den noch nicht eingetretenen: nur den nächsten warnen (blockiert weiter entfernte).
    const unentered = crossings
        .filter(c => !c.insideNow)
        .sort((a, b) => Math.min(a.earliest5 ?? 99, a.earliest2 ?? 99)
                      - Math.min(b.earliest5 ?? 99, b.earliest2 ?? 99));
    const nearestKey = unentered.length > 0 ? unentered[0].asKey : null;

    // Gleiche-Klasse Ketten-Update:
    // • Alle aktuell sichtbaren typeKeys als aktiv markieren
    // • Falls das Flugzeug gerade in einer ANDEREN Klasse ist → Kette der restlichen Klassen brechen
    const insideTypeKeys = new Set(crossings.filter(c => c.insideNow && c.typeKey).map(c => c.typeKey));
    for (const c of crossings) {
        if (!c.typeKey) continue;
        if (!_awTypeChain.has(c.typeKey)) _awTypeChain.set(c.typeKey, { lastActiveMs: 0, warnedAt: 0 });
        _awTypeChain.get(c.typeKey).lastActiveMs = now;
    }
    // Wenn drin in einer Klasse, breche Ketten aller anderen (bereits-gewarnte) Klassen
    if (insideTypeKeys.size > 0) {
        for (const [tk, ch] of _awTypeChain) {
            if (!insideTypeKeys.has(tk) && ch.warnedAt > 0) {
                ch.warnedAt = 0; // Kette unterbrochen durch andere Klasse
            }
        }
    }

    // ── Pass 3: Warnungen ausspielen ──────────────────────────────────────────
    for (const c of crossings) {
        const { as, typeKey, earliest5, earliest2, insideNow, asKey } = c;
        const in5 = earliest5 !== null;
        const in2 = earliest2 !== null;

        // Gleiche-Klasse Ketten-Unterdrückung:
        // Wenn wir bereits für diesen typeKey gewarnt haben UND die Kette noch aktiv ist
        // (kein langer Gap ohne Luftraum dieser Klasse), die Warnung unterdrücken.
        let chainSuppressed = false;
        if (!insideNow && typeKey) {
            const ch = _awTypeChain.get(typeKey);
            if (ch && ch.warnedAt > 0 && (now - ch.lastActiveMs) < _AW_CHAIN_GAP) {
                chainSuppressed = true;
            }
        }

        // Nur warnen wenn: bereits drin ODER nächster uneingetretener Luftraum UND nicht Ketten-unterdrückt
        const allowed = (insideNow || asKey === nearestKey) && !chainSuppressed;

        if (!_awState.has(asKey))
            _awState.set(asKey, { t5: false, t2: false, firstSeen5: 0, firstSeen2: 0, lastSeen5: 0, lastSeen2: 0 });
        const st = _awState.get(asKey);

        if (!allowed) {
            // Timer zurücksetzen damit Warnung feuert sobald Luftraum als nächstes drankommt
            if (st.lastSeen5 && (now - st.lastSeen5) > STICKY) { st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0; }
            if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) { st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0; }
            continue;
        }

        // 2-min Warnung
        if (in2) {
            st.lastSeen2 = now;
            if (!st.firstSeen2) st.firstSeen2 = now;
            if (!st.t2 && (now - st.firstSeen2) >= PERSIST) {
                st.t2 = true;
                events.push({ as, asKey, kind: 'airspace', minutes: Math.round(earliest2), level: 2,
                    clips: ['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest2)) || 'aw-2min', ...frequencyClips(as, readFreq)] });
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) {
            st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0;
        }

        // 5-min Warnung (nur wenn kein 2-min Schnitt aktiv)
        if (in5 && !in2) {
            st.lastSeen5 = now;
            if (!st.firstSeen5) st.firstSeen5 = now;
            if (!st.t5 && (now - st.firstSeen5) >= PERSIST) {
                st.t5 = true;
                events.push({ as, asKey, kind: 'airspace', minutes: Math.round(earliest5), level: 5,
                    clips: ['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest5)) || 'aw-5min', ...frequencyClips(as, readFreq)] });
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (!in2 && st.lastSeen5 && (now - st.lastSeen5) > STICKY) {
            st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0;
        }
    }
        return events;
    }};
}
function terrainThreat(terrainFt, aircraftFt) {
    if (!Number.isFinite(terrainFt)) return 'unknown';
    return aircraftFt - terrainFt < 500 ? 'red' : aircraftFt - terrainFt < 1000 ? 'amber' : 'green';
}
function createTerrainDetector() {
    let lastAlert = 0;
    return { evaluate(points, gs, now = Date.now()) {
        const immediate = points.some(p => p.min <= 0.25 && terrainThreat(p.terrainFt, p.alt) === 'red');
        if (!immediate || (gs > 5 && gs < 75) || now - lastAlert <= 15000) return [];
        lastAlert = now;
        return [{ kind: 'terrain', text: 'Terrain voraus', clips: ['taws-whoop', 'taws-alert'] }];
    }, reset() { lastAlert = 0; } };
}
function predictions(gps, gs, vs) {
    return [0.25, 1, 2, 3, 4, 5, 10].map(min => ({ ...getDestinationPoint(gps.lat, gps.lon, gs * min / 60, gps.hdg), min, alt: Math.max(0, gps.alt + vs * min) }));
}
function predictionBounds(points, padding = 0.08) {
    return { west: Math.min(...points.map(p => p.lon)) - padding, east: Math.max(...points.map(p => p.lon)) + padding,
        south: Math.max(-90, Math.min(...points.map(p => p.lat)) - padding), north: Math.min(90, Math.max(...points.map(p => p.lat)) + padding) };
}
function createWaypointDetector() {
    let routeKey = '', index = 1;
    return { evaluate(gps, route = [], identity = '') {
        if (route.length < 2) { routeKey = ''; return []; }
        const key = identity + ':' + route.map(p => `${p.lat.toFixed(4)},${(p.lng ?? p.lon).toFixed(4)}`).join('|');
        if (key !== routeKey) {
            routeKey = key;
            let best = Infinity;
            for (let i = 0; i < route.length - 1; i++) {
                const d = legDistanceToSegmentNm(gps.lat, gps.lon, route[i], route[i + 1]);
                if (d < best) { best = d; index = i + 1; }
            }
        }
        const target = route[index], previous = route[index - 1];
        const nav = calcNav(gps.lat, gps.lon, target.lat, target.lng ?? target.lon);
        const inbound = calcNav(previous.lat, previous.lng ?? previous.lon, target.lat, target.lng ?? target.lon).brng;
        const angle = ((nav.brng - inbound + 540) % 360 - 180) * Math.PI / 180;
        const along = nav.dist * Math.cos(angle), cross = Math.abs(nav.dist * Math.sin(angle));
        if (along > 0.5 || along < -0.5 || cross > 2.5 || index >= route.length - 1) return [];
        const reached = target; index++;
        const next = route[index], course = calcNav(gps.lat, gps.lon, next.lat, next.lng ?? next.lon);
        return [{ kind: 'waypoint', waypointIndex: index, text: `Wegpunkt ${reached.name || index} erreicht · Kurs ${course.brng}° · ${Math.round(course.dist)} NM`, clips: waypointClips(course.brng, course.dist) }];
    }, reset() { routeKey = ''; } };
}
return Object.assign({ createAirspaceDetector, createTerrainDetector, createWaypointDetector, terrainThreat, predictions, predictionBounds, frequencyClips, waypointClips, getAirspaceVerticalBandFt, isPointInsideAirspace, calcNav }, audio);
});
