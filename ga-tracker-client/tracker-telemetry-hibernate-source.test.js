const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const trackerSource = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
const appSyncSource = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(__dirname, '..', 'profile.js'), 'utf8');

test('tracker status reports hibernate while full relay telemetry is gated', () => {
  assert.match(trackerSource, /telemetryMode: _telemetryHibernateState\.mode/);
  assert.match(trackerSource, /telemetryHibernateReason: _telemetryHibernateState\.reason \|\| null/);
  assert.match(trackerSource, /telemetryIntervalMs: _telemetryHibernateState\.mode === 'hibernate' \? 5000 : 500/);
  assert.match(trackerSource, /currentTelemetryHibernateState = telemetryHibernateController\.update/);
  assert.match(trackerSource, /currentTelemetryHibernateState\.shouldSendTelemetry/);
  assert.match(trackerSource, /if \(currentTelemetryHibernateState\.hibernating\)/);
  assert.match(trackerSource, /telemetryLastPosition:/);
  assert.match(trackerSource, /telemetryHibernateController\.wake/);
  assert.match(trackerSource, /tracker_telemetry_wake_ack/);
  assert.match(trackerSource, /homebaseManager\?\.isCrewSceneCurrent\(command\) \? 'crew-scene-unchanged'/);
  assert.match(trackerSource, /TRACKER_TELEMETRY_WAKE_SKIP/);
});

test('web app renders hibernate separately from live telemetry and reports it in diagnostics', () => {
  assert.match(appSyncSource, /ind\.textContent = `🛰️ HIB/);
  assert.match(appSyncSource, /window\.liveTrackerTelemetryMode === 'hibernate'/);
  assert.match(appSyncSource, /_setLiveGpsIndicator\('hibernate', data\)/);
  assert.match(appSyncSource, /requestTrackerTelemetryWake/);
  assert.match(appSyncSource, /_rememberTrackerHibernatePosition/);
  assert.match(appSyncSource, /app-open-hibernate/);
  assert.match(profileSource, /telemetry=\$\{window\.liveTrackerTelemetryMode/);
});
