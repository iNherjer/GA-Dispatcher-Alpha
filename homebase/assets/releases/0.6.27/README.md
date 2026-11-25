# Tumbleweed-Personen aus der Lieferung vom 15.11.2026

## Weiterverarbeitung der Korrektur vom 23.11.2026

Für die vier zusätzlichen Figuren werden eigene SimObject-Ordner und Katalog-Keys verwendet. Die Zuordnung basiert auf den gelieferten Modellen und der Sim-Aufnahme. Altersgruppe und Saison sind visuelle Einordnungen. Der Patient trägt Alltagskleidung und eine Decke. Sein Einsatzzweck `patient` steht unter `appearance.uses`, der Kleidungsstil ist `outdoor`.

| Katalog-Key | Titel | Technische Rollen | Auswahl unter `appearance.uses` |
| --- | --- | --- | --- |
| `tumbleweedCasualM` | `tw-pod-casual-m-01` | `passenger`, `scene-person` | `passenger`, `pickup`, `bystander`, `escort` |
| `tumbleweedHikerM` | `tw-pod-hiker-m-01` | `passenger`, `scene-person` | `passenger`, `pickup`, `bystander`, `escort` |
| `tumbleweedPatientM` | `tw-pod-patient-m-01` | `passenger`, `scene-person` | `patient` |
| `tumbleweedWorkerM` | `tw-pod-worker-m-01` | `ground-crew`, `scene-person` | `ground_crew`, `homebase` |

Die Arbeitsdaten für Beschreibung, Rollen und Bewegungszuordnung liegen in `asset-tools/tumbleweed-person-integration.json`. Die Aufbereitung verwendet `prepare-tumbleweed-person.py` in Blender mit dem jeweiligen Datensatz als `VFR_PERSON_CONFIG`. Das Skript übergibt Stand- und Geh-Action sowie die geschätzte Schrittstrecke an den vorhandenen Generator `prepare-hiker-locomotion.py`. `VFR_HIKER_PROJECT` bezeichnet den Arbeitsordner, `VFR_HIKER_BASELINE` den normierten Eingangs-Export, `VFR_HIKER_OUTPUT` den Zielordner unter `Quellen/` und `VFR_PERSON_MASTER` die zentrale Blender-Masterdatei.

Für jede neue Figur entstehen drei LODs mit denselben Animationen. Die ursprünglichen Standclip-Namen bleiben in den Modelldateien erhalten. Der gemeinsame Clip `locomotion` enthält eine neutrale Beinpose unter der Standbewegung des Oberkörpers sowie Antritt, Gehschleife und Abstellen. Die XML benutzt die zu dieser Figur berechneten Framebereiche. Die Quellen enthalten PNG-Texturen im assetweiten `texture/`-Ordner und den Steckbrief `person-appearance.json`.

| Figur | Höhe in neutraler Pose | Radius einschließlich Ausrüstung | Geschätzte Meter pro Gehzyklus |
| --- | ---: | ---: | ---: |
| Freizeitfigur | 1,877 m | 0,371 m | 2,553 m |
| Wanderer | 1,792 m | 0,427 m | 2,592 m |
| Patient | 1,702 m | 0,498 m | 2,198 m |
| Arbeiter | 1,802 m | 0,307 m | 2,576 m |

Die Schrittstrecke wurde aus der mittleren Geschwindigkeit des Fußgelenks während bodennaher Bewegungsabschnitte und der Dauer der vollständigen Gehschleife geschätzt. Die Aufbereitung am 24.11.2026 verwendete die Einstellungen der Wanderin als Anfangswerte mit 3 kt Höchsttempo und 1,5 bis 2,8 kt Gehbereich. Die Abnahme dieser Werte im gemeinsamen Pack erfolgte am 25.11.2026 wie unten dokumentiert.

Die Prüfung am 24.11.2026 bestätigte für alle vier Rohquellen die Übereinstimmung von Katalog, Importmanifest und Steckbrief, gültige Modell- und Texturreferenzen sowie gleiche Animationsdaten und Bind-Matrizen über alle drei LODs. Die zentralen Blender-Master sind metrisch, enthalten drei LOD-Szenen und die gepackten Texturen. In der vorbereiteten neutralen Pose liegen die Fußgelenke in Höhe und Gehrichtung jeweils weniger als 1 mm auseinander. Der Vorabtest erkennt jetzt auch einen von der XML angesprochenen Clip, der in einem reduzierten LOD fehlt. Darauf folgten der unten dokumentierte SDK-Build und die lokale Installation. Der Sichttest für Antritt, Gehen, Abstellen, Texturen und LOD-Wechsel steht aus.

## Lokal installiertes SDK-Paket 0.6.27 vom 24.11.2026

Die fünf Personen sind in den kanonischen Publisher importiert. Das offizielle SDK hat das vollständige Pack mit 49 Assets und 471 Dateien gebaut. Der SDK-Fehlerbericht ist leer. Die Prüfung bestätigt alle 65 optimierten GLTF-Dateien des Gesamtpakets, 95 KTX2-Dateien mit Metadaten und die vollständige Übereinstimmung mit `layout.json`. Bei jeder Person sind alle drei LODs und ihre vollständigen Animationsclips geprüft.

Das Pack ist im erkannten MSFS-2024-Community-Ordner installiert. Jede installierte Datei wurde gegen den SHA-256-Wert im Paketindex geprüft. Der lokale Tracker-Katalog steht auf 0.6.27 und enthält alle fünf Personen mit ihren Aussehensdaten. Gegenüber 0.6.26 sind nur die vorgesehenen Personen geändert oder hinzugekommen. Die bisherige Installation und der Tracker-Katalog sind gesichert.

- Arbeits- und Prüfprotokolle liegen unter `C:/RohDaten/vfr-personen-sdk-20261124/`.
- Das vorherige Pack liegt unter `C:/Users/einhe/AppData/Roaming/Microsoft Flight Simulator 2024/Packages/vfr-personen-backup-0.6.26-20261124/`.
- Der vorherige Tracker-Katalog liegt unter `C:/RohDaten/vfr-personen-sdk-20261124/previous-active-package-index.json`.
- Die kanonischen Publisher-Daten samt Katalog vor dem Import liegen unter `C:/RohDaten/vfr-personen-sdk-20261124/publisher-before/`.

Die Installation vom 24.11.2026 war die Grundlage für die folgende Live-Abnahme.

## Live-Abnahme aller fünf Personen am 25.11.2026

Alle fünf Personen wurden gleichzeitig per SimConnect erzeugt und mit vier Metern Abstand aufgestellt. Jeder Lauf führte über einen eigenen, zwölf Meter entfernten Wegpunkt. In allen drei Läufen hielten alle fünf selbstständig an. Die Positionen und Geschwindigkeiten wurden ungefähr sekündlich erfasst.

| Solltempo | Höchste beobachtete Geschwindigkeiten der fünf Figuren | Abstand zum Wegpunkt beim Halt |
| --- | --- | --- |
| 1,5 kt | rund 0,758 m/s | 0,59 bis 0,60 m |
| 2,5 kt | 1,193 bis 1,197 m/s | 0,41 bis 0,43 m |
| 3,0 kt | 1,391 bis 1,409 m/s | 0,32 bis 0,35 m |

Der Anwender bestätigte nach der Prüfung von Antritt, Gang, Stopp, Standpose, Texturen und Modellwechseln „Alle fünf sehen gut aus“. Alle fünf wurden anschließend entfernt. SimConnect bestätigte `ObjectRemoved` für jede Object-ID. Im Beobachtungsfenster von vier Sekunden wurde keine der entfernten IDs erneut gemeldet. Hangar und Reisekoffer wurden ebenfalls erfolgreich erzeugt und entfernt.

`missionSpawnable` steht in den lokalen Quellen, im Publisher, im Paketindex und im lokalen Tracker-Katalog für alle fünf auf `true`. Für diese Paketversion sind die getesteten Solltempi als `testedWalkKts: [1.5, 2.5, 3]` erfasst. Die 471 installierten Paketdateien wurden erneut gegen den Index geprüft. Der Paketinhalt hat weiterhin den SHA-256-Inhaltshash `d5c4a4c6181f4f57c3cf2ce267a87d1f49be3f37c8dc347a6c7d99686b209ff3`.

Messreihen, Object-IDs und Sichtbefund liegen unter `C:/RohDaten/vfr-personen-sdk-20261124/live-all-persons-20261125.json`. Die zusammengefasste Freigabe steht in `person-live-acceptance.json` im selben Ordner. Der missionsbezogene Pax-Aufruf aus App und Tracker gehört zur anschließenden App-Integration.

Die folgenden Abschnitte dokumentieren den Eingang vom 15.11.2026. Bei der Korrektur vom 23.11.2026 sind die Freizeit-LODs tatsächlich reduziert und die XML-Dateien binden die vorhandenen Stand- und Gehclips ein. Die Aufbereitung ersetzt deren zeitgesteuerte Wiedergabe durch den oben beschriebenen Bewegungsablauf.

## Wanderin

Die Revision `tumbleweedHiker` 0.1.8 ergänzt `LOD01` und `LOD02` in der Rohquelle. Die bearbeitbare Blender-Masterdatei enthält beide Stufen in eigenen Szenen. `LOD00`, Textur, Modell-GUID und die bestehende Bewegungssteuerung stammen aus der abgenommenen 0.1.7. Alle drei Stufen verwenden die Clips der 0.1.7. Vor der Übernahme waren Gelenkhierarchie, Gelenktransformationen und inverse Bind-Matrizen der beiden neuen Stufen mit `LOD00` identisch.

| Stufe | Exportierte Vertices | Dreiecke |
| --- | ---: | ---: |
| LOD00 | 3.247 | 4.979 |
| LOD01 | 1.854 | 2.480 |
| LOD02 | 945 | 1.077 |

Der Vorabtest der Rohquelle und die Live-Abnahme am 25.11.2026 sind bestanden. `missionSpawnable` steht auf `true`. Die Modellwechsel wurden im Stand und beim Gehen geprüft; der Anwender meldete keine Auffälligkeiten. [Steckbrief](../Quellen/tw-pod-hikers/person-appearance.json)

## Vier neue Figuren

Die folgenden Beschreibungen und Werte sind Entwürfe anhand der gelieferten Modelle und der Sim-Aufnahme. `uses` nennt mögliche Einsätze für die spätere Auswahl. `props` erfasst Werte aus dem vereinbarten Vokabular. Die gelbe Decke des Patienten gehört ins Beschreibungsfeld.

| SimObject-Titel | `look`, `ageBand`, `season` | `props` | `uses` | `description` |
| --- | --- | --- | --- | --- |
| `tw-pod-casual-m-01` | `casual`, `adult`, `summer` | `[]` | `passenger`, `pickup`, `bystander`, `escort` | Grauhaariger Mann mit Vollbart, grauem Kurzarmshirt und dunkler Hose. |
| `tw-pod-hiker-m-01` | `outdoor`, `adult`, `all` | `backpack_large` | `passenger`, `pickup`, `bystander`, `escort` | Bärtiger Mann in grüner Kapuzenjacke, dunkler Wanderhose und Stiefeln mit großem Trekkingrucksack. |
| `tw-pod-patient-m-01` | `outdoor`, `senior`, `all` | `[]` | `patient` | Älterer Mann mit grauem Haar, dunkler Kleidung und gelber Decke über den Schultern. |
| `tw-pod-worker-m-01` | `workwear`, `adult`, `summer` | `[]` | `ground_crew`, `homebase` | Mann mit braunem Haar, schwarzem Kurzarmshirt und blauer Latzhose. |

| Figur | Gelieferter Standclip im Roh-GLTF | Gemessene maximale Auslenkung der Fußgelenke ab dem ersten Frame der Blender-Action | Nächster Schritt |
| --- | --- | --- | --- |
| Freizeitfigur | `look_around` | 17/22 cm | Oberkörperbewegung als Basis für `standing_relax` prüfen. Der erste Frame hat rund 21 cm Versatz zwischen den Fußgelenken in Gehrichtung. Für einen Parallelstand die Beine und Hüfte gezielt bearbeiten. Die drei gelieferten BIN-Dateien sind bytegleich. Echte LOD-Reduktion separat nachreichen. |
| Wanderer | `standing_relax` | 18/18 cm | Unterkörper für festen Stand prüfen und bei Bedarf korrigieren. |
| Patient | `idle` | 21/19 cm | `idle` als Basis für `standing_relax` prüfen, Füße stabilisieren und die mitgeriggte Decke auf Durchdringungen prüfen. |
| Arbeiter | `standing_relax` | 18/18 cm | Unterkörper für festen Stand prüfen und bei Bedarf korrigieren. |

Die Messung erfasst die Bewegung der Gelenke in drei Achsen. Für die Abnahme zusätzlich die Sohlen und den Schleifenübergang visuell prüfen. Die Quell-Actions in Blender sind länger als die 10,42 Sekunden der gelieferten Standclips im GLTF. Beim Export den vorgesehenen Framebereich je Action bewusst setzen und prüfen.

Bei allen vier Figuren referenziert die gelieferte Modell-XML `locomotion`. Die GLTF-Dateien enthalten jeweils nur den Standclip und `walk`. Für die Homebase-Integration je Rig einen vollständigen `locomotion`-Clip mit Stand, Antritt, Gehschleife und Abstellen erzeugen. Dazu die Fußkontakte am Modell prüfen, die Zyklusstrecke je Figur ermitteln und die XML an ihre tatsächlichen Clipbereiche koppeln. Anschließend die Rohquellen pro Figur nach Publisher-Struktur ablegen, die Texturen auf `texture/` mit den passenden PNG-Sidecars vereinheitlichen und den Steckbrief nach der finalen Standpose vermessen. [Integrationsleitfaden](HOMEBASE-INTEGRATION-ANIMIERTE-FIGUREN.md)
