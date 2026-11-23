# Tracker v657 Alpha – Routen-Höhenband und Vektorkarte

- Die Wolkenbasis bleibt im gemeinsamen Höhenprofil von EFB und Web sichtbar.
  Reine Bewölkung erhöht die Zeichenrate nicht. Regen, Schnee und Gewitter
  können weiterhin animiert werden.
- Der Kartentisch meldet die Auswahl der Vektorkarte pro Cockpit-Sitzung.
  Mit Desktop 1.6.43 endet das MapLibre-Fenster nach dem Kartenwechsel der
  letzten aktiven Ansicht und nach Abschluss ausstehender Renderaufträge.
- EFB-Assetrevision 65701 und Web-Cache v2508. Das EFB-Community-Paket 0.4.28
  kann weiterverwendet werden.

## Tests

Tracker-Suite mit 1629 bestandenen und zwei übersprungenen Tests. Der
Kartenwechsel wurde über den Tracker-Loopback bis zum Renderer geprüft.

## Im Feld prüfen

- Simulator-FPS im selben Menü mit geöffnetem Routen-Höhenband und sichtbarer
  Bewölkung. Web-Framezeiten und Akkueffekt bleiben ebenfalls Feldmessungen.
- Vektorkarte in EFB und Toolbar gemeinsam verwenden, nacheinander auf Topo
  wechseln und das Schließen des Desktop-Renderfensters bestätigen.

## Artefakt und Aktivierung

- Release [v657](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v657)
  aus Commit `4dad33ba3`. Windows-x64-EXE mit 175352899 Bytes.
- SHA-256 `8dd1716c6c615263be2df1c8c252a178274fe142eac58ca7ae1df6bd3dd020ba`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
