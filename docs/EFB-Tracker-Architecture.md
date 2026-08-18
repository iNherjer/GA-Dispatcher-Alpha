# EFB-/Toolbar-Panel-/Tracker-Architektur

Der chatuebergreifende Umsetzungsstand, die priorisierte Roadmap und der Plan
zur Migration des Missionskerns stehen in `docs/EFB-Development-Plan.md`.
Diese Datei beschreibt die dauerhaften Architekturgrenzen.

## Zielbild

Der Windows-Tracker wird schrittweise zur lokalen Ausfuehrungs- und
Rechenebene. Das MSFS-2024-EFB und das globale Toolbar-Panel bleiben schlanke
Bedienoberflaechen derselben tracker-gehosteten Cockpit-UI. Damit liegen
SimConnect, hochfrequente Telemetrie, Szenenbefehle und spaeter ausgelagerte
Berechnungen in dem Prozess, der auf dem PC ohnehin laufen muss.

Die laufende Web-App und der produktive Tracker werden dabei nicht auf einmal
ersetzt. Neue Funktionen werden additiv hinter einem versionierten
Capability-Handshake eingefuehrt. Ein neuer Tracker muss den bisherigen
Web-/Relay-Vertrag weiterhin beherrschen, solange Stable ihn noch verwendet.

## Verantwortungsgrenzen

### Tracker

- SimConnect-Verbindung und hochfrequente Sim-Daten
- Szenen- und SimObject-Ausfuehrung
- lokale Validierung und rechenintensive Ableitungen
- spaeter: transportneutrale Missions-Snapshots und Befehlsausfuehrung
- Abwaertskompatibilitaet zum bestehenden Web-/Relay-Protokoll

### EFB und Toolbar-Panel

- Darstellung, Navigation und direkte Benutzerinteraktion
- Anfordern von Snapshots statt eigener Polling-/Rechenloops
- Senden klarer Benutzerabsichten statt direkter SimConnect-Details
- sichtbarer Fallback, wenn eine Tracker-Capability fehlt
- identische fachliche Views und Actions; nur Host-Lifecycle, Fenster-Chrome,
  Input/Fokus und Offline-Shell unterscheiden sich

### Bestehende Web-App

- bleibt waehrend des Umbaus die Referenz fuer Missionssemantik und Stable
- nutzt den bisherigen Tracker-Vertrag unveraendert weiter
- kann einzelne neue Protokollfunktionen erst nach Capability-Pruefung verwenden

Persoenliche Tracker-/Homebase-Daten bleiben zunaechst kanalunabhaengig. Deshalb
duerfen Alpha-Versionen keine destruktive Datenmigration und keine fuer Stable
unlesbare Pflichtfelder einfuehren. Falls spaeter ein inkompatibles
Persistenzschema notwendig wird, muss vor dessen Einfuehrung auch der Datenpfad
kanalspezifisch versioniert und eine explizite Import-/Rollback-Strategie gebaut
werden.

## Transportneutrales Protokoll

`ga-tracker-client/tracker-efb-protocol-core.js` definiert nur Nachrichten,
Versionen und Capability-Aushandlung. Es bindet sich bewusst weder an WebSocket
noch an MSFS CommBus. Dadurch koennen der heutige Relay-Pfad sowie kuenftige
EFB- und Toolbar-Panel-Transporte dieselben Nachrichten verwenden.

## Gemeinsamer Cockpit-View

Der tracker-gehostete Kartentisch unter `/efb/v1/` ist die gemeinsame
Funktionsoberflaeche fuer EFB und Toolbar-Panel. Ein expliziter Hostkontext
`efb|toolbar` darf ausschliesslich Layout, Input-/Fokusbehandlung,
Fenster-Lifecycle, Close-Nachricht und Offline-Darstellung variieren. Karte,
Mission Control, Verlade-Manager, Pax-Interaktion, Voice-Status und Werkzeuge
verwenden dieselben Komponenten und versionierten Snapshots.

Jedes sichtbare Fenster besitzt einen eigenen zufaelligen Channel und eine
eigene kurzlebige lokale Sitzung. Der Hosttyp und Channel dienen Diagnose,
Antwort-Routing und Audio-Playback-Koordination; sie begruenden keine
Missionsautoritaet. Zwei gleichzeitig geoeffnete Clients duerfen dieselbe
Mission beobachten, aber nur Intents gegen die eine autoritative Revision
senden.

Der lokale v363-Kandidat setzt diese Sitzungsgrenze erstmals konkret um.
Web-App und tracker-gehosteter Cockpit-View registrieren `web|efb|toolbar` mit
einer stabilen Fenster-`clientId`; der Tracker gibt eine zufaellige
`sessionId` und ein separates Token mit 45 Sekunden Lebensdauer zurueck.
Heartbeats verlaengern die Sitzung und projizieren unter anderem, ob dieses
Fenster Audio wiedergeben darf. Token werden weder im oeffentlichen
Sessionstatus noch in Logs oder Snapshots ausgegeben. Abgelaufene, ersetzte
oder explizit geschlossene Sitzungen koennen keine Cockpit-Intents senden.

### Authority, Owner und Bedienfenster sind getrennte Ebenen

Der heutige `ownerClientId` bezeichnet waehrend der Migration den Web-Client,
der den vollstaendigen Resume-Snapshot schreibt. Er bezeichnet weder das
sichtbare Fenster noch einen allgemeinen UI-Master. Fuer den Zielbetrieb gelten
drei getrennte Ebenen:

1. `executionAuthority`: `web` im Legacy-/Migrationsmodus oder `tracker`, sobald
   der gemeinsame Execution-Core das Rezept autoritativ ausfuehrt.
2. `runtimeOwnerClientId`: nur im Web-Authority-Modus der Browser, der
   Resume-Snapshots schreiben darf. EFB und Toolbar-Panel uebernehmen diesen
   Owner nicht.
3. `controllerSession`: jede geoeffnete App-, EFB- oder Panel-Ansicht mit
   eigener kurzlebiger Session. Controller duerfen parallel existieren und
   senden Intents mit `commandId` und erwarteter Revision.

Es gibt keinen dauerhaften „aktiven UI-Master“. Der erste gueltige Intent auf
der aktuellen Revision gewinnt. Ein gleichzeitig gesendeter veralteter Intent
wird ohne Seiteneffekt mit `mission_revision_conflict` und dem aktuellen
Snapshot beantwortet. Laenger laufende fachliche Effekte wie Boarding,
Signatur, Payload-Anwendung, Deboarding, Close oder Voice tragen eine
autoritative `operationId` beziehungsweise `effectId`; waehrenddessen zeigen
alle Clients denselben Busy-Zustand. Das ist eine Operationssperre, keine
Uebergabe der Mission an ein Fenster.

### Wann ein Uebergabebanner erscheint

Zwischen EFB und Toolbar-Panel erscheint kein „Mission hierher uebernehmen“-
Banner. Beide haengen am selben lokalen Tracker, sehen denselben Snapshot und
koennen nach Freigabe der Intent-Capability synchron als Controller arbeiten.

Der bestehende Uebergabedialog bleibt ausschliesslich fuer einen echten
Runtime-Owner-Wechsel im Web-Authority-Modus erhalten, beispielsweise von
einem anderen Browser oder Geraet. Solange dieser Modus aktiv ist, zeigen EFB
und Panel den Zustand lesend mit dem Hinweis „Mission wird von der App
ausgefuehrt“; sie duerfen den Browser-Owner nicht selbst uebernehmen. Nach der
recipe-weisen Tracker-Authority entfaellt auch dieser Hinweis fuer das
unterstuetzte Rezept.

Ein Revisionskonflikt, ein laufender Effekt oder ein kurz getrennter Client ist
kein Owner-Konflikt. In diesen Faellen aktualisiert der Client den Snapshot und
zeigt eine kurze Statusmeldung statt eines Uebergabebanners.

Die Toolbar-Shell wird als eigenes Community-Package entwickelt und bleibt bis
zum positiven SDK-/In-Sim-Nachweis vom Stable-EFB-Paket getrennt. Der erste
Panel-Spike ist read-only. Ein erfolgreicher iframe-Start beweist noch nicht
die Freigabe von Mission-, Cargo-, Pax- oder Voice-Commands.

## Schreibende Cockpit-Aktionen

Schreibende EFB-/Panel-Funktionen werden als fachliche Intents modelliert. Der
Tracker prueft Capability, Sitzung, `missionId`, `runId`, erwartete Revision,
`commandId`, Schema, Rate-Limit und `allowedActions`, bevor Core-Event oder
Effekt erzeugt werden. Clients duerfen insbesondere keine Runtime-Phase,
Manifestbewertung, Payloadzahl, Voice-Gate oder SimConnect-Variable frei
setzen.

Start, Pickup, Unload und Abschluss benutzen die unveraenderten Missions- und
Manifestgates. `request_close` ist nur im autoritativen Endzustand erlaubt;
`abort_mission` und `reset_mission` sind getrennte, ausdruecklich bestaetigte
Aktionen. Pax-Buttons senden semantische Interaktionen wie Status-,
Orientierungs-, Wohlbefindens-, Wetter-, Ladungs- oder Fundanfrage. Der
Missionskern entscheidet, welche davon im aktuellen Rezept erlaubt ist.

Voice ist ein abgeleiteter Effekt. Der Tracker fuehrt eine deduplizierte
Voice-/Effekt-Queue und koordiniert pro Run genau einen Playback-Owner, damit
Web-App, EFB und Toolbar-Panel dieselbe Ansage nicht parallel ausgeben.
Sprecher, Text, Queue- und Playbackstatus duerfen projiziert werden; API-Keys
und Provider-Zugangsdaten bleiben ausserhalb der Cockpit-Clients. Eine spaete
TTS-Antwort nach Farewell-/End-Lock wird wie heute verworfen und darf keinen
Missionszustand fortschalten.

Ohne gueltiges `protocol.hello` wird ein Peer als `legacy` behandelt. Der neue
Tracker darf dann nur die bestehenden Telemetrie- und Command-Pfade voraussetzen.
Unbekannte neue Funktionen werden nicht stillschweigend verwendet.

Tracker ab v321 bettet dieses Hello ausschliesslich als zusaetzliches Feld
`trackerProtocolHello` in die bereits vorhandenen `gps`-Statuspakete ein. Typ,
Routing und bestehende Felder des Relay-Protokolls bleiben unveraendert. Alte
Web-Clients ignorieren das neue Feld; neue Clients koennen es validieren und
Capabilities aushandeln. Der erste Protokollstand meldete absichtlich nur die
beiden Legacy-Capabilities. Tracker v325 meldet additiv
`mission.authority.v1` und `mission.snapshot.v2`; alte Clients ignorieren diese
Felder weiterhin.

Tracker v323 ergaenzt daneben eine getrennte, zu diesem Stand read-only Loopback-Schnittstelle
auf `127.0.0.1:49880`. Sie liefert mit eigenem Hello ausschließlich
`tracker.status.v1` und `flight.snapshot.v1`. Dieser lokale Pfad funktioniert
auch dann, wenn das Cloud-Relay voruebergehend getrennt ist. Die Relay-Nachricht,
und die Missionslogik der bestehenden Web-App bleiben dabei unveraendert. Der
Alpha-Stand fordert v323 passend zum neuen Tracker-Release an; Beta und Stable
bleiben bis zur ausdruecklichen Promotion auf ihrem jeweils freigegebenen Stand.

Tracker v324 erweitert denselben lokalen GET-Pfad um
`mission.snapshot.v1` unter `/api/v1/mission`. Der Snapshot projiziert nur den
ohnehin bereits im Tracker vorhandenen technischen Missionsstatus:
Mission-ID, Lifecycle-State, Runtime-Phase und Anzahl der lokal aktiven
Simulatorszenen. Titel, Briefing, Route, Frachtinhalt und Zugangsdaten werden in
dieser Stufe weder ueber das externe Relay nachgeladen noch am Loopback-Endpunkt
ausgegeben. Das EFB 0.2.0 bleibt damit vollstaendig read-only; die bestehende
Web-Missionslogik und ihre Erfolgskriterien bleiben unveraendert.

Tracker v325 fuehrt neben dem weiterhin kompatiblen flachen
`mission.snapshot.v1` einen persistenten, einzelnen Missionslauf ein. Der
Tracker ist fuer die Auswahl des aktiven Runs, Owner-Wechsel, Revisionen,
Snapshot-Persistenz und die Zulassung missionsbezogener SimObject-Befehle die
Autoritaet. Die Web-App bleibt in dieser Zwischenstufe fachliche
Ausfuehrungsinstanz: Sie berechnet Phasen und Fortschritt und uebergibt dem
Tracker versionierte Resume-Bundles. Dadurch wird Split Brain verhindert,
bevor der reine Missionsausfuehrungskern vollstaendig headless im Tracker
laufen kann.

Die Web-App behandelt den Relay-Kanal als Broadcast-Transport: Authority-,
Lifecycle- und Szenen-ACKs werden deshalb nur verarbeitet, wenn ihre
`commandId` lokal gesendet wurde. Ein fremdes ACK darf weder Boarding, Manifest
noch Szenenstatus dieses Browsers veraendern. Meldet der Tracker fuer denselben
Run einen anderen Owner mit mindestens derselben Revision, verwirft der alte
Owner seine lokale Schreibberechtigung, stoppt ausstehende Snapshot-Updates und
bleibt Beobachter. Ein explizit bestaetigter Handoff darf dagegen den lokalen
Fresh-Start-Restore-Schutz uebersteuern und muss den Tracker-Snapshot vor dem
ersten eigenen Update vollstaendig anwenden.

Ein Legacy-Run kann durch einen alten Szenenbefehl bereits existieren, bevor
sein erster Resume-v2-Snapshot geschrieben wurde. Ein solcher
`mission_snapshot_request` antwortet mit `noop`. Dieser Zustand darf nicht zu
einer gegenseitigen Warteposition aller Browser fuehren: Liegt auf einem
Geraet lokal exakt dieselbe Missions-ID, kann der Benutzer diesen lokalen Stand
ausdruecklich als einmaligen Rettungsstand bestaetigen. Die App uebernimmt den
`legacy-client`-Run mit der zuletzt gelesenen Revision und schreibt unmittelbar
danach ein vollstaendiges Resume-Bundle per bestaetigtem
`mission_snapshot_update`. Erst nach dessen ACK gilt der Handoff als
abgeschlossen. Andere Missions-IDs und Runs eines fremden versionierten Owners
sind von diesem Recovery-Pfad ausgeschlossen.

Authority-Daten koennen gemeinsam mit einem gueltigen GPS-Paket eintreffen. Die
Web-App behandelt deren Projektion als isolierten Zusatzschritt: ein fehlender
lokaler Authority-State ist ein regulaerer Observer-Fall, und ein Fehler im
Authority-Abgleich darf die Position, den Flugzustand oder den Wechsel der
Anzeige von LINK auf LIVE nicht abbrechen.

Tracker v346 sendet kontinuierliche Telemetrie mit 2 Hz parallel an zwei
unabhaengige Relays. Cloudflare Durable Objects ist der Primaerpfad (`C`), der
vorhandene Render-Dienst bleibt der Fallback (`R`). Die Web-App haelt nur den
aktiven Empfangspfad offen. Schlaegt Cloudflare fehl, wechselt sie sofort zu
Render. Bleibt die Cloudflare-Verbindung zwar offen, aber Tracker-Heartbeat und
Telemetrie fehlen, prueft die App Render kurzzeitig und wechselt nur nach einem
echten Tracker-Paket. Auf Render prueft sie Cloudflare periodisch und kehrt
ebenfalls erst nach einem echten Tracker-Paket zum Primaerpfad zurueck. Dadurch
bleiben alte Render-only-Tracker kompatibel, ohne im regulaeren Cloudflare-
Betrieb Render-Egress zu erzeugen.

Tracker v349 fuehrt additiv `telemetry.hibernate.v1` ein. Nach fuenf Minuten
am Boden mit weniger als 5 kt oder nach fuenf Minuten durchgehender Pause
pausiert er die kontinuierlichen GPS- und Traffic-Pakete an beide Relays. Die
SimConnect-Abfrage, der lokale EFB-
Snapshot, Commands und ACKs bleiben aktiv; ein unkomprimierter Trackerstatus
meldet alle fuenf Sekunden Modus und Grund. Die MSFS-Nullposition nahe `(0,0)`,
die pausierte Menueposition nahe `(0,90)` oder ein expliziter `SimStop`
aktivieren Hibernate sofort. Das von MSFS dort gemeldete `Menu N` ist
nachweislich kein Erkennungssignal. Eine plausible
Position mit mindestens 5 kt oder ein nicht mehr gesetztes `SIM ON GROUND`
reaktiviert die 2-Hz-Telemetrie ohne Tracker-Neustart; ein Pause-Hibernate
endet beim Aufheben der Pause, sofern kein anderer Hibernate-Grund fortbesteht.
Die Web-App zeigt diesen
Zustand als `HIB` und behandelt den weiterlaufenden Status als gueltigen
Heartbeat, aber nicht als Flugtelemetrie.

Der reale v349-Lauf vom 14.08.2026 bestaetigt die erste Haelfte dieses
Vertrags: `ACTIVE -> HIB` trat nach 300 Sekunden Pause ein, waehrend beide
Relay-Sockets offen blieben. Szenen-, Homebase-, Mission-Authority-, Payload-
und Checklisten-Commands sowie ACKs und der lokale EFB-Pfad liefen im HIB
weiter. `HIB -> ACTIVE` und die anschliessende Vollstaendigkeit von Position,
Flugzustand, Traffic und Snapshots bleiben als eigener MSFS-Testpunkt offen.

Tracker v350 fuehrt additiv `telemetry.wake.v1` ein und macht damit explizit,
dass Hibernate nur den dauernden Relay-Datenstrom drosselt. Beide Relay-Sockets
und der Command-Dispatcher bleiben aktiv. Mission-, Authority-/Routen-,
Payload-/Cargo-, Szenen-, Homebase- und direkte Sim-Commands wecken einen
Boden- oder Pause-HIB vor der Verarbeitung und setzen Boden- und Pause-Timer
gemeinsam zurueck. Dasselbe gilt fuer einen einmaligen Wake, wenn die Web-App
in eine bereits hibernierende Session einsteigt. Der HIB-Status traegt dafuer
die letzte gueltige Position und den kompakten Boden-/Pause-Zustand; die App
kann Start- und Entfernungsbedingungen sofort bewerten und erhaelt danach
wieder normale 2-Hz-Pakete. `(0,90)`, `(0,0)`, SimStop und ungueltige Positionen
bleiben nicht weckbar. Beim Ende einer HIB-Regel werden beide Timer neu
gestartet, damit eine aufgehobene Pause nicht sofort durch einen alten
Bodenstillstands-Timer ersetzt wird. Routen- und Fortschrittsaenderungen laufen
als Authority-Snapshot trotz HIB zum Tracker und aktualisieren dadurch den
read-only Mission-View des lokalen EFB.

Tracker v351 schaerft diesen Wake-Vertrag fuer idempotente Homebase-Crew-
Synchronisationen. Der periodische Gruppenabruf der Web-App behaelt seine
letzte Szenensignatur und sendet nur bei geaendertem, positionsrelevantem
Crew-Inhalt. Der Tracker fuehrt unabhaengig davon die kanonische Signatur der
zuletzt fehlerfrei aufgebauten Crew-Szene. Ein identisches
`homebase_v1.crew.set` wird mit `status=noop` bestaetigt, ohne die Szene neu
aufzubauen und ohne die HIB-Timer zurueckzusetzen. Ein neuer oder nach einem
Fehler erneut anzuwendender Inhalt bleibt ein regulaerer Sim-relevanter
Command und weckt vor der Ausfuehrung. Damit sind automatische Zustandsabfragen
keine Benutzerinteraktion, waehrend echte Homebase-Aenderungen ihre Wake-
Semantik behalten.

Tracker v352 behandelt daneben reale Sim-/UI-Aktivitaet als Ende eines
Boden-/Pause-HIB. `Pause`/`Pause_EX1` mit aufgehobener Pause, `SimStart`,
`PositionChanged` und `FlightLoaded` wecken den HIB-Controller und starten
Boden- sowie Pause-Timer neu. Pause-SimVars loesen nach einer kurzen
Event-Uebergangsfrist ein eventuell haengengebliebenes Pause-Event-Flag ab.
Die Web-App fordert bei vertrauenswuerdiger Benutzeraktivitaet und bei
semantischen Routenaenderungen einen Wake an. Statuspakete bleiben dabei
read-only und erzeugen selbst keinen Wake; ihre letzte gueltige Position darf
aber als sichtbar gekennzeichneter, eingefrorener HIB-Marker dargestellt
werden. Nicht plausible `(0,90)`-/`(0,0)`-, SimStop- und ungueltige Zustaende
bleiben gegen App-Wake gesperrt.

Tracker v353 vereinheitlicht die sichtbaren Betriebszustaende ueber Web-App
und Desktop: `LIVE` bedeutet volle Relay-Telemetrie, `HIB` den weiterhin
befehlsfaehigen 5-Sekunden-Status, `LINK` einen laufenden Tracker beim Aufbau
oder Warten auf Telemetrie und `OFF` ausschliesslich einen beendeten Prozess
beziehungsweise eine endgueltig abgelehnte Sitzung. Die Relay-Anzeige bleibt
davon getrennt und nennt `C+R`, `C` oder `R`. Ein geplanter App-Netzwerkschlaf
und ein automatischer Reconnect verlieren den letzten bekannten HIB-Zustand
nicht mehr durch eine voreilige OFF-Anzeige.

Fuer `checklist.library.v1` ist der vollstaendige App-Snapshot innerhalb einer
laufenden Tracker-Sitzung die schreibende Autoritaet. Der direkte CHKIDX-/CHK-
Abruf ist ein Start-/Fallbackpfad und darf einen bereits akzeptierten
App-Snapshot weder nachtraeglich noch durch ein Race ueberschreiben.
Inhaltsgleiche Bibliotheken bleiben ohne Persistenz und Revisionswechsel
`noop`. Die Web-App vereinigt beim Start zunaechst Remote-Neuzugaenge und
neuere Remote-Eintraege und schreibt danach nur fehlende oder lokal neuere
Listen zurueck. Damit wird ein unvollstaendiger Cloud-Index repariert, ohne
einen fehlgeschlagenen Remote-Abruf blind zu ueberschreiben.

Homebase-Crew-Capabilities werden getrennt vom Tracker-/EFB-Hello ausgehandelt,
weil der SimConnect-Objektmanager beim fruehen Trackerstart noch fehlen kann.
Eine gueltige negative Capability-Antwort ist deshalb ein temporaerer Zustand,
aber kein Anlass fuer eine Request-/ACK-Rueckkopplung. Die Web-App wartet nach
einem Versuch mindestens 15 Sekunden. Statuspakete duerfen danach einen neuen
Versuch anstossen; ein neuer Relay-Verbindungs-Token setzt die Aushandlung
kontrolliert zurueck. Damit funktioniert der spaetere Capability-Gewinn auch
im HIB-Modus, ohne dessen 5-Sekunden-Status in eine schnelle Command-Schleife
zu verwandeln.

Der Cloudflare-Worker verwendet pro SHA-256-Pilot-ID-Raum ein SQLite-backed
Durable Object mit Hibernation-WebSockets. Die Pilot-ID steht nicht im
WebSocket-Pfad. `relayRole=tracker|viewer` begrenzt Tracker-Commands auf Tracker
und Telemetrie/ACKs auf Viewer. Kontinuierliche Pakete werden zusaetzlich ohne
Timer auf etwa 2 Hz begrenzt; seltene Traffic-Snapshots umgehen dieses Gate.
Befehle, ACKs und Heartbeats bleiben unverzoegert.

Render begrenzt kontinuierliche Tracker-Telemetrie weiterhin serverseitig auf
2 Hz. Da sein oeffentlicher WebSocket-Pfad `permessage-deflate` nicht bis zum
Client aushandelt, verwendet die Web-App dort additiv `gzip-base64-v1`: Nur ein
Browser, der diese Relay-Capability in seiner `join`-Nachricht anbietet, erhaelt
Telemetrie als `relay_compressed`-Huelle. Legacy-Clients, Tracker, Workbench,
Befehle, ACKs und Heartbeats behalten den bisherigen unkomprimierten Vertrag.

Der Relay-Vertrag kennt dafuer folgende additive Commands und ACKs:

- `mission_authority_acquire`
- `mission_authority_takeover`
- `mission_authority_release`
- `mission_snapshot_update`
- `mission_snapshot_request`

Missionsbezogene Szenen-, Smoke- und Lifecycle-Commands tragen bei aktivierter
Capability `missionId`, `runId`, `clientId` und die bekannte Revision. Der
Tracker validiert diese Huelle vor jeder Status- oder SimConnect-Mutation.
Abgelehnte oder veraltete Befehle erhalten den aktuellen oeffentlichen Run als
Konfliktantwort und haben keine Seiteneffekte.

Der lokale Missionsendpunkt bleibt read-only. `/api/v1/mission` liefert bei einem
aktiven Run weiterhin die bisherigen flachen Felder fuer EFB 0.2.x und daneben
den neuen Authority-Snapshot. Ohne aktiven Run wird keine alte beendete Mission
mehr als aktive Mission ausgegeben; `lastRun` bleibt im getrennten
Authority-Snapshot fuer Diagnosezwecke erhalten.

Tracker v326 fuegt dem Loopback-Vertrag die Capability `map.snapshot.v1` und
den GET-Endpunkt `/api/v1/map` hinzu. Die Projektion wird aus dem bereits
autoritativen `activeRun.resumeBundle` und der letzten Sim-Telemetrie gebildet
und enthaelt ausschliesslich:

- sanitierte Route, Legs und Wegpunkte,
- aktives Leg, Bearing, Distanz, Cross-Track und Routenfortschritt,
- Missionsziel und begrenzte POI-Kettengeometrie,
- ein Hoehenband, das ohne Terrainvertrag auf bekannte Planhoehen
  zurueckfaellt.

Story, Briefing, Passagierdetails, Cloud-Profil, PINs und Zugangsdaten sind kein
Teil dieses Vertrages. Fehlt Route oder Capability, bleibt die 0.3.x-Karte mit
Flugzeug, Layern, Pan/Zoom und Follow benutzbar. Ein aelteres EFB ignoriert die
neue Capability. Das EFB berechnet aus dem Snapshot keine Missionsphase und
sendet auf diesem Pfad weiterhin keine Befehle.

Der Kartenclient ist bewusst kein iframe der vollstaendigen Web-App. Tracker
v327 und EFB 0.4.2 liefern additiv eine eigens fuer diesen Zweck gebaute,
read-only Browseroberflaeche. `/efb/v1/` ist der Kartentisch-View;
`/efb/v1/probe/` bleibt der kleine Transport-/Eingabetest. Bei fehlender
Capability bleibt der SDK-eigene 0.4.1-Renderer aktiv.

Der Tracker-View verwendet den originalen Kartentisch-DOM-Abschnitt aus
`index.html`, die originale `styles.css`, `map-utility-tools.js`, Leaflet und
die vollstaendigen E6B-Assets. Das ist trotzdem keine zweite Vollversion der
Web-App: `map.js`, `profile.js`, Cloud-Sync, Missionsautoritaet,
Benutzergeheimnisse und die uebrige App-DOM bleiben draussen. Ein kleiner
Hostadapter rendert Flugzeug, Route, Missionsgeometrie, Navigation, Kompass und
Planprofil aus den versionierten Tracker-Snapshots. `map-shell-core.js` ist als
gemeinsamer Node-/Browser-Kern nutzbar. Voice bleibt ein eigener
Tracker-koordinierter Dienst und wird weder aus dem eingebetteten EFB-Dokument
noch aus der Toolbar-Shell heraus autoritativ gesteuert.

Tracker v328 und EFB 0.4.3 haerten ausschliesslich diese lokale Hostgrenze.
Der HTML-Einstieg enthaelt einen kleinen ES5-kompatiblen Inline-Bootstrap,
damit Schliessen und Fehlerdiagnose auch funktionieren, wenn Coherent eines
der grossen externen Skripte nicht ausfuehrt. Leaflet, `map-shell-core.js`,
Werkzeuge und Hostadapter werden danach in fester Reihenfolge geladen. Jede
iframe-Sitzung erhaelt einen zufaelligen Channel; Parent-Nachrichten werden
ueber `event.source` oder den passenden Channel angenommen.

Die Capability `efb.client-diagnostics.v1` erlaubt ausschliesslich begrenzte
technische Meldungen an `POST /api/v1/client-log`. Der Endpunkt ist wie die
Snapshots nur an Loopback gebunden, nimmt hoechstens 8 KiB pro Meldung und 120
Meldungen pro Minute an und entfernt Steuerzeichen. Er schreibt keine Daten in
Missions-, Cloud- oder SimConnect-Zustaende. Der fachliche EFB-Vertrag bleibt
deshalb read-only; der POST ist nur ein lokaler Debug-Rueckkanal.

Der lokale v363-Kandidat erweitert diese Grenze erstmals um den getrennten
Voice-Effektvertrag `voice.playback.v1`; Missions-, Cargo-, Pax- und
SimConnect-Endpunkte bleiben weiterhin read-only. Der Tracker-Desktop 1.6.3
speichert genau einen aktiven Gemini- oder OpenAI-Key mit Electron
`safeStorage` und damit unter Windows benutzergebunden per DPAPI. Nur der
Ciphertext liegt in LocalAppData. Der entschluesselte Key erreicht die Engine
einmal ueber ihre lokale `stdin`-Pipe und bleibt aus Prozessargumenten,
Umgebung, Tracker-Dateien, Logs, Hellos und Statusprojektionen heraus.

`POST /api/v1/voice/jobs` nimmt einen begrenzten Text-/Sprecherauftrag mit
stabiler `effectId` an. Dieselbe ID und derselbe Inhalt verwenden denselben
laufenden oder fertigen Provider-Job; abweichender Inhalt unter derselben ID
erhaelt `409 effect_id_conflict`. Status und Audio liegen getrennt unter
`GET /api/v1/voice/jobs/:effectId` und
`GET /api/v1/voice/jobs/:effectId/audio`. Gemini-Roh-PCM wird vor der Ausgabe
als WAV gekapselt. Der In-Memory-Cache ist begrenzt und enthaelt nie den Key.
`POST /api/v1/voice/playback/claim` vergibt eine zeitlich begrenzte Lease an
genau eine `clientId`; `release` gibt sie frei oder markiert den Effekt nach
erfolgreicher Wiedergabe als abgeschlossen. Der Web-Client versucht diesen
Pfad zuerst und faellt bei nicht konfiguriertem oder nicht erreichbarem Tracker
auf die bestehende Browser-TTS zurueck. Damit wird die heutige Voice-Runtime
nicht entfernt, bevor EFB und Toolbar den neuen Vertrag real In-Sim bestaetigt
haben.

`GET /api/v1/voice/playback/next` projiziert die aelteste fertige, noch nicht
abgeschlossene und nicht aktiv geleaste Ansage. Der gemeinsame Cockpit-Host
pollt diesen Endpunkt nur, wenn im Audio-Menue
`Audio auf diesem Geraet abspielen` aktiv ist. Danach beansprucht er dieselbe
Lease, streamt das Audio und markiert es erst nach `ended` als abgeschlossen.
Mehrere aktivierte Fenster duerfen parallel offen sein; die atomare
Tracker-Lease laesst trotzdem nur einen Gewinner zu. Beim Ausschalten stoppt
das Fenster seine lokale Wiedergabe, gibt eine offene Lease ohne
Abschlussmarker frei und bleibt fuer Zustand und Bedienmoeglichkeiten weiter
synchron. Browser-Warnungen, Demo-Clips, Pax-TTS und Audioeffekte respektieren
dieselbe lokale Praeferenz.

Parallel implementiert v363 `cockpit.session.v1` und den noch gesperrten
Intent-Gateway als Migrationsfundament. Die Allowlist, `commandId`,
`missionId`, `runId`, exakte `expectedRevision`, Tokenpruefung und idempotente
ACK-Wiederholung sind bereits automatisiert getestet. Solange
`executionAuthority=web` gilt, antwortet ein ansonsten gueltiger Intent mit
`423 mission_intents_read_only`, fuehrt garantiert keinen Effekt aus und
`mission.intent.v1` wird im Tracker-Hello nicht angeboten. Die bestehende
Browser-Missionslogik und `mission-authority-core.js` bleiben damit fuer diesen
Schnitt unveraendert aktiv.

Der lokale v364-Kandidat setzt davor die erste echte Rechengrenze fuer die
Missionsmigration. `mission-execution-core.js` ist derselbe reine UMD-Kern in
Browser und Node. Die Web-App projiziert ihren bestehenden Runtime-, Manifest-
und Compliance-Zustand additiv als `ga.mission-execution-shadow.v1` in das
Resume-v2-Bundle. Diese Projektion enthaelt keine Story, sichtbaren Cargo-/Pax-
Labels oder Zugangsdaten. Der produktive Ablauf bleibt vollstaendig in
`sync.js`, `mission-runtime-core.js`, `mission-cargo-core.js` und
`mission-compliance-core.js`; der neue Reducer wird in dieser Stufe noch nicht
als Execution-Authority verwendet.

`tracker-mission-shadow.js` verarbeitet nur einen vom Authority-Manager
erfolgreich akzeptierten Snapshot. Der Tracker erzeugt aus dessen gespeichertem
Resume-Bundle unabhaengig dieselbe Projektion und vergleicht Phase, Unterphase,
`allowedActions`, `blockingReasons`, Cargo, Workflows, Revision, deklarative
Effekte und State-Hash. Ein veraltetes `noop`, ein Owner-/Run-Konflikt oder ein
ungueltiges Bundle kann den Shadow-Zustand nicht fortschalten. Oeffentlich sind
nur `match`, `drift` oder `unavailable`, abweichende Feldnamen, Hashes und ein
gehashter Event-Trace. Der Vertrag fuehrt fest `sideEffects=false`; er ruft
keinen Scene-, Voice-, Cargo-, SimConnect- oder Close-Adapter auf. Alte Web-
Clients ohne `execution` bleiben als `unavailable` voll funktionsfaehig.
Der lokale Windows-Build v364 umfasst 48.249.734 Bytes mit SHA-256
`69f828c5d5006b1a157b890c777ad34654f62d1ae19855ac6dc85b4dad872825` und ist
nicht in einen Runtime-Kanal eingetragen.

Der lokale v365-Kandidat erweitert diese Grenze fuer normale APT-Laeufe um ein
persistentes Browser-Journal und das transportierte
`ga.mission-execution-bundle.v1`. Das Journal speichert ausschliesslich den
normalisierten Initialzustand, bis zu 160 normalisierte Ereignisse und die
letzte narrativfreie Projektion. Es wird aus bestehenden autoritativen
Snapshots gespeist und besitzt keine Hooks, die Runtime, Manifest, Szene,
Voice oder Simulator veraendern koennen. Wiederholte Snapshots bleiben
idempotent; fehlende Zwischenphasen werden durch die minimal notwendigen,
vom Reducer akzeptierten Vorbedingungen ergaenzt. Bei Reload und expliziter
Geraeteuebergabe wird dasselbe Bundle fortgesetzt; ein neuer geplanter Lauf
setzt auch bei gleicher `missionId` neu an.

Der Resume-v2-Snapshot traegt nun additiv `executionReplay` und die daraus
erzeugte `execution`-Huelle. Der Tracker berechnet die Huelle aus Initialzustand
und Ereignissen selbst und vergleicht Browser- gegen Tracker-Replay sowie den
Replay-Endzustand gegen die aktuelle Legacy-Projektion. Der Replay-Hash ist in
die Browser-Snapshot-Deduplizierung aufgenommen, sodass semantische
Airborne-/Touchdown-/Ground-Still-Aenderungen uebertragen werden, ohne rohe
Live-Telemetrie in den Authority-Hash aufzunehmen. Beim finalen
`mission_authority_release` wird das Bundle nach `MISSION_CLOSED` im `lastRun`
gespeichert und vor dem Entfernen der aktiven Authority nochmals verglichen.

Der lokale Windows-Build v365 umfasst 48.255.926 Bytes mit SHA-256
`a9443a959b58ea21bdfaccd2f4dec01e13ab2a5f616f01648d3b6345d94ef42a`.
`executionAuthority=web`, `sideEffects=false` und der gesperrte
`mission.intent.v1`-Pfad bleiben bestehen. Nur der Tracker-Alpha-Kanal zeigt
auf v365; Stable bleibt bis zum realen APT-No-Drift-Test auf v356.

Tracker v366 aktiviert fuer alle normalen APT-Laeufe automatisch ein separates,
rotiertes `GA-APT-Missionstest.txt`. Es schreibt fuer jeden akzeptierten
Authority-Snapshot den narrativfreien Shadow-Checkpoint mit Revision, Phase,
Event-Trace, Browser-/Tracker-Hash und Driftfeldern. Beim terminalen `closed`
fasst `APT_TEST_END` den gesamten Lauf als `parity=PASS|FAIL` zusammen; ein
frueherer Drift, ein fehlender Replay-Vertrag oder ein Hash-Mismatch bleibt bis
zum Ende fehlschlagend. Der Desktop-1.6.3-Kandidat kann die Datei direkt im
Explorer markieren. Die Diagnose ist weiterhin reiner Beobachter:
`executionAuthority=web`, `sideEffects=false`, Missions-Intents read-only.
Der v366-Windows-Build umfasst 48.269.254 Bytes mit SHA-256
`79bc7759b6fd183a849e1a89cffb409b0f9a42ff592031f090b61fbb0834aa23`;
nur der Alpha-Kanal wird aktualisiert, Stable bleibt auf v356.

Der erste externe v366-Bericht zeigte erfolgreiche Tracker-TTS, aber keinen
Shadow-Checkpoint. Der WebSocket wurde in der App bereits bei Relay-Open als
verbunden markiert; `mission.authority.v1` traf erst mit dem Tracker-Heartbeat
ein. Ein Missionsstart oder der auf 180 ms geplante Reconnect-Lifecycle konnte
deshalb vorher einen impliziten Legacy-Lauf ohne Resume-Bundle erzeugen.

Web-Cache `ga-dispatcher-v1681` wartet in diesem Zustand begrenzt auf den
Capability-Heartbeat. Ein bereits gestarteter Lauf wird bei spaeter Erkennung
automatisch versioniert gebunden und unmittelbar mit einem vollstaendigen
Resume-/Execution-Replay-Snapshot geseedet. Missionscommands behalten waehrend
der offenen Aushandlung bereits die stabile Browser-Owner-ID, sodass kein
anonymer Legacy-Owner entsteht. Alte Tracker mit einem frischen Heartbeat ohne
Capability bleiben ohne zusaetzliche Wartezeit im bisherigen Legacy-Pfad.

Tracker v367 verwendet fuer `GA-APT-Missionstest.txt` das additive Schema
`ga.apt-mission-test-log.v2`. Neben den unveraenderten Checkpoints schreibt es
einen expliziten Wartezustand und redigierte Protokolldiagnose fuer Acquire,
Snapshot und Release. Diese zeigt nur Typ, Status, Fehlercode und das
Vorhandensein von Bundle, Execution und Replay. Wiederholte Render-503- und
Close-Zeilen werden pro Ereignis auf ein Minuten-Summary begrenzt. Der
v367-Windows-Build umfasst 48.275.590 Bytes mit SHA-256
`893d8387aa584ef0eccbb28e7a113c36fbc3c8c530ea094b9531c37dddd6a57e`;
Alpha wird aktualisiert, Stable bleibt auf v356.

Der v368-Kandidat trennt die technische Logabdeckung von der Rezeptauswahl.
`ga.mission-test-log.v3` beginnt bei der ersten akzeptierten Shadow-Beobachtung
jedes Authority-Laufs, schreibt recipe- und mode-spezifische Checkpoints und
endet nach erfolgreichem `mission_authority_release`. Ein
`snapshot-shadow` kann Transport und Projektion bestaetigen, behauptet aber
keine unabhaengige Replay-Paritaet; nur `event-replay` liefert weiterhin
`parity=PASS|FAIL`.

Parallel wird die Resume-Adapterwahl auf bereits vorhandene explizite
Missionsmerkmale gestuetzt. Ein allgemeines leeres POI-Fortschrittsobjekt und
das bei APT wie POI vorhandene `targetName` duerfen die Auswahl nicht mehr auf
`poi` ziehen. Diese Aenderung betrifft nur Resume-Deskriptor, Shadow-Rezept und
spaetere recipe-weise Wiederaufnahme. Missionsbriefing, Web-Runtime, Cargo,
Pax, Voice, Szenen und Erfolgsgates lesen den Adapter nicht zurueck und bleiben
unveraendert. Dateiname und Desktop-Button behalten vorerst ihre bisherige
APT-Bezeichnung, damit installierte Tester keine neue Ablage suchen muessen.
Der v368-Windows-Build umfasst 48.277.654 Bytes mit SHA-256
`9db300c13488d7f18b97d2f1712f2d59d18608d61b99e01337536a0c18da8692`;
nur der Alpha-Kanal wird aktualisiert, Stable bleibt auf v356.

Der nachfolgende unvollstaendige v368-Realbericht ist als Transport- und
Snapshot-Shadow-Nachweis freigegeben: 35 Checkpoints stimmten ohne Drift
ueberein, der Sim-Abbruch verhinderte lediglich den terminalen Release. Da der
Lauf weiterhin `adapter=poi`, `replay=0` und `snapshot-shadow` meldete, gilt er
nicht als unabhaengiger APT-Event-Replay-Nachweis. Die erste E4-Grenze verlangt
deshalb weiterhin technisch ein echtes `adapter=apt`-Event-Replay ohne Browser-
oder Legacy-Drift.

Der lokale E4-Unterbau erweitert denselben atomar persistierten Run um
`executionAuthority`, Rezept, Execution-Revision, Execution-State-Hash und
einen vorbereiteten Zwei-Phasen-Handoff. Die Vorbereitung ist nur im noch
seiteneffektfreien APT-`planned`-Zustand erlaubt und prueft Run/Owner, exakte
Authority-Revision, Web-State-Hash, Execution-State-Hash sowie die vollstaendige
Browser-/Tracker-Projektion. Ein weiterer Web-Snapshot oder Owner-Wechsel
verwirft die Vorbereitung. Commit ist standardmaessig gesperrt und wird weder
vom Tracker-Protokoll aufgerufen noch als Capability beworben. Lokale Tests
koennen ihn ausdruecklich aktivieren und bestaetigen dann persistente Recovery,
die Sperre weiterer Web-Snapshots und einen Rollback, solange noch kein neues
Tracker-Execution-Event angewendet wurde.

Der danach liegende interne Event-Eingang ist ebenfalls noch nicht an Relay,
EFB oder Toolbar angeschlossen. Er akzeptiert nur das naechste normalisierte
Core-Event mit exakter Authority-/Execution-Revision und Execution-State-Hash,
bestaetigt bereits verarbeitete `eventId` idempotent und persistiert
Execution-State, Replay-Bundle, Phase und Hash in derselben atomaren
Run-Transaktion. Deklarative Effekte verlassen diese Grenze noch nicht. Nach
dem ersten akzeptierten Event wird der einfache Rollback blockiert; ein
Persistenzfehler setzt die In-Memory-Transaktion zurueck und kann kein
erfolgreiches ACK erzeugen.

Auf diesem Eingang liegt lokal ein erster reiner APT-Adapter. Sein interner
Execution-Snapshot enthaelt nur normalisierten Core-State, abgeleitete Aktionen,
Run-/Authority-Revision und Execution-Hash; Owner, Resume-Bundle, Briefing und
Mission-Narrative werden nicht weitergereicht. Cockpit-Aktionen koennen nur
vordefinierte Core-Events erzeugen. Manifest-Aenderungen werden aus Item-ID,
Aktion und dem aktuellen autoritativen Zustand neu aufgebaut, loeschen eine
vorhandene Signatur und erlauben Passagiere ausschliesslich ueber spaetere
Szenen-/Pax-ACKs.

Der Telemetriepfad des Adapters bildet mit stabilen Zeitfenstern ausschliesslich
`AIRBORNE`, `TOUCHDOWN` und `GROUND_STILL` ab. Pause und Menuezustand liefern
keine Missionszeit. Die Zielortentscheidung laeuft jetzt ueber den in Browser
und Node identischen `mission-location-core.js`. Der Authority-Core projiziert
aus dem privaten Resume-Bundle nur `aptArrivalPlan` und letzten gueltigen
Routenpunkt; Briefing, Owner und Narrative bleiben ausserhalb des Adapters.
Die Liveposition kommt ausschliesslich aus der Tracker-Telemetrie. Ein externes
`atDestination`-Flag kann die Entscheidung nicht ueberschreiben. Die Radien
entsprechen der bestehenden App: 0,16 NM Arrival-Anker, 0,35 NM
Flugplatz-Fallback und 1,2 NM Missionsziel, wenn kein APT-Anker vorhanden ist.
Die App-Runtime nutzt denselben Core mit ihrer bisherigen Rechnung als
kompatiblem Fallback.

APT-Radien koennen additiv ueber
`ga.mission-location-policy.apt.v1` variiert werden. Der Authority-Core nimmt
die Policy nur als vollstaendiges Dreierprofil an und der Location-Core
begrenzt Arrival-Anker, Airport-Fallback und routenbasiertes Missionsziel auf
0,05-0,5 NM, 0,1-1,0 NM beziehungsweise 0,25-3,0 NM. Bei jedem Schema- oder
Wertefehler gelten wieder 0,16/0,35/1,2 NM. Ein spaeteres POI-Rezept erhaelt
einen eigenen Zonenvertrag und kann damit zusaetzlich Hoehenband,
Geschwindigkeit, Dwell-Zeit und mehrere Zonen ausdruecken, ohne die
APT-Semantik umzudeuten.

Der lokale `tracker-mission-effect-runner.js` konsumiert ausschliesslich die
vom Execution-Core erzeugten deklarativen Effekte. Die `effectId` ist zugleich
die stabile Dispatch-`commandId`. Positive oder terminal negative Ergebnisse
werden mit `EFFECT_ACKNOWLEDGED` in demselben Replay persistiert. Vor einem
positiven ACK wendet der Runner fuer `scene.prepare`, `scene.boarding`,
`scene.deboarding` und `mission.close_requested` die fest zugeordneten
internen Folgeevents an. Ist das ACK persistiert, wird der Handler nicht erneut
aufgerufen. Wurde nur der physische Dispatch persistiert und der Tracker vor
dem ACK beendet, haelt die Controller-Grenze den Effekt nach Recovery mit
`mission_effect_recovery_confirmation_required` an. Dieser bewusst
fail-closed Ambiguitaetsfall verhindert doppelte SimObjects; ein expliziter
Abgleich-/Recoverydialog folgt erst nach dem realen In-Sim-Test.

Der lokale v369-Schnitt verdrahtet die echten Simulatorhandler hinter einem
zweifachen, standardmaessig inaktiven Alpha-Gate. Die App transportiert dazu
`ga.mission-apt-effect-plan.v1`, erzeugt aus denselben bestehenden Spawn- und
Boarding-Buildern wie der Web-Ablauf. Der Tracker validiert den vorbereiteten
Command-Typ und ersetzt ausschliesslich Liveposition, Run und deterministische
`effectId`. Die interne Controller-Grenze erlaubt Scene-Spawn, Boarding und
Deboarding; deren echte ACKs erreichen den Effect-Runner auch ohne offenen
Relay-Socket.

`tracker-mission-execution-runtime.js` verbindet Adapter, Runner,
SimConnect-Telemetrie und diese Controller-Grenze. Aktiv wird sie nur bei
Tracker-Kanal `alpha` plus `VFR_MULTITOOL_APT_EXECUTION=1`; erst dann wird
`mission.intent.v1` in Relay- und Loopback-Hello ergaenzt. Der normale Start,
Stable und eine Alpha ohne Umgebungsvariable bleiben bei
`executionAuthority=web`, read-only Intents und unveraenderten Web-
Seiteneffekten.

Der v370-Alpha-Kandidat ergaenzt die kontrollierte Uebergabe. Beim ersten
APT-Prepare sendet die Web-App einen letzten exakten Resume-/Replay-Snapshot,
bereitet den Handoff vor und committet nur bei unveraenderten Revisionen und
Hashes. Danach schreibt sie keine Runtime-Snapshots und keine alten
Szenenbefehle mehr. App und EFB senden denselben allowlist-basierten
Loopback-Intentvertrag; der Tracker liefert fuer beide einen begrenzten
`ga.mission-execution-control.v1` mit Phase, Flags, Cargo, Signatur,
Blockierungsgruenden und erlaubten Aktionen.

Der erste reale v370-Test deckte an der App-Transportgrenze einen lokalen
Klassifizierungsfehler auf: Prepare-ACKs wurden zwar vom Tracker positiv
erzeugt, vom sendenden Browser aber als fremde Broadcast-ACKs verworfen, weil
`mission_execution_authority_*` beim Senden nicht in die lokale Command-ID-
Allowlist aufgenommen wurde. Der v371-Folgefix schliesst Prepare, Commit und
Rollback in dieselbe Klassifizierung wie `mission_authority_*` und
`mission_snapshot_*` ein. Er aendert weder Handoff-Pruefungen noch Reducer,
Manifest, Effekte oder Missionssemantik.

Ein sichtbarer EFB-Missionsbanner wird ausschliesslich aus dem aktuellen
Tracker-Snapshot projiziert. Er zeigt Phase, Aufgabe und Controllerstatus und
oeffnet den gemeinsamen Mission-Drawer. Er uebernimmt keine Mission und besitzt
keine eigene Autoritaet; EFB und spaeter Toolbar bleiben weiterhin parallele
Ansichten desselben Trackerzustands.

Der lokale v372-Folgefix schaerft diese Projektion nach dem ersten
Mehrinstanz-Feldlauf. `DialogMode=1` darf die Missionsdetektoren nicht sperren,
weil MSFS diesen Zustand bereits beim geoeffneten Cockpit-EFB setzt. Fuer die
autoritative Missions-Telemetrie gilt deshalb nur `SimStop` als Menue-/Map-
Sperre; echte Pause bleibt weiterhin separat gesperrt. Der allgemeine
Flugsnapshot behaelt `dialogMode` und `inMenuOrMap` unveraendert fuer Anzeige
und Diagnose. Ignorierte Missions-Telemetrie wird rate-limitiert mit Phase,
On-Ground, Groundspeed, Pause, SimStop und Dialogzustand protokolliert.

Die EFB-Bedienung verwendet ab Host 0.6.8 das bereits aus der App bekannte
Kartenbanner, aber nur fuer die naechste aktuell erlaubte Aktion. Im
Reiseflug gibt es keinen permanenten Statusstreifen. Verladung, Pickup,
Entladung und PAX-Deboarding oeffnen einen eigenstaendigen Verlade-Manager;
der Mission-Drawer bleibt Statusansicht und Link auf diesen Dialog. Anzeigen
duerfen beschreibende Manifestnamen aus dem privaten Authority-Bundle
projizieren, waehrend Status, Signatur und Aktionsfreigabe ausschliesslich aus
`ga.mission-execution-control.v1` stammen. App und EFB pruefen die aktuelle
`allowedActions`-Liste vor jedem Cargo-/PAX-Intent. Diese UI-Grenze aendert
weder Reducer noch Missionsradien, Briefings oder Effektplaene.

Cargo-Items werden erst nach einem akzeptierten Intent im Trackerzustand
geaendert. Passagiere bleiben szenengebunden: Ein Deboard-Intent erzeugt
`scene.deboarding`, und erst das positive Sim-ACK erzeugt
`PAX_DEBOARDING_CONFIRMED`. Bei Abschluss verschiebt der Tracker den Lauf nach
`lastRun` und behaelt zusaetzlich eine begrenzte `lastExecution`-Projektion.
Dadurch zeigt das EFB keine aktive Mission mehr und die Web-App kann denselben
Run genau einmal in ihr bestehendes Debrief uebernehmen.

Der lokale v373-Recovery-Kandidat schliesst den zuvor offenen fail-closed
Abbruchpfad. `abort_mission` bleibt revisionsgebunden und wird nur akzeptiert,
wenn der aktive Tracker-Run dieselbe Mission und Run-ID besitzt und der Core
die Aktion in `allowedActions` ausweist. Bei verbundener Sim-Instanz entfernt
der Tracker zuerst alle dem Run zugeordneten Mission-/Szenenobjekte. Nur nach
positiver Bereinigung verschiebt der Authority-Core den Lauf atomar als
`state=aborted`, `phase=closed` und
`lastCommandType=mission_execution_abort` nach `lastRun`; bei Fehler bleibt
die Authority aktiv und der Abbruch kann wiederholt werden. Ohne verbundene
Sim-Instanz darf der persistente Lauf ebenfalls beendet werden, weil dort
keine lebende SimConnect-Szene bereinigt werden kann.

App und EFB bieten diesen Abbruch als getrennte, bestaetigungspflichtige
destruktive Aktion an. Nach dem gemeinsamen ACK entfernen alle App-Instanzen
den passenden lokalen Runtime-/Briefingstand ohne alten Web-Release und ohne
Abschluss-Debrief. `Clear`, `Mission Reset` und Missionsersetzung routen bei
Tracker-Authority ueber denselben Intent. Der Verlade-Manager zeigt waehrend
nicht freigegebener Flugphasen eine konkrete Tracker-Sperre und deaktiviert
Item-, Signatur- und Abschlussaktionen statt wirkungslos zu erscheinen.
`reset_mission` bleibt weiterhin nicht migriert.

Der lokale v374-Kandidat schliesst zwei weitere Grenzen, ohne den APT-Reducer
oder seine Zielradien zu veraendern. Erstens ist nach der ersten expliziten
`Pause`-/`Pause_EX1`-Meldung deren `OFF` der autoritative Pausezustand;
widerspruechlich auf `1` stehende MSFS-SimVars duerfen einen echten Flug nicht
mehr einfrieren. Ohne empfangenen Eventzustand bleiben die SimVars der
Fallback. Zweitens darf eine noch geplante APT-Mission einen begrenzten
`ga.tracker-cloud-mission-seed.v1` im bestehenden, PIN-geschuetzten
Cloudprofil ablegen. Er enthaelt keine Zugangsdaten, sondern Mission-ID,
initiales Manifest, Descriptor, begrenzte EFB-Projektion und den bereits von
der App erzeugten exakten APT-Effektplan.

Der Tracker liest diesen Seed ausschliesslich bei aktivem Alpha-Execution-
Gate. `activate_cloud_mission` ist nur ohne aktiven Run, mit kurzlebiger
Cockpit-Sitzung und Revision `0` erlaubt. Der Tracker erzeugt daraus denselben
Execution-Replay, akquiriert den Run, durchlaeuft Prepare/Commit der vorhandenen
Zwei-Phasen-Grenze und sendet danach intern `prepare_mission`. Der Seed wird
nicht zu einer zweiten Wahrheit: Nach der Aktivierung kommen Phase, Manifest,
Banner und `allowedActions` nur aus dem persistenten Tracker-Run. Eine
Browser-App darf dessen privates Bundle als Observer restaurieren, aber weder
den Owner uebernehmen noch Web-Snapshots zurueckschreiben. Ein bereits
abgeschlossener Run unterdrueckt denselben unveraenderten Cloud-Seed; ein neu
gespeicherter Missionsstand besitzt einen neueren Seed-Zeitstempel.

Der v375-Folgefix macht dabei nicht die EFB-UI zu einer zweiten
Missionslogik, sondern hebt die bewaehrten App-Manifestregeln in den
gemeinsamen Execution-Core: Nicht-PAX-Positionen koennen in der jeweiligen
Bodenphase geladen und wieder ausgeladen werden; jede Item-Aenderung loescht
die Signatur des Abschnitts. `clear_manifest_signature` ist ein eigener,
revisionsgebundener Intent. Arrival-Signatur und `UNLOAD_CONFIRMED` sind harte
Close-Gates. PAX bleibt ausschliesslich ueber `scene.deboarding` veraenderbar,
und ein noch offener Effekt unterdrueckt weitere Deboarding-Intents.

`cargo.pickup_confirmed` und `cargo.unload_confirmed` sind reine lokale
Buchhaltungseffekte und werden vom Tracker-Runtime-Handler sofort quittiert;
damit koennen sie den persistenten FIFO-Effect-Runner nicht mehr vor dem
Close-Effekt blockieren. App- und EFB-Projektionen vergleichen semantische
Signaturen und ersetzen ihr DOM nicht bei unveraenderten Polls. Das aendert
weder Missionsradien, Briefings noch den bestehenden APT-Effektplan.

Nicht migriert sind in v371 die zentrale Sim-Payload-Verteilung,
missionsgetriggerte Voice-Intents, Pickup/POI/Sonderrezepte sowie die manuelle
Aufloesung eines fail-closed Recoveryfalls. Deshalb bleiben Alpha-Kanal und
`VFR_MULTITOOL_APT_EXECUTION=1` weiterhin gemeinsam erforderlich.

Ein autoritativ geschlossenes APT-Replay bleibt nicht als scheinbar aktive
Mission liegen: Sobald `MISSION_CLOSED` und alle Effekt-ACKs atomar gespeichert
sind, finalisiert der Authority-Core den Run nach `lastRun`. Ein noch offener
oder effektbehafteter Lauf kann diesen internen Abschluss nicht aufrufen.

Der 0.4.3-In-Sim-Log zeigt, dass die Dateien in richtiger Reihenfolge geladen
werden, Coherent aber Optional Chaining und Object Spread nicht parst.
Tracker v329 und EFB 0.4.4 definieren deshalb eine zusaetzliche Hostgrenze:
alle direkt oder im E6B-iframe ausgefuehrten Skripte muessen ohne `?.`, `??`
und Spread-Syntax auskommen. Der Inline-Bootstrap ergaenzt nur kleine
Browser-Polyfills; er ersetzt keine Missions- oder Kartenlogik.

Der technische Rueckkanal schreibt weiter in `ga-tracker-debug.txt`, diese
Datei ist ab v329 jedoch rotiert: 8 MiB aktive Datei, zwei Tail-Archive mit je
hoechstens 512 KiB, 32 KiB pro Einzelzeile und 1,5 Sekunden Entprellung fuer
identische Nachbarereignisse. Eine beim Upgrade bereits uebergrosse Datei wird
beim ersten neuen Eintrag sofort auf ihren letzten Tail reduziert. Das
Debuglogging kann damit die Missionsautoritaet weiterhin beobachten, aber den
Benutzerdatentraeger nicht mehr unbegrenzt fuellen.

Tracker v330 erweitert diese Hostgrenze um Runtime-Kompatibilitaet fuer die
tatsaechlich im Simulator fehlenden Methoden `String.trimEnd` und
`Array.flatMap`. Das E6B-iframe meldet Boot-, Script-, JSON- und Fallbackstatus
ueber denselben begrenzten Diagnosepfad. Unveraenderte `live`-Meldungen werden
nicht mehr sekundenweise an den Parent gespiegelt. Ebenso werden Route und
Flugzeugmarker nur bei veraenderter Geometrie, Position oder Richtung neu
gerendert. Diese Aenderungen bleiben rein lokal und read-only.

Tracker v331 ergaenzt den Authority-Untervertrag optional um `mapProfile`.
Die Web-App sanitisiert und reduziert das bereits berechnete Terrainprofil
vor dem Resume-Upload auf hoechstens 96 Punkte. Es wird getrennt vom
Cloud-Missionspayload nur im autoritativen Tracker-Resume-Bundle gespeichert;
Geschichten, Passagierdaten, Caches und Rohdaten bleiben ausgeschlossen. Die
HTTP-Projektion normalisiert hoechstens 128 Punkte und liefert Terrain- und
Planhoehe an das EFB. Fehlt das Feld bei einem alten Run, bleibt das bisherige
planbasierte Hoehenband erhalten.

Der 0.4.6-Host verwendet feste Leaflet-Panes fuer Basis-, Aero-, Routen-,
Zeichen-, Vorschau- und Flugzeuglayer und schaltet Karten-/Tile-Fades ab. Die
Legpfeile waehlen nur einen lokalen Vorschauwegpunkt; sie senden keinen
Missionsbefehl. Position und Sichtbarkeit der Infoboxen sind ebenfalls reine
lokale EFB-Praeferenzen. Damit erweitert v331 Darstellung und Bedienung, nicht
die Schreibrechte des EFB-Vertrages.

Host 0.4.7/v332 behaelt diese read-only Grenze bei. Die Aero-Ebene darf die
Basiskarte nicht ein zweites Mal dimmen. Freihand-Pointer werden vom sichtbaren
Coherent-Rechteck in Leaflets interne Containerkoordinaten umgerechnet. Das
E6B wird weiterhin im lokalen iframe gerendert, die Drehgeste wird wegen der
Coherent-Pointergrenze jedoch auf einer Parent-Flaeche erfasst und als
`ga-e6b-rotate-delta` weitergegeben. Mission und Checklistenhaken im
Seitenmenue erzeugen keine Tracker-Commands: Mission ist eine Projektion von
`/api/v1/mission`, Checklistenhaken bleiben nur im EFB-localStorage.

Host 0.4.8/v333 fuehrt die im Kartentisch erlaubten Rasterquellen ueber
`/api/v1/map-tile/{layer}/{z}/{x}/{y}.png`. Der Loopback-Server akzeptiert nur
bekannte Layer und gueltige Tile-Indizes, begrenzt Antworten auf 2 MiB,
dedupliziert parallele Abrufe und haelt hoechstens 32 MiB im RAM. Er ist kein
offener URL-Proxy und nutzt den Cloudflare Worker nicht. Dadurch muss der
Coherent-Browser nach einer Kartenbewegung keine Cross-Origin-Tiles direkt
nachladen. Terrain bleibt Teil des Authority-Bundles: Nach Abschluss ihres
bestehenden Terrainabrufs sendet die Web-App sofort einen neuen kompakten
Snapshot; der Tracker startet dafuer keinen eigenen Routendaten-Abruf.

Host 0.4.9/v334 behaelt diesen Proxy bei und haertet die letzte Renderergrenze:
Das transparente Aero-PNG wird mit geringer Deckkraft beigemischt, damit ein
Coherent-Compositor mit schwarzem Alpha-Fallback die Basiskarte nicht mehr
verdecken kann. Toolbar und Leaflet-Layerdialog erhalten EFB-eigene
Abstands-/Kontrastregeln. Nach einer Geraeteuebergabe plant die Web-App den
vorhandenen Profilabruf erneut ein, sobald die restaurierte Route mindestens
zwei Punkte besitzt; das fertige kompakte Profil wird weiter ueber denselben
Authority-Snapshot uebertragen.

Host 0.5.0/v335 kehrt fuer Rasterkarten zum im nativen MSFS-EFB bestaetigten
Transport zurueck: direkte HTTPS-Quelle zuerst, vorhandene direkte Backup-URL
danach und der erlaubnislistenbasierte Loopback-Proxy erst als letzter
Fallback. Der Proxy bleibt damit nutzbar, ist aber nicht mehr Voraussetzung
fuer die Coherent-Bilddarstellung. Jede Layerquelle meldet einmalig, ob
`direct`, `backup` oder `tracker-proxy` sichtbar wurde. Fehlgeschlagene
Einzelkacheln erzeugen keinen Layerfehler mehr, sobald eine Quelle dieses
Layers erfolgreich dargestellt wurde.

Der lokale Web-Entwicklungsserver ist kein PWA-Installationsziel. Er sendet
alle Dateien mit `no-store` und entfernt auf Localhost beziehungsweise privaten
LAN-Hosts alte GA-Service-Worker und GA-Caches. Dadurch laufen Local und Alpha
nicht mehr versehentlich mit weit auseinanderliegenden Skriptstaenden gegen
dieselbe Tracker-Authority. Der lokale Versionshinweis muss fuer diesen Stand
`ga-dispatcher-v1620 / NO SW` zeigen.

Host 0.5.1/v336 behaelt diesen Tiletransport bei und gleicht die Darstellung
an den originalen Kartentisch an: Bei aktivem Aero-Layer laeuft die Basiskarte
mit 0,5 und die Aero-Karte mit 0,65 Deckkraft. Die Karte bleibt damit blass,
waehrend Luftraumgrenzen und Beschriftungen fuehren.

Host 0.5.7/v342 ergaenzt den lokalen GET-Vertrag additiv um
`map.context.v1` unter `/api/v1/map-context?lat=...&lon=...&radiusNm=...`.
Der Tracker validiert und begrenzt Koordinaten und Suchradius und fragt fuer
den ausdruecklich ausgewaehlten Punkt OpenAIP ueber den GA-Proxy sowie
Open-Meteo Elevation und Forecast ab. Upstream-Antworten sind zeit- und
groessenbegrenzt, parallele identische Anfragen werden dedupliziert und
hoechstens 64 kompakte Ergebnisse liegen kurzzeitig im RAM. Teilresultate
bleiben nutzbar, wenn eine Quelle ausfaellt. Dieser Pfad ist read-only und
veraendert weder Route noch Mission, Authority, SimConnect oder Web-App-Daten.
Die notwendige Weitergabe der ausgewaehlten Koordinaten wurde vom Benutzer
ausdruecklich freigegeben.

EFB 0.4.5 behandelt die native Leaflet-Karte nicht mehr als gleichrangige
Ansicht. Fehlt `efb.web-client.v1`, ist sie der sichtbare, rein darstellende
Fallback fuer Basiskarte/Aero-Overlay, letzte Route und letzte Position. Alle
weiteren nativen Karten-Chrome-Elemente bleiben verborgen. Sobald die
Capability erscheint, setzt die Parent-App den tracker-gehosteten iframe als
einzige Kartenansicht; faellt sie weg, wird der iframe verworfen und die
Fallback-Karte wieder sichtbar. Host 0.5.8/v343 verwendet fuer geaenderte
Host-CSS/-JS die Assetrevision `34301` und iframe-View `5`, damit Coherent keine
vorherige Runtime aus dem Cache uebernimmt. Dieser Ansichtswechsel veraendert
weder Missionsautoritaet noch Route oder SimConnect-Zustand.

Der Windows-/In-Sim-Test von EFB 0.4.5 zeigte einen Fehler in dieser Parent-
Umschaltung: Die Capability wurde vor der restlichen Poll-Darstellung
aktiviert. Warf ein spaeterer Schritt, fing derselbe Catch-Block den Fehler als
Transportausfall ab, setzte den iframe sofort auf `about:blank` und wiederholte
den Zyklus jede Sekunde. EFB 0.4.6 trennt deshalb Kerntransport,
optionale Endpunkte und Parent-Rendering. Ein aktiver Host-iframe bleibt bei
ein oder zwei aufeinanderfolgenden Kernpollfehlern geladen; erst der dritte
Fehler schaltet zur Fallback-Karte. Diagnosemeldungen nennen `core-error`,
`render-error`, optionale Protokollfehler und die anschliessende Erholung.
Tracker v344 beendet bei `EADDRINUSE` die neu gestartete zweite Instanz mit
einem eindeutigen Fehler, statt ohne lokale EFB-Schnittstelle weiterzulaufen.

EFB 0.4.7/Tracker v345 entfernt den danach im Log sichtbaren Parent-
Renderfehler durch eine Coherent-taugliche Profilwertschleife. Die native
Fallback-Karte behaelt Basiskarten- und Layerauswahl, waehrend Follow,
Kompass, Profil und Werkzeuge verborgen bleiben. Der Punktkontext liest
OpenAIP-Daten primaer aus derselben gehosteten GA Aviation DB wie die App und
faellt bei einem Fehler auf den GA-Proxy zurueck. Dessen Abdeckung wird auf
stabile 0,5-Grad-Schluessel quantisiert, damit benachbarte Kartenpunkte den
gemeinsamen Cache nutzen. Terrain und Wetter bleiben parallele Open-Meteo-
Abfragen; Antwort und Debuglog nennen Quelle, Modus und Einzellaufzeiten.
Host-CSS/-JS verwenden Assetrevision `34501`, der Parent iframe-View `6`.
Alle Pfade bleiben read-only und aendern weder die App-Dateien noch Mission,
Route oder SimConnect-Zustand.

EFB 0.4.8 korrigiert ausschliesslich die Parent-Sichtbarkeit der nativen
Fallback-Karte: Neben Follow, Kompass, Profil und Werkzeugen wird auch die
`flight-strip` mit der aktuellen Position ausgeblendet. Layerauswahl, Route
und Flugzeugmarker bleiben erhalten. Der Trackervertrag und Host 0.5.9 sind
gegenueber 0.4.7 unveraendert. Der offizielle SDK-1.7.2-Build und der
abschliessende In-Sim-Test wurden am 13.08.2026 freigegeben; Tracker und Paket
koennen deshalb als unveraenderliche Alpha-Artefakte veroeffentlicht werden.

Der isolierte Kandidat Tracker v346 / Host 0.6.0 / EFB 0.4.9 erweitert diese
Grenze um zwei getrennte, versionierte Datenprodukte. `mission.view.v1` liegt
im bestehenden Authority-Resume-Bundle und enthaelt eine begrenzte Projektion
der bereits von der App berechneten Missionsmenue-Daten. Der Tracker validiert
und begrenzt sie erneut, bevor `/api/v1/mission` sie an das read-only Mission
Control liefert. Der Host berechnet weder Missionsphasen noch Erfolgskriterien.

`checklist.library.v1` ist davon unabhaengig. Nur die Web-App sendet nach
Capability-Pruefung den Command `efb_checklist_library.store` mit ihren
sanitisierten Custom-Listen. Der Tracker akzeptiert hoechstens 40 Listen,
20 Abschnitte und 300 Punkte je Liste sowie insgesamt 512 KiB, schreibt atomar
nach `efb-checklists-v1.json` und liefert das Ergebnis ueber
`GET /api/v1/checklists`. Sync-PIN, Community-Abos, App-Abhakstand und Cloud-
Daten sind nicht Teil dieses Snapshots. Im EFB sind Checklisten weiterhin
read-only bezueglich ihrer Definition; nur der lokale Abhakstand wird
veraendert. EFB 0.4.9 normalisiert zudem jede gespeicherte Theme-Praeferenz auf
den einzigen Modern-Style. v346/0.4.9 ist nicht veroeffentlicht und benoetigt
vor einem Kanaleintrag den offiziellen Windows-/In-Sim-Test.

Ab Webstand v1621 ist die im Kartentisch tatsaechlich aktive Route Bestandteil
jedes bestehenden Authority-Resume-Bundles. Nach Missionsstart loest eine
Routenmutation sofort `mission_snapshot_update` aus; dabei wird ein Profil der
vorherigen Route nicht weitergereicht. Der ohnehin vorhandene asynchrone
Terrainabruf sendet nach Abschluss einen zweiten Snapshot mit `mapProfile`.
Das EFB pollt weiter nur die lokale read-only Projektion und aktualisiert Route
und Band anhand der Revision. `MISSION_MAP_AUTHORITY` protokolliert auf dem
Tracker nur bei relevanten Projektionswechseln Mission, Run, Routenpunkte,
Profilmodus, Profilpunkte und Terrainstatus. Vor `Mission starten` besteht
weiterhin kein Authority-Run; eine geplante Route wird daher bewusst nicht
ueber einen zusaetzlichen Relay-Kanal transportiert. Fuer den gemeinsamen
v336-Test muss die Web-App `ga-dispatcher-v1621` anzeigen; Local v1603 und die
getestete Alpha v1619 sind dafuer funktional zu alt.

Der Web-App-Cloud-Pull wird ebenfalls an dieser Authority-Grenze arbitriert.
Solange der verbundene Tracker einen aktiven Run meldet, darf `activeMission`
aus dem Cloud-Profil weder lokal restauriert noch als Scene-/Lifecycle-Quelle
verwendet werden. Ein manueller Pull startet stattdessen den bestehenden
Snapshot-/Takeover-Dialog und restauriert nach Bestaetigung das Resume-Bundle
des Trackers. Ein stiller Pull behaelt den Tracker-Run ohne Ownerwechsel bei;
Logbuch, Pinnwand, Presets und die uebrigen Profildaten koennen trotzdem
aktualisiert werden. Damit bleiben Stable-, Alpha- und lokale App-Instanzen
Cloud-kompatibel, ohne eine zweite Missionsautoritaet zu erzeugen.

Persistiert werden keine Sync-PIN und kein neuer Authority-Token. Der
Authority-Vertrag stuetzt sich innerhalb der bereits durch Sync-ID/PIN
geschuetzten Relay-Sitzung auf eine zufaellige Client-ID, die Tracker-`runId`
und monotone Snapshot-Sequenzen. Resume-Bundles sind groessenbegrenzt und
verwenden einen expliziten Missionstyp-/Facettenvertrag.

Die Mindestversion der Alpha-Web-App bleibt davon getrennt bei Tracker v320.
Stable v320 kann den bestehenden Web-/Relay-Ablauf daher auch gegen
`origin/main` weiter bedienen. Fehlt einem Tracker eine neuere EFB-Capability,
zeigt ausschliesslich die betroffene EFB-Funktion einen begrenzten Fallback;
die Web-App fordert deshalb nicht pauschal den jeweils neuesten Alpha-Tracker.

## Sichere Einfuehrung

1. Desktop-Kanaele trennen: Stable bleibt Standard, Alpha erhaelt eine eigene Runtime.
2. Protokollkern additiv bereitstellen, noch ohne laufende Missionslogik umzubauen.
3. Hello/Capabilities zuerst im Alpha-Tracker und in einem Test-Client integrieren.
4. EFB und Toolbar-Panel zunaechst nur lesend mit Status und Telemetrie
   anbinden.
5. Benutzeraktionen einzeln als versionierte Commands fuer beide Hosts
   freigeben.
6. Rechenlogik nur modulweise verschieben und jeweils gegen die bestehende Web-App testen.
7. Dasselbe unveraenderliche Tracker-Artefakt nach Alpha-Test in Stable promoten.

`mission-runtime-core.js`, `mission-cargo-core.js`,
`mission-compliance-core.js` und der bestehende Web-/Relay-Ablauf werden in
dieser Stufe nicht umverdrahtet. Der additive Execution-Snapshot, der
APT-Event-Replay und der seiteneffektfreie Tracker-Shadow schaffen die neue
Grenze, ohne den aktuell produktiven Missionsablauf zu beeinflussen. Der
naechste Schritt ist ein realer APT-No-Drift-Lauf; erst danach folgt eine
recipe-weise Tracker-Authority.
