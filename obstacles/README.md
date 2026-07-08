# Obstacle Hosted Tiles (V1)

This directory holds optional prebuilt obstacle tiles that can be served by a proxy/worker.

## Tile ID

- Tile key format in app: `latIndex|lonIndex`
- Grid size currently matches app config (`~25 NM` edge)

## Suggested API contract

Worker endpoint:

- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>`

Response (JSON), legacy/core layer:

```json
{
  "tile": "333|452",
  "obs": [
    { "type": "wind", "hFt": 360, "elevFt": 0, "lat": 48.12345, "lon": 8.98765 }
  ],
  "lin": [
    { "type": "highway", "name": "A5", "lat": 48.12, "lon": 8.98 }
  ],
  "updatedAt": "2026-04-16T00:00:00Z",
  "version": 1
}
```

The app also accepts:

- `{ "features": { "obs": [...], "lin": [...] } }`
- `{ "elements": [...] }` (raw Overpass-like payload)

Split layers use the same tile key:

- `obstacles/core-tiles/<latI>/<lonI>.json.gz` for obstacle/navigation context
- `obstacles/poi-tiles/<latI>/<lonI>.json.gz` for POI target/story selection
- `obstacles/infra-tiles/<latI>/<lonI>.json.gz` for optional infrastructure context

Worker layer selection:

- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>&layer=core`
- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>&layer=poi`
- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>&layer=infra`

## Local generation

Generate tiles locally from Overpass:

```bash
node tools/generate-obstacle-tiles.mjs --bbox 47.2,7.0,49.5,9.5
```

Output:

- `obstacles/tiles/<latI>/<lonI>.json`
- `obstacles/manifest.v1.json` (updated)
- `obstacles/failed-tiles.json`

## Notes

- App path is hybrid:
  1. try hosted tile source
  2. fallback to Overpass
- Missing hosted tiles are memoized locally for 30 minutes to avoid repeated misses.

## Tile Workbench UI (local)

Interactive tile curation UI with map + tile grid:

```bash
node tools/obstacle-tile-workbench-server.mjs
```

Then open:

- `http://127.0.0.1:8788`

Behavior:

- Click tiles to select multiple.
- `Auswahl laden`: queue selected tiles and process serially.
- `Failed erneut laden`: retry all failed tiles.
- `Neue Ergebnisse pushen`: `git add` + `git commit` + `git push` for:
  - `obstacles/core-tiles`
  - `obstacles/poi-tiles`
  - `obstacles/infra-tiles`
  - `obstacles/core-manifest.v1.json`
  - `obstacles/poi-manifest.v1.json`
  - `obstacles/infra-manifest.v1.json`
  - `obstacles/failed-split-tiles.json`

Tile commits are pushed to `origin/tile-workbench` by default, not directly to
`origin/main`. The workbench must run on the configured tile branch:

```bash
git fetch origin
git switch tile-workbench || git switch -c tile-workbench origin/main
```

Before an app release, merge the tile branch into `main` from a clean release
state:

```bash
git fetch origin main tile-workbench
git merge --no-ff origin/tile-workbench -m "Merge tile workbench updates"
```

Status colors in grid:

- Magenta: loaded + fresh
- Orange: loaded, older than 3 months
- Red: failed
- Yellow: queued
- Green: currently processing
- Blue: selected
