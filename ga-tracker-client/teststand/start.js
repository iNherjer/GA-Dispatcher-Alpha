'use strict';
// Test-only composition root: production tracker.js and its mission handlers are unchanged.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { Simulator } = require('./simulator');
const { startServer } = require('./server');
async function main() {
  if (process.argv.includes('--self-check')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    if (!html.includes('Simulator-Teststand')) throw new Error('teststand_ui_missing');
    require('../tracker-efb-web-client');
    for (const asset of ['efb-web-assets/kartentisch-fragment.html', 'efb-web-assets/styles.css', 'tracker-audio-player.js', 'tracker-audio-client.js']) {
      if (!fs.readFileSync(path.join(__dirname, '..', asset)).length) throw new Error('empty_asset:' + asset);
    }
    console.log(JSON.stringify({ ok: true, teststand: 'v388', packaged: Boolean(process.pkg), uiBytes: Buffer.byteLength(html) }));
    return;
  }
  const demo = process.argv.includes('--demo');
  const directory = process.env.GA_TESTSTAND_DATA_DIR ? path.resolve(process.env.GA_TESTSTAND_DATA_DIR)
    : process.pkg ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'VFR Multitool', 'Teststand-v388')
    : fs.mkdtempSync(path.join(os.tmpdir(), 'ga-teststand-'));
  fs.mkdirSync(directory, { recursive: true });
  const simulator = new Simulator();
  const journal = fs.createWriteStream(path.join(directory, 'simulator-events.jsonl'), { flags: 'a' });
  simulator.on('journal', row => journal.write(JSON.stringify(row) + '\n'));
  // A separate EFB port avoids accidentally controlling an already running normal tracker.
  const trackerPort = Number(process.env.GA_TESTSTAND_TRACKER_PORT || 18788);
  const server = await startServer(simulator, { port: Number(process.env.GA_TESTSTAND_PORT || 18789), trackerPort: demo ? 0 : trackerPort });
  console.log(`\nTESTSTAND – kein echter MSFS\nBedienung: http://127.0.0.1:${server.address().port}/\nTestdaten: ${directory}\n`);
  if (process.platform === 'win32' && !process.argv.includes('--no-browser')) {
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', `http://127.0.0.1:${server.address().port}/`], { windowsHide: true }, error => {
      if (error) console.error('Browser bitte ueber die oben angezeigte Adresse oeffnen.');
    });
  }
  if (demo) { simulator.connect(); console.log('Nur Simulator-Demo; keine Missionsausführung.'); return; }
  // Only this launcher substitutes open(). All SimConnect values/buffers and the tracker remain real.
  const simPath = require.resolve('node-simconnect');
  require.cache[simPath].exports = { ...require('node-simconnect'), open: async () => simulator.connect() };
  const storagePath = require.resolve('../tracker-storage'); const storage = require('../tracker-storage');
  // Never migrate/move a user's production config into a test directory.
  require.cache[storagePath].exports = { ...storage, prepareTrackerStorage: () => ({ dataDirectory: directory, preferredDirectory: directory, migrated: [], events: ['TESTSTAND_ISOLATED_STORAGE'] }) };
  process.chdir(directory);
  process.env.VFR_MULTITOOL_TRACKER_DATA_DIR = directory;
  process.env.VFR_MULTITOOL_EFB_PORT = String(trackerPort);
  process.env.VFR_MULTITOOL_TRACKER_CHANNEL = 'alpha';
  process.env.VFR_MULTITOOL_APT_EXECUTION = '1';
  process.env.VFR_MULTITOOL_TRACKER_HEADLESS = '0';
  // This terminal launcher has no desktop player. Keep existing browser audio capabilities.
  delete process.env.VFR_MULTITOOL_DESKTOP_AUDIO_PLAYER;
  delete process.env.VFR_MULTITOOL_DESKTOP_CONTROL_TOKEN;
  console.log(`Tracker-EFB: http://127.0.0.1:${trackerPort}/efb/v1/\nMit separater Test-Pilot-ID anmelden; App mit derselben Test-ID verbinden.\n`);
  require('../tracker.js');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
