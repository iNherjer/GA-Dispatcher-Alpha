'use strict';
// Local files for logbook tracks: finished tracks, the free-flight outbox and a crash journal.
// Layout below flightlogs/:
//   tracks/<runId>.json        compact track per flight (mission or free), newest 50 per kind kept
//   free-flight-pending.json   finished free flights not yet taken over by the web app
//   free-flight-active.json    recorder checkpoint of the flight in progress
//   free-flight-active.jsonl   samples of the flight in progress (crash recovery)
// Concept: docs/Flugbuch Kruemelweg Konzept.md

const fs = require('fs');
const path = require('path');
const trackCodec = require('../flight-track-codec-core.js');

const TRACK_SCHEMA = 'ga.flight-track-file.v1';

function safeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function createFlightTrackStore(options = {}) {
  const io = options.fs || fs;
  const directory = path.resolve(options.directory || path.join(process.cwd(), 'flightlogs'));
  const trackDir = path.join(directory, 'tracks');
  const keepPerKind = Math.max(1, Number(options.keepPerKind) || 50);
  const log = typeof options.log === 'function' ? options.log : () => {};
  const files = {
    pending: path.join(directory, 'free-flight-pending.json'),
    active: path.join(directory, 'free-flight-active.json'),
    journal: path.join(directory, 'free-flight-active.jsonl')
  };
  io.mkdirSync(trackDir, { recursive: true });

  const writeJson = (file, value) => {
    const temporary = `${file}.tmp-${process.pid}`;
    io.writeFileSync(temporary, JSON.stringify(value), 'utf8');
    io.renameSync(temporary, file);
  };
  const readJson = file => {
    try { return JSON.parse(io.readFileSync(file, 'utf8')); } catch (_) { return null; }
  };
  const remove = file => { try { io.unlinkSync(file); } catch (_) {} };

  // Journal appends stay off the telemetry callback; order is preserved by one queue.
  let journalQueue = [];
  let journalWriting = null;
  const drainJournal = async () => {
    while (journalQueue.length) {
      const lines = journalQueue.join('');
      journalQueue = [];
      try { await io.promises.appendFile(files.journal, lines, 'utf8'); } catch (error) { log(`FREE_FLIGHT_JOURNAL_ERROR error=${error.message}`); }
    }
    journalWriting = null;
  };
  const journal = Object.freeze({
    begin: () => { journalQueue = []; remove(files.journal); },
    append: sample => {
      journalQueue.push(`${JSON.stringify(sample)}\n`);
      if (!journalWriting) journalWriting = drainJournal();
    },
    // Synchronous for shutdown paths: write whatever is still queued.
    flushSync: () => {
      if (!journalQueue.length) return;
      try { io.appendFileSync(files.journal, journalQueue.join(''), 'utf8'); } catch (_) {}
      journalQueue = [];
    },
    end: () => { journalQueue = []; remove(files.journal); },
    read: () => {
      try {
        return io.readFileSync(files.journal, 'utf8').split('\n').filter(Boolean)
          .map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean);
      } catch (_) { return []; }
    }
  });

  const checkpoint = Object.freeze({
    save: value => { try { writeJson(files.active, value); } catch (error) { log(`FREE_FLIGHT_CHECKPOINT_ERROR error=${error.message}`); } },
    load: () => readJson(files.active),
    clear: () => remove(files.active)
  });

  const pending = Object.freeze({
    save: value => writeJson(files.pending, value),
    load: () => readJson(files.pending)
  });

  const trackFile = id => path.join(trackDir, `${safeId(id)}.json`);

  const listTracks = () => {
    let names = [];
    try { names = io.readdirSync(trackDir).filter(name => name.endsWith('.json')); } catch (_) {}
    return names.map(name => readJson(path.join(trackDir, name))).filter(t => t?.schema === TRACK_SCHEMA)
      .map(({ track, ...meta }) => ({ ...meta, points: track?.n || 0 }))
      .sort((a, b) => Number(b.endTs || 0) - Number(a.endTs || 0));
  };

  const prune = () => {
    const byKind = new Map();
    for (const meta of listTracks()) {
      const list = byKind.get(meta.kind) || [];
      list.push(meta);
      byKind.set(meta.kind, list);
    }
    for (const list of byKind.values()) for (const old of list.slice(keepPerKind)) { remove(trackFile(old.runId)); remove(noteFile(old.runId)); remove(entryFile(old.runId)); }
  };

  // meta: { kind: 'mission'|'free', runId, missionId?, completionId?, startTs, endTs, track, entry? }
  // entry: logbook data uploaded with the track (free flights carry their full record).
  const putTrack = meta => {
    if (!meta?.runId || !meta.track?.enc) return false;
    const previous = getTrack(meta.runId);
    writeJson(trackFile(meta.runId), {
      schema: TRACK_SCHEMA,
      kind: meta.kind === 'mission' ? 'mission' : 'free',
      runId: String(meta.runId),
      missionId: meta.missionId || null,
      completionId: meta.completionId || null,
      startTs: Number(meta.startTs) || null,
      endTs: Number(meta.endTs) || null,
      bytes: JSON.stringify(meta.track).length,
      entry: meta.entry || previous?.entry || null,
      uploadedAt: previous && previous.track?.enc === meta.track.enc ? previous.uploadedAt || null : null,
      track: meta.track
    });
    prune();
    return true;
  };

  const markUploaded = (runId, status = 'uploaded') => {
    const entry = getEntry(runId);
    if (entry && !entry.uploadedAt) writeJson(entryFile(runId), { ...entry, uploadedAt: Date.now() });
    const value = getTrack(runId);
    if (!value) return !!entry;
    writeJson(trackFile(runId), { ...value, uploadedAt: Date.now(), uploadStatus: status });
    return true;
  };

  // Newest first; free flights before mission backfill so a fresh flight goes up at once.
  const pendingUploads = (limit = 5) => listTracks().filter(t => !t.uploadedAt)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'free' ? -1 : 1))
    .map(t => getTrack(t.runId)).filter(Boolean)
    .concat(pendingEntriesWithoutTrack())
    .slice(0, limit);

  // Logbook note per run (e.g. the passenger's farewell words). Kept beside the track file;
  // an already uploaded track is queued again so the note reaches the cloud.
  const noteFile = id => path.join(trackDir, `${safeId(id)}.note.json`);
  const getNote = runId => {
    const value = readJson(noteFile(runId));
    return value?.schema === 'ga.flight-track-note.v1' ? value : null;
  };
  const putNote = (runId, note = {}) => {
    if (!runId) return false;
    const text = String(note.farewellText || '').trim().slice(0, 2000);
    if (!text) return false;
    writeJson(noteFile(runId), { schema: 'ga.flight-track-note.v1', runId: String(runId), farewellText: text,
      farewellSpeaker: String(note.farewellSpeaker || '').slice(0, 120), farewellRole: String(note.farewellRole || '').slice(0, 160),
      recordedAt: Date.now() });
    const track = getTrack(runId);
    if (track?.uploadedAt) writeJson(trackFile(runId), { ...track, uploadedAt: null, uploadStatus: 'note-added' });
    return true;
  };

  // Mission logbook entry written by the tracker at the end of a run (mission-logbook-record-core).
  const ENTRY_WITHOUT_TRACK_WAIT_MS = Math.max(0, Number(options.entryWithoutTrackWaitMs ?? 10 * 60 * 1000));
  const entryFile = id => path.join(trackDir, `${safeId(id)}.entry.json`);
  const getEntry = runId => {
    const value = readJson(entryFile(runId));
    return value?.schema === 'ga.flight-track-entry.v1' ? value : null;
  };
  const putEntry = (runId, record, status = 'completed') => {
    if (!runId || !record || typeof record !== 'object') return false;
    writeJson(entryFile(runId), { schema: 'ga.flight-track-entry.v1', runId: String(runId), status: String(status || 'completed'),
      record, recordedAt: Date.now(), uploadedAt: null });
    const track = getTrack(runId);
    if (track?.uploadedAt) writeJson(trackFile(runId), { ...track, uploadedAt: null, uploadStatus: 'entry-added' });
    return true;
  };
  // Entries whose track never arrived (no movement, missing log) go up on their own after a while.
  const pendingEntriesWithoutTrack = () => {
    let names = [];
    try { names = io.readdirSync(trackDir).filter(name => name.endsWith('.entry.json')); } catch (_) {}
    return names.map(name => readJson(path.join(trackDir, name))).filter(e => e?.schema === 'ga.flight-track-entry.v1'
      && !e.uploadedAt && !getTrack(e.runId) && Date.now() - Number(e.recordedAt || 0) >= ENTRY_WITHOUT_TRACK_WAIT_MS)
      .map(e => ({ kind: 'mission', runId: e.runId, missionId: e.record?.missionId || null, startTs: null,
        endTs: Number(e.record?.endedAt || e.record?.createdAt) || null, track: null, entryOnly: true }));
  };

  const getTrack = runId => {
    const value = readJson(trackFile(runId));
    return value?.schema === TRACK_SCHEMA ? value : null;
  };

  // Builds the track of one mission raw log (flightlogs/<missionId>--<runId>.jsonl).
  const trackFromMissionLog = async file => {
    const text = await io.promises.readFile(file, 'utf8');
    let runId = null, missionId = null, endTs = null;
    const samples = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch (_) { continue; }
      if (row.type === 'telemetry' && row.sample) samples.push(row.sample);
      else if (row.type === 'run_started') { runId = row.runId; missionId = row.missionId; }
      else if (row.type === 'run_completed') endTs = Number(row.summary?.endedAt) || endTs;
    }
    const track = trackCodec.encodeTrack(samples);
    if (!runId || !track) return null;
    const last = samples[samples.length - 1];
    return { kind: 'mission', runId, missionId, startTs: track.t0, endTs: endTs || Number(last?.observedAt) || null, track };
  };

  // Adds tracks for mission logs that have none yet, one file at a time.
  const backfillMissionTracks = async () => {
    let names = [];
    try { names = io.readdirSync(directory).filter(name => /^mission-.+--.+\.jsonl$/.test(name)); } catch (_) {}
    let added = 0;
    for (const name of names) {
      const runId = name.replace(/\.jsonl$/, '').split('--').pop();
      if (getTrack(runId)) continue;
      try {
        const meta = await trackFromMissionLog(path.join(directory, name));
        if (meta && safeId(meta.runId) === runId && putTrack(meta)) added += 1;
      } catch (error) { log(`FLIGHT_TRACK_BACKFILL_ERROR file=${name} error=${error.message}`); }
      await new Promise(resolve => setImmediate(resolve));
    }
    log(`FLIGHT_TRACK_BACKFILL_DONE added=${added} logs=${names.length}`);
    return added;
  };

  return Object.freeze({
    directory,
    trackDir,
    journal,
    checkpoint,
    pending,
    putTrack,
    getTrack,
    markUploaded,
    pendingUploads,
    getNote,
    putNote,
    getEntry,
    putEntry,
    listTracks,
    trackFromMissionLog,
    backfillMissionTracks
  });
}

module.exports = { TRACK_SCHEMA, createFlightTrackStore };
