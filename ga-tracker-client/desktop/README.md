# VFR Multitool Tracker Desktop

Die Desktop-App ist ein kleiner Windows-Bootstrapper fuer die bestehende
Tracker-Engine. Der Installer enthaelt keine Tracker-EXE. Beim ersten Start wird
standardmaessig die aktuelle Stable-Engine geladen, gegen Dateigroesse und
SHA-256 geprueft und als separater Hintergrundprozess gestartet. Im Fenster kann
zwischen `Stable` und `Alpha` gewechselt werden.

## Funktionen

- kleines Statusfenster und Windows-Tray
- eigenes Tracker-Icon fuer Tray, Taskleiste und Windows-Installer
- Pilot-ID/PIN-Pruefung ueber den bestehenden Auth-Endpunkt
- Download, Pruefung, Update und Start/Stopp der Tracker-Engine
- umschaltbare Tracker-Kanaele `Stable` und `Alpha`
- getrennte Runtime-Verzeichnisse fuer sicheren Rueckwechsel auf Stable
- vorherige gepruefte Engine als lokaler Rueckfall
- Tracker-Engine startet standardmaessig automatisch nach der Updatepruefung
- optionaler unsichtbarer Start direkt ins Windows-Tray
- Relay-, SimConnect- und Telemetrie-Status aus dem Tracker-Protokoll
- Updateeinstellung `ask` oder `automatic`
- getrennte Auto-Update-Einstellungen fuer Tracker, Homebase Assets, EFB und Bridge
- bei Updates vorhandener Installationen: `Nur dieses Mal`, `Kuenftig automatisch` oder `Spaeter`
- Updateinstallation vor dem Trackerstart, nicht waehrend eines Flugs
- kompakte Status-/Startleiste und standardmaessig geschlossene Modulbereiche
- Homebase Asset Pack installieren, aktualisieren, reparieren und deinstallieren
- MSFS-2024-EFB-App passend zum gewählten Tracker-Kanal installieren,
  aktualisieren, reparieren und isoliert deinstallieren
- optionale AccuSim-DRSM-Bridge erkennen, sicher aus dem öffentlichen GitHub-
  Release installieren und im Hintergrund starten/stoppen
- vollständige Bridge-Einstellungen aus dem Tracker öffnen, ohne eine zweite
  Telemetrieinstanz oder einen zweiten UDP-Sender zu erzeugen

Persoenliche Tracker-/Homebase-Daten bleiben unter
`Dokumente/VFR Multitool/Tracker`. Programmzustand, geladene Tracker-Versionen und
Asset-Downloadcaches liegen dagegen unter `%LOCALAPPDATA%/VFR Multitool`.
Stable behaelt aus Kompatibilitaetsgruenden den bisherigen Runtime-Pfad
`Tracker`; Alpha verwendet den separaten Pfad `Tracker Alpha`. Ein Wechsel
beendet einen laufenden Tracker kontrolliert, bereitet den Zielkanal vor und
startet ihn danach wieder. Die jeweils andere Runtime bleibt unveraendert.
Pilot-ID und PIN werden vor dem Speichern am Auth-Endpunkt geprueft. Die PIN wird
mit Electrons `safeStorage`/Windows DPAPI geschuetzt in LocalAppData gespeichert
und nur ueber eine lokale Prozess-Pipe an die Engine uebergeben. Sie steht weder
im Dokumente-Ordner noch in der Prozessumgebung.

Eine vorhandene Klartext-PIN in `tracker-config.json` wird erst nach erfolgreicher
Online-Pruefung und sicherer Migration entfernt. Homebase-Fallback,
Diagnoseinformationen und andere fremde Konfigurationsfelder bleiben dabei
erhalten.

`Tracker automatisch starten` ist standardmaessig aktiv. `Minimiert im Tray
starten` ist optional und wird erst beim naechsten Programmstart wirksam. Fehlen
Pilot-ID oder PIN oder ist eine Updateentscheidung beziehungsweise erneute
Anmeldung erforderlich, wird das Fenster trotz Tray-Start eingeblendet. Dadurch
kann die installierte App gefahrlos ueber die normalen Windows-Autostartoptionen
gestartet werden.

## Entwicklung

```bash
cd ga-tracker-client/desktop
npm install
npm test
npm start
```

Im Entwicklungsmodus wird `../tracker.js` ueber Electrons Node-Laufzeit gestartet.
Im installierten Windows-Build wird die separat geladene Runtime aus LocalAppData
als Hintergrundprozess verwendet.

Fuer isolierte UI-Tests kann ein leerer Datenordner vorgegeben werden:

```bash
VFR_MULTITOOL_DOCUMENTS_DIR=/tmp/vfr-tracker-ui npm start
```

## Windows-Build

Vor dem Desktop-Build muss der Tracker-Kanal auf ein vorhandenes, geprueftes
origin-Release zeigen:

```bash
cd ga-tracker-client
npm run build:tracker
cd desktop
npm run build:win
```

Ausgabe:

- `dist/VFR-Multitool-Tracker-Setup-<version>.exe`
- `dist/latest.yml`
- Updatepakete und Blockmaps fuer `electron-updater`

Anschliessend erzeugt

```bash
npm run prepare:channel
```

aus `dist/latest.yml` den Stable-Zeiger
`../channel/desktop/latest.yml` mit absoluten URLs auf den unveraenderlichen
GitHub-Release `tracker-desktop-v<version>`. Dieses Kommando ist ein
Release-Schritt und soll erst nach dem finalen Build ausgefuehrt werden.
Mit `npm run prepare:channel -- --dry-run` kann die Metadatenpruefung erfolgen,
ohne den Stable-Zeiger zu schreiben.

Der Installer arbeitet pro Benutzer und benoetigt standardmaessig keine
Administratorrechte.

## AccuSim-DRSM-Bridge

Der Tracker erkennt vorhandene per-user-Installationen über den Windows-
Uninstall-Eintrag und die Standardpfade unter `%LOCALAPPDATA%/Programs`. Die
installierte Version wird aus dem Registry-Eintrag beziehungsweise den Windows-
Dateiinformationen gelesen. Eine laufende Bridge meldet zusätzlich ihre Version,
den SimConnect-/UDP-Status und die Version des lokalen Steuerprotokolls selbst.

Bridge-Versionen vor `1.12.0` werden weiterhin als vorhandene Installation
erkannt und können über `Einstellungen` normal geöffnet werden. Für den echten
fensterlosen Tracker-Modus ist einmalig mindestens Bridge `1.12.0` erforderlich.
Danach bleiben normale Bridge-Auto-Updates kompatibel: Installationspfad und
Konfiguration bleiben erhalten, und der Tracker übernimmt die jeweils von der
laufenden Bridge gemeldete neue App-Version.

Der Tracker lädt den kleinen Bridge-Webinstaller aus dem aktuellen stabilen
GitHub-Release. Dateiname, unveränderliche Release-URL, Dateigröße und die von
GitHub veröffentlichte SHA-256-Prüfsumme werden vor dem Öffnen geprüft. Die
eigentliche Installation bleibt eine sichtbare, vom Benutzer bestätigte Aktion.

## Updatekanal

Die Tracker-Runtime liest je nach Auswahl einen dieser Kanaele:

`ga-tracker-client/channel/stable.json`

`ga-tracker-client/channel/alpha.json`

Neue Runtime-Releases werden zuerst ueber `alpha.json` an Tester verteilt. Nach
erfolgreicher Erprobung wird dasselbe unveraenderliche Release-Artefakt durch
Anpassen von `stable.json` freigegeben. Stable ist die Voreinstellung; bestehende
Desktop-Konfigurationen ohne Kanalangabe bleiben dadurch rueckwaertskompatibel.

Der spaetere Selbst-Updater des Bootstrapprogramms verwendet den generischen
Desktop-Kanal:

`ga-tracker-client/channel/desktop/`

Bei einer Veroeffentlichung werden `latest.yml`, Installer und Blockmap zuerst
als unveraenderliche Release-Artefakte hochgeladen. Erst danach darf der
produktive Kanal auf diesen Release zeigen. Die Release-Artefakte sollten
Authenticode-signiert werden, sobald ein oeffentlich vertrauenswuerdiges
Code-Signing-Zertifikat vorhanden ist.

`electron-builder` kann ein spaeteres Authenticode-Zertifikat ueber seine
Signing-Konfiguration beziehungsweise die dafuer vorgesehenen CI-Secrets
verwenden. Dabei muessen sowohl die separat veroeffentlichte Tracker-Runtime als
auch Desktop-App und Installer signiert und mit Zeitstempel versehen werden.

Ohne ein solches Zertifikat bleibt der Installer technisch nutzbar, Windows kann
aber wie bei der bisherigen portablen EXE eine SmartScreen-Warnung anzeigen.

## MSFS-2024-EFB-Paket

Die EFB-App ist ein eigenes Community-Package mit den getrennten Kanälen
`ga-tracker-client/efb/channel/alpha.json` und `stable.json`. Der Paketmanager
verwendet automatisch denselben Kanal wie die Tracker-Runtime. Bei vorhandenen
Installationen werden Updates angeboten oder mit aktivierter EFB-Automatik bei
geschlossenem Simulator direkt installiert. Erstinstallation, Reparatur und
Deinstallation benötigen weiterhin eine ausdrückliche Bestätigung.

Vor der Aktivierung eines Kanalzeigers prüft die Release-Pipeline das vom
offiziellen MSFS-2024-SDK gebaute Package, dessen `manifest.json`, `layout.json`,
Dateigrößen, ZIP-Struktur und SHA-256. Die Deinstallation ist auf den eigenen
Ordner `vfr-multitool-efb` begrenzt.
