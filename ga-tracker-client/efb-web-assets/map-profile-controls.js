// Generated from map-profile-controls.js by sync-efb-web-assets.js. Do not edit.
// Shared standalone profile menu placement and narrow-screen controls.
function _openFloatingMenuInViewport(menu, btn) {
  var preferAbove = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  if (!menu || !btn) return;
  var pad = 6;
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
  var br = btn.getBoundingClientRect();
  var mr = menu.getBoundingClientRect();
  var left = br.right - mr.width;
  left = Math.max(pad, Math.min(left, window.innerWidth - mr.width - pad));
  var aboveTop = br.top - mr.height - 6;
  var belowTop = br.bottom + 6;
  var aboveSpace = Math.max(0, br.top - 6 - pad);
  var belowSpace = Math.max(0, window.innerHeight - belowTop - pad);
  var fitsAbove = mr.height <= aboveSpace;
  var fitsBelow = mr.height <= belowSpace;
  var minMenuHeight = 96;
  var top;
  var maxHeight;
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
  menu.style.maxHeight = `${Math.max(minMenuHeight, maxHeight || window.innerHeight - pad * 2)}px`;
  menu.style.visibility = 'visible';
  if (typeof window.gaBringMapOverlayToFront === 'function') window.gaBringMapOverlayToFront(menu);
}
function _setMapFloatingMenuButtonOpen(id, open) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('map-menu-open', !!open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function toggleVpSettingsMenu() {
  var menu = document.getElementById('vpSettingsMenu');
  var btn = document.getElementById('btnVpSettings');
  if (!menu || !btn) return;
  var open = menu.style.display === 'block';
  if (open) {
    menu.style.display = 'none';
    _setMapFloatingMenuButtonOpen('btnVpSettings', false);
    return;
  }
  _openFloatingMenuInViewport(menu, btn, true);
  _setMapFloatingMenuButtonOpen('btnVpSettings', true);
  setTimeout(() => {
    document.addEventListener('click', _closeVpSettingsOnOutside, {
      once: true,
      capture: true
    });
  }, 0);
}
function _closeVpSettingsOnOutside(e) {
  var menu = document.getElementById('vpSettingsMenu');
  var btn = document.getElementById('btnVpSettings');
  if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    menu.style.display = 'none';
    _setMapFloatingMenuButtonOpen('btnVpSettings', false);
    var planeMenu = document.getElementById('vpPlaneIconMenu');
    if (planeMenu) planeMenu.style.display = 'none';
    var planeBtn = document.getElementById('btnTogglePlaneIconMenu');
    if (planeBtn) planeBtn.classList.remove('active');
    var vfrMenu = document.getElementById('vfrIndexMenuBlock');
    if (vfrMenu) vfrMenu.style.display = 'none';
    var terrMenu = document.getElementById('terrainAvoidMenuBlock');
    if (terrMenu) terrMenu.style.display = 'none';
    var vfrBtn = document.getElementById('btnToggleVfrIndexMenu');
    if (vfrBtn) vfrBtn.classList.remove('active');
    var terrBtn = document.getElementById('btnToggleTerrainAvoidMenu');
    if (terrBtn) terrBtn.classList.remove('active');
  }
}
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 767) {
    var hideSpecificControls = (displayId, labelKeywords) => {
      var el = document.getElementById(displayId);
      if (!el) return;
      el.style.display = 'none';

      // 1. Rückwärts durch echte Elemente gehen (versteckt Buttons und Label-Spans/Divs)
      var prev = el.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'BUTTON' || labelKeywords.some(kw => prev.textContent.toUpperCase().includes(kw))) {
          prev.style.display = 'none';
          prev = prev.previousElementSibling;
        } else {
          break; // Stop, wenn ein völlig anderes Element (z.B. ein Toggle-Icon) erreicht wird
        }
      }

      // 2. Rückwärts durch alle Nodes gehen (erwischt "nackte" Text-Nodes ohne HTML-Tag)
      var prevNode = el.previousSibling;
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
      var next = el.nextElementSibling;
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
var vpRenderPending = false;
window.throttledRenderProfiles = function () {
  if (vpRenderPending) return;
  vpRenderPending = true;
  requestAnimationFrame(() => {
    var perf = window.gaPerfStart ? window.gaPerfStart('Profile render batch') : null;
    var mapTable = document.getElementById('mapTableOverlay');
    var mapTableOpen = !!(mapTable && mapTable.classList.contains('active'));

    // Stabilitaet vor Micro-Optimierung: das Hauptprofil immer frisch halten,
    // auch wenn Drawer-/Overlay-Zustaende kurzzeitig hinterherhaengen.
    if (document.getElementById('verticalProfileCanvas')) {
      var smallPerf = window.gaPerfStart ? window.gaPerfStart('Profile render small canvas') : null;
      renderVerticalProfile('verticalProfileCanvas');
      if (window.gaPerfEnd) window.gaPerfEnd(smallPerf);
    }
    if (mapTableOpen && typeof renderMapProfile === 'function') {
      var mapPerf = window.gaPerfStart ? window.gaPerfStart('Profile render map canvas schedule') : null;
      renderMapProfile();
      if (window.gaPerfEnd) window.gaPerfEnd(mapPerf);
    }
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
      mapTableOpen
    });
    vpRenderPending = false;
  });
};
window.vpIsFastRendering = false;
var vpFastRenderTimeout = null;
window.activateFastRender = function () {
  window.vpIsFastRendering = true;
  window.vpBgNeedsUpdate = true; // Zwingt Layer 1 zum Update
  if (vpFastRenderTimeout) clearTimeout(vpFastRenderTimeout);
  vpFastRenderTimeout = setTimeout(() => {
    window.vpIsFastRendering = false;
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }, 350);
};
