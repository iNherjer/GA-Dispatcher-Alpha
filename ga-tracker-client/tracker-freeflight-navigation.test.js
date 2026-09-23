'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const core = require('../freeflight-navigation-core');
const { createCockpitTools } = require('./tracker-cockpit-tools');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud');
const state = () => ({ currentMissionData: { freeflightOnly: true, mission: 'Freiflug zur Burg', s: 'Route anschauen, kein Auftrag.' },
  currentStartICAO: 'EDTW', currentDestICAO: 'EDTW', routeWaypoints: [
    { lat: 48, lng: 8, icao: 'EDTW' }, { lat: 48.3, lng: 8.5, isPOI: true, name: 'Burg' }, { lat: 48, lng: 8, icao: 'EDTW' }] });
test('freeflight cloud is navigation only and preserves route and plain briefing roundtrip', () => {
  const nav = core.build(state());
  assert.deepEqual(core.build(core.toState(nav)), nav);
  const cloud = buildCloudMissionCandidate({ activeMission: null, activeMissionTrackerSeed: null, freeflightNavigation: nav });
  assert.equal(cloud.status, 'navigation'); assert.equal(cloud.candidate, null); assert.deepEqual(cloud.navigation, nav);
  assert.equal(core.build({ currentMissionData: { missionType: 'poi' } }), null);
  assert.throws(() => core.normalize({ ...nav, points: [{ lat: 90, lon: 181 }, nav.points[0]] }), /navigation_point_invalid/);
  assert.throws(() => core.normalize({ ...nav, briefing: { story: 'x'.repeat(32769) } }), /freeflight_size_limit/);
  assert.equal(buildCloudMissionCandidate({ freeflightNavigation: { ...nav, version: 2 } }).ok, false);
  const html = core.toState({ ...nav, briefing: { title: '<img src=x onerror=alert(1)>', story: '<b>Text</b>' } });
  assert.match(html.mTitle, /^&lt;img/); assert.equal(html.mStory, '<b>Text</b>');
});
test('cloud adoption persists once; local edits, direct-to, clear and restart do not resurrect stale route', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeflight-nav-')); t.after(() => fs.rmSync(dir, { recursive:true,force:true }));
  let run = null;
  const options = { filename: path.join(dir,'nav.json'), getRun: () => run, getFlight: () => ({ lat:48,lon:8 }), now:()=>123 };
  let tools = createCockpitTools(options); const nav = core.build(state());
  assert.equal(tools.adoptCloud(nav).changed, true);
  const saved = fs.readFileSync(options.filename,'utf8');
  assert.equal(tools.adoptCloud(nav).changed,false); assert.equal(fs.readFileSync(options.filename,'utf8'),saved);
  assert.equal(tools.snapshot().navigationOnly,true); assert.deepEqual(tools.snapshot().briefing,nav.briefing);
  const current=tools.navigation();
  assert.equal((await tools.execute({ intent:'navigation_edit',expectedRevision:current.revision,payload:{routeId:current.id,edit:{action:'insert',index:1,point:{lat:48.1,lon:8.2}}}})).ok,true);
  tools=createCockpitTools(options); assert.equal(tools.navigation().points.length,4);
  assert.equal(tools.adoptCloud(nav).changed,false); assert.equal(tools.navigation().points.length,4);
  run={runId:'active'}; assert.equal(tools.adoptCloud({...nav,briefing:{title:'New',story:''}}).error,'mission_authority_conflict');
  tools.clear(); run=null; tools=createCockpitTools(options); assert.equal(tools.snapshot(),null);
  assert.equal(tools.adoptCloud(nav).changed,false); assert.equal(tools.snapshot(),null);
  assert.equal(tools.adoptCloud({...nav,briefing:{title:'New',story:''}}).changed,true);
  tools.clear();
  assert.equal(tools.adoptCloud({...nav,planId:'new-explicit-flight'}).changed,true);
});
test('failed persistence retains prior navigation and retries without claiming adoption', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'freeflight-write-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'missing','nav.json'); const tools=createCockpitTools({filename,getRun:()=>null,getFlight:()=>null});
  const nav=core.build(state()); assert.equal(tools.adoptCloud(nav).ok,false);assert.equal(tools.snapshot(),null);
  fs.mkdirSync(path.dirname(filename));assert.equal(tools.adoptCloud(nav).changed,true);
});
test('browser and node freeflight core normalize identically', () => {
  const browser=vm.createContext({});
  for(const file of ['map-route-edit-core.js','freeflight-navigation-core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),browser);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.GAFreeflightNavigationCore.build(state()))),core.build(state()));
});

test('App cloud payload carries freeflight separately and all save/compare paths include it', () => {
  const source=fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8');
  const start=source.indexOf('function _syncFreeflightNavigationPayload()');
  const fn=source.slice(start,source.indexOf('\nfunction ',start+1));
  let stored=state();
  const sandbox=vm.createContext({window:{GAFreeflightNavigationCore:core},localStorage:{getItem:()=>JSON.stringify(stored)}});
  vm.runInContext(fn,sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox._syncFreeflightNavigationPayload())),core.build(state()));
  sandbox.window.__gaActiveMissionStorageFallback={...state(),mStory:'Vollstaendiges Briefing'};
  assert.equal(sandbox._syncFreeflightNavigationPayload().briefing.story,'Vollstaendiges Briefing');
  sandbox.window.__gaActiveMissionStorageFallback=null;stored={localStorageFallbackId:'missing'};
  assert.throws(()=>sandbox._syncFreeflightNavigationPayload(),/vollstaendigen lokalen Stand/);
  assert.equal((source.match(/freeflightNavigation: _syncFreeflightNavigationPayload\(\)/g)||[]).length,3);
  assert.equal((source.match(/freeflightNavigation: data.freeflightNavigation/g)||[]).length,4);
});

test('Cloud freeflight restore retains tracker authority and pending local changes', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8');
  const start=source.indexOf('async function _syncApplyActiveMissionFromCloud(');
  const fn=source.slice(start,source.indexOf('\nfunction setLastSyncedPayload',start));
  let pending=false,restored=0,stored=null;
  const sandbox=vm.createContext({window:{GAFreeflightNavigationCore:core,storeActiveMissionStateSafely:s=>{stored=s;}},
    document:{getElementById:()=>({})},localStorage:{getItem:()=>null},
    _syncActiveTrackerRunForCloudPull:()=>null,_syncReadPendingUpload:()=>pending,
    _syncConfirmReplaceRunningLocalMission:()=>true,restoreMissionState:async s=>{restored++;return true;},
    _syncRecordCloudMissionPullOutcome:()=>{}});
  vm.runInContext(fn,sandbox);
  const options={freeflightNavigation:core.build(state())};
  assert.equal(await sandbox._syncApplyActiveMissionFromCloud(null,options),true);assert.equal(restored,1);
  assert.equal(stored.currentMissionData.noMissionRuntime,true);
  pending=true;assert.equal(await sandbox._syncApplyActiveMissionFromCloud(null,options),false);assert.equal(restored,1);
  assert.ok(fn.indexOf('if (trackerRun)')<fn.indexOf('if (!activeMission && options.freeflightNavigation)'));
});
