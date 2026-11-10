# Tracker v628 Alpha – ATC-Routenumbau, Verkehrs-Fehlalarm, Formation

Zusammen ausgeliefert mit Web v2358. Auswertung des Testflugs 09.11.2026 (Tracker-Log).

## Befund

- **ATC-Übergabe „Route laden“ (Weltkarte):** Bis 30.10.2026 fünfmal bestätigt, seit 01.11.2026
  fünfmal `flightplan_atc_readback_mismatch` – bei unverändertem Tracker (v605) und EFB-Paket
  (0.4.25). Die Simulator-Flugplanung (EFB-Route) war jedes Mal identisch zurückgelesen; erst die
  MSFS-ATC liefert einen veränderten Plan, und genau diesen zeigt die Weltkarte. Vermutlich
  MSFS-seitige Änderung um den 31.10.2026. Nach dem Fehlschlag wurde die Mission ohne
  Avionik-Übertragung gestartet; geflogen wurde die von der ATC umgebaute Route.
- **Verkehr:** MSFS 2024 liefert Mitspieler nicht über SimConnect (bekannter DevSupport-Fehler;
  Objekte mit Position 0 werden verworfen). Die Warnung „6 Uhr, gleiche Höhe“ 12 s nach dem Start
  kam von abgestellten KI-Flugzeugen in LOWZ („AS-GEN“, 3 ft AGL), die zeitweise
  SIM ON GROUND 0 melden.

## Tracker

- **Umgebaute ATC-Route:** Klare Meldung auf der Weltkarte; im Cockpit-Startbanner steht
  „Mission starten und die richtige Route ins GPS laden“ als empfohlene, markierte erste Option
  (`atcRouteChangedRun`, je Missionslauf).
- **Parkende KI = Boden:** < 20 ft AGL und < 40 kt zählt als Bodenverkehr (keine Warnung).
- **Eigenes Flugzeug:** SimConnect-Objekt 1, sonst nur gleiche Position (≈ 30 m) und Höhe
  (< 100 ft) statt der bisherigen 0,1-NM-Box, die nahen Verkehr ausblendete.
- `EFB_WEB_ASSET_REVISION` 62801.

## Web (v2358)

- `filterTraffic` (Web und EFB): gleiche engere Eigenfilterung, Formationsverkehr ab ≈ 100 m
  sichtbar.

## EFB-Paket (nicht in diesem Release)

- `efb-app/flightplan-bridge-core.js` (+ identische Toolbar-Kopie): ATC-Readback bis ≈ 5 s,
  50-m-Toleranz, Log des zurückgelesenen ATC-Plans (`atcReadback`). Wirkt erst mit einem neuen,
  unter Windows mit dem MSFS-SDK gebauten Community-Paket – siehe `docs/Release Queue.md`.

## Geprüft

- Tracker 1548/1550 (2 übersprungen, 0 Fehler), Web 215/215, Brücke 11/11.
- Neue Tests: ATC-Umbau-Meldung (Host), ATC-Toleranz/Readback (Brücke), Formationsfilter.
- Im MSFS-EFB noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

_wird nach dem Build ergänzt_
