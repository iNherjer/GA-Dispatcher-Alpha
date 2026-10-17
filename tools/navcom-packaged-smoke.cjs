'use strict';
// Execute this entry after packaging with ga-tracker-client/package.json.
const assert = require('node:assert/strict');
const core = require('../cloud-sync-core');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const {createNavcomPreferences} = require('../ga-tracker-client/tracker-navcom-preferences');
(async () => {
  const packed = await core.pack({activeMission:{missionId:'keep'},activeMissionTrackerSeed:{missionId:'keep'},lastModified:42});
  let head={revision:1,manifest:packed.manifest}, config={};const chunks={...packed.chunks};
  const mission=JSON.stringify(head.manifest.sections.mission);
  const request=async(url,init={})=>{
    const path=new URL(url).pathname,body=init.body&&JSON.parse(init.body);let data;
    if(path.endsWith('/head'))data=head;
    else if(path.endsWith('/missing'))data={missing:body.ids.filter(id=>!chunks[id])};
    else if(path.endsWith('/chunk')){chunks[body.id]=body.data;data={ok:true};}
    else if(path.includes('/chunk/'))data={data:chunks[path.split('/').pop()]};
    else if(path.endsWith('/commit')){assert.equal(body.baseRevision,head.revision);head={revision:head.revision+1,manifest:body.manifest};data=head;}
    else throw Error('unexpected request');
    return {ok:true,status:200,json:async()=>data};
  };
  const control=createNavcomPreferences({pilotId:'TEST',pin:'secret',readConfig:()=>config,writeConfig:value=>(config=value,true),request});
  assert.equal(control.update('select').ok,true);await control.refresh();
  assert.deepEqual(control.state(),{mode:'select',pending:false});
  assert.equal(JSON.stringify(head.manifest.sections.mission),mission);
  const profile=await core.unpack(head.manifest,id=>chunks[id]);
  assert.equal(profile.navcomMode,'select');assert.equal(profile.activeMission.missionId,'keep');assert.equal(profile.lastModified,42);
  const asset=efb.getTrackerEfbWebClientAsset('/efb/v1/assets/navcom-preferences-client.js');
  assert.ok(asset.body.length>1000);new (require('node:vm').Script)(asset.body.toString());
  assert.ok(efb.createTrackerEfbWebClientPage().includes('navcom-preferences-client.js?v=55901'));
  console.log('NAVCOM_PACKAGED_SMOKE_OK packaged='+!!process.pkg);
})().catch(error=>{console.error(error);process.exitCode=1;});
