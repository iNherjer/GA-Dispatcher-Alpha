# Tracker v589 Alpha / Web v2199 – Homebase und Crew aus der Cloud

Folge zum Feldtest vom 22.10.2026: Beim Tracker-Start wurde die Homebase dreimal komplett
aufgebaut (84 Spawns, 56 Entfernungen in 30 s), weil Zwischenspeicher und zwei App-Clients
unterschiedliche Szenen schickten. Die Homebase-Synchronisation stammte aus der Zeit ohne
Cloud-Zugriff des Trackers.

## Änderungen

- **Gemeinsamer Szenen-Kern** `homebase-scene-core.js` für App und Tracker: Cloud-Datensatz +
  Status des installierten Mods → Live-Szene und Signatur; Crew-Szene (10 NM, max. 100 Objekte).
  Unverändert aus `homebase-integration.js` herausgelöst (Vergleich: eigene Homebase 1600/1600,
  Crew 900/900 identisch).
- **Eigene Homebase**: Der Tracker lädt `/api/homebase/<Pilot>` selbst (Start, alle 15 min, nach
  Mod-Installation/-Entfernung, nach Speichern in der App) und baut im Radius auf; beim Start
  erst nach dem ersten Abruf (max. 8 s). Die App baut nur noch bei altem Tracker, ungespeichertem
  Workbench-Entwurf, rein lokaler Homebase oder Fehlern beim Tracker.
- **Bearbeiten bleibt live**: Verschieben/Hinzufügen/Entfernen und alle SDK-Paket-Aufträge laufen
  unverändert direkt über die App. Stehen alle Objekte schon so im Sim, übernimmt der Tracker einen
  neuen Stand ohne Neuaufbau und gleicht nur Personen/Wege an (`HOMEBASE_FALLBACK_ADOPT`).
- **Crew-Homebases ohne App**: Gruppenname aus dem Cloud-Profil, Abruf
  `/api/homebase-group/<Gruppe>` alle 45 s, Aufbau per `crew.set` nur bei Änderung. Gruppenwechsel
  in der App wird sofort übernommen.

Tracker v589, Host-Assetrevision 58801 (unverändert), Web-Cache v2199. EFB-/Toolbar-Community-Paket
und Desktop-Installer unverändert. Nur Alpha-Runtime umstellen. Details:
`docs/homebase-integration-baseline.md` (22.10.2026).

## Prüfung

- Neu: `tools/homebase-scene-core.test.cjs` (8), `tracker-homebase-cloud.test.js` (9),
  `tracker-homebase-crew.test.js` (8), `homebase-preview-adopt.test.js` (2).
- `homebase-self-test.js`, Tür-Selbsttest, `homebase-capability-retry-core.test.js` (8),
  Bodenablauf-Selbsttest bestanden.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1477 Tests, 1440 bestanden, 35 Fehlschläge – dieselben
  wie bei v588, keine neuen.
- Vorschau-Browser: App startet ohne Fehler; mit crew-fähigem Tracker sendet sie beim Gruppenbeitritt
  nur `crew.refresh` mit Gruppenname, kein `crew.set`.
- Gepackter Starttest (node18-macos-arm64): Kern, Workbench-Katalog, Homebase- und Crew-Modul lösen
  im pkg-Snapshot auf (`HOMEBASE_PACKAGED_SMOKE_OK`).
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`.
  PE32+ x86-64; v589 und beide Fähigkeiten eingebettet geprüft.

EXE: 174353212 Bytes; SHA-256 `b975aa54709f8f46f5ba20a7fc983ed39a6578dbdb68cebadb056e76e626776b`.

## Im Feld prüfen

- Tracker-Start ohne offene App an der Homebase: `HOMEBASE_CLOUD_SCENE`, danach genau ein Aufbau.
- Mit App: kein zweiter Aufbau beim Start; Workbench-Verschieben live, nach Auto-Speichern
  `HOMEBASE_FALLBACK_ADOPT` statt Neuaufbau.
- Crew: `HOMEBASE_CREW_GROUP`, `HOMEBASE_CREW_BASES`, Crew-Basis im 10-NM-Radius erscheint auch ohne App.
- Rückfall: alte Clients/Tracker nutzen den bisherigen Weg (fähigkeitsgesteuert).

Release-Upload verifiziert und EXE öffentlich erneut heruntergeladen: Größe und SHA-256 identisch.
`channel/alpha.json` auf v589 umgestellt, `stable.json` unverändert.
