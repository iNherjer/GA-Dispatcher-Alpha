# VFR Multitool Tracker Desktop

Die Desktop-App ist ein kleiner Windows-Bootstrapper fuer die bestehende
Tracker-Engine. Der Installer enthaelt keine Tracker-EXE. Beim ersten Start wird
die aktuelle Engine aus `ga-tracker-client/channel/stable.json` geladen, gegen
Dateigroesse und SHA-256 geprueft und als separater Hintergrundprozess gestartet.

## Funktionen

- kleines Statusfenster und Windows-Tray
- Pilot-ID/PIN-Pruefung ueber den bestehenden Auth-Endpunkt
- Download, Pruefung, Update und Start/Stopp der Tracker-Engine
- vorherige gepruefte Engine als lokaler Rueckfall
- Tracker-Engine startet standardmaessig automatisch nach der Updatepruefung
- optionaler unsichtbarer Start direkt ins Windows-Tray
- Relay-, SimConnect- und Telemetrie-Status aus dem Tracker-Protokoll
- Updateeinstellung `ask` oder `automatic`
- beim ersten Update: `Nur dieses Mal`, `Kuenftig automatisch` oder `Spaeter`
- Updateinstallation vor dem Trackerstart, nicht waehrend eines Flugs
- Homebase Asset Pack installieren, aktualisieren, reparieren und deinstallieren

Persoenliche Tracker-/Homebase-Daten bleiben unter
`Dokumente/VFR Multitool/Tracker`. Programmzustand, geladene Tracker-Versionen und
Asset-Downloadcaches liegen dagegen unter `%LOCALAPPDATA%/VFR Multitool`.
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

## Updatekanal

Die Tracker-Runtime liest den Kanal:

`ga-tracker-client/channel/stable.json`

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
