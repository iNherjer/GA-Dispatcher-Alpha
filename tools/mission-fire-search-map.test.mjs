import {test} from 'node:test';
import assert from 'node:assert/strict';
import api from '../mission-fire-search-map.js';
import fireTask from '../ga-tracker-client/tracker-mission-fire-task.js';
test('public area stays at the reference centre and never contains private fire coordinates',()=>{
 const scenario={enabled:true,type:'fire_watch',target:{lat:48,lon:8},targetAreaNm:1.5,smoke:{sites:[{lat:48.01,lon:8.01}]},truth:'fire'};
 const projection=fireTask.project({fireState:{scenario},observedAt:1000});
 assert.deepEqual(projection.searchArea,{center:{lat:48,lon:8},radiusM:2778,findings:[]});
 assert.equal(JSON.stringify(projection).includes('48.01'),false);
 assert.deepEqual(api.fromScenario(scenario),projection.searchArea);
 assert.equal(api.fromControl({recipe:'poi',phase:'closed',poiTask:{fireWatch:projection}}),null);
});
test('map draws only red area and centre, deduplicates polls and removes stale mission overlays',()=>{
 const drawn=[],removed=[],map={removeLayer:l=>removed.push(l)};
 const shape=(kind,point,options)=>{const s={kind,point,options,bindTooltip(){return this;},addTo(){drawn.push(s);return this;}};return s;};
 const L={layerGroup:()=>({addTo(){return this;}}),polygon:(p,o)=>shape('fill',p,o),polyline:(p,o)=>shape('stroke',p,o),circleMarker:(p,o)=>shape('centre',p,o)};
 const area=api.area({lat:48,lon:8},1.5);api.render(map,L,area);api.render(map,L,structuredClone(area));
 assert.equal(drawn.length,6);assert.equal(drawn[2].options.color,'#e53935');assert.deepEqual(drawn[5].point,[48,8]);assert.equal(drawn[2].options.lineCap,'round');
 api.render(map,L,api.area({lat:49,lon:9},2));assert.equal(removed.length,1);
 api.render(map,L,null);assert.equal(removed.length,2);
 api.render(map,L,{center:{lat:NaN,lon:8},radiusM:1000});assert.equal(drawn.length,12);
});

test('wax stroke has stable overshooting ends and modest unevenness while the contract radius stays exact',()=>{
 const area=api.area({lat:48,lon:8},1.5),path=api.waxPath(area);assert.deepEqual(path,api.waxPath(structuredClone(area)));assert.notDeepEqual(path[0],path.at(-1));
 const distance=p=>Math.hypot((p[0]-48)*111195,(p[1]-8)*111195*Math.cos(48*Math.PI/180));const radii=path.map(distance);assert.ok(Math.max(...radii)-Math.min(...radii)>40);assert.ok(radii.every(r=>r>area.radiusM*.96&&r<area.radiusM*1.04));assert.equal(area.radiusM,2778);
});

test('revealed findings alone reach the public map and produce wax crosses',()=>{
 const scenario={enabled:true,type:'fire_watch',target:{lat:48,lon:8},targetAreaNm:1.5,truth:'fire',smoke:{sites:[{lat:48.02,lon:8.02,siteId:'hidden'}]},search:{findings:[{id:'seen',lat:48.001,lon:8,kind:'heat_suspicion',detectedAt:1000}]}};
 const projection=fireTask.project({fireState:{scenario},observedAt:1000});
 assert.equal(JSON.stringify(projection).includes('48.02'),false);
 assert.deepEqual(projection.searchArea.findings,[{id:'seen',lat:48.001,lon:8,kind:'heat_suspicion'}]);
 const strokes=[],map={removeLayer(){}};const shape=(p,o)=>({addTo(){strokes.push({p,o});return this;},bindTooltip(){return this;}});
 const L={layerGroup:()=>({addTo(){}}),polygon:shape,polyline:shape,circleMarker:shape};
 api.render(map,L,projection.searchArea);assert.equal(strokes.length,12);
 api.render(map,L,structuredClone(projection.searchArea));assert.equal(strokes.length,12);
});

test('completion and reset remove circle and all crosses instead of resurrecting saved findings',()=>{
 const fs={enabled:true,type:'fire_watch',target:{lat:48,lon:8},search:{findings:[{id:'a',lat:48.001,lon:8,kind:'smoke'}]}};
 assert.equal(api.fromScenario(fs,'closing'),null);assert.equal(api.fromScenario(fs,'closed'),null);
 const removed=[],map={removeLayer(l){removed.push(l);}},shape=()=>({addTo(){return this;},bindTooltip(){return this;}}),L={layerGroup:()=>({addTo(){}}),polyline:shape,polygon:shape,circleMarker:shape};
 const projection=fireTask.project({fireState:{scenario:fs},observedAt:1000});
 api.render(map,L,api.fromControl({recipe:'poi',phase:'active',poiTask:{fireWatch:projection}}));
 api.render(map,L,api.fromControl({recipe:'poi',phase:'closed',flags:{closed:true},poiTask:{fireWatch:projection}}));
 assert.equal(removed.length,1);
 api.render(map,L,api.fromScenario(fs));api.render(map,L,api.fromControl(null));assert.equal(removed.length,2);
 assert.equal(api.fromControl({recipe:'poi',phase:'active',flags:{closed:true},poiTask:{fireWatch:projection}}),null);
});

test('SAR circle hides private scene before start and only verified contact gets a cross; reset removes both',()=>{
 const scenario={schema:'sar-search.v2',center:{lat:48,lon:8},radiusNm:1.5,truth:'incident',source:{lat:48.01,lon:8.02}};
 assert.deepEqual(api.fromScenario(scenario,'planned'),{center:{lat:48,lon:8},radiusM:2778,findings:[]});
 assert.equal(JSON.stringify(api.fromScenario(scenario)).includes('48.01'),false);
 const drawn=[],removed=[],map={removeLayer:l=>removed.push(l)},shape=(p,o)=>({addTo(){drawn.push({p,o});return this;},bindTooltip(text){this.text=text;return this;}}),L={layerGroup:()=>({addTo(){}}),polygon:shape,polyline:shape,circleMarker:shape};
 const projection={searchArea:{...api.fromScenario(scenario),findings:[{id:'seen',lat:48.01,lon:8.02,kind:'sar_contact'}]}};
 api.render(map,L,api.fromControl({recipe:'poi',phase:'active',poiTask:{sarSearch:projection}}));assert.equal(drawn.length,12);
 api.render(map,L,api.fromControl({recipe:'poi',phase:'closed',flags:{closed:true},poiTask:{sarSearch:projection}}));assert.equal(removed.length,1);
});
