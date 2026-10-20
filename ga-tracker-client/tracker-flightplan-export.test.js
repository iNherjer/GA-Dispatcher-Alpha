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

test('resume export starts at the interruption point and keeps only the remaining route', () => {
  const { createFlightPlanExport, remainingRoute } = require('./tracker-flightplan-export.js');
  const points = [
    { lat: 48.0, lon: 7.8, name: 'EDTF', icao: 'EDTF' },
    { lat: 48.1, lon: 8.0, name: 'WP1', icao: '' },
    { lat: 48.2, lon: 8.2, name: 'WP2', icao: '' },
    { lat: 48.28, lon: 8.43, name: 'EDTW', icao: 'EDTW' }
  ];
  // Interrupted between WP1 and WP2.
  const rest = remainingRoute(points, { lat: 48.15, lon: 8.1 });
  assert.deepEqual(rest.map(point => point.name), ['UNTERBRECHUNG', 'WP2', 'EDTW']);
  assert.deepEqual(remainingRoute(points, { lat: 48.0, lon: 7.81 }).map(point => point.name), ['UNTERBRECHUNG', 'WP1', 'WP2', 'EDTW']);
  const run = { missionId: 'm', runId: 'r', navigationRoute: { revision: 3, points }, resumeBundle: { missionState: { currentStartICAO: 'EDTF', currentDestICAO: 'EDTW' } } };
  const plan = createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.15, lon: 8.1 } });
  assert.equal(plan.departureIcao, '');
  assert.equal(plan.destinationIcao, 'EDTW');
  assert.deepEqual(plan.resumeFrom, { lat: 48.15, lon: 8.1 });
  assert.equal(plan.points.length, 3);
  assert.ok(plan.routeHash);
  assert.throws(() => createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 'x', lon: 8 } }), /flightplan_resume_point_invalid/);
  const normal = createFlightPlanExport(run, { missionId: 'm', runId: 'r' });
  assert.equal(normal.departureIcao, 'EDTF');
  assert.equal(normal.points.length, 4);
  assert.equal(normal.resumeFrom, undefined);
});


test('World Map air start puts a substitute first point on the departure field so MSFS spawns at the interruption point', () => {
  const { createFlightPlanExport } = require('./tracker-flightplan-export.js');
  const points = [
    { lat: 48.0, lon: 7.8, name: 'EDTF', icao: 'EDTF' }, { lat: 48.1, lon: 8.0, name: 'WP1', icao: '' },
    { lat: 48.2, lon: 8.2, name: 'WP2', icao: '' }, { lat: 48.28, lon: 8.43, name: 'EDTW', icao: 'EDTW' }
  ];
  const run = { missionId: 'm', runId: 'r', navigationRoute: { revision: 3, points }, resumeBundle: { missionState: { currentStartICAO: 'EDTF' } } };
  const plan = createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.15, lon: 8.1 }, airStart: true });
  assert.deepEqual(plan.points.map(point => point.name), ['ABFLUG', 'UNTERBRECHUNG', 'WP2', 'EDTW']);
  assert.deepEqual({ lat: plan.points[0].lat, lon: plan.points[0].lon, icao: plan.points[0].icao }, { lat: 48.0, lon: 7.8, icao: '' }, 'coordinates only, not the airport');
  assert.equal(plan.departureIcao, '', 'no airport departure, so the bridge sends it as a coordinate');
  assert.equal(plan.airStart, 'substitute-departure');
  // Avionics (no airStart) and normal exports stay unchanged.
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.15, lon: 8.1 } }).points[0].name, 'UNTERBRECHUNG');
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r', airStart: true }).points[0].name, 'EDTF');
});
