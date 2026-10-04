// Shared display only: draws the search area and explicitly revealed findings.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionFireSearchMap=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const layers=new WeakMap();
function area(target,radiusNm){
 if(!target||!Number.isFinite(target.lat)||!Number.isFinite(target.lon)||Math.abs(target.lat)>90||Math.abs(target.lon)>180||!Number.isFinite(radiusNm)||radiusNm<=0||radiusNm>50)return null;
 return {center:{lat:target.lat,lon:target.lon},radiusM:radiusNm*1852};
}
function fromScenario(fs,phase){const spec=!['closing','closed'].includes(phase)&&fs?.enabled&&fs.type==='fire_watch'?area(fs.target,Number(fs.targetAreaNm||1.5)):null;return spec?{...spec,findings:fs.search?.findings||[]}:null;}
function fromControl(c){return c?.recipe==='poi'&&c.phase!=='closed'&&c.flags?.closed!==true?c.poiTask?.fireWatch?.searchArea||null:null;}
// Stable, smooth hand-drawn variation; no jitter on polling or session restore.
function waxPath(spec,offset=0,closed=false){
 const phase=(spec.center.lat*17+spec.center.lon*23)%6.283185307;
 const points=[],count=closed?144:156;
 for(let i=0;i<=count;i++){
  const angle=0.55+(closed?Math.PI*2:(Math.PI*2+0.52))*i/count-(closed?0:0.13);
  const wobble=0.012*Math.sin(3*angle+phase)+0.007*Math.sin(7*angle-phase)+0.003*Math.sin(13*angle+phase);
  const end=closed?0:0.014*Math.pow(Math.abs(i/count-0.5)*2,8);
  const distance=spec.radiusM*(1+wobble+offset+end)/6371008.8;
  const lat=spec.center.lat*Math.PI/180,lon=spec.center.lon*Math.PI/180;
  const nextLat=Math.asin(Math.sin(lat)*Math.cos(distance)+Math.cos(lat)*Math.sin(distance)*Math.cos(angle));
  const nextLon=lon+Math.atan2(Math.sin(angle)*Math.sin(distance)*Math.cos(lat),Math.cos(distance)-Math.sin(lat)*Math.sin(nextLat));
  points.push([nextLat*180/Math.PI,((nextLon*180/Math.PI+540)%360)-180]);
 }
 return points;
}
function render(map,L,spec){
 if(!map||!L)return;
 const valid=spec&&area(spec.center,spec.radiusM/1852),findings=(spec?.findings||[]).filter(p=>area(p,1)&&['smoke','heat_suspicion'].includes(p.kind)).map(p=>({id:p.id,lat:p.lat,lon:p.lon,kind:p.kind})),signature=JSON.stringify({valid,findings}),previous=layers.get(map);
 if(previous?.signature===signature)return;
 if(previous)map.removeLayer(previous.layer);
 layers.delete(map);
 if(!valid)return;
 const layer=L.layerGroup(),point=[valid.center.lat,valid.center.lon],label='Verdachts-Suchgebiet · '+(valid.radiusM/1852).toFixed(1).replace('.',',')+' NM Radius';
 L.polygon(waxPath(valid,0,true),{stroke:false,fillColor:'#e53935',fillOpacity:0.045,interactive:false}).addTo(layer);
 const options={interactive:false,lineCap:'round',lineJoin:'round',smoothFactor:0.3};
 L.polyline(waxPath(valid),{...options,color:'#d83430',weight:8,opacity:0.17}).addTo(layer);
 L.polyline(waxPath(valid,0.002),{...options,color:'#e53935',weight:3.8,opacity:0.85}).bindTooltip(label,{permanent:false}).addTo(layer);
 L.polyline(waxPath(valid,-0.002),{...options,color:'#b82023',weight:1.2,opacity:0.42,dashArray:'7,3,2,6'}).addTo(layer);
 L.polyline(waxPath(valid,0.002),{...options,color:'#ffd4bc',weight:0.9,opacity:0.55,dashArray:'1,9,2,13'}).addTo(layer);
 L.circleMarker(point,{radius:4,color:'#e53935',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).bindTooltip('Bezugspunkt des Suchgebiets',{permanent:false}).addTo(layer);
 for(const finding of findings){
  const latScale=111195,lonScale=111195*Math.cos(finding.lat*Math.PI/180),size=Math.max(35,Math.min(90,valid.radiusM*0.025));
  for(const direction of [-1,1]){
   const path=Array.from({length:13},(_,i)=>{const t=(i/12-0.5)*2;return [finding.lat+(t*size+Math.sin(i*0.7)*size*0.025)/latScale,finding.lon+(direction*t*size+Math.sin(i*0.9)*size*0.02)/lonScale];});
   L.polyline(path,{...options,color:'#d83430',weight:8,opacity:0.17}).addTo(layer);
   L.polyline(path,{...options,color:'#e53935',weight:3.8,opacity:0.9}).bindTooltip(finding.kind==='smoke'?'Rauchquelle erkannt':'Wärmeverdacht · Brand nicht bestätigt',{permanent:false}).addTo(layer);
   L.polyline(path,{...options,color:'#ffd4bc',weight:0.9,opacity:0.55,dashArray:'1,9,2,13'}).addTo(layer);
  }
 }
 layer.addTo(map);layers.set(map,{signature,layer});
}
return {area,fromScenario,fromControl,waxPath,render};
});
