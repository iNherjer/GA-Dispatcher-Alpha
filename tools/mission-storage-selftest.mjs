import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { extractOriginalFunction } from './extract-original-function.mjs';
import core from '../mission-storage-core.js';
const require = createRequire(import.meta.url);
const { indexedDB } = require(process.env.GA_STORAGE_TEST_IDB || 'fake-indexeddb');
function storage(limit = Infinity) {
    const map = new Map();
    return { map, get length() { return map.size; }, key: i => [...map.keys()][i] ?? null,
        getItem: k => map.get(k) ?? null, removeItem: k => map.delete(k),
        setItem(k,v) { const next = new Map(map); next.set(k,String(v));
            if ([...next].reduce((n,[key,value]) => n + 2 * (key.length + value.length),0) > limit) {
                const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
            } map.set(k,String(v)); }
    };
}
const s = storage(), now = Date.now();
s.setItem('ga_checklists_custom_v1','important'); s.setItem('ga_active_mission','original');
for (let i=0;i<100;i++) s.setItem(core.PREFIX+i, JSON.stringify({fetchedAt:now-100+i,text:'x'.repeat(15000)}));
s.setItem(core.PREFIX+'expired',JSON.stringify({fetchedAt:now-core.TTL}));
s.setItem(core.PREFIX+'bad','{');
const cleanup = core.prune(s,{now});
assert.ok(cleanup.bytes <= core.MAX_BYTES && cleanup.entries <= 32);
assert.ok(cleanup.removed > 80); assert.equal(s.getItem('ga_active_mission'),'original');
assert.equal(s.getItem('ga_checklists_custom_v1'),'important');
assert.equal(s.getItem(core.PREFIX+'expired'),null);
const large={fetchedAt:now,text:'x'.repeat(core.MAX_BYTES)};
assert.equal(core.writeGeo(s,core.PREFIX+'large',large),false); assert.equal(large.text.length,core.MAX_BYTES);
const vault=core.createVault(indexedDB), full={missionId:'test',missionTruth:{keep:'all'},text:'ü'.repeat(10000)};
const a=vault.save(full); full.text='mutated'; await a.ready;
const afterRestart=core.createVault(indexedDB);
assert.equal((await afterRestart.load(a.token)).text.length,10000);
const b=vault.save({missionId:'next'});await b.ready;
assert.equal((await afterRestart.load(a.token)).missionId,'test');
const c=vault.save({missionId:'third'});await c.ready;
await assert.rejects(afterRestart.load(a.token),/fehlt/);
assert.equal((await afterRestart.load(b.token)).missionId,'next');
await assert.rejects(core.createVault(null).save({}).ready,/nicht verfuegbar/);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sync=fs.readFileSync(new URL('../sync.js',import.meta.url),'utf8');
function appHarness(limit) {
    const local=storage(limit);const ctx={window:{GAMissionStorageCore:core,indexedDB},localStorage:local,console,
        activeMissionStoragePreferCompact:false,activeMissionFullVault:null,
        stampActiveMissionStateForStorage: state=>state,
        compactActiveMissionStateForQuotaStorage: state=>({missionId:state.missionId}),
        pruneLocalStorageBeforeActiveMissionRetry:()=>core.prune(local,{all:true}),
        _missionIsFreeflightOnly:()=>false,_syncActiveMissionIsExpired:()=>false};
    vm.createContext(ctx);
    for(const name of ['activeMissionStorageIsQuotaError','markActiveMissionStorageQuotaPressure','rememberActiveMissionStateMemoryFallback','missionFullVault','storeActiveMissionStateSafely'])
        vm.runInContext(extractOriginalFunction(app,name),ctx);
    vm.runInContext(extractOriginalFunction(sync,'_syncActiveMissionPayload'),ctx);
    return {ctx,local};
}
const roomy=appHarness(4000);
roomy.local.setItem(core.PREFIX+'old',JSON.stringify({fetchedAt:now,text:'c'.repeat(1500)}));
assert.equal(roomy.ctx.storeActiveMissionStateSafely({missionId:'new',text:'m'.repeat(1000)}),true);
assert.equal(JSON.parse(roomy.local.getItem('ga_active_mission')).text.length,1000);
assert.equal(roomy.ctx.window.__gaActiveMissionStorageFallback,undefined);
const tight=appHarness(500);
assert.equal(tight.ctx.storeActiveMissionStateSafely({missionId:'large',text:'m'.repeat(1000)}),false);
const pointer=JSON.parse(tight.local.getItem('ga_active_mission'));
assert.ok(pointer.localStorageFallbackId);
assert.equal(tight.ctx._syncActiveMissionPayload().text.length,1000);
tight.ctx.window.storeActiveMissionStateSafely = tight.ctx.storeActiveMissionStateSafely;
vm.runInContext(extractOriginalFunction(sync,'_mutateStoredActiveMissionRuntimeMarker'),tight.ctx);
assert.equal(tight.ctx._mutateStoredActiveMissionRuntimeMarker(state => { state.activeMissionRuntimePhase = 'boarding'; }),true);
const updatedPointer=JSON.parse(tight.local.getItem('ga_active_mission'));
const updated=await tight.ctx.missionFullVault().load(updatedPointer.localStorageFallbackId);
assert.equal(updated.activeMissionRuntimePhase,'boarding');
assert.equal(updated.text.length,1000);
const restored=await tight.ctx.missionFullVault().load(pointer.localStorageFallbackId);
assert.equal(restored.text.length,1000);
tight.ctx.rememberActiveMissionStateMemoryFallback(null);
assert.throws(()=>tight.ctx._syncActiveMissionPayload(),/Cloud-Schutz/);
vm.runInContext(app.slice(app.indexOf('window.resolveActiveMissionStorageState ='), app.indexOf('function storeActiveMissionStateSafely(')), tight.ctx);
await tight.ctx.window.resolveActiveMissionStorageState(updatedPointer);
assert.equal(tight.ctx._syncActiveMissionPayload().activeMissionRuntimePhase,'boarding');
tight.ctx.rememberActiveMissionStateMemoryFallback(null);
const pending=tight.ctx.window.resolveActiveMissionStorageState(updatedPointer);
tight.local.removeItem('ga_active_mission');
await assert.rejects(pending,/geaendert/);
assert.equal(tight.ctx.window.__gaActiveMissionStorageFallback,undefined);
console.log('PASS: cache expiry/budget/isolation, IndexedDB restart/two-slot retention/failure, full retry before reduction, lossless cloud fallback and reload guard');
