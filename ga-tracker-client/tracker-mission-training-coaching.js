'use strict';

// Tracker-only pilot guidance. The extracted original detector still owns phases,
// exercise results and optional exercises. This layer fixes continuity, waiting
// limits and hold clocks and publishes the same criteria used by the banner.
const angle = (a,b) => Math.abs(((a-b+540)%360)-180);
const delta = (a,b) => ((b-a+540)%360)-180;
const hdg = value => String(Math.round((value+360)%360)%360).padStart(3,'0')+'°';
const finite = value => typeof value==='number' && Number.isFinite(value);
const raw = state => state.checkpoint.procedureState.activeState;
const exercise = (recipe,state) => recipe.trainingRecipe.exercises[raw(state).activeIndex];
function init(state) {
  return state.coaching ||= {reference:null,history:[],notice:'',lastAt:null,holdMs:0,holdGood:false,driftSince:null,
    phaseKey:'',lastProgressAt:null,bestProgress:null,lastFeedbackAt:0,lastFeedbackKey:'',pendingNotice:''};
}
function minimum(recipe,ex) { return ex?.type==='stall_recovery' ? Number(recipe.trainingRecipe.stallMinAglFt||2500) : Number(recipe.trainingRecipe.minAglFt||1200); }
function checks(recipe,state,sample) {
  const c=init(state), s=raw(state), ex=exercise(recipe,state), a=s.active;
  if(!ex || !c.reference) return null;
  const alt=a?.phase==='hold_final' || a?.phase==='altitude_change' ? a.targetAltFt : c.reference.altFt;
  const altTolerance=Number(ex.maxAltitudeDeltaFt||50), headingTolerance=Number(ex.maxHeadingDeltaDeg||5);
  return {ex,a,alt,altTolerance,headingTolerance,
    height:finite(sample.altFt)&&Math.abs(sample.altFt-alt)<=altTolerance,
    heading:finite(sample.hdg)&&angle(sample.hdg,c.reference.headingDeg)<=headingTolerance,
    bank:finite(sample.bankDeg)&&Math.abs(sample.bankDeg)<=Number(ex.maxBankDeg||8),
    speed:!finite(a?.refIasKts)||(finite(sample.iasKts)&&Math.abs(sample.iasKts-a.refIasKts)<=Number(ex.speedToleranceKts||7)),
    altitudeGate:finite(sample.aglFt)&&sample.aglFt>=minimum(recipe,ex),
    stable:finite(sample.vsFpm)&&Math.abs(sample.vsFpm)<=350};
}
function prepare(recipe,state,sample) {
  const c=init(state), s=raw(state), ex=exercise(recipe,state);
  if(!ex)return null;
  if (!c.reference && s.active) c.reference={exerciseId:ex.id,altFt:s.active.startAltFt,headingDeg:s.active.startHeadingDeg};
  const x=checks(recipe,state,sample), a=s.active, now=sample.observedAt;
  if(!finite(sample.hdg)||!finite(sample.bankDeg)||!finite(sample.vsFpm)||!finite(sample.aglFt)) return 'Flugdaten unvollständig. Durchgang unterbrochen; auf gültige Messwerte warten.';
  if(a && !x?.altitudeGate) return `Sicherheitshöhe unterschritten. Durchgang unterbrochen; mindestens ${minimum(recipe,ex)} ft AGL herstellen.`;
  if(!a && x && !(x.height&&x.heading&&x.bank&&x.stable&&x.altitudeGate)) {
    s.startAvailable=false;s.preStartStableSince=0;
    if(s.ready) s.ready=false;
  }
  if(!a) {c.lastAt=now;return null;}
  const key=`${ex.id}:${s.exercises[s.activeIndex].attempts}:${a.phase}`;
  if(c.phaseKey!==key){c.phaseKey=key;c.holdMs=0;c.holdGood=false;c.driftSince=null;c.lastProgressAt=now;c.bestProgress=null;c.phaseBeganAt=now;c.lastRolloutGood=null;}
  const dt=c.lastAt==null?0:Math.max(0,Math.min(5000,now-c.lastAt));c.lastAt=now;
  let good=true, metric=0, timeout=120000;
  if(['hold_initial','hold_final'].includes(a.phase)) {
    good=x.height&&x.heading&&x.bank&&x.speed;
    c.holdMs=good?(c.holdGood?c.holdMs+dt:0):0;c.holdGood=good;
    a.phaseStartedAt=now-c.holdMs;metric=c.holdMs;
  } else if(a.phase==='altitude_change') {
    good=x.heading&&x.bank&&x.speed&&Math.abs(sample.vsFpm)<=Number(ex.maxVsFpm||900)+250;
    metric=-Math.abs(sample.altFt-a.targetAltFt);
  } else if(a.phase==='entry') {timeout=45000;metric=Math.abs(sample.bankDeg);}
  else if(a.phase==='turning') {
    const directed=finite(a.prevHeadingDeg)?delta(a.prevHeadingDeg,sample.hdg)*a.direction:0;
    good=x.height&&Math.abs(Math.abs(sample.bankDeg)-Number(ex.targetBankDeg||30))<=Number(ex.bankToleranceDeg||6)
      && Number(sample.gForce||1)<=Number(ex.maxG||2.2)&&directed>=-0.5;
    // Reversals must undo travelled angle, not earn another positive arc later.
    if(directed<0)a.progressDeg=Math.max(0,a.progressDeg+directed);
    c.turnDirectionGood=directed>=-0.5 && (!ex.direction || ex.direction==='either' || (ex.direction==='left'?sample.bankDeg<0:sample.bankDeg>0));
    const target=ex.type==='turn_180'?180:360;
    if(a.progressDeg+Math.max(0,directed)>target+Number(ex.maxOvershootDeg||30))return 'Kurvenziel überschossen. Durchgang neu ansetzen und rechtzeitig ausleiten.';
    metric=a.progressDeg;timeout=45000;
    if(Array.isArray(a.turnRates)&&a.turnRates.length>600)a.turnRates=a.turnRates.slice(-600);
  } else if(a.phase==='rollout') {
    good=x.height&&angle(sample.hdg,a.targetHeadingDeg)<=Number(ex.rolloutHeadingToleranceDeg||6)&&Math.abs(sample.bankDeg)<=Number(ex.rolloutBankDeg||12);
    // Original rollout only checks heading/bank. Keep its stable clock from
    // awarding a pass while height is outside the published band.
    if(!good || c.lastRolloutGood===false)a.stableSince=0;
    c.lastRolloutGood=good;
    metric=-angle(sample.hdg,a.targetHeadingDeg);timeout=45000;
  } else if(a.phase==='stabilize') {metric=-Math.abs(sample.altFt-a.startAltFt)-angle(sample.hdg,a.startHeadingDeg);timeout=60000;}
  else if(a.phase==='approach') {metric=finite(sample.iasKts)?-sample.iasKts:sample.aoaDeg||0;}
  else if(a.phase==='hold_to_break') {metric=0;timeout=60000;}
  else if(a.phase==='recovery') {metric=0;timeout=60000;}
  if(!good){if(c.driftSince==null)c.driftSince=now;}else c.driftSince=null;
  if(c.driftSince!=null&&now-c.driftSince>=15000) return 'Sollwerte länger als 15 Sekunden verlassen. Diesen Durchgang neu ansetzen; abgeschlossene Übungen bleiben erhalten.';
  if(c.bestProgress==null||metric>c.bestProgress+0.5){c.bestProgress=metric;c.lastProgressAt=now;}
  if(now-c.phaseBeganAt>=600000)return 'Abschnitt dauert länger als zehn Minuten. Durchgang neu ansetzen; die bereits erfüllten Übungen bleiben erhalten.';
  if(now-c.lastProgressAt>=timeout)return 'Kein ausreichender Fortschritt in diesem Abschnitt. Durchgang neu ansetzen; im Banner stehen die benötigten Sollwerte.';
  return null;
}
function record(state,text,now) {
  if(!text)return;
  const c=init(state);c.history.push({at:now,text});c.history=c.history.slice(-30);
}
function after(recipe,state,sample,events) {
  const c=init(state),s=raw(state),ex=exercise(recipe,state);
  if(events.some(e=>e.type==='exercise_instruction')&&ex) {
    c.reference={exerciseId:ex.id,altFt:Math.round(sample.altFt/100)*100,headingDeg:Math.round(sample.hdg)%360};
    c.notice='';c.phaseKey='';c.turnDirectionGood=true;
  }
  if(events.some(e=>e.type==='exercise_started')&&s.active&&c.reference) {
    c.notice='';c.turnDirectionGood=true;
    const a=s.active;
    a.startAltFt=c.reference.altFt;a.startHeadingDeg=c.reference.headingDeg;
    a.targetHeadingDeg=(a.startHeadingDeg+(ex.type==='turn_180'?180:360))%360;
    if(ex.type==='altitude_step_hold')a.targetAltFt=a.startAltFt+(ex.direction==='descent'?-1:1)*Number(ex.altitudeStepFt||500);
  }
  const x=checks(recipe,state,sample);
  if(!s.active&&x&&!(x.height&&x.heading&&x.bank&&x.stable&&x.altitudeGate)) {
    s.startAvailable=false;s.preStartStableSince=0;
    events=events.filter(e=>e.type!=='training_start_available');
  }
  if(events.some(e=>e.type==='phase_started'))c.holdMs=0;
  c.sample=Object.fromEntries(['altFt','hdg','aglFt','bankDeg','vsFpm','iasKts','aoaDeg','stallState','pitchDeg','gForce','observedAt'].map(k=>[k,sample[k]??null]));
  return events;
}
function project(recipe,state) {
  const c=init(state),s=raw(state),ex=exercise(recipe,state),a=s.active,sample=c.sample||{};
  if(!ex || (s.requiredComplete&&!s.optionalRequested&&!a))return {visible:false,title:'Training abgeschlossen',rows:[],history:c.history,notice:c.notice,instruction:'Pflichtteil abgeschlossen. Rückkehr frei; verfügbare Zusatzübungen können im PAX-Menü angefragt werden.'};
  if(!c.reference || c.reference.exerciseId!==ex.id)return {visible:false,rows:[],history:c.history,notice:c.notice,instruction:`Mindestens ${recipe.trainingRecipe.minDepartureDistanceNm||5} NM vom Start entfernen und mindestens ${minimum(recipe,ex)} ft AGL erreichen. Dann folgt die Einweisung.`};
  const x=checks(recipe,state,sample),phase=a?.phase||'preparation',done=s.exercises[s.activeIndex]?.status==='complete';
  const rows=[];const row=(id,label,status,progress=0,detail='')=>rows.push({id,label,status,progress:Math.max(0,Math.min(1,progress)),detail});
  const completedOr=(yes)=>yes?'complete':'error';
  const preparing=!a;
  row('altitude',`Höhe ${c.reference.altFt} ft MSL · ±${x.altTolerance} ft`,preparing?completedOr(x.height):'complete',preparing&&x.height?1:0,`Aktuell ${Math.round(sample.altFt||0)} ft`);
  row('heading',`Kurs ${hdg(c.reference.headingDeg)} · ±${x.headingTolerance}°`,preparing?completedOr(x.heading):'complete',preparing&&x.heading?1:0,`Aktuell ${hdg(sample.hdg||0)}`);
  row('ready',`Flügel waagerecht, Vertikalgeschwindigkeit ≤350 ft/min · mindestens ${minimum(recipe,ex)} ft AGL`,a?'complete':s.startAvailable?'complete':x.bank&&x.stable&&x.altitudeGate?'active':'error',s.startAvailable||a?1:0,
    `${a?'Gestartet':s.startAvailable?'Bereit – Übung starten':'Drei Sekunden stabilisieren'} · Bank ${Math.round(sample.bankDeg||0)}° (max. ${ex.maxBankDeg||8}°), VS ${Math.round(sample.vsFpm||0)} ft/min, AGL ${Math.round(sample.aglFt||0)} ft`);
  let phaseLabel='Vorbereitung';
  const status=(current,past,ok=true)=>past?'complete':current?(ok?'active':'error'):'pending';
  const turn=ex.type==='turn_180'||ex.type==='constant_bank_360';
  if(turn) {
    const target=ex.type==='turn_180'?180:360;
    const direction=a?.direction===-1?'links':a?.direction===1?'rechts':ex.direction==='left'?'links':ex.direction==='right'?'rechts':'links oder rechts';
    const bankGood=finite(sample.bankDeg)&&Math.abs(Math.abs(sample.bankDeg)-Number(ex.targetBankDeg||30))<=Number(ex.bankToleranceDeg||6);
    row('turn',`${target}° ${direction} · Bank ${ex.targetBankDeg}° ±${ex.bankToleranceDeg||6}° · Höhe ±${x.altTolerance} ft · maximal ${ex.maxG} G`,status(['entry','turning'].includes(phase),phase==='rollout',x.height&&bankGood&&c.turnDirectionGood!==false&&Number(sample.gForce||1)<=ex.maxG),phase==='rollout'?1:(a?.progressDeg||0)/target,`${Math.round(a?.progressDeg||0)}° / ${target}° · Bank ${Math.round(sample.bankDeg||0)}°, Höhe ${Math.round(sample.altFt||0)} ft, ${Number(sample.gForce||1).toFixed(1)} G`);
    row('rollout',`Ausleiten auf ${hdg((c.reference.headingDeg+target)%360)} · ±${ex.rolloutHeadingToleranceDeg||6}°, Bank ≤${ex.rolloutBankDeg}°, Höhe ±${x.altTolerance} ft; ${ex.stableSec||4} s stabil`,status(phase==='rollout',done,x.height&&angle(sample.hdg||0,(c.reference.headingDeg+target)%360)<=Number(ex.rolloutHeadingToleranceDeg||6)&&Math.abs(sample.bankDeg||0)<=Number(ex.rolloutBankDeg||12)),a?.stableSince?((c.lastAt||0)-a.stableSince)/((ex.stableSec||4)*1000):0);
    phaseLabel={entry:'Kurve einleiten',turning:'Kurve fliegen',rollout:'Ausleiten'}[phase]||phaseLabel;
  } else if(ex.type==='altitude_step_hold') {
    const target=c.reference.altFt+(ex.direction==='descent'?-1:1)*Number(ex.altitudeStepFt||500);
    const speed=finite(a?.refIasKts)?`IAS ${Math.round(a.refIasKts)} ±${ex.speedToleranceKts} kt`:`Geschwindigkeit bei Übungsstart ±${ex.speedToleranceKts} kt halten`;
    const limits=`Kurs ${hdg(c.reference.headingDeg)} ±${x.headingTolerance}°, Bank ≤${ex.maxBankDeg}°, ${speed}`;
    const actual=`Höhe ${Math.round(sample.altFt||0)} ft · Kurs ${hdg(sample.hdg||0)} · Bank ${Math.round(sample.bankDeg||0)}° · IAS ${finite(sample.iasKts)?Math.round(sample.iasKts)+' kt':'nicht verfügbar'} · VS ${Math.round(sample.vsFpm||0)} ft/min`;
    row('hold_initial',`${ex.holdSec} s auf ${c.reference.altFt} ft ±${x.altTolerance} ft halten · ${limits}`,status(phase==='hold_initial',['altitude_change','hold_final'].includes(phase),x.height&&x.heading&&x.bank&&x.speed),phase==='hold_initial'?c.holdMs/(ex.holdSec*1000):['altitude_change','hold_final'].includes(phase)?1:0,phase==='hold_initial'?`${Math.round(c.holdMs/1000)} / ${ex.holdSec} s · ${actual}`:['altitude_change','hold_final'].includes(phase)?'Erfüllt':'');
    row('altitude_change',`${ex.direction==='descent'?'Sinken':'Steigen'} auf ${target} ft MSL · VS maximal ${Number(ex.maxVsFpm)+250} ft/min · am Ziel ≤350 ft/min für ${ex.stableSec} s · ${limits}`,status(phase==='altitude_change',phase==='hold_final',x.heading&&x.bank&&x.speed&&Math.abs(sample.vsFpm)<=Number(ex.maxVsFpm||900)+250),phase==='hold_final'?1:phase==='altitude_change'?1-Math.abs((sample.altFt||0)-target)/ex.altitudeStepFt:0,actual);
    row('hold_final',`${ex.holdSec} s auf ${target} ft MSL · ±${x.altTolerance} ft halten · ${limits}`,status(phase==='hold_final',done,x.height&&x.heading&&x.bank&&x.speed),phase==='hold_final'?c.holdMs/(ex.holdSec*1000):0,phase==='hold_final'?`${Math.round(c.holdMs/1000)} / ${ex.holdSec} s · ${actual}`:'');
    phaseLabel={hold_initial:'Ausgangslage halten',altitude_change:'Höhenwechsel',hold_final:'Neue Höhe halten'}[phase]||phaseLabel;
  } else {
    const stages=['stabilize','approach','hold_to_break','recovery'],i=stages.indexOf(phase);
    const altDev=Math.abs((sample.altFt||0)-c.reference.altFt), headingDev=angle(sample.hdg||0,c.reference.headingDeg), bank=Math.abs(sample.bankDeg||0);
    const valid=[altDev<=60&&headingDev<=8&&bank<=8,
      altDev<=Number(ex.preBreakAltitudeToleranceFt||100)&&headingDev<=Number(ex.maxHeadingDriftDeg||15)&&bank<=Number(ex.maxBankBeforeBreakDeg||15),
      altDev<=Number(ex.preBreakAltitudeToleranceFt||100)&&headingDev<=Number(ex.maxHeadingDriftDeg||15)&&bank<=Number(ex.maxBankBeforeBreakDeg||15)+12,
      !sample.stallState&&(!finite(sample.aoaDeg)||sample.aoaDeg<=Number(ex.targetAoaDeg||12)-2)&&bank<=Number(ex.maxRecoveryBankDeg||12)&&sample.vsFpm>-250];
    [`Ausgangslage ${ex.setupStableSec} s stabilisieren · Höhe ±60 ft, Kurs ±8°, Bank ≤8°`,
      `Stall annähern · Höhe ±${ex.preBreakAltitudeToleranceFt} ft, Kurs ±${ex.maxHeadingDriftDeg}°, Bank ≤${ex.maxBankBeforeBreakDeg}° halten`,
      `Bis zum erkannten Break halten · Höhe ±${ex.preBreakAltitudeToleranceFt} ft, Kurs ±${ex.maxHeadingDriftDeg}°, Bank ≤${Number(ex.maxBankBeforeBreakDeg)+12}°`,
      `Recovery · Bank ≤${ex.maxRecoveryBankDeg}°, Stallwarnung beenden${finite(sample.aoaDeg)?`, AOA ≤${Number(ex.targetAoaDeg)-2}°`:''}, Sinkrate unter 250 ft/min · ${ex.recoveryStableSec} s stabil`]
      .forEach((label,j)=>{
        const stableSec=j===0?ex.setupStableSec:j===3?ex.recoveryStableSec:null;
        const elapsed=i===j&&valid[j]&&a?.stableSince?Math.max(0,(Number(sample.observedAt)-a.stableSince)/1000):0;
        const detail=`Höhe ${Math.round(sample.altFt||0)} ft · Kurs ${hdg(sample.hdg||0)} · Bank ${Math.round(sample.bankDeg||0)}° · VS ${Math.round(sample.vsFpm||0)} ft/min${finite(sample.aoaDeg)?` · AOA ${sample.aoaDeg.toFixed(1)}°`:''}${j===3?` · Stallwarnung ${sample.stallState?'aktiv':'aus'}`:''}`;
        row(stages[j],label,status(i===j,i>j,valid[j]),i>j?1:stableSec?elapsed/stableSec:0,
          i===j?`${stableSec?`${Math.round(elapsed)} / ${stableSec} s · `:''}${detail}`:'');
      });
    phaseLabel=['Stabilisieren','Stall annähern','Break abwarten','Recovery'][i]||phaseLabel;
  }
  if(c.notice&&!a) for(const r of rows)if(!['altitude','heading','ready'].includes(r.id))r.status='error';
  if(c.suspended) for(const r of rows)if(r.status!=='pending')r.status='error';
  const activeRow=rows.find(r=>r.status==='active'||r.status==='error');
  const instruction=`${ex.label}. ${rows.map((r,i)=>`${i+1}. ${r.label}`).join(' ')} ${preparing?'Erst stabilisieren, dann Übung starten.':''}`;
  return {visible:true,title:ex.label,phaseLabel,attempt:(s.exercises[s.activeIndex]?.attempts||0)+(a?0:1),rows,
    notice:c.notice||((s.exercises[s.activeIndex]?.attempts||0)>=Number(ex.maxAttempts||4)?'Mehrere Versuche: Anweisung erneut lesen. Bei Bedarf Durchgang abbrechen und in Ruhe neu ansetzen.':'')||(!x.altitudeGate?`Mindestens ${minimum(recipe,ex)} ft AGL erforderlich.`:''),instruction,
    currentInstruction:`${phaseLabel}. ${activeRow?.label||'Abschnitt abgeschlossen.'}`,history:c.history,canRepeat:true};
}
module.exports={init,prepare,after,project,record,minimum,checks};
