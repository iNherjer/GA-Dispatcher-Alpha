(function(root) {
    'use strict';
    const SCHEMA = 'private-return.v1';
    const PROFILE = 'private_return';
    const REVISION = 'v1';
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
                && Number(flight.distanceNm) > 0 && flight.distanceSource !== 'planned',
            atTarget: readiness.atTarget === true, groundStill: readiness.groundStill === true};
    }
    function request(md, record, now = Date.now()) {
        if (!source(md) || !record?.completionId || record.missionId !== md.missionId
            || record.result !== 'completed' || record.failed || record.cargo?.failed || md.missionFailed
            || record.privateOutingEvidence?.flown !== true || record.privateOutingEvidence?.atTarget !== true
            || record.privateOutingEvidence?.groundStill !== true) return null;
        const completedAt = Number(record.endedAt);
        if (!Number.isFinite(completedAt) || completedAt <= 0 || now - completedAt >= 14 * 86400000) return null;
        const idea = sourceEpisode(md);
        const home = ref(md.departureAirport) || ref({icao: md.start, name: md.start, lat: md.initialStartLat, lon: md.initialStartLon});
        const target = ref(md.destinationAirport) || ref({icao: md.initialDest || md.dest, name: md.initialTargetName, lat: md.initialTargetLat, lon: md.initialTargetLon});
        if (!home || !target || same(home, target) || !idea.companion?.name || !idea.luggage?.label) return null;
        const original = md.passenger || md.missionContract?.passenger || {};
        if (original.name && original.name !== idea.companion.name) return null;
        // Bounded original contract, not the earlier prose, weather or draft history.
        const outing = Object.fromEntries(['occasion','personalReason','destinationConnection','firstStep'].map(k => [k, text(idea[k]) ]));
        Object.assign(outing, {companion: copy(idea.companion), luggage: copy(idea.luggage),
            episode: copy(idea.episode || {}), groundPlan: copy(idea.groundPlan || {}),
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
            ui: {title: `Gemeinsam zurück nach ${home.name}`, subtitle: `Fortsetzung mit ${passenger.name}`,
                previewText: `${text(idea.occasion, 350)} — Den Aufenthalt erzählen und die Heimreise vorbereiten.`}};
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
Entwickle zuerst experienceRecap: summary fasst das gemeinsame Erlebnis zusammen, moments enthält ein bis drei konkrete Erinnerungen, companionReaction die persönliche Reaktion der Begleitung. Schmücke den Aufenthalt plausibel aus dem ursprünglichen Anlass aus. Die gemeinsame Absicht und der gewählte Ort tragen den Rückblick. Zeitgebundene Pläne bleiben als zeitlicher Bezug erhalten; ohne belegten Abstand keine bestimmte Tageszeit oder Aufenthaltsdauer behaupten.
Schreibe daraus story: locker und persönlich erzählt, mit eigenem Einstieg und natürlichem Satzbau. Das Erlebnis darf Raum bekommen; die Situation führt zur anstehenden Heimreise. Erzähle eine zusammenhängende Fortsetzung, kein weiteres Ausflugsvorhaben und keinen Transportauftrag. Der Text bleibt ein Briefing vor dem Start. greeting ist ein kurzer Satz der Begleitung zum Piloten aus diesem Erlebnis. Keine festgelegte Heimreiseformel.
flightBriefing schließt in zwei bis drei flüssigen Sätzen im selben Ton an. Nutze ausschließlich FLUGDATEN. Zahlen mit Einheiten stehen nur als Referenzen aus WERTE, etwa [[route.distance]]. Vorhandene Entfernung sowie Start-/Zielböen müssen vorkommen. Bezug der Wetterbeobachtungen ist jeweils Start oder Ziel (gegebenenfalls abweichende Station), nicht die ganze Strecke oder eine Vorhersage. Ohne Messwerte benenne die fehlenden Wetterangaben kurz. Nur landscape belegt Landschaft entlang der Route. Über die frühere Flugführung sagen die fiktionalen Erlebnisse nichts aus.
Antworte nur als JSON: {"title":"...","experienceRecap":{"summary":"...","moments":["..."],"companionReaction":"..."},"story":"...","flightBriefing":"...","greeting":{"speaker":"companion","addressee":"pilot","text":"..."}}.
Grenzen in Zeichen: title 160, summary 500, je moment 240, companionReaction 300, story 1800, flightBriefing 850, greeting.text 600.
AUSFLUG: ${JSON.stringify(c)}
WERTE: ${JSON.stringify(episodeApi().flightBindings(flight))}
FLUGDATEN: ${JSON.stringify(flight)}`;
    }
    function prose(raw, c, contract) {
        const r = raw?.experienceRecap;
        const validText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
        if (!validText(raw?.title,160) || !validText(raw?.story,1800) || !validText(r?.summary,500)
            || !validText(r?.companionReaction,300) || !Array.isArray(r?.moments) || r.moments.length < 1 || r.moments.length > 3
            || !r.moments.every(x => validText(x,240)) || raw?.greeting?.speaker !== 'companion'
            || raw.greeting.addressee !== 'pilot' || !validText(raw.greeting.text,600)) return null;
        const checked = episodeApi().prose(raw, {companion:c.outing.companion}, {flightContext:episodeApi().flightContext(contract)});
        const flight = checked?.flightBriefing;
        if (!flight) return null;
        return {title:raw.title.trim(), story:raw.story.trim(), greeting:raw.greeting.text.trim(), flightBriefing:flight,
            continuity:{...copy(c), experienceRecap:copy(r)}};
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
            departure:'Der Rückflug beginnt. Führe den Gedanken vom Boarding weiter.',
            arrival:'Der Anflug auf den Heimatplatz steht bevor. Verbinde einen verbliebenen Eindruck mit dem Ausklang der Reise.',
            landing:'Ihr seid am Heimatplatz gelandet. Kurzes Flugfeedback nur nach den Flugdaten, danach ein passender persönlicher Gedanke.',
            farewell:'Die gemeinsame Reise endet am Heimatplatz. Runde das Erlebnis persönlich ab.'};
        return `PRIVATE HEIMREISE: ${c.visited.name} -> ${c.home.name}. ${directions[stage] || 'Der Aufenthalt liegt hinter euch, der gemeinsame Rückflug ist das aktuelle Flugvorhaben.'} Verbindlicher Erlebnisrückblick: ${JSON.stringify(c.experienceRecap || {plannedOuting:c.outing.occasion, detailStatus:'Kein ausgearbeiteter Erlebnisrückblick vorhanden'})}. Wähle einen passenden Gedanken statt den Rückblick vollständig vorzulesen. An frühere Ansagen inhaltlich anschließen, ohne sie neu zu erzählen. Die Begleitung spricht zum vertrauten Piloten; keine neue Vorstellung und keine bevorstehende Aktivität am alten Ausflugsziel.`;
    }
    const api = {SCHEMA, PROFILE, REVISION, context, source, completionEvidence, ref, same, request, acceptance, pipeline, prompt, prose, mission, voice};
    root.MissionPrivateReturnCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
