const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TrackerProcess } = require('../lib/tracker-process');

test('tracker process relays child output into UI status without a real simulator', async () => {
  const tracker = new TrackerProcess({
    electronApp: { isPackaged: false },
    dataDirectory: path.join(os.tmpdir(), 'vfr-tracker-process-test'),
    getCredentials: () => ({ pilotId: 'Test', pin: '1234' })
  });
  tracker.executableSpec = () => ({
    command: process.execPath,
    args: [
      '-e',
      [
        "console.log('Verbinde mit WebSocket-Server: wss://example.test');",
        "console.log('📡 Relay verbunden für Pilot-ID: Test');",
        "console.log('✈️ MSFS gefunden! Warte auf Positionsdaten...');",
        "console.log('GPS Lat 48.1504 | Lon 7.7099 | Alt 600ft');"
      ].join('')
    ],
    cwd: os.tmpdir(),
    env: process.env
  });

  const states = [];
  tracker.on('state', (state) => states.push(state));
  const exited = new Promise((resolve) => tracker.once('exit', resolve));
  assert.deepEqual(tracker.start(), { ok: true });
  await exited;

  assert.ok(states.some((state) => state.relay === 'connected'));
  assert.ok(states.some((state) => state.simulator === 'connected'));
  assert.ok(states.some((state) => state.telemetry === 'live'));
  assert.ok(tracker.publicState().logs.some((entry) => entry.line.includes('Relay verbunden')));
});

test('desktop credentials use stdin and are not copied into the child environment', () => {
  const tracker = new TrackerProcess({
    electronApp: { isPackaged: false },
    dataDirectory: path.join(os.tmpdir(), 'vfr-tracker-process-test'),
    getRuntimeChannel: () => 'alpha',
    getAptMissionExecutionEnabled: () => true,
    getCredentials: () => ({
      pilotId: 'Pipe-Pilot',
      pin: '1234',
      voice: { provider: 'openai', apiKey: 'sk-pipe-secret' }
    })
  });
  const spec = tracker.executableSpec();
  assert.deepEqual(spec.credentials, {
    pilotId: 'Pipe-Pilot',
    pin: '1234',
    voice: { provider: 'openai', apiKey: 'sk-pipe-secret' }
  });
  assert.equal(spec.env.VFR_MULTITOOL_TRACKER_SYNC_ID, undefined);
  assert.equal(spec.env.VFR_MULTITOOL_TRACKER_PIN, undefined);
  assert.equal(Object.values(spec.env).includes('sk-pipe-secret'), false);
  assert.equal(spec.env.VFR_MULTITOOL_TRACKER_HEADLESS, '1');
  assert.equal(spec.env.VFR_MULTITOOL_TRACKER_CHANNEL, 'alpha');
  assert.equal(spec.env.VFR_MULTITOOL_APT_EXECUTION, '1');
});

test('APT execution opt-in is forced off outside Alpha and overrides inherited process state', () => {
  const inherited = process.env.VFR_MULTITOOL_APT_EXECUTION;
  process.env.VFR_MULTITOOL_APT_EXECUTION = '1';
  try {
    const stable = new TrackerProcess({
      electronApp: { isPackaged: false },
      dataDirectory: path.join(os.tmpdir(), 'vfr-tracker-process-stable-test'),
      getRuntimeChannel: () => 'stable',
      getAptMissionExecutionEnabled: () => true,
      getCredentials: () => ({ pilotId: 'Stable-Pilot', pin: '1234' })
    });
    const alphaOff = new TrackerProcess({
      electronApp: { isPackaged: false },
      dataDirectory: path.join(os.tmpdir(), 'vfr-tracker-process-alpha-off-test'),
      getRuntimeChannel: () => 'alpha',
      getAptMissionExecutionEnabled: () => false,
      getCredentials: () => ({ pilotId: 'Alpha-Pilot', pin: '1234' })
    });
    assert.equal(stable.executableSpec().env.VFR_MULTITOOL_APT_EXECUTION, '0');
    assert.equal(alphaOff.executableSpec().env.VFR_MULTITOOL_APT_EXECUTION, '0');
  } finally {
    if (inherited === undefined) delete process.env.VFR_MULTITOOL_APT_EXECUTION;
    else process.env.VFR_MULTITOOL_APT_EXECUTION = inherited;
  }
});
