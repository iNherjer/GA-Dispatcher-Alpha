# Tracker v489 / Bush- und Wetterintegration – Alpha-Rollout

Die Bush-Erweiterung baut auf Alpha v488 auf und enthält außerdem die am
7. Oktober veröffentlichten Dispatch-/SAR- und KI-Quota-Hotfixes.
Offene EFB-Menüs behalten bei laufenden Updates Fokus und Bedienbarkeit; der
Audio-Hotfix und die Positionierung bleiben bytegleich zum veröffentlichten Stand.
Der Kandidat ergänzt persönliche Bush-Geschichten, feste und geografische
Routen-Voices, Umgebungs-/Prognosekontext und sachliche Zielplatzinformationen.
Platztexte entstehen weiterhin im gemeinsamen Writer; kein zusätzlicher KI-Aufruf
und kein Modellwechsel.

## Artefakte und Basis

- Quellbasis: Alpha `f09f7735785fdbdc00d4af25833a7833fc794c7d`.
- Lokaler Code-Integrationscommit: `37a452d1c1164b42c6fbd3a8a1d885a01c71fba3`.
- Tracker v489, EFB-Web-Assets 48901, Web-Cache v1954 bei Kanalaktivierung.
- EXE: 173663457 Bytes; SHA-256 `fe6cfc2673e41be0df402c6d22eab447af401cec5d771437a47477cd77830f07`.
- Unveränderte offizielle SDK-Rückgabe 0.4.22: 443663 Bytes;
  SHA-256 `363dd5301f29b877d4d613d086f02c7b878182e97b44bd38c97e2bc10d1dc429`. Native Quelle exakt hashgleich zur SDK-Rückgabe.
- Artefaktordner: `analysis/bush-live-20261007/release-v489/`.
- Lokaler Branch: `codex/bush-weather-release-v489`. Alpha-Rollout am 7. Oktober vom Nutzer freigegeben;
  Veröffentlichungsnachweise werden nach erfolgreicher Prüfung ergänzt.

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
- 556/556 Missionsfamilien-/Briefing-/Dispatchtests bestanden, darunter APT-Reporter,
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

Technisch gebaut und lokal regressionsgeprüft; Alpha-Veröffentlichung vom Nutzer
freigegeben. Nach Integration der drei aktuellen Hotfix-Commits wurden beide
breiten Testsuiten sowie die Worker-Suite erneut erfolgreich ausgeführt. Der
neu gebaute Windows-Build ist bytegleich zum vorher geprüften Artefakt.
Die bekannte Prosa-Stichprobe bleibt 4/4 erstellte Platzbriefings, U60 8/8 einzeln
erreichbare Kapitel nach Restore und ESNC-Kapitel-Timeout. Pistenlänge wird
teilweise unzulässig als ausreichend beurteilt; einzelne Stations-/Ortsangaben
bleiben ungenau. Es gibt keinen semantischen Faktenvalidator und keine
nachträgliche Prosa-Umschreibung. Die Texte sind keine geprüften Flugverfahren.
Keine weitere bezahlte Text-/TTS-Probe war Teil dieses Build-Auftrags.

Nach Alpha-Rollout im laufenden Windows/MSFS noch prüfen: Boarding, Bush-Kapitel,
Geo-Radius und verpasster Anker, Voice-Priorität, Zwischenlandung/Rückflug,
Cargo/Patienten-/Gruppenmanifest, Landung/Farewell, Speichern/Wiederaufnehmen;
mit und ohne EFB, Pause/Slew/Menü sowie Wetter-/Zeitsprünge. Keine Fehlansage
bei identischen Wetterwerten, keine künstliche Ursache ohne Preset-Nachweis.
Die tatsächliche Preset-API/Audio-/VR-Bedienung ist durch Browser und Mocks
nicht abgenommen. SDK 0.4.22 bleibt bis zur Simulatorabnahme inaktiv; das bereits aktive
SDK 0.4.21 bleibt unverändert verfügbar.

## Reihenfolge beim Alpha-Rollout

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

## Veröffentlichungsnachweis – 7. Oktober 2026

- Alpha vom Nutzer freigegeben; Quellstand inklusive aktueller Dispatch-/SAR-/Quota-Hotfixes nach Main gepusht.
- Release-Tag `v489` zeigt auf `ab7687beae54beaabb1a84f7f20b7d3487f7f3c9`.
- [GitHub-Release v489](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v489) veröffentlicht. Öffentlicher EXE-Download: HTTP 200, 173663457 Bytes und SHA-256 exakt wie oben; Prüfung 2026-10-07T18:31:44Z.
- Worker `ga-proxy` deployt, Version `b982098d-e3a6-4ff7-85f8-f5a94f7b1fa3`. Die öffentliche Erstprüfung fand die von Cloudflare nicht unterstützte Redirect-Option `error`. Isoliert auf `manual` korrigiert; Redirects bleiben abgewiesen, 7/7 FAA-Tests bestanden, erneut deployt.
- Öffentliche FAA-Prüfung: U60 HTTP 200 in 598 ms, MYL (FAA-Kennung für KMYL, vom Browser bereits normalisiert) HTTP 200 in 619 ms, gültiger Datenzyklus 1.–29. Oktober. Ungültige Kennung HTTP 400. KMYL direkt wird bewusst nicht als passende FAA-Identität akzeptiert.
- Tracker-Alpha-Zeiger erst nach öffentlicher Größen-/Hash-Prüfung auf v489 gesetzt. EFB-Alpha bleibt auf aktivem SDK 0.4.21; SDK 0.4.22 und Stable-Zeiger unverändert. Keine Simulatorabnahme behauptet.
