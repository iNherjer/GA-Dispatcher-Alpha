#!/usr/bin/env node
// Builds data/map-styles/vfr-vector.json: an OSM vector style for VFR flying
// (easyVFR-like) on the free OpenFreeMap tiles, derived from OpenFreeMap
// "liberty". Settlements yellow, forests green, major roads red/orange,
// railways visible from mid zoom, terrain shading from the free AWS Terrain
// Tiles, no POI icons, local place names. Kept slightly paler than easyVFR so
// airspaces and overlays stay readable on top.
//
// Usage: node tools/build-vfr-vector-style.mjs [path/to/liberty.json]
// Without an argument the current liberty style is downloaded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'data', 'map-styles', 'vfr-vector.json');

const source = process.argv[2]
  ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  : await (await fetch('https://tiles.openfreemap.org/styles/liberty')).json();
const style = structuredClone(source);

const COLORS = {
  background: '#f3f0e6',
  settlement: '#f2cf4a',
  settlementIndustry: '#e9c76f',
  wood: '#8fc67a',
  grass: '#bddca4',
  water: '#9cc3ee',
  river: '#5d9ee0',
  motorway: '#d9472b',
  motorwayCasing: '#9e2f19',
  trunk: '#ee7a3c',
  trunkCasing: '#b4562a',
  secondary: '#f6c26a',
  secondaryCasing: '#c9944a',
  rail: '#555555',
  label: '#1c1c1c'
};

const removed = new Set([
  'building-3d', 'road_one_way_arrow', 'road_one_way_arrow_opposite',
  'poi_r20', 'poi_r7', 'poi_r1', 'poi_transit', 'highway-name-path', 'highway-name-minor',
  'road_area_pattern'
]);
const byId = (id) => style.layers.find((layer) => layer.id === id);
const paint = (id, values) => { const layer = byId(id); if (layer) layer.paint = { ...(layer.paint || {}), ...values }; };
const width = (stops) => ['interpolate', ['exponential', 1.2], ['zoom'], ...stops];
const localName = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

style.name = 'VFR Multitool VFR (OpenFreeMap)';
style.layers = style.layers.filter((layer) => !removed.has(layer.id));

paint('background', { 'background-color': COLORS.background });
paint('natural_earth', { 'raster-opacity': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.5, 7, 0.05] });

// Settlements: yellow at every zoom (liberty fades them out above zoom 12).
const residential = byId('landuse_residential');
delete residential.maxzoom;
residential.paint = { 'fill-color': COLORS.settlement, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 12, 0.6, 15, 0.35] };
const urban = structuredClone(residential);
urban.id = 'landuse_urban';
urban.filter = ['match', ['get', 'class'], ['commercial', 'industrial', 'retail', 'railway', 'quarry'], true, false];
urban.paint = { 'fill-color': COLORS.settlementIndustry, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 15, 0.3] };
style.layers.splice(style.layers.indexOf(residential) + 1, 0, urban);

paint('landcover_wood', { 'fill-color': COLORS.wood, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.65, 13, 0.55] });
paint('landcover_grass', { 'fill-color': COLORS.grass, 'fill-opacity': 0.35 });
paint('park', { 'fill-color': '#cfe5bd', 'fill-opacity': 0.5 });
paint('water', { 'fill-color': COLORS.water });
for (const id of ['waterway_river', 'waterway_other']) paint(id, { 'line-color': COLORS.river });
paint('waterway_river', { 'line-width': width([8, 0.6, 11, 1.4, 20, 7]) });

// Terrain shading (AWS Terrain Tiles, Terrarium encoding, free, no key) above
// the land cover and below water, roads and labels.
style.sources.terrain = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 13,
  attribution: 'Höhendaten: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">AWS Terrain Tiles</a>'
};
const waterIndex = style.layers.findIndex((layer) => layer.id === 'waterway_tunnel');
style.layers.splice(waterIndex, 0, {
  id: 'vfr_hillshade',
  type: 'hillshade',
  source: 'terrain',
  paint: {
    'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 10, 0.35, 14, 0.2],
    'hillshade-shadow-color': '#5b5140',
    'hillshade-highlight-color': '#ffffff',
    'hillshade-accent-color': '#5b5140',
    'hillshade-illumination-direction': 315
  }
});

// Roads: strong at the zooms used for VFR navigation (7-12).
for (const prefix of ['road', 'bridge', 'tunnel']) {
  paint(`${prefix}_motorway`, { 'line-color': COLORS.motorway, 'line-width': width([5, 0.6, 7, 1.6, 10, 3, 20, 18]) });
  paint(`${prefix}_motorway_casing`, { 'line-color': COLORS.motorwayCasing, 'line-width': width([5, 0.8, 7, 2.4, 10, 4.2, 20, 22]) });
  paint(`${prefix}_motorway_link`, { 'line-color': COLORS.motorway });
  paint(`${prefix}_trunk_primary`, { 'line-color': COLORS.trunk, 'line-width': width([6, 0.4, 8, 1.2, 10, 2.2, 20, 18]) });
  paint(`${prefix}_trunk_primary_casing`, { 'line-color': COLORS.trunkCasing, 'line-width': width([6, 0.6, 8, 1.8, 10, 3, 20, 22]) });
  paint(`${prefix}_secondary_tertiary`, { 'line-color': COLORS.secondary, 'line-width': width([8, 0.4, 10, 1.2, 20, 13]) });
  paint(`${prefix}_secondary_tertiary_casing`, { 'line-color': COLORS.secondaryCasing });
  paint(`${prefix}_link`, { 'line-color': COLORS.secondary });
  paint(`${prefix}_major_rail`, { 'line-color': COLORS.rail, 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.6, 12, 1.2, 20, 3] });
  paint(`${prefix}_major_rail_hatching`, { 'line-color': COLORS.rail });
}

paint('aeroway_fill', { 'fill-color': '#d9d6cf', 'fill-opacity': 0.9 });
paint('aeroway_runway', { 'line-color': '#8c8a85' });
paint('aeroway_taxiway', { 'line-color': '#a8a6a0' });
paint('boundary_2', { 'line-color': '#7b4f9e' });

// Labels: local names, larger, dark with a white halo.
for (const id of ['label_village', 'label_town', 'label_city', 'label_city_capital', 'label_other']) {
  const layer = byId(id);
  if (!layer) continue;
  layer.layout = { ...layer.layout, 'text-field': localName };
  layer.paint = { ...layer.paint, 'text-color': COLORS.label, 'text-halo-color': '#ffffff', 'text-halo-width': 1.6, 'text-halo-blur': 0.5 };
}
const bump = (id, stops) => { const layer = byId(id); if (layer) layer.layout = { ...layer.layout, 'text-size': ['interpolate', ['linear'], ['zoom'], ...stops] }; };
bump('label_village', [9, 11, 12, 14, 15, 16]);
bump('label_town', [6, 11, 9, 14, 12, 17]);
bump('label_city', [4, 12, 8, 16, 12, 20]);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(style) + '\n');
console.log(`VFR_VECTOR_STYLE_WRITTEN ${path.relative(root, output)} layers=${style.layers.length}`);
