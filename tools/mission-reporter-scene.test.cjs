const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-reporter-scene-core.js');
const origin={lat:48,lon:8},ll=(x,y)=>({lat:origin.lat+y/111320,lon:origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180))});
const way=(id,tags,points)=>({id,type:'way',tags,geometry:points.map(p=>ll(...p))});
const raw={elements:[way(1,{landuse:'industrial'},[[-100,-100],[100,-100],[100,100],[-100,100],[-100,-100]]),way(2,{building:'industrial'},[[30,30],[60,30],[60,60],[30,60],[30,30]]),way(3,{highway:'primary'},[[-100,-80],[100,-80]])]};
const geo=core.geometry(raw,origin);const cat={targetSceneFeatures:{shipping_container:{roles:['cargo.shipping_container'],placementRadiusM:9},people:{roles:['person'],placementRadiusM:1.5}},roles:{'cargo.shipping_container':['Container'],'person':['Person']}};
const req=(f,r)=>({feature:'shipping_container',role:'cargo.shipping_container',count:1,forwardM:f,rightM:r,arrangement:'cluster'});
test('placement uses exact geometry, preserves polygons and excludes building/roads and area exterior',()=>{
 assert.equal(geo.shapes.length,3);assert.equal(core.placementError({x:0,y:0},9,geo),'');
 for(const p of [{x:40,y:40},{x:25,y:40},{x:0,y:-80},{x:110,y:0}])assert.ok(core.placementError(p,9,geo));
 assert.ok(geo.candidates.length);assert.ok(geo.candidates.every(p=>!core.placementError(p,9,geo)));
 assert.equal(core.geometry({...raw,remark:'timeout'},origin).status,'incomplete');assert.ok(core.placementError({x:0,y:0},9,null));
});
test('plan rejects the original stacked groups, wrong roles, absent offsets and object budget overflow',()=>{
 assert.equal(core.validate({kind:'industry_site',density:'normal',requirements:[req(0,0),req(0,25)]},geo,cat).length,0);
 for(const requirements of [[req(0,0),req(0,0)],[{...req(0,0),role:'person'}],[{...req(0,0),rightM:undefined}],[req(40,40)]])assert.ok(core.validate({kind:'industry_site',requirements},geo,cat).length);
 assert.deepEqual(core.offsets({...req(0,0),count:3,arrangement:'line',spacingM:20}),[{x:0,y:0},{x:20,y:0},{x:40,y:0}]);
});
test('actual item builder emits only selected model family with unchanged offsets',async()=>{
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const env=vm.createContext({window:{MissionReporterSceneCore:core},console});
 for(const f of ['data/mission-scene-assets.js','data/mission-homebase-scene-assets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
 const assets=env.window.MISSION_SCENE_ASSETS;
 const scene={objectPolicy:'explicit-requirements',kind:'industry_site',density:'normal',requirements:[req(0,0),req(0,25)]};
 env._missionTargetGeoContext=()=>({reporterPlacement:geo});
 env._missionTargetSceneSpec=()=>scene;env.MISSION_SCENE_ASSET_POOLS=new Proxy({},{get:()=>['legacy-unwanted']});
 env.MISSION_SCENE_ASSET_CATALOG=assets.roles;env._missionSceneFilteredVehiclePool=x=>x;env._missionTargetSceneSafeSmallBoatPool=()=>[];env._scenePickTitle=p=>p[0];
 env._missionTargetSceneItem=(kind,label,title,pool,f,r,options)=>({kind,title,pool,f,r,...options});
 const sync=fs.readFileSync('sync.js','utf8');
 for(const name of ['_sceneUniqueTitles','_sceneCatalogRoleMerge','_missionTargetSceneItems'])vm.runInContext(extractOriginalFunction(sync,name),env);
 const items=env._missionTargetSceneItems('industry_site');assert.equal(items.length,2);assert.ok(items.every(x=>x.title==='Microsoft_Truck_Container'));assert.equal(items[1].r,25);
 assert.ok(items.every(x=>x.pool.every(t=>!['Cardboard','Pallet01_02','CoffeeCup'].includes(t))));
});
test('new reporter truth retains picked POI instead of rounded nearby infrastructure',async()=>{
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const env=vm.createContext({window:{MissionReporterSceneCore:core},missionTruthRequestedCategory:()=> 'industry',missionTruthPrimaryCategory:()=> 'industry',missionTruthCategoryGeometryMode:()=> 'area',missionTargetVisualProminence:()=>({})});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'buildMissionTruth'),env);
 const result=env.buildMissionTruth({isPOI:true,targetLat:48.33255,targetLon:8.04059,newsBriefing:{schema:'news-briefing.v1'},missionContract:{taskDomain:'news_coverage'}},{anchors:{power:{distM:185,bearingDeg:331}}});
 assert.equal(result.mainTarget.lat,48.33255);assert.equal(result.sceneAnchor.lon,8.04059);assert.equal(result.sceneAnchor.headingDeg,0);
 assert.equal(core.enabled({infraBriefing:{schema:'infra-briefing.v1'}}),false);
});
test('recorded Erlenbach map rejects former scene anchor and retains actual industrial target surface',()=>{
 const g=core.geometry(JSON.parse(fs.readFileSync('tools/fixtures/reporter-erlenbach-osm.json','utf8')),{lat:48.33255,lon:8.04059});
 assert.ok(g.shapes.filter(s=>s.type==='building').length>=18);
 assert.deepEqual(g.targetSurfaceIds,['way/227100221']);
 assert.ok(core.placementError(core.local({lat:48.334005,lon:8.039377},g.origin),9,g));
 assert.ok(g.candidates.length>5);assert.ok(g.candidates.every(p=>!core.placementError(p,9,g)));
});

test('new POI compositions enroll per mission, legacy/APT/Bush/fire remain outside the new contract',()=>{
 for(const task of ['inspection_infra','media_photo','news_coverage','search_and_rescue','science_bio','mapping_survey','sightseeing_tour']){
  const md={isPOI:true,missionType:'poi'},contract={taskDomain:task};
  assert.equal(core.enabled(md,contract),false);assert.ok(core.enroll(md,contract));
  assert.ok(core.enabled(JSON.parse(JSON.stringify(md)),JSON.parse(JSON.stringify(contract))));
 }
 for(const [md,c] of [[{missionType:'apt'},{}],[{isPOI:true,missionType:'bush'},{}],[{isPOI:true},{taskDomain:'fire_watch'}]])assert.equal(core.enroll(md,c),false);
});

test('surface contract separates boats, land props, forest search targets and measured roads',()=>{
 const env={window:{}};vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);const assets=env.window.MISSION_SCENE_ASSETS;
 const square=[[-100,-100],[100,-100],[100,100],[-100,100],[-100,-100]];
 const water=core.geometry({elements:[way(1,{natural:'water'},square)]},origin);
 const forest=core.geometry({elements:[way(2,{landuse:'forest'},square)]},origin);
 const road=width=>core.geometry({elements:[way(3,{highway:'primary',...(width?{width}: {})},[[-100,0],[100,0]])]},origin);
 const requirement=(feature,surface)=>({feature,role:assets.targetSceneFeatures[feature].primaryRole||assets.targetSceneFeatures[feature].roles[0],surface,count:1,forwardM:0,rightM:0});
 const check=(r,g)=>core.validate({kind:'sar_water',density:'sparse',requirements:[r]},g,assets);
 assert.deepEqual(check(requirement('liferaft','water'),water),[]);
 assert.ok(check(requirement('liferaft','ground'),geo).length);
 assert.ok(check(requirement('pavilion','water'),water).length);
 assert.deepEqual(check(requirement('missing_person','forest'),forest),[]);
 assert.ok(check(requirement('road_vehicles','forest'),forest).length);
 assert.deepEqual(check(requirement('road_vehicles','road'),road('14')),[]);
 assert.ok(check(requirement('road_vehicles','road'),road(null)).length);
 assert.ok(check({...requirement('aircraft_wreck','forest'),role:'debris.light'},forest).length);
 assert.ok(water.surfaceCandidates.water.length);assert.equal(water.candidates.length,0);
 assert.ok(forest.surfaceCandidates.forest.length);
});

test('shared composer context preserves each mission story, intent, domain and plan',async()=>{
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const env=vm.createContext({window:{MissionReporterSceneCore:core},compactSceneComposerStory:x=>x,compactMissionPlanV2ForPrompt:x=>x,missionPlanV2SceneDirective:p=>p?.plan});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'scenePlannerV3ReporterContext'),env);
 for(const task of ['inspection_infra','media_photo','science_bio','search_and_rescue']){
  const contract={taskDomain:task,missionStory:'Chosen '+task},md={isPOI:true,sceneIntent:{summary:'Own action'},missionPlanV2:{plan:{taskDomain:task,sceneKind:'survey_context'}}};
  core.enroll(md,contract);const result=env.scenePlannerV3ReporterContext(md,contract,{reporterPlacement:geo},{}).reporterScene;
  assert.equal(result.mission.story,contract.missionStory);assert.equal(result.mission.taskDomain,task);assert.equal(result.sceneIntent,md.sceneIntent);assert.equal(result.directive.taskDomain,task);
 }
});

test('SAR composer rejects missing primary scene objects and passive plans cannot acquire decoration',async()=>{
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const env=vm.createContext({window:{MissionReporterSceneCore:core,MISSION_SCENE_ASSETS:cat},sanitizeMissionTargetSceneSpec:x=>x,missionPlanV2SceneDirective:p=>p,scenePlannerV3Array:x=>x,MISSION_SCENE_PLANNER_V3_VERSION:'test'});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'sanitizeScenePlannerV3Result'),env);
 const ctx={isPOI:true,md:{poiScenePlacementVersion:core.VERSION},contract:{taskDomain:'search_and_rescue'},missionPlanV2:{sceneKind:'sar_land',objectFamilies:['missing_person']},targetGeoContext:{reporterPlacement:geo}};
 assert.throws(()=>env.sanitizeScenePlannerV3Result({targetScene:{kind:'none'}},{},ctx),/Erforderliche Suchobjekte/);
 assert.throws(()=>env.sanitizeScenePlannerV3Result({targetScene:{kind:'industry_site',requirements:[req(0,0)]}},{},{...ctx,missionPlanV2:{sceneKind:'none'}}),/keine Zielobjekte/);
});

test('river centerlines are not obstacles for boats inside a mapped water polygon; closed roads are not plazas',()=>{
 const square=[[-100,-100],[100,-100],[100,100],[-100,100],[-100,-100]];
 const river=core.geometry({elements:[way(1,{natural:'water'},square),way(2,{waterway:'river'},[[-100,0],[100,0]])]},origin);
 assert.equal(core.placementError({x:0,y:0},7,river,'water'),'');
 const ring=core.geometry({elements:[way(3,{highway:'primary',width:'14'},square)]},origin);
 assert.ok(core.placementError({x:0,y:0},5,ring,'road'));
});

test('failed shared scene composition keeps the draft; neither random fallback nor acceptance runs',async()=>{
 const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('window.acceptMissionDraft = async function()'),end=source.indexOf('\n};',start)+3;
 for(const failure of ['invalid-layout','throw']){
  let saves=0;
  const md={isPOI:true,missionType:'poi',sceneAccepted:false,missionContract:{taskDomain:'inspection_infra'}};
  const env=vm.createContext({window:{MissionReporterSceneCore:core},currentMissionData:md,document:{getElementById:()=>({})},updateMissionAcceptanceUi:()=>{},fetchMissionTargetGeoContext:async()=>({reporterPlacement:geo}),buildMissionTruth:()=>({}),
   composeMissionTargetSceneWithGemini:async()=>{if(failure==='throw')throw Error('failure');return {debug:{error:failure}};},
   applyMissionTargetSceneComposition:()=>{throw Error('must not accept');},deriveMissionTargetSceneFromIntent:()=>{throw Error('must not substitute random objects');},saveMissionState:()=>saves++});
  vm.runInContext(source.slice(start,end),env);assert.equal(await env.window.acceptMissionDraft(),false);assert.equal(md.sceneAccepted,false);assert.equal(md.sceneCompositionStatus,'draft');assert.equal(saves,1);
 }
});

test('v3 preserves land use, actual paving and capacity; meadow cannot masquerade as portal frontage',()=>{
 const square=[[-100,-100],[100,-100],[100,100],[-100,100],[-100,-100]];
 const raw={elements:[way(1,{landuse:'meadow'},square),way(2,{highway:'primary',tunnel:'yes',name:'Any arbitrary name'},[[-450,0],[0,0],[650,0]])]};
 const g=core.geometry(raw,origin);
 assert.equal(g.anchors.length,2);assert.equal(g.anchors[0].x,-450);assert.equal(g.anchors[1].x,650);
 const site=g.sites.find(s=>s.id==='way/1');assert.equal(site.usage,'meadow');assert.equal(site.surface,'unknown');assert.ok(site.slots.every(p=>p.clearanceM>1.5));
 const scene={kind:'construction_site',placementVersion:core.VERSION,placementIntent:{use:'portal_access',anchorId:g.anchors[0].id},requirements:[{...req(0,0),siteId:'way/1'}]};
 assert.ok(core.validate(scene,g,cat).some(x=>x.includes('Nutzung meadow')));
 scene.placementIntent={use:'open_field',requiresPaved:true};assert.ok(core.validate(scene,g,cat).some(x=>x.includes('Befestigte Oberfläche')));
 scene.placementIntent={use:'open_field',requiresPaved:false};assert.deepEqual(core.validate(scene,g,cat),[]);
});

test('v3 portal access requires mapped end proximity; unsupported surface cannot be rescued by coordinates',()=>{
 const g=core.geometry({elements:[way(1,{amenity:'parking',surface:'asphalt'},[[-500,-50],[-400,-50],[-400,50],[-500,50],[-500,-50]]),way(2,{highway:'primary',tunnel:'yes'},[[-450,0],[0,0],[650,0]])]},origin);
 const scene={kind:'construction_site',placementVersion:core.VERSION,placementIntent:{use:'portal_access',anchorId:g.anchors[0].id,requiresPaved:true},requirements:[{...req(0,-450),siteId:'way/1'}]};
 assert.deepEqual(core.validate(scene,g,cat),[]);
 scene.placementIntent.anchorId=g.anchors[1].id;assert.ok(core.validate(scene,g,cat).some(x=>x.includes('Portalbezug')));
 scene.requirements[0].siteId='invented';assert.ok(core.validate(scene,g,cat).some(x=>x.includes('siteId')));
});

test('v3 measured roads remain available as explicit sites',()=>{
 const g=core.geometry({elements:[way(1,{highway:'primary',width:'14',surface:'asphalt'},[[-100,0],[100,0]])]},origin);
 const s=g.sites.find(s=>s.id==='way/1');assert.equal(s.medium,'road');assert.equal(s.surface,'asphalt');assert.ok(s.slots.length);
});

test('correction cannot evade portal validation by changing the job to a meadow camp',()=>{
 const scene={kind:'industry_site',placementVersion:core.VERSION,placementRequirement:{use:'portal_access',requiresPaved:false},placementIntent:{use:'nature',requiresPaved:false},requirements:[req(0,0)]};
 assert.ok(core.validate(scene,geo,cat)[0].includes('Räumlicher Zweck ist verbindlich'));
 scene.placementIntent={use:'portal_access',requiresPaved:true};assert.ok(core.validate(scene,geo,cat)[0].includes('Räumlicher Zweck ist verbindlich'));
 assert.deepEqual(core.validate({...scene,kind:'none'},geo,cat),[]);
});

test('optional reporter scene is explicitly omitted when its locked purpose has no mapped site',async()=>{
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const g=core.geometry({elements:[way(1,{landuse:'meadow'},[[-100,-100],[100,-100],[100,100],[-100,100],[-100,-100]]),way(2,{highway:'primary',tunnel:'yes'},[[-450,0],[0,0],[650,0]])]},origin);
 assert.equal(core.hasPlacementSite({use:'portal_access',anchorId:g.anchors[0].id},g),false);
 const env=vm.createContext({window:{MissionReporterSceneCore:core,MISSION_SCENE_ASSETS:cat},sanitizeMissionTargetSceneSpec:x=>x,missionPlanV2SceneDirective:()=>null,scenePlannerV3Array:x=>x,MISSION_SCENE_PLANNER_V3_VERSION:'test'});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'sanitizeScenePlannerV3Result'),env);
 const ctx={isPOI:true,md:{poiScenePlacementVersion:core.VERSION},contract:{taskDomain:'news_coverage'},targetGeoContext:{reporterPlacement:g},placementRequirement:{use:'portal_access',anchorId:g.anchors[0].id,requiresPaved:false}};
 const result=env.sanitizeScenePlannerV3Result({targetScene:{kind:'industry_site',requirements:[req(0,0)],placementIntent:{use:'nature'}}},{},ctx);
 assert.equal(result.targetScene.kind,'none');assert.ok(result.debug.omissionReason);assert.equal(result.debug.error,'');
});

test('planning pockets keep support near one activity and do not connect through mapped buildings',()=>{
 const g=core.geometry({elements:[way(1,{landuse:'industrial'},[[-200,-100],[200,-100],[200,100],[-200,100],[-200,-100]]),way(2,{building:'yes'},[[-5,-100],[5,-100],[5,100],[-5,100],[-5,-100]])]},origin);
 const site=g.sites.find(s=>s.id==='way/1');assert.ok(site.workAreas.length>=2);
 for(const area of site.workAreas){assert.ok(area.slots.length>=2);for(const p of area.slots){assert.ok(Math.hypot(p.x-area.center.x,p.y-area.center.y)<=60);assert.equal(Math.sign(p.x),Math.sign(area.center.x));assert.equal(core.placementError(p,1.5,g,'ground',site.id),'');}}
});

test('correction suggestions repair real clearance and group spacing without mutating the plan',()=>{
 const scene={kind:'industry_site',placementVersion:core.VERSION,placementIntent:{use:'industrial_site'},requirements:[{...req(40,40),siteId:'way/1'},{feature:'people',role:'person',count:2,arrangement:'line',spacingM:2,forwardM:0,rightM:-40,siteId:'way/1'}]};
 const original=JSON.stringify(scene),options=core.correctionOptions(scene,geo,cat);
 assert.equal(JSON.stringify(scene),original);assert.equal(options.length,2);
 for(const option of options){assert.ok(option.alternatives.length);const q={...scene.requirements[option.requirement-1],...option.alternatives[0]};assert.deepEqual(core.validate({...scene,requirements:[q]},geo,cat),[]);}
 assert.equal(options[1].minimumSpacingM,4);
});
