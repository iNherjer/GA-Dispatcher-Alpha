(function(root){
 'use strict';
 const cache=new Map(),inflight=new Map(),TTL=30*60*1000,MAX=12;
 async function load(start,target,options={}){
  const core=root.MissionEnvironmentCore,date=options.date||new Date(),fetcher=options.fetch||root.fetch.bind(root),timeoutMs=options.timeoutMs||4500;
  async function point(p){
   const loc=core.location(p);if(!loc)return {location:null,status:'unavailable',reason:'missing_coordinates'};
   const key=loc.lat+','+loc.lon;
   const now=date.getTime(),saved=cache.get(key);
   if(saved&&now>=saved.ts&&now-saved.ts<TTL)return {...saved.data,location:loc};
   if(inflight.has(key))return {...await inflight.get(key),location:loc};
   const task=(async()=>{
    const controller=new AbortController();let timer;
    try{
     const q=new URLSearchParams({latitude:loc.lat,longitude:loc.lon,hourly:Object.keys(core.fields).join(','),past_hours:72,forecast_hours:73,timezone:'UTC',wind_speed_unit:'kn',models:'best_match'});
     const operation=(async()=>{const response=await fetcher('https://api.open-meteo.com/v1/forecast?'+q,{signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);return core.summarize(await response.json(),p,date);})();
     const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},timeoutMs);});
     const data=await Promise.race([operation,deadline]);
     if(data.status==='available'){cache.delete(key);cache.set(key,{ts:now,data});while(cache.size>MAX)cache.delete(cache.keys().next().value);}
     return data;
    }catch(e){return {location:loc,status:'unavailable',reason:String(e.message||e).slice(0,120)};}
    finally{clearTimeout(timer);}
   })();
   inflight.set(key,task);try{return await task;}finally{inflight.delete(key);}
  }
  const rows=await Promise.all([point(start),point(target)]);
  return core.context(start,target,rows,date);
 }
 root.MissionEnvironmentBrowser={load};
})(typeof window!=='undefined'?window:globalThis);
