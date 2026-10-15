'use strict';
// Read-only transport smoke: own local helper/bridge, no playback or volume command.
const {WindowsMedia}=require('../ga-tracker-client/desktop/lib/windows-media');
const {createMediaServer}=require('../ga-tracker-client/desktop/lib/media-server');
const {createMediaBridge}=require('../ga-tracker-client/tracker-media-bridge');
(async()=>{
 if(process.platform!=='win32')throw new Error('Windows required');
 const seconds=Number(process.argv[2]||65);if(!Number.isFinite(seconds)||seconds<1||seconds>180)throw new Error('seconds: 1..180');
 const media=new WindowsMedia(),server=createMediaServer(media);
 try{
  const endpoint=await server.start(),bridge=createMediaBridge({VFR_MULTITOOL_MEDIA_PORT:endpoint.port,VFR_MULTITOOL_MEDIA_TOKEN:endpoint.token});
  let state=await bridge.request({action:'snapshot',clientId:'native-smoke'});
  if(process.argv[3])state=await bridge.request({action:'select',source:process.argv[3],clientId:'native-smoke'});
  const start=Date.now();let calls=0;
  while(Date.now()-start<seconds*1000){
   if(!state.ok)throw new Error(state.error||'native failure');
   console.log(JSON.stringify({elapsedMs:Date.now()-start,ok:state.ok,changed:state.changed,revision:state.revision,source:state.source,playing:state.playing,positionSeconds:state.positionSeconds??null,durationSeconds:state.durationSeconds??null,positionKind:state.positionKind||null}));
   state=await bridge.request({action:'watch',after:state.revision,clientId:'native-smoke'});calls++;
  }
  if(!state.ok)throw new Error(state.error||'native failure');
  console.log('WINDOWS_MEDIA_LIVE_SMOKE_OK watches='+calls);
 }finally{await server.close();await media.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
