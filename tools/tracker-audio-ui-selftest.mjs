import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || '/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { createAudioControl } = require('../ga-tracker-client/tracker-audio-control-core');
const root = path.resolve(import.meta.dirname, '..');
const control = createAudioControl();
let nextRequests = 0, hardware = '';
const snapshot = () => ({ ...control.snapshot(), playback: { notification: 'idle', playbackAvailable: false } });
const originalIndex = fs.readFileSync(path.join(root,'index.html'),'utf8');
const menu = `<script>document.write(new DOMParser().parseFromString(${JSON.stringify(originalIndex).replaceAll('</script', '<\\/script')},'text/html').getElementById('mapVoiceMenu').outerHTML);document.getElementById('mapVoiceMenu').style.cssText='display:block;width:280px;padding:8px;background:#121212';</script>`;
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/v1/audio/settings') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ audio: snapshot() })); return; }
  if (pathname === '/api/v1/audio/playback') {
    let body = ''; for await (const chunk of req) body += chunk;
    const command = JSON.parse(body);
    const result = command.action === 'settings_update' ? control.update(command) : { available: false };
    if (command.action === 'next') nextRequests++;
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(result)); return;
  }
  if (pathname === '/app') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<html><body style="background:#121212;color:white;width:280px;font:14px Arial">${menu}<script>window.legacyCalls=0;window.awmSetVolume=window.paxVoiceSetEnabled=window.paxVoiceSetAudioEffectsEnabled=function(){window.legacyCalls++};window.gaCockpitSessionClient={role:'efb',clientId:crypto.randomUUID(),baseUrl:location.origin+'/api/v1'};</script><script src="/ga-tracker-client/tracker-audio-player.js"></script><script src="/ga-tracker-client/tracker-audio-client.js"></script></body></html>`); return;
  }
  if (pathname === '/desktop') {
    let html = fs.readFileSync(path.join(root,'ga-tracker-client/desktop/ui/index.html'),'utf8');
    html = html.replace('<script src="./renderer.js"></script>', '').replaceAll('src="./','src="/ga-tracker-client/desktop/ui/').replaceAll('href="./','href="/ga-tracker-client/desktop/ui/');
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); return;
  }
  const filename = path.join(root, pathname);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename)) { res.statusCode=404; res.end(); return; }
  res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  res.end(fs.readFileSync(filename));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.GA_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--autoplay-policy=no-user-gesture-required'] });
try {
  const a = await browser.newContext(), b = await browser.newContext();
  const phone = await a.newPage(), efb = await b.newPage();
  await phone.goto(origin+'/app'); await efb.goto(origin+'/app');
  await phone.waitForSelector('#gaAudioOutputSelect'); await efb.waitForSelector('#gaAudioOutputSelect');
  assert.equal(await phone.locator('#gaAudioOutputSelect').inputValue(),'pc');
  await phone.selectOption('#gaAudioOutputSelect','this');
  await phone.waitForFunction(() => document.getElementById('gaAudioOutputSelect').value === 'this');
  await efb.waitForFunction(() => document.getElementById('gaAudioOutputSelect').value === 'other');
  const id = control.snapshot().target.deviceId;
  await phone.reload(); await phone.waitForFunction(() => document.getElementById('gaAudioOutputSelect').value === 'this');
  assert.equal(control.snapshot().target.deviceId,id);
  await phone.evaluate(() => awmSetVolume(37));
  await efb.waitForFunction(() => document.getElementById('awmVolumeSlider').value === '37');
  assert.equal(await phone.evaluate(() => legacyCalls),1, 'volume also preserves the existing local warning gain');
  await phone.locator('#awmPaxVoiceCheck').uncheck();
  await efb.waitForFunction(() => !document.getElementById('awmPaxVoiceCheck').checked);
  assert.equal(await phone.evaluate(() => legacyCalls),1, 'Pax toggle must not trigger standalone TTS');
  const idleBaseline = nextRequests;
  await phone.waitForTimeout(2100);
  assert.equal(nextRequests,idleBaseline,'no recurring idle playback polling');
  assert.equal(await phone.evaluate(() => document.characterSet), 'UTF-8');
  assert.ok((await phone.locator('#mapVoiceMenu').innerText()).includes('🏔️'));
  assert.ok((await phone.locator('#mapVoiceMenu').innerText()).includes('🧑‍✈️'));
  await phone.locator('#mapVoiceMenu').screenshot({path:'/tmp/ga-audio-app-menu.png'});
  await efb.selectOption('#gaAudioOutputSelect','pc');
  await phone.waitForFunction(() => document.getElementById('gaAudioOutputSelect').value === 'pc');
  const desktop = await browser.newPage({viewport:{width:520,height:900}});
  await desktop.exposeFunction('fixtureAudio', async (kind,payload) => kind === 'settings' ? {audio:snapshot()} : control.update(payload));
  await desktop.exposeFunction('fixtureHardware', async id => { hardware=id; return {ok:true}; });
  await desktop.addInitScript(() => {
    window.trackerDesktop={audioRequest:(kind,payload)=>window.fixtureAudio(kind,payload),setAudioOutputDeviceId:id=>window.fixtureHardware(id),getState:async()=>({settings:{audioOutputDeviceId:''}})};
    navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audiooutput',deviceId:'headset',label:'Test Headset'}];
    AudioContext.prototype.setSinkId=async function(id){this.fixtureSink=id};
  });
  await desktop.goto(origin+'/desktop');
  await desktop.locator('#audioOutputMenu').evaluate(el => { for(let parent=el.parentElement;parent;parent=parent.parentElement) if(parent.tagName==='DETAILS') parent.open=true; });
  await desktop.selectOption('#audioHardwareSelect','headset');
  await new Promise(resolve=>setTimeout(resolve,30)); assert.equal(hardware,'headset');
  await desktop.locator('#audioOutputMenu').screenshot({path:'/tmp/ga-audio-desktop-menu.png'});
  console.log('PASS: shared device switch, persistent device ID, volume/Pax sync, zero idle audio polling, desktop output selection.');
} finally { await browser.close(); control.close(); await new Promise(resolve=>server.close(resolve)); }
