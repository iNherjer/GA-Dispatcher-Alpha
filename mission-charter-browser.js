(function(root){
'use strict';
const L=(de,en)=>root.MissionOutputLanguage?root.MissionOutputLanguage.text(de,en):de;
const core=()=>root.MissionCharterIdeasCore;
const target=a=>({name:a.n||a.name||a.icao||'',icao:a.icao||'',lat:Number(a.lat),lon:Number(a.lon)});
function capacity(){const c=getMissionAircraftCapabilitySnapshot();return Math.min(5,c.passengerCapacity||0);}
async function frame(start,dest,occasion,event=null){const route={start:target(start),target:target(dest)};let places=[];try{places=(await root.MissionPrivateContextCore.resolveBrowser(route.target)).places||[];}catch{}
 const anchors=root.MissionClubIdeasCore.frame(route,[],null,'',places).geoAnchors;
 return {...core().frame(route,capacity(),core().history(localStorage),anchors,occasion||core().pickOccasions(core().history(localStorage),1)[0],event),requireReturnPlan:true};}
function today(){return new Date().toLocaleDateString('en-CA');}
// Veranstaltungssuche am Zielort: nur mit Gemini, Fehler oder kein Treffer blockieren den Picker nicht.
async function findEvent(airport,occasion,recent){
 const api=root.MissionCharterEventsCore,t=target(airport),any=!occasion,mode=any?'fixed-target':'occasion';root.gaCharterEventSearch={status:'searching',mode,airport:t.icao,occasion:occasion?.id||null};
 try{
  if(getSelectedAiProvider()!=='gemini')throw Error('Eventsuche benötigt derzeit Gemini');
  const place={name:api.placeName(airport)||t.name,lat:t.lat,lon:t.lon};
  const result=await api.search({place,date:today(),kinds:any?api.KINDS:api.FITS[occasion.id],apiKey:getSelectedAiApiKey(),storage:localStorage});
  const m=any?api.pickKinds(result.events,t,api.KINDS,root.MissionPrivateContextCore.distanceKm,recent):api.pick(result.events,t,occasion.id,root.MissionPrivateContextCore.distanceKm,recent);
  root.gaCharterEventSearch={status:'ready',mode,airport:t.icao,place:place.name,occasion:occasion?.id||null,count:result.events.length,queries:result.queries,matched:m?.event.id||null,matchedTitle:m?.event.title||null,verification:m?.event.verification||null,cacheHit:result.cacheHit};
  return m;
 }catch(error){root.gaCharterEventSearch={status:'unavailable',mode,airport:t.icao,error:String(error.message)};console.warn('[Charter] Optionale Veranstaltungssuche nicht verfügbar.');return null;}
}
// Fester Zielplatz: Der Pilot hat oft einen Termin am Ziel im Kopf. Deshalb sucht die App dort alle
// Veranstaltungsarten ohne Taktung; ein Treffer bekommt eine dazu passende Reiseart, die übrigen Vorschläge
// bleiben frei und verschieden.
function occasionsForEvent(recent,count,event){
 const api=root.MissionCharterEventsCore,all=core().OCCASIONS.map(o=>o.id);
 if(!event)return core().pickOccasions(recent,count);
 const fitting=all.filter(id=>(api.FITS[id]||[]).includes(event.kind));
 const first=core().pickOccasions(recent,1,Math.random,all.filter(id=>!fitting.includes(id)))[0];
 return first?[first,...core().pickOccasions(recent,count-1,Math.random,[first.id])]:core().pickOccasions(recent,count);
}
async function json(prompt){const r=await fetchGeminiJsonWithFallback(root.MissionOutputLanguage?root.MissionOutputLanguage.wrap(prompt):prompt,getSelectedAiApiKey(),{promptVersion:'charter-v1',timeoutMs:40000});if(!r?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(r,'Charterauftrag'):Error('Charterauftrag konnte nicht erstellt werden. Bitte erneut versuchen.'));return r.parsed;}
async function choices(airports,context){if(airports.length<3)throw Error('Für Chartervorschläge fehlen passende Zielflugplätze.');
 // Ziele und Reisearten stehen zuerst fest. Danach höchstens eine Veranstaltungssuche am Ziel des ersten
 // Platzes, dessen Reiseart eine Veranstaltung tragen kann; ein Treffer muss zu dieser Reiseart passen.
 const recent=core().history(localStorage),selected=airports.slice(0,3);
 if(context.fixedTarget){
  const m=await findEvent(context.fixedTarget,null,recent);context.ensureAlive?.();
  const occasions=occasionsForEvent(recent,3,m?.event);
  return proposalsFrom(context,selected,occasions,m?0:-1,m);
 }
 const occasions=core().pickOccasions(recent,selected.length);
 const due=root.MissionGroundedEventsCore?.eventDue?root.MissionGroundedEventsCore.eventDue(recent,root.MissionCharterEventsCore?.EVENT_EVERY?.charter||2):true;
 const slot=root.MissionCharterEventsCore&&due?root.MissionCharterEventsCore.searchSlot(occasions):-1;
 if(!due)root.gaCharterEventSearch={status:'skipped',reason:'event-cadence'};
 else if(slot<0)root.gaCharterEventSearch={status:'skipped',reason:'no-event-occasion'};
 const eventMatch=slot>=0?await findEvent(selected[slot],occasions[slot],recent):null;context.ensureAlive?.();
 return proposalsFrom(context,selected,occasions,slot,eventMatch);}
async function proposalsFrom(context,selected,occasions,slot,eventMatch){
 const frames=await Promise.all(selected.map(async(a,i)=>({candidateId:'charter-'+i,...await frame(context.start,a,occasions[i],i===slot&&eventMatch?root.MissionCharterEventsCore.anchor(eventMatch.event):null)})));context.ensureAlive?.();
 if(!frames[0].maxPassengers)throw Error('Das Flugzeug bietet keinen freien Passagierplatz.');
 const raw=await json(core().ideaPrompt(frames));context.ensureAlive?.();
 return frames.map((input,i)=>{const rows=raw.ideas?.filter(x=>x.candidateId===input.candidateId)||[];const idea=rows.length===1&&core().validate(rows[0],input);if(!idea)throw Error('Ein Chartervorschlag ist unvollständig.');return normalizeMissionProposalChoice({id:input.candidateId+'-'+Date.now(),mode:'apt',profileId:context.dispatchProfileId||'auto',selectedCategory:'charter',requestedCategory:'charter',target:missionProposalCompactTarget(selected[i],'apt'),title:idea.reason,description:idea.background,subtitle:idea.event?`${idea.event.startsOn} · ${idea.event.title}`:idea.groupLabel,paxText:`${idea.passengerCount} PAX (${idea.groupLabel})`,cargoText:`${idea.luggageLabel} (${idea.luggageWeightLbs} lbs)`,routeLabel:missionProposalFormatRoute(context.start,selected[i],'apt').label,charterProposal:{schema:'charter-proposal.v1',input,idea}});});}
async function story({start,dest,proposal,contract={},fixedTarget=false}){
 let input,idea;
 if(proposal){if(proposal.idea?.event&&proposal.idea.event.endsOn<today())throw Error('Der Veranstaltungstermin ist abgelaufen. Bitte neue Vorschläge erstellen.');input={...proposal.input,maxPassengers:capacity(),recent:core().history(localStorage)};if(proposal.schema!=='charter-proposal.v1'||!root.MissionClubIdeasCore.sameRoute(input.route,{start:target(start),target:target(dest)}))throw Error('Charterauswahl passt nicht mehr zur Route.');idea=core().validate(proposal.idea,input);}
 else{let m=null,occasion;if(fixedTarget){const recent=core().history(localStorage);m=await findEvent(dest,null,recent);occasion=m?occasionsForEvent(recent,1,m.event)[0]:undefined;}input=await frame(start,dest,occasion,m?root.MissionCharterEventsCore.anchor(m.event):null);if(!input.maxPassengers)throw Error('Das Flugzeug bietet keinen freien Passagierplatz.');const prompt=core().ideaPrompt([{candidateId:'direct',...input}]);let result=await json(prompt);idea=core().validate(result.ideas?.[0],input);if(!idea){result=await json(prompt+'\nFORMATKORREKTUR: Behalte den Reiseanlass und die Personen des Entwurfs bei. Prüfe alle Feldlängen, Passagierkapazität und Trigger. Geo darf nur eine exakt gelieferte anchorId samt Koordinaten verwenden; andernfalls einen passenden Prozenttrigger verwenden oder den Moment weglassen. Liefere erneut das vollständige JSON.\nENTWURF: '+JSON.stringify(result));idea=core().validate(result.ideas?.[0],input);}}
 if(!idea)throw Error('Charterauftrag ist unvollständig oder die Gruppe passt nicht zur aktuellen Kapazität. Bitte neu auswählen.');
 return write(idea,input,contract);
}
// Diagnose für das Debug-Protokoll: welches Feld die Prüfung (prose/resolveReferences) nicht besteht.
function writerIssues(raw,bindings){
 if(!raw||typeof raw!=='object')return ['keine JSON-Antwort'];
 const out=[],limits={title:110,greeting:400,memory:600};
 for(const [k,max] of Object.entries(limits)){const v=raw[k];if(typeof v!=='string'||!v.trim())out.push(k+' fehlt');else if(v.trim().length>max)out.push(k+' '+v.trim().length+'>'+max);}
 if(typeof raw.story!=='string'||raw.story.trim().length<250)out.push('story '+(typeof raw.story==='string'?raw.story.trim().length:'fehlt')+'<250');
 for(const k of ['title','story','greeting','memory','pilotNotes']){if(typeof raw[k]!=='string')continue;
  for(const m of raw[k].matchAll(/\[\[([^\[\]]+)\]\]/g))if(!Object.prototype.hasOwnProperty.call(bindings||{},m[1]))out.push(k+' unbekannte Referenz [['+m[1].slice(0,40)+']]');
  if(/\[\[|\]\]/.test(raw[k].replace(/\[\[[^\[\]]+\]\]/g,'')))out.push(k+' offene Klammern');}
 return out.length?out.slice(0,8):['unbekannt'];
}
async function write(idea,input,contract,extraPrompt=''){
 // Ground appearance of the luggage: kept from the outbound idea, otherwise chosen by the composer beside the writer.
 // Testschalter ga_person_figures_v1: gemeinsamer Boden-Composer (Pax-Looks + Gepäck), sonst bisheriger Cargo-Composer.
 const cargoVisualTask=root.MissionGroundVisualCore?.enabled?.()?root.MissionGroundVisualCore.ensure(idea,json,{taskDomain:'charter',roleProfile:'charter_professional_neutral_v1'}):root.MissionCargoVisualCore?.ensure(idea,json);
 const api=root.MissionPrivateEpisodeV6,context=api.flightContext(contract),flight={context,bindings:api.flightBindings(context)};
 const pageWriter=p=>root.MissionAirportInformationBrowser?.writePages(p,contract,null,json)||json(p);
 const prompt=core().writerPrompt(idea,flight,input.recent)+extraPrompt;
 let raw=await pageWriter(prompt),resolved=core().resolveReferences(raw,flight.bindings);
 let written=resolved&&core().prose(resolved),brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 const firstIssues=written?null:writerIssues(raw,flight.bindings);
 if(!written){
  raw=await pageWriter(prompt+'\nKORREKTUR: Der erste Entwurf hat die Formatprüfung nicht bestanden. Kürze greeting auf maximal 400 Zeichen, title auf 110, memory auf 600, story auf 250–1800. Liefere das vollständige JSON erneut. Behalte Kundenauftrag und Personen bei. In doppelten eckigen Klammern stehen ausschließlich die SCHLÜSSEL aus WERTE, niemals deren aufgelöste Werte oder Ortsnamen. Erlaubte Referenzen: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+' . Alle Referenzen müssen in WERTE existieren; flightBriefing verwendet ausschließlich diese Referenzen für Zahlen und Einheiten und enthält die geforderten vorhandenen Distanz-/Böenwerte.\nERSTER ENTWURF: '+JSON.stringify(raw));
  resolved=core().resolveReferences(raw,flight.bindings);written=resolved&&core().prose(resolved);brief=api.resolveFlightBriefing(raw.flightBriefing,context);
 }
 if(!written){console.warn('[Charter] Writer-Prüfung fehlgeschlagen:',JSON.stringify({first:firstIssues,retry:writerIssues(raw,flight.bindings)}));throw Error('Das Charterbriefing enthält ungültige Texte oder Referenzen. Bitte erneut versuchen.');}
 const hasWeather=context.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null);
 if(!hasWeather)brief=L('Für Start und Ziel liegen derzeit keine verwertbaren Wetterbeobachtungen vor.','No usable weather observations are currently available for departure and destination.');
 else if(!brief){
  try {
   const repair=await json('Erstelle ausschließlich den Wetterabsatz für den bestehenden Flug. Die Geschichte bleibt unverändert. Nur JSON {flightBriefing}. Maximal 850 Zeichen. Zahlen und Einheiten nur über die folgenden Referenzschlüssel in doppelten eckigen Klammern: '+Object.keys(flight.bindings).map(k=>'[['+k+']]').join(', ')+'. Vorhandene route.distance, start.gust und target.gust verwenden. Stationsbezug und Beobachtungszeit nennen; alte oder zeitlich unbekannte Meldungen als solche kennzeichnen. Fehlende Werte sind unbekannt, nicht null Wind oder böenfrei. Keine technischen Feldnamen in der Prosa. Keine aktuellen Bedingungen zwischen den Stationen oder Ankunftsprognosen behaupten. FLUGDATEN: '+JSON.stringify(context)+' WERTE: '+JSON.stringify(flight.bindings));
   brief=api.resolveFlightBriefing(repair.flightBriefing,context);raw.flightBriefing=repair.flightBriefing;
  }catch(error){console.warn('[Charter] Wetterabsatz konnte nicht separat korrigiert werden.');}
 }

 if(contract.returnFlight){
  const returnContext=api.flightContext(contract.returnFlight),bindings=api.flightBindings(returnContext);
  let returnBrief=L('Für den besetzten Rückflug liegen derzeit keine verwertbaren Wetterbeobachtungen vor.','No usable weather observations are currently available for the occupied return flight.');
  if(returnContext.weather.some(w=>w.rawMetar||w.windKts!==null||w.visibilityKm!==null)){
   try{
    const rawReturn=await json('Schreibe nur den Wetterabsatz für den besetzten Charter-Rückflug. Nur JSON {flightBriefing}, maximal 850 Zeichen. Zahlen/Einheiten ausschließlich als [[Referenz]] aus WERTE. Vorhandene route.distance, start.gust und target.gust nennen. Stationsbezug, Aktualität und Datenlücken korrekt einordnen; keine Prognose oder Flugfreigabe. FLUGDATEN: '+JSON.stringify(returnContext)+' WERTE: '+JSON.stringify(bindings));
    returnBrief=api.resolveFlightBriefing(rawReturn.flightBriefing,returnContext)||'Der Wetterabsatz für den besetzten Rückflug konnte nicht erstellt werden; die einzelnen Wetterdaten bitte separat prüfen.';
   }catch{ returnBrief='Der Wetterabsatz für den besetzten Rückflug konnte nicht erstellt werden; die einzelnen Wetterdaten bitte separat prüfen.'; }
  }
  brief=L('Leerflug zur Abholung: ','Empty positioning flight for the pickup: ')+(brief||'Der Wetterabsatz konnte nicht erstellt werden; die Wetterdaten bitte separat prüfen.')+L('\n\nBesetzter Rückflug: ','\n\nOccupied return flight: ')+returnBrief;
 }
 await cargoVisualTask;
 const m=core().mission(idea,written,brief,contract.route||{});
 m._missionWriterV4Debug.weatherSnapshot=context.weather;
 m._missionWriterV4Debug.rawFlightBriefing=raw.flightBriefing||'';m._missionWriterV4Debug.historyCount=input.recent.length;
 Object.assign(contract,{status:'ready',profile:{id:'auto',taskDomain:'charter',roleProfile:'charter_professional_neutral_v1'},charterIdea:m.charterIdea,passenger:m.passenger,passengerCount:m.passengerCount,plannedPassengerCount:m.passengerCount,party:m.party,paxText:m.pax,cargoText:m.cargo,missionStory:m.s,storyFrame:{trigger:idea.reason,whyNow:idea.background,soughtOutcome:idea.arrival,noDelivery:true},target:input.route.target});
 m._missionContractV4=contract;return m;
}
async function continuation({req,base,contract,aiEnabled=true}) {
 const api=root.MissionCharterContinuationCore,c=api.context(req);
 if(!c)throw Error('Der Charter-Ursprung fehlt.');
 if(c.original.passengerCount>capacity())throw Error('Die ursprüngliche Chartergruppe passt nicht zur aktuellen Kapazität. Sie wird nicht verkleinert.');
 if(!aiEnabled)throw Error('Für die Charter-Fortsetzung bitte die KI aktivieren. Das Angebot bleibt erhalten.');
 if(!api.validateDraft(c.experience,c)){
  // The follow-up mission is always buildable: repair, one specific correction, then a plain stay.
  const prompt=api.draftPrompt(c);let raw=null,repaired={draft:null,issues:[]};
  try{raw=await json(prompt);repaired=api.repairDraft(raw,c);}catch(error){repaired.issues=[error?.message||'keine Antwort'];}
  if(!repaired.draft&&raw){try{raw=await json(api.correctionPrompt(prompt,raw,repaired.issues));repaired=api.repairDraft(raw,c);}catch(_){}}
  if(repaired.draft){
    const saved=root.missionFollowupSaveCharterExperience(req.id,repaired.draft);
    if(!saved)throw Error('Der Charter-Rückblick konnte nicht gespeichert werden. Bitte Speicher prüfen und erneut versuchen.');
    req.charterContinuation=saved;c.experience=saved.experience;
  }else{
   // Not stored: a later accept (after discarding the preview) gets a new chance at a real stay.
   const plain=api.fallbackDraft(c);
   console.warn('[Charter-Fortsetzung] Rückblick ersetzt durch schlichten Aufenthalt',repaired.issues);
   if(!plain)throw Error('Der Charter-Ursprung ist unvollständig. Das Angebot bleibt erhalten.');
   req.charterContinuation={...req.charterContinuation,experience:plain};c.experience=plain;
  }
 }
 // Mode is runtime data, never chosen by the language model.
 req.charterContinuation={...req.charterContinuation,pickupRequired:!!base.bush};
 const idea=api.continuationIdea(req);
 const input={recent:core().history(localStorage),route:idea.route};
 const written=await write(idea,input,contract,'\nFORTSETZUNG: Erzähle den gespeicherten Aufenthalt und den jetzigen Rückreiseauftrag. Verbinde einen konkreten kurzen Rückblick mit dem aktuellen Stand des Kundenanliegens und dem nächsten Schritt nach der Rückkehr zu einer flüssigen Geschichte. Erkläre anschließend knapp den anstehenden Flug. Bleibe außenstehender Erzähler; nur greeting ist direkte Rede. Der professionelle Rahmen darf menschlich und warm wirken. Überlasse persönliche Vertiefungen den späteren Gesprächen, statt diese im Briefing vorwegzunehmen. Erfinde keine neue Version des Erlebnisses. Der Pilot war nicht automatisch dabei. Der gesamte Flug liegt noch bevor. greeting ist erst beim tatsächlichen Boarding zu hören. Ablauf und Startort: '+JSON.stringify({acceptance:req.acceptance,pickupRequired:!!base.bush,continuity:req.charterContinuation})+'. Bei Abholung zuerst leer zum Aufenthaltsplatz, danach die vollständige Gruppe zum ursprünglichen Startplatz; ein Drittplatz des Piloten ist nicht das Kundenziel. Wetterdaten gelten ausschließlich für die jeweils ausdrücklich genannte Strecke.');
 const m=api.applyMission(req,base,written);
 if(m.charterIdea&&!m.charterIdea.cargoVisual&&written.charterIdea?.cargoVisual)m.charterIdea.cargoVisual=written.charterIdea.cargoVisual;
 if(m.charterIdea&&!m.charterIdea.groundVisual&&written.charterIdea?.groundVisual)m.charterIdea.groundVisual=written.charterIdea.groundVisual;
 Object.assign(contract,{charterIdea:m.charterIdea,bush:m.bush,passenger:m.passenger,passengerCount:m.passengerCount,plannedPassengerCount:m.plannedPassengerCount,party:m.party,paxText:m.pax,cargoText:m.cargo,followUpContinuation:m.followUpContinuation});
 m._missionContractV4=contract;return m;
}
root.MissionCharterBrowser={choices,story,continuation};
})(window);
