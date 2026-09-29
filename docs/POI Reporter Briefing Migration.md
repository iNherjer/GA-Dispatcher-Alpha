# POI Reporter: freie Reportageideen nach APT-Muster

Stand: 29.09.2026, freigegeben für Alpha-App v1880 / Tracker v455. Prompt `poi-news-apt-v1.10`.

## Umfang und Inhalt

Nur initiale Einzelziel-Missionen `POI / news_coverage`. Die bestehende Zielauswahl bleibt `road`, `city`, `industry`. APT-Reporter, Ketten, Folgeaufträge, Planung ohne KI und Bush bleiben im bestehenden Ablauf. Standardmäßig aktiv. Rückschalter: `localStorage.setItem('ga_news_briefing_v1', 'off')`; Entfernen des Keys aktiviert den neuen Adapter wieder.

Die mitfliegende journalistische Person beobachtet, fotografiert, filmt und ordnet sichtbare Zusammenhänge für einen Beitrag ein. Sie ist kein technischer Gutachter. Die größere redaktionelle Frage muss nicht durch den Flug entschieden werden. Ein anschaulicher Bildbeitrag ist ein ausreichender journalistischer Nutzen. Keine Umdeutung in Foto-Privatausflug, Infrastrukturprüfung, SAR oder Transport zu Interviews.

Nutzervorgabe: vielfältige Geschichten, ausdrücklich auch lustige. Ernste, warme, kuriose und humorvolle Anlässe sind gleichwertig; keine Motivauswahl, Quote oder Pflichtpointe. Personen und eigenwillige Absichten dürfen die Geschichte tragen. Professioneller Journalismus verlangt keinen durchgehend nüchternen Sprachstil. Die History speichert Anlass, Blickwinkel, Nutzen des Luftblicks und geplanten Beitrag, damit Vielfalt über wechselnde Namen hinausgeht.

## Wiederverwendete Methode

Referenzen: [POI-Migrationsvorlage](POI%20Photo%20Migration%20Template.md), [gemeinsame Lage-/Wetterlogik](POI%20Shared%20Briefing%20Guide.md), [Flug-Erzählkontinuität](POI%20Flight%20Narrative%20Continuity.md).

1. Bestehender Picker liefert maximal drei Ziele. Ein Ideenaufruf erzeugt genau eine Idee je Ziel-ID.
2. `newsProposal` bewahrt Start, Ziel, Kontext und gewählte Idee. Der Writer prüft diese Identität erneut und erfindet keine Ersatzidee.
3. Der Shared-Browser ergänzt nur das ausgewählte Ziel. Shared-Core liefert Navigation, Umgebung, Geländehöhen, Hindernisse und Wetter. Keine duplizierte Geo-/Wetterlogik.
4. Ein Writer erzählt dieselbe Idee und die Begrüßung. Wetterdarstellung wird separat aufgelöst; ein Wetterfehler verwirft keine brauchbare Story.
5. Vorhandener V4-Contract, Speicher-/Cloud-Kompaktierung und POI-Laufzeit übernehmen die Mission.

`mission-news-briefing-core.js` enthält Ideen-/Writer-Vertrag, History und Erzählkontext. `mission-news-briefing-browser.js` verbindet ihn mit den bestehenden Diensten. Keine neue Startstrecke, Runtime, Reparaturschleife oder Klassifikation.

## Ideenvertrag

`news-idea.v1`: Ziel-ID/-name, `taskDomain`, `outlet`, `headline`, `situation`, `angle`, `airValue`, `deliverable`, Person mit Name/Rolle. `situation` ist der konkrete fiktive Anlass; `angle` eine offene journalistische Frage; `airValue` ein aus der Luft beobachtbarer Zusammenhang; `deliverable` Material und Verwendung, kein vorweggenommenes Ergebnis.

`news-briefing.v1` bewahrt Idee, Quellenkontext, Bericht, Wetterdarstellung und Writer-Memory. Profil und Rolle bleiben `news_coverage` / `news_reporter_professional_v1`. Ein Reporter, Kamera-/Audio-Set mit 32 lbs, Rückkehr zur Basis entsprechend dem bestehenden Profil. `ga_poi_news_history_v1` ist auf zwölf Einträge und 16.000 JSON-Zeichen begrenzt.

Anlass, Redaktion und Figuren dürfen fiktiv sein. Reale Geografie und Wetter kommen aus Belegen. Keine Namensinterpretation als Ortsquelle. Unbelegte Bauhistorie wird nicht zur Grundlage eines Jubiläums gemacht. Der Flug illustriert die Geschichte; Bilder beweisen keine wirtschaftlichen oder physikalischen Ursachen.

## Flugtexte und Tracker

Der vollständige Reportageauftrag geht über `voiceContext` in den bestehenden `_baseContext`, analog zu APT-Ideen. Motivation vor dem Ziel, offene Bildabsicht am Ziel und Fazit nach bestätigtem Abschluss beziehen sich auf dieselbe Geschichte. Erzählton darf zum Anlass passen, einschließlich Humor. Die Begrüßung bleibt an die gewählte Person gebunden.

Bestehende In-Sight-/Entry-/Altitude-/Satisfied-/Abort-/Farewell-Auslöser bleiben unverändert. App und Tracker verwenden weiter Context v1 und den generierten `mission-poi-voice-core.js`. Diesen nur über `node tools/generate-poi-voice-core.mjs` erzeugen. Neue Reporter-Schemata erhalten keine aus Story-Schlüsselwörtern abgeleiteten Inspektionsmetadaten. Die Ausnahme gilt nur für `news-briefing.v1`, nicht für ältere Reporter oder andere Profile.

Vor Veröffentlichung braucht der geänderte gemeinsame Voice-Core auch eine neue Tracker-EXE, damit beide Seiten dieselben Promptregeln verwenden. Bisher kein Simulator-/Hörtest und kein vollständiger Browser-Picker-/Restore-Test.

## Erste Live-Serie und Prüfung

Drei Gemini-Missionsversuche, danach ausgewertet. Je Versuch höchstens ein Ideen- und ein Writer-Aufruf, kein automatischer Reparaturaufruf. Ziel: Sommerbergtunnel. Lokale Zielbelege und aufgezeichnete OSM-Umgebung; Wetter und Terrain aus der früheren Diagnose rekonstruiert, ausdrücklich keine aktuellen Messungen. Ein zusätzlicher Netzwerkstart scheiterte vor API-Kontakt an DNS; kein weiterer Modellversuch.

[Rohantworten und Ergebnisse](examples/POI%20Reporter%20First%20Batch.json):

- Versuch 1, v1.0: drei Ideen für dasselbe Einzelziel; korrekt als mehrdeutig verworfen. Anzahlvorgabe danach explizit gemacht (Zwischenstand im Lauf 2 noch mit Versionskennung v1.0).
- Versuch 2: formal angenommen, aber unbelegte Bauhistorie und vorweggenommene Verkehrs-/Wirtschaftsfolgen. Inhaltlich nicht freigabefähig.
- Versuch 3, v1.2: formal angenommen, anderer Anlass, jedoch unplausibler Nachweis von Kaltluftwirkungen durch Fotos. Inhaltlich nicht freigabefähig.

v1.3 trennt die größere Reportagefrage vom begrenzten Bildbeitrag und stärkt menschliche Anlässe ohne erforderliches technisches Problem. Dieser letzte Promptstand ist noch nicht live geprüft. Die Serie belegt keine ausreichende Vielfalt oder Humorqualität. Nächste Serie: Stadt-/Industrieziele ergänzen, maximal drei Versuche, dann erneut auswerten.

243 automatisierte Tests bestanden (Reporter, Foto, Infrastruktur, Shared, Wetter, APT, Tracker-Runtime/-Lifecycle). Nach letzter Promptkorrektur die zwölf Reporter-/Voice-Tests erneut bestanden. 5.376 Vergleiche der bisherigen Voice-Prompts mit eingefrorenem Original bestanden, zusätzlich Learning-Guide-Prüfungen. Strukturprüfungen sichern Identität und Quellen-IDs, nicht die sachliche Plausibilität jeder KI-Aussage. Opt-in bleibt bis zur weiteren inhaltlichen und Browser-/Tracker-Prüfung bestehen.

## Zweite Serie und APT-History-Abgleich

Die lokale History enthielt frühere, strukturell angenommene Testmissionen und wurde nach jedem erfolgreichen Entwurf fortgeschrieben. Tests verwendeten keine produktiven Nutzerdaten. Ziele aus lokalen Tiles: Stadt Hausach (48.28363, 8.17497) und Industriegebiet Am Erlenbach (48.33255, 8.04059). Für beide keine übernommenen Tunnel-Umgebungsflächen, Wetter- oder Terrainwerte. Der gemeinsame Bericht zeigt fehlende Daten entsprechend an.

[Rohantworten](examples/POI%20Reporter%20Second%20Batch.json):

1. Hausach v1.4: Wette über versteckte Grünflächen, spielerischerer Anlass, aber erfundene Dachgärten, Atrien und Industriegeschichte. Inhaltlich nicht freigabefähig.
2. Am Erlenbach v1.5: Debatte um gemeinsame Hofflächen, jedoch ungestützte Hang-/Talbehauptungen und Beurteilung der Flächeneffizienz. Weiterhin zu technisch und konfliktorientiert.
3. Hausach v1.6: Gemini HTTP 503 vor der ersten Antwort, kein Writer. Kein Qualitätsbefund. Die Serie wurde nach drei Versuchen beendet.

v1.6 vereinfacht die Ideenführung: menschlicher Anlass zuerst, journalistischer Blickwinkel als Publikumsinteresse, Überblick als ausreichender Bildbeitrag. Keine erforderliche Streitfrage. Dieser Stand ist noch nicht live geprüft; weitere Tests nötig, bevor Aktivierung oder Release gerechtfertigt sind.

Der APT-History-Abgleich ist zugleich auf die fertigen Foto- und Infrastrukturprofile übertragen. [Details und Speichergrenzen](POI%20Photo%20Migration%20Template.md#history-abgleich-mit-apt-29092026). Drei neue Integrationstests prüfen, dass gespeicherter Anlass und Writer-Memory bis in den nächsten Ideen- und Writer-Prompt gelangen. Die Übergabe funktioniert; die Live-Serie zeigt zugleich, dass History allein keine verlässliche semantische Vielfalt garantiert.

## Dritte Serie: Ideenführung und History-Kontrollprobe

Drei vollständige Gemini-Missionen, jeweils ein Ideen- und ein Writer-Aufruf. [Rohantworten und Resultate](examples/POI%20Reporter%20Third%20Batch.json). Kein Browser-/Simulatorlauf. Die lokalen Ziele bleiben Hausach und Am Erlenbach; keine Wetter-, Terrain- oder Flächenwerte hinzugedichtet.

1. Hausach v1.6, vier frühere Testmissionen in History: Lichtinstallation an der Burgruine und Prüfung von Sichtachsen. Die Idee erfindet Ortsmerkmale, verschiebt den Fokus zum benachbarten Wahrzeichen und wird zur technischen Prüfung. Nicht freigabefähig.
2. Am Erlenbach v1.7, fünf frühere Testmissionen in History: Imker und Dachbegrünung als Insektenkorridor. Unbelegte Begrünung/Schlote, fachliche Begleitung statt klarer Reporterrolle und ökologische Beweisabsicht. Nicht freigabefähig.
3. Gleiches Industrieziel und gleicher Prompt v1.7, kontrolliert ohne History: Bericht über eine fiktive Firmeninvestition und Solardächer. Besserer journalistischer Bildzweck, aber konkrete Solaranlagen und Erweiterung als vorhandenes Motiv erfunden. Noch nicht freigabefähig.

v1.7 strafft gemeinsame Regeln und Ideen-/Writer-Führung. Der menschliche Anlass kommt zuerst; Bildmaterial illustriert einen Beitrag, statt eine These zu beweisen. Keine neuen Regex-Filter, Motivkataloge oder globalen Klassifikationsänderungen.

Befund: Die History wird technisch korrekt übergeben. Eine einzelne Kontrollprobe beweist keinen kausalen History-Effekt; sie zeigt aber, dass die unbelegten Bildmotive auch ohne frühere Entwürfe entstehen. Die produktive History bleibt aktiv und unverändert. Nicht durch Löschen früherer Missionen oder automatisches Akzeptieren dieser Entwürfe kaschieren.

Offener Qualitätsfokus: Der frei erfundene Anlass darf nicht stillschweigend zum Beleg für physisch vorhandene Bildmotive werden. Beispielsweise ist eine fiktive Absicht ein zulässiger Anlass; neu behauptete Anlagen sind keine verifizierte Kulisse. Die nächste Verbesserung sollte diese Verbindung zwischen belegtem Ziel und frei erfundener Handlung positiv führen und an knapper sowie reichhaltiger Faktenbasis vergleichen. Der aktuelle Stand ist weiterhin opt-in und nicht veröffentlicht.

Verifikation: 246 Regressionstests bestanden. Nach der Promptstraffung die 13 Reporter-/Voice-Tests erneut bestanden; Syntax- und Diff-Prüfung ebenfalls erfolgreich. Diese Prüfungen ersetzen keine inhaltliche Freigabe der KI-Ausgaben.

## Nutzerklarstellung: Bauwerksfiktion und Assets

Plausible Bauwerksdetails wie eine Solaranlage auf einem Firmendach sind ausdrücklich erlaubt. Reale Nachrichtenereignisse stehen nicht zur Verfügung und sind keine Voraussetzung. Frühere Ablehnungen allein wegen erfundener Solardächer sind damit überholt: Der dritte Entwurf der dritten Serie ist in dieser Hinsicht zulässig. Geografie, Lagebericht und Wetter bleiben quellengebunden; technische Beweisversprechen bleiben unpassend. Prompt v1.8 übernimmt die Trennung. Noch kein neuer Live-Test dieses Stands.

Asset-Bestandsaufnahme: `data/mission-scene-assets.js` sieht für News unter anderem road_incident, construction_site, industry_site, media_site und event_site vor. Event-Szenen verwenden hauptsächlich Bus/Van/Pylonen; eine umfassende Menschenansammlung folgt daraus nicht. Der Katalog ist kein Nachweis der korrekten Platzierung oder Sichtbarkeit einer konkreten Szene. Im untersuchten Katalog wurde keine Solar-Rolle gefunden.

Der neue Reporter-Core liefert bisher lediglich einen generischen sceneIntent mit leeren visibleIdeas und densityHint none. Damit fehlt eine bewusste, aus der gewählten Idee abgeleitete Szenengestaltung. Nächster Integrationsschritt: optionale Szenenabsicht aus derselben Idee an den bestehenden Composer übergeben, verfügbare Rollen statt erfundener SimObject-Titel. Platzierung, Größenwirkung aus der Luft und Übereinstimmung von Briefing, Voice und tatsächlich erzeugter Szene müssen geprüft werden. Keine parallele Spawn- oder Tracker-Laufzeit einführen. Bestehende gemeinsame Composer-/Platzierungslogik in diesem Schritt noch nicht verändert.

## Allgemeine Bauwerksfiktion und Szenenanbindung v1.9

Weitere Nutzerfreigabe: Nicht nur Solardächer, sondern allgemein plausible Ausstattung, Aktivitäten und Veränderungen an Gebäuden/Anlagen sind erlaubt, sofern Zielidentität und Grundcharakter erhalten bleiben. Keine Einzelbeispiel-Ausnahme und keine Einschränkung auf reale Nachrichten. Geografie, Gelände und Orientierung bleiben quellengebunden.

Der Reporter-Adapter gibt der Ideenentwicklung jetzt `sceneCapabilities` aus dem vorhandenen `MISSION_SCENE_ASSETS`-Katalog mit: für News vorgesehene Szenenarten sowie verfügbare Feature-Gruppen und Rollen. Keine erfundenen SimObject-Titel. Das umfasst registrierte Modelle aus Pack/Simulator, ist aber keine automatische Inventur sämtlicher installierter oder gestreamter SimObjects. Neue noch nicht katalogisierte Modelle weiterhin nach der [Asset-Strategie](../data/mission-scene-asset-strategy.md) ergänzen und prüfen.

Die gewählte Idee bewahrt optional `sceneIntent` mit summary, visibleIdeas, densityHint und notes. Mehrere Objekte und belebte Gruppen sind ausdrücklich erwünscht, wenn sie zum Anlass passen; keine pauschale Beschränkung auf sparse. Konkrete Gegenstände und Anordnung als Klartext, keine vom Writer erfundenen Koordinaten. Die Struktur bleibt innerhalb der bestehenden Sanitizer-Grenzen (10 Ideen à 100 Zeichen, summary 260, notes 220). Ältere Ideen ohne Szene bleiben lesbar.

Die Szene wird unverändert aus der ausgewählten Idee in Mission und V4-Vertrag übernommen. Writer und Voice kennen dieselbe Idee. Bestehende App-Finalisierung und Accept-Composer erhalten die Wünsche über ihre bisherige sceneIntent-Schnittstelle. Kein neuer Spawn-Pfad, keine Änderung an globaler Klassifikation, Asset-Mapping oder Tracker-Ausführung. Der Composer entscheidet über Modelle und geeignete Platzierung. Eine gewünschte Szene ist noch keine Spawn- oder Sichtbarkeitsbestätigung und keine neue Erfolgspflicht.

Tests prüfen Katalogübergabe, Ausschluss konkreter Asset-Titel aus dem Ideenrahmen, Bindung an die gewählte Idee, Vertrags-/Kompaktspeicherung und tatsächlichen bestehenden sceneIntent-Sanitizer. Physische Platzierung und Sichtbarkeit benötigen weiterhin einen Simulator-Test.

Erster Liveversuch v1.9: Eine Künstlergruppe gestaltet Hallenwände; eine Reporterin sammelt Bilder für eine Lokalreportage. Gewünschte Unterstützung durch Kran und Service-Fahrzeuge. Formal angenommen, derselbe Szenenwunsch bis in den Vertrag erhalten. Die Hallengestaltung ist erlaubte Fiktion, aber nicht automatisch eine darstellbare Fassadentextur. Die zusätzlich erwähnten Schwarzwaldhänge bleiben unbelegte geografische Ausschmückung. Daher noch keine allgemeine Qualitäts-/Releasefreigabe. [Rohantworten und Vertrag](examples/POI%20Reporter%20Scene%20Probe.json). 15 Reporter-/Voice-Tests bestanden; kein physischer Spawn-Test.

## Pavillons, Personen und nicht dargestellte Erzählmotive

Nutzerfreigabe: Ein Wandmotiv darf erzählerisch bestehen bleiben, auch wenn es technisch nicht sichtbar dargestellt wird. Das ist allein kein Qualitätsmangel oder Ablehnungsgrund. Personen dürfen Besucher, Teilnehmer und Helfer darstellen. Pavillons ausdrücklich nutzen, wenn passend; keine Pflichtszene.

Der Homebase-Katalog enthält den Faltpavillon `VFR Multitool Homebase MX Pavilion`. Der Missionskatalog erhält dafür die neue additive Feature-/Rollen-Zuordnung `pavilion` / `event.pavilion`. Bestehende Zelt-/Camp-Zuordnungen bleiben unverändert. Personen sind bereits über `people` verfügbar. Der vorhandene katalogbasierte Normalizer akzeptiert die neue Feature-ID; keine neue Klassifikationsheuristik. Physischer Spawn und Platzierung sind noch nicht geprüft. Prompt v1.10 verdeutlicht die Nutzung und die erlaubte Abweichung zwischen erzählerischem Detail und darstellbarer Szene. Noch nicht veröffentlicht.

## Existing asset tags reused

User correction: The pack already defines cargo/scene/Homebase suitability. Scene-capable pack assets are now imported from those fields rather than individually hand-listed. See [asset integration](../data/mission-scene-asset-strategy.md#tagged-homebase-pack-assets-in-mission-scenes). The Reporter receives labels, roles and existing tags; concrete model titles remain application-owned. The normal scene composer receives the generated feature catalogue. All 32 eligible props reach the existing scene item builder; previous catalogue-only pavilion support also gains item emission. Eighteen targeted tests and the existing cargo scene self-test passed. Not released; no physical simulator test.

## Zusammenhang zwischen Handlung und räumlicher Komposition

Die neue Reporter-Familie erhält einen zusätzlichen `reporterScene`-Kontext im bestehenden Scene Planner V3: vollständige gewählte Idee, vorhandene Geo-Anker, Zielzentrum, SceneAnchor und kartierte Avoid-Zone-Polygone. Bisher waren diese im allgemeinen kompakten Geo-Kontext nur gezählt. Keine neuen Kartendaten werden behauptet; Ankerpunkte allein belegen keine freien Stellflächen. Die Ergänzung ist an `news-briefing.v1` gebunden.

Kompositionsregeln führen vom erzählten Geschehen zum Mittelpunkt und passenden Arbeits-/Besucher-/Fahrzeuggruppen. Requirements enthalten Objektgruppe, Anzahl, Funktion, lokale Offsets und Anordnung. Spacing für explizite Reporter-Gruppen bleibt zwischen 2 und 30 m. Fehlende Geometrie darf nicht durch erfundene Fassaden oder freie Plätze ersetzt werden. Nicht darstellbare Erzählmotive bleiben zulässig.

Für `news_coverage` kann ein nichtleerer, geprüfter Requirements-Plan `objectPolicy: explicit-requirements` erhalten. Bei der Objektbildung entfallen dann pauschale Basisausstattung und zusätzliche aus dem Storytext abgeleitete Features. Wiederholte Requirements desselben Features werden als getrennte Gruppen gezählt. Die expliziten Gruppenoffsets werden nicht erneut durch Schlüsselwörter wie „Parkplatz“ auf einen anderen Anker verschoben. Bestehende abschließende Platzierungsprüfungen und Gesamtlimits bleiben bestehen. Ohne diese Policy läuft die bisherige Szenenbildung unverändert.

Prüfung: Tatsächlicher Item-Builder erhält zwei Pavillons in einer Gruppe und einen an einem anderen Mittelpunkt; alle drei Positionen bleiben erhalten, ohne Default-Bus/Van/Kegel. Übernahme der vollständigen Reporteridee und Polygone geprüft; andere Profile erhalten den Zusatzkontext nicht. 109 gezielte Tests einschließlich Tracker-POI-Runtime/-Lifecycle sowie der Cargo-Szenentest bestanden. Kein neuer Composer-Livetest und keine visuelle Simulatorabnahme in diesem Schritt. Noch nicht veröffentlicht.

## Korrektur nach Satellitenprüfung (29.09.2026)

Der erste vollständige Composer-/Objekt-Test zeigte einen ca. 185 m versetzten Szenenanker, sämtliche Gruppen auf (0,0) sowie Kartons/Paletten statt Seecontainern. Die Satellitenansicht machte die Platzierung außerhalb des Werkhofs sichtbar. Dies war kein erfolgreicher Szenentest.

Die Korrektur bleibt an `news-briefing.v1` gebunden:

- `mainTarget` und `sceneAnchor` bleiben beim exakt gewählten POI. Für Reporter-Objekte gilt ein fester Nord/Ost-Rahmen (forward=north, right=east, heading=0). Gerundete Navigations-/Landmarkenabstände sind keine Platzierungskoordinaten.
- Lokale Kartengeometrie wird im 350-m-Radius ohne die frühere Ausgabebegrenzung auf 160 Elemente geladen. Ein eigener Cache-Key trennt sie vom bisherigen Orientierungskontext. Bei Overpass-Ausfall liest der Reporter-Adapter dieselbe Region über die OSM-Map-API. Gebäude, Straßen, Wasser und Wald werden als Ausschlussgeometrie an den Composer gegeben; Industrie-/Parkplatz-/Offenflächen als kartierte Nutzungen. Ein fehlendes Polygon ist kein Nachweis einer freien Fläche.
- `mission-reporter-scene-core.js` hält Projektion, Flächenprüfung, Gruppenpositionen und Planvalidierung browserunabhängig. Liegt das Ziel in einer kartierten Nutzungsfläche, bleiben die Objekte innerhalb dieser Fläche. Abstandsradien sind konservative Planungswerte, keine vermessenen Modellgrundrisse.
- Der Vertrag setzt `objectPolicy=explicit-requirements` verbindlich. Jedes Requirement nennt eine kataloggültige `feature`/`role`-Kombination, Anzahl, Abstand und Position. Komplexe Formen werden als einzelne Requirements geplant. Der normale Item-Builder erzeugt nur diese Rollen und übernimmt die geprüften Positionen ohne semantisches Re-Ankern oder pauschale Basisausstattung.
- Additives Feature `shipping_container` nutzt ausschließlich die bereits katalogisierten Microsoft-Container-Varianten. Der gemischte `cargo_material`-Pool anderer Szenen bleibt unverändert.
- Ungültige Pläne erhalten konkrete geometrische Rückmeldung im bestehenden Composer-Dialog. Reporter bleiben beim ausgewählten ersten Modell; bei ausbleibender gültiger Szene gibt es keine zufälligen Ersatzobjekte. Fehlende Kartengeometrie ist ein diagnostizierter Szenenausfall, kein fiktiver Hof.

Regression: synthetische Gebäude-/Straßen-/Flächenkanten, überlappende Gruppen, falsche Rollen, POI-Anker sowie originaler Item-Builder. Die OSM-Testdaten `tools/fixtures/reporter-erlenbach-osm.json` stammen aus der öffentlichen Map-API; keine erfundenen Gebäude oder Höfe. Keine Tracker-State-Machine oder neuen Voice-Trigger. Nicht veröffentlicht; horizontale Kartenprüfung ersetzt keinen physischen MSFS-Spawn-Test.

### Live-Ergebnis dieser Korrekturserie

Drei Composer-Durchläufe mit **derselben** bereits erzeugten Mission; keine weiteren Geschichten und kein Simulator-Spawn. [Reproduzierbarer Datenstand](examples/POI%20Reporter%20Satellite%20Correction.json).

1. Vollständige Polygone direkt und mehrfach im Prompt: zu großer Kontext (ca. 30.000 Tokens), abgeschnittene Antworten und Abstandsfehler. Keine Szene freigegeben.
2. Kompakte Geometrieübersicht, positive Platzierungskandidaten, vollständige Polygone nur in der Prüfung: 10 gültige Objekte nach zwei räumlichen Korrekturantworten. Richtiger POI-Anker; fünf katalogisierte Container; keine Positionsduplikate. Noch rasterförmig.
3. Zusätzlich klarere Führung zu Hauptform und zusammengehörigen Besucherbereichen: neun gültige Objekte nach einer Korrekturantwort, diesmal mit tatsächlich genutztem OSM-API-Fallback. Zwei Container, zwei Pavillons, zwei Personen, Van, Aggregat, Palette. App-Item-Builder übernimmt die geprüften Positionen unverändert. Die ursprünglich gewünschte U-Form aus fünf Containern wird nicht vollständig umgesetzt; die Szene wurde reduziert. Keine Behauptung eines stets beim ersten Versuch gültigen Composers.

Satellitenprüfung: Die neue Szene liegt im Industrieareal und außerhalb der erfassten Gebäude. Das Bild zeigt jedoch belegte Stellflächen, deren parkende Fahrzeuge in OSM nicht als Hindernisse vorliegen. Die Korrektur garantiert deshalb keine freie Fläche im realen Gelände oder in der konkreten MSFS-Szenerie. Diese Grenze darf bei künftigen Tests nicht als bestandene physische Kollisionsprüfung dargestellt werden.

Verifikation: 67 gezielte Tests erfolgreich; Cargo-Szenentest erfolgreich; bestehender POI-Lifecycle-Differenztest mit 11.520 Vergleichen, 416 Farewell-Vergleichen und 864 Cargo-Stress-Vergleichen erfolgreich. Syntax und `git diff --check` erfolgreich. HTML-Satellitenkarte und Markerauswahl visuell geprüft. Nicht veröffentlicht.

## Abschlussserie: drei neue Missionen, Rollout zurückgestellt (29.09.2026)

[Aufträge, Rohantworten, Geometrie, Items und neun PAX-Phasen](examples/POI%20Reporter%20Release%20Gate%2020260929.json).
Exakt drei neue Missionen mit je einem Ideen- und Writer-Aufruf; History
enthält nacheinander 0, 1 und 2 vorherige Testaufträge. Anschließend jeweils
Original-Composer mit Gemini im isolierten Browser und originaler Item-Builder.
Keine Live-Simulator-Spawns. Wetter/Terrain waren bei der Story-Erstellung
bewusst nicht vorhanden; keine aktuelle Wetterabnahme mit dieser Serie.

| Ziel / Geschichte | Ergebnis |
| --- | --- |
| Am Erlenbach: „Stahl-Wald“ beim Firmenjubiläum | Story formal angenommen. Erster Szenenplan verletzt mehrere Objekt- und Straßenabstände; Korrektur läuft in das 45-s-Zeitlimit. Kein akzeptierter Aufbau. |
| Hausach: gemeinschaftliches Willkommens-Mosaik | Story formal angenommen. Composer läuft nach Kontextabfrage ins Zeitlimit. Keine großen Ground-Kandidaten im getesteten Raster; die gewünschte große Containerszene ist dort nicht belegt. |
| Sommerbergtunnel: ehemalige Straßenmeisterei-Mitarbeiter während Wartungspause | Zehn geometrisch gültige Items nach zwei Korrekturantworten. Sämtliche Mittelpunkte liegen jedoch auf `landuse=meadow`, `way/615254887`. Die erzählte befestigte Portalvorfläche wird dadurch nicht belegt. Inhaltliche Platzierungsprüfung nicht bestanden. |

**Kein Rollout.** Die erfolgreichen Einzel- und Integrationstests belegen noch
keine ausreichende Zuverlässigkeit des freien Composers. Beim dritten Test ist
`ground` zu grob: Nutzungsart, Befestigung und Bezug zur verlangten Portalfläche
gehen in der Kandidatenübersicht verloren. Ein gültiger geometrischer Abstand
ist nicht automatisch eine passende Szene. Zusätzlich müssen große Szenenwünsche
zur verfügbaren Fläche passen, bevor die KI lange erfolglos Koordinaten plant.
Das Zeitlimit nur zu verlängern würde diese Ursachen nicht beheben.

Die drei bestehenden Tracker-Prompts (Ziel in Sicht, Zielbereich, Abschluss)
wurden für jede Mission gerendert und mit Gemini beantwortet. Alle neun Texte
tragen den jeweiligen journalistischen Zweck; keine neuen Auslöser. Teilweise
bestätigen sie aber Wunschobjekte als bereits sichtbar, obwohl kein akzeptierter
Aufbau vorliegt. Diese Textprobe ist daher keine Abnahme der Übereinstimmung mit
der ausgeführten Szene. Für den späteren vollständigen Test die akzeptierte
Szene in den Kontext einbeziehen. Keine Audio-/MSFS-Sichtprüfung durchgeführt.

Die ersten beiden Geschichten ähneln sich trotz übergebener History (große
Kunstaktion im industriellen Umfeld); der Tunnelauftrag setzt einen anderen
Kern. Das ist ein qualitativer Hinweis für die nächste Promptprüfung, kein
Beleg für einen technischen Ausfall des Wiederholungsgedächtnisses.

Nächste gezielte Korrektur: Flächeneignung und gewünschte räumliche Funktion
über Kandidaten, Composer und Validator durchgängig erhalten; Größe und
Darstellbarkeit früh abgleichen; danach dieselben drei Aufträge erneut prüfen,
bevor neue Geschichten die Regression verdecken. Reporter bleibt opt-in.

## Räumliche Korrektur der drei bestehenden Aufträge, 29.09.2026

Arbeitsstand `poi-placement.v3`, noch nicht veröffentlicht. Die Geschichten
wurden nicht neu gewürfelt. OSM-Kartenabfragen liefern vollständige Way-Geometrien
im erweiterten Umfeld; Tags trennen Nutzung, belegte Befestigung und Tunnelenden.
Der räumliche Zweck wird bei der ersten Composer-Antwort festgehalten und darf
bei Korrekturen nicht wechseln. Große Nutzungsflächen werden für die Planung in
lokale Gruppen geeigneter Punkte gegliedert. Fehler erhalten konkrete geprüfte
Korrekturvorschläge; die App verschiebt keine Objekte stillschweigend.

Letzte Ergebnisse:

- Erlenbach: 13 Objekte, fünf Modellrunden einschließlich Werkzeugaufrufen.
  Besucher, Pavillon und Ausrüstung liegen jetzt zusammen auf dem Werksgelände.
  Satellitenansicht geprüft, keine kartierten Gebäudeüberschneidungen.
- Hausach: neun Objekte, vier Modellrunden einschließlich Werkzeugaufrufen.
  Container, Besucher und Unterstützung bilden eine gemeinsame Szene. Vorheriger
  Versuch scheiterte noch an Gebäude-/Personenabständen; nach Ergänzung der
  Korrekturvorschläge ist die abschließende Live-Komposition gültig.
- Sommerbergtunnel: Der aufgezeichnete Gemini-Entwurf wird mit dem endgültigen
  App-Sanitizer ausdrücklich ohne Zusatzszene angenommen. Keine geeignete Fläche
  am Portal belegt; kein Ausweichen auf die Wiese über dem Tunnel. Diese letzte
  Prüfung war ein Replay ohne neuen Gemini-Aufruf, keine dritte erfolgreiche
  Live-Objektszene.

80 automatisierte Tests bestanden. Vier Browserfälle mit echtem Normalizer,
JSON-Wiederherstellung und Item-Builder bewahren Rolle, `siteId`, Zweckbindung
und Offsets (einschließlich 600 m). Kein Simulator-Spawn getestet. Frühere
Tracker-Textproben wurden nicht mit den neuen endgültigen Szenen wiederholt;
vorherige Aussagen darüber sind keine Abnahme dieser Kombination.

Belege: `docs/examples/POI Reporter Placement Correction 20260929.json`, die
beiden `POI Reporter Corrected Scene *.jpg` und komprimierte Geometrien unter
`tools/fixtures/poi-placement-correction-*.json.gz`. Die Bilder verwenden Esri-
Satellitenbilder; Gebäude-/Flächenumrisse stammen aus OSM. Belegung und
Simulatorkulisse sind daraus nicht garantiert. Zwischenstände und Fehlversuche
sind im Ergebnisprotokoll ausdrücklich benannt. Reporter bleibt opt-in; dies
ist kein Nachweis für drei fehlerfreie Erstversuche und kein erfolgter Release.

## Freigegebener Alpha-Rollout

Am 29.09.2026 nach dokumentierter Korrektur ausdrücklich zum Ausrollen freigegeben.
App-Cache v1880 aktiviert Reporter standardmäßig; Tracker v455 enthält die
gemeinsame POI-Erzählgrundlage für die bestehenden Voice-Ereignisse. Keine neuen
Auslöser oder erhöhte Tracker-Mindestversion. Nur Alpha, keine Stable-Promotion.
Die oben beschriebenen Grenzen der Karten-/Simulatorprüfung bleiben bestehen;
die historischen Testabschnitte beschreiben jeweils ihren damaligen Stand.
