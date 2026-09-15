(function(root) {
    'use strict';
    const SCHEMA = 'private-return.v1';
    const PROFILE = 'private_return';
    const REVISION = 'v1.3';
    const text = (s, max = 600) => typeof s === 'string' ? s.trim().slice(0, max) : '';
    const copy = x => JSON.parse(JSON.stringify(x));
    const episodeApi = () => root.MissionPrivateEpisodeV6;
    function context(md = {}) {
        const candidates = [md.privateReturn, md.passenger?.privateReturn, md.missionContract?.privateReturn,
            md.missionContractV4?.privateReturn, md.followUpContext?.privateReturn];
        return candidates.find(x => x?.schema === SCHEMA && x.phase === 'return') || null;
    }
    function ref(raw) {
        if (!raw || typeof raw.lat !== 'number' || typeof raw.lon !== 'number'
            || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)
            || Math.abs(raw.lat) > 90 || Math.abs(raw.lon) > 180) return null;
        const icao = text(raw.icao || raw.ident, 30);
        return icao ? { icao, name: text(raw.name || raw.n || icao, 150), lat: raw.lat, lon: raw.lon,
            elevation: typeof raw.elevation === 'number' ? raw.elevation : null } : null;
    }
    function same(a, b) {
        return !!(a && b && a.icao === b.icao && Math.abs(a.lat - b.lat) < 0.0025 && Math.abs(a.lon - b.lon) < 0.0025);
    }
    function sourceEpisode(md) {
        return md?.privateOuting || md?.missionContract?.privateOuting || md?.missionContractV4?.privateOuting;
    }
    function source(md) {
        const idea = sourceEpisode(md);
        return !!(idea?.schema === 'private-outing.v1' && idea.taskDomain === 'private_outing'
            && !context(md) && !md.followUpRequestId && !md.followUpContinuation && !md.isPOI && !md.bush);
    }
    function completionEvidence(flight = {}, readiness = {}) {
        return {flown: Number(flight.durationSec) >= 15 && Number(flight.telemetrySampleCount) >= 2
                && Number(flight.distanceNm) > 0 && flight.distanceSource !== 'planned'
                && (!flight.simulated || (flight.distanceSource === 'sim-track' && flight.hasAirborneEvidence === true)),
            atTarget: readiness.atTarget === true, groundStill: readiness.groundStill === true};
    }
    function request(md, record, now = Date.now()) {
        if (!source(md) || !record?.completionId || record.missionId !== md.missionId
            || record.result !== 'completed' || record.failed || record.cargo?.failed || md.missionFailed
            || record.privateOutingEvidence?.flown !== true || record.privateOutingEvidence?.atTarget !== true
            || record.privateOutingEvidence?.groundStill !== true) return null;
        return buildRequest(md, record, now);
    }
    // Explicit debug entry; normal completion never accepts a debug flag as flight evidence.
    function debugRequest(md, now = Date.now()) {
        if (!source(md) || !text(md.missionId, 100)) return null;
        const req = buildRequest(md, {completionId: `debug-${md.missionId}`, endedAt: now}, now);
        if (!req) return null;
        req.id = req.dedupeKey = `private-return-debug-${md.missionId}`;
        req.debugGenerated = true;
        req.privateReturn.debugCompletion = true;
        req.ui.subtitle = 'Testfortsetzung – kein geflogener Hinflug';
        return req;
    }
    function buildRequest(md, record, now) {
        const completedAt = Number(record.endedAt);
        if (!Number.isFinite(completedAt) || completedAt <= 0 || now - completedAt >= 14 * 86400000) return null;
        const idea = sourceEpisode(md);
        const home = ref(md.departureAirport) || ref({icao: md.start, name: md.start, lat: md.initialStartLat, lon: md.initialStartLon});
        const target = ref(md.destinationAirport) || ref({icao: md.initialDest || md.dest, name: md.initialTargetName, lat: md.initialTargetLat, lon: md.initialTargetLon});
        if (!home || !target || same(home, target) || !idea.companion?.name || !idea.luggage?.label) return null;
        const original = md.passenger || md.missionContract?.passenger || {};
        if (original.name && original.name !== idea.companion.name) return null;
        // Bounded original contract, not the earlier prose, weather or draft history.
        const outing = Object.fromEntries(['occasion','personalReason','destinationConnection','firstStep','returnOfferText'].map(k => [k, text(idea[k]) ]));
        Object.assign(outing, {companion: copy(idea.companion), luggage: copy(idea.luggage),
            origin: copy(idea.origin || null), episode: copy(idea.episode || {}), groundPlan: copy(idea.groundPlan || {}),
            eventVisit: copy(idea.eventVisit || null), pilotIntent: text(idea.pilotIntent, 200), companionIntent: text(idea.companionIntent, 200)});
        const passenger = Object.fromEntries(['name','role','gender','personality','gTolerance','bankTolerance','cargoSensitivity',
            'stomachSensitivity','comfortPriority','urgencyPriority','voiceId','voiceName','geminiVoice','openaiVoice'].map(k => [k, text(original[k], 160)]));
        Object.assign(passenger, {name: idea.companion.name, role: idea.companion.relationship,
            gender: idea.companion.gender, personality: idea.companion.personality,
            roleProfile: 'general_passenger_v1', taskDomain: PROFILE});
        const continuity = {schema: SCHEMA, phase: 'return', sourceMissionId: md.missionId,
            sourceCompletionId: record.completionId, completedAt: record.endedAt || now,
            home, visited: target, outing, experienceRecap: null,
            voiceIdentity: `${original.name || idea.companion.name}|${original.role || idea.companion.relationship}|${original.roleProfile || 'general_passenger_v1'}|${original.taskDomain || 'private_outing'}`};
        if (JSON.stringify(continuity).length > 10000) return null;
        const id = `private-return-${md.missionId}`;
        return {schema: 'ga.followup.request.v1', id, dedupeKey: id, sourceMissionId: md.missionId,
            sourceKind: 'private_outing', sourceLabel: 'Privater Ausflug', followUpKind: PROFILE,
            followUpProfileId: PROFILE, followUpCategory: 'private', followUpLabel: 'Private Heimreise',
            status: 'pending', createdAt: now, updatedAt: now, eligibleAt: now, expiresAt: completedAt + 14 * 86400000,
            pilotStartPolicy: 'onsite_to_home', route: {homeRef: home, targetRef: target},
            passenger, privateReturn: continuity,
            source: {title: text(md.mission, 180), completedAt: record.endedAt || now},
            ui: offerUi(continuity)};
    }
    function offerUi(c) {
        return {title: `Rückflug von ${c.visited.name} nach ${c.home.name}`,
            subtitle: c.debugCompletion ? 'Testfortsetzung – kein geflogener Hinflug' : `Heimreise mit ${c.outing.companion.name}`,
            previewText: text(c.outing.returnOfferText, 350)
                || `Dein Ausflug mit ${c.outing.companion.name} liegt hinter euch. Jetzt geht es gemeinsam wieder nach Hause.`};
    }

    function acceptance(req, start) {
        const c = context(req), home = ref(req?.route?.homeRef), target = ref(req?.route?.targetRef);
        if (!c || !home || !target || !same(home, ref(c.home)) || !same(target, ref(c.visited)) || !same(ref(start), target)) return null;
        return {schema:'ga.followup.acceptance.v1', mode:'onsite_to_home', dispatchProfileId:PROFILE,
            originalFollowUpKind:PROFILE, startRef:target, targetRef:target, returnHomeRef:home, createdAt:Date.now()};
    }
    function pipeline(req, ctx = {}) {
        const a = acceptance(req, ctx.start ? ref(ctx.start) : req?.acceptance?.startRef);
        if (!a || (ctx.dest && !same(ref(ctx.dest), a.returnHomeRef))) return null;
        return {schema:'ga.followup.pipelineContext.v1', requestId:req.id, sourceKind:'private_outing',
            followUpKind:PROFILE, effectiveProfileId:PROFILE, acceptanceMode:'onsite_to_home',
            privateReturn:copy(req.privateReturn), lockedPassenger:copy(req.passenger),
            route:{startRef:a.startRef, returnHomeRef:a.returnHomeRef, targetRef:a.targetRef,
                departureName:a.startRef.name, homeName:a.returnHomeRef.name, targetName:a.returnHomeRef.name},
            storyFrame:{trigger:'Gemeinsame Heimreise nach dem privaten Aufenthalt.',
                incidentContext:req.privateReturn.outing.occasion,
                soughtOutcome:`Gemeinsam nach ${a.returnHomeRef.name} zurückkehren.`}};
    }
    function prompt(c, contract) {
        const flight = episodeApi().flightContext(contract);
        return `Du schreibst ein persönliches Vorflugbriefing für eine private Heimreise. Beide haben den in AUSFLUG beschriebenen Aufenthalt gemeinsam erlebt. Der Hinflug ist abgeschlossen; der Aufenthalt ist erzählte Fiktion, der Rückflug steht noch bevor. Der Pilot ist der Spieler (du), sein Name ist nicht bekannt. Die Begleitung bleibt dieselbe Person mit derselben Beziehung.
Erzählperspektive nach Feld: story und flightBriefing stammen von einem außenstehenden Erzähler, der selbst nicht mitreist. Er spricht den Spieler als du an, beide Reisenden als ihr/euch und erzählt über die Begleitung mit ihrem Namen oder er/sie. Er bleibt auch beim Rückblick außerhalb der Figuren: keine Ich-/Wir-Erzählung und kein Gespräch des Piloten mit der Begleitung. Nähe entsteht durch konkrete gemeinsame Erinnerungen und persönliche Beobachtungen. experienceRecap ist die gemeinsame Datengrundlage: summary, moments und companionReaction beschreiben die beiden in dritter Person als Pilot und Begleitung, nicht als gesprochenen Monolog. Nur greeting.text ist direkte Rede der Begleitung an den Piloten; dort sind ich und wir passend. Diese Feldrollen bleiben beim Übertragen des Rückblicks in Briefing und Begrüßung erhalten.
Entwickle zuerst experienceRecap: summary fasst das gemeinsame Erlebnis zusammen, moments enthält zwei bis drei inhaltlich unterschiedliche kleine Begebenheiten aus dem gemeinsamen Aufenthalt: jeweils was konkret geschah oder auffiel und wie einer der beiden darauf reagierte. Eine Begebenheit soll weitererzählbar sein und nicht nur die allgemeine Stimmung bewerten. Erfinde dazu plausible persönliche Details, die zu diesen Menschen, dem Anlass und dem Ort passen. Auch ein unspektakulärer Ausflug liefert Gesprächsstoff; künstliche Dramatik ist unnötig. companionReaction beschreibt, was gerade diese Begleitung daran persönlich beschäftigt oder amüsiert hat. Die Erinnerungen bilden gemeinsam einen konsistenten Aufenthalt, nicht mehrere Umschreibungen desselben Eindrucks. Schmücke den Aufenthalt plausibel aus dem ursprünglichen Anlass aus. Die gemeinsame Absicht und der gewählte Ort tragen den Rückblick. Zeitgebundene Pläne bleiben als zeitlicher Bezug erhalten; ohne belegten Abstand keine bestimmte Tageszeit oder Aufenthaltsdauer behaupten.
Schreibe daraus story: locker und persönlich erzählt, mit eigenem Einstieg und natürlichem Satzbau. Greife einen Teil des Erlebnisses auf und lasse Raum für weitere Erinnerungen im späteren Gespräch; das Briefing muss nicht alle moments vorwegnehmen. Die Situation führt zur anstehenden Heimreise. Erzähle eine zusammenhängende Fortsetzung, kein weiteres Ausflugsvorhaben und keinen Transportauftrag. Der Text bleibt ein Briefing vor dem Start. greeting ist ein kurzer Satz der Begleitung zum Piloten aus diesem Erlebnis. Keine festgelegte Heimreiseformel.
flightBriefing schließt in zwei bis drei flüssigen Sätzen im selben Ton an. Nutze ausschließlich FLUGDATEN. Alle Werte aus WERTE werden mit ihrem exakten Schlüssel in doppelten eckigen Klammern eingesetzt, etwa [[route.distance]]. Die Referenz enthält die Einheit bereits. Außerhalb dieser Referenzen keine Ziffern oder eckigen Klammern verwenden; auch Stationskennungen mit Ziffern als vorhandene Stationsreferenz einsetzen. Keine unbekannten Referenzen erfinden. Vorhandene Entfernung sowie Start-/Zielböen müssen vorkommen. Bezug der Wetterbeobachtungen ist jeweils Start oder Ziel (gegebenenfalls abweichende Station), nicht die ganze Strecke oder eine Vorhersage. Fehlende Messwerte bleiben unbekannt. Benenne die Lücke kurz als noch offene Wetterprüfung vor dem Start; leite daraus weder gute Flugbedingungen noch eine Entscheidung zum Fliegen ab. Eine nicht gemeldete Böenangabe belegt keine Böenfreiheit. Wetterbewertungen gehören ausschließlich in flightBriefing; die fiktionale story beschreibt dafür keine eigenen Bedingungen. Nur landscape belegt Landschaft entlang der Route. Über die frühere Flugführung sagen die fiktionalen Erlebnisse nichts aus.
Antworte nur als JSON: {"title":"...","experienceRecap":{"summary":"...","moments":["..."],"companionReaction":"..."},"story":"...","flightBriefing":"...","greeting":{"speaker":"companion","addressee":"pilot","text":"..."}}.
Grenzen in Zeichen: title 160, summary 500, je moment 240, companionReaction 300, story 1800, flightBriefing 850, greeting.text 600.
AUSFLUG: ${JSON.stringify(c)}
WERTE: ${JSON.stringify(episodeApi().flightBindings(flight))}
FLUGDATEN: ${JSON.stringify(flight)}`;
    }
    function validateProse(raw, c, contract) {
        const errors = [];
        const validText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
        for (const [path, value, max] of [
            ['title',raw?.title,160], ['story',raw?.story,1800],
            ['experienceRecap.summary',raw?.experienceRecap?.summary,500],
            ['experienceRecap.companionReaction',raw?.experienceRecap?.companionReaction,300],
            ['greeting.text',raw?.greeting?.text,600]]) {
            if (!validText(value,max)) errors.push(path + ':missing_or_length');
        }
        const r = raw?.experienceRecap;
        // Supplemental anecdotes may fail independently of the required recap and briefing.
        const momentInput = Array.isArray(r?.moments) ? r.moments : [];
        const moments = momentInput.filter(x => validText(x,240)).slice(0,3).map(x => x.trim());
        const warnings = (!Array.isArray(r?.moments) || !moments.length || moments.length !== momentInput.length)
            ? ['experienceRecap.moments:discarded_invalid_or_excess'] : [];
        const momentDiagnostics = {type: Array.isArray(r?.moments) ? 'array' : typeof r?.moments,
            count: momentInput.length, kept: moments.length,
            entries: momentInput.slice(0,8).map(x => ({type:typeof x, length:typeof x === 'string' ? x.length : null}))};
        // Same identity alias as the V6 writer; never accept an unrelated speaker.
        const speaker = raw?.greeting?.speaker;
        const namedCompanion = typeof speaker === 'string' && speaker.trim().toLowerCase()
            === c.outing.companion.name.trim().toLowerCase();
        if (speaker !== 'companion' && !namedCompanion) errors.push('greeting.speaker:invalid');
        if (raw?.greeting?.addressee !== 'pilot') errors.push('greeting.addressee:invalid');
        if (/[{}]|```/.test(String(raw?.story || '') + String(raw?.greeting?.text || ''))) errors.push('story_or_greeting:format');
        const flightContext = episodeApi().flightContext(contract);
        const flight = episodeApi().resolveFlightBriefing(raw?.flightBriefing, flightContext);
        if (!flight) errors.push('flightBriefing:invalid_bindings_or_length');
        if (errors.length) return {accepted:false, errors, warnings, momentDiagnostics, prose:null};
        return {accepted:true, errors:[], warnings, momentDiagnostics, prose:{title:raw.title.trim(), story:raw.story.trim(),
            greeting:raw.greeting.text.trim(), flightBriefing:flight,
            continuity:{...copy(c), experienceRecap:{...copy(r), moments}}}};
    }
    function prose(raw, c, contract) {
        return validateProse(raw, c, contract).prose;
    }
    function mission(req, ctx = {}, written = null) {
        const p = pipeline(req, ctx);
        if (!p) return null;
        const c = written?.continuity || p.privateReturn;
        const passenger = {...req.passenger, privateReturn:c, targetAltFt:0, targetRadiusNm:0, targetDwellMin:0,
            storySeed:written?.continuity?.experienceRecap?.summary || '', personalStoryCue:written?.continuity?.experienceRecap?.companionReaction || '',
            greetingText:written?.greeting || 'Schön, dass wir zusammen unterwegs sind.'};
        const cargo = `${c.outing.luggage.label} (${c.outing.luggage.weightLbs} lbs)`;
        const pax = `1 PAX (${passenger.role})`;
        // Offline/failed prose never substitutes an unrelated activity or fabricates an experience.
        const story = written ? `${written.story}\n\n${written.flightBriefing}`
            : `Ihr bereitet mit ${passenger.name} die gemeinsame Heimreise von ${c.visited.name} nach ${c.home.name} vor. Euer Ausflugsplan: ${c.outing.occasion}`;
        return {mission:{t:written?.title || `Gemeinsam zurück nach ${c.home.name}`, s:story, story, missionStory:story,
            i:'📋', cat:'private', missionType:'apt', profileId:PROFILE, _requestedProfile:PROFILE, _appliedProfile:PROFILE,
            passenger, pax, cargo, cargoText:cargo, privateReturn:c, followUpContext:{...p, privateReturn:c},
            followUpRequestId:req.id, followUpContinuation:{sourceMissionId:c.sourceMissionId, followUpKind:PROFILE},
            sceneIntent:{summary:'Privater A-B-Rückflug ohne Zielszene.',visibleIdeas:[],avoid:[],densityHint:'none'},
            _source:written ? 'Private Return Writer V1' : 'Private Return (ohne KI-Rückblick)'}, paxText:pax, cargoText:cargo, dataSource:'Private Return'};
    }
    function voice(c, stage = 'context') {
        if (!c || c.schema !== SCHEMA) return '';
        const directions = {boarding:'Vor dem Start: Greife eine persönliche Erinnerung auf; ihr seid gemeinsam zurück am Flugzeug.',
            departure:'Der Rückflug beginnt. Erzähle einen bisher nicht ausgeführten Moment des Aufenthalts weiter.',
            arrival:'Der Anflug auf den Heimatplatz steht bevor. Wenn Raum für einen Rückblick bleibt, greife ein noch nicht erzähltes konkretes Detail kurz auf.',
            landing:'Ihr seid am Heimatplatz gelandet. Kurzes Flugfeedback nur nach den Flugdaten, danach ein passender persönlicher Gedanke.',
            farewell:'Die gemeinsame Reise endet am Heimatplatz. Verabschiede dich persönlich mit einem konkreten Bezug zum gemeinsamen Aufenthalt; bereits gegebenes Flugfeedback braucht keine erneute Bewertung.'};
        return `PRIVATE HEIMREISE: ${c.visited.name} -> ${c.home.name}. ${directions[stage] || 'Der Aufenthalt liegt hinter euch, der gemeinsame Rückflug ist das aktuelle Flugvorhaben.'} Verbindlicher Erlebnisrückblick: ${JSON.stringify(c.experienceRecap || {plannedOuting:c.outing.occasion, detailStatus:'Kein ausgearbeiteter Erlebnisrückblick vorhanden'})}. Erzähle wie unter Vertrauten aus dem gemeinsam Erlebten. Wähle für diese Ansage einen konkreten, noch nicht ausgeführten Moment und erzähle dazu eine kleine Beobachtung, Handlung oder persönliche Reaktion. Plausible fiktive Einzelheiten des Aufenthalts darfst du frei ergänzen, auch wenn ein älterer Rückblick nur Stimmung enthält. Sie müssen zu Anlass, Personen, Ort und bereits erzählten Begebenheiten passen; feststehende Ereignisse und Reaktionen bleiben erhalten. Solche persönlichen Ausschmückungen sind keine Quelle für neue historische Ortsfakten, reale Flugereignisse oder eine erfundene gemeinsame Flugvergangenheit. Vergleiche mit den bereits ausgegebenen Texten: Ein neuer Gedanke fügt etwas zum Erlebnis hinzu, statt dieselbe Stimmung anders auszudrücken. Ein Rückbezug darf kurz verbinden, der übrige Inhalt führt weiter. Persönlichkeit bestimmt die Art des Erzählens, nicht ein ständig wiederkehrendes Thema. Halte die Länge und Aufmerksamkeit der aktuellen Flugphase ein; bei notwendigem Flugfeedback hat dieses Vorrang vor der Anekdote. Die Begleitung spricht zum vertrauten Piloten; keine neue Vorstellung und keine bevorstehende Aktivität am alten Ausflugsziel.`;
    }
    const api = {SCHEMA, PROFILE, REVISION, context, source, completionEvidence, ref, same, request, debugRequest, acceptance, pipeline, prompt, validateProse, prose, mission, voice, offerUi};
    root.MissionPrivateReturnCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
