# Desktop 1.6.41 – Karten-Cache leeren

## Änderungen

- Knopf „Karten-Cache leeren“ neben „Datenordner“ mit Rückfrage (Größe und Kachelzahl). Läuft der Tracker,
  leert er über `POST /api/v1/tracker/map-tile-cache/clear` (ab Tracker v651) Speicher und Platte; sonst oder bei
  älterem Tracker löscht die App `%LOCALAPPDATA%\VFR Multitool\Map Tile Cache`.
  Dateien: `lib/map-tile-cache.js`, `lib/tracker-process.js`, `main.js`, `preload.js`, `ui/index.html`,
  `ui/renderer.js`, `ui/i18n-en.js`, `tests/map-tile-cache.test.js`.

## Aktivierung

_wird nach Build und Download-Prüfung eingetragen_

Nicht geprüft: Installation, Start und Update auf Windows (kein Windows-System hier) – erster Test durch User/Tester.
