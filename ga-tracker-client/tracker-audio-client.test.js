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

test('phone gestures unlock before handoff and cached-page restore recreates the stopped player', async () => {
  const listeners = {}, players = [], timers = new Map(); let nextTimer = 0, authoritative = false;
  const root = {document:{getElementById:()=>null},localStorage:{getItem:()=> 'phone'},
    gaCockpitSessionClient:{role:'web',clientId:'session'},
    gaTrackerExecutionHandlesMission:()=>authoritative,
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    GATrackerAudioPlayer:{createPlayer:()=>{const player={unlocks:0,pumps:0,stopped:false,
      update(){},unlock(){this.unlocks++;return Promise.resolve(true);},pump(){this.pumps++;},stop(){this.stopped=true;return Promise.resolve();}};
      players.push(player);return player;}}};
  vm.runInNewContext(source,{window:root,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
  root.gaTrackerAudioClient.apply({schema:'ga.audio-control.v1',updatedAt:1,target:{deviceId:'phone'},settings:{enabled:true}});
  listeners.touchend();
  assert.equal(players[0].unlocks,1,'resume is called synchronously in the touch handler');
  await Promise.resolve();assert.equal(players[0].pumps,0,'no playback before execution handoff');
  listeners.pagehide();assert.equal(players[0].stopped,true);assert.equal(timers.size,0);
  authoritative=true;listeners.pageshow();assert.equal(players.length,2);assert.equal(timers.size,1);
  listeners.pageshow();assert.equal(players.length,2,'ordinary pageshow does not duplicate player');
  listeners.click();await Promise.resolve();assert.equal(players[1].unlocks,1);assert.equal(players[1].pumps,1);
  listeners.pagehide();listeners.pageshow();assert.equal(players.length,3);assert.equal(timers.size,1);
});
