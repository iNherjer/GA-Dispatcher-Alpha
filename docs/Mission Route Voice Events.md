# Optionale Gespräche entlang der Route

Alpha-Teststand 15.09.2026: App v1764, Tracker v405. Automatische Tests bestanden; echte Simulator-/Audio-Abnahme ausstehend.

## Vertrag

Neue Vereinsideen dürfen `narrativeEvents` mit null bis drei Objekten ausgeben. Jedes Ereignis hat genau eine Auslöseart: `atPercent` als Zahl größer 0 und kleiner 100 oder `geo` mit `lat`, `lon`, `radiusNm` (größer 0 bis maximal 50 NM). `intent` ist eine selbst entwickelte Gesprächsabsicht bis 600 Zeichen. Beide Triggerarten teilen das Limit von drei Ereignissen. Doppelte Auslösearten in einem Objekt werden abgewiesen.

Für KI-Vereinsideen bindet zusätzlich `geo.anchorId` die Koordinate exakt an einen Eintrag aus `frame.geoAnchors`. Ab v1.9 liefert der Rahmen Start-/Zielplatz, optional den belegten Eventort und bis zu 16 deduplizierte Ortsanker aus der vorhandenen OSM-/Wikipedia-Umgebungssuche an Streckenmitte und Ziel. Beide Suchen sind zeitlich begrenzt und nutzen den vorhandenen Cache. Fehler lassen die zusätzlichen Anker entfallen. Die belegten Koordinaten und Merkmale sind optionale Fakten, keine Besuchsvorschläge oder Aufgaben. Picker und Direktdispatch nutzen dieselbe Anreicherung; ein angenommenes Angebot bewahrt seine damaligen Anker ohne erneute Suche. Die App vergibt stabile IDs anhand der Reihenfolge. Keine Aktivitätsbeispiele im Produktionsprompt; kein Pflicht-Event. Bestehende Ideen ohne dieses Feld funktionieren unverändert.

Verbindliche Präzisierung v1.7: Die Hauptaufgabe bleibt der Flug zum Zielplatz einschließlich der bereits festgelegten Missionsbedingungen. Sidequests sind optionale, ergänzende Voices zur Immersion. Persönliche und fachliche Beteiligung, auch technische Tätigkeiten, dürfen erzählt werden. Sie fordern keine Bedienaktion, werden nicht als Aufgabe geprüft oder als erledigt markiert und erzeugen keine zusätzlichen Abschlussbedingungen. Weder Route noch Manifest oder Erfolgskriterien ändern sich dadurch. Ihre Auslassung ist folgenlos. Reale Funkantworten, Wetter- und Messbefunde bleiben an vorhandene Fakten gebunden.

Der gemeinsame `narrativeContract` in `mission-route-voice-core.js` wird vom Ideenplanner, Briefing-Writer und Ereignis-Voice-Prompt verwendet. Es werden keine Aktivitätsbeispiele als Anker vorgegeben. Der technische `done`-Eintrag bedeutet ausschließlich „Voice-Ereignis bereits beansprucht“, niemals „Sidequest erfolgreich erledigt“.

## Fortschritt und Autorität

`mission-route-voice-core.js` nutzt die gemeinsame Navigationsgeometrie: Projektion auf den aktiven Routenabschnitt, bereits zurückgelegte geplante Abschnitte plus Anteil am aktuellen Abschnitt, geteilt durch die geplante Gesamtstrecke. Es zählt nicht die durch Kreisen tatsächlich geflogene Strecke. Die Navigationsgeometrie bestimmt auch bei Routenänderungen den Abschnitt neu.

Bei Tracker-Autorität liest die Tracker-Runtime die bestätigte `navigationRoute`, sonst die Route des übergebenen Missionsbundles. Eine geometrische Cache-Kopie wird nur bei Run-/Navigationsrevision geändert. Keine DOM- oder App-Telemetrieauslösung nötig. `APT_FLIGHT_VOICE_REQUESTED` erzeugt einen persistenten `voice.flight`-Effekt vom Typ `route_story`; seine ID bindet Run und Ereignis. Die bestehende Voice-Service-/Playback-Lease-Kette führt ihn aus. Der Claim gilt auch bei einem Best-Effort-Audiofehler als verbraucht, damit Reconnect nicht unkontrolliert erneut spricht.

Bei Web-Autorität und im Debug-Sim ruft der Flight-Recorder den identischen Kern auf. Claim und Navigationsfortschritt werden im Runtime-Snapshot gespeichert; erst nach erfolgreichem Claim-Speichern wird Voice gestartet. Bei Tracker-Autorität ist dieser lokale Pfad gesperrt. Bereits gespeicherte ältere Runtime-Snapshots beginnen mit leerem Eventzustand.

## Geo-Verhalten

Der gemeinsame Kern berechnet den Großkreisabstand zur Ereigniskoordinate. Ein Geo-Moment ist nur innerhalb des horizontalen Radius fällig, unabhängig davon, ob eine Navigationsroute verfügbar ist. Ein umflogener Radius erzeugt keinen Ersatztrigger. Wenn Voice beim Durchflug blockiert ist und das Flugzeug den Radius verlässt, wird das noch nicht beanspruchte Ereignis nicht verspätet ausgelöst. Bereits beanspruchte Ereignisse bleiben auch nach Wiedereinflug erledigt. Bei gleichzeitig fälligen Momenten hat ein ortsgebundener Moment Vorrang; die bestehende 45-Sekunden-Abstandsregel bleibt erhalten.

## Gates und Verhalten

Nur während einer aktiven Mission und explizit airborne; kein Auslösen bei Pause, Slew, fehlender Position oder Missionsende. Laufende Voice wird nicht unterbrochen. Zwischen Gesprächsmomenten liegen mindestens 45 Sekunden; nach übersprungenen Schwellen werden fällige Events einzeln abgearbeitet. Prozentwerte sind früheste Auslösepunkte, keine Garantie für sekundengenaue Wiedergabe. Späte Ergebnisse werden beim Missionsende verworfen.

Routenänderungen berechnen offene Schwellen neu. Bereits beanspruchte Ereignis-IDs werden niemals zurückgesetzt. Der Lauf erhält keinen zusätzlichen Erfolgsschritt. Allgemeine Navigation bei Selbstkreuzungen oder weit abseits der Route folgt den bestehenden Regeln der Navigationsgeometrie, nicht einem neuen Voice-spezifischen Routenmatcher.

Der Voice-Prompt enthält den Missionskontext, die aktuelle Gesprächsabsicht und vorher beanspruchte Gesprächsabsichten. Ab v1.9 ergänzt ein begrenztes Gedächtnis tatsächlich vollständig abgespielter Vereinsansagen diesen Kontext (siehe unten).

## Nachweis und Release

Tests: `tools/mission-route-voice.test.cjs`, Club-/Private-/Sim-Regressionen sowie Tracker-Runtime-/Boarding-Voice-Tests. 92 Tests bestanden, einschließlich unveränderter Route, Manifest-Pflichten und Missionseingaben durch narrativeEvents; zusätzlich Geo-Einflug, Umfliegen, Verlassen bei blockierter Voice, Koordinatenbindung und echte Tracker-Geo-Auslösung mit Wiederherstellung. Bisherige Abdeckung: Prozent-Grenzen, Routenänderung, persistente IDs, Pause/Ende, fehlgeschlagener lokaler Claim, gesperrter lokaler Trigger unter Tracker-Autorität, echte Tracker-Telemetrieauslösung ohne DOM, Wiederherstellung und Abbruch verspäteter Audioerzeugung.

KI-Liveprobe v1.6: drei neue Ideen mit History aus den vorherigen drei KI-Ideen. Die KI nutzte freiwillig je ein Event: 45 Prozent, Zielplatz Freiburg mit 15 NM Radius, 70 Prozent. Alle strukturellen Prüfungen bestanden; die redaktionelle Prüfung ist wegen unbelegter Wetter-/Ortsdetails und erneuter Aufgabenverschiebung nicht bestanden. Rohdaten und Bewertung: `analysis/club-ideas-v1-6-live.json`, `analysis/club-ideas-v1-6-review.json`. Die Nutzerpräzisierung v1.7 korrigiert die damalige redaktionelle Grenze: fachliche Tätigkeiten sind als reine Erzählung ausdrücklich erlaubt und allein kein Ablehnungsgrund. Unbelegte reale Wetter-/Orts-/Messbehauptungen bleiben ein gesonderter Qualitätsaspekt. Die archivierte v1.6-Bewertung bleibt als historische Prüfung erhalten. Noch offen: Liveprobe des präzisierten Erzählrahmens, realer App-/Tracker-/Audio-Mehrinstanztest und Auslieferung. Ein Web-Push allein aktualisiert den Tracker-Code nicht: Zur Veröffentlichung muss auch ein neuer Tracker-Build mit den geänderten Runtime-/Voice-Modulen und dem gemeinsamen Core ausgeliefert werden. Keine Tracker-EXE wurde in diesem Arbeitsschritt gebaut.

## Tracker-Pfad-Nachprüfung

Die lokale Nachprüfung hat zwei Integrationslücken korrigiert: `route_story` bleibt jetzt auch in Voice-Service-Normalisierung und Cache-Restore als eigener Jobtyp erhalten. Der Tracker-Trigger liest aktuelle zentrale Audio-Einstellungen statt ausschließlich den Handoff-Snapshot. Später aktivierte PAX-Voice kann damit neue, noch nicht beanspruchte Ereignisse auslösen. 93 relevante Voice-/Runtime-/Club-/Trigger-Tests bestanden, einschließlich Aktivierung nach stummem Handoff. Neuer Tracker-Build und echter Audio-Livetest bleiben ausstehend.

## Ergänzung v1.9: Gesprächsgedächtnis und Alpha-Kandidat

App und Tracker speichern ausschließlich vollständig abgespielte Vereinsansagen: maximal zwölf Texte, jeweils bis 1000 Zeichen, insgesamt bis 4000 Zeichen. In der App liegt dies im bestehenden Runtime-Snapshot, beim Tracker entsteht die History mit dem persistenten Voice-ACK und wird beim Restore erhalten. Stumme, verworfene, abgebrochene oder bloß erzeugte Clips werden nicht als gehört gespeichert. Die Textgenerierung nutzt die History für weitere Gespräche einschließlich Anflug und Farewell; ein bereits vorproduzierter Clip bleibt auf seinem damaligen Wissensstand. Claims und Gesprächsabsichten bleiben zusätzlich für die Ereignis-Deduplizierung erhalten. Andere Missionsarten erhalten diese neue History nicht.

Release-Kandidat: App v1764, Tracker v405 Alpha. Build und automatische Tests ersetzen keinen realen Simulator-/Audio-Mehrinstanztest. Die nutzerseitige Hörprobe bleibt offen.

Release-Prüfung: 172 Tests des isolierten Alpha-Stands bestanden (Execution-Core, Route-/Club-Voice, Private-/Sim-Regressionen, Tracker-Adapter/Runtime, Boarding/Farewell/Voice-Service). Windows-x64-EXE mit `npm run build:tracker -- --no-bytecode --public --public-packages "*"` paketiert, da die lokale x64-Bytecode-Hilfsruntime auf diesem Mac nicht startet. Gleiche JS-Quellen und Windows-Node-Zielruntime; keine Windows-Ausführung hier geprüft. Stable bleibt unverändert.
