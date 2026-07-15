'use strict';

const assets = Object.freeze([
  { key: 'hangar', folder: 'VFRHomebaseHangar', title: 'VFR Multitool Homebase Hangar', kind: 'hangar', label: 'Homebase-Hangar', headingCorrectionDeg: 180 },
  { key: 'openParking', folder: 'VFRHomebaseOpenParking', title: 'VFR Multitool Homebase Open Parking', kind: 'hangar', label: 'Offener Parkbereich', headingCorrectionDeg: 180 },
  { key: 'generator', folder: 'VFRHomebaseGenerator', title: 'VFR Multitool Homebase Generator', kind: 'object', group: 'Ausstattung', label: 'Mobiles Aggregat', icon: '⚡' },
  { key: 'desk', folder: 'VFRHomebaseDesk', title: 'VFR Multitool Homebase Desk', kind: 'object', group: 'Ausstattung', label: 'Schreibtisch', icon: 'T' },
  { key: 'pinboard', folder: 'VFRHomebasePinboard', title: 'VFR Multitool Homebase Pinboard', kind: 'object', group: 'Ausstattung', label: 'Pinnwand', icon: 'W' },
  { key: 'toolCart', folder: 'VFRHomebaseToolCart', title: 'VFR Multitool Homebase Tool Cart', kind: 'object', group: 'Ausstattung', label: 'Werkzeugwagen', icon: 'R', missionSpawnable: true, missionTags: ['cargo', 'tools', 'maintenance'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'fuelDrum', folder: 'VFRHomebaseFuelDrum', title: 'VFR Multitool Homebase Fuel Drum', kind: 'object', group: 'Ausstattung', label: 'Treibstofffass mit Handpumpe', icon: 'F' },
  { key: 'mxPavilion', folder: 'VFRHomebaseMXPavilion', title: 'VFR Multitool Homebase MX Pavilion', kind: 'object', group: 'Ausstattung', label: 'MX24 Pavillon 3 x 3 m', icon: 'P' },
  { key: 'woodCrateSmall', folder: 'VFRHomebaseWoodCrateSmall', title: 'VFR Multitool Homebase Wood Crate Small', kind: 'object', group: 'Ausstattung', label: 'Holzkiste klein', icon: 'K', missionSpawnable: true, missionTags: ['cargo', 'freight', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'woodCrateMedium', folder: 'VFRHomebaseWoodCrateMedium', title: 'VFR Multitool Homebase Wood Crate Medium', kind: 'object', group: 'Ausstattung', label: 'Holzkiste mittel', icon: 'K', missionSpawnable: true, missionTags: ['cargo', 'freight', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'woodCrateLarge', folder: 'VFRHomebaseWoodCrateLarge', title: 'VFR Multitool Homebase Wood Crate Large', kind: 'object', group: 'Ausstattung', label: 'Holzkiste groß', icon: 'K', missionSpawnable: true, missionTags: ['cargo', 'freight', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'europeanCaravan', folder: 'VFRHomebaseEuropeanCaravan', title: 'VFR Multitool Homebase European Caravan', kind: 'object', group: 'Ausstattung', label: 'Wohnwagen (einachsig)', icon: 'W' },
  { key: 'assetShelf', folder: 'VFRHomebaseAssetShelf', title: 'VFR Multitool Homebase Asset Shelf', kind: 'object', group: 'Ausstattung', label: 'Asset-Regal', icon: 'R' },
  { key: 'backpack', folder: 'VFRHomebaseBackpack', title: 'VFR Multitool Homebase Backpack', kind: 'object', group: 'Gepäck & Fracht', label: 'Rucksack', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'passenger', 'travel', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'briefcase', folder: 'VFRHomebaseBriefcase', title: 'VFR Multitool Homebase Briefcase', kind: 'object', group: 'Gepäck & Fracht', label: 'Briefcase', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'cabin-trolley', folder: 'VFRHomebaseCabinTrolley', title: 'VFR Multitool Homebase Cabin Trolley', kind: 'object', group: 'Gepäck & Fracht', label: 'Cabin Trolley', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'daypack', folder: 'VFRHomebaseDaypack', title: 'VFR Multitool Homebase Daypack', kind: 'object', group: 'Gepäck & Fracht', label: 'Tagesrucksack', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'outdoor', 'personal'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'duffelBag', folder: 'VFRHomebaseDuffelBag', title: 'VFR Multitool Homebase Duffel Bag', kind: 'object', group: 'Gepäck & Fracht', label: 'Duffelbag / Reisetasche', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'charter', 'outdoor'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'insulatedCooler', folder: 'VFRHomebaseInsulatedCooler', title: 'VFR Multitool Homebase Insulated Cooler', kind: 'object', group: 'Gepäck & Fracht', label: 'Isolierte Kühlbox', icon: 'C', missionSpawnable: true, missionTags: ['cargo', 'cooler', 'medical', 'samples', 'outdoor'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'jerrycanPair', folder: 'VFRHomebaseJerrycanPair', title: 'VFR Multitool Homebase Jerrycan Pair', kind: 'object', group: 'Ausstattung', label: 'Kanister-Doppelpack', icon: 'F', missionSpawnable: true, missionTags: ['cargo', 'fuel', 'supply', 'bush', 'maintenance'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'mailSack', folder: 'VFRHomebaseMailSack', title: 'VFR Multitool Homebase Mail Sack', kind: 'object', group: 'Fracht', label: 'Postsack', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'mail', 'delivery', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'portableToolbox', folder: 'VFRHomebasePortableToolbox', title: 'VFR Multitool Homebase Portable Toolbox', kind: 'object', group: 'Ausstattung', label: 'Tragbare Werkzeugkiste', icon: 'R', missionSpawnable: true, missionTags: ['cargo', 'tools', 'maintenance', 'club', 'bush'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'toolbox', folder: 'VFRHomebaseToolbox', title: 'VFR Multitool Homebase Toolbox', kind: 'object', group: 'Fracht', label: 'Werkzeugkiste', icon: 'R', missionSpawnable: true, missionTags: ['cargo', 'tools', 'maintenance', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'travel-suitcase', folder: 'VFRHomebaseTravelSuitcase', title: 'VFR Multitool Homebase Travel Suitcase', kind: 'object', group: 'Gepäck & Fracht', label: 'Travel Suitcase', icon: 'G', missionSpawnable: true, missionTags: ['cargo', 'luggage', 'supplies'], missionRoles: ['cargo', 'scene-prop'], homebasePlaceable: true },
  { key: 'chair', folder: 'VFRHomebaseChair', title: 'VFR Multitool Homebase Chair', kind: 'object', group: 'Ausstattung', label: 'Stuhl', icon: 'S' },
  { key: 'trafficCone', folder: 'VFRHomebaseTrafficCone', title: 'VFR Multitool Homebase Traffic Cone', kind: 'object', group: 'Flugplatz', label: 'Traffic Cone', icon: 'K' },
  { key: 'spawnProbe', folder: 'VFRHomebaseSpawnProbe', title: 'VFR Multitool Homebase Spawn Probe', kind: 'internal', label: 'Gelber Spawnpunkt-Messkegel', persistent: false },
  { key: 'customWindsock', folder: 'VFRHomebaseWindsock', title: 'VFR Multitool Homebase Windsock', kind: 'internal', preview: false }
]);

const stockObjects = Object.freeze([
  { title: 'CoffeeCup', group: 'Ausstattung', label: 'Kaffeebecher', icon: '☕' },
  { title: 'Windsock', group: 'Flugplatz', label: 'Windsack (nur Paket)', icon: 'F', persistentOnly: true, preview: false },
  { title: 'Cardboard', group: 'Fracht', label: 'Karton', icon: '▣', groundClearanceFt: 0.30, liveGroundStabilization: true },
  { title: 'Pallet01_01', group: 'Fracht', label: 'Palette groß', icon: 'P', groundClearanceFt: 0.08, liveGroundStabilization: true, lowResAltitude: true },
  { title: 'Pallet01_02', group: 'Fracht', label: 'Palette mittel', icon: 'P', groundClearanceFt: 0.08, liveGroundStabilization: true, lowResAltitude: true },
  { title: 'Pallet01_03', group: 'Fracht', label: 'Palette klein', icon: 'P', groundClearanceFt: 0.08, liveGroundStabilization: true, lowResAltitude: true },
  { title: 'Drop_Container', group: 'Fracht', label: 'Frachtcontainer', icon: 'C' },
  { title: 'Microsoft_Car_EUR_01', group: 'Fahrzeuge', label: 'Pkw Europa 1', icon: 'A', parkedVehicle: true },
  { title: 'Microsoft_Car_EUR_02', group: 'Fahrzeuge', label: 'Pkw Europa 2', icon: 'A', parkedVehicle: true },
  { title: 'Microsoft_Car_EUR_03', group: 'Fahrzeuge', label: 'Pkw Europa 3', icon: 'A', parkedVehicle: true },
  { title: 'Microsoft_Car_EUR_04', group: 'Fahrzeuge', label: 'Pkw Europa 4', icon: 'A', parkedVehicle: true },
  { title: 'Microsoft_Van_EUR', group: 'Fahrzeuge', label: 'Van Europa', icon: 'V', parkedVehicle: true }
]);

const definitionByTitle = new Map([
  ...assets.map((entry) => [entry.title, entry]),
  ...stockObjects.map((entry) => [entry.title, entry])
]);
const runtimeAssetsByTitle = new Map();
const legacyTitleAliases = Object.freeze({
  'VFR Multitool Homebase Windsock': 'Windsock',
  'VFR Multitool Homebase Test Hangar': 'VFR Multitool Homebase Hangar'
});

function normalizeRuntimeAsset(raw) {
  const title = String(raw?.title || '').trim().slice(0, 160);
  const folder = String(raw?.folder || '').trim().slice(0, 120);
  const kind = String(raw?.kind || '').trim().toLowerCase();
  if (!title.startsWith('VFR Multitool Homebase ') || !/^VFRHomebase[A-Za-z0-9_-]+$/.test(folder)) return null;
  if (!['object', 'hangar'].includes(kind)) return null;
  return Object.freeze({
    key: String(raw?.key || folder).trim().slice(0, 120),
    folder,
    title,
    kind,
    group: String(raw?.group || (kind === 'hangar' ? 'Hangars' : 'Weitere Objekte')).trim().slice(0, 80),
    label: String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).trim().slice(0, 120),
    icon: String(raw?.icon || (kind === 'hangar' ? 'H' : '◆')).trim().slice(0, 4),
    preview: raw?.preview !== false,
    workbenchVisible: raw?.workbenchVisible !== false && raw?.homebasePlaceable !== false,
    homebasePlaceable: raw?.homebasePlaceable !== false,
    runtimeAsset: true,
    missionSpawnable: raw?.missionSpawnable === true,
    missionTags: Array.isArray(raw?.missionTags) ? raw.missionTags.map(String).slice(0, 20) : [],
    missionRoles: Array.isArray(raw?.missionRoles) ? raw.missionRoles.map(String).slice(0, 20) : []
  });
}

function registerRuntimeAssets(entries) {
  let added = 0;
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normalizeRuntimeAsset(raw);
    if (!entry || definitionByTitle.has(entry.title)) continue;
    runtimeAssetsByTitle.set(entry.title, entry);
    definitionByTitle.set(entry.title, entry);
    added += 1;
  }
  return added;
}

function objectDefinitionForTitle(rawTitle) {
  const requested = String(rawTitle || '').trim();
  const title = legacyTitleAliases[requested] || requested;
  return definitionByTitle.get(title) || null;
}

const catalog = Object.freeze({
  schemaVersion: 2,
  assetPackageVersion: '0.6.2',
  assetPackageName: 'vfr-multitool-homebase-assets',
  scenePackageName: 'vfr-multitool-homebase',
  assets,
  stockObjects,
  legacyTitleAliases,
  registerRuntimeAssets,
  runtimeAssets: () => [...runtimeAssetsByTitle.values()],
  objectDefinitionForTitle
});

module.exports = catalog;
