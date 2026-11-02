'use strict';
// Crew fleet via the MSFS mod "Where I Left It": shares the mod's backup.txt with the crew.
//
// Upload: after "Export Backup" in the mod, aircraft whose content changed since the last
// upload go to the crew cloud (only those, never the whole file).
// Download: crew aircraft that are newer in the cloud are merged into backup.txt with the
// mod's own rules; the pilot then presses "Import Backup" in the mod.
//
// Load budget (the worker is limited): no KV writes at all (Durable Object), local file
// checks cost nothing. Crew changes arrive as a push over one hibernating WebSocket (an idle
// connection costs nothing; a ping a minute keeps it open). Fallback check: one small request
// that answers "unchanged" while nothing happened - hourly with push, otherwise every 10 min
// while the tracker runs. The crew name is read from the cloud profile at most every 6 hours.
//
// Aircraft used by another pilot (reserved, flying, landed - see wili-fleet-core.js) are not
// uploaded; a local copy that differs is reset to that pilot's state on the next import.
// Without an export: when the mod saves (state.txt) and a known aircraft stands on the ground
// at a new place, that position goes up at once (save time = file time minus 10 s, so a later
// export with fuel, payload and flight book still wins). New aircraft only come with an export.
//
// While another pilot uses it (busy), flies it or has landed it elsewhere, the aircraft is written with the
// mod's "hidden" flag (tested 02.11.2026: the mod then does not show it on the ramp); once
// free again it comes back at its new place.
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const core = require('./wili-fleet-core');

const MOD_PAGE_URL = 'https://flightsim.to/addon/116765/where-i-left-it-persistent-aircraft-positions-parked-fleet';
const FLEET_URL = 'https://ga-proxy.einherjer.workers.dev/api/crew-fleet-v1/';
const PROFILE_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/';
const MOD_FOLDER = ['WASM', 'MSFS2024', 'community-whereileftit', 'work'];
const TICK_MS = 30 * 1000;
const POLL_ACTIVE_MS = 10 * 60 * 1000;
const POLL_IDLE_MS = 60 * 60 * 1000;
const PING_MS = 60 * 1000;
const RECONNECT_MIN_MS = 30 * 1000;
const RECONNECT_MAX_MS = 10 * 60 * 1000;
const HIDDEN_STATES = new Set(['busy', 'flying', 'landed']);
const STATE_TIME_MARGIN_MS = 10 * 1000;
const STATE_MIN_MOVE_KM = 0.015;
const STATE_MIN_TURN_DEG = 5;
const CREW_REFRESH_MS = 6 * 60 * 60 * 1000;
const ERROR_BACKOFF_MS = 15 * 60 * 1000;
const WATCH_DEBOUNCE_MS = 3000;
const UPLOAD_BATCH = 100;
const KEEP_BACKUP_COPIES = 5;
const contentHash = text => crypto.createHash('sha256').update(String(text)).digest('hex');

function requestJson(url, init = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: init.method || 'GET', headers: init.headers, timeout: 20000 }, response => {
      const chunks = []; let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) response.destroy(new Error('response_too_large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        let data = null;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, json: async () => data });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung')));
    request.on('error', reject);
    request.end(init.body);
  });
}

// Store: %LOCALAPPDATA%\Packages\Microsoft.Limitless_*\LocalState\WASM\...;
// Steam: %APPDATA%\Microsoft Flight Simulator 2024\WASM\...
function modWorkCandidates({ appData = '', localAppData = '', fsModule = fs } = {}) {
  const candidates = [];
  if (localAppData) {
    const packages = path.join(localAppData, 'Packages');
    try {
      for (const name of fsModule.readdirSync(packages)) {
        if (/^Microsoft\.Limitless(?:_|$)/i.test(name)) candidates.push({ source: 'Microsoft Store', dir: path.join(packages, name, 'LocalState', ...MOD_FOLDER) });
      }
    } catch (_) {}
  }
  if (appData) candidates.push({ source: 'Steam', dir: path.join(appData, 'Microsoft Flight Simulator 2024', ...MOD_FOLDER) });
  return candidates;
}

function findModWorkDir(options = {}) {
  const fsModule = options.fsModule || fs;
  let best = null;
  for (const candidate of modWorkCandidates(options)) {
    let latest = -1;
    for (const file of ['state.txt', 'backup.txt']) {
      try { latest = Math.max(latest, fsModule.statSync(path.join(candidate.dir, file)).mtimeMs); } catch (_) {}
    }
    if (latest < 0) {
      try { if (fsModule.statSync(candidate.dir).isDirectory()) latest = 0; } catch (_) { continue; }
    }
    if (!best || latest > best.latest) best = { ...candidate, latest };
  }
  return best ? { source: best.source, dir: best.dir } : null;
}

const lower = value => String(value || '').trim().toLowerCase();
const samePosition = (a, b) => core.canonical({ ...(a || {}), savedAt: 0 }) === core.canonical({ ...(b || {}), savedAt: 0 });

const recordFromFile = record => ({
  key: record.key,
  pos: record.pos ? core.cleanPos(record.pos) : null,
  log: record.log ? core.cleanLog(record.log) : null
});

class WiliFleetSync extends EventEmitter {
  constructor(options = {}) {
    super();
    this.fs = options.fsModule || fs;
    this.request = options.request || requestJson;
    this.now = options.now || Date.now;
    this.getSettings = options.getSettings || (() => ({}));
    this.saveSettings = options.saveSettings || (() => {});
    this.getCredentials = options.getCredentials || (() => null);
    this.isTrackerRunning = options.isTrackerRunning || (() => false);
    this.readCrewName = options.readCrewName || (credentials => this.readCrewFromProfile(credentials));
    this.log = options.log || (() => {});
    this.locate = options.locate || (() => findModWorkDir({ appData: options.appData, localAppData: options.localAppData, fsModule: this.fs }));
    this.fleetUrl = options.fleetUrl || FLEET_URL;
    this.profileUrl = options.profileUrl || PROFILE_URL;
    this.dataDirectory = options.dataDirectory;
    this.ledgerPath = path.join(this.dataDirectory, 'wili-fleet-sync.json');
    this.copiesDirectory = path.join(this.dataDirectory, 'wili-backups');
    this.ledger = this.readLedger();
    this.mod = null;
    this.busy = null;
    this.phase = 'off';
    this.message = '';
    this.timer = null;
    this.watcher = null;
    this.watchTimer = null;
    this.lastPollAt = 0;
    this.blockedUntil = 0;
    this.fileStamp = '';
    this.createSocket = options.createSocket || ((url, headers) => new WebSocket(url, { headers }));
    this.push = options.push !== false && typeof (options.createSocket || globalThis.WebSocket) === 'function';
    this.socket = null;
    this.socketOpen = false;
    this.socketCrew = '';
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.reconnectDelay = RECONNECT_MIN_MS;
    this.startupChecked = false;
    this.remoteNewer = 0;
  }

  settings() {
    const value = this.getSettings() || {};
    return { enabled: value.enabled === true, autoSync: value.autoSync === true };
  }

  readLedger() {
    try {
      const data = JSON.parse(this.fs.readFileSync(this.ledgerPath, 'utf8'));
      if (data && typeof data === 'object') {
        return { crew: '', crewCheckedAt: 0, rev: 0, sent: {}, cloud: {}, pending: [], hidden: {}, lastUpload: 0, lastDownload: 0, backupHash: '', ...data };
      }
    } catch (_) {}
    return { crew: '', crewCheckedAt: 0, rev: 0, sent: {}, cloud: {}, pending: [], hidden: {}, lastUpload: 0, lastDownload: 0, backupHash: '' };
  }

  writeLedger() {
    try {
      this.fs.mkdirSync(this.dataDirectory, { recursive: true });
      const temporary = `${this.ledgerPath}.tmp`;
      this.fs.writeFileSync(temporary, JSON.stringify(this.ledger));
      this.fs.renameSync(temporary, this.ledgerPath);
    } catch (error) {
      this.log(`WILI ledger_write_failed ${error?.message || error}`);
    }
  }

  publicState() {
    const settings = this.settings();
    const cloud = Object.values(this.ledger.cloud || {});
    return {
      ...settings,
      modPageUrl: MOD_PAGE_URL,
      modFound: Boolean(this.mod),
      modSource: this.mod?.source || '',
      modDir: this.mod?.dir || '',
      crew: this.ledger.crew || '',
      phase: settings.enabled ? this.phase : 'off',
      busy: Boolean(this.busy),
      message: this.message,
      lastUpload: this.ledger.lastUpload || 0,
      lastDownload: this.ledger.lastDownload || 0,
      push: this.socketOpen,
      formerCrew: this.ledger.formerCrew || null,
      remoteNewer: this.remoteNewer,
      pending: (this.ledger.pending || []).map(entry => ({ key: entry.key, title: entry.title, tail: entry.tail })),
      aircraft: cloud
        .map(entry => {
          const lock = core.activeLock(entry.lock, this.now());
          return {
            key: entry.key, title: entry.pos?.title || core.titleFromKey(entry.key), tail: entry.pos?.tail || '',
            lat: entry.pos?.lat, lon: entry.pos?.lon, savedAt: entry.pos?.savedAt || 0,
            ownerNick: entry.ownerNick || '', lastNick: entry.lastNick || '', updatedAt: entry.updatedAt || 0,
            status: lock?.state || 'free', statusLabel: core.lockLabel(entry.lock, this.now()), holderNick: lock?.nick || '',
            mine: Boolean(lock) && lower(lock.pilotId) === lower(this.getCredentials()?.pilotId),
            conflictNick: entry.conflict?.nick || ''
          };
        })
        .sort((a, b) => String(a.tail || a.title).localeCompare(String(b.tail || b.title)))
    };
  }

  setState(phase, message) {
    this.phase = phase;
    this.message = message;
    this.emit('state', this.publicState());
  }

  start() {
    this.stop();
    if (!this.settings().enabled) { this.setState('off', ''); return; }
    this.refreshMod();
    this.timer = setInterval(() => this.tick().catch(() => {}), TICK_MS);
    this.timer.unref?.();
    this.tick().catch(() => {});
    this.connectSocket().catch(() => {});
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unwatch();
    this.closeSocket();
  }

  // Push: the crew fleet object sends { type: 'fleet', rev } on every change.
  async connectSocket() {
    if (!this.push || this.socket || !this.settings().enabled) return;
    clearTimeout(this.reconnectTimer);
    let credentials, crew;
    try {
      credentials = this.credentials();
      crew = await this.crew(credentials);
    } catch (_) {
      this.scheduleReconnect();
      return;
    }
    if (this.socket || !this.settings().enabled) return;
    const url = this.fleetUrl.replace(/^http/, 'ws') + encodeURIComponent(crew) + '/ws';
    let socket;
    try {
      socket = this.createSocket(url, { 'X-Pilot-ID': credentials.pilotId, 'X-Pilot-PIN': credentials.pin });
    } catch (error) {
      this.log(`WILI push_failed ${error?.message || error}`);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.socketCrew = crew;
    socket.onopen = () => {
      this.socketOpen = true;
      this.reconnectDelay = RECONNECT_MIN_MS;
      this.log('WILI push_connected');
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => { try { socket.send('ping'); } catch (_) {} }, PING_MS);
      this.pingTimer.unref?.();
      this.emit('state', this.publicState());
      // Changes while the connection was down.
      this.onRemoteChange(-1);
    };
    socket.onmessage = event => {
      if (event.data === 'pong') return;
      let data = null;
      try { data = JSON.parse(String(event.data)); } catch (_) {}
      if (data?.type === 'fleet' && Number.isSafeInteger(data.rev)) this.onRemoteChange(data.rev);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.socketOpen = false;
      clearInterval(this.pingTimer);
      this.emit('state', this.publicState());
      this.scheduleReconnect();
    };
    socket.onerror = () => {};
  }

  scheduleReconnect() {
    if (!this.push || !this.settings().enabled || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(RECONNECT_MAX_MS, this.reconnectDelay * 2);
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connectSocket().catch(() => {}); }, delay);
    this.reconnectTimer.unref?.();
  }

  closeSocket() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    clearInterval(this.pingTimer);
    const socket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    try { socket?.close(); } catch (_) {}
  }

  onRemoteChange(rev) {
    if (rev >= 0 && rev === this.ledger.rev) return;
    if (this.settings().autoSync) this.sync('push').catch(() => {});
    else this.check().catch(() => {});
  }

  setOptions(options = {}) {
    const current = this.settings();
    const next = {
      enabled: typeof options.enabled === 'boolean' ? options.enabled : current.enabled,
      autoSync: typeof options.autoSync === 'boolean' ? options.autoSync : current.autoSync
    };
    this.saveSettings(next);
    if (next.enabled && next.autoSync && !current.autoSync) this.lastPollAt = 0;
    this.start();
    return this.publicState();
  }

  refreshMod() {
    const found = this.locate();
    if (found?.dir !== this.mod?.dir) {
      this.unwatch();
      this.mod = found;
      if (found) this.log(`WILI mod_dir source=${found.source} dir=${found.dir}`);
    }
    if (this.mod && this.settings().autoSync && !this.watcher) this.watch();
    return this.mod;
  }

  watch() {
    try {
      this.watcher = this.fs.watch(this.mod.dir, (_event, name) => {
        if (name && !/^(backup|state)\.txt$/i.test(String(name))) return;
        clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => this.onLocalChange().catch(() => {}), WATCH_DEBOUNCE_MS);
      });
      this.watcher.on?.('error', () => this.unwatch());
    } catch (_) {
      this.watcher = null; // the 30 s tick checks the files as well
    }
  }

  unwatch() {
    clearTimeout(this.watchTimer);
    try { this.watcher?.close(); } catch (_) {}
    this.watcher = null;
  }

  backupPath() { return this.mod ? path.join(this.mod.dir, 'backup.txt') : ''; }
  statePath() { return this.mod ? path.join(this.mod.dir, 'state.txt') : ''; }

  stamp() {
    const parts = [];
    for (const file of [this.backupPath(), this.statePath()]) {
      try { const stat = this.fs.statSync(file); parts.push(`${stat.size}:${stat.mtimeMs}`); } catch (_) { parts.push('-'); }
    }
    return parts.join('|');
  }

  readBackup() {
    let content = '';
    try { content = this.fs.readFileSync(this.backupPath(), 'utf8'); } catch (_) { return { content: '', parsed: core.parseBackup('') }; }
    return { content, parsed: core.parseBackup(content) };
  }

  async tick() {
    const settings = this.settings();
    if (!settings.enabled) return;
    if (!this.refreshMod()) { this.setState('no-mod', 'Mod-Ordner nicht gefunden. Ist „Where I Left It“ installiert und der Sim einmal damit gelaufen?'); return; }
    if (this.phase === 'off' || this.phase === 'no-mod') this.setState('idle', settings.autoSync ? 'Autosync aktiv.' : 'Manueller Abgleich.');
    const stamp = this.stamp();
    if (stamp !== this.fileStamp) { this.fileStamp = stamp; await this.onLocalChange(); }
    // Manual mode: look once at start, never write without a button.
    if (!settings.autoSync && !this.startupChecked) { this.startupChecked = true; await this.check(); }
    if (!settings.autoSync || this.now() < this.blockedUntil) return;
    const interval = this.socketOpen || !this.isTrackerRunning() ? POLL_IDLE_MS : POLL_ACTIVE_MS;
    if (this.now() - this.lastPollAt >= interval) await this.sync('poll');
  }

  async onLocalChange() {
    if (!this.mod) return;
    this.fileStamp = this.stamp();
    this.checkPendingImport();
    if (!this.settings().autoSync || this.now() < this.blockedUntil) return;
    const { content } = this.readBackup();
    if (content && contentHash(content) !== this.ledger.backupHash) { await this.sync('backup-changed'); return; }
    // Only the mod's save file changed: send new ground positions, nothing else.
    if (this.stateUploads().length) await this.run('state-changed', () => this.doStateUpload());
  }

  readState() {
    try {
      const file = this.statePath();
      const content = this.fs.readFileSync(file, 'utf8');
      return { records: core.parseStateRecords(content), mtime: this.fs.statSync(file).mtimeMs };
    } catch (_) {
      return { records: null, mtime: 0 };
    }
  }

  // Known aircraft that the mod's last save shows on the ground at a new place.
  stateUploads() {
    const { records, mtime } = this.readState();
    if (!records || !mtime) return [];
    const me = this.getCredentials()?.pilotId || '';
    let local = new Map();
    try { local = this.readBackup().parsed.records; } catch (_) {}
    const savedAt = Math.round(mtime) - STATE_TIME_MARGIN_MS;
    const uploads = [];
    for (const rec of records.values()) {
      if (!rec.onGround || rec.hidden || this.ledger.hidden?.[rec.key]) continue;
      const cloud = this.ledger.cloud[rec.key];
      if (cloud && core.blockedFor(cloud.lock, me, this.now())) continue;
      const own = local.get(rec.key)?.pos ? core.cleanPos(local.get(rec.key).pos) : null;
      const base = [own, cloud?.pos].filter(Boolean).sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0))[0];
      if (!base || savedAt <= (Number(base.savedAt) || 0)) continue;
      const turn = Math.abs((((rec.hdgTrue - (Number(base.hdgTrue) || 0)) % 360) + 540) % 360 - 180);
      if (core.distanceKm(base, rec) < STATE_MIN_MOVE_KM && turn < STATE_MIN_TURN_DEG && base.hidden !== true) continue;
      const pos = { ...base, lat: rec.lat, lon: rec.lon, altFt: rec.altFt, aglFt: rec.aglFt, hdgTrue: rec.hdgTrue, pitch: rec.pitch, bank: rec.bank, onGround: true, hidden: false, savedAt };
      const signature = core.canonical(pos);
      if (this.ledger.stateSent?.[rec.key] === signature) continue;
      uploads.push({ key: rec.key, pos, signature });
    }
    return uploads;
  }

  async doStateUpload() {
    const uploads = this.stateUploads();
    if (!uploads.length) return { uploaded: 0, message: '' };
    const answer = await this.call('POST', { records: uploads.map(entry => ({ key: entry.key, pos: entry.pos })) });
    const refused = new Set(Array.isArray(answer?.blocked) ? answer.blocked : []);
    if (!this.ledger.stateSent) this.ledger.stateSent = {};
    let sent = 0;
    for (const entry of uploads) {
      if (refused.has(entry.key)) continue;
      this.ledger.stateSent[entry.key] = entry.signature;
      sent++;
    }
    if (sent) {
      this.ledger.lastUpload = this.now();
      this.log(`WILI state_upload records=${sent}`);
    }
    return { uploaded: sent, message: sent ? `${sent} neue Position(en) aus dem Mod-Speicherstand hochgeladen.` : '' };
  }

  // Drops pending imports once the mod's state.txt shows the aircraft at the new place.
  checkPendingImport() {
    if (!this.ledger.pending?.length) return;
    let positions;
    try { positions = core.parseStatePositions(this.fs.readFileSync(this.statePath(), 'utf8')); } catch (_) { return; }
    const left = this.ledger.pending.filter(entry => !core.samePlace(positions.get(entry.key), entry));
    if (left.length !== this.ledger.pending.length) {
      this.ledger.pending = left;
      this.writeLedger();
      this.emit('state', this.publicState());
    }
  }

  // Upload, then download - so a merge never hides a local change.
  sync(reason = 'manual') {
    return this.run(reason, async () => {
      const up = await this.doUpload();
      const fromState = this.settings().autoSync ? await this.doStateUpload() : { uploaded: 0, message: '' };
      const down = await this.doDownload();
      const message = [up.uploaded ? up.message : '', fromState.message, down.message].filter(Boolean).join(' ');
      return { uploaded: up.uploaded, written: down.written, message: up.blocked?.length ? `${up.message} ${down.message}` : message };
    });
  }
  upload() { return this.run('manual-upload', () => this.doUpload()); }
  download() { return this.run('manual-download', () => this.doDownload()); }

  // Loads the crew state without touching backup.txt; tells how many aircraft would change.
  check() {
    return this.run('check', async () => {
      await this.fetchCloud();
      const count = this.mergeCloudIntoBackup({ dryRun: true });
      this.remoteNewer = count;
      return { written: 0, message: count ? `${count} Maschine(n) neu in der Crew – „Crew-Stand laden“ drücken.` : 'Crew-Stand unverändert.' };
    });
  }

  async run(reason, work) {
    if (this.busy) return this.busy;
    if (!this.settings().enabled) return { ok: false, message: 'Vereinsflotte ist ausgeschaltet.' };
    if (!this.refreshMod()) { this.setState('no-mod', 'Mod-Ordner nicht gefunden.'); return { ok: false, message: this.message }; }
    if (/^manual/.test(reason) && !this.ledger.crew) this.ledger.crewCheckedAt = 0;
    this.busy = (async () => {
      this.setState('syncing', 'Abgleich läuft …');
      try {
        const result = await work();
        this.blockedUntil = 0;
        this.setState('idle', result?.message || 'Abgeglichen.');
        return { ok: true, ...result };
      } catch (error) {
        const message = String(error?.message || error);
        this.log(`WILI sync_failed reason=${reason} error=${message}`);
        if (['poll', 'backup-changed', 'push'].includes(reason)) this.blockedUntil = this.now() + ERROR_BACKOFF_MS;
        this.setState(error?.phase || 'error', message);
        return { ok: false, message };
      } finally {
        this.lastPollAt = this.now();
        this.busy = null;
        this.writeLedger();
        this.emit('state', this.publicState());
      }
    })();
    return this.busy;
  }

  credentials() {
    const credentials = this.getCredentials();
    if (!credentials?.pilotId || !credentials?.pin) throw Object.assign(new Error('Bitte zuerst unter „Konto“ Pilot-ID und PIN hinterlegen.'), { phase: 'no-account' });
    return credentials;
  }

  async readCrewFromProfile({ pilotId, pin }) {
    const cloudSync = require('./cloud-sync-client');
    const client = cloudSync.create({ pilotId, pin, request: this.request, baseUrl: this.profileUrl });
    const result = await client.read(['field:groupName']);
    if (result.migrated) return result.profile?.groupName || '';
    const response = await this.request(this.profileUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
    if (!response.ok) throw new Error(`Profil nicht lesbar (HTTP ${response.status}).`);
    return (await response.json())?.groupName || '';
  }

  async crew(credentials, force = false) {
    // Also "no crew" is kept for a while; a button press checks at once (see run()).
    if (!force && this.ledger.crewCheckedAt && this.now() - this.ledger.crewCheckedAt < CREW_REFRESH_MS) {
      if (!this.ledger.crew) throw Object.assign(new Error('Du bist in keiner Crew. Tritt im Web unter „Crew“ einer bei.'), { phase: 'no-crew' });
      return this.ledger.crew;
    }
    const crew = String(await this.readCrewName(credentials) || '').trim().toUpperCase().slice(0, 80);
    if (crew !== this.ledger.crew) {
      // Another crew: its records and revision are unrelated to the old ones.
      this.log(`WILI crew ${this.ledger.crew || '-'} -> ${crew || '-'}`);
      this.leaveCrew();
      Object.assign(this.ledger, { crew, rev: 0, sent: {}, cloud: {}, hidden: {}, stateSent: {} });
      if (this.socket && this.socketCrew !== crew) { this.closeSocket(); this.connectSocket().catch(() => {}); }
    }
    this.ledger.crewCheckedAt = this.now();
    if (!crew) throw Object.assign(new Error('Du bist in keiner Crew. Tritt im Web unter „Crew“ einer bei.'), { phase: 'no-crew' });
    return crew;
  }

  async call(method, body, query = '') {
    const credentials = this.credentials();
    for (let attempt = 0; attempt < 2; attempt++) {
      const crew = await this.crew(credentials, attempt > 0);
      const response = await this.request(this.fleetUrl + encodeURIComponent(crew) + query, {
        method,
        headers: { 'X-Pilot-ID': credentials.pilotId, 'X-Pilot-PIN': credentials.pin, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json();
      // Not a member (any more): read the crew name once again, it may have changed.
      if (response.status === 403 && attempt === 0) continue;
      if (response.status === 401) throw Object.assign(new Error('Pilot-ID oder PIN wurden abgelehnt.'), { phase: 'no-account' });
      if (response.status === 403) {
        // Removed from the crew while the profile still names it: same as leaving.
        this.leaveCrew();
        Object.assign(this.ledger, { crew: '', crewCheckedAt: this.now(), rev: 0, sent: {}, cloud: {}, hidden: {} });
        this.closeSocket();
        throw Object.assign(new Error('Kein Mitglied dieser Crew mehr. Der Abgleich ist beendet.'), { phase: 'no-crew' });
      }
      if (!response.ok) throw new Error(`Crew-Cloud antwortet mit HTTP ${response.status}${data?.error ? ` (${data.error})` : ''}.`);
      return data;
    }
    return null;
  }

  async doUpload() {
    const { content, parsed } = this.readBackup();
    if (!content) return { message: 'Noch keine backup.txt – im Mod unter Backup „Export Backup“ drücken.', uploaded: 0 };
    if (parsed.problems.includes('header_missing') || parsed.problems.includes('format_unknown')) {
      throw new Error(`backup.txt hat ein unbekanntes Format${parsed.header?.modVersion ? ` (Mod ${parsed.header.modVersion})` : ''}. Nichts hochgeladen.`);
    }
    const changed = [];
    const me = this.credentials().pilotId;
    const blocked = [];
    for (const record of parsed.records.values()) {
      const clean = recordFromFile(record);
      if (!clean.pos && !clean.log) continue;
      const signature = core.recordSignature(clean);
      if (this.ledger.sent[clean.key] === signature) continue;
      const cloud = this.ledger.cloud[clean.key];
      // Used by someone else: their state counts; the next import resets this copy.
      // Hidden by this app: never sent, the next import shows it again.
      if (cloud && (core.blockedFor(cloud.lock, me, this.now()) || this.ledger.hidden?.[clean.key])) continue;
      // Nothing the crew cloud does not already have (e.g. an older copy before the import,
      // or a copy that only differs in the save time this app set).
      const sameAsCloud = cloud && samePosition(clean.pos, cloud.pos)
        && core.canonical(core.mergeLog(cloud.log, clean.log)) === core.canonical(cloud.log || null);
      if (sameAsCloud || (cloud && core.recordSignature(core.mergeRecord(cloud, clean)) === core.recordSignature({ pos: cloud.pos, log: cloud.log }))) {
        this.ledger.sent[clean.key] = signature;
        continue;
      }
      changed.push({ record: clean, signature });
    }
    for (let i = 0; i < changed.length; i += UPLOAD_BATCH) {
      const batch = changed.slice(i, i + UPLOAD_BATCH);
      const answer = await this.call('POST', { records: batch.map(entry => entry.record) });
      const refused = new Set(Array.isArray(answer?.blocked) ? answer.blocked : []);
      for (const entry of batch) {
        if (refused.has(entry.record.key)) blocked.push(entry.record.key);
        else this.ledger.sent[entry.record.key] = entry.signature;
      }
    }
    this.ledger.backupHash = contentHash(content);
    if (changed.length) {
      this.ledger.lastUpload = this.now();
      this.log(`WILI upload records=${changed.length}`);
    }
    const uploaded = changed.length - blocked.length;
    const refusedText = blocked.length
      ? ` Nicht übernommen (von jemand anderem belegt): ${blocked.map(key => this.ledger.cloud[key]?.pos?.tail || core.titleFromKey(key)).join(', ')}.`
      : '';
    if (blocked.length) this.log(`WILI upload_blocked keys=${blocked.length}`);
    return { uploaded, blocked, message: (uploaded ? `${uploaded} Maschine(n) hochgeladen.` : 'Keine lokalen Änderungen.') + refusedText };
  }

  async fetchCloud() {
    // Caches from 1.6.32/1.6.33 did not keep the owner: load everything once.
    if (Object.values(this.ledger.cloud || {}).some(entry => entry.ownerPilotId === undefined)) this.ledger.rev = 0;
    const data = await this.call('GET', null, `?since=${Number(this.ledger.rev) || 0}`);
    this.ledger.lastDownload = this.now();
    if (data?.unchanged) return { unchanged: true };
    const records = Array.isArray(data?.records) ? data.records : [];
    if (data?.full) this.ledger.cloud = {};
    for (const record of records) {
      if (!core.validKey(record?.key)) continue;
      this.ledger.cloud[record.key] = {
        key: record.key, pos: record.pos || null, log: record.log || null, rev: record.rev,
        ownerPilotId: record.ownerPilotId || '', ownerNick: record.ownerNick || '', lastNick: record.lastNick || '', updatedAt: record.updatedAt || 0,
        lock: record.lock || null, conflict: record.conflict || null
      };
    }
    this.ledger.rev = Number(data?.rev) || 0;
    return { unchanged: false };
  }

  async doDownload() {
    const { unchanged } = await this.fetchCloud();
    // Also when unchanged: a mod export may have replaced a prepared import in the meantime.
    const written = this.mergeCloudIntoBackup();
    this.remoteNewer = 0;
    const ready = `${written} Maschine(n) bereit – im Mod „Import Backup“ drücken.`;
    return { written, message: written ? ready : (unchanged ? 'Crew-Stand unverändert.' : 'Crew-Stand geladen, nichts Neues für dich.') };
  }

  // Merges all known crew records into backup.txt. Writes only if something would change
  // for the mod, so running it on every sync costs nothing but a local file read.
  mergeCloudIntoBackup({ dryRun = false } = {}) {
    const cloudRecords = Object.values(this.ledger.cloud || {}).map(entry => ({ key: entry.key, pos: entry.pos, log: entry.log, lock: entry.lock }));
    if (!cloudRecords.length) return 0;
    const { content, parsed } = this.readBackup();
    if (content && !parsed.header) throw new Error('backup.txt hat ein unbekanntes Format. Nichts geschrieben.');
    const records = new Map([...parsed.records.values()].map(record => [record.key, recordFromFile(record)]));
    const me = this.getCredentials()?.pilotId || '';
    const shown = this.readState().records || new Map();
    const changed = [];
    for (const cloud of cloudRecords) {
      const local = records.get(cloud.key);
      let merged = core.mergeRecord(local, cloud);
      const lock = core.activeLock(cloud.lock, this.now());
      const blocked = Boolean(lock) && lower(lock.pilotId) !== lower(me);
      const hide = blocked && HIDDEN_STATES.has(lock.state);
      if (cloud.pos && (blocked || this.ledger.hidden?.[cloud.key])) {
        // Used by someone else (or hidden by this app before): the holder's state wins, hidden
        // while it is not at that place; the save time goes just above the local one so the mod
        // takes it even when this copy was flown anyway.
        const wanted = hide ? { ...cloud.pos, hidden: true } : cloud.pos;
        if (!local?.pos) merged = { ...merged, pos: wanted };
        else if (!samePosition(local.pos, wanted)) {
          merged = { ...merged, pos: { ...wanted, savedAt: Math.max(Number(local.pos.savedAt) || 0, Number(cloud.pos.savedAt) || 0) + 1 } };
        }
      }
      if (!dryRun) {
        if (!this.ledger.hidden) this.ledger.hidden = {};
        if (hide) this.ledger.hidden[cloud.key] = true;
        else delete this.ledger.hidden[cloud.key];
      }
      // The mod already shows it there (e.g. own aircraft sent from state.txt): nothing to import.
      const inMod = shown.get(cloud.key);
      if (inMod && merged.pos && core.samePlace(inMod, merged.pos) && core.distanceKm(inMod, merged.pos) < STATE_MIN_MOVE_KM) continue;
      if (!local || core.recordSignature(merged) !== core.recordSignature(local)) {
        records.set(cloud.key, merged);
        changed.push(merged);
      }
    }
    if (!changed.length || dryRun) return changed.length;
    return this.writeBackup(records, parsed, content, changed);
  }

  // Leaving the crew (or being removed): sync ends; aircraft of the others stay in the mod
  // (an import never deletes) but are shown again and named "... · ex <crew>".
  leaveCrew() {
    const crew = this.ledger.crew;
    const cloud = Object.values(this.ledger.cloud || {});
    if (!crew || !cloud.length || !this.mod) return 0;
    const me = this.getCredentials()?.pilotId || '';
    let read;
    try { read = this.readBackup(); } catch (_) { return 0; }
    const { content, parsed } = read;
    if (!content || !parsed.header) return 0;
    const records = new Map([...parsed.records.values()].map(record => [record.key, recordFromFile(record)]));
    const suffix = ` · ex ${crew}`;
    const changed = [];
    for (const entry of cloud) {
      if (!entry.ownerPilotId || lower(entry.ownerPilotId) === lower(me)) continue;
      const local = records.get(entry.key);
      if (!local?.pos) continue;
      const name = String(local.pos.customName || local.pos.tail || local.pos.title || '').slice(0, 160);
      if (name.endsWith(suffix) && local.pos.hidden !== true) continue;
      const marked = { ...local, pos: { ...local.pos, hidden: false, customName: name.endsWith(suffix) ? name : name + suffix, savedAt: (Number(local.pos.savedAt) || 0) + 1 } };
      records.set(entry.key, marked);
      changed.push(marked);
    }
    this.ledger.formerCrew = { crew, at: this.now(), aircraft: changed.map(record => record.pos.tail || record.pos.title) };
    if (!changed.length) return 0;
    try {
      const written = this.writeBackup(records, parsed, content, changed);
      this.log(`WILI left_crew crew=${crew} marked=${written}`);
      return written;
    } catch (error) {
      this.log(`WILI left_crew_failed ${error?.message || error}`);
      return 0;
    }
  }

  writeBackup(records, parsed, content, changed) {
    if (content) this.keepCopy(content);
    const next = core.serializeBackup(records.values(), { modVersion: parsed.header?.modVersion || '2.0.0', exportedAt: this.now() });
    const target = this.backupPath();
    const temporary = `${target}.vfr.tmp`;
    this.fs.writeFileSync(temporary, next, 'utf8');
    this.fs.renameSync(temporary, target);
    this.ledger.backupHash = contentHash(next);
    this.fileStamp = this.stamp();
    const pending = new Map((this.ledger.pending || []).map(entry => [entry.key, entry]));
    for (const record of changed) {
      if (record.pos) pending.set(record.key, { key: record.key, title: record.pos.title, tail: record.pos.tail || '', lat: record.pos.lat, lon: record.pos.lon, hidden: record.pos.hidden === true });
    }
    this.ledger.pending = [...pending.values()];
    this.log(`WILI import_written records=${changed.length}`);
    return changed.length;
  }

  keepCopy(content) {
    try {
      this.fs.mkdirSync(this.copiesDirectory, { recursive: true });
      const stamp = new Date(this.now()).toISOString().replace(/[:.]/g, '-');
      this.fs.writeFileSync(path.join(this.copiesDirectory, `backup-${stamp}.txt`), content, 'utf8');
      const copies = this.fs.readdirSync(this.copiesDirectory).filter(name => /^backup-.*\.txt$/.test(name)).sort();
      for (const name of copies.slice(0, Math.max(0, copies.length - KEEP_BACKUP_COPIES))) this.fs.rmSync(path.join(this.copiesDirectory, name), { force: true });
    } catch (error) {
      throw new Error(`Sicherungskopie von backup.txt fehlgeschlagen: ${error?.message || error}`);
    }
  }
}

module.exports = { MOD_PAGE_URL, WiliFleetSync, findModWorkDir, modWorkCandidates, requestJson };
