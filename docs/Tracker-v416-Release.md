# Tracker v416 Alpha

Mission Control zeigt eine laufende Komfortwertung aus dem Tracker statt der
100-%-Vorlage vom Missionsbeginn. Der generierte `mission-comfort-core.js`
uebernimmt die Originalfunktionen aus `passenger-voice.js`, einschliesslich
Ereignisflanken, Pilot-/Wetterwertung, Cargo-Fokus und Debug-Slew-Schutz.
Die Standalone-App bleibt unveraendert. Generator mit `--check` sichert Drift ab.

APT und POI erfassen die Wertung nach Missionsstart. Pause, Menue, veraltete
Samples und Abschluss-Voice erzeugen keine neuen Komfortereignisse. Zustand
inklusive Ereignisflags wird im bestehenden lokalen Runtime-Checkpoint
persistiert und bei Restart wiederhergestellt. Keine zusaetzlichen Worker-Writes
oder per-Sample-Missionsereignisse; oeffentlich nur kompakte Score-/Zaehlerdaten.
Alte Runs ohne Komfortzustand zeigen bis zum ersten neuen Sample keine Wertung;
fruehere Belastungen werden nicht rueckwirkend erfunden.

Cargo-Feedback benennt fehlende, abgeworfene und beschaedigte Pflichtpositionen
anhand derselben Pruefergebnisse wie der POI-Detektor. Entladene Pflichtpositionen
werden als nicht an Bord erklaert, ohne die bestehende Standalone-Regel zu aendern:
`unloaded` gilt nicht als fehlend. Ausserhalb der Arbeitshoehe wird bei bestaetigter
Detektorabweichung die pausierte Arbeitszeit erklaert. PAX- und Wetterereignisse
werden getrennt dargestellt.

Start/Verladen/Boarding/Signatur bleiben im gemeinsamen APT-/POI-Startkern.
Nachweise: 600 Original-Komfortvergleiche; APT- und POI-Restore, Pause, doppelte
Samples, anhaltendes Ereignis nach Restart, 0-%-Score, Debugschutz und konkrete
Cargo-Hinweise. In-Sim-Nachtest bleibt erforderlich.

Runtime v416; EFB-Assets bleiben 41501. Desktop 1.6.11 und EFB 0.4.14 kompatibel.
