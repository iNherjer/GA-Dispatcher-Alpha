# POI-Briefings: Abgleich und Rückführung auf das APT-Rezept

Stand: 28.09.2026. Auftrag: bewährte APT-Erzählmethode auf POI erweitern, zusätzlich Zielgebietsbericht. Keine Migration der Missionsausführung.

## Was abgewichen war

Die Referenz ist [Mission Narrative Implementation Recipe](Mission%20Narrative%20Implementation%20Recipe.md), ergänzt durch [Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md). Privat, Verein und Charter haben bereits familienbezogene Ideen-/Writer-Prompts und Browseradapter. Es gibt keinen einzigen fertigen Universal-Writer, dessen unveränderte Chartergeschichte für einen POI-Aufnahmeauftrag geeignet wäre. Ein POI-spezifischer Ideenkern ist deshalb sinnvoll; ein eigener Forschungs- und Ablaufumbau war daraus nicht abzuleiten.

| Bereich | Abweichung im POI-Versuch | Korrigierter Stand |
| --- | --- | --- |
| Flugabsatz | Nur Lagebericht; vorhandene Wetter-/Distanz-Helfer nicht eingebunden | Direkte Wiederverwendung von `MissionPrivateEpisodeV6.flightContext`, `flightBindings`, `resolveFlightBriefing` wie Verein/Charter |
| Writer-Erinnerung | Nur Person, Situation und Absicht gespeichert | Writer liefert `memory` im selben Aufruf; tatsächlicher Story-Einstieg und Memory werden mitgespeichert und im nächsten Writer übergeben |
| Erzählperspektive | Eigener kürzerer Pilot-Prompt statt vollständiger APT-Vorflugregeln | Bewährte Vorflugperspektive und Stilanforderungen übernommen; POI-spezifisch bleibt der Foto-/Videozweck |
| Kontext | Pilot hatte manuell recherchierte Ortsbeschreibungen, App überwiegend Typ-Tags | App und Liveprobe verwenden denselben Adapter; vorhandener APT-Kontextdienst und passende vorhandene POI-Zielbelege werden genutzt. Dünne Belege bleiben als Grenze sichtbar |
| Validierung | Wörtlicher Zielname verlangte unnatürliche Grammatik; Zusatzbericht konnte Story verwerfen | Ziel-ID strukturiert gebunden. Fehler in optionalem Flugabsatz, Memory oder Landmarkenauswahl ersetzen/verwerfen keine gültige Geschichte |
| Testtransport | Eigenes `JSON.parse` war strenger als der bestehende App-Parser | Liveprobe führt den tatsächlichen `_missionParseJsonTextDetailed` samt Balanced-Object-Helfer aus; keine Änderung am gemeinsamen Parser |
| Umfang | Professionelle Medienideen teilweise als Inspektion bezeichnet; separater Tracker-Befund als Folgeauftrag dargestellt | Neuer Pfad bleibt `media_photo`; professionell/privat ergeben sich aus der Idee. Keine neue Startfunktion oder Tracker-Migration |

## Wiederverwendung im Code

- `mission-poi-briefing-browser.js` orchestriert wie `mission-club-browser.js`: Idee bewahren, frische Flugwerte übernehmen, ein Writer-Aufruf, vorhandenen Vertrag befüllen.
- `MissionPrivateEpisodeV6` liefert unverändert Flugkontext, Wertebindungen und Flugabsatz-Prüfung.
- `MissionCharterIdeasCore.resolveReferences` löst unverändert die bekannten Referenzen in Textfeldern auf.
- `MissionPrivateContextCore.resolveBrowser` liefert unverändert den begrenzten Ortskontext mit Cache und Zeitbudget. Für die POI-Geschichte werden daraus nur gleichnamige, koordinatennah belegte Zielobjekte übernommen. Benachbarte Sehenswürdigkeiten dürfen nicht zum neuen Missionsziel werden. Bereits vorhandener akzeptierter POI-Wissenskontext kann ergänzen, wenn Titel und Ortsbindung passen.
- Bestehender KI-Transport und Parser bleiben unverändert. Privat-, Vereins- und Charterdateien wurden für diese Korrektur nicht geändert.
- Die neue Ergänzung ist der POI-Lagebericht mit lokalen Landmarken-/Hindernispunkten und vorhandenen Geländestichproben. Er definiert keine Runtime-Parameter.

Der eigene Vertrag `poiBriefing` bleibt für Persistenz und gezielten Schutz vor alten Textreparaturen notwendig, analog zu `clubIdea`, `charterIdea` und `privateOuting`. Ein lokaler Alpha-Schalter erlaubt den Vergleich. Er ist keine neue Missionsausführung.

## Fehlergrenzen

Ungültige primäre Identität, unbekannte Story-Beleg-IDs oder fehlende eigentliche Texte bleiben echte Fehler. Ein ungültiger Wetterzusatz wird dagegen als `unavailable` diagnostiziert; die Geschichte bleibt erhalten, wie im Vereins-Pfad. Bei ungültiger optionaler Orientierungswahl nimmt der Code höchstens zwei vorhandene Landmarken und kennzeichnet `source-selection-fallback`; er erfindet keine Referenzen. Ungültige Memory wird nicht als verlässliche Erinnerung gespeichert. Keine neue Regex-Klassifikation und keine automatische Ersatzgeschichte.

History bleibt lokal, höchstens zwölf Einträge und 12.000 serialisierte Zeichen. Gleiche Missions-ID ersetzt ihren Eintrag. Ein gespeicherter Entwurf ist kein Nachweis eines geflogenen gemeinsamen Erlebnisses. Ältere Einträge ohne Writer-Memory bleiben lesbar.

## Prüfung

75 Tests bestanden: neue POI-Verbindungen, eingefrorene Pilot-Prüfungen, Wetter, Charter, Verein, Speicherung und gemischter Picker. Neu geprüft werden direkte Verwendung der APT-Wetterwerte, unveränderte Story bei defektem Zusatzabsatz, Writer-Memory, Direktdispatch und Zielbindung beim übernommenen APT-Ortskontext.

Die neue Liveprobe liegt unter `analysis/poi-briefing-alpha-v2/`. Sie startet mit den zwei tatsächlich gespeicherten Ideen der vorherigen App-Serie, nicht mit leerer History. Maximal drei Missionen, ein gemeinsamer Ideenaufruf und drei Writer. Keine Modellwiederholung für Formatkorrekturen. Ein zusätzlicher schließender JSON-Klammerrest der Ideenantwort wird vom bereits bestehenden App-Parser verarbeitet; die Rohantwort wurde nicht verändert oder erneut angefordert. Der ursprüngliche Probe-Parserfehler und die anschließende App-Parser-Wiedergabe sind dokumentiert.

Die wiederverwendete regionale Kontextsuche lieferte in diesem Durchlauf keine zusätzlichen passenden Zielbelege. Deshalb enthält der Rahmen weiterhin nur lokale Typbelege. Die Code-Wiederverwendung darf nicht als erfolgreiche neue Quellenabdeckung dargestellt werden. Wald, Baustoff, genauer Pfeileraufbau oder sonstige Ortsdetails sind damit nicht automatisch belegt. Die Ergebnisse müssen entsprechend redaktionell gelesen werden.

Der zuvor bei breiteren Tracker-Tests gefundene fehlende `_buildMissionPoiExecutionSeed` gehört zur bestehenden gemeinsamen Missionsausführung. Für ihn wurde hier kein neuer Startpfad gebaut. Er ist getrennt vom Briefingvergleich zu verfolgen; erfolgreiche Text-/Speichertests beweisen keine vollständige Simulatorausführung. Kein Push oder Rollout in diesem Arbeitsschritt.


### Ergebnis der Drei-Fälle-Serie

Vier Gemini-Aufrufe, 16.954 vom Anbieter gemeldete Tokens; drei formal gültige Hauptbriefings, kein neuer Ideenaufruf und keine Writer-Reparatur. Writer-History 2 → 3 → 4, alle drei Memories gespeichert. Themen: professionelles Stadtmagazin, Unterrichtsvideo, Modellbauvorlage. Berichtsauswahl in allen Fällen gültig.

Keine pauschale redaktionelle Abnahme: Der dritte Writer erweitert eine Foto-Vorlage zur exakten geometrischen Übernahme für ein Modell. Allein der Wunsch nach einem detailgetreuen Modell rechtfertigt keine solche Leistungszusage des Flugs. Zudem sind Mauerwerk/Wald/Alpen-/Brennerbezug in den schmalen tatsächlich gelieferten Storybelegen nicht vollständig belegt. Einzelne Floskeln und ähnliche Einstiege bleiben vorhanden. Die Übertragung der bewährten Architektur ist damit geprüft, nicht die dauerhafte Erzählqualität bewiesen.

Alle drei frei formulierten Wetterabsätze verwendeten unbekannte Referenzen und wurden vom unveränderten V6-Resolver verworfen; die Hauptgeschichten blieben erhalten. Es waren bewusst keine Wetterbeobachtungen eingespeist. Nach Auswertung wurde dafür auch die bereits im Charterpfad vorhandene Behandlung übernommen: ohne verwertbare Beobachtungen ein ehrlicher knapper Datenlückenhinweis (`no-observations`), kein weiterer KI-Aufruf. Vorhandenes Wetter mit fehlerhaftem Absatz bleibt separat `unavailable`. Beide Fälle sind offline geprüft; Rohantworten und ursprüngliche Live-Diagnose bleiben unverändert.

Die Serie wird an dieser Stelle ausgewertet und beendet. Keine weiteren kostenpflichtigen Läufe zum Schönrechnen. Fortgesetzte Arbeit sollte die Belegversorgung und Treue des Writers zum vorhandenen Aufnahmeauftrag prüfen, keine neue Runtime, keine Motivlisten und keinen weiteren Pilot-Sonderweg entwickeln.

## Bestätigungslauf nach Nutzerfreigabe (Alpha v3)

Promptstand `poi-photo-apt-v1.1`; unveränderte APT-Helfer, unveränderte Runtime. Die praktische Foto-/Videoleistung bleibt auch dann unverändert, wenn der Passagier später ein anspruchsvolles Vorhaben verfolgt. Die Idee ist persönliche Fiktion, keine zusätzliche Quelle für reale Ortsmerkmale. Flugreferenzen werden wie beim APT-Writer als vorhandene Schlüssel ausdrücklich aufgelistet.

Der Picker verwendet nun auch die APT-Ausgabehülle `{ideas:[...]}`. Die lokale POI-Identitätsprüfung akzeptiert zusätzlich eine direkte Liste und das historische ID-Objekt. Jede Zuordnung verlangt genau eine passende `targetId`; weder Reihenfolge noch Prosa bestimmen das Ziel. Doppelte und fehlende Zielideen bleiben Fehler. Keine Änderung am gemeinsamen Parser oder an fremden Missionsprofilen.

Die ersten drei Liveideen lagen als direkte Liste vor und wurden zunächst vom alten POI-Adapter abgelehnt. Dieselbe unveränderte Rohantwort wurde nach dieser Adapterkorrektur erneut eingelesen, mit identischen Kontextframes und ohne zusätzlichen Gemini-Aufruf. Diese technische Verarbeitung ist ausdrücklich kein neuer Ideenentwurf. Details, Code-Snapshots und Rohantworten: `analysis/poi-briefing-alpha-v3/`.

76 Regressionstests bestanden. Der neue Test prüft dieselbe Idee durch alle drei strukturell gleichwertigen Ausgabeformen sowie das Ablehnen fehlender/mehrfacher IDs. Der Lauf beginnt mit fünf gespeicherten Vorgängerideen. Kein Push und keine globale Aktivierung.

### Auswertung Alpha v3

- Genau vier Gemini-Aufrufe (drei Missionen), 27.867 gemeldete Tokens. Keine Neuentwürfe oder Writer-Reparaturaufrufe. Nach einmaliger technischer Containerkorrektur drei formal übernommene Briefings; Rohantworten unverändert.
- History im Writer: 5 → 6 → 7. Alle drei Lageberichte mit gültiger Landmarkenauswahl. Fehlende Wetterbeobachtungen werden wie bei Charter als Datenlücke behandelt; dieser Erzähltest enthält kein Livewetter.
- Fotozwecke: Gemäldevorlage, professioneller Wanderführer, privates Bildarchiv. Die ersten beiden bleiben Aufnahmeaufträge. Der dritte Writer ergänzt das Studieren technischer Details und umfassende Dokumentation; das überschreitet den ausgewählten Übersichtsfotozweck.
- Quellenbindung ist nicht gelöst: Sandstein/Bögen/Flussufer beziehungsweise dichter grüner Wald werden trotz lediglich gelieferter Typbelege ausgeschmückt. Der Writer behandelt Teile der erfundenen Idee weiterhin als Ortswissen.
- Wiederholungen sind noch erkennbar: Gemäldevorlage aus einer früheren Serie, Publikationszwecke aus mehreren Serien. Die damalige verworfene Maler-Geschichte war nicht in der History angenommener Briefings; das erklärt die fehlende Vergleichsreferenz, beweist aber keine hinreichende Vielfalt.

Ergebnis: Übertragener APT-Ablauf technisch geprüft, **keine vollständige inhaltliche Freigabe**. Die gewünschte geringe Ausschussrate darf nicht aus der formalen Annahmequote abgeleitet werden. Nach drei Missionen beendet und ausgewertet. Nächster Ansatzpunkt ist die tatsächliche Zielbelegversorgung und die Treue zum ausgewählten Aufnahmeauftrag, nicht ein anderer Missionsstart oder weitere nachträgliche Regex-Reparaturen. Vollständige Texte: `analysis/poi-briefing-alpha-v3/briefings.md`; strukturierte Bewertung: `review.json` im selben Ordner.

## Nutzerbewertung und Aufnahmefokus (v1.2)

Der Nutzer bewertet die Texte der Alpha-v3-Serie grundsätzlich positiv. Das Interesse eines Passagiers an sichtbaren Details ist für sich genommen kein Ablehnungsgrund. Die vorige Bewertung des Ingenieurtexts war insoweit zu streng: Die gewünschte Korrektur ist, sein Interesse als Wunsch zu formulieren, diese Details zu fotografieren. Fachliches Interesse darf den Fotozweck tragen, ohne eine Bordbewertung oder Messung daraus zu machen.

Idee und Writer sind entsprechend positiv präzisiert: Je nach Anlass dürfen POI, gewünschte Ansichten und belegte sichtbare Einzelheiten stärker im Mittelpunkt stehen; die persönliche Vorgeschichte darf kürzer sein. Keine Motivliste, festen Perspektiven oder obligatorische Foto-Checkliste. Die KI entwickelt den Bildwunsch selbst. Sichtbare Details sind mögliche Motive, keine zugesicherte Auflösung oder neue Vollständigkeitspflicht. Die Regeln für Ortsbelege bleiben bestehen.

Promptrevision `poi-photo-apt-v1.2`; keine Änderung an Ablauf, Schema, Runtime oder Validierung. Vorhandene Rohtexte bleiben unverändert. Syntax und bestehende POI-Tests geprüft; für diese kleine redaktionelle Anpassung kein weiterer kostenpflichtiger Live-Aufruf.


## Alpha-Release nach Bestätigungslauf (28.09.2026)

Prompt `poi-photo-apt-v1.2`: drei neue Gemini-Briefings, alle redaktionell angenommen, keine Verwerfung oder Reparatur. Ein Ideenaufruf und drei Writer. Bildband (Stadtarchivarin), touristischer Videoclip (Auftraggeber), Fotos für eine Facharbeit (Nichte). Auch fachliches Interesse bleibt ausdrücklich Fotowunsch; kein Auftrag zum Messen oder Bewerten an Bord. Ähnliche Einleitungen und Publikationsmotive bleiben mögliche qualitative Verbesserungen, aber kein Auftragswechsel.

Lokale Laufbelege: `analysis/poi-briefing-alpha-v4/` (nicht Teil der Veröffentlichung). History im Writer 8 → 9 → 10; gültige Lageberichte. Die Liveprobe enthält keine Wetterbeobachtungen oder Geländehöhen und keinen Simulatorflug. Quellenabdeckung bleibt begrenzt; der Bericht benennt die Lücken. Drei erfolgreiche Texte belegen keine dauerhafte Null-Ausschussrate.

Release auf aktuellem `origin/main` in isoliertem Worktree. Der Foto-Generator ist für KI-POI-Profil `media_photo` standardmäßig aktiv. Lokaler Rückfallschalter: `ga_poi_briefing_v1=off`. Ketten, Folgeaufträge, Planung, Bush und andere POI-Profile behalten ihre bisherigen Wege. Keine neue Startfunktion, kein Runtime- oder Tracker-Umbau. Alpha-Webcache v1874.

95 automatisierte Tests bestanden (POI, Wetter, Charter, Verein, gemischter Picker, Sightseeing, normale und fragile Fracht). Zusätzlich 11.550 POI-Vergleiche zur bisherigen Ausführung bestanden. Ein bereits auf unverändertem Release-Stand defekter Vereins-Testharness wurde um `window:{}` ergänzt, wie beim Sightseeing-Harness; kein Produktionscode dafür geändert. Wiederholbare POI-Tests verwenden eine eingecheckte, reduzierte Archivfixture statt nicht veröffentlichter Analyseordner. Die früheren Nichtfreigaben oben dokumentieren frühere Zwischenstände.
