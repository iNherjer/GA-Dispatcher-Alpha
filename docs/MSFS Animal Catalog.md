# MSFS-Tierkatalog für Missionsszenen

Recherche vom 30.09.2026. Wiederverwendbarer Datenkatalog: [msfs-animal-research-catalog.json](../data/msfs-animal-research-catalog.json).

## Ergebnis und Aussagekraft

Die offizielle MSFS-2024-Travelbook-Liste enthält 88 Tier-Einträge mit 780 exakt aufgeführten Container-Titeln. Die allgemeine SimObject-Dokumentation liefert zusätzlich 28 andere Titel in acht Gruppen. Zusammen sind dies 808 eindeutige Titel. Die 88 Einträge umfassen Arten, Unterarten und Rassen; sie sind keine Zahl biologisch unterschiedlicher Arten.

Alle 25 eindeutigen Tier-Titel aus unserem vorhandenen Szenenkatalog sind offiziell belegt. Der archivierte Spawn-Validierungsbericht vom 20.05.2026 enthält keinen dieser Tier-Titel. Der allgemeine Kommentar im Szenenkatalog verweist auf visuelle/manuelle Validierung, enthält jedoch keine einzelnen Tier-Spawn-Ergebnisse. Deshalb ist kein Tier in diesem Recherchekatalog als erfolgreich gespawnt markiert.

Die Liste dokumentiert Modelle im Simulator. Welche davon in einer konkreten Installation über SimConnect verfügbar sind, muss dort enumeriert werden. Ein aufgeführter Titel allein bestätigt weder erfolgreiche Erstellung, sichtbares Modell, Animation, Boden-/Wasserplatzierung noch Entfernen und Wiederherstellen im Tracker. Die Recherchedatei bleibt Herkunftsnachweis; die daraus generierte Laufzeitregistrierung wird unter der unten dokumentierten Verfuegbarkeitsannahme geladen.

## Quellen und technische Nutzung

- [MSFS 2024 Travelbook Lists](https://docs.flightsimulator.com/msfs2024/retail/content-configuration/mission-xml-files/travelbooks/travelbook-lists/): Tiername, exakte Titel, interner Name, GUID und vom SDK genannte World Locations.
- [Allgemeine SimObject-Container](https://docs.flightsimulator.com/msfs2024/retail/content-configuration/modular-simobjects/simobjects/non/): zusätzliche ältere Tier-Titel. Sie werden getrennt bewahrt; keine unbestätigten Aliase zu modernen Modellen erzeugen.
- [SimConnect-Enumeration](https://docs.flightsimulator.com/msfs2024/retail/programming-apis/simconnect/api-reference/events-and-data/simconnect_enumeratesimobjectsandliveries/): liefert tatsächlich spawnfähige SimObjects und gegebenenfalls Liveries der Installation, mit Filter ANIMAL. Für Wassertiere gegebenenfalls zusätzlich BOAT berücksichtigen.
- [Living Things](https://docs.flightsimulator.com/msfs2024/retail/content-configuration/modular-simobjects/simobjects/living-things/): Unterscheidung von Boden- und Flugtieren; Wassertiere wie Wale werden als Boat-SimObjects behandelt. Die hier gefundenen Tierlisten sind daher keine vollständige Inventur sämtlicher mariner Modelle.

Bestehender Tracker-Pfad: `ga-tracker-client/tracker.js` verwendet für solche Nicht-Flugzeugobjekte `aICreateSimulatedObject`; `ga-tracker-client/msfs-asset-validator.js` besitzt bereits einen Einzel-Spawn-Testpfad. Keine Änderungen an Tracker, Tierrollen oder Composer für diese Recherche.

## Felder für spätere Wiederverwendung

`animals` hält die 88 modernen SDK-Einträge; `supplementaryContainerGroups` die älteren Namen. `titles` sind die exakt gefundenen Strings, einschließlich ungewöhnlicher Schreibweisen. GUID identifiziert den SDK-Tiereintrag und ist kein Ersatz für den SimConnect-Container-Titel. Nur aufgeführte Varianten verwenden; Female/Male/Juvenile/Variation nicht eigenständig kombinieren.

`evidence=sdk-listed`, `installationAvailability=not-enumerated` und `spawnTest=not-tested` bleiben getrennte Aussagen. `existingRoleAudit` zeigt die bestehenden App-Rollen und deren offiziellen Match. `sourceId` verweist auf die Primärquelle; `notes` dokumentiert Quellprobleme. `ecologicalRangeVerified=false` verhindert, dass SDK-World-Locations als überprüfte natürliche Verbreitung ausgegeben werden.

Die SDK-Liste enthält Fehler und grobe Regionsangaben: vertauscht wirkende Kamelbezeichnungen, einen Bongo-Namen beim Rappenantilopen-Eintrag und `HAmphibiusFemaleVariation1Variation1`. Diese Angaben werden bewahrt und markiert, nicht still korrigiert. Bei Elch, Wapiti, Grizzly und weiteren Arten sind die Regionsangaben zu breit für automatische regionale Missionsauswahl.

## Für die Biologie-Migration besonders relevant

- Haustiere: Rinder, Hausziegen, Hausschafe und Pferde bieten Modellfamilien für Weide-/Nutzungssituationen. Konkrete Haltung und Habitat müssen zum Auftrag und den Kartenbelegen passen.
- Alpine Studien: Der SDK-Eintrag Alpine Ibex bietet Steinbock-Modelle (`CIbex…`). Nicht mit den nordamerikanischen Mountain Goats (`OAmericanus…`) verwechseln.
- Europäische Wildtiere: eigene Einträge für Wisent, europäischen Braunbären, Wolf und Mufflon. Auch hier reicht „Europe“ nicht als Beleg für ein Vorkommen am ausgewählten POI.
- Die bisherigen `OHemionus…`-Modelle sind Maultierhirsche, keine generischen europäischen Rehe. `CElaphusCanadensis…` ist der SDK-Wapiti-Eintrag, kein Beleg für europäischen Rothirsch. `ALervia…` ist Mähnenspringer, nicht Hausschaf. `BFrontalis…` ist der Gaur-Eintrag, nicht gewöhnliches europäisches Weiderind.
- Gans und Möwe sind in der älteren Containerliste vorhanden. Animation und Eignung für Wasser-/Flugszenen müssen separat geprüft werden; der Name allein bestimmt keine sichere Platzierung.

Keine automatische Regionseignung aus Namen, keine zugesicherte Sichtbarkeit kleiner Tiere aus Missionsarbeitshöhe. Erkennbare Gruppen und größere Tiere sind zuerst visuell zu prüfen. Die Untersuchung von Lebensräumen bleibt auch ohne Tiere ein vollständiger Biologie-Auftrag.

## Vollständige Übersicht der modernen SDK-Einträge

Englische Tierbezeichnungen bleiben zur Quellenzuordnung erhalten. Die exakten vollständigen Varianten stehen im JSON; unten jeweils Anzahl und erster Titel. Die Tabelle ist keine Freigabe für regionale Verwendung oder Laufzeit-Spawns.

| SDK-Tiereintrag | Varianten | Erster exakter Titel |
| --- | ---: | --- |
| Aardvark | 9 | `OAferFemale` |
| Giant Anteater | 9 | `MTridactylaFemale` |
| Giant Sable (Sable Antelope) | 9 | `HNigerFemale` |
| Grizzly (Brown) Bear | 9 | `UArctosHorribilisFemale` |
| Himalayan Brown Bear | 9 | `UArctosIsabellinusFemale` |
| Asian Black Bear | 9 | `UThibetanusFemale` |
| Sun Bear | 9 | `HMalayanusFemale` |
| American Black Bear | 9 | `UAmericanusFemale` |
| Polar Bear | 9 | `UMaritimusFemale` |
| Western European Brown Bear | 8 | `UArctosArctosFemale` |
| Japanese Black Bear | 9 | `UArctosLasiotusFemale` |
| American Bison | 9 | `BBisonFemale` |
| European Bison | 9 | `BBonasusFemale` |
| Forest Buffalo | 9 | `SCafferNanusFemale` |
| Water Buffalo | 9 | `BBBubalisFemale` |
| Asian Wild Buffalo | 9 | `BBubalisFemale` |
| Cape Buffalo | 9 | `SCafferFemale` |
| Arabian Camel | 9 | `CBactrianusFemale` |
| Asiatic Camel | 9 | `CDromedariusFemale` |
| Capybara | 9 | `HHydrochaerisFemale` |
| Sahara Cheetah | 9 | `AJubatusSoemmeringiiFemale` |
| Cheetah | 9 | `AJubatusJubatusFemale` |
| North West African Cheetah | 9 | `AJubatusHeckiFemale` |
| Western Chimpanzee | 9 | `PTroglodytesVerusFemale` |
| Bonobo | 9 | `PPaniscusFemale` |
| Guernsey Cow | 3 | `GuernseyFemale_Cow` |
| Jersey Cow | 7 | `BTaurusPrimigeniusFemale` |
| Gaur | 9 | `BFrontalisFemale` |
| Brahma Cow | 6 | `BTaurusIndicusFemale` |
| Yak | 6 | `BGrunniensFemale` |
| Bali Cattle | 6 | `BJavanicusFemale` |
| Saltwater Crocodile | 9 | `CPorosusFemale` |
| Mugger crocodile | 9 | `CPalustrisFemale` |
| West African crocodile | 9 | `CSuchusFemale` |
| Caribou (Reindeer) | 9 | `RTarandusGroenlandicusFemale` |
| Black-Tailed Deer (mule deer) | 9 | `OHemionusFemale` |
| African Bush Elephant | 9 | `LAfricanaFemale` |
| African Forest Elephant | 9 | `LCyclotisFemale` |
| Asian Elephant | 9 | `EMaximusFemale` |
| Roosevelt Elk | 9 | `CElaphusCanadensisFemale` |
| Pribilof Island Fox | 9 | `VLagopusPribilofensisFemale` |
| Iceland Arctic Fox | 9 | `VLagopusFuliginosusFemale` |
| Arctic Fox | 6 | `VLagopusJuvenile` |
| Thomsons Gazelle | 9 | `EThomsoniiFemale` |
| Angolan Giraffe | 9 | `GAngolanFemale` |
| Kordofan Giraffe | 9 | `GAntiquorumFemale` |
| Nubian Giraffe | 9 | `GCamelopardalisFemale` |
| South African Giraffe | 9 | `GGiraffaFemale` |
| West African Giraffe | 9 | `GPeraltaFemale` |
| Reticulated Giraffe | 9 | `GReticulataFemale` |
| Masai Giraffe | 9 | `GTippelskirchiFemale` |
| Mountain Goats | 9 | `OAmericanusFemale` |
| Domestic Goats | 9 | `CHircusHircusFemale` |
| Hippopotamus | 9 | `HAmphibiusFemale` |
| Przewalski’s Horse | 9 | `EPrzewalskiiFemale` |
| Mustang | 15 | `ECaballusFemale` |
| Spotted hyena | 9 | `CCrocutaFemale` |
| Alpine Ibex | 9 | `CIbexFemale` |
| Red Kangaroo | 9 | `MRufusFemale` |
| Snow leopard | 9 | `PUnciaFemale` |
| South African Lion | 9 | `PLeoMelanochaitaFemale` |
| Atlas Lion | 9 | `PLeoLeoFemale` |
| Argentine Vicuna | 9 | `VicunaFemale_Llama` |
| Guanico Llama | 9 | `LGlamaFemale` |
| Proboscis Monkey | 9 | `NLarvatusFemale` |
| Alaskan Moose | 9 | `AAlcesFemale` |
| American Moose | 9 | `AAmericanusFemale` |
| Ostrich | 9 | `SCamelusFemale` |
| Giant Panda | 9 | `AMelanoleucaFemale` |
| Southern White Rhinoceros | 9 | `CSimumFemale` |
| Bighorn Sheep | 9 | `OCanadensisNelsoniFemale` |
| Dall Sheep | 9 | `ODalliDalliFemale` |
| Domestic Sheep (Columbian) | 12 | `OAriesAriesFemale` |
| Barbay Sheep | 9 | `ALerviaFemale` |
| European Mouflon | 9 | `OAriesMusimonFemale` |
| Bengal Tiger | 9 | `PTigrisTigrisFemale` |
| Siberian tiger | 9 | `PTigrisAltaicaFemale` |
| Javan Tiger | 9 | `PTigrisSondaicaFemale` |
| Desert Warthog | 9 | `PAethiopicusFemale` |
| African Warthog | 9 | `PAfricanusFemale` |
| Gnu Blue | 9 | `CTaurinusMearnsiFemale` |
| Black Wildebeest | 9 | `CTaurinusGnouFemale` |
| Eastern White Bearded Wildebeest | 9 | `CTaurinusAlbojubatusFemale` |
| Arctic Wolf | 9 | `CLupusArctosFemale` |
| Gray Wolf | 9 | `CLupusLupusFemale` |
| Grevy’s Zebra | 9 | `EGrevyiFemale` |
| Plains Zebra | 9 | `EQuaggaFemale` |
| Hartman’s Mountain Zebra | 9 | `EHartmannaeFemale` |

## Zusätzliche ältere Container-Titel

- Legacy bears: `BlackBear`, `GrizzlyBear`, `PolarBear`, `SyrianBear`.
- Legacy elephants: `AfricanElephant`, `AfricanElephant_Child`, `AsianElephant`, `AsianElephant_Child`, `BorneoElephant`, `BorneoElephant_Child`, `SriLankanElephant`, `SriLankanElephant_Child`, `SriLankanElephant_Child_Albino`, `SumatranElephant`, `SumatranElephant_Child`, `SumatranElephant_Child_Albino`.
- Legacy flamingo: `Flamingo`.
- Legacy giraffes: `AfricanGiraffe`, `AngolanGiraffe`, `MasaiGiraffe`, `ReticulatedGiraffe`.
- Goose: `Goose`.
- Legacy hippo: `Hippo`.
- Legacy rhinos: `RhinoBlack`, `RhinoBlackWestern`, `RhinoWhite`, `RhinoWhiteNorthern`.
- Seagull: `Seagull`.

## Vorgehen beim tatsächlichen Spawn-Test

1. In einer laufenden MSFS-2024-Installation spawnfähige Titel und Liveries enumerieren. Quelle, Simulatorversion und Datum mitführen. Wassertiere zusätzlich über BOAT abgleichen.
2. Für jeden gewünschten exakten Titel einen Einzeltest über den bestehenden Validator durchführen: zugewiesene Object-ID/Fehler dokumentieren.
3. Sichtbarkeit, Oberflächenlage, Animation und Größenwirkung visuell prüfen. Erfolgreicher API-Aufruf oder Object-ID allein bestätigt kein brauchbares Modell.
4. Entfernen, erneutes Erstellen und Tracker-Lifecycle prüfen. Ergebnisse pro Titel speichern; Fehler nicht als universelle Nichtverfügbarkeit einer Tierart interpretieren.
5. Erst danach eine gezielte Tierrolle/Modellauswahl und regionale Eignung für Missionen freigeben. Der breite bisherige Pool wird durch diese Recherche nicht verändert.


## Tiergruppen: Freigabe vom 30.09.2026

Die Standardtiere des Simulators gelten auf ausdrückliche Nutzerfreigabe als verfügbar. Das ist eine Arbeitsannahme, kein erfolgreicher Spawn-Test. Die bisherigen Recherche-/Prüfstatus bleiben als Herkunftsnachweis erhalten; ein späterer Test im laufenden Simulator prüft die tatsächliche Verfügbarkeit.

`data/mission-animal-scene-assets.js` registriert 116 getrennte Modellfamilien mit insgesamt 808 eindeutigen SDK-Titeln. Generierung: `node tools/generate-animal-scene-assets.mjs` aus `data/msfs-animal-research-catalog.json`. Jede Familie hat ein eigenes Feature und eine eigene Rolle; keine zufällige Vermischung verschiedener Arten. SDK-Namensauffälligkeiten stehen in `sourceNotes`. Der Katalog wird nach dem Basis-Assetkatalog geladen.

Writer und Composer dürfen passende Tiere und größere Herden einsetzen. Biologie-Ideen übergeben die gewünschte Art, Anzahl und den Beobachtungszweck in `sceneIntent.animalGroups`. Fiktive Bestände gehören zur Spielhandlung; Habitat und regionale Plausibilität müssen zur Mission passen. Eine Mission ohne Tiere bleibt möglich. Die Szene entsteht weiterhin nach dem Writer über den bestehenden Composer.

Tiergruppen erlauben bis 20 Tiere pro Gruppe und bis 40 Objekte insgesamt. Nichttiergruppen behalten höchstens sechs Objekte pro Gruppe und das bisherige Dichtebudget. Größere Tiergruppen erhalten eine zentrierte Gruppenanordnung; Flächen-, Gebäude-, Abstands- und Kollisionsprüfungen bleiben wirksam. Alle katalogisierten Tiere werden zunächst als bodengebundene Objekte behandelt; Flug-, Schwimm- oder Herdenverhalten wird dadurch nicht zugesichert.

Prüfung: `node --test tools/mission-animal-scene-assets.test.mjs` prüft Katalogübernahme, eine Herde mit 20 Schafen bis zur tatsächlichen Objektliste, Artentrennung, räumliche Ablehnung und Erhalt der Gruppenangaben im App-Sanitizer. Biologie bleibt bis zur gesonderten Freigabe im dokumentierten Testpfad (`ga_bio_briefing_v1`). Keine neuen Tracker- oder Voice-Auslöser.
