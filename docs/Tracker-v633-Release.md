# Tracker v633 Alpha – Lauftempo je Personen-Figur

Zusammen ausgeliefert mit Web v2364 (Cache): Fundament des Boden-Composers (Etappe A),
hinter dem Testschalter `ga_person_figures_v1` (Standard aus).

## Änderungen Tracker

- **Lauftempo je Figur:** Personen laufen höchstens mit dem `maxWalkKts` ihrer Pack-Figur
  (Katalog `person`-Block, Wanderin 3 kt). Tarmac und unbekannte Titel behalten das
  angeforderte Tempo (`personWalkSpeedKts`).
- **Laufzeiten nach der langsamsten Figur** beim Einsteigen, Aussteigen, Abholer-Empfang,
  Besuchern und Fahrzeugpersonal – niemand verschwindet vor der Tür.
- `EFB_WEB_ASSET_REVISION` 63301.

## Web (gleichzeitig, hinter Testschalter)

- Personenliste `data/mission-person-assets.js` (Pack-Figuren + Tarmac-Stock).
- Figurwahl nach Look, Geschlecht, Jahreszeit (`mission-person-figure-core.js`), feste Liste
  Rolle → Look ohne KI.
- Bordliste (`mission-onboard-core.js`) und Boden-Composer (`mission-ground-visual-core.js`)
  für Charter, Sightseeing und Reporter; Rückflug behält die Personen.
- Figur je Pax beim Ein- und Aussteigen und im Manifest (`visualPersons`).

Details: `docs/Mission Ground Composer Fahrplan.md`, Abschnitt 3a. Gruppen bleiben bei
höchstens 5 Pax.

## Geprüft

- Neue Tests: Figurwahl 9/9, Bordliste 5/5, Boden-Composer 8/8, Personenregeln 6/6,
  Ground-Flow-Selftest, Tracker-Szenen-Effekte 21/21.
- App im Browser: Charter mit 2 Pax → Pax 2 ist die Wanderin, Sommerkleidung; ohne Schalter
  unverändert.
- **Im Simulator noch nicht geprüft.**

Stable bleibt unverändert.

## Aktivierung

Release `v633` (Release-Commit `3e1280a78`, gebaut im sauberen Worktree mit `--no-bytecode`),
`VFR-Multitool-Tracker.exe` 175050291 Bytes,
SHA-256 `e67561eb95b2f39f3aaa7234e63f3adae968b467929ec003911c6ce9a6725de7`,
öffentlicher Download geprüft. Alpha-Kanal aktiviert, Stable unverändert.
Tracker-Suite 1553/1559 (2 übersprungen); die 4 Fehler bestehen auch auf `2e3811c8a`.
