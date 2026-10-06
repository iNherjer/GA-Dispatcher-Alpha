# Infrastruktur-Ketten: Auftragsgeschichte V1

Stand: 1. Oktober 2026, lokal implementiert, noch nicht veröffentlicht.

## Auftrag und Daten

`infra_chain_recon` erhält einen eigenen Ideen- und Writer-Pfad für initiale KI-Ketten. Eine professionelle Fachperson und ein Auftraggeber verbinden die vorgegebenen Punkte durch eine fachliche Frage. Die KI ordnet jedem bestehenden Punkt eine Beobachtungsfrage zu. Szenarien entstehen frei aus dem Ziel und profilspezifischer History; es gibt keine Pflichtbeispiele oder Themenquote.

Der öffentliche Plan enthält vorhandene Punkt-IDs, Namen, Positionen und den Korridorrahmen. `hiddenOutcome` und Folgeprofil werden nicht an Idee oder Writer geschickt. Korridor, Reihenfolge, Radien, vollständige Original-Kette, Szenen und Fortschrittsdetektor bleiben unverändert. Die Ortsbelege am ersten Ziel gelten nicht automatisch als Umgebungsnachweis an allen weiteren Punkten.

Briefing vor dem Start, 100–150 Wörter, Erzählerperspektive. Wetter und Lagebericht stammen aus den gemeinsamen Bausteinen. Der alte Finalizer und die nachträgliche generische Kettenzusammenfassung überschreiben diese Prosa nicht.

## Erzählung im Ablauf

Der Writer erstellt eine kurze Einstiegsansage, einen Anschlussgedanken pro exaktem Punkt und eine Übergabeansage nach vollständigem Abschluss. Die Texte beschreiben Auftragsbezug und offene Fragen, keine vorweggenommenen Befunde. Bei Korridorketten wird der Einstiegstext am Korridoreinstieg verwendet, bei reinen Punktketten am ersten Punkt, damit er nicht doppelt läuft.

Die Original-Fortschrittsansage steht zuerst. Ein tatsächlich freigegebener Befund bleibt enthalten. Der zusätzliche Erzähltext folgt erst am passenden Original-Ereignis. Korrekturmeldungen und stille Segmentereignisse bleiben unverändert. Die Fotoburst-Optionen werden anhand des Originaltextes berechnet, damit zusätzliche Worte keine anderen Zählungen, Verzögerungen oder Lautstärken erzeugen.

App und Tracker nutzen dieselben aus `passenger-voice.js` generierten Funktionen. `chainBriefing` wird im serialisierten Voice-Kontext mitgegeben. Die bestehenden Worker-Queues und Effekte übernehmen Planung, Persistenz und Wiedergabe; keine weitere State-Machine und kein zusätzlicher KI-Aufruf während der Telemetrieauswertung.

## Geschichte und Folgeauftrag

`chainBriefing` bleibt in Contract, lokaler und Cloud-Kompaktspeicherung erhalten. `followUpNarrative` merkt sich Auftraggeber, Person und offene Frage. Erst der vorhandene bestätigte Abschlussdienst ergänzt den tatsächlichen Abschluss und den freigegebenen nächsten Auftrag. Gedächtnis kann selbst keinen Folgeauftrag auslösen. Der bereits vorhandene POI-Folge-Writer für Einzelziel-Inspektionen führt diese Geschichte fort.

Kettenpunkte innerhalb eines Fluges und Folgeaufträge zwischen Missionen bleiben getrennt. Picker-Kandidaten und Zielauswahl werden nicht geändert; nach Auswahl einer vorhandenen Kette entwickelt der neue Pfad den Auftrag. Follow-up, Bush, Nicht-KI und Planungsmodi bleiben auf dem bisherigen Weg. Rückfallschalter: `ga_chain_briefing_v1=off`.

## Tests und Veröffentlichung

`tools/mission-chain-briefing.test.mjs` prüft Spoilertrennung, exakt gebundene Punkte, Writer-Vertrag, Prosaerhalt, kompakte Speicherung, Folgegedächtnis, tatsächliche generierte App-/Tracker-Ansagen und unveränderte Cue-Sequenzen.

Der eingefrorene Vergleich `tools/mission-poi-chain-voice-differential-selftest.mjs` prüft 432 Ereigniskombinationen ohne neue Metadaten. Die vorhandenen Chain-Task-, Integration- und realen Mission-Worker-Tests prüfen den Ausführungsweg.

Die gepackte Voice-Core-Datei hat sich geändert. Deshalb ist beim Ausrollen ein neuer Tracker-Build samt Alpha-Release erforderlich, auch wenn `tracker.js` fachlich keine neue Ablaufregel bekommt. Der bisherige Tracker kann das neue Briefing lesen, ergänzt aber noch keine individuellen Kettenereignistexte. Live-Gemini-Stichprobe am 01.10.2026: zwei reale OSM-Ketten (Murg-Brücken und A-81-Anschlussstellen), je Ideen- und Writer-Aufruf, mit Historie aus dem ersten Auftrag. Rohantworten und Texte: `analysis/chain-live-20261001-v4.json` und `.md`. Die Probe fand falsche Sprecherperspektive, unbelegte technische Zusammenhänge und einen Namenskonflikt durch akademischen Titel. Die Prompts wurden gezielt nachgeschärft; die letzte Nachschärfung ist noch nicht erneut live geprüft. Der zweite Writer wurde wegen des Namenskonflikts korrekt abgelehnt. Noch keine MSFS-/TTS-Probe; diese Ergebnisse sind keine Release-Freigabe.

## Auswahlprüfung 01.10.2026

Die feste Sprecheridentität stammt aus der zugewiesenen Fachperson, nicht aus einem erneut generierten Namensfeld. Akademische Titel dürfen in `greetingSpeaker` fehlen; Briefing und Voices werden nicht umgeschrieben. Acht Vertragstests bestehen.

Fluss-Brückenketten dürfen Straßen- und Bahnbrücken mischen; der Auftrag muss zu sämtlichen belegten Kategorien passen. Straßen-Bauwerksketten und Anschlussstellenketten verwenden eigene Typfilter. In zehn aus lokalen OSM-Tiles erzeugten Ketten wurden alle drei Punkte jeweils gegen die tatsächlich gezeichnete `overlay.trace` geprüft. Neun Ketten einschließlich Murg und A 81 waren vollständig innerhalb. Im Verkehrskorridor B 27 lag Bargen 1,688 NM außerhalb der Mittellinie bei 1,2 NM halber Breite. `road_junction_survey` erlaubt aktuell 1,8 NM Kandidatenabstand; die abschließende Breitenprüfung gilt nur für `road_bridge_inspection` und misst zudem den ursprünglichen Guide-Abstand statt die gesampelte Overlay-Linie.

Vom Nutzer freigegeben und umgesetzt: Kandidaten werden vor Clustering/Spacing gegen die tatsächliche geglättete und gesampelte Overlay-Linie sowie deren halbe Breite gefiltert. Der gespeicherte `distCorridorNm` bezieht sich jetzt auf diese Linie; die abschließende Breitenprüfung gilt für sämtliche Kettentypen. Existierende akzeptierte Missionen werden nicht verändert. Die geometrischen Stützpunkte der Mittellinie bleiben vom tatsächlichen Infrastrukturverlauf bestimmt; Aufgabenpunkte sind bereits eigene erforderliche Kettenziele mit separatem Trigger. Die Linie wird nicht künstlich zu seitlich liegenden Objekten verbogen.

Regression: zehn reale OSM-Ketten mit dreißig Punkten vollständig innerhalb der sichtbaren Linie und innerhalb des normalisierten App-/Tracker-Korridors. Bargen wird ausgeschlossen; Murg und A 81 bleiben verfügbar. Insgesamt fünfzehn Tests inklusive realem Tracker-Missionsprozess bestanden; zusätzlicher Runtime-Selftest bestanden. `tools/poi-chain-corridor-selection.test.mjs` enthält den Geodaten-Regressionslauf.

## Alpha-Release

App-Cache v1893 und Tracker v460 enthalten die Ketten-Erzähltexte samt persistenter Übergabe und die freigegebene Auswahlprüfung. Alpha-Kanal verwendet das unveränderliche Windows-Artefakt v460; Stable bleibt unverändert. Build ohne Bytecode auf Apple Silicon (`npm run build:tracker -- --no-bytecode --public --public-packages '*'`). Fünfzehn Tests, Runtime-Selftest, 432 eingefrorene Voice-Ereignisvergleiche und Syntaxprüfungen bestanden. Windows-/MSFS-Feldtest bleibt ausstehend.


## Slew-Sperre entfernt (06.10.2026, lokal)

Auf ausdrücklichen Nutzerwunsch werden Slew-Flags und deren Diagnosestatus
nicht mehr als Sperre für Vermessung oder Infrastruktur-Ketten verwendet.
Die gemeinsame POI-Ausführung und die beiden Task-Adapter ignorieren diese
Felder. Gültige Messwerte können deshalb auch im Slew-Modus Fortschritt,
Ereignisansagen und Abschluss auslösen. Die SimConnect-Abfrage bleibt für
Diagnose und andere Missionsfamilien erhalten.

Pause, Menü, Bodenstatus, Datenfrische, ungültige Telemetrie und tatsächlich
unplausible Positionssprünge bleiben unabhängig davon geprüft. Ein Sprung
setzt nur den unvollständigen Messabschnitt zurück; abgeschlossene Arbeit
bleibt erhalten. Ein gültiger Folgemesswert hebt einen gespeicherten
Sperrstand auf, ohne übersprungene Strecken künstlich zu vervollständigen.
Mustergeometrie, Höhenband, Korridor, Punktreihenfolge, Manifest und
Folgeauftragskriterien bleiben unverändert.

Tests vergleichen Fortschritt und Ereignisse mit identischen Flugdaten ohne
Slew-Flags, einschließlich JSON-Wiederaufnahme. Scan und Orbit durchlaufen
den gemeinsamen POI-Pfad; die Infrastruktur-Kette durchläuft zusätzlich den
echten Tracker-Kindprozess, Rückkehr, Entladung und Folgeauftragserstellung.
Die gezielten 32 Tests bestehen. Noch kein Rollout oder MSFS-Feldtest.

Breiter Regressionslauf: 250 von 251 Tests bestanden. Ein SAR-Abschlusstest
liest nach automatischer Freigabe des geschlossenen Runs einen bereits
entfernten aktiven Snapshot (`null.state`). Einzeln besteht er; derselbe
Timingfehler tritt auch mit den drei unveränderten Produktionsdateien aus
HEAD im SAR-Abschlusslauf auf. Kein SAR-Code oder SAR-Test wurde dafür
geändert. Testprotokolle liegen unter `/tmp/ga-survey-infra-*.txt`.

SAR-Testkorrektur, 06.10.2026: Die zwei V2-Abschlussfälle warten nun auf den
passenden finalisierten Run in `lastExecution`, statt nach einer festen Zahl
von Event-Loop-Schritten den bereits freigegebenen aktiven Snapshot zu lesen.
Sie prüfen zusätzlich erfolgreiche Finalisierung, Suchergebnis und
unveränderte Wiederherstellung des Abschlusses aus `authority.json`.
Keine SAR-Produktionslogik geändert. Alle acht SAR-Integrationstests und der
breite Lauf mit 251 von 251 Tests bestehen. Protokoll:
`/tmp/ga-sar-close-fix-regression.txt`. Weiterhin nur lokal umgesetzt.
