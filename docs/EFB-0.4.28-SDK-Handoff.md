# EFB-/Toolbar-Paket 0.4.28 – Übergabe für den offiziellen Windows-SDK-Bau

Stand 19.11.2026, Quelle auf `origin/main` (Commit siehe Release Queue). Noch kein SDK-Build,
keine Veröffentlichung, kein Simulatortest.

## Was sich im Paket ändert

Nur die beiden gemeinsamen Brückenmodule, jeweils identisch in EFB-App und Toolbar-Panel:

- `ga-tracker-client/efb-app/flightplan-bridge-core.js`
  = `ga-tracker-client/toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/flightplan-bridge-core.js`
- `ga-tracker-client/efb-app/native-flightplan-bridge.js`
  = `ga-tracker-client/toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/native-flightplan-bridge.js`

Neu: Route aus EFB-Planung, Flugsicherung und Avionik lesen (`ga-flightplan-fetch`), siehe
`docs/MSFS Flight Plan Transfer.md` Abschnitt 19.11.2026. `FlightPlanBridge.ts` und
`VfrMultitool.tsx` bleiben unverändert (übergeben bereits `sdk` und `registerViewListener`).
Version: `PackageDefinitions/vfr-multitool-efb.xml` und `package.json`/`package-lock.json`
auf 0.4.28.

## SDK-Punkte, die nur der echte Build/Typecheck klärt

- `RegisterViewListener(...)` liefert einen ViewListener mit `on(name, handler)`; die Brücke
  registriert `AvionicsRouteSync` und `AvionicsRouteRequestResponse` nur, wenn `on` existiert.
- `listener.call('REQUEST_AVIONICS_ROUTE')` liefert die Request-ID (Zahl).
- `FacilityLoader.getFacility(type, icaoValue)` mit `IcaoValue` (JS_ICAO); Typ über
  `ICAO.getFacilityTypeFromValue`, sonst `FacilityType[Airport|VOR|NDB|Intersection|USR|RWY|VIS]`.
- Keine neuen Syntaxformen (kein Objekt-Spread, kein `?.`/`??` in den Brückenmodulen);
  `tracker-efb-asset-syntax.test.js` und die Brückentests bestehen lokal.

## Bauen und prüfen

1. Ablauf `docs/EFB-Community-Package.md` / `docs/github-push-workflow.md` 3c (Project Editor
   bzw. Package Tool, `node ga-tracker-client/efb-app/scripts/prepare-release.js alpha`).
2. Gegenprüfung: Im Archiv müssen die beiden Module byte-gleich zum Quellstand sein.
3. Benötigt Tracker v651 oder neuer (Host zeigt die Holen-Knöpfe nur bei `fetch: true`).
   Älterer Tracker + neues Paket: Holen-Knöpfe fehlen, Senden funktioniert wie bisher.
   Neuer Tracker + altes Paket: dasselbe.

## Im Simulator prüfen

- EFB und Toolbar getrennt: Reiter „Mission“ ohne Mission → Block „Flugplan“.
- Holen aus EFB-Planung mit Flugplatz, VOR, Intersection, eigenem Punkt, Airway, SID/STAR.
- Senden an Flugsicherung, danach „von Flugsicherung holen“.
- Avionik: G1000 NXi/G3000/GNS mit Flugplan, dann ohne; Meldung bei fehlender Antwort.
- Übernehmen ersetzt die Route in EFB, Toolbar und Web-App; Verwerfen ändert nichts.
- Während einer Mission: Holen gesperrt, Senden wie bisher.
