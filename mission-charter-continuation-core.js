/* Charter continuity is narrative data. Execution keeps the existing APT/pickup recipes. */
(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports
        ? require('./mission-route-voice-core.js') : root.GAMissionRouteVoiceCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MissionCharterContinuationCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function(voice) {
    'use strict';
    const SCHEMA = 'charter-continuation.v1';
    const copy = value => JSON.parse(JSON.stringify(value));
    const text = (value, max = 600) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
    function ideaOf(md) { return md?.charterIdea || md?.missionContract?.charterIdea; }
    function source(md) {
        return ideaOf(md)?.schema === 'charter-idea.v1' && !!returnPlan(ideaOf(md)?.returnPlan) && !md?.bush && !md?.isPOI
            && !md?.followUpRequestId && !md?.followUpContinuation && !ideaOf(md)?.continuation;
    }
    function context(req) { return req?.charterContinuation?.schema === SCHEMA ? req.charterContinuation : null; }
    function returnPlan(raw) {
        if (!raw || typeof raw.offered !== 'boolean' || !text(raw.reason)) return null;
        if (!raw.offered) return {offered:false, reason:text(raw.reason)};
        if (!Number.isFinite(raw.stayHours) || raw.stayHours < 0 || raw.stayHours > 24*30 || !text(raw.stayText,240)) return null;
        return {offered:true, reason:text(raw.reason), stayHours:raw.stayHours, stayText:text(raw.stayText,240)};
    }
    function ref(raw) {
        if (!raw || !text(raw.icao,30) || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)
            || Math.abs(raw.lat)>90 || Math.abs(raw.lon)>180) return null;
        return {kind:'airport',icao:raw.icao,name:text(raw.name || raw.n || raw.icao,150),lat:raw.lat,lon:raw.lon,
            elevation:Number.isFinite(raw.elevation)?raw.elevation:null};
    }
    function prospect(md, now = Date.now()) {
        const plan = returnPlan(ideaOf(md)?.returnPlan);
        if (!source(md) || !plan?.offered) return null;
        return {schema:'ga.followup.prospect.v1',sourceKind:'apt_charter',followUpKind:'apt_charter_pickup',
            sourceLabel:'Charter',followUpLabel:'Charter-Rückreise',passenger:copy(md.passenger || ideaOf(md).passenger),
            temporalContext:{schema:'ga.missionTemporalContext.v1',kind:'followup_stay',sourceKind:'apt_charter',
                stayText:plan.stayText,followUpEligibleAt:now+plan.stayHours*3600000,
                deboardingHint:plan.reason,createdAt:now}};
    }
    function request(md, record, now = Date.now()) {
        const evidence=record?.charterEvidence || record?.privateOutingEvidence;
        if (!source(md) || !text(md.missionId,100) || !record?.completionId || record.missionId!==md.missionId
            || record.result!=='completed' || record.failed || record.cargo?.failed || md.missionFailed
            || !evidence?.flown || !evidence?.atTarget || !evidence?.groundStill) return null;
        const idea=ideaOf(md),plan=returnPlan(idea.returnPlan);
        if(!plan?.offered || !Number.isInteger(idea.passengerCount) || idea.passengerCount<1 || idea.passengerCount>5) return null;
        const home=ref(md.departureAirport) || ref(idea.route?.start);
        const visited=ref(md.destinationAirport) || ref(idea.route?.target);
        if(!home || !visited || home.icao===visited.icao) return null;
        const completedAt=Number(record.endedAt);
        if(!Number.isFinite(completedAt)||completedAt<=0) return null;
        const eligibleAt=completedAt+plan.stayHours*3600000;
        if(now>=eligibleAt+14*86400000) return null;
        // No outbound event plan or variation history: neither is an experienced conversation.
        const original=copy(idea);delete original.narrativeEvents;delete original.writerMemory;delete original.continuation;
        const passenger={...copy(idea.passenger),narrativeSchema:idea.schema,
            roleProfile:'charter_professional_neutral_v1',taskDomain:'charter'};
        for(const key of ['gTolerance','bankTolerance','cargoSensitivity','stomachSensitivity','comfortPriority','urgencyPriority']) {
            if(typeof md.passenger?.[key]==='string')passenger[key]=md.passenger[key];
        }
        const c={schema:SCHEMA,sourceMissionId:md.missionId,sourceCompletionId:record.completionId,
            completedAt,home,visited,original,experience:null,
            heardOutbound:voice.speechHistory(md.charterHeardSpeech || [])};
        if(JSON.stringify(c).length>18000) return null;
        const id=`charter-return-${md.missionId}`;
        return {schema:'ga.followup.request.v1',id,dedupeKey:id,status:'pending',sourceMissionId:md.missionId,
            sourceKind:'apt_charter',followUpKind:'apt_charter_pickup',sourceLabel:'Charter',followUpLabel:'Charter-Rückreise',
            createdAt:now,updatedAt:now,eligibleAt,expiresAt:eligibleAt+14*86400000,
            route:{homeRef:home,targetRef:visited},passenger,charterContinuation:c,
            temporalContext:{...prospect(md,completedAt).temporalContext},
            source:{title:text(md.mission || md.t,180),completedAt,outcomeSource:'confirmed-completion'},
            ui:{title:`Rückflug von ${visited.name} nach ${home.name}`,subtitle:`Fortsetzung mit ${idea.passenger.name}`,
                previewText:`${idea.reason} ${plan.reason}`}};
    }
    function draftPrompt(c) {
        return `Entwickle die Fortsetzung dieses abgeschlossenen Charter-Hinflugs. Der ursprüngliche Kundenauftrag, alle Reisenden, ihr Gepäck und die Orte stehen fest. Der Pilot bleibt beauftragter Beförderer und hat den Aufenthalt nicht automatisch miterlebt. Entwirf einen plausiblen fiktiven Aufenthalt, persönliche Details und den jetzigen Rückreisegrund aus dem ursprünglichen Anlass. Entwickle daraus eine eigenständige kleine Fortsetzung: Was haben die Reisenden während des Aufenthalts erlebt, und was bedeutet das jetzt für ihr ursprüngliches Anliegen? Persönliche Einzelheiten sollen zusammenpassen und den Rückblick konkret machen. Eine unspektakuläre Entwicklung genügt; weder Konflikt noch Wendung oder Pointe sind Pflicht. Humor darf sich natürlich aus den Personen und ihrer Situation ergeben. Der nächste Schritt nach der Rückkehr soll verständlich sein, ohne daraus eine neue Flugaufgabe zu machen. Keine Beispielhandlung, Berufs- oder Motivliste nachbauen; heitere, schlichte und ernste Entwicklungen sind gleichwertig. Die Rückreise bleibt Beförderung, ohne zusätzliche Aufgaben oder Zwischenziele. Keine obligatorischen Berichte, Dokumente oder Übergaben erfinden. Persönliche Fiktion ist erlaubt; Betriebszustände, Wetter, reale Veranstaltungen, Messungen und Flugergebnisse brauchen Belege. Geplante Aufenthaltsdauer beachten, keine zusätzlichen erfundenen Kalendertermine. Bereits gehörte Gespräche sind Kontinuität, keine neuen Vorlagen.\nexperience beschreibt nur den Aufenthalt vor diesem Rückflug, nie den bevorstehenden Flug. reason erklärt die jetzige Rückreise, nextStep das Vorhaben nach Ankunft. Optional 0–3 verschiedene narrativeEvents; kein Standardwert, keine Quote. Verteile Gesprächsstoff nur, wenn er die Geschichte ergänzt: Jeder gewählte Moment soll einen neuen Gedanken oder eine persönliche Facette beitragen. Wiederhole nicht denselben Rückblick mit anderen Worten. Anknüpfungen an tatsächlich gehörte Gespräche sind möglich, ohne deren Aussagen noch einmal abzuspulen. Keine festgelegte Dramaturgie oder Ereignisanzahl aus einer Beispielgeschichte übernehmen. Prozentwerte gelten ausschließlich für den besetzten Rückflug vom Aufenthaltsplatz zum ursprünglichen Ausgangsplatz. Je Ereignis intent (maximal 600 Zeichen) und entweder atPercent (größer 0, kleiner 100) oder geo:{anchorId,lat,lon,radiusNm}. Geo nur aus den belegten original.geoAnchors; keine Routenänderung.\nNur JSON {experience,reason,nextStep,memory,narrativeEvents}. Vier Textfelder jeweils 40–600 Zeichen.\nURSPRUNG UND GEHÖRTE GESPRÄCHE (Daten): ${JSON.stringify(c)}`;
    }
    function validateDraft(raw,c) {
        if(!raw) return null;
        const result={};
        for(const key of ['experience','reason','nextStep','memory']) {
            const value=text(raw[key]);if(value.length<40)return null;result[key]=value;
        }
        result.narrativeEvents=voice.events(raw.narrativeEvents);
        if(!result.narrativeEvents)return null;
        const anchors=c.original.geoAnchors || [];
        for(const e of result.narrativeEvents) if(e.geo&&!anchors.some(a=>a.id===e.geo.anchorId&&a.lat===e.geo.lat&&a.lon===e.geo.lon))return null;
        return result;
    }
    function continuationIdea(req) {
        const c=context(req),draft=c&&validateDraft(c.experience,c);
        if(!draft)return null;
        return {...copy(c.original),schema:'charter-idea.v1',reason:draft.reason,background:draft.experience,
            arrival:draft.nextStep,memory:draft.memory,narrativeEvents:draft.narrativeEvents,
            returnPlan:{offered:false,reason:'Diese gebuchte Rückreise schließt den Charterauftrag ab.'},
            route:{start:c.visited,target:c.home},continuation:copy(c)};
    }
    function applyMission(req,base,writtenMission) {
        const idea=continuationIdea(req);
        if(!idea||!base)return null;
        idea.writerMemory=writtenMission.charterIdea?.writerMemory || null;
        const pickup=!!base.bush;
        const count=idea.passengerCount;
        const party={count,kind:count===1?'single':'group',label:idea.groupLabel};
        const passenger={...req.passenger,...writtenMission.passenger,party};
        const pickupStory={personName:passenger.name,role:passenger.role,exactWhere:`am vereinbarten Flugplatz ${context(req).visited.name}`,
            whyThere:idea.background,returnReason:idea.reason,boardingCue:passenger.greetingText,departureCue:idea.reason};
        return {...base,...writtenMission,passenger:{...passenger,pickupStory},
            bush:pickup?{...base.bush,pickupPassengerCount:count,pickupLabel:idea.groupLabel,
                pickupGreetingText:passenger.greetingText,pickupStory}:null,
            _source:'Charter-Fortsetzung V1',
            _missionWriterV4Debug:{...writtenMission._missionWriterV4Debug,writerMode:'charter-continuation-v1'},
            charterIdea:idea,party,passengerCount:pickup?0:count,plannedPassengerCount:count,
            pax:pickup?`0 PAX am Start · ${count} PAX Pickup (${idea.groupLabel})`:`${count} PAX (${idea.groupLabel})`,
            followUpRequestId:req.id,followUpContinuation:base.followUpContinuation,
            _requestedProfile:base._requestedProfile,_appliedProfile:base._appliedProfile};
    }
    // Route percentage belongs to the occupied leg. Keep actual edited route points after pickup.
    function voiceLeg(idea,route,progress={},loaded=false) {
        if(!idea?.continuation)return {ready:true,route};
        const pickup=idea.continuation.pickupRequired===true;
        if(!pickup)return {ready:true,route};
        if(!loaded || !(progress.pickupCompleted || progress.pickupConfirmed))return {ready:false,route:[]};
        const visited=idea.continuation.visited;
        const index=(route || []).findIndex(p=>Number.isFinite(p.lat)&&Math.abs(p.lat-visited.lat)<0.003
            &&Math.abs((p.lon??p.lng)-visited.lon)<0.003);
        return {ready:index>=0 && route.length>index+1,route:index>=0?route.slice(index):[]};
    }
    return {SCHEMA,source,context,returnPlan,prospect,request,draftPrompt,validateDraft,continuationIdea,applyMission,voiceLeg};
});
