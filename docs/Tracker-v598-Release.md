# Tracker v598 Alpha / Web v2248 – Crew-Status: kein Phantomflug aus dem Hauptmenü

## Änderungen

- Tracker: Im Hauptmenü, auf der Weltkarte und in Ladebildschirmen meldet der Simulator eine Platzhalterposition
  (oft in der Luft, GS 0). Die Crew-Meldung hat daraus einen freien Flug im „Reiseflug“ gemacht. Sie bekommt jetzt
  den kamerabasierten Menüzustand (`missionTelemetryInMenu`, dieselben Kamerazustände wie die Missionslaufzeit) und
  ignoriert Menüproben.
- Tracker: Wechsel zwischen Menü und Simulator, der 10 s hält, sendet sofort eine Statusmeldung statt bis zu 5 min
  später (höchstens eine zusätzliche Meldung pro Wechsel; kurzes Lade-Flackern sendet nichts).
- EFB-Assets neu synchronisiert (`styles.css`, `profile.js`, `navcom-preferences-client.js` aus den Web-Ständen
  bis v2247). Im EFB ohne sichtbare Wirkung: Hell/Dunkel, Glareshield und Fußzeile gibt es dort nicht.

Web (bereits live bis v2247): Crew-Detailkarte lädt beim Öffnen nach (ab 30 s Alter) und aktualisiert Flugzeug,
Werte und Uhrzeit in der offenen Ansicht; Ebenen-Menü dort wieder zugeklappt.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- `tracker-crew-presence` 10 Tests (2 neu: Menü-Platzhalter erzeugt keinen Flug; Kamerawechsel meldet nach 10 s,
  Flackern nicht), EFB-Asset-Tests 25.
- Tracker-Gesamtlauf 1516/1523; die 5 Mission-/Brand-/SAR-Fehlschläge treten nur unter Last im Paralleldurchlauf
  auf und bestehen einzeln (auch auf dem Stand vor der Änderung).

## Im Feld prüfen

- Tracker starten, im Hauptmenü bleiben: Crew-Brett zeigt keinen Flug.
- In einen Flug laden: Crew-Status kommt nach ~10–25 s statt nach bis zu 5 min.
