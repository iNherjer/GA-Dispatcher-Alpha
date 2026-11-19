# Tracker v651 Alpha – Kartenspeicher auf dem PC, Flugplan ohne Mission senden, Flugplan holen (Host)

Zusammen mit Desktop 1.6.41. Quelle: Commit `2ac55247f` (19.11.2026), Details in
`docs/EFB-Development-Plan.md` (19.11.2026) und `docs/MSFS Flight Plan Transfer.md` (19.11.2026).

## Änderungen

- `tracker-efb-tile-proxy.js`: Kacheln auf der Platte unter `%LOCALAPPDATA%\VFR Multitool\Map Tile Cache`
  (7–30 Tage, 304-Nachfrage, alte Kopie ohne Internet, 1 GiB, älteste zuerst raus).
  `tracker-efb-http-server.js`: `GET /api/v1/tracker/map-tile-cache`, `POST /api/v1/tracker/map-tile-cache/clear`
  (Desktop-Steuertoken). Neue Logzeilen `EFB_TILE_CACHE_EVICT`, `EFB_TILE_CACHE_CLEARED`, `EFB_TILE_CACHE_ERROR`.
- EFB/Toolbar-Host: Kacheln zuerst über den Tracker (Einstellung `tileCache`, Schalter „Kartenspeicher“ im
  Kartenmenü), direkt/Backup als Rückfall.
- Missions-Reiter ohne Mission: Block „Flugplan“ – freie Route an MSFS / MSFS+Avionik / Flugsicherung senden
  (`flightplan_export` mit `free`), und mit EFB-/Toolbar-Paket 0.4.28 Route aus EFB-Planung, Flugsicherung,
  Avionik holen (Vorschau, Übernehmen per `navigation_adopt`). Während einer Mission ist Holen gesperrt.
- `EFB_WEB_ASSET_REVISION` 65101.

## Tests

Tracker-Suite im sauberen Release-Worktree `1d9c8c89b`: 1616/1618 bestanden, 2 übersprungen, 0 Fehler.
Desktop-Suite 152 bestanden, 3 übersprungen.

## Im Feld prüfen (noch nicht geprüft)

- Kacheln über den Tracker sichtbar, nicht schwarz (EFB, Toolbar, VR); sonst Schalter „Kartenspeicher“ aus.
- Nach zweitem Laden derselben Gegend `X-EFB-Tile-Cache: disk` im Log/Netz; Ordner wächst in LocalAppData.
- Senden ohne Mission an MSFS, Avionik, Flugsicherung.
- Holen erst mit Paket 0.4.28 (Windows-SDK-Bau, `docs/EFB-0.4.28-SDK-Handoff.md`).

## Artefakt

- Release `v651`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175334355 Bytes
- SHA-256: `df0e7098bc0ae3f8ec8545ac132a746cbc6126d02f04d6bbe5a3a447c444a24e`
- Öffentlicher Download geprüft (Größe und SHA-256 identisch), Alpha aktiviert, Stable unverändert.
