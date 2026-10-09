# Bush-Erzählung und Ortsgeschichten

Stand: 07.10.2026 – lokale Erweiterung, kein Release.

## Persönliche Grundlagen der übrigen Bush-Stränge (09.10.2026, lokal)

Die persönliche Charter-Planung wird profilbezogen ergänzt, ohne die technischen
Rezepte, Profile, Manifestregeln oder Abschlussbedingungen zu ändern.
`storyBasis`, `planningInstructions` und `writerRecipe` verbinden kreativen
Profilkontext, beide Planner-JSON-Vorlagen und den V5-Writer. Die vorhandenen
storyFrame-Felder fragen nach einer konkreten Person beziehungsweise dem
Kontakt am Boden, einer erlebten Begebenheit, eigener Handlung/Reaktion und dem
heutigen Anliegen. Das Pilotziel bleibt aus dem jeweiligen Vertrag.

| Strang | Erzählkern | Ablauf und Sprecher |
| --- | --- | --- |
| Supply | Konkrete Sendung und persönlicher Bezug des Empfängers | 0 PAX, Entladen am Ziel; Dispatch über Kontakt am Boden |
| Adventure | Eigener Outdoor-Wunsch und eine passende Erfahrung | Hinflug mit Gast, Landung am Ziel; kein Rundflug |
| Passenger-Pickup | Aufenthalt, persönliche Reaktion und Rückkehrgrund | Leer hinaus; Gast spricht erst nach Aufnahme auf dem Rückflug |
| Cargo-Pickup | Geschichte der Sache und des beteiligten Kontakts | Leer hinaus, Fracht zurück und daheim entladen; keine Bordperson |
| Recon | Konkreter Aufklärungsanlass und Untersuchungsfrage, persönlich aus demselben Sachverhalt erzählt | Luftbeobachtung und Rückkehr; nur vertraglicher Beobachter spricht |

Eine konkrete Handlung oder beiläufige Bemerkung soll den Ton tragen. Keine
Witzpflicht, feste Grummel-Persona oder Panne pro Auftrag. Gesperrte Follow-up-
Personen und tatsächliche Vorgeschichten bleiben bindend. Erzählerische Details
sind keine zusätzliche Aufgabe und kein Beleg für reale Anlagen oder Wetter.

Auch Adventure-, Pickup- und Recon-Kapitel erhalten Persönlichkeit und
Begrüßung des tatsächlichen Passagiers. Ohne Sprecher entsteht kein Erzählplan;
Cargo-only bleibt weiterhin ohne erfundenen Mitflieger. Keine neue KI-Abfrage
im Produktionsablauf: Es werden die bestehenden Prompts und Frames ergänzt.

Prüfungen: `tools/bush-profile-personality.test.cjs` ergänzt die bestehenden
Charter-, Quellen-, Erzähl- und Tracker-Rezepttests. Der begrenzte Live-Prüfer
`tools/bush-profile-personality-live.mjs --profile=... --live` führt produktive
Planner/Contract/Writer-Funktionen mit fiktivem Auftrag und gelieferten
Flugplatzfixtures aus. Kein Browser-, Sim-, Audio- oder vollständiger Boarding-
Durchlauf; automatische Quellenabrufe sind in der Probe ersetzt. Ergebnisse
unter `analysis/bush-profile-personality-20261009/` bleiben lokale Prüfarbelege.

Recon-Gewichtung: Das Ereignis beziehungsweise die Auffälligkeit trägt die
Geschichte. Der persönliche Bezug vertieft denselben Anlass, statt eine eigene
Nebenepisode zu eröffnen. Planner und Writer erhalten dafür einen gezielten
Profilzusatz ohne Beispielgeschichte; Felder und Ablauf bleiben unverändert.

### Prüfung und Cargo-Pickup-Korrektur

75 lokale Regressionstests bestehen, einschließlich Charter, Quellenbindung,
Writer-Erhalt und Tracker-Abläufen für die Bush-Rezepte. Live-Proben aller fünf
Stränge verwenden den Produktionsplanner und -writer mit Gemini. Persönliche
Anlässe werden sichtbar, die erzählerische Qualität variiert weiterhin; dies ist
keine Zusage, dass jeder generierte Text bereits Charter-Beispielqualität hat.
Ein Writer-Aufruf lief in ein Timeout; die erfolgreiche Wiederholung verwendete
den vorhandenen Plan. In den geprüften Antworten trat kein Quota-Modellwechsel auf.

Cargo-Pickup teilt die technische TaskDomain `bush_pickup_return` mit dem
Personen-Pickup. Dessen bisherige Writer-Vorgabe verlangte eine Personenaufnahme
und verursachte im Live-Text einen Mitflug trotz 0 PAX. Cargo-Pickup erhält nun
vor diesem gemeinsamen Zweig eigene DomainDetails; die Personen-Promptvorgabe
wird nur für Personen-Pickup ergänzt. Kontakt bleibt am Ziel am Boden, nur die
vereinbarte Fracht kehrt zurück. Die korrigierte Live-Probe
`bush_pickup_cargo-proof.json` bestätigt dieses Verhalten. Keine nachträgliche
Textumschreibung, neue Klassifikation oder zusätzliche Produktionsabfrage.

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

Alpha-Web-Rollout: Cache v1970. Der bestehende Tracker-/EFB-Release bleibt
unverändert; diese Änderungen betreffen die App-seitige Charter-Generierung.


### Platzinformationen bei internen OpenAIP-Kennungen (08.10.2026)

Ein benannter Bush-Flugplatz mit gültigen Koordinaten kann auch ohne offiziellen
ICAO-/FAA-Code den bestehenden Platzinformationsbaustein nutzen. Interne
`OA-*`-Kennungen werden nicht an den FAA-Endpunkt geschickt. Eigene Daten und
die vorhandenen, begrenzten Wikipedia-/Terrain-Pfade bleiben nutzbar; es entsteht
kein zusätzlicher separater KI-Aufruf. APT/POI und das Recon-Ziel bleiben außerhalb
dieses Bush-Platztext-Pfads.

## Live-Review Planner/Writer und Platzfelder (09.10.2026, lokal)

Alle sechs Bush-Profile wurden mit produktiven Planner-/Writer-Funktionen,
gelieferten Flugplatzfixtures und ohne Browser/Simulator geprüft. Fünf Profile
ließen beide Stufen erfolgreich durchlaufen. Personen-Pickup: Planner erfolgreich,
Writer abgebrochen; genau eine Wiederholung mit gespeichertem Plan brach ebenfalls
ab. Keine weiteren Wiederholungen. Insgesamt 17 API-Aufrufe einschließlich einer
zusätzlichen Recon-Konfigurationsprobe und einer Quellenprobe; kein beobachteter
Quota-Fehler oder Modellwechsel. Technischer Erfolg ist kein Qualitätsnachweis.

Produktiv ist Startredaktion für alle Bush-Profile aktiviert. Zielredaktion und
Anflugbriefing gelten für die fünf Profile mit Ziellandung; Recon ist ausdrücklich
ausgenommen. Der Live-Prüfer berücksichtigt nun denselben enabled-Schalter. Die
ursprüngliche Recon-review-Probe lieferte künstlich Zielplatzmaterial und ist kein
Beleg für die produktive Zielseite; recon-review prüft die korrekte Konfiguration.
Reine Pistenbasisdaten führten erwartungsgemäß zu generated=false/own-data-only am
Ziel. Eine zusätzliche Charter-Probe mit gekennzeichneten gelieferten Testnotizen
erzeugte generated=true für Anflugbriefing und Zielseite. Beide Platztexte werden
im bestehenden Writer-Aufruf erstellt, ohne zusätzliche KI-Abfrage.

Offene Qualitätsbefunde: künstliche Dringlichkeit, unbelegte saisonale/wetterliche
Behauptungen, örtliche Einrichtungen oder Nutzung aus persönlicher Story übernommen.
Die Quellenprobe zeigte dies auch in Platztexten. Recon stellt den Anlass deutlicher
voran, erfindet aber noch saisonale Bedingungen und lokale Anlagen. Kein Rollout
und keine stillschweigende Änderung gemeinsamer Semantik/Quellenverarbeitung aus
diesem Review. Ergebnisse: analysis/bush-profile-personality-20261009/*review*.json
und bush_charter_strip-source-proof.json. Keine vollständige UI-, Boarding- oder
Audio-Prüfung; echte externe Quellenabrufe und aktuelles Wetter waren nicht Teil
der gelieferten Testfixtures.

## Wettergewichtung und Recon-Objektseite (09.10.2026, lokal)

Bestehende Bush-Prompts erhalten Wettergewichtung: gewöhnliche Werte und Saison
begründen keine Wettermission; ein markantes ausdrücklich geliefertes Ereignis
kann den Anlass tragen. Kandidaten sind Möglichkeiten, keine Ereignismeldungen.
Recon fragt zuerst nach Beobachtungsanlass; die Bush-spezifische Rückfallbasis
erzeugt keine automatische Sturm-/Schadensmeldung. Andere Infrastrukturprofile
behalten ihre bisherigen Vorlagen. Keine Prosaheuristik oder nachträgliche Kürzung.

Das gewählte Recon-Objekt erhält bushReconInfo (Text und Quellenstand). Gemeinsame
POI-Bausteine beschaffen und formatieren Lage, Orientierung, Gelände und Hindernisse;
bei Flugplatzzielen werden vorhandene Platzquellen zur Beobachtung aus der Luft
geliefert. Kein Landeauftrag, keine Höhenänderung oder sichere Tiefflugfreigabe.
Historie/Zweck ausschließlich aus passenden Belegen; fiktiver Verdacht bleibt
Missionsanlass. Im bestehenden V5-Aufruf entstehen targetInfo und reconReport;
keine zusätzliche KI-Abfrage. Optionale Geo-/Wiki-/Umgebungsabrufe am gewählten
Ziel nutzen gemeinsame Cache-/Inflight-/Cooldown-Regeln. Außerhalb vorhandener
Tile-Abdeckung bleibt diese Datenlücke sichtbar. Vollständiger Text und
Quellenstand bleiben bei lokaler Speicherung und Cloud-Kompaktierung erhalten.
Die bestehende Zielseite rendert den Recon-Text vor der alten Wikipedia-Abfrage.

100 Tests bestanden (einschließlich lokaler/Cloud-Kompaktierung, voller Texte,
Quellenrückfälle, unveränderter POI-Navigation und Recon-Runtime). Drei Live-Proben
mit gelieferten Fixtures: Flugplatz und Funkmast technisch erfolgreich, aber
Funkmasttexte ergänzten unbelegte Wetter-/Gelände-/Objektangaben. Der letzte
Nachschärfungsschritt an Kandidatenstatus, Recon-Anlassfrage und Writer-Belegarbeit
ist lokal getestet, noch nicht erneut live oder im Browser/Simulator geprüft.
Kein Rollout; keine Zusage zuverlässiger Quellenbindung allein durch Prompts.

## Writer-Zeitlimit und erneute Live-Serie (09.10.2026, lokal)

Die vorherigen Personen-Pickup-Abbrüche waren abgebrochene Requests, keine
semantischen Textablehnungen. Das Gemini-Zeitlimit des Bush-V5-Writers wurde
gezielt von 16 auf 30 Sekunden angehoben; Gemini-APT bleibt bei 16, OpenAI bei
26 Sekunden. Kein zusätzlicher KI-Aufruf und keine neue Wiederholungsregel.
Die neue Probe benötigte für den Pickup-Writer 17410 ms und wurde erfolgreich
angenommen; Supply benötigte 17062 ms. Die Überschreitung des bisherigen Limits
bestätigt den Zeitengpass, beweist aber nicht jede historische Netzwerkursache.
101 Regressionstests bestehen. Live-Reports messen nun Request-Dauer und bewahren
für spätere Proben auch den fiktiven Modell-Rohtext zur Abgrenzung vom Parser.

Dreiergruppe 1: Personen-Pickup, Recon-Flugplatz, Recon-Funkmast erfolgreich.
Recon erfindet diesmal kein Wetterereignis oder Hanggelände; die Stories bleiben
generisch. Mast-Zieltext ergänzt unbelegte zentrale Bedeutung und Prüfpflicht.
Dreiergruppe 2: Charter, Supply, Adventure erfolgreich. Supply persönlich und
ohne Wetterdruck; Charter und Adventure erfinden weiterhin saisonale Bedingungen
und Eile. Adventure leitet sichtbares diffuses Licht aus der Modellbewölkung ab.
Die Adventure-Rohdaten zeigen bereits im Planner erfundene Herbst-/Frostlogik;
der Writer übernimmt und erweitert sie. Die verbleibende Drift ist keine bloße
Textkürzung oder Quota-Umschaltung. Cargo-Pickup erfolgreich, 0 PAX und Fracht-Rücktransport bleiben erhalten;
Story weiterhin sachlich. Insgesamt sieben Missionen mit 14 erfolgreichen
HTTP-200-Aufrufen, ohne neuen Abort, beobachteten Quota-Fehler oder Modellwechsel. Ergebnisse unter analysis/bush-profile-personality-20261009/*fix*.json.
Diese Serie ersetzt keine echte Wetter-/Geo-Netzprobe oder Simulatorprüfung.
Noch kein Rollout und keine Zusage erreichter Charter-Beispielqualität für alle
Stränge. Weitere fachliche Änderungen aus den Befunden sind separat zu entscheiden.


### Saisonale Anlässe und Bush-Antwortbudgets

Alle Bush-Profile dürfen reguläre saisonale Aufgaben als längerfristigen Anlass nutzen, etwa Herbstwartung vor dem Winter. Jahreszeit und normales Wetter erzeugen allein keine Dringlichkeit. Wetterbedingte Eile erfordert ein belegtes bevorstehendes Ereignis mit relevantem Ort, Zeitpunkt und Bezug zum Auftrag. Diese gemeinsame Vorgabe geht an Planner, Writer und Erzählkapitel; Texte werden weiterhin vollständig übernommen.

Bush-Planner einschließlich vorhandener kompakter Wiederholung, Writer V4/V5, Legacy-Writer und Erzählkapitel erhalten je 45 Sekunden Antwortbudget. Die Live-Messungen lagen zuletzt bei rund 12–17,4 Sekunden; das Budget lässt Reserve für längere Texte und langsamere Antworten. Es erzeugt keine zusätzlichen Abfragen oder Wiederholungen. APT-/POI-Budgets bleiben unverändert. Das Budget gilt je vorhandener Anfrage, nicht als Gesamtdauer der Pipeline.


### KI-geplante Recon-Zone und Beobachtungsdauer

V4-Bush-Recon ergänzt plan.bushReconPlan mit radiusNm, observationSeconds und rationale. Der Planner entscheidet passend zur Aufgabe statt eines festen Überflug-Sonderprofils. Der fertige Vertrag geht unverändert an den Writer, wird auf Bush-areaRef/success und Passenger-Zielwerte projiziert und in App/Tracker ausgeführt. Keine zusätzliche Mindestflugstrecke.

Für Beobachtungen über 20 Sekunden gilt als technische Untergrenze ein Kurvenradius aus der gelieferten Reisegeschwindigkeit bei 15° Schräglage, multipliziert mit 1,5 plus 0,15 NM Reserve. Bei fehlender Geschwindigkeit werden 110 kt angenommen. Dies ist eine geometrische Planungsreserve, keine Garantie gegen Übelkeit, Wind oder Abweichungen vom geplanten Flugzustand. Kurze Beobachtungen berücksichtigen eine Durchflugreserve. Dauer 3–300 Sekunden, gewünschter Radius maximal 8 NM. Fehlende/ungültige KI-Werte behalten den bisherigen Recon-Fallback.

Nur Missionen mit bush-recon-plan.v1 zählen echte qualifizierende Beobachtungssekunden: kein Easy-Modus-Halbierungsfaktor oder Nähe-Bonus. Bestehende POI- und alte Recon-Missionen bleiben unverändert. Neue kleine Recon-Zonen werden nicht mehr durch die alten Bush-/Passenger-Mindestgrößen vergrößert.

Live-Kontrolle: 80 kt / 3,2 NM / 150 s; 110 kt / 2,5 NM / 150 s; 160 kt / 2,24 NM / 90 s (KI 2,0 NM, geometrisch angehoben). Drei gültige Planner-/Writer-Läufe; ein Array-verpackter Vorversuch wurde nach gezielter Reparatur ersetzt. Saisonale Sprache bleibt qualitativ nicht vollständig zuverlässig. Kein Rollout und kein Simulator-End-to-End-Test.


### Abschluss und POI-Trennung, Web v1988 / Tracker v504

Bush-Recon baut die Basis aus dem Zieltyp: bekannte Flugplaetze behalten ihre Platzpruefung; Objekt-POIs bekommen Objekt-/Umfeld-Aufklaerung, passende neutrale Beobachterrolle und eigene Betriebsnotizen. Flugplatz-Persona-Seeds werden nicht auf Funkmasten uebertragen. Die vorhandenen Recon-Zustandsziele setzen kein bereits eingetretenes Wetterereignis voraus. Der Planner darf aus konkretem Wetterkontext weiterhin einen solchen Anlass entwickeln.

Einzelner Ueberflug: wenige Sekunden im Zielbereich. Umfangreichere Aufklaerung: KI-gewaehlte Zeit und ausreichend grosse Zone fuer ruhigen Kurvenflug. Ein paar oder zwei bis drei Kreise sind erzaehlerische Annaeherung, keine zusaetzliche Pflicht zur Zahl abgeschlossener Kreise. Der Gast kann nach Erfuellen seiner Beobachtung zufrieden sein.

Finaler Live-Masttest: Objekt/Fundament/Abspannungen, keine Piste, kein Windsack, keine Flugplatzmarkierungen; 150 Sekunden, KI-Radius 0,6 NM technisch auf 1,14 NM angehoben (110 kt). Texte vollstaendig. Fiktive Simulatorwelt-Details sind vom Nutzer akzeptiert; jahreszeitliche Passung und echte Wetterdringlichkeit bleiben eigene Qualitaetsmerkmale.
