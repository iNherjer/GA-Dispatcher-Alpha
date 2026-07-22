/* === PINNBOARD & PDF EXPORT LOGIC (v220) === */
let currentBoardMode = 'private'; 
let pendingPinNote = null;
let groupDataCache = { members: [], notes: [] };
let debriefOverlayEl = null;
let currentDebriefRecord = null;
let currentDebriefAwaitingCleanup = false;
let homebaseDirectoryAirportLoadRequested = false;

const tutorialNotes = [
    { id: 101, text: "👋 WILLKOMMEN!\n\nZiehe diese Zettel umher, bearbeite sie (✏️) oder lösch sie (✖).", x: 4, y: 6, rot: -2 },
    { id: 102, text: "📻 NAVCOM THEME\n\nZieh mit gedrückter Maus an den runden Drehknöpfen, um TAS und GPH schnell einzustellen!", x: 28, y: 10, rot: 3 },
    { id: 103, text: "🗺️ KARTENTISCH\n\nKlick auf die rote Route für neue Wegpunkte. Nutze das ⛶ Icon für den echten Vollbildmodus!", x: 52, y: 5, rot: -1 },
    { id: 104, text: "🔗 MULTIPLAYER\n\nTritt unten in den Settings einer Crew bei, um Zettel und Flüge in Echtzeit zu teilen!", x: 76, y: 12, rot: 4 },
    { id: 105, text: "🌤️ WETTER & AIP\n\nIm Briefing (oder auf dem GPS) findest du Direkt-Links zu aktuellen METARs und Anflugkarten.", x: 6, y: 45, rot: 1 },
    { id: 106, text: "🎨 ANALOG DESIGN\n\nKlicke im Retro-Modus auf die silberne SCHRAUBE oben links, um die Panel-Lackierung zu wechseln!", x: 30, y: 50, rot: -3 },
    { id: 107, text: "🤖 KI DISPATCHER\n\nTrag unten deinen Gemini API-Key ein für kreative Missions-Storys mit Passagieren & Fracht.", x: 55, y: 42, rot: 2 },
    { id: 108, text: "📌 FLÜGE MERKEN\n\nPinne coole Routen an dieses Brett. Geflogen? Logge sie unten, um deinen Startplatz zu versetzen!", x: 78, y: 46, rot: -2 }
];

function pinboardJsonClone(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

function pinboardWithoutLegacyFlightRecords(notes) {
    return (Array.isArray(notes) ? notes : []).filter(note => note?.type !== 'flight_record');
}

function pinboardMigrateLegacyFlightRecords() {
    try {
        const raw = localStorage.getItem('ga_pinboard');
        if (!raw) return 0;
        const notes = JSON.parse(raw);
        if (!Array.isArray(notes)) return 0;
        const clean = pinboardWithoutLegacyFlightRecords(notes);
        const removed = notes.length - clean.length;
        if (removed <= 0) return 0;
        localStorage.setItem('ga_pinboard', JSON.stringify(clean));
        try { console.info(`[Pinboard] ${removed} alte Flugtrack-Eintraege entfernt.`); } catch (_) {}
        return removed;
    } catch (err) {
        try { console.warn('[Pinboard] Alte Flugtrack-Eintraege konnten nicht migriert werden:', err); } catch (_) {}
        return 0;
    }
}

try { window.gaLegacyFlightRecordsRemoved = pinboardMigrateLegacyFlightRecords(); } catch (_) {}

function pinboardIsQuotaError(err) {
    const name = String(err?.name || '');
    const msg = String(err?.message || '');
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota|storage/i.test(msg);
}

function pinboardPruneLocalStorageForQuota(options = {}) {
    if (typeof window.gaPruneLocalStorageForQuota === 'function') {
        try {
            return window.gaPruneLocalStorageForQuota(options);
        } catch (_) {}
    }
    const exact = [
        'ga_mission_debug_snapshot',
        'ga_vfr_overlay_cache_v1',
        'ga_obs_pool_v1',
        'ga_obs_tile_cov_v1',
        'ga_obs_tile_failed_v1',
        'ga_om_cache_v2'
    ];
    if (options.replacePinboard) exact.push('ga_pinboard');
    const prefixes = ['ga_obs_combo_', 'ga_lms_'];
    let removed = 0;
    exact.forEach(key => {
        try {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                removed++;
            }
        } catch (_) {}
    });
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && prefixes.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
                removed++;
            }
        }
    } catch (_) {}
    return removed;
}

function pinboardCompactFlightDataState(state, level = 1) {
    if (typeof _syncCompactFlightDataState === 'function') {
        try {
            const compact = _syncCompactFlightDataState(state, level);
            if (compact) return compact;
        } catch (_) {}
    }
    const out = pinboardJsonClone(state);
    if (!out || typeof out !== 'object') return out;
    delete out.vpElevationData;
    delete out.vpSegmentAlts;
    delete out.freqCache;
    if (level >= 2) {
        delete out.vpAltWaypoints;
        delete out.missionRouteWaypoints;
    }
    if (level >= 3) {
        out.wikiDepImageUrl = '';
        out.wikiDestImageUrl = '';
        out.wikiDepDescText = '';
        out.wikiDestDescText = '';
        out.wikiDepFreqText = '';
        out.wikiDestFreqText = '';
    }
    return out;
}

function pinboardStoreActiveMissionStateForRestore(state) {
    const sharedStore = (typeof window.storeActiveMissionStateSafely === 'function')
        ? window.storeActiveMissionStateSafely
        : null;
    if (sharedStore) {
        try {
            return sharedStore(state, { refreshActiveMissionTimestamp: false });
        } catch (err) {
            try { console.warn('[Pinboard] Shared mission-state storage failed; using local fallback.', err); } catch (_) {}
        }
    }

    const candidates = [
        state,
        pinboardCompactFlightDataState(state, 1),
        pinboardCompactFlightDataState(state, 2),
        pinboardCompactFlightDataState(state, 3)
    ].filter(Boolean);
    let quotaCleanupApplied = false;
    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
        try {
            localStorage.setItem('ga_active_mission', JSON.stringify(candidates[i]));
            try { delete window.__gaActiveMissionStorageFallback; } catch (_) { window.__gaActiveMissionStorageFallback = null; }
            return true;
        } catch (err) {
            lastError = err;
            if (pinboardIsQuotaError(err) && !quotaCleanupApplied) {
                pinboardPruneLocalStorageForQuota();
                try { localStorage.removeItem('ga_active_mission'); } catch (_) {}
                quotaCleanupApplied = true;
                i -= 1;
            }
        }
    }

    const memoryFallback = pinboardJsonClone(candidates[candidates.length - 1] || state) || state;
    try { window.__gaActiveMissionStorageFallback = memoryFallback; } catch (_) {}
    try { console.warn('[Pinboard] Active mission state kept in memory after storage failure.', lastError); } catch (_) {}
    return false;
}

function pinboardCompactNotesForStorage(notes, options = {}) {
    if (typeof _syncCompactPinboard === 'function') {
        try {
            return _syncCompactPinboard(notes, options);
        } catch (_) {}
    }
    let out = pinboardWithoutLegacyFlightRecords(
        Array.isArray(notes) ? notes.map(n => pinboardJsonClone(n)).filter(Boolean) : []
    );
    const maxNotes = Number(options.maxNotes);
    if (Number.isFinite(maxNotes) && out.length > maxNotes) out = out.slice(Math.max(0, out.length - maxNotes));
    const pruneByType = (type, maxKeep) => {
        if (!Number.isFinite(Number(maxKeep))) return;
        const indexes = [];
        out.forEach((note, idx) => { if (note?.type === type) indexes.push(idx); });
        while (indexes.length > Math.max(0, Number(maxKeep))) {
            const idx = indexes.shift();
            out.splice(idx, 1);
            for (let i = 0; i < indexes.length; i++) indexes[i] -= 1;
        }
    };
    pruneByType('flight', options.maxPinnedFlights);
    const level = Number.isFinite(Number(options.flightDataLevel)) ? Number(options.flightDataLevel) : 1;
    const textMax = Number.isFinite(Number(options.textMax)) ? Number(options.textMax) : 8000;
    out.forEach(note => {
        if (!note || typeof note !== 'object') return;
        if (typeof note.text === 'string' && note.text.length > textMax) note.text = note.text.slice(0, textMax);
        if (note.type === 'flight' && note.flightData) note.flightData = pinboardCompactFlightDataState(note.flightData, level);
    });
    return out;
}

function pinboardSavePrivateNotes(notes) {
    const cleanNotes = pinboardWithoutLegacyFlightRecords(notes);
    const attempts = [
        { raw: true },
        { maxPinnedFlights: 10, flightDataLevel: 1 },
        { maxPinnedFlights: 8, flightDataLevel: 1 },
        { maxPinnedFlights: 6, flightDataLevel: 2 },
        { maxPinnedFlights: 4, flightDataLevel: 2, maxNotes: 80, textMax: 3000 },
        { maxPinnedFlights: 2, flightDataLevel: 3, maxNotes: 50, textMax: 1000 },
        { maxPinnedFlights: 1, flightDataLevel: 3, maxNotes: 30, textMax: 600 }
    ];
    let lastError = null;
    let storageRescued = false;
    let previousRaw = null;
    try {
        const previousNotes = JSON.parse(localStorage.getItem('ga_pinboard') || '[]');
        previousRaw = JSON.stringify(pinboardWithoutLegacyFlightRecords(previousNotes));
    } catch (_) {}
    for (const attempt of attempts) {
        const candidate = attempt.raw ? cleanNotes : pinboardCompactNotesForStorage(cleanNotes, attempt);
        const raw = JSON.stringify(candidate);
        for (let pass = 0; pass < 2; pass++) {
            try {
                if (storageRescued) {
                    try { localStorage.removeItem('ga_pinboard'); } catch (_) {}
                }
                localStorage.setItem('ga_pinboard', raw);
                if (storageRescued) {
                    try { console.warn('[Pinboard] Local storage quota cleanup applied before saving pinboard.'); } catch (_) {}
                }
                return { notes: candidate, compacted: !attempt.raw, storageRescued };
            } catch (err) {
                lastError = err;
                if (!pinboardIsQuotaError(err)) break;
                if (!storageRescued) {
                    pinboardPruneLocalStorageForQuota({ replacePinboard: true });
                    storageRescued = true;
                    continue;
                }
                break;
            }
        }
    }
    if (previousRaw != null) {
        try { localStorage.setItem('ga_pinboard', previousRaw); } catch (_) {}
    }
    throw lastError || new Error('Pinboard konnte nicht gespeichert werden');
}

function pinboardTrySavePrivateNotes(notes, alertText = '') {
    try {
        return pinboardSavePrivateNotes(notes).notes || notes;
    } catch (err) {
        try { console.error('[Pinboard] Pinnwand konnte nicht gespeichert werden:', err); } catch (_) {}
        if (alertText) alert(alertText);
        return null;
    }
}

function getGroupName() { return localStorage.getItem('ga_group_name') || ""; }
function getGroupNick() { return localStorage.getItem('ga_group_nick') || getSyncId() || "Pilot"; }

async function joinGroup() {
    const gName = document.getElementById('groupNameInput').value.trim().toUpperCase();
    let gNick = document.getElementById('groupNickInput').value.trim();
    
    // Authentifizierung via Pilot-ID
    const syncId = getSyncId();
    const syncPin = getSyncPin();

    if(!gName) { alert("Bitte einen Gruppen-Code (z.B. EDTK) eingeben!"); return; }
    if(!syncId || !syncPin) { 
        alert("🔒 Zugriff verweigert: Bitte lege zuerst oben im Sync-Bereich eine Pilot-ID und einen PIN fest!"); 
        return; 
    }
    
    // Fallback: Falls kein Nickname eingegeben wurde, nutze die Pilot-ID (oder einen Teil davon)
    if (!gNick) gNick = syncId;

    document.getElementById('groupStatus').innerText = "Verbinde...";

    try {
        // Wir fragen die Gruppe ab. Die Berechtigung wird über die Pilot-ID + PIN geprüft.
        // Der Server muss prüfen: Ist diese SyncId+Pin Kombination valide?
        const res = await fetch(SYNC_URL + "GROUP_" + gName + "?pin=" + syncPin + "&syncId=" + syncId, {
            headers: { 'X-Pilot-PIN': syncPin, 'X-Pilot-ID': syncId }
        });

        if (res.status === 401) {
            alert("❌ Authentifizierungs-Fehler!\n\nDeine Pilot-ID oder dein PIN ist falsch. Bitte prüfe die Eingaben oben im Sync-Bereich.");
            document.getElementById('groupStatus').innerText = "Auth-Fehler";
            return;
        }

        let data = { members: [], kicked: [] };
        if (res.ok) data = await res.json();
        
        // Kick-Prüfung (jetzt über die Pilot-ID, nicht nur über den Nick!)
        if (data.kicked && data.kicked.includes(syncId)) {
            alert("Diese Pilot-ID wurde aus der Crew gebannt!");
            document.getElementById('groupStatus').innerText = "Gebannt";
            return;
        }

        // Zugang gewährt: Wir speichern den Gruppen-Namen und den Anzeigenamen
        localStorage.setItem('ga_group_name', gName);
        localStorage.setItem('ga_group_nick', gNick);
        
        document.getElementById('groupStatus').innerText = "Verbunden als " + gNick;
        document.getElementById('groupStatus').style.color = "var(--green)";

        forceGroupSync();
        window.homebaseGroupRefresh?.('group-joined');
        triggerCloudSave(true);
        alert("🤝 Du bist der Crew '" + gName + "' beigetreten!");
    } catch(e) {
        alert("Verbindungsfehler zum Crew-Server.");
        document.getElementById('groupStatus').innerText = "Offline";
    }
}
async function removeSelfFromGroup(gName, gNick) {
    const syncId = getSyncId();
    try {
        const res = await fetch(SYNC_URL + "GROUP_" + gName, {
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': syncId }
        });
        if (!res.ok) return;
        let data = await res.json();
        if (data.members) {
            const me = data.members.find(m => m.syncId === syncId);
            data.members = data.members.filter(m => m.syncId !== syncId);

            // Admin-Rechte weitergeben, falls Admin geht
            if (me && me.isAdmin && data.members.length > 0) {
                data.members.sort((a,b) => a.lastSeen - b.lastSeen);
                data.members[0].isAdmin = true;
            }

            data.lastModified = Date.now();
            await fetch(SYNC_URL + "GROUP_" + gName, { 
                method: 'POST', 
                headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': syncId },
                body: JSON.stringify(data), 
                keepalive: true 
            });
        }
    } catch(e) {}
}
function leaveGroup(isBanned = false) {
    const oldName = getGroupName();
    const oldNick = getGroupNick();
    if (oldName && oldNick && !isBanned) {
        removeSelfFromGroup(oldName, oldNick);
    }
    localStorage.removeItem('ga_group_name');
    localStorage.removeItem('ga_group_nick');
    localStorage.removeItem('ga_group_pin');
    window.homebaseGroupClear?.();
    document.getElementById('groupNameInput').value = "";
    document.getElementById('groupStatus').innerText = "Nicht verbunden";
    document.getElementById('groupStatus').style.color = "#888";
    if(currentBoardMode === 'group') switchPinboardMode('private');
    triggerCloudSave(true);
    if(!isBanned) alert("🚪 Crew verlassen.");
}
async function kickGroupUser(targetSyncId) {
    if(!confirm(`Möchtest du dieses Mitglied wirklich aus der Crew kicken?`)) return;
    const gName = getGroupName();
    try {
        const res = await fetch(SYNC_URL + "GROUP_" + gName, {
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() }
        });
        if (!res.ok) return;
        let data = await res.json();
        data.members = (data.members || []).filter(m => m.syncId !== targetSyncId);
        data.kicked = data.kicked || [];
        data.kicked.push(targetSyncId);
        data.lastModified = Date.now();
        await fetch(SYNC_URL + "GROUP_" + gName, { 
            method: 'POST', 
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() },
            body: JSON.stringify(data) 
        });
        forceGroupSync();
    } catch(e) {}
}
function updateGroupUIFromSync(gName, gNick) {
    if (gName && gNick) {
        localStorage.setItem('ga_group_name', gName);
        localStorage.setItem('ga_group_nick', gNick);
        const inpN = document.getElementById('groupNameInput');
        const inpU = document.getElementById('groupNickInput');
        const stat = document.getElementById('groupStatus');
        if (inpN) inpN.value = gName;
        if (inpU) inpU.value = gNick;
        if (stat) { stat.innerText = "Verbunden als " + gNick; stat.style.color = "var(--green)"; }
        silentGroupSync();
    } else {
        leaveGroup(true); // Lautlos aufräumen
    }
}
function setNavComLed(btnId, state) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove('led-syncing', 'led-success', 'led-error');
    if (state !== 'off') btn.classList.add(`led-${state}`);
}
function updateGroupBadgeUI() {
    let newBadges = JSON.parse(localStorage.getItem('ga_group_new')) || [];
    let hidden = JSON.parse(localStorage.getItem('ga_group_hidden')) || [];

    // GHOST BUSTER: Wenn ein Zettel im lokalen Müll liegt, kann er nicht "Neu" sein!
    let initialLen = newBadges.length;
    newBadges = newBadges.filter(id => !hidden.includes(id));
    if (newBadges.length !== initialLen) {
        localStorage.setItem('ga_group_new', JSON.stringify(newBadges));
    }
    const mainBadge = document.getElementById('mainPinboardBadge');
    const tabBadge = document.getElementById('groupBadge');
    const hasNew = newBadges.length > 0;

    if (mainBadge) mainBadge.style.display = hasNew ? 'inline-block' : 'none';
    if (tabBadge && currentBoardMode !== 'group') {
        tabBadge.style.display = hasNew ? 'inline-block' : 'none';
    } else if (tabBadge && currentBoardMode === 'group') {
        tabBadge.style.display = 'none';
    }
}
function switchPinboardMode(mode) {
    if(mode === 'group' && !getGroupName()) {
        alert("Bitte zuerst unten in den Einstellungen einer Crew beitreten!"); return;
    }
    currentBoardMode = mode;
    document.getElementById('tabPrivate').classList.toggle('active', mode === 'private');
    document.getElementById('tabGroup').classList.toggle('active', mode === 'group');
    updateGroupBadgeUI();
    renderNotes();
}
function toggleTutorialNotes() {
    if (currentBoardMode === 'group') { alert("Tipps können nur auf dem privaten Brett geladen werden."); return; }
    let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
    const hasTutorial = notes.some(n => n.id >= 101 && n.id <= 108);
    if (hasTutorial) notes = notes.filter(n => n.id < 101 || n.id > 108);
    else tutorialNotes.forEach(tn => { if (!notes.find(n => n.id === tn.id)) notes.push(tn); });
    if (!pinboardTrySavePrivateNotes(notes, "Die Pinnwand konnte nicht gespeichert werden. Bitte lösche alte Flüge und versuche es erneut.")) return;
    renderNotes();
}
function clearPinboard() {
    if (currentBoardMode === 'group') {
        alert("Du kannst nicht das gesamte Crew-Brett löschen. Bitte lösche deine Zettel einzeln."); return;
    }
    if (confirm("🗑️ Möchtest du wirklich ALLE Zettel von deinem privaten Brett in den Müll werfen?")) {
        localStorage.setItem('ga_pinboard', JSON.stringify([]));
        renderNotes(); triggerCloudSave();
    }
}
function togglePinboard(forceInternal) {
    const board = document.getElementById('pinboardOverlay');
    const mapBoard = document.getElementById('mapTableOverlay');
    if (!board || !mapBoard) return;

    const force = !!forceInternal;
    const win95WindowMode = typeof window.canFloatWin95Windows === 'function'
        ? window.canFloatWin95Windows()
        : document.body.classList.contains('theme-win95') && !(window.matchMedia && window.matchMedia('(max-width: 899px)').matches);
    if (typeof isDrawerTransitionBusy === 'function' && isDrawerTransitionBusy() && !force) return;
    if (typeof setDrawerTransitionBusy === 'function' && !force) setDrawerTransitionBusy(true);

    try {
        if (!win95WindowMode && mapBoard.classList.contains('active') && typeof toggleMapTable === 'function') {
            toggleMapTable(true);
        }
        if (document.body.classList.contains('map-is-fullscreen')) {
            if (typeof exitMapFullscreenMode === 'function') exitMapFullscreenMode();
            else {
                document.body.classList.remove('map-is-fullscreen');
                document.documentElement.classList.remove('map-is-fullscreen');
                document.body.style.overflow = '';
            }
        }

        board.classList.toggle('active');
        document.body.classList.toggle('pinboard-open');

        if (board.classList.contains('active')) {
            if (!win95WindowMode && window.innerWidth < 1250) lockBodyScroll();
            renderNotes();
            silentSyncLoad();
            if (getGroupName()) silentGroupSync();
        } else {
            if (!win95WindowMode) unlockBodyScroll();
            triggerCloudSave();
            if (getGroupName()) triggerGroupSave();
        }
        if (typeof setDrawerState === 'function') {
            setDrawerState(board, board.classList.contains('active') ? 'open' : 'closed');
        }
        if (typeof window.persistMainViewFromOverlays === 'function') {
            window.persistMainViewFromOverlays();
        }
        if (board.classList.contains('active') && win95WindowMode && typeof window.focusWin95OverlayWindow === 'function') {
            window.focusWin95OverlayWindow('pinboard');
        }
    } catch (error) {
        console.error('Pinboard toggle failed:', error);
        unlockBodyScroll();
    } finally {
        if (typeof setDrawerTransitionBusy === 'function' && !force) {
            const releaseDelay = (typeof getDrawerDurationMs === 'function') ? Math.max(120, getDrawerDurationMs() + 80) : 200;
            setTimeout(() => setDrawerTransitionBusy(false), releaseDelay);
        }
    }
}
function addNote() {
    const text = prompt("Was möchtest du ans Brett pinnen?");
    const clean = String(text || '').trim().slice(0, 250);
    if (!clean) return;
    const newNote = { id: Date.now(), text: clean, x: 30 + Math.random() * 15, y: 30 + Math.random() * 15, rot: Math.floor(Math.random() * 9) - 4 };
    
    if (currentBoardMode === 'group') {
        newNote.author = getGroupNick();
        let gNotes = groupDataCache.notes || [];
        gNotes.push(newNote);
        groupDataCache.notes = gNotes;
        renderNotes(); triggerGroupSave(true);
    } else {
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        notes.push(newNote);
        if (!pinboardTrySavePrivateNotes(notes, "Die Notiz konnte nicht gespeichert werden. Bitte lösche alte Flüge und versuche es erneut.")) return;
        renderNotes(); triggerCloudSave();
    }
}
function deleteNote(id, isGroup) {
    clearNewBadge(id);
    if (isGroup) {
        let gNotes = groupDataCache.notes || [];
        const note = gNotes.find(n => n.id === id);
        if (note && note.author === getGroupNick()) {
            if(!confirm("Zettel für ALLE Crew-Mitglieder löschen?")) return;
            groupDataCache.notes = gNotes.filter(n => n.id !== id);
            renderNotes(); triggerGroupSave(true);
        } else {
            let hidden = JSON.parse(localStorage.getItem('ga_group_hidden')) || [];
            hidden.push(id);
            localStorage.setItem('ga_group_hidden', JSON.stringify(hidden));
            renderNotes();
        }
    } else {
        if (!confirm("Zettel wirklich abreißen?")) return;
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        notes = notes.filter(n => n.id !== id);
        if (!pinboardTrySavePrivateNotes(notes, "Die Pinnwand konnte nicht gespeichert werden. Bitte lösche alte Flüge und versuche es erneut.")) return;
        renderNotes(); triggerCloudSave();
    }
}
function editNote(id, isGroup) {
    if (isGroup) {
        let gNotes = groupDataCache.notes || [];
        const noteIndex = gNotes.findIndex(n => n.id === id);
        if (noteIndex > -1 && gNotes[noteIndex].author === getGroupNick()) {
            const newText = prompt("Notiz bearbeiten:", gNotes[noteIndex].text);
            const clean = String(newText || '').trim().slice(0, 250);
            if (newText !== null && clean !== "") {
                gNotes[noteIndex].text = clean;
                renderNotes(); triggerGroupSave(true);
            }
        }
    } else {
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        const noteIndex = notes.findIndex(n => n.id === id);
        if (noteIndex > -1) {
            const newText = prompt("Notiz bearbeiten:", notes[noteIndex].text);
            const clean = String(newText || '').trim().slice(0, 250);
            if (newText !== null && clean !== "") {
                notes[noteIndex].text = clean;
                if (!pinboardTrySavePrivateNotes(notes, "Die Notiz konnte nicht gespeichert werden. Bitte lösche alte Flüge und versuche es erneut.")) return;
                renderNotes(); triggerCloudSave();
            }
        }
    }
}
function pinCurrentFlight() {
    if (document.getElementById("briefingBox").style.display !== "block" || !currentMissionData) return;
    if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending()) {
        alert("Mission ist noch ein Entwurf. Bitte erst akzeptieren, dann speichern oder mit der Crew teilen.");
        return;
    }
    let pinnedMissionContract = window.activeMissionContract || currentMissionData?.missionContract || null;
    if (!pinnedMissionContract) {
        try {
            pinnedMissionContract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null');
        } catch (_) {
            pinnedMissionContract = null;
        }
    }
    const state = {
        mTitle: document.getElementById('mTitle').innerHTML, mStory: document.getElementById('mStory').innerText,
        mDepICAO: document.getElementById("mDepICAO").innerText, mDepName: document.getElementById("mDepName").innerText,
        mDepCoords: document.getElementById("mDepCoords").innerText, mDepRwy: document.getElementById("mDepRwy").innerText,
        destIcon: document.getElementById("destIcon").innerText, mDestICAO: document.getElementById("mDestICAO").innerText,
        mDestName: document.getElementById("mDestName").innerText, mDestCoords: document.getElementById("mDestCoords").innerText,
        mDestRwy: document.getElementById("mDestRwy").innerText, mPay: document.getElementById("mPay").innerText,
        mWeight: document.getElementById("mWeight").innerText, mDistNote: document.getElementById("mDistNote").innerText,
        mHeadingNote: document.getElementById("mHeadingNote").innerText, mETENote: document.getElementById("mETENote").innerText,
        wikiDepDescText: document.getElementById("wikiDepDescText") ? document.getElementById("wikiDepDescText").innerText : "",
        wikiDestDescText: document.getElementById("wikiDestDescText") ? document.getElementById("wikiDestDescText").innerText : "",
        wikiDepFreqText: document.getElementById("wikiDepFreqText") ? document.getElementById("wikiDepFreqText").innerHTML : "",
        wikiDestFreqText: document.getElementById("wikiDestFreqText") ? document.getElementById("wikiDestFreqText").innerHTML : "",
        wikiDepImageUrl: document.getElementById("wikiDepImage") ? document.getElementById("wikiDepImage").style.backgroundImage : "",
        wikiDestImageUrl: document.getElementById("wikiDestImage") ? document.getElementById("wikiDestImage").style.backgroundImage : "",
        isPOI: document.getElementById("destRwyContainer").style.display === "none",
        currentMissionData: currentMissionData, routeWaypoints: routeWaypoints, currentStartICAO: currentStartICAO,
        currentDestICAO: currentDestICAO, currentSName: currentSName, currentDName: currentDName,
        currentDepFreq: currentDepFreq, currentDestFreq: currentDestFreq,
        currentDepElev: currentDepElev, currentDestElev: currentDestElev,
        missionRouteWaypoints: window._missionRouteWaypoints || null,
        freqCache: freqCache,
        vpAltWaypoints: typeof vpAltWaypoints !== 'undefined' ? vpAltWaypoints : [],
        vpSegmentAlts: typeof vpSegmentAlts !== 'undefined' ? vpSegmentAlts : [],
        vpElevationData: typeof vpElevationData !== 'undefined' ? vpElevationData : null,
        activePassenger: window.activePassenger || null,
        activeMissionContract: pinnedMissionContract || null
    };
    const routeText = `${currentStartICAO} ➔ ${currentDestICAO === "POI" ? currentMissionData.poiName : currentDestICAO}`;
    const pinnedFlightData = pinboardCompactFlightDataState(state, 1) || state;
    pendingPinNote = {
        id: Date.now(), type: "flight", flightData: pinnedFlightData,
        text: `✈️ <b>${routeText}</b><br><span style="font-size:11px; color:#555;">${state.currentMissionData?.mission || ''}</span><br><span style="font-size:11px;">${state.mDistNote}</span>`,
        x: 35 + Math.random() * 15, y: 20 + Math.random() * 15, rot: Math.floor(Math.random() * 9) - 4
    };
    if(getGroupName()) {
        document.getElementById('pinModalOverlay').style.display = 'flex';
        document.getElementById('btnPinGroup').innerText = `👥 An die Crew (${getGroupName()})`;
    } else {
        executePin('private');
    }
}

function ensureDebriefOverlay() {
    if (debriefOverlayEl) return debriefOverlayEl;
    const ov = document.createElement('div');
    ov.id = 'flightDebriefOverlay';
    ov.className = 'flight-debrief-overlay';
    ov.innerHTML = `
        <div class="flight-debrief-paper" role="dialog" aria-modal="true" aria-labelledby="flightDebriefTitle">
            <div class="flight-debrief-head">
                <div>
                    <div class="flight-debrief-kicker">VFR MULTITOOL · MISSIONSABSCHLUSS</div>
                    <div id="flightDebriefTitle" class="flight-debrief-title">Flight Debrief</div>
                </div>
                <button id="flightDebriefCloseBtn" class="flight-debrief-icon-close" type="button" aria-label="Debrief schließen">×</button>
            </div>
            <div id="flightDebriefBody" class="flight-debrief-body"></div>
            <div class="flight-debrief-actions">
                <button id="flightDebriefPdfBtn" class="flight-debrief-btn secondary" type="button">PDF herunterladen</button>
                <button id="flightDebriefFinishBtn" class="flight-debrief-btn primary" type="button">Schließen</button>
            </div>
        </div>
    `;
    ov.addEventListener('click', (e) => {
        if (e.target === ov && !currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    document.body.appendChild(ov);
    const closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    const finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    const pdfBtn = ov.querySelector('#flightDebriefPdfBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        if (!currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    if (finishBtn) finishBtn.addEventListener('click', () => {
        if (currentDebriefAwaitingCleanup) {
            const record = currentDebriefRecord;
            finishBtn.disabled = true;
            finishBtn.textContent = 'Mission wird aufgeräumt…';
            const cleaned = typeof window.completeMissionCloseCleanup === 'function'
                ? window.completeMissionCloseCleanup(record, 'debrief-finish')
                : false;
            if (!cleaned) {
                finishBtn.disabled = false;
                finishBtn.textContent = 'Debrief schließen & Mission aufräumen';
                return;
            }
            currentDebriefAwaitingCleanup = false;
        }
        ov.style.display = 'none';
    });
    if (pdfBtn) pdfBtn.addEventListener('click', async () => {
        if (!currentDebriefRecord) return;
        pdfBtn.disabled = true;
        const oldText = pdfBtn.textContent;
        pdfBtn.textContent = 'PDF wird erstellt…';
        try { await window.generateDebriefPDF(currentDebriefRecord); }
        catch (err) {
            console.error('[Debrief] PDF export failed:', err);
            alert('Das Debrief-PDF konnte nicht erstellt werden.');
        } finally {
            pdfBtn.disabled = false;
            pdfBtn.textContent = oldText;
        }
    });
    debriefOverlayEl = ov;
    return ov;
}

function _debriefFinite(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function _debriefAltitudeAssessment(record) {
    const sd = _debriefFinite(record?.cruiseAltitudeStdDevFt);
    const range = _debriefFinite(record?.cruiseAltitudeRangeFt);
    if (sd == null) {
        const enrouteSamples = Math.max(0, Math.round(Number(record?.enrouteSampleCount || 0)));
        const cruiseSamples = Math.max(0, Math.round(Number(record?.cruiseSampleCount || 0)));
        const cruiseDurationSec = Math.max(0, Math.round(Number(record?.cruiseDurationSec || 0)));
        let text = 'Für eine belastbare Bewertung gab es zu wenige stabile Streckenflug-Proben.';
        if (enrouteSamples <= 0 && record?.telemetryStatus) {
            text = 'Es wurde kein Abschnitt sicher als Streckenflug erkannt; deshalb wird die Höhenkonstanz nicht bewertet.';
        } else if (enrouteSamples > 0) {
            text = `Es wurden ${enrouteSamples} Streckenflug-Proben erkannt, davon aber nur ${cruiseSamples} über ${cruiseDurationSec} Sekunden als stabiler Höhenflug.`;
        }
        return { value: 'Nicht verfügbar', text };
    }
    const rating = sd <= 75 ? 'sehr konstant' : sd <= 150 ? 'konstant' : sd <= 300 ? 'wechselhaft' : 'deutlich wechselhaft';
    return {
        value: `± ${Math.round(sd)} ft`,
        text: `Die Flughöhe war im waagerechten Streckenflug ${rating} (Standardabweichung ${Math.round(sd)} ft${range == null ? '' : `, Spannweite ${Math.round(range)} ft`}).`
    };
}

function _debriefComfortText(record) {
    const comfort = record?.comfort;
    if (!comfort || _debriefFinite(comfort.score) == null) return 'Für diesen Auftrag wurde kein Passagier-Komfortindex geführt.';
    const causes = [];
    if (Number(comfort.pilotSevere || 0) > 0) causes.push('deutliche pilotenseitige Belastungsspitzen');
    else if (Number(comfort.pilotEvents || 0) > 0) causes.push('einzelne Manöverbelastungen');
    if (Number(comfort.weatherSevere || 0) > 0) causes.push('anspruchsvolles Wetter');
    else if (Number(comfort.weatherEvents || 0) > 0) causes.push('spürbare Wettereinflüsse');
    return `Die Passagiere waren ${comfort.mood || 'bewertet'}: ${Math.round(Number(comfort.score))} von 100 Komfortpunkten${causes.length ? `; prägend waren ${causes.join(' und ')}` : ''}.`;
}

function _debriefCargoText(record) {
    const cargo = record?.cargo;
    if (!cargo) return 'Für diesen Auftrag war keine separate Frachtbewertung erforderlich.';
    const issues = [
        ...(cargo.missingRequired || []),
        ...(cargo.droppedRequired || []),
        ...(cargo.notDeliveredRequired || []),
        ...(cargo.damagedRequired || [])
    ];
    const condition = _debriefFinite(cargo.conditionPct);
    if (cargo.failed) return `Die Ladung wurde nicht vollständig sicher zugestellt${issues.length ? `: ${issues.slice(0, 3).join(', ')}` : '.'}`;
    if (condition == null) return 'Die vorgeschriebene Ladung wurde vollständig und ohne registrierten Verlust transportiert.';
    const rating = condition >= 95 ? 'sehr sicher' : condition >= 80 ? 'sicher' : condition >= 60 ? 'mit spürbarer Beanspruchung' : 'kritisch beansprucht';
    return `Die Ladung wurde ${rating} transportiert. Ermittelter Zustand: ${Math.round(condition)} %.`;
}

function _debriefFlightText(record, altitude) {
    const g = _debriefFinite(record?.maxGForce);
    const bank = _debriefFinite(record?.maxBankDeg);
    const agl = _debriefFinite(record?.minEnrouteAglFt);
    const parts = [];
    if (g != null) parts.push(`Die höchste gemessene Last betrug ${g.toFixed(2)} g`);
    if (bank != null) parts.push(`der größte Bankwinkel ${bank.toFixed(1)}°`);
    if (agl != null) parts.push(`die geringste direkte AGL-Höhe auf Strecke ${Math.round(agl)} ft`);
    let metrics = parts.length ? `${parts.join(', ')}.` : 'Für Belastung und Streckenhöhe lagen keine belastbaren Live-Daten vor.';
    if (!parts.length && record?.telemetryStatus) {
        const samples = Math.max(0, Math.round(Number(record.telemetrySampleCount || 0)));
        metrics = samples > 0
            ? `Der Recorder erhielt ${samples} Live-Proben, aber keine auswertbaren G-, Bank- oder Streckenhöhenwerte.`
            : 'Der Recorder erhielt während dieses Fluges keine auswertbaren Live-Proben.';
    }
    return `${metrics} ${altitude.text}`;
}

function _appendDebriefMetric(grid, label, value) {
    const card = document.createElement('div');
    card.className = 'flight-debrief-metric';
    const labelEl = document.createElement('div');
    labelEl.className = 'flight-debrief-metric-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'flight-debrief-metric-value';
    valueEl.textContent = value;
    card.append(labelEl, valueEl);
    grid.appendChild(card);
}

function _appendDebriefSection(body, title, text) {
    const section = document.createElement('section');
    section.className = 'flight-debrief-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const para = document.createElement('p');
    para.textContent = text;
    section.append(heading, para);
    body.appendChild(section);
}

window.showFlightDebrief = function(record, options = {}) {
    if (!record) return;
    const ov = ensureDebriefOverlay();
    const body = ov.querySelector('#flightDebriefBody');
    if (!body) return;
    currentDebriefRecord = record;
    currentDebriefAwaitingCleanup = options.awaitingCleanup === true;
    body.replaceChildren();
    const dep = String(record.depLabel || record.start || 'START');
    const arr = String(record.arrLabel || record.dest || 'LANDUNG');
    const dateText = String(record.dateLabel || record.date || new Date(record.createdAt || Date.now()).toLocaleString('de-DE'));
    const mission = String(record.missionTitle || record.mission || 'Mission');
    const route = document.createElement('div');
    route.className = 'flight-debrief-route';
    route.textContent = `${dep} ➔ ${arr}`;
    const meta = document.createElement('div');
    meta.className = 'flight-debrief-meta';
    meta.textContent = `${dateText} · ${record.failed ? 'NICHT ERFÜLLT' : 'ERFÜLLT'}`;
    const assignment = document.createElement('div');
    assignment.className = 'flight-debrief-assignment';
    assignment.textContent = mission;
    body.append(route, meta, assignment);

    const grid = document.createElement('div');
    grid.className = 'flight-debrief-metrics';
    const duration = _debriefFinite(record.durationSec);
    const distance = _debriefFinite(record.distanceNm ?? record.dist);
    const g = _debriefFinite(record.maxGForce);
    const bank = _debriefFinite(record.maxBankDeg);
    const agl = _debriefFinite(record.minEnrouteAglFt);
    const altitude = _debriefAltitudeAssessment(record);
    _appendDebriefMetric(grid, 'Flugzeit', duration == null ? '–' : `${Math.max(1, Math.round(duration / 60))} min`);
    _appendDebriefMetric(grid, 'Distanz', distance == null ? '–' : `${distance.toFixed(1)} NM`);
    _appendDebriefMetric(grid, 'Höchstes G', g == null ? '–' : `${g.toFixed(2)} g`);
    _appendDebriefMetric(grid, 'Max. Bank', bank == null ? '–' : `${bank.toFixed(1)}°`);
    _appendDebriefMetric(grid, 'Höhenkonstanz', altitude.value);
    _appendDebriefMetric(grid, 'Min. AGL Strecke', agl == null ? '–' : `${Math.round(agl)} ft`);
    body.appendChild(grid);
    _appendDebriefSection(body, 'Flugdurchführung', _debriefFlightText(record, altitude));
    _appendDebriefSection(body, 'Passagierkomfort', _debriefComfortText(record));
    _appendDebriefSection(body, 'Ladungssicherheit', _debriefCargoText(record));

    const closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    const finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    if (closeBtn) closeBtn.style.display = currentDebriefAwaitingCleanup ? 'none' : '';
    if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = currentDebriefAwaitingCleanup ? 'Debrief schließen & Mission aufräumen' : 'Schließen';
    }
    ov.style.display = 'flex';
};

function closePinModal() {
    document.getElementById('pinModalOverlay').style.display = 'none';
    pendingPinNote = null;
}
function executePin(target) {
    if(!pendingPinNote) return;
    if(target === 'private') {
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        if (notes.filter(n => n.type === 'flight').length >= 10) {
            alert("Dein privates Board ist voll! (Max 10 Flüge)."); closePinModal(); return;
        }
        notes.push(pendingPinNote);
        try {
            const saved = pinboardSavePrivateNotes(notes);
            notes = saved.notes || notes;
            triggerCloudSave(true);
        } catch (err) {
            try { console.error('[Pinboard] Flug konnte nicht gespeichert werden:', err); } catch (_) {}
            alert("Der Flug konnte nicht gespeichert werden. Der lokale Speicher ist voll oder blockiert. Bitte lösche alte Pinnwand-Flüge und versuche es erneut.");
            return;
        }
        if (!document.getElementById('pinboardOverlay').classList.contains('active')) alert("📌 Flugauftrag privat gespeichert!");
    } else if (target === 'group') {
        pendingPinNote.author = getGroupNick();
        let gNotes = groupDataCache.notes || [];
        gNotes.push(pendingPinNote);
        groupDataCache.notes = gNotes;
        triggerGroupSave(true);
        if (!document.getElementById('pinboardOverlay').classList.contains('active')) alert("👥 Flugauftrag mit der Crew geteilt!");
    }
    if(document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
    closePinModal();
}
async function loadPinnedFlight(id, isGroup) {
    let note;
    if(isGroup) {
        note = (groupDataCache.notes || []).find(n => n.id === id);
    } else {
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        note = notes.find(n => n.id === id);
    }
    if (!note) return;
    if (!note.flightData) {
        alert("Dieser Pinnwand-Flug enthaelt keine gespeicherten Flugdaten mehr. Bitte den Flug neu anpinnen oder aus einem neueren Cloud-Backup laden.");
        try { console.warn('[Pinboard] Flight note without flightData cannot be restored:', note); } catch (_) {}
        return;
    }
    if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending(note.flightData)) {
        alert("Dieser angepinnte Flug ist nur ein Entwurf und kann nicht geladen werden.");
        return;
    }
    try {
        pinboardStoreActiveMissionStateForRestore(note.flightData);
        const restored = await restoreMissionState(note.flightData, { source: 'pinboard' });
        if (restored === false) {
            alert("Dieser Pinnwand-Flug konnte nicht geladen werden.");
            return;
        }
        togglePinboard();
        setTimeout(() => {
            if (typeof map !== 'undefined' && map && routeWaypoints.length >= 2) {
                map.fitBounds(L.latLngBounds(routeWaypoints), { padding: [40, 40] });
                updateMiniMap();
            }
        }, 300);
    } catch (err) {
        console.error('[Pinboard] Flight restore failed:', err);
        alert("Dieser Pinnwand-Flug konnte nicht geladen werden.");
    }
}

function pinboardCreateElement(tagName, className = '', text = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== '') element.textContent = text;
    return element;
}

function pinboardCreateAction(tagName, className, text, handler, title = '') {
    const action = pinboardCreateElement(tagName, className, text);
    if (title) action.title = title;
    action.addEventListener('click', handler);
    return action;
}

function pinboardAppendRichFlightMarkup(container, markup) {
    const raw = String(markup || '');
    if (typeof DOMParser !== 'function') {
        const fallback = pinboardCreateElement('span', '', raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
        fallback.style.whiteSpace = 'pre-wrap';
        container.appendChild(fallback);
        return;
    }

    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    const allowedInlineTags = new Set(['B', 'STRONG', 'EM', 'I', 'SPAN']);
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED']);

    const appendSafeNode = (sourceNode, targetNode) => {
        if (sourceNode.nodeType === 3) {
            targetNode.appendChild(document.createTextNode(sourceNode.textContent || ''));
            return;
        }
        if (sourceNode.nodeType !== 1 || blockedTags.has(sourceNode.tagName)) return;
        if (sourceNode.tagName === 'BR') {
            targetNode.appendChild(document.createElement('br'));
            return;
        }

        let childTarget = targetNode;
        if (allowedInlineTags.has(sourceNode.tagName)) {
            const safeTagName = sourceNode.tagName.toLowerCase();
            const safeElement = document.createElement(safeTagName);
            if (sourceNode.tagName === 'SPAN') {
                const fontSize = sourceNode.style.fontSize;
                const color = sourceNode.style.color;
                if (fontSize) safeElement.style.fontSize = fontSize;
                if (color) safeElement.style.color = color;
            }
            targetNode.appendChild(safeElement);
            childTarget = safeElement;
        }
        Array.from(sourceNode.childNodes).forEach(child => appendSafeNode(child, childTarget));
    };

    Array.from(parsed.body.childNodes).forEach(child => appendSafeNode(child, container));
}

function pinboardAppendNoteChrome(container, note, isGroup) {
    if (note.isNew) container.appendChild(pinboardCreateElement('div', 'post-it-new-badge', 'NEU'));
    container.appendChild(pinboardCreateElement('div', 'post-it-pin'));

    const canEdit = !isGroup || note.author === getGroupNick();
    if (note.type !== 'flight' && canEdit) {
        container.appendChild(pinboardCreateAction('div', 'post-it-edit', '✏️', () => editNote(note.id, isGroup)));
    }
    container.appendChild(pinboardCreateAction('div', 'post-it-del', '✖', () => deleteNote(note.id, isGroup)));
}

function pinboardAppendAuthor(container, note, isGroup) {
    if (!isGroup || !note.author) return;
    const author = pinboardCreateElement('div', '', `@${String(note.author)}`);
    author.style.cssText = 'position:absolute; bottom:0.4cqw; right:0.8cqw; font-size:0.8cqw; color:#888; font-family:sans-serif;';
    container.appendChild(author);
}

function renderNotes() {
    const board = document.getElementById('pinboard');
    if (!board) return;
    board.innerHTML = '';
    
    if (currentBoardMode === 'private') {
        let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
        notes.forEach(note => createNoteDOM(note, false));
    } else {
        renderCrewHomebaseDirectory(board);
        // Render Crew Roster
        const roster = document.createElement('div');
        roster.className = 'post-it roster-card';
        roster.style.left = '8%'; // Weiter nach rechts verschoben, damit er nicht auf dem Rahmen liegt
        roster.style.top = '4%';
        roster.style.transform = 'rotate(-2deg)';
        
        const amIAdmin = (groupDataCache.members || []).find(m => m.syncId === getSyncId())?.isAdmin;
        const pin = pinboardCreateElement('div', 'post-it-pin');
        const rosterTitle = pinboardCreateElement('div', '', `👥 CREW: ${String(getGroupName())}`);
        rosterTitle.style.cssText = 'font-weight:bold; font-size:1.4cqw; border-bottom:2px solid #aaa; padding-bottom:4px; margin-bottom:4px;';
        const rosterList = pinboardCreateElement('div', 'roster-list');

        (groupDataCache.members || []).forEach(m => {
            if (!m || typeof m !== 'object') return;
            const isMe = m.syncId === getSyncId();
            const timeoutMs = m.isAdmin ? (365 * 24 * 60 * 60 * 1000) : (28 * 24 * 60 * 60 * 1000); // Admin=12Mon, Normal=28Tage
            const isStale = (Date.now() - m.lastSeen) > timeoutMs;
            if(isStale) return;

            const rosterItem = pinboardCreateElement('div', 'roster-item');
            const displayName = pinboardCreateElement('span');
            displayName.style.fontWeight = isMe ? 'bold' : 'normal';
            if (m.isAdmin) {
                const adminIcon = pinboardCreateElement('span', '', '👑 ');
                adminIcon.title = 'Admin';
                displayName.appendChild(adminIcon);
            }
            displayName.appendChild(document.createTextNode(String(m.nick || m.syncId || 'Pilot')));

            const status = pinboardCreateElement('span', 'roster-status', isMe ? 'Online' : 'Aktiv');
            status.style.cssText = 'display:flex; align-items:center;';
            if (amIAdmin && !isMe) {
                const targetSyncId = m.syncId;
                const kickButton = pinboardCreateAction('span', '', '👢', () => kickGroupUser(targetSyncId), 'Mitglied kicken');
                kickButton.style.cssText = 'cursor:pointer; font-size:1cqw; margin-left:6px; transition:transform 0.2s;';
                status.appendChild(kickButton);
            }
            rosterItem.append(displayName, status);
            rosterList.appendChild(rosterItem);
        });

        roster.append(pin, rosterTitle, rosterList);
        board.appendChild(roster);
        // Render Group Notes
        let gNotes = groupDataCache.notes || [];
        let hidden = JSON.parse(localStorage.getItem('ga_group_hidden')) || [];
        let localPos = JSON.parse(localStorage.getItem('ga_group_positions')) || {};
        let newBadges = JSON.parse(localStorage.getItem('ga_group_new')) || [];
        
        gNotes.forEach(note => {
            if (hidden.includes(note.id)) return;
            let renderNote = { ...note };
            if (localPos[note.id]) {
                renderNote.x = localPos[note.id].x;
                renderNote.y = localPos[note.id].y;
            }
            if (newBadges.includes(note.id)) renderNote.isNew = true;
            createNoteDOM(renderNote, true);
        });
    }
}

function homebaseDirectoryDistanceNm(latA, lonA, latB, lonB) {
    const toRad = Math.PI / 180;
    const dLat = (latB - latA) * toRad;
    const dLon = (lonB - lonA) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(latA * toRad) * Math.cos(latB * toRad) * Math.sin(dLon / 2) ** 2;
    return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function nearestHomebaseAirport(spawn) {
    const lat = Number(spawn?.lat);
    const lon = Number(spawn?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof globalAirports === 'undefined' || !globalAirports || typeof globalAirports !== 'object') return '';
    let best = null;
    Object.entries(globalAirports).forEach(([fallbackIcao, airport]) => {
        const aptLat = Number(airport?.lat);
        const aptLon = Number(airport?.lon ?? airport?.lng);
        if (!Number.isFinite(aptLat) || !Number.isFinite(aptLon)) return;
        const distance = homebaseDirectoryDistanceNm(lat, lon, aptLat, aptLon);
        if (!best || distance < best.distance) best = { icao: String(airport?.icao || fallbackIcao || '').toUpperCase(), distance };
    });
    return best?.icao || '';
}

function renderCrewHomebaseDirectory(board) {
    if (!homebaseDirectoryAirportLoadRequested && (typeof globalAirports === 'undefined' || !Object.keys(globalAirports || {}).length) && typeof loadGlobalAirports === 'function') {
        homebaseDirectoryAirportLoadRequested = true;
        loadGlobalAirports().then(() => {
            if (currentBoardMode === 'group' && document.getElementById('pinboardOverlay')?.classList.contains('active')) renderNotes();
        }).catch(() => {});
    }
    const note = document.createElement('div');
    note.className = 'post-it homebase-directory-card';
    const localPos = JSON.parse(localStorage.getItem('ga_group_positions')) || {};
    const savedPos = localPos['crew-homebases'];
    note.style.left = `${savedPos?.x ?? 56}%`;
    note.style.top = `${savedPos?.y ?? 4}%`;
    note.style.transform = 'rotate(2deg)';
    const pin = pinboardCreateElement('div', 'post-it-pin');
    const title = pinboardCreateElement('div', 'homebase-directory-title', '🏠 HOMEBASES');
    const subtitle = pinboardCreateElement('div', 'homebase-directory-subtitle', 'Crew-Ziele für private Besuche');
    const list = pinboardCreateElement('div', 'homebase-directory-list');
    const entries = (Array.isArray(window.homebaseGroupDirectory) ? window.homebaseGroupDirectory : [])
        .filter((entry) => entry?.hasHomebase && entry?.crewShareEnabled === true);
    if (!entries.length) {
        list.appendChild(pinboardCreateElement('div', 'homebase-directory-empty', 'Noch keine Homebases freigegeben.'));
    }
    entries.forEach((entry) => {
        const row = pinboardCreateElement('div', 'homebase-directory-row');
        const who = pinboardCreateElement('span', 'homebase-directory-owner', String(entry?.nick || entry?.pilotId || 'Pilot'));
        const airport = nearestHomebaseAirport(entry?.spawn);
        const destination = airport || 'Koordinaten';
        const label = pinboardCreateElement('span', 'homebase-directory-apt', destination);
        row.append(who, label);
        if (entry?.hasHomebase && Number.isFinite(Number(entry?.spawn?.lat)) && Number.isFinite(Number(entry?.spawn?.lon))) {
            const visit = pinboardCreateAction('button', 'crew-homebase-visit-btn', 'Besuchen', async () => {
                const ok = await window.createCrewHomebaseVisitRoute?.(entry);
                if (ok && document.getElementById('pinboardOverlay')?.classList.contains('active')) togglePinboard(true);
            });
            row.appendChild(visit);
        }
        list.appendChild(row);
    });
    note.append(pin, title, subtitle, list);
    makeDraggable(note, 'crew-homebases', true);
    board.appendChild(note);
}
function createNoteDOM(note, isGroup) {
    const board = document.getElementById('pinboard');
    const div = document.createElement('div');
    div.className = note.type === 'flight' ? 'post-it flight-card' : 'post-it';
    let posX = note.x > 100 ? (note.x / 1000) * 100 : note.x;
    let posY = note.y > 100 ? (note.y / 600) * 100 : note.y;
    div.style.left = posX + '%'; div.style.top = posY + '%'; div.style.transform = `rotate(${note.rot}deg)`;

    pinboardAppendNoteChrome(div, note, isGroup);
    if (note.type === 'flight') {
        pinboardAppendRichFlightMarkup(div, note.text);
        div.appendChild(pinboardCreateAction('button', 'flight-load-btn', '📂 Flug laden', () => loadPinnedFlight(note.id, isGroup)));
    } else {
        const noteText = pinboardCreateElement('span', '', String(note.text || ''));
        noteText.style.whiteSpace = 'pre-wrap';
        div.appendChild(noteText);
    }

    pinboardAppendAuthor(div, note, isGroup);
    div.addEventListener('mousedown', () => clearNewBadge(note.id));
    div.addEventListener('touchstart', () => clearNewBadge(note.id), {passive:true});
    makeDraggable(div, note.id, isGroup);
    board.appendChild(div);
}
function clearNewBadge(id) {
    let newBadges = JSON.parse(localStorage.getItem('ga_group_new')) || [];
    if(newBadges.includes(id)) {
        newBadges = newBadges.filter(nid => nid !== id);
        localStorage.setItem('ga_group_new', JSON.stringify(newBadges));
        updateGroupBadgeUI();
        triggerCloudSave(true); // "Gelesen"-Status sofort geräteübergreifend in die Cloud pushen

        const b = document.getElementById('pinboard');
        const renderedBadges = b.querySelectorAll('.post-it-new-badge');
        renderedBadges.forEach(el => el.style.display = 'none');
        if(currentBoardMode === 'group') renderNotes();
    }
}
function makeDraggable(element, noteId, isGroup) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown; element.ontouchstart = dragMouseDown;
    function dragMouseDown(e) {
        if (e.target.closest?.('.post-it-del, .post-it-edit, .flight-load-btn, .flight-replay-btn, .crew-homebase-visit-btn')) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX, clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pos3 = clientX; pos4 = clientY;
        document.onmouseup = closeDragElement; document.ontouchend = closeDragElement;
        document.onmousemove = elementDrag; document.ontouchmove = elementDrag;
    }
    function elementDrag(e) {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX, clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY;
        const board = document.getElementById('pinboard');
        let newTop = element.offsetTop - pos2, newLeft = element.offsetLeft - pos1;
        const padding = 10;
        const minLeft = padding, maxLeft = board.offsetWidth - element.offsetWidth - padding;
        const minTop = padding, maxTop = board.offsetHeight - element.offsetHeight - padding;
        if (newLeft < minLeft) newLeft = minLeft; if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop < minTop) newTop = minTop; if (newTop > maxTop) newTop = maxTop;
        element.style.top = (newTop / board.offsetHeight * 100) + "%";
        element.style.left = (newLeft / board.offsetWidth * 100) + "%";
    }
    function closeDragElement() {
        document.onmouseup = null; document.ontouchend = null; document.onmousemove = null; document.ontouchmove = null;
        const board = document.getElementById('pinboard');
        if (isGroup) {
            let localPos = JSON.parse(localStorage.getItem('ga_group_positions')) || {};
            localPos[noteId] = {
                x: (element.offsetLeft / board.offsetWidth) * 100,
                y: (element.offsetTop / board.offsetHeight) * 100
            };
            localStorage.setItem('ga_group_positions', JSON.stringify(localPos));
        } else {
            let notes = JSON.parse(localStorage.getItem('ga_pinboard')) || [];
            const noteIndex = notes.findIndex(n => n.id === noteId);
            if (noteIndex > -1) {
                notes[noteIndex].x = (element.offsetLeft / board.offsetWidth) * 100;
                notes[noteIndex].y = (element.offsetTop / board.offsetHeight) * 100;
                if (!pinboardTrySavePrivateNotes(notes)) return;
                triggerCloudSave();
            }
        }
    }
}

window.addEventListener('homebase-directory-changed', () => {
    if (currentBoardMode === 'group' && document.getElementById('pinboardOverlay')?.classList.contains('active')) renderNotes();
});


// =========================================================
// V80: MISSION EXPORT / IMPORT / PDF-BRIEFING
// =========================================================
window.exportMission = function() {
    if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending()) {
        alert("Mission ist noch ein Entwurf. Bitte erst akzeptieren, dann exportieren.");
        return;
    }
    const data = localStorage.getItem('ga_active_mission');
    if (!data) { alert("Kein aktiver Flug zum Exportieren."); return; }
    const code = btoa(encodeURIComponent(data));
    navigator.clipboard.writeText(code).then(() => {
        alert("🔗 Flug-Code kopiert!\n\nDu kannst ihn nun im Chat teilen oder über 'Code laden' (Pinnwand) auf einem anderen Gerät importieren.");
    }).catch(() => alert("Fehler beim Kopieren."));
};

window.importMission = async function() {
    const code = prompt("Füge hier den kopierten Flug-Code ein:");
    if (!code) return;
    try {
        const decoded = decodeURIComponent(atob(code));
        const state = JSON.parse(decoded);
        if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending(state)) {
            alert("Dieser Flug-Code enthaelt nur einen Entwurf. Bitte auf dem erzeugenden Rechner erst akzeptieren und dann erneut exportieren.");
            return;
        }
        localStorage.setItem('ga_active_mission', JSON.stringify(state));
        const restored = await restoreMissionState(state, { source: 'import' });
        if (restored === false) {
            alert("❌ Dieser Flug konnte nicht geladen werden.");
            return;
        }
        alert("✅ Flug erfolgreich geladen!");
    } catch(e) {
        alert("❌ Ungültiger oder beschädigter Code.");
    }
};

// ==========================================
// V86: PDF BRIEFING PACK EXPORT (VECTOR)
// ==========================================
function loadTileImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        // Cache-Buster erzwingt frische CORS-Header für Safari
        img.src = url + (url.includes('?') ? '&' : '?') + 'safari_cb=' + Date.now();
    });
}

function gatherBriefingData() {
    const tas = parseInt(document.getElementById('tasSlider').value) || 115;
    const gph = parseInt(document.getElementById('gphSlider').value) || 9;
    const dist = currentMissionData.dist;
    const totalMinutes = Math.round((dist / tas) * 60);
    const hrs = Math.floor(totalMinutes / 60), mins = totalMinutes % 60;
    return {
        title: document.getElementById('mTitle').innerText,
        story: document.getElementById('mStory').innerText,
        payload: document.getElementById('mPay').innerText,
        cargo: document.getElementById('mWeight').innerText,
        distance: document.getElementById('mDistNote').innerText,
        heading: document.getElementById('mHeadingNote').innerText,
        ete: document.getElementById('mETENote').innerText,
        aircraft: selectedAC,
        tas: tas,
        gph: gph,
        depICAO: document.getElementById('mDepICAO').innerText,
        depName: document.getElementById('mDepName').innerText,
        depCoords: document.getElementById('mDepCoords').innerText,
        depRwy: document.getElementById('mDepRwy').innerText,
        destICAO: currentMissionData?.poiName ? 'POI' : document.getElementById('mDestICAO').innerText,
        destName: document.getElementById('mDestName').innerText,
        destCoords: document.getElementById('mDestCoords').innerText,
        destRwy: document.getElementById('mDestRwy').innerText,
        depDesc: document.getElementById('wikiDepDescText')?.innerText || '',
        destDesc: document.getElementById('wikiDestDescText')?.innerText || '',
        depRwyText: document.getElementById('wikiDepRwyText')?.innerText || '',
        destRwyText: document.getElementById('wikiDestRwyText')?.innerText || '',
        depFreq: document.getElementById('wikiDepFreqText')?.innerText || '',
        destFreq: document.getElementById('wikiDestFreqText')?.innerText || '',
        isPOI: document.getElementById('destRwyContainer')?.style.display === 'none',
        date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        totalDist: Math.round(dist),
        totalTime: totalMinutes,
        totalTimeStr: hrs > 0 ? `${hrs}h ${mins}m` : `${mins} Min`,
        totalFuel: Math.ceil((dist / tas * gph) + (0.75 * gph)),
        reserveFuel: Math.ceil(0.75 * gph)
    };
}

function computeLegs() {
    const legs = [];
    const tas = parseInt(document.getElementById('tasSlider').value) || 115;
    const gph = parseInt(document.getElementById('gphSlider').value) || 9;

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const p1 = routeWaypoints[i], p2 = routeWaypoints[i + 1];
        const nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);

        let n1 = (i === 0) ? currentSName : (routeWaypoints[i].name || `WP ${i}`);
        let n2 = (i === routeWaypoints.length - 2) ? currentDName : (routeWaypoints[i + 1].name || `WP ${i + 1}`);

        n1 = n1.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');
        n2 = n2.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');

        let f1 = "";
        let m1 = n1.match(/\(([^)]+)\)/);
        if (m1) { f1 = m1[1]; n1 = n1.replace(/\s*\([^)]+\)/, ''); }
        else if (i === 0 && currentDepFreq) { f1 = currentDepFreq; }

        let f2 = "";
        let m2 = n2.match(/\(([^)]+)\)/);
        if (m2) { f2 = m2[1]; n2 = n2.replace(/\s*\([^)]+\)/, ''); }
        else if (i === routeWaypoints.length - 2 && currentDestFreq) { f2 = currentDestFreq; }

        let c1 = n1.match(/\[([^\]]+)\]/); if (c1) n1 = `[${c1[1]}]`;
        let c2 = n2.match(/\[([^\]]+)\]/); if (c2) n2 = `[${c2[1]}]`;

        const time = Math.round((nav.dist / tas) * 60);
        const fuel = (nav.dist / tas * gph).toFixed(1);
        legs.push({ from: n1.trim(), to: n2.trim(), f1: f1, f2: f2, heading: nav.brng, dist: nav.dist, time: time, fuel: fuel });
    }
    return legs;
}

function extractImageUrl(element) {
    if (!element) return null;
    const bg = element.style.backgroundImage;
    if (!bg || bg === 'url("")' || bg === '' || bg === 'url()') return null;
    return bg.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
}

async function getImageAsBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) { return null; }
}

function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve(globalName ? window[globalName] : true);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function ensureBriefingPdfLibraries() {
    await Promise.all([
        loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'),
        loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf')
    ]);
    return !!(window.html2canvas && window.jspdf);
}

function stripEmojis(text) {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
}

async function captureMapForPDF() {
    if (routeWaypoints.length < 2) return null;

    const W = 900, H = 600;
    const bounds = L.latLngBounds(routeWaypoints);

    let zoom = 1;
    for (let z = 14; z >= 1; z--) {
        const nw = bounds.getNorthWest(), se = bounds.getSouthEast();
        const p1 = latLngToPixel(nw.lat, nw.lng || nw.lon, z);
        const p2 = latLngToPixel(se.lat, se.lng || se.lon, z);
        const routeW = Math.abs(p2.x - p1.x), routeH = Math.abs(p2.y - p1.y);
        if (routeW < W - 20 && routeH < H - 20) { zoom = z; break; }
    }

    const center = bounds.getCenter();
    const centerPx = latLngToPixel(center.lat, center.lng, zoom);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(0, 0, W, H);

    const tileSize = 256;
    const subdomains = ['a', 'b', 'c'];
    const tilePromises = [];

    const startTileX = Math.floor((centerPx.x - W / 2) / tileSize);
    const startTileY = Math.floor((centerPx.y - H / 2) / tileSize);
    const endTileX = Math.ceil((centerPx.x + W / 2) / tileSize);
    const endTileY = Math.ceil((centerPx.y + H / 2) / tileSize);

    for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
            const s = subdomains[(tx + ty) % 3];
            const topoUrl = `https://${s}.tile.opentopomap.org/${zoom}/${tx}/${ty}.png`;
            const drawX = (tx * tileSize) - (centerPx.x - W / 2);
            const drawY = (ty * tileSize) - (centerPx.y - H / 2);
            tilePromises.push(loadTileImage(topoUrl).then(img => {
                if (img) { ctx.globalAlpha = 0.5; ctx.drawImage(img, drawX, drawY, tileSize, tileSize); ctx.globalAlpha = 1.0; }
            }));
        }
    }

    const aeroZoom = Math.min(zoom, 12);
    const scale = Math.pow(2, zoom - aeroZoom);
    const aeroCenterPx = latLngToPixel(center.lat, center.lng, aeroZoom);
    const aeroTileSize = tileSize * scale;
    const aStartX = Math.floor((aeroCenterPx.x - (W / 2) / scale) / tileSize);
    const aStartY = Math.floor((aeroCenterPx.y - (H / 2) / scale) / tileSize);
    const aEndX = Math.ceil((aeroCenterPx.x + (W / 2) / scale) / tileSize);
    const aEndY = Math.ceil((aeroCenterPx.y + (H / 2) / scale) / tileSize);

    for (let tx = aStartX; tx <= aEndX; tx++) {
        for (let ty = aStartY; ty <= aEndY; ty++) {
            const aeroUrl = `https://nwy-tiles-api.prod.newaydata.com/tiles/${aeroZoom}/${tx}/${ty}.png?path=latest/aero/latest`;
            const drawX = (tx * aeroTileSize) - (aeroCenterPx.x * scale - W / 2);
            const drawY = (ty * aeroTileSize) - (aeroCenterPx.y * scale - H / 2);
            tilePromises.push(loadTileImage(aeroUrl).then(img => {
                if (img) { ctx.globalAlpha = 0.65; ctx.drawImage(img, drawX, drawY, aeroTileSize, aeroTileSize); ctx.globalAlpha = 1.0; }
            }));
        }
    }

    await Promise.all(tilePromises);

    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 5; ctx.setLineDash([10, 8]);
    ctx.beginPath();
    routeWaypoints.forEach((wp, i) => {
        const px = latLngToPixel(wp.lat, wp.lng || wp.lon, zoom);
        const x = px.x - (centerPx.x - W / 2), y = px.y - (centerPx.y - H / 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.setLineDash([]);

    routeWaypoints.forEach((wp, i) => {
        const px = latLngToPixel(wp.lat, wp.lng || wp.lon, zoom);
        const x = px.x - (centerPx.x - W / 2), y = px.y - (centerPx.y - H / 2);
        const isStart = (i === 0), isDest = (i === routeWaypoints.length - 1);
        const r = (isStart || isDest) ? 9 : 7;
        const fill = isStart ? '#44ff44' : isDest ? '#ff4444' : '#fdfd86';

        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();

        let label = isStart ? currentSName : isDest ? currentDName : (wp.name || `WP${i}`);
        if (isStart && currentDepFreq) { label += ` (${currentDepFreq.split(',')[0].trim()})`; }
        else if (isDest && currentDestFreq) { label += ` (${currentDestFreq.split(',')[0].trim()})`; }
        if (!isStart && !isDest) {
            label = label.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');
            const idM = label.match(/\[([^\]]+)\]/);
            if (idM) { const frM = label.match(/\(([^)]+)\)/); label = frM ? `${idM[1]} (${frM[1]})` : idM[1]; }
        }
        ctx.font = 'bold 11px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#111';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeText(label, x + 12, y + 4); ctx.fillText(label, x + 12, y + 4);
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    return { data: imgData, width: canvas.width, height: canvas.height };
}

async function renderTileCanvas(centerLat, centerLng, zoom, W, H) {
    const centerPx = latLngToPixel(centerLat, centerLng, zoom);
    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0, 0, W, H);

    const tileSize = 256; const subdomains = ['a', 'b', 'c']; const tilePromises = [];
    const startTileX = Math.floor((centerPx.x - W / 2) / tileSize);
    const startTileY = Math.floor((centerPx.y - H / 2) / tileSize);
    const endTileX = Math.ceil((centerPx.x + W / 2) / tileSize);
    const endTileY = Math.ceil((centerPx.y + H / 2) / tileSize);

    for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
            const s = subdomains[(tx + ty) % 3];
            const topoUrl = `https://${s}.tile.opentopomap.org/${zoom}/${tx}/${ty}.png`;
            const drawX = (tx * tileSize) - (centerPx.x - W / 2);
            const drawY = (ty * tileSize) - (centerPx.y - H / 2);
            tilePromises.push(loadTileImage(topoUrl).then(img => {
                if (img) { ctx.globalAlpha = 0.5; ctx.drawImage(img, drawX, drawY, tileSize, tileSize); ctx.globalAlpha = 1.0; }
            }));
        }
    }

    const aeroZoom = Math.min(zoom, 12);
    const scale = Math.pow(2, zoom - aeroZoom);
    const aeroCenterPx = latLngToPixel(centerLat, centerLng, aeroZoom);
    const aeroTileSize = tileSize * scale;
    const aStartX = Math.floor((aeroCenterPx.x - (W / 2) / scale) / tileSize);
    const aStartY = Math.floor((aeroCenterPx.y - (H / 2) / scale) / tileSize);
    const aEndX = Math.ceil((aeroCenterPx.x + (W / 2) / scale) / tileSize);
    const aEndY = Math.ceil((aeroCenterPx.y + (H / 2) / scale) / tileSize);

    for (let tx = aStartX; tx <= aEndX; tx++) {
        for (let ty = aStartY; ty <= aEndY; ty++) {
            const aeroUrl = `https://nwy-tiles-api.prod.newaydata.com/tiles/${aeroZoom}/${tx}/${ty}.png?path=latest/aero/latest`;
            const drawX = (tx * aeroTileSize) - (aeroCenterPx.x * scale - W / 2);
            const drawY = (ty * aeroTileSize) - (aeroCenterPx.y * scale - H / 2);
            tilePromises.push(loadTileImage(aeroUrl).then(img => {
                if (img) { ctx.globalAlpha = 0.65; ctx.drawImage(img, drawX, drawY, aeroTileSize, aeroTileSize); ctx.globalAlpha = 1.0; }
            }));
        }
    }

    await Promise.all(tilePromises);

    const apx = latLngToPixel(centerLat, centerLng, zoom);
    const cx = apx.x - (centerPx.x - W / 2), cy = apx.y - (centerPx.y - H / 2);
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();

    return canvas.toDataURL('image/jpeg', 0.92);
}

function latLngToPixel(lat, lng, zoom) {
    const x = ((lng + 180) / 360) * Math.pow(2, zoom) * 256;
    const latRad = lat * Math.PI / 180;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom) * 256;
    return { x, y };
}

function drawNotebookBackground(doc, pageNum, totalPages, footerLabel = 'Briefing Pack') {
    const W = 210, H = 297;
    doc.setFillColor(253, 245, 230); doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(180, 200, 215); doc.setLineWidth(0.15);
    for (let y = 21; y < H - 10; y += 7) doc.line(12, y, W - 12, y);
    doc.setDrawColor(210, 70, 70); doc.setLineWidth(0.35); doc.line(28, 0, 28, H);
    doc.setDrawColor(180, 175, 160); doc.setLineWidth(0.3);
    [55, H / 2, H - 55].forEach(y => doc.circle(9, y, 3.5));
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 115, 100);
    doc.text(`Seite ${pageNum} / ${totalPages}`, W - 15, H - 12, { align: 'right' });
    doc.setFontSize(7); doc.setTextColor(170, 165, 150);
    doc.text(`VFR Multitool \u2013 ${footerLabel}`, W / 2, H - 6, { align: 'center' });
}

function pdfWrappedText(doc, text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => doc.text(line, x, y + (i * lineHeight)));
    return y + (lines.length * lineHeight);
}

function _drawDebriefPdfSection(doc, title, text, y) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 31, 101);
    doc.text(stripEmojis(String(title || '')), 32, y);
    y += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(45, 45, 40);
    return pdfWrappedText(doc, stripEmojis(String(text || '')), 32, y, 155, 5.2) + 8;
}

window.buildDebriefPdfDocument = async function(record) {
    if (!record) throw new Error('Debrief-Datensatz fehlt.');
    await ensureBriefingPdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    drawNotebookBackground(doc, 1, 1, 'Mission Debrief');
    const dep = String(record.depLabel || record.start || 'START');
    const arr = String(record.arrLabel || record.dest || 'LANDUNG');
    const altitude = _debriefAltitudeAssessment(record);
    const duration = _debriefFinite(record.durationSec);
    const distance = _debriefFinite(record.distanceNm ?? record.dist);
    const g = _debriefFinite(record.maxGForce);
    const bank = _debriefFinite(record.maxBankDeg);
    const agl = _debriefFinite(record.minEnrouteAglFt);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(135, 45, 35);
    doc.text('MISSIONSABSCHLUSS · FLIGHT DEBRIEF', 32, 28);
    doc.setFontSize(20);
    doc.setTextColor(11, 31, 101);
    doc.text(stripEmojis(`${dep}  >  ${arr}`), 32, 39);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 85, 75);
    doc.text(stripEmojis(String(record.dateLabel || record.date || '')), 32, 47);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(45, 45, 40);
    let y = pdfWrappedText(doc, stripEmojis(String(record.missionTitle || record.mission || 'Mission')), 32, 58, 155, 6) + 7;

    const metrics = [
        ['FLUGZEIT', duration == null ? '-' : `${Math.max(1, Math.round(duration / 60))} min`],
        ['DISTANZ', distance == null ? '-' : `${distance.toFixed(1)} NM`],
        ['HOECHSTES G', g == null ? '-' : `${g.toFixed(2)} g`],
        ['MAX. BANK', bank == null ? '-' : `${bank.toFixed(1)} deg`],
        ['HOEHENKONSTANZ', altitude.value.replace('±', '+/-')],
        ['MIN. AGL STRECKE', agl == null ? '-' : `${Math.round(agl)} ft`]
    ];
    const colW = 51;
    metrics.forEach((metric, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 32 + col * colW;
        const yy = y + row * 19;
        doc.setFillColor(247, 236, 213);
        doc.setDrawColor(185, 170, 140);
        doc.roundedRect(x, yy, 47, 15, 1.5, 1.5, 'FD');
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(115, 85, 55);
        doc.text(metric[0], x + 3, yy + 5);
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 35, 40);
        doc.text(stripEmojis(metric[1]), x + 3, yy + 11.5);
    });
    y += 45;
    y = _drawDebriefPdfSection(doc, 'Flugdurchfuehrung', _debriefFlightText(record, altitude), y);
    y = _drawDebriefPdfSection(doc, 'Passagierkomfort', _debriefComfortText(record), y);
    y = _drawDebriefPdfSection(doc, 'Ladungssicherheit', _debriefCargoText(record), y);

    doc.setDrawColor(record.failed ? 165 : 45, record.failed ? 55 : 120, record.failed ? 45 : 65);
    doc.setLineWidth(0.8);
    doc.roundedRect(32, Math.min(245, y + 2), 155, 18, 2, 2);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(record.failed ? 150 : 30, record.failed ? 45 : 105, record.failed ? 35 : 55);
    doc.text(record.failed ? 'MISSION NICHT ERFUELLT' : 'MISSION ERFUELLT', 109.5, Math.min(256, y + 13), { align: 'center' });
    doc.setProperties({ title: `Mission Debrief ${dep} - ${arr}`, subject: String(record.missionTitle || record.mission || '') });
    return doc;
};

window.generateDebriefPDF = async function(record) {
    const doc = await window.buildDebriefPdfDocument(record);
    const dep = String(record?.depLabel || record?.start || 'START').replace(/[^a-z0-9_-]+/gi, '-');
    const arr = String(record?.arrLabel || record?.dest || 'LANDUNG').replace(/[^a-z0-9_-]+/gi, '-');
    const stamp = new Date(record?.createdAt || Date.now()).toISOString().slice(0, 10);
    doc.save(`Debrief_${dep}_${arr}_${stamp}.pdf`);
    return true;
};

function drawMissionBriefingPage(doc, data, mapImage) {
    let y = 30;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(11, 31, 101);
    const cleanTitle = stripEmojis(data.title);
    const titleLines = doc.splitTextToSize(cleanTitle, 155);
    titleLines.forEach((line, i) => doc.text(line, 32, y + (i * 8)));
    y += titleLines.length * 8 + 3;

    doc.setDrawColor(11, 31, 101); doc.setLineWidth(0.5); doc.line(32, y, 190, y); y += 10;

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    const routeStr = data.isPOI ? `${data.depICAO} > ${data.destName} (Rundflug)` : `${data.depICAO} (${data.depName}) > ${data.destICAO} (${data.destName})`;
    const routeLines = doc.splitTextToSize(routeStr, 155);
    routeLines.forEach((line, i) => doc.text(line, 32, y + (i * 6)));
    y += routeLines.length * 6 + 6;

    doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    y = pdfWrappedText(doc, stripEmojis(data.story), 32, y, 155, 5.5); y += 8;

    doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 10;

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(217, 56, 41); doc.text('PAYLOAD:', 32, y);
    doc.setTextColor(40, 40, 40); doc.setFont('Helvetica', 'normal'); doc.text(data.payload, 62, y); y += 7;

    doc.setFont('Helvetica', 'bold'); doc.setTextColor(217, 56, 41); doc.text('FRACHT:', 32, y);
    doc.setTextColor(40, 40, 40); doc.setFont('Helvetica', 'normal'); doc.text(data.cargo, 62, y); y += 14;

    doc.setDrawColor(180, 175, 160); doc.setFillColor(248, 243, 228); doc.setLineWidth(0.3);
    doc.roundedRect(32, y - 4, 158, 50, 2, 2, 'FD'); y += 4;
    
    const col1 = 38, col2 = 110;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(217, 56, 41); doc.text('STRECKE:', col1, y);
    doc.setTextColor(40, 40, 40); doc.text(data.distance, col1 + 35, y);
    doc.setTextColor(217, 56, 41); doc.text('KURS:', col2, y);
    doc.setTextColor(40, 40, 40); doc.text(data.heading, col2 + 25, y); y += 8;
    doc.setTextColor(217, 56, 41); doc.text('ETE CA:', col1, y);
    doc.setTextColor(40, 40, 40); doc.text(data.totalTimeStr, col1 + 35, y);
    doc.setTextColor(217, 56, 41); doc.text('FUEL:', col2, y);
    doc.setTextColor(40, 40, 40); doc.text(`${data.totalFuel} Gal`, col2 + 25, y); y += 8;
    doc.setTextColor(217, 56, 41); doc.text('AIRCRAFT:', col1, y);
    doc.setTextColor(40, 40, 40); doc.text(data.aircraft, col1 + 35, y);
    doc.setTextColor(217, 56, 41); doc.text('TAS:', col2, y);
    doc.setTextColor(40, 40, 40); doc.text(`${data.tas} kts`, col2 + 25, y); y += 8;
    doc.setTextColor(217, 56, 41); doc.text('GPH:', col1, y);
    doc.setTextColor(40, 40, 40); doc.text(`${data.gph} gal/h`, col1 + 35, y);
    doc.setTextColor(217, 56, 41); doc.text('DATUM:', col2, y);
    doc.setTextColor(40, 40, 40); doc.text(`${data.date} ${data.time}`, col2 + 25, y); y += 24;

    if (mapImage) {
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text('ROUTE MAP', 32, y); y += 4;
        const maxW = 158; const maxH = Math.min(100, 280 - y); const ratio = mapImage.width / mapImage.height;
        let imgW, imgH; if (ratio > maxW / maxH) { imgW = maxW; imgH = maxW / ratio; } else { imgH = maxH; imgW = maxH * ratio; }
        const imgX = 32 + (maxW - imgW) / 2;
        doc.setFillColor(230, 225, 210); doc.rect(imgX - 2, y - 2, imgW + 4, imgH + 4, 'F');
        doc.setDrawColor(160, 155, 140); doc.setLineWidth(0.5); doc.rect(imgX - 2, y - 2, imgW + 4, imgH + 4, 'S');
        doc.addImage(mapImage.data, 'JPEG', imgX, y, imgW, imgH);
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function drawRouteNavigationPage(doc, data, legs) {
    let y = 30;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(11, 31, 101); doc.text('ROUTE & NAVIGATION', 32, y); y += 4;
    doc.setDrawColor(11, 31, 101); doc.setLineWidth(0.5); doc.line(32, y, 190, y); y += 10;

    doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
    const wpNames = [data.depICAO || currentStartICAO];
    for (let i = 1; i < routeWaypoints.length - 1; i++) wpNames.push(`WP${i}`);
    if (routeWaypoints.length > 1) wpNames.push(data.isPOI ? 'POI' : (data.destICAO || currentDestICAO));
    doc.text(wpNames.join(' -> '), 32, y); y += 8;

    const tableX = 32, colWidths = [10, 42, 16, 16, 16, 16, 16];
    const tableW = colWidths.reduce((a, b) => a + b, 0), rowH = 10;

    doc.setFillColor(220, 215, 200); doc.rect(tableX, y, tableW, 7, 'F');
    doc.setDrawColor(160, 155, 140); doc.rect(tableX, y, tableW, 7, 'S');

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
    doc.text('LEG', tableX + 2, y + 5); doc.text('ROUTE', tableX + colWidths[0] + 2, y + 5); doc.text('FREQ', tableX + colWidths[0] + colWidths[1] + 2, y + 5);
    doc.text('HDG', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 5); doc.text('DIST', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 5);
    doc.text('TIME', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 2, y + 5); doc.text('FUEL', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + 2, y + 5);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    let totalTime = 0, totalFuel = 0;
    legs.forEach((leg, i) => {
        totalTime += leg.time; totalFuel += parseFloat(leg.fuel);
        if (i % 2 === 0) { doc.setFillColor(250, 246, 235); doc.rect(tableX, y, tableW, rowH, 'F'); }
        doc.setDrawColor(200, 195, 180); doc.rect(tableX, y, tableW, rowH, 'S');

        doc.setTextColor(40, 40, 40); doc.setFontSize(8); doc.text(`${i + 1}`, tableX + 3, y + 6);
        doc.text(`${leg.from}`, tableX + colWidths[0] + 2, y + 4); doc.text(`-> ${leg.to}`, tableX + colWidths[0] + 2, y + 8.5);

        doc.setFontSize(7); doc.setTextColor(11, 31, 101);
        if (leg.f1) doc.text(leg.f1, tableX + colWidths[0] + colWidths[1] + 2, y + 4);
        if (leg.f2) doc.text(leg.f2, tableX + colWidths[0] + colWidths[1] + 2, y + 8.5);

        doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        doc.text(`${leg.heading}\u00B0`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 6);
        doc.text(`${leg.dist} NM`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 6);
        doc.text(`${leg.time} m`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 2, y + 6);
        doc.text(`${leg.fuel} G`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + 2, y + 6);
        y += rowH;
    });

    doc.setFillColor(210, 205, 190); doc.rect(tableX, y, tableW, 7, 'F');
    doc.setDrawColor(160, 155, 140); doc.rect(tableX, y, tableW, 7, 'S');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(11, 31, 101);
    doc.text('TOTAL', tableX + colWidths[0] + 2, y + 5);
    doc.text(`${data.totalDist} NM`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 5);
    doc.text(`${totalTime} m`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 2, y + 5);
    doc.text(`${totalFuel.toFixed(1)} G`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + 2, y + 5);
    y += 13;

    doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 6;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text('PERFORMANCE', 32, y); y += 8;

    doc.setFontSize(9); const pc = [34, 66, 98, 130, 162];
    const items = [ ['AC', data.aircraft], ['TAS', `${data.tas} kts`], ['GPH', `${data.gph} gal/h`], ['ETE', data.totalTimeStr], ['FUEL', `${data.totalFuel} Gal`] ];
    items.forEach((item, i) => {
        doc.setFont('Helvetica', 'bold'); doc.setTextColor(217, 56, 41); doc.text(item[0], pc[i], y);
        doc.setFont('Helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(item[1], pc[i], y + 5);
    });

    const vpCanvas = document.getElementById('verticalProfileCanvas');
    if (vpCanvas && vpCanvas.width > 0 && vpCanvas.height > 0) {
        try {
            const vpDataUrl = vpCanvas.toDataURL('image/png', 1.0);
            const vpW = 158; const vpH = (vpCanvas.height / vpCanvas.width) * vpW; y += 12;
            doc.addImage(vpDataUrl, 'PNG', 32, y, vpW, vpH);
            doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.rect(32, y, vpW, vpH); y += vpH;
        } catch (e) { }
    }
    y += 14;

    doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 6;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text('AIRSPACE WARNINGS', 32, y); y += 8;

    let finalAirspaces = activeAirspaces || [];
    if (finalAirspaces.length === 0) {
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 140, 40); doc.text('Route frei - keine Konflikte erkannt.', 34, y);
    } else {
        for (let i = 0; i < finalAirspaces.length; i++) {
            if (y > 278) { doc.setFont('Helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.text(`... und ${finalAirspaces.length - i} weitere`, 38, y); break; }
            const a = finalAirspaces[i]; const style = getAirspaceStyle(a); const displayName = getAirspaceDisplayName(a);
            const rgb = hexToRgb(style.color);
            if (rgb) { doc.setFillColor(rgb.r, rgb.g, rgb.b); doc.circle(35, y - 1.2, 1.2, 'F'); }
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
            const catTag = `[${style.category}]`; doc.text(catTag, 38, y);
            doc.setFont('Helvetica', 'normal'); doc.text(displayName, 38 + doc.getTextWidth(catTag) + 1, y);
            if (a.lowerLimit && a.upperLimit) {
                const fmtLmt = (lim) => {
                    if (!lim) return '?'; if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
                    if (lim.unit === 6) return `FL ${lim.value}`;
                    return `${lim.value} ${lim.unit === 1 ? 'FT' : 'M'}${lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '')}`;
                };
                doc.setFontSize(7); doc.setTextColor(100, 100, 100); doc.text(`${fmtLmt(a.lowerLimit)} - ${fmtLmt(a.upperLimit)}`, 190, y, { align: 'right' });
            }
            if (a.frequencies && a.frequencies.length > 0) {
                const primary = a.frequencies.find(f => f.primary) || a.frequencies[0];
                if (primary && primary.value) { y += 3.5; doc.setFontSize(7); doc.setTextColor(11, 31, 101); doc.setFont('Helvetica', 'bold'); doc.text(`${primary.name || 'FREQ'}: ${primary.value}`, 38, y); }
            }
            y += 5;
        }
    }
}

function drawAirportInfoPage(doc, type, data, photo, detailMap, metarImg) {
    let y = 30; const isDep = (type === 'dep'); const isPOI = (!isDep && data.isPOI);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(11, 31, 101); doc.text(isPOI ? 'ZIELPUNKT INFO' : (isDep ? 'DEPARTURE AIRPORT' : 'DESTINATION AIRPORT'), 32, y); y += 4;
    doc.setDrawColor(11, 31, 101); doc.setLineWidth(0.5); doc.line(32, y, 190, y); y += 14;

    const photoYStart = y - 2;
    if (photo) { try { doc.addImage(photo, 'JPEG', 152, photoYStart, 38, 28); doc.setDrawColor(200, 195, 180); doc.setLineWidth(0.4); doc.rect(151, photoYStart - 1, 40, 34); } catch (e) { } }

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(11, 31, 101); doc.text(isDep ? data.depICAO : data.destICAO, 32, y); y += 7;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(14); doc.setTextColor(60, 60, 60); doc.text(isDep ? data.depName : data.destName, 32, y); y += 7;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.text(`Coords: ${isDep ? data.depCoords : data.destCoords}`, 32, y);
    y = photo ? Math.max(y + 6, photoYStart + 36) : y + 6;
    doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 8;

    if (!isPOI) {
        let blockY = y;
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(217, 56, 41); doc.text('RUNWAYS', 32, blockY); doc.text('FREQUENZEN', 115, blockY);
        let rwyY = blockY + 7, freqY = blockY + 7;
        const rwy = isDep ? data.depRwy : data.destRwy, freq = isDep ? data.depFreq : data.destFreq;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        if (rwy && rwy !== 'Sucht Pisten-Infos...' && rwy !== 'Keine Daten gefunden') { rwy.split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(r => r.trim()).forEach(r => { doc.text(stripEmojis(r.trim()), 34, rwyY); rwyY += 6; }); }
        else { doc.setTextColor(120, 120, 120); doc.text('Keine Pistendaten verfuegbar.', 34, rwyY); rwyY += 6; }
        doc.setTextColor(11, 31, 101);
        if (freq && !freq.includes('Sucht Frequenz') && freq.trim() !== '') { stripEmojis(freq).split('\n').filter(l => l.trim()).forEach(line => { doc.text(line.trim(), 117, freqY); freqY += 6; }); }
        else { doc.setTextColor(120, 120, 120); doc.text('Keine Frequenzdaten verfuegbar.', 117, freqY); freqY += 6; }
        y = Math.max(rwyY, freqY) + 4;
        doc.setDrawColor(100, 100, 100); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 8;
    }

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(11, 31, 101); doc.text(isPOI ? 'INFO' : 'AIRPORT INFO', 32, y); y += 7;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    const desc = isDep ? data.depDesc : data.destDesc;
    if (desc && desc !== 'Warte auf Daten...') { const trimmedDesc = desc.length > 600 ? desc.substring(0, 600) + '...' : desc; y = pdfWrappedText(doc, trimmedDesc, 32, y, 155, 5.5); }
    else { doc.text('Keine weiteren Informationen verfuegbar.', 32, y); y += 6; }

    if (detailMap || metarImg) {
        y = Math.max(y + 6, 170); doc.setDrawColor(100, 100, 100); doc.setLineDashPattern([2, 2], 0); doc.line(32, y, 190, y); doc.setLineDashPattern([], 0); y += 6;
        const hasMetar = metarImg && metarImg.data && !isPOI; const mapAvailW = hasMetar ? 95 : 155; const maxH = Math.min(100, 280 - y);
        if (detailMap) {
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text(isPOI ? 'KARTE' : `PLATZKARTE`, 32, y); const mapLabelY = y; y += 5;
            const mapRatio = 700 / 360; let mapW, mapH; if (mapAvailW / maxH < mapRatio) { mapW = mapAvailW; mapH = mapW / mapRatio; } else { mapH = maxH; mapW = mapH * mapRatio; }
            doc.setFillColor(230, 225, 210); doc.rect(31, y - 1, mapW + 2, mapH + 2, 'F'); doc.setDrawColor(160, 155, 140); doc.setLineWidth(0.4); doc.rect(31, y - 1, mapW + 2, mapH + 2, 'S'); doc.addImage(detailMap, 'JPEG', 32, y, mapW, mapH);
            if (hasMetar) {
                const metarX = 32 + mapAvailW + 4; const metarAvailW = 190 - metarX;
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text('METAR', metarX, mapLabelY);
                const metarRatio = metarImg.ratio || 1.5; let metarW = metarAvailW; let metarH = metarW / metarRatio; if (metarH > mapH) { metarH = mapH; metarW = metarH * metarRatio; }
                doc.setFillColor(240, 236, 224); doc.rect(metarX - 1, y - 1, metarW + 2, metarH + 2, 'F'); doc.setDrawColor(160, 155, 140); doc.setLineWidth(0.4); doc.rect(metarX - 1, y - 1, metarW + 2, metarH + 2, 'S');
                try { doc.addImage(metarImg.data, 'PNG', metarX, y, metarW, metarH); } catch (e) { }
            }
        } else if (hasMetar) {
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101); doc.text('METAR', 32, y); y += 5;
            const metarRatio = metarImg.ratio || 1.5; let metarW = 155; let metarH = metarW / metarRatio; if (metarH > maxH) { metarH = maxH; metarW = metarH * metarRatio; }
            doc.setFillColor(240, 236, 224); doc.rect(31, y - 1, metarW + 2, metarH + 2, 'F'); doc.setDrawColor(160, 155, 140); doc.setLineWidth(0.4); doc.rect(31, y - 1, metarW + 2, metarH + 2, 'S');
            try { doc.addImage(metarImg.data, 'PNG', 32, y, metarW, metarH); } catch (e) { }
        }
    }
}

async function captureMetarWidget(containerId) {
    if (!window.html2canvas) return null;
    try {
        const container = document.getElementById(containerId);
        if (!container || container.style.display === 'none' || !container.innerHTML.trim()) return null;
        if (container.innerHTML.includes('Sucht lokales') || container.innerHTML.includes('Fehler')) return null;
        const ratio = container.offsetWidth / container.offsetHeight;
        // Metar-Widgets dürfen html2canvas nutzen, da sie nur lokales HTML ohne externe/vergiftete Bilder enthalten!
        const canvas = await html2canvas(container, { backgroundColor: '#f0eada', scale: 2, useCORS: true, logging: false });
        return { data: canvas.toDataURL('image/png'), ratio: ratio };
    } catch (e) { return null; }
}

window.generateBriefingPDF = async function() {
    if (!currentMissionData || document.getElementById("briefingBox").style.display !== "block") {
        alert('Kein aktives Briefing vorhanden.'); return;
    }
    if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending()) {
        alert('Mission ist noch ein Entwurf. Bitte erst akzeptieren, dann als Briefing Pack exportieren.');
        return;
    }

    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = '\uD83D\uDCC4 Lade PDF-Export...';

    try {
        await ensureBriefingPdfLibraries();
    } catch (e) {
        if (indicator) indicator.innerText = 'PDF-Bibliothek konnte nicht geladen werden.';
        alert('PDF-Bibliothek konnte nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.');
        return;
    }

    if (indicator) indicator.innerText = '\uD83D\uDCC4 Erstelle Briefing Pack PDF...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const data = gatherBriefingData();
        const legs = computeLegs();
        const isPOI = data.isPOI;
        const totalPages = isPOI ? 3 : 4;

        const mapImagePromise = captureMapForPDF();
        const depLL = routeWaypoints[0];
        const destLL = routeWaypoints[routeWaypoints.length - 1];
        const detailZoom = 12;
        const depDetailPromise = renderTileCanvas(depLL.lat, depLL.lng || depLL.lon, detailZoom, 700, 360);
        const destDetailPromise = renderTileCanvas(destLL.lat, destLL.lng || destLL.lon, detailZoom, 700, 360);

        const depPhotoUrl = extractImageUrl(document.getElementById('wikiDepImage'));
        const destPhotoUrl = extractImageUrl(document.getElementById('wikiDestImage'));
        const depMetarPromise = captureMetarWidget('metarContainerDep');
        const destMetarPromise = isPOI ? Promise.resolve(null) : captureMetarWidget('metarContainerDest');

        const [depPhoto, destPhoto, depDetail, destDetail, depMetar, destMetar] = await Promise.all([
            depPhotoUrl ? getImageAsBase64(depPhotoUrl) : Promise.resolve(null),
            destPhotoUrl ? getImageAsBase64(destPhotoUrl) : Promise.resolve(null),
            depDetailPromise,
            destDetailPromise,
            depMetarPromise,
            destMetarPromise
        ]);

        const mapImage = await mapImagePromise;

        doc.setProperties({ title: `Briefing Pack - ${data.depICAO} to ${isPOI ? 'POI' : data.destICAO}` });

        drawNotebookBackground(doc, 1, totalPages); drawMissionBriefingPage(doc, data, mapImage);
        doc.addPage();
        drawNotebookBackground(doc, 2, totalPages); drawRouteNavigationPage(doc, data, legs);
        doc.addPage();
        drawNotebookBackground(doc, 3, totalPages); drawAirportInfoPage(doc, 'dep', data, depPhoto, depDetail, depMetar);
        
        if (!isPOI) {
            doc.addPage();
            drawNotebookBackground(doc, 4, totalPages); drawAirportInfoPage(doc, 'dest', data, destPhoto, destDetail, destMetar);
        }

        const filename = `Briefing_${data.depICAO}_${isPOI ? 'Rundflug' : data.destICAO}_${data.date.replace(/\./g, '')}.pdf`;
        doc.save(filename);

        if (indicator) indicator.innerText = '\uD83D\uDCC4 Briefing Pack PDF erstellt!';
        setTimeout(() => { if (indicator) indicator.innerText = 'System bereit.'; }, 4000);
    } catch (e) {
        console.error('PDF generation failed:', e);
        if (indicator) indicator.innerText = '\u274C PDF-Erstellung fehlgeschlagen.';
        alert('PDF konnte nicht erstellt werden: ' + e.message);
    }
};

// ==========================================
// V87: MSFS .PLN EXPORT / IMPORT & TRANSFER HUB
// ==========================================
window.openTransferModal = function() {
    document.getElementById('transferModalOverlay').style.display = 'flex';
};

window.closeTransferModal = function() {
    document.getElementById('transferModalOverlay').style.display = 'none';
};

const BUG_REPORT_EMAIL = 'info@vfr-multitool.de';

function _bugNowLabel() {
    return new Date().toLocaleString('de-DE');
}

function _bugDetectDeviceType() {
    const ua = String(navigator.userAgent || '').toLowerCase();
    const w = window.innerWidth || 0;
    const touch = Number(navigator.maxTouchPoints || 0);
    if (/ipad|tablet/.test(ua)) return 'tablet';
    if (/mobi|iphone|android/.test(ua)) return 'mobile';
    if (touch > 0 && w > 720 && w <= 1100) return 'tablet';
    return 'desktop';
}

function _bugSafeLocalStorageDump() {
    const out = {};
    const SENSITIVE = /(key|token|pin|secret|pass|auth)/i;
    const ALLOW_EXACT = new Set([
        'ga_theme',
        'ga_panel_theme',
        'ga_weather_source',
        'ga_weather_render_mode',
        'ga_ai_enabled',
        'awm_warn_terrain',
        'awm_read_freq',
        'awm_volume',
        'awm_voice_pack'
    ]);
    const ALLOW_PREFIX = [
        'ga_show_',
        'ga_map_hint_'
    ];
    try {
        const maxItems = Math.min(localStorage.length || 0, 260);
        for (let i = 0; i < maxItems; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            const isAllowed = ALLOW_EXACT.has(k) || ALLOW_PREFIX.some(p => k.startsWith(p));
            if (!isAllowed) continue;
            if (SENSITIVE.test(k)) {
                out[k] = '[redacted]';
                continue;
            }
            let v = '';
            try { v = localStorage.getItem(k) || ''; } catch (_) { v = ''; }
            out[k] = v.length > 220 ? `${v.slice(0, 220)}...` : v;
        }
    } catch (_) {}
    return out;
}

function _bugGetRouteSnapshot() {
    const route = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
    const points = route.slice(0, 220).map(p => ({
        lat: Number((Number(p?.lat) || 0).toFixed(6)),
        lon: Number((Number(p?.lng ?? p?.lon) || 0).toFixed(6)),
        name: String(p?.name || '').slice(0, 30)
    }));
    return {
        startIcao: String((typeof currentStartICAO !== 'undefined' ? currentStartICAO : '') || ''),
        destIcao: String((typeof currentDestICAO !== 'undefined' ? currentDestICAO : '') || ''),
        startName: String((typeof currentSName !== 'undefined' ? currentSName : '') || ''),
        destName: String((typeof currentDName !== 'undefined' ? currentDName : '') || ''),
        waypointCount: points.length,
        waypoints: points,
        mission: _bugGetMissionSnapshot()
    };
}

function _bugGetMissionSnapshot() {
    let mission = (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
        ? currentMissionData
        : null;

    if (!mission) {
        try {
            const raw = localStorage.getItem('ga_active_mission');
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed.currentMissionData === 'object') {
                mission = parsed.currentMissionData;
            }
        } catch (_) {}
    }

    if (!mission) return null;

    const distNum = Number(mission.dist);
    const headingNum = Number(mission.heading);
    return {
        start: String(mission.start || (typeof currentStartICAO !== 'undefined' ? currentStartICAO : '') || ''),
        dest: String(mission.dest || (typeof currentDestICAO !== 'undefined' ? currentDestICAO : '') || ''),
        poiName: mission.poiName ? String(mission.poiName).slice(0, 120) : null,
        mission: String(mission.mission || '').slice(0, 260),
        dist: Number.isFinite(distNum) ? Number(distNum.toFixed(1)) : null,
        ac: String(mission.ac || (typeof selectedAC !== 'undefined' ? selectedAC : '') || '').slice(0, 80),
        heading: Number.isFinite(headingNum) ? Math.round(headingNum) : null,
        weatherBriefing: (mission.weatherBriefing && typeof mission.weatherBriefing === 'object') ? mission.weatherBriefing : null
    };
}

function _bugGetPaxTranscripts() {
    if (typeof window.paxVoiceGetLogEntries === 'function') {
        try {
            const arr = window.paxVoiceGetLogEntries();
            if (Array.isArray(arr)) return arr.slice(0, 250);
        } catch (_) {}
    }
    const raw = document.getElementById('paxLogBody')?.textContent || '';
    return raw
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 250)
        .map(line => ({ ts: '', type: 'log', msg: line }));
}

function _bugGetDebugLogs() {
    if (typeof window.gaGetDebugLogs === 'function') {
        try {
            const arr = window.gaGetDebugLogs();
            if (Array.isArray(arr)) return arr.slice(0, 700);
        } catch (_) {}
    }
    return [];
}

function _bugGetWeatherDebugText() {
    let text = '';
    if (typeof window.vpBuildWeatherDebugReport === 'function') {
        try { text = window.vpBuildWeatherDebugReport() || ''; } catch (_) { text = ''; }
    }
    if (!text) text = document.getElementById('weatherDebugBody')?.textContent || '';
    return text.trim().slice(0, 22000);
}

function _bugEmailTrimText(value = '', maxLen = 900) {
    const text = String(value || '').replace(/\s+\n/g, '\n').trim();
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function _bugEmailLogLine(entry = {}) {
    const ts = String(entry.ts || '').trim();
    const level = String(entry.level || 'log').toUpperCase();
    const msg = _bugEmailTrimText(entry.msg || '', 900);
    const extra = entry.extra ? ` ${_bugEmailTrimText(JSON.stringify(entry.extra), 420)}` : '';
    return `[${ts || 'no-ts'}] ${level}: ${msg}${extra}`;
}

function _bugBuildEmailReportBody() {
    const swVersion = document.getElementById('swVersionDisplay')?.innerText?.trim() || '';
    const logs = _bugGetDebugLogs().slice(-90).map(_bugEmailLogLine);
    const weatherDebug = _bugGetWeatherDebugText();
    const lines = [
        'Bitte hier kurz beschreiben, was passiert ist:',
        '',
        '',
        '--- App / Gerät ---',
        `Zeit: ${new Date().toISOString()}`,
        `Version: ${swVersion || 'unbekannt'}`,
        `URL: ${String(location.href || '')}`,
        `Browser: ${String(navigator.userAgent || '')}`,
        `Sprache: ${String(navigator.language || '')}`,
        `Zeitzone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`,
        `Viewport: ${window.innerWidth || 0}x${window.innerHeight || 0} @${window.devicePixelRatio || 1}`,
        `Online: ${navigator.onLine ? 'ja' : 'nein'}`,
        '',
        '--- Debug Log, gekürzt ---',
        logs.length ? logs.join('\n') : 'Keine Debug-Log-Einträge vorhanden.'
    ];
    if (weatherDebug) {
        lines.push('', '--- Weather/Debug Panel, gekürzt ---', _bugEmailTrimText(weatherDebug, 3600));
    }
    let body = lines.join('\n');
    const maxBodyLen = 7800;
    if (body.length > maxBodyLen) {
        body = `${body.slice(0, maxBodyLen)}\n\n--- gekürzt: Mail-Entwurf war zu lang ---`;
    }
    return body;
}

window.openBugReportEmailDraft = function() {
    const subject = `VFR Multitool Problembericht ${new Date().toLocaleDateString('de-DE')}`;
    const body = _bugBuildEmailReportBody();
    const href = `mailto:${BUG_REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        try { a.remove(); } catch (_) {}
    }, 0);
    return href;
};

window.openBugReportModal = function() {
    return window.openBugReportEmailDraft();
};

window.closeBugReportModal = function() {
    return false;
};

window.sendBugReport = async function() {
    return window.openBugReportEmailDraft();
};

function escapeMSFSXml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    }[ch]));
}

function normalizeMSFSIdent(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isMSFSAirportIdent(value) {
    const ident = normalizeMSFSIdent(value);
    return /^[A-Z0-9]{3,6}$/.test(ident) && !['GPS', 'POI', 'START', 'DEST', 'USER', 'CUSTOM'].includes(ident);
}

function sanitizeMSFSWaypointId(value, fallback) {
    const cleaned = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .replace(/\s+/g, '')
        .trim();
    return (cleaned || fallback || 'WP').substring(0, 12) || 'WP';
}

function _msfsDms(value) {
    const abs = Math.abs(Number(value) || 0);
    let totalSeconds = Math.round(abs * 360000) / 100;
    const deg = Math.floor(totalSeconds / 3600);
    totalSeconds -= deg * 3600;
    const min = Math.floor(totalSeconds / 60);
    const sec = (totalSeconds - min * 60).toFixed(2);
    return { deg, min, sec };
}

function formatMSFSCoords(lat, lon) {
    const latDir = Number(lat) >= 0 ? 'N' : 'S';
    const lonDir = Number(lon) >= 0 ? 'E' : 'W';
    const latDms = _msfsDms(lat);
    const lonDms = _msfsDms(lon);
    return `${latDir}${latDms.deg}* ${latDms.min}' ${String(latDms.sec).padStart(5, '0')}", ${lonDir}${String(lonDms.deg).padStart(3, '0')}* ${lonDms.min}' ${String(lonDms.sec).padStart(5, '0')}"`;
}

function formatMSFSElevation(altFt) {
    const raw = Number(altFt);
    const value = Number.isFinite(raw) ? Math.max(-1500, Math.min(60000, raw)) : 0;
    const sign = value < 0 ? '-' : '+';
    return `${sign}${String(Math.abs(value).toFixed(2)).padStart(9, '0')}`;
}

function parseMSFSCoords(coordStr) {
    const regex = /([NS])\s*(\d+)[°*]\s*(\d+)'\s*([\d.]+)"?,\s*([EW])\s*(\d+)[°*]\s*(\d+)'\s*([\d.]+)"?/i;
    const match = coordStr.match(regex);
    if (!match) return null;
    let lat = parseInt(match[2]) + parseInt(match[3])/60 + parseFloat(match[4])/3600;
    if (match[1].toUpperCase() === 'S') lat = -lat;
    let lon = parseInt(match[6]) + parseInt(match[7])/60 + parseFloat(match[8])/3600;
    if (match[5].toUpperCase() === 'W') lon = -lon;
    return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lon.toFixed(6)) };
}

function missionMSFSUsesSarHeliCustomDestination(lastWp = null) {
    if (lastWp?.isSarHeliHospital === true) return true;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
        ? currentMissionData
        : null;
    if (!md) return false;
    try {
        if (typeof missionIsSarHeliMission === 'function' && missionIsSarHeliMission(md)) return true;
    } catch (_) {}
    const contract = md.missionContract || md.missionContractV4 || md._missionContractV4 || null;
    const sarHeli = md.sarHeli || contract?.sarHeli || null;
    return !!(sarHeli && sarHeli.enabled);
}

function getMSFSWaypointProfileAlt(index) {
    const profileAlt = typeof vpAltWaypoints !== 'undefined' && vpAltWaypoints && vpAltWaypoints[index]
        ? Number(vpAltWaypoints[index].altFt)
        : NaN;
    return Number.isFinite(profileAlt) ? profileAlt : NaN;
}

function getMSFSWaypointAltFt(wp = null, index = -1, fallbackAlt = 0) {
    const explicitAlt = Number(wp?.altFt ?? wp?.elevationFt);
    if (Number.isFinite(explicitAlt)) return explicitAlt;
    const profileAlt = getMSFSWaypointProfileAlt(index);
    if (Number.isFinite(profileAlt)) return profileAlt;
    return Number.isFinite(Number(fallbackAlt)) ? Number(fallbackAlt) : 0;
}

window.exportMSFS = function() {
    if (!currentMissionData || routeWaypoints.length < 2) { alert("Kein aktiver Flugplan!"); return; }
    if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending()) {
        alert("Mission ist noch ein Entwurf. Bitte erst akzeptieren, dann als MSFS-Plan exportieren.");
        return;
    }
    const cruiseAlt = Number(document.getElementById('altSlider')?.value) || 4500;
    const firstWp = routeWaypoints[0];
    const lastWp = routeWaypoints[routeWaypoints.length - 1];
    const sarHeliCustomDestination = missionMSFSUsesSarHeliCustomDestination(lastWp);
    const departureAirport = isMSFSAirportIdent(currentStartICAO);
    const destinationAirport = isMSFSAirportIdent(currentDestICAO) && !sarHeliCustomDestination;
    const departureId = departureAirport ? normalizeMSFSIdent(currentStartICAO) : sanitizeMSFSWaypointId(firstWp?.name, 'START');
    const destinationId = destinationAirport ? normalizeMSFSIdent(currentDestICAO) : sanitizeMSFSWaypointId(lastWp?.name, 'DEST');
    const depElevRaw = typeof currentDepElev !== 'undefined' ? currentDepElev : 0;
    const destElevRaw = typeof currentDestElev !== 'undefined' ? currentDestElev : 0;
    const depElevation = Number.isFinite(Number(depElevRaw)) ? Number(depElevRaw) : 0;
    const destElevation = Number.isFinite(Number(destElevRaw)) ? Number(destElevRaw) : 0;
    const destinationElevation = destinationAirport
        ? destElevation
        : (sarHeliCustomDestination ? getMSFSWaypointAltFt(lastWp, routeWaypoints.length - 1, cruiseAlt) : 0);
    const depName = typeof currentSName !== 'undefined' ? currentSName : '';
    const destName = typeof currentDName !== 'undefined' ? currentDName : '';
    const planTitle = `${departureId} to ${destinationId}`;
    const planDescr = String(currentMissionData.mission || planTitle).slice(0, 180);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<SimBase.Document Type="AceXML" version="1,0">\n  <Descr>AceXML Document</Descr>\n  <FlightPlan.FlightPlan>\n    <Title>${escapeMSFSXml(planTitle)}</Title>\n    <FPType>VFR</FPType>\n    <CruisingAlt>${escapeMSFSXml(cruiseAlt.toFixed(0))}</CruisingAlt>\n    <DepartureID>${escapeMSFSXml(departureId)}</DepartureID>\n    <DepartureLLA>${formatMSFSCoords(firstWp.lat, firstWp.lng || firstWp.lon)}, ${formatMSFSElevation(departureAirport ? depElevation : 0)}</DepartureLLA>\n    <DestinationID>${escapeMSFSXml(destinationId)}</DestinationID>\n    <DestinationLLA>${formatMSFSCoords(lastWp.lat, lastWp.lng || lastWp.lon)}, ${formatMSFSElevation(destinationElevation)}</DestinationLLA>\n    <Descr>${escapeMSFSXml(planDescr)}</Descr>\n    <DepartureName>${escapeMSFSXml(depName || departureId)}</DepartureName>\n    <DestinationName>${escapeMSFSXml(destName || destinationId)}</DestinationName>\n    <AppVersion>\n      <AppVersionMajor>11</AppVersionMajor>\n      <AppVersionBuild>282174</AppVersionBuild>\n    </AppVersion>\n`;
    
    routeWaypoints.forEach((wp, i) => {
        const isFirst = i === 0;
        const isLast = i === routeWaypoints.length - 1;
        const airportIdent = isFirst && departureAirport
            ? departureId
            : (isLast && destinationAirport ? destinationId : '');
        const wpName = airportIdent || (isLast ? destinationId : sanitizeMSFSWaypointId(wp.name, `WP${i}`));
        const wpType = airportIdent ? 'Airport' : 'User';
        const alt = airportIdent
            ? (isFirst ? depElevation : destElevation)
            : getMSFSWaypointAltFt(wp, i, cruiseAlt);
        xml += `    <ATCWaypoint id="${escapeMSFSXml(wpName)}">\n      <ATCWaypointType>${wpType}</ATCWaypointType>\n      <WorldPosition>${formatMSFSCoords(wp.lat, wp.lng || wp.lon)}, ${formatMSFSElevation(alt)}</WorldPosition>\n      <SpeedMaxFP>-1</SpeedMaxFP>\n`;
        if (airportIdent) {
            xml += `      <ICAO>\n        <ICAOIdent>${escapeMSFSXml(airportIdent)}</ICAOIdent>\n      </ICAO>\n`;
        }
        xml += `    </ATCWaypoint>\n`;
    });
    xml += `  </FlightPlan.FlightPlan>\n</SimBase.Document>`;
    
    const blob = new Blob([xml], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `VFR_${departureId}_to_${destinationId}.pln`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    closeTransferModal();
};

let pendingMSFSImport = null;

window.importMSFS = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        document.getElementById('msfsFileInput').value = ''; 
        
        const backupMatch = content.match(/GA_DISPATCHER_BACKUP\[(.*?)\]/);
        if (backupMatch && backupMatch[1]) {
            let backupState = null;
            try {
                const decoded = decodeURIComponent(atob(backupMatch[1]));
                backupState = JSON.parse(decoded);
                if (typeof window.isMissionDraftPending === 'function' && window.isMissionDraftPending(backupState)) {
                    alert("Der MSFS-Plan enthaelt nur einen Dispatcher-Entwurf. Bitte erst akzeptieren und neu exportieren.");
                    return;
                }
            } catch(err) { console.warn("Backup Code fehlerhaft, parse regulär."); }
            if (backupState) {
                try {
                    localStorage.setItem('ga_active_mission', JSON.stringify(backupState));
                    const restored = await restoreMissionState(backupState, { source: 'msfs-import' });
                    if (restored === false) {
                        alert("❌ Der gespeicherte Dispatcher-Flug konnte nicht geladen werden.");
                        return;
                    }
                } catch(err) {
                    console.warn("Backup Restore fehlgeschlagen:", err);
                    alert("❌ Der gespeicherte Dispatcher-Flug konnte nicht geladen werden.");
                    return;
                }
                closeTransferModal();
                alert("✅ Eigener Flugplan inkl. KI-Briefing erfolgreich wiederhergestellt!");
                setTimeout(() => {
                    if (typeof map !== 'undefined' && map && routeWaypoints.length >= 2) {
                        map.fitBounds(L.latLngBounds(routeWaypoints), { padding: [40, 40] });
                        updateMiniMap();
                    }
                }, 300);
                return;
            }
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const waypoints = xmlDoc.getElementsByTagName("ATCWaypoint");
        if (!waypoints || waypoints.length < 2) { alert("Keine gültigen Wegpunkte in dieser .pln gefunden."); return; }

        let newRoute = [];
        let startIcao = xmlDoc.getElementsByTagName("DepartureID")[0]?.textContent || "START";
        let destIcao = xmlDoc.getElementsByTagName("DestinationID")[0]?.textContent || "DEST";
        
        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const wpId = wp.getAttribute("id") || `WP${i}`;
            const posTag = wp.getElementsByTagName("WorldPosition")[0];
            if (posTag) {
                const coords = parseMSFSCoords(posTag.textContent);
                if (coords) {
                    coords.name = wpId;
                    newRoute.push(coords);
                }
            }
        }

        if (newRoute.length < 2) { alert("Koordinaten konnten nicht gelesen werden."); return; }

        const cruiseAltTag = xmlDoc.getElementsByTagName("CruisingAlt")[0];
        let cruiseAlt = cruiseAltTag ? parseInt(cruiseAltTag.textContent) : 4500;
        if (isNaN(cruiseAlt) || cruiseAlt < 1000) cruiseAlt = 4500;

        pendingMSFSImport = { newRoute, startIcao, destIcao, cruiseAlt };
        
        closeTransferModal();
        document.getElementById('importActionText').innerText = `Externe Route (${newRoute.length} Wegpunkte) erkannt!\nWie möchtest du diesen Flugplan laden?`;
        document.getElementById('importActionModalOverlay').style.display = 'flex';
    };
    reader.readAsText(file);
};

window.cancelMSFSImport = function() {
    document.getElementById('importActionModalOverlay').style.display = 'none';
    pendingMSFSImport = null;
};

window.executeMSFSImport = async function(mode) {
    document.getElementById('importActionModalOverlay').style.display = 'none';
    if (!pendingMSFSImport) return;
    
    const { newRoute, startIcao, destIcao, cruiseAlt } = pendingMSFSImport;
    pendingMSFSImport = null;
    
    routeWaypoints = newRoute;
    currentStartICAO = startIcao;
    currentDestICAO = destIcao;
    
    const sData = await getAirportData(startIcao);
    const dData = await getAirportData(destIcao);
    currentSName = sData ? (sData.n || startIcao) : startIcao;
    currentDName = dData ? (dData.n || destIcao) : destIcao;
    
    const nav = calcNav(newRoute[0].lat, newRoute[0].lng, newRoute[newRoute.length-1].lat, newRoute[newRoute.length-1].lng);
    let totalDist = 0;
    for (let i = 0; i < newRoute.length - 1; i++) {
         totalDist += calcNav(newRoute[i].lat, newRoute[i].lng, newRoute[i+1].lat, newRoute[i+1].lng).dist;
    }
    
    document.getElementById('startLoc').value = startIcao;
    document.getElementById('destLoc').value = destIcao;
    if (document.getElementById('altSlider')) {
        document.getElementById('altSlider').value = cruiseAlt;
        handleSliderChange('alt', cruiseAlt);
    }

    if (mode === 'ki') {
        const maxSeats = parseInt(document.getElementById("maxSeats")?.value || 4);
        const paxText = `${Math.floor(Math.random() * Math.max(1, maxSeats - 1)) + 1} PAX`;
        const cargoText = `${Math.floor(Math.random() * 300) + 20} lbs`;
        
        document.getElementById('searchIndicator').innerText = "Kontaktiere KI-Dispatcher...";
        
        const isPOI = (startIcao === destIcao);
        let m = await fetchGeminiMission(currentSName, currentDName, totalDist, isPOI, paxText, cargoText);
        
        // Lokaler Fallback, falls Gemini aus ist oder abbricht
        if (!m) {
            const availM = typeof missions !== 'undefined' ? missions.filter(ms => (totalDist < 50 || ms.cat === "std")) : [{ t: "Privater Flugplan", s: "Standard Flug nach Instrumenten oder Sicht." }];
            let history = JSON.parse(localStorage.getItem('ga_std_history')) || [];
            let freshM = availM.filter(ms => !history.includes(ms.t));
            if (freshM.length === 0) { freshM = availM; history = []; }
            m = freshM[Math.floor(Math.random() * freshM.length)] || availM[0];
            history.push(m.t);
            if (history.length > 30) history.shift();
            localStorage.setItem('ga_std_history', JSON.stringify(history));
            if (m.cat === "trn" || m.cat === "cargo") { m.pax = "0 PAX"; }
            m.i = "📋";
        }
        
        let missionTitle = `${m.i ? m.i + ' ' : ''}${m.t}`;
        let missionStory = m.s;
        let finalPax = m.pax || paxText;
        let finalCargo = m.cargo || cargoText;
        
        currentMissionData = { start: startIcao, dest: destIcao, poiName: isPOI ? currentDName : null, mission: missionTitle, dist: totalDist, ac: typeof selectedAC !== 'undefined' ? selectedAC : "N/A", heading: nav.brng };
        populateBriefingUI(missionTitle, missionStory, finalPax, finalCargo, isPOI, newRoute, sData, dData);
        
    } else {
        const isPOI = (startIcao === destIcao);
        currentMissionData = { start: startIcao, dest: destIcao, poiName: isPOI ? currentDName : null, mission: "Privater Import-Flug", dist: totalDist, ac: typeof selectedAC !== 'undefined' ? selectedAC : "N/A", heading: nav.brng };
        populateBriefingUI("Privater Flugplan", "Externer Flugplan importiert aus Microsoft Flight Simulator.", "N/A", "N/A", isPOI, newRoute, sData, dData);
    }
};

function populateBriefingUI(mTitle, mStory, mPax, mCargo, isPOI, newRoute, sData, dData) {
    const isGpsStart = currentStartICAO === 'GPS';
    document.getElementById("mTitle").innerHTML = mTitle;
    document.getElementById("mStory").innerText = mStory;
    
    document.getElementById("mDepICAO").innerText = currentStartICAO;
    document.getElementById("mDepName").innerText = currentSName;
    document.getElementById("mDepCoords").innerText = sData ? `${sData.lat.toFixed(4)}, ${sData.lon.toFixed(4)}` : `${newRoute[0].lat.toFixed(4)}, ${newRoute[0].lng.toFixed(4)}`;
    
    const wikiDepNameEl = document.getElementById('wikiDepNameDisplay');
    if (wikiDepNameEl) wikiDepNameEl.innerText = `${currentStartICAO} – ${currentSName}`;

    document.getElementById("destIcon").innerText = isPOI ? "🎯" : "🛬";
    document.getElementById("mDestICAO").innerText = isPOI ? "POI" : currentDestICAO;
    document.getElementById("mDestName").innerText = currentDName;
    document.getElementById("mDestCoords").innerText = dData ? `${dData.lat.toFixed(4)}, ${dData.lon.toFixed(4)}` : `${newRoute[newRoute.length-1].lat.toFixed(4)}, ${newRoute[newRoute.length-1].lng.toFixed(4)}`;
    
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    if (wikiDestNameEl) wikiDestNameEl.innerText = `${isPOI ? 'POI' : currentDestICAO} – ${currentDName}`;

    document.getElementById("mPay").innerText = mPax; 
    document.getElementById("mWeight").innerText = mCargo;
    
    document.getElementById("destRwyContainer").style.display = isPOI ? "none" : "block";
    if (document.getElementById("wikiDestRwyText")) document.getElementById("wikiDestRwyText").style.display = isPOI ? "none" : "block";
    const depLinks = document.getElementById("wikiDepLinks"); if (depLinks) depLinks.style.display = isGpsStart ? "none" : "block";
    const destSwitchRow = document.getElementById("destSwitchRow"); if (destSwitchRow) destSwitchRow.style.display = isPOI ? "none" : "flex";
    const destLinks = document.getElementById("wikiDestLinks"); if (destLinks) destLinks.style.display = isPOI ? "none" : "block";

    document.getElementById("briefingBox").style.display = "block";
    
    if (isGpsStart) {
        document.getElementById("mDepRwy").innerText = "Live-Start";
    } else {
        fetchRunwayDetails(newRoute[0].lat, newRoute[0].lng, 'mDepRwy', currentStartICAO);
    }
    if (!isPOI) fetchRunwayDetails(newRoute[newRoute.length-1].lat, newRoute[newRoute.length-1].lng, 'mDestRwy', currentDestICAO);
    
    fetchAreaDescription(newRoute[0].lat, newRoute[0].lng, 'wikiDepDescText', isGpsStart ? 'Live GPS Position' : null, isGpsStart ? null : currentStartICAO, 'wikiDepImageContainer', 'wikiDepImage');
    fetchAreaDescription(newRoute[newRoute.length-1].lat, newRoute[newRoute.length-1].lng, 'wikiDestDescText', isPOI ? currentDName : null, isPOI ? null : currentDestICAO, 'wikiDestImageContainer', 'wikiDestImage');

    currentDepFreq = ""; currentDestFreq = "";
    if (isGpsStart) {
        const depFreqEl = document.getElementById('wikiDepFreqText');
        if (depFreqEl) depFreqEl.innerHTML = '<span style="color:#888;">Live GPS Start</span>';
    } else {
        fetchAirportFreq(currentStartICAO, 'wikiDepFreqText', 'dep');
    }
    if (!isPOI) fetchAirportFreq(currentDestICAO, 'wikiDestFreqText', 'dest');
    
    loadMetarWidget(isGpsStart ? null : currentStartICAO, 'metarContainerDep', newRoute[0].lat, newRoute[0].lng);
    loadMetarWidget(isPOI ? null : currentDestICAO, 'metarContainerDest', newRoute[newRoute.length-1].lat, newRoute[newRoute.length-1].lng);

    document.getElementById('searchIndicator').innerText = "Flugplan bereit.";
    
    // WICHTIG: renderMainRoute triggert das Vertical Profile (inkl. Wetter) sauber!
    renderMainRoute();
    map.fitBounds(L.latLngBounds(routeWaypoints), { padding: [40, 40] });
    
    setTimeout(() => { 
        updateMiniMap();
        // triggerVerticalProfileUpdate() hier entfernt, um Wetter-Abbruch zu verhindern
        window.debouncedSaveMissionState();
    }, 500);
}
