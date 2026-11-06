# Tracker v620 Alpha / Web v2352 – Verkehr im EFB, Stufen vom Tracker, Entzerren beim Zoomen

## Änderungen

- **Verkehr auf der EFB-Karte:** Symbole je Klasse, Warnfarben, Blinken, Schatten, Labels,
  Bodenverkehr; Schalter „Traffic“ im EFB-Kartenmenü aktiv (war gesperrt).
- **Gemeinsames Modul** `traffic-map-layer.js` für Web-App und EFB (vorher nur in `sync.js`).
- **Tracker ist die zentrale Quelle für die Stufe** je Kontakt: `trafficLevels` im Warn-Snapshot
  (`capabilities.trafficLevels`), 1 Hz aus den vorgerechneten Positionen, auch bei Ton aus.
  Karte, EFB und Höhenband zeichnen nur; ältere Tracker: lokale Einstufung als Rückfall.
- **Entzerren beim Herauszoomen:** ab Zoom 11 voll; 10–11 kleiner, nur Höhe, kein Bodenverkehr;
  unter 10 ohne Labels, Kontakte unter 40 px Abstand als Sammelpunkt mit Anzahl. Warnung und
  Ausweichen nie verkleinert, ausgeblendet oder zusammengefasst.
- Testboard: neue Testpunkte im Bereich „Traffic“ (Icons, Profil-Icon, Schatten, EFB, Zoom).
- `EFB_WEB_ASSET_REVISION` 62001.

## Geprüft

- Tests: `traffic-map-layer.test.js` (Stapelung, alte Tracker, Stufenwechsel, Boden, Sammelpunkte,
  Zoom), Tracker-Stufen in `tracker-navigation-warnings.test.js`; Web 214/214, Tracker/EFB-Pakete
  189/189; Tracker gesamt 1542/1546 (2 übersprungen; 2 zeitabhängige SAR-Integrationstests im Gesamtlauf rot, einzeln grün).
- EFB-Seite mit lokalem Test-Server (fliegendes Flugzeug, Verkehr alle 5 s): alle Stufen,
  Schatten, Schalter aktiv, keine Fehler. Web-App: Tracker-Stufe hat Vorrang, Zoom fasst zusammen.
- Im MSFS noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v620` (Release-Commit `e269bcb94`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175005585 Bytes,
SHA-256 `c303581968d4c1e9610a53999c6059c48513fe8f5bd64d03ba2bb11ec3441ae5`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605). Desktop und Worker unverändert.
