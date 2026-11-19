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
    // English outbound mission (outputLanguage 'en'): the stay retrospective is written in English as well.
    const outLang = () => (typeof module === 'object' && module.exports ? require('./mission-output-language.js') : (typeof window !== 'undefined' ? window.MissionOutputLanguage : null));
    const englishDirective = c => (c && c.outputLanguage === 'en' && outLang() ? outLang().DIRECTIVE : '');
    function ideaOf(md) { return md?.charterIdea || md?.missionContract?.charterIdea || md?.aptNewsIdea || md?.missionContract?.aptNewsIdea; }
    function source(md) {
        return ['charter-idea.v1','apt-news-idea.v1'].includes(ideaOf(md)?.schema) && !!returnPlan(ideaOf(md)?.returnPlan) && !md?.bush && !md?.isPOI
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
            sourceLabel:ideaOf(md)?.schema==='apt-news-idea.v1'?'Reporter':'Charter',followUpLabel:ideaOf(md)?.schema==='apt-news-idea.v1'?'Reporter-Rückreise':'Charter-Rückreise',passenger:copy(md.passenger || ideaOf(md).passenger),
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
            roleProfile:idea.schema==='apt-news-idea.v1'?'news_reporter_professional_v1':'charter_professional_neutral_v1',taskDomain:idea.schema==='apt-news-idea.v1'?'news_coverage':'charter'};
        for(const key of ['gTolerance','bankTolerance','cargoSensitivity','stomachSensitivity','comfortPriority','urgencyPriority']) {
            if(typeof md.passenger?.[key]==='string')passenger[key]=md.passenger[key];
        }
        const c={schema:SCHEMA,sourceMissionId:md.missionId,sourceCompletionId:record.completionId,
            completedAt,home,visited,original,experience:null,
            heardOutbound:voice.speechHistory(md.charterHeardSpeech || []),
            ...(md.outputLanguage==='en'?{outputLanguage:'en'}:{})};
        if(JSON.stringify(c).length>18000) return null;
        const id=`charter-return-${md.missionId}`;
        return {schema:'ga.followup.request.v1',id,dedupeKey:id,status:'pending',sourceMissionId:md.missionId,
            sourceKind:'apt_charter',followUpKind:'apt_charter_pickup',sourceLabel:ideaOf(md)?.schema==='apt-news-idea.v1'?'Reporter':'Charter',followUpLabel:ideaOf(md)?.schema==='apt-news-idea.v1'?'Reporter-Rückreise':'Charter-Rückreise',
            createdAt:now,updatedAt:now,eligibleAt,expiresAt:eligibleAt+14*86400000,
            route:{homeRef:home,targetRef:visited},passenger,charterContinuation:c,
            temporalContext:{...prospect(md,completedAt).temporalContext},
            source:{title:text(md.mission || md.t,180),completedAt,outcomeSource:'confirmed-completion'},
            ui:{title:`Rückflug von ${visited.name} nach ${home.name}`,subtitle:`Fortsetzung mit ${idea.passenger.name}`,
                previewText:offerPreview(c)}};
    }
    // A period after a title, a common abbreviation, an initial or an ordinal ("Dr.", "z. B.", "3.") ends no sentence.
    const NO_SENTENCE_END=/(?:^|[\s(])(?:Dr|Prof|St|Nr|Hr|Fr|ca|bzw|vgl|inkl|evtl|ggf|bspw|Mio|Mrd|Std|Min|[A-Za-zÄÖÜäöü]|\d+)\.\s*$/;
    function wholeSentences(value,max) {
        const pieces=String(value||'').replace(/\s+/g,' ').trim().match(/[^.!?]+[.!?]+(?:\s|$)/g)||[];
        const sentences=[];let pending='';
        for(const piece of pieces){pending+=piece;if(!NO_SENTENCE_END.test(pending)){sentences.push(pending);pending='';}}
        let out='';
        for(const sentence of sentences){if((out+sentence).trim().length>max)break;out+=sentence;}
        return out.trim().length>=40?out.trim():'';
    }
    // Card text before the return story exists: past stay, current request. Never the outbound purpose.
    function offerPreview(c) {
        if(!c?.home?.name || !c?.visited?.name)return '';
        const written=c.experience&&validateDraft(c.experience,c);
        if(written?.offerText)return written.offerText;
        // Stays written before offerText existed: their return reason already looks back on the stay.
        const reason=written&&wholeSentences(written.reason,350);
        if(reason)return reason;
        const name=text(c.original?.passenger?.name,80) || (c.original?.schema==='apt-news-idea.v1'?'Die Reporterin bzw. der Reporter':'Der Chartergast');
        if(c.original?.schema==='apt-news-idea.v1')
            return `${name} hat die Recherche in ${c.visited.name} abgeschlossen und bittet um den Rückflug nach ${c.home.name}.`;
        const group=Number.isInteger(c.original?.passengerCount)&&c.original.passengerCount>1;
        return group
            ? `${name} und die Mitreisenden haben ihren Aufenthalt in ${c.visited.name} hinter sich und bitten um den Rückflug nach ${c.home.name}.`
            : `${name} hat den Aufenthalt in ${c.visited.name} hinter sich und bittet um den Rückflug nach ${c.home.name}.`;
    }
    const OFFER_TEXT_RULE='offerText ist der kurze Vorschautext der Rückflug-Anfrage (40–350 Zeichen, ein bis zwei Sätze): außenstehende Disposition in der dritten Person, der Aufenthalt ist vorbei. Blicke mit einem konkreten Eindruck aus experience darauf zurück und leite zur Bitte um den Rückflug über. Nicht den ursprünglichen Reisegrund als noch bevorstehend wiederholen.';
    function draftPrompt(c) { return draftPromptGerman(c) + englishDirective(c); }
    function draftPromptGerman(c) {
        const narrativeTiming = 'Der Rückflug ist bereits beauftragt; erzähle das persönliche Anliegen und die Entwicklung am Ziel, ohne die Flugwahl gegenüber einer Straßenfahrt zu rechtfertigen. original.returnPlan.stayHours ist die interne Terminplanung. Beschreibe denselben Aufenthalt natürlich und ungefähr aus stayText, ohne präzise Stundenangaben oder einen erfundenen fachlichen Mindestbedarf. Der Zeitraum trägt die Entwicklung der Geschichte, kein Ereignis pro Stunde oder Tag.';
        if(c.original.schema==='apt-news-idea.v1')return `Entwickle einen gespeicherten fiktiven Aufenthalt für die Rückreise desselben Reporters. Identität, Redaktion, Ausrüstung, Ort und ursprüngliche journalistische Frage bleiben erhalten. Berichte konkret von Gesprächen, menschlichen Szenen, unterschiedlichen Sichtweisen und aufgenommenem Material am Boden. Keine reale Nachricht oder Behauptung über reale Betreiber erfinden. Die Vorgeschichte ist fiktiv; eine überraschende Enthüllung ist nicht Pflicht. Trage den Ton aus original.character und original.memory weiter. Auch bei einem professionellen Auftrag darf während des Aufenthalts etwas wirklich Lustiges passiert sein: konkrete menschliche Pannen, Missverständnisse oder überraschende Improvisation dürfen eine kleine glaubwürdige Geschichte tragen. Der Reporter kann selbst mitten in der komischen Situation gelandet sein und darüber warm, selbstironisch oder trocken berichten. Entwickle den Witz aus dem ursprünglichen Anlass und den bekannten Personen; keine fremde Episode, reine Witzsammlung oder vorgeschriebene Pointe. Ein ernster Anlass muss nicht künstlich zur Komödie werden, darf aber eine passende heitere Nebenbegebenheit haben. Gerade die Rückflugmomente dürfen mehr erzählen als Konflikte und endgültige Urteile. Halte alle erzählenswerten Einzelheiten im experience oder memory fest, damit der spätere Sprecher nicht erst neue biografische Erlebnisse erfinden muss. Aufenthaltsort und geplante Übernachtung bleiben aus original.returnPlan erhalten. Die Geschichte des Aufenthalts umfasst nur Bodenereignisse, keine Aussagen über aktuelles Flugwetter. Offene oder widersprüchliche Aussagen nicht als überprüfte Tatsachen ausgeben. Der Pilot hat die Recherche nicht automatisch miterlebt. experience beschreibt nur diesen bereits vergangenen Aufenthalt; reason die Rückreise, nextStep die anschließende Redaktionsarbeit. Veröffentlichung noch geplant. Nutze tatsächlich gehörte Hinflug-Aussagen für Kontinuität. Plane gern zwei bis drei unterschiedliche, ausführlich erzählbare Routenmomente aus dem Aufenthalt, ohne den ganzen Rückblick schon im Briefing abzuspulen. Keine weitere Flugaufgabe. Antworte als ein einzelnes JSON-Objekt, keine Liste: {experience,reason,nextStep,memory,narrativeEvents,offerText}; ${OFFER_TEXT_RULE} experience 200–1200 Zeichen (Ziel 400–800), reason/nextStep/memory je 40–600 Zeichen. Erzähle den fiktiven Auftrag, keine erfundene reale Airport-Infrastruktur oder rechtlich/technisch bestätigte Erkenntnis. Wähle bei widersprüchlichen Aussagen eine offene Einordnung, kein eindeutiges Rechercheurteil. narrativeEvents sind ergänzender Gesprächsstoff, keine bereits erzählte Handlung im bevorstehenden Flug; keine Geräteaktionen oder Wiedergabe von Tonaufnahmen vorwegnehmen. narrativeEvents 0–3 mit intent bis 600 und atPercent größer 0 kleiner 100 auf dem besetzten Rückflug. ${narrativeTiming} DATEN: ${JSON.stringify(c)}`;
        return `Entwickle die Fortsetzung dieses abgeschlossenen Charter-Hinflugs. Der ursprüngliche Kundenauftrag, alle Reisenden, ihr Gepäck und die Orte stehen fest. Der Pilot bleibt beauftragter Beförderer und hat den Aufenthalt nicht automatisch miterlebt. Entwirf einen plausiblen fiktiven Aufenthalt, persönliche Details und den jetzigen Rückreisegrund aus dem ursprünglichen Anlass. Entwickle daraus eine eigenständige kleine Fortsetzung: Was haben die Reisenden während des Aufenthalts erlebt, und was bedeutet das jetzt für ihr ursprüngliches Anliegen? Persönliche Einzelheiten sollen zusammenpassen und den Rückblick konkret machen. Eine unspektakuläre Entwicklung genügt; weder Konflikt noch Wendung oder Pointe sind Pflicht. Humor darf sich natürlich aus den Personen und ihrer Situation ergeben. Der nächste Schritt nach der Rückkehr soll verständlich sein, ohne daraus eine neue Flugaufgabe zu machen. Keine Beispielhandlung, Berufs- oder Motivliste nachbauen; heitere, schlichte und ernste Entwicklungen sind gleichwertig. Die Rückreise bleibt Beförderung, ohne zusätzliche Aufgaben oder Zwischenziele. Keine obligatorischen Berichte, Dokumente oder Übergaben erfinden. Persönliche Fiktion ist erlaubt; Betriebszustände, Wetter, reale Veranstaltungen, Messungen und Flugergebnisse brauchen Belege. Geplante Aufenthaltsdauer beachten, keine zusätzlichen erfundenen Kalendertermine. Bereits gehörte Gespräche sind Kontinuität, keine neuen Vorlagen.\nexperience beschreibt nur den Aufenthalt vor diesem Rückflug, nie den bevorstehenden Flug. reason erklärt die jetzige Rückreise, nextStep das Vorhaben nach Ankunft. Optional 0–3 verschiedene narrativeEvents; kein Standardwert, keine Quote. Verteile Gesprächsstoff nur, wenn er die Geschichte ergänzt: Jeder gewählte Moment soll einen neuen Gedanken oder eine persönliche Facette beitragen. Wiederhole nicht denselben Rückblick mit anderen Worten. Anknüpfungen an tatsächlich gehörte Gespräche sind möglich, ohne deren Aussagen noch einmal abzuspulen. Keine festgelegte Dramaturgie oder Ereignisanzahl aus einer Beispielgeschichte übernehmen. Prozentwerte gelten ausschließlich für den besetzten Rückflug vom Aufenthaltsplatz zum ursprünglichen Ausgangsplatz. Je Ereignis intent (maximal 600 Zeichen) und entweder atPercent (größer 0, kleiner 100) oder geo:{anchorId,lat,lon,radiusNm}. Geo nur aus den belegten original.geoAnchors; keine Routenänderung.\nNur JSON {experience,reason,nextStep,memory,narrativeEvents,offerText}. Vier Textfelder jeweils 40–600 Zeichen. ${OFFER_TEXT_RULE}\n${narrativeTiming}\nURSPRUNG UND GEHÖRTE GESPRÄCHE (Daten): ${JSON.stringify(c)}`;
    }
    // Prompt targets stay strict; what the model returns is kept when usable. Only an empty or
    // nearly empty required field rejects the draft; anything too long is cut at whole sentences.
    const DRAFT_FIELDS=['experience','reason','nextStep','memory'];
    const DRAFT_MIN=20;
    function draftLimit(key,c){return key==='experience'?1200:600;}
    function fit(value,max) {
        const clean=typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
        if(clean.length<=max)return clean;
        const sentences=wholeSentences(clean,max);
        if(sentences)return sentences;
        const cut=clean.slice(0,max);const space=cut.lastIndexOf(' ');
        return (space>max*0.6?cut.slice(0,space):cut).replace(/[,;:\s]+$/,'')+'…';
    }
    function repairDraft(raw,c) {
        const issues=[];let fatal=0;
        if(Array.isArray(raw)&&raw.length===1)raw=raw[0];
        if(!raw||typeof raw!=='object'||Array.isArray(raw)||!c?.original)return {draft:null,issues:['kein einzelnes JSON-Objekt']};
        const result={};
        for(const key of DRAFT_FIELDS) {
            const limit=draftLimit(key,c);
            const value=fit(raw[key],limit);
            if(value.length<DRAFT_MIN){fatal++;issues.push(`${key} fehlt oder ist leer`);continue;}
            if(typeof raw[key]==='string'&&raw[key].trim().length>limit)issues.push(`${key} auf ${limit} Zeichen gekürzt`);
            result[key]=value;
        }
        const offer=fit(raw.offerText,350);if(offer.length>=40)result.offerText=offer;
        // Conversation moments are optional: an invalid one is dropped, never the whole draft.
        const anchors=Array.isArray(c.original.geoAnchors)?c.original.geoAnchors:[];
        const events=[];
        for(const [index,entry] of (Array.isArray(raw.narrativeEvents)?raw.narrativeEvents:[]).entries()) {
            if(events.length>=3){issues.push(`Gesprächsmoment ${index+1} über der Höchstzahl 3 weggelassen`);continue;}
            let event=entry&&typeof entry==='object'?{...entry}:null;
            if(event&&typeof event.intent==='string'&&event.intent.trim().length>600)event.intent=fit(event.intent,600);
            if(event&&event.geo!=null&&event.atPercent!=null)delete event.geo;
            if(event?.geo) {
                const g=event.geo;
                const anchor=anchors.find(a=>a.id===g.anchorId)||anchors.find(a=>Number.isFinite(g.lat)&&Number.isFinite(g.lon)&&Math.abs(a.lat-g.lat)<0.01&&Math.abs(a.lon-g.lon)<0.01);
                event.geo=anchor?{anchorId:anchor.id,lat:anchor.lat,lon:anchor.lon,radiusNm:Number.isFinite(g.radiusNm)&&g.radiusNm>0&&g.radiusNm<=50?g.radiusNm:(Number.isFinite(anchor.radiusNm)?anchor.radiusNm:2)}:null;
                if(!event.geo){issues.push(`Gesprächsmoment ${index+1} ohne belegten Ortsbezug weggelassen`);continue;}
            }
            const checked=voice.events([event]);
            if(!checked||!checked.length){issues.push(`Gesprächsmoment ${index+1} ungültig (intent und genau eins von atPercent 1–99 oder geo) weggelassen`);continue;}
            events.push({...checked[0],id:'route-story-'+events.length});
        }
        result.narrativeEvents=events;
        if(raw.fallback===true)result.fallback=true;
        return {draft:fatal?null:result,issues};
    }
    function validateDraft(raw,c){return repairDraft(raw,c).draft;}
    // Specific feedback for the one correction round: the model learns what was rejected and why.
    function correctionPrompt(prompt,raw,issues) {
        return `${prompt}\nKORREKTUR DES BISHERIGEN ENTWURFS: ${issues.length?issues.join('; '):'Struktur unvollständig'}. Behebe genau diese Punkte, bewahre Inhalt, Personen und Ereignisse. Antworte als ein einzelnes JSON-Objekt mit experience, reason, nextStep, memory, narrativeEvents und offerText. ENTWURF: ${JSON.stringify(raw)}`;
    }
    // Last resort when accepting: the follow-up mission must always be buildable. A plain stay from
    // the fixed original data, without invented events.
    function fallbackDraft(c) {
        if(!c?.original||!c.visited?.name||!c.home?.name)return null;
        const news=c.original.schema==='apt-news-idea.v1';
        const name=text(c.original.passenger?.name,80)||(news?'Die Reporterin bzw. der Reporter':'Der Chartergast');
        const group=!news&&Number.isInteger(c.original.passengerCount)&&c.original.passengerCount>1;
        const who=group?`${name} und die Mitreisenden`:name;
        const stay=text(c.original.returnPlan?.stayText,240);
        if(c.outputLanguage==='en')return fallbackDraftEnglish(c,news,group,stay);
        const draft=news?{
            experience:`${name} hat die Recherche in ${c.visited.name} wie geplant abgeschlossen${stay?` (${stay})`:''}. Gespräche und Material sind gesammelt; die Auswertung folgt in der Redaktion.`,
            reason:`Die Arbeit vor Ort ist erledigt, deshalb geht es jetzt mit dem gesammelten Material zurück nach ${c.home.name}.`,
            nextStep:`Nach der Ankunft in ${c.home.name} wertet ${name} das Material in der Redaktion aus.`,
            memory:`Ein ruhiger Aufenthalt in ${c.visited.name} ohne besondere Zwischenfälle.`
        }:{
            experience:`${who} ${group?'haben':'hat'} den Aufenthalt in ${c.visited.name} wie geplant verbracht${stay?` (${stay})`:''}. Der Anlass der Reise ist ohne besondere Zwischenfälle verlaufen.`,
            reason:`Der Aufenthalt ist vorbei, deshalb ${group?'fliegen':'fliegt'} ${who} jetzt wie gebucht zurück nach ${c.home.name}.`,
            nextStep:`Nach der Ankunft in ${c.home.name} geht es für ${group?'die Reisenden':name} wieder nach Hause.`,
            memory:`Ein ruhiger Aufenthalt in ${c.visited.name} ohne besondere Zwischenfälle.`
        };
        return {...draft,narrativeEvents:[],fallback:true};
    }
    function fallbackDraftEnglish(c,news,group,stay) {
        const name=text(c.original.passenger?.name,80)||(news?'The reporter':'The charter guest');
        const who=group?`${name} and the fellow travellers`:name;
        const draft=news?{
            experience:`${name} finished the research in ${c.visited.name} as planned${stay?` (${stay})`:''}. Conversations and material are collected; the editorial office will evaluate them.`,
            reason:`The work on site is done, so the flight now goes back to ${c.home.name} with the collected material.`,
            nextStep:`After arriving in ${c.home.name}, ${name} evaluates the material at the editorial office.`,
            memory:`A quiet stay in ${c.visited.name} without special incidents.`
        }:{
            experience:`${who} spent the stay in ${c.visited.name} as planned${stay?` (${stay})`:''}. The occasion of the trip went by without special incidents.`,
            reason:`The stay is over, so ${who} ${group?'fly':'flies'} back to ${c.home.name} as booked.`,
            nextStep:`After arriving in ${c.home.name}, ${group?'the travellers head':name+' heads'} home again.`,
            memory:`A quiet stay in ${c.visited.name} without special incidents.`
        };
        return {...draft,narrativeEvents:[],fallback:true};
    }
    // Rückreise: Start und Ziel tauschen. Wer am Ziel empfangen hat, bringt jetzt zum Flugzeug;
    // wer zu Hause gebracht hat, holt dort wieder ab (groundCast und gespeicherte Composer-Szenen).
    function mirrorGround(idea) {
        if (!idea || typeof idea !== 'object') return idea;
        const cast = idea.groundCast;
        if (cast && typeof cast === 'object') {
            const next = {};
            if (Array.isArray(cast.arrival)) next.start = cast.arrival;
            if (Array.isArray(cast.start)) next.arrival = cast.start;
            idea.groundCast = next;
        }
        const scenes = idea.groundVisual && idea.groundVisual.scenes;
        if (scenes && typeof scenes === 'object') {
            const renamed = (entry, prefix) => entry && typeof entry === 'object'
                ? Object.assign({}, entry, { persons: (Array.isArray(entry.persons) ? entry.persons : []).map((p, i) => Object.assign({}, p, { id: prefix + (i + 1) })) })
                : entry;
            idea.groundVisual.scenes = Object.assign({}, scenes, { start: renamed(scenes.arrival, 's'), arrival: renamed(scenes.start, 'a') });
        }
        return idea;
    }

    function continuationIdea(req) {
        const c=context(req),draft=c&&validateDraft(c.experience,c);
        if(!draft)return null;
        if(c.original.schema==='apt-news-idea.v1')return mirrorGround({...copy(c.original),purpose:draft.reason,background:draft.experience,groundPlan:draft.nextStep,publication:draft.nextStep,memory:draft.memory,narrativeEvents:draft.narrativeEvents,arrival:'Geplanter Empfang am vereinbarten Abstellbereich am Ausgangsplatz.',returnPlan:{offered:false,reason:'Der Reporter kehrt nach der Recherche zurück.'},route:{start:c.visited,target:c.home},continuation:copy(c)});
        return mirrorGround({...copy(c.original),schema:'charter-idea.v1',reason:draft.reason,background:draft.experience,
            arrival:draft.nextStep,memory:draft.memory,narrativeEvents:draft.narrativeEvents,
            returnPlan:{offered:false,reason:'Diese gebuchte Rückreise schließt den Charterauftrag ab.'},
            route:{start:c.visited,target:c.home},continuation:copy(c)});
    }
    function applyMission(req,base,writtenMission) {
        const idea=continuationIdea(req);
        if(!idea||!base)return null;
        idea.writerMemory=(writtenMission.aptNewsIdea || writtenMission.charterIdea)?.writerMemory || null;
        const pickup=!!base.bush;
        const count=idea.passengerCount;
        const party={count,kind:count===1?'single':'group',label:idea.groupLabel};
        const passenger={...req.passenger,...writtenMission.passenger,party};
        const pickupStory={personName:passenger.name,role:passenger.role,exactWhere:`am vereinbarten Flugplatz ${context(req).visited.name}`,
            whyThere:idea.background,returnReason:idea.reason,boardingCue:passenger.greetingText,departureCue:idea.reason};
        return {...base,...writtenMission,passenger:{...passenger,pickupStory},
            bush:pickup?{...base.bush,pickupPassengerCount:count,pickupLabel:idea.groupLabel,pickupCargoLabel:idea.shipment?.label || base.bush.pickupCargoLabel,pickupCargoWeightLbs:idea.shipment?.weightLbs ?? base.bush.pickupCargoWeightLbs,
                pickupGreetingText:passenger.greetingText,pickupStory}:null,
            _source:idea.schema==='apt-news-idea.v1'?'Reporter-Fortsetzung V1':'Charter-Fortsetzung V1',
            _missionWriterV4Debug:{...writtenMission._missionWriterV4Debug,writerMode:idea.schema==='apt-news-idea.v1'?'apt-news-continuation-v1':'charter-continuation-v1'},
            ...(idea.schema==='apt-news-idea.v1'?{aptNewsIdea:idea,charterIdea:null,cat:'std'}:{charterIdea:idea}),party,passengerCount:pickup?0:count,plannedPassengerCount:count,
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
    return {SCHEMA,source,context,returnPlan,prospect,request,offerPreview,draftPrompt,validateDraft,repairDraft,correctionPrompt,fallbackDraft,continuationIdea,applyMission,voiceLeg,mirrorGround};
});
