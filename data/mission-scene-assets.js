// Mission scene asset catalog built from the first MSFS 2024 visual validation pass.
// VFX entries are kept as known/ACK-tested assets because particles need separate review.
window.MISSION_SCENE_ASSETS = {
    version: '2026-05-20-scene-taxonomy',
    source: 'msfs2024-spawn-validation manual pass plus known VFX',
    targetSceneKinds: {
        none: {
            label: 'Keine Zielszene',
            roles: [],
            useFor: ['sightseeing_tour', 'poi_learning_guide', 'historian_guided_tour', 'training', 'charter']
        },
        fire_watch: {
            label: 'Waldbrand / Rauchmeldung',
            roles: ['vfx.smoke', 'vfx.fire'],
            useFor: ['fire_watch'],
            note: 'Wird zur Laufzeit ueber Fire-Smoke-Logik abgewickelt, nicht als generische Szene.'
        },
        road_incident: {
            label: 'Unfall / Verkehrslage',
            roles: ['vehicle.car', 'vehicle.emergency.medical', 'marker.cone', 'person.ground_crew'],
            useFor: ['news_coverage', 'search_and_rescue', 'medical_transfer']
        },
        sar_water: {
            label: 'SAR Wasser / Rettungsinsel',
            roles: ['sar.liferaft', 'watercraft.boat', 'watercraft.ship'],
            useFor: ['search_and_rescue']
        },
        sar_land: {
            label: 'SAR Land / Suchgebiet',
            roles: ['vehicle.emergency.medical', 'vehicle.quad', 'cargo.container', 'person.ground_crew'],
            useFor: ['search_and_rescue']
        },
        medical_pickup: {
            label: 'Medizinischer Abhol-/Uebergabepunkt',
            roles: ['vehicle.emergency.medical', 'cargo.small_box', 'person.ground_crew'],
            useFor: ['medical_transfer']
        },
        cargo_site: {
            label: 'Fracht-/Materialpunkt',
            roles: ['vehicle.truck', 'vehicle.van', 'cargo.container', 'cargo.pallet_medium', 'cargo.small_box'],
            useFor: ['cargo_fragile', 'club_utility', 'animal_transport']
        },
        construction_site: {
            label: 'Baustelle / Erdarbeiten',
            roles: ['construction.crane', 'construction.earthmoving', 'vehicle.truck', 'cargo.container', 'marker.cone'],
            useFor: ['mapping_survey', 'science_geo', 'news_coverage']
        },
        powerline_inspection: {
            label: 'Strommast / Energie-Infrastruktur',
            roles: ['utility.powerline', 'utility.generator', 'vehicle.truck', 'marker.cone'],
            useFor: ['inspection_infra', 'mapping_survey', 'science_geo']
        },
        erosion_damage: {
            label: 'Uferbruch / Hangrutsch / Erosion',
            roles: ['nature.log', 'debris.light', 'marker.cone'],
            useFor: ['science_geo', 'science_bio', 'mapping_survey']
        },
        debris_field: {
            label: 'Truemmerfeld / verstreute Gegenstaende',
            roles: ['debris.light', 'cargo.small_box', 'cargo.pallet_small', 'nature.log'],
            useFor: ['search_and_rescue', 'news_coverage', 'mapping_survey']
        },
        infra_bridge: {
            label: 'Bruecke / Viadukt / Verkehrsbauwerk',
            roles: ['vehicle.truck', 'marker.cone', 'utility.generator'],
            useFor: ['inspection_infra', 'mapping_survey', 'news_coverage']
        },
        infra_dam: {
            label: 'Staudamm / Wasserbauwerk',
            roles: ['marker.cone', 'utility.generator', 'vehicle.truck', 'watercraft.boat'],
            useFor: ['inspection_infra', 'science_geo', 'mapping_survey']
        },
        industry_site: {
            label: 'Industrie-/Werkgelände',
            roles: ['vehicle.truck', 'cargo.container', 'utility.generator', 'vfx.smoke'],
            useFor: ['inspection_infra', 'news_coverage', 'mapping_survey']
        },
        water_pollution: {
            label: 'Gewässerbeobachtung / Verschmutzung',
            roles: ['watercraft.boat', 'nature.log', 'marker.cone'],
            useFor: ['science_bio', 'science_general', 'news_coverage']
        },
        wildlife_site: {
            label: 'Natur-/Wildtierbeobachtung ohne Einsatzfahrzeuge',
            roles: ['nature.log', 'debris.light'],
            useFor: ['science_bio', 'sightseeing_tour']
        },
        media_site: {
            label: 'Event / Medienbeobachtung',
            roles: ['vehicle.van', 'cargo.small_box', 'marker.cone'],
            useFor: ['news_coverage', 'media_photo']
        },
        event_site: {
            label: 'Veranstaltung / Menschenansammlung',
            roles: ['vehicle.bus', 'vehicle.van', 'marker.cone'],
            useFor: ['news_coverage', 'sightseeing_tour']
        },
        survey_context: {
            label: 'Generische Survey-Kontextszene ohne Bodencrew',
            roles: ['marker.cone', 'nature.log', 'debris.light'],
            useFor: ['mapping_survey', 'science_geo', 'science_bio']
        }
    },
    roles: {
        'vfx.smoke': [
            'Chimney_Smoke_V1',
            'Chimney_Smoke_V2',
            'Chimney_Smoke_V3',
            'Chimney_Smoke_V4',
            'VO_Smoke_R1_100_Black',
            'VO_Smoke_R1_100_White',
            'VO_Smoke_R1_105_Black',
            'VO_Smoke_R1_105_White',
            'VO_Smoke_R1_110_Black',
            'VO_Smoke_R1_110_White',
            'VO_Smoke_R1_115_Black',
            'VO_Smoke_R1_115_White'
        ],
        'vfx.fire': [
            'VO_Fire_R1_40',
            'VO_Fire_R1_100',
            'VO_Fire_R1_105',
            'VO_Fire_R1_110',
            'VO_Fire_R1_115',
            'VO_Fire_R1_120',
            'VO_Fire_R1_125',
            'VO_Fire_R1_130',
            'VO_Fire_R1_135',
            'VO_Fire_R1_140',
            'VO_Fire_R1_145',
            'VO_Fire_R1_150'
        ],
        'vehicle.emergency.fire': [
            'Car Bush Firefighting'
        ],
        'vehicle.emergency.medical': [
            'Car Bush Medic',
            'Truck Utility Europe Medic Box',
            'Truck Utility NorthAm Medic',
            'Van Asia High Roof Medic',
            'Van Asia High Roof Medic Japan',
            'Van Asia Low Roof Medic'
        ],
        'vehicle.car': [
            'Microsoft_Car_EUR_01',
            'Microsoft_Car_EUR_02',
            'Microsoft_Car_EUR_03',
            'Microsoft_Car_EUR_04',
            'Microsoft_Car_EUR_01_black',
            'Microsoft_Car_EUR_02_Blue',
            'Microsoft_Car_EUR_02_Silver',
            'Microsoft_Car_EUR_03_Beige',
            'Microsoft_Car_EUR_03_Black',
            'Microsoft_Car_EUR_03_Blue',
            'Microsoft_Car_EUR_03_Red',
            'Microsoft_Car_EUR_04_Blue'
        ],
        'vehicle.van': [
            'Microsoft_Van_EUR',
            'Microsoft_Van_ASIA_02',
            'Microsoft_Van_ASIA_02_Brown',
            'Microsoft_Van_ASIA_02_Yellow',
            'Microsoft_Van_EUR_Black',
            'Microsoft_Van_EUR_Blue',
            'Microsoft_Van_EUR_Red',
            'Microsoft_Van_NA_Lavatory',
            'Microsoft_Van_NA_Lavatory_Blue',
            'Microsoft_Van_NA_Modern',
            'Microsoft_Van_NA_Modern_Green',
            'Winch Busio Van Gelder 4D'
        ],
        'vehicle.truck': [
            'Fuel Truck Long 01',
            'Fuel Truck Long 02',
            'Truck Fire Short',
            'Truck Military Cover',
            'Truck Military No Cover',
            'Truck Utility Europe Flush',
            'Truck Utility NorthAm',
            'ASO_Operation_Truck_White',
            'ASO_Operation_Truck_Yellow'
        ],
        'vehicle.bus': [
            'Bus',
            'Microsoft_Bus_Modern',
            'Microsoft_Bus_Modern_Red',
            'Microsoft_Bus_EUR_Vintage',
            'Microsoft_MiniBus_ASIA_01',
            'MiniBus India'
        ],
        'vehicle.quad': [
            'Microsoft_Quad'
        ],
        'construction.crane': [
            'Truck Crane Small',
            'Microsoft_Truck_Crane_Small',
            'Microsoft_Truck_Crane_Small_Green',
            'Microsoft_Truck_Crane_Small_Red',
            'Microsoft_Truck_Crane_Small_White',
            'ASOBO_Truck_Crane_Small'
        ],
        'construction.earthmoving': [
            'Bulldozer',
            'Microsoft_Bulldozer',
            'ASOBO_Bulldozer'
        ],
        'utility.powerline': [
            'PowerPylon_Base',
            'PowerPylon_Top'
        ],
        'utility.generator': [
            'PowerGenerator',
            'GeneracPowerSystems01',
            'Car Ground Power Unit',
            'ASOBO_Car_Ground_Power_Unit'
        ],
        'watercraft.boat': [
            'Fishing Boat Red Modular',
            'Fishing Boat White Modular',
            'Microsoft_Ships_AbeilleBourbon_1.0',
            'Microsoft_Ships_AbeilleBourbon_10.0',
            'Microsoft_Ships_AbeilleBourbon_11.0',
            'Microsoft_Ships_AbeilleBourbon_12.0',
            'Microsoft_Ships_AbeilleBourbon_2.0',
            'Microsoft_Ships_AbeilleBourbon_3.0',
            'Microsoft_Ships_AbeilleBourbon_4.0',
            'Microsoft_Ships_AbeilleBourbon_5.0',
            'Microsoft_Ships_AbeilleBourbon_6.0',
            'Microsoft_Ships_AbeilleBourbon_7.0'
        ],
        'watercraft.ship': [
            'CargoShip01',
            'CruiseShip01',
            'CruiseShip02',
            'FishingShip02',
            'FishingShip03',
            'Microsoft_Ships_Atlantic_1',
            'Microsoft_Ships_BcFerriesKuper_1'
        ],
        'sar.liferaft': [
            'LifeRaft'
        ],
        'person.ground_crew': [
            'Tarmac_Female_Summer_Asian',
            'Marshaller_Female_Summer_African',
            'Marshaller_Female_Summer_Arab',
            'Marshaller_Female_Summer_Asian',
            'Marshaller_Female_Summer_Caucasian',
            'Marshaller_Female_Summer_Hispanic',
            'Marshaller_Female_Summer_Indian',
            'Marshaller_Female_Winter_African',
            'Marshaller_Female_Winter_Arab',
            'Marshaller_Female_Winter_Asian',
            'Marshaller_Female_Winter_Caucasian',
            'Marshaller_Female_Winter_Hispanic'
        ],
        'cargo.container': [
            'Drop_Container',
            'Microsoft_Truck_Container',
            'Microsoft_Truck_Container_Blue',
            'Microsoft_Truck_Container_Gray',
            'Microsoft_Truck_Container_Red',
            'CargoContainer01'
        ],
        'cargo.small_box': [
            'Cardboard',
            'CoffeeCup'
        ],
        'cargo.pallet_large': [
            'Pallet01_01'
        ],
        'cargo.pallet_medium': [
            'Pallet01_02'
        ],
        'cargo.pallet_small': [
            'Pallet01_03'
        ],
        'marker.cone': [
            'Cone_Medium',
            'EDTW Smoke Marker'
        ],
        'material.log': [
            'Log_01',
            'Log'
        ],
        'nature.log': [
            'Log_01',
            'Log'
        ],
        'debris.light': [
            'Log_01',
            'Cardboard',
            'Pallet01_03',
            'Pallet01_02'
        ]
    }
};
