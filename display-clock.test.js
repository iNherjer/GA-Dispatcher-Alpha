const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, resolve, format, MAX_AGE_MS } = require('./display-clock');
const now = Date.UTC(2026, 9, 13, 12, 34, 56);
const sample = (utc = 86340, local = 3540, extra = {}) => ({ receivedAt: now, flight: {
  simAbsoluteTimeSeconds: 63900000000 - 63900000000 % 86400 + utc,
  simLocalTimeSeconds: local, ...extra
}});
test('new and invalid settings default to simulator UTC', () => {
  assert.deepEqual(normalize(), {source:'simulator',zone:'utc'});
  assert.deepEqual(normalize(null), normalize());
  assert.deepEqual(normalize({source:'wrong',zone:'wrong'}), normalize());
});
test('simulator UTC and local ignore the device timezone; ETA wraps midnight', () => {
  assert.equal(format(resolve({}, sample(), now)), '23:59');
  assert.equal(format(resolve({}, sample(), now), 2), '00:01');
  assert.equal(format(resolve({zone:'local'}, sample(), now), 2), '01:01');
  assert.equal(format(resolve({zone:'local'}, sample(0,0), now), 0,true), '00:00:00');
});
test('device UTC and local follow the explicit selection', () => {
  assert.equal(format(resolve({source:'device'}, sample(),now)), '12:34');
  const date = new Date(now);
  assert.equal(format(resolve({source:'device',zone:'local'}, sample(),now)),
    `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`);
});
test('missing, invalid, menu and expired simulator samples always fall back to device UTC', () => {
  const bad = [null, {receivedAt:now}, sample(0,0,{simAbsoluteTimeSeconds:null}),
    sample(0,0,{simAbsoluteTimeSeconds:'63900000000'}), sample(0,0,{simAbsoluteTimeSeconds:NaN}),
    sample(0,0,{simAbsoluteTimeSeconds:0}), sample(0,0,{simLocalTimeSeconds:null}),
    sample(0,0,{simLocalTimeSeconds:86400}), sample(0,0,{simRunning:0}),
    sample(0,0,{inMenuOrMap:true}), {...sample(),receivedAt:now-MAX_AGE_MS-1},
    {...sample(),receivedAt:now+1}];
  for(const value of bad) {
    const result=resolve({zone:'local'},value,now);
    assert.equal(result.fallback,true);assert.equal(result.zone,'utc');assert.equal(result.source,'device');
    assert.equal(format(result,0,true),'12:34:56');
  }
  assert.equal(resolve({},sample(0,0,{simLocalTimeSeconds:null}),now).source,'simulator');
});
test('pause and simulation rate never extrapolate measured simulator clocks', () => {
  const paused=sample(3600,7200,{simPaused:true,simulationRate:4});
  assert.equal(format(resolve({},paused,now+2000),0,true),'01:00:00');
  assert.equal(format(resolve({},sample(5400,9000),now),0,true),'01:30:00');
  assert.equal(format(resolve({},sample(1800,5400),now),0,true),'00:30:00');
  assert.equal(resolve({},paused,now+MAX_AGE_MS+1).fallback,true);
  assert.equal(resolve({},sample(0,0),now).fallback,false);
});
test('invalid remaining duration has no ETA, finite duration keeps full minutes', () => {
  const clock=resolve({},sample(),now);
  for(const value of [null,NaN,Infinity]) assert.equal(format(clock,value),'--:--');
  assert.equal(format(clock,60),'00:59');
});
