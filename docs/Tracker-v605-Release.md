# Tracker v605 Alpha / Web v2298 – Startfreigabe ohne Flackern, Diagnose für späte Simulatordaten

## Änderungen

- Startfreigabe (`tracker-mission-start-readiness.js`): Simulatorwerte gelten erst nach 6 s statt 2,5 s als veraltet
  (`START_READINESS_MAX_AGE_MS`). Direkt nach dem Laden liefert der ausgelastete Sim das 1-Hz-Paket oft verspätet;
  das ließ „Mission beginnen“ zwischen „Warte auf aktuelle Simulatordaten“ und neu gestarteter Stillstandsprüfung
  springen. Ein verspätetes Paket ohne Bewegung (≤ 3 m, GS ≤ 0,5 kt) setzt die 3-s-Prüfung nicht mehr zurück.
  Pause, Menü, SimStop und Weltkarte entziehen die Freigabe weiter sofort.
- EFB-Banner (`tracker-efb-kartentisch-host.js`) und App/EFB-Banner (`mission-apt-ui-core.js`) nutzen dieselbe Grenze.
- Neue Diagnose im Debug-Log:
  - `MISSION_START_READINESS` bei jedem Wechsel der Freigabe (Grund, Paketabstand, GS, Kamera).
  - `MISSION_START_SOURCE_LATE` je Paket mit ≥ 2 s Abstand, `likely=tracker_busy` (Event-Loop des Trackers blockiert),
    `simulator_stall` (auch die bildbasierte Haupt-Telemetrie war still) oder `readiness_link` (nur das
    SimConnect-SECOND-Paket kam spät); minütlich `MISSION_START_SOURCE_LATE_SUMMARY`.
  - `MISSION_START_READINESS_HANDOVER_DELAY` bei > 1 s Übergabe in den Missionsprozess.
- Aus der Warteschlange: Routen-Hindernis-Cache auf Handys kleiner (EFB-Kopie `profile.js`, dort keine Verhaltensänderung);
  die EFB-Kopie enthält auch den Stand aus `e5f8d6b10`.
- `EFB_WEB_ASSET_REVISION` 60501.

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `009e0cf0e`): 174694634 Bytes; SHA-256 `a974c261d3a34cbc842016688be3735cab72c423f219bf0eb607f530263344f5`.
Öffentlicher Download geprüft. Volle Tracker-Testsuite: 1532 Tests, 1530 bestanden, 0 Fehler.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Im Feld prüfen

- Flug laden, Maschine steht: „Mission beginnen“ wird nach dem Laden einmal frei und bleibt frei, kein Wechsel mehr
  zwischen „Warte auf Simulatordaten“ und „Stillstand wird geprüft“.
- Debug-Log danach: `MISSION_START_SOURCE_LATE`-Zeilen zeigen, wo die Verspätung entsteht.
