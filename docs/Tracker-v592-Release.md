# Tracker v592 Alpha / Web v2212 – Media-Player-Zoom je Ansicht neustartfest

Folge zu v591 (Tester bestätigt: NAVCOM-Modus und Media Player Ein/Aus bleiben jetzt erhalten).
Wunsch: Der Player soll sich zusätzlich seinen Zoom merken – je Instanz, nicht geräteübergreifend.

## Änderungen

- Skins (`media-player-ui.js`, `media-player-ipod.js`, `media-player-watch.js`): optionaler
  Rückruf `onLayoutSave(scale)` beim Speichern des Layouts. Die Web-App nutzt ihn nicht.
  `media-player-watch.js` bleibt mit der Web-Fassung identisch (Test erzwingt das).
- `efb-media-source/media-player-client.js`: meldet nur echte Zoomänderungen (Verschieben allein
  sendet nichts) über `gaPersistMediaScale(skin, scale)`; übernimmt den gespeicherten Zoom der
  eigenen Instanz und baut den offenen Skin dann einmal neu auf. Referenz ist der eigene Wert im
  Speicher der Ansicht, damit sich gleichzeitig offene Ansichten trotz gemeinsamem Webspeicher
  nicht gegenseitig überschreiben.
- `tracker-efb-kartentisch-host.js`: Instanz = Oberfläche (`physical`, `popout`, `toolbar`,
  `unknown`) + `2d`/`vr`. Speichert unter `mediaScales[instanz][skin]`, gibt beim Laden nur die
  Werte der eigenen Instanz weiter.
- `tracker-efb-display-settings.js`: `mediaScales` in `efbDisplay.ui`, validiert (Instanzname,
  Skin, 0,5–1,6). Ein Patch einer Instanz behält die Werte aller anderen Instanzen.

Position wird bewusst nicht gespeichert (hängt von Fenstergröße und 2D/VR ab). Nach dem Update
einmal zoomen; danach bleibt der Wert je Ansicht erhalten.

Tracker v592, Host-Assetrevision 59201, Web-Cache v2212. EFB-/Toolbar-Community-Paket und
Desktop-Installer unverändert. Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Neu: Instanzfall in `tracker-efb-display-settings.test.js` (getrennte Instanzen, Zusammenführen,
  keine neue Revision bei gleichem Wert, ungültige Instanz/Skin/Zoom abgelehnt).
- Simulation mit Tablet 2D und Toolbar VR gleichzeitig, gemeinsamer Webspeicher, echter
  Displaycontroller: 130 % / 70 % bleiben getrennt, kein wiederholter Neuaufbau, nach simuliertem
  Neustart stellt jede Ansicht ihren eigenen Wert wieder her.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1483 Tests, 1446 bestanden, 35 Fehlschläge – dieselben
  wie bei v591.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`.
  PE32+ x86-64; v592, Assetrevision 59201 und Zoom-Speicherung eingebettet geprüft.

EXE: 174351614 Bytes; SHA-256 `11dc755d33935bc810f376ddc686ff2b5f4407794a5b8534870e3b9585be0dc8`.

## Im Feld prüfen

- Tablet: Player zoomen, MSFS neu starten → Zoom bleibt.
- Toolbar/Popout: anderer Zoom als am Tablet bleibt unabhängig erhalten.
- 2D und VR behalten jeweils eigene Werte.
