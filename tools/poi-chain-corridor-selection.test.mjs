import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import core from '../mission-poi-chain.js';
import runtime from '../mission-poi-chain-core.js';
const api=core._test;
test('candidate filtering uses the displayed polyline, with closed segment endpoints',()=>{
 const trace=[{lat:48,lon:8},{lat:48.1,lon:8},{lat:48.1,lon:8.1}];
 const points=[{id:'inside',lat:48.05,lon:8.005,_projection:{t:.2,crossTrackNm:0}}, {id:'outside',lat:48.05,lon:8.04,_projection:{t:.3,crossTrackNm:0}}, {id:'beyond',lat:48.2,lon:8.1,_projection:{t:1,crossTrackNm:0}}];
 const kept=api.candidatesInsideCorridor(points,trace,1.2);
 assert.deepEqual(kept.map(p=>p.id),['inside']);
 assert.equal(kept[0]._projection.t,.2);
 assert.ok(kept[0]._projection.crossTrackNm>0);
 assert.equal(points[0]._projection.crossTrackNm,0);
 assert.deepEqual(api.candidatesInsideCorridor(points,[],1.2),[]);
});
test('real local OSM prospects retain only targets inside their final displayed corridor',()=>{
 const allTiles=[];
 for(let i=330;i<=332;i++)for(let j=451;j<=452;j++)for(const layer of ['core','infra','poi']){
  const path=`obstacles/${layer}-tiles/${i}/${j}.json.gz`;
  if(fs.existsSync(path))allTiles.push(JSON.parse(gunzipSync(fs.readFileSync(path))));
 }
 assert.ok(allTiles.length>0,'Local geodata must be present for this regression test');
 const run=core.buildPoiChainProspects({dispatchStartLat:48.27917,dispatchStartLon:8.42833,minNM:5,maxNM:80,profileId:'infra_chain_recon',category:'all',maxGroupsPerTheme:4,stopAfterProspects:8,minPoints:3,maxPoints:3},{allTiles});
 assert.ok(run.ok);
 assert.ok(run.prospects.some(p=>p.chain.label==='Brückenkette Murg'));
 assert.ok(run.prospects.some(p=>p.chain.label==='Verkehrskorridor A 81'));
 for(const {chain} of run.prospects)for(const p of chain.points){
  const d=api.distanceToCorridorTraceNm(p,chain.overlay.trace);
  assert.ok(d<=chain.overlay.widthNm/2,`${chain.label}/${p.name}: ${d} NM`);
  assert.ok(Math.abs(d-p.distCorridorNm)<.001);
 }
 for(const {chain} of run.prospects){
  const normalized=runtime.normalizeSpec(chain);
  assert.ok(normalized.corridor);
  for(const p of normalized.points){
   const d=api.distanceToCorridorTraceNm(p,normalized.corridor.trace);
   assert.ok(d<=normalized.corridor.crossTrackToleranceNm,`${chain.label}/${p.name} outside runtime corridor: ${d} NM`);
  }
 }
 const b27=run.prospects.find(p=>p.chain.label==='Verkehrskorridor B 27');
 assert.ok(!b27||!b27.chain.points.some(p=>p.name==='Bargen'));
 console.log('Checked',run.prospects.length,'OSM chains /',run.prospects.reduce((n,p)=>n+p.chain.points.length,0),'points');
});
