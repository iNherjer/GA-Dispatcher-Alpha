const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-bush-narrative-core.js');
test('real planner schemas carry personal Charter fields without changing other missions',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const c=vm.createContext({window:{MissionBushNarrativeCore:core}});
 vm.runInContext(declaration(source,'_missionPipelineV4Prompt'),c);
 for(const compact of [false,true]){
  const charter=c._missionPipelineV4Prompt({mode:'bush'},{profile:{selected:{id:'bush_charter_strip'}}},{compact});
  assert.ok(charter.includes(core.charterPlanningInstructions));
  const schema=charter.split('<OUTPUT_JSON>')[1].split('</OUTPUT_JSON>')[0];
  const frame=JSON.parse(schema).plan.storyFrame;
  assert.match(frame.subjectDetail,/Fiktiver Vorname/);
  assert.match(frame.incidentContext,/Konkrete Begebenheit/);
  assert.match(frame.soughtOutcome,/Pilotauftrag endet beim Absetzen/);
  for(const [mode,id] of [['apt','apt_charter'],['bush','bush_scenic_hopper'],['bush','bush_supply_strip'],['poi','media_photo']]){
   const other=c._missionPipelineV4Prompt({mode},{profile:{selected:{id}}},{compact});
   assert.ok(!other.includes(core.charterPlanningInstructions));
   assert.ok(!other.includes('Fiktiver Vorname, Rolle und konkreter individueller Wunsch'));
  }
 }
});

test('Charter role comparison preserves the real guest while rejecting role and gender changes',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const c=vm.createContext({window:{MissionBushNarrativeCore:core},normalizeMissionText:s=>String(s).toLowerCase()});
 vm.runInContext(declaration(source,'_missionWriterV5StoryHasPassengerRoleConflict'),c);
 const guest={name:'Sarah',role:'Projektfotografin',gender:'female'};
 const charter={profile:{id:'bush_charter_strip'}};
 assert.equal(c._missionWriterV5StoryHasPassengerRoleConflict('Sarah, eine Fotografin, bringt ihren alten Belichtungsmesser mit.',guest,charter),false);
 assert.equal(c._missionWriterV5StoryHasPassengerRoleConflict('Sarah, eine Ärztin, bringt ihren Koffer mit.',guest,charter),true);
 assert.equal(c._missionWriterV5StoryHasPassengerRoleConflict('Sarah, eine Fotografin, bringt ihren Koffer mit.',{...guest,role:'Projektfotograf',gender:'male'},charter),true);
 assert.equal(c._missionWriterV5StoryHasPassengerRoleConflict('Sarah, eine Fotografin, bringt ihren Koffer mit.',guest,{profile:{id:'apt_charter'}}),true);
});

test('Charter chapters inherit the actual passenger tone and greeting, other profiles retain their frame',()=>{
 const input={start:{lat:44,lon:-116},target:{lat:45,lon:-115},bush:{profileId:'bush_charter_strip'},passenger:{name:'Ben',role:'Techniker',personality:'trocken, hilfsbereit',greetingText:'Na, dann kümmern wir uns um das gute Stück.'},story:'Ben fährt zur Arbeit.'};
 const frame=core.frame(input);
 assert.deepEqual(frame.character,{personality:input.passenger.personality,greeting:input.passenger.greetingText});
 const prompt=core.prompt(frame,[]);
 assert.ok(prompt.includes(input.passenger.greetingText));
 assert.deepEqual(core.frame({...input,bush:{profileId:'bush_scenic_hopper'}}).character,frame.character);
});
