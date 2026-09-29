# Umgebungsbelege für zwei POI-Testgebiete

Stand 29.09.2026. Aus tatsächlichen öffentlichen OSM-Kartenauszügen ermittelt. Keine Interpretation von Namen. Die folgenden Formulierungen sind redaktionelle Beispiele aus berechneten Kartenbeziehungen, kein neuer Gemini-Lauf. Höhenwerte stammen aus dem Nutzerbericht.

## Sommerbergtunnel

Zur Orientierung dienen Hausach und die Kinzig südlich des gespeicherten Zielpunkts. An der Oberfläche dieses Punkts ist eine Wiesenfläche kartiert. Wohnbebauung liegt etwa 150 m südwestlich, Wald etwa 200 m westlich; eine Wasserfläche befindet sich rund 400 m südlich. Diese Aussagen betreffen den Zielpunkt und seine Umgebung, nicht sämtliche Tunnelportale.

- [Wiesenfläche, OSM-Relation 21440108](https://www.openstreetmap.org/relation/21440108)
- [Wohnbebauung, OSM-Way 846487756](https://www.openstreetmap.org/way/846487756)
- [Wald, OSM-Way 171537067](https://www.openstreetmap.org/way/171537067)
- [Wasserfläche, OSM-Way 880709019](https://www.openstreetmap.org/way/880709019)

Die [DAUB-Projektdokumentation](https://www.daub-ita.de/projektdatenbank/deutschland/sommerberg-tunnel-hausach-b33/) bestätigt den Tunnel als Kernstück der Ortsumfahrung und beschreibt in Abschnitt 3.1 die damalige Zufahrt zum Ostportal über die B 294/östliche Kinzigbrücke. Diese manuell recherchierte Quelle ist kein ortsspezifischer Produktionscode. Eine behauptete südliche Hanglage wurde nicht daraus abgeleitet.

## Denkmal bei Pfalzgrafenweiler

Der Zielpunkt liegt etwa einen Kilometer nordwestlich des kartierten Ortsbezugs Pfalzgrafenweiler. Südöstlich liegen eine Ackerfläche in rund 150 m Entfernung, ein Industriegebiet in rund 250 m und Wohnbebauung in rund 300 m Entfernung. Eine Wiesenfläche liegt etwa 500 m südöstlich. Die ausgewerteten Geometrien belegen keine pauschale Bewaldung des Denkmalstandorts.

- [Ackerfläche, OSM-Way 98362686](https://www.openstreetmap.org/way/98362686)
- [Industriegebiet, OSM-Way 209434484](https://www.openstreetmap.org/way/209434484)
- [Wohnbebauung, OSM-Way 23727501](https://www.openstreetmap.org/way/23727501)
- [Wiesenfläche, OSM-Way 137452359](https://www.openstreetmap.org/way/137452359)

## Technische Prüfung und Grenzen

Die reduzierten Originalgeometrien sind als Testfixture gespeichert. Tag und Geometrie bestimmen die Aussage; Umbenennen aller Objekte verändert sie nicht. Entfernungen beziehen sich auf die nächste Flächengrenze, nicht auf einen Schwerpunkt. Vollständige geschlossene Multipolygonringe mit Aussparungen werden geprüft; fragmentierte oder unvollständige Ringe werden ausgelassen. Keine Aussage über flächendeckende Vollständigkeit.

Overpass antwortete im Netztest mit HTTP 406. Direkte OSM-Kartenauszüge waren zunächst verfügbar; die spätere integrierte Probe erhielt HTTP 429. Deshalb ist dies ein erfolgreicher Geometrie-/Belegtest, aber kein erfolgreicher durchgängiger Live-Netztest. Die App begrenzt die Abfrage auf die ausgewählte Mission, speichert kompakte Fakten bis zu zwölf Stunden (maximal 32 Ziele) und pausiert betroffene Anbieter bei Fehlern. Die direkte Ersatzabfrage umfasst einen kleineren Ausschnitt als die primäre 1-NM-Abfrage.

Kartendaten: © OpenStreetMap-Mitwirkende, [ODbL](https://www.openstreetmap.org/copyright).
