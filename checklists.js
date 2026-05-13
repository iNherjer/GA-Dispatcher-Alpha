(function() {
    'use strict';

    const CUSTOM_STORAGE_KEY = 'ga_checklists_custom_v1';
    const PROGRESS_STORAGE_KEY = 'ga_checklist_progress_v1';
    const UI_STORAGE_KEY = 'ga_checklist_ui_v1';
    const VISIBLE_STORAGE_KEY = 'ga_checklist_visible_v1';
    const ORDER_STORAGE_KEY = 'ga_checklist_order_v1';
    const COMMUNITY_SUBS_KEY = 'ga_checklist_community_subs_v1';
    const COMMUNITY_META_KEY = 'ga_checklist_community_meta_v1';
    const COMMUNITY_CACHE_KEY = 'ga_checklist_community_cache_v1';
    const SHARE_PREFIX = 'GA-CHECKLIST-v1:';
    const MAX_CHAPTERS = 20;
    const MAX_ITEMS = 300;
    const MAX_TEXT_LENGTH = 220;
    const ROUTE_TOOLS_PROXY = 'https://ga-proxy.einherjer.workers.dev';
    const TOOL_CACHE_TTL_MS = 4 * 60 * 1000;
    const WEATHER_AI_CACHE_TTL_MS = 12 * 60 * 1000;
    const WEATHER_METAR_RADIUS_NM = 70;
    const NEAREST_CACHE_TTL_MS = 2 * 60 * 1000;
    const NEAREST_RADIUS_NM = 50;
    const NEAREST_MOVE_REFRESH_NM = 3;

    const BUILTIN_CHECKLISTS = [
        {
            id: 'builtin-vfr-briefing',
            title: 'VFR Briefing',
            source: 'builtin',
            editable: false,
            createdAt: 0,
            updatedAt: 0,
            chapters: [
                { id: 'route', title: 'Route', items: [
                    { id: 'route-start-dest', text: 'Start, Ziel und Ausweichplatz geprüft' },
                    { id: 'route-track', text: 'Kurs, Strecke und ETE plausibel' },
                    { id: 'route-altitude', text: 'Reiseflughöhe, Mindesthöhen und Terrain geprüft' },
                    { id: 'route-airspace', text: 'Lufträume, RMZ/TMZ/CTR und ED-R entlang der Route geprüft' },
                    { id: 'route-frequencies', text: 'Frequenzen und Meldepunkte notiert' }
                ] },
                { id: 'weather', title: 'Wetter', items: [
                    { id: 'weather-metar', text: 'METAR/TAF für Start, Ziel und Alternates geprüft' },
                    { id: 'weather-wind', text: 'Wind, Sicht, Wolkenuntergrenzen und Niederschlag bewertet' },
                    { id: 'weather-gafor', text: 'VFR-Index/GAFOR und Trend entlang der Route geprüft' },
                    { id: 'weather-daylight', text: 'Tageslicht, Sonnenstand und Reserven berücksichtigt' }
                ] },
                { id: 'aircraft', title: 'Aircraft', items: [
                    { id: 'aircraft-fuel', text: 'Fuel, Reserve und Verbrauch gerechnet' },
                    { id: 'aircraft-wb', text: 'Beladung, Schwerpunkt und Performance geprüft' },
                    { id: 'aircraft-docs', text: 'Dokumente, Karten und Flugplan/Briefing bereit' },
                    { id: 'aircraft-emergency', text: 'Notverfahren und kritische Frequenzen im Kopf' }
                ] }
            ]
        },
        {
            id: 'builtin-sep-normal-sim',
            title: 'SEP Normal Procedures (Sim)',
            source: 'builtin',
            editable: false,
            createdAt: 0,
            updatedAt: 0,
            chapters: [
                { id: 'before-start', title: 'Before Start', items: [
                    { id: 'before-parking', text: 'Parking brake set' },
                    { id: 'before-fuel', text: 'Fuel selector and quantity checked' },
                    { id: 'before-mixture', text: 'Mixture rich or as required' },
                    { id: 'before-avionics', text: 'Avionics off, circuit breakers checked' },
                    { id: 'before-brief', text: 'Departure brief complete' }
                ] },
                { id: 'runup', title: 'Run-up', items: [
                    { id: 'runup-brakes', text: 'Brakes hold' },
                    { id: 'runup-engine', text: 'Engine instruments in green' },
                    { id: 'runup-mags', text: 'Magnetos checked' },
                    { id: 'runup-controls', text: 'Flight controls free and correct' },
                    { id: 'runup-trim', text: 'Trim and flaps set for takeoff' }
                ] },
                { id: 'takeoff', title: 'Takeoff', items: [
                    { id: 'takeoff-lights', text: 'Lights and transponder set' },
                    { id: 'takeoff-runway', text: 'Runway, heading and wind confirmed' },
                    { id: 'takeoff-power', text: 'Full power and engine indications checked' },
                    { id: 'takeoff-speed', text: 'Airspeed alive' },
                    { id: 'takeoff-after', text: 'After takeoff climb configuration set' }
                ] },
                { id: 'cruise', title: 'Cruise', items: [
                    { id: 'cruise-power', text: 'Power, mixture and trim set' },
                    { id: 'cruise-nav', text: 'Navigation cross-checked' },
                    { id: 'cruise-fuel', text: 'Fuel and endurance monitored' },
                    { id: 'cruise-weather', text: 'Weather and terrain escape options reviewed' }
                ] }
            ]
        },
        {
            id: 'builtin-arrival-landing',
            title: 'Arrival/Landing Briefing',
            source: 'builtin',
            editable: false,
            createdAt: 0,
            updatedAt: 0,
            chapters: [
                { id: 'arrival', title: 'Arrival', items: [
                    { id: 'arrival-airport', text: 'Airport elevation, runway and circuit direction checked' },
                    { id: 'arrival-frequency', text: 'Frequency and reporting points ready' },
                    { id: 'arrival-weather', text: 'Wind, QNH, visibility and cloud base checked' },
                    { id: 'arrival-noise', text: 'Noise abatement and local restrictions reviewed' }
                ] },
                { id: 'approach', title: 'Approach', items: [
                    { id: 'approach-speed', text: 'Approach speed and flap plan briefed' },
                    { id: 'approach-missed', text: 'Go-around path and safe altitude briefed' },
                    { id: 'approach-traffic', text: 'Traffic scan and radio picture updated' },
                    { id: 'approach-landing', text: 'Landing distance and runway condition acceptable' }
                ] },
                { id: 'after-landing', title: 'After Landing', items: [
                    { id: 'after-runway', text: 'Runway vacated and transponder as required' },
                    { id: 'after-flaps', text: 'Flaps retracted' },
                    { id: 'after-lights', text: 'Lights and avionics set' },
                    { id: 'after-taxi', text: 'Taxi route and parking plan confirmed' }
                ] }
            ]
        }
    ];

    let drawerEl = null;
    let handleEl = null;
    let bodyEl = null;
    let titleEl = null;
    let statusEl = null;
    let customLists = [];
    let progressByChecklist = {};
    let visibilityPrefs = {};
    let checklistOrderPrefs = [];
    let communitySubscriptions = {};
    let communityMeta = [];
    let communityCache = {};
    let kvPullInProgress = false;
    let lastKvPullAt = 0;
    let communityPullInProgress = false;
    let lastCommunityPullAt = 0;

    const state = {
        view: 'home',
        selectedId: '',
        activeChapterId: '',
        editorDraft: null,
        editorMode: '',
        statusText: '',
        statusTone: '',
        actionMenuOpen: false,
        nearestMenuKey: '',
        radioAirportMenuKey: '',
        placeInfoAirport: null,
        placeInfoReturn: 'place'
    };

    const toolState = {
        weather: { key: '', updatedAt: 0, loading: false, data: null, error: '', controller: null, aiKey: '', aiUpdatedAt: 0, aiLoading: false },
        radio: { key: '', updatedAt: 0, loading: false, data: null, error: '', controller: null },
        place: { key: '', updatedAt: 0, loading: false, data: null, error: '', controller: null },
        nearest: { key: '', updatedAt: 0, loading: false, data: null, error: '', controller: null, origin: null },
        airportInfo: { key: '', updatedAt: 0, loading: false, data: null, error: '', controller: null }
    };
    const miniMaps = new Map();

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function makeId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
        }
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function cleanText(value, max = MAX_TEXT_LENGTH) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    }

    function safeId(value, prefix) {
        const raw = String(value || '').trim().replace(/[^\w:-]/g, '').slice(0, 96);
        return raw || makeId(prefix);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function itemCount(checklist) {
        return (checklist?.chapters || []).reduce((sum, chapter) => sum + (chapter.items || []).length, 0);
    }

    function sourceLabel(checklist) {
        if (checklist?.source === 'builtin') return 'Standard';
        if (checklist?.source === 'community') return 'Community';
        return checklist?.published ? 'Eigene Liste · Veröffentlicht' : 'Eigene Liste';
    }

    function normalizeChapter(chapter, index, preserveIds) {
        const rawItems = Array.isArray(chapter?.items) ? chapter.items : [];
        const items = [];
        for (const item of rawItems) {
            if (items.length >= MAX_ITEMS) break;
            const text = cleanText(item?.text);
            if (!text) continue;
            items.push({ id: preserveIds ? safeId(item?.id, 'item') : makeId('item'), text });
        }
        return {
            id: preserveIds ? safeId(chapter?.id, 'chap') : makeId('chap'),
            title: cleanText(chapter?.title, 64) || `Kapitel ${index + 1}`,
            items
        };
    }

    function sanitizeChecklist(input, options = {}) {
        const preserveIds = options.preserveIds !== false;
        const now = Date.now();
        const chapters = [];
        let total = 0;
        const rawChapters = Array.isArray(input?.chapters) ? input.chapters : [];
        for (let i = 0; i < rawChapters.length && chapters.length < MAX_CHAPTERS; i += 1) {
            const chapter = normalizeChapter(rawChapters[i], chapters.length, preserveIds);
            const room = MAX_ITEMS - total;
            if (room <= 0) break;
            chapter.items = chapter.items.slice(0, room);
            if (!chapter.items.length) continue;
            total += chapter.items.length;
            chapters.push(chapter);
        }
        return {
            id: options.id || (preserveIds ? safeId(input?.id, 'custom') : makeId('custom')),
            title: cleanText(input?.title, 96) || 'Checkliste',
            source: options.source || input?.source || 'custom',
            editable: options.editable !== undefined ? !!options.editable : input?.editable !== false,
            createdAt: Number(input?.createdAt || now),
            updatedAt: Number(input?.updatedAt || now),
            published: !!input?.published,
            communityId: input?.communityId ? safeId(input.communityId, 'community') : '',
            communityUpdatedAt: Number(input?.communityUpdatedAt || 0),
            chapters
        };
    }

    function sanitizeCustomList(input) {
        const sanitized = sanitizeChecklist(input, {
            id: safeId(input?.id, 'custom'),
            source: 'custom',
            editable: true,
            preserveIds: true
        });
        if (sanitized.published && !sanitized.communityId) sanitized.communityId = sanitized.id;
        return sanitized.chapters.length ? sanitized : null;
    }

    function sanitizeCommunityMeta(input) {
        if (!input || typeof input !== 'object') return null;
        const id = safeId(input.id, 'community');
        const title = cleanText(input.title, 96);
        if (!id || !title) return null;
        return {
            id,
            title,
            updatedAt: Number(input.updatedAt || 0),
            version: Number(input.version || 1),
            chapterCount: Math.max(0, Number(input.chapterCount || 0)),
            itemCount: Math.max(0, Number(input.itemCount || 0))
        };
    }

    function communityChecklistFromRecord(record) {
        const meta = sanitizeCommunityMeta(record);
        if (!meta) return null;
        const sanitized = sanitizeChecklist(record, {
            id: `community:${meta.id}`,
            source: 'community',
            editable: false,
            preserveIds: true
        });
        if (!sanitized.chapters.length) return null;
        sanitized.communityId = meta.id;
        sanitized.updatedAt = meta.updatedAt || sanitized.updatedAt;
        sanitized.communityUpdatedAt = meta.updatedAt || sanitized.updatedAt;
        sanitized.published = true;
        return sanitized;
    }

    function customCommunityIds() {
        return new Set(customLists.filter(c => c.published).map(c => c.communityId || c.id));
    }

    function subscribedCommunityLists() {
        const ownIds = customCommunityIds();
        return Object.keys(communitySubscriptions)
            .filter(id => communitySubscriptions[id] && !ownIds.has(id))
            .map(id => communityCache[id])
            .filter(Boolean)
            .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function baseChecklists() {
        return [
            ...BUILTIN_CHECKLISTS,
            ...customLists.slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)),
            ...subscribedCommunityLists()
        ];
    }

    function orderedChecklistIds(list = baseChecklists()) {
        const ids = list.map(checklist => checklist.id);
        const valid = new Set(ids);
        const ordered = checklistOrderPrefs.filter(id => valid.has(id));
        ids.forEach(id => {
            if (!ordered.includes(id)) ordered.push(id);
        });
        return ordered;
    }

    function sortChecklistsByPreference(list) {
        const order = orderedChecklistIds(list);
        const rank = new Map(order.map((id, index) => [id, index]));
        return list.slice().sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
    }

    function allChecklists() {
        return sortChecklistsByPreference(baseChecklists());
    }

    function visibleChecklists() {
        return allChecklists().filter(isChecklistVisible);
    }

    function getChecklist(id) {
        return allChecklists().find(checklist => checklist.id === id) || null;
    }

    function isChecklistVisible(checklist) {
        if (!checklist) return false;
        if (checklist.source === 'community') return !!communitySubscriptions[checklist.communityId];
        if (Object.prototype.hasOwnProperty.call(visibilityPrefs, checklist.id)) return !!visibilityPrefs[checklist.id];
        return true;
    }

    function setChecklistVisible(id, visible) {
        visibilityPrefs[id] = !!visible;
        writeJson(VISIBLE_STORAGE_KEY, visibilityPrefs);
        saveChecklistOrder();
    }

    function saveChecklistOrder() {
        const ids = orderedChecklistIds();
        checklistOrderPrefs = ids;
        writeJson(ORDER_STORAGE_KEY, checklistOrderPrefs);
    }

    function moveChecklistOrder(id, dir) {
        const ids = orderedChecklistIds();
        const index = ids.indexOf(id);
        const next = index + dir;
        if (index < 0 || next < 0 || next >= ids.length) return false;
        const [item] = ids.splice(index, 1);
        ids.splice(next, 0, item);
        checklistOrderPrefs = ids;
        writeJson(ORDER_STORAGE_KEY, checklistOrderPrefs);
        return true;
    }

    function loadStateFromStorage() {
        const rawCustom = readJson(CUSTOM_STORAGE_KEY, []);
        customLists = Array.isArray(rawCustom) ? rawCustom.map(sanitizeCustomList).filter(Boolean) : [];
        progressByChecklist = readJson(PROGRESS_STORAGE_KEY, {});
        if (!progressByChecklist || typeof progressByChecklist !== 'object') progressByChecklist = {};
        visibilityPrefs = readJson(VISIBLE_STORAGE_KEY, {});
        if (!visibilityPrefs || typeof visibilityPrefs !== 'object') visibilityPrefs = {};
        const rawOrder = readJson(ORDER_STORAGE_KEY, []);
        checklistOrderPrefs = Array.isArray(rawOrder) ? rawOrder.map(id => String(id || '')).filter(Boolean) : [];
        communitySubscriptions = readJson(COMMUNITY_SUBS_KEY, {});
        if (!communitySubscriptions || typeof communitySubscriptions !== 'object') communitySubscriptions = {};
        const rawMeta = readJson(COMMUNITY_META_KEY, []);
        communityMeta = Array.isArray(rawMeta) ? rawMeta.map(sanitizeCommunityMeta).filter(Boolean) : [];
        const rawCache = readJson(COMMUNITY_CACHE_KEY, {});
        communityCache = {};
        if (rawCache && typeof rawCache === 'object') {
            Object.keys(rawCache).forEach(id => {
                const checklist = communityChecklistFromRecord(rawCache[id]);
                if (checklist) communityCache[id] = checklist;
            });
        }
        const savedUi = readJson(UI_STORAGE_KEY, {});
        state.selectedId = savedUi.selectedId || '';
        state.activeChapterId = savedUi.activeChapterId || '';
    }

    function saveCustomLists() {
        writeJson(CUSTOM_STORAGE_KEY, customLists);
    }

    function saveProgress() {
        writeJson(PROGRESS_STORAGE_KEY, progressByChecklist);
    }

    function saveCommunityState() {
        writeJson(COMMUNITY_SUBS_KEY, communitySubscriptions);
        writeJson(COMMUNITY_META_KEY, communityMeta);
        const rawCache = {};
        Object.keys(communityCache).forEach(id => {
            const checklist = communityCache[id];
            if (!checklist) return;
            rawCache[id] = {
                id: checklist.communityId || id,
                title: checklist.title,
                updatedAt: checklist.communityUpdatedAt || checklist.updatedAt || Date.now(),
                version: checklist.version || 1,
                chapters: checklist.chapters
            };
        });
        writeJson(COMMUNITY_CACHE_KEY, rawCache);
    }

    function persistUiState() {
        writeJson(UI_STORAGE_KEY, {
            selectedId: state.selectedId,
            activeChapterId: state.activeChapterId
        });
    }

    function setStatus(text, tone = '') {
        state.statusText = text || '';
        state.statusTone = tone || '';
        renderStatus();
    }

    function renderStatus() {
        if (!statusEl) return;
        statusEl.className = `map-side-drawer-status${state.statusTone ? ` is-${state.statusTone}` : ''}`;
        statusEl.textContent = state.statusText || '';
    }

    function setTitle(text) {
        if (titleEl) titleEl.textContent = text || 'Kartenwerkzeuge';
    }

    function getRoutePoints() {
        try {
            if (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) {
                return routeWaypoints
                    .map(wp => ({
                        lat: Number(wp?.lat),
                        lon: Number(wp?.lng ?? wp?.lon),
                        name: wp?.name || ''
                    }))
                    .filter(wp => Number.isFinite(wp.lat) && Number.isFinite(wp.lon));
            }
        } catch (_) {}
        return [];
    }

    function getRouteKey() {
        const pts = getRoutePoints();
        if (pts.length < 1) return 'no-route';
        return pts.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
    }

    function getLiveAircraftPosition(maxAgeMs = 30000) {
        const pos = window.lastLiveGpsPos;
        if (!pos || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) return null;
        const t = Number(pos.t || 0);
        if (t && Date.now() - t > maxAgeMs) return null;
        return { lat: Number(pos.lat), lon: Number(pos.lon), t };
    }

    function navBetween(lat1, lon1, lat2, lon2) {
        try {
            if (typeof calcNav === 'function') return calcNav(lat1, lon1, lat2, lon2);
        } catch (_) {}
        const r = 3440.065;
        const toRad = d => d * Math.PI / 180;
        const p1 = toRad(lat1), p2 = toRad(lat2);
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
        const dist = Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
        const y = Math.sin(dLon) * Math.cos(p2);
        const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
        const brng = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
        return { dist, brng };
    }

    function fmtNm(value) {
        try {
            if (typeof formatNm === 'function') return formatNm(value);
        } catch (_) {}
        const n = Number(value);
        return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : '0.0';
    }

    function compassFromBearing(brng) {
        const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
        const n = Number(brng);
        if (!Number.isFinite(n)) return '';
        return dirs[Math.round((((n % 360) + 360) % 360) / 45) % 8];
    }

    function routeBounds(points, padNm = 8) {
        const pts = Array.isArray(points) ? points : getRoutePoints();
        if (!pts.length) return null;
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        pts.forEach(p => {
            minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
            minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
        });
        const midLat = (minLat + maxLat) * 0.5;
        const padLat = padNm / 60;
        const padLon = padNm / (60 * Math.max(0.25, Math.cos(midLat * Math.PI / 180)));
        return {
            minLat: Math.max(-89.5, minLat - padLat),
            maxLat: Math.min(89.5, maxLat + padLat),
            minLon: Math.max(-180, minLon - padLon),
            maxLon: Math.min(180, maxLon + padLon)
        };
    }

    function airportFromGlobal(icao) {
        const code = String(icao || '').trim().toUpperCase();
        if (!code || code === 'GPS' || code === 'POI') return null;
        try {
            const apt = (typeof globalAirports !== 'undefined' && globalAirports) ? globalAirports[code] : null;
            if (!apt) return { icao: code, name: code, lat: NaN, lon: NaN };
            return normalizeToolAirport({ ...apt, icao: code });
        } catch (_) {
            return { icao: code, name: code, lat: NaN, lon: NaN };
        }
    }

    function normalizeToolAirport(input) {
        if (!input) return null;
        const coords = input.geometry?.coordinates;
        const lat = Number(input.lat ?? input.latitude ?? (Array.isArray(coords) ? coords[1] : NaN));
        const lon = Number(input.lon ?? input.lng ?? input.longitude ?? (Array.isArray(coords) ? coords[0] : NaN));
        const icao = String(input.icao || input.icaoCode || input.ident || input.code || input.designator || '').trim().toUpperCase();
        const elevRaw = input.elevation;
        const elev = typeof elevRaw === 'object' && elevRaw
            ? (elevRaw.unit === 1 ? Number(elevRaw.value) : Math.round(Number(elevRaw.value) * 3.28084))
            : Number(elevRaw);
        return {
            icao,
            name: input.name || input.n || input.title || icao || 'Flugplatz',
            lat,
            lon,
            elevation: Number.isFinite(elev) ? elev : null,
            country: input.country || input.iso_country || input.cc || ''
        };
    }

    function getCurrentAirport(kind) {
        const isDest = kind === 'dest';
        let icao = '';
        try {
            const rawIcao = isDest ? currentDestICAO : currentStartICAO;
            icao = rawIcao == null ? '' : String(rawIcao).trim().toUpperCase();
            if (icao === 'UNDEFINED' || icao === 'NULL') icao = '';
        } catch (_) {}
        const route = getRoutePoints();
        const wp = isDest ? route[route.length - 1] : route[0];
        const fromDb = airportFromGlobal(icao);
        if (fromDb && Number.isFinite(fromDb.lat) && Number.isFinite(fromDb.lon)) return fromDb;
        let name = '';
        try {
            const rawName = isDest ? currentDName : currentSName;
            name = rawName == null ? '' : String(rawName).trim();
            if (/^(undefined|null)$/i.test(name)) name = '';
        } catch (_) {}
        return {
            icao: icao || '',
            name: name || wp?.name || icao || (isDest ? 'Ziel' : 'Start'),
            lat: Number(wp?.lat),
            lon: Number(wp?.lon),
            elevation: fromDb?.elevation ?? null,
            country: fromDb?.country || ''
        };
    }

    function getFreqLines(icao) {
        const code = String(icao || '').trim().toUpperCase();
        if (!code) return [];
        try {
            const cached = (typeof freqCache !== 'undefined' && freqCache) ? freqCache[code] : null;
            if (Array.isArray(cached)) {
                return cached
                    .filter(f => f && (f.value || typeof f === 'string'))
                    .map(f => typeof f === 'string' ? { label: 'Freq', value: f } : { label: f.label || f.name || 'Freq', value: f.value });
            }
        } catch (_) {}
        return [];
    }

    function getRunwayText(icao) {
        const code = String(icao || '').trim().toUpperCase();
        if (!code) return '';
        try {
            const raw = (typeof runwayCache !== 'undefined' && runwayCache) ? runwayCache[code] : '';
            return String(raw || '').replace(/<br\s*\/?>/ig, '\n');
        } catch (_) {
            return '';
        }
    }

    function parseRunwayRows(text) {
        return String(text || '')
            .split(/\s*(?:\n|\|)\s*/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 6)
            .map(line => {
                const parts = line.split(/\s+[–-]\s+/);
                return {
                    ident: parts[0] || line,
                    detail: parts.slice(1).join(' – ') || ''
                };
            });
    }

    function getAipUrlForAirport(apt) {
        if (!apt?.icao || apt.icao === 'GPS' || apt.icao === 'POI') return '';
        try {
            if (typeof getAipPopupUrl === 'function') return getAipPopupUrl(apt.icao, apt.country || '');
        } catch (_) {}
        return '';
    }

    function abortToolRequest(name) {
        const entry = toolState[name];
        if (entry?.controller) {
            try { entry.controller.abort(); } catch (_) {}
        }
        if (entry) entry.controller = null;
    }

    function abortOtherToolRequests(activeName) {
        Object.keys(toolState).forEach(name => {
            if (name !== activeName) abortToolRequest(name);
        });
    }

    function isCacheFresh(entry, key, ttl = TOOL_CACHE_TTL_MS) {
        return !!(entry && entry.key === key && entry.data && Date.now() - entry.updatedAt < ttl);
    }

    async function fetchJson(url, signal) {
        const res = await fetch(url, { signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    function setDrawerOpen(open) {
        if (!drawerEl) return;
        drawerEl.classList.toggle('is-open', !!open);
        if (handleEl) handleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function isDrawerOpen() {
        return !!(drawerEl && drawerEl.classList.contains('is-open'));
    }

    function render() {
        if (!bodyEl) return;
        if (state.view === 'home') renderHome();
        else if (state.view === 'list') renderList();
        else if (state.view === 'manager') renderManager();
        else if (state.view === 'viewer') renderViewer();
        else if (state.view === 'editor') renderEditor();
        else if (state.view === 'import') renderImport();
        else if (state.view === 'weather') renderWeatherTool();
        else if (state.view === 'radio') renderRadioTool();
        else if (state.view === 'place') renderPlaceTool();
        else if (state.view === 'nearest') renderNearestTool();
        else if (state.view === 'airport-info') renderAirportInfoTool();
        else renderHome();
        renderStatus();
    }

    function renderHome() {
        setTitle('Kartenwerkzeuge');
        const count = visibleChecklists().length;
        const live = getLiveAircraftPosition();
        const route = getRoutePoints();
        bodyEl.innerHTML = `
            <div class="checklist-tool-grid">
                <button class="checklist-tool-tile" type="button" data-action="open-list">
                    <span class="checklist-tool-icon" aria-hidden="true">✅</span>
                    <span>
                        <span class="checklist-tool-name">Checklist</span>
                        <span class="checklist-tool-count">${count} sichtbar · ${communityMeta.length} Community</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="weather">
                    <span class="checklist-tool-icon" aria-hidden="true">🌦️</span>
                    <span>
                        <span class="checklist-tool-name">Wetter</span>
                        <span class="checklist-tool-count">${route.length >= 2 ? 'Route · sparsame Übersicht' : 'Route planen für Enroute-Wetter'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="radio">
                    <span class="checklist-tool-icon" aria-hidden="true">📻</span>
                    <span>
                        <span class="checklist-tool-name">Radio</span>
                        <span class="checklist-tool-count">${route.length >= 2 ? 'Start · Enroute · Ziel' : 'Frequenzen nach Route'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="place">
                    <span class="checklist-tool-icon" aria-hidden="true">🛬</span>
                    <span>
                        <span class="checklist-tool-name">Platz</span>
                        <span class="checklist-tool-count">Start und Ziel · AIP Links</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="nearest">
                    <span class="checklist-tool-icon" aria-hidden="true">📍</span>
                    <span>
                        <span class="checklist-tool-name">Nearest</span>
                        <span class="checklist-tool-count">${live ? '50 NM um Flugzeug' : 'braucht Live-Position'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
            </div>
        `;
    }

    function toolTopline(tool, label = 'Zurück') {
        return `
            <div class="checklist-topline route-tool-topline">
                <button class="checklist-back-btn" type="button" data-action="home">${label}</button>
                <button class="checklist-action-btn" type="button" data-action="refresh-tool" data-tool="${escapeAttr(tool)}">Aktualisieren</button>
            </div>
        `;
    }

    function renderToolEmpty(text) {
        return `<div class="route-tool-empty">${escapeHtml(text)}</div>`;
    }

    function openTool(tool, force = false) {
        const valid = new Set(['weather', 'radio', 'place', 'nearest']);
        if (!valid.has(tool)) return;
        abortOtherToolRequests(tool);
        state.view = tool;
        state.actionMenuOpen = false;
        state.nearestMenuKey = '';
        state.radioAirportMenuKey = '';
        state.placeInfoAirport = null;
        state.placeInfoReturn = tool;
        setStatus('');
        render();
        if (tool === 'weather') ensureWeatherTool(force);
        if (tool === 'radio') ensureRadioTool(force);
        if (tool === 'place') ensurePlaceTool(force);
        if (tool === 'nearest') ensureNearestTool(force);
    }

    function pickRouteSamplePoints(maxSamples = 5) {
        const pts = getRoutePoints();
        if (pts.length <= maxSamples) return pts;
        const out = [pts[0]];
        const interiorSlots = maxSamples - 2;
        for (let i = 1; i <= interiorSlots; i += 1) {
            const idx = Math.round((i / (interiorSlots + 1)) * (pts.length - 1));
            out.push(pts[idx]);
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    function metarToWeather(metar, fallbackCode = '', distNm = null) {
        if (!metar || typeof metar !== 'object') return null;
        const code = String(metar.icaoId || fallbackCode || '').trim().toUpperCase();
        const raw = metar.rawOb || metar.raw || '';
        const temp = Number(metar.temp);
        const dew = Number(metar.dewp ?? metar.dewpoint);
        const rh = Number.isFinite(temp) && Number.isFinite(dew) ? relativeHumidityFromTempDew(temp, dew) : null;
        const hasWindDir = metar.wdir !== undefined && metar.wdir !== null && String(metar.wdir).trim() !== '';
        const windDir = hasWindDir ? String(metar.wdir).toUpperCase() : '';
        const wind = windDir
            ? `${windDir === 'VRB' ? 'VRB' : `${metar.wdir}°`}/${metar.wspd || 0}${metar.wgst ? `G${metar.wgst}` : ''} kt`
            : '';
        const source = Number.isFinite(Number(distNm)) ? `METAR nahe ${fmtNm(distNm)} NM` : 'METAR';
        return {
            source,
            station: code,
            raw,
            cat: metar.fltCat || metar.fltcat || '',
            observedAt: metar.obsTime || metar.reportTime || metar.receiptTime || Date.now(),
            wind,
            vis: /\b9999\b/.test(raw) ? '>10 km' : (metar.visib ? `${metar.visib} sm` : ''),
            clouds: formatMetarClouds(raw) || metar.cover || '',
            wx: metar.wxString || 'NIL',
            temp: Number.isFinite(temp) ? `${Math.round(temp)}°C` : '',
            dew: Number.isFinite(dew) ? `${Math.round(dew)}°C` : '',
            rh: Number.isFinite(rh) ? `${rh}%` : '',
            pressure: parseQnhFromMetar(raw) || formatMetarPressure(metar)
        };
    }

    function weatherFromMetarCache(icao) {
        const code = String(icao || '').trim().toUpperCase();
        if (!code) return null;
        try {
            const entry = (typeof gpsState !== 'undefined' && gpsState?.metarCache) ? gpsState.metarCache[code] : null;
            const metar = Array.isArray(entry?.data) ? entry.data[0] : null;
            return metarToWeather(metar, code);
        } catch (_) {
            return null;
        }
    }

    function parseMetarPayload(payload) {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.data)) return payload.data;
        if (payload && Array.isArray(payload.results)) return payload.results;
        if (payload && typeof payload.contents === 'string') {
            try {
                const nested = JSON.parse(payload.contents);
                if (Array.isArray(nested)) return nested;
                if (nested && Array.isArray(nested.data)) return nested.data;
            } catch (_) {}
        }
        return [];
    }

    function cacheMetarsForWidgets(metars) {
        if (!Array.isArray(metars) || typeof gpsState === 'undefined' || !gpsState?.metarCache) return;
        metars.forEach(m => {
            const code = String(m?.icaoId || '').trim().toUpperCase();
            if (!code) return;
            gpsState.metarCache[code] = { data: [m], isFallback: false, foundIcao: code, updatedAt: Date.now() };
        });
    }

    async function fetchRouteMetarsForWeather(points, signal) {
        const bounds = routeBounds(points, WEATHER_METAR_RADIUS_NM);
        if (!bounds) return [];
        const src = `https://aviationweather.gov/api/data/metar?bbox=${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}&format=json&t=${Date.now()}`;
        const payload = await fetchJson(`${ROUTE_TOOLS_PROXY}/api/metar?src=${encodeURIComponent(src)}`, signal);
        const metars = parseMetarPayload(payload)
            .filter(m => m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon)));
        cacheMetarsForWidgets(metars);
        return metars;
    }

    function cachedMetarList() {
        try {
            if (typeof gpsState === 'undefined' || !gpsState?.metarCache) return [];
            const out = [];
            Object.values(gpsState.metarCache).forEach(entry => {
                const data = Array.isArray(entry?.data) ? entry.data : [];
                data.forEach(m => {
                    if (m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon))) out.push(m);
                });
            });
            return out;
        } catch (_) {
            return [];
        }
    }

    function nearestMetarWeatherPoint(lat, lon, metars = [], maxNm = WEATHER_METAR_RADIUS_NM) {
        const all = [];
        const seen = new Set();
        [...(Array.isArray(metars) ? metars : []), ...cachedMetarList()].forEach(m => {
            const key = String(m?.icaoId || m?.rawOb || m?.raw || `${m?.lat},${m?.lon}`).trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            all.push(m);
        });
        let best = null;
        let bestDist = Infinity;
        all.forEach(m => {
            const mLat = Number(m?.lat), mLon = Number(m?.lon);
            if (!Number.isFinite(mLat) || !Number.isFinite(mLon)) return;
            const nav = navBetween(lat, lon, mLat, mLon);
            if (nav.dist < bestDist) {
                bestDist = nav.dist;
                best = m;
            }
        });
        if (!best || bestDist > maxNm) return null;
        return metarToWeather(best, best.icaoId, bestDist);
    }

    function nearestCachedWeatherPoint(lat, lon) {
        try {
            if (typeof vpWeatherData === 'undefined' || !Array.isArray(vpWeatherData)) return null;
            let best = null;
            let bestDist = Infinity;
            vpWeatherData.forEach(zone => {
                const zLat = Number(zone?.stnLat), zLon = Number(zone?.stnLon);
                if (!Number.isFinite(zLat) || !Number.isFinite(zLon)) return;
                const nav = navBetween(lat, lon, zLat, zLon);
                if (nav.dist < bestDist) {
                    bestDist = nav.dist;
                    best = {
                        source: 'Kartenwetter',
                        station: zone.icao || '',
                        cat: zone.fltCat || '',
                        observedAt: zone.obsTime || zone.reportTime || Date.now(),
                        wind: zone.wdir ? `${zone.wdir}°/${zone.wspd || 0} kt` : '',
                        vis: zone.visib ? `${zone.visib}` : '',
                        clouds: formatKnownCloudLayers(zone.clouds) || (Array.isArray(zone.clouds) ? `${zone.clouds.length} Layer` : ''),
                        wx: zone.wxString || '',
                        distNm: bestDist
                    };
                }
            });
            return best && bestDist <= 45 ? best : null;
        } catch (_) {
            return null;
        }
    }

    function cloudCoverToOctas(cover) {
        const c = String(cover || '').toUpperCase();
        if (c === 'SKC' || c === 'CLR' || c === 'NSC' || c === 'NCD') return '0/8';
        if (c === 'FEW') return '1-2/8';
        if (c === 'SCT') return '3-4/8';
        if (c === 'BKN') return '5-7/8';
        if (c === 'OVC' || c === 'VV') return '8/8';
        return '';
    }

    function pctToOctas(value) {
        const pct = Number(value);
        if (!Number.isFinite(pct)) return null;
        return Math.max(0, Math.min(8, Math.round(pct / 12.5)));
    }

    function relativeHumidityFromTempDew(tempC, dewC) {
        const t = Number(tempC);
        const d = Number(dewC);
        if (!Number.isFinite(t) || !Number.isFinite(d)) return null;
        const saturation = Math.exp((17.625 * t) / (243.04 + t));
        const actual = Math.exp((17.625 * d) / (243.04 + d));
        return Math.max(0, Math.min(100, Math.round((actual / saturation) * 100)));
    }

    function parseQnhFromMetar(raw) {
        const text = String(raw || '');
        const qnh = text.match(/\bQ(\d{4})\b/);
        if (qnh) return `${Number(qnh[1])} hPa`;
        const alt = text.match(/\bA(\d{4})\b/);
        if (!alt) return '';
        const inHg = Number(alt[1]) / 100;
        if (!Number.isFinite(inHg)) return '';
        return `${Math.round(inHg * 33.8639)} hPa`;
    }

    function formatMetarPressure(metar) {
        const p = Number(metar?.mslp ?? metar?.slp ?? metar?.altim);
        if (!Number.isFinite(p)) return '';
        if (p >= 850 && p <= 1100) return `${Math.round(p)} hPa`;
        if (p >= 25 && p <= 33) return `${Math.round(p * 33.8639)} hPa`;
        return '';
    }

    function formatMetarClouds(raw) {
        const text = String(raw || '');
        const layers = [];
        const re = /\b(FEW|SCT|BKN|OVC|VV)(\d{3})\b/g;
        let match;
        while ((match = re.exec(text)) !== null && layers.length < 3) {
            const cover = match[1].toUpperCase();
            const ft = Number(match[2]) * 100;
            layers.push(`${cover} ${cloudCoverToOctas(cover)} ${ft} ft AGL`);
        }
        if (!layers.length && /\b(SKC|CLR|NSC|NCD)\b/.test(text)) return '0/8 keine relevanten Wolken';
        return layers.join(' · ');
    }

    function formatKnownCloudLayers(clouds) {
        if (!Array.isArray(clouds) || !clouds.length) return '';
        return clouds.slice(0, 3).map(c => {
            const cover = String(c.type || c.cover || '').toUpperCase();
            const octas = cloudCoverToOctas(cover) || (Number.isFinite(Number(c.cloudPct)) ? `${pctToOctas(c.cloudPct)}/8` : '');
            const base = Number(c.baseAgl ?? c.baseFt ?? c.baseMsl);
            const suffix = Number.isFinite(base) ? ` ca. ${Math.round(base / 100) * 100} ft` : '';
            return `${cover || 'Layer'} ${octas}${suffix}`.trim();
        }).join(' · ');
    }

    function wxCodeText(code, precipMm = 0, rainMm = 0, snowCm = 0) {
        const c = Number(code);
        if (!Number.isFinite(c)) {
            if (Number(precipMm) > 0 || Number(rainMm) > 0) return 'Niederschlag';
            if (Number(snowCm) > 0) return 'Schnee';
            return '';
        }
        const map = {
            0: 'NIL', 1: 'überwiegend klar', 2: 'teilweise bewölkt', 3: 'bedeckt',
            45: 'Nebel', 48: 'Nebel/Reif',
            51: 'leichter Sprühregen', 53: 'Sprühregen', 55: 'starker Sprühregen',
            56: 'gefrierender Sprühregen', 57: 'starker gefrierender Sprühregen',
            61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen',
            66: 'gefrierender Regen', 67: 'starker gefrierender Regen',
            71: 'leichter Schnee', 73: 'Schnee', 75: 'starker Schnee',
            77: 'Schneekörner', 80: 'leichte Schauer', 81: 'Schauer', 82: 'starke Schauer',
            85: 'leichte Schneeschauer', 86: 'Schneeschauer',
            95: 'Gewitter', 96: 'Gewitter/Hagel', 99: 'starkes Gewitter/Hagel'
        };
        return map[c] || `Wx ${c}`;
    }

    function formatOpenMeteoClouds(om) {
        if (!om) return '';
        if (Array.isArray(om.pressureProfile) && om.pressureProfile.length) {
            const pts = om.pressureProfile
                .filter(p => Number.isFinite(Number(p.geopotentialFt)) && Number.isFinite(Number(p.cloudPct)))
                .sort((a, b) => Number(a.geopotentialFt) - Number(b.geopotentialFt));
            const layers = [];
            let start = null;
            let cover = [];
            pts.forEach((p, idx) => {
                const cloudy = Number(p.cloudPct) >= 20;
                if (cloudy && !start) {
                    start = { idx, baseFt: Number(p.geopotentialFt) };
                    cover = [Number(p.cloudPct)];
                } else if (cloudy) {
                    cover.push(Number(p.cloudPct));
                } else if (start) {
                    const avg = cover.reduce((a, b) => a + b, 0) / Math.max(1, cover.length);
                    layers.push(`${pctToOctas(avg)}/8 ca. ${Math.round(start.baseFt / 100) * 100} ft MSL`);
                    start = null;
                    cover = [];
                }
            });
            if (start) {
                const avg = cover.reduce((a, b) => a + b, 0) / Math.max(1, cover.length);
                layers.push(`${pctToOctas(avg)}/8 ca. ${Math.round(start.baseFt / 100) * 100} ft MSL`);
            }
            if (layers.length) return layers.slice(0, 3).join(' · ');
        }
        const parts = [
            ['low', om.cloudLowPct, '< 6500 ft'],
            ['mid', om.cloudMidPct, '6500-20000 ft'],
            ['high', om.cloudHighPct, '> 20000 ft']
        ].filter(([, pct]) => Number.isFinite(Number(pct)) && Number(pct) >= 10);
        return parts.length
            ? parts.map(([name, pct, band]) => `${name} ${pctToOctas(pct)}/8 ${band}`).join(' · ')
            : '0/8 kaum Wolken';
    }

    function weatherFromOpenMeteo(om) {
        if (!om) return null;
        const temp = Number(om.temp2mC);
        const dew = Number(om.dewPoint2mC);
        const rh = Number(om.rh2mPct);
        const pressure = Number(om.mslPressureHpa);
        return {
            source: 'Open-Meteo',
            station: '',
            cat: '',
            observedAt: om.time || Date.now(),
            wind: Number.isFinite(Number(om.wspd)) ? `${Math.round(Number(om.wdir || 0))}°/${Math.round(Number(om.wspd))} kt` : '',
            vis: Number.isFinite(Number(om.visibilityM)) ? `${Math.round(Number(om.visibilityM) / 1000)} km` : '',
            clouds: formatOpenMeteoClouds(om),
            wx: wxCodeText(om.weatherCode, om.precipitationMm, om.rainMm, om.snowfallCm),
            temp: Number.isFinite(temp) ? `${Math.round(temp)}°C` : '',
            dew: Number.isFinite(dew) ? `${Math.round(dew)}°C` : '',
            rh: Number.isFinite(rh) ? `${Math.round(rh)}%` : '',
            pressure: Number.isFinite(pressure) ? `${Math.round(pressure)} hPa` : ''
        };
    }

    function mergeWeatherSources(cached, openMeteo) {
        if (!cached && !openMeteo) return { source: 'Keine Daten' };
        if (!cached) return openMeteo;
        if (!openMeteo) return cached;
        const merged = { ...openMeteo, ...cached };
        ['wind', 'vis', 'clouds', 'wx', 'temp', 'dew', 'rh', 'pressure', 'observedAt'].forEach(key => {
            if (!merged[key] || merged[key] === 'NIL' || merged[key] === '—') merged[key] = openMeteo[key] || merged[key];
        });
        if (openMeteo.source && cached.source && cached.source !== openMeteo.source) {
            merged.source = `${cached.source} + ${openMeteo.source}`;
        }
        return merged;
    }

    function weatherRiskRank(sample) {
        const cat = String(sample?.cat || '').toUpperCase();
        if (cat === 'LIFR' || cat === 'IFR') return 3;
        if (cat === 'MVFR') return 2;
        const raw = `${sample?.wx || ''} ${sample?.raw || ''}`.toUpperCase();
        if (/TS|FZ|SN|FG|BKN00|OVC00/.test(raw)) return 3;
        if (/RA|SH|BR|HZ|BKN0[0-2]|OVC0[0-2]/.test(raw)) return 2;
        if (/BKN|OVC|SCT0[0-3]/.test(raw)) return 1;
        return 0;
    }

    function buildWeatherAssessment(rows) {
        const ranks = rows.map(weatherRiskRank);
        const worst = Math.max(0, ...ranks);
        const missing = rows.filter(r => !r.source || r.source === 'Keine Daten').length;
        if (!rows.length) return { tone: 'warn', label: 'Keine Route', text: 'Plane zuerst eine Route, dann kann ich das Wetter entlang der Strecke zusammenfassen.' };
        if (worst >= 3) return { tone: 'bad', label: 'Anspruchsvoll', text: 'Es gibt deutliche Warnzeichen wie IFR/LIFR, Gewitter, Nebel oder sehr tiefe Wolken. Für VFR wäre das keine entspannte Lage.' };
        if (worst === 2) return { tone: 'warn', label: 'Genau prüfen', text: 'Die Lage ist gemischt: Sicht, Wolken oder Niederschlag können einzelne Abschnitte schwierig machen. Plane Ausweichoptionen ein.' };
        if (worst === 1) return { tone: 'watch', label: 'Beobachten', text: 'Grundsätzlich wirkt die Lage brauchbar, aber Wolken oder lokale Wetterzeichen verdienen Aufmerksamkeit.' };
        if (missing >= Math.ceil(rows.length / 2)) return { tone: 'warn', label: 'Daten dünn', text: 'Es sind zu wenige automatische Wetterdaten entlang der Route vorhanden. Nutze zusätzlich offizielle Quellen.' };
        return { tone: 'good', label: 'Unauffällig', text: 'Die automatisch gefundenen Daten zeigen keine groben roten Flaggen. Trotzdem bitte offizielles Wetterbriefing prüfen.' };
    }

    function weatherDateMs(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
        if (/^\d+$/.test(String(value))) {
            const numeric = Number(value);
            return numeric > 1e12 ? numeric : numeric * 1000;
        }
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatUtcWeatherTime(value) {
        const ms = weatherDateMs(value) || Date.now();
        const date = new Date(ms);
        if (!Number.isFinite(date.getTime())) return '';
        return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} Z`;
    }

    function formatWeatherAge(value) {
        const ms = weatherDateMs(value);
        if (!ms) return '';
        const ageMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
        if (ageMin < 90) return `${ageMin} min alt`;
        const ageHours = Math.round(ageMin / 60);
        return `${ageHours} h alt`;
    }

    function weatherCardTone(row) {
        if (!row?.source || row.source === 'Keine Daten') return 'warn';
        const rank = weatherRiskRank(row);
        if (rank >= 3) return 'bad';
        if (rank === 2) return 'warn';
        if (rank === 1) return 'watch';
        return 'good';
    }

    function weatherBadgeLabel(row) {
        if (!row?.source || row.source === 'Keine Daten') return '?';
        const cat = String(row?.cat || '').toUpperCase();
        if (cat) return cat === 'VFR' ? 'V' : cat.slice(0, 1);
        const tone = weatherCardTone(row);
        if (tone === 'good') return 'V';
        if (tone === 'watch') return '?';
        return '!';
    }

    function weatherStationTitle(row) {
        const station = String(row?.station || '').trim().toUpperCase();
        const name = String(row?.name || row?.label || station || 'Wetterpunkt').trim();
        if (station && !name.toUpperCase().includes(station)) return `${name} (${station})`;
        return name || station || 'Wetterpunkt';
    }

    function weatherSourceTitle(row) {
        const source = String(row?.source || 'Wetter').split('+')[0].trim().toUpperCase();
        const label = source.includes('METAR') ? 'METAR' : (source.includes('OPEN') ? 'Modell' : source || 'Wetter');
        return `${label} from ${formatUtcWeatherTime(row?.observedAt)}`;
    }

    function renderWeatherFact(label, value, options = {}) {
        if (!value) return '';
        const className = options.danger ? ' route-weather-value is-danger' : ' route-weather-value';
        return `
            <div class="route-weather-row">
                <span class="route-weather-label">${escapeHtml(label)}</span>
                <span class="${className.trim()}">${escapeHtml(value)}</span>
            </div>
        `;
    }

    function renderWeatherStation(row) {
        const tone = weatherCardTone(row);
        const observedAt = row?.observedAt || row?.generatedAt;
        const tempParts = [row?.temp, row?.dew].filter(Boolean).join(' / ');
        const tempLine = [tempParts, row?.rh].filter(Boolean).join(', ');
        const wxDanger = weatherRiskRank(row) >= 2;
        return `
            <section class="route-weather-station">
                <h3 class="route-weather-station-title">${escapeHtml(weatherStationTitle(row))}</h3>
                <article class="route-weather-card is-${escapeAttr(tone)}">
                    <div class="route-weather-card-head">
                        <div>
                            <div class="route-weather-card-title">${escapeHtml(weatherSourceTitle(row))}</div>
                            ${formatWeatherAge(observedAt) ? `<div class="route-weather-card-age">${escapeHtml(formatWeatherAge(observedAt))}</div>` : ''}
                        </div>
                        <span class="route-weather-badge">${escapeHtml(weatherBadgeLabel(row))}</span>
                    </div>
                    <div class="route-weather-facts">
                        ${renderWeatherFact('Wind', row?.wind || '—')}
                        ${renderWeatherFact('Temperatur', tempLine)}
                        ${renderWeatherFact('Luftdruck', row?.pressure)}
                        ${renderWeatherFact('Sichtweite', row?.vis || '—')}
                        ${renderWeatherFact('Wolken', row?.clouds || '—', { danger: wxDanger && /BKN|OVC|VV|8\/8|5-7\/8/i.test(String(row?.clouds || '')) })}
                        ${renderWeatherFact('WX', row?.wx && row.wx !== 'NIL' ? row.wx : 'NIL', { danger: wxDanger && row?.wx && row.wx !== 'NIL' })}
                    </div>
                    <div class="route-weather-source">${escapeHtml(row?.source || 'Keine Daten')}${row?.station ? ` · ${escapeHtml(row.station)}` : ''}</div>
                </article>
            </section>
        `;
    }

    function getGeminiApiKey() {
        try {
            const input = document.getElementById('apiKeyInput');
            return String(input?.value || localStorage.getItem('ga_gemini_key') || '').trim();
        } catch (_) {
            return '';
        }
    }

    function weatherAiCacheKey(routeKey, rows) {
        const compact = (rows || []).map(r => [
            r.label, r.name, r.source, r.station, r.wind, r.vis, r.clouds, r.wx, r.cat
        ].map(v => String(v || '').slice(0, 80)).join('/')).join('|');
        return `wx-ai:${routeKey}:${compact}`;
    }

    function weatherAiPrompt(rows, assessment) {
        const routeLines = rows.map(r => (
            `${r.label} ${r.name || ''}: Quelle ${r.source || 'keine'}, Station ${r.station || '-'}, Wind ${r.wind || '-'}, Sicht ${r.vis || '-'}, Wolken ${r.clouds || '-'}, Wx ${r.wx || '-'}, Kategorie ${r.cat || '-'}`
        )).join('\n');
        return `Du bist ein vorsichtiger VFR-Briefing-Assistent für Privatpiloten. Schreibe auf Deutsch eine kurze, laienverständliche Wetter-Einschätzung entlang einer geplanten Route.

Regeln:
- Maximal 4 Sätze, keine Markdown-Liste.
- Keine Freigabe zum Fliegen erteilen, keine Rechtsberatung.
- Sage klar, was kritisch sein könnte und was zusätzlich offiziell geprüft werden muss.
- Wenn Daten fehlen oder widersprüchlich sind, sage das deutlich.
- Nutze einfache Sprache, aber fachlich korrekt.

Regelbasierte Vorbewertung: ${assessment?.label || '-'}: ${assessment?.text || '-'}

Daten:
${routeLines}`;
    }

    async function fetchGeminiWeatherText(rows, assessment, signal) {
        const apiKey = getGeminiApiKey();
        if (!apiKey || !rows?.length) return null;
        const payload = {
            contents: [{ parts: [{ text: weatherAiPrompt(rows, assessment) }] }],
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 260
            }
        };
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };
        if (signal) options.signal = signal;
        const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
        for (const model of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, options);
                if (!res.ok) continue;
                const data = await res.json();
                const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
                if (text) {
                    if (typeof incrementApiUsage === 'function') {
                        try { incrementApiUsage(model.includes('lite') ? 'lite' : 'flash'); } catch (_) {}
                    }
                    return { text: text.replace(/\s+/g, ' '), source: model };
                }
            } catch (error) {
                if (error?.name === 'AbortError') throw error;
            }
        }
        return null;
    }

    async function maybeGenerateWeatherAi(entry, routeKey, rows, assessment, signal, force = false) {
        const apiKey = getGeminiApiKey();
        if (!apiKey || !rows?.length) return;
        const aiKey = weatherAiCacheKey(routeKey, rows);
        const ai = entry.data?.ai || {};
        if (!force && entry.aiKey === aiKey && (Date.now() - entry.aiUpdatedAt) < WEATHER_AI_CACHE_TTL_MS && (ai.text || ai.error)) return;
        entry.aiKey = aiKey;
        entry.aiLoading = true;
        entry.data.ai = { ...ai, loading: true, error: '', text: force ? '' : (ai.text || ''), source: ai.source || '' };
        if (state.view === 'weather') render();
        try {
            const result = await fetchGeminiWeatherText(rows, assessment, signal);
            if (result?.text) {
                entry.data.ai = { loading: false, error: '', text: result.text, source: result.source };
                entry.aiUpdatedAt = Date.now();
            } else {
                entry.data.ai = { loading: false, error: 'KI-Einschätzung nicht verfügbar.', text: '', source: '' };
                entry.aiUpdatedAt = Date.now();
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                entry.data.ai = { loading: false, error: 'KI-Einschätzung konnte nicht geladen werden.', text: '', source: '' };
                entry.aiUpdatedAt = Date.now();
            }
        } finally {
            entry.aiLoading = false;
            if (entry.data?.ai?.loading) entry.data.ai.loading = false;
            if (state.view === 'weather') render();
        }
    }

    async function ensureWeatherTool(force = false) {
        const key = getRouteKey();
        const entry = toolState.weather;
        if (!force && isCacheFresh(entry, key)) {
            await maybeGenerateWeatherAi(entry, key, entry.data?.rows || [], entry.data?.assessment || null, null, false);
            return;
        }
        if (entry.loading && entry.key === key && !force) return;
        abortToolRequest('weather');
        entry.loading = true;
        entry.key = key;
        entry.error = '';
        entry.controller = new AbortController();
        if (state.view === 'weather') render();
        try {
            const samples = pickRouteSamplePoints(5);
            let routeMetars = [];
            if (samples.length) {
                try {
                    routeMetars = await fetchRouteMetarsForWeather(samples, entry.controller.signal);
                } catch (_) {
                    routeMetars = [];
                }
            }
            let openMeteo = [];
            if (samples.length && typeof window.fetchOpenMeteoWeatherPoints === 'function') {
                try {
                    openMeteo = await window.fetchOpenMeteoWeatherPoints(
                        samples.map(p => ({ lat: p.lat, lon: p.lon })),
                        { signal: entry.controller.signal, includePressure: true, maxConcurrency: 2 }
                    );
                } catch (_) {
                    openMeteo = [];
                }
            }
            const dep = getCurrentAirport('dep');
            const dest = getCurrentAirport('dest');
            const rows = samples.map((p, idx) => {
                const label = idx === 0 ? 'Start' : (idx === samples.length - 1 ? 'Ziel' : `Route ${idx}`);
                const icao = idx === 0 ? dep.icao : (idx === samples.length - 1 ? dest.icao : '');
                const cached = weatherFromMetarCache(icao) || nearestMetarWeatherPoint(p.lat, p.lon, routeMetars) || nearestCachedWeatherPoint(p.lat, p.lon);
                const fromOm = weatherFromOpenMeteo(openMeteo[idx]);
                return { label, name: p.name || icao || label, lat: p.lat, lon: p.lon, generatedAt: Date.now(), ...mergeWeatherSources(cached, fromOm) };
            });
            const assessment = buildWeatherAssessment(rows);
            entry.data = { rows, assessment, generatedAt: Date.now(), ai: null };
            entry.updatedAt = Date.now();
            entry.loading = false;
            if (state.view === 'weather') render();
            await maybeGenerateWeatherAi(entry, key, rows, assessment, entry.controller?.signal, force);
        } catch (error) {
            if (error?.name !== 'AbortError') entry.error = 'Wetterdaten konnten nicht geladen werden.';
        } finally {
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'weather') render();
        }
    }

    function renderWeatherTool() {
        setTitle('Wetter');
        const entry = toolState.weather;
        const data = entry.data;
        const rows = data?.rows || [];
        const assessment = data?.assessment;
        const ai = data?.ai || null;
        const body = rows.length
            ? rows.map(row => renderWeatherStation(row)).join('')
            : renderToolEmpty(entry.loading ? 'Wetter wird sparsam geladen...' : 'Keine Route für Wetterübersicht gefunden.');
        bodyEl.innerHTML = `
            ${toolTopline('weather')}
            ${assessment ? `
                <div class="route-tool-summary is-${escapeAttr(assessment.tone)}">
                    <div class="route-tool-summary-label">${escapeHtml(assessment.label)}</div>
                    <div class="route-tool-summary-text">${escapeHtml(assessment.text)}</div>
                </div>
            ` : ''}
            ${ai && (ai.loading || ai.text || ai.error) ? `
                <div class="route-tool-ai">
                    <div class="route-tool-summary-label">KI-Einschätzung</div>
                    <div class="route-tool-summary-text">${escapeHtml(ai.loading ? 'KI formuliert die Lage...' : (ai.text || ai.error || ''))}</div>
                    ${ai.source ? `<div class="route-tool-row-meta">${escapeHtml(ai.source)}</div>` : ''}
                </div>
            ` : ''}
            ${entry.error ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            <div class="route-tool-list">${body}</div>
        `;
    }

    function airspaceFreqRows() {
        try {
            if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return [];
            return activeAirspaces
                .filter(as => Array.isArray(as?.frequencies) && as.frequencies.length > 0)
                .slice(0, 18)
                .map(as => ({
                    title: as.name || 'Luftraum',
                    meta: `Enroute · ${as.type === 33 ? 'FIS' : 'Luftraum'}`,
                    values: as.frequencies.slice(0, 3).map(f => `${f.name || f.label || 'INFO'} ${f.value}`).join(' · ')
                }));
        } catch (_) {
            return [];
        }
    }

    function distancePointToRouteNm(lat, lon, routePts) {
        if (!routePts.length) return Infinity;
        let best = Infinity;
        routePts.forEach(p => { best = Math.min(best, navBetween(lat, lon, p.lat, p.lon).dist); });
        return best;
    }

    async function fetchRouteOpenAip(path, bounds, limit, signal) {
        if (!bounds) return [];
        const bbox = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;
        const data = await fetchJson(`${ROUTE_TOOLS_PROXY}/api/${path}?bbox=${encodeURIComponent(bbox)}&limit=${limit}&t=${Date.now()}`, signal);
        return Array.isArray(data?.items) ? data.items : [];
    }

    async function ensureRadioTool(force = false) {
        const key = getRouteKey();
        const entry = toolState.radio;
        if (!force && isCacheFresh(entry, key)) return;
        if (entry.loading && entry.key === key && !force) return;
        abortToolRequest('radio');
        entry.loading = true;
        entry.key = key;
        entry.error = '';
        entry.controller = new AbortController();
        if (state.view === 'radio') render();
        try {
            const route = getRoutePoints();
            const dep = getCurrentAirport('dep');
            const dest = getCurrentAirport('dest');
            if (dep.icao && typeof fetchAirportFreq === 'function' && !getFreqLines(dep.icao).length) fetchAirportFreq(dep.icao, null, 'dep').catch(() => null);
            if (dest.icao && typeof fetchAirportFreq === 'function' && !getFreqLines(dest.icao).length) fetchAirportFreq(dest.icao, null, 'dest').catch(() => null);
            if (route.length >= 2 && typeof fetchRouteAirspaces === 'function') {
                try {
                    const hasAirspaces = typeof activeAirspaces !== 'undefined' && Array.isArray(activeAirspaces) && activeAirspaces.length;
                    if (force || !hasAirspaces) await fetchRouteAirspaces(route.map(p => ({ lat: p.lat, lng: p.lon })));
                } catch (_) {}
            }
            const bounds = routeBounds(route, 10);
            let airports = [];
            let navaids = [];
            if (bounds && route.length >= 2) {
                const [aptItems, navItems] = await Promise.all([
                    fetchRouteOpenAip('airports', bounds, 120, entry.controller.signal).catch(() => []),
                    fetchRouteOpenAip('navaids', bounds, 120, entry.controller.signal).catch(() => [])
                ]);
                airports = aptItems.map(normalizeToolAirport)
                    .filter(a => a?.icao && Number.isFinite(a.lat) && Number.isFinite(a.lon) && a.icao !== dep.icao && a.icao !== dest.icao)
                    .map(a => ({ ...a, routeDist: distancePointToRouteNm(a.lat, a.lon, route) }))
                    .filter(a => a.routeDist <= 8)
                    .sort((a, b) => a.routeDist - b.routeDist)
                    .slice(0, 10);
                airports.forEach(a => {
                    if (typeof fetchAirportFreq === 'function' && a.icao && !getFreqLines(a.icao).length) {
                        fetchAirportFreq(a.icao, null, null).catch(() => null);
                    }
                });
                if (airports.length) setTimeout(() => { if (state.view === 'radio') render(); }, 1100);
                navaids = navItems
                    .filter(n => n?.geometry?.coordinates)
                    .map(n => {
                        const lat = Number(n.geometry.coordinates[1]), lon = Number(n.geometry.coordinates[0]);
                        const freq = n.frequency?.value || n.frequency || n.frequencies?.[0]?.value || '';
                        return { name: n.name || n.identifier || 'Funkfeuer', ident: n.identifier || n.designator || '', lat, lon, freq, routeDist: distancePointToRouteNm(lat, lon, route) };
                    })
                    .filter(n => Number.isFinite(n.lat) && Number.isFinite(n.lon) && n.routeDist <= 12)
                    .sort((a, b) => a.routeDist - b.routeDist)
                    .slice(0, 10);
            }
            entry.data = { dep, dest, airports, navaids, generatedAt: Date.now() };
            entry.updatedAt = Date.now();
        } catch (error) {
            if (error?.name !== 'AbortError') entry.error = 'Radio-Daten konnten nicht geladen werden.';
        } finally {
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'radio') render();
        }
    }

    function renderAirportContext(key, apt) {
        if (!apt?.icao) return '';
        const encoded = encodeURIComponent(JSON.stringify(apt));
        return state.radioAirportMenuKey === key ? `
            <div class="route-tool-context">
                <button class="checklist-mini-btn primary" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encoded)}">Direct To</button>
                <button class="checklist-mini-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encoded)}">Info</button>
            </div>
        ` : '';
    }

    function renderFreqBlock(label, apt, menuKey = '') {
        const freqs = getFreqLines(apt?.icao);
        const heading = apt?.icao ? `${label} · ${apt.icao}` : label;
        const key = menuKey || `radio_${String(label || '').toLowerCase()}_${apt?.icao || 'none'}`;
        const canOpenMenu = !!apt?.icao;
        return `
            <div class="route-tool-section">
                ${canOpenMenu ? `
                    <button class="route-tool-airport-main route-tool-airport-main-heading" type="button" data-action="radio-airport-menu" data-key="${escapeAttr(key)}">
                        <span>
                            <span class="route-tool-section-title">${escapeHtml(heading)}</span>
                            <span class="route-tool-section-sub">${escapeHtml(apt?.name || '')}</span>
                        </span>
                        <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                    </button>
                    ${renderAirportContext(key, apt)}
                ` : `
                    <div class="route-tool-section-title">${escapeHtml(heading)}</div>
                    <div class="route-tool-section-sub">${escapeHtml(apt?.name || '')}</div>
                `}
                ${freqs.length ? freqs.map(f => `<div class="route-tool-freq"><span>${escapeHtml(f.label)}</span><b>${escapeHtml(f.value)}</b></div>`).join('') : renderToolEmpty('Noch keine Frequenzen im Cache. Aktualisieren lädt nach.')}
            </div>
        `;
    }

    function renderRadioTool() {
        setTitle('Radio');
        const entry = toolState.radio;
        const data = entry.data;
        const airRows = airspaceFreqRows();
        bodyEl.innerHTML = `
            ${toolTopline('radio')}
            ${entry.error ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            ${data ? renderFreqBlock('Start', data.dep, `radio_start_${data.dep?.icao || 'none'}`) : ''}
            <div class="route-tool-section">
                <div class="route-tool-section-title">Enroute / FIS</div>
                ${airRows.length ? airRows.map(r => `
                    <div class="route-tool-row">
                        <div class="route-tool-row-main">
                            <div class="route-tool-row-title">${escapeHtml(r.title)}</div>
                            <div class="route-tool-row-meta">${escapeHtml(r.meta)}</div>
                            <div class="route-tool-row-value">${escapeHtml(r.values)}</div>
                        </div>
                    </div>
                `).join('') : renderToolEmpty(entry.loading ? 'Lufträume/FIS werden geladen...' : 'Keine Enroute-Frequenzen gefunden.')}
            </div>
            <div class="route-tool-section">
                <div class="route-tool-section-title">Plätze entlang der Route</div>
                ${data?.airports?.length ? data.airports.map(a => {
                    const freqs = getFreqLines(a.icao).slice(0, 3);
                    const key = `radio_${a.icao}_${Math.round(a.routeDist * 10)}`;
                    const open = state.radioAirportMenuKey === key;
                    return `<div class="route-tool-row route-tool-radio-airport">
                        <button class="route-tool-airport-main" type="button" data-action="radio-airport-menu" data-key="${escapeAttr(key)}">
                            <span>
                                <span class="route-tool-row-title">${escapeHtml(a.icao)} · ${escapeHtml(a.name)}</span>
                                <span class="route-tool-row-meta">${fmtNm(a.routeDist)} NM neben Route</span>
                            </span>
                            <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                        </button>
                        ${freqs.length ? `<div class="route-tool-radio-freqs">${freqs.map(f => `<span>${escapeHtml(f.label)} <b>${escapeHtml(f.value)}</b></span>`).join('')}</div>` : '<div class="route-tool-row-meta">Frequenzen werden bei Bedarf geladen.</div>'}
                        ${open ? renderAirportContext(key, a) : ''}
                    </div>`;
                }).join('') : renderToolEmpty(entry.loading ? 'Nahe Plätze werden geladen...' : 'Keine nahen Plätze gefunden.')}
            </div>
            <div class="route-tool-section">
                <div class="route-tool-section-title">Funkfeuer</div>
                ${data?.navaids?.length ? data.navaids.map(n => `<div class="route-tool-row"><div class="route-tool-row-title">${escapeHtml(n.ident || '')} ${escapeHtml(n.name)}</div><div class="route-tool-row-meta">${fmtNm(n.routeDist)} NM neben Route${n.freq ? ` · ${escapeHtml(n.freq)}` : ''}</div></div>`).join('') : renderToolEmpty(entry.loading ? 'Funkfeuer werden geladen...' : 'Keine Funkfeuer entlang der Route gefunden.')}
            </div>
            ${data ? renderFreqBlock('Ziel', data.dest, `radio_dest_${data.dest?.icao || 'none'}`) : renderToolEmpty(entry.loading ? 'Radio-Daten werden geladen...' : 'Keine Radio-Daten.')}
        `;
    }

    function ensurePlaceTool(force = false) {
        const key = `${getCurrentAirport('dep').icao}|${getCurrentAirport('dest').icao}|${getRouteKey()}`;
        const entry = toolState.place;
        if (!force && isCacheFresh(entry, key, TOOL_CACHE_TTL_MS)) return;
        entry.key = key;
        entry.updatedAt = Date.now();
        entry.data = { dep: getCurrentAirport('dep'), dest: getCurrentAirport('dest') };
        const airports = [entry.data.dep, entry.data.dest].filter(a => a?.icao && /^[A-Z0-9]{4}$/.test(a.icao));
        airports.forEach((apt, idx) => {
            if (typeof fetchAirportFreq === 'function' && !getFreqLines(apt.icao).length) fetchAirportFreq(apt.icao, null, idx === 0 ? 'dep' : 'dest').catch(() => null);
            if (typeof fetchRunwayDetails === 'function' && !getRunwayText(apt.icao) && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
                const id = `routeToolHiddenRwy_${apt.icao}`;
                let hidden = document.getElementById(id);
                if (!hidden) {
                    hidden = document.createElement('div');
                    hidden.id = id;
                    hidden.style.display = 'none';
                    document.body.appendChild(hidden);
                }
                fetchRunwayDetails(apt.lat, apt.lon, id, apt.icao).catch(() => null);
            }
        });
        if (state.view === 'place') setTimeout(() => { if (state.view === 'place') render(); }, 800);
    }

    function placeMapId(label, apt) {
        const raw = `${label}_${apt?.icao || apt?.name || ''}_${Number(apt?.lat || 0).toFixed(3)}_${Number(apt?.lon || 0).toFixed(3)}`;
        return `routeToolMap_${raw.replace(/[^\w-]/g, '_')}`;
    }

    function placeWeatherId(label, apt) {
        const raw = `${label}_${apt?.icao || apt?.name || ''}_${Number(apt?.lat || 0).toFixed(3)}_${Number(apt?.lon || 0).toFixed(3)}`;
        return `routeToolWx_${raw.replace(/[^\w-]/g, '_')}`;
    }

    function staticMapTile(lat, lon, zoom = 11) {
        const φ = Number(lat) * Math.PI / 180;
        const n = 2 ** zoom;
        const xFloat = ((Number(lon) + 180) / 360) * n;
        const yFloat = (1 - Math.log(Math.tan(φ) + (1 / Math.cos(φ))) / Math.PI) / 2 * n;
        const x = Math.floor(xFloat);
        const y = Math.floor(yFloat);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {
            url: `https://a.tile.opentopomap.org/${zoom}/${x}/${y}.png`,
            pctX: Math.max(0, Math.min(100, (xFloat - x) * 100)),
            pctY: Math.max(0, Math.min(100, (yFloat - y) * 100))
        };
    }

    function placeCard(label, apt, detailAction = true) {
        const coords = Number.isFinite(apt?.lat) && Number.isFinite(apt?.lon) ? `${apt.lat.toFixed(4)}, ${apt.lon.toFixed(4)}` : '—';
        const freqs = getFreqLines(apt?.icao).slice(0, 5);
        const rwy = getRunwayText(apt?.icao);
        const rwyRows = parseRunwayRows(rwy);
        const aip = getAipUrlForAirport(apt);
        const mapId = placeMapId(label, apt);
        const wxId = placeWeatherId(label, apt);
        const hasCoords = Number.isFinite(apt?.lat) && Number.isFinite(apt?.lon);
        const tile = hasCoords ? staticMapTile(apt.lat, apt.lon) : null;
        return `
            <div class="route-tool-place-card">
                <div class="route-tool-place-head">
                    <div>
                        <div class="route-tool-place-label">${escapeHtml(label)}</div>
                        <div class="route-tool-place-title">${escapeHtml(apt?.icao || '—')} · ${escapeHtml(apt?.name || '—')}</div>
                    </div>
                    ${detailAction && apt?.icao ? `<button class="checklist-mini-btn route-tool-inline-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encodeURIComponent(JSON.stringify(apt)))}">Info</button>` : ''}
                </div>
                <div class="route-tool-place-visual">
                    <div id="${escapeAttr(mapId)}" class="route-tool-mini-map" data-lat="${escapeAttr(apt?.lat)}" data-lon="${escapeAttr(apt?.lon)}">
                        ${tile ? `
                            <img class="route-tool-static-map-img" src="${escapeAttr(tile.url)}" alt="" loading="lazy">
                            <span class="route-tool-static-map-marker" style="left:${tile.pctX.toFixed(1)}%;top:${tile.pctY.toFixed(1)}%"></span>
                        ` : '<span>Keine Kartenposition</span>'}
                    </div>
                    <div class="route-tool-place-facts">
                        <div class="route-tool-place-chip"><span>Koordinaten</span><b>${escapeHtml(coords)}</b></div>
                        <div class="route-tool-place-chip"><span>Elevation</span><b>${apt?.elevation != null ? `${Math.round(apt.elevation)} ft` : '—'}</b></div>
                    </div>
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Wetter</div>
                    <div id="${escapeAttr(wxId)}" class="route-tool-weather-widget">Wetter lädt bei Bedarf…</div>
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Pisten</div>
                    ${rwyRows.length ? rwyRows.map(row => `<div class="route-tool-runway-row"><span>${escapeHtml(row.ident)}</span><b>${escapeHtml(row.detail || 'Details offen')}</b></div>`).join('') : renderToolEmpty('Keine Pistendaten im Cache.')}
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Frequenzen</div>
                    ${freqs.length ? `<div class="route-tool-frequency-chips">${freqs.map(f => `<span>${escapeHtml(f.label)} <b>${escapeHtml(f.value)}</b></span>`).join('')}</div>` : renderToolEmpty('Keine Frequenzen im Cache.')}
                </div>
                ${aip ? `<a class="route-tool-link" href="${escapeAttr(aip)}" target="_blank" rel="noopener noreferrer">AIP öffnen ↗</a>` : ''}
            </div>
        `;
    }

    function renderPlaceEnhancements() {
        Array.from(bodyEl.querySelectorAll('.route-tool-weather-widget')).forEach(el => {
            if (el.dataset.loaded === 'true') return;
            const card = el.closest('.route-tool-place-card');
            const title = card?.querySelector('.route-tool-place-title')?.textContent || '';
            const code = (title.match(/\b[A-Z0-9]{4}\b/) || [''])[0];
            const mapEl = card?.querySelector('.route-tool-mini-map');
            const lat = Number(mapEl?.dataset.lat);
            const lon = Number(mapEl?.dataset.lon);
            if (typeof loadMetarWidget === 'function') {
                el.dataset.loaded = 'true';
                loadMetarWidget(code || null, el.id, lat, lon, true);
            }
        });
    }

    function renderPlaceTool() {
        setTitle('Platz');
        ensurePlaceTool(false);
        const data = toolState.place.data || { dep: getCurrentAirport('dep'), dest: getCurrentAirport('dest') };
        bodyEl.innerHTML = `
            ${toolTopline('place')}
            ${placeCard('Start', data.dep)}
            ${placeCard('Ziel', data.dest)}
        `;
        setTimeout(renderPlaceEnhancements, 0);
    }

    async function ensureNearestTool(force = false) {
        const origin = getLiveAircraftPosition();
        const entry = toolState.nearest;
        if (!origin) {
            abortToolRequest('nearest');
            entry.data = null;
            entry.error = 'Keine frische Live-Position. Nearest nutzt bewusst nicht die Karte als Ersatz für das Flugzeug.';
            entry.loading = false;
            if (state.view === 'nearest') render();
            return;
        }
        const originKey = `${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}`;
        const movedNm = entry.origin ? navBetween(entry.origin.lat, entry.origin.lon, origin.lat, origin.lon).dist : Infinity;
        const key = `nearest:${originKey}`;
        if (!force && isCacheFresh(entry, entry.key, NEAREST_CACHE_TTL_MS) && movedNm < NEAREST_MOVE_REFRESH_NM) return;
        if (entry.loading && !force) return;
        abortToolRequest('nearest');
        entry.loading = true;
        entry.key = key;
        entry.origin = origin;
        entry.error = '';
        entry.controller = new AbortController();
        if (state.view === 'nearest') render();
        try {
            const b = routeBounds([{ lat: origin.lat, lon: origin.lon }], NEAREST_RADIUS_NM);
            const items = await fetchRouteOpenAip('airports', b, 250, entry.controller.signal);
            const airports = items.map(normalizeToolAirport)
                .filter(a => a?.icao && Number.isFinite(a.lat) && Number.isFinite(a.lon))
                .map(a => ({ ...a, nav: navBetween(origin.lat, origin.lon, a.lat, a.lon) }))
                .filter(a => a.nav.dist <= NEAREST_RADIUS_NM)
                .sort((a, b) => a.nav.dist - b.nav.dist)
                .slice(0, 30);
            entry.data = { origin, airports, generatedAt: Date.now() };
            entry.updatedAt = Date.now();
        } catch (error) {
            if (error?.name !== 'AbortError') entry.error = 'Nearest konnte nicht geladen werden.';
        } finally {
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'nearest') render();
        }
    }

    function renderNearestTool() {
        setTitle('Nearest');
        const entry = toolState.nearest;
        const airports = entry.data?.airports || [];
        const list = entry.error && !entry.loading ? ''
            : airports.length ? airports.map((apt, index) => {
            const key = `${apt.icao}_${index}`;
            const open = state.nearestMenuKey === key;
            const encoded = encodeURIComponent(JSON.stringify(apt));
            return `
                <div class="route-tool-nearest">
                    <button class="route-tool-nearest-main" type="button" data-action="nearest-menu" data-key="${escapeAttr(key)}">
                        <span>
                            <span class="route-tool-row-title">${escapeHtml(apt.icao)} · ${escapeHtml(apt.name)}</span>
                            <span class="route-tool-row-meta">${fmtNm(apt.nav.dist)} NM · ${apt.nav.brng}° ${compassFromBearing(apt.nav.brng)}</span>
                        </span>
                        <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                    </button>
                    ${open ? `
                        <div class="route-tool-context">
                            <button class="checklist-mini-btn primary" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encoded)}">Direct To</button>
                            <button class="checklist-mini-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encoded)}">Info</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('') : renderToolEmpty(entry.loading ? 'Nearest wird geladen...' : 'Keine Flugplätze im Umkreis von 50 NM gefunden.');
        bodyEl.innerHTML = `
            ${toolTopline('nearest')}
            ${entry.error && !entry.loading ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            <div class="route-tool-list">${list}</div>
        `;
    }

    function decodeAirportDataset(button) {
        try {
            return normalizeToolAirport(JSON.parse(decodeURIComponent(button.dataset.airport || '')));
        } catch (_) {
            return null;
        }
    }

    function renderAirportInfoTool() {
        setTitle('Platz Info');
        const apt = state.placeInfoAirport;
        if (!apt) {
            state.view = 'place';
            renderPlaceTool();
            return;
        }
        ensurePlaceTool(false);
        bodyEl.innerHTML = `
            <div class="checklist-topline route-tool-topline">
                <button class="checklist-back-btn" type="button" data-action="open-tool" data-tool="${escapeAttr(state.placeInfoReturn || 'place')}">Zurück</button>
                <button class="checklist-action-btn" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encodeURIComponent(JSON.stringify(apt)))}">Direct To</button>
            </div>
            ${placeCard('Info', apt, false)}
        `;
        setTimeout(renderPlaceEnhancements, 0);
    }

    function renderList() {
        setTitle('Checklists');
        const cards = visibleChecklists().map(checklist => {
            const progress = checkedCount(checklist.id);
            const total = itemCount(checklist);
            const badge = checklist.published && checklist.source === 'custom'
                ? '<span class="checklist-badge">PUBLIC</span>'
                : (checklist.source === 'community' ? '<span class="checklist-badge">LIVE</span>' : '');
            return `
                <div class="checklist-list-card ${checklist.source === 'builtin' ? 'is-builtin' : ''}">
                    <button class="checklist-list-main" type="button" data-action="open-checklist" data-id="${escapeAttr(checklist.id)}">
                        <span class="checklist-list-title">${escapeHtml(checklist.title)}${badge}</span>
                        <span class="checklist-list-meta">${sourceLabel(checklist)} · ${checklist.chapters.length} Kapitel · ${itemCount(checklist)} Punkte · ${progress}/${total}</span>
                    </button>
                </div>
            `;
        }).join('') || '<div class="checklist-manager-empty">Keine Checklisten sichtbar. Im Zahnrad-Menü kannst du Listen einblenden.</div>';
        bodyEl.innerHTML = `
            <div class="checklist-topline">
                <button class="checklist-back-btn" type="button" data-action="home">Zurück</button>
                <button class="checklist-action-btn primary" type="button" data-action="new">Neue Checkliste</button>
                <button class="checklist-action-btn" type="button" data-action="import-open">Import</button>
                <button class="checklist-icon-btn" type="button" data-action="manager" title="Checklists verwalten">⚙</button>
            </div>
            <div class="checklist-list">${cards}</div>
        `;
        maybePullCommunity(false);
    }

    function renderManager() {
        setTitle('Checklist Auswahl');
        const builtinRows = BUILTIN_CHECKLISTS.map(checklist => managerRow(checklist, 'toggle-visible')).join('');
        const ownRows = customLists.length
            ? customLists.map(checklist => managerRow(checklist, 'toggle-visible')).join('')
            : '<div class="checklist-manager-empty">Noch keine eigenen Checklisten.</div>';
        const visibleRows = visibleChecklists().map((checklist, index, arr) => reorderRow(checklist, index, arr.length)).join('')
            || '<div class="checklist-manager-empty">Keine sichtbaren Checklisten.</div>';
        const ownIds = customCommunityIds();
        const communityRows = communityMeta.filter(meta => !ownIds.has(meta.id)).map(meta => {
            const subscribed = !!communitySubscriptions[meta.id];
            return `
                <div class="checklist-manager-row">
                    <input type="checkbox" data-action="toggle-community-sub" data-id="${escapeAttr(meta.id)}" ${subscribed ? 'checked' : ''}>
                    <div class="checklist-manager-main">
                        <div class="checklist-manager-name">${escapeHtml(meta.title)}</div>
                        <div class="checklist-manager-meta">Community · ${meta.chapterCount} Kapitel · ${meta.itemCount} Punkte</div>
                    </div>
                    <button class="checklist-mini-btn" type="button" data-action="copy-community" data-id="${escapeAttr(meta.id)}">Kopie</button>
                </div>
            `;
        }).join('') || '<div class="checklist-manager-empty">Keine Community-Listen gefunden.</div>';
        bodyEl.innerHTML = `
            <div class="checklist-topline">
                <button class="checklist-back-btn" type="button" data-action="open-list">Zurück</button>
                <button class="checklist-action-btn" type="button" data-action="refresh-community">Community aktualisieren</button>
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">REIHENFOLGE</div>
                ${visibleRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">STANDARD</div>
                ${builtinRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">EIGENE</div>
                ${ownRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">COMMUNITY</div>
                ${communityRows}
            </div>
        `;
        maybePullCommunity(true);
    }

    function reorderRow(checklist, index, total) {
        return `
            <div class="checklist-manager-row checklist-order-row">
                <div class="checklist-manager-main">
                    <div class="checklist-manager-name">${escapeHtml(checklist.title)}</div>
                    <div class="checklist-manager-meta">${sourceLabel(checklist)} · Position ${index + 1}/${total}</div>
                </div>
                <div class="checklist-order-buttons">
                    <button class="checklist-mini-btn" type="button" data-action="move-checklist-order" data-id="${escapeAttr(checklist.id)}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="checklist-mini-btn" type="button" data-action="move-checklist-order" data-id="${escapeAttr(checklist.id)}" data-dir="1" ${index === total - 1 ? 'disabled' : ''}>↓</button>
                </div>
            </div>
        `;
    }

    function managerRow(checklist, action) {
        const checked = isChecklistVisible(checklist);
        const badge = checklist.published ? ' · veröffentlicht' : '';
        return `
            <div class="checklist-manager-row">
                <input type="checkbox" data-action="${action}" data-id="${escapeAttr(checklist.id)}" ${checked ? 'checked' : ''}>
                <div class="checklist-manager-main">
                    <div class="checklist-manager-name">${escapeHtml(checklist.title)}</div>
                    <div class="checklist-manager-meta">${sourceLabel(checklist)}${badge} · ${itemCount(checklist)} Punkte</div>
                </div>
            </div>
        `;
    }

    function checkedCount(checklistId) {
        const progress = progressByChecklist[checklistId] || {};
        return Object.values(progress).filter(Boolean).length;
    }

    function activeChapter(checklist) {
        if (!checklist || !checklist.chapters.length) return null;
        return checklist.chapters.find(chapter => chapter.id === state.activeChapterId) || checklist.chapters[0];
    }

    function renderViewer() {
        const checklist = getChecklist(state.selectedId);
        if (!checklist) {
            state.view = 'list';
            renderList();
            return;
        }
        const chapter = activeChapter(checklist);
        if (!chapter) {
            state.view = 'list';
            renderList();
            return;
        }
        pruneProgress(checklist);
        state.activeChapterId = chapter.id;
        persistUiState();
        setTitle('Checkliste');
        const total = itemCount(checklist);
        const done = checkedCount(checklist.id);
        const tabs = checklist.chapters.map(ch => `
            <button class="checklist-tab ${ch.id === chapter.id ? 'is-active' : ''}" type="button" data-action="tab" data-id="${escapeAttr(ch.id)}">
                ${escapeHtml(ch.title)}
            </button>
        `).join('');
        const rows = chapter.items.map(item => {
            const checked = !!(progressByChecklist[checklist.id] && progressByChecklist[checklist.id][item.id]);
            return `
                <label class="checklist-row ${checked ? 'is-checked' : ''}">
                    <input type="checkbox" data-action="toggle-item" data-item-id="${escapeAttr(item.id)}" ${checked ? 'checked' : ''}>
                    <span class="checklist-row-text">${escapeHtml(item.text)}</span>
                </label>
            `;
        }).join('');
        bodyEl.innerHTML = `
            <div class="checklist-viewer-title">${escapeHtml(checklist.title)}${checklist.published && checklist.source === 'custom' ? '<span class="checklist-badge">PUBLIC</span>' : ''}</div>
            <span class="checklist-progress-meta">${sourceLabel(checklist)} · ${done}/${total} erledigt</span>
            <div class="checklist-viewer-controls">
                <button class="checklist-mini-btn" type="button" data-action="open-list">Zurück</button>
                <button class="checklist-mini-btn" type="button" data-action="reset-progress" data-id="${escapeAttr(checklist.id)}">Reset</button>
                <button class="checklist-icon-btn" type="button" data-action="toggle-actions" title="Aktionen">⚙</button>
            </div>
            ${state.actionMenuOpen ? viewerActionMenu(checklist) : ''}
            <div class="checklist-tabs">${tabs}</div>
            <div class="checklist-rows">${rows}</div>
        `;
    }

    function viewerActionMenu(checklist) {
        const edit = checklist.editable ? `<button class="checklist-mini-btn" type="button" data-action="edit" data-id="${escapeAttr(checklist.id)}">Bearbeiten</button>` : '';
        const del = checklist.editable ? `<button class="checklist-mini-btn danger" type="button" data-action="delete" data-id="${escapeAttr(checklist.id)}">Löschen</button>` : '';
        const unsub = checklist.source === 'community' ? `<button class="checklist-mini-btn danger" type="button" data-action="unsubscribe-community" data-id="${escapeAttr(checklist.communityId)}">Abbestellen</button>` : '';
        const publish = checklist.source === 'custom' ? `
            <label class="checklist-publish-row">
                <input type="checkbox" data-action="toggle-publish-viewer" data-id="${escapeAttr(checklist.id)}" ${checklist.published ? 'checked' : ''}>
                Veröffentlichen
            </label>
        ` : '';
        return `
            <div class="checklist-action-menu">
                ${publish}
                ${edit}
                <button class="checklist-mini-btn" type="button" data-action="copy" data-id="${escapeAttr(checklist.id)}">Als Kopie hinzufügen</button>
                <button class="checklist-mini-btn" type="button" data-action="export" data-id="${escapeAttr(checklist.id)}">Export</button>
                ${unsub}
                ${del}
            </div>
        `;
    }

    function renderEditor() {
        const draft = state.editorDraft;
        if (!draft) {
            state.view = 'list';
            renderList();
            return;
        }
        setTitle(state.editorMode === 'edit' ? 'Checklist bearbeiten' : 'Neue Checkliste');
        const publishRow = `
            <label class="checklist-publish-row">
                <input type="checkbox" data-field="published" ${draft.published ? 'checked' : ''}>
                Veröffentlichen
            </label>
        `;
        const chapters = draft.chapters.map((chapter, chapterIndex) => {
            const items = chapter.items.map((item, itemIndex) => `
                <div class="checklist-editor-item">
                    <textarea class="checklist-editor-textarea" maxlength="${MAX_TEXT_LENGTH}" data-field="item-text" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">${escapeHtml(item.text)}</textarea>
                    <div class="checklist-editor-buttons">
                        <button class="checklist-mini-btn" type="button" data-action="move-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}" data-dir="-1" ${itemIndex === 0 ? 'disabled' : ''}>↑</button>
                        <button class="checklist-mini-btn" type="button" data-action="move-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}" data-dir="1" ${itemIndex === chapter.items.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="checklist-mini-btn" type="button" data-action="duplicate-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">+</button>
                        <button class="checklist-mini-btn danger" type="button" data-action="delete-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">×</button>
                    </div>
                </div>
            `).join('');
            return `
                <div class="checklist-editor-chapter">
                    <div class="checklist-editor-chapter-head">
                        <input class="checklist-editor-input" maxlength="64" value="${escapeAttr(chapter.title)}" data-field="chapter-title" data-chapter-index="${chapterIndex}">
                        <div class="checklist-editor-buttons">
                            <button class="checklist-mini-btn" type="button" data-action="move-chapter" data-chapter-index="${chapterIndex}" data-dir="-1" ${chapterIndex === 0 ? 'disabled' : ''}>↑</button>
                            <button class="checklist-mini-btn" type="button" data-action="move-chapter" data-chapter-index="${chapterIndex}" data-dir="1" ${chapterIndex === draft.chapters.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="checklist-mini-btn" type="button" data-action="duplicate-chapter" data-chapter-index="${chapterIndex}">+</button>
                            <button class="checklist-mini-btn danger" type="button" data-action="delete-chapter" data-chapter-index="${chapterIndex}">×</button>
                        </div>
                    </div>
                    ${items}
                    <button class="checklist-editor-btn checklist-editor-add-row" type="button" data-action="add-item" data-chapter-index="${chapterIndex}">Punkt hinzufügen</button>
                </div>
            `;
        }).join('');
        bodyEl.innerHTML = `
            <div class="checklist-editor-field">
                <label class="checklist-editor-label" for="checklistEditorTitle">Titel</label>
                <input id="checklistEditorTitle" class="checklist-editor-input" maxlength="96" value="${escapeAttr(draft.title)}" data-field="title">
            </div>
            ${publishRow}
            <div class="checklist-editor-actions">
                <button class="checklist-editor-btn primary" type="button" data-action="save-editor">Speichern</button>
                <button class="checklist-editor-btn" type="button" data-action="add-chapter">Kapitel hinzufügen</button>
                <button class="checklist-editor-btn" type="button" data-action="cancel-editor">Zurück</button>
            </div>
            <div class="checklist-editor-chapters">${chapters}</div>
        `;
    }

    function renderImport() {
        setTitle('Checklist Import');
        bodyEl.innerHTML = `
            <textarea id="checklistImportText" class="checklist-import-textarea" spellcheck="false"></textarea>
            <div class="checklist-import-actions">
                <button class="checklist-editor-btn primary" type="button" data-action="import-run">Importieren</button>
                <button class="checklist-editor-btn" type="button" data-action="open-list">Zurück</button>
            </div>
        `;
    }

    function openList() {
        state.view = 'list';
        state.editorDraft = null;
        state.actionMenuOpen = false;
        setStatus('');
        render();
        maybePullKvChecklists();
        maybePullCommunity(false);
    }

    async function openChecklist(id, chapterId = '') {
        if (String(id).startsWith('community:')) {
            const communityId = String(id).slice('community:'.length);
            await ensureCommunityDetail(communityId);
        }
        const checklist = getChecklist(id);
        if (!checklist) return;
        state.selectedId = checklist.id;
        state.activeChapterId = chapterId || state.activeChapterId || checklist.chapters[0]?.id || '';
        state.view = 'viewer';
        state.editorDraft = null;
        state.actionMenuOpen = false;
        persistUiState();
        setStatus('');
        render();
    }

    function makeBlankChecklist() {
        const now = Date.now();
        return {
            id: makeId('custom'),
            title: 'Neue Checkliste',
            source: 'custom',
            editable: true,
            published: false,
            communityId: '',
            createdAt: now,
            updatedAt: now,
            chapters: [{ id: makeId('chap'), title: 'Kapitel 1', items: [{ id: makeId('item'), text: '' }] }]
        };
    }

    function copyChecklistForEditing(source) {
        const now = Date.now();
        return {
            id: makeId('custom'),
            title: `${source.title} Kopie`.slice(0, 96),
            source: 'custom',
            editable: true,
            published: false,
            communityId: '',
            createdAt: now,
            updatedAt: now,
            chapters: source.chapters.map(chapter => ({
                id: makeId('chap'),
                title: chapter.title,
                items: chapter.items.map(item => ({ id: makeId('item'), text: item.text }))
            }))
        };
    }

    function openNewEditor() {
        state.editorDraft = makeBlankChecklist();
        state.editorMode = 'new';
        state.view = 'editor';
        state.actionMenuOpen = false;
        setStatus('');
        render();
    }

    function openEditEditor(id) {
        const checklist = getChecklist(id);
        if (!checklist) return;
        state.editorDraft = checklist.editable ? clone(checklist) : copyChecklistForEditing(checklist);
        state.editorMode = checklist.editable ? 'edit' : 'copy';
        state.view = 'editor';
        state.actionMenuOpen = false;
        setStatus('');
        render();
    }

    function validateDraft(draft) {
        const title = cleanText(draft?.title, 96);
        if (!title) return 'Titel fehlt.';
        if (draft?.published && !getCredentials()) return 'Veröffentlichen braucht Pilot-ID/PIN Login.';
        const chapters = Array.isArray(draft?.chapters) ? draft.chapters : [];
        if (!chapters.length) return 'Mindestens ein Kapitel nötig.';
        if (chapters.length > MAX_CHAPTERS) return `Maximal ${MAX_CHAPTERS} Kapitel.`;
        let total = 0;
        for (let i = 0; i < chapters.length; i += 1) {
            if (!cleanText(chapters[i]?.title, 64)) return `Kapitel ${i + 1}: Titel fehlt.`;
            const items = Array.isArray(chapters[i]?.items) ? chapters[i].items : [];
            const nonEmpty = items.filter(item => cleanText(item?.text));
            if (!nonEmpty.length) return `Kapitel ${i + 1}: Mindestens ein Punkt nötig.`;
            total += nonEmpty.length;
        }
        if (total < 1) return 'Mindestens ein Punkt nötig.';
        if (total > MAX_ITEMS) return `Maximal ${MAX_ITEMS} Punkte.`;
        return '';
    }

    async function saveEditorDraft() {
        const draft = state.editorDraft;
        if (!draft) return;
        const error = validateDraft(draft);
        if (error) {
            setStatus(error, 'error');
            return;
        }
        const previous = customLists.find(item => item.id === draft.id);
        const now = Date.now();
        const sanitized = sanitizeChecklist(draft, {
            id: safeId(draft.id, 'custom'),
            source: 'custom',
            editable: true,
            preserveIds: true
        });
        sanitized.createdAt = Number(draft.createdAt || now);
        sanitized.updatedAt = now;
        if (sanitized.published && !sanitized.communityId) sanitized.communityId = previous?.communityId || sanitized.id;
        upsertCustom(sanitized);
        state.selectedId = sanitized.id;
        state.activeChapterId = sanitized.chapters[0]?.id || '';
        state.view = 'viewer';
        state.editorDraft = null;
        state.editorMode = '';
        state.actionMenuOpen = false;
        persistUiState();
        setStatus('Lokal gespeichert.', 'good');
        render();
        try {
            if (sanitized.published) await publishCommunityChecklist(sanitized);
            else if (previous?.published) await unpublishCommunityChecklist(previous);
            const result = await backupChecklistToKv(sanitized);
            if (result === 'synced') setStatus(sanitized.published ? 'Gespeichert und veröffentlicht.' : 'Gespeichert und gesichert.', 'good');
        } catch (error) {
            setStatus(`Lokal gespeichert. ${communityStatusMessage(error)}`, 'warn');
        }
    }

    function upsertCustom(checklist) {
        const idx = customLists.findIndex(item => item.id === checklist.id);
        if (idx >= 0) customLists[idx] = checklist;
        else customLists.push(checklist);
        saveCustomLists();
    }

    async function deleteChecklist(id) {
        const checklist = getChecklist(id);
        if (!checklist || !checklist.editable) return;
        if (!confirm(`Checkliste "${checklist.title}" löschen?`)) return;
        customLists = customLists.filter(item => item.id !== id);
        delete progressByChecklist[id];
        delete visibilityPrefs[id];
        saveCustomLists();
        saveProgress();
        writeJson(VISIBLE_STORAGE_KEY, visibilityPrefs);
        if (checklist.published) {
            try { await unpublishCommunityChecklist(checklist); } catch (_) {}
        }
        if (state.selectedId === id) {
            state.selectedId = '';
            state.activeChapterId = '';
            state.view = 'list';
            persistUiState();
        }
        setStatus('Gelöscht.', 'good');
        render();
        try {
            await saveKvIndex();
        } catch (_) {
            setStatus('Lokal gelöscht, Cloud-Index nicht aktualisiert.', 'warn');
        }
    }

    function resetProgress(id) {
        delete progressByChecklist[id];
        saveProgress();
        setStatus('Fortschritt zurückgesetzt.', 'good');
        render();
    }

    function pruneProgress(checklist) {
        const progress = progressByChecklist[checklist.id];
        if (!progress) return;
        const valid = new Set();
        checklist.chapters.forEach(chapter => chapter.items.forEach(item => valid.add(item.id)));
        let changed = false;
        Object.keys(progress).forEach(id => {
            if (!valid.has(id)) {
                delete progress[id];
                changed = true;
            }
        });
        if (changed) saveProgress();
    }

    function toggleItem(itemId, checked) {
        const checklist = getChecklist(state.selectedId);
        if (!checklist) return;
        if (!progressByChecklist[checklist.id]) progressByChecklist[checklist.id] = {};
        if (checked) progressByChecklist[checklist.id][itemId] = true;
        else delete progressByChecklist[checklist.id][itemId];
        saveProgress();
        render();
    }

    function moveInArray(arr, index, dir) {
        const nextIndex = index + dir;
        if (!Array.isArray(arr) || index < 0 || nextIndex < 0 || index >= arr.length || nextIndex >= arr.length) return false;
        const [item] = arr.splice(index, 1);
        arr.splice(nextIndex, 0, item);
        return true;
    }

    function duplicateChapter(index) {
        const draft = state.editorDraft;
        const chapter = draft?.chapters?.[index];
        if (!draft || !chapter || draft.chapters.length >= MAX_CHAPTERS) return;
        draft.chapters.splice(index + 1, 0, {
            id: makeId('chap'),
            title: `${chapter.title} Kopie`.slice(0, 64),
            items: chapter.items.map(item => ({ id: makeId('item'), text: item.text }))
        });
        render();
    }

    function duplicateItem(chapterIndex, itemIndex) {
        const items = state.editorDraft?.chapters?.[chapterIndex]?.items;
        if (!items || !items[itemIndex]) return;
        items.splice(itemIndex + 1, 0, { id: makeId('item'), text: items[itemIndex].text });
        render();
    }

    function addChapter() {
        const draft = state.editorDraft;
        if (!draft || draft.chapters.length >= MAX_CHAPTERS) {
            setStatus(`Maximal ${MAX_CHAPTERS} Kapitel.`, 'error');
            return;
        }
        draft.chapters.push({ id: makeId('chap'), title: `Kapitel ${draft.chapters.length + 1}`, items: [{ id: makeId('item'), text: '' }] });
        render();
    }

    function addItem(chapterIndex) {
        const chapter = state.editorDraft?.chapters?.[chapterIndex];
        if (!chapter) return;
        chapter.items.push({ id: makeId('item'), text: '' });
        render();
    }

    function deleteChapter(index) {
        const draft = state.editorDraft;
        if (!draft || draft.chapters.length <= 1) {
            setStatus('Mindestens ein Kapitel bleibt nötig.', 'error');
            return;
        }
        draft.chapters.splice(index, 1);
        render();
    }

    function deleteItem(chapterIndex, itemIndex) {
        const items = state.editorDraft?.chapters?.[chapterIndex]?.items;
        if (!items || items.length <= 1) {
            setStatus('Mindestens ein Punkt bleibt nötig.', 'error');
            return;
        }
        items.splice(itemIndex, 1);
        render();
    }

    function encodeUtf8Base64(text) {
        const binary = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        return btoa(binary);
    }

    function decodeUtf8Base64(text) {
        const binary = atob(text);
        let encoded = '';
        for (let i = 0; i < binary.length; i += 1) encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
        return decodeURIComponent(encoded);
    }

    function sharePayload(checklist) {
        return {
            version: 1,
            checklist: {
                title: checklist.title,
                chapters: checklist.chapters.map(chapter => ({
                    title: chapter.title,
                    items: chapter.items.map(item => ({ text: item.text }))
                }))
            }
        };
    }

    async function exportChecklist(id) {
        const checklist = getChecklist(id);
        if (!checklist) return;
        const code = SHARE_PREFIX + encodeUtf8Base64(JSON.stringify(sharePayload(checklist)));
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('clipboard_unavailable');
            await navigator.clipboard.writeText(code);
            setStatus('Share-Code kopiert.', 'good');
        } catch (_) {
            window.prompt('Share-Code', code);
            setStatus('Share-Code bereit.', 'good');
        }
    }

    function decodeShareCode(raw) {
        let code = String(raw || '').trim();
        if (!code) throw new Error('empty');
        if (code.startsWith('{')) {
            const payload = JSON.parse(code);
            return payload?.checklist || payload;
        }
        if (code.startsWith(SHARE_PREFIX)) code = code.slice(SHARE_PREFIX.length);
        code = code.replace(/\s+/g, '');
        const payload = JSON.parse(decodeUtf8Base64(code));
        return payload?.checklist || payload;
    }

    async function importChecklist() {
        const textarea = document.getElementById('checklistImportText');
        try {
            const incoming = decodeShareCode(textarea?.value || '');
            const now = Date.now();
            const fresh = sanitizeChecklist(incoming, {
                id: makeId('custom'),
                source: 'custom',
                editable: true,
                preserveIds: false
            });
            fresh.createdAt = now;
            fresh.updatedAt = now;
            fresh.published = false;
            fresh.communityId = '';
            if (!fresh.chapters.length) throw new Error('empty_checklist');
            upsertCustom(fresh);
            state.selectedId = fresh.id;
            state.activeChapterId = fresh.chapters[0]?.id || '';
            state.view = 'viewer';
            persistUiState();
            setStatus('Importiert.', 'good');
            render();
            try {
                const result = await backupChecklistToKv(fresh);
                if (result === 'synced') setStatus('Importiert und gesichert.', 'good');
            } catch (_) {
                setStatus('Importiert, Cloud nicht erreichbar.', 'warn');
            }
        } catch (_) {
            setStatus('Import-Code ungültig.', 'error');
        }
    }

    function getSyncBaseUrl() {
        try {
            if (typeof SYNC_URL !== 'undefined' && SYNC_URL) return SYNC_URL;
        } catch (_) {}
        return 'https://ga-proxy.einherjer.workers.dev/api/sync/';
    }

    function getProxyBaseUrl() {
        return getSyncBaseUrl().replace(/\/api\/sync\/?$/, '').replace(/\/$/, '');
    }

    function getCommunityApiUrl(path = '') {
        return `${getProxyBaseUrl()}/api/checklists/community${path}`;
    }

    function getCredentials() {
        const id = typeof window.getSyncId === 'function'
            ? window.getSyncId()
            : (localStorage.getItem('ga_sync_id') || localStorage.getItem('ga_saved_id') || '');
        const pin = typeof window.getSyncPin === 'function'
            ? window.getSyncPin()
            : (localStorage.getItem('ga_sync_pin') || localStorage.getItem('ga_saved_pin') || '');
        const cleanId = String(id || '').trim();
        const cleanPin = String(pin || '').trim();
        if (!cleanId || !cleanPin) return null;
        return { id: cleanId, pin: cleanPin };
    }

    function encodedSyncId(id) {
        return encodeURIComponent(id).replace(/%/g, '_');
    }

    function kvIndexKey(credentials = getCredentials()) {
        return credentials ? `CHKIDX_${encodedSyncId(credentials.id)}` : '';
    }

    function kvChecklistKey(checklistId, credentials = getCredentials()) {
        return credentials ? `CHK_${encodedSyncId(credentials.id)}_${safeId(checklistId, 'custom')}` : '';
    }

    async function kvFetch(key, credentials) {
        const url = `${getSyncBaseUrl()}${encodeURIComponent(key)}?pin=${encodeURIComponent(credentials.pin)}`;
        return fetch(url, { headers: { 'X-Pilot-PIN': credentials.pin } });
    }

    async function kvGet(key, credentials) {
        const res = await kvFetch(key, credentials);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`kv_get_${res.status}`);
        return res.json();
    }

    async function kvPut(key, payload, credentials) {
        const url = `${getSyncBaseUrl()}${encodeURIComponent(key)}?pin=${encodeURIComponent(credentials.pin)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Pilot-PIN': credentials.pin },
            body: JSON.stringify({ ...payload, pin: credentials.pin }),
            keepalive: true
        });
        if (!res.ok) throw new Error(`kv_put_${res.status}`);
        return res.json();
    }

    function kvIndexPayload(credentials) {
        return {
            kind: 'checklist-index-v1',
            syncId: credentials.id,
            lastModified: Date.now(),
            entries: customLists.map(checklist => ({
                id: checklist.id,
                title: checklist.title,
                updatedAt: checklist.updatedAt,
                chapterCount: checklist.chapters.length,
                itemCount: itemCount(checklist),
                published: !!checklist.published,
                communityId: checklist.communityId || ''
            }))
        };
    }

    async function saveKvIndex() {
        const credentials = getCredentials();
        if (!credentials) return 'local';
        await kvPut(kvIndexKey(credentials), kvIndexPayload(credentials), credentials);
        return 'synced';
    }

    async function backupChecklistToKv(checklist) {
        const credentials = getCredentials();
        if (!credentials) return 'local';
        await kvPut(kvChecklistKey(checklist.id, credentials), { kind: 'checklist-v1', checklist, lastModified: Date.now() }, credentials);
        await saveKvIndex();
        return 'synced';
    }

    async function maybePullKvChecklists(force = false) {
        const credentials = getCredentials();
        if (!credentials || kvPullInProgress) return;
        const now = Date.now();
        if (!force && now - lastKvPullAt < 60000) return;
        kvPullInProgress = true;
        lastKvPullAt = now;
        try {
            const index = await kvGet(kvIndexKey(credentials), credentials);
            if (!index || !Array.isArray(index.entries)) return;
            const remoteLists = [];
            for (const entry of index.entries.slice(0, 80)) {
                try {
                    const payload = await kvGet(kvChecklistKey(entry.id, credentials), credentials);
                    const checklist = sanitizeCustomList(payload?.checklist || payload);
                    if (checklist) remoteLists.push(checklist);
                } catch (_) {}
            }
            if (!remoteLists.length) return;
            let changed = false;
            remoteLists.forEach(remote => {
                const idx = customLists.findIndex(local => local.id === remote.id);
                if (idx < 0) {
                    customLists.push(remote);
                    changed = true;
                } else if (Number(remote.updatedAt || 0) > Number(customLists[idx].updatedAt || 0)) {
                    customLists[idx] = remote;
                    changed = true;
                }
            });
            if (changed) {
                saveCustomLists();
                if (state.view === 'list' || state.view === 'manager' || state.view === 'home') render();
                setStatus('Cloud-Listen aktualisiert.', 'good');
            }
        } catch (_) {
            if (state.view === 'list' || state.view === 'manager') setStatus('Cloud-Listen nicht erreichbar.', 'warn');
        } finally {
            kvPullInProgress = false;
        }
    }

    async function maybePullCommunity(force = false) {
        if (communityPullInProgress) return;
        const now = Date.now();
        if (!force && now - lastCommunityPullAt < 90000) return;
        communityPullInProgress = true;
        lastCommunityPullAt = now;
        try {
            const res = await fetch(`${getCommunityApiUrl()}?limit=120&t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`community_${res.status}`);
            const data = await res.json();
            const nextMeta = Array.isArray(data.items) ? data.items.map(sanitizeCommunityMeta).filter(Boolean) : [];
            const known = new Set(nextMeta.map(meta => meta.id));
            Object.keys(communitySubscriptions).forEach(id => {
                if (!known.has(id)) {
                    delete communitySubscriptions[id];
                    delete communityCache[id];
                }
            });
            communityMeta = nextMeta;
            saveCommunityState();
            await refreshSubscribedCommunityContent(false);
            if (state.view === 'manager' || state.view === 'list' || state.view === 'home') render();
        } catch (_) {
            if (state.view === 'manager') setStatus('Community nicht erreichbar.', 'warn');
        } finally {
            communityPullInProgress = false;
        }
    }

    async function ensureCommunityDetail(id) {
        const meta = communityMeta.find(item => item.id === id);
        const cached = communityCache[id];
        if (cached && (!meta || Number(cached.communityUpdatedAt || 0) >= Number(meta.updatedAt || 0))) return cached;
        const res = await fetch(`${getCommunityApiUrl(`/${encodeURIComponent(id)}`)}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`community_detail_${res.status}`);
        const data = await res.json();
        const checklist = communityChecklistFromRecord(data.checklist || data);
        if (!checklist) throw new Error('community_detail_invalid');
        communityCache[id] = checklist;
        saveCommunityState();
        pruneProgress(checklist);
        return checklist;
    }

    async function refreshSubscribedCommunityContent(force = false) {
        const ids = Object.keys(communitySubscriptions).filter(id => communitySubscriptions[id]);
        for (const id of ids) {
            const meta = communityMeta.find(item => item.id === id);
            const cached = communityCache[id];
            if (!force && cached && meta && Number(cached.communityUpdatedAt || 0) >= Number(meta.updatedAt || 0)) continue;
            try { await ensureCommunityDetail(id); } catch (_) {}
        }
    }

    async function setCommunitySubscribed(id, subscribed) {
        if (subscribed) {
            communitySubscriptions[id] = true;
            setStatus('Lade Community-Liste...', '');
            try {
                await ensureCommunityDetail(id);
                setStatus('Community-Liste abonniert.', 'good');
            } catch (_) {
                delete communitySubscriptions[id];
                setStatus('Community-Liste nicht erreichbar.', 'error');
            }
        } else {
            delete communitySubscriptions[id];
            delete communityCache[id];
            setStatus('Community-Liste abbestellt.', 'good');
        }
        saveCommunityState();
        render();
    }

    async function copyCommunity(id) {
        try {
            const checklist = await ensureCommunityDetail(id);
            await copyChecklistToCustom(checklist);
        } catch (_) {
            setStatus('Community-Kopie nicht möglich.', 'error');
        }
    }

    async function copyChecklistToCustom(source) {
        if (!source) return;
        const copy = copyChecklistForEditing(source);
        upsertCustom(copy);
        state.selectedId = copy.id;
        state.activeChapterId = copy.chapters[0]?.id || '';
        state.view = 'viewer';
        state.actionMenuOpen = false;
        persistUiState();
        setStatus('Als eigene Kopie hinzugefügt.', 'good');
        render();
        try { await backupChecklistToKv(copy); } catch (_) {}
    }

    function publicChecklistPayload(checklist) {
        return {
            id: checklist.communityId || checklist.id,
            title: checklist.title,
            updatedAt: checklist.updatedAt,
            chapters: checklist.chapters.map(chapter => ({
                id: chapter.id,
                title: chapter.title,
                items: chapter.items.map(item => ({ id: item.id, text: item.text }))
            }))
        };
    }

    async function communityResponseError(res, fallback) {
        let message = fallback || `community_${res.status}`;
        try {
            const data = await res.json();
            message = data?.error || data?.message || message;
        } catch (_) {
            try {
                const text = await res.text();
                if (text) message = text.slice(0, 180);
            } catch (_) {}
        }
        const error = new Error(message);
        error.status = res.status;
        return error;
    }

    function communityStatusMessage(error) {
        const status = Number(error?.status || 0);
        const message = String(error?.message || '');
        if (status === 401) return 'Community: Pilot-ID/PIN nicht bestätigt.';
        if (status === 403) return 'Community: Nur der Ersteller darf das ändern.';
        if (status === 404 || /not found|unexpected token/i.test(message)) return 'Community-Worker noch nicht aktualisiert.';
        if (status === 503) return 'Community: KV-Binding fehlt im Worker.';
        if (status >= 500) return 'Community-Serverfehler.';
        if (/failed to fetch|network/i.test(message)) return 'Community nicht erreichbar.';
        return 'Community-Änderung fehlgeschlagen.';
    }

    async function publishCommunityChecklist(checklist) {
        const credentials = getCredentials();
        if (!credentials) throw new Error('publish_requires_login');
        const res = await fetch(getCommunityApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Pilot-ID': credentials.id,
                'X-Pilot-PIN': credentials.pin
            },
            body: JSON.stringify({ action: 'publish', checklist: publicChecklistPayload(checklist) })
        });
        if (!res.ok) throw await communityResponseError(res, `publish_${res.status}`);
        const data = await res.json();
        const communityId = data.id || checklist.communityId || checklist.id;
        const idx = customLists.findIndex(item => item.id === checklist.id);
        if (idx >= 0) {
            customLists[idx].published = true;
            customLists[idx].communityId = communityId;
            customLists[idx].communityUpdatedAt = data.updatedAt ? Number(data.updatedAt) : Date.now();
            saveCustomLists();
        }
        await maybePullCommunity(true);
        return data;
    }

    async function unpublishCommunityChecklist(checklist) {
        const credentials = getCredentials();
        if (!credentials || !(checklist.communityId || checklist.id)) throw new Error('unpublish_requires_login');
        const id = checklist.communityId || checklist.id;
        const res = await fetch(getCommunityApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Pilot-ID': credentials.id,
                'X-Pilot-PIN': credentials.pin
            },
            body: JSON.stringify({ action: 'unpublish', id })
        });
        if (!res.ok) throw await communityResponseError(res, `unpublish_${res.status}`);
        delete communitySubscriptions[id];
        delete communityCache[id];
        communityMeta = communityMeta.filter(meta => meta.id !== id);
        saveCommunityState();
        return res.json();
    }

    async function setCustomPublished(id, published) {
        const checklist = getChecklist(id);
        if (!checklist || checklist.source !== 'custom') return;
        if (published && !getCredentials()) {
            setStatus('Veröffentlichen braucht Pilot-ID/PIN Login.', 'error');
            render();
            return;
        }
        const idx = customLists.findIndex(item => item.id === id);
        if (idx < 0) return;
        const previous = clone(customLists[idx]);
        customLists[idx].published = !!published;
        if (published && !customLists[idx].communityId) customLists[idx].communityId = customLists[idx].id;
        customLists[idx].updatedAt = Date.now();
        saveCustomLists();
        try {
            if (published) {
                await publishCommunityChecklist(customLists[idx]);
                setStatus('Veröffentlicht.', 'good');
            } else {
                await unpublishCommunityChecklist(previous);
                customLists[idx].published = false;
                saveCustomLists();
                setStatus('Veröffentlichung entfernt.', 'good');
            }
            await backupChecklistToKv(customLists[idx]);
        } catch (error) {
            customLists[idx] = previous;
            saveCustomLists();
            setStatus(communityStatusMessage(error), 'error');
        }
        render();
    }

    function handleClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button || !bodyEl.contains(button)) return;
        const action = button.dataset.action;
        const id = button.dataset.id || '';
        const chapterIndex = Number(button.dataset.chapterIndex);
        const itemIndex = Number(button.dataset.itemIndex);
        const dir = Number(button.dataset.dir || 0);
        if (action === 'home') {
            abortOtherToolRequests('');
            state.view = 'home';
            state.editorDraft = null;
            state.actionMenuOpen = false;
            state.nearestMenuKey = '';
            state.placeInfoAirport = null;
            setStatus('');
            render();
        } else if (action === 'open-tool') {
            openTool(button.dataset.tool || '', false);
        } else if (action === 'refresh-tool') {
            openTool(button.dataset.tool || state.view, true);
        } else if (action === 'open-list') {
            abortOtherToolRequests('');
            openList();
        } else if (action === 'open-checklist') {
            openChecklist(id).catch(() => setStatus('Checkliste nicht erreichbar.', 'error'));
        } else if (action === 'manager') {
            state.view = 'manager';
            state.actionMenuOpen = false;
            setStatus('');
            render();
        } else if (action === 'refresh-community') {
            maybePullCommunity(true);
        } else if (action === 'move-checklist-order') {
            if (moveChecklistOrder(id, dir)) {
                setStatus('Reihenfolge gespeichert.', 'good');
                render();
            }
        } else if (action === 'tab') {
            state.activeChapterId = id;
            persistUiState();
            render();
        } else if (action === 'new') {
            openNewEditor();
        } else if (action === 'edit') {
            openEditEditor(id);
        } else if (action === 'copy') {
            copyChecklistToCustom(getChecklist(id));
        } else if (action === 'copy-community') {
            copyCommunity(id);
        } else if (action === 'delete') {
            deleteChecklist(id);
        } else if (action === 'reset-progress') {
            resetProgress(id);
        } else if (action === 'export') {
            exportChecklist(id);
        } else if (action === 'import-open') {
            state.view = 'import';
            state.actionMenuOpen = false;
            setStatus('');
            render();
        } else if (action === 'import-run') {
            importChecklist();
        } else if (action === 'toggle-actions') {
            state.actionMenuOpen = !state.actionMenuOpen;
            render();
        } else if (action === 'unsubscribe-community') {
            setCommunitySubscribed(id, false);
        } else if (action === 'cancel-editor') {
            if (state.selectedId) openChecklist(state.selectedId);
            else openList();
        } else if (action === 'save-editor') {
            saveEditorDraft();
        } else if (action === 'add-chapter') {
            addChapter();
        } else if (action === 'move-chapter') {
            if (moveInArray(state.editorDraft?.chapters, chapterIndex, dir)) render();
        } else if (action === 'duplicate-chapter') {
            duplicateChapter(chapterIndex);
        } else if (action === 'delete-chapter') {
            deleteChapter(chapterIndex);
        } else if (action === 'add-item') {
            addItem(chapterIndex);
        } else if (action === 'move-item') {
            const items = state.editorDraft?.chapters?.[chapterIndex]?.items;
            if (moveInArray(items, itemIndex, dir)) render();
        } else if (action === 'duplicate-item') {
            duplicateItem(chapterIndex, itemIndex);
        } else if (action === 'delete-item') {
            deleteItem(chapterIndex, itemIndex);
        } else if (action === 'nearest-menu') {
            state.nearestMenuKey = state.nearestMenuKey === button.dataset.key ? '' : (button.dataset.key || '');
            render();
        } else if (action === 'radio-airport-menu') {
            state.radioAirportMenuKey = state.radioAirportMenuKey === button.dataset.key ? '' : (button.dataset.key || '');
            render();
        } else if (action === 'nearest-direct') {
            const apt = decodeAirportDataset(button);
            if (!apt) return;
            setStatus(`Direct To ${apt.icao}...`);
            Promise.resolve()
                .then(() => {
                    if (typeof applyAirportDirectTo === 'function') {
                        const forceGpsStart = typeof isGpsLive === 'function' ? isGpsLive() : !!getLiveAircraftPosition();
                        return applyAirportDirectTo(apt, { forceGpsStart });
                    }
                    if (typeof window.confirmAirportDirectTo === 'function') {
                        return window.confirmAirportDirectTo(apt.icao, apt.lat, apt.lon, encodeURIComponent(apt.name || apt.icao));
                    }
                    throw new Error('direct_to_unavailable');
                })
                .then(ok => setStatus(ok === false ? 'Direct To abgebrochen.' : `Direct To ${apt.icao} aktiv.`, ok === false ? 'warn' : 'good'))
                .catch(() => setStatus('Direct To nicht verfügbar.', 'error'));
        } else if (action === 'airport-info') {
            const apt = decodeAirportDataset(button);
            if (!apt) return;
            state.placeInfoAirport = apt;
            state.placeInfoReturn = (state.view === 'nearest' || state.view === 'radio') ? state.view : 'place';
            state.view = 'airport-info';
            state.nearestMenuKey = '';
            state.radioAirportMenuKey = '';
            setStatus('');
            if (typeof fetchAirportFreq === 'function' && apt.icao && !getFreqLines(apt.icao).length) {
                fetchAirportFreq(apt.icao, null, null).catch(() => null);
            }
            if (typeof fetchRunwayDetails === 'function' && apt.icao && !getRunwayText(apt.icao) && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
                const rid = `routeToolHiddenRwy_${apt.icao}`;
                let hidden = document.getElementById(rid);
                if (!hidden) {
                    hidden = document.createElement('div');
                    hidden.id = rid;
                    hidden.style.display = 'none';
                    document.body.appendChild(hidden);
                }
                fetchRunwayDetails(apt.lat, apt.lon, rid, apt.icao).catch(() => null);
            }
            render();
            setTimeout(() => { if (state.view === 'airport-info') render(); }, 900);
        }
    }

    function handleInput(event) {
        const field = event.target.dataset.field;
        const draft = state.editorDraft;
        if (!field || !draft) return;
        if (field === 'title') draft.title = event.target.value;
        if (field === 'chapter-title') {
            const chapter = draft.chapters[Number(event.target.dataset.chapterIndex)];
            if (chapter) chapter.title = event.target.value;
        }
        if (field === 'item-text') {
            const chapter = draft.chapters[Number(event.target.dataset.chapterIndex)];
            const item = chapter?.items?.[Number(event.target.dataset.itemIndex)];
            if (item) item.text = event.target.value;
        }
    }

    function handleChange(event) {
        const action = event.target.dataset.action;
        const field = event.target.dataset.field;
        if (action === 'toggle-item') {
            toggleItem(event.target.dataset.itemId, event.target.checked);
        } else if (action === 'toggle-visible') {
            setChecklistVisible(event.target.dataset.id, event.target.checked);
            render();
        } else if (action === 'toggle-community-sub') {
            setCommunitySubscribed(event.target.dataset.id, event.target.checked);
        } else if (action === 'toggle-publish-viewer') {
            setCustomPublished(event.target.dataset.id, event.target.checked);
        } else if (field === 'published' && state.editorDraft) {
            state.editorDraft.published = event.target.checked;
        }
    }

    function initDrawerEvents() {
        if (!drawerEl) return;
        ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'].forEach(type => {
            drawerEl.addEventListener(type, event => event.stopPropagation(), { passive: true });
        });
        bodyEl.addEventListener('click', handleClick);
        bodyEl.addEventListener('input', handleInput);
        bodyEl.addEventListener('change', handleChange);
    }

    function init() {
        drawerEl = document.getElementById('mapSideDrawer');
        handleEl = document.getElementById('mapSideDrawerHandle');
        bodyEl = document.getElementById('checklistDrawerBody');
        titleEl = document.getElementById('checklistDrawerTitle');
        statusEl = document.getElementById('checklistDrawerStatus');
        if (!drawerEl || !bodyEl) return;
        loadStateFromStorage();
        initDrawerEvents();
        render();
        setTimeout(() => {
            maybePullKvChecklists(true);
            maybePullCommunity(true);
        }, 1400);
        setInterval(() => {
            if (document.visibilityState === 'visible') maybePullCommunity(false);
        }, 180000);
    }

    window.gaChecklistToggleDrawer = function(force) {
        if (!drawerEl) return;
        const nextOpen = typeof force === 'boolean' ? force : !isDrawerOpen();
        setDrawerOpen(nextOpen);
        if (nextOpen) {
            if (state.view === 'list' || state.view === 'manager') maybePullCommunity(false);
            if (state.view === 'list') maybePullKvChecklists();
            if (state.view === 'weather') ensureWeatherTool(false);
            if (state.view === 'radio') ensureRadioTool(false);
            if (state.view === 'place') ensurePlaceTool(false);
            if (state.view === 'nearest') ensureNearestTool(false);
        }
    };

    window.gaChecklistCloseDrawer = function() {
        setDrawerOpen(false);
    };

    window.gaChecklistPullKv = function() {
        return maybePullKvChecklists(true);
    };

    window.gaChecklistPullCommunity = function() {
        return maybePullCommunity(true);
    };

    document.addEventListener('DOMContentLoaded', init);
})();
