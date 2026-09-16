# Tracker v421 Alpha

Vollstaendige Missionspakete lassen sich jetzt auch oberhalb 512 KiB zwischen
App und Tracker uebertragen – fuer Start/Uebergabe, Snapshot und Geraetewechsel.
Keine Missionsfelder werden dafuer entfernt.

48-KiB-Teilpakete mit SHA-256, gezieltem Nachsenden und Empfaengerkennung.
Kurze Relay-Unterbrechungen werden innerhalb derselben App-/Tracker-Sitzung
aufgefangen; nach App-Neuladen oder Prozessneustart Anfrage erneut ausloesen.
Die Missionslogik uebernimmt ausschliesslich vollstaendig gepruefte Pakete.

App und Tracker aktualisieren. Kleine Nachrichten bleiben kompatibel zu alten
Versionen; grosse Transfers benoetigen v421. Cloud-Speicherwrites und Telemetrietakt
bleiben unveraendert, grosse Relay-Transfers benoetigen durch base64 etwa ein
Drittel mehr Daten plus Quittungen. Details: [Transport-Audit](Mission%20Lossless%20Transport%20Audit.md).

Runtime v421, EFB-Assets 42101. Desktop 1.6.11 / EFB-Package 0.4.14 unveraendert.
Automatisierte Transfer-/Missions-/Voice-/EFB-Regressionstests; In-Sim-Test offen.
