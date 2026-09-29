// Read-only source probe: real local tiles and public OSM requests, no Gemini call.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-poi-briefing-core.js';
import flight from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Provide fresh output path');
const cases=[{name:'Sommerbergtunnel',lat:48.28977,lon:8.17377,centerFt:976,maxFt:1736},{name:'1898 1998 SWV Pfalzgrafenweiler e.V.',lat:48.52983,lon:8.55261,centerFt:2163,maxFt:2202}],results=[];
for(const target of cases){
 const requests=[];
 const env={window:{MissionPoiBriefingCore:core,MissionPrivateEpisodeV6:flight,MissionCharterIdeasCore:charter},localStorage:{getItem:()=>null},AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,console,getSelectedAiApiKey:()=>'',getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetch:async(url,options)=>{
  if(String(url).startsWith('obstacles/'))return fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404});
  const start=Date.now();try{const r=await fetch(url,options);requests.push({url,status:r.status,ms:Date.now()-start});return r;}catch(e){requests.push({url,error:e.name,ms:Date.now()-start});throw e;}
 },fetchGeminiJsonWithFallback:async prompt=>{
  const nav=JSON.parse(prompt.split('NAVIGATION=')[1].split('\nFLUGDATEN=')[0]);
  return {parsed:{targetId:`poi:${target.lat.toFixed(6)}:${target.lon.toFixed(6)}`,title:'Umgebungsprobe',story:`Testperson möchte ${target.name} fotografieren.`,greetingSpeaker:'Testperson',greeting:'Hallo, ich möchte Fotos machen.',usedFactIds:[],report:{orientationIds:nav.facts.filter(f=>f.role==='orientation').slice(0,2).map(f=>f.id)}}};
 }};
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-browser.js','utf8'),env);
 const api=env.window.MissionPoiBriefingBrowser,c=await api.context(target),start={name:'Start',lat:48.27917,lon:8.42833};
 const idea=core.validateIdea({schema:core.IDEA_VERSION,targetId:c.id,targetName:target.name,taskDomain:'media_photo',situation:'Die Fotografin plant eine Ausstellung.',intent:'Sie möchte Übersichtsfotos des Ziels machen.',person:{name:'Testperson',role:'Fotografin',relationshipToPilot:'Kundin'}},c);
 const m=await api.story({start,dest:target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea},terrainEnvelope:{centerFt:target.centerFt,maxFt:target.maxFt,radiusNm:1,sampleCount:2,source:'terrarium-area'}});
 const row={target,requests,environment:m.poiBriefing.sourceContext.environmentFacts,report:m.poiBriefing.report};results.push(row);fs.writeFileSync(output,JSON.stringify({scope:'Live source retrieval and actual browser adapter; synthetic writer, no Gemini. Terrain numbers from user report, sampleCount is fixture-only.',results},null,2));console.log(JSON.stringify(row,null,2));
}
