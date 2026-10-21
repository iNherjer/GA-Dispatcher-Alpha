import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
const core=fs.readFileSync(new URL('../mission-arrival-core.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const raw=JSON.parse(fs.readFileSync(new URL('fixtures/arrival-edtf-osm-20261017.json',import.meta.url),'utf8'));
const c=vm.createContext({window:{},console,Map});
vm.runInContext(core,c);
for(const name of ['scenePlannerV3CleanText','scenePlannerV3PreferredAptPlacement','sanitizeScenePlannerV3AptArrivalPlan','scenePlannerV3CompactAptPlan'])vm.runInContext(declaration(app,name),c);
c.normalizeAptArrivalRole=()=>({role:'media_pickup',personRole:'person.ground_crew',vehicleRole:'vehicle.van',equipmentRole:'cargo.camera_equipment'});
c.normalizeMissionType=()=> 'apt';
const initial=c.buildAptArrivalPlan({dest:{lat:48.0227775574,lon:7.8324999809,icao:'EDTF'},heading:237});
const geo=c.normalizeAptArrivalGeoContext(raw,initial.airportLat,initial.airportLon);
c.fetchAptArrivalGeoContext=async()=>geo;
const base=await c.resolveAptArrivalPlanPlacement(initial);
const clone=x=>JSON.parse(JSON.stringify(x));

test('real Freiburg geometry provides four aprons and multiple mapped handoff areas instead of the representative offset',()=>{
 assert.equal(geo.aprons.length,4);
 assert.equal(geo.parkingPositions.length,0,'airport has no mapped stand nodes in this captured dataset');
 // Released hangar fronts come first; aprons stay offered as alternatives.
 assert.equal(base.source,'osm_hangar_front');
 assert.ok(base.placementCandidates.hangarFront.length>1);
 assert.ok(c.aptArrivalRunwayDistanceM(geo,base)>40);
 assert.ok(base.placementCandidates.apron.length>1);
 assert.ok(base.placementCandidates.surface.length>1);
 assert.ok(Math.abs(base.lon-initial.lon)>0.001);
 assert.equal(c.aptArrivalFinalPlacementIssues(base).length,0);
});
test('the actual App sanitizer writes Composer-selected grass by a mapped Freiburg hangar and retains actor semantics',()=>{
 const p=clone(base);
 const index=p.placementCandidates.surface.findIndex(x=>x.source==='osm_grass_area'&&x.nearBuilding?.type==='hangar'&&x.nearBuilding.distanceM<40);
 assert.ok(index>=0,'a suitable grass area by a hangar must be offered');
 const selected=p.placementCandidates.surface[index];
 const result=c.sanitizeScenePlannerV3AptArrivalPlan({preferredPlacement:{source:'osm_surface',index,reason:'Kartierte Grasflaeche beim Hangar'},
  headingDeg:p.hdg,items:p.items.slice().reverse()},p);
 assert.equal(result.lat,selected.lat);assert.equal(result.lon,selected.lon);
 assert.equal(result.source,'osm_grass_area');assert.equal(result.osmPlacement.sourceId,selected.sourceId);
 assert.equal(result.snapStatus.selectedBy,'scene_planner_v3');assert.equal(result.snapStatus.finalLayoutValidated,true);
 assert.equal(result.placementCandidates.selected[0].lat,selected.lat);
 const restored=clone(result);
 assert.equal(c.aptArrivalFinalPlacementIssues(restored).length,0);
 assert.equal(restored.items.filter(i=>i.kind.startsWith('arrival_person_')&&i.departWithPickupVehicle).length,2);
 assert.ok(restored.items.some(i=>i.role==='cargo.camera_equipment'),'curated mission equipment survives sanitization');
});
test('Composer offsets are validated after selection and cannot move a person onto the recorded runway',()=>{
 const p=clone(base);
 const world={lat:48.02317336175902,lon:7.832548049571594};
 // Use a valid apron anchor, but a deliberately unsafe post-composition offset.
 const latScale=111320, eastScale=latScale*Math.cos(p.lat*Math.PI/180), h=p.hdg*Math.PI/180;
 const north=(world.lat-p.lat)*latScale,east=(world.lon-p.lon)*eastScale;
 const bad={...p.items.find(i=>i.kind==='arrival_person_editor'),forwardM:north*Math.cos(h)+east*Math.sin(h),rightM:-north*Math.sin(h)+east*Math.cos(h)};
 const direct={...p,items:[bad]};
 assert.ok(c.aptArrivalFinalPlacementIssues(direct).length);
 assert.throws(()=>c.finalizeAptArrivalComposerPlan(direct),/apt_arrival_scene_invalid/);
 const output={preferredPlacement:{source:'osm_apron',index:0},items:[{...p.items[1],forwardM:45,rightM:45}]};
 // Either this bounded point is outside the chosen apron, or make it explicitly so
 // using all four offset corners; at least one final layout must be rejected.
 let rejected=0;
 for(const f of [-45,45])for(const r of [-45,45]){
  output.items[0].forwardM=f;output.items[0].rightM=r;
  try{c.sanitizeScenePlannerV3AptArrivalPlan(output,p);}catch(e){assert.match(e.message,/apt_arrival_scene_invalid/);rejected++;}
 }
 assert.ok(rejected>0);
});
test('final-layout alternatives are filtered with the final heading and offsets',()=>{
 const p=clone(base);p.items=[{kind:'arrival_vehicle',role:'vehicle.van',forwardM:0,rightM:0}];p.hdg=90;
 const result=c.finalizeAptArrivalComposerPlan(p);
 for(const candidate of [...result.placementCandidates.apron,...result.placementCandidates.surface]){
  assert.equal(c.aptArrivalSceneFits(geo,candidate,p,c.aptArrivalPlacementSurface(geo,candidate)),true);
 }
 assert.throws(()=>c.sanitizeScenePlannerV3AptArrivalPlan({preferredPlacement:{source:'osm_surface',index:999}},base),/kein angebotener Kandidat/);
});
test('final placement rejects coincident actors and reception walks beyond the supported compact scene',()=>{
 const p=clone(base);
 p.items[2].forwardM=p.items[1].forwardM;p.items[2].rightM=p.items[1].rightM;
 assert.throws(()=>c.finalizeAptArrivalComposerPlan(p),/ueberlagert/);
 const remote=clone(base);remote.items[0].forwardM=-45;remote.items[0].rightM=-45;
 remote.items[1].forwardM=45;remote.items[1].rightM=45;
 assert.ok(Array.from(c.aptArrivalFinalPlacementIssues(remote)).some(s=>s.includes('Gehweg')));
});
test('Composer receives mapped surface polygons, blockers, candidate indices and building context',()=>{
 const compact=c.scenePlannerV3CompactAptPlan(base),context=c.aptArrivalComposerGeometry(geo,base);
 assert.ok(compact.placementCandidates.surface.some(p=>p.nearBuilding?.type==='hangar'));
 assert.ok(context.areas.some(a=>a.type==='grass_area'&&a.polygonMeters.length>=4));
 assert.ok(context.blockers.some(b=>b.type==='building'));
 assert.ok(context.blockers.some(b=>b.type==='runway'));
 assert.match(context.note,/Zufahrt/);
});
test('partial Overpass data never become trusted geometry and the cache schema invalidates old limited contexts',()=>{
 assert.equal(c.normalizeAptArrivalGeoContext({...raw,remark:'runtime error: timeout'},48.02,7.83),null);
 assert.match(c.aptArrivalGeoContextCacheKey('EDTF',48.02,7.83,1400),/v2/);
});

test('the real Composer loop corrects an invalid airport selection and returns the validated written placement',async()=>{
 const payloads=[];let calls=0;
 const env=vm.createContext({window:{MissionReporterSceneCore:{enabled:()=>false}},console,Map,AbortController,setTimeout,clearTimeout,
  normalizeMissionType:()=> 'apt',sanitizeMissionSceneIntentSpec:x=>x,
  sanitizeMissionTargetSceneSpec:()=>({kind:'none',features:[],requirements:[],roles:[],density:'none'}),
  getSelectedAiModelProfile:()=> 'default',scenePlannerV3Prompt:()=> 'prompt',scenePlannerV3ToolDeclarations:()=>[],
  scenePlannerV3ExecuteTool:async()=>({complete:true}),incrementApiUsage(){},
  _missionPipelineV3ExtractFunctionCalls:d=>d.calls||[],_missionPipelineV3ExtractText:d=>d.text,_missionPipelineV3ParseJsonText:JSON.parse,
  MISSION_SCENE_PLANNER_V3_VERSION:'test',
  fetch:async(_url,opts)=>{payloads.push(JSON.parse(opts.body));calls++;
   const data=calls===1?{calls:[{name:'get_scene_context_bundle'}],candidates:[{content:{role:'model',parts:[]}}]}
    :{text:JSON.stringify({targetScene:{kind:'none'},aptArrivalPlan:{preferredPlacement:{source:'osm_apron',index:calls===2?999:0},headingDeg:base.hdg,items:base.items}})};
   return{ok:true,json:async()=>data};}
 });
 vm.runInContext(core,env);
 for(const name of ['scenePlannerV3CleanText','scenePlannerV3Array','scenePlannerV3PreferredAptPlacement','sanitizeScenePlannerV3AptArrivalPlan',
  'scenePlannerV3CompactAptPlan','sanitizeScenePlannerV3Result','composeMissionScenePlanV3WithGemini'])vm.runInContext(declaration(app,name),env);
 const result=await env.composeMissionScenePlanV3WithGemini({missionData:{missionType:'apt',aptArrivalPlan:clone(base)},missionContract:{},passenger:{},
  fallback:{targetScene:{kind:'none'},aptArrivalPlan:clone(base)},apiKey:'test'});
 assert.equal(calls,3);assert.equal(result.aptArrivalPlan.snapStatus.finalLayoutValidated,true);
 assert.equal(result.aptArrivalPlan.snapStatus.selectedBy,'scene_planner_v3');
 assert.match(JSON.stringify(payloads[2].contents),/kein angebotener Kandidat/);
 assert.ok(payloads.slice(1).every(p=>p.toolConfig.functionCallingConfig.mode==='NONE'));
});

test('live traffic checks honor the Composer-selected site before considering any alternative',()=>{
 const tracker=fs.readFileSync(new URL('../ga-tracker-client/tracker.js',import.meta.url),'utf8');
 const start=tracker.indexOf('  const resolveAptArrivalLivePlacement ='),end=tracker.indexOf('\n  const buildScenePlan =',start);
 const selected={lat:48.021,lon:7.835,source:'osm_grass_area',sourceId:'grass'};
 const other={lat:48.022,lon:7.834,sourceId:'apron'};
 const env=vm.createContext({aptArrivalCandidatePoint:p=>p,aptArrivalLiveTraffic:()=>[{lat:47,lon:7}],
  aptArrivalPointOccupied:()=>false,debugLog(){},Date});
 vm.runInContext(tracker.slice(start,end)+'\nglobalThis.resolve=resolveAptArrivalLivePlacement;',env);
 const command={targetSceneKind:'apt_arrival',...selected,snapStatus:{source:'osm_grass_area'},
  placementCandidates:{selected:[selected],parking:[],apron:[other],surface:[selected]}};
 assert.equal(env.resolve(command).lat,selected.lat);
 env.aptArrivalPointOccupied=p=>p.lat===selected.lat;
 assert.equal(env.resolve(command).lat,other.lat);
});

test('strip-only grass eligibility never leaks to a regular airport context',()=>{
 const point=(x,y)=>({lat:48+y/111320,lon:8+x/(111320*Math.cos(48*Math.PI/180))});
 const poly=[[ -80,-80],[80,-80],[80,80],[-80,80],[-80,-80]].map(([x,y])=>point(x,y));
 const raw={elements:[{type:'way',id:1,tags:{landuse:'meadow'},geometry:poly}]};
 const apt=c.normalizeAptArrivalGeoContext(raw,48,8),strip=c.normalizeAptArrivalGeoContext(raw,48,8,1400,{stripHandoff:true});
 assert.equal(apt.surfaces.length,0);assert.equal(strip.surfaces.length,1);
});

 test('generic same-role Composer actors keep separate reception identities',()=>{
 const rawItems=base.items.filter(i=>i.role==='vehicle.van'||i.kind.startsWith('arrival_person_')).map(i=>({...i,kind:i.role==='vehicle.van'?'arrival_vehicle':'arrival_person_1'}));
 const result=c.sanitizeScenePlannerV3AptArrivalPlan({preferredPlacement:{source:'osm_apron',index:0},items:rawItems},base);
 const people=result.items.filter(i=>i.kind.startsWith('arrival_person_'));
 assert.equal(new Set(people.map(i=>i.kind)).size,2);
 assert.ok(people.every(i=>i.departWithPickupVehicle));
 });

 test('sparse Bush fallback stays beside runway ends and checks every actor footprint',()=>{
 const plan={role:'bush_strip_pickup',lat:48,lon:8,airportLat:48,airportLon:8,hdg:0,items:[{kind:'arrival_person_1',forwardM:0,rightM:5}]};
 const point=(f,r)=>c.offsetAptArrivalLatLon(48,8,0,f,r);
 const geo={avoidZones:[{type:'runway',name:'18/36',center:point(0,0),line:[point(-400,0),point(400,0)],polygon:[],bufferM:45}]};
 const placement=c.pickAptArrivalBushRunwaySidePlacement(geo,plan);
 assert.ok(placement);const nav=c.aptArrivalNavM(48,8,placement.point.lat,placement.point.lon);
 assert.ok(nav.distM>330,'never at mid-runway');
 assert.equal(placement.alternates.runwaySide.length,4,'both ends and sides offered');
 for(const x of placement.alternates.runwaySide)assert.equal(x.endInsetM,60);
 const blocks=placement.alternates.runwaySide.map((p,i)=>({type:'building',id:String(i),center:p,line:[point(0,0)],polygon:[],bufferM:5}));
 // Circle-like tiny segments at each anchor exclude all four end choices;
 // the search moves along the runway side instead of giving up.
 blocks.forEach(z=>z.line=[z.center,c.offsetAptArrivalLatLon(z.center.lat,z.center.lon,0,1,0)]);
 const blockedCtx={avoidZones:[...geo.avoidZones,...blocks]};
 const moved=c.pickAptArrivalBushRunwaySidePlacement(blockedCtx,plan);
 assert.ok(moved,'another spot along the runway side');
 assert.ok(c.aptArrivalNavM(48,8,moved.point.lat,moved.point.lon).distM>250,'still towards a runway end');
 assert.ok(blocks.every(b=>c.aptArrivalNavM(b.center.lat,b.center.lon,moved.point.lat,moved.point.lon).distM>10));
 assert.equal(c.aptArrivalScenePoints(moved.point,{...plan,items:moved.items}).map(e=>c.aptArrivalBlockedZone(blockedCtx,e.point,e.radiusM)).find(Boolean),undefined);
 assert.equal(c.pickAptArrivalBushRunwaySidePlacement(geo,{...plan,role:'media_pickup'}),null);
 });
 test('missing OSM runway can use explicit airport dimensions as estimated end reference',async()=>{
 const env=vm.createContext({window:{},console,Map});vm.runInContext(core,env);
 env.fetchAptArrivalGeoContext=async()=>null;
 const result=await env.resolveAptArrivalPlanPlacement({role:'bush_strip_pickup',lat:48,lon:8,airportLat:48,airportLon:8,hdg:0,
 runwayReference:{runways:[{designator:'18/36',lengthM:800,widthM:20,trueHeadingDeg:0}]},items:[]});
 assert.equal(result.source,'osm_runway_side');assert.equal(result.snapStatus.runwayCenterEstimated,true);
 assert.ok(env.aptArrivalNavM(48,8,result.lat,result.lon).distM>330);
 });
