# VFR Multitool EFB App

Dieses Verzeichnis enthält das MSFS-2024-SDK-Projekt für die schlanke
EFB-Oberfläche. Die App liest ausschließlich Status, Flugtelemetrie sowie
technische Missions- und Kartensnapshots vom lokal laufenden Tracker auf
`127.0.0.1:49880`.

## Karten- und Werkzeugkandidat 0.4.0

Die Kartenansicht ist die Standardseite und nutzt das im Hauptprojekt
versionierte Leaflet. Standardmäßig sind die beschriftete OpenTopoMap sowie das
VFR-/Aero-Overlay aktiv. Pan, Zoom, Auto-Follow, ein richtungsabhängiger
Flugzeugmarker und die bisherige Statusseite sind enthalten. Alternative
Basiskarten sowie DFS-, FAA- und DWD-Overlays werden erst nach expliziter
Auswahl geladen.

Die Online-Kartenanbieter erhalten technisch notwendige Tile-Anfragen mit
IP-Adresse, Zeit, Zoomstufe und Kachelkoordinaten. Der EFB-Client sendet dabei
keine Pilot-, Missions- oder Tracker-Zugangsdaten. Die Layerauswahl wird nur
lokal im EFB gespeichert; Kartenkacheln werden nicht als eigenes Offlinepaket
verteilt.

0.3.5 verwendet fuer Karten- und Statusflaeche bewusst app-spezifische
CSS-Klassen und initialisiert Leaflet erst nach `AppView.onAfterRender`. Die
Vollflaechen verwenden explizite `top`-/`left`-Positionen sowie Breite und
Hoehe. Leaflet startet erst, nachdem der Host eine messbare Layoutgroesse
besitzt. Die schwebenden Kartenbedienelemente liegen in einer eigenen
Pointer-Overlay-Ebene oberhalb des Leaflet-Hosts: freie Kartenbereiche bleiben
fuer Pan und Zoom durchlaessig, Buttons und der geoeffnete Layerdialog nehmen
Eingaben selbst an. Ein verbleibender Leaflet-Fehler wird sichtbar in der App
und mit Praefix `[VFR Multitool EFB]` im EFB-Debugger ausgegeben.

Native JSX-Buttons verwenden bewusst kein `onClick`-Attribut. Die in SDK 1.7.2
enthaltene `FSComponent`-Version registriert damit keinen DOM-Listener, sondern
schreibt unbekannte Props nur als HTML-Attribute. Deshalb bindet die App Karte,
Status, Layer, Follow und die Layerauswahl erst in `onAfterRender` direkt ueber
`HTMLButtonElement.onclick`. Das entspricht dem Bindungsweg des offiziellen
EFB-`Button`, behaelt aber die app-spezifischen Kartenstyles bei.

Bei aktivem VFR-/Aero-Overlay reduziert 0.3.5 die Deckkraft der Basiskarte wie
der Web-Kartentisch auf 50 Prozent. Flugzeugsilhouette, Standardfarbe
`#f2c12e`, Groesse 40 px und Drehachse entsprechen ebenfalls dem Web-
Kartentisch. Die Missionsanzeige entprellt einen anfaenglich leeren Snapshot
und behaelt einen zuletzt bestaetigten Stand fuer bis zu 12 Sekunden, wenn der
Tracker dazwischen `available:false` liefert. Gueltige neue oder terminale
Snapshots werden weiterhin sofort dargestellt; Missionsphasen werden im EFB
weder erzeugt noch veraendert.

0.4.0 erweitert diesen freigegebenen K0-Stand in den Sources. Tracker v326
liefert ueber `/api/v1/map` einen begrenzten `map.snapshot.v1` mit Route,
Wegpunkten, Live-Navigation, Missionsziel/POI-Kette und einem Planprofil. Das
EFB zeichnet Route, Missionsgeometrie, Hoehenband und Kompass selbst. Ohne die
neue Capability bleibt die bisherige Karte funktionsfaehig.

Die App uebernimmt die Designrichtungen Classic, Retro, NAV/COM, OPS 1940 und
Windows 95 als kompakte EFB-Themes. Design, einklappbare Menueleiste,
Profil-Sichtbarkeit, Layer und Follow werden nur lokal gespeichert. Uhr mit
Stoppuhr und der Rechner laufen lokal. Der bestehende E6B wird beim Build unter
`Assets/E6B` mitgebuendelt und im Werkzeugfenster geladen; es gibt dafuer
keinen externen Serverzugriff. Das erste Hoehenband zeigt den geplanten
Routenverlauf und bekannte Endpunkt-Hoehen. Ein echtes Terrainprofil wird erst
nach einem eigenen versionierten Tracker-Datenprodukt freigeschaltet.

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

0.3.5 wurde am 10.08.2026 nach dem SDK- und In-Sim-Test als Alpha-Release
`efb-app-v0.3.5` veroeffentlicht. Das Remote-Archiv ist 86.714 Bytes gross und
hat SHA-256
`c08566a59a22abba803370abd9d0480d80642e8a2a0175e48897d354946446b2`.
Der Stable-Kanal bleibt fuer eine spaetere, artefaktgleiche Promotion gesperrt.
