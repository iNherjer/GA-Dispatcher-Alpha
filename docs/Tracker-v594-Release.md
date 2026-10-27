# Tracker v594 Alpha / Web v2222 – Abschiedsworte im Flugbuch

Wunsch: Im Flugbericht neben Flug- und Komfortdaten auch die Bewertung des Passagiers zum Ausgang der
Mission zeigen. Die gesprochenen Abschiedsworte wurden bisher nur abgespielt, nicht gespeichert.

## Änderungen

- `tracker-mission-farewell-voice.js`: meldet den tatsächlich erzeugten Abschiedstext (`onSpoken`).
- `tracker-flight-track-store.js`: Notiz `tracks/<runId>.note.json` (`putNote`/`getNote`, max. 2000
  Zeichen); ein bereits hochgeladener Eintrag wird erneut eingereiht.
- `tracker-flight-logbook-cloud.js`: sendet `farewellText`, `farewellSpeaker`, `farewellRole` mit dem
  Missionseintrag an `/api/flightlog-v1/` (Worker unverändert).
- `tracker.js`: Verdrahtung, Log `MISSION_FAREWELL_NOTE run=… chars=… stored=…`.
- EFB: `styles.css` wird mitkopiert (Flugbuch-Stile ohne Wirkung im EFB), Assetrevision 59401.
- Web v2222: Zitat im Missionsergebnis und auf der PDF-Seite.

Profil-Logbuch und Browser-Speicher unverändert. Flüge vor v594 haben keine Abschiedsworte.
Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Neue Tests: Abschiedsmodul meldet Text, Notiz vor/nach Spur-Upload, Upload enthält Notiz.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1510 Tests, 1508 bestanden, 0 Fehlschläge
  (SAR-/Feuer-Integration unter Last gelegentlich zeitabhängig wacklig, einzeln 10/10 grün).
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`
  aus sauberem Worktree von `08c3b4a69`; v594, Notiz-Code und Assetrevision eingebettet geprüft.
- Gepackter Missionsprozess (`tools/tracker-mission-package-smoke.cjs`): OK.

EXE: 174604260 Bytes; SHA-256 `1fb166f0adb353a66e2ebf30634507be7ac3fed3b6d149a53520603e10c38d0f`.

## Im Feld prüfen

- Mission mit Passagier fliegen: nach der Abschiedsansage `MISSION_FAREWELL_NOTE … stored=1`, danach
  `FLIGHT_LOGBOOK_SYNCED`; im Flugbericht erscheint das Zitat.

Release-Upload verifiziert und EXE öffentlich erneut heruntergeladen: Größe und SHA-256 identisch.
`channel/alpha.json` auf v594 umgestellt, `stable.json` unverändert.
