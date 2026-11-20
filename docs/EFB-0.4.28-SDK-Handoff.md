# EFB-/Toolbar-Paket 0.4.28 – Übergabe für den offiziellen Windows-SDK-Bau

Stand 20.11.2026: gebaut, veröffentlicht und im Alpha-Kanal aktiviert (siehe „Ergebnis“). Kein Simulatortest.

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

## Ergebnis (20.11.2026)

- Windows-SDK-Bau von Quellcommit `2ac55247f`: MSFS-2024-SDK 1.7.2, JS-SDK 2.1.1,
  `fspackagetool -forcesteam -rebuild -nopause`, Exitcode 0; App-Build, `tsc --noEmit` und 76 Tests bestanden.
  SDK-Deklarationen bestätigen `RegisterViewListener(...).on`, `FacilityLoader.getFacility(IcaoValue)` und
  `ICAO.getFacilityTypeFromValue`; `REQUEST_AVIONICS_ROUTE` liefert eine numerische Request-ID.
- 22 Layout-Einträge, 21 Kopien, 24 ZIP-Dateien geprüft (Pfadtrenner Backslash wie 0.4.27).
- Gegenprüfung auf dem Mac: beide Brückenmodule im ZIP byte-gleich mit `2ac55247f`
  (`flightplan-bridge-core.js` `556e2f2f…`, `native-flightplan-bridge.js` `b5b72ff4…`), EFB-Bundle enthält
  `REQUEST_AVIONICS_ROUTE`, `AvionicsRouteRequestResponse`, `ga-flightplan-fetch`, `getFacilityTypeFromValue`.
- Release `efb-app-v0.4.28`, `vfr-multitool-efb-0.4.28.zip` 461998 Bytes, SHA-256
  `4dbe51019a708246b2ff1ad68e5b533cc835593306f0ff863b3dccf394c6b088`; öffentlicher Download geprüft.
- `ga-tracker-client/efb/channel/alpha.json` auf 0.4.28 aktiviert, `stable.json` unverändert (0.4.27).
