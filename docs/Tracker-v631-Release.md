# Tracker v631 Alpha – Flugplan-Meldung obenauf

Zusammen ausgeliefert mit EFB-/Toolbar-Paket 0.4.27 und Web v2361 (Cache).

## Änderungen

- **EFB:** Die Meldung nach „Route laden“ / Flugplanübertragung lag unter anderen Anzeigen
  (Feldtest 10.11.2026). Jetzt oben über allem, grüner Rand bei Bestätigung, oranger bei
  Hinweis, schließt per Antippen (`tracker-efb-kartentisch-host.js`).
- `EFB_WEB_ASSET_REVISION` 63101.

## EFB-Paket 0.4.27 (gleichzeitig)

ATC-Einreichung mit Flugplatz-Fixes und Benutzer-Wegpunkten (`WP01…`), siehe
`docs/EFB-Development-Plan.md` (10.11.2026).

## Geprüft

- Tracker 1554/1556 (2 übersprungen, 0 Fehler), Brücke 12/12. Im MSFS-EFB noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v631` (Release-Commit `9fdef41ff`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175043670 Bytes,
SHA-256 `a3ecec5fd5eb7d612afb5b4d0943e10460c4d2de13b1271f3f58ee442dab1c17`, öffentlicher Download geprüft.
EFB-/Toolbar: `efb-app-v0.4.27`, 456305 Bytes, SHA-256
`6cb56431520160082ccbc1dc79d0483bd38dadb5be1b451203920847ef307c88`, öffentlicher Download geprüft.
Beide Alpha-Kanäle aktiviert, Stable unverändert (Tracker v605).
