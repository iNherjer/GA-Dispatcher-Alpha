# Tracker v654 Alpha – Korrekturen der Losroll-Warnung

Zusammen ausgeliefert mit Web v2473 (nur Cache).

## Änderungen

- `tracker-mission-execution-runtime.js`: Die Warnung schweigt in `boarding`, wenn die
  Verladung bestätigt und der Passagier eingestiegen ist (nur die Begrüßung läuft noch), und
  in `prepare`, solange die Startszene noch nicht steht.
- `tracker-mission-premature-taxi-core.js`: Neue Option `suppressed`. `taxi_again` erst nach
  einem selbst beobachteten Stand, damit nach einem Neustart während des Rollens nicht sofort
  die zweite Warnung kommt.
- Vertrag: Nachtrag im Abschnitt 19.11.2026.
- `EFB_WEB_ASSET_REVISION` 65401.

## Tests

- Tracker-Suite `node --test *.test.js`: 1624/1626 bestanden, 2 übersprungen, 0 Fehler.
- Neu: Unterdrückung und Neustart während des Rollens in `tracker-mission-premature-taxi-core.test.js`.
- Im MSFS noch nicht geprüft.

## Artefakt

- Tag `v654`, Asset `VFR-Multitool-Tracker.exe`
- Größe: offen
- SHA-256: offen
