// pbf-region-registry.mjs
// Geofabrik PBF region registry for the obstacle tile workbench.
// Regions are grouped by continent, but also exported as a flat REGIONS list
// for compatibility with existing callers.
// Exports: REGIONS_BY_CONTINENT, REGIONS, tileBoundsFromKey(), findRegionsForTile()

const BASE = 'https://download.geofabrik.de';
const TILE_STEP_DEG = 25 / 60;

function region(continent, entry) {
  return { continent, ...entry };
}

function usState(code, name, bbox, sizeMb, slug) {
  return region('north_america', {
    id: `us-${code}`,
    name,
    bbox,
    sizeMb,
    url: `${BASE}/north-america/us/${slug}-latest.osm.pbf`
  });
}

export const REGIONS_BY_CONTINENT = {
  europe: [
    // ── German Bundesländer (state-level, preferred over full country) ───────
    region('europe', { id: 'de-bw', name: 'Baden-Württemberg',      bbox: [47.53,  7.51, 49.80, 10.50], sizeMb:  500, url: `${BASE}/europe/germany/baden-wuerttemberg-latest.osm.pbf` }),
    region('europe', { id: 'de-by', name: 'Bayern',                 bbox: [47.27,  8.98, 50.57, 13.84], sizeMb: 1200, url: `${BASE}/europe/germany/bayern-latest.osm.pbf` }),
    region('europe', { id: 'de-be', name: 'Berlin',                 bbox: [52.34, 13.09, 52.68, 13.76], sizeMb:   25, url: `${BASE}/europe/germany/berlin-latest.osm.pbf` }),
    region('europe', { id: 'de-bb', name: 'Brandenburg',            bbox: [51.36, 11.27, 53.56, 14.77], sizeMb:  130, url: `${BASE}/europe/germany/brandenburg-latest.osm.pbf` }),
    region('europe', { id: 'de-hb', name: 'Bremen',                 bbox: [52.85,  8.48, 53.61,  9.01], sizeMb:    7, url: `${BASE}/europe/germany/bremen-latest.osm.pbf` }),
    region('europe', { id: 'de-hh', name: 'Hamburg',                bbox: [53.40,  8.42, 53.96, 10.33], sizeMb:   20, url: `${BASE}/europe/germany/hamburg-latest.osm.pbf` }),
    region('europe', { id: 'de-he', name: 'Hessen',                 bbox: [49.39,  7.77, 51.66, 10.24], sizeMb:  200, url: `${BASE}/europe/germany/hessen-latest.osm.pbf` }),
    region('europe', { id: 'de-mv', name: 'Mecklenburg-Vorpommern', bbox: [53.11, 10.59, 54.69, 14.41], sizeMb:  100, url: `${BASE}/europe/germany/mecklenburg-vorpommern-latest.osm.pbf` }),
    region('europe', { id: 'de-ni', name: 'Niedersachsen',          bbox: [51.29,  6.65, 53.90, 11.60], sizeMb:  400, url: `${BASE}/europe/germany/niedersachsen-latest.osm.pbf` }),
    region('europe', { id: 'de-nw', name: 'Nordrhein-Westfalen',    bbox: [50.32,  5.86, 52.53,  9.46], sizeMb:  700, url: `${BASE}/europe/germany/nordrhein-westfalen-latest.osm.pbf` }),
    region('europe', { id: 'de-rp', name: 'Rheinland-Pfalz',        bbox: [48.97,  6.11, 50.94,  8.51], sizeMb:  200, url: `${BASE}/europe/germany/rheinland-pfalz-latest.osm.pbf` }),
    region('europe', { id: 'de-sl', name: 'Saarland',               bbox: [49.11,  6.36, 49.64,  7.40], sizeMb:   25, url: `${BASE}/europe/germany/saarland-latest.osm.pbf` }),
    region('europe', { id: 'de-sn', name: 'Sachsen',                bbox: [50.17, 11.87, 51.68, 15.04], sizeMb:  200, url: `${BASE}/europe/germany/sachsen-latest.osm.pbf` }),
    region('europe', { id: 'de-st', name: 'Sachsen-Anhalt',         bbox: [51.04, 10.56, 53.04, 13.19], sizeMb:  130, url: `${BASE}/europe/germany/sachsen-anhalt-latest.osm.pbf` }),
    region('europe', { id: 'de-sh', name: 'Schleswig-Holstein',     bbox: [53.36,  7.87, 55.06, 11.31], sizeMb:  120, url: `${BASE}/europe/germany/schleswig-holstein-latest.osm.pbf` }),
    region('europe', { id: 'de-th', name: 'Thüringen',              bbox: [50.20,  9.86, 51.65, 12.65], sizeMb:  130, url: `${BASE}/europe/germany/thueringen-latest.osm.pbf` }),

    // ── Adjacent / European countries ────────────────────────────────────────
    region('europe', { id: 'at', name: 'Austria',                bbox: [46.37,  9.53, 49.02, 17.16], sizeMb:  600, url: `${BASE}/europe/austria-latest.osm.pbf` }),
    region('europe', { id: 'ch', name: 'Switzerland',            bbox: [45.82,  5.96, 47.81, 10.49], sizeMb:  250, url: `${BASE}/europe/switzerland-latest.osm.pbf` }),
    region('europe', { id: 'be', name: 'Belgium',                bbox: [49.50,  2.55, 51.50,  6.41], sizeMb:  200, url: `${BASE}/europe/belgium-latest.osm.pbf` }),
    region('europe', { id: 'lu', name: 'Luxembourg',             bbox: [49.44,  5.74, 50.19,  6.53], sizeMb:   15, url: `${BASE}/europe/luxembourg-latest.osm.pbf` }),
    region('europe', { id: 'nl', name: 'Netherlands',            bbox: [50.75,  3.36, 53.55,  7.23], sizeMb:  130, url: `${BASE}/europe/netherlands-latest.osm.pbf` }),
    region('europe', { id: 'cz', name: 'Czech Republic',         bbox: [48.55, 12.09, 51.06, 18.87], sizeMb:  400, url: `${BASE}/europe/czech-republic-latest.osm.pbf` }),
    region('europe', { id: 'sk', name: 'Slovakia',               bbox: [47.73, 16.83, 49.61, 22.56], sizeMb:  100, url: `${BASE}/europe/slovakia-latest.osm.pbf` }),
    region('europe', { id: 'hu', name: 'Hungary',                bbox: [45.74, 16.11, 48.58, 22.90], sizeMb:  300, url: `${BASE}/europe/hungary-latest.osm.pbf` }),
    region('europe', { id: 'si', name: 'Slovenia',               bbox: [45.42, 13.38, 46.88, 16.61], sizeMb:   60, url: `${BASE}/europe/slovenia-latest.osm.pbf` }),
    region('europe', { id: 'hr', name: 'Croatia',                bbox: [42.38, 13.49, 46.55, 19.45], sizeMb:  150, url: `${BASE}/europe/croatia-latest.osm.pbf` }),
    region('europe', { id: 'pl', name: 'Poland',                 bbox: [49.00, 14.12, 54.84, 24.15], sizeMb: 1400, url: `${BASE}/europe/poland-latest.osm.pbf` }),
    region('europe', { id: 'dk', name: 'Denmark',                bbox: [54.56,  8.07, 57.75, 15.20], sizeMb:  100, url: `${BASE}/europe/denmark-latest.osm.pbf` }),
    region('europe', { id: 'fr-ge', name: 'France/Lorraine',      bbox: [47.40,  5.90, 49.52,  8.24], sizeMb:  170, url: `${BASE}/europe/france/lorraine-latest.osm.pbf` }),
    region('europe', { id: 'fr-bfc', name: 'France/Franche-Comte', bbox: [46.23,  5.36, 48.40,  7.09], sizeMb:  122, url: `${BASE}/europe/france/franche-comte-latest.osm.pbf` }),
    region('europe', { id: 'it', name: 'Italy',                  bbox: [36.62,  6.62, 47.09, 18.52], sizeMb: 1500, url: `${BASE}/europe/italy-latest.osm.pbf` }),
    region('europe', { id: 'es', name: 'Spain',                  bbox: [35.95, -9.39, 43.79,  4.33], sizeMb: 1200, url: `${BASE}/europe/spain-latest.osm.pbf` }),
    region('europe', { id: 'pt', name: 'Portugal',               bbox: [36.96, -9.50, 42.15, -6.19], sizeMb:  200, url: `${BASE}/europe/portugal-latest.osm.pbf` }),
    region('europe', { id: 'gb', name: 'Great Britain',          bbox: [49.87, -7.57, 58.64,  1.76], sizeMb: 1500, url: `${BASE}/europe/great-britain-latest.osm.pbf` }),
    region('europe', { id: 'ie', name: 'Ireland',                bbox: [51.42,-10.48, 55.43, -5.34], sizeMb:  100, url: `${BASE}/europe/ireland-and-northern-ireland-latest.osm.pbf` }),
    region('europe', { id: 'se', name: 'Sweden',                 bbox: [55.34, 11.12, 69.06, 24.16], sizeMb:  400, url: `${BASE}/europe/sweden-latest.osm.pbf` }),
    region('europe', { id: 'no', name: 'Norway',                 bbox: [57.97,  4.65, 71.19, 31.23], sizeMb:  300, url: `${BASE}/europe/norway-latest.osm.pbf` }),
    region('europe', { id: 'fi', name: 'Finland',                bbox: [59.81, 20.55, 70.09, 31.59], sizeMb:  250, url: `${BASE}/europe/finland-latest.osm.pbf` }),
    region('europe', { id: 'ro', name: 'Romania',                bbox: [43.62, 20.26, 48.27, 30.02], sizeMb:  400, url: `${BASE}/europe/romania-latest.osm.pbf` }),
    region('europe', { id: 'rs', name: 'Serbia',                 bbox: [41.85, 18.82, 46.19, 23.01], sizeMb:  150, url: `${BASE}/europe/serbia-latest.osm.pbf` }),
    region('europe', { id: 'ba', name: 'Bosnia-Herzegovina',     bbox: [42.56, 15.72, 45.28, 19.62], sizeMb:   80, url: `${BASE}/europe/bosnia-herzegovina-latest.osm.pbf` }),
    region('europe', { id: 'bg', name: 'Bulgaria',               bbox: [41.24, 22.36, 44.22, 28.61], sizeMb:  200, url: `${BASE}/europe/bulgaria-latest.osm.pbf` }),
    region('europe', { id: 'gr', name: 'Greece',                 bbox: [34.80, 19.37, 41.75, 29.65], sizeMb:  250, url: `${BASE}/europe/greece-latest.osm.pbf` }),
    region('europe', { id: 'ua', name: 'Ukraine',                bbox: [44.39, 22.13, 52.38, 40.22], sizeMb:  600, url: `${BASE}/europe/ukraine-latest.osm.pbf` }),
    region('europe', { id: 'ee', name: 'Estonia',                bbox: [57.51, 21.83, 59.68, 28.21], sizeMb:   60, url: `${BASE}/europe/estonia-latest.osm.pbf` }),
    region('europe', { id: 'lv', name: 'Latvia',                 bbox: [55.67, 20.97, 57.97, 28.24], sizeMb:   60, url: `${BASE}/europe/latvia-latest.osm.pbf` }),
    region('europe', { id: 'lt', name: 'Lithuania',              bbox: [53.89, 20.94, 56.45, 26.84], sizeMb:   80, url: `${BASE}/europe/lithuania-latest.osm.pbf` }),
    region('europe', { id: 'me', name: 'Montenegro',             bbox: [41.85, 18.44, 43.56, 20.36], sizeMb:   25, url: `${BASE}/europe/montenegro-latest.osm.pbf` }),
    region('europe', { id: 'mk', name: 'N.Macedonia',            bbox: [40.85, 20.45, 42.37, 23.03], sizeMb:   40, url: `${BASE}/europe/macedonia-latest.osm.pbf` }),
    region('europe', { id: 'al', name: 'Albania',                bbox: [39.64, 19.27, 42.66, 21.06], sizeMb:   40, url: `${BASE}/europe/albania-latest.osm.pbf` }),
    region('europe', { id: 'cy', name: 'Cyprus',                 bbox: [34.63, 32.27, 35.71, 34.59], sizeMb:   30, url: `${BASE}/europe/cyprus-latest.osm.pbf` }),
    region('europe', { id: 'is', name: 'Iceland',                bbox: [63.38,-24.55, 66.55,-13.50], sizeMb:   50, url: `${BASE}/europe/iceland-latest.osm.pbf` })
  ],

  north_america: [
    // ── USA state extracts (grouped for workbench clarity) ──────────────────
    usState('ak', 'Alaska',               [51.20, -179.20, 71.70, -129.90], 220, 'alaska'),
    usState('al', 'Alabama',              [30.10,  -88.60, 35.10,  -84.80], 140, 'alabama'),
    usState('ar', 'Arkansas',             [33.00,  -94.70, 36.60,  -89.60], 110, 'arkansas'),
    usState('az', 'Arizona',              [31.20, -114.90, 37.10, -108.90], 160, 'arizona'),
    usState('ca', 'California',           [32.30, -124.70, 42.10, -114.00], 900, 'california'),
    usState('co', 'Colorado',             [36.90, -109.20, 41.10, -102.00], 180, 'colorado'),
    usState('ct', 'Connecticut',          [40.90,  -73.80, 42.10,  -71.70],  55, 'connecticut'),
    usState('de', 'Delaware',             [38.30,  -75.90, 39.90,  -75.00],  20, 'delaware'),
    usState('fl', 'Florida',              [24.30,  -87.80, 31.20,  -79.80], 420, 'florida'),
    usState('ga', 'Georgia',              [30.30,  -85.70, 35.10,  -80.70], 220, 'georgia'),
    usState('hi', 'Hawaii',               [18.80, -160.50, 22.50, -154.70],  45, 'hawaii'),
    usState('ia', 'Iowa',                 [40.30,  -96.70, 43.60,  -90.00], 100, 'iowa'),
    usState('id', 'Idaho',                [41.95, -117.30, 49.05, -111.00], 125, 'idaho'),
    usState('il', 'Illinois',             [36.80,  -91.70, 42.60,  -87.00], 260, 'illinois'),
    usState('in', 'Indiana',              [37.70,  -88.20, 41.90,  -84.60], 120, 'indiana'),
    usState('ks', 'Kansas',               [36.90, -102.10, 40.10,  -94.50], 120, 'kansas'),
    usState('ky', 'Kentucky',             [36.40,  -89.80, 39.30,  -81.90], 130, 'kentucky'),
    usState('la', 'Louisiana',            [28.80,  -94.10, 33.20,  -88.70], 130, 'louisiana'),
    usState('ma', 'Massachusetts',        [41.10,  -73.60, 42.95,  -69.80],  95, 'massachusetts'),
    usState('md', 'Maryland',             [37.80,  -79.70, 39.90,  -74.80],  80, 'maryland'),
    usState('me', 'Maine',                [43.00,  -71.20, 47.60,  -66.80],  90, 'maine'),
    usState('mi', 'Michigan',             [41.60,  -90.60, 48.50,  -82.10], 220, 'michigan'),
    usState('mn', 'Minnesota',            [43.30,  -97.50, 49.40,  -89.30], 170, 'minnesota'),
    usState('mo', 'Missouri',             [35.90,  -95.90, 40.80,  -89.10], 170, 'missouri'),
    usState('ms', 'Mississippi',          [30.10,  -91.70, 35.10,  -88.00], 100, 'mississippi'),
    usState('mt', 'Montana',              [44.20, -116.20, 49.20, -104.00], 140, 'montana'),
    usState('nc', 'North Carolina',       [33.70,  -84.50, 36.70,  -75.30], 250, 'north-carolina'),
    usState('nd', 'North Dakota',         [45.80, -104.20, 49.20,  -96.40],  70, 'north-dakota'),
    usState('ne', 'Nebraska',             [39.80, -104.20, 43.10,  -95.20], 100, 'nebraska'),
    usState('nh', 'New Hampshire',        [42.60,  -72.70, 45.40,  -70.50],  35, 'new-hampshire'),
    usState('nj', 'New Jersey',           [38.80,  -75.70, 41.50,  -73.80],  90, 'new-jersey'),
    usState('nm', 'New Mexico',           [31.20, -109.20, 37.10, -102.80], 120, 'new-mexico'),
    usState('nv', 'Nevada',               [35.00, -120.10, 42.10, -114.00], 110, 'nevada'),
    usState('ny', 'New York',             [40.40,  -79.90, 45.20,  -71.60], 360, 'new-york'),
    usState('oh', 'Ohio',                 [38.30,  -84.90, 42.10,  -80.30], 180, 'ohio'),
    usState('ok', 'Oklahoma',             [33.50, -103.10, 37.10,  -94.30], 130, 'oklahoma'),
    usState('or', 'Oregon',               [41.80, -124.80, 46.40, -116.40], 170, 'oregon'),
    usState('pa', 'Pennsylvania',         [39.50,  -80.60, 42.60,  -74.50], 240, 'pennsylvania'),
    usState('ri', 'Rhode Island',         [41.10,  -71.90, 42.10,  -71.00],  15, 'rhode-island'),
    usState('sc', 'South Carolina',       [32.00,  -83.60, 35.30,  -78.30], 120, 'south-carolina'),
    usState('sd', 'South Dakota',         [42.40, -104.20, 45.95,  -96.20],  80, 'south-dakota'),
    usState('tn', 'Tennessee',            [34.90,  -90.50, 36.80,  -81.40], 160, 'tennessee'),
    usState('tx', 'Texas',                [25.70, -106.80, 36.60,  -93.40], 650, 'texas'),
    usState('ut', 'Utah',                 [36.80, -114.20, 42.20, -109.00], 120, 'utah'),
    usState('va', 'Virginia',             [36.40,  -83.90, 39.60,  -75.10], 180, 'virginia'),
    usState('vt', 'Vermont',              [42.70,  -73.50, 45.20,  -71.40],  25, 'vermont'),
    usState('wa', 'Washington',           [45.50, -124.90, 49.10, -116.80], 220, 'washington'),
    usState('wi', 'Wisconsin',            [42.30,  -93.10, 47.40,  -86.20], 150, 'wisconsin'),
    usState('wv', 'West Virginia',        [37.00,  -82.80, 40.70,  -77.50],  80, 'west-virginia'),
    usState('wy', 'Wyoming',              [40.90, -111.20, 45.10, -103.90],  70, 'wyoming')
  ]
};

export const REGIONS = Object.values(REGIONS_BY_CONTINENT).flat();

/**
 * Compute the geographic bounds of a tile key.
 * @param {string} tileKey  e.g. "342|453"
 * @returns {{ south, west, north, east } | null}
 */
export function tileBoundsFromKey(tileKey) {
  const m = String(tileKey || '').match(/^(-?\d+)\|(-?\d+)$/);
  if (!m) return null;
  const latI = Number(m[1]);
  const lonI = Number(m[2]);
  const south = -90  + latI * TILE_STEP_DEG;
  const west  = -180 + lonI * TILE_STEP_DEG;
  const north = south + TILE_STEP_DEG;
  const east  = west  + TILE_STEP_DEG;
  return { south, west, north, east };
}

/**
 * Find all REGIONS whose bbox intersects the tile bbox, sorted by sizeMb ascending
 * (smaller/more precise extracts first).
 * @param {string} tileKey
 * @returns {Array<typeof REGIONS[0]>}
 */
export function findRegionsForTile(tileKey) {
  const tile = tileBoundsFromKey(tileKey);
  if (!tile) return [];

  return REGIONS
    .filter(r => {
      const [rS, rW, rN, rE] = r.bbox;
      // Intersection check: not (tile is entirely above/below/left/right of region)
      return !(tile.north <= rS || tile.south >= rN || tile.east <= rW || tile.west >= rE);
    })
    .sort((a, b) => a.sizeMb - b.sizeMb);
}
