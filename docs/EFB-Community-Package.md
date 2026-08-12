# EFB Community Package und Rollout

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

## Aktueller Alpha-Stand

EFB 0.3.5 ist seit 2026-08-10 als Alpha-Release unter
`efb-app-v0.3.5` verfuegbar. Das mit dem offiziellen MSFS-2024-SDK 1.7.2
erzeugte Community-Paket wurde nach dem In-Sim-Test erneut heruntergeladen,
entpackt und gegen Version, Paketstruktur, Groesse und SHA-256 validiert. Der
Alpha-Kanal zeigt auf genau dieses unveraenderliche Archiv. Stable bleibt bis
zur getrennten Promotion deaktiviert.

Der mit SDK 1.7.2 gebaute In-Sim-Prototyp 0.4.0 wurde wegen fehlender
Design-/Funktionsparitaet, nicht darstellbarer Zeichen und einer nur als
Entwicklungsmaske sichtbaren E6B-Ansicht verworfen und niemals in einen Kanal
eingetragen. 0.4.1 ist der korrigierte Source-Kandidat. Alpha bleibt bis zu
offiziellem SDK-Build sowie bestandenem 2D-/physischem In-Sim-Test auf 0.3.5.

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

Schreibende EFB-Aktionen werden erst später mit eigener Capability,
kurzlebiger Sitzung und expliziter Eingabevalidierung ergänzt. CommBus bleibt
als native MSFS-Transportoption vorgesehen, ist aber keine Voraussetzung für
den ersten PC-Alpha-Test.
