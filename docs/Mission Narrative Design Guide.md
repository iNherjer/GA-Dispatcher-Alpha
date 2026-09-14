# Persönliche Missionsbriefings: Zielsetzung und Übertragung

Stand: 14.09.2026. Aktive Referenz: Privat-Planner und Episode Writer V6.2.1.
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
