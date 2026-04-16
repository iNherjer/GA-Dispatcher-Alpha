# Obstacle Hosted Tiles (V1)

This directory holds optional prebuilt obstacle tiles that can be served by a proxy/worker.

## Tile ID

- Tile key format in app: `latIndex|lonIndex`
- Grid size currently matches app config (`~25 NM` edge)

## Suggested API contract

Worker endpoint:

- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>`

Response (JSON):

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
