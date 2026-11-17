# Tracker v642 Alpha – Relay-PIN-Grund und Knöpfe nach Tracker-Neustart

Zusammen ausgeliefert mit Relay `ga-relay` Version c39be7aa (17.11.2026) und Web v2437.

## Anlass

Sicherheits- und Ablaufprüfung vom 17.11.2026, Punkte 6 und 8:

- Im Relay-Raum bestimmte bisher der erste Beitritt den PIN. Ein alter Tab mit falschem PIN
  sperrte Tracker und App aus; der Tracker zeigte nur „Verbindung getrennt“ in Endlosschleife.
- Nach einem Tracker-Neustart kannte der Tracker die Cockpit-Sitzung von EFB/Toolbar nicht mehr.
  Bis zum nächsten Heartbeat (bis 15 s) schlugen alle Missionsknöpfe mit 401 fehl.

## Änderungen

- Relay (`tools/cloudflare-relay/relay-worker.js`, schon deployt): Beitritt prüft den PIN über
  Service-Binding `GA_PROXY` gegen das Konto (`/api/auth/verify`, mit Versuchsbremse).
  Bestätigter PIN kommt immer rein und wirft Beitritte mit anderem PIN raus, falscher PIN wird
  abgewiesen. Ohne Antwort bleibt die alte Regel. Wirkt auch für ältere Tracker.
- `tracker.js`: Ablehnungspaket des Relays wird gemerkt; bei falschem PIN Hinweis
  „… Bitte Pilot-ID und PIN im Tracker prüfen“ und neuer Versuch alle 30 s statt 5 s.
  Log `TRACKER_RELAY_REJECT`.
- `tracker-cockpit-session-client.js` (EFB, Toolbar, Web): Bei `cockpit_session_invalid`/
  `cockpit_session_required` bzw. HTTP 401 einmal neu registrieren und denselben Befehl
  (gleiche `commandId`) einmal nachsenden – für Missions-Intents und Cockpit-Werkzeuge.
- Mit ausgeliefert: EFB-Popup `map-airport-popup.js` mit escapten Namen (Web v2436).
- `EFB_WEB_ASSET_REVISION` 64201.

## Tests

- Tracker-Suite `node --test *.test.js`: 1574/1583, 2 übersprungen; die Fehlschläge
  (`tracker-free-flight-recorder`, `tracker-mission-sar-integration`) sind Timing-Flackern unter
  Last, einzeln grün. Alle Testdateien einzeln grün.
- Neu: Neustart-Fall (Intent und Werkzeug je einmal nachgesendet), Dauerablehnung nur ein
  Nachsenden; Relay: alter Tab mit falschem PIN zuerst, falscher PIN, Cache, Rückfallregel.
- Relay live geprüft: Beitritt mit unbekannter Pilot-ID funktioniert, zweiter PIN wird
  abgewiesen. Mit echtem Konto noch nicht geprüft. Im MSFS noch nicht geprüft.

## Feldtest

- Tracker starten, App mit richtigem PIN: Verbindung wie bisher.
- Browser-Tab mit falschem PIN offen lassen, dann Tracker starten: Tracker kommt rein, Tab meldet
  „Falscher PIN“.
- Tracker während einer Mission neu starten, im EFB sofort einen Missionsknopf drücken: wirkt.

## Artefakt

- Tag `v642`, Asset `VFR-Multitool-Tracker.exe`
- Größe: wird nach Build eingetragen
- SHA-256: wird nach Build eingetragen
