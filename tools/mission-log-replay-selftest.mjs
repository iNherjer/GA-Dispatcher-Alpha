#!/usr/bin/env node

import fs from 'node:fs';
import replayCore from './mission-log-replay-core.js';

const filename = process.argv[2];
const runId = process.argv[3] || '';
if (!filename) {
  console.error('Aufruf: node tools/mission-log-replay-selftest.mjs <GA-APT-Missionstest.txt> [runId]');
  process.exitCode = 2;
} else {
  const parsed = replayCore.parseMissionTestLog(fs.readFileSync(filename, 'utf8'));
  const run = replayCore.selectReplayRun(parsed, { runId });
  if (!run) {
    console.error('Kein replaybarer MISSION_EXECUTION_CHECKPOINT-Lauf im Log gefunden.');
    process.exitCode = 3;
  } else {
    const report = replayCore.simulateComplianceReplay(run);
    console.log(JSON.stringify(report, null, 2));
  }
}
