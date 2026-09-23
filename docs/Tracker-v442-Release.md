# Tracker v442 Alpha – POI-Training

POI-Training verwendet jetzt die extrahierte Originalprozedur der Standalone-App:
360-/180-Grad-Kurven, Hoehenwechsel mit Halten und Stall-Recovery. Das Gate oeffnet
fuer vollstaendige Trainingsrezepte. Pflichtabschluss, freiwillige Extras,
Prebrief, Landevorbereitung und Debrief bleiben an die Originalregeln gebunden.

App und EFB nutzen gemeinsame Start-/Abbruch-/Extra-Intents und bestaetigte
Fortschritte. Bei Pause, Slew oder Telemetrieluecken wird nur der laufende
Durchgang zur Wiederholung freigegeben. Die Missionslogik bleibt im Kindprozess.
Originale Trainings-/Stall-Clips sind im Paket enthalten; dadurch ist die EXE
groesser. Die Standalone-Trainingsregeln und APT-Training werden nicht nachgeschaerft.

Enthaelt zudem die Tracker-interne Fire-Adapteraufteilung ohne Aenderung der
Originalmission sowie die bereits veroeffentlichten Charter-Folgemissionen aus v441.

Validierung: 673 Tests im zusammengefuehrten Tracker-/Charter-Stand erfolgreich,
plus Audio-Bridge-Regressionstest. Trainingsparitaet umfasst 2.700 Voice-Vergleiche,
Original-Flugtrigger, Prozedur und Restore. Cloud/App-Seed, Verladen, Revisionen,
Pflichtabschluss plus Extra und echter Missions-Kindprozess sind getestet.
Alle relevanten Generatorchecks und vorhandenen POI-/Fire-Differenztests bestanden.
Windows-EXE gebaut; ein realer Windows-/MSFS-Trainingsflug steht noch aus.
