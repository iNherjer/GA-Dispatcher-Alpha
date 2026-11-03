# Tracker v614 Alpha – „Was ist hier?“ öffnet am Mauspunkt (EFB-UI-Skalierung)

Fund aus dem Test (03.11.2026): Langer Klick auf EDDS im EFB öffnete „Was ist hier?“ an einem Punkt
nordwestlich des Platzes. Rechtsklick ist im EFB nicht möglich, der lange Klick ist dort der einzige Weg.

## Ursache

Der lange Klick rechnete die Mausposition (Bildschirm-Pixel) direkt in einen Leaflet-Kartenpunkt um.
Das EFB skaliert die ganze Seite per CSS-Transform (`GAEfbUiScale`, `scale(factor)`); Leaflet arbeitet
mit unskalierten Pixeln. Bei Skalierung < 1 landete der Punkt deshalb Richtung linke obere Kartenecke,
bei > 1 Richtung rechts unten. Seit der EFB-UI-Skalierung (05.10.2026) vorhanden, nicht durch v612/v613.

In der Web-App gleicher Fehler bei Seitengröße ≠ 100 % (`body.style.zoom`), für langen Klick und Rechtsklick.

## Änderungen

- EFB (`tracker-efb-kartentisch-host.js`): `mapContextPressContainerPoint()` teilt den Abstand durch die
  EFB-Skalierung (`GAEfbUiScale.delta`), wie der übrige EFB-Ziehcode. Ohne Skalierungshelfer unverändert.
- Web (`map.js`): langer Klick und Rechtsklick nutzen `map.mouseEventToLatLng()`, das den Zoom des
  Containers berücksichtigt.
- `EFB_WEB_ASSET_REVISION` 61401.

## Geprüft

- Neuer Test: Umrechnung bei Skalierung 1, ohne Helfer, 0,8 und 1,25.
- Web im Browser: echter langer Klick bei 80/100/120 % Seitengröße öffnet exakt am Mauspunkt
  (vorher bei 120 % rund 0,4° Länge daneben).
- Im MSFS-EFB noch nicht geprüft.

Stable bleibt unverändert (v605).
