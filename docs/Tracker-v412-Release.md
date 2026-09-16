# Tracker v412 Alpha

- PAX-Button mit NEU-Badge, verschiebbarer und gespeicherter Position.
- Bestaetigte Texte und POI-Anweisungen im PAX-Menue; doppeltes Textbanner entfernt.
- Verladeanzeige erhaelt 0 % Health korrekt statt daraus 100 % zu machen.
- Missionsmenue zeigt den aktuellen Manifest-/Stresszustand statt altem App-Health.
- Pflichtladungszaehler beruecksichtigt nur Pflicht-Items.

316 Tracker-/EFB-Tests und Electron-Browserprobe bestanden. Vollstaendige POI-
Runtime: Stress erzeugt 23 % Health, beide Anzeigen zeigen denselben Wert und
1 geladenes Pflicht-Item. Original-App-Vergleiche fuer Lifecycle/Farewell/Cargo
weiterhin bestanden. Keine Aenderung an Schadensregeln oder Verbindungstransport.

Nutzer bestaetigt Missionsabschluss und Signatur unter v411; Verbindungsstutters
bleiben in Beobachtung. „0 geladen“ bei noch geladener Ladung ist aus den Logs
nicht abschliessend erklaert und bleibt als Feldtestpunkt offen.

Desktop 1.6.11 und vorhandenes EFB-Package bleiben kompatibel. Stable unveraendert.
Kein realer Windows-/MSFS-Test dieses Builds auf dem Entwicklungsrechner.
