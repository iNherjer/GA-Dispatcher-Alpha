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

Gespeicherte Missionen von vor v557 können noch den rohen Flughafenversatz
(`airport-representative-offset`, ohne `snapStatus`) tragen; dieser liegt je nach
Bezugspunkt auf der Bahn. Vor der Tracker-Übergabe löst die App einen solchen
Plan einmal nachträglich über `resolveAptArrivalPlanPlacement` auf und speichert
ihn. App und Tracker spawnen einen ungeprüften Flughafenversatz nie; der
Bush-Strip-Seitenversatz (`remote_strip_side_offset`) ist davon ausgenommen.

## Freigegebene Flächen: Vorfeld und Hangar-Vorzone (21.10.2026)

Kartierte Abstellflächen werden nicht durch pauschale Puffer beschnitten:

- **Hangar-Vorzone:** bahnseitig vor jedem Hangar im Flughafengelände, bis
  40 m vor der Wand. Das Tor ist in OSM nicht kartiert; die zur Bahn zeigende
  Seite gilt als Vorderseite, die Landseite zur öffentlichen Straße bleibt
  ausgeschlossen. Die Zone ist frei, auch wenn Rollweg, Servicewege oder Gras
  darüber kartiert sind (auf kleinen Plätzen reichen Rollwege oft bis ans Tor).
- **Vorfeld:** frei bis 4 m zur Rollweg-Mitte; über das Vorfeld kartierte Wege
  sperren nicht.
- **Immer gesperrt:** Bahnfläche plus 3 m (halbe kartierte Breite, ohne Angabe
  10 m) und Gebäude.
- **Vorrang:** `osm_hangar_front` vor Parkposition, Vorfeld und Flächen. Innerhalb
  der Hangar-Zonen etwa 10 m vor der Wand, nahe dem Vorfeld, nicht an der Bahn,
  passend zum Missionskontext (Rettungsstationen nur für medizinische Übergaben).
  Je Hangar bis zu sechs Plätze mit mindestens 12 m Abstand, insgesamt bis 24.
- **General Aviation:** Terminals, Gebäude, Vorfelder oder Parkpositionen mit
  General Aviation, GAT, Allgemeine Luftfahrt, Business Aviation, FBO oder
  Kennung `GA…` sind GA-Anker. Gibt es sie, zählt bei Hangar-Plätzen die Nähe
  dazu (bis 400 m), Vorfeld- und Parkpositionskandidaten messen ihren Abstand
  zum GA-Anker statt zum Flughafenbezugspunkt. Ohne GA-Anker unverändert.
  EDDS: GAT plus Vorfelder GA2/GA3, Abholung am GA-Vorfeld.
- **Bewertung je Hangar-Platz:** nächster Hangar entscheidet über Betreiber und
  Name; Nähe zu Rollweg und Vorfeld (Erreichbarkeit) zählt; Rettungsstationen
  werden außer bei medizinischen Übergaben stark abgewertet.

Außerhalb freigegebener Flächen gelten die bisherigen Sperrpuffer. Der
Bahnpuffer folgt dort der kartierten Breite (halbe Breite plus 20 m), ohne
Angabe 45 m. Zonen behalten Name, Betreiber und Zugangs-Tags für Bewertung und
Composer. Große Plätze: ein räumliches Raster begrenzt die Prüfung auf nahe
Zonen (EDDS mit rund 3.800 Sperrzonen unter 1 s,
`tools/fixtures/arrival-edds-osm-20261021.json`). Nachweis mit echten OSM-Daten: `tools/fixtures/arrival-edtw-osm-20261021.json`
und `tools/fixtures/arrival-edtq-osm-20261021.json`, geprüft in
`tools/apt-arrival-hangar-front.test.mjs` (dort darf es nie zu einem Fallback
kommen). Vorher wählte EDTW eine Grasfläche 60 m neben der Bahn, EDTQ fand
keinen Platz.

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

Seit 21.10.2026 sucht der Fallback entlang beider Seiten (alle 20 m ab dem
Ende bis zur Bahnmitte, seitlich ab dem Pufferrand in 5-m-Schritten) statt nur
vier feste Punkte zu prüfen; Bäche, Feldwege oder Servicewege blockieren sonst
alle Enden (Big Creek, Idaho). Bewertung: möglichst direkt am Rand der
Bahn-Sperrzone, nahe einer Hütte oder Station (bis 400 m berücksichtigt), dann
nahe dem Bahnende; ohne Gebäude entscheidet wie bisher die Nähe zum geplanten
Punkt. Echte OSM-Nachweise: `tools/fixtures/arrival-bigcreek-osm-20261021.json`
(Ostseite am Südende neben der Hütte) und `tools/fixtures/arrival-soldierbar-osm-20261021.json`
(unverändert am Pistenende), geprüft in `tools/apt-arrival-hangar-front.test.mjs`.
Kartierte Hangars oder Vorfelder an einem Strip haben weiterhin Vorrang.

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
