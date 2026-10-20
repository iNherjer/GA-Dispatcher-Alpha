const { test } = require('node:test');
const assert = require('node:assert/strict');
const zoneMap = require('../mission-resume-zone-map.js');

function fakeLeaflet() {
  const calls = [];
  const layer = () => ({ items: [], addTo(target) { (target.items || target.added).push(this); return this; }, bindTooltip(text) { this.tooltip = text; return this; } });
  const L = {
    layerGroup: () => ({ ...layer(), kind: 'group' }),
    circle: (center, options) => { calls.push(['circle', center, options]); return { ...layer(), kind: 'circle', options }; },
    circleMarker: (center, options) => { calls.push(['marker', center, options]); return { ...layer(), kind: 'marker' }; }
  };
  const map = { added: [], removed: [], removeLayer(target) { this.removed.push(target); } };
  return { L, map, calls };
}

const control = (status, zone, extra = {}) => ({ executionAuthority: 'tracker', phase: 'enroute', interruption: { status, zone }, ...extra });
const airZone = { lat: 48.1, lon: 8.1, radiusNm: 5, airborne: true };

test('zone appears with the interruption and disappears when the tracker clears it', () => {
  const { L, map, calls } = fakeLeaflet();
  assert.equal(zoneMap.render(map, L, zoneMap.fromControl(control('awaiting_decision', airZone))), true);
  assert.equal(map.added.length, 1);
  assert.equal(calls[0][0], 'circle');
  assert.equal(calls[0][2].radius, 5 * 1852);
  assert.equal(calls[0][2].dashArray, '10,8');
  assert.match(map.added[0].items[0].tooltip, /Wiederaufnahme-Zone · 5,0 NM/);
  // Repeated projections do not redraw.
  zoneMap.render(map, L, zoneMap.fromControl(control('resuming', airZone)));
  zoneMap.render(map, L, zoneMap.fromControl(control('awaiting_zone', airZone)));
  assert.equal(map.added.length, 1);
  assert.equal(map.removed.length, 0);
  // Resumed: the projection no longer carries an interruption.
  assert.equal(zoneMap.render(map, L, zoneMap.fromControl({ executionAuthority: 'tracker', phase: 'enroute', interruption: null })), false);
  assert.equal(map.removed.length, 1);
  assert.equal(zoneMap.active(map), false);
});

test('ground zones explain parking; invalid or foreign projections draw nothing', () => {
  const { L, map } = fakeLeaflet();
  zoneMap.render(map, L, zoneMap.fromControl(control('awaiting_zone', { lat: 48.1, lon: 8.1, radiusNm: 1, airborne: false })));
  assert.match(map.added[0].items[0].tooltip, /Flugzeug hier abstellen/);
  assert.equal(zoneMap.fromControl(control('awaiting_zone', { lat: 120, lon: 8, radiusNm: 5 })), null);
  assert.equal(zoneMap.fromControl(control('bogus', airZone)), null);
  assert.equal(zoneMap.fromControl(control('awaiting_zone', airZone, { executionAuthority: 'web' })), null);
  assert.equal(zoneMap.fromControl(control('awaiting_zone', airZone, { phase: 'closed' })), null);
  assert.equal(zoneMap.fromControl(null), null);
  assert.equal(zoneMap.render(null, L, airZone), false);
});
