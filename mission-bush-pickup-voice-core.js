// Generated from original passenger-voice.js functions by tools/generate-bush-pickup-voice-core.mjs.
// Do not hand-edit prompt text or rules; update the App source and verify parity.
(function(root, factory) { 'use strict'; var api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; if (root && typeof root === 'object') root.GAMissionBushPickupVoiceCore = api; }(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
const SCHEMA = 'ga.mission-bush-pickup-voice-context.v1';
const MAX_MEMORY = 4;
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
function text(value, max = 4000) { return String(value == null ? '' : value).trim().slice(0, max); }
function normalizeMemory(value = {}) {
  const fields = (source, keys) => Object.fromEntries(keys.map(key => [key, text(source?.[key], 180)]));
  return { passenger: fields(value.passenger, ['boarding','departure','arrival','farewell']),
    cargo: fields(value.cargo, ['boarding','departure','farewell']) };
}
function validateContext(context, missionId = context?.missionId) {
  if (context?.schema !== SCHEMA || context.version !== 1 || !missionId || context.missionId !== missionId)
    return 'bush_pickup_voice_context_identity_invalid';
  if (!['passenger','cargo'].includes(context.pickupKind) || context.targetMode !== 'strip_then_return'
      || context.requiresReturnHome !== true || !context.bush || context.bush.pickupKind !== context.pickupKind
      || (context.pickupKind === 'passenger' && !context.baseContext) || !context.speaker)
    return 'bush_pickup_voice_context_invalid';
  const expectedProfile = context.pickupKind === 'passenger' ? 'bush_pickup_strip' : 'bush_pickup_cargo';
  if (context.bush.profileId !== expectedProfile || context.bush.targetMode !== 'strip_then_return'
      || context.bush.completionMode !== 'return_home' || context.bush.requiresReturnHome !== true
      || !Array.isArray(context.bush.allowedEndLocations) || context.bush.allowedEndLocations.length !== 1
      || context.bush.allowedEndLocations[0] !== 'home') return 'bush_pickup_voice_context_invalid';
  if (context.pickupKind === 'passenger' && !context.passenger) return 'bush_pickup_voice_passenger_missing';
  if (context.pickupKind === 'cargo' && !context.cargoContext) return 'bush_pickup_voice_cargo_missing';
  try { if (encodeURIComponent(JSON.stringify(context)).replace(/%[A-F0-9]{2}/g, 'x').length > 65536) return 'bush_pickup_voice_context_too_large'; }
  catch (_) { return 'bush_pickup_voice_context_invalid'; }
  return null;
}
function render(context = {}, input = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  const stage = String(input.stage || '').toLowerCase();
  const stageMap = context.pickupKind === 'passenger'
    ? { pickup_boarding: ['passenger','boarding','_pickupBoardingPrompt','Pickup'], pickup_departure: ['passenger','departure','_pickupDeparturePrompt','Rueckflug'] }
    : { cargo_pickup_boarding: ['cargo','boarding','_pickupCargoBoardingPrompt','Pickup'], cargo_pickup_departure: ['cargo','departure','_pickupCargoDeparturePrompt','Rueckflug'] };
  const selected = stageMap[stage];
  if (!selected) throw new TypeError('bush_pickup_voice_stage_invalid');
  const previous = normalizeMemory(input.previous);
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const currentMissionData = { ...(context.missionData || {}), missionContract: contract, bush: context.bush,
    ...(context.charterContinuation ? {charterIdea:{continuation:true}} : {}) };
  const window = { activePassenger: context.pickupKind === 'passenger' ? context.passenger : null,
    activeMissionContract: contract, currentMissionData,
    missionCargoGetManifestSnapshot: () => context.manifest || null };
  const localStorage = { getItem: key => key === 'ga_active_mission_contract' ? JSON.stringify(contract) : null };
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
  const _baseContext = () => text(context.baseContext, 24000);
  const _toneHint = () => String(context.toneHint || '').slice(0, 4000);
  const _weatherContext = () => text(input.weatherText || context.weatherText, 1200);
  const _bushPickupStoryData = () => context.storyData || {};
  const _bushPickupStoryAnchorLine = () => text(context.storyAnchorLine, 2400);
  const _bushPickupBetweenFlightsLine = () => text(context.betweenFlightsLine, 2400);
  const _bushCargoPickupLabel = () => text(context.cargoLabel, 1200) || 'Rueckholfracht';
  const _bushCargoPickupFollowUpLine = () => text(context.cargoFollowUpLine, 2400);
  const _cargoOnlyVoiceContext = () => context.cargoContext || null;
  const _normUrgencyPriority = value => String(value || '').toLowerCase() === 'hoch' ? 'hoch' : 'normal';
  const _poiMemoryCompact = value => String(value || '').replace(/\s+/g, ' ').replace(/\b(äh|aeh|halt|quasi|sozusagen)\b/gi, '').trim().slice(0,180);
function _bushPickupStageProgression(stage = 'departure') {
    const s = String(stage || '').toLowerCase();
    if (s === 'departure') {
        return 'Story-Stufe Rückflug: Nenne jetzt ein neues Detail aus der Arbeit draußen oder ein konkretes Ergebnis, das beim Einsteigen noch nicht gesagt wurde. Wiederhole nicht denselben Satz in anderen Worten.';
    }
    if (s === 'arrival') {
        return 'Story-Stufe Anflug: Verschiebe den Fokus nach vorn auf McCall und den ersten Schritt nach der Landung. Nenne höchstens ein kurzes Ergebnis aus der Wildnis, aber kein erneutes komplettes Debrief.';
    }
    if (s === 'farewell') {
        return 'Story-Stufe Abschluss: Runde die Geschichte persönlich ab. Danke dem Piloten, nenne den Handoff oder die Auswertung in der Basis und wiederhole weder Pickup-Grund noch Rückfluggrund ausführlich.';
    }
    return 'Story-Stufe Einstieg: Setze den Einsatzschwerpunkt, aber hebe Details und Ergebnisse für die späteren Ansagen auf.';
}

function _bushPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupPassengerContract();
    if (!active) return '';
    const boarding = String(_bushPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushPickupNarrativeMemory?.departure || '').trim();
    const arrival = String(_bushPickupNarrativeMemory?.arrival || '').trim();
    if (stage === 'departure') {
        if (!boarding) return '';
        return ` Bisherige Strip-Ansage (inhaltlich verbindlich, nicht wortgleich wiederholen): "${boarding}". ${_bushPickupStageProgression('departure')} Bleib bei demselben Einsatz, derselben Tätigkeit und demselben Wildnis-Kontext; erfinde keinen anderen Forschungs-, Tier-, Einsatz- oder Missionsschwerpunkt.`;
    }
    const used = [boarding, departure, stage === 'farewell' ? arrival : ''].filter(Boolean);
    if (!used.length) return '';
    return ` Bisherige Bush-Pickup-Ansagen (inhaltlich verbindlich, nicht wortgleich wiederholen): ${used.map(text => `"${text}"`).join(' | ')}. ${_bushPickupStageProgression(stage)} Bleib bei derselben Geschichte; führe sie weiter oder runde sie ab, statt dieselben Inhalte neu zu verpacken. Führe keinen neuen Forschungs-, Wildnis- oder Einsatzschwerpunkt ein.`;
}

function _captureBushPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupPassengerContract();
    if (!active) return;
    const ev = String(eventLabel || '').toLowerCase();
    const compact = _poiMemoryCompact(spokenText);
    if (!compact) return;
    if (ev.includes('pickup')) _bushPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushPickupNarrativeMemory.departure = compact;
    else if (ev.includes('landung') || ev.includes('anflug')) _bushPickupNarrativeMemory.arrival = compact;
    else if (ev.includes('verabschiedung')) _bushPickupNarrativeMemory.farewell = compact;
}

function _bushCargoPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupCargoContract();
    if (!active) return '';
    const boarding = String(_bushCargoPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushCargoPickupNarrativeMemory?.departure || '').trim();
    const farewell = String(_bushCargoPickupNarrativeMemory?.farewell || '').trim();
    const used = [];
    if (boarding) used.push(boarding);
    if (stage !== 'departure' && departure) used.push(departure);
    if (stage === 'final' && farewell) used.push(farewell);
    if (!used.length) return '';
    return ` Bisherige Bush-Cargo-Ansagen (inhaltlich verbindlich): ${used.map(text => `"${text}"`).join(' | ')}. Wiederhole weder Grund noch Empfaenger noch naechsten Schritt wortgleich. Fuehre die Geschichte stattdessen knapp weiter und gib pro Phase neue, konkrete Information.`;
}

function _captureBushCargoPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupCargoContract();
    if (!active) return;
    const ev = String(eventLabel || '').trim().toLowerCase();
    const compact = String(spokenText || '').trim();
    if (!compact) return;
    if (ev.includes('pickup')) _bushCargoPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushCargoPickupNarrativeMemory.departure = compact;
    else if (ev.includes('verabschiedung')) _bushCargoPickupNarrativeMemory.farewell = compact;
}

function _activeBushPickupPassengerContract() {
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const isBushPickupPassenger = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'passenger'
    );
    return isBushPickupPassenger ? { contract, bush } : null;
}

function _activeBushPickupCargoContract() {
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const isBushPickupCargo = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'cargo'
    );
    return isBushPickupCargo ? { contract, bush } : null;
}

function _pickupBoardingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const active = _activeBushPickupPassengerContract();
    if (!active) return null;
    if (window.currentMissionData?.charterIdea?.continuation) return `${ctx}\nDu bist gerade am Aufenthaltsplatz zugestiegen. Begrüße den Piloten natürlich und erwähne bei Bedarf ein Detail des gespeicherten Aufenthalts. Maximal drei Sätze. Du sprichst als der benannte Gast für dieselbe Reisegruppe. Keine neuen Aufgaben, Gegenstände oder Termine erfinden.${_toneHint()}`;
    const wx = _weatherContext(window.lastLiveFlightData);
    const storyAnchor = _bushPickupStoryAnchorLine(active, pax);
    const storyData = _bushPickupStoryData(active, pax);
    const betweenFlights = _bushPickupBetweenFlightsLine(active, pax);
    const isAptCharterPickup = String(active?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const pickupPlaceText = isAptCharterPickup ? 'am Zielplatz oder im GA-Bereich' : 'am Strip';
    const manifestSpeechRule = 'WICHTIG: Keine Manifest- oder UI-Sprache. Sage nie Dinge wie "1 PAX", "AN BORD", "AUSRUESTUNG", "Payload" oder "ich bin jetzt als PAX geladen". Sprich einfach natuerlich als Person, die gerade eingestiegen ist.';
    return `${ctx}

Moment: Der Pickup ist gerade abgeschlossen, die Tür ist geschlossen und ich bin jetzt an Bord; wir stehen noch ${pickupPlaceText} oder rollen langsam an.${wx ? ' ' + wx : ''}
${storyAnchor}
${betweenFlights}
${storyData.boardingCue ? `Ich-Cue für diesen Moment: "${storyData.boardingCue}"` : ''}
${_bushPickupStageProgression('boarding')}
Sprich strikt als abgeholter Gast, der gerade eingestiegen ist. Sag jetzt kurz und natürlich, dass du bereit bist, verorte dich am Treffpunkt (${storyData.exactWhere}) und erwähne ein konkretes Detail aus der Zeit seit dem ersten Flug. Lege dabei den thematischen Faden für die spätere Rückflug-Ansage fest: genau ein klarer Einsatzschwerpunkt, kein Themenmix. Das ist der kurze Moment direkt nach dem Einsteigen und Türschließen, noch kein längerer Debrief.
Harte Perspektiv-Regel: Verwende "ich" für den abgeholten Gast. Sage niemals, du hättest "den Gast", "den Passagier", "ihn" oder "sie" eingesammelt, eingeladen oder abgeholt. Das hat der Pilot getan.
${manifestSpeechRule}
Max 3 Sätze.${_toneHint()}`;
}

function _pickupDeparturePrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const active = _activeBushPickupPassengerContract();
    if (!active) return null;
    if (window.currentMissionData?.charterIdea?.continuation) return `${ctx}\nDer besetzte Rückflug hat begonnen. Führe das bereits gehörte Gespräch mit einem neuen persönlichen Detail aus dem gespeicherten Aufenthalt fort, ohne erneute Begrüßung. Maximal vier Sätze. Du sprichst als der benannte Gast für dieselbe Reisegruppe. Keine neuen Aufgaben, Gegenstände oder Termine erfinden.${_toneHint()}`;
    const wx = _weatherContext(window.lastLiveFlightData);
    const continuityHint = _bushPickupNarrativeHint('departure');
    const storyAnchor = _bushPickupStoryAnchorLine(active, pax);
    const storyData = _bushPickupStoryData(active, pax);
    const betweenFlights = _bushPickupBetweenFlightsLine(active, pax);
    const isAptCharterPickup = String(active?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const urgency = _normUrgencyPriority(pax?.urgencyPriority);
    const aptTimeTone = urgency === 'hoch'
        ? 'Wenn der konkrete Anlass es hergibt, darf ein echter Zeitbezug kurz mitschwingen.'
        : 'Es gibt keinen Zeitdruck: keine Anschluss-Termin-Hektik, kein "Termin drückt", kein dringender Statusbericht.';
    const storyInstruction = isAptCharterPickup
        ? `Baue direkt auf deiner kurzen Ansage vom Zielplatz auf: Erzähle jetzt als abgeholter Chartergast eine kleine persönliche Szene aus der Zeit zwischen den Flügen, nicht wie ein Briefing. Nimm ein konkretes Detail aus dem Aufenthalt: ein Gespräch, eine handschriftliche Notiz, ein kurzer Weg vom Vorfeld zum Kontakt, eine Mappe im Gepäck oder einen Moment, der dir hängen geblieben ist. Erkläre daraus natürlich, warum der Rückflug nach ${storyData.homePlace} jetzt passt und was du innerlich vom Termin mitnimmst. Nutze den Rückkehrgrund nur als Stoff für diese Erzählung: ${storyData.returnReason || 'zu Hause wartet der nächste ruhige Schritt'}. Der Ton ist Airport-Charter: persönlich, professionell, ruhig; keine Bush-, Wildnis- oder Einsatzromantik. ${aptTimeTone} Beginne NICHT erneut mit einer Begrüßung wie "Hallo", "Hi", "Moin" oder einer neuen Selbstvorstellung, sondern setze inhaltlich einfach fort.`
        : `Baue direkt auf deiner kurzen Ansage vom Strip auf: Erzähle jetzt die persönliche Zwischenzeit-Geschichte aus deiner Ich-Perspektive als abgeholter Gast. Mache sie lebendig und glaubwürdig: was seit dem ersten Flug konkret passiert ist, ein kleines beobachtetes Detail oder Problem vor Ort, welche Notizen/Gegenstände du jetzt dabei hast, warum du wieder nach ${storyData.homePlace} musst und was du vom Ort oder vom Einsatz mitnimmst. Nutze dabei den Rückkehrgrund: ${storyData.returnReason || 'zu Hause wartet der nächste konkrete Arbeitsschritt'}. Der Ton darf klar Wilderness- und Einsatzcharakter haben: Abgeschiedenheit, Gelände, Dauer draußen, Feldarbeit, Wetter oder Rückkehr in die Zivilisation. Das darf persönlicher und bildhafter sein, aber weiterhin realistisch. Beginne NICHT erneut mit einer Begrüßung wie "Hallo", "Hi", "Moin" oder einer neuen Selbstvorstellung, sondern setze inhaltlich einfach fort.`;
    return `${ctx}

Moment: Wir sind wieder in der Luft und der Rückflug nach Hause läuft.${wx ? ' ' + wx : ''}${continuityHint}
${storyAnchor}
${betweenFlights}
${storyData.departureCue ? `Ich-Cue für den Rückflug: "${storyData.departureCue}"` : ''}
${storyInstruction}
Harte Perspektiv-Regel: Du bist der Passagier an Bord, nicht Pilot, Abholer, Lademeister oder Bodencrew. Verbotene Aussagen: "ich habe den Gast eingesammelt", "ich habe den Passagier abgeholt", "er sieht ... aus", "wir haben ihn geladen". Wenn du den Pickup erwähnst, dann nur so: der Pilot hat mich abgeholt/eingesammelt oder ich bin zugestiegen.
Max 5 Sätze.${_toneHint()}`;
}

function _pickupCargoBoardingPrompt() {
    const cargoCtx = _cargoOnlyVoiceContext();
    const active = _activeBushPickupCargoContract();
    if (!cargoCtx || !active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const cargoLine = _bushCargoPickupLabel(active, cargoCtx);
    const followUpLine = _bushCargoPickupFollowUpLine();
    const targetName = String(active.bush?.targetRef?.name || cargoCtx.dest || 'dem Strip').trim();
    return `ROLLE: Lademeister am Zielstrip · Persönlichkeit: pragmatisch, direkt, routiniert
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
RUECKHOLFRACHT: ${cargoLine}
AUFTRAG (kurz): ${cargoCtx.story || 'Rueckholfracht an einem abgelegenen Strip aufnehmen und zum Heimatplatz zurueckbringen.'}
STIL: kurze, glaubwuerdige Uebergabe am Boden aus Sicht des Loadmasters vor Ort.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}
${followUpLine}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Die Pickup-Fracht wird gerade am Zielstrip verladen, wir stehen noch am Boden in ${targetName}.${wx ? ` ${wx}` : ''}
Sprich direkt zum Piloten als Lademeister vor Ort. Sag kurz, was jetzt eingeladen wird, wie diese Rueckfracht aus dem vorherigen Supply Run entstanden ist, warum sie zurueck zum Heimatplatz muss und worauf beim Rueckflug zu achten ist. Erwaehne die Fracht immer direkt beim Namen: ${cargoLine}. Keine Passagierperspektive, kein Smalltalk. Lege hier nur die Ausgangslage und die wichtigste Vorsicht fest; Details zum Empfaenger, zur Werkstatt oder zur Bestandsliste hebst du dir fuer spaetere Phasen auf.
Max 3 Sätze.${_toneHint()}`;
}

function _pickupCargoDeparturePrompt() {
    const cargoCtx = _cargoOnlyVoiceContext();
    const active = _activeBushPickupCargoContract();
    if (!cargoCtx || !active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const cargoLine = _bushCargoPickupLabel(active, cargoCtx);
    const homeName = String(active.bush?.homeRef?.name || cargoCtx.dest || 'dem Heimatplatz').trim();
    const continuityHint = _bushCargoPickupNarrativeHint('departure');
    const followUpLine = _bushCargoPickupFollowUpLine();
    return `ROLLE: Lademeister am Zielstrip · Persönlichkeit: pragmatisch, direkt, routiniert
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
RUECKHOLFRACHT: ${cargoLine}
AUFTRAG (kurz): ${cargoCtx.story || 'Rueckholfracht an einem abgelegenen Strip aufnehmen und zum Heimatplatz zurueckbringen.'}
STIL: kurze Rueckflug-Freigabe aus Sicht des Boden-/Ladekontakts, nicht wie ein Mitflieger.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}
${followUpLine}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Die Fracht ist eingeladen und der Rueckflug zum Heimatplatz laeuft jetzt an.${wx ? ` ${wx}` : ''}${continuityHint}
Sprich direkt zum Piloten als Ladekontakt am Zielstrip. Sag kurz, dass ${cargoLine} jetzt sauber verstaut ist, was seit der Supply-Lieferung am Strip damit passiert ist, warum die Lieferung in ${homeName} gebraucht wird oder ausgewertet werden muss, und gib den Rueckflug knapp frei. Fuehre die Geschichte gegenueber der Pickup-Ansage inhaltlich weiter: keine wortgleiche Wiederholung von Frachtgrund, Empfaenger oder Vorsichtshinweis. Keine Passagierperspektive.
Max 3 Sätze.${_toneHint()}`;
}
  let prompt = null;
  if (selected[0] === 'passenger') prompt = selected[2] === '_pickupBoardingPrompt' ? _pickupBoardingPrompt() : _pickupDeparturePrompt();
  else prompt = selected[2] === '_pickupCargoBoardingPrompt' ? _pickupCargoBoardingPrompt() : _pickupCargoDeparturePrompt();
  if (!prompt) throw new TypeError('bush_pickup_voice_prompt_unavailable');
  if (input.spokenText) {
    if (selected[0] === 'passenger') _captureBushPickupNarrativeMemory(selected[1] === 'boarding' ? 'Pickup' : 'Rueckflug', input.spokenText);
    else _captureBushCargoPickupNarrativeMemory(selected[1] === 'boarding' ? 'Pickup' : 'Rueckflug', input.spokenText);
  }
  const next = normalizeMemory(memory);
  return { prompt, label: selected[3], stage, speaker: context.speaker, memory: next };
}
function evaluateDeparture(pending, sample = {}, now = Date.now(), pickupKind = 'passenger') {
  let triggered = false;
  const state = { missionPickupDepartureVoicePending: pending && typeof pending === 'object' ? { ...pending } : null };
  const window = { get missionPickupDepartureVoicePending() { return state.missionPickupDepartureVoicePending; },
    set missionPickupDepartureVoicePending(value) { state.missionPickupDepartureVoicePending = value; },
    activePassenger: pickupKind === 'passenger' ? {} : null,
    triggerPaxCargoPickupDeparture: () => { triggered = true; }, triggerPaxPickupDeparture: () => { triggered = true; } };
  const NativeDate = globalThis.Date;
  class Clock extends NativeDate { static now() { return now; } }
  const Date = Clock;
function _originalDepartureGuard(flightData = {}) {
    const pending = window.missionPickupDepartureVoicePending;
    if (!pending || typeof pending !== 'object') return false;
    const fd = flightData && typeof flightData === 'object' ? flightData : {};
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs);
    const agl = Number(fd.aglFt);
    if ((Date.now() - Number(pending.armedAt || 0)) < 1500) return false;
    const explicitAirborne = fd.onGround === false && (
        (Number.isFinite(agl) && agl > 12)
        || (Number.isFinite(gs) && gs >= 25)
    );
    const airborne = explicitAirborne || (Number.isFinite(agl) && agl > 45);
    const inferredAirborne = typeof fd.onGround !== 'boolean' && !Number.isFinite(agl) && Number.isFinite(gs) && gs >= 45;
    if (!airborne && !inferredAirborne) return false;
    window.missionPickupDepartureVoicePending = null;
    try {
        if (pending.kind === 'cargo') window.triggerPaxCargoPickupDeparture?.();
        else if (window.activePassenger) window.triggerPaxPickupDeparture?.();
    } catch (_) {}
    return true;
}
  const result = _originalDepartureGuard(sample);
  return { result, triggered, pending: state.missionPickupDepartureVoicePending };
}
function continuityHint(context = {}, previous = {}, stage = 'farewell') {
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const window = { activeMissionContract: contract };
  const localStorage = { getItem: () => JSON.stringify(contract) };
  const _activeBushPickupPassengerContract = () => context.pickupKind === 'passenger' ? { contract, bush: context.bush } : null;
  const _activeBushPickupCargoContract = () => context.pickupKind === 'cargo' ? { contract, bush: context.bush } : null;
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
function _bushPickupStageProgression(stage = 'departure') {
    const s = String(stage || '').toLowerCase();
    if (s === 'departure') {
        return 'Story-Stufe Rückflug: Nenne jetzt ein neues Detail aus der Arbeit draußen oder ein konkretes Ergebnis, das beim Einsteigen noch nicht gesagt wurde. Wiederhole nicht denselben Satz in anderen Worten.';
    }
    if (s === 'arrival') {
        return 'Story-Stufe Anflug: Verschiebe den Fokus nach vorn auf McCall und den ersten Schritt nach der Landung. Nenne höchstens ein kurzes Ergebnis aus der Wildnis, aber kein erneutes komplettes Debrief.';
    }
    if (s === 'farewell') {
        return 'Story-Stufe Abschluss: Runde die Geschichte persönlich ab. Danke dem Piloten, nenne den Handoff oder die Auswertung in der Basis und wiederhole weder Pickup-Grund noch Rückfluggrund ausführlich.';
    }
    return 'Story-Stufe Einstieg: Setze den Einsatzschwerpunkt, aber hebe Details und Ergebnisse für die späteren Ansagen auf.';
}
function _bushPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupPassengerContract();
    if (!active) return '';
    const boarding = String(_bushPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushPickupNarrativeMemory?.departure || '').trim();
    const arrival = String(_bushPickupNarrativeMemory?.arrival || '').trim();
    if (stage === 'departure') {
        if (!boarding) return '';
        return ` Bisherige Strip-Ansage (inhaltlich verbindlich, nicht wortgleich wiederholen): "${boarding}". ${_bushPickupStageProgression('departure')} Bleib bei demselben Einsatz, derselben Tätigkeit und demselben Wildnis-Kontext; erfinde keinen anderen Forschungs-, Tier-, Einsatz- oder Missionsschwerpunkt.`;
    }
    const used = [boarding, departure, stage === 'farewell' ? arrival : ''].filter(Boolean);
    if (!used.length) return '';
    return ` Bisherige Bush-Pickup-Ansagen (inhaltlich verbindlich, nicht wortgleich wiederholen): ${used.map(text => `"${text}"`).join(' | ')}. ${_bushPickupStageProgression(stage)} Bleib bei derselben Geschichte; führe sie weiter oder runde sie ab, statt dieselben Inhalte neu zu verpacken. Führe keinen neuen Forschungs-, Wildnis- oder Einsatzschwerpunkt ein.`;
}
function _bushCargoPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupCargoContract();
    if (!active) return '';
    const boarding = String(_bushCargoPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushCargoPickupNarrativeMemory?.departure || '').trim();
    const farewell = String(_bushCargoPickupNarrativeMemory?.farewell || '').trim();
    const used = [];
    if (boarding) used.push(boarding);
    if (stage !== 'departure' && departure) used.push(departure);
    if (stage === 'final' && farewell) used.push(farewell);
    if (!used.length) return '';
    return ` Bisherige Bush-Cargo-Ansagen (inhaltlich verbindlich): ${used.map(text => `"${text}"`).join(' | ')}. Wiederhole weder Grund noch Empfaenger noch naechsten Schritt wortgleich. Fuehre die Geschichte stattdessen knapp weiter und gib pro Phase neue, konkrete Information.`;
}
  return context.pickupKind === 'passenger' ? _bushPickupNarrativeHint(stage) : _bushCargoPickupNarrativeHint(stage);
}
function captureMemory(context = {}, previous = {}, stage = '', spokenText = '') {
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const window = { activeMissionContract: contract };
  const localStorage = { getItem: () => JSON.stringify(contract) };
  const _activeBushPickupPassengerContract = () => context.pickupKind === 'passenger' ? { contract, bush: context.bush } : null;
  const _activeBushPickupCargoContract = () => context.pickupKind === 'cargo' ? { contract, bush: context.bush } : null;
  const _poiMemoryCompact = value => String(value || '').replace(/\s+/g, ' ').replace(/\b(äh|aeh|halt|quasi|sozusagen)\b/gi, '').trim().slice(0,180);
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
function _captureBushPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupPassengerContract();
    if (!active) return;
    const ev = String(eventLabel || '').toLowerCase();
    const compact = _poiMemoryCompact(spokenText);
    if (!compact) return;
    if (ev.includes('pickup')) _bushPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushPickupNarrativeMemory.departure = compact;
    else if (ev.includes('landung') || ev.includes('anflug')) _bushPickupNarrativeMemory.arrival = compact;
    else if (ev.includes('verabschiedung')) _bushPickupNarrativeMemory.farewell = compact;
}
function _captureBushCargoPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupCargoContract();
    if (!active) return;
    const ev = String(eventLabel || '').trim().toLowerCase();
    const compact = String(spokenText || '').trim();
    if (!compact) return;
    if (ev.includes('pickup')) _bushCargoPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushCargoPickupNarrativeMemory.departure = compact;
    else if (ev.includes('verabschiedung')) _bushCargoPickupNarrativeMemory.farewell = compact;
}
  const label = stage.includes('departure') ? 'Rueckflug' : stage === 'arrival' ? 'Anflug' : stage === 'farewell' ? 'Verabschiedung' : 'Pickup';
  if (context.pickupKind === 'passenger') _captureBushPickupNarrativeMemory(label, spokenText);
  else _captureBushCargoPickupNarrativeMemory(label, spokenText);
  return normalizeMemory(memory);
}
return Object.freeze({ weatherContext: _weatherContext, SCHEMA, MAX_MEMORY, normalizeMemory, validateContext, render, continuityHint, captureMemory, evaluateDeparture });
}));
