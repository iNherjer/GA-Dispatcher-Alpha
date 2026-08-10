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
