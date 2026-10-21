# Desktop 1.6.31 – Funk-Pause: Auslöseverzögerung pro Programm

Basis: Desktop 1.6.30 (`origin/main`). Tracker-Runtime unverändert.

## Änderungen

- Jedes erkannte Programm hat das Auswahlfeld „Auslösen nach“: sofort, 0,1 / 0,3 /
  0,5 / 1 / 2 s. Neue Einträge starten mit 0,3 s.
- Die Empfindlichkeit bestimmt nur noch den Pegel (0,10 / 0,03 / 0,01). Einträge aus
  1.6.30 behalten ihre bisherige Zeit (600 / 300 / 100 ms je Empfindlichkeit).
- Programmzeile: Auswahlfelder richten sich nach ihrem Inhalt, nichts wird
  abgeschnitten.
- Log: `DETECTION … <Name>/<Verhalten>/<Empfindlichkeit>/<ms>ms`.

## Prüfung

- 133 Desktop-Tests (130 bestanden, 3 Windows-only übersprungen), neu: Verzögerung
  unabhängig von der Empfindlichkeit, Übernahme alter Einträge.
- Programmzeile im Browser geprüft (alle Felder vollständig, Änderung gespeichert).

## Aktivierung (21.10.2026)

Öffentlicher Download geprüft (100288445 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert.
