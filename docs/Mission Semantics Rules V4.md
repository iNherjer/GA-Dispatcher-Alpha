# Mission Semantics Rules V4

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

- Transport, Begleitung, Uebergabe oder Training bleiben Primärzweck.
- Umfeld darf nur Plausibilisierung und Ankunftskontext liefern.
- Kein Drift zu POI-Arbeitsauftrag.
- Eine vor dem Writer fixierte Passenger-Party muss mit exaktem Count und Label
  erhalten bleiben. Die benannte Hauptperson bleibt die einzige Voice-Persona;
  weitere Gruppenmitglieder erhalten keine erfundenen Namen oder Nebenauftraege.
- `club_utility` erzeugt keine Vereinsgruppe. Ein Vereinsausflug ist eine
  Charter-/Reise-Party und kein Utility-Einsatzzweck.

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
