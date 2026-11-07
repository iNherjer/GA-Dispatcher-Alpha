# Tracker v624 Alpha – EFB-Bedienknöpfe in VR nach Zoom sichtbar

## Änderungen

- **Bedienknöpfe in VR:** Nach Zoomen oder Verschieben der EFB-Karte zeichnete Coherent in VR
  Zoom-, Ebenen-, Zentrieren- und Leisten-Knopf teils nicht neu: anklickbar, aber unsichtbar,
  bis z. B. ein Klick auf die Musiksteuerung ein Neuzeichnen auslöste (Feldbericht 07.11.2026,
  reproduzierbar, nur VR). Nach `zoomend`/`moveend`, Ebenenwechsel und geladenen Kacheln setzt
  der Host die Deckkraft der Knöpfe für ein Frame auf 0,999 (sofort und nach 450 ms) und erzwingt
  damit das Neuzeichnen. Keine z-Index-Änderung, keine Fachlogik betroffen.
- `EFB_WEB_ASSET_REVISION` 62401. Web-App unverändert (Cache bleibt v2356).

## Geprüft

- Tests: Tracker 1545/1547 (2 übersprungen, 0 Fehler), inkl. Coherent-Syntaxprüfung.
- Im MSFS/VR noch nicht geprüft – Tester kann reproduzieren und prüft direkt.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v624` (Release-Commit `e91cda75d`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175015467 Bytes,
SHA-256 `1ef3dc13a12d468563af0f19f6fbd11cecb079142f0ededdcb0170a6f6e41379`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
