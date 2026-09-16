# Tracker v419 Alpha – optionaler Sightseeing-Wissenskontext

v418 verlangte fuer Sightseeing irrtuemlich einen akzeptierten Wissenskontext.
Die reale Mission „Panorama-Rundflug: Averser Bruecke (A13)“ war in Cloud-Revision 20
vollstaendig gespeichert, aber ohne Wissenskontext und ohne Tracker-Seed.

Wie in Standalone ist Wissen jetzt optional. Fehlende, leere oder abgelehnte
Wissenskontexte liefern keine zusaetzlichen Faktenhinweise; die Mission bleibt
bei ansonsten gueltigem Vertrag ausfuehrbar. Akzeptierte Fakten werden weiterhin
verwendet. Identitaet, Domain, Szenenplan und andere Sicherheitspruefungen bleiben.
Der generierte gemeinsame Voice-Core korrigiert sowohl App-Seed als auch Tracker-Gate.

Regression: vollstaendiger Sightseeing-Ablauf mit und ohne Wissen inklusive
Neustart und Abschluss; 2240 Original-Promptvergleiche (einschliesslich fehlender,
leerer und abgelehnter Wissensdaten), 72 POI-Tests erfolgreich.

Nach Aktualisierung der App und des Trackers die bestehende Mission erneut
speichern/synchronisieren. Eine neue Generierung ist nicht notwendig. Bereits
hochgeladene Profile werden nicht serverseitig veraendert.
