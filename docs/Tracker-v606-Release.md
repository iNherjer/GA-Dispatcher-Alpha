# Tracker v606 Alpha / Web v2305 – Vereinsflotte: Maschine im Live-Flug, Start und Abstellen an die Crew-Flotte

## Änderungen

- Neu `tracker-aircraft-identity.js`: liest `TITLE` und `ATC ID` der Maschine (eigene Anfrage 212,
  einmal pro Sekunde geprüft, gesendet nur bei Änderung). Log `AIRCRAFT_IDENTITY`.
- Crew-Status (`tracker-crew-presence.js`):
  - Der geteilte Flug enthält die Maschine (`flight.aircraft` = „Kennzeichen · Titel“, höchstens 40 Zeichen).
  - Vereinsflotte: je Flug ein `takeoff` (mit dem Abstellplatz vor dem Start) und ein `parked` (nach der
    Landung 60 s Stillstand) an `POST /api/crew-fleet-v1/<Crew>/event`. Der Worker ordnet die Maschine der
    Crew-Flotte zu und setzt „In der Luft“ bzw. „Gelandet“. Ist sie von jemand anderem belegt, bleibt dessen
    Stand gültig; die Pinnwand zeigt den Konflikt. Log `CREW_FLEET_EVENT` / `CREW_FLEET_ERROR`.
  - Aus, wenn der Pilot unter „Meine Freigaben“ die Vereinsflotte ausschaltet (`crewShare.fleet`).
- `crew-presence-core.js`: `crewShare.fleet` (Standard an).

## Web (gleicher Push)

- Neu `crew-fleet-client.js` und `wili-fleet-core.js`: Zettel „Vereinsflotte“ auf dem Crew-Brett
  (Status, Reservieren/Freigeben, Karte), Schalter unter „Meine Freigaben“, 🔄 lädt auch die Flotte,
  Flug-Zettel zeigen die Maschine. Die Flotte lädt nur, wenn sich die Revision im Crew-Status-Abruf ändert.

## Worker

- `crew-fleet.mjs` (neues DO `CrewFleet`, Migration `crew-fleet-v1`), `crew-presence.mjs` liefert `fleetRev`.

Siehe `docs/Crew Fleet Where I Left It.md`.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Im Feld prüfen

- Mit einer Maschine der Vereinsflotte starten: Pinnwand zeigt „In der Luft · Name“, nach Landung und
  Abstellen „Gelandet“; nach „Export Backup“ im Mod wieder „Frei“ am neuen Platz.
- Live-Flug-Zettel zeigt „🛩️ Kennzeichen · Titel“.
- Debug-Log: `AIRCRAFT_IDENTITY` stimmt mit dem Schlüssel im Mod überein (Kennzeichen/Titel).
