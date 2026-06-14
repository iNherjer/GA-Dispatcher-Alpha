// Mission variety helpers and maintainable prompt candidate pools.
// Keep this file framework-free: it is loaded in the browser app and in VM dryruns.
(function missionVarietyCore(root) {
    'use strict';

    const STORAGE_PREFIX = 'ga_mission_variety_history_';
    const DEFAULT_HISTORY_LIMIT = 32;

    const BUSH_PICKUP_STRIP_CANDIDATES = [
        {
            id: 'trail_ranger_closure',
            familyId: 'ranger_trail',
            label: 'Ranger- und Trail-Arbeit',
            tags: ['forest', 'trail', 'weather', 'water', 'remote_strip'],
            weight: 1.15,
            roleIdeas: ['USFS-Rangerin', 'Trail-Crew-Leiter', 'Backcountry-Permit-Kontakt'],
            taskIdeas: ['Markierungen am Bachlauf gesetzt', 'Trail-Sperren nach Wetter kontrolliert', 'Wildwechsel und umgestuerzte Aeste dokumentiert'],
            objectIdeas: ['Kartenmappe', 'Markierungsband', 'Rucksack', 'kleine Rueckholkiste'],
            returnDrivers: ['Rangerstation braucht Sperrnotizen', 'naechste Crew muss vor dem Wetterfenster disponiert werden', 'Permit-Planung muss in der Basis aktualisiert werden'],
            accessReasons: ['naechster brauchbarer Strip zum Talabschnitt', 'sicherer Abholpunkt vor weiterem Gelaendemarsch', 'Treffpunkt fuer ein verstreutes Feldteam']
        },
        {
            id: 'strip_ops_inspector',
            familyId: 'strip_ops',
            label: 'Strip-Betrieb und Platzcheck',
            tags: ['remote_strip', 'ranch', 'maintenance', 'road'],
            weight: 1.2,
            roleIdeas: ['Strip-Betreiber', 'USFS-Technikinspektorin', 'Backcountry-Operations-Kontakt'],
            taskIdeas: ['Windsackbefestigung und Randstreifen geprueft', 'Zufahrtsgatter und Notfallkasten dokumentiert', 'Spurrinnen und lose Gegenstaende am Bahnrand notiert'],
            objectIdeas: ['Pruefmappe', 'Werkzeugtasche', 'Tablet', 'zwei leichte Kisten'],
            returnDrivers: ['Freigabe- und Maengelnotizen muessen in die Planung', 'Versorgungsflug wartet auf den Strip-Status', 'Betreiberakte braucht Fotos und Freigabeentscheidung'],
            accessReasons: ['der Strip selbst ist der Arbeitsort', 'Parkpunkt am Pistenrand ist der sichere Treffpunkt', 'kurzer Check nach Wetter- oder Nutzungsfenster']
        },
        {
            id: 'utility_power_pump',
            familyId: 'utility_service',
            label: 'Generator, Pumpe oder Versorgungstechnik',
            tags: ['maintenance', 'power', 'water', 'ranch', 'camp'],
            weight: 1.05,
            roleIdeas: ['Utility-Technikerin', 'Pumpenmechaniker', 'Generator-Servicekontakt'],
            taskIdeas: ['Generatorlauf protokolliert', 'Pumpenleitung entlueftet', 'Batterie- und Sicherungskasten kontrolliert'],
            objectIdeas: ['Werkzeugrolle', 'Ersatzriemen', 'kleines Batterietestgeraet', 'Servicezettel'],
            returnDrivers: ['Materialbedarf muss in der Basis nachbestellt werden', 'der naechste Versorgungslauf braucht die Fehlerliste', 'Servicefreigabe muss vor dem Abend raus'],
            accessReasons: ['naechster Strip zur Aussenstelle', 'schnellster Rueckweg mit empfindlichen Kleinteilen', 'Camp-Zugang ohne langen Rueckmarsch']
        },
        {
            id: 'lodge_guest_logistics',
            familyId: 'lodge_logistics',
            label: 'Lodge-, Ranch- oder Outfitter-Logistik',
            tags: ['lodge', 'ranch', 'camp', 'remote_strip'],
            weight: 1.0,
            roleIdeas: ['Lodge-Koordinatorin', 'Outfitter-Kontakt', 'Ranch-Caretaker'],
            taskIdeas: ['Gaesteliste und Vorratszettel abgestimmt', 'Camp-Schluessel und Funkliste eingesammelt', 'Saisonbedarf fuer den naechsten Turnaround gezaehlt'],
            objectIdeas: ['Klemmbrett', 'Schluesselbund', 'Posttasche', 'kleine Vorratskiste'],
            returnDrivers: ['in der Basis wartet die naechste Gaesteplanung', 'Fracht- und Crewrotation muss umgebaut werden', 'Anschluss an die Abendbesprechung ist knapp'],
            accessReasons: ['Treffpunkt zwischen Lodge und Strip', 'Abholpunkt fuer Crewwechsel', 'sicherster kurzer Weg aus dem Tal']
        },
        {
            id: 'wildlife_count_monitor',
            familyId: 'wildlife_fieldwork',
            label: 'Wildlife- und Habitat-Monitoring',
            tags: ['forest', 'meadow', 'water', 'wildlife', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Wildlife-Mitarbeiter', 'Habitat-Koordinatorin', 'Forstbiologe'],
            taskIdeas: ['Kamerakarten eingesammelt', 'Spurenpunkte und Zaunluecken notiert', 'Ufer- und Wiesenabschnitt auf Stoerstellen geprueft'],
            objectIdeas: ['Kamerakarten-Box', 'Feldnotizbuch', 'GPS-Handgeraet', 'kleine Rueckholtasche'],
            returnDrivers: ['die Karten muessen in der Basis gesichert werden', 'Forstteam braucht die Fundpunkte fuer die Wochenplanung', 'Stoerstellen sollen vor dem naechsten Crewgang gemeldet werden'],
            accessReasons: ['Strip liegt nahe an mehreren Kontrollpunkten', 'kurzer Weg vom Beobachtungsbogen zum Abholpunkt', 'besserer Rueckweg als mehrere Stunden Talabstieg']
        },
        {
            id: 'map_photo_scout',
            familyId: 'mapping_photo',
            label: 'Karten-, Foto- oder Projekt-Dokumentation',
            tags: ['mapping', 'photo', 'ranch', 'water', 'mountain', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Kartenmacherin', 'Projektfotograf', 'Dokumentationsleiterin'],
            taskIdeas: ['Referenzfotos vom Stripumfeld gemacht', 'Kartennotizen und Wegpunkte abgeglichen', 'Fotokarten fuer die Projektakte sortiert'],
            objectIdeas: ['Fototasche', 'Kartenrolle', 'Tablet', 'Akkucase'],
            returnDrivers: ['Projektleitung braucht die Bilder vor der Freigabe', 'Kartenstand muss in der Basis aktualisiert werden', 'Akkus und Datentraeger sollen nicht draussen bleiben'],
            accessReasons: ['Strip ist der einzige klare Zugang zum Bildbereich', 'Treffpunkt mit Sicht auf Tal und Bahnrand', 'schnellster Rueckweg fuer die Datenkarten']
        },
        {
            id: 'permit_boundary_admin',
            familyId: 'permit_admin',
            label: 'Permit-, Grenz- oder Betriebsunterlagen',
            tags: ['admin', 'ranch', 'forest', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Permit-Koordinator', 'Rangerstation-Kontakt', 'Projektleiterin vor Ort'],
            taskIdeas: ['Nutzungsnotizen mit der Aussenstelle abgeglichen', 'Grenzmarken und alte Wegpunkte fotografiert', 'Unterschriftenmappe und Betriebszettel eingesammelt'],
            objectIdeas: ['Dokumentenmappe', 'Funkliste', 'Tablet', 'versiegelte Posttasche'],
            returnDrivers: ['Unterlagen muessen heute in die Basisakte', 'naechste Freigabe haengt an den Rueckmeldungen', 'Projektbesprechung wartet auf die Originalnotizen'],
            accessReasons: ['neutraler Treffpunkt fuer mehrere Teams', 'sicherer Abholpunkt fuer Unterlagen', 'kein langer Transport ueber raues Gelaende']
        },
        {
            id: 'weather_lookout_station',
            familyId: 'weather_observer',
            label: 'Wetter-, Pegel- oder Lookout-Meldung',
            tags: ['weather', 'cold', 'mountain', 'water', 'forest'],
            weight: 0.9,
            roleIdeas: ['Lookout-Beobachterin', 'Wetterposten-Kontakt', 'Pegelwart'],
            taskIdeas: ['Wind- und Sichtnotizen mit alten Messpunkten abgeglichen', 'Pegelmarken kontrolliert', 'Wetterfenster fuer die naechste Crew gemeldet'],
            objectIdeas: ['Wetterkladde', 'Handfunkgeraet', 'kleine Instrumententasche', 'Akkupack'],
            returnDrivers: ['Basis braucht die Lage fuer die Morgenplanung', 'Wetterfenster schliesst vor der naechsten Schicht', 'Daten muessen vor dem Crewbriefing uebergeben werden'],
            accessReasons: ['kurzer Zugang zu Lookout oder Pegelpunkt', 'sicherer Treffpunkt vor Wetterwechsel', 'Rueckflug spart langen Abstieg im Dunkeln']
        },
        {
            id: 'camp_crew_rotation',
            familyId: 'crew_rotation',
            label: 'Camp-Crew, Saisonarbeit oder Crewwechsel',
            tags: ['camp', 'lodge', 'ranch', 'remote_strip'],
            weight: 1.05,
            roleIdeas: ['Camp-Koordinatorin', 'Saisonarbeiter', 'Crew-Vorarbeiter'],
            taskIdeas: ['Crewwechsel vorbereitet', 'Materialliste und offene Reparaturen notiert', 'Camp sauber uebergeben und Funkliste aktualisiert'],
            objectIdeas: ['Seesack', 'Klemmbrett', 'kleine Werkzeugkiste', 'Postbeutel'],
            returnDrivers: ['naechste Crew muss in der Basis gebrieft werden', 'Arbeitsstunden und Materialbedarf muessen ins System', 'Anschluss an die Rueckfahrt vom Heimatplatz ist knapp'],
            accessReasons: ['Strip ist der Wechselpunkt fuer das Camp', 'zu Fuss waere der Rueckweg zu lang', 'kurzer Turnaround zwischen zwei Crewfenstern']
        },
        {
            id: 'insurance_site_reviewer',
            familyId: 'insurance_review',
            label: 'Versicherungs-, Eigentums- oder Schadenssichtung',
            tags: ['ranch', 'road', 'maintenance', 'weather', 'remote_strip'],
            weight: 0.85,
            roleIdeas: ['Versicherungsprueferin', 'Schadensgutachter', 'Property-Managerin'],
            taskIdeas: ['Fotos von Zaun, Zufahrt und Nebengebaeude gesichert', 'Sturmschaden und Spurrinnen protokolliert', 'Rueckfragen mit dem lokalen Kontakt geklaert'],
            objectIdeas: ['Fototablet', 'Schadenmappe', 'Massband', 'kleiner Aktenkoffer'],
            returnDrivers: ['Schadennummer muss heute geschlossen werden', 'Freigabe fuer Material und Reparatur haengt an den Bildern', 'Eigentuemer wartet in der Basis auf die Einschaetzung'],
            accessReasons: ['Strip ist der einzig praktikable Zugang zum Objekt', 'Treffpunkt ohne lange Pistenfahrt', 'Rueckflug bringt Originalnotizen rechtzeitig zurueck']
        },
        {
            id: 'relay_cache_courier',
            familyId: 'comms_cache',
            label: 'Funk, Cache oder Kommunikationsmaterial',
            tags: ['maintenance', 'power', 'forest', 'mountain', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Funkwartin', 'Kommunikationshelfer', 'Cache-Koordinatorin'],
            taskIdeas: ['Akkus getauscht', 'Funkcache versiegelt', 'Antennenstand und Reichweitennotizen geprueft'],
            objectIdeas: ['Alukoffer', 'Akkutasche', 'Funkliste', 'versiegelter Cache-Beutel'],
            returnDrivers: ['Frequenz- und Akkuliste muss in die Basis', 'Ersatzteile fuer den naechsten Lauf muessen gepackt werden', 'Dienstplan haengt an der Rueckmeldung'],
            accessReasons: ['Strip liegt am besten zum Relaiszugang', 'kurzer Weg vom Cache zum Abholpunkt', 'Rueckflug vermeidet Uebernachtung am Funkposten']
        },
        {
            id: 'quirky_field_kitchen',
            familyId: 'wildcard_camp',
            label: 'Kurioser Camp-Auftrag ohne Drama',
            tags: ['camp', 'lodge', 'ranch', 'wildcard', 'remote_strip'],
            wildcard: true,
            weight: 0.55,
            roleIdeas: ['Camp-Koch', 'Backcountry-Eventhelferin', 'Lodge-Allrounder'],
            taskIdeas: ['defekten Kuehlbox-Deckel und Essensliste dokumentiert', 'Campinventar nach einem langen Wochenende gezaehlt', 'eine vergessene Sonderbestellung fuer die Basis gesichert'],
            objectIdeas: ['Kuehlboxdeckel', 'Bestellzettel', 'Emailletopf', 'kleine Vorratskiste'],
            returnDrivers: ['Basis muss die naechste Versorgungsliste heute umstellen', 'Lodge-Team wartet auf den Fehlbestand', 'der naechste Flug soll nicht mit falscher Kuechenfracht starten'],
            accessReasons: ['Strip ist der einzige schnelle Weg aus dem Camp', 'Treffpunkt am Gelaendewagen statt langer Rueckfahrt', 'kurzer Abholpunkt nach Camp-Schluss']
        }
    ];

    const POOLS = {
        bush_pickup_strip: BUSH_PICKUP_STRIP_CANDIDATES
    };

    function _storage() {
        try {
            if (root.localStorage) return root.localStorage;
        } catch (_) {}
        return null;
    }

    function _norm(text = '') {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ß/g, 'ss');
    }

    function _arr(value) {
        return Array.isArray(value) ? value.map(v => String(v || '').trim()).filter(Boolean) : [];
    }

    function missionVarietyPool(namespace = '') {
        const pool = POOLS[String(namespace || '').trim().toLowerCase()];
        return Array.isArray(pool) ? pool.map(item => ({ ...item })) : [];
    }

    function missionVarietyContextTags(context = {}, draft = {}, extra = {}) {
        const geo = context.targetGeoContext || context.geoContext || extra.targetGeoContext || {};
        const truth = context.missionTruth || extra.missionTruth || {};
        const weather = extra.weather || context.weather || context.missionWeather || {};
        const target = draft?.target || context.dest || context.target || {};
        const text = _norm([
            target.name, target.n, target.icao,
            context.selectedCategory, context.requestedCategory,
            context.dispatchProfileId, draft?.picker?.profile, draft?.category,
            geo.summary,
            ...(Array.isArray(geo.hints) ? geo.hints : []),
            ...(Array.isArray(truth.visibleCues) ? truth.visibleCues : []),
            truth?.mainTarget?.kind, truth?.sceneAnchor?.kind
        ].filter(Boolean).join(' '));
        const tags = new Set(['bush', 'remote_strip']);
        const addIf = (tag, re) => { if (re.test(text)) tags.add(tag); };
        addIf('water', /\b(water|river|creek|bach|fluss|ufer|lake|see|salmon|bar|pegel)\b/);
        addIf('forest', /\b(forest|wood|wald|forst|usfs|ranger|tree|trail)\b/);
        addIf('mountain', /\b(mountain|berg|peak|ridge|pass|canyon|valley|tal|fork)\b/);
        addIf('ranch', /\b(ranch|farm|pasture|meadow|wiese)\b/);
        addIf('lodge', /\b(lodge|camp|outfitter|cabins?|resort)\b/);
        addIf('road', /\b(road|track|zufahrt|gate|gatter|spur|parking)\b/);
        addIf('power', /\b(power|strom|generator|pump|pumpe|relay|relais|funk|antenna)\b/);
        addIf('maintenance', /\b(maintenance|wartung|technik|repair|service|inspection|check)\b/);
        const temp = Number(weather?.dest?.tempC ?? weather?.tempC);
        if (Number.isFinite(temp) && temp <= 3) tags.add('cold');
        const wind = Number(weather?.dest?.windKts ?? weather?.windKts);
        if (Number.isFinite(wind) && wind >= 10) tags.add('weather');
        if (Number(context?.missionFireHazard?.level || extra?.fireHazard?.level || 0) >= 3) tags.add('fire');
        return Array.from(tags);
    }

    function missionVarietyStorageKey(namespace = '', version = 'v1') {
        const safe = String(namespace || 'generic').toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').slice(0, 80);
        return `${STORAGE_PREFIX}${safe}_${version}`;
    }

    function readMissionVarietyHistory(namespace = '', options = {}) {
        const store = _storage();
        if (!store) return [];
        const key = options.storageKey || missionVarietyStorageKey(namespace, options.version || 'v1');
        try {
            const parsed = JSON.parse(store.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
        } catch (_) {
            return [];
        }
    }

    function writeMissionVarietyHistory(namespace = '', entry = {}, options = {}) {
        const store = _storage();
        if (!store || !entry || typeof entry !== 'object') return;
        const limit = Math.max(4, Math.min(80, Number(options.limit || DEFAULT_HISTORY_LIMIT) || DEFAULT_HISTORY_LIMIT));
        const key = options.storageKey || missionVarietyStorageKey(namespace, options.version || 'v1');
        const history = readMissionVarietyHistory(namespace, { ...options, storageKey: key });
        const familyIds = _arr(entry.familyIds).slice(0, 8);
        const candidateIds = _arr(entry.candidateIds).slice(0, 8);
        const compact = {
            ts: Number(entry.ts || Date.now()),
            namespace: String(namespace || entry.namespace || 'generic'),
            profileId: String(entry.profileId || ''),
            primaryFamilyId: String(entry.primaryFamilyId || familyIds[0] || ''),
            primaryCandidateId: String(entry.primaryCandidateId || candidateIds[0] || ''),
            familyIds,
            candidateIds,
            contextTags: _arr(entry.contextTags).slice(0, 12)
        };
        try { store.setItem(key, JSON.stringify(history.concat(compact).slice(-limit))); } catch (_) {}
    }

    function _recentSets(history = [], { familyLimit = 4, itemLimit = 8, primaryLimit = 10 } = {}) {
        const recentFamilies = new Set();
        const recentIds = new Set();
        const recentPrimaryFamilies = new Set();
        const recentPrimaryIds = new Set();
        history.slice(-Math.max(0, familyLimit)).forEach(entry => _arr(entry.familyIds).forEach(id => recentFamilies.add(id)));
        history.slice(-Math.max(0, itemLimit)).forEach(entry => _arr(entry.candidateIds).forEach(id => recentIds.add(id)));
        history.slice(-Math.max(0, primaryLimit)).forEach(entry => {
            const primaryFamily = String(entry.primaryFamilyId || _arr(entry.familyIds)[0] || '').trim();
            const primaryId = String(entry.primaryCandidateId || _arr(entry.candidateIds)[0] || '').trim();
            if (primaryFamily) recentPrimaryFamilies.add(primaryFamily);
            if (primaryId) recentPrimaryIds.add(primaryId);
        });
        return { recentFamilies, recentIds, recentPrimaryFamilies, recentPrimaryIds };
    }

    function _scoreCandidate(candidate, contextTags = []) {
        const ctx = new Set(contextTags);
        const tags = _arr(candidate.tags);
        const matches = tags.filter(tag => ctx.has(tag));
        const requiresAny = _arr(candidate.requiresAny);
        if (requiresAny.length && !requiresAny.some(tag => ctx.has(tag))) return null;
        const avoidAny = _arr(candidate.avoidAny);
        if (avoidAny.some(tag => ctx.has(tag))) return null;
        const base = Number(candidate.weight || 1) || 1;
        const score = Math.max(0.05, base + (matches.length * 0.55) + (candidate.wildcard ? -0.25 : 0));
        return { candidate, score, matches };
    }

    function _weightedPick(entries = []) {
        const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.score || 0)), 0);
        if (!(total > 0)) return entries[Math.floor(Math.random() * entries.length)] || null;
        let roll = Math.random() * total;
        for (const entry of entries) {
            roll -= Math.max(0, Number(entry.score || 0));
            if (roll <= 0) return entry;
        }
        return entries[entries.length - 1] || null;
    }

    function _compactCandidate(entry) {
        const c = entry?.candidate || entry || {};
        return {
            id: String(c.id || ''),
            familyId: String(c.familyId || c.id || ''),
            label: String(c.label || c.id || ''),
            wildcard: !!c.wildcard,
            matchTags: _arr(entry?.matches).slice(0, 6),
            roleIdeas: _arr(c.roleIdeas).slice(0, 4),
            taskIdeas: _arr(c.taskIdeas).slice(0, 4),
            objectIdeas: _arr(c.objectIdeas).slice(0, 4),
            returnDrivers: _arr(c.returnDrivers).slice(0, 4),
            accessReasons: _arr(c.accessReasons).slice(0, 3)
        };
    }

    function _unique(items = [], limit = 12) {
        return Array.from(new Set(items.map(v => String(v || '').trim()).filter(Boolean))).slice(0, limit);
    }

    function missionVarietyPackToPromptAxes(pack = null) {
        const candidates = Array.isArray(pack?.candidates) ? pack.candidates : [];
        return {
            roleFamilies: _unique(candidates.flatMap(c => c.roleIdeas || []), 12),
            activityVerbs: _unique(candidates.flatMap(c => c.taskIdeas || []), 14),
            evidenceObjects: _unique(candidates.flatMap(c => c.objectIdeas || []), 14),
            returnDrivers: _unique(candidates.flatMap(c => c.returnDrivers || []), 10),
            accessReasons: _unique(candidates.flatMap(c => c.accessReasons || []), 8)
        };
    }

    function selectMissionVarietyPack(options = {}) {
        const namespace = String(options.namespace || options.profileId || 'generic').trim().toLowerCase();
        const maxItems = Math.max(1, Math.min(8, Number(options.maxItems || 5) || 5));
        const wildcardRate = Math.max(0, Math.min(1, Number(options.wildcardRate ?? 0.18)));
        const candidates = Array.isArray(options.candidates) && options.candidates.length
            ? options.candidates.map(item => ({ ...item }))
            : missionVarietyPool(namespace);
        const contextTags = Array.isArray(options.contextTags) && options.contextTags.length
            ? _arr(options.contextTags)
            : missionVarietyContextTags(options.context || {}, options.draft || {}, options.extra || {});
        const history = options.history || readMissionVarietyHistory(namespace, options);
        const { recentFamilies, recentIds, recentPrimaryFamilies, recentPrimaryIds } = _recentSets(history, {
            familyLimit: Number(options.recentFamilyLimit || 4),
            itemLimit: Number(options.recentItemLimit || 8),
            primaryLimit: Number(options.recentPrimaryLimit || 10)
        });
        let scored = candidates
            .map(candidate => _scoreCandidate(candidate, contextTags))
            .filter(Boolean);
        if (!scored.length) {
            scored = candidates.map(candidate => ({ candidate, score: Number(candidate.weight || 1) || 1, matches: [] }));
        }
        const selected = [];
        const selectedIds = new Set();
        const selectedFamilies = new Set();
        const tryPick = (pool) => {
            const filtered = pool.filter(entry =>
                !selectedIds.has(String(entry.candidate.id || ''))
                && !selectedFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
            );
            const picked = _weightedPick(filtered);
            if (!picked) return false;
            selected.push(picked);
            selectedIds.add(String(picked.candidate.id || ''));
            selectedFamilies.add(String(picked.candidate.familyId || picked.candidate.id || ''));
            return true;
        };
        const primaryFresh = scored.filter(entry =>
            !recentPrimaryIds.has(String(entry.candidate.id || ''))
            && !recentPrimaryFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
        );
        const primaryFallback = scored.map(entry => {
            const isRecentPrimary = recentPrimaryIds.has(String(entry.candidate.id || ''))
                || recentPrimaryFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''));
            return isRecentPrimary ? { ...entry, score: Math.max(0.05, Number(entry.score || 0.05) * 0.25) } : entry;
        });
        tryPick(primaryFresh.length ? primaryFresh : primaryFallback);
        while (selected.length < maxItems) {
            const fresh = scored.filter(entry =>
                !recentIds.has(String(entry.candidate.id || ''))
                && !recentFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
            );
            if (!tryPick(fresh.length ? fresh : scored)) break;
        }
        if (Math.random() < wildcardRate && selected.length) {
            const wildcardPool = scored.filter(entry =>
                entry.candidate.wildcard
                && !selectedIds.has(String(entry.candidate.id || ''))
                && !recentIds.has(String(entry.candidate.id || ''))
            );
            const wildcard = _weightedPick(wildcardPool);
            if (wildcard) {
                selected[selected.length - 1] = wildcard;
            }
        }
        const compactCandidates = selected.map(_compactCandidate);
        const pack = {
            schema: 'missionVarietyPack.v1',
            namespace,
            profileId: String(options.profileId || namespace),
            contextTags,
            storageKey: missionVarietyStorageKey(namespace, options.version || 'v1'),
            selectedIds: compactCandidates.map(c => c.id),
            selectedFamilies: compactCandidates.map(c => c.familyId),
            primaryId: compactCandidates[0]?.id || '',
            primaryFamily: compactCandidates[0]?.familyId || '',
            recentFamilies: Array.from(recentFamilies),
            recentIds: Array.from(recentIds),
            recentPrimaryFamilies: Array.from(recentPrimaryFamilies),
            recentPrimaryIds: Array.from(recentPrimaryIds),
            candidates: compactCandidates,
            selectionRule: 'Kontextfilter zuerst; lokale Browser-History reduziert Wiederholungen; Wildcard bleibt profilkompatibel.'
        };
        pack.ingredientAxes = missionVarietyPackToPromptAxes(pack);
        if (options.writeHistory !== false) {
            writeMissionVarietyHistory(namespace, {
                namespace,
                profileId: options.profileId || namespace,
                primaryFamilyId: pack.primaryFamily,
                primaryCandidateId: pack.primaryId,
                familyIds: pack.selectedFamilies,
                candidateIds: pack.selectedIds,
                contextTags
            }, options);
        }
        root.gaMissionVarietyLastPack = pack;
        return pack;
    }

    root.MISSION_VARIETY_POOLS = POOLS;
    root.missionVarietyPool = missionVarietyPool;
    root.missionVarietyContextTags = missionVarietyContextTags;
    root.missionVarietyStorageKey = missionVarietyStorageKey;
    root.readMissionVarietyHistory = readMissionVarietyHistory;
    root.writeMissionVarietyHistory = writeMissionVarietyHistory;
    root.selectMissionVarietyPack = selectMissionVarietyPack;
    root.missionVarietyPackToPromptAxes = missionVarietyPackToPromptAxes;
})(typeof window !== 'undefined' ? window : globalThis);
