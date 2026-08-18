# EFB- und Toolbar-Panel-Community-Packages und Rollout

## Entscheidung

Die MSFS-2024-EFB-App wird wie das Homebase Asset Pack als eigenständiges,
versioniertes Community-Package behandelt. Die Tracker-Desktop-App erkennt den
aktiven Community-Ordner, lädt nur unveränderliche GitHub-Release-Archive,
prüft Größe und SHA-256 und bietet Installation, Update, Reparatur sowie eine
auf den eigenen Paketordner begrenzte Deinstallation an.

Das EFB-Package folgt dem gewählten Tracker-Kanal. Alpha und Stable besitzen
getrennte Kanaldateien, installieren aber niemals zwei konkurrierende
Paketordner. Bei einer bereits vorhandenen Installation bietet der
Tracker-Desktop-Manager ein gefundenes Update per Dialog an. Ist die getrennte
EFB-Auto-Update-Option aktiviert, wird es stattdessen bei geschlossenem MSFS
automatisch installiert und nur als laufendes Statusbanner angezeigt. Die
Erstinstallation, Reparatur und Deinstallation bleiben ausdrückliche Aktionen.

Das geplante globale Toolbar-Panel wird zunaechst als zweites, getrennt
versioniertes Community-Package entwickelt. Es enthaelt nur Toolbar-
Registrierung, Icon, Coherent-Host/Lifecycle und eine kleine Offline-Shell; der
eigentliche Kartentisch wird wie beim EFB vom lokalen Tracker bereitgestellt.
Ein Panel-Fehler oder ein noch nicht bestaetigter MSFS-SDK-Vertrag darf weder
Installation noch Stable-Update des bestehenden EFB-Pakets beeinflussen.

## Paketvertrag

- Paketordner: `vfr-multitool-efb`
- EFB-Ausgabe: `html_ui/efb_ui/efb_apps/vfrmultitool/`
- Release-Tag: `efb-app-v<packageVersion>`
- Archiv: genau ein Root-Ordner `vfr-multitool-efb/`
- Kanaldateien: `ga-tracker-client/efb/channel/{alpha,stable}.json`

Das ZIP wird erst nach dem Build mit dem offiziellen MSFS-2024-SDK erzeugt.
`manifest.json`, `layout.json`, alle Layoutgrößen sowie der Archivhash werden
vor der Freigabe validiert.

`ga-tracker-client/efb-app/scripts/prepare-release.js` erzeugt aus dem fertigen
SDK-Paket das Archiv und eine Kanalvorlage. Dabei wird das Archiv nach der
Erzeugung erneut mit demselben sicheren Entpacker geprüft, den auch die
Desktop-App verwendet. Die Vorlage aktiviert den Online-Kanal nicht selbst;
das geschieht erst nach Upload des unveränderlichen GitHub-Release-Assets und
dem In-Sim-Test.

### Geplanter Toolbar-Panel-Paketvertrag

- Paketordner: vorlaeufig `vfr-multitool-toolbar-panel`
- Release-Tag: `toolbar-panel-v<packageVersion>`
- Archiv: genau ein Root-Ordner mit demselben Namen wie der Paketordner
- Kanaldateien: vorlaeufig
  `ga-tracker-client/toolbar-panel/channel/{alpha,stable}.json`
- gemeinsam mit dem EFB: tracker-gehostete Seite, Snapshots, Intents,
  Kartentisch-Komponenten und Tests des fachlichen Hostadapters
- panel-spezifisch: Toolbar-Registrierung, Icon, Fenster-/Detach-/Fokus-
  Lifecycle, Offline-Shell und Parent-Nachrichten

Ausgabepfad, Registrierungsdateien und PackageDefinition werden erst nach dem
TP0-Spike gegen das installierte MSFS-2024-SDK verbindlich festgeschrieben.
Vorher gibt es keinen aktiven Panel-Kanal und kein Desktop-Autoupdate.

## Aktueller Kanalstand

EFB 0.4.11 ist seit 2026-08-13 als Alpha-Release unter
`efb-app-v0.4.11` verfuegbar. Das mit dem offiziellen MSFS-2024-SDK 1.7.2
erzeugte Community-Paket wurde nach dem In-Sim-Test erneut von GitHub
heruntergeladen, entpackt und gegen Version, Paketstruktur, Groesse und
SHA-256 validiert. Seit 2026-08-17 zeigen Alpha und Stable auf genau dieses
unveraenderliche Archiv. Die Promotion verwendet dieselbe Release-URL,
Dateigroesse und SHA-256-Pruefsumme; sie erzeugt kein neues Paket und ersetzt
kein bestehendes Asset.

EFB 0.4.11 und Host 0.6.2 bauen auf dem 0.4.10/v347-In-Sim-Lauf auf, setzen
Mission Control auf zwei Drittel Breite, stabilisieren den Scroll gegen
Liveupdates, erhalten echte deutsche Umlaute und laden Custom-Listen direkt
aus dem bereits von der App genutzten GA-Sync in den lokalen Tracker-Cache.
Das vorherige Alpha-Artefakt 0.4.8/v345 bleibt als unveraenderlicher
Ruecksprungpunkt erhalten.

Tracker v370 im Alpha-Kanal verwendet View 7/Assetrevision 37001. Der
gemeinsame Kartentisch registriert jedes EFB- beziehungsweise spaetere
Toolbar-Fenster als kurzlebige Cockpit-Sitzung und zeigt im Audio-Menue
`Audio auf diesem Geraet abspielen`. Aktivierte Cockpit-Instanzen koennen eine
fertige zentrale Tracker-Ansage ueber dieselbe exklusive Playback-Lease
streamen. Im zweifach gegateten APT-Execution-Test zeigt derselbe Host nun auch
den Trackerzustand von Mission und Cargo und sendet revisionsgebundene Intents;
im Standard bleibt Mission Control read-only. Das ist ein tracker-gehostetes
Update und aendert weder das freigegebene EFB-0.4.11-Archiv noch dessen Alpha-/
Stable-Kanaldateien. Coherent-Playback, schreibende Mission Control und der
spaetere Toolbar-Host muessen vor einer breiteren Freigabe real im Simulator
getestet werden.

Der mit SDK 1.7.2 gebaute In-Sim-Prototyp 0.4.0 wurde wegen fehlender
Design-/Funktionsparitaet, nicht darstellbarer Zeichen und einer nur als
Entwicklungsmaske sichtbaren E6B-Ansicht verworfen und niemals in einen Kanal
eingetragen. 0.4.1 war der folgende korrigierte Source-Kandidat; Alpha blieb
bis zum freigegebenen 0.4.8-Build auf 0.3.5.

0.4.2 wurde zusammen mit Tracker v327 auf Windows gebaut und im Simulator
geprueft, aber nicht in den Alpha-Kanal eingetragen: Das originale HTML/CSS-
Grundgeruest erschien, die externe Kartentisch-Skriptkette initialisierte sich
in Coherent jedoch nicht. 0.4.3/v328 fuegte sequenziellen Scriptstart,
ausfallsicheres Schliessen sowie begrenzte lokale Boot-/Fehlerdiagnose hinzu
und lieferte damit den konkreten Parserbefund. Der unveraenderliche
0.3.5-Alpha-Release und der markierte 0.4.1-SDK-Fallback bleiben die
Ruecksprungpunkte.

Der 0.4.3-Test hat den lokalen Transport und Schliessen bestaetigt, aber zwei
konkrete Coherent-Parserfehler (`?.` und `...`) offengelegt. 0.4.4/v329 ist
deshalb der folgende SDK-Testkandidat. Seine tracker-gehosteten Map-, Werkzeug-
und E6B-Skripte sind durch ein Quellen-Gate frei von Optional Chaining,
Nullish Coalescing und Spread-Syntax. Die vererbten CSS-Anfragen nach
`bg.jpg` und `map.jpg` werden lokal beantwortet. 0.4.3 wird nicht in einen
Kanal eingetragen.

Der 0.4.4/v329-In-Sim-Test bestaetigt den Hoststart und die Kartendarstellung.
Die danach gefundenen Rechner-, E6B-, Zeichen- und Updateprobleme liegen
ausschliesslich in den tracker-gehosteten Assets. Tracker v330 liefert deren
korrigierten Hoststand 0.4.5; das bereits mit SDK 1.7.2 gebaute Community-
Paket 0.4.4 muss fuer diesen Test nicht neu gebaut oder neu installiert werden.

Der folgende Tracker v331 liefert Hoststand 0.4.6 mit Terrainprofil,
Wegpunktvorschau, verschieb-/schliessbaren Infoboxen und festen
Leaflet-Ebenen. Auch diese Aenderungen liegen ausschliesslich im lokalen
Tracker-Host. Das installierte Community-Paket 0.4.4 bleibt deshalb fuer den
v331-Windows-/In-Sim-Test unveraendert; ein neuer SDK-Build ist nicht noetig.

Tracker v332 liefert darauf Hoststand 0.4.7 mit stabiler Karten-Opacity,
Coherent-tauglicher E6B-Drehflaeche, skalierten Zeichenkoordinaten und einem
read-only Mission-/Checklistenmenue. Auch dieser Stand wird vollstaendig vom
lokalen Tracker-Host ausgeliefert. Das vorhandene Community-Paket 0.4.4 bleibt
fuer den v332-Test installiert; nur die Tracker-Runtime wird ersetzt.

Tracker v333 liefert Hoststand 0.4.8. Die bekannten Kartenquellen werden dabei
ueber den lokalen Tracker-Server und einen begrenzten RAM-Cache geladen; die
Web-App aktualisiert den Tracker-Snapshot unmittelbar nach ihrem vorhandenen
Terrainabruf. Beide Aenderungen liegen im Tracker-Host beziehungsweise in der
Web-App. Das installierte Community-Paket 0.4.4 bleibt auch fuer diesen Test
unveraendert; ein weiterer SDK-Build ist nicht erforderlich.

Tracker v334 liefert Hoststand 0.4.9 mit Coherent-tauglicher Aero-Beimischung,
freier Kopfzeile, kontrastreichem Layerdialog und erneutem Terrainprofil-
Trigger nach der Tracker-Geraeteuebergabe. Der ausgelieferte Code liegt erneut
vollstaendig im Tracker-Host beziehungsweise in der Web-App; das installierte
Community-Paket 0.4.4 muss fuer den v334-Test nicht neu gebaut werden.

Tracker v335 liefert Hoststand 0.5.0. Rasterkarten verwenden zuerst den im
nativen EFB funktionierenden direkten HTTPS-Pfad und erst bei Bedarf Backup
beziehungsweise lokalen Proxy. Der dazugehoerige lokale Webstand laeuft auf
privaten Entwicklungsadressen ohne Service Worker und muss
`ga-dispatcher-v1620 / NO SW` anzeigen; ein angezeigtes `v1603` ist ein alter,
fuer den Authority-/Terrain-Test ungeeigneter Cache. Das Community-Paket 0.4.4
bleibt auch fuer v335 unveraendert installiert.

Tracker v336 liefert Hoststand 0.5.1 mit dem Kartenkontrast des originalen
Kartentischs und einer begrenzten Authority-Kartenprojektion im Debuglog. Der
zugehoerige Webstand muss `ga-dispatcher-v1621` anzeigen: Er aktualisiert nach
Missionsstart die Route sofort und reicht das echte Terrainprofil nach dessen
vorhandenem asynchronem Abruf nach. Alpha `v1619` sowie Local `v1603 / NO SW`
koennen diesen Test nicht bestehen, weil ihnen diese Quelllogik fehlt. Das
installierte Community-Paket 0.4.4 bleibt auch fuer v336 unveraendert.

Tracker v343/Host 0.5.8 benoetigt erstmals wieder einen neuen Community-
Package-Kandidaten: EFB 0.4.5 macht die native Karte zum reduzierten
Tracker-aus-Fallback und wechselt bei `efb.web-client.v1` automatisch in die
tracker-gehostete App-Karte. Der offizielle SDK-1.7.2-Build war formal korrekt,
wurde nach dem In-Sim-Test aber verworfen: Ein Parent-Renderfehler entlud den
iframe im Sekundentakt wieder auf `about:blank`. EFB 0.4.6/Tracker v344 ist der
folgende Testkandidat. Er trennt Kernpoll und Parent-Rendering, toleriert zwei
kurze Kernpollaussetzer bei aktiver App-Karte und verhindert parallele Tracker-
Instanzen auf dem festen EFB-Port. Erst ein neuer offizieller SDK-Build samt
positivem In-Sim-Test darf als Paketarchiv oder Kanalstand verwendet werden.
0.4.4 bleibt bis dahin der Ruecksprungpunkt.

Der 0.4.6/v344-In-Sim-Test bestaetigte den stabilen automatischen Wechsel,
legte aber im Parent weiterhin den Coherent-Fehler `Array.flatMap is not a
function` offen. EFB 0.4.7/Tracker v345 ist deshalb der naechste gemeinsame
SDK-Testkandidat. Neben dem Parent-Fix bringt er die Layerauswahl der nativen
Fallback-Karte zurueck; die weiteren Werkzeug-, Kontext- und Datenquellen-
Feinarbeiten werden vom Tracker-Host 0.5.9 geliefert. Weder 0.4.7 noch v345
duerfen vor offiziellem SDK-Build und positivem In-Sim-Test in Alpha oder
Stable eingetragen werden.

Der folgende 0.4.7/v345-In-Sim-Test bestaetigte den stabilen Kandidaten. Als
einzige Parent-Abweichung blieb in der Fallback-Karte die `flight-strip` mit
"Aktuelle Position" sichtbar. EFB 0.4.8 entfernt diesen Streifen und benoetigt
wegen der kompilierten SCSS-Aenderung einen letzten offiziellen SDK-Build.
Dieser Build wurde mit SDK 1.7.2 erfolgreich erzeugt, formal validiert und am
13.08.2026 im Simulator freigegeben. Karte, Route beziehungsweise letzte
Position und Layerauswahl bleiben im Fallback sichtbar; der Positionsstreifen
ist ausgeblendet und der automatische Wechsel zu Host 0.5.9 funktioniert.
Tracker v345 bleibt das dazu freigegebene unveraenderliche Tracker-Artefakt.

## Erste Transportstufe

Tracker v323 stellt eine read-only API ausschließlich auf
`http://127.0.0.1:49880/api/v1/` bereit. Der versionierte Handshake meldet nur
`tracker.status.v1` und `flight.snapshot.v1`. Zugangsdaten, Pilot-PIN und
schreibende Missionsbefehle werden nicht über diesen Endpunkt ausgegeben.

Tracker v324 und EFB 0.2.0 ergänzen `mission.snapshot.v1`. Ausgegeben werden
nur Mission-ID, Lifecycle-State, Runtime-Phase und lokale Szenenzahl, die der
Tracker bereits für den bestehenden Web-/Relay-Ablauf führt. Missionsbriefing,
Route und Manifest werden bewusst noch nicht durch das externe Relay
transportiert. Reichere Inhalte benötigen zuerst einen getrennt abgesicherten
lokalen Datenpfad.

Der erste Toolbar-Panel-Spike verwendet ebenfalls nur diese read-only
Loopback-Projektion und die tracker-gehostete Seite. Schreibende EFB- und
Panel-Aktionen werden erst spaeter mit eigener Capability, kurzlebiger Sitzung,
erwarteter Mission-Revision, idempotenter `commandId` und expliziter
Eingabevalidierung ergaenzt. CommBus bleibt als native MSFS-Transportoption
vorgesehen, ist aber keine Voraussetzung fuer den ersten PC-Alpha-Test.
