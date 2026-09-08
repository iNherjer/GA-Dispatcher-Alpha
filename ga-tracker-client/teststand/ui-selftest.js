'use strict';
const assert = require('node:assert/strict');
const { Simulator } = require('./simulator');
const { startServer } = require('./server');
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const sim = new Simulator(); sim.connect(); const server = await startServer(sim);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => document.querySelector('#connection').textContent.includes('verbunden'));
    assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8');
    await page.getByRole('button', { name: '1 · Auf A bereitstellen' }).click();
    await page.getByRole('button', { name: '3 · Start / Steigflug' }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#flight').textContent).onGround === 0);
    assert.equal(sim.vars['SIM ON GROUND'], 0); assert.ok(sim.flight);
    await page.locator('#fault').selectOption('spawn'); await page.waitForTimeout(100); assert.equal(sim.fault, 'spawn');
    await page.getByRole('button', { name: 'Simulator pausieren / fortsetzen' }).click(); await page.waitForTimeout(100); assert.equal(sim.vars['IS PAUSED'], 1);
    await page.screenshot({ path: '/tmp/ga-teststand-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '/tmp/ga-teststand-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); console.log('PASS: UTF-8, flight controls, missing ACK selection, pause, desktop/mobile layout.');
  } finally { await browser.close(); sim.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
