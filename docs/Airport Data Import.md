# Flugplatzdaten: weltweite OurAirports-Ergänzung

Stand: 2026-10-19. Implementiert auf Basis von Git `c1dfcd075`.

## Datenfluss

1. `data/airport-sources/openaip-merged-2026-07-28.json.gz` enthält die unveränderte,
   zuvor ausgelieferte `airports.json` mit 59.927 Einträgen. Herkunft, Lizenz,
   Bytezahl und SHA-256 stehen in `openaip-base.json`. Das Legacy-Backup bleibt
   unverändert. Der ursprüngliche OpenAIP-Zyklus liefert upstream inzwischen 404;
   deshalb ist dieser geprüfte lokale Snapshot die reproduzierbare Standardbasis.
2. `ourairports-2026-10-16.csv.gz` ist die unveränderte offizielle OurAirports-CSV
   vom in `ourairports.json` festgeschriebenen Git-Commit. Der Import prüft die
   entpackten Bytes gegen die hinterlegte SHA-256. OurAirports veröffentlicht die
   Daten als Public Domain: https://ourairports.com/data/ . Die vorhandenen
   OpenAIP-Daten behalten ihre eigene Lizenz; der Gesamtbestand wird dadurch
   nicht Public Domain.
3. `tools/build-airports-database.mjs` ergänzt die Basis weltweit und schreibt
   `airports.json`, `data/airports-database-meta.json` sowie
   `data/airports-import-report.json`.
4. `tools/build-airport-search-packs.mjs` erzeugt daraus zusammen mit der
   unveränderten FAA-Ergänzung die versionierten Suchpakete. Die FAA-Ergänzung
   wird weiterhin auch von der App geladen. Für sie bereits vorhandene neue
   Lokalkennungen behalten beim Import ihren Schlüssel.

Die Suche braucht weder einen laufenden Tracker noch eine Live-Verbindung zu
OurAirports. Die vorhandenen Such-, Filter- und Dispatch-Wege werden verwendet.
Die alten Suchpakete bleiben verfügbar, damit ältere App-Versionen weiterarbeiten.

## Umfang und Zuordnungsregeln

Importiert werden `small_airport`, `medium_airport`, `large_airport` und
`seaplane_base` aus allen Ländern. Geschlossene Plätze, reine Heliports und
Ballonplätze werden aus dieser Ergänzung ausgeschlossen. Bereits vorhandene
Heliports, Segelflug-, UL- und Sonderplätze bleiben unverändert.

- Kennungen werden zunächst gegen den Bestand im gleichen Land abgeglichen.
  Es muss genau einen Kandidaten geben; mehr als 5 km Positionsabweichung wird
  als Konflikt zurückgestellt. IATA allein ist kein Zuordnungsanker.
- Ohne Kennungstreffer ist ein eindeutiger normalisierter Name innerhalb von
  1 km zulässig. Der Namensvergleich entfernt Akzente, Satzzeichen und die
  generischen Wörter Airport/Airfield/Airstrip/Aerodrome. Weitere namensgleiche
  Kandidaten innerhalb von 2 km oder unterschiedliche ICAO-Codes verhindern die
  automatische Zuordnung.
- Anders benannte Bestandsplätze innerhalb von 250 m werden zur Prüfung
  zurückgestellt. Diese konservativen Grenzen garantieren keine perfekte
  Dublettenerkennung; verbleibende Fälle werden nicht pauschal bereinigt.
- Neue Plätze erhalten eine belegte ICAO-Kennung als Schlüssel, ansonsten eine
  stabile interne `OUR-<OurAirports-ID>`. `icao` ist im bestehenden App-Schema
  der interne Schlüssel; nur `icaoCode` enthält einen übernommenen offiziellen
  ICAO-Code. GPS-/Lokalkennungen und OurAirports-Identifikatoren werden getrennt
  als Such-Aliase beziehungsweise `altIdentifier` übernommen. Ein GPS-Code wird
  nicht als offizieller ICAO-Code ausgegeben.
- Neue Aliase müssen über Bestand und Import hinweg global eindeutig sein.
  Mehrdeutige lokale Codes werden protokolliert, nicht als neue globale Aliase
  vergeben. Vorhandene Kennungen werden nicht entfernt oder neu zugeordnet.
- Namen, Position, Höhe, Klassifikation und PPR-/Privat-Flags bestehender Plätze
  werden nicht überschrieben. Höhenunterschiede über 200 ft stehen im Bericht.
  OurAirports-Höhen sind bereits in Fuß; leere Angaben bleiben `null`.

## Ergebnis des festgeschriebenen Imports

- 49.373 berücksichtigte Quellzeilen, davon 23.611 zugeordnet.
- 14.196 zusätzliche Datenbankeinträge; Gesamtbestand 74.123.
- 24.591 ergänzte Such-Aliase.
- 11.566 zurückgestellte Zuordnungen, darunter viele bereits vorhandene
  Mehrfacheinträge. Diese Zahl bedeutet nicht 11.566 fehlende Plätze.
- 432 protokollierte Höhenabweichungen; keine automatische Höhenkorrektur.
- Für Afrika: 1.380 zusätzliche Einträge. Botswana +56, Kenia +195,
  Tansania +118, Mosambik +64. Die Länderbilanz steht im JSON-Bericht.
- 79.363 Suchdatensätze einschließlich FAA-Ergänzung, verteilt auf 192 Bundles
  plus Lookup. Suchdatensätze und reale Plätze sind wegen bestehender
  Alias-Einträge nicht gleichzusetzen.

Die Zahlen beziehen sich auf den offiziellen Snapshot. Der frühere grobe
Afrika-Vergleich verwendete einen separaten OurAirports-Ableger und einen anderen
räumlichen Vergleich; seine Prozentwerte sind damit nicht direkt vergleichbar.

## Neubau und Prüfung

```sh
node tools/build-airports-database.mjs
node tools/build-airport-search-packs.mjs
node tools/ourairports-import.test.mjs
node tools/airports-database-selftest.mjs
node tools/airport-search-packs-selftest.mjs
node tools/airport-search-data-selftest.mjs
node tools/airport-type-filter-selftest.mjs
```

Der Standardneubau benötigt kein Netzwerk. Ein neuer OurAirports-Stand wird
bewusst mit festem Commit heruntergeladen; Snapshot, Metadaten und Prüfsumme
werden gemeinsam aktualisiert. Danach Länderbilanz und Konflikte prüfen und
Datenbank-/Suchpaketversionen in `app.js` sowie die zugehörigen Tests anpassen.
Die komprimierte CSV lässt sich ohne Zeitstempel reproduzieren (`gzip` mit
`mtime=0` und leerem eingebettetem Dateinamen).

Mit explizitem `--source-base=https://inherjer.github.io/GA-Dispatcher-Aviation-Data/`
kann der Builder stattdessen den dort aktuellen OpenAIP-Stand verarbeiten.
Das ist ein eigener Datenstandwechsel und braucht eine erneute Abnahme des
Abgleichs; es ist nicht der Standard dieses Imports. Geänderte Quellen brauchen
immer eine neue Suchpaketversion. Vor Veröffentlichung gelten die normalen
Push-Regeln einschließlich Service-Worker-Cache-Version.

## Zurückgestelltes Tracker-Konzept

Ein persönlicher Simulator-/Add-on-Abgleich mit optionaler Speicherung im
User-KV ist nicht Teil dieser Umsetzung. Die Planung muss ohne laufenden Tracker
funktionieren; Cloud-Nutzungsrechte für aus dem Simulator gewonnene Daten sind
nicht geklärt. Simulator-spezifische Aliase wie `FBNO` werden hier nicht erfunden
oder aus Simulator-Daten importiert. Pom Pom bleibt vorhanden; die bekannte
abweichende Höhe wird zur Prüfung protokolliert.
