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

Nur Alpha-Runtime umstellen, Stable unverändert.
