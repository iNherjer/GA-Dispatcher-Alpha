import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {ProfileSync} from './cloudflare-worker/profile-sync.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const records=new Map();let alarm=null;
const storage={
  get:async k=>Array.isArray(k)?new Map(k.filter(k=>records.has(k)).map(k=>[k,structuredClone(records.get(k))])):structuredClone(records.get(k)),
  put:async(k,v)=>{if(typeof k==='object')Object.entries(k).forEach(([k,v])=>records.set(k,structuredClone(v)));else records.set(k,structuredClone(v));},
  delete:async k=>(Array.isArray(k)?k:[k]).forEach(k=>records.delete(k)),list:async({prefix})=>new Map([...records].filter(([k])=>k.startsWith(prefix))),
  getAlarm:async()=>alarm,setAlarm:async v=>{alarm=v;}
};
const worker=new ProfileSync({storage,blockConcurrencyWhile:f=>f()});
const nodeClient=require('../cloud-sync-client').create({pilotId:'TEST',pin:'secret',baseUrl:'https://test/api/sync-v2/',request:(url,init)=>worker.fetch(new Request(url,init))});
await nodeClient.write({activeMission:{missionId:'keep'},activeMissionTrackerSeed:{missionId:'keep'},groupName:'keep',lastModified:42});
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
let offline=false;
async function open(state) {
  const context=await browser.newContext(state?{storageState:state}:{}),page=await context.newPage();
  await page.route('**/*',async r=>{
    const request=r.request(),path=new URL(request.url()).pathname;
    if(path.startsWith('/api/')) {
      if(offline)return r.abort();
      const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:request.headers(),...(request.method()==='POST'?{body:request.postData()}: {})}));
      return r.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
    }
    if(path==='/')return r.fulfill({contentType:'text/html',body:`<body><button id="navcomModeBtn" onclick="gaCycleNavcomMode()"></button><script>const SYNC_URL='https://test/api/sync/';function getSyncId(){return 'TEST'}function getSyncPin(){return 'secret'}</script>${['cloud-sync-core','mission-cloud-control-core','cloud-sync-client','radio-tuning-core','radio-tuning-ui','navcom-preferences-core','navcom-preferences-client'].map(n=>'<script src="/'+n+'.js"></script>').join('')}</body>`});
    return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(new URL('..'+path,import.meta.url))});
  });
  await page.goto('https://test/');await page.waitForFunction(()=>typeof gaGetNavcomMode==='function');return {context,page};
}
try {
  const first=await open();await first.page.locator('#navcomModeBtn').click();
  for(let i=0;i<100&&(await nodeClient.read(['field:navcomMode'])).profile.navcomMode!=='direct';i++)await first.page.waitForTimeout(30);
  assert.equal((await nodeClient.read()).profile.navcomMode,'direct');
  const second=await open();await second.page.waitForFunction(()=>gaGetNavcomMode()==='direct');
  // Explicit change while offline stays queued, including browser restart.
  offline=true;await second.page.locator('#navcomModeBtn').click();
  await second.page.waitForFunction(()=>!!localStorage.getItem('ga_navcom_pending_v1:TEST'));
  const state=await second.context.storageState();await second.context.close();
  offline=false;const restarted=await open(state);
  await restarted.page.waitForFunction(()=>!localStorage.getItem('ga_navcom_pending_v1:TEST'));
  assert.equal((await nodeClient.read()).profile.navcomMode,'select');
  await first.page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await first.page.waitForFunction(()=>gaGetNavcomMode()==='select');
  const saved=(await nodeClient.read()).profile;
  assert.equal(saved.activeMission.missionId,'keep');assert.equal(saved.activeMissionTrackerSeed.missionId,'keep');assert.equal(saved.groupName,'keep');assert.equal(saved.lastModified,42);
  assert.ok(!JSON.stringify(saved).includes('secret'));
  await first.context.close();await restarted.context.close();
  console.log('PASS two browser devices, cloud restore, offline queue/restart, remote refresh and unchanged mission/seed/profile');
}finally{await browser.close();}
