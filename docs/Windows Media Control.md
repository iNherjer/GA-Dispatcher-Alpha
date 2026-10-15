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
