/* Shared radio intent validation. No mission/data-source classification changes. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GARadioTuningCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function normalize(input) {
        const kind = String(input.kind || '').toUpperCase();
        const index = Number(input.index === undefined ? 1 : input.index);
        const slot = input.slot || 'active';
        if (['COM', 'NAV', 'ADF', 'XPDR'].indexOf(kind) < 0 || [1, 2].indexOf(index) < 0
            || ['active', 'standby'].indexOf(slot) < 0 || (kind === 'XPDR' && (index !== 1 || slot !== 'active'))) throw new Error('radio_target_invalid');
        const raw = String(input.value === undefined ? '' : input.value).trim().replace(',', '.');
        if (kind === 'XPDR') {
            if (!/^[0-7]{4}$/.test(raw)) throw new Error('squawk_invalid');
            return { kind, index, slot, value: raw, encoded: parseInt(raw, 16), expected: parseInt(raw, 16), unit: 'Bco16' };
        }
        if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('radio_frequency_invalid');
        const value = Number(raw);
        const hz = Math.round(value * (kind === 'ADF' ? 1000 : 1000000));
        const valid = kind === 'COM' ? hz >= 118000000 && hz <= 136990000 && hz % 5000 === 0 && [20,45,70,95].indexOf((hz / 1000) % 100) < 0
            : kind === 'NAV' ? hz >= 108000000 && hz <= 117950000 && hz % 50000 === 0
            : hz >= 190000 && hz <= 1799900 && hz % 100 === 0;
        if (!valid) throw new Error('radio_frequency_invalid');
        return { kind, index, slot, value: kind === 'ADF' ? String(value) : value.toFixed(3), expected: hz,
            encoded: kind === 'ADF' ? parseInt(('00000000' + hz).slice(-8), 16) : hz, unit: 'Hz' };
    }
    function event(spec) {
        if (spec.kind === 'XPDR') return 'XPNDR_SET';
        if (spec.kind === 'ADF') return (spec.index === 1 ? 'ADF' : 'ADF2') + (spec.slot === 'active' ? '_COMPLETE_SET' : '_STBY_SET');
        if (spec.kind === 'NAV') return 'NAV' + spec.index + (spec.slot === 'active' ? '_RADIO_SET_HZ' : '_STBY_SET_HZ');
        return (spec.index === 1 ? 'COM' : 'COM2') + (spec.slot === 'active' ? '_RADIO_SET_HZ' : '_STBY_RADIO_SET_HZ');
    }
    function variable(spec) {
        return spec.kind === 'XPDR' ? 'TRANSPONDER CODE:1' : spec.kind + (spec.slot === 'active' ? ' ACTIVE FREQUENCY:' : ' STANDBY FREQUENCY:') + spec.index;
    }
    function navaidKind(label) {
        const typeLabels = {0:'DME',1:'TACAN',2:'NDB',3:'VOR',4:'VOR/DME',5:'VORTAC',6:'DVOR',7:'DVOR/DME',8:'DVORTAC'};
        const text = String(typeLabels[label] || label || '').toUpperCase();
        if (/TACAN/.test(text) && !/VOR/.test(text)) return '';
        if (/NDB|ADF/.test(text)) return 'ADF';
        if (/VOR|ILS|LOC/.test(text)) return 'NAV';
        return '';
    }
    function escape(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function html(value, kind, label) {
        try {
            const spec = normalize({kind, value});
            return '<span class="ga-radio-value" role="button" tabindex="-1" aria-disabled="true" data-radio-kind="' + spec.kind + '" data-radio-value="' + spec.value + '">' + escape(label == null ? value : label) + '</span>';
        } catch (_) { return escape(label == null ? value : label); }
    }
    // Only call on an explicitly identified frequency field, never on briefing/general DOM text.
    function text(value, kind) {
        const raw = String(value || '');
        const pattern = /\b\d{2,4}(?:[.,]\d{1,3})?\b/g;
        let out = '', end = 0, match;
        while ((match = pattern.exec(raw))) {
            out += escape(raw.slice(end, match.index));
            const prefix = raw.slice(end, match.index);
            const target = /XPDR|SQK|SQUAWK|TRANSP/i.test(prefix) ? 'XPDR' : kind;
            out += html(match[0], target);
            end = match.index + match[0].length;
        }
        return out + escape(raw.slice(end));
    }
    function waypoint(value, kind) {
        const raw = String(value || '');
        const match = /^(.*)\((\d{2,4}(?:[.,]\d{1,3})?)\)$/.exec(raw);
        if (!match || !kind) return escape(raw);
        return escape(match[1]) + '(' + html(match[2],kind) + ')';
    }
    return { normalize, event, variable, navaidKind, escape, html, text, waypoint };
});
