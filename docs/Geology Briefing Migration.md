# Geologie-/Relief-Briefing

Stand: 30.09.2026. Für Alpha v1889 freigegeben. Profil `science_geo`, initiale Einzelziele aus dem bestehenden Pool `mountain`, `dam`, `water`. Ketten, Folgeaufträge, Offline- und reine Planungsmissionen bleiben im bisherigen Pfad.

## Fachlicher Auftrag

Eine mitfliegende geowissenschaftliche Fachperson entwickelt eine konkrete Frage am ausgewählten Ziel. Der Pilot ermöglicht eine qualitative Luftübersicht im vorhandenen Zielbereich, mit den vorhandenen Höhen-, Radius- und Zeitvorgaben, anschließend Rückkehr zur Basis. Beobachten und vorsichtig einordnen ist Teil der Aufgabe; Fotos und Notizen können unterstützen. Keine Umdeutung in einen Fotoauftrag oder eine technische Bauwerksprüfung.

Der Luftblick liefert keine Gesteinsbestimmung, Untergrundmessung, exakte Sedimentmenge oder Sicherheitsfreigabe. Erkennbare Formen unterstützen die Planung und Einordnung weiterer Feldarbeit. Ein Studienanlass darf erfunden sein; real vorhandene Formen, Umgebung und Zustände brauchen Ortsbelege. Bei knappen Belegen bleibt die Frage erkundend und der Beobachtungswunsch bedingt.

## Ideen, Writer und History

- `mission-geo-briefing-core.js`: eigener Ideenvertrag `geo-idea.v1`, Briefing `geo-briefing.v1`, Promptstand `geo-study-v1.3`.
- `mission-geo-briefing-browser.js`: bis drei Zielideen in einem Batch, danach ein Writer für die ausgewählte Idee. Direkter Dispatch verwendet dieselben beiden Schritte.
- Snapshot `geo-proposal.v1` bewahrt Start, Ziel, Belege und Idee; beim Ausarbeiten werden Start/Ziel und Ideenidentität erneut geprüft. Kein stiller Austausch der Idee.
- Keine konkreten Studienbeispiele, Persona-Liste oder Themenquote im Prompt. Geschichte und Forschungsfrage entstehen aus dem Ziel, den Belegen und früheren Studienkernen.
- History `ga_geo_study_history_v1`: letzte zwölf erzeugte Missionen, deduplizierte Missions-IDs, maximal 16000 JSON-Zeichen. Frage, Anlass, Auftraggeber, Luftnutzen, Folgearbeit und Writer-Memory erreichen Ideen- und Writer-Stufe. Ungewählte Pickerangebote werden nicht gespeichert. Diese Variationshistory bleibt lokal; die aktive Mission wird synchronisiert.
- Zugängliche Dispatcher-Erzählung, etwa 90–130 Wörter, höchstens ein kurz erklärter notwendiger Fachbegriff. Begrüßung spricht dieselbe Fachperson in der Ich-Form.

## Gemeinsame Fakten und Wetter

Beide Shared-Briefing-Bausteine werden direkt verwendet. Explizite Picker-Tags und kartierte Umgebungsbelege erreichen bereits die Ideenstufe. Orientierungspunkte bleiben im separaten Lagebericht und begründen keine neue geologische Frage. Kategorie und Ortsname allein belegen keine spezielle Geländeform oder Prozessgeschichte.

Der bestehende V4-Wettervertrag liefert aktuelle Dispatch-Beobachtungen und Wertebindungen. Ein ungültiger Wetterabsatz verwirft keine gültige Geschichte; der Shared-Core stellt vorhandene Beobachtungen dar. Die Live-Stichprobe verwendet ausdrücklich historische Wetterfixtures, keinen Nachweis eines frischen Wetterabrufs.

## Speicherung und Voice-/Tracker-Anschluss

`geoBriefing` ist in Missionsobjekt, V4-Contract, Debug-Snapshot, lokalen Quota-Saves und Cloud-Kompaktierung erhalten. Finalisierung respektiert die ausgewählte Fachperson, Geschichte und Ladung; das alte Personen-/Story-Preset überschreibt neue Briefings nicht.

`passenger-voice.js` ergänzt den bestehenden Base-Context um die vollständige Studienidee. Dieser Kontext wird über die vorhandene Authority-Schnittstelle zum Tracker übertragen. Bestehende POI-Ansagen für Ziel in Sicht, Zielgebiet und Zielabschluss tragen Frage und Folgearbeit weiter und berücksichtigen die bestehende Gesprächserinnerung. Keine neuen Trigger, Fortschrittsregeln oder versteckte Voice-State-Machine. Die serialisierte Tracker-Prompt-Erzeugung wurde getestet; ein echter Simulatorflug und Audio-Wiedergabe wurden in diesem Umbau noch nicht geprüft. Keine neue Tracker-EXE notwendig, solange ausschließlich dieser bestehende Kontextvertrag ergänzt wird.

## Prüfungen

```sh
node --test tools/mission-geo-briefing.test.mjs tools/mission-poi-narrative-voice.test.mjs tools/mission-bio-briefing.test.mjs tools/mission-poi-briefing-shared.test.cjs tools/mission-poi-environment.test.cjs tools/mission-poi-briefing.test.mjs
```

Geprüft: Ziel-/Ideenbindung, direkte Generierung, Auswahl ohne erneute Idee, belegte Fakten-IDs, Profil- und Kapazitätsgrenzen, beide History-Stufen, Finalisierung, Quota-/Cloud-Restore, Skript-Reihenfolge, Offline-Assetliste und serialisierte Tracker-Voice-Kontexte. Andere Profile behalten ihre Verträge.

Live-Werkzeug `tools/geo-briefing-live.mjs`: maximal ein Ideen-Batch und drei Writer, keine Reparaturaufrufe. Rohantworten und Quellenkontexte bleiben im Analysebericht. Optionaler zweiter Dateiparameter verwendet zuvor abgerufene Quellenkontexte statt neuer Kartenabrufe. Drei kleine Serien prüften Feldberg, Titisee und Schwarzenbachtalsperre. Die ersten Serien zeigten vorausgesetzte Ortsformen, zu viele Fachbegriffe, Quellenbegriffe in sichtbarer Prosa und Vermischung mit Lagebericht. Der Prompt wurde deshalb vor der Generierung präzisiert; keine semantische Regex-Reparatur der Texte.

Aktivierung lokal standardmäßig für KI-Einzelziele; Rückfallschalter `ga_geo_briefing_v1=off`. Veröffentlichung über den normalen Alpha-Workflow nach Nutzerfreigabe vom 30.09.2026; Cache-Version v1889 und Script-URLs aktualisiert.

### Ergebnis der lokalen Prüfung

73 Tests bestanden. Die dritte Serie mit Prompt v1.2 (`analysis/geo-briefing-live-20260930-v1-2.json`) nutzt die Quellenkontexte der zweiten Serie; vier erfolgreiche Gemini-Aufrufe, kein frischer Wetterabruf. Sie erzeugte drei unterschiedliche Fragen und bewahrte Person, Auftrag und Rückkehr. Die Wetterfixture wurde in allen drei Briefings über den gemeinsamen Stationsrückfall ausgegeben.

Die inhaltliche Qualität ist noch kein Freigabenachweis: Bei knapper Beleglage setzten einzelne Texte weiterhin Mündungsbereiche oder steile Hänge voraus. Ein Text kündigte ein Echolot als Messung der Schlammdicke an, ohne dessen Methode zu begründen. Außerdem wechselte die Dispatcher-Erzählung stellenweise zu „wir“. Fachbegriffe waren gegenüber Serie eins besser erklärt, aber noch nicht überall alltagssprachlich. Diese Schwächen wurden nicht nachträglich aus den gespeicherten Rohtexten korrigiert. Vor einer Veröffentlichung sollten die fachliche Beobachtungsgrundlage und die Quellenbindung anhand einer weiteren gezielten Stichprobe geprüft werden; keine Behauptung einer abgeschlossenen Simulator-/Audio-Probe.


## Optionale Geologie-Szenen (v1.3)

Der anfängliche feste `sceneIntent=none`-Wert ist entfernt. Die KI entwickelt zuerst die Forschungsfrage; erst danach entscheidet sie ohne Beispiele oder Ausstattungsquote, ob optionale Zusatzobjekte den Studienanlass unterstützen. Landschaft und offener fachlicher Luftblick bleiben der Hauptauftrag. Keine geologischen Formen, Gefahren oder Befunde als Zusatzobjekte vortäuschen, keine neue Landung, Interaktion oder Abschlussbedingung.

Die Ideenstufe bekommt nur die neutrale technische Möglichkeit (`sceneTools.optionalObjects`), keinen Modellkatalog. Der Writer erhält die tatsächlichen Modelle nach Rolle und sichtbarer Funktion und kann nicht darstellbare optionale Wünsche reduzieren. Ohne Szene in der gewählten Idee darf er keine neue Szene hinzufügen. Das Szenenformat enthält `summary`, `visibleIdeas`, `densityHint`, `notes`; alte gespeicherte Ideen ohne dieses Feld bleiben kompatibel und ohne Zusatzobjekte.

Die aufgelöste Absicht wird in Mission, `geoBriefing.idea`, V4-Contract, Quota-/Cloud-Save und History bewahrt. Der bestehende gemeinsame POI-Szenen-Composer erhält jetzt ausdrücklich die Geologie-Idee. Seine unveränderten Kartenflächen-, Modell-, Abstands- und Budgetregeln bleiben zuständig. Fehlende geeignete Flächen dürfen eine optionale Szene entfallen lassen; der Geologie-Flug bleibt gültig. Kein Umbau der Platzierungsregeln oder Tracker-Ausführung.

77 Tests bestehen einschließlich optionaler Szenen, erlaubter Reduktion, unveränderter Studienidentität, Restore, neutraler Ideenstufe und tatsächlichem Composer-Kontext. Zwei neue Beispiele: `analysis/geo-briefing-live-20260930-v1-3-two.json`; ein Ideen-Batch plus zwei Writer, vorher abgerufene Zielkontexte, History aus der letzten Serie und historische Wetterfixture. Diese Probe erzeugt Briefing/Szenenabsicht, keine platzierte oder im Simulator gespawnte Szene.

### Neue Zweierprobe mit optionalen Szenen

Beide frei generierten Ideen verwendeten `densityHint=sparse`, ohne erzwungene Szene oder Quote. Feldberg: Bodenmarkierungen und Container zur Unterstützung vorgesehener Feldarbeit. Titisee: kleines Boot und Fahrzeuge im Zusammenhang mit geplanter Ufer-/Gewässerarbeit. Beide Absichten erreichten den Writer und das gespeicherte Missionsobjekt. Kein Composer-/Spawn-Aufruf in dieser Textprobe; eine tatsächlich vorhandene Szene ist damit nicht nachgewiesen.

Weiterhin sichtbar: Der Feldberg-Writer sprach als „wir“ von bereits platzierten Objekten und bezeichnete einen normalen Container als Messcontainer. Der Titisee-Writer setzte kürzliche Regenfälle voraus. Die Rohtexte bleiben unverändert dokumentiert; diese Zweierprobe ist ein Nachweis der genutzten Szenenoption, keine Freigabe der vollständigen erzählerischen/fachlichen Qualität.

## Alpha-Ausrollung v1889

Nutzerfreigabe nach den zwei Beispielen mit optionaler Szene. 77 Tests bestanden; Quellen-/Erzählgrenzen der Stichprobe bleiben oben dokumentiert. Auf dem aktuellen Origin-Stand einschließlich Tracker v458 aufgebaut. Keine Änderung an Tracker-Code oder dessen gepackten Abhängigkeiten, daher kein eigener Tracker-Build für diesen Kontext-/Briefing-Umbau. Tatsächlicher Szenen-Spawn und Simulatorflug bleiben Feldtests.
