# Tracker v643 Alpha – PIN-Pflicht für Relay-Befehle, lokaler EFB-Server nur für eigene Herkunft

Zusammen ausgeliefert mit Worker `ga-proxy` Version 08e22ae3 und Web v2438 (17.11.2026).

## Anlass

Sicherheitsprüfung vom 17.11.2026, Punkte 7, 9 und 10 sowie Crew-Beitrittsanzeige.

## Änderungen

- `tracker-relay-routing-core.js` / `tracker.js`: Jeder Relay-Befehl braucht den Pilot-PIN am
  Umschlag oder am Befehl (`hasRelayCommandPin`), auch `aircraft_var_set`,
  `aircraft_payload_set`, `mission_scene_*`, `mission_authority_*`, Homebase-Befehle. Alle
  Absender (sync.js `sendTrackerCommand`, Missions-Transfer, Homebase-Werkbank) setzen ihn schon.
  Log `RELAY_COMMAND_REJECT reason=pin-required`.
- `tracker-efb-http-server.js`: `isAllowedRequestOrigin` vor allen Pfaden. Web-Herkunft
  (http/https, `null`) nur Loopback oder `https://inherjer.github.io`; ohne Origin (EFB/Toolbar
  gleiche Herkunft, Desktop, Tools) und Nicht-Web-Schemata (`coui:`, `file:`) wie bisher.
  Sonst 403 `origin_rejected`, Log `EFB_ORIGIN_REJECT`.
- Web (v2438): Crew-Beitritt gilt erst nach gespeichertem Eintrag; bei Ablehnung Grund vom
  Server, vorherige Crew bleibt. Englische Texte ergänzt (`crew.joinRefused`).
- Worker (schon deployt): OpenAIP-Schlüssel aus Secret `OPENAIP_API_KEY`, Catch-all nur
  `GET /api|v1/(airports|airspaces|navaids|reporting-points)[/id]`, sonst 404.
- `EFB_WEB_ASSET_REVISION` 64301.

## Tests

- Alle Tracker-Testdateien einzeln grün; Worker-Suite grün.
- Neu: PIN-Pflicht je Befehlstyp, Herkunftsprüfung (fremde Website, `null`, LAN-Adresse 403;
  ohne Origin, Loopback, App, `coui:` erlaubt), OpenAIP-Freigabeliste.
- Im MSFS noch nicht geprüft.

## Feldtest

- EFB und Toolbar im Sim: Karte, Mission, Knöpfe laufen wie bisher.
- App im Browser: Tracker-Verbindung, Missionsstart, Szenen, Zuladung laufen wie bisher.
- Crew mit gebannter Pilot-ID beitreten: Meldung mit Grund, kein „beigetreten“.

## Artefakt

- Tag `v643`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175168604 Bytes
- SHA-256: 898587068773109ce6375dfb0f35976dfd2259b8d22a19abef9fd885511be730 (öffentlicher Download geprüft)
