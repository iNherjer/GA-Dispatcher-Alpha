# Optionale Flugplanuebergabe beim Missionsstart

Stand: 12.10.2026. Lokaler Source-Kandidat, noch kein MSFS-Funktionsnachweis.

## Bedienung und Ablauf

Der erste Kartenbanner (`prepare_mission` bzw. `activate_cloud_mission`) behaelt
seine bisherige Aktion. Eine bereite native EFB-/Toolbar-Bruecke ergaenzt:

- Mission starten und Flugplan an den MSFS senden
- Mission starten sowie Flugplan an den MSFS und Avionik senden

Der spaetere Start nach Boarding (`start_mission`) bekommt keine Exportbuttons.
Web-App und alte native Pakete zeigen keine Zusatzbuttons. Der gemeinsame
Cockpit-Host schaltet sie nur nach einer Antwort seines eigenen Parentfensters
mit passendem Channel und `host=efb|toolbar` frei. Die Freigabe laeuft ohne
Heartbeat nach zwoelf Sekunden ab. Die native Probe liest nur `GET_EFB_ROUTE`;
der reale Nachweis der Schreibaufrufe erfolgt im SDK-/Simulator-Test.

Alle Varianten senden denselben bisherigen Missionsintent und dieselben Gates.
Erst nach bestaetigtem Start fordert die Zusatzvariante ein Export-JSON an.
Routenfehler, geschlossene Hosts, Simulatorfehler und Timeouts bleiben separate
Exportfehler. Sie blockieren weder Missionsstart noch Boarding oder Fortschritt;
es gibt keinen Missionsrollback und keine automatische Startwiederholung.

## Daten und Verantwortlichkeit

`tracker-cockpit-tools.js` liefert ueber `flightplan_export` auf dem bestehenden
authentifizierten `/api/v1/cockpit/tools` eine `ga.flightplan-export.v1`.
Die Aktion ist nur fuer EFB-/Toolbar-Sitzungen erlaubt. Sie prueft Mission,
Run und optional die beim Klick beobachtete Navigationsrevision. Cloudaktivierung
darf die neue Run-ID aus dem aktualisierten Start-ACK verwenden.

`tracker-flightplan-export.js` liest die vollstaendige private Navigationsroute,
ersatzweise die bestehende Missionsroute im Resume-Bundle. Sie verwendet keine
auf 128 Punkte begrenzte Kartenprojektion. Bis zu 512 Punkte werden vollstaendig
exportiert; groessere oder ungueltige Routen ergeben einen Exportfehler, keine
stille Kuerzung. Das JSON enthaelt Mission-/Run-ID, Navigationsrevision,
SHA-256-Routenhash, Start-/Zielkennung, Koordinaten/Namen und geplante Reiseflughoehe.
Terrain-/Flugplatzhoehen und Task-Arbeitshoehen werden nicht als Leg-Flughoehen
uebernommen. Es werden keine Verfahren erfunden. Eine PLN/FPL-Datei ist unnötig.

Die native EFB-/Toolbar-Bruecke verwendet denselben `FlightPlanRoute`-Converter
und Auftragsrunner (`efb-app/flightplan-bridge-core.js`) und denselben Parentadapter
(`efb-app/native-flightplan-bridge.js`). `FlightPlanBridge.ts` verbindet ihn mit
dem SDK der EFB-App. Toolbar kann die beiden JS-Module laden und den Adapter
mit eigenem Frame-/Channel-/Lifecycle-Kontext initialisieren.

Bei verfuegbarem SDK werden Start-/Zielflugplaetze durch exakte Ident-Suche und
Koordinatennaehe im Sim aufgeloest. Fehlende Flugplaetze bzw. fehlender FacilityLoader
bleiben als Koordinatenendpunkte erhalten; die Abweichung wird protokolliert.
Zwischenpunkte bleiben in Reihenfolge als Koordinatenlegs erhalten. Die erste
Version uebertraegt VFR-Routen; Zwischenflugplaetze erhalten damit keine eigene
Anflug-/Landungsprozedur. Ein exportierter Wegpunkt ist kein Missions-Task-Gate.

## Native Simulatoroperationen und Fehler

1. Route konvertieren und PlannedRoute-Listener beziehen.
2. `SAVE_EFB_ROUTE(route)`.
3. `SEND_ROUTE_TO_EFB(route)`.
4. `GET_EFB_ROUTE`: Start/Ziel, Koordinatenreihenfolge, VFR und Reiseflughoehe vergleichen.
5. Optional `SEND_ROUTE_TO_AVIONICS(route)` mit exakt derselben Route.

Jeder Schritt ist zeitlich begrenzt. MSFS-Readback bestaetigt nur den nativen
EFB-Flugplan. Avionik-Erfolg bedeutet "gesendet", keine unbewiesene FMS-Uebernahme.
Ein Avionikfehler behaelt den MSFS-Teilerfolg. Readback-Abweichung und Timeout
werden als "nicht bestaetigt" angezeigt. Statusmeldungen verschwinden nach 45 s.

Auftrags-ID, Ziel, Mission/Run, Hash, Host-/Paketkontext, Schritt, Dauer,
Teilergebnisse und Fehler gehen durch die bestehenden begrenzten Clientlogs.
Sitzungstoken/Keys werden nicht geloggt. Export-ID-Duplikate schreiben nicht erneut;
geaenderter Inhalt unter derselben ID wird abgewiesen. Im nativen Parent darf
nur ein Export gleichzeitig laufen. Nach unbekanntem Schreibtimeout bleibt die
native Exportbruecke gesperrt, weil eine zugrunde liegende Coherent-Operation noch
laufen kann; die Mission bleibt bedienbar. Keine automatischen Export-Retries.

Frame-/Channelwechsel, Pause, Schliessen und Missionswechsel sperren die folgenden
Schreibschritte. Bereits an den Simulator abgegebene Operationen lassen sich
nicht rueckwirkend atomar abbrechen. Der Host sendet fuer laufende Auftraege
beim Missionswechsel bzw. Unload ein Cancel und verwirft alte Antworten.

## Lokale Nachweise und SDK-Handoff

83 lokale Unit-/Regressionspruefungen plus 21 HTTP-Integrationstests bestanden.
Darunter vollstaendige Routen, keine Terrainhoehen als Flughoehe, Auth/Runbindung,
normaler Start ohne Export, Fehler ohne Startblocker, Host-/Channel-Gates,
Duplikate, Teilerfolg, Readback-Abweichung, Timeout ohne spaetere Folgeschritte,
Cancel und bestehende EFB-Reload-/Resume-Recovery. Der native Adapter wurde
transpiliert und gegen Simulator-Mocks ausgefuehrt; kein offizieller SDK-Typecheck.
Die Zusatzbuttons wurden in einem isolierten Electron-Fenster bei 440 px Breite
visuell geprueft, ohne horizontales Textoverflow. Das ist kein Coherent-/VR-Nachweis.
Ein vorhandener Toolbar-Collapse-Test scheiterte unabhaengig von dieser Funktion
an sichtbarer Headerhoehe; fuer den Button-Screenshot wurde nur die neue
Exportdarstellung geprueft, nicht dieser bestehende Gesamttest als bestanden gemeldet.

Der SDK-PC hat einen neueren EFB-/Toolbarstand (zuletzt 0.4.23 / Tracker v501)
als dieser lokale Checkout (EFB 0.4.13 / Tracker v410). Deshalb nur den
aufgabenspezifischen Patch und neue Module integrieren, keine alten Komplettdateien.
Neuen SDK-Paketstand und neue Tracker-Runtime bauen, Assets revisionieren, aktuelle
UI-/VR-/Recovery-Fixes erhalten. Keine Kanalumschaltung vor Simulator-Feldnachweis.

In MSFS pruefen: EFB und Toolbar jeweils separat; neue und alte Pakete;
Flughafenroute, eigene VFR-Punkte, Rundflug, fehlender Flugplatz; MSFS-Readback und
GPS/FMS-Anzeige; MSFS-only darf Avionik nicht explizit senden; Avionikfehler,
Timeout, Schliessen/Resume, Missionswechsel und parallele Fenster. Normaler
Missionsstart muss in jedem Fehlerfall regulär funktionieren. ATC-Anmeldung,
Autopilotmodus und Ruecksynchronisierung werden nicht automatisch ausgefuehrt.

Offizielle Grundlage:
[FlightPlanRouteManager](https://github.com/microsoft/msfs-avionics-mirror/blob/main/src/sdk/flightplan/FlightPlanRouteManager.ts),
[FlightPlanRoute](https://github.com/microsoft/msfs-avionics-mirror/blob/main/src/sdk/flightplan/FlightPlanRoute.ts).


## Alpha release 12.10.2026

User confirms the SDK candidate's positive simulator test and authorizes the
combined release with the UI fixes. Public tracker v523 integrates the SDK
flightplan source on the existing NAVCOM v522 source; the earlier SDK-only
v522 EXE is not published. EFB 0.4.24 contains the native EFB and toolbar bridge
from the unchanged tested SDK archive. Export remains gated by the native host
capability; failures report status without blocking mission start.
102 targeted tests and 24 HTTP tests pass. UI changes have local first-render
and silent-viewport tests; independent Coherent verification remains pending.


## Manual mission route transfer candidate (13.10.2026)

The Mission side menu exposes MSFS and MSFS-plus-avionics buttons after native
host readiness with an active mission run. Each click fetches the latest full
confirmed private tracker route using current navigation revision. No mission
intent is submitted. Concurrent exports are disabled; changed revision during
fetch rejects the send, changed revision before result prevents a stale success
message. Errors remain status-only. Avionics should be powered and booted first.
The deferred timing candidate is not included. These controls use the existing
0.4.24 native bridge, so no SDK-package changes are necessary. Not released.


Manual transfer is released on Alpha with Tracker v526 (13.10.2026),
integrated on v525. EFB 0.4.24 remains unchanged. All sends use the current
authenticated route export, with no mission start/restart intent. The separate
readback-settling candidate remains deferred.

## Weltkarten-Planung: Erfolgsmeldung (Tracker v585, 21.10.2026)

Nach bestaetigter Uebertragung an die Flugsicherung (`atc: confirmed`) ersetzt
der Planungsbanner seinen Knopf durch „Flugplan uebertragen – Der Flugplan
wurde erfolgreich an die Flugsicherung uebertragen. Du kannst den Flug jetzt
starten.“ Der Zustand gilt pro Lauf und Routen-Revision; eine Routenaenderung
bietet das Senden wieder an. Der Toolbar-Knopf „🗺️ Flugplan“ erscheint nach
der Uebertragung und holt den Senden-Knopf zurueck.
