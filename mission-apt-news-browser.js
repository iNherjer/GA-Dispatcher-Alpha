(function(root){
'use strict';
const core=()=>root.MissionAptNewsIdeasCore;
const target=a=>({name:a.n||a.name||a.icao||'',icao:a.icao||'',lat:Number(a.lat),lon:Number(a.lon)});
const frame=(start,dest)=>core().frame({start:target(start),target:target(dest)},getMissionAircraftCapabilitySnapshot(),core().history(localStorage));
async function json(prompt){const r=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});if(!r?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(r,'Der Reporterauftrag'):Error('Der Reporterauftrag konnte nicht erstellt werden. Bitte erneut versuchen.'));return r.parsed;}
async function ideas(frames){
 if(frames.some(f=>f.passengerCapacity<1))throw Error('Für die Reporter fehlt ein Passagierplatz.');
 const prompt=core().ideaPrompt(frames);
 const parse=raw=>frames.map(input=>{const rows=raw?.ideas?.filter(r=>r.candidateId===input.candidateId)||[];return rows.length===1?core().validate(rows[0],input):null;});
 let raw=await json(prompt),result=parse(raw);
 if(result.some(r=>!r)){raw=await json(prompt+'\nFORMATKORREKTUR: Bewahre Reportageanlass und Ausrüstung des Entwurfs. Korrigiere fehlende Felder, Feldlängen, IDs und Gesamtgewichte innerhalb der Grenze. Ersetze abweichende candidateId durch die zugehörige exakte ID aus RAHMEN; keine selbst erfundenen IDs. Genau einen passenden Reporter mit vollständigen Personenfeldern erhalten. Alle Textfelder sind nichtleer. Insbesondere returnPlan.reason muss bei offered=true den Rückreisegrund benennen; stayText ersetzt reason nicht. Antworte als einzelnes Objekt {ideas:[...]}, mit vollständiger Idee je candidateId. ENTWURF: '+JSON.stringify(raw));result=parse(raw);}
 if(result.some(r=>!r))throw Error('Ein Reporterauftrag ist unvollständig oder überschreitet die Entwurfsgrenze. Bitte erneut versuchen.');
 return result;
}
async function choices(airports,context){
 if(airports.length<3)throw Error('Für Reportervorschläge fehlen passende Zielflugplätze.');
 const selected=airports.slice(0,3),frames=selected.map((a,i)=>({candidateId:'apt-news-'+i,...frame(context.start,a)}));
 const drafts=await ideas(frames);context.ensureAlive?.();
 return frames.map((input,i)=>normalizeMissionProposalChoice({id:input.candidateId+'-'+Date.now(),mode:'apt',profileId:'news_coverage',selectedCategory:'std',requestedCategory:'std',target:missionProposalCompactTarget(selected[i],'apt'),title:drafts[i].purpose,description:drafts[i].background,subtitle:drafts[i].shipment.label,paxText:`1 PAX (${drafts[i].passenger.role})`,cargoText:core().cargoText(drafts[i]),routeLabel:missionProposalFormatRoute(context.start,selected[i],'apt').label,aptNewsProposal:{schema:'apt-news-proposal.v1',input,idea:drafts[i]}}));
}
async function story({start,dest,proposal,contract={},preparedIdea=null}){
 const input=frame(start,dest);let idea;
 if(preparedIdea){idea=core().validate(preparedIdea,input);if(idea)idea.continuation=preparedIdea.continuation;}else if(proposal){
  if(proposal.schema!=='apt-news-proposal.v1'||!root.MissionClubIdeasCore.sameRoute(proposal.input?.route,input.route))throw Error('Die Reporterauswahl passt nicht mehr zur Route. Bitte neu auswählen.');
  idea=core().validate(proposal.idea,input);
 }else idea=(await ideas([{candidateId:'direct',...input}]))[0];
 if(!idea)throw Error('Die gewählte Reportage passt nicht mehr zum aktuellen Flugzeug. Bitte neu auswählen.');
 const api=root.MissionPrivateEpisodeV6,context=api.flightContext(contract),flight={context,bindings:api.flightBindings(context)};
 const prompt=core().writerPrompt(idea,flight,input.recent);
 const parse=raw=>{const resolved=root.MissionCharterIdeasCore.resolveReferences(raw,flight.bindings);return resolved&&core().prose(resolved,idea);};
 let raw=await json(prompt),written=parse(raw);
 if(!written){raw=await json(prompt+'\nFORMATKORREKTUR: Behalte Reportage und Ausrüstung bei. Prüfe Textlängen, ausschließlich bekannte Referenzen, genau einen Reporter, natürliche Begrüßung und konkrete pilotNotes zur Handhabung. In doppelten eckigen Klammern ausschließlich SCHLÜSSEL, niemals deren Werte. Erlaubt: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+'. Alle Textfelder sind nichtleer. Insbesondere returnPlan.reason muss bei offered=true den Rückreisegrund benennen; stayText ersetzt reason nicht. Antworte als einzelnes Objekt {ideas:[...]}, mit vollständiger Idee je candidateId. ENTWURF: '+JSON.stringify(raw));written=parse(raw);}
 if(!written)throw Error('Das Reporterbriefing enthält ungültige Texte oder Referenzen. Bitte erneut versuchen.');
 let brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 if(!context.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null))brief='Für Start und Ziel liegen derzeit keine verwertbaren Wetterbeobachtungen vor.';
 else if(!brief){try{const repair=await json('Erstelle ausschließlich den Wetterabsatz. Die Geschichte bleibt unverändert. Nur JSON {flightBriefing}. '+core().weatherPrompt(flight));brief=api.resolveFlightBriefing(repair.flightBriefing,context);raw.flightBriefing=repair.flightBriefing;}catch{console.warn('[Cargo] Wetterabsatz konnte nicht separat korrigiert werden.');}}
 if(contract.returnFlight){
  const rc=api.flightContext(contract.returnFlight),rf={context:rc,bindings:api.flightBindings(rc)};
  let rb='Für den besetzten Rückflug liegen derzeit keine verwertbaren Wetterbeobachtungen vor.';
  if(rc.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null)){
   try{const repair=await json('Nur JSON {flightBriefing} für den besetzten Reporter-Rückflug. '+core().weatherPrompt(rf));rb=api.resolveFlightBriefing(repair.flightBriefing,rc)||'Bitte die Wetterdaten des besetzten Rückflugs separat prüfen.';}catch{rb='Bitte die Wetterdaten des besetzten Rückflugs separat prüfen.';}
  }
  brief='Leerflug zur Abholung: '+(brief||'Wetterdaten separat prüfen.')+'\n\nBesetzter Rückflug: '+rb;
 }
 const m=core().mission(idea,written,brief,contract.route);
 Object.assign(m._missionWriterV4Debug,{weatherSnapshot:context.weather,rawFlightBriefing:raw.flightBriefing||'',historyCount:input.recent.length});
 // Preserve original apt-news passenger, sensitivity and personal equipment ownership.
 Object.assign(contract,{status:'ready',profile:{id:'news_coverage',taskDomain:'news_coverage',roleProfile:'news_reporter_professional_v1'},aptNewsIdea:m.aptNewsIdea,passenger:m.passenger,passengerCount:1,plannedPassengerCount:1,party:null,paxText:m.pax,cargoText:m.cargo,missionStory:m.s,target:input.route.target,storyFrame:{trigger:idea.purpose,whyNow:idea.background,angle:idea.angle,groundPlan:idea.groundPlan,publication:idea.publication,arrival:idea.arrival}});
 m._missionContractV4=contract;return m;
}
async function continuation({req,base,contract,aiEnabled=true}){
 const api=root.MissionCharterContinuationCore,c=api.context(req);
 if(c?.original?.schema!==core().VERSION)throw Error('Der ursprüngliche Reporterauftrag fehlt.');
 if(!aiEnabled)throw Error('Für den Reporter-Rückblick bitte die KI aktivieren. Das Angebot bleibt erhalten.');
 if(getMissionAircraftCapabilitySnapshot().passengerCapacity<1)throw Error('Für den Reporter fehlt ein Passagierplatz.');
 if(!api.validateDraft(c.experience,c)){
  const prompt=api.draftPrompt(c);let raw=await json(prompt),draft=api.validateDraft(raw,c);
  if(!draft){raw=await json(prompt+'\nFORMATKORREKTUR: Antworte als einzelnes JSON-Objekt mit experience, reason, nextStep, memory und narrativeEvents, niemals als Liste. Alle vier Textfelder sind nichtleer und haben mindestens 40 Zeichen; experience maximal 1200, die übrigen maximal 600. Bewahre Personen und Ereignisse; korrigiere nur Form, fehlende Felder und Textlängen. ENTWURF: '+JSON.stringify(raw));draft=api.validateDraft(raw,c);}
  if(!draft)throw Error('Der Reporter-Rückblick ist unvollständig. Das Angebot bleibt erhalten.');
  const saved=root.missionFollowupSaveCharterExperience(req.id,draft);
  if(!saved)throw Error('Der Reporter-Rückblick konnte nicht gespeichert werden.');
  req.charterContinuation=saved;
 }
 req.charterContinuation={...req.charterContinuation,pickupRequired:!!base.bush};
 const idea=api.continuationIdea(req);
 const written=await story({start:idea.route.start,dest:idea.route.target,contract,preparedIdea:idea});
 const m=api.applyMission(req,base,written);
 Object.assign(contract,{aptNewsIdea:m.aptNewsIdea,bush:m.bush,passenger:m.passenger,passengerCount:m.passengerCount,plannedPassengerCount:m.plannedPassengerCount,party:m.party,paxText:m.pax,cargoText:m.cargo,followUpContinuation:m.followUpContinuation});
 m._missionContractV4=contract;return m;
}
root.MissionAptNewsBrowser={choices,story,continuation};
})(window);
