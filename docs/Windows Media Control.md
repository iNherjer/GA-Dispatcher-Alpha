## Apple-Music-App: eigener Audioprozess, lokaler Kandidat 15.10.2026

Nutzer: Titel/Zeit korrekt, Lautstaerkeregler bewegt sich ohne Wirkung;
nach Playercycling bleibt er bei0%. Reale Core-Audio-Abfrage zeigt Audio bei
AMPLibraryAgent.exe PID43232; GSMTC meldet AppleMusic.exe PID45960.
Beide liegen im identischen installierten AppleInc.AppleMusicWin_1.1540.23041.0-
Paket. Bisher filterte Discover ausschliesslich auf Prozessname AppleMusic.
Damit wird eine anfangs gefundene direkte Sitzung spaeter nicht durch die echte
Agent-Sitzung ersetzt; volumeAvailable=false und0 ist dann fehlende Sitzung,
nicht nachgewiesene Stummschaltung. Die fruehere Aussage „korrekt zugeordnet“
bezog sich nur auf den sichtbaren Hauptprozess, nicht alle realen Audioprozesse.

Gezielte Erweiterung: Fuer gewaehlten Player AppleMusic sind direkte AppleMusic-
Sitzungen weiterhin erlaubt. AMPLibraryAgent nur dann, wenn eine laufende
AppleMusic.exe aus exakt demselben AppleInc.AppleMusicWin_-Paketordner stammt.
Kein generischer Agent- oder Prozess-only-Match. Getrennte Apps/Installationen
werden nicht versehentlich geregelt. Mixer/IID/Restore-/Duck-Lease unveraendert.
Native C#-Pruefung fuer8 positive/negative Zuordnungsfaelle bestanden.
Realer Helfer vor Fix: AppleMusic nach Select/Cycling wiederholt unavailable/0.
Nach Fix: Select und Snapshot sowie AppleMusic->Chrome->AppleMusic jeweils
available/1.0. Das sind echte Windows-Ausfuehrungen, ohne Lautstaerkebefehl.
Hoerbare Wirkung und Duck/Restore nach Installerintegration bleiben Feldabnahme.
Keine Installation/Release/Kanalumschaltung durch diesen Kandidaten.
## Nachtrag 15.10.2026: veralteter Titelzeitanker, lokaler Kandidat

Basis 3292ffd7, frisch nach Integration des ersten Medienfixes geladen.
Nutzer meldet Anzeige 7:15 bei echter Apple-Music-Zeit ca.1:30; Anzeige springt
nur bei Statusantworten. Reale GSMTC-Abfragen um09:11 Uhr melden Playing,
Position330.403561, EndTime=-0.000001 und unveraendert LastUpdatedTime09:07:42.
Der erste Fix akzeptierte einen gueltigen, aber veralteten Zeitanker zu lange.
15-Sekunden-Sync besteht bereits und kann diesen falschen Quellwert nicht heilen.

Konservative lokale Policy: Playing-Anker aelter als30s oder mehr als2s in der
Zukunft gelten nicht als aktuelle native Zeit/Dauer. Pausierte native Position
bleibt auch bei altem Zeitstempel nutzbar. Ohne aktuellen Anker greift der bereits
sichtbar markierte lokale Schaetzzaehler; keine erfundene Dauer. 30s sind eine
bewusste Fallback-Policy, keine Windows-SDK-Garantie. Player, die nur einmal am
Titelanfang einen gueltigen Anker melden, wechseln deshalb ebenfalls zur Schaetzung.
Bei Titelwechsel muss ein spaeterer nativer Zeitanker zur neuen Beobachtungs-
epoche gehoeren (1.5s Toleranz); EndTime-Aenderung allein bestaetigt keinen neuen
Titelanker. Neues updatedAtMs bleibt ausschliesslich in der privaten Roh-Timeline.

86 Windows-/Desktop-/EFB-/Coretests bestanden, sieben native PowerShellfaelle,
einschliesslich realem Stale-Sample und Titelwechsel mit geaenderter EndTime,
aber altem Positionstimestamp. Sichtbar aktiver Original- und Coherent-Client
laufen im Test sekundenweise zwischen15s-Ankern. Kein UI-Quellfix noetig.
Das vom Nutzer berichtete vollstaendige Stehen der UI ist im Live-Browser nicht
separat reproduziert; die falsche native Zeit ist direkt nachgewiesen.
Keine weiteren Requests, kein neuer Browserzugriff, keine Audio-/Zugangsdaten.
Kein Release/Installationsschritt; Hauptagent uebernimmt Desktop-Folgeversion.
Fuer diesen Nachtrag ist kein Tracker-/EFB-Paketbau erforderlich, da nur native
Desktop-Zeitaufbereitung geaendert ist; sekundenweiser Client existiert bereits.
## Integrierter Feldteststand v534 / Desktop 1.6.14-alpha.4

Der nachfolgende Windows-Kandidat wurde auf seiner exakten Basis integriert.
Erreichbarkeit und Positionsanker sind getrennt. Dauerlose native Positionen
bleiben nutzbar; geschätzte Zeit ist als solche gekennzeichnet. Keine zusätzliche
Relay-Abfragefolge, keine Roh-Timeline oder Audiodaten über das Relay.
Installer und Runtime müssen für den vollständigen Web-/EFB-Feldtest aktualisiert
werden. Kein neues Community-Paket nötig; Legacy-WMP bleibt ohne eigenen Adapter.

## Windows-Medien: Timeline und Erreichbarkeit – lokaler Kandidat 15.10.2026

Basis fec4dbd8dba3fbf77f17c40918d2ec9b63ebd1dd, vor Arbeit frisch von origin/main
geholt. Kein Release und keine Installation dieses Kandidaten.

Echter Chrome-Feldbefund: Playing, Position 0.010672 Sekunden, StartTime 0,
EndTime -0.000001 Sekunden, gueltiger LastUpdatedTime. Bisher wurde eine
brauchbare native Position wegen ungueltiger Dauer verworfen. ReadTimeline
validiert beide jetzt unabhaengig. Fehlende Timeline laesst Transport intakt.

Desktop bereitet einmal lokal vor dem Fan-out positionSeconds, durationSeconds
und positionKind (native / estimated / unavailable) auf. Native Position hat
Vorrang; ohne sie zaehlt eine monotone Uhr nur beobachtete Wiedergabezeit,
pausiert bei Pause und synchronisiert bei wieder gueltiger Position. Titel-
oder Appwechsel setzen die Schaetzung zurueck; unveraenderte alte Timeline
nach Titelwechsel wird bis zur Aktualisierung nicht als neue Position/Dauer
uebernommen. Metadatenanreicherung allein startet keinen neuen Zaehler.
Repeat ist bei nativem Positionsruecksprung oder eigenem next/previous erkennbar;
ein komplett unsichtbarer Same-Title-Repeat ohne Timeline-/Metadaten-/Transport-
Signal ist technisch nicht unterscheidbar. Unbekannte Dauer bleibt null.
Erstkontakt mitten im Titel ohne native Daten bedeutet nur Zeit seit Beobachtung.
Roh-Timeline, Album und Tracknummer verlassen den Desktop-Adapter nicht.

Erreichbarkeit ist vom Wiedergabezeitanker getrennt: erfolgreiche changed:false-
Antworten erneuern den Heartbeat, nicht den Positionsanker. Die bisherige
45-Sekunden-Grenze erklaert das vom Nutzer nach 47 Sekunden beobachtete
Ausgrauen. Nach echtem Fehler bleiben Mixer-/Playing-Daten fuer spaetere
unveraenderte Erholungsantworten erhalten. Echter Antwortausfall bleibt offline.
Web/EFB extrapolieren auch ohne Dauer, maximal 20 Sekunden seit Zeitanker.
Schaetzzeit ist sichtbar gekennzeichnet; Fortschritt nur bei bekannter Dauer.
15-Sekunden-Anker und Watch-/Relay-Frequenz bleiben erhalten.

Windows-11-Media-Player Microsoft.ZuneMusic 11.2607.16.0 meldet die Sitzung
Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic; Erkennung/Bedienung vom
Nutzer bestaetigt. Sein Manifest nennt Microsoft.Media.Player.exe; diese exakte
Familie wird fuer Core Audio nun darauf abgebildet. Lautstaerke bleibt von
wirklich vorhandener Prozess-Audiositzung abhaengig. Legacy wmplayer.exe lief,
lieferte aber keine GSMTC-Sitzung. Keine Prozess-only-Fake-Erkennung ergaenzt.
Ein eigener Legacy-Adapter braeuchte die dokumentierte WMP-Remoting-Anbindung
(IServiceProvider/IWMPRemoteMediaServices), keine neue isolierte WMPlayer.OCX-
Instanz. Das ist hier nicht implementiert.

83 Desktop-/Core-/EFB-HTTP-/Regressionstests unter Windows bestanden, inklusive
sechs nativer PowerShell-Konverterfaelle. Zwei Minuten unveraenderte virtuelle
Watches fuer Playing und Pause sowie echter Antwortausfall/Erholung geprueft.
Live-Smoke mit produktivem Windows-Helfer und privater HTTP-Bruecke: 9 Watches,
mehr als eine Minute, kein Fehler. Keine Audiodaten, Zugangsdaten oder
zusaetzliche Relaylast. Bestehende alpha.3-Mixer-/IID-/Fehlercachefixes erhalten.
Gezielt nur zwei Medien-EFB-Assets mit produktivem compileShared erzeugt.
Hauptagent uebernimmt Versionswahl, Builds und Feldrollout; diese Arbeitskopie
veraendert keine Versions-/Kanaldateien und keine oeffentlichen Artefakte.
## Desktop-Hotfix 1.6.14-alpha.3

Der Chrome-Feldtest zeigte einen nativen Mixerfehler und einen festgehaltenen
Fehlerstatus im Web. Die IMMDeviceCollection-IID muss
`0BD7A1BE-7A1A-44DB-8397-CC5392387B5E` sein, siehe
[Microsofts COM-Referenzquelle](https://github.com/microsoft/psi/blob/master/Sources/Audio/Microsoft.Psi.Audio.Windows/ComInterop/Guids.cs).
Der periodische Mixerzugriff ist vom Transport-/Metadatenprozess abgefangen.
Prozessnamen ohne `.exe` werden akzeptiert; tatsächliche Prozesszuordnung
bleibt durch Core Audio geprüft. Fehlgeschlagene private Watches werden
bei der nächsten Anfrage frisch ausgeführt statt dauerhaft gecacht.

Der neue Desktop benötigt weiterhin Runtime v533. 64 Desktop-Tests bestanden;
reale Windows-/Browser-Abnahme bleibt offen. Der lokale Test-Runtime-
Sonderstart wurde entfernt.

# Windows-Mediensteuerung

## Origin-Alpha-Rollout 15.10.2026

Freigegebener Testumfang: Webapp auf Origin, Tracker **v532** im Alpha-Kanal
und Desktop **1.6.14-alpha.2** als Alpha-Installer. Die Stable-Runtime und der
Stable-Desktop-Zeiger bleiben unverändert. Der Tester installiert die neue
Desktop-App, wählt darin **Alpha** als Tracker-Kanal, lädt v532 und meldet die
Origin-Webapp mit derselben Pilot-ID/PIN an. Danach Kartentisch → Audio →
Mediensteuerung aktivieren und den Notenschlüssel öffnen. Spotify oder ein
anderer unterstützter Windows-Player läuft separat auf demselben PC.

Native Windows-/Player-Bedienung und hörbare Absenkung sind Feldabnahmepunkte,
keine bereits bestandenen Tests. Statusdaten bleiben auf sichtbare Bediengeräte
begrenzt; Titeländerungen und gelegentliche Zeitanker werden übermittelt.
Eine belastbare Messung der realen Relay-Last ist beim Feldtest noch offen.
Keine zusätzlichen Cloudflare-Endpoints und kein Worker-Deployment nötig.

Beide Prereleases veröffentlicht, Quellcommit `4b695cdb2`:

- Runtime v532: 173799370 Bytes, SHA-256
  `64baaba76273b114cac837a7265caafdc8e7450d0b47de6a7f1209dc7c1f2e08`.
- Desktop-Installer 1.6.14-alpha.2: 100251394 Bytes, SHA-256
  `9b86d447ed4a8c1f3d846e484615c0f6a153aa65a95939d59e2c6ae97711f225`.
- Blockmap: 106684 Bytes, SHA-256
  `fa6d29f46ccbe9be8dc46e27020945aa144ffbd2c95a1d91682749c1536ca5cc`.

GitHub-Assetdigests und öffentliche Downloads für Runtime, Installer, Blockmap
und Alpha-Updatemetadaten stimmen mit den lokalen Builds überein. Danach die
Alpha-Zeiger für Runtime/Desktop auf diese Artefakte aktiviert; Webcache v2072.
Die Origin-Webapp bietet den direkten Alpha-Installer-Link in den Sync-Einstellungen.

Prüfung vor Veröffentlichung: 84 Node-Tests, bestehender Tracker-Interface-
Selftest, Web-Relay-Desktop-Integration mit simuliertem Windows-Player und
Winamp-Layout-/Drag-/Zoom-Browsernachweis bestanden. Windows-x64-NSIS-Build,
Blockmap und Runtime erstellt; Medienquellen in ASAR/Unpacked bytegleich geprüft.

Stand 14.10.2026, Basis `86de66006`, frisch gegen Origin geprüft (0/0).

## Web-Anbindung

Die Webapp lädt `media-player-ui.js` / `media-player-client.js` und aktiviert
das Winamp-Gerät über das Audio-Menü. Der Client nutzt `gaMediaRequest` in
`sync.js`; der Tracker prüft Pilot-PIN, Capability, Befehlsform, Client-ID,
Rate-Limit und doppelte Relay-Zustellungen. `tracker-media-bridge.js` sendet die
validierten Aufträge an einen privaten dynamischen Loopback-Port der Desktop-App.
Nur deren Kindprozess erhält das zufällige Token. Kein öffentlicher Zusatzserver.

Die Statusverbindung ist eine begrenzte Änderungsabfrage: native Abfrage lokal
einmal pro Sekunde nur solange ein Web-Waiter vorhanden ist. Titel, Play/Pause,
Playerwahl, Lautstärke, Absenkung und Positionssprünge führen zu einer Änderung.
Normale Zeitfortschritte werden erst nach 15 Sekunden neu verankert und lokal
fortgeschrieben. Eine Abfrage endet nach 15 Sekunden mit einer kleinen
Unverändert-Antwort. Beim Schließen/Verbergen endet der nächste Abfragezyklus;
eine bereits laufende Abfrage kann noch einmal auslaufen. Keine Metadaten in
GPS-Telemetrie, keine Cover-/Audiodaten. Eine Sekunde Absenk-Lease-Erneuerung
über das Relay erfolgt ausschließlich während tatsächlicher Web-Audiowiedergabe.

Mehrere Audioclients dürfen die Absenkung gleichzeitig halten; das Ende einer
Ansage hebt die Absenkung eines anderen Clients nicht auf. Die native
Fünf-Sekunden-Sicherung bleibt wirksam. Winamp-Transport enthält jetzt explizites
Play/Pause und optionale Zeit-/Dauerwerte aus der Windows-Timeline.

Andere Windows-Player sind bedienbar, sofern sie GSMTC-Sitzungen bereitstellen.
Die Auswahl zeigt tatsächlich gemeldete Player, keine fest angenommene Liste.
Lautstärke/Absenkung benötigen zusätzlich eine eindeutig abbildbare Prozess-
Audiositzung. Bei Browsern betrifft sie unter Umständen weitere Tabs desselben
Prozesses. Fähigkeiten und Zeitdaten sind playerabhängig und auf Windows zu prüfen.

Windows-Test: den veröffentlichten Desktop 1.6.14-alpha.2 installieren und im
Tracker den Alpha-Kanal mit Runtime v532 wählen. Die alten lokalen Test-ZIPs
sind abgelöst. Der temporäre Sonderstart wurde aus den Quellen entfernt; neue
Builds verwenden ausschließlich die reguläre Runtime-Verwaltung.

Die Origin-Webapp enthält die Funktion nach dem Rollout. Auf Webapp und
Windows-Tracker mit derselben Pilot-ID/PIN anmelden. Musiksteuerung benötigt
keinen laufenden Simulator. `tools/web-media-integration-selftest.mjs` prüft die
echte UI und Relay-/Token-/Desktop-Brücke mit simuliertem Windows-Player;
native GSMTC-/Core-Audio-Abnahme bleibt offen.

Der erste Funktionstest sitzt in der Windows-Tracker-Desktop-App unter Voice.
Die Oberfläche zeigt den ausgewählten Windows-Player, Titel/Interpret,
Play/Pause, Vor/Zurück und die Lautstärke der zugehörigen Anwendung. Spotify
läuft und authentifiziert sich in seiner eigenen Windows-App. Keine Spotify-
Web-API, kein Spotify-Token und keine Musikwiedergabe im Dispatcher.

## Grenzen und Zuständigkeit

- `desktop/lib/windows-media.js` ist der validierte, serialisierte IPC-Adapter.
  Er startet eine einzige lokale Windows-PowerShell-5.1-Instanz. Eingaben gehen
  ausschließlich als JSON über stdin; der Skriptpfad und die Befehle sind fest.
- `windows-media.ps1` verwendet Windows GSMTC für Mediensteuerung und Metadaten.
  Der Player muss eine Windows-Mediensitzung anbieten. Nicht unterstützte
  Bedientasten sind deaktiviert. Ein verschwundener ausgewählter Player wird
  nicht still durch einen anderen ersetzt.
- `windows-media-volume.cs` verwendet Core Audio für die Anwendungslautstärke
  auf aktiven Wiedergabegeräten. Spotify-Desktop-/Store-IDs werden explizit auf
  den Spotify-Prozess abgebildet. Andere einfache EXE-IDs werden auf den gleich-
  namigen Prozess abgebildet; sonst bleiben Lautstärke und Absenkung deaktiviert.
  Mehrere Mediensitzungen derselben Anwendung teilen deren Lautstärke. Bei
  Browsern kann dies auch andere Tabs betreffen. Der Windows-Master und MSFS-
  Lautstärke werden nicht verändert.
- Native PowerShell-/C#-Dateien werden beim Desktop-Build aus ASAR ausgepackt.
  Windows 10 ab 1809/Windows 11 erforderlich; andere Plattformen zeigen einen
  sichtbaren Hinweis. Kein zusätzlicher Spotify-API-Schlüssel oder Adminzugang.

## Absenkung

Der optionale `onAudible`-Callback des bestehenden Audioplayers meldet den
tatsächlichen Clipstart und jedes Ende, einschließlich Abbruch, Gerätewechsel
und Playback-Fehler. Downloads/Decoding lösen keine Absenkung aus. Der
Desktop-Adapter meldet nur nicht stumm gestartetes Audio. Der Callback ändert
keine Job-/Lease-/Missionsentscheidung.

Die Oberfläche hält mehrere laufende Clips über Effect-ID und Stage auseinander.
Während Wiedergabe wird die Absenkung jede Sekunde erneuert. Der native Helper
setzt dafür eine Fünf-Sekunden-Lease und stellt die Musik bei ausbleibender
Erneuerung wieder her. Normales Ende hält 350 ms für direkt anschließende Clips;
danach steigt die Lautstärke in kleinen Schritten. Standard: 20 Prozent der
individuellen Ausgangslautstärke, wählbar 10/20/35/50 Prozent, abschaltbar.

Manuelle Lautstärkeänderungen im Windows-Mixer werden als neuer Ausgangswert
übernommen; die UI kann den Ausgangswert während Absenkung explizit ändern.
Playerwechsel und reguläres Beenden stellen die betreuten Sitzungen wieder her.
EOF im Helper führt zur Wiederherstellung im finally-Block. Ein zwangsweises
Beenden des Helpers selbst oder ein Windows-Absturz kann diesen Block umgehen;
das ist keine garantierte Crash-Recovery. Gespeichert werden nur UI-Einstellungen,
keine privaten Medienmetadaten oder Kontodaten.

## Spätere Oberflächen

### Winamp-Designvorschau vom 14.10.2026

`media-player-ui.js` / `media-player.css` bilden den ersten CSS-/SVG-Entwurf nach
der Bildreferenz. Isolierte Vorschau: `tools/previews/media-player.html` mit
expliziten Beispieldaten. Dieser erste Entwurf war noch nicht angebunden;
die aktuelle lokale Web-Anbindung ist oben beschrieben. `onCommand` und
`update` sind deren Anschlusspunkte. EFB/Toolbar sind weiter nicht angebunden.

Runder Notenschlüssel-Button und Gerät wechseln sich an derselben Position ab.
Button und Titelleiste sind verschiebbar; Öffnen/Zoom/Resize begrenzen das Gerät
auf die Hostfläche. Transport, Lautstärke, Zoom, sichere Textdarstellung,
Lauftext bei Überlänge und Zeit-/Fortschritts-Fallback sind vorbereitet. Zoom
ersetzt Shuffle/Repeat. Die Reihe unter der Uhr ist dekorative Statusgrafik,
kein ausgelesenes Audiospektrum. Play/Pause werden als getrennte Tasten gezeigt.

`node tools/media-player-design-selftest.mjs` prüft echte Browserinteraktionen
mit simulierten Daten: Transport/Lautstärke, Zoom, beide Drag-Zustände,
Klickunterdrückung nach Drag, Button-/Gerätewechsel, Audio-Menü-Aktivierung,
Panelgrenzen und fehlende Zeitdaten. Screenshots unter
`analysis/media-player-design-2026-10-14/`. Keine nativen EFB-/VR-Nachweise.

Eigene Medien-Designauswahl, unabhängig vom Haupt-App-Designpreset:
`minimal`, später **Winamp**, **iPod Classic**, **Retro-Taschenradio**.
Alle Designs verwenden dieselbe Mediensteuerung. Die aktuelle Fassung bietet
bewusst nur `minimal`. Präferenzen liegen separat unter `ga.media.preferences.v1`.

Die lokale Kartentisch-Webapp einschließlich Tablet-Relay und deren Audio-
Absenksignalen ist inzwischen angeschlossen. Native EFB-/Toolbar-Bedienung
bleibt offen. Der authentifizierte Vertrag und eine gemeinsame Medieninstanz
bleiben dafür die Grundlage.

## Validierung

- Node-Tests für validierte Befehle, Serialisierung, Helper-Ausfall, Shutdown,
  Nicht-Windows-Fallback sowie tatsächlichen Audiostart/Completion/Abbruch.
- `node tools/desktop-media-ui-selftest.mjs`: echte Browserklicks mit simuliertem
  Windows-Adapter, sichere Titelanzeige, Playerwahl, Lautstärke, mehrere Clips,
  gespeicherte Präferenzen, Ausfall/Wiederkehr und schmale Darstellung.
- Echte GSMTC-/Core-Audio-Ausführung, Helper-Kompilierung unter Windows und
  hörbare Absenkung mit Spotify sind noch auf Windows abzunehmen. Browser- und
  Node-Tests allein belegen keine funktionierende native Windows-Integration.
- Auf Origin als Alpha-Test veröffentlicht; Web-Relay-Erweiterung in der
  Tracker-Runtime und passender Desktop-Installer gebaut.

Ergebnis des lokalen Durchlaufs: 59 Desktop- und 17 Audioplayer-Tests bestanden;
Medien-UI-Test inklusive 440-px-Screenshot bestanden. Windows-x64-Desktop-Paket
erfolgreich erstellt; Adapter, UI und ausgepackte native Quellen bytegleich mit
den Arbeitsdateien geprüft. Der bestehende breite `tracker-audio-ui-selftest.mjs`
erreicht aktuell sein verborgenes `gaAudioOutputSelect`-Feld im Web-Fixture nicht
(Timeout vor dem Desktop-Teil); eine vollständige EFB-UI-Regression ist damit
nicht bestätigt. Dieser Medienkandidat verändert keine EFB-/Web-Oberfläche.
