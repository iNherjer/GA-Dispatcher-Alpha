# Tracker v615 Alpha / Desktop 1.6.39 / Web v2344 – Englische Oberfläche Phase 2

## Änderungen

- **Sprachschalter in der Desktop-App** (🇩🇪 DE | 🇬🇧 EN oben rechts): gespeichert als `uiLanguage`,
  beim Engine-Start als `VFR_MULTITOOL_UI_LANGUAGE` übergeben und bei Wechsel live an den laufenden
  Tracker geschickt (`POST /api/v1/display/settings {ui:{language}}`).
- **Tracker:** `ui.language` (`de`/`en`) in den EFB-Anzeige-Einstellungen.
- **EFB und Toolbar:** laden die gemeinsamen Übersetzungsdateien (`efb-web-assets/i18n-core.js`,
  `efb-web-assets/i18n/*`) und folgen `ui.language` live. Eigene Host-Texte übersetzt
  (Werkzeugleiste, UI-Größe, Direct To, Status, Startmeldung). Missionstexte bleiben deutsch.
- **Desktop-Fenster:** komplett übersetzt inkl. Statusmeldungen aus dem Hauptprozess
  (`desktop/ui/i18n-en.js`). Nativer Autostart-Dateidialog folgt der Sprache.
- **Web:** Audio-Ausgabe-Menü (`tracker-audio-client.js`), Ansage-Status und Frequenz-Hinweis übersetzt.
- Mitgeliefert aus der Release-Warteschlange: EFB-Kopien von Debrief, Zahlen-/Datumsformat,
  Vollbild-Skalierung, Uhr-Timer, Wegpunkt-Popup, Breakout/iPod, Screenreader-Attribute.
- `EFB_WEB_ASSET_REVISION` 61501.

## Verträglichkeit

- Alte Desktop-App + v615: kein Sprachwert → alles Deutsch wie bisher.
- Desktop 1.6.39 + älterer Tracker (z. B. Stable v605): Live-Wechsel wird abgelehnt (400),
  EFB/Toolbar bleiben deutsch; das Desktop-Fenster selbst wechselt.

## Geprüft

- Echter EFB-Server lokal ohne Sim: DE→EN→DE identisch, Wechsel nach ~0,5 s, Neustart in gespeicherter Sprache.
- Desktop-Fenster mit Ersatz-Schnittstelle: DE→EN→DE identisch, keine deutschen Reste in übersetzten Bereichen.
- Tests: Tracker siehe Release-Commit, Desktop 150/150 (3 übersprungen).
- Im MSFS-EFB/Toolbar und in der installierten Windows-App noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v615` (Release-Commit `8182006d5`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 174923028 Bytes,
SHA-256 `2ab84b9e2327c232fb46f7ff78eea4446f5ec62cfbe83d991fc708d6da058823`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
