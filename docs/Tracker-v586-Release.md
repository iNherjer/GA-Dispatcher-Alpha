# Tracker v586 Alpha / Web v2193 – Bordausrüstung zufällig gedreht

Folge zu v584: Auch die Bordausrüstung lag beim Ausladen immer in Flugzeugrichtung.

## Änderungen

- `mission-cargo-visual-core.js`: Ausgeladene oder abgeworfene Bordausrüstung (Radkeile,
  Bordbuch, Feuerlöscher, Erste-Hilfe-Koffer) trägt `randomYawDeg: 180` und wird wie die
  Gepäckstücke bei jedem Spawn zufällig gedreht. Normale Fracht ohne Stückliste behält ihre
  Ausrichtung. Die Drehlogik in `tracker.js` (`sceneItemHeadingDeg`, seit v584) ist unverändert.

Tracker v586, Host-Assetrevision 58501 (unverändert), Web-Cache v2193. EFB-/Toolbar-Community-Paket und
Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Prüfung

- `node --test tools/mission-cargo-visual.test.mjs` (15, neu: alle vier Bord-Items gedreht,
  normale Fracht nicht), `tracker-mission-simulator-effects.test.js` (21, neu: ausgeladene
  Radkeile mit Zufallsdrehung), Cargo-/Szenen-Selbsttests.
