# Tracker v660 Alpha – Cloudflare-DWD-Wetter im EFB

EFB-Assetrevision 66001 für Community-Paket 0.4.28. Die Alpha-Webapp
verwendet Cache v2520.

- Karte, Höhenband und „Was ist hier?“ beziehen ihr ICON-EU-Wetter aus
  denselben veröffentlichten Cloudflare-Kacheln wie die Alpha-Webapp.
  Der Tracker dekodiert die angefragten Kacheln und liefert Wetterpunkte
  per JSON an das EFB. Der separate Python-Wetterdienst entfällt.
- Der Tracker hält bis zu zwölf dekodierte Kacheln im RAM. Das entspricht
  beim aktuellen Datenformat rund 1 MiB reiner Kacheldaten. Abgelaufene
  Kacheln werden minütlich freigegeben.
- Das kompakte DWD-Punktwetter zeigt WMO-Symbole, Wettertext und die
  niedrigste Wolkenbasis, wenn die Daten vorliegen.
- Höhenlinie und Höhenpunkte lassen sich auf Touchscreens nach 500 ms
  Halten ziehen. Ein Hinweis zeigt den Bearbeitungsmodus an.

## Im Simulator prüfen

DWD auf Karte und Höhenband wählen, mehrere UTC-Stunden laden und das
Punktwetter öffnen. Seitliches Scrollen und Höhenbearbeitung auf einem
Touchscreen testen. Die tatsächliche RAM-Ersparnis am Sim-PC ist offen.
