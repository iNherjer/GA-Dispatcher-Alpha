# Desktop 1.6.42 – Vektorkarte fürs EFB

## Änderungen

- Zeichnet „VFR Vektor (OSM)“ für das EFB: unsichtbares Offscreen-Fenster (eigene Session `vector-render`) mit
  MapLibre/WebGL, 4×4-Kachelblöcke mit 256 px Rand, 256-px-JPEG-Kacheln (q 0,88, ~25 KB), Speicher für 48 Blöcke,
  Fenster schließt nach 10 min ohne Abruf. Loopback-Server mit Zufallstoken nur für den eigenen Tracker
  (Port/Token per Umgebung wie die Media-Bridge). Farbsätze aus dem EFB (`?s=`) werden wie in der Web-App angewandt.
  Dateien: `lib/vector-tile-renderer.js`, `lib/vector-render/*` (Seite, per Sync MapLibre-Build, Lizenz, Stil),
  `main.js`, `lib/tracker-process.js`, `scripts/sync-audio-player.js`, `tests/vector-tile-renderer.test.js`.
- Nutzt Tracker v656 (Kachelquelle `vfr-vector`); ältere Tracker ignorieren den Dienst.

## Im Feld prüfen

- Windows-GPU/Offscreen-WebGL, RAM, Start/Beenden der App, Autoupdate.
