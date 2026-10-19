'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AutostartLauncher,
  adminTaskSetupScript,
  adminTaskSpec,
  normalizeAutostartSettings,
  parseSteamLibraryPaths,
  parseTasklistImageNames,
  startProcessCommand
} = require('../lib/autostart-launcher');

function memoryStore(initial = {}) {
  let autostart = initial;
  return {
    readAutostart: () => autostart,
    writeAutostart: (next) => { autostart = JSON.parse(JSON.stringify(next)); return autostart; }
  };
}

function fakeExec(handlers, calls) {
  return (command, args, _options, callback) => {
    calls.push({ command, args });
    const handler = handlers[command];
    if (!handler) return callback(null, '', '');
    try {
      const output = handler(args);
      callback(null, output, '');
    } catch (error) {
      callback(error, '', error.stderr || '');
    }
  };
}

function launcher({ store = memoryStore(), files = [], handlers = {}, calls = [], ...rest } = {}) {
  let counter = 0;
  const existing = new Set(files.map((file) => file.toLowerCase()));
  return new AutostartLauncher({
    configStore: store,
    platform: 'win32',
    execFileImpl: fakeExec(handlers, calls),
    fsModule: {
      existsSync: (file) => existing.has(String(file).toLowerCase()),
      readFileSync: () => { throw new Error('missing'); }
    },
    sleep: async () => {},
    createId: () => `id-${++counter}`,
    ...rest
  });
}

test('settings are normalized and unknown or invalid entries are dropped', () => {
  const settings = normalizeAutostartSettings({
    enabled: true,
    entries: [
      { id: 'a', kind: 'program', path: 'C:\\Tools\\a.exe', delaySeconds: 999, admin: true },
      { id: 'b', kind: 'program', path: 'relative.exe' },
      { id: 'a', kind: 'program', path: 'C:\\Tools\\dup.exe' },
      { id: 's1', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590' },
      { id: 's2', kind: 'sim', simId: 'msfs2020', source: 'store', launchTarget: 'x_y!App' }
    ]
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.closeOnExit, false);
  assert.deepEqual(settings.entries.map((entry) => entry.id), ['a', 's1']);
  assert.equal(settings.entries[0].delaySeconds, 120);
  assert.equal(settings.entries[0].imageName, 'a.exe');
  assert.equal(settings.entries[1].imageName, 'FlightSimulator2024.exe');
});

test('start commands quote paths and request elevation only for admin entries', () => {
  assert.equal(
    startProcessCommand({ file: "C:\\Tom's Tools\\a.exe", args: '-x', cwd: 'C:\\Tools' }),
    "$ErrorActionPreference='Stop'; $p = Start-Process -FilePath 'C:\\Tom''s Tools\\a.exe' -ArgumentList '-x' -WorkingDirectory 'C:\\Tools' -PassThru; if ($p) { $p.Id }"
  );
  assert.match(startProcessCommand({ file: 'C:\\a.exe', admin: true }), /-Verb RunAs -PassThru/);
  assert.doesNotMatch(startProcessCommand({ file: 'C:\\a.exe' }), /ArgumentList|RunAs/);
});

test('steam library and tasklist output are parsed', () => {
  assert.deepEqual(parseSteamLibraryPaths('"0"\n{\n\t"path"\t\t"C:\\\\Steam"\n}\n"1"\n{\n\t"path"\t\t"D:\\\\SteamLibrary"\n}'), ['C:\\Steam', 'D:\\SteamLibrary']);
  assert.deepEqual([...parseTasklistImageNames('"Code.exe","1","Console","1","10 K"\r\n"FlightSimulator2024.exe","2","Console","1","10 K"')], ['code.exe', 'flightsimulator2024.exe']);
});

test('dropped files are validated, shortcuts resolved and duplicates ignored', () => {
  const instance = launcher({
    files: ['C:\\Tools\\Little Navmap.exe', 'C:\\Users\\me\\Desktop\\Navigraph.lnk', 'C:\\notes.txt'],
    resolveShortcut: () => ({ target: 'C:\\Navigraph\\Charts.exe', args: '--minimized', cwd: 'C:\\Navigraph' })
  });
  const result = instance.addPaths([
    'C:\\Tools\\Little Navmap.exe',
    'C:\\Users\\me\\Desktop\\Navigraph.lnk',
    'C:\\notes.txt',
    'C:\\missing.exe',
    'C:\\Tools\\Little Navmap.exe'
  ]);
  assert.equal(result.added, 2);
  assert.deepEqual(result.rejected, ['notes.txt', 'missing.exe']);
  const entries = instance.publicState().entries;
  assert.deepEqual(entries.map((entry) => entry.name), ['Little Navmap', 'Navigraph']);
  assert.equal(entries[1].detail, 'C:\\Navigraph\\Charts.exe');
});

test('entry updates only reorder and toggle known entries', () => {
  const store = memoryStore({ enabled: true, entries: [
    { id: 'a', kind: 'program', path: 'C:\\a.exe' },
    { id: 'b', kind: 'program', path: 'C:\\b.exe' },
    { id: 'c', kind: 'program', path: 'C:\\c.exe' }
  ] });
  const instance = launcher({ store });
  instance.updateEntries([
    { id: 'c', admin: true, delaySeconds: 10 },
    { id: 'evil', path: 'C:\\evil.exe' },
    { id: 'a', enabled: false }
  ]);
  const entries = instance.settings().entries;
  assert.deepEqual(entries.map((entry) => entry.id), ['c', 'a']);
  assert.equal(entries[0].admin, true);
  assert.equal(entries[0].delaySeconds, 10);
  assert.equal(entries[1].enabled, false);
});

test('simulator detection offers steam and store installs and stores the chosen one', async () => {
  const instance = launcher({
    files: ['D:\\SteamLibrary\\steamapps\\appmanifest_2537590.acf'],
    handlers: {
      'reg.exe': () => '    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
      'powershell.exe': () => 'Microsoft.Limitless|Microsoft.Limitless_8wekyb3d8bbwe!App\r\n'
    }
  });
  instance.fs.readFileSync = () => '"path"\t\t"D:\\\\SteamLibrary"';
  const result = await instance.detectSimulators();
  assert.deepEqual(result.candidates.map((candidate) => candidate.key), ['msfs2024:steam', 'msfs2024:store']);
  assert.equal(instance.chooseSimulator('msfs2024:store').ok, true);
  const sim = instance.settings().entries.find((entry) => entry.kind === 'sim');
  assert.equal(sim.source, 'store');
  assert.equal(sim.launchTarget, 'Microsoft.Limitless_8wekyb3d8bbwe!App');
  assert.equal(instance.publicState().simCandidates, null);
});

test('launch runs entries in order, skips running programs and only closes owned ones', async () => {
  const calls = [];
  const opened = [];
  const running = new Set(['b.exe']);
  const store = memoryStore({ enabled: true, closeOnExit: true, entries: [
    { id: 'a', kind: 'program', path: 'C:\\a.exe', admin: true, delaySeconds: 2 },
    { id: 'b', kind: 'program', path: 'C:\\b.exe' },
    { id: 'x', kind: 'program', path: 'C:\\x.exe', enabled: false },
    { id: 's', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590' }
  ] });
  const instance = launcher({
    store,
    calls,
    files: ['C:\\a.exe', 'C:\\b.exe', 'C:\\x.exe'],
    openExternal: async (url) => opened.push(url),
    handlers: {
      'tasklist.exe': () => [...running].map((name) => `"${name}","1"`).join('\r\n'),
      'powershell.exe': (args) => { if (/a\.exe/.test(args.at(-1))) running.add('a.exe'); return ''; }
    }
  });
  const result = await instance.launchAll();
  assert.equal(result.ok, true);
  assert.deepEqual(instance.run.results, { a: 'started', b: 'skipped', s: 'started' });
  const starts = calls.filter((call) => call.command === 'powershell.exe' && /Start-Process -FilePath 'C:/.test(call.args.at(-1)));
  assert.equal(starts.length, 1);
  assert.match(starts[0].args.at(-1), /-Verb RunAs/);
  assert.deepEqual(opened, ['steam://rungameid/2537590']);

  calls.length = 0;
  await instance.shutdownOwned();
  const kills = calls.filter((call) => call.command === 'taskkill.exe');
  assert.deepEqual(kills.map((call) => call.args), [['/IM', 'a.exe', '/T'], ['/IM', 'a.exe', '/T', '/F']]);
});

test('launch is refused while disabled and close is skipped without the option', async () => {
  const calls = [];
  const instance = launcher({ calls, store: memoryStore({ enabled: false, entries: [] }) });
  assert.equal((await instance.launchAll()).ok, false);
  instance.ownedImageNames.add('a.exe');
  await instance.shutdownOwned();
  assert.equal(calls.length, 0);
});

test('new programs are listed first and the simulator stays at the end', () => {
  const store = memoryStore({ enabled: true, entries: [
    { id: 'old', kind: 'program', name: 'old', path: 'C:\\old.exe' },
    { id: 's', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590' }
  ] });
  const instance = launcher({ store, files: ['C:\\new.exe'] });
  assert.equal(instance.addPaths(['C:\\new.exe']).added, 1);
  assert.deepEqual(instance.settings().entries.map((entry) => entry.name), ['new', 'old', 'MSFS 2024']);
});

function simWatchFixture(sequence) {
  const calls = [];
  let poll = 0;
  const instance = launcher({
    calls,
    store: memoryStore({ enabled: true, closeOnExit: true, entries: [] }),
    handlers: {
      'tasklist.exe': () => {
        const state = sequence[Math.min(poll, sequence.length - 1)];
        poll += 1;
        if (poll >= sequence.length + 3) instance.stopSimulatorWatch();
        if (state === 'error') throw new Error('tasklist failed');
        return ['"explorer.exe","1"', ...(state === 'sim' ? ['"FlightSimulator2024.exe","2"'] : [])].join('\r\n');
      }
    }
  });
  instance.ownedImageNames.add('navmap.exe');
  const kills = () => calls.filter((call) => call.command === 'taskkill.exe').map((call) => call.args[1]);
  return { instance, kills };
}

test('owned programs close after the simulator was running and then ends', async () => {
  const { instance, kills } = simWatchFixture(['none', 'sim', 'sim', 'error', 'none', 'none']);
  await instance.watchSimulator('FlightSimulator2024.exe');
  assert.ok(kills().includes('navmap.exe'));
  assert.equal(instance.ownedImageNames.size, 0);
});

test('a single missed poll or a simulator that never starts closes nothing', async () => {
  const blip = simWatchFixture(['sim', 'none', 'sim']);
  await blip.instance.watchSimulator('FlightSimulator2024.exe');
  assert.deepEqual(blip.kills(), []);

  const never = simWatchFixture(['none']);
  await never.instance.watchSimulator('FlightSimulator2024.exe');
  assert.deepEqual(never.kills(), []);
  assert.equal(never.instance.ownedImageNames.size, 1);
});

test('processes started by a launcher are closed via PID tree and program folder', async () => {
  const calls = [];
  // 100/101 liefen vorher; der Launcher (500) startet 501 und beendet sich.
  let table = [[100, 1, 'C:\\Windows\\explorer.exe'], [101, 100, 'C:\\Other\\Tool\\keep.exe']];
  const store = memoryStore({ enabled: true, closeOnExit: true, entries: [
    { id: 'l', kind: 'program', path: 'D:\\Apps\\Charts\\Launcher.exe' }
  ] });
  const instance = launcher({
    store, calls, files: ['D:\\Apps\\Charts\\Launcher.exe'],
    handlers: {
      'tasklist.exe': () => '"explorer.exe","100"',
      'powershell.exe': (args) => {
        const command = args.at(-1);
        if (/Start-Process/.test(command)) {
          table = table.concat([[500, 100, 'D:\\Apps\\Charts\\Launcher.exe']]);
          return '500\r\n';
        }
        return table.map((row) => row.join('|')).join('\r\n');
      }
    }
  });
  await instance.launchAll();
  instance.stopSimulatorWatch();
  // Launcher beendet, eigentliches Programm aus Unterordner, dessen Kind, ein fremder neuer Prozess.
  table = [[100, 1, 'C:\\Windows\\explorer.exe'], [101, 100, 'C:\\Other\\Tool\\keep.exe'],
    [501, 500, 'D:\\Apps\\Charts\\app-2.1\\Charts.exe'], [502, 501, 'C:\\Windows\\System32\\conhost.exe'],
    [600, 100, 'D:\\Apps\\Charts\\Updater.exe'], [700, 100, 'C:\\Other\\Unrelated.exe']];
  calls.length = 0;
  await instance.shutdownOwned();
  const killed = calls.filter((call) => call.command === 'taskkill.exe').map((call) => call.args[1]);
  assert.deepEqual([...new Set(killed)].sort(), ['501', '502', '600']);
});

test('start arguments are editable for programs and Steam, not for the Store', async () => {
  const opened = [];
  const calls = [];
  const store = memoryStore({ enabled: true, entries: [
    { id: 'p', kind: 'program', path: 'C:\\Tools\\Nav\\nav.exe' },
    { id: 's', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590' }
  ] });
  const instance = launcher({ store, calls, files: ['C:\\Tools\\Nav\\nav.exe'], openExternal: async (url) => opened.push(url) });
  instance.updateEntries([{ id: 'p', args: '--profile "VFR One"' }, { id: 's', args: '-FastLaunch' }]);
  const state = instance.publicState().entries;
  assert.deepEqual(state.map((entry) => [entry.args, entry.argsSupported]), [['--profile "VFR One"', true], ['-FastLaunch', true]]);
  await instance.launchAll();
  instance.stopSimulatorWatch();
  const start = calls.find((call) => call.command === 'powershell.exe' && /Start-Process/.test(call.args.at(-1)));
  assert.match(start.args.at(-1), /-ArgumentList '--profile "VFR One"'/);
  assert.deepEqual(opened, ['steam://run/2537590//-FastLaunch/']);

  const storeSim = launcher({ store: memoryStore({ enabled: true, entries: [
    { id: 'x', kind: 'sim', simId: 'msfs2024', source: 'store', launchTarget: 'Microsoft.Limitless_8wekyb3d8bbwe!App' }
  ] }) });
  storeSim.updateEntries([{ id: 'x', args: '-FastLaunch' }]);
  assert.deepEqual(storeSim.publicState().entries.map((entry) => [entry.args, entry.argsSupported]), [['', false]]);
});

test('minimized programs start with a minimized window and the option is stored', async () => {
  const calls = [];
  const store = memoryStore({ enabled: true, entries: [{ id: 'p', kind: 'program', path: 'C:\\Tools\\Nav\\nav.exe' }] });
  const instance = launcher({ store, calls, files: ['C:\\Tools\\Nav\\nav.exe'] });
  instance.updateEntries([{ id: 'p', minimized: true }]);
  assert.equal(instance.publicState().entries[0].minimized, true);
  await instance.launchAll();
  const start = calls.find((call) => call.command === 'powershell.exe' && /Start-Process/.test(call.args.at(-1)));
  assert.match(start.args.at(-1), /-WindowStyle Minimized/);
});

test('access denied on close falls back to one elevated taskkill and everything is logged', async () => {
  const calls = [];
  const lines = [];
  let table = [[100, 1, 'C:\\Windows\\explorer.exe']];
  const store = memoryStore({ enabled: true, closeOnExit: true, entries: [{ id: 'p', kind: 'program', name: 'Say', path: 'D:\\Apps\\Say\\Say.exe' }] });
  const instance = launcher({
    store, calls, files: ['D:\\Apps\\Say\\Say.exe'], log: (line) => lines.push(line),
    handlers: {
      'powershell.exe': (args) => {
        if (/Start-Process -FilePath 'D/.test(args.at(-1))) { table = table.concat([[500, 100, '']]); return '500'; }
        if (/Start-Process -FilePath 'taskkill/.test(args.at(-1))) return '';
        return table.map((row) => row.join('|')).join('\r\n');
      },
      'taskkill.exe': (args) => {
        if (args.includes('/F')) { const error = new Error('Command failed'); error.stderr = 'FEHLER: Zugriff verweigert'; throw error; }
        return '';
      }
    }
  });
  await instance.launchAll();
  await instance.shutdownOwned();
  const elevated = calls.filter((call) => call.command === 'powershell.exe' && /taskkill\.exe' -Verb RunAs/.test(call.args.at(-1)));
  assert.equal(elevated.length, 1);
  assert.match(elevated[0].args.at(-1), /'\/PID','500'/);
  for (const marker of ['AUTOSTART_LAUNCH', 'AUTOSTART_STARTED entry=Say pid=500', 'AUTOSTART_CLOSE reason=app-exit', 'AUTOSTART_KILL_DENIED pid=500', 'AUTOSTART_CLOSE_ELEVATED pids=500']) {
    assert.ok(lines.some((line) => line.startsWith(marker)), marker);
  }
});

test('admin programs run through fixed scheduled tasks created with one elevation', async () => {
  const calls = [];
  const lines = [];
  let registered = new Map();
  const entry = { id: 'say', kind: 'program', name: 'SayIntentions', path: 'D:\\Apps\\SayIntentions\\SayIntentionsAI.exe', args: '--quiet', admin: true, minimized: true };
  const spec = adminTaskSpec(entry);
  const store = memoryStore({ enabled: true, closeOnExit: true, entries: [entry] });
  const instance = launcher({
    store, calls, files: [entry.path], log: (line) => lines.push(line),
    handlers: {
      'powershell.exe': (args) => {
        const command = args.at(-1);
        if (/Get-ScheduledTask/.test(command)) return [...registered].map(([name, sig]) => `${name}|${sig}`).join('\r\n');
        if (/-Verb RunAs -Wait/.test(command)) { registered = new Map([[spec.startName, spec.signature], [spec.stopName, spec.signature], ['Autostart-gone-start', 'x']]); return ''; }
        return '';
      }
    }
  });
  await instance.launchAll();
  instance.stopSimulatorWatch();
  assert.deepEqual(calls.filter((call) => call.command === 'schtasks.exe').map((call) => call.args), [['/Run', '/TN', '\\VFR Multitool\\Autostart-say-start']]);
  assert.equal(calls.filter((call) => /-Verb RunAs -Wait/.test(call.args.at(-1) || '')).length, 1);
  assert.ok(!calls.some((call) => /Start-Process -FilePath 'D:/.test(call.args.at(-1) || '')), 'no direct RunAs start');

  // Zweiter Start: Aufgaben sind aktuell, keine weitere UAC-Abfrage.
  calls.length = 0;
  instance.run.phase = 'done';
  await instance.launchAll();
  instance.stopSimulatorWatch();
  assert.equal(calls.filter((call) => /-Verb RunAs -Wait/.test(call.args.at(-1) || '')).length, 0);

  calls.length = 0;
  await instance.shutdownOwned('sim-ended');
  assert.deepEqual(calls.filter((call) => call.command === 'schtasks.exe').map((call) => call.args), [['/Run', '/TN', '\\VFR Multitool\\Autostart-say-stop']]);
  assert.ok(lines.some((line) => line.startsWith('AUTOSTART_TASK_READY ready=1')));
  assert.ok(lines.some((line) => line.startsWith('AUTOSTART_STARTED entry=SayIntentions pid=task')));

  // Die Aufgaben enthalten feste Befehle: Pfad, Argumente, Minimiert und Ordnerabgleich.
  const decode = (text) => Buffer.from(text, 'base64').toString('utf16le');
  const script = adminTaskSetupScript([spec], ['Autostart-gone-start']);
  assert.match(script, /Unregister-ScheduledTask .*'Autostart-gone-start'/);
  assert.match(script, /-RunLevel Highest/);
  const encoded = [...script.matchAll(/-EncodedCommand ([A-Za-z0-9+/=]+)/g)].map((match) => decode(match[1]));
  assert.match(encoded[0], /Start-Process -FilePath 'D:\\Apps\\SayIntentions\\SayIntentionsAI\.exe' -ArgumentList '--quiet' -WindowStyle Minimized/);
  assert.match(encoded[1], /StartsWith\('d:\\apps\\sayintentions\\'/);
});

test('declined elevation falls back to a direct RunAs start', async () => {
  const calls = [];
  const entry = { id: 'say', kind: 'program', name: 'Say', path: 'D:\\Apps\\Say\\Say.exe', admin: true };
  const instance = launcher({
    store: memoryStore({ enabled: true, entries: [entry] }), calls, files: [entry.path],
    handlers: { 'powershell.exe': (args) => { if (/-Verb RunAs -Wait/.test(args.at(-1))) throw new Error('declined'); return ''; } }
  });
  await instance.launchAll();
  assert.equal(calls.filter((call) => call.command === 'schtasks.exe').length, 0);
  assert.ok(calls.some((call) => /Start-Process -FilePath 'D:.*-Verb RunAs/.test(call.args.at(-1) || '')));
});

test('programs in the SimConnect stage start only after a stable SimConnect data link', async () => {
  const calls = [];
  const lines = [];
  let polls = 0;
  const states = [];
  const store = memoryStore({ enabled: true, entries: [
    { id: 'early', kind: 'program', name: 'Early', path: 'C:\\Tools\\Early\\early.exe' },
    { id: 's', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590', stage: 'simconnect' },
    { id: 'late', kind: 'program', name: 'Late', path: 'C:\\Tools\\Late\\late.exe', stage: 'simconnect' }
  ] });
  const instance = launcher({
    store, calls, files: ['C:\\Tools\\Early\\early.exe', 'C:\\Tools\\Late\\late.exe'], log: (line) => lines.push(line),
    handlers: { 'tasklist.exe': () => '"explorer.exe","1"' },
    getSimConnectState: () => {
      polls += 1;
      // verbunden ohne Daten, kurzer Abbruch, dann stabil live
      const state = polls < 3 ? { simulator: 'connected', telemetry: 'link' }
        : (polls === 5 ? { simulator: 'waiting', telemetry: 'link' } : { simulator: 'connected', telemetry: 'live' });
      states.push(state.telemetry);
      return state;
    }
  });
  assert.equal(instance.settings().entries.find((entry) => entry.id === 's').stage, 'start', 'sim never waits');
  const started = () => calls.filter((call) => /Start-Process -FilePath 'C:/.test(call.args.at(-1) || '')).map((call) => call.args.at(-1).match(/Tools\\(\w+)/)[1]);
  const result = await instance.launchAll();
  assert.equal(result.waiting, 1);
  await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < 50 && instance.run.phase !== 'done'; i += 1) await new Promise((resolve) => setImmediate(resolve));
  instance.stopSimulatorWatch();
  assert.deepEqual(started(), ['Early', 'Late']);
  assert.ok(polls >= 10, `stable polls required, got ${polls}`);
  assert.equal(instance.run.phase, 'done');
  assert.ok(lines.includes('AUTOSTART_SIMCONNECT_READY'));
  instance.updateEntries([{ id: 's', stage: 'simconnect' }]);
  assert.equal(instance.settings().entries.find((entry) => entry.id === 's').stage, 'start');
});

test('closing cancels programs still waiting for SimConnect', async () => {
  const calls = [];
  const instance = launcher({
    calls, files: ['C:\\Tools\\Late\\late.exe'],
    store: memoryStore({ enabled: true, entries: [{ id: 'late', kind: 'program', path: 'C:\\Tools\\Late\\late.exe', stage: 'simconnect' }] }),
    getSimConnectState: () => ({ simulator: 'waiting', telemetry: 'off' })
  });
  let release;
  instance.sleep = () => new Promise((resolve) => { release = resolve; });
  await instance.launchAll();
  assert.equal(instance.run.phase, 'waiting');
  assert.equal((await instance.launchAll()).ok, false);
  instance.cancelWaitingStage();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(instance.run.phase, 'done');
  assert.ok(!calls.some((call) => /late\.exe/.test(call.args.at(-1) || '')));
});

test('status shows the sim as running, then ended, and closed programs as closed', async () => {
  let simRunning = false;
  let polls = 0;
  const store = memoryStore({ enabled: true, closeOnExit: true, entries: [
    { id: 'p', kind: 'program', path: 'C:\\Tools\\Nav\\nav.exe' },
    { id: 's', kind: 'sim', simId: 'msfs2024', source: 'steam', launchTarget: 'steam://rungameid/2537590' }
  ] });
  const seen = [];
  const instance = launcher({
    store, files: ['C:\\Tools\\Nav\\nav.exe'],
    handlers: {
      'tasklist.exe': () => {
        polls += 1;
        simRunning = polls >= 2 && polls < 5;
        return ['"explorer.exe","1"', ...(simRunning ? ['"FlightSimulator2024.exe","2"'] : [])].join('\r\n');
      }
    }
  });
  instance.on('state', () => seen.push(instance.run.results.s));
  await instance.launchAll();
  for (let i = 0; i < 100 && instance.run.results.s !== 'ended'; i += 1) await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.ok(seen.includes('running'));
  assert.equal(instance.run.results.s, 'ended');
  assert.equal(instance.run.results.p, 'closed');
});
