// Run with the desktop Electron binary; real EFB page/assets, no external traffic.
const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),efb=require('../ga-tracker-client/tracker-efb-web-client');
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>String.prototype.padStart=undefined;NodeList.prototype.forEach=undefined;</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(url.pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(url.pathname.endsWith('/host.js')) body=body.toString().replace(/\}\)\(\);\s*$/, 'pollingClosed=true;window.__radioTest={setMap:function(value){mapSnapshot=value;renderProgress();}};})();');
   res.end(body);return;
  }
  res.setHeader('Content-Type','application/json');res.end('{}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('http://127.0.0.1:'+port)&&!details.url.startsWith('data:')}));
 const win=new BrowserWindow({width:1000,height:850,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 await win.loadURL('http://127.0.0.1:'+port+'/');
 const report=await win.webContents.executeJavaScript(`(async function(){
  const check=(value,message)=>{if(!value)throw Error(message);};
  check(window.GARadioTuningCore && window.gaCycleNavcomMode && window.__radioTest,'Shared UI/host did not boot');
  const core=GARadioTuningCore,calls=[];
  window.gaRadioTune=async function(payload){calls.push(payload);return {ok:true,confirmed:true,target:core.normalize(payload)};};
  const host=document.createElement('div');host.style.cssText='position:fixed;left:250px;top:260px;z-index:99999';document.body.appendChild(host);
  host.innerHTML=core.html('123.450','COM')+' '+core.html('110.500','NAV')+' '+core.html('350.5','ADF')+' '+core.html('0042','XPDR');
  const nodes=host.querySelectorAll('.ga-radio-value');
  function mode(value){for(let i=0;i<3&&document.body.dataset.navcomMode!==value;i++)gaCycleNavcomMode();}
  mode('off');nodes[0].click();check(calls.length===0&&!document.querySelector('.ga-radio-dialog'),'Off sent a command');
  mode('direct');nodes[0].click();await new Promise(r=>setTimeout(r,20));check(calls[0].kind==='COM'&&calls[0].index===1&&calls[0].slot==='active','Direct target wrong');
  mode('select');nodes[0].click();let dialog=document.querySelector('.ga-radio-dialog');
  let first=dialog.querySelector('.ga-radio-choices button'),before=first.getBoundingClientRect().toJSON();first.click();
  first=dialog.querySelector('.ga-radio-choices button');const after=first.getBoundingClientRect().toJSON();
  check(before.x===after.x&&before.y===after.y&&before.width===after.width&&before.height===after.height,'Selection rows moved');
  check(calls.length===1,'Device choice clicked through into active');first.click();await new Promise(r=>setTimeout(r,20));check(calls.length===2&&!document.querySelector('.ga-radio-dialog'),'Selection not confirmed/closed');
  nodes[1].click();dialog=document.querySelector('.ga-radio-dialog');dialog.querySelectorAll('.ga-radio-choices button')[1].click();dialog.querySelectorAll('.ga-radio-choices button')[1].click();await new Promise(r=>setTimeout(r,20));
  check(calls[2].kind==='NAV'&&calls[2].index===2&&calls[2].slot==='standby','NAV2 standby target wrong');
  nodes[2].click();dialog=document.querySelector('.ga-radio-dialog');check(dialog.querySelector('.ga-radio-choices button').textContent==='ADF1','NDB did not offer ADF');dialog.querySelector('.ga-radio-close').click();
  nodes[3].click();dialog=document.querySelector('.ga-radio-dialog');dialog.querySelector('.ga-radio-choices button').click();check(dialog.querySelectorAll('.ga-radio-choices button')[1].style.visibility==='hidden','Squawk offers standby');dialog.querySelector('.ga-radio-choices button').click();await new Promise(r=>setTimeout(r,20));check(calls[3].value==='0042','Leading squawk zeros lost');
  // Capture must keep a frequency banner visible while tuning.
  const warning={type:27,name:'TMZ TEST',frequencies:[{name:'XPDR',value:'7000'},{name:'INFO',value:'123.450'}]};
  GANavigationWarningPresentation.showFrequency(warning,'#9966ff');const banner=document.getElementById('awmFreqBanner'),value=banner.querySelector('.ga-radio-value');
  value.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,cancelable:true}));value.click();check(banner.children.length===1,'Tuning dismissed the banner');document.querySelector('.ga-radio-close').click();
  __radioTest.setMap({context:{frequency:'INFO 123.450',waypointLabels:[{lat:48.45,lon:7.92,name:'NDB TEST (350)',frequency:'',radioKind:'ADF'}]},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92,name:'NDB TEST (350)',kind:'navaid'}],totalDistanceNm:6},navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:1}});
  check(document.querySelector('#nextWpName [data-radio-kind="ADF"]'),'EFB Next Waypoint not tunable');check(document.querySelector('#routeProgressFreq [data-radio-kind="COM"]'),'EFB progress not tunable');check(document.querySelector('#currentFreqValue [data-radio-kind="COM"]'),'EFB telemetry not tunable');
  // Shared airport/navaid popup renderers, including exclusions.
  window.freqCache={TEST:[{label:'INFO',value:'123.450'}]};
  check(buildPopupFrequencyLines('TEST').includes('data-radio-kind="COM"'),'Airport popup not tunable');
  check(core.text('42X','').indexOf('data-radio-kind')===-1,'TACAN channel became tunable');
  // Whole-body native scaling must not move the dialog outside the viewport.
  mode('select');
  for(const factor of [0.5,1,1.5,3]) {
    GAEfbUiScale.apply(factor,'physical',false); nodes[0].click();
    const panel=document.querySelector('.ga-radio-dialog'),rect=panel.getBoundingClientRect();
    check(rect.left>=-1&&rect.right<=innerWidth+1&&rect.top>=-1&&rect.bottom<=innerHeight+1,'Dialog outside viewport at scale '+factor);
    const device=panel.querySelector('.ga-radio-choices button').getBoundingClientRect();panel.querySelector('.ga-radio-choices button').click();
    const slot=panel.querySelector('.ga-radio-choices button').getBoundingClientRect();
    check(device.x===slot.x&&device.y===slot.y,'Scaled rows moved');panel.querySelector('.ga-radio-close').click();
  }
  GAEfbUiScale.apply(1,'physical',false);
  mode('select');nodes[0].click();return {calls: calls,rows:before,mode:document.body.dataset.navcomMode};
 })()`);
 assert.equal(report.calls.length,4);
 const output='/tmp/ga-navcom-ui';fs.mkdirSync(output,{recursive:true});
 for(const theme of ['classic','retro','navcom','ops1940','win95']){
  await win.webContents.executeJavaScript(`document.body.className='map-is-fullscreen ga-efb-tracker-host theme-${theme}'`);
  await new Promise(resolve=>setTimeout(resolve,150));
  fs.writeFileSync(path.join(output,theme+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 console.log('NAVCOM UI passed: off/direct/select, fixed rows, COM/NAV/ADF/XPDR, banner, EFB telemetry/next waypoint/popups, five themes.');
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 win.destroy();server.close();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
