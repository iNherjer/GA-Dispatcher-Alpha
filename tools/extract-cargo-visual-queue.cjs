'use strict';
// The standalone app is the behavioral source, not a second implementation.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'mission-cargo-core.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('cargo queue source boundary missing');
  return source.slice(a, b).trim();
}
let body = section('function _missionCargoFlushVisibleItemState(', 'function _missionCargoCancelVisibleItemActions(');
body += '\n\n' + section('function _missionCargoCancelVisibleItemActions(', 'function _missionCargoLoadedItems(');
body = body.replace('window.missionCargoResolveVisibleItemAck = function', 'const resolveAck = function')
  .replace('if (!item || window.simModeActive || !window.liveTrackerConnected || _missionCargoIsPassengerItem(item)) return false;', 'if (!item) return false;')
  .replace('    if (previous?.timer) clearTimeout(previous.timer);', '    if (previous?.timer) { clearTimeout(previous.timer); onSuperseded(previous.desired); }');
const result = `// Generated from mission-cargo-core.js by tools/extract-cargo-visual-queue.cjs.\n'use strict';\nfunction createCargoVisualQueue(options) {\n  const _MISSION_CARGO_OBJECT_ACTION_QUEUE = new Map();\n  let missionCargoObjectActionRevision = Number(options.initialRevision) || 0;\n  const MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS = 180;\n  const setTimeout = options.setTimeout || globalThis.setTimeout;\n  const clearTimeout = options.clearTimeout || globalThis.clearTimeout;\n  const Date = { now: options.now || globalThis.Date.now };\n  const _missionCargoStableObjectKey = options.getObjectKey;\n  const _missionCargoSpawnVisibleItem = options.spawn;\n  const _missionCargoRemoveVisibleItem = options.remove;\n  const onSuperseded = options.onSuperseded || (() => {});\n${body}\n  return { enqueue: _missionCargoQueueVisibleItemState, resolveAck, cancel: _missionCargoCancelVisibleItemActions, peek: key => { const state = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(key); return state?.timer != null ? state.desired : null; } };\n}\nmodule.exports = { createCargoVisualQueue };\n`;
const target = path.join(root, 'ga-tracker-client/tracker-cargo-visual-queue.generated.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== result) throw Error('generated cargo queue differs from standalone');
} else fs.writeFileSync(target, result);
