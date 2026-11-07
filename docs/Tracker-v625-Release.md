# Tracker v625 Alpha – EFB-Kartenknöpfe in VR auf eigener Ebene

## Änderungen

- **Ursache (Feldtest 07.11.2026, nur VR):** Zoom-, Ebenen-, Zentrieren-Knopf und Zeichenleiste
  verschwanden beim Verschieben/Zoomen, blieben aber anklickbar. Ohne VFR-Overlay kamen sie gar
  nicht zurück, mit dem halbtransparenten Overlay schimmerten sie durch. Sichtbar blieben nur
  Elemente mit eigener Compositing-Ebene (Drawer-Griff, Leisten-Griff mit `transform`,
  Musiksteuerung außerhalb der Kartenfläche). In VR stellt Coherent die Karte (GPU-Ebene durch
  Leaflets `translate3d`) über alle Elemente ohne eigene Ebene, unabhängig vom z-Index.
- **Fix:** Die Knöpfe erhalten `transform: translateZ(0)` und damit eine eigene Ebene.
- **Rücknahme v624:** Der Deckkraft-Anstoß aus v624 ist entfernt. Er hatte einen Fehler:
  Überlappende Anstöße ließen die Deckkraft der Knöpfe dauerhaft auf 0,999 stehen.
- `EFB_WEB_ASSET_REVISION` 62501. Web-App unverändert (Cache bleibt v2356).

## Geprüft

- Tests: Tracker 1545/1547 (2 übersprungen, 0 Fehler), inkl. Coherent-Syntaxprüfung.
- Lokaler EFB-Test (Chrome): Positionen unverändert, Deckkraft 1, Zoom-Klick und Ebenen-Menü
  funktionieren.
- In VR noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v625` (Release-Commit `dce7ae7fc`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175014757 Bytes,
SHA-256 `6bed4f60fe4546cd461aaadf9a68231945460de232dbbc9451b5bfe9d5f5b4da`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
