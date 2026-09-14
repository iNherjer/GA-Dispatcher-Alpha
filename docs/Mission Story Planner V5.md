# Mission Story Planner V5

Aktuelle private Erzählversion: [Mission Episode Writer V6](Mission%20Episode%20Writer%20V6.md). V5 bleibt als auswählbare Referenz erhalten; V6 ergänzt KI-verfasste JSON-Erinnerungen und eine freie Erzählform auf Basis einer strukturierten Episode.

Stand: 14. September 2026. Referenzimplementierung: `private_outing`, Promptrevision `v5.7`.

## Zweck und Geltungsbereich

Diese Architektur soll konkrete, persönliche und unterschiedliche Missionsgeschichten ermöglichen, ohne freie Prosa nachträglich über Wortlisten in Standardgeschichten umzubauen. Sie ist zunächst ausschließlich für KI-Privatmissionen mit V4-Contract aktiv. Andere Profile werden nicht automatisch umgestellt.

Die Bezeichnung **Story Planner V5 – Privat** beschreibt die kreative Ideenplanung. `MISSION_PIPELINE_V4_VERSION`, der technische Missionsvertrag und die Ablaufklasse bleiben V4 beziehungsweise A-B. `private-outing.v1` ist die gespeicherte Datenversion, nicht die Promptversion. Additive Erinnerungsfelder ändern diesen Speichervertrag nicht. Beide bestehenden Writer-Schalter V4/V5 führen für dieses Profil zum neuen Pfad. Ohne KI beziehungsweise ohne passenden V4-Contract bleibt der bisherige Offline-/Legacy-Pfad erhalten.

## Beobachtete Ursachen

Die vorherige lokale Verarbeitung verwarf bereits einzelne Ausdrücke wie „Rest des Tages“. „Spaziergang“ wurde als Foto-Aktivität gelesen, „Alb“ als Streckenmotiv. Selbst der Wellness-Ersatztext fiel dadurch erneut durch die eigene Prüfung. Weitere Schritte überschrieben den Planner-Anlass, wählten Personen und Gepäck unabhängig voneinander und ersetzten KI-Titel. Solche Korrekturen beseitigten gerade die Details, die eine Geschichte persönlich machen.

Die erste echte KI-Testserie des neuen Datenflusses zeigte eine zweite Problemklasse:

- Unterschiedliche Namen und Objekte ergaben trotzdem dreimal dasselbe Muster: etwas für eine Sammlung suchen oder dokumentieren.
- Alle Texte begannen mit Wetterlob und erwähnten anschließend auffälliges Gepäck.
- Ortsnamen wurden zu unbelegten lokalen Besonderheiten erweitert, etwa zu einer speziellen Quarzformation.
- Der Dispatcher sprach teilweise wie ein mitfliegender Transporteur.
- Das Greeting sprach den Mitflieger an, statt aus seiner Perspektive zum Piloten zu sprechen.

Daraus folgen positive Inhaltsverträge und ein kompaktes semantisches Gedächtnis. Keine dieser Beobachtungen rechtfertigt eine neue Liste verbotener Wörter.

## Ablauf und Zuständigkeiten

1. **Technischer Rahmen:** Der vorhandene Planner bestimmt Ziel, Profil und A-B-Ablauf. Die Private-Outing-Planprüfung hält diesen Rahmen fest und lässt Erzählideen offen.
2. **Zielwissen:** Für Privatmissionen sammelt `mission-private-context-core.js` seit v5.7 POI-Tiles und eine geografische Wikipedia-Suche. Andere Profile behalten ihre bisherigen Resolver. Nur akzeptierter Kontext wird als Faktengrundlage an die Ideenplanung gegeben.
3. **Gedächtnis:** `history()` liest und normalisiert die letzten privaten Entwürfe aus Local Storage.
4. **Ideenentscheidung:** `ideaPrompt()` lässt die KI Person, Tätigkeit, Motivation, Miteinander, Zielbezug, ersten Schritt und Gepäck gemeinsam entwickeln. Wetter wird in diesem Schritt nicht mitgegeben: normales Flugwetter soll keine persönliche Motivation vorgeben.
5. **Strukturprüfung:** `validateIdea()` prüft Pflichtfelder, Zielgleichheit, erlaubte Faktenreferenzen, Gepäckgewicht und erwartete Datentypen. Sie erzeugt einen begrenzten, versionierten Story-Kern.
6. **Ausformulierung:** `writerPrompt()` erhält diesen Kern, ausgewählte Fakten, History und den Flugrahmen einschließlich Wetter. Es liefert Titel, Story und ein Greeting mit expliziten Sprecherfeldern.
7. **Übernahme:** Der Code übernimmt Person und Gepäck aus der Idee, nicht aus Prosa. StoryFrame, Plan und Contract erhalten dieselbe Idee. Der Writer darf daraus keine neue Person oder Ladung ableiten.
8. **Weitere Verarbeitung:** Profilanwendung, Private-Outing-Sanitizer und Profilprüfung erkennen den versionierten Kern. Sie greifen für diesen Pfad nicht auf die alten Aktivitätsregexe oder Satzbausteine zurück.
9. **Speichern und Voice:** Die aktive Mission enthält den Kern. Die History wird nach der Missionszusammenstellung ergänzt. Voice erhält denselben Anlass, persönlichen Grund und nächsten Schritt; dekorative Vorfeldobjekte sind keine neue Storygrundlage.

Die normale Erzeugung braucht zwei kreative KI-Anfragen: Idee und Prosa. Der bestehende technische Planner und gegebenenfalls spätere Voice-Anfragen kommen hinzu. Provider-/Modell-Fallbacks können weitere Versuche verursachen.

## Datenvertrag

| Feld | Zweck / Autorität |
| --- | --- |
| `schema`, `taskDomain`, `mode` | Code setzt `private-outing.v1`, `private_outing`, `A-B`. Keine Textklassifikation. |
| `targetName` | Muss dem ausgewählten Ziel entsprechen. |
| `occasion` | Konkretes gemeinsames Vorhaben, als vollständiger Satz. |
| `personalReason` | Persönliche Motivation oder Vorgeschichte, als vollständiger Satz. |
| `destinationConnection` | Verbindung des gewählten Vorhabens mit realem Ortskontext oder einer privaten Vorgeschichte. |
| `creativeBasis.realAnchor`, `.fictionalPart` | Vor dem Writer festgelegte Trennung: belegte Grundlage und bewusst erfundener Anlass. Freie Texte, kein Aktivitätenkatalog. |
| Rahmen: `missionDate` | Optionaler expliziter Anflugtag (YYYY-MM-DD). Daraus berechnet der Core `eventWindow` vom Anflugtag bis Sonntag dieser Kalenderwoche. Ohne Datum kein bestätigtes Zeitfenster. Die App leitet derzeit kein Simulatordatum ab. |
| `firstStep` | Absicht nach dem Parken; keine unbelegte garantierte Anschlusslogistik. |
| `groundPlan` | `factId` ist null für einen persönlichen Anlass ohne benannten Ortsanker, sonst Referenz auf einen ausgewählten Ortsfakt. `intent` und `transferPlan` beschreiben das Vorhaben. `place` mit Name/Koordinaten/Entfernung übernimmt und prüft der Code. |
| `pilotIntent`, `companionIntent` | Wer welchen Wunsch beziehungsweise Beitrag hat. Verhindert das Vertauschen der persönlichen Motivation im Writer. |
| `factIds` | Referenzen auf tatsächlich mitgeschickte Fakten. |
| `eventVisit` | Null oder gewählter belegter Termin: `factId`, unverändertes `eventDate`, vom Code übernommenes `arrivalDate`, frei geplanter `stayPlan`. Bei späterem Termin berücksichtigt der Aufenthalt die Übernachtung. |
| `companion` | Name, Beziehung, kurze Persönlichkeit und Voice-Geschlecht. |
| `luggage` | Bezeichnung und Gewicht in lbs. Die App bildet daraus das vorhandene Cargo-Anzeigeformat. |
| `storyIdentity.activity` | Abstrakte Tätigkeit; macht ähnliche Aktivitäten trotz anderer Gegenstände vergleichbar. |
| `storyIdentity.motivation` | Menschlicher Grund; nicht nur das Zielobjekt. |
| `storyIdentity.interaction` | Wie die Beteiligten gemeinsam handeln. |
| `narrativePlan.entryPoint` | Gewählter Einstiegsmoment. |
| `narrativePlan.tone` | Stimmung beziehungsweise Ton. |
| `narrativePlan.shape` | Beabsichtigter Erzählverlauf. |
| `noveltyReason` | Kurze Begründung des Unterschieds zur History; Diagnose, kein sichtbarer Briefingsatz. |

Die Erinnerungs- und Dramaturgiefelder sind freie kurze Texte. Sie bilden keinen neuen Aktivitätenkatalog. Pflichtfelder beschreiben Entscheidungen, nicht eine Pflichtreihenfolge für Sätze.

Writer-Ausgabe:

```json
{
  "title": "Individueller Titel",
  "story": "Briefing des am Boden bleibenden Vereinskollegen an den Piloten.",
  "greeting": {
    "speaker": "companion",
    "addressee": "pilot",
    "text": "Eigene Äußerung des Mitfliegers an den Piloten."
  }
}
```

`prose()` akzeptiert die erwarteten Sprecherwerte und formale Textfelder. Für bestehende Passenger-Komponenten wird daraus wieder ein einfacher `greetingText`-String. Die Sprecherwerte belegen nicht automatisch die sprachliche Perspektive; diese muss zusätzlich in echten Ergebnissen geprüft werden.

## Faktentreue und kreative Freiheit

Die Text-API hat in diesem Pfad kein eigenes Suchwerkzeug. Modellwissen ist keine nachgewiesene Faktenquelle. Die App liefert bis zu zehn akzeptierte Fakten mit IDs; der Writer erhält nur die ausgewählten davon.

Seit der Klarstellung des Nutzers vom 14.09.2026 gilt: **Reale Möglichkeiten analysieren, dazu einen glaubhaften Anlass erfinden dürfen.** Eine zum Kaiserstuhl passende Weinprobe oder ein Besuch des realen Europa-Parks bei einem Flug nach Lahr ist gewünscht. Fiktive Wettbewerbe, Sonderangebote, kleine Veranstaltungen und Verabredungen sind ebenfalls ausdrücklich erlaubt. Sie sind Möglichkeiten, keine regelmäßig abzuarbeitenden Motive. Bei wenig Fakten darf ein plausibler örtlich unspezifischer Anlass die Geschichte tragen.

`creativeBasis.realAnchor` und `creativeBasis.fictionalPart` halten diese Entscheidung vor der Prosa fest. Der Writer erzählt den gewählten erfundenen Anlass konkret weiter. Das Briefing muss die Immersion nicht mit einem Fiktionshinweis unterbrechen. Reale Geografie und Identität benannter Orte bleiben dagegen Faktenfragen. Ein erfundener Anlass darf keine neue vermeintlich reale Sehenswürdigkeit erzeugen.

Ein **tatsächlich angekündigtes Tagesereignis** ist von diesem fiktionalen Anlass zu unterscheiden: Es braucht eine mitgelieferte Quelle und einen Termin ab `missionDate` bis einschließlich Sonntag derselben Kalenderwoche. Die Klarstellung des Nutzers erlaubt die Anreise vor der Veranstaltung mit einem glaubhaften Aufenthalt und Übernachtung. Ein Samstagstermin darf also den Anflug am Montag oder Dienstag begründen; ein bereits vergangener Termin oder der nächste Montag liegt außerhalb dieses Fensters. Ein KI-Aufruf ohne Suchwerkzeug kann das nicht selbst zuverlässig recherchieren. Der aktuelle APT-Wikipedia-Resolver besitzt keinen Veranstaltungskalender. Die Quellenrecherche der v5.4-Testserie wurde separat durchgeführt und als Kontext injiziert; sie ist keine neue automatische Recherchefunktion der App. Datum und Quelle sind Daten im Rahmen, keine von der Prosa nachträglich erratenen Klassifikationen. Bei gewähltem `eventVisit` prüft der Core eine verwendete Faktenreferenz auf `kind=event`, vorhandene Quelle, identisches gültiges ISO-Datum, Zugehörigkeit zum Wochenfenster und vorhandenen Aufenthaltsplan. `arrivalDate` setzt der Code. Diese Strukturprüfung bestätigt weder die Echtheit der Quelle noch die semantische Qualität des Aufenthaltsplans; sie verhindert aber verschobene Ereignisdaten und eine Ausweitung des Fensters durch die KI.

Eine erfundene persönliche Verabredung ist zulässig. Reale Fahrzeiten, Betriebsdaten oder angeblich recherchierte Verfügbarkeit werden dadurch nicht belegt. Ein zukünftiger Ereignis-Resolver sollte Ort/Einzugsgebiet, Veranstalter-URL, Veranstaltungsdatum mit Zeitzone, Abfragezeit und Ablaufdatum liefern. Erst nach dieser Prüfung gehört ein Termin in den akzeptierten Kontext. Der Zugriff sollte begrenzt und gecacht werden; ohne Treffer bleibt eine glaubhafte Fiktion möglich. Das braucht eine eigene Integration und ist nicht durch Prompttext bereits implementiert.
Grenze: Gültige Fakten-IDs beweisen nicht, dass alle Behauptungen in Idee und Prosa aus diesen Fakten folgen. Auch ein upstream falsch akzeptierter Kontext bleibt ein Problem. Dafür sind Quellenprüfung und semantische Stichproben nötig; eine lokale Wortliste löst das nicht.

## Gedächtnis, Speicher und Lebensdauer

- Schlüssel: `ga_private_outing_history_v1`.
- Speicherort: Local Storage dieser Browser-Origin auf diesem Gerät.
- Höchstens zwölf Einträge; die ältesten fallen heraus.
- Zusätzlich maximal 64 KiB JSON-Payload nach `string.length * 2` als UTF-16-Schätzung, einschließlich JSON-Escaping. Bei Bedarf bleiben weniger als zwölf Einträge erhalten. Browserinterner Overhead und Schlüssel sind nicht Teil dieser Schätzung.
- Pro Eintrag bleiben nur begrenzte Felder: ID, Anlass, Motivation, Zielbezug, Name, Beziehung, Ziel, Titel, Textanfang, Textende, StoryIdentity und NarrativePlan.
- Keine vollständigen Missionen, Contracts, Geo-Kontexte, Audiodaten oder Logbucharchive in dieser History.
- Whitelist und Feldgrenzen gelten beim Lesen und Schreiben. Alte v1-Zeilen ohne neue Felder bleiben verwendbar; fehlende Felder sind leer. Beschädigtes JSON ergibt ein leeres Gedächtnis.
- Identische Missions-ID wird aktualisiert statt doppelt angehängt. Ein Speicherfehler verhindert die Mission nicht; die App meldet, dass die History nicht gespeichert werden konnte.
- Gespeichert werden erzeugte Entwürfe, nicht erst erfolgreich abgeschlossene Flüge. Sonst erzeugt wiederholtes Neuwürfeln dieselben Ideen, ohne je ein Gedächtnis aufzubauen.
- Reload erhält die History. Löschen des entsprechenden Local-Storage-Schlüssels beziehungsweise der Website-Daten entfernt sie. Es gibt derzeit keine eigene History-Bedienoberfläche.
- Diese History ist nicht an Cloud-Sync angeschlossen und wird auf einem anderen Gerät nicht rekonstruiert. Der Story-Kern der **aktiven Mission** kann separat über den bestehenden Missions-Sync mitkommen; das ist nicht die zwölfteilige Variationshistorie.
- Die kompakte History wird beim nächsten Ideen- und Writer-Aufruf an den ausgewählten KI-Provider übermittelt. Es ist expliziter Promptkontext, kein verstecktes serverseitiges Modellgedächtnis.

Messung der bisherigen drei Testgeschichten, zu zwölf Einträgen wiederholt: 26.222 Byte UTF-16-Schätzung, 13.255 Byte UTF-8. Neue kurze Erinnerungsfelder erhöhen dies etwas; die feste Obergrenze gilt weiterhin. Größe ist zugleich eine Prompt-/Tokenkostenfrage.

Für weitere Missionsfamilien zuerst den History-Scope entscheiden: allgemein wiederkehrende Erzählweisen können familienübergreifend relevant sein, fachliche Missionsinhalte eher innerhalb einer Familie. Nicht unbemerkt für jede Familie zwölf vollständige Missionen speichern. Ein späteres gemeinsames Gedächtnis braucht einen festen Gesamtetat und bei Cloud-Sync eine definierte Merge-/Deduplizierungsregel.

## Fehlerverhalten und Grenzen

- Ungültige oder fehlende Idee: Erzeugung bricht ab. Kein heimlicher Wechsel zu einer anderen Zufallsstory.
- Ungültige oder fehlende Prosa: Die zwei vollständigen Ideensätze bilden den sichtbaren Ersatztext. Person und Gepäck bleiben gleich; eine einfache persönliche Begrüßung wird genutzt. Der Debugbericht kennzeichnet dies.
- Diagnostik: Writer-Modus `private-v5`, Promptrevision `v5.5`, akzeptierte/ersetzte Prosa, rohe und finale Begrüßung, Story-Kern, History-Anzahl und Faktenanzahl.
- Keine Garantie für Vielfalt: Semantische Selbstbeschreibung und Promptvergleich helfen, ersetzen aber keine echte Serienprüfung. Ein richtig ausgefüllter `noveltyReason` kann trotzdem eine ähnliche Idee begleiten. Die Revision v5.2 zeigte trotz dieser Felder drei Einstiege über Ausrüstung im Cockpit. v5.3 fordert deshalb den gedanklichen Vergleich mehrerer grundsätzlich verschiedener Möglichkeiten und den Vergleich der Handlungssituation statt nur der Wortwahl.
- Dramaturgie in der History beschreibt den beabsichtigten Verlauf. Gespeicherter erster und letzter Satz zeigen zusätzlich, was tatsächlich geschrieben wurde.
- Nicht aus Stilproblemen Runtime-Sonderregeln bauen. Falsche Personenperspektive zuerst in der Sprecherzuweisung lösen; unbelegte Ortseigenschaften zuerst in der Fakten-/Fiktionsgrenze; Wiederholung zuerst in Inhalt und History.

## Prüfen und auf andere Missionen übertragen

Lokale Regressionen:

```sh
node --test tools/mission-private-outing.test.cjs
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=2 --types=apt:private+private_outing --out=private-integration.json
```

Echte KI-Serie mit lokal eingerichtetem Gemini-Key:

```sh
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=3 --types=apt:private+private_outing --live-gemini --out=private-live.json
```

Der Dryrun verwendet echte Gemini-Antworten nur mit `--live-gemini`. Geografie und Wetter bleiben dabei Fixtures. Der vorhandene Fixture-Datensatz ordnet dem EuroAirport unter anderem Freiburger Sehenswürdigkeiten zu; diese Testzuordnung ist keine verifizierte Aussage über Nähe oder Eignung. Ergebnisse belegen deshalb Promptverhalten, nicht die Qualität einer echten Zielrecherche. Gleicher Zielkontext und fortgeschriebene History sind nützlich für den Wiederholungstest.

Prüffragen für Serien:

1. Ändern sich Tätigkeit, Motivation und Miteinander oder nur Namen und Gegenstände?
2. Ändern sich Einstieg, Rhythmus und Schluss oder nur Adjektive?
3. Bleibt es ein gemeinsam unternommener privater Ausflug?
4. Spricht das Greeting tatsächlich als diese Person zum Piloten?
5. Bleiben reale Geografie und Ortsidentitäten belegt? Passt der bewusst erfundene Anlass zum Kontext, und wurde er bereits in der Idee festgelegt? Wird ein Tagesereignis nur mit passendem Datum/Quelle als recherchiert behandelt?
6. Stimmen Idee, Titel, Story, Gepäck, Greeting und spätere Voice zusammen?
7. Bleiben Daten bei API-Ausfall, Reload, knapper Speicherkapazität und Modell-Fallback konsistent?

Migration einer weiteren Familie:

1. Vorhandenes Rezept und technische Autoritäten dokumentieren; nicht verändern, nur weil die Story anders wird.
2. Alle unabhängigen Themenentscheidungen und späteren Umschreibungen im aktuellen Pfad finden.
3. Den passenden fachlichen Story-Kern definieren: Pflichtinhalte aus der Mission, frei erfundene persönliche Farbe, belegte Fakten.
4. Eine einzige kreative Entscheidung vor Person-/Cargo-/Prosaableitungen etablieren.
5. Sprecher und Adressaten jeder Textoberfläche ausdrücklich bestimmen.
6. Kompakte Erinnerungsfelder für die tatsächlichen Wiederholungsdimensionen wählen; keine neue Motivliste.
7. Strukturprüfungen und stilistische Bewertung getrennt halten. Einen einmal gewählten Kern durch alle Projektionen tragen.
8. Erst lokale Übergabe-/Fehlertests, dann echte Serien mit und ohne Ortswissen. Rohtext und Endtext vergleichen.
9. Nur die geprüfte Familie umstellen. Gemeinsame Klassifikation oder Runtime erst nach eigener Impact-Analyse und Freigabe ändern.

## Relevante Dateien

- `mission-private-outing-core.js`: Prompts, Ideen-/Prosaformat, begrenzte History.
- `app.js`: `fetchPrivateOutingStory`, Zielwissen, Contract-/Planübernahme, Storage und Schutz vor Legacy-Umschreibung.
- `passenger-voice.js`: `_privateOutingStoryContext` und private Ankunfts-/Abschiedshinweise.
- `tools/mission-private-outing.test.cjs`: strukturelle Regressionen und Fehlerfälle.
- `tools/mission-pipeline-dryrun.mjs`: kompletter lokaler Ablauf und optionale echte KI-Antworten.
- `profile.js`: lesbare Diagnose für Ortsanker, Fiktion, History und getrennte Anflug-/Veranstaltungsdaten.

## Ergebnis der Nachschärfung am 14.09.2026

Nachweise: [Echte KI-Serien v5.2/v5.3](../analysis/private-outing-v5-refinement-review.json), daneben acht lokale Regressionstests und zwei vollständige Stub-Durchläufe mit nachgewiesenem History-Transfer.

- v5.2: Zeichnen, historische Kamera und Schach; alle Greetings aus Mitfliegerperspektive. Trotzdem dreimal Einstieg über Ausrüstung im Cockpit. Teilweise unklare Zuordnung, wer das Hobby tatsächlich ausübt.
- v5.3: Architekturzeichnung, sportliches Duell und gemeinsames Gärtnern; deutlich unterschiedliche Tätigkeiten, explizite Pilot-/Mitfliegerbeiträge und erneut korrekte Greeting-Perspektive.
- Weiter offen: Erste zwei v5.3-Briefings beginnen mit „Sobald“, das dritte mit „Wenn“; alle leiten über eine Flugsituation ein. Die Varianz der Dramaturgie ist daher noch nicht überzeugend belegt.
- Historische Bewertung unter der damaligen strengeren Vorgabe: Die Gartenmission erfand Marktangebote und einen Schließzeitpunkt. Mit der anschließenden Nutzerfreigabe sind plausible fiktive Angebote zulässig; sie allein gelten nicht mehr als Qualitätsfehler. Falsche Geografie, falsche Ortsidentitäten und angeblich recherchierte Kalenderdaten bleiben dagegen zu prüfen.
- Ergebnis: Bessere Themenvielfalt und Sprechertrennung, keine vollständige Lösung von Wiederholung oder Halluzination. Keine automatische Übertragung auf weitere Profile und keine pauschale Qualitätsfreigabe allein aufgrund dieser sechs Texte.

Die Revision v5.4 erweitert deshalb die kreative Freiheit auf den gesamten plausiblen Anlass und dokumentiert die Grenze bereits im Ideenkern. Ein möglicher späterer semantischer Review muss diese bewusst erlaubte Fiktion erhalten und darf sie nicht wieder in vage Standardtexte zurückschreiben. Zusätzliche Latenz und Kosten eines solchen Reviews sind separat auszuweisen; aktuell gibt es keinen dritten Review-Aufruf.


## Quellenbasierte Testserie v5.4

Reproduzierbare Eingaben: [Ortsquellen und drei Testverträge](../analysis/private-outing-v5-4-source-cases.json). Die ersten zwei Fälle beziehen sich auf den 14.09.2026, der dritte absichtlich auf den 15.09.2026, weil der recherchierte Konzerttermin an diesem Tag liegt. Die Datumsauswahl ist ein Testparameter, keine automatische Datumsverschiebung in der App. Die Fälle setzen keinen konkreten Plot und keinen Namen fest.

```sh
node tools/mission-pipeline-dryrun.mjs --runs=3 --private-story-cases=analysis/private-outing-v5-4-source-cases.json --live-gemini --out=private-outing-v5-4-live-review.json
```

Dieser Modus ruft die echte `fetchPrivateOutingStory` samt Provider-Adapter, Prompts, Strukturprüfung und Contractübernahme auf. Er hält zwischen den Läufen dieselbe isolierte History (0 → 1 → 2 Einträge), benutzt keine persönliche Browser-History und verändert keinen Cloud-Stand. Er überspringt Zielwahl, automatische Wikipedia-Abfrage, Szene und Flugausführung. Der komplette Ablauf bleibt über den bisherigen Dryrun separat testbar. Die neue Option ist ausschließlich Testinfrastruktur, kein fest eingebauter Orts-/Aktivitätenkatalog in der App.

Ältere gespeicherte `private-outing.v1`-Missionen bleiben lesbar. `creativeBasis` wird nur bei neu erzeugten Ideen verlangt; bereits gespeicherte Kerne werden nicht nachträglich durch `validateIdea` geschickt. Die History benötigt keine zusätzlichen Felder und ihre 64-KiB-Obergrenze bleibt gleich.


### Ergänzung v5.5: Wochenfenster und frühere Anreise

[Quellenbasierte Fälle v5.5](../analysis/private-outing-v5-5-source-cases.json) behalten beim dritten Fall den belegten Konzerttermin am Dienstag, 15.09.2026, setzen den Anflug aber auf Montag, 14.09.2026. Der Planner entscheidet weiterhin selbst, ob er diesen Termin oder eine andere Idee wählt. Es wird kein Konzert-Plot erzwungen.

```sh
node tools/mission-pipeline-dryrun.mjs --runs=3 --private-story-cases=analysis/private-outing-v5-5-source-cases.json --live-gemini --out=private-outing-v5-5-live-review.json
```

Elf lokale Tests einschließlich Wochenbeginn/-ende, Jahreswechsel, vergangener/falscher Termin, Datumsübernahme und Erhalt des Aufenthaltsplans. Das Fenster bedeutet Kalenderwoche (Montag bis Sonntag), nicht pauschal die nächsten sieben Tage. Frühere Anreise erzeugt keine zusätzliche Flugmission und keinen erzwungenen Rückflug. Eine fiktive Aktivität bleibt auch ohne Ereignisquelle erlaubt (`eventVisit=null`).


### Befund der echten v5.5-Serie

Unveränderte Texte und Kerndaten: [Lesefassung](../analysis/private-outing-v5-5-texts.json). Vollständige Anfragen und Antworten: [Live-Testbericht](../analysis/private-outing-v5-5-live-review.json).

- Drei akzeptierte Writer-Ausgaben, keine lokale Prosaersetzung. Die isolierte History wächst 0 → 1 → 2; alte Testserien wurden nicht als History importiert.
- Themen: Masterabschluss/Europa-Park mit Mara, Architekturzeichnen mit Hannes, Weinprobe/Konzert mit Jonas. Drei verschiedene Namen. Das ist eine kleine Stichprobe, keine Garantie gegen Wiederholungen.
- Der dritte Planner wählt selbst den belegten Konzerttermin. `eventVisit.arrivalDate=2026-09-14`, `eventDate=2026-09-15`. Der Writer schreibt passend „morgen Abend“.
- Die erste Story beginnt direkt beim Anlass; die zweite wieder beim Verstauen der Zeichenmappe. Formulierungen wie „Ihr habt euch eine richtig feine Tour vorgenommen“ bleiben generisch. Künstlerische Motive wiederholen sich gegenüber älteren Testserien, die diese isolierte History nicht enthielt.
- Konkrete, aber unbelegte Anschlusslogistik bleibt eine Schwäche: bereitstehendes Taxi und Fahrzeit, Fahrräder am Platz, direkte Mietwagenübernahme. Der Writer macht aus dem Plan teils zusätzliche Wege-/Lagezusagen. Diese sind nicht durch die recherchierten Quellen belegt. Keine nachträgliche automatische Textbereinigung wurde darauf angesetzt.
- Aufenthalt noch unscharf: Der Konzertkern nennt eine gebuchte Übernachtung; der Text legt zugleich Anreise am Montag und Übernachtung nach dem Dienstagskonzert nahe. Der Termin ist korrekt, die Anzahl/Abfolge der Übernachtungen ist damit nicht sauber entschieden. `stayPlan` ist bislang Freitext; Strukturvalidität allein prüft diese Semantik nicht.
- Die erste Idee nennt zusätzlich Voltron, obwohl der mitgeschickte Auszug nur den Freizeitpark allgemein belegt. Der reale Ortsanker ist eine KI-Zusammenfassung, kein Beweis für jede hinzugefügte Sachbehauptung.
- Acht API-Versuche für sechs erfolgreiche Ideen-/Writer-Antworten; zwei Versuche scheiterten mit Timeout/Transportstatus 0 und wurden durch den bestehenden Provider-Fallback behandelt. Es wurde kein dritter kreativer Review-Schritt hinzugefügt.
- Testharness-Korrektur nach der Serie: Der fokussierte Pfad übergibt künftig `missionTitle: mission.t` an `remember`, entsprechend der Missionszusammenstellung im regulären Ablauf. In dieser aufgezeichneten Serie war das kurze History-Titelfeld leer; Anlass, Person, Tätigkeit, Motivation, Einstieg und Ende waren vorhanden. Die Originalaufzeichnung wurde nicht nachträglich verändert.

Nächste sinnvolle Qualitätsprüfung: Anschlusslogistik und zusammenhängender Aufenthalt bereits als bewusste Idee formulieren und bei Bedarf gezielt an derselben Idee reparieren. Nicht wieder eine neue Standardgeschichte einsetzen. Die automatische Kalender-/Quellenintegration bleibt ein eigener offener Schritt; das Wochenfenster und die Übergabe belegter Termine sind vorbereitet und getestet.


## Revision v5.6: Beispielbias und Grenzen der bisherigen Evaluation

Die Nutzerbeispiele wurden in v5.4/v5.5 zu wörtlich in den Produktionsprompt aufgenommen: Weinprobe und Freizeitparkbesuch wurden ausdrücklich als gute Anlässe genannt; Wettbewerbe und Sonderangebote erschienen zusätzlich als kreative Vorschläge. Zugleich enthielt die manuell recherchierte Testgrundlage fast ausschließlich genau diese Ortsmöglichkeiten. Die Live-Serie belegt damit die Ausarbeitung gelieferter Anker und die Terminübergabe, nicht eine selbstständige breite Entdeckung geeigneter Aktivitäten. Der Einfluss von Prompt und Daten lässt sich aus diesen drei Ergebnissen nicht getrennt quantifizieren.

v5.6 entfernt die genannten Aktivitätsbeispiele aus Ideen- und Writer-Prompt. Erhalten bleibt die allgemeine Erlaubnis, einen glaubhaften Anlass passend zu Ort und Personen frei zu erfinden. Die Auswahl beginnt bei Möglichkeiten des Zieles und persönlicher Motivation. Die History unterstützt Vielfalt unter passenden Ideen; maximaler Abstand zur History ist nicht mehr das primäre Auswahlziel. Die strukturierten Felder, Fakten-/Fiktionsgrenze, das Wochenfenster und der technische Missionsvertrag bleiben gleich.

Konkrete Ortsfakten sollen weiterhin konkrete Namen enthalten. Ein belegter Ort ist ein nützlicher Anker, keine unerwünschte Vorgabe an sich. Entscheidend ist, wie breit und unabhängig der Kontext erhoben wird: nur eine Attraktion zu liefern schränkt die Auswahl schon vor der Ideenplanung ein. Der vorhandene Wikipedia-Resolver und seine Auswahl/Begrenzung auf bis zu zehn Fakten sind dadurch noch nicht verbessert. Es gibt weiterhin keine automatische Kalenderrecherche.

Für die nächste Live-Evaluation:

- Ziele unabhängig von den bisherigen Nutzerbeispielen auswählen; mit dem normalen Ortsresolver beginnen und dessen tatsächlichen Kontext protokollieren.
- Mehrere Möglichkeiten eines Zieles aus unabhängiger Ortsrecherche berücksichtigen, ohne daraus ein Pflichtprogramm oder eine feste Kategorienquote zu machen.
- Wiederholte Generationen am selben Ziel mit fortgeschriebener History prüfen, zusätzlich Ziele mit wenig Ortswissen einbeziehen.
- Ursprung und Ergebnis getrennt bewerten: Welche Möglichkeiten standen tatsächlich im Prompt? Was entschied der Planner selbst? Welche zusätzlichen Details erfand erst der Writer?
- Für einen isolierten Promptvergleich dieselben Fakten und dieselbe Ausgangshistory verwenden. Unterschiedliche Orte allein belegen keine bessere Ideenvielfalt.

Lokale Struktur-/Übergabetests wurden nach der Promptänderung erneut ausgeführt. Eine neue echte KI-Serie mit v5.6 wurde noch nicht durchgeführt; die dokumentierten v5.5-Briefings bleiben unveränderte historische Ergebnisse.


## Revision v5.7: Umgebung als Angebot, persönlicher Anlass als gleichwertige Grundlage

Ein Privatflug braucht keine Attraktion. Die Ideenplanung berücksichtigt jetzt ausdrücklich die Beziehung der Beteiligten und die Freude am gemeinsamen Fliegen als eigenständige Gründe. Ein Vorhaben am Boden ist eine weitere Möglichkeit. Der Prompt schreibt keine Rotation dieser Gründe vor und nennt weder einzelne Freizeitaktivitäten noch Ortsbeispiele. Der technische A-B-Vertrag bleibt erhalten, auch wenn das gemeinsame Flugerlebnis den Reisegrund trägt.

### Private Umgebungssuche

`mission-private-context-core.js` ist ein eigener Leser für bestehende Daten. Er verändert weder deren Erzeugung noch die gemeinsame POI-Klassifikation. Nur der `private_outing`-Zweig ruft ihn auf. Der gemeinsame APT-Sightseeing-Wikipedia-Helfer einschließlich seines bekannten Radiusproblems bleibt unverändert und separat zu korrigieren.

- Radius: maximal 50 km Luftlinie vom Zielflugplatz, mit weicher Bevorzugung bis 25 km. Auch bei vielen nahen Punkten bleiben weiter entfernte passende Anker grundsätzlich auswählbar. Es handelt sich um einen Suchraum, keine garantierte vollständige Erfassung.
- Daten: höchstens 16 geschnittene POI-Tiles aus dem bestehenden Raster, vier parallele Ladevorgänge. Nur die POI-Schicht, kein Overpass-/Worker-/Core-/Infra-Fallback. Vorhandene gzip-Dateien werden im Browser gelesen.
- Zusätzlich eine Wikipedia-CirrusSearch-Abfrage `nearcoord:50km,<lat>,<lon>` mit bis zu 20 Treffern, Koordinaten und Kurzbeschreibung. Die Abfrage enthält keine Attraktionsbegriffe, Aktivitäten oder Test-Ortsnamen. Sie verwendet nicht den auf 10 km beschränkten GeoSearch-Radiusparameter.
- Netzwerkbudget: gemeinsamer AbortController nach 3 Sekunden. Netzwerkadapter beachten das Signal; lokale Dekompression, Kandidatenauswahl und Cache-I/O sind keine harte Echtzeitgarantie. Keine generative KI für die Ortsrecherche.
- Kandidatenprüfung: gültige Koordinaten und rechnerische Entfernung innerhalb des Suchraums. Keine Entscheidung nach Gleichheit des Gemeinde-/Flugplatznamens.
- Auswahl: acht kurze Ortssteckbriefe. Gleiche Namen werden zusammengeführt; wiederholte Merkmalsarten und sehr dicht beieinanderliegende Punkte erhalten eine weiche Abwertung. Belegqualität und Entfernung beeinflussen die Auswahl. Das ist eine erste Gewichtung, kein bewiesenes Relevanzranking. Es existiert kein Aktivitätenkatalog für den Planner.
- Koordinaten von Wikipedia-Artikeln können repräsentative Regions-/Institutionspunkte sein; sie belegen keine konkrete Besucheradresse. OSM-Tags belegen weder Öffnung noch Buchung oder Anschlussfahrt. Diese Grenze steht im Datenkontext und im Prompt.
- Ausfälle ergeben einen Teilkontext oder keine Ortsanker. Persönliche Ausflüge bleiben möglich; es gibt keine verpflichtende Ersatzattraktion.

Quelle zur geografischen Suchsyntax: https://www.mediawiki.org/wiki/Help:CirrusSearch#Geo_Search

### Cache und Speicher

Browser-Cache `private-region.v1`, maximal 16 kompakte Regionskontexte, sieben Tage Gültigkeit. Kein neuer Local-Storage-Block mit sämtlichen POIs. Der Service Worker bewahrt genau diesen Cache bei App-Shell-Updates. Wenn CacheStorage nicht verfügbar ist, bleibt ein begrenzter RAM-Cache. Gleichzeitige Anfragen desselben Gebietes werden zusammengeführt. Nur Ergebnisse mit erfolgreicher Wikipedia-Antwort und sämtlichen angefragten Tiles werden langfristig gespeichert; Teilfehler werden beim nächsten Anlauf erneut versucht. Fehlende Gebietsabdeckung kann deshalb zusätzliche Ladevorgänge verursachen und ist als zukünftige Optimierung zu beobachten.

### Ortsbindung vor dem Writer

Der Contract trägt für Privatmissionen `privateRegionContext` und die zugehörigen acht Fakten ohne Verlust ihrer Koordinaten. Der Story-Frame übernimmt nur den räumlichen Rahmen, nicht den gesamten Suchdatensatz. Die KI wählt `groundPlan.factId` oder bewusst null. Bei einer Referenz prüft der Code erneut den Radius, übernimmt Name und Koordinaten aus dem Fakt und hält den Zielflugplatz getrennt vom Ausflugsort. Es wird kein Ziel anhand des Briefingtextes erraten. Die Story bleibt frei formuliert; ein gesetztes `groundPlan` beweist nicht automatisch, dass jede Prosaaussage mit ihm übereinstimmt.

### Sechs Versuche mit selbst ermitteltem Kontext

```sh
node tools/private-region-probe.mjs EDTW EDTF
node tools/mission-pipeline-dryrun.mjs --runs=6 --private-story-cases=analysis/private-outing-v5-7-discovery-cases.json --live-gemini --out=private-outing-v5-7-six-live.json
```

Der Probe liest die lokalen Original-POI-Tiles und führt je Flugplatz die echte neutrale Wikipedia-Suche aus. Beide Adapter verwenden denselben Resolver und dieselbe Auswahl wie der Browser; lediglich lokale Dateizugriffe ersetzen HTTP-Tile-Downloads. Alle Antworten und ausgewählten Kandidaten werden in `analysis/private-outing-v5-7-discovery.json` dokumentiert. Die sechs Vertragsfälle entstehen automatisch aus diesen Ergebnissen, ohne kuratierte Ausflugsziele.

Drei Entwürfe gehen nach EDTW (Start Freiburg), danach drei nach Freiburg (Start EDTW). Alle sechs teilen dieselbe isolierte Variationshistory; die zwei Dreiergruppen starten also nicht jeweils bei null. Es werden weder persönliche Browserdaten noch Cloud-Speicher verändert. Die Story-Tests verwenden den produktiven Ideen-/Writer-/Contractpfad; Flugausführung und Szenen werden zusätzlich mit dem vollständigen Stub-Dryrun geprüft.

Gemessene Entdeckung mit lokal gelesenen Tiles: EDTW 647 ms, Freiburg 462 ms; jeweils elf Tiles und eine Wikipedia-Anfrage. Komprimierte Tiles etwa 433 bzw. 422 KiB, unkomprimiert jeweils etwa 6 MiB. Diese Messung ist keine Browser-/Mobilfunk-Latenzmessung. Der KI-Prompt erhält nur die acht ausgewählten Fakten.

Erster Befund vor Generierung: Europa-Park wurde weder im geprüften Tile-Bestand noch unter den 20 Wikipedia-Treffern gefunden. Es wurde kein speziell auf ihn gerichteter Suchversuch ergänzt. Unter den Kandidaten erscheinen mehrere kleine Denkmäler und allgemeine Verwaltungseinheiten. Das zeigt die Grenze von Datendichte und Relevanzgewichtung; diese Schwäche darf nicht durch eine Verbotsliste einzelner Fundnamen kaschiert werden.


### Befund der sechs Live-Versuche v5.7

[Originalbriefings und Kerndaten](../analysis/private-outing-v5-7-six-texts.json), [vollständiger KI-Testbericht](../analysis/private-outing-v5-7-six-live.json), [automatische Entdeckung samt Wikipedia-Antworten](../analysis/private-outing-v5-7-discovery.json).

- Sechs akzeptierte Writer-Ausgaben, alle unverändert aus der KI übernommen; 13 API-Versuche für zwölf erfolgreiche Ideen-/Prosaantworten, ein fehlgeschlagener Versuch mit Status 0. History korrekt 0 → 5.
- EDTW: Kreuzfelsen, Alternativer Wolf- und Bärenpark, Lorenzkapelle. Freiburg: Universität, Rebhäusle, Heimatmuseum. Alle Anker stammen aus der automatisch gelieferten Auswahl. Keiner wurde im Prompt namentlich vorgeschlagen.
- Sechs unterschiedliche Namen. Dennoch tragen vier Geschichten einen Dank-/Gegenseitigkeitsanlass: frühere Hilfe wird mit dem Flug erwidert. Die History trennt verschiedene Aktivitäten besser als diese gemeinsame Motivstruktur.
- Alle sechs wählen einen Ortsbesuch. Keine entscheidet sich für einen reinen persönlichen Fluggrund oder einen Aufenthalt am Flugplatz. Die ausdrückliche Erlaubnis im Prompt genügt in dieser kleinen Serie noch nicht, um die starke Präsenz der Ortsliste auszugleichen.
- Ortsidentität ist zu knapp: Beim Rebhäusle fügt die Prosa einen Schlossberg hinzu, den die gewählte Faktengrundlage nicht benennt. Aus dem generischen Eintrag Heimatmuseum mit Museum-/Bibliothekstags wird ein konkretes Ahnenarchiv. Die Lorenzkapelle erhält zusätzliche Bestandsdetails und eine Mittagspause. Die allgemeine Erlaubnis zu einem fiktiven Anlass bestätigt solche Angaben über einen realen Ort nicht automatisch.
- Weiterreise bleibt überzeichnet: wiederkehrende Taxis/GAT, einmal eine Übernahme der Luftlinienentfernung als Transferstrecke. Der neue `groundPlan` hält zwar Ort und Absicht, seine Freitexte und ihre Umsetzung sind nicht semantisch verifiziert.
- Sprachlich kehren Ausrüstung, Flugvorbereitung und vorweggenommene Ankunft wieder. Im ersten Text erscheint das Verzurren nach dem bereits beschriebenen Ausflug; die zeitliche Erzählreihenfolge bleibt teils ungeschickt.

Aus diesen Mustern folgt keine Liste verbotener Orte, Namen oder Tätigkeiten. Die nächste Grundlagenarbeit sollte die menschliche Motivation als eigenständige Entscheidung besser von angebotenen POIs trennen und für benannte Ausflugsziele deren Identität/Umfeld genauer vermitteln. Auch die Datengewichtung muss zwischen einem eigenständigen Reiseziel, einem Detailobjekt und einer bloßen Regionsbezeichnung unterscheiden können, ohne eine feste Missionsrotation zu erzwingen. Änderungen an gemeinsamen POI-Parsern oder Importen bleiben eine gesonderte Entscheidung.

Validierung: 18 lokale Tests für History, Ideen-/Writer-Übergabe, Fiktion, Termine, räumliche Auswahl, Fehlerverhalten, gzip-Browseradapter und kompakten Cache. Zusätzlich vollständiger Stub-Dryrun für zwei Privatmissionen. Die gezielten Live-Tests ersetzen keine Prüfung im realen Browser/Simulator; die Quellenrecherche verwendet dort identische Auswahlregeln, aber HTTP statt lokalem Dateilesen.
