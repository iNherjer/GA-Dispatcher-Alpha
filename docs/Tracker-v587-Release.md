# Tracker v587 Alpha / Web v2197 – Verladen auf schwachen Rechnern

Feldtest vom 22.10.2026 auf einem schwächeren System (Web-App und EFB gleichzeitig): deutliche
Verzögerungen beim Verladen, einmal „Tracker-Aktion konnte nicht ausgeführt werden“ und ein
Kaffeebecher statt des Feuerlöschers.

## Änderungen

- **Kein Ersatzobjekt bei langsamem Sim** (`tracker.js`): Ohne SimConnect-Exception wartet der
  Tracker bis zu 17 s zusätzlich auf den Originaltitel (`SCENE_SPAWN_WAIT_EXTENDED`) statt
  Karton/Kaffeebecher nachzufordern. Ersatztitel nur nach `UNRECOGNIZED_ID`/`CREATE_OBJECT_FAILED`.
  Doku: `data/mission-scene-asset-strategy.md`.
- **EFB-Missionsabfrage ohne 1,2-MB-Kopie** (`tracker-mission-process.js`): eingefrorene,
  gecachte Leseansicht (`getActiveRunView`) für EFB-Missionsansicht, Karte, Cockpit-Tools und
  Shadow. Feld-Datei: 14,8 ms → 0,14 ms je Abfrage (Apple M1), die EFB fragt alle 300–550 ms.
- **Größenprüfung inkrementell** (`mission-authority-core.js`): je Ereignis nur ersetzte Teile.
- **Aufgeteilter Missionsstand** (`tracker-mission-checkpoint-blobs.js`): unveränderte große Teile
  einmalig unter `mission-authority-v1.json.blobs/`; Hauptdatei der Feld-Datei 2.735 KB → 338 KB.
  Doku, Grenzfälle und Rückfall: `docs/Mission Runtime Authority Contract.md` (22.10.2026).
- **EFB-Assets neu synchronisiert:** enthält die NavCom-Änderungen der Web-App (Flughafenliste,
  Eingabeschrift, Doto-Schrift). Im EFB lädt Doto nicht (nur lokale TTF-Schriften aus `efb-fonts/`),
  die NavCom-Anzeige behält dort ihre bisherige Schrift.

Tracker v587, Host-Assetrevision 58701, Web-Cache v2197. EFB-/Toolbar-Community-Paket und
Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Rückfall

- Ohne Build: `mission-checkpoint-inline.flag` im Tracker-Datenordner anlegen → wieder Version-1-Datei.
- Alte EXE v586: vorher Mission beenden oder Flag setzen und einen Checkpoint abwarten.
- Code: Tag `fallback/pre-checkpoint-split-2026-10-22`.

## Prüfung

- Neu: `tracker-scene-spawn-wait.test.js` (7), `tracker-mission-run-view.test.js` (3),
  `tracker-mission-checkpoint-blobs.test.js` (15), jeweils mit Feld-Datei
  (`GA_MISSION_AUTHORITY_SAMPLE`).
- Gesamtsuite `ga-tracker-client/*.test.js`: 1456 Tests, 1419 bestanden, 35 Fehlschläge – alle
  schon vor dem Umbau vorhanden; zwei EFB-Asset-Tests sind durch die Synchronisation behoben.
- Gepackter Missionsprozess (node18-macos-arm64): `MISSION_PACKAGED_PROCESS_SMOKE_OK`, Exit 0.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build
  `--no-bytecode --public --public-packages '*'`. PE32+ x86-64; v587, Assetrevision 58701 und
  Checkpoint-Format eingebettet geprüft.

EXE: 174282617 Bytes; SHA-256 `aeb96becefab8eed5c645c7c2199fbcd6fc9d07c81ae126c2b78c43a265782f9`.

## Im Feld prüfen

- Debug-Log: `START GA Tracker v587`, `MISSION_CHECKPOINT_FORMAT format=blob-refs`.
- Beim Verladen mit offenem EFB: `projectionMs`, `MISSION_PROCESS_LOOP`, `TRACKER_TELEMETRY_DELAY`.
- Bei langsamem Sim `SCENE_SPAWN_WAIT_EXTENDED` statt Karton-/Becher-Versuchen.
- Ab dem zweiten Checkpoint Ordner `mission-authority-v1.json.blobs`; Mission nach Tracker-Neustart fortsetzen.
