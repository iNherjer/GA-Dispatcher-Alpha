/* Hidden renderer page of the desktop app: draws the VFR vector style with
   MapLibre (WebGL is available in Electron, not in the MSFS EFB) and cuts the
   picture into 256 px JPEG tiles for the tracker's EFB tile path.
   Driven by lib/vector-tile-renderer.js through executeJavaScript. */
(function () {
  'use strict';
  var TILE = 256;
  var map = null;
  var container = document.getElementById('map');
  var cutter = document.createElement('canvas');
  cutter.width = TILE;
  cutter.height = TILE;
  var cutterContext = cutter.getContext('2d');

  function waitIdle(timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { finish(false); }, timeoutMs);
      function finish(complete) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        map.off('idle', onIdle);
        resolve(complete);
      }
      function onIdle() { finish(true); }
      map.on('idle', onIdle);
      map.triggerRepaint();
    });
  }

  // Web Mercator pixel (Leaflet zoom z, 256 px tiles) to longitude/latitude.
  function pixelToLngLat(px, py, z) {
    var world = TILE * Math.pow(2, z);
    var lng = px / world * 360 - 180;
    var n = Math.PI * (1 - 2 * py / world);
    var lat = Math.atan(Math.sinh(n)) * 180 / Math.PI;
    return [lng, lat];
  }

  window.gaVectorInit = function (style) {
    if (map) return Promise.resolve(true);
    container.style.width = '512px';
    container.style.height = '512px';
    map = new maplibregl.Map({
      container: container,
      style: style,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: 1,
      renderWorldCopies: true,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      preserveDrawingBuffer: true,
      maxTileCacheSize: 600,
      center: [9, 48.7],
      zoom: 6
    });
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('vector_style_timeout')); }, 30000);
      map.once('load', function () { clearTimeout(timer); resolve(true); });
      map.on('error', function (event) {
        if (!map.loaded()) { clearTimeout(timer); reject(new Error(String(event && event.error && event.error.message || 'vector_style_error'))); }
      });
    });
  };

  // Draws the block of n×n tiles starting at tile (x0, y0) of Leaflet zoom z
  // with a margin on every side (so labels at the block edge are placed as on
  // a larger map) and returns the tiles as base64 JPEG, row by row.
  window.gaVectorRenderBlock = function (z, x0, y0, n, margin) {
    var size = n * TILE + 2 * margin;
    if (container.style.width !== size + 'px') {
      container.style.width = size + 'px';
      container.style.height = size + 'px';
      map.resize();
    }
    var centre = pixelToLngLat((x0 + n / 2) * TILE, (y0 + n / 2) * TILE, z);
    // MapLibre zoom Z draws the world 512·2^Z px wide: Leaflet zoom z = Z + 1.
    map.jumpTo({ center: centre, zoom: z - 1, bearing: 0, pitch: 0 });
    return waitIdle(20000).then(function (complete) {
      var canvas = map.getCanvas();
      var scale = canvas.width / size;
      var tiles = [];
      for (var row = 0; row < n; row += 1) {
        for (var col = 0; col < n; col += 1) {
          // Base map: opaque JPEG (a third of the PNG size in the tracker cache).
          cutterContext.fillStyle = '#ffffff';
          cutterContext.fillRect(0, 0, TILE, TILE);
          cutterContext.drawImage(canvas,
            (margin + col * TILE) * scale, (margin + row * TILE) * scale, TILE * scale, TILE * scale,
            0, 0, TILE, TILE);
          tiles.push(cutter.toDataURL('image/jpeg', 0.88).slice('data:image/jpeg;base64,'.length));
        }
      }
      return { complete: complete, tiles: tiles };
    });
  };
})();
