# Tracker v639 Alpha – Debrief ohne Sim schließen, eine SimConnect-Kette nach Sim-Neustart

Zusammen ausgeliefert mit Web v2420 (nur Cache).

## Feldbefund 15.11.2026 (Tester-Log, Tracker v637)

1. Nach dem Beenden des Sims ließ sich das Debrief in der Web-App nicht schließen: neun Klicks,
   jeder mit `MISSION_NO_SIM_INTENT_ACK intent=close_debrief status=blocked error=simulator_disconnected`.
2. Nach einem Sim-Neustart (Trennung 19:06, Wiederverbindung 19:14 im selben Tracker-Prozess)
   wartete der Start dauerhaft auf Stillstand (`mission_cockpit_not_ready`). Im Log lief alles
   doppelt: zwei Kamera-/Uhr-Leser, zwei Lückenmonitore, zwei Ruhezustandssteuerungen
   (4.819 Wechsel hibernate/active in 9 min). Die Startfreigabe sprang bei Paketen im selben
   Millisekundentakt (`gapMs=0`) von `ready=1` auf `ground_stabilizing`. Ein Tracker-Neustart
   behob es.

## Änderungen Tracker

- `tracker-mission-offline-command-core.js`: `close_debrief` läuft auch ohne Sim. Es setzt nur
  `debriefClosedAt` eines abgeschlossenen Laufs.
- `tracker-mission-start-readiness.js`: Ein Paket mit demselben Zeitstempel (erneut gesendete
  Daten nach System-Ereignissen oder zwei Pakete in derselben Millisekunde) startet die
  3‑s-Stillstandsprüfung nicht mehr neu. Ältere Zeitstempel, Bewegung > 3 m und Datenlücken
  setzen weiterhin zurück.
- `tracker.js` `connectSimConnect`: Es läuft nur eine Verbindungskette. Jeder Versuch hat eine
  Generation, ein Reconnect-Timer, ältere Ketten verbinden nicht neu und lassen den gemeinsamen
  Zustand in Ruhe. Scheitert der Aufbau nach angenommener Verbindung, wird sie samt Timern und
  Telemetrie-Lesern geschlossen (vorher lief sie weiter).
- Neue Logzeilen: `TRACKER_SIMCONNECT_OPEN`, `TRACKER_SIMCONNECT_CLOSED`,
  `TRACKER_SIMCONNECT_SETUP_ERROR`, `TRACKER_SIMCONNECT_OPEN_ERROR` (nur bei neuer Meldung),
  `TRACKER_SIMCONNECT_STALE_*`, `TRACKER_UNCAUGHT_EXCEPTION`, `TRACKER_UNHANDLED_REJECTION`.
  Der genaue Auslöser der zweiten Kette am 15.11. ist nicht belegt; diese Zeilen sollen ihn beim
  nächsten Auftreten zeigen.
- `EFB_WEB_ASSET_REVISION` 63901. Mitgeliefert: Queue-Eintrag „EFB-Kopie profile.js:
  Diagnosezeile APT Empfangsszene“.

## Tests

- Neue Fälle in `tracker-mission-offline-command-core.test.js` und
  `tracker-mission-start-readiness.test.js`; Quelltext-Prüfungen des Reconnects in
  `tracker-efb-http-server.test.js` und `tracker-homebase-cloud.test.js` angepasst.
- Tracker-Suite im Gesamtlauf 1571–1576/1577 (2 übersprungen). Einzelne Prozess-Tests
  (`tracker-mission-fire-process`, `tracker-mission-sar-integration`) scheitern unter Last
  sporadisch, ebenso auf sauberem `origin/main`; einzeln dreimal grün.

## Im Feld prüfen

- Sim beenden, danach Debrief in der Web-App schließen.
- Sim während des Trackerlaufs neu starten: Start ohne Tracker-Neustart möglich; im Log genau ein
  `TRACKER_SIMCONNECT_OPEN` je Verbindung, keine doppelten `SIM_CAMERA_STATE from=none`.

## Artefakt

- Release `v639` (Commit `4b055c7fc`), `VFR-Multitool-Tracker.exe`, 175 138 299 Bytes,
  SHA-256 `e191ce16f31933fc74bd0ef1383fde60c91242f6876b5b47cbee6ba641acb54c`.
- Öffentlicher Download geprüft (Größe und SHA-256 identisch). Alpha-Kanal aktiv; Stable unverändert.
- Im MSFS-EFB und am Windows-Sim noch nicht geprüft.
