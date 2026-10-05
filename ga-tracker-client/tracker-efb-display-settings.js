'use strict';

function validScale(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.9 && value <= 3;
}

function normalizeDisplaySettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const scale = key => validScale(source[key]) ? Math.round(source[key] * 10) / 10 : 1;
  return { fontScale2d: scale('fontScale2d'), fontScaleVr: scale('fontScaleVr') };
}

// Update only our config key; credentials and unrelated settings stay private.
function createDisplaySettingsControl({ readConfig, writeConfig }) {
  function snapshot() {
    const config = readConfig();
    return { ...normalizeDisplaySettings(config.efbDisplay), configured: !!config.efbDisplay };
  }
  function update(command) {
    const config = readConfig();
    let display = normalizeDisplaySettings(config.efbDisplay);
    if (command && command.initialize) {
      if (config.efbDisplay) return { ok: true, display: snapshot() };
      const seed = command.initialize;
      if (!validScale(seed.fontScale2d) || !validScale(seed.fontScaleVr)) return { ok: false, error: 'invalid_display_settings' };
      display = normalizeDisplaySettings(seed);
    } else {
      if (!command || !['2d', 'vr'].includes(command.mode) || !validScale(command.fontScale)) return { ok: false, error: 'invalid_display_settings' };
      display[command.mode === 'vr' ? 'fontScaleVr' : 'fontScale2d'] = Math.round(command.fontScale * 10) / 10;
    }
    if (!writeConfig({ ...config, efbDisplay: display })) return { ok: false, error: 'display_settings_write_failed' };
    return { ok: true, display: { ...display, configured: true } };
  }
  return { snapshot, update };
}

module.exports = { normalizeDisplaySettings, createDisplaySettingsControl };
