// English mission picker labels. German source: MISSION_PICKER_OPTIONS in app.js.
// Keyed by option value: [classic select, NavCom short, NavCom full]. null = keep German/English original.
(function (root) {
    if (!root.GAI18n) return;
    const table = {
        'apt': ['Airport (A ➔ B)', null, 'Airport (all categories)'],
        'poi': ['POI (scenic flight)', null, 'POI (all categories)'],
        'bush': null,
        'apt+freeflight_planning': ['APT · Free flight/planning', null, 'Airport · Free flight/planning'],
        'poi+freeflight_planning': ['POI · Free flight/planning', null, 'POI · Free flight/planning'],
        'apt:all': ['APT (all categories)', null, 'Airport (all categories)'],
        'apt:all+freeflight_planning': ['APT · Free flight/planning', null, 'Airport · Free flight/planning'],
        'apt:club': ['APT · Club', null, 'Airport · Club'],
        'apt:private': ['APT · Private', null, 'Airport · Private'],
        'apt:cargo': ['APT · Cargo (no PAX)', null, 'Airport · Cargo (no PAX)'],
        'apt:all+medical_transfer': ['APT · Medical transfer', null, 'Airport · Medical transfer'],
        'apt:cargo+cargo_fragile': ['APT · Fragile cargo', null, 'Airport · Fragile cargo'],
        'apt:all+animal_transport': ['APT · Animal transport', null, 'Airport · Animal transport'],
        'poi:all': ['POI (all categories)', null, 'POI (all categories)'],
        'poi:all+freeflight_planning': ['POI · Free flight/planning', null, 'POI · Free flight/planning'],
        'poi:trn': ['POI · Training (near the field)', null, 'POI · Training (near the field)'],
        'poi:all+inspection_infra': ['POI · Inspection', null, 'POI · Infrastructure inspection'],
        'poi:chain+infra_chain_recon': ['POI · Chain first survey', null, 'POI · Chain first survey'],
        'poi:all+media_photo': ['POI · Photo/film', null, 'POI · Photo/film'],
        'poi:all+tour_guide_knowledge': ['POI · Learning guide', null, 'POI · Learning guide (knowledge/facts)'],
        'poi:all+historian_guided_tour': ['POI · Historian', null, 'POI · Historian tour'],
        'poi:all+science_bio': ['POI · Bio/environment', null, 'POI · Biology/environment'],
        'poi:all+science_geo': ['POI · Geo/relief', null, 'POI · Geology/relief'],
        'poi:all+sar_heli': [null, null, 'POI · SAR heli (rescue + hospital)'],
        'poi:fire+fire_watch': ['POI · Fire watch (forest/mountain)', null, 'POI · Fire watch (forest/mountain)'],
        'bush:all+bush_supply_strip': ['BUSH · Supply', null, null],
        'byTarget': ['Choose by target', 'TARGET', 'Choose by target'],
        'poi:bridge': ['Target · Bridges', 'TGT BRG', 'Target · POI bridges'],
        'poi:road': ['Target · Road/motorway', 'TGT ROAD', 'Target · POI road/motorway'],
        'poi:dam': ['Target · Dam/reservoir', 'TGT DAM', 'Target · POI dam/reservoir'],
        'poi:telecom': ['Target · Radio mast/tower', 'TGT TEL', 'Target · POI radio mast/tower'],
        'poi:industry': ['Target · Industry/plants', 'TGT IND', 'Target · POI industry/plants'],
        'poi:infrastructure': ['Target · Infrastructure (road/rail/power)', 'TGT INF', 'Target · POI infrastructure (road/rail/power)'],
        'poi:castle': ['Target · Castle/palace', 'TGT CST', 'Target · POI castle/palace'],
        'poi:water': ['Target · River/lake/coast', 'TGT WTR', 'Target · POI river/lake/coast'],
        'poi:mountain': ['Target · Mountain/valley', 'TGT MTN', 'Target · POI mountain/valley'],
        'poi:city': ['Target · City/tower', 'TGT CITY', 'Target · POI city/tower'],
        'poi:generic': ['Target · Other', 'TGT GEN', 'Target · POI other']
    };
    const entries = {};
    Object.keys(table).forEach(value => {
        const row = table[value];
        if (!row) return;
        ['classic', 'radioShort', 'radioFull'].forEach((field, i) => {
            if (row[i]) entries[`picker.${value}.${field}`] = row[i];
        });
    });
    root.GAI18n.register('en', entries);
})(typeof globalThis !== 'undefined' ? globalThis : this);
