'use strict';
// Explains why a 1 Hz start-readiness packet arrived late. Three suspects:
// - tracker_busy:     the tracker's own event loop was blocked, so it read the packet late
// - simulator_stall:  the frame-based main telemetry was silent too, so the sim itself stood still
// - readiness_link:   frames kept coming, only this SimConnect SECOND packet was late
// Diagnostic only; it never changes readiness.
function createLoopDelayProbe() {
  try {
    const { monitorEventLoopDelay } = require('node:perf_hooks');
    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    return {
      maxMs: () => (histogram.count > 0 ? Math.round(histogram.max / 1e6) : 0),
      reset: () => histogram.reset(),
      stop: () => histogram.disable()
    };
  } catch (_) { return null; }
}

function classifyGap({ gapMs, loopMs, mainGapMs, expectedMs }) {
  const excess = Math.max(1, gapMs - expectedMs);
  if (Number.isFinite(loopMs) && loopMs >= excess * 0.5) return 'tracker_busy';
  if (Number.isFinite(mainGapMs) && mainGapMs >= excess * 0.5) return 'simulator_stall';
  return 'readiness_link';
}

function createReadinessGapMonitor({ now = Date.now, log = () => {}, loopDelay = null,
  expectedMs = 1000, lateMs = 2000, summaryEveryMs = 60000 } = {}) {
  let lastPacketAt = null, mainLastAt = null, mainMaxGapMs = 0;
  let windowStartedAt = null, packets = 0, late = 0, worstMs = 0;
  const counts = { tracker_busy: 0, simulator_stall: 0, readiness_link: 0 };
  const clearWindow = at => {
    windowStartedAt = at; packets = 0; late = 0; worstMs = 0;
    for (const key of Object.keys(counts)) counts[key] = 0;
  };
  const noteMainTelemetry = () => {
    const at = now();
    if (mainLastAt !== null && at >= mainLastAt) mainMaxGapMs = Math.max(mainMaxGapMs, at - mainLastAt);
    mainLastAt = at;
  };
  const notePacket = () => {
    const at = now();
    const gapMs = lastPacketAt === null ? null : at - lastPacketAt;
    // Include the still-open main interval: a sim stall that is still
    // running has no closing frame yet.
    const mainGapMs = mainLastAt === null ? null : Math.max(mainMaxGapMs, Math.max(0, at - mainLastAt));
    const loopMs = loopDelay ? loopDelay.maxMs() : null;
    loopDelay?.reset();
    lastPacketAt = at; mainMaxGapMs = 0;
    if (windowStartedAt === null) clearWindow(at);
    if (gapMs !== null) packets++;
    let result = null;
    if (gapMs !== null && gapMs >= lateMs) {
      const cause = classifyGap({ gapMs, loopMs, mainGapMs, expectedMs });
      late++; counts[cause]++; worstMs = Math.max(worstMs, gapMs);
      log(`MISSION_START_SOURCE_LATE gapMs=${gapMs} trackerLoopMaxMs=${loopMs ?? 'n/a'} mainTelemetryMaxGapMs=${mainGapMs ?? 'n/a'} likely=${cause}`);
      result = { gapMs, loopMs, mainGapMs, cause };
    }
    if (at - windowStartedAt >= summaryEveryMs) {
      if (late > 0) log(`MISSION_START_SOURCE_LATE_SUMMARY windowMs=${at - windowStartedAt} packets=${packets} late=${late} worstMs=${worstMs} trackerBusy=${counts.tracker_busy} simulatorStall=${counts.simulator_stall} readinessLink=${counts.readiness_link}`);
      clearWindow(at);
    }
    return result;
  };
  // A new connection or lost packet stream starts a fresh measurement.
  const reset = () => { lastPacketAt = null; mainMaxGapMs = 0; loopDelay?.reset(); };
  return { notePacket, noteMainTelemetry, reset };
}

module.exports = { createReadinessGapMonitor, createLoopDelayProbe, classifyGap };
