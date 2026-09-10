const test = require('node:test');
const assert = require('node:assert/strict');
const nav = require('./map-navigation-geometry');
const prediction = require('./map-prediction');
const warnings = require('./navigation-warning-core');
const route = [{id:'A',lat:48,lon:8},{id:'B',lat:48.1,lon:8},{id:'C',lat:48.1,lon:8.2}];

test('Standalone trigger advances 0.5 NM before a waypoint and keeps the new leg', () => {
    const state = {}, legs = nav.buildLegs(route);
    const tick = (lat,lon,at) => nav.buildNavigation({lat,lon,capturedAt:at},route,legs,state);
    assert.equal(tick(48.08,8,10000).nextWaypointId,'B');
    assert.equal(tick(48.094,8,11100).nextWaypointId,'C');
    // Still closer to the inbound leg: nearest-segment selection would regress.
    assert.equal(tick(48.093,8,12200).nextWaypointId,'C');
});

test('CDI uses Standalone sign and selected leg, including a manual preview', () => {
    const r=[{id:'A',lat:48,lon:8},{id:'B',lat:48.2,lon:8},{id:'C',lat:48.2,lon:8.2}];
    const pos={lat:48.05,lon:8.01};
    const automatic=nav.selectWaypoint(pos,r);
    assert.ok(automatic.xteNm>0.4 && automatic.xteNm<0.44,'east/right of northbound track');
    const manual=nav.selectWaypoint(pos,r,{...automatic,selectedIndex:2});
    assert.equal(manual.wpIdx,2);
    assert.ok(manual.xteNm>8,'south/right of eastbound track');
    assert.equal(manual.brng,nav.calcNav(pos.lat,pos.lon,r[2].lat,r[2].lon).brng);
});

test('fast source samples do not cascade through nearby waypoints', () => {
    const r=[{id:'A',lat:48,lon:8},{id:'B',lat:48.1,lon:8},{id:'C',lat:48.101,lon:8},{id:'D',lat:48.2,lon:8}];
    const state={},legs=nav.buildLegs(r);
    const tick=at=>nav.buildNavigation({lat:48.094,lon:8,capturedAt:at},r,legs,state);
    assert.equal(tick(10000).nextWaypointId,'C');
    for(let at=10050;at<=11000;at+=50)assert.equal(tick(at).nextWaypointId,'C');
    assert.equal(tick(11050).nextWaypointId,'D');
});

test('route changes reset selection, missing flight does not invent navigation', () => {
    const state={};nav.buildNavigation({lat:48.05,lon:8},route,nav.buildLegs(route),state);
    const r=[{id:'X',lat:49,lon:8},{id:'Y',lat:49.2,lon:8}];
    assert.equal(nav.buildNavigation({lat:49.05,lon:8},r,nav.buildLegs(r),state).nextWaypointId,'Y');
    assert.equal(nav.buildNavigation({},r,nav.buildLegs(r),state),null);
});

test('map and profile share original prediction horizons, distance and altitude', () => {
    const gps={lat:48,lon:8,alt:4000,hdg:90};
    const points=prediction.points(gps,120,-500);
    assert.deepEqual(points.map(p=>p.min),[1,2,5,10]);
    assert.deepEqual(points.map(p=>p.distNMAhead),[2,4,10,20]);
    assert.deepEqual(points.map(p=>p.altFt),[3500,3000,1500,0]);
    const ref=warnings.predictions(gps,120,-500).filter(p=>[1,2,5,10].includes(p.min));
    assert.deepEqual(points.map(({lat,lon,alt,min})=>({lat,lon,alt,min})),ref);
    prediction.applyTerrain(points,[{threat:'red',terrainFt:3200},{threat:'amber',terrainFt:2300},{threat:'green',terrainFt:0},{threat:'unknown',terrainFt:null}],()=> '#f2c12e');
    assert.deepEqual(points.map(p=>p.asColor),[null,null,'#f2c12e',null]);
});
