# Desktop 1.6.17 – Autostart für Tools und Sim

Basis: `origin/main` `9fb245791`. Tracker-Runtime unverändert (`tracker.js` nicht geändert).

## Neu

- Aufklappbares Modul **Autostart** direkt nach dem Tracker-Modul, standardmäßig aus.
- Hauptschalter: an → oben erscheint **Tracker & Sim starten**, aus → Button ausgeblendet.
- Programme (.exe, .lnk, .bat, .cmd) per Drag & Drop oder Dateiauswahl hinzufügen.
  Verknüpfungen werden aufgelöst (Ziel, Argumente, Arbeitsordner).
- Reihenfolge per Griff oder Pfeilen; je Eintrag Aktiv, **Als Admin** (UAC-Abfrage über
  `Start-Process -Verb RunAs`) und Wartezeit bis zum nächsten Eintrag.
- Sim-Erkennung: MSFS 2024/2020 über Steam (alle Bibliotheken aus
  `libraryfolders.vdf`) und Microsoft Store (`Get-AppxPackage`). Bei mehreren Funden
  wählt der Nutzer. Der Sim ist ein sortierbarer Listeneintrag.
- Ablauf: erst Tracker, dann die Liste. Bereits laufende Programme werden übersprungen.
- Option **Beim Beenden schließen**: schließt nur in dieser Sitzung vom Autostart
  gestartete Programme (erst regulär, nach 5 s erzwungen). Der Sim wird nie geschlossen.
  Als Admin gestartete Programme können ohne Adminrechte ggf. nicht geschlossen werden.
- Speicherung in `desktop-settings.json` unter `autostart`; bestehende Einstellungen
  bleiben unberührt.

## Prüfung

- 88 Desktop-Tests bestanden (neu: `tests/autostart-launcher.test.js`, UI-Vertrag).
- UI lokal in Electron (macOS) gerendert und geprüft.
- `npm run build:win` auf macOS; `app.asar` enthält `lib/autostart-launcher.js`.
- Offen: Windows-Installations-/Starttest, echter Programmstart, UAC-Start,
  Steam-/Store-Erkennung auf einem Sim-PC.

## Fallback

- Das Feature ist opt-in; bei Problemen den Hauptschalter ausschalten, das restliche
  Verhalten entspricht 1.6.16.
- Das Release `tracker-desktop-v1.6.16` bleibt unverändert. Manueller Rückweg:
  Desktop-App beenden, `VFR-Multitool-Tracker-Setup-1.6.16.exe` darüber installieren.
- Der Updater nutzt kein `allowDowngrade`. Ein Zurücksetzen von
  `channel/desktop/latest.yml` stoppt nur die weitere Verteilung von 1.6.17, stuft
  bereits aktualisierte Installationen aber nicht automatisch herunter. Für einen
  automatischen Rückweg wäre eine neue Version (1.6.18 mit dem Stand von 1.6.16) nötig.

## Aktivierung (19.10.2026)

Release `tracker-desktop-v1.6.17` veröffentlicht; öffentlicher Download geprüft
(100262066 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch). `latest.yml` und
`alpha.yml` auf Nutzerwunsch aktiviert. Windows-Installations- und Feldtest stehen
noch aus.
