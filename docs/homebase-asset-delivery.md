# Homebase-Assetauslieferung

## Zielbild

Alle Homebase-SimObjects bleiben gemeinsam im einzigen Community-Paket
`vfr-multitool-homebase-test-assets`. Der Publisher versioniert und veröffentlicht dieses
Paket unabhängig von App und Tracker. Der produktive Tracker prüft den Releasekanal,
lädt ein bestätigtes Update, validiert es vollständig und tauscht das Community-Paket
atomar aus.

Die Remote-Installation wurde zunächst im getrennten Test-Tracker bis
`v285-homebase-test7` validiert und ist seit dem Produktionsrelease `v286` Bestandteil
des normalen Trackers.

## Veröffentlichungsvertrag

- GitHub-Release-Tag: `homebase-assets-v<version>`
- Stable-Kanal im Repository: `homebase/assets/channel/stable.json`
- Kanonischer Dateiindex im Release: `package-index.json`
- Vollständiges Reparaturarchiv: `<paketname>-<version>-full.zip`
- Optional zusätzlich ein ZIP je Asset für spätere Delta-Updates
- Inhalt des Vollarchivs: genau ein Paketordner mit `manifest.json`, `layout.json`
  und `SimObjects`

`stable.json` verweist auf den unveränderlichen Release und enthält Paketname,
Paketversion, Release-Tag, Index-URL, Pakethash, geänderte/entfernte Asset-Keys sowie
Größe, URL und SHA-256 des Vollarchivs.

`package-index.json` enthält außerdem jede Paketdatei mit Pfad, Größe und SHA-256 sowie
den veröffentlichten Assetkatalog. Der Tracker verwendet in der ersten Ausbaustufe
bewusst das Vollarchiv. Damit bleiben `manifest.json`, `layout.json` und sämtliche
SimObjects immer synchron; die einzelnen Asset-ZIPs sind für eine spätere, ebenfalls
atomare Delta-Optimierung vorbereitet.

Standardkanal des produktiven Trackers:

`https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/homebase/assets/channel/stable.json`

Für einen isolierten PC-Test kann die Umgebungsvariable
`VFR_HOMEBASE_ASSET_CHANNEL_URL` auf einen anderen HTTPS-Kanal gesetzt werden.

## Prüf- und Installationsablauf

1. Der Tracker prüft den Stable-Kanal nach dem Verbindungsaufbau und höchstens alle
   15 Minuten erneut, sofern keine erzwungene Prüfung angefordert wird.
2. App und Workbench zeigen die verfügbare Version an. Es erfolgt kein automatischer
   Download und keine automatische Installation.
3. Der Benutzer bestätigt Download und Installation ausdrücklich. Läuft MSFS, fragt die
   Workbench separat, ob der Simulator beendet werden darf.
4. Der Tracker akzeptiert nur HTTPS-URLs, begrenzt JSON-, Archiv- und Entpackgrößen und
   verwirft unsichere oder kollidierende ZIP-Pfade.
5. Archivgröße und SHA-256 müssen zum Stable-Kanal passen. Danach müssen Stable-Kanal
   und Paketindex zusammenpassen.
6. Nach dem Entpacken prüft der Tracker jede Datei gegen Größe und SHA-256 des Indexes,
   anschließend `manifest.json`, `layout.json` und alle vom Tracker benötigten
   `sim.cfg`-Definitionen.
7. Das validierte Paket wird als `.__staging` neben das Ziel kopiert. Die vorhandene
   Version wird nach `.__backup` verschoben. Erst nach erfolgreicher Zielprüfung wird
   das Backup gelöscht; bei jedem Austauschfehler wird es wiederhergestellt.
8. Der geprüfte aktive Paketindex wird im Laufzeitordner unter
   `homebase-asset-cache/active-package-index.json` gespeichert.

## Offline-Fallback und Versionsschutz

Die Tracker-EXE enthält weiterhin das bei ihrem Build aktuelle Paket. Ist der Releasekanal
nicht erreichbar oder noch nicht veröffentlicht, kann der Benutzer dieses eingebettete
Paket installieren. Ein bereits vollständig installiertes Paket mit gleicher oder
höherer Version wird durch den Fallback nicht zurückgestuft.

Ein reines Modell- oder Texturupdate benötigt damit keine neue Tracker-EXE. Neue
SimObjects werden zwar als Teil des gemeinsamen Pakets synchronisiert, müssen aber
zusätzlich in App-/Tracker-Katalog und gegebenenfalls Missionslogik aufgenommen werden,
bevor sie in Workbench oder Missionen auswählbar sind.
