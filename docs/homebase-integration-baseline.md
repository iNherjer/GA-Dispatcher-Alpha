# Homebase-Integration: geschützte Tracker-Baseline

Stand: 15.07.2026

Diese Baseline dokumentiert den gesicherten Rückfallstand vor der Homebase-Integration.

## Produktiver Rückfallstand

- Git-Commit vor Beginn: `4dc81ae991cea4f8f733856e0e5d62fa551bc9d5`
- Tracker-Version: `v278` / Versionscode `278`
- SHA-256 des unveränderten Quellstands `ga-tracker-client/tracker.js`: `6f7c489d8a8d14f4cc299d59cb0a3fbcd98a70357d53953630406c8d343b7482`
- SHA-256 der produktiven EXE `VFR-Multitool-Tracker.exe`: `4d133f774928ab805da03f0670709c8fb9e86a5f824c1990935a86b010fa7dd1`
- Der EXE-Hash stimmt mit dem Asset des GitHub-Releases `VFRMultitool` vom 11.07.2026 überein.

## Teststand

- Letzte getrennte Test-Quellversion: `v285-homebase-test7`
- Ausgabe: `VFR-Multitool-Tracker-Homebase-Test.exe`
- Eigene Konfiguration: `tracker-homebase-test-config.json`
- Eigenes Laufzeitlog: `homebase-tracker-test-debug.txt`
- Die Test-EXE darf nicht in `VFR-Multitool-Tracker.exe` umbenannt und nicht auf das Release `VFRMultitool` hochgeladen werden.
- Produktive und Test-EXE dürfen nicht gleichzeitig mit derselben Pilot-ID laufen.

## Produktionsfreigabe

Die folgenden Prüfpunkte bildeten die Release-Sperre während der Entwicklung:

1. Vorschau: Setzen, Verschieben, Stapeln, Entfernen und Wiederherstellen.
2. Ground-Probe, Karton- und Palettenhöhen auf ebenem und geneigtem Boden.
3. Hangarausrichtung und Fahrzeuge.
4. Assetinstallation: Remote-Prüfung, Nutzerbestätigung, Hash-/Indexprüfung, fehlend, veraltet, abgelehnt, idempotent und Rollback.
5. SDK-Build, atomare Installation, Rollback und Deinstallation.
6. Spawnpunkt `VFHB` in der MSFS-Weltkarte.
7. Regressionstest bestehender Missions-, Cargo-, Passagier-, Feuer- und Rauchszenen.
8. Neustarttest von App, Tracker und MSFS.
9. Ausdrückliche Freigabe durch den Projektinhaber.

Der Projektinhaber hat die Integration am 15.07.2026 nach den gemeinsamen Live-Tests
zur Veröffentlichung freigegeben. Das erste Produktionsrelease mit Homebase ist
`v286`. Der oben dokumentierte Stand `v278` bleibt als bekannter Rückfallstand erhalten.

Tracker `v288` ist die erste vollständig bereinigte Produktionslinie: App, Workbench
und Tracker verwenden ausschließlich das Protokoll `homebase_v1`; das gemeinsame
Assetpaket heißt `vfr-multitool-homebase-assets` und beginnt unter dieser Identität mit
Version `0.6.0`. Die Angaben im Abschnitt „Teststand“ bleiben ausschließlich als
historische Rückfall- und Prüfspur erhalten.

## Geräteübergreifende Planung

- Die Workbench speichert jede Änderung sofort lokal.
- Bei aktiviertem Pilot-Auto-Sync wird der Entwurf getrennt vom übrigen Pilot-Profil unter `homebase:<Pilot-ID>` im KV gehalten.
- Ein Cloud-Schreibvorgang erfolgt 30 Sekunden nach der letzten Änderung, beim Schließen der Workbench oder wenn die App in den Hintergrund wechselt/verlassen wird.
- Die Haupt-App führt den authentifizierten KV-Zugriff aus; Pilot-PIN und Cloudzugriff werden nicht an den Tracker übergeben.
- Der Tracker bleibt ausschließlich für Live-Vorschau, Paketbau und Installation zuständig.
- Revisionskonflikte werden nicht still überschrieben. Die Workbench lässt den Benutzer zwischen Cloud- und lokalem Stand wählen.

## Laufzeit-Guard ab 14.08.2026

- `homebase_v1.capabilities` darf nach einer Antwort ohne
  `homebase-crew-scene`, einem fehlenden ACK oder einem Sendefehler fruehestens
  nach 15 Sekunden erneut gesendet werden.
- Eine negative Antwort bedeutet waehrend des Trackerstarts nur, dass der
  SimConnect-Objektmanager noch nicht bereit ist. Sie darf keinen rekursiven
  Sofortversuch ausloesen.
- Der 5-Sekunden-Trackerstatus haelt die spaetere Aushandlung auch im
  Telemetrie-Hibernate am Leben. Nur ein neuer Relay-Verbindungs-Token setzt
  das Retry-Gate sofort zurueck.

## Tracker lädt die eigene Homebase selbst aus der Cloud (22.10.2026, lokaler Kandidat)

Feldbefund (Tracker v587, schwacher Rechner): Beim Start baute der Tracker die
Homebase dreimal komplett auf (84 Spawns, 56 Entfernungen in 30 s) – erst aus
seinem Zwischenspeicher, dann je einmal aus zwei App-Clients mit abweichender
Szenensignatur. Das System stammt aus der Zeit ohne Cloud-Zugriff des Trackers.

- **Gemeinsamer Szenen-Kern** `homebase-scene-core.js`: Cloud-Datensatz
  (`record.plan`) + Status des installierten Homebase-Mods → Live-Szene
  (Objekte, Personen, Navigation, Türzustände) und Signatur. Unverändert aus
  `homebase-integration.js` herausgelöst; einmaliger Vergleich gegen die alte
  App-Rechnung: 1600/1600 zufällige Pläne mit allen Paketstatus-Varianten
  identisch. App und Tracker nutzen beide den Workbench-Katalog
  `homebase/homebase-asset-catalog.js`.
- **Tracker** (`ga-tracker-client/tracker-homebase-cloud.js`): lädt beim Start
  (nach 1,5 s), alle 15 min, nach Paket-Installation/-Entfernung und auf
  `homebase_v1.cloud.refresh` die Homebase über `/api/homebase/<Pilot>` mit den
  vorhandenen Zugangsdaten, baut sie mit dem Kern und speichert sie im
  bestehenden Zwischenspeicher. Angewendet wird wie bisher über den
  Fallback-Weg im 20/22-NM-Radius; beim Start erst nach dem ersten Abruf
  (höchstens 8 s), damit nicht doppelt aufgebaut wird. Telemetrie
  `gpsMsg.homebase.capabilities` enthält `homebase-cloud-scene-v1`,
  `gpsMsg.homebase.cloudScene` den Status (`idle`, `loading`, `ok`, `empty`,
  `legacy`, `error`).
- **App**: baut nur noch selbst auf und schickt keinen Zwischenspeicher, wenn
  der Tracker nicht zuständig ist: alter Tracker ohne Fähigkeit, Status `empty`
  (keine Homebase in der Cloud), `legacy` (Datensatz Schema < 2 mit lokalen
  Personen), `error` (z. B. PIN falsch, offline, Mod ohne Vergleichsstand),
  Cloud-Sync in der App aus (rein lokale Homebase) oder ein ungespeicherter
  Workbench-Entwurf. Platzieren/Verschieben laufen unverändert direkt
  (`preview.object.add/move/remove`). Nach erfolgreichem Speichern schickt die
  App `homebase_v1.cloud.refresh`.
- **Entwurfsvorrang**: Die App kennzeichnet `fallback.store` mit `draftDirty`.
  Solange ein Entwurf aktiv ist, überschreibt der Cloud-Abgleich den
  Zwischenspeicher nicht (`HOMEBASE_CLOUD_DEFERRED`); nach dem Speichern hebt
  `cloud.refresh` mit `draftDirty: false` den Vorrang auf.
- **„Live-Ergänzungen entfernen“** in der Workbench: `homebase_v1.fallback.suppress`
  blendet den Tracker-Stand bis zum Verlassen des Radius aus; „Aktualisieren“
  schickt `cloud.refresh` mit `clearSuppression`.

- **Bearbeiten bleibt live**: Verschieben, Hinzufügen und Entfernen in der
  Workbench gehen unverändert als Einzelbefehle direkt an den Tracker
  (`preview.object.move/add/remove`, ohne Neu-Spawn beim Verschieben). Auch alle
  SDK-Paket-Aufträge (`package.prepare/build/install/uninstall`) laufen
  unverändert über die App. Nach erfolgreicher Installation oder Entfernung des
  Mods lädt der Tracker die Szene neu (an der Erfolgsmeldung, nicht zeitgesteuert).
- **Übernahme ohne Neuaufbau**: Bevor der Tracker einen neuen Stand anwendet,
  prüft der Object-Manager (`previewObjectsMatch`), ob alle Vorschau-Objekte
  schon mit gleicher ID, Titel, Position, Höhe, Richtung und Größe stehen. Dann
  übernimmt er nur die Signatur und gleicht Personen/Wege per
  `preview.people.sync` an (`HOMEBASE_FALLBACK_ADOPT`). Das gilt insbesondere
  nach dem Speichern eines Workbench-Entwurfs: Workbench und Kern berechnen
  Positionen mit derselben Formel.

- **Crew-Homebases ohne App** (`ga-tracker-client/tracker-homebase-crew.js`):
  Der Tracker liest den Gruppennamen aus dem Cloud-Profil (`field:groupName`,
  alle 10 min), ruft `/api/homebase-group/<Gruppe>` alle 45 s ab (der Server
  prüft die Mitgliedschaft und lässt die eigene Basis weg) und baut mit dem
  Kern dieselbe Crew-Szene wie bisher die App: 10-NM-Radius, nächste Basis
  zuerst, dann reihum Personen und Ausstattung, höchstens 100 Objekte
  (Vergleich gegen die alte App-Rechnung: 900/900 identisch). Angewendet per
  `homebase_v1.crew.set` nur bei Änderung (`HOMEBASE_CREW_APPLY`). Keine Gruppe
  oder nicht mehr Mitglied (403) leert die Crew-Szene; bei Netzwerkfehlern
  bleibt die stehende Szene unangetastet. Telemetrie: Fähigkeit
  `homebase-crew-cloud-v1`, Status `gpsMsg.homebase.crewScene`
  (`idle`, `loading`, `ok`, `no-group`, `error` + `groupName`).
- **App und Crew**: Die App schickt keine Crew-Szene mehr, wenn der Tracker die
  Fähigkeit meldet, den Status `ok`/`no-group` hat und dieselbe Gruppe kennt.
  Beim Beitreten/Verlassen einer Gruppe schickt sie `homebase_v1.crew.refresh`
  mit dem neuen Gruppennamen, weil der Profil-Sync noch ausstehen kann. Das
  Crew-Verzeichnis für Karte und Board lädt die App weiter selbst.

Grenzen: Unterscheiden sich Objekte wirklich, baut der Tracker die Vorschau wie bisher
komplett neu auf (gezielter Teil-Neuaufbau steht noch aus).

Tests: `tools/homebase-scene-core.test.cjs`,
`ga-tracker-client/tracker-homebase-cloud.test.js`,
`ga-tracker-client/homebase-preview-adopt.test.js`,
`ga-tracker-client/tracker-homebase-crew.test.js`.
Log: `HOMEBASE_CLOUD_SCENE`, `HOMEBASE_CLOUD_EMPTY`, `HOMEBASE_CLOUD_LEGACY`,
`HOMEBASE_CLOUD_ERROR`, `HOMEBASE_CLOUD_DEFERRED`, `HOMEBASE_FALLBACK_ADOPT`, `HOMEBASE_CREW_GROUP`, `HOMEBASE_CREW_BASES`, `HOMEBASE_CREW_APPLY`, `HOMEBASE_CREW_ERROR`, `HOMEBASE_FALLBACK_STORE source=cloud|app|app-draft`.
