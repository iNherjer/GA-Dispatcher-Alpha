# Chunk-Strategie: Terrain + Obstacle (Towers/Wind)

Stand: 2026-04-22

## 1) Ist-Zustand

- Terrain/Höhenprofil:
  - Quelle: Terrarium-RGB-Tiles (AWS), geladen in `taws.js` über `_tawsLoadTile(...)`.
  - Sampling: `profile.js` über `vpFetchElevationFromTerrarium(...)`.
  - Keyspace: klassische Web-Mercator-Tiles (`z/x/y`, aktuell z=10 für TAWS).

- Hindernisse (Windräder/Masten + linear Features):
  - Quelle: Hosted-Obstacle-Tiles + Overpass-Fallback in `profile.js`.
  - Keyspace: 25 NM Raster per `latI|lonI` (`VP_OBS_TILE_STEP_LAT/LON`).
  - Pipeline: `vpCollectRouteTileKeys(...)` -> `vpFetchHostedObstacleTile(...)` -> `vpFetchOverpassTile(...)`.

Wichtig: Wir haben aktuell zwei Keyspaces, die unterschiedliche Probleme lösen.

## 2) Frage

"Können Türme und Windräder direkt in die Chunks, die das Höhenprofil zieht?"

Kurz: Ja, aber nicht als echtes "Mergen" in die Terrarium-PNGs. Sinnvoll ist ein Sidecar-Modell mit gleichem Tile-Key (`z/x/y`).

## 3) Empfohlene Zielarchitektur

## Variante A (Empfehlung): Sidecar-Chunks am Terrain-Keyspace

- Terrain bleibt unverändert aus Terrarium (robust, schnell, kein eigener Raster-Import nötig).
- Zusätzlich pro Terrain-Tile ein JSON-Sidecar:
  - Pfad: `obstacles/terrain-sidecar/<z>/<x>/<y>.json`
  - Inhalt: `obs` (wind/mast/tower) und optional `lin` (river/highway)
- Runtime lädt beim Terrain-Sampling optional den Sidecar mit.

Vorteile:
- Kein Bruch im bestehenden TAWS/Höhenprofil.
- Gemeinsame räumliche Indizierung für Terrain + Obstacle ohne Overpass im Livebetrieb.
- Schrittweise Migration möglich.

Nachteile:
- Build-Pipeline muss ein zusätzliches Mapping `lat/lon -> z/x/y` erzeugen.

## Variante B: Vollständig neues Unified-25NM-Chunksystem

- Ein gemeinsamer JSON-Chunk je `latI|lonI` enthält:
  - reduzierte Terrain-Stützpunkte/Min-Max-Raster
  - Hindernisse
  - lineare Features
- Runtime könnte Höhenprofil aus Chunkdaten statt Terrarium beziehen.

Vorteile:
- Ein System, ein Fetch-Modell.

Nachteile:
- Hoher Umbauaufwand.
- Qualität/Details des Terrains sinken ohne sehr große Datenmengen.
- Risiko für Regressionen im Profil.

Empfehlung: Variante A.

## 4) Datenmodell (Variante A)

Datei: `obstacles/terrain-sidecar/<z>/<x>/<y>.json`

```json
{
  "v": 1,
  "z": 10,
  "x": 543,
  "y": 362,
  "generatedAt": "2026-04-22T19:00:00Z",
  "src": "osm-derived",
  "obs": [
    { "type": "wind", "lat": 48.53, "lon": 8.33, "hFt": 410, "elevFt": 0 },
    { "type": "mast", "lat": 48.54, "lon": 8.31, "hFt": 220, "elevFt": 0 }
  ],
  "lin": [
    { "type": "river", "name": "Nagold", "lat": 48.52, "lon": 8.35 },
    { "type": "highway", "name": "A81", "lat": 48.49, "lon": 8.41 }
  ]
}
```

Optional später:
- `bbox`, `count`, `hash`, `density`.

## 5) Build-Pipeline

## 5.1 Quelle

Primär ohne Live-Overpass:
- OSM-PBF regional (z. B. Geofabrik), offline verarbeitet.
- Alternativ vorhandene `obstacles/tiles/<latI>/<lonI>.json` als Übergangsquelle, in `z/x/y` umkacheln.

## 5.2 Schritte

1. Input-Features lesen (`wind`, `mast/tower`, optional `river/highway`).
2. Für jedes Feature `lat/lon -> z/x/y` (z=10).
3. In Sidecar pro Tile gruppieren.
4. JSON schreiben + Manifest erzeugen.

Manifest:
- `obstacles/terrain-sidecar/manifest.v1.json`
- enthält Tileliste + version + generatedAt.

## 5.3 Werkzeuge

- Neues Tool:
  - `tools/generate-terrain-sidecar-tiles.mjs`
- Optional Konverter aus bestehendem 25-NM-Bestand:
  - `tools/convert-obstacles-latlon-to-zxy.mjs`

## 6) Runtime-Integration

## 6.1 Loader

Neue Funktion in `profile.js` (oder `taws.js`):
- `vpFetchHostedTerrainSidecarTile(z, x, y, signal)`

Caching:
- analog zu `vpObsHostedMissCache` + localStorage/Mem.
- eigener Coverage-Key z. B. `ga_obs_sidecar_cov_v1`.

## 6.2 Verwendung

- Bei `vpFetchElevationFromTerrarium(...)`:
  - Terrain wie bisher laden.
  - Optional parallel Sidecar-Tiles für dieselben `z/x/y` laden.
  - Sidecar-Features in `vpObsPool` übernehmen (`vpRememberObstacleData`).

Damit bleibt die bestehende Projektion auf Route (`vpProjectObsPoolToRoute`) erhalten.

## 6.3 Fallback-Policy

1. Sidecar vorhanden -> nutzen.
2. Sidecar fehlt -> bestehender hosted-25NM / Overpass-Fallback.
3. Langfristig Overpass nur noch Debug/Recovery.

## 7) Rollout-Plan

Phase 1 (sicher):
- Sidecar-Tool + Manifest + Runtime-Leser (noch ohne harte Umschaltung).
- Feature-Flag `ga_obs_sidecar_enabled`.

Phase 2:
- Sidecar priorisieren, bestehendes 25-NM-System als Fallback.
- Telemetrie: Hit/Miss/Latency im Weather/Obs-Debug.

Phase 3:
- Für Regionen mit guter Sidecar-Abdeckung Overpass standardmäßig aus.

## 8) Warum das besser ist als "direkt in Höhenprofil-Chunks schreiben"

- Das Höhenprofil basiert auf Raster-Terrain aus Terrarium; dieses System ist stabil und unabhängig.
- Hindernisse sind Vektorobjekte, die sich natürlich als Sidecar-JSON eignen.
- Ein Sidecar am selben Tile-Key verbindet beides logisch, ohne das Terrain-System umzubauen.

## 9) Nächste konkrete Umsetzungsschritte

1. `tools/generate-terrain-sidecar-tiles.mjs` anlegen.
2. Erst-Import aus bestehenden `obstacles/tiles` (Konverter) für schnellen Start.
3. Runtime: `vpFetchHostedTerrainSidecarTile(...)` + Merge in `vpObsPool`.
4. Debug-Overlay um Sidecar-Hits ergänzen (Farbe/Source Label).
5. Danach Overpass-Last messen und ggf. drosseln.
