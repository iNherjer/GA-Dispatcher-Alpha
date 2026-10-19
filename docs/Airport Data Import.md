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

## Gemeinsamer Missionspool und PLN-Export (19.10.2026)

`collectMissionAirportPool()` führt den Gesamtkatalog und gehostete OpenAIP-
Treffer für `findGithubAirport()`, `findBushAirport()` und
`collectMissionProposalAirportCandidates()` zusammen. Die FAA-Ergänzung wird
abgewartet. Das Vorhandensein gehosteter Kandidaten verhindert nicht mehr die
Teilnahme lokaler Ergänzungen. Filter und die vorhandenen Bush-/Vorschlags-
Gewichtungen bleiben bestehen. OurAirports liefert gröbere Typen als OpenAIP;
etwa `small_airport` fällt in GA, nicht automatisch in den OpenAIP-Typ Strip.
Fehlende Pistendaten sind keine Bestätigung der Flugzeugeignung.

Die Zusammenführung bevorzugt die stabilen Schlüssel und Daten des lokalen
Katalogs. Gleiche Quell-IDs oder gemeinsame Kennungen innerhalb einer NM im
gleichen Land werden nur einmal aufgenommen; die zusätzlichen Kennungen bleiben
als Aliase am Kandidaten erhalten, auch für den Startplatzausschluss. Es gibt
keinen allgemeinen räumlichen Merge unterschiedlich benannter Nachbarplätze.
Bei Ausfall einer Quelle arbeitet die andere weiter.

Der Datei-Export in `board.js` löst interne IDs über vorhandene ICAO-, GPS- oder
Lokalkennungen auf. Ein explizites `msfsIdent` hätte Vorrang. Das gilt für Start,
Ziel und Zwischenlandeplätze und funktioniert an Endpunkten auch mit gespeicherten
Missions-Metadaten ohne geladenen Gesamtkatalog. Interne IDs, Namen, IATA und
beliebige Such-Aliase werden nicht zu Simulator-Kennungen umgedeutet. Ohne
passende Kennung bleibt ein User-Wegpunkt mit Koordinaten erhalten. Interne
Missions-IDs und SAR-Heli-Sonderziele werden nicht verändert.

Dies betrifft den `.pln`-Dateiexport. Der separate native EFB-/Tracker-
Flugplantransfer ist hier nicht verändert oder als verbessert abgenommen.
Eine GPS-/Lokalkennung garantiert nicht, dass derselbe Platz in jeder Simulator-
Installation vorhanden ist. Für Pom Pom fehlt weiterhin die separate
Simulator-Kennung `FBNO`; sie wird durch diese Auflösung nicht erfunden.

Prüfung:

```sh
node tools/mission-airport-pool-selftest.mjs
node tools/msfs-pln-export-selftest.mjs
node --test tools/mission-airport-pool-browser.test.cjs
```

Die Tests prüfen echte App-Funktionen einschließlich Online-Kandidaten neben
lokalen Ergänzungen, Typ-/Entfernungs-/Richtungs-/Startfilter, Dubletten,
Quellenausfälle, FAA-Ladefolge und den tatsächlichen Botswana-Katalog. Der
Browsertest lädt die vollständige App und prüft zusätzliche Vorschlagskandidaten
sowie den echten Downloadpfad mit `FBHU`, ohne die interne Hunda-ID zu ändern.
Der XML-Test deckt A-B, POI-Rückkehr, Zwischenlandung, gespeicherte Metadaten,
unbekannte Kennungen und SAR-Heli ab. Kein Live-KI- oder Simulatornachweis.

Der ältere `mission-pipeline-dryrun.mjs` scheitert bereits im unveränderten
Ausgangsstand am fehlenden Draft-Modul (`missionDraftSession`, `create`). Der
bestehende Bush-Writer-Browsertest scheitert mit derselben `false !== true`-
Assertion an Zeile 107 auch gegen den unveränderten Ausgangsstand. Beide
Altfehler wurden abgegrenzt; sie werden durch diese Änderung nicht behoben.
