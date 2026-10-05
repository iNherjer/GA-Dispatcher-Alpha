import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

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
  // Coherent may not present window.confirm: reset must wait for our UI.
  await page.evaluate(() => {
    window.__resetCalls = 0;
    window.gaCockpitSessionClient = { submitIntent: () => { window.__resetCalls++; return Promise.resolve({ ok: true }); } };
    window.__resetFixture = run => ({ available: true, missionId: 'reset-test', control: { missionId: 'reset-test', runId: run, phase: 'planned', executionAuthority: 'tracker', allowedActions: ['abort_mission'] }, view: {} });
    __fontTest.mission(__resetFixture('run-one'));
    window.__resetResult = window.requestMissionRuntimeReset();
  });
  await page.locator('#gaEfbResetConfirm').waitFor();
  assert.equal(await page.evaluate(() => __resetCalls), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'gaEfbResetCancel');
  await page.locator('#gaEfbResetCancel').click();
  assert.equal(await page.evaluate(() => __resetResult), false);
  await page.evaluate(() => { window.__resetResult = window.requestMissionRuntimeReset(); });
  await page.locator('#gaEfbResetAccept').click();
  await page.evaluate(() => __resetResult);
  assert.equal(await page.evaluate(() => __resetCalls), 1);
  await page.evaluate(() => { __fontTest.mission(__resetFixture('run-one')); window.__resetResult = window.requestMissionRuntimeReset(); __fontTest.mission(__resetFixture('run-two')); });
  await page.locator('#gaEfbResetAccept').click();
  assert.equal(await page.evaluate(() => __resetResult), false);
  assert.equal(await page.evaluate(() => __resetCalls), 1);
  await page.locator('#mapHintsBtn').click();
  await page.locator('#gaEfbFontLarger').click();
  assert.match(await page.locator('.ga-efb-font-size-hint').textContent(), /110%/);
  assert.equal(await page.locator('#gaEfbFontReset').textContent(), '110 %');
  for (let i = 0; i < 19; i++) await page.locator('#gaEfbFontLarger').click();
  assert.match(await page.locator('.ga-efb-font-size-hint').textContent(), /300%/);
  assert.equal(await page.locator('#gaEfbFontReset').textContent(), '300 %');
  assert.equal(await page.locator('#gaEfbFontLarger').isDisabled(), true);
  await page.reload();
  await page.waitForFunction(() => window.__fontTest && window.gaChecklistHost?.missionView);
  await page.locator('#mapHintsBtn').click();
  assert.match(await page.locator('.ga-efb-font-size-hint').textContent(), /300%/);
  assert.equal(await page.locator('#gaEfbFontReset').textContent(), '300 %');
  await page.setViewportSize({ width: 516, height: 716 });
  await page.waitForTimeout(150);
  await page.locator('#mapHintsBtn').click();
  await page.locator('#gaEfbFontControls').waitFor({ state: 'visible' });
  const controlsLayout = await page.locator('#gaEfbFontControls').evaluate(el => {
    const menu = document.getElementById('mapHintsMenu');
    return { menuWidth: menu.clientWidth, menuScrollWidth: menu.scrollWidth,
      buttons: [...el.querySelectorAll('button')].map(button => ({
        text: button.textContent, width: button.clientWidth, scrollWidth: button.scrollWidth })) };
  });
  assert.ok(controlsLayout.menuScrollWidth <= controlsLayout.menuWidth + 1, JSON.stringify(controlsLayout));
  for (const button of controlsLayout.buttons) assert.ok(button.scrollWidth <= button.width + 1, JSON.stringify(button));
  await page.locator('#mapHintsMenu').screenshot({ path: path.join(process.env.GA_EFB_SCREENSHOT_DIR || os.tmpdir(), 'ga-efb-font-300-menu.png') });
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.waitForTimeout(150);
  await page.locator('#mapHintsBtn').click();
  await page.locator('#gaEfbFontControls').waitFor({ state: 'visible' });
  await page.locator('#gaEfbFontReset').click();
  assert.equal(await page.locator('#gaEfbFontReset').textContent(), '100 %');
  await page.locator('#gaEfbFontSmaller').click();
  assert.match(await page.locator('.ga-efb-font-size-hint').textContent(), /90%/);
  assert.equal(await page.locator('#gaEfbFontSmaller').isDisabled(), true);
  await page.locator('#gaEfbFontReset').click();
  assert.equal(await page.locator('#gaEfbFontReset').textContent(), '100 %');
  await page.locator('#gaEfbFontControls').screenshot({ path: path.join(process.env.GA_EFB_SCREENSHOT_DIR || os.tmpdir(), 'ga-efb-font-controls.png') });
  await page.locator('#mapHintsBtn').click();
  const fixedControls = await page.evaluate(() => {
    const realStyle = window.getComputedStyle;
    const gear = document.getElementById('btnVpSettings');
    const rte = document.getElementById('btnToggleVpMode');
    const bases = [gear, rte].map(el => Number(el.getAttribute('data-ga-efb-font-base')));
    // Emulate stale Coherent computed sizes on a scale change.
    window.getComputedStyle = function(el) {
      if (el === gear || el === rte) return { fontSize: '999px' };
      return realStyle.apply(window, arguments);
    };
    const samples = [];
    for (const scale of [1.5, 0.9, 2, 1, 3, 1.5]) {
      __fontTest.scale(scale);
      samples.push({scale, actual:[gear,rte].map(el => parseFloat(realStyle.call(window,el).fontSize)), expected:bases.map(value=>Math.round(value*scale*10)/10)});
    }
    window.getComputedStyle = realStyle;
    return samples;
  });
  for (const sample of fixedControls) assert.deepEqual(sample.actual, sample.expected);
  console.log('PASS fixed gear/RTE base sizes across grow, shrink and reset', fixedControls);
  const canvasFonts = await page.evaluate(() => ({
    scaled: vpCanvasFont({canvas:{id:'mapProfileCanvas'}}, 'bold 10px Arial'),
    standalone: vpCanvasFont({canvas:{id:'profileCanvas'}}, 'bold 10px Arial'),
    zoomSize: document.querySelector('#map .leaflet-control-zoom-in')?.getBoundingClientRect().height,
    profileMin: parseFloat(getComputedStyle(document.getElementById('mapProfileStrip')).minHeight)
  }));
  assert.equal(canvasFonts.scaled, 'bold 15px Arial');
  assert.equal(canvasFonts.standalone, 'bold 10px Arial');
  assert.equal(canvasFonts.profileMin, 150);
  if (canvasFonts.zoomSize !== undefined) assert.ok(canvasFonts.zoomSize >= 48);
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
    for (const scale of [1.1, 1.3, 2, 3, 0.9]) {
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
    __fontTest.scale(2);
    const payload = { available: true, missionId: 'font-test', state: 'active', phase: 'flight',
      view: { title: 'Testmission', story: 'Ein gleichbleibendes Briefing.', active: true,
        currentTask: 'Zum Ziel fliegen', progress: [], requirements: [], feedback: [], flight: {} } };
    __fontTest.mission(payload);
    gaChecklistOpen('mission');
    await frame();
    const body = document.getElementById('checklistDrawerBody');
    const original = body.firstElementChild;
    for (let i = 0; i < 5; i++) { __fontTest.mission(payload); await frame(); }
    __fontTest.mission({ ...payload, view: { ...payload.view, flight: { mslFt: 2345, aglFt: 1234 } } });
    await frame();
    if (document.getElementById('gaEfbMissionAltitude').textContent !== '2.345 ft MSL') throw Error('Live altitude update missing');
    const originalHeight = body.scrollHeight; // Baseline after the intentional live-value layout update.
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
  assert.equal(result.length, 5);
  console.log('PASS visible font controls, bounds, persisted choice, reset, first-frame scaling and snapshot-driven mission menu.', result);
} finally {
  await browser.close();
}
