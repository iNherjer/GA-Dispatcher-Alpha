# Tracker v415 Alpha

Mission Control aktualisiert Pflichtmanifest, Pflichtladungszustand und POI-Arbeitszeit aus dem autoritativen Tracker-Control. Bisher blieben diese Zeilen im App-Snapshot vom Missionsbeginn stehen, obwohl das Ladefenster und der untere Ladungsblock bereits Live-Daten zeigten. Entladene Positionen zaehlen nicht als an Bord. Die Pflichtmanifest-Korrektur gilt auch fuer APT.

POI-Zieldistanz und Peilung werden aus aktuellen Flugzeugkoordinaten und dem unveraenderten Ausfuehrungsziel projiziert. Arbeitszeit nutzt den bestaetigten Detektorwert; im entspannten Modus bleiben fuenf Briefing-Minuten wie in der App 150 erforderliche Arbeitssekunden. Keine Aenderung an Triggern, Schadensregeln oder Missions-Gates.

Luftraum-Frequenzbanner liegt unterhalb der gemessenen EFB-Kopfzeile und folgt Groessenaenderungen und eingeklappter Toolbar.

Feldlog 16.09.2026: on_task um 11:36:49 und 11:37:23 UTC kurz, ab 11:38:57 bis zum Logende 11:39:44 durchgehend. Der Log beweist den Eintritt, enthaelt aber keinen genauen Dwell-Zeitverlauf. Die sichtbare Nullanzeige ist als Snapshot-Fehler reproduziert.

Validierung: gezielte Tests fuer widerspruechlichen Seed vs. aktuellen Cargo-/POI-Zustand, Entladung, Null-Gesundheit, Zielkoordinaten und APT-Pflichtmanifest. In-Sim-Nachtest erforderlich.

Runtime v415, EFB-Assets 41501. Desktop 1.6.11 und EFB-Paket 0.4.14 bleiben kompatibel; Stable unveraendert.
