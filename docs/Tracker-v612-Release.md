# Tracker v612 Alpha – EFB-Dateien der englischen UI-Übersetzung (Phase 0/1)

Anlass (03.11.2026): Die Web-App hat seit v2318/v2319 eine umschaltbare englische Oberfläche
(`docs/English Translation Plan.md`). Die EFB-Kopien der geteilten Dateien wurden dafür neu erzeugt
(`ga-tracker-client/sync-efb-web-assets.js`) und sollen im Alpha-EFB geprüft werden.

## Änderungen

- Neu erzeugte EFB-Assets (`ga-tracker-client/efb-web-assets/`): Kartentisch-Fragment, Kartentisch-Werkzeuge,
  Checklisten, Höhenprofil, Popups, Platzwetter, Funk-Dialog, Uhr, Media-Player-Watch. Das EFB lädt keinen
  Übersetzungs-Kern (`GAI18n`); alle Helfer fallen dort auf exakt das bisherige Deutsch zurück.
- Watch und Watch-Face: `efb-media-source/media-player-watch*.js` entsprechen wieder der Web-Fassung
  (Test in `tracker-efb-web-client.test.js`); im EFB ohne sichtbare Änderung.
- `EFB_WEB_ASSET_REVISION` 61201, damit EFBs die neuen Dateien laden.
- Keine Änderung an Tracker-Logik, Protokoll oder Missionslaufzeit.

## Im Alpha-EFB prüfen

- Kartentisch öffnet wie bisher, alles deutsch.
- Watch: kurz tippen auf „Zurück“ geht zurück, gedrückt halten schließt; Uhr, Stoppuhr/Timer, Musiksteuerung.
- „Was ist hier?“ an einem Flugplatz: METAR erscheint und bleibt beim erneuten Öffnen.
- Funk-Dialog, Checklisten, Höhenprofil, Popups.

Stable bleibt unverändert (v605).

Tracker-EXE (Worktree `d5ca9f9da`, `node_modules` verlinkt, `--no-bytecode --public --public-packages "*"`):
174757213 Bytes, SHA-256 `c570fda780a4f816220170c6f58bd5e2989cf9782cb3d062d6339f1948755210`. PE x64, eingebettete
Version v612, Asset-Revision 61201 und neue EFB-Dateien geprüft; öffentlicher Download geprüft.
Tests: Tracker 1539/1541 (2 übersprungen). Alpha-Runtime auf v612, Stable unverändert (v605).
