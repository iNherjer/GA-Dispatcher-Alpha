# Tracker v661 Alpha – Satellit, GAFOR und METAR im EFB

Die EFB-Assetrevision 66101, das Community-Paket 0.4.28 und der
Web-Cache v2521 gehören zu diesem Release-Stand.

- Der Tracker liefert die EUMETSAT-Wolkenmaske als transparentes PNG aus.
  Im EFB sind Wolkenmaske und Infrarotbild normale Leaflet-Bildkacheln.
  Das Wetter-Schnellmenü nutzt DOM-Methoden, die Chrome 49 unterstützt.
- Der VFR-Index bietet neben Kacheln deutsche GAFOR-Sektoren für die
  aktuelle Open-Meteo-Stunde. Die Darstellung nutzt die klassische
  Einstufung der App. Eine Zeitampel ist in dieser Ansicht nicht enthalten.
- Die Wetterquelle der Karte bietet DWD ICON-EU, Open-Meteo und METAR.
  METAR zeigt gemeldete Wind- und Wolkendaten an den Stationen im
  sichtbaren Kartenausschnitt.

## Im Simulator prüfen

Satellit mit „Nur Wolken“ und „Infrarotbild“ testen. Den VFR-Index in
Deutschland zwischen Sektoren und Kacheln umschalten. METAR über die
Kartenwetterquelle wählen und Radar sowie das DWD-Höhenband gegenprüfen.
