// Mission scene asset catalog built from MSFS 2024 visual validation plus
// the SimObjects_Visuals.pdf visual pass. VFX entries are kept as known/ACK-tested assets
// because particles need separate review.
window.MISSION_SCENE_ASSETS = {
    version: '2026-07-29-homebase-cargo-v0.6.21-wheel-chocks',
    source: 'msfs2024-spawn-validation manual pass, SimObjects_Visuals.pdf visual tagging, known VFX, plus Homebase cargo assets v0.6.21 including aircraft wheel chocks',
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
            roles: ['sar.liferaft', 'watercraft.tiny_boat', 'watercraft.small_boat'],
            useFor: ['search_and_rescue']
        },
        sar_land: {
            label: 'SAR Land / Suchgebiet',
            roles: ['sar.person_target', 'person.ground_crew', 'vfx.smoke', 'vehicle.emergency.medical', 'vehicle.quad', 'cargo.small_box'],
            useFor: ['search_and_rescue']
        },
        medical_pickup: {
            label: 'Medizinischer Abhol-/Uebergabepunkt',
            roles: ['vehicle.emergency.medical', 'cargo.medical_kit', 'person.ground_crew'],
            useFor: ['medical_transfer']
        },
        cargo_site: {
            label: 'Fracht-/Materialpunkt',
            roles: ['vehicle.truck', 'vehicle.van', 'cargo.container', 'cargo.pallet_medium', 'cargo.small_box', 'cargo.wood_crate', 'cargo.toolbox', 'cargo.cooler', 'cargo.camera_equipment', 'cargo.camping_equipment', 'cargo.equipment_case', 'cargo.animal_transport_box', 'cargo.aircraft_logbook', 'cargo.fire_extinguisher', 'cargo.first_aid_case', 'cargo.wheel_chocks'],
            useFor: ['cargo_fragile', 'club_utility', 'animal_transport']
        },
        construction_site: {
            label: 'Baustelle / Erdarbeiten',
            roles: ['construction.crane', 'construction.earthmoving', 'construction.vehicle', 'construction.material', 'vehicle.truck', 'utility.generator', 'marker.cone'],
            useFor: ['mapping_survey', 'science_geo', 'news_coverage']
        },
        powerline_inspection: {
            label: 'Strommast / Energie-Infrastruktur',
            roles: ['utility.powerline', 'utility.generator', 'vehicle.truck', 'marker.cone'],
            useFor: ['inspection_infra', 'mapping_survey', 'science_geo']
        },
        wind_turbine_site: {
            label: 'Windenergieanlage / Windrad-Baustelle',
            roles: ['utility.wind_turbine', 'vehicle.truck', 'marker.cone'],
            useFor: ['inspection_infra', 'mapping_survey', 'science_geo', 'news_coverage']
        },
        erosion_damage: {
            label: 'Uferbruch / Hangrutsch / Erosion',
            roles: ['nature.log', 'debris.light', 'marker.cone'],
            useFor: ['science_geo', 'science_bio', 'mapping_survey']
        },
        debris_field: {
            label: 'Truemmerfeld / verstreute Gegenstaende',
            roles: ['aircraft.wreck', 'debris.light', 'cargo.small_box', 'cargo.pallet_small', 'nature.log'],
            useFor: ['search_and_rescue', 'news_coverage', 'mapping_survey']
        },
        infra_bridge: {
            label: 'Bruecke / Viadukt / Verkehrsbauwerk',
            roles: ['vehicle.truck', 'marker.cone', 'utility.generator'],
            useFor: ['inspection_infra', 'mapping_survey', 'news_coverage']
        },
        infra_dam: {
            label: 'Staudamm / Wasserbauwerk',
            roles: ['marker.cone', 'utility.generator', 'vehicle.truck', 'watercraft.tiny_boat', 'watercraft.small_boat'],
            useFor: ['inspection_infra', 'science_geo', 'mapping_survey']
        },
        industry_site: {
            label: 'Industrie-/Werkgelände',
            roles: ['vehicle.truck', 'cargo.container', 'utility.generator', 'vfx.smoke'],
            useFor: ['inspection_infra', 'news_coverage', 'mapping_survey']
        },
        water_pollution: {
            label: 'Gewässerbeobachtung / Verschmutzung',
            roles: ['watercraft.tiny_boat', 'watercraft.small_boat', 'nature.log', 'animal.waterfowl', 'marker.cone'],
            useFor: ['science_bio', 'science_general', 'news_coverage']
        },
        water_context: {
            label: 'Wasser-/Uferkontext ohne Einsatzlage',
            roles: ['watercraft.tiny_boat', 'watercraft.small_boat', 'nature.log', 'animal.waterfowl'],
            useFor: ['poi_learning_guide', 'sightseeing_tour', 'science_bio', 'science_general']
        },
        wildlife_site: {
            label: 'Natur-/Wildtierbeobachtung ohne Einsatzfahrzeuge',
            roles: ['nature.log', 'animal.wildlife', 'animal.grazing', 'animal.waterfowl', 'debris.light'],
            useFor: ['science_bio', 'sightseeing_tour']
        },
        media_site: {
            label: 'Event / Medienbeobachtung',
            roles: ['vehicle.van', 'cargo.camera_equipment', 'marker.cone'],
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
    targetScenePresets: {
        construction_powerline: {
            label: 'Baustelle mit Strommast/Freileitung',
            kind: 'construction_site',
            features: ['powerline', 'generator', 'cones'],
            useFor: ['mapping_survey', 'inspection_infra', 'science_geo']
        },
        wind_turbine_construction: {
            label: 'Windrad-Bau/Wartung auf offenem Gelaende',
            kind: 'wind_turbine_site',
            features: ['wind_turbine', 'construction_truck'],
            useFor: ['mapping_survey', 'inspection_infra', 'science_geo', 'news_coverage']
        },
        road_incident_smoke: {
            label: 'Verkehrsunfall mit leichter Rauchentwicklung',
            kind: 'road_incident',
            features: ['smoke_light', 'emergency_response', 'debris'],
            useFor: ['news_coverage', 'search_and_rescue']
        },
        erosion_debris: {
            label: 'Ufer-/Hangschaden mit sichtbarem Treibgut und Debris',
            kind: 'erosion_damage',
            features: ['logs', 'debris', 'cones'],
            useFor: ['science_geo', 'mapping_survey']
        },
        bridge_worksite: {
            label: 'Brueckenpruefung mit Arbeitsfahrzeugen',
            kind: 'infra_bridge',
            features: ['utility_truck', 'generator', 'cones'],
            useFor: ['inspection_infra', 'mapping_survey']
        },
        industry_smoke: {
            label: 'Industrieanlage mit leichter Rauch-/Abluftquelle',
            kind: 'industry_site',
            features: ['smoke_light', 'cargo_material', 'utility_truck'],
            useFor: ['inspection_infra', 'news_coverage']
        },
        water_sar_ship: {
            label: 'SAR Wasser mit Rettungsinsel',
            kind: 'sar_water',
            features: ['liferaft'],
            useFor: ['search_and_rescue']
        },
        event_traffic: {
            label: 'Event mit Shuttle-/Verkehrslage',
            kind: 'event_site',
            features: ['bus', 'road_vehicles', 'cones'],
            useFor: ['news_coverage', 'sightseeing_tour']
        },
        wildlife_herd: {
            label: 'Naturbeobachtung mit kleiner Tiergruppe',
            kind: 'wildlife_site',
            features: ['wildlife_animals', 'animal_herd'],
            useFor: ['science_bio', 'sightseeing_tour']
        }
    },
    targetSceneFeatures: {
        construction_crane: {
            label: 'Kran / Kranfahrzeug',
            roles: ['construction.crane']
        },
        earthmoving: {
            label: 'Bagger/Bulldozer/Erdarbeiten',
            roles: ['construction.earthmoving']
        },
        construction_truck: {
            label: 'Baustellen-LKW',
            roles: ['construction.vehicle', 'vehicle.truck']
        },
        construction_material: {
            label: 'Baustellenmaterial / technische Aggregate',
            roles: ['construction.material', 'utility.generator', 'cargo.pallet_medium', 'cargo.pallet_small']
        },
        cargo_material: {
            label: 'Container, Paletten, kleine Fracht oder Materiallager',
            roles: ['cargo.container', 'cargo.pallet_large', 'cargo.pallet_medium', 'cargo.pallet_small', 'cargo.small_box', 'construction.material']
        },
        pallet_stack: {
            label: 'Palettenstapel / gebuendeltes Materiallager',
            roles: ['cargo.pallet_medium', 'cargo.pallet_small', 'cargo.pallet_large']
        },
        powerline: {
            label: 'Strommast/Freileitung',
            roles: ['utility.powerline', 'utility.generator', 'vehicle.truck', 'marker.cone']
        },
        wind_turbine: {
            label: 'Windrad/Windenergieanlage',
            roles: ['utility.wind_turbine']
        },
        generator: {
            label: 'Generator/Aggregat',
            roles: ['utility.generator']
        },
        utility_truck: {
            label: 'Utility-/Servicefahrzeug',
            roles: ['vehicle.truck', 'vehicle.van']
        },
        road_vehicles: {
            label: 'Zivile Fahrzeuge',
            roles: ['vehicle.car', 'vehicle.van']
        },
        emergency_response: {
            label: 'Einsatzfahrzeug/Bodencrew',
            roles: ['vehicle.emergency.medical', 'vehicle.emergency.fire', 'person.ground_crew', 'marker.cone']
        },
        people: {
            label: 'Personen am Boden',
            roles: ['person.ground_crew']
        },
        missing_person: {
            label: 'vermisste / winkende Person als Suchziel',
            roles: ['sar.person_target', 'person.ground_crew']
        },
        cones: {
            label: 'Absperrkegel/Marker',
            roles: ['marker.cone']
        },
        debris: {
            label: 'Truemmer/leichte verstreute Gegenstaende',
            roles: ['debris.light', 'cargo.small_box', 'cargo.pallet_small']
        },
        aircraft_wreck: {
            label: 'Kleinflugzeug / UL-Wrack als primaerer Absturzfund',
            roles: ['aircraft.wreck', 'debris.light']
        },
        logs: {
            label: 'Baumstaemme/Treibholz',
            roles: ['nature.log', 'material.log']
        },
        liferaft: {
            label: 'Rettungsinsel',
            roles: ['sar.liferaft']
        },
        watercraft: {
            label: 'kleine zivile Boote / See- und Uferaktivitaet',
            roles: ['watercraft.tiny_boat', 'watercraft.small_boat']
        },
        service_ship: {
            label: 'grosses Arbeits-/Service-Schiff nur fuer Kueste, Hafen oder grosses Gewaesser',
            roles: ['watercraft.service_ship', 'watercraft.large_ship']
        },
        waterfowl: {
            label: 'heimische Wasservoegel am See',
            roles: ['animal.waterfowl', 'animal.bird']
        },
        wildlife_animals: {
            label: 'lokale Wildtiere',
            roles: ['animal.wildlife', 'animal.deer']
        },
        animal_herd: {
            label: 'kleine Tierherde / Weidetiere',
            roles: ['animal.grazing']
        },
        tent: {
            label: 'Zelt / kleines Camp-Element',
            roles: ['camp.tent']
        },
        parked_vehicle: {
            label: 'parkendes ziviles Fahrzeug',
            roles: ['vehicle.car']
        },
        small_equipment: {
            label: 'kleine Ausruestung / Kisten / Picknick',
            roles: ['cargo.small_box']
        },
        aircraft_logbook: {
            label: 'Luftfahrzeug-Bordbuch / Flugbuch',
            roles: ['cargo.aircraft_logbook']
        },
        fire_extinguisher: {
            label: 'Feuerloescher',
            roles: ['cargo.fire_extinguisher']
        },
        first_aid_case: {
            label: 'Erste-Hilfe-Koffer / Verbandkasten',
            roles: ['cargo.first_aid_case']
        },
        wheel_chocks: {
            label: 'Flugzeug-Radkeile / Wheel Chocks',
            roles: ['cargo.wheel_chocks']
        },
        campfire: {
            label: 'kleines Lagerfeuer / Feuerstelle',
            roles: ['vfx.fire']
        },
        lantern: {
            label: 'Stall-/Camp-Laterne',
            roles: ['scene.lighting.lantern']
        },
        bus: {
            label: 'Bus/Shuttle',
            roles: ['vehicle.bus']
        },
        smoke_light: {
            label: 'leichte Rauchquelle',
            roles: ['vfx.smoke']
        },
        signal_smoke: {
            label: 'Rauchsignal / farbiger Signalrauch',
            roles: ['vfx.smoke']
        },
        fire_small: {
            label: 'kleiner Brandherd',
            roles: ['vfx.fire']
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
            'Car Bush Firefighting',
            'ASO_Firetruck02',
            'Truck Fire Airport Medium',
            'Truck Fire Short',
            'Truck Fire Short 02',
            'Microsoft_Truck_Fire_Medium_Red'
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
            'Microsoft_Van_NA_Modern',
            'Microsoft_Van_NA_Modern_Green',
            'Van Europe',
            'Van NorthAm'
        ],
        'vehicle.truck': [
            'Truck Utility Europe Flush',
            'Truck Utility NorthAm',
            'Truck Europe',
            'Truck Europe Vintage',
            'Truck Large Europe',
            'Truck NorthAm',
            'Truck Large NorthAm Vintage 01',
            'ASO_Operation_Truck_White',
            'ASO_Operation_Truck_Yellow',
            'ASO_TruckUtility01',
            'Pickup 01'
        ],
        'vehicle.airport_service': [
            'Fuel Truck Long 01',
            'Fuel Truck Long 02',
            'microsoft_truck_na_fuel_short_orange',
            'microsoft_truck_eur_fuel_short_green',
            'truck fuel long 02',
            'Truck Boarding NorthAm',
            'Microsoft_truck_eur_boarding_purple',
            'Microsoft_Aerial_Tank',
            'Truck Deicing Large',
            'Microsoft_Truck_NA_DeIce_Small_Blue',
            'microsoft_truck_eur_deice_small_yellow',
            'Van Lavatory NorthAm',
            'Microsoft_Van_NA_Lavatory',
            'Microsoft_Van_NA_Lavatory_Blue'
        ],
        'vehicle.military': [
            'MATV Vehicle',
            'Humvee',
            'Police Armoured Vehicle',
            'UN Armoured Vehicle',
            'Military Fuel Truck',
            'Truck Military Cover',
            'Truck Military No Cover',
            'microsoft_truck_military_01_tan',
            'microsoft_truck_military_01',
            'microsoft_truck_military_01_green',
            'car_military',
            'microsoft_car_military_tan'
        ],
        'construction.vehicle': [
            'Truck Crane Small',
            'Forklift Large',
            'Forklift Medium',
            'Truck Water 02',
            'Truck Water 03',
            'microsoft_truck_eur_utility_vintage_blue',
            'Harvester',
            'Tractor'
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
        'utility.wind_turbine': [
            'WindTurbine',
            'Wind_Turbine',
            'WindTurbine01',
            'Wind_Turbine_01',
            'Microsoft_WindTurbine',
            'Microsoft_Wind_Turbine'
        ],
        'utility.generator': [
            'PowerGenerator',
            'GeneracPowerSystems01',
            'Car Ground Power Unit',
            'ASOBO_Car_Ground_Power_Unit'
        ],
        'construction.material': [
            'RooftopUnits03',
            'BuildingMaterial01',
            'GeneracPowerSystems01',
            'Double Pallet',
            'Single pallet'
        ],
        'watercraft.boat': [
            'boat01',
            'boat02',
            'Yacht01',
            'Yacht02',
            'Yacht03',
            'Fishing Boat Red Modular',
            'Fishing Boat White Modular'
        ],
        'watercraft.tiny_boat': [
            'boat01',
            'boat02'
        ],
        'watercraft.small_boat': [
            'boat01',
            'boat02',
            'Yacht01',
            'Yacht02',
            'Yacht03',
            'Fishing Boat Red Modular',
            'Fishing Boat White Modular'
        ],
        'watercraft.fishing_ship': [
            'FishingShip02',
            'FishingShip03',
            'fishingship02',
            'fishingship03'
        ],
        'watercraft.service_ship': [
            'PlatformSupply',
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
        'watercraft.large_ship': [
            'CargoShip01',
            'CruiseShip01',
            'CruiseShip02',
            'Cargoship01',
            'CargoGas01',
            'CargoOil01',
            'Miltech Tankership',
            'USCG Cutter',
            'Hospital Ship',
            'Cruise Ship'
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
        'animal.waterfowl': [
            'Goose',
            'Seagull'
        ],
        'animal.bird': [
            'Goose',
            'Seagull'
        ],
        'animal.deer': [
            'OHemionusFemale',
            'OHemionusFemaleVariation1',
            'OHemionusJuvenile',
            'OHemionusMale',
            'CElaphusCanadensisFemale',
            'CElaphusCanadensisJuvenile',
            'CElaphusCanadensisMale',
            'AAlcesFemale',
            'AAlcesJuvenile',
            'AAlcesMale'
        ],
        'animal.grazing': [
            'ALerviaFemale',
            'ALerviaJuvenile',
            'ALerviaMale',
            'BTaurusPrimigeniusFemale',
            'BTaurusPrimigeniusJuvenile',
            'BFrontalisMale',
            'CHircusHircusFemale',
            'CHircusHircusJuvenile',
            'ECaballusFemale',
            'ECaballusMale'
        ],
        'animal.wildlife': [
            'OHemionusFemale',
            'OHemionusJuvenile',
            'AAlcesFemale',
            'AAlcesJuvenile',
            'CElaphusCanadensisFemale',
            'RTarandusGroenlandicusFemale',
            'CLupusLupusFemale',
            'UArctosArctosFemale'
        ],
        'camp.tent': [
            'LFPB_AS_Tent_01',
            'LFPB_AS_Tent_Dome_Blue',
            'LFPB_AS_Tent_Dome_Orange',
            'LFPB_AS_Tent_Dome_Red',
            'LFPB_AS_Tent_Storage'
        ],
        'camp.trailer': [
            'MICROSOFT_ASSET_GlidersTrailerGlobal',
            'MICROSOFT_ASSET_GlidersTrailerType1_Regular_BlueGray',
            'MICROSOFT_ASSET_GlidersTrailerType2_Modern_BlueLine',
            'MICROSOFT_ASSET_GlidersTrailerType3_Big_Green'
        ],
        'sar.liferaft': [
            'LifeRaft',
            'Liferaft',
            'LifeRaft_Characters',
            'Liferaft_Characters'
        ],
        'sar.person_target': [
            'mmh_HikerRescue',
            'mmh_SkierRescue',
            'mmh_ArcticRescue'
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
        'person.male': [
            'Tarmac_Male_Summer_Caucasian',
            'Tarmac_Male_Summer_Asian',
            'marshaller_male_summer_arab',
            'marshaller_male_winter_hispanic',
            'Tarmac_Male_Winter_Caucasian',
            'Tarmac_Male_Winter_Asian'
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
        'cargo.luggage.backpack': [
            'VFR Multitool Homebase Backpack',
            'VFR Multitool Homebase Daypack'
        ],
        'cargo.luggage.duffel': [
            'VFR Multitool Homebase Duffel Bag'
        ],
        'cargo.toolbox': [
            'VFR Multitool Homebase Portable Toolbox',
            'VFR Multitool Homebase Toolbox'
        ],
        'cargo.tool_cart': [
            'VFR Multitool Homebase Tool Cart'
        ],
        'cargo.cooler': [
            'VFR Multitool Homebase Insulated Cooler'
        ],
        'cargo.jerrycan_pair': [
            'VFR Multitool Homebase Jerrycan Pair'
        ],
        'cargo.mail_sack': [
            'VFR Multitool Homebase Mail Sack'
        ],
        'cargo.wood_crate': [
            'VFR Multitool Homebase Wood Crate Small',
            'VFR Multitool Homebase Wood Crate Medium',
            'VFR Multitool Homebase Wood Crate Large'
        ],
        'cargo.camera_equipment': [
            'VFR Multitool Mission Camera Equipment Cargo'
        ],
        'cargo.camping_equipment': [
            'VFR Multitool Mission Camping Equipment Cargo'
        ],
        'cargo.equipment_case': [
            'VFR Multitool Homebase Hardcase Yellow Small',
            'VFR Multitool Homebase Hardcase Red Pro',
            'VFR Multitool Homebase Flight Case Black'
        ],
        'cargo.medical_kit': [
            'VFR Multitool Mission Medical Backpack Cargo',
            'Cardboard'
        ],
        'cargo.aircraft_logbook': [
            'VFR Multitool Mission Aircraft Logbook Cargo'
        ],
        'cargo.fire_extinguisher': [
            'VFR Multitool Homebase Fire Extinguisher'
        ],
        'cargo.first_aid_case': [
            'VFR Multitool Homebase First Aid Case'
        ],
        'cargo.wheel_chocks': [
            'VFR Multitool Homebase Aircraft Wheel Chocks'
        ],
        'cargo.animal_transport_box': [
            'VFR Multitool Mission Pet Carrier Cargo',
            'Cardboard',
            'Pallet01_03'
        ],
        'scene.lighting.lantern': [
            'VFR Multitool Homebase Stable Lantern'
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
        ],
        'aircraft.wreck': [
            'Cessna 172 Skyhawk (G1000)',
            'Cessna 172 Skyhawk',
            'Cessna Skyhawk G1000 Asobo',
            'Cessna Skyhawk Asobo',
            'Savage Cub Asobo',
            'VL3 Asobo',
            'Pipistrel Virus SW121 Asobo',
            'DA40-NG Asobo'
        ]
    }
};
