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
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: efb.createTrackerEfbWebClientPage() });
    const asset = efb.getTrackerEfbWebClientAsset(pathname);
    if (asset) {
      let body = asset.body;
      if (pathname.endsWith('/host.js')) body = body.toString().replace(/\}\)\(\);\s*$/, '\npollingClosed=true;window.__menuTest={pax:renderPaxWidget};\n})();');
      return route.fulfill({ contentType: asset.contentType, body });
    }
    return route.fulfill({ contentType: 'application/json', body: '{"available":false,"items":[],"ok":true}' });
  });
  await page.goto('http://127.0.0.1/');
  await page.waitForFunction(() => window.__menuTest && document.getElementById('gaAudioMasterEnabled'));
  await page.evaluate(async () => {
    await document.fonts.load('16px "GA EFB Text"', 'Schließen Größe ÄÖÜ äöü ß');
    __menuTest.pax({ available: true, missionId: 'menu-test', voice: { speaker: 'Mara Hoffmann', text: 'Größe prüfen. Schließen – ÄÖÜ äöü ß.' } });
    const menu = document.getElementById('mapVoiceMenu');
    menu.style.setProperty('display', 'block', 'important');
    menu.style.setProperty('visibility', 'visible', 'important');
    const checkbox = document.getElementById('gaAudioMasterEnabled');
    for (let ancestor = checkbox.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).display === 'none') ancestor.style.setProperty('display', 'block', 'important');
      ancestor.hidden = false;
    }
    checkbox.checked = true;
    window.__checkboxChanges = 0;
    checkbox.addEventListener('change', () => window.__checkboxChanges++);
  });
  const checkbox = page.locator('#gaAudioMasterEnabled');
  const styles = await checkbox.evaluate(el => {
    const style = getComputedStyle(el), mark = getComputedStyle(el, '::after');
    return { appearance: style.appearance, color: mark.borderTopColor, content: mark.content, width: style.width, height: style.height };
  });
  assert.equal(styles.appearance, 'none');
  assert.equal(styles.color, 'rgb(255, 255, 255)');
  assert.notEqual(styles.content, 'none');
  assert.equal(styles.width, '14px');
  assert.equal(styles.height, '14px');
  await checkbox.click();
  assert.equal(await checkbox.isChecked(), false);
  await checkbox.focus();
  await page.keyboard.press('Space');
  assert.equal(await checkbox.isChecked(), true);
  assert.equal(await page.evaluate(() => window.__checkboxChanges), 2);
  await page.locator('#gaTrackerAudioOutput').screenshot({ path: path.join(process.env.GA_EFB_SCREENSHOT_DIR || os.tmpdir(), 'ga-efb-menu-audio.png') });
  await page.evaluate(() => document.getElementById('paxVoiceBtn').click());
  const close = page.locator('#paxVoicePanel .ga-efb-pax-close');
  assert.equal(await close.textContent(), 'Schließen');
  assert.match(await close.evaluate(el => getComputedStyle(el).fontFamily), /^"GA EFB Text"/);
  assert.equal(await page.evaluate(() => document.fonts.check('16px "GA EFB Text"', 'ßÄÖÜ')), true);
  await page.locator('#paxVoicePanel').screenshot({ path: path.join(process.env.GA_EFB_SCREENSHOT_DIR || os.tmpdir(), 'ga-efb-menu-pax.png') });
  await close.click();
  assert.equal(await page.locator('#paxVoicePanel').isVisible(), false);
  console.log('PASS audio checkbox contrast, click/keyboard changes, loaded German text font and PAX close action.');
} finally { await browser.close(); }
