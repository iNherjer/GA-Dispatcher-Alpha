# Tracker v429 Alpha – weniger Cargo-Verwaltungsarbeit

Der v428-Feldtest zeigte einen bis zu 3,65 Sekunden wartenden Intent vor seiner
Worker-Verarbeitung und wiederholte Effekt-/Sprachbestaetigungen in dieser Zeit.
Die originale Cargoqueue bleibt die Referenz; dieser Release reduziert Aufwand
um die Queue und gibt neuen IPC-Nachrichten regelmaessig Rechenzeit.

- Interne Ereignisse teilen unveraenderte Missionspaketdaten statt das gesamte
  Paket mehrfach zu kopieren. Groessenpruefung und abgetrennte externe
  Eingaben/Rueckgaben bleiben erhalten; Replay und Guards bleiben unveraendert.
- Nur der Missionsworker gibt zwischen Effekten per setImmediate den Event-Loop
  fuer IPC, Timer und I/O frei. Direkter Cargo-Start wartet weiter nicht auf den
  allgemeinen Effekt-Durchlauf.
- Folge-Durchlaeufe nach Sprachbestaetigungen werden zusammengefasst. Die
  einzelnen Bestaetigungen bleiben erhalten. Neue Bestaetigungen waehrend eines
  laufenden Durchlaufs veranlassen einen weiteren Durchlauf.
- Effektprojektion beruecksichtigt nur offene Effekte. Die POI-Rezeptfreigabe
  wird einmal pro Snapshot statt pro historischem Effekt ausgewertet.

361 Regressionstests bestanden. Neue Nachweise: I/O-Callback wird zwischen zwei
Effekten bedient; externe Snapshot-Mutation erreicht intern geteilte Daten nicht;
kompletter POI-Flug-/Task-/Abschlussablauf mit Legacy- und Worker-Scheduling.
Gepackter pkg/Node18-ARM64-Start, Checkpoint-Datei und Shutdown erfolgreich geprueft.
Windows-x64-PE mit eingebetteter v429-Version gebaut.

Lokaler synthetischer Vergleich gegen v428: 30 Cargo-Zustandsereignisse mit
1,3 MB unveraendertem Storyfeld, erste fuenf aus der Medianmessung ausgeschlossen,
drei Durchgaenge auf macOS/Node25.9.0. Baseline-Mediane 5,29 / 4,28 / 4,44 ms;
neue Mediane 2,31 / 2,02 / 2,00 ms. Dies misst Authority-Ereignisverarbeitung,
nicht EFB-/SimConnect-Latenz oder reale Windows-Leistung. Standalone-Paritaet der
Bediengeschwindigkeit muss weiterhin im Feld bestaetigt werden.

Periodische Fuenf-Sekunden-Sicherung und Cargo-Recovery bleiben erhalten.
Die neue Zeitaufteilung wird mit der bestehenden Worker-Revisionspruefung benutzt;
das Legacy-Timing bleibt unveraendert. Stable wird nicht umgestellt.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57791855 Bytes

SHA-256: `50ad5d803d9618e9a86ebc43cce3683cb5009e1e941eed7175e1fd541e6ca1fb`
