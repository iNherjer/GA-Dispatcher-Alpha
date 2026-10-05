import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const { createTrackerEfbHttpServer, createTrackerEfbHttpHello } = require('../ga-tracker-client/tracker-efb-http-server');
const { createDisplaySettingsControl } = require('../ga-tracker-client/tracker-efb-display-settings');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-efb-vr-font-'));
const configFile = path.join(directory, 'tracker-config.json');
fs.writeFileSync(configFile, JSON.stringify({ syncId: 'test-pilot', protectedPin: 'unchanged' }));
const displayControl = createDisplaySettingsControl({
  readConfig: () => JSON.parse(fs.readFileSync(configFile, 'utf8')),
  writeConfig: config => { fs.writeFileSync(configFile, JSON.stringify(config)); return true; }
});
const server = createTrackerEfbHttpServer({ port: 0, hello: createTrackerEfbHttpHello({ trackerVersion: 'v469', trackerVersionCode: 469 }), displayControl });
const address = await server.start();
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/parent') return route.fulfill({ contentType: 'text/html', body: `<iframe style="width:950px;height:750px" src="/efb/v1/?channel=vr-font-test&vr=${url.searchParams.get('vr') || '0'}"></iframe>` });
    if (url.pathname === '/api/v1/display/settings') return route.continue();
    if (url.pathname === '/efb/v1/') return route.fulfill({ contentType: 'text/html', body: efb.createTrackerEfbWebClientPage() });
    const asset = efb.getTrackerEfbWebClientAsset(url.pathname);
    if (asset) {
      let body = asset.body;
      if (url.pathname.endsWith('/host.js')) body = body.toString().replace(/\}\)\(\);\s*$/, '\npollingClosed=true;window.__vrFontTest={scale:setEfbFontScale,ready:function(){return displaySettingsReady},mode:function(){return displayMode}};\n})();');
      return route.fulfill({ contentType: asset.contentType, body });
    }
    return route.fulfill({ contentType: 'application/json', body: '{"available":false,"items":[],"ok":true}' });
  });
  const frame = async () => {
    const handle = await page.locator('iframe').elementHandle();
    const view = await handle.contentFrame();
    await view.waitForFunction(() => window.__vrFontTest?.ready());
    return view;
  };
  const changeMode = async (vr, channel = 'vr-font-test') => page.evaluate(({ vr, channel }) => {
    document.querySelector('iframe').contentWindow.postMessage({ type: 'ga-efb-display-mode', channel, vr }, location.origin);
  }, { vr, channel });
  await page.goto(`${base}/parent`);
  let view = await frame();
  await view.evaluate(() => __vrFontTest.scale(1.2));
  await page.waitForFunction(async () => (await (await fetch('/api/v1/display/settings')).json()).display.fontScale2d === 1.2);
  await changeMode(true, 'stale-channel');
  await view.waitForTimeout(50);
  assert.equal(await view.evaluate(() => __vrFontTest.mode()), '2d');
  await changeMode(true);
  await view.waitForFunction(() => __vrFontTest.mode() === 'vr');
  await view.evaluate(() => __vrFontTest.scale(2));
  await page.waitForFunction(async () => (await (await fetch('/api/v1/display/settings')).json()).display.fontScaleVr === 2);
  await changeMode(false);
  await view.waitForFunction(() => document.body.getAttribute('data-ga-efb-font-scale') === '120');
  // Reject a message from the child itself, even with the current channel.
  await view.evaluate(() => window.postMessage({ type: 'ga-efb-display-mode', channel: 'vr-font-test', vr: true }, location.origin));
  await view.waitForTimeout(50);
  assert.equal(await view.evaluate(() => __vrFontTest.mode()), '2d');
  await page.goto(`${base}/parent?vr=1`);
  view = await frame();
  await view.waitForFunction(() => document.body.getAttribute('data-ga-efb-font-scale') === '200');
  assert.match(await view.locator('.ga-efb-font-size-hint').textContent(), /VR.*200%/);
  await view.evaluate(() => __vrFontTest.scale(1));
  await page.waitForFunction(async () => (await (await fetch('/api/v1/display/settings')).json()).display.fontScaleVr === 1);
  await changeMode(false);
  await view.waitForFunction(() => document.body.getAttribute('data-ga-efb-font-scale') === '120');
  // Edits in both modes while a save is pending must remain separate.
  await view.evaluate(() => __vrFontTest.scale(1.4));
  await changeMode(true);
  await view.waitForFunction(() => __vrFontTest.mode() === 'vr');
  await view.evaluate(() => __vrFontTest.scale(1.8));
  await page.waitForFunction(async () => {
    const settings = (await (await fetch('/api/v1/display/settings')).json()).display;
    return settings.fontScale2d === 1.4 && settings.fontScaleVr === 1.8;
  });
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(config.protectedPin, 'unchanged');
  assert.deepEqual(config.efbDisplay, { fontScale2d: 1.4, fontScaleVr: 1.8 });
  const rejected = await fetch(`${base}/api/v1/display/settings`, { method: 'POST', headers: { Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'vr', fontScale: 1 }) });
  assert.equal(rejected.status, 403);
  console.log('PASS config-file persistence, automatic 2D/VR changes, initial VR, reload, separate reset, queued writes, sender/channel and origin checks.', config.efbDisplay);
} finally {
  await browser.close(); await server.stop();
  // Keep the isolated fixture file for inspection; never use the real pilot config.
}
