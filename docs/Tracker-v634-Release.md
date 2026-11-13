# Tracker v634 Alpha – Empfang am Zielplatz

Zusammen ausgeliefert mit Web v2380 (Cache). Details: `docs/Mission Ground Composer Fahrplan.md`,
Abschnitt „Empfang am Zielplatz“.

## Änderungen Tracker

- **Fahrzeugregel v2** (`mission-scene-group-core.js`, Befehl `vehicleRule: 'v2'`): 1–2 Pax Pkw,
  3–5 Pax Van, Hinweis `groupVehicleKind: 'van'` bei großer Fracht; Patiententransport unverändert.
  Befehle ohne `vehicleRule` behalten v1 (bis 3 Van, sonst Bus).
- **Aufräumen:** Eine Empfangsszene, die beim Aussteigen nicht übernommen wurde (falscher Typ oder
  Flugzeug > 0,12 NM entfernt), wird nach dem Aussteigen entfernt (`SCENE_DEBOARDING_ARRIVAL_CLEANUP`).
- **EFB-Abholpunkt:** `missionGeometry.arrival` → oranger Punkt „Abholteam“ auf der EFB-Karte.
- `EFB_WEB_ASSET_REVISION` 63401.
- Mitgeliefert aus der Release Queue: Bush-Briefing-Kern (`mission-bush-narrative-core.js`),
  EFB-Kopien `i18n/en.js` und `profile.js` (ohne Wirkung im Tracker).

## Web (gleichzeitig)

- Die Mindestversion bleibt v470 (Stable v631 bleibt voll nutzbar). Regel v2 gilt, sobald dieser
  Browser zuletzt einen Tracker ab v634 gesehen hat (`localStorage` `ga_last_tracker_version_code`).

## Geprüft

- Tracker-Suite 1559/1561 (2 übersprungen, 0 Fehler), Ground-Flow-Selftest.
- **Im Simulator und im MSFS-EFB noch nicht geprüft.**

Stable bleibt unverändert.

## Aktivierung

(wird nach dem öffentlichen Download-Test ergänzt)
