# Tracker v662 Alpha – Wetterseite und Favoritenleiste im EFB

Der Tracker liefert die EFB-Webassets mit Revision 66201 aus.
Der Web-Cache des Build-Commits ist v2539.

- Im EFB-Seitenmenü zeigt „Wetter“ die Tracker-Route mit DWD ICON-EU,
  Open-Meteo oder METAR. Die DWD-Stundenwahl ergänzt den Live-Modus.
- Die Wetterkarten zeigen Wolkenbasis und Ceiling mit der verfügbaren
  Bezugshöhe. MSL und AGL lassen sich direkt am Höhenwert umschalten.
- Der Kartenrand zeigt Menübutton und Favoriten in einer gemeinsamen
  Leiste, mittig auf der sichtbaren Kartenfläche.
- Der Satellitenabruf nutzt produktspezifische EUMETView-Endpunkte.

## Im Simulator prüfen

Wetterseite im EFB und im Toolbar-Panel öffnen, Quelle und DWD-Stunde
wechseln und Wetter als Favorit anheften. Die Leiste bei unterschiedlichen
Fenstergrößen und UI-Skalierungen prüfen. Community-Paket 0.4.28 verwenden.

## Tests

- Tracker-Gesamtlauf: 1632 bestanden, zwei übersprungen. Die beiden
  fehlgeschlagenen Tests zum Freiflug-Wiederanlauf und zu SAR V2 liefen
  in der gezielten Wiederholung auf der Origin-Basis und auf v662 durch.
- Der EFB-Browsertest prüfte Wetterseite, DWD-Stundenwahl und Favoritenleiste
  mit den Originalquellen und den kompilierten Hostassets. Sechs Webtests
  zum App-Start und Cache bestanden.
