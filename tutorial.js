(function () {
    const TUTORIAL_SEEN_KEY = 'ga_onboarding_seen_v1';
    const TUTORIAL_LAST_STEP_KEY = 'ga_onboarding_last_step_v1';

    const state = {
        active: false,
        steps: [],
        index: 0,
        cleanup: [],
        previousUiState: null
    };

    function isElementVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getTarget(selector) {
        if (!selector) return null;
        const list = Array.isArray(selector) ? selector : [selector];
        let fallback = null;
        for (const sel of list) {
            try {
                const el = document.querySelector(sel);
                if (!el) continue;
                if (!fallback) fallback = el;
                if (isElementVisible(el)) return el;
            } catch (_) {}
        }
        return fallback;
    }

    function ensureSettingsOpen() {
        const shell = document.querySelector('.settings-shell');
        const open = !!(shell && shell.classList.contains('is-open'));
        if (open) return;
        if (typeof window.setSettingsPanelOpen === 'function') {
            window.setSettingsPanelOpen(true);
            return;
        }
        if (typeof window.toggleSettingsPanel === 'function') {
            window.toggleSettingsPanel();
        }
    }

    function ensureSettingsClosed() {
        const shell = document.querySelector('.settings-shell');
        const open = !!(shell && shell.classList.contains('is-open'));
        if (!open) return;
        if (typeof window.setSettingsPanelOpen === 'function') {
            window.setSettingsPanelOpen(false);
            return;
        }
        if (typeof window.toggleSettingsPanel === 'function') {
            window.toggleSettingsPanel();
        }
    }

    function ensureMapOpen() {
        const mapOverlay = document.getElementById('mapTableOverlay');
        const mapOpen = !!(mapOverlay && mapOverlay.classList.contains('active'));
        if (!mapOpen && typeof window.toggleMapTable === 'function') window.toggleMapTable(true);
    }

    function ensureMapClosed() {
        const mapOverlay = document.getElementById('mapTableOverlay');
        const mapOpen = !!(mapOverlay && mapOverlay.classList.contains('active'));
        if (mapOpen && typeof window.toggleMapTable === 'function') window.toggleMapTable(true);
    }

    function ensurePinboardClosed() {
        const pin = document.getElementById('pinboardOverlay');
        const open = !!(pin && pin.classList.contains('active'));
        if (open && typeof window.togglePinboard === 'function') window.togglePinboard(true);
    }

    function ensurePinboardOpen() {
        const pin = document.getElementById('pinboardOverlay');
        const open = !!(pin && pin.classList.contains('active'));
        if (!open && typeof window.togglePinboard === 'function') window.togglePinboard(true);
    }

    function ensureMapHintsMenuOpen() {
        if (typeof window.toggleMapHintsMenu !== 'function') return;
        const menu = document.getElementById('mapHintsMenu');
        if (!menu || menu.style.display === 'block') return;
        window.toggleMapHintsMenu(true);
    }

    function ensureMapVoiceMenuOpen() {
        const menu = document.getElementById('mapVoiceMenu');
        if (!menu || menu.style.display === 'block') return;
        if (typeof window.toggleMapVoiceMenu === 'function') window.toggleMapVoiceMenu();
        else if (typeof window.toggleMapVoiceMenu === 'undefined' && typeof toggleMapVoiceMenu === 'function') toggleMapVoiceMenu();
    }

    function closeTransientMapMenus() {
        if (typeof window.toggleMapHintsMenu === 'function') window.toggleMapHintsMenu(false);
        const voice = document.getElementById('mapVoiceMenu');
        if (voice) voice.style.display = 'none';
        const vp = document.getElementById('vpSettingsMenu');
        if (vp) vp.style.display = 'none';
    }

    function ensureMapDrawToolsVisible() {
        const btn = document.getElementById('mapDrawFloatingBtn');
        const stack = document.getElementById('mapDrawToolStack');
        if (!btn) return;
        const isOpen = !!(stack && stack.classList.contains('open'));
        if (!isOpen && typeof window.toggleMapToolRail === 'function') {
            window.toggleMapToolRail();
        }
    }

    function buildSteps() {
        return [
            {
                title: 'Willkommen',
                selector: '#mainTitle',
                body: `
                    <p>Dieses Tutorial zeigt dir den schnellen Setup-Weg. Du kannst das Tool aber auch <strong>ohne Setup</strong> direkt nutzen.</p>
                    <p>Cloud-Sync, KI-Funktionen und Live-Tracker sind optional und aktivieren nur zusätzliche Features.</p>
                `,
                beforeEnter: () => {
                    ensurePinboardClosed();
                    ensureMapClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Einstellungs-Menü',
                selector: '#settingsToggleBtn',
                body: `
                    <p>Hier findest du alle zentralen Einstellungen.</p>
                    <p>Klicke auf <strong>⚙️ Einstellungen</strong>, um Setup, Sync, API-Key und Design zu öffnen.</p>
                `
            },
            {
                title: 'Designs',
                selector: '#settingsPanel',
                freeView: true,
                body: `
                    <p>Im Bereich <strong>Darstellung</strong> kannst du zwischen mehreren Looks wechseln: Modern, Analog, NavCom und Ops 1940.</p>
                    <p>Teste die Themes direkt hier im Tutorial. In diesem Schritt bleibt die Ansicht extra offen, damit du alles sehen und bedienen kannst.</p>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                }
            },
            {
                title: 'Pilot-ID & PIN',
                selector: '#syncIdInput',
                body: `
                    <p>Die <strong>Pilot-ID + PIN</strong> nutzt du auf allen Geräten, um sie miteinander zu verbinden.</p>
                    <p>Damit funktionieren später <strong>Push</strong> und <strong>Pull</strong> über die Cloud.</p>
                    <div id="gaTutSyncBuilder" class="ga-tut-inline-box">
                        <label for="gaTutPilotId">Pilot-ID (optional)</label>
                        <input id="gaTutPilotId" type="text" maxlength="24" placeholder="z.B. PILOT-4721">
                        <label for="gaTutPilotPin">PIN (optional)</label>
                        <input id="gaTutPilotPin" type="text" maxlength="8" placeholder="4-8 Zeichen">
                        <div class="ga-tut-inline-actions">
                            <button type="button" id="gaTutGenerateSyncBtn">Zufällig erzeugen</button>
                            <button type="button" id="gaTutApplySyncBtn">In Felder übernehmen</button>
                        </div>
                        <div id="gaTutSyncMsg" class="ga-tut-inline-msg">Du kannst den Schritt auch überspringen.</div>
                    </div>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                },
                afterRender: bindSyncBuilder
            },
            {
                title: 'Cloud Push/Pull',
                selector: '#cloudPushBtn',
                body: `
                    <p>Mit <strong>☁️ Push</strong> lädst du deinen aktuellen Stand hoch, mit <strong>📥 Pull</strong> holst du ihn auf anderen Geräten.</p>
                    <p>Du meldest dich pro Gerät mit derselben Pilot-ID + PIN an.</p>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                }
            },
            {
                title: 'API-Key für KI',
                selector: '#apiKeyInput',
                body: `
                    <p>Für KI-Missionen braucht jedes Gerät mit KI-Funktionen denselben oder einen eigenen API-Key.</p>
                    <p>Der kostenlose Key reicht in der Regel aus. Er wird lokal gespeichert.</p>
                    <p><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">API-Key hier erstellen (öffnet neues Fenster)</a></p>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                }
            },
            {
                title: 'PC-Tracker (.exe)',
                selector: '.tracker-download a',
                body: `
                    <p>Lade hier den <strong>PC-Tracker</strong> herunter und starte die EXE.</p>
                    <p>Im Tracker trägst du ebenfalls <strong>dieselbe Pilot-ID + PIN</strong> ein. Die EXE muss laufen, damit Live-Tracking-Daten kommen.</p>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                }
            },
            {
                title: 'Start & Ziel',
                selector: '#startLoc',
                body: `
                    <p>Hier legst du den <strong>Startplatz</strong> und optional den <strong>Zielplatz</strong> fest.</p>
                    <p>Wenn das Zielfeld leer bleibt, wird beim Generieren ein passendes Ziel <strong>random</strong> gewählt.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Distanz, Richtung, Region',
                selector: '#distRange',
                body: `
                    <p>Über <strong>Distanz</strong>, <strong>Richtung</strong> und <strong>Region</strong> steuerst du den Suchraum.</p>
                    <p>Mit <strong>Egal / Zufall</strong> bleibt die Auswahl random, mit festen Werten wird gezielt gefiltert.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Mission Type',
                selector: '#targetType',
                body: `
                    <p>Bei <strong>Typ</strong> wählst du z.B. <strong>APT</strong> (Flugplatz zu Flugplatz) oder <strong>POI</strong> (Rundflug/Ort).</p>
                    <p>Je nach Picker-Modus sind zusätzlich Freeflight/Profil-Varianten möglich. Die groben Missionstypen regeln, ob eher klassischer Transfer, Rundflug oder freies Planen erzeugt wird.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Flugzeug-Parameter',
                selector: '#gphSlider',
                body: `
                    <p>Die Parameter <strong>Sitze, GPH, TAS, ALT und V/S</strong> fließen direkt in die Berechnung ein.</p>
                    <p>Sie beeinflussen das Briefing, z.B. Nutzlast/Payload, ETE, Distanz- und Performance-Hinweise.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Flug erstellen',
                selector: ['#generateBtn', '#radioGenerateBtn'],
                body: `
                    <p>Hier erzeugst du einen Flug mit oder ohne Mission.</p>
                    <p>Danach kannst du den Stand per Push auf andere Geräte übertragen und dort per Pull laden.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                }
            },
            {
                title: 'Briefing verstehen',
                selector: ['#briefingBox', '#generateBtn', '#radioGenerateBtn'],
                body: `
                    <p>Im <strong>Briefing</strong> findest du alle wichtigen Fluginfos: Strecke, Kurs, ETE, Payload/Fracht, Wetter/Frequenzen und Missionsdetails.</p>
                    <p>Falls noch kein Briefing sichtbar ist, erst einen Auftrag generieren und dann diesen Schritt erneut ansehen.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                }
            },
            {
                title: 'Briefing speichern/exportieren',
                selector: ['.briefing-pdf-pin', '.briefing-save-pin', '#importHubBtn'],
                body: `
                    <p>Im Briefing kannst du direkt <strong>PDF</strong> erstellen, Flüge an die <strong>Pinnwand</strong> pinnen oder über den Transfer-Hub exportieren/importieren.</p>
                    <p>So sicherst du Flüge oder gibst sie auf andere Geräte weiter.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                }
            },
            {
                title: 'Pinnwand & Gruppenpinnwand',
                selector: '#tabGroup',
                body: `
                    <p>Auf der <strong>Pinnwand</strong> kannst du Notizen anlegen und Flüge dauerhaft speichern.</p>
                    <p>Neben der privaten Pinnwand gibt es die <strong>Gruppenpinnwand</strong> für Crew-Sharing.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensureSettingsClosed();
                    ensurePinboardOpen();
                }
            },
            {
                title: 'Mission Auto-Start/-Ende',
                selector: '#missionAutoStartBtn',
                body: `
                    <p>Wenn verbunden, können Missionen automatisch starten, sobald du losrollst.</p>
                    <p>Nach der Landung werden Missionen automatisch beendet.</p>
                `,
                beforeEnter: () => {
                    ensureSettingsOpen();
                }
            },
            {
                title: 'Kartentisch = EFB',
                selector: '#mapTableBtn',
                body: `
                    <p>Während des Flugs wird der Kartentisch zu deinem EFB mit vielen Live-Funktionen.</p>
                    <p>Öffne den Kartentisch über diesen Button.</p>
                `,
                beforeEnter: () => {
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            },
            {
                title: 'Seiten-Menü im EFB',
                selector: '#mapHintsMenu',
                body: `
                    <p>Hier findest du Infos und Overlays wie Wetter, Plätze, Lufträume, Traffic und mehr.</p>
                    <p>Das Menü ist jetzt hervorgehoben. Öffne es und probiere die Optionen aus.</p>
                `,
                beforeEnter: () => {
                    ensureMapOpen();
                    setTimeout(ensureMapHintsMenuOpen, 120);
                }
            },
            {
                title: 'Zeichnen & Messen',
                selector: '#mapDrawFloatingBtn',
                body: `
                    <p>Mit den Werkzeugen kannst du direkt auf der Karte zeichnen und Strecken messen.</p>
                    <p>Ideal für schnelle Planung und In-Flight-Notizen.</p>
                `,
                beforeEnter: () => {
                    ensureMapOpen();
                    closeTransientMapMenus();
                    setTimeout(ensureMapDrawToolsVisible, 100);
                }
            },
            {
                title: 'Voice-Warnungen',
                selector: '#mapVoiceMenu',
                body: `
                    <p>Im <strong>🎙️ Voice</strong>-Menü aktivierst du Audio-Warnungen für Terrain und Lufträume.</p>
                    <p>Zusätzlich gibt es Wegpunkt- und Funk-Ansagen.</p>
                `,
                beforeEnter: () => {
                    ensureMapOpen();
                    setTimeout(ensureMapVoiceMenuOpen, 120);
                }
            },
            {
                title: 'Tutorial später öffnen',
                selector: '#openTutorialBtn',
                body: `
                    <p>Du kannst jederzeit vor/zurück blättern, skippen und dieses Tutorial später erneut starten.</p>
                    <p>Dafür einfach ganz unten im Hauptmenü auf <strong>Tutorial</strong> klicken.</p>
                `,
                beforeEnter: () => {
                    ensureMapClosed();
                    ensurePinboardClosed();
                    ensureSettingsClosed();
                }
            }
        ];
    }

    function createTutorialDom() {
        let root = document.getElementById('gaTutorialOverlay');
        if (root) return root;

        root = document.createElement('div');
        root.id = 'gaTutorialOverlay';
        root.innerHTML = `
            <div class="ga-tut-dim" aria-hidden="true"></div>
            <div id="gaTutorialSpotlight" class="ga-tut-spotlight" aria-hidden="true"></div>
            <div class="ga-tut-window" role="dialog" aria-modal="true" aria-labelledby="gaTutTitle">
                <div class="ga-tut-head">
                    <div id="gaTutTitle" class="ga-tut-title">Tutorial</div>
                    <button type="button" id="gaTutCloseBtn" class="ga-tut-close" aria-label="Tutorial schließen">✕</button>
                </div>
                <div id="gaTutBody" class="ga-tut-body"></div>
                <div class="ga-tut-foot">
                    <div id="gaTutCounter" class="ga-tut-counter">1 / 1</div>
                    <div class="ga-tut-actions">
                        <button type="button" id="gaTutSkipBtn" class="ga-tut-btn ga-tut-btn-ghost">Zum Ende</button>
                        <button type="button" id="gaTutPrevBtn" class="ga-tut-btn ga-tut-btn-ghost">Zurück</button>
                        <button type="button" id="gaTutNextBtn" class="ga-tut-btn ga-tut-btn-primary">Weiter</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(root);

        const onResize = () => {
            if (!state.active) return;
            updateSpotlight();
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, true);
        state.cleanup.push(() => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onResize, true);
        });

        const closeBtn = root.querySelector('#gaTutCloseBtn');
        const skipBtn = root.querySelector('#gaTutSkipBtn');
        const prevBtn = root.querySelector('#gaTutPrevBtn');
        const nextBtn = root.querySelector('#gaTutNextBtn');

        closeBtn.addEventListener('click', () => stopTutorial(true));
        skipBtn.addEventListener('click', () => {
            if (!state.steps.length) return;
            state.index = state.steps.length - 1;
            renderStep();
        });
        prevBtn.addEventListener('click', prevStep);
        nextBtn.addEventListener('click', nextStep);

        document.addEventListener('keydown', handleKeydown);
        state.cleanup.push(() => document.removeEventListener('keydown', handleKeydown));

        return root;
    }

    function captureUiState() {
        const shell = document.querySelector('.settings-shell');
        const map = document.getElementById('mapTableOverlay');
        const pin = document.getElementById('pinboardOverlay');
        state.previousUiState = {
            settingsOpen: !!(shell && shell.classList.contains('is-open')),
            mapOpen: !!(map && map.classList.contains('active')),
            pinboardOpen: !!(pin && pin.classList.contains('active'))
        };
    }

    function restoreUiState() {
        const prev = state.previousUiState;
        if (!prev) return;

        closeTransientMapMenus();

        const map = document.getElementById('mapTableOverlay');
        const mapOpen = !!(map && map.classList.contains('active'));
        if (mapOpen !== prev.mapOpen && typeof window.toggleMapTable === 'function') {
            window.toggleMapTable(true);
        }

        const pin = document.getElementById('pinboardOverlay');
        const pinOpen = !!(pin && pin.classList.contains('active'));
        if (pinOpen !== prev.pinboardOpen && typeof window.togglePinboard === 'function') {
            window.togglePinboard(true);
        }

        const shell = document.querySelector('.settings-shell');
        const settingsOpen = !!(shell && shell.classList.contains('is-open'));
        if (settingsOpen !== prev.settingsOpen) {
            if (typeof window.setSettingsPanelOpen === 'function') {
                window.setSettingsPanelOpen(prev.settingsOpen);
            } else if (typeof window.toggleSettingsPanel === 'function') {
                window.toggleSettingsPanel();
            }
        }
    }

    function startTutorial(options) {
        const opts = options || {};
        if (state.active) return;

        state.steps = buildSteps();
        if (!state.steps.length) return;

        state.index = Math.min(
            Math.max(Number.isFinite(opts.startIndex) ? Math.floor(opts.startIndex) : 0, 0),
            state.steps.length - 1
        );

        captureUiState();
        const root = createTutorialDom();
        state.active = true;
        root.classList.add('active');
        document.body.classList.add('ga-tutorial-active');

        renderStep();
    }

    function stopTutorial(markSeen) {
        if (!state.active) return;
        state.active = false;

        const root = document.getElementById('gaTutorialOverlay');
        if (root) root.classList.remove('active');
        document.body.classList.remove('ga-tutorial-active');

        if (markSeen) {
            localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        }

        localStorage.setItem(TUTORIAL_LAST_STEP_KEY, String(state.index || 0));
        document.querySelectorAll('.ga-tut-target').forEach((el) => el.classList.remove('ga-tut-target'));

        restoreUiState();
    }

    function prevStep() {
        if (!state.active) return;
        state.index = Math.max(0, state.index - 1);
        renderStep();
    }

    function nextStep() {
        if (!state.active) return;
        if (state.index >= state.steps.length - 1) {
            stopTutorial(true);
            return;
        }
        state.index += 1;
        renderStep();
    }

    function renderStep() {
        const root = document.getElementById('gaTutorialOverlay');
        if (!root) return;
        const step = state.steps[state.index];
        if (!step) return;

        if (typeof step.beforeEnter === 'function') {
            try { step.beforeEnter(); } catch (err) { console.warn('[Tutorial] beforeEnter failed', err); }
        }

        const titleEl = root.querySelector('#gaTutTitle');
        const bodyEl = root.querySelector('#gaTutBody');
        const counterEl = root.querySelector('#gaTutCounter');
        const prevBtn = root.querySelector('#gaTutPrevBtn');
        const nextBtn = root.querySelector('#gaTutNextBtn');
        root.classList.toggle('ga-tut-freeview', !!step.freeView);

        if (titleEl) titleEl.textContent = step.title || 'Tutorial';
        if (bodyEl) bodyEl.innerHTML = step.body || '';
        if (counterEl) counterEl.textContent = `${state.index + 1} / ${state.steps.length}`;
        if (prevBtn) prevBtn.disabled = state.index <= 0;
        if (nextBtn) nextBtn.textContent = state.index >= state.steps.length - 1 ? 'Fertig' : 'Weiter';

        if (typeof step.afterRender === 'function') {
            try { step.afterRender(); } catch (err) { console.warn('[Tutorial] afterRender failed', err); }
        }

        setTimeout(() => {
            focusTarget(step);
            updateSpotlight();
        }, 80);

        setTimeout(() => {
            updateSpotlight();
        }, 360);
    }

    function focusTarget(step) {
        if (!step || !step.selector) return;
        const target = getTarget(step.selector);
        if (!target || !isElementVisible(target)) return;
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }

    function updateSpotlight() {
        const root = document.getElementById('gaTutorialOverlay');
        const spot = document.getElementById('gaTutorialSpotlight');
        const win = root ? root.querySelector('.ga-tut-window') : null;
        if (!root || !spot) return;
        document.querySelectorAll('.ga-tut-target').forEach((el) => el.classList.remove('ga-tut-target'));
        const step = state.steps[state.index];
        if (!step || !step.selector) {
            spot.classList.remove('active');
            positionTutorialWindow(null, win);
            return;
        }
        const target = getTarget(step.selector);
        if (step.freeView) {
            spot.classList.remove('active');
            positionTutorialWindow(target, win);
            return;
        }
        if (!target || !isElementVisible(target)) {
            spot.classList.remove('active');
            positionTutorialWindow(null, win);
            return;
        }

        const rect = target.getBoundingClientRect();
        const pad = step.pad || 10;
        const left = Math.max(6, rect.left - pad);
        const top = Math.max(6, rect.top - pad);
        const width = Math.min(window.innerWidth - left - 6, rect.width + (pad * 2));
        const height = Math.min(window.innerHeight - top - 6, rect.height + (pad * 2));

        spot.style.left = `${left}px`;
        spot.style.top = `${top}px`;
        spot.style.width = `${Math.max(24, width)}px`;
        spot.style.height = `${Math.max(24, height)}px`;
        spot.classList.add('active');
        target.classList.add('ga-tut-target');
        positionTutorialWindow(target, win);
    }

    function positionTutorialWindow(target, winEl) {
        const win = winEl || document.querySelector('#gaTutorialOverlay .ga-tut-window');
        if (!win) return;
        const pad = 12;
        const gap = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        win.style.left = '50%';
        win.style.top = '50%';
        win.style.right = 'auto';
        win.style.bottom = 'auto';
        win.style.transform = 'translate(-50%, -50%)';

        const wr = win.getBoundingClientRect();
        const w = Math.min(wr.width, vw - pad * 2);
        const h = Math.min(wr.height, vh - pad * 2);

        if (!target) {
            const cx = Math.max(pad, Math.min(vw - w - pad, (vw - w) / 2));
            const cy = Math.max(pad, Math.min(vh - h - pad, (vh - h) / 2));
            win.style.left = `${cx}px`;
            win.style.top = `${cy}px`;
            win.style.transform = 'none';
            return;
        }

        const tr = target.getBoundingClientRect();

        if (vw <= 700) {
            const placeTop = tr.top > (vh * 0.45);
            const y = placeTop ? pad : (vh - h - pad);
            const x = Math.max(pad, Math.min(vw - w - pad, (vw - w) / 2));
            win.style.left = `${x}px`;
            win.style.top = `${y}px`;
            win.style.transform = 'none';
            return;
        }

        const spaceRight = vw - tr.right - pad;
        const spaceLeft = tr.left - pad;
        const spaceBottom = vh - tr.bottom - pad;
        const spaceTop = tr.top - pad;

        let x = Math.max(pad, Math.min(vw - w - pad, (vw - w) / 2));
        let y = Math.max(pad, Math.min(vh - h - pad, (vh - h) / 2));

        if (spaceRight >= (w + gap)) {
            x = tr.right + gap;
            y = tr.top + ((tr.height - h) / 2);
        } else if (spaceLeft >= (w + gap)) {
            x = tr.left - w - gap;
            y = tr.top + ((tr.height - h) / 2);
        } else if (spaceBottom >= (h + gap)) {
            x = tr.left + ((tr.width - w) / 2);
            y = tr.bottom + gap;
        } else if (spaceTop >= (h + gap)) {
            x = tr.left + ((tr.width - w) / 2);
            y = tr.top - h - gap;
        } else {
            const targetCx = tr.left + (tr.width / 2);
            const leftCandidate = targetCx + gap;
            const rightCandidate = targetCx - w - gap;
            x = leftCandidate;
            if (leftCandidate + w > vw - pad) x = rightCandidate;
            if (x < pad || x + w > vw - pad) x = (vw - w) / 2;
            y = (tr.top > (vh / 2)) ? pad : (vh - h - pad);
        }

        x = Math.max(pad, Math.min(vw - w - pad, x));
        y = Math.max(pad, Math.min(vh - h - pad, y));
        win.style.left = `${x}px`;
        win.style.top = `${y}px`;
        win.style.transform = 'none';
    }

    function bindSyncBuilder() {
        const idInput = document.getElementById('gaTutPilotId');
        const pinInput = document.getElementById('gaTutPilotPin');
        const btnGen = document.getElementById('gaTutGenerateSyncBtn');
        const btnApply = document.getElementById('gaTutApplySyncBtn');
        const msg = document.getElementById('gaTutSyncMsg');
        if (!idInput || !pinInput || !btnGen || !btnApply || !msg) return;

        const existingId = localStorage.getItem('ga_sync_id') || '';
        const existingPin = localStorage.getItem('ga_sync_pin') || '';
        idInput.value = existingId;
        pinInput.value = existingPin;

        btnGen.onclick = () => {
            const randomId = `PILOT-${Math.floor(1000 + Math.random() * 9000)}`;
            const randomPin = String(Math.floor(100000 + Math.random() * 900000));
            idInput.value = randomId;
            pinInput.value = randomPin;
            msg.textContent = 'Neue Daten erzeugt. Mit "In Felder übernehmen" speichern.';
        };

        btnApply.onclick = () => {
            const idVal = String(idInput.value || '').trim().toUpperCase();
            const pinVal = String(pinInput.value || '').trim();

            if (!idVal || !pinVal) {
                msg.textContent = 'Bitte erst ID und PIN ausfüllen.';
                return;
            }

            const syncIdInput = document.getElementById('syncIdInput');
            const syncPinInput = document.getElementById('syncPinInput');
            if (syncIdInput) syncIdInput.value = idVal;
            if (syncPinInput) syncPinInput.value = pinVal;

            localStorage.setItem('ga_sync_id', idVal);
            localStorage.setItem('ga_sync_pin', pinVal);

            if (typeof window.saveSyncId === 'function') {
                try { window.saveSyncId(); } catch (_) {}
            }

            msg.textContent = 'Pilot-ID und PIN wurden übernommen.';
        };
    }

    function handleKeydown(evt) {
        if (!state.active) return;
        if (evt.key === 'Escape') {
            evt.preventDefault();
            stopTutorial(true);
            return;
        }
        if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            nextStep();
            return;
        }
        if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            prevStep();
        }
    }

    window.openInteractiveTutorial = function (opts) {
        startTutorial(opts || {});
    };

    window.closeInteractiveTutorial = function () {
        stopTutorial(true);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const startBtn = document.getElementById('openTutorialBtn');
        if (startBtn && !startBtn.dataset.bound) {
            startBtn.dataset.bound = '1';
            startBtn.addEventListener('click', () => {
                window.openInteractiveTutorial({ startIndex: 0 });
            });
        }

        const seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
        if (!seen) {
            setTimeout(() => {
                if (state.active) return;
                window.openInteractiveTutorial({ startIndex: 0 });
            }, 1200);
        }
    });
})();
