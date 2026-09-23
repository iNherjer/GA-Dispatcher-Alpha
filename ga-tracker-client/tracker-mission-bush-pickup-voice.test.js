'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { extractOriginalFunction } = require('../tools/extract-original-function.mjs');
const voice = require('../mission-bush-pickup-voice-core.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'passenger-voice.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'mission-runtime-core.js'), 'utf8');
const pickupKind = { bush_pickup_strip: 'passenger', bush_pickup_cargo: 'cargo' };
function fixture(kind = 'passenger') {
  const profileId = kind === 'passenger' ? 'bush_pickup_strip' : 'bush_pickup_cargo';
  const bush = { profileId, targetMode: 'strip_then_return', completionMode: 'return_home', requiresReturnHome: true,
    pickupKind: kind, allowedEndLocations: ['home'], targetRef: {lat:47,lon:11,name:'Remote Strip'},
    homeRef: {lat:48,lon:11,name:'Home Base'}, pickupLabel:'Radio relay case', pickupStory:{
      personName:'Ava Reed', role:'Rangerin', exactWhere:'am Treffpunkt beim Hangar', whyThere:'hat Funkgeräte geprüft',
      returnReason:'die Basis braucht die Prüfnotizen', boardingCue:'Die Funkgeräte sind wieder ruhig.', departureCue:'Ich habe die Liste dabei.'} };
  const contract = { bush, summary:'Remote pickup and return' };
  const passenger = {name:'Ava Reed',role:'Rangerin',gender:'female',taskDomain:'bush_pickup_return',urgencyPriority:'normal'};
  const context = { schema:voice.SCHEMA,version:1,missionId:'pickup-1',pickupKind:kind,targetMode:bush.targetMode,
    requiresReturnHome:true,bush,contract,missionData:{missionId:'pickup-1',start:'Remote Strip',dest:'Home Base',dist:37,story:'Ranger work and radio check.'},
    passenger:kind==='passenger'?passenger:null,
    cargoContext:kind==='cargo'?{start:'Remote Strip',dest:'Home Base',dist:'37',paxText:'0 PAX',cargoText:'Radio relay case',
      story:'Bring the relay case back.',contractSummary:'Remote pickup and return',taskDomain:'bush_pickup_return'}:null,
    baseContext:'ROLLE: Ava Reed (Rangerin)\nAUFTRAG: Bush pickup return',toneHint:' ORIGINAL TONE',
    speaker:kind==='passenger'?passenger:{name:'Lademeister',role:'Lademeister',gender:'male',taskDomain:'bush_pickup_return'},
    storyData:{personName:'Ava Reed',role:'Rangerin',exactWhere:'am Treffpunkt beim Hangar',whyThere:'hat Funkgeräte geprüft',
      returnReason:'die Basis braucht die Prüfnotizen',boardingCue:'Die Funkgeräte sind wieder ruhig.',departureCue:'Ich habe die Liste dabei.',homePlace:'Home Base'},
    storyAnchorLine:'STORY-ANKER: Ava Reed | Treffpunkt=am Treffpunkt beim Hangar',betweenFlightsLine:'FOLLOW-UP-ZWISCHENZEIT: Arbeit draußen',
    cargoLabel:'Radio relay case',cargoFollowUpLine:'FOLLOW-UP-CARGO-STORY: supply return',weatherText:'Wetter: Wind 4 kts.',charterContinuation:false };
  return context;
}
function originalPrompt(context, stage, previous = {}, weatherText = '') {
  const picked = context.pickupKind === 'passenger';
  const functions = [
    '_bushPickupStageProgression','_bushPickupNarrativeHint','_captureBushPickupNarrativeMemory',
    '_bushCargoPickupNarrativeHint','_captureBushCargoPickupNarrativeMemory',
    '_activeBushPickupPassengerContract','_activeBushPickupCargoContract',
    '_pickupBoardingPrompt','_pickupDeparturePrompt','_pickupCargoBoardingPrompt','_pickupCargoDeparturePrompt'
  ].map(name => extractOriginalFunction(source, name)).join('\n');
  const memory = voice.normalizeMemory(previous), contract = context.contract;
  const window = {activePassenger:context.passenger,activeMissionContract:contract,currentMissionData:context.missionData};
  const localStorage = {getItem:()=>JSON.stringify(contract)};
  const currentMissionData = {...context.missionData,missionContract:contract,bush:context.bush};
  const _baseContext=()=>context.baseContext, _toneHint=()=>context.toneHint, _weatherContext=()=>weatherText;
  const _bushPickupNarrativeMemory=memory.passenger, _bushCargoPickupNarrativeMemory=memory.cargo;
  const _bushPickupStoryData=()=>context.storyData, _bushPickupStoryAnchorLine=()=>context.storyAnchorLine;
  const _bushPickupBetweenFlightsLine=()=>context.betweenFlightsLine, _bushCargoPickupLabel=()=>context.cargoLabel;
  const _bushCargoPickupFollowUpLine=()=>context.cargoFollowUpLine, _cargoOnlyVoiceContext=()=>context.cargoContext;
  const _normUrgencyPriority=()=> 'normal';
  const sandbox = vm.createContext({window,localStorage,currentMissionData,_baseContext,_toneHint,_weatherContext,
    _bushPickupNarrativeMemory,_bushCargoPickupNarrativeMemory,_bushPickupStoryData,_bushPickupStoryAnchorLine,
    _bushPickupBetweenFlightsLine,_bushCargoPickupLabel,_bushCargoPickupFollowUpLine,_cargoOnlyVoiceContext,
    _normUrgencyPriority,_poiMemoryCompact:t=>String(t).replace(/\s+/g,' ').trim().slice(0,180)});
  vm.runInContext(functions, sandbox);
  const name = picked ? (stage === 'pickup_boarding' ? '_pickupBoardingPrompt' : '_pickupDeparturePrompt')
    : (stage === 'cargo_pickup_boarding' ? '_pickupCargoBoardingPrompt' : '_pickupCargoDeparturePrompt');
  return vm.runInContext(`${name}()`,sandbox);
}

for (const [kind, stages] of [['passenger',['pickup_boarding','pickup_departure']],['cargo',['cargo_pickup_boarding','cargo_pickup_departure']]]) {
  for (const stage of stages) test(`${kind} ${stage} prompt equals original App builder`, () => {
    const context=fixture(kind), weatherText='Wetter: Wind 4 kts.';
    const rendered=voice.render(context,{stage,weatherText,previous:{}});
    assert.equal(rendered.prompt,originalPrompt(context,stage,{},weatherText));
    assert.equal(rendered.speaker,context.speaker);
  });
}

test('pickup prompt memory progresses from boarding to departure and farewell hint', () => {
  const context=fixture('passenger');
  const boarding=voice.render(context,{stage:'pickup_boarding',spokenText:'Die Funkgeräte sind ruhig. Ich habe die Liste.'});
  assert.equal(boarding.memory.passenger.boarding,'Die Funkgeräte sind ruhig. Ich habe die Liste.');
  const departure=voice.render(context,{stage:'pickup_departure',previous:boarding.memory,spokenText:'Die Liste liegt sicher im Rucksack.'});
  assert.equal(departure.memory.passenger.departure,'Die Liste liegt sicher im Rucksack.');
  assert.match(voice.continuityHint(context,departure.memory,'farewell'),/Die Funkgeräte sind ruhig\./);
  assert.match(voice.continuityHint(context,departure.memory,'farewell'),/Die Liste liegt sicher im Rucksack\./);
});

test('cargo pickup memory remains separate from passenger memory', () => {
  const context=fixture('cargo');
  const pickup=voice.render(context,{stage:'cargo_pickup_boarding',spokenText:'Der Funkkoffer ist gesichert.'});
  assert.equal(pickup.memory.cargo.boarding,'Der Funkkoffer ist gesichert.');
  assert.equal(pickup.memory.passenger.boarding,'');
  const departure=voice.render(context,{stage:'cargo_pickup_departure',previous:pickup.memory,spokenText:'Die Basis kann ihn prüfen.'});
  assert.equal(departure.memory.cargo.departure,'Die Basis kann ihn prüfen.');
  assert.match(voice.continuityHint(context,departure.memory,'farewell'),/Funkkoffer ist gesichert/);
});

test('voice outcome memory uses original passenger and cargo capture rules', () => {
  const passenger = fixture('passenger');
  const passengerMemory = voice.captureMemory(passenger, {}, 'pickup_boarding', 'Äh, Die Funkgeräte sind ruhig.');
  assert.equal(passengerMemory.passenger.boarding, 'Äh, Die Funkgeräte sind ruhig.');
  const cargo = fixture('cargo');
  const cargoMemory = voice.captureMemory(cargo, {}, 'cargo_pickup_departure', 'Die Kiste ist sicher verstaut.');
  assert.equal(cargoMemory.cargo.departure, 'Die Kiste ist sicher verstaut.');
  assert.equal(cargoMemory.passenger.boarding, '');
});

test('Bush voice core publishes a browser global and CommonJS API', () => {
  const browser = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'mission-bush-pickup-voice-core.js'), 'utf8'), { globalThis: browser });
  assert.equal(browser.GAMissionBushPickupVoiceCore.SCHEMA, voice.SCHEMA);
});

test('original pickup departure arming and airborne thresholds are preserved', () => {
  const pending={kind:'passenger',armedAt:1000};
  assert.equal(voice.evaluateDeparture(pending,{onGround:false,aglFt:20,gsKts:30},2000).triggered,false);
  assert.equal(voice.evaluateDeparture(pending,{onGround:false,aglFt:20,gsKts:30},2600).triggered,true);
  assert.equal(voice.evaluateDeparture({...pending,kind:'cargo'},{onGround:false,aglFt:13,gsKts:25},2600,'cargo').triggered,true);
  assert.equal(voice.evaluateDeparture(pending,{onGround:true,aglFt:60,gsKts:0},2600).triggered,true);
  assert.equal(voice.evaluateDeparture(pending,{gsKts:45},2600).triggered,true);
});

test('context validation keeps strip-target, recon, wrong pickup kind and mismatched identity closed', () => {
  const context=fixture('passenger');
  assert.equal(voice.validateContext(context),null);
  assert.equal(voice.validateContext({...context,missionId:'other'},'pickup-1'),'bush_pickup_voice_context_identity_invalid');
  assert.equal(voice.validateContext({...context,targetMode:'strip'}),'bush_pickup_voice_context_invalid');
  assert.equal(voice.validateContext({...context,bush:{...context.bush,profileId:'bush_recon_return',pickupKind:'passenger'}}),'bush_pickup_voice_context_invalid');
  assert.equal(voice.validateContext({...context,pickupKind:'cargo'}),'bush_pickup_voice_context_invalid');
});

test('Pickup live weather context is extracted from the original App helper', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractOriginalFunction(source, '_weatherContext'), context);
  for (const sample of [null, {}, {windKts:22,windDeg:270,windGustKts:30,tempC:9,visKm:2,precipRateMmH:5,inCloud:true,turbulencePct:70}, {windGustKts:8,visKm:30,precipActive:true}]) {
    assert.equal(voice.weatherContext(sample), context._weatherContext(sample));
  }
});
