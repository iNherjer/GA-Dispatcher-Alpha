'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const runtime=require('./tracker-mission-training-runtime.js');
const speech=require('./tracker-mission-training-speech.js');
const core=require('../mission-training-core.js').create({}, {now:()=>0});
const {bundle}=require('./tracker-mission-training-fixture.js');
function harness(exercises,mode='POI',domain='training') {
  const recipe=structuredClone(bundle().executionPoiRecipe);
  recipe.missionMode=mode;recipe.taskDomain=domain;
  recipe.trainingRecipe=core.normalizeRecipe({key:'speech-test',requiredCount:1,exercises});
  recipe.voiceContext.trainingRecipe=recipe.trainingRecipe;
  recipe.voiceContext.passenger.trainingRecipe=recipe.trainingRecipe;
  let state=runtime.createState(recipe),now=10000;
  const records=[];
  const capture=result=>{
    for(const voice of result.voices||[])if(voice.resolvedRecipe.fallbackText)records.push({at:now,text:voice.resolvedRecipe.fallbackText,voice});
    return result;
  };
  const observe=(patch={},dt=1000)=>{
    now+=dt;const result=runtime.observe(recipe,state,{observedAt:now,lat:48.3,lon:8.5,
      altFt:3000,aglFt:3000,hdg:90,bankDeg:0,vsFpm:0,iasKts:90,gsKts:90,gForce:1.1,onGround:false,...patch});
    state=result.state;return capture(result);
  };
  const action=intent=>{const result=runtime.action(recipe,state,intent,++now);state=result.state;return capture(result);};
  return {recipe,records,observe,action,restore(){state=runtime.createState(recipe,structuredClone(state));},
    get state(){return state;},get now(){return now;},get raw(){return state.checkpoint.procedureState.activeState;}};
}
function brief(text) {
  assert.ok(text.length<=200,text);
  assert.ok(text.split(/[.!?]+/).filter(s=>s.trim()).length<=2,text);
  assert.doesNotMatch(text,/\d|±|\b(?:ft|kt|AGL|MSL)\b|Querneigung.*Höhe.*Kurs.*IAS/i);
}
function start(h){h.observe();h.observe({},3100);h.action('training_ready');}

for(const mode of ['POI','APT'])for(const domain of ['training','club_training_basic','club_training_advanced'])
for(const [type,label] of [['constant_bank_360','Vollkreis'],['turn_180','Kursumkehr'],['altitude_step_hold','Geradeausflug'],['stall_recovery','Stallübung']]) {
  test(`${mode}/${domain} ${type} speaks briefly and keeps the full checklist visible`,()=>{
    const h=harness([{id:'exercise',type,label:'Custom 999 ft and 45 degrees'}],mode,domain);
    h.observe();assert.match(h.records[0].text,new RegExp(label));
    assert.match(h.state.guidance.instruction,/1\./);
    const plan=h.state.guidance.instruction;
    h.observe({},3100);assert.equal(h.records.length,1,'no separate readiness ping');
    h.action('training_ready');h.restore();h.action('training_repeat_instruction');
    for(const r of h.records)brief(r.text);
    assert.ok(h.state.guidance.rows.length>=5);
    assert.ok(plan.length>h.records[0].text.length);
    assert.ok(h.records.every(r=>r.voice.trainingScope));
  });
}

for(const bank of [30,45])test(`a correct ${bank}-degree full circle has no continuous parameter or praise chatter`,()=>{
  const h=harness([{id:'circle',type:'constant_bank_360',targetBankDeg:bank}]);start(h);
  assert.equal(h.records.at(-1).text,'Gut, beginne jetzt mit dem Vollkreis. Achte dabei auf deine Höhe.');
  for(let arc=3;arc<=360;arc+=3)h.observe({hdg:(90+arc)%360,bankDeg:-bank});
  for(let i=0;i<6;i++)h.observe({hdg:90});
  assert.equal(h.state.progress.requiredComplete,true);
  assert.ok(h.records.length<=5,JSON.stringify(h.records.map(r=>r.text)));
  assert.ok(h.records.some(r=>r.text==='Gleich ausleiten.'));
  assert.ok(h.records.some(r=>/Zielkurs ausleiten/.test(r.text)));
  assert.ok(h.records.every(r=>!/Werte passen|Passt wieder|Korrektur:/.test(r.text)));
  h.records.forEach(r=>brief(r.text));
});

test('brief excursions stay silent and one correction produces only one recovery acknowledgement after restore',()=>{
  const h=harness([{id:'hold',type:'altitude_step_hold',holdSec:180}]);start(h);h.records.length=0;
  h.observe({altFt:3150});h.observe();
  for(let i=0;i<12;i++)h.observe();assert.equal(h.records.length,0);
  for(let i=0;i<12;i++)h.observe({altFt:3150,bankDeg:11});
  assert.equal(h.records.length,1);assert.match(h.records[0].text,/steigst aus der Höhe/);
  assert.doesNotMatch(h.records[0].text,/Querneigung|IAS|Kurs/,'only the primary error is spoken');
  h.restore();
  for(let i=0;i<55;i++)h.observe();
  assert.equal(h.records.length,2);
  assert.equal(h.records[1].text,'Passt wieder, so halten.');
  assert.ok(h.records[1].at-h.records[0].at>=30000);
  h.records.forEach(r=>brief(r.text));
});

test('an unchanged deviation is repeated at most once per minute across restore',()=>{
  const h=harness([{id:'hold',type:'altitude_step_hold',holdSec:180,valueDeviationGraceSec:120}]);start(h);h.records.length=0;
  for(let i=0;i<95;i++){h.observe({altFt:3150});if(i===35)h.restore();}
  assert.equal(h.records.length,2);
  assert.ok(h.records[1].at-h.records[0].at>=60000);
  assert.ok(h.raw.active,'speech throttling does not change the detector grace period');
});

test('a new correction waits for the feedback pause rather than reading all errors',()=>{
  const h=harness([{id:'hold',type:'altitude_step_hold',holdSec:180}]);start(h);h.records.length=0;
  for(let i=0;i<12;i++)h.observe({altFt:3150});
  h.observe();
  for(let i=0;i<29;i++)h.observe({iasKts:101});
  assert.equal(h.records.length,2);
  assert.match(h.records[1].text,/Geschwindigkeit/);
  assert.ok(h.records[1].at-h.records[0].at>=30000);
});

test('bank feedback names only the needed correction',()=>{
  const h=harness([{id:'circle',type:'constant_bank_360'}]);start(h);h.records.length=0;
  for(let i=1;i<=12;i++)h.observe({hdg:90+i,bankDeg:-42});
  assert.equal(h.records.length,1);
  assert.equal(h.records[0].text,'Etwas weniger Querneigung.');
});

test('the spoken status cannot change the detector or replace visible numeric criteria',()=>{
  const h=harness([{id:'step',type:'altitude_step_hold',holdSec:180}]);start(h);
  const checkpoint=structuredClone(h.state.checkpoint);
  const guidance=structuredClone(h.state.guidance.rows);
  speech.instruction(h.recipe,h.state);speech.feedback(h.recipe,h.state,h.now+5000);
  assert.deepEqual(h.state.checkpoint,checkpoint);
  assert.deepEqual(h.state.guidance.rows,guidance);
  assert.match(h.state.guidance.instruction,/±100 ft.*±10°/);
});

test('safety interruption remains audible and detailed in the banner without reciting numbers',()=>{
  const h=harness([{id:'circle',type:'constant_bank_360'}]);start(h);h.records.length=0;
  h.observe({aglFt:1199});
  assert.equal(h.raw.active,null);
  assert.equal(h.records.length,1);
  assert.match(h.records[0].text,/mehr Höhe/);brief(h.records[0].text);
  assert.match(h.state.guidance.notice,/1200 ft AGL/);
});
