# Bush-Erzählung und Ortsgeschichten

Stand: 07.10.2026 – lokale Erweiterung, kein Release.

## Erzählvertrag

Eine individuelle Person trägt die Geschichte. Abenteuer, Spannung, herzlicher
rauher Ton und gelegentliche Übertreibung sind erlaubt. Der Ton entsteht aus
der Person; Land und Beruf legen keine feste Sprechweise fest. Reale Geographie,
Infrastruktur und Wetter bleiben belegte Daten. Erinnerungen und Zwischenfälle
sind fiktive Geschichten und erzeugen keine neuen Aufgaben oder Erfolgskriterien.

Sagen und phantasievolle Ortsgeschichten sind ausdrücklich erlaubt. Eine belegte
Überlieferung darf als solche erzählt werden, wenn die gelieferten Daten eine
Quelle enthalten. Ohne Beleg erzählt der Pax sie als persönlich gehörte,
unbestätigte Geschichte: „Ein Kommilitone hat mir erzählt … keine Ahnung, ob da
etwas dran ist“. Quellen werden nicht erfunden. Der Hinweis ist für Sagen,
Gerüchte und außergewöhnliche Behauptungen nötig, nicht für jede gewöhnliche
persönliche Anekdote. Tatsächliche Geographie und Anlagen bleiben datenbasiert.
Diese Stufe recherchiert selbst noch keine Sagenquellen.

Feste Texte behaupten weder aktuelles Wetter noch Flugzeugzustände oder
Ankunftsnähe. Auch die letzte geplante Ansage bleibt unabhängig vom tatsächlichen
Anflug. Technische Details einer Campingpanne sind ohne belastbare Grundlage
kein Teil einer Anleitung; die Geschichte erzählt das Missgeschick und seine
Folgen. Die Grenzen stehen im Generierungsprompt; generierte Texte werden nicht
nachträglich durch neue sprachliche Regex-Filter umgeschrieben.

Der Plan `bush-narrative.v1` ergänzt die vorhandenen Bush-Abläufe. Er liegt als
`bushNarrative` in den Missionsdaten, bleibt im kompakten Persistenzpfad erhalten
und gehört damit auch zum gespeicherten Missionsstand. Eine lokale History hält
bis zu zwölf Zusammenfassungen samt kompakten Kapitel-Merkzetteln; das
24-KiB-Budget kann die Zahl weiter reduzieren. Sie ist nicht geräteübergreifend synchron.

## Zwei unabhängige Arten von Voice-Momenten

- Zwei bis sechs feste Geschichten werden nach tatsächlicher Flugzeit des
  relevanten Abschnitts ausgelöst, unabhängig von Ortskontakt.
- Zusätzlich sind bis zu sechs Ortsgeschichten möglich. Die KI wählt aus
  belegten benannten POIs entlang der Route; sie liefert keine Koordinaten.
- Radius: 0,5 bis 2 NM. Orte müssen mit ihrer Projektion zwischen Start und Ziel
  liegen und höchstens 1,8 NM von der direkten Route entfernt sein. Pro Anker
  gilt ein Mindest-Radius aus Seitenabstand plus 0,15 NM Reserve. Damit
  schneidet ein Direktflug den Kreis; Cooldown und tatsächliche Route können
  weiterhin einzelne Ansagen verhindern. Sphärische Geometrie berücksichtigt
  hohe Breiten und die Datumsgrenze.
- Zwischen Ansagen liegen mindestens 90 Sekunden. Ein naher Geo-Moment hat
  Vorrang vor einer ebenfalls fälligen festen Geschichte.
- Verpasste Geo-Momente werden nicht nachgeholt. Spätere Texte dürfen sie nicht
  voraussetzen. Kurze Flüge müssen nicht alle geplanten Geschichten abspielen.

Die Geo-Suche ist begrenzt auf fünf entlang der Strecke verteilte POI-Tiles.
Alle fünf teilen ein Wartebudget von drei Sekunden; eingetroffene Teilantworten
bleiben nutzbar. Späte Antworten ändern den Kapitelplan nicht. Das ist keine
vollständige Abdeckung eines langen Flugwegs. Ohne POI-Daten sind
weiterhin feste Geschichten möglich. Region und Land werden ausschließlich aus
vorhandenen Flugplatzangaben übernommen; fehlende Angaben bleiben unbekannt.

## Sprecher und Voice-Ablauf

Ein Pickup-Gast spricht erst nach Aufnahme auf dem Rückflug. Ohne benannten
Passagier entsteht kein zusätzlicher Bord-Erzählplan. Cargo-only erhält dadurch
keinen erfundenen Mitflieger. Die bestehenden Cargo-/Dispatch-Ansagen bleiben.

Texte entstehen vor dem Flug in einem zusätzlichen KI-Request. Zur Laufzeit
lesen wir den vorbereiteten Text direkt: kein weiterer Textgenerierungsrequest.
Die vorhandene TTS-Vorbereitung lädt den nächsten festen sowie höchstens einen
nahen Geo-Moment vor. Audio ist best effort; ein API-Ausfall darf die Mission
nicht blockieren. Die Warteschlange verwirft Momente bei Missionsende oder
Sprecherwechsel und Geo-Momente zusätzlich beim Verlassen des Radius.

## Authority und Freigabestand

`mission-bush-narrative-core.js` ist frameworkfrei. Bei Web-Authority beobachtet
der Browser; bei Tracker-Authority übernimmt der Tracker. Claims, Flugzeit und
präsentierte Kapitel gehören zum persistenten Runtime-Snapshot. Die sechs
bestehenden Bush-Rezepte bleiben bindend. `mission.bush-narrative.v1` verhindert
die Übergabe neuer Kapitel an ältere Tracker ohne diese Fähigkeit.

Lokal integriert und automatisiert geprüft; Tracker-Teststand v488. Noch nicht
veröffentlicht und nicht im echten Windows-/SimConnect-/Audioflug abgenommen.
Weitere Nachweise und die historischen Zwischenschritte stehen unten.

## Prüfung

`node --test tools/bush-narrative.test.cjs`

Geprüft werden gemischte feste/Geo-Pläne, fehlende Tiles, bekannte Koordinaten,
Korridor, Pickup-Rückflug, Sprecher-/Boarding-Gates, Pause/Slew, Telemetrielücken,
Cooldown, Wiederaufnahme, History und die tatsächliche Browser-Telemetriebrücke.
Keine Live-KI-, TTS- oder MSFS-Probe ist damit belegt.

Zwei Szenarien wurden am 07.10.2026 live mit Gemini erzeugt und nach der ersten
Prompt-Präzisierung wiederholt; Berichte unter `analysis/bush-live-20261007/`.
Die danach ergänzte Sagen-Einordnung und die weiteren Prompt-Präzisierungen
sind lokal umgesetzt. Eine gezielte Live-Probe der schwedischen Studentin mit
explizit gewünschter erfundener Sage lieferte danach sechs feste und drei Geo-
Ansagen; die Sage war persönlich gehört und hörbar unbestätigt eingeordnet.
Keine vorweggenommene Ankunft oder falsche Brennstoffempfehlung in dieser Probe.
Einzelne stilistische Übertreibungen bleiben; Audio und Tracker nicht geprüft.

## Kontinuitätsprüfung bis Farewell (07.10.2026)

Präsentierte feste und Geo-Kapitel werden nach der Anzeige im PAX-Fenster in
`bushNarrativeVoice.spoken` gespeichert (maximal zwölf), zusammen mit dem
bestehenden Runtime-Snapshot. Der Sprecher muss zum Plan passen. Der Voice-
Basiskontext erhält die letzten sechs präsentierten Kapitel für Landing und
Farewell; ungespielte Geo-Kapitel fehlen bewusst. Eine Sage bleibt unbestätigt.
Dies belegt Textpräsentation, nicht erfolgreichen Audio-Output. Eine alte feste
McCall-Anflugvorgabe wurde durch den tatsächlichen Rückkehrplatz ersetzt.

15 lokale Tests einschließlich aller 28 Events aus den drei gespeicherten
Live-Plänen bestanden: bei passenden Geo-Positionen, genügend Flugzeit und
freier Voice sind alle einmal erreichbar. Auf idealisierten Direktflügen mit
fünfsekündlichen Samples und ohne Audio-Belegung wurden alle festen Kapitel
ausgelöst. Idaho: 8/9 Events, ein Geo-Moment verpasst; ältere Schweden-Probe:
9/10, ein Geo-Moment verpasst; aktuelle Sagen-Probe: 9/9. Verpasste Geo-Momente
sind durch Radius und Cooldown möglich und werden nicht nachgeholt.
Ground-Flow-Selbsttest ebenfalls bestanden.

Eine kurze Route, langsame Text-/Audioverarbeitung oder eine lange andere
Ansage kann auch feste Kapitel bis nach der Landung verzögern; sie sind keine
Pflichtziele. Claims sind weiterhin best effort: ein nach dem Claim verworfener
oder fehlgeschlagener Text-/Audioauftrag wird nicht automatisch wiederholt.
Farewell hat Vorrang und beendet weitere Geschichten. Kein realer Simulator-,
Audio- oder Tracker-/EFB-Durchlauf wurde durch diese Prüfung ersetzt.

## Anekdoten-History und Größenbudget (07.10.2026)

Jedes neue Event erhält vom Writer `memory` (bis 140 Zeichen), das Anlass,
Handlung und Pointe beschreibt. Ältere Events ohne dieses Feld bleiben gültig;
bei ihnen dient ein begrenzter Textanfang als Übergang. Die Generation soll
inhaltliche Wiederholungen vermeiden, nicht nur Namen oder Orte austauschen.
Das ist eine Prompt-Vorgabe, keine semantische Garantie oder Regex-Korrektur.

History: maximal zwölf Missionen und 24 KiB UTF-16 für den serialisierten Wert;
Felder werden auf Lesen und Schreiben normalisiert. History im Prompt: maximal
6.000 Zeichen, nur neueste passende ganze Einträge. Keine vollständigen Voices,
Audio-Daten oder Geo-Geometrien in dieser History. Die Merkzettel erinnern an
geplante Kapitel, auch wenn ein optionaler Geo-Moment später verpasst wurde;
Farewell-Kontinuität verwendet separat nur präsentierte Kapitel.

Belastungstest mit zwölf Kopien der gespeicherten 9-Event-Sagen-Probe (ältere
Textanfänge statt neu generierter Merkzettel): sechs History-Einträge bleiben,
23.694 Bytes UTF-16 lokal / 11.955 Bytes UTF-8. Prompt-Projektion: drei neueste
Einträge, 5.925 Zeichen / 5.979 Bytes UTF-8. 16 Tests bestanden. Neue Writer-
Merkzettel wurden noch nicht erneut live generiert.

Read-only Inventar des primären Worktrees: private-outing 64 KiB, private-
episode 32 KiB, Club 24 KiB, Charter 12.000 Zeichen, POI-Foto/APT 12.000 Zeichen,
Bush neu 24 KiB. Zusammen maximal etwa 192 KiB UTF-16 für diese sechs bounded
Erzähl-Histories. Die privaten Writer können Legacy und neue Memory gemeinsam
projizieren; einzelne Requests können History mehrfach in ihre Frames einbetten.
Weitere Variety-/Ziel-/Ortsbucket-Histories sind damit nicht global begrenzt.
Die Summe ist kein Messwert des Nutzer-Browsers und nicht aller localStorage-Keys.

Im geprüften Cloud-Sync-Payload gibt es keine Sammlung dieser History-Keys;
sie erhöhen derzeit nicht als Historienarchiv den Worker-KV. Die aktive Mission,
ihre Story-Pläne und Runtime-Präsentation bleiben Bestandteil des üblichen
Cloud-Payloads; die neuen kleinen Event-Merkzettel können dort mit enthalten sein.
Ein globales Storage-/Promptbudget oder Cloud-Sync aller Stränge wäre eine
separate übergreifende Änderung, nicht Teil dieser Bush-Erweiterung.


## Tracker-Integration und Build-Kandidat – 07.10.2026

Die zuvor offene Migration ist auf aktuellem Alpha 5ab9d3197 umgesetzt. Der
kanonische Plan geht im bestehenden Approach-Kontext an Tracker v487;
`mission.bush-narrative.v1` verhindert eine Übergabe an ältere Tracker. Die
bereits migrierten Strip-, Pickup- und Recon-Rezepte bleiben erhalten.

Kapitel benötigen aktive Mission, den passenden Flugabschnitt, bestätigten
Einstieg und denselben Sprecher. Bei Passenger-Pickup beginnt der zusätzliche
Plan erst nach der bestehenden Departure-Einweisung auf dem Rückflug. Pausen,
Menüs und Slew liefern keine Erzählflugzeit; während belegter Voice werden
Kapitel verschoben. Geo-Kapitel werden vor Wiedergabe nochmals gegen aktuelle
Position, Flugzustand und Missionsphase geprüft, auch nach langsamer TTS.
Feste Kapitel und der nächste nahe Geo-Punkt können als Audio vorgewärmt werden,
ohne Trigger oder Wiedergabe zu beanspruchen. Cache-Restore erhält den Jobtyp.

Alle Missions-Voices teilen eine serielle Lane und den bestehenden zentralen
Voice-Service; dessen globale Playback-Lease verhindert auch parallele Ausgabe
auf Web/EFB-Geräten. Navigation verwendet weiterhin die vorhandene Audio-
Priorisierung. Erfolgreich abgespielte Kapitel landen bounded im autoritativen
Snapshot und ergänzen Farewell; bloß erzeugte oder verworfene Kapitel nicht.
Claims bleiben best effort; abgebrochene Kapitel werden nicht automatisch
wiederholt. Stories sind keine zusätzlichen Missionserfolgskriterien.

Windows-Tracker v487 ist lokal mit pkg für node18-win-x64 gebaut (ohne Bytecode,
da der Mac den Intel-Fabricator nicht ausführen kann). Ein tatsächlich gepackter
macOS-Prozess durchlief den vorhandenen IPC/Authority-Smoke-Test. Das ersetzt
keinen Windows-/SimConnect-/In-Sim-Test. Native EFB-Preset-Erkennung ist separat
experimentell; offizieller SDK-/Paketbuild fehlt mangels lokalem MSFS-SDK.
Keine Veröffentlichung erfolgt.


### 07.10.2026 – persönlicher Anlass vor Briefing und Voices

Der Bush-Planner füllt die vorhandenen storyFrame-Felder mit konkretem Wunsch, persönlicher Vorgeschichte und Vorhaben am Boden. Beruf und Ausrüstung reichen als Motiv nicht aus. Writer und vorbereitete Routenkapitel entwickeln denselben Kern weiter; Nebenanekdoten bleiben möglich. Rauhe, herzliche Techniker und individuelle Fotoideen sind Beispiele, keine Pflichtrollen oder festen Storyvorlagen. Missionserfolg, Sprecherbesetzung und regionale Fakten bleiben an den Contract gebunden.


## SDK-/Integrationsnachweis

Lokaler Tracker-Teststand v488 mit SDK-geprüftem EFB-Paket 0.4.22: Menüwechsel,
Pause/Slew, Telemetrie-Fallback ohne EFB, gemeinsame Wetter-/Zeit-Cooldowns und
serielle Story-/Wetterwiedergabe automatisiert geprüft. Die native Quelle stimmt
mit der SDK-Rückgabe überein. Reale Preset-/SimConnect-/Audio-Abnahme und
Veröffentlichung bleiben offen; siehe analysis/bush-live-20261007/integration-result.md.

## Nachprüfung des Datenflusses – 07.10.2026

Der zusätzliche Kapitel-Writer erhält jetzt auch den bereits abgefragten
`airportInfoContext`, neben Story, Person, Region, Wetter und Korridorankern.
Es erfolgt kein neuer Quellenabruf. Bei Pickup beschreibt dieser Kontext den
Abholplatz; er wird nicht als Information zum Rückkehrplatz ausgegeben. Die
Kapitel bleiben optionale Erzählung, keine Flugverfahren oder Erfolgskriterien.

## Erzählperspektive vor der Generierung

Das Frame benennt nun ausdrücklich, welche Informationen ein Kapitel besitzt:
Zeitkapitel wissen keine Ankunftsphase, Geo-Kapitel bestätigen nur räumliche
Nähe. Die KI wählt vor jedem Text `narrativeBasis` (Erinnerung, hörbar
unbestätigte Geschichte, offener Zukunftswunsch oder Geo-Ortsansprache
`place_comment`); für reale Ortsaussagen
in Geo-Kapiteln ergänzt sie `localEvidence`. Diese Roh-JSON-Arbeitshilfen
werden nicht gesprochen, nicht als Faktenvalidator behandelt und nicht
in neue Runtime-Felder übernommen. Bestehende Pläne bleiben kompatibel.

Der letzte Zeitmoment bleibt eine Erinnerung oder ein noch offener Wunsch,
kein Fazit eines schon gelungenen Fluges. Persönliche Begebenheiten dürfen
fiktiv sein; die Geschichte liefert selbst keine Belege für Ortsdetails.
Trigger, Boarding, Cooldown, Authority und serialisierte Audiowiedergabe
bleiben unverändert.


Natürliches Ansprechen bekannter Geo-Orte ist erlaubt, etwa „Da unten liegt
der See“. Dafür wird keine zusätzliche Sichtprüfung eingeführt. Name,
Objektart und tatsächlich gelieferte Ortsdetails bleiben die Grundlage;
ein Sichtkontakt wird nicht pauschal als Fehler behandelt. Freie persönliche
Erinnerungen bleiben möglich. `place_comment` ist nur eine Erzählhilfe im
Writer-Roh-JSON; es entsteht weder ein neuer Runtime-Eventtyp noch ein neues
Trigger-/Authority-Feld. Radius, Boarding, Pause, Abschluss und Audio-Gates
bleiben gleich. Finale U60-Probe: 8 Kapitel, einzeln 8/8 erreichbar nach
Restore; ESNC-Kapitelprobe mit Timeout, daher dafür kein neuer Live-Nachweis.

## Bush-Quellenbindung, lokaler Kandidat 08.10.2026

Noch nicht ausgerollt. Gemeinsame `sourcePolicy` / `sourceBasis` in
mission-bush-narrative-core.js, ausschliesslich fuer Bush: reale Airport-/Geo-
Quellen, datierte Wetterdaten und ausdrueckliche Datenluecken getrennt von
Story, StoryFrame, History und bereits gesprochenen Kapiteln. Unbekannt ist
keine negative Beobachtung; Platzhoehe ist keine berechnete Dichtehoehe.
Live-Sim-Telemetrie darf als solche genutzt werden, Modellwetter bestaetigt
keine aktuelle Cockpitsicht. Persoenliche Erinnerungen, Beziehungen und
Vorhaben bleiben frei, Rollen, Route, Trigger und Erfolgsbedingungen gleich.

Angebunden: V3-/V4-Planner (inklusive Compact), V4-/V5- und Legacy-Writer,
Bush Scene Planner, Kapitel-Frame/-Prompt, Browser-Sprachgenerierung sowie
Tracker-Boarding-/Flight-/Farewell-Voice. Der Approach-Authority-Kontext
transportiert Bush sourceBasis; keine neue Zustandsmaschine. Kapitel-TTS gibt
vorbereitete Texte weiterhin unveraendert wieder. APT-/POI-Prompts erhalten
die Bush-Regel nicht; V4-Prompts beider Familien differentiell unveraendert.

Bush-Platzredaktion: Gibt es nur eigene technische Basisdaten und allgemeine
Handbuecher, werden Flugplatztexte aus den bekannten Daten ausgegeben statt
freie lokale KI-Prosa zu akzeptieren. Keine Behauptungen ueber unbekannte
Infrastruktur, Gebirgs-/Tallage, Bahneignung oder konkrete Dichtehoehe.
Leere FAA-Remarks gelten nicht als oertliche Prosa. Vorhandene echte lokale
Wikipedia-/FAA-Texte behalten ihren bisherigen Redaktionspfad. Dieser Pfad
ist damit noch kein semantischer Faktenvalidator fuer jede Aussage.

275 Tests erfolgreich. Neue gezielte Tests fuer fehlende/partielle Wetterdaten,
bekannte Nullwerte, Zeit/Ort/Einheiten, Story-Poisoning, getrennte Handbuecher,
Basisdatenanzeige, leere FAA-Metadaten und korrupte optionale Quellen.
Bestehende Boarding-/Farewell-/Cargo-/POI-/SAR-/Wettertests ebenfalls bestanden.
Kein neues Modell und keine zusaetzlichen KI-Aufrufe pro normaler Bush-Mission;
die neuen Quellenregeln/Datenprojektionen vergroessern allerdings die Eingaben.

### Live-Befund und verbleibende Grenze

Vier begrenzte API-Proben ueber die Produktionsfunktionen im Dry-run-VM:
23 Aufrufe, 23 HTTP 200; datierte Wetter-/Airport-Testfixtures, kein Wetter-
Liveabruf, Browser-/Windows-/MSFS-Flug oder Audio-Playback. Erste zwei Proben
prueften reine Prompt-Nachschaerfung, danach die eigene Basisdatenredaktion.
Alle vier Ketten technisch ready: Planner, Contract, V5-Writer, vier Bush-
Kapitel, Scene Planner ohne unerwuenschte Zielobjekte.

In den abschliessenden Proben bleiben Platztexte exakt bei Piste 01/19,
1082 m Laenge, 34 m Breite, Gras, 5743 ft MSL. Ohne Wetter wurde kein aktueller
Wetterzustand erfunden. Die semantische Freigabe ist trotzdem offen:

- Ein Kapitel ohne Wetter nennt eine nicht belegte Taloeffnung.
- Mit 75 % Bewoelkung als datiertem Modell-Testwert schreibt die KI weiterhin
  diffuses Licht heute, ohne das als Modellannahme einzuordnen; Voice
  uebernimmt dies als aktuelle Bedingung.
- Weitere freie Voice-Ortsbeschreibungen koennen unbelegt bleiben.

Daher keine Behauptung vollstaendig geloester Quellenbindung und kein Rollout.
Eine strengere Trennung/Pruefung realer Aussagen in freier Story und Voice ist
noch erforderlich. Keine nachtraegliche Regex-Liste eingebaut. Zusammenfassung
und manuelle Befunde: analysis/bush-source-binding-20261008/summary.json.
Vollstaendige lokale JSONs missing/weather/missing-final/weather-final bleiben
als Ad-hoc-Artefakte ausserhalb des Commits erhalten.


## Rollout-Freigabe des Nutzers, 08.10.2026

Der Nutzer hat die verbleibenden atmosphaerischen/erzaehlerischen
Ausschmueckungen akzeptiert und den Alpha-Rollout ausdruecklich freigegeben.
Die oben dokumentierten offenen Befunde beschreiben den vorherigen
Pruef-/Freigabestand; sie bleiben als Nachweis erhalten. Sachliche
Flugplatzangaben, Bahneignung, Verfahren und konkrete Dichtehoehe benoetigen
weiterhin passende Daten. Kein vollstaendiger Faktenvalidator fuer freie Prosa.

Release: Tracker v491 Alpha, Web-Cache v1961. Stable-/Beta-Kanaele unveraendert.
275 Regressionstests, vorhandene Live-API-Proben und gepackter
Tracker-Missionsprozess-Smoke-Test als technische Nachweise; kein
Windows-/MSFS-Flugtest. Asset vor Aktivierung des Alpha-Kanals verifizieren.

## Bush Charter: persönlicher Planner-Vertrag (08.10.2026)

`bush_charter_strip` erhält eigene Planner-Feldbeschreibungen in beiden
Promptvarianten und ein eigenes V5-Erzählrezept. Die bestehende technische
TaskDomain `charter` und das Rollenprofil bleiben erhalten. `subjectDetail`
enthält den fiktiven Gast und seinen Wunsch, `incidentContext` die persönliche
Verbindung, `whyNow` den Anlass und `soughtOutcome` das offene Vorhaben am Boden.
Die allgemeinen Befund-/Entscheidungshilfe-Feldbeschreibungen gelten hier nicht.
Name und Motiv sollen Briefing, Begrüßung und spätere Kapitel verbinden.
Absetzen und vereinbarte Übergabe schließen den Pilotauftrag ab; kein zusätzlicher
Rückflug oder Erfolg der Gastarbeit wird zugesagt. Keine zusätzlichen KI-Aufrufe,
keine Änderung anderer Bush-/APT-/POI-Profile und keine Prosa-Regex-Korrektur.
Live-Proben prüfen Planner und Writer gemeinsam statt nur vorbereitete Personen.
Strukturtests belegen Promptverkabelung und Profilgrenzen, nicht Textqualität.

Der Charter-Rollenvergleich lässt eine kürzere vollständige Berufsbezeichnung
(z.B. Fotografin gegenüber Projektfotografin) zu, nachdem der bestehende
Geschlechtskonflikt geprüft wurde. Diese Ausnahme gilt ausschließlich für
`bush_charter_strip`; echte andere Rollen bleiben Konflikte. Die finale Live-
Rohantwort ist im Produktions-Sanitizer replay-geprüft. Die technische Prüfung umfasst 73 Regressionstests mit realer Browser-
Verdrahtung, Writer-Fehlerpfaden, Quellenbindung und Profilgrenzen.

### Charter-Qualitätsmaßstab: Begebenheit und Haltung

Berufliche Chartergeschichten dürfen sachliche Aufträge bleiben. Persönliche
Qualität entsteht aus einer konkreten zum Vorhaben passenden Begebenheit,
der eigenen Reaktion und dem heutigen Vorgehen. Kein erzwungener privater
Nebenanlass, keine Pflichtpointe und kein einheitlich brummeliger Ton. Für Charter
enthält der Kapitel-FRAME zusätzlich vorhandene Passagier-Persönlichkeit und
Begrüßung. Live-Proben umfassen Planner, Writer, Kapitel und die bestehenden Boarding-/
Voice-Prompts. Die letzte Probe lieferte neun erfolgreiche Gemini-3-Flash-
Antworten ohne Modellwechsel. Kapitel zeigen mehr Persönlichkeit; kurze
Voice-Ansagen können weiterhin Auftrag und Zeitdruck wiederholen. Zwei
Antworten enthielten unerwartet JSON statt reinem Sprechtext. Diese offenen
Qualitätsgrenzen werden durch den Rollout nicht als behoben dargestellt.

Boarding und Begrüßung sind in der produktiven Runtime bereits kombiniert;
separate Startbegrüßungen werden unterdrückt. Die im Test zusätzlich erzeugte
Startansage gehörte nicht zum tatsächlichen Ablauf. Kein TTS-/Playback- oder
Windows-/MSFS-Flugtest durch diese Textprobe.

Alpha-Web-Rollout: Cache v1969. Der bestehende Tracker-/EFB-Release bleibt
unverändert; diese Änderungen betreffen die App-seitige Charter-Generierung.
