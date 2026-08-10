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
