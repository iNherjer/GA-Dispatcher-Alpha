# Tracker v638 Alpha – Boarding-Punkte nach dem Szenenaufbau verschieben

Zusammen ausgeliefert mit Web v2404 (Cache).

## Feldbefund 15.11.2026

Nach dem Aufbau der Startszene ließ sich die Cargo-Position im Boarding-Editor nicht mehr ändern.
„Szene neu setzen“ tat nichts, und die Pylonen erschienen bei aktivem Marker-Schalter nicht. Die
Ursache: Unter Tracker-Authority lehnt der Tracker eigene Szenenbefehle der App ab
(`mission_execution_authority_tracker`). Außerdem friert die App den Boarding-Weg beim Missionsstart
in den Effektplan ein.

## Änderungen Tracker

- Neue Fähigkeit `mission.boarding-layout.v1`, neuer Intent `update_boarding_layout`
  (`payload.layout`, `markers`, `respawn`).
- Neues Modul `tracker-mission-boarding-layout-core.js`. Es ersetzt nur Positionen im
  eingefrorenen Plan: wartende Boarder am Spawnpunkt, Cargo-Objekte, die Wege von Boarding und
  Deboarding, die manuellen Pax-Rezepte und `cargoPlacement`. Figuren, Fahrzeug, Titel, Manifest
  und Zeiten bleiben unverändert.
- `mission-authority-core.js` `updateExecutionBoardingLayout`: nur in `planned`/`prepare`, solange
  das Boarding nicht begonnen hat und keine Ladung bewegt ist. Neue Run-Revision und
  `boardingLayoutRevision`; der Stand übersteht einen Neustart.
- Die Laufzeit baut die schon stehende Startszene über den Recovery-Pfad neu auf, ohne neuen
  Effekt im Ausführungszustand.
- Marker (`Cone_Medium` an jedem Wegpunkt) setzt der Tracker selbst als Szene
  `<sceneId>-boarding-markers`; `start_boarding` und die Run-Aufräumung entfernen sie.
- Log: `MISSION_BOARDING_LAYOUT`, `MISSION_BOARDING_LAYOUT_RESPAWN`, `MISSION_BOARDING_LAYOUT_REJECTED`.
- `EFB_WEB_ASSET_REVISION` 63801. Die EFB-Kopie von `i18n/en-phrases.js` wird mitgeliefert, ebenso
  der offene Queue-Eintrag „EFB-Kopie profile.js: Diagnose-Abschnitt Boden-Composer“.

## Web v2404

- `sync.js`: Unter Tracker-Authority gehen Editor-Änderungen, „Szene neu setzen“ und der
  Marker-Schalter entprellt als `update_boarding_layout` an den Tracker. Der Editor meldet, ob die
  Änderung übernommen wurde oder warum nicht (Boarding läuft, Ladung verladen, anderes Flugzeug,
  Tracker zu alt oder getrennt).
- `app.js`: `getBoardingEditorSlot`; „Szene neu setzen“ geht unter Tracker-Authority an den Tracker.
- Englische Phrasen in `i18n/en-phrases.js`. Die Mindestversion bleibt unverändert.

## Geprüft

- Tracker-Suite 1574/1576 (2 übersprungen, 0 Fehler), dazu `tracker-mission-boarding-layout.test.js`
  mit einem Ende-zu-Ende-Lauf durch die Laufzeit.
- Web-/Tools-Testdateien: 60 rote Dateien scheitern auf `1ff5b6305` genauso (fehlende Module wie
  `electron` und `fake-indexeddb`); keine neue rote Datei.
- **Im Simulator und im MSFS-EFB noch nicht geprüft.**

Stable bleibt unverändert.
