# Tracker v489 / Bush- und Wetterintegration – Release-Kandidat

Die Bush-Erweiterung wird auf dem veröffentlichten Alpha-Hotfix v488 aufgebaut.
Offene EFB-Menüs behalten bei laufenden Updates Fokus und Bedienbarkeit; der
Audio-Hotfix und die Positionierung bleiben bytegleich zum veröffentlichten Stand.
Der Kandidat ergänzt persönliche Bush-Geschichten, feste und geografische
Routen-Voices, Umgebungs-/Prognosekontext und sachliche Zielplatzinformationen.
Platztexte entstehen weiterhin im gemeinsamen Writer; kein zusätzlicher KI-Aufruf
und kein Modellwechsel.

## Artefakte und Basis

- Quellbasis: Alpha `7eb2c46103fbeee98f3f09aad54206cabf074ced`.
- Lokaler Code-Integrationscommit: `dbf6495aa86e9d73ed6cf57cc42c17a65e42cd59`.
- Tracker v489, EFB-Web-Assets 48901, vorbereiteter Web-Cache v1949.
- EXE: 173663457 Bytes; SHA-256 `fe6cfc2673e41be0df402c6d22eab447af401cec5d771437a47477cd77830f07`.
- Unveränderte offizielle SDK-Rückgabe 0.4.22: 443663 Bytes;
  SHA-256 `363dd5301f29b877d4d613d086f02c7b878182e97b44bd38c97e2bc10d1dc429`. Native Quelle exakt hashgleich zur SDK-Rückgabe.
- Artefaktordner: `analysis/bush-live-20261007/release-v489/`.
- Lokaler Branch: `codex/bush-weather-release-v489`. Noch kein Push, Tag,
  Worker-Deployment, Release-Upload, Installationsschritt oder Kanalwechsel.

## Änderungen und Umfang

Neue Kontext-/Platztexte bleiben auf die freigegebenen Bush-Profile beschränkt.
Die ursprünglichen APT-/POI-/Pickup-/Cargo-Abschlussbedingungen bleiben bestehen.
Kapitel laufen im bestehenden Authority-/Voice-Pfad; Geo-Momente sind optional,
werden vor Playback erneut geprüft und nicht nachträglich nachgeholt. Feste
Kapitel, Wetter und Abschied nutzen die serielle Wiedergabe. Ohne PAX entstehen
keine erfundenen Bordsprecher.

Gemeinsamer Niederschlagsfix nach Nutzerfreigabe: SDK STATE 2/4/8/12 beschreibt
kein Niederschlag/Regen/Schnee/gemischt. Die Rohmenge hat keine bestätigte
Stundenbasis und wird nicht als mm/h oder Intensitätswert ausgegeben. Dieser
bewusste gemeinsame Fix erreicht auch die anderen Voice-/Logbuchpfade.
Wetter-/Zeitsprungbeobachtung läuft ohne natives EFB; eine Aussage über einen
Preset-Eingriff benötigt frischen authentifizierten EFB-Nachweis.

## Prüfung gegen Regressionen

- 1127/1127 Tracker- und gemeinsame Core-Tests bestanden.
- 524/524 Missionsfamilien-/Briefingtests bestanden, darunter APT-Reporter,
  medizinische Verlegung, Tiertransport, Cargo, POI, Historiker, Guide,
  Sightseeing, Fire, SAR, Mapping, Training, Bush und Folgeaufträge.
- 58/58 zusätzliche native EFB-/Toolbar-/Paketprüfungen bestanden (teilweise
  Überschneidung mit den vorigen Testdateien; keine behauptete Gesamtsumme).
- Vollständige lokale Worker-Suite einschließlich FAA, METAR, Sync und
  Downloadrouten bestanden; Wrangler-Deployment-Trockenlauf erfolgreich.
- 18 echte Browser-Menüfälle: Fokus, Klick zwischen zwei Flugupdates, keine
  Neueinsetzung unveränderter Menüs; physisch/Popout/Toolbar in 2D und VR.
- 60 Browser-Layoutfälle sowie Profil-/Font-/Scale-/Canvas- und Redraw-Proben
  bestanden. Bewegte Daten, neue Layer, Zoom/Pan und Profildaten aktualisieren.
- Briefing-/Zielseiten-Browserprüfung: Quellenlinks, Absätze, Wiederherstellung,
  HTML-Injection-Schutz und kein alter Abholplatztext beim Rückflug bestanden.
- 7 Generator-Drift-Checks und 14 App-/Tracker-Paritäts-/Flowchecks bestanden.
- Windows-x64-EXE gebaut; 17 relevante eingebettete Quellmodule exakt geprüft.
- Echt gepackter macOS-IPC-/Authority-Start mit Speicherung und Worker-Exit 0:
  `MISSION_PACKAGED_PROCESS_SMOKE_OK`. Kein Windows-/SimConnect-Feldtest.
- SDK-ZIP CRC, 20 Layoutgrößen, 22 Dateien und produktiver Desktop-Entpacker
  geprüft. Windows-Pfadnamen beim Prüfen normalisiert; Archiv unverändert.

Die ersten breiten Läufe hatten 16 Fehler in isolierten Quell-VMs: fehlende
neu benötigte Hilfsfunktionen für Bush-Kontinuität und Niederschlag. Die fünf
Testumgebungen laden jetzt die tatsächlichen Quellfunktionen; Assertions und
Produktionslogik wurden dafür nicht abgeschwächt. Beide kompletten Suiten wurden
anschließend erneut ausgeführt und bestehen.

## Grenzen und Freigabe

Technisch gebaut und lokal regressionsgeprüft, noch nicht veröffentlicht.
Die bekannte Prosa-Stichprobe bleibt 4/4 erstellte Platzbriefings, U60 8/8 einzeln
erreichbare Kapitel nach Restore und ESNC-Kapitel-Timeout. Pistenlänge wird
teilweise unzulässig als ausreichend beurteilt; einzelne Stations-/Ortsangaben
bleiben ungenau. Es gibt keinen semantischen Faktenvalidator und keine
nachträgliche Prosa-Umschreibung. Die Texte sind keine geprüften Flugverfahren.
Keine weitere bezahlte Text-/TTS-Probe war Teil dieses Build-Auftrags.

Vor Kanalaktivierung im laufenden Windows/MSFS prüfen: Boarding, Bush-Kapitel,
Geo-Radius und verpasster Anker, Voice-Priorität, Zwischenlandung/Rückflug,
Cargo/Patienten-/Gruppenmanifest, Landung/Farewell, Speichern/Wiederaufnehmen;
mit und ohne EFB, Pause/Slew/Menü sowie Wetter-/Zeitsprünge. Keine Fehlansage
bei identischen Wetterwerten, keine künstliche Ursache ohne Preset-Nachweis.
Die tatsächliche Preset-API/Audio-/VR-Bedienung ist durch Browser und Mocks
nicht abgenommen. SDK-Kanal bleibt bis zur Simulatorabnahme deaktiviert.

## Reihenfolge beim späteren Alpha-Rollout

1. Aktuelle Origin-Refs und freie Tags erneut prüfen; neuen Stand kontrolliert
   integrieren, falls Alpha inzwischen weitergelaufen ist.
2. Gemeinsamen FAA-Worker-Endpoint deployen und öffentlich prüfen.
3. Gewünschte Quelländerungen bewusst nach Origin/Main pushen (Cache-Version
   gegen dann aktuellen Stand prüfen). Keine Analyse-Dateien, Keys oder EXE stagen.
4. Release-Commit mit v489 taggen, unveränderte EXE über den vorhandenen Publisher
   hochladen und öffentlichen Download gegen Größe/SHA-256 prüfen.
5. Erst danach Tracker-Alpha-Zeiger aktivieren. Der Kandidatenordner enthält eine
   Vorlage, die nicht in den produktiven Kanal kopiert wurde.
6. Nach Windows/MSFS-Abnahme das unveränderte offizielle SDK-ZIP unter
   efb-app-v0.4.22 veröffentlichen, Download prüfen, erst dann EFB-Alpha aktivieren.
   Stable bleibt unverändert; eine Stable-Promotion benötigt ihren eigenen Test.
