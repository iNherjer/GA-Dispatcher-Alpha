# MapLibre browser dependencies

- `maplibre-gl.js`, `maplibre-gl.css`, `LICENSE.txt`: maplibre-gl **5.24.0**, from the official npm package (BSD-3-Clause and bundled dependency licenses).
- `leaflet-maplibre-gl.js`, `LEAFLET-LICENSE`: @maplibre/maplibre-gl-leaflet **0.1.4**, from the official npm package (ISC).

Package archives were checked against npm's SHA-512 integrity metadata.
The version 5 browser bundle fits the existing classic-script application;
MapLibre 6 uses a different module/worker setup.

Scripts load only when selecting an OpenFreeMap layer. MapLibre CSS is loaded
with the application. The Service Worker precaches all these runtime assets.
Styles, vector tiles, sprites and fonts come directly from OpenFreeMap.
