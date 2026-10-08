import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const story='Elena erzählt von ihrer Arbeit und dem persönlichen Anlass. '.repeat(140)+'Die provisorische Kabelverbindung hatte den Einsatz damals gerettet.';
for(const file of ['charter','cargo','fragile-cargo','medical-transfer','animal-transport','apt-news'])test(`${file} preserves long complete prose and rejects missing story`,()=>{
 const core=require(`../mission-${file}-ideas-core.js`),idea={shipment:{handling:'Besondere Ablage'}};
 const raw={title:'Ein persönlicher Anlass',story,greeting:'Hallo, schön, dass wir heute zusammen fliegen.',memory:'Individueller Anlass',pilotNotes:'Die Ausrüstung braucht einen geeigneten Ablageplatz.'};
 if(file==='cargo')delete raw.greeting;
 assert.equal(core.prose(raw,idea)?.story,story);assert.equal(core.prose({...raw,story:null},idea),null);
});
test('private V5 and V6 preserve long prose without losing speaker validation',()=>{
 const base=require('../mission-private-outing-core.js'),v6=require('../mission-private-episode-v6.js');
 const raw={title:'Ein gemeinsamer Ausflug',story,greeting:{speaker:'companion',addressee:'pilot',text:'Schön, dass wir heute zusammen fliegen.'}};
 assert.equal(base.prose(raw).story,story);assert.equal(v6.prose(raw,{},{}).story,story);assert.equal(base.prose({...raw,greeting:{...raw.greeting,speaker:'other'}}),null);
});
test('club story remains complete while retaining passenger speaker identity',()=>{
 const core=require('../mission-club-ideas-core.js'),idea={passenger:{name:'Ada'}},raw={title:'Vereinsbesuch',story,greeting:{speaker:'passenger',speakerName:'Ada',location:'onboard',text:'Wir fliegen zum Verein.'}};
 assert.equal(core.prose(raw,idea).story,story);assert.equal(core.prose({...raw,greeting:{...raw.greeting,speakerName:'Someone else'}},idea),null);
});
test('POI photo accepts long prose while keeping source references mandatory',()=>{
 const core=require('../mission-poi-briefing-core.js'),data=JSON.parse(fs.readFileSync(new URL('./fixtures/poi-briefing-replay.json',import.meta.url)));
 const run=data.runs[0],c=data.cases.find(c=>c.id===run.id),idea=core.validateIdea({...run.idea,schema:core.IDEA_VERSION,taskDomain:'media_photo'},c),raw={...run.writer,targetId:c.id,story};
 assert.equal(core.validateWriter(raw,idea,c).story,story);assert.throws(()=>core.validateWriter({...raw,usedFactIds:['unavailable-source']},idea,c));
});
test('Tracker/EFB projection preserves the entire long mission and final sentence',()=>{
 const core=require('../ga-tracker-client/tracker-efb-mission-view-core.js');
 const first=core.sanitizeMissionView({story});assert.equal(first.story,story);assert.equal(core.sanitizeMissionView(JSON.parse(JSON.stringify(first))).story,story);
 const renderer=require('../ga-tracker-client/mission-control-ui-core.js');assert.ok(renderer.render(first,{storyExpanded:true}).includes('Die provisorische Kabelverbindung hatte den Einsatz damals gerettet.'));
});
