'use strict';

const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const MAX_ENTRIES = 24;
const MAX_DELAY_SECONDS = 120;
const DEFAULT_DELAY_SECONDS = 3;
const ALLOWED_EXTENSIONS = new Set(['.exe', '.lnk', '.bat', '.cmd']);
const CLOSE_GRACE_MS = 5000;
const SIM_POLL_MS = 15000;
// Steam/Store brauchen teils Minuten bis der Sim-Prozess erscheint.
const SIM_APPEAR_POLLS = 60;
const SIM_GONE_POLLS = 2;

// Bekannte Simulatoren. Steam-App-ID, Store-Paketname und Prozessname dienen
// nur der Erkennung und dem Start; geschlossen wird ein Simulator nie automatisch.
const SIMULATORS = Object.freeze([
  Object.freeze({ id: 'msfs2024', label: 'MSFS 2024', steamAppId: '2537590', storePackage: 'Microsoft.Limitless', imageName: 'FlightSimulator2024.exe' }),
  Object.freeze({ id: 'msfs2020', label: 'MSFS 2020', steamAppId: '1250410', storePackage: 'Microsoft.FlightSimulator', imageName: 'FlightSimulator.exe' })
]);

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clampDelay(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DELAY_SECONDS;
  return Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(number)));
}

function cleanText(value, max = 1024) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function imageNameFor(target) {
  const extension = path.win32.extname(target).toLowerCase();
  return extension === '.exe' ? path.win32.basename(target) : '';
}

function normalizeEntry(raw) {
  const entry = safeObject(raw);
  const kind = entry.kind === 'sim' ? 'sim' : 'program';
  const id = cleanText(entry.id, 64);
  if (!id) return null;
  const base = {
    id,
    kind,
    name: cleanText(entry.name, 120) || 'Programm',
    enabled: entry.enabled !== false,
    delaySeconds: clampDelay(entry.delaySeconds)
  };
  if (kind === 'sim') {
    const simulator = SIMULATORS.find((item) => item.id === entry.simId);
    const source = entry.source === 'store' ? 'store' : (entry.source === 'steam' ? 'steam' : '');
    const launchTarget = cleanText(entry.launchTarget, 512);
    if (!simulator || !source || !launchTarget) return null;
    // Startargumente gibt es nur ueber Steam; der Store-Start nimmt keine an.
    const args = source === 'steam' ? cleanText(entry.args, 512) : '';
    return { ...base, name: cleanText(entry.name, 120) || simulator.label, simId: simulator.id, source, launchTarget, args, imageName: simulator.imageName, admin: false };
  }
  const target = cleanText(entry.path, 1024);
  if (!target || !path.win32.isAbsolute(target)) return null;
  return {
    ...base,
    path: target,
    args: cleanText(entry.args, 2048),
    cwd: cleanText(entry.cwd, 1024),
    imageName: imageNameFor(target),
    admin: entry.admin === true
  };
}

function normalizeAutostartSettings(raw) {
  const settings = safeObject(raw);
  const seen = new Set();
  const entries = [];
  for (const item of Array.isArray(settings.entries) ? settings.entries : []) {
    const entry = normalizeEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    if (entry.kind === 'sim' && entries.some((existing) => existing.kind === 'sim')) continue;
    seen.add(entry.id);
    entries.push(entry);
    if (entries.length >= MAX_ENTRIES) break;
  }
  return {
    enabled: settings.enabled === true,
    closeOnExit: settings.closeOnExit === true,
    entries
  };
}

// PowerShell-Literal in einfachen Anfuehrungszeichen.
function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function startProcessCommand({ file, args = '', cwd = '', admin = false }) {
  const parts = [`Start-Process -FilePath ${psQuote(file)}`];
  if (args) parts.push(`-ArgumentList ${psQuote(args)}`);
  if (cwd) parts.push(`-WorkingDirectory ${psQuote(cwd)}`);
  if (admin) parts.push('-Verb RunAs');
  // -PassThru liefert die Prozess-ID, damit auch Kindprozesse eines Launchers
  // spaeter zugeordnet werden koennen.
  return `$ErrorActionPreference='Stop'; $p = ${parts.join(' ')} -PassThru; if ($p) { $p.Id }`;
}

const PROCESS_SNAPSHOT_COMMAND = "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId,$_.ParentProcessId,$_.ExecutablePath }";

function parseProcessSnapshot(text) {
  const processes = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^(\d+)\|(\d+)\|(.*)$/);
    if (match) processes.set(Number(match[1]), { parentPid: Number(match[2]), path: match[3].trim().toLowerCase() });
  }
  return processes;
}

// Programmordner, deren Unterprozesse dem Eintrag zugerechnet werden. Zu
// allgemeine Ordner (Laufwerk, erste Ebene, Windows) scheiden aus.
function ownedFolderFor(target) {
  const folder = path.win32.dirname(target).toLowerCase();
  const parts = folder.split('\\').filter(Boolean);
  if (parts.length < 3 && !/^[a-z]:\\program files( \(x86\))?\\[^\\]+$/.test(folder)) return '';
  if (/^[a-z]:\\windows(\\|$)/.test(folder)) return '';
  if (/\\(desktop|downloads|documents|onedrive[^\\]*)$/.test(folder)) return '';
  return folder + '\\';
}

// Neue Prozesse seit dem Autostart, die von einem gestarteten Prozess abstammen
// oder aus dem Ordner eines gestarteten Programms kommen.
function ownedProcessIds(snapshot, { baseline, roots, folders, excludePaths = [] }) {
  const owned = new Set();
  const excluded = new Set(excludePaths.map((item) => item.toLowerCase()));
  const descends = (pid) => {
    const seen = new Set();
    for (let current = pid; current && !seen.has(current); current = snapshot.get(current)?.parentPid) {
      seen.add(current);
      if (roots.has(current)) return true;
      const parent = snapshot.get(current)?.parentPid;
      if (roots.has(parent)) return true;
      if (baseline.has(parent)) return false;
    }
    return false;
  };
  for (const [pid, info] of snapshot) {
    if (baseline.has(pid) || excluded.has(info.path) || excluded.has(path.win32.basename(info.path))) continue;
    if (descends(pid) || [...folders].some((folder) => info.path.startsWith(folder))) owned.add(pid);
  }
  return owned;
}

function parseSteamLibraryPaths(vdfText) {
  const paths = [];
  for (const match of String(vdfText || '').matchAll(/"path"\s+"([^"]+)"/g)) {
    paths.push(match[1].replace(/\\\\/g, '\\'));
  }
  return [...new Set(paths)];
}

function parseTasklistImageNames(csvText) {
  const names = new Set();
  for (const line of String(csvText || '').split(/\r?\n/)) {
    const match = line.match(/^"([^"]+)"/);
    if (match) names.add(match[1].toLowerCase());
  }
  return names;
}

function execFileText(execFileImpl, command, args, timeout = 8000) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = String(stderr || '');
        reject(error);
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

class AutostartLauncher extends EventEmitter {
  constructor({
    configStore,
    platform = process.platform,
    execFileImpl = execFile,
    fsModule = fs,
    openExternal = async () => {},
    resolveShortcut = () => null,
    getFileIcon = async () => '',
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    createId = () => crypto.randomUUID()
  } = {}) {
    super();
    if (!configStore) throw new Error('configStore fehlt.');
    this.configStore = configStore;
    this.platform = platform;
    this.execFileImpl = execFileImpl;
    this.fs = fsModule;
    this.openExternal = openExternal;
    this.resolveShortcut = resolveShortcut;
    this.getFileIcon = getFileIcon;
    this.sleep = sleep;
    this.createId = createId;
    this.icons = new Map();
    this.ownedImageNames = new Set();
    this.ownedRoots = new Set();
    this.ownedFolders = new Set();
    this.baselinePids = null;
    this.simWatchToken = 0;
    this.simCandidates = null;
    this.run = { phase: 'idle', currentId: '', results: {}, message: '' };
  }

  settings() {
    return normalizeAutostartSettings(this.configStore.readAutostart());
  }

  save(next) {
    const normalized = normalizeAutostartSettings(next);
    this.configStore.writeAutostart(normalized);
    this.emitState();
    return normalized;
  }

  emitState() {
    this.emit('state', this.publicState());
  }

  publicState() {
    const settings = this.settings();
    return {
      supported: this.platform === 'win32',
      enabled: settings.enabled,
      closeOnExit: settings.closeOnExit,
      entries: settings.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        detail: entry.kind === 'sim' ? (entry.source === 'steam' ? 'Steam' : 'Microsoft Store') : entry.path,
        enabled: entry.enabled,
        admin: entry.admin,
        args: entry.args || '',
        argsSupported: entry.kind === 'program' || entry.source === 'steam',
        delaySeconds: entry.delaySeconds,
        icon: this.icons.get(entry.id) || ''
      })),
      simCandidates: this.simCandidates,
      run: { ...this.run, results: { ...this.run.results } }
    };
  }

  async loadIcons() {
    for (const entry of this.settings().entries) {
      if (entry.kind !== 'program' || this.icons.has(entry.id)) continue;
      try {
        const icon = await this.getFileIcon(entry.path);
        if (icon) this.icons.set(entry.id, icon);
      } catch (_) {}
    }
    this.emitState();
  }

  setOptions({ enabled, closeOnExit } = {}) {
    const settings = this.settings();
    return this.save({
      ...settings,
      enabled: typeof enabled === 'boolean' ? enabled : settings.enabled,
      closeOnExit: typeof closeOnExit === 'boolean' ? closeOnExit : settings.closeOnExit
    });
  }

  addPaths(rawPaths = []) {
    const settings = this.settings();
    const added = [];
    const rejected = [];
    for (const raw of Array.isArray(rawPaths) ? rawPaths.slice(0, MAX_ENTRIES) : []) {
      const file = cleanText(raw, 1024);
      const extension = path.win32.extname(file).toLowerCase();
      if (!file || !path.win32.isAbsolute(file) || !ALLOWED_EXTENSIONS.has(extension) || !this.fs.existsSync(file)) {
        rejected.push(path.win32.basename(file) || 'Datei');
        continue;
      }
      let target = file;
      let args = '';
      let cwd = '';
      if (extension === '.lnk') {
        const shortcut = this.resolveShortcut(file);
        if (!shortcut?.target) {
          rejected.push(path.win32.basename(file));
          continue;
        }
        target = shortcut.target;
        args = shortcut.args || '';
        cwd = shortcut.cwd || '';
      }
      if (settings.entries.length + added.length >= MAX_ENTRIES) {
        rejected.push(path.win32.basename(file));
        continue;
      }
      if (settings.entries.concat(added).some((entry) => entry.path && entry.path.toLowerCase() === target.toLowerCase() && entry.args === args)) continue;
      added.push({
        id: this.createId(),
        kind: 'program',
        name: path.win32.basename(file, path.win32.extname(file)),
        path: target,
        args,
        cwd,
        enabled: true,
        admin: false,
        delaySeconds: DEFAULT_DELAY_SECONDS
      });
    }
    this.save({ ...settings, entries: added.concat(settings.entries) });
    if (added.length) void this.loadIcons();
    return { ok: true, added: added.length, rejected };
  }

  // Uebernimmt nur Reihenfolge und Schalter bekannter Eintraege; neue Pfade
  // kommen ausschliesslich ueber addPaths bzw. die Sim-Erkennung.
  updateEntries(rawList = []) {
    const settings = this.settings();
    const byId = new Map(settings.entries.map((entry) => [entry.id, entry]));
    const next = [];
    for (const item of Array.isArray(rawList) ? rawList : []) {
      const existing = byId.get(String(item?.id || ''));
      if (!existing) continue;
      byId.delete(existing.id);
      next.push({
        ...existing,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : existing.enabled,
        admin: existing.kind === 'program' && typeof item.admin === 'boolean' ? item.admin : existing.admin,
        args: typeof item.args === 'string' && (existing.kind === 'program' || existing.source === 'steam')
          ? cleanText(item.args, existing.kind === 'program' ? 2048 : 512) : existing.args,
        delaySeconds: item.delaySeconds === undefined ? existing.delaySeconds : clampDelay(item.delaySeconds)
      });
    }
    for (const id of byId.keys()) this.icons.delete(id);
    this.save({ ...settings, entries: next });
    return { ok: true };
  }

  async detectSimulators() {
    if (this.platform !== 'win32') {
      this.simCandidates = [];
      this.emitState();
      return { ok: true, candidates: [] };
    }
    const candidates = [...await this.detectSteam(), ...await this.detectStore()];
    this.simCandidates = candidates;
    this.emitState();
    return { ok: true, candidates };
  }

  async detectSteam() {
    let steamRoot = '';
    try {
      const output = await execFileText(this.execFileImpl, 'reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']);
      steamRoot = (output.match(/SteamPath\s+REG_\w+\s+(.+)/) || [])[1]?.trim().replace(/\//g, '\\') || '';
    } catch (_) {}
    if (!steamRoot) steamRoot = 'C:\\Program Files (x86)\\Steam';
    const libraries = [steamRoot];
    try {
      libraries.push(...parseSteamLibraryPaths(this.fs.readFileSync(path.win32.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8')));
    } catch (_) {}
    const found = [];
    for (const simulator of SIMULATORS) {
      const installed = [...new Set(libraries.map((item) => item.toLowerCase()))]
        .some((library) => this.fs.existsSync(path.win32.join(library, 'steamapps', `appmanifest_${simulator.steamAppId}.acf`)));
      if (installed) {
        found.push({ key: `${simulator.id}:steam`, simId: simulator.id, source: 'steam', label: `${simulator.label} · Steam`, launchTarget: `steam://rungameid/${simulator.steamAppId}` });
      }
    }
    return found;
  }

  async detectStore() {
    const names = SIMULATORS.map((simulator) => psQuote(simulator.storePackage)).join(',');
    const script = `$ErrorActionPreference='SilentlyContinue'; foreach ($n in @(${names})) { Get-AppxPackage -Name $n | ForEach-Object { $app = (Get-AppxPackageManifest $_).Package.Applications.Application | Select-Object -First 1; Write-Output ($_.Name + '|' + $_.PackageFamilyName + '!' + $app.Id) } }`;
    let output = '';
    try {
      output = await execFileText(this.execFileImpl, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 15000);
    } catch (_) {
      return [];
    }
    const found = [];
    for (const line of output.split(/\r?\n/)) {
      const [name, aumid] = line.trim().split('|');
      const simulator = SIMULATORS.find((item) => item.storePackage === name);
      if (!simulator || !/^[\w.-]+_\w+![\w.-]+$/.test(aumid || '')) continue;
      found.push({ key: `${simulator.id}:store`, simId: simulator.id, source: 'store', label: `${simulator.label} · Microsoft Store`, launchTarget: aumid });
    }
    return found;
  }

  chooseSimulator(key) {
    const candidate = (this.simCandidates || []).find((item) => item.key === key);
    if (!candidate) return { ok: false, message: 'Diese Sim-Version wurde nicht erkannt.' };
    const settings = this.settings();
    const simulator = SIMULATORS.find((item) => item.id === candidate.simId);
    const existing = settings.entries.find((entry) => entry.kind === 'sim');
    const simEntry = {
      id: existing?.id || this.createId(),
      kind: 'sim',
      name: simulator.label,
      simId: candidate.simId,
      source: candidate.source,
      launchTarget: candidate.launchTarget,
      args: existing?.args || '',
      enabled: true,
      delaySeconds: existing ? existing.delaySeconds : 0
    };
    const entries = existing
      ? settings.entries.map((entry) => (entry.kind === 'sim' ? simEntry : entry))
      : settings.entries.concat(simEntry);
    this.simCandidates = null;
    this.save({ ...settings, entries });
    return { ok: true };
  }

  async processSnapshot() {
    try {
      const snapshot = parseProcessSnapshot(await execFileText(this.execFileImpl, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PROCESS_SNAPSHOT_COMMAND], 20000));
      return snapshot.size ? snapshot : null;
    } catch (_) {
      return null;
    }
  }

  async runningImageNames() {
    try {
      return parseTasklistImageNames(await execFileText(this.execFileImpl, 'tasklist.exe', ['/FO', 'CSV', '/NH']));
    } catch (_) {
      return new Set();
    }
  }

  async launchEntry(entry) {
    if (entry.kind === 'sim') {
      if (entry.source === 'steam') {
        const simulator = SIMULATORS.find((item) => item.id === entry.simId);
        await this.openExternal(entry.args && simulator
          ? `steam://run/${simulator.steamAppId}//${encodeURIComponent(entry.args)}/`
          : entry.launchTarget);
      } else {
        await execFileText(this.execFileImpl, 'explorer.exe', [`shell:AppsFolder\\${entry.launchTarget}`]).catch((error) => {
          // explorer.exe meldet auch bei erfolgreichem Start oft Exitcode 1.
          if (error?.code !== 1) throw error;
        });
      }
      return;
    }
    if (!this.fs.existsSync(entry.path)) throw new Error('Datei nicht gefunden.');
    const output = await execFileText(this.execFileImpl, 'powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      startProcessCommand({ file: entry.path, args: entry.args, cwd: entry.cwd, admin: entry.admin })
    ], 60000);
    const pid = Number(String(output).trim().split(/\s+/).pop());
    return Number.isInteger(pid) && pid > 0 ? pid : 0;
  }

  setRun(patch) {
    this.run = { ...this.run, ...patch };
    this.emitState();
  }

  setResult(id, status) {
    this.run = { ...this.run, results: { ...this.run.results, [id]: status } };
    this.emitState();
  }

  async launchAll() {
    if (this.platform !== 'win32') return { ok: false, message: 'Autostart ist nur unter Windows verfügbar.' };
    if (this.run.phase === 'running') return { ok: false, message: 'Der Autostart läuft bereits.' };
    const settings = this.settings();
    if (!settings.enabled) return { ok: false, message: 'Autostart ist ausgeschaltet.' };
    const entries = settings.entries.filter((entry) => entry.enabled);
    this.setRun({ phase: 'running', currentId: '', results: {}, message: '' });
    let failed = 0;
    if (!this.baselinePids && entries.some((entry) => entry.kind === 'program')) {
      const snapshot = await this.processSnapshot();
      if (snapshot) this.baselinePids = new Set(snapshot.keys());
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      this.setRun({ currentId: entry.id });
      const running = entry.imageName ? await this.runningImageNames() : new Set();
      if (entry.imageName && running.has(entry.imageName.toLowerCase())) {
        this.setResult(entry.id, 'skipped');
        continue;
      }
      try {
        const pid = await this.launchEntry(entry);
        if (entry.kind === 'program') {
          if (entry.imageName) this.ownedImageNames.add(entry.imageName);
          if (pid) this.ownedRoots.add(pid);
          const folder = ownedFolderFor(entry.path);
          if (folder) this.ownedFolders.add(folder);
        }
        this.setResult(entry.id, 'started');
      } catch (_) {
        failed += 1;
        this.setResult(entry.id, 'failed');
      }
      if (index < entries.length - 1 && entry.delaySeconds > 0) await this.sleep(entry.delaySeconds * 1000);
    }
    const simEntry = entries.find((entry) => entry.kind === 'sim' && entry.imageName);
    if (simEntry && this.run.results[simEntry.id] !== 'failed') void this.watchSimulator(simEntry.imageName);
    const message = failed
      ? `${failed} Programm${failed === 1 ? '' : 'e'} konnte${failed === 1 ? '' : 'n'} nicht gestartet werden.`
      : 'Alle Programme wurden gestartet.';
    this.setRun({ phase: 'done', currentId: '', message });
    return { ok: failed === 0, message };
  }

  // Beobachtet den Sim nach dem Autostart. Sobald er lief und danach zweimal
  // in Folge fehlt, gilt er als beendet und die eigenen Programme werden
  // geschlossen. Ein Sim, der nie erscheint, beendet nur die Beobachtung.
  async watchSimulator(imageName) {
    const token = ++this.simWatchToken;
    const name = imageName.toLowerCase();
    let seen = false;
    let gone = 0;
    for (let poll = 0; this.simWatchToken === token; poll += 1) {
      await this.sleep(SIM_POLL_MS);
      if (this.simWatchToken !== token) return;
      const running = await this.runningImageNames();
      if (running.size === 0) continue; // tasklist fehlgeschlagen, nicht als Ende werten
      if (running.has(name)) {
        seen = true;
        gone = 0;
        continue;
      }
      if (!seen) {
        if (poll + 1 >= SIM_APPEAR_POLLS) return;
        continue;
      }
      gone += 1;
      if (gone < SIM_GONE_POLLS) continue;
      await this.shutdownOwned();
      return;
    }
  }

  stopSimulatorWatch() {
    this.simWatchToken += 1;
  }

  // Schliesst nur Programme, die in dieser Sitzung vom Autostart gestartet
  // wurden und vorher nicht liefen; ausgeloest durch Sim-Ende oder App-Ende.
  // Der Simulator wird nie geschlossen.
  async shutdownOwned() {
    this.stopSimulatorWatch();
    const hasOwned = this.ownedImageNames.size || this.ownedRoots.size || this.ownedFolders.size;
    if (this.platform !== 'win32' || !this.settings().closeOnExit || !hasOwned) return;
    const names = [...this.ownedImageNames];
    const tracked = { baseline: this.baselinePids, roots: new Set(this.ownedRoots), folders: new Set(this.ownedFolders) };
    this.ownedImageNames.clear();
    this.ownedRoots.clear();
    this.ownedFolders.clear();
    this.baselinePids = null;
    const snapshot = tracked.baseline ? await this.processSnapshot() : null;
    if (snapshot) {
      const excludePaths = SIMULATORS.map((simulator) => simulator.imageName).concat(this.excludeProcessPaths || []);
      const pids = [...ownedProcessIds(snapshot, { ...tracked, excludePaths })];
      for (const pid of pids) {
        await execFileText(this.execFileImpl, 'taskkill.exe', ['/PID', String(pid), '/T']).catch(() => {});
      }
      await this.sleep(CLOSE_GRACE_MS);
      const after = await this.processSnapshot();
      for (const pid of pids) {
        if (after && !after.has(pid)) continue;
        await execFileText(this.execFileImpl, 'taskkill.exe', ['/PID', String(pid), '/T', '/F']).catch(() => {});
      }
      return;
    }
    // Ohne Prozessliste bleibt nur der Abgleich ueber den Dateinamen.
    for (const name of names) {
      await execFileText(this.execFileImpl, 'taskkill.exe', ['/IM', name, '/T']).catch(() => {});
    }
    await this.sleep(CLOSE_GRACE_MS);
    const running = await this.runningImageNames();
    for (const name of names) {
      if (!running.has(name.toLowerCase())) continue;
      await execFileText(this.execFileImpl, 'taskkill.exe', ['/IM', name, '/T', '/F']).catch(() => {});
    }
  }
}

module.exports = {
  AutostartLauncher,
  SIMULATORS,
  normalizeAutostartSettings,
  ownedFolderFor,
  ownedProcessIds,
  parseProcessSnapshot,
  parseSteamLibraryPaths,
  parseTasklistImageNames,
  startProcessCommand
};
