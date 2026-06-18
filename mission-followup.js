(function() {
    'use strict';

    const STORAGE_KEY = 'ga_followup_requests_v1';
    const LAST_LANDING_STORAGE_KEY = 'ga_followup_last_landing_ref_v1';
    const SCHEMA = 'ga.followup.request.v1';
    const EXPIRE_DAYS = 14;
    const TOMBSTONE_DAYS = 14;
    const MAX_PENDING = 20;
    const MAX_TOTAL_FOR_SYNC = 36;
    const STATUS_RANK = { pending: 1, expired: 2, accepted: 3, dismissed: 3 };
    const BUSH_RECON_OUTCOME_SCHEMA = 'ga.bushReconOutcome.v1';
    const BUSH_RECON_OUTCOME_TYPES = new Set(['all_clear', 'monitor_only', 'minor_service', 'technician_needed']);
    const MAX_CHAIN_DEPTH = 2;
    const SOURCE_MAP = {
        bush_charter_strip: {
            followUpKind: 'bush_pickup_strip',
            sourceLabel: 'Bush Charter',
            followUpLabel: 'Bush Pickup'
        },
        bush_supply_strip: {
            followUpKind: 'bush_pickup_cargo',
            sourceLabel: 'Bush Supply Run',
            followUpLabel: 'Bush Cargo Pickup'
        },
        bush_scenic_hopper: {
            followUpKind: 'bush_pickup_strip',
            sourceLabel: 'Bush Adventure',
            followUpLabel: 'Bush Pickup'
        },
        bush_recon_return: {
            followUpKind: 'bush_supply_strip',
            sourceLabel: 'Bush Recon',
            followUpLabel: 'Bush Service Run'
        },
        apt_charter: {
            followUpKind: 'apt_charter_pickup',
            sourceLabel: 'APT Charter',
            followUpLabel: 'Charter Pickup'
        }
    };
    const PASSENGER_PICKUP_SOURCE_KINDS = new Set(['bush_charter_strip', 'bush_scenic_hopper', 'apt_charter']);

    let initialized = false;
    const acceptingIds = new Set();

    function nowMs() { return Date.now(); }

    function safeJsonParse(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    function readStoredRequests() {
        const raw = (() => {
            try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
        })();
        const parsed = raw ? safeJsonParse(raw, []) : [];
        return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
    }

    function stableHash(text = '') {
        let h = 2166136261;
        const s = String(text || '');
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(36);
    }

    function cleanText(value = '', max = 600) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    }

    function displayText(value = '') {
        return cleanText(value, 4000)
            .replace(/\bfuer\b/g, 'für')
            .replace(/\bFuer\b/g, 'Für')
            .replace(/\bzurueck\b/g, 'zurück')
            .replace(/\bZurueck\b/g, 'Zurück')
            .replace(/\bRueck/g, 'Rück')
            .replace(/\brueck/g, 'rück')
            .replace(/\bAusruestung\b/g, 'Ausrüstung')
            .replace(/\bausruestung\b/g, 'ausrüstung')
            .replace(/\bdraussen\b/g, 'draußen')
            .replace(/\bDraussen\b/g, 'Draußen')
            .replace(/\bpersoenlich/g, 'persönlich')
            .replace(/\bPersoenlich/g, 'Persönlich')
            .replace(/\bgepaeck\b/g, 'gepäck')
            .replace(/\bGepaeck\b/g, 'Gepäck')
            .replace(/\bUebergabe\b/g, 'Übergabe')
            .replace(/\bueber/g, 'über')
            .replace(/\bUeber/g, 'Über')
            .replace(/\bnaechst/g, 'nächst')
            .replace(/\bNaechst/g, 'Nächst')
            .replace(/\bMassband\b/g, 'Maßband');
    }

    function passengerPronoun(passenger = null) {
        const gender = String(passenger?.gender || '').toLowerCase();
        if (gender === 'female') return 'sie';
        if (gender === 'male') return 'ihn';
        return passenger?.name ? String(passenger.name).trim() : 'die Person';
    }

    function getStatus(req) {
        const s = String(req?.status || 'pending').toLowerCase();
        return ['pending', 'accepted', 'dismissed', 'expired'].includes(s) ? s : 'pending';
    }

    function isTerminalStatus(status) {
        return status === 'accepted' || status === 'dismissed' || status === 'expired';
    }

    function localMorningAfterDays(days = 1, hour = 8) {
        const d = new Date();
        d.setDate(d.getDate() + Math.max(1, Math.min(7, Math.round(Number(days || 1)))));
        d.setHours(hour, 0, 0, 0);
        return d.getTime();
    }

    function nextLocalMorningAt(hour = 8) {
        return localMorningAfterDays(1, hour);
    }

    function addDays(ts, days) {
        return Number(ts || 0) + Math.max(0, Number(days || 0)) * 24 * 60 * 60 * 1000;
    }

    function formatLocal(ts) {
        const n = Number(ts || 0);
        if (!Number.isFinite(n) || n <= 0) return '-';
        try {
            return new Date(n).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (_) {
            return '-';
        }
    }

    function clampStayDays(value = null) {
        const n = Math.round(Number(value || 0));
        return Number.isFinite(n) && n >= 1 && n <= 7 ? n : 0;
    }

    function randomStayDays() {
        return Math.floor(Math.random() * 7) + 1;
    }

    function stayDurationText(days = null, sourceKind = '') {
        const n = clampStayDays(days);
        if (!n) return '';
        const source = String(sourceKind || '').toLowerCase();
        if (source === 'bush_scenic_hopper') {
            if (n === 1) return 'eine Nacht draußen';
            if (n === 2) return 'zwei Tage draußen';
            return `${n} Tage draußen`;
        }
        if (source === 'bush_supply_strip') {
            if (n === 1) return 'bis morgen';
            return `in ungefähr ${n} Tagen`;
        }
        if (source === 'bush_recon_return') {
            if (n === 1) return 'bis zum nächsten Morgen für Auswertung und Materialplanung';
            return `ungefähr ${n} Tage für Auswertung und Materialplanung`;
        }
        if (source === 'apt_charter') {
            if (n === 1) return 'bis morgen';
            if (n === 2) return 'für zwei Tage';
            return `für ungefähr ${n} Tage`;
        }
        if (n === 1) return 'bis morgen';
        return `ungefähr ${n} Tage`;
    }

    function stayPeriodText(days = null, sourceKind = '') {
        const n = clampStayDays(days);
        if (!n) return '';
        const source = String(sourceKind || '').toLowerCase();
        if (source === 'bush_scenic_hopper') {
            if (n === 1) return 'während einer Nacht draußen';
            if (n === 2) return 'über zwei Tage draußen';
            return `über ungefähr ${n} Tage draußen`;
        }
        if (source === 'bush_supply_strip') {
            if (n === 1) return 'bis zum nächsten Morgen';
            return `über ungefähr ${n} Tage`;
        }
        if (source === 'bush_recon_return') {
            if (n === 1) return 'bis zum nächsten Morgen nach dem Recon';
            return `über ungefähr ${n} Tage nach dem Recon`;
        }
        if (source === 'apt_charter') {
            if (n === 1) return 'bis zum nächsten Morgen';
            if (n === 2) return 'über zwei Tage';
            return `über ungefähr ${n} Tage`;
        }
        if (n === 1) return 'bis zum nächsten Morgen';
        return `für ungefähr ${n} Tage`;
    }

    function buildFollowUpDeboardingHint(sourceKind = '', stayDays = null, passenger = null) {
        const source = String(sourceKind || '').toLowerCase();
        const text = stayDurationText(stayDays, source);
        const name = cleanText(passenger?.name || '', 80);
        if (!text) return '';
        if (source === 'apt_charter') {
            return `${name || 'Der Chartergast'} bleibt voraussichtlich ${text} am Zielplatz und kann beim Abschied erwähnen, dass ein späterer Rückflug gut passen würde.`;
        }
        if (source === 'bush_supply_strip') {
            return `Die Crew sortiert die Lieferung ${text}; danach sollten leere Kisten, Belege und Rückfracht abholbereit sein.`;
        }
        if (source === 'bush_scenic_hopper') {
            return `${name || 'Der Gast'} plant ${text} zu bleiben und kann beim Abschied locker erwähnen, dass eine Rückholung danach willkommen wäre.`;
        }
        if (source === 'bush_recon_return') {
            const waitText = stayPeriodText(stayDays, source).replace(/\s+nach dem Recon$/i, '');
            return `Nach dem Rückbericht wertet die Basis den Recon ${waitText || text} aus; falls dabei Nacharbeit am Zielstrip entsteht, meldet sie sich mit einem passenden Folgeauftrag.`;
        }
        return `${name || 'Der Gast'} bleibt voraussichtlich ${text} am Zielstrip und kann beim Abschied erwähnen, dass eine spätere Rückholung gut passen würde.`;
    }

    function buildTemporalContext(sourceKind = '', options = {}) {
        const source = String(sourceKind || '').toLowerCase();
        if (!SOURCE_MAP[source]) return null;
        const stayDays = clampStayDays(options.stayDays) || randomStayDays();
        const eligibleAt = Number(options.eligibleAt || 0) > 0
            ? Number(options.eligibleAt)
            : localMorningAfterDays(stayDays, 8);
        const stayText = stayDurationText(stayDays, source);
        return {
            schema: 'ga.missionTemporalContext.v1',
            kind: 'followup_stay',
            sourceKind: source,
            stayDays,
            stayText,
            returnWindowText: formatLocal(eligibleAt),
            followUpEligibleAt: eligibleAt,
            deboardingHint: cleanText(options.deboardingHint || buildFollowUpDeboardingHint(source, stayDays, options.passenger || null), 360),
            createdAt: Number(options.createdAt || nowMs())
        };
    }

    function missionTemporalContext(md = null, sourceKind = '') {
        const candidate = md && typeof md === 'object' ? md : {};
        const existing = candidate.missionTemporalContext
            || candidate.followUpProspect?.temporalContext
            || candidate.followUpProspect?.missionTemporalContext
            || null;
        if (existing && typeof existing === 'object') {
            const source = String(existing.sourceKind || sourceKind || getProfileId(candidate) || '').toLowerCase();
            const normalized = buildTemporalContext(source, {
                stayDays: existing.stayDays,
                eligibleAt: existing.followUpEligibleAt || existing.eligibleAt,
                deboardingHint: existing.deboardingHint,
                createdAt: existing.createdAt,
                passenger: candidate.passenger || candidate.missionContract?.passenger || null
            });
            if (normalized) return { ...existing, ...normalized };
        }
        const source = String(sourceKind || getProfileId(candidate) || '').toLowerCase();
        return buildTemporalContext(source, {
            passenger: candidate.passenger || candidate.missionContract?.passenger || null
        });
    }

    function buildProspectForMission(candidate = null, options = {}) {
        const md = getMissionDataFromCandidate(candidate);
        if (!md || typeof md !== 'object') return null;
        if (md.followUpContinuation || md.followUpRequestId) return null;
        const sourceKind = String(options.sourceKind || getProfileId(md) || '').toLowerCase();
        if (sourceKind === 'inspection_infra' && typeof window.missionInfraBuildProspectForMission === 'function') {
            try {
                const infraProspect = window.missionInfraBuildProspectForMission(md);
                if (infraProspect) return infraProspect;
            } catch (err) {
                console.warn('[FollowUp] Infra prospect failed:', err?.message || err);
            }
        }
        const cfg = SOURCE_MAP[sourceKind];
        if (!cfg) return null;
        const passenger = PASSENGER_PICKUP_SOURCE_KINDS.has(sourceKind) ? extractPassenger(md, sourceKind) : null;
        const temporalContext = missionTemporalContext(md, sourceKind);
        if (!temporalContext) return null;
        return {
            schema: 'ga.followup.prospect.v1',
            sourceKind,
            followUpKind: cfg.followUpKind,
            sourceLabel: cfg.sourceLabel,
            followUpLabel: cfg.followUpLabel,
            temporalContext,
            stayDays: temporalContext.stayDays,
            stayText: temporalContext.stayText,
            eligibleAt: temporalContext.followUpEligibleAt,
            deboardingHint: temporalContext.deboardingHint,
            createdAt: temporalContext.createdAt,
            passenger
        };
    }

    function statusPriority(req) {
        return STATUS_RANK[getStatus(req)] || 0;
    }

    function normalizeRef(ref = null) {
        if (!ref || typeof ref !== 'object') return null;
        const lat = Number(ref.lat);
        const lon = Number(ref.lon ?? ref.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const icao = String(ref.icao || ref.id || '').trim().toUpperCase();
        const kindRaw = String(ref.kind || '').trim().toLowerCase();
        const kind = ['airport', 'poi', 'area', 'route_point'].includes(kindRaw) ? kindRaw : 'airport';
        const name = cleanText(ref.name || ref.n || icao || 'Remote Strip', 120);
        return {
            kind,
            icao,
            name,
            lat,
            lon,
            elevation: Number.isFinite(Number(ref.elevation)) ? Math.round(Number(ref.elevation)) : null,
            category: cleanText(ref.category || ref.poiCategory || '', 40),
            poiCategory: cleanText(ref.poiCategory || ref.category || '', 40),
            isRemoteStrip: !!ref.isRemoteStrip
        };
    }

    function airportFromRef(ref = null) {
        const r = normalizeRef(ref);
        if (!r) return null;
        return {
            icao: r.icao || 'BUSH',
            n: r.name || r.icao || 'Remote Strip',
            name: r.name || r.icao || 'Remote Strip',
            lat: r.lat,
            lon: r.lon,
            elevation: r.elevation,
            isRemoteStrip: r.isRemoteStrip,
            bushScore: r.isRemoteStrip ? 6 : 4
        };
    }

    function refsSameAirport(a = null, b = null) {
        const ra = normalizeRef(a);
        const rb = normalizeRef(b);
        if (!ra || !rb) return false;
        if (ra.icao && rb.icao) return ra.icao === rb.icao;
        const dLat = Math.abs(Number(ra.lat) - Number(rb.lat));
        const dLon = Math.abs(Number(ra.lon) - Number(rb.lon));
        return dLat <= 0.0025 && dLon <= 0.0025;
    }

    function getLastLandingRef() {
        const raw = (() => {
            try { return localStorage.getItem(LAST_LANDING_STORAGE_KEY); } catch (_) { return null; }
        })();
        const parsed = raw ? safeJsonParse(raw, null) : null;
        return normalizeRef(parsed?.ref || parsed || null);
    }

    function rememberLastLandingRef(ref = null, meta = {}) {
        const normalized = normalizeRef(ref);
        if (!normalized?.icao) return false;
        try {
            localStorage.setItem(LAST_LANDING_STORAGE_KEY, JSON.stringify({
                ref: normalized,
                source: cleanText(meta.source || 'mission-complete', 80),
                missionId: cleanText(meta.missionId || '', 120),
                updatedAt: nowMs()
            }));
        } catch (_) {
            return false;
        }
        if (typeof window.vpRefreshWeatherDebugReport === 'function') {
            try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
        }
        return true;
    }

    function normalizeAirportLikeToRef(airport = null, fallbackIcao = '') {
        if (!airport || typeof airport !== 'object') return null;
        return normalizeRef({
            icao: airport.icao || fallbackIcao,
            name: airport.n || airport.name || airport.icao || fallbackIcao,
            lat: airport.lat,
            lon: airport.lon ?? airport.lng,
            elevation: airport.elevation,
            isRemoteStrip: airport.isRemoteStrip
        });
    }

    async function resolveAirportRefByIcao(input = '', knownRefs = []) {
        const icao = String(input || '').trim().toUpperCase();
        if (!icao) return null;
        const known = knownRefs
            .map(ref => normalizeRef(ref))
            .find(ref => ref?.icao && ref.icao === icao);
        if (known) return known;
        const loader = (typeof window.getAirportData === 'function')
            ? window.getAirportData
            : (typeof getAirportData === 'function' ? getAirportData : null);
        if (typeof loader !== 'function') return null;
        try {
            const apt = await loader(icao);
            return normalizeAirportLikeToRef(apt, icao);
        } catch (_) {
            return null;
        }
    }

    function buildAcceptance(req = null, startRef = null) {
        const homeRef = normalizeRef(req?.route?.homeRef);
        const targetRef = normalizeRef(req?.route?.targetRef);
        const resolvedStartRef = normalizeRef(startRef);
        if (!req || !homeRef?.icao || !targetRef?.icao || !resolvedStartRef?.icao) return null;
        const followUpKind = String(req.followUpKind || '').toLowerCase();
        const isPoiFollowup = req?.poiFollowUp === true || targetRef.kind === 'poi' || /^infra_/.test(followUpKind);
        const isServiceRun = followUpKind === 'bush_supply_strip';
        const isOutboundRun = isServiceRun || followUpKind === 'bush_charter_strip';
        const sameHome = refsSameAirport(resolvedStartRef, homeRef);
        const sameTarget = refsSameAirport(resolvedStartRef, targetRef);
        if (isPoiFollowup && sameTarget) return null;
        if (isOutboundRun && sameTarget && !sameHome) return null;
        const onsite = !isOutboundRun && sameTarget && !sameHome;
        const mode = onsite
            ? 'onsite_to_home'
            : (sameHome ? 'pickup_from_home' : 'pickup_from_third_place');
        const dispatchProfileId = isPoiFollowup
            ? String(req.followUpProfileId || (followUpKind === 'infra_recheck' ? 'inspection_infra' : 'mapping_survey')).toLowerCase()
            : (onsite
            ? (followUpKind === 'bush_pickup_cargo'
                ? 'bush_supply_strip'
                : (followUpKind === 'apt_charter_pickup' ? 'apt_charter' : 'bush_charter_strip'))
            : followUpKind);
        return {
            schema: 'ga.followup.acceptance.v1',
            mode,
            dispatchProfileId,
            originalFollowUpKind: followUpKind,
            startRef: resolvedStartRef,
            targetRef,
            returnHomeRef: homeRef,
            createdAt: nowMs()
        };
    }

    function acceptanceForRequest(req = null, context = {}) {
        const existing = (req?.acceptance && typeof req.acceptance === 'object') ? req.acceptance : null;
        if (existing?.mode && existing?.startRef && existing?.targetRef && existing?.returnHomeRef) {
            const followUpKind = String(req?.followUpKind || '').toLowerCase();
            if (
                (followUpKind === 'bush_supply_strip' || followUpKind === 'bush_charter_strip')
                && refsSameAirport(existing.startRef, existing.targetRef)
                && !refsSameAirport(existing.startRef, existing.returnHomeRef)
            ) return null;
            return existing;
        }
        const fallbackStart = normalizeAirportLikeToRef(context.start || null)
            || normalizeRef(req?.route?.homeRef);
        return buildAcceptance(req, fallbackStart) || null;
    }

    function acceptanceDestRef(acceptance = null) {
        if (!acceptance || typeof acceptance !== 'object') return null;
        return String(acceptance.mode || '') === 'onsite_to_home'
            ? normalizeRef(acceptance.returnHomeRef)
            : normalizeRef(acceptance.targetRef);
    }

    function pickerValueForProfile(profileId = '', req = null) {
        if (req && typeof window.missionInfraPickerValueForFollowup === 'function') {
            try {
                const poiValue = window.missionInfraPickerValueForFollowup(req);
                if (poiValue) return poiValue;
            } catch (_) {}
        }
        const id = String(profileId || '').trim().toLowerCase();
        if (!id) return '';
        if (req?.route?.targetRef?.kind === 'poi' || /^infra_/.test(String(req?.followUpKind || ''))) {
            const cat = cleanText(req?.followUpCategory || req?.route?.targetRef?.category || 'infrastructure', 40).toLowerCase() || 'infrastructure';
            return `poi:${cat}+${id}`;
        }
        if (id === 'apt_charter' || id === 'apt_charter_pickup') return 'apt:charter';
        return `bush:all+${id}`;
    }

    function followupPlaceLabel(ref = null, fallback = 'Platz') {
        const r = normalizeRef(ref);
        if (!r) return fallback;
        const icao = String(r.icao || '').trim().toUpperCase();
        const name = String(r.name || icao || fallback).trim();
        if (icao && name && name !== icao) return `${name} (${icao})`;
        return icao || name || fallback;
    }

    function ensureStartDialog() {
        let overlay = document.getElementById('followupStartDialog');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'followupStartDialog';
        overlay.className = 'followup-start-dialog';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="followup-start-card" role="dialog" aria-modal="true" aria-labelledby="followupStartTitle">
                <div class="followup-start-kicker">Folgemission erstellen</div>
                <h2 id="followupStartTitle">Wo bist du gerade?</h2>
                <p class="followup-start-summary" data-role="summary"></p>
                <div class="followup-start-options" data-role="options"></div>
                <div class="followup-start-custom" data-role="custom" hidden>
                    <label for="followupStartIcao">Anderer Startplatz</label>
                    <input id="followupStartIcao" type="text" inputmode="latin" autocomplete="off" maxlength="8" spellcheck="false">
                    <div class="followup-start-error" data-role="error" hidden></div>
                </div>
                <div class="followup-start-actions">
                    <button type="button" class="followup-start-cancel" data-action="cancel">Abbrechen</button>
                    <button type="button" class="followup-start-confirm" data-action="confirm">Mission erstellen</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function promptAcceptanceStartRef(req = null) {
        const homeRef = normalizeRef(req?.route?.homeRef);
        const targetRef = normalizeRef(req?.route?.targetRef);
        const lastRef = getLastLandingRef();
        const followUpKind = String(req?.followUpKind || '').toLowerCase();
        const isServiceRun = followUpKind === 'bush_supply_strip';
        const isOutboundRun = isServiceRun || followUpKind === 'bush_charter_strip';
        const isAptCharterPickup = followUpKind === 'apt_charter_pickup';
        const isPoiFollowup = req?.poiFollowUp === true || targetRef?.kind === 'poi' || /^infra_/.test(followUpKind);
        const targetPlaceLabel = isPoiFollowup ? 'POI' : (isAptCharterPickup ? 'Zielplatz' : 'Zielstrip');
        const targetIsStartOption = !isPoiFollowup && !isOutboundRun;
        const defaultRef = lastRef?.icao ? lastRef : homeRef;
        const defaultIcao = String(defaultRef?.icao || homeRef?.icao || '').trim().toUpperCase();
        const overlay = ensureStartDialog();
        const summary = overlay.querySelector('[data-role="summary"]');
        const options = overlay.querySelector('[data-role="options"]');
        const custom = overlay.querySelector('[data-role="custom"]');
        const input = overlay.querySelector('#followupStartIcao');
        const error = overlay.querySelector('[data-role="error"]');
        const confirmBtn = overlay.querySelector('[data-action="confirm"]');
        const cancelBtn = overlay.querySelector('[data-action="cancel"]');
        let selected = 'home';
        const optionDefs = [
            {
                id: 'home',
                title: isServiceRun ? 'Servicepaket an der Basis laden' : (isOutboundRun ? 'Person an der Basis aufnehmen' : 'Wieder an der Basis'),
                text: followupPlaceLabel(homeRef, 'Ursprungsbasis'),
                ref: homeRef
            },
            targetIsStartOption ? {
                id: 'target',
                title: isAptCharterPickup ? 'Noch am Zielplatz' : 'Noch am Zielstrip',
                text: followupPlaceLabel(targetRef, targetPlaceLabel),
                ref: targetRef
            } : null,
            {
                id: 'other',
                title: 'An einem anderen Platz',
                text: defaultIcao ? `Vorschlag: ${followupPlaceLabel(defaultRef, defaultIcao)}` : 'ICAO eingeben',
                ref: null
            }
        ].filter(Boolean);

        const defaultMatchesTarget = refsSameAirport(defaultRef, targetRef);
        const defaultMatchesHome = refsSameAirport(defaultRef, homeRef);
        selected = (targetIsStartOption && defaultMatchesTarget) ? 'target' : (defaultMatchesHome ? 'home' : 'other');
        if (summary) {
            summary.textContent = isServiceRun
                    ? `Serviceziel: ${followupPlaceLabel(targetRef, 'Zielstrip')} · Materialbasis: ${followupPlaceLabel(homeRef, 'Basis')}`
                    : (isOutboundRun || isPoiFollowup
                        ? `Einsatzort: ${followupPlaceLabel(targetRef, targetPlaceLabel)} · Ausgangsbasis: ${followupPlaceLabel(homeRef, 'Basis')}`
                    : `Rückkehrbasis: ${followupPlaceLabel(homeRef, 'Basis')} · Anfrageort: ${followupPlaceLabel(targetRef, targetPlaceLabel)}`);
        }
        if (options) {
            options.innerHTML = '';
            optionDefs.forEach(def => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'followup-start-option';
                btn.dataset.option = def.id;
                btn.innerHTML = `<span>${def.title}</span><small>${def.text}</small>`;
                btn.addEventListener('click', () => {
                    selected = def.id;
                    renderSelection();
                });
                options.appendChild(btn);
            });
        }
        if (input) input.value = defaultIcao || '';
        if (error) {
            error.hidden = true;
            error.textContent = '';
        }

        const renderSelection = () => {
            overlay.querySelectorAll('.followup-start-option').forEach(btn => {
                btn.classList.toggle('is-selected', btn.dataset.option === selected);
            });
            if (custom) custom.hidden = selected !== 'other';
            if (selected === 'other' && input) {
                setTimeout(() => {
                    try { input.focus(); input.select(); } catch (_) {}
                }, 0);
            }
            if (error) {
                error.hidden = true;
                error.textContent = '';
            }
        };
        renderSelection();

        return new Promise(resolve => {
            let done = false;
            const cleanup = () => {
                overlay.hidden = true;
                confirmBtn?.removeEventListener('click', onConfirm);
                cancelBtn?.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
                overlay.removeEventListener('keydown', onKeyDown);
            };
            const finish = (value) => {
                if (done) return;
                done = true;
                cleanup();
                resolve(value);
            };
            const onCancel = () => finish(null);
            const onOverlayClick = (ev) => {
                if (ev.target === overlay) finish(null);
            };
            const onKeyDown = (ev) => {
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    finish(null);
                }
                if (ev.key === 'Enter' && (selected !== 'other' || ev.target === input)) {
                    ev.preventDefault();
                    onConfirm();
                }
            };
            const onConfirm = async () => {
                const choice = optionDefs.find(def => def.id === selected) || optionDefs[0];
                if (choice.ref) {
                    finish(choice.ref);
                    return;
                }
                const raw = String(input?.value || '').trim().toUpperCase();
                const ref = await resolveAirportRefByIcao(raw, [homeRef, targetRef, lastRef]);
                if (!ref?.icao) {
                    if (error) {
                        error.textContent = 'Startplatz unbekannt. Bitte eine gültige ICAO eingeben.';
                        error.hidden = false;
                    } else {
                        alert('Startplatz unbekannt. Bitte eine gültige ICAO eingeben.');
                    }
                    return;
                }
                if ((isOutboundRun || isPoiFollowup) && refsSameAirport(ref, targetRef)) {
                    if (error) {
                        error.textContent = isPoiFollowup
                            ? 'Der POI ist kein Startplatz. Bitte Basis oder einen anderen Flugplatz wählen.'
                            : (isServiceRun
                            ? 'Der Service Run bringt Material zum Zielstrip. Bitte Basis oder einen anderen Startplatz wählen.'
                            : 'Dieser Anschlussflug bringt die Person zum Zielstrip. Bitte Basis oder einen anderen Startplatz wählen.');
                        error.hidden = false;
                    } else {
                        alert(isPoiFollowup
                            ? 'Der POI ist kein Startplatz. Bitte Basis oder einen anderen Flugplatz wählen.'
                            : (isServiceRun
                            ? 'Der Service Run bringt Material zum Zielstrip. Bitte Basis oder einen anderen Startplatz wählen.'
                            : 'Dieser Anschlussflug bringt die Person zum Zielstrip. Bitte Basis oder einen anderen Startplatz wählen.'));
                    }
                    return;
                }
                finish(ref);
            };
            confirmBtn?.addEventListener('click', onConfirm);
            cancelBtn?.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);
            overlay.addEventListener('keydown', onKeyDown);
            overlay.hidden = false;
            if (selected === 'other' && input) {
                setTimeout(() => {
                    try { input.focus(); input.select(); } catch (_) {}
                }, 0);
            } else {
                setTimeout(() => {
                    try { confirmBtn?.focus(); } catch (_) {}
                }, 0);
            }
        });
    }

    function normalizeRequest(raw = null, now = nowMs()) {
        if (!raw || typeof raw !== 'object') return null;
        const id = cleanText(raw.id || '', 120);
        if (!id) return null;
        const status = getStatus(raw);
        const eligibleAt = Number(raw.eligibleAt || 0);
        const expiresAt = Number(raw.expiresAt || 0);
        const updatedAt = Number(raw.updatedAt || raw.createdAt || now);
        const next = {
            ...raw,
            schema: SCHEMA,
            id,
            status,
            createdAt: Number(raw.createdAt || now),
            updatedAt,
            eligibleAt: Number.isFinite(eligibleAt) ? eligibleAt : 0,
            expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0
        };
        if (next.status === 'pending' && next.expiresAt > 0 && now > next.expiresAt) {
            next.status = 'expired';
            next.updatedAt = Math.max(now, next.updatedAt);
        }
        return next;
    }

    function compactRequests(list, options = {}) {
        const now = Number(options.now || nowMs());
        const keepTombstoneAfter = addDays(now, -TOMBSTONE_DAYS);
        const normalized = (Array.isArray(list) ? list : [])
            .map(item => normalizeRequest(item, now))
            .filter(Boolean);
        const byId = new Map();
        for (const req of normalized) {
            const prev = byId.get(req.id);
            if (!prev || chooseRequest(req, prev) === req) byId.set(req.id, req);
        }
        const merged = Array.from(byId.values())
            .filter(req => {
                if (!isTerminalStatus(getStatus(req))) return true;
                return Number(req.updatedAt || 0) >= keepTombstoneAfter;
            })
            .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
        const pending = merged.filter(req => getStatus(req) === 'pending');
        const terminal = merged.filter(req => getStatus(req) !== 'pending');
        return [...pending.slice(0, MAX_PENDING), ...terminal].slice(0, MAX_TOTAL_FOR_SYNC);
    }

    function chooseRequest(a, b) {
        if (!a) return b;
        if (!b) return a;
        const pa = statusPriority(a);
        const pb = statusPriority(b);
        if (pa !== pb && (isTerminalStatus(getStatus(a)) || isTerminalStatus(getStatus(b)))) {
            return pa > pb ? a : b;
        }
        return Number(a.updatedAt || 0) >= Number(b.updatedAt || 0) ? a : b;
    }

    function writeRequests(list, options = {}) {
        const compacted = compactRequests(list);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted)); } catch (err) {
            console.warn('[FollowUp] Speicher fehlgeschlagen:', err?.message || err);
        }
        render();
        updateDebugButton();
        if (options.cloud === true && typeof window.triggerCloudSave === 'function') {
            setTimeout(() => {
                try { window.triggerCloudSave(true); } catch (_) {}
            }, 0);
        }
        if (typeof window.vpRefreshWeatherDebugReport === 'function') {
            try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
        }
        return compacted;
    }

    function getRequests() {
        return compactRequests(readStoredRequests());
    }

    function saveMutated(mutator, options = {}) {
        const list = getRequests();
        const next = mutator(list) || list;
        return writeRequests(next, options);
    }

    function getProfileId(md = null) {
        const explicit = String(
            md?.bush?.profileId
            || md?.missionContract?.bush?.profileId
            || md?.missionContract?.appliedProfileId
            || md?.missionContract?.requestedProfileId
            || md?._appliedProfile
            || md?._requestedProfile
            || ''
        ).trim().toLowerCase();
        if (explicit && SOURCE_MAP[explicit]) return explicit;
        const missionType = String(md?.missionType || md?.type || '').trim().toLowerCase();
        const category = String(md?.cat || md?.category || md?.requestedCategory || md?.selectedCategory || md?.missionContract?.category || '').trim().toLowerCase();
        const taskDomain = String(md?.passenger?.taskDomain || md?.missionContract?.taskDomain || md?.taskDomain || '').trim().toLowerCase();
        const roleProfile = String(md?.passenger?.roleProfile || md?.missionContract?.passenger?.roleProfile || '').trim().toLowerCase();
        if (explicit === 'inspection_infra' || taskDomain === 'inspection_infra') return 'inspection_infra';
        const hay = [
            category,
            taskDomain,
            roleProfile,
            md?.mission,
            md?.t,
            md?.story,
            md?.s
        ].filter(Boolean).join(' ').toLowerCase();
        const isApt = missionType === 'apt' || (!md?.bush && !md?.poi && !/bush_/.test(explicit));
        if (
            isApt
            && (category === 'charter' || taskDomain === 'charter' || /vip_business|charter_professional/.test(roleProfile))
            && !/(medical|medic|patient|cargo|fracht|freight|animal|tier|training|club|news|media|sightseeing|tour)/.test(hay)
            && !/(anschlussflug|linienflug|airline|connecting flight|feeder flight|zubringerflug|one[-\s]?way)/.test(hay)
        ) {
            return 'apt_charter';
        }
        return explicit;
    }

    function getMissionDataFromCandidate(candidate = null) {
        if (candidate && typeof candidate === 'object' && candidate.currentMissionData) return candidate.currentMissionData;
        return candidate && typeof candidate === 'object' ? candidate : null;
    }

    function pickupPassengerProfileForKind(kind = '') {
        return String(kind || '').toLowerCase() === 'apt_charter'
            ? { roleProfile: 'charter_professional_neutral_v1', taskDomain: 'charter' }
            : { roleProfile: 'bush_pickup_guest_v1', taskDomain: 'bush_pickup_return' };
    }

    function extractPassenger(md = null, sourceKind = '') {
        const candidates = [
            md?.passenger,
            md?.missionContract?.passenger,
            typeof window !== 'undefined' ? window.activePassenger : null
        ];
        const p = candidates.find(item => item && typeof item === 'object') || {};
        const profile = pickupPassengerProfileForKind(sourceKind);
        return {
            name: cleanText(p.name || '', 80),
            role: cleanText(p.role || (String(sourceKind).toLowerCase() === 'apt_charter' ? 'Chartergast' : 'Bush-Teamgast'), 120),
            gender: cleanText(p.gender || '', 30),
            roleProfile: profile.roleProfile,
            taskDomain: profile.taskDomain,
            gTolerance: p.gTolerance || 'mittel',
            bankTolerance: p.bankTolerance || 'mittel',
            cargoSensitivity: p.cargoSensitivity || 'mittel',
            stomachSensitivity: p.stomachSensitivity || 'mittel',
            comfortPriority: p.comfortPriority || 'mittel',
            urgencyPriority: p.urgencyPriority || 'mittel'
        };
    }

    function sourceStoryText(md = null) {
        return cleanText(
            md?.story
            || md?.mStory
            || md?.missionStory
            || document.getElementById('mStory')?.innerText
            || '',
            1600
        );
    }

    function buildReconServicePlan(md = null, targetRef = null) {
        const bush = md?.bush || md?.missionContract?.bush || {};
        const targetName = targetRef?.name || targetRef?.icao || 'Zielstrip';
        const hay = cleanText([
            bush?.reconFocus,
            bush?.reconFocusLabel,
            md?.mission,
            sourceStoryText(md)
        ].filter(Boolean).join(' '), 2200).toLowerCase();
        const mk = (plan) => ({
            observedIssue: cleanText(plan.observedIssue, 180),
            serviceTask: cleanText(plan.serviceTask, 240),
            kitItems: cleanText(plan.kitItems, 180),
            label: cleanText(plan.label, 220),
            role: cleanText(plan.role || 'Servicekontakt am Strip', 120),
            weightLbs: Math.max(8, Math.round(Number(plan.weightLbs || 38))),
            reason: cleanText(plan.reason, 240),
            handoff: cleanText(plan.handoff, 240)
        });
        if (/drain|washout|wasser|unterspuel|unterspül|weich|pfütz|pfuetz|graben|runoff/.test(hay)) {
            return mk({
                observedIssue: `Beim Recon wurden mögliche weiche Stellen und Drainage-Spuren am Rand von ${targetName} erkannt.`,
                serviceTask: 'Der Platzkontakt soll die markierten Stellen am Boden prüfen, provisorisch kennzeichnen und den nächsten schweren Flug freigeben oder zurückstellen.',
                kitItems: 'Markierstäbe, Drainageband, Klappspaten und Fototafel',
                label: `Servicepaket ${targetName}: Markierstäbe, Drainageband, Klappspaten und Fototafel (46 lbs)`,
                weightLbs: 46,
                reason: 'Der Recon-Befund reicht für die Planung, aber die Stelle muss am Boden markiert werden, bevor weitere Flüge folgen.',
                handoff: 'Nach der Landung übernimmt der lokale Platzkontakt das Paket am Striprand und gleicht es mit dem Recon-Foto ab.'
            });
        }
        if (/windsack|marker|markier|schild|signage|hinweis|tafel|pistenkopf|bahnrand/.test(hay)) {
            return mk({
                observedIssue: `Der Recon hat fehlende oder verrutschte Marker am Strip von ${targetName} nahegelegt.`,
                serviceTask: 'Der Platzkontakt soll Marker, Schild oder Windsack am Boden wieder sichtbar machen und die Basis danach kurz bestätigen.',
                kitItems: 'Ersatzmarker, Befestigungssatz, Warnband und kleine Werkzeugrolle',
                label: `Servicepaket ${targetName}: Ersatzmarker, Befestigungssatz, Warnband und Werkzeugrolle (38 lbs)`,
                weightLbs: 38,
                reason: 'Ohne sichtbare Markierung bleibt der nächste Anflug unnötig unsauber; das kleine Kit passt gut in einen kurzen Service Run.',
                handoff: 'Nach der Landung wird das Servicepaket am Treffpunkt übergeben und der Recon-Befund mit dem Kontakt abgeglichen.'
            });
        }
        if (/ast|baum|wild|zaun|hindernis|gegenstaend|gegenständ|spuren|ranch|meadow|wiese/.test(hay)) {
            return mk({
                observedIssue: `Beim Recon wurden mögliche Hindernisse, Wildspuren oder ein Zaunthema am Rand von ${targetName} notiert.`,
                serviceTask: 'Der Kontakt vor Ort soll den Randbereich sichern, lose Gegenstände entfernen und die nächste Crew informieren.',
                kitItems: 'Arbeitshandschuhe, Flatterband, kleine Astsäge, Zaunbinder und Fotoausdruck',
                label: `Servicepaket ${targetName}: Flatterband, Astsäge, Zaunbinder und Fotoausdruck (44 lbs)`,
                weightLbs: 44,
                reason: 'Der Recon hat genug Hinweise geliefert, um einen gezielten kleinen Bodenservice statt einer großen Crewfahrt zu schicken.',
                handoff: 'Das Paket geht nach der Landung an den Ranger- oder Ranchkontakt am Striprand.'
            });
        }
        if (/saison|season|opening|lodge|camp|ranch|betrieb|freigabe|betriebsakte/.test(hay)) {
            return mk({
                observedIssue: `Der Recon hat gezeigt, dass ${targetName} vor der nächsten Nutzung einen kleinen Saison- oder Betreibercheck braucht.`,
                serviceTask: 'Der Kontakt soll Betriebsmappe, Marker und Funkakku für die erste sichere Nutzung der Saison vorbereiten.',
                kitItems: 'Betriebsmappe, Funkakku, Markerband und kleines Wartungskit',
                label: `Servicepaket ${targetName}: Betriebsmappe, Funkakku, Markerband und Wartungskit (40 lbs)`,
                weightLbs: 40,
                reason: 'Die Basis möchte den Zielstrip nach dem Recon nicht nur freigeben, sondern mit Material für die ersten Folgeflüge ausstatten.',
                handoff: 'Nach der Landung wird das Servicekit am Stripkontakt abgegeben und die Freigabeliste kurz durchgesprochen.'
            });
        }
        if (/rauch|fire|brand|camp|smoke/.test(hay)) {
            return mk({
                observedIssue: `Der Recon um ${targetName} ergab keinen Löschauftrag, aber Bedarf an sauberer Meldetechnik und Markierung vor Ort.`,
                serviceTask: 'Der Kontakt soll Funkakku, Warnband und Meldekarte übernehmen, damit weitere Beobachtungen geordnet zurücklaufen.',
                kitItems: 'Funkakku, Warnband, Firewatch-Meldekarte und kleine Wasserkanister',
                label: `Servicepaket ${targetName}: Funkakku, Warnband, Meldekarte und kleine Wasserkanister (52 lbs)`,
                weightLbs: 52,
                reason: 'Der Folgeflug bleibt ein Service Run, kein Löscheinsatz; die Basis stärkt nur die Meldestelle am Strip.',
                handoff: 'Nach der Landung übernimmt der Firewatch- oder Rangerkontakt das Paket am Striprand.'
            });
        }
        return mk({
            observedIssue: `Der Recon über ${targetName} hat einen kleinen, klar begrenzten Servicebedarf am Strip ergeben.`,
            serviceTask: 'Der Platzkontakt soll den Befund am Boden prüfen, die markierte Stelle sichern und der Basis eine kurze Rückmeldung geben.',
            kitItems: 'Werkzeugtasche, Markierstäbe, Ersatz-Funkakku und ausgedruckter Recon-Befund',
            label: `Servicepaket ${targetName}: Werkzeugtasche, Markierstäbe, Ersatz-Funkakku und Recon-Befund (42 lbs)`,
            weightLbs: 42,
            reason: 'Der Recon war bewusst ohne Landung; jetzt folgt der kleine Materialflug für den gezielten Service am Boden.',
            handoff: 'Nach der Landung geht das Servicepaket direkt an den Platzkontakt am Striprand.'
        });
    }

    function seededUnit(text = '') {
        const hash = stableHash(text || 'recon');
        const n = parseInt(hash.slice(-6), 36);
        return Number.isFinite(n) ? (n % 10000) / 10000 : Math.random();
    }

    function isBushReconMission(md = null) {
        return getProfileId(md) === 'bush_recon_return';
    }

    function normalizeReconOutcomeType(value = '') {
        const s = String(value || '').trim().toLowerCase();
        return BUSH_RECON_OUTCOME_TYPES.has(s) ? s : '';
    }

    function buildReconTechnicianPlan(md = null, targetRef = null) {
        const targetName = targetRef?.name || targetRef?.icao || 'Zielstrip';
        const serviceRun = buildReconServicePlan(md, targetRef);
        const people = [
            { name: 'Mara Keller', role: 'Instandhaltungstechnikerin', gender: 'female' },
            { name: 'Jonas Reiter', role: 'Field-Service-Techniker', gender: 'male' },
            { name: 'Nora Stein', role: 'Backcountry-Wartungstechnikerin', gender: 'female' },
            { name: 'Levi Brandt', role: 'Strip-Maintenance-Spezialist', gender: 'male' }
        ];
        const key = [
            md?.missionId,
            md?.missionKey,
            md?.mission,
            targetRef?.icao,
            targetName
        ].filter(Boolean).join('|');
        const pick = people[Math.floor(seededUnit(`${key}|technician`) * people.length)] || people[0];
        const kitItems = serviceRun.kitItems || 'Werkzeugtasche, Markierband und Recon-Befund';
        const kitLabel = `Techniker-Kit ${targetName}: ${kitItems} (${Math.max(35, Number(serviceRun.weightLbs || 42) + 18)} lbs)`;
        return {
            passenger: {
                name: pick.name,
                role: pick.role,
                gender: pick.gender,
                roleProfile: 'bush_charter_guest_v1',
                taskDomain: 'charter',
                gTolerance: 'mittel',
                bankTolerance: 'mittel',
                cargoSensitivity: 'hoch',
                stomachSensitivity: 'mittel',
                comfortPriority: 'mittel',
                urgencyPriority: 'mittel',
                greetingText: `Ich habe das Recon-Protokoll und das Techniker-Kit dabei. Am Strip schaue ich mir den Befund am Boden an und melde danach, ob der Platz wieder sauber freigegeben werden kann.`
            },
            kitLabel,
            kitItems,
            serviceTask: serviceRun.serviceTask,
            observedIssue: serviceRun.observedIssue,
            reason: serviceRun.reason,
            workSummary: `Der Recon-Befund an ${targetName} braucht nicht nur ein Paket, sondern eine kurze Prüfung durch ${pick.role} am Boden.`,
            pickupSummary: `${pick.name} soll nach der Arbeit am Strip mit Befundnotizen und Werkzeugtasche wieder zur Basis zurück.`
        };
    }

    function chooseBushReconOutcome(md = null, targetRef = null) {
        const forced = normalizeReconOutcomeType(
            md?.bushReconOutcome?.outcome
            || md?.bushReconOutcome?.type
            || (typeof window !== 'undefined' ? window.gaDebugBushReconOutcomeOverride : '')
        );
        if (forced) return forced;
        const bush = md?.bush || md?.missionContract?.bush || {};
        const hay = cleanText([
            bush?.reconFocus,
            bush?.reconFocusLabel,
            md?.mission,
            sourceStoryText(md)
        ].filter(Boolean).join(' '), 2200).toLowerCase();
        const key = [
            md?.missionId,
            md?.missionKey,
            md?.mission,
            targetRef?.icao,
            targetRef?.name,
            hay
        ].filter(Boolean).join('|');
        let roll = seededUnit(key || String(nowMs()));
        let weights = [
            ['all_clear', 0.30],
            ['monitor_only', 0.18],
            ['minor_service', 0.38],
            ['technician_needed', 0.14]
        ];
        if (/schaden|damage|bruch|block|hindernis|baum|zaun|unterspuel|unterspül|weich|ausfall|defekt/.test(hay)) {
            weights = [
                ['all_clear', 0.18],
                ['monitor_only', 0.16],
                ['minor_service', 0.42],
                ['technician_needed', 0.24]
            ];
        } else if (/saison|opening|sicht|marker|windsack|meld|beobacht|rauch|fire/.test(hay)) {
            weights = [
                ['all_clear', 0.30],
                ['monitor_only', 0.24],
                ['minor_service', 0.34],
                ['technician_needed', 0.12]
            ];
        }
        for (const [type, weight] of weights) {
            roll -= weight;
            if (roll <= 0) return type;
        }
        return 'minor_service';
    }

    function normalizeBushReconOutcome(raw = null, md = null, targetRef = null, options = {}) {
        if (!isBushReconMission(md) && !raw && !options.force) return null;
        const target = normalizeRef(targetRef || md?.bush?.targetRef || md?.missionContract?.bush?.targetRef || null);
        const outcome = normalizeReconOutcomeType(options.outcome || raw?.outcome || raw?.type) || chooseBushReconOutcome(md, target);
        const serviceRun = (raw?.serviceRun && typeof raw.serviceRun === 'object')
            ? buildServiceRunCargo({ serviceRun: raw.serviceRun }, target)
            : buildReconServicePlan(md, target);
        const technicianPlan = (raw?.technicianPlan && typeof raw.technicianPlan === 'object')
            ? raw.technicianPlan
            : buildReconTechnicianPlan(md, target);
        const followUpKind = outcome === 'minor_service'
            ? 'bush_supply_strip'
            : (outcome === 'technician_needed' ? 'bush_charter_strip' : 'none');
        const followUpLabel = outcome === 'minor_service'
            ? 'Bush Service Run'
            : (outcome === 'technician_needed' ? 'Bush Technician Dropoff' : '');
        const label = outcome === 'all_clear'
            ? 'Recon unauffällig'
            : (outcome === 'monitor_only'
                ? 'Weiter beobachten'
                : (outcome === 'technician_needed' ? 'Techniker nötig' : 'Kleiner Servicebedarf'));
        const resultText = outcome === 'all_clear'
            ? `Der Überflug hat keine blockierende Auffälligkeit am ${target?.name || target?.icao || 'Zielstrip'} ergeben; die Basis dokumentiert den Strip als nutzbar.`
            : (outcome === 'monitor_only'
                ? `Am ${target?.name || target?.icao || 'Zielstrip'} gab es nur einen unsicheren Hinweis, den die Basis weiter beobachtet; heute wird noch kein Folgeflug angesetzt.`
                : (outcome === 'technician_needed'
                    ? `${technicianPlan.workSummary} Die Basis plant dafür einen Techniker-Dropoff statt nur eines Materialpakets.`
                    : `${serviceRun.observedIssue} Daraus wird ein gezielter kleiner Service Run vorbereitet.`));
        return {
            ...(raw && typeof raw === 'object' ? raw : {}),
            schema: BUSH_RECON_OUTCOME_SCHEMA,
            outcome,
            type: outcome,
            label,
            followUpKind,
            followUpLabel,
            resultText: cleanText(resultText, 520),
            serviceRun: outcome === 'minor_service' ? serviceRun : null,
            technicianPlan: outcome === 'technician_needed' ? technicianPlan : null,
            revealAfter: 'inspection_complete',
            hiddenFromWriter: true,
            createdAt: Number(raw?.createdAt || options.createdAt || nowMs())
        };
    }

    function ensureBushReconOutcome(md = null, options = {}) {
        if (!md || typeof md !== 'object' || !isBushReconMission(md)) return null;
        const targetRef = normalizeRef(md?.bush?.targetRef || md?.missionContract?.bush?.targetRef || null);
        const existing = (md.bushReconOutcome && typeof md.bushReconOutcome === 'object')
            ? md.bushReconOutcome
            : null;
        const normalized = normalizeBushReconOutcome(existing, md, targetRef, {
            outcome: options.outcome,
            force: true,
            createdAt: existing?.createdAt || options.createdAt
        });
        if (normalized) {
            md.bushReconOutcome = normalized;
            md.hiddenMissionOutcome = {
                ...(md.hiddenMissionOutcome && typeof md.hiddenMissionOutcome === 'object' ? md.hiddenMissionOutcome : {}),
                bushReconOutcome: normalized
            };
        }
        return normalized;
    }

    function buildAllowedChainConfig(md = null, cargoOutcome = null) {
        if (!md || typeof md !== 'object') return null;
        if (typeof window.missionInfraBuildAllowedChainConfig === 'function') {
            try {
                const infraChain = window.missionInfraBuildAllowedChainConfig(md, cargoOutcome);
                if (infraChain) return infraChain;
            } catch (err) {
                console.warn('[FollowUp] Infra chain config failed:', err?.message || err);
            }
        }
        const cont = md.followUpContinuation && typeof md.followUpContinuation === 'object'
            ? md.followUpContinuation
            : null;
        if (!cont) return null;
        const chain = cont.chain && typeof cont.chain === 'object' ? cont.chain : null;
        const sourceKind = String(cont.sourceKind || chain?.rootSourceKind || '').toLowerCase();
        const currentStep = String(cont.chainStep || chain?.step || '').toLowerCase();
        const currentFollowUpKind = String(cont.followUpKind || '').toLowerCase();
        const depth = Math.max(0, Math.round(Number(chain?.depth || 0)));
        if (
            sourceKind !== 'bush_recon_return'
            || currentFollowUpKind !== 'bush_charter_strip'
            || currentStep !== 'technician_dropoff'
            || depth >= MAX_CHAIN_DEPTH
        ) return null;
        if (cargoOutcome && cargoOutcome.failed === true) return null;
        if (md.missionFailed === true || String(md.missionResult || '').toLowerCase() === 'failed') return null;
        const passenger = extractPassenger(md);
        const nextTemporalContext = buildTemporalContext('bush_charter_strip', { passenger });
        return {
            followUpKind: 'bush_pickup_strip',
            sourceKind: 'bush_charter_strip',
            sourceLabel: 'Bush Technician Dropoff',
            followUpLabel: 'Bush Technician Pickup',
            passenger,
            temporalContext: nextTemporalContext,
            chain: {
                schema: 'ga.followup.chain.v1',
                id: cleanText(chain?.id || cont.requestId || md.followUpRequestId || md.missionId || `chain_${stableHash(md.missionKey || md.missionId || '')}`, 120),
                rootSourceKind: 'bush_recon_return',
                parentRequestId: cleanText(cont.requestId || md.followUpRequestId || '', 120),
                step: 'technician_pickup',
                previousStep: currentStep,
                depth: depth + 1,
                terminal: true
            }
        };
    }

    function buildNarrativeMemory(sourceKind, md, passenger, homeRef, targetRef) {
        const story = sourceStoryText(md);
        const cargo = cleanText(md?.cargoText || md?.initialCargoText || document.getElementById('mWeight')?.innerText || '', 260);
        const pax = cleanText(md?.paxText || md?.initialPaxText || document.getElementById('mPay')?.innerText || '', 180);
        const targetName = targetRef?.name || targetRef?.icao || 'dem Zielstrip';
        const homeName = homeRef?.name || homeRef?.icao || 'der Basis';
        const temporalContext = missionTemporalContext(md, sourceKind);
        const stayPeriod = stayPeriodText(temporalContext?.stayDays, sourceKind);
        const stayDonePrefix = stayPeriod ? `Der geplante Zeitraum ${stayPeriod} ist vorbei; ` : '';
        const commonMemory = {
            temporalContext,
            stayDays: temporalContext?.stayDays || null,
            stayText: temporalContext?.stayText || '',
            deboardingHint: temporalContext?.deboardingHint || ''
        };
        if (sourceKind === 'bush_charter_strip') {
            const name = passenger?.name || 'der Chartergast';
            const role = passenger?.role || 'Bush-Teamgast';
            const cont = md?.followUpContinuation && typeof md.followUpContinuation === 'object' ? md.followUpContinuation : null;
            const isTechnicianDropoff = String(cont?.chainStep || cont?.chain?.step || '').toLowerCase() === 'technician_dropoff'
                || /techniker|instandhaltung|maintenance|service-techn/i.test(`${role} ${story}`);
            if (isTechnicianDropoff) {
                const serviceRun = md?.followUpContinuation?.narrativeMemory?.serviceRun
                    || md?.followUpContext?.serviceRun
                    || buildReconServicePlan(md, targetRef);
                return {
                    ...commonMemory,
                    serviceRun,
                    outboundPurpose: story || `${name}, ${role}, wurde nach dem Recon von ${homeName} nach ${targetName} gebracht, um den Befund am Boden zu prüfen.`,
                    stayOrWorkSummary: `${name} hat ${stayPeriod || 'die Zeit am Strip'} genutzt, um den Recon-Befund am Boden abzugleichen, Markierungen zu prüfen und Notizen für die Basis zu machen.`,
                    whyNowReturn: `${stayDonePrefix}die Bodenprüfung ist abgeschlossen, Werkzeug und Befundnotizen sind gepackt, und die Basis braucht den Rückbericht für die Freigabeentscheidung.`,
                    returnReason: 'Rückkehr zur Basis mit Befundnotizen, Werkzeugtasche und klarer Empfehlung für den Zielstrip.',
                    teamContinuity: `Der Pickup schließt die Recon-Kette ab: erst Überflug, dann Techniker am Boden, jetzt Rückbericht zurück zur Basis.`,
                    pickupGreetingText: `${name || 'Ich'} bin am Strip fertig. Ich habe den Befund am Boden abgeglichen, die Notizen sind gepackt und ich muss mit der Empfehlung zurück zur Basis.`,
                    sourcePaxText: pax,
                    sourceCargoText: cargo || serviceRun.label
                };
            }
            return {
                ...commonMemory,
                outboundPurpose: story || `${name} wurde als ${role} von ${homeName} nach ${targetName} gebracht.`,
                stayOrWorkSummary: `${name} hat am Zielstrip den geplanten Aufenthalt${stayPeriod ? ` ${stayPeriod}` : ''} genutzt: Briefing mit dem lokalen Kontakt, Kontrolle der mitgebrachten Ausrüstung und Abgleich der Lage vor Ort.`,
                whyNowReturn: `${stayDonePrefix}die Arbeit vor Ort ist abgeschlossen, die Notizen und persönlichen Sachen sind gepackt, und die Basis braucht den Rückbericht.`,
                returnReason: 'Rückkehr zur Basis für Debriefing und nächste Teamentscheidung.',
                teamContinuity: `Der Kontakt fragt bewusst wieder denselben Piloten an, weil Anflug, Strip und Person aus dem ersten Auftrag bekannt sind.`,
                pickupGreetingText: `${name || 'Ich'} bin bereit am Strip. Wir haben hier draußen alles erledigt und müssen mit dem Bericht zurück zur Basis.`,
                sourcePaxText: pax,
                sourceCargoText: cargo
            };
        }
        if (sourceKind === 'bush_scenic_hopper') {
            const name = passenger?.name || 'der Adventure-Gast';
            const role = passenger?.role || 'Adventure-Gast';
            return {
                ...commonMemory,
                outboundPurpose: story || `${name} wurde als ${role} von ${homeName} nach ${targetName} geflogen, um den geplanten Backcountry-Aufenthalt am Zielstrip zu beginnen.`,
                stayOrWorkSummary: `${name} hat ${stayPeriod || 'die Zeit draußen'} für den geplanten Adventure-Teil genutzt: den lokalen Treffpunkt erreicht, den Tagesrucksack sortiert, Fotos und Eindrücke gesammelt und den Rückweg zum bekannten Strip mit dem Kontakt abgestimmt.`,
                whyNowReturn: `${stayDonePrefix}der vereinbarte Wildnisaufenthalt ist beendet, das Wetterfenster passt, und Kamera, Rucksack und persönliche Sachen sind wieder gepackt.`,
                returnReason: 'Rückkehr zur Basis mit Fotos, Notizen und der persönlichen Geschichte vom Aufenthalt draußen.',
                teamContinuity: `Der Gast fragt bewusst wieder denselben Piloten an, weil der Strip, der Anflug und die Absprachen aus dem Adventure-Hinflug vertraut sind.`,
                pickupGreetingText: `Ich bin wieder am Strip. Der Ausflug hat sich gelohnt, der Rucksack ist gepackt, und ich habe einiges vom Aufenthalt zu erzählen.`,
                sourcePaxText: pax,
                sourceCargoText: cargo
            };
        }
        if (sourceKind === 'apt_charter') {
            const name = passenger?.name || 'der Chartergast';
            const role = passenger?.role || 'Chartergast';
            const stayLead = stayPeriod ? `Nach einem Aufenthalt ${stayPeriod} ` : '';
            return {
                ...commonMemory,
                outboundPurpose: story || `${name} wurde als ${role} von ${homeName} nach ${targetName} gebracht.`,
                stayOrWorkSummary: `${name} war ${stayPeriod ? `${stayPeriod} ` : ''}vor Ort: Empfang durch den lokalen Kontakt, Wege zwischen Vorfeld und Terminort, Gespräche am Tisch und am Ende das Sortieren von Notizen, Tasche und persönlichem Gepäck.`,
                whyNowReturn: `${stayLead}${name} hat die wichtigsten Punkte geklärt, Tasche und Unterlagen wieder beisammen und wartet am GA-Bereich von ${targetName} auf den Rückflug nach ${homeName}.`,
                returnReason: `Rückkehr nach ${homeName} mit Notizen, persönlichem Gepäck und den Eindrücken aus dem Termin vor Ort.`,
                pickupDepartureCue: `Ich habe die Notizen aus dem Termin im Gepäck und kann auf dem Rückflug zum ersten Mal in Ruhe sortieren, was davon zu Hause als Nächstes wichtig wird.`,
                teamContinuity: `Der Chartergast fragt bewusst wieder denselben Piloten an, weil Ablauf, Platzwechsel und Person aus dem ersten Charterflug vertraut sind.`,
                pickupGreetingText: `Ich bin wieder am GA-Bereich. Der Termin ist erledigt, meine Tasche ist gepackt, und ich bin bereit für den Rückflug.`,
                sourcePaxText: pax,
                sourceCargoText: cargo
            };
        }
        if (sourceKind === 'bush_recon_return') {
            const reconOutcome = ensureBushReconOutcome(md);
            const serviceRun = reconOutcome?.serviceRun || buildReconServicePlan(md, targetRef);
            const technicianPlan = reconOutcome?.technicianPlan || null;
            const waitText = stayPeriod || 'nach der Auswertung';
            if (reconOutcome?.outcome === 'technician_needed') {
                return {
                    ...commonMemory,
                    reconOutcome,
                    serviceRun,
                    technicianPlan,
                    outboundPurpose: story || `Beim Recon von ${homeName} zum Zielgebiet bei ${targetName} wurde der Strip ohne geplante Landung aus der Luft geprüft.`,
                    stayOrWorkSummary: `Die Basis hat den Recon ${waitText} ausgewertet: ${reconOutcome.resultText || technicianPlan?.workSummary || serviceRun.observedIssue}`,
                    whyNowReturn: `Aus dem Rückbericht ist ein Techniker-Dropoff entstanden. ${technicianPlan?.reason || serviceRun.reason}`,
                    returnReason: technicianPlan?.reason || serviceRun.reason,
                    teamContinuity: `Der zweite Flug knüpft direkt an den Recon an: erst Befund aus der Luft, jetzt ein Techniker am Boden.`,
                    serviceTask: technicianPlan?.serviceTask || serviceRun.serviceTask,
                    serviceHandoff: `${technicianPlan?.passenger?.name || 'Der Techniker'} bleibt nach der Landung am Strip und meldet sich nach der Bodenarbeit für die Rückholung.`,
                    technicianPlan,
                    sourcePaxText: pax,
                    sourceCargoText: cargo || technicianPlan?.kitLabel || serviceRun.label
                };
            }
            return {
                ...commonMemory,
                reconOutcome,
                serviceRun,
                outboundPurpose: story || `Beim Recon von ${homeName} zum Zielgebiet bei ${targetName} wurde der Strip ohne geplante Landung aus der Luft geprüft.`,
                stayOrWorkSummary: `Die Basis hat den Recon ${waitText} ausgewertet: ${serviceRun.observedIssue}`,
                whyNowReturn: `Aus dem Rückbericht ist ein gezielter kleiner Service Run entstanden. ${serviceRun.reason}`,
                returnReason: serviceRun.reason,
                teamContinuity: `Der zweite Flug knüpft direkt an den Recon an: erst Befund aus der Luft, jetzt Material und Kontakt am Boden.`,
                serviceTask: serviceRun.serviceTask,
                serviceHandoff: serviceRun.handoff,
                sourcePaxText: pax,
                sourceCargoText: cargo || serviceRun.label
            };
        }
        return {
            ...commonMemory,
            outboundPurpose: story || `Die Versorgungsladung aus ${homeName} wurde nach ${targetName} gebracht.`,
            stayOrWorkSummary: `Die Crew vor Ort hat ${stayPeriod ? `${stayPeriod} ` : ''}die Lieferung sortiert, Verbrauchsmaterial verteilt und die Rückfracht für den Heimflug vorbereitet.`,
            whyNowReturn: `${stayDonePrefix}der Platzkontakt hat die Rückholfracht freigegeben; sie soll nicht länger am Strip liegen bleiben.`,
            returnReason: 'Rücktransport von Belegen, leeren Behältern und einem kleinen defekten Teil zur Basis.',
            teamContinuity: `Der Folgeflug schließt den Versorgungskreislauf ab: hinbringen, vor Ort nutzbar machen, Rückfracht sauber heimholen.`,
            pickupGreetingText: '',
            sourcePaxText: pax,
            sourceCargoText: cargo
        };
    }

    function buildCargoReturn(memory, targetRef) {
        const place = targetRef?.name || targetRef?.icao || 'Remote Strip';
        return {
            label: `Rückholfracht ${place}: leere Versorgungskisten, signierte Materialliste und defektes Funkakku-Case (42 lbs)`,
            role: 'Frachtkontakt am Strip',
            weightLbs: 42,
            reason: memory?.returnReason || 'Rückfracht zur Basis'
        };
    }

    function buildServiceRunCargo(memory, targetRef) {
        const serviceRun = memory?.serviceRun && typeof memory.serviceRun === 'object'
            ? memory.serviceRun
            : buildReconServicePlan(null, targetRef);
        return {
            ...serviceRun,
            label: serviceRun.label || `Servicepaket ${targetRef?.name || targetRef?.icao || 'Remote Strip'} (42 lbs)`,
            role: serviceRun.role || 'Servicekontakt am Strip',
            reason: serviceRun.reason || 'Serviceflug nach Recon-Befund'
        };
    }

    function buildPipelineContext(req, context = {}) {
        if (!req || typeof req !== 'object') return null;
        const acceptance = acceptanceForRequest(req, context);
        if (!acceptance) return null;
        const start = context.start || airportFromRef(acceptance?.startRef || req.route?.homeRef);
        const returnHome = airportFromRef(acceptance?.returnHomeRef || req.route?.homeRef);
        const pickupTarget = airportFromRef(acceptance?.targetRef || req.route?.targetRef);
        const dest = context.dest || airportFromRef(acceptanceDestRef(acceptance) || req.route?.targetRef);
        const followUpKind = String(req.followUpKind || '').toLowerCase();
        const effectiveProfileId = String(acceptance?.dispatchProfileId || followUpKind).toLowerCase();
        const acceptanceMode = String(acceptance?.mode || req.pilotStartPolicy || 'pickup_from_home').toLowerCase();
        const targetName = pickupTarget?.n || pickupTarget?.name || req.route?.targetRef?.name || req.route?.targetRef?.icao || 'Zielstrip';
        const homeName = returnHome?.n || returnHome?.name || req.route?.homeRef?.name || req.route?.homeRef?.icao || 'Basis';
        const departureName = start?.n || start?.name || start?.icao || homeName;
        const memory = req.narrativeMemory || {};
        const sourceStory = displayText(req.source?.story || memory.outboundPurpose || '');
        const temporalContext = req.temporalContext || req.missionTemporalContext || memory.temporalContext || null;
        const temporalHint = temporalContext?.stayText
            ? `Geplante Aufenthalts-/Wartezeit bis zur Folgeanfrage: ${displayText(temporalContext.stayText)}.`
            : '';
        if ((req.poiFollowUp || req.route?.targetRef?.kind === 'poi' || /^infra_/.test(followUpKind)) && typeof window.missionInfraBuildPipelineContext === 'function') {
            try {
                const infraContext = window.missionInfraBuildPipelineContext(req, { ...context, acceptance });
                if (infraContext) return infraContext;
            } catch (err) {
                console.warn('[FollowUp] Infra pipeline context failed:', err?.message || err);
            }
        }
        if (followUpKind === 'apt_charter_pickup') {
            const passenger = {
                ...(req.passenger || {}),
                name: cleanText(req.passenger?.name || 'Chartergast', 80),
                role: cleanText(req.passenger?.role || 'Chartergast', 120),
                gender: cleanText(req.passenger?.gender || '', 30),
                roleProfile: 'charter_professional_neutral_v1',
                taskDomain: 'charter'
            };
            const name = passenger.name || 'der Chartergast';
            const role = passenger.role || 'Chartergast';
            const stay = displayText(memory.stayOrWorkSummary || `${name} hat den Termin am Zielplatz abgeschlossen, Tasche und Notizen sortiert und wartet am vereinbarten Treffpunkt.`);
            const whyNow = displayText(memory.whyNowReturn || `${name} ist wieder am GA-Bereich und bereit für den Rückflug nach ${homeName}.`);
            const returnReason = displayText(memory.returnReason || `Rückflug nach ${homeName} mit Notizen, Gepäck und Eindrücken aus dem Termin.`);
            const departureCue = displayText(memory.pickupDepartureCue || `Ich habe Notizen und Eindrücke im Gepäck und kann sie auf dem Rückflug in Ruhe sortieren.`);
            const exactWhere = `am vereinbarten Treffpunkt auf dem Vorfeld oder im GA-Bereich von ${targetName}`;
            if (acceptanceMode === 'onsite_to_home' || effectiveProfileId === 'apt_charter') {
                return {
                    schema: 'ga.followup.pipelineContext.v1',
                    requestId: req.id || null,
                    sourceKind: req.sourceKind || null,
                    followUpKind,
                    effectiveProfileId,
                    acceptanceMode,
                    sourceLabel: req.sourceLabel || '',
                    followUpLabel: req.followUpLabel || '',
                    pilotStartPolicy: acceptanceMode,
                    route: {
                        departureName,
                        homeName,
                        targetName,
                        startRef: acceptance?.startRef || null,
                        returnHomeRef: acceptance?.returnHomeRef || null,
                        targetRef: acceptance?.targetRef || null
                    },
                    sourceMission: {
                        title: displayText(req.source?.title || ''),
                        story: sourceStory
                    },
                    temporalContext,
                    lockedPassenger: passenger,
                    storyFrame: {
                        trigger: `${name} ist nach dem Termin schon bei dir am Zielplatz; jetzt wird daraus ein normaler Charter-Rückflug nach ${homeName}.`,
                        focusSubject: `${name}, ${role}, Rückflug nach abgeschlossenem APT-Charter-Termin`,
                        keyQuestion: `Was ${name} zwischen Hinflug und Rückflug erlebt oder erledigt hat und warum der Rückflug nach ${homeName} jetzt sinnvoll ist.`,
                        stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen APT-Charter an.`,
                        completionSignal: `Nach der Landung in ${homeName} sind Gepäck, Notizen und Rückmeldung wieder an der Ausgangsbasis.`,
                        subjectDetail: `${name}, ${role}, ist mit gepackten Sachen bereits am Abflugbereich von ${targetName}.`,
                        incidentContext: stay,
                        temporalHint,
                        whyNow,
                        soughtOutcome: `${name} am aktuellen Standort aufnehmen und als normalen Charter-Rückflug von ${departureName} nach ${homeName} bringen.`
                    },
                    missionVarietyBrief: {
                        purpose: 'APT-Charter-Follow-up als Vor-Ort-Rückflug: Der Pilot ist schon beim Gast, deshalb ist es kein Pickup-Return mit Leerflug.',
                        recipe: `Start am Zielplatz ${targetName}, ${name} ist dort bereit, Charter-Rückflug nach ${homeName}; Briefing und Voice erzählen die Zeit zwischen den Flügen persönlich und glaubwürdig.`,
                        coreQuestions: [
                            `Was hat ${name} seit dem Hinflug am Zielort erledigt?`,
                            `Welche Notizen, Gepäckstücke oder Rückwegdetails bringt ${name} zurück?`,
                            `Warum ist die Rückkehr nach ${homeName} jetzt der logische nächste Schritt?`
                        ],
                        writerExpectations: [
                            `Nutze exakt denselben Gast: ${name}, ${role}.`,
                            'Keine Pickup-Return-Logik beschreiben; der Gast ist am Start bereits vor Ort.',
                            temporalHint ? 'Nutze die Aufenthaltsdauer als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                            'Das Briefing ist ein Dispatcher-Auftrag für den Piloten und soll natürlich klingen.',
                            'Normale deutsche Umlaute verwenden.'
                        ].filter(Boolean)
                    }
                };
            }
            return {
                schema: 'ga.followup.pipelineContext.v1',
                requestId: req.id || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                effectiveProfileId,
                acceptanceMode,
                sourceLabel: req.sourceLabel || '',
                followUpLabel: req.followUpLabel || '',
                pilotStartPolicy: acceptanceMode,
                route: {
                    departureName,
                    homeName,
                    targetName,
                    startRef: acceptance?.startRef || null,
                    returnHomeRef: acceptance?.returnHomeRef || null,
                    targetRef: acceptance?.targetRef || null
                },
                sourceMission: {
                    title: displayText(req.source?.title || ''),
                    story: sourceStory
                },
                temporalContext,
                lockedPassenger: passenger,
                storyFrame: {
                    trigger: `${name} meldet sich nach dem abgeschlossenen Termin am Zielplatz für den Rückflug.`,
                    focusSubject: `${name}, ${role}, Charter-Rückholung nach erledigtem Termin am Zielplatz`,
                    keyQuestion: `Was ${name} am Zielort erledigt hat, warum die Rückholung jetzt passt und welcher Abschluss in ${homeName} folgt.`,
                    stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen APT-Charter an.`,
                    completionSignal: `Nach der Rückkehr nach ${homeName} werden Rückmeldung, Gepäck und Notizen übergeben.`,
                    subjectDetail: `${name}, ${role}, wartet ${exactWhere} mit Notizen und persönlichem Gepäck.`,
                    incidentContext: stay,
                    temporalHint,
                    whyNow,
                    soughtOutcome: `Leer von ${departureName} nach ${targetName} fliegen, ${name} im GA-Bereich aufnehmen und ${passengerPronoun(passenger)} zurück nach ${homeName} bringen.`
                },
                pickupStory: {
                    personName: name,
                    role,
                    exactWhere,
                    whyThere: stay,
                    returnReason,
                    boardingCue: displayText(memory.pickupGreetingText || `Ich bin am Zielplatz bereit; der Termin ist abgeschlossen und meine Sachen sind gepackt.`),
                    departureCue
                },
                pickupCreativeBrief: {
                    purpose: 'Fortsetzung einer bereits geflogenen APT-Charter-Mission. Der Folgeauftrag nutzt dieselbe Person und erzählt die Rückholung nach einem echten Termin am Zielplatz.',
                    recipe: `Leerflug von ${departureName} nach ${targetName}, ${name} im GA-Bereich aufnehmen, Rückflug nach ${homeName}; Briefing und Voice bauen auf dem vorherigen APT-Charter-Hinflug auf.`,
                    coreQuestions: [
                        `Wie knüpft die Rückholung glaubwürdig an den vorherigen Charter-Dropoff von ${name} an?`,
                        `Was hat ${name} am Zielort konkret erledigt?`,
                        `Warum wartet ${name} jetzt am GA-Bereich von ${targetName}?`,
                        `Was wird nach der Rückkehr in ${homeName} mit Notizen, Gepäck oder Bericht gemacht?`
                    ],
                    candidateShortlist: [{
                        id: 'followup_apt_charter_guest',
                        roleIdeas: [role],
                        taskIdeas: [stay, whyNow],
                        objectIdeas: ['Notizen', 'Laptop- oder Dokumententasche', displayText(memory.sourceCargoText || 'persönliches Gepäck')],
                        returnDrivers: [returnReason],
                        accessReasons: [`${targetName} ist der bekannte Zielplatz aus dem ersten Charter-Leg.`]
                    }],
                    writerExpectations: [
                        `Nutze exakt denselben Gast: ${name}, ${role}.`,
                        temporalHint ? 'Nutze die Aufenthaltsdauer als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                        'Das Briefing ist ein Dispatch-Briefing für den Piloten, keine Ich-Erzählung des Gasts.',
                        'Keine Bush-/Backcountry-Sprache, wenn es ein normaler Airport-Charter ist.',
                        'Keine Formular- oder Instruction-Sprache. Die Fortsetzung soll wie ein echter Folgeauftrag wirken.',
                        'Normale deutsche Umlaute verwenden.'
                    ].filter(Boolean)
                }
            };
        }
        if (followUpKind === 'bush_pickup_strip') {
            const sourceLabel = displayText(req.sourceLabel || 'Bush-Flug');
            const adventureSource = String(req.sourceKind || '').toLowerCase() === 'bush_scenic_hopper';
            const passenger = {
                ...(req.passenger || {}),
                name: cleanText(req.passenger?.name || 'Bush-Teamgast', 80),
                role: cleanText(req.passenger?.role || 'Rückkehrgast', 120),
                gender: cleanText(req.passenger?.gender || '', 30),
                roleProfile: 'bush_pickup_guest_v1',
                taskDomain: 'bush_pickup_return'
            };
            const name = passenger.name || 'der Gast';
            const role = passenger.role || 'Rückkehrgast';
            const stay = displayText(memory.stayOrWorkSummary || `${name} hat den Termin am Zielstrip abgeschlossen und wartet mit Notizen und leichter Ausrüstung am Wartepunkt.`);
            const whyNow = displayText(memory.whyNowReturn || 'Die Ergebnisse sollen zurück zur Basis, damit das Team den nächsten Schritt planen kann.');
            const returnReason = displayText(memory.returnReason || 'Rückkehr zur Basis für Debriefing und Übergabe der Unterlagen.');
            const exactWhere = `am vereinbarten Wartepunkt am Striprand bei ${targetName}`;
            if (acceptanceMode === 'onsite_to_home' || effectiveProfileId === 'bush_charter_strip') {
                const sourceLabel = displayText(req.sourceLabel || 'Bush-Flug');
                return {
                    schema: 'ga.followup.pipelineContext.v1',
                    requestId: req.id || null,
                    sourceKind: req.sourceKind || null,
                    followUpKind,
                    effectiveProfileId,
                    acceptanceMode,
                    sourceLabel: req.sourceLabel || '',
                    followUpLabel: req.followUpLabel || '',
                    pilotStartPolicy: acceptanceMode,
                    route: {
                        departureName,
                        homeName,
                        targetName,
                        startRef: acceptance?.startRef || null,
                        returnHomeRef: acceptance?.returnHomeRef || null,
                        targetRef: acceptance?.targetRef || null
                    },
                    sourceMission: {
                        title: displayText(req.source?.title || ''),
                        story: sourceStory
                    },
                    temporalContext,
                    lockedPassenger: {
                        ...passenger,
                        roleProfile: 'bush_charter_guest_v1',
                        taskDomain: 'charter'
                    },
                    storyFrame: {
                        trigger: `${name} ist nach dem Aufenthalt am ${targetName} schon bei dir am Strip; jetzt geht es als Anschluss-Charter zurück nach ${homeName}.`,
                        focusSubject: `${name}, ${role}, Rückflug nach dem abgeschlossenen Aufenthalt am Zielstrip`,
                        keyQuestion: `Was ${name} zwischen Hinflug und Rückflug erlebt oder erledigt hat und warum der direkte Rücktransport nach ${homeName} jetzt sinnvoll ist.`,
                        stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen ${sourceLabel}-Hinflug an.`,
                        completionSignal: `Nach der Landung in ${homeName} werden Rückbericht, Notizen und persönliche Ausrüstung übergeben.`,
                        subjectDetail: `${name}, ${role}, ist mit gepackten Sachen bereits am Flugzeug am ${targetName}.`,
                        incidentContext: stay,
                        temporalHint,
                        whyNow,
                        soughtOutcome: `${name} am aktuellen Standort aufnehmen und als normalen Charter-Rückflug von ${departureName} nach ${homeName} bringen.`
                    },
                    missionVarietyBrief: {
                        purpose: 'Follow-up als Vor-Ort-Rückflug: Der Pilot ist schon beim Gast, deshalb ist es kein Pickup-Return, sondern ein normaler Bush-Charter zurück zur Basis.',
                        recipe: `Start am bekannten Zielstrip ${targetName}, ${name} ist dort bereits bereit, Charter-Rückflug nach ${homeName}; Briefing und Voice erzählen die Zeit zwischen den beiden Flügen persönlich und glaubwürdig.`,
                        coreQuestions: [
                            `Was hat ${name} seit dem Hinflug am ${targetName} erlebt, erledigt oder herausgefunden?`,
                            `Welche persönlichen Details, Notizen, Fotos oder Ausrüstung bringt ${name} zurück?`,
                            `Warum ist die Rückkehr nach ${homeName} jetzt der logische nächste Schritt?`,
                            'Wie bleibt es ein normaler Charter-Rückflug ohne Pickup-Phase?'
                        ],
                        candidateShortlist: [{
                            id: 'followup_onsite_charter_return',
                            roleIdeas: [role],
                            taskIdeas: [stay, whyNow],
                            objectIdeas: ['Notizen', 'persönliches Gepäck', displayText(memory.sourceCargoText || 'leichte Ausrüstung')],
                            returnDrivers: [returnReason],
                            accessReasons: [`${targetName} ist der Ort, an dem der erste Leg geendet hat.`]
                        }],
                        writerExpectations: [
                            `Nutze exakt denselben Gast: ${name}, ${role}.`,
                            'Keine Pickup-Return-Logik beschreiben; der Gast ist am Start bereits vor Ort.',
                            temporalHint ? 'Nutze die Aufenthaltsdauer als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                            'Das Briefing ist ein Dispatcher-Auftrag für den Piloten und soll natürlich klingen.',
                            'Normale deutsche Umlaute verwenden.'
                        ].filter(Boolean)
                    }
                };
            }
            return {
                schema: 'ga.followup.pipelineContext.v1',
                requestId: req.id || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                effectiveProfileId,
                acceptanceMode,
                sourceLabel: req.sourceLabel || '',
                followUpLabel: req.followUpLabel || '',
                pilotStartPolicy: acceptanceMode,
                route: {
                    departureName,
                    homeName,
                    targetName,
                    startRef: acceptance?.startRef || null,
                    returnHomeRef: acceptance?.returnHomeRef || null,
                    targetRef: acceptance?.targetRef || null
                },
                sourceMission: {
                    title: displayText(req.source?.title || ''),
                    story: sourceStory
                },
                temporalContext,
                lockedPassenger: passenger,
                storyFrame: {
                    trigger: `${name} meldet sich nach dem abgeschlossenen Aufenthalt am ${targetName} für den Rückflug.`,
                    focusSubject: `${name}, ${role}, Rückholung nach erledigter Arbeit am Zielstrip`,
                    keyQuestion: `Was ${name} am ${targetName} erledigt hat, warum die Rückholung jetzt passt und welcher Handoff in ${homeName} folgt.`,
                    stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen ${sourceLabel}-Hinflug an.`,
                    completionSignal: `Nach der Rückkehr nach ${homeName} werden Rückbericht, Notizen und mitgeführte Ausrüstung übergeben.`,
                    subjectDetail: `${name}, ${role}, wartet ${exactWhere} mit Notizen und persönlichem Gepäck.`,
                    incidentContext: stay,
                    temporalHint,
                    whyNow,
                    soughtOutcome: `Leer von ${departureName} zum bekannten Strip fliegen, ${name} am Wartepunkt aufnehmen und ${passengerPronoun(passenger)} zurück nach ${homeName} bringen.`
                },
                pickupStory: {
                    personName: name,
                    role,
                    exactWhere,
                    whyThere: stay,
                    returnReason,
                    boardingCue: displayText(memory.pickupGreetingText || `Ich bin am Strip bereit; die Arbeit draußen ist abgeschlossen und die Unterlagen sind gepackt.`),
                    departureCue: `${whyNow} Zurück in ${homeName} kann ich den Bericht direkt übergeben.`
                },
                pickupCreativeBrief: {
                    purpose: adventureSource
                        ? 'Fortsetzung einer bereits geflogenen Bush-Adventure-Mission. Der Folgeauftrag nutzt dieselbe Person und erzählt die Rückholung nach einem persönlichen Backcountry-Aufenthalt.'
                        : 'Fortsetzung einer bereits geflogenen Bush-Charter-Mission. Der Folgeauftrag nutzt dieselbe Person und erzählt die Rückholung nach dem Aufenthalt vor Ort.',
                    recipe: `Leerflug von ${departureName} nach ${targetName}, ${name} am Strip aufnehmen, Rückflug nach ${homeName}; Briefing und Voice bauen auf dem vorherigen ${sourceLabel}-Hinflug auf.`,
                    coreQuestions: adventureSource ? [
                        `Wie knüpft die Rückholung glaubwürdig an den vorherigen Adventure-Hop von ${name} an?`,
                        `Was hat ${name} am ${targetName} persönlich erlebt, gesehen oder geschafft?`,
                        `Warum wartet ${name} jetzt genau am Striprand von ${targetName}?`,
                        `Welche Fotos, Notizen, Ausrüstung oder kleine Erinnerung kommen mit zurück nach ${homeName}?`
                    ] : [
                        `Wie knüpft die Rückholung glaubwürdig an den vorherigen Charter-Dropoff von ${name} an?`,
                        `Was hat ${name} am Zielstrip konkret erledigt?`,
                        `Warum wartet ${name} jetzt genau am Striprand von ${targetName}?`,
                        `Was wird nach der Rückkehr in ${homeName} mit Notizen, Bericht oder Ausrüstung gemacht?`
                    ],
                    candidateShortlist: [{
                        id: adventureSource ? 'followup_original_adventure_guest' : 'followup_original_charter_guest',
                        roleIdeas: [role],
                        taskIdeas: [stay, whyNow],
                        objectIdeas: ['Notizen', 'persönliches Gepäck', displayText(memory.sourceCargoText || 'leichte Ausrüstung')],
                        returnDrivers: [returnReason],
                        accessReasons: [`${targetName} ist der bekannte Treffpunkt aus dem ersten Leg.`]
                    }],
                    writerExpectations: [
                        `Nutze exakt denselben Gast: ${name}, ${role}.`,
                        temporalHint ? 'Nutze die Aufenthaltsdauer als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                        'Das Briefing ist ein Dispatch-Briefing für den Piloten, keine Ich-Erzählung des Gasts.',
                        adventureSource ? 'Adventure-Follow-ups dürfen persönlicher, sinnlicher und erlebnisorientierter sein, aber nicht plötzlich wie ein beruflicher Charter oder Notfall klingen.' : '',
                        'Keine Formular- oder Instruction-Sprache. Die Fortsetzung soll wie ein echter Folgeauftrag wirken.',
                        'Normale deutsche Umlaute verwenden.'
                    ].filter(Boolean)
                }
            };
        }
        if (followUpKind === 'bush_charter_strip') {
            const technicianPlan = req.technicianPlan || memory.technicianPlan || {};
            const serviceRun = buildServiceRunCargo({ serviceRun: req.serviceRun || memory.serviceRun }, acceptance?.targetRef || req.route?.targetRef);
            const passenger = {
                ...(req.passenger || technicianPlan.passenger || {}),
                name: cleanText(req.passenger?.name || technicianPlan.passenger?.name || 'Service-Techniker', 80),
                role: cleanText(req.passenger?.role || technicianPlan.passenger?.role || 'Instandhaltungstechniker', 120),
                gender: cleanText(req.passenger?.gender || technicianPlan.passenger?.gender || '', 30),
                roleProfile: 'bush_charter_guest_v1',
                taskDomain: 'charter'
            };
            const name = passenger.name || 'der Techniker';
            const role = passenger.role || 'Instandhaltungstechniker';
            const kit = displayText(req.technicianPlan?.kitLabel || technicianPlan.kitLabel || req.serviceRun?.label || serviceRun.label || `Techniker-Kit ${targetName}`);
            const observedIssue = displayText(req.reconOutcome?.resultText || technicianPlan.observedIssue || serviceRun.observedIssue || `Der Recon über ${targetName} hat einen Befund ergeben, der am Boden geprüft werden muss.`);
            const serviceTask = displayText(technicianPlan.serviceTask || serviceRun.serviceTask || 'Der Befund soll am Strip geprüft, markiert und für die Basis bewertet werden.');
            const whyNow = displayText(memory.whyNowReturn || req.reconOutcome?.resultText || `Aus dem Recon-Befund ist ein kurzer Techniker-Dropoff entstanden. ${serviceRun.reason || ''}`);
            const departureNote = acceptanceMode === 'pickup_from_third_place'
                ? `Start ist ${departureName}; ${name} und ${kit} sind dort für den Weiterflug zum Zielstrip bereit.`
                : `Start ist ${departureName}; ${name} steigt dort mit ${kit} ein.`;
            return {
                schema: 'ga.followup.pipelineContext.v1',
                requestId: req.id || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                effectiveProfileId,
                acceptanceMode,
                sourceLabel: req.sourceLabel || '',
                followUpLabel: req.followUpLabel || '',
                pilotStartPolicy: acceptanceMode,
                route: {
                    departureName,
                    homeName,
                    targetName,
                    startRef: acceptance?.startRef || null,
                    returnHomeRef: acceptance?.returnHomeRef || null,
                    targetRef: acceptance?.targetRef || null
                },
                sourceMission: {
                    title: displayText(req.source?.title || ''),
                    story: sourceStory
                },
                temporalContext,
                reconOutcome: req.reconOutcome || memory.reconOutcome || null,
                serviceRun,
                technicianPlan,
                lockedPassenger: passenger,
                storyFrame: {
                    trigger: `Beim letzten Bush Recon über ${targetName} wurde ein Befund gemeldet; jetzt soll ${name}, ${role}, mit ${kit} zum Strip.`,
                    focusSubject: `${name}, ${role}, Techniker-Dropoff am ${targetName}`,
                    keyQuestion: `Welcher Recon-Befund am ${targetName} am Boden geprüft werden muss und warum dafür eine Person statt nur ein Paket rausgeht.`,
                    stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen Bush Recon an.`,
                    completionSignal: `Nach der Landung am ${targetName} bleibt ${name} vor Ort, prüft den Befund und meldet später die Rückholung an.`,
                    subjectDetail: `${observedIssue} ${serviceTask}`,
                    incidentContext: memory.stayOrWorkSummary || observedIssue,
                    temporalHint,
                    whyNow,
                    soughtOutcome: `${departureNote} Danach nach ${targetName} fliegen, ${name} am Strip absetzen und das Techniker-Kit übergeben.`
                },
                missionVarietyBrief: {
                    purpose: 'Fortsetzung eines Bush-Recon-Flugs. Der erste Auftrag war ein Luft-Recon ohne geplante Landung; der Follow-up ist ein normaler Bush-Charter/Techniker-Dropoff mit Landung am Zielstrip.',
                    recipe: `${departureNote} Flug nach ${targetName}, landen, ${name} und ${kit} am Strip absetzen; kein Pickup und keine Rückholfracht in diesem Leg.`,
                    coreQuestions: [
                        `Welcher konkrete Befund aus dem Recon über ${targetName} macht eine Bodenprüfung nötig?`,
                        `Was bringt ${name} mit ${kit} für die Arbeit am Strip mit?`,
                        `Was soll ${name} nach der Landung prüfen oder markieren?`,
                        'Wie bleibt der Auftrag ein normaler Charter-Dropoff ohne Pickup- oder Rückflug-zur-Basis-Logik?'
                    ],
                    candidateShortlist: [{
                        id: 'followup_recon_technician_dropoff',
                        roleIdeas: [role],
                        taskIdeas: [observedIssue, serviceTask],
                        objectIdeas: [kit, technicianPlan.kitItems || serviceRun.kitItems || 'Techniker-Kit'],
                        returnDrivers: [serviceRun.reason || whyNow],
                        accessReasons: [`${targetName} ist der Strip, der im Recon geprüft wurde.`]
                    }],
                    writerExpectations: [
                        `Nutze exakt die Person ${name}, ${role}.`,
                        'Nutze den Recon-Befund als Ursache, nicht eine neue Zufallsstory.',
                        'Es ist ein normaler Charter-/Techniker-Dropoff mit Landung und Absetzen am Zielstrip.',
                        'Keine Pickup-, Rückholfracht- oder Rückflug-zur-Basis-Logik beschreiben.',
                        'Der Techniker kann später abgeholt werden, aber diese Mission endet mit dem Dropoff.',
                        temporalHint ? 'Nutze die Auswertungszeit als natürliche Vorbereitung, nicht als Systemangabe.' : '',
                        'Normale deutsche Umlaute verwenden.'
                    ].filter(Boolean)
                }
            };
        }
        if (followUpKind === 'bush_supply_strip') {
            const serviceRun = buildServiceRunCargo({ serviceRun: req.serviceRun || memory.serviceRun }, acceptance?.targetRef || req.route?.targetRef);
            const serviceCargo = displayText(serviceRun.label || `Servicepaket ${targetName}`);
            const observedIssue = displayText(serviceRun.observedIssue || memory.serviceTask || `Der Recon über ${targetName} hat einen klar begrenzten Servicebedarf ergeben.`);
            const serviceTask = displayText(serviceRun.serviceTask || memory.serviceTask || 'Der Platzkontakt soll den Befund am Boden prüfen, markieren und der Basis eine kurze Rückmeldung geben.');
            const serviceHandoff = displayText(serviceRun.handoff || memory.serviceHandoff || `Nach der Landung übernimmt der lokale Kontakt das Servicepaket am Striprand von ${targetName}.`);
            const stay = displayText(memory.stayOrWorkSummary || `Die Basis hat den Recon ausgewertet: ${observedIssue}`);
            const whyNow = displayText(memory.whyNowReturn || `Aus dem Rückbericht ist ein gezielter kleiner Service Run entstanden. ${serviceRun.reason || 'Der Befund soll am Boden abgeglichen werden, bevor weitere Flüge folgen.'}`);
            const departureNote = acceptanceMode === 'pickup_from_third_place'
                ? `Start ist ${departureName}; das Servicepaket ist dort für den Weiterflug zum Zielstrip bereit.`
                : `Start ist ${departureName}; das Servicepaket wird dort geladen.`;
            return {
                schema: 'ga.followup.pipelineContext.v1',
                requestId: req.id || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                effectiveProfileId,
                acceptanceMode,
                sourceLabel: req.sourceLabel || '',
                followUpLabel: req.followUpLabel || '',
                pilotStartPolicy: acceptanceMode,
                route: {
                    departureName,
                    homeName,
                    targetName,
                    startRef: acceptance?.startRef || null,
                    returnHomeRef: acceptance?.returnHomeRef || null,
                    targetRef: acceptance?.targetRef || null
                },
                sourceMission: {
                    title: displayText(req.source?.title || ''),
                    story: sourceStory
                },
                temporalContext,
                serviceRun,
                storyFrame: {
                    trigger: `Beim letzten Bush Recon über ${targetName} wurde ein begrenzter Servicebedarf gemeldet; jetzt geht ${serviceCargo} raus.`,
                    focusSubject: `${serviceCargo} für den Service am ${targetName}`,
                    keyQuestion: `Welcher Recon-Befund am ${targetName} jetzt am Boden geprüft, markiert oder abgesichert werden muss.`,
                    stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen Bush Recon an.`,
                    completionSignal: `Nach der Landung am ${targetName} wird das Servicepaket am Stripkontakt übergeben und der Recon-Befund abgeglichen.`,
                    subjectDetail: `${observedIssue} ${serviceTask}`,
                    incidentContext: stay,
                    temporalHint,
                    whyNow,
                    soughtOutcome: `${departureNote} Danach nach ${targetName} fliegen, ${serviceCargo} abladen und den Service-Handoff sauber abschließen.`
                },
                missionVarietyBrief: {
                    purpose: 'Fortsetzung eines Bush-Recon-Flugs. Der erste Auftrag war ein Luft-Recon ohne geplante Landung; der Follow-up ist ein normaler Bush Supply-/Service Run mit Landung und Abladen am Zielstrip.',
                    recipe: `${departureNote} Flug nach ${targetName}, landen, ${serviceCargo} ausladen, der Kontakt übernimmt Material und Befundabgleich.`,
                    coreQuestions: [
                        `Welcher konkrete Befund aus dem Recon über ${targetName} löst den Service Run aus?`,
                        `Welche Teile aus ${serviceCargo} werden am Boden gebraucht?`,
                        `Wer übernimmt den Handoff am Strip und was prüft diese Person danach?`,
                        'Wie bleibt der Auftrag ein normaler Supply-/Service Run ohne Pickup- oder Rückholfracht-Logik?'
                    ],
                    candidateShortlist: [{
                        id: 'followup_recon_service_run',
                        roleIdeas: [serviceRun.role || 'Servicekontakt am Strip'],
                        taskIdeas: [observedIssue, serviceTask],
                        objectIdeas: [serviceCargo, serviceRun.kitItems || 'kleines Servicekit'],
                        returnDrivers: [serviceRun.reason || whyNow],
                        accessReasons: [`${targetName} ist der Strip, der im Recon geprüft wurde.`]
                    }],
                    writerExpectations: [
                        'Nutze den Recon-Befund als Ursache, nicht eine neue Zufallsversorgung.',
                        'Es ist ein normaler Supply-/Service-Run mit Landung, Abladen und Handoff am Zielstrip.',
                        'Keine Pickup-, Rückholfracht- oder Rückflug-zur-Basis-Logik beschreiben.',
                        'Der Recon war der vorherige Flug ohne geplante Landung; jetzt folgt Bodenservice.',
                        temporalHint ? 'Nutze die Auswertungszeit als natürliche Vorbereitung, nicht als Systemangabe.' : '',
                        `Der Handoff am Ziel: ${serviceHandoff}`,
                        'Normale deutsche Umlaute verwenden.'
                    ].filter(Boolean)
                }
            };
        }
        if (followUpKind === 'bush_pickup_cargo') {
            const cargo = req.cargoReturn?.label || `Rückholfracht ${targetName}`;
            const stay = displayText(memory.stayOrWorkSummary || 'Die Crew vor Ort hat die Lieferung geprüft und Rückfracht am Strip bereitgelegt.');
            const whyNow = displayText(memory.whyNowReturn || 'Die Rückfracht soll zurück zur Basis, damit Bestand, Belege und Material wieder sauber im Umlauf sind.');
            const cargoTaskIdeas = [
                'die ursprüngliche Lieferung vor Ort zu sortieren',
                'Rückfracht, Belege und leere Behälter für den Heimflug bereitzustellen'
            ];
            const cargoReturnDriver = displayText(req.cargoReturn?.reason || memory.returnReason || `Rücktransport nach ${homeName}`);
            if (acceptanceMode === 'onsite_to_home' || effectiveProfileId === 'bush_supply_strip') {
                return {
                    schema: 'ga.followup.pipelineContext.v1',
                    requestId: req.id || null,
                    sourceKind: req.sourceKind || null,
                    followUpKind,
                    effectiveProfileId,
                    acceptanceMode,
                    sourceLabel: req.sourceLabel || '',
                    followUpLabel: req.followUpLabel || '',
                    pilotStartPolicy: acceptanceMode,
                    route: {
                        departureName,
                        homeName,
                        targetName,
                        startRef: acceptance?.startRef || null,
                        returnHomeRef: acceptance?.returnHomeRef || null,
                        targetRef: acceptance?.targetRef || null
                    },
                    sourceMission: {
                        title: displayText(req.source?.title || ''),
                        story: sourceStory
                    },
                    temporalContext,
                    storyFrame: {
                        trigger: `Du bist schon am ${targetName}; die Rückfracht aus dem Supply Run ist bereit und soll jetzt nach ${homeName}.`,
                        focusSubject: `${cargo} als Rücktransport nach dem abgeschlossenen Supply Run`,
                        keyQuestion: `Welche Rückfracht seit der Lieferung entstanden ist, wer sie vorbereitet hat und was in ${homeName} damit passiert.`,
                        stakes: `${whyNow} Der Rückflug schließt den Versorgungskreislauf ab.`,
                        completionSignal: `Nach der Landung in ${homeName} wird die Rückfracht entladen, geprüft und übergeben.`,
                        subjectDetail: `${cargo} steht am aktuellen Startplatz ${targetName} zur Beladung bereit.`,
                        incidentContext: stay,
                        temporalHint,
                        whyNow,
                        soughtOutcome: `Die bereits bereitliegende Rückfracht am ${targetName} laden und als normalen Supply-Rückflug nach ${homeName} bringen.`
                    },
                    missionVarietyBrief: {
                        purpose: 'Follow-up als Vor-Ort-Cargo-Rückflug: Der Pilot ist bereits bei der Rückfracht, deshalb ist es kein Cargo-Pickup-Return, sondern ein normaler Supply-/Cargo-Flug zurück zur Basis.',
                        recipe: `Start am bekannten Zielstrip ${targetName}, Rückfracht laden, Flug nach ${homeName}, dort ausladen und übergeben.`,
                        coreQuestions: [
                            `Welche Rückfracht aus dem vorherigen Supply Run wartet bei ${targetName}?`,
                            `Was hat die Crew vor Ort mit der ursprünglichen Lieferung gemacht?`,
                            `Warum muss ${cargo} jetzt nach ${homeName}?`,
                            'Wie bleibt es eine normale Cargo-/Supply-Mission ohne Pickup-Phase?'
                        ],
                        candidateShortlist: [{
                            id: 'followup_onsite_supply_return',
                            roleIdeas: [req.cargoReturn?.role || 'Frachtkontakt am Strip'],
                            taskIdeas: cargoTaskIdeas,
                            objectIdeas: [cargo],
                            returnDrivers: [cargoReturnDriver],
                            accessReasons: [`${targetName} ist der Ort, an dem der Supply Run endete.`]
                        }],
                        writerExpectations: [
                            'Keinen Passenger-Pickup und keinen Cargo-Pickup-Return beschreiben.',
                            'Die Fracht ist am Startplatz bereits bereit und wird dort geladen.',
                            temporalHint ? 'Nutze die Wartezeit bis zur Rückfracht als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                            'Das Briefing ist ein natürlicher Folgeauftrag, keine Liste von Systemregeln.',
                            'Normale deutsche Umlaute verwenden.'
                        ].filter(Boolean)
                    }
                };
            }
            return {
                schema: 'ga.followup.pipelineContext.v1',
                requestId: req.id || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                effectiveProfileId,
                acceptanceMode,
                sourceLabel: req.sourceLabel || '',
                followUpLabel: req.followUpLabel || '',
                pilotStartPolicy: acceptanceMode,
                route: {
                    departureName,
                    homeName,
                    targetName,
                    startRef: acceptance?.startRef || null,
                    returnHomeRef: acceptance?.returnHomeRef || null,
                    targetRef: acceptance?.targetRef || null
                },
                sourceMission: {
                    title: displayText(req.source?.title || ''),
                    story: sourceStory
                },
                temporalContext,
                storyFrame: {
                    trigger: `Nach dem Supply Run am ${targetName} liegt jetzt Rückholfracht für den Heimflug bereit.`,
                    focusSubject: `${cargo} und sauberer Rücktransport zur Basis`,
                    keyQuestion: `Welche Rückfracht wartet am Strip, warum sie zurück nach ${homeName} muss und welcher Handoff dort folgt.`,
                    stakes: `${whyNow} Der Folgeflug schließt den Supply-Kreislauf ab.`,
                    completionSignal: `Nach der Rückkehr nach ${homeName} wird die Rückfracht entladen, geprüft und in den nächsten Logistikschritt übergeben.`,
                    subjectDetail: `${cargo} liegt am Wartepunkt am Striprand bei ${targetName}.`,
                    incidentContext: stay,
                    temporalHint,
                    whyNow,
                    soughtOutcome: `Leer von ${departureName} nach ${targetName} fliegen, die Rückholfracht übernehmen und zurück nach ${homeName} bringen.`
                },
                missionVarietyBrief: {
                    purpose: 'Fortsetzung eines Bush-Supply-Runs. Der Folgeauftrag holt Rückfracht ab, die durch die vorherige Lieferung entstanden ist.',
                    recipe: `Leerflug von ${departureName} nach ${targetName}, Rückholfracht aufnehmen, Rückflug nach ${homeName}, dort ausladen und übergeben.`,
                    coreQuestions: [
                        `Welche Rückfracht aus dem Supply Run wartet bei ${targetName}?`,
                        `Wer hat sie vorbereitet und warum muss sie nach ${homeName}?`,
                        'Wie schließt der Rückflug den Versorgungskreislauf glaubwürdig ab?',
                        `Was passiert mit der Fracht nach der Rückkehr in ${homeName}?`
                    ],
                    candidateShortlist: [{
                        id: 'followup_supply_return_cargo',
                        roleIdeas: [req.cargoReturn?.role || 'Frachtkontakt am Strip'],
                        taskIdeas: cargoTaskIdeas,
                        objectIdeas: [cargo],
                        returnDrivers: [cargoReturnDriver],
                        accessReasons: [`${targetName} ist der bekannte Ablade- und Abholpunkt aus dem Supply Run.`]
                    }],
                    writerExpectations: [
                        'Keinen Passagier-Pickup daraus machen; es geht um Rückholfracht.',
                        temporalHint ? 'Nutze die Wartezeit bis zur Rückfracht als natürlichen Story-Fakt, nicht als Systemangabe.' : '',
                        'Das Briefing ist ein natürlicher Folgeauftrag, keine Liste von Systemregeln.',
                        'Normale deutsche Umlaute verwenden.'
                    ].filter(Boolean)
                }
            };
        }
        return null;
    }

    function shouldSkipCompletionSource(source = '') {
        return /preview|pickup|unload-preview/i.test(String(source || ''));
    }

    function maybeCreateFromCompletedMission(candidate = null, cargoOutcome = null, options = {}) {
        const source = String(options.source || cargoOutcome?.source || 'mission-end');
        if (shouldSkipCompletionSource(source)) return { created: false, reason: 'preview-source' };
        const md = getMissionDataFromCandidate(candidate);
        if (!md || typeof md !== 'object') return { created: false, reason: 'missing-mission-data' };
        const chainCfg = (md.followUpContinuation || md.followUpRequestId)
            ? buildAllowedChainConfig(md, cargoOutcome)
            : null;
        if ((md.followUpContinuation || md.followUpRequestId) && !chainCfg) {
            return { created: false, reason: 'followup-mission' };
        }
        let sourceKind = chainCfg?.sourceKind || getProfileId(md);
        let cfg = chainCfg || SOURCE_MAP[sourceKind];
        let infraCfg = null;
        if (!chainCfg && sourceKind === 'inspection_infra' && typeof window.missionInfraBuildFollowupConfigForMission === 'function') {
            try {
                infraCfg = window.missionInfraBuildFollowupConfigForMission(md);
                if (infraCfg) {
                    cfg = {
                        ...infraCfg,
                        sourceLabel: infraCfg.sourceLabel || 'Infrastruktur-Inspektion',
                        followUpLabel: infraCfg.followUpLabel || 'Infra-Folgeflug'
                    };
                }
            } catch (err) {
                console.warn('[FollowUp] Infra follow-up config failed:', err?.message || err);
            }
        }
        if (!cfg && !chainCfg && sourceKind === 'inspection_infra' && typeof window.missionInfraEnsureInspectionOutcome === 'function') {
            let infraOutcome = null;
            try { infraOutcome = window.missionInfraEnsureInspectionOutcome(md); } catch (_) { infraOutcome = null; }
            if (infraOutcome && (!infraOutcome.followUpKind || infraOutcome.followUpKind === 'none')) {
                return { created: false, reason: 'infra-no-followup', sourceKind, outcome: infraOutcome.outcome || infraOutcome.type || null };
            }
        }
        if (!cfg) return { created: false, reason: 'unsupported-source-profile', sourceKind };
        if (cargoOutcome && cargoOutcome.failed === true) return { created: false, reason: 'mission-failed', sourceKind };
        if (md.missionFailed === true || String(md.missionResult || '').toLowerCase() === 'failed') {
            return { created: false, reason: 'mission-failed', sourceKind };
        }
        let reconOutcome = null;
        if (!chainCfg && sourceKind === 'bush_recon_return') {
            reconOutcome = ensureBushReconOutcome(md);
            if (!reconOutcome) return { created: false, reason: 'missing-recon-outcome', sourceKind };
            if (!reconOutcome.followUpKind || reconOutcome.followUpKind === 'none') {
                return { created: false, reason: 'recon-no-followup', sourceKind, outcome: reconOutcome.outcome };
            }
            cfg = {
                ...cfg,
                followUpKind: reconOutcome.followUpKind,
                followUpLabel: reconOutcome.followUpLabel || cfg.followUpLabel,
                reconOutcome,
                serviceRun: reconOutcome.serviceRun || null,
                technicianPlan: reconOutcome.technicianPlan || null,
                passenger: reconOutcome.technicianPlan?.passenger || null,
                chain: reconOutcome.followUpKind === 'bush_charter_strip' ? {
                    schema: 'ga.followup.chain.v1',
                    id: `chain_${stableHash(md.missionId || md.missionKey || [sourceKind, Date.now()].join('|'))}`,
                    rootSourceKind: 'bush_recon_return',
                    parentRequestId: null,
                    step: 'technician_dropoff',
                    previousStep: 'recon',
                    depth: 1,
                    terminal: false
                } : null
            };
        }
        const bush = md.bush || md.missionContract?.bush || null;
        const continuation = md.followUpContinuation && typeof md.followUpContinuation === 'object' ? md.followUpContinuation : null;
        const fallbackHomeRef = normalizeRef({
            kind: 'airport',
            icao: md.start || md.dep || md.departure || md.initialStart || '',
            name: md.startName || md.initialStartName || md.departureName || md.start || '',
            lat: md.initialStartLat ?? md.startLat,
            lon: md.initialStartLon ?? md.startLon,
            elevation: md.startElevation || null
        });
        const fallbackTargetRef = normalizeRef({
            kind: 'airport',
            icao: md.initialDest || md.dest || md.arrival || '',
            name: md.initialTargetName || md.targetName || md.destName || md.initialDest || md.dest || '',
            lat: md.initialTargetLat ?? md.targetLat,
            lon: md.initialTargetLon ?? md.targetLon,
            elevation: md.targetElevation || null
        });
        const homeRef = normalizeRef(chainCfg?.homeRef || cfg.homeRef || continuation?.returnHomeRef || continuation?.acceptance?.returnHomeRef || bush?.homeRef || fallbackHomeRef);
        const targetRef = normalizeRef(chainCfg?.targetRef || cfg.targetRef || continuation?.targetRef || continuation?.acceptance?.targetRef || bush?.targetRef || fallbackTargetRef);
        if (!homeRef || !targetRef) return { created: false, reason: 'missing-route-refs', sourceKind };
        if (!targetRef.icao && targetRef.kind !== 'poi') return { created: false, reason: 'missing-target-icao', sourceKind };
        if (!homeRef.icao) return { created: false, reason: 'missing-home-icao', sourceKind };

        const sourceMissionId = cleanText(md.missionId || '', 120);
        const sourceMissionKey = cleanText(md.missionKey || [sourceKind, homeRef.icao, targetRef.icao, md.mission].filter(Boolean).join('|'), 220);
        const chainKey = cfg.chain?.id || cfg.chain?.step || '';
        const dedupeKey = `${sourceMissionId || sourceMissionKey}|${cfg.followUpKind}${chainKey ? `|${chainKey}|${cfg.chain?.step || ''}` : ''}`;
        const id = `fup_${stableHash(dedupeKey)}`;
        const existing = getRequests().find(req => req.id === id || req.dedupeKey === dedupeKey);
        if (existing) return { created: false, reason: 'duplicate', id, sourceKind };

        const passenger = cfg.passenger || (PASSENGER_PICKUP_SOURCE_KINDS.has(sourceKind) ? extractPassenger(md, sourceKind) : null);
        const prospect = infraCfg
            ? (typeof window.missionInfraBuildProspectForMission === 'function'
                ? window.missionInfraBuildProspectForMission(md)
                : null)
            : (chainCfg ? null : buildProspectForMission({ ...md, passenger }, { sourceKind }));
        const temporalContext = cfg.temporalContext
            || prospect?.temporalContext
            || missionTemporalContext({ ...md, passenger }, sourceKind);
        const now = nowMs();
        const eligibleAt = Number(temporalContext?.followUpEligibleAt || prospect?.eligibleAt || 0) > 0
            ? Number(temporalContext?.followUpEligibleAt || prospect?.eligibleAt)
            : nextLocalMorningAt(8);
        const memory = cfg.narrativeMemory || buildNarrativeMemory(sourceKind, { ...md, missionTemporalContext: temporalContext }, passenger, homeRef, targetRef);
        const serviceRun = cfg.serviceRun
            || (cfg.followUpKind === 'bush_supply_strip' && sourceKind === 'bush_recon_return'
                ? buildServiceRunCargo(memory, targetRef)
                : null);
        const technicianPlan = cfg.technicianPlan || memory.technicianPlan || null;
        const req = {
            schema: SCHEMA,
            id,
            dedupeKey,
            status: 'pending',
            sourceMissionId,
            sourceMissionKey,
            sourceKind,
            followUpKind: cfg.followUpKind,
            sourceLabel: cfg.sourceLabel,
            followUpLabel: cfg.followUpLabel,
            followUpProfileId: cfg.followUpProfileId || null,
            followUpCategory: cfg.followUpCategory || targetRef.category || null,
            poiFollowUp: cfg.poiFollowUp === true || targetRef.kind === 'poi' || /^infra_/.test(String(cfg.followUpKind || '')),
            chain: cfg.chain || null,
            reconOutcome,
            infraInspectionOutcome: cfg.infraInspectionOutcome || prospect?.infraInspectionOutcome || null,
            createdAt: now,
            updatedAt: now,
            eligibleAt,
            expiresAt: addDays(eligibleAt, EXPIRE_DAYS),
            temporalContext,
            stayDays: temporalContext?.stayDays || null,
            stayText: temporalContext?.stayText || '',
            deboardingHint: temporalContext?.deboardingHint || '',
            pilotStartPolicy: 'original_home',
            source: {
                title: cleanText(md.mission || document.getElementById('mTitle')?.innerText || cfg.sourceLabel, 180),
                story: sourceStoryText(md),
                completedAt: now,
                outcomeSource: source
            },
            route: {
                homeRef,
                targetRef,
                distanceNm: Number.isFinite(Number(md.initialDist || md.dist)) ? Number(md.initialDist || md.dist) : null
            },
            passenger,
            cargoReturn: cfg.followUpKind === 'bush_pickup_cargo' ? buildCargoReturn(memory, targetRef) : null,
            serviceRun,
            technicianPlan,
            narrativeMemory: {
                ...memory,
                serviceRun: serviceRun || memory.serviceRun || null,
                technicianPlan: technicianPlan || memory.technicianPlan || null,
                reconOutcome: reconOutcome || memory.reconOutcome || null,
                infraInspectionOutcome: cfg.infraInspectionOutcome || prospect?.infraInspectionOutcome || memory.infraInspectionOutcome || null,
                temporalContext,
                stayDays: temporalContext?.stayDays || memory.stayDays || null,
                stayText: temporalContext?.stayText || memory.stayText || '',
                deboardingHint: temporalContext?.deboardingHint || memory.deboardingHint || ''
            },
            ui: {
                title: `${cfg.followUpLabel}: ${targetRef.name || targetRef.icao}`,
                subtitle: `Fortsetzung von ${cfg.sourceLabel}`,
                previewText: cfg.poiFollowUp
                    ? `${cfg.infraInspectionOutcome?.resultText || cfg.narrativeMemory?.sourceOutcomeText || 'Der Inspektionsbefund wird als POI-Folgeflug weiterbearbeitet.'}`
                    : (cfg.followUpKind === 'bush_pickup_strip'
                    ? `${passenger?.name || 'Der Gast'} meldet sich vom Strip zur Rückholung.`
                    : (cfg.followUpKind === 'apt_charter_pickup'
                        ? `${passenger?.name || 'Der Chartergast'} meldet sich vom Zielplatz zur Rückholung.`
                        : (cfg.followUpKind === 'bush_supply_strip'
                        ? `${serviceRun?.observedIssue || 'Die Basis plant aus dem Recon-Befund einen Service Run.'}`
                        : (cfg.followUpKind === 'bush_charter_strip'
                            ? `${technicianPlan?.passenger?.name || passenger?.name || 'Der Techniker'} soll den Recon-Befund am Strip prüfen.`
                            : `Am Strip wartet Rückfracht aus dem Supply Run.`))))
            }
        };
        writeRequests([...getRequests(), req], { cloud: true });
        rememberLastLandingRef(targetRef.kind === 'poi' ? homeRef : targetRef, { source, missionId: sourceMissionId });
        console.info('[FollowUp] Anfrage geplant', { id, sourceKind, followUpKind: cfg.followUpKind, eligibleAt, stayDays: temporalContext?.stayDays || null });
        return { created: true, id, sourceKind, followUpKind: cfg.followUpKind };
    }

    function duePendingRequests() {
        const now = nowMs();
        return getRequests().filter(req => getStatus(req) === 'pending' && Number(req.eligibleAt || 0) <= now && (!req.expiresAt || now <= Number(req.expiresAt)));
    }

    function futurePendingRequests() {
        const now = nowMs();
        return getRequests().filter(req => getStatus(req) === 'pending' && Number(req.eligibleAt || 0) > now);
    }

    function render() {
        const root = document.getElementById('followupRequestBanner');
        if (!root) return;
        const due = duePendingRequests();
        if (!due.length) {
            root.hidden = true;
            root.innerHTML = '';
            return;
        }
        root.hidden = false;
        const bucket = new Date().toISOString().slice(0, 10);
        const hasUnannounced = due.some(req => req.announcedBucket !== bucket);
        root.classList.toggle('is-new', hasUnannounced);
        root.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'followup-banner-header';
        const title = document.createElement('div');
        title.className = 'followup-banner-title';
        title.textContent = due.length === 1 ? 'Neue Folgeanfrage' : `${due.length} offene Folgeanfragen`;
        const laterBtn = document.createElement('button');
        laterBtn.type = 'button';
        laterBtn.className = 'followup-banner-later';
        laterBtn.textContent = 'Später';
        laterBtn.title = 'Hinweis für heute ausblenden, Anfrage bleibt in der Liste';
        laterBtn.addEventListener('click', () => markAnnounced(due.map(req => req.id)));
        header.append(title, laterBtn);
        root.appendChild(header);
        const list = document.createElement('div');
        list.className = 'followup-request-list';
        due.forEach(req => list.appendChild(renderRequestItem(req)));
        root.appendChild(list);
    }

    function renderRequestItem(req) {
        const item = document.createElement('div');
        item.className = 'followup-request-item';
        const text = document.createElement('div');
        text.className = 'followup-request-text';
        const title = document.createElement('div');
        title.className = 'followup-request-item-title';
        title.textContent = req.ui?.title || req.followUpLabel || 'Folgeanfrage';
        const sub = document.createElement('div');
        sub.className = 'followup-request-item-subtitle';
        sub.textContent = `${req.ui?.subtitle || req.sourceLabel || 'Mission'} · bis ${formatLocal(req.expiresAt)}`;
        const preview = document.createElement('div');
        preview.className = 'followup-request-preview';
        preview.textContent = req.ui?.previewText || req.narrativeMemory?.whyNowReturn || '';
        text.append(title, sub, preview);
        const actions = document.createElement('div');
        actions.className = 'followup-request-actions';
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'followup-request-action accept';
        accept.textContent = '✓';
        accept.title = 'Folgemission annehmen';
        accept.disabled = acceptingIds.has(req.id);
        accept.addEventListener('click', () => acceptRequest(req.id));
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'followup-request-action dismiss';
        dismiss.textContent = '×';
        dismiss.title = 'Anfrage löschen';
        dismiss.addEventListener('click', () => dismissRequest(req.id));
        actions.append(accept, dismiss);
        item.append(text, actions);
        return item;
    }

    function markAnnounced(ids = []) {
        const bucket = new Date().toISOString().slice(0, 10);
        const idSet = new Set(ids);
        saveMutated(list => list.map(req => (
            idSet.has(req.id)
                ? { ...req, announcedBucket: bucket, lastDeferredAt: nowMs(), updatedAt: nowMs() }
                : req
        )), { cloud: true });
    }

    function dismissRequest(id) {
        const now = nowMs();
        saveMutated(list => list.map(req => (
            req.id === id
                ? { ...req, status: 'dismissed', dismissedAt: now, updatedAt: now }
                : req
        )), { cloud: true });
    }

    async function acceptRequest(id) {
        if (acceptingIds.has(id)) return false;
        const req = getRequests().find(item => item.id === id);
        if (!req || getStatus(req) !== 'pending') return false;
        if (!duePendingRequests().some(item => item.id === id)) {
            alert('Diese Folgeanfrage ist noch nicht fällig.');
            return false;
        }
        if (typeof window.confirmMissionOverwriteIfNeeded === 'function' && !window.confirmMissionOverwriteIfNeeded()) {
            return false;
        }
        const home = airportFromRef(req.route?.homeRef);
        const rawTargetRef = normalizeRef(req.route?.targetRef);
        const isPoiFollowup = !!(req.poiFollowUp || rawTargetRef?.kind === 'poi' || /^infra_/.test(String(req.followUpKind || '')));
        const target = isPoiFollowup ? rawTargetRef : airportFromRef(req.route?.targetRef);
        if (!home?.icao || (!isPoiFollowup && !target?.icao) || (isPoiFollowup && !target)) {
            alert('Folgeanfrage unvollständig: Start oder Ziel fehlt.');
            return false;
        }
        const startRef = await promptAcceptanceStartRef(req);
        if (!startRef) return false;
        const acceptance = buildAcceptance(req, startRef);
        if (!acceptance) {
            alert('Folgeanfrage konnte nicht vorbereitet werden.');
            return false;
        }
        const start = airportFromRef(acceptance.startRef);
        const acceptedDestRef = normalizeRef(acceptanceDestRef(acceptance));
        const dest = isPoiFollowup ? acceptedDestRef : airportFromRef(acceptedDestRef);
        if (!start?.icao || (!isPoiFollowup && !dest?.icao) || (isPoiFollowup && !dest)) {
            alert('Folgeanfrage unvollständig: Start oder Ziel fehlt.');
            return false;
        }
        const startEl = document.getElementById('startLoc');
        const destEl = document.getElementById('destLoc');
        const typeEl = document.getElementById('targetType');
        const pickerValue = pickerValueForProfile(acceptance.dispatchProfileId || req.followUpKind, req);
        if (startEl) startEl.value = start.icao;
        if (destEl) destEl.value = isPoiFollowup ? '' : dest.icao;
        if (typeEl) {
            typeEl.value = pickerValue;
            try { localStorage.setItem('ga_target_type', pickerValue); } catch (_) {}
            if (typeof window.setMissionTypeSelection === 'function') {
                try { window.setMissionTypeSelection(pickerValue); } catch (_) {}
            }
        }
        if (typeof window.syncToNavCom === 'function') {
            try { window.syncToNavCom('startLocRadio', start.icao); } catch (_) {}
            if (!isPoiFollowup) {
                try { window.syncToNavCom('destLocRadio', dest.icao); } catch (_) {}
            }
            try { window.syncToNavCom('targetTypeRadio', pickerValue); } catch (_) {}
        }
        if (typeof window.generateMission !== 'function') {
            alert('Dispatcher ist noch nicht bereit.');
            return false;
        }
        const acceptedSeed = {
            ...req,
            acceptance,
            pilotStartPolicy: acceptance.mode,
            acceptedStartRef: acceptance.startRef,
            acceptedReturnHomeRef: acceptance.returnHomeRef
        };
        acceptingIds.add(id);
        render();
        const ok = await window.generateMission({ followupSeed: acceptedSeed, skipOverwriteConfirm: true });
        if (!ok) {
            acceptingIds.delete(id);
            render();
        }
        return ok;
    }

    function markAccepted(id, missionData = null) {
        const now = nowMs();
        acceptingIds.delete(id);
        saveMutated(list => list.map(req => (
            req.id === id
                ? {
                    ...req,
                    status: 'accepted',
                    acceptedAt: now,
                    updatedAt: now,
                    acceptedMissionId: missionData?.missionId || null,
                    acceptedMissionKey: missionData?.missionKey || null,
                    acceptance: missionData?.followUpContinuation?.acceptance || req.acceptance || null
                }
                : req
        )), { cloud: true });
    }

    function forceNextReady() {
        const future = futurePendingRequests().sort((a, b) => Number(a.eligibleAt || 0) - Number(b.eligibleAt || 0));
        const target = future[0] || getRequests().find(req => getStatus(req) === 'pending');
        if (!target) return { ok: false, reason: 'no-pending-followup' };
        const now = nowMs();
        saveMutated(list => list.map(req => (
            req.id === target.id
                ? { ...req, eligibleAt: now, debugForcedAt: now, updatedAt: now }
                : req
        )), { cloud: true });
        return { ok: true, id: target.id };
    }

    function getActiveMissionData() {
        try {
            if (typeof currentMissionData !== 'undefined' && currentMissionData) return currentMissionData;
        } catch (_) {}
        return (typeof window !== 'undefined' && window.currentMissionData) ? window.currentMissionData : null;
    }

    function debugCompleteCurrentMission() {
        const md = getActiveMissionData();
        if (!md || typeof md !== 'object') {
            alert('Keine aktuelle Mission vorhanden.');
            return false;
        }
        const sourceKind = getProfileId(md);
        const infraSupported = !!(sourceKind === 'inspection_infra'
            && typeof window.missionInfraBuildFollowupConfigForMission === 'function'
            && window.missionInfraBuildFollowupConfigForMission(md));
        if (!SOURCE_MAP[sourceKind] && !buildAllowedChainConfig(md, null) && !infraSupported) {
            alert('Diese Mission ist kein Follow-up-Auslöser.');
            return false;
        }
        const result = maybeCreateFromCompletedMission(md, {
            status: 'completed',
            failed: false,
            source: 'debug-draft-complete'
        }, { source: 'debug-draft-complete' });
        render();
        updateDebugButton();
        if (result?.created) {
            alert('Debug: Mission als erfolgreich beendet markiert. Follow-up-Anfrage wurde geplant.');
            return true;
        }
        if (result?.reason === 'duplicate') {
            alert('Debug: Für diese Mission existiert bereits eine Follow-up-Anfrage.');
            return false;
        }
        alert(`Debug: Keine Follow-up-Anfrage erzeugt (${result?.reason || 'unbekannt'}).`);
        return false;
    }

    function debugSetReconOutcome(outcome = '') {
        const md = getActiveMissionData();
        if (!md || typeof md !== 'object' || !isBushReconMission(md)) {
            alert('Keine aktive Bush-Recon-Mission vorhanden.');
            return false;
        }
        const normalizedOutcome = normalizeReconOutcomeType(outcome);
        if (!normalizedOutcome) {
            alert('Unbekanntes Recon-Ergebnis.');
            return false;
        }
        const next = ensureBushReconOutcome(md, { outcome: normalizedOutcome, createdAt: nowMs() });
        if (typeof window.saveMissionState === 'function') {
            try { window.saveMissionState(); } catch (_) {}
        }
        if (typeof window.vpRefreshWeatherDebugReport === 'function') {
            try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
        }
        alert(`Debug: Recon-Ergebnis gesetzt: ${next?.label || normalizedOutcome}`);
        return true;
    }

    function buildPickupStory(req, targetName, homeName, options = {}) {
        const p = req.passenger || {};
        const memory = req.narrativeMemory || {};
        const name = p.name || 'der Gast';
        const role = p.role || 'Bush-Teamgast';
        const pronoun = passengerPronoun(p);
        const sourceLabel = displayText(req.sourceLabel || 'Bush-Flug');
        const departureName = displayText(options.departureName || homeName);
        return [
            `Folgeauftrag aus dem letzten ${sourceLabel}: ${name}, ${role}, wartet wieder am Strip bei ${targetName}.`,
            `${memory.stayOrWorkSummary || 'Der Aufenthalt vor Ort ist abgeschlossen, die Ausrüstung ist geordnet und der lokale Kontakt hat den Rückflug freigegeben.'}`,
            `${memory.whyNowReturn || 'Die Basis braucht den Rückbericht noch heute, bevor das Team die nächsten Schritte plant.'}`,
            `Du startest in ${departureName}, fliegst leer zum bekannten Strip, nimmst ${name} am vereinbarten Treffpunkt auf und bringst ${pronoun} mit Notizen, Gepäck und Lagebild zurück nach ${homeName}.`,
            `${memory.teamContinuity || 'Dass du den ersten Leg geflogen bist, macht den Rückflug einfacher: Person, Anflug und Absprachen sind bereits vertraut.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildCargoStory(req, targetName, homeName, options = {}) {
        const memory = req.narrativeMemory || {};
        const cargo = req.cargoReturn?.label || `Rückholfracht ${targetName}`;
        const departureName = displayText(options.departureName || homeName);
        return [
            `Folgeauftrag zum letzten Bush Supply Run: Am Strip bei ${targetName} wartet jetzt die Rückfracht aus der Versorgungslieferung.`,
            `${memory.stayOrWorkSummary || 'Die Crew vor Ort hat die Lieferung verteilt, Material geprüft und die Rücksendung bereitgelegt.'}`,
            `${memory.whyNowReturn || 'Der Platzkontakt möchte die Fracht nicht länger am Rand des Strips stehen lassen.'}`,
            `Du startest in ${departureName}, fliegst leer zum bekannten Zielstrip, übernimmst ${cargo} und bringst alles zurück nach ${homeName}.`,
            `${memory.teamContinuity || 'Der Flug schließt den Versorgungskreislauf sauber ab und gibt dem Team wieder klares Material- und Lagebild.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildServiceStory(req, targetName, homeName, options = {}) {
        const memory = req.narrativeMemory || {};
        const serviceRun = buildServiceRunCargo({ serviceRun: req.serviceRun || memory.serviceRun }, req.route?.targetRef);
        const cargo = serviceRun.label || `Servicepaket ${targetName}`;
        const departureName = displayText(options.departureName || homeName);
        return [
            `Folgeauftrag zum letzten Bush Recon: Beim Überflug von ${targetName} wurde ein Servicebedarf notiert, der jetzt am Boden abgeglichen werden soll.`,
            `${memory.stayOrWorkSummary || serviceRun.observedIssue || 'Die Basis hat den Rückbericht ausgewertet und daraus einen gezielten kleinen Serviceflug gemacht.'}`,
            `${memory.whyNowReturn || serviceRun.reason || 'Der Zielstrip soll vor weiteren Flügen markiert, geprüft oder sauber freigegeben werden.'}`,
            `Du startest in ${departureName}, lädst ${cargo}, fliegst zum bekannten Strip und übergibst das Paket dort an den Servicekontakt.`,
            `${memory.serviceHandoff || serviceRun.handoff || 'Nach der Landung werden Paket und Recon-Befund am Striprand abgeglichen; damit ist der Service Run am Ziel abgeschlossen.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildTechnicianDropoffStory(req, targetName, homeName, options = {}) {
        const memory = req.narrativeMemory || {};
        const technicianPlan = req.technicianPlan || memory.technicianPlan || {};
        const p = req.passenger || technicianPlan.passenger || {};
        const name = p.name || 'der Techniker';
        const role = p.role || 'Instandhaltungstechniker';
        const serviceRun = buildServiceRunCargo({ serviceRun: req.serviceRun || memory.serviceRun }, req.route?.targetRef);
        const kit = req.technicianPlan?.kitLabel || technicianPlan.kitLabel || req.serviceRun?.label || serviceRun.label || `Techniker-Kit ${targetName}`;
        const departureName = displayText(options.departureName || homeName);
        return [
            `Folgeauftrag zum letzten Bush Recon: Beim Überflug von ${targetName} wurde ein Befund notiert, der eine kurze Prüfung am Boden braucht.`,
            `${memory.stayOrWorkSummary || req.reconOutcome?.resultText || serviceRun.observedIssue || 'Die Basis hat den Rückbericht ausgewertet und daraus einen gezielten Techniker-Dropoff gemacht.'}`,
            `${memory.whyNowReturn || technicianPlan.reason || serviceRun.reason || 'Der Zielstrip soll vor weiteren Flügen geprüft, markiert oder sauber freigegeben werden.'}`,
            `Du startest in ${departureName}, nimmst ${name}, ${role}, mit ${kit} auf, fliegst zum bekannten Strip und setzt ${name} dort für die Bodenarbeit ab.`,
            `${memory.serviceHandoff || `${name} bleibt nach der Landung am Strip, gleicht den Recon-Befund mit der Situation am Boden ab und meldet sich später für die Rückholung.`}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildOnsitePassengerStory(req, targetName, homeName) {
        const p = req.passenger || {};
        const memory = req.narrativeMemory || {};
        const name = p.name || 'der Gast';
        const role = p.role || 'Bush-Teamgast';
        const sourceLabel = displayText(req.sourceLabel || 'Bush-Flug');
        return [
            `Folgeauftrag aus dem letzten ${sourceLabel}: Du bist bereits am Strip bei ${targetName}, und ${name}, ${role}, ist nach dem Aufenthalt dort wieder bereit für den Rückflug.`,
            `${memory.stayOrWorkSummary || 'Der Termin vor Ort ist abgeschlossen, die persönlichen Sachen sind gepackt und der lokale Kontakt hat den Rückflug freigegeben.'}`,
            `${memory.whyNowReturn || 'Die Basis wartet auf Rückbericht, Notizen und die nächsten Absprachen.'}`,
            `Es wird deshalb kein Pickup-Return aufgebaut: ${name} steigt am aktuellen Startplatz ein, und du fliegst den Charter direkt zurück nach ${homeName}.`,
            `${memory.teamContinuity || 'Dass du den ersten Leg schon geflogen bist, macht die Fortsetzung glaubwürdig und vertraut.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildOnsiteCargoStory(req, targetName, homeName) {
        const memory = req.narrativeMemory || {};
        const cargo = req.cargoReturn?.label || `Rückholfracht ${targetName}`;
        return [
            `Folgeauftrag zum letzten Bush Supply Run: Du bist bereits am Strip bei ${targetName}, und die Rückfracht aus der Versorgungslieferung ist dort bereitgelegt.`,
            `${memory.stayOrWorkSummary || 'Die Crew vor Ort hat die Lieferung verteilt, Material geprüft und die Rücksendung für den Rückflug vorbereitet.'}`,
            `${memory.whyNowReturn || 'Die Rückfracht soll zurück zur Basis, damit Bestand, Belege und Material wieder sauber im Umlauf sind.'}`,
            `Es wird deshalb kein Cargo-Pickup-Return aufgebaut: Du lädst ${cargo} am aktuellen Startplatz und fliegst die normale Supply-Rückstrecke nach ${homeName}.`,
            `${memory.teamContinuity || 'Der Flug schließt den Versorgungskreislauf sauber ab.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildAptPickupStory(req, targetName, homeName, options = {}) {
        const memory = req.narrativeMemory || {};
        const p = req.passenger || {};
        const name = p.name || 'der Chartergast';
        const role = p.role || 'Chartergast';
        const departureName = options.departureName || homeName;
        return [
            `Folgeauftrag aus dem letzten APT Charter: ${name}, ${role}, meldet sich nach dem Termin am ${targetName} für den Rückflug.`,
            `${memory.stayOrWorkSummary || 'Der Termin vor Ort ist abgeschlossen, die Unterlagen sind wieder in der Tasche und der lokale Kontakt hat den Abflug abgestimmt.'}`,
            `Du startest in ${departureName}, fliegst zunächst ohne Passagier zum bekannten Zielplatz und nimmst ${name} dort im GA-Bereich auf.`,
            `${memory.whyNowReturn || `Danach geht es zurück nach ${homeName}, wo Rückmeldung, Gepäck und die nächsten Absprachen ankommen sollen.`}`,
            `${memory.teamContinuity || 'Dass du den ersten Leg schon geflogen bist, macht den Rückflug für den Gast und den Dispatcher besonders unkompliziert.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildAptOnsitePassengerStory(req, targetName, homeName) {
        const memory = req.narrativeMemory || {};
        const p = req.passenger || {};
        const name = p.name || 'der Chartergast';
        const role = p.role || 'Chartergast';
        return [
            `Folgeauftrag aus dem letzten APT Charter: Du bist bereits am Zielplatz ${targetName}, und ${name}, ${role}, ist nach dem Termin wieder bereit für den Rückflug.`,
            `${memory.stayOrWorkSummary || 'Der Termin vor Ort ist abgeschlossen, Notizen und persönliches Gepäck sind gepackt und der lokale Kontakt hat den Abflug bestätigt.'}`,
            `${memory.whyNowReturn || `Der Rückflug nach ${homeName} ist jetzt der logische Abschluss des Charter-Auftrags.`}`,
            `Es wird deshalb kein Pickup-Return aufgebaut: ${name} steigt am aktuellen Startplatz ein, und du fliegst den Charter direkt zurück nach ${homeName}.`,
            `${memory.teamContinuity || 'Die Fortsetzung bleibt vertraut, weil Gast, Ablauf und Zielplatz aus dem ersten Flug bekannt sind.'}`
        ].filter(Boolean).map(displayText).join(' ');
    }

    function buildAptCharterPickupSpec(req = null, passenger = null) {
        const acceptance = acceptanceForRequest(req);
        const homeRef = normalizeRef(acceptance?.returnHomeRef || req?.route?.homeRef);
        const targetRef = normalizeRef(acceptance?.targetRef || req?.route?.targetRef);
        if (!homeRef || !targetRef) return null;
        const p = passenger || req?.passenger || {};
        const pickupStory = {
            personName: cleanText(p.name || '', 120),
            role: cleanText(p.role || 'Chartergast', 120),
            exactWhere: `im GA-Bereich von ${targetRef.name || targetRef.icao || 'dem Zielplatz'}`,
            whyThere: cleanText(req?.narrativeMemory?.stayOrWorkSummary || '', 320),
            returnReason: cleanText(req?.narrativeMemory?.returnReason || '', 320),
            boardingCue: cleanText(req?.narrativeMemory?.pickupGreetingText || p.greetingText || '', 320),
            departureCue: cleanText(req?.narrativeMemory?.pickupDepartureCue || req?.narrativeMemory?.whyNowReturn || '', 360)
        };
        const spec = {
            profileId: 'apt_charter_pickup',
            targetMode: 'strip_then_return',
            completionMode: 'return_home',
            requiresReturnHome: true,
            pickupKind: 'passenger',
            pickupLabel: p.name ? `${p.name} (${p.role || 'Chartergast'})` : 'Chartergast',
            pickupRole: p.role || 'Chartergast',
            pickupGreetingText: p.greetingText || req?.narrativeMemory?.pickupGreetingText || '',
            pickupStory,
            pickupPassengerCount: 1,
            homeRef,
            targetRef,
            areaRef: null,
            routeRefs: targetRef ? [targetRef] : [],
            success: {
                minGroundTimeSec: 8,
                minAreaTimeSec: 0,
                minAreaTrackNm: 0,
                cargoMustBeDelivered: false,
                passengerMustDeboard: true,
                waypointsRequired: 0
            },
            allowedEndLocations: ['home'],
            narrativeMode: 'apt_charter_pickup_return',
            riskFlags: ['pickup_required', 'return_leg_required', 'apt_charter_followup'],
            opsNotes: [
                'Outbound bewusst ohne Passagier halten; Chartergast erst am Zielplatz aufnehmen.',
                'Nach dem Pickup zurück zum Ausgangsplatz fliegen und den Ausstieg dort abschließen.'
            ]
        };
        return typeof window.sanitizeBushMissionSpec === 'function'
            ? window.sanitizeBushMissionSpec(spec)
            : spec;
    }

    function applyAcceptanceToBushSpec(req = null, bushSpec = null) {
        if (!bushSpec || typeof bushSpec !== 'object') return bushSpec;
        const acceptance = acceptanceForRequest(req);
        if (!acceptance || String(acceptance.mode || '') !== 'pickup_from_third_place') return bushSpec;
        if (String(bushSpec.targetMode || '').toLowerCase() !== 'strip_then_return') return bushSpec;
        const returnHomeRef = normalizeRef(acceptance.returnHomeRef || req?.route?.homeRef);
        if (!returnHomeRef) return bushSpec;
        const next = {
            ...bushSpec,
            homeRef: returnHomeRef,
            routeRefs: bushSpec.targetRef ? [bushSpec.targetRef] : bushSpec.routeRefs
        };
        return typeof window.sanitizeBushMissionSpec === 'function'
            ? window.sanitizeBushMissionSpec(next)
            : next;
    }

    function buildDispatchMission(req, context = {}) {
        if (!req || typeof req !== 'object') return null;
        const acceptance = acceptanceForRequest(req, context);
        if (!acceptance) return null;
        const start = context.start || airportFromRef(acceptance?.startRef || req.route?.homeRef);
        const dest = context.dest || airportFromRef(acceptanceDestRef(acceptance) || req.route?.targetRef);
        const pickupTarget = airportFromRef(acceptance?.targetRef || req.route?.targetRef);
        const returnHome = airportFromRef(acceptance?.returnHomeRef || req.route?.homeRef);
        if (!start || !dest) return null;
        const followUpKind = String(req.followUpKind || '').toLowerCase();
        const effectiveProfileId = String(acceptance?.dispatchProfileId || followUpKind).toLowerCase();
        const acceptanceMode = String(acceptance?.mode || req.pilotStartPolicy || 'pickup_from_home').toLowerCase();
        const targetName = dest.n || dest.name || dest.icao || 'Remote Strip';
        const pickupTargetName = pickupTarget?.n || pickupTarget?.name || pickupTarget?.icao || targetName;
        const homeName = returnHome?.n || returnHome?.name || returnHome?.icao || dest.n || dest.name || dest.icao || 'Basis';
        const departureName = start.n || start.name || start.icao || homeName;
        const distNm = Number.isFinite(Number(context.totalDist)) ? Number(context.totalDist) : Number(req.route?.distanceNm || 0);
        const memory = req.narrativeMemory || {};
        let passenger = null;
        let paxText = '0 PAX';
        let cargoText = '-';
        let story = '';
        let title = '';
        let bushSpec = null;

        if ((req.poiFollowUp || req.route?.targetRef?.kind === 'poi' || /^infra_/.test(followUpKind)) && typeof window.missionInfraBuildDispatchMission === 'function') {
            try {
                const infraDispatch = window.missionInfraBuildDispatchMission(req, { ...context, acceptance, start, dest, totalDist: distNm });
                if (infraDispatch?.mission) return infraDispatch;
            } catch (err) {
                console.warn('[FollowUp] Infra dispatch mission failed:', err?.message || err);
            }
        }

        if (followUpKind === 'apt_charter_pickup') {
            const p = req.passenger || {};
            passenger = {
                ...p,
                name: p.name || 'Chartergast',
                role: p.role || 'Chartergast',
                roleProfile: 'charter_professional_neutral_v1',
                taskDomain: 'charter',
                greetingText: memory.pickupGreetingText || p.greetingText || '',
                pickupStory: {
                    exactWhere: `Treffpunkt im GA-Bereich von ${pickupTargetName}`,
                    whyThere: memory.stayOrWorkSummary || '',
                    returnReason: memory.returnReason || '',
                    boardingCue: memory.pickupGreetingText || '',
                    departureCue: memory.pickupDepartureCue || memory.whyNowReturn || '',
                    personName: p.name || '',
                    role: p.role || ''
                }
            };
            if (effectiveProfileId === 'apt_charter' || acceptanceMode === 'onsite_to_home') {
                story = buildAptOnsitePassengerStory(req, pickupTargetName, homeName);
                title = `Charter Rückflug: ${homeName}`;
                paxText = passenger.role ? `1 PAX (${passenger.role})` : '1 PAX';
                bushSpec = null;
            } else {
                bushSpec = buildAptCharterPickupSpec(req, passenger);
                bushSpec = applyAcceptanceToBushSpec(req, bushSpec);
                story = buildAptPickupStory(req, pickupTargetName, homeName, { departureName });
                title = `Charter Pickup: ${pickupTargetName}`;
                paxText = `0 PAX am Start · 1 PAX Pickup (${passenger.role})`;
            }
        } else if (followUpKind === 'bush_pickup_strip') {
            const p = req.passenger || {};
            passenger = {
                ...p,
                name: p.name || 'Bush Pickup Gast',
                role: p.role || 'Rückkehrgast',
                roleProfile: effectiveProfileId === 'bush_charter_strip' ? 'bush_charter_guest_v1' : 'bush_pickup_guest_v1',
                taskDomain: effectiveProfileId === 'bush_charter_strip' ? 'charter' : 'bush_pickup_return',
                greetingText: memory.pickupGreetingText || p.greetingText || '',
                pickupStory: {
                    exactWhere: `Treffpunkt am Striprand bei ${pickupTargetName}`,
                    whyThere: memory.outboundPurpose || '',
                    returnReason: memory.returnReason || '',
                    boardingCue: memory.pickupGreetingText || '',
                    departureCue: memory.whyNowReturn || '',
                    personName: p.name || '',
                    role: p.role || ''
                }
            };
            if (effectiveProfileId === 'bush_charter_strip' || acceptanceMode === 'onsite_to_home') {
                bushSpec = typeof window.buildBushMissionSpec === 'function'
                    ? window.buildBushMissionSpec({ profileId: 'bush_charter_strip', startAirport: start, destAirport: dest, distNm, storyHint: memory.outboundPurpose || '' })
                    : null;
                story = buildOnsitePassengerStory(req, pickupTargetName, homeName);
                title = `Bush Charter: ${homeName}`;
                paxText = passenger.role ? `1 PAX (${passenger.role})` : '1 PAX';
            } else {
                bushSpec = typeof window.buildBushMissionSpec === 'function'
                    ? window.buildBushMissionSpec({ profileId: followUpKind, startAirport: start, destAirport: dest, distNm, pickupPassenger: passenger, storyHint: memory.outboundPurpose || '' })
                    : null;
                bushSpec = applyAcceptanceToBushSpec(req, bushSpec);
                story = buildPickupStory(req, pickupTargetName, homeName, { departureName });
                title = `Bush Pickup: ${pickupTargetName}`;
                paxText = `0 PAX am Start · 1 PAX Pickup (${passenger.role})`;
            }
        } else if (followUpKind === 'bush_pickup_cargo') {
            if (effectiveProfileId === 'bush_supply_strip' || acceptanceMode === 'onsite_to_home') {
                bushSpec = typeof window.buildBushMissionSpec === 'function'
                    ? window.buildBushMissionSpec({ profileId: 'bush_supply_strip', startAirport: start, destAirport: dest, distNm, storyHint: memory.outboundPurpose || '' })
                    : null;
                story = buildOnsiteCargoStory(req, pickupTargetName, homeName);
                title = `Backcountry Supply: ${homeName}`;
                paxText = '0 PAX';
                cargoText = req.cargoReturn?.label || `Rückholfracht ${pickupTargetName}`;
            } else {
                bushSpec = typeof window.buildBushMissionSpec === 'function'
                    ? window.buildBushMissionSpec({ profileId: followUpKind, startAirport: start, destAirport: dest, distNm, storyHint: memory.outboundPurpose || '' })
                    : null;
                bushSpec = applyAcceptanceToBushSpec(req, bushSpec);
                if (bushSpec && typeof window.sanitizeBushMissionSpec === 'function') {
                    bushSpec = window.sanitizeBushMissionSpec({
                        ...bushSpec,
                        pickupLabel: req.cargoReturn?.label || bushSpec.pickupLabel,
                        pickupRole: req.cargoReturn?.role || bushSpec.pickupRole || 'Frachtkontakt am Strip'
                    });
                }
                story = buildCargoStory(req, pickupTargetName, homeName, { departureName });
                title = `Bush Cargo Pickup: ${pickupTargetName}`;
                paxText = '0 PAX';
            }
        } else if (followUpKind === 'bush_supply_strip') {
            const serviceRun = buildServiceRunCargo({ serviceRun: req.serviceRun || memory.serviceRun }, acceptance?.targetRef || req.route?.targetRef);
            bushSpec = typeof window.buildBushMissionSpec === 'function'
                ? window.buildBushMissionSpec({ profileId: 'bush_supply_strip', startAirport: start, destAirport: dest, distNm, storyHint: memory.outboundPurpose || serviceRun.observedIssue || '' })
                : null;
            story = buildServiceStory(req, targetName, homeName, { departureName });
            title = `Bush Service Run: ${targetName}`;
            paxText = '0 PAX';
            cargoText = serviceRun.label || `Servicepaket ${targetName}`;
        } else if (followUpKind === 'bush_charter_strip') {
            const technicianPlan = req.technicianPlan || memory.technicianPlan || {};
            const p = req.passenger || technicianPlan.passenger || {};
            passenger = {
                ...p,
                name: p.name || 'Service-Techniker',
                role: p.role || 'Instandhaltungstechniker',
                roleProfile: 'bush_charter_guest_v1',
                taskDomain: 'charter',
                greetingText: p.greetingText || technicianPlan.passenger?.greetingText || ''
            };
            bushSpec = typeof window.buildBushMissionSpec === 'function'
                ? window.buildBushMissionSpec({ profileId: 'bush_charter_strip', startAirport: start, destAirport: dest, distNm, storyHint: memory.outboundPurpose || req.reconOutcome?.resultText || '' })
                : null;
            story = buildTechnicianDropoffStory(req, targetName, homeName, { departureName });
            title = `Bush Technician: ${targetName}`;
            paxText = passenger.role ? `1 PAX (${passenger.role})` : '1 PAX';
            cargoText = req.technicianPlan?.kitLabel
                || technicianPlan.kitLabel
                || req.serviceRun?.label
                || memory.serviceRun?.label
                || `Techniker-Kit ${targetName}`;
        }
        if (!bushSpec && !(followUpKind === 'apt_charter_pickup' && (effectiveProfileId === 'apt_charter' || acceptanceMode === 'onsite_to_home'))) return null;
        const mission = {
            i: effectiveProfileId === 'bush_supply_strip' || followUpKind === 'bush_pickup_cargo' ? '📦' : '🧭',
            t: title,
            s: story,
            cat: followUpKind === 'apt_charter_pickup'
                ? 'charter'
                : (effectiveProfileId === 'bush_supply_strip'
                ? 'bush_supply'
                : (effectiveProfileId === 'bush_charter_strip'
                    ? 'charter'
                    : (followUpKind === 'bush_pickup_cargo' ? 'bush_pickup_cargo' : 'bush_pickup'))),
            passenger,
            missionType: followUpKind === 'apt_charter_pickup' ? 'apt' : 'bush',
            bush: bushSpec,
            pax: paxText,
            cargo: cargoText,
            cargoText,
            followUpRequestId: req.id,
            followUpContinuation: {
                sourceMissionId: req.sourceMissionId || null,
                sourceMissionKey: req.sourceMissionKey || null,
                sourceKind: req.sourceKind || null,
                followUpKind,
                chain: req.chain || null,
                chainStep: req.chain?.step || req.chainStep || null,
                acceptance: acceptance || null,
                narrativeMemory: req.narrativeMemory || null,
                temporalContext: req.temporalContext || req.narrativeMemory?.temporalContext || null
            },
            missionTemporalContext: req.temporalContext || req.narrativeMemory?.temporalContext || null,
            _source: followUpKind === 'apt_charter_pickup' ? 'Follow-up APT Dispatcher' : 'Follow-up Bush Dispatcher',
            _requestedProfile: effectiveProfileId,
            _appliedProfile: effectiveProfileId
        };
        return {
            mission,
            paxText,
            cargoText,
            dataSource: followUpKind === 'apt_charter_pickup' ? 'Follow-up APT Dispatcher' : 'Follow-up Bush Dispatcher'
        };
    }

    function applyFromSync(incoming = []) {
        if (!Array.isArray(incoming)) return getRequests();
        const local = getRequests();
        const byId = new Map();
        [...local, ...incoming].forEach(req => {
            const normalized = normalizeRequest(req);
            if (!normalized) return;
            const prev = byId.get(normalized.id);
            byId.set(normalized.id, chooseRequest(normalized, prev));
        });
        return writeRequests(Array.from(byId.values()), { cloud: false });
    }

    function getForSync() {
        return compactRequests(getRequests()).map(req => {
            if (isTerminalStatus(getStatus(req))) {
                return {
                    schema: SCHEMA,
                    id: req.id,
                    dedupeKey: req.dedupeKey || null,
                    sourceMissionId: req.sourceMissionId || null,
                    sourceMissionKey: req.sourceMissionKey || null,
                    sourceKind: req.sourceKind || null,
                    followUpKind: req.followUpKind || null,
                    status: getStatus(req),
                    createdAt: req.createdAt || 0,
                    updatedAt: req.updatedAt || req.createdAt || 0,
                    acceptedAt: req.acceptedAt || null,
                    dismissedAt: req.dismissedAt || null,
                    expiresAt: req.expiresAt || null
                };
            }
            return req;
        });
    }

    function compactForSync(list = [], cfg = {}) {
        const max = Number.isFinite(Number(cfg.maxFollowUps)) ? Number(cfg.maxFollowUps) : MAX_TOTAL_FOR_SYNC;
        return compactRequests(list).slice(0, max);
    }

    function buildDebugReport() {
        updateDebugButton();
        const lines = [];
        const list = getRequests();
        const now = nowMs();
        const pending = list.filter(req => getStatus(req) === 'pending');
        const due = duePendingRequests();
        const future = futurePendingRequests();
        const lastLanding = getLastLandingRef();
        const activeMd = getActiveMissionData();
        const activeRecon = activeMd && isBushReconMission(activeMd) ? ensureBushReconOutcome(activeMd) : null;
        const activeInfra = activeMd
            && typeof window.missionInfraIsInspectionMission === 'function'
            && window.missionInfraIsInspectionMission(activeMd)
            && typeof window.missionInfraEnsureInspectionOutcome === 'function'
            ? window.missionInfraEnsureInspectionOutcome(activeMd)
            : null;
        lines.push('Follow-up Requests');
        lines.push(`- Pending: ${pending.length} | fällig: ${due.length} | geplant: ${future.length}`);
        lines.push(`- Letzte Landung: ${lastLanding?.icao ? `${lastLanding.icao} (${lastLanding.name || lastLanding.icao})` : '-'}`);
        if (activeRecon) {
            lines.push(`- Aktueller Recon-Ausgang: ${activeRecon.label || activeRecon.outcome} | Folge: ${activeRecon.followUpKind || 'none'} | hidden=${activeRecon.hiddenFromWriter === true ? 'ja' : 'nein'}`);
        }
        if (activeInfra) {
            lines.push(`- Aktueller Infra-Ausgang: ${activeInfra.label || activeInfra.outcome} | Folge: ${activeInfra.followUpKind || 'none'} | hidden=${activeInfra.hiddenFromWriter === true ? 'ja' : 'nein'}`);
        }
        if (!list.length) {
            lines.push('- keine Requests gespeichert');
            return lines.join('\n');
        }
        list.slice(0, 16).forEach(req => {
            const status = getStatus(req);
            const etaMs = Number(req.eligibleAt || 0) - now;
            const eta = status === 'pending'
                ? (etaMs <= 0 ? 'jetzt' : `${Math.ceil(etaMs / 3600000)}h`)
                : '-';
            const stay = req.temporalContext?.stayText || req.stayText || req.narrativeMemory?.stayText || '-';
            lines.push(`- ${req.id} | ${status} | ${req.sourceKind || '-'} -> ${req.followUpKind || '-'} | Zeitraum ${stay} | ab ${formatLocal(req.eligibleAt)} | bis ${formatLocal(req.expiresAt)} | ETA ${eta}`);
        });
        return lines.join('\n');
    }

    function updateDebugButton() {
        const btn = document.getElementById('btnDebugFollowupForce');
        if (!btn) return;
        const future = futurePendingRequests();
        const pending = getRequests().some(req => getStatus(req) === 'pending');
        btn.disabled = !pending;
        btn.textContent = future.length ? 'Follow-up erzeugen' : (pending ? 'Follow-up bereit' : 'Follow-up -');
        btn.title = future.length
            ? 'Nächste geplante Folgeanfrage sofort fällig machen'
            : (pending ? 'Es gibt bereits eine fällige Folgeanfrage' : 'Keine geplante Folgeanfrage vorhanden');
        const completeBtn = document.getElementById('btnDebugFollowupComplete');
        if (completeBtn) {
            const md = getActiveMissionData();
            const sourceKind = getProfileId(md);
            const infraSupported = !!(md
                && sourceKind === 'inspection_infra'
                && typeof window.missionInfraBuildFollowupConfigForMission === 'function'
                && window.missionInfraBuildFollowupConfigForMission(md));
            const supported = !!(md && (SOURCE_MAP[sourceKind] || buildAllowedChainConfig(md, null) || infraSupported));
            completeBtn.disabled = !supported;
            completeBtn.textContent = supported ? 'Mission beenden' : 'Mission beenden -';
            completeBtn.title = supported
                ? 'Aktuelle Draft-/Testmission als erfolgreich beendet markieren und Follow-up planen'
                : 'Aktuelle Mission kann kein Follow-up ausloesen';
        }
    }

    function init() {
        if (initialized) {
            render();
            updateDebugButton();
            return;
        }
        initialized = true;
        writeRequests(getRequests(), { cloud: false });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) writeRequests(getRequests(), { cloud: false });
        });
    }

    window.missionFollowupInit = init;
    window.missionFollowupMaybeCreateFromCompletedMission = maybeCreateFromCompletedMission;
    window.missionFollowupAirportFromRef = airportFromRef;
    window.missionFollowupBuildPipelineContext = buildPipelineContext;
    window.missionFollowupBuildDispatchMission = buildDispatchMission;
    window.missionFollowupBuildProspectForMission = buildProspectForMission;
    window.missionFollowupBuildTemporalContext = buildTemporalContext;
    window.missionFollowupEnsureBushReconOutcome = ensureBushReconOutcome;
    window.missionFollowupDebugSetBushReconOutcome = debugSetReconOutcome;
    window.missionFollowupDebugSetInfraInspectionOutcome = function(outcome = '') {
        if (typeof window.missionInfraDebugSetInspectionOutcome === 'function') {
            return window.missionInfraDebugSetInspectionOutcome(outcome);
        }
        alert('Infra-Outcome-Core ist nicht geladen.');
        return false;
    };
    window.missionFollowupMarkAccepted = markAccepted;
    window.missionFollowupGetForSync = getForSync;
    window.missionFollowupApplyFromSync = applyFromSync;
    window.missionFollowupCompactForSync = compactForSync;
    window.missionFollowupBuildDebugReport = buildDebugReport;
    window.missionFollowupRememberLastLandingRef = rememberLastLandingRef;
    window.missionFollowupDebugForceNext = function() {
        const result = forceNextReady();
        if (!result.ok) {
            alert('Keine geplante Follow-up-Anfrage vorhanden.');
            return false;
        }
        render();
        alert('Nächste Follow-up-Anfrage ist jetzt verfügbar.');
        return true;
    };
    window.missionFollowupDebugCompleteCurrentMission = debugCompleteCurrentMission;
    window.missionFollowupAcceptRequest = acceptRequest;
    window.missionFollowupDismissRequest = dismissRequest;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        setTimeout(init, 0);
    }
})();
