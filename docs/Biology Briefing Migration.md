# Biologie-/Umweltbriefings: Migration des bestehenden POI-Profils

Stand: 30.09.2026. Freigegeben für Alpha: Bio-Briefing v1.9, App-Cache v1882. Der neue Ablauf ist standardmäßig aktiv; `localStorage.setItem('ga_bio_briefing_v1','off')` schaltet zurück auf den bisherigen Pfad.

## Gestaltungsvertrag

Übernommen wird die Methode aus den neuen APT- und POI-Missionen, nicht deren Inhalt. Das vorhandene Profil `science_bio` mit `science_field_v1` bleibt erhalten. Zielauswahl und Kategorien (`water`, `mountain`, `forest`), POI-Arbeitsparameter, Rückkehr, Tracker-Phasen und Erfolgserkennung werden nicht geändert.

Die KI entwickelt eine freie biologische Studienidee mit Anlass, Institution und Fachperson. `studyFocus` hält die Forschungsfrage fest; `aerialObservation` verbindet ein erkennbares Muster, den Nutzen der Luftbeobachtung und den anschließenden Schritt der Feldarbeit. `outputUse` erklärt, wofür die Beobachtung gebraucht wird. Die Fachperson darf beobachten und qualitativ beurteilen. Fotos und Notizen unterstützen, sind jedoch keine obligatorische Umdeutung in einen Fotoauftrag.

Institutionen können Forschungseinrichtungen, Naturschutzorganisationen, Behörden oder Unternehmen sein. Vielfalt entsteht aus Forschungsfrage, Motivation, Luftnutzen und Folgearbeit; keine Themenliste oder Quote. Plausible fiktionale Studienanlässe werden in `scenarioDetails` bewahrt. Tatsächliche Geografie und Umgebung bleiben quellengebunden. Ortsnamen werden nicht zur Vegetations-, Habitat- oder Artenbestimmung interpretiert. Studienhypothese und beobachteter Befund bleiben unterscheidbar. Keine zugesicherten Artenfunde oder Detailmessungen aus einem normalen Überflug.

## Ablauf und Dateien

- `mission-bio-briefing-core.js`: Ideen-/Writer-Prompts, strukturelle Prüfung, Missionspaket, Historie und PAX-Kontext.
- `mission-bio-briefing-browser.js`: vorhandenen Picker und gemeinsamen Kontext anbinden; höchstens drei Kandidaten in einer Ideenanfrage; die gewählte Idee durch genau einen Writer ausarbeiten.
- `mission-poi-briefing-shared-core.js` und `mission-poi-briefing-shared-browser.js`: unverändert wiederverwenden für Lagebild, Orientierung, kartierte Umgebung, Terrain, Hindernisse, Wetter und Belegverweise. Im Bio-Pfad werden bis zu drei Picker-Kandidaten bereits vor der Ideenanfrage über denselben Umgebungscache angereichert; andere Profile behalten ihren bestehenden Ablauf.
- `app.js`/`sync.js`: Vorschlag `bio-proposal.v1`, Briefing `bio-briefing.v1` und Idee `bio-idea.v1` durch Finalisierung, Quota-Speicherung, Cloud und Wiederherstellung tragen. Die Idee ist an Start und Ziel gebunden.

`ga_bio_study_history_v1` bewahrt die letzten zwölf Ideen mit Forschungsfrage, Ausgangslage, Luftnutzen, Folgearbeit und Writer-Memory; höchstens 16.000 Zeichen. Diese Historie erreicht Ideen- und Writer-Prompt. Nicht automatisch aus dem alten, anders aufgebauten Seed-Verlauf rekonstruieren.

Ein fehlender oder ungültiger Wettertext verwirft keine gültige Studie: gemeinsamer quellengebundener Wetter-Fallback. Keine eigene Wetterimplementierung.

## PAX und Tracker

Die vollständige Studienidee gelangt über `MissionBioBriefingCore.voiceContext` in den vorhandenen `_baseContext`. Damit enthält auch der serialisierte Tracker-Sprachkontext die gleiche Forschungsfrage. Bestehende Phasen tragen Anlass, Beobachtung, vorsichtige Einordnung und den nächsten Schritt der Feldarbeit weiter. Keine neuen Trigger oder eigene State-Machine. Inspektionsmetadaten bleiben für `science_bio` ausgeschlossen.

## Tiere und Szenen

Der vorhandene Katalog enthält `waterfowl`, `wildlife_animals` und `animal_herd` mit Tierrollen und SimObject-Titelpools. Der bestehende Item-Builder in `sync.js` kennt diese Features bereits. Das belegt einen vorgesehenen technischen Pfad, keine erfolgreiche Sichtung in einer konkreten Simulatorinstallation.

Die alten Tierpools mischen Arten verschiedener Regionen. Der neue Pfad nutzt getrennte Modellfamilien. Art und Anzahl sind planbar, eine Tierszene bleibt optional. Die Verfuegbarkeit wird laut Nutzerfreigabe angenommen; der echte Spawn-Test folgt spaeter.

MSFS 2024 unterstützt die Enumeration spawnbarer SimObjects einschließlich `SIMCONNECT_SIMOBJECT_TYPE_ANIMAL`: [offizielle SimConnect-Dokumentation](https://docs.flightsimulator.com/msfs2024/retail/programming-apis/simconnect/api-reference/events-and-data/simconnect_enumeratesimobjectsandliveries/). Verfügbarkeit und Verhalten einzelner Tiere bleiben vor Ort zu prüfen.

Die Entscheidung zum nachträglichen Composer bleibt bestehen. Der [nicht freigegebene Konzeptentwurf](POI%20Scene%20Composition.md) zur Vorplanung oder Story-Szenen-Abstimmung wird nicht umgesetzt. Tiere dürfen eine geeignete Studie unterstützen, ohne die Ideenvielfalt auf technisch darstellbare Tierbeobachtungen zu verengen.

## Validierung und nächste Freigabe

58 automatisierte Tests bestanden, inklusive Tiergruppen: neue Bio-Prüfungen plus Infrastruktur-, Reporter- und POI-Sprachregressionen. Geprüft sind Zielbindung, ein Writer nach Auswahl, Profil-/Rollenbestand, Quellenreferenzen, tatsächlicher Finalizer, Quota-/Cloud-Speicherung, Historiengrenzen und Bio-Idee in den vorhandenen Tracker-Sprachprompts nach JSON-Wiederherstellung.

Noch offen: Gemini-Livetests in Batches von höchstens drei Missionen mit anschließendem inhaltlichem Review, ein Browser-Enddurchlauf sowie reale Tier-Spawntests im laufenden Betrieb. Diese Checks nicht mit den bisherigen Mock-/Regressionstests gleichsetzen. Default-on und Veröffentlichung erfolgen erst nach Bewertung der neuen Texte.

### Tier-Recherche vom 30.09.2026

Der [MSFS-Tierkatalog](MSFS%20Animal%20Catalog.md) und `data/msfs-animal-research-catalog.json` dokumentieren inzwischen 808 exakte SDK-Titel, die bestehenden Rollen und noch offene Installations-/Spawn-Tests. Alle 25 bisherigen Tiernamen sind offiziell belegt. Für Artenauswahl und Quellfehler die Kataloghinweise lesen; die Laufzeitregistrierung ist unten beschrieben.


## Tiergruppen: Freigabe vom 30.09.2026

Die Standardtiere des Simulators gelten auf ausdrückliche Nutzerfreigabe als verfügbar. Das ist eine Arbeitsannahme, kein erfolgreicher Spawn-Test. Die bisherigen Recherche-/Prüfstatus bleiben als Herkunftsnachweis erhalten; ein späterer Test im laufenden Simulator prüft die tatsächliche Verfügbarkeit.

`data/mission-animal-scene-assets.js` registriert 116 getrennte Modellfamilien mit insgesamt 808 eindeutigen SDK-Titeln. Generierung: `node tools/generate-animal-scene-assets.mjs` aus `data/msfs-animal-research-catalog.json`. Jede Familie hat ein eigenes Feature und eine eigene Rolle; keine zufällige Vermischung verschiedener Arten. SDK-Namensauffälligkeiten stehen in `sourceNotes`. Der Katalog wird nach dem Basis-Assetkatalog geladen.

Writer und Composer dürfen passende Tiere und größere Herden einsetzen. Die Ideenstufe beschreibt optionale Objektwünsche frei in `sceneIntent.visibleIdeas`. Erst der Writer der gewählten Idee ordnet gewünschte Tiere dem konkreten Katalog zu und übergibt Art, Anzahl und Zweck in `sceneIntent.animalGroups`. Fiktive Bestände gehören zur Spielhandlung; Habitat und regionale Plausibilität müssen zur Mission passen. Eine Mission ohne Tiere bleibt möglich. Die Szene entsteht weiterhin nach dem Writer über den bestehenden Composer.

Tiergruppen erlauben bis 20 Tiere pro Gruppe und bis 40 Objekte insgesamt. Nichttiergruppen behalten höchstens sechs Objekte pro Gruppe und das bisherige Dichtebudget. Größere Tiergruppen erhalten eine zentrierte Gruppenanordnung; Flächen-, Gebäude-, Abstands- und Kollisionsprüfungen bleiben wirksam. Alle katalogisierten Tiere werden zunächst als bodengebundene Objekte behandelt; Flug-, Schwimm- oder Herdenverhalten wird dadurch nicht zugesichert.

Prüfung: `node --test tools/mission-animal-scene-assets.test.mjs` prüft Katalogübernahme, eine Herde mit 20 Schafen bis zur tatsächlichen Objektliste, Artentrennung, räumliche Ablehnung und Erhalt der Gruppenangaben im App-Sanitizer. Biologie bleibt bis zur gesonderten Freigabe im dokumentierten Testpfad (`ga_bio_briefing_v1`). Keine neuen Tracker- oder Voice-Auslöser.

## Livebatch vom 30.09.2026

Drei Versuche abgeschlossen: Feldberg ohne gültige Bodenfläche, Schluchsee wegen alter Sammelrollen im Tiervertrag abgewiesen, Schönbuch mit 21 gültig platzierten Objekten. Der reale Missionspaket-Handoff von sceneIntent wurde korrigiert und mit einem zusätzlichen Test abgesichert. Inhaltliche Quellenbindung und Fähigkeitenvertrag brauchen noch Nacharbeit. Details und Koordinaten: `analysis/poi-bio-live-20260930/Review.md`. Noch keine Rollout-Freigabe aus diesen Ergebnissen ableiten.

## Breiter Biologie-Rahmen, Prompt v1.4

Der biologische Gegenstand, die Forschungsfrage und der Nutzen der Luftübersicht entstehen vor der technischen Szene. Vegetationsentwicklung, Gewässer-/Uferlebensräume, Habitatverbindungen und ökologische Prozesse sind Beispiele für den offenen Spielraum, keine Themenliste oder Quote. Eine Studie ohne Zusatzobjekte ist vollständig.

Der große Tierkatalog ist aus dem Ideenrahmen entfernt. Die Idee erhält nur die allgemeine Möglichkeit optionaler Szenenobjekte; sie benennt Wünsche in Alltagssprache. Der bestehende Writer erhält weiterhin den Artenkatalog, ordnet nur die Wünsche der gewählten Idee zu und gibt die geprüfte sceneIntent weiter. Anzahl der KI-Stufen unverändert: eine Ideenanfrage, ein Writer, danach bei Bedarf der bestehende Composer. Keine Integration der räumlichen Komposition in den Writer. Die gespeicherte/gesprochene Idee bewahrt die aufgelösten Tiergruppen. Studien ohne Zusatzobjekte dürfen durch den Writer keine neue Tierszene bekommen.

Die Historie bleibt vollständig gespeichert; die Ideenstufe erhält Forschungsfrage, Ausgangslage, Luftnutzen und Verwendungszweck statt technischer Tiergruppen und Modell-IDs. Der Vergleich berücksichtigt den biologischen Gegenstand, damit ein Tierartenwechsel nicht als neue Studie genügt. Zielbelege und der gemeinsame geografische Kontext erreichen die Ideenstufe. Studienfiktion bleibt ausdrücklich Hypothese, kein Ortsbeleg oder bestätigter Zustand.

Alte Sammelrollen waterfowl/wildlife_animals/animal_herd werden nur im Bio-Fähigkeitenkontext ausgelassen; die alten Profile und Pools bleiben erhalten. Konkrete Arten sind weiterhin zugänglich. Lange sichtbare Objektwünsche werden bis 400 Zeichen angenommen und auf die bestehende 100-Zeichen-Schnittstelle gekürzt, statt an minimalen Längenüberschreitungen eine ganze Studie zu verwerfen.

63 automatisierte Tests bestanden. Die Liveprüfung zeigt weiterhin Anlaufprobleme: Ein Dreierbatch mit umfangreichem Katalog und ein weiterer mit ausgelagertem Katalog blieben stark zoologisch geprägt; ein Entwurf scheiterte an einer geringfügig zu langen Objektbeschreibung. Nach der Entlastung auch der technischen Historie entstand im einzelnen Kontrolllauf eine Nichttierstudie zu Ufervegetation und Verlandung mit Sedimentproben als Folgearbeit. Der echte Composer ließ die optionalen Boot-/Bojenwünsche nach fünf Anfragen weg (kind=none, null Objekte, kein Endfehler). Es wurde keine Simulator-Szene erzeugt.

Noch offen: belastbare thematische Vielfalt in weiteren kleinen Batches und zuverlässige Quellenbindung. Der Kontrolltext behauptete Niedrigwasser und konkrete Vegetationszustände ohne gelieferten Ortsbeleg; die anschließende Hypothesenformulierung wurde im Prompt verschärft, noch nicht erneut live getestet. Außerdem erschienen Gewässernamen als Flüsse in der gemeinsamen Navigation. Eine Änderung dieser gemeinsamen Kartenklassifikation betrifft alle POI-Profile und braucht gemäß AGENTS.md eine gesonderte, gezielte Freigabe. Keine zentrale Geo-Änderung in diesem Schritt. Noch nicht veröffentlicht.

## Geografische Grundlage vor der Ideenwahl, Prompt v1.5

Der vorhandene Bio-Picker mischt water, forest und mountain. Seine selectedTags lagen bereits in poiLookup, wurden im neuen Bio-Kontext aber nicht verwendet. Die Umgebung wurde bislang erst für den Writer angereichert. Der Bio-Browser übernimmt nun die expliziten Picker-Tags (natural, landuse, water, waterway, wetland, leisure, boundary, protect_class) und die gewählte Kategorie in targetSelection. Namen werden nicht als Habitat- oder Landschaftsbelege benutzt. Ziele außerhalb des vorhandenen Natur-Pools werden im Bio-Pfad abgewiesen. Keine Änderung am gemeinsamen Picker oder an anderen Profilen.

Der bestehende Umgebungscache liefert nun die kartierten Flächen für bis zu drei Kandidaten vor der Ideenwahl. Dadurch kann die Frage bereits zum Zieltyp und seinen belegten Flächen passen. Beim Writer wird der ausgewählte Kontext über denselben Cache aktualisiert. Es bleibt eine Ideenanfrage und ein Writer; zusätzliche Kartenabfragen sind auf die bis zu drei Kandidaten begrenzt und werden gecacht.

studyEvidence im Ideenvertrag nennt vorhandene Ziel-/Umgebungs-factIds und erklärt ihre Relevanz für die Forschungsfrage am gewählten Ziel. Unbekannte Referenzen werden abgewiesen. Alte gespeicherte Ideen ohne dieses Feld bleiben mit explizit allgemeiner, unbelegter Fragestellung kompatibel. Der ausgewählte Natur-POI bleibt das Hauptsubjekt; nahe Landmarken ersetzen ihn nicht. Der Writer erhält dieselbe Auswahlgrundlage und die angereicherten Ortsbelege.

65 automatisierte Tests bestanden, einschließlich Reihenfolge Kartenkontext→Idee, Tags statt Namensinterpretation, Naturkategorie, unbekannter Quellenreferenzen und Erhalt der Studiengrundlage in der Historie. Die Prüfung der Beleg-IDs ersetzt keine semantische Qualitätskontrolle des KI-Textes. Gemeinsame Kartenklassifikation und Geo-Parser bleiben unverändert; der zuvor dokumentierte Fehler bei generischen Gewässerpunkten ist davon getrennt.

### Trennung von Studiengrundlage und Orientierung, Prompt v1.6

Der einzelne v1.5-Livekontrolllauf wählte eine Nichttierstudie über Uferstrukturen am Schluchsee, leitete aber steile Hangwälder aus benachbarten Bergnamen ab. Deshalb enthält der v1.6-Ideenrahmen nur die gewählte Zielkategorie, explizite Picker-Tags und Ziel-/Umgebungsbelege. Bloße Landmarken und Hindernispunkte sind keine ökologische Studiengrundlage und werden der Ideenstufe nicht als solche angeboten. studyEvidence darf nur IDs aus targetFacts nennen; benachbarte Orientierungsanker werden dafür abgewiesen. Die gleiche Begrenzung gilt im Writer-Prompt, während NAVIGATION weiterhin Lagebericht und Hindernishinweise versorgt. Die Picker-Tags bleiben im gespeicherten sourceContext erhalten.

66 automatisierte Tests bestanden. Die abschließende v1.6-Trennung wurde noch nicht erneut live getestet. Gemeinsame Geo-Klassifikation unverändert, kein Release.

## Dreierbatch v1.7 und Anschlusskorrekturen v1.8

Drei Livebeispiele abgeschlossen: Vegetationsstudie Feldberg (ohne gültige Zusatzszene), Uferstudie Schluchsee (7 geometrisch gültige Objekte, teilweise unpassende Ausrüstungsmodelle) und der echte forest-Picker mit Wildgehege Sankenbach (20 geometrisch gültige Tiere; Wald/Wiese als belegte Studiengrundlage). Detaillierter Review und Objektkoordinaten: `analysis/poi-bio-live-20260930/batch-v17/Review.md`.

Nach dem Batch übergibt der Bio-Kontext auch tourism/zoo und lässt leere Tags weg. Ziele mit expliziten Tags erhalten target-selection-tags als Beleg. category-only bleibt bei fehlenden Tags ehrlich erhalten. Der Prompt bindet den Beobachtungsumfang an die vorhandenen Missionsparameter. 67 automatisierte Tests bestanden; diese Anschlusskorrekturen wurden noch nicht erneut live geprüft. Gemeinsame Assetrollen, Geo-Klassifikation und Transportwege bleiben unverändert. Noch nicht veröffentlicht.

## Anschlusskorrektur v1.9

Bei fehlenden kartierten Umgebungsflächen führt der Ideenrahmen eine erkundende Luftübersicht als Belegumfang mit: sichtbare Strukturen zunächst aufnehmen, danach Bodenstichproben auswählen. Der Prompt setzt dabei keinen bestimmten Vegetationsbestand voraus. Kein neuer geografischer Provider, keine Interpretation von Ortsnamen und keine neue Themenquote.

Der Writer erhält pro Feature die konkreten Modelle unter `sceneCapabilities.features[feature].modelsByRole`. Forschungsausstattung wird nach deren sichtbarer Funktion beschrieben; nicht darstellbare Messausrüstung gehört zur anschließenden Bodenarbeit. Ideenbildung bleibt unabhängig vom technischen Modellkatalog. Composer bleibt nachgelagert.

Mit der Anschlussfreigabe wurden die gemeinsamen Sammelrollen gezielt bereinigt: `marker.cone` enthält keinen Rauchmarker mehr, `cargo.small_box` keine Kaffeetasse. Die beiden unpassenden Modelle werden aus diesen Sammelrollen entfernt; es werden keine neuen Ersatzrollen eingeführt. Andere Profile profitieren ebenfalls von dieser eindeutigen Zuordnung. Keine Änderung an Geometrie, Szenenbudget oder Tracker-Ablauf. Diese Fassung ist noch nicht erneut live getestet oder veröffentlicht.

## Alpha-Ausrollung

Freigegeben am 30.09.2026 nach drei Live-Beispielen und den beschriebenen Anschlusskorrekturen. 68 automatisierte Tests bestehen. Die Anschlussfassung v1.9 wurde nicht erneut live generiert; echte Tier-Spawns im laufenden Simulator bleiben als Betriebsprüfung offen. Tracker-Code und EXE unverändert.
