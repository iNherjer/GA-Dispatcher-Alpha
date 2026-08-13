# VFR Multitool EFB App

Dieses Verzeichnis enthält das MSFS-2024-SDK-Projekt für die schlanke
EFB-Oberfläche. Die App liest ausschließlich Status, Flugtelemetrie sowie
technische Missions- und Kartensnapshots vom lokal laufenden Tracker auf
`127.0.0.1:49880`.

## Tracker-gehosteter Kartentisch und Fallback-Karte 0.4.9

Tracker v330 bietet additiv `efb.web-client.v1` und die read-only Seite
`http://127.0.0.1:49880/efb/v1/` an. Meldet der Tracker diese Capability,
wechselt das EFB automatisch in die App-Karte. Die Seite verwendet den originalen
Kartentisch-DOM, die App-Styles, Leaflet, Stoppuhr, Rechner und den
vollstaendigen interaktiven E6B. Ein kleiner Hostadapter versorgt Flugzeug,
Route, Missionsgeometrie, Navigation, Kompass und Planprofil aus den lokalen
Tracker-Snapshots. Die reine Diagnoseprobe bleibt unter `/efb/v1/probe/`.

`map.js`, `profile.js`, Cloud-Sync und die Web-Missionsruntime werden nicht in
den Tracker geladen. Fehlt die Capability, erscheint ausschliesslich die
native Fallback-Karte mit Basiskarte/Aero-Overlay, letzter Route und letzter
Position. Positionsbanner, Kompass, Profil, Werkzeuge und Statusnavigation
sind im Fallback verborgen. Die vom Windows-
Tracker benoetigten Originalassets werden mit `sync-efb-web-assets.js` in ein
versioniertes, von `pkg` sicher einbettbares Bundle gespiegelt.

0.4.6 behebt den im 0.4.5-In-Sim-Test gefundenen Umschaltzyklus: Kernpoll,
optionale Snapshots und Parent-Darstellung besitzen getrennte Fehlerpfade.
Ein Darstellungsfehler kann den bereits gestarteten Host-iframe nicht mehr auf
`about:blank` zuruecksetzen. Bei aktiver App-Karte werden ein oder zwei kurze
Kernpollaussetzer toleriert und ueber den begrenzten Client-Diagnoseendpunkt
gemeldet; erst der dritte aufeinanderfolgende Ausfall aktiviert die native
Fallback-Karte.

0.4.7 entfernt den im 0.4.6-Test geloggten Coherent-Renderfehler durch eine
Profilwertschleife ohne `Array.flatMap`. Die weiterhin minimale Fallback-Karte
zeigt wieder ihren Basiskarten-/Layerdialog; Follow, Kompass, Profil und
Werkzeuge bleiben dort verborgen. Tracker v345/Host 0.5.9 liefert die
Darstellungsfeinarbeiten und nutzt fuer den Punktkontext primaer die gehostete
GA Aviation DB mit regionalem OpenAIP-Proxy als Fallback.

0.4.8 ist der abschliessende Parent-Fix fuer den Alpha-Kandidaten: Die im
0.4.7-In-Sim-Test noch sichtbare `flight-strip` mit "Aktuelle Position" wird
in der Tracker-aus-Fallback-Karte ebenfalls ausgeblendet. Basiskarte,
Layerauswahl, Route und Flugzeugposition bleiben sichtbar. Tracker v345 und
der tracker-gehostete Hoststand 0.5.9 bleiben unveraendert.

0.4.9 ist der folgende, noch unveroeffentlichte Testkandidat fuer Tracker v346
und Host 0.6.0. Im EFB ist ausschliesslich das Modern-Design aktiv; der
Designschalter entfaellt. Checklisten verwenden quadratische, explizit
gebundene Schaltflaechen. Eigene Listen kommen aus der begrenzten lokalen
Tracker-Persistenz unter `/api/v1/checklists`; ihr Abhakfortschritt bleibt
lokal im EFB. Mission Control rendert eine begrenzte read-only Projektion des
App-Missionsmenues aus `/api/v1/mission`.

Der Windows-/In-Sim-Test von 0.4.2 lud das HTML/CSS-Grundgeruest, aber nicht
die externe Host-Skriptkette. 0.4.3 legt deshalb einen kleinen
ES5-kompatiblen Inline-Bootstrap vor Leaflet und Hostadapter. Er stellt den
Schliessen-Pfad sofort bereit, laedt die grossen Skripte danach in fester
Reihenfolge und meldet technische Bootstufen ueber
`efb.client-diagnostics.v1` an den begrenzten lokalen Endpunkt
`POST /api/v1/client-log`. Diese Diagnose kann weder Missionen noch
SimConnect-Werte veraendern. iframe-Nachrichten tragen zusaetzlich einen
zufaelligen Sitzungs-Channel, damit Coherent-Schliessen auch bei einem
unvollstaendigen `MessageEvent.source` sicher dem richtigen View zugeordnet
werden kann.

Der 0.4.3-In-Sim-Log bestaetigte diese Ladekette, zeigte aber Parserabbrueche
an Optional Chaining und Object Spread. 0.4.4 entfernt `?.`, `??` und
Spread-Syntax aus allen tracker-gehosteten Map-, Werkzeug- und E6B-Skripten.
Ein automatischer Quellentest verhindert deren Wiedereinfuehrung; kleine
Polyfills im fruehen Bootstrap decken fehlende Browsermethoden ab. Die
Tracker-Debugdatei rotiert ab v329 bei 8 MiB und reduziert auch bereits
uebergrosse Altdateien beim ersten neuen Eintrag auf einen kleinen Tail.

Der 0.4.4/v329-In-Sim-Test bestaetigte den vollstaendigen Hoststart, zeigte
aber fehlende Coherent-Methoden in Rechner (`String.trimEnd`) und E6B
(`Array.flatMap`) sowie fehlendes Freihandzeichnen. Der mit Tracker v330
ausgelieferte Hoststand 0.4.5 ergaenzt diese Runtime-Fallbacks auch im getrennten
E6B-iframe, meldet dessen Boot/JSON-Zustand, implementiert PEN/DEL/CLR und
entprellt unveraenderte Parent-, Routen- und Markerupdates. Das installierte
Community-Paket bleibt dabei Version 0.4.4; fuer v330 ist kein neuer SDK-Build
notwendig.

## Karten- und Werkzeugbasis 0.4.1

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

0.4.1 ersetzt den nach dem In-Sim-Test verworfenen 0.4.0-Werkzeugprototyp und
erweitert den freigegebenen K0-Stand in den Sources. Tracker v326
liefert ueber `/api/v1/map` einen begrenzten `map.snapshot.v1` mit Route,
Wegpunkten, Live-Navigation, Missionsziel/POI-Kette und einem Planprofil. Das
EFB zeichnet Route, Missionsgeometrie, Hoehenband und Kompass selbst. Ohne die
neue Capability bleibt die bisherige Karte funktionsfaehig.

Bis 0.4.8 uebernahm die App mehrere Designrichtungen. Ab 0.4.9 wird fuer das
EFB nur noch der moderne Kartentisch-Stil verwendet; alte gespeicherte Theme-
Werte werden beim Lesen darauf normalisiert. Einklappbare Menueleiste,
Profil-Sichtbarkeit, Layer und Follow werden nur lokal gespeichert. Uhr mit
Stoppuhr und der Rechner laufen lokal und verwenden die Geraetedarstellung des
Web-Kartentischs. Der bestehende E6B wird nicht als statische Formularmaske
nachgebaut: Beim Build werden die originalen Front- und Windscheiben sowie die
vorhandene Drag-, Dreh-, Flip- und Zoom-Logik unter `Assets/E6B` mitgebuendelt.
`e6b-flight-computer-efb.html` erzwingt den Embedded-Coherent-Modus und
`e6b-efb-disc-data.js` stellt beide Scheiben ohne Fetch-Abhaengigkeit bereit.
Es gibt dafuer keinen externen Serverzugriff. Das erste Hoehenband zeigt den geplanten
Routenverlauf und bekannte Endpunkt-Hoehen. Ein echtes Terrainprofil wird erst
nach einem eigenen versionierten Tracker-Datenprodukt freigeschaltet.

EFB 0.4.0 wurde mit SDK 1.7.2 erfolgreich gebaut, aber nicht freigegeben. Im
Simulator wich die Shell sichtbar vom Web-Kartentisch ab, Unicode-Piktogramme
wurden teilweise nicht dargestellt und der E6B zeigte wegen eines nicht
aktivierten Embedded-Modus nur seine Entwicklungsmaske. 0.4.1 verwendet fuer
kritische EFB-Geometrie explizite, Coherent-vertraegliche CSS-Eigenschaften und
ASCII-sichere Controls.

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
- `html_ui\efb_ui\efb_apps\vfrmultitool\Assets\E6B\e6b-flight-computer-efb.html`
- `html_ui\efb_ui\efb_apps\vfrmultitool\Assets\E6B\e6b-efb-disc-data.js`

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
