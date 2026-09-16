'use strict';
const { app, BrowserWindow, session } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const efb = require(path.join(root, 'ga-tracker-client/tracker-efb-web-client'));
app.whenReady().then(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(efb.createTrackerEfbWebClientPage()); return; }
    const asset = efb.getTrackerEfbWebClientAsset(url.pathname);
    if (asset) {
      let body = asset.body;
      if (url.pathname.endsWith('/host.js')) body = body.toString().replace(/\}\)\(\);\s*$/, 'pollingClosed=true;window.__field={route:renderMapPayload,mission:renderMissionPayload,pax:renderPaxWidget,toolbar:renderMissionToolbar,layers:function(){return routeLayer && routeLayer.getLayers().length;}};})();');
      res.setHeader('Content-Type', asset.contentType); res.end(body); return;
    }
    res.setHeader('Content-Type', 'application/json');res.end(JSON.stringify({ available:false, items:[], ok:true }));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith(base)&&!details.url.startsWith('data:')}));
  const win=new BrowserWindow({width:540,height:740,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
  try {
    await win.loadURL(base); await new Promise(r=>setTimeout(r,500));
    const result=await win.webContents.executeJavaScript(`(()=>{
      const p={available:true,schema:'ga.map-snapshot.v1',version:1,missionId:'field-poi',revision:1,
        route:{waypoints:[{lat:48,lon:8,name:'HOME'},{lat:48.3,lon:7,name:'Ziel',isPOI:true},{lat:48,lon:8,name:'HOME'}]},
        missionGeometry:{target:{lat:48.3,lon:7,name:'Ziel'}},context:{}};
      try { __field.route(p); } catch(e) { return {error:e.message,stack:e.stack}; }
      const original = window.bindRouteAirportPopup; let once = true;
      window.bindRouteAirportPopup = function(){if(once){once=false;throw Error('injected popup failure');}return original.apply(this,arguments);};
      const changed = JSON.parse(JSON.stringify(p)); changed.route.waypoints[1].lon=7.1;
      try { __field.route(changed); } catch(e) { if(e.message!=='injected popup failure')throw e; }
      if(__field.layers()<4) throw Error('previous route lost');
      __field.route(changed); window.bindRouteAirportPopup=original;
      __field.toolbar({available:true,missionId:'field-poi',runId:'r',control:{recipe:'poi',runId:'r',phase:'active',allowedActions:['poi_status','poi_orientation']},
        voice:{kind:'poi',text:'Wir fliegen zum Arbeitsgebiet. Du kannst die Orientierung jederzeit erneut abrufen.',speaker:{name:'Mia'},updatedAt:1}});
      document.getElementById('paxVoiceBtn').click();
      if(document.getElementById('paxVoicePanel').hidden)throw Error('PAX panel closed');
      return {layers:__field.layers(),pins:document.querySelectorAll('.pin-dot').length,paths:document.querySelectorAll('.leaflet-pane path[stroke="#ff4444"]').length};
    })()`);
    console.log(JSON.stringify(result));assert.ok(result.layers>=4); assert.ok(result.pins>=3); assert.ok(result.paths>=1);
    await new Promise(r=>setTimeout(r,500));
    console.log(await win.webContents.executeJavaScript(`JSON.stringify({pax:document.getElementById('paxVoiceWidget').getBoundingClientRect().toJSON(),hidden:document.getElementById('paxVoiceWidget').hidden,panel:document.getElementById('paxVoicePanel').hidden,paths:Array.from(document.querySelectorAll('.leaflet-pane path[stroke="#ff4444"]')).map(x=>x.getBoundingClientRect().toJSON())})`));
    await win.webContents.capturePage().then(image=>fs.writeFileSync('/tmp/efb-field-regression.png',image.toPNG()));
    console.log('EFB field route regression: passed');
  } finally {win.destroy();server.close();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
