# Tracker v603 Alpha / Web v2287 – Hindernis-Kacheln nach Neustart vollständig, weniger lokaler Speicher

## Änderungen

- EFB und Web (`profile.js`): Kacheln, deren Hindernisse nur teilweise im lokalen Pool gespeichert wurden, gelten nach
  einem Neustart nicht mehr als abgedeckt und werden neu geladen (`partialTiles` im Pool `ga_obs_pool_v1`). Bisher
  konnte eine Kachel nach dem Neustart halb leer bleiben, weil der Pool nie eine ganze Region fasst (4.000–7.700
  Einträge je Kachel).
- Web, nur Handys (`pointer: coarse`, bis 900 px): gespeicherter Hindernis-Pool höchstens 300.000 statt 650.000
  Zeichen. Desktop und EFB unverändert.
- Web (bereits live): Der Missions-Debug-Snapshot liegt nur im Speicher; dauerhaft bleiben Zeitstempel und IDs für die
  Ablaufprüfung (`gaPersistMissionDebugSnapshot`). Spart auf dem iPhone rund 0,8 MB localStorage.
- `EFB_WEB_ASSET_REVISION` 60301.

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `3451a89b7`): 174675129 Bytes; SHA-256 `02095ca3e814ac8c43ea107c64132a886b21b27d869aa7f638bbc405c00b3c34`.
Öffentlicher Download geprüft. Volle Tracker-Testsuite: 1521 grün, 0 Fehler.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Browser: 40 Testkacheln, 39 nur teilweise gespeichert → nach Neuladen genau diese 39 als fehlend erkannt, die
  vollständige nicht; neu geladene Kachel gilt sofort wieder als abgedeckt. Neun echte Kacheln Winzeln–Donaueschingen
  in ~90 ms nachgeladen.
- `ga-tracker-client/tracker-efb-web-client.test.js`, `tracker-efb-http-server.test.js`.

## Im Feld prüfen

- Route planen, App neu starten: Hindernisse entlang der Strecke vollständig.
- Debug-Log auf dem iPhone: localStorage deutlich unter 4,9 MB.
