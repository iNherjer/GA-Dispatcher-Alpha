# Ankunftsszenen: Composer-Platzierung

Stand 17.10.2026, ausgerollt mit Tracker v557 Alpha / Web-Cache v2133. Gilt für Flughafen-
und Bush-Strip-Ankunftsszenen. Der gemeinsame räumliche POI-Vertrag bleibt
eigenständig; neue Missionstypen, Erfolgsbedingungen oder Runtime-Phasen
werden nicht eingeführt.

## Ablauf

1. `mission-arrival-core.js` liest OSM-Parking-Positionen, Vorfelder,
   Parkplatzflächen, Gras-/Wiesenflächen, Flughafenbegrenzung und Gebäude.
   Runways, Taxiways, Straßen, Wasser und Gebäude bleiben Sperrgeometrie.
   Flächen im Flughafenpolygon oder nahe kartierten Hangars sind Kandidaten;
   beliebige Wiesen und Stadtparkplätze außerhalb dieses Bezugs werden nicht
   zu Flughafentreffpunkten erklärt. Bei expliziten Bush-Strip-Rollen sind
   kartierte Flächen am Strip bzw. nahe dessen Gebäuden zusätzlich möglich.
2. Der Kontext enthält echte Innenpunkte der Flächen, Nutzungs-/Oberflächen-Tags,
   Gebäudebezug und örtliche Polygone in Metern. Auch konkave Vorfelder werden
   abgetastet. Fehlende Parking-Nodes bedeuten nicht, dass es keinen Platz gibt.
   Unvollständige Overpass-Antworten mit `remark` werden nicht freigegeben.
   Bei Overpass-Ausfall liest ein begrenzter OSM-Map-API-Fallback dieselbe Gegend;
   er zerlegt deren XML im Browser in die gemeinsam normalisierten Geometrien.
   Session-Cache v2 und Inflight-Join vermeiden wiederholte Downloads. Strip-
   und Standard-APT-Kontexte haben getrennte Cachekennungen.
3. Der bestehende Composer wählt `preferredPlacement.source` und `index`:
   `osm_parking_position`, `osm_apron` oder `osm_surface`. Letzteres benennt
   Einträge der angebotenen `placementCandidates.surface`, einschließlich Gras.
   Er schreibt `headingDeg` und die vollständigen Item-Offsets. Bei Heading 0
   ist `forwardM` Norden und `rightM` Osten. Freie Weltkoordinaten und erfundene
   Flächen werden nicht als Standortauswahl akzeptiert. Rollen und semantische
   Item-Kennungen bleiben aus dem bestehenden Missionsvertrag erhalten.
4. **Nach** Composer-Normalisierung prüft `finalizeAptArrivalComposerPlan` jedes
   Objekt samt Planungsabstand gegen vollständige Sperrgeometrie und den Rand
   der gewählten Fläche. Gleiche Aufstellpunkte und zu lange Empfangswege zum
   Abholfahrzeug werden abgewiesen. Diese Radien sind Planungsannahmen und keine
   vermessenen Modellabmessungen. Fehler gehen innerhalb der vorhandenen höchstens fünf
   Composer-Runden je Modell zur Korrektur zurück. Der erste Kontextabruf ist vollständig;
   spätere Runden dienen bei kartierten Ankunftsplänen der Planung/Korrektur.
5. Der finale Plan enthält Standort, Heading, Flächen-ID, Begründung, Items,
   Prüfgeometrie und `snapStatus.finalLayoutValidated`. Er wird nochmals vor
   Annahme geprüft und in Mission/Contract gespeichert. JSON-Restore behält den
   Plan; Tracker-Befehle verwenden dessen tatsächliche Koordinaten. Auch Live-
   Alternativen werden mit der **finalen** Aufstellung geprüft. Der Tracker
   bevorzugt den vom Composer gewählten Punkt vor anderen freien Alternativen.

Wenn KI/Provider nicht verfügbar sind, bleibt der lokal ermittelte geometrisch
geprüfte Plan als ausdrücklich diagnostizierter Fallback. Gibt es trotz beider
Datenwege keinen belegten geeigneten Standard-APT-Punkt, entfällt nur die
statische Darstellung. Es wird kein pauschaler Flughafenversatz als geprüfte
Fläche ausgegeben. Der bestehende Bush-Runway-Side-Fallback bleibt gesondert.

## Freiburg-Nachweis

Öffentliche Daten vom 17.10.2026:
`tools/fixtures/arrival-edtf-osm-20261017.json`, abgeleitet aus der im Fixture
genannten OSM-Map-Abfrage. Enthalten ist eine räumlich begrenzte Auswahl der
relevanten Features; ganze Geometrien bleiben erhalten. Lizenz/Attribution:
OpenStreetMap contributors, ODbL 1.0, siehe Fixture-Metadaten.

Im Datensatz gibt es keine Parking-Position-Nodes, aber vier Vorfelder und
weitere kartierte Flächen. Die Medien-Aufstellung findet zehn passende Vorfeld-
und 21 zusätzliche Flächenkandidaten. Ein geprüfter Vorfeldanker liegt bei
`48.022729, 7.834948`. Der tatsächliche App-Sanitizer kann alternativ einen
angebotenen Graspunkt nahe einem kartierten Hangar wählen und speichert dann
diesen Punkt, Flächen-ID, Heading und die darauf geprüften Items.

`tools/apt-arrival-composer.test.mjs` prüft reale Geometrie, endgültige Offsets,
Speicherung/Restore, Rollenerhalt, Korrekturrunden und die Live-Präferenz.
`tools/apt-arrival-composer-browser.cjs` prüft im echten Browser DOMParser,
Overpass-Ausfall, Map-Fallback, Cache und die resultierende Aufstellung.
Die Composer-Antworten dieser Regressionstests sind kontrolliert; kein neuer
MSFS-Sichtprüfung wird damit behauptet. Zusätzlich wurde nach Nutzerfreigabe
ein echter Gemini-Lauf ausgeführt: zwei HTTP-200-Antworten, selbst gewähltes
Vorfeld bei 48.022729, 7.834948 und gültige finale Aufstellung. Die Antwort
wurde nach Korrektur eindeutiger Empfangsperson-Kennungen lokal erneut geprüft.

OSM belegt kartierte Nutzung, keine aktuelle Belegung, ebene Befahrbarkeit,
freie Zufahrt oder Deckungsgleichheit mit installierter MSFS-Szenerie. Keine
einzelnen Bäume, Hindernisse oder nutzbare Hallenfassaden aus Namen ableiten.

## Geltungsbereich

Gemeinsam für APT-Ankunft/Abholung/Übergabe sowie Bush-Strip-Pickup,
Handoff und Dropoff, sofern ein aptArrivalPlan vorgesehen ist. Start-Szenen,
SAR-/POI-Zielszenen und Private-Return ohne solchen Plan behalten ihre eigenen
Platzierungsverträge. Das ist keine universelle Umstellung sämtlicher Szenen.

## Bush-Fallback nahe Pistenende

Wenn kein geeigneter kartierter Übergabeplatz gefunden wird, prüft der
Bush-Fallback beide Seiten beider Bahnenden. Der Anker liegt längs 60 m
(bei kurzen Bahnen höchstens 20 % der Bahnlänge) innerhalb des Endes, seitlich
außerhalb der Bahn-/Breitenpuffer. Keine Position auf der verlängerten
Bahnmittellinie. Alle Objektabstände werden gegen bekannte Ausschlüsse geprüft.
Ist ein Ende blockiert, werden die anderen End-/Seitenkombinationen geprüft.

Fehlt eine OSM-Bahn, können explizite, über den bestehenden Airport-Core
normalisierte Bahnmaße und trueHeading aus dem Ziel verwendet werden. Dann
gilt der Flughafenbezugspunkt als geschätzte Bahnmitte; snapStatus nennt
runwayCenterEstimated=true. Das belegt weder freie Fläche noch exakte Schwellen.
Fehlen auch diese Maße, bleibt der vorhandene seitliche Notanker mit
runwayEndResolved=false und explizitem Diagnosegrund erhalten; ein Bahnende
wird nicht erfunden. Diese letzte Rückfallebene ist weiterhin ungeprüft.

Verifikation: 23 Arrival-/Flugbericht-Tests und Ground-Flow-Selbsttest bestanden,
einschließlich beider Enden/Seiten, komplett blockierter Enden und fehlender
OSM-Bahn mit vorhandenen Flugplatzmaßen. Keine neue Simulator-Abnahme.
