# Desktop 1.6.32 – Modul „Vereinsflotte“ (Where I Left It)

Basis: Desktop 1.6.31. Tracker-Runtime unverändert (Alpha v606 kommt getrennt über den Runtime-Kanal).

## Änderungen

- Neues Modul unten „Vereinsflotte“ (standardmäßig aus): teilt den Hangar des MSFS-2024-Mods
  „Where I Left It“ über dessen `backup.txt` mit der Crew. Link zur flightsim.to-Seite und zum Mod-Ordner.
- Autosync: geänderte `backup.txt` (Mod-Export) wird selbst hochgeladen, nur geänderte Maschinen.
  Crew-Änderungen kommen sofort über eine ruhende WebSocket-Verbindung (Ping je Minute), Rückfall-Abfrage
  stündlich bzw. alle 10 min ohne Verbindung. Abgleich beim Start.
- Ohne Autosync: Knöpfe „Backup hochladen“ / „Crew-Stand laden“; beim Start nur ein Blick in die Cloud
  („N Maschine(n) neu in der Crew“), nichts wird geschrieben.
- Reserviert/in der Luft/gelandet bei jemand anderem: nicht hochladen; abweichende lokale Kopie wird auf
  den Stand des Belegenden zurückgesetzt. In der Luft/gelandet bei jemand anderem: im Mod ausgeblendet
  (`hidden`), danach wieder sichtbar am neuen Platz.
- Kopie der `backup.txt` vor jedem Schreiben in `wili-backups` (letzte 5); Protokoll `vereinsflotte-log.txt`.

## Prüfung

- 142 Desktop-Tests (u. a. zwei Piloten über den echten Worker-Code, Konflikt, Ausblenden, Push, manueller Modus).
- Modul im Browser mit Testdaten geprüft.

## Aktivierung

Offen: Release-Artefakt veröffentlichen, öffentlichen Download prüfen, dann `latest.yml`/`alpha.yml`
(gilt für alle Desktop-Nutzer) erst nach Freigabe.
