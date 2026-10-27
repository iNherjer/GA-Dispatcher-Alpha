const test = require('node:test');
const assert = require('node:assert/strict');
const codec = require('./flight-track-codec-core');

// Deterministic noise so results are stable.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) - 0.5; }

// ~1 h VFR flight at 1 Hz: taxi, climb, cruise with turns, descent, pattern, landing.
function syntheticFlight({ seed = 7, t0 = Date.UTC(2026, 9, 26, 9, 0, 0) } = {}) {
    const noise = rng(seed);
    const samples = [];
    let lat = 50.0, lon = 8.6, alt = 400, hdg = 270, t = t0;
    const gnd = (la, lo) => 400 + 600 * Math.sin(la * 40) * Math.cos(lo * 30);
    const step = (sec, { gs, vs = 0, turn = 0, onGround = false }) => {
        for (let i = 0; i < sec; i += 1) {
            hdg = (hdg + turn + (onGround ? 0 : noise() * 1.2) + 360) % 360;
            const m = gs * 0.514444;
            lat += (m * Math.cos(hdg * Math.PI / 180)) / 111195;
            lon += (m * Math.sin(hdg * Math.PI / 180)) / (111195 * Math.cos(lat * Math.PI / 180));
            const g = gnd(lat, lon);
            alt = onGround ? g + 5 : Math.max(alt + vs / 60 + noise() * 4, g + 20);
            t += 1000;
            samples.push({
                observedAt: t,
                lat: lat + noise() * 2e-5, lon: lon + noise() * 3e-5,
                altFt: alt + (onGround ? 0 : noise() * 30),
                aglFt: alt - g, gsKts: gs, onGround, simPaused: false, inMenuOrMap: false
            });
        }
    };
    step(120, { gs: 12, onGround: true, turn: 0.5 });
    step(30, { gs: 50, onGround: true });
    step(480, { gs: 75, vs: 600 });
    for (let leg = 0; leg < 5; leg += 1) { step(300, { gs: 110 }); step(30, { gs: 110, turn: leg % 2 ? -3 : 3 }); step(300, { gs: 110, vs: leg % 2 ? 100 : -100 }); }
    step(600, { gs: 95, vs: -350 });
    for (let side = 0; side < 4; side += 1) { step(60, { gs: 80 }); step(30, { gs: 80, turn: -3 }); }
    step(90, { gs: 65, vs: -500 });
    step(40, { gs: 30, onGround: true });
    step(60, { gs: 8, onGround: true });
    return samples;
}

function trackErrorAgainst(samples, decoded) {
    let maxLat = 0, maxVert = 0;
    const pts = codec.pointsFromSamples(samples);
    let k = 0;
    for (const p of pts) {
        const sec = Math.round((p.t - pts[0].t) / 1000);
        while (k < decoded.length - 2 && decoded[k + 1].sec <= sec) k += 1;
        const a = decoded[k], b = decoded[k + 1];
        if (!b || b.segmentStart) continue;
        const d = codec.deviation(
            { lat: a.lat, lon: a.lon, altFt: a.altFt, t: a.sec },
            { lat: b.lat, lon: b.lon, altFt: b.altFt, t: b.sec },
            { lat: p.lat, lon: p.lon, altFt: p.altFt, t: sec }
        );
        maxLat = Math.max(maxLat, d.lateralM);
        maxVert = Math.max(maxVert, d.verticalFt);
    }
    return { maxLat, maxVert };
}

test('1 h flight shrinks to a few KB and keeps tolerance', () => {
    const samples = syntheticFlight();
    const rawBytes = samples.map(s => JSON.stringify({ type: 'telemetry', sample: s })).join('\n').length;
    const track = codec.encodeTrack(samples);
    const bytes = JSON.stringify(track).length;
    assert.ok(samples.length > 4500);
    assert.ok(track.n < 600, `points ${track.n}`);
    assert.ok(bytes < 5000, `bytes ${bytes}`);
    assert.ok(rawBytes / bytes > 100, `ratio ${rawBytes / bytes}`);
    assert.deepEqual(track.tol, [15, 30]);
    const decoded = codec.decodeTrack(track);
    const err = trackErrorAgainst(samples, decoded);
    assert.ok(err.maxLat <= 15 + 3, `lateral ${err.maxLat}`);
    assert.ok(err.maxVert <= 30 + 10, `vertical ${err.maxVert}`);
});

test('takeoff, touchdown, max altitude and endpoints are kept', () => {
    const samples = syntheticFlight();
    const track = codec.encodeTrack(samples);
    const d = codec.decodeTrack(track);
    assert.equal(d[0].onGround, true);
    assert.equal(d[d.length - 1].onGround, true);
    assert.equal(d[track.marks.takeoff].onGround, true);
    assert.equal(d[track.marks.takeoff + 1].onGround, false);
    assert.equal(track.marks.touchdowns.length, 1);
    assert.equal(d[track.marks.touchdowns[0]].onGround, true);
    const maxRaw = Math.max(...samples.map(s => s.altFt));
    assert.ok(Math.abs(d[track.marks.maxAlt].altFt - maxRaw) <= 5);
    assert.equal(d[0].time, samples[0].observedAt);
    assert.equal(d[d.length - 1].time, samples[samples.length - 1].observedAt);
});

test('terrain comes from altitude minus AGL and survives the roundtrip', () => {
    const samples = syntheticFlight();
    const d = codec.decodeTrack(codec.encodeTrack(samples));
    const bySec = new Map(samples.map(s => [Math.round((s.observedAt - samples[0].observedAt) / 1000), s]));
    for (const p of d) {
        const s = bySec.get(p.sec);
        assert.ok(Math.abs(p.gndFt - (s.altFt - s.aglFt)) <= 5);
    }
});

test('paused and menu samples are ignored, invalid points dropped', () => {
    const samples = syntheticFlight().slice(0, 900);
    const noisy = samples.flatMap((s, i) => i % 50 ? [s] : [s,
        { ...s, observedAt: s.observedAt + 1, lat: 10, lon: 10, simPaused: true },
        { ...s, observedAt: s.observedAt + 2, lat: 0, lon: 0 },
        { ...s, observedAt: s.observedAt + 3, lat: 20, lon: 20, inMenuOrMap: true },
        { ...s, observedAt: s.observedAt + 4, lat: null }]);
    assert.equal(codec.encodeTrack(noisy).enc, codec.encodeTrack(samples).enc);
});

test('flight-log lines with wrapped samples are accepted', () => {
    const samples = syntheticFlight().slice(0, 600);
    const lines = samples.map(sample => ({ type: 'telemetry', phase: 'enroute', sample }));
    assert.equal(codec.encodeTrack(lines).enc, codec.encodeTrack(samples).enc);
});

test('pause gap and reposition jump start a new segment', () => {
    const samples = syntheticFlight().slice(0, 1500);
    const later = samples.slice(1000).map(s => ({ ...s, observedAt: s.observedAt + 300000 }));
    const jumped = samples.slice(0, 1000).concat(later.slice(0, 200),
        later.slice(200).map(s => ({ ...s, observedAt: s.observedAt + 1000, lat: s.lat + 0.5 })));
    const d = codec.decodeTrack(codec.encodeTrack(jumped));
    assert.equal(d.filter(p => p.segmentStart).length, 3);
    const nm = codec.alongTrackNm(d);
    assert.ok(nm[nm.length - 1] < 40, `along-track ${nm[nm.length - 1]}`);
});

test('long flights respect maxPoints by widening tolerance', () => {
    const samples = syntheticFlight();
    const track = codec.encodeTrack(samples, { maxPoints: 40 });
    assert.ok(track.n <= 40);
    assert.ok(track.tol[0] > 15);
});

test('missing terrain is flagged, not invented', () => {
    const samples = syntheticFlight().slice(0, 600).map(s => ({ ...s, aglFt: null }));
    const d = codec.decodeTrack(codec.encodeTrack(samples));
    assert.ok(d.every(p => p.gndFt === null));
});

test('no usable flight returns null; broken data throws on decode', () => {
    assert.equal(codec.encodeTrack([]), null);
    assert.equal(codec.encodeTrack([{ observedAt: 1, lat: 50, lon: 8, altFt: 400 }]), null);
    assert.throws(() => codec.decodeTrack({ v: 99, enc: '' }), /track_unsupported/);
    const track = codec.encodeTrack(syntheticFlight().slice(0, 300));
    assert.throws(() => codec.decodeTrack({ ...track, enc: track.enc.slice(0, -3) }), /track_/);
});
