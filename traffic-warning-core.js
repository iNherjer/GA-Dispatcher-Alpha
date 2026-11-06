// Traffic warnings: decides when a contact is announced and builds the clip list.
// Shared by the tracker (Node) and the web fallback (browser).
//
//   warning  "Achtung, Verkehr, elf Uhr, unterhalb"   contact enters the alert level
//   resolve  "Verkehr, ausweichen! Verkehr, ausweichen!"   collision predicted within 20 s
//
// The classification itself (distance, CPA, clock position) lives in
// map-live-presentation.js classifyTraffic, so map, profile and voice agree.
(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GATrafficWarningCore = api;
})(typeof window !== 'undefined' ? window : null, function() {
'use strict';

const TRAFFIC_WARNING_TIMING = {
    repeatWarningMs: 60000,  // same contact: next warning at the earliest after one minute
    repeatResolveMs: 25000,  // same contact: next "ausweichen" after 25 s
    rearmAfterClearMs: 8000, // contact must leave the alert level this long before a new warning
    forgetMs: 60000,         // contacts not reported for a minute are forgotten
    gapMs: 4000              // at most one traffic announcement every 4 s
};

function verticalClip(relAltFt) {
    if (!Number.isFinite(relAltFt) || Math.abs(relAltFt) < 300) return 'aw-gleiche-hoehe';
    return relAltFt > 0 ? 'aw-oberhalb' : 'aw-unterhalb';
}

const VERTICAL_TEXT = { 'aw-gleiche-hoehe': 'gleiche Höhe', 'aw-oberhalb': 'oberhalb', 'aw-unterhalb': 'unterhalb' };

function warningClips(info) {
    const clock = Number.isInteger(info.clock) && info.clock >= 1 && info.clock <= 12 ? info.clock : 12;
    const vertical = verticalClip(info.relAltFt);
    return {
        clips: ['aw-achtung', 'aw-verkehr', `aw-uhr-${clock}`, vertical],
        text: `Achtung, Verkehr, ${clock} Uhr, ${VERTICAL_TEXT[vertical]}`
    };
}

function resolveClips() {
    return {
        clips: ['aw-verkehr', 'aw-ausweichen', 'aw-verkehr', 'aw-ausweichen'],
        text: 'Verkehr, ausweichen! Verkehr, ausweichen!'
    };
}

function createTrafficWarningDetector({ classify, timing = TRAFFIC_WARNING_TIMING } = {}) {
    if (typeof classify !== 'function') throw new Error('traffic_classify_missing');
    const states = new Map();
    let lastSpokenAt = -Infinity;
    function reset() { states.clear(); lastSpokenAt = -Infinity; }
    function evaluate({ traffic = [], own = null, now = Date.now() } = {}) {
        const seen = new Set();
        const warnings = [], resolves = [];
        for (const ac of Array.isArray(traffic) ? traffic : []) {
            if (!ac || ac.id == null) continue;
            const id = String(ac.id);
            seen.add(id);
            const info = classify(ac, own);
            const st = states.get(id) || { inAlert: false, announced: false, clearSince: null, warnedAt: -Infinity, resolvedAt: -Infinity };
            st.lastSeen = now;
            if (info.level === 'alert') {
                st.clearSince = null;
                if (!st.inAlert) { st.inAlert = true; st.announced = false; }
                if (info.resolve && now - st.resolvedAt >= timing.repeatResolveMs) resolves.push({ id, ac, info, st });
                else if (!st.announced && now - st.warnedAt >= timing.repeatWarningMs) warnings.push({ id, ac, info, st });
            } else if (st.inAlert) {
                if (st.clearSince == null) st.clearSince = now;
                if (now - st.clearSince >= timing.rearmAfterClearMs) { st.inAlert = false; st.clearSince = null; }
            }
            states.set(id, st);
        }
        for (const [id, st] of states) if (!seen.has(id) && now - st.lastSeen > timing.forgetMs) states.delete(id);
        // "Ausweichen" may interrupt the gap; plain warnings respect it.
        let pick = null, level = '';
        if (resolves.length) {
            resolves.sort((a, b) => (a.info.tCpaSec ?? 99) - (b.info.tCpaSec ?? 99));
            pick = resolves[0]; level = 'resolve';
        } else if (warnings.length && now - lastSpokenAt >= timing.gapMs) {
            warnings.sort((a, b) => (a.info.distNm ?? 99) - (b.info.distNm ?? 99));
            pick = warnings[0]; level = 'warning';
        }
        if (!pick) return [];
        lastSpokenAt = now;
        pick.st.announced = true;
        pick.st.warnedAt = now;
        if (level === 'resolve') pick.st.resolvedAt = now;
        const spoken = level === 'resolve' ? resolveClips() : warningClips(pick.info);
        return [{ kind: 'traffic', level, contactId: pick.id, clock: pick.info.clock,
            relAltFt: pick.info.relAltFt, distNm: pick.info.distNm, ...spoken }];
    }
    // Contacts that currently blink on map and profile.
    function alerting() {
        return [...states].filter(([, st]) => st.inAlert).map(([id]) => id);
    }
    return { evaluate, reset, alerting };
}

return { createTrafficWarningDetector, warningClips, resolveClips, verticalClip, TRAFFIC_WARNING_TIMING };
});
