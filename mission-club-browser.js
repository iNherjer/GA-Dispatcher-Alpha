/* Browser orchestration for the isolated club contract; no legacy seed data enters prompts. */
(function(root){
'use strict';
const core=()=>root.MissionClubIdeasCore;
const date=()=>new Date().toLocaleDateString('en-CA');
const target=a=>({name:a.n||a.name||a.icao||'',icao:a.icao||'',lat:Number(a.lat),lon:Number(a.lon)});
function route(start,dest){return {start:target(start),target:target(dest)};}
async function enrichedFrame(start,dest,recent,event=null){
 const r=route(start,dest);
 const midpoint={lat:(r.start.lat+r.target.lat)/2,lon:((r.start.lon+((((r.target.lon-r.start.lon)+540)%360)-180)/2+540)%360)-180};
 const results=await Promise.allSettled([midpoint,r.target].map(async p=>root.MissionPrivateContextCore.resolveBrowser(p)));
 const places=results.flatMap(r=>r.status==='fulfilled'?r.value.places||[]:[]);
 return core().frame(r,recent,event,date(),places);
}
async function json(prompt,version){const response=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:version,timeoutMs:40000});if(!response?.parsed)throw Error('Vereinsidee konnte nicht erstellt werden. Bitte erneut versuchen.');return response.parsed;}
async function choices(airports,context){if(airports.length<3)throw Error('Für drei Vereinsideen fehlen passende Flugplätze.');const recent=core().history(localStorage);let eventMatch=null;root.gaClubEventSearch={status:'searching'};
try{if(getSelectedAiProvider()!=='gemini')throw Error('Eventsuche benötigt derzeit Gemini');const result=await root.MissionClubEventsCore.search({start:target(context.start),maxNM:context.searchMax,date:date(),apiKey:getSelectedAiApiKey(),storage:localStorage});eventMatch=root.MissionClubEventsCore.match(result.events,airports,root.MissionPrivateContextCore.distanceKm);root.gaClubEventSearch={status:'ready',count:result.events.length,matched:eventMatch?.event.id||null,cacheHit:result.cacheHit};}catch(error){root.gaClubEventSearch={status:'unavailable',error:String(error.message)};console.warn('[CLUB] Optionale Veranstaltungssuche nicht verfügbar.');}
context.ensureAlive?.();
const selected=eventMatch?[eventMatch.airport,...airports.filter(a=>a!==eventMatch.airport).slice(0,2)]:airports.slice(0,3);
const frames=await Promise.all(selected.map(async(airport,i)=>({candidateId:'club-'+i,...await enrichedFrame(context.start,airport,recent,i===0?eventMatch?.event||null:null)})));context.ensureAlive?.();
const result=await json(core().ideaPrompt(frames),'mission-club-ideas-v1');context.ensureAlive?.();if(!Array.isArray(result.ideas)||result.ideas.length!==3)throw Error('Drei vollständige Vereinsideen erwartet.');
return frames.map((input,i)=>{const rows=result.ideas.filter(x=>x.candidateId===input.candidateId);const idea=rows.length===1&&core().validate(rows[0],input);if(!idea)throw Error('Eine Vereinsidee ist unvollständig.');const airport=selected[i];const r=missionProposalFormatRoute(context.start,airport,'apt');return normalizeMissionProposalChoice({id:input.candidateId+'-'+Date.now(),mode:'apt',profileId:'club_utility',selectedCategory:'club',requestedCategory:'club',target:missionProposalCompactTarget(airport,'apt'),title:idea.occasion,description:idea.groundPlan,subtitle:idea.event ? `${idea.event.startsOn} · ${idea.event.title}` : idea.passenger?.name||'Vereinsflug',routeLabel:r.label,clubProposal:{schema:'club-proposal.v1',input,idea}});});}
async function story({start,dest,proposal=null,contract={}}){let input=core().frame(route(start,dest),core().history(localStorage),null,date());let idea;
if(proposal){if(proposal.schema!=='club-proposal.v1'||!core().sameRoute(proposal.input?.route,input.route))throw Error('Vereinsauswahl passt nicht mehr zur Route.');if(proposal.idea?.event&&proposal.idea.event.endsOn<input.missionDate)throw Error('Der Veranstaltungstermin ist abgelaufen. Bitte neue Vorschläge erstellen.');input={...input,event:proposal.input.event,geoAnchors:proposal.input.geoAnchors||input.geoAnchors};idea=core().validate(proposal.idea,input);}else{input=await enrichedFrame(start,dest,input.recent);const parsed=await json(core().ideaPrompt([{candidateId:'club-direct',...input}]),'mission-club-ideas-v1');idea=core().validate(parsed.ideas?.[0],input);}
if(!idea)throw Error('Die Vereinsidee benötigt einen mitfliegenden Vereinskollegen und vollständige Pflichtdaten. Bitte neue Vorschläge erstellen.');
const raw=await json(core().writerPrompt(idea,input.recent),'mission-club-writer-v1');const prose=core().prose(raw,idea);if(!prose)throw Error('Das Vereinsbriefing ist unvollständig. Die Idee wurde nicht durch Textbausteine ersetzt.');
const m=core().mission(idea,prose);m._missionWriterV4Debug.historyCount=input.recent.length;
Object.assign(contract,{status:'ready',profile:{id:'club_utility',taskDomain:'club_utility',roleProfile:'club_utility_v1'},clubIdea:idea,passenger:m.passenger,paxText:m.pax,cargoText:m.cargo,passengerCount:m.passenger?1:0,plannedPassengerCount:m.passenger?1:0,missionStory:m.s,storyFrame:{trigger:idea.occasion,whyNow:idea.pilotIntent,soughtOutcome:idea.groundPlan,noDelivery:!idea.delivery},route:{startName:input.route.start.name,targetName:input.route.target.name,startIcao:input.route.start.icao,targetIcao:input.route.target.icao},target:{name:input.route.target.name,lat:input.route.target.lat,lon:input.route.target.lon}});
m._missionContractV4=contract;return m;}
root.MissionClubBrowser={choices,story};
})(window);
