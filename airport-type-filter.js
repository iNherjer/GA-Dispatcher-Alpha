(function initAirportTypeFilter(globalScope) {
    'use strict';

    const STORAGE_KEY = 'ga_mission_airport_type_filters_v1';
    const DEFAULT_IDS = Object.freeze(['traffic', 'ga']);
    const GROUPS = Object.freeze([
        Object.freeze({
            id: 'traffic',
            label: 'Verkehrs- / IFR-Plätze',
            shortLabel: 'Verkehr',
            description: 'Öffentliche zivile, internationale und IFR-Plätze',
            openAipTypes: Object.freeze([2, 3, 9])
        }),
        Object.freeze({
            id: 'ga',
            label: 'GA- / Sonderlandeplätze',
            shortLabel: 'GA',
            description: 'Allgemeine, private oder PPR-pflichtige Landeplätze',
            openAipTypes: Object.freeze([0, 2])
        }),
        Object.freeze({
            id: 'glider',
            label: 'Segelflugplätze',
            shortLabel: 'Segelflug',
            description: 'Segelfluggelände und Windenplätze',
            openAipTypes: Object.freeze([1])
        }),
        Object.freeze({
            id: 'ultralight',
            label: 'UL-Plätze',
            shortLabel: 'UL',
            description: 'Ultraleichtfluggelände',
            openAipTypes: Object.freeze([6])
        }),
        Object.freeze({
            id: 'military',
            label: 'Militärplätze',
            shortLabel: 'Militär',
            description: 'Militärflugplätze und militärische Heliports',
            openAipTypes: Object.freeze([4, 5])
        }),
        Object.freeze({
            id: 'heli',
            label: 'Zivile Heliports',
            shortLabel: 'Heli',
            description: 'Zivile Hubschrauberlandeplätze',
            openAipTypes: Object.freeze([7])
        }),
        Object.freeze({
            id: 'water',
            label: 'Wasserflugplätze',
            shortLabel: 'Wasser',
            description: 'Wasserfluggelände',
            openAipTypes: Object.freeze([10])
        }),
        Object.freeze({
            id: 'strips',
            label: 'Landestreifen / Altiports',
            shortLabel: 'Strips',
            description: 'Landing Strips, Agrarplätze und Altiports',
            openAipTypes: Object.freeze([11, 12, 13])
        })
    ]);
    const VALID_IDS = new Set(GROUPS.map(group => group.id));
    const TYPE_TO_GROUP = new Map();
    GROUPS.forEach(group => group.openAipTypes.forEach(type => TYPE_TO_GROUP.set(type, group.id)));
    let selectedIds = null;

    function storage() {
        try {
            return globalScope.localStorage || null;
        } catch (_) {
            return null;
        }
    }

    function sanitizeSelection(ids) {
        const clean = [];
        for (const id of Array.isArray(ids) ? ids : []) {
            const normalized = String(id || '').trim().toLowerCase();
            if (VALID_IDS.has(normalized) && !clean.includes(normalized)) clean.push(normalized);
        }
        return clean.length ? clean : [...DEFAULT_IDS];
    }

    function readSelection() {
        if (selectedIds) return [...selectedIds];
        try {
            const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) || 'null');
            selectedIds = sanitizeSelection(parsed);
        } catch (_) {
            selectedIds = [...DEFAULT_IDS];
        }
        return [...selectedIds];
    }

    function writeSelection(ids, options = {}) {
        selectedIds = sanitizeSelection(ids);
        if (options.persist !== false) {
            try {
                storage()?.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
            } catch (_) {}
        }
        updateUi();
        if (options.emit !== false && typeof globalScope.dispatchEvent === 'function') {
            try {
                globalScope.dispatchEvent(new CustomEvent('ga:airport-types-changed', {
                    detail: { selected: [...selectedIds] }
                }));
            } catch (_) {}
        }
        return [...selectedIds];
    }

    function normalizeOpenAipType(record) {
        const candidates = [
            record?.openAipType,
            record?.airportType,
            record?.typeCode,
            record?.type
        ];
        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined || candidate === '') continue;
            const numeric = Number(candidate);
            if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 13) return numeric;
        }
        return null;
    }

    function classify(record = {}) {
        const openAipType = normalizeOpenAipType(record);
        if (openAipType === 8) return 'closed';
        if (openAipType === 2) return (record?.ppr || record?.private) ? 'ga' : 'traffic';
        if (TYPE_TO_GROUP.has(openAipType)) return TYPE_TO_GROUP.get(openAipType);

        const legacyType = String(record?.type || '').trim().toLowerCase();
        if (legacyType === 'closed') return 'closed';
        if (legacyType === 'heliport') return 'heli';
        if (legacyType === 'seaplane_base') return 'water';
        if (legacyType === 'large_airport' || legacyType === 'medium_airport') return 'traffic';
        if (record?.iata || record?.iataCode) return 'traffic';
        return 'ga';
    }

    function matches(record = {}, ids = readSelection()) {
        const category = classify(record);
        return category !== 'closed' && sanitizeSelection(ids).includes(category);
    }

    function openAipTypes(ids = readSelection()) {
        const selected = new Set(sanitizeSelection(ids));
        return Array.from(new Set(
            GROUPS
                .filter(group => selected.has(group.id))
                .flatMap(group => group.openAipTypes)
        )).sort((a, b) => a - b);
    }

    function groupForRecord(record = {}) {
        const category = classify(record);
        return GROUPS.find(group => group.id === category) || null;
    }

    function selectedGroups() {
        const selected = new Set(readSelection());
        return GROUPS.filter(group => selected.has(group.id));
    }

    function summary(options = {}) {
        const groups = selectedGroups();
        if (groups.length === GROUPS.length) return options.compact ? 'ALLE' : 'Alle Platztypen';
        if (groups.length === 1) return groups[0][options.compact ? 'shortLabel' : 'label'];
        if (groups.length === 2) {
            return groups.map(group => group.shortLabel).join(' + ');
        }
        return options.compact ? `${groups.length} TYPEN` : `${groups.length} Platztypen`;
    }

    function radioSummary() {
        const groups = selectedGroups();
        const ids = groups.map(group => group.id);
        if (groups.length === GROUPS.length) return 'ALL';
        if (ids.length === 2 && ids.includes('traffic') && ids.includes('ga')) return 'V+GA';
        if (ids.length === 1) {
            return {
                traffic: 'VERK',
                ga: 'GA',
                glider: 'SEGL',
                ultralight: 'UL',
                military: 'MIL',
                heli: 'HELI',
                water: 'WASS',
                strips: 'STRIP'
            }[ids[0]] || groups[0].shortLabel;
        }
        return `${groups.length} TYP`;
    }

    function renderOptions() {
        const doc = globalScope.document;
        const host = doc?.getElementById('airportTypePickerOptions');
        if (!host || host.dataset.rendered === '1') return;
        host.innerHTML = GROUPS.map(group => `
            <label class="airport-type-option" data-airport-type="${group.id}">
                <input type="checkbox" value="${group.id}">
                <span class="airport-type-option-copy">
                    <strong>${group.label}</strong>
                    <small>${group.description}</small>
                </span>
            </label>
        `).join('');
        host.addEventListener('change', event => {
            const checked = Array.from(host.querySelectorAll('input[type="checkbox"]:checked'))
                .map(input => input.value);
            if (!checked.length) {
                const changed = event?.target;
                if (changed) changed.checked = true;
                return;
            }
            writeSelection(checked);
        });
        host.dataset.rendered = '1';
    }

    function updateUi() {
        const doc = globalScope.document;
        if (!doc) return;
        renderOptions();
        const selected = new Set(readSelection());
        doc.querySelectorAll('#airportTypePickerOptions input[type="checkbox"]').forEach(input => {
            input.checked = selected.has(input.value);
        });
        const full = summary();
        const compact = summary({ compact: true });
        [
            ['airportTypeFilterButton', full],
            ['airportTypeFilterRadioButton', radioSummary()],
            ['opsAirportTypeButton', compact]
        ].forEach(([id, label]) => {
            const button = doc.getElementById(id);
            if (!button) return;
            const value = button.querySelector('[data-airport-type-summary]');
            if (value) value.textContent = label;
            else button.textContent = label;
            button.setAttribute('aria-label', `Platztypen auswählen. Aktiv: ${full}`);
            button.title = `Aktiv: ${full}`;
        });
        const count = doc.getElementById('airportTypePickerCount');
        if (count) count.textContent = `${selected.size} von ${GROUPS.length} aktiv`;
    }

    function setDialogOpen(open) {
        const doc = globalScope.document;
        const backdrop = doc?.getElementById('airportTypePickerBackdrop');
        const dialog = doc?.getElementById('airportTypePickerDialog');
        if (!backdrop || !dialog) return;
        backdrop.hidden = !open;
        dialog.setAttribute('aria-hidden', open ? 'false' : 'true');
        doc.body.classList.toggle('airport-type-picker-open', open);
        if (open) {
            updateUi();
            globalScope.setTimeout(() => {
                dialog.querySelector('input:checked')?.focus?.();
            }, 0);
        }
    }

    function open(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setDialogOpen(true);
    }

    function close(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setDialogOpen(false);
    }

    function initUi() {
        const doc = globalScope.document;
        if (!doc) return;
        renderOptions();
        updateUi();
        const backdrop = doc.getElementById('airportTypePickerBackdrop');
        if (backdrop && backdrop.dataset.airportTypeBound !== '1') {
            backdrop.addEventListener('click', event => {
                if (event.target === backdrop) close(event);
            });
            backdrop.dataset.airportTypeBound = '1';
        }
        if (doc.documentElement.dataset.airportTypeKeyBound !== '1') {
            doc.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !doc.getElementById('airportTypePickerBackdrop')?.hidden) {
                    close(event);
                }
            });
            doc.documentElement.dataset.airportTypeKeyBound = '1';
        }
    }

    const api = Object.freeze({
        storageKey: STORAGE_KEY,
        groups: GROUPS,
        defaultIds: DEFAULT_IDS,
        classify,
        matches,
        openAipTypes,
        groupForRecord,
        getSelected: readSelection,
        setSelected: writeSelection,
        selectDefaults: () => writeSelection(DEFAULT_IDS),
        selectAll: () => writeSelection(GROUPS.map(group => group.id)),
        summary,
        radioSummary,
        updateUi,
        initUi,
        open,
        close
    });

    globalScope.gaAirportTypes = api;
})(typeof window !== 'undefined' ? window : globalThis);
