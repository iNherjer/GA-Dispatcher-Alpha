# Tracker v584 Alpha / Web v2191 – Gepäckstücke zufällig gedreht

Feldtest v583: Die Gepäckgruppen funktionieren, aber alle Stücke standen in derselben
Richtung wie das Flugzeug.

## Änderungen

- `tracker.js`: Neue Funktion `sceneItemHeadingDeg`. Szenenobjekte mit `randomYawDeg`
  bekommen bei jedem neuen Spawn-Befehl eine zufällige Drehung innerhalb ±`randomYawDeg`.
  Wiederherstellen nach Reconnect nutzt die gespeicherten Positionen; Objekte ohne das
  Feld (Fahrzeuge, Personen, Bordausrüstung) behalten ihre feste Ausrichtung.
- `mission-cargo-visual-core.js`: Jedes Gepäckstück (Startszene, Pickup-Szene, Entladen,
  Abwurf) trägt `randomYawDeg: 180`. Stückabstand 0,7/0,9/1,3 m (klein/mittel/groß) statt
  0,6/0,8/1,1 m, damit gedrehte große Stücke sich nicht überschneiden.

Tracker v584, Host-Assetrevision 58301 (EFB-Host unverändert), Web-Cache v2191.
EFB-/Toolbar-Community-Paket und Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Prüfung

- `node --test tools/mission-cargo-visual.test.mjs` (14, neu: Drehmarkierung pro Stück und
  Drehlogik direkt aus `tracker.js`), `tracker-mission-simulator-effects.test.js`,
  `tracker-efb-http-server.test.js`, Szenen-Selbsttest.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1396 bestanden, 34 Fehlschläge, alle schon
  beim v583-Release vorhanden – keine neuen Fehler.
