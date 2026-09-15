'use strict';
// Local high-rate input for the original 3.5-second comfort analysis. No I/O.
function createFlightMotionBuffer() {
  let run = null, samples = [], lastAt = null;
  function clear(runId = null) { run = runId; samples = []; lastAt = null; }
  return {
    clear,
    observe(sample, runId) {
      if (run !== runId) clear(runId);
      if (!runId || sample.simPaused || sample.inMenuOrMap) { clear(runId); return; }
      const at = sample.observedAt;
      if (!['observedAt', 'gForce', 'bankDeg', 'vsFpm'].every(key => typeof sample[key] === 'number' && Number.isFinite(sample[key]))) {
        clear(runId); return;
      }
      if (lastAt != null && at <= lastAt) return;
      if (lastAt != null && at - lastAt > 750) samples = [];
      if (lastAt != null && at - lastAt < 100) return;
      lastAt = at;
      samples.push({ t: at, g: sample.gForce, bank: sample.bankDeg, vs: sample.vsFpm,
        pitch: typeof sample.pitchDeg === 'number' ? sample.pitchDeg : NaN });
      samples = samples.filter(row => row.t >= at - 3500).slice(-48);
    },
    read(at, runId) {
      if (run !== runId || lastAt == null || at - lastAt > 750) return [];
      return samples.filter(row => row.t < at && row.t >= at - 3500).map(row => ({ ...row }));
    }
  };
}
module.exports = { createFlightMotionBuffer };
