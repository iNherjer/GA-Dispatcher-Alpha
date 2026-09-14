# VFR Multitool Toolbar – TP0 0.1.0

Lokaler Plattformkandidat vom 14.09.2026 auf Basis `3679c8af9` (Tracker v403).
Noch **kein abgenommenes Toolbar-Panel** und kein Release.

## Umfang dieses ersten Schritts

Eigenes Paket `vfr-multitool-toolbar-panel`, eigenes Icon, native Fensterhuelle,
Offline-Anzeige und isolierter Loopback-Test. Die Shell laedt ausschliesslich
die bestehende `/efb/v1/probe/`, nicht den schreibfaehigen Kartentisch. Diese
Probe liest einmal `/api/v1/snapshot` und besitzt nur einen lokalen Klicktest.
Die Shell prueft bei sichtbarem Fenster alle vier Sekunden die Erreichbarkeit.
Sie erzeugt keine Cockpit-Session, Audio-Lease oder Missionsaktion.

Das ist eine bewusst begrenzte Vorstufe des Handoffs. Der geforderte gemeinsame
Kartentisch unter `/efb/v1/?host=toolbar&channel=...&view=9`, seine wirksame
Read-only-Testsperre und anschliessende Funktionsparitaet sind noch offen.
Ein Queryparameter allein ist keine Schreibsperre. Keine zweite Frontendkopie
und keine neue Missionsautoritaet einbauen.

## Verifizierte lokale Grundlagen

- SDK: `C:\MSFS 2024 SDK\version.txt` = `1.7.2`.
- Simulator: `G:\SteamLibrary\steamapps\common\MSFS2024`.
- Native Registrierungsfelder: `Propdefs/1.0/Common/propingamepanels.xml`,
  `InGamePanels.InGamePanelDefinition`.
- Native Shellreferenz: `Packages/fs-base-ingamepanels-common/html_ui/ingamePanels/GenericPanel/GenericPanel.html`.
- Native Ereignisse und Close: `Packages/fs-base-ui/html_ui/Templates/ingameUi/ingameUi.js`:
  `panelActive`, `panelInactive`, `active`, `visible`, `minimized`, `closePanel()`.
- Toolbarservice: `Packages/fs-base-ui/html_ui/JS/Services/ToolBarPanels.js`.
- Keine Dateien dieser installierten Basispakete wurden kopiert oder geaendert.
- Das SDK-Verzeichnis enthaelt kein installiertes Toolbar-Sample. Die hier
  abgeleitete Registrierung benoetigt weiterhin erfolgreichen SPB-Build und
  einen echten Simulatorlauf; das Lesen nativer Quellen beweist keine Freigabe.

Die Shell entlaedt den Frame bei Hide/Close/Minimize. Neue Sichtbarkeit erzeugt
einen neuen Frame mit neuem Channel. Gewoehnliche Verbindungsfehler entladen
einen laufenden Frame nicht. Die Probe bestaetigt keinen Channel; deshalb
akzeptiert diese Vorstufe Nachrichten nur bei exakt passendem `event.source`
und Loopback-Origin. Ein Coherent-Event ohne `source` wird verworfen und muss
im Simulator diagnostiziert werden. Fuer den Kartentisch spaeter zusaetzlich
den bestehenden Channel-Vertrag anwenden.

## Build und Tests (PowerShell)

Im Ordner `ga-tracker-client/toolbar-panel`:

```powershell
node --check PackageSources/html_ui/InGamePanels/VfrMultitool/Panel.js
node --test panel.test.cjs
& 'C:\MSFS 2024 SDK\Tools\bin\fspackagetool.exe' "$PWD\VfrMultitoolToolbarProject.xml" -nopause
```

Der offizielle Package-Tool-Aufruf startet den Simulator im Buildmodus.
`-help` ist kein unterstuetzter Hilfeschalter: Er wird als Projektpfad behandelt.
Bei Steam-/Launcherproblemen nicht wiederholt weitere Prozesse starten.
SDK-Ausgabe wird unter `Packages/vfr-multitool-toolbar-panel` erwartet, SPB
unter `InGamePanels/`, UI unter `html_ui/InGamePanels/VfrMultitool/`.
SPB-Ausgabe, manifest.json, layout.json, Pfade und Groessen muessen tatsaechlich
vorliegen und validiert sein, bevor ein Test-ZIP erzeugt wird.

Offizielle Buildreferenz:
https://docs.flightsimulator.com/msfs2024/retail/sdk-tools/package-tool/package-tool/

## Abnahme

| Pruefung | Ergebnis 14.09.2026 |
| --- | --- |
| JavaScript-Syntax | PASS |
| Close/Abort und spaete Antworten | PASS, Node-VM |
| Nachrichten von falschem Origin/Fenster | PASS, Node-VM |
| Kurzer Ausfall, Minimize/Restore, frischer Frame | PASS, Node-VM |
| Offline-Retry und begrenzte Bereitschaftsfrist | PASS, Node-VM |
| Offizieller SDK-Build / SPB / Layout | PASS beim Wiederholungsbuild; leerer RPTErrors-Bericht, 5 Layoutdateien geprueft |
| Icon, Fenster und Close in MSFS | Offen |
| Loopback, Klicktest und Eingabefokus in Coherent | Offen |
| Kamerawechsel, Pause, Flugwechsel, Detach/Resize | Offen |
| EFB gleichzeitig offen | Offen |
| Gemeinsamer Kartentisch und Missions-/Audio-Paritaet | Noch nicht implementiert/abgenommen |

Keine Community-Installation, kein Upload, kein Commit/Push und keine aktive
Kanaldatei. Der bestehende EFB-Arbeitsstand bleibt unveraendert.

### Erster Buildversuch (durch Wiederholungsbuild geloest)

Simulator-Dateiversion: `1,8,16,0`. Die Package-Tool-Versuche mit `-forcesteam
-nopause` und nur `-nopause` lieferten keine Paketausgabe. Die ausschliesslich
fuer diesen Auftrag gestarteten wartenden Launcher wurden beendet. Ein
anschliessender direkter Start von `FlightSimulator2024.exe` mit der vom
Launcher beobachteten `BuildAssetPackages`-Argumentstruktur endete ebenfalls
ohne Ausgabe. Es entstanden keine `Packages` oder `_PackageInt`-Artefakte;
die umgeleiteten stdout/stderr-Dateien blieben leer. Es wurde kein Erfolgscode
als Buildnachweis verwendet. Ursache offen: Simulator-/Steam-Start zuerst
interaktiv pruefen, danach den dokumentierten offiziellen Aufruf wiederholen.

### Erfolgreicher Wiederholungsbuild am 14.09.2026

Nach Nutzerhinweis, dass MSFS gestartet hatte, erzeugte der erneute offizielle
Package-Tool-Aufruf die Ausgabe. Der erste erfolgreiche Build zeigte eine
doppelte Dateiendung `.spb.spb`. Der Quellname wurde auf
`InGamePanel_VfrMultitool.xml` korrigiert und in einem frischen Ausgabeordner
erneut gebaut:

```powershell
& 'C:\MSFS 2024 SDK\Tools\bin\fspackagetool.exe' "$PWD\VfrMultitoolToolbarProject.xml" -outputdir "$PWD\build-logs\verified-build" -tempdir "$PWD\build-logs\verified-build" -nopause
./prepare-test-zip.ps1 -PackagePath 'build-logs/verified-build/Packages/vfr-multitool-toolbar-panel'
```

Gueltige Ausgabe: `build-logs/verified-build/Packages/vfr-multitool-toolbar-panel`.
Die aeltere Ausgabe direkt unter `Packages/` ist verworfen und nicht zu installieren.
Der SDK-Exitcode ist 0, `_RPTErrors.xml` enthaelt `<RPTErrors/>`.
Die Registrierung lautet jetzt `InGamePanels/InGamePanel_VfrMultitool.spb`.
Manifest: Version 0.1.0, Builder Microsoft Flight Simulator 2024,
Minimum Game Version 1.8.16. Alle fuenf Layoutpfade und Groessen stimmen;
die vier UI-Dateien sind hashgleich mit den Quellen. Das ZIP enthaelt genau
einen Paketroot und sieben Dateien; alle entpackten Dateihashes wurden direkt
aus dem Archiv mit dem SDK-Paket verglichen. Vier Node-VM-Tests bestehen erneut.

- Archiv: `release/vfr-multitool-toolbar-panel-0.1.0-TP0-test.zip`
- Groesse: 5722 Bytes
- SHA-256: `e0ddf10d5003fe95a4a51ebe61e00b5f12b3c4c81888ce12301822e61514c3ef`

Das Paket enthaelt weiterhin ausschliesslich die isolierte Verbindungsprobe.
Native Registrierung, Fensterbedienung und EFB-Parallelbetrieb sind erst nach
einem echten In-Sim-Test bestaetigt. Keine Installation oder Kanalumschaltung.
