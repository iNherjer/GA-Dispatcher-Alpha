(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.GADisplayClockCore = api; api.install(root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const STORAGE_KEY = 'ga_display_clock_v1';
    const MAX_AGE_MS = 8000;
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const wrap = seconds => ((seconds % 86400) + 86400) % 86400;
    function normalize(value = {}) {
        value = value || {};
        return { source: value.source === 'device' ? 'device' : 'simulator', zone: value.zone === 'local' ? 'local' : 'utc' };
    }
    // ABSOLUTE TIME is UTC seconds since midnight Jan 1, year 1.
    // Only time of day is needed here; no simulator dates become runtime timestamps.
    function resolve(settings, sample, now = Date.now()) {
        const choice = normalize(settings);
        const fd = sample && sample.flight;
        const fresh = sample && finite(sample.receivedAt) && now >= sample.receivedAt && now - sample.receivedAt <= MAX_AGE_MS;
        const absolute = fd && fd.simAbsoluteTimeSeconds;
        const local = fd && fd.simLocalTimeSeconds;
        const usable = fresh && fd && fd.simRunning !== 0 && fd.inMenuOrMap !== true
            && finite(absolute) && absolute >= 86400
            && (choice.zone === 'utc' || (finite(local) && local >= 0 && local < 86400));
        if (choice.source === 'simulator' && usable) {
            return { source: 'simulator', zone: choice.zone, fallback: false,
                seconds: choice.zone === 'local' ? local : wrap(absolute) };
        }
        const fallback = choice.source === 'simulator';
        const zone = fallback ? 'utc' : choice.zone;
        const date = new Date(now);
        const seconds = zone === 'utc' ? date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds()
            : date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
        return { source: 'device', zone, fallback, seconds };
    }
    function format(clock, minutes = 0, withSeconds = false) {
        if (!clock || !finite(clock.seconds) || !finite(minutes)) return '--:--';
        const seconds = Math.floor(wrap(clock.seconds + Math.max(0, minutes) * 60));
        const pad = value => String(value).padStart(2, '0');
        return pad(Math.floor(seconds / 3600)) + ':' + pad(Math.floor(seconds / 60) % 60)
            + (withSeconds ? ':' + pad(seconds % 60) : '');
    }
    function install(win) {
        let settings = normalize(), sample = null;
        try { settings = normalize(JSON.parse(win.localStorage.getItem(STORAGE_KEY)) || {}); } catch (_) {}
        const current = zone => resolve(zone ? { source: settings.source, zone } : settings, sample);
        const setText = (id, text) => { const node = win.document.getElementById(id); if (node && node.textContent !== text) node.textContent = text; };
        function refreshClocks() {
            const utc = current('utc'), local = current('local');
            setText('mapStopwatchUtc', format(utc, 0, true));
            setText('mapStopwatchLocal', format(local, 0, true));
            setText('mapStopwatchLocalLabel', local.fallback ? 'UTC (Fallback)' : 'LOCAL');
            setText('mapStopwatchClockSource', utc.source === 'simulator' ? 'Simulator' : utc.fallback ? 'Gerät · Fallback' : 'Gerät');
        }
        function refresh() {
            const clock = current();
            const basis = (clock.source === 'simulator' ? 'SIM' : 'GER') + ' ' + (clock.zone === 'utc' ? 'UTC' : 'Lokal');
            setText('mapClockStatus', format(clock, 0, true) + ' · ' + basis + (clock.fallback ? ' · Fallback' : ''));
            setText('routeProgressTimeBasis', basis + (clock.fallback ? ' ↩' : ''));
            const source = win.document.getElementById('mapClockSource');
            const zone = win.document.getElementById('mapClockZone');
            if (source && source.value !== settings.source) source.value = settings.source;
            if (zone && zone.value !== settings.zone) zone.value = settings.zone;
            refreshClocks();
            if (typeof win.refreshRouteProgressBar === 'function') win.refreshRouteProgressBar();
        }
        win.GADisplayClock = {
            settings: () => ({ ...settings }),
            set: (patch, persistToTracker = true) => {
                settings = normalize({ ...settings, ...patch });
                try { win.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
                if (persistToTracker && typeof win.gaPersistDisplayClockSetting === 'function') {
                    if (patch.source) win.gaPersistDisplayClockSetting('clockSource', settings.source);
                    if (patch.zone) win.gaPersistDisplayClockSetting('clockZone', settings.zone);
                }
                refresh();
            },
            // Snapshot receipt is separate from the simulator clock. Never advance a
            // paused/missing sample with wall time or simulation rate.
            observe: (flight, receivedAt = Date.now()) => { sample = flight ? { flight: { ...flight }, receivedAt } : null; refresh(); },
            clear: () => { sample = null; refresh(); },
            current, eta: minutes => format(current(), minutes), refresh, refreshClocks
        };
        if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', refresh);
        else refresh();
        let timer = win.setInterval(refresh, 1000);
        win.addEventListener('pagehide', () => { win.clearInterval(timer); timer = null; });
        win.addEventListener('pageshow', () => {
            if (timer === null) timer = win.setInterval(refresh, 1000);
            refresh();
        });
    }
    return { normalize, resolve, format, install, MAX_AGE_MS };
});
