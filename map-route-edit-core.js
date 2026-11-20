(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GAMapRouteEditCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function point(p) {
        if (!p || typeof p.lat !== 'number' || typeof (p.lng ?? p.lon) !== 'number') return null;
        const lat = p.lat, lng = p.lng ?? p.lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        const out = { lat, lng, lon: lng };
        if (typeof p.elevationFt === 'number' && Number.isFinite(p.elevationFt)) out.elevationFt = p.elevationFt;
        ['name', 'icao', 'rppAirportIcao', 'poiChainPointId', 'radioKind'].forEach(k => {
            if (typeof p[k] === 'string') out[k] = p[k].slice(0, 180);
        });
        ['isPOI', 'isPoiChainEndpoint', 'isPoiChainReturnHome', 'profilePoint'].forEach(k => { if (p[k] === true) out[k] = true; });
        const legAlt = legAltFt(p.legAltFt);
        if (legAlt !== null) out.legAltFt = legAlt;
        return out;
    }
    // Geplante Hoehe der Teilstrecke, die zu diesem Wegpunkt fuehrt (ft). Fehlt sie, gilt die Reiseflughoehe.
    function legAltFt(value) {
        const n = Number(value);
        return value !== null && value !== '' && Number.isFinite(n) && n >= 500 && n <= 30000 ? Math.round(n) : null;
    }
    // Hoehen der Teilstrecken auf eine neue Punktliste uebertragen, deren Quelle sie nicht kennt
    // (z. B. eine aeltere Tracker-Version): gleiche Koordinaten behalten ihre Hoehe, neu
    // eingefuegte Punkte uebernehmen die Hoehe der Strecke, die sie geteilt haben.
    function carryLegAlts(previous, next) {
        if (!Array.isArray(previous) || !Array.isArray(next)) return next;
        const key = p => Number(p.lat).toFixed(6) + ',' + Number(p.lng ?? p.lon).toFixed(6);
        const known = new Map();
        const profilePoints = new Set();
        previous.forEach(p => {
            if (!p) return;
            if (legAltFt(p.legAltFt) !== null) known.set(key(p), legAltFt(p.legAltFt));
            if (p.profilePoint === true) profilePoints.add(key(p));
        });
        if (!known.size && !profilePoints.size) return next;
        const prevKeys = new Set(previous.filter(Boolean).map(key));
        const out = next.map(p => {
            if (!p) return p;
            const extra = {};
            if (legAltFt(p.legAltFt) === null && known.has(key(p))) extra.legAltFt = known.get(key(p));
            if (p.profilePoint !== true && profilePoints.has(key(p))) extra.profilePoint = true;
            return Object.keys(extra).length ? Object.assign({}, p, extra) : p;
        });
        for (let i = out.length - 2; i >= 1; i--) {
            const p = out[i];
            if (!p || prevKeys.has(key(p)) || legAltFt(p.legAltFt) !== null) continue;
            const after = legAltFt(out[i + 1] && out[i + 1].legAltFt);
            if (after !== null) out[i] = Object.assign({}, p, { legAltFt: after });
        }
        return out;
    }
    function normalize(points) {
        if (!Array.isArray(points) || points.length < 2 || points.length > 128) throw new Error('navigation_route_invalid');
        const result = points.map(point);
        if (result.some(p => !p)) throw new Error('navigation_point_invalid');
        return result;
    }
    // Original Standalone selection: insert into the leg with the smallest detour.
    function insertionIndex(points, position, distance) {
        let bestIndex = 1, minDiff = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
            const diff = distance(points[i], position) + distance(position, points[i + 1]) - distance(points[i], points[i + 1]);
            if (diff < minDiff) { minDiff = diff; bestIndex = i + 1; }
        }
        return bestIndex;
    }
    // Original 25px snap radius and airport/VOR preference.
    function snap(position, candidates, project) {
        const mouse = project(position);
        let closest = null, bestScore = -1;
        (candidates || []).forEach(nav => {
            const d = mouse.distanceTo(project(nav));
            if (d >= 25) return;
            let score = 25 - d;
            if (String(nav.name).includes('APT ')) score += 100;
            else if (String(nav.name).includes('[')) score += 50;
            if (score > bestScore) { bestScore = score; closest = nav; }
        });
        return closest;
    }
    function apply(points, edit, resetPoints) {
        const next = normalize(points);
        const index = edit.index;
        if (edit.action === 'reset') return resetPoints ? normalize(resetPoints) : [next[0], next[next.length - 1]];
        if (!Number.isInteger(index) || index < 1 || index >= next.length) throw new Error('navigation_endpoint_locked');
        if (edit.action !== 'insert' && index === next.length - 1) throw new Error('navigation_endpoint_locked');
        if (edit.action !== 'insert' && (next[index].isPOI || next[index].isPoiChainEndpoint || next[index].isPoiChainReturnHome)) throw new Error('navigation_mission_point_locked');
        if (edit.action === 'remove') next.splice(index, 1);
        else if (edit.action === 'insert' || edit.action === 'move') {
            const value = point(edit.point);
            if (!value || value.isPOI || value.isPoiChainEndpoint || value.isPoiChainReturnHome) throw new Error('navigation_point_invalid');
            // Ein eingefuegter Punkt teilt eine Strecke: beide Teile behalten deren Hoehe.
            // Ein verschobener Punkt behaelt die Hoehe seiner Strecke.
            const inheritedLegAlt = legAltFt(next[index] && next[index].legAltFt);
            if (value.legAltFt === undefined && inheritedLegAlt !== null) value.legAltFt = inheritedLegAlt;
            if (edit.action === 'insert') next.splice(index, 0, value);
            else next[index] = value;
        } else throw new Error('navigation_action_invalid');
        return normalize(next);
    }
    function markerOptions(index, total, poi) {
        const color = index === 0 ? '#44ff44' : index === total - 1 ? '#ff4444' : poi ? '#b266ff' : '#fdfd86';
        const movable = index > 0 && index < total - 1;
        return { className: 'custom-pin', html: '<div class="pin-hitbox"' + (movable ? ' style="cursor: move;"' : '')
            + '><div class="pin-dot" style="background-color: ' + color + ';' + (poi ? ' border: 2px solid #fff;' : '') + '"></div></div>',
            iconSize: [34, 34], iconAnchor: [17, 17] };
    }
    // UI language: web only; Tracker/EFB have no GAI18n and keep German.
    function tr(text) {
        const i18n = typeof globalThis !== 'undefined' ? globalThis.GAI18n : null;
        return i18n && typeof i18n.phrase === 'function' ? i18n.phrase(text) : text;
    }
    function popup(name, index, infoHtml) {
        const label = String(name || tr('Wegpunkt')).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return '<div style="text-align:center;"><b>' + label + '</b><br>' + (infoHtml || '') + '<button onclick="removeRouteWaypoint(' + index + ')" style="margin-top:5px; background:#d93829; color:#fff; border:none; padding:4px 8px; cursor:pointer; border-radius:2px;">' + tr('🗑️ Löschen') + '</button></div>';
    }
    return { point, normalize, insertionIndex, snap, apply, popup, markerOptions, legAltFt, carryLegAlts };
}));
