# Mission Semantics Rules V4

Aktuelle private Erzählversion: [Mission Episode Writer V6](Mission%20Episode%20Writer%20V6.md). V5 bleibt als auswählbare Referenz erhalten; V6 ergänzt KI-verfasste JSON-Erinnerungen und eine freie Erzählform auf Basis einer strukturierten Episode.

Diese Regeln gelten nur fuer die `V4`-Pipeline. `V3` bleibt unveraendert.

Ziel:

- Drift zwischen Zielobjekt, TaskDomain, Story und Szene verhindern
- Kontextanker nutzbar machen, ohne den Missionskern umzubiegen
- `apt`, `poi` und `bush` mit denselben Grundprinzipien absichern

## 1. Kernprinzip

Der gewaehlte Zieltyp und die TaskDomain definieren den Primärfokus.

- Das Ziel bleibt das Hauptsubjekt der Mission.
- Die TaskDomain bleibt die Art des Auftrags.
- Geo-Kontext darf nur ergaenzen, nicht umwidmen.

Kontext darf nur diese Rollen haben:

- `orientation`
- `hazard`
- `access`
- `support`
- `evidence`
- `background`

Kontext darf nicht:

- das Primaerziel ersetzen
- die TaskDomain umdeuten
- aus einer Natur-/SAR-Lage eine Infrastrukturinspektion machen
- aus einer Brueckenmission eine Stadt-/Strassen-/Wassermission machen
- aus einem Lern-/Sightseeing-Flug einen Einsatz- oder Wartungsauftrag machen

## 2. Fokus-Lock nach Missionstyp

### `poi`

- Das ausgewaehlte POI-Subjekt bleibt das Hauptsubjekt.
- Nearby-Anker duerfen nur Lagekontext, Hindernis oder Orientierung sein.
- Kein Nebensubjekt darf das POI semantisch ersetzen.
- Bei `sceneKind=none` bleibt die Weltkulisse passiv; es wird kein neuer Arbeitsauftrag konstruiert.

### `apt`

- Der Zielflugplatz und der dortige Anlass bleiben der Fokus.
- Stadt, Strasse, Industrie oder Landschaft am Rand duerfen den Auftrag nicht ersetzen.
- Luftarbeit am Ziel nur, wenn Profil und Plan das ausdruecklich tragen.

### `bush`

- Strip, Wildnisziel oder Bush-Area bleiben das Primärziel.
- Zufahten, Flussarme, Waldsaeume oder Camps duerfen nur den Hintergrund und die Logistik plausibilisieren.
- Kein Drift zu normalem A-B- oder Technikauftrag.

## 3. Fokus-Lock nach TaskDomain

### `search_and_rescue`

- Primärfokus ist Suchlage, Suchraum oder Rettungslage.
- Natürliche oder lagebezogene Suchanker haben Vorrang.
- SAR nutzt eine interne Incident-Familie als Fokus-Lock innerhalb der TaskDomain.
- Die Incident-Familie wird aus Zielkategorie, Lage-Evidenz, `targetGeoContext`, `missionTruth` und History abgeleitet.
- Lage-Evidenz hat Vorrang vor Varianz-History; History verhindert Wiederholung, darf aber starke Zielhinweise nicht umdeuten.
- Die gewaehlte Familie muss Story, Writer-Text, `sceneIntent` und Zielobjekte konsistent halten.
- Bei Luftfahrzeuglagen muss die Zielszene ein Flugzeug-/Wrackobjekt als Primaerbefund nutzen, sofern dieser Baustein verfuegbar ist. Allgemeines Debris oder Rauch sind Zusatzhinweise und duerfen die Luftfahrzeuglage nicht ersetzen.
- Strassen, Strommasten, Gebaeude, Parkplaetze oder Leitungen sind nur:
  - Orientierung
  - Hindernis
  - Zugang fuer Bodenkraefte
  - Support-/Perimeterpunkte
- Ausnahme innerhalb von SAR: Wenn die Incident-Familie `road_collision` oder `vehicle_off_road` ist, darf die Strasse selbst Einsatzort und Primaerfokus sein.
- `road_collision` und `vehicle_off_road` duerfen nicht im Briefing zu einer unscharfen Mischlage verschmelzen.
- `lastSeenContext` ist fachlich breit zu lesen: letzte Sichtung, letzte Meldung, letzte Ortung, letzter Funkkontakt oder letzter plausibler Bericht.
- Kein Drift zu Inspektion, Vermessung oder Infrastrukturwartung.

### `inspection_infra`

- Infrastruktur darf Primärfokus sein.
- Support-Kontext bleibt sekundär.
- Diagnose, Wartung, Schaden oder Dokumentation duerfen die Story tragen.

### `mapping_survey`

- Das gewaehlte Zielobjekt oder Zielgebiet bleibt Hauptsubjekt.
- Sichtbare Supportmarker duerfen Datenaufnahme plausibilisieren.
- Keine Einsatz- oder SAR-Umdeutung ohne klare Lagebasis.

### `news_coverage`

- Es geht um Beobachtung, Einordnung und Berichterstattung.
- Kontext kann den Anlass konkretisieren.
- Jeder News-Winkel braucht eine kleine erzählte Lokalgeschichte aus Zieltyp, sichtbaren Ankern, Persona und Ausrüstung. Das Briefing darf nicht nur Planfelder wie "Meldung", "Lage", "Aufhänger", "Umfeldlage" oder "Lageeinschätzung" umformulieren.
- News-Missionen brauchen einen berichtenswerten Kern: Headline, Vorfall, Event oder mediale Dokumentation. Der konkrete Kern soll frei aus Zieltyp, sichtbaren Ankern, Persona und Ausrüstung entstehen, nicht aus einem festen Motiv- oder Event-Katalog.
- Der erste inhaltliche Story-Satz muss den erfundenen Anlass selbst benennen. Eine reine Meta-Erzählung wie "die Redaktion braucht Bilder", "klarer Ort des Geschehens", "Rahmen für die Geschichte" oder "Lage einordnen" ist kein fertiges News-Briefing.
- Bei POI-News bleibt der gewählte POI der Ort des Geschehens. Kontextanker dürfen die Story tragen helfen, aber Ziel, Rolle und Auftrag nicht ersetzen.
- Bei APT-News bleibt der Zielflugplatz ein A-B-Ziel. Die Story wartet nach der Landung am Boden: Reporter, Kamera oder Live-Rucksack werden zu einer headline-tauglichen Sache am Airport gebracht, nicht zu einem Überflug- oder Luftbildauftrag.
- Bei Straßen-, Tunnel- oder Zufahrts-POIs sind Straße, Tunnel, Zufahrt, Parkdruck, Rückstau oder Wege nur sichtbare Belege, nicht automatisch die Story. Sie dürfen nicht zur technischen Betriebs- oder Infrastrukturprüfung werden.
- Ein gutes POI-News-Briefing beantwortet nicht immer alles vollständig, aber es sollte spürbar machen: Warum heute? Warum genau dieser POI? Warum hilft der Luftblick? Was macht die Redaktion danach mit Bildern, Notizen oder Einordnung?
- Ein gutes APT-News-Briefing beantwortet stattdessen: Warum heute? Warum genau dieser Zielflugplatz? Welche Schlagzeile, welcher Aufreger, welches Platzgerücht oder welches kuriose Bildmotiv wartet am Boden? Was macht die Redaktion direkt nach der Landung?
- Kein Drift zu Technikinspektion, SAR oder Einsatz, wenn das nicht der berichtete Kern ist.

### `poi_learning_guide`

- Ziel, Gegend, Nutzung, Landschaft und bestaetigte Landmarken werden erklaert.
- Landmarken sind Orientierung, nicht neuer Arbeitsauftrag.
- Kein Drift zu Einsatz-, Technik- oder Vermessungsmission.

### `historian_guided_tour`

- Historische Einordnung bleibt Hauptzweck.
- Bestaetigte Bauwerke, Wege, Trassen oder Siedlungen duerfen nur den historischen Kontext stuetzen.
- Kein Drift zu operativer Luftarbeit.

### `sightseeing_tour`

- Aussicht und ruhige Beobachtung bleiben der Fokus.
- Kein nachtraeglicher Arbeits- oder Einsatzauftrag.
- Eine Sightseeing-Gruppe aendert nur Party-Narrativ und Personenzahl, nicht
  Ziel, TaskDomain oder Ablaufklasse.

### `cargo_fragile`, `medical_transfer`, `animal_transport`, `charter`, `club_utility`, `training`

Für neue strukturierte `club-idea.v1`-Missionen gilt die fachliche Erweiterung aus [Vereins-/Utility-Ideen V1](Mission%20Club%20Utility%20Ideas%20V1.md): Vereinsleben, persönliche Interessen und gegenseitige Hilfe dürfen den Anlass tragen. Eine Lieferung ist optional. Die KI entscheidet die Idee vor Persona und Gepäck; anschließend bewahrt der A-B-Vertrag diese Entscheidung. Alte cargo-/wortbasierte Vereins-Heuristiken dürfen solche Verträge nicht umdeuten oder ihre Prosa ersetzen. Die bestehende Gruppenlogik wird damit nicht erweitert; genau ein mitfliegender Vereinskollege als Teammitglied, auch bei Lieferungen. Anlass und Initiative dürfen beim Piloten liegen; eine eigene Nebenhandlung des Kollegen ist nicht erforderlich. Persönliches Gepäck erzeugt keine Pflichtlieferung, explizite Lieferladung behält Pflichtentladung. Andere Profile behalten die folgenden Regeln.

- Transport, Begleitung, Uebergabe oder Training bleiben Primärzweck.
- Umfeld darf nur Plausibilisierung und Ankunftskontext liefern.
- Kein Drift zu POI-Arbeitsauftrag.
- Eine vor dem Writer fixierte Passenger-Party muss mit exaktem Count und Label
  erhalten bleiben. Die benannte Hauptperson bleibt die einzige Voice-Persona;
  weitere Gruppenmitglieder erhalten keine erfundenen Namen oder Nebenauftraege.
- `club_utility` erzeugt keine Vereinsgruppe. Ein Vereinsausflug ist eine
  Charter-/Reise-Party und kein Utility-Einsatzzweck.

### `private_outing`

Ausführlicher Datenfluss, History-Budget, Grenzen und Migrationsanleitung: [Mission Story Planner V5](Mission%20Story%20Planner%20V5.md).

- KI-Privatmissionen mit V4-Contract nutzen `private-outing.v1` unabhängig vom V4-/V5-Writer-Schalter.
- `mission-private-outing-core.js` definiert den strukturierten Ideenvertrag. Ein erster KI-Schritt entscheidet gemeinsam über Anlass, persönliche Motivation, Zielbezug, ersten Schritt am Boden, Person und persönliches Gepäck. Der zweite Schritt erzählt diese Entscheidung als Briefing und Greeting.
- Der V6-Picker plant drei vollständige Ideen in einem gemeinsamen Aufruf. Die ausgewählte `private-proposal.v1`-Idee wird mit ihren ursprünglichen Fakten-IDs direkt an den Writer übergeben; Start/Ziel werden erneut geprüft, Flug-/Wetterwerte kommen aus dem aktuellen Dispatch. Ungewählte Angebote sind keine History-Einträge. V5-/Offline-Picker bleiben im bisherigen Pfad.
- Ein strukturierter `private-outing.v1`-Vertrag mit `taskDomain=private_outing` hat Vorrang vor der alten APT-Textklassifikation und Charter-Personalisierung. Private Prosa darf dadurch keine Charter-Rolle auslösen; die Klassifikationsregeln anderer Missionsarten bleiben unverändert.
- Aufgabe und Ablauf bleiben code-seitig `private_outing` / `A-B`. Es gibt keine Ableitung einer Freizeitaktivität oder Beziehung aus Story-Stichwörtern. Alte Profile, Titelschablonen und Private-Outing-Sanitizer dürfen die neue Story nicht umschreiben.
- Ortswissen für Privatmissionen wird seit v5.7 über einen eigenen räumlichen Leser der POI-Tiles und eine neutrale Wikipedia-Umgebungssuche geladen (bis 50 km, acht Anker). Der vorhandene APT-Sightseeing-Resolver bleibt für andere Profile erhalten. Nur akzeptierte Fakten werden der Ideen-KI mit IDs übergeben; der Writer erhält die ausgewählten Fakten. Die Text-API besitzt in diesem Pfad kein eigenes Suchwerkzeug. Persönliche Vorgeschichten und plausible Anlässe dürfen bewusst erfunden werden; als tatsächlich recherchierte Angebote oder Termine gelten nur mitgelieferte Belege.
- Persönliche Verbundenheit und die Freude am gemeinsamen Flug sind vollwertige Reisegründe. Ortsfunde sind optionales Material; keine Pflichtattraktion. `groundPlan` trennt Zielflugplatz und gegebenenfalls gewählten Ausflugsort, dessen Koordinaten der Code innerhalb des Suchradius prüft.
- `creativeBasis` trennt im Ideenkern den realen Ortsanker vom bewusst erfundenen Anlass. Plausible fiktive Aktivitäten, Wettbewerbe und Angebote sind zulässig. Belegte Veranstaltungen können ab Anflugdatum bis Sonntag derselben Woche gewählt werden; `eventVisit` hält Termin und Aufenthalt getrennt vom Anflug fest. Die App besitzt noch keinen automatischen Veranstaltungskalender.
- `ga_private_outing_history_v1` speichert lokal die letzten zwölf erzeugten Entwürfe: Anlass, Motivation, Zielbezug, Person, Beziehung, Titel, Textanfang/-ende sowie kurze Beschreibungen von Tätigkeit, Motivation, Miteinander und Dramaturgie. Der JSON-Payload ist zusätzlich auf 64 KiB (UTF-16-Schätzung) begrenzt. Beide KI-Schritte erhalten die History als weiche Variationshilfe. Sie wird nicht aus dem Logbuch oder aus privaten Kontaktdaten aufgebaut; sie ist nicht geräteübergreifend synchronisiert.
- Strukturprüfung kontrolliert Pflichtfelder, Ziel, Faktenreferenzen, Gepäckgewicht und Ausgabeformat. Sie beweist keine semantische Korrektheit freier Prosa. Vielfalt und Sprachqualität müssen zusätzlich mit echten KI-Serien bewertet werden; Stub-Tests liefern dafür keinen Nachweis.
- Ist die Idee ungültig oder nicht verfügbar, wird die Generierung abgebrochen. Scheitert nur der Schreibschritt, bleiben die beiden bereits generierten Ideensätze als gekennzeichneter Fallback erhalten. Keine neue Zufallsmission als Ersatz.
- Passenger-Voice übernimmt Anlass und nächsten Schritt aus derselben Idee. Eine dekorative Vorfeldszene begründet keine neue Abholung oder andere Unternehmung.
- Bestehende Offline-/Legacy-Missionen ohne den versionierten Ideenvertrag behalten ihren bisherigen Pfad.

### `fire_watch`

- Rauch-/Brandbeobachtung bleibt Fokus.
- Wald-/Hang-/Offenflaechenkontext darf tragen.
- Keine Umdeutung zu allgemeiner Infrastrukturlage.

## 4. Fokus-Lock nach Zielkategorie

### `bridge`

- Bruecke bleibt Primärsubjekt.
- Strasse, Bahntrasse, Wasser, Ufer, Zufahrt oder Ort sind nur Kontext.
- Frei waehlbare Auftragsart ist erlaubt, aber der Brueckenfokus bleibt bindend.

### `water`

- Wasserkante, Ufer, Damm, Wasserlauf oder Gewaesser bleiben Primärsubjekt.
- Boote, Wege, Gebaeude oder Vegetation bleiben Kontext, ausser sie sind explizit der Auftrag.

### `mountain`, `forest`, `terrain`

- Naturraum bleibt Primärsubjekt.
- Infrastrukturanker duerfen nur Orientierung oder Hindernis sein.

### `city`, `castle`, `historic`

- Die gewaehlt​e Orts-/Bauwerksidentitaet bleibt Primärsubjekt.
- Umliegende Strassen, Bahnlinien oder Aussichtspunkte bleiben Orientierung.

## 5. Planner-Anforderungen

Der `V4`-Planner muss:

- `primaryObjective` an Primärsubjekt + TaskDomain binden
- `localFacts` so formulieren, dass Kontext nur Nebenrolle hat
- `operationalDetails` ohne Themenwechsel schreiben
- `mustAvoid` um Driftrisiken ergaenzen
- `placementPolicy` und `sceneKind` so formulieren, dass Ziel und Kontext dieselbe Lage meinen

## 6. Writer-Anforderungen

Der `V4`-Writer muss:

- Story, Greeting und `sceneIntent` am Primärfokus ausrichten
- Kontext als Orientierung, Hindernis oder Support formulieren
- keinen neuen Auftrag aus Sekundärankern ableiten
- benannte Nebenanker nur dosiert und nie dominierend einsetzen

### `private_return`

- Eigene private APT-Fortsetzung nach belegtem erfolgreichem Hinflug, regulär B -> A.
- Begleitung, Beziehung, Unternehmung und Heimatplatz kommen aus dem Quellvertrag.
- Der Aufenthalt wird als gemeinsames Erlebnis erzählt; der Rückflug steht bevor.
- Briefing und Voice benutzen denselben strukturierten Erlebnisrückblick.
- Keine neue freie Ausflugsidee, Charter-Personalisierung oder Bush-Pickup-Phasen.
- Bestehende APT-Gates und frische Flug-/Wetterwerte bleiben maßgeblich.
- Umsetzung und Grenzen: [Mission Private Return V1](Mission%20Private%20Return%20V1.md).

### Optionale Vereins-Sidequests (v1.7, 15.09.2026)

`narrativeEvents` dürfen persönliche und fachliche Tätigkeiten als ergänzende Voices tragen. Hauptaufgabe bleibt der A-B-Flug zum Ziel mit seinen bestehenden Bedingungen. Diese Sidequests erzeugen keine überprüfbaren Aufgaben, Pflichtaktionen, Erledigt-Zustände, zusätzlichen Wegpunkte oder neuen Manifest-Pflichten. Ausgelassene Voices beeinflussen Erfolg und Abschluss nicht. Ein technischer Inhalt allein ist keine TaskDomain-Drift; erst eine zusätzliche verbindliche Flugaufgabe würde den Vertrag verändern. Reale externe Befunde bleiben faktengebunden. Siehe [Routen-Voice-Vertrag](Mission%20Route%20Voice%20Events.md).
