const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-environment-core.js');
const now=new Date('2026-10-07T07:15:00Z'),p={name:'Test strip',lat:44,lon:-115};
function fixture(){const hourly={time:Array.from({length:79},(_,i)=>new Date(Date.parse('2026-10-04T07:00Z')+i*3600000).toISOString().slice(0,16))};for(const k of Object.keys(core.fields))hourly[k]=Array(79).fill(k==='precipitation'?1:k==='temperature_2m'?-12:0);return {utc_offset_seconds:0,hourly_units:core.fields,hourly};}
function browser(){const window={MissionEnvironmentCore:core};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-environment-browser.js'),'utf8'),{window,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Map});return window.MissionEnvironmentBrowser;}
test('72-hour retrospective is separated from forecast and current; units and device creation time stay explicit',()=>{const data=core.summarize(fixture(),p,now);assert.equal(data.past72Hours.statistics.precipitation.total,72);assert.equal(data.current.values.temperature_2m,-12);assert.equal(data.past72Hours.availableHours,72);assert.equal(data.current.validAt,'2026-10-07T07:00:00.000Z');assert.equal(core.temporal(now).departureTimeKnown,false);});
test('missing values, missing hours, duplicate hours and wrong units never turn into dry-weather totals',()=>{for(const mutate of [d=>d.hourly.precipitation[3]=null,d=>{d.hourly.time[3]=d.hourly.time[4];},d=>{d.hourly_units={...core.fields,precipitation:'in'};}]){const d=fixture();mutate(d);assert.equal(core.summarize(d,p,now).past72Hours.statistics.precipitation.total,null);}assert.equal(core.location({lat:null,lon:null}),null);assert.equal(core.summarize({...fixture(),utc_offset_seconds:3600},p,now).status,'unavailable');});
test('browser caches two locations and joins simultaneous identical requests',async()=>{const b=browser();let calls=0;const fetch=async()=>{calls++;return {ok:true,json:async()=>fixture()};};const target={...p,name:'Target',lon:-114};await Promise.all([b.load(p,target,{date:now,fetch}),b.load(p,target,{date:now,fetch})]);assert.equal(calls,2);const cached=await b.load({...p,name:'Renamed'},target,{date:now,fetch});assert.equal(calls,2);assert.equal(cached.start.location.name,'Renamed');assert.equal(cached.time.createdAt,now.toISOString());});
test('timeout also works when fetch ignores abort; HTTP failure permits context and retries',async()=>{const b=browser();const a=await b.load(p,p,{date:now,timeoutMs:10,fetch:()=>new Promise(()=>{})});assert.equal(a.start.reason,'timeout');const bad=await b.load(p,p,{date:now,fetch:async()=>({ok:false,status:429})});assert.equal(bad.start.reason,'HTTP 429');const good=await b.load(p,p,{date:now,fetch:async()=>({ok:true,json:async()=>fixture()})});assert.equal(good.start.status,'available');});
test('shared context reaches Bush narrative prompt while other profiles are not enabled',()=>{globalThis.MissionEnvironmentCore=core;const bush=require('../mission-bush-narrative-core.js');const context=core.context(p,{...p,lon:-114},[],now);const f=bush.frame({start:p,target:{...p,lon:-114},passenger:{name:'Alex'},environmentContext:context});assert.ok(bush.prompt(f).includes('ENVIRONMENT_CONTEXT'));assert.ok(bush.prompt(f).includes('user-device-local'));const app=fs.readFileSync(require.resolve('../app.js'),'utf8');assert.match(app,/requestedMissionType === 'bush' && aiModeEnabled && window.MissionEnvironmentBrowser/);assert.match(app,/prompt\(contract.environmentContext\)/);assert.match(app,/prompt\(contextBundle.environmentContext\)/);delete globalThis.MissionEnvironmentCore;});

test('actual V4/V5 request adapters pass the environment to the writer; ordinary APT receives no addition',async()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),environment=core.context(p,p,[],now);
 for(const version of ['V4','V5']){
  const a=source.indexOf('async function fetchMissionWriter'+version+'('),b=source.indexOf('window.fetchMissionWriter'+version+' =',a);let sent;
  const c={window:{MissionEnvironmentCore:core},getSelectedAiApiKey:()=> 'test',getSelectedAiProvider:()=> 'gemini',document:{getElementById:()=>({checked:true})},fetchGeminiJsonWithFallback:async prompt=>{sent=prompt;return {parsed:{}};}};
  c['buildMissionWriter'+version+'Prompt']=()=> 'BASE';c['sanitizeMissionWriter'+version+'Payload']=x=>x;
  vm.runInNewContext(source.slice(a,b),c);
  await c['fetchMissionWriter'+version]({missionType:'bush',missionContractV4:{status:'ready',environmentContext:environment}});
  assert.ok(sent.includes(environment.time.createdAt));assert.ok(sent.includes(core.instructions));
  await c['fetchMissionWriter'+version]({missionType:'apt',missionContractV4:{status:'ready'}});assert.equal(sent,'BASE');
 }
});

test('six forecast points are ordered, future-only and do not affect retrospective precipitation',()=>{
 const d=fixture();for(let i=73;i<79;i++){d.hourly.precipitation[i]=20;d.hourly.temperature_2m[i]=-i;}
 const result=core.summarize(d,p,now),f=result.forecastNext6Hours;
 assert.equal(f.availableHours,6);assert.equal(f.hours.length,6);
 assert.equal(f.hours[0].validAt,'2026-10-07T08:00:00.000Z');assert.equal(f.hours[5].validAt,'2026-10-07T13:00:00.000Z');
 assert.equal(result.past72Hours.statistics.precipitation.total,72);assert.equal(f.hours[0].values.precipitation,20);
 d.hourly.temperature_2m[75]=null;assert.equal(core.summarize(d,p,now).forecastNext6Hours.hours[2].values.temperature_2m,null);
 d.hourly.time[75]='bad timestamp';assert.equal(core.summarize(d,p,now).forecastNext6Hours.availableHours,5);
});

function longForecast(){const d=fixture(),begin=Date.parse('2026-10-04T07:00Z');d.hourly.time=Array.from({length:145},(_,i)=>new Date(begin+i*3600000).toISOString().slice(0,16));for(const k of Object.keys(core.fields))d.hourly[k]=Array(145).fill(0);return d;}
test('three rolling forecast windows preserve tomorrow snow/wind and stay separate from history',()=>{
 const d=longForecast();for(let i=97;i<=120;i++){d.hourly.snowfall[i]=.5;d.hourly.wind_gusts_10m[i]=35;d.hourly.temperature_2m[i]=-12;d.hourly.snow_depth[i]=.6;}
 const result=core.summarize(d,p,now),outlook=result.forecastNext72Hours;
 assert.equal(outlook.availableHours,72);assert.equal(outlook.windows.length,3);
 assert.equal(outlook.windows[0].statistics.snowfall.total,0);assert.equal(outlook.windows[1].statistics.snowfall.total,12);
 assert.equal(outlook.windows[1].statistics.wind_gusts_10m.max,35);assert.equal(outlook.windows[1].statistics.snow_depth.max,.6);
 assert.equal(result.past72Hours.statistics.snowfall.total,0);assert.equal(outlook.windows[2].statistics.snowfall.total,0);
 assert.equal(outlook.windows[1].fromExclusive,'2026-10-08T07:00:00.000Z');assert.equal(outlook.windows[2].toInclusive,'2026-10-10T07:00:00.000Z');
});
test('missing or duplicate forecast hours prevent complete sums; short forecast leaves later windows unknown',()=>{
 const d=longForecast();d.hourly.snowfall[100]=null;let result=core.summarize(d,p,now);
 assert.equal(result.forecastNext72Hours.windows[1].statistics.snowfall.total,null);
 d.hourly.time[100]=d.hourly.time[101];result=core.summarize(d,p,now);
 assert.equal(result.forecastNext72Hours.windows[1].availableHours,22);assert.equal(result.forecastNext72Hours.windows[1].statistics.precipitation.total,null);
 result=core.summarize(fixture(),p,now);assert.equal(result.forecastNext72Hours.windows[2].availableHours,0);assert.equal(result.forecastNext72Hours.windows[2].statistics.precipitation.total,null);
});


test('the Bush environment path never appends a mandatory weather paragraph after writing',()=>{
 const src=fs.readFileSync(require.resolve('../app.js'),'utf8'),a=src.indexOf('function _missionPipelineV4EnsureBushPickupConditions('),b=src.indexOf('\nfunction ',a+10);
 const c={_missionPipelineV4BushPickupConditionSentence:()=>{throw Error('Must not add conditions');}};vm.runInNewContext(src.slice(a,b),c);
 assert.equal(c._missionPipelineV4EnsureBushPickupConditions('Wir holen die Wanderin ab.',{environmentContext:{schema:'mission-environment.v1'}}),'Wir holen die Wanderin ab.');
});
