// Generated from original passenger-voice.js functions by tools/generate-poi-voice-core.mjs.
// Do not hand-edit prompt text or rules; update the App source and verify parity.
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./mission-poi-task-core.js') : root.GAMissionPoiTaskCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiVoiceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(taskCore) {
'use strict';
const CONTEXT_SCHEMA = 'ga.mission-poi-voice-context.v1';
const DOMAINS = Object.freeze(['media_photo', 'inspection_infra', 'news_coverage', 'science_bio', 'science_geo', 'science_general', 'sightseeing_tour', 'poi_learning_guide', 'mapping_survey', 'infra_chain_recon', 'fire_watch', 'search_and_rescue', 'training', 'club_training_basic', 'club_training_advanced']);
const PROMPTS = Object.freeze(["_poiEntryPrompt","_poiInSightPrompt","_poiAltComplaintPrompt","_poiAltCorrectedPrompt","_poiSatisfiedPrompt","_poiAbortPrompt","_poiMissingCargoAbortPrompt"]);
const clone = value => JSON.parse(JSON.stringify(value));
function normalizeMemory(value = {}) {
  return { pre: String(value?.pre || '').slice(0, 180), entry: String(value?.entry || '').slice(0, 180),
    done: String(value?.done || '').slice(0, 180), inspectionOutcome: String(value?.inspectionOutcome || '').slice(0, 40) || null,
    ...(['found', 'not_found'].includes(value?.sarSearchOutcome) ? {sarSearchOutcome:value.sarSearchOutcome} : {}),
    ...(Array.isArray(value?.knowledgeManual) && value.knowledgeManual.length ? { knowledgeManual: value.knowledgeManual.filter(x => typeof x === 'string').slice(-512) } : {}),
    ...(value?.knowledgeSpoken ? { knowledgeSpoken: String(value.knowledgeSpoken).slice(-4000) } : {}) };
}
function validateContext(context, missionId = context?.missionId) {
  if (context?.schema !== CONTEXT_SCHEMA || context.version !== 1 || !missionId || context.missionId !== missionId)
    return 'poi_voice_context_identity_invalid';
  if (!DOMAINS.includes(context.taskDomain) || typeof context.strict !== 'boolean'
      || !context.passenger || Array.isArray(context.passenger) || typeof context.baseContext !== 'string' || !context.baseContext.trim()
      || typeof context.audioEnabled !== 'boolean') return 'poi_voice_context_invalid';
  if (['sarHeli', 'bush'].some(key => context.passenger[key])) return 'poi_voice_specialized_context_not_migrated';
  if (['trainingPlan','trainingProcedure','trainingRecipe'].some(key => context.passenger[key]) && !['training','club_training_basic','club_training_advanced'].includes(context.taskDomain)) return 'poi_voice_specialized_context_not_migrated';
  if (context.passenger.poiChain && context.taskDomain !== 'infra_chain_recon') return 'poi_voice_specialized_context_not_migrated';
  if (context.passenger.surveyPattern && context.taskDomain !== 'mapping_survey') return 'poi_voice_specialized_context_not_migrated';
  try {
    if (encodeURIComponent(JSON.stringify(context)).replace(/%[A-F0-9]{2}/g, 'x').length > 65536)
      return 'poi_voice_context_too_large';
  } catch (_) { return 'poi_voice_context_invalid'; }
  return null;
}
function original(context = {}, previous = {}, cue = {}, randomValue = 0.5) {
  const window = { activePassenger: context.passenger, lastLiveGpsPos: cue.sample || {}, lastLiveFlightData: cue.sample || cue.dynamic?.liveWeather,
    paxVoiceGetPoiMissionProgress: () => cue.dynamic?.poiProgress || {}, missionRuntimeIsActive: () => cue.active !== false,
    missionSurveyPattern: { getActiveSpec: () => context.surveySpec || null, snapshot: () => cue.detector?.surveyProgress || null } };
  const _paxDebugMotionProtectionEnabled = () => context.motionProtectionEnabled === true;
  const _consumeWeatherMismatchEasteregg = () => cue.dynamic?.weatherMismatchHint || '';
  const _bushPickupNarrativeHint = () => '';
  const _followUpDeboardingHintLine = () => context.followUpDeboardingHint || '';
  const _activeMissionStoryFrame = () => context.storyFrame || { focusSubject: context.storyFocusSubject };
  const _poiAborted = (cue.detector || cue.dynamic?.poiProgress)?.aborted === true;
  const _poiSatisfied = cue.detector?.satisfied === true;
  const _poiInRadius = cue.detector?.inRadius === true;
  const _activeMissionData = () => context.missionData || {};
  const _getDestCoords = () => cue.target || null;
  const _haversineNm = (...args) => taskCore.distanceNm(...args);
  const _bearingDeg = (...args) => taskCore.bearingDeg(...args);
  const _relativeClockPos = (...args) => taskCore.relativeClockPos(...args);
  window.missionPoiChainRuntime = { getActiveSpec: () => context.chainSpec || null, snapshot: () => cue.detector?.chainProgress || cue.dynamic?.poiProgress?.poiChain || null };
  const chainEvents = [];
  const _speakerSnapshotForMissionVoice = () => context.chainSpeaker || context.speaker;
  const _paxLog = () => {};
  const _paxMissionAudioCueId = (scope, kind, fallback) => context.chainAudioCueIds?.[kind] ?? fallback;
  let sequencePart = [];
  const _paxPlayAudioCue = (id, seed, options) => { sequencePart.push({ id, seed, options }); };
  const _paxPlayPhotoBurst = (seed, options) => _paxPlayAudioCue('photo', seed, options);
  const _speakPreparedText = (key, text, speaker, label, options) => {
    sequencePart = []; if (options.beforeAudio) options.beforeAudio(0); const before = sequencePart;
    sequencePart = []; if (options.afterAudio) options.afterAudio(0);
    chainEvents.push({ key, text, speaker, label, sounds: { before, after: sequencePart } });
  };
  const _paxCityDatasetAvailable = () => true;
  const _paxMapPlaceOrientationLine = () => context.mapPlaceOrientationLine || '';
  let actionResult = null;
  const _missionActionSpeak = (prompt, label, fallbackText) => { actionResult = { prompt: prompt || '', label, fallbackText }; };
  const _paxSpeakTextDirect = (text, label) => _missionActionSpeak('', label, text);
  const _missionHasPax = () => true;
  const _speakerSnapshotForActivePax = () => context.speaker;
  const _paxMissionAudioKey = kind => kind + ':' + context.missionId;
  const currentMissionData = context.missionData || {};
  const document = { getElementById: id => id === 'wikiDestDescText' ? { innerText: context.wikiText || '' } : null };
  const Math = Object.create(globalThis.Math);
  Math.random = () => randomValue;
  const _baseContext = () => context.baseContext;
  const _toneHint = () => context.toneHint || '';
  const _activeTaskDomain = () => context.taskDomain;
  const _isPOIMission = () => cue.missionMode !== 'APT';
  const _activeAptTrainingPlan = () => context.trainingPlan || null;
  const _trainingEvalSummary = () => cue.dynamic?.trainingSummary || cue.dynamic?.poiProgress?.trainingSummary || null;
  window.missionTrainingProcedure = { snapshot: () => cue.dynamic?.trainingProcedureSummary || cue.dynamic?.poiProgress?.trainingProcedure || cue.detector?.trainingProgress || null };
  const _activePoiKnowledgeContext = () => {
    const knowledge = context.knowledgeContext;
    const status = String(knowledge?.status || '').toLowerCase();
    return knowledge && Array.isArray(knowledge.facts) && knowledge.facts.length && (!status || status === 'accept')
      ? knowledge : (context.captureKnowledge ? {} : null);
  };
  const _activeBushReconOutcome = () => null;
  const _bushReconOutcomeHintLine = () => '';
  let _sarSearchOutcome = normalizeMemory(previous).sarSearchOutcome || (['found','not_found'].includes(context.sarSearchOutcome) ? context.sarSearchOutcome : null);
  const _inspectionMissionMeta = () => context.inspectionMeta || null;
  const _activeInfraInspectionOutcome = () => context.infraOutcome || null;
  const _professionalRoleMeta = () => context.professionalMeta || null;
  const _targetContextFactCandidates = () => context.targetFacts || [];
  const _paxApproachLandmarkPolicy = () => context.landmarkPolicy || null;
  const _paxConfirmedVisualLandmarks = () => context.visualLandmarks || [];
  const _paxTargetGeoContext = () => context.targetGeoContext || null;
  const _paxStrictMode = context.strict;
  const _poiDwellSec = Number(cue.detector?.dwellSec || 0);
  const _poiNarrativeMemory = normalizeMemory(previous);
  let _poiKnowledgeSpokenMemory = String(previous.knowledgeSpoken || '').slice(-4000);
  let _poiKnowledgeManualFactIndices = new Set(previous.knowledgeManual || []);
  const _refreshPoiKnowledgeGuideMenu = () => {};
  let _poiKnowledgeContextKey = _poiKnowledgeContextIdentity(_activePoiKnowledgeContext());
  let _poiInspectionOutcome = _poiNarrativeMemory.inspectionOutcome;
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

function _professionalLandingToneHint() {
    const meta = _professionalRoleMeta();
    if (!meta) return '';
    return ' Ton bei Landung: sachlich, knapp und dankend. Kein Show-/Sightseeing-Ton.';
}

function _getSarSearchOutcome() {
    if (_sarSearchOutcome) return _sarSearchOutcome;
    // Slight bias to "not found" for realism in random missions.
    _sarSearchOutcome = (Math.random() < 0.38) ? 'found' : 'not_found';
    return _sarSearchOutcome;
}

function _sarResultHint() {
    if (_activeTaskDomain() !== 'search_and_rescue') return '';
    const frame = _activeMissionStoryFrame();
    const subject = String(frame?.focusSubject || '').trim();
    const outcome = _getSarSearchOutcome();
    if (outcome === 'found') {
        return subject
            ? ` SAR-Fazit: Melde klar, dass du zu "${subject}" jetzt einen verwertbaren Treffer hast und die Position sofort an die Leitstelle weitergibst.`
            : ' SAR-Fazit: Melde klar, dass du die vermisste Person entdeckt hast und die Koordinaten sofort an die Leitstelle weitergibst.';
    }
    return subject
        ? ` SAR-Fazit: Melde klar, dass wir zu "${subject}" in diesem Sektor noch keinen Treffer haben und die Leitstelle fuer weitere Suchabschnitte informiert wird.`
        : ' SAR-Fazit: Melde klar, dass wir in diesem Sektor keine Person finden konnten und die Leitstelle fuer weitere Suchabschnitte informiert wird.';
}

function _poiManualReportSubject() {
    const frame = _activeMissionStoryFrame();
    const detail = String(frame?.subjectDetail || frame?.focusSubject || '').trim();
    if (detail) return detail;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    return String(md.poiName || md.targetName || 'den Suchhinweis').trim() || 'den Suchhinweis';
}

function _poiManualFoundPrompt(ctx) {
    const base = _baseContext();
    if (!base) return null;
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const clueLine = Array.isArray(frame?.visibleClueCandidates) && frame.visibleClueCandidates.length
        ? frame.visibleClueCandidates.join(', ')
        : 'keine Zusatzhinweise';
    const distLine = Number.isFinite(Number(ctx?.confirmDistNm))
        ? `Wir sind nah genug am Missionsanker (${ctx.confirmDistNm.toFixed(2)} NM).`
        : 'Wir sind nah genug am Missionsanker.';
    return `${base}

Button-Frage: Der Pilot meldet eine moegliche Sichtung und bittet um sofortige Bestaetigung.
Missionsanker: ${ctx?.confirmCoords?.name || ctx?.targetName || 'Zielgebiet'}
${distLine}
Zu bestaetigen: ${subject}
Letzte Lage: ${String(frame?.lastSeenContext || frame?.incidentContext || 'n/a').trim() || 'n/a'}
Vermutung: ${String(frame?.probableScenario || frame?.soughtOutcome || 'n/a').trim() || 'n/a'}
Moegliche Hinweise: ${clueLine}
Antworte als Passagier/Rollenperson mit einer klaren positiven Sichtbestaetigung. Sage, dass der Fund bzw. belastbare Sichtkontakt an die Einsatzleitung geht und der Rueckflug bzw. die naechste Phase beginnen kann. Kein Zweifel, keine neue Suche eroeffnen. Max 2 Saetze.${_toneHint()}`;
}

function _poiManualNotFoundPrompt(ctx) {
    const base = _baseContext();
    if (!base) return null;
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const distNm = Number(ctx?.confirmDistNm);
    const distLine = Number.isFinite(distNm)
        ? `Aktuell sind wir noch ${distNm.toFixed(1)} NM vom Missionsanker entfernt; fuer eine belastbare Bestaetigung ist das zu frueh.`
        : 'Aktuell fehlt noch die noetige Naehe zum Missionsanker.';
    return `${base}

Button-Frage: Der Pilot fragt, ob die vermisste Person bzw. der Suchhinweis bereits bestaetigt ist.
${distLine}
Zu bestaetigen waere: ${subject}
Letzte Lage: ${String(frame?.lastSeenContext || frame?.incidentContext || 'n/a').trim() || 'n/a'}
Antworte klar, dass du noch keinen positiven Sichtkontakt bestaetigen kannst und weiter suchen willst. Bitte um weiteres Suchmuster oder noch etwas Naeherung, aber ohne neue Story aufzumachen. Max 2 Saetze.${_toneHint()}`;
}

function _poiManualFoundFallback(ctx) {
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const outcome = String(frame?.soughtOutcome || '').trim();
    return `${subject} passt jetzt zur gemeldeten Lage, ich bestaetige den Fund. Ich gebe den Sichtkontakt an die Einsatzleitung weiter${outcome ? ` und habe damit ${outcome.charAt(0).toLowerCase()}${outcome.slice(1)}` : ''}; wir koennen den Rueckflug beginnen.`;
}

function _poiManualNotFoundFallback(ctx) {
    const subject = _poiManualReportSubject();
    const distNm = Number(ctx?.confirmDistNm);
    if (Number.isFinite(distNm)) {
        return `Negativ, ich kann ${subject} von hier noch nicht belastbar bestaetigen. Wir sind noch etwa ${distNm.toFixed(1)} NM zu weit weg vom Suchkern, lass uns weiter suchen.`;
    }
    return `Negativ, ich kann ${subject} noch nicht bestaetigen. Lass uns das Suchmuster weiterfliegen, bis wir naeher am Zielkern sind.`;
}

function _poiKnowledgeCleanFactText(value = '') {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '')
        .trim();
}

function _poiKnowledgeContextIdentity(context = null) {
    if (!context || typeof context !== 'object') return '';
    const title = String(context.title || context.name || '').replace(/\s+/g, ' ').trim();
    const source = String(context.pageid || context.wikidataId || context.url || context.sourceUrl || context.source || '').trim();
    const facts = Array.isArray(context.facts)
        ? context.facts.slice(0, 3).map(fact => _poiKnowledgeCleanFactText(fact?.text || fact || '').slice(0, 80)).join('|')
        : '';
    return `${title}|${source}|${facts}`;
}

function _poiKnowledgeSyncContext(context = null) {
    const activeContext = context || _activePoiKnowledgeContext();
    const key = _poiKnowledgeContextIdentity(activeContext);
    if (!key || key === _poiKnowledgeContextKey) return;
    _poiKnowledgeContextKey = key;
    _poiKnowledgeManualFactIndices = new Set();
    _poiKnowledgeSpokenMemory = '';
}

function _poiKnowledgeFactCandidates(options = {}) {
    const context = _activePoiKnowledgeContext();
    if (!context) return [];
    _poiKnowledgeSyncContext(context);
    const includeExtraFacts = options?.includeExtraFacts === true;
    const facts = Array.isArray(context.facts) ? context.facts : [];
    const extraFacts = includeExtraFacts && Array.isArray(context.extraFacts) ? context.extraFacts : [];
    const seen = new Set();
    return [...facts, ...extraFacts]
        .map((fact, index) => ({
            index,
            key: `${index < facts.length ? 'core' : 'extra'}:${index < facts.length ? index : index - facts.length}`,
            topic: String(fact?.topic || 'general').toLowerCase(),
            text: _poiKnowledgeCleanFactText(fact?.text || fact || '')
        }))
        .filter(fact => fact.text.length >= 36)
        .filter(fact => !/(wikipedia|quelle|http|einzelnachweise|weblinks|normdaten)/i.test(fact.text))
        .filter(fact => {
            const key = fact.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function _poiKnowledgeFactKey(fact = {}) {
    return String(fact?.key || fact?.index || fact?.text || '').trim();
}

function _poiKnowledgeStageScore(fact = {}, stage = 'generic') {
    const s = String(stage || 'generic').toLowerCase();
    const topic = String(fact.topic || 'general').toLowerCase();
    const preferred = {
        greeting: ['location', 'history', 'use'],
        boarding: ['location', 'history', 'use'],
        in_sight: ['location', 'structure', 'metrics', 'nature'],
        entry: ['history', 'use', 'structure', 'metrics'],
        result: ['use', 'history', 'nature', 'metrics'],
        generic: ['history', 'location', 'use', 'structure', 'metrics', 'nature']
    }[s] || ['history', 'location', 'use', 'structure', 'metrics', 'nature'];
    const topicScore = preferred.includes(topic) ? (preferred.length - preferred.indexOf(topic)) * 10 : 0;
    const stageOffset = _poiKnowledgeStageMinIndex(s);
    const index = Number.isFinite(Number(fact.index)) ? Number(fact.index) : 0;
    const progressionScore = index >= stageOffset ? 12 : -30;
    return topicScore + progressionScore - index;
}

function _poiKnowledgeStageMinIndex(stage = 'generic') {
    return {
        greeting: 0,
        boarding: 0,
        in_sight: 1,
        entry: 1,
        result: 4,
        generic: 0
    }[String(stage || 'generic').toLowerCase()] || 0;
}

function _poiKnowledgeFactHint(stage = 'generic') {
    const task = _activeTaskDomain();
    const isLearningGuide = task === 'poi_learning_guide';
    const isSightseeing = task === 'sightseeing_tour';
    if (!isLearningGuide && !isSightseeing) return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const fresh = pool.find(fact => !_poiMemoryHasSimilarFact(fact.text)) || pool[0];
    if (!fresh) return '';
    const cleanText = String(fresh.text || '').replace(/[.!?]+$/, '').trim();
    const clip = cleanText.length > 220 ? `${cleanText.slice(0, 217)}...` : cleanText;
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = {
        greeting: 'Vorschau',
        boarding: 'Vorschau',
        in_sight: 'Anflug',
        entry: 'Zielgebiet',
        result: 'Fazit',
        generic: 'Kontext'
    }[stageKey] || 'Kontext';
    if (isSightseeing) {
        return ` POI-KONTEXT (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Wenn es natuerlich passt, erwaehne hoechstens einen kurzen Kontextpunkt als persoenliche Beobachtung, nicht als Fuehrung: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke und erfinde keine Zusatzdaten.`;
    }
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Nutze genau diesen Fakt, falls er natuerlich passt, und erfinde keine Zusatzdaten: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}

function _poiKnowledgeRichFactCount(stage = 'generic') {
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    const total = Math.max(
        candidates.length,
        Number.isFinite(Number(context?.selectedFacts)) ? Math.round(Number(context.selectedFacts)) : 0
    );
    const s = String(stage || 'generic').toLowerCase();
    if (s === 'entry') {
        if (total >= 8) return 3;
        if (total >= 5) return 2;
        return 1;
    }
    if (s === 'result') {
        if (total >= 7) return 2;
        return 1;
    }
    return 1;
}

function _poiKnowledgeFactSequenceHint(stage = 'generic') {
    if (_activeTaskDomain() !== 'poi_learning_guide') return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const maxFacts = Math.max(1, Math.min(3, _poiKnowledgeRichFactCount(stageKey)));
    if (maxFacts <= 1) return _poiKnowledgeFactHint(stageKey);
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const selected = [];
    const seenTopics = new Set();
    for (const fact of pool) {
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        const topic = String(fact.topic || 'general').toLowerCase();
        if (seenTopics.has(topic) && selected.length < Math.min(2, maxFacts)) continue;
        selected.push(fact);
        seenTopics.add(topic);
        if (selected.length >= maxFacts) break;
    }
    for (const fact of pool) {
        if (selected.length >= maxFacts) break;
        if (selected.some(x => x.text === fact.text)) continue;
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        selected.push(fact);
    }
    if (!selected.length) return _poiKnowledgeFactHint(stageKey);
    if (selected.length === 1) return _poiKnowledgeFactHint(stageKey);
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = stageKey === 'result' ? 'Fazit' : 'Zielgebiet';
    const facts = selected.map((fact, index) => {
        const cleanText = String(fact.text || '').replace(/[.!?]+$/, '').trim();
        const clip = cleanText.length > 180 ? `${cleanText.slice(0, 177)}...` : cleanText;
        return `${index + 1}. ${clip}`;
    }).join(' ');
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Es gibt hier genug Stoff; nutze ${selected.length} kurze, unterschiedliche Fakten als kleinen Erzaehlbogen und erfinde keine Zusatzdaten: ${facts}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}

function _poiKnowledgeManualFactCandidates() {
    return _poiKnowledgeFactCandidates({ includeExtraFacts: true });
}

function _poiKnowledgeTellMoreAvailable() {
    if (_activeTaskDomain() !== 'poi_learning_guide') return false;
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) return false;
    if (!window.activePassenger || !_missionHasPax()) return false;
    return _poiKnowledgeManualFactCandidates().length > 0;
}

function _poiKnowledgeFreshFactCount() {
    const candidates = _poiKnowledgeManualFactCandidates();
    return candidates.filter(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    )).length;
}

function _poiKnowledgeManualFactClip(text = '') {
    const clean = _poiKnowledgeCleanFactText(text).replace(/[.!?]+$/, '').trim();
    if (clean.length <= 340) return clean;
    const clipped = clean.slice(0, 337).replace(/\s+\S*$/, '').trim();
    return clipped || clean.slice(0, 337).trim();
}

function _poiKnowledgeNextManualFact() {
    const context = _activePoiKnowledgeContext();
    if (!context) return null;
    _poiKnowledgeSyncContext(context);
    const candidates = _poiKnowledgeManualFactCandidates();
    const fresh = candidates.find(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    ));
    if (!fresh) return null;
    _poiKnowledgeManualFactIndices.add(_poiKnowledgeFactKey(fresh));
    return fresh;
}

function _poiKnowledgeTargetName(context = null) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    return String(context?.title || md.poiName || md.targetName || 'dem Ziel')
        .replace(/\s+/g, ' ')
        .trim();
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

function _trainingProcedureDebriefLine() {
    const snap = (typeof window.missionTrainingProcedure?.snapshot === 'function')
        ? window.missionTrainingProcedure.snapshot()
        : null;
    if (!snap || !Array.isArray(snap.exercises) || !snap.exercises.length) return '';
    const completed = snap.exercises.filter(ex => ex && ex.status === 'complete');
    if (!completed.length) {
        const active = snap.activeExercise?.label ? ` Aktive Uebung: ${snap.activeExercise.label}.` : '';
        return `\nTrainingsprozedur: noch kein sauber abgeschlossener Durchlauf.${active}`;
    }
    const bits = completed.slice(0, 6).map(ex => {
        const s = ex.summary || {};
        const label = String(ex.label || ex.id || 'Uebung').trim();
        if (ex.type === 'stall_recovery') {
            return `${label}: Hoehenverlust ab Break ${Math.round(Number(s.heightLossFt || 0))} ft`;
        }
        if (ex.type === 'constant_bank_360' || ex.type === 'turn_180') {
            const alt = Number.isFinite(Number(s.maxAltitudeDeviationFt)) ? `${Math.round(Number(s.maxAltitudeDeviationFt))} ft Hoehenabweichung` : 'Hoehe n/a';
            const hdg = Number.isFinite(Number(s.rolloutHeadingErrorDeg)) ? `Rollout ${Number(s.rolloutHeadingErrorDeg).toFixed(1)} Grad` : '';
            return `${label}: ${[alt, hdg].filter(Boolean).join(', ')}`;
        }
        if (ex.type === 'altitude_step_hold') {
            const alt = Number.isFinite(Number(s.maxAltitudeDeviationFt)) ? `${Math.round(Number(s.maxAltitudeDeviationFt))} ft Hoehenabweichung` : 'Hoehe n/a';
            const hdg = Number.isFinite(Number(s.maxHeadingDeviationDeg)) ? `Kurs max ${Number(s.maxHeadingDeviationDeg).toFixed(1)} Grad` : '';
            return `${label}: ${[alt, hdg].filter(Boolean).join(', ')}`;
        }
        return `${label}: sauber`;
    });
    return `\nTrainingsprozedur: ${completed.length}/${snap.exercises.length} Uebungen sauber abgeschlossen. ${bits.join(' | ')}.`;
}

function _farewellPrompt(record) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const rec = (record && typeof record === 'object') ? record : {};
    const motionProtectionEnabled = _paxDebugMotionProtectionEnabled();
    const durationSec = Number.isFinite(Number(rec.durationSec)) ? Number(rec.durationSec) : null;
    const min = durationSec != null ? Math.max(1, Math.round(durationSec / 60)) : null;
    const distanceNm = Number.isFinite(Number(rec.distanceNm)) ? Number(rec.distanceNm) : null;
    const maxAltFt = Number.isFinite(Number(rec.maxAltFt)) ? Math.round(Number(rec.maxAltFt)) : null;
    const isSimRecord = !!rec.simulated || durationSec == null;
    const td = (!motionProtectionEnabled && !isSimRecord && rec.touchdownVsFpm != null) ? `${Math.abs(rec.touchdownVsFpm)} ft/min` : null;
    const bank = (Number(rec.maxBankDeg) || 0).toFixed(1);
    const maxG = (Number(rec.maxGForce) || 1.0).toFixed(2);
    const wx   = _weatherContext(window.lastLiveFlightData);

    let highlights = '';
    if (!motionProtectionEnabled && pax.gTolerance === 'niedrig' && (Number(rec.maxGForce) || 1) > 1.6) highlights += ' Etwas viel G für mich, aber okay.';
    if (!motionProtectionEnabled && pax.bankTolerance === 'niedrig' && (Number(rec.maxBankDeg) || 0) > 34) highlights += ' Die Kurven waren schon sportlich.';
    if (!motionProtectionEnabled && !isSimRecord && Number.isFinite(Number(rec.maxDescentFpm)) && Number(rec.maxDescentFpm) <= -1500) {
        highlights += ` Der Sinkflug mit ${Math.abs(Math.round(Number(rec.maxDescentFpm)))} ft/min ging etwas auf Ohren und Magen.`;
    }
    if (td && Math.abs(Number(rec.touchdownVsFpm)) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
    if (td && Math.abs(Number(rec.touchdownVsFpm)) > 500) highlights += ` Die Landung mit ${Math.abs(Number(rec.touchdownVsFpm))} ft/min war etwas holprig.`;
    const cargoOutcome = rec?.missionCargoOutcome
        || ((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData.cargoOutcome : null)
        || window.activeMissionContract?.cargoOutcome
        || (typeof window.missionCargoEvaluateOutcome === 'function' ? window.missionCargoEvaluateOutcome() : null);
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const failureReasons = [
        ...missingRequired,
        ...droppedRequired,
        ...notDeliveredRequired,
        ...damagedRequired
    ].filter(Boolean);
    const hasResolvedOutcome = !!(cargoOutcome && typeof cargoOutcome === 'object' && String(cargoOutcome.status || '').toLowerCase() !== 'none');
    const currentMissionFailed = ((typeof currentMissionData !== 'undefined' && currentMissionData)
        ? (currentMissionData.missionFailed || String(currentMissionData.missionResult || '').toLowerCase() === 'failed')
        : false);
    const poiSuccessOverride = !!(poiProgress?.satisfied || poiProgress?.manualConfirmed);
    const isMissionFailed = poiSuccessOverride
        ? false
        : hasResolvedOutcome
        ? !!(cargoOutcome?.failed || rec?.missionFailed || rec?.poiAborted)
        : !!(_poiAborted || rec?.missionFailed || currentMissionFailed);
    if (cargoOutcome?.failed) {
        const missing = failureReasons.slice(0, 3).join(', ');
        if (damagedRequired.length) {
            highlights += ` Wichtige Ausruestung wurde beschaedigt${missing ? `: ${missing}` : ''}.`;
        } else {
            highlights += ` Die Ladung ist nicht vollstaendig erledigt${missing ? `: ${missing}` : ''}.`;
        }
    }
    if (isSimRecord) highlights += ' Hinweis: Sim-Modus aktiv, Landebewertung nur eingeschränkt belastbar.';
    if (wx) highlights += ` ${wx}`;
    highlights += _consumeWeatherMismatchEasteregg(window.lastLiveFlightData || null);
    const profLandingHint = _professionalLandingToneHint();
    const trainingPlan = _activeAptTrainingPlan();
    const trn = trainingPlan ? _trainingEvalSummary() : null;
    const trnProcedureFacts = trainingPlan ? _trainingProcedureDebriefLine() : '';
    const trnFacts = trn
        ? `\nTrainingsdaten (Übungsabschnitt): Höhenvariation ${trn.altVar ?? 'n/a'} ft, max Bank ${trn.bank}°, max G ${trn.maxG}g, max Steigen ${trn.climb} ft/min, max Sinken ${Math.abs(trn.descent)} ft/min${trn.aoaMax != null ? `, max AOA ${trn.aoaMax}°` : ''}, Stall-Events ${trn.stallEvents}.${trnProcedureFacts}`
        : trnProcedureFacts;
    const trnTask = trn
        ? '\nDa du hier als Instruktor unterwegs bist: Gib ein kurzes, konkretes Trainingsfazit (was war gut, was sollte beim nächsten Flug sauberer werden).'
        : '';
    const isPOI = _isPOIMission();
    const poiNeedsRideHome = !!rec?.poiNeedsRideHome;
    const primaryFailureReason = damagedRequired.length
        ? `beschaedigte Ausruestung (${damagedRequired.slice(0, 2).join(', ')})`
        : missingRequired.length
            ? `fehlende Ausruestung (${missingRequired.slice(0, 2).join(', ')})`
            : droppedRequired.length
                ? `verlorene Ausruestung (${droppedRequired.slice(0, 2).join(', ')})`
                : notDeliveredRequired.length
                    ? notDeliveredRequired[0]
                    : 'der Auftrag konnte nicht sauber abgeschlossen werden';
    const missionFailureTask = isMissionFailed
        ? `\nDer Auftrag ist heute nicht abgeschlossen. Sag klar, dass die Aufgabe am Ziel nicht erledigt werden konnte. Hauptgrund: ${primaryFailureReason}. Formuliere am Ende eine kurze Retry-Frage (z.B. ob wir es mit kompletter Ausruestung nochmal versuchen sollen). HARTE VERBOTE: Sage NICHT "voller Erfolg", "erfolgreich", "abgeschlossen", "erledigt", "alles im Kasten", "sauber erledigt" oder aehnliche Erfolgsformeln.`
        : '';
    const poiRideHomeTask = (isPOI && poiNeedsRideHome)
        ? '\nWir sind nicht am Startflugplatz gelandet. Frag am Ende locker, ob wir dich von hier noch nach Hause fliegen.'
        : '';
    const aptFarewellHint = (!isPOI && !trainingPlan) ? _aptArrivalFarewellHint() : '';
    const bushContinuityHint = _bushPickupNarrativeHint('farewell');
    const bushReconOutcomeHint = isMissionFailed ? '' : _bushReconOutcomeHintLine('farewell');
    const followUpDeboardingHint = isMissionFailed ? '' : _followUpDeboardingHintLine();
    const taskDomain = _activeTaskDomain();
    const farewellDriftGuard = _domainDriftGuard('result');
    const sarHeliFarewellTask = (typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)))
        ? `Verabschiede dich als ${pax.role} nach einer SAR-Heli-Bergung. Sage klar, dass der Patient am medizinischen Ziel ${_sarHeliHospitalName()} uebergeben ist, danke fuer die ruhige Bergung und den Weiterflug, und schliesse professionell ab.`
        : '';
    const scienceFarewellTask = taskDomain === 'science_bio'
        ? `Verabschiede dich kurz beim Piloten und gib ein biologisches Abschlussfazit: welcher Habitat-, Arten-, Vegetations-, Ufer- oder Stoerfaktor fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
        : (taskDomain === 'science_geo'
            ? `Verabschiede dich kurz beim Piloten und gib ein geologisches Abschlussfazit: welche Relief-, Erosions-, Sediment-, Ufer- oder Hangbeobachtung fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
            : '');
    const farewellTask = isMissionFailed
        ? `Verabschiede dich persönlich beim Piloten aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Bleib freundlich, aber nenne den Fehlschlag klar und ohne ihn schönzureden.${missionFailureTask}`
        : (sarHeliFarewellTask || scienceFarewellTask || `Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Auch wenn etwas nicht perfekt war, schließ positiv ab.${trnTask}`);
    const facts = motionProtectionEnabled
        ? 'Bewegungs-, Komfort- und Landebewertung deaktiviert (Debug-Slew-Schutz).'
        : (min != null && distanceNm != null && maxAltFt != null)
            ? `${min} min, ${distanceNm.toFixed(1)} NM, max ${maxAltFt} ft, max Bank ${bank}°, max G ${maxG}g.`
            : `Flugdaten teilweise unvollständig (z. B. Slew/Teleport). Max Bank ${bank}°, max G ${maxG}g.`;

    return `${ctx}

Moment: ${aptFarewellHint || 'Wir sind gelandet, Flug beendet.'}
ABLAUF: Die Flugzeugtür ist geöffnet; du sitzt noch an Bord und verabschiedest dich unmittelbar vor dem Aussteigen. Behaupte nicht, bereits ausgestiegen, am Fahrzeug oder abgeholt zu sein.
Fakten: ${facts}${highlights ? '\n' + highlights : ''}${trnFacts}
${farewellTask}${poiRideHomeTask}${bushContinuityHint}${bushReconOutcomeHint}${followUpDeboardingHint}${profLandingHint}${farewellDriftGuard} Max 3 Sätze.${_toneHint()}`;
}

function _failedMissionFarewellFallback(record = null) {
    const pax = window.activePassenger || {};
    const rec = (record && typeof record === 'object') ? record : {};
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    if (poiProgress?.satisfied || poiProgress?.manualConfirmed) {
        const role = String(pax.role || 'Passagier').trim();
        const frame = _activeMissionStoryFrame();
        const subject = String(frame?.focusSubject || 'den Auftrag').trim();
        return `Danke fuers Mitnehmen. Aus Sicht als ${role} haben wir ${subject} heute sauber bestaetigt und ich gebe den Fund so an die Einsatzleitung weiter. Der Rueckflug passt, damit koennen die Bodenkraefte ihren naechsten Schritt gezielt ansetzen.`;
    }
    const cargoOutcome = rec?.missionCargoOutcome || null;
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const primaryFailureReason = damagedRequired.length
        ? `Leider ist ein Teil der Ladung beschaedigt: ${damagedRequired.slice(0, 2).join(', ')}`
        : missingRequired.length
            ? `Leider hat fuer den Auftrag etwas gefehlt: ${missingRequired.slice(0, 2).join(', ')}`
            : droppedRequired.length
                ? `Leider ist unterwegs etwas verloren gegangen: ${droppedRequired.slice(0, 2).join(', ')}`
                : notDeliveredRequired.length
                    ? `Die Uebergabe dieser Ladung ist noch offen: ${notDeliveredRequired.slice(0, 2).join(', ')}`
                    : 'Leider konnten wir den Auftrag am Ziel noch nicht abschliessen';
    return `Danke fuers Mitnehmen. ${primaryFailureReason}.`;
}

function _farewellPreparedContext(record = null) {
    let rec = (record && typeof record === 'object') ? { ...record } : {};
    if (!rec.missionCargoOutcome && typeof _missionCargoEvaluateFarewellOutcome === 'function') {
        try {
            const outcome = _missionCargoEvaluateFarewellOutcome();
            if (outcome && typeof outcome === 'object' && outcome.status !== 'none') {
                rec.missionCargoOutcome = outcome;
                rec.missionFailed = !!outcome.failed;
            }
        } catch (_) {}
    }
    const cargoOutcome = rec?.missionCargoOutcome || null;
    const forceFailureFallback = !!(
        rec?.missionFailed
        || rec?.poiAborted
        || cargoOutcome?.failed
    );
    if (!window.activePassenger || !_missionHasPax()) {
        const prompt = _cargoOnlyFarewellPrompt(rec);
        if (!prompt) return null;
        return {
            key: _paxMissionAudioKey('farewell-cargo'),
            prompt,
            speaker: _cargoMissionSpeaker('farewell'),
            eventLabel: 'Verabschiedung',
            logLabel: 'CargoFarewell'
        };
    }
    const speaker = _speakerSnapshotForActivePax();
    if (forceFailureFallback) {
        return {
            key: _paxMissionAudioKey('farewell-failed'),
            text: _failedMissionFarewellFallback(rec),
            speaker,
            eventLabel: 'Verabschiedung',
            logLabel: 'Farewell'
        };
    }
    const prompt = _farewellPrompt(rec);
    if (!prompt) return null;
    return {
        key: _paxMissionAudioKey('farewell'),
        prompt,
        speaker,
        eventLabel: 'Verabschiedung',
        logLabel: 'Farewell'
    };
}

function _missionActionContext(flightData = null) {
    const md = _activeMissionData();
    const dest = _getDestCoords();
    const pos = window.lastLiveGpsPos || {};
    const fd = flightData || window.lastLiveFlightData || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const targetName = md.poiName || md.targetName || md.dest || 'Ziel';
    const out = {
        md,
        fd,
        targetName,
        dest,
        hasPosition: false,
        mslFt: Number.isFinite(Number(fd.mslFt ?? pos.alt ?? fd.alt)) ? Math.round(Number(fd.mslFt ?? pos.alt ?? fd.alt)) : null,
        aglFt: Number.isFinite(Number(fd.aglFt)) ? Math.round(Number(fd.aglFt)) : null
    };
    if (!dest || !Number.isFinite(lat) || !Number.isFinite(lon)) return out;
    const distNm = _haversineNm(lat, lon, dest.lat, dest.lon);
    const bearingDeg = _bearingDeg(lat, lon, dest.lat, dest.lon);
    const hdg = Number(fd.hdg || fd.heading || fd.trackDeg || fd.trkDeg || pos.hdg || bearingDeg);
    return {
        ...out,
        hasPosition: true,
        lat,
        lon,
        distNm,
        roundedDistNm: Math.max(0, Math.round(distNm)),
        bearingDeg,
        roundedBearingDeg: Math.round((((bearingDeg % 360) + 360) % 360)),
        clockPos: _relativeClockPos(bearingDeg, hdg),
        hdg
    };
}

function _missionVectorText(ctx) {
    if (!ctx?.hasPosition) return 'Mir fehlen gerade Live-Positionsdaten vom Tracker.';
    const nm = ctx.roundedDistNm <= 0 ? 'unter 1 NM' : `${ctx.roundedDistNm} NM`;
    return `Steuerkurs ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Entfernung ${nm}.`;
}

function _missionOrientationFactLine(ctx = null) {
    const mapPlace = _paxMapPlaceOrientationLine();
    if (mapPlace && (!ctx?.hasPosition || Number(ctx.distNm) > 6)) {
        const near = _paxNearLandmarkOrientationLine();
        return [mapPlace, near].filter(Boolean).join('\n');
    }
    const near = _paxNearLandmarkOrientationLine();
    if (near) return near;
    if (mapPlace) return mapPlace;
    return '';
}

function _missionStatusFacts(ctx) {
    const pax = window.activePassenger || {};
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        const progress = typeof window.missionSarHeliProgressSnapshot === 'function' ? window.missionSarHeliProgressSnapshot() : null;
        const parts = [];
        if (ctx?.hasPosition) parts.push(`Distanz zur Fundstelle ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
        if (progress?.patientLoaded) parts.push(`Status: Patient aufgenommen, Ziel ${_sarHeliHospitalName()}`);
        else if (progress?.targetConfirmed) parts.push(`Status: Fund bestätigt, Bergung läuft, Position ruhig halten`);
        else parts.push('Status: Such-/Fundphase, Fundmeldung oder Auto-Markierung offen');
        const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
        if (wx) parts.push(wx);
        return parts.join(' | ');
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        const survey = _surveyPatternProgressSummary(ctx);
        if (survey) return survey;
    }
    const chainSummary = _poiChainProgressSummary(ctx);
    if (chainSummary) return chainSummary;
    const radius = Number(pax.targetRadiusNm || 1.5) || 1.5;
    const targetAlt = Number(pax.targetAltFt || 0);
    const dwellReq = Number(pax.targetDwellMin || 0) * 60;
    const dwell = Math.max(0, Math.round(_poiDwellSec || 0));
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Lage ${ctx.clockPos}`);
    if (_poiSatisfied) parts.push('Status: POI-Aufgabe abgeschlossen, Rueckflug/Weiterflug freigegeben');
    else if (_poiAborted) parts.push('Status: abgebrochen, Rueckflug sinnvoll');
    else if (_poiInRadius) parts.push(`Status: im Zielradius (${radius.toFixed(1)} NM), Datenaufnahme laeuft`);
    else parts.push('Status: noch im Anflug zum Zielgebiet');
    if (dwellReq > 0) parts.push(`Verweilzeit ${dwell}/${Math.round(dwellReq)} Sekunden`);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = ctx.mslFt - targetAlt;
        if (Math.abs(diff) <= 150) parts.push(`Hoehe passt: ${ctx.mslFt} ft MSL bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
    if (wx) parts.push(wx);
    return parts.join(' | ');
}

function _paxNearLandmarkOrientationLine() {
    const landmark = _paxApproachLandmarkCueLine();
    if (landmark) return landmark;
    const fact = _targetContextFactCandidates().find(Boolean);
    return fact ? `NAHBEREICH-ZUSATZ: ${fact}` : '';
}

function _poiMissionStatusAction() {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Das ist keine POI-Mission. Fuer diesen Flug ist eher Wohlbefinden, Ladung oder Wetter relevant.', 'Missionsstatus');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternStatusText(ctx), 'Missionsstatus');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainStatusText(ctx), 'Missionsstatus');
        return;
    }
    const facts = _missionStatusFacts(ctx);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach dem aktuellen Missionsstatus.
Live-Fakten: ${facts}
Antworte als Passagier/Rollenperson dynamisch zum Kontext: Anflug, Datenaufnahme, Hoehenkorrektur, Abschluss oder Rueckflug. Wenn die Hoehe deutlich nicht passt, darfst du freundlich hoeher/tiefer bitten. Keine internen Variablennamen. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = _poiSatisfied
        ? 'Mission ist abgeschlossen, ich habe alles. Wir koennen zurueck beziehungsweise weiter zum Platz.'
        : `${_missionVectorText(ctx)} ${_poiInRadius ? 'Datenaufnahme laeuft, halte den Flug ruhig und stabil.' : 'Wir sind noch im Anflug, ich melde mich am Ziel.'}`;
    _missionActionSpeak(prompt, 'Missionsstatus', fallback);
}

function _poiMissionOrientationAction(_cityRetry = false) {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Orientierungshilfe ist aktuell nur fuer POI-Ziele sinnvoll.', 'Orientierung');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternOrientationText(ctx), 'Orientierung');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainOrientationText(ctx), 'Orientierung');
        return;
    }
    if (!_cityRetry && !_paxCityDatasetAvailable() && typeof loadGlobalCities === 'function') {
        loadGlobalCities().finally(() => window.paxMissionOrientationHelp(true));
        return;
    }
    const base = _baseContext();
    const vector = _missionVectorText(ctx);
    const factLine = _missionOrientationFactLine(ctx);
    const prompt = base ? `${base}

Button-Frage: Der Pilot bittet um Orientierungshilfe zum POI.
Pflichtdaten: ${vector}
Ziel: ${ctx.targetName}
${factLine || 'Keine bestaetigte Landmarke verfuegbar; beschreibe das Ziel anhand Auftrag, Zielname und Umgebung nur vorsichtig.'}
Orientierungsregel: Wenn die Entfernung groesser als 6 NM ist, nenne nach Steuerkurs/Entfernung zuerst den groben Kartenbezug zu Ort/Region. Danach darf genau ein lokaler Nahbereichs-Hinweis kommen, wenn er bestaetigt ist. Lokale Felsen, Bachnamen, Wege oder Aussichtspunkte nicht als primaere Orientierung verwenden, ausser wir sind im Nahbereich oder sie sind das Ziel selbst.
Antworte zuerst mit Steuerkurs und Entfernung in ganzen NM, danach eine kurze Zielbeschreibung oder Landmarkenhilfe. Keine langen Stories, keine erfundenen Landmarken. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = factLine && /^GROBER KARTENBEZUG:/i.test(factLine)
        ? `${vector} ${factLine.split('\n')[0].replace(/^GROBER KARTENBEZUG:\s*/i, '').replace(/\s*Nutze diesen Ort.*$/i, '')}`
        : `${vector} Ziel ist ${ctx.targetName}; nutze die naechste markante Struktur im Zielgebiet als Bezug und halte weiter Ausschau.`;
    _missionActionSpeak(prompt, 'Orientierung', fallback);
}

function _surveyPatternActiveSpec() {
    if (typeof window.missionSurveyPattern?.getActiveSpec !== 'function') return null;
    try {
        return window.missionSurveyPattern.getActiveSpec(
            (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
            window.activePassenger || null
        );
    } catch (_) {
        return null;
    }
}

function _surveyPatternSnapshot() {
    const tracker = window.gaTrackerExecutionControl;
    if (tracker?.executionAuthority === 'tracker' && tracker.surveySpec) return tracker.poiTask?.surveyPattern || null;
    if (typeof window.missionSurveyPattern?.snapshot !== 'function') return null;
    try {
        return window.missionSurveyPattern.snapshot();
    } catch (_) {
        return null;
    }
}

function _surveyPatternProgressSummary(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    if (!spec) return '';
    const snap = _surveyPatternSnapshot();
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
    if (spec.type === 'orbit') {
        const done = Math.max(0, Number(snap?.orbit?.completedTurns || 0));
        const total = Math.max(1, Number(spec.orbit?.requiredTurns || 3));
        const activeCoverage = Math.round(Number(snap?.orbit?.activeCoverage || 0) * 100);
        parts.push(`Survey-Orbit ${done}/${total} Kreise abgeschlossen${snap?.orbit?.active ? `, aktueller Kreis ${activeCoverage}%` : ''}`);
    } else {
        const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
        const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
        const activeLine = String(snap?.scan?.active?.lineId || '');
        const coverage = Math.round(Number(snap?.scan?.activeCoverage || 0) * 100);
        parts.push(`Survey-Scan ${done}/${total} Linien gruen${activeLine ? `, ${activeLine} aktiv bei ${coverage}%` : ''}`);
    }
    if (snap?.satisfied) parts.push('Status: Survey abgeschlossen, Rueckflug freigegeben');
    else if (snap?.startedAt) parts.push('Status: Datenaufnahme laeuft');
    else parts.push('Status: Pattern sichtbar, Einstieg an einem Linienende oder auf dem Orbit');
    const targetAlt = Number(spec.targetAltFt || window.activePassenger?.targetAltFt || 0);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = Number(ctx.mslFt) - targetAlt;
        if (Math.abs(diff) <= Number(spec.altitudeToleranceFt || 300)) parts.push(`Hoehe im Band: ${ctx.mslFt} ft bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    return parts.join(' | ');
}

function _surveyPatternStatusText(ctx = null) {
    const summary = _surveyPatternProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade kein aktives Survey-Pattern geladen. Bitte pruefe, ob die Mapping-Mission noch aktiv ist.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _surveyPatternOrientationText(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    const vector = _missionVectorText(ctx);
    if (!spec) return `${vector} Ich habe gerade kein aktives Survey-Pattern geladen.`;
    if (spec.type === 'orbit') {
        const radius = Number(spec.orbit?.radiusNm || 0.55).toFixed(2);
        return `${vector} Das Pattern ist der markierte Orbit um das Ziel. Richte dich auf etwa ${radius} NM Radius ein, halte die geplante Hoehe und fliege die vollen Kreise ruhig durch.`;
    }
    const snap = _surveyPatternSnapshot();
    const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
    const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
    return `${vector} Das rote Scanmuster liegt schon auf der Karte. Such dir ein offenes Linienende, flieg die Nord-Sued-Bahn gerade ab und nimm danach die naechste offene Linie; erledigt sind ${done} von ${total}.`;
}

function _surveyPatternStaticClipKey(kind = 'event', spec = null) {
    const type = String(spec?.type || '').toLowerCase() === 'orbit' ? 'orbit' : 'scan';
    if (kind === 'survey_area_entered' || kind === 'survey_complete') return `${type}_${kind}`;
    return String(kind || '').trim();
}

function _surveyPatternVoiceText(kind = 'line_complete', spec = null) {
    const type = String(spec?.type || '').toLowerCase();
    switch (kind) {
        case 'line_complete':
            return 'Gut, diese Bahn ist sauber. Nimm dir jetzt die nächste Linie, die Reihenfolge ist egal.';
        case 'line_reset_altitude':
            return 'Die Höhe passt nicht mehr, die aktuelle Bahn zählt nicht. Wir setzen die Linie noch einmal sauber an.';
        case 'line_reset_offtrack':
            return 'Wir sind zu weit aus der Bahn gedriftet. Diese Linie bitte noch einmal ruhig und gerade aufnehmen.';
        case 'orbit_turn_complete':
            return 'Sauber, dieser Kreis zählt. Bleib im gleichen Radius und nimm den nächsten Umlauf mit.';
        case 'orbit_reset_altitude':
            return 'Die Höhe ist aus dem Band gelaufen, der aktuelle Kreis zählt nicht. Bitte wieder stabilisieren und neu ansetzen.';
        case 'orbit_reset_offtrack':
            return 'Der Radius läuft weg, der aktuelle Kreis zählt nicht. Bitte zurück auf den Ring und neu ansetzen.';
        case 'survey_complete':
            return type === 'orbit'
                ? 'Das waren alle Kreise, der Survey ist komplett. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.'
                : 'Alle Survey-Linien sind sauber abgedeckt. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.';
        case 'survey_area_entered':
            return type === 'orbit'
                ? 'Wir sind im Surveybereich. Nimm jetzt den markierten Orbit auf und halte Hoehe und Radius stabil.'
                : 'Wir sind im Surveybereich. Such dir ein Linienende und flieg die erste Bahn sauber durch.';
        default:
            return '';
    }
}

function _surveyPatternEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'survey_complete') return 'survey_complete';
    if (type === 'line_complete') return 'line_complete';
    if (type === 'line_reset_altitude') return 'line_reset_altitude';
    if (type === 'line_reset_offtrack') return 'line_reset_offtrack';
    if (type === 'orbit_turn_complete') return 'orbit_turn_complete';
    if (type === 'orbit_reset_altitude') return 'orbit_reset_altitude';
    if (type === 'orbit_reset_offtrack') return 'orbit_reset_offtrack';
    if (type === 'survey_area_entered') return 'survey_area_entered';
    return '';
}

function _hashStable(text) {
    const s = String(text || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}

function _paxSeededInt(seed, min, max) {
    const lo = Math.round(Number(min) || 0);
    const hi = Math.round(Number(max) || lo);
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    if (a === b) return a;
    return a + (_hashStable(seed) % (b - a + 1));
}

function _poiChainActiveSpec() {
    if (typeof window.missionPoiChainRuntime?.getActiveSpec !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.getActiveSpec(
            (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
            window.activePassenger || null
        );
    } catch (_) {
        return null;
    }
}

function _poiChainSnapshot() {
    const tracker = window.gaTrackerExecutionControl;
    if (tracker?.executionAuthority === 'tracker' && tracker.chainSpec) return tracker.poiTask?.poiChain || null;
    if (typeof window.missionPoiChainRuntime?.snapshot !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.snapshot();
    } catch (_) {
        return null;
    }
}

function _poiChainProgressSummary(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return '';
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const total = points.filter(point => point?.required !== false).length || points.length || 1;
    const done = Array.isArray(snap?.completedPointIds) ? snap.completedPointIds.length : 0;
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    const corridor = spec.corridor || null;
    const corridorSnap = snap?.corridor || null;
    const corridorTotal = Math.max(0, Number(corridorSnap?.totalSegments || corridor?.segments?.length || 0));
    const corridorDone = Math.max(0, Number(corridorSnap?.completedCount || 0));
    const activeCoverage = Math.round(Number(corridorSnap?.activeCoverage || 0) * 100);
    const parts = [];
    parts.push(`Kettenauftrag ${done}/${total} Punkte erledigt`);
    if (corridorTotal > 0) {
        parts.push(`Korridor ${corridorDone}/${corridorTotal} Segmente sauber${corridorSnap?.activeSegmentId ? `, aktueller Abschnitt ${activeCoverage}%` : ''}`);
    }
    if (snap?.satisfied) {
        parts.push('Status: Kette abgeschlossen, Rueckflug freigegeben');
    } else if (nextPoint) {
        parts.push(`Nächster Punkt: ${nextPoint.name}`);
        if (ctx?.hasPosition) {
            const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            parts.push(`Entfernung ${dist.toFixed(1)} NM, Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad`);
        }
    } else {
        parts.push('Status: naechster Kettenpunkt wird vorbereitet');
    }
    return parts.join(' | ');
}

function _poiChainStatusText(ctx = null) {
    const summary = _poiChainProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade keine aktive POI-Kette geladen.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _poiChainOrientationText(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return `${_missionVectorText(ctx)} Ich habe gerade keine aktive POI-Kette geladen.`;
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    const corridor = spec.corridor || null;
    const corridorSnap = snap?.corridor || null;
    const segments = Array.isArray(corridor?.segments) ? corridor.segments : [];
    const corridorDone = !!corridorSnap?.satisfied || !segments.length;
    if (!nextPoint && corridorDone) return 'Alle Kettenpunkte und Korridorsegmente sind erledigt. Der sinnvolle nächste Schritt ist der Rueckflug zur Basis.';
    if (!corridorDone) {
        const idx = Math.max(0, Math.min(segments.length - 1, Number(corridorSnap?.currentSegmentIndex || 0) || 0));
        const completed = Math.max(0, Number(corridorSnap?.completedCount || 0));
        const total = segments.length;
        const activeCoverage = Math.round(Number(corridorSnap?.activeCoverage || 0) * 100);
        return `${_missionVectorText(ctx)} Der Korridor ist in Segmente geteilt: ${completed} von ${total} sind sauber. Nimm jetzt Abschnitt ${idx + 1}, bleib im gelben Band und flieg ihn bis zum Ende${activeCoverage ? `; aktueller Abschnitt etwa ${activeCoverage}%` : ''}.`;
    }
    if (!nextPoint) return 'Der Korridor ist sauber abgeflogen, jetzt sind nur noch die offenen Fotopunkte relevant.';
    if (ctx?.hasPosition) {
        const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const clock = _relativeClockPos(brg, ctx.hdg || 0);
        return `Nächster Kettenpunkt ist ${nextPoint.name}. Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad, Entfernung ${dist.toFixed(1)} NM, etwa ${clock}. Der Triggerkreis ist auf der Karte markiert.`;
    }
    return `Nächster Kettenpunkt ist ${nextPoint.name}. Der aktuelle rote Triggerkreis ist auf der Karte markiert.`;
}

function _poiChainAudioKey(kind = 'event', text = '') {
    const suffix = text ? `-${_hashStable(text).toString(36).slice(0, 6)}` : '';
    return _paxMissionAudioKey(`poi-chain-${kind}${suffix}`);
}

function _poiChainPickText(pool = [], seed = '') {
    const options = (Array.isArray(pool) ? pool : []).map(v => String(v || '').trim()).filter(Boolean);
    if (!options.length) return '';
    return options[_hashStable(seed) % options.length] || options[0] || '';
}

function _poiChainPointLabel(point = null, fallback = 'dieser Punkt') {
    const name = String(point?.name || '').trim();
    if (!name) return fallback;
    return name.length > 46 ? `${name.slice(0, 43).trim()}...` : name;
}

function _poiChainPointFindingText(event = null, spec = null) {
    const point = event?.point || null;
    const tags = point?.tags || {};
    const hiddenOutcome = event?.hiddenOutcome && typeof event.hiddenOutcome === 'object' ? event.hiddenOutcome : null;
    const explicit = [
        hiddenOutcome?.paxFindingText,
        hiddenOutcome?.findingHint,
        tags.paxFindingText,
        tags.findingText,
        tags.findingHint,
        event?.findingText,
        event?.findingHint
    ].map(v => String(v || '').trim()).find(Boolean);
    if (explicit) return explicit;
    const marker = String(hiddenOutcome?.findingKind || tags.finding || tags.outcome || tags.followUp || tags.followUpType || event?.finding || '').trim().toLowerCase();
    if (!marker || /^(none|ok|clear|normal|unauffaellig|unauffällig|false|0)$/.test(marker)) return '';
    const pointName = _poiChainPointLabel(point, 'dieser Querung');
    return _poiChainPickText([
        `Bei ${pointName} nehme ich einen möglichen Anschlussbedarf mit. Die Fotos sollten später genauer ausgewertet werden, bevor daraus eine Einzelprüfung wird.`,
        `Hier notiere ich eine Auffälligkeit für die Nachsichtung. Wir dokumentieren den Punkt sauber und entscheiden erst nach der Bildauswertung über eine Folgemission.`,
        `Diesen Punkt markiere ich für die Auswertung. Aus der Luft reicht das für den Erstbefund, Details klären wir später gezielt am Einzelobjekt.`
    ], `${spec?.key || spec?.label || ''}|${point?.id || pointName}|finding|${marker}`);
}

function _poiChainVoiceText(kind = 'point_complete', spec = null, event = null) {
    const point = event?.point || null;
    const nextPoint = event?.nextPoint || null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${point?.id || ''}|${nextPoint?.id || ''}`;
    switch (kind) {
        case 'chain_complete':
            return _poiChainPickText([
                'Kette abgeschlossen: Korridor sauber abgeflogen, Prüfpunkte dokumentiert. Wir gehen zur Auswertung zurück zum Heimatplatz.',
                'Auftrag erfüllt. Die Linie ist komplett abgeflogen und die Fotopunkte sind dokumentiert, jetzt bringen wir die Bilder zurück zur Basis.',
                'Das reicht für den Erstbefund: Korridor und Kontrollpunkte sind im Kasten. Rückflug zur Übergabe.',
                'Alles aufgenommen. Korridor und Kette sind vollständig dokumentiert, Rückflug zum Startplatz.'
            ], seed);
        case 'point_complete':
            return _poiChainPointFindingText(event, spec) || _poiChainPickText([
                'Gut, der Punkt ist im Kasten. Ich habe die Bilder; weiter zum nächsten markierten Punkt.',
                'Passt, diese Querung ist dokumentiert. Ich rufe gleich den nächsten Prüfpunkt auf.',
                'Fotos sind drauf. Für den Erstbefund reicht das hier; weiter zur nächsten Markierung.',
                'Sauber, der Abschnitt ist abgehakt. Nächster Punkt kommt jetzt auf die Karte.',
                'Der Kontrollpunkt ist erledigt. Ich notiere ihn als dokumentiert und nehme den nächsten Abschnitt auf.'
            ], seed);
        case 'chain_area_entered':
            return _poiChainPickText([
                'Wir sind am ersten Kettenpunkt. Bitte ruhig halten, ich starte die Bildserie.',
                'Erster Prüfpunkt erreicht. Ich beginne mit den Übersichtsaufnahmen und rufe danach den nächsten Punkt auf.',
                'Das ist der Einstieg in die Kette. Ein stabiler Vorbeiflug reicht für den ersten Befund.'
            ], seed);
        case 'chain_corridor_entered':
            return _poiChainPickText([
                'Wir sind am Einstieg in den Korridor. Halte die Maschine im gelben Band, dann zählt der erste Abschnitt.',
                'Korridor erreicht. Ab jetzt zählt nicht nur der Fotopunkt, sondern auch der saubere Verlauf im Band.',
                'Das ist der Beginn der Korridorarbeit. Ruhig im Streifen bleiben, ich bestätige die Abschnitte nacheinander.'
            ], seed);
        case 'corridor_segment_complete':
            return '';
        case 'corridor_segment_reset_offtrack':
            return _poiChainPickText([
                'Wir sind zu weit aus dem Korridor gelaufen. Setz diesen Abschnitt noch einmal sauber an.',
                'Der aktuelle Abschnitt zählt so nicht, wir waren zu lange neben dem Band. Bitte zurück in den Korridor und den Teil wiederholen.',
                'Korrektur: Der Korridor wurde verlassen. Diesen Abschnitt bitte noch einmal ruhig im Band abfliegen.'
            ], `${seed}|reset|${event?.segmentId || event?.segment?.id || ''}`);
        case 'corridor_segment_reset_speed':
            return _poiChainPickText([
                'Für den Korridor waren wir zu langsam oder instabil. Diesen Abschnitt bitte noch einmal sauber ansetzen.',
                'Der Abschnitt zählt nicht, die Geschwindigkeit war nicht stabil genug. Zurück ins Band und neu aufnehmen.'
            ], `${seed}|speed|${event?.segmentId || event?.segment?.id || ''}`);
        case 'chain_corridor_complete':
            return _poiChainPickText([
                'Korridor sauber abgeflogen. Jetzt fehlen nur noch offene Fotopunkte, falls noch welche markiert sind.',
                'Die Korridorlinie ist vollständig. Halte jetzt die restlichen Aufnahmepunkte im Blick.',
                'Korridorarbeit abgeschlossen. Die Linie ist sauber, wir konzentrieren uns auf die verbleibenden Punkte.'
            ], seed);
        default:
            return '';
    }
}

function _poiChainPhotoSoundOptions(kind = '', spec = null, event = null, text = '') {
    if (kind !== 'point_complete') return null;
    const cueId = _paxMissionAudioCueId('poi_chain', kind, 'photo');
    if (cueId === 'none') return null;
    const point = event?.point || {};
    const seed = `${spec?.key || spec?.label || ''}|${point?.id || point?.name || ''}|${text}`;
    if (cueId !== 'photo') {
        return {
            beforeAudio: (epoch) => _paxPlayAudioCue(cueId, `${seed}|pre`, {
                minCount: 1,
                maxCount: 1,
                firstDelayMs: 120,
                minDelayMs: 0,
                maxDelayMs: 0
            }, epoch)
        };
    }
    return {
        beforeAudio: (epoch) => _paxPlayPhotoBurst(`${seed}|pre`, {
            minCount: 1,
            maxCount: 5,
            firstDelayMs: _paxSeededInt(`${seed}|pre-first`, 200, 1000),
            minDelayMs: 200,
            maxDelayMs: 1000
        }, epoch),
        afterAudio: (epoch) => {
            const postCount = _paxSeededInt(`${seed}|post-count`, 0, 2);
            if (postCount <= 0) return false;
            return _paxPlayPhotoBurst(`${seed}|post`, {
                minCount: postCount,
                maxCount: postCount,
                firstDelayMs: _paxSeededInt(`${seed}|post-first`, 200, 1000),
                minDelayMs: 200,
                maxDelayMs: 1000
            }, epoch);
        }
    };
}

function _poiChainEventSoundOptions(kind = '', spec = null, event = null, text = '') {
    const fallbackByKind = {
        chain_corridor_entered: 'scan_start',
        chain_corridor_complete: 'handoff',
        chain_complete: 'handoff'
    };
    const fallbackCue = fallbackByKind[kind] || 'none';
    const cueId = _paxMissionAudioCueId('poi_chain', kind, fallbackCue);
    if (cueId === 'none') return null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${event?.segmentId || event?.segment?.id || ''}|${text}`;
    return {
        beforeAudio: (epoch) => _paxPlayAudioCue(cueId, `${seed}|cue`, {
            minCount: 1,
            maxCount: 1,
            firstDelayMs: 0,
            minDelayMs: 0,
            maxDelayMs: 0
        }, epoch)
    };
}

function _poiChainEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'chain_complete') return 'chain_complete';
    if (type === 'point_complete') return 'point_complete';
    if (type === 'chain_area_entered') return 'chain_area_entered';
    if (type === 'chain_corridor_entered') return 'chain_corridor_entered';
    if (type === 'corridor_segment_complete') return 'corridor_segment_complete';
    if (type === 'corridor_segment_reset_offtrack') return 'corridor_segment_reset_offtrack';
    if (type === 'corridor_segment_reset_speed') return 'corridor_segment_reset_speed';
    if (type === 'chain_corridor_complete') return 'chain_corridor_complete';
    return '';
}

function _handlePoiChainEvents(events = [], spec = null) {
    if (!Array.isArray(events) || !events.length) return;
    const meaningful = events
        .map(event => ({ event, kind: _poiChainEventKind(event) }))
        .filter(item => item.kind);
    if (!meaningful.length) return;
    const pickedEvents = [];
    const resetEvent = meaningful.find(item => /^corridor_segment_reset/.test(item.kind));
    const pointEvent = meaningful.find(item => item.kind === 'point_complete');
    const areaEvent = meaningful.find(item => item.kind === 'chain_area_entered' || item.kind === 'chain_corridor_entered');
    const silentSegmentEvent = meaningful.find(item => item.kind === 'corridor_segment_complete');
    const corridorEvent = meaningful.find(item => item.kind === 'chain_corridor_complete');
    const chainEvent = meaningful.find(item => item.kind === 'chain_complete');
    if (silentSegmentEvent && !corridorEvent && !chainEvent && typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot('poi-chain-corridor_segment_complete');
    }
    if (resetEvent) pickedEvents.push(resetEvent);
    else if (pointEvent) pickedEvents.push(pointEvent);
    else if (areaEvent) pickedEvents.push(areaEvent);
    else if (meaningful[0]?.kind !== 'corridor_segment_complete') pickedEvents.push(meaningful[0]);
    if (corridorEvent && !pickedEvents.includes(corridorEvent) && !chainEvent) pickedEvents.push(corridorEvent);
    if (chainEvent && !pickedEvents.includes(chainEvent)) pickedEvents.push(chainEvent);
    const speaker = _speakerSnapshotForMissionVoice('poi-chain');
    for (const picked of pickedEvents) {
        const kind = picked.kind;
        const event = picked.event || null;
        _paxLog(`POI-Chain Event: ${kind}`, 'event');
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot(`poi-chain-${kind}`, { immediate: kind === 'chain_complete' });
        }
        const text = _poiChainVoiceText(kind, spec, event);
        if (!text) continue;
        const label = kind === 'chain_complete'
            ? 'Kette erfüllt'
            : (kind.includes('reset') ? 'Korridor-Korrektur' : 'Ketten-Fortschritt');
        const eventOptions = _poiChainPhotoSoundOptions(kind, spec, event, text)
            || _poiChainEventSoundOptions(kind, spec, event, text)
            || {};
        _speakPreparedText(_poiChainAudioKey(kind, text), text, speaker, label, eventOptions);
    }
}
function paxKnowledgeTellMore() {
    const context = _activePoiKnowledgeContext();
    if (!_poiKnowledgeTellMoreAvailable()) {
        _paxSpeakTextDirect('Dazu habe ich gerade keine gesicherte Faktenbasis geladen.', 'Erzähl mal');
        return;
    }
    const fact = _poiKnowledgeNextManualFact();
    const target = _poiKnowledgeTargetName(context);
    if (!fact) {
        _paxSpeakTextDirect(`Mehr weiß ich dazu leider auch nicht. Die gesicherten Punkte zu ${target} haben wir damit durch.`, 'Erzähl mal');
        _refreshPoiKnowledgeGuideMenu();
        return;
    }
    const clip = _poiKnowledgeManualFactClip(fact.text);
    const intro = _poiKnowledgeManualFactIndices.size <= 1 ? 'Klar. Noch ein Punkt:' : 'Noch ein Punkt:';
    _paxSpeakTextDirect(`${intro} ${clip}.`, 'Erzähl mal');
    _refreshPoiKnowledgeGuideMenu();
}
  if (cue.sarReport) {
    const report = cue.sarReport.context || {};
    const accepted = report.nearEnough === true;
    if (accepted) _sarSearchOutcome = 'found';
    const prompt = accepted ? _poiManualFoundPrompt(report) : _poiManualNotFoundPrompt(report);
    const fallbackText = accepted ? _poiManualFoundFallback(report) : _poiManualNotFoundFallback(report);
    return { prompt, fallbackText, label: accepted ? 'Fund bestaetigt' : 'Weiter suchen',
      memory: normalizeMemory({ ..._poiNarrativeMemory, sarSearchOutcome: _sarSearchOutcome }) };
  }
  if (cue.availability) return _poiKnowledgeTellMoreAvailable();
  if (cue.chainEvent) {
    _handlePoiChainEvents(cue.chainEvent.events, cue.chainEvent.spec);
    return { chainEvents };
  }
  if (cue.surveyEvent) {
    const meaningful = (Array.isArray(cue.surveyEvent.events) ? cue.surveyEvent.events : []).map(_surveyPatternEventKind).filter(Boolean);
    const kind = meaningful.includes('survey_complete') ? 'survey_complete'
      : (meaningful.includes('survey_area_entered') ? 'survey_area_entered'
        : meaningful.find(value => /complete|reset/.test(value)));
    if (!kind) return { surveyEvent: null };
    const spec = cue.surveyEvent.spec || context.surveySpec || null;
    const text = _surveyPatternVoiceText(kind, spec);
    return { surveyEvent: text ? { kind, text, staticClipKey: _surveyPatternStaticClipKey(kind, spec) } : null };
  }
  if (cue.action) {
    if (cue.action === 'poi_tell_more') {
      if (!_poiKnowledgeTellMoreAvailable()) throw new TypeError('poi_knowledge_not_available');
      paxKnowledgeTellMore();
      return { ...actionResult, memory: normalizeMemory({ ...previous, knowledgeManual: [..._poiKnowledgeManualFactIndices] }) };
    }
    if (cue.action === 'poi_status') _poiMissionStatusAction(); else _poiMissionOrientationAction(true);
    return actionResult;
  }
  let prompt = null;
  if (cue.prompt) prompt = ({ _poiEntryPrompt, _poiInSightPrompt, _poiAltComplaintPrompt, _poiAltCorrectedPrompt, _poiSatisfiedPrompt, _poiAbortPrompt, _poiMissingCargoAbortPrompt })[cue.prompt](...cue.args);
  if (cue.farewell) {
    const prepared = _farewellPreparedContext(cue.dynamic?.record);
    return { prompt: prepared?.prompt || '', text: prepared?.text || '', fallbackText: '',
      memory: normalizeMemory({ ..._poiNarrativeMemory, sarSearchOutcome: _sarSearchOutcome }) };
  }
  if (cue.capture) _capturePoiNarrativeMemory(cue.capture.label, cue.capture.text);
  return { prompt, memory: normalizeMemory({ ..._poiNarrativeMemory, inspectionOutcome: _poiInspectionOutcome, sarSearchOutcome: _sarSearchOutcome, knowledgeSpoken: _poiKnowledgeSpokenMemory }) };
}
function render(context, cue, previous = {}, randomValue = 0.5) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (!PROMPTS.includes(cue?.prompt) || !Array.isArray(cue.args) || cue.args.length > 5)
    throw new TypeError('poi_voice_cue_invalid');
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) throw new TypeError('poi_voice_random_invalid');
  const result = original(clone(context), clone(previous), clone(cue), randomValue);
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function captureMemory(previous, label, text, taskDomain = 'media_photo') {
  return original({ taskDomain, captureKnowledge: ['sightseeing_tour', 'poi_learning_guide'].includes(taskDomain) }, previous, { capture: { label, text } }).memory;
}
function renderFarewell(context, dynamic = {}, previous = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  const result = original(clone(context), clone(previous), { farewell: true, dynamic: clone(dynamic) });
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function validateTrainingFarewellContext(context, missionId = context?.missionId) {
  if (context?.schema !== 'ga.mission-training-authority-context.v1' || context?.version !== 1
      || context?.missionMode !== 'APT' || !missionId || context.missionId !== missionId) return 'training_farewell_context_identity_invalid';
  if (!DOMAINS.includes(context.taskDomain) || !['training', 'club_training_basic', 'club_training_advanced'].includes(context.taskDomain)
      || !context.passenger || Array.isArray(context.passenger) || typeof context.baseContext !== 'string' || !context.baseContext.trim()
      || typeof context.audioEnabled !== 'boolean' || !context.trainingPlan || typeof context.trainingPlan !== 'object') return 'training_farewell_context_invalid';
  return null;
}
function renderTrainingFarewell(context, dynamic = {}, previous = {}) {
  const error = validateTrainingFarewellContext(context);
  if (error) throw new TypeError(error);
  const result = original(clone(context), clone(previous), { farewell: true, missionMode: 'APT', dynamic: clone(dynamic) });
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('training_farewell_prompt_too_large');
  return result;
}
function renderAction(context, action, detector, sample, target, previous = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (!['poi_status', 'poi_orientation', 'poi_tell_more'].includes(action)) throw new TypeError('poi_action_invalid');
  const result = original(clone(context), clone(previous), { action, detector: clone(detector || {}), sample: clone(sample || {}), target: clone(target) });
  if (result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function renderSarReport(context, reportContext, detector = {}, memory = {}, randomValue = 0.5) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (context.taskDomain !== 'search_and_rescue') throw new TypeError('poi_sar_report_domain_invalid');
  if (!reportContext || typeof reportContext.nearEnough !== 'boolean') throw new TypeError('poi_sar_report_context_invalid');
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) throw new TypeError('poi_voice_random_invalid');
  const result = original(clone(context), clone(memory), { sarReport: { context: clone(reportContext), detector: clone(detector) } }, randomValue);
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function knowledgeAvailable(context, memory = {}, active = true) {
  return original(context || {}, memory || {}, { availability: true, active });
}
function surveyEvent(context, events = [], spec = context?.surveySpec || null) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (context.taskDomain !== 'mapping_survey') throw new TypeError('poi_survey_domain_invalid');
  return original(clone(context), {}, { surveyEvent: { events: clone(Array.isArray(events) ? events : []), spec: clone(spec) } }).surveyEvent;
}
function chainEvents(context, events = [], spec = context?.chainSpec || null) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (context.taskDomain !== 'infra_chain_recon' || !spec) throw new TypeError('poi_chain_voice_context_invalid');
  return original(clone(context), {}, { chainEvent: { events: clone(events), spec: clone(spec) } }).chainEvents;
}
return Object.freeze({ chainEvents, knowledgeAvailable, renderAction, renderFarewell, renderTrainingFarewell, renderSarReport, surveyEvent, CONTEXT_SCHEMA, DOMAINS, PROMPTS, validateContext, validateTrainingFarewellContext, normalizeMemory, render, captureMemory });
});
