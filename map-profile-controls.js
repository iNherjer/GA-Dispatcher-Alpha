// Shared standalone profile menu placement and narrow-screen controls.
function _openFloatingMenuInViewport(menu, btn, preferAbove = false) {
        if (!menu || !btn) return;
        const pad = 6;
        document.body.appendChild(menu);
        menu.style.position = 'fixed';
        menu.style.display = 'block';
        menu.style.visibility = 'hidden';
        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
        menu.style.zIndex = '130500';
        menu.style.maxWidth = `calc(100vw - ${pad * 2}px)`;
        menu.style.maxHeight = `calc(100vh - ${pad * 2}px)`;
        menu.style.overflowY = 'auto';

        const br = btn.getBoundingClientRect();
        const mr = menu.getBoundingClientRect();

        let left = br.right - mr.width;
        left = Math.max(pad, Math.min(left, window.innerWidth - mr.width - pad));

        const aboveTop = br.top - mr.height - 6;
        const belowTop = br.bottom + 6;
        const aboveSpace = Math.max(0, br.top - 6 - pad);
        const belowSpace = Math.max(0, window.innerHeight - belowTop - pad);
        const fitsAbove = mr.height <= aboveSpace;
        const fitsBelow = mr.height <= belowSpace;
        const minMenuHeight = 96;

        let top;
        let maxHeight;
        if (preferAbove) {
            if (fitsAbove) {
                top = aboveTop;
                maxHeight = aboveSpace;
            } else if (fitsBelow || belowSpace >= aboveSpace) {
                top = belowTop;
                maxHeight = belowSpace;
            } else {
                top = pad;
                maxHeight = aboveSpace;
            }
        } else {
            if (fitsBelow) {
                top = belowTop;
                maxHeight = belowSpace;
            } else if (fitsAbove || aboveSpace > belowSpace) {
                top = fitsAbove ? aboveTop : pad;
                maxHeight = aboveSpace;
            } else {
                top = belowTop;
                maxHeight = belowSpace;
            }
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.maxHeight = `${Math.max(minMenuHeight, maxHeight || window.innerHeight - (pad * 2))}px`;
        menu.style.visibility = 'visible';
        if (typeof window.gaBringMapOverlayToFront === 'function') window.gaBringMapOverlayToFront(menu);
    }

function _setMapFloatingMenuButtonOpen(id, open) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('map-menu-open', !!open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

function toggleVpSettingsMenu() {
        const menu = document.getElementById('vpSettingsMenu');
        const btn  = document.getElementById('btnVpSettings');
        if (!menu || !btn) return;
        const open = menu.style.display === 'block';
        if (open) {
            menu.style.display = 'none';
            _setMapFloatingMenuButtonOpen('btnVpSettings', false);
            return;
        }
        _openFloatingMenuInViewport(menu, btn, true);
        _setMapFloatingMenuButtonOpen('btnVpSettings', true);

    }

function _closeVpSettingsOnOutside(e) {
        const menu = document.getElementById('vpSettingsMenu');
        const btn  = document.getElementById('btnVpSettings');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
            menu.style.display = 'none';
            _setMapFloatingMenuButtonOpen('btnVpSettings', false);
            const planeMenu = document.getElementById('vpPlaneIconMenu');
            if (planeMenu) planeMenu.style.display = 'none';
            const planeBtn = document.getElementById('btnTogglePlaneIconMenu');
            if (planeBtn) planeBtn.classList.remove('active');
            const vfrMenu = document.getElementById('vfrIndexMenuBlock');
            if (vfrMenu) vfrMenu.style.display = 'none';
            const terrMenu = document.getElementById('terrainAvoidMenuBlock');
            if (terrMenu) terrMenu.style.display = 'none';
            const vfrBtn = document.getElementById('btnToggleVfrIndexMenu');
            if (vfrBtn) vfrBtn.classList.remove('active');
            const terrBtn = document.getElementById('btnToggleTerrainAvoidMenu');
            if (terrBtn) terrBtn.classList.remove('active');
        }
    }

document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 767) {
        const hideSpecificControls = (displayId, labelKeywords) => {
            const el = document.getElementById(displayId);
            if (!el) return;

            el.style.display = 'none';

            // 1. Rückwärts durch echte Elemente gehen (versteckt Buttons und Label-Spans/Divs)
            let prev = el.previousElementSibling;
            while (prev) {
                if (prev.tagName === 'BUTTON' || labelKeywords.some(kw => prev.textContent.toUpperCase().includes(kw))) {
                    prev.style.display = 'none';
                    prev = prev.previousElementSibling;
                } else {
                    break; // Stop, wenn ein völlig anderes Element (z.B. ein Toggle-Icon) erreicht wird
                }
            }

            // 2. Rückwärts durch alle Nodes gehen (erwischt "nackte" Text-Nodes ohne HTML-Tag)
            let prevNode = el.previousSibling;
            while (prevNode) {
                if (prevNode.nodeType === 3 && labelKeywords.some(kw => prevNode.textContent.toUpperCase().includes(kw))) {
                    prevNode.textContent = ''; // Rohen Text löschen
                }
                // Abbrechen, wenn wir ein echtes Element treffen, das weder Button noch gesuchtes Label ist
                if (prevNode.nodeType === 1 && prevNode.tagName !== 'BUTTON' && !labelKeywords.some(kw => prevNode.textContent.toUpperCase().includes(kw))) {
                    break;
                }
                prevNode = prevNode.previousSibling;
            }

            // 3. Vorwärts gehen (versteckt nachfolgende Plus-Buttons)
            let next = el.nextElementSibling;
            while (next) {
                if (next.tagName === 'BUTTON') {
                    next.style.display = 'none';
                    next = next.nextElementSibling;
                } else {
                    break;
                }
            }
        };

        // Suche nach den Elementen und lösche auch die zugehörigen Texte/Labels davor
        hideSpecificControls('vpZoomDisplay', ['ZOOM']);
        hideSpecificControls('yAxisDisplay', ['MAX', 'FT', 'ALT']);
    }
});

let vpRenderPending = false;
window.throttledRenderProfiles = function() {
    if (vpRenderPending) return;
    vpRenderPending = true;
    requestAnimationFrame(() => {
        const perf = window.gaPerfStart ? window.gaPerfStart('Profile render batch') : null;
        const mapTable = document.getElementById('mapTableOverlay');
        const mapTableOpen = !!(mapTable && mapTable.classList.contains('active'));

        // Stabilitaet vor Micro-Optimierung: das Hauptprofil immer frisch halten,
        // auch wenn Drawer-/Overlay-Zustaende kurzzeitig hinterherhaengen.
        if (document.getElementById('verticalProfileCanvas')) {
            const smallPerf = window.gaPerfStart ? window.gaPerfStart('Profile render small canvas') : null;
            renderVerticalProfile('verticalProfileCanvas');
            if (window.gaPerfEnd) window.gaPerfEnd(smallPerf);
        }
        if (mapTableOpen && typeof renderMapProfile === 'function') {
            const mapPerf = window.gaPerfStart ? window.gaPerfStart('Profile render map canvas schedule') : null;
            renderMapProfile();
            if (window.gaPerfEnd) window.gaPerfEnd(mapPerf);
        }
        if (window.gaPerfEnd) window.gaPerfEnd(perf, { mapTableOpen });
        vpRenderPending = false;
    });
};

window.vpIsFastRendering = false;
let vpFastRenderTimeout = null;
window.activateFastRender = function() {
    window.vpIsFastRendering = true;
    window.vpBgNeedsUpdate = true; // Zwingt Layer 1 zum Update
    if (vpFastRenderTimeout) clearTimeout(vpFastRenderTimeout);
    vpFastRenderTimeout = setTimeout(() => {
        window.vpIsFastRendering = false;
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }, 350);
};

// Shared Audio menu and resize cleanup, formerly inline in index.html.
    function _closeFloatingMenus() {
        const ids = ['vpSettingsMenu', 'mapVoiceMenu', 'mapHintsMenu'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        _setMapFloatingMenuButtonOpen('btnVpSettings', false);
        _setMapFloatingMenuButtonOpen('mapVoiceBtn', false);
        _setMapFloatingMenuButtonOpen('mapHintsBtn', false);
        const planeMenu = document.getElementById('vpPlaneIconMenu');
        if (planeMenu) planeMenu.style.display = 'none';
        const planeBtn = document.getElementById('btnTogglePlaneIconMenu');
        if (planeBtn) planeBtn.classList.remove('active');
        const vfrMenu = document.getElementById('vfrIndexMenuBlock');
        if (vfrMenu) vfrMenu.style.display = 'none';
        const vfrBtn = document.getElementById('btnToggleVfrIndexMenu');
        if (vfrBtn) vfrBtn.classList.remove('active');
        const terrMenu = document.getElementById('terrainAvoidMenuBlock');
        if (terrMenu) terrMenu.style.display = 'none';
        const terrBtn = document.getElementById('btnToggleTerrainAvoidMenu');
        if (terrBtn) terrBtn.classList.remove('active');
    }


    window.gaSetMapFloatingMenuButtonOpen = _setMapFloatingMenuButtonOpen;

    // ── Zahnrad-Untermenü Höhenprofil ──────────────────────────────────────────


    function toggleMapVoiceMenu() {
        const menu = document.getElementById('mapVoiceMenu');
        const btn  = document.getElementById('mapVoiceBtn');
        if (!menu || !btn) return;
        const open = menu.style.display === 'block';
        if (open) {
            menu.style.display = 'none';
            _setMapFloatingMenuButtonOpen('mapVoiceBtn', false);
            return;
        }
        _openFloatingMenuInViewport(menu, btn, false);
        _setMapFloatingMenuButtonOpen('mapVoiceBtn', true);
        if (typeof window.awmSyncPlaybackDeviceControls === 'function') window.awmSyncPlaybackDeviceControls();
    }
    function _closeMapVoiceOnOutside(e) {
        const menu = document.getElementById('mapVoiceMenu');
        const btn  = document.getElementById('mapVoiceBtn');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
            menu.style.display = 'none';
            _setMapFloatingMenuButtonOpen('mapVoiceBtn', false);
        }
    }
    window.addEventListener('resize', _closeFloatingMenus);
    window.addEventListener('orientationchange', _closeFloatingMenus);


// Keep outside dismissal after interactions inside either menu.
document.addEventListener('click', _closeVpSettingsOnOutside, true);
document.addEventListener('click', _closeMapVoiceOnOutside, true);
