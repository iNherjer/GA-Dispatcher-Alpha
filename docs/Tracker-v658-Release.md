# Tracker v658 Alpha – Classic-Wolken im EFB

Im Alpha-Feldtest erreichte dasselbe MSFS-Menü mit sichtbaren Wolken etwa
25 FPS im Wetterstil Classic und etwa 60 FPS in Abstrakt. Classic zeichnet
im EFB seine Wolkenformen jetzt ohne weiche Canvas-Schatten pro Element.
Wolkenbasis, Geometrie und Beschriftung bleiben erhalten.

Assetrevision 65801 für das vorhandene EFB-Community-Paket 0.4.28 und
Web-Cache v2509. Der weiche Classic-Stil in der Webapp bleibt erhalten.

## Tests

Tracker-Suite mit 1629 bestandenen und zwei übersprungenen Tests bei vier
parallelen Testprozessen. Im ersten Lauf schlug ein zeitabhängiger Audiotest
fehl. Der isolierte Audiotest am Origin-Ausgangsstand und der vollständige
Wiederholungslauf waren erfolgreich.

## Im Feld prüfen

Mit Tracker v658 im selben MSFS-Menü und bei gleicher Wetterlage Classic
und Abstrakt mit sichtbarem Routen-Höhenband und eingeschalteten Wolken
vergleichen. Die Wirkung des Folgepatches im Simulator ist noch offen.

## Artefakt und Aktivierung

- Release [v658](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v658)
  aus Commit `78d5088e8`. Windows-x64-EXE mit 175352910 Bytes.
- SHA-256 `623cd9751449494aebd300c7c9d10623ddc0b21368f5d73f3f7f352edf9823b5`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
