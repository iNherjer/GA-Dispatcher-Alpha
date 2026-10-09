const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const renderer = fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8');
const handler = renderer.slice(renderer.indexOf("elements.aptMissionExecutionCheckbox.addEventListener('change'"), renderer.indexOf("elements.hardMissionResetButton.addEventListener('click'"));

for (const scenario of [
  { name: 'cancel debug disabling', checked: true, previousEnabled: true, confirm: false, expectedCalls: [] },
  { name: 'confirm debug disabling', checked: true, previousEnabled: true, confirm: true, expectedCalls: [false] },
  { name: 'restore normal execution without debug warning', checked: false, previousEnabled: false, confirm: false, expectedCalls: [true] }
]) test(scenario.name, async () => {
  let change;
  const calls = [], warnings = [];
  const checkbox = { checked: scenario.checked, addEventListener: (_, fn) => { change = fn; } };
  const context = vm.createContext({
    elements: { aptMissionExecutionCheckbox: checkbox, aptMissionExecutionMessage: {} },
    latestState: { settings: { aptMissionExecutionEnabled: scenario.previousEnabled } },
    aptMissionExecutionChangePending: false,
    render: () => {},
    window: {
      confirm: message => { warnings.push(message); return scenario.confirm; },
      trackerDesktop: {
        setAptMissionExecutionEnabled: async enabled => { calls.push(enabled); return { ok: true }; },
        getState: async () => ({})
      }
    }
  });
  vm.runInContext(handler, context);
  await change();
  assert.deepEqual(calls, scenario.expectedCalls);
  assert.equal(warnings.length, scenario.checked ? 1 : 0);
  if (warnings.length) assert.match(warnings[0], /ausschließlich zur Fehlersuche/);
  if (!scenario.confirm && scenario.checked) assert.equal(checkbox.checked, false);
});
