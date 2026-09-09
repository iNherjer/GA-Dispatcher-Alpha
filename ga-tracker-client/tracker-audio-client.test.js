'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/tracker-audio-client.js', 'utf8');
const download = source.slice(source.indexOf('  async function fetchClip('), source.indexOf('  function message('));
test('local audio polling and settings updates recover after a stalled HTTP response', async () => {
  const { requestJson } = require('./tracker-cockpit-session-client');
  const timers = [], updates = [], calls = [];
  const audio = { schema:'ga.audio-control.v1', revision:1, updatedAt:1, target:{deviceId:'pc'}, settings:{enabled:true} };
  let reads=0, writes=0;
  const root = { document:{getElementById:()=>null}, localStorage:{getItem:()=> 'efb'},
    gaCockpitSessionClient:{role:'efb',clientId:'session',baseUrl:'/api/v1'}, addEventListener(){},
    GATrackerCockpitSessionClient:{requestJson:(fn,url,init)=>requestJson(fn,url,init,20)},
    fetch:async (url, init)=>{
      if (url.endsWith('/settings')) {
        if (++reads===1) return new Promise(()=>{});
        return {ok:true,json:async()=>({audio})};
      }
      calls.push(JSON.parse(init.body));
      if (++writes===1) return new Promise(()=>{});
      return {ok:true,json:async()=>({ok:true,audio})};
    }, GATrackerAudioPlayer:{createPlayer:()=>({update:value=>updates.push(value),stop(){}})} };
  vm.runInNewContext(source,{window:root,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(timers.length,1); timers.shift()(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(updates.at(-1).revision,1);
  await Promise.all([root.gaTrackerAudioClient.change({settings:{volume:.5}}),root.gaTrackerAudioClient.change({settings:{volume:.8}})]);
  assert.equal(calls.length,2,'a timed-out settings write releases the settings queue');
  assert.equal(calls[1].settings.volume,.8);
});
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

test('warning audio fetches static files directly, including zwo fallback, without relay chunks', async () => {
  const calls = [];
  const context = { base: '/api/v1', local: false, root: { GANavigationWarningAudio: require('../navigation-warning-core'),
    fetch: async url => { calls.push(url); return new Response(new Uint8Array([42]), { status: url.includes('aw-zwo') ? 404 : 200 }); } },
    request: () => { throw Error('no warning audio via relay'); } };
  vm.createContext(context); vm.runInContext(download, context);
  const job = { clips: ['aw-zwo','taws-whoop'] };
  assert.deepEqual(Buffer.from(await context.fetchClip(job, 'warning:0', undefined, 'liam')), Buffer.from([42]));
  assert.deepEqual(calls, ['https://inherjer.github.io/GA-Dispatcher-Alpha/audio-warnings/voices/liam/aw-zwo.mp3',
    'https://inherjer.github.io/GA-Dispatcher-Alpha/audio-warnings/voices/liam/aw-d2.mp3']);
  assert.equal(Buffer.from(await context.fetchClip(job, 'warning:1')).toString('ascii', 0, 4), 'RIFF');
  context.local = true; await context.fetchClip({ clips: ['aw-ctr'] }, 'warning:0', undefined, '');
  assert.equal(calls.at(-1), '/api/v1/audio/assets/audio-warnings%2Faw-ctr.m4a');
});
test('all views display a fresh warning once, ignore older snapshots and stop the standalone queue on handoff', () => {
  const shown = [], listeners = {}, updates = []; let stopCount = 0;
  const root = { document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => 'phone' },
    gaCockpitSessionClient: { role: 'web', clientId: 'session' }, addEventListener: (name, fn) => { listeners[name] = fn; },
    awmDisplayTrackerWarning: w => shown.push(w.id), awmStopLocalWarnings: () => stopCount++,
    GATrackerAudioPlayer: { createPlayer: () => ({ update: s => updates.push(s), stop() {} }) } };
  vm.runInNewContext(source, { window: root, setTimeout: () => 1, clearTimeout() {} });
  const state = { schema: 'ga.audio-control.v1', updatedAt: 1, target: { deviceId: 'pc' }, settings: { enabled: true },
    playback: { nowPlaying: { kind: 'airspace', effectId: 'fresh' } },
    warnings: { schema: 'ga.navigation-warnings.v1', active: true, session: 'tracker-1', revision: 2,
      events: [{ id: 'fresh', expiresAt: Date.now() + 60000 }, { id: 'expired', expiresAt: Date.now() - 1000 }] } };
  root.gaTrackerAudioClient.apply(state); root.gaTrackerAudioClient.apply(state);
  root.gaTrackerAudioClient.apply({ ...state, warnings: { ...state.warnings, revision: 1, events: [{ id: 'old', expiresAt: Date.now() + 60000 }] } });
  assert.deepEqual(shown, ['fresh']); assert.equal(stopCount, 1);
  assert.equal(root.gaTrackerWarningsActive(), true, 'warnings work without an active mission');
  assert.equal(updates.at(-1).warnings.revision, 2);
  root.gaTrackerAudioClient.apply({ ...state, warnings: { ...state.warnings, session: 'tracker-2', revision: 0, events: [] } });
  root.gaTrackerAudioClient.apply(state);
  assert.equal(updates.at(-1).warnings.session, 'tracker-2', 'old process packets do not restore warnings after a restart');
  listeners.gatrackercapabilitieschange({ detail: { capabilities: ['audio.output.v1'] } });
  assert.equal(root.gaTrackerWarningsActive(), false, 'compatible downgrade restores standalone triggers');
});
