# Tracker v659 Alpha – Kartenwetter und Höhenband

EFB-Assetrevision 65901 für das vorhandene Community-Paket 0.4.28.
Die Webapp auf `origin/main` verwendet Cache v2510.

- Vier Wetter-Schnellschalter für Satellit, Radar, VFR-Index und
  Modellwolken mit Windbarben. Der Satellitenlayer bietet Wolkenmaske und
  IR. Im EFB nutzt der VFR-Index das interne Kachelmodell.
- Stundenweise Wetterwahl und statische WMO-Wetterzeichen im Höhenband.
  In der Webapp sind Konturwolken, Isothermen und Windbarben verfügbar.
- „Was ist hier?“ folgt der Wetterquelle des Höhenbands. DWD-Punktwetter
  zeigt die modellierte Wettererscheinung und Wolkenuntergrenzen in
  ft MSL und, bei bekannter Geländehöhe, ft AGL.
- Der EFB-Favoritenstern im Seitenmenü verwendet eingebettetes SVG.

DWD ICON-EU benötigt einen separat laufenden Wetterdienst. Im EFB fragt
der Tracker den Dienst auf demselben Rechner unter `127.0.0.1:54582` ab.
Open-Meteo und METAR stehen auch ohne diesen Dienst bereit.

## Im Feld prüfen

Darstellung und Bildrate im MSFS-EFB mit Classic und Kontur vergleichen.
Satellit, Radar, VFR-Index, Stundenwechsel, Punktwetter und Stern im
Simulator prüfen. Der Browser-Test nutzt kontrollierte Wetterantworten.
