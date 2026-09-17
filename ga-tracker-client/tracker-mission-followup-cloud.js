'use strict';
const https=require('node:https');
const sync=require('../cloud-sync-client.js');
const {mergeRequests}=require('./tracker-mission-followup.js');
function request(url,init={}) {
 return new Promise((resolve,reject)=>{
  const req=https.request(url,{method:init.method||'GET',headers:init.headers},res=>{
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>96*1024){res.destroy(Error('followup_response_too_large'));return;}chunks.push(chunk);});
   res.on('error',reject);res.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:async()=>data});}catch(error){reject(error);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error('followup_sync_timeout')));req.on('error',reject);req.end(init.body);
 });
}
function createFollowupCloud({authorityManager,pilotId,pin,baseUrl='https://ga-proxy.einherjer.workers.dev/api/sync-v2/',transport=request,now=Date.now,log=()=>{}}) {
 let revision=null,busy=false,retryAt=0,failures=0;
 const client=sync.create({request:transport,baseUrl,pilotId,pin,getRevision:()=>revision,setRevision:value=>{revision=value;}});
 async function flush() {
  if(busy||now()<retryAt) return {status:'deferred'};
  busy=true;
  try {
   const entries=await authorityManager.getFollowupOutbox(pilotId);
   if(!entries.length) return {status:'empty'};
   for(let attempt=0;attempt<3;attempt++) {
    const loaded=await client.read();
    if(!loaded.migrated) throw Error('followup_requires_profile_v2');
    revision=loaded.revision;
    const incoming=entries.flatMap(entry=>entry.requests);
    const merged=mergeRequests(loaded.profile.followUpRequests||[],incoming,now());
    // Never ACK a still-valid offer discarded by the App's bounded request list.
    if(incoming.some(row=>Number(row.expiresAt)>now()&&!merged.some(item=>item.id===row.id))) throw Error('followup_profile_capacity');
    try {
     if(JSON.stringify(merged)!==JSON.stringify(loaded.profile.followUpRequests||[]))
      await client.write({...loaded.profile,followUpRequests:merged,lastModified:now()});
    } catch(error) {if(error.status===409&&attempt<2)continue;throw error;}
    for(const entry of entries) if(!await authorityManager.acknowledgeFollowupOutbox(entry.id,pilotId))throw Error('followup_ack_persist_failed');
    failures=0;retryAt=0;log(`MISSION_FOLLOWUP_SYNCED entries=${entries.length}`);return {status:'saved'};
   }
  } catch(error) {failures++;retryAt=now()+Math.min(300000,5000*2**Math.min(failures-1,6));log(`MISSION_FOLLOWUP_PENDING error=${error.message}`);return {status:'pending',error:error.message};}
  finally{busy=false;}
 }
 return {flush};
}
module.exports={createFollowupCloud};
