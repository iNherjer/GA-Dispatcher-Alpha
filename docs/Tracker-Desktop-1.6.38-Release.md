# Desktop 1.6.38 / Web v2317 – Vereinsflotte: gelöschte Maschine durch Neuaufnahme zurückholen

## Änderungen

- Desktop 1.6.38: Wird eine aus der Flotte gelöschte Maschine im Mod-Hangar entfernt und neu aufgenommen, kommt
  sie in die Vereinsflotte zurück, mit diesem Piloten als Halter. Weiterfliegen einer alten Kopie zählt nicht.
- Worker: Upload mit `restore: true` ersetzt den Löschvermerk durch einen neuen Datensatz.
- `wili-fleet-core.js`: Hinweis „… wieder in der Flotte“ (App sofort, EFB mit dem nächsten Tracker-Build).

## Aktivierung

Release `tracker-desktop-v1.6.38` (Worktree `1089bb31d`), Installer 100311089 Bytes, Download geprüft
(SHA-512 wie `latest.yml`). Worker 7eb3dc40 deployt. Tests: Desktop 147/147, Worker vollständig.
`latest.yml`/`alpha.yml` aktiviert.
