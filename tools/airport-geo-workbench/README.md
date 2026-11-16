# Platz-Workbench

Lokales Werkzeug für den gemeinsamen Flugplatz-Geometrie-Vorrat der Ankunftsszenen
(Worker `/api/airport-geo-v1`, `tools/cloudflare-worker/airport-geo.mjs`).

## Start

Doppelklick auf `Platz-Workbench.command` auf dem Desktop (ruft
`start-airport-geo-workbench.command` im Repo auf) oder:

```bash
./start-airport-geo-workbench.command
```

Öffnet `http://127.0.0.1:8910/`. Beim ersten Start erzeugt das Tool einen Admin-Schlüssel,
setzt ihn per `npx wrangler secret put AIRPORT_GEO_ADMIN_TOKEN` als Worker-Secret und legt ihn
unter `~/.config/ga-dispatcher/airport-geo-admin-token` ab (nur lesbar für dich). Der Browser
sieht den Schlüssel nie; der lokale Server reicht Admin-Aufrufe weiter. Voraussetzungen: Node.js,
Wrangler angemeldet (`npx wrangler whoami`), Internet.

## Funktionen

- **Karte:** Cloud-Plätze farbig (grün mit Flächen, orange fällig, grau Leer-Vermerk, lila nur
  manuelle Plätze); ab Zoom 8 alle Flugplätze der App-Datenbank (`data/airport-search`) als kleine
  graue Punkte, ebenfalls anklickbar. Suche nach ICAO, Name oder Ort.
- **Anzeige:** Vorfelder (blau), Flächen (grün), Parkpositionen (türkis), Hangars (lila),
  Gebäude (grau), Runways (rot), Rollwege (gelb), Platzgrenze (gestrichelt). Der gelbe Kreis zeigt,
  wo die App die Ankunftsszene aufbauen würde (echte Platzwahl aus `mission-arrival-core.js`,
  Rolle wählbar). Kleine Punkte zeigen alle Kandidaten der Platzwahl (Hangar-Vorplatz orange,
  Vorfeld blau, Parkposition türkis, Fläche grün); beim Akzeptieren wählt der Szenenplaner (KI)
  passend zur Geschichte einen davon. Blasse Punkte liegen über der Grenze, die der Planer sieht
  (12 Hangar-Vorplätze, 8 Vorfeld, 8 Parkpositionen). Die Rolle ändert nur die Reihenfolge; gibt
  es Hangar-Vorplätze, ist der Standard immer einer davon.
- **OSM abrufen:** gleicher Abruf wie die App (Overpass-Server, dann OSM-Karte mit 1400/900/600 m),
  ohne Cloud und ohne Sitzungsspeicher. Ergebnis ist zunächst nur eine Vorschau; „in Cloud
  speichern/ersetzen“ schreibt sie (alte Version bleibt als Vorversion).
- **Sperren:** Vorfeld, Fläche, Parkposition oder Hangar anklicken. Gesperrtes fällt für die App
  aus der Platzwahl; ein gesperrter Hangar bleibt Hindernis, gibt aber keinen Vorplatz frei.
- **Platz setzen:** manuelle Abstellplätze per Klick (ziehen = verschieben). Die App behandelt sie
  wie OSM-Parkpositionen, mit denselben Abstandsprüfungen. Funktioniert auch an Plätzen ohne
  Cloud-Eintrag oder mit Leer-Vermerk.
- Sperren und manuelle Plätze gehören zum Flugplatz und überstehen jede OSM-Erneuerung.
- **Löschen**, **Vorversion wiederherstellen**, **Neu laden**.

Tests: `node --test tools/airport-geo-workbench/server.test.mjs`.
