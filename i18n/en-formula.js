// English formula help (map table calculator). German source: FORMULA_HELP in map-utility-tools.js.
// Keys: formula.<helpKey>.title | .formula | .body.<index>. A missing entry keeps the German text.
// Only the help popup is translated; the clickable formula lines stay German because the
// calculator matches their variable names (data-formula-vars) inside the shown text.
(function (root) {
    if (!root.GAI18n) return;
    const table = {
        'time-distance': ['Time / Distance / GS', 'Time = Distance / GS\nDistance = GS * Time\nGS = Distance / Time',
            'Basic calculation for navigation, ETA and fuel planning.',
            'Time is entered in hours here: 30 minutes = 0.5 h.'],
        'rule-60': ['1:60 rule', 'Parallel corr. = offset * 60 / distance flown\nClosing corr. = offset * 60 / remaining distance',
            'Small-angle approximation: 1 NM offset after 60 NM is about 1 degree.',
            'The parallel correction brings you back parallel to the planned course. The closing correction turns more directly towards the destination.'],
        'variation': ['Variation', 'MC = TC - East\nMC = TC + West',
            'Converts a true course into a magnetic course.',
            'Memory aid: East is least, West is best.'],
        'map-scale': ['Map scale', null,
            'Helps to quickly estimate distances on paper charts.',
            'The formula takes centimetres on the chart and returns kilometres in the real world.'],
        'fuel-range': ['Fuel / range', 'Fuel = GPH * time\nEndurance = fuel / GPH\nRange = GS * endurance',
            'Calculates fuel burn, flight time from the fuel on board, and range.',
            'Use GS instead of TAS, because the wind determines the distance actually flown per unit of time.'],
        'fuel-reserve': ['Reserve', 'Reserve time = reserve fuel / fuel flow\nReserve NM = GS * reserve time\nDay reserve = GPH * 0.5\nNight reserve = GPH * 0.75',
            'Shows how much time and distance remain after the planned flight.',
            'The fixed factors are quick cockpit values for 30 or 45 minutes of reserve.'],
        'descent-profile': ['Descent / 3 degrees', '3 degree profile = NM * 300 ft\nTOD = altitude to lose / 300\nVS = GS * 5',
            'Rough planning for a stable descent of about 3 degrees.',
            'TOD is the point where the descent should begin.'],
        'climb-gradient': ['Climb / descent angle', 'Angle = gradient % / 1.7\nGradient % = ft/NM / 60.8\nft/NM = ROC / GS * 60',
            'Links climb or descent rate, groundspeed and the required obstacle clearance.',
            'Useful for departure profiles, approach profiles and minimum climb performance.'],
        'wind-components': ['Wind components', 'Headwind = wind * cos(angle)\nCrosswind = wind * sin(angle)\nWCA = crosswind / TAS * 60',
            'Splits the wind into headwind/tailwind and crosswind.',
            'The angle is the difference between runway or course direction and wind direction.'],
        'crosswind-thirds': ['Crosswind thirds', '0-30 degrees = 1/3 wind\n30-60 degrees = 2/3 wind\n60-90 degrees = full wind',
            'Quick rule of thumb when no exact sine is to be calculated.',
            'Good for a plausibility check before takeoff and landing.'],
        'sine-short': ['Sine quick', 'sin 10 degrees = .2\nsin 30 degrees = .5\nsin 60 degrees = .9',
            'Short table for crosswind and wind correction angle.',
            'The calculator\'s sin/cos/tan function is more exact.'],
        'gust-additive': ['Gust additive', 'Vref additive = gust difference / 2',
            'A quick additive in gusty wind.',
            'The aircraft documentation and local procedures remain authoritative.'],
        'tas': ['TAS', 'TAS = IAS * (1 + 0.02 * altitude / 1000)',
            'True airspeed increases with altitude because at the same IAS the aircraft moves faster through thinner air.',
            'The 2 percent per 1000 ft is a cockpit approximation.'],
        'true-altitude': ['True altitude', 'True alt = indicated + temp corr.\nTemp corr. = 4 ft / 1000 ft per degree ISA deviation\nQNH altitude = FL*100 + (QNH - 1013) * 30',
            'True altitude corrects the indicated altitude for temperature and pressure effects.',
            'Important for obstacle clearance and at low temperatures.'],
        'isa-temp': ['ISA temperature', 'ISA = 15 degrees C - 2 degrees C * altitude / 1000',
            'Standard temperature in the International Standard Atmosphere.',
            'You need it for density altitude and temperature corrections, among other things.'],
        'density-altitude': ['Density altitude', null,
            'Density altitude is the altitude in the standard atmosphere that matches the current air density.',
            'It matters because a high density altitude lengthens the takeoff run, reduces climb performance and lowers engine power.',
            'You need field elevation, QNH and OAT, and from them pressure altitude plus ISA deviation.'],
        'takeoff-factors': ['Takeoff distance factors', 'Slope: +10 percent per 1 percent slope\nWet grass: * 1.1\nDry grass: * 1.2\nSoft ground: * 1.5',
            'Quick factors for runway slope and surface.',
            'They do not replace the AFM/POH, but are good for conservative mental arithmetic and plausibility checks.'],
        'turn-stall': ['Stall in turns', 'Vs 20 degrees = Vs * 1.03\nVs 40 degrees = Vs * 1.14\nVs 45 degrees = Vs * 1.19\nVs 60 degrees = Vs * 1.41',
            'In a turn the load factor increases, and with it the stall speed.',
            'Especially important in the traffic pattern and when turning close to the ground.'],
        'lowest-fl': ['Lowest FL', 'Pressure difference to 1013 hPa * 30 ft',
            'Estimates the altitude difference between QNH and standard pressure.',
            'With QNH below 1013 the true altitude of a flight level is lower, so the lowest usable FL rises.'],
        'unit-standard': ['Units', null,
            'Standard conversions for navigation, performance and fuel.',
            'The rule of thumb kt * 2 minus 10 percent for km/h is faster, but less exact.']
    };
    const entries = {};
    Object.keys(table).forEach(key => {
        const [title, formula, ...body] = table[key];
        if (title) entries[`formula.${key}.title`] = title;
        if (formula) entries[`formula.${key}.formula`] = formula;
        body.forEach((text, i) => { if (text) entries[`formula.${key}.body.${i}`] = text; });
    });
    root.GAI18n.register('en', entries);
})(typeof globalThis !== 'undefined' ? globalThis : this);
