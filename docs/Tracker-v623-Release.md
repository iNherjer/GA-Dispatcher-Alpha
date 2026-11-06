# Tracker v623 Alpha / Web v2356 – Verkehr im Ruhemodus, EFB-UI-Korrekturen

## Änderungen

- **Verkehr auch im Ruhemodus:** Nach 5 min Bodenstillstand (`hibernate reason=ground_idle`)
  stellte der Tracker die Verkehrsabfrage ein; ein abfliegender Kontakt verschwand aus dem EFB
  (Feldtest Sedona 06.11.2026, Log). Jetzt fragt er im Ruhemodus für das EFB alle 10 s weiter ab;
  an das Relay geht dann nichts. Ohne Sim (`sim_disconnected`) keine Abfrage. Die Abfrage hängt
  nicht mehr an der Relay-Verbindung. Missions-Bodenbelegung im Ruhemodus unverändert leer.
- **Diagnose:** Debug-Log `TRAFFIC_SNAPSHOT` (Anzahl Luft/Boden, drei nächste mit Rufzeichen,
  Entfernung, Höhe, Boden, AGL, Klasse; minütlich und bei Änderung), EFB-Ereignis `traffic-map`
  (empfangen, Marker, Zoom, Boden, Schalter; bei Änderung).
- **EFB-UI (Coherent):**
  - Offenes Seitenmenü liegt über Ebenen-Knopf und PAX-Knopf.
  - „LDG“-Symbol kleiner, Abstand zum Text (Coherent kennt kein flex-gap).
  - Schattenwurf-Schalter als Umschaltknopf wie die anderen Anzeige-Schalter (Checkbox wurde
    in Coherent groß und ohne Haken gezeichnet).
  - Ebenen-Auswahl: eigener Punkt im gewählten Radio-Knopf.
  - Runde Schließen-Knöpfe: gezeichnetes X, immer mittig.
  - „Zentrieren“ aktiv: nach EFB-Neustart sofort auf das Flugzeug (Zoom ≥ 12).
- `EFB_WEB_ASSET_REVISION` 62301, Web-Cache v2356.

## Geprüft

- Tests: Tracker 1545/1547 (2 übersprungen, 0 Fehler), Web 214/214, EFB 148/148.
- Lokaler EFB-Test-Server (Chrome): Seitenmenü z-index 200100, Radio-Punkt, X gezeichnet,
  LDG 11 px + Abstand, Schatten-Knopf schaltet, Zentrieren nach Neustart (Zoom 12, 0,1 NM).
- Im MSFS (Coherent) noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v623` (Release-Commit `364ec413e`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175014023 Bytes,
SHA-256 `470cf2d232abed8bd2acc117d3bf0f2dfbdd2283090f21b9be8f2754c8440068`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
