// Additive narrative memory. Existing outcome rules remain the sole follow-up authority.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionPoiFollowupNarrativeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='ga.followup-narrative.v1';
const TRANSITIONS=['infra_recheck','infra_damage_mapping','infra_repair_photo','infra_final_review'];
function transitionIdeas(raw){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>4||raw.some(x=>!TRANSITIONS.includes(x?.followUpKind)||!validText(x.summary,600))||new Set(raw.map(x=>x.followUpKind)).size!==raw.length)return null;
 return raw.map(x=>({followUpKind:x.followUpKind,summary:x.summary.trim()}));
}
function betweenFlights(handoff,kind){
 const idea=handoff?.memory?.betweenFlightsIdeas?.find(x=>x.followUpKind===kind);
 return idea?{schema:'ga.infra.betweenFlights.v1',origin:'writer_story_plan',phase:'before_next_flight',summary:idea.summary}:null;
}

const validText=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
function participantRules(){return "Bei einem PAX-Wechsel kennt die neue Person den bisherigen Vorgang aus der Übergabe und kann die frühere Fachperson namentlich nennen. Frühere Flugteilnahme und Beobachtungen gehören dieser Person, nicht dem neuen PAX; eigene Wiederteilnahme nur bei gleicher Identität. Eine persönliche Bekanntschaft wird daraus nicht abgeleitet.";}
function writerRules(){return `Die Antwort ist ein einziges syntaktisch gültiges JSON-Objekt. client ist immer ein Objekt, beispielsweise {"name":"Auftraggeber","kind":"public_authority"}, und wird mit } geschlossen. participants, openQuestions, possibleContinuations und betweenFlightsIdeas sind Arrays und werden mit ] geschlossen. Prüfe die vollständige JSON-Struktur vor Ausgabe.
Bereite in memory.betweenFlightsIdeas (bei der Erstinspektion continuationMemory.betweenFlightsIdeas) mögliche Entwicklungen zwischen den Flügen vor: höchstens vier Objekte {followUpKind,summary}, summary höchstens 600 Zeichen. Erlaubte followUpKind: infra_recheck, infra_damage_mapping, infra_repair_photo, infra_final_review. Nur fachlich passende Anschlussideen aufnehmen: Nachkontrolle/Kartierung nach Auswertung, Reparaturfoto nach Auswertung und begonnenen Arbeiten, Abschlussprüfung nach gemeldetem Arbeitsabschluss. Dies sind Rahmen, keine festen Ereignistexte. Entwickle konkrete Auswertung, Entscheidungen oder Arbeiten individuell aus dieser Geschichte, ohne neue Ortsmerkmale, bestätigte Flugergebnisse oder technische Freigaben zu erfinden. Formuliere jede Idee bedingt auf den passenden offenbarten Befund; ohne ausreichende Grundlage Liste leer lassen. Die Idee ist vor dem Abschluss nur ein Vorschlag und wird ausschließlich für den tatsächlich freigegebenen Folgeauftrag als fiktionale Zwischenentwicklung übernommen. Die passende gelieferte CONTINUATION.betweenFlights ist verbindliche Vorgeschichte: Ihr passender bedingter Vorschlag wird als inzwischen eingetretene fiktionale Entwicklung erzählt, ohne den nächsten Flug vorwegzunehmen. Fehlt sie bei Altdaten, entwickle selbst einen zum bekannten Befund und vorgegebenen Auftrag passenden Zwischenablauf; fehlende Befunde bleiben unbekannt. Schreibe für jeden weiteren Anschluss eine neue Idee aus dem aktuellen Stand, statt die alte zu wiederholen.
Schreibe ein vollständig ausgearbeitetes Vorflugbriefing aus Sicht eines außenstehenden Dispatch-Erzählers. Die mitfliegende Person wird mit Namen oder in der dritten Person beschrieben; du für den Piloten und ihr für beide sind erlaubt. Direkte Ich-Rede ist in greeting und als eindeutig markiertes, der Person zugeordnetes Zitat erlaubt. Der Erzähler übernimmt nicht die Rolle des Passagiers.
Das ursprüngliche Ziel und der fachliche Auftrag bleiben der Anker der Geschichte. Ergänzende Orientierungspunkte gehören in den separaten Lagebericht. Reale Umgebungsmerkmale erscheinen im Missionstext nur, wenn sie fachlich erforderlich und belegt sind; sie schaffen keine neuen Aufgaben oder Flugpositionen. Fehlende Ortsmerkmale bleiben unbekannt.
CONTINUATION.betweenFlights beschreibt die ausdrücklich festgelegte fiktionale Entwicklung zwischen den Flügen. Nutze diese Auswertung oder Arbeit als neue Vorgeschichte des Folgeauftrags, getrennt vom bestätigten Ergebnis des vorherigen Flugs. Die Meldung eines Reparaturabschlusses ist keine bestätigte Bauwerksfreigabe und nimmt das Ergebnis der neuen Prüfung nicht vorweg. Eine Fortsetzung verwendet dieselben Erzähl- und Aufgabenregeln wie die jeweilige Hauptmission und wird vergleichbar vollständig ausgearbeitet. Angepasst werden die Planungsgrundlagen: bekannte Vorgeschichte, Beteiligte, bestätigter Befund, Zeitabstand und verbindlicher neuer Auftrag. Auftraggeber und Personenidentität bleiben anhand der gelieferten Daten erhalten; ein fachlich erforderlicher Personenwechsel wird nachvollziehbar erklärt. ${participantRules()} Geplante Tätigkeiten, neue Flugergebnisse und spätere Auswertung werden nicht als bereits erfolgt erzählt. memory bewahrt den vollständigen Auftraggebernamen sowie Namen und Rollen der Beteiligten. Offene Fragen bleiben offen, mögliche Fortsetzungen sind keine Freigabe.`;}
function memory(raw){
 const ideas=transitionIdeas(raw?.betweenFlightsIdeas);if(ideas===null)return null;
 if(!raw||!validText(raw.summary,700)||!Array.isArray(raw.participants)||raw.participants.length>6||raw.participants.some(p=>!validText(p.name,120)||!validText(p.role,160))||!Array.isArray(raw.openQuestions)||raw.openQuestions.length>4||raw.openQuestions.some(s=>!validText(s,220))||!Array.isArray(raw.possibleContinuations)||raw.possibleContinuations.length>3||raw.possibleContinuations.some(s=>!validText(s,220)))return null;
 const out={...(raw.betweenFlightsIdeas!=null?{betweenFlightsIdeas:ideas}:{}),summary:raw.summary.trim(),participants:raw.participants.map(p=>({name:p.name.trim(),role:p.role.trim()})),client:raw.client&&validText(raw.client.name,160)?{name:raw.client.name.trim(),kind:validText(raw.client.kind,80)?raw.client.kind:''}:null,openQuestions:raw.openQuestions.map(s=>s.trim()),possibleContinuations:raw.possibleContinuations.map(s=>s.trim())};
 return JSON.stringify(out).length<=4000?out:null;
}
function normalize(raw){
 if(raw?.schema!==SCHEMA)return null;
 try{if(JSON.stringify(raw).length>8000)return null;}catch(_){return null;}
 const m=memory(raw.memory);if(!m)return null;
 return {schema:SCHEMA,status:raw.status==='writer-memory'?'writer-memory':'legacy-context',memory:m,identity:clone(raw.identity||null),completion:clone(raw.completion||null),nextAssignment:clone(raw.nextAssignment||null)};
}
function forWriter(raw){const n=normalize(raw);return n?{status:n.status,memory:n.memory,identity:n.identity,completion:n.completion,nextAssignment:n.nextAssignment}:null;}
function draft(raw,missionId=null){const m=memory(raw);return m?{schema:SCHEMA,status:'writer-memory',identity:{sourceMissionId:missionId},memory:m,completion:null,nextAssignment:null}:null;}
function complete(md,config,record,refs={}){
 // Caller is the existing confirmed-completion path. This memory cannot authorize a request.
 if(record&&(record.failed===true||record.result!=='completed'||(md?.missionId&&record.missionId&&md.missionId!==record.missionId)))return null;
 const stored=normalize(md?.followUpNarrative||md?.missionContract?.followUpNarrative||md?.missionContractV4?.followUpNarrative);
 const inherited=normalize(md?.followUpContinuation?.narrativeMemory?.followUpNarrative);
 const previous=stored;
 const fallback={client:md?.mappingBriefing?.idea?.client||md?.infraBriefing?.idea?.client||md?.poiBriefing?.idea?.client||inherited?.memory?.client||null,summary:String(md?.infraBriefing?.writerMemory||md?.poiBriefing?.writerMemory||md?.story||md?.missionStory||'').slice(0,700),participants:md?.passenger?.name?[{name:md.passenger.name,role:md.passenger.role||'Fachperson'}]:[],openQuestions:[],possibleContinuations:[]};
 const m=previous?.memory||memory(fallback);if(!m)return null;
 return {schema:SCHEMA,status:previous?.status||'legacy-context',memory:clone(m),identity:{sourceMissionId:md.missionId||record?.missionId||null,completionId:record?.completionId||null,chainId:config.chain?.id||null,parentRequestId:md.followUpRequestId||null,step:config.chain?.previousStep||md.followUpContinuation?.chain?.step||null},completion:record?{result:'completed',endedAt:record.endedAt||null,cargoFailed:false}:null,nextAssignment:{profileId:config.followUpProfileId||null,kind:config.followUpKind||null,purpose:config.followUpLabel||null,targetRef:clone(refs.targetRef||config.targetRef||null),temporalContext:clone(config.temporalContext||null)}};
}
function context(req){
 if(!req?.poiFollowUp&&req?.route?.targetRef?.kind!=='poi')return null;
 const accepted=forWriter(req.narrativeMemory?.followUpNarrative);
 return {requestId:req.id||null,sourceMissionId:req.sourceMissionId||null,chain:clone(req.chain||null),targetRef:clone(req.route?.targetRef||null),temporalContext:clone(req.temporalContext||null),betweenFlights:betweenFlights(accepted,req.followUpKind),assignment:{profileId:req.followUpProfileId||null,kind:req.followUpKind||null,label:req.followUpLabel||null},knownFinding:clone(req.infraInspectionOutcome||req.narrativeMemory?.infraInspectionOutcome||null),narrative:accepted,legacySummary:accepted?null:String(req.source?.story||req.narrativeMemory?.sourceOutcomeText||'').slice(0,700)};
}
function continuationFields(req){return {chain:clone(req?.chain||null),chainStep:req?.chain?.step||null,narrativeMemory:clone(req?.narrativeMemory||null),temporalContext:clone(req?.temporalContext||null)};}
function ownsContinuation(m){return m?.poiContinuationBriefing?.schema==='poi-continuation-briefing.v1'&&['inspection_infra','media_photo'].includes(m.passenger?.taskDomain);}
function voiceContext(b){if(b?.schema!=='poi-continuation-briefing.v1')return '';return `POI-FOLGEAUFTRAG: ${JSON.stringify(b.continuation)}. AUFTRAGSGEDÄCHTNIS: ${JSON.stringify(b.writerMemory||null)}. Die bekannte Geschichte wird fortgesetzt. ${participantRules()} Vergangener Befund und neuer Auftrag bleiben getrennt. Die gelieferte betweenFlights-Entwicklung ist fiktionale Vorgeschichte; sie bestätigt weder technische Freigaben noch die Leistung des neuen Flugs. Die bestehenden Aufgaben und Ergebnisregeln bleiben zuständig; die mögliche Fortsetzung im Gedächtnis ist keine Freigabe.`;}
return {SCHEMA,writerRules,betweenFlights,memory,normalize,forWriter,draft,complete,context,continuationFields,ownsContinuation,voiceContext};
});
