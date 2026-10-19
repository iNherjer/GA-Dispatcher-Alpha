# Desktop 1.6.24 – Funk-Pause mit mehreren Eingaben

Basis: Desktop 1.6.23 (`origin/main`). Tracker-Runtime unverändert.

## Feldtest 1.6.23 (19.10.2026)

`funk-pause-log.txt` bestätigt unter Windows 10 (19045): Helfer kompiliert und startet,
Taste gelernt, Pause/Timer/Neustart/Kurzdruck wie vorgesehen, Ansage bei 10,87 s
angehalten und bei 9,37 s fortgesetzt. Musik-Absenkung `ok=true`, hörbare Abnahme offen.
Kein Joystick am Testsystem (`joysticks found=0` korrekt).

## Änderungen

- Bis zu 8 Funk-Buttons und Tasten: „+ Button hinzufügen“ lernt eine weitere Eingabe,
  ✕ entfernt sie. Doppelte Eingaben werden abgewiesen.
- Der Helfer überwacht alle Eingaben parallel; die Pause gilt, solange eine gedrückt ist.
- Die einzelne Belegung aus 1.6.23 wird automatisch übernommen.
- Log: `SETTINGS inputs=…` listet alle Eingaben, `INPUT watch inputs=<n>`, `REMOVE …`.

## Prüfung

- 118 Desktop-Tests (115 bestanden, 3 Windows-only übersprungen).

## Aktivierung (19.10.2026)

Öffentlicher Download geprüft (100280314 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert.
