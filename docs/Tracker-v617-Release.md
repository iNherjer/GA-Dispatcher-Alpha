# Tracker v617 Alpha / Desktop 1.6.40 / Web v2349 – Verkehrswarnungen

## Änderungen

- **Verkehrswarnungen mit Sprachbausteinen** (Warntyp `traffic`, Tracker-owned wie die
  vertikalen Luftraumwarnungen):
  - „Achtung, Verkehr, elf Uhr, unterhalb/oberhalb/gleiche Höhe“, sobald ein Kontakt in die
    Warnstufe kommt (≤ 1 NM und ±600 ft oder Annäherung auf ≤ 0,5 NM in 40 s).
  - „Verkehr, ausweichen! Verkehr, ausweichen!“ bei vorhergesagter Annäherung auf ≤ 0,3 NM und
    500 ft innerhalb von 20 s.
  - Keine Wiederholschleife, kein Bodenverkehr, keine Warnung am Boden. Kontakte werden auf
    „jetzt“ vorgerechnet (Liste kommt alle 5 s).
- **Blinken:** Karte (orange/rot), Höhenband mit neuen Seitenansichten je Klasse.
  `trafficAlerting` im Warn-Snapshot lässt alle Geräte dieselben Kontakte blinken.
- **Schalter „Verkehrswarnungen“:** Web/EFB-Audio-Menü, Desktop-App, Worker-Einstellung
  `traffic` (Worker deployed 06.11.2026, Version `ce3f6c05`).
- **75 neue Clips:** `aw-verkehr`, `aw-ausweichen`, `aw-gleiche-hoehe`, `aw-uhr-1` … `aw-uhr-12`
  für Anna, Ava EN, Matilda, Hannah, Liam.
- `EFB_WEB_ASSET_REVISION` 61701. Details: `docs/Traffic Warnings.md`.

## Verträglichkeit

- v617 + alte Desktop-App: Warnungen laufen und spielen über den gewählten Ausgang; den
  Schalter gibt es dort erst ab Desktop 1.6.40 (Web/EFB-Menü funktioniert).
- Älterer Tracker + neue Web-App: Schalter gesperrt, Blinken aus der lokalen Einstufung.
- Neue Felder (`capabilities.traffic`, `trafficActive`, `trafficAlerting`) sind additiv.

## Geprüft

- Neue Tests: Detektor 6/6, Tracker-Warndienst inkl. Verkehr 18/18; Warn-/Audio-Paket 109/109,
  Web 204/204, Desktop 150/150 (3 übersprungen).
- Tracker gesamt: 1537/1545 (2 übersprungen); die 6 Fehler sind zeitabhängige Missions-/Audio-
  Integrationstests, einzeln grün (fire-process auch auf sauberem `origin/main` wechselnd).
- Browser: Blinken Karte/Höhenband, Schalter gesperrt ohne Fähigkeit.
- Im MSFS noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v617` (Release-Commit `fa182781a`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 174965081 Bytes,
SHA-256 `04a2ba9e59bd092132f46a0ab297986e55851973899c7964df2fd2588162ec7e`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
Clips: alle 75 unter GitHub Pages abrufbar geprüft, bevor der Kanal umgeschaltet wurde.
Worker: deployed 06.11.2026, Version `ce3f6c05-2381-4734-98c8-58fa15570b72`.

Desktop: _wird nach dem Desktop-Release ergänzt_
