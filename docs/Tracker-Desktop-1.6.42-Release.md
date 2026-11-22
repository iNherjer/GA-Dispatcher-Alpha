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

## Aktivierung

Release `tracker-desktop-v1.6.42` (Release-Commit `54720ef6b`, Worktree-Build mit kopierten `node_modules`),
Installer 100567060 Bytes, SHA-512 `RGe6LFKq…OML17BA==` wie `latest.yml`, öffentlicher Download geprüft. App-Paket
enthält `lib/vector-tile-renderer.js` und `lib/vector-render/*`, Version 1.6.42. Tests: Desktop 155 bestanden
(3 übersprungen). `channel/desktop/latest.yml` und `alpha.yml` aktiviert (Autoupdate).

Nicht geprüft: Installation, Start, Offscreen-WebGL und Update auf Windows (kein Windows-System hier).
