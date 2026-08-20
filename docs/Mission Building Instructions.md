# Mission Building Instructions

Schnelle Ablaufuebersicht: `docs/Mission Flow Reference.md`.

Diese Datei bleibt das ausfuehrliche Bau- und Erweiterungshandbuch. Die Flow
Reference dokumentiert kompakt den aktuell ausgefuehrten Start-, Pickup-,
Unload-, Farewell- und Close-Pfad aller Ablaufklassen.

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

Bei Passenger-Gruppen ist `passengerCount` die numerische Wahrheit. Die Party
wird bei der Missionserzeugung vor dem Writer fixiert; Story, Contract,
V4-Contract, Anzeige, Szenenparameter und Manifest duerfen den Count danach
nicht neu wuerfeln oder aus freiem Text ableiten. `paxText` bleibt lediglich
Anzeige sowie Legacy-Restore-Fallback. Eine Gruppe bleibt ein atomarer
Passenger-Manifest-Eintrag; ihr Hauptpassagier bleibt die Voice-Persona.

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

Bei Pickup-Missionen wird `pickupCompleted` aus allen am Ziel erforderlichen
Manifest-Items abgeleitet. Ein Passenger-Pickup mit Begleitfracht bleibt nach
dem PAX-Boarding in `pickup_loading`, bis auch die Fracht geladen ist. Auch ein
leerer Hinflug muss den normalen `load`-Scope unterschreiben und bestaetigen;
ein Pickup-spezifischer Abflug-Shortcut ist nicht zulaessig.

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
4. Bei PAX: Person beziehungsweise freigegebene Gruppe laeuft zeitversetzt zum Flugzeug; die Tuer ist offen und jede Person verschwindet am Boarding-Punkt
5. Tracker meldet die bestehenden Boarding-Stages und im finalen ACK exakt die erwartete Personenzahl
6. Boarding-Cue läuft während die Tür schließt
7. Nach dem finalen Boarding-ACK folgt die Boarding-Voice
8. Pflichtladung vollständig laden, Dispatch-Liste unterschreiben und Sim-Payload prüfen
9. `finishMissionCargoLoadingAndStart()`
10. Erst nach Boarding-Voice und bestätigter Verladung: `boarding -> boarded`
11. `manualMissionStart()` oder Sim-Äquivalent

Cargo-only mit `0 PAX` überspringt die Personenanimation vollständig. Ground Crew darf weder als Ersatzpassagier boarden noch beim Missionsende als Phantom-PAX gespawnt werden.

Gruppen verwenden dieselben Phasen, Signaturen und Manifest-Gates wie eine
Einzelperson. Ein partielles ACK darf weder Boarding noch Deboarding
fortschalten. Die Gruppenerzeugung setzt die ausgehandelte
`mission.scene.group.v1`-Capability voraus; ohne sie bleibt der bestehende
Einzelpersonenpfad aktiv.

Die koordinierte Deboarding-Sequenz setzt Tracker `v278` oder neuer voraus. Mit einem älteren/unerkannten Tracker läuft der Farewell-Fallback ohne unkoordinierte Personenanimation.

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
3. Bei PAX: Deboarding-Cue, dann Tür öffnen
4. Tracker meldet `mission_scene_deboarding_stage: door_open`
5. Farewell läuft bei offener Tür
6. Nach Ende der Farewell-Voice erhält der Tracker `mission_scene_deboarding_continue`
7. PAX spawnt neben dem Flugzeug, Tür schließt, PAX läuft zum Fahrzeug/Handoff
8. PAX despawnt, Fahrzeug fährt ab und despawnt
9. Erst nach finalem Deboarding-ACK Outcome finalisieren
10. `closingPending`
11. `completeMissionClose()`
12. `missionRuntimeReset()`

Cargo-only spricht nach der Übergabe die Receiver-/Empfänger-Voice, startet aber keine Deboarding-Animation.

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

Die allgemeine QA-Reihenfolge fuer neue oder geaenderte Missionen steht in
`docs/Mission Test Strategy.md`. Die folgende Matrix beschreibt nur, welche
Teile davon der Sim-Test abdecken kann und welche live geprueft werden muessen.

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

Vor jedem neuen Missionstyp gilt zuerst diese Entscheidungsfrage:

> Ist das fachlich ein `APT-Ziel`, ein `POI-Task`, ein `Bush-Target mit Zielabschluss` oder ein `Bush-Return`?

Neue Missionen sollen nicht "frei" erfunden werden, sondern immer auf einem bestehenden Grundrezept aufsetzen. Das Grundrezept bestimmt:

- welche Phasen verwendet werden
- ob Bodenkontakt fachlich nötig ist
- ob `pickup` oder `unload` überhaupt erlaubt sind
- ob ein `RTB` nur optional oder verpflichtend ist
- welche Abschlussbedingung die Runtime prüfen muss

### 7.0 Grundformen

Bevor ein Missionsprofil gewählt wird, wird jede Mission zuerst einer der drei grossen Ablaufarten zugeordnet:

1. `A -> B`
   - klassischer Streckenflug mit Zielabschluss am Zielflugplatz
   - typische Form fuer Charter, Cargo, Besuch, Medical-Handoff, Utility

2. `A -> B (mit Landung) -> A`
   - am Ziel ist Bodenkontakt fachlich Teil des Auftrags
   - dazu gehoeren echte Pickup-/Dropoff-/Unload-Rezepte oder Bush-Landungen mit Rueckflugpflicht

3. `A -> B (Task ohne Landung) -> A`
   - `B` ist fachlich kein Endflugplatz, sondern Arbeitsgebiet / POI / Kontrollbereich
   - die Landung am Ziel ist nicht Teil des Erfolgsrezepts
   - Erfolg entsteht durch Task-Erfuellung am Ziel und anschliessenden Rueckflug

Merksatz:

- `Zielflugplatz als Abschluss` = `A -> B`
- `Zielflugplatz als Zwischenstopp mit Bodenauftrag` = `A -> B (mit Landung) -> A`
- `Ziel nur als Arbeitsgebiet / Wegpunkt` = `A -> B (Task ohne Landung) -> A`

Wichtig:

- `POI` bedeutet fachlich fast immer Grundform 3, auch wenn Start und Ziel im Plan derselbe Heimatflugplatz sind.
- `bush_recon` gehoert in Grundform 3.
- `bush_pickup_return` gehoert in Grundform 2.
- normale APT-Missionen gehoeren in Grundform 1.

### 7.0 Rezept-Matrix

| Rezept | Typischer Zweck | Task am Ziel | Landung am Ziel | Rückflugpflicht | Abschlussort | Grundphasen |
| --- | --- | --- | --- | --- | --- | --- |
| `APT arrival` | normaler A->B-Flug, Charter, Cargo, Besuch | nein oder nur Handoff am Platz | ja | nein | Ziel | `enroute -> end_unloading/end_ready -> close` |
| `POI on-task` | Beobachtung, Survey, Foto, Umwelt, Fire Watch | ja, in der Luft oder über dem Zielgebiet | normalerweise nein | je nach Mission | Ziel oder Heimat | `enroute -> on_task -> end_unloading -> ready_to_close` oder `enroute -> on_task -> return_leg -> home_unloading -> ready_to_close` |
| `Bush strip target` | Supply, Charter-Dropoff, Adventure-Landung | ja, aber am Strip / am Boden | ja | nein | Ziel | `enroute -> end_unloading/end_ready -> ready_to_close` |
| `Bush pickup return` | Pax/Fracht aufnehmen und heimbringen | ja, Pickup am Zielstrip | ja | ja | Heimat | `outbound_empty -> pickup_ready -> pickup_loading -> pickup_complete -> return_leg -> home_unloading -> ready_to_close` |
| `Bush RTB task` | Task im Zielgebiet, dann direkte Heimkehr | ja, aber nicht als Pickup/Unload | normalerweise nein | ja | Heimat | `enroute -> on_task -> return_leg -> home_unloading -> ready_to_close` |

### 7.0.1 Wiederverwendungsregel

Die Rezepte sind hierarchisch zu benutzen:

1. Wenn eine Mission fachlich wie ein bestehendes Rezept funktioniert, wird dieses Rezept wiederverwendet.
2. Bush-Kontext allein ist **kein** Grund für eine eigene Runtime-Logik.
3. Neue Sonderlogik ist nur erlaubt, wenn ein bestehendes Rezept eine fachliche Anforderung nicht ausdrücken kann.

Wichtige Konsequenz:

- `bush_pickup_*` braucht eigenes Return-Rezept, weil der Missionskern ein echter Pickup mit späterem Home-Unload ist.
- `bush_supply_strip` braucht ein Ziel-Unload-Rezept, weil die Pflichtladung am Ziel abgegeben wird.
- `bush_recon` ist **kein** Pickup- und **kein** Bush-RTB-Sonderfall, sondern ein `POI on-task`-Rezept mit Bush-Texten, Bush-Zielen und verpflichtender Heimkehr.

### 7.0.2 Erlaubte und verbotene Aktionen pro Rezept

| Rezept | `pickup` | `unload` | `end` | `close` | Verboten |
| --- | --- | --- | --- | --- | --- |
| `APT arrival` | nein | falls Manifest Ziel-Unload verlangt | ja | ja | künstliche `on_task`-Phasen ohne fachlichen Task |
| `POI on-task` | nein | ja, Pflicht-Missionsfracht am tatsächlichen Abschlussort; weitere Items nur bei echtem Home- oder Ziel-Handoff | ja, nach Task-Erfüllung und Ankunfts-Verladung | ja | Ziel-Landung als Ersatz für Task-Erfüllung |
| `Bush strip target` | nein | ja, wenn Ziel-Manifest oder Dropoff es verlangt | ja | ja | Rückflug-Sonderphasen ohne fachlichen RTB-Zwang |
| `Bush pickup return` | ja | ja, am Heimatplatz | ja | ja | Abschluss am Ziel, bevor Pickup-/Home-Pfad erfüllt ist |
| `Bush RTB task` | nein | nein, außer definierter Home-Handoff | ja, erst nach Task und Heimkehr | ja | Ziel-Landung als Recon-/Task-Abschluss |

### 7.0.3 Regel für `bush_recon`

`bush_recon` wird fachlich wie folgt behandelt:

- Zieltyp: Bush-/Remote-Ziel mit Air-Task
- Ablaufbasis: `POI on-task`
- Zusatzregel: `RTB` ist verpflichtend
- Ziel-Landung: optional als Aussenlandung/Improvisation denkbar, aber **nicht** Teil des Erfolgsrezepts
- Erfolg: Task im Zielgebiet qualifiziert **und** Rückkehr zum Heimatplatz

Das bedeutet ausdrücklich:

- `bush_recon` darf nicht den `pickup`-Pfad verwenden
- `bush_recon` darf nicht den `target unload`-Pfad verwenden
- `bush_recon` darf nicht nur wegen Bush-Kontext automatisch in eine Bodenphase am Ziel springen
- wenn `on_task` fachlich "kreisen / beobachten / dokumentieren" bedeutet, dann muss die Task-Erfüllung genauso behandelt werden wie bei POI-Missionen

Planungs- und UI-Regel dazu:

- `bush_recon` nutzt fuer Routing, Profil und Briefing die `POI on-task`-Darstellung
- der Zielplatz ist dabei fachlich der `POI` bzw. Arbeitswegpunkt, nicht das primaere Landeziel
- Sollstruktur im Flugplan:
  - `Startflugplatz -> 🎯 Zielgebiet / Recon Area -> Return Leg -> Startflugplatz`
- Sollparameter:
  - `targetAltFt > 0`
  - `targetRadiusNm > 0`
  - `targetDwellMin > 0`
- Anzeigen wie Ziel-Runway, Ziel-Frequenz oder A-B-Zieldenke muessen fuer dieses Rezept unterdrueckt werden

Merksatz:

- `POI-Rezept fuer Task, Zielgebiet und Planprofil`
- `Bush-Kontext nur fuer Story, Persona und Zieltyp`

### 7.0.4 Umgang mit Aussenlandungen

Für Task-Missionen vom Typ `POI on-task` oder `Bush RTB task` gilt:

- das Erfolgsrezept erwartet normalerweise keine Landung am Ziel
- eine freiwillige oder improvisierte Landung kann erzählerisch kommentiert werden
- eine solche Landung ersetzt aber die Task-Erfüllung nicht automatisch
- sie darf nur dann Erfolg auslösen, wenn die Mission ausdrücklich als `strip target` oder `pickup return` gebaut wurde

Faustregel:

- `Landung ist Teil des Rezepts` nur bei `APT arrival`, `Bush strip target`, `Bush pickup return`
- `Landung ist nicht Teil des Rezepts` bei `POI on-task` und `Bush RTB task`

### 7.1 APT-Familie

APT-Missionen gehoeren fachlich immer zur Grundform `A -> B`.

Gemeinsame Bausteine der APT-Familie:

- Startflugplatz und Zielflugplatz sind echte Flugplatz-Endpunkte
- `APT-Arrival-Plan` kann aktiv sein
- Abschluss liegt am Zielplatz, nicht am Heimatplatz
- kein `on_task`-Rezept ueber dem Ziel
- kein `return_leg`, ausser die Mission ist ausdruecklich kein APT-Rezept mehr

Gemeinsame Architekturregeln:

- APT-Missionen enden ueber `enroute -> end_unloading/end_ready -> close`
- `pickup` ist in APT-Rezepten nicht erlaubt
- `end_ready` soll sich moeglichst am geplanten `apt_arrival_point` orientieren, nicht nur am generischen Airport-Fallback
- Passenger-/Cargo-/Handoff-Varianten aendern nicht den Grundablauf, sondern nur Manifest, Arrival-Rolle, Voice und Deboarding-/Unload-Verhalten

### 7.1.1 APT Arrival Standard

Typische Beispiele:

- Charter
- Besuch
- normaler Passagierflug
- Utility-/Club-Flug ohne besonderen Bodenprozess

Bausteine:

- Passenger optional
- Cargo optional
- Startszene optional
- `APT-Arrival-Plan` aktiv, wenn ein Empfangs-/Treffpunkt sinnvoll ist
- Zielabschluss am Arrival-Punkt oder sauberem Airport-Fallback

Typische Erfolgslogik:

- Landung/Ziel erreicht
- falls Passenger an Bord: Deboarding
- falls Pflichtcargo vorhanden: zuerst Unload
- Farewell + Deboarding
- danach `closingPending` / Mission schliessen

### 7.1.2 APT Cargo Handoff

Typische Beispiele:

- Dokumente
- Ersatzteile
- Wartungskits
- medizinische Kisten ohne Patiententransport

Bausteine:

- in der Regel `0 PAX`
- Manifest mit required Cargo
- `APT-Arrival-Plan` aktiv
- Arrival-Rolle beschreibt Empfaenger, Bodencrew oder Frachtkontakt

Typische Erfolgslogik:

- Landung am Ziel
- Pflichtladung am Ziel entladen
- Farewell nicht aus PAX-Sicht, sondern aus Sicht des Empfaengers / Bodenkontakts
- Deboarding nur, wenn wirklich Passenger an Bord waren
- danach `closingPending`

Wichtige Voice-Regel:

- Boardingtext darf aus Loadmaster-/Dispatcher-Sicht kommen
- Ziel-Farewell darf aus Receiver-/Empfaenger-Sicht kommen
- kein versehentliches PAX-Farewell bei cargo-only APT-Missionen

### 7.1.3 APT Passenger Dropoff

Typische Beispiele:

- Chartergast
- Vereinskollege
- Fotograf / Techniker / Besucher mit Zieltermin

Bausteine:

- Passenger required
- Cargo optional
- `APT-Arrival-Plan` optional, aber oft sinnvoll
- Zielabschluss ueber Passagierausstieg am Ziel

Typische Erfolgslogik:

- Landung am Ziel
- Passagier steigt am Ziel aus
- optional zusaetzliche Fracht entladen
- Farewell aus Sicht des Passagiers
- Deboarding abschliessen
- danach `closingPending`

### 7.1.4 APT Training

Typische Beispiele:

- Platzrunden- oder Navigationsschulung
- Instructor-Flug
- Airwork mit Zielplatzbezug

Bausteine:

- Instructor-/Training-Passagierprofil
- Trainingsdaten / Trainingsprompt aktiv
- kein normales Handoff-Rezept am Ziel
- `APT-Arrival-Plan` in der Regel unterdrueckt oder fachlich nachrangig

Typische Erfolgslogik:

- Trainingsflug absolvieren
- Landung / Abschluss am Ziel oder laut Trainingsrezept
- Trainingsfazit statt normalem Charter-/Receiver-Farewell

Wichtige Abgrenzung:

- `APT training` ist kein normales `APT arrival` mit umetikettierten Texten
- Training darf keine zufaellige Cargo-/Empfangslogik am Ziel bekommen, wenn fachlich nur der Schulungsflug gemeint ist

### 7.2 POI-Familie

POI-Missionen gehoeren fachlich zur Grundform `A -> B (Task ohne Landung) -> A`, auch wenn Start- und Endflugplatz im Flugplan derselbe Heimatplatz sind.

Gemeinsame Bausteine der POI-Familie:

- `B` ist fachlich ein Arbeitsgebiet, kein klassisches Landeziel
- Ziel wird ueber POI-/Target-Routepunkt dargestellt
- Zielszene / Zielkontext ersetzt den APT-Arrival-Plan
- Task wird ueber Hoehe, Radius, Verweilzeit oder Gebietserfuellung qualifiziert
- Landung am Ziel ist normalerweise nicht Teil des Erfolgsrezepts

Gemeinsame Architekturregeln:

- POI-Missionen verwenden `enroute -> on_task -> end_unloading -> ready_to_close` oder `enroute -> on_task -> return_leg -> home_unloading -> ready_to_close`
- `pickup` ist kein regulaerer POI-Pfad
- Pflicht-Missionsfracht einer POI-Mission wird am tatsächlichen Abschlussort über das zentrale Verladefenster entladen und per Ankunftsunterschrift bestätigt
- weitere Items verwenden `unload` nur, wenn das Manifest ausdrücklich einen echten Home- oder Ziel-Handoff verlangt
- Erfolg entsteht durch fachlich erfuellten Task, nicht durch blosses Landen am POI
- Sollparameter fuer echte POI-Tasks sind Teil des Missionsdesigns:
  - `targetAltFt > 0` oder bewusst `0` fuer Flyover-Sonderfall
  - `targetRadiusNm > 0`
  - `targetDwellMin >= 0`

Wichtige Runtime-Regel:

- Die POI-Familie darf denselben Task nicht doppelt modellieren, also nicht einmal ueber Verweil-/Radius-Logik und zusaetzlich noch ueber eine versteckte Bodenphase.
- Wenn ein POI fachlich "beobachten, dokumentieren, suchen, pruefen, kreisen" bedeutet, dann ist `on_task` der eigentliche Erfolgskern.

### 7.2.1 POI On-Task Standard

Typische Beispiele:

- Foto/Film
- Survey / Mapping
- Infrastruktur-Inspektion
- Biologie / Umwelt / Geologie
- Lern- oder Guide-Flug ohne Landung am Ziel

Bausteine:

- Passenger oft aktiv
- Zielszene / Target-Kontext aktiv
- Hoehe, Radius und Verweilzeit als Taskparameter
- Heimkehr je nach Rezept optional oder verpflichtend

Typische Erfolgslogik:

- Zielgebiet erreichen
- `on_task` durch Radius + Hoehe + Verweilzeit erfuellen
- danach direkt `ready_to_close` oder `return_leg`
- Missionsende erst nach sauberem Bodenstopp

Wichtige Design-Regel:

- Der POI bleibt Arbeitswegpunkt, nicht Landeplatz
- Ziel-Runway-, Ziel-Frequenz- und A-B-Ziel-Denke muessen unterdrueckt werden

### 7.2.2 POI Flyover / No-Dwell

Typische Beispiele:

- kurzer Sichtcheck
- einmaliger Fotopass
- bestaetigender Ueberflug

Bausteine:

- `targetDwellMin = 0`
- Task wird beim sauberen Ziel-Einflug / Ueberflug als erfuellt markiert

Typische Erfolgslogik:

- Zielgebiet erreichen
- kurzer Ueberflug genuegt
- kein langes Kreisen erforderlich
- danach `ready_to_close` oder `return_leg`

Wichtige Abgrenzung:

- Auch hier ersetzt eine Landung am Ziel nicht den fachlichen Flyover
- Wenn "einmal drueber und bestaetigen" gemeint ist, bleibt es trotzdem ein POI-Rezept

### 7.2.3 POI Return Home

Typische Beispiele:

- klassische Rundflug-POIs mit Rueckkehr zum Heimatplatz
- Bush-Recon-artige Rezepte auf POI-Basis
- Missionen, bei denen der Auftrag erst nach Heimkehr wirklich abgeschlossen sein soll

Bausteine:

- `on_task` am Ziel
- verpflichtender `return_leg`
- Abschluss erst daheim

Typische Erfolgslogik:

1. Zielgebiet qualifizieren
2. Task in `on_task` sauber erfuellen
3. danach auf `return_leg`
4. Mission erst am Heimatplatz auf `ready_to_close`

Merksatz:

- `Task am Ziel`
- `Abschluss daheim`
- `keine Ziel-Landung als Erfolgskuerzel`

### 7.2.4 POI Fire Watch

Das ist kein neues Grundrezept, sondern `POI on-task` mit Zusatzregeln.

Zusatzregeln:

- Fokus auf Rauch, Hotspots, Sichtachsen, trockene Vegetationsstreifen
- Zielszene kann reduziert oder ganz ausgesetzt sein, wenn die Beobachtungslogik wichtiger ist
- Voice und Story duerfen Lagebild-Charakter haben, aber keine kuenstliche Katastrophendramatik
- Erfolg bleibt ein sauber erfuellter Luft-Task, nicht eine Landung am Ziel

### 7.2.5 POI Search and Rescue

Das ist ebenfalls kein neues Grundrezept, sondern `POI on-task` mit Suchlogik.

Zusatzregeln:

- Fokus auf Suchgebiet, Hinweise, Sektoren, Landmarken, Sichtlinien
- Erfolg haengt an Such-/Tasklogik, nicht an einer zufaelligen Bodenphase
- Story, Scene und Voice muessen denselben Suchauftrag beschreiben
- Falls spaeter echte Pickup-/Evac-Logik noetig wird, ist das kein reines POI-Rezept mehr

SAR-Unterlogik innerhalb dieses Rezepts:

- `search_and_rescue` bleibt `POI on-task`; es bekommt keine eigene Ablaufkette.
- Die Zielkategorie wird innerhalb des Profils bewusst balanciert. Wald, Wasser und Berg duerfen gegenueber Strassen leicht bevorzugt werden, weil Strassen in den POI-Daten sehr haeufig sind. Diese Gewichtung muss mild bleiben; sie darf keine neue Wasser- oder Naturdominanz erzeugen.
- Die V4-Semantik darf SAR-Zielkategorien nicht grober machen als noetig. Insbesondere bleibt `road` eine Road-/Traffic-Kategorie und darf nicht zu `generic` fallen, weil sonst generische Land-Incidents wie Luftfahrzeuglagen faelschlich erlaubt werden.
- Generische OSM-/Geometry-Namen wie `water`, `road`, `track`, `traffic_signals`, `terrain`, `meadow`, `farmland`, `forest`, `service` oder `Uferbereich` duerfen nie den sichtbaren Zielnamen im Briefing ersetzen. Sie sind technische Anker, nicht Erzaehlsubjekt. Wenn der verfeinerte Anker nur so ein technisches Label hat, bleibt der gewaehlte POI-Name das narrative Ziel; der Anker dient nur fuer Platzierung, Sichtbezug und Lagebeschreibung.
- Vor der Incident-Wahl wird eine Lage-Evidenz aus Zielkategorie, `targetGeoContext`, `missionTruth`, sichtbaren Ankern und Verlauf gebildet.
- Nach dem Ziel-/Kategorie-Lock wird genau eine SAR-Decision gebildet. StoryFrame, SceneProfile, Objektfamilien und Writer-Contract muessen auf dieser Entscheidung aufbauen; es darf keinen zweiten unabhaengigen Incident-Wurf in einem spaeteren Schritt geben.
- StoryFrame-Felder sind Rohmaterial fuer den Writer, keine Satzliste. Ein einzelnes Feld wie `subjectDetail` darf nicht als freistehendes Fragment in die Story rutschen; bei fragmentierter Writer-Ausgabe wird aus dem Contract neu zusammengesetzt.
- Diese Lage-Evidenz ist primaer; Verlauf/History ist nur Varianz-Tiebreaker. Ein starker Verkehrsraum darf nicht nur wegen History in generische Personensuche kippen.
- SAR ist nicht automatisch Vermisstensuche. Moegliche Incident-Familien sind u.a. Personensuche, verletzte Person, Verkehrsunfall, Fahrzeug abseits der Strasse, Wasser-/Bootslage und vermisstes Luftfahrzeug.
- Die gewaehlte Incident-Familie muss durchgängig bleiben:
  - `road_collision`: Unfall-/Kollisionslage, Fahrzeuge, Personen an der Unfallstelle, Rauch, Zufahrt, Sperrung oder Lagebild fuer Leitstelle.
  - `vehicle_off_road`: Fahrzeug von Strasse/Weg abgekommen, versteckte Endlage, Boeschung, Waldsaum, Ufer oder schwer einsehbarer Randbereich.
  - `missing_hiker`/verwandt: Personensuche mit letzter Sichtung, Suchraum, Person oder Bodenhinweis.
  - Wasserlagen: Boot, Rettungsinsel, Uferhinweis, Person am Ufer oder Wasserrettungs-Zugriffspunkt.
  - Luftfahrzeuglagen: letzter Funk-/Sichtkontakt, Mayday/Positionshinweis, Wrack-/Debris-/Rauchhinweise. Wenn ein Flugzeug-/UL-Objekt verfuegbar ist, ist es das Primaerobjekt der Szene; generische Logs, Paletten oder Kartons sind nur Zusatz-Debris, nicht der eigentliche Befund.
- Writer und Scene duerfen keine zwei Incident-Familien zu einer Mischlage verschmelzen. Wenn `road_collision` gewaehlt ist, darf daraus nicht im Briefing ein einzelnes "vermisstes Fahrzeug von der Fahrbahn" werden; wenn genau das gemeint ist, ist die Familie `vehicle_off_road`.
- Diese Trennung ist nicht nur Prompt-Regel: Planner-/Writer-Text, der gegen den gewaehlten Incident oder seine Familie eine andere SAR-Lage einmischt, muss verworfen oder aus dem passenden Incident-Frame neu aufgebaut werden. Gute lokale Details duerfen erhalten bleiben, wenn sie den gelockten Incident konkretisieren statt ihn umzudeuten.
- SAR-Briefings duerfen keine unentschiedenen Einsatz-Alternativen formulieren. Nicht "Wanderer oder UL", sondern eine konkrete Dispatch-Annahme mit Wer/Was, Wo, Ausloeser, Warum jetzt und benoetigtem Luftbefund.
- User-facing SAR-Texte duerfen keine internen Planungswoerter wie `SAR-Erkundung`, `Unterfokus`, `Pipeline`, `Contract`, `Planner`, `Zielkategorie` oder `passt durch Zielkategorie` enthalten.
- Felder wie `lastSeenContext` sind fachlich als letzter Bericht, letzte Sichtung, letzte Ortung oder letzter Funkkontakt zu lesen. Sie duerfen nicht automatisch eine vermisste Person implizieren.
- Alle frei formulierten Missionstexte bleiben Deutsch. Englische Rohfelder aus einem Planner-/Writer-Ausreisser muessen verworfen oder deutsch neu aufgebaut werden, statt gemischt in das Briefing zu laufen.
- QA-Dryruns koennen SAR-Profil, Zielkategorien und einzelne Test-Incidents erzwingen, ohne die echte Dispatch-Auswahl zu aendern: `node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=8 --profile=search_and_rescue --categories=road,forest,water,mountain --out=sar-forced.json` oder `node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=3 --profile=search_and_rescue --incidents=missing_hiker,angler_missing,riverside_vehicle_entry --out=sar-incidents.json`. Synthetische Ziel-POIs in diesem Tool sind nur Testanker, damit Kategorien und Incident-Familien deterministisch durch Zieldefinition, Contract, Writer und Scene laufen.

### 7.2.6 POI Training

POI-Training ist ein POI-Sonderfall, aber kein normales Beobachter-/Arbeitsprofil.

Zusatzregeln:

- Trainingscalls und Instructor-Feedback haben Vorrang vor normalem POI-Passagierdialog
- keine normale "Arbeitsauftrag erledigt"-Dramaturgie, wenn fachlich ein Uebungsflug gemeint ist
- Hoehe/Radius/Verweilzeit koennen weiterhin als Uebungsrahmen dienen
- Trainingsfazit ersetzt den regulaeren Beobachter-/Survey-Abschluss

Wichtige Abgrenzung:

- `POI training` ist kein normales `POI on-task` mit anderen Texten
- sobald der Kern des Flugs Schulung ist, muessen Voice, Erfolg und Abschluss diesen Schulungscharakter tragen

### 7.2.7 Referenzprofile innerhalb der POI-Familie

Die POI-Familie soll kuenftig nicht mehr nur ueber lose Task-Domains erkannt werden, sondern ueber klare Referenzrezepte.

| POI-Rezept | Typische Task-Domains / Profile | Wofuer wiederverwenden |
| --- | --- | --- |
| `poi_on_task` | `inspection_infra`, `media_photo`, `mapping_survey`, `science_bio`, `science_geo`, `science_general`, `news_coverage` | klassischer Arbeitsauftrag im Zielgebiet mit Hoehe/Radius/Verweilzeit |
| `poi_flyover` | kurzer Sichtcheck, einmaliger Fotopass, schneller Verifikationsflug | POI-Auftrag ohne Dwell, Task wird beim Ueberflug erfuellt |
| `poi_on_task_return` | `bush_recon_return` und spaetere Bush-Air-Tasks auf POI-Basis | POI-Arbeit am Ziel, Abschluss aber verpflichtend erst nach Heimkehr |
| `poi_fire_watch` | `fire_watch` | POI on-task mit Lagebild-/Feuerwacht-Regeln |
| `poi_search_and_rescue` | `search_and_rescue` | POI on-task mit Such-/SAR-Regeln |
| `poi_training` | `training`, `club_training_basic`, `club_training_advanced` | POI-Aufgabe mit Instructor-/Schulungsfokus statt normalem Arbeitsdialog |

Wiederverwendungsregel:

- Erst POI-Rezept waehlen.
- Danach erst Text, Persona, Szene und Zielkontext anpassen.
- `fire_watch`, `search_and_rescue` und `training` sind keine neuen Hauptablaeufe, sondern kontrollierte Unterrezepte derselben POI-Familie.

### 7.2.8 Code-Guardrails fuer POI-Rezepte

Die POI-Familie hat bereits mehrere implizite Guardrails im Code. Diese muessen kuenftig bewusst als gemeinsamer Vertrag behandelt werden.

Wichtige Einstiege:

- `missionUsesPoiTaskRecipe()`
- `missionPoiRecipeId()`
- `missionUsesPoiPresentation()`
- `getPoiTaskPassengerDefaults()`
- `enforcePoiPassengerAltitudeRule()`

Aktuelle Guardrail-Regeln:

- Wenn eine Mission **kein** POI-/POI-artiges Rezept nutzt, muessen `targetAltFt`, `targetRadiusNm` und `targetDwellMin` auf `0` zurueckgesetzt werden.
- Wenn eine Mission **ein** POI-/POI-artiges Rezept nutzt, werden diese Werte auf sinnvolle Defaults und Mindestgrenzen normalisiert.
- `bush_recon_return` wird nicht als Lande- oder Pickup-Mission erkannt, sondern als `poi_on_task_return`.
- `poi_flyover` bleibt ein POI-Rezept, auch wenn `targetDwellMin = 0` ist.
- `fire_watch`, `search_and_rescue` und `training` aendern Voice-/Szenen-/Statusregeln, aber nicht das Grundrezept `Task am Zielgebiet statt Ziel-Landung`.

Warnsignale:

- Eine Mission verlangt Hoehe/Radius/Verweilzeit, ist aber kein POI-/POI-artiges Rezept.
- Eine Mission ist fachlich POI, baut aber ihr Ergebnis ueber Bodenstop statt `on_task`.
- Eine Bush-Air-Task braucht ploetzlich `pickup`- oder `unload`-Pfad am Ziel.
- Ein POI-Sonderfall fuehrt eigene Abschlussphasen ein, statt `on_task -> ready_to_close` oder `on_task -> return_leg -> ready_to_close` zu nutzen.

### 7.3 Bush-Zuordnung zu den Grundformen

Die Bush-Familie ist kein eigener vierter Hauptablauf, sondern verteilt sich auf die drei Grundformen.

Aktuelle Zuordnung der Bush-Profile:

| Bush-Profil | Grundform | Rezeptbasis | Kernaussage |
| --- | --- | --- | --- |
| `bush_supply_strip` | `A -> B` | `Bush strip target` | Landung am Zielstrip, Pflichtladung am Ziel raus, Abschluss am Ziel |
| `bush_charter_strip` | `A -> B` | `Bush strip target` | Landung am Zielstrip, Passenger-Dropoff am Ziel, Abschluss am Ziel |
| `bush_scenic_hopper` | `A -> B` | `Bush strip target` | Adventure-/Scenic-Landung am Zielstrip, kein RTB-Zwang |
| `bush_pickup_strip` | `A -> B (mit Landung) -> A` | `Bush pickup return` | leer hin, Passenger-Pickup am Ziel, Rueckflug, Abschluss daheim |
| `bush_pickup_cargo` | `A -> B (mit Landung) -> A` | `Bush pickup return` | leer hin, Cargo-Pickup am Ziel, Rueckflug, Abschluss daheim |
| `bush_recon_return` | `A -> B (Task ohne Landung) -> A` | `POI on-task` mit RTB-Pflicht | Zielgebiet ist Arbeitsraum, nicht Landeziel; Task erst in der Luft, Abschluss daheim |

Wichtige Wiederverwendungsregel:

- `pickup return` ist das Referenzmuster fuer alle Bush-Missionen mit echter Zwischenlandung plus Rueckflug.
- `strip target` ist das Referenzmuster fuer alle Bush-Missionen mit Ziel-Landung und Abschluss am Ziel.
- `bush_recon_return` ist das Referenzmuster dafuer, wie Bush-Kontext auf ein POI-Rezept aufgesetzt wird.

Warnsignal fuer künftige Arbeit:

- Wenn ein Bush-Profil nicht sauber in eine dieser drei Gruppen passt, brauchen wir zuerst eine fachliche Rezeptentscheidung.
- Wenn nur Story, Rolle, Cargo oder Zieltyp anders sind, darf kein neuer Ablauf gebaut werden.

### 7.3.1 Mission Variety Packs

Fuer Missionskategorien mit vielen moeglichen Rollen, Anlaessen oder Mikrogeschichten kann die globale Variety-Engine genutzt werden. Sie ist optional und darf keine Rezeptlogik ersetzen.

Ziel:

- grosse interne Rollen-/Themenpools wartbar ausserhalb von `app.js` halten
- pro Generierung nur einen kleinen, passenden Ausschnitt in den Prompt geben
- Wiederholungen ueber lokale Browser-History reduzieren
- Token sparen, ohne die KI auf eine einzige feste Story zu setzen

Grundregel:

- Kontext und Rezept schlagen Varianz.
- Die Variety-History darf nur zwischen mehreren plausiblen Optionen streuen.
- Eine Rolle oder Storyfamilie darf nie gegen `missionTruth`, Zielkontext, Profil, TaskDomain oder Wetterlogik erzwungen werden.
- Sobald Planner/Writer eine Storyrichtung nutzen, muss sie im Contract/Debug sichtbar sein und von Briefing, `pickupStory` und Voice konsistent weitergefuehrt werden.

Technisches Muster:

- Kandidatenpools liegen in `mission-variety-core.js`.
- Ein Profil kann `selectMissionVarietyPack({ namespace, profileId, context, draft, maxItems, wildcardRate })` nutzen.
- Die Funktion liefert ein `missionVarietyPack.v1` mit `candidateShortlist`, `ingredientAxes`, `primaryId`, `primaryFamily`, `selectedFamilies`, `selectedIds`, `contextTags` und `storageKey`.
- Der erste Eintrag der `candidateShortlist` ist der Primary-Kandidat. Fuer ihn gilt ein eigener History-Cooldown, weil er normalerweise die konkrete Storyrichtung praegt.
- Die History liegt nur lokal im Browser (`localStorage`), z. B. `ga_mission_variety_history_bush_pickup_strip_v1`.
- Gespeichert werden nur kleine Signaturen, keine kompletten Stories.

Wildcard:

- Wildcard-Kandidaten duerfen seltener und kurioser sein.
- Auch Wildcards bleiben profilkompatibel und duerfen keine neue Geografie, kein neues Rezept und keine unpassende TaskDomain erzeugen.

Aktueller Anschluss:

- `bush_pickup_strip` nutzt ein Variety-Pack fuer Rollen-/Storyrichtungen.
- Der Flugablauf bleibt fest: leer zum Zielstrip, Pickup, Rueckflug, Abschluss daheim.
- Das Pack liefert nur den kreativen Rahmen: Rolle, Taetigkeit, sichtbare Ausruestung, Rueckkehrgrund und Handoff.
- Pool-Eintraege sind Rohmaterial, keine fertigen Satzteile. Planner/Writer duerfen sie nicht wortwoertlich hinter "weil", "damit" oder "um" kopieren, sondern muessen daraus natuerliche deutsche Saetze bauen.
- `bush_pickup_strip` verwendet dafuer die eigene `taskDomain` `bush_pickup_return`, nicht die generische `charter`-Domain.
- Grund: normales Charter darf Termin-/Anschlusslogik nutzen; Bush-Pickup soll aus Arbeit vor Ort, Wartepunkt, Ergebnis und Rueckkehr-Handoff erzaehlen und nur dann Zeitdruck bekommen, wenn Wetter, Urgency oder Story das konkret tragen.
- Perspektive bleibt getrennt: `story`/Briefing ist Dispatcher- bzw. Auftragsperspektive fuer den Piloten; Ich-Form des abgeholten Gasts gehoert nur in `passenger.greetingText`, `pickupStory.boardingCue`, `pickupStory.departureCue` und spaetere Voice-Ansagen.
- `bush_supply_strip`, `bush_charter_strip`, `bush_scenic_hopper`, `bush_recon_return` und `bush_pickup_cargo` nutzen `CONTEXT_BUNDLE.missionVarietyBrief` als generischen Bush-Variety-Anschluss.
- Auch hier gilt: Das Pack liefert Rohmaterial, kein Story-Skript. Das jeweilige Profil-Rezept bleibt bindend:
  - Supply liefert am Zielstrip aus.
  - Charter setzt den Gast am Zielstrip ab.
  - Scenic endet als Adventure-/Scenic-Landung am Zielstrip.
  - Recon prueft Strip oder Umfeld aus der Luft und kehrt heim.
  - Cargo-Pickup fliegt leer hinaus, holt nur Fracht und kehrt zur Basis zurueck.
- Jedes Profil nutzt einen eigenen Namespace und damit eigene lokale History, z. B. `ga_mission_variety_history_bush_supply_strip_v1`.

Empfohlene spaetere Anschluesse:

- Weitere Bush-Unterprofile koennen denselben `missionVarietyBrief`-Anschluss nutzen, wenn sie ein klares Rezept und einen eigenen Namespace haben.
- POI Inspection/Photo/Science: Anlassfamilien und Blickwinkel, nicht neue Abschlussrezepte.

### 7.4 Bush Supply

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

### 7.5 Bush Charter

Bausteine:

- `targetMode = strip`
- `completionMode = passenger_dropoff`

Typische Erfolgslogik:

- Zielstrip erreichen
- Passagier am Ziel aussteigen lassen
- Deboarding/Farewell

### 7.6 Bush Recon Return

Bausteine:

- fachlich wie `POI on-task`
- Bush-Zielkontext / Remote-Strip / Wilderness-Texte
- verpflichtender RTB zum Heimatplatz

Typische Erfolgslogik:

1. Zielgebiet in der Luft qualifizieren
2. `on_task` wie bei POI-Missionen behandeln
3. nach erfülltem Task direkt auf `return_leg`
4. Mission erst am Heimatplatz beenden

Wichtige Architekturregel:

- `Bush Recon Return` ist **kein** `pickup`-Rezept.
- `Bush Recon Return` ist **kein** `target unload`-Rezept.
- Pflicht-Missionsfracht wird bei `Bush Recon Return` ausschließlich nach der Rückkehr am Heimatplatz entladen.
- Es nutzt das POI-Task-Rezept und ergänzt nur:
  - Bush-Narrativ
  - Bush-Zieltypen
  - RTB-Pflicht

Wenn `bush_recon` technisch neue Sonderpfade braucht, ist das fast immer ein Warnsignal. Zuerst prüfen, ob dieselbe Anforderung bereits durch POI-Phasen (`enroute`, `on_task`, `return_leg`, `ready_to_close`) ausgedrückt werden kann.

### 7.7 Bush Pickup Passenger

Bausteine:

- `targetMode = strip_then_return`
- `pickupKind = passenger`
- `completionMode = return_home`

Typische Erfolgslogik:

1. leer zum Zielstrip
2. PAX und Begleitfracht im zentralen Verlade-Manager laden
3. Pickup-Liste mit eigenem Scope `pickup` unterschreiben
4. Pickup separat bestaetigen und damit den Rueckflug freigeben
5. Rückflug
6. Begleitfracht daheim entladen und Ankunft unterschreiben/bestaetigen
7. Passagier nach Farewell daheim aussteigen lassen
8. optional Handoff-Szene
9. Mission schließen

Lifecycle-Guardrails:

- Der leere Hinflug hat keine Start-Fahrzeug-/Crew-Szene; die Pickup-Szene wird
  erst in Zielnaehe vorgestaged.
- Die Pickup-Szene ist nach der separaten Pickup-Bestaetigung verbraucht und
  darf durch GPS-/Reconnect-Ticks nicht respawnen.
- Strip-Fallbacks verwenden nach Moeglichkeit die OSM-Runway-Achse und einen
  geprueften Seitenabstand fuer Anker und alle Items, nicht den Streckenkurs.
- Mit Beginn des `return_leg` werden Home-Anker und Home-Airport fuer die
  Landeerkennung verwendet; der Pickup-Anker ist dann nur noch Historie.
- Der Passenger bleibt bis Farewell/Deboarding `loaded`. Ein direkter manueller
  Passenger-Unload am Home-Endpunkt ist kein Ersatz fuer diese Sequenz.

### 7.8 Bush Pickup Cargo

Bausteine:

- `targetMode = strip_then_return`
- `pickupKind = cargo`
- `completionMode = return_home`

Typische Erfolgslogik:

1. leer hin
2. Fracht aufnehmen
3. Pickup-Liste mit eigenem Scope `pickup` unterschreiben
4. Pickup separat bestaetigen und damit den Rueckflug freigeben
5. Rückflug
6. Fracht am Heimatplatz ausladen
7. Ankunft unterschreiben und bestaetigen
8. Mission schließen

## 8. Checkliste für neue Missionstypen

### 8.0 Entscheidungslogik für neue Missionen

Bevor ein neues Profil gebaut oder erweitert wird, läuft die Entscheidung immer in dieser Reihenfolge:

1. **Grundform bestimmen**
   - `A -> B`
   - `A -> B (mit Landung) -> A`
   - `A -> B (Task ohne Landung) -> A`

2. **Rezeptfamilie bestimmen**
   - `APT arrival`
   - `POI on-task`
   - `Bush strip target`
   - `Bush pickup return`
   - vorhandenes Unterrezept derselben Familie

3. **Prüfen, ob nur Kontext variiert**
   - andere Story
   - andere Passenger-/Cargo-Rolle
   - anderer Zieltyp
   - andere Sollhöhe / Radius / Verweilzeit
   - andere Arrival-/Handoff-Dekoration

4. **Nur wenn der Ablauf fachlich neu ist, neues Rezept bauen**

Merksatz:

- `anderes Thema` ist **kein** neuer Ablauf
- `anderer Zieltyp` ist **kein** neuer Ablauf
- `anderes Manifest` ist oft **kein** neuer Ablauf
- nur `andere Fortschrittslogik` rechtfertigt ein neues Rezept

### 8.1 Gemeinsamer A->B-Basiskontrakt

Alle Missionen der Grundform `A -> B` muessen denselben Basiskontrakt erfuellen, egal ob sie thematisch `APT` oder `Bush` sind.

Gemeinsame Basiskette:

- `enroute`
- am Ziel mit gueltigem Bodenstopp:
  - `end_unloading`, wenn required Unload / Deboard / Handoff noch offen ist
  - sonst `end_ready`
- danach Farewell / Deboarding / Close
- danach `closingPending`

Das bedeutet:

- Eine `Bush Supply`-Mission darf nicht an einer voellig anderen Endlogik haengen als ein `APT Cargo Handoff`, wenn beide fachlich `A -> B` mit Ziel-Unload sind.
- Eine `Bush Charter Dropoff`-Mission darf nicht andere Abschlussregeln brauchen als ein `APT Passenger Dropoff`, wenn beide fachlich `A -> B` mit Ziel-Deboarding sind.
- Nur die Zielszene, Arrival-Rolle, Sprecherrolle und Ground-Texte duerfen variieren.

Explizite A->B-Untervarianten auf derselben Baselogik:

- `A->B / Arrival Standard`
- `A->B / Cargo Handoff`
- `A->B / Passenger Dropoff`
- `A->B / Scenic Landing`

Wichtige Architekturregel:

- Bush-A->B-Missionen duerfen **keine** eigene Abschlussmaschine bauen, wenn sie fachlich nur eine Kontextvariante von `A -> B` sind.
- Wenn ein Bush-A->B-Profil nur deshalb eigene Endpfade braucht, weil Name, Zieltyp oder Atmosphaere anders sind, ist das ein Strukturfehler.

Warnsignal:

- Wenn eine Bush-A->B-Mission im Sim oder Live anders endet als eine gleichartige APT-A->B-Mission, obwohl beide dieselbe fachliche Zielhandlung haben, ist das fast immer falsche Rezepttrennung statt echter Fachlogik.

### 8.1.1 Referenzprofile fuer neue Missionen

Diese Profile sind die kanonischen Referenzen fuer neue Missionen derselben Ablaufklasse:

| Ablaufklasse | Referenzprofil | Wofuer wiederverwenden |
| --- | --- | --- |
| `A -> B` mit Ziel-Unload | `bush_supply_strip` | Bush-/APT-Cargo, Utility-Handoff, Receiver-Farewell |
| `A -> B` mit Ziel-Dropoff | `bush_charter_strip` | Bush-/APT-Passagier-Dropoff, Besuch, Fotograf, Techniker |
| `A -> B` mit Ziel-Landung ohne Handoff-Zwang | `bush_scenic_hopper` | Scenic-/Adventure-/Besuchsflug mit Abschluss am Ziel |
| `A -> B (mit Landung) -> A` Pickup Passenger | `bush_pickup_strip` | alle echten Rueckhol-PAX-Missionen |
| `A -> B (mit Landung) -> A` Pickup Cargo | `bush_pickup_cargo` | alle echten Rueckhol-Frachtmissionen |
| `A -> B (Task ohne Landung) -> A` | `bush_recon_return` | Bush-Recon, Bush-Inspection, Bush-Firewatch-Varianten auf POI-Basis |

Wiederverwendungsregel:

- Erst Referenzprofil waehlen.
- Danach nur Story, Rolle, Manifest, Zieltyp, Sollhoehe, Radius, Dwell und Voice-Perspektive variieren.
- Erst wenn die Fortschrittslogik selbst anders sein muss, entsteht ein neues Rezept oder Profil.

### 8.1.2 Code-Guardrails fuer Bush-Profile

Bush-Profile muessen im Code dieselbe Rezeptzuordnung respektieren wie im Kochbuch.

Aktuelle Guardrail-Ebene:

- `sanitizeBushMissionSpec()`
- `_bushRecipeIdFromProfileId()`
- `_bushRecipeIdFromSpec()`
- `_applyBushRecipeGuardrails()`

Diese Guardrails erzwingen bzw. warnen heute bei den Kernkombinationen:

- `strip_target`
  - `targetMode = strip`
  - `completionMode in { unload_at_target, passenger_dropoff, land_at_target }`
  - `requiresReturnHome = false`
  - `allowedEndLocations = [target]`
- `pickup_return`
  - `targetMode = strip_then_return`
  - `completionMode = return_home`
  - `requiresReturnHome = true`
  - `pickupKind = passenger|cargo`
  - `allowedEndLocations = [home]`
- `poi_on_task_return`
  - `targetMode = area_then_return`
  - `completionMode = return_home`
  - `requiresReturnHome = true`
  - kein `pickupKind`
  - `allowedEndLocations = [home]`

Wichtig:

- Ein Bush-Profil darf nicht gleichzeitig Pickup- und POI-Task-Rezept sein.
- Ein Bush-Recon darf nicht ueber `strip_then_return` oder Ziel-Unload modelliert werden.
- Ein Bush-Supply/Dropoff darf nicht heimlich `requiresReturnHome = true` setzen, wenn fachlich `A -> B` gemeint ist.

Wenn eine neue Mission diese Guardrails „braucht, um ausgeschaltet zu werden“, ist das fast immer ein Signal, dass erst das Rezept falsch gewählt wurde.

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
