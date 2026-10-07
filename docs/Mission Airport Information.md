# Bush-Platzinformationen V1

Bush-Pilot am 07.10.2026 mit Tracker v489 / Web-Cache v1954 und FAA-Worker
veröffentlicht. Freigaben und Grenzen: [Alpha-Rollout](Tracker-v489-Release.md).

## Umfang und Datenfluss

Nur KI-gestützte Bush-Flüge zu benannten Flugplätzen: `airportInfoContext`
steht vor dem V4-Planner bereit, wird in den V4-Contract übernommen und erreicht
den bestehenden V4-/V5-Writer und den älteren Bush-Ausweichwriter. Such-/Recon-Gebiete und normale APT/POI-Flüge
bleiben außerhalb dieses Piloten. Gemeinsamer Wetterkontext läuft parallel;
es gibt keinen zusätzlichen KI-Aufruf zur Zusammenfassung der Platzinformationen.

Eigene Stammdaten haben Vorrang. Fehlende Runways werden anhand gleicher
Kennung/Source-ID und naher Koordinaten aus dem bestehenden Hosted-Aviation-
Provider ergänzt. Keine OSM-Pistensuche und kein zusätzlicher Wald-Dienst.
Der vorhandene Terrarium-Sampler kann parallel eine Umgebungshöhe im Radius
von 1 NM liefern; vorhandene Terrain-Envelopes werden direkt übernommen.
Ein Maximum beweist keine Tallage und fehlende Waldpolygone keine Waldlosigkeit.

Wikipedia DE und EN werden parallel abgefragt; ein passender deutscher Artikel
hat Vorrang. Koordinaten, Platzname/Kennung und Flugplatz-Artikeltyp müssen
zusammenpassen. Namensgleiche Heliports und Disambiguierungsseiten werden nicht
als Platzartikel übernommen. Die Geosuche erhält Einleitungstexte (maximal 1200 Zeichen je Treffer); anschließend wird nur der identifizierte Artikel vollständig abgefragt. Beide Stufen teilen das Drei-Sekunden-Budget; bei Timeout bleibt eine bereits identifizierte Einleitung erhalten. API-seitig können Sammelabfragen nur einen vollständigen Artikel liefern. Artikel sind auf 7000 Zeichen begrenzt und behalten
Titel, Link und Revision. Für US-Plätze kommt FAA Airport Display hinzu:
Kennung, Koordinaten, Datenzyklus, betriebliche Angaben, Funk, Pistenabschnitte und
Remarks. Der Parser wertet ausschließlich diese Bereiche aus; insbesondere
versteckte Baustellen-Platzhalter sind keine Meldung. Nicht aktuelle FAA-Zyklen
werden verworfen. Verfahren je Pistenende behalten ihre Zuordnung.

Vorbereitete, belegte Hinweise aus FAA/NZ-CAA/NTSB-Handbüchern geben allgemeine
fliegerische Orientierung. Das Modell entscheidet, was zur belegten Lage passt;
kein vollständiger Tipps-Katalog pro Briefing und keine erfundenen lokalen Regeln.
Ohne geeignete Druck-/Temperaturdaten keine numerische Dichtehöhe.

## Ausgabe, Speicherung und Oberfläche

Das bestehende Writer-JSON enthält optional:

```json
{"airportInformation":{"flightBriefing":"…","destinationInfo":"…","sourceIds":["wikipedia","faa"]}}
```

Der Hauptzettel erhält einen eigenen Abschnitt „Zielplatz und Flugbedingungen“;
die Zielseite den sachlichen Platztext mit belegten Pilotennotizen, Umgebung
und Geschichte. Persönliche Missionsstory bleibt im Briefing und in den Voices;
auf der Zielseite höchstens ein kurzer, fliegerisch nützlicher Auftragsbezug.
Ein kurzer Ankunftshinweis wird beim Rendern aus dem aktuellen Ankunftsplan
ergänzt: Empfangskontakt, tatsächlich geplantes Fahrzeug und ein benannter,
aufgelöster Treffpunkt. Keine erfundenen Farben oder Hangarpositionen.
Dieser Zusatz wird nach Composer-Annahme und beim Restore erneut aus dem Plan
gebildet, ohne zusätzlichen KI-Aufruf und ohne Umschreiben des erzeugten Textes. Die Ausgabe wird strukturell und auf
zulässige Quellen-IDs geprüft, ohne Prosa-Regex oder nachträgliche Umschreibung.
Bei fehlender/ungültiger Zusatz-Ausgabe erscheint eine Faktenzusammenfassung
der eigenen Daten. Fehlende Informationen werden nicht erfunden.

Kontext und Texte werden mit der Mission gespeichert, einschließlich der
beiden Quota-Compact-Pfade. Quellenlinks und Absätze werden bei Restore erneut
gerendert. Der Zielkoordinaten-Abgleich verhindert, dass beim Rückflug noch die
Beschreibung des abgeholten Bush-Platzes erscheint. Die bestehende Wiki-Abfrage
darf den neuen Zieltext nicht nachträglich überschreiben. Ausgabe als Text,
nicht als ausführbares HTML. Der zusätzliche Cache überlebt normale SW-Updates.

## Drei-Sekunden-Budget und Cache

Alle Zusatzquellen teilen sich ein hartes Budget von 3000 ms einschließlich
Antwortkörper und Cache-Lesen. Bereits eingetroffene Teilantworten bleiben
erhalten; spätere Antworten verändern den zurückgegebenen Kontext nicht.
Timeouts, 429, Parserfehler oder fehlende Artikel brechen keine Mission ab.
Das ist die Dauer des Platzkontextes, nicht der gesamten Generierung oder des
separaten Wettermoduls. Das Wettermodul und Platzkontext starten gleichzeitig.

Maximal 16 Wikipedia-/FAA-Cache-Einträge in RAM und CacheStorage: Wikipedia
7 Tage, FAA 12 Stunden und nur bis Ende seines Datenzyklus. Erfolgreiche negative
Wiki-Suchen werden ebenfalls gecacht; Fehler nicht als „kein Artikel“ behandelt.
Bei 429/503 gilt `Retry-After` quellenweit, ohne Header 60 Sekunden Pause.
Vorhandene Cache-Daten bleiben während dieser Pause nutzbar. Wikipedia erhält
eine aussagekräftige `Api-User-Agent`-Kennung mit Projektlink.

## Nachweise

- `node --test tools/airport-information.test.cjs tools/cloudflare-worker/airport-context-faa.test.mjs`
- `GA_BROWSER_CHANNEL=chrome node --test tools/airport-information-browser.test.cjs`
- `node --test tools/mission-environment.test.cjs tools/bush-narrative.test.cjs`
- `npm test` in `tools/cloudflare-worker`
- Öffentlicher Opt-in-Live-Test: `node tools/airport-information-live-probe.mjs`

Messungen in `analysis/bush-live-20261007/airport-information/`:
U60, 3U2, U87, S81, EDTW, EDTO, EDSH und ESSA. Ein früher Burst-Test ohne korrekte
Client-Kennung zeigte Wikipedia-429 und führte zur Ergänzung von Kennung und
Abrufpause. Der anschließende Live-Test lieferte an allen acht Orten Zusatzfakten
und eigene Pistendaten: kalt 451–1403 ms; warm sieben Orte 6–9 ms, S81 313 ms.
S81 hatte zunächst eine verworfene FAA-Antwort mit falscher Kennung; Wiki/eigene
Daten blieben nutzbar, erst beim Folgeabruf kam passende FAA-Information hinzu.
Schnelle Fehlerantworten zählen nicht als erfolgreiche Datenlieferung.

Zusätzlich frischer Chrome mit realem CORS-Zugriff und unverändertem
Terrarium-Sampler: U60 kalt 1087 ms / warm 10 ms; EDSH 1265 ms / 12 ms.
U60: 5767 ft Zentrum und 8328 ft Maximum bei 1 NM. Eigene Platzhöhe bleibt
5743 ft. FAA wurde über den lokalen neuen Handler geprüft; dies ist noch kein
Nachweis für das veröffentlichte Cloudflare-Deployment. Live-KI-Proben sind inzwischen durchgeführt (siehe unten); keine TTS- oder Simulator-Probe für diese Text-Erweiterung.

## Vorgemerkt

Startseite, alle Missionsfamilien und deren Folge-/Rückflüge erhalten den
gemeinsamen Kontext erst nach Bewertung dieses Bush-Piloten. Ebenso ist die
globale Freischaltung des Wetter-/Jahreszeiten-/Prognosebausteins vorgemerkt.
SkyVector, weitere nationale AIP-Adapter, NASR-Bulk-Import und Big-Creek-SOP
sind nicht automatisch angebunden. Kein serielles Quellen-Crawling im Dispatch.

## Live-Writer-Proben am 07.10.2026

KMYL, U60, EDTW, EDTO und ESNC (Hedlanda): fiktive handgebaute Ready-Contracts, echter V5-Promptbuilder, gemeinsames reales Wetter-/Platzmodul und Gemini 3 Flash Preview. Kein kompletter Planner-/Dispatch-Test. Daten und unveränderte Ausgaben: `analysis/bush-live-20261007/airport-information/writer-*.json`, Lesefassung mit Bewertung: `writer-examples.md`.

Die Probe deckte eine fehlende Übermittlung des vollständigen Platzkontextes im V5-Request sowie fehlende Artikeltexte bei der Geo-Sammelabfrage auf. Beide sind im lokalen Piloten korrigiert und getestet. Der Writer bekommt konkrete zulässige Quellen-IDs und die verschachtelte Ausgabeform. Er soll Quellenbelege vor den Texten auswählen (`usedFacts` im Roh-JSON); diese Hilfsangabe ist kein Faktenvalidator und wird nicht als Nutzertext gerendert.

Letzte Runde: 5/5 neue Textobjekte strukturell akzeptiert, 11,1–15,1 s pro KI-Aufruf. Ein früherer ESNC-Aufruf überschritt 16 s. Letzter frischer Quellenlauf: 485–1825 ms; keine Abfrage überschritt das Budget, ESNC ohne passenden DE/EN-Artikel. 24 Modul-/FAA-Tests und ein Chrome-UI-Test bestanden.

**Inhaltlich noch keine Release-Freigabe:** Trotz besserer Quellen bleiben Ausschmückungen und unzulässige Schlussfolgerungen, besonders bei schwach belegter Umgebung (ESNC), Leistungszusagen und Einzelheiten zu KMYL. Frühere Proben zeigten eine umgekehrte FAA-Parkregel und einen unbelegten Kontrollvorbeiflug. Syntaktisch akzeptierte Texte sind keine geprüften Flugverfahren. Keine nachträglichen Prosa-Regex-Korrekturen eingesetzt. Die zentralen Flugplatz-Stammdaten wurden nicht verändert.

## Nachprüfung des Bush-Ausweichpfades – 07.10.2026

Der Legacy-Bush-Writer erhält den bereits geladenen vollständigen Platzkontext
und kann dasselbe verschachtelte Textobjekt erzeugen. Seine Ausgabe wird mit
`attach()` wie beim V4/V5-Writer übernommen; bei fehlender Zusatz-Ausgabe bleibt
der Fakten-Fallback. Normale APT-/POI-Legacy-Aufrufe erhalten diese Ergänzung
nicht. Kein zusätzlicher KI- oder Datenabruf.

Audit 2026-10-07: Der Bush-Baustein übernimmt nun alle bekannten `surface.mainComposite`-Codes (inklusive Asphalt = 0) aus dem [offiziellen OpenAIP-Flugplatzschema](https://api.core.openaip.net/api/schemas/response/airport/airport-schema.json). Explizite Textbezeichnungen haben Vorrang; unbekannte, fehlende und ungültige Codes bleiben unbekannt. Keine Änderung an der gemeinsamen Flugplatzklassifikation.

## Quellenredaktion nach der Nachprüfung

Die Quellenrollen sind nun als `writingBasis` getrennt: eigene Platzwerte,
örtliche Quellen, Höhenstichprobe, allgemeine Handbuchhinweise mit
Anwendungsvoraussetzungen und unbekannte aktuelle Bedingungen. Kreative
Freiheit betrifft Geschichte und Begrüßung; belegte Platzinformationen entstehen
aus einer vorgelagerten Faktenauswahl. Keine nachträgliche Prosa-Korrektur.

Der erste erneute Ein-Aufruf-Test lieferte dennoch unbelegte Geländeangaben.
Deshalb ist eine eigene sachliche Redaktion lokal als `informationPrompt()`
und opt-in `MissionAirportInformationBrowser.generate()` vorbereitet. Sie
bekommt ausschließlich Platzquellen und optional datierten Wetterkontext,
keine Person, Missionsstory oder erfundene Anlagen. Die App ruft diese neue
API nicht auf: Der A/B-Test und die anschließende Entscheidung belassen
die Platzredaktion beim gemeinsamen Writer-Aufruf. Geplantes Budget: 14 s gesamt, parallel zur Story; bei Ausfall
der vorhandene Daten-Fallback. Späte Antworten verändern das Ergebnis nicht.
Das ist kein bereits aktivierter Produktionspfad und kein Release.


## Gemeinsamen Writer weiter verbessert – 07.10.2026

Nach dem A/B-Test bleibt die Platzredaktion im bestehenden Aufruf. Der Prompt
übermittelt den Quelleninhalt einmal und einen eigenen Faktenentwurf aus
Pisten-/Höhendaten. `writerContext()` erhält alle örtlichen Quellen unverändert;
für diese sachliche Redaktion werden nur allgemeine Hinweise zur bekannten
Platzhöhe oder Oberfläche angeboten. Der vollständige Katalog bleibt im
ursprünglichen Kontext/Planner; keine zentrale Gelände-Klassifikation und
keine nachträgliche Prosa-Korrektur. Die Schema-/Quellen-ID-Prüfung bleibt gleich.
Eigentümer, Betreiber und Instandhaltung sind im Prompt unterschiedliche Rollen.
Texte bleiben frei formuliert; kürzere Texte und einmalige Hinweise sind erwünscht.

Vier neue kombinierte Textproben kamen in 9,5–13,5 s zurück. Unbelegte lokale
Tal-/Gebirgsanweisungen verschwanden aus den vier Briefings, aber
Leistungszusagen, die eingeschränkte Stationsbezeichnung und Einzelheiten
zum Wetter/Betriebsstatus sind noch nicht zuverlässig. Keine Release-Freigabe.
200 Regressionen bestanden. Unveränderte Rohtexte und Bewertung:
`analysis/bush-live-20261007/quality-refinement-20261007/single-call-refined/`.


## U60-Dispatch-Korrektur vom 07.10.2026 (lokal, noch nicht ausgerollt)

Der Dispatch darf die Platzredaktion nicht von `airportDisplayIdent` abhängig
machen: Ein wiederverwendeter U60-Datensatz kann seine Kennung weiterhin im Feld
`icao` tragen, obwohl eine separate FAA-/Local-Aliasangabe fehlt und die bisherige
Anzeige „OHNE ICAO“ liefert. Die Bush-Aktivierung prüft jetzt Kennungen und
Koordinaten mit dem vorhandenen Platzinformations-Kern. Normale APT-/POI-Flüge,
Recon-Gebiete und Offline-Generierung bleiben außerhalb dieses Piloten. Die
zentrale Kennungs-/Stammdatenverarbeitung wurde nicht geändert.

Weitere Ursachen der unvollständigen Bush-Erzählung: Der V4-Draft trägt den
Missionsmodus in `mode`, nicht in `missionType`. Der Planner bekam daher die
Bush-Persönlichkeitsanweisung nicht. Der V5-Ausgabeadapter ließ zudem das bereits
geplante `bushSpec` weg; Charter, Adventure und Recon erreichten damit die
zusätzliche Kapitelgenerierung nicht. Beide Verbindungen sind korrigiert. Ein
Bush-Greeting bleibt als freier Writer-Text erhalten; alte subjekt-/ergebnisbasierte
Satzschablonen ersetzen es nicht mehr. Ohne Greeting gibt es eine neutrale kurze
Begrüßung. Andere Missionsfamilien behalten ihren bisherigen Greeting-Pfad.

Nachweise: `tools/airport-information.test.cjs` und
`tools/bush-dispatch-wiring-browser.test.cjs`. Der Browser-Test verbindet echte
App-Funktionen für gespeichertes U60, Draft/Prompt, Contract, V5-Adapter,
Kapitelgenerator und Ziel-/Briefinganzeige mit fiktiven Quellen-/KI-Antworten. Er
prüft außerdem die sechs Bush-Rezepte sowie Cargo-only und unveränderte
APT-Begrüßung. Das ist kein vollständiger Live-KI-Dispatch oder Simulatorflug.
Der Diagnosebericht zeigt nun Bausteinverfügbarkeit, Quellenstatus, Textlängen,
Wetterkontext und Kapitelstatus/-anzahl.

Der neue Flughinweis-Abschnitt verwendet jetzt dieselbe Schrift, Farbe,
Schriftstärke und Zeilenhöhe wie der Story-Block. Überschrift und Quellenangaben
sind auf dem Papier ebenfalls lesbar. Der Browser-Test vergleicht die
berechnete Textformatierung in allen fünf Themes; die mobile Darstellung
wird zusätzlich als Screenshot kontrolliert.
