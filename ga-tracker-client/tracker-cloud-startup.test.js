'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'tracker.js'),'utf8');
const start=source.indexOf('  cloudMissionReconciler = createCloudMissionReconciler({');
const end=source.indexOf('  let readCockpitPayload = null;',start);
assert.ok(start>=0&&end>start);
for(const channel of ['alpha','stable'])test(`production Cloud reconciler initializes for ${channel} without interrupting startup`,()=>{
 let config;const ctx={path,require:n=>{assert.equal(n,'node:crypto');return crypto;},TRACKER_DATA_DIR:'/tracker-data',TRACKER_RUNTIME_CHANNEL:channel,syncId:'test-pilot',debugLog:()=>{},cloudMissionReconciler:null,
 createCloudMissionReconciler:options=>{config=options;return{applied:()=>null};}};
 vm.runInNewContext(source.slice(start,end),ctx);
 assert.equal(config.pilotId,'test-pilot');
 assert.equal(config.filename,path.join('/tracker-data',`cloud-mission-control-${channel}-${crypto.createHash('sha256').update('test-pilot').digest('hex').slice(0,24)}.json`));
 for(const callback of ['getRun','readLatest','blocked','abort','clear','load','checkpoint'])assert.equal(typeof config[callback],'function');
 assert.ok(ctx.cloudMissionReconciler);
});
