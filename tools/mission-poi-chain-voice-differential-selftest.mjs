import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import voice from '../mission-poi-voice-core.js';
import chainVoice from '../ga-tracker-client/tracker-mission-poi-chain-voice.js';
const frozen=fs.readFileSync(new URL('./fixtures/poi-chain-voice-legacy-20260922.js',import.meta.url),'utf8');
const kinds=['point_complete','chain_area_entered','chain_corridor_entered','corridor_segment_complete','corridor_segment_reset_offtrack','corridor_segment_reset_speed','chain_corridor_complete','chain_complete','next_point_revealed'];
const definitions={photo:{gain:.78,variantScope:'mission'},handoff:{gain:.54,variantScope:'event'},scan_start:{gain:.58,variantScope:'mission'}};
let comparisons=0;
for(let seed=0;seed<12;seed++) for(const override of [null,'none','handoff']) for(const types of [...kinds.map(k=>[k]),['chain_area_entered','point_complete','next_point_revealed'],['point_complete','chain_corridor_complete','chain_complete'],['corridor_segment_reset_offtrack','point_complete','chain_complete']]) {
 const spec={key:`chain-${seed}`,label:'Bahn 🛤️',points:[{id:'p1',name:'Erster Punkt',lat:48,lon:8},{id:'p2',name:'Brücke',lat:48.1,lon:8.1}]};
 const events=types.map(type=>({type,point:spec.points[seed%2],nextPoint:spec.points[1],segmentId:'C1',...(seed%2?{hiddenOutcome:{paxFindingText:'An der Brücke sehe ich einen Befund.'}}:{})}));
 const context={schema:voice.CONTEXT_SCHEMA,version:1,missionId:'chain-test',taskDomain:'infra_chain_recon',strict:true,passenger:{},baseContext:'Test',audioEnabled:true,chainSpec:spec,speaker:{name:'Anna'},missionAudioKey:'farewell:chain-test',chainAudioDefinitions:definitions,chainAudioCueIds:override?Object.fromEntries(kinds.map(k=>[k,override])):{}};
 const expected=[], pending=[];
 let current;
 const sandbox={window:{activePassenger:context.passenger},Math, currentMissionData:{},_paxMissionEpoch:1,_paxAudioEffectsEnabled:true,
  _paxMissionAudioKey:kind=>`${kind}:chain-test`,_speakerSnapshotForMissionVoice:()=>context.speaker,_paxLog:()=>{},
  _paxMissionAudioCueId:(_scope,kind,fallback)=>context.chainAudioCueIds[kind]??fallback,
  _paxAudioCueDef:id=>id==='none'?null:{id,...definitions[id]},_paxEpochCurrent:()=>true,
  _paxResolveAudioCueClips:async()=>[{}],_paxPickAudioCueClip:(_id,_clips,variantSeed)=>({rec:{audioBuffer:Buffer.from('clip')},url:variantSeed}),
  _paxDelayMs:async ms=>{current.delayMs=ms;return true;},
  _paxDecodeAudioEffectAndPlay:async(_bytes,_mime,_epoch,label,{gain})=>{current.clips.push({id:label.slice('Audio-Cue '.length),gain,delayMs:current.delayMs||0});current.delayMs=0;return true;},
  _speakPreparedText:(key,text,speaker,label,options)=>{expected.push({key,text,speaker,label});pending.push(options);}};
 vm.createContext(sandbox);vm.runInContext(frozen,sandbox);
 sandbox._paxPlayPhotoBurst=(seed,options,epoch)=>sandbox._paxPlayAudioCue('photo',seed,options,epoch);
 sandbox._handlePoiChainEvents(events,spec);
 const actual=voice.chainEvents(context,events);
 assert.deepEqual(actual.map(({sounds,...event})=>event),expected);
 const prepared=chainVoice.prepareEvents(context,events,spec,10);
 for(let i=0;i<pending.length;i++) for(const [part,fn] of [['before','beforeAudio'],['after','afterAudio']]) {
  current={clips:[],delayMs:0};await pending[i][fn]?.(1);
  assert.deepEqual(prepared[i].resolvedRecipe.cueSequence[part].map(({variantSeed,...clip})=>clip),current.clips,`${seed}:${types}:${override}:${part}`);
 }
 comparisons++;
}
console.log(`PASS: ${comparisons} frozen chain event groups, speech ordering, hidden findings, exact photo counts/delays/gains.`);
