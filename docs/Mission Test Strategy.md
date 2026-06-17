# Mission Test Strategy

Diese Anleitung beschreibt, wie neue oder geaenderte Missionen sauber getestet
werden, bevor sie gepusht oder im Sim laenger ausprobiert werden. Sie gilt fuer
POI-, APT-, Bush-, SAR-, Knowledge-, Mapping-/Survey-, Cargo- und
Passenger-Missionen. Spezielle Missionstypen bekommen zusaetzliche Pruefpunkte,
aber die Grundkette bleibt gleich.

## Ziel

Der Test soll nicht nur pruefen, ob eine Mission erzeugt wird. Er muss
bestaetigen, dass die ganze Kette zusammenpasst:

- Picker/Profil waehlt den richtigen Missionstyp
- Mission, Contract, Passenger und Runtime behalten dieselbe TaskDomain
- Zieltyp, POI-Kategorie, Airport oder Bush-Strip bleiben der Primaerfokus
- Briefing, Cargo/PAX, Voice und Szene widersprechen sich nicht
- MissionTruth, SceneIntent und Geo-Kontext ergaenzen das Ziel, ersetzen es aber
  nicht
- Trigger, Overlays, Ground Actions oder Pattern-Logik sind erreichbar
- Restore/Snapshot/Sync koennen den Missionszustand weitergeben
- andere Missionen werden nicht durch neue Speziallogik belastet

## Teststufen

### 1. Worktree und Scope klaeren

Vor jedem Testlauf:

```bash
git status --short
```

Nur die erwarteten Dateien anfassen. Analyse-Dateien unter `analysis/` sind
Arbeitsartefakte und werden nur committed, wenn sie bewusst als Evidenz
gebraucht werden.

### 2. Betroffene Missionsteile einordnen

Vor den Dryruns kurz klaeren, welche Schichten betroffen sind:

- Picker/Profile: Kategorie, Profil, TaskDomain, Rollenprofil
- Contract/Writer: Briefing, StoryFrame, MustMention, MustAvoid
- Passenger Voice: Greeting, Boarding, Zielhinweise, Abschluss
- Runtime: Phasenwechsel, Dwell, Cargo, Ground Actions, Pattern oder Follow-up
- Scene: Zielszene, Boarding, APT Arrival, SimObjects, Smoke/Fire
- Persistence: Runtime-Snapshot, Restore, Cloud Sync, Debug Snapshot
- UI/Map: Overlay, Marker, Route, Autozoom, Mission Controls

Nur die betroffenen Schichten brauchen tiefe Spezialtests. Die Grundchecks unten
bleiben immer Pflicht.

### 3. Syntax und Basismodule pruefen

```bash
node --check app.js
node --check passenger-voice.js
node --check sync.js
```

Weitere Dateien je nach Aenderung:

- `node --check mission-survey-pattern.js`
- `node --check mission-cargo-core.js`
- `node --check mission-runtime-core.js`
- `node --check <betroffene-mission-scene-datei>.js`, falls vorhanden
- `node --check tools/<betroffenes-tool>.mjs`

Erwartung: keine Syntaxfehler.

### 4. Mission-Pipeline-Dryruns erzeugen

Dryruns sollen deterministisch zeigen, dass Picker, Ziel, Contract, Writer,
Passenger und Szene zusammenpassen. Sie duerfen synthetische Ziele verwenden; das
sind Testanker, keine echte Dispatch-Auswahl.

Allgemeines Muster:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=6 --profile=<profil> --categories=<cat1,cat2,...> --out=<name>.json
```

Oder explizite Zieltypen:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=4 --types=poi:<category>+<profile>,apt:<profile> --out=<name>.json
```

Beispiele:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=6 --profile=search_and_rescue --categories=road,forest,water,mountain --out=sar-forced.json
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=4 --types=poi:city+historian_guided_tour,poi:castle+historian_guided_tour --out=historian-city-castle.json
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=4 --types=poi:city+news_coverage,poi:road+news_coverage --out=news-poi.json
```

Erwartung:

- alle Runs erzeugen eine Mission
- `profile`, `appliedProfile`, `roleProfile` und `taskDomain` passen zusammen
- Zielname, Kategorie und MissionTruth bleiben stabil
- Briefing erzaehlt einen konkreten Auftrag, keine interne Planungslogik
- Passenger/Cargo passen zur Rolle und Mission
- SceneIntent passt zum Contract und erzeugt keinen anderen Auftrag
- bei Return-Missionen ist klar, ob Zielabschluss, RTB oder APT-Arrival
  erwartet wird

### 5. Sichtbare Texte pruefen

User-facing Texte muessen aus Pilotensicht spielbar sein:

- klare Antwort auf Wer, Warum, Wo, Was und wann die Aufgabe fertig ist
- keine internen Begriffe wie `Pipeline`, `Contract`, `Planner`,
  `Candidate`, `mustAvoid`, `TaskDomain`
- keine technischen OSM-Anker als Erzaehlsubjekt, wenn ein echter Zielname
  vorhanden ist
- keine Drift in eine andere Mission: Sightseeing bleibt Sightseeing, SAR bleibt
  SAR, Cargo bleibt Cargo
- lokale Fakten duerfen konkretisieren, aber den Primaerfokus nicht ersetzen
- Voice-Meldungen wiederholen nicht stumpf das Briefing

### 6. Contract- und Runtime-Weitergabe pruefen

Die JSON-Ausgaben unter `analysis/` pruefen. Pro Run muss gelten:

- Mission und Contract enthalten denselben Zielnamen und dieselbe TaskDomain
- `missionContract` oder `missionContractV4` ist vorhanden
- Passenger enthaelt die erwartete Rolle und Toleranzen
- MissionTruth enthaelt den richtigen Primaeranker
- SceneIntent/TargetGeoContext ergaenzen den Auftrag statt ihn umzudeuten
- Runtime-relevante Zusatzdaten sind im Mission-Objekt und im Contract
  vorhanden, nicht nur in einem Debug-Feld
- Snapshot/Restore behalten diese Zusatzdaten, wenn die Mission spaeter
  fortgesetzt werden muss

Typische Zusatzdaten:

- Cargo: Manifest, Pickup/Unload-Ziel, Ground-Action-Status
- Knowledge Guide: Knowledge Context, Faktenliste, Fact-Progress
- Mapping/Survey: `surveyPattern`
- SAR: Incident-Familie, Suchraum, Zielobjekt, SceneTarget
- APT Training: Uebungsprofil, Zielplatz, Platzrunde/Approach-Kontext
- Follow-up: Follow-up-Request, Zeitraum, Ursprung und Ziel

### 7. Speziallogik isoliert testen

Jede Speziallogik braucht einen kleinen Test gegen ihr eigenes Modul oder ihre
eigene Runtime-Schnittstelle. Der Pipeline-Dryrun allein reicht dafuer nicht.

Beispiele:

- Mapping/Survey: Pattern-Selftest plus synthetische Flugspuren
- Cargo: Load/Pickup/Unload-Transition und Manifest-Erfuellung
- Knowledge Guide: Faktenabruf, Faktlimit, keine internen Quellenhinweise im
  Briefing
- SAR: Incident-Familie, Scene-Objekte, keine Mischlage
- APT Training: Phasen, Instructor-Feedback, Abschluss ohne normale
  Sightseeing-Dwell-Logik
- News/Photo/Historian: Rollenstory, Anlass, Zielbezug, keine generische
  Sightseeing-Ausgabe

### 8. Overlay, Szene und Trigger pruefen

Wenn eine Mission sichtbare Kartelemente, SimObjects oder Trigger nutzt, muss
geprueft werden:

- Overlay entsteht aus Mission/Contract-Daten
- Overlay wird bei Missionwechsel geloescht oder aktualisiert
- Trigger sind aus echter oder synthetischer Telemetrie erreichbar
- Fehlerpfade blockieren den Ablauf nicht dauerhaft
- abgeschlossene Teilziele bleiben abgeschlossen, wenn das fachlich so gedacht
  ist
- Scene Spawn/Clear erzeugt keine fremde Szene und keinen Zielwechsel
- APT Arrival, Boarding und Endszene kollidieren nicht mit der Zielszene

### 9. Browser-Smoke

Wenn ein lokaler Server laeuft:

```bash
curl -I http://127.0.0.1:8080/index.html
```

Zusaetzlich alle neuen Browser-Skripte:

```bash
curl -I http://127.0.0.1:8080/<neues-script>.js
```

Erwartung:

- HTTP 200
- richtige Auslieferung des neuen Skripts
- keine Console-Errors beim Laden der App
- Mission kann im UI erzeugt werden
- Debug Snapshot zeigt die erwarteten Missionsteile

### 10. Manueller Sim-Test

Dryruns ersetzen keinen kurzen echten Flugtest. Live pruefen:

- Mission startet ohne haengende Dialoge
- Boarding/Start/Enroute/Ziel/RTB/Close wechseln nachvollziehbar
- relevante Voice-Meldungen kommen ohne spuerbare Latenz
- Trigger reagieren auf echte Telemetrie
- falsche Hoehe, Drift, Groundspeed oder OnGround-Schwellen verhalten sich
  erwartbar
- Mission bleibt nach Abschluss schliessbar und wiederherstellbar

Live ist besonders wichtig fuer GPS-Jitter, Update-Frequenz, echte Hoehenwerte,
Tracker-/Websocket-Aussetzer und UI-Reaktionszeit.

## Missionstyp-spezifische Add-ons

### Mapping/Survey

Zusatzchecks fuer Missionen mit `taskDomain: mapping_survey`, besonders fuer
Survey-Pattern mit Nord-Sued-Linien und Orbit-Kreisen.

Basismodule:

```bash
node --check mission-survey-pattern.js
node --check tools/survey-pattern-selftest.mjs
node tools/survey-pattern-selftest.mjs
```

Breite Kategorieabdeckung:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=6 --profile=mapping_survey --categories=road,bridge,dam,infrastructure,water,mountain --out=mapping-survey-pattern-dryrun.json
```

City/Industry explizit:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=4 --types=poi:city+mapping_survey,poi:industry+mapping_survey --out=mapping-survey-city-industry-dryrun.json
```

Erwartung:

- `taskDomain` bleibt `mapping_survey`
- `mission.surveyPattern` existiert
- `mission.missionContract.surveyPattern` oder
  `mission.missionContractV4.surveyPattern` existiert
- `surveyPattern.center.lat/lon` sind gueltige Zahlen
- `surveyPattern.targetAltFt` ist gesetzt
- Scan-Patterns haben `scan.lines.length > 0`
- Orbit-Patterns haben `orbit.requiredTurns > 0`
- Briefing enthaelt einen Arbeits-/Hoehenhinweis, aber keine internen
  Pipeline-Begriffe

Typische Erwartung:

- `bridge` -> `orbit`
- `city`, `industry`, `road`, `dam`, `infrastructure`, `water`, `mountain`
  -> `north_south_scan`, solange fachlich nichts anderes konfiguriert wurde

Wichtig: Der Pipeline-Dryrun bestaetigt die Missionserzeugung und die
Datenweitergabe. Die Runtime-Pattern-Erkennung selbst muss separat gegen
`mission-survey-pattern.js` getestet werden.

Aus jedem erzeugten `surveyPattern` muss ein Overlay entstehen koennen:

- Scan: pro Linie genau eine Polyline
- Orbit: ein Kreis
- wenn `targetAltFt > 0`: ein Hoehenmarker

Ein fehlendes Overlay ist ein harter Fehler, auch wenn die Mission sonst gut
aussieht. Ohne Overlay kann der Pilot das Pattern nicht reproduzierbar fliegen.

Mit den erzeugten Specs aus dem Dryrun synthetische Flugspuren simulieren:

Scan:

- jede Linie von einem Ende zum anderen abfliegen
- Reihenfolge darf egal sein
- pro Linie muss `line_complete` entstehen
- nach der letzten Linie muss `survey_complete` entstehen

Orbit:

- auf dem geplanten Radius fliegen
- pro vollem Kreis muss `orbit_turn_complete` entstehen
- nach `requiredTurns` muss `survey_complete` entstehen

Fehlerpfade:

- zu weit vom Segment/Kreis weg -> `line_reset_offtrack` oder
  `orbit_reset_offtrack`
- ausserhalb der Hoehentoleranz -> `line_reset_altitude` oder
  `orbit_reset_altitude`
- abgeschlossene Linien/Kreise bleiben abgeschlossen; nur der aktive Teil wird
  zurueckgesetzt

Wenn diese Events nicht entstehen, ist die Mission zwar erzeugbar, aber nicht
robust spielbar.

In `passenger-voice.js` muessen die Pattern-Events erreichbar bleiben:

- Boarding/Start bereitet Survey-Pattern-Sprachbausteine vor
- `line_complete` spielt einen kurzen Fortschrittssatz
- `orbit_turn_complete` spielt einen kurzen Fortschrittssatz
- Reset-Events koennen Drift/Hoehe melden
- `survey_complete` markiert die Aufgabe als erledigt und fuehrt zum RTB-/Close-
  Ablauf

Die Pattern-Engine darf keine eigene Missions-State-Machine werden. Sie liefert
Events; die bestehende Missionsruntime entscheidet weiter ueber Abschluss,
Snapshot und Rueckflug.

Beim Browser-Smoke zusaetzlich:

- Linien/Kreis erscheinen auf der Karte
- der Hoehenmarker ist sichtbar
- ein Wechsel auf andere Missionstypen laesst keine alten Pattern-Overlays
  stehen

Beim manuellen Sim-Test zusaetzlich:

- eine Scan-Linie wird bei sauberem Abflug gruen
- die Reihenfolge der Scan-Linien ist egal
- bei Drift wird nur das aktive Segment zurueckgesetzt
- bei falscher Hoehe wird das aktive Segment zurueckgesetzt
- beim Orbit zaehlen volle Kreise hoch
- nach allen Linien/Kreisen kommt der RTB-Hinweis
- Mission bleibt danach abschliessbar

### Knowledge Guide

Zusatzchecks:

- Ziel darf nur gewaehlt werden, wenn genug belastbare Wissensdaten vorliegen
- Faktenliste ist reichhaltig, aber begrenzt und nicht token-lastig
- Briefing enthaelt nur Einstieg, nicht die ganze interne Faktensammlung
- Voice-Facts werden nicht staendig wiederholt
- "Erzaehl mal" nutzt vorhandene Fakten und meldet sauber, wenn nichts mehr
  uebrig ist
- andere POI-Missionen bekommen keinen Knowledge-Kontext, wenn sie ihn nicht
  brauchen

### Historian, News und Photo

Zusatzchecks:

- Rolle und Anlass sind konkret, nicht nur generisches Sightseeing
- City/Castle/POI bleibt Ziel, nicht nur Kulisse
- Historian nutzt Ortskern, alte Verkehrswege, Kirche, Markt, Tal-/Hanglage
  oder Denkmalschutz nur, wenn das Ziel dazu passt
- News hat einen sachlichen Anlass: Fest, Verkehr, Baustelle, Besucherandrang,
  sichtbare Veraenderung
- Photo hat einen Auftrag: Broschuere, Gemeindeaufnahme, Jubilauemsfilm,
  Redaktion, Establishing Shots
- Abschluss beschreibt verwertbares Material, nicht nur "schoene Aussicht"

### SAR

Zusatzchecks:

- genau eine Incident-Familie ist gewaehlt
- Briefing mischt keine widerspruechlichen Lagen
- Suchraum, Zielobjekt und Scene-Objekte passen zur Incident-Familie
- SAR ist nicht automatisch Vermisstensuche
- Smoke/Fire/Debris/Person/Fahrzeug sind nur gesetzt, wenn die Lage es traegt
- Abschluss/RTB haengt nicht an Sightseeing-Dwell-Logik

### Cargo, Charter und Bush

Zusatzchecks:

- Manifest passt zu Rolle, Gewicht und Mission
- Pickup/Unload/Boarding/Close haben klare Ground-Action-Trigger
- Cargo-Erfolg liegt in `mission-cargo-core.js`, nicht in losen UI-Faellen
- Bush-Strip und Zielanker bleiben getrennt von Rueckflug-/Follow-up-Logik
- Follow-up wird nur erzeugt, wenn die Story es fachlich erlaubt

### APT Training

Zusatzchecks:

- Uebungsziel, Platz, Hoehe und Platzrunde/Approach-Kontext sind klar
- Instructor-Feedback ersetzt normale Beobachter-/Sightseeing-Stimme
- Abschluss erfolgt durch Uebungslogik, nicht durch zufaellige POI-Dwell
- APT Arrival und Zielplatz-Szene blockieren den Rueckflug nicht

## Akzeptanzkriterien

Eine Missionsaenderung gilt als testbereit, wenn:

- Syntaxchecks gruene Ergebnisse liefern
- Pipeline-Dryruns fuer die betroffenen Profile/Kategorien erfolgreich sind
- Mission, Contract, Passenger und Runtime-Daten zusammenpassen
- sichtbare Texte keine internen Begriffe enthalten
- Speziallogik separat getestet wurde, wenn sie betroffen ist
- Overlay-/Scene-/Ground-Action-Daten erreichbar sind, wenn die Mission sie
  braucht
- synthetische Trigger, Ground Actions oder Flugspuren alle erwarteten
  Completion- und Reset-Events erzeugen, wenn die Mission eigene Triggerlogik
  nutzt
- Browser-Smoke HTTP 200 liefert
- bekannte Nachbar-Missionen nicht durch neue Sonderlogik veraendert werden

Ein Build gilt erst als simbereit, wenn zusaetzlich ein kurzer manueller
Live-Test den betroffenen Missionstyp bestaetigt hat.

## Typische Fehlersignale

- Mission hat das richtige Profil, aber falsche Story: Writer-Contract,
  StoryFrame und RoleProfile pruefen.
- Zielname driftet zu OSM-/Geo-Kontext: MissionTruth und Writer-Guardrails
  pruefen.
- Contract enthaelt die Daten, Runtime nicht: Persistenz, Snapshot, Restore und
  `currentMissionData` pruefen.
- Overlay fehlt, Daten sind vorhanden: Script-Reihenfolge, Map-Initialisierung
  und Refresh/Reset pruefen.
- Trigger feuert nie: Telemetrie-Felder, Toleranzen, Phase und TaskDomain-Guard
  pruefen.
- Trigger feuert zu frueh: Completion-Kriterien, Dwell, Pattern, Groundspeed
  oder OnGround-Schwellen pruefen.
- Voice blockiert oder wiederholt sich: Preload, Event-Dedupe und
  Passenger-Progress pruefen.
- Andere Missionen zeigen neue Speziallogik: TaskDomain-/Profile-Guard und
  Missionwechsel-Reset pruefen.
