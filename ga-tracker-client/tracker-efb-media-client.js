// Local EFB/toolbar transport. The shared UI never opens a relay connection.
(function(root){
 'use strict';
 var sequence=0;
 root.gaMediaControlAvailable=function(){return !!root.gaCockpitSessionClient;};
 root.gaMediaRequest=function(payload){
  var cockpit=root.gaCockpitSessionClient;
  if(!cockpit||cockpit.role==='web')return Promise.resolve({ok:false,error:'tracker_not_connected'});
  var commandId='media-'+Date.now().toString(36)+'-'+(++sequence);
  function request(retry){
   var auth=cockpit.authEnvelope();
   if(!auth)return Promise.resolve({ok:false,error:'cockpit_session_invalid'});
   return root.GATrackerCockpitSessionClient.requestJson(root.fetch.bind(root),cockpit.baseUrl+'/media/control',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({sessionId:auth.sessionId,sessionToken:auth.sessionToken,commandId:commandId,payload:payload})
   },25000).then(function(result){
    if(result.response.status===401&&retry)return cockpit.register().then(function(){return request(false);});
    return result.body;
   });
  }
  return (cockpit.authEnvelope()?Promise.resolve():cockpit.register()).then(function(){return request(true);});
 };
})(window);
