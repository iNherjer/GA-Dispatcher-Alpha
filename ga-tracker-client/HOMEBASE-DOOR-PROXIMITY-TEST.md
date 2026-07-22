# Homebase-Tor-Nähetest

`VFR-Multitool-Homebase-Door-Test.exe` ist ein separater SimConnect-Client. Er kann parallel zum normalen VFR-Multitool-Tracker laufen und verändert dessen WebSocket-, Spawn- oder Homebase-Kommandos nicht.

## Testablauf

1. MSFS 2024 und den normalen Tracker starten.
2. Mit der Workbench mindestens einen Homebase-Hangar spawnen. Das kann der primäre Hangar oder ein als Dekoration hinzugefügter Hangar sein.
3. `VFR-Multitool-Homebase-Door-Test.exe` starten.
4. Mit dem Flugzeug bis auf höchstens 28 Meter an einen erkannten Hangar heranfahren.
5. Danach aussteigen und den Test im Walkaround mit dem Benutzeravatar wiederholen.
6. Konsole und `homebase-door-proximity-test.log` prüfen.

Die Test-EXE erkennt alle katalogisierten Homebase-Objekte mit einer instanzlokalen Torsteuerung (`scope: "simobject"` und `L:1:`- oder `Z:`-Variable). Sobald Flugzeug, Benutzeravatar oder der von MSFS gemeldete aktive Benutzer höchstens 28 Meter von einem Hangar entfernt ist, öffnet sie nur das Tor dieser konkreten SimObject-Instanz. Dynamische Homebase-Mitarbeiter verwenden weiterhin die kleinere 18-Meter-Zone.

Sind anschließend alle frischen Flugzeug-/Avatarpositionen mindestens 30 Meter und alle Homebase-Mitarbeiter mindestens 20 Meter vom erkannten Hangar entfernt, beginnt eine Schließverzögerung von einer Sekunde. Bleibt der Bereich währenddessen frei, setzt die Test-EXE die Tor-LVars auf `closed`. Zwischen den jeweiligen Öffnungs- und Schließschwellen bleibt der zuletzt gesetzte Zustand erhalten; dadurch flattert das Tor nicht an einer einzelnen Distanzschwelle.

Wenn vorübergehend keine frische Flugzeug-, Avatar- oder `USER_CURRENT`-Position verfügbar ist, wird kein Schließbefehl gesendet. Dadurch kann die EXE das Tor nicht versehentlich schließen, während MSFS den Wechsel in den Walkaround-Modus verarbeitet. Die EXE sendet keine Daten an das WebSocket-Relay und benötigt keine Pilot-ID oder PIN.

Die Test-EXE selbst läuft immer mit eingeschalteter Automatik. Der globale Schalter in der Workbench steuert die im normalen PC-Tracker integrierte Automatik.

## Bauen

Im Ordner `ga-tracker-client`:

```powershell
npm run test:door-proximity
npm run build:door-proximity-test
```

Die Windows-Datei wird unter `dist/VFR-Multitool-Homebase-Door-Test.exe` erzeugt.

## Voraussetzung für Einzelsteuerung

Der Hangar muss mit der lokalen Variable bereits im Asset kompiliert worden sein. Für zehn platzierte Rundhangars werden weder zehn Modellkopien noch zehn XML-Dateien benötigt: Eine gemeinsame XML mit `L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND` reicht. SimConnect schreibt denselben Variablennamen jeweils an die Object-ID der ausgewählten Instanz.
