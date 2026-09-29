# Gemeinsame räumliche POI-Szenenplanung

Stand 29.09.2026, für Alpha-App v1880 / Tracker v455 freigegeben.
Die räumlich korrigierte Reporter-Szene dient als technische Vorlage für neue
POI-Objektszenen. Übernommen wird die Gestaltungsmethode, nicht ihr Inhalt.

## Einstieg und Zuständigkeit

`composeMissionTargetSceneWithGemini` und `acceptMissionDraft` aktivieren für
POI-Kompositionen `poiScenePlacementVersion: "poi-placement.v3"` auf Mission
und Contract. Es gibt keinen neuen Missionsstart, Tracker-Trigger oder Voice-Layer.
APT, Bush und der dedizierte Fire-/Smoke-Pfad bleiben bei ihren bisherigen
Verfahren. Bereits gespeicherte ältere Szenen werden nicht neu komponiert.
Ein Plan ohne Zielobjekte bleibt ohne Zielobjekte.

Der gemeinsame Core heißt `MissionPoiScenePlacementCore`; aus Kompatibilität
existiert `MissionReporterSceneCore` als Alias derselben Implementierung in
`mission-reporter-scene-core.js`. Auch `reporterScene` im Composer-Kontext und
`targetGeoContext.reporterPlacement` sind historische Feldnamen, keine zweite
Implementierung und keine Beschränkung auf Reporter.

## Vertrag

1. Die gewählte Idee bzw. Geschichte, TaskDomain, Rollenprofil, SceneIntent und
   Missionsplan gehen gemeinsam an den bestehenden Composer. Er gestaltet
   Hauptobjekte und funktional zugehörige Gruppen. Ein Inspektionsauftrag bekommt
   dadurch keine Reporter-Veranstaltung; eine Suche keine bereits erfolgte Rettung.
2. Exakter POI als Ursprung, Heading 0: `forwardM` nach Norden, `rightM` nach Osten.
   Gerundete Orientierungsanker verschieben das Ziel nicht. Gruppenkoordinaten
   bleiben bis zu den erzeugten Simulator-Items erhalten.
3. `objectPolicy: "explicit-requirements"`, `placementVersion: "poi-placement.v3"`.
   Jedes Requirement enthält `feature`, eine zugehörige Katalog-`role`, `count`,
   `forwardM`, `rightM`, `siteId`, optional `surface`, `spacingM`, `hdgOffsetDeg`, `notes`.
   `placementIntent` benennt den räumlichen Zweck und erforderliche Befestigung;
   der erste Zweck bleibt als `placementRequirement` bei Korrekturen verbindlich.
   V2-Szenen bleiben lesbar und werden nicht automatisch neu geplant.
   Bei mehreren Objekten `cluster` oder `line`; komplexe Formen als Einzelobjekte.
   Keine nachträgliche Grundausstattung oder zufällige Material-Ersatzpools.
4. Katalogmetadaten `placementSurfaces`, `placementRadiusM` und bei Suchobjekten
   `primaryRole` definieren Eignung und Prüfung. Neue Assets hier ergänzen, nicht
   aus Modell-, Orts- oder Straßennamen ableiten. Pack-Eignung bleibt bei
   `missionSpawnable` plus `scene-prop` aus dem Homebase-Katalog.
5. OSM-Flächen und Linien werden lokal in Meterkoordinaten geprüft. `ground`
   nutzt kartierte Nutzungsflächen; `water` benötigt eine Wasserfläche, nicht
   bloß einen Flussnamen oder Mittelpunkt. `forest` ist nur für dafür geeignete
   Objekte zugelassen. `road` benötigt eine numerische kartierte Straßenbreite;
   ein geschlossener Straßenverlauf ist keine befahrbare Fläche im Inneren.
   Gebäude, Bahnen und inkompatible Flächen bleiben Hindernisse.
6. Kandidaten dienen der Planung, vollständige Geometrie der Prüfung.
   Wasser-Mittellinien innerhalb einer Wasserfläche sperren Boote nicht.
   Die Abfrage umfasst etwa 800 m um den POI, Offsets sind bis 750 m zulässig.
   `siteId` bindet jede Gruppe an ihre tatsächliche Nutzungsfläche; `surface`
   als OSM-Tag ist getrennt von der Objektoberfläche ground/water/forest/road.
   Unbekannte Befestigung bleibt unbekannt. Große Industriepolygone erhalten
   lokale `workAreas`: Punkte innerhalb 60 m, deren gesampelte Verbindungen
   keine kartierten Sperren schneiden. Das ist keine belegte Zufahrt. Zusammengehörige
   Gruppen sollen einen Bereich nutzen; mehrere Bereiche brauchen einen Zweck
   aus der gewählten Geschichte.
   Objektabstände berücksichtigen die katalogisierten Planungsradien.
7. Fehler werden innerhalb des begrenzten Composer-Laufs zur Korrektur gegeben.
   Die Prüfung gibt zusätzlich lokale, geometrisch geprüfte Korrekturvorschläge
   für fehlerhafte Gruppen zurück. Sie gelten gegen die übrigen unveränderten
   Gruppen, werden nicht automatisch angewendet und danach vollständig geprüft.
   Scheitert die Planung, bleibt die Mission ein erneut versuchbarer Entwurf;
   keine ungeprüfte Ersatzszene wird als Erfolg akzeptiert. SAR-Objektfamilien
   aus dem Plan dürfen nicht still entfallen. `missing_person` verwendet
   `sar.person_target`, `aircraft_wreck` verwendet `aircraft.wreck`.
8. Der bestehende Item-Builder prüft gespeicherte explizite Szenen nochmals.
   Feature-Namen bleiben in Item-Kennungen erhalten, einschließlich Suchzielen.

## Grenzen

Planungsradien sind konservative Annahmen, keine vermessenen Modellgrenzen.
Flächennutzung beweist keine freie Aufstellfläche, Walddaten enthalten keine
Einzelbäume und Satelliten-/Simulatorkulisse kann abweichen. Multipolygon-Relationen
werden noch nicht zusammengesetzt; schmale/unkartierte Flächen können deshalb
nicht ausreichend belegt sein. Der Composer darf diese Lücken nicht durch
Namensinterpretation füllen. Physische Sichtbarkeit, Geländeanpassung und
Kollisionen bleiben im Simulator zu prüfen.

## Nachweis und Wiederverwendung

`tools/mission-reporter-scene.test.cjs` deckt den gemeinsamen Vertrag, reale
Erlenbach-Geometrie, Land/Wasser/Wald/Straße, Rollen, Überlappungen, Suchziele,
passive Pläne und das Verhalten bei fehlgeschlagener Annahme ab.

`docs/examples/POI Scene Placement Cross Profile.json` protokolliert drei
Browser-Integrationstests mit dem tatsächlichen App-Normalizer und Item-Builder:
Infrastruktur auf aufgezeichneten Erlenbach-Kartendaten (zwei Objekte), Biologie
auf einer synthetischen Wasserfläche (Boot), SAR auf synthetischem Wald (Suchperson).
JSON-Roundtrip, erneute Normalisierung, Rollen, Ursprung und Offsets sind geprüft.
Diese drei Tests verwenden kontrollierte Composer-Ausgaben: keine neuen Gemini-
Generierungen und keine realen Simulator-Spawns. Die zuvor geprüfte Reporter-
Satellitenszene bleibt die visuelle Referenz.

Bei neuen Missionsfamilien deren eigenen Plan und SceneIntent weiterreichen.
Keine Inhaltskopie, kein neuer Startpfad und keine neue Platzierungsheuristik.

## Korrekturstand 29.09.2026: räumliche Eignung

Kartierte Enden großer unterirdischer Straßen am POI werden als `tunnel_end`
angeboten. `portal_access` benötigt eine kartierte Straßen-, Parkplatz- oder
Fußgängerfläche innerhalb 120 m des gewählten Endes. Eine Wiese über der Röhre
kann diesen Zweck nicht erfüllen. Auswahl erfolgt aus Tags und Geometrie,
niemals aus Namen wie Sommerbergtunnel. Nutzung und Befestigungsanforderung
dürfen bei einer Korrektur nicht auf einen bequemeren Standort wechseln.

Nur bei optionalen Reporter-Szenen: Gibt es im abgefragten Kandidatensatz keine
passende Fläche für den gewählten Zweck, liefert der Sanitizer ausdrücklich
`kind=none` und `debug.omissionReason`. Die Annahme zeigt diesen Grund. Das
beweist nicht, dass in der Realität keine Stellfläche existiert. Fehlerhafte
Koordinaten auf grundsätzlich geeigneten Flächen bleiben Fehler; sie werden
nicht durch diesen Weg als Erfolg kaschiert. Erforderliche SAR-Ziele bleiben
verbindlich. Der ursprüngliche journalistische Auftrag wird nicht umgeschrieben.

Der Gemini-3-Composer nutzt `thinkingLevel: low`, maximal 8000 Ausgabetokens
und weiterhin höchstens fünf Modellrunden einschließlich Werkzeugaufrufen.
Referenz: https://ai.google.dev/gemini-api/docs/generate-content/gemini-3
Keine zusätzlichen Missions-, Tracker- oder Voice-Auslöser.

Vier V3-Browserprüfungen verwenden den tatsächlichen Normalizer und Item-Builder:
Infrastruktur mit realer Erlenbach-Geometrie, synthetische Wasser-/Waldflächen
für Biologie/SAR und eine entfernte Industriefläche mit 600 m Offset. Rollen,
Koordinaten, `siteId`, Zweckbindung und JSON-Wiederherstellung bleiben erhalten.
Kein Gemini-Aufruf und kein physischer Simulator-Spawn in dieser Prüfung.

## Bittelbronn-Hotfix / App v1881

Der nach Veröffentlichung gemeldete Dorfmarkt-Fall wurde aus dem Diagnosebericht
rekonstruiert (kein vollständiger Originalzustand). Ein Live-Versuch reproduzierte
den Abbruch: wiederholte Kontextabrufe verbrauchten drei von fünf Runden; der
zusätzliche Asset-Katalog bot zudem `scattered` an, obwohl explizite Gruppen
nur `cluster` und `line` implementieren.

Explizite POI-Pläne bekommen jetzt ausschließlich diese beiden Gruppenmuster.
Nach dem vollständigen ersten Kontextpaket sind Folge-Toolaufrufe für diese
Pläne deaktiviert; die restlichen vier Modellrunden dienen Planung/Korrektur.
APT/Bush behalten ihre bisherigen Tool- und Arrangementmöglichkeiten. Keine
lockereren Geometrieprüfungen, neuen Flächentypen oder Bittelbronn-Sonderregeln.

Im korrigierten Live-Versuch: vier Modellaufrufe, sechs gültige Objekte auf
einer kartierten Fußgängerfläche (ein Pavillon, zwei Personen, drei Kegel).
Der ursprüngliche Umfang wurde auf die vorhandene Fläche reduziert. Keine
Simulator-Sichtprüfung und kein Nachweis einer allgemeinen Erfolgsquote.
Beleg: `docs/examples/POI Reporter Bittelbronn Regression 20260929.json`.

Fehlgeschlagene Kompositionen behalten letzte KI-Szene, Korrekturfehler und
Toolaufrufe. Der Diagnosebericht bevorzugt den aktuellen Missionszustand vor
dem älteren Entwurfssnapshot, damit künftige Reports die Ablehnung ausweisen.
