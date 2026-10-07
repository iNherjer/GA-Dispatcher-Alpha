(function(root){
 'use strict';
 async function generate(input,dependencies){
  const core=root.MissionBushNarrativeCore,f=core.frame(input);
  if(!f)return {plan:null,status:'no_onboard_story_speaker'};
  const keys=new Set();
  for(const t of [0.15,0.35,0.55,0.75,0.9]){
   const a=f.route[0],b=f.route[1];
   const p=core.routePoint(a,b,t);
   const key=dependencies.tileKey(p.lat,p.lon);keys.add(key);
  }
  // Geo anecdotes are optional: one slow tile must not hold the dispatch open.
  const features=[],budgetMs=Math.max(0,Math.min(3000,Number.isFinite(dependencies.tileBudgetMs)?dependencies.tileBudgetMs:3000));
  let closed=false,timer,completed=0;
  const pending=[...keys].map(async k=>{
   try{const value=await dependencies.tileFeatures(k);if(!closed&&Array.isArray(value))features.push(...value.slice(0,16000));}
   catch(_){}finally{if(!closed)completed++;}
  });
  try{await Promise.race([Promise.all(pending),new Promise(resolve=>{timer=setTimeout(resolve,budgetMs);})]);}
  finally{closed=true;clearTimeout(timer);}
  const tileStatus={requested:keys.size,completed,timedOut:keys.size-completed,budgetMs};
  f.anchors=core.anchors(features,f.route);
  const recent=core.history(dependencies.storage);
  const answer=await dependencies.request(core.prompt(f,recent));
  const plan=core.validate(answer?.parsed,f);
  return {plan,status:plan?'ready':'narrative_unavailable',anchorCount:f.anchors.length,tileStatus,source:answer?.source||'',error:answer?.error||''};
 }
 root.MissionBushNarrativeBrowser={generate};
})(typeof window!=='undefined'?window:globalThis);
