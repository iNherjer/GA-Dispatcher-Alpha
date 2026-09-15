// Frozen original POI voice functions before tracker integration. Do not regenerate.
function _poiMemoryCompact(text) {
    const s = String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/\b(äh|aeh|halt|quasi|sozusagen)\b/gi, '')
        .trim();
    if (!s) return '';
    const parts = s.split(/[.!?]/).map(x => x.trim()).filter(Boolean);
    const first = parts[0] || s;
    return first.length > 180 ? `${first.slice(0, 177)}...` : first;
}

function _capturePoiNarrativeMemory(eventLabel, spokenText) {
    if (!_isPOIMission()) return;
    const ev = String(eventLabel || '').toLowerCase();
    const compact = _poiMemoryCompact(spokenText);
    if (!compact) return;
    if (/^(poi_learning_guide|sightseeing_tour)$/.test(_activeTaskDomain()) && _activePoiKnowledgeContext()) {
        _poiKnowledgeSyncContext();
        const spoken = String(spokenText || '').replace(/\s+/g, ' ').trim();
        if (spoken) {
            _poiKnowledgeSpokenMemory = `${_poiKnowledgeSpokenMemory} ${spoken}`.trim().slice(-4000);
        }
    }
    if (ev.includes('objekt in sicht')) _poiNarrativeMemory.pre = compact;
    else if (ev.includes('zielgebiet')) _poiNarrativeMemory.entry = compact;
    else if (ev.includes('ziel erfüllt') || ev.includes('ziel erfuellt') || ev.includes('am ziel')) _poiNarrativeMemory.done = compact;
}

function _poiNoRepeatHint(stage = 'entry') {
    if (!_isPOIMission()) return '';
    const used = [];
    if (stage === 'entry') {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
    } else if (stage === 'result') {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
        if (_poiNarrativeMemory.entry) used.push(_poiNarrativeMemory.entry);
    } else {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
        if (_poiNarrativeMemory.entry) used.push(_poiNarrativeMemory.entry);
        if (_poiNarrativeMemory.done) used.push(_poiNarrativeMemory.done);
    }
    if (!used.length) return '';
    return ` Bereits genannt (nicht wiederholen, nicht paraphrasieren und nicht als Leitmotiv fortsetzen): ${used.join(' | ')}. Liefere stattdessen neue, konkrete Zusatzinfos. Wenn darin eine Landmarke oder ein Spezialobjekt vorkam, greife es nicht erneut auf, ausser die aktuelle Anweisung verlangt es ausdruecklich.`;
}

function _poiNarrativeMemoryText() {
    return [
        _poiNarrativeMemory?.pre,
        _poiNarrativeMemory?.entry,
        _poiNarrativeMemory?.done
    ].map(x => String(x || '').trim()).filter(Boolean).join(' ');
}

function _poiMemoryHasCue(text = '') {
    const normalize = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
    const mem = normalize(_poiNarrativeMemoryText());
    if (!mem) return false;
    const t = normalize(text);
    const cues = [
        'strommast', 'freileitung', 'windrad', 'bruecke', 'fluss', 'kanal',
        'autobahn', 'eisenbahn', 'bahnlinie', 'bahntrasse', 'gleis',
        'gipfel', 'bergruecken', 'pass', 'sattel', 'aussichtspunkt',
        'wald', 'waldkante', 'strasse', 'zufahrt', 'stausee', 'see', 'ufer'
    ];
    return cues.some(cue => t.includes(cue) && mem.includes(cue));
}

function _factKeywords(text = '') {
    const stop = new Set(['eine', 'einer', 'einem', 'einen', 'fuer', 'für', 'fur', 'oder', 'und', 'sind', 'sein', 'wird', 'hier', 'dort', 'diese', 'dieser', 'dieses', 'durch', 'nicht', 'auch', 'nach', 'ziel', 'zielgebiet']);
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9äöüß]+/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 5 && !stop.has(w))
        .slice(0, 12);
}

function _poiMemoryHasSimilarFact(fact = '') {
    if (!_isPOIMission()) return false;
    const words = _factKeywords(fact);
    if (words.length < 4) return false;
    const mem = [
        _poiNarrativeMemory.pre,
        _poiNarrativeMemory.entry,
        _poiNarrativeMemory.done,
        _poiKnowledgeSpokenMemory
    ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!mem.trim()) return false;
    const overlap = words.filter(w => mem.includes(w)).length;
    return overlap >= Math.min(4, Math.ceil(words.length * 0.45));
}

function _getPoiInspectionOutcome() {
    const infraOutcome = _activeInfraInspectionOutcome();
    if (infraOutcome?.outcome) return infraOutcome.outcome;
    if (_poiInspectionOutcome) return _poiInspectionOutcome;
    const options = ['clear', 'minor', 'damage', 'pending'];
    _poiInspectionOutcome = options[Math.floor(Math.random() * options.length)];
    return _poiInspectionOutcome;
}

function _inspectionEntryHint() {
    const meta = _inspectionMissionMeta();
    if (!meta) return '';
    return ` Fokus Inspektion: Sag kurz, wonach du am Objekt "${meta.objectName}" suchst (z.B. Risse, lockere Bauteile, Schaeden, Auffaelligkeiten).`;
}

function _inspectionResultHint() {
    const meta = _inspectionMissionMeta();
    if (!meta) return '';
    const objectName = meta.objectName;
    const infraOutcome = _activeInfraInspectionOutcome();
    if (infraOutcome?.resultPrompt) {
        return ` ${infraOutcome.resultPrompt}`;
    }
    const outcome = _getPoiInspectionOutcome();
    if (outcome === 'major_damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt, wie ernst es auf den ersten Blick aussieht und dass der Befund fuer Reparatur oder Sperrpruefung weitergemeldet werden muss.`;
    }
    if (outcome === 'minor_damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du eine begrenzte Schadstelle gesehen. Nenne kurz, was betroffen wirkt, dass keine Panik noetig ist, aber eine gezielte Dokumentation oder Nachpruefung folgen sollte.`;
    }
    if (outcome === 'monitor') {
        return ` Inspektionsfazit: Bei "${objectName}" ist nur eine unklare oder kleine Auffaelligkeit offen. Sage, was unauffaellig wirkt, was beobachtet werden sollte und dass eine spaetere Nachpruefung reicht.`;
    }
    if (outcome === 'blocked_access') {
        return ` Inspektionsfazit: Bei "${objectName}" wirkt eine Zufahrt, Trasse oder Arbeitsflaeche blockiert. Beschreibe den sichtbaren Befund kurz und dass daraus eine gezielte Dokumentations- oder Raeumungspruefung folgt.`;
    }
    if (outcome === 'damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt, wie ernst es auf den ersten Blick aussieht und dass der Befund fuer Reparatur oder Sperrpruefung weitergemeldet werden muss.`;
    }
    if (outcome === 'minor') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du eine auffaellige Stelle gesehen, aber ohne sichere Schadensbestaetigung. Nenne kurz, was unauffaellig ist, was beobachtet werden sollte und ob eine spaetere Nachpruefung reicht.`;
    }
    if (outcome === 'pending') {
        return ` Inspektionsfazit: Den gesuchten Punkt an "${objectName}" konntest du noch nicht eindeutig erkennen. Sage kurz, welcher Bereich noch unklar ist, und bitte freundlich um einen weiteren ruhigen Pass.`;
    }
    return ` Inspektionsfazit: Bei "${objectName}" konntest du keinen relevanten Schaden erkennen. Sage kurz, welche kritischen Punkte sauber aussehen und dass vorerst keine akute Reparatur noetig wirkt.`;
}

function _professionalTaskHint(mode = 'entry') {
    const meta = _professionalRoleMeta();
    if (!meta) return '';
    if (mode === 'progress') return meta.progress || '';
    if (mode === 'result') return meta.result || '';
    return meta.entry || '';
}

function _domainDriftGuard(mode = 'generic') {
    const td = _activeTaskDomain();
    const m = String(mode || 'generic').toLowerCase();
    if (td === 'science_bio') {
        if (m === 'result') return ' Drift-Guard (Bio): Abschluss nur als biologisches/ökologisches Fazit (Arten, Vegetation, Habitat, Stoerfaktoren). Keine Geologie-, Inspektions- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Bio): Bleib bei biologischer Beobachtung und Datenguete. Keine Technikpruefung, keine SAR-/Feuerlage.';
        return ' Drift-Guard (Bio): Nur Bio/Umwelt-Inhalte (Flora/Fauna/Habitat/Ufervegetation). Keine Risse/Statik/Schadenssuche, keine Geologie, kein SAR-/Feuer-Ton.';
    }
    if (td === 'science_geo') {
        if (m === 'result') return ' Drift-Guard (Geo): Abschluss nur als geologisches/geomorphologisches Fazit (Relief, Erosion, Hangstabilitaet, Sedimente). Keine Bio- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Geo): Bleib bei Relief/Erosion/Hangbeobachtung und Datenguete. Keine Arten-/Vegetationsanalyse, kein Medien-/Einsatz-Ton.';
        return ' Drift-Guard (Geo): Nur geologische/geomorphologische Einordnung. Keine Arten-/Uferbiologie, keine Technikinspektion, kein SAR-/Feuer-Ton.';
    }
    if (td === 'mapping_survey') {
        if (m === 'result') return ' Drift-Guard (Survey): Abschluss mit Datenguete, Abdeckung und naechstem Auswertungsschritt. Keine Schadensdiagnose, keine Story-, Historiker- oder Sightseeing-Formulierungen.';
        if (m === 'progress') return ' Drift-Guard (Survey): Nur Survey-Logik, Linien/Orbit, Hoehenstabilitaet, Ueberlappung, Abdeckung und Datenqualitaet. Keine Ortsanekdoten, keine Risse/Schaeden.';
        return ' Drift-Guard (Survey): Technisch-praezise Vermessungs-/Dokumentationssprache. Keine Begeisterungs- oder Tourismusformeln, keine SAR-/Inspektionsdramatik. Arbeitsmuster nur als geplante Linie oder Orbit nennen, nicht als bereits gepruefte Pattern-Wertung.';
    }
    if (td === 'poi_learning_guide') {
        if (m === 'result') return ' Drift-Guard (Lern-Guide): Abschluss mit 1-2 klaren Fakten/Einordnung und einem ruhigen Weiterflug-Hinweis. Du erklaerst dem Piloten die Gegend; nicht sagen, dass du selbst fuer spaetere Touren lernst. Keine Arbeitsanweisung, keine Einsatz-/Inspektionssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        if (m === 'progress') return ' Drift-Guard (Lern-Guide): Nur Fakten, Kontext und Orientierung zum Ziel. Du bist Guide fuer den Piloten, kein angehender Guide im Trainingsflug. Keine Checklisten, keine Mess-/Schadenssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        return ' Drift-Guard (Lern-Guide): Bildungsorientiert und anschaulich. Du erklaerst Ziel und Umgebung fuer den Piloten. Keine Formulierungen wie "ich lerne fuer spaetere Touren" oder "Gelaende abspeichern". Keine Instruktoranweisungen, keine feste Arbeitshoehe verlangen, kein SAR-/Fire-/Inspektions-Ton. Keine Strommasten, Windraeder oder andere Spezial-Landmarken nennen, ausser sie sind das Ziel oder sicher bestaetigt.';
    }
    if (td === 'sightseeing_tour') {
        if (!_isPOIMission()) {
            if (m === 'result') return ' Drift-Guard (APT-Sightseeing): Abschluss als Ankommen am Zielplatz mit Vorfreude auf Zielort, Altstadt, Aussichtspunkt, Spaziergang, Fotos oder Cafe nach der Landung. Kein Rueckkehr-, Rundflug-, Auftrag-, Befund-, Daten- oder Inspektionston.';
            if (m === 'progress') return ' Drift-Guard (APT-Sightseeing): Privater Hinflug zur Zielregion; nenne Vorfreude, Zielort, Landschaft, Fotos oder Plaene nach der Landung. Keine Arbeits-, Einsatz-, Vermessungs-, Instruktor-, Rueckflug- oder Rundflug-Sprache.';
            return ' Drift-Guard (APT-Sightseeing): Persoenlicher A-B-Ausflug zur Zielregion. Keine Arbeitsanweisung, keine feste Arbeitshoehe verlangen, keine Erfassung/Dokumentation/Lagebild/Inspektion. Zielplatz als Gateway zum privaten Plan nach der Landung erzaehlen, nicht als POI-Rundflug.';
        }
        if (m === 'result') return ' Drift-Guard (Sightseeing): Abschluss als warmer Blickmoment mit entspannter Rueckkehr. Keine Woerter wie fertig, abgearbeitet, Befund, Daten, Dokumentation, Erfassung, Inspektion oder Lagebild.';
        if (m === 'progress') return ' Drift-Guard (Sightseeing): Nur Aussicht, Orientierung, Erinnerungsfotos und ruhige Beobachtung. Keine Arbeits-, Einsatz-, Vermessungs- oder Instruktor-Sprache.';
        return ' Drift-Guard (Sightseeing): Persoenlicher Rundflugston. Keine Arbeitsanweisung, keine feste Arbeitshoehe verlangen, keine Erfassung/Dokumentation/Lagebild/Inspektion. Zielbereich nur als Blickmoment aus der Luft erzaehlen, nicht als Bodenaktionsort.';
    }
    if (td === 'news_coverage') {
        if (m === 'result') return ' Drift-Guard (News): Abschluss als kurze sachliche Lagezusammenfassung. Kein Einsatzabschluss wie SAR, kein Touri-Ton.';
        if (m === 'progress') return ' Drift-Guard (News): Nenne nur beobachtbare Fakten/Lagepunkte. Keine technische Schadensbewertung.';
        return ' Drift-Guard (News): Nuechtern und beobachtend, faktenbasiert. Keine Sightseeing-Sprache, keine Fachinspektion, keine Rollenmischung mit SAR/Fire.';
    }
    if (td === 'media_photo') {
        if (m === 'result') return ' Drift-Guard (Foto/Film): Abschluss ueber verwertbares Bildmaterial, Motive und Weitergabe an Redaktion/Gemeinde/Auftraggeber. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Foto/Film): Nur Bildserie, Motiv, Perspektive, Licht, Ortsbezug und Wiedererkennungswert. Keine Aussicht-geniessen-Sprache, keine Inspektion.';
        return ' Drift-Guard (Foto/Film): Bildredaktionell und zweckbezogen. Keine persoenliche Ausflugserzaehlung, keine Einsatz- oder Inspektionssprache.';
    }
    if (td === 'historian_guided_tour') {
        if (m === 'result') return ' Drift-Guard (Historiker): Abschluss als historische Ortslesart mit kurzem Takeaway und Rueckflughinweis. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Historiker): Nur historische Einordnung, Ortsbild, alte Wege, Lagebezug oder fruehere Nutzung. Keine Foto-, Einsatz- oder Inspektionssprache.';
        return ' Drift-Guard (Historiker): Historisch-bildend und anschaulich. Keine Sightseeing-Formel, keine Arbeitsanweisung, keine technische Bewertung.';
    }
    return '';
}

function _targetFactHint() {
    const td = _activeTaskDomain();
    if (/^(search_and_rescue|fire_watch|mapping_survey|news_coverage)$/.test(td)) return '';
    if (_activeAptTrainingPlan()) return '';
    if (td === 'poi_learning_guide') {
        const knowledgeHint = _poiKnowledgeFactHint('generic');
        if (knowledgeHint) return knowledgeHint;
    }
    const raw = document.getElementById('wikiDestDescText')?.innerText?.trim() || '';
    const contextFact = _targetContextFactCandidates().find(s => !_poiMemoryHasSimilarFact(s) && !_poiMemoryHasCue(s)) || '';
    if (!raw) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    if (/warte auf daten|lade ziel-info|nicht geladen|keine regionalen/i.test(raw)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    // Filter internal/source status text so it never leaks into spoken prompts.
    if (/(wikipedia|wiki-daten|fetch-fehler)/i.test(cleaned)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    if (/(konnte(n)?\s+nicht|nicht\s+abrufbar|nicht\s+geladen|fehler)/i.test(cleaned)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    const pickedSentence = cleaned
        .split(/[.!?]/)
        .map(s => s.trim())
        .filter(s => s.length >= 28)
        .find(s => !_poiMemoryHasSimilarFact(s) && !_poiMemoryHasCue(s)) || '';
    if (!pickedSentence && !contextFact) return '';
    const picked = pickedSentence || contextFact;
    const clip = picked.length > 180 ? `${picked.slice(0, 177)}...` : picked;
    return ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${clip}.`;
}

function _paxMemoryMentionsLandmark(lm = null) {
    const mem = _poiNarrativeMemoryText()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
    if (!mem) return false;
    const kind = String(lm?.kind || '').toLowerCase();
    const terms = [
        lm?.name,
        lm?.label,
        kind,
        kind === 'power_tower' ? 'strommast' : '',
        kind === 'powerline' ? 'freileitung' : '',
        kind === 'railway' ? 'eisenbahn' : '',
        kind === 'peak' ? 'gipfel' : '',
        kind?.startsWith?.('terrain_') ? 'gelaendemarke' : '',
        kind === 'viewpoint' ? 'aussichtspunkt' : ''
    ].map(x => String(x || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .trim())
        .filter(x => x.length >= 4);
    return terms.some(term => mem.includes(term));
}

function _paxApproachLandmarkCueLine() {
    const policy = _paxApproachLandmarkPolicy();
    if (!policy) return '';
    const maxDistM = policy.maxDistM;
    const priority = {
        railway: 1,
        peak: 2,
        terrain_ridge: 3,
        terrain_pass: 4,
        terrain_cliff: 5,
        viewpoint: 6,
        river: 7,
        canal: 8,
        bridge: 9,
        motorway: 10,
        motorway_junction: 11,
        tower: 12,
        power_tower: 13,
        powerline: 14,
        wind_turbine: 15
    };
    let landmarks = _paxConfirmedVisualLandmarks(maxDistM).filter(lm => !_paxMemoryMentionsLandmark(lm));
    if (!landmarks.length) landmarks = _paxConfirmedVisualLandmarks(maxDistM);
    const lm = landmarks
        .slice()
        .sort((a, b) => {
            const ak = priority[String(a?.kind || '').toLowerCase()] || 50;
            const bk = priority[String(b?.kind || '').toLowerCase()] || 50;
            if (ak !== bk) return ak - bk;
            return Number(a?.distM || 999999) - Number(b?.distM || 999999);
        })[0];
    if (lm) {
        const name = String(lm.name || lm.label || lm.kind || 'Landmarke').replace(/\s+/g, ' ').trim();
        const dist = Number.isFinite(Number(lm.distM)) ? `etwa ${Math.round(Number(lm.distM))} Meter` : 'in Zielnaehe';
        const rel = lm.relFromTarget ? `${lm.relFromTarget} vom POI` : 'vom POI aus sichtbar';
        const inverse = lm.targetFromLandmark ? `der POI liegt ${lm.targetFromLandmark} davon` : 'nutze sie als Bezug zum POI';
        return `${policy.prefix}: Bestaetigte Referenz: ${name}, ${dist} ${rel}; ${inverse}. ${policy.instruction} Danach hoechstens ein kurzer Zusatzfakt, keine zweite Landmarke.`;
    }

    const anchors = _paxTargetGeoContext()?.anchors || {};
    const anchorDefs = [
        ['railway', 'Bahnlinie', 'verlaeuft'],
        ['terrain', 'Gelaendemarke', 'liegt'],
        ['viewpoint', 'Aussichtspunkt', 'liegt'],
        ['water', 'Gewaesser/Ufer', 'liegt'],
        ['forest', 'Waldkante', 'liegt'],
        ['road', 'Strasse/Zufahrt', 'liegt'],
        ['path', 'Weg/Pfad', 'liegt'],
        ['power', 'Stromtrasse', 'liegt']
    ];
    for (const [key, label, verb] of anchorDefs) {
        const a = anchors?.[key];
        const dist = Number(a?.distM);
        const bearing = Number(a?.bearingDeg);
        if (!a?.present || !Number.isFinite(dist) || dist > maxDistM || !Number.isFinite(bearing)) continue;
        const name = String(a.name || '').replace(/\s+/g, ' ').trim();
        const fullLabel = name && !/^(road|path|water|forest|terrain|railway|power)$/i.test(name) ? `${label} ${name}` : label;
        const rel = _paxCardinalGerman(bearing);
        const inverse = _paxCardinalGerman(bearing + 180);
        return `${policy.prefix}: Bestaetigte Referenz: ${fullLabel} ${verb} etwa ${Math.round(dist)} Meter ${rel} vom POI; der POI liegt ${inverse} davon. ${policy.instruction} Danach hoechstens ein kurzer Zusatzfakt, keine zweite Landmarke.`;
    }
    return '';
}

function _paxCardinalGerman(bearingDeg) {
    const n = Number(bearingDeg);
    if (!Number.isFinite(n)) return '';
    const dirs = ['noerdlich', 'nordoestlich', 'oestlich', 'suedoestlich', 'suedlich', 'suedwestlich', 'westlich', 'nordwestlich'];
    const idx = Math.round((((n % 360) + 360) % 360) / 45) % 8;
    return dirs[idx] || '';
}

function _weatherContext(fd) {
    if (!fd) return '';
    const parts = [];
    if (fd.windKts != null) {
        const desc = fd.windKts > 20 ? ' (kräftig)' : fd.windKts > 10 ? ' (mäßig)' : ' (schwach)';
        parts.push(`Wind ${fd.windKts} kts aus ${fd.windDeg ?? '?'}°${desc}`);
    }
    if (fd.windGustKts != null && fd.windKts != null) {
        const spread = Math.max(0, Number(fd.windGustKts) - Number(fd.windKts));
        if (spread >= 4) parts.push(`Böen bis ${fd.windGustKts} kts`);
    } else if (fd.windGustKts != null) {
        parts.push(`Böen bis ${fd.windGustKts} kts`);
    }
    if (fd.tempC   != null) parts.push(`${fd.tempC}°C`);
    if (fd.visKm   != null) {
        const desc = fd.visKm < 3 ? ' (sehr schlecht)' : fd.visKm < 8 ? ' (eingeschränkt)' : fd.visKm > 20 ? ' (ausgezeichnet)' : '';
        parts.push(`Sicht ${fd.visKm} km${desc}`);
    }
    if (fd.precipRateMmH != null) {
        const p = Number(fd.precipRateMmH);
        const state = p >= 4 ? 'stark' : p >= 1.5 ? 'mäßig' : p > 0.05 ? 'leicht' : '';
        if (state) parts.push(`Niederschlag ${state}`);
    } else if (fd.precipActive === true) {
        parts.push('Niederschlag');
    }
    if (fd.inCloud === true) parts.push('in Wolken');
    if (fd.turbulencePct != null) {
        const t = Number(fd.turbulencePct);
        if (t >= 60) parts.push('Turbulenz stark');
        else if (t >= 35) parts.push('Turbulenz spürbar');
    }
    return parts.length ? `Wetter: ${parts.join(', ')}.` : '';
}

function _poiEntryPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    if (_activeAptTrainingPlan()) return null;
    const md    = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const altFt = Math.round(flightData?.mslFt || 0);
    const wx    = _weatherContext(flightData);
    const reqHint = '';
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const hasPoiKnowledge = !!_activePoiKnowledgeContext();
    const isProfessionalPoiTask = /^(inspection_infra|infra_chain_recon|mapping_survey|science_bio|science_geo|fire_watch|media_photo|news_coverage)$/.test(taskDomain);
    const inspHint = isHistorian ? '' : _inspectionEntryHint();
    const profHint = isHistorian ? '' : _professionalTaskHint('entry');
    const factHint = (taskDomain === 'search_and_rescue' || isLearningGuide || (isSightseeing && hasPoiKnowledge)) ? '' : _targetFactHint();
    const knowledgeFactHint = isLearningGuide ? _poiKnowledgeFactSequenceHint('entry') : (isSightseeing ? _poiKnowledgeFactHint('entry') : '');
    const driftGuard = _domainDriftGuard('entry');
    const historianHint = isHistorian
        ? ' Historiker-Rolle: Erzaehle 1 kurze historische Einordnung direkt zum Ort (Epoche, Nutzung oder lokales Ereignis). Keine Riss-/Technik-/Inspektionssprache.'
        : '';
    const learningGuideHint = isLearningGuide
        ? ' Lern-Guide-Rolle: Nenne einen kurzen Fakt, bei einer mehrteiligen WISSENS-FAKTENQUEUE auch 2-3 unterschiedliche Fakten als Mini-Erzaehlung direkt zum Ziel. Fuehre den Piloten ruhig zum Punkt. Keine Arbeitsanweisung, keine Hoehenforderung, kein "ich suche nach Schaeden".'
        : '';
    const sarZoneGuard = (taskDomain === 'search_and_rescue')
        ? ' Bleib strikt im Suchkorridor rund um das Zielobjekt. Keine entfernten Orts-/Gewaesserbezuege ausserhalb der Suchzone.'
        : '';
    const trainingPlan = _activeAptTrainingPlan();
    const trainingHint = trainingPlan
        ? ' Als Instruktor: bleib strikt prozedural. Fokus auf Flugweg, Maschine, Luftraum-Scan und Sicherheitsverfahren. Keine Ortsfakten, keine Geschichte, kein Schwärmen.'
        : '';
    const noRepeatHint = _poiNoRepeatHint('entry');
    return `${ctx}

Moment: Das Zielgebiet "${md?.poiName || 'Ziel'}" taucht gerade vor uns auf — wir sind auf ${altFt} ft.${wx ? ' ' + wx : ''}
${isLearningGuide ? 'Fuehre den Piloten jetzt kurz zum Ziel und gib direkt einen kurzen Wissensbogen zum Ort.' : (isProfessionalPoiTask ? 'Du beginnst jetzt mit der fachlichen Zielaufnahme. Sag knapp, worauf du fuer den Auftrag achtest.' : 'Du siehst es zum ersten Mal aus der Luft. Zeig dem Piloten spontan was du erkennst.')}${reqHint}${inspHint}${profHint}${knowledgeFactHint}${factHint}${historianHint}${learningGuideHint}${sarZoneGuard}${trainingHint}
${noRepeatHint}
${driftGuard}
${taskDomain === 'search_and_rescue' ? '1-2 Saetze, einsatznah und klar, keine Begeisterungsformel.' : (isLearningGuide ? '2-4 kurze Sätze, anschaulich und ruhig, ohne zu dozieren.' : (isProfessionalPoiTask ? '1-2 Sätze, sachlich und fachlich, keine Begeisterungsformel.' : '1-2 Sätze, darf etwas begeisterter sein als sonst.'))}${_toneHint()}`;
}

function _poiInSightPrompt(flightData, distNm, etaMin, clockPos, options = {}) {
    const ctx = _baseContext();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    if (!ctx || !md) return null;
    if (_activeAptTrainingPlan()) return null;
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const hasPoiKnowledge = !!_activePoiKnowledgeContext();
    const approachLandmarkHint = _paxApproachLandmarkCueLine();
    const factHint = (taskDomain === 'search_and_rescue' || approachLandmarkHint || isLearningGuide || (isSightseeing && hasPoiKnowledge)) ? '' : _targetFactHint();
    const knowledgeFactHint = isLearningGuide || isSightseeing ? _poiKnowledgeFactHint('in_sight') : '';
    const driftGuard = _domainDriftGuard('in_sight');
    const announcedEta = Math.max(1, Math.round(Number(options.announcedEtaMin || 0) || 2)); // Default bewusst knapper wegen Latenz durch Text+TTS
    const roundedDist = Math.max(0.5, Math.round(distNm * 10) / 10);
    const realEta = Math.max(1, Math.round(etaMin));
    const pax = window.activePassenger || {};
    const targetAltFt = Number(pax?.targetAltFt || 0);
    const altBrief = (!isLearningGuide && !/^(sightseeing_tour|science_bio|science_geo)$/.test(taskDomain) && targetAltFt > 0)
        ? ` Nenne in derselben Meldung bitte kurz die geplante Arbeitsflughöhe: "${targetAltFt} Fuß".`
        : '';
    const trainingPlan = _activeAptTrainingPlan();
    const trainingHint = trainingPlan
        ? `Instruktor-Modus: Nur fliegerische Hinweise (Anflugstruktur, Luftraum-Scan, Kurs-/Höhenführung, Arbeitsverteilung im Cockpit). Landmarken nur als nüchterne Navigationsreferenz, keine Objektbeschreibung oder Ortsanekdoten.`
        : '';
    const sarZoneGuard = (taskDomain === 'search_and_rescue')
        ? ' Nur suchrelevante Referenzen in direkter Naehe des Zielobjekts nennen. Keine entfernten Orts-/Gewaesserbezuege.'
        : '';
    const historianInSightHint = isHistorian
        ? ' Historiker-Rolle: knapp historisch einordnen (z.B. Epoche/Funktion/regionale Bedeutung), ohne technische Befundsprache.'
        : '';
    const learningInSightHint = isLearningGuide
        ? ' Lern-Guide-Rolle: Sage nicht "in Sicht", sondern orientiere den Piloten ruhig zur Position. Landmarken-Lokalisierung hat Vorrang; wenn es ohne Hektik passt, ergaenze genau einen neuen Wissensfakt.'
        : '';
    const roleTone = (taskDomain === 'search_and_rescue')
        ? 'SAR-Rolle: knapp, klar, lageorientiert, kein Sightseeing-Ton. Max 2 Saetze.'
        : (isLearningGuide
            ? 'Lern-Guide: bildend und klar, ohne Anweisungsstil oder Einsatzsprache. Max 2 Saetze.'
            : (isHistorian
                ? 'Historiker-Rolle: bildungsorientiert und anschaulich, kein Technik-/Inspektionston. Max 2 Saetze.'
                : (taskDomain === 'sightseeing_tour'
                    ? 'Sightseeing-Rolle: freundlich und beobachtend, keine Flug- oder Manöveranweisungen. Max 2 Saetze.'
                    : (/^(inspection_infra|infra_chain_recon|mapping_survey|science_bio|science_geo|fire_watch|media_photo|news_coverage)$/.test(taskDomain)
                        ? 'Fachrolle: knapp, professionell, zielbezogen, keine Steuer- oder Manöveranweisungen. Max 2 Sätze.'
                        : 'Rolle: kurz, glaubwuerdig und beobachtend, keine Flug- oder Manöveranweisungen. Max 2 Sätze.'))));
    const chainSpec = taskDomain === 'infra_chain_recon' ? _poiChainActiveSpec() : null;
    if (chainSpec) {
        const label = String(chainSpec.label || md.poiName || 'Korridor').trim();
        const segmentCount = Number(chainSpec.corridor?.segments?.length || 0);
        const segmentHint = segmentCount > 0
            ? ` Der Korridor ist in ${segmentCount} Abschnitte geteilt; diese technische Zahl nur nennen, wenn es natuerlich klingt.`
            : '';
        return `${ctx}

Moment: Wir sind kurz vor dem Einstieg in den Korridor "${label}". Distanz etwa ${roundedDist} NM, reale ETA ca. ${realEta} min.
Bereite den Piloten knapp auf die Korridorarbeit vor und sage sinngemaess: noch ca. ${announcedEta} Minuten bis zum Einstieg in den Korridor. Keine "Objekt in Sicht"-Formel und keine 12-Uhr-Sichtmeldung; es geht um den Beginn der Linie, die danach sauber im Band abgeflogen wird.${altBrief}${segmentHint}${approachLandmarkHint ? `\n${approachLandmarkHint}` : ''}${factHint} ${trainingHint}
${driftGuard}
Fachrolle: ruhig, professionell, zielbezogen. Max 2 Sätze.${_toneHint()}`;
    }
    return `${ctx}

Moment: Zielobjekt "${md.poiName || 'Ziel'}" wird im Anflug sichtbar. Distanz etwa ${roundedDist} NM, reale ETA ca. ${realEta} min, relative Lage ${clockPos}.
${isLearningGuide
        ? `Gib eine kurze Orientierung zur Lage in der 12-Uhr-Logik (${clockPos}) und nenne "ca. ${announcedEta} Minuten". Nutze danach bevorzugt eine bestaetigte Landmarke, um zu erklaeren, wo der POI liegt.`
        : `Sag dem Piloten kurz und sachlich, dass du das Objekt in Sicht hast, nenne die Lage in der 12-Uhr-Logik (${clockPos}) und ansage "ca. ${announcedEta} Minuten".`}${altBrief}${approachLandmarkHint ? `\n${approachLandmarkHint}` : ''}${knowledgeFactHint}${factHint}${sarZoneGuard}${historianInSightHint}${learningInSightHint} ${trainingHint}
${driftGuard}
${roleTone}${_toneHint()}`;
}

function _poiAltComplaintPrompt(flightData, altFt, targetAlt, attempt) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const diff = altFt - targetAlt;
    const dir  = diff < 0 ? `${Math.abs(Math.round(diff))} ft zu niedrig` : `${Math.round(diff)} ft zu hoch`;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const isLast = attempt >= (_paxStrictMode ? 2 : 3);
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Wir sind am Ziel "${md?.poiName || 'Ziel'}", aber die Höhe passt noch nicht.
Aktuell: ${altFt} ft (${dir} von meinen benötigten ${targetAlt} ft).${wx ? ' ' + wx : ''}${isLast ? ' Das ist mein letzter Versuch — danach müssen wir leider aufgeben.' : ''}
Bitte den Piloten freundlich aber klar, die Höhe anzupassen. 1-2 Sätze.${_toneHint()}`;
}

function _poiAltCorrectedPrompt(flightData) {
    const ctx = _baseContext();
    if (!ctx) return null;
    const pax = window.activePassenger || {};
    const altFt = Math.round(flightData?.mslFt || 0);
    const targetAlt = Math.round(Number(pax?.targetAltFt || 0));
    let altLine = `Höhe passt jetzt — wir sind auf ${altFt} ft im Zielgebiet.`;
    if (targetAlt > 0) {
        const diff = altFt - targetAlt;
        if (Math.abs(diff) <= 120) {
            altLine = `Die geplanten ${targetAlt} ft passen jetzt, ich fange mit der Beobachtung an.`;
        } else {
            altLine = `Wir sind mit ${altFt} ft jetzt im Arbeitsband um die geplanten ${targetAlt} ft, ich starte die Beobachtung.`;
        }
    }
    return `${ctx}

Moment: ${altLine} Sag dem Piloten kurz, dass es jetzt stimmt und du anfangen kannst. 1 Satz.${_toneHint()}`;
}

function _poiSatisfiedPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const dwell = Math.round(_poiDwellSec / 60 * 10) / 10;
    const wx = _weatherContext(flightData);
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const isSightseeingApt = isSightseeing && !_isPOIMission();
    const isMediaPhoto = taskDomain === 'media_photo';
    const isMappingSurvey = taskDomain === 'mapping_survey';
    const isScienceBio = taskDomain === 'science_bio';
    const isScienceGeo = taskDomain === 'science_geo';
    const reconOutcomeActive = _activeBushReconOutcome();
    const inspResultHint = reconOutcomeActive ? '' : _inspectionResultHint();
    const bushReconResultHint = _bushReconOutcomeHintLine('result');
    const profResultHint = _professionalTaskHint('result');
    const sarResultHint = _sarResultHint();
    const driftGuard = _domainDriftGuard('result');
    const historianResultHint = isHistorian
        ? ' Historiker-Fazit: Schließe mit 1 konkreten historischen Takeaway zum Ort (zeitliche Einordnung oder Bedeutung) und einem klaren Weiterflug-Hinweis. Keine technische Zustandsbewertung.'
        : '';
    const learningResultHint = isLearningGuide
        ? ' Lern-Guide-Fazit: Schließe mit 1 konkreten Lernpunkt zum Ziel, bei reichhaltiger WISSENS-FAKTENQUEUE auch mit 2 kurzen Takeaway-Fakten, und einem lockeren Hinweis, dass wir zum naechsten Punkt weiterkoennen.'
        : '';
    const knowledgeResultFactHint = isLearningGuide ? _poiKnowledgeFactSequenceHint('result') : (isSightseeing ? _poiKnowledgeFactHint('result') : '');
    const sightseeingResultHint = isSightseeing
        ? (isSightseeingApt
            ? ' Sightseeing-Ankunft: Schließe als privater Gast mit Ankunftsfreude auf den Zielort und den Plan nach der Landung. Kein Rueckflug-Hinweis, kein Rundflug-Fazit, nicht "fertig", "abgearbeitet" oder wie ein Auftrag klingen.'
            : ' Sightseeing-Fazit: Schließe mit einem persoenlichen Blickmoment zum Ziel und einem entspannten Rueckflug-Hinweis. Nicht "fertig", "abgearbeitet" oder wie ein Auftrag klingen.')
        : '';
    const mediaResultHint = isMediaPhoto
        ? ' Foto/Film-Fazit: Schließe mit einem kurzen Satz, welche Art Material im Kasten ist (Aufmacherbild, Bildserie, Establishing Shots oder Ortsmotiv) und wohin es danach geht. Nicht wie Sightseeing klingen.'
        : '';
    const mappingResultHint = isMappingSurvey
        ? ' Survey-Fazit: Schließe mit einem kurzen Satz zu Abdeckung/Datenguete und dem naechsten Auswertungsschritt. Keine Schadensdiagnose, kein Sightseeing-Fazit.'
        : '';
    const scienceBioResultHint = isScienceBio
        ? ' Bio-Fazit: Schließe mit einem kurzen fachlichen Takeaway zu Habitat, Artenhinweis, Vegetation, Uferstruktur oder Stoerfaktor und nenne den naechsten Auswertungsschritt. Kein Sightseeing-Fazit.'
        : '';
    const scienceGeoResultHint = isScienceGeo
        ? ' Geo-Fazit: Schließe mit einem kurzen fachlichen Takeaway zu Relief, Erosion, Sediment, Uferkante oder Hangform und nenne den naechsten Auswertungsschritt. Kein Sightseeing-Fazit.'
        : '';
    const sarEndRule = (taskDomain === 'search_and_rescue')
        ? ' Formuliere ein klares Einsatzende mit Leitstellenbezug. Kein neutraler "alles im Kasten"-Satz.'
        : '';
    const inspectionCompletionRule = (taskDomain === 'inspection_infra' && !reconOutcomeActive)
        ? ' Gib zuerst ein fachliches Kurzfazit: Was hast du gesehen, wie sieht der Zustand aus, und ob Nacharbeit oder Beobachtung noetig ist. Erst danach darfst du den Weiter- oder Rueckflug freigeben.'
        : '';
    const noRepeatHint = _poiNoRepeatHint('result');
    let momentLine = `Moment: Ich bin fertig am Ziel (${dwell} Minuten).${wx ? ' ' + wx : ''}`;
    if (isSightseeingApt) {
        momentLine = `Moment: Wir sind am Zielflugplatz angekommen; der private Sightseeing-Plan in der Zielregion beginnt nach dem Aussteigen.${wx ? ' ' + wx : ''}`;
    } else if (isSightseeing) {
        momentLine = `Moment: Die ruhige Sightseeing-Runde am Ziel hat nach ${dwell} Minuten ihren Blickmoment gehabt.${wx ? ' ' + wx : ''}`;
    } else if (isHistorian) {
        momentLine = `Moment: Die historische Runde am Ziel ist nach ${dwell} Minuten gut eingeordnet.${wx ? ' ' + wx : ''}`;
    } else if (isMediaPhoto) {
        momentLine = `Moment: Die Foto-/Filmserie am Ziel ist nach ${dwell} Minuten im Kasten.${wx ? ' ' + wx : ''}`;
    } else if (isMappingSurvey) {
        momentLine = `Moment: Der Survey-Pass am Ziel hat nach ${dwell} Minuten genug Datenzeit bekommen.${wx ? ' ' + wx : ''}`;
    } else if (isScienceBio) {
        momentLine = `Moment: Die biologische Beobachtungsrunde am Ziel hat nach ${dwell} Minuten genug Vergleichsbilder und Notizen geliefert.${wx ? ' ' + wx : ''}`;
    } else if (isScienceGeo) {
        momentLine = `Moment: Die geologische Beobachtungsrunde am Ziel hat nach ${dwell} Minuten genug Vergleichsbilder und Notizen geliefert.${wx ? ' ' + wx : ''}`;
    }

    let requestLine = 'Sag dem Piloten kurz, dass du fertig bist und wir weiterfliegen können.';
    if (isSightseeingApt) {
        requestLine = 'Sag dem Piloten kurz, dass die Ankunft gut passt, du dich auf den Zielort nach der Landung freust und dich fuer den ruhigen Hinflug bedankst. Kein Rueckflughinweis.';
    } else if (isSightseeing) {
        requestLine = 'Sag dem Piloten kurz, dass der Blick gepasst hat und wir entspannt zurueckfliegen koennen.';
    } else if (isHistorian) {
        requestLine = 'Sag dem Piloten kurz, welcher historische Takeaway bleibt und dass wir ruhig zurueckfliegen koennen.';
    } else if (isMediaPhoto) {
        requestLine = 'Sag dem Piloten kurz, dass das Material verwertbar ist und wir zurueckfliegen koennen.';
    } else if (isMappingSurvey) {
        requestLine = 'Sag dem Piloten kurz, dass der Datensatz verwertbar wirkt und die Auswertung als naechster Schritt folgen kann.';
    } else if (isScienceBio) {
        requestLine = 'Sag dem Piloten kurz, welche biologische Beobachtung fuer die Auswertung haengen bleibt und dass wir zurueckfliegen koennen.';
    } else if (isScienceGeo) {
        requestLine = 'Sag dem Piloten kurz, welche geologische Beobachtung fuer die Auswertung haengen bleibt und dass wir zurueckfliegen koennen.';
    }
    return `${ctx}

${momentLine}
${requestLine}${sarResultHint}${inspResultHint}${bushReconResultHint}${inspectionCompletionRule}${profResultHint}${historianResultHint}${mediaResultHint}${mappingResultHint}${scienceBioResultHint}${scienceGeoResultHint}${knowledgeResultFactHint}${learningResultHint}${sightseeingResultHint}${sarEndRule}${noRepeatHint}${driftGuard} ${isLearningGuide ? '2-3 kurze Sätze.' : '1-2 Sätze.'}${_toneHint()}`;
}

function _poiAbortPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Trotz mehrfacher Bitte war die Höhe nicht erreichbar — ich kann unter diesen Bedingungen nicht arbeiten.${wx ? ' ' + wx : ''}
Erkläre dem Piloten verständnisvoll, dass wir die Mission abbrechen und zurückfliegen müssen. Kein Vorwurf — manchmal passt es einfach nicht. 2 Sätze.${_toneHint()}`;
}

function _poiMissingCargoAbortPrompt(flightData, taskState = null) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    const state = taskState && typeof taskState === 'object'
        ? taskState
        : { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    const short = (Array.isArray(state.blockingItems) ? state.blockingItems : []).slice(0, 3).join(', ');
    const itemLine = state.reason === 'damaged'
        ? (short
            ? `${short} ist beschaedigt, damit kann ich den Auftrag hier nicht sauber zu Ende bringen.`
            : 'Ein wichtiger Gegenstand ist beschaedigt, damit kann ich den Auftrag hier nicht sauber zu Ende bringen.')
        : state.reason === 'dropped'
            ? (short
                ? `${short} ist nicht mehr einsatzbereit an Bord, das ist fuer meinen Auftrag wichtig.`
                : 'Ein wichtiger Gegenstand ist nicht mehr einsatzbereit an Bord.')
            : (short
                ? `Uns fehlt hier ${short}, das ist fuer meinen Auftrag wichtig.`
                : 'Uns fehlt hier ein wichtiger Gegenstand fuer meinen Auftrag.');
    return `${ctx}

Moment: Wir sind am Zielgebiet, aber ${itemLine}${wx ? ' ' + wx : ''}
Sag dem Piloten klar und ruhig, dass wir die Beobachtung jetzt abbrechen und direkt zum Start-/Heimatplatz zurückfliegen sollen. Kein Vorwurf, keine Verweilzeit, keine Arbeitsfortsetzung. Nenne den betroffenen Gegenstand beim Namen und benenne klar, ob er fehlt oder beschaedigt ist. Max 2 Sätze.${_toneHint()}`;
}