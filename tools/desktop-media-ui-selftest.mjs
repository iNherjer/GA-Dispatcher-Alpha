import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || '/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');
const ui = path.join(root, 'ga-tracker-client/desktop/ui');
const html = fs.readFileSync(path.join(ui, 'index.html'), 'utf8');
const media = html.match(/<section class="media-control"[\s\S]*?<\/section>/)[0];
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><link rel="stylesheet" href="/styles.css"><main class="shell">' + media + '</main><script src="/media.js"></script>');
  } else if (['/media.js','/styles.css'].includes(pathname)) {
    response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(fs.readFileSync(path.join(ui, pathname.slice(1))));
  } else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.GA_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 440, height: 760 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.calls = []; window.fail = false;
    window.mediaState = { ok: true, source: 'Spotify.exe', players: [{source:'Spotify.exe',name:'Spotify'}, {source:'vlc.exe',name:'VLC'}],
      title: '<img src=x onerror=alert(1)>', artist: 'Test Artist', playing: true,
      controls: { playPause:true, next:true, previous:true }, volumeAvailable:true, volume:0.6, duckEnabled:true, duckFactor:0.2 };
    window.trackerDesktop = { mediaRequest: async command => {
      calls.push(command);
      if (fail) return { ok:false, error:'Kein Windows-Player erreichbar.' };
      if (command.action === 'select') mediaState.source = command.source;
      if (command.action === 'volume') mediaState.volume = command.volume;
      if (command.action === 'playPause') mediaState.playing = !mediaState.playing;
      if (command.action === 'settings') { mediaState.duckEnabled=command.enabled; mediaState.duckFactor=command.factor; }
      if (command.action === 'duck') { mediaState.ducking=command.active; return {ok:true}; }
      return structuredClone(mediaState);
    } };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => document.querySelector('#mediaStatus').textContent.includes('verbunden'));
  assert.equal(await page.locator('#mediaTitle img').count(), 0, 'metadata must be plain text');
  await page.evaluate(() => { mediaState.title = 'Fly Me to the Moon'; mediaState.artist = 'Frank Sinatra'; });
  assert.equal(await page.locator('#mediaVolume').inputValue(), '60');
  await page.click('#mediaPlayPause'); await page.waitForFunction(() => document.querySelector('#mediaPlayPause').textContent === 'Play');
  await page.click('#mediaNext'); await page.click('#mediaPrevious');
  await page.selectOption('#mediaPlayer', 'vlc.exe');
  assert.equal(await page.locator('#mediaPlayer').inputValue(), 'vlc.exe');
  await page.locator('#mediaVolume').fill('30'); await page.locator('#mediaVolume').dispatchEvent('change');
  await page.waitForFunction(() => mediaState.volume === 0.3);
  await page.selectOption('#mediaDuckFactor', '0.35');
  await page.waitForFunction(() => mediaState.duckFactor === 0.35);
  await page.evaluate(() => {
    GAMediaAudioActivity(true, {effectId:'voice'}, 'audio');
    GAMediaAudioActivity(true, {effectId:'warning'}, 'warning:0');
    GAMediaAudioActivity(false, {effectId:'voice'}, 'audio');
    GAMediaAudioActivity(false, {effectId:'warning'}, 'warning:0');
  });
  const ducks = await page.evaluate(() => calls.filter(command => command.action === 'duck').map(command => command.active));
  assert.deepEqual(ducks.slice(-4), [true,true,true,false], 'overlapping audio must not restore music early');
  await page.uncheck('#mediaDuckEnabled');
  await page.waitForFunction(() => !mediaState.duckEnabled);
  await page.reload();
  assert.equal(await page.locator('#mediaDuckEnabled').isChecked(), false);
  assert.equal(await page.locator('#mediaDuckFactor').inputValue(), '0.35');
  await page.waitForFunction(() => !mediaState.duckEnabled && mediaState.duckFactor === 0.35);
  await page.evaluate(() => { mediaState.title = 'Fly Me to the Moon'; mediaState.artist = 'Frank Sinatra'; });
  await page.click('#mediaPlayPause');
  await page.waitForFunction(() => document.querySelector('#mediaTitle').textContent === 'Fly Me to the Moon');
  await page.locator('.media-control').screenshot({ path: '/tmp/ga-desktop-media-minimal.png' });
  const dimensions = await page.locator('.media-control').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth,
    children: Array.from(el.querySelectorAll('*')).filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map(child => ({ id:child.id, tag:child.tagName, width:child.getBoundingClientRect().width })) }));
  assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
  await page.evaluate(() => { fail = true; });
  await page.waitForFunction(() => document.querySelector('#mediaStatus').textContent.includes('nicht') || document.querySelector('#mediaStatus').textContent.includes('Kein'));
  assert.equal(await page.locator('#mediaPlayPause').isDisabled(), true);
  await page.evaluate(() => { fail = false; mediaState.players = []; mediaState.controls = {}; mediaState.volumeAvailable = false; });
  await page.waitForFunction(() => document.querySelector('#mediaStatus').textContent.includes('Player öffnen'));
  assert.equal(await page.locator('#mediaVolume').isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('DESKTOP_MEDIA_UI_OK: controls, metadata safety, overlap, preferences, error recovery, 440px layout');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
