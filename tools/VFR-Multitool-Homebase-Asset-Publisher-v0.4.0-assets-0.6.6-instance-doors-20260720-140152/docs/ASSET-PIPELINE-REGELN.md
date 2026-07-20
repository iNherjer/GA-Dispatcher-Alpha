# Verbindliche Regeln für neue Homebase-Assets

Stand: 14.07.2026

Diese Regeln gelten für jedes eigene Modell, unabhängig davon, ob es in Blender oder prozedural erzeugt wurde. Ein sichtbares Blender-Modell oder eine vorhandene GLTF-Datei ist noch kein fertiges MSFS-Asset.

Die detaillierten Modell-, Änderungs- und Animationsanforderungen stehen in [HOMEBASE-ASSET-MODELLREGELN-AGENTEN.md](HOMEBASE-ASSET-MODELLREGELN-AGENTEN.md). Für die Beauftragung und Übergabe durch menschliche 3D-Artists gilt [HOMEBASE-ASSET-BRIEFING-3D-ARTISTS.md](HOMEBASE-ASSET-BRIEFING-3D-ARTISTS.md).

## 1. Verbindliche Statusstufen

Ein Asset erhält immer genau einen der folgenden nachweisbaren Status:

| Status | Bedeutung | Darf in den Community-Ordner? |
|---|---|---|
| `ROHMODELL` | `.blend` beziehungsweise unkompilierte GLTF/BIN/XML-Quelldateien vorhanden | Nein |
| `SDK-KOMPILIERT` | Das offizielle MSFS Package Tool hat das komplette Assetpaket erzeugt; jede LOD-GLTF enthält `ASOBO_asset_optimized` | Noch nicht automatisch |
| `VALIDIERT` | Katalog, Titel, Ordner, Paketversion, `layout.json`, Dateien und Optimierungsmarker wurden erfolgreich geprüft | Ja |
| `INSTALLIERT` | Das validierte Paket wurde bytegenau in den erkannten Community-Ordner kopiert und erneut validiert | Ja |
| `LIVE-BESTÄTIGT` | MSFS wurde nach der Installation gestartet und SimConnect hat für den exakten Titel eine Object-ID sowie `ObjectAdded` bestätigt | Ja, freigegeben |

Die Bezeichnung **simfertig** darf erst ab `VALIDIERT` verwendet werden. Für eine Auslieferung oder die Freigabe in der Workbench ist `LIVE-BESTÄTIGT` erforderlich.

## 2. Einziger zulässiger Datenfluss

```text
Blender / Modellgenerator
        |
        v
generated/vfr-multitool-homebase-assets-sdk/PackageSources
        |  offizielles MSFS 2024 Package Tool
        v
generated/vfr-multitool-homebase-assets-sdk/Packages/<Paketname>
        |  vollständige Validierung
        v
community-package/<Paketname>
        |  Hash-geprüfte Installation
        v
erkannter MSFS-Community-Ordner
```

Rohmodelle dürfen niemals direkt nach `community-package/` oder in einen MSFS-Community-Ordner geschrieben beziehungsweise kopiert werden. Der Modellgenerator akzeptiert deshalb nur noch den festgelegten `PackageSources`-Ordner.

## 3. Pflichtänderungen bei jedem neuen eigenen Asset

Ein neues Asset ist erst vollständig integriert, wenn alle Punkte erledigt sind:

1. Bearbeitbare Quelle unter `blender-models/` beziehungsweise im Modellgenerator anlegen.
2. Einen eindeutigen Eintrag in `homebase-asset-catalog.js` ergänzen: `key`, Ordner, exakter SimObject-Titel, Typ und sichtbare Bezeichnung.
3. Die Assetpaketversion erhöhen.
4. Falls das Asset live erzeugt werden soll, darf der Stabilizer keine eigene abweichende Allowlist erhalten; er liest den gemeinsamen Katalog.
5. Das SDK-Projekt mit `npm run prepare:assets` erzeugen.
6. MSFS normal beenden und mit `npm run build:assets` das komplette Paket offiziell kompilieren.
7. Mit `npm run validate:assets` prüfen. Ein einziger roher oder fehlender Katalogeintrag sperrt das gesamte Paket.
8. Erst danach mit `npm run install:assets` installieren. Der Installer darf ausschließlich das validierte SDK-Ergebnis verwenden.
9. MSFS nach der Installation neu starten, damit neue SimObject-Titel sicher registriert werden.
10. Einen Live-Spawn über denselben App-/Stabilizer-Pfad wie beim Benutzer testen. Der Developer-Mode-SimObject-Spawner allein reicht nicht als App-Freigabe.
11. Nach jeder Katalogänderung die derzeitige Stabilizer-EXE neu bauen und gegen mindestens einen neuen Titel prüfen. Diese Pflicht entfällt erst, wenn die spätere Tracker-EXE den versionierten Katalog dynamisch lädt.
12. Bei steuerbaren Lichtern zusätzlich nachweisen, dass die ausgelieferte Laufzeit die Katalog-LVar tatsächlich schreibt und dass Emissive sowie reale Lichtabgabe im Simulator für an/aus/an reagieren. `ASOBO_advanced_light` und die vorgesehenen Lichtkanäle müssen sowohl in der Rohquelle als auch im kompilierten Modell vorhanden sein.

## 4. Verbotene Abkürzungen

- Eine unkompilierte GLTF durch manuelles Hinzufügen von `ASOBO_asset_optimized` als kompiliert markieren.
- Nur den neuen Assetordner in ein altes kompiliertes Paket kopieren.
- `layout.json` von Hand anpassen und dies als SDK-Build behandeln.
- Während MSFS läuft ein neues Assetpaket bauen oder ersetzen und anschließend von einer sicheren Registrierung ausgehen.
- Ein Asset als funktionsfähig melden, nur weil es im Developer-Mode-Spawner erscheint. App-Katalog, Stabilizer und SimConnect müssen denselben exakten Titel akzeptieren.
- Bei einer Katalogänderung eine alte Stabilizer-EXE weiter ausliefern.

## 5. Abnahmeprotokoll pro Asset

Für jedes neue Asset werden mindestens diese Werte festgehalten:

- Katalog-Key, Ordner und exakter SimObject-Titel
- Assetpaketversion
- SHA-256 des validierten Pakets beziehungsweise der relevanten Modelldateien
- Ergebnis von `npm run validate:assets`
- verwendeter Community-Pfad
- SimConnect-Object-ID des Live-Tests
- Bodenlage bei `0 ft`, sichtbare Ausrichtung und ungefähre Abmessungen
- Ergebnis von Verschieben, Entfernen und erneutem Erzeugen über die Workbench
- bei Lichtassets: Light-Node, `ASOBO_advanced_light`, Außen-/Innenkanäle, Standardzustand sowie Ergebnis des Emissive- und Lichtwirkungstests für an/aus/an

## 6. Aktueller Status des Treibstofffasses

`VFR Multitool Homebase Fuel Drum` ist am 14.07.2026 `INSTALLIERT`.

- Katalog-Key: `fuelDrum`
- Ordner: `VFRHomebaseFuelDrum`
- Exakter SimObject-Titel: `VFR Multitool Homebase Fuel Drum`
- Assetpaketversion: `0.5.4`
- SDK-Status: offiziell mit dem MSFS Package Tool kompiliert; die LOD-GLTF enthält `ASOBO_asset_optimized`
- SHA-256 `HomebaseFuelDrum_LOD00.gltf`: `8B9F393444F7D0FF14D45E2BB246D9084ADD60A9C6BDCD32EB2928AA91748418`
- SHA-256 `HomebaseFuelDrum_LOD00.bin`: `9F21F75918F49E09FAD69365E7629B75CCF6E073F9B474A6B0D7EAC7EC7078C7`
- Ergebnis `npm run validate:assets`: erfolgreich
- Installationspfad: `%APPDATA%\\Microsoft Flight Simulator 2024\\Packages\\Community\\vfr-multitool-homebase-test-assets`
- Bodenlage: Bounds beginnen bei `Y=0`; ungefähre Abmessungen `0,814 x 0,747 x 1,327 m`
- Workbench-Katalog, Szenencompiler und neu gebaute Stabilizer-EXE akzeptieren denselben exakten Titel.

Der Status ist noch nicht `LIVE-BESTÄTIGT`: Eine laufende MSFS-Sitzung mit SimConnect-Object-ID sowie die Tests Verschieben, Entfernen und erneutes Erzeugen über die Workbench stehen noch aus. Developer-Mode-Spawner oder Selbsttest ersetzen diesen Live-Test nicht.

## 7. Aktueller Status der drei Holzkisten

Die drei einzelnen Assets `VFR Multitool Homebase Wood Crate Small`, `VFR Multitool Homebase Wood Crate Medium` und `VFR Multitool Homebase Wood Crate Large` sind am 14.07.2026 `INSTALLIERT`.

| Katalog-Key | Ordner | Exakter SimObject-Titel | Größe laut validierten Bounds |
|---|---|---|---|
| `woodCrateSmall` | `VFRHomebaseWoodCrateSmall` | `VFR Multitool Homebase Wood Crate Small` | ca. `0,64 x 0,42 x 0,54 m` |
| `woodCrateMedium` | `VFRHomebaseWoodCrateMedium` | `VFR Multitool Homebase Wood Crate Medium` | ca. `0,92 x 0,56 x 0,72 m` |
| `woodCrateLarge` | `VFRHomebaseWoodCrateLarge` | `VFR Multitool Homebase Wood Crate Large` | ca. `1,26 x 0,72 x 0,90 m` |

- Assetpaketversion: `0.5.5`
- SDK-Status: alle drei Modelldateien wurden mit dem offiziellen MSFS Package Tool kompiliert; die LOD-GLTFs enthalten `ASOBO_asset_optimized`
- SHA-256 `HomebaseWoodCrateSmall_LOD00.gltf`: `2347F8A38DCAD1A060751F79F302B756333DC643E095357EB45F7626DBE77479`
- SHA-256 `HomebaseWoodCrateSmall_LOD00.bin`: `D8911C625B223E33ABE466D481A4B5CB8E4FB5DBAAE3178BEDD999BC84339FB8`
- SHA-256 `HomebaseWoodCrateMedium_LOD00.gltf`: `04704C014D37619390D00F05922FB8879F8629BAC9A8B52114A4435BCB14FD0D`
- SHA-256 `HomebaseWoodCrateMedium_LOD00.bin`: `09541A46CD092058A6ABCF654A6E02EE24119B62C04354FE10B0BE262DF561DA`
- SHA-256 `HomebaseWoodCrateLarge_LOD00.gltf`: `05F793F47218941679A9E5BC674D56AEFB940C4C9869A2F95941D6CA599C2667`
- SHA-256 `HomebaseWoodCrateLarge_LOD00.bin`: `1CD737CF536F7B446677C0CF6ACD0D2A6278278202D36D0DD62A99A82589AC7D`
- Ergebnis `npm run validate:assets`: erfolgreich
- Installationspfade: `community-package\\vfr-multitool-homebase-test-assets` und `%APPDATA%\\Microsoft Flight Simulator 2024\\Packages\\Community\\vfr-multitool-homebase-test-assets`
- Bodenlage: alle drei Bounds beginnen bei `Y=0`
- Drei separate Blender-Quelldateien und die aktualisierte Sammeldatei wurden erzeugt; die neu gebaute Stabilizer-EXE akzeptiert die drei exakten Titel.

Der Status ist noch nicht `LIVE-BESTÄTIGT`: Eine laufende MSFS-Sitzung mit SimConnect-Object-IDs sowie die Tests Verschieben, Entfernen und erneutes Erzeugen aller drei Kisten über die Workbench stehen noch aus. Developer-Mode-Spawner oder Selbsttest ersetzen diesen Live-Test nicht.

## 8. Aktueller Status des MX-Pavillons

`VFR Multitool Homebase MX Pavilion` ist am 14.07.2026 `INSTALLIERT`.

- Katalog-Key: `mxPavilion`
- Ordner: `VFRHomebaseMXPavilion`
- Exakter SimObject-Titel: `VFR Multitool Homebase MX Pavilion`
- Assetpaketversion: `0.5.4`
- SDK-Status: offiziell mit dem MSFS Package Tool kompiliert; die LOD-GLTF enthält `ASOBO_asset_optimized`
- SHA-256 `HomebaseMXPavilion_LOD00.gltf`: `6B287EF0E0C66EE60DBBCA4ACAD700B2CCA5772B81F3DFD16BB89E852B80FC80`
- SHA-256 `HomebaseMXPavilion_LOD00.bin`: `1F3EB9C86D7A4C1AF020325516B920BB08A2D86A89ED02F1EA69ED22902B7061`
- Ergebnis `npm run validate:assets`: erfolgreich
- Installationspfad: `%APPDATA%\\Microsoft Flight Simulator 2024\\Packages\\Community\\vfr-multitool-homebase-test-assets`
- Bodenlage: Bounds beginnen bei `Y=0`; ungefähre Abmessungen `3,054 x 3,054 x 2,442 m`
- Das Modell besitzt ein schwarzes Stoffdach, vier offene Standbeine und eine sichtbare zentrale Dach-/Spannkonstruktion.

Der Status ist noch nicht `LIVE-BESTÄTIGT`: Eine laufende MSFS-Sitzung mit SimConnect-Object-ID sowie die Tests Verschieben, Entfernen und erneutes Erzeugen über die Workbench stehen noch aus. Developer-Mode-Spawner oder Selbsttest ersetzen diesen Live-Test nicht.

## 9. Aktueller Status des europäischen Wohnwagens

`VFR Multitool Homebase European Caravan` ist am 15.07.2026 `INSTALLIERT`.

- Katalog-Key: `europeanCaravan`
- Ordner: `VFRHomebaseEuropeanCaravan`
- Exakter SimObject-Titel: `VFR Multitool Homebase European Caravan`
- Assetpaketversion: `0.5.6`
- SDK-Status: offiziell mit dem MSFS Package Tool kompiliert; die LOD-GLTF enthält `ASOBO_asset_optimized`
- SHA-256 `HomebaseEuropeanCaravan_LOD00.gltf`: `7572D97D2C9B8B5928F80D199FFD5515E6998A9BC8996C320EC5C3AC78C5019B`
- SHA-256 `HomebaseEuropeanCaravan_LOD00.bin`: `96986D45832233B554B2B3324C5172F5A478BEB6AA3F15BD0B2AC8A84CC2655E`
- Ergebnis `npm run validate:assets`: erfolgreich
- Installationspfad: `community-package\\vfr-multitool-homebase-test-assets` und `%APPDATA%\\Microsoft Flight Simulator 2024\\Packages\\Community\\vfr-multitool-homebase-test-assets`
- Bodenlage: Bounds beginnen bei `Y=0`; Gesamt-Bounds ca. `5,01 x 2,38 x 6,467 m` inklusive Deichsel, Rädern und Markise
- Einzelne Blender-Quelldatei: `blender-models/HomebaseEuropeanCaravan.blend`
- Ausstattung: ein Fahrwerk mit einer Achse, zwei Räder, Deichsel mit kleinem dunklem Stützrad, dunkle Fenster, sichtbare Sitzgruppe, Doppelbett, rechts außen geöffnete Tür und graue Markise mit 2,5 m Ausladung über die komplette Aufbaulänge.

Der Status ist noch nicht `LIVE-BESTÄTIGT`: Ein Neustart von MSFS sowie ein Live-Spawn mit SimConnect-Object-ID und die Tests Verschieben, Entfernen und erneutes Erzeugen über die Workbench stehen noch aus. Developer-Mode-Spawner oder Selbsttest ersetzen diesen Live-Test nicht.
