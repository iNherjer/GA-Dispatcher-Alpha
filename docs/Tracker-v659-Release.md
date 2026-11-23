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

## Tests und Artefakt

- 1631 Tracker-Tests bestanden, zwei übersprungen. Browser-Test des
  Tracker-Hosts bei 440 und 665 CSS-Pixeln bestanden.
- Release [v659](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v659)
  aus Commit `81130737e`. Windows-x64-EXE mit 175507544 Bytes.
- SHA-256 `3ef9a1052afa1f8d78a9d828239cac6ad7152e6e6c2c2b3e2d8755033e57c9e3`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
