import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import placement from '../mission-reporter-scene-core.js';
import {buildSceneAssets} from './generate-homebase-scene-assets.mjs';
import {extractOriginalFunction} from './extract-original-function.mjs';
const pack=JSON.parse(fs.readFileSync('homebase/assets/catalog.json','utf8'));
function catalog(){const env={window:{}};for(const f of ['data/mission-scene-assets.js','data/mission-homebase-scene-assets.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),env);return env.window.MISSION_SCENE_ASSETS;}
test('generated registrations exactly match scene eligibility, roles, titles and tags',()=>{
 const expected=buildSceneAssets(pack),actual=catalog();
 assert.equal(Object.keys(expected.features).length,32);
 for(const [key,spec] of Object.entries(expected.features)){assert.deepEqual(JSON.parse(JSON.stringify(actual.targetSceneFeatures[key])),spec);assert.deepEqual(Array.from(actual.roles[spec.roles[0]]),expected.roles[spec.roles[0]]);}
 const filtered=buildSceneAssets({assets:[{key:'cargo',title:'Cargo',missionSpawnable:true,missionRoles:['cargo']},{key:'disabled',title:'Disabled',missionSpawnable:false,missionRoles:['scene-prop']},{key:'base',title:'Base',homebasePlaceable:true}]});
 assert.equal(Object.keys(filtered.features).length,0);
});
test('actual scene item builder emits pack titles and preserves existing placement overrides',()=>{
 const assets=catalog(),pools=new Proxy({},{get:()=>['test-model']});
 let feature='homebase_mxpavilion',spec={density:'normal'};
 const env=vm.createContext({window:{MISSION_SCENE_ASSETS:assets},MISSION_SCENE_ASSET_CATALOG:assets.roles,MISSION_SCENE_ASSET_POOLS:pools,BOARDING_MARKER_TITLE:'cone',MISSION_TARGET_SCENE_BASE_FEATURE_COUNTS:{event_site:{}},
 _missionSceneFilteredVehiclePool:x=>x,_missionTargetSceneSafeSmallBoatPool:()=>[],_scenePreferredTitle:()=> 'cone',_missionScenePersonTitle:()=> 'person',_scenePickTitle:p=>p[0],
 _missionTargetSceneItem:(id,label,title,pool,f,r,options)=>({id,label,title,f,r,...options}),
 _missionTargetSceneFeatureArrangement:()=> 'cluster',_missionTargetSceneFeaturePlacementOverride:()=>({forwardM:31,rightM:42,hdgOffsetDeg:90}),
 _missionTargetSceneRequestedFeatures:()=>[feature],_missionTargetSceneFeatureAllowedForKind:()=>true,_missionTargetSceneFeatureCount:()=>2,_missionTargetSceneSpec:()=>spec});
 const source=fs.readFileSync('sync.js','utf8');
 for(const n of ['_sceneUniqueTitles','_sceneCatalogRoleMerge','_missionSceneClusterOffset','_missionTargetSceneItems'])vm.runInContext(extractOriginalFunction(source,n),env);
 for(const [key,spec] of Object.entries(buildSceneAssets(pack).features)){
  feature=key;const items=env._missionTargetSceneItems('event_site').filter(x=>x.id.startsWith('feature_'));
  assert.equal(items.length,2,key);assert.equal(items[0].title,assets.roles[spec.roles[0]][0]);assert.equal(items[0].f,31);assert.equal(items[0].r,42);
 }
 feature='pavilion';assert.equal(env._missionTargetSceneItems('event_site').filter(x=>x.id.startsWith('feature_'))[0].title,'VFR Multitool Homebase MX Pavilion');

 spec={density:'normal',objectPolicy:'explicit-requirements',requirements:[
  {feature:'homebase_mxpavilion',count:2,arrangement:'cluster',spacingM:9,forwardM:10,rightM:20,placement:'Parkplatz'},
  {feature:'homebase_mxpavilion',count:1,forwardM:-20,rightM:-30,placement:'Parkplatz'}
 ]};
 env._missionTargetSceneNormalizeFeature=x=>x;env._missionTargetGeoOffset=()=>{throw Error('Must not relocate an explicitly planned group by keyword');};
 for(const n of ['_missionTargetSceneFeatureCount','_missionTargetSceneFeaturePlacementOverride'])vm.runInContext(extractOriginalFunction(source,n),env);
 feature='homebase_mxpavilion';const planned=env._missionTargetSceneItems('event_site');
 assert.equal(planned.length,3);assert.ok(planned.every(x=>x.id.startsWith('feature_')),'no default bus/van/cones');
 assert.deepEqual(JSON.parse(JSON.stringify(planned.map(x=>[x.f,x.r]))),[[10,20],[19,20],[-20,-30]]);

});

test('reporter composer receives the chosen idea and real geometry; other profiles stay unchanged',()=>{
 const env=vm.createContext({window:{MissionReporterSceneCore:placement},compactSceneComposerStory:x=>x,compactMissionPlanV2ForPrompt:x=>x,missionPlanV2SceneDirective:()=>null});vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'scenePlannerV3ReporterContext'),env);
 const idea={situation:'Ein offener Werkstatttag.',sceneIntent:{visibleIdeas:['Pavillon mit Besuchern']}};
 const geo={center:{lat:48,lon:8},anchors:{parking:{lat:48.001,lon:8.001}},avoidZones:[{type:'building',polygon:[{lat:48,lon:8},{lat:48.01,lon:8},{lat:48,lon:8.01}]}]};
 const result=env.scenePlannerV3ReporterContext({newsBriefing:{schema:'news-briefing.v1',idea},heading:90},{},geo,{sceneAnchor:geo.center});
 assert.equal(result.reporterScene.idea,idea);assert.equal(result.reporterScene.spatialContext.avoidZones,geo.avoidZones);assert.equal(result.reporterScene.spatialContext.anchors,geo.anchors);
 assert.equal(JSON.stringify(env.scenePlannerV3ReporterContext({infraBriefing:{schema:'infra-briefing.v1'}},{},geo,{})),'{}');
});

// Exercise the merged runtime catalog, including Homebase additions.
test('generic scene marker and box pools retain their visible object function',()=>{
 const assets=catalog();
 assert.ok(assets.roles['marker.cone'].includes('Cone_Medium'));
 assert.ok(!assets.roles['marker.cone'].includes('EDTW Smoke Marker'));
 assert.ok(assets.roles['cargo.small_box'].includes('Cardboard'));
 assert.ok(!assets.roles['cargo.small_box'].includes('CoffeeCup'));
});
