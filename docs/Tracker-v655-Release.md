# Tracker v655 Alpha – OSM- und NASA-Karten im EFB, eindeutiger Kartenspeicher-Schalter

Zusammen mit Web v2475.

## Feldbefund 20.11.2026 (Tracker v654, EFB 0.4.28)

- 06:27 mit leerem Kartenspeicher: Tracker-Kacheln kamen beim ersten Laden nicht innerhalb von 4,5 s
  (Tracker beschäftigt, `MISSION_START_SOURCE_LATE likely=tracker_busy`), die EFB fiel auf direkt zurück.
  Danach wurde der Speicher versehentlich ausgeschaltet: Der Knopf „Aus“ wurde als Zustand gelesen.
- 06:47 wieder eingeschaltet: OpenTopo, VFR-Lufträume und Esri Topo mit `source=tracker-proxy fallbacks=0`,
  OpenTopo 0,26 s nach dem Einschalten (von der Platte). Kacheln über den Tracker sind in Coherent sichtbar.

## Änderungen

- EFB-Basiskarten: OpenStreetMap, OpenStreetMap.de, OSM Swiss Style, CyclOSM nur über den Tracker
  (`proxyOnly`, App-Kennung `VFR-Multitool-Tracker-EFB/1.1 (+https://github.com/iNherjer/GA-Dispatcher-Alpha)`,
  Plattenspeicher), NASA Blue Marble und Earth at Night bis Zoom 8 (direkt, Tracker als Rückfall).
  Details `docs/EFB-Development-Plan.md` Abschnitt 20.11.2026.
- Schalter „Kartenspeicher“: Zustand („An: … / Aus: …“) und Knopf („Ausschalten“/„Einschalten“) getrennt.
- `EFB_WEB_ASSET_REVISION` 65501. Mitgeliefert aus der Release-Queue: „EFB: OSM-, OSM.de-, OSM-Swiss-,
  CyclOSM- und NASA-Karten“.

## Tests

_wird nach Testlauf eingetragen_

## Im Feld prüfen

- OpenStreetMap, OpenStreetMap.de, OSM Swiss Style, CyclOSM im EFB sichtbar (nur über den Tracker).
- NASA Blue Marble/Earth at Night, ab Zoom 9 vergrößert.
- Schalter liest sich eindeutig.

## Artefakt

- Release `v655`, Asset `VFR-Multitool-Tracker.exe`
- Größe: _wird nach Build eingetragen_
- SHA-256: _wird nach Build eingetragen_
