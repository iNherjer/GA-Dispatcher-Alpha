# Desktop 1.6.37 / Web v2316 – Vereinsflotte: Maschinen löschen, Liste mit vier Zeilen

## Änderungen

- Crew-Brett: Halter löscht eigene Maschinen (🗑, mit Rückfrage); zuletzt bewegte Maschinen oben, vier sichtbar,
  der Rest scrollt.
- Worker: `POST /api/crew-fleet-v1/<Crew>/remove` (nur Halter, nicht während fremder Nutzung), Vermerk 30 Tage,
  Uploads gelöschter Schlüssel abgelehnt.
- Desktop 1.6.37: gelöschte Maschinen nicht mehr hochladen; bei anderen Haltern im Mod ausblenden und
  „· entfernt“ anhängen, Hinweis zum Löschen im Hangar.

Tracker unverändert (der EFB-Hinweis zum Löschen kommt mit dem nächsten Tracker-Build).
