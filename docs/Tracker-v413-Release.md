# Tracker v413 Alpha

Verlustfreier Cloud-Profiltransport fuer App und Tracker. Mission und Startseed
werden gemeinsam geprueft und atomar veroeffentlicht. Dadurch entfallen die
bisherigen groessenabhaengigen Verluste von Tracker-Seed, MissionTruth und Kontext.

Gzip, kleine SHA-256-gepruefte Teile, Wiederverwendung unveraenderter Daten und
selektiver Tracker-Download von Mission/Metadaten. Konkurrierende Geraete werden
durch Cloud-Revisionen geschuetzt; Uploadfehler lassen den alten Stand erhalten.

App nach Update mit vollstaendigem lokalen Missionsstand einmal hochladen.
Frueher bereits entfernte Daten lassen sich nur aus einer vollstaendigen lokalen
Kopie wiederherstellen. Worker V2 muss vor Web-/Tracker-Verwendung aktiv sein.

Desktop 1.6.11 und EFB-Package 0.4.14 bleiben; Stable unveraendert.
Keine Aenderung an Missionsregeln oder EFB-Verbindungstransport.
Kein realer Windows-/MSFS-Test auf dem Entwicklungsrechner.

Validiert: 15 Sync-Protokolltests, 5 Cloud-Kandidatentests (APT und POI),
272 Missions-/Authority-Tests, 103 EFB-Tests, kompletter Worker-Testlauf sowie
App-Update-/Route-Restore-Tests. Originalvergleiche: 4320 Lifecycle-,
192 Farewell-, 864 Cargo-Stress-, 21 Cargo/PAX-Cue- und 1344 Voice-Faelle.
Echter lokaler Workers-/Durable-Object-Runtime mit synthetischen Daten geprueft.

Zusaetzlicher Befund: `sightseeing_tour` ist weiterhin nicht im bestehenden
Tracker-Gate freigegeben; diese fachliche Erweiterung ist kein Transportfix.
