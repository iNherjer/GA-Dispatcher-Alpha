import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.js');
const sync = read('sync.js');
const index = read('index.html');
const styles = read('styles.css');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0, `section start missing: ${start}`);
    assert.ok(to > from, `section end missing: ${end}`);
    return source.slice(from, to);
}

const dispatchGuardSource = section(app, 'let _dispatchRunId = 0;', 'function _abortDispatchRun');
const dispatchGuardContext = {
    window: { dispatchEvent() {} },
    CustomEvent: class CustomEvent {}
};
vm.runInNewContext(`${dispatchGuardSource}
this.commitAllowed = _dispatchUiCommitAllowed;
this.setDispatchState = state => { _dispatchState = state; };`, dispatchGuardContext);

assert.equal(dispatchGuardContext.commitAllowed({}), true, 'non-dispatch UI calls stay compatible');
dispatchGuardContext.setDispatchState({ active: false, cancelled: false, runId: 7 });
assert.equal(dispatchGuardContext.commitAllowed({ dispatchRunId: 7 }), true, 'current run may finish enrichment after dispatch completion');
assert.equal(dispatchGuardContext.commitAllowed({ dispatchRunId: 6 }), false, 'older dispatch may not overwrite the current mission');
dispatchGuardContext.setDispatchState({ active: false, cancelled: true, runId: 7 });
assert.equal(dispatchGuardContext.commitAllowed({ dispatchRunId: 7 }), false, 'cancelled dispatch may not write UI state');

const generation = section(app, 'async function generateMission(options = {})', '/* =========================================================\n   9. EXTERNE LINKS');
assert.match(generation, /const dispatchUiOptions = \{ dispatchRunId \}/);
assert.match(generation, /fetchRunwayDetails\(start\.lat, start\.lon, 'mDepRwy', currentStartICAO, dispatchUiOptions\)/);
assert.match(generation, /fetchRunwayDetails\(dest\.lat, dest\.lon, 'mDestRwy', currentDestICAO, dispatchUiOptions\)/);
assert.match(generation, /fetchAreaDescription\(start\.lat,[\s\S]{0,220}dispatchUiOptions\)/);
assert.match(generation, /fetchAreaDescription\([\s\S]{0,420}'wikiDestImage',[\s\S]{0,40}dispatchUiOptions/);
assert.match(generation, /fetchAirportFreq\(currentStartICAO,[\s\S]{0,100}dispatchUiOptions\)/);
assert.match(generation, /fetchAirportFreq\(currentDestICAO,[\s\S]{0,100}dispatchUiOptions\)/);
assert.match(generation, /loadMetarWidget\(currentStartICAO,[\s\S]{0,120}dispatchUiOptions\)/);
assert.match(generation, /loadMetarWidget\(missionActsLikePoi \? null : currentDestICAO,[\s\S]{0,140}dispatchUiOptions\)/);
assert.match(generation, /\['wikiDepFreqText', 'wikiDestFreqText', 'metarContainerDep', 'metarContainerDest'\]/);

for (const [name, start, end] of [
    ['METAR', 'async function loadMetarWidget(', 'function calcNav('],
    ['area description', 'async function fetchAreaDescription(', 'function formatOverpassRunwayDetails('],
    ['runway details', 'async function fetchRunwayDetails(', 'const wikiTitleCache = {}'],
    ['airport frequency', 'async function fetchAirportFreq(', '/* =========================================================\n   OPENAIP AIRSPACE LOGIC']
]) {
    const source = section(app, start, end);
    assert.match(source, /const commitAllowed = \(\) => _dispatchUiCommitAllowed\(/, `${name} must use dispatch commit guard`);
    assert.match(source, /if \(!commitAllowed\(\)\) return/, `${name} must stop stale commits`);
}

assert.match(index, /id="missionMainNotification"[\s\S]{0,800}id="missionMainNotificationBtn"/);
assert.match(index, /missionMainNotificationBtn" onclick="window\.handleMissionMainNotificationAction/);
assert.match(styles, /\.mission-main-notification \{[\s\S]{0,260}position: fixed;[\s\S]{0,360}translate\(-50%, calc\(-100% - 28px\)\)/);
assert.match(styles, /\.mission-main-notification\.is-visible \{[\s\S]{0,180}translate\(-50%, 0\)/);
assert.match(sync, /function _syncMissionMainNotificationFromBanner\([\s\S]{0,1800}sourceButton\?\.textContent/);
assert.match(sync, /_updateMissionStartBanner\(\);\s*_syncMissionMainNotificationFromBanner\(\);/);

const mainActionSource = section(sync, 'function _missionMapTableIsOpen()', '// --- LIVE TRAFFIC ---');
const actionOrder = [];
const mapClasses = new Set();
const sourceButton = { disabled: false };
const mainActionContext = {
    document: {
        getElementById(id) {
            if (id === 'mapTableOverlay') return { classList: { contains: name => mapClasses.has(name) } };
            if (id === 'missionStartBannerBtn') return sourceButton;
            return null;
        }
    },
    requestAnimationFrame(callback) { callback(); },
    setTimeout,
    window: {
        openWin95DesktopApp(target) {
            assert.equal(target, 'map');
            actionOrder.push('map');
            mapClasses.add('active');
        },
        async handleMissionStartBannerAction() {
            actionOrder.push('action');
            return true;
        }
    }
};
vm.runInNewContext(`
let missionMainNotificationActionPromise = null;
function _syncMissionMainNotificationFromBanner() {}
function _updateMissionRuntimeUi() {}
${mainActionSource}
this.runMainAction = window.handleMissionMainNotificationAction;
`, mainActionContext);
assert.equal(await mainActionContext.runMainAction(), true);
assert.deepEqual(actionOrder, ['map', 'action'], 'main notification must open map before executing canonical mission action');

console.log('[ok] mission regeneration and main notification selftest');
