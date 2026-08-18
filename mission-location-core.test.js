'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const locationCore = require('./mission-location-core.js');

test('APT destination resolver preserves the existing app thresholds', () => {
  const arrival = locationCore.resolveAptDestination({
    arrivalPoint: { lat: 48, lon: 8.01 },
    missionTarget: { lat: 48, lon: 8 }
  }, { lat: 48, lon: 8.01 });
  assert.equal(arrival.atDestination, true);
  assert.equal(arrival.reason, 'apt_arrival_point');

  const fallback = locationCore.resolveAptDestination({
    arrivalPoint: { lat: 48, lon: 8.01 },
    missionTarget: { lat: 48, lon: 8 }
  }, { lat: 48, lon: 8 });
  assert.equal(fallback.atDestination, true);
  assert.equal(fallback.reason, 'apt_airport_fallback');
  assert.equal(fallback.dArrivalNm > locationCore.APT_ARRIVAL_RADIUS_NM, true);

  const routeOnly = locationCore.resolveAptDestination({
    missionTarget: { lat: 48, lon: 8 }
  }, { lat: 48.01, lon: 8 });
  assert.equal(routeOnly.atDestination, true);
  assert.equal(routeOnly.reason, 'mission_target');

  const away = locationCore.resolveAptDestination({
    arrivalPoint: { lat: 48, lon: 8.01 },
    missionTarget: { lat: 48, lon: 8 }
  }, { lat: 48.1, lon: 8.1 });
  assert.equal(away.atDestination, false);
  assert.equal(away.reason, 'not_at_target');
});

test('APT destination resolver fails closed for absent or invalid coordinates', () => {
  const noPosition = locationCore.resolveAptDestination({
    missionTarget: { lat: 48, lon: 8 }
  }, { lat: null, lon: 8 });
  assert.equal(noPosition.available, false);
  assert.equal(noPosition.atDestination, false);
  assert.equal(noPosition.reason, 'no_position');

  const noTarget = locationCore.resolveAptDestination({}, { lat: 48, lon: 8 });
  assert.equal(noTarget.available, false);
  assert.equal(noTarget.atDestination, false);
  assert.equal(noTarget.reason, 'no_target');

  assert.equal(locationCore.normalizePoint({ lat: 95, lon: 8 }), null);
  assert.equal(locationCore.haversineNm(48, 8, 48, 8), 0);
});

test('versioned APT policies can vary radii only inside bounded limits', () => {
  const position = { lat: 48.003, lon: 8 };
  const baseLocation = { arrivalPoint: { lat: 48, lon: 8 } };
  const defaults = locationCore.resolveAptDestination(baseLocation, position);
  assert.equal(defaults.atDestination, false);
  assert.equal(defaults.policy.source, 'default');

  const custom = locationCore.resolveAptDestination({
    ...baseLocation,
    policy: {
      schema: locationCore.APT_POLICY_SCHEMA,
      arrivalRadiusNm: 0.25,
      airportFallbackRadiusNm: 0.5,
      missionTargetRadiusNm: 1.5
    }
  }, position);
  assert.equal(custom.atDestination, true);
  assert.equal(custom.policy.source, 'mission');
  assert.equal(custom.policy.arrivalRadiusNm, 0.25);

  const outOfBounds = locationCore.resolveAptDestination({
    ...baseLocation,
    policy: {
      schema: locationCore.APT_POLICY_SCHEMA,
      arrivalRadiusNm: 5,
      airportFallbackRadiusNm: 5,
      missionTargetRadiusNm: 5
    }
  }, position);
  assert.equal(outOfBounds.atDestination, false);
  assert.equal(outOfBounds.policy.source, 'default');

  const unversioned = locationCore.normalizeAptPolicy({
    arrivalRadiusNm: 0.25,
    airportFallbackRadiusNm: 0.5,
    missionTargetRadiusNm: 1.5
  });
  assert.equal(unversioned.source, 'default');
});

test('browser and tracker load the same location core implementation', () => {
  const source = fs.readFileSync(require.resolve('./mission-location-core.js'), 'utf8');
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'mission-location-core.js' });
  const inputLocation = {
    arrivalPoint: { lat: 48.3001, lon: 8.5001 },
    missionTarget: { lat: 48.3, lon: 8.5 }
  };
  const inputPosition = { lat: 48.3002, lon: 8.5002 };
  const browserResult = context.globalThis.GAMissionLocationCore.resolveAptDestination(inputLocation, inputPosition);
  const trackerResult = locationCore.resolveAptDestination(inputLocation, inputPosition);
  assert.equal(JSON.stringify(browserResult), JSON.stringify(trackerResult));

  const runtimeSource = fs.readFileSync(require.resolve('./mission-runtime-core.js'), 'utf8');
  assert.match(runtimeSource, /GAMissionLocationCore\?\.resolveAptDestination/);
  const indexSource = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  assert.match(indexSource, /mission-location-core\.js[^]*mission-runtime-core\.js/);
});
