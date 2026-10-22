# Mission Scene Asset Strategy

This is the working approach for dynamic MSFS mission scenes.

## Core Rule

The AI may design a scene, but it must not invent SimObject titles.

AI output should describe scene intent using controlled roles:

- `sceneType`
- `layout`
- `severity`
- `truth`
- object roles/counts/states
- passenger findings that remain hidden until the mission reaches the target

The app maps roles to a curated asset catalog and known-good title candidates.

## Example

```json
{
  "sceneType": "road_accident",
  "layout": "two_vehicle_angle",
  "severity": "medium",
  "objects": [
    { "role": "vehicle.car", "count": 2, "state": "stopped" },
    { "role": "debris.small", "count": 4 },
    { "role": "vfx.smoke", "count": 1, "intensity": "small" },
    { "role": "person.bystander", "count": 5 }
  ],
  "paxFindings": [
    "zwei Fahrzeuge stehen schraeg zueinander",
    "leichte Rauchentwicklung",
    "mehrere Personen am Rand der Stelle"
  ]
}
```

## Asset Discovery

Asset discovery has three layers:

1. Scanner high confidence: readable `SimObjects/**/sim.cfg` or `aircraft.cfg` with exact `title`.
2. Scanner fallback: `layout.json` references to `SimObjects/.../sim.cfg`; title is inferred from folder name and must be test-spawned.
3. Curated catalog: assets confirmed manually through DevMode SimObject Spawner or tracker test.

MSFS 2024 standard content may be streamed or hidden behind the VFS. If the file scan is sparse, use DevMode -> Tools -> Virtual File System -> VFS Projector, then scan the `VFSProjection` folder.

## Confirmed/Working Starter Assets

- `Chimney_Smoke_V1`
- `VO_Fire_R1_40`
- `Car Bush Firefighting`
- Tarmac person pool (all 24 titles; see below)
- `Drop_Container`
- `Cardboard`
- `Pallet01_01`
- `Pallet01_02`
- `Pallet01_03`
- `Rice_Bag_50`
- `LifeRaft`
- `Microsoft_Car_EUR_01`
- `Microsoft_Car_EUR_02`
- `Microsoft_Car_EUR_03`
- `Microsoft_Car_EUR_04`
- `Microsoft_Minicar_01`
- `Microsoft_Quad`
- `Microsoft_Van_EUR`
- `Log`

### Confirmed Tarmac Person Pool

All 24 titles are confirmed through the Homebase moving-person flow:

- `Tarmac_Female_Summer_African`
- `Tarmac_Female_Summer_Arab`
- `Tarmac_Female_Summer_Asian`
- `Tarmac_Female_Summer_Caucasian`
- `Tarmac_Female_Summer_Hispanic`
- `Tarmac_Female_Summer_Indian`
- `Tarmac_Female_Winter_African`
- `Tarmac_Female_Winter_Arab`
- `Tarmac_Female_Winter_Asian`
- `Tarmac_Female_Winter_Caucasian`
- `Tarmac_Female_Winter_Hispanic`
- `Tarmac_Female_Winter_Indian`
- `Tarmac_Male_Summer_African`
- `Tarmac_Male_Summer_Arab`
- `Tarmac_Male_Summer_Asian`
- `Tarmac_Male_Summer_Caucasian`
- `Tarmac_Male_Summer_Hispanic`
- `Tarmac_Male_Summer_Indian`
- `Tarmac_Male_Winter_African`
- `Tarmac_Male_Winter_Arab`
- `Tarmac_Male_Winter_Asian`
- `Tarmac_Male_Winter_Caucasian`
- `Tarmac_Male_Winter_Hispanic`
- `Tarmac_Male_Winter_Indian`

Homebase confirmation proves that these exact SimObject titles can be spawned and moved. Mission boarding still has a separate command/ACK and spawn/remove lifecycle and must be diagnosed independently if a person reappears after boarding.

## Bush Strip Pickup Placement and Lifecycle

- A pickup scene is prestaged only when the aircraft approaches the target
  strip. An empty outbound leg has no decorative departure crew or vehicle.
- If OSM has no parking position or apron but contains runway geometry, derive
  the scene heading from the runway axis, place the anchor beyond the runway
  buffer, and validate the anchor plus every item against runway, taxiway,
  building, and water zones.
- Route bearing is not a valid substitute for runway heading.
- Pickup confirmation terminally retires the target scene. A subsequent GPS or
  reconnect tick must not spawn the removed passenger, vehicle, or equipment.

## Tagged Homebase pack assets in mission scenes

`homebase/assets/catalog.json` is the source for pack eligibility: only entries with `missionSpawnable: true` and `missionRoles` containing `scene-prop` are imported. `homebasePlaceable` alone is not permission for a mission scene; `cargo` alone is not scene decoration. Preserve `missionTags` as descriptive capabilities, not heuristics inferred from model names.

Run `node tools/generate-homebase-scene-assets.mjs` after changing the pack catalogue. It generates `data/mission-homebase-scene-assets.js`, loaded directly after the base scene catalogue and before consumers. It registers one `homebase_<key>` feature and exact-title role per eligible asset, carrying its tags. Current pack 0.6.25 has 33 eligible scene props out of 44 entries, including `homebase_woodenpallet`. The earlier `pavilion` feature remains compatible.

The existing scene composer sees these features through the same catalogue API. The Reporter idea adapter also retains their tags. `sync.js` handles explicit catalogue-backed pack features in the existing item builder, preserving placement overrides and current scene limits. This fixes the gap where a new feature could normalize correctly but never become an item. No cargo manifest or Homebase eligibility changes.

Tests: `tools/mission-homebase-scene-assets.test.mjs` checks eligibility, generated catalogue parity, and all 33 exact titles through the original scene item builder with placement overrides. `tools/mission-scene-cargo-selftest.mjs` checks existing cargo scene behavior. These are not physical simulator placement/visibility tests; collision, spacing and appearance still need visual validation.

Pack 0.6.25 adds `woodenPallet` as the freight-only appearance form `empty_pallet` (Leere Holzpalette). Its 33–66 lb range is a visual-selection assumption for the empty pallet, not a payload-capacity rating or an added load on the model. It is not offered as passenger luggage, and it does not represent stacked goods. Existing stock pallets, cargo forms, mission contracts and runtime behavior are unchanged. The user confirmed the local Homebase test and authorized pack rollout on 21.10.2026; this does not claim a separately tested mission-scene arrangement.

## Explicit reporter composition

For new POI Reporter stories, the existing composer receives the chosen narrative plus the available spatial anchors and avoid-zone geometry through `reporterScene`. `objectPolicy: explicit-requirements` is preserved only for news scenes with nonempty normalized requirements. It makes the existing item builder use those requirements without preset base objects or story-keyword additions. Counts across multiple groups of the same feature are accumulated; explicit group offsets survive placement text without semantic re-anchoring. Existing final placement checks and scene item budgets still apply. Other profiles and scenes without this policy retain the original behavior. Physical layout quality remains subject to simulator verification.

### Reporter role and geometry contract

After the satellite regression, new `news-briefing.v1` scenes use a mandatory explicit role on each requirement. The role must belong to the selected catalogue feature. The original item builder takes title candidates from that role alone; it does not fall back from a container to the generic material pool. `shipping_container` / `cargo.shipping_container` is additive and contains the already catalogued Microsoft container variants. Existing generic cargo roles are unchanged.

The Reporter geometry core checks ground-object center clearances against actual map polygons and mapped road/water lines. It also checks inter-object planning radii. These radii are conservative layout assumptions, not measured mesh bounds or a simulator collision test. Coordinates remain relative to the exact picked POI in a fixed north/east frame. The composer sees a compact geometric overview and candidate centers; full shapes remain in `targetGeoContext.reporterPlacement` for validation and replay. Saved explicit plans are checked again by the item builder. A map/plan failure produces no random replacement scene.

## Gemeinsame POI-Komposition (29.09.2026)

Die Reporter-Platzierung ist nun der gemeinsame versionierte Vertrag für neue POI-Objektszenen. Die früheren Reporter-only-Angaben oben gelten nur für den Vorgängerstand. Siehe [POI Scene Composition](../docs/POI%20Scene%20Composition.md) für Aktivierung, Oberflächen, Rollen, Fehlerverhalten und Tests. Inhalte bleiben missionsspezifisch; Fire/Smoke behält seinen dedizierten Pfad.

## Animal research catalogue (30.09.2026)

Use [MSFS Animal Catalog](../docs/MSFS%20Animal%20Catalog.md) and `data/msfs-animal-research-catalog.json` before selecting new animal models. The research inventory contains 808 exact SDK-listed titles with per-entry source and validation status. It is not loaded by the runtime. SDK locations are not verified ecological ranges; existing generic animal pools are not species-safe regional selectors. Record installed enumeration and per-title spawn/visual tests separately before enabling a new species pool.


## Tiergruppen: Freigabe vom 30.09.2026

Die Standardtiere des Simulators gelten auf ausdrückliche Nutzerfreigabe als verfügbar. Das ist eine Arbeitsannahme, kein erfolgreicher Spawn-Test. Die bisherigen Recherche-/Prüfstatus bleiben als Herkunftsnachweis erhalten; ein späterer Test im laufenden Simulator prüft die tatsächliche Verfügbarkeit.

`data/mission-animal-scene-assets.js` registriert 116 getrennte Modellfamilien mit insgesamt 808 eindeutigen SDK-Titeln. Generierung: `node tools/generate-animal-scene-assets.mjs` aus `data/msfs-animal-research-catalog.json`. Jede Familie hat ein eigenes Feature und eine eigene Rolle; keine zufällige Vermischung verschiedener Arten. SDK-Namensauffälligkeiten stehen in `sourceNotes`. Der Katalog wird nach dem Basis-Assetkatalog geladen.

Writer und Composer dürfen passende Tiere und größere Herden einsetzen. Biologie-Ideen übergeben die gewünschte Art, Anzahl und den Beobachtungszweck in `sceneIntent.animalGroups`. Fiktive Bestände gehören zur Spielhandlung; Habitat und regionale Plausibilität müssen zur Mission passen. Eine Mission ohne Tiere bleibt möglich. Die Szene entsteht weiterhin nach dem Writer über den bestehenden Composer.

Tiergruppen erlauben bis 20 Tiere pro Gruppe und bis 40 Objekte insgesamt. Nichttiergruppen behalten höchstens sechs Objekte pro Gruppe und das bisherige Dichtebudget. Größere Tiergruppen erhalten eine zentrierte Gruppenanordnung; Flächen-, Gebäude-, Abstands- und Kollisionsprüfungen bleiben wirksam. Alle katalogisierten Tiere werden zunächst als bodengebundene Objekte behandelt; Flug-, Schwimm- oder Herdenverhalten wird dadurch nicht zugesichert.

Prüfung: `node --test tools/mission-animal-scene-assets.test.mjs` prüft Katalogübernahme, eine Herde mit 20 Schafen bis zur tatsächlichen Objektliste, Artentrennung, räumliche Ablehnung und Erhalt der Gruppenangaben im App-Sanitizer. Biologie bleibt bis zur gesonderten Freigabe im dokumentierten Testpfad (`ga_bio_briefing_v1`). Keine neuen Tracker- oder Voice-Auslöser.

## Gepäckdarstellung über den Cargo-Composer (21.10.2026)

Gepäck und Ausrüstung der Passagiere bei Reporter-, Charter- und Sightseeing-Ideen werden nicht mehr nur per Stichwortsuche im Label einem Objekt zugeordnet.

- **Kreativer Teil bleibt frei:** Die Ideen-Prompts kennen keinen Katalog und bekommen keine Beispiele. Label und Verpackung schreibt Gemini frei.
- **Composer-Schritt:** `mission-cargo-visual-core.js` ordnet die fertige Beschreibung (Label, Verpackung, Gewicht) 1–3 Packstücken zu. Der Aufruf läuft in den Browser-Adaptern parallel zum Writer. Er sieht nur neutrale Formen (Bezeichnung und Tags), gemischt, ohne Beispiele.
- **Größe und Variante wählt der Code:** Die Größe richtet sich nach dem Gewicht des Stücks; unter gleich gut passenden Varianten wird stabil gestreut (z.B. Farbe).
- **Datenquelle:** Formen, Größe, Lastbereich und Verwendung stehen in `data/mission-cargo-asset-profiles.json`, nach Pack-Asset-Key. Identität und Titel bleiben im Pack-Katalog. Nach Änderungen `node tools/generate-mission-cargo-assets.mjs` ausführen; erzeugt `data/mission-cargo-assets.js` und warnt bei Cargo-Assets ohne Profil. Neue Assets brauchen nur einen Profil-Eintrag.
- **Rückflug:** Die Auswahl liegt in der Idee (`cargoVisual`) und wird mit der Rückflug-Fortsetzung übernommen, damit dieselben Stücke erscheinen.
- **Gruppen:** Ein Manifest-Posten bleibt eine Zeile mit einem Gewicht und trägt `visualPieces`. Jedes Stück hat einen eigenen Objektschlüssel (`<itemKey>`, `<itemKey>:p2`, `:p3`); Startszene, Laden, Entladen und Abwurf behandeln alle Stücke gemeinsam.
- **Fallback:** Ohne gültige Composer-Wahl gilt die bisherige Text-Zuordnung mit einem Stück.
- **Reporter:** Der generische Zusatzposten „Akkukoffer und Speicherkarten“ entfällt bei `apt-news-idea.v1`, weil die Reporter-Ausrüstung ihn bereits enthält.
- **Pickup:** Am Zielplatz wartet dieselbe Gruppe in der Ankunftsszene (`arrival_equipment_1`, `arrival_equipment_1_p2`, …) mit denselben Stück-Schlüsseln, die das Laden entfernt.
- **Drehung:** Jedes Stück trägt `randomYawDeg: 180`; der Tracker dreht es bei jedem neuen Spawn-Befehl zufällig (`sceneItemHeadingDeg` in `tracker.js`). Wiederherstellen nach Reconnect nutzt die gespeicherten Positionen. Ausgeladene oder abgeworfene Bordausrüstung (Radkeile, Bordbuch, Feuerlöscher, Erste-Hilfe-Koffer) wird ebenso zufällig gedreht. Andere Objekte ohne `randomYawDeg` behalten ihre feste Ausrichtung. Stückabstand 0,7/0,9/1,3 m (klein/mittel/groß) lässt Platz für die Drehung.
- **Offen:** Die Platzierungsprüfung der Ankunftsszene bewertet das Ausrüstungs-Objekt; weitere Stücke liegen 0,7–1,3 m daneben.

Tests: `node --test tools/mission-cargo-visual.test.mjs`, Gruppenfall in `ga-tracker-client/tracker-mission-simulator-effects.test.js`.

## Ersatztitel nur bei echten Titel-Fehlern (22.10.2026)

- **Befund:** Auf einem schwachen System vergab MSFS Objekt-IDs erst nach
  10-20 s. Der Tracker wertete das nach 2,2-3 s als Fehler und forderte die
  Ersatztitel (`..._Fire_Extinguisher`, `Cardboard`, `CoffeeCup`) zusaetzlich
  an. Alle Anfragen wurden spaeter trotzdem ausgefuehrt: kurzzeitig stand ein
  Kaffeebecher statt des Feuerloeschers am Flugzeug, und der Sim bekam die
  vierfache Last.
- **Regel:** Ersatztitel werden nur nach einer SimConnect-Exception versucht
  (`UNRECOGNIZED_ID`, `CREATE_OBJECT_FAILED`). Bleibt der Sim still, wartet der
  Tracker bis zu 17 s zusaetzlich (`SCENE_SPAWN_SILENT_GRACE_MS`) auf den
  Originaltitel und meldet diesen dann als normalen Erfolg
  (`SCENE_SPAWN_WAIT_EXTENDED`). Danach wird abgebrochen
  (`SCENE_SPAWN_FALLBACK_SKIPPED`), ohne Ersatzobjekt; eine noch spaetere ID
  wird ueber die bestehende Late-Assign-Logik der Szene zugeordnet oder bei
  zwischenzeitlich verstecktem Objekt entfernt.
- Gilt fuer Einzelobjekte (`spawnSceneObjectFromPlan`) und volle Szenen
  (`spawnMissionScene`). Test: `ga-tracker-client/tracker-scene-spawn-wait.test.js`.
