const CORS={'Access-Control-Allow-Origin':'*','Content-Type':'application/json; charset=utf-8'};
const clean=v=>String(v||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();
function pane(html,id){const match=html.match(new RegExp('<div\\b[^>]*class="tab-pane[^"\\n]*"[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)(?=<div\\b[^>]*class="tab-pane|$)','i'));return match?.[1]||'';}
function rows(html){return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1]).slice(0,500)).slice(0,2)).filter(r=>r.length===2&&r[0]&&r[1]);}
function coordinate(v){const m=v.match(/(\d+)-(\d+)-([\d.]+)\s*([NSEW])/i);return m?(Number(m[1])+Number(m[2])/60+Number(m[3])/3600)*(/[SW]/i.test(m[4])?-1:1):null;}
function dateISO(v){const m=v.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[1]+'-'+m[2]:null;}
export function parseFaaAirportHtml(html,ident,now=Date.now()){
 if(html.length>256000)throw new Error('upstream_body_too_large');
 const actual=html.match(/var\s+locationId\s*=\s*"([A-Z0-9]+)"/i)?.[1];if(actual!==ident)throw new Error('airport_identity_mismatch');
 const summary=rows(pane(html,'summary')),position=summary.find(r=>r[0]==='Latitude/Longitude')?.[1]?.split('/');const lat=coordinate(position?.[0]||''),lon=coordinate(position?.[1]||'');if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('airport_coordinates_missing');
 const cycle=clean(html.slice(0,html.indexOf('id="summary"'))).match(/Data Effective:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);const effectiveFrom=dateISO(cycle?.[1]||''),effectiveUntil=dateISO(cycle?.[2]||'');if(!effectiveFrom||!effectiveUntil)throw new Error('data_cycle_missing');
 if(now<Date.parse(effectiveFrom)||now>=Date.parse(effectiveUntil))throw new Error('data_cycle_not_current');
 const remarks=[...pane(html,'remarks').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m=>clean(m[1]).slice(0,500)).filter(Boolean).slice(0,30);
 const runwayIds=[...html.matchAll(/id="(runway_[^"]+)"/g)].map(m=>m[1]);
 return {ident,lat,lon,valid:true,sourceUrl:'https://nfdc.faa.gov/nfdcApps/services/ajv5/airportDisplay.jsp?airportId='+ident,effectiveFrom,effectiveUntil,fetchedAt:new Date(now).toISOString(),remarks,operations:rows(pane(html,'operations')).slice(0,20),communications:rows(pane(html,'communications')).slice(0,15),runways:runwayIds.slice(0,8).map(id=>({designator:id.slice(7).replace(/_/g,'/'),fields:rows(pane(html,id).split(/<h3/i)[0]).slice(0,15),ends:[...pane(html,id).matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)].map(m=>({end:clean(m[1]),fields:rows(m[2]).slice(0,20)}))}))};
}
export async function handleAirportContextFaa(request,{fetcher=fetch,cache=globalThis.caches?.default,timeoutMs=2500,now=Date.now(),waitUntil=null}={}){
 const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...CORS,'Cache-Control':status===200?'public, max-age=3600':'no-store'}});
 if(request.method!=='GET')return response({error:'method_not_allowed'},405);
 const raw=new URL(request.url).searchParams.get('ident')||'',ident=raw.trim().toUpperCase();if(!/^[A-Z0-9]{2,5}$/.test(ident))return response({error:'invalid_airport_identifier'},400);
 const key=new Request('https://ga-airport-context.invalid/faa/'+ident);let controller=new AbortController(),timer;
 try{
  const operation=(async()=>{
   const saved=await cache?.match(key);if(saved){const data=await saved.clone().json();if(data.effectiveFrom&&data.effectiveUntil&&now>=Date.parse(data.effectiveFrom)&&now<Date.parse(data.effectiveUntil))return data;}
   const r=await fetcher('https://nfdc.faa.gov/nfdcApps/services/ajv5/airportDisplay.jsp?airportId='+ident,{signal:controller.signal,redirect:'error'});if(!r.ok)throw new Error('upstream_http_'+r.status);
   const reader=r.body.getReader(),chunks=[];let bytes=0;try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>256000)throw new Error('upstream_body_too_large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const joined=new Uint8Array(bytes);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length;}return parseFaaAirportHtml(new TextDecoder().decode(joined),ident,now);
  })();
  const data=await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('upstream_timeout'));},timeoutMs);})]);
  const result=response(data);if(cache){const save=cache.put(key,result.clone()).catch(()=>{});if(waitUntil)waitUntil(save);}return result;
 }catch(e){return response({error:String(e.message||e).slice(0,100)},String(e.message).includes('timeout')?504:502);}
 finally{clearTimeout(timer);controller.abort();}
}
