# Tracker v595 Alpha / Web v2225 – Flugbuch-Einträge vom Tracker, Homebase-Startmeldung

Nutzerentscheidung: Fliegen ohne Web-App muss vollständige Flugbucheinträge ergeben; neue Einträge
kommen nur noch vom Tracker, bestehende Einträge bleiben sichtbar, alte Läufe werden nicht nachgerüstet.

## Änderungen

- `mission-logbook-record-core.js` (neu): Logbuch-Record (schemaVersion 2) aus `sync.js` herausgelöst,
  gemeinsam für Tracker und App, gleiche `completionId`.
- `mission-authority-core.js`: Postausgang `logbookOutbox` bei `finalizeExecutionRun` (erledigt) und
  `abortExecutionRun` (abgebrochen, nur mit Flugdaten); `getLogbookOutbox`/`acknowledgeLogbookOutbox`.
- `tracker.js`: holt den Postausgang alle 10 s, legt `tracks/<runId>.entry.json` ab
  (`MISSION_LOGBOOK_ENTRY`), Capability `flight.logbook.v1`.
- `tracker-flight-track-store.js` / `tracker-flight-logbook-cloud.js`: Eintrag mit Spur und
  Abschiedsworten hochladen (`hasLogbookRecord: true`), ohne Spur nach 10 min allein, Kürzung auf 4 KB.
- `homebase-package-service.js`: lokaler Asset-Index folgt der Online-Prüfung; Katalog vor dem Lesen des
  installierten Stands laden (behebt `HOMEBASE_CLOUD_ERROR … snapshot-missing` beim Start).
- Web v2225: Flugbuch liest Missionen und freie Flüge aus der Cloud, aktualisiert beim Öffnen, zeigt ältere
  Profil-Einträge ohne Cloud-Gegenstück, „Abgebrochen“ im Bericht; mit `flight.logbook.v1` keine eigenen
  Missionseinträge mehr.

Worker unverändert. EFB-Assets unverändert (Revision 59401). Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Gesamtsuite `ga-tracker-client/*.test.js`: 1513 Tests, 1509 bestanden; 2 lastabhängige Fehler
  (SAR-Integration, Fire-Prozess), einzeln 5/5 bzw. 3/3 grün. Homebase-Selbsttest, Worker- und Web-Tests grün.
- Neu: Logbuch-Kern, Postausgang über kompletten POI-Flug, Eintrag mit/ohne Spur, Kürzung, Asset-Index.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`
  aus sauberem Worktree von `4324e4f92`; Inhalte eingebettet geprüft; gepackter Missionsprozess OK.

EXE: 174621788 Bytes; SHA-256 `f4b88180ddeaaf67f2925b66820e56410dd1ff0f7b1e7e064e9ee8e9d7cc6779`.

## Im Feld prüfen

- Mission ohne geöffnete Web-App fliegen: `MISSION_LOGBOOK_ENTRY … stored=1`, danach
  `FLIGHT_LOGBOOK_SYNCED`; Eintrag erscheint beim Öffnen des Flugbuchs.
- Mission nach dem Abheben abbrechen: Eintrag „Abgebrochen“.
- Ab dem zweiten Start mit v595 kein `snapshot-missing` mehr (`HOMEBASE_ASSET_INDEX_UPDATED` beim ersten).

Release-Upload verifiziert und EXE öffentlich erneut heruntergeladen: Größe und SHA-256 identisch.
`channel/alpha.json` auf v595 umgestellt, `stable.json` unverändert.
