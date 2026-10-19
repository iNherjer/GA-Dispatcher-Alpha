# Desktop 1.6.22 – Autostart: Statusanzeige Läuft/Beendet

Basis: Desktop 1.6.21 (`origin/main`). Tracker-Runtime unverändert.

## Feldtest 1.6.21 (19.10.2026)

`autostart-log.txt` bestätigt den vollständigen Ablauf: Aufgabe für SayIntentions
mit einer UAC-Abfrage angelegt, Start über die Aufgabe nach stabiler
SimConnect-Verbindung, Sim-Ende erkannt, Stop-Aufgabe ausgeführt, SimUpdater und
MobiFlight samt WebView-Unterprozessen geschlossen. Die `KILL_FAILED`-Meldungen
„nicht gefunden“ kamen von bereits per Baum-Kill beendeten Kindprozessen.

## Änderungen

- Der Sim zeigt „Läuft“, sobald er erkannt ist, und „Beendet“ nach seinem Ende.
- Nach dem Schließen stehen alle gestarteten Programme auf „Beendet“.
- „Nicht gefunden“ beim harten Beenden wird nicht mehr als Fehler protokolliert;
  das Log meldet `AUTOSTART_CLOSE_DONE` oder `AUTOSTART_CLOSE_REMAINING` mit den
  übrig gebliebenen PIDs, verweigerte Zugriffe als `AUTOSTART_KILL_DENIED`.

## Prüfung

- 101 Desktop-Tests bestanden, inklusive Statusfolge Läuft → Beendet.
- Statusanzeige im Browser mit dem echten UI geprüft.
