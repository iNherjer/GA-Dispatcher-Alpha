# Tracker v656 Alpha – EFB-Vektorkarte „VFR Vektor (OSM)“ über die Desktop-App

Zusammen mit Desktop 1.6.42 (ohne diese bleibt der neue Eintrag im EFB unsichtbar).

## Änderungen

- Neue Kachelquelle `vfr-vector` (Zoom 3–16): Die Desktop-App zeichnet den Web-Stil „VFR Vektor (OSM)“
  mit MapLibre/WebGL in einem Offscreen-Fenster und liefert JPEG-Kacheln über einen Loopback-Server mit Token
  (`VFR_MULTITOOL_MAP_RENDER_PORT/_TOKEN`). Der Tracker holt sie über den bestehenden Proxy mit Plattenspeicher;
  `no-store`-Antworten (unvollständige Bilder) werden nicht gespeichert.
- `GET /api/v1/map-render/status` meldet `vfrVector`; das EFB listet „VFR Vektor (OSM, über Desktop-App)“ nur dann
  und fällt sonst auf Topo zurück.
- EFB-Abschnitt „VFR Vektor: Farben“ (Palette-Farbfelder, −/+ für Deckkraft, Relief, Schriftgröße, Standardfarben),
  lokal in den EFB-Einstellungen gespeichert; Farbsatz als `?s=` an der Kachel-URL mit eigenem Cache-Ordner.
- Mitgeliefert aus der Release-Queue: „Hindernis-Cache gepackt (EFB-Kopie von profile.js)“ und die seit v655
  geänderten geteilten Web-Dateien (`sync-efb-web-assets.js`).
- `EFB_WEB_ASSET_REVISION` 65601.

Details: `docs/EFB-Development-Plan.md` Abschnitt 22.11.2026.

## Im Feld prüfen

- Desktop 1.6.42 installiert, Tracker v656 Alpha: Eintrag im EFB-Kartenmenü sichtbar, Karte lädt (erste Kacheln
  je Gegend 1–2 s, danach aus dem Speicher), auch in VR.
- Farben ändern: Kacheln werden neu gezeichnet und bleiben nach Neustart erhalten.
- RAM der Desktop-App während des Flugs; Fenster schließt sich 10 min nach dem letzten Abruf.

## Tests

Tracker-Suite vor dem Release-Commit: 1626/1630 bestanden, 2 übersprungen; die 2 Fehler waren die noch nicht
synchronisierten EFB-Web-Assets und sind nach `sync-efb-web-assets.js` grün (Asset-Sync-, Syntax- und
Web-Client-Tests). Electron-Ende-zu-Ende am Mac: Renderer → Tracker-Server → EFB-Host, Menü mit/ohne Dienst,
Farbwechsel (`?s=`) und Speicherung.

## Artefakt

- Release `v656` (Commit `54720ef6b`, sauberer Worktree), Asset `VFR-Multitool-Tracker.exe`
- Größe: 175434120 Bytes
- SHA-256: `d91d6264c9d0abf280883b86081246e545e1fa35cdbc211799f091d17df7edbd`
- Öffentlicher Download geprüft; Alpha-Kanal aktiviert, Stable unverändert.
