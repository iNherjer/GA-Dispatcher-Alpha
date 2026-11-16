const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function extract(file,names,c){const code=fs.readFileSync(file,'utf8');for(const name of names){const a=code.indexOf('function '+name+'(');assert.ok(a>=0,name);const b=code.indexOf('\n}',a);vm.runInContext(code.slice(a,b+2),c);}}
test('proposal debug keeps picker choices, event anchor, selection and failure locally',()=>{
 const data=new Map(),c=vm.createContext({window:{},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},JSON,String,Date});
 vm.runInContext("const MISSION_PROPOSAL_DEBUG_KEY='ga_mission_proposal_debug_v1';",c);
 extract('app.js',['missionProposalDebugSummary','missionProposalDebugRecord'],c);
 const choice={id:'charter-0-1',target:{icao:'EDTY',n:'Singen'},title:'Töpferkurs in Singen',subtitle:'2026-11-20 · Töpfermarkt',charterProposal:{idea:{occasion:{id:'hobby',label:'Sport oder Hobby'},event:{title:'Töpfermarkt',startsOn:'2026-11-20',verification:'search'}}}};
 const s=c.missionProposalDebugSummary(choice);assert.equal(s.target,'EDTY');assert.equal(s.occasion,'Sport oder Hobby');assert.deepEqual(JSON.parse(JSON.stringify(s.event)),{title:'Töpfermarkt',date:'2026-11-20',verification:'search'});
 c.missionProposalDebugRecord({at:1,strand:'charter',choices:[s],eventSearch:{status:'ready',count:5}});
 c.missionProposalDebugRecord({selected:{...s,at:2},result:{status:'error',error:'Das Charterbriefing enthält ungültige Texte'}});
 const saved=JSON.parse(data.get('ga_mission_proposal_debug_v1'));assert.equal(saved.strand,'charter');assert.equal(saved.selected.title,'Töpferkurs in Singen');assert.equal(saved.result.status,'error');assert.equal(saved.eventSearch.count,5);
});
test('debug report prints the proposal section before the mission snapshot',()=>{
 const src=fs.readFileSync('profile.js','utf8');const a=src.indexOf("lines.push('Missions-Vorschläge')"),b=src.indexOf("lines.push('Mission Snapshot')");assert.ok(a>0&&a<b);
 assert.match(src.slice(a,b),/Event-Suche/);assert.match(src.slice(a,b),/früheren Mission/);
});
test('selection is recorded where a proposal is accepted, not when the picker is cleared',()=>{
 const src=fs.readFileSync('app.js','utf8');const a=src.indexOf('window.acceptMissionProposalChoice = function'),b=src.indexOf('\n};',a);
 assert.match(src.slice(a,b),/missionProposalDebugRecord\(\{ selected:/);
 const c=src.indexOf('function missionProposalClearBriefingState()'),d=src.indexOf('\n}',c);assert.doesNotMatch(src.slice(c,d),/missionProposalDebugRecord/);
});
