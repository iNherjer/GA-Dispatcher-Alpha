# Mission Episode Writer V6

Für den aktuellen konzeptionellen Überblick und die Übertragung auf weitere Missionsarten: [Mission Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md). Die folgenden Abschnitte enthalten zusätzlich die Versions- und Versuchshistorie; isolierte Suchversuche sind ausdrücklich keine produktive KI-Suche.

Stand: 14.09.2026. Referenzprofil: `private_outing`. Vorversion: [Story Planner V5](Mission%20Story%20Planner%20V5.md).

## Ziel und Versionsgrenze

Private Missionen sollen persönliche Vorflugbriefings sein. Ein konkreter gemeinsamer Wunsch trägt die Geschichte; der Flug und das Vorhaben am Ziel stehen noch bevor. Der Flug kann selbst das Erlebnis sein, gemeinsame Zeit ermöglichen oder zu einem Vorhaben in der Umgebung führen. Ein reichhaltiger Ortskontext macht eine Besichtigung nicht obligatorisch. Plausible fiktive Aktivitäten und atmosphärische Ausschmückungen sind ausdrücklich zulässig; Identität und Geografie realer Orte sowie technische Missionsdaten bleiben verbindlich.

V6 lebt in `mission-private-episode-v6.js`. Die V5-Prompts, Validierung und History in `mission-private-outing-core.js` bleiben als auswählbare Referenz erhalten. V6 verwendet daraus nur Rahmen-/Formatierungshelfer und die Kalenderwochenberechnung; seine Ideenvalidierung ist eine eigene Version. Änderungen an gemeinsamen Helfern benötigen weiterhin Regressionstests beider Versionen.

In den Debug-Einstellungen schaltet **Privat V6 / Privat V5** über `ga_private_story_writer_version` die Version für neue private Ausflüge um. Ohne Einstellung ist V6 aktiv. Andere Missionsprofile behalten ihre bisherige globale Writer-V4/V5-Auswahl. Die bereits erzeugte Mission trägt ihre Version in `privateOuting.writerVersion = private-v6`; ein späterer Schalterwechsel schreibt sie nicht um.

`privateOuting.schema = private-outing.v1` bleibt der technische Vertrag zu Profil, Runtime, Quota-Speicherung und Voice. Writer-Version und technischer Vertrag sind verschiedene Dinge. V6 führt keine neuen Runtime-Aufgaben ein.

## Datenfluss und Autorität

1. Bestehender technischer Contract liefert A-B-Route, Ziel, PAX-Rahmen und Wetter. Die private Umfeldsuche liefert begrenzte Ortsfakten mit Koordinaten und Quellen. Keine zusätzlichen Suchanfragen durch V6.
2. Der Ideenaufruf wählt Personen, Anlass, Absichten, Bodenplan und gegebenenfalls einen belegten Veranstaltungstermin. `episode` hält die gegenwärtige Situation, gemeinsame Absicht und Bedeutung des Fluges fest. Der Planner gibt keine literarische Satzfolge mehr vor.
3. Die Ideenvalidierung prüft das JSON: identisches Ziel, erforderliche Felder, ein erwachsener Begleiter laut Prompt, passende Gepäckgrenzen, bekannte Faktenreferenzen, Ortsradius und gegebenenfalls Wochenfenster. Das Alter wird nicht aus einem Namen rekonstruiert oder unabhängig bewiesen. Ungültige Ideen stoppen die Generierung.
4. Der Writer erhält die validierte Idee und die History. Er entscheidet Einstieg, Nähe, Rhythmus und Schluss. `title`, `story`, `greeting` und `memory` entstehen zusammen im zweiten API-Aufruf.
5. Formale Prosa- und Memory-Prüfung sind unabhängig. Die gemeinsame Integration in `fetchPrivateOutingStory` übernimmt Personen, Gepäck, StoryFrame und Voice-Kontext aus derselben Idee. Erinnerung darf keine Missionsdaten oder Erfolgskriterien überschreiben.
6. Die tatsächlich verwendete Writer-Erinnerung wird mit dem erzeugten Entwurf gespeichert. So beeinflussen auch erneut gewürfelte Entwürfe die nächste Idee. Vollständige Briefings werden für diese History nicht archiviert und nicht per Regex klassifiziert.

Zwei logische KI-Aufrufe bleiben zwei. Bestehende Provider-Retries sind davon unabhängig. Die Erinnerung benötigt zusätzliche Ausgabetokens und wird später als kurzer Kontext an beide Aufrufe mitgeschickt; sie ist nicht kostenlos, benötigt aber keinen dritten Aufruf.

## Schemas

Die Idee behält die V5-Vertragsfelder (`targetName`, `occasion`, `personalReason`, `destinationConnection`, `firstStep`, `pilotIntent`, `companionIntent`, `storyIdentity`, `creativeBasis`, `factIds`, `groundPlan`, `eventVisit`, `companion`, `luggage`, `noveltyReason`). Anstelle von `narrativePlan` kommt:

```json
{
  "episode": {
    "situation": "Gegenwärtige persönliche Situation",
    "sharedIntent": "Was die beiden miteinander möchten",
    "flightRole": "Bedeutung des Fluges für diese Episode"
  }
}
```

Die Writer-Antwort ist **ein JSON-Objekt**, nicht Prosa mit angehängtem zweiten JSON und nicht doppelt serialisiertes JSON:

```json
{
  "title": "Titel",
  "story": "Sichtbares Briefing",
  "greeting": {"speaker": "companion", "addressee": "pilot", "text": "Begrüßung"},
  "memory": {
    "schema": "episode-memory.v1",
    "summary": "Kurze Zusammenfassung der tatsächlich erzählten Episode",
    "activity": "Tätigkeit",
    "motivation": "Menschlicher Anlass",
    "flightRole": "Rolle des Fluges",
    "relationshipDynamic": "Wie die Personen miteinander umgehen",
    "opening": "Funktion des tatsächlichen Einstiegs",
    "rhythm": "Sprachrhythmus des Textes",
    "ending": "Funktion des tatsächlichen Schlusses",
    "distinctivePhrase": "Kurze charakteristische Originalformulierung"
  }
}
```

`opening` und `ending` beschreiben die Erzählweise, statt geplante Regieanweisungen zu wiederholen. `distinctivePhrase` hilft dem nächsten Writer beim Erkennen wiederkehrender Formulierungen. Der Code speichert diese KI-Felder nach Strukturprüfung; er extrahiert keine Sätze und versucht nicht, sie semantisch nachzubauen. Technische Metadaten (`id`, `name`, `relationship`, `target`) kommen aus dem validierten Missionskern, nicht aus der freien Zusammenfassung.

## History, Speicher und Ausfälle

- V6-Schlüssel: `ga_private_episode_history_v1`, lokal in dieser Browser-Origin auf diesem Gerät. Die History ist nicht Teil des Cloud-Sync-Payloads. Die aktive Mission kann ihre einzelne `writerMemory` im bestehenden Missionsobjekt mitführen; daraus wird auf anderen Geräten keine History-Serie rekonstruiert.
- Höchstens zwölf Einträge und zusätzlich maximal **32 KiB** JSON-Payload nach UTF-16-Schätzung (`JSON.stringify(rows).length * 2`, inklusive Escaping). Browserinterner Overhead und Key sind nicht darin enthalten. Bei Bedarf fallen mehr alte Einträge heraus. Kein unbegrenzt wachsendes Missionsarchiv.
- Feldlimits: summary 240, activity 100, motivation 120, flightRole 100, relationshipDynamic 120, opening 160, rhythm 120, ending 160, distinctivePhrase 120 Zeichen. Alle Erinnerungsfelder müssen nichtleere Strings sein. Die Speicherung normalisiert Leerraum und begrenzt die Länge pro Feld; eine längere KI-Zusammenfassung verwirft nicht die ganze Erinnerung. Dies ist formale Kürzung, keine inhaltliche Rekonstruktion. Unbekannte Felder werden verworfen.
- ID-Deduplizierung verhindert doppeltes Anhängen derselben Mission. Neue Einträge verdrängen die ältesten. Reload erhält die History; gelöschte Website-Daten entfernen sie.
- V5 behält seinen eigenen Store (maximal 64 KiB). V6 liest daraus nur vorhandene strukturierte Planfelder als `legacy-plan`, solange die zwölf Kontextplätze nicht schon durch V6-Einträge belegt sind. Keine Prosa-Rekonstruktion, keine Mutation der V5-History. V5 liest umgekehrt keine V6-History. Ein Versionswechsel dient dem Vergleich, nicht einer automatischen Zusammenführung beider Speicher.
- Beschädigtes History-JSON führt zu leerer V6-History. Ein Speicherfehler verhindert die Mission nicht und wird gemeldet.
- Gültiges Briefing mit fehlender/ungültiger Erinnerung bleibt gültig, `memoryStatus=unavailable`; es entsteht kein V6-History-Eintrag und kein zusätzlicher Reparaturaufruf. Dadurch kann die nächste Generierung diesen Entwurf vergessen. Das ist eine sichtbare Qualitätsgrenze, kein Anlass zum Erfinden einer Zusammenfassung durch den Code.
- Ungültige Prosa: vorhandene Ideensätze bilden den kurzen Fallback. Eine zur abgelehnten Prosa gelieferte Erinnerung wird nicht gespeichert. Ungültige Idee: Fehler statt neuer Standardmission.

Die History wird als Datenkontext an den ausgewählten KI-Anbieter übertragen. Sie ist kein dauerhaftes Gedächtnis des Modells. Ihre freie Zusammenfassung kann inhaltlich ungenau sein; Strukturvalidierung beweist keine semantische Übereinstimmung. Stichproben müssen deshalb Story und Memory gemeinsam lesen. Erinnerung setzt keine Regeln für kommende Missionen.

## Warum Vielfalt nicht mit einer Verbotsliste gelöst wird

Die bisherige Serie zeigte wiederholt denselben menschlichen Mechanismus: frühere Hilfe, Flug als Dank, Zielprogramm, angenehmer Abschluss. Andere Namen und Sehenswürdigkeiten änderten daran wenig. V6 setzt deshalb früher an: gegenwärtige Situation und gemeinsame Absichten statt einer Pflicht zur Begründung, Satzform aus der Episode statt vorgegebener `narrativePlan`, Erinnerung an die tatsächlich verwendete Form statt geplanter Stil-Etiketten.

Es gibt keine feste Rotation von Aktivitäten, keine nachträgliche Phrasen-Sperrliste und keine zwingenden Dramaturgie-Kategorien. Wiederkehrende Figuren können sinnvoll sein, wenn eine weitere Episode mit ihnen entsteht. Namen und Beziehungsmuster stehen in der History, damit das Modell Wiederholung bewusst behandeln kann. Dies verbessert die Grundlage, garantiert aber keine unbegrenzte Vielfalt.

## Wiederverwendbare Vorlage für weitere Missionsfamilien

Vor einer Übertragung diese Entscheidungen ausdrücklich treffen:

1. **Technischer Rahmen:** Welche Route, Rolle, Zuladung und Erfolgskriterien gehören bereits dem Core? Welche davon darf eine Erzählung niemals ändern?
2. **Ideeninhalt:** Welche wenigen strukturierten Felder beschreiben die Situation und Absichten dieser Missionsfamilie? Fachliche Rollen aus dem Vertrag übernehmen, nicht aus Prosa bestimmen.
3. **Ortswissen und Fiktion:** Welche Quellen stehen tatsächlich zur Verfügung? Welche Details dürfen plausibel erfunden werden? Zeitfenster, Radius und Quellen als Daten definieren.
4. **Writer-Freiheit:** Welche Inhalte bleiben fest, welche persönliche Ausgestaltung und Erzählform darf der Writer frei wählen? Beispielplots nicht als wiederkehrende Produktionsvorgaben einbauen.
5. **Gemeinsame Antwort:** Sichtbaren Text, benötigte Voice-Rollen und kurze Memory als getrennte Felder desselben JSON liefern. Memory beschreibt den finalen Text, keine neuen Missionsdefinitionen.
6. **Speicheretat:** Historienbereich, Feldlimits, Gesamtgröße, Deduplizierung und gegebenenfalls Cloud-Merge vorab festlegen. Nicht pro Familie unbemerkt ein großes Archiv erzeugen.
7. **Fehlergrenzen:** Fehlende Idee, fehlende Prosa, fehlende Erinnerung und Speicherfehler getrennt behandeln. Gute Prosa nicht wegen schlechter Metadaten verwerfen.
8. **Version und Vergleich:** Eigene Version und auswählbare Vorversion; identische Testkontexte; Rohtext, sichtbaren Text, Erinnerung und technische Daten zusammen vergleichen. Erst danach andere Profile aktivieren.

Eine Übertragung auf gemeinsame Klassifikatoren, Profilverträge oder Parser ist eine separate Änderung mit vorheriger Impact-Prüfung gemäß AGENTS.md. V6 ist keine globale Writer-Migration.

## Prüfungen

```sh
node --test tools/mission-private-outing.test.cjs tools/mission-private-context.test.cjs tools/mission-private-episode-v6.test.cjs
node tools/mission-pipeline-dryrun.mjs --private-story-cases=analysis/private-outing-v5-7-discovery-cases.json --private-writer=v6 --runs=6 --out=private-outing-v6-stub.json
```

24 Tests decken V5-Regressionsfälle, Ortsradius/Cache, tatsächliche Zwei-Aufruf-Integration, fehlende Memory, Prosa-Fallback, Quota-Speicherung, Historiengrenzen, Legacy-Lesen und V5-Rollback ab. Synthetische Antworten prüfen die Integration, nicht die literarische Qualität. Der vollständige Dryrun `analysis/private-outing-v6-integration.json` prüft zusätzlich die bestehende Missionsintegration mit Stub-Antworten.

Für Livevergleiche denselben gespeicherten Kontext verwenden und `--live-gemini` ergänzen; `--private-writer=v5` wählt die Referenz. Die sechs Kontexte enthalten drei EDTW- und drei EDTF-Ziele, ohne Aktivitätsvorgaben. Gemeinsame History über die Serie, unabhängige leere History zu Serienbeginn. Liveausgaben gemeinsam auf menschliche Motive, Namen, tatsächliche Einstiegs-/Schlussfunktionen, Raumlogik und Memory-Treue lesen. Keine automatische Behauptung, alle stilistischen Probleme seien durch bestandene Strukturtests gelöst.

## Livebefund V6.0 (sechs Fälle)

Rohbericht: `analysis/private-outing-v6-six-live.json`, technische Auswertung: `analysis/private-outing-v6-review.json`, lesbare Texte: `analysis/private-outing-v6-six-briefings.md`. Identische gespeicherte Ortskontexte wie V5.7, zwölf erfolgreiche Gemini-3-Flash-Preview-Aufrufe für sechs Ideen und sechs Writer-Antworten, ohne Provider-Retry in dieser abgeschlossenen Serie.

Fünf Prosaantworten und Erinnerungen wurden direkt übernommen. Der dritte Fall lieferte `greeting.speaker="Konrad"` statt `"companion"`; die bisherige Formatprüfung verwarf deshalb auch die Story. V6 löst inzwischen einen Sprecher, der exakt dem validierten Begleiternamen entspricht, zur bekannten Rolle auf. Unbekannte Namen und falscher Adressat bleiben ungültig. Die neue Regression prüft diese Zuordnung in der tatsächlichen Integration. Der Rohbericht bleibt unverändert und zeigt den ursprünglichen Fallback; eine gesonderte lokale Wiederprüfung der sechs gespeicherten Antworten bestätigt die Annahme aller sechs durch die korrigierte V6-Formatprüfung. Keine zusätzliche KI-Generierung und keine rückwirkend vorgetäuschte History für die nachfolgenden Livefälle.

History im tatsächlichen Lauf: 0, 1, 2, 2, 3, 4 vorherige Einträge. Fünf gespeicherte Erinnerungen: 11.256 Byte UTF-16-Schätzung. Vor dieser abgeschlossenen Serie gab es zwei Diagnoseanläufe mit fehlender Erinnerung und einen abgebrochenen Vergleich; sie sind kein Teil dieser Erfolgsstatistik. `analysis/private-outing-v6-memory-probe.json` hält einen Diagnosefall fest.

**Literarischer Befund: Vielfalt noch nicht ausreichend.** Sechs verschiedene Namen, aber dominante Requisiten im Cockpit, wiederkehrende technische Hobbys und fast immer eine Brücke vom Flug zum Bodenprogramm. Memory beschreibt diese Formen teilweise zutreffend, greift aber auch Inhalte aus der Idee auf, die im Briefing nicht vorkommen (etwa Mentor-Beziehung). Die Erinnerung ist keine unabhängige Qualitätsbewertung. Die Wörter „interaktiver Roman“ und „konkreter Moment“ allein lösen die Wiederholung nicht. Dazu kommen unnötig bedeutungsschwere Wendungen und in einem Fall ausdrücklich „fiktive Sepia-Töne“ im sichtbaren Text. Auch der Flug als Moment der Stille für Tonaufnahmen ist erzählerisch unplausibel.

Für den nächsten Konzeptvergleich bietet sich an, private Gegenwart und Beziehung ohne mitgelieferten Requisiten-Fokus zu entwickeln, neutrale Erinnerungsbeschreibungen statt wohlwollender Interpretation zu verlangen und anschließend kurze Varianten mit freier Sprachform zu vergleichen. Das sind nächste Hypothesen, keine bereits implementierten Filter. Keine dieser Auffälligkeiten wird mit einer neuen Aktivitäts- oder Phrasensperrliste kaschiert. V6 ist damit eine überprüfbare neue technische Grundlage, noch kein Nachweis gelöster literarischer Vielfalt.

## V6.1 – Vorflugbriefing und offene Quellenentscheidung

Nach Nutzerkorrektur ist das Produktziel ein persönliches **Briefing vor dem Abflug**: Was haben die beiden vor, wie entstand der Wunsch, worauf können sie sich freuen? Ein alltäglicher menschlicher Wunsch trägt ohne zusätzliche große Bedeutung. V6.1 ersetzt die Aufforderung zur ausgespielten Roman-/Cockpitszene durch diese Perspektive. Die Größe des Anlasses bestimmt die Erklärung. Benutzerbeispiele werden nicht als Produktions-Aktivitätenkatalog übernommen.

Ideen-History enthält jetzt nur die strukturierten Angaben zu Tätigkeit, Motivation, Interaktion, Person und Ziel. Writer-History erhält Tätigkeit und die KI-Beschreibungen von Einstieg, Rhythmus und Schluss. Originalformulierungen und wohlklingende Zusammenfassungen werden weiterhin gespeichert, aber nicht als nachzuahmende Beispiele zurück in die Prompts gegeben. Der Writer erhält das entschiedene Vorhaben, jedoch nicht mehr die Originalitätsbewertung und die teilweise bereits ausgespielte `episode.situation` des Planners. Memory soll nüchtern den tatsächlichen Text beschreiben und keine ungenutzten Eigenschaften aus der Idee ergänzen.

25 Regressionstests bestehen einschließlich Prüfung dieser getrennten Promptkontexte. Die oben dokumentierten sechs Texte gehören V6.0; der unten beschriebene isolierte Suchversuch verwendet V6.1. Promptkennung in App/Debug: `mission-writer-private-v6-1` / `v6.1`. V5 bleibt unverändert auswählbar.

### Quellenbefund und Nutzersteuerung während der Arbeit

Die bestehenden lokalen POI-Tiles enthalten im 50-km-Umfeld von EDTF zahlreiche Aussichts-/Denkmalobjekte, aber keinen `amenity=restaurant`-Eintrag. Das ist eine Lücke dieser Auswahl und kein Nachweis fehlender Gastronomie. Ein Versuch, andere Datenfamilien stärker zu gewichten, brachte ebenfalls wenig brauchbare Vorauswahlen. Die probeweise private Gewichtung wurde nach Nutzersteuerung vollständig aus dem Code zurückgenommen. `analysis/private-outing-v6-1-discovery*.json` dokumentiert nur diesen verworfenen Versuch mit lokalen Tiles und aufgezeichneten Wikipedia-Antworten; diese Dateien sind kein aktiver Resolver und kein Live-Suchnachweis.

Die vorgeschlagene nächste Quellenarchitektur ist **KI-definierter Ausflugswunsch und bei Bedarf KI-Suche eines passenden Ortes**, bei vorgegebenem Zielflugplatz und anschließender räumlicher Prüfung. Eine private Verabredung darf ohne Suchtreffer auskommen. Die aktuelle Text-API hat weiterhin keinen Suchzugriff: `fetchAiJsonWithFallback` setzt bei Gemini nur `contents` und JSON-Ausgabeformat. `groundPlan.factId` bleibt bisher auf gelieferte Fakten beschränkt. Beides müsste für freie recherchierte Ortsvorschläge gemeinsam geändert werden; reine Promptfreigabe würde diesen Vertrag nicht erfüllen.

Google dokumentiert [Google Search Grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search) und [strukturierte Ausgaben mit Tools](https://ai.google.dev/gemini-api/docs/generate-content/structured-output). Damit kann die Ideenphase prinzipiell selbst suchen; eine zusätzliche feste Liste von Aktivitäten ist nicht erforderlich. Integration, Modell-Fallbacks, Quellenanzeige, Gebühren und Verifikation der Ortskoordinaten sind noch zu implementieren und live zu prüfen. Keine Suche als erfolgt ausgeben, nur weil die KI Modellwissen liefert. Der bisherige Ortsresolver bleibt bis dahin unverändert aktiv; die neue Sucharchitektur wurde in dieser Revision nicht stillschweigend aktiviert.

### Isolierter Suchversuch am 14.09.2026

`tools/private-grounded-story-probe.mjs` erprobt eine suchfähige Ideenphase mit `gemini-3-flash-preview`, JSON-Ausgabe und niedrigem Thinking-Level. Nur diese Phase erhält `google_search`; der zweite Aufruf verwendet den bestehenden V6.1-Writer. Eingabe: Zielflugplatz samt Koordinaten, Startplatz, Missionsdatum, 50-km-Radius und gemeinsame strukturierte History. Keine POI-Vorauswahl und keine konkreten Aktivitätsbeispiele. Der übrige Ideenprompt stammt aus V6.1; nur Quellenentscheidung und `discoveredFacts` werden im Test ergänzt. Dies ist kein kontrollierter statistischer A/B-Nachweis.

```sh
node tools/private-grounded-story-probe.mjs --runs=6 --out=private-outing-v6-1-grounded-six-live.json
node tools/private-grounded-story-probe.mjs --recover=analysis/private-outing-v6-1-grounded-six-live.json --out=private-outing-v6-1-grounded-six-recovered.json
```

Der API-Key wird lokal gelesen und als Header übertragen; die Berichte enthalten Prompts, Antworten, Laufzeiten, Token-Metadaten und Grounding-Metadaten, keinen Key. Pro Phase ein Request ohne Retry-Schleife, 45 Sekunden Timeout. `--recover` nutzt gespeicherte fehlgeschlagene Ideen und erzeugt deren Writer-Antwort nach; spätere Fälle werden nicht erneut generiert. Der Test verändert weder Browser-History noch App-Konfiguration.

**Ablauf und Grenzen des Versuchs:**

- Sechs Ideen, zunächst fünf Briefings. EDTW-3 scheiterte daran, dass `groundPlan.factId` auf eine Veranstaltung statt einen Ort zeigte. Im Testadapter wird eine Veranstaltung mit gültigen Koordinaten innerhalb des Radius zusätzlich als Ortsfakt referenzierbar; der Termin bleibt separat erhalten. Derselbe gespeicherte Inhalt erzeugte danach das sechste Briefing. Das ist eine strukturelle Datenübergabe, keine neue Story-Idee. Sie bestätigt weder Koordinaten noch Uhrzeiten unabhängig.
- Die API lieferte teilweise ein Array mit genau einem Objekt. Nur der Testadapter entpackt dieses Format und protokolliert es. Keine Änderung des gemeinsamen App-Parsers.
- Tatsächliche History vor den sechs ursprünglichen Ideen: **0, 1, 2, 2, 3, 4**. Das nachgeholte dritte Briefing stand den späteren Fällen nicht zur Verfügung. Ein erster abgebrochener Diagnoseanlauf ist separat in `analysis/private-outing-v6-1-grounded-live.json` erhalten und gehört nicht zur abgeschlossenen Sechserserie.
- Fünf Ideen enthalten Suchmetadaten, EDTF-3 nicht. Eine Quellen-URL in dessen JSON ist Modellwissen, kein Nachweis erfolgter Recherche. Die Rohmetadaten melden 3, 2, 4, 3, 4, 0 Query-Einträge; einer davon ist nur ein Komma. Diese Zählung ist keine Abrechnung. Die Bitte um ein bis zwei Suchanfragen ist kein hartes Budget. Google beschreibt für Gemini 3 eine suchanfragenbezogene Abrechnung; tatsächliche Gebühren wurden hier nicht aus Metadaten erraten.
- Die zwölf erfolgreichen API-Antworten der vervollständigten Serie benötigen summiert je Idee/Writer etwa **9,8–12,9 Sekunden**, ohne Pause bis zur nachgeholten Antwort, manuelle Nachrecherche oder vorherige Diagnoseanläufe. Das ist eine kleine lokale Messung, keine Latenzgarantie.
- Alle gelieferten Ortskoordinaten bestehen die rechnerische Radiusprüfung. Sie stammen aber vom Modell. Ein überprüfter Abstand zu einer ungeprüften Position beweist die tatsächliche Nähe nicht; Luftlinie beweist weder Fahrzeit noch Zugänglichkeit. Für eine App-Integration den ausgewählten Ort unabhängig auflösen, nicht alle Kandidaten aufwendig geocodieren.

**Qualitätsbefund:** Die Suche erschließt echte Möglichkeiten, löst aber die Ideen- und Sprachwiederholung nicht. Die Reihe enthält zweimal unmittelbar nacheinander Uhren-/Technikmuseen und mehrfach Fotografie oder fachliche Neugier. Alle sechs Namen unterscheiden sich; sechs Fälle beweisen keine langfristige Namensvielfalt. Fast jeder Text beginnt mit einer allgemeinen heutigen Zielankündigung, führt über einen Transfer zum Programm und endet mit einem gefälligen Ausblick. Der Münstermarkt liefert einen überzeugenderen alltäglichen Anlass. Der Stadionfall meint ausdrücklich das Europa-Park Stadion in Freiburg, nicht den Freizeitpark in Rust.

**Unabhängige Quellenstichprobe nach der Generierung:** Das [Junghans-Museum](https://www.junghans-terrassenbau-museum.de/) ist montags geschlossen, der erzeugte Besuch am Montag ohne Übernachtung daher unstimmig. Die [Schramberger Fotoaktion](https://www.schramberg.de/de/aktuelles/veranstaltungen/) läuft tatsächlich vom 19. Juli bis 30. September; ein laufendes Angebot braucht ein Zeitintervall, nicht nur ein aus dem Missionsdatum kopiertes `eventDate`. Die [Montagsmaler](https://www.schramberg.de/de/aktuelles/veranstaltungen/termine/die-montagsmaler-malen-und-zeichnen-in-der-gemeinschaft-mit-anne-hess-romana-glunk-by-kunst-in-szene-64-a08d050.php) sind real und finden laut Quelle abends von 18:30 bis 20:30 statt; ein anschließender Rückflug im Sonnenuntergang ist ohne zeitliche Prüfung ungesichert. Der [Münstermarkt](https://muenstermarkt.freiburg.de/) ist montags vormittags plausibel, und die [Freiburger Schaugewächshäuser](https://uni-freiburg.de/botanischer-garten/) sind montags geöffnet. Nicht jede Einzelbehauptung über Ausstellungsstücke, Taxidauer, Fußwege oder Veranstaltungsverfügbarkeit wurde bestätigt.

**Nächste Grundlagen statt Einzelfallverbote:**

1. Quellenherkunft als Daten trennen: tatsächlich recherchiert, Modellwissen, persönliche Fiktion. Grounding-Metadaten samt Belegbezug aufbewahren; eine URL allein genügt nicht. Vor produktiver Anzeige auch Googles Anforderungen an Search Suggestions und Quellenanzeige umsetzen.
2. Ort und Angebot unterscheiden: Veranstaltung verweist auf ihren Veranstaltungsort; Öffnungsfenster, Terminserie und Aufenthaltsabsicht bilden den zeitlichen Zusammenhang. Nur für die gewählte Idee benötigte Details prüfen.
3. Die Auswahl soll einen gemeinsamen menschlichen Wunsch entwickeln, bevor sie eine Sehenswürdigkeit zum Spezialinteresse erklärt. Hier beginnt die Einseitigkeit schon in Suchfragen und Ideen. Kein Verbot von Museen, Kameras oder Dankesätzen.
4. History sollte den unterscheidenden Ausflugsinhalt verdichten. In dieser Serie beginnen mehrere `activity`-Felder mit Flugreise/Taxitransfer, obwohl das fast allen Missionen gemeinsam ist. Auch Stilbeschreibungen wie „Mischung aus längeren und kürzeren Sätzen“ unterscheiden Texte kaum. Präzisere KI-Erinnerungen sind die nächste Hypothese, keine bereits belegte Lösung.
5. Brieﬁng und Begrüßung gemeinsam vor dem Flug verorten. Das Verstauen der Headsets in einer Begrüßung und wiederholter Dank fürs Transportieren zeigen, dass die Voice-Perspektive dieselbe Grundlage braucht.

Die Rohtexte sind unverändert in `analysis/private-outing-v6-1-grounded-briefings.md` lesbar, mit Original- und vervollständigtem JSON-Bericht daneben. Keine der oben vorgeschlagenen Integrationen oder Qualitätskorrekturen ist mit diesem Test in der App aktiviert worden.

## V6.2 – Erzählter Flugausblick und präzisere Erinnerungen

Der Writer liefert `flightBriefing` als separates String-Feld im selben JSON wie `story`, `greeting` und `memory`. Der Absatz wird freundlich und zusammenhängend erzählt. Er enthält eine Auswahl prägender Strecken-/Wetterangaben; ähnliche Werte am Start und Ziel müssen nicht zweimal vollständig erscheinen. Die Geschichte konzentriert sich auf die Verabredung. V5 bleibt unverändert auswählbar.

`MissionPrivateEpisodeV6.flightContext(contract)` baut ausschließlich für diese Missionsfamilie `private-flight-context.v1`:

- Entfernung aus `contract.route.distanceNm`, optional `distanceBasis`; keine errechnete Flugzeit. Im Test wird die direkte Großkreisentfernung aus den Flugplatzkoordinaten berechnet und als `direct-great-circle-nm` gekennzeichnet.
- Getrennte Wetterbezüge `departure` und `destination` mit Flugplatz und tatsächlicher Wetterstation. Die vorhandenen `contract.weather.dep/dest.raw` liefern Windrichtung/-stärke, Sicht und gegebenenfalls METAR-Rohtext. Optional vorhandene Böen, Wolkenwerte, Quelle und Beobachtungszeit werden übernommen. Es erfolgt keine zusätzliche Wetterabfrage und keine Änderung des gemeinsamen Wetterparsers.
- Zahlen werden nur als endliche Zahlen im plausiblen Wertebereich übernommen. `null`, fehlende Werte, Zahlenstrings und `Infinity` werden nicht zu Nullwind oder guter Sicht umgedeutet. Im Writer-Kontext werden unbekannte Einzelwerte ausgelassen und verfügbare Messangaben explizit markiert.
- `routeLandscape` kann bis zu drei kurze Streckenbelege mit `text` und `source` liefern. Die aktuelle App erzeugt diese Belege noch nicht automatisch. Ziel-POIs werden ausdrücklich nicht zu überflogenen Landschaften erklärt. Fehlt der Streckenbeleg, trägt der Flugabsatz nur Entfernung und Wetter.

Das Wetter bleibt eine Momentaufnahme zur Briefingerstellung. Der gespeicherte Text wird bei einem späteren Wetterrefresh nicht automatisch neu geschrieben. Die Flughöhe ergibt sich nicht aus Wolkenuntergrenzen über Grund; Stationswetter ist keine Streckenfreigabe. Eine exakte Achtelzahl darf nur aus entsprechend genauer Eingabe stammen, nicht aus FEW oder Prozentbedeckung. Der Writer darf METAR-Rohtext sprachlich wiedergeben; das ist keine neue code-seitige meteorologische Auswertung.

### Ausgabe, Speicherung und Fehlergrenzen

`prose(raw, idea, input)` prüft den Flugabsatz unabhängig auf Textformat und höchstens 850 Zeichen. `flightBriefingStatus=accepted-format` bezeichnet ausschließlich diese Formatprüfung, nicht bestätigte meteorologische oder sprachliche Richtigkeit. Fehlender/ungültiger Flugabsatz zerstört eine gültige Geschichte nicht. Ohne Flugkontext wird kein Zusatztext übernommen. Eine inhaltliche Falschbehauptung in freier Prosa kann diese Strukturprüfung weiterhin passieren.

Die App verbindet `story` und `flightBriefing` durch einen Absatzumbruch. `privateOuting.flightBriefing` und `privateOuting.flightContext` erhalten die getrennten Daten für Debug und Speicherung. Die bestehende Kompaktspeicherung bewahrt diese Felder; beim Wiederherstellen bleibt die V6-Absatzstruktur erhalten. `passenger.storyHint` erhält nur die Geschichte. `writerMemory` wird weiterhin ausschließlich aus dem KI-Feld `memory` übernommen, nicht aus dem zusammengesetzten Briefing rekonstruiert. Wetter und routinemäßiger Transfer sollen die kreative Erinnerung nicht dominieren.

Die Promptänderung gegen Drift liegt in der Grundlage: Pilot und Begleiter dürfen denselben Wunsch haben; separate Intent-Felder verlangen keine künstliche Aufteilung in Spezialhobby und Landepraxis. Ortsmerkmale sollen gewöhnliche Erlebnisse ermöglichen, nicht automatisch fachliche Untersuchungen auslösen. Die KI verdichtet in `activity` die unterscheidende Beschäftigung und in `motivation` den menschlichen Wunsch. Keine Aktivitätenrotation, Phrasensperrliste oder nachträgliche Story-Umschreibung.

Kennung in App/Debug: `mission-writer-private-v6-2` / `v6.2`, Assetrevision `20260914-03`. Änderungen betreffen nur private V6-Erzählungen; Runtime, Zielwahl anderer Missionen und V5 bleiben unverändert. Die eigenständige Google-Suche bleibt weiterhin ein isolierter Versuch und ist damit nicht in der produktiven App aktiviert.

### Testaufbau V6.2

```sh
node --test tools/mission-private-outing.test.cjs tools/mission-private-context.test.cjs tools/mission-private-episode-v6.test.cjs
node tools/private-grounded-story-probe.mjs --runs=6 --flight-fixtures=analysis/private-outing-v6-2-flight-fixtures.json --history=analysis/private-outing-v6-1-grounded-six-recovered.json --out=private-outing-v6-2-grounded-six-live.json
node tools/private-grounded-story-probe.mjs --rewrite=analysis/private-outing-v6-2-grounded-six-live.json --out=private-outing-v6-2-writer-replay.json
node tools/private-grounded-story-probe.mjs --rewrite=analysis/private-outing-v6-2-grounded-six-live.json --cases=EDTW-1,EDTW-3,EDTF-2 --out=private-outing-v6-2-final-three.json
```

27 Regressionstests prüfen unter anderem Kontexttrennung, fehlende/falsch typisierte Werte, abweichende Stationen, unveränderte V5-Ausgabe, getrennten Flugabsatz in Missionsausgabe/Kompaktspeicher und kreative History ohne Flugabsatz. Die Testtexte selbst sind keine Testassertion für semantische Richtigkeit.

Die Live-Ideenphase erhält die sechs Erinnerungen aus dem vorherigen Suchversuch. Die neue Sechserserie startet mit 6, 7, 7, 8, 9, 10 Erinnerungen: Ein Writer lieferte ein zusätzliches schließendes JSON-Zeichen und wurde verworfen. Der originale Rohtext ist erhalten, kein allgemeiner Parser wurde dafür aufgeweicht.

Wetterwerte in dieser Serie sind ausdrücklich **synthetische Testdaten**, keine aktuellen METARs. Die direkte Entfernung beträgt nach Flugplatzdaten 28,4 NM. Drei Fälle erhalten keinen Landschaftsbeleg; drei einen ausdrücklich als Testannahme gekennzeichneten Landschaftskontext. Enthalten sind ähnliche Start-/Zielbedingungen, eine abweichende Wetterstation, fehlendes Wetter, Böen sowie FEW statt exakter Achtelzahl. Diese Daten prüfen die Verarbeitung unterschiedlicher Eingaben; sie beweisen keine automatische Streckenrecherche.

Der erste Lauf zeigte Erzählerwechsel ins „wir“, unbelegte Beruhigungen über den Gesamtflug und gerundete/unscharfe Zahlen. Im zweiten Durchlauf wurden **nur die Writer-Antworten derselben sechs Ideen** mit klarer getrennten Sprecherrollen und Faktenbasis neu erzeugt. Dabei wurden die Texte zu lang und bedeutungsschwer. Der abschließende Vergleich verwendet einen kürzeren Story-Auftrag und zwei bis drei Sätze Flugausblick. Die drei Fälle wurden vor diesem Vergleich anhand der Wetterfälle gewählt: EDTW-1 normal, EDTW-3 fehlend, EDTF-2 böig. Keine nachträgliche Auswahl der schönsten Ergebnisse.

`--rewrite` lässt Idee und gespeicherten Kontext einschließlich History je Fall unverändert. Neue Erinnerungen aus einem Replay werden nicht rückwirkend in später aufgezeichnete Ideen eingesetzt. `rewrite.selectedCases` kennzeichnet die tatsächlich erneut erzeugten Fälle; nicht ausgewählte Zeilen in einem kopierten Rohbericht gehören weiterhin dem Ursprungslauf. Prompts und alle Antworten bleiben pro Request erhalten. Die Teststatistik zählt deshalb zusätzliche Requests, nicht kopierte Berichtseinträge erneut.

### Ergebnis der abschließenden drei Fälle

Lesbare, unveränderte Ergebnisse samt Einzelkritik: `analysis/private-outing-v6-2-briefings.md`; Messwerte: `analysis/private-outing-v6-2-review.json`. Alle drei letzten Antworten bestehen die Formatprüfung. Die kürzere Story-Anweisung reduziert die bedeutungsschwere Länge, und Pizza/Spaziergang sowie Kaffee am Kanal liefern alltägliche Anlässe. Die Turm-/Fotoidee bleibt im bisherigen Muster. Die finale Ideeauswahl wurde nicht erneut getestet, da die Writer-Replays absichtlich dieselben Ideen behalten.

Die meteorologische Erzählung ist **noch nicht zuverlässig**: Der Turmfall behauptet klare Sicht in der Geschichte trotz fehlendem Wetterkontext; der Flugabsatz benennt die fehlenden Daten, ergänzt aber einen unpassenden Startsatz in Wir-Form. Beim böigen Wetter bleiben 12/20 Knoten erhalten, doch Startbedingungen werden als ruhiges Wetter der Strecke verallgemeinert, die Distanz wird gerundet und der Höhenbezug nicht durchgehend genannt. Die technische Übergabe ist geprüft, die freie Sprache dadurch nicht sachlich freigegeben. Kein nachträglicher lokaler Wetter- oder Story-Baustein kaschiert diese Fehler in den Testausgaben.

Auch die Memory bleibt fehleranfällig: Sie nennt teilweise im Text ungenutzte Namen, beginnt wieder mit Flug/Transfer oder liefert keine echte Originalformulierung für `distinctivePhrase`. Diese Beobachtung wird nicht mit Regex aus der Geschichte repariert. Für den nächsten Schritt sind überprüfbare Faktenbindung des Flugabsatzes und klarere Trennung zwischen Ideenannahmen und Wetterbelegen sinnvoller als weitere einzelne Phrasenverbote. V6.2 ist lokal implementiert und getestet, aber diese Ergebnisse sind kein Release-Nachweis einer verlässlichen Wetterbriefing-Funktion.

## V6.2.1 – Räumlicher Wetterübergang und gebundene Werte

Nach Nutzerfeedback bleibt der erzählerische Übergang ausdrücklich erwünscht: leichtes Wetter am Start darf flüssig zu lebhafterem Wetter am Ziel überleiten. Der Writer erhält dafür getrennte `STARTWETTER`- und `ZIELWETTER`-Blöcke mit `appliesTo`, nicht nur eine gemeinsame Wetterliste. Diese Blöcke beschreiben örtliche Momentaufnahmen. Die Story-Perspektive und der kurze, persönliche Ton von V6.2 bleiben erhalten. Wetterannahmen in der Idee besitzen keinen Belegstatus gegenüber den Wetterdaten.

Ein erster Drei-Fälle-Vergleich (`analysis/private-outing-v6-2-1-weather-scope.json`) verbesserte diesen Übergang, zeigte aber eine Umdeutung von 5/8 zu 50 Prozent. Deshalb ergänzt die Revision einen kleinen Wertevertrag im **Flugabsatz**, keine Story-Bausteine:

- `flightBindings(flightContext)` erzeugt benannte Werte mit Einheiten, etwa `route.distance`, `start.wind`, `target.gust`, `target.cloudAmount`, `target.cloudBase`. Platznamen und Stationskennungen sind ebenfalls referenzierbar, damit Ziffern in Namen zulässig bleiben.
- Der Writer setzt Referenzen wie `[[route.distance]]` oder `[[target.cloudAmount]]` in seinen frei formulierten Text. Sie enthalten nach Auflösung bereits die passende Einheit. Die Auflösung ersetzt nur diese Werte, keine ganze Erzählung oder Satzfolge.
- `resolveFlightBriefing` prüft bekannte Referenzen, fehlende Pflichtreferenzen für verfügbare Entfernung/Böen, übrig gebliebene Klammern und eigenständig geschriebene Ziffern. Das ist Ausgabeformatprüfung, keine Klassifikation der Freizeitaktivität oder Wetterbedeutung. Gebundene Zahlen werden nicht gerundet oder in andere Einheiten umgerechnet.
- Der vollständig aufgelöste Text darf weiterhin höchstens 850 Zeichen lang sein. Ungültige Referenzen oder Werteausgabe verwerfen ausschließlich den Zusatzabsatz; eine gültige Geschichte samt Memory bleibt erhalten. Es gibt dafür keinen zweiten Reparaturaufruf und keinen Ersatz-Wettertext.
- Debug hält `rawFlightBriefing` mit Referenzen und das aufgelöste `flightBriefing` getrennt fest. Status `accepted-bindings` ersetzt bei neuen Antworten `accepted-format`. Bereits gespeicherte V6.2-Texte werden nicht rückwirkend als Vorlagen verarbeitet.

Diese Prüfung garantiert korrekte Ersetzung der **referenzierten** Werte, keine vollständige semantische Wahrheit der freien Sprache. Falsche Ortszuordnung einer gültigen Referenz, ausgeschriebene erfundene Zahlen, ungeprüfte qualitative Aussagen oder ungenaue METAR-Paraphrasen sind damit nicht automatisch ausgeschlossen. METAR-Werte, die der bestehende Snapshot nicht strukturiert liefert, erhalten nicht allein aus dem Rohtext neue code-seitige Zahlenreferenzen. Der gemeinsame Wetterparser bleibt unangetastet.

Der anschließende Vergleich (`analysis/private-outing-v6-2-1-bound-weather.json`) erzählt dieselben drei gespeicherten Ideen mit unverändertem Testwetter und aufgezeichneter History nochmals. Alle drei Flugabsätze bestehen die Werteprüfung. Im Freiburger Fall bleibt der leichte Startwind räumlich vom Zielwind mit Böen getrennt; 28,4 NM, 12/20 Knoten, 5/8 und der Höhenbezug werden unverändert eingesetzt. Der Fall ohne Wetterangaben bleibt bei der fehlenden Datenlage, ohne Startentscheidung oder erfundene klare Sicht im Flugabsatz. Der erste EDTW-Fall enthält trotzdem noch eine unbelegte qualitative Aussage über ruhiges Wetter auf der Strecke. Das bleibt als sichtbarer Prüfbefund erhalten, keine Behauptung vollständig gelöster Wettersemantik.

Lesefassung: `analysis/private-outing-v6-2-1-briefings.md`. Insgesamt sechs zusätzliche Writer-Aufrufe in zwei Drei-Fälle-Vergleichen, keine neue Ideenrecherche. Alte Suchmetadaten in kopierten Berichten gehören zum ursprünglichen Ideenlauf. 28 Regressionstests bestehen, einschließlich 5/8 statt erfundener Prozentangabe, unbekannten Referenzen, fehlenden Böen, Ziffern in Platznamen und unverändertem Story-/Memory-Erhalt bei ungültigem Flugabsatz. Kennung: `mission-writer-private-v6-2-1` / `v6.2.1`, Assetrevision `20260914-04`. Lokal geändert, kein Push oder Deployment.


## Gemeinsamer Wetterabruf – Reparatur vom 14.09.2026

Der iPhone-Bericht für EDTW → Deckenpfronn zeigte einen leeren Wetterkontext trotz
fertiger Geschichte. Der Live-Vergleich bestätigte HTTP 400 mit dem bisherigen
URL-Parameter `t` und HTTP 200 für dieselbe Gebietssuche ohne diesen Parameter.
Die Mission wartet bereits vor dem Planner auf Start- und Ziel-Snapshots; die
späteren Routenwetter-Abfragen waren daher nicht die Ursache. Die bisherigen
Writer-Serien mit synthetischem Wetter deckten diesen Abruffehler nicht ab.

Nach ausdrücklicher Freigabe für den gemeinsamen Wetterpfad wurden alle sieben
METAR-URL-Erzeuger der Web-App korrigiert. Der Worker entfernt `t` zusätzlich für
ältere Clients, behandelt HTTP 204 ohne Body und cached Upstream-Fehler nicht.
Der reine RAM-Cache `_missionWxCache` erhält zehn Minuten Laufzeit für erfolgreiche
Snapshots und 30 Sekunden für leere/fehlgeschlagene Abrufe. Abgelaufene Einträge
werden beim nächsten Abruf entfernt; maximal 128 Einträge begrenzen den Speicher.
Die Ablaufzeit beginnt nach Abschluss des Abrufs. Es entstehen keine zusätzlichen
Dauerabfragen: Erst die nächste Mission fragt bei abgelaufenem Cache neu ab.

Der Wetterparser und das Snapshot-Ausgabeformat bleiben erhalten. Ebenso bleiben
die konfigurierte Open-Meteo-Fallback-Wahl, die Trennung von Start-/Zielstation,
die Writer-Version und bereits gespeicherte Briefings erhalten. Ein späterer
Wetterabruf schreibt keine bestehende Geschichte neu. Diese Reparatur verbessert
die Datenversorgung auch anderer Missionsarten; sie erweitert nicht die
meteorologische Auswertung oder die Auswahl geografisch repräsentativer Stationen.

Prüfungen:

- `node --test tools/mission-weather.test.cjs tools/cloudflare-worker/metar-proxy.test.mjs tools/mission-private-outing.test.cjs tools/mission-private-context.test.cjs tools/mission-private-episode-v6.test.cjs`: 34 Tests erfolgreich.
- `npm test` in `tools/cloudflare-worker`: bestehende Worker-Suite einschließlich METAR erfolgreich.
- `node tools/mission-weather-live-probe.mjs`: lokale Produktionsfunktionen und lokaler Worker-Handler mit Live-AviationWeather, ohne KI-Aufruf. Der Client-Abbruch nach 2200 ms bleibt aktiv.

Der Live-Nachweis in `analysis/mission-weather-live-verification.json` vom
14.09.2026, 12:33 UTC, enthält HTTP 204 für EDTW und EDSD sowie HTTP 200 für beide
anschließenden Gebietssuchen. EDTW erhält EDTL, Deckenpfronn erhält EDDS. Beide
METARs, Herkunftsstationen und Windwerte erreichen den V6-Kontext und seine
Wertebindungen. Auch eine alte URL mit `t` funktioniert durch den lokalen Proxy.
Das belegt den Abruf und die Datenübergabe, keine neue KI-Textbewertung und keinen
Test des veröffentlichten Cloudflare-Workers oder der iPhone-Oberfläche.
App-Cacheversion für die Veröffentlichung: `ga-dispatcher-v1756`.

## V6.2.2 – Gemeinsames Vorhaben und eigene Wünsche

Die erprobte Promptvariante beschreibt den Piloten als Person mit eigenem
Interesse am Ausflug. Der Anstoß entsteht frei aus der Verabredung; beide dürfen
denselben einfachen Wunsch teilen. Frühere generierte Entwürfe dienen dem
Vergleich und belegen keine bereits geflogene gemeinsame Vergangenheit.
`relationshipDynamic` fasst Initiative und Interessen aus dem fertigen Text zusammen.

Die bislang ausgelassene Planner-Angabe `episode.sharedIntent` wird zusätzlich als
`IDEE.sharedIntent` an den Writer weitergegeben. Zusammen mit `pilotIntent`,
`companionIntent`, `occasion` und `personalReason` trägt sie die Geschichte vom
geplanten gemeinsamen Vorhaben. Die ausgespielte Planner-Situation wird weiterhin
nicht übergeben. Keine neuen Aktivitätenkataloge, Rollenquoten, Textfilter oder
Reparaturaufrufe. Schema, V5, Wetterabsatz und dessen Wertebindungen bleiben gleich.

Kennungen: `v6.2.2`, `mission-writer-private-v6-2-2`, Assetrevision `20260914-05`.
22 Regressionstests erfolgreich, darunter die tatsächliche App-Übergabe zweier
unterschiedlicher gemeinsamer Absichten bis zum Writer und kompakten Save.
Die Promptvariante wurde zuvor mit fünf Modellaufrufen bewertet; die ergänzte
`sharedIntent`-Übergabe ist durch lokale Tests geprüft, noch ohne neue KI-Serie.
Für diese Integration wurden keine weiteren API-Aufrufe benötigt.
Auswertung und übertragbare Prinzipien: Abschnitt 10 im
[Mission Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md).
Release: V6.2.2 mit App-Cache `ga-dispatcher-v1759` auf `origin/main`.


## V6.3 – KI-Picker und Erhalt der gewählten Idee

Der private V6-Picker plant drei vollständige Ideen in einem gemeinsamen
JSON-Aufruf. Die bestehende Zielsuche liefert die Flugplätze; jeder erhält seine
begrenzten Ortsbelege. Der gewählte `private-proposal.v1`-Snapshot wird gegen den
aktuellen Start-/Zielrahmen erneut geprüft und direkt an den Writer übergeben.
Es folgt kein erneuter privater Ideenaufruf. Flug-/Wetterdaten sind aktuell,
Ortsreferenzen und gewählte Absichten bleiben erhalten. Ungewählte Vorschläge
werden nicht ins Gedächtnis geschrieben.

Kennungen: `v6.3`, `mission-private-picker-v6-3`, `mission-writer-private-v6-3`,
Assetrevision `20260914-06`. 40 Tests, ein direkter V4-Dispatch-Dryrun, ein
vollständiger Picker-/Auswahl-Dryrun und ein Live-Batch mit drei akzeptierten Ideen (7.564 Tokens) sind dokumentiert.
Neue Picker-Tests: `tools/mission-private-picker.test.cjs`.
Kostenmodell, History, Rollenfehler und offene Qualitätsbefunde stehen in Abschnitt
11 des [Mission Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md).
Release: V6.3 / Private Return V1, App-Cache `ga-dispatcher-v1760`, Tracker Alpha v404.

## V6.3.1 – History für Auslöser, Initiative und Schreibweise (lokal)

`origin` ergänzt neue Ideen um `initiative: pilot|companion|shared` und einen
kurzen `trigger`. Der Planner entscheidet beides passend zum gemeinsamen
Vorhaben. Der Writer bekommt dieselbe Herkunft der Verabredung und bewahrt sie.
Es gibt keine feste Wechselquote, Aktivitätsliste oder Namenssperre.

Die begrenzte Entwurfshistory speichert neben der KI-Memory jetzt diesen
strukturierten Ursprung, `personalReason`, `pilotIntent` und `companionIntent`
aus dem Ideenvertrag. Der nächste Planner erhält sie zum Vergleich. Dadurch
wird nicht erst aus dem fertigen Text rekonstruiert, wer warum loswollte.
Die Memory beschreibt weiterhin den tatsächlich geschriebenen Text und kann
abweichende Beziehungsdynamik sichtbar machen.

Der Writer erhält nun auch `distinctivePhrase` und Beziehungsdynamik sowie die
klare Aufgabe, Funktionen von Einstieg, Satzfolge und Schluss zu vergleichen
und die aktuelle Geschichte eigenständig aufzubauen. Alte Originalformulierungen
sind Vergleichsmaterial, keine Stilvorlagen. Die Idee bleibt verbindlich.

Speicherschlüssel `ga_private_episode_history_v1`, Memory-Schema, lokale Haltung
und Grenzen (12 Einträge, 32 KiB UTF-16-Schätzung) bleiben erhalten. Alte Ideen,
ausgewählte Picker-Angebote und History ohne `origin` sind lesbar; neue Felder
sind eine kompatible Erweiterung. Keine Update-Löschung und kein neuer Cloud-
Abgleich. Planner und Dreiervorschläge verwenden dieselben Anweisungen.
Der Debugbericht zeigt den strukturierten Anstoß, wenn vorhanden.

Validierung: Tests für Ideenvalidierung, History-Roundtrip, Übergabe an Planner
und Writer, alte Einträge/Auswahlen und bestehende Picker-Integration. Keine
zusätzlichen API-Aufrufe; die tatsächliche Verbesserung der sprachlichen Vielfalt
ist noch in neuen Nutzerläufen zu beurteilen.
