'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./tracker.js'), 'utf8');
const gate = source.slice(source.indexOf('const TRACKER_APT_EXECUTION_REQUESTED'), source.indexOf('const TRACKER_PROTOCOL_HELLO'));

for (const channel of ['alpha', 'stable']) for (const enabled of ['0', '1']) for (const oldPoiFlag of [undefined, '0', '1']) {
  test(`universal authority: ${channel}, switch=${enabled}, obsolete POI flag=${oldPoiFlag}`, () => {
    const context = vm.createContext({ TRACKER_RUNTIME_CHANNEL: channel, TRACKER_DESKTOP_CONTROL_TOKEN: '',
      missionExecutionCore: { TRACKER_AUTHORITY_READY: true },
      process: { env: { VFR_MULTITOOL_APT_EXECUTION: enabled, VFR_MULTITOOL_POI_EXECUTION: oldPoiFlag } } });
    const result = vm.runInContext(gate + '\n({apt:TRACKER_APT_EXECUTION_ENABLED,poi:TRACKER_POI_EXECUTION_ENABLED,capabilities:TRACKER_EXECUTION_CAPABILITIES})', context);
    const expected = channel === 'alpha' && enabled === '1';
    assert.equal(result.apt, expected); assert.equal(result.poi, expected);
    assert.equal(result.capabilities.includes('mission.poi.v1'), expected);
    assert.equal(result.capabilities.includes('mission.intent.v1'), expected);
  });
}

test('parity readiness remains a prerequisite for all tracker recipes', () => {
  const context = vm.createContext({ TRACKER_RUNTIME_CHANNEL: 'alpha', TRACKER_DESKTOP_CONTROL_TOKEN: '',
    missionExecutionCore: { TRACKER_AUTHORITY_READY: false, TRACKER_AUTHORITY_PENDING: ['pending'] },
    process: { env: { VFR_MULTITOOL_APT_EXECUTION: '1' } } });
  assert.equal(vm.runInContext(gate + '\nTRACKER_POI_EXECUTION_ENABLED', context), false);
});
