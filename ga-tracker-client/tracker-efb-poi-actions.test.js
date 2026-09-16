'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./tracker-efb-kartentisch-host.js'), 'utf8');

test('App loads POI dependencies in HTML order and can execute the browser action core', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script defer src="(mission-poi-(?:task|voice)-core\.js)[^"]*"/g)].map(match => match[1]);
  assert.equal(scripts.length, 2);
  const browser = vm.createContext({});
  for (const script of scripts) vm.runInContext(fs.readFileSync(require.resolve('../' + script), 'utf8'), browser);
  const core = browser.GAMissionPoiVoiceCore;
  const result = core.renderAction({ schema: core.CONTEXT_SCHEMA, version: 1, missionId: 'browser',
    taskDomain: 'media_photo', strict: true, audioEnabled: false, baseContext: 'Fotografin.',
    passenger: { targetRadiusNm: 1.5, targetDwellMin: 2, targetAltFt: 3000 } },
    'poi_orientation', {}, { lat: 48, lon: 8, mslFt: 3000, hdg: 90 }, { lat: 48.3, lon: 8.5 });
  assert.match(result.fallbackText, /Steuerkurs .*Entfernung/);
});

function harness() {
  const nodes = new Map(), calls = [];
  function element() {
    const node = { children: [], style: {}, hidden: false, classList: { toggle() {}, remove() {}, add() {} }, setAttribute() {},
      appendChild(child) { this.children.push(child); child.parentNode = this; if (child.id) nodes.set(child.id, child); },
      set textContent(value) { this.text = value; this.children = []; }, get textContent() { return this.text; } };
    return node;
  }
  const host = element(), toolbar = element(), primary = element();
  primary.id = 'mapMissionToggleBtn'; toolbar.appendChild(primary);
  const context = vm.createContext({ document: { createElement: element, body: element() }, byId: id => nodes.get(id),
    window: { GANavigationWarningPresentation: { getBannerHost: () => host } },
    initEfbPaxDrag() {}, missionIntentPending: false, missionToolbarProjection: () => ({}),
    requestMissionIntent: (intent, payload) => calls.push({ intent, payload }) });
  vm.runInContext(source.slice(source.indexOf('  var paxWidgetRun'), source.indexOf('  function renderMissionActionBanner')), context);
  return { context, nodes, host, calls };
}

test('EFB POI controls send tracker intents and follow confirmed availability', () => {
  const h = harness();
  h.context.renderMissionToolbar({ control: { recipe: 'poi', phase: 'active', allowedActions: ['poi_status', 'poi_orientation'] } });
  const status = h.nodes.get('gaEfbPoiAction0'), orientation = h.nodes.get('gaEfbPoiAction1');
  assert.equal(status.disabled, false);
  status.onclick({ stopPropagation() {} }); orientation.onclick({ stopPropagation() {} });
  assert.deepEqual(h.calls.map(call => call.intent), ['poi_status', 'poi_orientation']);
  h.context.renderMissionToolbar({ control: { recipe: 'poi', phase: 'active', allowedActions: [] } });
  assert.equal(status.disabled, true);
  h.context.missionIntentPending = true;
  h.context.renderMissionToolbar({ control: { recipe: 'poi', phase: 'active', allowedActions: ['poi_status'] } });
  assert.equal(status.disabled, true);
  h.context.renderMissionToolbar({ control: { recipe: 'apt', phase: 'active', allowedActions: [] } });
  assert.equal(status.style.display, 'none');
  assert.equal(orientation.style.display, 'none');
  assert.match(source, /renderBoardBookReminder\(nextControl\);\s*renderPaxWidget\(next\);/);
});

test('PAX button reopens the last confirmed APT or POI message and holds the allowed actions', () => {
  const h = harness();
  const payload = { available:true, missionId:'m',runId:'r',control:{runId:'r',recipe:'poi',phase:'active',allowedActions:['poi_status']},
    voice:{kind:'boarding',speaker:{name:'Mia'},text:'<b>Hallo Pilot</b>',updatedAt:1} };
  h.context.renderMissionToolbar(payload);
  const panel = h.nodes.get('paxVoicePanel'), button = h.nodes.get('paxVoiceBtn');
  assert.equal(h.nodes.get('paxUnreadBadge').hidden,false);
  assert.equal(panel.hidden,true);button.onclick();assert.equal(panel.hidden,false);
  assert.equal(h.nodes.get('paxUnreadBadge').hidden,true);
  assert.equal(h.nodes.get('paxVoiceText').textContent,payload.voice.text);
  assert.equal(h.nodes.get('paxVoiceName').textContent,'Mia');
  assert.equal(h.nodes.get('gaEfbPoiAction0').parentNode.id,'paxMissionActionMenu');
  panel.children[0].onclick();assert.equal(panel.hidden,true);
  h.context.renderMissionToolbar({...payload,voice:{...payload.voice,updatedAt:99,playback:'completed'}});
  assert.equal(h.nodes.get('paxUnreadBadge').hidden,true,'late ACK is not a new message');
  h.context.renderMissionToolbar({...payload,voice:{...payload.voice,text:'Neue Meldung'}});
  assert.equal(h.nodes.get('paxUnreadBadge').hidden,false);
  button.onclick(); panel.children[0].onclick();
  h.context.renderMissionToolbar(payload);assert.equal(panel.hidden,true,'polling never reopens the panel');
  button.onclick();assert.equal(panel.hidden,false);
  h.context.renderMissionToolbar({...payload,runId:'new',control:{runId:'new',recipe:'apt',phase:'active',allowedActions:[]},voice:null});
  assert.equal(panel.hidden,true); assert.equal(h.nodes.get('paxVoiceText').textContent,'Noch keine Nachricht.');
  h.context.renderPaxWidget(null);assert.equal(h.nodes.get('paxVoiceWidget').hidden,true);
});
