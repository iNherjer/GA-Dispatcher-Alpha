// Run with the repository's Electron binary. No external requests or API keys.
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync('tools/fixtures/arrival-edtf-osm-20261017.json','utf8'));
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
let id=-1;const nodes=[],ways=[];
for(const el of fixture.elements){
 const tags=Object.entries(el.tags||{}).map(([k,v])=>`<tag k="${escape(k)}" v="${escape(v)}"/>`).join('');
 if(el.type==='node'){nodes.push(`<node id="${el.id}" lat="${el.lat}" lon="${el.lon}">${tags}</node>`);continue;}
 const refs=(el.geometry||[]).map(p=>{const ref=id--;nodes.push(`<node id="${ref}" lat="${p.lat}" lon="${p.lon}"/>`);return `<nd ref="${ref}"/>`;}).join('');
 ways.push(`<way id="${el.id}">${refs}${tags}</way>`);
}
const xml=`<osm version="0.6">${nodes.join('')}${ways.join('')}</osm>`;
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/core.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('mission-arrival-core.js'));return;}
  if(req.url==='/map.xml'){res.setHeader('Content-Type','application/xml');res.end(xml);return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script src="/core.js"></script>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(base)}));
 const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 await win.loadURL(base);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  let calls=0;const requests=[],original=window.fetch.bind(window);
  window.fetch=async(url,options)=>{calls++;requests.push(String(url));
   if(String(url).includes('overpass'))return{ok:false,status:503};
   if(String(url).includes('api.openstreetmap.org'))return original('/map.xml',options);
   throw Error('unexpected URL');};
  window.normalizeAptArrivalRole=()=>({role:'media_pickup',personRole:'person.ground_crew',vehicleRole:'vehicle.van',equipmentRole:'cargo.camera_equipment'});
  window.normalizeMissionType=()=> 'apt';
  const plan=buildAptArrivalPlan({dest:{lat:48.0227775574,lon:7.8324999809,icao:'EDTF'},heading:237});
  const start=performance.now(),ctx=await fetchAptArrivalGeoContext(plan);
  if(!ctx||ctx.source!=='osm-map')throw Error('OSM map fallback failed');
  const again=await fetchAptArrivalGeoContext(plan);
  if(calls!==2||again.fetchedAt!==ctx.fetchedAt)throw Error('OSM cache not reused');
  const resolved=await resolveAptArrivalPlanPlacement(plan);
  if(!resolved.snapStatus.spawnAllowed||aptArrivalFinalPlacementIssues(resolved).length)throw Error('invalid resolved scene');
  let rejected=false;try{aptArrivalParseOsmMapXml('<osm><bad></osm>');}catch{rejected=true;}
  if(!rejected)throw Error('malformed XML accepted');
  const strip=await fetchAptArrivalGeoContext({...plan,role:'bush_strip_pickup'});
  const airportAgain=await fetchAptArrivalGeoContext(plan);
  if(!strip.stripHandoff||airportAgain.stripHandoff||calls!==4)throw Error('strip/airport cache isolation failed');
  return{source:ctx.source,aprons:ctx.aprons.length,surfaces:ctx.surfaces.length,blockers:ctx.avoidZones.length,
    selected:{lat:resolved.lat,lon:resolved.lon,source:resolved.source},
    candidateCounts:Object.fromEntries(Object.entries(resolved.placementCandidates).map(([k,v])=>[k,v.length])),
    elapsedMs:Math.round(performance.now()-start),calls};
 })()`);
 assert.equal(result.aprons,4);assert.ok(result.candidateCounts.surface>0);assert.equal(result.calls,4);
 fs.writeFileSync('/tmp/ga-arrival-composer-browser-proof.json',JSON.stringify(result,null,2));
 console.log('PASS actual browser DOMParser, OSM fallback after Overpass failure, cache reuse and full Freiburg scene placement:',JSON.stringify(result));
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
