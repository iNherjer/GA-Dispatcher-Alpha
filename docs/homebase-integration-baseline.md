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
