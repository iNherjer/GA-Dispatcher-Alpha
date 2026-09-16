# Tracker v420 Alpha

Behebt den wirkungslosen Startbutton bei grossen Cloud-Missionen. Das reale
Sightseeing-Paket mit 414765 Bytes scheiterte an einer alten 384-KiB-Grenze.
Lokaler Missionsspeicher und Angebotspruefung verwenden jetzt gemeinsam 12 MiB,
mit Reserve ueber der unveraenderten 8-MiB-Cloud-Profilgrenze.

Startfehler erscheinen direkt am EFB-Banner und im Aktivierungslog. Direkte
App-Handoffs kuerzen keine Missionsdaten mehr; zu grosse Relay-Nachrichten
werden sichtbar abgelehnt. Vollstaendiger Remote-Resume ueber 512 KiB ist weiterhin
nicht implementiert und benoetigt ein eigenes Teilpaket-Protokoll.

Flug-Code-Export laedt bei Speicherknappheit den vollstaendigen IndexedDB-Stand.
Code- und alte PLN-Backup-Importe verwenden den sicheren Missionsspeicher.
Keine erhoehten Worker-Write-Raten oder Cloud-Limits.

Nachweise und restliche Grenzen: [Transport-Audit](Mission%20Lossless%20Transport%20Audit.md).
Runtime v420, EFB-Assets 42001. Desktop 1.6.11 / EFB-Package 0.4.14 unveraendert.
