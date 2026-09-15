# Missionssets: Arbeitsgrundlage und aktueller Ablauf

Stand 15.09.2026, Alpha-App v1763. Privat-Writer V6 (Promptkennung V6.3.1,
inklusive ergänzter Rückflugvorschau), Return-Writer V1.3; Tracker bleibt v404.
Dieser Einstieg bündelt den implementierten Stand und die Übertragung auf weitere
Missionssets. Er ersetzt nicht die fachlichen Contracts.

## Ziel und Promptprinzip

Die KI entwickelt eine zusammenhängende Absicht und erzählt daraus ein
persönliches Vorflugbriefing. Der Spieler versteht, warum der Flug bevorsteht,
wer dabei ist und was nach der Landung geplant ist. Bei privaten Missionen wollen
beide etwas gemeinsam unternehmen; auch der Pilot kann den Anstoß geben.
Ein kleiner alltäglicher Anlass ist ebenso vollständig wie ein besonderes Ziel.
Die sprachliche Ausführlichkeit soll sich nach dem Inhalt richten.

Prompts beschreiben diese Zusammenhänge positiv. Sie geben der KI eine Aufgabe
zum Entwickeln einer Idee, keine Liste gewünschter Aktivitäten zum Abhaken.
Konkrete Nutzerbeispiele gehören zur Diskussion und Evaluation; ihre übertragbare
Eigenschaft wird in den Prompt übernommen, nicht ihr Gegenstand als Pflichtanker.
Aus dem Wunsch nach menschlichen Anlässen folgt beispielsweise eine eigene
Absicht beider Figuren, keine vorgeschriebene Freizeitbeschäftigung.

Örtlicher Kontext ist eine unvollständige Sammlung von Möglichkeiten. Er kann
einen Anlass wecken oder zu einem unabhängig entstandenen Wunsch passen. Die
KI muss keine Sehenswürdigkeit behandeln. Beziehung, persönliche Verabredung
und Freude am gemeinsamen Flug dürfen allein tragen. Namen und Gepäck folgen
der Idee, statt die Idee aus einem vorab gewählten Gegenstand abzuleiten.

Die Ideenphase soll gedanklich mehrere unterschiedliche Anlässe betrachten und
einen wählen. Das ist eine Promptvorgabe, keine gemessene interne Suchstrategie.
Die Ausgabe enthält die Entscheidung strukturiert; es werden weder private
Denkprotokolle angefordert noch mehrere zusätzliche API-Aufrufe erzwungen.

## Ablauf und Zuständigkeiten

1. **Flugrahmen:** Die App bestimmt technisch zulässige Flugplätze/Route,
   Zieltyp, TaskDomain, Personenrahmen und verfügbare Daten. Diese bleiben
   Grundlage des Contracts. Prosa entscheidet nicht über Missionsmechanik.
2. **Orts- und Wetterkontext:** Begrenzte Quellen/Ortsbelege dienen der Idee;
   aktuelle Messwerte und Stationsbezug dienen dem Flugabsatz. Modellwissen
   allein belegt keine aktuelle Veranstaltung oder Öffnung. Für belegte
   Ereignisse ist die laufende Woche mit passendem Aufenthalt vorgesehen.
   Benannte Bodenanker werden gegen den mitgelieferten räumlichen Kontext
   geprüft; Luftlinie ist kein Nachweis von Fahrzeit.
3. **Direktgenerierung:** Ein Ideenaufruf erzeugt Anlass, konkrete Absichten,
   Initiative/Auslöser, Person, Gepäck und Bodenplan als JSON. Ein Writer-Aufruf
   formuliert genau diese Idee. Der Writer soll keinen neuen Anlass erfinden.
4. **Dreier-Picker:** Ein gemeinsamer KI-Aufruf entwickelt je eine vollständige
   Idee für drei vorbereitete Zielrahmen. Die Ideen vergleichen sich untereinander
   und mit der History. Auswahl bewahrt die strukturierte Idee; anschließend
   schreibt nur der Writer das gewählte Briefing. Kein erneutes Ziehen aus einem
   Aktivitätskatalog. Ungültige oder inzwischen unpassende Auswahl wird sichtbar
   abgelehnt, statt still eine andere Mission zu erzeugen.
5. **Writer-Ausgabe:** Titel, Story, Flug-/Wetterabsatz, Greeting, kompakte Memory
   und optional vorbereiteter `returnOfferText`. Die Story erzählt vor dem
   Hinflug. Der außenstehende Erzähler spricht den Spieler mit du und beide mit
   ihr an; nur Greeting ist direkte Rede der Begleitung. Flugwerte werden durch
   Referenzen eingesetzt. Das sichert Zahlen/Einheiten, nicht jede sprachliche
   Schlussfolgerung über Wetter oder Fliegbarkeit.
6. **Speicherung:** Die gültige Idee bleibt als `privateOuting` im Missionsvertrag.
   Ausflug, Picker-Auswahl und Writer teilen dieselbe Basis. Strukturelle
   Prüfungen sichern Contracts; optionale Erzählmetadaten sollen eine sonst
   brauchbare Mission nicht unnötig verwerfen.

## History: selbst erzeugte Vergleichsfälle statt vorgegebener Muster

Der Writer beschreibt seine fertige Ausgabe kompakt als `episode-memory.v1` im
selben JSON. Der Code muss Tätigkeit, Motivation oder Sprachmuster nicht aus dem
Briefing mittels Regex rekonstruieren. Die KI liefert damit selbst die konkreten
Vergleichsfälle für die nächste Generierung. Diese Fälle sind **keine positiven
Vorlagen zum Nachahmen**, sondern zeigen, was die Serie bereits verwendet hat.

Gespeichert werden kurze Felder für Zusammenfassung, Tätigkeit, Motivation,
Flugrolle, Beziehungsdynamik, Einstieg, Rhythmus, Schluss und markante Formulierung.
Aus der Idee kommen zusätzlich Name, Beziehung, Ziel, persönliche Absicht beider
Figuren und `origin` mit Initiative und Auslöser. Die Speicherung ist begrenzt:
`ga_private_episode_history_v1`, maximal zwölf Einträge und ungefähr 32 KiB
(UTF-16-Schätzung). Ältere strukturierte V5-History kann ergänzend gelesen werden.

Die Ideenphase sieht Anlässe, Personen und Beziehungsmuster. Der Writer sieht
insbesondere Einstieg, Rhythmus, Schluss, markante Formulierung und Initiative.
Beide sollen funktionale Wiederholung erkennen: Ein anderer Ort oder Name allein
ändert weder den Anlass noch eine immer gleiche Rollenverteilung. Der Writer
vergleicht zusätzlich die Erzählstruktur, statt nur Synonyme auszutauschen.
Es gibt keine feste Rollenquote, Themenrotation oder wachsende Verbotsliste.

Gespeichert werden generierte Missionsentwürfe mit gültiger Memory, keine bloßen
Picker-Vorschläge. Gleiche Missions-ID ersetzt den Eintrag. Das ist bewusst ein
Entwurfsgedächtnis: **generiert ist nicht geflogen**. Es darf keine gemeinsame
Flugvergangenheit der Figuren daraus entstehen. Tatsächliche Abschlussbelege
und Rückflugkontinuität sind getrennte Daten.

Die Varianzhistory liegt lokal im Browser, je Origin/Gerät. Sie ist kein eigener
Cloud-Sync-Bestand. HTTPS-Alpha, lokaler HTTP-Server und ein anderes Gerät können
unterschiedliche History haben. Aktive Verträge und Follow-up-Anfragen werden
über die vorhandene Cloud-Speicherung transportiert; das ersetzt keine komplette
Varianzhistory. Ein Cache-Update löscht diese nicht gezielt. Speicherfehler,
Browserbereinigung und Gerätewechsel bleiben mögliche Ursachen fehlender Einträge.
`History=N` belegt bereitgestellte Vergleichsfälle, nicht deren wirksame Nutzung.

## Rückflug und Voice

Ein erfolgreicher normaler Hinflug erzeugt ein optionales, sofort fälliges
`private_return`-Angebot. Abschluss, gemessener Flug, richtiger Zielort und
Bodenstillstand werden geprüft. Der separate Debug-Einstieg erzeugt eine markierte
Testfortsetzung, ohne Logbuch oder realen Flugnachweis zu erfinden. Das Angebot
nennt beide Plätze; neue Ausflüge liefern einen kurzen vorbereiteten Rückblick,
ältere Verträge verwenden einen allgemeinen Text mit Begleiternamen.

Bei Annahme schreibt ein Return-Aufruf einen gemeinsamen fiktionalen Aufenthalt
als Zusammenfassung, persönliche Reaktion und Einzelmomente sowie Briefing,
Flugabsatz und Greeting. Route, Personen und Gepäck bleiben gebunden. Ungültige
optionale Einzelmomente werden begrenzt verworfen und diagnostiziert; fehlende
Pflichtdaten oder ungültige Flugwertreferenzen bleiben ein Fehler. Das Angebot
bleibt dann verfügbar. Es gibt keine automatische Reparatur-Generierung.

Die Voice bekommt denselben Rückblick und die letzten vier lokal ausgegebenen
Texte dieser Heimreise. Sie darf plausible persönliche Details ergänzen und soll
jeweils neuen Inhalt beitragen. Die Angaben sind kein Beleg realer Ortsfakten
oder Flugereignisse. Der Wortlautpuffer ist weder persistent noch ein Nachweis
hörbarer Wiedergabe. Flugfeedback und notwendige kurze Ansagen haben Vorrang.

Private Return bleibt ein regulärer A-B-Lauf ohne Bush-Pickup-Phasen. Zusätzlich
wird einmal nach mindestens 60 Sekunden erkannter Flugphase und ab 500 ft AGL
eine kurze Aufenthaltserzählung eingereiht. Boden/Pause setzen die noch laufende
Wartezeit zurück; ausgeschaltete Stimme, Ankunft und Missionsende blockieren sie.
Die normale Queue übernimmt Epoch-/End-Lock-Schutz. v1763 korrigiert den Aufruf
im Debug-Sim-Zweig: Der übersprungene Live-Rekorder hatte die Ansage bisher
verhindert. Ein vollständiger Runtime-Reset erlaubt einen neuen Testlauf.

## Kosten und Grenzen

Direkt: Idee + Writer. Picker: ein Dreier-Ideenaufruf + Writer für die Auswahl.
Memory und Rückflugvorschau entstehen in diesen Antworten. Rückflugangebot ohne
KI, Annahme mit einem Return-Writer. Wetter, Kontextrecherche, technischer Planner
und Szenenplanung sind zusätzliche Pipelinearbeit. Voice benötigt pro Ansage
Textgenerierung und TTS; die Abfluganekdote fügt höchstens einen solchen Vorgang
je Lauf hinzu. Provider-Fallbacks können weitere Requests auslösen.

Prompts sichern keine absolute Vielfalt. Ortsauswahl kann bestimmte Ideen
begünstigen, kleine History kann Muster übersehen und ein Modell kann trotz
Vergleich ähnlich schreiben. Die begrenzte Memory kann Nuancen verlieren.
Stil und semantische Stimmigkeit brauchen daher echte Text-/Voice-Prüfung.

## Übertragung auf weitere Missionssets

- Zuerst Zieltyp, TaskDomain, Rollen, Absichten und reale Erfolgskriterien klären.
  Bestehende Runtime-/Manifest-Bausteine nutzen; Erzählen erzeugt keinen Zustand.
- Einen eigenen versionierten Ideen-/Erzählvertrag definieren. Verbindliche Fakten,
  kreative Freiräume und Feldperspektiven ausdrücklich benennen. Private Rollen
  nicht unverändert auf professionelle oder operative Missionen übertragen.
- Kontext auf glaubwürdige Möglichkeiten ausrichten. Bei Drift zuerst Datenanker,
  Profil, Klassifikation und Übergaben prüfen, bevor neue Prosa-Verbote entstehen.
- Eine kompakte KI-Memory im bestehenden Aufruf mitliefern lassen. Für das neue
  Set passende Vergleichsdimensionen definieren; Speicher- und Migrationsvertrag
  ausdrücklich festlegen, statt private History ungeprüft global einzusetzen.
- Picker und Direktpfad müssen denselben Ideenvertrag verwenden. Auswahl bewahren.
  Fortsetzungen brauchen eigene Abschlussnachweise und eine eigene Erzählphase.
- Wenige gezielte Live-Versuche, mehrere Kontexte und aufeinanderfolgende Entwürfe
  betrachten. Motive, Initiative, Namen, Einstieg, Schluss und konkrete Details
  vergleichen. Nutzerbeispiele nicht dauerhaft in Produktionsprompts übernehmen.
- Tests an Übergängen ansetzen: echter Dispatcher-Einstieg, Picker-Auswahl,
  Speichern/Laden, fehlende optionale Felder, Folgeangebot, Sim- und Live-Aufrufpfad,
  Pause/Reset, doppelte Trigger und Voice-Sperren. Fixtures belegen Integration,
  nicht literarische Qualität oder einen tatsächlich geflogenen Simulatorlauf.

## Referenzen und Einstieg im Code

- [Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md): Begründungen und Entwicklung.
- [Episode Writer V6](Mission%20Episode%20Writer%20V6.md): Ideen-/Writer-Pipeline und Memory.
- [Private Return](Mission%20Private%20Return%20V1.md): Abschluss, Folgeangebot und Voice.
- [Flow Reference](Mission%20Flow%20Reference.md), [Building Instructions](Mission%20Building%20Instructions.md),
  [Semantics V4](Mission%20Semantics%20Rules%20V4.md): verbindliche fachliche Grenzen.
- `mission-private-episode-v6.js`: Prompts, History, Picker-Vertrag, Writerformat.
- `mission-private-return-core.js`: Folgeangebot, Rückblick, Voice-Erzählkontext.
- `app.js`, `mission-followup.js`: Generierung, Auswahl und UI-Orchestrierung.
- `mission-runtime-core.js`, `sync.js`: Abflugtrigger und Sim-/Live-Aufruf.
- `passenger-voice.js`: Gesprächskontext, Queue und Sprachausgabe.
