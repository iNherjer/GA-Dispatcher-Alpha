# Tracker v600 Alpha / Web v2259 – Cloud-Mission per Anstoß statt 2,5-s-Abfrage

## Änderungen

- Web-App: Nach jedem Cloud-Schreiben, das Mission, Tracker-Seed oder Freiflug-Route ändert (Annahme, Löschen,
  Ersetzen, Abschluss, manuelles Speichern), schickt sie über den Relay `cloud_mission_changed` (ohne
  Missionsdaten), nur an Tracker mit `mission.cloud-knock.v1`. Konnte sie nicht senden, holt sie es mit dem nächsten
  Tracker-Heartbeat nach (längstens 30 s).
- Tracker: liest bei einem Anstoß sofort die Cloud (höchstens ein Anstoß-Lesevorgang alle 2 s) und einmal nach
  jedem Relay-(Wieder-)Aufbau. Sicherheitsabfrage alle 30 s mit Relay, alle 5 s ohne Relay; nicht abgeschlossene
  Abgleiche weiter alle 2,5 s, Lesefehler nach 10 s. Vorher fest alle 2,5 s (rund 35.000 Worker-Anfragen pro Tracker
  und Tag, Free-Limit 100.000).
- EFB: Checklisten werden auch beim erneuten Öffnen der Schublade auf der Liste abgerufen.

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `7d0267036`): 174665291 Bytes; SHA-256 `47e62060cab8646c15809748bbd63630bb67cc1abc28ffebb05cb2437fd7bf63`.
Öffentlicher Download geprüft.

Nur Alpha-Runtime umstellen, Stable unverändert. Details: `docs/Mission Runtime Authority Contract.md`.

## Prüfung

- Tracker: `tracker-efb-http-server` (Quelltest Anstoß/Poll), Relay-, Cloud-Mission-, Hibernate-Tests: 78.
- EFB-Asset-Tests 24. Web: `mission-draft-sync`, `cloud-idle-ack`, `sync-field-merge`, `efb-interruption-host`.
- `mission-generation-sync` (15) und `mission-opening-sync` (5) scheitern unverändert wie vor der Änderung.

## Im Feld prüfen

- Tracker läuft, in der App eine Mission annehmen: im Tracker nach ~1 s, Debug-Log `MISSION_CLOUD_KNOCK`.
- Dasselbe vom Handy aus.
- Mission in der App löschen oder ersetzen: Tracker folgt sofort.
- Ohne Anstoß (alter App-Tab): Mission kommt spätestens nach 30 s.
