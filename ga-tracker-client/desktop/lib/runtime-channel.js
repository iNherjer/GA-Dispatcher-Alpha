const path = require('node:path');

const DEFAULT_RUNTIME_CHANNEL = 'stable';
const RUNTIME_CHANNELS = Object.freeze({
  stable: Object.freeze({
    id: 'stable',
    label: 'Stable',
    channelUrl: 'https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/ga-tracker-client/channel/stable.json',
    runtimeDirectoryName: 'Tracker'
  }),
  alpha: Object.freeze({
    id: 'alpha',
    label: 'Alpha',
    channelUrl: 'https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/ga-tracker-client/channel/alpha.json',
    runtimeDirectoryName: 'Tracker Alpha'
  })
});

function normalizeRuntimeChannel(value) {
  const channel = String(value || '').trim().toLowerCase();
  return Object.hasOwn(RUNTIME_CHANNELS, channel) ? channel : DEFAULT_RUNTIME_CHANNEL;
}

function runtimeChannelDefinition(value) {
  return RUNTIME_CHANNELS[normalizeRuntimeChannel(value)];
}

function runtimeRootForChannel(applicationRoot, value) {
  if (!applicationRoot) throw new Error('applicationRoot fehlt.');
  return path.join(path.resolve(applicationRoot), runtimeChannelDefinition(value).runtimeDirectoryName);
}

module.exports = {
  DEFAULT_RUNTIME_CHANNEL,
  RUNTIME_CHANNELS,
  normalizeRuntimeChannel,
  runtimeChannelDefinition,
  runtimeRootForChannel
};
