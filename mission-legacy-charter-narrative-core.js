/* Optional personal stories for legacy Charter pickup; no execution decisions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionLegacyCharterNarrativeCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const SCHEMA='ga.legacy-charter-memory.v1';
 const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n?v.trim():null;
 function owns(m={}){
  const contract=m.missionContractV4||m.missionContract||{};
  return !m.isPOI&&m.missionType!=='poi'&&m.missionType!=='bush'&&!m.charterIdea&&!m.aptNewsIdea&&!contract.charterIdea&&!contract.aptNewsIdea&&!m.followUpContext?.charterContinuation&&!contract.followUpContext?.charterContinuation
   && (!m.bush||m.bush.profileId==='apt_charter_pickup')
   && (contract.profile?.taskDomain==='charter'||contract.profile?.pickerCategory==='charter'||m.passenger?.taskDomain==='charter'||['apt_charter','apt_charter_pickup'].includes(m._appliedProfile||m.dispatchProfileId));
 }
 function memory(raw){
  if(!raw||!text(raw.summary,700)||!text(raw.person?.name,120)||!text(raw.person?.role,160)||!text(raw.stayIdea,700))return null;
  return {summary:raw.summary.trim(),person:{name:raw.person.name.trim(),role:raw.person.role.trim()},stayIdea:raw.stayIdea.trim()};
 }
 function complete(m,record){
  const raw=m?.legacyCharterNarrative,valid=raw?.schema===SCHEMA&&memory(raw.memory);
  if(!valid||record?.result!=='completed'||record.failed||record.cargo?.failed||m.missionFailed||!record.missionId||record.missionId!==m.missionId)return null;
  return {schema:SCHEMA,memory:valid,sourceMissionId:m.missionId,completion:{completionId:record.completionId||null,endedAt:record.endedAt||null,result:'completed'}};
 }
 function context(req){
  if(req?.sourceKind!=='apt_charter'||req.followUpKind!=='apt_charter_pickup'||req.charterContinuation)return null;
  const raw=req.narrativeMemory?.legacyCharterNarrative,valid=raw?.schema===SCHEMA&&memory(raw.memory);
  const matching=valid&&valid.person.name===req.passenger?.name&&valid.person.role===req.passenger?.role;
  return {memory:matching?valid:null,sourceStory:req.source?.story||'',passenger:req.passenger||null,temporalContext:req.temporalContext||null,sourceCargoText:req.narrativeMemory?.sourceCargoText||null};
 }
 function prompt(c={}){
  if(!owns(c))return '';
  const continuation=c.followUpContext?.legacyCharterContinuation||c.missionContractV4?.followUpContext?.legacyCharterContinuation||null;
  return '\nPERSÖNLICHER CHARTER-AUFENTHALT: Der Gast hat ein individuelles Anliegen und eine eigene Haltung dazu. Die Beförderung ist bereits gebucht; erzähle sein Anliegen ohne Straßenvergleich oder Rechtfertigung der Flugwahl. Aufenthaltsdauer natürlich und ungefähr passend zum übergebenen Zeitkontext ausdrücken; technische Planungszahlen sind keine exakt nötigen Arbeitszeiten. Auch bei einem Geschäftstermin trägt sein persönlicher Bezug die Geschichte: was ihm daran wichtig ist und wie ihn der Aufenthalt berührt. Briefing in Erzählerperspektive, persönliche Ich-Rede nur als Zitat oder Begrüßung des Gasts an den Piloten. Beim Hinflug bleibt das Vorhaben am Boden offen. Ergänze das vorhandene Writer-JSON im selben Aufruf um legacyCharterMemory:{summary,person:{name,role},stayIdea}; summary bis 700 Zeichen beschreibt den bisherigen Anlass, stayIdea bis 700 Zeichen eine konkrete mögliche persönliche Entwicklung während des Aufenthalts, mit erlebbarer Handlung und der Haltung des Gasts dazu. Namen und Rollen aus passenger übernehmen. Keine feste Ereignisliste oder Pflichtpointe. Beim Folgeflug erzähle, was aus dem ursprünglichen Anliegen während des vereinbarten Aufenthalts geworden ist, wie der Gast das erlebt hat und was ihn nun nach Hause zieht. Gestalte die gelieferte stayIdea passend aus; bei Altdaten entwickle den Aufenthalt aus sourceStory selbst. Der konkret erlebte Aufenthalt ist der Erzählkern des Folgebriefings; Abholung und Heimreise bilden seinen kurzen Rahmen. Erzähle die Entwicklung wirklich aus, statt sie als erfolgreich erledigten Termin oder bloßen Aktivitätsnamen zusammenzufassen. Das Folgebriefing darf eine ausführliche kleine Geschichte aus dem Aufenthalt erzählen: konkrete Begegnungen, Gespräche, Tätigkeiten, überraschende Entwicklungen und die persönliche Reaktion des Gasts. Wähle einen zusammenhängenden Faden und erzähle seine Details schon im Briefing, ohne sie künstlich für Bordansagen zurückzuhalten. Umfang folgt dem Erzählstoff; die allgemeine Vorgabe von vier bis sechs Sätzen ist hier keine feste Obergrenze. Bleibe in der Erzählerperspektive, zugeordnete Zitate sind erlaubt. Der Gast vertieft diese Vorgeschichte später an Bord mit Einzelheiten, Gedanken und Anekdoten aus demselben Aufenthalt. Halte die wichtigen Erlebnisse und seine Haltung in summary und stayIdea konkret fest, damit Briefing, Begrüßung und Bordgespräch dieselbe persönliche Geschichte weiterführen. Begegnungen, Erlebnisse und Entwicklungen dürfen fiktiv sein. Der Pilot war nicht automatisch beim Aufenthalt dabei. Verwende dieselbe Person und ihr Gepäck; heutige Route, Pickup-/Boarding-Ablauf, Cargo und Freigaben bleiben aus dem Vertrag. Auf dem Leerflug sitzt der Gast noch nicht im Cockpit. Seine passenger.greetingText begrüßt nach der Aufnahme den Piloten mit persönlichem Bezug zum Aufenthalt; er spricht nicht als Pilot zu sich selbst. Die Erinnerung schreibt den aktuellen Stand fort, erzeugt keinen weiteren Auftrag.\nLEGACY_CHARTER_CONTINUATION='+JSON.stringify(continuation)+'\n';
 }
 function attach(m,raw,c={}){
  if(!owns(c))return m;
  const valid=memory(raw?.legacyCharterMemory),p=m.passenger;
  const matching=valid&&p&&valid.person.name===p.name&&valid.person.role===p.role;
  m.legacyCharterNarrative=matching?{schema:SCHEMA,memory:valid}:null;
  if(c.missionContractV4)c.missionContractV4.legacyCharterNarrative=m.legacyCharterNarrative;
  const g=text(raw?.passenger?.greetingText,600);
  if(matching&&g&&raw.passenger.name===p.name&&raw.passenger.role===p.role)p.greetingText=g;
  return m;
 }
 function pickupPassenger(locked,generated){
  const valid=generated?.legacyCharterNarrative?.schema===SCHEMA&&memory(generated.legacyCharterNarrative.memory),g=text(generated?.passenger?.greetingText,600);
  return valid&&g&&valid.person.name===locked?.name&&valid.person.role===locked?.role&&generated.passenger.name===locked?.name&&generated.passenger.role===locked?.role?{...locked,greetingText:g,pickupStory:{...locked.pickupStory,whyThere:valid.summary,boardingCue:g}}:locked;
 }
 function pickupBush(locked,lockedPassenger,generated){
  if(locked?.profileId!=='apt_charter_pickup')return locked;
  const p=pickupPassenger(lockedPassenger,generated);
  if(p===lockedPassenger)return locked;
  return p?.pickupStory?{...locked,pickupStory:{...locked.pickupStory,...p.pickupStory}}:locked;
 }
 return {SCHEMA,owns,memory,complete,context,prompt,attach,pickupPassenger,pickupBush};
});
