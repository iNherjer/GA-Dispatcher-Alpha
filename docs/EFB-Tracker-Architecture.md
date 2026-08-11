# EFB-/Tracker-Architektur

Der chatuebergreifende Umsetzungsstand, die priorisierte Roadmap und der Plan
zur Migration des Missionskerns stehen in `docs/EFB-Development-Plan.md`.
Diese Datei beschreibt die dauerhaften Architekturgrenzen.

## Zielbild

Der Windows-Tracker wird schrittweise zur lokalen Ausfuehrungs- und
Rechenebene. Das MSFS-2024-EFB bleibt eine schlanke Bedienoberflaeche. Damit
liegen SimConnect, hochfrequente Telemetrie, Szenenbefehle und spaeter
ausgelagerte Berechnungen in dem Prozess, der auf dem PC ohnehin laufen muss.

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

### EFB

- Darstellung, Navigation und direkte Benutzerinteraktion
- Anfordern von Snapshots statt eigener Polling-/Rechenloops
- Senden klarer Benutzerabsichten statt direkter SimConnect-Details
- sichtbarer Fallback, wenn eine Tracker-Capability fehlt

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
noch an MSFS CommBus. Dadurch koennen der heutige Relay-Pfad und ein kuenftiger
EFB-Transport dieselben Nachrichten verwenden.

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

Tracker v323 ergaenzt daneben eine getrennte read-only Loopback-Schnittstelle
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

Der lokale HTTP-Endpunkt bleibt read-only. `/api/v1/mission` liefert bei einem
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
gemeinsamer Node-/Browser-Kern nutzbar. Voice bleibt ein eigener Tracker-
Dienst und wird nicht aus dem eingebetteten EFB-Dokument heraus autoritativ
gesteuert.

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
4. EFB zunaechst nur lesend mit Status und Telemetrie anbinden.
5. Benutzeraktionen einzeln als versionierte Commands freigeben.
6. Rechenlogik nur modulweise verschieben und jeweils gegen die bestehende Web-App testen.
7. Dasselbe unveraenderliche Tracker-Artefakt nach Alpha-Test in Stable promoten.

`mission-runtime-core.js`, `mission-cargo-core.js` und der bestehende
Web-/Relay-Ablauf werden in dieser Stufe nicht umverdrahtet. Dadurch ist die
neue Grenze vorhanden, ohne den aktuell produktiven Missionsablauf zu
beeinflussen.
