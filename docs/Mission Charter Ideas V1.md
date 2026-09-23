# Charter-Ideen V1

Stand: 22.09.2026, lokal implementiert, noch nicht veröffentlicht.

## Rahmen

APT-Charter mit aktiver KI und Auto-/apt_charter-Profil nutzt einen eigenen Ideen- und Writer-Pfad. Bush, News und bestehende Follow-up-Abholungen behalten ihren bisherigen Ablauf. Der Kunde beauftragt den Flug; der Pilot ist professioneller Beförderer. Der Prompt gibt Vertragsregeln, Daten und eigene History vor, keine Anlass- oder Berufsbeispiele.

Alle Reisenden und ihr Reisegepäck sind am Start. Einzelkunden und zusammengehörige Gruppen sind möglich, mit genau einem benannten Sprecher. Die Obergrenze ist die Flugzeug-Passagierkapazität und das bestehende Gruppenlimit von fünf. Ohne bestätigte Tracker-Gruppenunterstützung bleibt die Generierung auf einen Passagier begrenzt. Bei geänderter Kapazität wird eine unpassende Auswahl abgelehnt, nicht still verkleinert.

## Datenfluss

`mission-charter-ideas-core.js` erzeugt/validiert `charter-idea.v1`; `mission-charter-browser.js` verbindet Picker, Ortskontext und Writer. Drei Pickerangebote enthalten bereits die verbindliche Idee. Beim Annehmen wird diese wiederverwendet; Wetterdaten werden aus dem aktuellen Dispatchvertrag bezogen.

Die Geschichte erklärt Reisegrund, Hintergrund und nächsten Bodenschritt. Ergänzt werden tatsächliche Start-/Zielnamen, Distanz, ein separat gebundener Wetterabsatz sowie Passagierzahl, Sprecher und gebuchtes Gepäckgewicht. Wetterzahlen nutzen dieselben geprüften Referenzen wie Private V6. Fehlende oder ungültige Wetterprosa wird kenntlich gemacht. Passagiergewichte, Kraftstoff und Schwerpunkt werden nicht erfunden; die Buchungsübersicht ist keine Weight-and-Balance-Rechnung.

Gepäck ist passagiereigen, wird mit dem Passagier übergeben und erzeugt keine gesonderte Pflichtlieferung. Legacy-Personalisierung und Gruppen-Textanhänge verändern die strukturierte Geschichte nicht mehr.

## Zusatzansagen und Speicherung

Optional null bis drei narrativeEvents mit Routenprozent oder belegtem Geo-Anker. Sie sind reine Erzählungen, ohne Abschlussbedingungen. App und Tracker verwenden den bestehenden route_story-Pfad. `narrativeSchema` markiert Charter-Sprecher für die Gesprächshistory; der allgemeine TaskDomain charter allein aktiviert dies nicht für Bush-Charter.

`charterIdea` bleibt in Missionsdaten, Vertrag, kompaktem lokalen Speicher und Cloud-Core erhalten. Die Ideenhistorie `ga_charter_idea_history_v1` ist lokal und auf zwölf Einträge begrenzt. Sie dient der Variation, nicht als erlebte Vergangenheit. Gehörte Ansagen nutzen die bestehende laufbezogene Runtime-History.

## Prüfung und Veröffentlichung

Regressionen: `tools/mission-charter-ideas.test.cjs`, Club-/Persistenz-/Route-Voice-Tests sowie Mission-Execution- und Tracker-Voice/Runtime-Tests. Zusätzlich bleibt ein echter Hörtest in App-Sim und Tracker-Betrieb erforderlich. Keine Live-KI-Qualitätsstichprobe in diesem Implementierungsschritt durchgeführt.

Für eine Veröffentlichung sind App-Cache-Version und ein neuer Tracker-Build erforderlich, da Tracker-Voice-Module erweitert wurden. Gemischten Worktree nicht pauschal veröffentlichen; nur geprüfte Charter-Änderungen übernehmen.

## Erstes Nutzerergebnis und Nacharbeit (22.09.2026)

Referenzen wurden bisher nur im Wetterabsatz aufgelöst, obwohl der Writer sie auch in Story/Greeting verwenden konnte. Charter löst nun bekannte Referenzen in allen sichtbaren Writerfeldern auf und lehnt unbekannte oder offene Referenzen ab. Bei ungültiger Prosa oder Wetterbindung erfolgt ein gezielter vollständiger Korrekturversuch. Bleibt ausschließlich Wetter ungültig, erscheint weiterhin der transparente Fehlhinweis. Private/Club-Parser bleiben unverändert.

Die zusätzliche PAX-/Gepäck-Datenliste im Erzähltext entfällt. `pilotNotes` ist optional, leer ist gültig. Es enthält nur aus der Idee abgeleitete Besonderheiten für den Piloten. Anzahl und Gewichte stehen im bestehenden Payload-Bereich. Story/Greeting erklären den Auftrag; operative Wetter-/Anflugbehauptungen werden nicht als persönliche Fiktion behandelt.

## Charter-Fortsetzungen: geprüfte Lücke und nächster Integrationsvertrag

Noch NICHT auf den neuen Writer migriert. `generateMission` schließt followupSeed aus dem neuen Charterpfad aus. `mission-followup.js` erzeugt apt_charter_pickup und baut dessen PipelineContext aus dem bisherigen Narrative Memory; mehrere Fallbacktexte setzen Termin, Notizen und GA-Treffpunkt voraus. Das passt nicht zuverlässig zu frei entwickelten Kundenanlässen.

Grundlage: Mission Narrative Quality Guide, Abschnitt 7, sowie Mission Runtime Authority Contract. Die neue Erzählung soll den vorhandenen Ablauf verwenden, ihn nicht ersetzen:

- Nach erfolgreichem Abschluss einen kompakten unveränderlichen Ursprung sichern: charterIdea, Sprecher, gesamte Gruppe, Gepäck, tatsächliche Abschlussreferenz, ursprünglicher Anlass und geplanter Aufenthalt. Variationshistory ist keine Fortsetzungs-Memory.
- Rückreise-Eignung und zeitlicher Rahmen aus dem Kundenauftrag ableiten; nicht jedem Charter automatisch eine passende Rückholung unterstellen. Bestehende Requests müssen rückwärtskompatibel bleiben.
- Erst beim Folgeangebot/Annehmen einen strukturierten Fortsetzungsentwurf erstellen: plausibel fiktiver Aufenthalt, aktueller Rückreisegrund, nächster Schritt. Fiktive Erlebnisse getrennt von beobachteten Missionsergebnissen halten. Einmal akzeptiert bleibt dieser Entwurf über Geräte/Sitzungen stabil.
- Pilot vor Ort: direkter Rückflug mit derselben gebuchten Gruppe. Pilot an Basis/Drittplatz: leerer Anflug, Aufnahme am vereinbarten Flugplatz, Rückflug. Sprecher und seine optionalen Erzählungen erst nach tatsächlichem Boarding aktivieren.
- Aktuelle Route, Wetter und Flugzeugkapazität neu prüfen. Keine stille Gruppenverkleinerung. Neue optionale Erzählereignisse gehören zur Rückflugroute, nicht zur leeren Anflugstrecke; erledigte Hinflugereignisse nicht wiederverwenden.
- Tracker-Authority liefert das verbindliche Abschlussereignis. Folgeangebotserzeugung muss dessen stabile ID deduplizieren; die App darf nicht parallel aus DOM/Ankunft ein zweites Angebot erzeugen. Request, Fortsetzungsentwurf und Runtime-Fortschritt getrennt persistieren.

Vor Freigabe nötig: Tests für direkte Heimreise, Basis-/Drittplatz-Abholung, Gruppen-/Kapazitätswechsel, Legacy-Requests, Cloud-/Quota-Roundtrip, mehrfach zugestellten Abschluss und Voice erst nach Pickup. Die Umstellung soll Charter-spezifisch erfolgen; keine Änderung der globalen Follow-up-Klassifikation oder anderer Missionsfamilien.


## Variabilitätsprobe und Verfeinerung

Vier ursprüngliche Live-Durchgänge (`analysis/charter-four-live-20260922.json`) wiederholten Fachgutachter mit Ausrüstung und jeweils zwei Ereignissen. Charter-Prompts trennen jetzt kommerzielle Beförderung vom privaten oder beruflichen Reisegrund. Humor/Kuriosität sind erlaubt, ohne Beispielanlässe oder Quoten. History speichert zusätzlich Hintergrund, Gruppenbeziehung, Gepäck und Ereigniszahl. Der Charter-Zweig des Voice-Prompts benennt den Kunden als Sprecher; der Vereinszweig bleibt unverändert.

Die zweite Viererprobe (`analysis/charter-four-refined-20260922.json`) brachte Handwerksreise, Trauerfeier, Erbstück und Geburtstagsreise bei 2/3/1/2 PAX. Alle vier hatten jedoch genau eine Zusatzansage. Keine hinreichende Aussage über langfristige Verteilung. Wetterdaten waren nicht vorhanden; drei Wetterabsätze blieben ungültig. Eine API-Antwort hatte eine zusätzliche schließende JSON-Klammer, die nur im Probeparser entfernt wurde; dies ist kein Nachweis des Browser-Parsers. Die Probe wurde nach Unterbrechung aus gespeicherten Antworten fortgesetzt.

Nach dieser Probe wurde die Writer-Perspektive nochmals explizit auf außenstehende Disposition/ dritte Person geschärft und pathetische Lebensweisheiten sowie allgemeine Verstauhinweise als Stilvorgaben zurückgenommen. Diese letzte Prompt-Schärfung ist noch nicht erneut live geprüft. Weitere offene Qualitätsprüfung: Gepäck-vor/nach-Aufenthalt, gebundene Wetterprosa, natürliche Humorbreite und Ereignisvariation. Nicht veröffentlicht.

## Gemeinsamer Charter-Spielraum

Private, geschäftliche und VIP-geprägte Reisegründe bleiben im selben Strang. `travelCharacter` beschreibt die Reise frei (maximal 160 Zeichen), ohne Missionsklassifikation oder Runtime zu beeinflussen. Er wird mit der Idee und in der lokalen Variationshistory gespeichert; ältere Ideen ohne dieses Feld bleiben gültig. VIP ist weder eine feste Persönlichkeit noch automatisch Zeitdruck. Keine Themenbeispiele, Kategorienrotation oder Verteilungsquote.

Der direkte Ideenpfad darf einen ungültigen Entwurf einmal gezielt reparieren (Feldlängen, Kapazität, exakte Geo-Anker). Writer-Reparatur benennt zusätzlich die Textlängen. Weiterhin ungültige Ergebnisse werden abgelehnt, nicht durch neue lokale Storybausteine ersetzt.

Gemischte Liveprobe: `analysis/charter-mixed-four-20260922.json`. Zwei von vier Durchgängen akzeptiert (familiäre Versöhnung, beruflicher Neubeginn), zwei trotz Reparatur abgelehnt. Ein weiterer Entwurf behandelte einen diskreten Flug zur Werkseröffnung, scheiterte aber an Referenzen mit Werten statt Schlüsseln. Reparaturhinweis nennt deshalb jetzt explizit die tatsächlich erlaubten Referenzen. Diese letzte Korrektur ist noch nicht erneut live geprüft. Die Probe belegt größeren thematischen Spielraum, aber noch keine zuverlässige Generierung oder ausgewogene VIP-/Business-Verteilung. Kein Release.


## Zeitlicher Erzählstandpunkt

Nutzerreview der zwei weiteren Beispiele: Erzählerperspektive allein reicht nicht. Das Briefing bleibt vollständig vor dem Abflug. Bekannte Vorgeschichte, gegenwärtige Motivation und geplante Anschlüsse sind zulässig; konkrete Flugbeobachtungen, Gespräche und Gedankenfolgen bleiben späteren Voices vorbehalten. narrativeEvents sind kein Story-Inhaltsplan. Ankunft, Aufenthalt und spätere Rückreise werden zeitlich getrennt; der Writer erfindet keine Tagesgrenze für die Landung. Diese Vorgaben wurden im Charter-Writer präzisiert, ohne nachträgliche Prosa-Ersetzungen. Fröhliche und spielerische Anlässe sind ausdrücklich gleichwertig mit ernsten Geschichten, ohne Pflichtpointe oder Beispielvorgaben. Noch nicht live nachgeprüft oder veröffentlicht.

## Festgehaltener Erzählstand und Wetterprüfung

Der Nutzer akzeptiert den derzeitigen erzählerischen Stand als Arbeitsbasis. Referenz: `analysis/charter-two-temporal-20260922.json` (Hofübergabe und Weindegustation). Keine weitere Stiländerung daraus abgeleitet; Follow-ups weiterhin separat offen.

Codeprüfung: `generateMission` startet Start-/Ziel-Snapshots parallel und wartet per Promise.all auf beide, bevor MissionCharterBrowser.story aufgerufen wird. Wetter wird also nicht erst nach dem Writer angefordert. Spätere fetchRouteWeather-Aufrufe betreffen einen separaten Aktualisierungspfad und ersetzen den bereits geschriebenen Text nicht. Die Live-Textproben übergeben absichtlich weather:{}; sie testen keinen Wetterabruf.

Zwei weitere Grenzen: Snapshot-Abrufe haben 2200 ms Timeout pro Abrufversuch und können leer zurückkommen (ggf. auch nächstgelegene METAR-Station leer). Zudem reicht fetchMissionWeatherSnapshot derzeit nur Station, Roh-METAR, Wind, Sicht, Temperatur, Wettercode und Flugkategorie weiter. Strukturierte Böen, Wolkenschicht/-untergrenze und Beobachtungszeit fehlen, obwohl flightContext diese Felder lesen könnte. Das betrifft den gemeinsam verwendeten Snapshotpfad, nicht nur Charter. Zentralen Adapter nicht im Rahmen dieser Festschreibung geändert. Eine gezielte Erweiterung mit Regressionen für alle betroffenen Writer ist getrennt abzustimmen. Ungültige Writer-Referenzen sind zusätzlich unabhängig von Datenverfügbarkeit zu diagnostizieren.

## Wetterübergabe und unabhängige Reparatur umgesetzt

Start-/Zielabrufe bleiben parallel und werden vor dem Writer abgewartet. Der gemeinsame Snapshotadapter übernimmt nun Böen, strukturierte Wolkenschichten, niedrigste Schicht und getrennt BKN/OVC/VV-ceiling, Stationsentfernung, Beobachtungs- und Abrufzeit. Fehlende numerische Werte bleiben null (auch Wind/Temperatur), nicht irrtümlich null Wind. METAR-Zeit über 90 Minuten wird als stale markiert, fehlende Zeit als unknown; dies ist eine Briefing-Kennzeichnung, keine operative Gültigkeitsfreigabe. Cache weiterhin zehn Minuten; Aktualitätskennzeichnung wird beim Cachezugriff neu bestimmt. Keine unmarkierte Nutzung abgelaufener Cacheeinträge.

Snapshotabrufe nutzen vier Sekunden je Versuch und höchstens eine Wiederholung bei Netzwerkfehlern oder HTTP 5xx (200 ms Abstand). Erfolgreiche leere Antworten und HTTP 4xx einschließlich 429 werden nicht wiederholt. Die gemeinsame Abrufhilfe aktiviert dieses Verhalten nur über retryErrorsOnly; andere Aufrufer behalten ihr bisheriges Verhalten.

Charter repariert einen ungültigen Wetterabsatz in einem eigenen JSON-Aufruf. Die akzeptierte Story, Greeting und PilotNotes werden daraus niemals ersetzt. Auch bei Fehler der Wetterreparatur bleibt der Auftrag erhalten. Vollständig fehlende Wetterbeobachtungen erzeugen einen kurzen eindeutigen Hinweis ohne KI-Interpretation. Der Debug-Datensatz enthält den tatsächlich an den Writer übergebenen Wettersnapshot. Die ursprüngliche Pflicht zur Prosa-Prüfung bleibt bestehen.

Validierung: Wetteradapter-/Charter-/Private-V6-/Club-Regressionen inklusive alter/fehlender Zeit, Böen und unterschiedlicher Schichtbasis/ceiling, null Wind, Retry/Rate-Limit sowie unveränderter Story bei Wetterreparatur. Veröffentlichung und Live-Wetter-Hörtest nicht Bestandteil dieser Änderung.

## Alpha-Release 2026-09-22

Releasepaket: Charter-Ideen/Writer, Gruppen und optionale Reisegespräche einschließlich Persistenz und Tracker-Anbindung; Wetter-Snapshot und getrennte Wettertext-Reparatur. Auf aktuellem origin/main integriert, vorhandene Private-Return- und Speicher-Fixes bleiben erhalten. Tracker v439, Web-Cache v1836 (Kanalaktualisierung v1837). Die älteren Abschnitte mit „Kein Release“ beschreiben den damaligen Entwicklungsstand.

Releaseprüfung: 43 Charter/Wetter/Private/Club-Tests und 365 Missions-/Tracker-/Persistenztests bestanden, Syntax und Diff geprüft. Windows-EXE mit produktiver Build-Pipeline erstellt. Kein Windows-/MSFS-Hörtest; dieser bleibt für Alpha offen. Die Charter-Folgemissionen werden anschließend separat bearbeitet. Stable wird nicht umgeschaltet.

Builddetails: Der macOS-Host kann die x64-Bytecode-Fabricator-Runtime nicht starten (spawn -86). Daher wurde `npm run build:tracker -- --no-bytecode --public --public-packages '*'` verwendet. Windows-PE-x64 erfolgreich erzeugt. Zusätzlich derselbe pkg-/Node18-Stand als macOS-arm64-Paket geprüft: MISSION_PACKAGED_PROCESS_SMOKE_OK, Worker-Exit 0.

## Charter-Fortsetzungen V1 – Implementierung 22.09.2026

Neue Charterideen entscheiden ausdrücklich über `returnPlan`: `offered`, `reason`, bei gebuchter Rückreise zusätzlich `stayHours` und `stayText`. Es gibt keine Quote und keine Beispielhandlung im Prompt. Ältere Ideen ohne diesen Vertrag behalten den bisherigen Follow-up-Pfad.

`mission-charter-continuation-core.js` erzeugt `charter-continuation.v1` erst nach bestätigtem erfolgreichem Abschluss mit Flugnachweis, Ankunft am Ziel und Bodenstillstand. Die App und der Tracker verwenden denselben Request-Kern. Die Request-ID hängt stabil an der Hinflugmission; Rückreisen erzeugen keine weitere Rückreise. Die Wartezeit beginnt beim tatsächlichen Abschluss. Das Angebot bleibt danach 14 Tage verfügbar.

Der Request bewahrt ursprünglichen Auftrag, Sprecher, Gruppengröße, Gepäck, Ausgangs- und Aufenthaltsflugplatz sowie tatsächlich gehörte Gespräche. Bei Annahme wird ein freier fiktiver Aufenthalt mit Rückreisegrund und nächstem Schritt entworfen. Er wird **vor** dem Briefingwriter gespeichert. Wiederholungen nach einem Writerfehler verwenden denselben Aufenthalt. Ein neuerer Metadatenstand ohne Erlebnis darf dieses beim Cloud-Merge nicht entfernen; konkurrierende gespeicherte Entwürfe werden deterministisch auf den zuerst gespeicherten reduziert. Akzeptierte Requests bleiben als Tombstones erhalten.

Der Briefingwriter erzählt weiterhin aus Dispositions-/Erzählerperspektive vor dem neuen Abflug. Der Aufenthalt liegt zurück, der Pilot hat ihn nicht automatisch miterlebt. Nur die Bordstimme spricht als Kunde. Keine obligatorischen Termine, Mappen, Berichte oder Übergaben; neue Aufgaben sind kein Bestandteil der Fortsetzung. Die ursprüngliche Gruppe darf bei Kapazitätsproblemen nicht verkleinert werden – Annahme schlägt mit verständlicher Meldung fehl und das Angebot bleibt verfügbar.

Drei Startvarianten verwenden bestehende Ausführungsrezepte:

- Pilot am Aufenthaltsplatz B: besetzter APT-Rückflug B → ursprünglicher Ausgangsplatz A.
- Pilot am Ausgangsplatz A: Leerflug A → B, Gästeaufnahme, Rückflug B → A.
- Pilot am Drittplatz C: Leerflug C → B, Gästeaufnahme, Rückflug B → A. C ersetzt niemals das Kundenziel.

Gepäck bleibt passagiergebunden und wird nicht zur verpflichtenden Frachtaufgabe. Null Gepäck erzeugt kein Standardgepäck. Bei Abholung wird es zusammen mit den Gästen erst am Zielplatz geladen. Das Manifest bewahrt die vollständige Gruppengröße.

Bis zu drei optionale `narrativeEvents` gehören ausschließlich zum besetzten Rückflug. Prozenttrigger beziehen sich auf die tatsächlichen Routenpunkte ab B; Geo-Trigger verwenden nur belegte Anker. Ohne Gästeaufnahme/geladenes Passagiermanifest wird kein Ereignis beansprucht. Die vorhandene dauerhafte Claim-/Wiedergabehistorie bleibt zuständig. Briefing, Erlebnis und Ereignisse liegen im bestehenden kompaktierten und synchronisierten `charterIdea`-Vertrag.

Wetter wird bei Annahme erneut über die bestehende App-Datenquelle abgefragt. Bei Abholung bekommen Leerflug und besetzter Rückflug getrennte Wetterabsätze mit eigener Start-/Zielzuordnung; Datenlücken werden benannt. Die KI recherchiert keine operativen Wetterwerte. Ein fehlgeschlagener Wetterabsatz verändert die akzeptierte Geschichte nicht.

**Authority-Grenze:** Der direkte Rückflug verwendet die bestehende APT-Ausführung und deren Tracker-Voices. Die Zwischenlandung mit Pickup bleibt auf diesem Stand App-authoritativ; der Umbau schaltet keine noch nicht migrierte Tracker-Pickup-Ausführung frei. Das Tracker-Follow-up-Modul wurde erweitert und benötigt vor Veröffentlichung einen neuen Tracker-Build samt Release-Asset. Diese Implementierung ist noch nicht veröffentlicht.

Gezielte Tests: `node --test tools/mission-charter-continuation.test.cjs tools/mission-charter-ideas.test.cjs tools/mission-route-voice.test.cjs ga-tracker-client/tracker-mission-followup.test.js`. Abgedeckt sind Abschlussnachweis, Startvarianten, Gruppe/Gepäck, Retry/Cloud/Neustart, Kapazitätsabweisung und Trennung der Voice-Flugabschnitte. Ein echter MSFS-/Hörtest bleibt erforderlich.


### Abgestimmter Erzählstil für Fortsetzungen – 23.09.2026

Die besprochene Hin-/Rückflug-Kombination bestätigt die gewünschte Qualität, ist aber **kein Prompt-Beispiel und kein neuer Seed**. Personen, Gegenstände und Handlung daraus werden nicht in die Generierung übernommen.

Der Erlebnisentwurf entwickelt aus dem ursprünglichen Kundenanliegen einen konkreten Aufenthalt und dessen Bedeutung für die Reisenden. Ein alltäglicher Verlauf reicht; Humor, Überraschung und Meinungsänderung sind Möglichkeiten, keine Pflichtbausteine. Das Rückflugbriefing verbindet kurzen Rückblick, aktuellen Stand und nächsten Schritt mit dem bevorstehenden Beförderungsauftrag. Es bleibt in Erzählerperspektive vor Abflug. Die Bordstimme darf anschließend persönliche Facetten vertiefen und an tatsächlich gehörte Gespräche anknüpfen. Die optionalen 0–3 Ereignisse sollen unterschiedliche Gedanken beitragen, ohne eine feste dramaturgische Reihenfolge oder Wiederholung des Briefings.

Diese Präzisierung gilt im Code gezielt für die neuen Charter-Fortsetzungen. Andere Missionsfamilien und ältere Follow-up-Verträge werden dadurch nicht umgestellt. Die bestehende Trennung von App-Pickup und Tracker-APT sowie der unveröffentlichte Stand bleiben bestehen.
