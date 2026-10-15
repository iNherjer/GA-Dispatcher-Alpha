'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { normalizeMediaCommand, mediaStateChanged } = require('./media-core');
// Private loopback bridge. Only the child runtime receives its random token.
function createMediaServer(media) {
  const token = crypto.randomBytes(32).toString('hex');
  const serverId = crypto.randomBytes(8).toString('hex');
  let server, cached=null, revision=0, anchorAt=0, polling=false, timer=null;
  const watchers = new Set();
  function snapshot(value) {
    const { id, ...next } = value;
    next.sampledAt = Date.now();
    if (mediaStateChanged(cached,next,anchorAt)) { cached=next;revision++;anchorAt=next.sampledAt; }
    return {...cached,revision,serverId,sampleAgeMs:Math.max(0,Date.now()-cached.sampledAt),changed:true};
  }
  function finish(watcher,value) {if(!watchers.delete(watcher))return;clearTimeout(watcher.timer);watcher.resolve(value);}
  async function poll() {
    timer=null;if(polling||!watchers.size)return;polling=true;
    try {
      const result=snapshot(await media.request({action:'snapshot'}));
      for(const watcher of watchers)if(!result.ok||watcher.after!==revision)finish(watcher,result);
    } catch (_) {for(const watcher of watchers)finish(watcher,{ok:false,error:'media_desktop_unavailable'});}
    finally {polling=false;if(watchers.size)timer=setTimeout(poll,1000);}
  }
  function watch(after) {
    if(cached?.ok && after!==revision)return Promise.resolve({...cached,revision,serverId,sampleAgeMs:Math.max(0,Date.now()-cached.sampledAt),changed:true});
    if(watchers.size>=8)return Promise.resolve({ok:false,error:'media_watch_limit'});
    return new Promise(resolve=>{const watcher={after,resolve,timer:setTimeout(()=>finish(watcher,{ok:true,revision,changed:false}),15000)};watchers.add(watcher);if(!polling&&!timer)poll();});
  }
  async function handle(payload) {
    const command=normalizeMediaCommand(payload);
    if(command.action==='watch')return watch(command.after);
    const result=await media.request({...command,clientId:'remote-'+payload.clientId});
    if(command.action==='duck')return result;
    const updated=snapshot(result);
    for(const watcher of watchers)if(watcher.after!==revision)finish(watcher,updated);
    return updated;
  }
  return { async start() {
    server=http.createServer(async(request,response)=>{
      const respond=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
      const provided=String(request.headers['x-ga-media-token']||'');
      const providedBytes=Buffer.from(provided),expectedBytes=Buffer.from(token);
      if(request.method!=='POST'||request.url!=='/media'||providedBytes.length!==expectedBytes.length||!crypto.timingSafeEqual(providedBytes,expectedBytes)) {request.resume();respond(403,{ok:false,error:'media_access_denied'});return;}
      try {
        let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>4096)throw new Error('media_request_too_large');}
        const payload=JSON.parse(body);
        if(!/^[A-Za-z0-9._:-]{1,220}$/.test(payload.clientId||''))throw new Error('media_client_invalid');
        respond(200,await handle(payload));
      }catch(error){if(!response.writableEnded)respond(400,{ok:false,error:error.message});}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    return {port:server.address().port,token};
  }, async close() {
    clearTimeout(timer);for(const watcher of watchers)finish(watcher,{ok:false,error:'media_desktop_unavailable'});
    if(server)await new Promise(resolve=>server.close(resolve));
  }};
}
module.exports = {createMediaServer};
