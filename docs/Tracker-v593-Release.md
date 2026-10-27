# Tracker v593 Alpha / Web v2214 – Flugbuch: freie Flüge und Krümelweg

Wunsch: Flugbucheinträge sollen den geflogenen Weg auf Karte und Höhenprofil zeigen, auch für
Flüge ohne Mission, ohne viel Speicher oder Bandbreite. Konzept: `docs/Flugbuch Kruemelweg Konzept.md`.

## Änderungen

- `flight-track-codec-core.js` (neu, geteilt Tracker/Web): 3D-Douglas-Peucker (15 m / 30 ft),
  Pflichtpunkte, Abschnitte bei Pause/Umsetzen, Delta-Varint-Text mit Geländehöhe.
  Echte Logs: 0,2–2,8 KB je Flug statt bis 4 MB roh.
- `tracker-free-flight-recorder.js`, `tracker-free-flight-runtime.js` (neu): freie Flüge mit dem
  gemeinsamen Missions-Flugrecorder. Ende bei 20 s Stillstand, SimStop (10 s bestätigt),
  SimConnect-Close, Tracker-Ende; nach hartem Abbruch Journal → Fortsetzen (≤ 3 NM, ≤ 15 min) oder
  Abschluss beim nächsten Start. Während eines Missionslaufs keine Freiflug-Aufzeichnung.
- `tracker-flight-track-store.js` (neu): `flightlogs/tracks/<runId>.json`, je Art 50; Missionsspur
  nach `finalize` (`tracker-flight-log-store.js`), Nachrüstung vorhandener Missions-Logs 30 s nach Start.
- `tracker-flight-logbook-cloud.js` (neu): Upload alle 10 s, max. 5 je Durchgang, Backoff;
  abgelehnte Daten werden nicht wiederholt.
- `tracker.js`: Einbindung (Telemetrie-Takt, SimStop, Close, Prozessende, Start/Recovery, Upload).
- Worker `/api/flightlog-v1/` (Version `5aa59a19`, vor dem Release deployed): eigenes Durable Object
  je Pilot, Speicheranker + Namensraum wie Sync-V2.
- Web-App-Anzeige (Karte, Höhenprofil, Filter) folgt separat; diese Version sammelt und lädt hoch.

Tracker v593, Web-Cache v2214. EFB-Host, EFB-/Toolbar-Community-Paket und Desktop-Installer
unverändert. Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Neue Tests: Codec, Recorder (inkl. Absturz/Neustart/Fortsetzen), Runtime, Track-Store,
  Cloud-Upload, Flight-Log-Store-Spur, Worker `flight-logbook.test.mjs`.
- Replay der 12 echten Missions-Rohlogs: Dauer/Strecke wie Missionswerte, Spur innerhalb Toleranz.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1508 Tests, 1506 bestanden, 0 Fehlschläge
  (35 veraltete Tests in eigenem Commit an das aktuelle Verhalten angepasst). Worker `npm test` grün.
- Gepackter Missionsprozess (`tools/tracker-mission-package-smoke.cjs`, macOS arm64): OK.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`
  aus sauberem Worktree von `05ae7f049`; v593 und neue Module eingebettet geprüft.

EXE: 174596820 Bytes; SHA-256 `110d0e4039ed0b1088653cb0af95f05431a6b5713af7b561e82f50e7dd49e894`.

## Im Feld prüfen

- Debug-Log nach Start: `FREE_FLIGHT_READY`, nach ~30 s `FLIGHT_TRACK_BACKFILL_DONE added=…`,
  danach `FLIGHT_LOGBOOK_SYNCED uploaded=…` bis alle Altspuren oben sind.
- Freier Platzrundenflug: Abstellen → nach 20 s `FREE_FLIGHT_RECORDED`, dann Upload.
- Sim während des Flugs beenden bzw. Tracker hart schließen → Flug bleibt erhalten.

Release-Upload verifiziert und EXE öffentlich erneut heruntergeladen: Größe und SHA-256 identisch.
`channel/alpha.json` auf v593 umgestellt, `stable.json` unverändert.
