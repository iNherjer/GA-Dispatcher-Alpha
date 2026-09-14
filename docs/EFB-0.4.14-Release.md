# EFB 0.4.14 Alpha – EFB und Toolbar gemeinsam

Das EFB-Community-Paket enthaelt jetzt auch das globale VFR-Multitool-Toolbar-
Panel. Beide Fenster zeigen dieselbe tracker-gehostete Kartentisch-Oberflaeche
und koennen parallel geoeffnet werden. Bestehende Missionsfreigaben,
revisionsgebundene Intents und die zentrale Audio-Playback-Lease bleiben erhalten.

Die Toolbar-Shell 0.2.1 behebt den im Simulator gemeldeten abgeschnittenen
Kartenbereich. Der Nutzer hat den Folgefix getestet und den Alpha-Rollout sowie
die Zusammenlegung freigegeben. Die fuenf Toolbar-Dateien des gemeinsamen
Pakets sind hashgleich mit genau diesem getesteten SDK-Paket.

## Installation

Ein Update ueber den bestehenden EFB-Alpha-Kanal installiert beide Ansichten
unter `vfr-multitool-efb`. MSFS muss beim Update geschlossen sein. In einem
Flug steht **VFR Multitool** in der Simulator-Toolbar bereit; das EFB bleibt
wie gewohnt verfuegbar. Der lokale Tracker muss fuer den Kartentisch laufen.

Nur fuer bisherige lokale Toolbar-Tester: den separaten Testordner
`vfr-multitool-toolbar-panel` vor dem Neustart ausserhalb von Community2024
sichern. Er darf nicht neben der neuen gebuendelten Registrierung aktiv bleiben.
Auf dem Entwicklungsrechner ist diese Migration mit Backup bereits erfolgt.
Normale EFB-Alpha-Nutzer haben dieses nie oeffentlich verteilte Testpaket nicht.
Stable bleibt unveraendert auf EFB 0.4.11.

## Validierung und Grenzen

- App neu kompiliert, Typecheck bestanden.
- Offizieller SDK-1.7.2-Build mit MSFS 2024 1.8.16.0, Exit 0 und leerem RPTErrors.
- 26 EFB-/Toolbar-Tests bestanden: Frame-Recovery, Quellvertraege und Toolbar-Lifecycle.
- SDK-Layoutgroessen und Archiv mit bestehendem Installer-Entpacker geprueft.
- Alle 13 EFB-Ausgabedateien hashgleich mit dem App-Build; alle fuenf Toolbar-
  Dateien hashgleich mit dem getesteten 0.2.1-Paket.
- Lokale gemeinsame Installation gegen SDK-Dateihashes verifiziert; alte EFB-
  und Toolbar-Installationen ausserhalb Community2024 gesichert.
- Ein separater vollstaendiger Missions-/Audio-/Lifecycle-Gesamtlauf und ein
  erneuter Simulatorlauf des zusammengelegten Paketroots sind nicht dokumentiert.
  Die Alpha-Freigabe beruht auf dem Nutzer-Funktionstest der enthaltenen Toolbar.

Artefakt: `vfr-multitool-efb-0.4.14.zip`, 439002 Bytes.
SHA-256: `fd1840e3c1ac9130b9ba1cea87d7e51fb08e69a6cd193152ef5b37ba264efe73`.
Tag: `efb-app-v0.4.14`. Alpha-Zeiger wird erst nach erneutem Download und
Hash-/Archivpruefung aktualisiert; bestehende Releaseassets werden nicht ersetzt.
