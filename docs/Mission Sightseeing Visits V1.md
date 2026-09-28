# APT Sightseeing: Besuchsplan V1

Stand: 28.09.2026, lokal implementiert; noch nicht veröffentlicht.

## Fachlicher Vertrag

`sightseeing_tour` im APT-Modus ist ein Transfer zum Zielflugplatz. Erst nach der
Landung beginnt der geplante Besuch von ein bis drei realen Orten innerhalb von
30 km Luftlinie. Was diese Orte interessant macht, trägt das Briefing. Eine
persönliche Motivation verbindet die Reise, muss aber kein Problem lösen.
Einzelgäste und gemeinsame Gruppen bleiben durch die aktuelle Passagierkapazität
und die bestehende Tracker-Gruppenfreigabe begrenzt. Eine benannte Person spricht
für die Gruppe. Gepäck gehört zu den Reisenden; es ist keine zusätzliche Lieferung.

Die bestehende APT-Abschlusslogik bleibt maßgeblich. Es werden keine POI-Flugziele,
Pflichtbesuche, neuen Wegpunkte oder erfolgreichen Besichtigungen modelliert.
POI-Sightseeing und vorhandene Offline-Missionsvorlagen bleiben unverändert.

## Daten vor Prosa

1. `mission-sightseeing-context-core.js` sammelt geografisch verortete Wikipedia-
   Einträge: regionale Relevanzsuche bis 30 km sowie nähere Geosuche bis 10 km.
   Dedupliziert werden maximal 200 Einträge. Namen, IDs, Koordinaten und kurze
   Beschreibungen sind Quelldaten, keine Szenariovorgaben.
2. Die KI wählt bis zu acht Einträge für die Recherche. Anschließend werden deren
   Einleitungen abgerufen. Erst diese Beschreibungen gelten als inhaltliche
   Faktenbasis. Koordinaten und 30-km-Grenze werden erneut geprüft.
3. `mission-sightseeing-ideas-core.js` erzeugt `sightseeing-idea.v1`: Besuche mit
   exakten Orts-/Fakten-IDs, Interesse, Gruppe, Gepäck und optionalen Gesprächs-
   absichten. Unbekannte IDs oder Geo-Anker außerhalb der Auswahl werden abgelehnt.
4. Der Writer liefert Einleitung, genau einen freien Absatz je Besuchsziel und
   Ausblick auf den Anschluss am Boden. Nur die Begrüßung ist direkte Rede;
   das Briefing bleibt Erzählertext. Die Absätze werden zusammengefügt, nicht
   durch alte Sightseeing-Textbausteine ersetzt.
5. Wetter kommt aus dem bestehenden aktuellen Dispatch-Snapshot mit geprüften
   Referenzen. Eine Wetterkorrektur darf die akzeptierte Geschichte nicht ändern.

Keine konkreten Nutzerbeispiele, Ortslisten oder Szenarioschablonen im Prompt.
Die geografische Kandidatenmenge und tatsächliche History bilden die Anregung.
Der Picker speichert seine vollständige Auswahl samt Quellen. Die Annahme
recherchiert oder würfelt sie nicht neu; Route und Kapazität werden erneut geprüft.

## Wahrheit und Grenzen

Die Quellen belegen Ortsmerkmale und Geschichte, keine aktuelle Öffnung, Buchung,
Veranstaltung oder Anschlussfahrt. Der Besuch liegt noch bevor. Persönliche
Erwartungen dürfen erfunden werden; zusätzliche historische Behauptungen nicht.
Wikipedia wird direkt abgefragt, ohne Google-Suche oder ungeprüftes Modellwissen.
Abrufe sind zeitlich begrenzt. Bei fehlender Faktenbasis scheitert der Entwurf
verständlich, statt eine erfundene Sehenswürdigkeit einzusetzen. Die geografische
Suche ist keine vollständige touristische Bestandsaufnahme; im Ausland kann die
deutschsprachige Quellenabdeckung eingeschränkt sein.

Die Prüfung garantiert Quellen-/ID-Zuordnung und Struktur, keine automatische
semantische Beweisprüfung jedes generierten Satzes. Stichproben bleiben nötig.

## Voice und Persistenz

Null bis drei optionale Ereignisse verwenden bestehende Prozent- oder Geo-Trigger.
Sie ergänzen belegtes Wissen und Vorfreude auf die ausgewählten Orte. Keine
behauptete Sichtbarkeit aus dem Flugzeug, keine vorweggenommenen Besichtigungen,
keine Aufgaben oder Abschlussbedingungen. Der gemeinsame Triggerkern bleibt
unverändert; ein eigenes Schema legt die Sprecherrolle als mitreisenden Gast fest.

- Standalone/Debug-Sim: `sync.js` beobachtet den Fortschritt und persistiert den
  Claim vor der Wiedergabe. Tracker-Autorität unterdrückt den parallelen App-Trigger.
- Tracker: bestehende Telemetrie-Runtime löst `route_story` ohne DOM aus. Der
  Authority-Kontext enthält den belegten Besuchsplan und das Sprecher-Schema.
- Nur vollständig abgespielte Texte kommen in die bestehende Gesprächshistory
  (`routeVoice.spoken` bzw. historisch benanntes `voice.clubHistory`).
- `sightseeingIdea`, Quellen, Fakten und Trigger bleiben in Mission und Contract
  erhalten, auch bei Quota-Fallback und allen drei Cloud-Kompaktierungsstufen.
- Lokale Ideenhistory: maximal zwölf Entwürfe / 16.000 Zeichen, mit Ortsnamen,
  Thema, Einstieg, Writer-Erinnerung und Gesprächsabsichten. Sie ist keine
  geräteübergreifende Reisebiografie. Der aktive Besuchsplan wird synchronisiert.
- Debug-Bericht nennt Besuchsorte, Quellen und geplante Zusatzansagen ausdrücklich.

## Nachweise und Veröffentlichung

Verifikation: 102 gezielte Core-, Browseradapter-, Persistenz- und Tracker-Tests bestanden; Syntax- und generierter Tracker-Voice-Abgleich ebenfalls erfolgreich.

Gezielte Tests: `tools/mission-sightseeing-ideas.test.cjs`,
`tools/mission-sightseeing-persistence.test.cjs`, gemeinsamer Route-Voice-Test
sowie Tracker-Runtime-Test mit Sightseeing-Schema und Neustart. Der Live-Probe
`tools/sightseeing-ideas-live-probe.mjs --run` verwendet echte Quellen und eine
isolierte History; Schlüssel bleiben lokal. Kein Live-Wetter im Probe.

Vor Veröffentlichung: Cache-Version nach Push-Workflow erhöhen, neue drei Browser-
Module einschließen und Tracker neu bauen/veröffentlichen. Tracker-History und
Beschriftung wurden angepasst; bloßes Aktualisieren der Website aktualisiert keine
installierte EXE. Noch kein manueller Flugtest in MSFS erfolgt.

### Live-Stichprobe

Der finale direkte Durchlauf mit vollständiger geografischer Datenbasis wurde
in drei Modellaufrufen akzeptiert: Rechercheauswahl, Besuchsplan, Writer.
Er wählte drei reale Besuchsorte und zwei Zusatzansagen (45 % Routenfortschritt
und einen Geo-Trigger mit 5 NM Radius). Der Writer-Korrekturpfad wurde außerdem
mit einer gespeicherten Auswahl erfolgreich geprüft. Vorherige Fehlläufe zeigten
fehlende Ortsabsätze bzw. einen Ansage-Bezug außerhalb der Auswahl; die begrenzte
Formatkorrektur erhält nun konkrete Befunde statt nur eine allgemeine Aufforderung.
Testartefakte liegen lokal unter `analysis/sightseeing-live-20260928-v*.json/.md`.
