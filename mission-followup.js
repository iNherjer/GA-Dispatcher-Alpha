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
        }
    };
    const PASSENGER_PICKUP_SOURCE_KINDS = new Set(['bush_charter_strip', 'bush_scenic_hopper']);

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

    function nextLocalMorningAt(hour = 8) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(hour, 0, 0, 0);
        return d.getTime();
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
        const sameHome = refsSameAirport(resolvedStartRef, homeRef);
        const sameTarget = refsSameAirport(resolvedStartRef, targetRef);
        const onsite = sameTarget && !sameHome;
        const mode = onsite
            ? 'onsite_to_home'
            : (sameHome ? 'pickup_from_home' : 'pickup_from_third_place');
        const dispatchProfileId = onsite
            ? (followUpKind === 'bush_pickup_cargo' ? 'bush_supply_strip' : 'bush_charter_strip')
            : followUpKind;
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
        if (existing?.mode && existing?.startRef && existing?.targetRef && existing?.returnHomeRef) return existing;
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

    function pickerValueForProfile(profileId = '') {
        const id = String(profileId || '').trim().toLowerCase();
        return id ? `bush:all+${id}` : '';
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
                title: 'Wieder an der Basis',
                text: followupPlaceLabel(homeRef, 'Ursprungsbasis'),
                ref: homeRef
            },
            {
                id: 'target',
                title: 'Noch am Zielstrip',
                text: followupPlaceLabel(targetRef, 'Zielstrip'),
                ref: targetRef
            },
            {
                id: 'other',
                title: 'An einem anderen Platz',
                text: defaultIcao ? `Vorschlag: ${followupPlaceLabel(defaultRef, defaultIcao)}` : 'ICAO eingeben',
                ref: null
            }
        ];

        const defaultMatchesTarget = refsSameAirport(defaultRef, targetRef);
        const defaultMatchesHome = refsSameAirport(defaultRef, homeRef);
        selected = defaultMatchesTarget ? 'target' : (defaultMatchesHome ? 'home' : 'other');
        if (summary) {
            summary.textContent = `Rückkehrbasis: ${followupPlaceLabel(homeRef, 'Basis')} · Anfrageort: ${followupPlaceLabel(targetRef, 'Zielstrip')}`;
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
        return String(
            md?.bush?.profileId
            || md?.missionContract?.bush?.profileId
            || md?.missionContract?.appliedProfileId
            || md?.missionContract?.requestedProfileId
            || md?._appliedProfile
            || md?._requestedProfile
            || ''
        ).trim().toLowerCase();
    }

    function getMissionDataFromCandidate(candidate = null) {
        if (candidate && typeof candidate === 'object' && candidate.currentMissionData) return candidate.currentMissionData;
        return candidate && typeof candidate === 'object' ? candidate : null;
    }

    function extractPassenger(md = null) {
        const candidates = [
            md?.passenger,
            md?.missionContract?.passenger,
            typeof window !== 'undefined' ? window.activePassenger : null
        ];
        const p = candidates.find(item => item && typeof item === 'object') || {};
        return {
            name: cleanText(p.name || '', 80),
            role: cleanText(p.role || 'Bush-Teamgast', 120),
            gender: cleanText(p.gender || '', 30),
            roleProfile: 'bush_pickup_guest_v1',
            taskDomain: 'bush_pickup_return',
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

    function buildNarrativeMemory(sourceKind, md, passenger, homeRef, targetRef) {
        const story = sourceStoryText(md);
        const cargo = cleanText(md?.cargoText || md?.initialCargoText || document.getElementById('mWeight')?.innerText || '', 260);
        const pax = cleanText(md?.paxText || md?.initialPaxText || document.getElementById('mPay')?.innerText || '', 180);
        const targetName = targetRef?.name || targetRef?.icao || 'dem Zielstrip';
        const homeName = homeRef?.name || homeRef?.icao || 'der Basis';
        if (sourceKind === 'bush_charter_strip') {
            const name = passenger?.name || 'der Chartergast';
            const role = passenger?.role || 'Bush-Teamgast';
            return {
                outboundPurpose: story || `${name} wurde als ${role} von ${homeName} nach ${targetName} gebracht.`,
                stayOrWorkSummary: `${name} hat am Zielstrip den geplanten Aufenthalt genutzt: Briefing mit dem lokalen Kontakt, Kontrolle der mitgebrachten Ausrüstung und Abgleich der Lage vor Ort.`,
                whyNowReturn: 'Die Arbeit vor Ort ist abgeschlossen, die Notizen und persönlichen Sachen sind gepackt, und die Basis braucht den Rückbericht.',
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
                outboundPurpose: story || `${name} wurde als ${role} von ${homeName} nach ${targetName} geflogen, um den geplanten Backcountry-Aufenthalt am Zielstrip zu beginnen.`,
                stayOrWorkSummary: `${name} hat die Zeit draußen für den geplanten Adventure-Teil genutzt: den lokalen Treffpunkt erreicht, den Tagesrucksack sortiert, Fotos und Eindrücke gesammelt und den Rückweg zum bekannten Strip mit dem Kontakt abgestimmt.`,
                whyNowReturn: 'Der vereinbarte Wildnisaufenthalt ist beendet, das Wetterfenster passt, und Kamera, Rucksack und persönliche Sachen sind wieder gepackt.',
                returnReason: 'Rückkehr zur Basis mit Fotos, Notizen und der persönlichen Geschichte vom Aufenthalt draußen.',
                teamContinuity: `Der Gast fragt bewusst wieder denselben Piloten an, weil der Strip, der Anflug und die Absprachen aus dem Adventure-Hinflug vertraut sind.`,
                pickupGreetingText: `${name || 'Ich'} bin wieder am Strip. Der Ausflug hat sich gelohnt, der Rucksack ist gepackt, und ich habe einiges vom Aufenthalt zu erzählen.`,
                sourcePaxText: pax,
                sourceCargoText: cargo
            };
        }
        return {
            outboundPurpose: story || `Die Versorgungsladung aus ${homeName} wurde nach ${targetName} gebracht.`,
            stayOrWorkSummary: `Die Crew vor Ort hat die Lieferung sortiert, Verbrauchsmaterial verteilt und die Rückfracht für den Heimflug vorbereitet.`,
            whyNowReturn: 'Der Platzkontakt hat die Rückholfracht freigegeben; sie soll nicht länger am Strip liegen bleiben.',
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

    function buildPipelineContext(req, context = {}) {
        if (!req || typeof req !== 'object') return null;
        const acceptance = acceptanceForRequest(req, context);
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
                            'Das Briefing ist ein Dispatcher-Auftrag für den Piloten und soll natürlich klingen.',
                            'Normale deutsche Umlaute verwenden.'
                        ]
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
                lockedPassenger: passenger,
                storyFrame: {
                    trigger: `${name} meldet sich nach dem abgeschlossenen Aufenthalt am ${targetName} für den Rückflug.`,
                    focusSubject: `${name}, ${role}, Rückholung nach erledigter Arbeit am Zielstrip`,
                    keyQuestion: `Was ${name} am ${targetName} erledigt hat, warum die Rückholung jetzt passt und welcher Handoff in ${homeName} folgt.`,
                    stakes: `${whyNow} Die Fortsetzung knüpft bewusst an den vorherigen ${sourceLabel}-Hinflug an.`,
                    completionSignal: `Nach der Rückkehr nach ${homeName} werden Rückbericht, Notizen und mitgeführte Ausrüstung übergeben.`,
                    subjectDetail: `${name}, ${role}, wartet ${exactWhere} mit Notizen und persönlichem Gepäck.`,
                    incidentContext: stay,
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
                        'Das Briefing ist ein Dispatch-Briefing für den Piloten, keine Ich-Erzählung des Gasts.',
                        adventureSource ? 'Adventure-Follow-ups dürfen persönlicher, sinnlicher und erlebnisorientierter sein, aber nicht plötzlich wie ein beruflicher Charter oder Notfall klingen.' : '',
                        'Keine Formular- oder Instruction-Sprache. Die Fortsetzung soll wie ein echter Folgeauftrag wirken.',
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
                    storyFrame: {
                        trigger: `Du bist schon am ${targetName}; die Rückfracht aus dem Supply Run ist bereit und soll jetzt nach ${homeName}.`,
                        focusSubject: `${cargo} als Rücktransport nach dem abgeschlossenen Supply Run`,
                        keyQuestion: `Welche Rückfracht seit der Lieferung entstanden ist, wer sie vorbereitet hat und was in ${homeName} damit passiert.`,
                        stakes: `${whyNow} Der Rückflug schließt den Versorgungskreislauf ab.`,
                        completionSignal: `Nach der Landung in ${homeName} wird die Rückfracht entladen, geprüft und übergeben.`,
                        subjectDetail: `${cargo} steht am aktuellen Startplatz ${targetName} zur Beladung bereit.`,
                        incidentContext: stay,
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
                            'Das Briefing ist ein natürlicher Folgeauftrag, keine Liste von Systemregeln.',
                            'Normale deutsche Umlaute verwenden.'
                        ]
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
                storyFrame: {
                    trigger: `Nach dem Supply Run am ${targetName} liegt jetzt Rückholfracht für den Heimflug bereit.`,
                    focusSubject: `${cargo} und sauberer Rücktransport zur Basis`,
                    keyQuestion: `Welche Rückfracht wartet am Strip, warum sie zurück nach ${homeName} muss und welcher Handoff dort folgt.`,
                    stakes: `${whyNow} Der Folgeflug schließt den Supply-Kreislauf ab.`,
                    completionSignal: `Nach der Rückkehr nach ${homeName} wird die Rückfracht entladen, geprüft und in den nächsten Logistikschritt übergeben.`,
                    subjectDetail: `${cargo} liegt am Wartepunkt am Striprand bei ${targetName}.`,
                    incidentContext: stay,
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
                        'Das Briefing ist ein natürlicher Folgeauftrag, keine Liste von Systemregeln.',
                        'Normale deutsche Umlaute verwenden.'
                    ]
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
        const sourceKind = getProfileId(md);
        const cfg = SOURCE_MAP[sourceKind];
        if (!cfg) return { created: false, reason: 'unsupported-source-profile', sourceKind };
        if (cargoOutcome && cargoOutcome.failed === true) return { created: false, reason: 'mission-failed', sourceKind };
        if (md.missionFailed === true || String(md.missionResult || '').toLowerCase() === 'failed') {
            return { created: false, reason: 'mission-failed', sourceKind };
        }
        const bush = md.bush || md.missionContract?.bush || null;
        const homeRef = normalizeRef(bush?.homeRef);
        const targetRef = normalizeRef(bush?.targetRef);
        if (!homeRef || !targetRef) return { created: false, reason: 'missing-bush-refs', sourceKind };
        if (!targetRef.icao) return { created: false, reason: 'missing-target-icao', sourceKind };
        if (!homeRef.icao) return { created: false, reason: 'missing-home-icao', sourceKind };

        const sourceMissionId = cleanText(md.missionId || '', 120);
        const sourceMissionKey = cleanText(md.missionKey || [sourceKind, homeRef.icao, targetRef.icao, md.mission].filter(Boolean).join('|'), 220);
        const dedupeKey = `${sourceMissionId || sourceMissionKey}|${cfg.followUpKind}`;
        const id = `fup_${stableHash(dedupeKey)}`;
        const existing = getRequests().find(req => req.id === id || req.dedupeKey === dedupeKey);
        if (existing) return { created: false, reason: 'duplicate', id, sourceKind };

        const now = nowMs();
        const eligibleAt = nextLocalMorningAt(8);
        const passenger = PASSENGER_PICKUP_SOURCE_KINDS.has(sourceKind) ? extractPassenger(md) : null;
        const memory = buildNarrativeMemory(sourceKind, md, passenger, homeRef, targetRef);
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
            createdAt: now,
            updatedAt: now,
            eligibleAt,
            expiresAt: addDays(eligibleAt, EXPIRE_DAYS),
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
            narrativeMemory: memory,
            ui: {
                title: `${cfg.followUpLabel}: ${targetRef.name || targetRef.icao}`,
                subtitle: `Fortsetzung von ${cfg.sourceLabel}`,
                previewText: cfg.followUpKind === 'bush_pickup_strip'
                    ? `${passenger?.name || 'Der Gast'} meldet sich vom Strip zur Rückholung.`
                    : `Am Strip wartet Rückfracht aus dem Supply Run.`
            }
        };
        writeRequests([...getRequests(), req], { cloud: true });
        rememberLastLandingRef(targetRef, { source, missionId: sourceMissionId });
        console.info('[FollowUp] Anfrage geplant', { id, sourceKind, followUpKind: cfg.followUpKind, eligibleAt });
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
        const target = airportFromRef(req.route?.targetRef);
        if (!home?.icao || !target?.icao) {
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
        const dest = airportFromRef(acceptanceDestRef(acceptance));
        if (!start?.icao || !dest?.icao) {
            alert('Folgeanfrage unvollständig: Start oder Ziel fehlt.');
            return false;
        }
        const startEl = document.getElementById('startLoc');
        const destEl = document.getElementById('destLoc');
        const typeEl = document.getElementById('targetType');
        const pickerValue = pickerValueForProfile(acceptance.dispatchProfileId || req.followUpKind);
        if (startEl) startEl.value = start.icao;
        if (destEl) destEl.value = dest.icao;
        if (typeEl) {
            typeEl.value = pickerValue;
            try { localStorage.setItem('ga_target_type', pickerValue); } catch (_) {}
            if (typeof window.setMissionTypeSelection === 'function') {
                try { window.setMissionTypeSelection(pickerValue); } catch (_) {}
            }
        }
        if (typeof window.syncToNavCom === 'function') {
            try { window.syncToNavCom('startLocRadio', start.icao); } catch (_) {}
            try { window.syncToNavCom('destLocRadio', dest.icao); } catch (_) {}
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
        if (!SOURCE_MAP[sourceKind]) {
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

        if (followUpKind === 'bush_pickup_strip') {
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
        }
        if (!bushSpec) return null;
        const mission = {
            i: effectiveProfileId === 'bush_supply_strip' || followUpKind === 'bush_pickup_cargo' ? '📦' : '🧭',
            t: title,
            s: story,
            cat: effectiveProfileId === 'bush_supply_strip'
                ? 'bush_supply'
                : (effectiveProfileId === 'bush_charter_strip'
                    ? 'charter'
                    : (followUpKind === 'bush_pickup_cargo' ? 'bush_pickup_cargo' : 'bush_pickup')),
            passenger,
            missionType: 'bush',
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
                acceptance: acceptance || null,
                narrativeMemory: req.narrativeMemory || null
            },
            _source: 'Follow-up Bush Dispatcher',
            _requestedProfile: effectiveProfileId,
            _appliedProfile: effectiveProfileId
        };
        return {
            mission,
            paxText,
            cargoText,
            dataSource: 'Follow-up Bush Dispatcher'
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
        lines.push('Follow-up Requests');
        lines.push(`- Pending: ${pending.length} | fällig: ${due.length} | geplant: ${future.length}`);
        lines.push(`- Letzte Landung: ${lastLanding?.icao ? `${lastLanding.icao} (${lastLanding.name || lastLanding.icao})` : '-'}`);
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
            lines.push(`- ${req.id} | ${status} | ${req.sourceKind || '-'} -> ${req.followUpKind || '-'} | ab ${formatLocal(req.eligibleAt)} | bis ${formatLocal(req.expiresAt)} | ETA ${eta}`);
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
            const supported = !!(md && SOURCE_MAP[sourceKind]);
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
