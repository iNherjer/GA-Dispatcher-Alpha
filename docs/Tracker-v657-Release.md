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
