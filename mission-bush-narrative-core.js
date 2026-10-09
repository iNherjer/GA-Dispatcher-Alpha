/* Bush stories: a shared planning/telemetry policy, never a mission-success rule. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./map-navigation-geometry.js'));
 else root.MissionBushNarrativeCore=factory(root.GAMapNavigationGeometry);
})(typeof window!=='undefined'?window:null,function(nav){
 'use strict';
 const VERSION='bush-narrative.v1',HISTORY_KEY='ga_bush_narrative_history_v1';
 const HISTORY_LIMIT=12,HISTORY_MAX_BYTES=24*1024,HISTORY_PROMPT_MAX_CHARS=6000;
 const clean=(s,n=1200)=>typeof s==='string'?s.trim().slice(0,n):'';
 const weatherIdeaInstructions="BUSH-WETTER: Nutze Wetter als praktischen Hintergrund. Ein wettergetriebener Auftrag folgt einem belegten markanten Wetterereignis oder einer gelieferten Meldung mit Ort und Zeit. Die Jahreszeit darf einen längerfristigen zeitlichen Anker liefern, etwa Herbstwartung ohne Zeitdruck. Gewöhnliche Wetterwerte und die Jahreszeit allein begründen weder drohenden Schnee noch ein knappes letztes Flugfenster; wetterbedingte Eile braucht ein konkret belegtes bevorstehendes Ereignis. Menschliche und fachliche Anlässe dürfen unabhängig davon tragen. Leite whyNow zuerst aus dem nächsten Schritt der Person oder des Auftraggebers ab. Saisonale Vorsorge kann einfach ein sinnvoller heutiger Auftrag sein; normale aktuelle Wetterwerte beschreiben nur den Flugrahmen, nicht den Grund, weshalb der Auftrag gerade jetzt erledigt werden muss. Auch eine im Planner erfundene Wetterfrist ist kein zusätzlicher Wetterbeleg für den Writer.";
 const sourcePolicy="BUSH-REALITÄT UND FIKTION: Gelieferte Ziel-, Platz-, Wetter- und Vertragsdaten sind die Anker. Personen, Beziehungen, Erinnerungen, Alltagsdetails und plausible lokale Begleitumstände der Simulatorwelt darfst du frei erfinden; nicht jede erzählerische Ergänzung braucht einen Beleg oder Fiktionshinweis. Widersprich bekannten Daten nicht. Sachliche Platz-/Zielseiten und Navigationshinweise nutzen die gelieferten Quellen; fehlende Angaben bleiben dort unbekannt. Erfundene Details begründen keine Flugfreigabe, Hindernisfreiheit, sichere Bahnleistung oder zusätzliche Pilotaufgabe. Erfinde keine Quellen oder Messwerte; eine Meldung oder Vermutung bleibt vom tatsächlich beobachteten Befund unterscheidbar.";
 function sourceBasis(input={}){
  input=input&&typeof input==='object'?input:{};
  const airport=input.airportInfoContext||null,environment=input.environmentContext||null;
  const weatherSlot=slot=>({status:slot?.status||'unavailable',source:slot?.source||null,location:slot?.location||null,units:slot?.units||null,retrievedAt:slot?.retrievedAt||null,current:slot?.current||null,forecastNext6Hours:slot?.forecastNext6Hours||null,forecastNext72Hours:slot?.forecastNext72Hours||null,past72Hours:slot?.past72Hours||null});
  return {schema:'bush-source-basis.v1',airport:airport?.airport||null,localSources:(Array.isArray(airport?.sources)?airport.sources:[]).filter(s=>s&&s.kind!=='pilot-handbook'),terrain:airport?.terrain||null,
   ...(input.bushReconContext?{reconTarget:input.bushReconContext.target,reconFacts:input.bushReconContext.targetFacts,reconAirport:input.bushReconContext.airportInfoContext?.airport,reconLocalSources:input.bushReconContext.airportInfoContext?.sources?.filter(s=>s.kind!=='pilot-handbook')}:{}),
   weather:{start:weatherSlot(environment?.start),target:weatherSlot(environment?.target),missionSnapshot:input.missionWeather||input.weather||null},
   limits:{narrativeIsEvidence:false,missingMeans:'unknown',liveCockpitWeather:'unknown unless supplied as live simulator telemetry',currentRunwayCondition:'unknown',densityAltitude:'unknown unless explicitly supplied as calculated value',localFacilities:'only explicit local-source or airport-data entries',terrainClassification:'unknown unless supplied by explicit local source; elevation alone is no valley or mountain classification',runwaySuitability:'unknown without aircraft-specific performance data',currentLight:'unknown; cloud percentage alone proves no visible light or view from cockpit',handbooks:'general guidance, no local evidence'}};
 }
 function sourcePrompt(input={}){input=input&&typeof input==='object'?input:{};return '\n'+weatherIdeaInstructions+'\n'+sourcePolicy+'\nBUSH_SOURCE_BASIS (Datenanker für sachliche Angaben): '+JSON.stringify(input.bushSourceBasis?.schema==='bush-source-basis.v1'?input.bushSourceBasis:sourceBasis(input))+'\n';}
 const point=p=>p&&typeof p.lat==='number'&&typeof p.lon==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180;
 const personalityInstructions="BUSH-PERSÖNLICHKEIT: Entwickle einen zum Auftrag passenden Menschen mit eigenem Anliegen und eigener Haltung. Berufliche, private, ruhige, kuriose und abenteuerliche Geschichten sind gleichwertig. Keine Pflichtschimpfwörter. Eine Erinnerung, Beziehung, Handlung oder beiläufige Bemerkung kann Persönlichkeit zeigen; wähle selbst, was zur Geschichte passt. Briefing, Begrüßung und spätere Voices führen denselben persönlichen Kern fort, ohne ihn ständig zu wiederholen. Perspektive und Anwesenheit des Sprechers folgen dem Vertrag.";
 const instructions="Antworte im JSON-Format des Writers mit genau einem Objekt. BUSH-ERZÄHLUNG: Erzähle frei, lebendig und zusammenhängend. Ton, Einstieg und Verlauf entstehen aus dem Auftrag und den Beteiligten. Fiktive Erlebnisse, Humor, Gerüchte und maßvolle Übertreibung sind willkommen. Die Story ergänzt den Flugauftrag; Route, Fracht, Personen und Erfolgskriterien bleiben erhalten.";
 const writerInstructions=instructions+'\n'+personalityInstructions;
 const charterPlanningInstructions="BUSH-CHARTER-PERSONENPLAN: Antworte mit genau einem JSON-Objekt, nicht als Array. Plane einen individuellen Gast und einen glaubwürdigen beruflichen, privaten oder ungewöhnlichen Reisegrund. Das technische Rollenprofil bestimmt keine nüchterne Erzählweise. Kandidaten sind Inspiration; entwickle Person, Anliegen und passenden Hintergrund gemeinsam. Zeige, was diesem Menschen daran wichtig ist und wie er dazu steht, statt nur den Transport organisatorisch zu begründen. Nutze storyFrame.subjectDetail für Person und Anliegen, incidentContext für den passenden Hintergrund, whyNow für den heutigen Anlass und soughtOutcome für das Vorhaben am Boden. Eine Panne, Pointe oder private Nebenhandlung ist nicht nötig. Der Pilot bringt Gast und vereinbartes Gepäck zum Zielstrip; Absetzen und Übergabe schließen den Auftrag ab. Briefing und Begrüßung führen dieselbe Person fort.";

 const profileStoryDirections={
  bush_supply_strip:{focus:'Eine konkrete Lieferung und der Mensch am Boden, dem sie etwas ermöglicht.',connection:'Eine frühere Improvisation, eine kleine Absprache oder eine eigenwillige Arbeitsgewohnheit des Empfängers erklärt, weshalb genau diese Sendung heute gebraucht wird.',outcome:'Die Fracht am Zielstrip entladen und vereinbart übergeben; das Vorhaben des Empfängers bleibt offen.',voice:'Dispatch erzählt über Absender oder Empfänger am Boden. 0 PAX, keine Bordbegrüßung eines erfundenen Mitfliegers.'},
  bush_scenic_hopper:{focus:'Ein individueller Adventure-Gast mit einem konkreten Outdoor-Vorhaben nach der Landung: was er selbst ausprobieren, entdecken oder anders als beim letzten Mal erleben möchte.',connection:'Ein früherer Versuch, eine Freundschaft, ein kleiner Erfolg oder eine selbstironische Vorbereitung erklärt, was der Gast nach der Landung erleben möchte.',outcome:'Am Zielstrip landen; der Ausflug beginnt erst am Boden. Kein Rundflug und keine Rückkehr zum Heimatplatz.',voice:'Der Gast begleitet den Hinflug. Begrüßung und spätere Geschichten tragen denselben Wunsch und seine eigene Haltung.'},
  bush_pickup_strip:{focus:'Die Person, die am Zielstrip wartet, ihre konkrete Vorgeschichte und ihr persönlicher Rückkehrgrund.',connection:'Was hat sie während ihres Aufenthalts erlebt, wie steht sie dazu und was möchte sie nun mit nach Hause nehmen oder dort tun? Übernimm eine gesperrte Follow-up-Person und deren wirkliche Vorgeschichte unverändert.',outcome:'Leer zum Strip, dort den Gast aufnehmen, zum Heimatplatz zurück und dort aussteigen lassen. Eine Abholung ist keine erfundene Notrettung.',voice:'Der Gast sitzt auf dem Hinflug noch nicht neben dem Piloten. Boarding und eigene Erzählung beginnen erst nach der Aufnahme am Zielstrip auf dem Rückflug.'},
  bush_pickup_cargo:{focus:'Die konkrete Sache, die zurückgeholt wird, und der Mensch, dessen Geschichte daran hängt.',connection:'Eine abgeschlossene Arbeit, eine frühere Improvisation, eine Rückgabe oder eine persönliche Bindung erklärt, weshalb genau dieses Material zurück zur Basis soll. Frachtlabel und Gewicht bleiben Vertragsdaten.',outcome:'Leer zum Strip, dort die vereinbarte Fracht laden, zum Heimatplatz zurück und dort ausladen. Kein zusätzlicher Passagier.',voice:'Dispatch erzählt über den Kontakt am Boden; die Ladung erhält keine Stimme. Keine Passagierbegrüßung und keine erfundene Bordbegleitung.'},
  bush_recon_return:{focus:'Ein konkreter Aufklärungsanlass am vertraglichen Platz oder Gebiet trägt die Geschichte: ein gemeldetes Ereignis, eine Auffälligkeit oder eine begründete Vermutung. Erkläre, warum der Flug nötig ist, was aus der Luft untersucht werden soll und weshalb das für die Beteiligten wichtig ist.',connection:'Die persönliche Note vertieft genau diesen Anlass: Beziehung der beteiligten Person zum Ereignis, eigene Haltung, Sorge, Hoffnung oder damit verbundene Erfahrung. Erzähle den Kern persönlich, statt eine unabhängige Personenanekdote danebenzustellen. Den Untersuchungsbefund nicht vorwegnehmen; die Ungewissheit braucht keinen erklärenden Metasatz.',outcome:'Das vertragliche Recon-Gebiet aus der Luft beobachten und zum Heimatplatz zurückkehren; keine zusätzliche Landung, Reparatur oder garantierter Befund.',voice:'Nur ein tatsächlich vertraglich mitfliegender Beobachter darf sprechen; andernfalls bleibt die Perspektive beim Dispatch und Auftraggeber am Boden.'}
 };
 function reconWriterPrompt(c,shared,airport){
  if(!c||!shared)return '';
  return '\nBUSH-RECON-ZIELSEITE: Schreibe im vorhandenen JSON targetInfo als eigenständigen, zusammenhängenden Text über das Beobachtungsobjekt. Beschreibe belegte Identität, Zweck und gegebenenfalls Geschichte, Lage und hilfreiche Orientierung. Erarbeite zuerst reconUsedFacts:[{sourceId,evidence,statement}] ausschließlich aus RECON_INFORMATION und NAVIGATION; diese Arbeitshilfe ist kein Nutzertext. Formuliere reale Objektangaben danach nur aus diesen Belegen. Zweck und Geschichte bei fehlenden Belegen offenlassen, persönliche Erlebnisse belegen weder Fundamente noch Hangneigung, Zufahrten, Antennenart oder lokale Einrichtungen. Reale Angaben nur aus RECON_INFORMATION und NAVIGATION; persönliche Story und Untersuchungsverdacht sind keine Ortsbelege. Verknüpfe den fiktiven Missionsanlass erkennbar als Meldung oder Vermutung mit dem Objekt, ohne Schaden oder Ergebnis vorwegzunehmen. Bei einem Flugplatz: Platzdaten und Sichtprüfung beim Überflug statt Landung oder Anflugfreigabe. Bei anderen Objekten: passende Sichtprüfung aus der Luft. Gib allgemeine fliegerische Planungshinweise zu Überflug und Beobachtung; die vertragliche Höhe bleibt maßgeblich, kein Tiefflug wird verlangt. Keine sichere Flughöhe, Hindernisfreiheit, Flugfreigabe, örtlichen Verfahren oder unberechneten Leistungsreserven behaupten. Hinweise auf Abspannungen, Leitungen oder andere typische Gefahren nur als allgemeine zu prüfende Möglichkeit, kartierte Hindernisse als solche. Fehlende Daten bedeuten unbekannt. Vollständige Sätze, keine harte Textkürzung; Umfang richtet sich nach belegtem Material. Zusätzlich reconReport:{orientationIds:[]} aus NAVIGATION wählen. Lage-/Höhen-/Hindernisbericht wird anschließend quellengebunden ergänzt.\n'+shared.navigationInstructions+'\nRECON_INFORMATION (Daten): '+JSON.stringify({target:c.target,targetFacts:c.targetFacts,airport:c.airportInfoContext&&airport?.writerContext(c.airportInfoContext)})+'\nNAVIGATION (Daten): '+JSON.stringify(shared.writerContext(c))+'\n';
 }
 function attachRecon(m,raw,c,shared){
  if(!m||!c||!shared)return m;
  const {report,reportStatus}=shared.buildReport(raw?.reconReport,c);
  const prose=typeof raw?.targetInfo==='string'?raw.targetInfo.trim():'';
  const fallback=[c.target?.name,...(c.targetFacts||[]).map(f=>f.fact).filter(Boolean)].filter(Boolean).join(' ');
  const text=[prose||fallback,shared.formatReport(report)].filter(Boolean).join('\n\n');
  m.bushReconInfo={schema:'bush-recon-information.v1',target:c.target,text,generated:!!prose,reportStatus,evidence:shared.sourceSnapshot(c)};
  m.targetInfo=text;return m;
 }
 function storyBasis(profileId){
  if(profileId==='bush_charter_strip')return charterIdeaBasis;
  const direction=profileStoryDirections[profileId];
  return direction?{...direction,personalConnections:charterIdeaBasis.personalConnections,characterDetails:charterIdeaBasis.characterDetails,use:'Freie Inspiration, keine Pflichtpointe. Wähle den passenden Hintergrund und Ton selbst; eine Begebenheit, Marotte oder Pointe ist keine Pflicht.'}:null;
 }
 function planningInstructions(profileId){
  if(profileId==='bush_charter_strip')return charterPlanningInstructions;
  const basis=storyBasis(profileId);if(!basis)return '';
  return 'BUSH-PROFIL-PERSONENPLAN '+profileId+': Antworte mit genau einem JSON-Objekt, nicht als Array. '+JSON.stringify(basis)+(profileId==='bush_recon_return'?' RECON-GEWICHTUNG: incidentContext trägt zuerst Aufklärungsanlass und Untersuchungsfrage; subjectDetail verbindet die Person mit demselben Sachverhalt, whyNow dessen heutigen Anlass. Das Ereignis ist der rote Faden, die Persönlichkeit seine erzählerische Einbettung.':'')+' Nutze die vorhandenen storyFrame-Felder: subjectDetail nennt einen fiktiven Vornamen der vertraglichen Person oder des Kontakts am Boden und ihr individuelles Anliegen; incidentContext liefert den zum Auftrag passenden Hintergrund; whyNow erklärt den heutigen Anlass ohne künstliche Eile; soughtOutcome hält sein offenes Vorhaben und den vertraglichen Pilotabschluss auseinander. Fiktive Personen, Erlebnisse und plausible Begleitumstände sind erlaubt; bekannte Daten bleiben die Anker. Namen, Rollen, Fracht, Route und Erfolgskriterien des Vertrags bleiben bindend.';
 }
 function writerRecipe(profileId){
  if(profileId==='bush_charter_strip')return charterWriterRecipe;
  const basis=storyBasis(profileId);if(!basis)return null;
  return {tone:'persönlicher mündlicher Bush-Dispatch, dessen Haltung aus der konkreten Geschichte entsteht',perspective:'Dispatcher spricht dich als Piloten an; direkte PAX-Rede nur bei tatsächlich anwesendem vertraglichem Passagier',length:'Freier zusammenhängender Text mit vollständigen Sätzen; keine harte Zeichengrenze',requiredMeaning:[basis.focus,basis.outcome,basis.voice],softFreedom:'Erzähle passende kleine Handlungen und Eigenheiten aus storyFrame; der technische Flugauftrag bleibt erhalten.',qualityQuestions:['Ist die persönliche Verbindung zum Auftrag konkret statt nur eine Berufsbezeichnung?','Ergibt sich der Ton aus Handlung oder Reaktion statt einem Persönlichkeitsetikett?','Passen Sprecher, Flugabschnitt und Abschluss zum Vertrag?'],styleRecipe:'Beginne mit dem konkreten Anliegen oder der Person dahinter. Erzähle die Begebenheit und ihre Reaktion natürlich als zusammenhängende Geschichte. Wähle Form, Ton und persönliche Details passend zum Anliegen; die Felder sind Material, keine Absatzschablone. '+(profileId==='bush_recon_return'?' Bei Recon beginne mit dem Aufklärungsanlass und bleibe bei dessen Bedeutung und Problematik. Die persönliche Haltung erzählt denselben Kern; keine separate Personenepisode und kein erklärender Satz über den noch offenen Befund.':'')+' '+basis.voice+' '+basis.outcome};
 }
 // A shorter occupational noun can name the same Charter guest (Fotografin / Projektfotografin).
 // Only complete words of at least five letters qualify, never arbitrary substring overlap.
 function charterRoleMatches(visibleRole,profileRole){
  const words=s=>String(s||'').split(/[^a-zäöüß]+/i).filter(w=>w.length>=5);
  return words(visibleRole).some(v=>words(profileRole).some(r=>r===v||r.endsWith(v)));
 }
 const charterIdeaBasis={
  focus:'Eine konkrete Begebenheit aus dem Arbeits- oder Privatvorhaben zeigt, wer dieser Mensch ist und wie er dazu steht. Auftrag und Persönlichkeit entstehen gemeinsam.',
  personalConnections:['eine frühere Improvisation und die eigene Reaktion darauf','eine schräge Absprache mit Kollegen oder Freunden','ein kleiner Erfolg, auf den die Person heimlich stolz ist','eine gut gemeinte Vorbereitung, über die sie heute selbst lachen muss','ein konkretes Erlebnis, das erklärt, warum ihr die Arbeit oder der Ausflug wichtig ist'],
  characterDetails:['eine kleine Gewohnheit beim Packen','eine liebevoll gepflegte oder reparierte persönliche Sache','ein trockener Kommentar über die eigene Marotte','eine selbstironische Erinnerung an einen früheren Versuch'],
  use:'Freie Inspiration, keine feste Story oder Pflichtliste. Genau ein Zusammenhang trägt die Geschichte. Die Person darf beruflich reisen; ihr Anliegen wird aus ihrer Sicht konkret. Vorhandene Kandidaten liefern nur Rolle und Tätigkeit, nicht die persönliche Motivation.'
 };
 const charterWriterRecipe={
  tone:'persönlicher, mündlicher Bush-Dispatch mit einer individuellen Person als Mittelpunkt',
  perspective:'Dispatcher spricht dich als Piloten direkt an; der Gast spricht selbst nur in greetingText und PAX-Voices',
  length:'Freier zusammenhängender Text, vollständig und ohne feste Satz- oder Zeichengrenze',
  softFreedom:'Die persönliche Verbindung und Eigenheit aus storyFrame dürfen mit weichen Alltagsdetails lebendig werden. Bewahre dieselbe Person und ihren Wunsch. Ergänze bei dünner Vorgeschichte einen passenden persönlichen Hintergrund, keine neuen Ortsfakten oder Pilotaufgaben.',
  requiredMeaning:['Der benannte Gast hat einen konkreten persönlichen Wunsch und einen erkennbaren Grund dafür.','Du bringst den Gast zum Zielstrip; Absetzen und vereinbarte Übergabe schließen den Pilotauftrag ab.'],
  qualityQuestions:['Erfahre ich etwas über diesen Menschen jenseits seines Berufs und Gepäcks?','Sprechen Briefing und Begrüßung von derselben Person und ihrem persönlichen Anliegen?','Werde ich als Pilot angesprochen und bleibt der Gastplan am Boden ein offenes Vorhaben?'],
  styleRecipe:'Erzähle einen persönlichen Dispatch an den Piloten. Entwickle Einstieg, Umfang und Ton aus dem Anliegen des Gastes. Hintergrund und Gepäck dürfen natürlich mitlaufen, ohne feste Begebenheit, Pointe oder Marotte. greetingText spricht als derselbe Gast; sein Vorhaben am Boden bleibt offen.'
 };
 const supplyInstructions='BUSH-VERSORGUNG: Eigenständiger A-B-Lieferauftrag aus Dispatch-Sicht, 0 PAX. Erzähle, wem die vereinbarte Ladung am Boden etwas ermöglicht und warum. Der Anlass darf ruhig, erfreulich, kurios oder abenteuerlich sein. Landung, bestätigtes Entladen und Übergabe schließen den Pilotauftrag ab; die weitere Arbeit bleibt beim Empfänger.';
 const supplyReceiverInstructions='BUSH-SUPPLY-ÜBERGABE: Sprich als Empfänger am Zielstrip, kein Mitflieger. Greife den Auftrag persönlich auf und erzähle, was die Ladung ermöglicht. Bestätige nur die tatsächlich erfolgte Übergabe; die weitere Arbeit und eine mögliche spätere Rückholung bleiben offen.';
 function supplyRegion(dest={}){
  return {country:clean(dest.country||dest.isoCountry||dest.countryCode,100),region:clean(dest.region||dest.isoRegion||dest.state,140),targetName:clean(dest.name||dest.n,140)};
 }
 function routePoint(a,b,t){
  const rad=Math.PI/180,d=nav.distanceNm(a,b)/3440.065*t,h=nav.bearingDeg(a,b)*rad,lat=a.lat*rad,lon=a.lon*rad;
  const destLat=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(h));
  const destLon=lon+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(destLat));
  return {lat:destLat/rad,lon:((destLon/rad+540)%360)-180};
 }
 function routePosition(f,route){
  let best=null,offset=0,total=0;
  for(let i=1;i<route.length;i++)total+=nav.distanceNm(route[i-1],route[i]);
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],length=nav.distanceNm(a,b),delta=nav.distanceNm(a,f)/3440.065;
   const angle=(nav.bearingDeg(a,f)-nav.bearingDeg(a,b))*Math.PI/180;
   const along=Math.atan2(Math.sin(delta)*Math.cos(angle),Math.cos(delta))*3440.065;
   // Projection must lie on the finite route leg, not behind takeoff/beyond arrival.
   if(length>0&&along>0&&along<length){
    const distance=nav.distanceNm(f,routePoint(a,b,along/length));
    if(!best||distance<best.distance)best={distance,progress:(offset+along)/total};
   }
   offset+=length;
  }
  return best;
 }
 function anchors(features,route){
  if(!Array.isArray(route)||route.length<2||!route.every(point))return [];
  const rows=[],seen=new Set();
  for(const f of (Array.isArray(features)?features:[])){
   const tags=f.tags||{},name=clean(f.name||f.n||tags.name,140),kind=clean(f.kind||f.category||f.rawType||tags.water||tags.natural||tags.historic||tags.tourism||tags.place||f.type,70);
   const id=clean(String(f.id||f.osmId||f.sourceId||''),160);
   if(!point(f)||!name||!id||seen.has(id))continue;
   if(!/lake|water|reservoir|river|island|peak|mountain|ridge|pass|cliff|historic|ruin|castle|viewpoint|dam|village|town|hamlet|forest/i.test(kind))continue;
   const position=routePosition(f,route);
   if(!position||position.distance>1.8)continue;
   const minimumRadiusNm=Math.max(0.5,Math.ceil((position.distance+0.15)*100)/100);
   seen.add(id);rows.push({id,name,kind,lat:f.lat,lon:f.lon,source:clean(f.source||'hosted-poi-tile',120),distanceToRouteNm:Math.round(position.distance*100)/100,routeProgress:Math.round(position.progress*1000)/1000,minimumRadiusNm});
  }
  return rows.sort((a,b)=>a.distanceToRouteNm-b.distanceToRouteNm||a.id.localeCompare(b.id)).slice(0,24);
 }
 function frame(input={}){
  const bush=input.bush||{},pickup=bush.targetMode==='strip_then_return'&&bush.pickupKind==='passenger';
  const speaker=input.passenger||null;
  if(!speaker||!clean(speaker.name,120)||bush.pickupKind==='cargo')return null;
  const home=bush.homeRef||input.start,target=bush.targetRef||input.target;
  if(!point(home)||!point(target))return null;
  const route=pickup?[target,home]:[home,target];
  const durationSeconds=Math.max(180,Math.round(nav.distanceNm(home,target)/Math.max(45,Number(input.cruiseKts)||100)*3600));
  return {schema:VERSION,speakerName:clean(speaker.name,120),role:clean(speaker.role,160),leg:pickup?'return':'outbound',
   region:{country:clean(input.country,100),region:clean(input.region,140)},route,durationSeconds,
   ...(storyBasis(bush.profileId) ? {character:{personality:clean(speaker.personality,300),greeting:clean(speaker.greetingText,800)}} : {}),
   story:clean(input.story,6000),pickupStory:bush.pickupStory||null,
   environmentContext:input.environmentContext||null,
   airportInfoContext:input.airportInfoContext||null,
   sourceBasis:sourceBasis(input),
   anchors:anchors(input.features,route),
   narrationBasis:{fixed:'Persönliche Erinnerung oder noch offener Wunsch; jederzeit während des Flugabschnitts gültig',geo:'Erinnerung, persönlich gehörte Geschichte oder natürliche Ortsansprache zu belegten Ankerdetails; nur Nähe bestätigt, keine Sichtprüfung',liveObservationsAvailable:false,arrivalStateAvailable:false,airportFactsSource:'airportInfoContext; story ist keine Quelle für Ortsdetails'}};
 }
 function compactHistory(row){
  if(!row||typeof row!=='object'||!clean(row.id,100))return null;
  return {id:clean(row.id,100),summary:clean(row.summary,300),speaker:clean(row.speaker,120),
   region:{country:clean(row.region?.country,100),region:clean(row.region?.region,140)},
   anecdotes:(Array.isArray(row.anecdotes)?row.anecdotes:[]).slice(0,12).map(e=>({kind:e.kind==='geo'?'geo':'fixed',place:clean(e.place,140),memory:clean(e.memory,140)})).filter(e=>e.memory)};
 }
 function boundHistory(rows,maxChars=HISTORY_MAX_BYTES/2){
  const result=(Array.isArray(rows)?rows:[]).slice(-HISTORY_LIMIT).map(compactHistory).filter(Boolean);
  while(result.length&&JSON.stringify(result).length>maxChars)result.shift();
  return result;
 }
 function history(storage){try{return boundHistory(JSON.parse(storage?.getItem(HISTORY_KEY)||'[]'));}catch{return [];}}
 function promptHistory(rows){return boundHistory(rows,HISTORY_PROMPT_MAX_CHARS);}
 function remember(storage,id,plan){
  if(!plan)return;
  const rows=history(storage).filter(r=>r.id!==id);
  rows.push({id,summary:plan.memory,speaker:plan.speakerName,region:plan.region,
   anecdotes:(plan.events||[]).map(e=>({kind:e.kind,place:e.geo?.name||'',memory:clean(e.memory||e.text,140)}))});
  try{storage?.setItem(HISTORY_KEY,JSON.stringify(boundHistory(rows)));}catch{}
 }
 function prompt(f,recent=[]){
  const fixedCount=Math.max(2,Math.min(6,Math.floor(f.durationSeconds/300)));
  return `${writerInstructions}\n${sourcePrompt(f)}\n${typeof globalThis.MissionEnvironmentCore?.prompt==='function'?globalThis.MissionEnvironmentCore.prompt(f.environmentContext):''}\nErzeuge zusätzliche Voice-Texte für denselben Auftrag. Ausgabesprache ist Deutsch, auch für Personen in Idaho; Ortsnamen bleiben unverändert. Keine neue Mission. Nutze narrativeBasis passend zur Perspektive: memory für ein früheres Erlebnis, hearsay für eine gehörte Geschichte, future_plan für ein offenes Vorhaben und place_comment für den nahen Geo-Ort. Führe den persönlichen Kern aus FRAME weiter und variiere Einstieg und Ton. Bei einer Abholung beschreiben airportInfoContext und dessen Quellen den Abholplatz, nicht automatisch den Rückkehrplatz. Fiktive Anekdoten und plausible Begleitumstände sind willkommen. FRAME.narrationBasis bestimmt den Wissensstand zum laufenden Flug: keine unbeobachteten heutigen Erfolge, Pannen oder Wetterverhältnisse als Cockpitbeobachtung erzählen. Ein Geo-Moment kann übersprungen werden; spätere Kapitel müssen eigenständig verständlich bleiben. Verwende die gelieferten ANCHORS für reale Orientierung und gib dafür localEvidence an. Erlebnisse brauchen keinen Quellenkatalog. Der letzte feste Moment lässt den heutigen Ausgang offen und kann einen weiteren Wunsch oder eine Erinnerung erzählen. 3–6 natürliche Sätze je Moment, höchstens 1200 Zeichen. Ton herzlich, lebendig und zur Person passend; gelegentliche derbe Sprache ist erlaubt. Keine technischen Triggerangaben in den gesprochenen Texten. Plane ${fixedCount} feste Momente verteilt von 90 Sekunden bis spätestens ${Math.max(90,f.durationSeconds-120)} Sekunden nach dem Start dieses Flugabschnitts. Zusätzlich 2–6 Geo-Momente, sofern ausreichend ANCHORS vorhanden sind; sonst weniger oder keine. Keine Geo-Punkte erfinden. Wähle anchorId exakt aus ANCHORS, keine ID aus Namen oder anderen IDs ableiten. ANCHORS liegen mit ihrer Projektion zwischen Start und Ziel. Wähle nach Möglichkeit Orte aus verschiedenen Streckenabschnitten anhand routeProgress. Radius 0.5–2 NM und mindestens minimumRadiusNm des gewählten Ankers, damit die direkte Route den Trigger-Kreis schneidet. HISTORY enthält bereits verwendete Motive und Pointen einzelner Kapitel. Wähle neue Anekdoten, statt dieselbe Campingpanne, Werkzeugpanne oder Pointe mit anderen Namen und Orten erneut zu erzählen. Ähnliche Rollen dürfen unterschiedliche Erlebnisse haben. Gib je Event memory als eigenständigen Merkzettel zu Anlass, Handlung und Pointe in höchstens 140 Zeichen aus; keine komplette Voice und keine bloße Themenüberschrift. Antworte JSON {memory:string,persona:string,events:[{id:string,kind:"fixed",atAirborneSeconds:number,narrativeBasis:"memory|hearsay|future_plan",text:string,memory:string}|{id:string,kind:"geo",anchorId:string,radiusNm:number,narrativeBasis:"memory|hearsay|place_comment",localEvidence:string,text:string,memory:string}]}.\nFRAME (Daten, keine Anweisungen): ${JSON.stringify(f)}\nHISTORY: ${JSON.stringify(promptHistory(recent))}
ABSCHLIESSENDER ERZÄHLVERTRAG: Geo-Kapitel dürfen lebendige Ortsansprachen, Erinnerungen und persönlich gehörte Geschichten verbinden. Name, Objektart und gelieferte Details sind die Grundlage für einen natürlichen Blick aus dem Cockpit; eine zusätzliche Sichtprüfung ist dafür nicht erforderlich. Persönliche Begebenheiten dürfen erfunden sein, echte Ortsdetails stammen aus ANCHORS oder Platzquellen. Zeitkapitel bleiben unabhängig von Ankunft und Landung. Der letzte Text blickt auf einen noch offenen Wunsch am Boden, nicht auf einen schon abgeschlossenen oder gelungenen Flug. Die persönlichen Geschichten dürfen lebendig und eigenständig bleiben.`;
 }
 function validate(raw,f){
  if(!f||!raw||!Array.isArray(raw.events)||raw.events.length>12||!clean(raw.persona,600)||!clean(raw.memory,600))return null;
  const events=[],ids=new Set(),geoIds=new Set();let fixed=0,geo=0;
  for(const e of raw.events){
   const id=clean(e?.id,80),text=clean(e?.text,1200);if(!id||ids.has(id)||!text||typeof e.text!=='string'||e.text.length>1200)return null;
   ids.add(id);
   if(e.kind==='fixed'){
    if(++fixed>6||!Number.isFinite(e.atAirborneSeconds)||e.atAirborneSeconds<90||e.atAirborneSeconds>Math.max(90,f.durationSeconds-120))return null;
    events.push({id,kind:'fixed',atAirborneSeconds:e.atAirborneSeconds,text,memory:clean(e.memory||text,140)});
   }else if(e.kind==='geo'){
    const a=f.anchors.find(a=>a.id===e.anchorId);
    if(++geo>6||!a||geoIds.has(a.id)||!Number.isFinite(e.radiusNm)||e.radiusNm<Math.max(0.5,a.minimumRadiusNm||0.5)||e.radiusNm>2)return null;
    geoIds.add(a.id);events.push({id,kind:'geo',geo:{...a,radiusNm:e.radiusNm},text,memory:clean(e.memory||text,140)});
   }else return null;
  }
  if(fixed<2)return null; // Geo stories supplement, never replace the fixed story.
  return {schema:VERSION,speakerName:f.speakerName,leg:f.leg,region:f.region,route:f.route,persona:clean(raw.persona,600),memory:clean(raw.memory,600),events};
 }
 function observe(plan,previous={},facts={}){
  const state=JSON.parse(JSON.stringify(previous||{})),result={state,event:null};
  state.done=Array.isArray(state.done)?state.done.slice(-12):[];
  if(plan?.schema!==VERSION||!Array.isArray(plan.events)||plan.events.length>12)return result;
  const leg=facts.returnLeg?'return':'outbound';
  if(state.leg!==leg){state.leg=leg;state.airborneSeconds=0;state.sampleAt=null;}
  const usable=facts.active&&!facts.ending&&facts.onGround===false&&!facts.paused&&!facts.slew&&facts.telemetryFresh!==false&&point(facts)&&Number.isFinite(facts.now);
  if(!usable||leg!==plan.leg||facts.speakerName!==plan.speakerName||facts.passengerOnboard!==true){state.sampleAt=null;return result;}
  const dt=Number.isFinite(state.sampleAt)?Math.max(0,Math.min(15,(facts.now-state.sampleAt)/1000)):0;
  state.airborneSeconds=(Number(state.airborneSeconds)||0)+dt;state.sampleAt=facts.now;
  if(!facts.enabled||facts.busy||(state.lastAt!=null&&facts.now-state.lastAt<90000))return result;
  const eligible=plan.events.filter(e=>!state.done.includes(e.id)&&(e.kind==='geo'?nav.distanceNm(facts,e.geo)<=e.geo.radiusNm:state.airborneSeconds>=e.atAirborneSeconds));
  const due=eligible.filter(e=>e.kind==='geo').sort((a,b)=>nav.distanceNm(facts,a.geo)-nav.distanceNm(facts,b.geo))[0]||eligible.filter(e=>e.kind==='fixed').sort((a,b)=>a.atAirborneSeconds-b.atAirborneSeconds)[0];
  if(due){state.done.push(due.id);state.lastAt=facts.now;result.event=due;}
  return result;
 }
 function normalizePlan(plan){
  if(plan?.schema!==VERSION||!Array.isArray(plan.route)||plan.route.length!==2||!plan.route.every(point)||!['outbound','return'].includes(plan.leg))return null;
  const events=Array.isArray(plan.events)?plan.events:[];
  if(events.some(e=>!e||(e.kind==='geo'&&!point(e.geo))))return null;
  const known=anchors(events.filter(e=>e.kind==='geo').map(e=>({...e.geo,tags:{natural:e.geo.kind}})),plan.route);
  const f={speakerName:plan.speakerName,leg:plan.leg,route:plan.route,region:plan.region,anchors:known,
   durationSeconds:Math.max(180,...events.filter(e=>e.kind==='fixed').map(e=>Number(e.atAirborneSeconds)+120))};
  if(!clean(plan.speakerName,120)||!Number.isFinite(f.durationSeconds)||f.durationSeconds>86400)return null;
  return validate({...plan,events:events.map(e=>e.kind==='geo'?{...e,anchorId:e.geo.id,radiusNm:e.geo.radiusNm}:e)},f);
 }
 function continuityHint(plan,spoken=[]){
  const rows=(Array.isArray(spoken)?spoken:[]).filter(e=>e?.text&&e.speakerName===plan?.speakerName).slice(-6);
  return rows.length?`\nBereits tatsächlich präsentierte Bush-Kapitel (nur diese sind erzählt worden; Gerüchte bleiben unbestätigt): ${JSON.stringify(rows.map(e=>({kind:e.kind,place:e.place||'',text:clean(e.text,1200)})))}. Greife bei passender Gelegenheit darauf zurück, ohne verpasste Kapitel zu unterstellen.`:'';
 }
 function speechPrompt(plan,event){return `${instructions}\nSprich als ${plan.speakerName}, Persönlichkeit: ${plan.persona}. Gib ausschließlich den folgenden vorbereiteten Text unverändert wieder, ohne Einleitung: ${JSON.stringify(event.text)}`;}
 return {VERSION,weatherIdeaInstructions,reconWriterPrompt,attachRecon,storyBasis,planningInstructions,writerRecipe,charterRoleMatches,charterIdeaBasis,charterPlanningInstructions,charterWriterRecipe,sourcePolicy,sourceBasis,sourcePrompt,supplyInstructions,supplyReceiverInstructions,supplyRegion,HISTORY_KEY,HISTORY_LIMIT,HISTORY_MAX_BYTES,HISTORY_PROMPT_MAX_CHARS,promptHistory,instructions,personalityInstructions,writerInstructions,routePoint,anchors,frame,prompt,validate,observe,normalizePlan,continuityHint,history,remember,speechPrompt};
});
