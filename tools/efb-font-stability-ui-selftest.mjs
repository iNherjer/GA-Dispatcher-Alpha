import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const browser = await chromium.launch({ headless: true,
  ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1640, height: 900 } });
  await page.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: efb.createTrackerEfbWebClientPage() });
    const asset = efb.getTrackerEfbWebClientAsset(pathname);
    if (asset) {
      let body = asset.body;
      if (pathname.endsWith('/host.js')) body = body.toString().replace(/\}\)\(\);\s*$/, `
        pollingClosed=true;
        window.__fontTest={scale:setEfbFontScale,mission:renderMissionPayload};
      })();`);
      return route.fulfill({ contentType: asset.contentType, body });
    }
    return route.fulfill({ contentType: 'application/json', body: '{"available":false,"items":[],"ok":true}' });
  });
  await page.goto('http://127.0.0.1/');
  await page.waitForFunction(() => window.__fontTest && window.gaChecklistHost?.missionView);
  const result = await page.evaluate(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const size = el => parseFloat(getComputedStyle(el).fontSize);
    const fixture = document.createElement('section');
    fixture.style.fontSize = '20px';
    fixture.innerHTML = '<span id="stableFont">Live</span><div id="newFonts"></div>';
    document.body.appendChild(fixture);
    await frame();
    const stable = document.getElementById('stableFont');
    const target = document.getElementById('newFonts');
    const samples = [];
    for (const scale of [1.1, 1.3, 0.9]) {
      __fontTest.scale(scale);
      let styleWrites = 0;
      const watcher = new MutationObserver(records => { styleWrites += records.length; });
      watcher.observe(stable, { attributes: true, attributeFilter: ['style'] });
      for (let i = 0; i < 5; i++) {
        stable.textContent = 'Live ' + i;
        await frame();
        if (size(stable) !== 20 * scale) throw Error('Existing text changed size');
      }
      watcher.disconnect();
      if (styleWrites) throw Error('Live text reset existing font styles');
      target.innerHTML = '<span>Inherited</span><b style="font-size:1.5em">Relative</b><i style="font-size:12px">Explicit</i>';
      // Inspect the very first frame, rather than waiting for a delayed repair.
      await frame();
      const actual = Array.from(target.children, size);
      const expected = [20, 30, 12].map(base => Math.round(base * scale * 10) / 10);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('First-frame scale/inheritance: ' + actual);
      samples.push({ scale, actual, styleWrites });
    }
    __fontTest.scale(1);
    if (size(stable) !== 20 || stable.style.fontSize !== '') throw Error('Default did not restore CSS inheritance');
    fixture.remove();
    __fontTest.scale(1.3);
    const payload = { available: true, missionId: 'font-test', state: 'active', phase: 'flight',
      view: { title: 'Testmission', story: 'Ein gleichbleibendes Briefing.', active: true,
        currentTask: 'Zum Ziel fliegen', progress: [], requirements: [], feedback: [], flight: {} } };
    __fontTest.mission(payload);
    gaChecklistOpen('mission');
    await frame();
    const body = document.getElementById('checklistDrawerBody');
    const original = body.firstElementChild;
    const originalHeight = body.scrollHeight;
    for (let i = 0; i < 5; i++) { __fontTest.mission(payload); await frame(); }
    __fontTest.mission({ ...payload, view: { ...payload.view, flight: { mslFt: 2345, aglFt: 1234 } } });
    await frame();
    if (document.getElementById('gaEfbMissionAltitude').textContent !== '2.345 ft MSL') throw Error('Live altitude update missing');
    await new Promise(resolve => setTimeout(resolve, 2200));
    if (body.firstElementChild !== original || body.scrollHeight !== originalHeight) throw Error('Periodic mission menu rebuild');
    __fontTest.mission({ ...payload, view: { ...payload.view, title: 'Geänderte Testmission' } });
    await frame();
    if (!body.textContent.includes('Geänderte Testmission') || body.firstElementChild === original) throw Error('Semantic update missing');
    const missionView = gaChecklistHost.missionView;
    delete gaChecklistHost.missionView;
    const hostedNode = body.firstElementChild;
    await new Promise(resolve => setTimeout(resolve, 1200));
    if (body.firstElementChild === hostedNode) throw Error('Standalone periodic refresh was disabled');
    gaChecklistHost.missionView = missionView;
    return samples;
  });
  assert.equal(result.length, 3);
  console.log('PASS first-frame font scaling, inherited/em/px sizes, stable live text, CSS reset and snapshot-driven mission menu.', result);
} finally {
  await browser.close();
}
