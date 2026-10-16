import Map from 'ol/Map.js';
import View from 'ol/View.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import MVT from 'ol/format/MVT.js';
import { fromLonLat } from 'ol/proj.js';
import { stylefunction } from 'ol-mapbox-style';

const metadata = Object.create(null);
const origin = 'https://tiles.openfreemap.org/';
function providerUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(origin)) throw Error('unsupported_map_source');
  return url;
}
function json(url) {
  providerUrl(url);
  if (!metadata[url]) metadata[url] = new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 12000;
    xhr.onload = () => {
      try {
        if (xhr.status !== 200) throw Error('map_http_' + xhr.status);
        resolve(JSON.parse(xhr.responseText));
      } catch (error) { reject(error); }
    };
    xhr.onerror = xhr.ontimeout = () => reject(Error('map_source_unavailable'));
    xhr.send();
  }).catch(error => { delete metadata[url]; throw error; });
  return metadata[url];
}

// Fetch only metadata here. Vector tiles use OpenLayers' existing XHR loader,
// never workers, fetch, WebGL, an external rasterizer or the mission process.
export async function create(target, options) {
  if (!['positron', 'dark', 'fiord'].includes(options.style)) throw Error('unknown_map_style');
  const style = await json(origin + 'styles/' + options.style);
  const vectorLayers = style.layers.filter(layer => layer.type !== 'background');
  const sourceNames = [...new Set(vectorLayers.map(layer => layer.source))];
  if (sourceNames.length !== 1 || style.sources[sourceNames[0]]?.type !== 'vector') throw Error('unsupported_map_style');
  const sourceName = sourceNames[0];
  const sourceInfo = style.sources[sourceName];
  const [tileJson, spriteData] = await Promise.all([
    sourceInfo.url ? json(sourceInfo.url) : Promise.resolve(sourceInfo),
    style.sprite ? json(providerUrl(style.sprite) + '.json') : Promise.resolve(undefined)
  ]);
  if (options.cancelled()) return null;
  const resolutions = [];
  const maxZoom = Math.min(18, Number(tileJson.maxzoom) || 14);
  for (let zoom = 0; zoom <= maxZoom; zoom++) resolutions.push(78271.51696402048 / Math.pow(2, zoom));
  const source = new VectorTileSource({
    format: new MVT(),
    urls: tileJson.tiles.map(providerUrl),
    tileGrid: new TileGrid({ origin: [-20037508.342789244, 20037508.342789244],
      resolutions, tileSize: 512, minZoom: Math.max(0, Number(tileJson.minzoom) || 0) }),
    cacheSize: 64,
    transition: 0
  });
  const layer = new VectorTileLayer({ source, declutter: true, renderMode: 'hybrid', renderBuffer: 64 });
  // Coherent canvas needs a single font family. This Noto face is already
  // packaged by the EFB; it avoids remote font CSS and unsupported SDF glyphs.
  stylefunction(layer, style, sourceName, undefined, spriteData,
    style.sprite ? providerUrl(style.sprite) + '.png' : undefined, () => ['GA EFB Text']);
  const view = new View({ center: fromLonLat(options.center), zoom: options.zoom,
    constrainResolution: false, enableRotation: false, maxZoom: 20 });
  const map = new Map({ target, view, layers: [layer], controls: [], interactions: [],
    pixelRatio: 1, moveTolerance: 0, maxTilesLoading: 4 });
  const background = style.layers.find(item => item.type === 'background');
  target.style.backgroundColor = background?.paint?.['background-color'] || '#eeeeee';
  let tileCount = 0, disposed = false;
  source.on('tileloadend', () => { tileCount++; });
  source.on('tileloaderror', () => { if (!tileCount && !disposed) options.onError(Error('map_tile_unavailable')); });
  map.on('rendercomplete', () => { if (!disposed && tileCount) options.onReady(); });
  return {
    update(center, zoom, size) {
      if (disposed) return;
      map.setSize(size);
      view.setCenter(fromLonLat(center));
      view.setZoom(zoom);
      map.renderSync();
    },
    destroy() {
      disposed = true;
      map.setTarget(null);
      map.dispose();
      layer.setSource(null);
      source.clear();
      source.dispose();
    },
    status() { return { tiles: tileCount, disposed }; }
  };
}
