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
