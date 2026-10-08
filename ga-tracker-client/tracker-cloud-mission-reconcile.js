'use strict';
const fs = require('node:fs');
const path = require('node:path');
const controlCore = require('../mission-cloud-control-core.js');

function createCloudMissionReconciler({ filename, pilotId, getRun, readLatest, abort, load, clear,
  checkpoint, blocked = () => false, log = () => {} }) {
  let applied = null, inProgress = false;
  try {
    const stored = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (stored.pilotId === pilotId) applied = controlCore.validate(stored.control);
  } catch (error) { if (error.code !== 'ENOENT') log(`MISSION_CLOUD_CONTROL_CHECKPOINT_ERROR error=${error.message}`); }
  function acknowledged(control) {
    return applied?.epoch === control.epoch && applied.revision >= control.revision;
  }
  function valid(result) {
    if (!result?.ok || !result.missionControl) return false;
    try { controlCore.validate(result.missionControl); } catch (_) { return false; }
    const c = result.missionControl;
    if (c.status === 'deleted') return result.status === 'cleared' && !result.candidate;
    return result.status === 'ready' && result.candidate?.missionId?.toLowerCase() === c.missionId.toLowerCase()
      && controlCore.same(result.candidate.missionControl, c);
  }
  async function acknowledge(control) {
    // Persist the authority first: an acknowledgement must not outlive its planned run/cleanup.
    await checkpoint();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const temp = filename + '.tmp';
    await fs.promises.writeFile(temp, JSON.stringify({ version: 1, pilotId, control }), 'utf8');
    await fs.promises.rename(temp, filename);
    applied = { ...control };
  }
  async function reconcile(result) {
    if (inProgress || blocked()) return { ok: false, status: 'pending' };
    if (!valid(result)) return { ok: false, status: 'unversioned' };
    const control = result.missionControl;
    if (acknowledged(control)) return { ok: true, status: 'unchanged' };
    inProgress = true;
    try {
      // A recovered run may already have committed this control before the ACK file was written.
      const recovered = getRun();
      if (control.status === 'active' && recovered?.executionAuthority === 'tracker' && recovered?.missionId?.toLowerCase() === control.missionId.toLowerCase()
          && controlCore.same(recovered.resumeBundle?.cloudMissionControl, control)) {
        await acknowledge(control);
        return { ok: true, status: 'recovered' };
      }
      const latest = await readLatest();
      if (!valid(latest) || !controlCore.same(latest.missionControl, control)) return { ok: false, status: 'cloud_changed' };
      const run = getRun();
      if (run) {
        const stopped = await abort(run, control);
        if (!stopped?.ok) return { ok: false, status: 'cleanup_pending', error: stopped?.error };
      }
      // Cleanup can await the simulator. Never load a mission replaced meanwhile on another device.
      const afterCleanup = await readLatest();
      if (!valid(afterCleanup) || !controlCore.same(afterCleanup.missionControl, control)) {
        return { ok: false, status: 'cloud_changed' };
      }
      if (getRun()) return { ok: false, status: 'run_changed' };
      const cleaned = await clear(control);
      if (!cleaned?.ok) return { ok: false, status: 'cleanup_pending', error: cleaned?.error };
      if (control.status === 'active') {
        const loaded = await load(afterCleanup.candidate, control);
        if (!loaded?.ok) return { ok: false, status: 'load_pending', error: loaded?.error };
      }
      await acknowledge(control);
      log(`MISSION_CLOUD_CONTROL_APPLIED epoch=${control.epoch} revision=${control.revision} status=${control.status} mission=${control.missionId || 'none'}`);
      return { ok: true, status: control.status === 'deleted' ? 'cleared' : 'loaded' };
    } catch (error) {
      log(`MISSION_CLOUD_CONTROL_PENDING revision=${control.revision} error=${error.message}`);
      return { ok: false, status: 'retry', error: error.message };
    } finally { inProgress = false; }
  }
  return { reconcile, busy: () => inProgress, applied: () => applied && { ...applied } };
}
module.exports = { createCloudMissionReconciler };
