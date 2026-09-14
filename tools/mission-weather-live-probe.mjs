// Opt-in public network probe. No API keys or mission generation; local Worker code + live AWC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from './cloudflare-worker/worker-merged-full.js';
import '../mission-private-outing-core.js';
import '../mission-private-episode-v6.js';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const airport = fs.readFileSync(new URL('../airport-weather.js', import.meta.url), 'utf8');
const nativeFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, options) => {
  assert.equal(new URL(url).hostname, 'aviationweather.gov');
  const entry = { url, status: 'pending' };
  requests.push(entry);
  try {
    const response = await nativeFetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    entry.status = response.status;
    return response;
  } catch (error) {
    entry.status = 'error';
    entry.error = error.name;
    throw error;
  }
};
const c = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, window: {},
  fetch: (url, options) => new Promise((resolve, reject) => {
    const signal = options?.signal;
    const abort = () => reject(signal.reason);
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    worker.fetch(new Request(url, options), {}, {}).then(resolve, reject)
      .finally(() => signal?.removeEventListener('abort', abort));
  }) });
vm.runInContext(app.slice(app.indexOf('const _missionWxCache ='), app.indexOf('const _dwdWbiStationCache =')), c);
for (const [source, names] of [[airport, ['_parseMetarPayloadToArray', '_fetchWithTimeout', '_fetchMetarArrayViaVariants']],
  [app, ['calcNav', '_looksLikeIcao', 'fetchMissionWeatherSnapshot', '_summarizeMissionWeather', '_missionPipelineV3WeatherBundle']]]) {
  for (const name of names) {
    const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
    assert.ok(start >= 0);
    vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), c);
  }
}
try {
  // Also exercise an old client URL through the real local Worker handler.
  const legacy = await worker.fetch(new Request('https://ga-proxy.test/api/metar?src=' + encodeURIComponent(
    'https://aviationweather.gov/api/data/metar?ids=EDDS&format=json&t=1789388301402')), {}, {});
  assert.equal(legacy.status, 200);
  const dep = await c.fetchMissionWeatherSnapshot('EDTW', 48.2791671753, 8.4283332825);
  const dest = await c.fetchMissionWeatherSnapshot('EDSD', 48.638433, 8.817494);
  assert.ok(dep?.raw, 'Departure snapshot must contain a real METAR');
  assert.ok(dest?.raw, 'Destination snapshot must contain a real METAR');
  const weather = c._missionPipelineV3WeatherBundle({ dep, dest });
  const route = { startIcao: 'EDTW', startName: 'Winzeln-Schramberg', targetIcao: 'EDSD', targetName: 'Deckenpfronn',
    distanceNm: c.calcNav(48.2791671753, 8.4283332825, 48.638433, 8.817494).dist };
  const v6 = globalThis.MissionPrivateEpisodeV6;
  const input = v6.frame({ route, weather });
  assert.equal(input.flightContext.weather[0].rawMetar, dep.raw);
  assert.equal(input.flightContext.weather[1].rawMetar, dest.raw);
  const bindings = v6.flightBindings(input.flightContext);
  assert.ok(bindings['start.wind']);
  assert.ok(bindings['target.wind']);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(),
    mode: 'Local production Worker handler with live AviationWeather; not deployed browser/Worker verification',
    requests, flightContext: input.flightContext, bindings }, null, 2));
} finally {
  globalThis.fetch = nativeFetch;
}
