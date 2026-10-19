'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AutostartLauncher,
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
      callback(error, '', '');
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
  const starts = calls.filter((call) => call.command === 'powershell.exe' && /Start-Process/.test(call.args.at(-1)));
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
