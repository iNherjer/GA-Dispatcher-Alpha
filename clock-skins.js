/* Clock presentation registry. All skins share GAUtilityTime; only views differ. */
(function(root){
 'use strict';
 var providers={},selected='stopwatch',KEY='ga.clock.skin.v1',choices=null;
 try{selected=root.localStorage.getItem(KEY)||'stopwatch';}catch(_){}
 function current(){return providers[selected]||providers.stopwatch;}
 function refresh(){
  var select=root.document.getElementById('mapClockSkin'),provider=current();if(!provider)return;
  if(select){var signature=Object.keys(providers).join('|');if(select._clockOptions!==signature){select._clockOptions=signature;while(select.firstChild)select.removeChild(select.firstChild);Object.keys(providers).forEach(function(id){var option=root.document.createElement('option');option.value=id;option.textContent=providers[id].label;select.appendChild(option);});}if(select.value!==selected)select.value=selected;}
  if(root.GAEfbUiScale&&select){
   if(!choices){choices=root.document.createElement('div');choices.setAttribute('role','group');choices.setAttribute('aria-label','Uhrenskin');choices.style.display='flex';select.parentNode.insertBefore(choices,select);select.style.display='none';}
   if(choices._clockOptions!==Object.keys(providers).join('|')){choices._clockOptions=Object.keys(providers).join('|');while(choices.firstChild)choices.removeChild(choices.firstChild);Object.keys(providers).forEach(function(id){var b=root.document.createElement('button');b.type='button';b.className='pb-btn';b.style.flex='1';b.style.margin='0 2px 6px 0';b.textContent=providers[id].label;b.dataset.clockSkin=id;b.onclick=function(){choose(id);};choices.appendChild(b);});}
   Array.prototype.forEach.call(choices.children,function(b){var value=String(b.dataset.clockSkin===selected);if(b.getAttribute('aria-pressed')!==value)b.setAttribute('aria-pressed',value);});
  }
  var button=root.document.getElementById('mapToolStopwatch');if(button){if(button.title!==provider.label)button.title=provider.label;var label=provider.label+' öffnen';if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);button.classList.toggle('active',!!provider.isOpen());}
 }
 function choose(id,persist){
  if(!providers[id])id='stopwatch';if(id===selected){refresh();return;}
  var previous=current(),reopen=previous&&previous.isOpen();if(previous)previous.close();selected=id;
  try{root.localStorage.setItem(KEY,id);}catch(_){}
  if(persist!==false&&typeof root.gaPersistDisplayClockSetting==='function')root.gaPersistDisplayClockSetting('clockSkin',id);
  if(reopen)current().open();refresh();
 }
 function register(id,provider){if(!/^[a-z][a-z0-9-]*$/.test(id)||!provider||typeof provider.open!=='function'||typeof provider.close!=='function'||typeof provider.isOpen!=='function')throw Error('invalid_clock_skin');providers[id]=provider;refresh();}
 root.GAClockSkins={register:register,select:choose,selected:function(){return selected;},refresh:refresh,open:function(){current().open();refresh();},close:function(){current().close();refresh();},isOpen:function(){return !!current().isOpen();}};
 function install(){
  var open=root.openMapUtilityTool,close=root.closeMapUtilityTool,toggle=root.toggleMapUtilityTool,isOpen=root.isMapUtilityToolOpen;if(!open||!close||!toggle||!isOpen)return;
  register('stopwatch',{label:'Stoppuhr',open:function(){open('stopwatch');},close:function(){close('stopwatch');},isOpen:function(){return isOpen('stopwatch');}});
  register('watch',{label:'A Watch',open:function(){if(root.gaMediaPlayerClient)root.gaMediaPlayerClient.openClock();},close:function(){if(root.gaMediaPlayerClient)root.gaMediaPlayerClient.closeClock();},isOpen:function(){return !!(root.gaMediaPlayerClient&&root.gaMediaPlayerClient.isClockOpen());}});
  if(!providers[selected])selected='stopwatch';
  root.openMapUtilityTool=function(tool){if(tool==='stopwatch'){current().open();refresh();return;}return open(tool);};
  root.closeMapUtilityTool=function(tool){if(tool==='stopwatch'){current().close();refresh();return;}return close(tool);};
  root.isMapUtilityToolOpen=function(tool){return tool==='stopwatch'?!!current().isOpen():isOpen(tool);};
  root.toggleMapUtilityTool=function(tool){if(tool!=='stopwatch')return toggle(tool);var p=current();if(p.isOpen()){p.close();refresh();return false;}p.open();refresh();return true;};
  var select=root.document.getElementById('mapClockSkin');if(select)select.onchange=function(){choose(select.value);};refresh();
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install);else install();
})(window);
