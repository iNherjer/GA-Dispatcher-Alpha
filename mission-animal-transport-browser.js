(function(root){
'use strict';
const core=()=>root.MissionAnimalTransportIdeasCore;
const target=a=>({name:a.n||a.name||a.icao||'',icao:a.icao||'',lat:Number(a.lat),lon:Number(a.lon)});
const frame=(start,dest)=>core().frame({start:target(start),target:target(dest)},getMissionAircraftCapabilitySnapshot(),core().history(localStorage));
async function json(prompt){const r=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});if(!r?.parsed)throw Error(root.formatAiJsonFailure?root.formatAiJsonFailure(r,'Der Tiertransportauftrag'):'Der Tiertransportauftrag konnte nicht erstellt werden. Bitte erneut versuchen.');return r.parsed;}
async function ideas(frames){
 if(frames.some(f=>f.passengerCapacity<1))throw Error('Für die Tierbegleitung fehlt ein Passagierplatz.');
 const prompt=core().ideaPrompt(frames);
 const parse=raw=>frames.map(input=>{const rows=raw?.ideas?.filter(r=>r.candidateId===input.candidateId)||[];return rows.length===1?core().validate(rows[0],input):null;});
 let raw=await json(prompt),result=parse(raw);
 if(result.some(r=>!r)){raw=await json(prompt+'\nFORMATKORREKTUR: Bewahre Bedürfnisse und Sendungen des Entwurfs. Korrigiere fehlende Felder, Feldlängen, IDs und Gesamtgewichte innerhalb der Grenze. Genau einen passenden Tierbegleiter mit vollständigen Personenfeldern erhalten. Vollständiges JSON. ENTWURF: '+JSON.stringify(raw));result=parse(raw);}
 if(result.some(r=>!r))throw Error('Ein Tiertransportauftrag ist unvollständig oder überschreitet die Entwurfsgrenze. Bitte erneut versuchen.');
 return result;
}
async function choices(airports,context){
 if(airports.length<3)throw Error('Für Tiertransportvorschläge fehlen passende Zielflugplätze.');
 const selected=airports.slice(0,3),frames=selected.map((a,i)=>({candidateId:'animal-transport-'+i,...frame(context.start,a)}));
 const drafts=await ideas(frames);context.ensureAlive?.();
 return frames.map((input,i)=>normalizeMissionProposalChoice({id:input.candidateId+'-'+Date.now(),mode:'apt',profileId:'animal_transport',selectedCategory:'cargo',requestedCategory:'cargo',target:missionProposalCompactTarget(selected[i],'apt'),title:drafts[i].purpose,description:drafts[i].background,subtitle:drafts[i].shipment.label,paxText:`1 PAX (${drafts[i].passenger.role})`,cargoText:core().cargoText(drafts[i]),routeLabel:missionProposalFormatRoute(context.start,selected[i],'apt').label,animalTransportProposal:{schema:'animal-transport-proposal.v1',input,idea:drafts[i]}}));
}
async function story({start,dest,proposal,contract={}}){
 const input=frame(start,dest);let idea;
 if(proposal){
  if(proposal.schema!=='animal-transport-proposal.v1'||!root.MissionClubIdeasCore.sameRoute(proposal.input?.route,input.route))throw Error('Die Tiertransportauswahl passt nicht mehr zur Route. Bitte neu auswählen.');
  idea=core().validate(proposal.idea,input);
 }else idea=(await ideas([{candidateId:'direct',...input}]))[0];
 if(!idea)throw Error('Die gewählte Sendung passt nicht mehr zum aktuellen Flugzeug. Bitte neu auswählen.');
 const api=root.MissionPrivateEpisodeV6,context=api.flightContext(contract),flight={context,bindings:api.flightBindings(context)};
 const prompt=core().writerPrompt(idea,flight,input.recent);
 const parse=raw=>{const resolved=root.MissionCharterIdeasCore.resolveReferences(raw,flight.bindings);return resolved&&core().prose(resolved,idea);};
 let raw=await json(prompt),written=parse(raw);
 if(!written){raw=await json(prompt+'\nFORMATKORREKTUR: Behalte Auftrag und Sendung bei. Prüfe Textlängen, ausschließlich bekannte Referenzen, genau einen Tierbegleiter, natürliche Begrüßung und konkrete pilotNotes zur Handhabung. In doppelten eckigen Klammern ausschließlich SCHLÜSSEL, niemals deren Werte. Erlaubt: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+'. Vollständiges JSON. ENTWURF: '+JSON.stringify(raw));written=parse(raw);}
 if(!written)throw Error('Das Tiertransportbriefing enthält ungültige Texte oder Referenzen. Bitte erneut versuchen.');
 let brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 if(!context.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null))brief='Für Start und Ziel liegen derzeit keine verwertbaren Wetterbeobachtungen vor.';
 else if(!brief){try{const repair=await json('Erstelle ausschließlich den Wetterabsatz. Die Geschichte bleibt unverändert. Nur JSON {flightBriefing}. '+core().weatherPrompt(flight));brief=api.resolveFlightBriefing(repair.flightBriefing,context);raw.flightBriefing=repair.flightBriefing;}catch{console.warn('[Tiertransport] Wetterabsatz konnte nicht separat korrigiert werden.');}}
 const m=core().mission(idea,written,brief,contract.route);
 Object.assign(m._missionWriterV4Debug,{weatherSnapshot:context.weather,rawFlightBriefing:raw.flightBriefing||'',historyCount:input.recent.length});
 // Preserve original animal-transport passenger, sensitivity and separate delivery semantics.
 Object.assign(contract,{status:'ready',profile:{id:'animal_transport',taskDomain:'animal_transport',roleProfile:'general_passenger_v1'},animalTransportIdea:m.animalTransportIdea,passenger:m.passenger,passengerCount:1,plannedPassengerCount:1,party:null,paxText:m.pax,cargoText:m.cargo,missionStory:m.s,target:input.route.target,storyFrame:{trigger:idea.purpose,whyNow:idea.background,shipment:idea.shipment.label,receiver:idea.recipient,arrival:idea.arrival}});
 contract.animalTransportBrief={cargoText:m.cargo,transportSubject:idea.shipment.label,careReason:idea.background,whyAir:'',handlingFocus:idea.shipment.handling,stressReason:idea.shipment.fragility,receivingContact:idea.recipient,nextCareStep:idea.arrival,handoffSentence:idea.arrival};
 m._missionContractV4=contract;return m;
}
root.MissionAnimalTransportBrowser={choices,story};
})(window);
