const {test}=require('node:test');
const assert=require('node:assert/strict'), fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createMissionAuthorityManager}=require('./mission-authority-core');
const {createCockpitTools}=require('./tracker-cockpit-tools');
const {projectTrackerMapSnapshot}=require('./tracker-efb-map-snapshot-core');
const core=require('../map-route-edit-core');
const points=[{lat:48,lng:7,name:'Start'},{lat:48.2,lng:7.2,name:'Original WP'},{lat:48.4,lng:7.4,name:'Ziel'}];
function fixture(t,extras={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nav-route-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const storageFile=path.join(dir,'mission.json');
 const original={schema:'ga.mission-authority.v1',version:1,events:[],activeRun:{missionId:'m',runId:'run1',ownerClientId:'app1',executionAuthority:'tracker',executionRecipe:'apt',state:'active',phase:'active',revision:90,stateHash:'unchanged',executionStateHash:'unchanged',
 resumeBundle:{adapter:'apt',missionState:{currentMissionData:{missionId:'m',routeWaypoints:points}},mapProfile:{points:[{lat:48,lon:7,elevFt:500},{lat:48.4,lon:7.4,elevFt:600}]}},...extras}};
 fs.writeFileSync(storageFile,JSON.stringify(original));
 let manager=createMissionAuthorityManager({storageFile});
 return {dir,storageFile,original,manager,reload:()=>createMissionAuthorityManager({storageFile})};
}
test('APT route changes persist independently of execution, preserve anchors and original reset route',t=>{
 const f=fixture(t),m=f.manager,before=m.getActiveRun({includeBundle:true});
 const result=m.editNavigationRoute({routeId:'run1',expectedRevision:0,edit:{action:'insert',index:1,point:{lat:48.1,lng:7.15}}});assert.equal(result.ok,true);
 const run=m.getActiveRun({includeBundle:true});assert.equal(run.revision,before.revision);assert.equal(run.executionStateHash,before.executionStateHash);assert.deepEqual(run.resumeBundle,before.resumeBundle);
 const map=projectTrackerMapSnapshot(run);assert.equal(map.route.waypoints.length,4);assert.equal(map.route.waypoints[1].lon,7.15);
 const restored=f.reload();assert.equal(restored.getActiveRun({includeBundle:true}).navigationRoute.points.length,4);
 assert.equal(m.editNavigationRoute({routeId:'run1',expectedRevision:0,edit:{action:'remove',index:1}}).error,'navigation_revision_conflict');
 assert.equal(m.editNavigationRoute({routeId:'run1',expectedRevision:1,edit:{action:'move',index:0,point:{lat:49,lng:8}}}).error,'navigation_endpoint_locked');
 assert.equal(m.editNavigationRoute({routeId:'run1',expectedRevision:1,edit:{action:'reset'}}).ok,true);
 assert.deepEqual(m.getActiveRun({includeBundle:true}).navigationRoute.points.map(p=>[p.lat,p.lng]),points.map(p=>[p.lat,p.lng]));
});
test('Web-authority and other recipes remain protected',t=>{
 for(const extras of [{executionAuthority:'web'},{executionRecipe:'poi'}]) {
  const f=fixture(t,extras);assert.equal(f.manager.editNavigationRoute({routeId:'run1',expectedRevision:0,edit:{action:'remove',index:1}}).error,'navigation_mission_locked');
 }
});
test('private route can be adopted and edited through the same service as EFB, stale updates rejected and restart keeps all waypoints',async t=>{
 const f=fixture(t);const filename=path.join(f.dir,'private.json');
 const options={filename,getRun:()=>null,getFlight:()=>null};let service=createCockpitTools(options);
 const seed=await service.execute({intent:'navigation_adopt',expectedRevision:0,payload:{routeId:'',points,departureIcao:'EDTL',destinationIcao:'EDTO'}});assert.equal(seed.ok,true);
 const edit={intent:'navigation_edit',expectedRevision:1,payload:{routeId:seed.navigation.id,edit:{action:'insert',index:2,point:{lat:48.3,lng:7.3}}}};
 assert.equal((await service.execute(edit)).ok,true);assert.equal((await service.execute(edit)).error,'navigation_revision_conflict');
 service=createCockpitTools(options);assert.equal(service.navigation().points.length,4);
 assert.equal(service.version().revision,2);
 const reused=await service.execute({...edit,expectedRevision:2,payload:{...edit.payload,routeId:'old-run'}});assert.equal(reused.ok,false);
});
test('failed atomic mission write rolls route back',t=>{
 const f=fixture(t);const io={...fs,renameSync:()=>{throw Error('disk full');}};
 const m=createMissionAuthorityManager({storageFile:f.storageFile,fs:io});
 assert.equal(m.editNavigationRoute({routeId:'run1',expectedRevision:0,edit:{action:'remove',index:1}}).error,'navigation_persist_failed');
 assert.equal(m.getActiveRun().navigationRevision,0);
});
test('remote relay and local service use the same route; duplicated relay IDs execute once',async()=>{
 const {createNavigationRelay}=require('./tracker-cockpit-tools');
 const tools=createCockpitTools({getRun:()=>null,getFlight:()=>null});let broadcasts=0;
 const relay=createNavigationRelay(tools,()=>broadcasts++);
 const command={clientId:'phone',commandId:'one',intent:'navigation_adopt',expectedRevision:0,payload:{routeId:'',points}};
 const [a,b]=await Promise.all([relay(command),relay(command)]);assert.deepEqual(a,b);assert.equal(a.ok,true);assert.equal(broadcasts,1);assert.equal(a.map,undefined);
 assert.equal((await relay({...command,payload:{...command.payload,points:points.slice(0,2)}})).error,'command_id_conflict');
 assert.equal((await relay({...command,commandId:'aip',intent:'open_airport_aip'})).error,'navigation_command_invalid');
 const latest=await tools.execute({intent:'navigation_get'});assert.equal(latest.navigation.id,a.navigation.id);
});
test('APT authority inspection uses the original reset block and cannot be bypassed by editing',t=>{
 const f=fixture(t,{executionState:{missionId:'m',runId:'run1',recipe:'apt',phase:'active',workflows:{complianceInspection:{selected:true,phase:'inspectors_waiting'}}}});
 const result=f.manager.editNavigationRoute({routeId:'run1',expectedRevision:0,edit:{action:'remove',index:1}});
 assert.equal(result.error,'navigation_compliance_locked');
});
test('named reporting points and protected mission point flags survive the map projections',()=>{
 const {normalizeTrackerMapSnapshot}=require('./efb-app/map-shell-core');
 const run={missionId:'m',runId:'r',resumeBundle:{missionState:{routeWaypoints:[points[0],{lat:48.1,lng:7.1,name:'VRP',rppAirportIcao:'EDTL',isPOI:true},points[2]]}}};
 const map=normalizeTrackerMapSnapshot(projectTrackerMapSnapshot(run));
 assert.equal(map.route.waypoints[1].rppAirportIcao,'EDTL');assert.equal(map.route.waypoints[1].isPOI,true);
 assert.throws(()=>core.apply(map.route.waypoints,{action:'remove',index:1}),/mission_point_locked/);
});
