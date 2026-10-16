# EFB Canvas basemap build

OpenLayers 6.15.1 and ol-mapbox-style 8.2.1 render the original OpenFreeMap
Positron, Dark and Fiord styles in Canvas 2D. Versions deliberately retain
the older browser API surface needed by MSFS Coherent. No WebGL is required.

From the repository root (tracker build dependencies must also be installed):

```sh
npm ci --prefix tools/efb-vector-build
node tools/build-efb-vector-basemaps.cjs
```

Commit the generated renderer and license inventory in
`ga-tracker-client/efb-web-assets/vendor/`. The isolated dependencies are build
inputs only; they are not tracker runtime dependencies. The build transpiles
syntax for Chrome 49 using the tracker Babel toolchain. `GA_EFB_VECTOR_BUILD_ROOT`
can select an alternate installed build workspace.

Browser validation against live provider tiles:

```sh
GA_CHROME_EXECUTABLE=/path/to/chrome GA_PLAYWRIGHT_MODULE=/path/to/playwright node tools/efb-vector-basemaps-selftest.mjs
```

The test disables WebGL and modern network/worker APIs, covers all three styles,
rapid switching, interaction, resizing and disposal. It supplements, but cannot
replace, acceptance in the actual MSFS EFB and toolbar.
