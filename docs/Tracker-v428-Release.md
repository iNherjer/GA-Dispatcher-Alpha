# Tracker v428 Alpha – RAM-Commits und periodische Missionssicherung

Cargo-Klicks warten im Missionsprozess nicht mehr auf die Speicherung des
vollstaendigen Authority-Zustands. Die fachliche Aenderung und das Intent-ACK
beziehen sich auf den RAM-Zustand. App und EFB erhalten diesen aktuellen Stand.

- Ein einzelner Writer sichert bei Aenderungen im festen Fuenf-Sekunden-Takt.
  Mehrere Lade-/Entladeklicks ergeben einen aktuellen Sicherungsstand statt
  einer Dateischreibung pro Klick. Langsame I/O erzeugt keine Snapshot-Warteschlange.
- Manifest, Missionszustand, Effekte und Journal werden konsistent zusammen
  erfasst; Schreiben und Ersetzen der Datei erfolgen asynchron. Schreibfehler
  erhalten die vorige Sicherung und werden beim naechsten Takt erneut versucht.
- Die reine Disk-Rollback-Gesamtkopie pro Execution-Event entfaellt im Worker.
  Andere fachliche Validierungen und Kopien bleiben erhalten.
- Nach Prozessneustart werden alte offene Cargo-Objektwirkungen durch eine
  Projektion des geladenen Sollzustands ersetzt. Beim ersten gueltigen
  Simulatorstand werden Cargo-Objekte und Payload abgeglichen, ohne neue
  Manifestaenderung oder Cargo-Sprachansage. PAX/andere Effekte behalten ihre
  vorhandenen Wiederanlaufregeln. Simulatorfehler blockieren keine neue Klickfolge.
- Normaler Shutdown fordert eine letzte Sicherung mit begrenzter Wartezeit an.
  Diagnose meldet dirty/savedRevision/lastSavedAt und getrennte JSON-/I/O-Kosten.

Bewusst akzeptiert: Bereits bestaetigte Aktionen seit der letzten erfolgreichen
Sicherung koennen bei einem harten Abbruch verloren gehen. Fuenf Sekunden sind
ein Zielintervall, keine Garantie bei langsamer Platte oder Schreibfehlern.
JSON-Aufbereitung erfolgt noch einmal je Sicherung im Missionsloop und kann
periodische CPU-Spitzen verursachen. Die tatsaechliche MSFS-Klicklatenz ist im
Feld zu vergleichen; es wird keine Standalone-Geschwindigkeit behauptet.

358 relevante Tests bestanden. Enthalten sind 100 schnelle RAM-Aenderungen mit
einem Checkpoint, unverrueckter Speichertakt bei weiteren Aenderungen, blockierte
I/O, fehlerhaftes Rename mit Erhalt der alten Sicherung sowie ein echter SIGKILL
zwischen gespeicherter und ungespeicherter Cargo-Aenderung mit Wiederabgleich.
Gepackter pkg/Node18-ARM64-Smoke-Test inklusive echter Sicherungsdatei und
Worker-Exit 0 bestanden. Windows-x64-PE und eingebettete v428-Kennung geprueft.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57790123 Bytes

SHA-256: `b1878686a344096de65688bdf529fbbf045b44a7e48a35f2ad905df0ddd781b9`
