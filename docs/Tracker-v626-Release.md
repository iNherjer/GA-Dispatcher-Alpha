# Tracker v626 Alpha – EFB ohne Milchglas, deckende Flächen

## Änderungen

- **Kein Milchglas im EFB:** Der Tester empfand das EFB in VR als stark halbtransparent; die
  Kartenknöpfe verschwinden dort weiterhin (Feldbericht 09.11.2026, nach v625). Das EFB übernimmt
  das App-Design (Modern/Retro/NavCom/1940/Win95). Modern legte `backdrop-filter` (Milchglas) auf
  die gesamte Kartenfläche (`#mapTableOverlay`, blur 14 px), die Kopfleiste (blur 18 px, 70 %
  deckend) und den Zeichen-Knopf. Das zwingt Coherent zu zusätzlichen Zwischenebenen – Kandidat
  für die VR-Ebenenfehler.
- Im EFB jetzt in allen Designs `backdrop-filter: none`; Kopfleiste und Zeichen-Knopf deckend in
  den bisherigen Farbtönen (Modern `#0a1016`, Retro/NavCom `#1a1a1a`, 1940 `#0e0b08`, Knopf
  `#141414`). Web-App unverändert.
- Eigene Knopf-Ebenen aus v625 bleiben.
- `EFB_WEB_ASSET_REVISION` 62601. Web-Cache bleibt v2356.

## Geprüft

- Tests: Tracker 1545/1547 (2 übersprungen, 0 Fehler).
- Lokaler EFB-Test (Chrome), alle Designs: kein `backdrop-filter`, Kopfleiste deckend,
  Seitenmenü und Kartenmenüs deckend, Aussehen sonst unverändert.
- In VR noch nicht geprüft. Bleiben die Knöpfe weg: Schattenwurf (Menü Anzeige) als nächster
  Verdacht.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v626` (Release-Commit `e7ca2fb85`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175015960 Bytes,
SHA-256 `e96b747e9318b9f0e961661e2aede1092f9b0f8e73bf32a8c2913dd849b89674`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
