# Tracker v447 Alpha – Bush-Zielmissionen

Supply Strip, Charter Strip und Scenic Hopper sind für den Tracker freigegeben.
Die originale Bush-Fortschritts-/Abschlusslogik wird aus Standalone extrahiert und
an den vorhandenen APT-Ablauf für Verladen, Signatur, Ankunft und Abschied angebunden.

Die Auswertung bleibt im separaten Missionsprozess. Wiederaufnahme erhält den
Fortschritt; Bodenaktionen benötigen danach neue Telemetrie. Missionsanker bleiben
bei Navigationsänderungen fest. Die ursprünglichen Folgemissions-Seeds werden beim
bestätigten Abschluss erstellt; Aufenthalts- und Erzählkontext bleiben auch beim
kompakten lokalen Speichern erhalten.

Pickup, Recon und Helikopter bleiben gesperrt. Standalone-Ausführung bleibt
unverändert. Geprüft werden Originalkern-/Prompt-Parität, Cloud-/App-Gates,
komplette A-B-Abläufe, Folgeseeds und echter Missions-Unterprozess mit Neustart.
Der praktische Windows-/MSFS-Flug steht noch aus.

Validierung: 400 Missions-/Authority-/Replay-Tests und 19 EFB-Web-Tests bestanden;
Generator-Driftcheck und JavaScript-Syntaxchecks erfolgreich.
