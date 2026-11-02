# Tracker v611 Alpha / Desktop 1.6.36 – sauberes Abmelden beim Beenden

Fund aus dem Test (02.11.2026): Sim und Tracker aus, auf der Pinnwand war der Pilot weiter online und die
Vereinsmaschine belegt; 🔄 änderte nichts. Ursache: Die Desktop-App beendete den Tracker hart (`child.kill()`,
unter Windows ohne SIGTERM). Abmeldung beim Crew-Status und Freigabe der Maschine liefen nie. Außerdem waren
die Signal-Handler nur bei eingeschalteter Alpha-Missionssteuerung registriert.

## Änderungen

- Tracker: `shutdownTracker(reason)` – Flotte „left“, Crew-Status offline, Missionsstand und Logs schreiben,
  dann Ende. Gilt immer für SIGINT/SIGTERM und für den neuen lokalen Befehl `POST /api/v1/tracker/shutdown`
  (nur mit Desktop-Steuer-Token). Log `TRACKER_SHUTDOWN`.
- Desktop 1.6.36: „Stoppen“ und App-Ende bitten den Tracker zuerst um das Abmelden; hart beendet wird erst nach
  4 s oder wenn der Tracker den Befehl nicht kennt (ältere Versionen wie bisher). Beim Schließen der App wartet
  sie darauf.
- `EFB_WEB_ASSET_REVISION` 61101.

Bleibt: Stürzt der PC ab, gilt weiter „online“ bis 12 min nach der letzten Meldung und die Belegung bis 12 h
(dann „Freigeben“ auf der Pinnwand).

Tracker-EXE (Worktree `6a18112e7`, `node_modules` verlinkt): 174735451 Bytes, SHA-256
`0fad7c946ded4e7b80f571b986a16fa0a9e0f2b6b5ac7f1aee5a758e48096c14`. Desktop 1.6.36: 100309805 Bytes, SHA-512 wie
`latest.yml`. Downloads geprüft. Tests: Tracker 1539/1541 (2 übersprungen), Desktop 145/145.

Alpha-Runtime auf v611, Stable unverändert. Desktop-Autoupdate 1.6.36 aktiviert.
