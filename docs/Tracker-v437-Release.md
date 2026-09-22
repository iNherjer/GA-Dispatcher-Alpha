# Tracker v437 Alpha

Mapping-/Survey-Missionen (`mapping_survey`) laufen jetzt eigenstaendig im
Tracker. Das Gate ist fuer Nord-Sued-Scanlinien und Orbits offen. Verwendet werden
die originalen Survey-Algorithmen sowie Status-, Orientierungs-, Fortschritts-
und Korrekturtexte. App und EFB zeigen denselben Fortschritt auf der Karte und
im Missionsfenster. Start, Pflichtladung, Komfort, Rueckflug und Abschluss nutzen
den bestehenden APT-/POI-Lifecycle.

Kurze, plausible Telemetrieluecken werden im Mission-Worker mit begrenzten
Flugwegsegmenten ueberbrueckt. Pause, Slew, fehlende Daten, Teleports und lange
Luecken unterbrechen den laufenden Abschnitt; fertige Linien/Kreise bleiben.
Keine zusaetzlichen synchronen Dateischreibvorgaenge pro Trigger.

Die originalen Survey-Sprachclips werden lokal mitgeliefert. Dadurch wird der
Tracker-Download groesser; fuer diese Clips fallen keine Cloud-TTS-Anfragen an.
Textbestaetigung und Audio-Ausgabe verwenden weiterhin die zentrale Voice-Instanz.

Geprueft: eingefrorene Originalreferenzen, 5.376 manuelle PAX-Aktionsvergleiche,
3.360 Voice-Vergleiche, Lifecycle/Farewell/Cargo-Differentialtests, Scan/Orbit mit
Restart und unvollstaendiger Telemetrie, echter Mission-Worker sowie Missions-,
Voice- und EFB-Regression. Reale MSFS-/Coherent-/Audio-Pruefung steht noch aus.

POI-Ketten, Training, SAR und Bush bleiben an ihren spezialisierten Gates gesperrt.
