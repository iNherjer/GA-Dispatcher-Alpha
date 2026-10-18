(function(root){
 'use strict';
 function install(){
  var host=document.getElementById('mapTableOverlay'),menu=document.getElementById('mapVoiceMenu');
  if(!host||!menu||!root.GAMediaPlayerUI)return;
  var container=document.createElement('div');container.className='ga-media-settings';
  container.innerHTML='<label><input type="checkbox" class="ga-media-enable"> Mediensteuerung</label><label>Skin <select class="ga-media-skin" aria-label="Medien-Skin"><option value="winamp">Winamp</option><option value="ipod">iPod</option><option value="watch">Watch</option></select></label><label class="ga-media-player-choice" hidden>Musik-App <select class="ga-media-select" aria-label="Windows-Medienplayer"><option value="">Keine Musik-App aktiv</option></select></label><label><input type="checkbox" class="ga-media-duck" checked> Bei Ansagen leiser</label><label>Restlautstärke <select class="ga-media-factor"><option value="0.1">10 %</option><option value="0.2">20 %</option><option value="0.35">35 %</option><option value="0.5">50 %</option></select></label><div class="ga-media-message" role="status"></div>';
  menu.insertBefore(container,menu.firstChild);
  var check=container.querySelector('.ga-media-enable'),select=container.querySelector('.ga-media-select'),duck=container.querySelector('.ga-media-duck'),factor=container.querySelector('.ga-media-factor'),message=container.querySelector('.ga-media-message');
  var enabled=false,open=false,watching=false,epoch=0,state=null,revision=-1,lastReceived=0,lastReachable=0,pendingAction=false,pendingVolume=null,pendingSeek=null,skin='winamp',audible=new Set(),closed=false,nextWatchAt=0,watchTimer=null;
  try{var saved=JSON.parse(localStorage.getItem('ga.media.web.v1')||'{}');enabled=saved.enabled===true;skin=['ipod','watch'].indexOf(saved.skin)>=0?saved.skin:'winamp';}catch(_){}
  check.checked=enabled;container.querySelector('.ga-media-skin').value=skin;
  var errors={tracker_not_connected:'Tracker nicht verbunden.',media_desktop_unavailable:'Mediensteuerung benötigt die vorbereitete Windows-Tracker-App und Runtime.',authority_timeout:'Keine Tracker-Bestätigung.',media_rate_limited:'Mediensteuerung kurz ausgelastet.'};
  function hasMediaControl(){return typeof root.gaMediaControlAvailable==='function'?root.gaMediaControlAvailable():(root.liveTrackerCapabilities||[]).includes('media.control.v1');}
  function send(payload){return typeof root.gaMediaRequest==='function'?root.gaMediaRequest(payload):Promise.resolve({ok:false,error:'tracker_not_connected'});}
  function render(){
   if(!state)return;
   var display=Object.assign({},state,{player:(state.players||[]).filter(function(p){return p.source===state.source;}).map(function(p){return p.name;})[0]||'WINDOWS',connected:state.ok===true});
   display.volumeAvailable=state.ok===true&&state.volumeAvailable!==false;
   if(state.playing&&Number.isFinite(state.positionSeconds)){
    display.positionSeconds=state.positionSeconds+Math.min(20,Math.max(0,Date.now()-lastReceived)/1000);
    if(Number.isFinite(state.durationSeconds))display.positionSeconds=Math.min(state.durationSeconds,display.positionSeconds);
   }
   ui.update(display);
  }
  function receive(result){
   if(!result.ok){message.textContent=errors[result.error]||result.error||'Player nicht erreichbar.';state=Object.assign({},state,{ok:false});render();return;}
   lastReachable=Date.now();
   if(result.changed===false){if(state){if(!state.ok)message.textContent='Windows-Player verbunden.';state=Object.assign({},state,{ok:true});render();}return;}
   if(state&&result.serverId===state.serverId&&Number.isSafeInteger(result.revision)&&result.revision<revision)return;
   state=result;revision=Number.isSafeInteger(result.revision)?result.revision:-1;lastReceived=Date.now()-Math.min(20000,Math.max(0,Number(result.sampleAgeMs)||0));
   var players=result.players||[],values=players.map(function(p){return p.source;}).join('\n');
   if(Array.from(select.options).map(function(p){return p.value;}).join('\n')!==values){while(select.firstChild)select.removeChild(select.firstChild);if(!players.length)select.add(new Option('Keine Musik-App aktiv',''));players.forEach(function(p){select.add(new Option(p.name,p.source));});}
   select.value=result.source||'';select.disabled=!players.length;
   container.querySelector('.ga-media-player-choice').hidden=players.length<2;
   duck.checked=result.duckEnabled!==false;factor.value=String(result.duckFactor||0.2);
   message.textContent=players.length?(result.ducking?'Musik für Ansage abgesenkt.':'Windows-Player verbunden.'):'Player am Windows-PC öffnen und einen Titel starten.';
   render();
  }
  async function action(payload){
   if(pendingAction){if(payload.action==='volume')pendingVolume=payload;if(payload.action==='seek')pendingSeek=payload;return;}pendingAction=true;
   try{receive(await send(payload));}catch(_){receive({ok:false,error:'tracker_not_connected'});}finally{pendingAction=false;if(pendingSeek){var seek=pendingSeek;pendingSeek=null;action(seek);}else if(pendingVolume){var next=pendingVolume;pendingVolume=null;action(next);}}
  }
  function visible(){return !closed&&enabled&&open&&!document.hidden&&root.getComputedStyle(host).visibility!=='hidden'&&host.getBoundingClientRect().width>0&&host.getBoundingClientRect().height>0;}
  async function watch(){
   if(watching||!visible()||Date.now()<nextWatchAt)return;watching=true;var current=epoch;
   try{var result=await send({action:'watch',after:revision});if(current===epoch&&visible())receive(result);}
   catch(_){if(current===epoch)receive({ok:false,error:'tracker_not_connected'});}
   finally{watching=false;clearTimeout(watchTimer);var delay=state&&state.ok?50:5000;nextWatchAt=Date.now()+delay;if(visible())watchTimer=setTimeout(watch,delay);}
  }
  function savePreferences(){try{localStorage.setItem('ga.media.web.v1',JSON.stringify({enabled:enabled,skin:skin}));}catch(_){}}
  function createSkin(){return root.GAMediaPlayerUI.create({host:host,skin:skin,storageKey:'ga.media.'+skin+'.layout.v1',state:{connected:false,volumeAvailable:false},onCommand:action,
    onVisibilityChange:function(value){open=value;epoch++;clearTimeout(watchTimer);nextWatchAt=0;if(value)watch();}});}
  var ui=createSkin();
  ui.setEnabled(enabled);
  check.onchange=function(){enabled=check.checked;savePreferences();ui.setEnabled(enabled);};
  container.querySelector('.ga-media-skin').onchange=function(){var reopen=open;skin=['ipod','watch'].indexOf(this.value)>=0?this.value:'winamp';savePreferences();epoch++;clearTimeout(watchTimer);ui.destroy();open=false;ui=createSkin();ui.setEnabled(enabled);if(reopen&&enabled)ui.open();render();if(root.gaMediaPlayerClient)root.gaMediaPlayerClient.ui=ui;};
  select.onchange=function(){action({action:'select',source:select.value});};
  function settings(){action({action:'settings',enabled:duck.checked,factor:Number(factor.value)});}
  duck.onchange=settings;factor.onchange=settings;
  root.addEventListener('ga:media-audible',function(event){var d=event.detail||{},key=String(d.effectId||'')+':'+d.stage;if(d.active)audible.add(key);else audible.delete(key);if(hasMediaControl())send({action:'duck',active:audible.size>0}).catch(function(){});});
  var timer=setInterval(function(){
   if(visible()){render();watch();}
   // Only active speech renews its short lease; collapsed controls need no status traffic.
   if(audible.size&&hasMediaControl())send({action:'duck',active:true}).catch(function(){});
   if(state&&Date.now()-lastReachable>45000){state=Object.assign({},state,{ok:false});render();}
  },1000);
  root.addEventListener('visibilitychange',function(){epoch++;if(!document.hidden)watch();});
  root.addEventListener('pagehide',function(){closed=true;clearInterval(timer);clearTimeout(watchTimer);if(audible.size)send({action:'duck',active:false}).catch(function(){});audible.clear();});
  root.gaMediaPlayerClient={receive:receive,ui:ui};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window);
