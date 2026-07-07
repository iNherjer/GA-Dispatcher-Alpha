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

function splitRegion(countryCode, id, name, bbox, sizeMb, url) {
  return region('europe', {
    id,
    name: `${countryCode} / ${name}`,
    bbox,
    sizeMb,
    url
  });
}

const DE_BY_REGIONS = [
  splitRegion('DE-BY', 'de-by-mittelfranken', 'Mittelfranken', [48.8533, 10.0657, 49.791, 11.6055], 89, `${BASE}/europe/germany/bayern/mittelfranken-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-niederbayern', 'Niederbayern', [48.2018, 11.593, 49.176, 13.8495], 90, `${BASE}/europe/germany/bayern/niederbayern-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-oberbayern', 'Oberbayern', [47.3913, 10.7127, 49.0905, 13.1097], 243, `${BASE}/europe/germany/bayern/oberbayern-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-oberfranken', 'Oberfranken', [49.5854, 10.4382, 50.5257, 12.2736], 89, `${BASE}/europe/germany/bayern/oberfranken-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-oberpfalz', 'Oberpfalz', [48.7624, 11.1823, 50.0832, 13.1763], 80, `${BASE}/europe/germany/bayern/oberpfalz-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-schwaben', 'Schwaben', [47.2654, 9.5125, 49.0366, 11.3135], 121, `${BASE}/europe/germany/bayern/schwaben-latest.osm.pbf`),
  splitRegion('DE-BY', 'de-by-unterfranken', 'Unterfranken', [49.4791, 8.9752, 50.5662, 10.8872], 98, `${BASE}/europe/germany/bayern/unterfranken-latest.osm.pbf`)
];

const IT_REGIONS = [
  splitRegion('IT', 'it-centro', 'Centro', [40.2144, 9.3065, 44.4797, 14.6686], 362, `${BASE}/europe/italy/centro-latest.osm.pbf`),
  splitRegion('IT', 'it-isole', 'Isole', [35.0764, 7.7185, 41.5189, 15.7089], 202, `${BASE}/europe/italy/isole-latest.osm.pbf`),
  splitRegion('IT', 'it-nord-est', 'Nord-Est', [43.7298, 9.1955, 47.1001, 13.9288], 590, `${BASE}/europe/italy/nord-est-latest.osm.pbf`),
  splitRegion('IT', 'it-nord-ovest', 'Nord-Ovest', [43.481, 6.6027, 46.6412, 11.4334], 556, `${BASE}/europe/italy/nord-ovest-latest.osm.pbf`),
  splitRegion('IT', 'it-sud', 'Sud', [37.8015, 13.0013, 42.9136, 19.125], 390, `${BASE}/europe/italy/sud-latest.osm.pbf`)
];

const PL_REGIONS = [
  splitRegion('PL', 'pl-dolnoslaskie', 'Dolnośląskie', [50.0825, 14.8084, 51.8142, 17.8058], 169, `${BASE}/europe/poland/dolnoslaskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-kujawsko-pomorskie', 'Kujawsko-Pomorskie', [52.3211, 17.2394, 53.7917, 19.7724], 98, `${BASE}/europe/poland/kujawsko-pomorskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-lodzkie', 'Łódzkie', [50.8309, 18.0623, 52.4062, 20.6691], 123, `${BASE}/europe/poland/lodzkie-latest.osm.pbf`),
  splitRegion('PL', 'pl-lubelskie', 'Lubelskie', [50.2365, 21.6029, 52.3004, 24.161], 131, `${BASE}/europe/poland/lubelskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-lubuskie', 'Lubuskie', [51.3487, 14.4955, 53.1281, 16.43], 58, `${BASE}/europe/poland/lubuskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-malopolskie', 'Małopolskie', [49.1649, 19.0749, 50.5322, 21.4333], 189, `${BASE}/europe/poland/malopolskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-mazowieckie', 'Mazowieckie', [50.9845, 19.2336, 53.5116, 23.1564], 282, `${BASE}/europe/poland/mazowieckie-latest.osm.pbf`),
  splitRegion('PL', 'pl-opolskie', 'Opolskie', [49.9577, 16.9015, 51.2014, 18.7022], 51, `${BASE}/europe/poland/opolskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-podkarpackie', 'Podkarpackie', [48.9864, 21.1343, 50.8259, 23.5536], 143, `${BASE}/europe/poland/podkarpackie-latest.osm.pbf`),
  splitRegion('PL', 'pl-podlaskie', 'Podlaskie', [52.2711, 21.5847, 54.4254, 23.9614], 73, `${BASE}/europe/poland/podlaskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-pomorskie', 'Pomorskie', [53.4806, 16.687, 55.0795, 19.6607], 109, `${BASE}/europe/poland/pomorskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-slaskie', 'Śląskie', [49.38, 18.0221, 51.1129, 19.9854], 174, `${BASE}/europe/poland/slaskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-swietokrzyskie', 'Świętokrzyskie', [50.1797, 19.699, 51.3482, 21.8758], 81, `${BASE}/europe/poland/swietokrzyskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-warminsko-mazurskie', 'Warmińsko-Mazurskie', [53.1258, 19.1167, 54.5146, 22.8206], 80, `${BASE}/europe/poland/warminsko-mazurskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-wielkopolskie', 'Wielkopolskie', [51.084, 15.7604, 53.6811, 19.1293], 150, `${BASE}/europe/poland/wielkopolskie-latest.osm.pbf`),
  splitRegion('PL', 'pl-zachodniopomorskie', 'Zachodniopomorskie', [52.6174, 13.9902, 55.0066, 16.9885], 92, `${BASE}/europe/poland/zachodniopomorskie-latest.osm.pbf`)
];

const ES_REGIONS = [
  splitRegion('ES', 'es-andalucia', 'Andalucía', [35.7064, -7.5247, 38.7335, -1.3321], 181, `${BASE}/europe/spain/andalucia-latest.osm.pbf`),
  splitRegion('ES', 'es-aragon', 'Aragón', [39.8383, -2.1791, 42.9268, 0.7726], 88, `${BASE}/europe/spain/aragon-latest.osm.pbf`),
  splitRegion('ES', 'es-asturias', 'Asturias', [42.8789, -7.1886, 44.011, -4.3996], 34, `${BASE}/europe/spain/asturias-latest.osm.pbf`),
  splitRegion('ES', 'es-cantabria', 'Cantabria', [42.7546, -4.8616, 43.8655, -3.145], 34, `${BASE}/europe/spain/cantabria-latest.osm.pbf`),
  splitRegion('ES', 'es-castilla-la-mancha', 'Castilla-La Mancha', [38.0201, -5.4111, 41.3322, -0.9126], 99, `${BASE}/europe/spain/castilla-la-mancha-latest.osm.pbf`),
  splitRegion('ES', 'es-castilla-y-leon', 'Castilla y León', [40.0804, -7.0805, 43.241, -1.7661], 164, `${BASE}/europe/spain/castilla-y-leon-latest.osm.pbf`),
  splitRegion('ES', 'es-cataluna', 'Cataluña', [40.2124, 0.1564, 42.8632, 4.1748], 252, `${BASE}/europe/spain/cataluna-latest.osm.pbf`),
  splitRegion('ES', 'es-ceuta', 'Ceuta', [35.867, -5.391, 35.9587, -5.2566], 1, `${BASE}/europe/spain/ceuta-latest.osm.pbf`),
  splitRegion('ES', 'es-extremadura', 'Extremadura', [37.9385, -7.5437, 40.4891, -4.6424], 38, `${BASE}/europe/spain/extremadura-latest.osm.pbf`),
  splitRegion('ES', 'es-galicia', 'Galicia', [41.8044, -9.779, 44.1486, -6.7271], 104, `${BASE}/europe/spain/galicia-latest.osm.pbf`),
  splitRegion('ES', 'es-islas-baleares', 'Islas Baleares', [38.0568, 0.6152, 40.7098, 4.9383], 44, `${BASE}/europe/spain/islas-baleares-latest.osm.pbf`),
  splitRegion('ES', 'es-la-rioja', 'La Rioja', [41.914, -3.1402, 42.6462, -1.673], 12, `${BASE}/europe/spain/la-rioja-latest.osm.pbf`),
  splitRegion('ES', 'es-madrid', 'Madrid', [39.8812, -4.5895, 41.1686, -3.0504], 79, `${BASE}/europe/spain/madrid-latest.osm.pbf`),
  splitRegion('ES', 'es-melilla', 'Melilla', [35.2639, -2.9724, 35.3239, -2.9082], 1, `${BASE}/europe/spain/melilla-latest.osm.pbf`),
  splitRegion('ES', 'es-murcia', 'Murcia', [37.1122, -2.3512, 38.7602, -0.2472], 34, `${BASE}/europe/spain/murcia-latest.osm.pbf`),
  splitRegion('ES', 'es-navarra', 'Navarra', [41.9061, -2.5023, 43.3166, -0.7165], 35, `${BASE}/europe/spain/navarra-latest.osm.pbf`),
  splitRegion('ES', 'es-pais-vasco', 'País Vasco', [42.4692, -3.4543, 43.7473, -1.6663], 65, `${BASE}/europe/spain/pais-vasco-latest.osm.pbf`),
  splitRegion('ES', 'es-valencia', 'Valencia', [37.8434, -1.5316, 40.7933, 1.6864], 131, `${BASE}/europe/spain/valencia-latest.osm.pbf`)
];

const FR_REGIONS = [
  splitRegion('FR', 'fr-alsace', 'Alsace', [47.418, 6.8389, 49.079, 8.2355], 123, `${BASE}/europe/france/alsace-latest.osm.pbf`),
  splitRegion('FR', 'fr-aquitaine', 'Aquitaine', [42.7733, -1.8428, 45.7172, 1.4506], 279, `${BASE}/europe/france/aquitaine-latest.osm.pbf`),
  splitRegion('FR', 'fr-auvergne', 'Auvergne', [44.6146, 2.0605, 46.8067, 4.4929], 146, `${BASE}/europe/france/auvergne-latest.osm.pbf`),
  splitRegion('FR', 'fr-basse-normandie', 'Basse-Normandie', [48.178, -2.0875, 49.8852, 0.9791], 135, `${BASE}/europe/france/basse-normandie-latest.osm.pbf`),
  splitRegion('FR', 'fr-bourgogne', 'Bourgogne', [46.1548, 2.8433, 48.4014, 5.52], 189, `${BASE}/europe/france/bourgogne-latest.osm.pbf`),
  splitRegion('FR', 'fr-bretagne', 'Bretagne', [47.0772, -5.8489, 49.4003, -1.0145], 310, `${BASE}/europe/france/bretagne-latest.osm.pbf`),
  splitRegion('FR', 'fr-centre', 'Centre', [46.3459, 0.0515, 48.9423, 3.1299], 229, `${BASE}/europe/france/centre-latest.osm.pbf`),
  splitRegion('FR', 'fr-champagne-ardenne', 'Champagne Ardenne', [47.5755, 3.3824, 50.1701, 5.8922], 99, `${BASE}/europe/france/champagne-ardenne-latest.osm.pbf`),
  splitRegion('FR', 'fr-corse', 'Corse', [41.311, 8.3179, 43.1659, 9.7512], 32, `${BASE}/europe/france/corse-latest.osm.pbf`),
  splitRegion('FR', 'fr-bfc', 'Franche Comte', [46.2597, 5.2508, 48.0254, 7.1444], 117, `${BASE}/europe/france/franche-comte-latest.osm.pbf`),
  splitRegion('FR', 'fr-guadeloupe', 'Guadeloupe', [15.4907, -62.1524, 16.8243, -60.6047], 23, `${BASE}/europe/france/guadeloupe-latest.osm.pbf`),
  splitRegion('FR', 'fr-guyane', 'Guyane', [2.0931, -54.623, 6.3703, -50.8667], 14, `${BASE}/europe/france/guyane-latest.osm.pbf`),
  splitRegion('FR', 'fr-haute-normandie', 'Haute-Normandie', [48.6657, 0.0095, 50.0877, 1.804], 100, `${BASE}/europe/france/haute-normandie-latest.osm.pbf`),
  splitRegion('FR', 'fr-ile-de-france', 'Ile-de-France', [48.1192, 1.4451, 49.2427, 3.5604], 319, `${BASE}/europe/france/ile-de-france-latest.osm.pbf`),
  splitRegion('FR', 'fr-languedoc-roussillon', 'Languedoc-Roussillon', [42.3276, 1.6863, 44.9782, 4.848], 254, `${BASE}/europe/france/languedoc-roussillon-latest.osm.pbf`),
  splitRegion('FR', 'fr-limousin', 'Limousin', [44.9184, 0.6271, 46.4578, 2.6138], 93, `${BASE}/europe/france/limousin-latest.osm.pbf`),
  splitRegion('FR', 'fr-ge', 'Lorraine', [47.8119, 4.886, 49.6195, 7.6401], 161, `${BASE}/europe/france/lorraine-latest.osm.pbf`),
  splitRegion('FR', 'fr-martinique', 'Martinique', [14.1339, -61.6306, 15.1517, -60.4275], 19, `${BASE}/europe/france/martinique-latest.osm.pbf`),
  splitRegion('FR', 'fr-mayotte', 'Mayotte', [-13.4724, 44.6265, -12.1441, 45.6784], 10, `${BASE}/europe/france/mayotte-latest.osm.pbf`),
  splitRegion('FR', 'fr-midi-pyrenees', 'Midi-Pyrenees', [42.5679, -0.3275, 45.0478, 3.4533], 342, `${BASE}/europe/france/midi-pyrenees-latest.osm.pbf`),
  splitRegion('FR', 'fr-nord-pas-de-calais', 'Nord-Pas-de-Calais', [49.9676, 1.2783, 51.2812, 4.2366], 225, `${BASE}/europe/france/nord-pas-de-calais-latest.osm.pbf`),
  splitRegion('FR', 'fr-pays-de-la-loire', 'Pays de la Loire', [46.2188, -2.6747, 48.57, 0.919], 352, `${BASE}/europe/france/pays-de-la-loire-latest.osm.pbf`),
  splitRegion('FR', 'fr-picardie', 'Picardie', [48.836, 1.3601, 50.3713, 4.2567], 126, `${BASE}/europe/france/picardie-latest.osm.pbf`),
  splitRegion('FR', 'fr-poitou-charentes', 'Poitou-Charentes', [45.0868, -1.8986, 47.1784, 1.215], 219, `${BASE}/europe/france/poitou-charentes-latest.osm.pbf`),
  splitRegion('FR', 'fr-provence-alpes-cote-d-azur', "Provence Alpes-Cote-d'Azur", [42.3154, 4.1447, 45.1289, 7.7485], 366, `${BASE}/europe/france/provence-alpes-cote-d-azur-latest.osm.pbf`),
  splitRegion('FR', 'fr-reunion', 'Reunion', [-21.7292, 54.9469, -20.5859, 56.12], 33, `${BASE}/europe/france/reunion-latest.osm.pbf`),
  splitRegion('FR', 'fr-rhone-alpes', 'Rhone-Alpes', [44.1127, 3.6861, 46.5225, 7.1921], 499, `${BASE}/europe/france/rhone-alpes-latest.osm.pbf`)
];

const GB_REGIONS = [
  splitRegion('GB', 'gb-scotland', 'Scotland', [54.54, -14.8615, 61.1356, 0.2161], 322, `${BASE}/europe/united-kingdom/scotland-latest.osm.pbf`),
  splitRegion('GB', 'gb-wales', 'Wales', [51.04, -6.1832, 53.7663, -2.648], 137, `${BASE}/europe/united-kingdom/wales-latest.osm.pbf`),
  splitRegion('GB', 'gb-bedfordshire', 'England / Bedfordshire', [51.8036, -0.7041, 52.3248, -0.142], 14, `${BASE}/europe/united-kingdom/england/bedfordshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-berkshire', 'England / Berkshire', [51.328, -1.5891, 51.5787, -0.4891], 22, `${BASE}/europe/united-kingdom/england/berkshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-bristol', 'England / Bristol', [51.3961, -2.7347, 51.5456, -2.5095], 13, `${BASE}/europe/united-kingdom/england/bristol-latest.osm.pbf`),
  splitRegion('GB', 'gb-buckinghamshire', 'England / Buckinghamshire', [51.4857, -1.1408, 52.1956, -0.4827], 22, `${BASE}/europe/united-kingdom/england/buckinghamshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-cambridgeshire', 'England / Cambridgeshire', [52.0052, -0.5021, 52.7416, 0.5162], 33, `${BASE}/europe/united-kingdom/england/cambridgeshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-cheshire', 'England / Cheshire', [52.9455, -3.1298, 53.4826, -1.9731], 36, `${BASE}/europe/united-kingdom/england/cheshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-cornwall', 'England / Cornwall', [49.5781, -6.8204, 50.9321, -4.1466], 32, `${BASE}/europe/united-kingdom/england/cornwall-latest.osm.pbf`),
  splitRegion('GB', 'gb-cumbria', 'England / Cumbria', [53.9006, -3.9075, 55.1886, -2.1596], 43, `${BASE}/europe/united-kingdom/england/cumbria-latest.osm.pbf`),
  splitRegion('GB', 'gb-derbyshire', 'England / Derbyshire', [52.6955, -2.0358, 53.5417, -1.1648], 41, `${BASE}/europe/united-kingdom/england/derbyshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-devon', 'England / Devon', [50.111, -4.7523, 51.309, -2.8816], 54, `${BASE}/europe/united-kingdom/england/devon-latest.osm.pbf`),
  splitRegion('GB', 'gb-dorset', 'England / Dorset', [50.4983, -2.963, 51.0827, -1.68], 29, `${BASE}/europe/united-kingdom/england/dorset-latest.osm.pbf`),
  splitRegion('GB', 'gb-durham', 'England / Durham', [54.4502, -2.3567, 54.9199, -1.1016], 22, `${BASE}/europe/united-kingdom/england/durham-latest.osm.pbf`),
  splitRegion('GB', 'gb-east-sussex', 'England / East Sussex', [50.7, -0.1368, 51.1478, 0.8695], 20, `${BASE}/europe/united-kingdom/england/east-sussex-latest.osm.pbf`),
  splitRegion('GB', 'gb-east-yorkshire-with-hull', 'England / East Yorkshire with Hull', [53.5545, -1.1052, 54.2105, 0.4894], 18, `${BASE}/europe/united-kingdom/england/east-yorkshire-with-hull-latest.osm.pbf`),
  splitRegion('GB', 'gb-essex', 'England / Essex', [51.4501, -0.0197, 52.0946, 1.3073], 47, `${BASE}/europe/united-kingdom/england/essex-latest.osm.pbf`),
  splitRegion('GB', 'gb-gloucestershire', 'England / Gloucestershire', [51.4147, -2.7119, 52.1156, -1.6126], 38, `${BASE}/europe/united-kingdom/england/gloucestershire-latest.osm.pbf`),
  splitRegion('GB', 'gb-greater-london', 'England / Greater London', [51.2855, -0.5115, 51.6934, 0.3354], 121, `${BASE}/europe/united-kingdom/england/greater-london-latest.osm.pbf`),
  splitRegion('GB', 'gb-greater-manchester', 'England / Greater Manchester', [53.3261, -2.7321, 53.6874, -1.908], 48, `${BASE}/europe/united-kingdom/england/greater-manchester-latest.osm.pbf`),
  splitRegion('GB', 'gb-hampshire', 'England / Hampshire', [50.6904, -1.9591, 51.3871, -0.7263], 60, `${BASE}/europe/united-kingdom/england/hampshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-herefordshire', 'England / Herefordshire', [51.8262, -3.1429, 52.3953, -2.3384], 11, `${BASE}/europe/united-kingdom/england/herefordshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-hertfordshire', 'England / Hertfordshire', [51.598, -0.7468, 52.0822, 0.1971], 36, `${BASE}/europe/united-kingdom/england/hertfordshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-isle-of-wight', 'England / Isle of Wight', [50.5056, -1.6591, 50.801, -1.0314], 9, `${BASE}/europe/united-kingdom/england/isle-of-wight-latest.osm.pbf`),
  splitRegion('GB', 'gb-kent', 'England / Kent', [50.8101, 0.0305, 51.4966, 1.5213], 50, `${BASE}/europe/united-kingdom/england/kent-latest.osm.pbf`),
  splitRegion('GB', 'gb-lancashire', 'England / Lancashire', [53.4751, -3.0922, 54.2465, -2.0395], 39, `${BASE}/europe/united-kingdom/england/lancashire-latest.osm.pbf`),
  splitRegion('GB', 'gb-leicestershire', 'England / Leicestershire', [52.3936, -1.5964, 52.9776, -0.6639], 19, `${BASE}/europe/united-kingdom/england/leicestershire-latest.osm.pbf`),
  splitRegion('GB', 'gb-lincolnshire', 'England / Lincolnshire', [52.6395, -0.9509, 53.73, 0.4944], 41, `${BASE}/europe/united-kingdom/england/lincolnshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-merseyside', 'England / Merseyside', [53.2854, -3.3428, 53.7053, -2.5757], 24, `${BASE}/europe/united-kingdom/england/merseyside-latest.osm.pbf`),
  splitRegion('GB', 'gb-norfolk', 'England / Norfolk', [52.3548, 0.1545, 53.3557, 1.9928], 44, `${BASE}/europe/united-kingdom/england/norfolk-latest.osm.pbf`),
  splitRegion('GB', 'gb-north-yorkshire', 'England / North Yorkshire', [53.62, -2.5672, 54.7022, -0.0406], 57, `${BASE}/europe/united-kingdom/england/north-yorkshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-northamptonshire', 'England / Northamptonshire', [51.9765, -1.334, 52.6446, -0.3407], 21, `${BASE}/europe/united-kingdom/england/northamptonshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-northumberland', 'England / Northumberland', [54.7816, -2.6907, 55.8487, -1.2233], 25, `${BASE}/europe/united-kingdom/england/northumberland-latest.osm.pbf`),
  splitRegion('GB', 'gb-nottinghamshire', 'England / Nottinghamshire', [52.7815, -1.3445, 53.5032, -0.6667], 36, `${BASE}/europe/united-kingdom/england/nottinghamshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-oxfordshire', 'England / Oxfordshire', [51.4606, -1.7195, 52.1681, -0.8698], 26, `${BASE}/europe/united-kingdom/england/oxfordshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-rutland', 'England / Rutland', [52.5236, -0.8229, 52.7611, -0.4277], 2, `${BASE}/europe/united-kingdom/england/rutland-latest.osm.pbf`),
  splitRegion('GB', 'gb-shropshire', 'England / Shropshire', [52.3062, -3.2356, 52.9969, -2.2335], 24, `${BASE}/europe/united-kingdom/england/shropshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-somerset', 'England / Somerset', [50.82, -3.8409, 51.5039, -2.2433], 47, `${BASE}/europe/united-kingdom/england/somerset-latest.osm.pbf`),
  splitRegion('GB', 'gb-south-yorkshire', 'England / South Yorkshire', [53.2989, -1.8259, 53.6633, -0.8529], 28, `${BASE}/europe/united-kingdom/england/south-yorkshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-staffordshire', 'England / Staffordshire', [52.422, -2.4718, 53.2274, -1.5845], 29, `${BASE}/europe/united-kingdom/england/staffordshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-suffolk', 'England / Suffolk', [51.9329, 0.3396, 52.5501, 1.7637], 31, `${BASE}/europe/united-kingdom/england/suffolk-latest.osm.pbf`),
  splitRegion('GB', 'gb-surrey', 'England / Surrey', [51.0715, -0.8506, 51.4729, 0.0599], 41, `${BASE}/europe/united-kingdom/england/surrey-latest.osm.pbf`),
  splitRegion('GB', 'gb-tyne-and-wear', 'England / Tyne and Wear', [54.7978, -1.8539, 55.1095, -1.2626], 18, `${BASE}/europe/united-kingdom/england/tyne-and-wear-latest.osm.pbf`),
  splitRegion('GB', 'gb-warwickshire', 'England / Warwickshire', [51.9547, -1.963, 52.6882, -1.1711], 23, `${BASE}/europe/united-kingdom/england/warwickshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-west-midlands', 'England / West Midlands', [52.3457, -2.2082, 52.6643, -1.4225], 56, `${BASE}/europe/united-kingdom/england/west-midlands-latest.osm.pbf`),
  splitRegion('GB', 'gb-west-sussex', 'England / West Sussex', [50.7069, -0.9562, 51.169, 0.0413], 46, `${BASE}/europe/united-kingdom/england/west-sussex-latest.osm.pbf`),
  splitRegion('GB', 'gb-west-yorkshire', 'England / West Yorkshire', [53.5182, -2.1755, 53.9649, -1.196], 50, `${BASE}/europe/united-kingdom/england/west-yorkshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-wiltshire', 'England / Wiltshire', [50.9465, -2.3633, 51.7064, -1.4888], 32, `${BASE}/europe/united-kingdom/england/wiltshire-latest.osm.pbf`),
  splitRegion('GB', 'gb-worcestershire', 'England / Worcestershire', [51.9654, -2.664, 52.4565, -1.7565], 19, `${BASE}/europe/united-kingdom/england/worcestershire-latest.osm.pbf`)
];

export const REGIONS_BY_CONTINENT = {
  europe: [
    // ── German Bundesländer (state-level, preferred over full country) ───────
    region('europe', { id: 'de-bw', name: 'Baden-Württemberg',      bbox: [47.53,  7.51, 49.80, 10.50], sizeMb:  500, url: `${BASE}/europe/germany/baden-wuerttemberg-latest.osm.pbf` }),
    ...DE_BY_REGIONS,
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
    ...PL_REGIONS,
    region('europe', { id: 'dk', name: 'Denmark',                bbox: [54.56,  8.07, 57.75, 15.20], sizeMb:  100, url: `${BASE}/europe/denmark-latest.osm.pbf` }),
    ...FR_REGIONS,
    ...IT_REGIONS,
    ...ES_REGIONS,
    region('europe', { id: 'pt', name: 'Portugal',               bbox: [36.96, -9.50, 42.15, -6.19], sizeMb:  200, url: `${BASE}/europe/portugal-latest.osm.pbf` }),
    ...GB_REGIONS,
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
