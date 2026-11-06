const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTraffic } = require('./map-live-presentation');
const { createTrafficWarningDetector, warningClips } = require('./traffic-warning-core');

const own = { lat: 48, lon: 7, alt: 3000, hdg: 0, gs: 100, vs: 0 };
const nmLon = 1 / (60 * Math.cos(48 * Math.PI / 180));

test('clock position follows the own heading', () => {
    // contact 0.7 NM ahead-left (north-west) with own heading north -> 11 o'clock
    const ac = { lat: 48 + 0.6 / 60, lon: 7 - 0.35 * nmLon, alt: 2400, hdg: 180, gs: 0 };
    const info = classifyTraffic(ac, own);
    assert.equal(info.clock, 11);
    assert.deepEqual(warningClips(info).clips, ['aw-achtung', 'aw-verkehr', 'aw-uhr-11', 'aw-unterhalb']);
    // same contact, own heading east -> 8 o'clock
    assert.equal(classifyTraffic(ac, { ...own, hdg: 90 }).clock, 8);
});

test('warning once on entering the alert level, not again while it stays', () => {
    const d = createTrafficWarningDetector({ classify: classifyTraffic });
    const ac = { id: 'o1', lat: 48 + 0.8 / 60, lon: 7, alt: 3100, hdg: 90, gs: 100 };
    const first = d.evaluate({ traffic: [ac], own, now: 0 });
    assert.equal(first.length, 1);
    assert.equal(first[0].level, 'warning');
    assert.equal(first[0].text, 'Achtung, Verkehr, 12 Uhr, gleiche Höhe');
    for (let t = 1000; t < 30000; t += 1000) assert.equal(d.evaluate({ traffic: [ac], own, now: t }).length, 0);
    assert.deepEqual(d.alerting(), ['o1']);
});

test('converging contact: warning first, then "ausweichen" within 20 s', () => {
    const d = createTrafficWarningDetector({ classify: classifyTraffic });
    // head-on from the north, closing at 200 kt, same altitude
    const at = (sec) => ({ id: 'o2', lat: 48 + (2.4 - sec * 200 / 3600) / 60, lon: 7, alt: 3000, hdg: 180, gs: 100 });
    const ownMoving = (sec) => ({ ...own });
    const levels = [];
    for (let sec = 0; sec <= 40; sec++) {
        for (const e of d.evaluate({ traffic: [at(sec)], own: ownMoving(sec), now: sec * 1000 })) levels.push([sec, e.level]);
    }
    assert.equal(levels[0][1], 'warning');
    const resolve = levels.find(([, l]) => l === 'resolve');
    assert.ok(resolve, 'resolve announced');
    assert.ok(resolve[0] >= 20, 'resolve comes when the collision is at most 20 s away');
    assert.deepEqual(levels.filter(([, l]) => l === 'resolve').length, 1);
});

test('ground traffic and own aircraft on ground never warn', () => {
    const d = createTrafficWarningDetector({ classify: classifyTraffic });
    const near = { id: 'g1', lat: 48.002, lon: 7, alt: 3000, hdg: 0, gs: 0 };
    assert.equal(d.evaluate({ traffic: [{ ...near, gnd: 1 }], own, now: 0 }).length, 0);
    assert.equal(d.evaluate({ traffic: [near], own: { ...own, onGround: true }, now: 1000 }).length, 0);
});

test('rearm only after the contact left the alert level for a while and a minute passed', () => {
    const d = createTrafficWarningDetector({ classify: classifyTraffic });
    const near = { id: 'o3', lat: 48 + 0.5 / 60, lon: 7, alt: 3000, hdg: 90, gs: 100 };
    const far = { ...near, lat: 48 + 5 / 60 };
    assert.equal(d.evaluate({ traffic: [near], own, now: 0 }).length, 1);
    d.evaluate({ traffic: [far], own, now: 2000 });
    assert.equal(d.evaluate({ traffic: [near], own, now: 4000 }).length, 0, 'short flicker does not repeat');
    for (let t = 5000; t <= 20000; t += 1000) d.evaluate({ traffic: [far], own, now: t });
    assert.equal(d.evaluate({ traffic: [near], own, now: 30000 }).length, 0, 'still within one minute');
    for (let t = 31000; t <= 45000; t += 1000) d.evaluate({ traffic: [far], own, now: t });
    assert.equal(d.evaluate({ traffic: [near], own, now: 70000 }).length, 1);
});

test('two contacts at once are announced one after the other', () => {
    const d = createTrafficWarningDetector({ classify: classifyTraffic });
    const a = { id: 'a', lat: 48 + 0.5 / 60, lon: 7, alt: 3000, hdg: 90, gs: 100 };
    const b = { id: 'b', lat: 48, lon: 7 + 0.8 * nmLon, alt: 3400, hdg: 0, gs: 100 };
    assert.equal(d.evaluate({ traffic: [a, b], own, now: 0 })[0].contactId, 'a');
    assert.equal(d.evaluate({ traffic: [a, b], own, now: 2000 }).length, 0, 'gap between announcements');
    assert.equal(d.evaluate({ traffic: [a, b], own, now: 4000 })[0].contactId, 'b');
});
