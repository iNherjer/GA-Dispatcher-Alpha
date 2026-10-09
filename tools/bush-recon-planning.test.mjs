import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {declaration} from './gemini-migration-harness.mjs';
const source=fs.readFileSync(new URL('../mission-definition-core.js',import.meta.url),'utf8');
const c=vm.createContext({});
for(const name of ['normalizeBushReconPlan','applyBushReconPlan']) vm.runInContext(declaration(source,name),c);
c.sanitizeBushMissionSpec=x=>x;
test('long observations accommodate gentle turns at supplied aircraft speed',()=>{
 for(const speed of [80,110,160]) {
 const p=c.normalizeBushReconPlan({radiusNm:0.1,observationSeconds:180,rationale:'Mehrere Blickrichtungen'}, {cruiseSpeedKts:speed});
 const r=(speed*0.514444)**2/(9.80665*Math.tan(15*Math.PI/180))/1852;
 assert.ok(p.radiusNm>=r*1.5+0.15);assert.equal(p.observationSeconds,180);assert.equal(p.minAreaTrackNm,0);
 }
});
test('short overflight retains seconds and compact radius without orbit constraint',()=>{
 const p=c.normalizeBushReconPlan({radiusNm:0.25,observationSeconds:3,rationale:'Ein Blick auf die Bahn'}, {cruiseSpeedKts:110});
 assert.equal(p.radiusNm,0.25);assert.equal(p.observationSeconds,3);
 const spec={profileId:'bush_recon_return',areaRef:{lat:1,lon:2,radiusNm:3.2},success:{minAreaTimeSec:120,minAreaTrackNm:2.5}};
 const applied=c.applyBushReconPlan(spec,p);assert.equal(applied.success.minAreaTimeSec,3);assert.equal(applied.success.minAreaTrackNm,0);assert.equal(applied.areaRef.radiusNm,0.25);assert.equal(spec.success.minAreaTimeSec,120);
 assert.equal(c.applyBushReconPlan({profileId:'bush_charter_strip'},p).reconPlan,undefined);
});
test('invalid values retain legacy fallback; excessively long plans remain bounded',()=>{
 for(const raw of [{radiusNm:-1,observationSeconds:3},{radiusNm:1,observationSeconds:NaN},null]) assert.equal(c.normalizeBushReconPlan(raw),null);
 const p=c.normalizeBushReconPlan({radiusNm:900,observationSeconds:999});assert.equal(p.radiusNm,8);assert.equal(p.observationSeconds,300);
});
test('production POI projection preserves exact Recon seconds and radius',()=>{
 const a=vm.createContext({resolvePoiAltitudeTerrainFt:()=>1000});vm.runInContext(declaration(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),'getPoiTaskPassengerDefaults'),a);
 const plan=c.normalizeBushReconPlan({radiusNm:0.25,observationSeconds:3});const bush=c.applyBushReconPlan({profileId:'bush_recon_return',areaRef:{},success:{}},plan);
 const defaults=a.getPoiTaskPassengerDefaults({mission:{bush},isPOI:true});assert.equal(defaults.defaultTargetRadiusNm,0.25);assert.equal(defaults.defaultTargetDwellMin*60,3);
});
test('production Bush planner preserves single wrapped plans while other families and ambiguous arrays stay unchanged',async()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const raw={plan:{bushReconPlan:{radiusNm:0.25,observationSeconds:3,rationale:'Ein Überflug'}}};
 let seen;
 const a=vm.createContext({window:{},document:{getElementById:()=>({checked:true})},
 isMissionPipelineV4Enabled:()=>true,getSelectedAiProvider:()=> 'gemini',getSelectedAiApiKey:()=> 'fixture',
 buildMissionPlannerV2Draft:()=>({}),_missionPipelineV4ResolveContextBundle:async()=>({working:{},bundle:{}}),
 getSelectedAiModelProfile:()=> 'standard',normalizeAiProvider:x=>x,_missionPipelineV4Prompt:()=> 'fixture',
 fetchGeminiJsonWithFallback:async()=>({parsed:[raw]}),_missionPipelineV3AirportDetails:()=>null,
 sanitizeMissionPlannerV4Result:x=>{seen=x;return {status:'ready',plan:{},debug:{}};},
 normalizeBushReconPlan:c.normalizeBushReconPlan,MISSION_PIPELINE_V4_PLANNER_VERSION:'fixture'});
 vm.runInContext(declaration(app,'fetchMissionPlannerV4'),a);
 const result=await a.fetchMissionPlannerV4({missionType:'bush',dispatchProfileId:'bush_recon_return',aircraftCapability:{cruiseSpeedKts:110}});
 assert.equal(seen,raw);assert.equal(result.plan.bushReconPlan.observationSeconds,3);
 for(const id of ['bush_charter_strip','bush_supply_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo']){await a.fetchMissionPlannerV4({missionType:'bush',dispatchProfileId:id});assert.equal(seen,raw);}
 for(const type of ['apt','poi']){await a.fetchMissionPlannerV4({missionType:type});assert.ok(Array.isArray(seen));}
 for(const payload of [[raw,raw],[null],[{plan:[]}]] ){a.fetchGeminiJsonWithFallback=async()=>({parsed:payload});await a.fetchMissionPlannerV4({missionType:'bush',dispatchProfileId:'bush_charter_strip'});assert.equal(seen,payload);}
});
test('new Recon timing is real qualifying seconds even in easy mode and at zone centre',async()=>{
 const {default:task}=await import('../mission-poi-task-core.js');
 const pax={targetRadiusNm:0.25,targetAltFt:1000,targetDwellMin:3/60};
 const input={pax,distNm:0,now:1000,flightData:{mslFt:1000},taskDomain:'inspection_infra',strict:false,etaMin:0,effectiveGs:110,clockPos:12,
 bush:{profileId:'bush_recon_return',reconPlan:{schema:'bush-recon-plan.v1'}},taskItemState:{blockingItems:[]}};
 let state=task.observe({},input).state;
 state=task.observe(state,{...input,now:2000}).state;assert.equal(state.dwellSec,1);assert.equal(state.satisfied,false);
 state=task.observe(state,{...input,now:3000}).state;assert.equal(state.satisfied,false);
 state=task.observe(state,{...input,now:4000}).state;assert.equal(state.dwellSec,3);assert.equal(state.satisfied,true);
});
test('production Bush Recon POI basis has no airport objectives or passenger seeds',async()=>{
 const {setupContext,loadScript}=await import('./mission-pipeline-dryrun.mjs');
 const {context}=setupContext(1);context.console={log(){},warn(){},error(){}};
 for(const f of ['datenbank.js','missions.js','mission-definition-core.js','app.js'])loadScript(context,f);
 const start={icao:'KMYL',n:'McCall',lat:44.89,lon:-116.1};
 const mast={n:'Testmast',lat:45.13,lon:-115.32,man_made:'communications_tower'};
 const airport={...mast,man_made:undefined,icao:'U60',n:'Big Creek'};
 const poi=context.buildBushMissionEnvelope({profileId:'bush_recon_return',startAirport:start,destAirport:mast,distNm:36}).mission;
 assert.equal(poi.bush.targetRef.kind,'poi');
 for(const value of [poi.bush.reconFocus,poi.bush.opsNotes.join(' '),poi.passenger.greetingText,poi.s])assert.ok(!/windsack|vorfeld|rollweg|bah(n|nmarkierung)|strip/i.test(value),value);
 const apt=context.buildBushMissionEnvelope({profileId:'bush_recon_return',startAirport:start,destAirport:airport,distNm:36}).mission;assert.equal(apt.bush.targetRef.kind,'airport');
});
