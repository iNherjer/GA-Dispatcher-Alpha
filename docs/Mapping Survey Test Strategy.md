# Mapping Survey Test Strategy

Diese Anleitung beschreibt, wie Mapping-/Survey-Missionen sauber getestet werden,
bevor sie gepusht oder im Sim laenger ausprobiert werden. Sie ist fuer
Missionen mit `taskDomain: mapping_survey` gedacht, besonders fuer die
Survey-Pattern-Logik mit Nord-Sued-Linien und Orbit-Kreisen.

## Ziel

Der Test soll nicht nur pruefen, ob eine Mission erzeugt wird. Er muss
bestaetigen, dass die gesamte Kette zusammenpasst:

- Picker/Profil waehlt `mapping_survey`
- Mission, Contract und Passenger behalten dieselbe TaskDomain
- `surveyPattern` wird in Mission und Contract geschrieben
- Overlay-Geometrie ist aus dem Pattern ableitbar
- Runtime-Trigger erkennen Linien, Kreise, Hoehenfehler und Drift
- Pax-Voice bekommt die vorladbaren Events ohne neue Missionslogik
- normale POI-/APT-/Bush-Missionen werden nicht mit Pattern-Sonderlogik belastet

## Teststufen

### 1. Worktree und Scope klaeren

Vor jedem Testlauf:

```bash
git status --short
```

Nur die erwarteten Dateien anfassen. Analyse-Dateien unter `analysis/` sind
Arbeitsartefakte und werden nur committed, wenn sie bewusst als Evidenz
gebraucht werden.

### 2. Syntax und Basismodul pruefen

```bash
node --check app.js
node --check passenger-voice.js
node --check sync.js
node --check mission-survey-pattern.js
node --check tools/survey-pattern-selftest.mjs
node tools/survey-pattern-selftest.mjs
```

Erwartung:

- keine Syntaxfehler
- `survey-pattern selftest ok`

Der Selftest deckt die reine Pattern-Engine ab: Scan-Abschluss,
Offtrack-Reset und Orbit-Abschluss.

### 3. Mission-Pipeline-Dryruns erzeugen

Breite Kategorieabdeckung:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=6 --profile=mapping_survey --categories=road,bridge,dam,infrastructure,water,mountain --out=mapping-survey-pattern-dryrun.json
```

City/Industry explizit:

```bash
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=4 --types=poi:city+mapping_survey,poi:industry+mapping_survey --out=mapping-survey-city-industry-dryrun.json
```

Erwartung:

- alle Runs erzeugen eine Mission
- `profile`, `appliedProfile` und Passenger zeigen auf Mapping/Survey
- `taskDomain` bleibt `mapping_survey`
- Briefing enthaelt einen Arbeits-/Hoehenhinweis, aber keine internen
  Pipeline-Begriffe
- Zielname bleibt das gewaehlte POI-Ziel, nicht ein technischer OSM-Anker

### 4. Contract- und Pattern-Weitergabe pruefen

Die JSON-Ausgaben unter `analysis/` pruefen. Pro Run muss gelten:

- `mission.surveyPattern` existiert
- `mission.missionContract.surveyPattern` oder
  `mission.missionContractV4.surveyPattern` existiert
- `surveyPattern.center.lat/lon` sind gueltige Zahlen
- `surveyPattern.targetAltFt` ist gesetzt
- Scan-Patterns haben `scan.lines.length > 0`
- Orbit-Patterns haben `orbit.requiredTurns > 0`

Typische Erwartung:

- `bridge` -> `orbit`
- `city`, `industry`, `road`, `dam`, `infrastructure`, `water`, `mountain`
  -> `north_south_scan`, solange fachlich nichts anderes konfiguriert wurde

Wichtig: Der Pipeline-Dryrun bestaetigt die Missionserzeugung und die
Datenweitergabe. Die Runtime-Pattern-Erkennung selbst muss separat gegen
`mission-survey-pattern.js` getestet werden.

### 5. Overlay-Erzeugung pruefen

Aus jedem erzeugten `surveyPattern` muss ein Overlay entstehen koennen:

- Scan: pro Linie genau eine Polyline
- Orbit: ein Kreis
- wenn `targetAltFt > 0`: ein Hoehenmarker

Ein fehlendes Overlay ist ein harter Fehler, auch wenn die Mission sonst gut
aussieht. Ohne Overlay kann der Pilot das Pattern nicht reproduzierbar fliegen.

### 6. Runtime-Trigger simulieren

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

### 7. Pax-Voice-Handoff pruefen

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

### 8. Browser-Smoke

Wenn ein lokaler Server laeuft:

```bash
curl -I http://127.0.0.1:8080/index.html
curl -I http://127.0.0.1:8080/mission-survey-pattern.js
```

Erwartung:

- beide Antworten sind HTTP 200
- `mission-survey-pattern.js` wird als JavaScript ausgeliefert

Optional die App im Browser laden und eine Mapping-Survey-Mission erzeugen.
Dabei pruefen:

- keine Console-Errors
- Linien/Kreis erscheinen auf der Karte
- der Hoehenmarker ist sichtbar
- ein Wechsel auf andere Missionstypen laesst keine alten Pattern-Overlays
  stehen

### 9. Manueller Sim-Test

Der Dryrun ersetzt keinen kurzen echten Flugtest. Live pruefen:

- eine Scan-Linie wird bei sauberem Abflug gruen
- die Reihenfolge der Scan-Linien ist egal
- bei Drift wird nur das aktive Segment zurueckgesetzt
- bei falscher Hoehe wird das aktive Segment zurueckgesetzt
- beim Orbit zaehlen volle Kreise hoch
- nach allen Linien/Kreisen kommt der RTB-Hinweis
- Mission bleibt danach abschliessbar

Live ist besonders wichtig fuer GPS-Jitter, Update-Frequenz, reale Hoehenwerte
und UI-Reaktionszeit.

## Akzeptanzkriterien

Ein Mapping-Survey-Build gilt als testbereit, wenn:

- Syntaxchecks gruene Ergebnisse liefern
- `tools/survey-pattern-selftest.mjs` erfolgreich ist
- Pipeline-Dryruns fuer breite Kategorien und City/Industry erfolgreich sind
- alle erzeugten Missionen ein gueltiges `surveyPattern` in Mission und Contract
  tragen
- Overlay-Geometrie aus jedem Pattern ableitbar ist
- synthetische Flugspuren alle Completion- und Reset-Events erzeugen
- Browser-Smoke HTTP 200 liefert
- keine sichtbaren internen Begriffe im Briefing auftauchen

Ein Build gilt erst als simbereit, wenn zusaetzlich ein kurzer manueller
Live-Test mindestens einen Scan und einen Orbit bestaetigt hat.

## Typische Fehlersignale

- Mission hat `mapping_survey`, aber kein `surveyPattern`: Handoff in `app.js`
  oder Contract-Aufbau pruefen.
- Pattern ist nur im Contract, nicht in `currentMissionData`: Persistenz,
  Restore oder Snapshot pruefen.
- Overlay fehlt, Pattern ist aber vorhanden: `mission-survey-pattern.js`,
  Script-Reihenfolge in `index.html` und Map-Initialisierung pruefen.
- Linien werden nicht gruen: Cross-track-, Heading-, Speed- oder
  Hoehentoleranz pruefen.
- Orbit zaehlt nicht hoch: Radius, Radialtoleranz, Mindestzeit und
  Sektorabdeckung pruefen.
- Reset kommt zu frueh: `resetGraceSec` und Toleranzen pruefen.
- Andere Missionen zeigen Survey-Overlay: Reset/Refresh beim Missionwechsel und
  TaskDomain-Guard pruefen.
