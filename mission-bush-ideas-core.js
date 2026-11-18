/* Bush idea contract: the Bush planner's person/story plan becomes a validated idea (bush-idea.v1).
 * The existing planner and writer prompts stay unchanged; the idea is the authority for person and
 * story, so later code steps must not replace it with list candidates or text templates.
 * Narrative data only: Bush spec, manifest, pickup phases, recon plan and runtime stay code-owned.
 * Testschalter: localStorage ga_bush_idea_v1 = 'off' schaltet zurück auf den alten Weg (Standard an seit 18.11.2026). */
(function(root){
'use strict';
const VERSION='bush-idea.v1', FLAG='ga_bush_idea_v1';
const PROFILES=['bush_supply_strip','bush_charter_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo','bush_recon_return'];
const FRAME_FIELDS=['subjectDetail','incidentContext','whyNow','soughtOutcome'];
const OPTIONAL_FRAME_FIELDS=['trigger','focusSubject','keyQuestion','stakes','completionSignal'];
const PICKUP_FIELDS=['exactWhere','whyThere','returnReason','boardingCue','departureCue'];
const text=(value,max=900)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():'';

function enabled(storage){try{return String(storage?.getItem?.(FLAG)||'').toLowerCase()!=='off';}catch{return true;}}

function storyFrameOf(contract={}){
 const frame=contract?.storyFrame||contract?.missionPlan?.plan?.storyFrame||contract?.plan?.storyFrame||null;
 return frame&&typeof frame==='object'?frame:null;
}

// Builds the idea from the planner contract. Returns null when the plan is incomplete; the caller then keeps the old path.
function fromContract(contract={}){
 const profileId=String(contract?.profile?.id||'').toLowerCase();
 if(!PROFILES.includes(profileId))return null;
 if(String(contract?.mode||contract?.route?.mode||'').toLowerCase()!=='bush'||contract?.target?.isPOI)return null;
 const frame=storyFrameOf(contract);
 if(!frame)return null;
 const storyFrame={};
 for(const key of FRAME_FIELDS){const value=text(frame[key]);if(!value)return null;storyFrame[key]=value;}
 for(const key of OPTIONAL_FRAME_FIELDS){const value=text(frame[key]);if(value)storyFrame[key]=value;}
 const locked=contract?.followUpContext?.lockedPassenger;
 const lockedPassenger=locked&&typeof locked==='object'&&text(locked.name,160)
  ?{name:text(locked.name,160),role:text(locked.role,200)||'',gender:locked.gender==='female'?'female':locked.gender==='male'?'male':''}:null;
 return {schema:VERSION,profileId,storyFrame,...(lockedPassenger?{lockedPassenger}:{})};
}

function validIdea(idea){return !!(idea&&idea.schema===VERSION&&PROFILES.includes(idea.profileId)&&idea.storyFrame&&FRAME_FIELDS.every(k=>text(idea.storyFrame[k])));}

// Person seed for the writer. The planned idea decides the person; no candidate-list override.
function writerPassengerSeed(idea){return validIdea(idea)&&idea.lockedPassenger?{...idea.lockedPassenger}:{};}

// Additional writer rules, only for the pickup guest. Texts follow the proven V4 writer rules 19c/19e.
function writerPrompt(idea,contract={}){
 if(!validIdea(idea))return '';
 const base='\nBUSH_IDEA (bush-idea.v1, verbindlich): '+JSON.stringify({profileId:idea.profileId,storyFrame:idea.storyFrame,lockedPassenger:idea.lockedPassenger||null})
  +'\nDie Person, ihr Anliegen, der heutige Anlass und das Vorhaben am Boden kommen aus BUSH_IDEA.storyFrame. Story, passenger, greetingText und cargo erzählen genau diese Idee; keine andere Person oder Rolle aus Kandidatenlisten übernehmen. Ein gesperrter lockedPassenger bleibt mit Name und Rolle unverändert.';
 // Other Bush profiles already keep plan, person and story consistent: their writer prompt stays unchanged.
 if(idea.profileId!=='bush_pickup_strip')return '';
 const names=(Array.isArray(contract?.varietyHints?.passengerNameCandidates)?contract.varietyHints.passengerNameCandidates:[])
  .map(c=>({name:text(c?.name,120),gender:c?.gender==='female'?'female':'male'})).filter(c=>c.name).slice(0,8);
 return base
  +'\nBUSH-PICKUP-VOICE: Fülle passenger.pickupStory:{personName,role,exactWhere,whyThere,returnReason,boardingCue,departureCue} mit Voice-Ankern zur exakt gleichen Geschichte. Diese Felder sind keine neue Story, sondern die Basis für spätere PAX-Ansagen. personName und role sind identisch mit passenger.name und passenger.role. exactWhere: konkreter Wartepunkt am Zielstrip. whyThere: was die Person dort getan hat. returnReason: warum sie jetzt zurück muss. boardingCue und departureCue sind kurze Sätze der Person in Ich-Form beim Einsteigen und beim Abflug, je höchstens 260 Zeichen.'
  +(names.length&&!idea.lockedPassenger?'\nBUSH-PICKUP-NAME: Setze passenger.name auf genau einen zur geplanten Person passenden vollständigen Namen aus NAME_CANDIDATES, halte gender konsistent und verwende denselben Namen in story. Die Liste ist nur eine Rotationshilfe; Rolle, Auftrag und Story kommen weiter aus BUSH_IDEA.storyFrame. NAME_CANDIDATES: '+JSON.stringify(names):'')+'\n';
}

function pickupStoryFrom(raw,passenger){
 const src=raw?.passenger?.pickupStory;
 if(!src||typeof src!=='object')return null;
 const out={};
 for(const key of PICKUP_FIELDS){const value=text(src[key],key==='exactWhere'||key==='whyThere'?500:320);if(!value)return null;out[key]=value;}
 const name=String(passenger?.name||'').replace(/\s*\([^)]*\)\s*$/,'').trim();
 const role=String(passenger?.role||'').trim();
 if(!name)return null;
 return {personName:name,role:role||text(src.role,200),...out};
}

// After the writer: record the idea and keep the writer's own person data. Returns diagnostics only, never prose.
function accept(mission,raw,idea){
 if(!mission||!validIdea(idea))return mission;
 const diagnostics=[];
 const passenger=mission.passenger&&typeof mission.passenger==='object'?mission.passenger:null;
 if(idea.profileId==='bush_pickup_strip'&&passenger){
  const pickupStory=pickupStoryFrom(raw,passenger);
  if(pickupStory)passenger.pickupStory={...(passenger.pickupStory||{}),...pickupStory};
  else diagnostics.push('pickup_story_fields_missing');
  const story=String(mission.s||'');
  const first=String(passenger.name||'').trim().split(/\s+/)[0]||'';
  if(first&&!story.includes(first))diagnostics.push('passenger_name_not_in_story');
 }
 if(idea.lockedPassenger&&passenger&&passenger.name!==idea.lockedPassenger.name)diagnostics.push('locked_passenger_changed');
 mission.bushIdea={...idea};
 mission._missionWriterV4Debug={...(mission._missionWriterV4Debug||{}),bushIdea:{schema:VERSION,profileId:idea.profileId,diagnostics}};
 return mission;
}

function owns(mission){return validIdea(mission?.bushIdea);}

const api={VERSION,FLAG,PROFILES,PICKUP_FIELDS,enabled,fromContract,validIdea,writerPassengerSeed,writerPrompt,pickupStoryFrom,accept,owns};
root.MissionBushIdeasCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
