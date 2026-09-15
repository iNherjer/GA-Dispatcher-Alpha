const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../mission-private-return-core.js');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
function load(c,file,names){for(const name of names){const s=read(file),i=s.indexOf('function '+name+'(');assert.ok(i>=0,name);vm.runInContext(s.slice(s.slice(i-6,i)==='async '?i-6:i,s.indexOf('\n}',i)+2),c);}}
function sandbox(){
 const c={console:{log(){},warn(){}},Date,Math,setTimeout(){},clearInterval(){},setInterval(){},smoothedGS:0,smoothedVS:0,_fpCache:null,_fpCacheKey:null,
 document:{getElementById:()=>null},currentStartICAO:'EDTW',currentDestICAO:'EDTF',
 currentMissionData:{missionId:'debug-flight',start:'EDTW',dest:'EDTF',
 departureAirport:{icao:'EDTW',lat:48.27,lon:8.42},destinationAirport:{icao:'EDTF',lat:48.02,lon:7.83},
 passenger:{name:'Jonas',role:'Freund',gender:'male'},
 privateOuting:{schema:'private-outing.v1',taskDomain:'private_outing',occasion:'Gemeinsam wandern',
 companion:{name:'Jonas',relationship:'Freund',gender:'male'},luggage:{label:'Rucksack'}}},
 missionRuntime:{},simModeActive:true,simHadMeaningfulAirbornePhase:true,gaSimGpsPos:{lat:48.02,lon:7.83},gaSimFlightData:{onGround:true},
 _missionPhaseDebugPush(){},_missionRuntimePassengerHandoffComplete:()=>false,_missionFarewellRecordWithCargoOutcome:r=>({...r}),
 _missionEndReadiness:()=>({atTarget:true,groundStill:true}),_missionRuntimeHasPassengerForDeboarding:()=>true,
 _missionRuntimeStartFarewellSpeech(){c.missionRuntime.farewellSpeechStarted=true;},triggerPaxFarewell(){},
 _activeMissionRuntimeId:()=>c.currentMissionData.missionId,_readPendingMissionDebrief:()=>null,_missionCompletionHasPassengers:()=>false,_missionCompletionHasCargo:()=>false,
 MissionPrivateReturnCore:core,_safeCloneJson:x=>JSON.parse(JSON.stringify(x))};
 c.window=c;vm.createContext(c);
 load(c,'mission-runtime-core.js',['_triggerPaxFarewellAndWaitForDeboard']);
 load(c,'sync.js',['_completionFinite','_completionText','_buildMissionCompletionRecord','_compactFlightRecordForRuntime']);
 let source=read('sim-route.js');source=source.replace(/\}\)\(\);\s*$/,`window.probe = {seed(airborne=true) {
 simActive=true; simRouteCache={totalDist:99,waypoints:[],segs:[]}; simElapsedSec=120;
 simTrack=[[48.27,8.42,2200,0],[48.14,8.12,3800,30],[48.02,7.83,800,60]];
 window.simHadMeaningfulAirbornePhase=airborne;
 }, record:_buildSimRecord, finalize:_finalizeSimMissionEnd};\n})();`);
 vm.runInContext(source,c);c.probe.seed();return c;
}
test('actual Sim record -> farewell -> later completion keeps flight and target evidence',()=>{
 const c=sandbox(),r=c.probe.record();
 assert.equal(r.distanceSource,'sim-track');assert.equal(r.telemetrySampleCount,3);
 assert.ok(r.distanceNm>20 && r.distanceNm<40,'distance comes from track, not 99 NM planned');
 assert.equal(c.probe.finalize(r),true);assert.equal(c.simModeActive,true);assert.equal(c.gaSimMissionClosing,true);
 assert.ok(c.gaSimGpsPos);assert.equal(c.probe.finalize(r),false,'no duplicate farewell');
 const saved=c._compactFlightRecordForRuntime(c.missionRuntime.pendingFarewellRecord);
 c._missionEndReadiness=()=>({atTarget:false,groundStill:false});c.simModeActive=false;
 const completion=c._buildMissionCompletionRecord({flightRecord:saved,outcome:{failed:false}});
 assert.equal(completion.simulated,true);
 assert.ok(core.request(c.currentMissionData,completion),'real completion record produces return offer');
 assert.deepEqual(JSON.parse(JSON.stringify(completion.privateOutingEvidence)),{flown:true,atTarget:true,groundStill:true});
 c.currentMissionData.missionId='different';
 assert.equal(c._buildMissionCompletionRecord({flightRecord:saved}).privateOutingEvidence.atTarget,false,'old evidence cannot migrate to another mission');
});
test('ground-only debug run is not a flown private outing; live proof still works',()=>{
 const c=sandbox();c.probe.seed(false);
 assert.equal(core.completionEvidence(c.probe.record(),{atTarget:true,groundStill:true}).flown,false);
 assert.equal(core.completionEvidence({durationSec:100,telemetrySampleCount:20,distanceNm:30,distanceSource:'gps'},{}).flown,true);
 assert.equal(core.completionEvidence({simulated:true,durationSec:100,telemetrySampleCount:20,distanceNm:30,distanceSource:'planned',hasAirborneEvidence:true},{}).flown,false);
});
test('cleanup and explicit stop release held simulation without restarting it',()=>{
 const c=sandbox();c.probe.finalize(c.probe.record());assert.equal(c.finishSimMissionClose(),true);
 assert.equal(c.simModeActive,false);assert.equal(c.gaSimGpsPos,null);assert.equal(c.gaSimMissionClosing,false);
 assert.equal(c.finishSimMissionClose(),false);
});

test('playback diagnostics keep each event, provider voice and model, bounded to current epoch',async()=>{
 const c={Date,window:null,_paxLog(){},_paxEpochCurrent:()=>true,_paxDecodeAndPlay:async()=>true};c.window=c;vm.createContext(c);
 load(c,'passenger-voice.js',['_paxPlayResolvedTtsAudio']);
 const a={b64:'test',speaker:{name:'Jonas'},voiceName:'Charon',model:'model-a',provider:'gemini'};
 await c._paxPlayResolvedTtsAudio(a,3,'Boarding');
 await c._paxPlayResolvedTtsAudio({...a,voiceName:'Puck',model:'model-b'},3,'Verabschiedung');
 assert.equal(c.gaPaxVoicePlaybackHistory.length,2);
 assert.equal(c.gaPaxVoicePlaybackHistory[0].event,'Boarding');
 assert.equal(c.gaPaxVoicePlaybackHistory[1].voice,'Puck');
 c.awmShouldPlayOnThisDevice=()=>false;
 await c._paxPlayResolvedTtsAudio(a,3,'stumm');assert.equal(c.gaPaxVoicePlaybackHistory.length,2);
 c.awmShouldPlayOnThisDevice=()=>true;
 await c._paxPlayResolvedTtsAudio(a,4,'neue Mission');assert.equal(c.gaPaxVoicePlaybackHistory.length,1);
 for(let i=0;i<20;i++) await c._paxPlayResolvedTtsAudio(a,4,'Ansage');
 assert.equal(c.gaPaxVoicePlaybackHistory.length,12);
});
test('manual debug flight exports measured evidence and freezes movement during close',()=>{
 const c=sandbox();c.document.readyState='loading';c.document.addEventListener=()=>{};
 let s=read('sim-manual-flight.js');s=s.replace(/\}\)\(\);\s*$/,`window.manualProbe={seed(){
 manualTrack=[[48.27,8.42,2200,0,80],[48.02,7.83,800,60,0]];
 manualStartTs=Date.now()-60000; manualDistanceNm=30;
 },hold:_forcedZeroReason};})();`);
 vm.runInContext(s,c);c.manualProbe.seed();
 const r=c.manualSimBuildFlightRecord();assert.equal(r.manualSim,true);assert.equal(r.distanceSource,'sim-track');
 assert.equal(core.completionEvidence(r,{}).flown,true);
 c.gaSimMissionClosing=true;assert.equal(c.manualProbe.hold(),'Missionsabschluss');
 c.simHadMeaningfulAirbornePhase=false;assert.equal(core.completionEvidence(c.manualSimBuildFlightRecord(),{}).flown,false);
});
