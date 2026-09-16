const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../board.js'),'utf8');
function fixture(raw) {
 const alerts=[], writes=[];
 const c={window:{},localStorage:{getItem:()=>JSON.stringify(raw),setItem(){throw Error('quota');}},alert:x=>alerts.push(x),
  navigator:{clipboard:{writeText:async x=>writes.push(x)}},btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary'),encodeURIComponent,decodeURIComponent};
 vm.createContext(c);const start=source.indexOf('window.exportMission =');const end=source.indexOf('// ==========================================',start);
 vm.runInContext(source.slice(start,end),c);return {c,alerts,writes};
}
test('flight code exports full IndexedDB state and never a local locator',async()=>{
 const f=fixture({localStorageFallbackId:'local-only'}),full={currentMissionData:{missionTruth:{original:'ä'.repeat(300000)}}};
 f.c.window.resolveActiveMissionStorageState=async()=>full;
 await f.c.window.exportMission();
 assert.deepEqual(JSON.parse(decodeURIComponent(Buffer.from(f.writes[0],'base64').toString('binary'))),full);
 const blocked=fixture({localStorageFallbackId:'missing'});await blocked.c.window.exportMission();assert.equal(blocked.writes.length,0);assert.match(blocked.alerts[0],/kein gekuerzter/);
});
test('import uses full storage helper at quota pressure, rejecting foreign fallback locators',async()=>{
 const f=fixture(null);let saved,restored;
 const full={currentMissionData:{story:'ä'.repeat(300000)}};
 f.c.prompt=()=>Buffer.from(encodeURIComponent(JSON.stringify(full)),'binary').toString('base64');
 f.c.window.storeActiveMissionStateSafely=s=>{saved=s;return false;};
 f.c.restoreMissionState=async s=>{restored=s;return true;};
 await f.c.window.importMission();assert.deepEqual(JSON.parse(JSON.stringify(saved)),full);assert.equal(saved,restored);
 f.c.prompt=()=>Buffer.from(encodeURIComponent(JSON.stringify({localStorageFallbackId:'foreign'})),'binary').toString('base64');saved=null;
 await f.c.window.importMission();assert.equal(saved,null);
});
