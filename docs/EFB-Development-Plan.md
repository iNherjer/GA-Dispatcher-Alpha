# EFB-Entwicklungsplan

Stand: 2026-08-10

Diese Datei ist der chatuebergreifende Einstiegspunkt fuer die Entwicklung der
MSFS-2024-EFB-App. Neue Chats lesen zuerst diese Datei und danach, passend zur
Aufgabe, `docs/EFB-Tracker-Architecture.md`, `docs/EFB-Community-Package.md`
und `docs/github-push-workflow.md`. Architekturentscheidungen, Releases und
wesentliche Testergebnisse werden hier fortgeschrieben.

## Aktueller freigegebener Stand

| Bereich | Alpha | Stable | Bemerkung |
| --- | --- | --- | --- |
| Web-App | `origin/main` | getrennte Stable-Promotion | Alpha muss weiterhin mit dem freigegebenen Stable-Tracker funktionieren |
| Tracker-Runtime | v325 | v320 | v325 ist im Alpha-Kanal; Stable bleibt bis zur Testerfreigabe unveraendert |
| EFB-Community-Package | 0.2.0 | noch nicht verfuegbar | Alpha-Testpaket; Stable erst nach In-Sim-Freigabe desselben unveraenderten Artefakts |
| EFB-Transport | HTTP-Loopback, read-only | - | `127.0.0.1:49880`, keine Zugangsdaten und keine schreibenden Mission Commands |

EFB 0.2.0 zeigt Trackerstatus, Flugtelemetrie sowie den technischen
Missionsstatus aus `mission.snapshot.v1`. Missionsbriefing, Route, Manifest und
Missionsaktionen sind noch nicht Bestandteil dieses Protokollstands.

EFB 0.3.0 wurde mit SDK 1.7.2 erfolgreich gebaut, im In-Sim-Test aber
verworfen: Header und Trackerstatus erschienen, die komplette Kartenflaeche
einschliesslich ihrer Bedienelemente blieb schwarz. Der Tilezugriff war dabei
extern erfolgreich; das Fehlerbild liegt vor der Tile-Darstellung. EFB 0.3.1
belegte auf einem System mit funktionierender 3D-Ausgabe, dass App, View-Switch
und Tracker-Poll weiterlaufen. Karten- und Statusflaeche blieben dennoch
unsichtbar. EFB 0.3.2 ersetzte deshalb die fuer Coherent verdaechtige
`inset`-Kurzform durch explizite Vollflaechen-Geometrie und startet Leaflet nur
bei messbarer Hostgroesse. Dadurch sind Karte, Flugzeugmarker und Zoom im
Simulator sichtbar und funktionsfaehig; die ueber Leaflet liegenden
Layer-/Follow-Bedienelemente nehmen jedoch noch keine Eingaben an. EFB 0.3.3
trennt diese Bedienelemente deshalb in eine eigene Pointer-Overlay-Ebene. Der
In-Sim-Test zeigt dort weiterhin: Leaflet-Zoom funktioniert, alle app-eigenen
Buttons bleiben ohne Wirkung. Die Analyse der mit SDK 1.7.2 ausgelieferten
`FSComponent`-Implementierung ergab, dass native JSX-`onClick`-Props nicht als
Listener registriert, sondern nur als HTML-Attribute gesetzt werden. EFB 0.3.4
bindet deshalb alle eigenen Buttons nach `onAfterRender` direkt ueber
`HTMLButtonElement.onclick`. Der In-Sim-Test von 0.3.4 bestaetigt Karte/Status,
Layerdialog, Layerauswahl und Follow als bedienbar. Dabei wurden drei
Darstellungsdetails fuer 0.3.5 festgelegt: 50 Prozent Basiskarten-Deckkraft bei
aktivem Aero-Overlay wie im Web-Kartentisch, dessen gelber 40-px-Flugzeugmarker
und eine rein darstellende Entprellung kurzzeitig leerer Missionssnapshots.
Bis zur Freigabe bleibt der Alpha-Kanal auf 0.2.0; es gibt keine automatische
Vorabinstallation des Karten-Prototyps.

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

## Produktziel: Kartentisch im EFB

Der Kartentisch mit seinen flugrelevanten Werkzeugen ist das zentrale
Produktziel der EFB-App. Hauptmenue und Pinnwand muessen nicht ins EFB
uebernommen werden. Das EFB soll langfristig die cockpitgerechte Karten- und
Missionsoberflaeche sein, waehrend die Web-App fuer Missionsauswahl, Planung und
umfangreiche Verwaltung verfuegbar bleibt.

Der bestehende `map.js`-Kartentisch wird nicht als Ganzes in die EFB-App
kopiert. Er ist stark an DOM, globale Web-App-Zustaende, `localStorage`,
Missionsruntime und externe Datenquellen gekoppelt. Wiederverwendbare Geometrie,
Klassifikation und Darstellungskonfiguration werden schrittweise in reine
Module extrahiert. Web-Kartentisch und EFB erhalten getrennte, fuer ihre
Oberflaeche passende Renderer auf denselben Vertraegen.

### Geplante Kartenfunktionen

- Flugzeugposition, Kurs, Track, Hoehe, Geschwindigkeit und Auto-Follow
- aktuelle Route, Legs, Wegpunkte, Direktlinie und Fortschritt
- Missionsziele, Suchgebiete, Survey-Muster, Korridore und Szenenhinweise
- Basiskarten und ausgewaehlte Luftfahrt-Overlays
- Flugplaetze, Navaids, Luftraeume, AIP-Verweise und relevante Detailkarten
- Wetter, Wind, Radar, VFR-Index und spaeter Terrain-Avoid
- Messen, Zeichnen, Markierungen und touchgerechte Kartenwerkzeuge
- Hoehenprofil, Leg-Informationen und kompakte Flug-/Missionsstatusanzeige
- optionale Cockpitwerkzeuge wie Stoppuhr, Rechner und E6B

### Karten-Verantwortungsgrenzen

- Das EFB rendert Karte, Marker und lokale UI-Zustaende wie Zoom, Follow,
  Layerauswahl, Messung und nicht missionskritische Zeichnungen.
- Der Tracker liefert hochfrequente Flug- und Traffic-Daten, Route,
  Missionsgeometrie, abgeleitete Warnungen und spaeter gecachte Datenprodukte.
- Web-App beziehungsweise Worker bleiben zunaechst Quelle fuer Planung,
  Wetter-, AIP-, OpenAIP-, GAFOR- und Hindernisdaten. Der Tracker stellt diese
  schrittweise ueber kontrollierte lokale Endpunkte bereit, damit das EFB nicht
  von vielen externen CORS-/CSP- und Authentifizierungswegen abhaengt.
- Externe Karten- und Overlayquellen werden vor Uebernahme einzeln auf
  Nutzungslizenz, Attribution, CORS, Canvas-Kompatibilitaet und Cache-Regeln
  geprueft. Kartenkacheln werden nicht ungeprueft gespiegelt oder offline
  gespeichert.

### Karten-Ausbaustufen

1. `K0 Map Shell`: lokal gebuendeltes Leaflet, eine Basiskarte, Flugzeugmarker,
   Pan/Zoom, Auto-Follow und robuste Touch-/Orientation-Tests.
2. `K1 Flight Map`: Route, Legs, Wegpunkte, Fortschritt, Direktlinie, Messen und
   grundlegende Flugdatentafeln.
3. `K2 Mission Map`: Missionsziele und -geometrie aus `mission.snapshot.v2`
   beziehungsweise einem getrennten `map.snapshot.v1`; weiterhin read-only.
4. `K3 Aviation Layers`: Flugplaetze, Navaids, Luftraeume, Wetter und
   AIP-Verweise ueber klar versionierte Datenadapter.
5. `K4 Advanced Tools`: Zeichnen, Hoehenprofil, Traffic, VFR-Index,
   Terrain-Avoid und weitere rechenintensive Layer nach Performance- und
   Quellenpruefung.

Ein erster Karten-Prototyp benoetigt noch keine Tracker-Autoritaet ueber den
Missionskern. `flight.snapshot.v1` reicht fuer `K0`; Mission Snapshot v2 und der
spaetere Missionskern erweitern dieselbe Karte danach um Missionsinhalt und
validierte Aktionen.

Fuer den 0.3.0-Prototyp sind die beschriftete OpenTopoMap und das
VFR-/Aero-Overlay als Default festgelegt. Alternative Basiskarten sowie DFS-,
FAA- und DWD-Overlays sind opt-in und werden erst nach Auswahl angefordert. Bei
direkten Online-Tile-Anfragen sehen die jeweiligen Anbieter technisch bedingt
IP-Adresse, Zeitpunkt, Zoomstufe und Kachelkoordinaten, jedoch keine Pilot-,
Missions- oder Tracker-Zugangsdaten. Die Auswahl bleibt lokal gespeichert; ein
eigener Offline-Cache ist nicht Teil von K0.

## Roadmap

### E0 - Read-only EFB stabilisieren

Status: in Alpha-Test

Testergebnis 2026-08-08: EFB 0.2.0 laeuft auf dem primaeren Testsystem sowohl
am physischen Cockpit-EFB als auch im 2D-Panel ohne Orientation-Flapping.
Tracker v324, Flugtelemetrie und der technische Missionssnapshot werden
angezeigt. Der Gegentest auf dem urspruenglich betroffenen Testsystem steht noch
aus. Eine alte beendete Mission kann in `mission.snapshot.v1` weiterhin als
letzter technischer Zustand erscheinen; Snapshot v2 muss aktive und letzte
Mission eindeutig trennen.

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

Status: erster Authority-/Resume-Unterbau implementiert, Alpha-Test ausstehend

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

#### E1a - Persistenter Mission-Run und Geräteuebergabe (Tracker v325)

Der erste v2-Unterbau loest den bisherigen Split-Brain-Fall, ohne die gesamte
fachliche State-Machine bereits in den Tracker zu kopieren:

- Der Tracker persistiert genau einen `activeRun` in
  `mission-authority-v1.json`. Der Run enthaelt `missionId`, `runId`,
  `ownerClientId`, Revision, Phase, Resume-Bundle und ein begrenztes
  Effektjournal.
- `mission.authority.v1` und `mission.snapshot.v2` werden nur im neuen
  Relay-Hello angeboten. Fehlt die Capability, verwendet die Web-App weiterhin
  unveraendert den v320-Vertrag.
- Ein Missionsstart muss zuerst `mission_authority_acquire` erfolgreich
  abschliessen. Ein anderer Missionslauf erhaelt `conflict`; der abgelehnte
  Befehl darf weder Status noch Simulatorszene veraendern.
- Eine fremde App loescht den Tracker-Stand nie mehr automatisch. Sie zeigt den
  aktiven Tracker-Run an und kann nach ausdruecklicher Bestaetigung Snapshot,
  Owner und Runtime uebernehmen.
- Die Bindung verwendet eine zufaellige, lokal persistierte Client-ID,
  `runId` und Revision. Es wird kein zusaetzliches Sitzungsgeheimnis ueber das
  externe Relay transportiert; Sync-ID/PIN bleiben dessen bestehende
  Zugangskontrolle.
- Alte Web-Clients koennen bei leerem Tracker weiterhin implizit einen
  Legacy-Run starten. Solange dieser Legacy-Run aktiv ist, funktionieren ihre
  bisherigen Befehle und ihr terminales Lifecycle-Event. Ein alter Client darf
  aber keinen bereits von einem versionierten Client gehaltenen Run mutieren.
- Fuer einen impliziten `legacy-client`-Run ohne ersten Resume-Snapshot gibt es
  einen bestaetigten Recovery-Pfad: Nur eine lokal exakt passende Missions-ID
  darf den Run uebernehmen und muss sofort einen vollstaendigen, vom Tracker
  bestaetigten Resume-v2-Snapshot setzen. Fremde Missionen und fremde
  versionierte Owner bleiben gesperrt.

Das Resume-Bundle verwendet `ga.mission-resume.v2`. Primaeradapter sind
`apt`, `poi`, `survey_pattern`, `poi_chain`, `training`, `bush_pickup` und
`sar_heli`. Cargo, Behoerdenkontrolle, Flugschreiber und Passenger-Comfort
werden als zusaetzliche Facetten restauriert. Damit teilen sich einfache A-B-
Missionen und komplexe POI-/Pattern-Missionen denselben Transportvertrag, ohne
ihre fachlich verschiedenen Fortschrittsobjekte zu vermischen.

Freigabesemantik:

- Normaler Abschluss: Authority erst nach Debrief/Cleanup als `completed`
  freigeben.
- Mission Reset: Run als `reset` freigeben, Runtime/Szenen bereinigen, das
  vorhandene Briefing lokal wieder auf `planned` setzen.
- Dispatch-Clear: Run als `cleared` freigeben und danach Briefing entfernen.
- Neue Mission oder Direct-to: laufenden Run nur nach ausdruecklicher
  Abbruchbestaetigung als `aborted` freigeben.
- App schliessen, Reload oder Tracker-Neustart: keine Freigabe. Der persistente
  Run bleibt die Missionswahrheit.

Das Effektjournal dedupliziert wiederholte Szenen-, Boarding-, Deboarding- und
Smoke-Commands anhand stabiler `commandId` und speichert ausschliesslich eine
kleine technische ACK-Zusammenfassung. Es ist die Grundlage fuer sichere
Retries, ersetzt aber noch nicht den spaeteren vollstaendigen, headless
Missionsausfuehrungskern.

Mehrgeraetetest 2026-08-10, erster v325-Stand: Der Tracker-Run und der explizite
Handoff funktionierten, der uebernommene Runtime-Snapshot wurde jedoch vom
lokalen Fresh-Start-Schutz als `state:fresh-start` verworfen. Dadurch schrieb
das neue Geraet seinen lokalen `prepare`-/Boardingstand zurueck, obwohl der
Tracker bereits `boarded` oder `active` gespeichert hatte. Zusaetzlich
verarbeiteten beide Browser die ueber das Relay ausgestrahlten ACKs des jeweils
anderen Clients. Web-Cache v1614 behebt beides: `authorityConfirmed` wird bis
zum Runtime-Restore durchgereicht, fremde Mission-ACKs werden per lokaler
`commandId` ignoriert und der vorherige Owner wird bei einer neueren
Owner-Revision zum schreibgeschuetzten Beobachter demotiert. Semantische
Start-/Runtime-Phasenwechsel werden sofort zum Tracker geschrieben; der
periodische 10-Sekunden-Pfad bleibt nur fuer nichtkritische Zwischenstaende.

Folgetest 2026-08-10, Web-Cache v1615: Traf ein persistenter Tracker-Run auf
einen Browser ohne lokalen Authority-Eintrag, griff der Revisionsvergleich auf
`local.revision` statt `local?.revision` zu. Der Fehler brach jedes kombinierte
GPS-/Authority-Paket vor dem LIVE-Update ab; sichtbar blieb nur `LINK`, obwohl
Tracker und Relay verbunden waren. Web-Cache v1616 macht den Vergleich
nullsicher und kapselt Authority-Projektionen zusaetzlich so, dass ein kuenftiger
Authority-Fehler niemals die eigentliche Flugtelemetrie verwirft. Der
Cloud-Upload protokolliert ausserdem Roh-, Kompakt- und Komponentengroessen fuer
die Diagnose; eine Aenderung des serverseitigen Profil-Limits ist davon
getrennt.

Nach ausdruecklicher Freigabe wurde das bestehende Profil-Limit anschliessend
von 100 auf 256 KiB erweitert. Das bleibt weit unter den Cloudflare-Grenzen,
fuegt keine Datenfelder und keinen Dienst hinzu und veraendert weder die Anzahl
der Worker-Requests noch der KV-Schreibvorgaenge. Stable-Clients mit kleineren
Profilen bleiben kompatibel; die Alpha-App behaelt ihre stufenweise
Kompaktierung und nutzt nur den groesseren Sicherheitsabstand.

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

- [x] EFB 0.2.0 am physischen EFB und im 2D-Panel des primaeren Testsystems
      ohne Orientation-Flapping getestet.
- [ ] EFB 0.2.0 auf dem urspruenglich betroffenen Testsystem gegenpruefen.
- [ ] EFB 0.2.0 ohne/mit Tracker sowie ohne/mit aktiver Mission testen.
- [ ] Testergebnis und betroffenen EFB-Modus in dieser Datei dokumentieren.
- [x] `K0 Map Shell` als isolierten EFB-0.3.0-Prototyp implementieren:
      OpenTopo mit Beschriftung, VFR-/Aero-Defaultoverlay, Flugzeugmarker,
      Pan/Zoom, Auto-Follow, Layerauswahl und Offline-/Fehlerzustand.
- [x] EFB 0.3.0 mit dem offiziellen Windows-SDK 1.7.2 bauen; der erste
      In-Sim-Test zeigte nur Header/Trackerstatus und eine schwarze
      Kartenflaeche. 0.3.0 wird nicht ausgeliefert.
- [x] EFB 0.3.1 mit eindeutigen View-Klassen und Initialisierung nach
      `onAfterRender` bauen und testen. View-Switch und Tracker-Recovery laufen,
      Karten- und Statusflaeche bleiben jedoch unsichtbar; 0.3.1 wird nicht
      ausgeliefert.
- [x] EFB 0.3.2 mit expliziter Vollflaechen-Geometrie und Layoutgroessen-Gate
      bauen und testen. Karte, Tiles, Flugzeugmarker und Zoom funktionieren;
      Layer-/Follow-Bedienelemente reagieren noch nicht. 0.3.2 wird nicht
      ausgeliefert.
- [x] EFB 0.3.3 mit getrennter Pointer-Overlay-Ebene bauen und testen. Leaflet-
      Zoom funktioniert weiterhin, aber Layer, Follow und Karte/Status bleiben
      ohne Wirkung; 0.3.3 wird nicht ausgeliefert.
- [x] EFB 0.3.4 mit echten DOM-`onclick`-Handlern bauen und testen. Karte/Status,
      Layerdialog, Layerauswahl und Follow funktionieren neben Pan und Zoom.
- [ ] EFB 0.3.5 mit 50-Prozent-Basiskarten-Deckkraft beim Aero-Overlay, dem
      gelben 40-px-Web-Flugzeugmarker und entprellter Missionsanzeige durchs
      offizielle SDK bauen und im 2D-/physischen EFB testen.
- [ ] Karten-Datenvertrag fuer Route, Missionsgeometrie und Layer-Metadaten
      entwerfen, ohne den bestehenden Tracker-Mindeststand global anzuheben.
- [x] Authority-/Resume-Untervertrag fuer `mission.snapshot.v2` mit
      Einzel-Run, Owner, Revision, Effektjournal und Missionstyp-Adaptern
      implementieren; Alpha-In-Sim-/Mehrgeraetetest steht aus.
- [x] Web-seitigen Resume-Snapshot zum Tracker transportieren und persistent
      speichern; vollstaendige fachliche Tracker-Runtime bleibt eine spaetere
      Ausbaustufe.
- [ ] Tracker v325 gegen zwei Browsergeraete testen: Konflikt ohne Flackern,
      expliziter Handoff, Reload, Tracker-Neustart, Reset, Clear, Direct-to und
      normaler Abschluss.
- [ ] Web-Cache v1614 gegen den konkreten Boarding-Handoff erneut testen:
      `boarded` und `active` muessen vom Tracker gewinnen; auf dem alten Geraet
      duerfen keine fremden Boarding-/Szenen-ACKs den lokalen Zustand aendern.
- [ ] Web-Cache v1616 mit einem bereits persistenten Tracker-Run und einem
      Browser ohne lokalen Authority-Eintrag testen: Anzeige muss von LINK auf
      LIVE wechseln und danach den Handoff anbieten.
- [ ] Web-Cache v1618 mit dem realen `legacy-client`-Run ohne Snapshot testen:
      ein Geraet mit derselben Mission setzt nach Bestaetigung den Rettungsstand;
      das zweite Geraet bezieht danach den normalen Tracker-Snapshot. Eine
      andere lokale Mission muss abgewiesen werden.
- [ ] EFB-Mission-Control zunaechst ohne Schreibaktionen darstellen.
- [ ] Schnittgrenze fuer `mission-execution-core.js` anhand der vorhandenen
      Runtime-, Cargo- und Compliance-Tests festlegen.
- [ ] Tracker-Shadow-Replay implementieren, bevor Autoritaet verschoben wird.

## Entscheidungsprotokoll

- 2026-08-10: Der Relay-Pfad verteilt Tracker-ACKs an mehrere verbundene
  Browser. Ab Web-Cache v1614 verarbeitet ein Browser missionsbezogene ACKs nur
  fuer selbst gesendete `commandId`. Ein Tracker-bestaetigter Handoff darf den
  lokalen Fresh-Start-Guard uebersteuern; ein abgeloester Owner stoppt seine
  Snapshot-Schreibversuche und bleibt Beobachter.
- 2026-08-10: Ein implizit angelegter `legacy-client`-Run ohne Resume-Snapshot
  darf nicht alle Geraete in einen Uebergabe-Deadlock bringen. Ab Web-Cache
  v1618 kann eine lokal identische Mission nach gesonderter Bestaetigung den
  Run uebernehmen und als ersten vollstaendigen Tracker-Snapshot setzen. Andere
  Missions-IDs und fremde versionierte Owner bleiben unveraendert gesperrt.
- 2026-08-10: Authority-Projektionen sind ein Zusatzkanal innerhalb eines
  Telemetriepakets. Fehler in diesem Zusatzkanal duerfen Position, Flugzustand
  und LIVE-Anzeige nicht mehr verwerfen; der Revisionsvergleich akzeptiert
  explizit einen noch nicht vorhandenen lokalen Authority-State.
- 2026-08-10: Das bestehende Cloud-Profil darf nach ausdruecklicher Freigabe bis
  256 KiB gross sein. Client und Worker verwenden dieselbe Grenze; die
  Sync-Frequenz und damit die Free-Kontingente nach Request-/Write-Anzahl bleiben
  unveraendert.
- 2026-08-10: Tracker v325 fuehrt vor der vollstaendigen Headless-Migration
  einen persistenten Einzel-Run als Missionswahrheit ein. Fremde Web-Apps
  beobachten diesen Run und koennen ihn nur ueber einen expliziten Handoff
  uebernehmen; die bisherige automatische Mismatch-Bereinigung entfaellt.
  Resume v2 deckt APT, POI, Survey, POI-Ketten, Training, Bush/Pickup und
  SAR-Heli sowie Cargo-/Compliance-Facetten ab. Reset, Clear, Abschluss, neue
  Mission und Direct-to besitzen getrennte Freigabegruende.
- 2026-08-10: Ab Tracker Desktop 1.6.0 aktualisiert sich auch die installierte
  Bootstrap-/Desktop-App ueber den getrennten Desktop-Kanal. Downloads werden
  per SHA-512-Metadaten geprueft, koennen automatisch vorbereitet werden und
  werden erst beim Beenden oder nach einem bestaetigten Neustart installiert.
  Aeltere Desktop-Versionen benoetigen einmalig den manuellen Wechsel auf 1.6.0.
- 2026-08-10: Der Tracker-Desktop-Manager ordnet Tracker, Homebase Assets, EFB
  und Bridge als standardmaessig geschlossene Module unter einer kompakten
  Status-/Startleiste. Updateentscheidungen sind pro Modul getrennt. Bereits
  installierte EFB-Pakete bieten neue Versionen per Dialog an oder werden bei
  aktivierter EFB-Automatik bei geschlossenem MSFS ohne Dialog aktualisiert;
  Erstinstallation, Reparatur und Deinstallation bleiben manuell.
- 2026-08-07: EFB wird als eigenes, vom Tracker verwaltetes Community-Package
  mit getrennten Alpha-/Stable-Kanaelen ausgeliefert.
- 2026-08-07: Erste Transportstufe bleibt HTTP-Loopback und vollstaendig
  read-only; EFB 0.2.0 nutzt `mission.snapshot.v1`.
- 2026-08-08: Langfristige Missionsautoritaet soll im Tracker liegen. Der
  Umbau erfolgt ueber Snapshot v2, reinen gemeinsamen Kern, Shadow-Modus und
  recipe-weise Autoritaetsuebergabe; kein direkter Umzug der Browser-Runtime.
- 2026-08-08: Bord-/Behoerdenkontrolle wird als untergeordneter Missionsworkflow
  geplant und erst nach gemeinsamer Kernextraktion schreibend ins EFB gebracht.
- 2026-08-08: Der Kartentisch mit flug- und missionsrelevanten Werkzeugen wird
  zum zentralen EFB-Produktziel. Hauptmenue und Pinnwand bleiben ausserhalb des
  EFB-Scopes. Die Umsetzung erfolgt als eigener EFB-Kartenclient auf gemeinsam
  extrahierten Modulen und versionierten Tracker-Vertraegen.
- 2026-08-08: `K0 Map Shell` wird als EFB 0.3.0 vorbereitet. OpenTopo mit Text
  und das VFR-/Aero-Overlay sind Default; weitere Onlinequellen bleiben opt-in.
  Der bestehende 0.2.0-Alpha-Kanal bleibt bis zum SDK- und In-Sim-Test aktiv.
- 2026-08-10: Der offizielle 0.3.0-SDK-Build war formal korrekt, zeigte In-Sim
  aber nur Header und Trackerstatus vor schwarzem Inhalt. 0.3.0 wird verworfen.
  0.3.1 trennt Karten-/Statuscontainer namentlich von Hoststyles und startet
  Leaflet garantiert nach `onAfterRender`; Initialisierungsfehler werden im UI
  und im EFB-Debugger sichtbar.
- 2026-08-10: 0.3.1 zeigt dasselbe schwarze Inhaltsfeld auch auf einem System
  mit funktionierender 3D-Ausgabe. Der View-Switch reagiert und ein beendeter
  Tracker aendert den Status weiterhin; die App ist daher nicht eingefroren.
  0.3.2 ersetzt `inset` in den Vollflaechen durch explizite Breite, Hoehe,
  `top` und `left` und prueft die DOM-Groesse vor der Leaflet-Initialisierung.
- 2026-08-10: 0.3.2 macht OpenTopo, VFR-/Aero-Overlay, Flugzeugmarker und Zoom
  im Simulator sichtbar und funktionsfaehig. Die schwebenden Layer-/Follow-
  Buttons reagieren noch nicht. 0.3.3 verschiebt die Karten-UI deshalb aus der
  Leaflet-Flaeche in eine eigene durchlaessige Pointer-Overlay-Ebene, deren
  Buttons Eingaben explizit annehmen.
- 2026-08-10: Auch mit der getrennten Pointer-Overlay-Ebene von 0.3.3 reagieren
  alle app-eigenen Buttons nicht, waehrend Leaflet-Zoom Eingaben verarbeitet.
  Die exakte SDK-Abhaengigkeit `@microsoft/msfs-sdk` 2.1.1 setzt unbekannte
  JSX-Props wie `onClick` lediglich als HTML-Attribute; sie registriert daraus
  keinen Listener. 0.3.4 entfernt diese JSX-Props und bindet die nativen Buttons
  nach `onAfterRender` ueber ihre DOM-`onclick`-Eigenschaft. Dieses Verfahren
  entspricht der internen Ereignisbindung des offiziellen EFB-`Button`.
- 2026-08-10: Der 0.3.4-In-Sim-Test bestaetigt alle app-eigenen Buttons als
  funktionsfaehig. 0.3.5 gleicht Aero-Basiskarten-Deckkraft und Flugzeugmarker
  an den Web-Kartentisch an. Wiederholt beobachtete `available:false`-Luecken
  zwischen gueltigen `mission.snapshot.v1`-Antworten werden nur in der EFB-
  Darstellung entprellt: bestaetigte Wahrheit bleibt maximal 12 Sekunden
  sichtbar, waehrend neue und terminale Snapshots sofort gewinnen. Diese
  Schutzschicht setzt selbst keine Missionsphase und verschiebt keine
  Missionsautoritaet.
