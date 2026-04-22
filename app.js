/* =========================================================
   GLOBAL HELPERS
   ========================================================= */
if (!document.getElementById('vp-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'vp-pulse-style';
    style.innerHTML = `@keyframes vpPulse { 0% {opacity:1; transform:scale(1);} 50% {opacity:0.4; transform:scale(0.85);} 100% {opacity:1; transform:scale(1);} } .vp-loading-pulse { animation: vpPulse 1.2s infinite; pointer-events: none; }`;
    document.head.appendChild(style);
}

window.formatAsLimit = function(lim) {
    if (!lim) return '?';
    if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
    if (lim.unit === 6) return `FL ${lim.value}`;
    let u = lim.unit === 1 ? 'FT' : 'M';
    let r = lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '');
    return `${lim.value} ${u}${r}`;
};

// V77: Globale Flag – true, solange der Nutzer irgendeinen Slider/Knob berührt
window.vpUIInteractionActive = false;
document.addEventListener('DOMContentLoaded', () => {
    // Erkennt, wenn der Nutzer an einem klassischen Slider zieht
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('mousedown', () => window.vpUIInteractionActive = true);
        slider.addEventListener('touchstart', () => window.vpUIInteractionActive = true, {passive: true});
        const onEnd = () => {
            window.vpUIInteractionActive = false;
            if (slider.id === 'altSlider' || slider.id === 'rateSlider') {
                if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
                if (typeof vpDrawClouds === 'function' && document.getElementById('verticalProfileCanvas')) {
                    renderMapProfile(); renderVerticalProfile('verticalProfileCanvas');
                }
            }
        };
        slider.addEventListener('mouseup', onEnd);
        slider.addEventListener('touchend', onEnd);
        slider.addEventListener('touchcancel', onEnd); // Verhindert Einfrieren beim Scrollen
    });
});

/* =========================================================
   1. THEME TOGGLE & NOTIZEN TOGGLE
   ========================================================= */
function changeThemeFromSlider(val) {
    const v = parseInt(val);
    if (v === 0) setTheme('classic');
    else if (v === 1) setTheme('retro');
    else if (v === 2) setTheme('navcom');
}

function setTheme(mode) {
    const wasNavcom = document.body.classList.contains('theme-navcom');
    document.body.classList.remove('theme-retro', 'theme-navcom');
    const lblClassic = document.getElementById('lbl-classic');
    const lblRetro = document.getElementById('lbl-retro');
    const lblNavcom = document.getElementById('lbl-navcom');
    const slider = document.getElementById('themeSlider');

    if (lblClassic) lblClassic.style.color = '#888';
    if (lblRetro) lblRetro.style.color = '#888';
    if (lblNavcom) lblNavcom.style.color = '#888';

    if (mode === 'retro') {
        document.body.classList.add('theme-retro');
        localStorage.setItem('ga_theme', 'retro');
        if (slider) slider.value = 1;
        if (lblRetro) lblRetro.style.color = '#d93829';
    } else if (mode === 'navcom') {
        document.body.classList.add('theme-navcom', 'theme-retro');
        localStorage.setItem('ga_theme', 'navcom');
        if (slider) slider.value = 2;
        if (lblNavcom) lblNavcom.style.color = '#33ff33';
    } else {
        localStorage.setItem('ga_theme', 'classic');
        if (slider) slider.value = 0;
        if (lblClassic) lblClassic.style.color = '#4da6ff';
    }
    updateDynamicColors();
    refreshAllDrums();
    syncGPSWithTheme(mode, wasNavcom);

    // --- NEU: Wetter-Widgets beim Theme-Wechsel sofort neu rendern ---
    if (typeof currentStartICAO !== 'undefined' && currentStartICAO) {
        const depP = routeWaypoints && routeWaypoints.length > 0 ? routeWaypoints[0] : null;
        loadMetarWidget(currentStartICAO, 'metarContainerDep', depP?.lat, depP?.lng || depP?.lon);
    }
    if (typeof currentDestICAO !== 'undefined' && currentDestICAO) {
        const isPOI = document.getElementById("destRwyContainer")?.style.display === "none";
        const destP = routeWaypoints && routeWaypoints.length > 1 ? routeWaypoints[routeWaypoints.length - 1] : null;
        loadMetarWidget(isPOI ? null : currentDestICAO, 'metarContainerDest', destP?.lat, destP?.lng || destP?.lon);
    }
}

function syncGPSWithTheme(newMode, wasNavcom) {
    const fp = document.querySelector('.flightplan-container');
    const mod = document.getElementById('kln90bModule');
    if (newMode === 'navcom') {
        if (gpsState.visible) {
            if (mod) mod.style.display = 'flex';
            if (fp) fp.style.display = 'none';
            renderGPS();
        } else {
            if (mod) mod.style.display = 'none';
            if (fp) fp.style.display = '';
        }
    } else {
        if (mod) mod.style.display = 'none';
        if (fp) fp.style.display = '';
    }
}

function syncToNavCom(radioId, value) {
    const el = document.getElementById(radioId);
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = value;
    } else {
        el.innerText = value;
    }
}

function applyNavComPreset(t, g, s, n, btnElement) {
    applyPreset(t, g, s, n);
    document.getElementById('btnAC-C172').classList.remove('active');
    document.getElementById('btnAC-PA24').classList.remove('active');
    document.getElementById('btnAC-AERO').classList.remove('active');
    btnElement.classList.add('active');
    document.getElementById('tasSlider').value = t;
    document.getElementById('gphSlider').value = g;
    handleSliderChange('tas', t);
    handleSliderChange('gph', g);
    syncToNavCom('tasRadioDisplay', t);
    syncToNavCom('gphRadioDisplay', g.toString().padStart(2, '0'));
    saveAudioButtonStates();
}

function toggleNavComAI(btnElement) {
    const aiToggleBtn = document.getElementById('aiToggle');
    if (aiToggleBtn) {
        aiToggleBtn.checked = !aiToggleBtn.checked;
        saveAiToggle();
        if (aiToggleBtn.checked) btnElement.classList.add('active');
        else btnElement.classList.remove('active');
        saveAudioButtonStates();
    }
}

function swapDepDest() {
    const depRadio = document.getElementById('startLocRadio');
    const destRadio = document.getElementById('destLocRadio');
    const depClassic = document.getElementById('startLoc');
    const destClassic = document.getElementById('destLoc');
    if (!depRadio || !destRadio) return;

    if (!destRadio.value || !destRadio.value.trim()) {
        destRadio.value = depRadio.value;
        if (destClassic) destClassic.value = depRadio.value;
        const targetTypeSel = document.getElementById('targetType');
        if (targetTypeSel) {
            targetTypeSel.value = 'poi';
            targetTypeSel.dispatchEvent(new Event('change'));
        }
        updateMapFromInputs();
        return;
    }

    const tempVal = depRadio.value;
    depRadio.value = destRadio.value;
    destRadio.value = tempVal;
    if (depClassic) depClassic.value = depRadio.value;
    if (destClassic) destClassic.value = destRadio.value;
    updateMapFromInputs();
}

function cycleRadioOption(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    let nextIndex = selectEl.selectedIndex + 1;
    if (nextIndex >= selectEl.options.length) nextIndex = 0;
    selectEl.selectedIndex = nextIndex;
    selectEl.dispatchEvent(new Event('change'));
}

const MISSION_PICKER_STORAGE_KEY = 'ga_mission_picker_mode';
const MISSION_PICKER_OPTIONS = {
    basic: [
        { value: 'apt', classic: 'Flugplatz (A ➔ B)', radioShort: 'APT', radioFull: 'Airport (alle Kategorien)' },
        { value: 'poi', classic: 'POI (Rundflug)', radioShort: 'POI', radioFull: 'POI (alle Kategorien)' }
    ],
    full: [
        { value: 'apt:all', classic: 'APT (alle Kategorien)', radioShort: 'APT ALL', radioFull: 'Airport (alle Kategorien)' },
        { value: 'apt:club', classic: 'APT · Verein', radioShort: 'APT CLUB', radioFull: 'Airport · Verein' },
        { value: 'apt:private', classic: 'APT · Privat', radioShort: 'APT PRIV', radioFull: 'Airport · Privat' },
        { value: 'apt:charter', classic: 'APT · Charter', radioShort: 'APT CHR', radioFull: 'Airport · Charter' },
        { value: 'apt:cargo', classic: 'APT · Cargo (ohne PAX)', radioShort: 'APT CARGO', radioFull: 'Airport · Cargo (ohne PAX)' },
        { value: 'apt:trn', classic: 'APT · Training', radioShort: 'APT TRN', radioFull: 'Airport · Training' },
        { value: 'apt:all+medical_transfer', classic: 'APT · Medizin-Transfer', radioShort: 'APT MED', radioFull: 'Airport · Medizin-Transfer' },
        { value: 'apt:all+cargo_fragile', classic: 'APT · Fragile Fracht', radioShort: 'APT FRG', radioFull: 'Airport · Fragile Fracht' },
        { value: 'apt:all+animal_transport', classic: 'APT · Tiertransport', radioShort: 'APT ANM', radioFull: 'Airport · Tiertransport' },
        { value: 'apt:all+news_coverage', classic: 'APT · Reporter', radioShort: 'APT NEWS', radioFull: 'Airport · Reporter' },
        { value: 'apt:all+sightseeing_tour', classic: 'APT · Sightseeing', radioShort: 'APT TOUR', radioFull: 'Airport · Sightseeing' },
        { value: 'poi:all', classic: 'POI (alle Kategorien)', radioShort: 'POI ALL', radioFull: 'POI (alle Kategorien)' },
        { value: 'poi:bridge', classic: 'POI · Brücken', radioShort: 'POI BRG', radioFull: 'POI · Brücken' },
        { value: 'poi:road', classic: 'POI · Straße/Autobahn', radioShort: 'POI ROAD', radioFull: 'POI · Straße/Autobahn' },
        { value: 'poi:dam', classic: 'POI · Staudamm/Talsperre', radioShort: 'POI DAM', radioFull: 'POI · Staudamm/Talsperre' },
        { value: 'poi:telecom', classic: 'POI · Funkmast/Funkturm', radioShort: 'POI TEL', radioFull: 'POI · Funkmast/Funkturm' },
        { value: 'poi:industry', classic: 'POI · Industrie/Anlagen', radioShort: 'POI IND', radioFull: 'POI · Industrie/Anlagen' },
        { value: 'poi:castle', classic: 'POI · Burg/Schloss', radioShort: 'POI CST', radioFull: 'POI · Burg/Schloss' },
        { value: 'poi:water', classic: 'POI · Fluss/See/Küste', radioShort: 'POI WTR', radioFull: 'POI · Fluss/See/Küste' },
        { value: 'poi:mountain', classic: 'POI · Berg/Tal', radioShort: 'POI MTN', radioFull: 'POI · Berg/Tal' },
        { value: 'poi:city', classic: 'POI · Stadt/Turm', radioShort: 'POI CITY', radioFull: 'POI · Stadt/Turm' },
        { value: 'poi:trn', classic: 'POI · Training (Platznah)', radioShort: 'POI TRN', radioFull: 'POI · Training (platznah)' },
        { value: 'poi:generic', classic: 'POI · Sonstige', radioShort: 'POI GEN', radioFull: 'POI · Sonstige' },
        { value: 'poi:all+mapping_survey', classic: 'POI · Mapping/Survey', radioShort: 'POI MAP', radioFull: 'POI · Mapping/Survey' },
        { value: 'poi:all+news_coverage', classic: 'POI · Reporter', radioShort: 'POI NEWS', radioFull: 'POI · Reporter' },
        { value: 'poi:all+search_and_rescue', classic: 'POI · SAR/Rescue', radioShort: 'POI SAR', radioFull: 'POI · SAR/Rescue' },
        { value: 'poi:all+fire_watch', classic: 'POI · Fire Watch', radioShort: 'POI FIRE', radioFull: 'POI · Fire Watch' }
    ]
};

function parseMissionPickerValue(raw) {
    const value = String(raw || '').trim().toLowerCase();
    const [leftPart, rightPart] = value.split('+');
    const profile = String(rightPart || 'auto').trim() || 'auto';
    if (leftPart === 'apt') return { baseType: 'apt', category: 'all', profile };
    if (leftPart === 'poi') return { baseType: 'poi', category: 'all', profile };
    if (leftPart.startsWith('apt:')) return { baseType: 'apt', category: leftPart.split(':')[1] || 'all', profile };
    if (leftPart.startsWith('poi:')) return { baseType: 'poi', category: leftPart.split(':')[1] || 'all', profile };
    return { baseType: 'apt', category: 'all', profile: 'auto' };
}

const MISSION_ROLE_TASK_PROFILES = {
    auto: {
        id: 'auto',
        label: 'Auto',
        appliesTo: ['apt', 'poi']
    },
    medical_transfer: {
        id: 'medical_transfer',
        label: 'Medizin-Transfer',
        appliesTo: ['apt'],
        roleProfile: 'medical_sensitive_v1',
        taskDomain: 'medical_transfer',
        personas: [
            { name: 'Dr. Lena Roth', role: 'Notärztin', gender: 'female', personality: 'fokussiert, ruhig, empathisch' },
            { name: 'Dr. Jonas Weber', role: 'Notarzt', gender: 'male', personality: 'präzise, ruhig, professionell' }
        ],
        greetingText: 'Hi, danke fürs Fliegen. Wir haben medizinische Priorität und brauchen einen ruhigen, sauberen Flug.',
        paxText: '1 PAX (Notarztteam)',
        cargoPool: ['Kühlbox mit Blutkonserven (18 lbs)', 'Medizinischer Notfallkoffer (22 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'hoch', comfortPriority: 'hoch' },
        storyCue: 'Fokus: medizinische Priorität, ruhig und effizient fliegen.'
    },
    news_coverage: {
        id: 'news_coverage',
        label: 'Reporter-Einsatz',
        appliesTo: ['apt', 'poi'],
        roleProfile: 'news_reporter_professional_v1',
        taskDomain: 'news_coverage',
        personas: [
            { name: 'Mara Feld', role: 'Reporterin', gender: 'female', personality: 'neugierig, sachlich, schnell' },
            { name: 'Timo Berger', role: 'TV-Reporter', gender: 'male', personality: 'präzise, präsent, professionell' }
        ],
        greetingText: 'Hi, ich sammle heute O-Töne und Fakten. Gib mir bitte einen stabilen Flug für klare Ansagen.',
        paxText: '1 PAX (Reporter)',
        cargoPool: ['Kamera- und Audio-Set (32 lbs)', 'Live-Übertragungsrucksack (26 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel' },
        storyCue: 'Fokus: nüchterne Beobachtung und klare Lageeinschätzung.'
    },
    sightseeing_tour: {
        id: 'sightseeing_tour',
        label: 'Sightseeing',
        appliesTo: ['apt', 'poi'],
        roleProfile: 'tour_guide_relaxed_v1',
        taskDomain: 'sightseeing_tour',
        personas: [
            { name: 'Sophie Lang', role: 'Tour-Guide', gender: 'female', personality: 'freundlich, gelassen, kommunikativ' },
            { name: 'Felix Braun', role: 'Stadtführer', gender: 'male', personality: 'locker, charmant, aufmerksam' }
        ],
        greetingText: 'Hi, heute gehts um entspannten Ausblick. Bitte eher weich fliegen, damit alle die Aussicht genießen.',
        paxText: '2 PAX (Sightseeing-Gäste)',
        cargoPool: ['Kleine Kamerataschen (12 lbs)', 'Tagesrucksäcke (15 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'niedrig', stomachSensitivity: 'hoch', comfortPriority: 'hoch' },
        storyCue: 'Fokus: ruhiger Rundflug mit angenehmem Tempo.'
    },
    mapping_survey: {
        id: 'mapping_survey',
        label: 'Mapping/Survey',
        appliesTo: ['poi'],
        roleProfile: 'photogrammetry_precision_v1',
        taskDomain: 'mapping_survey',
        personas: [
            { name: 'Nina Eckert', role: 'Geodatentechnikerin', gender: 'female', personality: 'strukturiert, präzise, ruhig' },
            { name: 'David Kern', role: 'Vermessungstechniker', gender: 'male', personality: 'genau, konzentriert, sachlich' }
        ],
        greetingText: 'Hi, ich brauche heute reproduzierbare Linien und einen ruhigen Plattformflug für saubere Daten.',
        paxText: '1 PAX (Survey-Technik)',
        cargoPool: ['Lidar-Scanner (65 lbs)', 'Photogrammetrie-Kamera (34 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'mittel', comfortPriority: 'hoch' },
        storyCue: 'Fokus: stabile Fluglage und präzise Passes.'
    },
    cargo_fragile: {
        id: 'cargo_fragile',
        label: 'Fragile Fracht',
        appliesTo: ['apt'],
        roleProfile: 'cargo_fragile_highcare_v1',
        taskDomain: 'cargo_fragile',
        personas: [
            { name: 'Miriam Stahl', role: 'Logistik-Kurierin', gender: 'female', personality: 'gewissenhaft, direkt, professionell' },
            { name: 'Ralf König', role: 'Frachtbegleiter', gender: 'male', personality: 'ruhig, organisiert, präzise' }
        ],
        greetingText: 'Hi, die Ladung ist empfindlich. Bitte möglichst ruhig und ohne harte Manöver.',
        paxText: '1 PAX (Frachtbegleitung)',
        cargoPool: ['Präzisionsoptik im Stoßschutz-Case (28 lbs)', 'Laborgerät in Schutzverpackung (35 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'mittel', comfortPriority: 'hoch' },
        storyCue: 'Fokus: sichere, erschütterungsarme Frachtführung.'
    },
    search_and_rescue: {
        id: 'search_and_rescue',
        label: 'Search and Rescue',
        appliesTo: ['poi'],
        roleProfile: 'rescue_coordination_v1',
        taskDomain: 'search_and_rescue',
        personas: [
            { name: 'Lea Winter', role: 'SAR-Koordinatorin', gender: 'female', personality: 'klar, belastbar, fokussiert' },
            { name: 'Jan Ritter', role: 'Rettungskoordinator', gender: 'male', personality: 'ruhig, strukturiert, entschlossen' }
        ],
        greetingText: 'Hi, wir arbeiten heute nach Suchmuster und klaren Calls. Stabilität und Übersicht sind entscheidend.',
        paxText: '1 PAX (SAR-Koordination)',
        cargoPool: ['Optik- und SAR-Kit (24 lbs)', 'Signalmittel und Kartenpaket (16 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel' },
        storyCue: 'Fokus: Suchmuster, Lagebild und sichere Durchführung.'
    },
    fire_watch: {
        id: 'fire_watch',
        label: 'Fire Watch',
        appliesTo: ['poi'],
        roleProfile: 'fire_observer_ops_v1',
        taskDomain: 'fire_watch',
        personas: [
            { name: 'Klara Stein', role: 'Brandbeobachterin', gender: 'female', personality: 'sachlich, wachsam, präzise' },
            { name: 'Markus Adler', role: 'Einsatzbeobachter', gender: 'male', personality: 'ruhig, analytisch, professionell' }
        ],
        greetingText: 'Hi, wir halten heute nach Rauchfahnen und Hotspots Ausschau. Bitte möglichst sauber und stabil fliegen.',
        paxText: '1 PAX (Brandbeobachtung)',
        cargoPool: ['IR-Kamera und Tablet (21 lbs)', 'Feuerlage-Mapset (10 lbs)'],
        tolerances: { gTolerance: 'mittel', bankTolerance: 'mittel', cargoSensitivity: 'mittel', stomachSensitivity: 'mittel', comfortPriority: 'mittel' },
        storyCue: 'Fokus: Frühwarnung, Hotspots und klare Meldungen.'
    },
    animal_transport: {
        id: 'animal_transport',
        label: 'Tiertransport',
        appliesTo: ['apt'],
        roleProfile: 'general_passenger_v1',
        taskDomain: 'animal_transport',
        personas: [
            { name: 'Eva Maurer', role: 'Tierpflegerin', gender: 'female', personality: 'einfühlsam, organisiert, ruhig' },
            { name: 'Tom Falk', role: 'Tierschutz-Kurier', gender: 'male', personality: 'ruhig, verantwortungsvoll, freundlich' }
        ],
        greetingText: 'Hi, wir haben heute Tiere an Bord. Bitte möglichst ruhig fliegen, damit sie entspannt bleiben.',
        paxText: '1 PAX (Tierbegleitung)',
        cargoPool: ['Transportboxen mit Tierschutzbedarf (30 lbs)', 'Veterinärtasche und Tierfutter (18 lbs)'],
        tolerances: { gTolerance: 'niedrig', bankTolerance: 'niedrig', cargoSensitivity: 'hoch', stomachSensitivity: 'hoch', comfortPriority: 'hoch' },
        storyCue: 'Fokus: stressarme Beförderung für Tiere.'
    }
};

function getMissionTaskProfile(profileId, baseType) {
    const id = String(profileId || 'auto').toLowerCase();
    const mode = String(baseType || '').toLowerCase();
    const profile = MISSION_ROLE_TASK_PROFILES[id] || MISSION_ROLE_TASK_PROFILES.auto;
    if (!profile) return null;
    if (!Array.isArray(profile.appliesTo) || profile.appliesTo.includes(mode)) return profile;
    return MISSION_ROLE_TASK_PROFILES.auto;
}

function _missionPickerMode() {
    const m = localStorage.getItem(MISSION_PICKER_STORAGE_KEY);
    if (m === 'full' || m === 'basic') return m;
    return 'full';
}

function _setMissionPickerMode(nextMode) {
    localStorage.setItem(MISSION_PICKER_STORAGE_KEY, nextMode === 'full' ? 'full' : 'basic');
}

function _optionByValue(mode, value) {
    return (MISSION_PICKER_OPTIONS[mode] || []).find(o => o.value === value) || null;
}

function _populateMissionTypeSelects(mode, preferredValue = null) {
    const classic = document.getElementById('targetType');
    const radio = document.getElementById('targetTypeRadio');
    if (!classic || !radio) return;

    const currentClassic = preferredValue || classic.value || radio.value || 'apt';
    const parsed = parseMissionPickerValue(currentClassic);
    let normalizedTarget = currentClassic;

    if (mode === 'basic') {
        normalizedTarget = parsed.baseType;
    } else if (!String(normalizedTarget).includes(':')) {
        normalizedTarget = `${parsed.baseType}:all`;
    }

    const options = MISSION_PICKER_OPTIONS[mode] || MISSION_PICKER_OPTIONS.basic;
    classic.innerHTML = '';
    radio.innerHTML = '';
    options.forEach(opt => {
        const c = document.createElement('option');
        c.value = opt.value;
        c.textContent = opt.classic;
        classic.appendChild(c);

        const r = document.createElement('option');
        r.value = opt.value;
        r.dataset.shortLabel = opt.radioShort || opt.radioFull || opt.classic;
        r.dataset.fullLabel = opt.radioFull || opt.classic;
        r.textContent = r.dataset.shortLabel;
        radio.appendChild(r);
    });

    if (!_optionByValue(mode, normalizedTarget)) {
        normalizedTarget = mode === 'full' ? `${parsed.baseType}:all` : parsed.baseType;
    }
    if (!_optionByValue(mode, normalizedTarget)) normalizedTarget = options[0]?.value || 'apt';

    classic.value = normalizedTarget;
    radio.value = normalizedTarget;
    _setNavcomTypeOptionsExpanded(false);
}

function refreshMissionPickerOptions(preferredValue = null) {
    _populateMissionTypeSelects(_missionPickerMode(), preferredValue);
}

function _setNavcomTypeOptionsExpanded(expanded) {
    const radio = document.getElementById('targetTypeRadio');
    if (!radio) return;
    for (const opt of radio.options) {
        const shortLabel = opt.dataset.shortLabel || opt.textContent;
        const fullLabel = opt.dataset.fullLabel || shortLabel;
        opt.textContent = expanded ? fullLabel : shortLabel;
    }
}

function setMissionTypeSelection(value) {
    const mode = _missionPickerMode();
    const classic = document.getElementById('targetType');
    const radio = document.getElementById('targetTypeRadio');
    if (!classic || !radio) return;
    const parsed = parseMissionPickerValue(value);
    let normalized = String(value || '').trim().toLowerCase();
    if (!_optionByValue(mode, normalized)) {
        normalized = mode === 'full' ? `${parsed.baseType}:all` : parsed.baseType;
    }
    if (!_optionByValue(mode, normalized)) return;
    classic.value = normalized;
    radio.value = normalized;
    localStorage.setItem('ga_target_type', normalized);
    _setNavcomTypeOptionsExpanded(false);
}

function toggleMissionPickerMode() {
    const curMode = _missionPickerMode();
    const nextMode = curMode === 'full' ? 'basic' : 'full';
    const currentValue = document.getElementById('targetType')?.value || 'apt';
    _setMissionPickerMode(nextMode);
    refreshMissionPickerOptions(currentValue);
    localStorage.setItem('ga_target_type', document.getElementById('targetType')?.value || 'apt');
    const indicator = document.getElementById('searchIndicator');
    if (indicator) {
        indicator.innerText = nextMode === 'full'
            ? 'Mission Picker: Kategorien aktiviert'
            : 'Mission Picker: Basisansicht (APT/POI)';
        setTimeout(() => {
            if (indicator.innerText.includes('Mission Picker:')) indicator.innerText = 'System bereit.';
        }, 1600);
    }
}

function classifyAptMissionCategory(ms) {
    const t = normalizeMissionText(ms?.t || '');
    const s = normalizeMissionText(ms?.s || '');
    const all = `${t} ${s}`;
    if ((ms?.cat || '') === 'trn' || /training|ueb|checkflug|flight review|stall|vor|pattern|touch|go|steep|avionics|no-flap|crosswind/.test(all)) return 'trn';
    if (/organtransport|aog|labor|urgent mail|medicine|archive transport|flower delivery|high priority courier|art transfer|relocation flight|fracht|dokumente|ersatzteil|medikament|plasma|proben|transport/.test(all)) return 'cargo';
    if (/business charter|vip transfer|investor|unternehmer|meeting|bauabnahme|charter|kunde/.test(all)) return 'charter';
    if (/flugplatzfest|vereinsmaschine|kollegen-hilfe|piloten-stammtisch|fly-in|aeroclub|vereins/.test(all)) return 'club';
    return 'private';
}

function toggleNotes(event) {
    // Wenn wir auf einen Link, Button oder ein Pin-Icon klicken, umblättern hart blockieren
    if (event && event.target && (
        event.target.tagName === 'A' ||
        event.target.tagName === 'BUTTON' ||
        event.target.classList.contains('briefing-save-pin') ||
        event.target.classList.contains('briefing-export-pin') ||
        event.target.classList.contains('briefing-pdf-pin')
    )) return;

    const pages = ['notePage1', 'notePage2', 'notePage3', 'notePage4', 'notePage5'].map(id => document.getElementById(id)).filter(Boolean);
    if (pages.length < 2) return;
    const classes = ['front-note', 'back-note', 'third-note', 'fourth-note', 'fifth-note'];

    let forward = true;
    if (event && event.target && event.target.classList.contains('paperclip')) {
        forward = false;
    } else if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        if (clickX < rect.width / 2) forward = false;
    } else if (event) {
        if (event.clientX < window.innerWidth / 2) forward = false;
    }

    // Find current front page index
    let frontIdx = pages.findIndex(p => p.classList.contains('front-note'));
    if (frontIdx < 0) frontIdx = 0;

    if (forward) {
        frontIdx = (frontIdx + 1) % pages.length;
    } else {
        frontIdx = (frontIdx - 1 + pages.length) % pages.length;
    }

    // Assign classes in order starting from frontIdx
    for (let i = 0; i < pages.length; i++) {
        let pageIdx = (frontIdx + i) % pages.length;
        pages[pageIdx].className = 'mission-note-page ' + classes[i];
    }
}

function toggleWikiPhoto(event, containerId) {
    const container = document.getElementById(containerId);
    if (!container) { event.stopPropagation(); return; }

    // ── ZOOM-OUT: Placeholder im DOM → Element ist gerade gezoomt ──
    const placeholder = document.getElementById('photo-zoom-placeholder');
    if (placeholder) {
        event.stopPropagation();
        const origTransform = container.dataset.wikiOrigTransform || '';
        const rotMatch  = origTransform.match(/rotate\(([^)]+)\)/);
        const origAngle = rotMatch ? rotMatch[1] : '0deg';

        // Viewport-Mitte und Startskalierung aus Zoom-In wiederverwenden
        const vpCx       = parseFloat(container.dataset.wikiVpCx  || window.innerWidth  / 2);
        const vpCy       = parseFloat(container.dataset.wikiVpCy  || window.innerHeight * 0.42);
        const startScale = parseFloat(container.dataset.wikiZoomStartScale || 0.35);

        // Platzhalter-Mitte = Viewport-Position der Originalstelle (dank margin-left:auto im Platzhalter korrekt)
        const phRect = placeholder.getBoundingClientRect();
        const phCx   = phRect.left + phRect.width  / 2;
        const phCy   = phRect.top  + phRect.height / 2;

        // Schliess-Transform: von Mitte (translate 0,0 scale 1) zurück zur Originalposition (startScale)
        void container.offsetWidth;
        container.style.transform = `translate(${(phCx - vpCx).toFixed(1)}px, ${(phCy - vpCy).toFixed(1)}px) scale(${startScale.toFixed(4)}) rotate(${origAngle})`;
        container.style.boxShadow = '';
        container.style.cursor    = '';

        setTimeout(() => {
            placeholder.parentNode.insertBefore(container, placeholder);
            placeholder.remove();
            // Outer-Container-Style vollständig wiederherstellen (width, position, margin, transform …)
            container.style.cssText = container.dataset.wikiOrigCssText || '';
            // Inner photo-img-Höhe wiederherstellen
            const imgEl = container.querySelector('.photo-img');
            if (imgEl) imgEl.style.height = container.dataset.wikiPhotoImgOrigHeight || '';
        }, 430);

        const bd = document.getElementById('photo-backdrop');
        if (bd) { bd.style.opacity = '0'; setTimeout(() => bd.remove(), 400); }
        return;
    }

    // Zoom-In nur auf aktiver Seite
    const page = container.closest('.mission-note-page');
    if (page && !page.classList.contains('front-note')) return;

    event.stopPropagation();

    // ── ZOOM-IN ──
    // Strategie: Element auf Ziel-Displaygröße setzen (scale 1 im Endzustand) statt
    // kleines Element hochzuskalieren. background-size:cover rendert dann nativ in
    // voller Zielauflösung → gestochen scharfes Bild, keine GPU-Upscale-Unschärfe.
    const rect = container.getBoundingClientRect();
    container.dataset.wikiOrigTransform = container.style.transform || '';
    container.dataset.wikiOrigCssText   = container.style.cssText;

    const noteRef = container.closest('.notes-stack') || container.closest('.mission-note-page');
    const noteW   = noteRef ? noteRef.getBoundingClientRect().width : window.innerWidth * 0.7;

    const isMobile   = window.innerWidth <= 767;
    const targetW    = isMobile ? (window.innerWidth - 24) : (noteW * 1.2);
    const scaleRatio = targetW / rect.width;

    // Photo-img proportional skalieren, damit background-size:cover die Zielgröße füllt
    const imgEl = container.querySelector('.photo-img');
    container.dataset.wikiPhotoImgOrigHeight = imgEl ? (imgEl.style.height || '') : '';
    const origPhotoH = imgEl
        ? (parseFloat(imgEl.style.height) || parseFloat(window.getComputedStyle(imgEl).height) || 100)
        : 100;
    const newPhotoH = Math.round(origPhotoH * scaleRatio);
    if (imgEl) imgEl.style.height = newPhotoH + 'px';

    // Platzhalter mit korrektem margin-left → Zoom-Out landet exakt an Originalposition
    const mlMatch = (container.dataset.wikiOrigCssText || '').match(/margin-left\s*:\s*([^;]+)/i);
    const origML  = mlMatch ? mlMatch[1].trim() : 'auto';
    const ph = document.createElement('div');
    ph.id = 'photo-zoom-placeholder';
    ph.style.cssText = `width:${rect.width}px;height:${rect.height}px;flex-shrink:0;margin-left:${origML};visibility:hidden;`;
    container.parentNode.insertBefore(ph, container);

    // Gesamthöhe analytisch berechnen (padding-top 6 + padding-bottom 22 + border 2 = 30px)
    const actualTargetH = newPhotoH + 30;

    // Viewport-Mitte für Zoom (wird für Zoom-Out gespeichert)
    const vpCx = window.innerWidth  / 2;
    const vpCy = window.innerHeight * 0.42;
    container.dataset.wikiVpCx = vpCx;
    container.dataset.wikiVpCy = vpCy;

    const startScale = rect.width / targetW;   // < 1 → lässt Element in Originalgröße erscheinen
    container.dataset.wikiZoomStartScale = startScale.toFixed(6);

    // Element nach <body> verschieben – kein overflow-clipping durch Ancestors
    document.body.appendChild(container);

    // Transition unterdrücken während Setup (überschreibt das !important der CSS-Klasse)
    container.classList.add('wiki-zoom-setup');

    container.style.position = 'fixed';
    // Breite mit !important setzen, damit das mobile CSS (!important: 100px) überschrieben wird.
    // Inline-!important schlägt Stylesheet-!important in der CSS-Kaskade.
    container.style.setProperty('width', Math.round(targetW) + 'px', 'important');
    container.style.top      = Math.round(vpCy - actualTargetH / 2) + 'px';
    container.style.left     = Math.round(vpCx - targetW        / 2) + 'px';
    container.style.margin   = '0';
    container.style.float    = 'none';
    container.style.zIndex   = '10000';
    container.style.cursor   = 'zoom-out';

    // Starttransform: Element erscheint an Originalposition in Originalgröße
    const origCx = rect.left + rect.width  / 2;
    const origCy = rect.top  + rect.height / 2;
    const rotIn  = (container.dataset.wikiOrigTransform || '').match(/rotate\(([^)]+)\)/);
    const startAngle = rotIn ? rotIn[1] : '3deg';
    container.style.transform = `translate(${(origCx - vpCx).toFixed(1)}px, ${(origCy - vpCy).toFixed(1)}px) scale(${startScale.toFixed(4)}) rotate(${startAngle})`;

    // Startzustand einfrieren, dann Transition wieder aktivieren
    void container.offsetWidth;
    container.classList.remove('wiki-zoom-setup');

    // Hintergrund-Verdunkelung
    const bd = document.createElement('div');
    bd.id = 'photo-backdrop';
    bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;opacity:0;transition:opacity 0.4s;';
    document.body.appendChild(bd);
    void bd.offsetWidth;
    bd.style.opacity = '1';
    bd.onclick = e => { e.stopPropagation(); toggleWikiPhoto(e, containerId); };

    // Zielzustand: Element in voller Zielgröße, zentriert im Viewport – kein GPU-Upscaling
    void container.offsetWidth;
    container.style.transform = `translate(0px, 0px) scale(1) rotate(2deg)`;
    container.style.boxShadow = '5px 20px 50px rgba(0, 0, 0, 0.8)';
}

function updateDynamicColors() {
    const isNavcom = document.body.classList.contains('theme-navcom');
    const isRetro = document.body.classList.contains('theme-retro') && !isNavcom;

    const primColor = isNavcom ? '#33ff33' : (isRetro ? 'var(--piper-white)' : 'var(--blue)');
    const titleColor = isNavcom ? '#33ff33' : (isRetro ? 'var(--piper-white)' : 'var(--blue)');
    const hlColor = isNavcom ? '#33ff33' : (isRetro ? 'var(--piper-yellow)' : 'var(--green)');

    const mainTitle = document.getElementById('mainTitle');
    if (mainTitle) mainTitle.style.color = isRetro || isNavcom ? '' : titleColor;
    document.querySelectorAll('.theme-color-text').forEach(el => el.style.color = isRetro || isNavcom ? '' : primColor);
    document.querySelectorAll('.theme-green-text').forEach(el => el.style.color = hlColor);
}

function applySavedPanelTheme() {
    const savedPanel = localStorage.getItem('ga_panel_theme') || 'panel-med';
    const panel = document.querySelector('.container');
    if (panel) {
        panel.classList.remove('panel-med', 'panel-creme', 'panel-light', 'panel-dark');
        panel.classList.add(savedPanel);
    }
}

function cyclePanelColor() {
    if (!document.body.classList.contains('theme-retro')) return;
    const panel = document.querySelector('.container');
    const themes = ['panel-med', 'panel-creme', 'panel-light', 'panel-dark'];
    let currentIndex = 0;
    for (let i = 0; i < themes.length; i++) {
        if (panel.classList.contains(themes[i])) {
            currentIndex = i; panel.classList.remove(themes[i]); break;
        }
    }
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    panel.classList.add(nextTheme);
    localStorage.setItem('ga_panel_theme', nextTheme);
}

/* =========================================================
   2. GLOBALE VARIABLEN & INITIALISIERUNG
   ========================================================= */
let map, polyline, markers = [], currentStartICAO, currentDestICAO, currentMissionData = null, selectedAC = "PA-24";
let currentDepFreq = "";
let currentDestFreq = "";
let currentDepElev = null;
let currentDestElev = null;
let globalAirports = null, runwayCache = {}, freqCache = {};
let globalAirportsLoadPromise = null;
const openAipAirportDispatchCache = new Map();
window.drumCache = {};

/* =========================================================
   PWA UPDATE TRIGGER & SOFT AUTO SYNC EVENTS
   ========================================================= */
let isRefreshing = false;
if ('serviceWorker' in navigator && /^https?:$/i.test(window.location.protocol)) {
    // Erzwingt einen automatischen Reload, sobald ein Update (neue sw.js Version) installiert wurde
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) { isRefreshing = true; window.location.reload(); }
    });
}
// SOFT AUTO SYNC: Lädt beim Öffnen, Speichert beim Schließen (oder in den Hintergrund wischen)
window.addEventListener('visibilitychange', () => {
    const t = document.getElementById('syncToggle');
    if (t && t.checked && getSyncId()) {
        if (document.visibilityState === 'hidden') {
            triggerCloudSave(true); // Push in die Cloud (nur wenn sich Daten wirklich geändert haben)
        } else if (document.visibilityState === 'visible') {
            silentSyncLoad(); // Pull aus der Cloud
        }
    }
});
window.addEventListener('pagehide', () => {
    const t = document.getElementById('syncToggle');
    if (t && t.checked && getSyncId()) {
        triggerCloudSave(true); // Letzter Rettungs-Push beim Schließen des Tabs
    }
});
/* ========================================================= */

async function fetchWithTimeout(url, ms = 6000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        return res;
    } catch (e) { clearTimeout(tid); throw e; }
}

let measureMode = false, measurePoints = [], measurePolyline = null, measureMarkers = [], measureTooltip = null;
let routeWaypoints = [], routeMarkers = [], currentSName = "", currentDName = "";
let miniMap, miniRoutePolyline, miniMapMarkers = [];

/* =========================================================
   DRAG-KNOB LOGIK
   ========================================================= */
let navcomAltMode = 'alt'; // 'alt' or 'rate'

function toggleAltRateMode() {
    const label = document.getElementById('altRateToggle');
    const display = document.getElementById('altRadioDisplay');
    if (!label || !display) return;
    if (navcomAltMode === 'alt') {
        navcomAltMode = 'rate';
        label.textContent = 'V/S';
        label.style.color = '#ff8800';
        display.textContent = vpClimbRate;
    } else {
        navcomAltMode = 'alt';
        label.textContent = 'ALT';
        label.style.color = '';
        display.textContent = document.getElementById('altSlider')?.value || '4500';
    }
}

function initDragKnob(knobId, displayId, sliderId, min, max, type) {
    const knob = document.getElementById(knobId);
    const display = document.getElementById(displayId);
    const slider = document.getElementById(sliderId);
    if (!knob || !display || !slider) return;

    let isDragging = false;
    let startY = 0, startX = 0;
    let startVal = 0;
    let currentRotation = 0;

    function onStart(e) {
        window.vpUIInteractionActive = true;
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = e.touches ? e.touches[0].clientX : e.clientX;

        if (type === 'alt' && navcomAltMode === 'rate') {
            startVal = vpClimbRate || 500;
        } else {
            startVal = parseInt(slider.value) || min;
        }
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        // Listener NUR WÄHREND des Drags aktivieren
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
    }

    function onMove(e) {
        if (!isDragging) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        if (type === 'alt' && navcomAltMode === 'rate') {
            let delta = Math.round((startY - clientY) + (clientX - startX));
            delta = Math.round(delta * 3);
            let newVal = startVal + delta;
            newVal = Math.max(200, Math.min(1500, newVal));
            newVal = Math.round(newVal / 50) * 50;
            display.innerText = newVal;
            currentRotation = (delta / 3) * 5;
            knob.style.transform = `rotate(${currentRotation}deg)`;
            handleRateChange(newVal);
            return;
        }

        let delta = Math.round((startY - clientY) + (clientX - startX));
        if (type === 'gph') delta = Math.round(delta * 0.3);
        if (type === 'alt') delta = Math.round(delta * 10);

        let newVal = startVal + delta;
        if (newVal < min) newVal = min;
        if (newVal > max) newVal = max;

        const step = parseInt(slider.step) || 1;
        if (step > 1) newVal = Math.round(newVal / step) * step;

        let displayVal = newVal;
        if (type === 'gph') displayVal = newVal.toString().padStart(2, '0');

        display.innerText = displayVal;
        slider.value = newVal;

        currentRotation = delta * 5;
        knob.style.transform = `rotate(${currentRotation}deg)`;

        handleSliderChange(type, newVal);
        if (gpsState.visible && gpsState.mode === 'FPL') {
            refreshGPSAfterDispatch();
        }
    }

    function onEnd() {
        if (!isDragging) return;
        window.vpUIInteractionActive = false;
        isDragging = false;
        document.body.style.cursor = 'default';
        knob.style.transition = 'transform 0.3s ease';
        knob.style.transform = `rotate(0deg)`;
        setTimeout(() => knob.style.transition = '', 300);

        if (type === 'alt' || (type === 'alt' && typeof navcomAltMode !== 'undefined' && navcomAltMode === 'rate')) {
            if (typeof renderVerticalProfile === 'function') renderVerticalProfile('verticalProfileCanvas');
            if (typeof renderMapProfile === 'function') renderMapProfile();
            if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
        }
        // Listener nach dem Drag wieder entfernen, um Konflikte zu vermeiden
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
    }

    knob.addEventListener('mousedown', onStart);
    knob.addEventListener('touchstart', onStart, { passive: false });
}

window.onload = () => {
    const savedTheme = localStorage.getItem('ga_theme') || 'retro';
    setTheme(savedTheme);
    applySavedPanelTheme();
    setTimeout(() => { loadGlobalAirports(); }, 2000);

    const lastDest = localStorage.getItem('last_icao_dest');
    if (lastDest) document.getElementById('startLoc').value = lastDest;

    const savedKey = localStorage.getItem('ga_gemini_key');
    if (savedKey) document.getElementById('apiKeyInput').value = savedKey;

    const aiEnabled = localStorage.getItem('ga_ai_enabled');
    const aiToggleBtn = document.getElementById('aiToggle');
    if (aiToggleBtn) { aiToggleBtn.checked = (aiEnabled !== 'false'); }

    const savedTargetType = localStorage.getItem('ga_target_type') || document.getElementById('targetType')?.value || 'apt';
    refreshMissionPickerOptions(savedTargetType);
    setMissionTypeSelection(document.getElementById('targetType')?.value || savedTargetType);
    const navTypeSel = document.getElementById('targetTypeRadio');
    if (navTypeSel && !navTypeSel.dataset.expandHandlersBound) {
        navTypeSel.addEventListener('mousedown', () => _setNavcomTypeOptionsExpanded(true));
        navTypeSel.addEventListener('touchstart', () => _setNavcomTypeOptionsExpanded(true), { passive: true });
        navTypeSel.addEventListener('focus', () => _setNavcomTypeOptionsExpanded(true));
        navTypeSel.addEventListener('blur', () => _setNavcomTypeOptionsExpanded(false));
        navTypeSel.addEventListener('change', () => _setNavcomTypeOptionsExpanded(false));
        navTypeSel.dataset.expandHandlersBound = '1';
    }

    renderLog();
    updateApiFuelMeter();

    if (!localStorage.getItem('ga_pinboard_init')) {
        localStorage.setItem('ga_pinboard', JSON.stringify(tutorialNotes));
        localStorage.setItem('ga_pinboard_init', 'true');
    }

    const activeMission = localStorage.getItem('ga_active_mission');
    if (activeMission) {
        setTimeout(() => {
            restoreMissionState(JSON.parse(activeMission));
            // Clear destination input on initial load to allow easy random route generation
            const dInp = document.getElementById('destLoc');
            if (dInp) dInp.value = '';
        }, 300);
    }

    requestAnimationFrame(() => {
        setTimeout(() => { refreshAllDrums(); }, 50);
    });

    syncToNavCom('startLocRadio', document.getElementById('startLoc').value);
    syncToNavCom('targetTypeRadio', document.getElementById('targetType').value);
    syncToNavCom('tasRadioDisplay', document.getElementById('tasSlider').value);
    syncToNavCom('gphRadioDisplay', document.getElementById('gphSlider').value.toString().padStart(2, '0'));
    syncToNavCom('maxSeatsRadio', document.getElementById('maxSeats').value);

    initDragKnob('tasDragKnob', 'tasRadioDisplay', 'tasSlider', 80, 260, 'tas');
    initDragKnob('gphDragKnob', 'gphRadioDisplay', 'gphSlider', 5, 35, 'gph');
    initDragKnob('altDragKnob', 'altRadioDisplay', 'altSlider', 1500, 13500, 'alt');
    syncToNavCom('altRadioDisplay', document.getElementById('altSlider') ? document.getElementById('altSlider').value : '4500');

    if (aiToggleBtn && aiToggleBtn.checked) {
        const btnAI = document.getElementById('btnToggleAI');
        if (btnAI) btnAI.classList.add('active');
    }

    const savedSyncId = localStorage.getItem('ga_sync_id');
    if (savedSyncId) {
        const syncInput = document.getElementById('syncIdInput');
        if(syncInput) syncInput.value = savedSyncId;
    }

    // Sync Toggle Status laden (Standardmäßig auf AUS / false)
    const syncTggl = document.getElementById('syncToggle');
    if (syncTggl) { syncTggl.checked = (localStorage.getItem('ga_sync_enabled') === 'true'); }

    // Lade Gruppen-Settings
    const gName = localStorage.getItem('ga_group_name');
    const gNick = localStorage.getItem('ga_group_nick');
    if (gName && gNick) {
        const inpN = document.getElementById('groupNameInput');
        const inpU = document.getElementById('groupNickInput');
        const stat = document.getElementById('groupStatus');
        if (inpN) inpN.value = gName;
        if (inpU) inpU.value = gNick;
        if (stat) { stat.innerText = "Verbunden als " + gNick; stat.style.color = "var(--green)"; }
    }
};

function saveApiKey() { localStorage.setItem('ga_gemini_key', document.getElementById('apiKeyInput').value.trim()); }
function saveAiToggle() { const t = document.getElementById('aiToggle'); if (t) localStorage.setItem('ga_ai_enabled', t.checked); }

/* =========================================================
   3. PERSISTENZ (SPEICHERN, LADEN & RESET)
   ========================================================= */
let saveMissionTimeout = null;
window.debouncedSaveMissionState = function() {
    if (saveMissionTimeout) clearTimeout(saveMissionTimeout);
    saveMissionTimeout = setTimeout(() => {
        saveMissionState();
    }, 800);
};

function saveMissionState() {
    if (document.getElementById("briefingBox").style.display !== "block") return;

    const imgDepEl = document.getElementById("wikiDepImage");
    const imgDepUrl = (imgDepEl && imgDepEl.style.backgroundImage !== 'url("")') ? imgDepEl.style.backgroundImage : "";
    const imgDestEl = document.getElementById("wikiDestImage");
    const imgDestUrl = (imgDestEl && imgDestEl.style.backgroundImage !== 'url("")') ? imgDestEl.style.backgroundImage : "";

    const state = {
        mTitle: document.getElementById('mTitle').innerHTML,
        mStory: document.getElementById('mStory').innerText,
        mDepICAO: document.getElementById("mDepICAO").innerText,
        mDepName: document.getElementById("mDepName").innerText,
        mDepCoords: document.getElementById("mDepCoords").innerText,
        mDepRwy: '',
        destIcon: document.getElementById("destIcon").innerText,
        mDestICAO: document.getElementById("mDestICAO").innerText,
        mDestName: document.getElementById("mDestName").innerText,
        mDestCoords: document.getElementById("mDestCoords").innerText,
        mDestRwy: '',
        mPay: document.getElementById("mPay").innerText,
        mWeight: document.getElementById("mWeight").innerText,
        mDistNote: document.getElementById("mDistNote").innerText,
        mHeadingNote: document.getElementById("mHeadingNote").innerText,
        mETENote: document.getElementById("mETENote").innerText,
        wikiDepDescText: document.getElementById("wikiDepDescText") ? document.getElementById("wikiDepDescText").innerText : "",
        wikiDestDescText: document.getElementById("wikiDestDescText") ? document.getElementById("wikiDestDescText").innerText : "",
        wikiDepFreqText: document.getElementById("wikiDepFreqText") ? document.getElementById("wikiDepFreqText").innerHTML : "",
        wikiDestFreqText: document.getElementById("wikiDestFreqText") ? document.getElementById("wikiDestFreqText").innerHTML : "",
        wikiDepImageUrl: imgDepUrl,
        wikiDestImageUrl: imgDestUrl,
        isPOI: document.getElementById("destRwyContainer").style.display === "none",
        currentMissionData: currentMissionData,
        routeWaypoints: routeWaypoints,
        missionRouteWaypoints: window._missionRouteWaypoints || null,
        currentStartICAO: currentStartICAO,
        currentDestICAO: currentDestICAO,
        currentSName: currentSName,
        currentDName: currentDName,
        currentDepFreq: currentDepFreq,
        currentDestFreq: currentDestFreq,
        currentDepElev: currentDepElev,
        currentDestElev: currentDestElev,
        freqCache: freqCache,
        vpAltWaypoints: typeof vpAltWaypoints !== 'undefined' ? vpAltWaypoints : [],
        vpSegmentAlts: typeof vpSegmentAlts !== 'undefined' ? vpSegmentAlts : [],
        vpElevationData: typeof vpElevationData !== 'undefined' ? vpElevationData : null,
        activePassenger: window.activePassenger || null
    };
    localStorage.setItem('ga_active_mission', JSON.stringify(state));
    triggerCloudSave();
}

async function restoreMissionState(state) {
    document.getElementById('mTitle').innerHTML = state.mTitle; document.getElementById('mStory').innerText = state.mStory;
    document.getElementById("mDepICAO").innerText = state.mDepICAO; document.getElementById("mDepName").innerText = state.mDepName;
    document.getElementById("mDepCoords").innerText = state.mDepCoords; document.getElementById("mDepRwy").innerText = "Sucht Pisten...";
    const rDepName = document.getElementById('wikiDepNameDisplay');
    if (rDepName) rDepName.innerText = `${state.mDepICAO} – ${state.mDepName}`;
    document.getElementById("destIcon").innerText = state.destIcon; document.getElementById("mDestICAO").innerText = state.mDestICAO;
    document.getElementById("mDestName").innerText = state.mDestName; document.getElementById("mDestCoords").innerText = state.mDestCoords;
    const rDestName = document.getElementById('wikiDestNameDisplay');
    if (rDestName) rDestName.innerText = `${state.mDestICAO} – ${state.mDestName}`;
    document.getElementById("mDestRwy").innerText = state.isPOI ? "" : "Sucht Pisten..."; document.getElementById("mPay").innerText = state.mPay;
    document.getElementById("mWeight").innerText = state.mWeight; document.getElementById("mDistNote").innerText = state.mDistNote;
    document.getElementById("mHeadingNote").innerText = state.mHeadingNote; document.getElementById("mETENote").innerText = state.mETENote;

    if (document.getElementById("wikiDepDescText")) document.getElementById("wikiDepDescText").innerText = state.wikiDepDescText || "";
    if (document.getElementById("wikiDestDescText")) document.getElementById("wikiDestDescText").innerText = state.wikiDestDescText || "";

    if (document.getElementById("wikiDepFreqText")) document.getElementById("wikiDepFreqText").innerHTML = state.wikiDepFreqText || "";
    if (document.getElementById("wikiDestFreqText")) document.getElementById("wikiDestFreqText").innerHTML = state.wikiDestFreqText || "";

    const imgDepContainer = document.getElementById("wikiDepImageContainer");
    const imgDepEl = document.getElementById("wikiDepImage");
    if (state.wikiDepImageUrl && imgDepContainer && imgDepEl) {
        imgDepEl.style.backgroundImage = state.wikiDepImageUrl;
        imgDepContainer.style.display = 'block';
    } else if (imgDepContainer) { imgDepContainer.style.display = 'none'; }

    const imgDestContainer = document.getElementById("wikiDestImageContainer");
    const imgDestEl = document.getElementById("wikiDestImage");
    if (state.wikiDestImageUrl && imgDestContainer && imgDestEl) {
        imgDestEl.style.backgroundImage = state.wikiDestImageUrl;
        imgDestContainer.style.display = 'block';
    } else if (imgDestContainer) { imgDestContainer.style.display = 'none'; }

    document.getElementById("destRwyContainer").style.display = state.isPOI ? "none" : "block";
    if (document.getElementById("wikiDestRwyText")) document.getElementById("wikiDestRwyText").style.display = state.isPOI ? "none" : "block";
    const depLinks = document.getElementById("wikiDepLinks"); if (depLinks) depLinks.style.display = currentStartICAO === 'GPS' ? "none" : "block";
    const destSwitchRow = document.getElementById("destSwitchRow"); if (destSwitchRow) destSwitchRow.style.display = "flex";
    const destLinks = document.getElementById("wikiDestLinks"); if (destLinks) destLinks.style.display = state.isPOI ? "none" : "block";

    currentMissionData = state.currentMissionData; routeWaypoints = state.routeWaypoints;
    window._missionRouteWaypoints = state.missionRouteWaypoints || null;
    window.activePassenger = state.activePassenger || null;
    currentStartICAO = state.currentStartICAO; currentDestICAO = state.currentDestICAO;
    currentSName = state.currentSName; currentDName = state.currentDName;
    currentDepFreq = state.currentDepFreq || ""; currentDestFreq = state.currentDestFreq || "";
    currentDepElev = state.currentDepElev ?? null; currentDestElev = state.currentDestElev ?? null;
    freqCache = state.freqCache || {};
    vpAltWaypoints = state.vpAltWaypoints || [];
    vpSegmentAlts  = state.vpSegmentAlts  || [];
    vpElevationData = state.vpElevationData || null;
    // Routenwechsel-Detektor vorbelegen – verhindert, dass vpAltWaypoints nach dem Restore
    // sofort wieder gelöscht werden (window._lastVpRouteKey ist nach Reload undefined)
    if (state.routeWaypoints && state.routeWaypoints.length > 0) {
        window._lastVpRouteKey = state.routeWaypoints.map(p =>
            `${(p.lat || 0).toFixed(4)},${((p.lng || p.lon) || 0).toFixed(4)}`
        ).join('|');
    }

    // Fallback: Wenn Frequenzen im Briefing fehlen (z.B. alte Pinnwand-Daten), neu laden
    if (!state.wikiDepFreqText && currentStartICAO && currentStartICAO !== 'GPS') {
        fetchAirportFreq(currentStartICAO, 'wikiDepFreqText', 'dep');
    } else if (currentStartICAO === 'GPS' && document.getElementById("wikiDepFreqText")) {
        document.getElementById("wikiDepFreqText").innerHTML = '<span style="color:#888;">Live GPS Start</span>';
    }
    if (!state.wikiDestFreqText && currentDestICAO && !state.isPOI) {
        fetchAirportFreq(currentDestICAO, 'wikiDestFreqText', 'dest');
    }

    const startLocEl = document.getElementById('startLoc');
    const destLocEl = document.getElementById('destLoc');
    const startLocRadioEl = document.getElementById('startLocRadio');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (startLocEl) startLocEl.value = currentStartICAO || '';
    if (destLocEl) destLocEl.value = (currentDestICAO && currentDestICAO !== currentStartICAO) ? currentDestICAO : '';
    if (startLocRadioEl) startLocRadioEl.value = currentStartICAO || '';
    if (destLocRadioEl) destLocRadioEl.value = (currentDestICAO && currentDestICAO !== currentStartICAO) ? currentDestICAO : '';

    document.getElementById("briefingBox").style.display = "block";
    renderMainRoute(); setDrumCounter('distDrum', state.currentMissionData.dist);
    recalculatePerformance(); document.getElementById('searchIndicator').innerText = "📋 Gespeichertes Briefing geladen.";

    gpsState.mode = 'FPL';
    gpsState.subPage = 0;
    gpsState.maxPages = { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 };
    gpsState.wikiCache = {};
    gpsState.metarCache = {};
    runwayCache = {};
    document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));

    setTimeout(() => {
        refreshGPSAfterDispatch();
        vpUpdatePosition(0);
    }, 200);

    if (currentStartICAO && currentStartICAO !== 'GPS') {
        getAirportData(currentStartICAO).then(d => {
            if (d) fetchRunwayDetails(d.lat, d.lon, 'mDepRwy', currentStartICAO);
        });
    } else if (currentStartICAO === 'GPS') {
        document.getElementById("mDepRwy").innerText = "Live-Start";
    }
    if (currentDestICAO && currentDestICAO !== currentStartICAO && !state.isPOI) {
        getAirportData(currentDestICAO).then(d => {
            if (d) fetchRunwayDetails(d.lat, d.lon, 'mDestRwy', currentDestICAO);
        });
    }

    // --- NEU: Restore METAR Widgets ---
    const depP = routeWaypoints && routeWaypoints.length > 0 ? routeWaypoints[0] : null;
    loadMetarWidget(currentStartICAO === 'GPS' ? null : currentStartICAO, 'metarContainerDep', depP?.lat, depP?.lng || depP?.lon);

    const destP = routeWaypoints && routeWaypoints.length > 1 ? routeWaypoints[routeWaypoints.length - 1] : null;
    loadMetarWidget(state.isPOI ? null : currentDestICAO, 'metarContainerDest', destP?.lat, destP?.lng || destP?.lon);

}

function resetApp() {
    if (!confirm("Möchtest du das aktuelle Briefing wirklich verwerfen und alles auf Anfang setzen?")) return;
    _abortDispatchRun('Clear');
    localStorage.removeItem('ga_active_mission'); document.getElementById("briefingBox").style.display = "none";
    currentMissionData = null; routeWaypoints = []; window._missionRouteWaypoints = null;
    if (typeof window.clearPinnedFlightReplay === 'function') window.clearPinnedFlightReplay();
    window._lastReplayRouteKey = '';
    vpAltWaypoints = []; vpSegmentAlts = [];
    vpElevationData = null; window.vpElevationData = null;
    window._lastVpRouteKey = null; window.vpBgNeedsUpdate = true;
    if (map) { routeMarkers.forEach(m => map.removeLayer(m)); if (polyline) { map.removeLayer(polyline); polyline = null; } if (window.hitBoxPolyline) { map.removeLayer(window.hitBoxPolyline); window.hitBoxPolyline = null; } clearAirspaceMapLayers(); if (typeof wxMapMarkers !== 'undefined') { wxMapMarkers.forEach(m => map.removeLayer(m)); wxMapMarkers = []; } }
    if (miniMap) { if (miniRoutePolyline) miniMap.removeLayer(miniRoutePolyline); miniMapMarkers.forEach(m => miniMap.removeLayer(m)); miniMapMarkers = []; }

    const destLocEl = document.getElementById('destLoc');
    const destLocRadioEl = document.getElementById('destLocRadio');
    const p1 = document.getElementById('notePage1'), p2 = document.getElementById('notePage2'), p3 = document.getElementById('notePage3');
    if (p1 && p2 && p3) { p1.className = 'mission-note-page front-note'; p2.className = 'mission-note-page back-note'; p3.className = 'mission-note-page third-note'; }
    if (destLocEl) destLocEl.value = '';
    if (destLocRadioEl) destLocRadioEl.value = '';

    document.getElementById('searchIndicator').innerText = "System bereit."; setDrumCounter('distDrum', 0); recalculatePerformance();
    if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
    const rBtn = document.getElementById('radioGenerateBtn');
    if (rBtn) rBtn.classList.remove('active');

    gpsState.wikiCache = {};
    gpsState.metarCache = {};
    runwayCache = {};
    gpsState.mode = 'FPL';
    gpsState.subPage = 0;
    gpsState.maxPages = { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 };
    document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));
    renderGPS();

    // --- NEU: METAR Widgets resetten ---
    loadMetarWidget(null, 'metarContainerDep');
    loadMetarWidget(null, 'metarContainerDest');

    // Position Marker im Profil zurücksetzen
    vpPositionFraction = 0;
    if (vpPositionLeafletMarker && map) {
        map.removeLayer(vpPositionLeafletMarker);
        vpPositionLeafletMarker = null;
    }

    // Höhenband: Bereitschaftsstand (leeres Profil)
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
/* =========================================================
   4. HELPER-FUNKTIONEN (UI & Mathe)
   ========================================================= */
function setDrumCounter(elementId, valueStr) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const normalizeDisplayValue = () => {
        if (elementId !== 'distDrum') return String(valueStr ?? '0');
        const parsed = Number(String(valueStr ?? '').replace(',', '.'));
        if (!Number.isFinite(parsed)) return '0.0';
        return (Math.round(parsed * 10) / 10).toFixed(1);
    };
    const displayValue = normalizeDisplayValue();
    const renderFallback = () => {
        container.innerHTML = `<span class="theme-color-text" style="font-weight:bold;">${displayValue}</span>`;
        container.dataset.lastVal = displayValue;
    };

    try {
        if (!document.body.classList.contains('theme-retro')) {
            if (container.dataset.lastVal !== displayValue) {
                let span = container.querySelector('span');
                if (!span) {
                    renderFallback();
                    updateDynamicColors(); // Nur einmalig beim Erstellen formatieren!
                } else {
                    span.textContent = displayValue;
                    container.dataset.lastVal = displayValue;
                }
            }
            return;
        }

        let tokenValue = displayValue.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        if (!tokenValue) tokenValue = (elementId === 'distDrum') ? '0.0' : '0';
        const tokens = tokenValue.split('');
        const digitHeight = 22;

        let cache = window.drumCache[elementId];
        
        // Wenn Element nicht im Cache ist oder der Container geleert wurde: Neu aufbauen
        if (!cache || !cache.windowEl || !container.contains(cache.windowEl)) {
            container.innerHTML = '<div class="drum-window"></div>';
            cache = {
                windowEl: container.querySelector('.drum-window'),
                strips: [],
                layoutKey: ''
            };
            window.drumCache[elementId] = cache;
        }

        const layoutKey = tokens.map(ch => (/\d/.test(ch) ? '#' : ch)).join('');
        if (cache.layoutKey !== layoutKey) {
            cache.windowEl.innerHTML = '';
            cache.strips = [];
            tokens.forEach((token) => {
                if (/\d/.test(token)) {
                    const strip = document.createElement('div');
                    strip.className = 'drum-strip';
                    strip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<div class="drum-digit">${d}</div>`).join('');
                    cache.windowEl.appendChild(strip);
                    cache.strips.push(strip);
                    return;
                }
                const sep = document.createElement('div');
                sep.className = 'drum-separator';
                sep.textContent = token;
                cache.windowEl.appendChild(sep);
            });
            cache.layoutKey = layoutKey;
        }

        // Werte (CSS Transform) aktualisieren
        const digits = tokens.filter(token => /\d/.test(token));
        digits.forEach((digit, index) => {
            if (!cache.strips[index]) return;
            const translateY = -(parseInt(digit) * digitHeight);
            const transformStr = `translateY(${translateY}px)`;
            if (cache.strips[index].style.transform !== transformStr) {
                cache.strips[index].style.transform = transformStr;
            }
        });
        container.dataset.lastVal = displayValue;
    } catch (err) {
        console.error('setDrumCounter failed:', err);
        renderFallback();
        if (window.drumCache && window.drumCache[elementId]) delete window.drumCache[elementId];
    }
}
let vpRenderPending = false;
window.throttledRenderProfiles = function() {
    if (vpRenderPending) return;
    vpRenderPending = true;
    requestAnimationFrame(() => {
        const mapTable = document.getElementById('mapTableOverlay');
        const mapTableOpen = !!(mapTable && mapTable.classList.contains('active'));

        // Stabilitaet vor Micro-Optimierung: das Hauptprofil immer frisch halten,
        // auch wenn Drawer-/Overlay-Zustaende kurzzeitig hinterherhaengen.
        if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
        if (mapTableOpen && typeof renderMapProfile === 'function') renderMapProfile();
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

function handleSliderChange(type, val) {
    let drumVal = val;
    if (type === 'gph') {
        drumVal = val.toString().padStart(2, '0');
        syncToNavCom('gphRadioDisplay', drumVal);
    }
    setDrumCounter(type + 'Drum', drumVal);
    if (type !== 'alt') recalculatePerformance();
    syncToNavCom(type + 'Radio', val);
    if (type === 'alt') {
        syncToNavCom('altRadioDisplay', val);
        const mInp = document.getElementById('altMapInput');
        if (mInp && mInp.innerText != val) mInp.innerText = val;

        // Direkter Render-Aufruf! KEIN 3-Sekunden triggerVerticalProfileUpdate() mehr!
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
        // Lufträume nur prüfen, wenn wir nicht gerade aktiv ziehen
        if (!window.vpUIInteractionActive && typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
    }
}

function handleRateChange(val) {
    val = parseInt(val);
    vpClimbRate = val;
    vpDescentRate = val;
    // Sync displays
    setDrumCounter('rateDrum', val);
    const rateMapDisplay = document.getElementById('rateMapDisplay');
    if (rateMapDisplay) rateMapDisplay.textContent = val;
    // Sync sliders
    const rateSlider = document.getElementById('rateSlider');
    const rateMapInp = document.getElementById('rateMapInput');
    if (rateSlider) rateSlider.value = val;
    if (rateMapInp && rateMapInp.innerText != val) rateMapInp.innerText = val;
    // Sync NAVCOM if in rate mode
    if (typeof navcomAltMode !== 'undefined' && navcomAltMode === 'rate') {
        const altRadioDisplay = document.getElementById('altRadioDisplay');
        if (altRadioDisplay) altRadioDisplay.textContent = val;
    }
    // Re-render profiles
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    if (!window.vpUIInteractionActive && typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
}

function recalculatePerformance() {
    if (!currentMissionData) return;
    const tas = parseInt(document.getElementById("tasSlider").value), gph = parseInt(document.getElementById("gphSlider").value), dist = currentMissionData.dist;
    setDrumCounter('timeDrum', Math.round((dist / tas) * 60)); setDrumCounter('fuelDrum', Math.ceil((dist / tas * gph) + (0.75 * gph)));
    if (gpsState.visible && gpsState.mode === 'FPL') renderGPS();
    window.debouncedSaveMissionState();
}

function refreshAllDrums() {
    setDrumCounter('tasDrum', document.getElementById('tasSlider').value);
    setDrumCounter('gphDrum', document.getElementById('gphSlider').value.toString().padStart(2, '0'));
    const altSlider = document.getElementById('altSlider'); if (altSlider) setDrumCounter('altDrum', altSlider.value);
    const rateSlider = document.getElementById('rateSlider'); if (rateSlider) setDrumCounter('rateDrum', rateSlider.value);
    if (currentMissionData) { setDrumCounter('distDrum', currentMissionData.dist); recalculatePerformance(); }
}

function applyPreset(t, g, s, n) {
    document.getElementById('tasSlider').value = t; document.getElementById('gphSlider').value = g;
    document.getElementById('maxSeats').value = s; selectedAC = n;
    handleSliderChange('tas', t); handleSliderChange('gph', g);
    syncToNavCom('tasRadio', t);
    syncToNavCom('gphRadio', g);
    syncToNavCom('maxSeatsRadio', s);
}

function copyCoords(elementId) {
    const txt = document.getElementById(elementId).innerText;
    if (txt && txt !== "-") { navigator.clipboard.writeText(txt).then(() => alert("Koordinaten kopiert:\n" + txt)); }
}

function checkBearing(b, dirPref) {
    if (dirPref === 'any') return true;
    if (dirPref === 'N' && (b <= 45 || b >= 315)) return true;
    if (dirPref === 'E' && (b >= 45 && b <= 135)) return true;
    if (dirPref === 'S' && (b >= 135 && b <= 225)) return true;
    if (dirPref === 'W' && (b >= 225 && b <= 315)) return true;
    return false;
}

function resetBtn(btn) {
    if (btn) { btn.disabled = false; btn.innerText = "Auftrag generieren"; }
    const rBtn = document.getElementById('radioGenerateBtn');
    if (rBtn) {
        rBtn.classList.remove('disabled');
        rBtn.style.pointerEvents = '';
        const label = rBtn.querySelector('.audio-btn-label');
        if (label) label.textContent = "DISPATCH";
    }
}

let _dispatchRunId = 0;
let _dispatchState = { active: false, cancelled: false, runId: 0 };

function _startDispatchRun() {
    _dispatchRunId += 1;
    _dispatchState = { active: true, cancelled: false, runId: _dispatchRunId };
    return _dispatchRunId;
}

function _isDispatchRunAlive(runId) {
    return !!(_dispatchState && _dispatchState.active && !_dispatchState.cancelled && _dispatchState.runId === runId);
}

function _abortDispatchRun(reason = 'Abbruch') {
    if (!_dispatchState.active) return false;
    _dispatchState.cancelled = true;
    _dispatchState.active = false;
    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = `Dispatch abgebrochen (${reason}).`;
    const btn = document.getElementById('generateBtn');
    resetBtn(btn);
    if (window.meterInterval) clearInterval(window.meterInterval);
    const needle = document.getElementById('meterNeedle');
    if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;
    return true;
}

async function loadMetarWidget(icao, containerId, lat, lon, forceModern = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Zwingt das Widget ins "Modern"-Design, auch wenn das Retro-Theme aktiv ist (wichtig für Karten-Popups)
    const isRetro = !forceModern && document.body.classList.contains('theme-retro');
    if (isRetro) {
        container.style.boxShadow = 'none';
        container.style.background = 'transparent';
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-family: \'Caveat\', cursive; font-size:22px; transform: rotate(-1deg);">Sucht lokales Wetter...</div>';
    } else {
        container.style.boxShadow = '';
        container.style.background = '';
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#888; font-size:12px; background:#1a1a1a; border-radius:6px;">Sucht lokales Wetter...</div>';
    }

    if (!icao || icao === 'POI') {
        container.style.display = 'none';
        return;
    }
    const icaoNorm = String(icao || '').trim().toUpperCase();
    const looksLikeIcao = /^[A-Z0-9]{4}$/.test(icaoNorm);
    container.style.display = 'block';

    try {
        let metarDataList = [];
        let isFallback = false;
        let foundIcao = icaoNorm;

        // --- CACHE LOGIK: Bulk-Daten aus dem Profil nutzen oder Theme-Wechsel abfangen ---
        const cacheKey = icaoNorm + (lat ? `_${lat.toFixed(2)}` : '') + (lon ? `_${lon.toFixed(2)}` : '');
        const cachedEntry = gpsState.metarCache[cacheKey] || gpsState.metarCache[icaoNorm];
        if (cachedEntry) {
            metarDataList = cachedEntry.data;
            isFallback = cachedEntry.isFallback;
            foundIcao = cachedEntry.foundIcao;
        } else {

            function parseMetarTextToArray(txt) {
                if (typeof txt !== 'string') return null;
                const t = txt.trim();
                if (!t) return null;
                try {
                    const parsed = JSON.parse(t);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && Array.isArray(parsed.data)) return parsed.data;
                    if (parsed && Array.isArray(parsed.results)) return parsed.results;
                    if (parsed && typeof parsed.contents === 'string') {
                        const nested = JSON.parse(parsed.contents);
                        return Array.isArray(nested) ? nested : null;
                    }
                } catch (_) {}
                return null;
            }

            async function safeFetch(urlObj, retries = 3) {
                const skipDirectMetarFetch = true;
                const proxyUrls = [
                    (u) => `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(u)}`,
                    (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
                ];
                for (let i = 0; i < retries; i++) {
                    if (!skipDirectMetarFetch) {
                        try {
                            const r = await fetch(urlObj);
                            if (r.ok && r.status !== 204) {
                                const t = await r.text();
                                const arr = parseMetarTextToArray(t);
                                if (arr) return arr;
                            }
                        } catch (_) {}
                    }

                    for (const mkProxyUrl of proxyUrls) {
                        try {
                            const pr = await fetch(mkProxyUrl(urlObj));
                            if (!pr.ok || pr.status === 204) continue;
                            const t = await pr.text();
                            const arr = parseMetarTextToArray(t);
                            if (arr) return arr;
                        } catch (_) {}
                    }
                    if (i < retries - 1) await new Promise(res => setTimeout(res, 600));
                }
                return null;
            }

            if (looksLikeIcao) {
                const directUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoNorm}&format=json&t=${Date.now()}`;
                const mainData = await safeFetch(directUrl);
                if (Array.isArray(mainData)) metarDataList = mainData;
            }

            if ((!metarDataList || metarDataList.length === 0) && lat !== undefined && lon !== undefined) {
                const latMin = lat - 0.6, latMax = lat + 0.6;
                const lonMin = lon - 0.8, lonMax = lon + 0.8;
                const fbUrl = `https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`;
                const fbData = await safeFetch(fbUrl);
                if (Array.isArray(fbData)) {
                    try {
                        if (fbData.length > 0) {
                            const candidates = fbData.filter(m =>
                                m &&
                                Number.isFinite(Number(m.lat)) &&
                                Number.isFinite(Number(m.lon))
                            );
                            if (candidates.length > 0) {
                                let closest = candidates[0];
                                let minDist = calcNav(lat, lon, Number(closest.lat), Number(closest.lon)).dist;
                                for (let i = 1; i < candidates.length; i++) {
                                    let d = calcNav(lat, lon, Number(candidates[i].lat), Number(candidates[i].lon)).dist;
                                    if (d < minDist) { minDist = d; closest = candidates[i]; }
                                }
                                metarDataList = [closest];
                                foundIcao = closest.icaoId || icaoNorm;
                                isFallback = true;
                            }
                        }
                    } catch (parseErr) {
                        console.error("Failed to process fallback METAR JSON", parseErr);
                    }
                }
            }

            // Ergebnis in den Cache legen
            gpsState.metarCache[cacheKey] = { data: metarDataList, isFallback, foundIcao };

        } // Ende der Cache-Else-Bedingung

        if (!Array.isArray(metarDataList)) metarDataList = [];
        metarDataList = metarDataList.filter(m => m && typeof m === 'object');

        if (!metarDataList || metarDataList.length === 0) {
            if (isRetro) {
                container.innerHTML = `
                    <div style="padding:15px; text-align:center; font-family: 'Caveat', cursive; transform: rotate(1deg);">
                        <div style="color:#d93829; font-weight:bold; font-size: 22px; margin-bottom:5px;">Kein METAR in der Nähe von ${icao}</div>
                        <div style="font-size:18px; color:#555; margin-bottom:12px;">Kein automatisches Wetter verfügbar.</div>
                        <a href="https://metar-taf.com/de/${icao}" target="_blank" style="display:inline-block; color:#0b1f65; font-size:20px; font-weight:bold; text-decoration:underline;">Manuell suchen ➔</a>
                    </div>`;
            } else {
                container.innerHTML = `
                    <div style="background:#1a1a1a; border-radius:6px; padding:15px; text-align:center; border: 1px solid #333;">
                        <div style="color:#d93829; font-weight:bold; margin-bottom:5px;">Kein METAR in der Nähe von ${icao}</div>
                        <div style="font-size:11px; color:#888; margin-bottom:12px;">Für diesen Bereich steht kein automatisches Wetter zur Verfügung.</div>
                        <a href="https://metar-taf.com/de/${icao}" target="_blank" style="display:inline-block; background:#4da6ff; color:#111; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; transition: background 0.2s;">Manuell suchen ➔</a>
                    </div>`;
            }
            return;
        }

        const metar = metarDataList[0];
        if (!metar || typeof metar !== 'object') {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Kein verwertbares METAR für ${icao} gefunden.</div>`;
            return;
        }
        const raw = typeof metar.rawOb === 'string'
            ? metar.rawOb
            : (typeof metar.raw === 'string' ? metar.raw : "");
        const temp = metar.temp != null ? metar.temp + '°C' : '--';
        const dewp = metar.dewp != null ? metar.dewp + '°C' : '--';
        let catColor = "#fff";
        let catText = metar.fltCat || "N/A";
        if (catText === "VFR") catColor = "#33ff33";
        else if (catText === "MVFR") catColor = "#4da6ff";
        else if (catText === "IFR") catColor = "#ff3333";
        else if (catText === "LIFR") catColor = "#ff33ff";

        let cover = metar.cover || "--";
        if (cover === "Clear") cover = "CLR";

        let visib = metar.visib !== undefined && metar.visib !== null ? metar.visib + ' sm' : '--';
        const visMatch = raw.match(/\s(\d{4})\s/);
        if (raw.includes(' 9999 ')) visib = '> 10 km';
        else if (visMatch && !visMatch[1].startsWith('0000')) visib = parseInt(visMatch[1], 10) + ' m';
        let wx = metar.wxString ? metar.wxString.replace(/,/g, ' ') : 'NIL';

        let qnhStr = "--";
        const qMatch = raw.match ? raw.match(/Q(\d{4})/) : null;
        const aMatch = raw.match ? raw.match(/A(\d{4})/) : null;
        if (qMatch) qnhStr = qMatch[1] + ' hPa';
        else if (aMatch) qnhStr = Math.round((parseInt(aMatch[1]) / 100) * 33.8639) + ' hPa';

        let wdir = metar.wdir, wspd = metar.wspd || 0, wgst = metar.wgst ? `G${metar.wgst}` : '';
        let isVRB = raw.match ? /VRB\d{2,3}KT/.test(raw) : (wdir === "VRB");
        let windText = isVRB ? `VRB / ${wspd}${wgst} kt` : `${wdir}° / ${wspd}${wgst} kt`;
        if (wspd === 0) windText = "Calm (0 kt)";

        const isMini = containerId.startsWith('wxPopup');
        
        // Für Vollansicht: auf Pisten-Daten warten; für Mini-Popup direkt aus Cache lesen
        let retries = 0;
        if (!isMini) {
            while (!runwayCache[foundIcao] && !runwayCache[icao] && retries < 15) {
                await new Promise(r => setTimeout(r, 200));
                retries++;
            }
        }

        let rwyHdg = 0; let rwy1 = ""; let rwy2 = "";
        {
            const rData = runwayCache[foundIcao] || runwayCache[icao];
            if (rData && !rData.includes('Keine Daten')) {
                const match = rData.match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
                if (match) { rwyHdg = parseInt(match[1], 10) * 10; rwy1 = match[1] + match[2]; rwy2 = match[3]; }
            }
        }

        const headerText = isFallback ? `Nearest: ${foundIcao}` : `Station: ${icaoNorm}`;
        const modernHeaderText = isFallback ? `▶ NEAREST: ${foundIcao}` : `▶ STATION: ${icaoNorm}`;

        if (isRetro) {
            let svgTicks = `
                <circle cx="80" cy="80" r="70" stroke="#444" stroke-width="1.5" fill="none" stroke-dasharray="30.65 6" transform="rotate(2.45 80 80)"/>
                <circle cx="80" cy="80" r="3" fill="#444" />`;
            
            // Füge N, O, S, W und 30-Grad-Schritte rotierend hinzu
            for (let i = 0; i < 360; i += 30) {
                const angleRad = (i - 90) * Math.PI / 180;
                const radius = 61;
                const tx = 80 + radius * Math.cos(angleRad);
                const ty = 80 + radius * Math.sin(angleRad);
                
                // dx="-2" gleicht den kursiven Schwung (Slant) von Caveat aus, der sonst wie eine Rechtsrotation wirkt
                if (i % 90 === 0) {
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-2" font-family="'Caveat', cursive" font-size="22" fill="#222" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                } else {
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-1.5" font-family="'Caveat', cursive" font-size="14" fill="#666" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                }
            }
            
            let rwyHtml = '';
            if (rwy1 && rwy2) {
                // Piste wurde oben und unten gekürzt (y="29", height="102") um Abstand zu den Zahlen zu gewinnen
                rwyHtml = `
                    <g transform="translate(80,80) rotate(${rwyHdg}) translate(-80,-80)">
                        <rect x="68" y="29" width="24" height="102" fill="none" stroke="#222" stroke-width="1.5" stroke-dasharray="30 4 15 4"/>
                        <text x="80" y="43" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" transform="rotate(180 80 39)">${rwy1}</text>
                        <text x="80" y="125" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle">${rwy2}</text>
                    </g>`;
            }

            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <g transform="rotate(${wdir} 80 80)">
                    <path d="M 80 10 C 77 30, 83 50, 80 65" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <path d="M 74 54 L 80 68 L 86 52" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </g>`;
            }

            container.innerHTML = `
                <div style="font-family: 'Caveat', cursive; color: #222; padding: 5px; position:relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(0,0,0,0.5); padding-bottom: 2px; margin-bottom: 12px;">
                        <span style="font-size: 24px; font-weight: bold; color: #0b1f65; transform: rotate(-1deg); display: inline-block;">${headerText}</span>
                        <span style="font-size: 18px; font-weight: bold; color: ${catColor}; border: 2px solid ${catColor}; padding: 0 6px; border-radius: 3px; transform: rotate(2deg); display: inline-block; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    <div style="font-size: 17px; line-height: 1.25; margin-bottom: 15px; color: #333; padding-left: 12px; border-left: 2px solid rgba(0,0,0,0.2); transform: rotate(0.5deg);">
                        ${raw}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="font-size: 20px; line-height: 1.3; display: flex; flex-direction: column; gap: 2px;">
                            <div><span style="color:#666; font-size: 16px;">Wind:</span> <b style="color:#1a73e8; font-size:22px;">${windText}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Vis:</span> <b>${visib}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Wx:</span> <b>${wx}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Temp:</span> <b>${temp}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Dew:</span> <b>${dewp}</b></div>
                            <div><span style="color:#666; font-size: 16px;">QNH:</span> <b>${qnhStr}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Cloud:</span> <b>${cover}</b></div>
                        </div>
                        <div style="position:relative; width: 130px; height: 130px; flex-shrink: 0;">
                            <svg viewBox="0 0 160 160" style="width:100%; height:100%; overflow:visible;">
                                ${svgTicks}${rwyHtml}${arrowHtml}
                            </svg>
                        </div>
                    </div>
                </div>`;
        } else {
            let svgTicks = '';
            for (let i = 0; i < 360; i += 5) {
                const isCard = i % 90 === 0, isLong = i % 10 === 0;
                const len = isCard ? 8 : (isLong ? 5 : 3), sw = isCard ? 2 : 1, col = isCard ? '#111' : '#888';
                svgTicks += `<line x1="80" y1="2" x2="80" y2="${2 + len}" stroke="${col}" stroke-width="${sw}" transform="rotate(${i} 80 80)" />`;
                if (i % 30 === 0 && !isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="10" fill="#333" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                } else if (isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                }
            }
            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; pointer-events:none;">
                    <g transform="rotate(${wdir} 80 80)">
                        <line x1="80" y1="6" x2="80" y2="70" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"/>
                        <polygon points="72,55 80,80 88,55" fill="#1a73e8" />
                    </g>
                </svg>`;
            }

            let rwyHtmlModern = '';
            if (rwy1 && rwy2) {
                const rwyW = isMini ? '15px' : '26px';
                const rwyH = isMini ? '60px' : '105px';
                const rwyFSize = isMini ? '8px' : '10px';
                rwyHtmlModern = `
                <div style="position:absolute; top:50%; left:50%; width:${rwyW}; height:${rwyH}; background:#444; border:1px solid #111; border-radius: 3px; transform: translate(-50%, -50%) rotate(${rwyHdg}deg); transform-origin: center center; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding: 3px 0; box-sizing: border-box; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; transform: rotate(180deg); font-family: sans-serif;">${rwy1}</div>
                    <div style="width:2px; flex-grow:1; margin: 3px 0; background: repeating-linear-gradient(to bottom, #d4d4d4 0, #d4d4d4 6px, transparent 6px, transparent 12px);"></div>
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; font-family: sans-serif;">${rwy2}</div>
                </div>`;
            }

            let cSize = isMini ? 90 : 160;
            let gap = isMini ? 4 : 8;
            let fVal = isMini ? 12 : 15;
            let fLbl = isMini ? 9 : 10;
            let pPad = isMini ? '10px' : '15px 15px 20px 15px';
            const rawTextSafe = raw && raw.trim() ? raw : 'RAW nicht verfügbar';
            const miniDecoded = `${visib} · ${wx} · ${temp} / ${dewp} · ${cover}`;

            container.innerHTML = `
                <div style="${isMini ? 'background:none; border:none; box-shadow:none; padding:4px 0;' : `background:#f0eada; border-radius:12px; padding:${pPad}; border: 3px solid #c2bba8; box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.5);`} font-family: 'Arial', sans-serif; color: #333; position:relative; overflow:hidden;">

                    ${!isMini ? `
                    <div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    ` : ''}

                    <div style="color: #8a1a12; font-size: 14px; font-weight: bold; margin-bottom: ${isMini?6:12}px; ${isMini ? '' : 'border-bottom: 2px dashed #c2bba8;'} padding-bottom: ${isMini?0:8}px; font-family: 'Courier New', Courier, monospace; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px;">
                        <span>${modernHeaderText}</span>
                        <span style="color:${catColor}; font-size:14px; padding: 2px 8px; border: 2px solid ${catColor}; border-radius: 4px; background: rgba(255,255,255,0.7); box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    ${!isMini ? `<div style="background:#e6e0ce; color:#333; font-family: 'Courier New', Courier, monospace; padding:10px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border: 1px inset #c2bba8; line-height: 1.4; letter-spacing: 0.5px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">${rawTextSafe}</div>` : ''}
                    ${isMini ? `<div style="background:#ece6d6; color:#2f2f2f; font-family:'Courier New', Courier, monospace; padding:6px 8px; border-radius:4px; font-size:10px; margin-bottom:8px; border:1px solid #c8c0ac; line-height:1.35; word-break:break-word;">${rawTextSafe}<br><span style="color:#555;">${miniDecoded}</span></div>` : ''}
                    <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="display:flex; flex-direction:column; gap:${gap}px; font-family: 'Courier New', Courier, monospace; flex-shrink: 1; min-width: 0;">
                            <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WIND</div><div style="color:#1a73e8; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${windText}</div></div>
                            ${!isMini ? `
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">VIS</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${visib}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WX</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${wx}</div></div>
                            </div>
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">TEMP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${temp}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">DEWP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${dewp}</div></div>
                            </div>` : ''}
                            <div style="display:flex; gap:12px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">QNH</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${qnhStr}</div></div>
                                ${!isMini ? `<div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">COVER</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${cover}</div></div>` : ''}
                            </div>
                        </div>
                        <div style="position:relative; width:${cSize}px; height:${cSize}px; flex-shrink: 0; ${isMini ? 'margin-left: auto;' : ''} border:4px solid #a8a291; border-radius:50%; background:#fcfaf5; box-shadow: inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2);">
                            <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                ${svgTicks}
                            </svg>
                            ${rwyHtmlModern}
                            ${arrowHtml}
                        </div>
                    </div>
                </div>`;
        }
    } catch (err) {
        console.error("METAR fetch error:", err);
        const isRetro = document.body.classList.contains('theme-retro');
        if (isRetro) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-family: 'Caveat', cursive; font-size:20px; transform: rotate(-1deg);">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        } else {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        }
    }
}
function calcNav(lat1, lon1, lat2, lon2) {
    const R = 3440, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return { dist, brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) };
}

function getDestinationPoint(lat, lon, distNM, bearing) {
    const R = 3440.065, lat1 = lat * Math.PI / 180, lon1 = lon * Math.PI / 180, brng = bearing * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNM / R) + Math.cos(lat1) * Math.sin(distNM / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNM / R) * Math.cos(lat1), Math.cos(distNM / R) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function pickRandomTrainingPoiNearAirport(startLat, startLon, dirPref, minNm = 4, maxNm = 18) {
    const safeMin = Math.max(2, Number(minNm) || 4);
    const safeMax = Math.max(safeMin + 1, Number(maxNm) || 18);
    for (let i = 0; i < 24; i++) {
        const dist = safeMin + Math.random() * (safeMax - safeMin);
        const brg = Math.random() * 360;
        if (!checkBearing(brg, dirPref)) continue;
        const p = getDestinationPoint(startLat, startLon, dist, brg);
        return { n: 'Übungsgebiet', lat: p.lat, lon: p.lon, icao: 'POI', poiCategory: 'trn' };
    }
    const fallback = getDestinationPoint(startLat, startLon, Math.max(5, safeMin), 45);
    return { n: 'Übungsgebiet', lat: fallback.lat, lon: fallback.lon, icao: 'POI', poiCategory: 'trn' };
}

/* =========================================================
   5. DATEN-FETCHING (APIs & GEMINI KI)
   ========================================================= */
async function loadGlobalAirports() {
    if (globalAirports && Object.keys(globalAirports).length > 0) return;
    if (globalAirportsLoadPromise) {
        await globalAirportsLoadPromise;
        return;
    }

    const isValidAirportMap = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return false;
        const keys = Object.keys(parsed);
        if (keys.length < 1000) return false;
        // Mindest-Sanitycheck für das bekannte Schema.
        const sample = parsed.EDDM || parsed.EDDF || parsed.EDNY || parsed.LOWW;
        return !!(sample && typeof sample.lat === 'number' && typeof sample.lon === 'number');
    };

    const tryParseResponse = async (res) => {
        if (!res || !res.ok) return null;
        try {
            const parsed = await res.json();
            return isValidAirportMap(parsed) ? parsed : null;
        } catch (_) {
            return null;
        }
    };

    globalAirportsLoadPromise = (async () => {
        // Safari/Browser blocken fetch() auf lokale Dateien unter file://.
        // Dann direkt auf Online-Fallbacks gehen und keine Console-Error-Flut erzeugen.
        if (window.location && window.location.protocol === 'file:') {
            globalAirports = null;
            return;
        }

        const urls = [
            './airports.json',
            'airports.json',
            '/airports.json',
            `./airports.json?t=${Date.now()}`
        ];

        // 1) Erst SW/Browser-Cache direkt prüfen (robust bei Netzproblemen).
        if (typeof caches !== 'undefined' && caches && typeof caches.match === 'function') {
            for (const url of urls) {
                try {
                    const cached = await caches.match(url, { ignoreSearch: true });
                    const parsed = await tryParseResponse(cached);
                    if (parsed) {
                        globalAirports = parsed;
                        return;
                    }
                } catch (_) { }
            }
        }

        // 2) Normale Fetches (cache darf genutzt werden).
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'default' });
                const parsed = await tryParseResponse(res);
                if (parsed) {
                    globalAirports = parsed;
                    return;
                }
            } catch (_) { }
        }

        // 3) Letzter Versuch hart neu laden.
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'reload' });
                const parsed = await tryParseResponse(res);
                if (parsed) {
                    globalAirports = parsed;
                    return;
                }
            } catch (_) { }
        }

        // WICHTIG: Kein dauerhaftes "{}", sonst bleibt APT-Dispatch den ganzen
        // Session-Lauf defekt. Bei Fehler auf null lassen, damit spätere Retries
        // weiter möglich bleiben.
        globalAirports = null;
    })().finally(() => {
        globalAirportsLoadPromise = null;
    });

    await globalAirportsLoadPromise;
}

function getOpenAipDispatchBBox(lat, lon, maxNM) {
    const radiusNm = Math.max(90, Math.min(420, (Number(maxNM) || 120) * 1.25));
    const dLat = radiusNm / 60;
    const cosLat = Math.max(0.2, Math.abs(Math.cos((lat * Math.PI) / 180)));
    const dLon = radiusNm / (60 * cosLat);
    return {
        west: Math.max(-180, lon - dLon),
        south: Math.max(-90, lat - dLat),
        east: Math.min(180, lon + dLon),
        north: Math.min(90, lat + dLat)
    };
}

async function fetchOpenAipDispatchAirports(lat, lon, maxNM, regionPref = 'any') {
    const key = [
        Math.round(lat * 10) / 10,
        Math.round(lon * 10) / 10,
        Math.round((Number(maxNM) || 120) / 10) * 10,
        regionPref || 'any'
    ].join('|');
    const now = Date.now();
    const cached = openAipAirportDispatchCache.get(key);
    if (cached && (now - cached.ts) < 15 * 60 * 1000) {
        return cached.items;
    }

    const { west, south, east, north } = getOpenAipDispatchBBox(lat, lon, maxNM);
    const bbox = `${west},${south},${east},${north}`;
    const proxy = 'https://ga-proxy.einherjer.workers.dev';

    try {
        const res = await fetch(`${proxy}/api/airports?bbox=${bbox}&limit=1000&t=${now}`);
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const parsed = [];
        for (const item of items) {
            const coords = item?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const lonV = Number(coords[0]);
            const latV = Number(coords[1]);
            if (!Number.isFinite(latV) || !Number.isFinite(lonV)) continue;
            const icao = String(item?.icaoCode || item?.designator || '').trim().toUpperCase();
            if (!icao) continue;
            const isDE = icao.startsWith('ED') || icao.startsWith('ET');
            if (regionPref === 'de' && !isDE) continue;
            if (regionPref === 'int' && isDE) continue;
            parsed.push({
                icao,
                name: String(item?.name || icao),
                lat: latV,
                lon: lonV
            });
        }
        openAipAirportDispatchCache.set(key, { ts: now, items: parsed });
        return parsed;
    } catch (_) {
        return [];
    }
}

async function getAirportData(icao) {
    await loadGlobalAirports();
    if (globalAirports && globalAirports[icao]) {
        return {
            icao: icao,
            n: globalAirports[icao].name || globalAirports[icao].city,
            lat: globalAirports[icao].lat,
            lon: globalAirports[icao].lon
        };
    }
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${icao}+airport`); const data = await res.json();
        if (data && data.length > 0) return { icao: icao, n: data[0].display_name.split(',')[0], lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch (e) { }
    return null;
}

async function findGithubAirport(lat, lon, minNM, maxNM, dirPref, regionPref) {
    await loadGlobalAirports();
    if (!globalAirports || Object.keys(globalAirports).length === 0) {
        const fallbackAirports = await fetchOpenAipDispatchAirports(lat, lon, maxNM, regionPref);
        const validFromFallback = [];
        for (const apt of fallbackAirports) {
            if (apt.icao === currentStartICAO) continue;
            const navCalc = calcNav(lat, lon, apt.lat, apt.lon);
            if (navCalc.dist >= minNM && navCalc.dist <= maxNM && checkBearing(navCalc.brng, dirPref)) {
                validFromFallback.push({ icao: apt.icao, n: apt.name, lat: apt.lat, lon: apt.lon });
            }
        }
        if (validFromFallback.length > 0) {
            return validFromFallback[Math.floor(Math.random() * validFromFallback.length)];
        }
        // Einmal harter Retry lokal, falls sich der Modus/Host geändert hat.
        await loadGlobalAirports();
    }
    if (!globalAirports || Object.keys(globalAirports).length === 0) return null;

    let validAirports = [];
    for (const key in globalAirports) {
        const apt = globalAirports[key]; if (apt.icao === currentStartICAO) continue;
        const isDE = apt.icao.startsWith('ED') || apt.icao.startsWith('ET');
        if (regionPref === "de" && !isDE) continue; if (regionPref === "int" && isDE) continue;
        const navCalc = calcNav(lat, lon, apt.lat, apt.lon);
        if (navCalc.dist >= minNM && navCalc.dist <= maxNM && checkBearing(navCalc.brng, dirPref)) { validAirports.push({ icao: apt.icao, n: apt.name || apt.city || "Unbekannt", lat: apt.lat, lon: apt.lon }); }
    }
    if (validAirports.length > 0) return validAirports[Math.floor(Math.random() * validAirports.length)];
    return null;
}

function normalizeMissionText(txt) {
    return (txt || "")
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss');
}

function _hasWordToken(text, token) {
    const t = String(text || '');
    const w = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t);
}

function classifyPOITitleCategory(title) {
    const t = normalizeMissionText(title);
    if (t.includes("bruecke") || t.includes("brucke") || t.includes("bridge") || t.includes("viadukt") || t.includes("aquadukt") || t.includes("steg") || t.includes("pont") || t.includes("puente")) return "bridge";
    if (t.includes("autobahn") || t.includes("kreuz") || t.includes("dreieck") || t.includes("kreuzung") || t.includes("strasse") || t.includes("highway") || t.includes("motorway") || t.includes("interstate") || t.includes("freeway") || t.includes("ring") || t.includes("junction") || t.includes("interchange") || t.includes("tunnel")) return "road";
    if (
        _hasWordToken(t, "staudamm") ||
        _hasWordToken(t, "talsperre") ||
        _hasWordToken(t, "stausee") ||
        _hasWordToken(t, "sperrmauer") ||
        _hasWordToken(t, "reservoir") ||
        _hasWordToken(t, "damm") ||
        _hasWordToken(t, "dam") ||
        _hasWordToken(t, "wehr")
    ) return "dam";
    if (t.includes("funkturm") || t.includes("fernsehturm") || t.includes("sendemast") || t.includes("funkmast") || t.includes("mast")) return "telecom";
    if (t.includes("industrie") || t.includes("werk") || t.includes("fabrik") || t.includes("kraftwerk") || t.includes("anlage") || t.includes("mine") || t.includes("tagebau")) return "industry";
    if (t.includes("burg") || t.includes("schloss") || t.includes("ruine") || t.includes("festung") || t.includes("kloster") || t.includes("dom") || t.includes("monument") || t.includes("denkmal")) return "castle";
    if (t.includes("fluss") || t.includes("strom") || t.includes("kanal") || t.includes("see") || t.includes("talsperre") || t.includes("teich") || t.includes("insel") || t.includes("weiher") || t.includes("kueste") || t.includes("hafen") || t.includes("river") || t.includes("lake") || t.includes("bay") || t.includes("fjord") || t.includes("meer") || t.includes("rhein") || t.includes("donau") || t.includes("elbe") || t.includes("isar") || t.includes("neckar")) return "water";
    if (t.includes("berg") || t.includes("spitze") || t.includes("horn") || t.includes("gipfel") || t.includes("kogel") || t.includes("wald") || t.includes("tal") || t.includes("schlucht") || t.includes("alpen") || t.includes("pass")) return "mountain";
    if (t.includes("stadt") || t.includes("turm") || t.includes("park") || t.includes("stadion") || t.includes("arena") || t.includes("zentrum") || t.includes("city")) return "city";
    return "generic";
}

function pickBalancedByCategory(items, categoryOf, storagePrefix) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const countsKey = `${storagePrefix}_counts`;
    const lastKey = `${storagePrefix}_last`;
    const counts = JSON.parse(localStorage.getItem(countsKey) || '{}');
    const lastCat = localStorage.getItem(lastKey) || '';

    const categories = [...new Set(items.map(categoryOf))];
    const minCount = Math.min(...categories.map(cat => parseInt(counts[cat] || 0, 10)));
    let candidateCats = categories.filter(cat => parseInt(counts[cat] || 0, 10) === minCount);
    if (candidateCats.length > 1 && candidateCats.includes(lastCat)) {
        candidateCats = candidateCats.filter(cat => cat !== lastCat);
    }
    const selectedCat = candidateCats[Math.floor(Math.random() * candidateCats.length)] || categories[0];
    const pool = items.filter(item => categoryOf(item) === selectedCat);
    const picked = pool[Math.floor(Math.random() * pool.length)] || items[0];

    counts[selectedCat] = parseInt(counts[selectedCat] || 0, 10) + 1;
    localStorage.setItem(countsKey, JSON.stringify(counts));
    localStorage.setItem(lastKey, selectedCat);
    return { item: picked, category: selectedCat };
}

function _nmToLatDeg(nm) {
    return Number(nm || 0) / 60;
}

function _nmToLonDeg(nm, latDeg) {
    const c = Math.max(0.2, Math.cos((Number(latDeg || 0) * Math.PI) / 180));
    return Number(nm || 0) / (60 * c);
}

function _buildViewBoxAround(lat, lon, radiusNm) {
    const dLat = _nmToLatDeg(radiusNm);
    const dLon = _nmToLonDeg(radiusNm, lat);
    return {
        west: Number(lon) - dLon,
        east: Number(lon) + dLon,
        south: Number(lat) - dLat,
        north: Number(lat) + dLat
    };
}

function _isDamLikeNominatimItem(item) {
    if (!item) return false;
    const hay = normalizeMissionText([
        item.name,
        item.display_name,
        item.class,
        item.category,
        item.type,
        item.addresstype
    ].filter(Boolean).join(' '));
    if (
        _hasWordToken(hay, 'staudamm') ||
        _hasWordToken(hay, 'talsperre') ||
        _hasWordToken(hay, 'stausee') ||
        _hasWordToken(hay, 'sperrmauer') ||
        _hasWordToken(hay, 'reservoir') ||
        _hasWordToken(hay, 'damm') ||
        _hasWordToken(hay, 'dam') ||
        _hasWordToken(hay, 'wehr')
    ) return true;
    const cls = String(item.class || item.category || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    return (
        (cls === 'waterway' && (type === 'dam' || type === 'weir')) ||
        (cls === 'landuse' && type === 'reservoir') ||
        (cls === 'water' && (type === 'dam' || type === 'reservoir'))
    );
}

async function findNominatimDamPOI(lat, lon) {
    const vb = _buildViewBoxAround(lat, lon, 18);
    const queries = ['staudamm', 'talsperre', 'stausee', 'reservoir', 'dam', 'wehr'];
    const seen = new Set();
    const candidates = [];

    for (const q of queries) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&bounded=1&q=${encodeURIComponent(q)}&viewbox=${encodeURIComponent(`${vb.west},${vb.north},${vb.east},${vb.south}`)}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const list = await res.json();
            if (!Array.isArray(list)) continue;
            for (const it of list) {
                const key = `${it.osm_type || '?'}:${it.osm_id || '?'}:${it.lat || '?'}:${it.lon || '?'}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (!_isDamLikeNominatimItem(it)) continue;
                const ilat = Number(it.lat);
                const ilon = Number(it.lon);
                if (!Number.isFinite(ilat) || !Number.isFinite(ilon)) continue;
                const dNm = calcNav(lat, lon, ilat, ilon).dist;
                if (!Number.isFinite(dNm) || dNm > 18.5) continue;
                const name = String(it.name || it.display_name || '').split(',')[0].trim();
                candidates.push({
                    n: name || 'Staudamm/Talsperre',
                    lat: ilat,
                    lon: ilon,
                    dNm,
                    importance: Number(it.importance || 0)
                });
            }
        } catch (_) {}
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.dNm - b.dNm) || (b.importance - a.importance));
    const pick = candidates[0];
    return { icao: 'POI', n: pick.n, lat: pick.lat, lon: pick.lon, poiCategory: 'dam' };
}

async function findWikipediaPOI(lat, lon, minNM, maxNM, dirPref, forcedCategory = null) {
    const scoredKeywords = [
        "bruecke", "brucke", "bridge", "viadukt", "autobahn", "autobahnkreuz", "kreuz", "kreuzung", "dreieck", "strasse", "tunnel", "highway", "motorway", "interstate", "freeway", "interchange",
        "staudamm", "talsperre", "stausee", "sperrmauer", "reservoir", "dam", "wehr",
        "funkturm", "fernsehturm", "sendemast", "funkmast",
        "fluss", "river", "strom", "kanal", "see", "lake", "hafen", "bay", "fjord", "insel", "kueste",
        "burg", "schloss", "dom", "denkmal", "monument", "festung", "kloster",
        "berg", "gipfel", "tal", "schlucht", "wald", "spitze",
        "stadt", "city", "turm", "arena", "stadion", "zentrum"
    ];
    const weakKeywords = ["liste", "begriffsklarung", "jahr", "person", "verwaltungsgemeinschaft", "gemeinde"];
    const scorePOITitle = (title) => {
        const t = normalizeMissionText(title);
        let score = 0;
        for (const kw of scoredKeywords) {
            if (t.includes(kw)) score += 1;
        }
        for (const kw of weakKeywords) {
            if (t.includes(kw)) score -= 1;
        }
        return score;
    };

    const forceCat = String(forcedCategory || '').trim().toLowerCase();
    const dist = Math.floor(Math.random() * (maxNM - minNM + 1)) + minNM;
    let minB = 0, maxB = 360;
    if (dirPref === 'N') { minB = 315; maxB = 405; } else if (dirPref === 'E') { minB = 45; maxB = 135; } else if (dirPref === 'S') { minB = 135; maxB = 225; } else if (dirPref === 'W') { minB = 225; maxB = 315; }
    let bearing = Math.floor(Math.random() * (maxB - minB + 1)) + minB; bearing = bearing % 360;
    const target = getDestinationPoint(lat, lon, dist, bearing);
    if (forceCat === 'dam') {
        const damPoi = await findNominatimDamPOI(target.lat, target.lon);
        if (damPoi) return damPoi;
    }
    const url = `https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${target.lat}|${target.lon}&gsradius=10000&gslimit=30&format=json&origin=*`;
    try {
        const res = await fetch(url); const data = await res.json();
        if (data.query && data.query.geosearch && data.query.geosearch.length > 0) {
            const geosearch = data.query.geosearch;
            let poiPool = geosearch;
            if (forceCat && forceCat !== 'all') {
                const forcedPool = geosearch.filter(p => classifyPOITitleCategory(p.title) === forceCat);
                if (forcedPool.length > 0) poiPool = forcedPool;
            }
            let bestScore = -999;
            for (const p of poiPool) {
                const s = scorePOITitle(p.title);
                if (s > bestScore) bestScore = s;
            }
            if (bestScore > 0) {
                poiPool = poiPool.filter(p => scorePOITitle(p.title) === bestScore);
            }
            const balancedPoi = pickBalancedByCategory(poiPool, p => classifyPOITitleCategory(p.title), 'ga_poi_cat');
            const poi = balancedPoi ? balancedPoi.item : poiPool[Math.floor(Math.random() * poiPool.length)];
            return {
                icao: "POI",
                n: poi.title,
                lat: poi.lat,
                lon: poi.lon,
                poiCategory: balancedPoi ? balancedPoi.category : classifyPOITitleCategory(poi.title)
            };
        }
    } catch (e) { }
    return null;
}

async function fetchAreaDescription(lat, lon, elementId, exactTitle = null, icaoCode = null, imgContainerId = 'wikiDestImageContainer', imgElId = 'wikiDestImage') {
    const imgContainer = document.getElementById(imgContainerId);
    const imgElement = document.getElementById(imgElId);
    const textElement = document.getElementById(elementId);
    if (imgContainer) imgContainer.style.display = 'none';
    if (!textElement) return;

    try {
        let titleToFetch = exactTitle;
        if (!titleToFetch && icaoCode) titleToFetch = await getWikiTitleForAirport(icaoCode, lat, lon);

        if (!titleToFetch) {
            const geoRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=1&format=json&origin=*`);
            const geoData = await geoRes.json();
            if (geoData?.query?.geosearch?.length > 0) titleToFetch = geoData.query.geosearch[0].title;
            else { textElement.innerText = "Keine regionalen Wikipedia-Daten gefunden."; return; }
        }

        if (titleToFetch) {
            const extRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=true&explaintext=true&exsentences=4&pithumbsize=1200&titles=${encodeURIComponent(titleToFetch)}&format=json&origin=*`);
            const extData = await extRes.json();

            if (extData?.query?.pages) {
                const pageId = Object.keys(extData.query.pages)[0];
                if (pageId !== "-1" && extData.query.pages[pageId].extract) {
                    let prefix = exactTitle ? "" : `Region (${titleToFetch}):\n\n`;
                    textElement.innerText = prefix + extData.query.pages[pageId].extract;

                    const imgUrl = extData.query.pages[pageId].thumbnail?.source;
                    if (imgUrl && imgContainer && imgElement) {
                        imgElement.style.backgroundImage = `url('${imgUrl}')`;
                        imgContainer.style.display = 'block';
                    }
                    return;
                }
            }
        }
        textElement.innerText = "Der Artikel konnte nicht von Wikipedia abgerufen werden.";
    } catch (e) { textElement.innerText = "Wiki-Daten konnten nicht geladen werden."; }
}

async function fetchRunwayDetails(lat, lon, elementId, icaoCode) {
    const domEl = document.getElementById(elementId);
    if (!domEl) return;
    const hColor = document.body.classList.contains('theme-retro') ? 'var(--piper-yellow)' : 'var(--warn)';

    // Check Cache first
    if (icaoCode && runwayCache[icaoCode]) {
        domEl.innerHTML = runwayCache[icaoCode].replace(/\n/g, '<br>');
        domEl.style.color = hColor;
        if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        return;
    }

    const wikiResult = await fetchRunwayFromWikipedia(icaoCode, lat, lon);
    if (wikiResult) {
        if (icaoCode) runwayCache[icaoCode] = wikiResult;
        domEl.innerHTML = wikiResult.replace(/\n/g, '<br>');
        domEl.style.color = hColor;
        if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
        return;
    }

    try {
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:5];way["aeroway"="runway"](around:2000,${lat},${lon});out tags;`)}`);
        const data = await res.json();
        if (data?.elements?.length > 0) {
            const trans = {
                "asphalt": "Asphalt", "concrete": "Beton", "grass": "Gras",
                "paved": "Asphalt", "unpaved": "Unbefestigt", "dirt": "Erde", "gravel": "Schotter"
            };
            const seen = new Set();
            const parts = [];
            for (const el of data.elements) {
                if (!el.tags?.ref) continue;
                const key = el.tags.ref;
                if (seen.has(key)) continue;
                seen.add(key);
                const surf = el.tags.surface ? (trans[el.tags.surface.toLowerCase()] || el.tags.surface) : '?';
                const len = el.tags.length ? ` · ${Math.round(el.tags.length)}m` : '';
                parts.push(`${key} – ${surf}${len}`);
            }
            if (parts.length > 0) {
                const rwyString = parts.join('\n');
                if (icaoCode) runwayCache[icaoCode] = rwyString;
                domEl.innerHTML = rwyString.replace(/\n/g, '<br>');
                domEl.style.color = hColor;
                if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
                if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerHTML = 'Pisten:<br>' + domEl.innerHTML;
                return;
            }
        }
    } catch (e) { }

    const notFoundStr = "Keine Daten gefunden";
    domEl.innerText = notFoundStr;
    domEl.style.color = "#888";
    if (icaoCode) runwayCache[icaoCode] = notFoundStr;
    if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) document.getElementById('wikiDepRwyText').innerText = 'Pisten: ' + notFoundStr;
    if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').innerText = 'Pisten: ' + notFoundStr;
}

const wikiTitleCache = {};

async function getWikiTitleForAirport(icao, lat, lon) {
    if (wikiTitleCache[icao]) return wikiTitleCache[icao];

    try {
        const wdRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P239=${icao}&format=json&origin=*`, 4000);
        const wdData = await wdRes.json();
        if (wdData?.query?.search?.length > 0) {
            wikiTitleCache[icao] = wdData.query.search[0].title;
            return wdData.query.search[0].title;
        }

        const isAirport = (t) => ['flugplatz', 'flughafen', 'airport', 'air base', 'aerodrome', 'segelflug', 'landeplatz', 'fliegerhorst', icao.toLowerCase()].some(kw => t.toLowerCase().includes(kw));

        const geoRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=10&format=json&origin=*`, 4000);
        const geoData = await geoRes.json();
        const geoResults = geoData?.query?.geosearch || [];

        let hit = geoResults.find(r => isAirport(r.title));
        if (hit) {
            wikiTitleCache[icao] = hit.title;
            return hit.title;
        }

        const txtRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(icao + ' Flughafen OR Flugplatz')}&srlimit=5&format=json&origin=*`, 4000);
        const txtData = await txtRes.json();
        const txtResults = txtData?.query?.search || [];

        hit = txtResults.find(r => isAirport(r.title));
        if (hit) {
            wikiTitleCache[icao] = hit.title;
            return hit.title;
        } else if (txtResults.length > 0 && !txtResults[0].title.includes("Terminal")) {
            wikiTitleCache[icao] = txtResults[0].title;
            return txtResults[0].title;
        }
    } catch (e) { }
    return null;
}

async function fetchRunwayFromWikipedia(icaoCode, lat, lon) {
    if (!icaoCode) return null;
    try {
        const title = await getWikiTitleForAirport(icaoCode, lat, lon);
        if (!title) return null;

        const r = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&format=json&origin=*`, 5000);
        const d = await r.json();
        const pages = d?.query?.pages;

        if (pages) {
            const pageId = Object.keys(pages)[0];
            const wikitext = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'];
            if (wikitext) return parseRunwayFromWikitext(wikitext);
        }
    } catch (e) { }
    return null;
}

function parseRunwayFromWikitext(wikitext) {
    const runways = [];
    const commentRegex = new RegExp('<' + '!--[\\s\\S]*?--' + '>', 'g');
    let text = wikitext.replace(commentRegex, '');
    text = text.replace(/<br\s*\/?>/gi, ' ');
    text = text.replace(/&#160;/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&times;/gi, '×');
    text = text.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ');

    const HDG_PATTERN = /\b((?:0?[1-9]|[12]\d|3[0-6])[LRC]?\s*\/\s*(?:0?[1-9]|[12]\d|3[0-6])[LRC]?)\b/g;
    const SURFACES = /\b(asphalt|beton|gras|grass|schotter|gravel|concrete|paved|unpaved|dirt|erde|sand|wasser|water|eis|ice)\b/i;
    const LEN_PATTERN = /(?:(?:länge|length|len)\d*\s*=\s*([1-9][\d.,]*))|(?:([1-9][\d.,]*)\s*(?:m|Meter)\b)|(?:([1-9][\d.,]*)\s*(?:x|×)\s*\d+)/i;

    let matches = [];
    let match;
    while ((match = HDG_PATTERN.exec(text)) !== null) {
        let cleanHdg = match[1].replace(/\s+/g, '');
        let parts = cleanHdg.split('/');
        if (Math.abs(parseInt(parts[0], 10) - parseInt(parts[1], 10)) === 18) {
            matches.push({ hdg: cleanHdg, index: match.index, raw: match[1] });
        }
    }

    for (let i = 0; i < matches.length; i++) {
        const hdg = matches[i].hdg;
        const startIdx = matches[i].index;

        let endIdx = Math.min(startIdx + 200, text.length);
        if (i + 1 < matches.length) {
            if (matches[i + 1].index < endIdx) endIdx = matches[i + 1].index;
        }
        let contextFwd = text.substring(startIdx, endIdx);

        let preStartIdx = Math.max(0, startIdx - 60);
        if (i > 0) {
            const prevEnd = matches[i - 1].index + matches[i - 1].raw.length;
            if (prevEnd > preStartIdx) preStartIdx = prevEnd;
        }
        let contextBwd = text.substring(preStartIdx, startIdx);

        let length = '';
        let surface = '';

        let lenMatch = contextFwd.match(LEN_PATTERN);
        if (!lenMatch) lenMatch = contextBwd.match(LEN_PATTERN);

        let rawLen = lenMatch ? (lenMatch[1] || lenMatch[2] || lenMatch[3]) : null;

        if (!rawLen) {
            let isolatedNum = contextFwd.match(/(?:\||\s|^)([1-9][\d.]{2,3})(?:\s|\||$)/);
            if (!isolatedNum) isolatedNum = contextBwd.match(/(?:\||\s|^)([1-9][\d.]{2,3})(?:\s|\||$)/);
            if (isolatedNum) rawLen = isolatedNum[1];
        }

        if (rawLen) length = rawLen.replace(/[.,]/g, '') + 'm';

        let surfMatch = contextFwd.match(SURFACES);
        if (!surfMatch) surfMatch = contextBwd.match(SURFACES);

        if (surfMatch) surface = surfMatch[1].charAt(0).toUpperCase() + surfMatch[1].slice(1).toLowerCase();

        if (length || surface || matches.length === 1) {
            runways.push([hdg, length, surface].filter(Boolean).join(' · '));
        }
    }

    if (runways.length === 0) return null;

    const uniqueRunways = [...new Set(runways)];
    uniqueRunways.sort((a, b) => b.length - a.length);

    const finalRunways = [];

    for (const rwy of uniqueRunways) {
        const parts = rwy.split(' · ');
        const currentHdg = parts[0];

        const currentSurfMatch = rwy.match(new RegExp(SURFACES.source, 'i'));
        const currentSurf = currentSurfMatch ? currentSurfMatch[1].toLowerCase() : null;

        let isSubsetOrHistory = false;

        for (const existing of finalRunways) {
            const existingParts = existing.split(' · ');
            if (existingParts[0] === currentHdg) {

                let allAttrMatch = true;
                for (let j = 1; j < parts.length; j++) {
                    if (!existing.includes(parts[j])) {
                        allAttrMatch = false;
                        break;
                    }
                }

                if (allAttrMatch) {
                    isSubsetOrHistory = true;
                    break;
                }

                const existingSurfMatch = existing.match(new RegExp(SURFACES.source, 'i'));
                const existingSurf = existingSurfMatch ? existingSurfMatch[1].toLowerCase() : null;

                if (existingSurf === currentSurf || !currentSurf) {
                    isSubsetOrHistory = true;
                    break;
                }
            }
        }

        if (!isSubsetOrHistory) {
            finalRunways.push(rwy);
        }
    }

    return finalRunways.slice(0, 5).join('\n');
}

const _poiTerrainCache = new Map();
const _missionWxCache = new Map();

async function fetchPoiTerrainElevationFt(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (_poiTerrainCache.has(key)) return _poiTerrainCache.get(key);

    let elevFt = null;
    try {
        if (typeof sampleTerrainElevation === 'function') {
            elevFt = await Promise.race([
                sampleTerrainElevation(lat, lon),
                new Promise((_, reject) => setTimeout(() => reject(new Error('terrain-timeout')), 2500))
            ]);
        }
    } catch (e) {}

    if (!Number.isFinite(elevFt)) {
        try {
            const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data?.elevation) && Number.isFinite(data.elevation[0])) {
                    elevFt = Math.round(data.elevation[0] * 3.28084);
                } else if (Number.isFinite(data?.elevation)) {
                    elevFt = Math.round(data.elevation * 3.28084);
                }
            }
        } catch (e) {}
    }

    const normalized = Number.isFinite(elevFt) ? Math.max(0, Math.round(elevFt)) : null;
    _poiTerrainCache.set(key, normalized);
    return normalized;
}

function _summarizeMissionWeather(wx) {
    if (!wx) return 'Keine aktuellen Wetterdaten verfügbar.';
    const visTxt = Number.isFinite(wx.visKm)
        ? (wx.visKm >= 10 ? 'Sicht >10 km' : `Sicht ${wx.visKm.toFixed(1)} km`)
        : 'Sicht n/a';
    const windTxt = (Number.isFinite(wx.windDeg) && Number.isFinite(wx.windKts))
        ? `Wind ${wx.windDeg}°/${Math.round(wx.windKts)} kt`
        : 'Wind n/a';
    const tempTxt = Number.isFinite(wx.tempC) ? `${Math.round(wx.tempC)}°C` : 'Temp n/a';
    const wxTxt = wx.wxCode ? `WX ${wx.wxCode}` : 'WX NIL';
    const catTxt = wx.fltCat ? `Kategorie ${wx.fltCat}` : 'Kategorie n/a';
    return `${windTxt}, ${visTxt}, ${tempTxt}, ${wxTxt}, ${catTxt}`;
}

function _looksLikeIcao(icao) {
    return /^[A-Z0-9]{4}$/.test(String(icao || '').trim().toUpperCase());
}

async function fetchMissionWeatherSnapshot(icao, lat, lon) {
    const normIcao = String(icao || '').trim().toUpperCase();
    const key = `${normIcao || 'POI'}_${Number(lat || 0).toFixed(3)}_${Number(lon || 0).toFixed(3)}`;
    if (_missionWxCache.has(key)) return _missionWxCache.get(key);

    const parsePayload = (txt) => {
        if (typeof txt !== 'string' || !txt.trim()) return null;
        try {
            const p = JSON.parse(txt);
            if (Array.isArray(p)) return p;
            if (Array.isArray(p?.data)) return p.data;
            if (Array.isArray(p?.results)) return p.results;
            if (typeof p?.contents === 'string') {
                const nested = JSON.parse(p.contents);
                return Array.isArray(nested) ? nested : null;
            }
        } catch (e) {}
        return null;
    };

    const tryFetch = async (url) => {
        const variants = [
            `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`
        ];
        for (const u of variants) {
            try {
                const res = await fetch(u);
                if (!res.ok || res.status === 204) continue;
                const txt = await res.text();
                const arr = parsePayload(txt);
                if (Array.isArray(arr) && arr.length) return arr;
            } catch (e) {}
        }
        return null;
    };

    let metar = null;
    if (_looksLikeIcao(normIcao)) {
        const arr = await tryFetch(`https://aviationweather.gov/api/data/metar?ids=${normIcao}&format=json&t=${Date.now()}`);
        if (arr && arr[0]) metar = arr[0];
    }
    if (!metar && Number.isFinite(lat) && Number.isFinite(lon)) {
        const latMin = lat - 0.6, latMax = lat + 0.6;
        const lonMin = lon - 0.8, lonMax = lon + 0.8;
        const arr = await tryFetch(`https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`);
        if (arr && arr[0]) {
            const cands = arr.filter(m => Number.isFinite(Number(m?.lat)) && Number.isFinite(Number(m?.lon)));
            if (cands.length) {
                let best = cands[0];
                let bestD = calcNav(lat, lon, Number(best.lat), Number(best.lon)).dist;
                for (let i = 1; i < cands.length; i++) {
                    const d = calcNav(lat, lon, Number(cands[i].lat), Number(cands[i].lon)).dist;
                    if (d < bestD) { bestD = d; best = cands[i]; }
                }
                metar = best;
            }
        }
    }

    let out = null;
    if (metar) {
        const raw = typeof metar.rawOb === 'string' ? metar.rawOb : (typeof metar.raw === 'string' ? metar.raw : '');
        let visKm = null;
        if (raw.includes(' 9999 ')) visKm = 10;
        else {
            const vm = raw.match(/\s(\d{4})\s/);
            if (vm && vm[1] !== '0000') visKm = Math.round((parseInt(vm[1], 10) / 1000) * 10) / 10;
        }
        let windDeg = Number.isFinite(Number(metar.wdir)) ? Number(metar.wdir) : null;
        let windKts = Number.isFinite(Number(metar.wspd)) ? Number(metar.wspd) : null;
        const vrb = /VRB\d{2,3}KT/.test(raw || '');
        if (vrb) windDeg = null;
        out = {
            station: String(metar.icaoId || normIcao || '').toUpperCase() || null,
            raw: raw || null,
            windDeg,
            windKts,
            visKm,
            tempC: Number.isFinite(Number(metar.temp)) ? Number(metar.temp) : null,
            wxCode: metar.wxString || null,
            fltCat: metar.fltCat || null
        };
    }

    _missionWxCache.set(key, out);
    return out;
}

function enforcePoiPassengerAltitudeRule(passenger, isPOI, poiTerrainFt = null) {
    if (!passenger || typeof passenger !== 'object') return passenger;
    const ROLE_PROFILE_VALUES = new Set([
        'general_passenger_v1',
        'instructor_calm_precise_v1',
        'charter_professional_neutral_v1',
        'technical_inspector_v1',
        'media_observer_v1',
        'science_field_v1',
        'vip_business_v1',
        'club_utility_v1',
        'medical_sensitive_v1',
        'news_reporter_professional_v1',
        'tour_guide_relaxed_v1',
        'photogrammetry_precision_v1',
        'cargo_fragile_highcare_v1',
        'rescue_coordination_v1',
        'fire_observer_ops_v1',
        'club_student_v1'
    ]);
    const TASK_DOMAIN_VALUES = new Set([
        'general',
        'training',
        'charter',
        'inspection_infra',
        'media_photo',
        'science_bio',
        'science_geo',
        'science_general',
        'club_utility',
        'medical_transfer',
        'news_coverage',
        'sightseeing_tour',
        'mapping_survey',
        'cargo_fragile',
        'search_and_rescue',
        'fire_watch',
        'animal_transport',
        'club_training_basic',
        'club_training_advanced'
    ]);
    const _normRoleProfile = (v, fallback = 'general_passenger_v1') => {
        const s = String(v || '').trim().toLowerCase();
        return ROLE_PROFILE_VALUES.has(s) ? s : fallback;
    };
    const _normTaskDomain = (v, fallback = 'general') => {
        const s = String(v || '').trim().toLowerCase();
        return TASK_DOMAIN_VALUES.has(s) ? s : fallback;
    };
    const _deriveRoleProfileFromRole = (roleRaw, storyRaw) => {
        const hay = `${String(roleRaw || '').toLowerCase()} ${String(storyRaw || '').toLowerCase()}`;
        if (/(fluglehrer|fluglehrerin|instructor|instruktor|checkpilot)/.test(hay)) return 'instructor_calm_precise_v1';
        if (/(notarzt|notaerzt|sanitaet|rettung|mediz|arzt)/.test(hay)) return 'medical_sensitive_v1';
        if (/(report|journal|news|moderator|tv|presse)/.test(hay)) return 'news_reporter_professional_v1';
        if (/(tour|reiseleitung|stadtfuehr|guide|sightseeing)/.test(hay)) return 'tour_guide_relaxed_v1';
        if (/(mapping|survey|photogram|lidar|geodaten|vermessung)/.test(hay)) return 'photogrammetry_precision_v1';
        if (/(fragil|zerbrech|praezision|kunstwerk|laborgeraet|stoßempfind)/.test(hay)) return 'cargo_fragile_highcare_v1';
        if (/(sar|search|rescue|rettungseinsatz|suchmuster)/.test(hay)) return 'rescue_coordination_v1';
        if (/(brand|rauch|hotspot|fire watch|waldbrand)/.test(hay)) return 'fire_observer_ops_v1';
        if (/(flugschueler|schueler|student|ausbildung)/.test(hay)) return 'club_student_v1';
        if (/(berater|anwalt|architekt|projektleiter|unternehmer|geschaeft|business|vip)/.test(hay)) return 'vip_business_v1';
        if (/(mechan|wartung|inspekt|techn|vermess|ingenieur|facility|pruef|prüfung|statik)/.test(hay)) return 'technical_inspector_v1';
        if (/(foto|film|medien|report|journal|immobilien)/.test(hay)) return 'media_observer_v1';
        if (/(wissenschaft|forschung|biolog|oekolog|ökolog|geolog|hydrolog|meteorolog|kartograf|analyst)/.test(hay)) return 'science_field_v1';
        if (/(verein|stammtisch|hangar|ersatzteil)/.test(hay)) return 'club_utility_v1';
        return 'general_passenger_v1';
    };
    const _deriveTaskDomain = (roleRaw, storyRaw, roleProfileRaw) => {
        const roleProfile = _normRoleProfile(roleProfileRaw, '');
        if (roleProfile === 'instructor_calm_precise_v1') return 'training';
        if (roleProfile === 'charter_professional_neutral_v1') return 'charter';
        if (roleProfile === 'medical_sensitive_v1') return 'medical_transfer';
        if (roleProfile === 'news_reporter_professional_v1') return 'news_coverage';
        if (roleProfile === 'tour_guide_relaxed_v1') return 'sightseeing_tour';
        if (roleProfile === 'photogrammetry_precision_v1') return 'mapping_survey';
        if (roleProfile === 'cargo_fragile_highcare_v1') return 'cargo_fragile';
        if (roleProfile === 'rescue_coordination_v1') return 'search_and_rescue';
        if (roleProfile === 'fire_observer_ops_v1') return 'fire_watch';
        if (roleProfile === 'club_student_v1') return 'club_training_basic';
        const hay = `${String(roleRaw || '').toLowerCase()} ${String(storyRaw || '').toLowerCase()}`;
        if (/(notarzt|notaerzt|mediz|sanitaet|blutkonserve|klinik|patient)/.test(hay)) return 'medical_transfer';
        if (/(report|news|presse|tv|journal|moderator)/.test(hay)) return 'news_coverage';
        if (/(sightseeing|tour|stadtfuehr|ausflug|panorama)/.test(hay)) return 'sightseeing_tour';
        if (/(mapping|survey|photogram|lidar|geodaten|kartier)/.test(hay)) return 'mapping_survey';
        if (/(fragil|zerbrech|praezision|kunstwerk|stoß|stoss|erschuetter)/.test(hay)) return 'cargo_fragile';
        if (/(sar|search|rescue|rettung|suchmuster|vermisst)/.test(hay)) return 'search_and_rescue';
        if (/(brand|rauch|hotspot|waldbrand|feuerwacht)/.test(hay)) return 'fire_watch';
        if (/(tiertransport|tierschutz|welpen|katze|hund|tierarzt|animal)/.test(hay)) return 'animal_transport';
        if (/(biolog|oekolog|ökolog|ornitholog|naturschutz|umwelt)/.test(hay)) return 'science_bio';
        if (/(geolog|hydrolog|erosion|hangstabil|gestein|sediment|rutsch)/.test(hay)) return 'science_geo';
        if (/(wissenschaft|forschung|meteorolog|kartograf|analyst)/.test(hay)) return 'science_general';
        if (/(inspekt|wartung|techn|vermess|brueck|bruck|autobahn|strass|funk|mast|damm|talsperre)/.test(hay)) return 'inspection_infra';
        if (/(foto|film|medien|immobilien|report|journal)/.test(hay)) return 'media_photo';
        if (/(verein|stammtisch|ersatzteil|mechaniker|hangar)/.test(hay)) return 'club_utility';
        return 'general';
    };
    const _normLevel = (v, fallback = 'mittel') => {
        const s = String(v || '').trim().toLowerCase();
        return (s === 'niedrig' || s === 'mittel' || s === 'hoch') ? s : fallback;
    };
    const _deriveStomachSensitivity = (gToleranceRaw) => {
        const gTol = _normLevel(gToleranceRaw, 'mittel');
        if (gTol === 'niedrig') return 'hoch';
        if (gTol === 'hoch') return 'niedrig';
        return 'mittel';
    };
    const normalized = {
        ...passenger,
        roleProfile: _normRoleProfile(
            passenger.roleProfile,
            _deriveRoleProfileFromRole(passenger.role, passenger.storyHint)
        ),
        taskDomain: _normTaskDomain(
            passenger.taskDomain,
            _deriveTaskDomain(passenger.role, passenger.storyHint, passenger.roleProfile)
        ),
        targetAltFt: Number(passenger.targetAltFt) || 0,
        targetRadiusNm: Number(passenger.targetRadiusNm) || 0,
        targetDwellMin: Number(passenger.targetDwellMin) || 0,
        dialectHint: typeof passenger.dialectHint === 'string' ? passenger.dialectHint.trim() : '',
        gTolerance: _normLevel(passenger.gTolerance, 'mittel'),
        bankTolerance: _normLevel(passenger.bankTolerance, 'mittel'),
        cargoSensitivity: _normLevel(passenger.cargoSensitivity, 'mittel'),
        stomachSensitivity: _normLevel(passenger.stomachSensitivity, _deriveStomachSensitivity(passenger.gTolerance)),
        comfortPriority: _normLevel(passenger.comfortPriority, 'mittel')
    };

    // A-B Flüge: keine Arbeitsvorgaben am Ziel (nur Komfort/Charakter).
    if (!isPOI) {
        normalized.targetAltFt = 0;
        normalized.targetRadiusNm = 0;
        normalized.targetDwellMin = 0;
        return normalized;
    }

    if (normalized.targetAltFt < 0) normalized.targetAltFt = 0;
    if (normalized.targetRadiusNm < 0) normalized.targetRadiusNm = 0;
    if (normalized.targetDwellMin < 0) normalized.targetDwellMin = 0;

    if (normalized.targetAltFt > 0) {
        const minMslByTerrain = Number.isFinite(poiTerrainFt) ? Math.round(poiTerrainFt + 500) : 0;
        const minRequired = Math.max(500, minMslByTerrain);
        if (normalized.targetAltFt < minRequired) normalized.targetAltFt = minRequired;
    }
    if (!normalized.dialectHint) normalized.dialectHint = 'neutral';
    return normalized;
}

const TRAINING_AIRWORK_ITEMS = [
    'Stall-Training',
    'Steep Turns (Vollkreis)',
    'Slow Flight',
    'Haengekurven rechts/links',
    'Clean/Dirty Configuration Changes',
    'VFR-Navigationsaufgabe mit Kurskorrektur'
];
const TRAINING_PATTERN_ITEMS = [
    'No-Flaps-Approach',
    'Engine-Out-Approach (simuliert)',
    'Touch-and-Go',
    'Missed Approach / Go-Around',
    'Extra-Platzrunde mit stabilisiertem Endanflug'
];
const INSTRUCTOR_PERSONA_LIBRARY = [
    {
        name: 'Alex Kramer',
        role: 'Fluglehrer',
        gender: 'male',
        personality: 'ruhig, präzise, motivierend',
        dialectHint: 'neutral',
        greetingText: 'Morgen! Heute fliegen wir Training und ich gebe dir die Aufgaben unterwegs.'
    },
    {
        name: 'Lea Hartmann',
        role: 'Fluglehrerin',
        gender: 'female',
        personality: 'ruhig, präzise, motivierend',
        dialectHint: 'neutral',
        greetingText: 'Hi, ich bin Lea. Heute trainieren wir strukturiert und ich gebe dir die Aufgaben Schritt für Schritt.'
    }
];
const CHARTER_PERSONA_LIBRARY = [
    {
        name: 'Martin Vogt',
        role: 'Unternehmensberater',
        gender: 'male',
        personality: 'ruhig, fokussiert, höflich',
        dialectHint: 'neutral',
        greetingText: 'Hi, danke dir fürs Fliegen heute. Ich brauch einen ruhigen, sauberen Charterflug.'
    },
    {
        name: 'Nora Seidel',
        role: 'Projektleiterin',
        gender: 'female',
        personality: 'ruhig, strukturiert, freundlich',
        dialectHint: 'neutral',
        greetingText: 'Hi, danke fürs Mitnehmen. Mir ist ein ruhiger, planbarer Flug wichtig.'
    }
];

function _pickNextInstructorPersona() {
    const list = Array.isArray(INSTRUCTOR_PERSONA_LIBRARY) && INSTRUCTOR_PERSONA_LIBRARY.length
        ? INSTRUCTOR_PERSONA_LIBRARY
        : [{
            name: 'Alex Kramer',
            role: 'Fluglehrer',
            gender: 'male',
            personality: 'ruhig, präzise, motivierend',
            dialectHint: 'neutral',
            greetingText: 'Morgen! Heute fliegen wir Training und ich gebe dir die Aufgaben unterwegs.'
        }];
    let idx = -1;
    try { idx = parseInt(localStorage.getItem('ga_instructor_persona_idx') || '-1', 10); } catch (_) { idx = -1; }
    if (!Number.isFinite(idx)) idx = -1;
    idx = (idx + 1) % list.length;
    try { localStorage.setItem('ga_instructor_persona_idx', String(idx)); } catch (_) {}
    return { ...list[idx] };
}

function buildInstructorPassenger(trainingPlan = null) {
    const persona = _pickNextInstructorPersona();
    return {
        ...persona,
        gTolerance: 'mittel',
        bankTolerance: 'mittel',
        cargoSensitivity: 'niedrig',
        stomachSensitivity: 'mittel',
        comfortPriority: 'mittel',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        roleProfile: 'instructor_calm_precise_v1',
        taskDomain: 'training',
        trainingPlan: sanitizeTrainingPlan(trainingPlan, true)
    };
}

function _pickNextCharterPersona() {
    const list = Array.isArray(CHARTER_PERSONA_LIBRARY) && CHARTER_PERSONA_LIBRARY.length
        ? CHARTER_PERSONA_LIBRARY
        : [{
            name: 'Martin Vogt',
            role: 'Unternehmensberater',
            gender: 'male',
            personality: 'ruhig, fokussiert, höflich',
            dialectHint: 'neutral',
            greetingText: 'Hi, danke dir fürs Fliegen heute. Ich brauch einen ruhigen, sauberen Charterflug.'
        }];
    let idx = -1;
    try { idx = parseInt(localStorage.getItem('ga_charter_persona_idx') || '-1', 10); } catch (_) { idx = -1; }
    if (!Number.isFinite(idx)) idx = -1;
    idx = (idx + 1) % list.length;
    try { localStorage.setItem('ga_charter_persona_idx', String(idx)); } catch (_) {}
    return { ...list[idx] };
}

function buildCharterPassenger(basePassenger = null) {
    const base = (basePassenger && typeof basePassenger === 'object') ? basePassenger : {};
    const persona = _pickNextCharterPersona();
    return {
        ...persona,
        ...base,
        name: String(base.name || '').trim() || persona.name,
        role: String(base.role || '').trim() || persona.role,
        gender: (String(base.gender || '').toLowerCase() === 'female' || String(base.gender || '').toLowerCase() === 'male')
            ? String(base.gender || '').toLowerCase()
            : persona.gender,
        personality: String(base.personality || '').trim() || persona.personality,
        greetingText: String(base.greetingText || '').trim() || persona.greetingText,
        dialectHint: 'neutral',
        gTolerance: String(base.gTolerance || 'mittel').toLowerCase(),
        bankTolerance: String(base.bankTolerance || 'mittel').toLowerCase(),
        cargoSensitivity: String(base.cargoSensitivity || 'mittel').toLowerCase(),
        stomachSensitivity: String(base.stomachSensitivity || 'mittel').toLowerCase(),
        comfortPriority: String(base.comfortPriority || 'mittel').toLowerCase(),
        roleProfile: 'charter_professional_neutral_v1',
        taskDomain: 'charter',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        trainingPlan: null
    };
}

function _pickRandomProfilePersona(profileSpec) {
    const list = Array.isArray(profileSpec?.personas) ? profileSpec.personas.filter(Boolean) : [];
    if (!list.length) return null;
    return { ...list[Math.floor(Math.random() * list.length)] };
}

function buildMissionProfilePassenger(basePassenger = null, profileSpec = null, isPOI = false, storyHint = '') {
    if (!profileSpec || !profileSpec.id || profileSpec.id === 'auto') {
        return (basePassenger && typeof basePassenger === 'object') ? basePassenger : null;
    }
    const base = (basePassenger && typeof basePassenger === 'object') ? basePassenger : {};
    const persona = _pickRandomProfilePersona(profileSpec) || {};
    const tol = profileSpec.tolerances || {};
    const merged = {
        ...base,
        name: String(persona.name || base.name || '').trim() || 'Alex Neumann',
        role: String(persona.role || base.role || '').trim() || 'Passagier',
        gender: (String(persona.gender || base.gender || '').toLowerCase() === 'female') ? 'female' : 'male',
        personality: String(persona.personality || base.personality || 'ruhig, freundlich, professionell').trim(),
        dialectHint: 'neutral',
        greetingText: String(profileSpec.greetingText || base.greetingText || '').trim() || 'Hi, danke fürs Fliegen heute.',
        roleProfile: String(profileSpec.roleProfile || base.roleProfile || 'general_passenger_v1').toLowerCase(),
        taskDomain: String(profileSpec.taskDomain || base.taskDomain || 'general').toLowerCase(),
        gTolerance: String(tol.gTolerance || base.gTolerance || 'mittel').toLowerCase(),
        bankTolerance: String(tol.bankTolerance || base.bankTolerance || 'mittel').toLowerCase(),
        cargoSensitivity: String(tol.cargoSensitivity || base.cargoSensitivity || 'mittel').toLowerCase(),
        stomachSensitivity: String(tol.stomachSensitivity || base.stomachSensitivity || 'mittel').toLowerCase(),
        comfortPriority: String(tol.comfortPriority || base.comfortPriority || 'mittel').toLowerCase(),
        targetAltFt: isPOI ? Number(base.targetAltFt || 0) : 0,
        targetRadiusNm: isPOI ? Number(base.targetRadiusNm || 0) : 0,
        targetDwellMin: isPOI ? Number(base.targetDwellMin || 0) : 0,
        trainingPlan: null,
        storyHint: String(storyHint || '')
    };
    return merged;
}

function applyMissionTaskProfileToMission(mission, isPOI, profileId, paxText, cargoText) {
    const m = (mission && typeof mission === 'object') ? { ...mission } : {};
    const baseType = isPOI ? 'poi' : 'apt';
    const profile = getMissionTaskProfile(profileId, baseType);
    if (!profile || profile.id === 'auto') {
        return { mission: m, paxText, cargoText, appliedProfile: 'auto' };
    }

    const passenger = buildMissionProfilePassenger(m.passenger || null, profile, isPOI, m.s || '');
    if (passenger) {
        m.passenger = passenger;
    }
    if (profile.paxText) {
        paxText = profile.paxText;
    } else if (m.passenger?.role) {
        paxText = `1 PAX (${m.passenger.role})`;
    }
    const cargoPool = Array.isArray(profile.cargoPool) ? profile.cargoPool.filter(Boolean) : [];
    if (cargoPool.length) cargoText = cargoPool[Math.floor(Math.random() * cargoPool.length)];
    if (profile.storyCue) {
        const cue = String(profile.storyCue).trim();
        const story = String(m.s || '').trim();
        if (cue && story && !story.toLowerCase().includes(cue.toLowerCase())) {
            m.s = `${story} ${cue}`.trim();
        } else if (cue && !story) {
            m.s = cue;
        }
    }
    m.profileId = profile.id;
    return { mission: m, paxText, cargoText, appliedProfile: profile.id };
}

function pickAutoMissionTaskProfileId({ isPOI = false, selectedAptCategory = 'all', selectedPoiCategory = 'all', missionCat = '' } = {}) {
    const cat = String(missionCat || '').toLowerCase();
    const aptSel = String(selectedAptCategory || 'all').toLowerCase();
    const poiSel = String(selectedPoiCategory || 'all').toLowerCase();
    const weighted = [];
    const pushMany = (id, n) => { for (let i = 0; i < n; i++) weighted.push(id); };

    if (isPOI) {
        if (poiSel === 'trn' || cat === 'trn') return 'auto';
        // POI Default-Mix
        pushMany('mapping_survey', 3);
        pushMany('news_coverage', 2);
        pushMany('search_and_rescue', 2);
        pushMany('fire_watch', 2);
        pushMany('sightseeing_tour', 1);
        // Category-bias
        if (/(bridge|road|telecom|industry|dam)/.test(poiSel + ' ' + cat)) {
            pushMany('mapping_survey', 2);
            pushMany('news_coverage', 1);
        }
        if (/(water|mountain|generic)/.test(poiSel + ' ' + cat)) {
            pushMany('search_and_rescue', 1);
            pushMany('fire_watch', 1);
        }
    } else {
        if (aptSel === 'trn' || cat === 'trn') return 'auto';
        if (aptSel === 'charter' || cat === 'charter') return 'auto';
        // APT Default-Mix
        pushMany('sightseeing_tour', 3);
        pushMany('news_coverage', 2);
        pushMany('cargo_fragile', 2);
        pushMany('animal_transport', 2);
        pushMany('medical_transfer', 1);
        // Category-bias
        if (aptSel === 'cargo' || cat === 'cargo') {
            pushMany('cargo_fragile', 4);
            pushMany('medical_transfer', 1);
        }
        if (aptSel === 'private' || aptSel === 'club' || cat === 'std' || cat === 'club') {
            pushMany('sightseeing_tour', 2);
            pushMany('animal_transport', 1);
        }
    }

    if (!weighted.length) return 'auto';
    return weighted[Math.floor(Math.random() * weighted.length)] || 'auto';
}

function _pickUniqueTrainingItems(pool, count, used = new Set()) {
    const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
    const shuffled = src
        .filter(item => !used.has(item))
        .sort(() => Math.random() - 0.5);
    const out = [];
    for (const item of shuffled) {
        out.push(item);
        used.add(item);
        if (out.length >= count) break;
    }
    return out;
}

function _isPatternFocusItem(text) {
    const s = String(text || '').toLowerCase();
    return /pattern|platzrunde|touch|go-around|missed|no-flap|engine-out|anflug|landung|final/.test(s);
}

function buildDistributedTrainingPlan(seedMode = 'airwork') {
    const totalCount = 2 + Math.floor(Math.random() * 3); // 2..4
    const preferPattern = String(seedMode || '').toLowerCase() === 'pattern';
    let patternCount = 0;

    if (preferPattern) {
        patternCount = Math.min(totalCount - 1, totalCount >= 4 ? 2 : 1);
    } else if (totalCount >= 3 && Math.random() < 0.55) {
        // Airwork bleibt dominant, aber oft mit einer Landeuebung gemischt.
        patternCount = 1;
    }
    const airworkCount = Math.max(1, totalCount - patternCount);
    const used = new Set();
    const focus = [
        ..._pickUniqueTrainingItems(TRAINING_AIRWORK_ITEMS, airworkCount, used),
        ..._pickUniqueTrainingItems(TRAINING_PATTERN_ITEMS, patternCount, used)
    ];
    const mode = patternCount > 0 ? 'pattern' : 'airwork';
    const trigger = mode === 'pattern' ? 'five_nm_before_landing' : 'half_route';
    const instructorLine = mode === 'pattern'
        ? 'Wir machen erst die Uebungen in der Luft und gehen dann in eine Landeuebung am Platz.'
        : 'Wir bleiben heute beim Airwork: sauber, ruhig und mit klarem Ablauf.';
    return { mode, trigger, focus, instructorLine };
}

function sanitizeTrainingPlan(rawPlan, isTrainingMission) {
    if (!isTrainingMission) return null;
    if (!rawPlan || typeof rawPlan !== 'object') {
        return buildDistributedTrainingPlan('airwork');
    }
    const modeRaw = String(rawPlan.mode || '').toLowerCase();
    const requestedMode = (modeRaw === 'airwork' || modeRaw === 'pattern') ? modeRaw : 'airwork';
    const focusRaw = Array.isArray(rawPlan.focus) ? rawPlan.focus : [];
    let focus = focusRaw
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 4);
    // Trainingsvielfalt erzwingen: insgesamt 2-4 Manoever, oft Airwork + optional 1 Pattern.
    if (focus.length < 2) {
        const fallback = buildDistributedTrainingPlan(requestedMode);
        focus = fallback.focus;
    } else {
        const hasPattern = focus.some(_isPatternFocusItem);
        if (!hasPattern && focus.length >= 3 && requestedMode === 'airwork' && Math.random() < 0.45) {
            const add = _pickUniqueTrainingItems(TRAINING_PATTERN_ITEMS, 1, new Set(focus));
            focus = focus.concat(add).slice(0, 4);
        }
    }
    const mode = focus.some(_isPatternFocusItem) ? 'pattern' : requestedMode;
    const triggerRaw = String(rawPlan.trigger || '').toLowerCase();
    const trigger = (triggerRaw === 'half_route' || triggerRaw === 'five_nm_before_landing')
        ? triggerRaw
        : (mode === 'pattern' ? 'five_nm_before_landing' : 'half_route');
    const instructorLine = String(rawPlan.instructorLine || '').trim().slice(0, 220);
    const instructorFallback = mode === 'pattern'
        ? 'Heute mit gemischtem Programm: Airwork im Uebungsgebiet, dann eine saubere Landeuebung am Platz.'
        : 'Heute konzentrieren wir uns auf Airwork mit ruhigem, sauberem Ablauf.';
    return { mode, trigger, focus, instructorLine: instructorLine || instructorFallback };
}

function formatPaxBriefingText(paxText, passenger) {
    const base = String(paxText || '').trim();
    const name = String(passenger?.name || '').trim();
    if (!base || !name) return base;
    if (/^\s*0\s*PAX\b/i.test(base)) return base;
    if (base.toLowerCase().includes(name.toLowerCase())) return base;
    const m = base.match(/^(.*)\(([^)]*)\)\s*$/);
    if (m) {
        const left = String(m[1] || '').trim();
        const inner = String(m[2] || '').trim();
        if (!inner) return `${left} (${name})`.trim();
        return `${left} (${inner}: ${name})`.trim();
    }
    return `${base} (${name})`;
}

async function fetchGeminiMission(startName, destName, dist, isPOI, paxText, cargoText, poiTerrainFt = null, missionWeather = null, missionPicker = null) {
    const aiToggleBtn = document.getElementById('aiToggle');
    if (!aiToggleBtn || !aiToggleBtn.checked) return null;
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
    if (!apiKey) return null;

    const poiCategories = [
        "Tourismus & Sightseeing", "Natur- & Umweltschutz (Beobachtung)",
        "Luftbildfotografie (Medien/Immobilien)", "Infrastruktur-Inspektion (Straßen/Brücken/Leitungen)",
        "Wissenschaftliche Datenerfassung", "Lokales Event / Großveranstaltung von oben",
        "Kurioses / Verrückte Suchaktion"
    ];

    const aptCategories = [
        "Kulinarischer Ausflug ($100 Burger, legendäre Pizza, Steak oder BBQ am Ziel)",
        "Kaffee & Kuchen Run (Klassischer Nachmittagsausflug zum Flugplatz-Café)",
        "Tagesausflug mit Freunden (Wandern, Action oder einfach abhängen am Zielort)",
        "Städtetrip (Sightseeing, Kultur, 1-2 echte Highlights der Zielstadt erkunden)",
        "Wellness-Urlaub / Romantischer Wochenendausflug mit der Frau/dem Partner",
        "Besuch bei einem befreundeten Fliegerverein (Stammtisch, Fly-In, Austausch)",
        "Flugplatz-Logistik (Ersatzteil für die Vereinsmaschine holen, Mechaniker-Shuttle)",
        "Spezielles Flugtraining (Seitenwind, Navigation, Platzrunden-Drill am fremden Platz)",
        "Business-Charter (Geschäftsmann/Geschäftsfrau rechtzeitig zu einem Termin fliegen)",
        "Business-Charter (Alltäglicher Flug für einen Architekten, Anwalt oder Bauleiter)",
        "Eilige, aber unspektakuläre Kleinfracht (Dokumente, Ersatzteile)",
        "Kurioses / Verrückter, aber friedlicher Privatflug",
        "Tierrettung / Tiertransport"
    ];

    const missionSel = missionPicker || { baseType: isPOI ? 'poi' : 'apt', category: 'all', profile: 'auto' };
    const isAptTrainingMission = !isPOI && missionSel.baseType === 'apt' && missionSel.category === 'trn';
    const isAptCharterMission = !isPOI && missionSel.baseType === 'apt' && missionSel.category === 'charter';
    const isPoiTrainingMission = isPOI && missionSel.baseType === 'poi' && missionSel.category === 'trn';
    const isTrainingMission = isAptTrainingMission || isPoiTrainingMission;
    const forcedProfile = getMissionTaskProfile(missionSel.profile || 'auto', isPOI ? 'poi' : 'apt');
    const poiThemesByCat = {
        bridge: ["Infrastruktur-Inspektion (Brücke/Viadukt)"],
        road: ["Infrastruktur-Inspektion (Straßen/Autobahnknoten)"],
        dam: ["Infrastruktur-Inspektion (Staudamm/Talsperre)"],
        telecom: ["Infrastruktur-Inspektion (Funkmast/Funkturm)"],
        industry: ["Infrastruktur-Inspektion (Industrieanlage)"],
        castle: ["Tourismus & Sightseeing", "Luftbildfotografie (Medien/Immobilien)"],
        water: ["Natur- & Umweltschutz (Beobachtung)", "Wissenschaftliche Datenerfassung"],
        mountain: ["Natur- & Umweltschutz (Beobachtung)", "Luftbildfotografie (Medien/Immobilien)"],
        city: ["Lokales Event / Großveranstaltung von oben", "Luftbildfotografie (Medien/Immobilien)"],
        trn: [
            "Platznahes VFR-Training im Übungsgebiet (Orientierung, Luftraumbezug, saubere Verfahren)",
            "Trainingsflug mit Instructor im Nahbereich des Startflugplatzes"
        ],
        generic: poiCategories
    };
    const aptThemesByCat = {
        club: [
            "Besuch bei einem befreundeten Fliegerverein (Stammtisch, Fly-In, Austausch)",
            "Flugplatz-Logistik (Ersatzteil für die Vereinsmaschine holen, Mechaniker-Shuttle)"
        ],
        private: [
            "Kulinarischer Ausflug ($100 Burger, legendäre Pizza, Steak oder BBQ am Ziel)",
            "Kaffee & Kuchen Run (Klassischer Nachmittagsausflug zum Flugplatz-Café)",
            "Tagesausflug mit Freunden (Wandern, Action oder einfach abhängen am Zielort)",
            "Städtetrip (Sightseeing, Kultur, 1-2 echte Highlights der Zielstadt erkunden)",
            "Wellness-Urlaub / Romantischer Wochenendausflug mit der Frau/dem Partner",
            "Kurioses / Verrückter, aber friedlicher Privatflug"
        ],
        charter: [
            "Business-Charter (Geschäftsmann/Geschäftsfrau rechtzeitig zu einem Termin fliegen)",
            "Business-Charter (Alltäglicher Flug für einen Architekten, Anwalt oder Bauleiter)"
        ],
        cargo: [
            "Eilige, aber unspektakuläre Kleinfracht (Dokumente, Ersatzteile)",
            "Kurierflug ohne Passagiere (zeitkritische Fracht)"
        ],
        trn: [
            "Spezielles Flugtraining (Seitenwind, Navigation, Platzrunden-Drill am fremden Platz)",
            "Trainingsflug mit Instructor (Workload-Management & SOPs)",
            "Reiner Übungsflug ohne Charter-Story"
        ],
        all: aptCategories
    };
    const themePool = isPOI
        ? (poiThemesByCat[missionSel.category] || poiCategories)
        : (aptThemesByCat[missionSel.category] || aptCategories);
    const randomTheme = themePool[Math.floor(Math.random() * themePool.length)];
    const categoryRule = isPOI
        ? (missionSel.category && missionSel.category !== 'all'
            ? `3b. KATEGORIE-FIX: Die Mission muss zur POI-Kategorie "${missionSel.category}" passen.`
            : '')
        : (missionSel.category && missionSel.category !== 'all'
            ? `3b. KATEGORIE-FIX: Die Mission muss zur APT-Kategorie "${missionSel.category}" passen.`
            : '');

    const maxPaxLimit = paxText.split(' ')[0];
    const targetMissionCat = (missionSel.category && missionSel.category !== 'all')
        ? missionSel.category
        : (isPOI ? 'poi' : 'std');
    const forcedProfileRule = (forcedProfile && forcedProfile.id !== 'auto')
        ? `14. PROFIL-FIX (zwingend): Setze passenger.roleProfile auf "${forcedProfile.roleProfile}" und passenger.taskDomain auf "${forcedProfile.taskDomain}". Rolle/Story daran ausrichten: ${forcedProfile.label}.`
        : '';

    const sanitizePassengerProfile = (passenger, storyText = '') => {
        if (!passenger || typeof passenger !== 'object') return null;
        const normalized = enforcePoiPassengerAltitudeRule({ ...passenger, storyHint: String(storyText || '') }, isPOI, poiTerrainFt);
        if (!normalized || typeof normalized !== 'object') return normalized;
        delete normalized.storyHint;
        normalized.trainingPlan = sanitizeTrainingPlan(passenger.trainingPlan, isTrainingMission);
        if (isTrainingMission) {
            normalized.roleProfile = 'instructor_calm_precise_v1';
            normalized.taskDomain = 'training';
        } else if (isAptCharterMission) {
            normalized.roleProfile = 'charter_professional_neutral_v1';
            normalized.taskDomain = 'charter';
        }
        if (normalized.trainingPlan) {
            normalized.targetAltFt = 0;
            normalized.targetRadiusNm = 0;
            normalized.targetDwellMin = 0;
        }
        if (isAptCharterMission) {
            const charter = buildCharterPassenger(normalized);
            charter.trainingPlan = null;
            return charter;
        }
        return normalized;
    };
    const stripPilotNameFromText = (text) => {
        const s = String(text || '').trim();
        if (!s) return s;
        return s
            .replace(/\b(Moin|Morgen|Hallo|Hi|Hey|Servus|Sali)\s*,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/g, '$1')
            .replace(/\bdanke\s+fuers\s+mitnehmen,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/gi, 'danke fuers Mitnehmen')
            .replace(/\bdanke\s+fürs\s+mitnehmen,\s*[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/gi, 'danke fürs Mitnehmen')
            .replace(/\bmit\s+[A-ZÄÖÜ][a-zäöüß'-]{2,}\s+raus\b/g, 'mit dir raus')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };
    const sanitizeMissionPayloadText = (payload) => {
        if (!payload || typeof payload !== 'object') return payload;
        const p = { ...payload };
        p.story = stripPilotNameFromText(p.story || '');
        if (p.passenger && typeof p.passenger === 'object') {
            p.passenger = { ...p.passenger };
            p.passenger.greetingText = stripPilotNameFromText(p.passenger.greetingText || '');
        }
        return p;
    };
    const enforceTrainingInstructorPayload = (payload) => {
        if (!isTrainingMission || !payload || typeof payload !== 'object') return payload;
        const normalized = { ...payload };
        normalized.pax = '1 PAX (Instruktor)';
        if (!normalized.cargo || /kein cargo|none|0 lbs/i.test(String(normalized.cargo))) {
            normalized.cargo = 'Trainingsunterlagen (10 lbs)';
        }
        const aiPassenger = (normalized.passenger && typeof normalized.passenger === 'object') ? normalized.passenger : {};
        const personaPassenger = buildInstructorPassenger(aiPassenger.trainingPlan || null);
        normalized.passenger = {
            ...personaPassenger,
            // KI-Trainingsplan bevorzugen, damit Aufgabeninhalt erhalten bleibt.
            trainingPlan: sanitizeTrainingPlan(aiPassenger.trainingPlan || personaPassenger.trainingPlan, true),
            // Komfortwerte aus KI optional übernehmen, ansonsten Persona-Defaults.
            gTolerance: String(aiPassenger.gTolerance || personaPassenger.gTolerance || 'mittel').toLowerCase(),
            bankTolerance: String(aiPassenger.bankTolerance || personaPassenger.bankTolerance || 'mittel').toLowerCase(),
            cargoSensitivity: String(aiPassenger.cargoSensitivity || personaPassenger.cargoSensitivity || 'niedrig').toLowerCase(),
            stomachSensitivity: String(aiPassenger.stomachSensitivity || personaPassenger.stomachSensitivity || 'mittel').toLowerCase(),
            comfortPriority: String(aiPassenger.comfortPriority || personaPassenger.comfortPriority || 'mittel').toLowerCase(),
            roleProfile: 'instructor_calm_precise_v1',
            taskDomain: 'training'
        };
        return normalized;
    };
    const enforceCharterPayload = (payload) => {
        if (!isAptCharterMission || !payload || typeof payload !== 'object') return payload;
        const normalized = { ...payload };
        normalized.passenger = buildCharterPassenger(normalized.passenger || null);
        if (!normalized.pax || /^\s*0\s*PAX\b/i.test(String(normalized.pax))) {
            normalized.pax = `1 PAX (${normalized.passenger.role})`;
        }
        return normalized;
    };

    const poiAltRule = (isPOI && !isTrainingMission)
        ? (Number.isFinite(poiTerrainFt)
            ? `POI-Einsatzparameter: targetAltFt (MSL) darf NICHT unter ${Math.round(poiTerrainFt + 500)} ft liegen, weil am POI mindestens 500 ft AGL gelten. targetRadiusNm (2 präzise Punkte, 3 Stadtgebiet, 4-5 Landschaft), targetDwellMin (0 Überflug, 1-2 kurz, 3-5 professionell).`
            : "POI-Einsatzparameter: targetAltFt konservativ wählen; niemals so niedrig, dass es unter 500 ft AGL wäre. targetRadiusNm (2 präzise Punkte, 3 Stadtgebiet, 4-5 Landschaft), targetDwellMin (0 Überflug, 1-2 kurz, 3-5 professionell).")
        : "A-B-REGEL: Kein POI-Arbeitsauftrag. targetAltFt MUSS 0 sein, targetRadiusNm MUSS 0 sein, targetDwellMin MUSS 0 sein.";

    const trainingHardRules = isTrainingMission
        ? `10. TRAININGSFLUG-PFLICHT: Das ist ein klarer Trainingsflug mit Fluglehrer.${isPoiTrainingMission ? ` POI liegt im platznahen Übungsgebiet bei ${startName}, am Ende wieder Landung in ${startName}.` : ' Keine Charter-, Cargo- oder POI-Sightseeing-Story.'}
    11. TRAININGSINHALT MUSS KONKRET SEIN:
       - Wähle mode: "airwork" ODER "pattern".
       - Bei mode "airwork": Übungen in der Luft, z.B. Stall-Training, Steep Turns/Vollkreis, Slow Flight, Navigationsaufgabe.
         trigger MUSS "half_route" sein (Instruktor meldet sich auf halber Strecke).
       - Bei mode "pattern": Übungen platznah im Anflug/Platzrunde, z.B. Engine-Out-Approach, No-Flaps, Extra-Platzrunden, Touch-and-Go, Missed Approach.
         trigger MUSS "five_nm_before_landing" sein (Instruktor meldet sich 5 NM vor Ziel).
         Wichtig: Die eigentliche Landung erfolgt ERST nach Abschluss der Übung am Platz.
       - Gib 2-4 konkrete Übungen in "focus" an (keine Dubletten).
       - Verteile sinnvoll:
         * Option A: nur Airwork (z.B. 2 reine Airwork-Uebungen)
         * Option B: Mix aus Airwork + genau 1 Landeuebung (z.B. 3 Uebungen: 2 Airwork, 1 Pattern/Landung)
       - Gib dazu eine kurze Instruktor-Ansage in "instructorLine".
    12. TRAININGS-PAX: Es MUSS genau EIN Passagier mitfliegen: der Instruktor / die Instruktorin. pax MUSS "1 PAX (Instruktor)" oder gleichwertig sein.
        Der passenger darf NICHT null sein und role MUSS klar Instructor/Fluglehrer sein.
        Variiere das Geschlecht gelegentlich (auch Fluglehrerin).
        cargo nur unkritisch (z.B. "Trainingsunterlagen"), kein echter Frachtauftrag.`
        : `10. KEIN TRAININGSDRIFT: Falls es kein Trainingsflug ist, darf KEIN Trainingsauftrag mit Fluglehrer, Übungen, Platzrunden-Drills oder Checkflug-Inhalten erzeugt werden.`;
    const poiNoTrainingRule = (isPOI && !isTrainingMission)
        ? `13. POI-GUARDRAIL: Bei POI-Missionen sind Trainingsinhalte strikt verboten (kein Instructor, keine Airwork-/Platzrunden-Aufgaben).`
        : '';
    const promptDestName = isPoiTrainingMission ? `Übungsgebiet nahe ${startName}` : destName;
    const localKnowledgeRule = isPoiTrainingMission
        ? `4. FOKUS-REGEL TRAINING: Kein Ortswissen, keine Sehenswürdigkeiten, keine Geschichte zum Punkt. Fokus nur auf Übungsthema, Verfahren, Luftraum, Maschine und Sicherheit.`
        : `4. LOKALES WISSEN: Baue 1-2 echte geografische, infrastrukturelle oder kulturelle Fakten zu "${promptDestName}" ganz natürlich ein.`;

    const prompt = `Du bist ein freundlicher, entspannter Flugdienstleiter in einem lokalen Fliegerclub oder kleinen Charterunternehmen.
    Erstelle ein realistisches Einsatzbriefing für diesen Flug:
    Start: ${startName}
    Ziel: ${promptDestName} ${isPOI ? '(POI / Wendepunkt)' : '(Zielflughafen)'}
    Distanz (Gesamt): ${dist} NM

    WICHTIGE REGELN:
    1. Antworte IMMER auf Deutsch.
    2. TONFALL: Entspannt, kumpelhaft und alltäglich. Keine übertriebene Dramatik, keine Actionfilm-Rhetorik! Fliegen ist Routine und macht Spaß.
    3. THEMA VORGEGEBEN: Dein Auftrag MUSS sich zwingend um dieses Thema drehen: "${randomTheme}".
    ${localKnowledgeRule}
    ${categoryRule}
    ${isPOI ? `5. RUNDFLUG-REGELN: Start und Landung ist ${startName}. Am POI (${promptDestName}) wird NICHT gelandet.` : `5. ROUTEN-REGELN: Normaler Streckenflug von ${startName} nach ${promptDestName}.`}
    6. PASSAGIERE & FRACHT: Erfinde passend zur Mission, WER mitfliegt (maximal ${maxPaxLimit} Personen) und WAS transportiert wird. Wenn niemand mitfliegt, schreibe '0 PAX'.
    7. PASSAGIER-CHARAKTER: Erfinde EINEN Hauptpassagier passend zur Mission.${isTrainingMission ? ' Bei Trainingsflug IMMER der Instruktor (nicht null).' : ' (oder null bei 0 PAX).'} greetingText: persönliche Begrüßung an den Piloten beim Motorstart (1-2 Sätze). gTolerance / bankTolerance: 'niedrig' | 'mittel' | 'hoch'.
       Zusätzlich (datengetrieben, aus Rollen-/Auftragskontext ableiten):
       - cargoSensitivity: wie empfindlich reagiert der Passagier auf Bewegung in Bezug auf die Fracht? ('niedrig'|'mittel'|'hoch')
       - stomachSensitivity: wie empfindlich ist der Passagier gegenüber Turbulenz/Manövern? ('niedrig'|'mittel'|'hoch')
       - comfortPriority: wie wichtig ist insgesamt ruhiges Fliegen in dieser Mission? ('niedrig'|'mittel'|'hoch')
       - roleProfile: Wähle GENAU einen Wert aus dieser Liste:
         ["general_passenger_v1","instructor_calm_precise_v1","charter_professional_neutral_v1","technical_inspector_v1","media_observer_v1","science_field_v1","vip_business_v1","club_utility_v1","medical_sensitive_v1","news_reporter_professional_v1","tour_guide_relaxed_v1","photogrammetry_precision_v1","cargo_fragile_highcare_v1","rescue_coordination_v1","fire_observer_ops_v1","club_student_v1"]
       - taskDomain: Wähle GENAU einen Wert aus dieser Liste:
         ["general","training","charter","inspection_infra","media_photo","science_bio","science_geo","science_general","club_utility","medical_transfer","news_coverage","sightseeing_tour","mapping_survey","cargo_fragile","search_and_rescue","fire_watch","animal_transport","club_training_basic","club_training_advanced"]
       Nutze dafür den vollen Kontext (Rolle, Auftrag, Art der Fracht, Wetter, Missionsziel), keine starre Liste. ${poiAltRule}
    8. AKTUELLES WETTER (als Realitätsanker einbauen, aber ohne überdramatisieren):
       Start (${startName}): ${_summarizeMissionWeather(missionWeather?.dep || null)}
       Ziel (${promptDestName}): ${_summarizeMissionWeather(missionWeather?.dest || null)}
    9. SPRACHSTIL PASSAGIER: Lege optional "dialectHint" fest:
       - "neutral" für normales Deutsch
       - oder leichte regionale Färbung (z.B. "leicht schwäbisch", "leicht bayrisch", "leicht norddeutsch"), wenn es zur Person passt.
       Wichtig: nie starker Dialekt, immer verständlich.
    9b. NAMENS-REGEL: Keine zusätzlichen Eigennamen im Briefing erfinden. Sprich den Piloten nur als "du" an, nie mit Namen.
    ${trainingHardRules}
    ${poiNoTrainingRule}
    ${forcedProfileRule}

    Antworte AUSSCHLIESSLICH als JSON. Keine Markdown-Formatierung.
    Struktur: {
        "title": "Kreativer Titel",
        "story": "Das Briefing (max 3-4 Sätze, lockerer Ton)",
        "pax": "z.B. '2 PAX (Fotograf & Assistent)' oder '0 PAX'",
        "cargo": "z.B. 'Kamera-Gimbal (80 lbs)' oder 'Reisegepäck (40 lbs)'",
        "passenger": { "name": "Vollständiger Name", "role": "Beruf/Rolle", "gender": "male|female", "personality": "3 Adjektive", "dialectHint": "neutral oder leicht regional", "roleProfile": "aus erlaubter Liste", "taskDomain": "aus erlaubter Liste", "gTolerance": "niedrig|mittel|hoch", "bankTolerance": "niedrig|mittel|hoch", "cargoSensitivity": "niedrig|mittel|hoch", "stomachSensitivity": "niedrig|mittel|hoch", "comfortPriority": "niedrig|mittel|hoch", "targetAltFt": 3500, "targetRadiusNm": 3.0, "targetDwellMin": 2, "greetingText": "Persönliche Begrüßung an den Piloten", "trainingPlan": { "mode": "airwork|pattern", "trigger": "half_route|five_nm_before_landing", "focus": ["Übung 1", "Übung 2"], "instructorLine": "Kurze konkrete Instruktoranweisung" } }
    }`;

    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } };
    const reqOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    try {
        const resFlash3 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, reqOptions);
        if (resFlash3.ok) {
            const data = await resFlash3.json();
            const parsed = sanitizeMissionPayloadText(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text))));
            incrementApiUsage('flash');
            return { t: parsed.title, s: parsed.story, pax: parsed.pax, cargo: parsed.cargo, passenger: sanitizePassengerProfile(parsed.passenger, parsed.story), i: "📋", cat: targetMissionCat, _source: "Gemini 3.0 Flash" };
        }
    } catch (e) { }

    try {
        const resFlash = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, reqOptions);
        if (resFlash.ok) {
            const data = await resFlash.json();
            const parsed = sanitizeMissionPayloadText(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text))));
            incrementApiUsage('flash');
            return { t: parsed.title, s: parsed.story, pax: parsed.pax, cargo: parsed.cargo, passenger: sanitizePassengerProfile(parsed.passenger, parsed.story), i: "📋", cat: targetMissionCat, _source: "Gemini 2.5 Flash" };
        }
    } catch (e) { }

    try {
        const resLite = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, reqOptions);
        if (resLite.ok) {
            const data = await resLite.json();
            const parsed = sanitizeMissionPayloadText(enforceCharterPayload(enforceTrainingInstructorPayload(JSON.parse(data.candidates[0].content.parts[0].text))));
            incrementApiUsage('lite');
            return { t: parsed.title, s: parsed.story, pax: parsed.pax, cargo: parsed.cargo, passenger: sanitizePassengerProfile(parsed.passenger, parsed.story), i: "📋", cat: targetMissionCat, _source: "Gemini 2.5 Flash Lite" };
        }
    } catch (e) { }
    return null;
}

/* =========================================================
   6. HAUPT-LOGIK & ZÄHLER
   ========================================================= */
function getQuotaDay() {
    const now = new Date();
    if (now.getHours() < 9) now.setDate(now.getDate() - 1);
    return now.toISOString().split('T')[0];
}

function getApiUsage() {
    const today = getQuotaDay();
    let data = JSON.parse(localStorage.getItem('ga_api_fuel'));

    if (!data || data.date !== today || data.flash === undefined) {
        data = { date: today, flash: 0, lite: 0 };
        localStorage.setItem('ga_api_fuel', JSON.stringify(data));
    }
    return data;
}

function incrementApiUsage(modelType) {
    const today = getQuotaDay();
    let data = getApiUsage();
    if (modelType === 'flash') data.flash++;
    else if (modelType === 'lite') data.lite++;
    localStorage.setItem('ga_api_fuel', JSON.stringify({ date: today, flash: data.flash, lite: data.lite }));
    updateApiFuelMeter();
}

function updateApiFuelMeter() {
    const needle = document.getElementById('apiNeedle');
    if (!needle) return;
    const data = getApiUsage();
    let used = data.flash + data.lite;
    const maxCalls = 40;

    if (used > maxCalls) used = maxCalls;
    let percentage = used / maxCalls;

    let angle = 45 - (percentage * 90);
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
}

async function fetchAirportFreq(icao, elementId, type) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = '📻 Sucht Frequenz...';
    const proxy = 'https://ga-proxy.einherjer.workers.dev';
    const icaoQuery = String(icao || '').trim().toUpperCase();

    const freqLabelMap = {
        'TWR': 'Turm', 'TOWER': 'Turm',
        'GND': 'Rollkontrolle', 'GROUND': 'Rollkontrolle',
        'ATIS': 'Information', 'INFO': 'Information',
        'RADIO': 'Radio', 'CTAF': 'Radio', 'UNICOM': 'Radio', 'MULTICOM': 'Radio',
        'APP': 'Anflug', 'APPROACH': 'Anflug',
        'DEP': 'Abflug', 'DEPARTURE': 'Abflug',
        'FIS': 'FIS', 'APRON': 'Vorfeld', 'AWOS': 'AWOS'
    };

    try {
        const res = await fetch(`${proxy}/api/airports?search=${encodeURIComponent(icaoQuery)}&limit=25&t=${Date.now()}`);
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
            const items = Array.isArray(data.items) ? data.items : [];
            const pickIcao = (apt) => String(
                apt?.icao ||
                apt?.icaoCode ||
                apt?.ident ||
                apt?.code ||
                apt?.designator ||
                apt?.gpsCode ||
                apt?.localCode ||
                ''
            ).trim().toUpperCase();
            const exact = items.find(apt => pickIcao(apt) === icaoQuery);
            // Für 4-stellige ICAO-Abfragen nur exakte Treffer zulassen
            const strictIcaoSearch = /^[A-Z0-9]{4}$/.test(icaoQuery);
            const apt = exact || (!strictIcaoSearch ? items[0] : null);
            if (!apt) {
                if (el) el.innerText = '';
                freqCache[icaoQuery] = [];
                return null;
            }

            // Elevation aus OpenAIP (unit 0 = Meter, 1 = Fuß)
            if (apt.elevation != null) {
                const ev = apt.elevation.value;
                const elevFt = apt.elevation.unit === 1 ? ev : Math.round(ev * 3.28084);
                if (type === 'dep')  { currentDepElev  = elevFt; }
                if (type === 'dest') { currentDestElev = elevFt; }
            }

            if (apt.frequencies && apt.frequencies.length > 0) {

                // Bestimme die relevanteste Frequenz (Tower > Info > Radio)
                const prio = { 'TOWER': 1, 'TWR': 1, 'INFO': 2, 'INFORMATION': 2, 'ATIS': 2, 'RADIO': 3, 'CTAF': 3, 'UNICOM': 3, 'MULTICOM': 3, 'APP': 4, 'APPROACH': 4 };
                let bestF = apt.frequencies[0];
                let bestScore = 99;
                apt.frequencies.forEach(f => {
                    const n = (f.name || '').toUpperCase().trim();
                    const score = prio[n] || 99;
                    if (score < bestScore) { bestScore = score; bestF = f; }
                });

                // Speichere NUR den Zahlenwert für die Routen-Tabelle
                const bestFreqValue = bestF.value;
                if (type === 'dep') currentDepFreq = bestFreqValue;
                if (type === 'dest') currentDestFreq = bestFreqValue;

                updateRoutePerformance();

                // Für die Detail-Anzeige auf der Karte alle formatieren
                const labeledFreqs = apt.frequencies.map(f => {
                    const fName = (f.name || '').toUpperCase().trim();
                    const label = freqLabelMap[fName] || f.name || 'Freq';
                    return { label: label, value: f.value };
                });
                const lines = labeledFreqs.map(lf => `📻 ${lf.label}: ${lf.value}`);
                if (el) el.innerHTML = lines.join('<br>');

                freqCache[icaoQuery] = labeledFreqs;
                return bestFreqValue;
            }
        }
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    } catch (e) {
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    }
    return null;
}

/* =========================================================
   OPENAIP AIRSPACE LOGIC
   ========================================================= */
let activeAirspaces = [];
let airspaceMapLayers = [];
let highlightedAirspaceIdx = -1; // track which airspace is toggled on
let vpHighlightPulseIdx = -1; // airspace index pulsing in profile canvas
let vpPulseAnimFrame = null; // requestAnimationFrame ID
let vpPulsePhase = 0; // 0..1 for pulse animation
const _airspaceFreqFallbackInFlight = new Set();

function vpStartHighlightPulse() {
    vpStopHighlightPulse();
    vpPulsePhase = 0.25; // Startet direkt mit voller Leuchtkraft

    function toggleBlink() {
        vpPulsePhase = (vpPulsePhase === 0.25) ? 0 : 0.25; // Wechselt zwischen 0 und 0.25 (an/aus)
        if (typeof renderMapProfile === 'function') renderMapProfile();
        if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
    }

    toggleBlink(); // Sofortiges erstes Rendern
    vpPulseAnimFrame = setInterval(toggleBlink, 700); // Alle 700ms entspannt umschalten statt 60x pro Sekunde
}

function vpStopHighlightPulse() {
    if (vpPulseAnimFrame) {
        clearInterval(vpPulseAnimFrame);
        vpPulseAnimFrame = null;
    }
    vpPulsePhase = 0;
}

function clearAirspaceMapLayers() {
    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    highlightedAirspaceIdx = -1;
    vpHighlightPulseIdx = -1;
    vpStopHighlightPulse();
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));
    if (typeof renderMapProfile === 'function') renderMapProfile();
    if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
}

function toggleAirspaceHighlight(idx) {
    if (!activeAirspaces[idx]) return;

    // If same airspace is already highlighted, toggle it off
    if (highlightedAirspaceIdx === idx) {
        clearAirspaceMapLayers();
        return;
    }

    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));

    const airspace = activeAirspaces[idx];
    highlightedAirspaceIdx = idx;

    if (map) {
        const coords = airspace.geometry.coordinates;
        let polys = [];
        if (airspace.geometry.type === 'Polygon') {
            polys = [coords[0].map(c => [c[1], c[0]])];
        } else if (airspace.geometry.type === 'MultiPolygon') {
            polys = coords.map(pc => pc[0].map(c => [c[1], c[0]]));
        }
        const info = getAirspaceStyle(airspace);
        polys.forEach(ring => {
            const layer = L.polygon(ring, {
                color: info.mapColor || '#ff4444', weight: 3, fillColor: info.mapColor || '#ff4444',
                fillOpacity: 0.25, dashArray: '6,4', className: 'airspace-highlight-pulse'
            }).addTo(map);
            const displayName = getAirspaceDisplayName(airspace);
            layer.bindTooltip(`<b>${info.icon} ${displayName}</b>`, { sticky: true, className: 'airspace-tooltip' });
            airspaceMapLayers.push(layer);
        });
    }

    const row = document.querySelector(`.as-row[data-as-idx="${idx}"]`);
    if (row) row.classList.add('as-active');

    vpHighlightPulseIdx = idx;
    vpStartHighlightPulse();
}

// Erkennt Fallschirmsprunggebiete an Namen wie "PARA SCHWENNINGEN", "PARA ROTTWEIL"
function isParaAirspace(a) {
    return /\bPARA\b/i.test(a.name || '');
}

function getAirspaceDisplayName(a) {
    const style = getAirspaceStyle(a);
    let name = a.name || 'Unbekannt';
    // Entferne überflüssige Begriffe, ABER behalte die Klassen-Buchstaben (wie C oder D) bei!
    name = name.replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS)\b/ig, '');
    if (isParaAirspace(a)) name = name.replace(/\bPARA\b/ig, '').trim();
    return `${name.trim()} [${style.category}]`;
}

function normalizeAirspaceNameForFreq(name) {
    return String(name || '')
        .toUpperCase()
        .replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS|HX)\b/g, ' ')
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function inferAirspaceLimitIsAgl(as, lim, boundary) {
    if (!as || !lim) return false;
    if (lim.referenceDatum === 0) return true;
    if (lim.referenceDatum !== 1) return false;

    const t = as.type;
    const isTypicalLowAirspace = [0, 4, 5, 6, 7, 26, 27, 28].includes(t);
    if (!isTypicalLowAirspace) return false;

    const value = Number(lim.value);
    if (!Number.isFinite(value)) return false;

    // OpenAIP liefert "GND" vereinzelt als 0 FT MSL statt 0 FT AGL.
    if (boundary === 'lower' && value === 0) return true;

    // Obergrenze nur bei TMZ/RMZ heuristisch auf AGL drehen.
    // Für CTR/TMA/CTA nie auto-AGL, sonst werden legitime MSL-Decken verfälscht.
    if (boundary === 'upper' && lim.unit !== 6 && value > 0) {
        const canAutoUpperAgl = [5, 6, 27, 28].includes(t);
        if (!canAutoUpperAgl) return false;
        const lower = as.lowerLimit || null;
        const lowerLooksGnd = !!lower && Number(lower.value) === 0 && (lower.referenceDatum === 0 || lower.referenceDatum === 1);
        const upperFt = lim.unit === 1 ? value : (lim.unit === 0 ? value * 3.28084 : value);
        if (lowerLooksGnd && upperFt <= 4000) return true;
    }

    return false;
}

function applyAirspaceLimitHeuristics(as) {
    if (!as) return;
    const lowerIsAgl = inferAirspaceLimitIsAgl(as, as.lowerLimit, 'lower');
    const upperIsAgl = inferAirspaceLimitIsAgl(as, as.upperLimit, 'upper');
    as._lowerIsAgl = !!lowerIsAgl;
    as._upperIsAgl = !!upperIsAgl;
    if (as.lowerLimit && lowerIsAgl) as.lowerLimit.referenceDatum = 0;
    if (as.upperLimit && upperIsAgl) as.upperLimit.referenceDatum = 0;
}

function getAirspaceApproxCenter(as) {
    if (!as?.geometry) return null;
    const pts = [];
    if (as.geometry.type === 'Polygon' && Array.isArray(as.geometry.coordinates?.[0])) {
        as.geometry.coordinates[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
    } else if (as.geometry.type === 'MultiPolygon') {
        as.geometry.coordinates.forEach(poly => {
            if (Array.isArray(poly?.[0])) poly[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
        });
    }
    if (!pts.length) return null;
    let sumLon = 0, sumLat = 0;
    pts.forEach(p => { sumLon += Number(p[0]) || 0; sumLat += Number(p[1]) || 0; });
    return { lon: sumLon / pts.length, lat: sumLat / pts.length };
}

function approxNmBetween(lat1, lon1, lat2, lon2) {
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
    const meanLatRad = ((lat1 + lat2) * 0.5) * Math.PI / 180;
    const dLatNm = (lat2 - lat1) * 60;
    const dLonNm = (lon2 - lon1) * 60 * Math.cos(meanLatRad);
    return Math.hypot(dLatNm, dLonNm);
}

function toAirspaceFreqList(freqEntries) {
    if (!Array.isArray(freqEntries)) return [];
    return freqEntries
        .filter(f => f && f.value)
        .map(f => ({ name: f.name || f.label || 'INFO', value: f.value, primary: !!f.primary }));
}

function getAirportFrequencyFallbackByIcao(icao) {
    const code = String(icao || '').trim().toUpperCase();
    if (!code) return [];
    const cached = freqCache?.[code];
    return toAirspaceFreqList(cached);
}

function pickAirportForAirspaceFallback(as) {
    if (!as || !globalAirports) return null;
    const center = getAirspaceApproxCenter(as);
    const asNorm = normalizeAirspaceNameForFreq(as.name);
    const tokens = asNorm.split(' ').filter(t => t.length >= 4);
    if (!tokens.length && !center) return null;

    let best = null;
    let bestScore = Infinity;

    for (const key in globalAirports) {
        const apt = globalAirports[key];
        const icao = String(apt?.icao || key || '').trim().toUpperCase();
        if (!icao) continue;

        const aptNorm = normalizeAirspaceNameForFreq(`${apt.name || ''} ${apt.city || ''} ${icao}`);
        const nameHit = tokens.length ? tokens.some(t => aptNorm.includes(t) || asNorm.includes(icao)) : true;
        if (!nameHit) continue;

        let distScore = 0;
        if (center && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
            const nm = approxNmBetween(center.lat, center.lon, Number(apt.lat), Number(apt.lon));
            if (!Number.isFinite(nm) || nm > 40) continue;
            distScore = nm;
        }

        const score = distScore;
        if (score < bestScore) {
            bestScore = score;
            best = { icao, apt };
        }
    }
    return best;
}

function pickPreferredAirspaceFrequency(freqs, airspaceType) {
    if (!Array.isArray(freqs) || freqs.length === 0) return null;
    const list = freqs.filter(f => f && f.value);
    if (!list.length) return null;

    const wantsTowerLike = [4, 7, 26].includes(airspaceType) || airspaceType === 0;
    if (wantsTowerLike) {
        const towerRx = /\b(TWR|TOWER|TURM)\b/i;
        const appRx = /\b(APP|APPROACH|ANFLUG)\b/i;
        const infoRx = /\b(INFO|INFORMATION|RADIO)\b/i;
        return list.find(f => towerRx.test(f.name || ''))
            || list.find(f => appRx.test(f.name || ''))
            || list.find(f => infoRx.test(f.name || ''))
            || list.find(f => f.primary)
            || list[0];
    }

    return list.find(f => f.primary) || list[0];
}

function getAirspaceFreqInfo(a) {
    const t = a.type;
    if (!a.frequencies || a.frequencies.length === 0) return '';

    // For CTR/TMA/CTA (type 4, 7, 26) and type 0 with icaoClass 3: show Tower/Approach freq
    if ([4, 7, 26].includes(t) || (t === 0 && a.icaoClass === 3)) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            const label = primary.name || 'TWR';
            return `<span style="color:#f2c12e; font-weight:bold; font-size:10px;">📻 ${label}: ${primary.value}</span>`;
        }
    }

    // For TMZ (type 5 or 27): show squawk if available, otherwise freq
    if (t === 5 || t === 27) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            return `<span style="color:#9966ff; font-weight:bold; font-size:10px;">📻 ${primary.name || 'XPDR'}: ${primary.value}</span>`;
        }
    }
    // For RMZ (type 6 or 28) and FIS (type 33): show freq
    // Para-Zonen (PARA-RMZ): orangene Farbe + 🪂 Icon
    if ([6, 28, 33].includes(t)) {
        const primary = pickPreferredAirspaceFrequency(a.frequencies, t);
        if (primary) {
            const isPara = isParaAirspace(a);
            const col  = isPara ? '#ffaa00' : '#66cccc';
            const icon = isPara ? '🪂' : '📻';
            return `<span style="color:${col}; font-weight:bold; font-size:10px;">${icon} ${primary.name || 'INFO'}: ${primary.value}</span>`;
        }
    }

    return '';
}

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
    if ((t === 6 || t === 28) && isParaAirspace(a)) return { color: '#ffaa00', icon: '🪂', mapColor: '#ffaa00', category: 'Para' };
    if (t === 6 || t === 28) return { color: '#66cccc', icon: '📡', mapColor: '#66cccc', category: 'RMZ' };
    if (t === 33) return { color: '#888', icon: '🌐', mapColor: '#888', category: 'FIS' };
    
    return { color: '#aaa', icon: '📋', mapColor: '#aaa', category: `Type ${t}` };
}

async function fetchRouteAirspaces(routePts) {
    const listEl = document.getElementById('routeAirspacesList');
    const container = document.getElementById('routeAirspacesContainer');

    if (!routePts || routePts.length < 2) return;

    if (container) {
        container.style.display = 'block';
        listEl.innerHTML = '<span style="color:#888;">Berechne Lufträume (OpenAIP)...</span>';
    }

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    routePts.forEach(p => {
        let lat = p.lat, lon = p.lng || p.lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    });

    minLat -= 0.15; maxLat += 0.15;
    minLon -= 0.25; maxLon += 0.25;

    try {
        let allItems = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages && page <= 5) {
            const url = `https://ga-proxy.einherjer.workers.dev/api/airspaces?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=200&page=${page}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            if (!data || !data.items) break;
            allItems = allItems.concat(data.items);
            totalPages = data.totalPages || 1;
            page++;
        }

        if (allItems.length === 0) {
            listEl.innerHTML = '<span style="color:#888;">Keine Daten gefunden.</span>';
            return;
        }

        const airspaces = allItems;
        const intersecting = [];

        const testPoints = [];
        for (let i = 0; i < routePts.length - 1; i++) {
            const p1 = routePts[i], p2 = routePts[i + 1];
            const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
            const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
            const dist = calcNav(lat1, lon1, lat2, lon2).dist;

            const steps = Math.max(2, Math.ceil(dist));
            for (let j = 0; j <= steps; j++) {
                const f = j / steps;
                testPoints.push({ lat: lat1 + (lat2 - lat1) * f, lon: lon1 + (lon2 - lon1) * f });
            }
        }

        function pointInPolygon(pt, polygon) {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i][0], yi = polygon[i][1];
                const xj = polygon[j][0], yj = polygon[j][1];
                const intersect = ((yi > pt.lat) !== (yj > pt.lat))
                    && (pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        // Segment-segment intersection (for catching small airspaces between sample points)
        function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
            const d1x = x2-x1, d1y = y2-y1, d2x = x4-x3, d2y = y4-y3;
            const cross = d1x*d2y - d1y*d2x;
            if (Math.abs(cross) < 1e-12) return false;
            const t = ((x3-x1)*d2y - (y3-y1)*d2x) / cross;
            const u = ((x3-x1)*d1y - (y3-y1)*d1x) / cross;
            return t >= 0 && t <= 1 && u >= 0 && u <= 1;
        }
        function routeCrossesPolygon(polygon) {
            for (let i = 0; i < routePts.length - 1; i++) {
                const p1 = routePts[i], p2 = routePts[i + 1];
                const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
                const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
                if (pointInPolygon({lat: lat1, lon: lon1}, polygon)) return true;
                if (pointInPolygon({lat: lat2, lon: lon2}, polygon)) return true;
                for (let j = 0, k = polygon.length - 1; j < polygon.length; k = j++) {
                    if (segmentsIntersect(lon1, lat1, lon2, lat2, polygon[k][0], polygon[k][1], polygon[j][0], polygon[j][1])) return true;
                }
            }
            return false;
        }

        // Relevant: 0 (CTR HX sectors), 1 (ED-R), 2 (Danger), 3 (Prohibited),
        // 4 (CTR), 5 (TMZ), 6 (RMZ alt code), 7 (TMA), 26 (CTA), 27 (TMZ alt code), 28 (RMZ), 33 (FIS)
        // Excluded: 10 (FIR)
        const relevantTypes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33]);

        const addedIds = new Set();
        for (const as of airspaces) {
            if (addedIds.has(as._id)) continue;
            if (!relevantTypes.has(as.type)) continue;
            // Type 0: Class C (2) und Class D (3) explizit zulassen
            if (as.type === 0 && as.icaoClass !== 2 && as.icaoClass !== 3) continue;

            let hits = false;
            if (as.geometry && as.geometry.type === 'Polygon') {
                hits = routeCrossesPolygon(as.geometry.coordinates[0]);
            } else if (as.geometry && as.geometry.type === 'MultiPolygon') {
                for (const polyContainer of as.geometry.coordinates) {
                    if (routeCrossesPolygon(polyContainer[0])) { hits = true; break; }
                }
            }

            if (hits) {
                intersecting.push(as);
                addedIds.add(as._id);
            }
        }

        const sortOrder = { 3: 1, 1: 2, 2: 3, 4: 4, 0: 5, 5: 8, 7: 6, 26: 7, 27: 8, 6: 9, 28: 9, 33: 10 };
        intersecting.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99));

        // Deduplicate by name: type 0 (icaoClass 3) and type 4 often represent the same CTR in OpenAIP
        // Keep type 4, but inherit frequencies from the duplicate if type 4 has none
        const byName = new Map();
        for (const as of intersecting) {
            // Deduplizierungs-Key:
            // • Typ 0 / Typ 4 (Airspace/CTR): Name + Klasse + untere Grenze — fasst OpenAIP-Duplikate
            //   desselben CTRs zusammen (type 0 ↔ type 4 mit gleichen Grenzen).
            // • Alle anderen Typen (TMA, TMZ, RMZ …): _id verwenden — jeder Sektor bleibt erhalten,
            //   auch wenn mehrere Sektoren denselben Namen tragen (z.B. Stuttgart TMA Außenring Nord/Süd).
            const lowerVal = (as.lowerLimit && as.lowerLimit.value !== undefined) ? as.lowerLimit.value : 0;
            const isCtrlDup = (as.type === 0 || as.type === 4);
            const key = isCtrlDup
                ? (as.name || as._id) + '_' + (as.icaoClass || as.type) + '_' + lowerVal
                : (as._id || (as.name || 'x') + '_' + (as.icaoClass || as.type) + '_' + lowerVal);
            if (!byName.has(key)) {
                byName.set(key, as);
            } else {
                const existing = byName.get(key);
                if (as.type === 4 && existing.type !== 4) {
                    if ((!as.frequencies || as.frequencies.length === 0) && existing.frequencies?.length > 0)
                        as.frequencies = existing.frequencies;
                    byName.set(key, as);
                } else if (existing.type === 4 && as.type !== 4) {
                    if ((!existing.frequencies || existing.frequencies.length === 0) && as.frequencies?.length > 0)
                        existing.frequencies = as.frequencies;
                }
            }
        }
        activeAirspaces = [...byName.values()];

        // Zusätzlicher Frequenz-Fallback:
        // Wenn ein CTR/TMA/CTA-Eintrag ohne Frequenz durchrutscht, versuche aus
        // gleich benannten/intersektierenden Sektoren die Frequenzen zu übernehmen.
        const byNormNameWithFreq = new Map();
        for (const src of intersecting) {
            if (!src?.frequencies || src.frequencies.length === 0) continue;
            const norm = normalizeAirspaceNameForFreq(src.name);
            if (!norm) continue;
            if (!byNormNameWithFreq.has(norm)) byNormNameWithFreq.set(norm, src.frequencies);
        }
        activeAirspaces.forEach(as => {
            if (as?.frequencies && as.frequencies.length > 0) return;
            const isCtaCtrFamily = [0, 4, 7, 26].includes(as?.type);
            if (!isCtaCtrFamily) return;
            const norm = normalizeAirspaceNameForFreq(as.name);
            const fallbackFreqs = norm ? byNormNameWithFreq.get(norm) : null;
            if (fallbackFreqs && fallbackFreqs.length > 0) {
                as.frequencies = fallbackFreqs;
            }
        });

        // AGL-/GND-Heuristik auf gematchte Airspaces anwenden.
        activeAirspaces.forEach(as => applyAirspaceLimitHeuristics(as));

        // Zweiter Frequenz-Fallback: CTR/TMA/CTA ohne Frequenz → passender Flugplatz.
        activeAirspaces.forEach(as => {
            if (!as || (as.frequencies && as.frequencies.length > 0)) return;
            if (![0, 4, 7, 26].includes(as.type)) return;

            const pick = pickAirportForAirspaceFallback(as);
            if (!pick?.icao) return;

            const immediate = getAirportFrequencyFallbackByIcao(pick.icao);
            if (immediate.length > 0) {
                as.frequencies = immediate;
                return;
            }

            // Noch nicht im Cache: einmalig nachladen und Liste danach neu rendern.
            if (typeof fetchAirportFreq !== 'function') return;
            if (freqCache[pick.icao] !== undefined) return;
            if (_airspaceFreqFallbackInFlight.has(pick.icao)) return;

            _airspaceFreqFallbackInFlight.add(pick.icao);
            const asId = as._id;
            fetchAirportFreq(pick.icao, null, null)
                .catch(() => null)
                .finally(() => {
                    _airspaceFreqFallbackInFlight.delete(pick.icao);
                    const fetched = getAirportFrequencyFallbackByIcao(pick.icao);
                    if (!fetched.length) return;
                    const target = activeAirspaces.find(a => a && a._id === asId);
                    if (target && (!target.frequencies || target.frequencies.length === 0)) {
                        target.frequencies = fetched;
                    }
                    if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
                });
        });

        window._activeAirspacesVersion = (window._activeAirspacesVersion || 0) + 1;
        clearAirspaceMapLayers();
        renderAirspaceWarningsList();
        if (typeof renderMapProfile === 'function' && typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible) renderMapProfile();
        if (typeof renderVerticalProfile === 'function' && document.getElementById('vpCanvas')) renderVerticalProfile();

    } catch (e) {
        console.error("OpenAIP Error", e);
        listEl.innerHTML = '<span style="color:#d93829;">Fehler beim Laden der Luftraumdaten.</span>';
    }
}

function renderAirspaceWarningsList() {
        // Performance-Fix: Keine schweren DOM-Updates während User-Scroll/Drag!
        if (window.vpIsFastRendering || window.vpUIInteractionActive) return;
        const listEl = document.getElementById('routeAirspacesList');
        if (!listEl) return;

        if (!activeAirspaces || activeAirspaces.length === 0) {
            listEl.innerHTML = '<span style="color:#33ff33;">✅ Route frei – keine Konflikte erkannt.</span>';
            return;
        }

        const filterCheckbox = document.getElementById('navLogAirspaceFilter');
        const filterActive = filterCheckbox && filterCheckbox.checked;

        // FIX: Wir müssen garantieren, dass wir dasselbe Array (Normal oder High-Res Zoom) nutzen wie das visuelle Profil!
        const elevDataToUse = (typeof vpZoomLevel !== 'undefined' && vpZoomLevel < 100 && typeof vpHighResData !== 'undefined' && vpHighResData) ? vpHighResData : vpElevationData;

        let fpResult = null;
        if (filterActive && elevDataToUse && elevDataToUse.length >= 2) {
            const cruiseAlt = parseInt(document.getElementById('altSliderMap')?.value || document.getElementById('altSlider')?.value || 4500);
            const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
            fpResult = computeFlightProfile(elevDataToUse, cruiseAlt, vpClimbRate, vpDescentRate, tas);
        }

        let finalAirspaces = activeAirspaces;

        if (filterActive && fpResult && fpResult.profile) {
            // PERFORMANCE FIX: Kompletten Polygon-Check entfernt! Wir nutzen den bestehenden 2D-Schnittstellen-Cache.
            const totalDist = elevDataToUse[elevDataToUse.length - 1].distNM;
            const cachedAirspaces = getCachedAirspaceIntersections(elevDataToUse, totalDist);

        finalAirspaces = activeAirspaces.filter(a => {
            // 1. Ist der Luftraum überhaupt im 2D-Cache? (Wenn nicht, überfliegen wir ihn in 2D gar nicht)
            const cached = cachedAirspaces.find(ca => ca.as === a);
            if (!cached) return false; 

            // 2. Hat der Luftraum gültige Höhengrenzen?
            if (cached.lowerFt === null || cached.upperFt === null) return true;

            let intersects = false;
            
            // 3. Prüfe NUR die paar Wegpunkte, die in 2D bereits als "innerhalb des Luftraums" markiert wurden!
            for (const pt of cached.relevantPts) {
                // Finde die Flughöhe an diesem spezifischen Punkt
                const pp = fpResult.profile.find(profPt => profPt.distNM === pt.distNM);
                if (!pp) continue;
                
                const realLower = cached.isLowerAgl ? pt.elevFt + cached.lowerFt : cached.lowerFt;
                const realUpper = cached.isUpperAgl ? pt.elevFt + cached.upperFt : cached.upperFt;
                
                // Wenn unsere Flug-Linie zwischen Boden und Decke des Luftraums liegt -> Konflikt!
                if (pp.altFt >= realLower && pp.altFt <= realUpper) {
                    intersects = true; 
                    break;
                }
            }
            return intersects;
        });
    }

    if (finalAirspaces.length === 0) {
        listEl.innerHTML = '<span style="color:#33ff33;">✅ Route auf dieser Flughöhe frei.</span>';
        return;
    }

    let html = '';
    finalAirspaces.forEach((a) => {
        const idx = activeAirspaces.indexOf(a); // Keep original idx for map toggling
        const style = getAirspaceStyle(a);
        const displayName = getAirspaceDisplayName(a);
        const freqInfo = getAirspaceFreqInfo(a);

        let limitStr = '';
        const fmtLmt = (lim) => {
            if (!lim) return '?';
            if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
            if (lim.unit === 6) return `FL ${lim.value}`;
            let u = lim.unit === 1 ? 'FT' : (lim.unit === 6 ? 'FL ' : 'M');
            let r = lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '');
            return `${lim.value} ${u}${r}`;
        };

        if (a.lowerLimit && a.upperLimit) {
            limitStr = `<span style="color:#555; font-size:9px; white-space:nowrap;">[${fmtLmt(a.lowerLimit)} – ${fmtLmt(a.upperLimit)}]</span>`;
        }

        const catLabel = `<span style="font-size:9px; color:#888;">${style.category}</span>`;
        const freqLine = freqInfo ? `<div style="margin-top:1px;">${freqInfo}</div>` : '';

        html += `<div class="as-row" data-as-idx="${idx}" 
                    onclick="toggleAirspaceHighlight(${idx}); event.stopPropagation();"
                    style="padding: 5px 4px; border-bottom: 1px dashed #bbb; cursor:pointer; transition: background 0.15s;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span style="color:${style.color}; line-height:1.3;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${style.color}; margin-right:4px; vertical-align:middle;"></span>${style.icon} <b>${displayName}</b>
                            <span style="margin-left:4px;">${catLabel}</span>
                        </span>
                        ${limitStr}
                    </div>
                    ${freqLine}
                </div>`;
    });
    listEl.innerHTML = html;
}

async function generateMission() {
    const dispatchRunId = _startDispatchRun();
    let _dispatchDeferredFinalize = false;
    const _ensureDispatchAlive = () => {
        if (_isDispatchRunAlive(dispatchRunId)) return;
        const err = new Error('Dispatch abgebrochen');
        err.name = 'AbortError';
        throw err;
    };
    try {
    const btn = document.getElementById('generateBtn');
    const rBtn = document.getElementById('radioGenerateBtn');
    if (btn) { btn.disabled = true; btn.innerText = "Sucht Route & Daten..."; }
    if (rBtn) {
        rBtn.classList.add('disabled');
        rBtn.style.pointerEvents = 'none';
        const label = rBtn.querySelector('.audio-btn-label');
        if (label) label.textContent = "CALC...";
    }
    document.getElementById("briefingBox").style.display = "none";

    const page1 = document.getElementById('notePage1'), page2 = document.getElementById('notePage2');
    if (page1 && page2) { page1.classList.replace('back-note', 'front-note'); page2.classList.replace('front-note', 'back-note'); }

    document.getElementById("mDepRwy").innerText = "Sucht Pisten-Infos..."; document.getElementById("mDepRwy").style.color = "#fff";
    document.getElementById("mDestRwy").innerText = "Sucht Pisten-Infos..."; document.getElementById("mDestRwy").style.color = "#fff";

    if (document.getElementById("wikiDepDescText")) document.getElementById("wikiDepDescText").innerText = "Lade Start-Info...";
    if (document.getElementById("wikiDestDescText")) document.getElementById("wikiDestDescText").innerText = "Lade Ziel-Info...";

    const indicator = document.getElementById('searchIndicator');
    const needle = document.getElementById('meterNeedle');
    const led = document.getElementById('meterLed');
    if (led) led.classList.remove('led-green', 'led-blue', 'led-red');

    document.querySelectorAll('.marker-light').forEach(l => {
        l.classList.remove('on');
        l.classList.add('blinking');
    });

    if (window.meterInterval) clearInterval(window.meterInterval);
    window.meterInterval = setInterval(() => {
        const randomAngle = Math.floor(Math.random() * 60) - 20;
        if (needle) needle.style.transform = `translateX(-50%) rotate(${randomAngle}deg)`;
    }, 120);

    currentStartICAO = document.getElementById("startLoc").value.toUpperCase();
    const start = await getAirportData(currentStartICAO);
    _ensureDispatchAlive();
    if (!start) {
        alert("Startplatz unbekannt!"); resetBtn(btn);
        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`; return;
    }

    const rangePref = document.getElementById("distRange").value, regionPref = document.getElementById("regionFilter").value;
    const targetType = document.getElementById("targetType").value, dirPref = document.getElementById("dirPref").value;
    const missionPicker = parseMissionPickerValue(targetType);
    const maxSeats = parseInt(document.getElementById("maxSeats").value);
    const selectedTas = parseInt(document.getElementById("tasSlider").value) || 160;
    const selectedGph = parseInt(document.getElementById("gphSlider").value) || 14;

    let targetDest = document.getElementById("destLoc").value.toUpperCase();
    let forcePOI = false;
    if (targetDest && targetDest === currentStartICAO) {
        targetDest = '';
        forcePOI = true;
    }
    let dataSource = targetDest ? "Manuell" : "Generiert";

    let minNM, maxNM;
    if (rangePref === "any") {
        const roll = Math.random(); if (roll < 0.33) { minNM = 10; maxNM = 50; } else if (roll < 0.66) { minNM = 50; maxNM = 100; } else { minNM = 100; maxNM = 250; }
    } else {
        if (rangePref === "short") { minNM = 10; maxNM = 50; } if (rangePref === "medium") { minNM = 50; maxNM = 100; } if (rangePref === "long") { minNM = 100; maxNM = 250; }
    }

    const effectiveType = (forcePOI || missionPicker.baseType === "poi") ? "poi" : "apt";
    const selectedPoiCategory = effectiveType === 'poi' ? (missionPicker.category || 'all') : 'all';
    const selectedAptCategory = effectiveType === 'apt' ? (missionPicker.category || 'all') : 'all';
    const selectedMissionProfile = String(missionPicker.profile || 'auto').toLowerCase();
    // Guardrail: Bei POI-Missionen darf ein evtl. noch befülltes Zielfeld
    // (z.B. vom vorherigen A-B-Flug) NICHT als Ziel ausgewertet werden.
    if (effectiveType === "poi" && targetDest) {
        targetDest = '';
        dataSource = "Generiert";
    }
    let searchMin = effectiveType === "poi" ? minNM / 2 : minNM, searchMax = effectiveType === "poi" ? maxNM / 2 : maxNM, dest = null;
    if (effectiveType === 'poi' && selectedPoiCategory === 'trn') {
        // Platznahes POI-Training: Übungsgebiet bewusst nahe am Startplatz halten.
        searchMin = Math.max(3, Math.round(minNM * 0.2));
        searchMax = Math.min(22, Math.max(searchMin + 2, Math.round(maxNM * 0.35)));
    }

    if (targetDest) { dest = await getAirportData(targetDest); _ensureDispatchAlive(); } else {
        if (effectiveType === "apt") {
            dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, dirPref, regionPref);
            _ensureDispatchAlive();
        } else if (selectedPoiCategory === 'trn') {
            // POI-Training nutzt absichtlich nur ein synthetisches Übungsgebiet, kein echtes Objekt.
            dest = pickRandomTrainingPoiNearAirport(start.lat, start.lon, dirPref, searchMin, searchMax);
            dataSource = "Training Area RNG";
        } else {
            dest = await findWikipediaPOI(start.lat, start.lon, searchMin, searchMax, dirPref, selectedPoiCategory);
            _ensureDispatchAlive();
        }
    }

    // APT-Fallbackkette: reduziert "Kein Ziel gefunden" bei engen Filtern
    // oder wenn Richtung/Region aktuell zu restriktiv sind.
    if (!dest && !targetDest && effectiveType === "apt") {
        dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, 'any', regionPref);
        _ensureDispatchAlive();
    }
    if (!dest && !targetDest && effectiveType === "apt" && regionPref !== 'any') {
        dest = await findGithubAirport(start.lat, start.lon, searchMin, searchMax, 'any', 'any');
        _ensureDispatchAlive();
    }
    if (!dest && !targetDest && effectiveType === "apt") {
        dest = await findGithubAirport(start.lat, start.lon, 5, 350, 'any', 'any');
        _ensureDispatchAlive();
    }

    if (!dest && !targetDest && effectiveType === "poi" && selectedPoiCategory === 'trn') {
        dest = pickRandomTrainingPoiNearAirport(start.lat, start.lon, dirPref, searchMin, searchMax);
        dataSource = "Training Area RNG";
    }

    if (!dest && !targetDest && effectiveType === "poi" && selectedPoiCategory !== 'trn' && typeof fallbackPOIs !== 'undefined') {
        dataSource = "Fallback POIs";
        let validPOIs = fallbackPOIs.filter(p => checkBearing(calcNav(start.lat, start.lon, p.lat, p.lon).brng, dirPref));
        if (selectedPoiCategory !== 'all') {
            validPOIs = validPOIs.filter(p => classifyPOITitleCategory(p.n) === selectedPoiCategory);
        }
        if (validPOIs.length === 0 && selectedPoiCategory !== 'all') {
            validPOIs = fallbackPOIs.filter(p => classifyPOITitleCategory(p.n) === selectedPoiCategory);
        }
        if (validPOIs.length === 0) validPOIs = fallbackPOIs;
        const balancedFallbackPoi = pickBalancedByCategory(validPOIs, p => classifyPOITitleCategory(p.n), 'ga_poi_cat');
        dest = balancedFallbackPoi ? balancedFallbackPoi.item : validPOIs[Math.floor(Math.random() * validPOIs.length)];
        dest.poiCategory = balancedFallbackPoi ? balancedFallbackPoi.category : classifyPOITitleCategory(dest.n);
        dest.icao = "POI";
    }
    if (dest && effectiveType === 'poi' && selectedPoiCategory === 'trn') {
        dest.poiCategory = 'trn';
    }

    if (!dest) {
        indicator.innerText = "Fehler: Kein passendes Ziel gefunden.";
        if (effectiveType === "apt" && (!globalAirports || Object.keys(globalAirports).length === 0)) {
            indicator.innerText = "Fehler: Airport-Daten nicht geladen (airports.json).";
        }
        resetBtn(btn);
        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`; return;
    }

    const isPOI = forcePOI || (effectiveType === 'poi' && !targetDest);
    const nav = calcNav(start.lat, start.lon, dest.lat, dest.lon);
    let totalDist = isPOI ? nav.dist * 2 : nav.dist;
    currentDestICAO = isPOI ? currentStartICAO : dest.icao;
    let poiTerrainFt = null;
    if (isPOI && Number.isFinite(dest?.lat) && Number.isFinite(dest?.lon)) {
        poiTerrainFt = await fetchPoiTerrainElevationFt(dest.lat, dest.lon);
        _ensureDispatchAlive();
    }
    const [depWeatherSnap, destWeatherSnap] = await Promise.all([
        fetchMissionWeatherSnapshot(currentStartICAO, start.lat, start.lon),
        fetchMissionWeatherSnapshot(isPOI ? 'POI' : currentDestICAO, dest.lat, dest.lon)
    ]);
    _ensureDispatchAlive();
    const missionWeather = { dep: depWeatherSnap, dest: destWeatherSnap };

    const maxPax = Math.max(1, maxSeats - 1), randomPax = Math.floor(Math.random() * maxPax) + 1;
    let paxText = `${randomPax} PAX`, cargoText = `${Math.floor(Math.random() * 300) + 20} lbs`;

    indicator.innerText = `Kontaktiere KI-Dispatcher...`;
    let m = await fetchGeminiMission(start.n, dest.n, totalDist, isPOI, paxText, cargoText, poiTerrainFt, missionWeather, missionPicker);
    let missionFromLocalFallback = false;
    _ensureDispatchAlive();

    if (m) {
        dataSource = m._source;
        if (m.pax) paxText = m.pax;
        if (m.cargo) cargoText = m.cargo;
    } else {
        missionFromLocalFallback = true;
        indicator.innerText = `Lade Auftrag aus lokaler Datenbank...`;
        dataSource = "Lokale DB";
        if (isPOI) {
            if (selectedPoiCategory === 'trn') {
                const fallbackPlan = sanitizeTrainingPlan(null, true);
                const instructor = buildInstructorPassenger(fallbackPlan);
                m = {
                    i: '🧑‍✈️',
                    t: 'Trainingsflug im Übungsgebiet',
                    s: 'Heute trainieren wir Verfahren und Flugpraezision im platznahen Uebungsgebiet. Ich gebe dir die Uebungsschritte unterwegs, wir arbeiten sauber nach Verfahren und landen danach wieder am Startplatz.',
                    cat: 'trn',
                    passenger: instructor
                };
                paxText = "1 PAX (Instruktor)";
                cargoText = "Trainingsunterlagen (10 lbs)";
                dataSource = "Lokale Training DB";
            } else {
                m = generateDynamicPOIMission(dest.n, maxSeats, dest.poiCategory); paxText = m.payloadText; cargoText = m.cargoText; dataSource = "Wikipedia GeoSearch";
            }
        } else if (typeof missions !== 'undefined') {
            // A->B-Missionen gleichmäßig über Kategorien rotieren (inkl. Trainingsflüge).
            const availM = missions.filter(ms => {
                if (!ms || ms.cat === 'poi') return false;
                if (selectedMissionProfile !== 'auto' && selectedAptCategory === 'all') {
                    const inferred = classifyAptMissionCategory(ms);
                    if (inferred === 'trn') return false;
                }
                if (selectedAptCategory === 'all') return true;
                return classifyAptMissionCategory(ms) === selectedAptCategory;
            });
            if (availM.length === 0) {
                m = missions[0];
            } else {
                const availCats = [...new Set(availM.map(ms => ms.cat || "std"))];
                const catCounts = JSON.parse(localStorage.getItem('ga_mission_cat_counts') || '{}');
                const lastCat = localStorage.getItem('ga_last_mission_cat') || '';

                const minCount = Math.min(...availCats.map(cat => parseInt(catCounts[cat] || 0, 10)));
                let candidateCats = availCats.filter(cat => parseInt(catCounts[cat] || 0, 10) === minCount);
                if (candidateCats.length > 1 && candidateCats.includes(lastCat)) {
                    candidateCats = candidateCats.filter(cat => cat !== lastCat);
                }
                const selectedCat = candidateCats[Math.floor(Math.random() * candidateCats.length)] || availCats[0];

                const pool = availM.filter(ms => (ms.cat || "std") === selectedCat);
                const historyByCat = JSON.parse(localStorage.getItem('ga_mission_history_by_cat') || '{}');
                let catHistory = Array.isArray(historyByCat[selectedCat]) ? historyByCat[selectedCat] : [];
                let freshM = pool.filter(ms => !catHistory.includes(ms.t));

                if (freshM.length === 0) {
                    freshM = pool;
                    catHistory = [];
                }

                m = freshM[Math.floor(Math.random() * freshM.length)] || pool[0] || missions[0];

                catHistory.push(m.t);
                if (catHistory.length > 20) catHistory.shift();
                historyByCat[selectedCat] = catHistory;
                localStorage.setItem('ga_mission_history_by_cat', JSON.stringify(historyByCat));

                catCounts[selectedCat] = parseInt(catCounts[selectedCat] || 0, 10) + 1;
                localStorage.setItem('ga_mission_cat_counts', JSON.stringify(catCounts));
                localStorage.setItem('ga_last_mission_cat', selectedCat);
            }

            if (dataSource === "Generiert") dataSource = "GitHub Airport DB";
            const aptCatOfMission = classifyAptMissionCategory(m || {});
            if (m.cat === "cargo" || aptCatOfMission === 'cargo') { paxText = "0 PAX"; }
            if (m.cat === "charter" || aptCatOfMission === 'charter' || selectedAptCategory === 'charter') {
                if (!m.passenger || typeof m.passenger !== 'object') {
                    m.passenger = buildCharterPassenger(null);
                } else {
                    m.passenger = buildCharterPassenger(m.passenger);
                }
                if (!paxText || /^\s*0\s*PAX\b/i.test(String(paxText))) {
                    paxText = `1 PAX (${m.passenger.role})`;
                }
            }
            if (m.cat === "trn" || aptCatOfMission === 'trn' || selectedAptCategory === 'trn') {
                paxText = "1 PAX (Instruktor)";
                if (!cargoText || /kein cargo|none|0 lbs/i.test(String(cargoText))) cargoText = "Trainingsunterlagen (10 lbs)";
                if (!m.passenger || typeof m.passenger !== 'object') {
                    m.passenger = buildInstructorPassenger(null);
                }
            }
        }
    }
    if (!isPOI && selectedAptCategory === 'cargo') paxText = "0 PAX";
    if (!isPOI && selectedAptCategory === 'trn') paxText = "1 PAX (Instruktor)";
    {
        const autoProfileId = (selectedMissionProfile === 'auto' && missionFromLocalFallback)
            ? pickAutoMissionTaskProfileId({
                isPOI,
                selectedAptCategory,
                selectedPoiCategory,
                missionCat: String(m?.cat || '')
            })
            : 'auto';
        const effectiveProfileId = (selectedMissionProfile === 'auto') ? autoProfileId : selectedMissionProfile;
        const profApplied = applyMissionTaskProfileToMission(m, isPOI, effectiveProfileId, paxText, cargoText);
        m = profApplied.mission || m;
        paxText = profApplied.paxText || paxText;
        cargoText = profApplied.cargoText || cargoText;
        m._requestedProfile = selectedMissionProfile;
        m._appliedProfile = profApplied.appliedProfile || effectiveProfileId || 'auto';
    }
    _ensureDispatchAlive();

    const poolCategory = isPOI ? (dest.poiCategory || classifyPOITitleCategory(dest.n)) : (m?.cat || 'std');
    const dispatchSnapshot = {
        mode: isPOI ? 'POI' : 'A-B',
        category: poolCategory,
        profile: m?._requestedProfile || selectedMissionProfile || 'auto',
        appliedProfile: m?._appliedProfile || 'auto',
        mission: m?.t || 'n/a',
        target: dest?.n || 'n/a'
    };
    console.debug('[DISPATCH]', dispatchSnapshot);

    const fuel = Math.ceil((totalDist / selectedTas * selectedGph) + (0.75 * selectedGph));
    const totalMinutes = Math.round((totalDist / selectedTas) * 60);
    const hrs = Math.floor(totalMinutes / 60), mins = totalMinutes % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} Min.`;

    currentMissionData = {
        start: currentStartICAO,
        dest: currentDestICAO,
        poiName: isPOI ? dest.n : null,
        mission: m.t,
        dist: totalDist,
        ac: selectedAC,
        heading: nav.brng,
        weatherBriefing: missionWeather
    };

    window.activePassenger = (m && m.passenger) ? enforcePoiPassengerAltitudeRule(m.passenger, isPOI, poiTerrainFt) : null;
    try { localStorage.setItem('ga_active_passenger', window.activePassenger ? JSON.stringify(window.activePassenger) : ''); } catch(e) {}
    try {
        const p = window.activePassenger || {};
        const missionDebugSnapshot = {
            ts: Date.now(),
            mode: dispatchSnapshot.mode,
            category: dispatchSnapshot.category,
            profile: dispatchSnapshot.profile,
            appliedProfile: dispatchSnapshot.appliedProfile,
            mission: dispatchSnapshot.mission,
            target: dispatchSnapshot.target,
            source: m?._source || dataSource || 'n/a',
            story: String(m?.s || ''),
            paxText: String(paxText || ''),
            cargoText: String(cargoText || ''),
            passenger: {
                name: p.name || null,
                role: p.role || null,
                roleProfile: p.roleProfile || 'general_passenger_v1',
                taskDomain: p.taskDomain || 'general',
                gTolerance: p.gTolerance || 'mittel',
                bankTolerance: p.bankTolerance || 'mittel',
                cargoSensitivity: p.cargoSensitivity || 'mittel',
                stomachSensitivity: p.stomachSensitivity || 'mittel',
                comfortPriority: p.comfortPriority || 'mittel',
                targetAltFt: Number(p.targetAltFt || 0),
                targetRadiusNm: Number(p.targetRadiusNm || 0),
                targetDwellMin: Number(p.targetDwellMin || 0)
            }
        };
        window.vpMissionDebugSnapshot = missionDebugSnapshot;
        localStorage.setItem('ga_mission_debug_snapshot', JSON.stringify(missionDebugSnapshot));
        console.debug('[MISSION SNAPSHOT]', missionDebugSnapshot);
        if (typeof window.vpRefreshWeatherDebugReport === 'function') window.vpRefreshWeatherDebugReport();
    } catch (_) {}
    if (typeof window.paxVoiceResetMission === 'function') window.paxVoiceResetMission();
    if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
    const paxBriefingText = formatPaxBriefingText(paxText, window.activePassenger);

    document.getElementById("mTitle").innerHTML = `${m.i ? m.i + ' ' : ''}${m.t}`;
    document.getElementById("mStory").innerText = m.s;
    document.getElementById("mDepICAO").innerText = currentStartICAO;
    document.getElementById("mDepName").innerText = start.n;
    document.getElementById("mDepCoords").innerText = `${start.lat.toFixed(4)}, ${start.lon.toFixed(4)}`;
    const wikiDepNameEl = document.getElementById('wikiDepNameDisplay');
    if (wikiDepNameEl) wikiDepNameEl.innerText = `${currentStartICAO} – ${start.n}`;

    setDrumCounter('distDrum', totalDist);
    recalculatePerformance();

    document.getElementById("destIcon").innerText = isPOI ? "🎯" : "🛬";
    document.getElementById("mDestICAO").innerText = isPOI ? "POI" : currentDestICAO;
    document.getElementById("mDestName").innerText = dest.n;
    document.getElementById("mDestCoords").innerText = `${dest.lat.toFixed(4)}, ${dest.lon.toFixed(4)}`;
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    if (wikiDestNameEl) wikiDestNameEl.innerText = `${isPOI ? 'POI' : currentDestICAO} – ${dest.n}`;

    document.getElementById("mPay").innerText = paxBriefingText; document.getElementById("mWeight").innerText = cargoText;
    document.getElementById("mDistNote").innerText = `${totalDist} NM`;
    document.getElementById("mETENote").innerText = timeStr;
    const mHeadingNote = document.getElementById("mHeadingNote");
    if (mHeadingNote) mHeadingNote.innerText = `${nav.brng}°`;

    document.getElementById("destRwyContainer").style.display = isPOI ? "none" : "block";
    if (document.getElementById("wikiDestRwyText")) document.getElementById("wikiDestRwyText").style.display = isPOI ? "none" : "block";
    const depLinks = document.getElementById("wikiDepLinks"); if (depLinks) depLinks.style.display = "block";
    const destSwitchRow = document.getElementById("destSwitchRow"); if (destSwitchRow) destSwitchRow.style.display = isPOI ? "none" : "flex";

    document.getElementById("briefingBox").style.display = "block";

    const destLocEl = document.getElementById('destLoc');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (destLocEl) destLocEl.value = '';
    if (destLocRadioEl) destLocRadioEl.value = '';

    updateMap(start.lat, start.lon, dest.lat, dest.lon, currentStartICAO, dest.n);

    currentDepElev  = (globalAirports && globalAirports[currentStartICAO])  ? (globalAirports[currentStartICAO].elevation  ?? null) : null;
    currentDestElev = (globalAirports && globalAirports[currentDestICAO])   ? (globalAirports[currentDestICAO].elevation   ?? null) : null;

    const destLinks = document.getElementById("wikiDestLinks");
    if (destLinks) destLinks.style.display = isPOI ? "none" : "block";

    indicator.innerText = `Flugplan bereit (${dataSource}). Lade Infos...`;
    fetchRunwayDetails(start.lat, start.lon, 'mDepRwy', currentStartICAO);

    _dispatchDeferredFinalize = true;
    setTimeout(() => {
        if (!_isDispatchRunAlive(dispatchRunId)) return;
        if (!isPOI) fetchRunwayDetails(dest.lat, dest.lon, 'mDestRwy', currentDestICAO);

        fetchAreaDescription(start.lat, start.lon, 'wikiDepDescText', null, currentStartICAO, 'wikiDepImageContainer', 'wikiDepImage');
        fetchAreaDescription(dest.lat, dest.lon, 'wikiDestDescText', isPOI ? dest.n : null, isPOI ? null : currentDestICAO, 'wikiDestImageContainer', 'wikiDestImage');

        currentDepFreq = "";
        currentDestFreq = "";

        fetchAirportFreq(currentStartICAO, 'wikiDepFreqText', 'dep');

        // --- NEU: METAR Start laden ---
        loadMetarWidget(currentStartICAO, 'metarContainerDep', start.lat, start.lon);

        if (!isPOI) {
            fetchAirportFreq(currentDestICAO, 'wikiDestFreqText', 'dest');
        } else {
            const df = document.getElementById('wikiDestFreqText');
            if (df) df.innerHTML = '';
        }

        // --- NEU: METAR Ziel laden (nur wenn kein POI) ---
        loadMetarWidget(isPOI ? null : currentDestICAO, 'metarContainerDest', dest.lat, dest.lon);

        indicator.innerText = `Briefing komplett.`; resetBtn(btn);
        const rBtnLed = document.getElementById('radioGenerateBtn');
        if (rBtnLed) rBtnLed.classList.add('active');

        if (window.meterInterval) clearInterval(window.meterInterval);
        if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;

        if (led) {
            led.classList.remove('led-green', 'led-blue', 'led-red', 'led-flash3');
            if (dataSource === "Gemini 3.0 Flash") { led.classList.add('led-flash3'); }
            else if (dataSource === "Gemini 2.5 Flash") { led.classList.add('led-blue'); }
            else if (dataSource === "Gemini 2.5 Flash Lite") { led.classList.add('led-green'); }
            else { led.classList.add('led-red'); }
        }

        document.querySelectorAll('.marker-light').forEach(l => l.classList.remove('blinking', 'on'));
        if (dataSource === "Gemini 3.0 Flash") {
            document.getElementById('mkO').classList.add('on');
            document.getElementById('mkM').classList.add('on');
        }
        else if (dataSource === "Gemini 2.5 Flash") document.getElementById('mkO').classList.add('on');
        else if (dataSource === "Gemini 2.5 Flash Lite") document.getElementById('mkM').classList.add('on');
        else document.getElementById('mkI').classList.add('on');

        window.debouncedSaveMissionState();
        refreshGPSAfterDispatch();
        // Position im Profil auf Start zurücksetzen
        vpUpdatePosition(0);
        if (_isDispatchRunAlive(dispatchRunId)) {
            _dispatchState.active = false;
        }
    }, 800);
    } catch (e) {
        if (e && e.name === 'AbortError') {
            // Benutzerabbruch über Clear: kein zusätzlicher Fehlerdialog.
        } else {
            console.error('[Dispatch] Fehler:', e);
            const indicator = document.getElementById('searchIndicator');
            if (indicator) indicator.innerText = 'Fehler beim Dispatch. Bitte erneut versuchen.';
            const btn = document.getElementById('generateBtn');
            resetBtn(btn);
            if (window.meterInterval) clearInterval(window.meterInterval);
            const needle = document.getElementById('meterNeedle');
            if (needle) needle.style.transform = `translateX(-50%) rotate(-45deg)`;
        }
    } finally {
        if (!_dispatchDeferredFinalize && _dispatchState.runId === dispatchRunId) {
            _dispatchState.active = false;
        }
    }
}



/* =========================================================
   9. EXTERNE LINKS & LOGBUCH
   ========================================================= */
function openAIP(t) {
    const icao = t === 'dep' ? currentStartICAO : currentDestICAO;
    const url = (typeof getAipPopupUrl === 'function')
        ? getAipPopupUrl(icao, globalAirports?.[icao]?.country || '')
        : null;
    if (!url) return;
    window.open(url, '_blank');
}
function openMetar(t) { window.open(`https://metar-taf.com/de/${t === 'dep' ? currentStartICAO : currentDestICAO}`, '_blank'); }

function logCurrentFlight() {
    if (!currentMissionData) return;
    const log = JSON.parse(localStorage.getItem('ga_logbook')) || [];
    log.unshift({ ...currentMissionData, date: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem('ga_logbook', JSON.stringify(log.slice(0, 50)));
    localStorage.setItem('last_icao_dest', currentMissionData.dest);
    const newStart = currentMissionData.dest || '';
    document.getElementById('startLoc').value = newStart;
    document.getElementById('destLoc').value = "";
    const startLocRadioEl = document.getElementById('startLocRadio');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (startLocRadioEl) startLocRadioEl.value = newStart;
    if (destLocRadioEl) destLocRadioEl.value = '';
    renderLog(); alert(`Flug geloggt! Du bist in ${currentMissionData.dest}.`);
    triggerCloudSave();
}

function renderLog() {
    const log = JSON.parse(localStorage.getItem('ga_logbook')) || [];
    const container = document.getElementById('logContent');
    container.innerHTML = log.length ? '' : '<div style="color:#888; font-size:11px;">Keine Einträge vorhanden.</div>';
    const isRetro = document.body.classList.contains('theme-retro');
    log.forEach(e => {
        const div = document.createElement('div'); div.className = 'log-entry';
        const routeStr = e.poiName ? `<b>${e.start} ➔ ${e.poiName} ➔ ${e.dest}</b>` : `<b>${e.start} ➔ ${e.dest}</b>`;
        const hlColor = isRetro ? 'var(--piper-yellow)' : 'var(--blue)', subColor = isRetro ? '#aaa' : '#888';
        div.innerHTML = `<span style="color:${subColor};">${e.date} • ${e.ac}</span><br>${routeStr}<br><span style="color:${hlColor}">${e.mission} (${e.dist} NM)</span>`;
        container.appendChild(div);
    });
}
function clearLog() { if (confirm("Gesamtes Logbuch löschen?")) { localStorage.removeItem('ga_logbook'); localStorage.removeItem('last_icao_dest'); renderLog(); triggerCloudSave(); } }

/* =========================================================
   10. HANGAR PINNWAND & CREW BOARD MULTIPLAYER
   ========================================================= */
/* =========================================================
   KLN 90B GPS MODULE
   ========================================================= */
const gpsState = {
    mode: 'FPL',
    subPage: 0,
    visible: false,
    maxPages: { FPL: 1, DEP: 2, DEST: 2, AIP: 2, WX: 2 },
    metarCache: {},
    wikiCache: {}
};

function toggleGPSModule(btnEl) {
    gpsState.visible = !gpsState.visible;
    const mod = document.getElementById('kln90bModule');
    const fp = document.querySelector('.flightplan-container');
    if (gpsState.visible) {
        if (mod) mod.style.display = 'flex';
        if (fp) fp.style.display = 'none';
        if (btnEl) btnEl.classList.add('active');
    } else {
        if (mod) mod.style.display = 'none';
        if (fp) fp.style.display = '';
        if (btnEl) btnEl.classList.remove('active');
    }
    saveAudioButtonStates();
    renderGPS();
}

function saveAudioButtonStates() {
    const states = {};
    document.querySelectorAll('.audio-btn-grid .audio-btn').forEach(btn => {
        const id = btn.id;
        if (id) states[id] = btn.classList.contains('active');
    });
    localStorage.setItem('ga_navcom_buttons', JSON.stringify(states));
}

function restoreAudioButtonStates() {
    const saved = JSON.parse(localStorage.getItem('ga_navcom_buttons') || '{}');
    for (const [id, active] of Object.entries(saved)) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        if (active) btn.classList.add('active');
        else btn.classList.remove('active');
    }
    if (saved['btnToggleGPS']) {
        gpsState.visible = true;
        const mod = document.getElementById('kln90bModule');
        const fp = document.querySelector('.flightplan-container');
        if (mod) mod.style.display = 'flex';
        if (fp) fp.style.display = 'none';
        renderGPS();
    }
    if (saved['btnToggleAI']) {
        const aiToggle = document.getElementById('aiToggle');
        if (aiToggle) aiToggle.checked = true;
    }
}

function initGPSButtons() {
    document.querySelectorAll('.kln90b-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetMode = btn.dataset.mode;

            if (targetMode === 'AIP') {
                if (gpsState.mode === 'DEP' && currentStartICAO) {
                    const depUrl = (typeof getAipPopupUrl === 'function')
                        ? getAipPopupUrl(currentStartICAO, globalAirports?.[currentStartICAO]?.country || '')
                        : null;
                    if (depUrl) window.open(depUrl, '_blank');
                    return;
                }
                if (gpsState.mode === 'DEST' && currentDestICAO) {
                    const destUrl = (typeof getAipPopupUrl === 'function')
                        ? getAipPopupUrl(currentDestICAO, globalAirports?.[currentDestICAO]?.country || '')
                        : null;
                    if (destUrl) window.open(destUrl, '_blank');
                    return;
                }
            }

            if (targetMode === 'WX') {
                if (gpsState.mode === 'DEP' && currentStartICAO) {
                    window.open(`https://metar-taf.com/de/${currentStartICAO}`, '_blank');
                    return;
                }
                if (gpsState.mode === 'DEST' && currentDestICAO) {
                    window.open(`https://metar-taf.com/de/${currentDestICAO}`, '_blank');
                    return;
                }
            }

            document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gpsState.mode = targetMode;
            gpsState.subPage = 0;
            if (gpsState.mode === 'DEP' || gpsState.mode === 'DEST') {
                gpsState.maxPages[gpsState.mode] = 2;
            }
            renderGPS();
        });
    });
}

function initGPSEncoders() {
    const encL = document.getElementById('gpsEncoderL');
    const encR = document.getElementById('gpsEncoderR');

    const prevPage = () => {
        const max = gpsState.maxPages[gpsState.mode] || 1;
        gpsState.subPage = (gpsState.subPage - 1 + max) % max;
        renderGPS();
    };
    const nextPage = () => {
        const max = gpsState.maxPages[gpsState.mode] || 1;
        gpsState.subPage = (gpsState.subPage + 1) % max;
        renderGPS();
    };

    if (encL) {
        encL.addEventListener('click', () => prevPage());
        encL.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.deltaY > 0 ? nextPage() : prevPage();
        });
    }
    if (encR) {
        encR.addEventListener('click', () => nextPage());
        encR.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.deltaY > 0 ? nextPage() : prevPage();
        });
    }
}

function initCom2Knob() {
    const knob = document.getElementById('com2Knob');
    if (!knob) return;
    knob.addEventListener('click', () => {
        currentDestICAO = '';
        const destLocEl = document.getElementById('destLoc');
        const destLocRadioEl = document.getElementById('destLocRadio');
        if (destLocEl) destLocEl.value = '';
        if (destLocRadioEl) destLocRadioEl.value = '';
        if (gpsState.mode === 'DEST') {
            document.querySelectorAll('.kln90b-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'FPL'));
            gpsState.mode = 'FPL';
            gpsState.subPage = 0;
            if (gpsState.visible) renderGPS();
        }
    });
}

function renderGPS() {
    const left = document.getElementById('gpsLeft');
    const right = document.getElementById('gpsRight');
    const modeLbl = document.getElementById('gpsModeLbl');
    const pageLbl = document.getElementById('gpsPageLbl');
    if (!left || !right) return;

    const max = gpsState.maxPages[gpsState.mode] || 1;
    modeLbl.textContent = gpsState.mode;
    pageLbl.textContent = `PG ${gpsState.subPage + 1}/${max}`;

    switch (gpsState.mode) {
        case 'FPL': renderFPL(left, right); break;
        case 'DEP': renderAirportInfo(left, right, 'dep'); break;
        case 'DEST': renderAirportInfo(left, right, 'dest'); break;
        case 'AIP': renderAIP(left, right); break;
        case 'WX': renderWX(left, right); break;
    }
}

const FPL_LEGS_PER_PAGE = 6;

function renderFPL(left, right) {
    if (!currentMissionData) { left.innerHTML = '<div class="kln90b-line dim">NO FLIGHTPLAN</div>'; right.innerHTML = '<div class="kln90b-line dim">DISPATCH FIRST</div>'; return; }

    const wps = routeWaypoints, legs = [];
    if (wps && wps.length >= 2) {
        for (let i = 0; i < wps.length - 1; i++) {
            const p1 = wps[i], p2 = wps[i + 1], nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);
            let n1 = i === 0 ? (currentStartICAO || 'DEP') : (wps[i].name || `WP${i}`);
            let n2 = i === wps.length - 2 ? (currentMissionData?.poiName ? 'POI' : (currentDestICAO || 'DEST')) : (wps[i + 1].name || `WP${i + 1}`);

            n1 = n1.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');
            n2 = n2.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');

            let m1 = n1.match(/\[([^\]]+)\]/); if (m1) n1 = `[${m1[1]}]`;
            let m2 = n2.match(/\[([^\]]+)\]/); if (m2) n2 = `[${m2[1]}]`;

            n1 = n1.replace(/\s*\([^)]+\)/, '');
            n2 = n2.replace(/\s*\([^)]+\)/, '');

            const n1Short = n1.length > 8 ? n1.substring(0, 7) + '.' : n1;
            const n2Short = n2.length > 8 ? n2.substring(0, 7) + '.' : n2;
            legs.push({ n1: n1Short, n2: n2Short, brng: nav.brng, dist: nav.dist });
        }
    }

    const legPages = Math.max(1, Math.ceil(legs.length / 6));
    gpsState.maxPages['FPL'] = legPages;
    if (gpsState.subPage >= legPages) gpsState.subPage = legPages - 1;
    const pageLbl = document.getElementById('gpsPageLbl');
    if (pageLbl) pageLbl.textContent = `PG ${gpsState.subPage + 1}/${legPages}`;

    if (gpsState.subPage < legPages) {
        const start = gpsState.subPage * 6;
        const visible = legs.slice(start, start + 6);
        left.innerHTML = visible.map((l, idx) => {
            const isEnd = (start + idx) === 0 || (start + idx) === legs.length - 1;
            return `<div class="kln90b-line ${isEnd ? 'highlight' : ''}" style="font-size:10px; line-height:1.5; white-space:nowrap;">${l.n1}\u2192${l.n2}&nbsp;&nbsp;<span class="dim">${l.brng}\u00b0&thinsp;${l.dist}&thinsp;NM</span></div>`;
        }).join('');
        if (legs.length === 0) left.innerHTML = `<div class="kln90b-line highlight">${currentStartICAO}</div><div class="kln90b-line dim">→${currentMissionData?.poiName ? 'POI' : currentDestICAO}</div>`;

        const _d = Math.round((currentMissionData.dist || 0) * 10) / 10, _t = parseInt(document.getElementById('tasSlider')?.value) || 115, _g = parseInt(document.getElementById('gphSlider')?.value) || 9;
        right.innerHTML = `<div class="kln90b-line dim" style="font-size:9px;">TOTAL:</div><div class="kln90b-line" style="font-size:10px;">DST ${_d}NM</div><div class="kln90b-line" style="font-size:10px;">TME ${Math.round((_d / _t) * 60)}m</div><div class="kln90b-line" style="font-size:10px;">FUL ${Math.ceil((_d / _t) * _g + 0.75 * _g)}G</div><div class="kln90b-line" style="font-size:10px;">HDG ${currentMissionData.heading || 0}°</div>`;
    }
}
async function renderAirportInfo(left, right, type) {
    const isPOIMission = currentMissionData?.poiName && type === 'dest';
    const icao = type === 'dep' ? currentStartICAO : (isPOIMission ? 'POI' : currentDestICAO);
    if (!icao) {
        left.innerHTML = '<div class="kln90b-line dim">NO DATA</div>';
        right.innerHTML = '<div class="kln90b-line dim">DISPATCH</div>';
        return;
    }

    const mode = gpsState.mode;
    const realIcao = type === 'dep' ? currentStartICAO : currentDestICAO;
    const data = await getAirportData(realIcao);
    const name = isPOIMission ? currentMissionData.poiName : ((data && data.n) ? data.n : (type === 'dep' ? currentSName : currentDName) || icao);
    const lat = data ? data.lat.toFixed(4) : '---';
    const lon = data ? data.lon.toFixed(4) : '---';

    left.innerHTML =
        `<div class="kln90b-line highlight" style="font-size:11px;">${icao}</div>` +
        `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.35;">${name}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; margin-top:2px;">${lat}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">${lon}</div>`;

    right.innerHTML = '<div class="kln90b-line dim kln-loading-dots" style="margin-top:8px;"><span>●</span><span>●</span><span>●</span></div>';

    // POI-Missionen: Keine Runway/Freq-Daten, nur Wiki-Info
    if (isPOIMission) {
        const wikiKey = currentMissionData.poiName || 'POI';
        if (!gpsState.wikiCache[wikiKey] && data) {
            await fetchAndCacheWikiPages(realIcao, data.lat, data.lon);
            if (gpsState.wikiCache[realIcao]) gpsState.wikiCache[wikiKey] = gpsState.wikiCache[realIcao];
        }
        const wikiArr = gpsState.wikiCache[wikiKey] || gpsState.wikiCache[realIcao] || ['Keine Daten.'];
        const total = wikiArr.length;
        gpsState.maxPages[mode] = total;
        const lbl = document.getElementById('gpsPageLbl');
        if (lbl) lbl.textContent = `PG ${gpsState.subPage + 1}/${total}`;
        if (gpsState.subPage >= total) gpsState.subPage = total - 1;
        const sp = gpsState.subPage;
        if (sp >= 0 && sp < wikiArr.length) {
            right.innerHTML =
                `<div class="kln90b-line" style="font-size:9px; line-height:1.5; white-space:normal;">${wikiArr[sp]}</div>`;
        } else {
            right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>';
        }
        return;
    }

    if (!runwayCache[icao] && data) {
        const wikiResult = await fetchRunwayFromWikipedia(icao, data.lat, data.lon);

        if (wikiResult) {
            runwayCache[icao] = wikiResult;
            if (gpsState.mode === mode) renderGPS();
        } else {
            try {
                const ov = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:8];way["aeroway"="runway"](around:3000,${data.lat},${data.lon});out tags;`)}`).then(r => r.json());
                if (ov?.elements?.length > 0) {
                    const trans = { asphalt: 'Asphalt', concrete: 'Beton', grass: 'Gras', paved: 'Asphalt', unpaved: 'Unbefestigt', dirt: 'Erde', gravel: 'Schotter' };
                    const seen = new Set(), parts = [];
                    for (const e of ov.elements) {
                        if (!e.tags?.ref || seen.has(e.tags.ref)) continue;
                        seen.add(e.tags.ref);
                        const surf = e.tags.surface ? (trans[e.tags.surface.toLowerCase()] || e.tags.surface) : '?';
                        const len = e.tags.length ? ' · ' + Math.round(e.tags.length) + 'm' : '';
                        parts.push(`${e.tags.ref} – ${surf}${len}`);
                    }
                    if (parts.length > 0) {
                        runwayCache[icao] = parts.join('\n');
                        if (gpsState.mode === mode) renderGPS();
                    }
                } else {
                    runwayCache[icao] = "Keine Daten gefunden";
                    if (gpsState.mode === mode) renderGPS();
                }
            } catch (e) {
                runwayCache[icao] = "Keine Daten gefunden";
                if (gpsState.mode === mode) renderGPS();
            }
        }
    }

    // Frequenz-Fallback: Wenn nicht im Cache, nachladen
    if (freqCache[icao] === undefined && (!gpsState.fetchingFreqs || !gpsState.fetchingFreqs.has(icao))) {
        if (!gpsState.fetchingFreqs) gpsState.fetchingFreqs = new Set();
        gpsState.fetchingFreqs.add(icao);
        fetchAirportFreq(icao, null, null).then(() => {
            gpsState.fetchingFreqs.delete(icao);
            if (gpsState.mode === mode) renderGPS();
        });
    }

    const RWYS_PER_PAGE = 4;
    const FREQS_PER_PAGE = 4;
    const allRunways = runwayCache[icao] ? runwayCache[icao].split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(r => r.trim()) : [];
    const allFreqs = freqCache[icao] || [];
    const rwyPages = Math.max(1, Math.ceil(allRunways.length / RWYS_PER_PAGE));
    const freqPages = allFreqs.length > 0 ? Math.ceil(allFreqs.length / FREQS_PER_PAGE) : 0;
    const sp = gpsState.subPage;

    if (sp < rwyPages) {
        const slice = allRunways.slice(sp * RWYS_PER_PAGE, (sp + 1) * RWYS_PER_PAGE);
        const label = rwyPages > 1 ? `RUNWAYS (${sp + 1}/${rwyPages}):` : 'RUNWAYS:';
        right.innerHTML =
            `<div class="kln90b-line dim" style="font-size:9px; margin-bottom:1px;">${label}</div>` +
            (slice.length
                ? slice.map(r => `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.4;">▸ ${r}</div>`).join('')
                : '<div class="kln90b-line dim">NO RWY DATA</div>');

        const wikiN = gpsState.wikiCache[icao]?.length || 1;
        const total = rwyPages + freqPages + wikiN;
        if (gpsState.maxPages[mode] !== total) {
            gpsState.maxPages[mode] = total;
            const lbl = document.getElementById('gpsPageLbl');
            if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
        }
        return;
    }

    const freqIdx = sp - rwyPages;
    if (freqPages > 0 && freqIdx >= 0 && freqIdx < freqPages) {
        const fSlice = allFreqs.slice(freqIdx * FREQS_PER_PAGE, (freqIdx + 1) * FREQS_PER_PAGE);
        const fLabel = freqPages > 1 ? `FREQ (${freqIdx + 1}/${freqPages}):` : 'FREQ:';
        right.innerHTML =
            `<div class="kln90b-line dim" style="font-size:9px; margin-bottom:1px;">${fLabel}</div>` +
            fSlice.map(f => `<div class="kln90b-line" style="font-size:9px; white-space:normal; line-height:1.4;">▸ ${f.label}: ${f.value}</div>`).join('');

        const wikiN = gpsState.wikiCache[icao]?.length || 1;
        const total = rwyPages + freqPages + wikiN;
        if (gpsState.maxPages[mode] !== total) {
            gpsState.maxPages[mode] = total;
            const lbl = document.getElementById('gpsPageLbl');
            if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
        }
        return;
    }

    if (!gpsState.wikiCache[icao] && data) {
        await fetchAndCacheWikiPages(icao, data.lat, data.lon);
    }
    const wikiArr = gpsState.wikiCache[icao] || ['Keine Daten.'];
    const total = rwyPages + freqPages + wikiArr.length;
    if (gpsState.maxPages[mode] !== total) {
        gpsState.maxPages[mode] = total;
        const lbl = document.getElementById('gpsPageLbl');
        if (lbl) lbl.textContent = `PG ${sp + 1}/${total}`;
    }
    if (gpsState.subPage >= total) gpsState.subPage = total - 1;

    const wikiPageIdx = sp - rwyPages - freqPages;
    if (wikiPageIdx >= 0 && wikiPageIdx < wikiArr.length) {
        right.innerHTML =
            `<div class="kln90b-line" style="font-size:9px; line-height:1.5; white-space:normal;">${wikiArr[wikiPageIdx]}</div>`;
    } else {
        right.innerHTML = '<div class="kln90b-line dim">NO WIKI DATA</div>';
    }
}

async function fetchAndCacheWikiPages(icao, lat, lon) {
    try {
        let title = wikiTitleCache[icao];

        if (!title) {
            const wdRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P239=${icao}&format=json&origin=*`, 4000);
            const wdData = await wdRes.json();

            if (wdData?.query?.search?.length > 0) {
                title = wdData.query.search[0].title;
            } else {
                const fallRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(icao + ' Flugplatz OR Flugplatz')}&srlimit=1&format=json&origin=*`, 4000);
                const fallData = await fallRes.json();
                if (fallData?.query?.search?.length > 0) title = fallData.query.search[0].title;
            }
            if (title) wikiTitleCache[icao] = title;
        }

        if (!title) {
            gpsState.wikiCache[icao] = ['Keine Wikipedia-Daten gefunden.'];
            return;
        }

        const extRes = await fetchWithTimeout(`https://de.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&exsentences=12&titles=${encodeURIComponent(title)}&format=json&origin=*`, 5000);
        const extData = await extRes.json();

        const pageId = Object.keys(extData.query.pages)[0];
        const txt = extData.query.pages[pageId]?.extract?.trim() || 'Keine Information verfügbar.';

        gpsState.wikiCache[icao] = splitTextIntoPages(txt, 170);
    } catch (e) {
        gpsState.wikiCache[icao] = ['Fetch-Fehler – bitte erneut versuchen.'];
    }
}

function splitTextIntoPages(text, charsPerPage = 360) {
    const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
    const pages = [];
    let remaining = cleaned;
    while (remaining.length > 0) {
        if (remaining.length <= charsPerPage) {
            pages.push(remaining);
            break;
        }
        let cut = charsPerPage;
        const lo = Math.max(cut - 60, 1), hi = Math.min(cut + 40, remaining.length - 1);
        for (let i = hi; i >= lo; i--) {
            if (('.!?').includes(remaining[i]) && remaining[i + 1] === ' ') {
                cut = i + 1; break;
            }
        }
        if (cut === charsPerPage) {
            while (cut > 0 && remaining[cut] !== ' ' && remaining[cut] !== '\n') cut--;
            if (cut === 0) cut = charsPerPage;
        }
        pages.push(remaining.substring(0, cut).trim());
        remaining = remaining.substring(cut).trim();
    }
    return pages.length > 0 ? pages : ['Keine Info'];
}

function renderAIP(left, right) {
    const isDep = gpsState.subPage === 0;
    const icao = isDep ? currentStartICAO : currentDestICAO;
    const name = isDep ? currentSName : currentDName;
    const label = isDep ? 'DEP' : 'DEST';
    gpsState.maxPages['AIP'] = 2;

    left.innerHTML =
        `<div class="kln90b-line highlight">${label}</div>` +
        `<div class="kln90b-line" style="font-size:10px;">${icao || '----'}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; white-space:normal;">${name || ''}</div>`;

    if (!icao) { right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>'; return; }
    const aipUrl = (typeof getAipPopupUrl === 'function')
        ? getAipPopupUrl(icao, globalAirports?.[icao]?.country || '')
        : null;
    if (!aipUrl) { right.innerHTML = '<div class="kln90b-line dim">AIP N/A</div>'; return; }

    right.innerHTML =
        `<div class="kln90b-line dim">AIP VFR</div>` +
        `<div class="kln90b-line highlight" style="cursor:pointer;" onclick="window.open('${aipUrl}','_blank')">OPEN ▸</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">aip.aero</div>`;
}

function renderWX(left, right) {
    const isDep = gpsState.subPage === 0;
    const icao = isDep ? currentStartICAO : currentDestICAO;
    const name = isDep ? currentSName : currentDName;
    const label = isDep ? 'DEP' : 'DEST';
    gpsState.maxPages['WX'] = 2;

    left.innerHTML =
        `<div class="kln90b-line highlight">${label}</div>` +
        `<div class="kln90b-line" style="font-size:10px;">${icao || '----'}</div>` +
        `<div class="kln90b-line dim" style="font-size:9px; white-space:normal;">${name || ''}</div>`;

    if (!icao) { right.innerHTML = '<div class="kln90b-line dim">NO DATA</div>'; return; }

    right.innerHTML =
        `<div class="kln90b-line dim">METAR/TAF</div>` +
        `<div class="kln90b-line highlight" style="cursor:pointer;" onclick="window.open('https://metar-taf.com/de/${icao}','_blank')">OPEN ▸</div>` +
        `<div class="kln90b-line dim" style="font-size:9px;">metar-taf.com</div>`;
}

function refreshGPSAfterDispatch() {
    if (gpsState.visible) {
        setTimeout(() => renderGPS(), 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGPSButtons();
    initGPSEncoders();
    initCom2Knob();
    restoreAudioButtonStates();

    const el = document.getElementById('swVersionDisplay');
    if (/^https?:$/i.test(window.location.protocol)) {
        // SW Version auslesen und sofort anzeigen (wartet nicht auf Bilder)
        fetch('sw.js', { cache: 'no-store' })
            .then(r => r.text())
            .then(text => {
                const match = text.match(/const CACHE = ['"]([^'"]+)['"]/);
                if (match && el) el.innerText = match[1];
            }).catch(() => {
                if (el) el.innerText = "Offline";
            });
    } else if (el) {
        el.innerText = "FILE-MODE";
    }
});




// === FORCE UPDATE (V53) ===
window.forceAppUpdate = function() {
    if (confirm("Möchtest du ein Update erzwingen? Der Zwischenspeicher wird geleert und die App neu geladen.")) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) { registration.unregister(); }
                caches.keys().then(function(names) {
                    for (let name of names) caches.delete(name);
                    window.location.reload(true);
                });
            });
        } else {
            window.location.reload(true);
        }
    }
};


// === AUTO-RESIZE FÜR CANVAS & KARTE (z.B. bei Rotation in Landscape) ===
let vpWindowResizeTimeout = null;
window.addEventListener('resize', () => {
    if (vpWindowResizeTimeout) clearTimeout(vpWindowResizeTimeout);
    vpWindowResizeTimeout = setTimeout(() => {
        // 1. Leaflet Karte an neue Dimensionen anpassen
        if (typeof map !== 'undefined' && map) map.invalidateSize();
        
        // 2. Profile Canvas an neue Dimensionen anpassen (falls Kartentisch offen)
        const mapTableOverlay = document.getElementById('mapTableOverlay');
        if (mapTableOverlay && mapTableOverlay.classList.contains('active')) {
            if (typeof window.throttledRenderProfiles === 'function') {
                window.throttledRenderProfiles();
            }
        }
    }, 200); // 200ms warten, bis das mobile Gerät die Drehung visuell abgeschlossen hat
});

// Verstecke zielgenau die Zoom- und Y-Achsen-Steuerung inkl. Text-Labels auf mobilen Geräten
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
