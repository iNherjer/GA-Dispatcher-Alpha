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
