# Tracker v632 Alpha – eigene Figuren als Homebase-Mitarbeiter

Zusammen ausgeliefert mit Web v2363 (Cache), ga-proxy-Worker (12.11.2026) und
Homebase-Assetpaket 0.6.26 (Wanderin, seit 12.11.2026 im Stable-Kanal).

## Änderungen

- **Homebase-Personen aus dem Pack:** Figuren mit `person`-Block aus dem installierten
  Assetpaket laufen als Homebase-Mitarbeiter (erste Figur: Wanderin
  `tw-pod-hiker-f-01`). Registrierung getrennt von platzierbaren Objekten
  (`homebase-asset-catalog.js`: `registerRuntimePeople`, `personModelForTitle`).
  Die Objektregel für „VFR Multitool Homebase …“ bleibt unverändert.
- **Ersatzfigur:** Ist die Figur nicht installiert, nimmt der Tracker den mitgeschickten
  Tarmac-Ersatz (`fallbackTitle`, Log `HOMEBASE_PERSON_FALLBACK`), auch für Crew-Homebases.
- **Tempo:** Mitarbeiter laufen höchstens mit `person.locomotion.maxWalkKts` der Figur
  (Wanderin 3 kt).
- **Workbench-Katalog:** `publicAssetCatalog` und der gespeicherte aktive Index reichen den
  `person`-Block weiter, damit die Workbench die Figur anbieten kann.
- **Capability:** `homebase-pack-people-v1`. Ältere Tracker bekommen von App und Workbench
  automatisch die Ersatzfigur.
- `EFB_WEB_ASSET_REVISION` 63201.

## Web und Worker (gleichzeitig)

- Workbench: Gruppe „Eigene Figuren“ in der Mitarbeiterauswahl, Tempo-Grenze je Figur,
  gespeicherte Figuren bleiben ohne Tracker-Meldung erhalten.
- App/Szenenkern: `normalizePersonModel`, Ersatzfigur für Tracker ohne Capability.
- ga-proxy: Homebase-Cloud speichert eigene Figuren nur mit Tarmac-`fallbackTitle`
  (vor dem Web deployt, Version `6fd61da9-3e97-4a4f-bf08-899dd124123b`).

Details: `docs/Mission Person Asset Plan.md`, Abschnitt 7a.

## Geprüft

- Neue Tests: `homebase-pack-people.test.js` 3/3, `tools/homebase-scene-core.test.cjs` 9/9,
  Worker `npm test` vollständig grün.
- Workbench im Browser mit nachgestellter Tracker-Meldung zu Pack 0.6.26.
- **Im Simulator noch nicht geprüft:** Wanderin als Mitarbeiterin in der Homebase.

Stable bleibt unverändert.

## Aktivierung

Release `v632` (Release-Commit `78aea07a7`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175048944 Bytes,
SHA-256 `e78f40fa3516d91bcacbc4169bd09222789167b172503ec761ba2321905bd3b8`,
öffentlicher Download geprüft. Alpha-Kanal aktiviert, Stable unverändert (v631).

Tracker-Suite: 1550/1559 (2 übersprungen). Die 7 Fehler im Gesamtlauf: 3 zeitabhängige
Tests liefen einzeln grün; 4 (SAR V2 ×2, Teilsuche, Brandmeldung) bestehen auch auf
dem sauberen Stand `7ac0ac45b` und hängen nicht mit dieser Änderung zusammen.
