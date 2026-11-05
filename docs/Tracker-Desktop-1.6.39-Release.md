# Desktop 1.6.39 – Englische Oberfläche und Sprachschalter

## Änderungen

- Sprachschalter 🇩🇪 DE | 🇬🇧 EN oben rechts. Stellt das Desktop-Fenster um und gibt die Sprache an
  den Tracker weiter (ab Tracker v615 folgen EFB und Toolbar).
- Desktop-Fenster vollständig übersetzt, inkl. Statusmeldungen aus dem Hauptprozess und nativem
  Autostart-Dateidialog. Details: `docs/Tracker-v615-Release.md`, `docs/English Translation Plan.md`.

## Aktivierung

Release `tracker-desktop-v1.6.39` (Release-Commit `8182006d5`, Worktree-Build mit kopierten
`node_modules`), Installer 100326074 Bytes, SHA-512 wie `latest.yml`, öffentlicher Download geprüft.
App-Paket enthält `ui/i18n-core.js` und `ui/i18n-en.js`. Tests: Desktop 150/150 (3 übersprungen).
`channel/desktop/latest.yml` und `alpha.yml` aktiviert (Autoupdate).

Nicht geprüft: Installation, Start und Update auf Windows (kein Windows-System hier) – erster
Test durch User/Tester.
