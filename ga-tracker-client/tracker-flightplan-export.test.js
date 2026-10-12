'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFlightPlanExport } = require('./tracker-flightplan-export');
const { createCockpitTools } = require('./tracker-cockpit-tools');
const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');
function run(points = [{lat:48,lon:8,name:'Start'}, {lat:49,lon:9,name:'Ziel'}]) {
  return {missionId:'m',runId:'r',resumeBundle:{missionState:{currentStartICAO:'EDTW',currentDestICAO:'EDTO',
    routeWaypoints:points,currentMissionData:{cruiseAltitudeFt:4500,workAltitudeFt:1200}}}};
}
const request = {missionId:'m',runId:'r',navigationRevision:0};
test('exports complete confirmed navigation, stable hash and cruise altitude without terrain/work altitude', () => {
  const source = run(Array.from({length:140}, (_,i) => ({lat:48+i/1000,lon:8+i/1000,elevationFt:500})));
  const original = JSON.stringify(source), result = createFlightPlanExport(source, request);
  assert.equal(result.points.length,140); assert.equal(result.cruiseAltitudeFt,4500);
  assert.equal(result.points[0].elevationFt,undefined); assert.equal(JSON.stringify(source),original);
  assert.equal(result.routeHash,createFlightPlanExport(source,request).routeHash);
  source.navigationRoute = {revision:2,points:[{lat:48,lon:8},{lat:48.5,lon:8.5},{lat:49,lon:9}]};
  const edited = createFlightPlanExport(source,{...request,navigationRevision:2});
  assert.equal(edited.points.length,3);assert.notEqual(edited.routeHash,result.routeHash);
  assert.throws(() => createFlightPlanExport(source,request),/route_changed/);
});
test('invalid and oversized routes reject export without silently dropping or truncating points', () => {
  assert.throws(() => createFlightPlanExport(run([{lat:48,lon:8},{lat:null,lon:9}]),request),/point_invalid/);
  assert.throws(() => createFlightPlanExport(run(Array(513).fill({lat:48,lon:8})),request),/route_invalid/);
  assert.throws(() => createFlightPlanExport(run(),{...request,runId:'old'}),/run_changed/);
});
test('authenticated EFB/toolbar export is read-only, bound to run and disallowed from web', async () => {
  const source=run(), before=JSON.stringify(source);
  const tools=createCockpitTools({getRun:()=>source});
  const controller=createTrackerCockpitControl({executeTool:req=>tools.execute(req)});
  for (const role of ['efb','toolbar','web']) {
    const auth=controller.register({clientId:role,role});
    const result=await controller.submitTool({sessionId:auth.session.sessionId,sessionToken:auth.sessionToken,
      commandId:'export',intent:'flightplan_export',payload:request});
    assert.equal(result.ok,role!=='web');
  }
  assert.equal(JSON.stringify(source),before);
  assert.equal((await controller.submitTool({intent:'flightplan_export',payload:request})).error,'cockpit_session_required');
});
