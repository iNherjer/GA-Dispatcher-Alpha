(function publishHomebaseAssetCatalog(root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  if (root) root.HOMEBASE_ASSET_CATALOG = catalog;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCatalog() {
  'use strict';

  return Object.freeze({
    schemaVersion: 1,
    assetPackageVersion: '0.6.4',
    assetPackageName: 'vfr-multitool-homebase-assets',
    assets: Object.freeze([
      { key: 'hangar', folder: 'VFRHomebaseHangar', title: 'VFR Multitool Homebase Hangar', kind: 'hangar', label: 'Homebase-Hangar', headingCorrectionDeg: 180 },
      { key: 'openParking', folder: 'VFRHomebaseOpenParking', title: 'VFR Multitool Homebase Open Parking', kind: 'hangar', label: 'Offener Parkbereich', headingCorrectionDeg: 180 },
      {
        key: 'roundHangar', folder: 'VFRHomebaseRoundHangar', title: 'VFR Multitool Homebase Round Hangar', kind: 'hangar', group: 'Hangars', label: 'Rundhangar mit Schiebetor', icon: 'H',
        version: '1.0.2', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: false, missionTags: ['homebase', 'hangar', 'shelter'], missionRoles: ['scene-prop'],
        footprint: { widthM: 25, depthM: 25 }, headingCorrectionDeg: 0,
        controls: [
          { schemaVersion: 1, id: 'door', type: 'animation', label: 'Rundhangar Tor', transport: 'simconnect-lvar', simvar: 'L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'global', defaultState: 'open', durationMs: 5000, states: [{ id: 'open', label: 'Öffnen', value: 0 }, { id: 'closed', label: 'Schließen', value: 1 }] },
          { schemaVersion: 1, id: 'interiorLight', type: 'light', label: 'Innenbeleuchtung', transport: 'simconnect-lvar', simvar: 'L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND', unit: 'number', scope: 'global', defaultState: 'on', states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }] }
        ],
        animation: { schemaVersion: 1, type: 'door', durationMs: 5000, control: { transport: 'simconnect-lvar', simvar: 'L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'global', values: { open: 0, closed: 1 } }, defaultState: 'open' },
        collisionProfile: { schemaVersion: 1, mode: 'static-model-lib', modelLibGuid: '{B90D5EAB-0F9C-4A2A-9917-F57D81E3A24C}', sourceFolder: 'VFRHomebaseRoundHangarCollision', placement: 'coincident', groundSurface: 'walls-and-columns-only', belowGradeExtensionM: 1.5, collidesWith: ['walls', 'columns'], floorCollision: false, defaultHeightOffsetFt: 0, warnOnHeightOffset: true }
      },
      { key: 'generator', folder: 'VFRHomebaseGenerator', title: 'VFR Multitool Homebase Generator', kind: 'object', group: 'Ausstattung', label: 'Mobiles Aggregat', icon: '⚡' },
      { key: 'desk', folder: 'VFRHomebaseDesk', title: 'VFR Multitool Homebase Desk', kind: 'object', group: 'Ausstattung', label: 'Schreibtisch', icon: 'T' },
      { key: 'pinboard', folder: 'VFRHomebasePinboard', title: 'VFR Multitool Homebase Pinboard', kind: 'object', group: 'Ausstattung', label: 'Pinnwand', icon: 'W' },
      { key: 'toolCart', folder: 'VFRHomebaseToolCart', title: 'VFR Multitool Homebase Tool Cart', kind: 'object', group: 'Ausstattung', label: 'Werkzeugwagen', icon: 'R' },
      { key: 'fuelDrum', folder: 'VFRHomebaseFuelDrum', title: 'VFR Multitool Homebase Fuel Drum', kind: 'object', group: 'Ausstattung', label: 'Treibstofffass mit Handpumpe', icon: 'F' },
      { key: 'mxPavilion', folder: 'VFRHomebaseMXPavilion', title: 'VFR Multitool Homebase MX Pavilion', kind: 'object', group: 'Ausstattung', label: 'MX24 Pavillon 3 x 3 m', icon: 'P' },
      { key: 'woodCrateSmall', folder: 'VFRHomebaseWoodCrateSmall', title: 'VFR Multitool Homebase Wood Crate Small', kind: 'object', group: 'Ausstattung', label: 'Holzkiste klein', icon: 'K' },
      { key: 'woodCrateMedium', folder: 'VFRHomebaseWoodCrateMedium', title: 'VFR Multitool Homebase Wood Crate Medium', kind: 'object', group: 'Ausstattung', label: 'Holzkiste mittel', icon: 'K' },
      { key: 'woodCrateLarge', folder: 'VFRHomebaseWoodCrateLarge', title: 'VFR Multitool Homebase Wood Crate Large', kind: 'object', group: 'Ausstattung', label: 'Holzkiste groß', icon: 'K' },
      { key: 'briefcase', folder: 'VFRHomebaseBriefcase', title: 'VFR Multitool Homebase Briefcase', kind: 'object', group: 'Fracht', label: 'Aktenkoffer', icon: 'K', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'passenger', 'travel'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'cabinTrolley', folder: 'VFRHomebaseCabinTrolley', title: 'VFR Multitool Homebase Cabin Trolley', kind: 'object', group: 'Fracht', label: 'Trolley klein', icon: 'K', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'passenger', 'travel'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'travelSuitcase', folder: 'VFRHomebaseTravelSuitcase', title: 'VFR Multitool Homebase Travel Suitcase', kind: 'object', group: 'Fracht', label: 'Reisekoffer groÃŸ', icon: 'K', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'passenger', 'travel'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'mailSack', folder: 'VFRHomebaseMailSack', title: 'VFR Multitool Homebase Mail Sack', kind: 'object', group: 'Fracht', label: 'Postsack (zugebunden)', icon: 'P', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'mail', 'delivery', 'supplies'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'backpack', folder: 'VFRHomebaseBackpack', title: 'VFR Multitool Homebase Backpack', kind: 'object', group: 'Fracht', label: 'Rucksack', icon: 'R', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'passenger', 'travel', 'supplies'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'toolbox', folder: 'VFRHomebaseToolbox', title: 'VFR Multitool Homebase Toolbox', kind: 'object', group: 'Fracht', label: 'Werkzeugkiste', icon: 'W', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'tools', 'maintenance', 'supplies'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'daypack', folder: 'VFRHomebaseDaypack', title: 'VFR Multitool Homebase Daypack', kind: 'object', group: 'Gepäck & Fracht', label: 'Tagesrucksack', icon: 'G', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'outdoor', 'personal'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'duffelBag', folder: 'VFRHomebaseDuffelBag', title: 'VFR Multitool Homebase Duffel Bag', kind: 'object', group: 'Gepäck & Fracht', label: 'Duffelbag / Reisetasche', icon: 'G', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'luggage', 'charter', 'outdoor'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'portableToolbox', folder: 'VFRHomebasePortableToolbox', title: 'VFR Multitool Homebase Portable Toolbox', kind: 'object', group: 'Ausstattung', label: 'Tragbare Werkzeugkiste', icon: 'R', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'tools', 'maintenance', 'club', 'bush'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'jerrycanPair', folder: 'VFRHomebaseJerrycanPair', title: 'VFR Multitool Homebase Jerrycan Pair', kind: 'object', group: 'Ausstattung', label: 'Kanister-Doppelpack', icon: 'F', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'fuel', 'supply', 'bush', 'maintenance'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'insulatedCooler', folder: 'VFRHomebaseInsulatedCooler', title: 'VFR Multitool Homebase Insulated Cooler', kind: 'object', group: 'Gepäck & Fracht', label: 'Isolierte Kühlbox', icon: 'C', version: '1.0.0', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['cargo', 'cooler', 'medical', 'samples', 'outdoor'], missionRoles: ['cargo', 'scene-prop'] },
      { key: 'europeanCaravan', folder: 'VFRHomebaseEuropeanCaravan', title: 'VFR Multitool Homebase European Caravan', kind: 'object', group: 'Ausstattung', label: 'Wohnwagen (einachsig)', icon: 'W' },
      { key: 'assetShelf', folder: 'VFRHomebaseAssetShelf', title: 'VFR Multitool Homebase Asset Shelf', kind: 'object', group: 'Ausstattung', label: 'Asset-Regal (Eimer, Ölkanne, Kartons)', icon: 'R', version: '1.0.1', homebasePlaceable: true, workbenchVisible: true, missionSpawnable: true, missionTags: ['tools', 'supplies', 'maintenance'], missionRoles: ['scene-prop'] },
      { key: 'chair', folder: 'VFRHomebaseChair', title: 'VFR Multitool Homebase Chair', kind: 'object', group: 'Ausstattung', label: 'Stuhl', icon: 'S' },
      { key: 'trafficCone', folder: 'VFRHomebaseTrafficCone', title: 'VFR Multitool Homebase Traffic Cone', kind: 'object', group: 'Flugplatz', label: 'Traffic Cone', icon: 'K' },
      { key: 'spawnProbe', folder: 'VFRHomebaseSpawnProbe', title: 'VFR Multitool Homebase Spawn Probe', kind: 'internal', label: 'Gelber Spawnpunkt-Messkegel' },
      { key: 'customWindsock', folder: 'VFRHomebaseWindsock', title: 'VFR Multitool Homebase Windsock', kind: 'internal', preview: false }
    ]),
    stockObjects: Object.freeze([
      { title: 'CoffeeCup', group: 'Ausstattung', label: 'Kaffeebecher', icon: '☕' },
      { title: 'Windsock', group: 'Flugplatz', label: 'Windsack (nur Paket)', icon: 'F', persistentOnly: true, preview: false },
      { title: 'Cardboard', group: 'Fracht', label: 'Karton', icon: '▣' },
      { title: 'Pallet01_01', group: 'Fracht', label: 'Palette groß', icon: 'P' },
      { title: 'Pallet01_02', group: 'Fracht', label: 'Palette mittel', icon: 'P' },
      { title: 'Pallet01_03', group: 'Fracht', label: 'Palette klein', icon: 'P' },
      { title: 'Drop_Container', group: 'Fracht', label: 'Frachtcontainer', icon: 'C' },
      { title: 'Microsoft_Car_EUR_01', group: 'Fahrzeuge', label: 'Pkw Europa 1', icon: 'A' },
      { title: 'Microsoft_Car_EUR_02', group: 'Fahrzeuge', label: 'Pkw Europa 2', icon: 'A' },
      { title: 'Microsoft_Car_EUR_03', group: 'Fahrzeuge', label: 'Pkw Europa 3', icon: 'A' },
      { title: 'Microsoft_Car_EUR_04', group: 'Fahrzeuge', label: 'Pkw Europa 4', icon: 'A' },
      { title: 'Microsoft_Van_EUR', group: 'Fahrzeuge', label: 'Van Europa', icon: 'V' }
    ]),
    legacyTitleAliases: Object.freeze({ 'VFR Multitool Homebase Windsock': 'Windsock' })
  });
}));
