# Tracker v645 Alpha – Abschied beim Aufsetzen vorbereitet, Rückflug-Rückblick ab dem Aufsetzen

Zusammen ausgeliefert mit Web v2442 (18.11.2026).

## Anlass

- Der Rückflug-Rückblick (v644) startete erst beim Debrief; Nutzer beenden den Tracker meist
  kurz danach.
- Prüfung der Abschieds-Vorbereitung ergab: Im getrennten Missionsprozess (seit 17.09.2026) war
  sie nicht verdrahtet; der Abschied wurde immer erst beim Aussteigen erzeugt. Zudem hätte jede
  kleine Abweichung im Prompt die Vorbereitung verworfen.

## Änderungen

- `prepareFarewellVoice` wieder durch Worker und Elternprozess verdrahtet.
- `farewellMaterialKey`: APT-Passagierabschied wird beim Aussteigen nur bei wesentlicher
  Änderung neu erzeugt (Ergebnis/Fracht, Landeband, starke G/Bank/Sinkrate, Sprecher, Audio).
  Log `MISSION_FAREWELL_VOICE_PREWARM_REUSED`.
- Rückflug-Rückblick startet beim Aufsetzen am Ziel (gleicher Auslöser), mit dem vorbereiteten
  Abschiedstext als optionaler letzter Aussage; Rückfall ab Stillstand am Ziel; Prüftakt 5 s.
  Fertiger Entwurf hängt direkt am Angebot, sonst Nachtrag. Logs
  `MISSION_FOLLOWUP_RECAP_TOUCHDOWN`, `MISSION_FOLLOWUP_RECAP_WRITTEN … stage=deboarding|after-close`.
- `EFB_WEB_ASSET_REVISION` 64501.

## Tests

- Alle Tracker-Testdateien einzeln grün bis auf `tracker-mission-sar-integration.test.js` und
  `tracker-navigation-audio.test.js`, die auch auf dem unveränderten Stand unter Last
  wechselnd scheitern; `tools/mission-completion-followup.test.cjs` wie vorher rot.
- Neu: Wiederverwenden/Neu-Erzeugen des Abschieds, Verdrahtungstest, Rückblick beim Aufsetzen
  mit/ohne Abschiedstext, Entwurf vor/während des Abschlusses.
- Gepackter Missionsprozess: `MISSION_PACKAGED_PROCESS_SMOKE_OK` (macOS arm64).
- MSFS noch nicht geprüft.

## Feldtest

- Landung am Ziel: im Log `MISSION_FAREWELL_VOICE_PREWARM` kurz nach dem Aufsetzen, beim
  Aussteigen `MISSION_FAREWELL_VOICE_PREWARM_REUSED` und keine Wartezeit für den Abschied.
- Landewerte und Wetter werden beim Aufsetzen eingefroren. Nur ein Springer mit erneutem
  Aufsetzen ersetzt sie; wechselt dabei das Landeband, wird neu erzeugt. Fracht beschädigt oder
  Auftrag gescheitert → Abschied wird neu erzeugt (`PREWARM_MISS`).
- Charter mit Rückflug: `MISSION_FOLLOWUP_RECAP_TOUCHDOWN queued=1 farewell=1`, danach
  `MISSION_FOLLOWUP_RECAP_WRITTEN … stage=deboarding`.

## Artefakt
