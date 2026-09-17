# Tracker v430 Alpha – weniger Kopien und Voice-Schreibarbeit

Unveraenderte grosse Missionsdaten werden fuer Worker-Zustandsmeldungen
wiederverwendet. Transportbestaetigungen bereiten dadurch nicht jedes Mal das
gesamte Missionspaket und die oeffentliche Ausfuehrungsansicht erneut auf.
Oeffentliche Getter liefern weiterhin abgetrennte Kopien; der IPC-Vertrag bleibt gleich.

Der Voice-Cache speichert Audio einmalig in separaten Binaerdateien. Weitere
Wiedergabestatus-Aenderungen schreiben nur den kleinen JSON-Index. Vorhandene
v1-Caches werden beim naechsten Speichern migriert. Beschaedigte Audioeintraege
werden einzeln isoliert. Alte Tracker lesen den neuen Voice-Cache nicht; die
Missionssicherung ist davon unabhaengig.

364 Regressionstests bestanden, einschliesslich identischer Public-Snapshots,
Wiederverwendung unveraenderter Daten, abgetrennter externer Getter, Cache-Migration
und Wiederherstellung trotz eines defekten Audioeintrags. Ein Test mit 2 MiB Audio
weist genau einen Audio-Schreibvorgang und einen Index unter 4 KiB nach.

Die originale Cargoqueue und die periodische Fuenf-Sekunden-Missionssicherung
bleiben erhalten. Die tatsaechliche Bedienlatenz muss im Windows-/SimConnect-Feldtest
geprueft werden; aus den Regressionstests folgt keine Millisekunden-Zusage.

Gepackter pkg/Node18-ARM64-Start mit produktivem Missionsprozess,
Checkpoint und sauberem Shutdown erfolgreich geprueft.
Windows-x64-PE mit eingebetteter v430-Version gebaut.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57795869 Bytes

SHA-256: `c5c4047e7222a8faa857406473fee8b619ae0c1cd0f4306c06042c3e11a6f8b8`
