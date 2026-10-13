# Gemeinsame Start- und Zielseiten

Stand: 13.10.2026, Alpha-Rollout mit Web-Cache `ga-dispatcher-v2042`, Basis `1aeee31fc`.

Die bestehende Bush-Platzredaktion wird bei neuen KI-Missionen auch für APT-Start/Ziel und POI-Starts verwendet. POI-Ziele erhalten einen eigenständigen sachlichen Objekt-/Gebietstext mit Hinweisen für die vorhandene Aufgabe. Bestehende Missionsprofile, Ideen, Runtime, Höhen, Muster, Manifest und Abschlussbedingungen bleiben maßgeblich. Freiflug/Planung aktiviert den neuen Kontextabruf nicht; gespeicherte ältere Missionen werden nicht nachträglich von der KI umgeschrieben.

## Gemeinsamer Anschluss

`MissionAirportInformationCore.pagesPrompt(contract, poiContext?)` ergänzt den vorhandenen Writer-Prompt um Start-/Zielplatztexte und gegebenenfalls den POI-Text. `acceptPages(raw, contract, poiContext?)` übernimmt die optionalen Seitentexte in den bestehenden Vertrag und gibt die bisherigen narrativen Felder zurück. Platz-/Zielzahlen werden so nicht durch die separate Wetterreferenzprüfung der Story-Writer geschickt.

`MissionAirportInformationBrowser.writePages(prompt, contract, poiContext, request)` komponiert diese beiden Schritte mit dem vorhandenen Profil-Request. Es gibt keinen zusätzlichen KI-Aufruf für die Seiten. Ideen-Picker, Erlebnisplanung und Wetterkorrekturen bleiben eigenständige bestehende Schritte und erhalten keine Seitenredaktion.

Angeschlossen sind die APT-Writer für Charter, Verein/Utility, Cargo, fragile Fracht, Tiertransport, medizinischen Transfer, Reporter, Sightseeing sowie die privaten Hin-/Rückflug- und Trainingswriter in `app.js`. Die POI-Writer für Foto, Infrastruktur, Biologie, Geologie, Fire Watch, Reporter, Mapping, Wissen/Sightseeing, Ketten und SAR verwenden ihren bereits gewählten Shared-Kontext. Mapping-Fortsetzungen und die generischen V4/V5-/Legacy-Writer sind ebenfalls angeschlossen. Bush-Recon behält seinen eigenen bestehenden Objekt-/Beobachtungsvertrag.

## Quellen und Darstellung

- Flughafenidentität, eigene Bahndaten, örtliche Wiki-/FAA-Belege, Cache und Abruffristen stammen aus dem bestehenden Airport-Information-Service.
- POI-Lage, Geländehöhen und Hindernisse stammen aus `mission-poi-briefing-shared-*`. Keine zweite Geometrie- oder Wetterlogik. Der allgemeine POI-Pfad lädt nur das ausgewählte Ziel, nicht die Picker-Kandidaten.
- Reale Ortsangaben sind quellengebunden. Allgemeine Planungshinweise begründen keine lokalen Verfahren, Hindernisfreiheit oder Leistungszusage. Persönliche Story und gemeldeter Schaden sind keine Ortsbelege.
- `airportInformation`, `departureAirportInformation` und `poiInformation` sind getrennt vom narrativen `flightBriefing`-Wetterfeld. Die bestehenden Platzdaten-Fallbacks bleiben erhalten; ein ungültiger/fehlender POI-Seitentext fällt auf den gemeinsamen belegten Lagebericht zurück.
- `poiInformation` speichert Schema, Zielkoordinaten, Text, `generated` und einen Shared-Quellensnapshot. Der volle temporäre `poiInformationContext` wird nach dem Writer aus dem Missionsvertrag entfernt.
- Lokale Quota- und Cloud-Kompaktierung bewahren die Seitendaten. Die Renderer prüfen die Ziel-/Startkoordinaten erneut und schreiben mit `textContent`. Eine Rückkehr oder Zielverschiebung darf keinen früheren Zieltext am neuen Ort anzeigen.
- Vorhandene AIP-, METAR-, Pisten- und Frequenzanzeigen bleiben erhalten. Die APT-Zielseite kann den bestehenden tatsächlichen Ankunftsplan ergänzen; der Writer erfindet keinen Abholpunkt.

Zusätzlicher Kontext und Text erhöhen den Umfang des bestehenden Writer-Aufrufs. V4/V5 und private Writer bekommen bei vorhandenen Seitenkontexten eine begrenzte 40-Sekunden-Frist; der bestehende Bush-Writer behält 45 Sekunden. Die bereits auf 40 Sekunden ausgelegten Profilwriter behalten ihre Frist.

## Prüfung

Neue Integration: `tools/mission-briefing-pages.test.cjs` prüft echte Charter-/Foto-Adapter mit synthetischen Writer-Antworten, unveränderte Auftragsidentität, ein Writer-Request, optionale Rückfälle, JSON-/Quota-/Cloud-Roundtrip und koordinatengebundene Anzeige.

`tools/airport-information-browser.test.cjs` prüft zusätzlich APT-/POI-Anzeige und Restore in echtem Headless-Chrome, Trennung der beiden Seiten, HTML-Injektionsschutz und Zielwechsel. Syntaxprüfung und `git diff --check` gehören zur Verifikation. Die profilbezogenen APT-/POI-Regressionen laufen ergänzend.

Sieben ältere Testfälle scheitern außerhalb der neuen Integration: Der Knowledge-Serializer-Test stellt kein `window` für die existierende Serialisierung bereit; die Shared-Extraktionsfixture erwartet einen älteren Foto-Writer-Prompt-Hash. Für den zweiten Fall liefert der originale `origin/main`-Writer denselben abweichenden Hash wie der lokale unveränderte Foto-Core. Fünf isolierte Manifesttests laden `_missionCargoGenerateManifest` ohne seinen bereits bestehenden Helfer `_missionCargoManifestCore`; `mission-cargo-core.js` ist unverändert gegenüber Origin. Diese Fehler werden durch die Seitenintegration nicht behoben oder ausgeblendet.

Prüfergebnis: 370 erfolgreiche Testfälle über Missions-, Shared-, APT- und Browser-Suiten; sieben oben beschriebene bestehende Testprobleme. Die fehlerfreie Kernauswahl umfasst 247 Tests, hinzu kommen zwei erfolgreiche echte Browser-Tests. Logs: `analysis/briefing-pages-2026-10-13/`.

Die Tests prüfen technische Verträge und Darstellung. Es wurde keine neue Live-KI-Serie durchgeführt; Formulierung und Quellenbindung freier KI-Prosa benötigen weiterhin eine inhaltliche Sichtung an frisch erzeugten Missionen. Alpha-Rollout vom Nutzer für Tests im laufenden Betrieb freigegeben. Kein Tracker-Build erforderlich; die Tracker-Runtime wurde nicht geändert.

## Korrektur nach lokalem Freiburg-Ergebnis, 13.10.2026

Der erste Anschluss übernahm auch einen reinen Pisten-/Platzdaten-Fallback als
fertige Seitenbeschreibung und beendete damit den bisherigen Wiki-/Bildabruf.
Das war eine sichtbare Verschlechterung. Für APT-/POI-Starts und APT-Ziele
ersetzt dieser Fallback keinen vorhandenen oder nachgeladenen Wiki-Artikel
mehr. Der zusätzliche Platzplanungsblock wird nur bei angenommenem KI-Text
angezeigt, damit reine Bahndaten nicht nochmals als Textwand erscheinen.

Auch bei angenommenem KI-Seitentext wird das Wikipedia-Bild nachgeladen;
dessen Abruf darf den angenommenen Text nicht überschreiben. Späte Antworten
prüfen weiter den Dispatch-Commit. Die bisherigen Bush-Seiten behalten ihren
bestehenden Pfad. Verfügbare bereits geprüfte deutsche Artikeltitel werden für
den Bild-/Artikelabruf wiederverwendet.

Die neue APT-Redaktion verlangt einen Überblick in kurzen Absätzen über belegte
Lage, Charakter, Geschichte, Nutzung, Einrichtungen und örtliche Pilotentipps.
Die technische Pistenliste bleibt im eigenen Datenblock. Bush verwendet weiter
seinen bisherigen technischen Prompt; POI-Starts nutzen den Überblick.

Der Debugbericht zeigt nun auch für APT/POI den KI-/Fallbackstatus der Seiten,
Quellenabrufstatus und Bildcontainerstatus. Das lokale Nutzerprotokoll allein
enthielt diese Seitenfelder bislang nicht; der konkrete Writer-/Quellenstatus
seines Beispiels lässt sich daraus nicht abschließend rekonstruieren.

Zusätzliche Prüfungen: echter `fetchAreaDescription`-Pfad für Wiki-Artikel und
Bild neben Fallback beziehungsweise KI-Text, Fotoausfall, abgebrochener Dispatch
und getrennte APT-/Bush-Prompts. Keine neue Live-KI-Ausgabe als Qualitätsbeleg.

Fehlt auch der Wiki-Artikel, zeigt die APT-Seite eine kurze Information über
fehlenden Ortskontext; die bereits sichtbaren Bahndaten werden nicht nochmals
als Fließtext wiederholt. Ein zum selben gespeicherten Seitenkontext gehörendes
Bild wird beim Nachladen erhalten. Neue Regression für diesen Ausfallpfad.

## Korrektur der Dispatch-Übergabe, 13.10.2026

Das zweite lokale Charter-Protokoll zeigte verfügbare deutsche Wiki-Quellen für
beide Plätze, aber nur Basisdaten-Fallbacks für die Seiten. Die direkten
Ideenwriter erzeugen kompakte Missionsverträge und umgehen
`buildMissionContractV4`; deshalb fehlten ihnen trotz erfolgreichem Abruf die
Seitenkontexte. Die Writer-Erweiterung erhielt keine Platzdaten und ergänzte
folglich keinen Platz-Prompt.

`attachMissionBriefingContexts` bindet die drei bereits ausgewählten
Seitenkontexte nach der Proposal-/Training-Vertragsanpassung und vor den
Writer-Verzweigungen an. Keine zusätzliche Recherche, Klassifikation oder
Aufgabenbedingung. Das gilt auch für andere kompakte APT-/POI-Ideenverträge.

Der Charter-Integrationstest startet jetzt mit einem kompakten Vertrag und
führt die echte Dispatch-Übergabesequenz aus `generateMission` aus, bevor der
reale Charter-Adapter aufgerufen wird. Der vorherige Test begann irrtümlich
bereits mit vollständigen Platzkontexten. 102 gezielte Tests bestanden nach der
Korrektur; Log `analysis/briefing-pages-2026-10-13/context-handoff.log`.


## Alpha-Feldtestfreigabe

Der Nutzer hat einen erfolgreichen lokalen Charter-Lauf mit sehr guten
Seitentexten bestätigt und den Rollout für weitere Tests im laufenden Betrieb
freigegeben. Ein vorheriger Charter-Lauf scheiterte an der bestehenden
Text-/Referenzprüfung und ging im zweiten Versuch durch; die konkrete
abgelehnte Antwort liegt nicht vor. Dieser Einzelfehler ist nicht als behoben
ausgegeben. Andere Missionsfamilien sind technisch geprüft, aber noch nicht
mit neuen Live-KI-Missionen abgenommen.
