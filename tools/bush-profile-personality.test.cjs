const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-bush-narrative-core.js');
const ids=['bush_supply_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo','bush_recon_return'];
test('all remaining Bush profiles receive their own basis in both production planner paths and writer',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');const source=fs.readFileSync(require.resolve('../app.js'),'utf8');const c=vm.createContext({window:{MissionBushNarrativeCore:core},MISSION_WRITER_V5_DOMAIN_RECIPES:{default:{unchanged:true}}});
 for(const name of ['_missionPipelineV4Prompt','_missionWriterV5DomainRecipe'])vm.runInContext(declaration(source,name),c);
 for(const id of ids){const basis=core.storyBasis(id);assert.ok(basis.focus&&basis.connection&&basis.outcome&&basis.voice);for(const compact of [false,true]){const prompt=c._missionPipelineV4Prompt({mode:'bush'},{profile:{selected:{id}}},{compact});assert.ok(prompt.includes(core.planningInstructions(id)));const frame=JSON.parse(prompt.split('<OUTPUT_JSON>')[1].split('</OUTPUT_JSON>')[0]).plan.storyFrame;assert.match(frame.subjectDetail,/Fiktiver Vorname/);assert.match(frame.incidentContext,/Passender Hintergrund/);assert.ok(frame.soughtOutcome.includes(basis.outcome));}assert.deepEqual(c._missionWriterV5DomainRecipe('', '',{profile:{id}}),core.writerRecipe(id));}
 assert.equal(core.storyBasis('apt_charter'),null);assert.equal(core.planningInstructions('media_photo'),'');assert.equal(core.writerRecipe('apt_charter'),null);assert.ok(c._missionWriterV5DomainRecipe('apt_charter','charter',{profile:{id:'apt_charter'}}).unchanged);
});
test('speaker and completion rules follow the actual Bush recipe',()=>{
 assert.match(core.storyBasis('bush_supply_strip').voice,/0 PAX/);assert.match(core.storyBasis('bush_pickup_cargo').voice,/keine Stimme/);assert.match(core.storyBasis('bush_pickup_strip').voice,/erst nach der Aufnahme/);assert.match(core.storyBasis('bush_pickup_strip').connection,/Follow-up/);assert.match(core.storyBasis('bush_recon_return').outcome,/aus der Luft/);assert.match(core.storyBasis('bush_scenic_hopper').outcome,/Kein Rundflug/);
 const base={start:{lat:44,lon:-116},target:{lat:45,lon:-115},passenger:{name:'Mara',role:'Gast',personality:'aufmerksam, selbstironisch',greetingText:'Das ist diesmal mein zweiter Versuch.'},story:'Mara erinnert sich an ihren ersten Versuch.'};
 for(const id of ids){const bush={profileId:id,...(id==='bush_pickup_strip'?{targetMode:'strip_then_return',pickupKind:'passenger'}:{})};const frame=core.frame({...base,bush});assert.equal(frame.character.personality,base.passenger.personality);if(id==='bush_pickup_strip')assert.equal(frame.leg,'return');}
 assert.equal(core.frame({...base,passenger:null,bush:{profileId:'bush_supply_strip'}}),null);assert.equal(core.frame({...base,bush:{profileId:'bush_pickup_cargo',pickupKind:'cargo'}}),null);
});

test('cargo pickup domain details carry cargo only while passenger pickup retains its guest',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const c=vm.createContext({window:{MissionBushNarrativeCore:core},_missionWriterV5Text:x=>x,_missionWriterV5PlaceLabel:()=> 'Big Creek',_missionPipelineV4ContractHomeName:()=> 'McCall',_missionPipelineV4BushPickupDisplayText:x=>x});
 vm.runInContext(declaration(source,'_missionWriterV5BuildDomainDetails'),c);
 const cargo=c._missionWriterV5BuildDomainDetails('bush_pickup',{profile:{id:'bush_pickup_cargo',taskDomain:'bush_pickup_return'},cargoText:'52 lbs Ersatzteile'},{},{storySpine:{},place:'Big Creek'});
 assert.equal(cargo.shipment,'52 lbs Ersatzteile');assert.match(cargo.briefingIntent,/0 PAX/);assert.match(cargo.contactLocation,/bleibt.*am Boden/);assert.match(cargo.routeTruth.pickup,/Nur.*Fracht/);
 const guest=c._missionWriterV5BuildDomainDetails('bush_pickup',{profile:{id:'bush_pickup_strip',taskDomain:'bush_pickup_return'}},{},{storySpine:{},place:'Big Creek'});
 assert.ok(JSON.stringify(guest).includes('Person'));assert.ok(!JSON.stringify(guest).includes('0 PAX'));
});
