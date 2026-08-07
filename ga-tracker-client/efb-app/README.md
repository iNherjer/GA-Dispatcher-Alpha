# VFR Multitool EFB App

Dieses Verzeichnis enthält das MSFS-2024-SDK-Projekt für die schlanke
EFB-Oberfläche. Die erste Alpha-Stufe liest ausschließlich Status und
Flugtelemetrie vom lokal laufenden Tracker auf `127.0.0.1:49880`.

## SDK-Eingaben

`efb_api` und eine gegebenenfalls lokal mitgelieferte Microsoft-MSFS-SDK-
Abhängigkeit werden nicht im Repository dupliziert. Zuerst muss im offiziellen
`PackageSources\efb_api` einmal `npm install` ausgeführt werden, damit dessen
`dist` entsteht. Danach übernimmt das Hilfsskript die Abhängigkeiten aus der
offiziell installierten `TemplateApp` passend zur lokalen SDK-Version:

```powershell
cd "C:\MSFS 2024 SDK\Samples\DevmodeProjects\EFB\PackageSources\efb_api"
npm install
cd "C:\Pfad\zum\Repository\ga-tracker-client\efb-app"
node scripts/prepare-sdk-inputs.js "C:\MSFS 2024 SDK\Samples\DevmodeProjects\EFB"
cd PackageSources\VfrMultitool
npm install
npm run typecheck
npm run build
```

Danach wird `VfrMultitoolEfbProject.xml` mit dem offiziellen Package Tool oder
im Project Editor gebaut. Das fertige Paket liegt unter
`Packages\vfr-multitool-efb` und enthält insbesondere:

- `manifest.json`
- `layout.json`
- `html_ui\efb_ui\efb_apps\vfrmultitool\VfrMultitool.js`
- `html_ui\efb_ui\efb_apps\vfrmultitool\VfrMultitool.css`

Erst dieses SDK-gebaute Paket wird als ZIP veröffentlicht. Ein Source-Ordner
oder ein ungeprüfter Handbau darf nicht in den Updatekanal eingetragen werden.

## Release vorbereiten

Nach dem In-Sim-Test erzeugt der folgende Schritt das Archiv, entpackt und
validiert es erneut und schreibt eine noch nicht aktive Kanalvorlage:

```powershell
node scripts/prepare-release.js alpha
```

Die Dateien liegen anschließend im ignorierten Verzeichnis `release-output`.
Das ZIP wird unter dem ausgegebenen unveränderlichen Tag als GitHub-Release-
Asset hochgeladen. Erst danach wird die erzeugte `alpha.json` bewusst nach
`ga-tracker-client/efb/channel/alpha.json` übernommen und veröffentlicht.
Stable wird später auf exakt dasselbe getestete Release-Artefakt gesetzt.
