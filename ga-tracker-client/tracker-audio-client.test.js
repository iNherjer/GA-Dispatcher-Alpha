'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/tracker-audio-client.js', 'utf8');
const download = source.slice(source.indexOf('  async function fetchClip('), source.indexOf('  function message('));
test('remote voice download preserves bytes with at most four chunks in flight', async () => {
  const original = Buffer.alloc(702764); for (let i=0;i<original.length;i++) original[i]=i%251;
  let active=0, peak=0; const offsets=[];
  const context = { base:'',local:false,root:{atob},Uint8Array,Number,Promise,Error,encodeURIComponent,
    request: async ({offset}) => {
      offsets.push(offset); active++; peak=Math.max(peak,active);
      await new Promise(r=>setTimeout(r,5));active--;
      return {offset,total:original.length,data:original.subarray(offset,offset+24*1024).toString('base64')};
    }
  };
  vm.createContext(context);vm.runInContext(download,context);
  const result=await context.fetchClip({effectId:'voice'},'audio');
  assert.deepEqual(Buffer.from(result),original);
  assert.equal(peak,4);
  assert.equal(new Set(offsets).size,Math.ceil(original.length/(24*1024)));
});
