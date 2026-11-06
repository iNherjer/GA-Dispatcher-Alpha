# Desktop 1.6.40 – Schalter Verkehrswarnungen

## Änderungen

- Neuer Schalter „Verkehrswarnungen“ im Audiobereich (gesperrt bei Trackern ohne
  `capabilities.traffic`). Player und Clip-Freigabe kennen den Warntyp `traffic` und die
  15 neuen Bausteine. Details: `docs/Tracker-v617-Release.md`, `docs/Traffic Warnings.md`.

## Aktivierung

Release `tracker-desktop-v1.6.40` (Release-Commit `37e292669`, Worktree-Build mit kopierten
`node_modules`), Installer 100326142 Bytes, SHA-512 wie `latest.yml`, öffentlicher Download geprüft.
App-Paket enthält `audioTraffic` und die erweiterte `navigation-warning-audio.js`.
Tests: Desktop 150/150 (3 übersprungen).
`channel/desktop/latest.yml` und `alpha.yml` aktiviert (Autoupdate).

Nicht geprüft: Installation, Start und Update auf Windows (kein Windows-System hier) – erster
Test durch User/Tester.
