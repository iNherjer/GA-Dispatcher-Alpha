(function(root){
'use strict';
const core=()=>root.MissionCharterIdeasCore;
const target=a=>({name:a.n||a.name||a.icao||'',icao:a.icao||'',lat:Number(a.lat),lon:Number(a.lon)});
function capacity(){const c=getMissionAircraftCapabilitySnapshot();return Math.min(5,c.passengerCapacity||0,missionTrackerSupportsGroupGeneration()?5:1);}
async function frame(start,dest){const route={start:target(start),target:target(dest)};let places=[];try{places=(await root.MissionPrivateContextCore.resolveBrowser(route.target)).places||[];}catch{}
 const anchors=root.MissionClubIdeasCore.frame(route,[],null,'',places).geoAnchors;
 return core().frame(route,capacity(),core().history(localStorage),anchors);}
async function json(prompt){const r=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:'charter-v1',timeoutMs:40000});if(!r?.parsed)throw Error('Charterauftrag konnte nicht erstellt werden. Bitte erneut versuchen.');return r.parsed;}
async function choices(airports,context){if(airports.length<3)throw Error('Für Chartervorschläge fehlen passende Zielflugplätze.');
 const selected=airports.slice(0,3),frames=await Promise.all(selected.map(async(a,i)=>({candidateId:'charter-'+i,...await frame(context.start,a)})));context.ensureAlive?.();
 if(!frames[0].maxPassengers)throw Error('Das Flugzeug bietet keinen freien Passagierplatz.');
 const raw=await json(core().ideaPrompt(frames));context.ensureAlive?.();
 return frames.map((input,i)=>{const rows=raw.ideas?.filter(x=>x.candidateId===input.candidateId)||[];const idea=rows.length===1&&core().validate(rows[0],input);if(!idea)throw Error('Ein Chartervorschlag ist unvollständig.');return normalizeMissionProposalChoice({id:input.candidateId+'-'+Date.now(),mode:'apt',profileId:context.dispatchProfileId||'auto',selectedCategory:'charter',requestedCategory:'charter',target:missionProposalCompactTarget(selected[i],'apt'),title:idea.reason,description:idea.background,subtitle:idea.groupLabel,paxText:`${idea.passengerCount} PAX (${idea.groupLabel})`,cargoText:`${idea.luggageLabel} (${idea.luggageWeightLbs} lbs)`,routeLabel:missionProposalFormatRoute(context.start,selected[i],'apt').label,charterProposal:{schema:'charter-proposal.v1',input,idea}});});}
async function story({start,dest,proposal,contract={}}){
 let input,idea;
 if(proposal){input={...proposal.input,maxPassengers:capacity(),recent:core().history(localStorage)};if(proposal.schema!=='charter-proposal.v1'||!root.MissionClubIdeasCore.sameRoute(input.route,{start:target(start),target:target(dest)}))throw Error('Charterauswahl passt nicht mehr zur Route.');idea=core().validate(proposal.idea,input);}
 else{input=await frame(start,dest);if(!input.maxPassengers)throw Error('Das Flugzeug bietet keinen freien Passagierplatz.');const prompt=core().ideaPrompt([{candidateId:'direct',...input}]);let result=await json(prompt);idea=core().validate(result.ideas?.[0],input);if(!idea){result=await json(prompt+'\nFORMATKORREKTUR: Behalte den Reiseanlass und die Personen des Entwurfs bei. Prüfe alle Feldlängen, Passagierkapazität und Trigger. Geo darf nur eine exakt gelieferte anchorId samt Koordinaten verwenden; andernfalls einen passenden Prozenttrigger verwenden oder den Moment weglassen. Liefere erneut das vollständige JSON.\nENTWURF: '+JSON.stringify(result));idea=core().validate(result.ideas?.[0],input);}}
 if(!idea)throw Error('Charterauftrag ist unvollständig oder die Gruppe passt nicht zur aktuellen Kapazität. Bitte neu auswählen.');
 const api=root.MissionPrivateEpisodeV6,context=api.flightContext(contract),flight={context,bindings:api.flightBindings(context)};
 const prompt=core().writerPrompt(idea,flight,input.recent);
 let raw=await json(prompt),resolved=core().resolveReferences(raw,flight.bindings);
 let written=resolved&&core().prose(resolved),brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 if(!written){
  raw=await json(prompt+'\nKORREKTUR: Der erste Entwurf hat die Formatprüfung nicht bestanden. Kürze greeting auf maximal 400 Zeichen, title auf 110, memory auf 600, story auf 250–1800. Liefere das vollständige JSON erneut. Behalte Kundenauftrag und Personen bei. In doppelten eckigen Klammern stehen ausschließlich die SCHLÜSSEL aus WERTE, niemals deren aufgelöste Werte oder Ortsnamen. Erlaubte Referenzen: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+' . Alle Referenzen müssen in WERTE existieren; flightBriefing verwendet ausschließlich diese Referenzen für Zahlen und Einheiten und enthält die geforderten vorhandenen Distanz-/Böenwerte.\nERSTER ENTWURF: '+JSON.stringify(raw));
  resolved=core().resolveReferences(raw,flight.bindings);written=resolved&&core().prose(resolved);brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 }
 if(!written)throw Error('Das Charterbriefing enthält ungültige Texte oder Referenzen. Bitte erneut versuchen.');
 const hasWeather=context.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null);
 if(!hasWeather)brief='Für Start und Ziel liegen derzeit keine verwertbaren Wetterbeobachtungen vor.';
 else if(!brief){
  try {
   const repair=await json('Erstelle ausschließlich den Wetterabsatz für den bestehenden Flug. Die Geschichte bleibt unverändert. Nur JSON {flightBriefing}. Maximal 850 Zeichen. Zahlen und Einheiten nur über die folgenden Referenzschlüssel in doppelten eckigen Klammern: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+'. Vorhandene route.distance, start.gust und target.gust verwenden. Stationsbezug und Beobachtungszeit nennen; alte oder zeitlich unbekannte Meldungen als solche kennzeichnen. Fehlende Werte sind unbekannt, nicht null Wind oder böenfrei. Keine technischen Feldnamen in der Prosa. Keine aktuellen Bedingungen zwischen den Stationen oder Ankunftsprognosen behaupten. FLUGDATEN: '+JSON.stringify(context)+' WERTE: '+JSON.stringify(flight.bindings));
   brief=api.resolveFlightBriefing(repair.flightBriefing,context);raw.flightBriefing=repair.flightBriefing;
  }catch(error){console.warn('[Charter] Wetterabsatz konnte nicht separat korrigiert werden.');}
 }

 const m=core().mission(idea,written,brief,contract.route||{});
 m._missionWriterV4Debug.weatherSnapshot=context.weather;
 m._missionWriterV4Debug.rawFlightBriefing=raw.flightBriefing||'';m._missionWriterV4Debug.historyCount=input.recent.length;
 Object.assign(contract,{status:'ready',profile:{id:'auto',taskDomain:'charter',roleProfile:'charter_professional_neutral_v1'},charterIdea:m.charterIdea,passenger:m.passenger,passengerCount:m.passengerCount,plannedPassengerCount:m.passengerCount,party:m.party,paxText:m.pax,cargoText:m.cargo,missionStory:m.s,storyFrame:{trigger:idea.reason,whyNow:idea.background,soughtOutcome:idea.arrival,noDelivery:true},target:input.route.target});
 m._missionContractV4=contract;return m;
}
root.MissionCharterBrowser={choices,story};
})(window);
