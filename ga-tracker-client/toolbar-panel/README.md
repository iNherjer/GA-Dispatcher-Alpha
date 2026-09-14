# VFR Multitool Toolbar 0.2.1 – lokaler Simulator-Test

## Auslieferung ab EFB 0.4.14

Auf Nutzerauftrag werden diese Quellen jetzt vom EFB-SDK-Projekt mitgebaut.
Der oeffentliche Releaseweg ist ausschliesslich EFB-Alpha unter
`vfr-multitool-efb`; es gibt keinen separaten Toolbar-Kanal. Die unten
beschriebenen Standalone-Projekte und Archive sind historische Testartefakte.
Der separate Community-Testordner wurde auf diesem PC extern gesichert und
durch die gemeinsame Installation ersetzt. Siehe `../../docs/EFB-0.4.14-Release.md`.

## Aktueller Folgefix 0.2.1

Nutzerrueckmeldung nach erneutem Simulatorlauf: "das scheint zu funktionieren".
Damit ist der gemeldete Hoehenfehler fuer den Alpha-Kandidaten nach menschlichem
Funktionstest behoben. Eine vollstaendige Missions-/Audio-/Lifecycle-Testmatrix
ist dadurch nicht separat bestaetigt. Der Nutzer hat den Alpha-Rollout angefragt;
Paketbuendelung versus eigener Toolbar-Kanal wird vor der Veroeffentlichung geklaert.

Der erste Screenshot bestaetigt Toolbar-Registrierung und das Laden des
gemeinsamen Kartentischs parallel zum EFB. Im Panel erscheint jedoch nur der
obere Bereich; darunter bleibt der Shell-Hintergrund. Das entspricht einer
auf die intrinsische iframe-Hoehe begrenzten Darstellung in Coherent.
0.2.1 ersetzt die prozentuale Hoehenkette durch gestreckte native Flex-Wrapper
und ein absolut im verbleibenden Inhaltsrechteck positioniertes iframe.
Native Padding/Margins werden nur fuer dieses Panel entfernt.

SDK-Build, leerer Fehlerbericht, Layout-/Quellhash- und ZIP-Pruefung: PASS.
Am 14.09.2026 um 09:21 Europe/Berlin installiert und gegen Buildhashes geprueft;
EFB unveraendert. Sicherung der vorigen Installation:
`build-logs/v021/installed-v020-backup`. Reale Hoehe/Resize in Coherent muss
nach dem Neustart erneut geprueft werden; der Screenshot ist kein Nachweis
fuer den Fix. Buildaufruf wie unten, Ausgabe-/Tempordner fuer diesen Build
`build-logs/v021`. Installationsnachweis: `build-logs/install-v021.json`.
Archiv: `release/vfr-multitool-toolbar-panel-0.2.1-test.zip`, 6055 Bytes,
SHA-256 `14ad4e481e3607fd80cd7326d5cc60dbe2a1b5451d516e0aa6cb653f8db77629`.

Die folgenden Abschnitte dokumentieren die Anbindung und Erstinstallation 0.2.0.

Stand: 14.09.2026. Basis: `3679c8af9`, gemeinsamer Host von Tracker v403.

## Aktueller Stand

Das Panel laedt dieselbe Tracker-Seite wie das EFB:
`http://127.0.0.1:49880/efb/v1/?host=toolbar&channel=<neuer Kanal>&view=9`.
Es enthaelt keine Kopie des Kartentischs. Kartenansicht, Werkzeuge,
Mission Control, Capabilities, Controller-Sitzung und Audio-Lease kommen
unveraendert aus dem bestehenden Tracker-Host. Auf ausdruecklichen Nutzerwunsch
ist 0.2.0 der volle Cockpit-Test und keine read-only TP0-Probe mehr.
Bestehende Missionsfreigaben werden weder geoeffnet noch umgangen.

Die native Toolbar-Huelle behandelt Close, Hide, Minimize und Restore.
Schliessen im Kartentisch schliesst das Toolbar-Fenster. Beim Ausblenden
wird der Frame entladen; ein erneutes Oeffnen erstellt einen neuen Channel.
Die zusaetzliche Statusleiste verschwindet nach ready/live. Kurze Ausfaelle
bauen einen laufenden Frame nicht neu auf. Ohne Bereitschaft nach 20 Sekunden
stoppt die automatische Bootpruefung; Neu verbinden startet einen neuen Versuch.
Normale Tracker-Ausfaelle werden durch den gemeinsamen Host behandelt.

Nachrichten benoetigen den aktuellen Channel. Ein bekannter fremder Absender
wird auch bei gleichem Origin verworfen. Fehlt `event.source` in Coherent,
sind exakter Loopback-Origin und aktueller Channel erforderlich.
Es gibt keine neue SimConnect-Strecke oder eigene Missions-/Audio-Queue.

## Build und Nachweise

SDK 1.7.2, MSFS 2024 1.8.16.0, Package-Version 0.2.0.
Im Verzeichnis dieses Dokuments (PowerShell):

```powershell
node --check PackageSources/html_ui/InGamePanels/VfrMultitool/Panel.js
node --test panel.test.cjs
& 'C:\MSFS 2024 SDK\Tools\bin\fspackagetool.exe' "$PWD\VfrMultitoolToolbarProject.xml" -outputdir "$PWD\build-logs\v020" -tempdir "$PWD\build-logs\v020" -nopause
./prepare-test-zip.ps1 -PackagePath 'build-logs/v020/Packages/vfr-multitool-toolbar-panel'
```

- Offizieller SDK-Build: PASS, Exit 0 und leerer `_RPTErrors.xml`.
- Fuenf Layoutdateien mit korrekten Groessen, sieben Paketdateien insgesamt.
- UI-Quelldateien hashgleich mit SDK-Ausgabe; ZIP-Inhalte gegen Paket geprueft.
- Sechs ausfuehrbare Shelltests: PASS (Close/Abort, Channel/Absender,
  Coherent-Fallback, Load/Ready-Reihenfolge, Hide/Restore, Offline/Timeout).
- Archiv: `release/vfr-multitool-toolbar-panel-0.2.0-test.zip`, 5847 Bytes.
- SHA-256: `fd67d361dbcd1cc7215c0c44d48af2ea0546d60c44426817541293c0e1c1e6f1`.

## Installation und Test

Am 14.09.2026 um 08:29 Europe/Berlin bei geschlossenem MSFS installiert nach:
`C:\Users\einhe\AppData\Roaming\Microsoft Flight Simulator 2024\Packages\Community2024\vfr-multitool-toolbar-panel`.
Alle sieben installierten Dateihashes stimmen mit dem SDK-Paket ueberein.
Der gesamte vorhandene EFB-Paketbestand wurde vor/nach der Installation
verglichen und blieb hashgleich. Installationsnachweis: `build-logs/install-v020.json`.
Keine Veroeffentlichung, Kanalumschaltung oder Desktop-Autoupdate-Integration.

MSFS starten, einen Flug laden, in der Simulator-Toolbar **VFR Multitool**
oeffnen (gegebenenfalls unter Toolbar-Anpassung aktivieren). Tracker starten.
Zuerst Karte, Werkzeuge, Schliessen/Oeffnen, Groessenaenderung und EFB parallel
pruefen. Anschliessend Kamerawechsel und Minimize/Restore. Missionen/Audio
nur mit den bestehenden Freigaben testen. Reale In-Sim-Ergebnisse sind noch offen;
ein erfolgreicher SDK-Build bestaetigt nicht die native Registrierung oder UI.

Historie der isolierten Probe 0.1.0: `TP0-history.md`.

Zusaetzliche bestehende Cockpit-/Web-Client-Tests wurden gestartet. Die
sichtbaren Cockpit-Einzeltests meldeten PASS, der Gesamtlauf terminierte jedoch
auch mit --test-force-exit nicht und wurde beendet. Diese Suite wird deshalb
nicht als vollstaendig bestanden gewertet. Logs: build-logs/shared-host-tests*.log.
Die sechs gezielten Toolbar-Shelltests sind vollstaendig bestanden.
