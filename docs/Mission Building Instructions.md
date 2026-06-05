# Mission Building Instructions

Diese Datei beschreibt den aktuellen Missions-Baukasten im Projekt. Sie ist bewusst am echten Code ausgerichtet und nicht an einer idealisierten Zielarchitektur. Ziel ist, neue Missionen planbar zu machen, bestehende Logik sicher zu erweitern und spätere Refactors mit klaren Grenzen vorzubereiten.

## 1. Architektur in Kurzform

Die Missionslogik lebt heute im Wesentlichen in sieben Dateien:

- `app.js`: Missionsdefinition, Profile, Briefing-/Contract-Aufbau, POI/APT/BUSH-Metadaten und verbliebene Missionskomposition.
- `mission-definition-core.js`: Bush-Dispatch-Profile, Bush-Missions-Spec/Envelope, APT-Arrival-Rollen fuer Bush-/APT-Handovers.
- `mission-arrival-core.js`: APT-Arrival-Planung, OSM-/Overpass-Placement, sichere Arrival-Anker und Arrival-Truth-Anbindung.
- `sync.js`: Missions-UI, Start-/End-Banner, Szenen-Orchestrierung, Missionsende.
- `mission-runtime-core.js`: extrahierter Runtime-Kern fuer Bush-/Ground-Action-/End-Readiness-Logik.
- `mission-cargo-core.js`: extrahierter Cargo-/Manifest-/Payload-/Outcome-Kern.
- `passenger-voice.js`: PAX-/Cargo-Sprachlogik, Missionsphasen aus Sicht des Passagiers, Ankunft/Farewell/Pickup-Erzählung.

Der Tracker ist die Ausführungsebene für Szenen:

- `ga-tracker-client/tracker.js`: `mission_scene_spawn`, `mission_scene_clear`, `mission_scene_boarding`, `mission_scene_deboarding`.

Wichtig: Neue Missionen sollten zuerst als Komposition aus bestehenden Bausteinen gebaut werden. Erst wenn ein Missionsmuster sich nicht sauber ausdrücken lässt, sollte neue Kernlogik entstehen.

## 2. Mentales Modell

Eine Mission besteht aus fünf Schichten:

1. `Mission Envelope`
   - Titel, Story, Passenger/Cargo-Text, Contract, Bush-/POI-/APT-Metadaten.
2. `Runtime State`
   - Welche Phase ist aktiv, welche Bodenaktion ist gerade erlaubt, ist Abschluss schon möglich.
3. `Manifest`
   - Welche Items/Passagiere gelten als erforderlich, wo werden sie geladen, wo müssen sie entladen werden.
4. `Scene Layer`
   - Startszene, Zielszene, APT-Arrival-Szene, Boarding, Deboarding, Pickup-/Handoff-Sequenzen.
5. `Voice Layer`
   - Welche Texte in welcher Phase gesprochen werden und wie sie erzählerisch zusammenhängen.

## 3. Zentrale Bausteine

### 3.1 Mission-Definitionen in `app.js`

Ein Teil der Definitionslogik liegt inzwischen bewusst in `mission-definition-core.js`, damit Missionsrezepte, Bush-Spezifika und Arrival-Rollen nicht mehr zwischen Runtime- und UI-Code vermischt werden. Die eigentliche Arrival-Planung und OSM-Platzierung liegt nun in `mission-arrival-core.js`.

Wichtige Einstiegsfunktionen:

- `sanitizeBushMissionSpec()`
- `buildInitialBushMissionProgress()`
- `buildBushMissionSpec()`
- `buildBushMissionEnvelope()`
- `normalizeAptArrivalRole()`

Wichtige Kataloge:

- `BUSH_DISPATCH_PROFILES`
- `BUSH_PERSONA_LIBRARY`

Diese Ebene legt fest:

- Missionskategorie und Profil
- Zielmodus (`strip`, `strip_then_return`, `area_then_return`, ...)
- Abschlussmodus (`unload_at_target`, `passenger_dropoff`, `return_home`, ...)
- Pickup-Art (`passenger` oder `cargo`)
- Narrative Grundrichtung
- Passenger-/Cargo-Rollenprofil (`roleProfile`, `taskDomain`)

### 3.2 Runtime-/Phasenmaschine in `sync.js` und `mission-runtime-core.js`

Wichtige Runtime-Bausteine:

- `missionRuntime`
- `_missionRuntimePhaseSnapshot()`
- `_setMissionRuntimePhase()`
- `_missionResolveGroundAction()`
- `_missionEndReadiness()`
- `_missionRuntimeGroundEndReady()`

Faustregel:

- `sync.js` steuert den Ablauf und die UI.
- `mission-runtime-core.js` beantwortet die fachlichen Fragen zur Bodenaktion und Endbereitschaft.

Die Runtime trennt zwei Dinge:

- `Start-/Boarding-Phasen`
- `aktive Missionsphase` inklusive aller End-/Pickup-/Unload-Übergänge

Diese Trennung ist wichtig. Viele alte Bugs entstanden dort, wo UI, Cargo-Status und Missionsabschluss nur über lose `if/else`-Kombinationen gekoppelt waren.

### 3.3 Manifest-/Ladungslogik in `mission-cargo-core.js`

Wichtige Funktionen:

- `_missionCargoGenerateManifest()`
- `_missionCargoEnsureManifest()`
- `_missionCargoEvaluateOutcome()`
- `_missionCargoFinalizeMissionOutcome()`
- `finishMissionCargoLoadingAndStart()`
- `finishMissionCargoPickupAndContinue()`
- `finishMissionCargoUnloadAndEnd()`

Das Manifest ist die Wahrheit darüber:

- was geladen werden muss,
- wo es geladen wird,
- wo es entladen wird,
- und was für Erfolg/Misserfolg zählt.

Für neue Missionen gilt: Erfolgskriterien nach Möglichkeit über Manifest und Progress modellieren, nicht über freie Sonderbedingungen in UI-Code.

Faustregel:

- `mission-cargo-core.js` entscheidet ueber Manifest, Payload, Load/Pickup/Unload und Missionsauswertung.
- `sync.js` oeffnet nur die passenden Dialoge und haengt diese Entscheidungen an die Runtime-/Szenensteuerung an.

### 3.4 Bush-Progression in `mission-runtime-core.js`

Wichtige Funktionen:

- `_missionBushIsPickupMission()`
- `_missionBushIsPickupPassengerMission()`
- `_missionBushIsPickupCargoMission()`
- `_missionBushPickupReadyForAction()`
- `_missionBushUpdateProgress()`
- `_missionBushEffectiveCompletionMode()`
- `_missionBushGroundEndReady()`
- `_missionBushRuntimeDetailText()`

Bush-Missionen haben bereits ein eigenes Progress-Modell. Relevante Zustände sind heute unter anderem:

- `outbound_empty`
- `pickup_ready`
- `pickup_loading`
- `pickup_complete`
- `return_leg`
- `home_unloading`
- `ready_to_close`

Neue Bush-Varianten sollten dieses Muster weiterverwenden, statt ein zweites paralleles Fortschrittsmodell einzuführen.

### 3.5 Szenen-System in `sync.js` + `ga-tracker-client/tracker.js`

App-seitig relevante Einstiegspunkte:

- `_missionAptArrivalPlan()`
- `missionAptArrivalEnsureSpawned()`
- `missionSceneDeboarding()`
- `_tryStartMissionEndScene()`

Tracker-seitig relevante Primitiven:

- `mission_scene_spawn`
- `mission_scene_clear`
- `mission_scene_boarding`
- `mission_scene_deboarding`

Die `mission_scene_deboarding`-Sequenz kann bereits:

- Fahrzeug anfahren lassen
- Person(en) aus dem Flugzeug führen
- an Fahrzeug/Pickup-Punkt übergeben
- Fahrzeug wieder abfahren/despawnen lassen

Das ist der richtige Baustein für POI-ähnliche Handoffs, Bush-Empfang, Home-Übergaben und ähnliche Abschlussmomente.

### 3.6 Voice-Layer in `passenger-voice.js`

Wichtige Trigger:

- `triggerPaxGreeting()`
- `triggerPaxPickupBoarding()`
- `triggerPaxPickupDeparture()`
- `triggerPaxAtTarget()`
- `triggerPaxFarewell()`

Bush-Pickup-spezifische Bausteine:

- `_activeBushPickupPassengerContract()`
- `_pickupBoardingPrompt()`
- `_pickupDeparturePrompt()`
- `_bushPickupNarrativeMemory`
- `_captureBushPickupNarrativeMemory()`
- `_bushPickupNarrativeHint()`

Wichtig: Der Voice-Layer sollte auf Runtime-Phasen reagieren, nicht selbst Missionslogik entscheiden. Er darf Kontinuität und Kontext speichern, aber nicht als versteckte State-Machine missbraucht werden.

## 4. Standard-Lebenszyklus einer Mission

### 4.1 Vor dem Flug

1. Mission erzeugen
2. Contract/Profile ableiten
3. Manifest erzeugen
4. Startphase auf `planned`
5. Banner/Runtime-UI zeigt Boarding-/Startzustand

### 4.2 Startsequenz

1. `handleMissionStartBannerAction()`
2. `planned -> prepare`
3. `prepare -> boarding`
4. `finishMissionCargoLoadingAndStart()`
5. `boarding -> boarded`
6. `manualMissionStart()` oder Sim-Äquivalent

### 4.3 Unterwegs

Während des Fluges arbeiten parallel:

- GPS-/Flight-Update-Loop
- `_missionEndReadiness()`
- `_missionBushUpdateProgress()` oder POI/APT-Logik
- Voice-Trigger
- Scene-Prestage/Spawn

### 4.4 Bodenkontakt am Ziel

Entscheidend ist nicht nur `atTarget`, sondern die Kombination aus:

- `groundStill`
- Zieltyp
- aktiver Missionsart
- Manifeststatus
- Bush-/POI-/APT-Fortschritt

Diese Entscheidung bündelt `_missionResolveGroundAction()`.

Erlaubte resultierende Aktionen:

- `pickup`
- `unload`
- `end`
- `close`
- `none`

### 4.5 Missionsende

Normaler Abschlussweg:

1. Runtime erkennt endfähigen Zustand
2. ggf. Unload/Pickup-Dialog
3. Farewell
4. Deboarding/Handoff
5. Outcome finalisieren
6. `closingPending`
7. `completeMissionClose()`
8. `missionRuntimeReset()`

## 5. Ground Actions als Kernvertrag

Für Erweiterungen ist `_missionResolveGroundAction()` die wichtigste Funktion im System.

Sie bestimmt, was am Boden gerade erlaubt ist. Neue Missionen sollten sich daran anlehnen:

- `pickup`: etwas oder jemand muss am Ziel aufgenommen werden
- `unload`: etwas oder jemand muss am Ziel oder daheim ausgeladen werden
- `end`: die Mission ist landeseitig erfüllt und kann beendet werden
- `close`: Abschluss ist schon vorbereitet, UI darf nur noch schließen

Regel:

Eine UI-Aktion sollte nie von drei verstreuten Bedingungen abhängen, wenn sie eigentlich einer klaren Missionsphase entspricht.

## 6. Sim vs Live

Der Sim-Modus und der Live-Modus teilen sich die gleiche Missionslogik, unterscheiden sich aber bei:

- Trigger-Timing
- Bodenstillstand / Positionsqualität
- Banner-Fortschaltung
- Sequenzen, die ohne vollständige Tracker-/Live-Daten weiterlaufen

Wichtige Lehre aus den letzten Fixes:

- Sim-Sonderfälle nur an klaren Übergängen kapseln.
- Nicht die gesamte Missionslogik in `if (simMode)` aufspalten.
- Wenn möglich dieselben Phasen verwenden und nur die Triggerquelle austauschen.

Konkrete Sim-Regel fuer Abschlussphasen:

- Wenn eine Mission nach `pickup`/`unload` fachlich bereits in `ready_to_close` oder `end_ready` steht, muss der Sim-Modus den Abschluss aktiv "armen" koennen, auch wenn das normale `end_hold`-Pending-Flag gerade fehlt oder schon verbraucht wurde.
- Sonst entstehen die typischen Haenger: Dialog ist fertig, aber weder Farewell noch Mission-abschliessen-Banner erscheinen.
- Missionen, deren Endfreigabe an `_missionHasReachedEndEligibleFlightPhase()` haengt, brauchen im Sim-Modus eine eigene Flug-Evidence aus `sim-route.js` und duerfen nicht stillschweigend nur vom Live-`flightRecorder` abhaengen.

### 6.1 Architekturregel: Sim als Debugmodus

Der Sim-Modus ist nicht nur ein Komfort-Feature, sondern der bevorzugte Debug-/Regressionstest fuer Missionsablaeufe.

Dafuer gilt als feste Architekturregel:

- Sim emuliert Eingabesignale, nicht Missionslogik.
- Live und Sim muessen dieselbe Runtime-/Phasenmaschine durchlaufen.
- Unterschiedlich sein duerfen nur Signalquelle und Timing, nicht die fachlichen Abschlussregeln.

Praktisch heisst das:

- Live liefert Signale ueber Tracker/Websocket/SimConnect-nahe Telemetrie.
- Sim liefert dieselben Signale synthetisch ueber `sim-route.js`.
- Beide Pfade muessen an dieselben oeffentlichen Runtime-Einstiege andocken, z. B.:
  - `_missionEndReadiness()`
  - `_missionResolveGroundAction()`
  - `finishMissionCargoLoadingAndStart()`
  - `finishMissionCargoPickupAndContinue()`
  - `finishMissionCargoUnloadAndEnd()`
  - `_triggerPaxFarewellAndWaitForDeboard()`
  - `_setMissionClosePending()`

Nicht gewuenscht:

- eine zweite Missionslogik nur fuer Sim
- abweichende Sim-Erfolgsregeln fuer dieselbe Mission
- verstreute `if (simMode)`-Abzweige in fachlicher Missionslogik

Erlaubt und sinnvoll:

- Sim ersetzt fehlende Live-Signale
- Sim setzt kuenstliche Flug-/Boden-Evidence
- Sim kapselt Timing-Hilfen an klaren Uebergangspunkten (`start_hold`, `end_hold`, `mission_end_pending`)

### 6.2 Testmatrix: Was Sim abdeckt

Sim ist der primaere Testpfad fuer:

- Phasenlogik und Statuswechsel
- Banner-/Dialog-Fortschaltung
- Pickup-/Unload-/End-/Close-Uebergaenge
- Cargo-/Pax-Manifestregeln
- Farewell-/Deboarding-/Close-Ketten
- Szenen-Spawn/Clear-Anstosse
- Trigger-Reihenfolgen und Race-Conditions innerhalb der Missionsmaschine

Live bleibt Pflicht fuer:

- echte Tracker-/Websocket-Aussetzer
- Jitter, verzerrte Update-Frequenzen und Positionsspruenge
- reale `onGround`-/Groundspeed-/Parking-Brake-Schwellen
- Timing-Probleme zwischen externer Telemetrie und App-UI
- alles, was nur mit echter Signalqualitaet oder externer Infrastruktur auftritt

Faustregel:

- Wenn etwas im Sim kaputt ist, ist das fast immer ein echter Logik- oder Phasenfehler.
- Wenn etwas nur im Live-Modus kaputt ist, liegt die Ursache oft in Signalqualitaet, Timing oder Tracker-Integration.

### 6.3 Bau-Regel fuer neue Missionen

Neue Missionen muessen so gebaut werden, dass sie im Sim-Modus denselben Regelpfad nehmen koennen wie im Live-Betrieb.

Das bedeutet:

- Abschluesse immer ueber Phase + Manifest + Runtime modellieren
- keine stillen Sonderabkuerzungen nur fuer einen Modus
- Sim-spezifische Hilfen nur auf Input-Ebene
- bei neuen Missionsarten frueh mit Phasen-Log und Sim-Ende pruefen, bevor Live-Feintuning beginnt

## 7. Missionsrezepte

### 7.1 APT A->B

Bausteine:

- Passenger optional
- Cargo optional
- Startszene optional
- APT-Arrival-Plan aktiv
- Zielabschluss am Arrival-Punkt

Typische Erfolgslogik:

- Landung/Ziel erreicht
- ggf. Passenger raus
- ggf. Cargo raus
- Farewell + Deboarding

### 7.2 POI-Mission

Bausteine:

- Zielszene statt APT-Arrival
- Ziel ist Beobachtung/Verweilzeit/Arbeitsauftrag
- Ende typischerweise wieder am Heimatplatz oder nach Rückkehr

Typische Erfolgslogik:

- Zielarbeit erfüllt
- Rückkehr/Ende je nach Missionsprofil
- ggf. POI-Handoff-Szene

### 7.3 Bush Supply

Bausteine:

- `targetMode = strip`
- `completionMode = unload_at_target`

Typische Erfolgslogik:

- am Strip landen
- Pflichtladung entladen
- danach sofort in den Abschlusszustand `ready_to_close`
- Farewell-/Uebergabe-Trigger aus Empfaenger-/Frachtkontakt-Sicht
- Mission-abschliessen-Banner sofort freigeben

Wichtige Abschlussregel:

- `finishMissionCargoUnloadAndEnd()` ist bei `bush_supply` nicht nur "Unload fertig", sondern der harte Abschluss-Uebergang.
- Wenn das Manifest erfolgreich entladen wurde und die Runtime bereits `ready_to_close` meldet, darf der Sim-Modus nicht noch auf einen separaten zweiten Boden-Trigger warten.
- `ready_to_close` ist hier selbst bereits ein gueltiger Endzustand. `_missionBushGroundEndReady()` muss ihn fuer `bush_supply` und andere Nicht-Return-Bush-Missionen direkt akzeptieren, solange `groundStill` und `atTarget` stimmen.
- Live und Sim sollen hier fachlich gleich enden:
  - Cargo raus
  - Abschluss/Farewell anstossen
  - `closingPending` bzw. Mission-Abschliessen-Banner aktivieren
  - optional laufende Szene/Sequenz parallel zu Ende laufen lassen

### 7.4 Bush Charter

Bausteine:

- `targetMode = strip`
- `completionMode = passenger_dropoff`

Typische Erfolgslogik:

- Zielstrip erreichen
- Passagier am Ziel aussteigen lassen
- Deboarding/Farewell

### 7.5 Bush Recon Return

Bausteine:

- `targetMode = area_then_return`
- `completionMode = return_home`

Typische Erfolgslogik:

- Arbeitsgebiet qualifizieren
- Rückflug
- Mission am Heimatplatz beenden

### 7.6 Bush Pickup Passenger

Bausteine:

- `targetMode = strip_then_return`
- `pickupKind = passenger`
- `completionMode = return_home`

Typische Erfolgslogik:

1. leer zum Zielstrip
2. Pickup vor Ort
3. Rückflug
4. Passagier daheim aussteigen lassen
5. optional Handoff-Szene
6. Mission schließen

### 7.7 Bush Pickup Cargo

Bausteine:

- `targetMode = strip_then_return`
- `pickupKind = cargo`
- `completionMode = return_home`

Typische Erfolgslogik:

1. leer hin
2. Fracht aufnehmen
3. Rückflug
4. Fracht am Heimatplatz ausladen
5. Mission schließen

## 8. Checkliste für neue Missionstypen

Wenn wir einen neuen Missionstyp bauen, gehen wir in dieser Reihenfolge vor:

1. Profil definieren
   - Kategorie, `roleProfile`, `taskDomain`, Story-Richtung
2. Completion-Modell festlegen
   - Zielabschluss vor Ort, Rückkehr, Pickup, Unload, Gebietsqualifikation
3. Bush-/APT-/POI-Spezifikation ableiten
4. Manifest-Regeln definieren
   - welche Items sind required, wo werden sie geladen/entladen
5. Ground-Action-Verhalten prüfen
   - `pickup`, `unload`, `end`, `close`
6. Scene-Bausteine auswählen
   - Start, Ziel, Arrival, Boarding, Deboarding, Handoff
7. Voice-Hooks definieren
   - Greeting, Pickup, Departure, Arrival, Farewell
8. Sim-Modus prüfen
   - funktionieren dieselben Übergänge ohne Live-Daten sauber
9. Phasen-Log prüfen
   - ist jede Fortschaltung im Debug-Log nachvollziehbar

## 9. Was wir nicht mehr tun sollten

- Neue Missionsarten nur über verstreute UI-Flags steuern
- Erfolg ausschließlich über Textvergleich oder Voice-Zustände ableiten
- Sim-Fixes direkt in viele unabhängige `if (simMode)`-Blöcke verteilen
- dieselbe Missionsart gleichzeitig über Manifest und freie Sonderflags definieren
- neue Szenenmechaniken bauen, wenn der Tracker die Sequenz bereits als generischen Baustein kann

## 10. Sinnvolle nächste Struktur-Schritte

Das System ist bereits bausteinfaehig und jetzt etwas sauberer sortiert: Bush-/Ground-Action-/End-Readiness-Helfer liegen in `mission-runtime-core.js`, Cargo-/Manifest-/Outcome-Logik in `mission-cargo-core.js`. Der naechste sichere Refactor-Pfad waere:

1. `sync.js` logisch aufteilen, ohne Verhalten zu ändern:
   - runtime/phases
   - cargo-manifest
   - bush-progress
   - mission-scenes
   - mission-ui
2. Ground-Action- und End-Readiness-Vertrag explizit halten
3. Missionstypen stärker datengetrieben machen
4. Für neue Missionen möglichst nur Profil + Manifest + Scene-Rezept ergänzen

Wichtig: Erst entflechten, dann erweitern. Nicht gleichzeitig große Strukturänderung und neue Missionstypen in derselben Änderung mischen.

## 11. Praktische Leitlinie für zukünftige Arbeit

Wenn wir eine neue Mission bauen, sollte die Kernfrage immer sein:

> Welche bestehende Phase, welche bestehende Bodenaktion und welche bestehende Szene transportieren das Verhalten schon fast vollständig?

Wenn wir darauf eine klare Antwort haben, bauen wir schnell und relativ sicher.
Wenn nicht, brauchen wir zuerst einen kleinen Kern-Refactor statt noch einer Sonderbehandlung.
