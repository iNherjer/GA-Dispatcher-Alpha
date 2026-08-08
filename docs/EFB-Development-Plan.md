# EFB-Entwicklungsplan

Stand: 2026-08-08

Diese Datei ist der chatuebergreifende Einstiegspunkt fuer die Entwicklung der
MSFS-2024-EFB-App. Neue Chats lesen zuerst diese Datei und danach, passend zur
Aufgabe, `docs/EFB-Tracker-Architecture.md`, `docs/EFB-Community-Package.md`
und `docs/github-push-workflow.md`. Architekturentscheidungen, Releases und
wesentliche Testergebnisse werden hier fortgeschrieben.

## Aktueller freigegebener Stand

| Bereich | Alpha | Stable | Bemerkung |
| --- | --- | --- | --- |
| Web-App | `origin/main` | getrennte Stable-Promotion | Alpha muss weiterhin mit dem freigegebenen Stable-Tracker funktionieren |
| Tracker-Runtime | v324 | v320 | v324 ergaenzt `mission.snapshot.v1`; neuere Funktionen bleiben capability-basiert |
| EFB-Community-Package | 0.2.0 | noch nicht verfuegbar | Alpha-Testpaket; Stable erst nach In-Sim-Freigabe desselben unveraenderten Artefakts |
| EFB-Transport | HTTP-Loopback, read-only | - | `127.0.0.1:49880`, keine Zugangsdaten und keine schreibenden Mission Commands |

EFB 0.2.0 zeigt Trackerstatus, Flugtelemetrie sowie den technischen
Missionsstatus aus `mission.snapshot.v1`. Missionsbriefing, Route, Manifest und
Missionsaktionen sind noch nicht Bestandteil dieses Protokollstands.

## Verbindliche Architekturentscheidungen

1. Der Windows-Tracker wird schrittweise zur lokalen Ausfuehrungs- und
   Rechenebene. SimConnect, Telemetrie, Szenen, persistente Missionslaufzeit und
   spaeter die Missionsausfuehrung liegen dort.
2. Das EFB bleibt eine schlanke Darstellung und sendet Benutzerabsichten. Es
   setzt niemals direkt Missionsphasen oder SimConnect-Werte.
3. Die Web-App bleibt fuer Missionserzeugung, V4-Semantik, Briefing, Contract,
   Profil und Cloud-Daten verantwortlich. Sie bleibt waehrend der Migration die
   Stable-Referenz.
4. Missionsregeln werden nicht aus Browserdateien in `tracker.js` kopiert. Sie
   werden zuerst als transport-, UI- und persistenzneutraler Kern extrahiert,
   den Web und Tracker mit denselben Tests ausfuehren koennen.
5. Pro Missionslauf gibt es genau eine schreibende Autoritaet. Web und Tracker
   duerfen nie gleichzeitig nach Last-write-wins denselben Zustand veraendern.
6. Neue Funktionen sind additiv und werden ueber Capabilities ausgehandelt.
   Fehlt eine Capability, bleibt die Web-App Autoritaet und das EFB zeigt einen
   begrenzten, erklaerten Fallback.
7. Alpha und Stable verwenden unveraenderliche Release-Artefakte. Ein getestetes
   Alpha-Artefakt wird durch Kanalumschaltung nach Stable promotet und nicht neu
   gebaut.

## Zielbild und Datenfluss

```text
Web-App: Missionserzeugung, Semantik, Briefing, Profil
                 |
                 | versioniertes Mission Execution Bundle
                 v
Tracker: autoritativer Missionskern, Persistenz, Telemetrie, Szenen
          |                                      ^
          | Snapshots                            | validierte Intents
          v                                      |
                 MSFS-2024-EFB

Web-App <---- Snapshots/Ereignisse ----> Tracker
           Beobachter/Fallback waehrend der Migration
```

Der Missionskern entscheidet aus einem alten Zustand und einem expliziten
Ereignis deterministisch den neuen Zustand. UI, Voice, Szenen und Transport
reagieren auf ausgegebene Effekte, besitzen aber keine versteckte eigene
State-Machine.

## Roadmap

### E0 - Read-only EFB stabilisieren

Status: in Alpha-Test

- EFB 0.2.0 ueber den Tracker-Desktop-Manager installieren und aktualisieren.
- Portrait/Landscape in den betroffenen Flugzeugen sowohl am physischen
  Cockpit-EFB als auch im 2D-Pop-out pruefen.
- Ohne Tracker, mit Tracker, mit aktivem Flug und mit aktiver Mission testen.
- Tracker-Neustart, EFB-Schliessen/Oeffnen sowie Offline-/Recovery-Anzeige
  pruefen.
- Browser/Web-Mission parallel gegenpruefen; 0.2.0 darf den bestehenden Ablauf
  nicht veraendern.
- Nach Freigabe exakt das Alpha-ZIP nach Stable promoten.

### E1 - `mission.snapshot.v2`

Status: geplant

Die Web-App bleibt Missionsautoritaet und uebergibt dem Tracker einen
sanitisierten, reicheren Lesezustand. Der Tracker persistiert und serviert ihn
lokal. Der Snapshot soll mindestens enthalten:

- `missionId`, `runId`, `recipeId`, `missionType`, `taskDomain`
- Lifecycle-, Runtime- und fachliche Unterphase
- Etappen, aktuelle Etappe und naechster Schritt
- `allowedActions` und strukturierte `blockingReasons`
- reduzierte Cargo-/Boarding-/Deboarding-Zustaende
- aktive untergeordnete Workflows, zunaechst read-only
- `revision`, `updatedAt`, `authority` und `stateHash`

Die bestehende `/api/v1/mission`-Antwort bleibt fuer EFB 0.2.0 erhalten. Eine
neue Capability, beispielsweise `mission.snapshot.v2`, schaltet die reichere
Darstellung gezielt frei. Zugangsdaten, Pilot-PIN und unnoetige persoenliche
Daten duerfen nicht in den Snapshot gelangen.

### E2 - Reinen Missionsausfuehrungskern extrahieren

Status: geplant

Ein neuer gemeinsamer Kern, Arbeitstitel `mission-execution-core.js`, kapselt:

- Normalisierung und Validierung eines Mission Execution Bundle
- `reduce(state, event)` fuer deterministische Phasenuebergaenge
- `deriveView(state)` fuer Anzeigephase, naechsten Schritt und Blocker
- `allowedActions(state)` fuer Web und EFB
- versionierte Serialisierung, Migration und State-Hash
- deklarative Effekte mit stabiler `effectId`, aber keine Ausfuehrung der Effekte

Der Kern darf kein DOM, `window`, `localStorage`, Voice, Relay, CommBus,
SimConnect oder Dateisystem direkt verwenden. Zeit, Zufall und Telemetrie werden
als explizite, normalisierte Ereignisse eingespeist. Sim- und Live-Modus nutzen
dieselbe State-Machine; der Sim-Modus emuliert lediglich Eingabeereignisse.

Beispielereignisse:

- `MISSION_ACCEPTED`, `PREPARE_REQUESTED`, `MISSION_STARTED`
- `BOARDING_STARTED`, `BOARDING_CONFIRMED`, `LOAD_CONFIRMED`
- `AIRBORNE`, `TARGET_ENTERED`, `TASK_PROGRESS`, `TOUCHDOWN`, `GROUND_STILL`
- `PICKUP_CONFIRMED`, `UNLOAD_CONFIRMED`, `FAREWELL_COMPLETED`
- `COMPLIANCE_EVENT`, `CLOSE_REQUESTED`, `MISSION_CLOSED`

Die vorhandenen fachlichen Wahrheiten bleiben erhalten: Cargo- und
Manifestkriterien kommen aus `mission-cargo-core.js`; Voice erzaehlt den
Zustand, bestimmt ihn aber nicht; `sync.js` bleibt zunaechst Adapter und
Orchestrator. Eine Verhaltenaenderung ist in dieser Phase nicht vorgesehen.

### E3 - Tracker-Shadow-Modus

Status: geplant

Web und Tracker verarbeiten dasselbe Execution Bundle und dieselben Ereignisse.
Die Web-App bleibt alleinige Autoritaet; der Tracker rechnet nur mit und
vergleicht:

- Phase und Unterphase
- erlaubte Aktionen und Blocker
- Cargo-/Workflow-Projektion
- Revision und State-Hash
- erzeugte deklarative Effekte

Abweichungen werden mit einem redigierten Event-Trace protokolliert. Replays
muessen in Browser und Node denselben Endzustand liefern. Shadow-Ergebnisse
duerfen keine Szenen, Voice oder Missionsabschluesse ausloesen.

### E4 - Autoritaet kontrolliert an den Tracker uebergeben

Status: geplant

Die Uebergabe erfolgt recipe-weise: zuerst ein normaler APT-A-nach-B-Ablauf,
danach Bush/Pickup, POI/Survey und zuletzt SAR sowie komplexe Sonderablaeufe.

Jeder Missionslauf fuehrt mindestens:

- `missionId`, eindeutige `runId` und `schemaVersion`
- `authority: web | tracker`
- monoton steigende `revision`
- `updatedAt` und `stateHash`

Der Wechsel `web -> tracker` verwendet erwartete Revision, Zustands-Hash und
ACK. Erst nach erfolgreichem ACK wird die Web-App zum Beobachter. Bei
Wiederverbindung uebernimmt sie den Trackersnapshot und schreibt nicht aufgrund
eines aelteren lokalen Zustands zurueck. Tracker-Persistenz muss atomar sein;
Recovery und Rollback werden vor der ersten Alpha-Autoritaet getestet.

### E5 - Schreibende EFB-Intents

Status: geplant

Der heutige offene GET-Loopback wird nicht einfach um ungeschuetzte POSTs
erweitert. Schreibzugriff benoetigt:

- eigene Capability, beispielsweise `mission.intent.v1`
- kurzlebige lokale Sitzung beziehungsweise Token
- Allowlist fachlicher Intents statt frei setzbarer Phasen
- `commandId`, erwartete Revision und Idempotenz
- Schema- und Zustandsvalidierung sowie Rate-Limits
- nachvollziehbare ACK-/Fehlerantworten

Beispiele sind `confirm_load`, `start_mission`, `confirm_pickup`,
`submit_compliance_evidence` und `request_close`. Nicht erlaubte Aktionen werden
vom Tracker mit einem strukturierten Blockierungsgrund abgewiesen.

### E6 - Bord-/Behoerdenkontrolle als untergeordneter Workflow

Status: geplant

Die Compliance-Logik wird nicht isoliert in den Tracker verschoben. Sie haengt
von Manifest, Boarding, Voice, Inspector-Szenen, Sanktionen und
Missionsabschluss ab und wird deshalb als verschachtelter Workflow gefuehrt:

```text
mission
|- flightPhase
|- groundOperations
|- cargo
`- workflows
   `- complianceInspection
```

Zuerst wird ihr Zustand in `mission.snapshot.v2` nur dargestellt. Danach werden
fachliche Bewertung und Phasenreducer transportneutral extrahiert. Szenen und
Voice bleiben Effekte; Profil-/Cloud-Synchronisation kann ueber eine persistente
ausstehende Effect-Queue erfolgen.

## Kompatibilitaets- und Rolloutregeln

- Stable Tracker v320 bleibt so lange gueltig, wie er den bestehenden
  Web-/Relay-Vertrag erfuellt. Alpha darf nicht pauschal den neuesten Tracker
  verlangen.
- Tracker ohne `mission.snapshot.v2` behaelt den aktuellen Web-Autoritaetsmodus.
- EFB blendet Aktionen aus oder deaktiviert sie mit Erklaerung, wenn eine
  Capability fehlt.
- Neue Trackerfelder und Nachrichten sind additiv. Unbekannte Felder muessen
  von alten Clients ignoriert werden koennen.
- Persistenzmigrationen sind vorwaertskompatibel oder erhalten einen getrennten
  Schema-/Datenpfad mit Import und Rollback.
- Jede Autoritaetsstufe beginnt in Alpha, laeuft im Shadow-Modus und wird erst
  nach dokumentiertem Test recipe-weise freigegeben.

## Testgates fuer den Missionskern

Vor jeder Autoritaetsfreigabe muessen mindestens bestehen:

1. Event-Replay in Web und Node mit identischem State-Hash.
2. APT-, Bush-, Pickup-, POI/Survey- und betroffene Sonderrezept-Selftests.
3. Cargo-, Boarding-, Deboarding- und Mission-Close-Blocker.
4. Tracker-Neustart in mehreren Missionsphasen ohne doppelten Effekt.
5. Web-Verbindungsverlust und Wiederverbindung ohne Rollback oder Split-Brain.
6. Doppelte, verspaetete und in falscher Reihenfolge eintreffende Intents.
7. Sim- und Live-Modus mit identischem fachlichem Zustandsverlauf.
8. Stable-Tracker-Fallback gegen die aktuelle Alpha-Web-App.

## EFB-Releaseablauf

1. Version in Source und PackageDefinition synchron setzen.
2. Mit der zum installierten MSFS-2024-SDK gehoerenden offiziellen Template-App
   bauen; Abhaengigkeiten per Lockdatei festhalten.
3. Offizielles Package Tool ausfuehren und `manifest.json`, `layout.json`,
   Dateigroessen und Hashes validieren.
4. In-Sim-Test im betroffenen Flugzeug und Darstellungsmodus.
5. `prepare-release.js` erzeugt ein Archiv mit genau einem Paket-Root.
6. ZIP unter `efb-app-v<version>` unveraenderlich hochladen und den Remote-Hash
   kontrollieren.
7. Erst danach `efb/channel/alpha.json` mit exakter URL, Groesse und SHA-256
   aktivieren und nach `origin/main` pushen.
8. Nach Testerfreigabe `stable.json` auf exakt dasselbe Artefakt setzen.

## Naechste priorisierte Schritte

- [ ] EFB 0.2.0 im problematischen Flugzeug auf Orientation-Flapping testen.
- [ ] EFB 0.2.0 ohne/mit Tracker sowie ohne/mit aktiver Mission testen.
- [ ] Testergebnis und betroffenen EFB-Modus in dieser Datei dokumentieren.
- [ ] Vertrag und Selftests fuer `mission.snapshot.v2` festlegen.
- [ ] Web-seitigen read-only Snapshot zum Tracker transportieren.
- [ ] EFB-Mission-Control zunaechst ohne Schreibaktionen darstellen.
- [ ] Schnittgrenze fuer `mission-execution-core.js` anhand der vorhandenen
      Runtime-, Cargo- und Compliance-Tests festlegen.
- [ ] Tracker-Shadow-Replay implementieren, bevor Autoritaet verschoben wird.

## Entscheidungsprotokoll

- 2026-08-07: EFB wird als eigenes, vom Tracker verwaltetes Community-Package
  mit getrennten Alpha-/Stable-Kanaelen ausgeliefert.
- 2026-08-07: Erste Transportstufe bleibt HTTP-Loopback und vollstaendig
  read-only; EFB 0.2.0 nutzt `mission.snapshot.v1`.
- 2026-08-08: Langfristige Missionsautoritaet soll im Tracker liegen. Der
  Umbau erfolgt ueber Snapshot v2, reinen gemeinsamen Kern, Shadow-Modus und
  recipe-weise Autoritaetsuebergabe; kein direkter Umzug der Browser-Runtime.
- 2026-08-08: Bord-/Behoerdenkontrolle wird als untergeordneter Missionsworkflow
  geplant und erst nach gemeinsamer Kernextraktion schreibend ins EFB gebracht.
