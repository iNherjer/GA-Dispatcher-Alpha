# Tracker v616 Alpha / Web v2347 – Traffic-Anzeige neu

## Änderungen

- **Keine stehenden Geisterkontakte mehr:** Die Webkarte führt Marker über die stabile
  SimConnect-Objekt-ID (`id: "o<objectID>"`). Die frühere Nähe-Zuordnung konnte Marker
  überschreiben, ohne sie von der Karte zu nehmen; sie stapelten sich entlang der Flugwege.
  Kontakte ohne ID (älterer Tracker) laufen weiter über die Nähe-Zuordnung, jetzt ohne Leck.
- **Leere Liste wird mitgesendet:** Der Tracker sendet `traffic: []`, wenn niemand mehr in
  Reichweite ist. Zusätzlich verschwinden im Web alle Kontakte, wenn 15 s keine Liste kommt.
- **Nur Luftfahrzeuge:** Abgefragt wird weiter Typ ALL (der Bodenverkehr für freie
  Ankunftsplätze braucht auch Fahrzeuge, unverändert). Angezeigt werden nur `CATEGORY`
  Airplane/Helicopter; Boote, Fahrzeuge und Szenenobjekte fallen weg.
- **Neue Felder je Kontakt (additiv):** `vs`, `gnd` (am Boden), `cs` (ATC ID), `k`
  (Symbolklasse aus `ENGINE TYPE`, `NUMBER OF ENGINES`, `ATC HEAVY`: single/twin/jet/heavy/heli),
  `m` (Mustercode aus `ATC MODEL`). Bis zu 20 Kontakte in der Luft plus 20 am Boden im Umkreis
  von 5 NM.
- **Warnstufen (`classifyTraffic` in `map-live-presentation.js`):** Warnung (orange) bei
  ≤ 1 NM und ±600 ft oder Annäherung auf ≤ 0,5 NM innerhalb von 40 s; nah ≤ 6 NM und ±1200 ft;
  sonst „weiter weg“. Bodenverkehr wird angezeigt (grau), aber nie gewarnt. Steht das eigene
  Flugzeug am Boden, gibt es keine Warnung.
- **Neue Symbole** mit schwarzer Outline (1-mot, 2-mot, Jet, Heavy, Heli), Rufzeichen und
  Mustercode im Label, Steig-/Sinkpfeil.
- **Anzeige → 🛩 Traffic Icons:** Größe 16–56 px (Standard 28) und Umrandung 0–3 px
  (Standard 1,5), gespeichert in `ga_traffic_icon_size` / `ga_traffic_icon_outline`.
- **EFB:** Höhenprofil nutzt nur Verkehr in der Luft. `EFB_WEB_ASSET_REVISION` 61601.
- Mitgezogen: EFB-Kopie `efb-web-assets/i18n/en-phrases.js` (fehlte seit `0006f5d75`).

## Verträglichkeit

- Neuer Tracker + alte Web-App: zusätzliche Felder werden ignoriert, die Liste kommt auch leer.
- Alter Tracker + neue Web-App: Kontakte ohne `k` erhalten das 1-mot-Symbol, Zuordnung über Nähe.

## Geprüft

- Tests: siehe Release-Commit; `map-live-presentation.test.js` 11/11 inkl. Warnstufen und Symbole.
- Browser mit simuliertem Verkehr: keine Stapelung nach wiederholten Updates, leere Liste und
  Ablaufzeit räumen die Karte, Regler speichern und zeichnen neu.
- Im MSFS noch nicht geprüft: Stabilität der Objekt-ID (Log `[TRAFFIC] … IDs wie zuvor x/y`,
  einmal pro Minute), ob Mitspieler-Flugzeuge gemeldet werden und ob `ENGINE TYPE`/`ATC MODEL`
  für alle KI-Modelle gefüllt sind.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v616` (Release-Commit `34694c8ba`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 174947099 Bytes,
SHA-256 `e355297b22b094f9b6c2834471e95c7725005bd02e6c69cebda4a3c88a70cd24`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).

Tests im Release-Commit: Tracker 1541/1543 (2 übersprungen, 0 Fehler).
