// Extrahierte Bush-/APT-Missionsdefinitionen aus app.js.

function _sanitizeBushMissionRef(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const kindRaw = String(raw.kind || '').trim().toLowerCase();
    const kind = ['airport', 'poi', 'area', 'route_point'].includes(kindRaw) ? kindRaw : '';
    if (!kind) return null;
    const out = {
        kind
    };
    if (raw.icao) out.icao = String(raw.icao).trim().toUpperCase();
    if (raw.name) out.name = String(raw.name).trim().slice(0, 120);
    if (Number.isFinite(Number(raw.lat))) out.lat = Number(raw.lat);
    if (Number.isFinite(Number(raw.lon))) out.lon = Number(raw.lon);
    if (Number.isFinite(Number(raw.radiusNm))) out.radiusNm = Math.max(0, Number(raw.radiusNm));
    if (raw.surface) out.surface = String(raw.surface).trim().toLowerCase().slice(0, 40);
    if (Object.prototype.hasOwnProperty.call(raw, 'isRemoteStrip')) out.isRemoteStrip = !!raw.isRemoteStrip;
    if (raw.poiCategory) out.poiCategory = String(raw.poiCategory).trim().toLowerCase().slice(0, 40);
    if (Array.isArray(raw.visualRefs)) out.visualRefs = raw.visualRefs.map(v => String(v || '').trim().toLowerCase()).filter(Boolean).slice(0, 12);
    return out;
}

function _sanitizeBushMissionSuccess(raw = null) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    return {
        minGroundTimeSec: Math.max(0, Number(src.minGroundTimeSec) || 0),
        minAreaTimeSec: Math.max(0, Number(src.minAreaTimeSec) || 0),
        minAreaTrackNm: Math.max(0, Number(src.minAreaTrackNm) || 0),
        cargoMustBeDelivered: !!src.cargoMustBeDelivered,
        passengerMustDeboard: !!src.passengerMustDeboard,
        waypointsRequired: Math.max(0, Math.round(Number(src.waypointsRequired) || 0))
    };
}

function _bushRecipeIdFromProfileId(profileId = '') {
    switch (String(profileId || '').trim().toLowerCase()) {
        case 'bush_supply_strip':
        case 'bush_charter_strip':
        case 'bush_scenic_hopper':
            return 'strip_target';
        case 'bush_pickup_strip':
        case 'bush_pickup_cargo':
            return 'pickup_return';
        case 'bush_recon_return':
            return 'poi_on_task_return';
        default:
            return '';
    }
}

function _bushRecipeIdFromSpec(spec = null) {
    if (!spec || typeof spec !== 'object') return '';
    const fromProfile = _bushRecipeIdFromProfileId(spec.profileId);
    if (fromProfile) return fromProfile;
    const targetMode = String(spec.targetMode || '').trim().toLowerCase();
    const completionMode = String(spec.completionMode || '').trim().toLowerCase();
    const pickupKind = String(spec.pickupKind || '').trim().toLowerCase();
    if (targetMode === 'area_then_return' && completionMode === 'return_home') return 'poi_on_task_return';
    if (targetMode === 'strip_then_return' && completionMode === 'return_home' && ['passenger', 'cargo'].includes(pickupKind)) return 'pickup_return';
    if (targetMode === 'strip' && ['unload_at_target', 'passenger_dropoff', 'land_at_target'].includes(completionMode)) return 'strip_target';
    return '';
}

function _warnBushRecipeGuardrail(profileId = '', messages = [], before = null, after = null) {
    const notes = Array.isArray(messages) ? messages.filter(Boolean) : [];
    if (!notes.length || typeof console === 'undefined' || typeof console.warn !== 'function') return;
    try {
        console.warn('[BushRecipeGuardrail]', {
            profileId: String(profileId || '').trim().toLowerCase() || 'unknown',
            messages: notes,
            before,
            after
        });
    } catch (_) {}
}

function _applyBushRecipeGuardrails(spec = null) {
    if (!spec || typeof spec !== 'object') return spec;
    const recipeId = _bushRecipeIdFromSpec(spec);
    if (!recipeId) return spec;
    const next = { ...spec };
    const before = {
        targetMode: next.targetMode,
        completionMode: next.completionMode,
        requiresReturnHome: !!next.requiresReturnHome,
        pickupKind: next.pickupKind,
        allowedEndLocations: Array.isArray(next.allowedEndLocations) ? [...next.allowedEndLocations] : []
    };
    const messages = [];
    if (recipeId === 'strip_target') {
        if (next.targetMode !== 'strip') {
            next.targetMode = 'strip';
            messages.push('targetMode -> strip');
        }
        if (!['unload_at_target', 'passenger_dropoff', 'land_at_target'].includes(String(next.completionMode || '').toLowerCase())) {
            next.completionMode = 'land_at_target';
            messages.push('completionMode -> land_at_target (Fallback fuer strip_target)');
        }
        if (next.requiresReturnHome) {
            next.requiresReturnHome = false;
            messages.push('requiresReturnHome -> false');
        }
        if (next.pickupKind) {
            next.pickupKind = '';
            messages.push('pickupKind entfernt');
        }
        const ends = Array.isArray(next.allowedEndLocations) ? next.allowedEndLocations : [];
        if (!(ends.length === 1 && ends[0] === 'target')) {
            next.allowedEndLocations = ['target'];
            messages.push('allowedEndLocations -> [target]');
        }
    } else if (recipeId === 'pickup_return') {
        if (next.targetMode !== 'strip_then_return') {
            next.targetMode = 'strip_then_return';
            messages.push('targetMode -> strip_then_return');
        }
        if (next.completionMode !== 'return_home') {
            next.completionMode = 'return_home';
            messages.push('completionMode -> return_home');
        }
        if (!next.requiresReturnHome) {
            next.requiresReturnHome = true;
            messages.push('requiresReturnHome -> true');
        }
        const expectedPickupKind = String(next.profileId || '').trim().toLowerCase() === 'bush_pickup_cargo' ? 'cargo' : 'passenger';
        if (next.pickupKind !== expectedPickupKind) {
            next.pickupKind = expectedPickupKind;
            messages.push(`pickupKind -> ${expectedPickupKind}`);
        }
        const ends = Array.isArray(next.allowedEndLocations) ? next.allowedEndLocations : [];
        if (!(ends.length === 1 && ends[0] === 'home')) {
            next.allowedEndLocations = ['home'];
            messages.push('allowedEndLocations -> [home]');
        }
    } else if (recipeId === 'poi_on_task_return') {
        if (next.targetMode !== 'area_then_return') {
            next.targetMode = 'area_then_return';
            messages.push('targetMode -> area_then_return');
        }
        if (next.completionMode !== 'return_home') {
            next.completionMode = 'return_home';
            messages.push('completionMode -> return_home');
        }
        if (!next.requiresReturnHome) {
            next.requiresReturnHome = true;
            messages.push('requiresReturnHome -> true');
        }
        if (next.pickupKind) {
            next.pickupKind = '';
            messages.push('pickupKind entfernt');
        }
        const ends = Array.isArray(next.allowedEndLocations) ? next.allowedEndLocations : [];
        if (!(ends.length === 1 && ends[0] === 'home')) {
            next.allowedEndLocations = ['home'];
            messages.push('allowedEndLocations -> [home]');
        }
        if (!next.areaRef && next.targetRef?.lat != null && next.targetRef?.lon != null) {
            messages.push('areaRef fehlt fuer poi_on_task_return und sollte beim Missionsbau gesetzt werden');
        }
    }
    _warnBushRecipeGuardrail(next.profileId, messages, before, {
        targetMode: next.targetMode,
        completionMode: next.completionMode,
        requiresReturnHome: !!next.requiresReturnHome,
        pickupKind: next.pickupKind,
        allowedEndLocations: Array.isArray(next.allowedEndLocations) ? [...next.allowedEndLocations] : []
    });
    return next;
}

function sanitizeBushMissionSpec(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const targetModeRaw = String(raw.targetMode || '').trim().toLowerCase();
    const completionModeRaw = String(raw.completionMode || '').trim().toLowerCase();
    const targetMode = ['strip', 'area', 'route', 'strip_then_return', 'area_then_return'].includes(targetModeRaw) ? targetModeRaw : '';
    const completionMode = ['land_at_target', 'unload_at_target', 'passenger_dropoff', 'recon_in_area', 'visit_waypoints', 'return_home'].includes(completionModeRaw) ? completionModeRaw : '';
    if (!targetMode || !completionMode) return null;
    return _applyBushRecipeGuardrails({
        profileId: String(raw.profileId || 'bush_generic').trim().toLowerCase().slice(0, 80),
        targetMode,
        completionMode,
        reconFocus: String(raw.reconFocus || '').trim().slice(0, 240),
        reconFocusLabel: String(raw.reconFocusLabel || '').trim().slice(0, 120),
        requiresReturnHome: !!raw.requiresReturnHome,
        pickupKind: ['passenger', 'cargo'].includes(String(raw.pickupKind || '').trim().toLowerCase()) ? String(raw.pickupKind || '').trim().toLowerCase() : '',
        pickupLabel: String(raw.pickupLabel || '').trim().slice(0, 120),
        pickupRole: String(raw.pickupRole || '').trim().slice(0, 120),
        pickupGreetingText: String(raw.pickupGreetingText || '').trim().slice(0, 320),
        pickupPassengerCount: Math.max(0, Math.min(6, Math.round(Number(raw.pickupPassengerCount) || 0))),
        homeRef: _sanitizeBushMissionRef(raw.homeRef),
        targetRef: _sanitizeBushMissionRef(raw.targetRef),
        areaRef: _sanitizeBushMissionRef(raw.areaRef),
        routeRefs: Array.isArray(raw.routeRefs) ? raw.routeRefs.map(_sanitizeBushMissionRef).filter(Boolean).slice(0, 12) : [],
        success: _sanitizeBushMissionSuccess(raw.success),
        allowedEndLocations: Array.isArray(raw.allowedEndLocations)
            ? raw.allowedEndLocations.map(v => String(v || '').trim().toLowerCase()).filter(v => v === 'target' || v === 'home').slice(0, 2)
            : [],
        narrativeMode: String(raw.narrativeMode || raw.profileId || 'bush_generic').trim().toLowerCase().slice(0, 80),
        riskFlags: Array.isArray(raw.riskFlags) ? raw.riskFlags.map(v => String(v || '').trim().toLowerCase()).filter(Boolean).slice(0, 16) : [],
        opsNotes: Array.isArray(raw.opsNotes) ? raw.opsNotes.map(v => String(v || '').trim()).filter(Boolean).slice(0, 12) : []
    });
}

function buildInitialBushMissionProgress(spec = null) {
    return {
        status: spec?.targetMode === 'strip_then_return' ? 'outbound_empty' : 'enroute',
        targetReached: false,
        areaEnteredAt: 0,
        areaQualified: false,
        groundStopQualified: false,
        cargoDelivered: false,
        passengerDropped: false,
        returnHomeQualified: false,
        pickupReady: false,
        pickupCompleted: false,
        pickupConfirmed: false,
        areaDwellSec: 0,
        areaTrackNm: 0,
        lastAreaSampleLat: NaN,
        lastAreaSampleLon: NaN,
        lastAreaSampleTs: 0,
        visitedRouteRefs: []
    };
}

const BUSH_DISPATCH_PROFILES = {
    bush_supply_strip: {
        id: 'bush_supply_strip',
        label: 'Backcountry Supply',
        icon: '📦',
        category: 'bush_supply',
        completionMode: 'unload_at_target',
        narrativeMode: 'backcountry_supply',
        cargoPool: [
            'Versorgungskisten und Werkzeug (86 lbs)',
            'Medkits und Funkbatterien (54 lbs)',
            'Camp-Proviant und Ersatzteile (92 lbs)',
            'Treibstoffkanister und Wartungskit (118 lbs)'
        ],
        opsNotes: [
            'Stabiler Short-Field-Anflug, kein Hektik-Pattern.',
            'Abladefreigabe erst nach vollem Stillstand am Zielstrip.'
        ]
    },
    bush_charter_strip: {
        id: 'bush_charter_strip',
        label: 'Bush Charter',
        icon: '🧭',
        category: 'bush_charter',
        completionMode: 'passenger_dropoff',
        narrativeMode: 'backcountry_charter',
        cargoPool: [
            'Duffelbags und Kameraausruestung (42 lbs)',
            'Campingausruestung und Tagesrucksaecke (58 lbs)',
            'Arbeitskoffer und Funkgeraet (26 lbs)'
        ],
        opsNotes: [
            'Ruhiger Tal-/Gelandeanflug fuer einen kontrollierten Ausstieg am Strip.',
            'Passagier-Dropoff erst nach gesichertem Stillstand.'
        ]
    },
    bush_scenic_hopper: {
        id: 'bush_scenic_hopper',
        label: 'Bush Adventure Hopper',
        icon: '🏔️',
        category: 'bush_adventure',
        completionMode: 'land_at_target',
        narrativeMode: 'backcountry_adventure',
        cargoPool: [
            'Tagesrucksaecke und Fotoequipment (24 lbs)',
            'Outdoor-Kit und Kartenrolle (18 lbs)',
            'Angel- und Camptaschen (34 lbs)'
        ],
        opsNotes: [
            'Backcountry-Charakter: Strecke ruhig lesen, Terrain bewusst managen.',
            'Mission gilt erst nach sauberer Landung und kurzer Standphase am Zielstrip.'
        ]
    },
    bush_recon_return: {
        id: 'bush_recon_return',
        label: 'Bush Recon and Return',
        icon: '🗺️',
        category: 'bush_recon',
        completionMode: 'return_home',
        narrativeMode: 'backcountry_recon_return',
        cargoPool: [
            'Strip-Checkliste, Kamera und Funkmappe (18 lbs)',
            'Inspektionskoffer, Markierspray und Tablet (24 lbs)',
            'Werkzeugrolle, Foto-Kit und Betriebsunterlagen (21 lbs)'
        ],
        opsNotes: [
            'Ziel ist ein kurzer Recon-Run ueber Strip, Vorfeld oder Anflugraum, nicht nur die Landung am Platz.',
            'Mission endet erst nach Rueckkehr und Stillstand am Heimatplatz.'
        ]
    },
    bush_pickup_strip: {
        id: 'bush_pickup_strip',
        label: 'Bush Pickup and Return',
        icon: '🛻',
        category: 'bush_pickup',
        completionMode: 'return_home',
        narrativeMode: 'backcountry_pickup_return',
        cargoPool: [
            'Leichter Rueckflug-Survival-Kit und Funkmappe (12 lbs)',
            'Basis-Werkzeug und Lash-Straps fuer den Leerflug (18 lbs)',
            'Nur Bordunterlagen und Notfallausruestung fuer den Pickup-Leg (8 lbs)'
        ],
        opsNotes: [
            'Outbound bewusst leer halten, Pickup erst am Zielstrip aufnehmen.',
            'Mission endet erst nach Rueckkehr und gesichertem Ausstieg am Heimatplatz.'
        ]
    },
    bush_pickup_cargo: {
        id: 'bush_pickup_cargo',
        label: 'Bush Cargo Pickup and Return',
        icon: '📦',
        category: 'bush_pickup_cargo',
        completionMode: 'return_home',
        narrativeMode: 'backcountry_pickup_return',
        cargoPool: [
            'Ersatzteilkiste und Werkzeugtasche fuer den Rueckflug (46 lbs)',
            'Funkakku-Case und Wartungsunterlagen fuer die Heimholung (34 lbs)',
            'Versiegelte Utility-Kiste mit Betriebsbedarf fuer den RTB-Leg (58 lbs)'
        ],
        opsNotes: [
            'Outbound bewusst leer halten, Pickup-Fracht erst am Zielstrip aufnehmen.',
            'Mission endet erst nach Rueckkehr und gesichertem Ausladen am Heimatplatz.'
        ]
    }
};

const BUSH_PERSONA_LIBRARY = {
    bush_charter_strip: [
        {
            name: 'Maya Brooks',
            role: 'Rangerin',
            gender: 'female',
            greetingText: 'Danke fuers Fliegen. Wir laden am Strip aus und gehen danach direkt ins Gelaende.'
        },
        {
            name: 'Cole Mercer',
            role: 'Lodge Manager',
            gender: 'male',
            greetingText: 'Danke fuers Mitnehmen. Wir haben Ausruestung dabei und brauchen eine ruhige Landung am Zielstrip.'
        }
    ],
    bush_scenic_hopper: [
        {
            name: 'Evan Holt',
            role: 'Outdoor Guide',
            gender: 'male',
            greetingText: 'Heute geht es in die Wildnis. Ein ruhiger Bush-Hop zum Strip reicht uns voellig.'
        },
        {
            name: 'Leah Carter',
            role: 'Fotografin',
            gender: 'female',
            greetingText: 'Perfekt, danke. Ich will den Flug ruhig halten und am Ziel ein paar Tage draussen arbeiten.'
        }
    ],
    bush_recon_return: [
        {
            name: 'Nora Hale',
            role: 'Airstrip-Inspektorin',
            gender: 'female',
            greetingText: 'Wir schauen uns dort draussen heute den Zustand von Strip, Vorfeld und Anflugraum an. Wenn das Lagebild sauber ist, drehen wir ohne Umweg wieder heim.'
        },
        {
            name: 'Grant Mercer',
            role: 'Ranger-Koordinator',
            gender: 'male',
            greetingText: 'Ich brauche nur einen ruhigen Kontrollflug ueber den Platz und die direkte Umgebung. Danach haben wir genug fuer den Bericht und gehen direkt wieder zurueck.'
        },
        {
            name: 'Elena Brooks',
            role: 'Backcountry-Operationsleiterin',
            gender: 'female',
            greetingText: 'Nach dem letzten Wetterzug wollen wir dort unten keine Ueberraschungen auf dem Strip haben. Ein sauberer Ueberflug, ein kurzer Check aus der Luft und dann direkt wieder heim.'
        },
        {
            name: 'Mason Reed',
            role: 'Forst-Ranger',
            gender: 'male',
            greetingText: 'Am Platz gab es zuletzt Hinweise auf Treibholz, tiefe Spurrinnen und moegliche Hindernisse im Zufahrtsbereich. Wir machen die Runde sauber, notieren alles und fliegen dann ohne Stop wieder raus.'
        }
    ],
    bush_pickup_strip: [
        {
            name: 'Tessa Rowan',
            role: 'Rangerin',
            gender: 'female',
            greetingText: 'Gut, dass du da bist. Ich habe seit gestern den oberen Talabschnitt kontrolliert und will vor dem Wetterwechsel wieder runter nach McCall. Wenn wir hier weg sind, erzaehle ich dir unterwegs, was die Rangerstation diese Woche im Bear Valley eingesammelt hat.'
        },
        {
            name: 'Luke Mercer',
            role: 'Mechaniker',
            gender: 'male',
            greetingText: 'Perfektes Timing. Ich war hier draussen noch an einer Generator-Reparatur und habe jetzt Werkzeug, Notizen und genug Geschichten fuer den Rueckflug dabei. Bring mich einfach wieder nach McCall, dann bin ich rechtzeitig zur naechsten Schicht zurueck.'
        }
    ]
};

const BUSH_RECON_OBJECTIVES = [
    {
        label: 'Runway-Zustandscheck',
        focus: 'am Zielstrip Schlagloecher, Auswaschungen und weiche Stellen auf Bahn und Randstreifen kontrollieren',
        story: 'Vor Ort braucht ihr einen ruhigen Kontrollflug ueber Bahn, Randstreifen und Anflugsektoren, um Spurrinnen, Auswaschungen oder weiche Stellen frueh zu erkennen.'
    },
    {
        label: 'Sturmschaden-Check',
        focus: 'nach Wind und Wetter Vorfeld, Windsack, Zaunlinie und abgestellte Geraete auf Sturmschaeden pruefen',
        story: 'Im Zielgebiet sollt ihr die Folgen des letzten Wetterdurchgangs bewerten und dokumentieren, ob Windsack, Vorfeld oder Randbereiche fuer den Betrieb eingeschraenkt sind.'
    },
    {
        label: 'Hindernis- und Sicherheitscheck',
        focus: 'nach liegengebliebenem Fahrzeug, abgestelltem Flugzeug oder sonstigen Hindernissen nahe Strip und Rollweg suchen',
        story: 'Der Einsatz dreht sich heute um ein klares Lagebild zu moeglichen Hindernissen am Strip, im Rollbereich und in den unmittelbaren Ausweichflaechen.'
    },
    {
        label: 'Drainage- und Randbereichskontrolle',
        focus: 'Entwaesserung, Wasserlaeufe, Unterspuelungen und weiche Randzonen rund um den Platz aus der Luft abschaetzen',
        story: 'Im Fokus stehen heute Drainage, Randzonen und moegliche Unterspuelungen, damit der Platz nach der naechsten Niederschlagsphase nicht ueberraschend unbrauchbar wird.'
    },
    {
        label: 'Betriebsflaechen-Check',
        focus: 'Abstellflaeche, Vorfeldkante, Zufahrt und Materiallager auf Stoerungen oder lose Gegenstaende kontrollieren',
        story: 'Ihr fliegt ein kurzes Backcountry-Lagebild fuer die Betriebsflaechen und pruft, ob Vorfeld, Zufahrt und Materialzonen fuer den naechsten Verkehr sauber nutzbar sind.'
    }
];

function _pickBushReconObjective() {
    return { ...(BUSH_RECON_OBJECTIVES[Math.floor(Math.random() * BUSH_RECON_OBJECTIVES.length)] || BUSH_RECON_OBJECTIVES[0]) };
}

function _getBushProfileDefinition(profileId = 'auto') {
    const id = String(profileId || 'auto').trim().toLowerCase();
    if (id && id !== 'auto' && BUSH_DISPATCH_PROFILES[id]) return BUSH_DISPATCH_PROFILES[id];
    return BUSH_DISPATCH_PROFILES.bush_supply_strip;
}

function _pickBushPersona(profileId = 'bush_charter_strip') {
    const pool = Array.isArray(BUSH_PERSONA_LIBRARY[profileId]) ? BUSH_PERSONA_LIBRARY[profileId] : [];
    if (!pool.length) return null;
    return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function _buildBushPassenger(profileId = 'bush_charter_strip') {
    const persona = _pickBushPersona(profileId);
    if (!persona) return null;
    const passenger = buildCharterPassenger(persona);
    if (!passenger || typeof passenger !== 'object') return null;
    passenger.role = String(persona.role || passenger.role || 'Bush Passenger').trim();
    passenger.greetingText = String(persona.greetingText || passenger.greetingText || '').trim();
    passenger.roleProfile = profileId === 'bush_scenic_hopper'
        ? 'bush_adventure_guest_v1'
        : (profileId === 'bush_recon_return'
            ? 'technical_inspector_v1'
            : (profileId === 'bush_pickup_strip' ? 'bush_pickup_guest_v1' : 'bush_charter_guest_v1'));
    passenger.taskDomain = profileId === 'bush_scenic_hopper'
        ? 'sightseeing_tour'
        : (profileId === 'bush_recon_return' ? 'inspection_infra' : 'charter');
    return passenger;
}

function pickAutoBushProfileId({ destAirport = null } = {}) {
    const bushScore = Number(destAirport?.bushScore || 0);
    const weighted = [];
    const pushMany = (id, n) => { for (let i = 0; i < n; i++) weighted.push(id); };
    pushMany('bush_supply_strip', bushScore >= 5 ? 4 : 3);
    pushMany('bush_charter_strip', bushScore >= 5 ? 3 : 2);
    pushMany('bush_scenic_hopper', bushScore >= 4 ? 3 : 2);
    pushMany('bush_recon_return', bushScore >= 4 ? 2 : 1);
    pushMany('bush_pickup_strip', bushScore >= 4 ? 2 : 1);
    pushMany('bush_pickup_cargo', bushScore >= 4 ? 2 : 1);
    return _pickFromWeightedWithRecentGuard(weighted, 'ga_bush_auto_profile_history', {
        fallback: 'bush_supply_strip',
        recentLimit: 2
    });
}

function buildBushMissionRefFromAirport(airport = null) {
    if (!airport || typeof airport !== 'object') return null;
    const lat = Number(airport.lat);
    const lon = Number(airport.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        kind: 'airport',
        icao: String(airport.icao || '').trim().toUpperCase(),
        name: String(airport.n || airport.name || airport.city || airport.icao || 'Bush Strip').trim(),
        lat,
        lon,
        surface: String(airport.surface || 'unknown').trim().toLowerCase(),
        isRemoteStrip: !!(airport.isRemoteStrip || Number(airport.bushScore || 0) >= 4)
    };
}

function buildBushAreaRefFromAirport(airport = null, radiusNm = 0) {
    const base = buildBushMissionRefFromAirport(airport);
    if (!base) return null;
    const visualRefs = [];
    const terrainHint = normalizeMissionText(base.name || airport?.name || airport?.n || '');
    if (/lake|river|creek/.test(terrainHint)) visualRefs.push('water');
    if (/mountain|ridge|peak|canyon|valley/.test(terrainHint)) visualRefs.push('terrain');
    if (/forest|meadow|prairie/.test(terrainHint)) visualRefs.push('wildland');
    return {
        kind: 'area',
        name: `${base.name} Recon Area`,
        lat: base.lat,
        lon: base.lon,
        radiusNm: Math.max(1.5, Number(radiusNm) || 3),
        visualRefs
    };
}

function buildBushMissionSpec({ profileId = 'bush_supply_strip', startAirport = null, destAirport = null, distNm = 0 } = {}) {
    const profile = _getBushProfileDefinition(profileId);
    const homeRef = buildBushMissionRefFromAirport(startAirport);
    const targetRef = buildBushMissionRefFromAirport(destAirport);
    if (!homeRef || !targetRef) return null;
    const riskFlags = [];
    if (targetRef.isRemoteStrip) riskFlags.push('remote_strip');
    if (Number.isFinite(Number(destAirport?.elevation)) && Number(destAirport.elevation) >= 4500) riskFlags.push('high_density_altitude');
    if (Number.isFinite(Number(distNm)) && Number(distNm) >= 90) riskFlags.push('range_management');
    const terrainHint = normalizeMissionText(destAirport?.n || destAirport?.name || '');
    if (/mountain|ridge|peak|creek|canyon|valley|forest|river|lake/.test(terrainHint)) riskFlags.push('terrain_awareness');
    if (profile.id === 'bush_recon_return') {
        const areaRadiusNm = Number(distNm) >= 80 ? 4.5 : 3.2;
        const areaRef = buildBushAreaRefFromAirport(destAirport, areaRadiusNm);
        const reconObjective = _pickBushReconObjective();
        return sanitizeBushMissionSpec({
            profileId: profile.id,
            targetMode: 'area_then_return',
            completionMode: 'return_home',
            reconFocus: reconObjective.focus,
            reconFocusLabel: reconObjective.label,
            requiresReturnHome: true,
            homeRef,
            targetRef,
            areaRef,
            routeRefs: targetRef ? [targetRef] : [],
            success: {
                minGroundTimeSec: 8,
                minAreaTimeSec: 120,
                minAreaTrackNm: 2.5,
                cargoMustBeDelivered: false,
                passengerMustDeboard: false,
                waypointsRequired: 0
            },
            allowedEndLocations: ['home'],
            narrativeMode: profile.narrativeMode,
            riskFlags: [...riskFlags, 'return_leg_required'],
            opsNotes: profile.opsNotes
        });
    }
    if (profile.id === 'bush_pickup_strip') {
        const pickupPassenger = _buildBushPassenger(profile.id);
        return sanitizeBushMissionSpec({
            profileId: profile.id,
            targetMode: 'strip_then_return',
            completionMode: 'return_home',
            requiresReturnHome: true,
            pickupKind: 'passenger',
            pickupLabel: pickupPassenger?.name ? `${pickupPassenger.name} (${pickupPassenger.role || 'Bush Pickup'})` : 'Bush Pickup Passenger',
            pickupRole: String(pickupPassenger?.role || 'Bush Pickup Passenger').trim(),
            pickupGreetingText: String(pickupPassenger?.greetingText || '').trim(),
            pickupPassengerCount: 1,
            homeRef,
            targetRef,
            areaRef: null,
            routeRefs: targetRef ? [targetRef] : [],
            success: {
                minGroundTimeSec: 8,
                minAreaTimeSec: 0,
                minAreaTrackNm: 0,
                cargoMustBeDelivered: false,
                passengerMustDeboard: true,
                waypointsRequired: 0
            },
            allowedEndLocations: ['home'],
            narrativeMode: profile.narrativeMode,
            riskFlags: [...riskFlags, 'pickup_required', 'return_leg_required'],
            opsNotes: profile.opsNotes
        });
    }
    if (profile.id === 'bush_pickup_cargo') {
        const pickupCargo = profile.cargoPool[Math.floor(Math.random() * profile.cargoPool.length)] || 'Bush Pickup Cargo';
        return sanitizeBushMissionSpec({
            profileId: profile.id,
            targetMode: 'strip_then_return',
            completionMode: 'return_home',
            requiresReturnHome: true,
            pickupKind: 'cargo',
            pickupLabel: String(pickupCargo).trim(),
            pickupRole: 'Bush Cargo Pickup',
            pickupGreetingText: '',
            pickupPassengerCount: 0,
            homeRef,
            targetRef,
            areaRef: null,
            routeRefs: targetRef ? [targetRef] : [],
            success: {
                minGroundTimeSec: 8,
                minAreaTimeSec: 0,
                minAreaTrackNm: 0,
                cargoMustBeDelivered: true,
                passengerMustDeboard: false,
                waypointsRequired: 0
            },
            allowedEndLocations: ['home'],
            narrativeMode: profile.narrativeMode,
            riskFlags: [...riskFlags, 'pickup_required', 'return_leg_required'],
            opsNotes: profile.opsNotes
        });
    }
    return sanitizeBushMissionSpec({
        profileId: profile.id,
        targetMode: 'strip',
        completionMode: profile.completionMode,
        requiresReturnHome: false,
        homeRef,
        targetRef,
        areaRef: null,
        routeRefs: [],
        success: {
            minGroundTimeSec: profile.completionMode === 'land_at_target' ? 5 : 8,
            minAreaTimeSec: 0,
            minAreaTrackNm: 0,
            cargoMustBeDelivered: profile.completionMode === 'unload_at_target',
            passengerMustDeboard: profile.completionMode === 'passenger_dropoff',
            waypointsRequired: 0
        },
        allowedEndLocations: ['target'],
        narrativeMode: profile.narrativeMode,
        riskFlags,
        opsNotes: profile.opsNotes
    });
}

function buildBushMissionEnvelope({ profileId = 'bush_supply_strip', startAirport = null, destAirport = null, distNm = 0 } = {}) {
    const profile = _getBushProfileDefinition(profileId);
    const targetName = String(destAirport?.n || destAirport?.name || destAirport?.icao || 'Remote Strip').trim();
    const homeName = String(startAirport?.n || startAirport?.name || startAirport?.icao || 'Startplatz').trim();
    const bushSpec = buildBushMissionSpec({ profileId: profile.id, startAirport, destAirport, distNm });
    let passenger = null;
    let paxText = '0 PAX';
    let cargoText = profile.cargoPool[Math.floor(Math.random() * profile.cargoPool.length)] || 'Bush Load';
    let title = `Bush-Hopper nach ${targetName}`;
    let story = `Ein kurzer Backcountry-Transfer fuehrt dich heute von ${homeName} nach ${targetName}. Flugweg, Energie und Landung sollen bewusst konservativ bleiben.`;
    if (profile.id === 'bush_supply_strip') {
        title = `Backcountry Supply: ${targetName}`;
        story = `Ein abgelegener Strip bei ${targetName} braucht heute eine kleine Versorgungsladung aus ${homeName}. Keine Hektik: sauber navigieren, das Gelaende lesen und erst nach vollem Stillstand am Ziel entladen.`;
        paxText = '0 PAX';
    } else if (profile.id === 'bush_charter_strip') {
        passenger = _buildBushPassenger(profile.id);
        title = `Bush Charter: ${targetName}`;
        story = `${passenger?.role || 'Ein Chartergast'} muss von ${homeName} zu einem abgelegenen Strip bei ${targetName}. Der Auftrag lebt von ruhiger Flugfuehrung, sauberem Terrain-Management und einem kontrollierten Ausstieg direkt am Ziel.`;
        paxText = passenger?.role ? `1 PAX (${passenger.role})` : '1 PAX';
    } else if (profile.id === 'bush_scenic_hopper') {
        passenger = _buildBushPassenger(profile.id);
        title = `Bush Adventure: ${targetName}`;
        story = `${passenger?.role || 'Ein Gast'} nutzt den Flug von ${homeName} nach ${targetName} als echten Backcountry-Hop. Kein Arbeitsauftrag, sondern ein kontrollierter Adventure-Leg mit Fokus auf Aussicht, Gelande und einer sauberen Landung am Strip.`;
        paxText = passenger?.role ? `1 PAX (${passenger.role})` : '1 PAX';
    } else if (profile.id === 'bush_recon_return') {
        passenger = _buildBushPassenger(profile.id);
        const reconFocusLabel = String(bushSpec?.reconFocusLabel || 'Strip-Check').trim();
        const reconStory = String(bushSpec?.reconFocus || '').trim();
        title = `Bush Recon RTB: ${targetName}`;
        story = `${passenger?.role || 'Ein Beobachter'} fliegt heute mit dir von ${homeName} nach ${targetName}, um dort einen ${reconFocusLabel} durchzufuehren. Vor Ort braucht ihr einen kurzen sauberen Recon-Run ueber dem Zielbereich und den Betriebsflaechen; konkret sollt ihr ${reconStory || 'den Zustand von Strip und Umfeld bewerten'}. Danach geht es ohne Zwischenstopp wieder zurueck an den Heimatplatz.`;
        paxText = passenger?.role ? `1 PAX (${passenger.role})` : '1 PAX';
    } else if (profile.id === 'bush_pickup_strip') {
        passenger = _buildBushPassenger(profile.id);
        title = `Bush Pickup RTB: ${targetName}`;
        story = `${passenger?.role || 'Ein Rueckflug-Passagier'} wartet heute an einem abgelegenen Strip bei ${targetName} auf Abholung. Du fliegst leer von ${homeName} raus, nimmst den Gast nach der Landung direkt am Strip auf und bringst ihn ohne Umweg wieder zurueck zum Heimatplatz.`;
        paxText = passenger?.role ? `0 PAX am Start · 1 PAX Pickup (${passenger.role})` : '0 PAX am Start · 1 PAX Pickup';
        cargoText = '-';
    } else if (profile.id === 'bush_pickup_cargo') {
        title = `Bush Cargo RTB: ${targetName}`;
        story = `An einem abgelegenen Strip bei ${targetName} wartet heute eine Rueckholfracht auf Abholung. Du fliegst leer von ${homeName} raus, nimmst die bereitliegende Ladung nach der Landung direkt am Treffpunkt auf und bringst sie ohne Zwischenstopp wieder zum Heimatplatz.`;
        paxText = '0 PAX';
        cargoText = '-';
    }
    return {
        mission: {
            i: profile.icon,
            t: title,
            s: story,
            cat: profile.category,
            passenger,
            missionType: 'bush',
            bush: bushSpec,
            _source: 'Lokaler Bush-Generator',
            _requestedProfile: profile.id,
            _appliedProfile: profile.id
        },
        paxText,
        cargoText
    };
}

function pickBushArrivalVehicleSpec({ bush = null, dest = null, mission = null, profileId = '' } = {}) {
    const completionMode = String(bush?.completionMode || '').toLowerCase();
    const seedText = [
        bush?.profileId,
        profileId,
        dest?.icao,
        dest?.n,
        dest?.name,
        mission?.t
    ].filter(Boolean).join('|');
    let hash = 0;
    for (let i = 0; i < seedText.length; i += 1) hash = ((hash * 31) + seedText.charCodeAt(i)) >>> 0;
    const terrainText = normalizeMissionText([
        dest?.n,
        dest?.name,
        mission?.t,
        mission?.s
    ].filter(Boolean).join(' '));
    const remoteBias = !!(bush?.targetRef?.isRemoteStrip || bush?.riskFlags?.includes?.('remote_strip'));
    const roughBias = /ranch|camp|creek|backcountry|river|lake|forest|canyon|valley|ridge|mountain|mesa|wilderness|lodge/.test(terrainText);
    let choices;
    if (completionMode === 'unload_at_target') {
        choices = roughBias || remoteBias
            ? [
                { role: 'vehicle.truck', label: 'Bush-Pickup', cue: 'Pickup oder Utility-Fahrzeug seitlich der Bahn' },
                { role: 'vehicle.quad', label: 'Bush-Quad', cue: 'Quad oder Utility-Fahrzeug seitlich der Bahn' },
                { role: 'vehicle.car', label: 'Gelaendewagen', cue: 'kleiner Gelaendewagen am Striprand' }
            ]
            : [
                { role: 'vehicle.truck', label: 'Bush-Pickup', cue: 'Pickup oder Utility-Fahrzeug seitlich der Bahn' },
                { role: 'vehicle.car', label: 'Gelaendewagen', cue: 'kleiner Gelaendewagen am Striprand' },
                { role: 'vehicle.quad', label: 'Bush-Quad', cue: 'Quad oder Utility-Fahrzeug seitlich der Bahn' }
            ];
    } else if (completionMode === 'passenger_dropoff') {
        choices = [
            { role: 'vehicle.car', label: 'Gelaendewagen', cue: 'Gelaendewagen oder lokaler Kontakt seitlich der Bahn' },
            { role: 'vehicle.quad', label: 'Bush-Quad', cue: 'Quad oder lokaler Kontakt seitlich der Bahn' },
            { role: 'vehicle.truck', label: 'Bush-Pickup', cue: 'Pickup oder lokaler Kontakt am Striprand' }
        ];
    } else {
        choices = [
            { role: 'vehicle.quad', label: 'Bush-Quad', cue: 'kleines Bush-Fahrzeug am Striprand' },
            { role: 'vehicle.car', label: 'Gelaendewagen', cue: 'kleiner Gelaendewagen am Striprand' },
            { role: 'vehicle.truck', label: 'Bush-Pickup', cue: 'Pickup am Striprand' }
        ];
    }
    return choices[hash % choices.length] || choices[0] || { role: 'vehicle.car', label: 'Gelaendewagen', cue: 'lokaler Kontakt seitlich der Bahn' };
}

function normalizeAptArrivalRole({ profileId = '', passenger = null, paxText = '', cargoText = '', mission = null, missionPlanV2 = null, missionType = '', bushSpec = null, dest = null } = {}) {
    const normalizedMissionType = normalizeMissionType(missionType || mission?.missionType || passenger?.missionType || '', false);
    const bush = normalizedMissionType === 'bush'
        ? sanitizeBushMissionSpec(bushSpec || mission?.bush || passenger?.bush || null)
        : null;
    if (bush && bush.targetMode === 'strip_then_return' && ['passenger', 'cargo'].includes(String(bush.pickupKind || '').toLowerCase())) {
        const bushTargetName = String(bush?.targetRef?.name || dest?.n || dest?.name || dest?.icao || 'Remote Strip').trim();
        const bushVehicle = pickBushArrivalVehicleSpec({ bush, dest, mission, profileId });
        const pickupKind = String(bush.pickupKind || '').toLowerCase();
        return {
            role: 'bush_strip_pickup',
            roleLabel: pickupKind === 'cargo' ? 'Bush-Cargo-Pickup' : 'Bush-Pickup',
            expectedBy: bush.pickupRole || (pickupKind === 'cargo' ? 'lokaler Frachtkontakt' : 'lokaler Pickup-Gast'),
            visibleCue: bushVehicle.cue,
            vehicleRole: bushVehicle.role,
            vehicleLabel: bushVehicle.label,
            personRole: 'person.ground_crew',
            equipmentRole: pickupKind === 'cargo' ? 'cargo.small_box' : '',
            narrativeHint: pickupKind === 'cargo'
                ? `Am Zielstrip wartet eine Bush-Frachtaufnahme fuer ${bushTargetName}. Die Rueckholfracht liegt am Treffpunkt fuer den Heimflug bereit.`
                : `Am Zielstrip wartet ein Bush-Pickup fuer ${bushTargetName}. Der Gast steht am Treffpunkt fuer den Rueckflug bereit.`
        };
    }
    if (bush && !bush.requiresReturnHome) {
        const bushTargetName = String(bush?.targetRef?.name || dest?.n || dest?.name || dest?.icao || 'Remote Strip').trim();
        const bushVehicle = pickBushArrivalVehicleSpec({ bush, dest, mission, profileId });
        if (bush.completionMode === 'unload_at_target') {
            return {
                role: 'bush_strip_handoff',
                roleLabel: 'Bush-Versorgungsuebergabe',
                expectedBy: 'Platzkontakt oder Lodge-/Camp-Crew',
                visibleCue: bushVehicle.cue,
                vehicleRole: bushVehicle.role,
                vehicleLabel: bushVehicle.label,
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.small_box',
                narrativeHint: `Am Zielstrip wartet eine kurze Uebergabe am Bahnrand fuer ${bushTargetName}.`
            };
        }
        if (bush.completionMode === 'passenger_dropoff') {
            return {
                role: 'bush_strip_dropoff',
                roleLabel: 'Bush-Dropoff',
                expectedBy: 'Lodge-/Backcountry-Kontakt',
                visibleCue: bushVehicle.cue,
                vehicleRole: bushVehicle.role,
                vehicleLabel: bushVehicle.label,
                personRole: 'person.ground_crew',
                equipmentRole: '',
                narrativeHint: `Am Zielstrip ist ein kurzer Bush-Dropoff fuer ${bushTargetName} vorgesehen.`
            };
        }
        return {
            role: 'bush_strip_meet',
            roleLabel: 'Bush-Treffpunkt',
            expectedBy: 'lokaler Platz- oder Backcountry-Kontakt',
            visibleCue: bushVehicle.cue,
            vehicleRole: bushVehicle.role,
            vehicleLabel: bushVehicle.label,
            personRole: 'person.ground_crew',
            equipmentRole: '',
            narrativeHint: `Am Zielstrip ist ein kurzer Treffpunkt am Bahnrand bei ${bushTargetName} vorgesehen.`
        };
    }
    const plan = getMissionPlanV2Plan(missionPlanV2);
    const planTask = String(plan?.taskDomain || plan?.lockedFields?.taskDomain || '').toLowerCase();
    if (planTask) {
        if (/training|instructor/.test(planTask)) {
            return { role: 'none' };
        }
        if (/medical|medevac|patient/.test(planTask)) {
            return {
                role: 'medical_handoff',
                roleLabel: 'medizinische Uebergabe',
                expectedBy: 'medizinisches Empfangsteam',
                visibleCue: 'Rettungswagen oder medizinisches Empfangsteam',
                vehicleRole: 'vehicle.emergency.medical',
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.medical_kit',
                narrativeHint: 'Am Ziel ist eine ruhige medizinische Uebergabe am Vorfeld geplant.'
            };
        }
        if (/cargo|logistic|fragile/.test(planTask)) {
            return {
                role: 'cargo_handoff',
                roleLabel: 'Frachtuebergabe',
                expectedBy: 'Frachtkontakt am Vorfeld',
                visibleCue: 'Fracht-Van oder Abholfahrzeug',
                vehicleRole: 'vehicle.van',
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.small_box',
                narrativeHint: 'Am Ziel wartet die Frachtuebergabe an einem sicheren Vorfeld- oder Parkingbereich.'
            };
        }
        if (/animal/.test(planTask)) {
            const animalSpec = pickAnimalTransportSceneSpec([
                cargoText,
                mission?.s,
                mission?.t,
                paxText
            ].filter(Boolean).join(' '));
            const handoffLabel = animalTransportBoxLabel(animalSpec);
            return {
                role: 'animal_handoff',
                roleLabel: 'Tiertransport-Uebergabe',
                expectedBy: 'Tierpflege- oder Vereinskontakt',
                visibleCue: `${handoffLabel} am Tierpflege-Van`,
                vehicleRole: 'vehicle.van',
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.animal_transport_box',
                animalSpec,
                narrativeHint: `Am Ziel ist eine stressarme Uebergabe fuer ${handoffLabel} am Vorfeld vorgesehen.`
            };
        }
        if (/media|news/.test(planTask)) {
            return {
                role: 'media_pickup',
                roleLabel: 'Medien-Abholung',
                expectedBy: 'Redaktions- und Kamerateam',
                visibleCue: 'kleiner Medien-Van mit Kamerateam',
                vehicleRole: 'vehicle.van',
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.small_box',
                narrativeHint: 'Am Ziel wartet ein kleines Redaktions- und Kamerateam mit Medien-Van am Vorfeld.'
            };
        }
        if (/sightseeing|tour|learning|historian/.test(planTask)) {
            return {
                role: 'tour_pickup',
                roleLabel: 'Tour-Abholung',
                expectedBy: 'lokaler Kontakt oder Shuttle',
                visibleCue: 'kleines Shuttle- oder Abholfahrzeug',
                vehicleRole: 'vehicle.car',
                personRole: 'person.ground_crew',
                equipmentRole: '',
                narrativeHint: 'Am Ziel ist ein lokaler Kontakt am Vorfeld als Treffpunkt vorgesehen.'
            };
        }
        if (/club|utility/.test(planTask)) {
            return {
                role: 'club_meetup',
                roleLabel: 'Vereins-/Utility-Treffpunkt',
                expectedBy: 'Vereinskollege oder Platzkontakt',
                visibleCue: 'Vereinskontakt am Vorfeld',
                vehicleRole: 'vehicle.car',
                personRole: 'person.ground_crew',
                equipmentRole: 'cargo.small_box',
                narrativeHint: 'Am Ziel wartet ein Platz- oder Vereinskontakt an einem sicheren Vorfeldbereich.'
            };
        }
    }
    const id = String(profileId || passenger?.taskDomain || passenger?.roleProfile || '').toLowerCase();
    const text = [
        id,
        passenger?.role,
        passenger?.taskDomain,
        passenger?.roleProfile,
        paxText,
        cargoText,
        mission?.t,
        mission?.s
    ].filter(Boolean).join(' ').toLowerCase();
    if (!text.trim() || /freeflight|freiflug|kein\s+pax|0\s*pax|\bnone\b/.test(text)) {
        return { role: 'none' };
    }
    if (/training|fluglehrer|instruktor|instructor|uebung|übung|airwork|platzrunde/.test(text)) {
        return { role: 'none' };
    }
    if (/medical|medizin|notarzt|blut|notfall/.test(text)) {
        return {
            role: 'medical_handoff',
            roleLabel: 'medizinische Uebergabe',
            expectedBy: 'medizinisches Empfangsteam',
            visibleCue: 'Rettungswagen oder medizinisches Empfangsteam',
            vehicleRole: 'vehicle.emergency.medical',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.medical_kit',
            narrativeHint: 'Am Ziel ist eine ruhige medizinische Uebergabe am Vorfeld geplant.'
        };
    }
    if (/cargo|fracht|logistik|kurier|labor|praezisionsoptik|schutzverpackung/.test(text)) {
        return {
            role: 'cargo_handoff',
            roleLabel: 'Frachtuebergabe',
            expectedBy: 'Frachtkontakt am Vorfeld',
            visibleCue: 'Fracht-Van oder Abholfahrzeug',
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.small_box',
            narrativeHint: 'Am Ziel wartet die Frachtuebergabe an einem sicheren Vorfeld- oder Parkingbereich.'
        };
    }
    if (/animal|tier|veterinaer|tierschutz|transportbox|ziege|reh|hirsch|möwe|moewe|gans|ente|schwan|pferd|wildvogel|auffangstation/.test(text)) {
        const animalSpec = pickAnimalTransportSceneSpec(text);
        const handoffLabel = animalTransportBoxLabel(animalSpec);
        return {
            role: 'animal_handoff',
            roleLabel: 'Tiertransport-Uebergabe',
            expectedBy: 'Tierpflege- oder Vereinskontakt',
            visibleCue: `${handoffLabel} am Tierpflege-Van`,
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.animal_transport_box',
            animalSpec,
            narrativeHint: `Am Ziel ist eine stressarme Uebergabe fuer ${handoffLabel} am Vorfeld vorgesehen.`
        };
    }
    if (/news|report|presse|tv|kamera|live/.test(text)) {
        return {
            role: 'media_pickup',
            roleLabel: 'Medien-Abholung',
            expectedBy: 'Redaktions- und Kamerateam',
            visibleCue: 'kleiner Medien-Van mit Kamerateam',
            vehicleRole: 'vehicle.van',
            personRole: 'person.ground_crew',
            equipmentRole: 'cargo.small_box',
            narrativeHint: 'Am Ziel wartet ein kleines Redaktions- und Kamerateam mit Medien-Van am Vorfeld.'
        };
    }
    if (/sightseeing|tour|guide|stadtfuehrer|stadtführer|gaeste|gäste/.test(text)) {
        return {
            role: 'tour_pickup',
            roleLabel: 'Tour-Abholung',
            expectedBy: 'lokaler Kontakt oder Shuttle',
            visibleCue: 'kleines Shuttle- oder Abholfahrzeug',
            vehicleRole: 'vehicle.car',
            personRole: 'person.ground_crew',
            equipmentRole: '',
            narrativeHint: 'Am Ziel ist ein lokaler Kontakt am Vorfeld als Treffpunkt vorgesehen.'
        };
    }
    return {
        role: 'club_meetup',
        roleLabel: 'Vereins-/Utility-Treffpunkt',
        expectedBy: 'Vereinskollege oder Platzkontakt',
        visibleCue: 'Vereinskontakt am Vorfeld',
        vehicleRole: 'vehicle.car',
        personRole: 'person.ground_crew',
        equipmentRole: 'cargo.small_box',
        narrativeHint: 'Am Ziel wartet ein Platz- oder Vereinskontakt an einem sicheren Vorfeldbereich.'
    };
}
