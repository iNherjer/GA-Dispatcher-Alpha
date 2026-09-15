# Vereins-/Utility-Ideen V1

Stand: 15.09.2026. Lokal implementiert, Vertragskennung `club-idea.v1`, Promptrevision `club-v1.10`. Alpha-Teststand App v1765 / Tracker v405; realer Simulator-Hörtest ausstehend. Der folgende Entwurf bleibt die fachliche Referenz; die konkrete Umsetzung und verbleibenden Grenzen stehen im nächsten Abschnitt.

## Implementierter Stand und Nachweise

### Kurzer Flug- und Wetterausblick (v1.10, Alpha v1765)

Der Vereins-Writer erhält beim Dispatch die aktuelle Routendistanz und den Wetter-Snapshot über denselben Wettervertrag wie private Missionen. Auch beim Annehmen einer Picker-Idee stammen diese Daten aus dem aktuellen Dispatch, nicht aus dem gespeicherten Vorschlag. Im selben Writer-Aufruf entsteht ein separates `flightBriefing` mit zwei bis drei frei formulierten Sätzen. Es werden keine Musterhandlungen oder Beispielgeschichten vorgegeben.

Die bestehenden Privat-V6-Helfer `flightContext`, `flightBindings` und `resolveFlightBriefing` werden unverändert wiederverwendet: Zahlen und Einheiten werden über Referenzen eingesetzt, vorhandene Entfernung und Böen sind verpflichtend. Start und Ziel bleiben örtliche Momentaufnahmen mit Stationsbezug, keine Vorhersage oder Aussage über unbeobachtetes Streckenwetter. Fehlende Messwerte werden benannt. Ein fehlender oder ungültiger Wetterabsatz bleibt wie im Privat-Pfad aus; die gültige Vereinsgeschichte wird dadurch nicht verworfen. Der Debug-Snapshot enthält Rohabsatz, aufgelösten Absatz und Status.

Der Wetterabsatz wird an die Story angehängt. Ideenvertrag, Landmarken, optionale Voice-Events und Bordbegrüßung bleiben erhalten; die History speichert weiterhin Anlass und narrativen Einstieg. Bereits gespeicherte Missionen werden nicht nachträglich umgeschrieben. Keine Tracker-Änderung nötig.

Nachweis: 34 Tests in `tools/mission-club-ideas.test.cjs`, `tools/mission-weather.test.cjs` und `tools/mission-private-episode-v6.test.cjs` erfolgreich; Syntaxprüfung der drei geänderten JS-Dateien. Die neue Browserprobe prüft frische Werte bei gespeichertem Picker-Vorschlag, Distanz/Böen/Stationsbezug, ungültige Referenzen, fehlende Wetterdaten und unveränderte Begrüßung. Eine neue Live-KI-/Simulatorprobe steht aus. Veröffentlichung mit App v1765; Tracker bleibt v405.

v1.8: Keine Ein-Objekt-Schablone mehr für narrativeEvents im Schemahinweis. Die KI wählt weiterhin frei 0–3 Momente nach erzählerischem Bedarf, ohne Quote oder künstliches Aufteilen. Neue History-Einträge bewahren auch die Gesprächsabsichten; alte History bleibt lesbar. Dass diese Promptänderung tatsächlich eine größere Streuung erzeugt, muss eine weitere Liveprobe zeigen.

Vereinskollegen erhalten gemeinsame lockere TTS-Regie über `mission-boarding-voice-core.js`: verständliche Alltagssprache, natürlicher Rhythmus, keine überdeutliche Bühnenaussprache, kein künstlicher Dialekt. App und Tracker senden diese Regie sowohl an Gemini als auch an OpenAI TTS; andere TaskDomains behalten ihre bisherigen Payloads. Die Textgenerierung fordert ebenfalls ungezwungene Sprache. Ausschmückungen bleiben erlaubt. Bereits erzeugte Audio-Clips werden nicht nachträglich verändert; echte Hörprobe und Release stehen aus.

v1.7 präzisiert nach Nutzerentscheidung: Die Hauptaufgabe bleibt der Flug zum Ziel. Sidequests sind optionale, persönlich oder fachlich ausgestaltete Voice-Erzählmomente zur Immersion. Sie erzeugen keine Aufgaben, Erledigt-Zustände, Pflichtladung oder Abschlussbedingungen. Der gemeinsame Erzählvertrag gilt für Ideenplanner, Writer und Voice; Aktivitäten werden nicht als Beispielkatalog vorgegeben. Technische Tätigkeiten sind als Narration zulässig. Vorhandene echte Lieferpflichten bleiben bestehen.

v1.6 ergänzt alternativ `geo` mit belegter Ankerkoordinate und Radius in NM. Genau eine Triggerart pro Ereignis, gemeinsam maximal drei. Aktuell verfügbare Geo-Anker: Start-/Zielplatz und optional belegter Eventort.

v1.5 ergänzt optionale `narrativeEvents`: null bis drei Gesprächsabsichten mit `atPercent` zwischen 0 und 100 (exklusiv) und `intent` bis 600 Zeichen. Keine Musterhandlungen im Prompt. Fehlende Events bedeuten keine Ansage; ungültige Events werden nicht still auf andere Prozentwerte umgebogen. Die KI definiert keine Wegpunkte, Pflichtaktionen oder bestätigten Ergebnisse. [Technik und Teststand](Mission%20Route%20Voice%20Events.md).

Festlegung v1.4: Jede neu erzeugte Vereinsmission hat genau einen mitfliegenden Vereinskollegen. Pilot und Kollege sind als Team beteiligt; Anlass und Initiative dürfen beim Piloten liegen. `passengerIntent` beschreibt die Beteiligung am gemeinsamen Vorhaben und verlangt keine eigene Nebenhandlung. Ideenplanner, Writer und PAX-Voice-Kontext verwenden diesen Rahmen ohne Szenarienbeispiele. Picker und direkter Dispatch lehnen Ideen ohne vollständigen Mitflieger ab; alte Solo-Vorschläge müssen neu erzeugt werden. Bereits gespeicherte Missionen werden nicht nachträglich umgeschrieben, bestehende History bleibt erhalten. Der Kollege begleitet die Geschichte über die vorhandenen Voice-Phasen; kein neuer Timer oder Runtime-Ablauf. 37 Regressionstests bestanden, neue KI-/Audio-Live-Abnahme noch offen.

Nachbesserung v1.3 nach Nutzerprüfung: `clubConnection` und die aktuelle Memory-Zusammenfassung bleiben Planungsdaten und werden nicht mehr als auszuformulierende Felder an den Writer gereicht. Der konkrete Anlass trägt das Briefing. Ein expliziter Voice-Plan trennt Mitflieger an Bord von Empfängern am Ziel. Die Writer-Begrüßung benötigt bei PAX einen passenden Sprecher, Namen und Ort; bei 0 PAX wird sie verworfen. Solo-Besuche ohne echte Lieferung aktivieren keinen Frachtsprecher mehr. Diese Runtime-Abgrenzung gilt ausschließlich für `club-idea.v1`; alte Missionen behalten ihre Logik. Es gibt keine neuen Szenarienbeispiele oder nachträgliche Briefing-Umschreibung.

Die archivierten Live-Texte unten stammen weiterhin aus v1.2. Für v1.3 sind 36 Club-/Private-/Sim-Regressionstests bestanden; eine neue KI-Textprobe und echte Audio-Abnahme stehen noch aus.

- `mission-club-ideas-core.js`: gemeinsame Ideenentwicklung, Schema-Prüfung, separater Writer, Memory und explizite Trennung persönlicher Sachen von Lieferladung. Genau ein Vereinskollege fliegt mit, auch bei einem Lieferauftrag. Der Vertrag nutzt derzeit Anlass, Vereinsbezug, beide Interessen, Groundplan, Person, Gepäck, Lieferung, Event und Memory; gesonderte `origin`-/`creativeBasis`-Felder des weiter unten beschriebenen Entwurfs sind noch nicht eigene Ausgabefelder.
- `mission-club-browser.js`: Picker und direkter KI-Dispatch. Alte Planner-Aufrufe entfallen für diesen Pfad; neue Verträge umgehen die alten Persona-, Seed- und Prosa-Umbiegungen. Die normale Routeninformation kann die App weiterhin separat ergänzen. Alte/offline Missionen behalten ihren Pfad.
- `mission-club-events-core.js`: ein optionaler Gemini-Aufruf mit Google Search vor den drei Ideen, maximal fünf Treffer, eine Stunde Cache, Quellenabgleich mit Grounding-URLs und Kalenderprüfung. Suchzeitraum bis Sonntag derselben Woche. Maximal 100 vom bestehenden Collector geeignete Flugplätze im eingestellten Suchraum, Event-Zuordnung innerhalb 10 km eines solchen Platzes. Keine automatische Erweiterung über die gewählte Flugreichweite. Andere KI-Provider können Vereinsideen erzeugen, nutzen aber derzeit keine Eventsuche. Suche und Writer erzeugen keine zusätzlichen Runtime-Ziele.
- Ein passender Termin belegt einen Picker-Platz; die übrigen bleiben frei. Suchfehler oder fehlende Belege führen zu drei normalen Ideen. Für einen bereits fest gewählten Direktflug erfolgt keine weitere Eventsuchanfrage.
- Memory: `ga_club_idea_history_v1`, maximal zwölf akzeptierte erzeugte Missionen / 24 KiB UTF-16-Schätzung. Speicherung nach Missionserzeugung, nicht nach jeder Picker-Karte. Lokal pro Origin; keine gesonderte Cloud-History und noch keine zusätzliche Angebots-History für wiederholt sichtbare Termine. Die drei Ideen vergleichen sich untereinander und mit dieser Memory.
- Manifest: persönliche Sachen sind keine Pflichtlieferung; Liefergegenstand bleibt separat erforderlich. Der bestehende PAX-Voice-Kontext bekommt den strukturierten Vereinsanlass. Keine neue zeitgesteuerte Voice-Phase.
- Liveprobe: `analysis/club-ideas-v1-2-briefings.md` und `analysis/club-ideas-v1-2-live.json`. Die drei finalen Texte sind unveränderte KI-Ausgaben. Vorherige Probeberichte bleiben als Fehler-/Qualitätsnachweis erhalten: fehlender Groundplan, missverstandenes Memory-Feld, zu feierliche Sprache und ein falsch als Reiseflugzeug interpretiertes besprochenes Flugzeug führten zu gezielten Promptpräzisierungen. Keine Szenarienbeispiele wurden hinzugefügt. Für die letzte Writer-Runde wurden die drei Ideen wiederverwendet.
- Tests: `node --test tools/mission-club-ideas.test.cjs`; zusätzlich bestehende private Picker-/Return-/Sim-Close-Tests. `analysis/club-v1-integration-review.json` prüft vollständigen Offline-Dispatch und Draft-Annahme aller drei gespeicherten Live-Antworten: Route, Person, unveränderter Storytext und Lieferpflichten. Kein realer Sim-/Audio-End-to-End-Nachweis.
- Die echte Eventsuche lieferte in dieser Probe keinen verwendbaren belegten Treffer. Der positive Event-Picker-Fall außerhalb der ersten drei Plätze sowie der Suchfehlerfall sind mit Fixtures getestet, noch nicht durch einen echten angenommenen Veranstaltungstermin belegt.
- Redaktionelle Beobachtung: Die drei Ideen sind weiterhin fachlich geprägt, unterscheiden sich aber als Beratungsbesuch, gemeinsame Flugplanung und Lieferung. Der Code schreibt keine dieser Aktivitäten vor. Größere soziale Vielfalt ist im weiteren Gebrauch zu beurteilen, statt nachträglich eine Motivquote einzuführen.

## Ziel und Umfang

`club_utility` umfasst Vereinsleben und gegenseitige fliegerische Hilfe. Der Anlass darf sozial, persönlich oder praktisch sein. Ein Lieferauftrag ist eine mögliche Ausprägung, keine Voraussetzung. Bestehende A-B-Lieferungen bleiben erhalten. Der Pilot kann selbst Interesse am Vorhaben haben, gemeinsam teilnehmen oder jemandem helfen. Ein Vereinskollege begleitet ihn immer als Teammitglied an Bord.

Die Nutzersituationen dienen der fachlichen Abnahme, nicht als Beispiele im Produktionsprompt. Es gibt keinen neuen Katalog von Aktivitäten, fest zugeordneten Personen oder vorgeschriebenen Gesprächsinhalten.

Verbindliche Präzisierung: Auch indirekt dürfen keine vorgeschlagenen Geschichten über Seeds, vorausgewählte Personas, Gepäcklisten, Musterantworten oder Reparaturprompts in den neuen Ideenpfad gelangen. Die KI erhält den Vereinsrahmen, ausführbare Abläufe, überprüfte Fakten und ihre tatsächliche History. Konkrete persönliche Ideen entwirft sie selbst. Diese Dokumentation und ihre Abnahmefälle werden nicht als Ganzes in einen Produktionsprompt übernommen. Die History enthält eigene frühere Ergebnisse als Wiederholungsgedächtnis, keine nachträglich eingeschleusten Musterbeispiele.

Kein Pickup-Ausbau in dieser Arbeit. Ein außen gelandeter Segelflugpilot muss zunächst auf dem Boden zum Abflugplatz gelangen. Erst dort beginnt der angebotene A-B-Personentransport zu seinem ursprünglichen Startplatz. Auto, Anhänger und die spätere Rückholung seines Flugzeugs sind der Anschluss am Boden. Weder Außenlandefeld noch Segelflugzeug werden zu einem zusätzlichen Missionsziel. Gegenstandsabholung bleibt ein späterer, noch undefinierter Backlog-Punkt.

## Bestehende Engstellen

- `build...ProposalChoices` im APT-Picker begrenzt zunächst auf drei Flugplätze, wählt Szenarien und Cargo und erzeugt daraus Angebote. Nur Privat V6 hat dort bisher einen eigenen Ideenpfad.
- `_missionPipelineV4ClubUtilitySeed` leitet unter anderem aus Gepäck- und Textwörtern feste Besuchs- oder Liefergeschichten ab.
- `_pickClubUtilityPassengerForCargo` kann die Person passend zum Gepäck neu bestimmen.
- `_missionWriterV5ClubUtilityStoryNeedsRepair` und `_missionPipelineV4ComposeClubUtilityStory` können freie Prosa durch vorgegebene Erzählteile ersetzen.
- Die vorhandenen Semantikregeln beschränken Utility auf Transport/Begleitung/Übergabe und ordnen Vereinsgruppen Charter zu. Für den neuen Ideenpfad muss menschlicher Vereinszweck explizit erlaubt werden; die bestehende Gruppen- und Kapazitätslogik wird dadurch nicht still erweitert.

Die Migration soll ausschließlich Missionen mit dem neuen strukturierten Vereinsvertrag betreffen. Gemeinsame Klassifikation und andere Profile werden nicht durch neue Stichwortregeln verändert. Bestehende gespeicherte Missionen und Offline-Fallbacks behalten ihren bisherigen Pfad.

## Datenfluss

1. Start, Flugzeug-/Routenbeschränkungen, Missionsdatum und vorhandene Auswahlhistorie erfassen.
2. Für den Picker regionale Veranstaltungen recherchieren, bevor die drei endgültigen Ziele feststehen. Parallel gewöhnliche geeignete APT-Kandidaten bereitstellen.
3. Wenn ein belegter und erreichbarer Veranstaltungstermin passt, einen Zielrahmen daran ausrichten. Die übrigen Rahmen bleiben frei. Ohne Treffer entstehen drei normale Vereinsideen.
4. In einem gemeinsamen Ideenaufruf drei unterschiedliche vollständige Ideen entwickeln. Der direkte Dispatch entwickelt eine Idee am bereits gewählten Ziel; er verschiebt dieses Ziel nicht heimlich zugunsten eines Events.
5. Aus dem akzeptierten Ideenvertrag Passenger, Gepäck/Ladung und ein bestehendes A-B-Rezept ableiten.
6. Bei Auswahl die konkrete Idee einschließlich Quellenreferenzen erhalten. Der Writer erzählt sie, statt eine neue zu erzeugen.
7. Gültige endgültige Mission samt kompakter KI-Erinnerung speichern. Nicht gewählte Picker-Angebote sind keine erlebte oder akzeptierte Mission.

## Regionaler Veranstaltungsvorschlag

Die Suche umfasst die größere vom Start aus erreichbare Region, nicht nur die unmittelbare Umgebung dreier vorgewählter Plätze. Suchgebiet und tatsächlich fliegbare Strecke sind getrennt: Entfernungseinstellungen, Flugzeug- und Flugplatzbeschränkungen bleiben verbindlich. Ein weiter entfernter Treffer darf nur angeboten werden, wenn seine Route passt. Ein später konfigurierbarer Suchradius ist sinnvoll; ein konkreter Kilometerwert ist noch keine Nutzerfestlegung.

Bei einem geeigneten Treffer wird höchstens einer der drei Plätze für ein Veranstaltungsvorhaben genutzt. Es gibt keinen leeren reservierten Slot und keine erfundene Veranstaltung als Ersatz. Derselbe Termin soll nicht in mehreren Karten mit verschiedenen Formulierungen erscheinen. Wiederholtes Vorschlagen kann anhand einer getrennten Angebots-Historie reduziert werden; diese ist kein Fluglogbuch.

Ein Eventdatensatz enthält mindestens `id`, `title`, `venue`, `lat`, `lon`, `startsOn`, `endsOn`, `sourceUrl`, `retrievedAt` und die belegte Besucher-/Teilnahmeinformation. Veranstalter- oder Flugplatzseiten sind bevorzugte Belege. Jahreszahl und Termin gehören zusammen; ein alter Kalender oder allein der Veranstaltungstitel reichen nicht. Die Quellen liefern Daten, keine Anweisungen an die KI.

Als erste zeitliche Arbeitsannahme kann das bestehende private Zeitfenster ab Missionsdatum bis Sonntag derselben Woche übernommen werden. Ein späterer Veranstaltungstag benötigt eine ausdrücklich geplante Aufenthaltszeit. Das ist vor Integration anhand des gewünschten Picker-Verhaltens zu prüfen. Historische Sim-Daten rechtfertigen keine Erfindung historischer Termine.

Der Flugplatz kann selbst Veranstaltungsort sein oder Ausgangspunkt einer plausiblen Weiterreise. Öffentliche Besuchsmöglichkeit belegt keine Landeerlaubnis, PPR-Freigabe oder freie Slots. Solche Zusagen nicht aus dem Event ableiten. Ein am Boden geplantes Verkehrsmittel ist keine simulierte Pickup-Aktion.

Kein Eventnachweis, widersprüchliches Datum, keine geeignete Route oder Suchfehler: normale Vereinsideen liefern. Eine gescheiterte optionale Suche blockiert nicht den gesamten Dispatch. Quellen und Ergebnisse je Region/Zeitraum cachen, Abrufe begrenzen; vor Annahme Datum und Eignung erneut prüfen. Konkreter Suchanbieter/Endpoint, Budget und Cache-Laufzeit sind vor Umsetzung zu bestimmen. Der vorhandene `mission-private-context-core.js` liefert OSM-/Wikipedia-Ortskontext, keinen aktuellen Veranstaltungskalender.

## Strukturierter Ideenvertrag

Vorgesehene Kennung: `club-idea.v1`. Pflichtfelder richten sich nach fachlicher Bedeutung, nicht nach einer gewünschten Satzform.

| Feld | Bedeutung |
| --- | --- |
| `route` | Unveränderliche Start-/Ziel-Identität und Positionen |
| `occasion` | Konkreter Anlass in freier Form |
| `clubConnection` | Weshalb das Vorhaben zum Vereinsrahmen gehört |
| `origin` | Initiative und persönlicher Auslöser |
| `pilotIntent` | Interesse oder Beitrag des Piloten |
| `passenger` | Benannte Person mit Beziehung/Rolle und Persönlichkeit, oder null bei reinem Frachtflug |
| `passengerIntent` | Anliegen der mitfliegenden Person, falls vorhanden |
| `groundPlan` | Was die Beteiligten nach der Landung vorhaben |
| `loadout` | Aus der Idee abgeleitete persönliche Sachen und/oder konkrete Lieferladung |
| `delivery` | Nur bei echter Lieferung: Gegenstand, Empfänger und Verwendungszweck; sonst null |
| `eventVisit` | Nur bei belegtem Event: Quellen-ID, Datum, Besuchsabsicht, gegebenenfalls Aufenthalt; sonst null |
| `creativeBasis` | Trennung belegter Tatsachen von persönlicher Fiktion |
| `memory` | Kurze KI-Zusammenfassung von Anlass, Beziehung, Interessen und Eigenheiten |

Die erste Fassung nutzt vorhandene Einzelpassagier-/Cargo-Abläufe und deren Kapazitätsregeln. Sie führt keine neue Vereinsgruppenlogik ein. Gepäck ist keine versteckte Klassifikation: Erst der ausdrücklich gesetzte Lieferzweck macht einen Gegenstand zur Pflichtlieferung. Ungewöhnliche persönliche Dinge dürfen keine Persona-Umschreibung auslösen.

## Promptgrundlage

Vorgesehener Kern des Ideenprompts, ohne Nutzungsbeispiele:

> Entwickle einen konkreten, glaubwürdigen Anlass aus dem Vereinsleben und der gegenseitigen fliegerischen Hilfe. Entscheide frei, welches persönliche, gemeinsame oder praktische Interesse diesen Flug sinnvoll macht. Der Pilot darf selbst beteiligt sein. Entwickle Menschen, Absichten und den nächsten Schritt am Boden zusammen; leite erst daraus mitgeführte Dinge und einen möglichen Lieferauftrag ab. Verwende bestätigte Orts- und Veranstaltungsdaten nur dort, wo sie zur Idee passen. Persönliche Vorgeschichten und Verabredungen dürfen erfunden sein. Nutze die bisherigen Ideen als Erinnerung an bereits verwendete Anlässe und Erzählmuster und entwickle die neuen Vorschläge eigenständig und untereinander verschieden. Halte die vorgegebenen Flugrouten und ausführbaren Abläufe ein.

Für einen mit Event belegten Picker-Rahmen liefert der Input ausschließlich den bestätigten Veranstaltungsdatensatz und die fachliche Vorgabe, diesen geeigneten Termin in einem der drei Angebote zu berücksichtigen. Personen, Beziehung, persönliche Besuchsmotivation, Gesprächsinhalte und kleine Vorgeschichten werden nicht vorgegeben. Diese entwickelt die KI selbst. Die anderen zwei Ideen erhalten keine Verpflichtung, die Veranstaltung ebenfalls aufzugreifen. Erst die akzeptierte KI-Idee bindet den nachfolgenden Writer an ihren konkreten persönlichen Anlass.

Der Writer erhält die ausgewählte Idee, Quellen und gebundene aktuelle Flug-/Wetterwerte. Er erzählt kurz und natürlich aus außenstehender Perspektive mit du/ihr; nur PAX-Greeting und spätere PAX-Texte sind direkte Rede. Kein Pflichtaufbau aus Anlass, Mappe, Empfänger und Komfortsatz. Er darf persönliche Details ausgestalten, aber weder Auftrag, Identität noch reale Eventdaten austauschen.

## History und Validierung

History enthält nur kompakte tatsächlich generierte Inhalte: Anlass, Vereinsbezug, Beziehung, Initiative, Interessen, markante Details und Erzählweise. Keine feste Motivrotation und keine zusätzliche KI-Anfrage nur zur Zusammenfassung. Vorhandene Namen-/Variantenhistorie berücksichtigen. Speicherbudget und Synchronisationsumfang explizit dokumentieren; lokale History ist keine geräteübergreifende Erinnerung.

Prüfen: Schema, Route, Kapazität, Identitäten, Liefer-/Passagierpflichten, Eventquellen und Termine, ausführbarer A-B-Abschluss. Freie Aktivitäten nicht anhand von Storywörtern klassifizieren. Optionale fehlerhafte Metadaten dürfen entfernt werden, ohne eine brauchbare Geschichte umzubauen. Bei ungültigen Pflichtdaten die konkrete Ursache anzeigen; keine lautlose Ersatzmission. Wiederholte Generierung ist kein regulärer Ersatz für einen sauberen Vertrag.

## Abnahme und Umsetzungsschritte

1. Vertragsmodul und Tests: sozialer Besuch ohne Frachtübergabe, echte Lieferung, Personenhilfe mit vorherigem Bodentransfer; keine Außenlandefeld-Aufnahme.
2. Event-Resolver und Tests mit gespeicherten Quellenfällen: außerhalb der bisherigen engen Zielauswahl, veraltet, nicht erreichbar, mehrere Treffer, kein Treffer, Suchfehler. Diese Fälle sind Testdaten, keine Promptbeispiele.
3. Picker: genau drei unterschiedliche Ideen; passendes Event höchstens einmal; Auswahl bewahrt Anlass, Identität und Quellen.
4. Dispatch-/Writer-Integration: neue Verträge umgehen ausschließlich die alten club-spezifischen Seed-, Persona- und Prosa-Umbiegungen. Alte Verträge bleiben kompatibel.
5. Manifest-/Runtime-Regression: persönliches Gepäck erzeugt keine künstliche Lieferung, echte Lieferungen behalten Pflichtentladung, Personenflüge behalten Boarding und Deboarding.
6. Wenige gezielte Live-Generierungen prüfen: KI-Rohtext gegen angezeigten Text, freie Ideen ohne feste Beispiele, Weitergabe des Anlasses an Voice, Eventbelege und API-Kosten.

Die obige Reihenfolge war die Grundlage der Umsetzung. Den tatsächlich implementierten Umfang und noch offenen Live-Nachweis beschreibt der Abschnitt „Implementierter Stand und Nachweise“.

## v1.9 / Alpha-Kandidat v1764 und Tracker v405

Belegte zusätzliche Geo-Anker aus Streckenmitte/Ziel, unveränderte Anker bei Angebotsannahme und persistente History tatsächlich abgespielter Vereinsansagen. Keine Musterhandlungen, keine Ereignisquote, keine neuen Abschlussbedingungen. Details und Testgrenzen im Routen-Voice-Vertrag.
