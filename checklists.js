(function() {
    'use strict';

    const CUSTOM_STORAGE_KEY = 'ga_checklists_custom_v1';
    const PROGRESS_STORAGE_KEY = 'ga_checklist_progress_v1';
    const UI_STORAGE_KEY = 'ga_checklist_ui_v1';
    const VISIBLE_STORAGE_KEY = 'ga_checklist_visible_v1';
    const COMMUNITY_SUBS_KEY = 'ga_checklist_community_subs_v1';
    const COMMUNITY_META_KEY = 'ga_checklist_community_meta_v1';
    const COMMUNITY_CACHE_KEY = 'ga_checklist_community_cache_v1';
    const SHARE_PREFIX = 'GA-CHECKLIST-v1:';
    const MAX_CHAPTERS = 20;
    const MAX_ITEMS = 300;
    const MAX_TEXT_LENGTH = 220;

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
        actionMenuOpen: false
    };

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

    function allChecklists() {
        return [
            ...BUILTIN_CHECKLISTS,
            ...customLists.slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)),
            ...subscribedCommunityLists()
        ];
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
    }

    function loadStateFromStorage() {
        const rawCustom = readJson(CUSTOM_STORAGE_KEY, []);
        customLists = Array.isArray(rawCustom) ? rawCustom.map(sanitizeCustomList).filter(Boolean) : [];
        progressByChecklist = readJson(PROGRESS_STORAGE_KEY, {});
        if (!progressByChecklist || typeof progressByChecklist !== 'object') progressByChecklist = {};
        visibilityPrefs = readJson(VISIBLE_STORAGE_KEY, {});
        if (!visibilityPrefs || typeof visibilityPrefs !== 'object') visibilityPrefs = {};
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
        else renderHome();
        renderStatus();
    }

    function renderHome() {
        setTitle('Kartenwerkzeuge');
        const count = visibleChecklists().length;
        bodyEl.innerHTML = `
            <div class="checklist-tool-grid">
                <button class="checklist-tool-tile" type="button" data-action="open-list">
                    <span>
                        <span class="checklist-tool-name">Checklists</span>
                        <span class="checklist-tool-count">${count} sichtbar · ${communityMeta.length} Community</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
            </div>
        `;
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
            state.view = 'home';
            state.editorDraft = null;
            state.actionMenuOpen = false;
            setStatus('');
            render();
        } else if (action === 'open-list') {
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
