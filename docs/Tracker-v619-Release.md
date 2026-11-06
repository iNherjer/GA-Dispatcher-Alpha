# Tracker v619 Alpha / Web v2351 – Schattenwurf der Flugzeug-Icons

## Änderungen

- **Schattenwurf** für das eigene Flugzeug und den Verkehr auf der Karte: weicher Schatten der
  Silhouette, Sonne aus Nordwest (Schatten nach Südost). Je höher über Grund, desto weiter
  versetzt, weicher und heller. Icon und Mittelpunkt bleiben exakt; am Boden kein Schatten.
- **Labels im Vordergrund:** Höhe und Rufzeichen liegen über dem Schatten.
- **Karten-Menü** (Anzeige → Flugzeug Icon → Schattenwurf): Schalter, Max. Dunkelheit, Schärfe,
  Versatz. Alle Regler stehen auf 50 % = vom User am 06.11.2026 gewählte Standardwerte
  (darkest 45 %, Blur-Faktor 1,0, 8 px pro 1000 ft bis 40 px); 0–100 % gibt Luft in beide
  Richtungen. Gespeichert in `ga_icon_shadow_v2` (global).
- **Höhe über Grund pro Kontakt:** Tracker liest `PLANE ALT ABOVE GROUND` und sendet `agl`
  (nicht am Boden). Ohne Wert (ältere Tracker): Schätzung über das Gelände unter dem eigenen
  Flugzeug.
- Rechnung: `iconShadowFilter` in `map-live-presentation.js`; Karte `sync.js`
  (`_trafficShadowFilter`, `refreshOwnPlaneShadow` → `--plane-shadow`), EFB-Host für das eigene
  Flugzeug. `EFB_WEB_ASSET_REVISION` 61901.

## Geprüft

- Browser mit simulierten Daten: Schatten eigenes Flugzeug/Verkehr, gleiche MSL über Tal/Berg
  unterschiedlich, Labels über dem Schatten, Regler und Schalter, Standard 50 %.
- Tests: Web 207/207, EFB 147/147, Tracker 1539/1545 (2 übersprungen; 4 zeitabhängige Missions-/Audio-Integrationstests im Gesamtlauf rot, einzeln grün).
- EFB: Schatten nur für das eigene Flugzeug (das EFB zeigt keinen Verkehr auf der Karte).
- Im MSFS noch nicht geprüft, ob `PLANE ALT ABOVE GROUND` für alle KI-/Mitspieler-Flugzeuge kommt.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v619` (Release-Commit `ad65fa052`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 174986735 Bytes,
SHA-256 `4eb1f10b4d3465019c98b2137d1ea0cc62aff3ae3d60ea26cde315e5d3fa4497`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605). Desktop und Worker unverändert.
