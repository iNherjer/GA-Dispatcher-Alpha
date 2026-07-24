'use strict';

const navigationFootprints = Object.freeze({
  'VFR Multitool Homebase Hangar': { widthM: 18, depthM: 22 },
  'VFR Multitool Homebase Round Hangar': { widthM: 25, depthM: 25 },
  'VFR Multitool Homebase Open Parking': { widthM: 18, depthM: 22 },
  'VFR Multitool Homebase Generator': { widthM: 1.6, depthM: 0.9 },
  'VFR Multitool Homebase Desk': { widthM: 1.6, depthM: 0.8 },
  'VFR Multitool Homebase Pinboard': { widthM: 1.8, depthM: 0.25 },
  'VFR Multitool Homebase Tool Cart': { widthM: 1.2, depthM: 0.7 },
  'VFR Multitool Homebase Fuel Drum': { widthM: 0.8, depthM: 0.8 },
  'VFR Multitool Homebase MX Pavilion': { widthM: 3, depthM: 3 },
  'VFR Multitool Homebase Wood Crate Small': { widthM: 0.8, depthM: 0.6 },
  'VFR Multitool Homebase Wood Crate Medium': { widthM: 1.2, depthM: 0.8 },
  'VFR Multitool Homebase Wood Crate Large': { widthM: 1.6, depthM: 1 },
  'VFR Multitool Homebase European Caravan': { widthM: 2.5, depthM: 6.5 },
  'VFR Multitool Homebase Asset Shelf': { widthM: 2, depthM: 0.7 },
  'VFR Multitool Homebase Backpack': { widthM: 0.6, depthM: 0.45 },
  'VFR Multitool Homebase Briefcase': { widthM: 0.55, depthM: 0.2 },
  'VFR Multitool Homebase Cabin Trolley': { widthM: 0.45, depthM: 0.3 },
  'VFR Multitool Homebase Daypack': { widthM: 0.55, depthM: 0.4 },
  'VFR Multitool Homebase Duffel Bag': { widthM: 0.8, depthM: 0.45 },
  'VFR Multitool Homebase Insulated Cooler': { widthM: 0.75, depthM: 0.45 },
  'VFR Multitool Homebase Jerrycan Pair': { widthM: 0.7, depthM: 0.35 },
  'VFR Multitool Homebase Mail Sack': { widthM: 0.7, depthM: 0.45 },
  'VFR Multitool Homebase Portable Toolbox': { widthM: 0.65, depthM: 0.35 },
  'VFR Multitool Homebase Toolbox': { widthM: 0.8, depthM: 0.45 },
  'VFR Multitool Homebase Travel Suitcase': { widthM: 0.55, depthM: 0.35 },
  'VFR Multitool Homebase Chair': { widthM: 0.6, depthM: 0.6 },
  'VFR Multitool Homebase Traffic Cone': { widthM: 0.4, depthM: 0.4 },
  CoffeeCup: { widthM: 0.25, depthM: 0.25 },
  Cardboard: { widthM: 1, depthM: 0.8 },
  Pallet01_01: { widthM: 1.2, depthM: 1.2 },
  Pallet01_02: { widthM: 1.2, depthM: 0.8 },
  Pallet01_03: { widthM: 0.8, depthM: 0.6 },
  Drop_Container: { widthM: 2.5, depthM: 6 },
  Microsoft_Car_EUR_01: { widthM: 2.1, depthM: 4.8 },
  Microsoft_Car_EUR_02: { widthM: 2.1, depthM: 4.8 },
  Microsoft_Car_EUR_03: { widthM: 2.1, depthM: 4.8 },
  Microsoft_Car_EUR_04: { widthM: 2.1, depthM: 4.8 },
  Microsoft_Van_EUR: { widthM: 2.4, depthM: 6 }
});
const tarmacPeople = Object.freeze([
  { title: 'Tarmac_Male_Summer_African', label: 'Tarmac-Person (männlich, Sommer, afrikanisch)' },
  { title: 'Tarmac_Male_Summer_Arab', label: 'Tarmac-Person (männlich, Sommer, arabisch)' },
  { title: 'Tarmac_Male_Summer_Asian', label: 'Tarmac-Person (männlich, Sommer, asiatisch)' },
  { title: 'Tarmac_Male_Summer_Caucasian', label: 'Tarmac-Person (männlich, Sommer, kaukasisch)' },
  { title: 'Tarmac_Male_Summer_Hispanic', label: 'Tarmac-Person (männlich, Sommer, hispanisch)' },
  { title: 'Tarmac_Male_Summer_Indian', label: 'Tarmac-Person (männlich, Sommer, indisch)' },
  { title: 'Tarmac_Male_Winter_African', label: 'Tarmac-Person (männlich, Winter, afrikanisch)' },
  { title: 'Tarmac_Male_Winter_Arab', label: 'Tarmac-Person (männlich, Winter, arabisch)' },
  { title: 'Tarmac_Male_Winter_Asian', label: 'Tarmac-Person (männlich, Winter, asiatisch)' },
  { title: 'Tarmac_Male_Winter_Caucasian', label: 'Tarmac-Person (männlich, Winter, kaukasisch)' },
  { title: 'Tarmac_Male_Winter_Hispanic', label: 'Tarmac-Person (männlich, Winter, hispanisch)' },
  { title: 'Tarmac_Male_Winter_Indian', label: 'Tarmac-Person (männlich, Winter, indisch)' },
  { title: 'Tarmac_Female_Summer_African', label: 'Tarmac-Person (weiblich, Sommer, afrikanisch)' },
  { title: 'Tarmac_Female_Summer_Arab', label: 'Tarmac-Person (weiblich, Sommer, arabisch)' },
  { title: 'Tarmac_Female_Summer_Asian', label: 'Tarmac-Person (weiblich, Sommer, asiatisch)' },
  { title: 'Tarmac_Female_Summer_Caucasian', label: 'Tarmac-Person (weiblich, Sommer, kaukasisch)' },
  { title: 'Tarmac_Female_Summer_Hispanic', label: 'Tarmac-Person (weiblich, Sommer, hispanisch)' },
  { title: 'Tarmac_Female_Summer_Indian', label: 'Tarmac-Person (weiblich, Sommer, indisch)' },
  { title: 'Tarmac_Female_Winter_African', label: 'Tarmac-Person (weiblich, Winter, afrikanisch)' },
  { title: 'Tarmac_Female_Winter_Arab', label: 'Tarmac-Person (weiblich, Winter, arabisch)' },
  { title: 'Tarmac_Female_Winter_Asian', label: 'Tarmac-Person (weiblich, Winter, asiatisch)' },
  { title: 'Tarmac_Female_Winter_Caucasian', label: 'Tarmac-Person (weiblich, Winter, kaukasisch)' },
  { title: 'Tarmac_Female_Winter_Hispanic', label: 'Tarmac-Person (weiblich, Winter, hispanisch)' },
  { title: 'Tarmac_Female_Winter_Indian', label: 'Tarmac-Person (weiblich, Winter, indisch)' }
]);
const legacyPersonTitleAliases = Object.freeze({
  Tarmac_Male_Summer_Black: 'Tarmac_Male_Summer_African'
});

function withNavigationFootprint(entry) {
  const footprint = entry.footprint || navigationFootprints[entry.title];
  return footprint ? Object.freeze({ ...entry, footprint }) : Object.freeze(entry);
}

const assets = Object.freeze([
  { key: 'hangar', folder: 'VFRHomebaseHangar', title: 'VFR Multitool Homebase Hangar', kind: 'hangar', label: 'Zelt-Hangar', headingCorrectionDeg: 0, controls: [{ schemaVersion: 1, id: 'door', type: 'animation', label: 'Zelt-Hangar Tor', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'open', durationMs: 5000, states: [{ id: 'open', label: 'Öffnen', value: 0 }, { id: 'closed', label: 'Schließen', value: 1 }] }, { schemaVersion: 1, id: 'interiorLight', type: 'light', label: 'Innenbeleuchtung', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_HANGAR_LIGHT_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'on', durationMs: 0, states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }] }], animation: { schemaVersion: 1, type: 'door', durationMs: 5000, defaultState: 'open', control: { transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'simobject', values: { open: 0, closed: 1 } } } },
  { key: 'roundHangar', folder: 'VFRHomebaseRoundHangar', title: 'VFR Multitool Homebase Round Hangar', kind: 'hangar', group: 'Hangars', label: 'Rundhangar mit Schiebetor', icon: 'H', headingCorrectionDeg: 0, homebasePlaceable: true, footprint: { widthM: 25, depthM: 25 }, vegetationExclusion: { shape: 'circle', radiusM: 17.3, falloffM: 0.5 }, controls: [{ schemaVersion: 1, id: 'door', type: 'animation', label: 'Rundhangar Tor', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'open', durationMs: 5000, states: [{ id: 'open', label: 'Öffnen', value: 0 }, { id: 'closed', label: 'Schließen', value: 1 }] }, { schemaVersion: 1, id: 'interiorLight', type: 'light', label: 'Innenbeleuchtung', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'on', durationMs: 0, states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }] }], animation: { schemaVersion: 1, type: 'door', defaultState: 'open', control: { transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', unit: 'number', scope: 'simobject', values: { open: 0, closed: 1 } } } },
  { key: 'openParking', folder: 'VFRHomebaseOpenParking', title: 'VFR Multitool Homebase Open Parking', kind: 'hangar', label: 'Offener Parkbereich', headingCorrectionDeg: 0 },
  { key: 'generator', folder: 'VFRHomebaseGenerator', title: 'VFR Multitool Homebase Generator', kind: 'object', group: 'Ausstattung', label: 'Mobiles Aggregat', icon: '⚡' },
  { key: 'desk', folder: 'VFRHomebaseDesk', title: 'VFR Multitool Homebase Desk', kind: 'object', group: 'Ausstattung', label: 'Schreibtisch', icon: 'T' },
  { key: 'pinboard', folder: 'VFRHomebasePinboard', title: 'VFR Multitool Homebase Pinboard', kind: 'object', group: 'Ausstattung', label: 'Pinnwand', icon: 'W' },
  { key: 'stableLantern', folder: 'VFRHomebaseStableLantern', title: 'VFR Multitool Homebase Stable Lantern', kind: 'object', group: 'Beleuchtung', label: 'Stalllaterne', icon: 'L', homebasePlaceable: true, workbenchVisible: true, controls: [{ schemaVersion: 1, id: 'light', type: 'light', label: 'Laternenlicht', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_STABLE_LANTERN_LIGHT_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'on', durationMs: 0, states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }] }] },
  { key: 'constructionFloodlightTripod', folder: 'VFRHomebaseConstructionFloodlightTripod', title: 'VFR Multitool Homebase Construction Floodlight Tripod', kind: 'object', group: 'Beleuchtung', label: 'Baustrahler mit Stativ', icon: 'L', version: '1.0.1', homebasePlaceable: true, workbenchVisible: true, controls: [{ schemaVersion: 1, id: 'light', type: 'light', label: 'Baustrahlerlicht', transport: 'simconnect-lvar', simvar: 'L:1:VFR_HOMEBASE_CONSTRUCTION_FLOODLIGHT_LIGHT_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'on', durationMs: 0, states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }] }] },
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
].map(withNavigationFootprint));

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
].map(withNavigationFootprint));

const definitionByTitle = new Map([
  ...assets.map((entry) => [entry.title, entry]),
  ...stockObjects.map((entry) => [entry.title, entry])
]);
const runtimeAssetsByTitle = new Map();
const legacyTitleAliases = Object.freeze({
  'VFR Multitool Homebase Windsock': 'Windsock',
  'VFR Multitool Homebase Test Hangar': 'VFR Multitool Homebase Hangar'
});

function normalizeDoorAnimation(raw) {
  if (!raw || typeof raw !== 'object' || String(raw.type || '').toLowerCase() !== 'door') return null;
  const control = raw.control && typeof raw.control === 'object' ? raw.control : raw;
  const simvar = String(control.simvar || control.variable || '').trim().toUpperCase();
  const scope = String(control.scope || 'global').toLowerCase();
  const validVariable = scope === 'simobject'
    ? /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)
    : /^L:[A-Z0-9_]{3,120}$/.test(simvar);
  if (control.transport !== 'simconnect-lvar' || !validVariable || !['global', 'simobject'].includes(scope)) return null;
  const values = control.values && typeof control.values === 'object' ? control.values : {};
  const open = Number(values.open ?? control.openValue ?? 0);
  const closed = Number(values.closed ?? control.closedValue ?? 1);
  if (!Number.isFinite(open) || !Number.isFinite(closed) || open === closed) return null;
  return Object.freeze({
    schemaVersion: 1,
    type: 'door',
    defaultState: String(raw.defaultState || 'open').toLowerCase() === 'closed' ? 'closed' : 'open',
    control: Object.freeze({
      transport: 'simconnect-lvar', simvar, unit: 'number', scope,
      values: Object.freeze({ open, closed })
    })
  });
}

function controlFromLegacyAnimation(raw) {
  const animation = normalizeDoorAnimation(raw);
  if (!animation) return null;
  return {
    schemaVersion: 1,
    id: 'door',
    type: 'animation',
    label: 'Hangartor',
    transport: animation.control.transport,
    simvar: animation.control.simvar,
    unit: 'number',
    scope: animation.control.scope,
    defaultState: animation.defaultState,
    durationMs: 5000,
    states: [
      { id: 'open', label: 'Öffnen', value: animation.control.values.open },
      { id: 'closed', label: 'Schließen', value: animation.control.values.closed }
    ]
  };
}

function normalizeControls(rawControls, legacyAnimation = null) {
  const source = Array.isArray(rawControls) && rawControls.length
    ? rawControls
    : [controlFromLegacyAnimation(legacyAnimation)].filter(Boolean);
  const ids = new Set();
  const normalized = [];
  for (const raw of source.slice(0, 12)) {
    const id = String(raw?.id || '').trim();
    const idKey = id.toLowerCase();
    const type = String(raw?.type || '').trim().toLowerCase();
    const simvar = String(raw?.simvar || '').trim().toUpperCase();
    const states = [];
    const stateIds = new Set();
    const stateValues = new Set();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id) || ids.has(idKey)) continue;
    if (!['animation', 'light'].includes(type)) continue;
    const scope = String(raw?.scope || 'global').toLowerCase();
    const validVariable = scope === 'simobject'
      ? /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)
      : /^L:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar);
    if (raw?.transport !== 'simconnect-lvar' || !validVariable || !['global', 'simobject'].includes(scope)) continue;
    for (const rawState of Array.isArray(raw?.states) ? raw.states.slice(0, 12) : []) {
      const stateId = String(rawState?.id || '').trim().toLowerCase();
      const value = Number(rawState?.value);
      if (!/^[a-z][a-z0-9_-]{0,31}$/.test(stateId) || stateIds.has(stateId) || !Number.isFinite(value) || stateValues.has(value)) continue;
      stateIds.add(stateId);
      stateValues.add(value);
      states.push(Object.freeze({ id: stateId, label: String(rawState?.label || stateId).trim().slice(0, 40), value }));
    }
    if (states.length < 2) continue;
    const defaultState = stateIds.has(String(raw?.defaultState || '').toLowerCase())
      ? String(raw.defaultState).toLowerCase()
      : states[0].id;
    ids.add(idKey);
    normalized.push(Object.freeze({
      schemaVersion: 1,
      id,
      type,
      label: String(raw?.label || id).trim().slice(0, 80),
      transport: 'simconnect-lvar',
      simvar,
      unit: 'number',
      scope,
      defaultState,
      durationMs: Math.max(0, Math.min(600000, Math.round(Number(raw?.durationMs) || 0))),
      states: Object.freeze(states)
    }));
  }
  return Object.freeze(normalized);
}

function normalizeFootprint(raw) {
  const widthM = Number(raw?.widthM);
  const depthM = Number(raw?.depthM);
  if (!Number.isFinite(widthM) || !Number.isFinite(depthM)) return null;
  if (widthM < 0.1 || widthM > 200 || depthM < 0.1 || depthM > 200) return null;
  return Object.freeze({ widthM, depthM });
}

function normalizeVegetationExclusion(raw) {
  if (!raw || String(raw.shape || '').toLowerCase() !== 'circle') return null;
  const radiusM = Number(raw.radiusM);
  const falloffM = Number(raw.falloffM);
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 250) return null;
  return Object.freeze({ shape: 'circle', radiusM, falloffM: Number.isFinite(falloffM) ? Math.max(0, Math.min(50, falloffM)) : 0.5 });
}

function normalizeCollisionProfile(raw) {
  if (!raw || !['static-model-lib', 'static-scenery-companion'].includes(String(raw.mode || ''))) return null;
  const modelLibGuid = String(raw.modelLibGuid || raw.modelGuid || '').trim().toUpperCase();
  if (!/^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/.test(modelLibGuid)) return null;
  const defaultHeightOffsetFt = Number(raw.defaultHeightOffsetFt);
  return Object.freeze({
    schemaVersion: 1,
    mode: 'static-model-lib',
    modelLibGuid,
    sourceFolder: String(raw.sourceFolder || '').trim().slice(0, 120),
    placement: String(raw.placement || 'coincident').trim().slice(0, 40),
    groundSurface: String(raw.groundSurface || '').trim().slice(0, 80),
    defaultHeightOffsetFt: Number.isFinite(defaultHeightOffsetFt) ? Math.max(-100, Math.min(100, defaultHeightOffsetFt)) : 0,
    warnOnHeightOffset: raw.warnOnHeightOffset !== false,
    driveable: raw.driveable === true || raw.groundSurface === 'continuous-terrain-apron-floor'
  });
}

function normalizeRuntimeAsset(raw) {
  const title = String(raw?.title || '').trim().slice(0, 160);
  const folder = String(raw?.folder || '').trim().slice(0, 120);
  const kind = String(raw?.kind || '').trim().toLowerCase();
  if (!title.startsWith('VFR Multitool Homebase ') || !/^VFRHomebase[A-Za-z0-9_-]+$/.test(folder)) return null;
  if (!['object', 'hangar'].includes(kind)) return null;
  const animation = normalizeDoorAnimation(raw?.animation);
  const controls = normalizeControls(raw?.controls, raw?.animation);
  const footprint = normalizeFootprint(raw?.footprint);
  const vegetationExclusion = normalizeVegetationExclusion(raw?.vegetationExclusion);
  const collisionProfile = normalizeCollisionProfile(raw?.collisionProfile);
  return Object.freeze({
    key: String(raw?.key || folder).trim().slice(0, 120),
    folder,
    title,
    kind,
    group: String(raw?.group || (kind === 'hangar' ? 'Hangars' : 'Weitere Objekte')).trim().slice(0, 80),
    label: String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).trim().slice(0, 120),
    icon: String(raw?.icon || (kind === 'hangar' ? 'H' : '◆')).trim().slice(0, 4),
    preview: raw?.preview !== false,
    workbenchVisible: raw?.workbenchVisible !== false,
    homebasePlaceable: raw?.homebasePlaceable !== false,
    ...(Number.isFinite(Number(raw?.headingCorrectionDeg))
      ? { headingCorrectionDeg: ((Number(raw.headingCorrectionDeg) % 360) + 360) % 360 }
      : {}),
    runtimeAsset: true,
    missionSpawnable: raw?.missionSpawnable === true,
    missionTags: Array.isArray(raw?.missionTags) ? raw.missionTags.map(String).slice(0, 20) : [],
    missionRoles: Array.isArray(raw?.missionRoles) ? raw.missionRoles.map(String).slice(0, 20) : [],
    ...(footprint ? { footprint } : {}),
    ...(animation ? { animation } : {}),
    ...(controls.length ? { controls } : {}),
    ...(vegetationExclusion ? { vegetationExclusion } : {}),
    ...(collisionProfile ? { collisionProfile } : {})
  });
}

function registerRuntimeAssets(entries) {
  let added = 0;
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normalizeRuntimeAsset(raw);
    if (!entry) continue;
    const existing = definitionByTitle.get(entry.title) || {};
    const mergedControls = normalizeControls([
      ...(Array.isArray(entry.controls) ? entry.controls : []),
      ...(Array.isArray(existing.controls) ? existing.controls : [])
    ], entry.animation || existing.animation);
    const merged = Object.freeze({
      ...existing,
      ...entry,
      ...(mergedControls.length ? { controls: mergedControls } : {}),
      ...(entry.animation ? { animation: entry.animation } : existing.animation ? { animation: existing.animation } : {}),
      ...(entry.footprint ? { footprint: entry.footprint } : existing.footprint ? { footprint: existing.footprint } : {}),
      ...(entry.vegetationExclusion ? { vegetationExclusion: entry.vegetationExclusion } : existing.vegetationExclusion ? { vegetationExclusion: existing.vegetationExclusion } : {}),
      ...(entry.collisionProfile ? { collisionProfile: entry.collisionProfile } : existing.collisionProfile ? { collisionProfile: existing.collisionProfile } : {})
    });
    runtimeAssetsByTitle.set(entry.title, merged);
    definitionByTitle.set(entry.title, merged);
    added += existing.runtimeAsset === true ? 0 : 1;
  }
  return added;
}

function objectDefinitionForTitle(rawTitle) {
  const requested = String(rawTitle || '').trim();
  const title = legacyTitleAliases[requested] || requested;
  return definitionByTitle.get(title) || null;
}

const catalog = Object.freeze({
  schemaVersion: 3,
  assetPackageVersion: '0.6.16',
  assetPackageName: 'vfr-multitool-homebase-assets',
  scenePackageName: 'vfr-multitool-homebase',
  assets,
  stockObjects,
  navigationFootprints,
  tarmacPeople,
  legacyPersonTitleAliases,
  legacyTitleAliases,
  registerRuntimeAssets,
  runtimeAssets: () => [...runtimeAssetsByTitle.values()],
  objectDefinitionForTitle
});

module.exports = catalog;
