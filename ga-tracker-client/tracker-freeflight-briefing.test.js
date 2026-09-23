'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const host = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'utf8');

test('tracker EFB renders bounded freeflight briefing as text and hides it for mission maps', () => {
  const start = host.indexOf('function updateFreeflightBriefing(snapshot) {');
  const end = host.indexOf('\n  function renderMapPayload(payload) {', start);
  assert.ok(start >= 0 && end > start, 'briefing renderer is present before map payload renderer');
  const renderer = host.slice(start, end);

  class Element {
    constructor() { this.style = {}; this.children = []; this.attributes = {}; this.parentNode = null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    appendChild(child) { this.children.push(child); child.parentNode = this; }
    insertBefore(child, before) {
      const index = this.children.indexOf(before);
      this.children.splice(index < 0 ? 0 : index, 0, child);
      child.parentNode = this;
    }
    querySelector(selector) {
      const role = selector.match(/data-role="([^"]+)"/);
      return role ? this.children.find(child => child.attributes['data-role'] === role[1]) : null;
    }
  }
  const container = new Element();
  const progress = new Element();
  container.children.push(progress);
  progress.parentNode = container;
  const document = {
    createElement: () => new Element(),
    querySelector: selector => selector === '.maptable-content' ? container : null
  };
  const byId = id => id === 'routeProgressBar' ? progress : null;
  const update = new Function('document', 'byId', `var freeflightBriefingCard = null; ${renderer}; return updateFreeflightBriefing;`)(document, byId);
  update({ navigationOnly: true, briefing: { title: '<b>Route</b>', story: '<img src=x onerror=alert(1)>' } });
  const card = container.children[0];
  assert.equal(card.id, 'trackerFreeflightBriefing');
  assert.equal(card.children[0].textContent, '<b>Route</b>');
  assert.equal(card.children[1].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(card.style.display, 'block');
  assert.match(card.style.cssText, /max-height:150px; overflow:auto/);
  assert.equal(container.children[1], progress, 'card is inserted above route progress');
  const longStory = 'x'.repeat(2000);
  update({ navigationOnly: true, briefing: { title: 'Full briefing', story: longStory } });
  assert.equal(card.children[1].textContent, longStory, 'valid long story is preserved in the scrollable card');
  update({ navigationOnly: false, briefing: { title: 'Mission', story: 'Mission story' } });
  assert.equal(card.style.display, 'none', 'mission maps hide the freeflight card');
  assert.equal(card.children[0].textContent, 'Full briefing', 'hidden mission update does not alter the previous display text');

  const mapRenderer = host.slice(end, host.indexOf('\n  function missionRenderSignature', end));
  assert.match(mapRenderer, /payload\.navigationOnly === true[\s\S]*?updateFreeflightBriefing\(normalized\)/);
  assert.match(host, /function clearMapRoute\(\) \{[\s\S]*?updateFreeflightBriefing\(null\)/);
});
