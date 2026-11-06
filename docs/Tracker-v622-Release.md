# Tracker v622 Alpha / Web v2355 – EFB wieder lauffähig

## Problem

Seit v617 zeigten EFB und Toolbar in MSFS nichts mehr an (graue Karte, keine Beschriftungen).
Ursache: `classifyTraffic` in `map-live-presentation.js` nutzte Objekt-Spread (`{ ...x }`).
Die Datei wird dem EFB unverändert ausgeliefert; Coherent kennt diese Schreibweise nicht
(`SyntaxError: Unexpected token '...'`), danach fehlte `GAMapLivePresentation` und der
EFB-Host brach ab (`TypeError: undefined is not an object`). Gemeldet 06.11.2026 mit Tracker-Log.

## Änderungen

- `classifyTraffic` ohne Objekt-Spread (`Object.assign`).
- Neuer Test `tracker-efb-asset-syntax.test.js`: prüft alle unverändert ausgelieferten
  EFB-Skripte auf Objekt-Spread/-Rest, `?.`, `??` und logische Zuweisungen.
- `EFB_WEB_ASSET_REVISION` 62201, Web-Cache v2355.

## Geprüft

- Syntax-Scan aller EFB-Skripte: keine solchen Stellen mehr. Alle übrigen Sprachmittel der Datei
  gab es schon in v615 (EFB lief).
- Tests: Tracker 1545/1547 (2 übersprungen, 0 Fehler), Web 214/214. Im MSFS-EFB: Test durch User.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v622` (Release-Commit `2422d713f`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175007259 Bytes,
SHA-256 `f646afa0adbf169239a2f15c9c08a0cd57297ae442641058f6d9bbb8868b9fbd`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
