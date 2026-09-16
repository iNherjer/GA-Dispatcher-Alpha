'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./tracker-efb-kartentisch-host'),'utf8');
test('flight polling separates render failures, transient delays and genuine disconnects',async()=>{
 let result={localRevision:1}, error=null,renderError=false, time=1000, disconnected=0;
 const states=[],reports=[],timers=[],parents=[];
 const ctx={pollingClosed:false,trackerOnline:false,localFlightRevision:null,pollTimer:0,
   Date:{now:()=>time},safePayload:v=>v,fetchJson:()=>error?Promise.reject(error):Promise.resolve(result),
   renderFlight:()=>{if(renderError)throw Error('bad drawing');},disconnectFlight:()=>disconnected++,
   setTrackerState:(text,bad)=>states.push({text,bad}),notifyParentState:s=>parents.push(s),report:(...v)=>reports.push(v),
   window:{setTimeout:(fn,ms)=>{timers.push({fn,ms});return 1;}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  var flightPollFailures'),source.indexOf('  function pollAuxiliary')),ctx);
 const poll=async()=>{ctx.poll();await new Promise(r=>setImmediate(r));};
 await poll();assert.equal(ctx.trackerOnline,true);
 renderError=true;await poll();assert.equal(ctx.trackerOnline,true);assert.equal(disconnected,0);
 assert.ok(reports.some(v=>v[2]==='flight-error'&&v[4].includes('bad drawing')));
 renderError=false;error=Error('tracker_request_timeout');time=6000;await poll();
 assert.equal(disconnected,0);assert.match(states.at(-1).text,/verzögert/);
 time=12000;await poll();assert.equal(disconnected,1);assert.equal(parents.at(-1),'error');
 error=null;time=13000;await poll();assert.equal(ctx.trackerOnline,true);assert.equal(parents.at(-1),'live');
 assert.equal(timers.length,5,'exactly one next request per outcome');
});
