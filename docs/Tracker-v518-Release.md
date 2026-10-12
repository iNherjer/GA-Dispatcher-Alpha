# Tracker v518 Alpha – vertikale Luftraumwarnungen

Die neue vertikale Warnung meldet Luftraeume oberhalb und unterhalb des Flugzeugs
bei 1500/1000/500/100 ft Abstand. Entfernungen werden auf volle 100 ft abgerundet.
150-ft-Hysterese und zwei Minuten Cooldown verhindern Wiederholungen bei
gleichbleibendem Abstand. Ein separater Audio-Schalter steuert die Kategorie.

Die Berechnung laeuft im Tracker, auch ohne Web-App und waehrend Web-gefuehrter
Missionen. MSL, AGL und Flight Levels verwenden ihre passende Hoehenreferenz.
Veraltete Audiojobs werden storniert. Anna, Matilda, Hannah, Liam und Ava EN
besitzen die benoetigten Wortclips; Paula und Irene bleiben zurueckgestellt.

## Auslieferung

- Tracker-Runtime: v518, Windows x64.
- Desktop: 1.6.14-alpha.1, separater Alpha-Installer mit eigenem Menueschalter.
  Bestehende Stable-Desktop-Autoupdates bleiben auf ihrem bisherigen Kanal.
- Web-/EFB-Ausgabe: gemeinsamer Audio-Schalter, Capability fuer kompatible
  Tracker; Service-Worker-Cache v2017, EFB-Assetrevision 51801.
- Worker-Audio-Settings deployed: 3cce6ef8-5156-4867-998a-e29eb66ef385.

## Validierung

83 Warnungs-/Audio-/Worker-Tests und 54 Desktop-Tests bestehen auf dem aktuellen
Origin-Stand. Der gesamte Worker-Testlauf und der AWM-Queue-Selbsttest bestehen.
40 neue Sprachassets wurden vollstaendig decodiert. Windows-PE-x64 und
eingebettete v518-/Warnungsquellen sind geprueft. Der Tracker wurde mit dem
bestehenden Apple-Silicon-Cross-Build ohne Bytecode gebaut.

Ein Windows-/MSFS-Feldtest ist noch offen; dies ist ein Alpha-Release.
Beide Release-Downloads sind bytegenau verifiziert; GitHub Pages liefert die
40 neuen Audioassets und das neue Menue. Der zwischenzeitlich veroeffentlichte Alpha-Tracker v519 enthaelt die
vertikalen Warnungen und bleibt aktiv. Seine oeffentliche EXE ist ebenfalls
auf SHA-256 und eingebettete Warnungsquellen geprueft. Der separate
Desktop-Alpha-Zeiger wird auf 1.6.14-alpha.1 gesetzt. Stable bleibt
unveraendert. Weitere 28 EFB-/Audio-Menue-/Asset-Cache-Tests bestehen.

## Unveraenderliche Artefakte

Runtime: 173292401 Bytes, SHA-256
`d3de02bb60c21c909affc5d0b4a15e5d69a6852f7f2a126e21b2b58a1ecd468b`.
Installer: 100241456 Bytes, SHA-256
`755d7feabdb4ab6a1b33cbdeeccea6d06902f3e19f9894cc6365a11340c587a5`.

Source-Commit: `b688b68c9773dc213b2950ed3417e561cf122363`.

- [Runtime v518](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v518)
- [Desktop Alpha](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/tracker-desktop-v1.6.14-alpha.1)

Der Alpha-Installer wird separat angeboten; der bestehende Stable-Desktop-
Autoupdater zeigt weiterhin auf 1.6.13. Alpha-Nutzer koennen den neuen Installer
manuell installieren, wenn der Desktop-Schalter direkt im PC-Menue gewuenscht
ist. Der Web-/EFB-Schalter gehoert bereits zum Tracker-/App-Release.

Aktiver Alpha-Tracker v519: 173778146 Bytes, SHA-256
`fd82fd1771b3961fcd89a55e914c45ea58448319a2d2490511b6279f74d930bf`.
