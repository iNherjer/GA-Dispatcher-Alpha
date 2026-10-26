'use strict';

function validScale(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 3;
}

const UI_BOOLEAN_KEYS = ['telemetry', 'currentInfo', 'nextLeg', 'routeProgress', 'compass', 'lowFps', 'autoZoom', 'zoomControl', 'terrainAvoid', 'magentaLine', 'favoriteAirports', 'profileVisible', 'toolbarCollapsed', 'mediaEnabled'];
// Media player zoom per view instance (surface + 2D/VR) and skin; never shared between views.
const MEDIA_INSTANCE = /^(physical|popout|toolbar|unknown)-(2d|vr)$/;
function normalizeMediaScales(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const [instance, skins] of Object.entries(value)) {
    if (!MEDIA_INSTANCE.test(instance) || !skins || typeof skins !== 'object' || Array.isArray(skins)) return null;
    const entry = {};
    for (const [skin, scale] of Object.entries(skins)) {
      if (!['winamp', 'ipod', 'watch'].includes(skin) || typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.5 || scale > 1.6) return null;
      entry[skin] = Math.round(scale * 100) / 100;
    }
    if (Object.keys(entry).length) result[instance] = entry;
  }
  return Object.keys(result).length ? result : null;
}
function normalizeUi(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const key of UI_BOOLEAN_KEYS) if (typeof value[key] === 'boolean') result[key] = value[key];
  for (const [key,min,max] of [['profileAltitudeFt',1500,13500],['profileRateFpm',200,1500]]) if (Number.isInteger(value[key]) && value[key] >= min && value[key] <= max) result[key] = value[key];
  if (['AUTO', 'ROUTE', 'HDG'].includes(value.profileMode)) result.profileMode = value.profileMode;
  if (['device', 'simulator'].includes(value.clockSource)) result.clockSource = value.clockSource;
  if (['utc', 'local'].includes(value.clockZone)) result.clockZone = value.clockZone;
  if (['stopwatch', 'watch'].includes(value.clockSkin)) result.clockSkin = value.clockSkin;
  if (['winamp', 'ipod', 'watch'].includes(value.mediaSkin)) result.mediaSkin = value.mediaSkin;
  const mediaScales = normalizeMediaScales(value.mediaScales);
  if (mediaScales) result.mediaScales = mediaScales;
  return result;
}
function normalizeDisplaySettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const scale = key => validScale(source[key]) ? Math.round(source[key] * 10) / 10 : 1;
  const display = { fontScale2d: scale('fontScale2d'), fontScaleVr: scale('fontScaleVr'), uiScaleVersion: source.uiScaleVersion === 1 ? 1 : 0 };
  const ui = normalizeUi(source.ui);
  if (Object.keys(ui).length) { display.ui = ui; display.uiRevision = Number.isSafeInteger(source.uiRevision) && source.uiRevision >= 0 ? source.uiRevision : 0; }
  return display;
}

// Update only our config key; credentials and unrelated settings stay private.
function createDisplaySettingsControl({ readConfig, writeConfig }) {
  let publicDisplay = null;
  function snapshot() {
    const config = readConfig();
    return publicDisplay = { ...normalizeDisplaySettings(config.efbDisplay), configured: !!config.efbDisplay };
  }
  function update(command) {
    const config = readConfig();
    let display = normalizeDisplaySettings(config.efbDisplay);
    const uiOnly = !!(command && (command.ui || command.initializeUi));
    if (command && (command.ui || command.initializeUi)) {
      const patch = command.ui || command.initializeUi;
      const valid = normalizeUi(patch);
      if (!Object.keys(valid).length || Object.keys(valid).length !== Object.keys(patch).length) return { ok: false, error: 'invalid_display_settings' };
      const merged = command.initializeUi ? { ...valid, ...display.ui } : { ...display.ui, ...valid };
      // A patch for one view instance keeps every other instance's zoom.
      if (valid.mediaScales && display.ui && display.ui.mediaScales) {
        const scales = { ...display.ui.mediaScales };
        for (const [instance, skins] of Object.entries(valid.mediaScales)) scales[instance] = command.initializeUi ? { ...skins, ...scales[instance] } : { ...scales[instance], ...skins };
        merged.mediaScales = scales;
      }
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (display.ui && Object.keys(merged).length === Object.keys(display.ui).length && Object.keys(merged).every(key => same(merged[key], display.ui[key]))) return { ok: true, display: snapshot() };
      display.ui = merged; display.uiRevision = (display.uiRevision || 0) + 1;
    } else if (command && command.initialize) {
      if (config.efbDisplay && config.efbDisplay.uiScaleVersion === 1) return { ok: true, display: snapshot() };
      const seed = command.initialize;
      if (!validScale(seed.fontScale2d) || !validScale(seed.fontScaleVr)) return { ok: false, error: 'invalid_display_settings' };
      display = normalizeDisplaySettings({ ...seed, ...config.efbDisplay });
    } else {
      if (!command || !['2d', 'vr'].includes(command.mode) || !validScale(command.fontScale)) return { ok: false, error: 'invalid_display_settings' };
      display[command.mode === 'vr' ? 'fontScaleVr' : 'fontScale2d'] = Math.round(command.fontScale * 10) / 10;
    }
    if (!uiOnly) display.uiScaleVersion = 1;
    const stored = uiOnly ? { ...config.efbDisplay, ui: display.ui, uiRevision: display.uiRevision } : display;
    if (!writeConfig({ ...config, efbDisplay: stored })) return { ok: false, error: 'display_settings_write_failed' };
    return { ok: true, display: snapshot() };
  }
  return { snapshot, update, publicState: () => publicDisplay || snapshot() };
}

module.exports = { normalizeDisplaySettings, createDisplaySettingsControl };
