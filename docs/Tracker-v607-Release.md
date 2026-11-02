# Tracker v607 Alpha / Web v2306 – Hinweis „Vereinsflotte geändert“ in EFB und App

## Änderungen

- Neu `tracker-crew-fleet-watch.js`: ruhende WebSocket-Verbindung zur Crew-Flotte (Worker `crew-fleet.mjs`),
  lädt bei jeder Änderung nur das Geänderte. Ändert ein anderer Pilot die Flotte, legt der Tracker
  `crewFleetNotice` in den EFB-Status (30 s). Log `CREW_FLEET_WATCH_CONNECTED`, `CREW_FLEET_NOTICE`.
  Aus ohne Crew oder bei ausgeschalteter Vereinsflotte („Meine Freigaben“).
- EFB-Kartentisch (`tracker-efb-kartentisch-host.js`): Hinweisband oben, 30 s, mit × schließbar.
- `EFB_WEB_ASSET_REVISION` 60701.
- `wili-fleet-core.js`: `changeNotes`, `noticeText` (eigene Änderungen nie).

## Web (gleicher Push)

- `crew-fleet-client.js`: gleiches Hinweisband in der App mit „Pinnwand“-Knopf (öffnet das Crew-Brett).

EXE (Windows-x64, pkg 6.18.1 / Node18, `--no-bytecode --public --public-packages '*'` aus sauberem Worktree von
`3b3b394ce`, `node_modules` als Link wie bei v605/v606 – mit kopierten `node_modules` packt pkg rund 225 KB weniger,
Ursache ungeklärt, deshalb nicht verwendet): 174728046 Bytes; SHA-256
`16f463703a15b121409fcdda8a04d2b4dcc75d64c74e25d52e4a028a64996483`. Öffentlicher Download geprüft.
Volle Tracker-Testsuite: 1537 Tests, 1535 bestanden, 2 übersprungen, 0 Fehler.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Im Feld prüfen

- Zweiter Pilot reserviert eine Maschine oder startet mit ihr: Im EFB und in der App erscheint der Hinweis,
  verschwindet nach 30 s oder mit ×.
- Debug-Log: `CREW_FLEET_WATCH_CONNECTED group=<Crew>` nach dem Start.
