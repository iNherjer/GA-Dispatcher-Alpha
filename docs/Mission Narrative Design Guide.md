# Persönliche Missionsbriefings: Zielsetzung und Übertragung

Aktueller konsolidierter Stand und Übertragung auf weitere Sets: [Missionssets-Arbeitsgrundlage](Mission%20Sets%20Handoff.md) (15.09.2026).

Stand: 14.09.2026. Release: Privat-Planner und Episode Writer V6.3 mit KI-Picker, Private Return V1; App-Cache `ga-dispatcher-v1760`, Tracker Alpha v404.
Dieser Leitfaden beschreibt den aktuellen Ansatz und die Entscheidungen für weitere
Missionsfamilien. Implementierungsdetails und historische Versuche stehen in
[Mission Episode Writer V6](Mission%20Episode%20Writer%20V6.md).
Fachliche Grenzen bleiben in [Mission Semantics Rules V4](Mission%20Semantics%20Rules%20V4.md)
und [Mission Flow Reference](Mission%20Flow%20Reference.md) verbindlich.

## 1. Produktziel

Ein Briefing erzählt vor dem Abflug, wer wohin möchte, was dort vorgesehen ist
und wie dieser Wunsch entstanden ist. Es soll persönlich, verständlich und
informativ sein. Der Anlass darf banal oder ungewöhnlich sein. Seine Größe
bestimmt, wie viel Erklärung nötig ist. Ein kleiner Wunsch braucht keine große
Vorgeschichte, besondere Ausrüstung oder emotionale Gegenleistung.

Vielfalt betrifft Tätigkeit, Motivation, Beziehungen und Sprache. Ein anderer
Name oder Ort macht aus demselben Handlungsmuster noch keine neue Geschichte.
Das Bild eines interaktiven Romans bezeichnet die Immersion: Der Text bleibt ein
Vorflugbriefing und spielt weder den laufenden Flug noch das Ergebnis vorweg.

Nutzerbeispiele zeigen die gewünschte Denkweise. Sie werden nicht zu einer Liste,
aus der jede spätere Mission auswählen muss. Ortswissen ist Anregung, keine
Pflicht zur Sehenswürdigkeit. Die Beziehung zwischen Menschen kann alleine tragen.

## 2. Verantwortlichkeiten und Datenfluss

| Ebene | Bestimmt | Grenze |
| --- | --- | --- |
| Missions-Core und V4-Contract | Zieltyp, Route, TaskDomain, technische Rollen und Ablauf | Erzähltext darf diese nicht neu klassifizieren |
| Kontextversorgung | Begrenzte Ortsbelege, Koordinaten, Wetterwerte und Quellen | Fehlende Belege sind kein Beweis fehlender Möglichkeiten |
| Ideenphase | Zusammenhängenden Anlass, Absichten, Person, Gepäck und Bodenplan als JSON | Alle Folgefelder entstehen aus derselben Idee |
| Writer | Titel, persönliches Briefing, Flugabsatz und Greeting | Idee erhalten; Formulierung, Einstieg und Rhythmus frei wählen |
| Memory | Kurze Beschreibung des tatsächlich geschriebenen Briefings | Keine Autorität über Missionsablauf und keine unabhängige Qualitätsprüfung |
| Validierung | Struktur, Referenzen, Identitäten und Wertevertrag | Kein Rekonstruieren der Mission aus Stichwörtern in der Prosa |

Für den privaten Erzählpfad gibt es zwei logische KI-Aufrufe: Idee und Writer.
Der Writer gibt Text und Memory gemeinsam als Felder eines JSON-Objekts zurück.
Es gibt keinen dritten Zusammenfassungsaufruf. Der vorgelagerte technische Planner,
Kontextabrufe und Provider-Retries gehören zusätzlich zum gesamten Dispatch-Pfad.

Der Flugabsatz erhält getrennte Start-/Zielbeobachtungen und gebundene Zahlenwerte.
Die KI formuliert die Sätze; der Code setzt bekannte Referenzen unverändert ein.
Das verhindert bestimmte Zahlenfehler, beweist aber weder die richtige räumliche
Zuordnung noch jede qualitative Wetteraussage. Eine Nachbarstation bleibt als
solche erkennbar; Stationswetter ist keine Beobachtung der ganzen Route.

## 3. Aktueller Spielraum und bewusste Grenzen

Inhaltlich können private Verabredungen, gewöhnliche Bedürfnisse, gemeinsame
Interessen, Freude am Fliegen oder lokale Möglichkeiten den Anlass bilden. Es
gibt keine fest verdrahtete Aktivitätsrotation. Ein passender fiktiver Anlass oder
Bekannte am Ziel sind zulässig. Benannte reale Orte benötigen im Produktionspfad
einen gelieferten Ortsbeleg; ohne ihn darf der Plan örtlich unspezifisch bleiben.

Technisch ist das aktuelle Profil enger: ein A-B-Flug mit genau einer erwachsenen
Begleitperson, gemeinsamer Ausflug und Abschluss der spielbaren Mission am
Zielflugplatz. Der Bodenplan ist Erzählkontext, keine simulierte Buchung, Wanderung
oder Veranstaltung. Solo, Kinder, Gruppen, mehrteilige Flugaufträge und andere
Erfolgskriterien sind damit noch nicht implementiert. Das Gepäckschema verlangt
1–35 lbs; die Persona nutzt derzeit `male|female`. Diese Grenzen kommen aus dem
aktuellen Profil/Schema und sind keine Grenze generativer Geschichten allgemein.

Die reale Umgebungssuche liefert höchstens acht Anker innerhalb von 50 km
Luftlinie, aus höchstens 16 POI-Tiles und einer geografischen Wikipedia-Abfrage.
Sie hat ein Budget von drei Sekunden und einen eigenen begrenzten Cache.
Luftlinie belegt weder Fahrzeit noch Verkehrsanbindung. Aktuelle Öffnungszeiten,
Restaurantbewertungen und Veranstaltungskalender werden nicht systematisch geladen.
Ein belegtes Ereignis darf zwischen Anflugdatum und Sonntag derselben Woche liegen;
das Schema unterstützt einen entsprechenden Aufenthalt.

**Wichtig für spätere Arbeit:** KI-Suche mit Google Search wurde im separaten
`tools/private-grounded-story-probe.mjs` erprobt. Der produktive private Textaufruf
hat dieses Suchwerkzeug noch nicht. Gute Suchtest-Ergebnisse sind deshalb kein
Nachweis derselben Quellenabdeckung in der ausgelieferten App.

## 4. Wo Vorlieben entstehen können

Es gibt keine feste Quote zugunsten einer Freizeitaktivität. Die Eingaben sind
trotzdem nicht neutral: `tileCandidates` gibt Tourismus-Tags einen Qualitätsbonus,
Wikipedia-Kandidaten erhalten ebenfalls einen Bonus. `selectPlaces` bevorzugt
zusätzlich Nähe und reduziert gleiche Typen sowie räumlich eng benachbarte Treffer.
Das verbreitert die Ortsauswahl, gleicht aber eine lückenhafte Quelldatenbank nicht aus.

Gut beschriebene Aussichtspunkte, historische Orte und touristische Ziele können
daher häufiger zum Aufhänger werden als alltägliche Gastronomie oder persönliche
Besuche. Pflichtfelder wie Gepäck, Bodenplan und erster Schritt können außerdem
mehr Requisiten und Transfer-Erklärungen anregen, als ein kleiner Anlass braucht.
Die Forderung nach einem vor dem Abflug geplanten gemeinsamen Ausflug erzeugt
bewusst einen gewissen gemeinsamen Grundton.

Dies sind aus Code und bisherigen kleinen Serien begründete Tendenzen, keine
gemessenen Häufigkeiten der aktuellen Version. Bei Auffälligkeiten zuerst
Quellenauswahl, Pflichtfelder und Promptgewichtung untersuchen. Ein einzelner
Burger-, Foto- oder Wanderausflug begründet kein neues Verbot.

## 5. Was das Gedächtnis tatsächlich leistet

`ga_private_episode_history_v1` liegt im localStorage des jeweiligen Browser-Origins:
höchstens zwölf Einträge, zusätzlich höchstens 32 KiB nach UTF-16-Schätzung.
Gespeichert werden auch akzeptierte neue Entwürfe, nicht erst abgeschlossene Flüge.
Ein Neuladen erhält die History, sofern der Browser-Speicher bestehen bleibt.
Es gibt keine geräteübergreifende History-Synchronisierung. Die aktive Mission
kann ihre eigene Memory über den Cloud-Sync mitnehmen; daraus wird nicht automatisch
die vollständige History eines anderen Geräts hergestellt.

Die Ideenphase erhält Tätigkeit, Motivation, Beziehung/Interaktion, Namen und Ziel.
Die Writerphase erhält Tätigkeit und Beschreibungen von Einstieg, Rhythmus und
Schluss. Gespeicherte Originalformulierungen werden nicht als Stilvorlagen in den
Prompt zurückgereicht. V5-Erinnerungen können strukturiert eingelesen werden.

Die History ist eine weiche Vergleichshilfe, kein Wiederholungsverbot und kein
Training des Modells. Außerhalb des Fensters, auf einem anderen Gerät, nach
Speicherlöschung oder bei fehlgeschlagener Speicherung können alte Ideen wiederkehren.
Auch eine formal gültige KI-Zusammenfassung kann den Text ungenau beschreiben.

Für die Diagnose drei Fragen getrennt beantworten:

1. `History=N`: Wie viele frühere Einträge bekam dieser Ideenaufruf?
2. `Privat-Erinnerung: accepted`: Ist die neue Zusammenfassung strukturell akzeptiert?
3. Folgelauf und Speicherprüfung: Wurde sie gespeichert und tatsächlich wieder eingelesen?

Der Nutzerbericht von 14:49 am 14.09.2026 zeigt `History=0` bei akzeptierter neuer
Erinnerung. Für genau diese Mission gab es somit keinen vorherigen History-Kontext.
Das beweist keinen Speicherfehler, aber auch noch keine wirksame Vermeidung von
Wiederholungen auf diesem Gerät. Die technische Speicherung/Übergabe ist getestet;
die Stärke des stilistischen Effekts braucht vergleichbare Serien.

## 6. Übertragung auf eine weitere Missionsfamilie

1. Den bestehenden Ablauf und dessen Autorität erfassen: Ziel, TaskDomain,
   Rollen, Manifest, Erfolgskriterien, Szenen und Voice. Gemeinsame Änderungen
   nach AGENTS.md vorab hinsichtlich anderer Missionsarten bewerten.
2. Das gewünschte Briefing in wenigen positiven Sätzen beschreiben: Was muss
   der Pilot verstehen, was darf frei erfunden werden, was muss belegt sein?
3. Einen kleinen strukturierten Ideenkern entwerfen. Fachliche Rollen aus dem
   Core übernehmen; freiwillige Erzähldetails nicht zu Pflichtfeldern machen.
4. Quellen und Faktenvertrag passend zur Aufgabe festlegen. Nicht jede Familie
   braucht Freizeit-POIs, denselben Radius oder dieselben zeitlichen Regeln.
5. Den Writer aus einer validierten Idee schreiben lassen. Sichtbaren Text,
   Voice und Memory getrennt liefern; gemeinsame Rollen und Absichten erhalten.
6. Den History-Bereich bewusst wählen: familienbezogen oder gemeinsam,
   Vergleichsfelder, Eintrags-/Byte-Limit und eventuelle Synchronisierung.
7. Fehler getrennt behandeln: ungültige Idee stoppen; bei Prosaausfall den
   vorhandenen Ideenkern bewahren; fehlende Memory nicht durch Textklassifikation
   ersetzen. Keine generische Ersatzgeschichte über eine andere Mission legen.
8. Eine eigene Version mit Rückfallmöglichkeit einführen. Erst nach Prüfung des
   gesamten Datenflusses weitere Profile anschließen.

Diese Schritte sind ein Vorgehen für künftige Änderungen, keine bereits erfolgte
Migration anderer Missionsfamilien. Der gemeinsame V4-Rahmen kann erhalten bleiben,
während Ideen- und Writer-Version je Familie weiterentwickelt werden.

## 7. Abnahme und nächste Untersuchungen

Technische Tests prüfen Datenübergabe, Schema, Faktenreferenzen, Versionswahl,
Speichergrenzen und Fehlerfälle. Liveprüfungen testen reale Quellen bis zum Writer.
Lesetests beurteilen Anlass, Vorflugperspektive, Drift, Sprachform und Memory-Treue.
Diese drei Nachweise ersetzen einander nicht.

Für eine kommende Vielfaltsauswertung vorab mehrere unterschiedliche Zielumfelder
und eine ausreichend lange Serie festlegen, beispielsweise 20–30 Entwürfe.
Keine Beispielaktivitäten vorgeben und keine misslungenen Ergebnisse aussortieren.
History-Zähler und Speicherergebnis mitführen; möglichst einen vergleichbaren
Durchlauf ohne History gegenüberstellen. Namen allein nicht als Vielfalt zählen:
wiederkehrende menschliche Motive, Einstiege und Schlussfunktionen mitbewerten.
Ein solcher Vergleich wurde für die aktuelle Produktionsversion noch nicht durchgeführt.

Priorität haben eine nachvollziehbare History-Wirkung und breitere brauchbare
Ortsbelege. Automatische KI-Suche und Ereignisquellen bleiben gesonderte Aufgaben
mit eigenem Kosten-, Zeit- und Faktenbudget. Nicht durch zusätzliche Produktions-
Beispielkataloge oder starre Aktivitätsquoten ersetzen.

## 8. Anzeige und Versionsbegriffe

Die Statusanzeige trennt Missionsrahmen, private Ideenphase und privaten Writer.
Sie folgt der tatsächlich ausgewählten V5-/V6-Privatversion; der globale Writer-
Schalter anderer Profile darf diese Anzeige nicht bestimmen. Der Diagnosebericht
verwendet zuerst `storyDebug.writerMode`. Pipeline V4 bezeichnet weiterhin den
technischen Rahmen, nicht eine Rückkehr zu den alten Privatbriefings.

## 9. Beschreibender Kontext: sparsamer Versuch vom 14.09.2026

`tools/private-descriptive-context-probe.mjs` testet ausschließlich eine andere
Kontextauswahl mit unveränderten V6.2.1-Ideen-/Writer-Prompts und Validatoren.
Lübeck, Büsum und Augsburg wurden vorab als bisher nicht verwendete Ziele gewählt.
Pro Ziel dient ein geografisch geprüfter Stadt-/Ortsfakt als Kontext: erste zwei
Wikipedia-Einleitungssätze, höchstens 500 Zeichen, Koordinaten, Quelle und
Luftlinienentfernung. Keine Aktivitätsbeispiele, keine KI-Suche, keine manuell
geschriebene Freizeitbeschreibung. Die Ortsnamen dieser Testfälle sind keine
Produktionsvorgaben. Eine gebündelte Wikipedia-Abfrage liefert alle drei Kontexte.

Aufwand: sechs Modellaufrufe, ohne Retry oder Reparatur; laut API 11.524 Eingabe-
und 3.694 Ausgabetokens (15.218 insgesamt). Das Tool begrenzt sich auf drei
Missionen, maximal sechs Requests und 2.200 Ausgabetokens je Request. Ein bestehender
Ergebnisbericht verhindert eine versehentliche Wiederholung. Fehlende Wetterwerte
sind in diesem Versuch beabsichtigt; er bewertet den Orts-/Storypfad, nicht den
reparierten Wetterabruf. Es verändert weder App-Konfiguration noch Browser-History.

Die Ideen entstanden unabhängig von unseren Aktivitätsbeispielen: Marzipan in
Lübeck, Krabbenessen in Büsum, Puppenkiste in Augsburg. Die qualitativen Grenzen
sind dennoch deutlich: dreimal Mark als guter Freund, zweimal Essen und zweimal
eine Dokumentation als Auslöser. Der zweite Entwurf wertet süß versus herzhaft als
Abwechslung; der dritte spricht von vergangenen kulinarischen Ausflügen. Die
History wächst technisch korrekt 0 → 1 → 2; alle drei Memory-Einträge werden
gespeichert. Inhaltlich wirkt sie teilweise als fortgesetzte gemeinsame Biografie,
obwohl lediglich frühere generierte Alternativen vorliegen. Das ist ein konkreter
Hinweis auf eine unklare Bedeutung des History-Kontexts, kein Beweis, dass Memory
grundsätzlich nutzlos ist. Zwei der drei `distinctivePhrase`-Felder sind zudem keine
wörtlichen Auszüge des Writer-Texts.

Der knappere Ortskontext verhindert auch keine unbelegten Details: benannte Lokale,
Theater, konkrete Fahrzeiten und eine heutige Vorstellung entstehen aus Modellwissen
oder Fiktion, nicht aus den zwei Quellensätzen. Die Prüfung einer gültigen Stadt-ID
garantiert diese feineren Aussagen nicht. Enzyklopädische Einleitungen enthalten
außerdem Aussprache- und Verwaltungsinformationen statt ausschließlich nützlicher
Geografie. Die Kontextauswahl ist also kleiner, aber damit noch nicht besser.

**Entscheidung:** nicht produktiv übernehmen. Keine zusätzlichen kostenpflichtigen
Durchläufe zum Schönrechnen. Als nächste Hypothese frühere Entwürfe ausdrücklich als
Vergleichsalternativen kennzeichnen, getrennt von tatsächlich geflogenen Episoden;
History nicht unbeabsichtigt als Fortsetzungsvorgabe vermitteln. Zusätzlich die
geografische Kontextqualität verbessern. Keine Einzelfallverbote für Namen,
Dokumentationen oder Speisen und keine feste Aktivitätsrotation daraus ableiten.
Die Präzisierung der Entwurfshistory wurde anschließend in V6.2.2 aufgenommen
(Abschnitt 10); eine andere geografische Kontextauswahl bleibt offen.

Die historischen drei Vergleichstexte haben andere Ziele und History-Stände und
sind kein kontrollierter A/B-Test. Der Versuch belegt eigenständige Ortsassoziationen
und funktionierende Memory-Übergabe, aber keinen Vielfaltsgewinn.
Alle drei unveränderten Briefings stehen lokal in
`analysis/private-descriptive-context-v1-briefings.md`, Quellen und Rohantworten in
den zugehörigen `*-sources.json` und `*-live.json`, die Auswertung in `*-review.json`.

```sh
node tools/private-descriptive-context-probe.mjs --prepare # eine Ortsabfrage, danach Cache
node tools/private-descriptive-context-probe.mjs --preview # keine Netzwerk-/KI-Aufrufe
node tools/private-descriptive-context-probe.mjs --run     # höchstens sechs KI-Aufrufe
```

## 10. Gemeinsame Absichten: V6.2.2

Nach Nutzerfeedback wurde eine reine Promptvariante getrennt vom Produktionsmodul
in `tools/private-shared-intent-experiment.cjs` erstellt. Sie präzisiert den Piloten
als Person mit eigenen Wünschen, lässt den Ursprung der Idee offen und benennt
History als frühere Entwürfe statt nachgewiesener gemeinsamer Vergangenheit.
Die Writer-Anweisung erhält die Wünsche beider Personen; `relationshipDynamic`
soll auch die Initiative beschreiben. Keine neuen Schemafelder, Aktivitätsbeispiele,
Namenssperren oder feste Rotation. Die bisherigen Stil-, Wetter- und Formatvorgaben
bleiben erhalten. Tatsächlich geflogene Missionen dürfen künftig Rückbezüge tragen,
brauchen aber einen gesondert belegten Abschluss. Diese Anbindung ist nicht umgesetzt.

`tools/private-shared-intent-probe.mjs` verwendete fünf Requests ohne neue Quellen:
zwei komplette Lübeck-/Büsum-Durchläufe auf den bisherigen Ortsdaten, danach einen
Writer-Replay der früher gut bewerteten Freiburg-Idee mit unveränderten Fixtures.
API-Nutzung: 11.357 Eingabe- plus 3.298 Ausgabetokens, insgesamt 14.655.
Die getesteten Prompts und alle Antworten stehen in
`analysis/private-shared-intent-v6-2-2-live.json`; unveränderte Briefings und
Auswertung in `analysis/private-shared-intent-v6-2-2-briefings.md`.

Der Pilot erhält in beiden neuen Ideen eigene Interessen; es entstehen zwei
verschiedene Begleiter. Den Impuls gibt weiterhin jeweils die Begleitung. Die
kleine Serie zeigt damit eine teilweise Verbesserung, aber keine nachgewiesene
Variation der Initiative. Die alte Freiburg-Idee enthält bereits einen Widerspruch:
`personalReason` bezeichnet Paul als Ortskenner, `pilotIntent` den Piloten. Ein
Writer kann solche Grundlagen nicht zuverlässig durch Stilvorgaben bereinigen.
Auch unbelegte Logistik und eine unpassende Flugformulierung bei fehlendem Wetter
bleiben in den neuen Ausgaben sichtbar.

**Entscheidung nach gemeinsamer Bewertung:** Die Texte sind eine spürbare
Verbesserung und werden als Entwicklungsrichtung übernommen. Zweimal Initiative
durch die Begleitung ist in dieser kleinen Stichprobe kein Ablehnungsgrund;
eine feste Rotation wäre kein Qualitätsziel. Die ursprüngliche strengere Bewertung
im lokalen Versuchsbericht bleibt als historische Auswertung erhalten.

Nach Freigabe wurde V6.2.2 im lokalen Produktionspfad integriert. Zusätzlich zu
den getesteten Promptänderungen erhält der Writer jetzt das bestehende
`episode.sharedIntent` als `IDEE.sharedIntent`. Dieser gemeinsame Wunsch verbindet
die individuellen Absichten in `pilotIntent` und `companionIntent` mit Anlass und
Vorhaben. Der Writer soll diesen Zusammenhang erzählen und den Ursprung der Idee
bewahren. `episode.situation` und die Originalitätsbewertung bleiben beim Planner.
Es entstehen weder zusätzliche Pflichtfelder noch eine weitere Modellstufe.

Die History beschreibt ausdrücklich generierte Alternativen; die KI fasst in
`relationshipDynamic` Initiative und eigene Interessen zusammen, soweit sie in der
fertigen Geschichte tatsächlich erzählt werden. Speicherformat, lokale Begrenzung
und V5-Referenz bleiben erhalten. Tatsächlich geflogene Vergangenheit ist weiterhin
nicht angebunden. Vorhandene Erinnerungen werden nicht rückwirkend neu geschrieben.

22 lokale Regressionstests bestehen. Der neue Test verfolgt unterschiedliche
gemeinsame Vorhaben vom Ideen-JSON durch die echte App-Funktion bis zum
Writer-Prompt und kompakten Speicherformat; beide individuellen Absichten bleiben
erhalten. Das belegt die Datenübergabe, keine garantiert widerspruchsfreie Prosa.
Die zusätzliche Übergabe von `sharedIntent` wurde bewusst ohne weitere bezahlte
KI-Aufrufe umgesetzt und noch nicht als neue Textserie bewertet. Die ursprünglichen
fünf Modellaufrufe testeten die Promptvariante vor dieser Ergänzung.

Der alte Probe-Runner zeigt ohne `--run` die aktuelle Revision an; bezahlte Aufrufe
des abgeschlossenen Kandidatenversuchs sind nach Integration gesperrt, damit alte
und neue Ergebnisse nicht unter derselben Kennung vermischt werden.
Release: V6.2.2 mit App-Cache `ga-dispatcher-v1759` auf `origin/main`.


## 11. V6.3 – Drei geplante Privatmissionen zur Auswahl

Der V6-Picker erzeugt die privaten Angebote nicht mehr aus den lokalen
Szenariolisten. Die bestehende Flugplatzsuche liefert drei konkrete Ziele innerhalb
ihrer bisherigen Suchregeln. Für jedes Ziel wird parallel der begrenzte
`MissionPrivateContextCore` benutzt: bis acht Ortsbelege, 50 km Radius,
drei Sekunden Abrufbudget und vorhandener Cache. Die KI entscheidet innerhalb
dieser drei Zielrahmen über die Unternehmungen, nicht über neue Flugplatzkoordinaten.
Ein Ausflug kann ebenso aus einem menschlichen Wunsch wie aus Ortskontext entstehen.

`proposalPrompt` verwendet dieselben Ideenregeln wie die direkte Generierung und
übergibt die History einmal für das gesamte Angebot. Die Antwort ist ein
JSON-Objekt mit genau drei Einträgen in `proposals`; jeder Eintrag besitzt
`candidateId`, `title` und den vollständigen privaten Ideenvertrag. `proposals()`
prüft eindeutige Ziel-IDs und validiert jede Idee gegen ihre eigenen Ortsfakten.
Unvollständige oder ungültige Antworten erzeugen eine sichtbare Fehlermeldung,
keinen heimlichen Rückfall auf die alten Auswahlkarten und keinen Reparaturaufruf.

Die Karte zeigt Titel, `occasion`, Begleitung, Gepäck und Distanz. Ein flüchtiger
`private-proposal.v1`-Snapshot hält die Idee, Zielkoordinaten, den ursprünglichen
Startbezug, die begrenzten Ortsbelege mit ihren IDs und den Planner-History-Zähler.
Er enthält keine History-Texte. Nach Auswahl übernimmt der V4-Rahmen diesen
Snapshot; der Writer verwendet die erneut validierte Idee direkt. Es gibt keinen
weiteren privaten Ideenaufruf. Ortsbelege werden wiederverwendet, damit die Auswahl
weder durch eine andere Trefferreihenfolge noch einen erneuten Abruffehler driftet.
Route und Wetter werden dagegen aus dem aktuellen Dispatch übernommen.

Eine geänderte Start-/Zielzuordnung, ein ungültiger Ideenvertrag oder eine nicht
mehr passende Writer-/Pipeline-Konfiguration stoppt die Auswahl. Der ungewählte
Rest verschwindet mit dem Pending-Picker. Erst das fertige ausgewählte Briefing
trägt seine Writer-Erinnerung zum bestehenden lokalen Gedächtnis bei. Der temporäre
Snapshot wird danach aus dem Contract entfernt; die fertige Mission enthält wie
bisher ihre eine `privateOuting`-Idee. Es gibt keinen neuen Cloud-History-Speicher.

Kostenmodell: ein gemeinsamer Ideenaufruf für drei Ziele und nach Auswahl ein
Writer-Aufruf. Die drei Ideen benötigen mehr Ein-/Ausgabetokens als eine einzelne
Idee, aber keine drei vollständigen Briefings. Der bisherige technische V4-Planner,
Geo-/Wetterabrufe und bestehende Provider-Fallbacks gehören weiterhin zum gesamten
Dispatch; die Zwei-Aufruf-Angabe beschreibt nur den privaten Erzählpfad. Der
Batch-Aufruf hat 40 Sekunden Timeout je bestehendem Provider-Versuch. V5 sowie
ausgeschaltete KI verwenden weiterhin ihre bisherigen Pickerpfade.

Zusätzlich beschreibt V6.3 den Piloten ausdrücklich als Spieler ohne mitgelieferten
Namen. Seine eigenen Wünsche werden zuerst als Teil des gemeinsamen Ausflugs
entwickelt, unabhängig von seiner Aufgabe am Steuer. Die Begleitung bleibt eine
fiktive Person. Wiederkehrende Initiative-/Beziehungsmuster werden der History
zugeordnet, ohne feste Quoten oder einen Aktivitätenkatalog.

Der Hahnweide-Bericht zeigte außerdem einen reproduzierten Altfehler:
`classifyAptMissionCategory` fand `kunde` in `erkundet` und löste die
Charter-Personalisierung aus. Strukturierte `private-outing.v1`-Missionen mit
`taskDomain=private_outing` werden nun vor dieser Textprüfung als privat erkannt;
auch die Charter-Personalisierung respektiert diesen Vertrag. Die bisherigen
Regex-Regeln für andere Missionen wurden bewusst nicht geändert.

Diagnose: `Privat-Ideenquelle` unterscheidet `private-picker` und `private-planner`.
Der Planner-History-Zähler beschreibt den Zeitpunkt der Ideenplanung;
`Privat-Writer-History` beschreibt den späteren Writer-Aufruf. Die Werte können
sich unterscheiden, wenn zwischen Angebot und Auswahl andere Entwürfe entstehen.

Validierung:

- 40 Tests erfolgreich: Picker/App-Übergabe, genau ein Batch plus ein Writer,
  Original-Fakten-IDs trotz neuem Kontext, frische Flugwerte, keine History-Schreib-
  operation für Angebote, stale Auswahl, ungültige Batches, V5, private Klassifikation,
  Region und bestehender Wetterpfad.
- Zwei erzwungene APT/private_outing-V4-Dryruns mit Stub-Antworten prüfen den
  direkten Dispatch und den kompletten Picker-Ablauf. `--private-picker` rendert
  drei Karten, wählt über `acceptMissionProposalChoice` die zweite, wartet den
  Dispatch ab und prüft erhaltene Idee/Ziel, private Passenger-Rolle sowie genau
  einen zusätzlichen Memory-Eintrag. Der Promptverlauf enthält `private-picker`,
  technischen V4-Planner und `private-writer`, keinen erneuten `private-idea`-Aufruf.
  Der vollständige Test fand einen Zugriff auf den noch nicht initialisierten
  KI-Schalter; dessen Initialisierung liegt nun vor dem Picker. Diese Nachweise
  betreffen den App-Ablauf, nicht die Qualität synthetischer Texte.
- Ein einziger Live-Gemini-Aufruf erzeugte drei gültige Auswahlideen für EDTW,
  EDTF und EDSH mit jeweils acht produktiv ausgewählten Ortsbelegen. 5.633 Eingabe-
  plus 1.931 Ausgabetokens = 7.564, 10,9 Sekunden Modellzeit. Zwei Ideen tragen
  gemeinsame Wünsche, eine ausdrücklich den Wunsch der Begleitung. Alle drei
  Piloteninteressen beziehen sich auf den Ausflug selbst. Kein zusätzlicher Writer-
  oder Reparaturaufruf für den Test.

Der Live-Test verwendete leere History. Ein erster Testversuch mit lokalen früheren
Erinnerungen wurde vor Ausführung durch die automatische Freigabeprüfung abgelehnt;
die ausgeführte Variante sendete ausschließlich öffentliche Flugplatz-/Ortsdaten.
Die technische History-Übergabe ist mit lokalen Fixtures geprüft, eine neue längere
Live-Serie zur History-Wirkung steht aus.

Unveränderte Auswahltexte und Einordnung:
`analysis/private-picker-v6-3-texts.md`, Rohdaten:
`analysis/private-picker-v6-3-live.json` (lokale Testartefakte).
Der Live-Test beweist keine perfekte Semantik: mildes Wetter im ersten Angebot,
bereitgestellte Mietwagen/Leihräder und optimistische Anschlusswege bleiben
unbelegte Ausschmückungen. Das sind offene Qualitätsbefunde, keine neuen
Verbotsregeln. Die drei Picker-Ideen wurden nicht als vollständige Briefings getestet.
Release: V6.3 / Private Return V1, App-Cache `ga-dispatcher-v1760`, Tracker Alpha v404.


Picker-Durchlauf ohne externe KI-Aufrufe:

```sh
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=1 --profile=private_outing --base=apt --category=private --private-picker --out=private-picker-v6-3-selection-dryrun.json
```

Der zusätzliche Picker-Dryrun-Modus erlaubt absichtlich kein `--live-gemini`.
Der separate Live-Probe begrenzt sich auf genau einen Batch und überträgt keine
lokalen History-Inhalte. Er ist kein Last-, Geräte- oder Simulator-Test.

## 12. Private Heimreise als Fortsetzung

Die zuvor skizzierte Erweiterung wurde nach Freigabe als eigenes internes Profil
`private_return`, Task-Domain und Follow-up-Typ umgesetzt. Verbindlicher
Umsetzungsstand, Datenvertrag, Vergleich mit Bush Return und Testnachweise:
[Mission Private Return V1](Mission%20Private%20Return%20V1.md).

Der erfolgreiche Hinflug eröffnet ein optionales Rückflugangebot. Die ausgewählte
Heimreise erzählt vom gemeinsamen Aufenthalt und bereitet den nächsten A–B-Flug
vor. Ein einmal erzeugter strukturierter Erlebnisrückblick verbindet Briefing
und Voice. Die Entwurfshistory wird dadurch nicht zur erfundenen Flugchronik.

Die private Fortsetzung verwendet normale APT-Trigger und bestehende Runtime-Gates.
Bush-Pickup-spezifische Abflugtrigger werden nicht auf ein normales Boarding
übertragen. Das begrenzt die Erweiterung auf ihren eigenen fachlichen Vertrag
und verhindert parallele Ansagen beziehungsweise einen versteckten Return-Leg.

## 13. Auslöser und History-Nutzung in V6.3.1 (lokal)

Wiederkehrende Geschichten „Begleitung entdeckt etwas, Pilot lässt sich
anstecken“ können trotz mitgelieferter History entstehen. Ein History-Zähler
beweist Datenübergabe, nicht deren ausreichende Berücksichtigung. V6.3.1 bewahrt
deshalb Ursprung und Initiative als kompakte Vertragsdaten und gibt dem Writer
einen ausdrücklichen Vergleichsauftrag für den erzählerischen Aufbau. Die
Originalphrase früherer Texte wird zum Wiedererkennen mitgegeben, nicht zum
Nachahmen. [Details](Mission%20Episode%20Writer%20V6.md).

Beurteilungen trennen ab jetzt: gespeicherte Entwürfe, im konkreten Prompt
verfügbare History und tatsächlich erzielte Vielfalt. Die lokale History kennt
weiterhin keine Testserien anderer Geräte. Kein pauschales Verbot einer Person,
Aktivität oder Formulierung; keine zusätzlichen Regenerierungsschleifen.

### Training: verbindlicher Plan vor freier Erzählung

Der Training Writer V1 erhält vor der Textgenerierung den tatsächlich gewählten Instruktor, dessen Geschlecht, den strukturierten Trainingsplan einschließlich Pflichtanzahl und optionaler Übungen sowie das Trainingsgepäck. Diese Daten bilden die Grundlage der freien Vorfluggeschichte; es werden keine thematischen Beispielgeschichten vorgegeben. APT endet am Zielflugplatz, POI-Training kehrt nach den Übungen zum Start zurück. Eine übernommene Charter-Motivation, fremde Payload-Pflichten oder Termindruck gehören nicht in den Trainingsrahmen.

Die akzeptierte Geschichte, Begrüßung, Person und der Plan bleiben bei der abschließenden Aufbereitung erhalten (`training-narrative.v1`). Die Aufbereitung darf keine zweite Person wählen oder durch erneute zufällige Plansanitisierung zusätzliche Übungen hinzufügen. Der lokale Text bleibt ausschließlich für den Pfad ohne KI bestehen und berücksichtigt das Instruktor-Geschlecht. Wetter wird über den vorhandenen strukturierten Wetterkontext und dessen Referenzen geschrieben; bei fehlendem gültigen Wetterabsatz greift die gemeinsame datenbasierte Darstellung. Ungültige KI-Ausgaben werden einmal zur Formatkorrektur zurückgegeben, anschließend wird der Fehler sichtbar statt durch einen Standardtext verdeckt.

Übungsauslösung, Auswertung, freiwillige Zusatzübungen und Tracker Authority bleiben in ihren vorhandenen Runtime-Bausteinen. Die Geschichte übernimmt keine Ablaufsteuerung. Regression: `tools/mission-training-narrative.test.cjs` sowie `ga-tracker-client/tracker-mission-apt-training-integration.test.js`.

#### Korrektur der Übungsgrundlage (30.09.2026)

Neue APT- und POI-Trainingsmissionen erhalten vor dem Writer ein explizites `ga.trainingRecipe.v1` am Passagier und im Vertrag. Die Auswahl umfasst ausschließlich die implementierten Verfahren: Vollkreis mit 30/45 Grad, 180-Grad-Wende, 500-ft-Steigflug mit anschließendem Halten und Stall-Recovery. Zwei Übungen sind Pflicht, zwei weitere freiwillig; die Reihenfolge des Rezepts ist verbindlich. Ein vorhandenes explizites Rezept bleibt erhalten. Der lesbare `trainingPlan` wird aus den Rezeptlabels abgeleitet, nicht anschließend wieder per Stichwortsuche in andere Übungen übersetzt.

Der Writer erhält Pflichtübungen und freiwillige Übungen getrennt, außerdem das Höhengate über Grund und den manuellen Start nach Einweisung/Stabilisierung. Platzrunden-, Notverfahren- und Konfigurationsaufgaben aus dem bisherigen breiteren Textpool werden bei neuen Missionen nicht mehr als bewertete Übungen versprochen. Anflug und Landung bleiben Teil des Flugabschlusses. Bereits gespeicherte Legacy-Missionen werden nicht nachträglich umgeschrieben; deren alte Freitextübersetzung bleibt kompatibel.

POI-Training ist seit Alpha v442 unter Tracker Authority migriert, APT besitzt ebenfalls einen eigenen Anschluss. Beide Seeds übernehmen das explizite Rezept aus der vorhandenen Prozedur. Für diese Korrektur ist keine neue Tracker-Auswertelogik notwendig. Automatischer Nachweis: Narrative-/Rezepttests, App-Seed-Test sowie APT- und POI-Authority-Integration mit echtem Kindprozess. Realer MSFS-Flug und echte KI-Probetexte bleiben separate Prüfungen.

#### Training Writer V2: Ton und eigene Texthistory

Der Trainingswriter beschreibt kontrollierte Manöver, Einweisung und Rückmeldung statt künstlicher Spannung. Benannte Übungsarten bleiben an das ausführbare Rezept gebunden; insbesondere umfasst Stall die Recovery. Der konkrete Lernschwerpunkt trägt den Titel. Instruktor-Kontext enthält Person, Rolle, Geschlecht und Persönlichkeit, keine alten Begrüßungs- oder Storybausteine.

`ga_training_narrative_history_v1` speichert höchstens acht akzeptierte KI-Texte mit Titel, gekürzter Geschichte, Begrüßung und Übungslabels. Der Writer vergleicht damit seine eigenen früheren Titel, Einstiege und Erzählbewegungen. Diese Entwürfe sind keine erlebten Flüge und keine neuen fachlichen Vorgaben. Es gibt keine Themenbeispiele oder feste Textrotation. Defekter oder voller lokaler Speicher darf eine gültige Mission nicht verwerfen. Diese lokale Stilhistory ist unabhängig vom verlustfrei übertragenen Missions-/Trainingsrezept; Cloud-Synchronisation der Stilhistory ist hier nicht hinzugefügt.

#### Training Writer V3: präzise Alltagssprache und Reihenfolge

Der Writer erhält im lesbaren Trainingsplan nur Modus, Fokus und Pflichtanzahl; der statische `instructorLine` wird nicht mehr als Erzählkontext geliefert. Er hatte in der Liveprobe die Begrüßung auf einen mechanischen Ablauftext festgelegt. Die Begrüßung soll stattdessen kurz die Person und den heutigen Lernschwerpunkt vermitteln. Der technische Ablauf bleibt im Briefing und im unveränderten Rezept.

Pflichtübungen und benannte freiwillige Übungen folgen jeweils ihrer Rezeptreihenfolge. Beschrieben werden kontrollierte Manöver, Fluglage und Steuereingaben in vertrauter Cockpitsprache; der Lernzweck ist das sichere Erkennen und Beherrschen der Flugzustände. Es werden keine nachträglichen Textbausteine oder Wortersetzungen über die KI-Prosa gelegt. V3 ist lokal getestet; die vorausgegangenen vier Gemini-Proben in `analysis/training-narrative-live-20260930-v4-two.json` stammen noch aus Writer V2 und sind kein Live-Nachweis für V3.

#### Training Writer V4: fachliches Instruktorbriefing

Das Briefing spricht auf Nutzerwunsch aus Sicht des Fluglehrers (Ich/Wir, Pilot mit du). 150–220 Wörter erläutern Lernziel, Vorbereitung und ein bis zwei Durchführungshinweise je tatsächlicher Pflichtübung. Freiwillige Übungen bleiben kurz und eindeutig freiwillig. Die Wissensgrundlage `trainingBriefingKnowledge` wird vor dem Writer aus dem ausführbaren Rezept gebildet, einschließlich der normalisierten Vollkreis-Typen und ihrer Querneigung. Es sind Fachinformationen, keine Geschichten oder thematischen Beispiele; die KI formuliert frei und erhält weiterhin ihre eigene Texthistory.

Ein bis zwei allgemeine Praxistipps werden aus einem geprüften kleinen Faktenbestand gewählt: Außenbeobachtung, VFR-Mindesthöhen, Wolkenabstände und ATC-Readback. Rechtsregeln bleiben ausdrücklich auf Deutschland/EASA und den jeweiligen Höhen-/Luftraumkontext bezogen; außerhalb dieses Bereichs darf der Writer sie nur als EASA-Lernstoff darstellen. Unbekannte Luftraumklasse/Freigabe nicht erfinden. Das technische AGL-Bereitschaftsgate ist weder gesetzliche Mindesthöhe noch ausreichend nachgewiesene Übungshöhe. Typbezogene Verfahren, Geschwindigkeiten und Leistungswerte gehören ins Flughandbuch und werden nicht erfunden.

Quellenprüfung 30.09.2026: [SERA, Revision August 2025](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-standardised-european?erules-id=ERULES-1963177438-9807), SERA.5001/5005(f)/3105 und GM1 SERA.3201; [SERA.8015(e)](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-standardised-european?erules-id=ERULES-1963177438-9888); [PPL(A)-Ausbildungsleitfaden AMC1 FCL.210, Übungen 7/9/10b/15](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-aircrew-regulation-eu-no?kw=ppl&page=5), Revision August 2023 als didaktische Referenz. Quellen und Prüfdatum bleiben mit `_trainingNarrative.knowledge` im Missionsentwurf erhalten. Der Faktenbestand braucht bei Regeländerungen erneute fachliche Prüfung; kein laufender Rechercheabruf pro Mission.

Dieser Schritt ändert ausschließlich den Briefingwriter. Neue Inflight-Praxisfragen, freie Tipp-Events und Multiple Choice sind noch nicht angeschlossen. Nächster Schritt auf Nutzerwunsch: optionale Fragen mit strukturierten Antworten/Erklärung, separatem Zustand und Tracker-Authority-Intent, Wiederaufnahme und Gerätewechsel; ohne Einfluss auf den Missionsabschluss. Vor UI-Umsetzung App/PAX und Tracker/EFB gemeinsam prüfen, keine Fragen-State-Machine im Voice-Layer.

#### Training Writer V5: Praxiswissen und Themenhistory

Für 45-Grad-Vollkreise ergänzt der Faktenrahmen den Zusammenhang zwischen notwendigem Gesamtauftrieb, induziertem Widerstand und bedarfsabhängiger Leistungsanpassung; beim Ausleiten wird die Leistung wieder angepasst. Grundlage: [FAA Airplane Flying Handbook, Kapitel 10, Steep Turns, Seiten 10-2/10-3](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/11_afh_ch10.pdf), geprüft 30.09.2026. FAA-Inhalte dienen ausschließlich der Manöverlehre, nicht als deutsche Rechtsgrundlage. Keine universelle Drehzahl, Trimmanweisung oder Geschwindigkeit aus dem Handbuch übernehmen.

Der Writer meldet ein bis zwei verwendete allgemeine Tipps als `practiceFactIds`; unbekannte oder doppelte IDs werden nicht akzeptiert. IDs werden zusammen mit dem Quellenrahmen an `_trainingNarrative` gespeichert und in die vorhandene lokale Stilhistory übernommen. Dadurch sind behandelte Tipps unabhängig von gekürzten Geschichten erkennbar. Bei gleicher Eignung soll der Writer weniger kürzlich verwendete Themen bevorzugen, ohne starre Rotation oder Verbot fachlich notwendiger Wiederholungen. History bleibt lokal und auf acht Entwürfe begrenzt, keine neue geräteübergreifende History-Synchronisation.

Freiwillige Übungen ausdrücklich nur auf Wunsch beschreiben; sichtbares Briefing spricht von ausreichender Übungshöhe und Sicherheitsreserve statt Höhengate. Rechtsfakten mit Bedingungen erklären. Der Formatcheck bestätigt IDs, nicht die fachliche Vollständigkeit jedes frei generierten Satzes: neue Liveproben bleiben erforderlich.

#### Training Writer V6: verteilter Manöverhinweis

Ein fliegerischer Hinweis steht im Briefing; je Übung schreibt die KI einen ergänzenden Hinweis in `maneuverTips[{exerciseId,text}]` (20–600 Zeichen). Die IDs müssen jede Rezeptübung genau einmal abdecken. Der Writer nutzt weiterhin die geprüfte Manövergrundlage, keine zusätzlichen Aufgaben oder Sollwerte. Die Aufbereitung speichert `inflightTip` direkt an der Übung. Normalisierung, JSON-Missionstransport und Tracker-Seed behalten das Feld; alte Rezepte ohne Feld bleiben unverändert.

Standalone erzeugt bei `exercise_instruction` das Hinweisfeld und liest es zusammen mit der Einweisung vor. Eine vorhandene statische Audiodatei darf diesen Zusatz nicht ersetzen. Der Tracker-Coachingpfad ergänzt seine Einweisung einschließlich Wiederholungsansage aus demselben Rezeptfeld. Kein eigener Trigger oder Erfolgszustand: der Hinweis erklärt und ändert keine Auswertung. Die semantische Verschiedenheit der beiden KI-Hinweise bleibt ein Liveprüfpunkt. Tracker-Veröffentlichung benötigt einen neuen Build für die geänderten importierten Coaching-/Core-Module; aktuell nur lokal umgesetzt.

#### Training Writer V7: Fachanker und konkrete Korrekturrückmeldung

Die Liveprobe V6 zeigte fehlende freiwillige Hinweise, erfundene Zahlenwerte und allgemeine Fakten-IDs ohne ausgesprochene Tipps. V7 liefert deshalb jede Übungs-ID ausdrücklich und bindet Hinweise an die nach ID zugeordnete Fachgrundlage. Kreisführung unterscheidet wechselnden Kurs und Wiedererreichen des Ausgangskurses; Höhe/Anstellwinkel und Leistung/Widerstand werden getrennt erklärt. Höhenwechsel verwenden keinen pauschalen festen Abfangvorlauf. Stallwissen beschreibt ausdrücklich den vollständig entwickelten Stall des Simulatorrezepts, anschließend Recovery; Unsicherheit erlaubt Abbruch.

`practiceTips[{factId,text}]` enthält die tatsächlich formulierten allgemeinen Tipps. Akzeptierte KI-Texte werden als eigener Absatz ins Briefing aufgenommen, zusammen mit der Geschichte in die Texthistory geschrieben; keine nachträglichen festen Fachtextbausteine. `trainingNarrativeIssues` benennt fehlende Übungs-IDs, Textlängen und ungedeckte numerische Technikangaben in Manöverhinweisen sowie fehlende allgemeine Tipptexte. Eine vorhandene begrenzte Korrekturanfrage erhält diese konkreten Fehler. Zahlen in Manöverhinweisen dürfen nur die vorgegebene Querneigung oder den Höhenwechsel wiedergeben. Der Check ist kein semantischer Beweis: ausgeschriebene erfundene Zahlen oder falsch paraphrasierte Fachzusammenhänge erfordern weiter Liveprüfung.

Bei neuen Standalone-Stallhinweisen ersetzt eine klare vollständige Stall-Einweisung den alten Satz „nicht vorzeitig nachdruecken“; vorhandene alte Rezepte behalten ihren bisherigen Clip. Tracker-Coaching erklärt weiterhin denselben Break-/Recovery-Ablauf. Keine Änderung an Detector, Toleranzen oder Erfolgskriterien.

#### Training Writer V8: Erzählung und Fachhinweise getrennt

`fetchTrainingNarrative` erzeugt zunächst ausschließlich Titel, Trainingsrahmen (100–150 Wörter), Begrüßung und strukturierten Wetter-/Routenabsatz. Dieser Prompt erhält Person, Übungslabels, Reihenfolge, Gepäck, Abschluss und eigene Texthistory; keine Fachwissenssammlung oder Fachhinweis-Ausgabefelder.

Erst nach einem gültigen Erzähltext ruft `fetchTrainingCoaching` den Fachwriter auf (`training-coaching-v1`). Er erhält den fertigen Text, die nach Übungs-ID zugeordneten Quelleninformationen, alle Pflicht-/Optional-IDs und die bisher verwendeten Tipp-Themen. Vier eigenständige Ausgabearten: ein `briefingTip` zu einer Pflichtübung, `maneuverTips` für jede Übung, ausgewählte `practiceFactIds` und dazu tatsächlich formulierte `practiceTips`. Das Briefing wird aus diesen KI-verfassten Absätzen und dem Wettertext zusammengesetzt, nicht nochmals frei regeneriert.

Jeder Schritt besitzt genau eine begrenzte Korrekturanfrage. Ein Fachfehler regeneriert ausschließlich Fachhinweise; Titel, Person, Übungsrezept und Erzählung bleiben erhalten. Erst nach Erfolg beider Schritte werden Hinweise ans Rezept und Fachmetadaten an die Mission geschrieben sowie History aktualisiert. Fehlende/ungültige Fachhinweise führen zu sichtbarem Fehler statt einer halbfertigen Mission. Der Normalfall benötigt zwei Textgenerierungen und entsprechend zusätzliche Laufzeit/Kosten. Die vorhandene Wetterdarstellung, Cloud-/Seed-Übertragung und Tracker-/Standalone-Einweisung bleiben bestehen.

Korrektur zur Bewertung der V7-Probe: weicher werdendes Steuergefühl bei geringer Fahrt ist ein fachlich sinnvoller Hinweis, kein erfundenes Symptom. [FAA Airplane Flying Handbook, Kapitel 5, Seite 5-9](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/06_afh_ch5.pdf), geprüft 30.09.2026, beschreibt nachlassende Steuerwirkung bei geringer Anströmung und das mögliche „mushy“-Gefühl. Wissensgrundlage ergänzt: mögliche Wahrnehmung, nicht universelle Vorhersage der Steuerkräfte, die auch von Trimmung, Flugzeug und Konfiguration abhängen. Daraus folgt keine automatische frühe Recovery eines vollständig entwickelten Simulator-Stallrezepts.

Regressionen prüfen getrennte Datenbasis und Aufrufe, Fachkorrektur ohne erneute Erzählgenerierung, erhaltene Übungs-/Voice-Hinweise und keine History-Speicherung bei dauerhaft fehlerhaftem Fachschritt. V8 ist lokal geprüft; noch keine neue Gemini-Liveprobe oder Veröffentlichung.

#### Diagnose der APT-Liveproben V6/V7

Das ad-hoc Testskript verwendete striktes `JSON.parse` statt `_missionParseJsonTextDetailed`. Zwei APT-Antworten enthielten hinter einem vollständig geschlossenen Objekt eine zusätzliche Klammer; der vorhandene App-Parser liest das ausgewogene Objekt erfolgreich (`balanced_object`). Der im Probebericht sichtbare sofortige Parse-Abbruch war deshalb kein Nachweis eines identischen App-Abbruchs. Es wurden außerdem andere Generationseinstellungen benutzt (low thinking und 4000 Output-Tokens). V8-Probe nutzt App-JSON-Parser und deren Generationseinstellung `response_mime_type: application/json`. Zentrale Parserlogik wurde nicht geändert.

Echte Formatfehler blieben: V6 lieferte zwei statt vier Manöverhinweise; V7 lieferte `practiceTips` als Textliste oder einzelnen Text statt `{factId,text}`-Objekten, auch nach Korrektur. Das ist kein Beleg einer APT-spezifischen Runtime-Ursache; das gemeinsame, überladene Writerschema und seine Modellantworten waren betroffen. Die getrennten Prompts V8 adressieren dies; künftige Ergebnisse mit identischer Testbasis prüfen.

#### Ausführlichere fachliche Hinweise (30.09.2026)

`training-coaching-v2` gibt den Tipps mehr Erklärraum: der Briefinghinweis vertieft einen Schwerpunkt in ungefähr drei bis vier Sätzen (maximal 750 Zeichen), der ergänzende Manöverhinweis in der Luft in ungefähr zwei bis drei Sätzen (maximal 600 Zeichen). Zusammenhang, Beobachtung und konkrete Durchführungshilfe sollen verständlich zusammenhängen; die Satzanzahl darf nicht zu Fülltext oder neuen unbelegten Details führen. Allgemeine Praxistipps dürfen bis 1000 Zeichen nutzen, damit Bedingungen und Ausnahmen nicht der Kürze geopfert werden. Briefing und Inflight-Hinweis behandeln unterschiedliche Aspekte derselben Übung. Procedure-Event, App-Voice und Tracker-Coaching behalten bis zu 600 Zeichen des gespeicherten Inflight-Hinweises. Die vorhandene fachliche Wissensbasis und die Aufgaben bleiben unverändert.

#### Fachkontext und Rollen nach Liveprobe V9

Narrative V9 liefert `crewResponsibilities` explizit: Der Pilot fliegt und stabilisiert, der Instruktor erklärt, beobachtet und gibt Rückmeldung. Coaching V3 vertieft genau einen allgemeinen Praxistipp, zusätzlich zu den Manöverhinweisen. Rechtsfakten enthalten einzeln benannte `essentialPoints` mit Geltung, Bedingungen und Ausnahmen. Diese sind fachliche Datenanker, keine festen Texte oder Szenarien. Die Wende endet im Horizontalflug auf Gegenkurs; Lookout gewährleistet keine ATC-Staffelung. Die Längenprüfung ersetzt weiterhin keine fachliche Prüfung der erzeugten Texte.

Liveprobe V10: Beide Modi direktes JSON ohne Korrektur; Pilotrollen und vollständige ausgewählte Mindesthöhen-/Wolkenabstandsbedingungen korrekt. Einzelne Manöverdetails wurden dennoch aus anderen Manöverinformationen oder Modellwissen ergänzt. Der Fachprompt ordnet deshalb jede Erklärung ausschließlich dem Wissenseintrag der eigenen Übungs-ID zu und erhält bedingte Beobachtungen als solche. Das ist eine Promptverbesserung, kein semantischer Qualitätsnachweis; eine erneute Liveprüfung dieser letzten Präzisierung steht aus.

#### Qualität vor der Generierung, keine automatische Fachkorrektur

Auf Nutzerentscheidung arbeitet Coaching V4 mit expliziter Quellenautorität: Mitgelieferte Dokumentauszüge/didaktische Zusammenfassungen tragen den Fachinhalt, Links allein sind kein gelesener Inhalt. Bei Wissenslücken einen anderen belegten Schwerpunkt erklären oder kürzer bleiben. Die Vollkreisgrundlage beschreibt das vorausschauende Ausrollen bis zu waagerechten Flügeln auf dem Zielkurs; die VMC-Grundlage ist keine Staffelungszusage. Die numerische Prosaheuristik wurde aus dem trainingsspezifischen Formatcheck entfernt: Sie konnte fachlich gültige Texte fälschlich beanstanden und war kein belastbarer Halluzinationsdetektor. Die begrenzte Korrekturanfrage dient nur noch Ausgabeformat, Längen, IDs und Referenzplatzhaltern. Keine automatische fachliche Umschreibung, keine semantische Prüf-KI im Produktionspfad. Fachqualität anhand von Stichproben bewerten und deren Ursachen in der Wissensbasis verbessern; verbleibende Modellfehler sind möglich und akzeptiert, die Texte sind nicht fachlich zertifiziert.

Abschließende Live-Stichprobe V12: POI und APT mit Coaching V4 direkt gültiges JSON, APT nach Wiederholung eines API-Timeouts. Rollenverteilung, Reihenfolge, freiwillige Übungen, Vollkreis-Ausrollen, Leistungsbezug und bedingte Stallmerkmale waren stimmig; die vorher beanstandeten Landungs-/Staffelungs-/Steuerübernahmeformulierungen traten nicht auf. 64 Trainingstests bestanden. Geplanter Alpha-Stand: App v1884, Tracker v456; keine reale MSFS-Audio-/Flugerprobung in dieser Stichprobe.
