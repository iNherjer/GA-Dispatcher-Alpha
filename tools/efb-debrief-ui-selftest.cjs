const { app, BrowserWindow, session } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const output = '/tmp/ga-efb-debrief-proof';
fs.mkdirSync(output, { recursive: true });
app.whenReady().then(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(efb.createTrackerEfbWebClientPage()); return; }
    const asset = efb.getTrackerEfbWebClientAsset(url.pathname);
    if (asset) {
      res.setHeader('Content-Type', asset.contentType);
      let body = asset.body;
      if (url.pathname.endsWith('/host.js')) body = body.toString().replace(/\}\)\(\);\s*$/, 'pollingClosed=true;window.__debriefTest=renderMissionPayload;})();');
      res.end(body); return;
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ payload: { available: false } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !details.url.startsWith(base) }));
  const win = new BrowserWindow({ width: 900, height: 640, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  await win.loadURL(base);
  const check = await win.webContents.executeJavaScript(`(async function() {
    Element.prototype.append = undefined; Element.prototype.replaceChildren = undefined;
    const record={missionId:'finished',runId:'run-finished',depLabel:'EDTW',arrLabel:'EDTL',missionTitle:'<img src=x onerror=alert(1)> Test',createdAt:1700000000000,durationSec:5400,distanceNm:75.4,maxGForce:1.3,maxBankDeg:21,telemetryStatus:'live',cargo:{failed:false,conditionPct:98}};
    const debrief={missionId:record.missionId,runId:record.runId,revision:17,closedAt:null,record};
    window.__payload={available:false,authoritySnapshot:{activeRun:null,debrief}};
    let calls=0, resolveAck;
    window.alert=function(){};
    window.gaCockpitSessionClient={submitIntent:async function(request){calls++;window.__request=request;return await new Promise(resolve=>{resolveAck=resolve;window.__ack=resolve;});}};
    window.__debriefTest(window.__payload);
    const overlay=document.getElementById('flightDebriefOverlay'), finish=document.getElementById('flightDebriefFinishBtn');
    const assignment=overlay.querySelector('.flight-debrief-assignment');
    if(assignment.querySelector('img'))throw Error('Unsafe HTML');
    if(overlay.style.display!=='flex')throw Error('Terminal debrief missing');
    if(document.getElementById('flightDebriefPdfBtn').style.display!=='none')throw Error('Unsupported PDF offered');
    const body=document.getElementById('flightDebriefBody'); body.scrollTop=70;
    window.__debriefTest(window.__payload);
    if(body!==document.getElementById('flightDebriefBody'))throw Error('Poll rebuilt body');
    finish.click(); await Promise.resolve();
    if(!finish.disabled||overlay.style.display!=='flex')throw Error('Does not wait for ACK');
    resolveAck({ok:false,error:'mission_debrief_persist_failed'}); await new Promise(resolve=>setTimeout(resolve,0));
    if(finish.disabled||overlay.style.display!=='flex')throw Error('Failure did not retain retry');
    window.__debriefTest(window.__payload);
    return {calls,finish:finish.textContent,mission:assignment.textContent};
  })()`);
  assert.equal(check.calls, 1);
  for (const [width, height] of [[900,640],[440,894],[894,440]]) {
    win.setSize(width,height);
    await new Promise(resolve => setTimeout(resolve, 200));
    const bounds = await win.webContents.executeJavaScript(`(function(){const p=document.querySelector('.flight-debrief-paper');p.scrollTop=p.scrollHeight;const b=document.getElementById('flightDebriefFinishBtn').getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:innerWidth,height:innerHeight};})()`);
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, JSON.stringify(bounds));
    await new Promise(resolve => setTimeout(resolve, 200));
    fs.writeFileSync(path.join(output, `${width}x${height}.png`), (await win.webContents.capturePage()).toPNG());
  }
  await win.webContents.executeJavaScript(`(async function(){document.getElementById('flightDebriefFinishBtn').click();await Promise.resolve();window.__ack({ok:true});await new Promise(r=>setTimeout(r,0));window.__debriefTest(window.__payload);if(document.getElementById('flightDebriefOverlay').style.display!=='none')throw Error('Stale poll reopens closed debrief');window.__payload.authoritySnapshot.debrief={...window.__payload.authoritySnapshot.debrief,runId:'run-next',record:{...window.__payload.authoritySnapshot.debrief.record,runId:'run-next'}};window.__debriefTest(window.__payload);if(document.getElementById('flightDebriefOverlay').style.display!=='flex')throw Error('New completion missing');window.__payload.authoritySnapshot.debrief.closedAt=1700000001000;window.__debriefTest(window.__payload);if(document.getElementById('flightDebriefOverlay').style.display!=='none')throw Error('Remote close not synchronized');})()`);
  console.log('PASS EFB terminal debrief, safe text, stable polls, ACK/retry, stale poll, remote close and visible close button in three viewport sizes.');
  win.destroy(); server.close(); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
