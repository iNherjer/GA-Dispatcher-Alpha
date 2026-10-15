'use strict';
const http = require('node:http');
function createMediaBridge(env = process.env) {
  const port = Number(env.VFR_MULTITOOL_MEDIA_PORT), token = String(env.VFR_MULTITOOL_MEDIA_TOKEN || '');
  const available = Number.isInteger(port) && port > 0 && port < 65536 && /^[a-f0-9]{64}$/.test(token);
  return { available, request(payload) {
    if (!available) return Promise.resolve({ok:false,error:'media_desktop_unavailable'});
    return new Promise(resolve => {
      const bytes = Buffer.from(JSON.stringify(payload));
      const request = http.request({host:'127.0.0.1',port,path:'/media',method:'POST',headers:{'Content-Type':'application/json','Content-Length':bytes.length,'X-GA-Media-Token':token}},response => {
        const chunks=[];let size=0;
        response.on('data',chunk=>{size+=chunk.length;if(size>65536){response.destroy();return;}chunks.push(chunk);});
        response.on('error',()=>resolve({ok:false,error:'media_desktop_unavailable'}));
        response.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(_){resolve({ok:false,error:'media_response_invalid'});}});
      });
      request.setTimeout(30000,()=>request.destroy());
      request.on('error',()=>resolve({ok:false,error:'media_desktop_unavailable'}));request.end(bytes);
    });
  }};
}
module.exports = {createMediaBridge};
