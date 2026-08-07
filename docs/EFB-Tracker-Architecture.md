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

## Sichere Einfuehrung

1. Desktop-Kanaele trennen: Stable bleibt Standard, Alpha erhaelt eine eigene Runtime.
2. Protokollkern additiv bereitstellen, noch ohne laufende Missionslogik umzubauen.
3. Hello/Capabilities zuerst im Alpha-Tracker und in einem Test-Client integrieren.
4. EFB zunaechst nur lesend mit Status und Telemetrie anbinden.
5. Benutzeraktionen einzeln als versionierte Commands freigeben.
6. Rechenlogik nur modulweise verschieben und jeweils gegen die bestehende Web-App testen.
7. Dasselbe unveraenderliche Tracker-Artefakt nach Alpha-Test in Stable promoten.

`tracker.js`, `sync.js`, `mission-runtime-core.js` und `mission-cargo-core.js`
werden in den ersten beiden Schritten nicht umverdrahtet. Dadurch ist die neue
Grenze vorhanden, ohne den aktuell produktiven Missionsablauf zu beeinflussen.
