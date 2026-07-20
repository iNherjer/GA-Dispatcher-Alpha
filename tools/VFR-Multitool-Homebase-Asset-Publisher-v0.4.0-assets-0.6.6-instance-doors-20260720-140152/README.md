# VFR Multitool Homebase Asset Publisher

Dieses separate Windows-Werkzeug verwaltet die Rohquellen des gemeinsamen Homebase-Assetpakets <code>vfr-multitool-homebase-assets</code>, baut daraus mit dem offiziellen MSFS-2024-SDK ein vollständiges Paket und kann eine geprüfte Version nach GitHub veröffentlichen. Produktionsbuilds mit dem früheren Testpaketnamen werden blockiert.

Es verändert weder die produktive Tracker-EXE noch einen installierten Community-Ordner. Ein Assetrelease besteht aus einem kanonischen Dateiindex, einem vollständigen Reparatur-ZIP und einem kleinen ZIP pro Asset. Im Simulator bleibt es trotzdem **ein einziges Community-Paket**.

## Voraussetzungen auf dem Build-PC

- Node.js 18 oder neuer (für den lokalen Publisher-Server)
- MSFS 2024 SDK mit `fspackagetool.exe`
- Git für Windows
- GitHub CLI (`gh`) und einmalig `gh auth login -h github.com`
- ein sauberer lokaler Clone des GA-Dispatcher-Repositories auf dem vorgesehenen Publish-Branch
- MSFS muss während des offiziellen SDK-Builds geschlossen sein

## Start

1. ZIP vollständig in einen eigenen Ordner entpacken. Nicht die EXE oder CMD direkt innerhalb der ZIP-Vorschau starten.
2. `Start Homebase Asset Publisher.cmd` doppelklicken.
3. Falls der Browser nicht automatisch aufgeht: `http://127.0.0.1:8797` öffnen.
4. Repository- und SDK-Pfad eintragen und speichern.

Die dauerhaften Arbeitsdaten liegen im Ordner `Homebase-Asset-Publisher-Data` direkt neben dem Starter. Dieser Ordner enthält den Katalog, alle Rohquellen, das erzeugte SDK-Projekt, Buildlogs und vorbereitete Releases. Vor einem Umzug oder einer Neuinstallation sollte dieser Ordner mitgesichert werden.

Das Konsolenfenster bleibt während der Laufzeit geöffnet und darf erst nach der Arbeit geschlossen werden. Falls der Publisher nicht startet, zeigt es die Fehlermeldung an. Zusätzlich entsteht neben der EXE die Datei `Homebase-Asset-Publisher-startup.log`.

### Externes Arbeitsverzeichnis

In dieser Arbeitsinstallation verweist `PUBLISHER-DATA-ROOT.txt` auf `C:\RohDaten\VFR-Multitool-Homebase-Asset-Publisher\Homebase-Asset-Publisher-Data`. Der Pointer wird auch bei einem direkten Start von `publisher-server.mjs` ausgewertet; die Umgebungsvariable `HOMEBASE_ASSET_PUBLISHER_DATA` kann ihn bei Bedarf überschreiben.

### Zentrale Assetbibliothek

Bearbeitbare Blender-Masterdateien, Vorschauen, assetspezifische Automation und Herkunftsmetadaten liegen geordnet unter `C:\RohDaten\VFR-Multitool-Homebase-Asset-Publisher\asset-library\<SimObject-Ordner>`. Der Unterordner `publisher-source` verweist jeweils direkt auf die kanonische Rohquelle unter `Homebase-Asset-Publisher-Data/source/SimObjects/Misc`; dadurch existieren keine zwei auseinanderlaufenden Rohdatenbanken. `asset-index.json` und `file-inventory.csv` ermöglichen die schnelle Suche, `duplicate-hashes.json` dokumentiert identische Dateien.

Nach neuen Assets oder geänderten Blender-Masterdateien wird die Bibliothek mit `tools/organize-asset-library.ps1` aktualisiert. Das Script kopiert nicht-destruktiv und löscht keine bestehenden Quelldateien.

## Ein Asset ergänzen oder ersetzen

Der ausgewählte Quellordner muss genau ein rohes SimObject enthalten:

```text
VFRHomebaseBeispiel/
  sim.cfg
  model/
    model.cfg
    Beispiel.xml
    Beispiel_LOD00.gltf
    Beispiel_LOD00.bin
```

Der `title` in `sim.cfg` muss exakt dem im Formular angegebenen SimObject-Titel entsprechen. Bereits durch das SDK optimierte glTF-Dateien werden abgelehnt, weil sie keine verlässliche Rohquelle für den nächsten Gesamtbuild sind.

Ein erfolgreicher Import übernimmt das Asset dauerhaft in den Publisher-Katalog und in die Rohquellen. Der nächste Gesamtbuild enthält automatisch **alle** katalogisierten Assets – einschließlich aller seit dem letzten Build neu importierten oder ersetzten Assets.

Beim Auslesen erkennt der Publisher ein vorhandenes Asset über Katalog-Key, SimObject-Ordner oder exakten `sim.cfg`-Titel und trägt automatisch die nächste Patchversion ein (`1.0.0` → `1.0.1`). Eine Rohquellen-Ersetzung mit gleicher oder niedrigerer Assetversion wird abgelehnt; eine bewusst größere Minor- oder Majorversion kann im Formular eingetragen werden. Vor dem Ersetzen wird die bisherige Version vollständig und unveränderlich unter `Homebase-Asset-Publisher-Data/source-history/<SimObject-Ordner>/<Assetversion>` gesichert. Der Snapshot enthält Rohquelle, Katalogeintrag, Paketstand, Dateiliste und SHA-256-Hashes. Bereits vorhandene abweichende Snapshots werden niemals überschrieben.

Die Paketversion wird nicht automatisch erhöht. Sie bezeichnet das gemeinsame Modpack und wird erst passend zum geplanten Gesamt-Release festgelegt.

Bei einer Änderung:

1. Asset-Version erhöhen, zum Beispiel `1.0.0` auf `1.0.1`.
2. Rohquellordner importieren.
3. Paketversion erhöhen, zum Beispiel `0.6.0` auf `0.6.1`.
4. SDK-Projekt vorbereiten und mit dem offiziellen SDK kompilieren.
5. Optional die Release-Vorschau erzeugen und prüfen.
6. Veröffentlichen. Der Publish erzeugt die Release-Dateien bei Bedarf selbst erneut, lädt `package-index.json` und die Archive hoch und schaltet erst danach den Stable-Kanal um.

Die Missions-Tags und Rollen werden schon im Katalog gepflegt. `cargo` kennzeichnet mögliche Ladung, `scene-prop` ein Szenenobjekt. Die spätere Missionslogik entscheidet weiterhin, ob und wann ein solches Asset tatsächlich gespawnt wird.

## Sichere Veröffentlichung

Der Publish ist absichtlich streng:

- nur der konfigurierte Branch darf aktiv sein;
- fremde Worktree-Änderungen blockieren die Veröffentlichung;
- geschrieben und explizit gestaged wird nur unter `homebase/assets`;
- bestehende GitHub-Releases werden nie überschrieben;
- zuerst werden Quellen, Katalog und Index gepusht;
- dann wird das unveränderliche GitHub-Release hochgeladen;
- erst nach erfolgreichem Upload wird der Stable-Kanal umgeschaltet.

Der normale Ablauf im Werkzeug ist daher: neue Rohquellen in Schritt 02 importieren, in Schritt 03 die neue Paketversion als vollständiges Gesamtpaket bauen und in Schritt 04 veröffentlichen. Die Release-Vorschau in Schritt 04 ist optional und dient nur der vorherigen Kontrolle.

Vor dem ersten echten Publish empfiehlt sich ein Testrelease mit einer neuen Paketversion. Falls der GitHub-Upload oder Push fehlschlägt, bleiben der lokale Build und die vorbereiteten Archive im Arbeitsordner erhalten.

## Publisher v0.4.0

Assets können mehrere generische Steuerungen vom Typ `animation` oder `light` besitzen. Jede Steuerung verwendet eine validierte globale oder objektlokale Homebase-Variable, frei definierbare Zustände und einen Standardzustand. Vorhandene Tür-Metadaten werden automatisch in das neue Controls-Schema übernommen und weiterhin als Legacy-`animation` ausgegeben.

### Instanzlokale Hangartore

Eine Steuerung mit `scope: global` verwendet eine Variable mit dem Präfix `L:VFR_HOMEBASE_` und wirkt auf alle Modellkopien. Für ein einzelnes SimObject wird `scope: simobject` zusammen mit `L:1:VFR_HOMEBASE_` oder `Z:VFR_HOMEBASE_` verwendet. Dadurch kann SimConnect denselben Variablennamen gezielt an die konkrete SimObject-ID schreiben, ohne Modellkopien oder nummerierte Variablen anzulegen.

Das Rundhangartor liest `L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND`; seine Innenbeleuchtung bleibt absichtlich global über `L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND` steuerbar.

Modellunabhängige Metadaten wie `headingCorrectionDeg`, Kollisionsprofil, Footprint und Vegetationsausschluss lassen sich ohne erneuten Rohquellenimport bearbeiten. Der Publisher trennt Modell- und Metadaten-Hashes und erkennt dadurch auch reine Metadatenänderungen als release-relevant.

Der SDK-Build verwendet auf Windows automatisch einen kurzen temporären Arbeitsordner und kopiert das validierte Paket anschließend nach `Homebase-Asset-Publisher-Data/sdk-project` zurück. Dies vermeidet Fehler des offiziellen Package Tools bei tief verschachtelten Installationspfaden.

Bestehende Katalogeinträge lassen sich über **„Bearbeiten“** direkt zurück in das Formular laden. Die Gruppe ist ein festes Dropdown, damit keine fehlerhaften Parallelgruppen entstehen; für Hangars ist **„Gebäude“** vorgesehen. Nach dem Übernehmen werden Katalog und Rohquelle aktualisiert. Für ein neues Paket folgt anschließend wie gewohnt: SDK-Projekt vorbereiten, SDK kompilieren und veröffentlichen.
