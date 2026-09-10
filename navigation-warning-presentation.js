(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GANavigationWarningPresentation = api;
})(typeof window !== 'undefined' ? window : null, function() {
'use strict';
// Shared, unchanged standalone presentation; tracker clients supply the same airspace facts.
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getAirspaceStyle(a) {
    const t = a.type;
    const classLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const cls = (a.icaoClass !== undefined && classLetters[a.icaoClass]) ? '-' + classLetters[a.icaoClass] : '';

    if (t === 1) return { color: '#ff3333', icon: '⛔', mapColor: '#ff3333', category: 'ED-R / Restricted' };
    if (t === 2) return { color: '#ff6600', icon: '⛔', mapColor: '#ff6600', category: 'Danger' };
    if (t === 3) return { color: '#cc0000', icon: '🚫', mapColor: '#cc0000', category: 'Prohibited' };

    // CTRs (Kontrollzonen am Boden) bleiben gelb
    if (t === 4) return { color: '#f2c12e', icon: '⚠️', mapColor: '#f2c12e', category: `CTR${cls}` };

    // Class C und D (die keine CTR sind) als eigenständige Lufträume hervorheben (Blautöne)
    if (a.icaoClass === 2) return { color: '#0055ff', icon: '⚠️', mapColor: '#0055ff', category: 'Class C' };
    if (a.icaoClass === 3) return { color: '#1a73e8', icon: '⚠️', mapColor: '#1a73e8', category: 'Class D' };

    if (t === 7) return { color: '#4da6ff', icon: '⚠️', mapColor: '#4da6ff', category: `TMA${cls}` };
    if (t === 26) return { color: '#4da6ff', icon: '⚠️', mapColor: '#4da6ff', category: `CTA${cls}` };
    if (t === 5 || t === 27) return { color: '#9966ff', icon: '📡', mapColor: '#9966ff', category: 'TMZ' };
    if ((t === 6 || t === 28) && /\bPARA\b/i.test(a.name || '')) return { color: '#ffaa00', icon: '🪂', mapColor: '#ffaa00', category: 'Para' };
    if (t === 6 || t === 28) return { color: '#66cccc', icon: '📡', mapColor: '#66cccc', category: 'RMZ' };
    if (t === 33) return { color: '#888', icon: '🌐', mapColor: '#888', category: 'FIS' };

    return { color: '#aaa', icon: '📋', mapColor: '#aaa', category: `Type ${t}` };
}

function getAirspaceDisplayName(a) {
    const style = getAirspaceStyle(a);
    let name = a.name || 'Unbekannt';
    // Entferne überflüssige Begriffe, ABER behalte die Klassen-Buchstaben (wie C oder D) bei!
    name = name.replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS)\b/ig, '');
    if (/\bPARA\b/i.test(a.name || '')) name = name.replace(/\bPARA\b/ig, '').trim();
    return `${name.trim()} [${style.category}]`;
}

function pulseOnMap(as, color, map, L) {
    if (!as.geometry || !L || !map) return;
    const polys = [];
    if (as.geometry.type === 'Polygon')
        polys.push(as.geometry.coordinates[0]);
    else if (as.geometry.type === 'MultiPolygon')
        as.geometry.coordinates.forEach(mc => polys.push(mc[0]));

    polys.forEach(poly => {
        const latlngs = poly.map(c => [c[1], c[0]]);  // GeoJSON [lon,lat] → Leaflet [lat,lon]
        const flash = L.polygon(latlngs, {
            color, weight: 4, opacity: 0,
            fillColor: color, fillOpacity: 0,
            interactive: false
        }).addTo(map);
        let tick = 0;
        const id = setInterval(() => {
            tick++;
            const on = (tick % 2 === 1);
            flash.setStyle({ opacity: on ? 1 : 0, fillOpacity: on ? 0.3 : 0 });
            if (tick >= 6) { clearInterval(id); if (map.hasLayer(flash)) map.removeLayer(flash); }
        }, 450);
    });
}

function _awConsumeFreqBannerEvent(ev, options = {}) {
    if (!ev) return;
    if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
    if (options.preventDefault !== false && ev.cancelable && typeof ev.preventDefault === 'function') ev.preventDefault();
}

function _awInstallFreqBannerBarrier(banner) {
    if (!banner || banner.__awmFreqBarrierInstalled) return;
    banner.__awmFreqBarrierInstalled = true;
    const consume = (ev) => _awConsumeFreqBannerEvent(ev, {
        preventDefault: !/^(pointerdown|mousedown|touchstart)$/i.test(String((ev && ev.type) || ''))
    });
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend']
        .forEach(type => banner.addEventListener(type, consume, { passive: false }));
}

function getBannerHost() {
    const banner = document.getElementById('awmFreqBanner');
    // Fixed banners must not inherit clipping/stacking from the map canvas.
    if (banner && document.body && banner.parentElement !== document.body) document.body.appendChild(banner);
    return banner;
}

function _awShowFreqBanner(as, col) {
    if (!as.frequencies || as.frequencies.length === 0) return;
    const banner = getBannerHost();
    if (!banner) return false;
    _awInstallFreqBannerBarrier(banner);

    // Gleichen Luftraum nicht doppelt anzeigen
    const asKey = `${as.type}_${as.name || as._id || 'x'}`;
    const escaped = asKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (banner.querySelector(`[data-askey="${escaped}"]`)) return;

    // Alle Frequenzen/Squawks aufbereiten
    const t = as.type;
    const freqParts = [];
    for (const f of (as.frequencies || [])) {
        if (!f.value) continue;
        const nm = (f.name || '').toUpperCase();
        const isSquawk = /XPDR|SQK|SQUAWK|TRANSP/.test(nm);
        const icon  = isSquawk ? '🔲' : '📻';
        const label = isSquawk ? (nm || 'XPDR')
                    : (t === 5 || t === 27) ? (nm || 'FREQ')
                    : (t === 6 || t === 28 || t === 33) ? (nm || 'INFO')
                    : (nm || 'TWR');
        freqParts.push(`${icon}\u202F${escapeHtml(label)}: <b>${escapeHtml(f.value)}</b>`);
    }
    if (!freqParts.length) return;

    const displayName = (typeof getAirspaceDisplayName === 'function')
        ? getAirspaceDisplayName(as) : (as.name || '?');

    // Farbe für Frequenz-Label
    let freqColor = col || '#ffffff';
    if (t === 5 || t === 27)          freqColor = '#9966ff'; // TMZ
    else if (t === 6 || t === 28 || t === 33) freqColor = '#66cccc'; // RMZ/FIS

    const entry = document.createElement('div');
    entry.dataset.askey = escaped;
    entry.className = 'awm-freq-entry';
    entry.style.borderTopColor = col || '#888';

    const valsHtml = freqParts
        .map(p => `<span class="awm-freq-val" style="color:${freqColor};">${p}</span>`)
        .join('<span style="color:#444;margin:0 4px;">·</span>');

    entry.innerHTML =
        `<span style="flex:1;min-width:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;">` +
        `<span class="awm-freq-name" style="color:${col};">${escapeHtml(displayName)}</span>` +
        `<span style="color:#555;font-size:10px;">·</span>` +
        `<span class="awm-freq-vals">${valsHtml}</span>` +
        `</span>` +
        `<button class="awm-freq-dismiss" type="button">✕</button>`;

    // Antippen / Klick → Eintrag entfernen, Banner verstecken wenn leer
    const dismiss = (ev) => {
        _awConsumeFreqBannerEvent(ev);
        if (!entry.isConnected) return;
        entry.remove();
        if (!Array.from(banner.children).some(child => child.hidden !== true)) banner.style.display = 'none';
    };
    const consumeOnly = (ev) => _awConsumeFreqBannerEvent(ev, { preventDefault: false });
    const dismissBtn = entry.querySelector('.awm-freq-dismiss');
    ['pointerdown', 'mousedown', 'touchstart'].forEach(type => {
        entry.addEventListener(type, consumeOnly, { passive: false });
        if (dismissBtn) dismissBtn.addEventListener(type, consumeOnly, { passive: false });
    });
    ['pointerup', 'click', 'touchend'].forEach(type => {
        entry.addEventListener(type, dismiss, { passive: false });
        if (dismissBtn) dismissBtn.addEventListener(type, dismiss, { passive: false });
    });

    banner.appendChild(entry);
    banner.style.display = 'block';
    return true;
}

return { getBannerHost, style: getAirspaceStyle, displayName: getAirspaceDisplayName, pulseOnMap, showFrequency: _awShowFreqBanner };
});
