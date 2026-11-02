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

Nur Alpha-Runtime umstellen, Stable unverändert.

## Im Feld prüfen

- Zweiter Pilot reserviert eine Maschine oder startet mit ihr: Im EFB und in der App erscheint der Hinweis,
  verschwindet nach 30 s oder mit ×.
- Debug-Log: `CREW_FLEET_WATCH_CONNECTED group=<Crew>` nach dem Start.
