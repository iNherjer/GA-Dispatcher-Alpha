# Tracker v440 – Feuerwache im Missions-Worker

## Umfang

`fire_watch` ist als eigener POI-Auftrag in die vorhandene Tracker-Authority
integriert. Start, Signatur, Payload-Synchronisation, Boarding, Rückflug und
Abschluss verwenden die bestehenden APT-/POI-Bausteine. Suchgebiet,
Pilotenmeldungen, Rauchbestätigung und Lagebild stammen aus den ursprünglichen
Feuerwache-Funktionen in `passenger-voice.js`.

Der generierte `mission-fire-watch-core.js` hat explizite Eingaben für Szenario,
Position, Uhr und Zustand. Die Standalone-App behält ihre ursprünglichen
Funktionen; der Generator prüft Abweichungen. Private Lagewahrheit und
Rauchquellen bleiben im Ausführungsrezept; die öffentliche Fortschrittsprojektion
enthält nur bereits erreichte Zustände und Zeiten.

## Verhalten und Abgrenzung

- PAX meldet Annäherung und Eintritt mit den Originaltexten.
- „Rauch sichtbar“ bestätigt eine echte Lage erst innerhalb der originalen
  Bestätigungsdistanz. Die Lagebildzeit beginnt mit der Bestätigung.
- „Kein Rauch sichtbar“ und erfüllte Suchzeit schließen eine Fehlmeldung ab.
- Feuerwache läuft wie im Original vor dem allgemeinen POI-Dwell-/Höhenpfad.
  Die EFB-Anzeige verwendet deshalb Suchzeit/Lagebild statt einer falschen
  generischen Höhen- oder Verweilzeitblockade.
- Pausen und bekannte Unterbrechungen verschieben die Zeitanker; Offlinezeit
  erfüllt keine Arbeitszeit. Positionsabhängige Meldungen verwenden frische
  Tracker-Telemetrie. Veraltete Positionen werden nicht als Sichtungsbeleg genutzt.
- Rauch-/Feuerbefehle laufen über den bestehenden Simulatoradapter im
  Hauptprozess und werden per ACK bestätigt. Missionsauswertung, Intents,
  RAM-Checkpoints und asynchrone Sicherung verbleiben im Missions-Worker.

Ein bestehender Fehler wurde in beiden Ausführungswegen korrigiert: Eine erst
nach Ablauf der Suchzeit gemeldete Fehlmeldung setzte bisher zwar die
Rückflugfreigabe, aber nicht die beiden Abschlussflags. Dieser bewusst begrenzte
Unterschied zur eingefrorenen Referenz ist separat getestet.

## Weiterhin offen

Training, SAR und Bush benötigen eigene Migrationen und bleiben gesperrt.
Der neue episodische POI-Writer wird separat bearbeitet. Die gewünschte
Erzählkontinuität der Folgemissionen ist in
[POI Follow-up Narrative Handoff](POI%20Follow-up%20Narrative%20Handoff.md)
dokumentiert; diese Veröffentlichung implementiert keinen neuen Writer.

## Validierung

Die automatischen Prüfungen vergleichen Originaltexte, Zustände, Sichtungs-
und Zeitgrenzen sowie den dokumentierten Fehlalarm-Fix. Zusätzlich werden
Tracker-Authority, Pausen/Wiederaufnahme, Rauch-ACKs und vorhandene APT-/POI-
Abläufe geprüft. Ein realer MSFS-Flug bleibt als Feldtest erforderlich.

Bei erneuter Sim-Anbindung wird die Rauchszene aus dem unveränderten Plan
wiederhergestellt. Taskzustand und bereits gesprochene Meldungen werden dabei
nicht zurückgesetzt oder erneut abgespielt. Rauchquellen behalten ihre geplanten
Koordinaten, auch wenn sich das Flugzeug inzwischen woanders befindet.

Prüfergebnis nach Integration des parallelen v439-Stands: **547/547**
Missions-/Voice-/EFB-/Audio- und Charter-/Wettertests erfolgreich. Ein älterer
Ketten-IPC-Test wartet jetzt auf das tatsächliche Effect-ACK statt auf eine
feste Zeitspanne. Feuerwache läuft zusätzlich durch einen
realen Missions-Kindprozess. Originalvergleiche: 158 Feuerwache-Fälle,
3.808 POI-Voice-Fälle, 6.912 manuelle POI-Aktionen, 7.920 Lifecycle-Fälle,
352 Abschiedsfälle, 864 Cargo-Stress-Fälle und 432 Ketten-Voice-Gruppen.

Windows-Asset: `VFR-Multitool-Tracker.exe`, 89.977.999 Bytes.
SHA-256: `fd7c1ea5d3eeb495b6928999bb146b92ca7da8123ad30d6622dca0d0da3b6163`.

Die parallel veröffentlichte v439 (Charter-/Wetteränderungen) ist vollständig
übernommen; Feuerwache verwendet deshalb v440 und EFB-Assetrevision 44001.
