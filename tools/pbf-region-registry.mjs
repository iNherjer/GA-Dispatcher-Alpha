// pbf-region-registry.mjs
// European Geofabrik PBF region registry for the obstacle tile workbench.
// Exports: REGIONS, tileBoundsFromKey(), findRegionsForTile()

const BASE = 'https://download.geofabrik.de';
const TILE_STEP_DEG = 25 / 60;

export const REGIONS = [
  // ── German Bundesländer (state-level, preferred over full country) ──────────
  { id: 'de-bw', name: 'Baden-Württemberg',        bbox: [47.53,  7.51, 49.80, 10.50], sizeMb:  500, url: `${BASE}/europe/germany/baden-wuerttemberg-latest.osm.pbf` },
  { id: 'de-by', name: 'Bayern',                   bbox: [47.27,  8.98, 50.57, 13.84], sizeMb: 1200, url: `${BASE}/europe/germany/bavaria-latest.osm.pbf` },
  { id: 'de-be', name: 'Berlin',                   bbox: [52.34, 13.09, 52.68, 13.76], sizeMb:   25, url: `${BASE}/europe/germany/berlin-latest.osm.pbf` },
  { id: 'de-bb', name: 'Brandenburg',              bbox: [51.36, 11.27, 53.56, 14.77], sizeMb:  130, url: `${BASE}/europe/germany/brandenburg-latest.osm.pbf` },
  { id: 'de-hb', name: 'Bremen',                   bbox: [52.85,  8.48, 53.61,  9.01], sizeMb:    7, url: `${BASE}/europe/germany/bremen-latest.osm.pbf` },
  { id: 'de-hh', name: 'Hamburg',                  bbox: [53.40,  8.42, 53.96, 10.33], sizeMb:   20, url: `${BASE}/europe/germany/hamburg-latest.osm.pbf` },
  { id: 'de-he', name: 'Hessen',                   bbox: [49.39,  7.77, 51.66, 10.24], sizeMb:  200, url: `${BASE}/europe/germany/hessen-latest.osm.pbf` },
  { id: 'de-mv', name: 'Mecklenburg-Vorpommern',   bbox: [53.11, 10.59, 54.69, 14.41], sizeMb:  100, url: `${BASE}/europe/germany/mecklenburg-vorpommern-latest.osm.pbf` },
  { id: 'de-ni', name: 'Niedersachsen',            bbox: [51.29,  6.65, 53.90, 11.60], sizeMb:  400, url: `${BASE}/europe/germany/niedersachsen-latest.osm.pbf` },
  { id: 'de-nw', name: 'Nordrhein-Westfalen',      bbox: [50.32,  5.86, 52.53,  9.46], sizeMb:  700, url: `${BASE}/europe/germany/nordrhein-westfalen-latest.osm.pbf` },
  { id: 'de-rp', name: 'Rheinland-Pfalz',          bbox: [48.97,  6.11, 50.94,  8.51], sizeMb:  200, url: `${BASE}/europe/germany/rheinland-pfalz-latest.osm.pbf` },
  { id: 'de-sl', name: 'Saarland',                 bbox: [49.11,  6.36, 49.64,  7.40], sizeMb:   25, url: `${BASE}/europe/germany/saarland-latest.osm.pbf` },
  { id: 'de-sn', name: 'Sachsen',                  bbox: [50.17, 11.87, 51.68, 15.04], sizeMb:  200, url: `${BASE}/europe/germany/sachsen-latest.osm.pbf` },
  { id: 'de-st', name: 'Sachsen-Anhalt',           bbox: [51.04, 10.56, 53.04, 13.19], sizeMb:  130, url: `${BASE}/europe/germany/sachsen-anhalt-latest.osm.pbf` },
  { id: 'de-sh', name: 'Schleswig-Holstein',       bbox: [53.36,  7.87, 55.06, 11.31], sizeMb:  120, url: `${BASE}/europe/germany/schleswig-holstein-latest.osm.pbf` },
  { id: 'de-th', name: 'Thüringen',                bbox: [50.20,  9.86, 51.65, 12.65], sizeMb:  130, url: `${BASE}/europe/germany/thueringen-latest.osm.pbf` },

  // ── Adjacent / European countries ──────────────────────────────────────────
  { id: 'at',    name: 'Austria',                  bbox: [46.37,  9.53, 49.02, 17.16], sizeMb:  600, url: `${BASE}/europe/austria-latest.osm.pbf` },
  { id: 'ch',    name: 'Switzerland',              bbox: [45.82,  5.96, 47.81, 10.49], sizeMb:  250, url: `${BASE}/europe/switzerland-latest.osm.pbf` },
  { id: 'be',    name: 'Belgium',                  bbox: [49.50,  2.55, 51.50,  6.41], sizeMb:  200, url: `${BASE}/europe/belgium-latest.osm.pbf` },
  { id: 'lu',    name: 'Luxembourg',               bbox: [49.44,  5.74, 50.19,  6.53], sizeMb:   15, url: `${BASE}/europe/luxembourg-latest.osm.pbf` },
  { id: 'nl',    name: 'Netherlands',              bbox: [50.75,  3.36, 53.55,  7.23], sizeMb:  130, url: `${BASE}/europe/netherlands-latest.osm.pbf` },
  { id: 'cz',    name: 'Czech Republic',           bbox: [48.55, 12.09, 51.06, 18.87], sizeMb:  400, url: `${BASE}/europe/czech-republic-latest.osm.pbf` },
  { id: 'sk',    name: 'Slovakia',                 bbox: [47.73, 16.83, 49.61, 22.56], sizeMb:  100, url: `${BASE}/europe/slovakia-latest.osm.pbf` },
  { id: 'hu',    name: 'Hungary',                  bbox: [45.74, 16.11, 48.58, 22.90], sizeMb:  300, url: `${BASE}/europe/hungary-latest.osm.pbf` },
  { id: 'si',    name: 'Slovenia',                 bbox: [45.42, 13.38, 46.88, 16.61], sizeMb:   60, url: `${BASE}/europe/slovenia-latest.osm.pbf` },
  { id: 'hr',    name: 'Croatia',                  bbox: [42.38, 13.49, 46.55, 19.45], sizeMb:  150, url: `${BASE}/europe/croatia-latest.osm.pbf` },
  { id: 'pl',    name: 'Poland',                   bbox: [49.00, 14.12, 54.84, 24.15], sizeMb: 1400, url: `${BASE}/europe/poland-latest.osm.pbf` },
  { id: 'dk',    name: 'Denmark',                  bbox: [54.56,  8.07, 57.75, 15.20], sizeMb:  100, url: `${BASE}/europe/denmark-latest.osm.pbf` },
  { id: 'fr-ge', name: 'France/Grand-Est',         bbox: [47.40,  5.90, 49.52,  8.24], sizeMb:  100, url: `${BASE}/europe/france/grand-est-latest.osm.pbf` },
  { id: 'fr-bfc',name: 'France/Bourgogne-FC',      bbox: [46.23,  5.36, 48.40,  7.09], sizeMb:   80, url: `${BASE}/europe/france/bourgogne-franche-comte-latest.osm.pbf` },
  { id: 'fr',    name: 'France (full)',             bbox: [41.34, -5.14, 51.09,  9.56], sizeMb: 4000, url: `${BASE}/europe/france-latest.osm.pbf` },
  { id: 'it',    name: 'Italy',                    bbox: [36.62,  6.62, 47.09, 18.52], sizeMb: 1500, url: `${BASE}/europe/italy-latest.osm.pbf` },
  { id: 'es',    name: 'Spain',                    bbox: [35.95, -9.39, 43.79,  4.33], sizeMb: 1200, url: `${BASE}/europe/spain-latest.osm.pbf` },
  { id: 'pt',    name: 'Portugal',                 bbox: [36.96, -9.50, 42.15, -6.19], sizeMb:  200, url: `${BASE}/europe/portugal-latest.osm.pbf` },
  { id: 'gb',    name: 'Great Britain',            bbox: [49.87, -7.57, 58.64,  1.76], sizeMb: 1500, url: `${BASE}/europe/great-britain-latest.osm.pbf` },
  { id: 'ie',    name: 'Ireland',                  bbox: [51.42,-10.48, 55.43, -5.34], sizeMb:  100, url: `${BASE}/europe/ireland-and-northern-ireland-latest.osm.pbf` },
  { id: 'se',    name: 'Sweden',                   bbox: [55.34, 11.12, 69.06, 24.16], sizeMb:  400, url: `${BASE}/europe/sweden-latest.osm.pbf` },
  { id: 'no',    name: 'Norway',                   bbox: [57.97,  4.65, 71.19, 31.23], sizeMb:  300, url: `${BASE}/europe/norway-latest.osm.pbf` },
  { id: 'fi',    name: 'Finland',                  bbox: [59.81, 20.55, 70.09, 31.59], sizeMb:  250, url: `${BASE}/europe/finland-latest.osm.pbf` },
  { id: 'ro',    name: 'Romania',                  bbox: [43.62, 20.26, 48.27, 30.02], sizeMb:  400, url: `${BASE}/europe/romania-latest.osm.pbf` },
  { id: 'rs',    name: 'Serbia',                   bbox: [41.85, 18.82, 46.19, 23.01], sizeMb:  150, url: `${BASE}/europe/serbia-latest.osm.pbf` },
  { id: 'ba',    name: 'Bosnia-Herzegovina',       bbox: [42.56, 15.72, 45.28, 19.62], sizeMb:   80, url: `${BASE}/europe/bosnia-herzegovina-latest.osm.pbf` },
  { id: 'bg',    name: 'Bulgaria',                 bbox: [41.24, 22.36, 44.22, 28.61], sizeMb:  200, url: `${BASE}/europe/bulgaria-latest.osm.pbf` },
  { id: 'gr',    name: 'Greece',                   bbox: [34.80, 19.37, 41.75, 29.65], sizeMb:  250, url: `${BASE}/europe/greece-latest.osm.pbf` },
  { id: 'ua',    name: 'Ukraine',                  bbox: [44.39, 22.13, 52.38, 40.22], sizeMb:  600, url: `${BASE}/europe/ukraine-latest.osm.pbf` },
  { id: 'ee',    name: 'Estonia',                  bbox: [57.51, 21.83, 59.68, 28.21], sizeMb:   60, url: `${BASE}/europe/estonia-latest.osm.pbf` },
  { id: 'lv',    name: 'Latvia',                   bbox: [55.67, 20.97, 57.97, 28.24], sizeMb:   60, url: `${BASE}/europe/latvia-latest.osm.pbf` },
  { id: 'lt',    name: 'Lithuania',                bbox: [53.89, 20.94, 56.45, 26.84], sizeMb:   80, url: `${BASE}/europe/lithuania-latest.osm.pbf` },
  { id: 'me',    name: 'Montenegro',               bbox: [41.85, 18.44, 43.56, 20.36], sizeMb:   25, url: `${BASE}/europe/montenegro-latest.osm.pbf` },
  { id: 'mk',    name: 'N.Macedonia',              bbox: [40.85, 20.45, 42.37, 23.03], sizeMb:   40, url: `${BASE}/europe/macedonia-latest.osm.pbf` },
  { id: 'al',    name: 'Albania',                  bbox: [39.64, 19.27, 42.66, 21.06], sizeMb:   40, url: `${BASE}/europe/albania-latest.osm.pbf` },
  { id: 'cy',    name: 'Cyprus',                   bbox: [34.63, 32.27, 35.71, 34.59], sizeMb:   30, url: `${BASE}/europe/cyprus-latest.osm.pbf` },
  { id: 'is',    name: 'Iceland',                  bbox: [63.38,-24.55, 66.55,-13.50], sizeMb:   50, url: `${BASE}/europe/iceland-latest.osm.pbf` },
];

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
