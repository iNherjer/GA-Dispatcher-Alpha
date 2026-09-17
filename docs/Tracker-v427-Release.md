# Tracker v427 Alpha – Cargo-Latenz und messbare Prozesskosten

Der v426-Feldtest zeigte Wartezeit vor der eigentlichen Simulatorarbeit:
Ein Spawn dauerte 34 ms, der gesamte Weg seit Intent-Empfang rund 2,5 s.
Transport-/Hintergrundrevisionen konnten ausserdem zwischen Vorpruefung und
Ausfuehrung wechseln und erneute Konflikte erzeugen.

Aenderungen:

- Der Missionsprozess prueft die originale Client-Revision unmittelbar vor der
  Ausfuehrung. Ein separater Rebase-RPC und die anschliessende Verwendung einer
  zuvor im Elternprozess gelesenen Revision entfallen. Die bestehenden
  semantischen Rebase-Guards bleiben unveraendert: geaenderte Ziele oder
  fachliche Voraussetzungen koennen weiterhin einen Konflikt ausloesen.
- Vollstaendige Authority-Projektionen werden nur nach einem Persistenzversuch
  neu aufgebaut. Unveraenderte Reads und abgelehnte Intents verwenden die
  bestehende Projektion. Runtime-/Simulatorstatus bleibt separat aktuell.
  Der IPC-Diff erzeugt keine wiederholten JSON-Strings pro Objektebene mehr;
  identische Referenzen werden sofort uebersprungen, Arrays bleiben atomar.
- Debug- und Missionstestlogs werden asynchron gebuendelt geschrieben. Pro
  Logger gibt es einen geordneten Writer, asynchrone Rotation und eine begrenzte
  Warteschlange. Langsame Diagnose-I/O blockiert den aufrufenden Loop nicht.
  Ueberlauf/Schreibfehler werden gezaehlt; Diagnoselogging ist best effort.
- Alle zehn Sekunden erscheinen kumulative Kostenzaehler:
  `MISSION_PROCESS_COST` fuer Projektionsaufbau/-vergleich und dauerhafte
  Authority-Speicherung; `TRACKER_LOG_COST` fuer Log-Batches, Bytes,
  I/O-Wartezeit, Warteschlange und verworfene Eintraege. Intervallkosten aus
  Differenzen innerhalb desselben Prozesslaufs ermitteln. Log-I/O-Zeit ist
  asynchrone Wartezeit, keine gleich grosse Event-Loop-Blockade.

Dauerhafte Missions-Commits bleiben vor Bestaetigung gespeichert. Ihre weiterhin
synchronen Vollzustands-Schreibvorgaenge werden hier gemessen, nicht pauschal
entfernt. Die Original-App-Cargoqueue und ihre 180-ms-Buendelung bleiben erhalten.

Validierung: 351 Regressionstests plus ein zusaetzlicher IPC-Patch-Test bestanden.
Abgedeckt sind unter anderem unveraenderte versus geaenderte Cargo-Ziele bei
Revisionsdrift, Weitergabe der Originalrevision, unveraenderte Projektionen,
blockierte Log-I/O, Ueberlauf, Rotation und Erholung nach Schreibfehlern.
Der Windows-/MSFS-Feldtest muss die verbleibende Klicklatenz bestaetigen.

Gepackter pkg/Node18-ARM64-Smoke-Test mit produktivem Tracker-Einstieg bestanden:
`MISSION_PACKAGED_PROCESS_SMOKE_OK`, Authority-Schreibzugriff, Worker-Exit 0.
Windows-x64-PE und eingebettete Versionskennung geprueft; pkg 6.18.1/Node18.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57781850 Bytes

SHA-256: `142c7a63df0245c9eaf307ec53bb8c16cd4eba8206decf330b5a480c2f66e6ba`
