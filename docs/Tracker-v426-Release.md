# Tracker v426 Alpha – Startkorrektur und Prozessgrenzen

Behebt den Startabbruch von v425: Der EXE-Packager interpretierte
`--mission-worker` als Skriptdatei. Der Kindprozess wird jetzt mit dem expliziten
Tracker-Skripteinstieg gestartet. Worker-Fehlerausgaben landen im Debuglog.

Zusaetzlich korrigiert:

- POI-Sprachtexte warten auf die asynchrone, dauerhafte Speicherung im Worker,
  bevor TTS/Playback beginnen. Die Revision wird im Authority-Prozess gelesen.
- Sprachauftraege werden nicht mehr vom kuerzeren 30-Sekunden-IPC-Timeout
  abgeschnitten. Normale Anfragen behalten ihre kurze Frist.
- Verbindungsabbau bricht Payload einmal ab, ohne veralteten zweiten Callback.
  Bei Worker-Ausfall zeigt der Status keine aktive Simulatoranbindung mehr.

Der Startfehler wurde in einem gepackten pkg/Node18-ARM64-Programm reproduziert.
Der korrigierte gepackte Start inklusive Authority-Schreibzugriff und Shutdown
ist erfolgreich. Der Windows-/MSFS-Feldtest steht weiterhin aus.

333 gezielte Tests bestanden; zusaetzliche Abbruch-/Reconnect-Pruefung bestanden.

Windows-x64-PE, pkg 6.18.1/Node18.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57774294 Bytes

SHA-256: `5fe252eeff818439a6803b771cbdc1a34fd755ff51c82a1454b0bdc6fa20218b`
