// Package this entry with the tracker package.json to verify the EXE asset path.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fonts = require('../ga-tracker-client/tracker-efb-fonts');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const context = { window: {} };
vm.runInNewContext(fonts.clientFontSource(), context);
assert.equal(context.window.gaEfbFontFallback('12px monospace'), fonts.fontFallback('12px monospace'));
for (const asset of ['emoji-text.js', 'symbols.js', 'audio-player.js']) {
  const source = efb.getTrackerEfbWebClientAsset('/efb/v1/assets/' + asset).body.toString();
  new vm.Script(source, { filename: asset });
  assert.doesNotMatch(source, /\[native code\]/);
  assert.doesNotMatch(source, /!\s*await\b/, 'Coherent requires a parenthesized awaited condition');
}
console.log(JSON.stringify({ok:true,packaged:!!process.pkg,helperSourceStripped:/\[native code\]/.test(fonts.fontDeclarations.toString())}));
