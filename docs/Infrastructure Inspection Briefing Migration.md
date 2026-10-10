# Infrastruktur-Inspektion: Briefing-Migration

Stand: 29.09.2026. Alpha-Release v1878: initiale Einzelziel-Inspektionen standardmäßig aktiviert, Prompt v1.8.

## Verbindlicher Auftrag

`inspection_infra` ist ausschließlich ein professioneller Auftragsflug für Firmen, Behörden, Betreiber oder andere Verantwortliche. Keine privaten Anlässe. Die mitfliegende Fachperson (`technical_inspector_v1`) beurteilt sichtbare Zustandsmerkmale und liefert ein Kurzfazit; Fotos und Notizen unterstützen. Der Fotovertrag „nur aufnehmen, erst am Boden beurteilen“ gilt hier nicht. Der Ton ist sachlich, konkret und kollegial.

Die bestehende Zielauswahl bleibt maßgeblich: Infrastruktur, Brücken, Bahn, Stauanlagen, Telekommunikation, Industrie und Straßen gemäß vorhandener Profilpolitik. Keine neue Klassifikation oder Namensinterpretation. Bestehende Befund-, Folgeauftrags-, Voice- und Runtime-Regeln bleiben zuständig.

## Plausible Fiktion (Nutzerklarstellung, 29.09.2026)

Bauliche Einzelheiten und Schadenshinweise dürfen erfunden werden, sofern sie zum Zieltyp und zueinander passen. Echte Schadensdokumentation ist keine Voraussetzung für eine Simulatormission. Ideen bewahren diese Ausgangsannahmen in `scenarioDetails`; Writer und History übernehmen sie. Die Story darf sie natürlich erzählen, ohne ständige Fiktionshinweise.

Geografische Lage, Gelände, Bewuchs, Gewässer, Landmarken, Hindernisse und Wetter bleiben quellengebunden. `scenarioDetails` werden weder zu `targetFacts` noch zu Kartenbelegen. Ein gemeldeter Schaden kann den Auftrag auslösen; der Missionsbefund bleibt im bestehenden Ergebnisablauf. Prüfziel, aus der Luft erkennbare Merkmale und fachliche Empfehlung müssen zusammenpassen.

Die frühere Bewertung „unbelegte Bauteile sind generell unzulässig“ ist damit überholt. Weiterhin zu prüfen sind Widersprüche zur belegten Umgebung, unplausible Detailerkennung und vorweggenommene technische Freigaben. Prompt v1.3 ersetzt die zu enge Vorgabe durch diesen Fiktionsvertrag; v1.4 präzisiert die Trennung zur Landschaft und den Vorrang neuer Ortsbelege im Writer.

## Erste Ausbaustufe

`mission-infra-briefing-core.js` entwickelt einen professionellen Auftrag mit Auftraggeber, Anlass, Prüfbereich, Entscheidungsbedarf und Fachperson. Der bestehende Picker bindet die ausgewählte Idee an Start und Ziel; ein Writer arbeitet genau diese Idee aus. `mission-infra-briefing-browser.js` bindet dies in den vorhandenen POI-/V4-Ablauf ein. Kein neuer Startpfad.

Lage, Umgebungsbelege und Wetter kommen aus den [gemeinsamen POI-Bausteinen](POI%20Shared%20Briefing%20Guide.md). `infraBriefing` bewahrt Idee, Quellen, Bericht und Writer-Memory bei Speicherung und Cloud-Kompaktierung. Die History ist profilspezifisch. Der vorhandene Infra-Befunddienst erzeugt das Ergebnis erst im Missionsablauf.

Standardmäßig aktiv. Rückfallschalter: `localStorage.setItem('ga_infra_briefing_v1', 'off')`; mit `removeItem` zum Standard zurückkehren. Aktiv nur für initiale Einzelziele mit KI. Ketten, Folgeaufträge, Bush und Planungsmodi bleiben auf ihrem bisherigen Ablauf. Der Schalter erlaubt die Rückkehr zum bisherigen Writer, keine zusätzliche Missionsstartfunktion.

## Prüfung und verbleibende Arbeit

Acht gezielte Tests prüfen professionellen Ideenvertrag, Aktivierung, Bindung der ausgewählten Idee, History, Finalisierung/Speicherung und Kompatibilität mit dem bestehenden Befunddienst. Gesamte Regression inklusive Shared-, Foto-, Wetter- und APT-Tests: 141 Tests bestanden. Syntaxprüfung und git diff --check ebenfalls erfolgreich.

Drei vollständige Gemini-Versuche (je Idee und Writer) am Sommerbergtunnel wurden ausgewertet. Lokale Tiles und aufgezeichnete OSM-Geometrien sind real; Wetter und Terrain sind ausdrücklich rekonstruierte Testdaten aus dem Nutzerbericht, keine aktuellen Abfragen. Kein vollständiger UI-/Simulator-Test.

1. v1.0: Formal angenommen, inhaltlich nicht freigabefähig. Unbelegte Hang-/Zugänglichkeitsmerkmale und überzogene Aussagen zur Stabilitätsprüfung.
2. v1.1: Writer wegen abweichender Sprecheridentität abgewiesen; weiterhin unbelegte Felshänge und Schutzeinrichtungen. Der qualitative Beobachtungsvertrag allein genügte noch nicht.
3. v1.2: Formal angenommen, professioneller Stil und gemeinsame Lage-/Wetterdarstellung funktionieren. Inhaltlich weiterhin zu starke Folgeentscheidung zwischen Bauwerksprüfung und Instandsetzung sowie ungestützte technische Konkretisierung. Kein Qualitätsnachweis für eine Veröffentlichung. Wetter verwendete die gemeinsame Darstellung derselben Stationsbeobachtung (`shared-observation`).

Rohantworten und ausgewählte Ausgaben: [Testserie](examples/Infrastructure%20Inspection%20First%20Batch.json). Keine weiteren automatischen Reparaturaufrufe in dieser Serie.

Nächster Schritt: Prüfbereich und Entscheidungsbedarf mit plausiblen fiktionalen Bauwerksdetails und einem realistischen fachlichen Sichtbefund verbinden. Keine nachgelagerte Verbotsliste als Ersatz für diesen Vertrag. Anschließend weitere Zielarten testen, höchstens drei Missionen pro Serie. Vor allgemeiner Aktivierung vollständigen Picker-/Restore-Ablauf im Browser prüfen. Die Methode der [Foto-Migration](POI%20Photo%20Migration%20Template.md) wird übernommen, deren Missionsinhalt nicht.

## Zweite Testserie: Bauwerksfiktion

Drei Gemini-Missionen, jeweils Idee plus Writer, keine Reparaturaufrufe. Läufe zwei und drei bekamen die vorherigen Probeideen als Test-History; diese wurden nicht in produktive Nutzerdaten geschrieben. Gleicher Tunnel als kontrollierte Vergleichsbasis, gleiche aufgezeichnete Geo-/Wetterdaten wie zuvor. [Rohantworten und Texte](examples/Infrastructure%20Inspection%20Fiction%20Batch.json).

- v1.3, Lauf 1: Steinschlagmeldung und geotechnischer Prüfbedarf. Bauwerksfiktion grundsätzlich zulässig, aber dichter Wald/Steilgelände über der Tunnelachse nicht belegt und zur Wiesenfläche widersprüchlich. Daraufhin v1.4 korrigiert.
- v1.4, Lauf 2: Vorbereitung einer Instandsetzung und Wartungsplanung. Eigenständiger professioneller Anlass; keine Wiederholung des Starkregenauftrags. Einige Detailziele (Risse, Einläufe) passen noch nicht überzeugend zur Auflösung im Überflug.
- v1.4, Lauf 3: Störmeldungen der Belüftung und Sichtung oberirdischer Anlagen. Neue Auftragsidee; solche erfundenen Anlagen sind gemäß Nutzerklarstellung nicht allein wegen fehlender Ortsbelege abzulehnen. Lamellengitter, Blitzschutzableiter und Betonsockelintegrität sind jedoch zu detaillierte Prüfziele; zudem dichtet der Writer Forstwege hinzu und lokalisiert fiktionale Anlagen zu konkret aus einem Oberflächenpunkt.

Alle drei Entwürfe wurden strukturell angenommen; das ist keine Aussage über inhaltliche Freigabereife. Professioneller Stil, Ideenbindung, History und gemeinsame Lage/Wetter-Ausgabe funktionieren. Nächster Qualitätsfokus ist die plausible Beobachtungsgröße aus der Luft und das Vermeiden neuer geografischer Behauptungen im Writer. Keine Rückkehr zur Forderung nach real dokumentierten Schäden. Aktivierung bleibt unverändert opt-in; nicht veröffentlicht.

## Dritte Testserie: fachlicher Nutzen des Luftblicks

Ideen enthalten jetzt `aerialAssessment` mit `visibleCue`, `usefulConclusion` und `followup`: wahrnehmbares Merkmal, begründbare Einschätzung und verbleibende Detailprüfung. Auswahl, Writer, Speicherung und History bewahren diese Verbindung. Für vorhandene Entwürfe bleibt das Feld optional; der neue Ideenprompt fordert es an. Kein zusätzlicher KI-Aufruf und keine automatische semantische Qualitätsgarantie.

v1.5 ergänzte die Verbindung; v1.6 straffte die wiederholten Promptvorgaben. v1.7 korrigiert die lokale Belegprüfung: bekannte IDs aus Story- und Navigationsfakten sind zulässig, erfundene IDs weiterhin nicht. Der Shared-/Foto-Vertrag wurde hierfür nicht verändert. Prüfung der Feldstruktur und Quellenidentität ersetzt keine inhaltliche Sichtung.

Drei Gemini-Läufe, je Idee und Writer: [Rohantworten](examples/Infrastructure%20Inspection%20Aerial%20Batch.json).

- Tunnel v1.5: Weiterhin zu starke Hang-/Statikgeschichte mit unbelegter Bewuchslage. Nicht freigabefähig.
- Tunnel v1.6: Technische Entwässerungs-/Sanierungsplanung. Formal abgewiesen wegen vorhandener Navigations-IDs in usedFactIds; diese unnötige Ablehnungsursache ist in v1.7 behoben. Inhaltlich bleiben Hang-/Zufahrtsannahmen und kleinteilige Prüfziele problematisch.
- Adenauerbrücke v1.7: Ziel aus lokalem Infra-Tile 331/451 (48.09465, 7.95748), mit professionellem Auftrag zur Gesamtgeometrie. Für dieses Ziel ausdrücklich keine übernommenen Tunnel-Wetter-, Gelände- oder Umgebungsflächenwerte. Der gemeinsame Bericht stellt fehlende Wetter-/Geländedaten korrekt dar. Der Writer überhöht die Aussagekraft jedoch noch: Aus Verfärbungen und Wellenbildungen soll über eine unmittelbare Tonnagebeschränkung entschieden werden. Fiktionaler Anlass zulässig, diagnostische Sicherheit noch nicht überzeugend.

Die Serie wurde nach drei Missionen beendet. 141 Regressionstests bestanden, inklusive Erhalt des neuen Beobachtungsrahmens und bekannter/unbekannter Quellen-IDs. Weiterhin opt-in, kein Release. Der nächste Schritt muss die Kausalität zwischen sichtbarem Merkmal und fachlicher Empfehlung verbessern; zusätzliche Namens- oder Schadensverbotslisten sind keine Lösung. Browser-/Simulatorprüfung und breitere Zielabdeckung stehen noch aus.

## Freigabe v1878

Nutzerfreigabe: Plausible Dringlichkeit und Konsequenzen wie mögliche Tonnagebegrenzung sind erwünscht. Die direkte fachliche Schlussfolgerung aus verdächtigen Luftbeobachtungen ist die gezielte, gegebenenfalls sofortige Nachprüfung vor Ort. Die ältere Bewertung solcher Dramatik als generellen Ausschlussgrund ist überholt. Prompt v1.8 übernimmt dies ohne nachgelagerte Verbotslisten. Reale Geografie bleibt quellengebunden.

Veröffentlicht werden der gemeinsame Lage-/Wetterbaustein und der neue professionelle Writer für initiale Einzelziele. Ketten und Folgeaufträge bleiben im vorhandenen Ablauf. Die bisherigen Testserien sind historische Entwicklungsbefunde; sie sind keine Statistik zur Fehlerfreiheit von v1.8. Kein neuer Tracker erforderlich.

Flug-Voice: [Erzählkontinuität nach APT-Muster](POI%20Flight%20Narrative%20Continuity.md). Veröffentlicht mit Web-Alpha v1879 und Tracker-Alpha v454; gemeinsame App-/Tracker-Verifikation.

## History-Verfeinerung v1.9 (unveröffentlicht)

APT-Vergleich übernommen: Intern verschiedene Auftragskerne entwickeln, gegenüber früheren Anlässen, Prüfungsfragen und Folgeentscheidungen einen eigenständigen auswählen. Andere Firmen oder Schadenswörter allein genügen nicht. Writer-Memory fasst den fachlichen Kern zusammen. Vorhandene History-Daten und beruflicher Missionsvertrag bleiben erhalten. [Gemeinsame Dokumentation](POI%20Photo%20Migration%20Template.md#history-abgleich-mit-apt-29092026).


## Hauptinspektion → Nachkontrolle: strukturierte Übergabe, 09.10.2026

Lokaler Arbeitsstand auf dem veröffentlichten v508-/Origin-Stand, nicht ausgerollt.
Prompt v1.10 fordert zusätzlich zur bisherigen History-Notiz `memory` ein
`continuationMemory` im selben Writer-Antwortobjekt an. Kein weiterer KI-Aufruf.
Der vorhandene Vertrag `ga.followup-narrative.v1` übernimmt diese Erinnerung als
`followUpNarrative` in Mission und V4-Vertrag. Kein zweites History-System.

- `summary`: kompakte angenommene Geschichte, höchstens 700 Zeichen.
- `participants`: bekannte Namen und Rollen, höchstens sechs; die gewählte
  Fachperson steht für diesen Strang zuerst.
- `client`: genau der ausgewählte Auftraggeber samt Organisationsart.
- `openQuestions`: höchstens vier offene Fragen, je 220 Zeichen.
- `possibleContinuations`: höchstens drei Möglichkeiten, je 220 Zeichen.

Die Erinnerung beschreibt den Auftrag, keinen bereits erfolgreichen Flug oder
vorgezogenen Inspektionsbefund. Auftraggeber und Fachperson werden strukturell
gegen die ausgewählte Idee geprüft. Fehlende, zu große oder widersprüchliche
optionale Erinnerung verwirft keine gültige Mission; `memoryStatus` dokumentiert
den Rückfall auf den bisherigen Kontext. Die Prüfung beweist keine inhaltliche
Qualität der Zusammenfassung.

Der bestehende bestätigte Tracker-Abschluss ergänzt Mission-/Abschluss-ID und
Erfolg. Der bekannte Befund bleibt im bestehenden `infraInspectionOutcome`.
Das vorhandene Folgeangebot, Cloud-Sync V2 und der POI-Fortsetzungswriter
transportieren beide Teile; Erzählideen entscheiden weder Verfügbarkeit noch
Folgeprofil. `infra_recheck` einer ursprünglichen `inspection_infra` übernimmt
Name und Rolle der damaligen Fachperson aus dieser Erinnerung. Die technische
Rolle bleibt `technical_inspector_v1`. Andere Folgeprofile behalten ihre eigenen
Fachrollen; Legacy-Angebote ohne Erinnerung behalten ihren bisherigen Rückfall.

Geprüft sind der vorhandene Hauptwriter-Aufruf, echte Speicherkompaktierung,
bestätigter Headless-Tracker-Abschluss, Erfolgs-/Fehlertrennung und der Aufruf
des bestehenden Nachkontroll-Writers mit bekannter Geschichte und Befund.
Script-Ladereihenfolge enthält den Narrative-Core vor dem Inspektions-Core.
Tests mit simulierten Writer-Antworten ersetzen keine neue Live-KI-Serie oder
Browser-/MSFS-Abnahme. Diese Qualitätsprüfung ist vor Veröffentlichung offen.


### Erste Live-Fortsetzungsprobe, 09.10.2026

Eine Hauptinspektion am Sommerbergtunnel und deren Nachkontrolle wurden mit
drei echten Gemini-Antworten über die bestehenden Ideen-/Writer-Bausteine
erzeugt. Der bestätigte Abschluss mit `monitor` wurde für die Probe simuliert.
Identität, ursprüngliche Fachperson, vollständiger Auftraggeber im Folge-Input
und bekannter Befund bleiben erhalten. Qualitätsabnahme noch nicht bestanden:
Hauptidee/-writer behaupten unbelegte Umgebung, die Folge erzählt teilweise
als Fachperson und verkürzt den Auftraggebernamen im neuen Gedächtnis. Die
bestehende Identitätsprüfung verwirft dieses optionale Gedächtnis korrekt.
Keine Änderungen am übergreifenden Folge-Writer und keine Reparaturaufrufe.
Texte und Bewertung: `analysis/infra-continuation-20261009/live-01.md`;
Prompts, Rohantworten und vollständige Übergabe: entsprechende JSON-Datei.


## Belegte Ortsgrundlage im Ideenschritt, 09.10.2026 (lokal)

Prompt v1.11 erweitert ausschließlich den Infrastruktur-Rahmen um
`geography` aus dem vorhandenen `MissionPoiBriefingSharedCore.sourceSnapshot`.
Kartierte Umgebungs-/Landmarkenpunkte behalten Quelle, Richtung und Abstand;
vorhandene Flächenbelege und Geländehöhen behalten ihren Geltungsbereich.
Benachbarte Punkte beweisen keine durchgehende Fläche am Bauwerk und eine
Höhenübersicht keine bestimmte Hanglage. Bei fehlenden Belegen wird die
Prüfungsfrage am Bauwerk entwickelt, ohne Landschaft hinzuzuerfinden.

Bei direkter Erstellung eines bereits gewählten Ziels erfolgt die bestehende
Umgebungsanreicherung einmal vor dem Ideenaufruf. Der Writer nutzt denselben
Kontext. Picker-Ideen erhalten bereits bekannte Kartenbelege; für die Kandidaten
entstehen keine zusätzlichen Flächenabfragen. Nach Auswahl werden weiterhin
die vorhandenen Shared-Daten ergänzt. Der Writer muss räumliche Annahmen der
Idee anhand dieses genaueren Kontextes anpassen, während Anlass, Auftraggeber,
Fachperson und Entscheidungsbedarf bestehen bleiben.

Gemeinsame Geo-Verarbeitung, Klassifikation, Parser, Ergebnis- und
Folgefreigaberegeln bleiben unverändert. Keine neuen Wortverbotslisten oder
semantischen Reparaturaufrufe. Neue Tests prüfen Kartenrelationen, Flächenscope,
fehlende Umgebung und Anreicherung vor der direkten Idee ohne Kandidatenabrufe.


### Vorhandene Flächenbelege für Picker-Ideen, Prompt v1.12

Die erste Gegenprobe mit v1.11 zeigte: Kartenpunkte allein verhinderten die
unbelegte Hangannahme noch nicht. Der Infrastruktur-Kontext übernimmt deshalb
vor seiner Rahmenbildung zusätzlich vorhandene, zielgebundene Flächenbelege
über `MissionPoiBriefingSharedBrowser.cachedEnvironment`. Dieser additive
Lesezugriff verwendet exakt den bestehenden Cache mit seinen Zielschlüsseln
und Ablaufzeiten. Er verursacht weder Netzwerkzugriffe noch Cache-Schreibvorgänge.
Fehlende oder abgelaufene Einträge bleiben unbekannt; der bisherige Abruf nach
Auswahl bleibt zuständig. Bestehende Geo-Verarbeitung und andere Profilpfade
ändern sich nicht. Cache-Treffer, andere Ziele, Ablauf und Null-Requests sind
getestet. Der reguläre Ideenschritt der dritten Live-Probe erhält damit die
bereits gespeicherten vier Flächenbelege des Sommerbergtunnel-Testkontexts.


### Live-Gegenprobe mit Cache-Ortsbindung

Drei echte KI-Aufrufe mit v1.12: Idee und Hauptwriter berücksichtigen nun die
belegte Wiesenfläche am Ziel statt eines erfundenen Waldgürtels. Die Folgeantwort
erreicht den bestehenden Validator, wird aber wegen eines Objektwertes in
`sceneIntent.visibleIdeas` abgewiesen (erwartet sind Zeichenketten). Die
übergreifende Szenenprüfung bleibt unverändert; keine Reparaturaufrufe.
Fachliche Diagnose und Erzählperspektive bleiben weitere Qualitätsfragen.
67 Missions-/Shared-/Tracker-Tests bestanden. Texte und Befunde:
`analysis/infra-continuation-20261009/live-03-cached-grounding.md`.


### Folge-Writer: Szenenformat korrigiert, 09.10.2026 (lokal)

Auf Nutzerwunsch erklärt der bestehende Fortsetzungswriter jetzt ausdrücklich
`visibleIdeas` als Array kurzer Zeichenketten, die Zeichenbudgets und die
Zusammengehörigkeit mit `densityHint`. Der Validator bleibt unverändert streng.
Ein neuer Regressionstest deckt den beobachteten Objektwert-Fehler ab.
Die unveränderte Hauptmission/Übergabe wurde in genau einem neuen Live-Aufruf
weiterverwendet. Folgebriefing und Fortsetzungsgedächtnis werden angenommen;
Fachperson und vollständiger Auftraggeber bleiben erhalten. Räumliche
Formulierungen der Antwort sind noch nicht durchgehend sauber (Flächenausdehnung
und vertauschter Bezug zur Wohnbebauung); formal akzeptiert ist keine
abschließende Qualitätsfreigabe. Artefakt:
`analysis/infra-continuation-20261009/followup-04-format-fixed.json`.


### Bauwerk als Erzählanker, Nutzerklarstellung 09.10.2026

Haupt- und Folgebriefing erzählen den Prüfschritt unmittelbar am ursprünglichen
Bauwerk. Beim Tunnel kann die Tunnelachse den Bezug bilden; konkrete
Portalpositionen werden nicht aus dem Zielpunkt abgeleitet. Ergänzende
Geo-Referenzen bleiben im vorhandenen separaten Lagebericht. Im Missionstext
werden Umgebungsmerkmale nur bei fachlicher Notwendigkeit und vorhandener
Ortsgrundlage genutzt, ohne daraus neue Prüfbereiche oder Flugpositionen zu
machen. Die Ortsdaten und ihr Lagebericht bleiben erhalten; kein Textparser
und keine nachträgliche Umschreibung. Lokaler Stand, nicht veröffentlicht.


### Erzählerperspektive bei Folgebriefings, 09.10.2026 (lokal)

Die Fachperson wird im Erzähltext mit Namen bzw. in der dritten Person
beschrieben. Direkte Ich-Rede bleibt in `greeting` und eindeutig markierten,
der Fachperson zugeordneten Zitaten erlaubt. `BASE.person` liefert dem
Fortsetzungswriter jetzt nur Name, Rolle, Rollenprofil und TaskDomain; die
generische Ich-Begrüßung des technischen Basisauftrags wird nicht mehr als
Erzählvorlage mitgegeben. Aufgaben, Teilnehmeridentität und Ergebnisregeln
bleiben erhalten. Ein Regressionstest prüft Perspektivvorgabe, erlaubte Zitate
und die Trennung der gespeicherten Basisbegrüßung vom Writer-Input.


### Gemeinsame Regeln für Haupt- und Folgeinspektion, 09.10.2026 (lokal)

`MissionInfraBriefingCore.writerRules()` liefert jetzt dieselben professionellen
Auftrags-, Erzähler-, Ortsbindungs- und Sichtprüfregeln an Hauptwriter und
Nachkontroll-Writer. Beide zielen auf ein vollständig ausgearbeitetes Briefing
von etwa 90–130 Wörtern; keine zusätzliche Kürzung der Fortsetzung.
Unterschiedlich sind die Planungsgrundlagen: ausgewählte Ausgangsidee für
die Hauptmission, bekannter Befund und verbindlicher nächster Auftrag für
die Folge. Erzählkontext ist keine Ergebnisfreigabe. Fotos behalten ihre
eigenen fachlichen Regeln. Gemeinsame Regelverwendung wird im Test geprüft.


## Alpha-Freigabe 10.10.2026

Die in diesem Chat umgesetzten Writer-Übergaben, dynamischen Zwischenideen,
PAX-Kontinuitätsregeln und Folgeangebots-UI-Korrekturen werden auf Origin/Alpha
mit Tracker v509 veröffentlicht. Stable bleibt auf v508 unverändert.
101 relevante Node-Tests bestanden; die vierteilige Live-Kette wurde mit
simulierten Abschlüssen geprüft. Keine neue MSFS-/Mehrgeräte-Abnahme behauptet.
