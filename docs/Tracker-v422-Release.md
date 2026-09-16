# Tracker v422 Alpha

Cargo-Bedienung in EFB und Toolbar ohne blockierenden Missionsabruf nach
bestätigtem Intent. Der lokale ACK liefert den bestätigten Missionssnapshot;
ältere Polls dürfen ihn nicht überschreiben. Die gemeinsame App-/EFB-Queue
bündelt nur bereits wartende Cargo-Aktionen, ohne zusätzliche Sammelpause.
Laden → Entladen → Laden bleibt vollständig erhalten. Neue Diagnosemarker
trennen Queuezeit, Backend-Verarbeitung, Projektion und Antwortzeit.

Manifest-Commits bleiben geordnet und revisionsgeprüft. Simulatorwirkungen,
Payload-Recovery und unabhängige Voice-Effekte behalten ihre Bestätigungen.
Telemetriekadenz und persistenter Authority-Kern unverändert.

130 Tests bestanden, einschließlich lokalem HTTP-Server und verzögerten
ACK-/GET-/Voice-Fällen. Windows-x64-PE mit pkg 6.18.1, Node-18-Zielruntime,
ohne V8-Bytecode gebaut. Kein nativer Windows-/MSFS-Test auf diesem Mac.

Runtime v422, EFB-Assets 42201. Bestehendes EFB-Package und Desktop bleiben
kompatibel. Nur Tracker-Alpha wird umgestellt; Stable bleibt unverändert.

Release-Asset: `VFR-Multitool-Tracker.exe`  
Größe: 57744715 Bytes  
SHA-256: `ac1620117a59506b797388af7ad8f535e4dd50eeb0fd6eca03795829b5d7e2d9`

Feldtest: Tracker v422 starten, EFB neu öffnen; Rucksack laden,
Erste-Hilfe-Koffer ausladen/wieder laden. Bei Verzögerung beide Logs sichern.
