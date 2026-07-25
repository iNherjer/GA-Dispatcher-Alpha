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
