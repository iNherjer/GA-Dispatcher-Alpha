# POI Sightseeing: Auswahl und Beobachtungsauftrag

## Zielbild

POI-Sightseeing betrachtet ein reales Objekt oder eine örtlich kompakte Gruppe aus der Luft. Kein Transfer zum Flughafen und kein anschließender Spazierplan als Missionskern. Die Sehenswürdigkeiten tragen den Inhalt; persönliche Neugier der Begleitperson rahmt den Flug. Briefing kurz und anschaulich; weitere belegte Fakten und kleine Geschichten in zielgebundenen Ansagen. Keine festen Ortsbeispiele oder Szenariolisten im Prompt. Historie merkt frühere Orte und Blickwinkel.

## Unveränderte Auswahlprobe am 01.10.2026

`tools/poi-sightseeing-discovery-probe.mjs` führt die Originalfunktion `findTaggedTilePOI` samt Originalparser, Ranking, Kategorien und History aus. Nur der Tile-Transport liest direkt die lokalen gzip-Dateien. Start EDTW, Reichweite 15–65 NM, Richtung beliebig, Profil `sightseeing_tour`, Kategorie `all`, zunächst leere Testhistory. Drei aufeinanderfolgende Suchläufe, keine gesetzten Ortsnamen und keine Gemini-Auswahl. Ergebnis unter `analysis/poi-sightseeing-discovery-20261001.json` (lokaler Prüfbeleg, nicht Release-Asset).

- Kapf mit Kreuz: 16 NM, `tourism=viewpoint`, Auswahlkategorie `road`. Ein Aussichtspunkt für Besucher am Boden ist noch keine interessante, eindeutig erkennbare Ansicht aus dem Flugzeug. Falsche Kategorie im bestehenden allgemeinen Pfad.
- Esskastanie: 25,3 NM, `natural=tree` und `leisure=nature_reserve`, Kategorie `forest`. Einzelner Baum ohne belegte Größe oder Bedeutung eignet sich nicht als verlässliches Luft-Sightseeing-Ziel.
- Ruine der Burg Hossingen: 20,5 NM, `historic=ruins`, Kategorie `castle`. Plausibler Kandidat; Quellenbasis und aus der Luft betrachtbare Merkmale noch zu prüfen.

Die Ergebnisse sind kartierte Kandidaten, kein Nachweis heutiger Sichtbarkeit, Simulatorabbildung oder vorhandener Quellenfakten. Der aktuelle Finder wählt jeweils ein Ziel, keine lokale Gruppe. Seine Sightseeing-Boni allein sichern Eignung aus der Luft nicht; bei Kategorie `all` gibt es keinen allgemeinen Mindestwert für Sightseeing-Interesse.

## Implementierung am 01.10.2026

Sightseeing verwendet jetzt den bestehenden Knowledge-Briefing-Adapter, begrenzt auf POI-Modus. APT-Sightseeing bleibt im separaten Besuchsplan. Die Ideen wählen selbst `storyLine: public | personal | mixed`. Öffentliche und gemischte Ideen benötigen gültige Quellen-IDs; persönliche Ideen dürfen bei dünner Datenbasis ohne Fakten entstehen. Fiktive Biografie ist erlaubt, reale Ortsmerkmale bleiben quellenpflichtig. Keine festen persönlichen Szenarien im Prompt. Ideen und Writer-Gedächtnis nutzen die vorhandene profilgetrennte History.

Die positive Eignungsprüfung im Finder gilt nur für Sightseeing: Siedlungen, historische Bauwerke und größere natürliche oder gebaute Strukturen. Einzelbäume und reine Boden-Aussichtspunkte werden nicht mehr allein ausgewählt. Andere Profile behalten ihre Auswahlregeln.

Die Mission bleibt eine bestehende Beobachtungsaufgabe mit 3 NM Radius und vier Minuten Aufenthalt. Mehrere belegte Sehenswürdigkeiten dürfen Gesprächsstoff innerhalb dieses Gebiets sein; sie sind keine separat verpflichtenden Wegpunkte. Bei Siedlungen recherchiert der Adapter jetzt bis zu zwei zusätzliche Orte innerhalb von fünf Kilometern um das Missionsziel. Die vorhandene Wikipedia-Nahbereichssuche und Artikelkoordinaten sichern die Zuordnung; jeder Ort benötigt eigene Quellenfakten. Diese ergänzen das gemeinsame Beobachtungsgebiet, ohne weitere Pflichtwegpunkte einzuführen. Bei dünner Datenbasis bleibt eine persönliche Geschichte möglich.

`knowledgeBriefing` und Quellenkontext laufen durch die vorhandene lokale/Cloud-Persistenz. Der echte Passenger-Base-Context übernimmt Idee, Quellen und Erzählrichtung in den serialisierten Tracker-Voice-Kontext. Der bereits zugelassene Tracker-Domain `sightseeing_tour` verwendet weiter die gemeinsame POI-Aufgabe; keine App-Timer als neue Voraussetzung.

Validierung: elf Knowledge-Vertrag-/Browser-/Restore-Tests, gemeinsame Briefing-Tests und echte serialisierte Tracker-Voice-Prompt-Tests inklusive Sightseeing. Syntax und Diff geprüft. Die abschließenden Liveproben und der Release werden im folgenden Abschnitt dokumentiert.

## Auswahl-Nachschärfung

Zwölf lokale Suchläufe zeigten zusätzlich normale Sendemasten, unbenannte Gewässer und Stromtragwerke unter Brückenkategorien. Sightseeing prüft deshalb jetzt vor dem Ranking positive Objektmerkmale und einen konkreten Namen. Elektrische Tragwerke, reine Straßen, Einzelbäume, gewöhnliche technische Türme und reine Boden-Aussichtspunkte sind keine Ziele. Seen/Reservoirs, Staumauern, historische Bauwerke, markante Landschaftsformen, Siedlungen und touristisch/historisch belegte Türme bleiben Kandidaten. Eigenständige benannte Brücken sind zulässig; ein Brückentag auf einer Straßenlinie allein genügt nicht.

Nach Auswahl benötigen alleinstehende Objekte einen identitäts- und koordinatengebundenen Quellenkontext. Maximal vier Kandidaten werden mit je 2,5 Sekunden Quellen-Timeout geprüft. Ohne geeigneten Beleg wird im freien Kategorie-Modus auf ein benanntes Dorf oder eine Stadt zurückgegriffen; bei fest gewählter Objektkategorie wird kein beliebiges anderes Objekt eingesetzt. Keine Veränderung der globalen Kategorien oder Parser für andere Missionsfamilien. Eine Quelle ist ein Relevanzanker, kein garantierter Größen- oder Simulator-Sichtbarkeitsnachweis.

Die tatsächlich nach Quellenprüfung gewählten Koordinaten werden zusätzlich in einer eigenen Sightseeing-History (zwölf Ziele) gespeichert. Frische Kandidaten kommen zuerst; bei ausgeschöpfter Kategorie ist Wiederholung möglich, statt eine vorhandene Auswahl dauerhaft zu sperren. Sechs Quellenläufe: Schliffkopf, Ruine Vörbach, HRB Wolterdingen, Geislingen, Hochfirstturm, HRB Wolterdingen. Die letzte Wiederholung deckte den bisher fehlenden History-Eintrag nach Quellenwechsel auf. Nach Korrektur drei freie Läufe: Ruine Vörbach, Gutmadingen, Schliffkopf. Das sind Originalfinder mit lokalem Tile-Transport und echten Wikipedia-Abfragen, keine Gemini-Briefings oder Simulatorflüge.

Gezielte Kategorienprobe: `city` ließ im alten Sightseeing-Sonderpfad auch Einzelattraktionen durch und lieferte eine Ruine. Der neue profilspezifische Filter verlangt bei explizit gewählter Stadtkategorie jetzt ein Siedlungs-Tag; Nachprobe: Yach. Wasserprobe: HRB Wolterdingen; Dammprobe: Brändbachtalsperre. Turm- und Brückenprobe lieferten in der kurzen lokalen Suche keine belegte Auswahl. Die freie Suche lädt nun auch die bestehende Infrastruktur-Datenquelle für Sightseeing, damit größere Bauwerke überhaupt im Kandidatenpool stehen. Keine pauschale Zusage, dass in jedem Suchgebiet jede Objektfamilie gefunden wird.

Abschluss mit Infrastrukturquelle: freie Auswahl Herrenwieser Schwallung (Quellenartikel vorhanden), explizite Brücke keine belegte Auswahl. Ein trockenes Rückhaltebecken war noch als Wasserziel gelandet; die explizite Wasser-Kategorie wird deshalb für Sightseeing jetzt auf kartierte Seen/Reservoirs ohne `landuse=basin` begrenzt. Das Becken bleibt als Bauwerks-/Dammziel möglich. Geislingen wurde unabhängig anhand der städtischen Seiten zu Wasserschloss und Schlossgarten geprüft; diese manuelle Recherche ist kein Nachweis einer bereits automatisierten Gruppensuche.

Die letzte See-Probe blieb leer. Konkrete Datenursache: Der Titisee ist in den lokalen Core-Linien als `type=river` gespeichert, nicht als See. Die POI-Dateien im geprüften Nahbereich enthalten überwiegend kleinere Reservoirs, keine passend getaggten benannten Seen. Eine Änderung der gemeinsamen Hydro-Klassifikation wurde nicht vorgenommen; der Datenfehler ist separat zu beheben oder Sightseeing benötigt einen zusätzlichen quellengebundenen Objekt-Discovery-Pfad. Gleiches gilt für die dünne benannte Brückenbasis. Ergebnisse gespeichert im lokalen Analysebericht `analysis/poi-sightseeing-selection-review-20261001.json`. Nicht veröffentlicht.

## Abschlussprüfung und Alpha-Release am 03.10.2026

Vier Live-Gemini-Proben mit aktuellen Wikipedia-Artikeln: Stadt mit lokaler Gruppe (Freiburg, Altstadt und Münster), Insel (Mainau), See (Schluchsee) und ein Dorf mit bewusst fehlenden Quellen (Gutmadingen). Jeweils Idee, vollständiges Briefing und drei zielgebundene Voice-Texte. Verwendet wurden der echte Browser-Adapter und die serialisierten Original-Voice-Prompts; kein TTS-Audio oder MSFS-Flug. Reproduzierbar mit `node tools/poi-sightseeing-live.mjs <neue-reportdatei.json>`; einzelne Ziele können als zweites Argument übergeben werden. Die Rohberichte bleiben lokale Prüfbelege.

Die Proben deckten mehrdeutige Ideenlisten und einen umformulierten Zielnamen auf. Der Ideenprompt verlangt deshalb genau eine Idee pro Rahmen und unveränderte Zielkennung. Ohne Quellen gilt eine persönliche Erzählrichtung mit leeren Fakten-IDs; fehlende Ortsmerkmale dürfen nicht durch eigenes Weltwissen ersetzt werden. Quellenfakten werden vor der Textgenerierung vorgegeben, nicht durch nachträgliche inhaltliche Regex-Korrekturen ersetzt.

Der vollständige Sightseeing-Faktenkontext liegt zusätzlich im persistierten `knowledgeBriefing`. Der Voice-Zugriff verwendet ihn als profilspezifischen Restore-Fallback, wenn alte Kontextfelder beim Komprimieren entfallen. Test: lokaler Quota-Save plus alle drei Cloud-Kompressionsstufen erhalten lokale Orte, Quellen, Fakten und Erzählrichtung. Tracker-Tests prüfen Beobachtung, Abschluss, Restore und bereits erzählte Fakten ohne App-DOM. Die Tracker-Engine benötigt hierfür keine neue EXE; Auftrag und Voice-Kontext verwenden den vorhandenen Authority-Vertrag.

Die Originalfinder-Probe mit dem derzeit veröffentlichten lokalen Tile-Stand lieferte Mitteltal und Geislingen; die eng gefilterte Wasserprobe blieb leer. Wasser- und Inselbriefings sind separat mit realen Artikelkoordinaten geprüft. Verfügbarkeit bei freier Auswahl hängt weiterhin von den veröffentlichten Tile-Daten ab; neue Workbench-Daten werden unabhängig geprüft und veröffentlicht.

Release-Validierung: 125 Tests bestanden, zusätzlich 5.376 Original-/Core-Voice-Vergleiche sowie zwölf Faktenqueue-/Erschöpfungsschritte. Endgültige Liveproben ohne Vertragsfehler: Freiburg und Schluchsee im zweiten Lauf, Mainau und das quellenfreie Dorf im dritten Lauf. Alpha-Cache-Version: `ga-dispatcher-v1902`.
