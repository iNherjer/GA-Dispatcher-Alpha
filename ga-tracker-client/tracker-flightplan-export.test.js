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

test('World Map air start sends only the save point and the destination; everything else the complete plan', () => {
  const { createFlightPlanExport } = require('./tracker-flightplan-export.js');
  const points = [
    { lat: 48.0, lon: 7.8, name: 'EDTF', icao: 'EDTF' }, { lat: 48.1, lon: 8.0, name: 'WP1', icao: '' },
    { lat: 48.2, lon: 8.2, name: 'WP2', icao: '' }, { lat: 48.25, lon: 8.3, name: 'WP3', icao: '' },
    { lat: 48.28, lon: 8.43, name: 'EDTW', icao: 'EDTW' }
  ];
  const run = { missionId: 'm', runId: 'r', navigationRoute: { revision: 3, points }, resumeBundle: { missionState: { currentStartICAO: 'EDTF', currentDestICAO: 'EDTW' } } };
  // MSFS spawns at the last waypoint before the destination (field test).
  const plan = createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.05, lon: 7.9 }, airStart: true });
  assert.deepEqual(plan.points.map(point => point.name), ['SPEICHERPUNKT', 'EDTW']);
  assert.deepEqual({ lat: plan.points[0].lat, lon: plan.points[0].lon }, { lat: 48.05, lon: 7.9 });
  assert.equal(plan.departureIcao, '');
  assert.equal(plan.destinationIcao, 'EDTW');
  assert.equal(plan.airStart, 'spawn-only');
  assert.deepEqual(plan.resumeFrom, { lat: 48.05, lon: 7.9 });
  assert.throws(() => createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 'x', lon: 8 }, airStart: true }), /flightplan_resume_point_invalid/);
  // Avionics gets the complete mission plan, also after an interruption.
  const complete = createFlightPlanExport(run, { missionId: 'm', runId: 'r' });
  assert.equal(complete.departureIcao, 'EDTF');
  assert.deepEqual(complete.points.map(point => point.name), ['EDTF', 'WP1', 'WP2', 'WP3', 'EDTW']);
  assert.equal(complete.resumeFrom, undefined);
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.05, lon: 7.9 } }).points.length, 5, 'a save point alone does not cut the plan');
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r', airStart: true }).points.length, 5);
});

test('POI round trip: air start returns to the home field, the complete plan keeps the POI', () => {
  const { createFlightPlanExport } = require('./tracker-flightplan-export.js');
  const points = [{ lat: 48.0, lng: 7.8 }, { lat: 48.3, lng: 8.2, name: 'POI Burg', isPOI: true },
    { lat: 48.12, lng: 8.05, name: 'Return Leg' }, { lat: 48.0, lng: 7.8, name: 'Freiburg' }];
  const run = { missionId: 'm', runId: 'r', navigationRoute: { revision: 1, points }, resumeBundle: { missionState: { currentStartICAO: 'EDTF', currentDestICAO: 'EDTF' } } };
  // Interrupted on the way out, close to home: no out-and-back confusion.
  const air = createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.06, lon: 7.92 }, airStart: true });
  assert.deepEqual(air.points.map(point => point.name), ['SPEICHERPUNKT', 'Freiburg']);
  assert.equal(air.destinationIcao, 'EDTF');
  const complete = createFlightPlanExport(run, { missionId: 'm', runId: 'r' });
  assert.equal(complete.departureIcao, 'EDTF');
  assert.deepEqual(complete.points.map(point => point.name), ['WP1', 'POI Burg', 'Return Leg', 'Freiburg']);
});

test('the air start plan carries the save point altitude (rounded up) as cruise; the avionics plan keeps the mission cruise', () => {
  const { createFlightPlanExport } = require('./tracker-flightplan-export.js');
  const points = [{ lat: 48.0, lon: 7.8, name: 'EDTF', icao: 'EDTF' }, { lat: 48.1, lon: 8.0, name: 'WP1' }, { lat: 48.28, lon: 8.43, name: 'EDTW', icao: 'EDTW' }];
  const run = { missionId: 'm', runId: 'r', navigationRoute: { revision: 1, points },
    resumeBundle: { missionState: { currentStartICAO: 'EDTF', currentDestICAO: 'EDTW', currentMissionData: { cruiseAltitudeFt: 8800 } } } };
  const air = createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.05, lon: 7.9, altFt: 4510 }, airStart: true });
  assert.equal(air.cruiseAltitudeFt, 4600);
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r', startAt: { lat: 48.05, lon: 7.9 }, airStart: true }).cruiseAltitudeFt, 8800,
    'without a known altitude the mission cruise stays');
  assert.equal(createFlightPlanExport(run, { missionId: 'm', runId: 'r' }).cruiseAltitudeFt, 8800);
});
