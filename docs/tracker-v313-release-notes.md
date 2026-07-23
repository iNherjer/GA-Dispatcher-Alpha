# Tracker v313: Online-Assets und persistente Homebase

Stand: 23.07.2026

## Releaseumfang

Tracker `v313` trennt die Homebase-Modelle vollständig von der Tracker-EXE und
erweitert den lokalen Homebase-Fallback um bestätigte Tor- und Lichtzustände.
Gleichzeitig startet die SimConnect-Verbindung unabhängig von der Relay-Verbindung,
damit eine bereits gespeicherte Homebase auch ohne geöffnete App beziehungsweise bei
einem vorübergehend nicht erreichbaren Relay verwaltet werden kann.

Die App verlangt ab diesem Release mindestens Tracker `v313`.

## Release-Artefakt

- Tag: `v313`
- Datei: `VFR-Multitool-Tracker.exe`
- Größe: `45.743.026` Bytes
- SHA-256: `0ece1bf6361097da0c3c7bff4362752029c176b289db830aea7607e6771e5555`
- Downloadkanal: `ga-tracker-client/channel/stable.json`

## Assetauslieferung

- Die Tracker-EXE enthält kein eingebettetes Homebase-Assetpaket mehr.
- Der bisherige Buildschritt `prepare-embedded-homebase-assets.js` und das Verzeichnis
  `embedded-homebase-assets` entfallen.
- Eine vom Benutzer bestätigte Installation verwendet immer den veröffentlichten
  Stable-Kanal unter `homebase/assets/channel/stable.json`.
- Der Tracker lädt das Vollarchiv, prüft Releaseindex, Größe, SHA-256, Dateiliste,
  Paketmanifest, Layout und die benötigten SimObject-Definitionen.
- Der Austausch im aktiven Community-Ordner bleibt atomar mit Staging, Backup und
  Rollback.
- MSFS muss für Installation oder Update weiterhin geschlossen sein.
- Ist der Assetserver nicht erreichbar, bleibt ein bereits installiertes Paket
  unverändert nutzbar. Eine neue Installation oder Aktualisierung wartet auf eine
  erfolgreiche Serververbindung.
- Das alte Kommando `homebase_v1.assets.install` bleibt kompatibel, verwendet intern
  aber ebenfalls den geprüften Online-Release.

Neue Capability:

`homebase-assets-online-only-v1`

## Gespeicherter Homebase-Bauplan

Die Workbench speichert weiterhin Spawnpunkt, Hangar, Zusatzobjekte, Personen,
Navigation und Türautomatik. Ab v313 gehören außerdem die nach positivem ACK
bestätigten Control-Zustände zum Plan:

```json
{
  "instanceId": "lantern-1",
  "title": "VFR Multitool Homebase Stable Lantern",
  "controlId": "light",
  "stateId": "off"
}
```

Gespeichert werden ausschließlich Objektinstanz, SimObject-Titel, Control-ID und
State-ID. SimVar und Zahlenwert stammen nie aus dem gespeicherten Plan.

Der Plan wird lokal in der Workbench und bei aktiviertem Pilot-Sync im bestehenden
Homebase-Cloudrecord gespeichert. Der Tracker erhält zusätzlich eine lokale
Fallbackkopie in seiner `tracker-config.json` unter:

`Dokumente/VFR Multitool/Tracker`

## Versionswechsel und Kompatibilität

Der Fallback wird nicht mehr wegen einer abweichenden Tracker-Buildnummer gelöscht.
Kompatibilität wird über Fallback-Schema und Pilot-ID entschieden. Ein mit v312
gespeicherter Bauplan bleibt daher nach dem Wechsel auf v313 erhalten.

`trackerVersionCode` bleibt als Diagnosemetadatum im Datensatz, ist aber kein
Ausschlusskriterium mehr.

Die optionalen `controlStates` wurden rückwärtskompatibel zum bestehenden
Fallback-Schema 1 ergänzt. Ältere Datensätze ohne dieses Feld bleiben gültig.

## Wiederherstellung bei Spawn und Neustart

1. Der Tracker liest beim Start den lokalen Fallback.
2. SimConnect startet unabhängig davon, ob das WebSocket-Relay bereits verbunden ist.
3. Sobald eine gültige Flugzeugposition innerhalb des Homebase-Eintrittsradius
   vorliegt, baut der Tracker die fehlenden Live-Objekte auf.
4. Jedes neu erzeugte SimObject erhält eine neue SimConnect-Object-ID.
5. Erst nach erfolgreichem Spawn löst der Tracker die gespeicherten Control- und
   State-IDs erneut über den aktiven Assetkatalog auf.
6. Objektlokale `L:1:`-Variablen werden auf die neue konkrete Object-ID geschrieben.
7. Die Türautomatik übernimmt anschließend wieder gemäß ihrem manuellen
   Override-Vertrag.

Die Eintritts-/Austrittshysterese bleibt bei 20/22 NM. Außerhalb des Bereichs werden
die vom Tracker erzeugten Live-Ergänzungen entfernt.

Wird nur die App geschlossen oder das Relay getrennt, bleibt der Tracker mit
SimConnect aktiv. Wird der Trackerprozess selbst beendet, kann MSFS die von diesem
Client erzeugten Live-SimObjects entfernen; beim nächsten Trackerstart werden sie
innerhalb des Homebase-Radius aus dem gespeicherten Plan neu aufgebaut. Statisch
kompilierte Bestandteile des installierten Community-Pakets sind davon unabhängig.

## Control-Sicherheit

- Der Client darf keine freie LVar oder keinen freien Zahlenwert vorgeben.
- Zulässig sind nur Control- und State-Kombinationen aus dem aktiven lokalen
  Assetkatalog.
- Der Tracker leitet SimVar, Unit, Scope und Zahlenwert serverseitig aus dem Katalog
  ab.
- Bei `scope=simobject` muss die Homebase-Instanz existieren und ihr registrierter
  Titel zum Control-Titel passen.
- `L:1:` wird ausschließlich mit der konkreten SimConnect-Object-ID geschrieben,
  niemals auf `OBJECT_ID_USER`, global oder titelweit.
- Unbekannte Controls, Zustände, fehlende Object-IDs oder Titelabweichungen werden
  abgelehnt und im Preview-ACK als Fehler dokumentiert.

Neue Capability:

`homebase-fallback-control-state-v1`

## ACK-Erweiterung beim Szenenaufbau

`homebase_v1.preview.set_ack` enthält ab v313 zusätzlich:

- `appliedControlStates`
- `failedControlStates`
- `controlStateCount`
- `controlFailureCount`

Dadurch ist nachvollziehbar, welche Zustände nach einem Respawn tatsächlich auf die
neuen Object-IDs geschrieben wurden.

## Validierung

Vor dem Release wurden ausgeführt:

- Homebase-Tracker-Selbsttest einschließlich Remote-Download, Hashprüfung, atomarer
  Installation, Rollback und Control-Wiederherstellung
- Tracker-Storage-Selbsttest
- Homebase-Tür-/Proximity-Selbsttest
- Tracker-Authentifizierungstest
- Mission-Ground-Flow-Selbsttest
- JavaScript-Syntaxprüfungen der geänderten Tracker-, Workbench- und
  Integrationsdateien
- Prüfung, dass die gebaute EXE keine eingebetteten Modell-, Textur- oder
  Assetpaketdateien enthält

## Rückfallstand

Tracker `v312` und dessen Release-Asset bleiben unverändert erhalten. Ein Rollback ist
über den unveränderlichen GitHub-Release `v312` möglich. Der produktive Downloadkanal
zeigt nach Veröffentlichung von v313 ausschließlich auf das neue, separat gehashte
Release-Asset.
