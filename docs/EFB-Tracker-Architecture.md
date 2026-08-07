# EFB-/Tracker-Architektur

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
Capabilities aushandeln. Der erste Protokollstand meldet absichtlich nur die beiden bereits
implementierten Legacy-Capabilities und behauptet noch keine EFB-Interaktionen.

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
