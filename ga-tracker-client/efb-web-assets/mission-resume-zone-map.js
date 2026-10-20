// Generated from mission-resume-zone-map.js by sync-efb-web-assets.js. Do not edit.
// Shared display only: the resume zone of a simulator interruption (App + EFB).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;else root.MissionResumeZoneMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var layers = new WeakMap();
  function zone(raw) {
    if (!raw) return null;
    var lat = Number(raw.lat),
      lon = Number(raw.lon),
      radiusNm = Number(raw.radiusNm);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !Number.isFinite(radiusNm) || radiusNm <= 0 || radiusNm > 25) return null;
    var kind = raw.kind === 'departure' || raw.kind === 'destination' ? raw.kind : '';
    return {
      lat,
      lon,
      radiusNm,
      airborne: raw.airborne === true,
      kind,
      label: String(raw.label || '').slice(0, 60)
    };
  }
  // Drawn from the decision on until the zone is reached (the tracker clears it).
  function fromControl(control) {
    var record = control && control.executionAuthority === 'tracker' && control.phase !== 'closed' ? control.interruption : null;
    return record && ['awaiting_decision', 'resuming', 'awaiting_zone'].includes(record.status) ? zone(record.zone) : null;
  }
  function label(spec) {
    return spec.airborne ? 'Wiederaufnahme-Zone · ' + spec.radiusNm.toFixed(1).replace('.', ',') + ' NM · hierher fliegen oder slewen' : (spec.kind === 'departure' ? 'Startplatz' : spec.kind === 'destination' ? 'Zielplatz' : 'Unterbrechungsort') + (spec.label ? ' ' + spec.label : '') + ' · ' + spec.radiusNm.toFixed(1).replace('.', ',') + ' NM · Flugzeug hier abstellen';
  }
  function render(map, L, raw) {
    if (!map || !L) return false;
    var spec = zone(raw),
      signature = JSON.stringify(spec),
      previous = layers.get(map);
    if ((previous === null || previous === void 0 ? void 0 : previous.signature) === signature) return Boolean(spec);
    if (previous) map.removeLayer(previous.layer);
    layers.delete(map);
    if (!spec) return false;
    var layer = L.layerGroup(),
      center = [spec.lat, spec.lon],
      text = label(spec);
    L.circle(center, {
      radius: spec.radiusNm * 1852,
      color: '#f59e0b',
      weight: 3,
      opacity: 0.95,
      dashArray: '10,8',
      fillColor: '#f59e0b',
      fillOpacity: 0.06,
      interactive: true
    }).bindTooltip(text, {
      permanent: false
    }).addTo(layer);
    L.circleMarker(center, {
      radius: 5,
      color: '#b45309',
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 1,
      interactive: true
    }).bindTooltip('Unterbrechungspunkt', {
      permanent: false
    }).addTo(layer);
    layer.addTo(map);
    layers.set(map, {
      signature,
      layer
    });
    return true;
  }
  function active(map) {
    return layers.has(map);
  }
  return {
    zone,
    fromControl,
    label,
    render,
    active
  };
});
