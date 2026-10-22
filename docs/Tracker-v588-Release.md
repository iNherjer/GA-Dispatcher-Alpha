# Tracker v588 Alpha / Web v2198 – Verladefenster öffnen

Folge zum Feldtest mit v587 (22.10.2026, schwacher Rechner, Web-App und EFB gleichzeitig):
Schließen des Verladefensters wurde auf alle Ansichten übertragen, Öffnen nicht; gelegentlich
meldete die Web-App beim Öffnen „nur am Boden und im Stillstand“, obwohl der Tracker weder Pause
noch Menü sah.

## Änderungen

- **Öffnen wird synchronisiert** (`tracker-cockpit-control-core.js`): `open_cargo_window` stand
  nicht in der Liste erlaubter Missionsbefehle und wurde mit `mission_intent_not_allowed`
  abgewiesen – seit v572, für EFB und Web-App. Missionslogik und Empfänger
  (`cargoWindowOpenId` in Web-App und EFB) waren vorhanden. Zusätzlich darf das Öffnen wie das
  Schließen nach einem Revisionskonflikt erneut gesendet werden (`mission-authority-core.js`,
  `tracker-cockpit-session-client.js`).
- **Vorprüfung beim Öffnen im Tracker-Modus** (`mission-cargo-core.js`): In den Phasen
  `prepare`, `boarding`, `end_unloading`, `end_ready` mit Tracker-Freigabe für Verladeaktionen
  sperren fehlende oder lückenhafte App-Flugdaten das Verladefenster nicht mehr; eindeutiges
  Rollen sperrt weiter. Außerhalb dieser Phasen bleibt die lokale Prüfung, die Meldung nennt den
  konkreten Grund (`checklists.js`), Debug-Eintrag `cargo_ground_dialog_gate`. Web-Modus unverändert.

Tracker v588, Host-Assetrevision 58801 (EFB-Client und übersetzte `checklists.js` geändert),
Web-Cache v2198. EFB-/Toolbar-Community-Paket und Desktop-Installer unverändert. Nur Alpha-Runtime
umstellen.

## Prüfung

- `tracker-cockpit-control-core.test.js` (16, neu: Öffnen/Schließen aus EFB und Web-App,
  Wiederholung nach Revisionskonflikt), `tools/mission-cargo-ground-dialog-gate.test.mjs` (4, neu).
- `tracker-mission-run-view.test.js`: Abbruch im Test wiederholt bei Revisionskonflikt durch
  Hintergrund-Effekte (Testzeitfehler, kein Produktfehler).
- Gesamtsuite `ga-tracker-client/*.test.js`: 1458 Tests, 1421 bestanden, 35 Fehlschläge – dieselben
  wie bei v587, keine neuen. App-Cargo-Tests (30) bestanden.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build
  `--no-bytecode --public --public-packages '*'`. PE32+ x86-64; v588, Assetrevision 58801 und
  `open_cargo_window`-Freigabe eingebettet geprüft.

EXE: 174282892 Bytes; SHA-256 `d9e44430188c78a8597488c8e03f4d2322a8de56a4df5fb2906ffee121b20bd1`.

## Im Feld prüfen

- Verladefenster in Web-App öffnen → EFB öffnet mit; im EFB öffnen → Web-App öffnet mit.
- Öffnen per Kartentisch-Knopf während Boarding: keine Sperre durch Telemetrielücken; beim Rollen
  weiterhin gesperrt. Falls doch gesperrt: Grund in der Meldung und `cargo_ground_dialog_gate` im
  App-Debug.
