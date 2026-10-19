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
// Zweite Stufe: startet erst, wenn SimConnect verbunden ist und Daten liefert.
const SIMCONNECT_POLL_MS = 2000;
const SIMCONNECT_STABLE_POLLS = 5;
const SIMCONNECT_MAX_POLLS = 900;

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
    return { ...base, name: cleanText(entry.name, 120) || simulator.label, simId: simulator.id, source, launchTarget, args, imageName: simulator.imageName, admin: false, stage: 'start' };
  }
  const target = cleanText(entry.path, 1024);
  if (!target || !path.win32.isAbsolute(target)) return null;
  return {
    ...base,
    path: target,
    args: cleanText(entry.args, 2048),
    cwd: cleanText(entry.cwd, 1024),
    imageName: imageNameFor(target),
    admin: entry.admin === true,
    minimized: entry.minimized === true,
    stage: entry.stage === 'simconnect' ? 'simconnect' : 'start'
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

function startProcessParts({ file, args = '', cwd = '', minimized = false }) {
  const parts = [`Start-Process -FilePath ${psQuote(file)}`];
  if (args) parts.push(`-ArgumentList ${psQuote(args)}`);
  if (cwd) parts.push(`-WorkingDirectory ${psQuote(cwd)}`);
  if (minimized) parts.push('-WindowStyle Minimized');
  return parts;
}

function startProcessCommand({ file, args = '', cwd = '', admin = false, minimized = false }) {
  const parts = startProcessParts({ file, args, cwd, minimized });
  if (admin) parts.push('-Verb RunAs');
  // -PassThru liefert die Prozess-ID, damit auch Kindprozesse eines Launchers
  // spaeter zugeordnet werden koennen.
  return `$ErrorActionPreference='Stop'; $p = ${parts.join(' ')} -PassThru; if ($p) { $p.Id }`;
}

// Admin-Programme laufen ueber je zwei feste Windows-Aufgaben (Start/Stop) mit
// hoechsten Rechten, einmalig mit UAC angelegt. Die Aktion ist beim Anlegen fest
// eingetragen; zur Laufzeit wird nichts uebergeben, daher reichen die Aufgaben
// keine Rechte an beliebige Befehle weiter.
const TASK_PATH = '\\VFR Multitool\\';

function encodedPowerShell(command) {
  return Buffer.from(command, 'utf16le').toString('base64');
}

function adminTaskSpec(entry) {
  const folder = ownedFolderFor(entry.path);
  const start = startProcessParts({ file: entry.path, args: entry.args, cwd: entry.cwd, minimized: entry.minimized }).join(' ');
  const match = `$_.ExecutablePath -and ($_.ExecutablePath -ieq ${psQuote(entry.path)}${folder ? ` -or $_.ExecutablePath.StartsWith(${psQuote(folder)}, [StringComparison]::OrdinalIgnoreCase)` : ''})`;
  const stop = `$ids = @(Get-CimInstance Win32_Process | Where-Object { ${match} } | ForEach-Object { $_.ProcessId }); `
    + 'foreach ($id in $ids) { taskkill.exe /PID $id /T | Out-Null }; Start-Sleep -Seconds 5; '
    + 'foreach ($id in $ids) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { taskkill.exe /PID $id /T /F | Out-Null } }';
  const signature = 'vfr-autostart:' + crypto.createHash('sha256').update(start + '\n' + stop).digest('hex').slice(0, 24);
  return { id: entry.id, startName: `Autostart-${entry.id}-start`, stopName: `Autostart-${entry.id}-stop`, start, stop, signature };
}

function adminTaskSetupScript(specs, staleNames = []) {
  const lines = [
    "$ErrorActionPreference = 'Stop'",
    '$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest',
    '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0 -MultipleInstances IgnoreNew'
  ];
  for (const name of staleNames) {
    lines.push(`Unregister-ScheduledTask -TaskPath ${psQuote(TASK_PATH)} -TaskName ${psQuote(name)} -Confirm:$false -ErrorAction SilentlyContinue`);
  }
  for (const spec of specs) {
    for (const [name, command] of [[spec.startName, spec.start], [spec.stopName, spec.stop]]) {
      const action = `New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${psQuote(`-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encodedPowerShell(command)}`)}`;
      lines.push(`Register-ScheduledTask -TaskPath ${psQuote(TASK_PATH)} -TaskName ${psQuote(name)} -Action (${action}) -Principal $principal -Settings $settings -Description ${psQuote(spec.signature)} -Force | Out-Null`);
    }
  }
  return lines.join('; ');
}

function isAccessDenied(error) {
  return /access is denied|zugriff verweigert|accès refusé|acceso denegado/i.test(`${error?.stderr || ''} ${error?.message || ''}`);
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
    createId = () => crypto.randomUUID(),
    log = () => {},
    getSimConnectState = () => null
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
    this.log = (line) => { try { log(line); } catch (_) {} };
    this.adminLaunched = new Set();
    this.getSimConnectState = getSimConnectState;
    this.stageToken = 0;
    this.adminTasksReady = new Set();
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
        minimized: entry.minimized === true,
        stage: entry.stage,
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
        stage: 'start',
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
        minimized: existing.kind === 'program' && typeof item.minimized === 'boolean' ? item.minimized : existing.minimized,
        stage: existing.kind === 'program' && (item.stage === 'simconnect' || item.stage === 'start') ? item.stage : existing.stage,
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

  async readAdminTasks() {
    try {
      const text = await execFileText(this.execFileImpl, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Get-ScheduledTask -TaskPath ${psQuote(TASK_PATH)} -ErrorAction SilentlyContinue | ForEach-Object { $_.TaskName + '|' + $_.Description }`], 20000);
      const tasks = new Map();
      for (const line of text.split(/\r?\n/)) {
        const [name, description = ''] = line.trim().split('|');
        if (name) tasks.set(name, description);
      }
      return tasks;
    } catch (_) {
      return new Map();
    }
  }

  // Legt fehlende oder veraltete Aufgaben mit einer einzigen UAC-Abfrage an und
  // entfernt dabei Aufgaben geloeschter Eintraege. Abgelehnt: Start mit RunAs.
  async ensureAdminTasks(entries) {
    const specs = entries.filter((entry) => entry.kind === 'program' && entry.admin).map(adminTaskSpec);
    this.adminTasksReady = new Set();
    let tasks = await this.readAdminTasks();
    const known = new Set(this.settings().entries.filter((entry) => entry.admin).map((entry) => entry.id));
    const stale = [...tasks.keys()].filter((name) => {
      const match = name.match(/^Autostart-(.+)-(start|stop)$/);
      return match && !known.has(match[1]);
    });
    const outdated = specs.filter((spec) => tasks.get(spec.startName) !== spec.signature || tasks.get(spec.stopName) !== spec.signature);
    if (outdated.length) {
      this.log(`AUTOSTART_TASK_SETUP create=${outdated.length} remove=${stale.length}`);
      // Windows begrenzt die Kommandozeile auf 32767 Zeichen; sehr viele
      // Admin-Eintraege werden daher auf mehrere Abfragen verteilt.
      const batches = [];
      for (const spec of outdated) {
        const last = batches[batches.length - 1];
        if (last && encodedPowerShell(adminTaskSetupScript(last.concat(spec), stale)).length < 26000) last.push(spec);
        else batches.push([spec]);
      }
      for (const [index, batch] of batches.entries()) {
        const script = encodedPowerShell(adminTaskSetupScript(batch, index === 0 ? stale : []));
        try {
          await execFileText(this.execFileImpl, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `$p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${script}'; exit $p.ExitCode`], 180000);
        } catch (error) {
          this.log(`AUTOSTART_TASK_SETUP_FAILED error=${cleanText(error?.message, 200)}`);
          break;
        }
      }
      tasks = await this.readAdminTasks();
    }
    for (const spec of specs) {
      if (tasks.get(spec.startName) === spec.signature && tasks.get(spec.stopName) === spec.signature) this.adminTasksReady.add(spec.id);
    }
    this.log(`AUTOSTART_TASK_READY ready=${this.adminTasksReady.size} admin=${specs.length}`);
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
    if (entry.admin && this.adminTasksReady.has(entry.id)) {
      await execFileText(this.execFileImpl, 'schtasks.exe', ['/Run', '/TN', `${TASK_PATH}${adminTaskSpec(entry).startName}`]);
      this.adminLaunched.add(entry.id);
      return 0;
    }
    const output = await execFileText(this.execFileImpl, 'powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      startProcessCommand({ file: entry.path, args: entry.args, cwd: entry.cwd, admin: entry.admin, minimized: entry.minimized })
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

  async launchOne(entry) {
    this.setRun({ currentId: entry.id });
    const running = entry.imageName ? await this.runningImageNames() : new Set();
    if (entry.imageName && running.has(entry.imageName.toLowerCase())) {
      this.setResult(entry.id, 'skipped');
      this.log(`AUTOSTART_SKIPPED entry=${entry.name} reason=already-running`);
      return true;
    }
    try {
      const pid = await this.launchEntry(entry);
      if (entry.kind === 'program') {
        if (entry.imageName) this.ownedImageNames.add(entry.imageName);
        if (pid) this.ownedRoots.add(pid);
        this.log(`AUTOSTART_STARTED entry=${entry.name} pid=${pid || (this.adminLaunched.has(entry.id) ? 'task' : 'unknown')} admin=${entry.admin ? 1 : 0} minimized=${entry.minimized ? 1 : 0} stage=${entry.stage}`);
        const folder = ownedFolderFor(entry.path);
        if (folder) this.ownedFolders.add(folder);
      }
      this.setResult(entry.id, 'started');
      return true;
    } catch (error) {
      this.setResult(entry.id, 'failed');
      this.log(`AUTOSTART_FAILED entry=${entry.name} error=${cleanText(error?.message, 200)}`);
      return false;
    }
  }

  async launchSequence(entries) {
    let failed = 0;
    for (let index = 0; index < entries.length; index += 1) {
      if (!(await this.launchOne(entries[index]))) failed += 1;
      if (index < entries.length - 1 && entries[index].delaySeconds > 0) await this.sleep(entries[index].delaySeconds * 1000);
    }
    return failed;
  }

  static failureMessage(failed) {
    return failed
      ? `${failed} Programm${failed === 1 ? '' : 'e'} konnte${failed === 1 ? '' : 'n'} nicht gestartet werden.`
      : 'Alle Programme wurden gestartet.';
  }

  async launchAll() {
    if (this.platform !== 'win32') return { ok: false, message: 'Autostart ist nur unter Windows verfügbar.' };
    if (this.run.phase === 'running') return { ok: false, message: 'Der Autostart läuft bereits.' };
    if (this.run.phase === 'waiting') return { ok: false, message: 'Der Autostart wartet noch auf SimConnect.' };
    const settings = this.settings();
    if (!settings.enabled) return { ok: false, message: 'Autostart ist ausgeschaltet.' };
    const entries = settings.entries.filter((entry) => entry.enabled);
    const first = entries.filter((entry) => entry.stage !== 'simconnect');
    const later = entries.filter((entry) => entry.stage === 'simconnect');
    this.setRun({ phase: 'running', currentId: '', results: {}, message: '' });
    this.log(`AUTOSTART_LAUNCH entries=${first.map((entry) => entry.name).join(', ')} simconnect=${later.map((entry) => entry.name).join(', ') || 'none'}`);
    if (entries.some((entry) => entry.kind === 'program' && entry.admin)) await this.ensureAdminTasks(entries);
    if (!this.baselinePids && entries.some((entry) => entry.kind === 'program')) {
      const snapshot = await this.processSnapshot();
      if (snapshot) this.baselinePids = new Set(snapshot.keys());
    }
    const failed = await this.launchSequence(first);
    const simEntry = first.find((entry) => entry.kind === 'sim' && entry.imageName);
    if (simEntry && this.run.results[simEntry.id] !== 'failed') void this.watchSimulator(simEntry.imageName, simEntry.id);
    const message = AutostartLauncher.failureMessage(failed);
    if (later.length) {
      this.setRun({ phase: 'waiting', currentId: '', message: 'Wartet auf SimConnect …' });
      void this.launchAfterSimConnect(later, failed);
      return { ok: failed === 0, message, waiting: later.length };
    }
    this.setRun({ phase: 'done', currentId: '', message });
    return { ok: failed === 0, message };
  }

  // SimConnect gilt als bereit, wenn der Tracker verbunden ist und Daten
  // liefert (live oder Ruhemodus), und zwar ueber mehrere Abfragen stabil.
  simConnectReady() {
    const state = this.getSimConnectState() || {};
    return state.simulator === 'connected' && ['live', 'hibernate'].includes(state.telemetry);
  }

  async launchAfterSimConnect(entries, failedBefore = 0) {
    const token = ++this.stageToken;
    let stable = 0;
    for (let poll = 0; poll < SIMCONNECT_MAX_POLLS; poll += 1) {
      if (this.stageToken !== token) return;
      stable = this.simConnectReady() ? stable + 1 : 0;
      if (stable >= SIMCONNECT_STABLE_POLLS) break;
      await this.sleep(SIMCONNECT_POLL_MS);
    }
    if (this.stageToken !== token) return;
    if (stable < SIMCONNECT_STABLE_POLLS) {
      for (const entry of entries) this.setResult(entry.id, 'skipped');
      this.log('AUTOSTART_SIMCONNECT_TIMEOUT');
      this.setRun({ phase: 'done', currentId: '', message: 'SimConnect wurde nicht bereit, die wartenden Programme wurden nicht gestartet.' });
      return;
    }
    this.log('AUTOSTART_SIMCONNECT_READY');
    this.setRun({ phase: 'running', message: '' });
    const failed = failedBefore + await this.launchSequence(entries);
    this.setRun({ phase: 'done', currentId: '', message: AutostartLauncher.failureMessage(failed) });
  }

  cancelWaitingStage() {
    if (this.run.phase !== 'waiting') return;
    this.stageToken += 1;
    this.setRun({ phase: 'done', currentId: '', message: 'Wartende Programme wurden nicht gestartet.' });
  }

  // Beobachtet den Sim nach dem Autostart. Sobald er lief und danach zweimal
  // in Folge fehlt, gilt er als beendet und die eigenen Programme werden
  // geschlossen. Ein Sim, der nie erscheint, beendet nur die Beobachtung.
  async watchSimulator(imageName, simId = '') {
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
        if (!seen) {
          this.log(`AUTOSTART_SIM_SEEN image=${imageName}`);
          if (simId) this.setResult(simId, 'running');
        }
        seen = true;
        gone = 0;
        continue;
      }
      if (!seen) {
        if (poll + 1 >= SIM_APPEAR_POLLS) {
          this.log(`AUTOSTART_SIM_NOT_SEEN image=${imageName}`);
          return;
        }
        continue;
      }
      gone += 1;
      if (gone < SIM_GONE_POLLS) continue;
      this.log(`AUTOSTART_SIM_ENDED image=${imageName}`);
      if (simId) this.setResult(simId, 'ended');
      await this.shutdownOwned('sim-ended');
      return;
    }
  }

  stopSimulatorWatch() {
    this.simWatchToken += 1;
  }

  // Schliesst nur Programme, die in dieser Sitzung vom Autostart gestartet
  // wurden und vorher nicht liefen; ausgeloest durch Sim-Ende oder App-Ende.
  // Der Simulator wird nie geschlossen.
  async shutdownOwned(reason = 'app-exit') {
    this.stopSimulatorWatch();
    this.cancelWaitingStage();
    const hasOwned = this.ownedImageNames.size || this.ownedRoots.size || this.ownedFolders.size || this.adminLaunched.size;
    if (this.platform !== 'win32' || !this.settings().closeOnExit || !hasOwned) return;
    const names = [...this.ownedImageNames];
    const tracked = { baseline: this.baselinePids, roots: new Set(this.ownedRoots), folders: new Set(this.ownedFolders) };
    this.ownedImageNames.clear();
    this.ownedRoots.clear();
    this.ownedFolders.clear();
    this.baselinePids = null;
    const adminIds = [...this.adminLaunched];
    this.adminLaunched.clear();
    this.log(`AUTOSTART_CLOSE reason=${reason} tasks=${adminIds.length}`);
    await this.closeOwnedProcesses({ names, tracked, adminIds });
    // Gestartete Programme gelten danach als beendet (Statusanzeige).
    const results = { ...this.run.results };
    for (const entry of this.settings().entries) {
      if (entry.kind === 'program' && results[entry.id] === 'started') results[entry.id] = 'closed';
    }
    this.run = { ...this.run, results };
    this.emitState();
  }

  async closeOwnedProcesses({ names, tracked, adminIds }) {
    const byId = new Map(this.settings().entries.map((entry) => [entry.id, entry]));
    for (const id of adminIds) {
      const entry = byId.get(id);
      if (!entry) continue;
      await execFileText(this.execFileImpl, 'schtasks.exe', ['/Run', '/TN', `${TASK_PATH}${adminTaskSpec(entry).stopName}`])
        .then(() => this.log(`AUTOSTART_TASK_STOP entry=${entry.name}`))
        .catch((error) => this.log(`AUTOSTART_TASK_STOP_FAILED entry=${entry.name} error=${cleanText(error?.message, 200)}`));
    }
    const snapshot = tracked.baseline ? await this.processSnapshot() : null;
    if (snapshot) {
      const excludePaths = SIMULATORS.map((simulator) => simulator.imageName).concat(this.excludeProcessPaths || []);
      const pids = [...ownedProcessIds(snapshot, { ...tracked, excludePaths })];
      this.log(`AUTOSTART_CLOSE_PIDS ${pids.map((pid) => `${pid}:${path.win32.basename(snapshot.get(pid)?.path || '?') || '?'}`).join(' ') || 'none'}`);
      for (const pid of pids) {
        await execFileText(this.execFileImpl, 'taskkill.exe', ['/PID', String(pid), '/T']).catch(() => {});
      }
      await this.sleep(CLOSE_GRACE_MS);
      const after = await this.processSnapshot();
      const denied = [];
      for (const pid of pids) {
        if (after && !after.has(pid)) continue;
        // Ein Baum-Kill beendet oft schon die Kindprozesse; "nicht gefunden" ist dann kein Fehler.
        await execFileText(this.execFileImpl, 'taskkill.exe', ['/PID', String(pid), '/T', '/F']).catch((error) => {
          if (!isAccessDenied(error)) return;
          denied.push(pid);
          this.log(`AUTOSTART_KILL_DENIED pid=${pid}`);
        });
      }
      await this.closeElevated(denied);
      const remaining = after ? pids.filter((pid) => after.has(pid)) : pids;
      const final = remaining.length ? await this.processSnapshot() : null;
      const left = final ? remaining.filter((pid) => final.has(pid)) : [];
      this.log(left.length ? `AUTOSTART_CLOSE_REMAINING ${left.join(' ')}` : 'AUTOSTART_CLOSE_DONE');
      return;
    }
    // Ohne Prozessliste bleibt nur der Abgleich ueber den Dateinamen.
    this.log(`AUTOSTART_CLOSE_BY_NAME ${names.join(' ') || 'none'}`);
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

  // Prozesse mit Adminrechten lassen sich ohne Adminrechte nicht beenden:
  // dann einmal mit UAC-Abfrage hart beenden.
  async closeElevated(pids) {
    if (!pids.length) return;
    const list = pids.map((pid) => `'/PID','${Number(pid)}'`).join(',');
    this.log(`AUTOSTART_CLOSE_ELEVATED pids=${pids.join(',')}`);
    await execFileText(this.execFileImpl, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Start-Process -FilePath 'taskkill.exe' -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '/T','/F',${list}`], 120000)
      .catch((error) => this.log(`AUTOSTART_CLOSE_ELEVATED_FAILED error=${cleanText(error?.message, 200)}`));
  }
}

module.exports = {
  AutostartLauncher,
  SIMULATORS,
  adminTaskSetupScript,
  adminTaskSpec,
  normalizeAutostartSettings,
  ownedFolderFor,
  ownedProcessIds,
  parseProcessSnapshot,
  parseSteamLibraryPaths,
  parseTasklistImageNames,
  startProcessCommand
};
