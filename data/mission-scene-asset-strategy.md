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

Run `node tools/generate-homebase-scene-assets.mjs` after changing the pack catalogue. It generates `data/mission-homebase-scene-assets.js`, loaded directly after the base scene catalogue and before consumers. It registers one `homebase_<key>` feature and exact-title role per eligible asset, carrying its tags. Current pack 0.6.24 has 32 eligible scene props out of 43 entries. The earlier `pavilion` feature remains compatible.

The existing scene composer sees these features through the same catalogue API. The Reporter idea adapter also retains their tags. `sync.js` handles explicit catalogue-backed pack features in the existing item builder, preserving placement overrides and current scene limits. This fixes the gap where a new feature could normalize correctly but never become an item. No cargo manifest or Homebase eligibility changes.

Tests: `tools/mission-homebase-scene-assets.test.mjs` checks eligibility, generated catalogue parity, and all 32 exact titles through the original scene item builder with placement overrides. `tools/mission-scene-cargo-selftest.mjs` checks existing cargo scene behavior. These are not physical simulator placement/visibility tests; collision, spacing and appearance still need visual validation.

## Explicit reporter composition

For new POI Reporter stories, the existing composer receives the chosen narrative plus the available spatial anchors and avoid-zone geometry through `reporterScene`. `objectPolicy: explicit-requirements` is preserved only for news scenes with nonempty normalized requirements. It makes the existing item builder use those requirements without preset base objects or story-keyword additions. Counts across multiple groups of the same feature are accumulated; explicit group offsets survive placement text without semantic re-anchoring. Existing final placement checks and scene item budgets still apply. Other profiles and scenes without this policy retain the original behavior. Physical layout quality remains subject to simulator verification.

### Reporter role and geometry contract

After the satellite regression, new `news-briefing.v1` scenes use a mandatory explicit role on each requirement. The role must belong to the selected catalogue feature. The original item builder takes title candidates from that role alone; it does not fall back from a container to the generic material pool. `shipping_container` / `cargo.shipping_container` is additive and contains the already catalogued Microsoft container variants. Existing generic cargo roles are unchanged.

The Reporter geometry core checks ground-object center clearances against actual map polygons and mapped road/water lines. It also checks inter-object planning radii. These radii are conservative layout assumptions, not measured mesh bounds or a simulator collision test. Coordinates remain relative to the exact picked POI in a fixed north/east frame. The composer sees a compact geometric overview and candidate centers; full shapes remain in `targetGeoContext.reporterPlacement` for validation and replay. Saved explicit plans are checked again by the item builder. A map/plan failure produces no random replacement scene.

## Gemeinsame POI-Komposition (29.09.2026)

Die Reporter-Platzierung ist nun der gemeinsame versionierte Vertrag für neue POI-Objektszenen. Die früheren Reporter-only-Angaben oben gelten nur für den Vorgängerstand. Siehe [POI Scene Composition](../docs/POI%20Scene%20Composition.md) für Aktivierung, Oberflächen, Rollen, Fehlerverhalten und Tests. Inhalte bleiben missionsspezifisch; Fire/Smoke behält seinen dedizierten Pfad.
