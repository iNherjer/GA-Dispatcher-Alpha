# Homebase-Assetauslieferung

## Zielbild

Alle Homebase-SimObjects bleiben gemeinsam im einzigen Community-Paket
`vfr-multitool-homebase-assets`. Der Publisher versioniert und veröffentlicht dieses
Paket unabhängig von App und Tracker. Der produktive Tracker prüft den Releasekanal,
lädt ein bestätigtes Update, validiert es vollständig und tauscht das Community-Paket
atomar aus.

Die Remote-Installation ist seit Tracker `v286` produktiv. Seit `v288` verwendet die
gesamte Lieferkette die endgültige Paketidentität ohne Testnamen; der erste Stand unter
diesem Namen ist Assetpaket `0.6.0`.

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
8. Der geprüfte aktive Paketindex wird dauerhaft unter
   `Dokumente/VFR Multitool/Tracker/homebase-state/active-package-index.json`
   gespeichert. Download- und Entpackordner werden nach der Installation entfernt.

## Lokaler Tracker-Datenordner

Der produktive Tracker schreibt keine Arbeitsordner mehr neben die EXE. Konfiguration,
Diagnoselog und Homebase-Arbeitsdaten liegen gemeinsam unter
`Dokumente/VFR Multitool/Tracker`. Beim ersten Start werden vorhandene
`tracker-config.json`, `ga-tracker-debug.txt`, `homebase-generated` und
`homebase-asset-cache` aus dem bisherigen EXE-Ordner automatisch dorthin verschoben.

Das erzeugte SDK-Projekt unter `homebase-generated` bleibt bis zur erfolgreichen
Installation erhalten, damit ein abgebrochener oder fehlgeschlagener Ablauf analysiert
und erneut ausgeführt werden kann. Nach erfolgreicher Installation wird dieses Projekt
gelöscht; die kleine Installations-Momentaufnahme bleibt erhalten. Im Assetcache bleiben
keine regulären Daten zurück. Dauerhafte Installations- und Indexdaten liegen getrennt
unter `homebase-state`.

Vor jeder Prüfung oder Installation ermittelt der Tracker den aktiven MSFS-2024-
Paketpfad aus `UserCfg.opt`. Dabei werden Steam (`%APPDATA%`) und Microsoft Store/
Xbox (`%LOCALAPPDATA%\\Packages\\Microsoft.Limitless_*`) sowie benutzerdefinierte
`InstalledPackagesPath`-Werte unterstützt. Existiert sowohl `Community2024` als auch
`Community`, wird für neue 2024-Pakete `Community2024` bevorzugt; bereits vorhandene
Pakete werden an ihrem aktiven Ort aktualisiert. Ein bloß vorhandener Standardordner
einer anderen Edition gilt nicht als Installationsnachweis und wird nicht automatisch
neu angelegt. Bei mehreren tatsächlich konfigurierten Paketpfaden bricht die
Installation mit einer eindeutigen Meldung ab, statt einen Zielordner zu erraten.

## Online-Auslieferung und Versionsschutz

Ab Tracker `v313` enthält die EXE keine Kopie des Assetpakets mehr. Bei einer bestätigten
Installation lädt der Tracker das vollständige Paket aus dem Stable-Kanal, prüft Archiv,
Index und Inhalt und installiert es anschließend atomar. Ist der Releasekanal vorübergehend
nicht erreichbar, bleibt ein bereits vollständig installiertes Paket unverändert nutzbar;
eine Erstinstallation oder Aktualisierung wird bis zur nächsten erfolgreichen Prüfung
pausiert.

Ein reines Modell- oder Texturupdate benötigt damit keine neue Tracker-EXE. Der im
Releaseindex veröffentlichte Assetkatalog wird nach der Installation als aktive
Katalogquelle verwendet. Dadurch kann die Workbench neue, katalogkonforme Homebase-
Objekte und Controls übernehmen; neue Transportarten oder Missionslogik benötigen
weiterhin eine passende App-/Tracker-Version.

Die Auswahl in der Homebase-Workbench wird unabhängig von der Missionsfreigabe über
`workbenchVisible` gesteuert. Nur der ausdrückliche Wert `false` blendet ein Asset aus;
fehlende Werte bleiben für ältere Kataloge rückwärtskompatibel sichtbar. Das Asset bleibt
dabei installiert und kann mit `missionSpawnable: true` weiterhin von Missionen genutzt
werden. Bereits gespeicherte Homebases mit einem später ausgeblendeten Objekt bleiben
ladbar und kompilierbar; lediglich das erneute Hinzufügen über den Katalog entfällt.
