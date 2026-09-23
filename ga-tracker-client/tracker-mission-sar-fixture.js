'use strict';
const source=require('./tracker-mission-training-fixture.js');
const execution=require('../mission-execution-core.js');
function bundle(){
 const b=source.bundle(),r=b.executionPoiRecipe,c=r.voiceContext;
 r.taskDomain='search_and_rescue';delete r.trainingRecipe;
 r.passenger={targetRadiusNm:1.2,targetAltFt:3000,targetDwellMin:2};
 c.taskDomain=r.taskDomain;c.passenger={...r.passenger,name:'Mia',taskDomain:r.taskDomain};
 delete c.trainingRecipe;delete c.trainingPlan;
 c.storyFrame={focusSubject:'vermisste Person',subjectDetail:'die vermisste Person'};
 c.sarReport=r.sarReport={schema:'ga.sar-report.v1',confirmCoords:{lat:48.3,lon:8.5,name:'Suchanker'},confirmRangeNm:0.8};
 Object.assign(b.missionState.currentMissionData,{taskDomain:r.taskDomain,passenger:c.passenger});
 delete b.missionState.currentMissionData.trainingRecipe;
 b.executionReplay=execution.createExecutionBundle(b);
 b.execution=execution.createReplayShadowEnvelope(b.executionReplay,{sourceRevision:0,legacyBundle:b});return b;
}
module.exports={missionId:source.missionId,bundle};
