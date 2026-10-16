'use strict';

// Spoken coaching is deliberately shorter than the detailed visual checklist.
// This module reads detector values; it never changes exercise criteria or phases.
const core = require('../mission-training-core.js').create({}, { now: () => 0 });
const finite = Number.isFinite;
const angle = (a,b) => Math.abs(((a-b+540)%360)-180);
function context(recipe,state) {
  const raw=state.checkpoint.procedureState.activeState;
  return {raw,a:raw.active,ex:core.normalizeExercise(recipe.trainingRecipe.exercises[raw.activeIndex]),sample:state.coaching?.sample||{}};
}
function memory(state) {
  return state.coaching.speech ||= {lastSpokenAt:null,lastFeedbackAt:null,lastCorrectionAt:null,lastKey:'',scope:'',candidate:'',since:0,corrected:false};
}
function mark(state,now) { memory(state).lastSpokenAt=now; }
function instruction(recipe,state,starting=false) {
  const {ex,a}=context(recipe,state);
  if(!ex)return 'Die Übungen sind abgeschlossen.';
  const direction=ex.direction==='left'?' nach links':ex.direction==='right'?' nach rechts':'';
  if(a && !starting) return phase(recipe,state) || (ex.type==='altitude_step_hold'
    ? 'Halte Kurs und Höhe stabil.' : ex.type==='stall_recovery'
      ? 'Arbeite ruhig weiter an der Stallübung.' : 'Führe die Kurve ruhig weiter und halte deine Höhe.');
  const maneuver=ex.type==='constant_bank_360'?`dem Vollkreis${direction}`:ex.type==='turn_180'?`der Kursumkehr${direction}`
    :ex.type==='altitude_step_hold'?'dem Geradeausflug':'der Stallübung';
  if(starting) return ex.type==='altitude_step_hold'?'Gut, halte jetzt Kurs und Höhe.'
    :ex.type==='stall_recovery'?'Gut, stabilisiere jetzt die Ausgangslage.'
      :`Gut, beginne jetzt mit ${maneuver}. Achte dabei auf deine Höhe.`;
  return `Als Nächstes beginnen wir mit ${maneuver}. Stabilisiere dich und starte über das Banner, sobald du bereit bist.`;
}
function phase(recipe,state) {
  const {ex,a}=context(recipe,state);
  if(!a||!ex)return '';
  if(ex.type==='turn_180'||ex.type==='constant_bank_360')return a.phase==='rollout'?'Jetzt sauber auf den Zielkurs ausleiten.':'';
  if(ex.type==='altitude_step_hold')return {
    hold_initial:'Halte Kurs und Höhe stabil.',
    altitude_change:ex.direction==='descent'?'Jetzt auf die Zielhöhe sinken. Halte dabei deinen Kurs.':'Jetzt auf die Zielhöhe steigen. Halte dabei deinen Kurs.',
    hold_final:'Zielhöhe erreicht. Halte Kurs und Höhe stabil.'
  }[a.phase]||'';
  return {stabilize:'Stabilisiere die Ausgangslage.',approach:'Jetzt langsam verzögern und die Höhe halten.',
    hold_to_break:'Das Abkippen abwarten.',recovery:'Abkippen erkannt. Anstellwinkel reduzieren und sauber abfangen.'}[a.phase]||'';
}
function notice(text) {
  if(!text)return '';
  if(/Sicherheitshöhe|mindestens.*AGL|Für die Einweisung/.test(text))return 'Für diese Übung brauchst du wieder mehr Höhe.';
  if(/pausiert/.test(text))return 'Training pausiert.';
  if(/Menü/.test(text))return 'Training pausiert. Kehre zum Flug zurück.';
  if(/am Boden/.test(text))return 'Das Training geht erst im Flug weiter.';
  if(/Flugdaten/.test(text))return 'Flugdaten unterbrochen. Bitte kurz warten.';
  if(/aktualisiert/.test(text))return 'Trainingsauswertung aktualisiert. Diesen Versuch bitte neu starten.';
  return 'Diesen Versuch setzen wir neu an. Stabilisiere die Ausgangslage.';
}
function deviation(recipe,state) {
  const {ex,a,sample:s}=context(recipe,state);
  if(!a||!ex)return null;
  const issue=(key,text)=>({key,text});
  const bank=Math.abs(s.bankDeg),heading=angle(s.hdg,a.startHeadingDeg);
  const height=(target,tolerance)=>finite(s.altFt)&&Math.abs(s.altFt-target)>tolerance
    ? issue('height',s.altFt>target?'Du steigst aus der Höhe. Korrigiere sanft.':'Du verlierst Höhe. Korrigiere sanft.') : null;
  if(ex.type==='turn_180'||ex.type==='constant_bank_360') {
    if(!['turning','rollout'].includes(a.phase))return null;
    if(finite(s.gForce)&&s.gForce>ex.maxG)return issue('g','Belastung reduzieren.');
    const altitude=height(a.startAltFt,ex.maxAltitudeDeltaFt);if(altitude)return altitude;
    if(a.phase==='rollout') {
      if(bank>ex.rolloutBankDeg)return issue('bank','Flügel waagerecht.');
      if(angle(s.hdg,a.targetHeadingDeg)>ex.rolloutHeadingToleranceDeg)return issue('heading','Den Zielkurs noch etwas korrigieren.');
    } else {
      if(state.coaching.turnDirectionGood===false)return issue('direction','Kurvenrichtung prüfen.');
      if(Math.abs(bank-ex.targetBankDeg)>ex.bankToleranceDeg)return issue('bank',bank>ex.targetBankDeg?'Etwas weniger Querneigung.':'Etwas mehr Querneigung.');
    }
  } else if(ex.type==='altitude_step_hold') {
    if(!['hold_initial','altitude_change','hold_final'].includes(a.phase))return null;
    if(a.phase!=='altitude_change') {
      const altitude=height(a.phase==='hold_final'?a.targetAltFt:a.startAltFt,ex.maxAltitudeDeltaFt);if(altitude)return altitude;
    }
    if(heading>ex.maxHeadingDeltaDeg)return issue('heading','Kurs halten.');
    if(bank>ex.maxBankDeg)return issue('bank','Flügel waagerecht.');
    if(finite(a.refIasKts)&&finite(s.iasKts)&&Math.abs(s.iasKts-a.refIasKts)>ex.speedToleranceKts)return issue('speed','Achte auf deine Geschwindigkeit.');
    if(a.phase==='altitude_change'&&Math.abs(s.altFt-a.targetAltFt)<=ex.maxAltitudeDeltaFt&&Math.abs(s.vsFpm)>350)return issue('leveloff','Jetzt auf der Zielhöhe abfangen.');
    if(a.phase==='altitude_change'&&Math.abs(s.vsFpm)>ex.maxVsFpm+250)return issue('vs',ex.direction==='descent'?'Sinkrate etwas reduzieren.':'Steigrate etwas reduzieren.');
  } else if(a.phase==='recovery') {
    if(s.stallState||(finite(s.aoaDeg)&&s.aoaDeg>ex.targetAoaDeg-2))return issue('stall','Anstellwinkel reduzieren.');
    if(bank>ex.maxRecoveryBankDeg)return issue('bank','Flügel waagerecht.');
    if(s.vsFpm<=-450)return issue('vs','Sinken abfangen.');
  } else {
    const altitude=height(a.startAltFt,a.phase==='stabilize'?60:ex.preBreakAltitudeToleranceFt);if(altitude)return altitude;
    const bankLimit=a.phase==='stabilize'?8:ex.maxBankBeforeBreakDeg+(a.phase==='hold_to_break'?12:0);
    if(bank>bankLimit)return issue('bank','Flügel waagerecht.');
    if(heading>(a.phase==='stabilize'?8:ex.maxHeadingDriftDeg))return issue('heading','Kurs halten.');
  }
  return null;
}
function feedback(recipe,state,now) {
  const {raw,a}=context(recipe,state),m=memory(state);
  if(!a)return '';
  const scope=`${raw.activeIndex}:${raw.exercises[raw.activeIndex]?.attempts}:${a.phase}`;
  if(m.scope!==scope){m.scope=scope;m.candidate='';m.since=now;m.corrected=false;}
  const bad=deviation(recipe,state),key=bad?.key||'good';
  if(m.candidate!==key){m.candidate=key;m.since=now;}
  // Short excursions stay silent; spoken corrections leave room to fly.
  if(now-m.since<3000 || (m.lastSpokenAt!=null&&now-m.lastSpokenAt<8000)
      || (m.lastFeedbackAt!=null&&now-m.lastFeedbackAt<30000))return '';
  if(bad) {
    if(m.lastKey===key&&m.lastCorrectionAt!=null&&now-m.lastCorrectionAt<60000)return '';
    m.lastKey=key;m.lastCorrectionAt=now;m.lastFeedbackAt=now;m.corrected=true;
    return bad.text;
  }
  if(m.corrected){m.corrected=false;m.lastKey='';m.lastFeedbackAt=now;return 'Passt wieder, so halten.';}
  return '';
}
module.exports={instruction,phase,notice,feedback,mark};
