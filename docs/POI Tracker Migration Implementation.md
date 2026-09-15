# POI-Migration: Implementierung und Paritätsnachweise

Stand: 15.09.2026, lokaler Umbau. Ergänzt die [Bestandsaufnahme](POI%20Tracker%20Migration%20Assessment%202026-09-15.md).

## Status und Freigabegrenze

**Ab v409 gilt der gemeinsame Alpha-Schalter für APT und Standard-POI.**
`VFR_MULTITOOL_POI_EXECUTION` entfällt; die v408-Aktivierungshinweise unten
dokumentieren den damaligen Release. [Aktuelle Bedienung](Tracker%20v409%20Mission%20Authority%20Switch.md).

**Die vier Befunde aus Abschnitt 14 sind korrigiert. Der isolierte Origin-/Alpha-Release ist v408; Umsetzung und Nachweise stehen in Abschnitt 15 und 16.** Simulator-, Audio- und Mehrgeräte-Feldtests stehen weiterhin aus.

Der vollständige Standard-POI-Pfad ist lokal an die gemeinsame Tracker-Infrastruktur
angebunden: Original-Taskkern, Flug-/Bodenbeobachtung, Cargo/PAX, Voice, Szenenplan,
Abschluss-Recovery, Cloud-Seed und kanonische UI. Der aktuelle Anschluss und die
zusätzlichen Nachweise stehen in **Abschnitt 13**. Abschnitte 1–12 dokumentieren die
vorangegangenen Teilschritte und deren damalige Grenzen.

Die produktive Standardfreigabe bleibt aus. Der neue Alpha-Einstieg verlangt zusätzlich
`VFR_MULTITOOL_POI_EXECUTION=1` und den vorhandenen APT-Ausführungsschalter.
Erst dann wird `mission.poi.v1` angeboten. Der produktive Manager verlangt dabei ein
vollständiges Lifecycle-Rezept; die früheren internen Task-Testrezepte reichen nicht.
MSFS-/Desktop-/Mehrgeräte-Feldtests bleiben ein eigener Nachweis.

Die wiederverwendbaren Regeln stehen im [Tracker-Migrationsleitfaden](Tracker%20Mission%20Migration%20Guide.md).

## 1. Fachkern aus der Originalfunktion

`mission-poi-task-core.js` enthält den aus `_tickPoiDwell` extrahierten allgemeinen
Taskablauf, die Sichtweitenprüfung, Geometrie und die vorhandene Normalisierung
fehlender/abgeworfener/beschädigter Arbeitsgegenstände.

Vertrag: `observe(previousState, input)` liefert `{ state, effects }`. Zeit,
Telemetrie, Passenger-Taskparameter, Schwierigkeit, Cargo-Ergebnis und gegebenenfalls
Survey-/Kettenergebnis werden ausdrücklich übergeben. Der Kern besitzt keinen
Browser, Timer, Audioplayer oder Speicherzugriff.

Die Effekte bewahren die Reihenfolge der ursprünglichen Logs, Speicheraufrufe und
Voice-Trigger. Jeder Effekt enthält den Zustand, den die Originalfunktion genau
an dieser Stelle sichtbar machte. Ein Voice-Trigger enthält Prompt-Funktionsname,
Originalargumente, Label und Verzögerung; er schreibt keinen vereinfachten Ersatzdialog.

`passenger-voice.js` bleibt vorläufig der App-Adapter: Es liest die bestehenden
Kompatibilitätsvariablen ein, ruft den Kern auf und führt Effekte mit den unveränderten
Prompt-Buildern und dem vorhandenen `_paxMissionTimeout` aus. Vor jedem Effekt wird
dessen Zwischenzustand angewendet, anschließend der Endzustand. Damit sieht etwa
ein Persistenzaufruf denselben Zustand wie vor der Extraktion.

Training, Fire, SAR-Heli und die bestehenden Survey-/Kettenadapter behalten ihre
ursprünglichen Einstiege. Diese spezialisierten State Machines sind durch die
allgemeine Extraktion nicht automatisch Tracker-fähig.

Bewusst erhaltene Regeln: Dwell 0 erfüllt beim Eintritt vor der Höhenprüfung;
Radiusverlassen löscht nicht den angesammelten Dwell; ein Sample zählt höchstens
fünf Sekunden mit dem ursprünglichen Entfernungsgewicht. Regelkorrekturen müssen
separat von der Migration entschieden werden.

## 2. Eigene Tracker-Struktur und Autorität

`ga-tracker-client/tracker-mission-poi-runtime.js` kapselt:

- Ein versioniertes, validiertes Taskrezept mit Mission-ID, TaskDomain,
  Ziel/Home, Schwierigkeit, Passenger-Parametern und expliziter Tracking-Aktivierung.
- Einen pro Run persistierbaren Zustand mit vollständigem Detektor, Samplezeit,
  Checkpoint-Sequenz und Unterbrechungszeit.
- Telemetrie-Normalisierung und denselben `mission-poi-task-core` wie in der App.
- Einen Authority-Treiber, der `POI_TASK_OBSERVED` revisionsgebunden über den
  vorhandenen Execution-Adapter einreicht.
- Eine öffentliche Taskprojektion ohne privates Rezept oder Promptargumente.

Der erste interne Vertrag begrenzt sich auf gewöhnliche Dwell-/Flyover-Domains
für Foto, Infrastrukturinspektion, Nachrichten und Wissenschaft. Survey, Kette,
Training, Fire, SAR, Wissensführung und Bush benötigen ihre eigenen Verträge.
Der Adaptername `poi` allein genügt nicht als Freigabe.

Der Execution-Core schreibt Detektor und Voice-Effekte in denselben akzeptierten
Übergang. Er führt Erfüllung/Abbruch in die Return-Phase, **schließt die Mission
dadurch aber nicht**. Der vollständige private Zustand geht in Hash und Replay ein;
die vorhandenen APT-Hashes erhalten kein leeres zusätzliches POI-Feld.

Bei fehlgeschlagenem Commit bleiben der ausstehende Zustand und seine Effekte
im Treiber erhalten; weitere Samples warten auf dessen erfolgreiche Speicherung.
Gleiche/ältere Samplezeiten erzeugen keinen zusätzlichen Fortschritt; ein bereits
ausstehender Commit kann dabei erneut versucht werden. Neustart und bekannte Verbindungstrennung
halten die Taskuhren bis zum nächsten akzeptierten Sample an. Sim-Pause und Menü
zählen keine zusätzliche Arbeitszeit und verbrauchen keine Beschwerde-/Kulanzzeit.
Diese Unterbrechungsregel ist eine explizite Tracker-Anpassung; die Paritätsaussage
für den Originaldetektor gilt für die laufende, identische Samplefolge.

## 3. Tests und Aussagegrenzen

`tools/fixtures/poi-legacy-20260915.js` ist eine eingefrorene Kopie der tatsächlichen
Originalfunktionen vor diesem Umbau. Sie ist ausschließlich Testreferenz und wird
bei einer späteren Core-Änderung nicht automatisch neu erzeugt.

`tools/mission-poi-task-app-differential-selftest.mjs` vergleicht die Originalfunktion
gegen den tatsächlichen neuen App-Adapter. Verglichen werden Zustand, Ereignisreihenfolge,
Persistenz, Logs, Promptargumente und Timerverzögerung. Aktuell 10.450 Vergleiche:
Radiuswechsel, Höhenfehler, beide Schwierigkeiten, Flyover, Dwell, Arbeitsgegenstände,
Delegation einschließlich der tatsächlichen Survey-/Kettenadapter und fehlende Kontextdaten.

`ga-tracker-client/tracker-mission-poi-runtime.test.js` prüft Rezeptgrenzen,
Pause, veraltete Samples, echte Authority-Persistenz, Neustart, Revisionskonflikte,
Effektidentitäten und Replay-Kompaktierung. Die Start-/Szenen-ACKs in diesen Tests
sind semantische Fixtures, kein Simulator- oder Voice-Nachweis.

Die gemeinsame Node-Prüfung für Execution-Core, Authority-Handoff, Execution-Adapter,
Execution-Runtime, Cloud-Mission und die neue POI-Runtime besteht nach der
Runtime-Anbindung mit 116 Tests (davon 27 POI-Tests). Der erweiterte aktuelle
Voice-Nachweis steht in Abschnitt 9.
Zusätzlich bestehen neun Selbsttests für Resume, Kette, Survey, Training, Handoff,
Ground Flow, Phase View, Boarding- und Farewell-Voice sowie die Driftprüfung des
generierten Tracker-Flight-Voice-Kerns. Die öffentliche Taskprojektion wird auf
identische Revisionen und getrennte Objektkopien für zwei Controller geprüft;
das ist noch kein Test zweier real verbundener Geräte.

Zentrale Prüfungen erneut ausführen:

```sh
node tools/mission-poi-task-app-differential-selftest.mjs
node --test mission-execution-core.test.js ga-tracker-client/mission-execution-authority-handoff.test.js ga-tracker-client/tracker-mission-execution-adapter.test.js ga-tracker-client/tracker-mission-execution-runtime.test.js ga-tracker-client/tracker-mission-cloud.test.js ga-tracker-client/tracker-mission-poi-runtime.test.js
node tools/generate-tracker-flight-voice-core.mjs --check
```

Zusätzlich geprüft: Browser-Export des neuen UMD-Moduls, Ladefolge vor Execution-
Core und Passenger-Voice sowie Eintrag im Service-Worker-Precache. Kein neuer
MSFS-Feldtest, Tracker-EXE-Build oder Release in diesem Implementierungsabschnitt.

## 4. Noch notwendiger vollständiger Ausführungsschnitt

Die Detailpflichten aus den APT-Feldtests sind zusätzlich in Abschnitt 12
aufgeführt. Die folgenden Sammelpunkte ersetzen diese Integrationsprüfungen nicht.

1. Taskrezept und benötigte Kontexte aus denselben App-Buildern in den vorbereiteten
   Seed aufnehmen; Schema-/Größenbudgets und negative Fälle prüfen.
2. Die angebundene Task-Telemetrie und Prüfung bestätigter Manifestzustände
   um den Flugrekorder und die laufende Cargo-Schadensberechnung erweitern;
   Szeneneffekte und abschließende Lifecycle-Aufrufe vervollständigen. Die
   lokale Schreiblast ist gemessen; größere Seeds sind zusätzlich zu prüfen.
3. Den neuen POI-Voice-Kontextbuilder in den vollständigen Seed aufnehmen;
   vorbereitete Persona-/Basiskontexte, Textnormalisierung und UI-Labels im
   vollständigen Standalone-/Tracker-Lauf sowie echtes Audio prüfen.
4. POI-Szenen sowie Bodenabschluss, Außenlandung, Heimkehrpflicht und Farewell
   aus der App-Referenz extrahieren. APT-Zielankunft darf diese Regeln nicht ersetzen.
5. App/EFB aus einer kanonischen POI-Projektion bedienen; alle mutierenden
   POI-Benutzeraktionen in Tracker-Intents überführen.
6. Erst nach geschlossenem Standardlauf alle rezeptbezogenen Gates zusammen
   aktivieren. Reale MSFS-, Audio- und Mehrgerätetests sowie Tracker-Build folgen
   vor einer veröffentlichten Freigabe.

## 5. Vorlage für weitere Missionen

Zuerst die Originalfunktion samt Effektreihenfolge einfrieren; dann den fachlichen
Kern mit expliziten Eingaben und pro Run gehaltenem Zustand extrahieren. Die App
verwendet diesen Kern als erste Paritätskontrolle. Anschließend bindet ein eigener
Tracker-Adapter denselben Kern an Authority, Persistenz und Effekte an. Transport-
Capability, Taskfähigkeit und vollständige Rezeptfreigabe werden getrennt geprüft.
Ein Aufgabenfortschritt ist noch kein vollständiger Missionslauf.

## 6. Nachprüfung vom 15.09.2026

Drei Fehler der ersten Tracker-Anbindung wurden mit zunächst fehlschlagenden
Regressionstests reproduziert und behoben:

- **Radius verlassen:** Der Detektor meldete `inRadius: false`, die öffentliche
  Taskprojektion `enroute`, die Execution-Phase blieb jedoch `on_task`. Der
  POI-Ereigniszweig setzt jetzt die Outbound-Phase zurück; Dwell bleibt erhalten,
  Wiedereintritt schaltet wieder auf `on_task`.
- **Pause ohne vollständige Telemetrie:** Positionsprüfung erfolgte vor der
  Pausenverarbeitung. Ein gültiger zeitgestempelter Pause-/Menüstatus wird jetzt
  auch ohne Position gespeichert. Ein ungültiges laufendes Sample hebt diese
  Sperre nicht auf; das gilt auch nach Neustart. Pausenereignisse überschreiben
  keine bestehende Phase/Unterphase und benötigen keine Cargo-Auswertung.
- **Verschachtelte Sondermission:** Das Rezept-Gate prüfte Sonderlogik nur auf
  seiner obersten Ebene. Es weist sie jetzt auch im Passenger-Kontext zurück.
  Beim Authority-Handoff wird zusätzlich der vorhandene Resume-Adapterdetektor
  auf die tatsächlichen Missions-/Runtime-Daten angewendet. Ein gewöhnlich
  aussehendes POI-Rezept kann dadurch beispielsweise ein Survey-Missionspaket
  nicht freischalten. Die zentrale Missionsklassifikation wurde nicht verändert.

Ein zusätzlicher Test injiziert einen tatsächlichen Fehler in `writeFileSync`:
Authority-Zustand und Effekte werden zurückgerollt, Wiederholung und Neustart
erzeugen keine doppelte Eintrittsansage. Hier war keine Korrektur notwendig.
Die vollständige Regression besteht mit 99 Tests; nach der ergänzenden
Pausen-Phasensicherung bestehen auch die 29 direkt betroffenen Core-/POI-Tests.
10.450 Original-/App-Vergleiche sowie Resume- und Phase-View-Selbsttests bleiben grün.

**Ausgangsmessung vor der Optimierung in Abschnitt 7: Schreiblast.** Eine lokale Messung mit dem
kleinen Testrezept, 300 Samples bei simulierten 5 Hz und Position außerhalb des
Arbeitsradius erzeugte 300 Dateischreibvorgänge mit insgesamt 26,22 MiB
serialisierten Daten; Dwell blieb 0. Die Messung dauerte lokal ca. 809 ms.
Das ist eine synthetische Messung auf diesem Rechner, kein MSFS-Benchmark oder
Maximalwert für reale Seeds. Ursache: Jeder akzeptierte Samplezustand wird als
vollständiger Authority-Commit samt Replay gespeichert. Vor produktiver
Telemetrieanbindung müssen Beobachtungsfrequenz und Persistenzfrequenz getrennt
werden: Taskberechnung unverändert weiterführen, Zwischenstände bündeln und
semantische Übergänge/Effekte vor ihrer Bestätigung dauerhaft speichern.
Das zulässige Verlustfenster bei hartem Prozessabbruch ist dabei ausdrücklich
festzulegen und mit Wiederaufnahme-/Mehrgerätefällen zu testen.


## 7. Gebündelte lokale Checkpoints (15.09.2026)

### Berechnung und Speicherung getrennt

Jedes gültige laufende Sample durchläuft weiterhin denselben Original-Taskkern.
Der Authority-Treiber hält den neuesten Zwischenstand im RAM. Ein regelmäßiger
Checkpoint wird beim nächsten gültigen Sample ab 5.000 ms seit dem letzten
bestätigten POI-Checkpoint gespeichert; es gibt keinen zusätzlichen Timer.
Der erste Zustand und die Wiederaufnahme werden sofort gesichert.

Radiuswechsel, Höhenstatus, Pause/Fortsetzung, Versuche, Erfüllung, Abbruch und
sämtliche vom Originalkern gelieferten Effekte erzwingen ebenfalls einen sofortigen
Commit. Insbesondere warten Voice-Trigger nicht auf den Fünfsekundentakt.
Die Reihenfolge und die pro Sample berechnete gewichtete Dwell-Zeit bleiben erhalten.

Die Kadenz entspricht dem regelmäßigen APT-Runtime-Kontext. Der Speichervertrag
bleibt für POI jedoch der vorhandene `POI_TASK_OBSERVED`-Authority-Commit:
Detektor und Voice-Deskriptoren werden gemeinsam mit Revision, Hash und Replay
persistiert. Auch regelmäßige Checkpoints sind deshalb Replay-Ereignisse;
die Sequenz zählt akzeptierte Checkpoints, nicht Rohsamples. Der strikte
`+1`-Prüfvertrag und die vorhandene Replay-Kompaktierung bleiben unverändert.
Es entsteht kein zweiter privater Persistenzpfad neben dem bestätigten Taskzustand.

### Fehler, Wiederaufnahme und Bediengeräte

- Bei Schreibfehler oder Revisionskonflikt bleibt der genaue ausstehende
  Checkpoint einschließlich seiner Effekte im RAM. Er wird vor der Verarbeitung
  weiterer Samples mit der aktuellen Authority-Revision erneut eingereicht.
  Ein nicht gespeicherter Übergang wird nicht öffentlich bestätigt.
- Andere Cargo-/Voice-Revisionen verwerfen den Taskpuffer nicht. Ein anderer
  bestätigter POI-Checkpoint oder Run verwirft dagegen die lokale Zwischenhistorie;
  die Wiederaufnahme setzt auf dem aktuellen autoritativen Zustand auf.
- App und EFB erhalten denselben bestätigten Stand. Reiner Dwell-Fortschritt wird
  deshalb bis zum nächsten Checkpoint verzögert sichtbar; semantische Übergänge
  werden sofort veröffentlicht. Private Zwischenstände werden nicht projiziert.
- Bei gesundem Speicher und fortlaufenden Samples umfasst der ungesicherte
  Zwischenstand weniger als fünf Sekunden Telemetrie. Ein harter Prozessabbruch
  kann diese Fortschrittszeit verlieren; bei Schreibfehlern gilt diese Grenze nicht.
  Neustart rechnet die Ausfallzeit nicht als Arbeit oder verbrauchte Kulanz an.
- `flush()` sichert einen vorhandenen Zwischenstand; ohne Puffer ist es ein No-op.
  `disconnect()` versucht diesen Flush und pausiert die Taskuhren bis zum nächsten
  gültigen laufenden Sample. Fehler bleiben als Rückgabe und ausstehender Commit erhalten.

**Verbindlich für die noch offene produktive Anbindung:** Vor geordnetem Shutdown,
Authority-Wechsel und Missionsabschluss `flush()` ausführen und das Ergebnis
behandeln; bei Telemetrietrennung `disconnect()` aufrufen. Ein Flush muss vor einem
abschließenden Missionsereignis erfolgen, solange der Taskzustand noch schreibbar
ist. Der nachfolgende Integrationsschritt in Abschnitt 8 bindet Disconnect und
Intents an die Runtime an; Shutdown und der vollständige Abschluss-/Handoff-Pfad
sind vor der weiterhin ausgeschalteten POI-Rezeptfreigabe zu vervollständigen.

### Messung und Nachweise

Identische synthetische Last zur Ausgangsmessung: kleines Fixture, 300 Samples,
simulierte 5 Hz, eine Minute außerhalb des Arbeitsradius, Dwell 0. Gezählt werden
nur Authority-Dateischreibvorgänge nach dem Setup; kein abschließender Flush.

| Messwert | Vorher | Mit Bündelung |
| --- | ---: | ---: |
| Dateischreibvorgänge | 300 | 12 |
| Insgesamt serialisierte Daten | 26,22 MiB | 0,217 MiB (227.099 Byte) |
| Lokale Laufzeit des Messdurchlaufs | ca. 809 ms | ca. 51 ms |

Damit entstehen 96 % weniger Schreibvorgänge und rund 99,2 % weniger serialisierte
Daten in diesem Szenario. Ein abschließender Flush schreibt den letzten Teilabschnitt
zusätzlich (hier insgesamt 13 Schreibvorgänge). Die Werte betreffen lokale
Schreiblast, keinen Netzwerkverkehr; Laufzeiten sind Einzelmessungen und kein
MSFS-Benchmark. Übergänge und größere reale Missions-Seeds erhöhen die Schreiblast.

Die 20 POI-Tests decken zusätzlich Kadenz, privaten Zwischenstand, sauberen Disconnect,
harten Neustart, fremde Checkpoints, sonstige Authority-Revisionen und reale
Schreibfehler beim regelmäßigen Checkpoint sowie bei Erfüllung ab. Vier Folgen mit
insgesamt 2.000 Samples vergleichen die gebündelte Verarbeitung mit ungepufferter
Auswertung desselben Kerns: wechselnde Geometrie, Höhenbeschwerden/Korrekturen,
Schwierigkeit, Cargo-Abbruch und Flyover; Voice-Deskriptoren werden pro Sample verglichen.
Replay-Kompaktierung wird durch explizite Flushes unabhängig vom normalen Takt geprüft.

109 Tests der gemeinsamen Execution-/Tracker-Regression, 10.450 Vergleiche mit
der eingefrorenen Original-App sowie Resume- und Phase-View-Selbsttests bestehen.
Der Standalone-Kern und sein App-Adapter wurden bei dieser Optimierung nicht geändert.


## 8. POI-Telemetrie in der Execution-Runtime (15.09.2026)

`createTrackerMissionExecutionRuntime` besitzt jetzt einen POI-Authority-Treiber.
Die Rezeptwahl liest den kleinen aktiven Run (`executionRecipe`), ohne für jedes
APT-Sample einen zusätzlichen vollständigen Execution-Snapshot zu kopieren.
Ein POI-Run wird ausschließlich über den bestehenden eigenen Task-Treiber
beobachtet; der APT-Detektor für Anflug, Ziel-Touchdown, Arrival und Auto-Close
wird dabei nicht auf das POI-Arbeitsziel angewendet. Die Original-POI-Regel, die
selbst keinen neuen Airborne-Filter einführt, bleibt erhalten.

### Bestätigtes Manifest als Taskeingabe

Ohne injizierten Testcallback liest der POI-Treiber jetzt `snapshot.state.manifest`.
`taskItemStateFromManifest` übernimmt die drei erforderlichen Item-Prädikate aus
`_missionCargoEvaluateOutcome`: fehlend, abgeworfen und beschädigt (`healthPct <= 35`).
Storynamen/Labels werden mit der bereits gemeinsam verwendeten Originalfunktion
`taskItemState` normalisiert. Pflichtladung, die noch geladen und unbeschädigt ist,
führt nicht allein wegen ihrer späteren Entladepflicht zum Luft-Task-Abbruch.
Die Auswertung verändert das Manifest nicht.

Ein Differentialtest führt die tatsächliche App-Funktion aus und vergleicht die
Tasklisten in 168 Kombinationen: sechs Itemzustände, sieben Gesundheitswerte,
Pflicht/optional und Cargo/PAX, jeweils mit zusätzlichen Duplikaten und optionalen
Items. Eigene vereinfachte Regeln für PAX oder bereits entladene Gegenstände
wurden nicht eingeführt.

**Grenze dieses Schritts:** Das ist die Prüfung des bereits bestätigten
Manifestzustands. Die App wendet vor ihrer Outcome-Auswertung zusätzlich neue
Flugbelastung an. Für vollständige Parität muss der POI-Tracker-Pfad noch denselben
Flugrekorder, die akkumulierte Belastung und die dauerhafte Gesundheitsänderung
anbinden. Der reine Task-Telemetriepfad führt derzeit auch keinen Fluglog/Recorder
und keinen vollständigen Ankunfts-/Farewell-Record. Ein bestandener Test für
bereits beschädigtes Equipment belegt diese offenen Schritte nicht.

### Lifecycle und revisionsgebundene Bedienaktionen

- Ein erfolgreicher POI-Commit ruft den vorhandenen `onAuthorityChanged`-Pfad auf.
  Private Zwischenstände und leere Flushes erzeugen keine neue Benachrichtigung.
- `detachSimulator` ruft `disconnect()` auf, sichert damit den Puffer und pausiert
  die Uhren. Ein Schreibfehler wird als `MISSION_POI_CHECKPOINT_ERROR` protokolliert;
  der ausstehende Zustand bleibt wiederholbar. Der Boolean von `detachSimulator`
  bestätigt weiter nur das Abhängen der Simulatoranbindung.
- Die Runtime stellt `flush()` für den POI-Checkpoint bereit. Der Prozess-Shutdown
  muss diesen Aufruf vor Freigabe/Beenden noch anbinden und Fehler behandeln.
- Vor einem POI-Intent wird zuerst die originale Geräteanfrage validiert. Erst
  danach darf die Runtime synchron flushen und die bereits geprüfte Anfrage auf
  ihre eigene neue Authority-Revision beziehen. Eine bereits veraltete Anfrage
  wird nicht umgeschrieben und löst auch keinen Flush aus. Die neue Revision
  stammt ausschließlich aus dem eigenen Commit-Ergebnis; eine weitere Mutation
  während der Benachrichtigung bleibt ein Revisionskonflikt und wird nicht absorbiert.
- Ein fehlgeschlagener Flush stoppt den Intent vor seiner Mutation bzw. dem
  Abort-Cleanup. Ein erfolgreicher Flush sichert beim Abort auch den letzten
  Teilabschnitt, bevor die bestehende Run-Freigabe erfolgt.

Die Tests rufen den tatsächlichen Runtime-Einstieg ohne Browser auf und prüfen
Benachrichtigungen, Cargo-Abbruch, Disconnect/Neustart, Revisionskonflikt und
Schreibfehler vor Abort. Eine Landung im Arbeitsradius erzeugt keine APT-Ankunft
oder APT-Farewell. Der Recipe-Opt-in und die ausgeschaltete Runtime verhindern
weiterhin jede Taskmutation.

### Noch geschlossene Ausführungsschnittstellen

Stand nach Abschnitt 8: Der POI-Task erzeugte persistierte `voice.poi`-Deskriptoren;
der Effect-Runner führte sie noch nicht aus. Abschnitt 9 ergänzt die Voice-Ausführung. Originale
POI-Prompts, Narrative-Memory, Synthese/Playback und ACK sind der nächste
Voice-Integrationsschritt. Ebenso offen: vorbereiteter App-/Cloud-Seed,
POI-Szenen, Recorder/Stress, vollständiger Bodenabschluss/Return/Farewell,
Shutdown/Authority-Wechsel und die vollständige App-/EFB-Bedienprojektion.
Der bestehende Callback zur Authority-Benachrichtigung ersetzt keinen realen
Mehrgerätetest und noch keine vollständige Taskanzeige.

Nach dieser Anbindung bestehen 116 Tests der gemeinsamen Regression,
10.450 Original-/App-Vergleiche und die Resume-/Phase-View-Selbsttests.
Kein produktives POI-Gate, Tracker-Einstieg, EXE-Release oder App-Taskablauf
wurde in diesem Schritt geändert.


## 9. Originale POI-Voice und APT-Erfahrungen (15.09.2026)

### Originalquelle statt neuer Dialoglogik

`tools/generate-poi-voice-core.mjs` extrahiert die sieben vorhandenen POI-Prompt-
Funktionen und ihre dynamischen Hilfsfunktionen unverändert aus `passenger-voice.js`
in `mission-poi-voice-core.js`. Der generierte Kern läuft in Browser und Node;
`--check` meldet jede Abweichung von der App-Quelle. Er verarbeitet explizite
Eingaben und besitzt keinen Browserzustand, Timer, Provider oder Audioplayer.
Die Standalone-Promptfunktionen bleiben die Quellreferenz; sie wurden nicht durch
neue Formulierungen ersetzt. Die eingefrorene Referenz liegt separat unter
`tools/fixtures/poi-voice-legacy-20260915.js` und wird nicht neu generiert.

Enthalten sind Objekt in Sicht, Gebietseintritt, Höhenbeschwerde/-korrektur,
Task-Erfüllung, Höhenabbruch und Cargo-Abbruch. Originale Wetterformulierungen,
Inspektionsbefunde, fachliche Hinweise, Fakten-/Landmarkenauswahl und
Wiederholungsvermeidung bleiben erhalten. Das Rezept umfasst weiterhin nur die
sechs freigegebenen internen Standard-Domains; Wissen, Survey, Kette, Training,
Fire, SAR und Bush werden dadurch nicht migriert.

`paxVoiceBuildPoiAuthorityContext(missionId)` bereitet die benötigten Eingaben
mit den vorhandenen App-Buildern vor: Persona/Basiskontext, Rolle, Zielwissen,
Landmarken, vorhandener Infrastruktur-Befund, Modelle, Stimme und Audioeinstellung.
Es transportiert keine Provider-Schlüssel. Der Builder ist bereitgestellt,
**aber noch nicht im App-/Cloud-Seed aufgerufen**. Der Caller muss die aktive
Mission-ID verwenden; das Taskrezept prüft Identität, Domain, Schwierigkeit und
Arbeitsparameter gegen den Voice-Kontext. Kontextbudget: 64 KiB UTF-8;
Promptbudget: 24.000 Zeichen entsprechend dem vorhandenen VoiceService.

`_toneHint` nimmt optional einen expliziten Greeting-Status an; ohne Argument
bleibt das App-Verhalten unverändert. Der vorbereitete POI-Luft-Task nutzt den
Zustand nach Boarding, damit ein im geplanten Zustand erstellter Seed nicht
später erneut zu einer Begrüßung auffordert. Der Builder setzt dabei kein App-Flag.

### Vorbereitung, Textgedächtnis und Ausführung

1. Beim Task-Trigger rendert `tracker-mission-poi-voice.js` den Originalprompt
   mit dem damaligen Wetter, dem Zwischenzustand des Detektors und dem bereits
   bestätigten Erzählgedächtnis. Der vollständige `resolvedRecipe` wird zusammen
   mit dem Detektor in `POI_TASK_OBSERVED` gespeichert. Mehrere Trigger desselben
   Samples sehen wie in der App noch keine künftig erzeugten Texte.
2. Ein zufällig gewählter Inspektionsbefund bleibt im Voice-Zustand des Runs;
   ein vorhandener Missionsbefund hat den ursprünglichen Vorrang. Bei fehlgeschlagenem
   Task-Commit hält der Treiber das vorbereitete Rezept inklusive Auswahl fest.
   Wiederholung und Neustart ändern weder Prompt noch Befund.
3. Der Effect-Runner aktiviert für intern freigegebene POIs ausschließlich
   `voice.poi`. Szenen-/Abschluss-Effekte bleiben gesperrt. POI-Ansagen werden
   in Ereignisreihenfolge bis zum dauerhaften ACK abgearbeitet; die Runtime führt
   unabhängig davon Telemetrie und Cargo-Intents weiter aus.
4. Der bestehende Boarding-/Flight-Voice-Dispatcher reicht das gespeicherte Rezept
   an denselben `tracker-voice-service.js` weiter. Originalverzögerungen werden als
   absoluter frühester Ausführungszeitpunkt gespeichert; nach Warten in der Queue
   oder Neustart wird nicht noch einmal die gesamte Verzögerung angehängt.
5. Vor Aktivierung der Wiedergabe speichert `POI_VOICE_TEXT_READY` den erzeugten
   Text am Effekt und aktualisiert mit der Originalfunktion das Gedächtnis
   `pre`/`entry`/`done`. Das entspricht der App, die sich Text vor Ende des Audios
   merkt. Diese Bestätigung ist noch kein Playback-ACK. Bei Schreibfehler bleibt
   Playback gesperrt; derselbe VoiceService-Job kann die Speicherung wiederholen.
6. Das spätere Voice-ACK hält Outcome und Playbackstatus fest. Doppelte ACKs
   überschreiben kein Gedächtnis. Bereits textbestätigte Effekte werden am ACK
   nicht erneut in das Gedächtnis geschrieben. Auch nach einem terminalen Task
   pumpen weitere gültige Runtime-Aufrufe ausstehende Voice-Wiederholungen.

### Vergleich mit den APT-Erfahrungen

| APT-Erfahrung / Vertrag | Umsetzung für POI | Nachweis |
| --- | --- | --- |
| Vorbereitung ist kein bestätigtes Ergebnis; fachlicher Commit kommt vor externer Wirkung. | Prompt und gewählter Befund werden mit dem Task persistiert, Textgedächtnis vor Playback. | Schreibfehler bei Task und Text halten Wirkung zurück; Befund bleibt beim Retry gleich. |
| Lange Voice-Operationen dürfen Manifest-/Signaturaktionen nicht blockieren. | Vorhandene Hintergrund-Voice-Verarbeitung; separate geordnete POI-Ansagen. | Cargo-Fenster und Telemetrie funktionieren während einer ausstehenden Ansage. |
| Audiofähige Sitzung beweist keine Wiedergabe (Feldnachbesserung nach v383). | Unveränderter kurzer Claim-/Lease-Pfad und Best-Effort-Warnung ohne Claim. | Zwei Kandidaten ohne Claim führen nicht zum langen Playback-Warten. |
| Stabile Effekt-ID verhindert neue Synthese bei Reconnect/Neustart. | Bestehender persistierter VoiceService-Job mit unverändertem Rezept. | Reale Service-Instanz, lokaler Cache, Wiederaufbau und keine weitere Provider-Anfrage. |
| Genau ein Playback-Owner pro Effekt. | Bestehende Claim-/Release-Lease. | Zwei simulierte Clients: nur einer erhält die Lease; abgeschlossene Wiedergabe bleibt nach Neustart abgeschlossen. |
| Späte TTS-Antwort darf kein Missionsende überholen. | POI nutzt das vorhandene Playback-Gate; ein inzwischen entfernter Run sperrt POI ausdrücklich. | Abbruch während Generation verhindert Aktivierung auch bei später erfolgreicher Antwort. |
| Nach asynchronem ACK gemeinsam drainen, benachrichtigen und Abschlussgates prüfen. | Vorhandenes `settleEffects`; keine zweite POI-ACK-Pumpe. | Reihenfolge/duplizierte ACKs und APT-/Farewell-/Compliance-Regression. |
| Autoritativer Zustand und Replay müssen nach Neustart übereinstimmen. | POI-Gedächtnis und Text-Ready sind Teil von Revision/Hash/Replay. | Neustart und Browser-/Node-Replay ergeben denselben Hash. |

Referenzen: [Authority-Vertrag](Mission%20Runtime%20Authority%20Contract.md), insbesondere
Voice-Vertrag, Feldtest-Nachbesserung nach v383 und Bereinigung v396;
[APT-Paritätsaudit](Tracker%20Standalone%20Parity%20Audit%202026-09-08.md).
Die APT-Missionsregeln und ihre Freigabe wurden in diesem Schritt nicht geändert.

### Nachweise und offene Grenzen

- 1.344 Vergleiche gegen eingefrorene Originalfunktionen: sieben Prompts, sechs
  Domains, beide Schwierigkeiten, mehrere Zufallswerte, vorhandenes Gedächtnis,
  Wetter und Landmarken. Verglichen werden exakter Prompttext und Gedächtnis.
- 10.450 unveränderte Original-/App-Taskvergleiche; Boarding-/Farewell-App-Differentialtests
  und Driftprüfungen beider generierten Voice-Kerne bestehen.
- Erweiterte gemeinsame Regression: 185 Tests inklusive 38 POI-Tests sowie
  Effect-Runner, Boarding/Farewell/Compliance, Flight-Voice und VoiceService.
- Die VoiceService-Tests benutzen den echten lokalen Service mit simulierten
  Provider-Antworten. Sie sind kein echter TTS-, Hör-, MSFS- oder Mehrgeräte-Feldtest.

Die Produktions-Gates bleiben geschlossen. Offen sind der vollständige Seed,
Recorder/Belastungsschäden, POI-Szenen, Bodenabschluss/Return/Farewell,
Shutdown/Authority-Wechsel und die vollständige App-/EFB-Darstellung einschließlich
POI-Voice-Labels. Die Promptparität gilt für identische vorbereitete Kontexte und
Trigger. Der vollständige Lauf muss zusätzlich bestätigen, dass alle dynamischen
Persona-/Basis-, Textnormalisierungs- und UI-Kontexte dieselben Werte wie die App
liefern. Aus den isolierten Prompttests folgt noch keine vollständige Voice-Parität.
Kein Tracker-EXE-Build oder Release wurde durchgeführt.

## 10. Code-Review gegen APT (15.09.2026)

**Ergebnis: noch keine vollständige Tracker-Parität.** Die bisherigen Nachweise
betreffen den extrahierten Task und vorbereitete Voice-Kontexte, nicht einen
automatischen Lauf von einem geplanten Cloud-Seed bis zum Missionsabschluss.
Im Review wurde kein Produktions-Gate geöffnet und kein Ausführungscode geändert.

### Bestätigte Integrationslücken

1. **Flug-/Bodenzustand und Recorder fehlen im POI-Zweig.**
   `tracker-mission-execution-runtime.js:561` kehrt nach dem POI-Treiber zurück.
   Die APT-Telemetrieverarbeitung im Adapter aktualisiert dagegen Recorder,
   Live-Kontext, AIRBORNE, TOUCHDOWN und GROUND_STILL. Ein lokaler Probe-Lauf
   mit dem bestehenden POI-Authority-Fixture und Flug-Samples bei 1.000/7.000 ms
   ergab rund 8 s Taskfortschritt, aber weiterhin `onGround: true`,
   `groundStill: true` und keinen Execution-Runtime-Kontext. Damit fehlen
   verlässliche Eingaben für Bodenaktionen, Flugzeiten und Belastungsauswertung.
   Nächster Schritt: die gemeinsamen Beobachtungen von der APT-spezifischen
   Zielankunft trennen und mit POI-Abschlussregeln verbinden.

2. **Der reale Start-/Abschlusspfad ist weiterhin gesperrt.**
   `tracker-mission-effect-runner.js:79` verarbeitet bei POI ausschließlich
   `voice.poi`. Boarding-Szene/-Voice, Payload-Sync, Deboarding, Farewell und
   Close werden dadurch nicht ausgeführt. Auto-Close ist zusätzlich APT-exklusiv.
   Die POI-Testfixture setzt Boarding-/Load-Bestätigungen ausdrücklich direkt
   als Events; sie beweist keinen realen Start. Die Filter sind bis zur
   vollständigen Integration beabsichtigt und dürfen nicht isoliert entfallen.

3. **Seed und Produktionsfreigabe fehlen weiterhin.**
   `tracker-mission-cloud.js:109` lehnt andere Adapter als APT ab;
   der produktive Authority-Manager erhält kein `poiExecutionEnabled`.
   `paxVoiceBuildPoiAuthorityContext` ist außerhalb seiner Definition noch nicht
   aufgerufen. Eine normale POI-Mission wird deshalb weiterhin von der App geführt.

### Neu gefundene Voice-Abweichung zur Standalone

**POI-Textgedächtnis hängt fälschlich vom Abschluss der TTS-Generierung ab.**
Die App speichert und zeigt Text in `_speakAndShowNow` vor `_playTextAsTTS`.
Der Tracker-Dispatcher wartet dagegen auf den gesamten VoiceService-Job und
ruft `recordGeneratedText` nur bei `job.status === 'ready'` auf
(`tracker-mission-boarding-voice.js:232`). Der Service besitzt den Text bereits
während der Audiosynthese, meldet bei Audiofehler aber `failed`.

Mit dem echten lokalen VoiceService und simuliertem Text-Erfolg/TTS-HTTP-503
reproduziert: Service-Text vorhanden, Handler `completed` mit
`voice_provider_error`, aber Outcome-Text leer, kein `resolvedText` und kein
POI-Gedächtnis. Auch während noch laufender TTS bleibt das Gedächtnis leer.
Nachfolgende Task-Trigger können deshalb Fakten erneut verwenden, die die App
bereits als genannt behandelt. Die Aussage aus Abschnitt 9 über Speicherung
vor Playback bleibt richtig, genügt aber nicht für die originale Text-Timing-Parität.

Gezielte Lösung: einen eigenständigen Text-Ready-Schritt vor der Audiosynthese
bereitstellen und den POI-Text samt Gedächtnis dort revisionsgebunden speichern.
Audiofehler dürfen den bestätigten Text nicht verwerfen. Der bestehende
APT-Playback-/Lease-/Best-Effort-Vertrag muss dabei unverändert bleiben.
Nachweise müssen langsame TTS, TTS-Fehler, parallele Task-Trigger, Schreibfehler
und Neustart zwischen Text und Audio abdecken.

### Review-Nachweis und Reihenfolge

90 bestehende Tests für POI-Runtime, Execution-Runtime, Boarding-Voice und
Effect-Runner bestanden. Die zwei zusätzlichen lokalen Probes oben bestätigen
Lücken außerhalb der bisherigen positiven Regression; kein MSFS-/Mehrgeräte-
Feldtest. Empfohlene Reihenfolge: Text-Ready korrigieren, gemeinsame
Flugbeobachtung/Recorder integrieren, Start-/Boden-/Abschluss-Effektketten und
Seed vervollständigen, danach vollständiger App-/Tracker-/Mehrgerätevergleich.

## 11. POI-Textbestätigung vor TTS (15.09.2026)

Die Voice-Abweichung aus Abschnitt 10 ist behoben. Der bestehende VoiceService
hat für den POI-Dispatcher einen synchronen `confirmTextReady`-Schritt zwischen
Textgenerierung und Audiosynthese. Er speichert über das vorhandene Ereignis
`POI_VOICE_TEXT_READY` den Text und das Original-Erzählgedächtnis revisionsgebunden
am Missionseffekt. Erst ein erfolgreicher Commit erlaubt den Audioaufruf.
Nachfolgende POI-Trigger sehen damit den bestätigten Text bereits während der
TTS-Generierung, entsprechend der Standalone-App.

- Bei Schreibfehler hält der Service den erzeugten Text lokal mit Status
  `text_blocked` fest. Der Missionseffekt bleibt ausstehend. Der erneute Aufruf
  mit derselben Effekt-ID wiederholt den Commit ohne neue Textgenerierung;
  er startet vorher weder TTS noch Playback. Blockierte Jobs zählen zur
  begrenzten Warteschlange und werden nicht als fertige Cache-Einträge verdrängt.
- Nach einem Neustart liest der Dispatcher den bestätigten Text vom
  autoritativen Missionseffekt. Fehlt fertiges Audio im Voice-Cache, wird nur
  dieses Audio neu erzeugt. Originalprompt, Effekt-ID und Request-Fingerprint
  bleiben gleich; es gibt kein neues persistiertes Cacheformat. Noch nicht
  bestätigter Text ist bei Prozessverlust weiterhin nicht garantiert erhalten.
- Ein TTS-Fehler beendet die Ansage weiterhin als Best-Effort-Warnung, erhält
  aber Text und Gedächtnis. Auch das bestätigte Voice-Outcome enthält den Text.
  Ein Playback-ACK bleibt von der Textbestätigung getrennt.
- Der POI-Run wird unmittelbar vor dem Text-Commit erneut geprüft. Späte
  Textantworten nach Abbruch dürfen weder Gedächtnis schreiben noch TTS starten.
- Der bestehende Voice-Cache stellt nun auch `kind: poi` korrekt wieder her;
  zuvor fiel dieser Typ beim Laden auf `direct` zurück.

### Vergleich mit APT und Nachweise

Die Erweiterung wird nur bei POI angewendet. APT-Boarding, Farewell,
Claim-/Lease-Verhalten, Provider-Fallbacks und Best-Effort-Freigaben behalten
ihren bisherigen Ablauf. Ein Isolationstest prüft ausdrücklich, dass der
APT-Pfad weder den POI-Callback noch einen POI-Wiederherstellungstext verwendet.
Der zusätzliche Commit ist nötig, weil das POI-Erzählgedächtnis spätere
Task-Prompts bereits vor fertigem Audio beeinflusst.

192 gemeinsame Tests bestanden, darunter 44 POI-Tests. Sieben neue Fälle
decken langsame TTS mit parallelem Task-Trigger, TTS-Ausfall, Schreibfehler und
Retry, Wiederaufnahme zwischen Text und Audio, späten Text nach Abbruch,
stummgeschaltete POI-Ansagen und APT-Isolation ab. Die Cache-Typprüfung wurde
im vorhandenen Neustart-/Lease-Test ergänzt. Zusätzlich bestehen unverändert
1.344 Original-Promptvergleiche, 10.450 Original-/App-Taskvergleiche und die
Driftprüfung des generierten POI-Voice-Kerns. Provider-Antworten sind simuliert.

Die übrigen Review-Lücken aus Abschnitt 10 bleiben offen: gemeinsame Flug-/
Bodenbeobachtung und Recorder, vollständiger Start-/Abschlussablauf sowie
Seed und Produktionsfreigabe. Keine Änderungen an `tracker.js`, keine EXE
und kein Release in diesem Schritt.

## 12. Ergänzender Abgleich der APT-Integrationsdokumentation (15.09.2026)

Die APT-Unterlagen enthalten weitere konkrete Anforderungen, die in der bisherigen
POI-Liste teils nur unter Voice, Cargo, UI oder Abschluss zusammengefasst waren.
Die folgenden Punkte gehören ausdrücklich zum vollständigen Standard-POI-Schnitt.
**Vorhandener APT-Code ist dabei kein Nachweis seiner POI-Anbindung.** Historische
APT-Befunde sind mit den späteren Korrekturen abgeglichen, nicht pauschal als
heute noch offene APT-Fehler übernommen.

### Quellen

- [APT-Paritätsaudit](Tracker%20Standalone%20Parity%20Audit%202026-09-08.md),
  insbesondere die Fortsetzungen zu manuellen PAX, Flugansagen, Cargo und
  die Umsetzung des erneuten Audits.
- [Authority-Vertrag](Mission%20Runtime%20Authority%20Contract.md), Abschnitte
  3.4/3.5, 5–8, Pflichtgates sowie die Feldnachbesserungen v383–v396.
- [EFB-Entwicklungsplan](EFB-Development-Plan.md): Preflight-Handoff vom 08.09.,
  Feldbefunde v392/v396/v398 und Abschluss-Recovery vom 09.09.
- [Tracker-Architektur](EFB-Tracker-Architecture.md): getrennte Authority/Owner/
  Controller, begrenztes Journal, Audioausgang und Playback-Lease.

### Konkrete POI-Pflichten und heutiger Codebefund

| Bereich | Dokumentierte APT-Erfahrung | POI-Stand / notwendiger Anschluss |
| --- | --- | --- |
| Allgemeine Flugansagen | Komfort, Fortsetzung nach falschem Start, falscher Landeort, Landing-Roll und Pflichtfrachtabwurf besitzen eigene Originalguards, Cooldowns und Recorder-Abhängigkeiten. Ein Anflugprompt deckt sie nicht ab. | Die sieben POI-Taskprompts ersetzen diese Ansagen nicht. Der frühe Return in `tracker-mission-execution-runtime.js:561` überspringt den Flight-Voice-Pfad. Originale für POI gültige Aufrufe anbinden; keine APT-Anflugradien auf das Arbeitsziel übertragen. |
| Manuelle PAX | Aus-/Wiedereinsteigen braucht originale Türwartezeiten (2 s/1 s), Busy-Sperre, 70-s-Rücksetzung bei Fehler und Fortsetzung auch nach Sim-Trennung. Eine invalidierte Signatur darf beim Rollback nicht wieder gültig werden. | Adapter, Core und Simulator-Bridge besitzen diese Bausteine. `scene.manual_pax` wird im POI-Effect-Runner aber nicht ausgeführt; ein vollständiges POI-Kommandorezept und Tests mit echten PAX-Items fehlen. Nicht mit dem finalen Deboarding gleichsetzen. |
| Cargo-Objekte und Cues | Pro Objekt gelten Sollzustand, monotone `objectRevision`, stabile Equipment-Schlüssel und Zusammenfassung schneller Gegenaktionen. Cargo-/PAX-Cues funktionieren ohne TTS-Key und teilen die Playback-Lease. | Der gemeinsame Baukasten ist vorhanden. POI führt bisher weder `scene.cargo_item_transition` noch `voice.cargo` aus. Item-/Equipment-Lebenszyklus, Gegenaktionen, Payload, Cue und Signatur zusammen prüfen; Manifestmutation allein beweist keine physische Wirkung. |
| Farewell-Ergebnis und Vorbereitung | Ein Prewarm darf nur auf einer privaten Kopie prognostizieren. Vor Ausgabe gilt der aktuelle Cargo-Erfolg. Unveränderter Inhalt wird wiederverwendet; veränderter Inhalt verwirft die Vorbereitung. Touchdown-Flugfakten und Wetter dürfen eingefroren bleiben. | `_farewellAuthorityContext` in `passenger-voice.js` schließt POI ausdrücklich aus. `getFarewellDynamicContext` im Tracker-Adapter setzt `missionFailed` bisher anhand des Cargo-Ergebnisses. POI muss zusätzlich die originalen Task-/Abbruch-/Heimkehrregeln liefern. Ein bloßes Öffnen des Farewell-Effektfilters genügt nicht. |
| Abschluss-Recovery | Neustart nach bestätigtem `confirm_unload`, vor Effektverarbeitung und nach gespeichertem Close-ACK muss denselben Ablauf genau einmal fortsetzen. Eine abgebrochene Benutzer-Rückfrage sendet keinen Intent. | Die gemeinsame Runtime besitzt Recovery, aber `maybeAutoCloseConfirmedUnload` ist APT-exklusiv und POI-Abschlusseffekte bleiben gesperrt. Für POI dieselben Unterbrechungspunkte mit dessen eigenen Abschlussregeln nachweisen. |
| Reset, Clear, Ersatzmission | Vor Authority-Freigabe müssen Payload-Baseline einschließlich Equipment/PA-24-Belegung und Szenen bereinigt sein. Fehler behalten den Run wiederholbar. Reset behält den Auftrag, Clear entfernt ihn; Reload ist keines von beiden. | Gemeinsamer Abort-/Cleanup-Pfad und POI-Flush vor Intents existieren. Ein POI-Test mit leerem Manifest bestätigt noch keine Wiederherstellung realer Zuladung oder Reset-/Ersatz-Seed. Diese Fälle nach vollständiger Payload-/Szenenanbindung ergänzen. |
| Textanzeige und UI | Dieselbe Revision, dieselben Labels und Busy-Zustände auf allen Geräten; Signaturanimation verwendet den bestätigten Zeitpunkt und startet bei spätem ACK nicht neu. Fensterzustände werden synchronisiert. | `tracker-efb-mission-view-core.js:315` wählt nur Farewell/Flight/Approach/Boarding als Voice-Text; `voice.poi` fehlt. Zudem wird weiterhin `aptUiCore.project` verwendet. Bestätigte POI-Texte (auch ohne Audio), Task-/Return-Labels, Bodengates und Bordbuch-Erinnerungen benötigen explizite Projektionstests. |
| Seed/Handoff und Reconnect | Geänderte Preflight-Payload darf einen ereignislosen Planned-Seed nicht mit altem Outcome vergiften. Vor dem tatsächlichen Legacy-Versand gilt erneut die Authority-Prüfung. Revisionskonflikt ist kein Owner-Wechsel. | Gemeinsame Planned-Journal-/Handoff- und Client-Guards sind vorhanden; POI-Seed fehlt. Mit vollständigem POI-Seed Änderungen vor Prepare/Commit, temporäre Capability-Lücke, spätes ACK und Reconnect während Authority-Wechsel prüfen. Der vorhandene Handoff erlaubt nur `planned`/Revision 0/keine Effekte; eine Übernahme mitten im Flug ist auch bei APT keine freigegebene Anforderung. |
| Langer Lauf / Größenbudgets | Das Journal wird kompakt gehalten, ohne ausstehende Effekte oder Duplikatbelege zu verlieren. Wachsende Historie darf nicht bei jedem Event vollständig synchron abgespielt werden. | Gemeinsame Authority-Kompaktierung und die POI-Fünf-Sekunden-Kadenz existieren. Der bisherige kleine POI-Lastvergleich ersetzt keinen Test mit vollständigem Seed, Manifest, Voice-Rezepten und wartenden Effekten am 384-KiB-Bundlelimit. Cloud-Profilbudget ebenfalls prüfen. |
| Navigation neben der Mission | Routenbearbeitung besitzt eine eigene Revision und darf Zielanker oder fachlichen Fortschritt nicht verändern. | `mission-authority-core.js:789` sperrt andere Ausführungsrezepte als APT für Routenänderungen. Für POI Arbeitsziel, Heimat-/Abschlussanker und editierbare Navigation ausdrücklich trennen; das ist kein Auftrag, automatisch neue POI-Taskgeometrie aus Navigationspunkten abzuleiten. |

### Bereits vorhandene gemeinsame Lösungen

Keine zweite Implementierung benötigen die globale, auch über unterschiedliche
Jobs exklusive Audio-Lease, adressierte Geräteauswahl, begrenzter Audio-Download,
Playback-Recovery, stabile Effekt-IDs, Revision/Hash/Replay und die gemeinsame
asynchrone ACK-Nachbearbeitung. Die POI-Voice nutzt diese Infrastruktur bereits;
Text-Ready vor TTS wurde in Abschnitt 11 separat korrigiert. Vollständige
UI-/Relay-/Desktop-/MSFS-Nachweise bleiben Integrationsprüfungen.

Die begrenzte Historie zur Annahme kompatibler Cargo-Intents und das atomare
Cargo-Batching sind ebenfalls gemeinsame Bausteine. Sie dürfen beim POI-Anschluss
nicht durch pauschales Akzeptieren veralteter Revisionen ersetzt werden.

### Bewusst nachgelagert und Aussagegrenze

Das EFB-/Toolbar-Debrief, Flightlog-Explorer/Export/Langzeitverwaltung und das
endgültige komprimierte Cloud-Fluglogmodell sind im APT-Entwicklungsplan explizit
nachgelagert. Sie werden nicht nachträglich zu POI-Freigabeblockern erklärt.
Das bestehende App-Debrief und korrekte Abschlussdaten bleiben erforderlich.

Dieser Abgleich ist eine Dokumentations-/Codeprüfung. Er ergänzt die Arbeitsliste;
er ändert weder Ausführungscode noch Gates und behauptet keinen neuen Feldtest.
Priorität: gemeinsame Flug-/Bodenbeobachtung und Recorder, daran die allgemeinen
Voice- und Ergebnisregeln, dann kompletter Start/Cargo/PAX/Abschluss mit Recovery,
Seed und kanonische UI. Die oben genannten Fehler- und Mehrgerätefälle gehören
in den Nachweis jedes jeweiligen Schritts.

## 13. Vollständiger Standard-POI-Anschluss

Stand: 15.09.2026, lokal implementiert und automatisiert geprüft. Dieser Abschnitt
ersetzt die offenen **Code-Anschlussbefunde** aus Abschnitt 10 und 12; deren
historische Beschreibung bleibt als Begründung erhalten. Feldfreigabe und Release
sind getrennt vom Code-Nachweis zu behandeln.

### Originalregeln und Modulgrenzen

`mission-poi-lifecycle-core.js` übernimmt die Originalfunktionen für Endbereitschaft,
Flugnachweis, Heimkehr, Status, POI-Ergebnis und Cargo-Stress aus
`mission-runtime-core.js`, `sync.js` und `mission-cargo-core.js`.
`tools/generate-poi-lifecycle-core.mjs --check` erkennt Abweichungen zur App-Quelle.
Die eingefrorene Referenz unter `tools/fixtures/` wird nicht mitgeneriert.
Der Lifecycle ergänzt den bereits extrahierten Task- und Voice-Kern. Die
Standalone-App verwendet weiterhin ihre ursprünglichen Lifecycle-Aufrufer.

- Erfolg und Abschlussfreigabe bleiben getrennt. Erfüllter oder abgebrochener Task
  führt in den Rückflug, nicht unmittelbar zum Missionsabschluss.
- Die originale POI-Bodenfreigabe gilt nach ausreichendem Flug-/Tasknachweis auch
  außerhalb der Heimat. Stillstand: am Boden und GS ≤ 2 kt oder Parkbremse.
  Heimatnähe bleibt 0,35 NM. Der separate Heimflugwunsch wird im Ergebnis erhalten.
- Ein unerfüllter/abgebrochener Task oder eine fehlgeschlagene Frachtlieferung darf
  als fehlgeschlagene Mission beendet werden. Manifest-, Signatur-, Entlade- und
  Compliance-Gates bleiben verbindlich.
- Der gemeinsame Recorder liefert Start, Airborne, Pausen, Segmente, Touchdown und
  Bordbuchdaten. Der einmal bestätigte POI-Flugnachweis überlebt Segmentwechsel.
  Live-G/Bank/Sinken und gespeicherte Flugwerte beeinflussen Cargo vor der Taskprüfung;
  Originalschwellen und Motion-Protection bleiben erhalten.
- Der Original-Farewell benutzt bei fehlgeschlagenem Ergebnis einen festen Text.
  Dieser wird direkt ausgegeben; es wird daraus kein neuer KI-Prompt gemacht.
  Erfolgreiche Abschiede nutzen den Originalprompt. Die originale Priorität eines
  bestätigten Taskerfolgs im Fallback bleibt unverändert.

`extract-original-function.mjs` prüft extrahierte Funktionsgrenzen per Parser,
ohne die App auszuführen. Damit werden nachfolgende Browser-Registrierungen nicht
versehentlich in den generierten Kern kopiert.

### Vollständiges Rezept und Alpha-Gate

Der App-Builder `_buildMissionPoiExecutionSeed` liefert zusammen:

- `ga.mission-poi-execution-recipe.v1` mit `ga.mission-poi-lifecycle.v1`,
  Original-Taskparametern, Schwierigkeit, Arbeitsziel, Heimat und Voice-Kontext;
- `ga.mission-poi-effect-plan.v1` aus den vorhandenen App-Szenen-/Cargo-/PAX-/Cue-
  und Boarding-Buildern; gemeinsame Flugansagen erhalten ihren passenden Kontext;
- einen Farewell-Verweis auf den einmal gespeicherten POI-Voice-Kontext;
- die originale Zielszene mit festem Punkt und Terrainhöhe. Fehlt die Terrainbasis,
  wird sie angefordert und noch kein ausführbarer Seed angeboten.

Explizit leere Szenen werden als `none` markiert. Fehlende oder ungültige
Szenenkommandos, falsche Mission-IDs, ungültige Boarding-Rezepte und unaufgelöste
Zielpositionen blockieren die Übernahme. Die physischen Kommandoprüfungen verwendet
auch die Simulator-Bridge. Spezialaufträge (Survey, POI-Kette, Training, SAR, Bush)
sind weiterhin kein Standard-POI-Vertrag.

Tracker v405 bietet `mission.poi.v1` nur mit
`VFR_MULTITOOL_POI_EXECUTION=1` **und** aktivierter bestehender Alpha/APT-Ausführung
an. Die Standardeinstellung bleibt aus; die Stable-Mindestversion steigt nicht.
Manager, Cloud-Kandidat, App-Handoff, Runtime und Effektpumpe prüfen denselben
vollständigen Vertrag. Interne Task-only-Fixtures schalten keine produktive
Capability frei. Die Übernahme ist wie bei APT auf `planned`, Revision 0, ohne
Effekte begrenzt. Geänderte Planned-Seeds werden aktualisiert; eine kurzfristige
Capability-Lücke darf keinen zweiten App-Ausführungspfad eröffnen.

### Umsetzung der APT-Befunde aus Abschnitt 12

| Befund | Implementierter Anschluss und Nachweis |
| --- | --- |
| Allgemeine Flugansagen / Recorder | Der frühe POI-Return gilt nur noch für interne Teilrezepte. Vollständige POI-Runs erreichen Recorder, Komfort, falschen Start, Fortsetzung, Landing-Roll und Cargo-Abwurf. Der Arbeitsziel-Detektor ersetzt den APT-Anflug. Eine gültige POI-Ausweichlandung löst keine falsche APT-Landeortwarnung aus. |
| Manuelle PAX | Vollständiger Szenenplan und gemeinsame Bridge führen Aus-/Wiedereinsteigen mit Originalwartezeiten, Busy und Timeout/Rollback aus. POI-Integration prüft echte Passenger-Items, Türkommandos, Signaturverlust und Busy nach Reconnect. Der gemeinsame Bridge-Test deckt den 70-s-Timeout ab. |
| Cargo / Equipment / Payload / Cues | Die vollständige POI-Effektpumpe führt Item-Transition, Payload-Sync und Cargo-Audio aus. Objekt-Revisionen, Equipment-Schlüssel, Gegenaktions-Batching und Cues ohne TTS verwenden die geprüften APT-Handler. POI prüft reale Manifest-Transitions und ursprüngliche Stressschäden; die gemeinsame Payload-Suite prüft Standard-/PA-24-Baseline und Equipment. |
| Farewell | Original-Prepared-Context ergänzt Task, Abbruch, Heimkehr und aktuelles Cargo-Ergebnis. Prewarm arbeitet auf einer privaten Prognose; Ausgabe prüft den aktuellen Kontext/Fingerprint erneut. Gespeicherte Touchdown-Fakten bleiben erhalten. Ein fehlgeschlagener Recorder-Commit hält den Effekt ausstehend. |
| Finales Deboarding | POI wartet wie APT auf Szenen-Cue, Farewell, Fortsetzungsbefehl und physisches Deboarding-ACK. Passenger-Items bleiben bis dahin geladen. Ein vollständiger POI-Test prüft diese Reihenfolge. |
| Abschluss-Recovery | Auto-Close gilt auch für vollständige POI-Runs. Neustart direkt nach Entladebestätigung und nach Close-ACK führt denselben Abschied/Abschluss genau einmal fort. Der Recorder wird bei POI-Finalisierung vor dem ersten Telemetrietick aus dem Checkpoint geladen; sonst konnte ein gespeicherter Bericht durch einen leeren Zustand ersetzt werden. Schreibfehler halten den Run; Wiederaufnahme oder ein gedrosselter Retry im Telemetrietakt finalisieren ohne erneuten Abschied. |
| Reset / Clear / Ersatzmission | Der gemeinsame Cleanup-Pfad ist für POI erreichbar. Er muss Payload und alle Missionsszenen vor Authority-Freigabe bereinigen. Der POI-Test bestätigt Run-Erhalt bei Fehler und Freigabe erst nach erfolgreichem Retry. Reset-/Clear-/Reload-Semantik und Baseline-Verifikation bleiben im gemeinsamen APT/App-Vertrag. |
| UI / Text | `mission-poi-ui-core.js` ergänzt originale POI-Status-/Ergebnis-/Heimkehrtexte und benutzt die gemeinsamen Cargo-, Signatur- und Fensterbausteine. App/EFB zeigen `voice.poi` bereits nach Text-Ready. Spätes Audio-ACK erhält den ursprünglichen Textzeitpunkt. Zwei unabhängig erzeugte EFB-Projektionen sind identisch. |
| Seed / Handoff / Reconnect | App und Cloud übernehmen vollständige POI-Seeds. Gate und Run-/Revisionsprüfung bleiben auch vor Legacy-Versand wirksam. Bestehende Cargo-Rebase-/ACK-/Handoff-Tests werden mitgeprüft. Kein Midflight-Handoff eingeführt. |
| Größenbudgets / langer Lauf | Voice-Kontext wird referenziert statt für Farewell dupliziert. Ein Lauf mit rund 52 KiB Kontexttext und 340 späteren Ereignissen bleibt unter dem 384-KiB-Resume-Limit, kompaktiert auf höchstens 160 Events und erhält wartende POI-Voice sowie Duplikatbelege über Neustart. Ein vollständiger Cloud-Seed wird zusätzlich gegen das 256-KiB-Budget geprüft. |
| Navigation | POI ist an die vorhandene eigene Navigationsrevision angebunden. Routenänderungen und Neustart verändern weder Arbeits-/Heimatanker noch Execution-Hash oder Taskfortschritt. |

### Persistenz- und Scheduler-Korrekturen

Die lokale Fünf-Sekunden-Kadenz bleibt bestehen. Übergänge, gültige Intents,
Disconnect und reguläres Prozessende sichern vorher Task und Recorder.
Ungültige/alte Telemetrie und Pausen dürfen keine Bodenfreigabe oder neue Taskzeit
begründen. Bei Wiederaufnahme werden lokale Timing-Kandidaten unterbrochen;
Offlinezeit ist kein Flug-/Arbeitsnachweis. Ein harter Prozessverlust kann weiterhin
den letzten noch nicht gesicherten Zeitraum von bis zu fünf Sekunden verlieren.

Ein leerer POI-Flush vor einem Intent darf keine konkurrierende leere Effektpumpe
starten. Andernfalls konnte die nachfolgende Missionsvorbereitung zwar gespeichert
sein, ihr Dispatch aber bis zum nächsten Trigger liegenbleiben. Nur echte
Checkpoint-Ereignisse beziehungsweise der Telemetrie-Treiber starten diesen Drain.

### Automatisierter Nachweis

Aktueller gemeinsamer Lauf: **255 Tests bestanden**, einschließlich 16 neuer
vollständiger POI-Lifecycle-/Integrationsfälle. Er umfasst Execution-Core, Authority,
Handoff, Runtime, Adapter, Simulator-Bridge, Payload, Cargo-Audio, Flight-/Boarding-/
Farewell-/Compliance-Voice, VoiceService, Navigation und EFB-Projektion.

Zusätzliche Originalvergleiche:

- **10.450** Task-/App-Fälle einschließlich Zustandsfolge, Persistenz, Logs und Delay;
- **1.344** Task-Prompt-/Memory-Fälle;
- **4.320** Lifecycle-/Ergebnis-/Heimkehr-Fälle;
- **192** exakt verglichene Farewell-Prompts beziehungsweise feste Abschiedstexte;
- **864** Cargo-Stress-Fälle einschließlich Schutzmodus und unveränderter Eingabekopie.

Beide Generator-Driftprüfungen bestehen. Test-Einstieg für den vollständigen Pfad:
`ga-tracker-client/tracker-mission-poi-lifecycle.test.js`; Originalvergleiche unter
`tools/mission-poi-*-differential-selftest.mjs`.

Diese Tests verwenden reale Authority-/Runtime-/Effektmodule, aber simulierte
Provider und Simulator-I/O. Sie belegen keine tatsächlichen MSFS-Objekte,
PA-24-Sitze, hörbare Desktop-Ausgabe oder Netzwerkzustellung auf zwei Geräten.
Vor Standardfreigabe sind App-geschlossen-Flug, Gerätewechsel, Sim-Trennung,
Neustart, Ausweichlandung, Fehlschlag, PAX/Cargo und Reset im Feld zu prüfen.
EFB-Debrief, Log-Explorer/Export und ein neues Cloud-Langzeitlog bleiben die
bereits dokumentierten nachgelagerten APT-Themen.

### Build- und Veröffentlichungsstand

Tracker-Version lokal auf v405 erhöht. Der lokale Windows-Build wurde mit
`npm run build:tracker -- --no-bytecode --public-packages '*' --public` erstellt.
Der Standard-Bytecode-Build scheiterte hier am nicht ausführbaren x64-Buildhelfer
(`spawn … -86`); der Ersatzbuild enthält JavaScript-Quellen statt V8-Bytecode.
Der pkg-Cache liegt für den Build im beschreibbaren temporären Verzeichnis.
Kein Windows-Starttest aus dieser macOS-Sitzung.

Die EXE wurde **nicht veröffentlicht**. Der Worktree enthält auch unabhängige,
uncommittete Missions-/UI-/Worker-Änderungen. Vor einem Release müssen die gewünschten
Quellen isoliert, daraus neu gebaut und nach dem
[verbindlichen Push-/Release-Workflow](github-push-workflow.md) veröffentlicht werden.
`alpha.json` und `stable.json` wurden für diese POI-Änderung nicht umgestellt.
Der lokale Build ist deshalb ein Entwicklungsartefakt, kein zugesichertes Release-Artefakt.

## 14. Erneute Verdrahtungsprüfung: noch offene Abweichungen

Historischer Prüfstand vor v406. Alle vier nachfolgend beschriebenen Befunde sind
in Abschnitt 15 bearbeitet; die Reproduktionen bleiben als Migrationsgrundlage erhalten.

15.09.2026, Codeprüfung nach Abschnitt 13. Der normale automatisierte POI-Ablauf
ist angeschlossen, aber die Aussage einer vollständigen Verdrahtungs-/Bedienparität
war zu weitgehend. 78 vorhandene POI-/Lifecycle-/Boarding-/Flight-Voice-Tests bestehen
weiterhin; zusätzliche lokale Proben zeigen die folgenden nicht abgedeckten Fälle.
In dieser Nachprüfung wurden keine Laufzeitregeln geändert.

### P1: Pause erreicht den POI-Tasktreiber nicht

`tracker-mission-execution-runtime.js` leitet im vollständigen Lifecycle nur Samples
mit Adapterstatus ungleich `ignored` an `poiDriver.observeTelemetry` weiter. Der
Adapter liefert bei Pause/Menü jedoch genau `ignored`. Die korrekt implementierte
Suspend-Logik des POI-Treibers wird damit im vollständigen Pfad übersprungen.

Probe mit echter Authority/Runtime, zwei Minuten Verweilauftrag am Ziel, anschließend
120 Sekunden Sim-Pause: `suspendedAt` bleibt `null`, `enteredAt` unverändert;
die bestätigte Verweilzeit steigt beim ersten Folgesample von 4 auf 14 gewichtete
Sekunden. Auch Reklamations-/Schonfristen werden nicht um die Pause verschoben.
Die vorhandenen direkten Treibertests beweisen dessen Suspend-Verhalten, nicht
die Weiterleitung durch den vollständigen Adapterpfad.

Gezielte Lösung: Pause-/Menüsamples an den POI-Suspend-Pfad weiterleiten, ohne
fachliche Flug-/Bodenübergänge aus ihnen abzuleiten. Integrationstests für Dwell,
Höhenreklamation, Pause ohne Position und Resume ergänzen.

### P2: Komfort-Bewegungsanalyse erhält zu wenige Samples (auch APT)

Der produktive Tracker ruft die Missionsruntime hinter `SEND_INTERVAL_MS = 500`
auf. Die unverändert extrahierte Komfortanalyse benötigt mindestens 12 Samples
in ihrem 3.500-ms-Fenster. Bei 500 ms passen höchstens acht hinein; die Analyse
bleibt damit unter ihrer Mindestmenge. Das betrifft abgeleitete Turbulenz und die
Bewegungsbestätigung des direkten Turbulenzwerts, nicht pauschal alle Komfortwarnungen.
G-/Bank-/Wind-/Sinkratenregeln sind separat zu beurteilen.

Probe mit derselben wellenförmigen Telemetrie und demselben Voice-Core:
250-ms-Takt → 15 Samples, drei Bewegungssignale, Turbulenz erkannt;
500-ms-Takt → acht Samples, null Bewegungssignale, keine Erkennung.
Die bisherigen Flight-Voice-Tests verwenden 250 ms und prüfen nicht die reale
Tracker-Zuführung. Dies ist ein gemeinsamer APT-/POI-Befund; nicht als neue
POI-Fachregel beheben.

Gezielte Lösung: lokale Bewegungsanalyse mit ausreichender Quellfrequenz versorgen;
500-ms-Relay und gebündelte Persistenz getrennt halten. Originalschwellen nicht
zum Verdecken des Zuführungsfehlers absenken. Umsetzung nach Freigabe des
familienübergreifenden Eingriffs gemäß AGENTS.md.

### P2: Tracker-Projektion wird durch Legacy-Restore umgedeutet

`applyTrackerExecutionControl` übergibt `control.poiTask` an
`paxVoiceRestorePoiMissionProgress`. Der bisherige Wiederhersteller setzt bei
`dwellSec > 0` jedoch `_poiInRadius = true`, ohne das explizite `inRadius` des
Snapshots zu beachten. Eine Probe mit `inRadius:false, dwellSec:4` ergibt lokal
`_poiInRadius:true`. Die kanonische Tracker-/EFB-Projektion bleibt korrekt, aber
App-Funktionen mit Legacy-POI-Variablen können weiterhin „Datenaufnahme läuft“
melden, obwohl das Flugzeug den Radius bereits verlassen hat.

Gezielte Lösung: bestätigte Tracker-Projektionen exakt übernehmen; die heuristische
Wiederherstellung alter Standalone-Snapshots separat behandeln. Regression für
Eintritt, Verlassen mit Rest-Dwell, Wiedereintritt und Reload ergänzen.

### P2: Manuelle POI-Sprachaktionen noch nicht autonom

Die App-Schaltflächen „Missionsstatus“ und „Orientierung“ rufen weiterhin
`paxMissionStatusReport` beziehungsweise `paxMissionOrientationHelp` auf. Diese
bauen ihre Prompts mit lokalem App-Kontext und rufen `_missionActionSpeak` auf.
Für diese Aktionen existieren weder entsprechende Tracker-Missionsintents noch
ein EFB-Aufrufpfad. Gemeinsame TTS-/Playback-Lease allein macht die lokale
Textentscheidung nicht zu einer autoritativen, auf allen Geräten verfügbaren Aktion.

Gezielte Lösung: Originalaktionen und benötigte Kontextdaten in eigene
Tracker-Intent-/Voice-Rezepte übertragen; Texte über die bestätigte Voice-Projektion
anzeigen. Bis dahin ist der automatische Ablauf angeschlossen, die gesamte
Standalone-Sprachbedienung aber noch nicht portiert. Die SAR-Fundmeldung bleibt
als bewusst nicht migrierter Spezialauftrag getrennt.

### Einschätzung und Reihenfolge

Für einen kontrollierten ersten Standard-POI-Testflug wirkt der normale
Start–Arbeitsziel–Rückflug–Entladen–Abschluss-Pfad lauffähig. Eine vollständige
Paritätsfreigabe ist mit diesen offenen Fällen nicht gerechtfertigt. Zuerst Pause
und exakte App-Projektion korrigieren, dann die gemeinsame Komfort-Zuführung und
manuellen Sprachaktionen vervollständigen. Feldtests bleiben zusätzlich notwendig.

## 15. Korrekturen vor dem ersten Feldtest (v406)

15.09.2026, nach ausdrücklicher Freigabe der vier Befunde einschließlich der
gemeinsamen APT-Komfortkorrektur. Alle vier Code-Anschlüsse sind umgesetzt.

### Pause und exakte Projektion

- Der vollständige Runtime-Einstieg reicht Pause/Menü vor dem Adapter-Filter an
  den POI-Tasktreiber durch. Auch ohne gültige GPS-Position liefert der produktive
  Tracker den Suspend-Status. Recorder-Suspend wird einmal pro Pause gespeichert;
  ein Schreibfehler bleibt wiederholbar.
- Der Integrationstest mit 120 Sekunden Pause prüft verschobene Task-/Reklamationsuhren:
  nach dem Resume wächst Dwell nur um die tatsächlich verstrichene Flugsekunde
  (im Test gewichtet von 4 auf 6). Beide Wege, mit und ohne Position, sind geprüft.
- `tracker-projection` übernimmt den bestätigten Detektorstatus exakt, einschließlich
  `inRadius:false` bei vorhandenem Rest-Dwell. Die alte Standalone-Restore-Heuristik
  bleibt für alte lokale Snapshots erhalten. Private Taskuhren bleiben im Tracker.

### Komfort-Zuführung für POI und APT

`tracker-flight-motion-buffer.js` sammelt lokale SimConnect-Bewegungssamples vor
dem 500-ms-Relay-Takt: mindestens 100 ms Abstand, 3.500-ms-Fenster, maximal 48
Einträge. Pause, ungültige Werte, Lücken über 750 ms und Runwechsel verwerfen
den alten Verlauf. Es entstehen keine Netzwerkaufrufe oder Disk-Schreibvorgänge
pro Bewegungssample. Entscheidungen bleiben im bisherigen Runtime-Takt und
Checkpoints weiterhin gebündelt.

Die extrahierte Originalanalyse bekommt diesen Verlauf plus das aktuelle Sample.
Ihre Mindestmenge von 12 Samples und ihre Schwellen bleiben unverändert.
Tests prüfen POI **und APT** sowie den vollständigen Runtime-Pfad mit 100-ms-Quelle
und 500-ms-Entscheidungen. Eine ausreichend schnelle Simulatorquelle bleibt nötig;
bei unzureichenden Daten wird weiterhin keine Bewegungserkennung erfunden.

### Manuelle POI-Sprachaktionen

- Originalfunktionen für „Missionsstatus“ und „Orientierung“ bleiben in der App
  unverändert als Standalone-Aktionen erhalten. Der POI-Voice-Generator übernimmt
  dieselben Funktionen samt Status-, Geometrie- und Orientierungshilfen.
- Der Seed erhält Zielname und originalen statischen Kartenbezug. Der vorhandene
  Städte-Lader wird vor der Übergabe abgewartet; bei dessen Ladefehler bleibt die
  bestehende leere Datenbasis/Fallback-Regel gültig. Nur der resultierende Text
  gelangt in den Seed, keine Städtedatenbank und kein zusätzlicher Tracker-Download.
- Unter Tracker-Authority senden App und EFB `poi_status` beziehungsweise
  `poi_orientation` durch die echte Cockpit-Allowlist. Run/Revision, Busy-Sperre
  und Duplikaterkennung gelten auch für diese Aktionen. Position/Höhe kommen vom
  Simulator, Taskzustand und narrative Memory vom bestätigten Run.
- `POI_ACTION_VOICE_REQUESTED` speichert das Originalrezept als `voice.poi`-Effekt.
  Neustart verwendet dasselbe vorbereitete Rezept; Text wird vor TTS bestätigt.
  Bei fehlendem Provider wird der originale feste Fallback veröffentlicht.
  Vorflug-Anfragen sind möglich; Abschluss/Abbruch sperren weitere Anfragen.
- App und EFB zeigen das bestätigte Label und den Text. Im EFB gibt es beide
  Aktionen und einen schließbaren POI-Texthinweis. Text wird ohne HTML-Interpretation
  gerendert; ein spätes ACK öffnet einen geschlossenen Hinweis nicht erneut.
  Die bestehende zentrale Audioausgabe und Playback-Lease bleiben zuständig.

### Nachweise und Grenzen

- 266 gemeinsame Authority-/Runtime-/Voice-/Cargo-/Simulatoradapter-/EFB-Tests
  bestanden. Nach der abschließenden Live-Höhenkorrektur wurden die 51 betroffenen
  Lifecycle-/Adapter-/Motion-/EFB-Tests nochmals erfolgreich ausgeführt.
- 19.474 Vergleiche gegen eingefrorene Originalfunktionen: 10.450 Task,
  1.344 automatische Voice, 2.304 manuelle Sprachaktionen, 4.320 Lifecycle,
  192 Farewell und 864 Cargo-Stress. Prompts, Fallbacks und Labels werden exakt
  verglichen; daraus folgt keine Garantie für identische stochastische Modellantworten.
- Alle drei Generator-Driftprüfungen und Syntax-/Whitespace-Prüfungen bestanden.
- Lokale Windows-Test-EXE v406 gebaut; Builddetails siehe unten. Kein MSFS-Lauf
  auf diesem macOS-Rechner. Szene, reale TTS-/Audioausgabe, zwei Geräte und
  Wiederanlauf müssen noch im Feld geprüft werden. Die Alpha-POI-Sperre bleibt erhalten.

### Lokaler Build und Release

Build mit `PKG_CACHE_PATH=/tmp/ga-poi-pkg-cache npm run build:tracker -- --no-bytecode --public-packages '*' --public`.
Wie beim vorherigen lokalen Build wird der macOS/x64-Bytecode-Helfer umgangen;
die Windows-EXE enthält JavaScript-Quellen. Prebuild erzeugte EFB-Dateien wurden
nach dem Build auf ihren zuvor vorhandenen Workspace-Stand zurückgesetzt.
Die EXE enthält den zum Buildzeitpunkt erzeugten Stand.

Geprüft: Windows-PE-Header, v406-Kennung, Motion-Puffer, POI-Intent und EFB-Anzeige
im Artefakt. Größe: **57.625.783 Bytes**;
SHA-256: `321ad315f6faa96d19ff404f9f12bf44c5082e69f48bdb606436fea77b688a20`.

**Nicht veröffentlicht:** Der gemischte Worktree enthält weiterhin unabhängige
uncommittete Änderungen; das Entwicklungsartefakt enthält diesen lokalen Stand.
Für den verpflichtenden Release gemäß `github-push-workflow.md` müssen die
gewünschten Quellen isoliert und daraus reproduzierbar gebaut werden.
Die Kanaldateien wurden für v406 nicht umgestellt.

## 16. Origin-/Alpha-Release v408

Der Nutzer hat den Rollout freigegeben. Origin hatte inzwischen v406 und v407
für andere Änderungen veröffentlicht. Der POI-Release wird deshalb auf dem
aktuellen Origin-Stand `992deab85` als **v408** gebaut. Die isolierte Integration
erhält die neueren privaten/Vereins-/EFB-Änderungen und die Banner-Rücknahme.
Tile-Workbench enthält keine zusätzlich zu integrierenden Commits.

Release-Prüfung korrigiert außerdem die Browser-Ladereihenfolge (Taskkern vor
Voicekern) und einen im Coherent-Host nicht zulässigen Texttrenner. Ein Test lädt
die Browser-Kerne in tatsächlicher HTML-Reihenfolge und führt Orientierung aus.
EFB-Assetrevision 40801 stellt die neuen Bedienelemente bereit. Die generierten
EFB-Assets sind nach dem Prebuild unverändert gegenüber Origin.

Das Artefakt wird aus dem isolierten Quellstand erneut gebaut; der frühere lokale
v406-Build ist ausdrücklich nicht das Release-Artefakt.

Windows-EXE: 57731671 Bytes, SHA-256 `ccac302514717d0981235c373ad27e512328b579494a7a6d143d8aff9af14d30`.

Release/Alpha-Zeiger: `v408`; Stable bleibt unverändert. Die Kanalumschaltung
folgt erst nach bestätigtem Release-Upload und Hashprüfung. Aktivierung und
Feldtestgrenzen: [Releasebeschreibung](Tracker%20v408%20POI%20Alpha%20Release.md).

Finaler Release-Nachweis: 294 gemeinsame Tests, 53 ergänzende EFB-/Club-/Routenprüfungen
und 19.474 Originalvergleiche bestanden. Generatoren ohne Drift.

Release `v408` und öffentlicher EXE-Download sind verifiziert. Der Alpha-Zeiger
wird mit App-Cache v1772 veröffentlicht; Quellcommit `376bb852e`.
