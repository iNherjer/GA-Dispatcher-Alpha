// English help popovers (the "?" buttons). German source: SETTINGS_HELP_CONTENT in app.js.
// Item keys use the slug of the German term (see _settingsHelpSlug in app.js).
// A missing entry keeps the German text, so partial coverage is safe.
(function (root) {
    if (!root.GAI18n) return;
    const entries = { 'help.close': 'Close help' };
    const section = (helpKey, head, items) => {
        const base = `help.${helpKey}`;
        Object.keys(head).forEach(k => { entries[`${base}.${k}`] = head[k]; });
        Object.keys(items).forEach(slug => {
            const [term, text] = items[slug];
            if (term) entries[`${base}.${slug}.term`] = term;
            if (text) entries[`${base}.${slug}.text`] = text;
        });
    };

    section('dispatcher', {
        kicker: 'Jobs',
        title: 'AI Dispatcher',
        intro: 'Choose whether missions come from the local database or whether Gemini or OpenAI may create new jobs.'
    }, {
        'schalter': ['Switch', 'Turns AI missions on or off. Off means the app uses fixed local jobs.'],
        'api-key': ['API key', 'Optional provider keys for Gemini and OpenAI. The active provider decides which key is used for text and voice.'],
        'provider-profil': ['Provider / Profile', 'Auto is normal operation, Economy prefers cheaper models, Quality prefers stronger text models. High Quality uses Gemini 3.5 Flash first for Gemini.'],
        'kosten-grob': ['Rough cost', null],
        'status': ['Status', 'Shows whether the key was checked successfully last time.'],
        'sicherheit': ['Security', 'The key is only stored in this browser and is not written to your profile. Browser extensions or a compromised device can still read local data.']
    });

    section('pilot-sync', {
        intro: 'This group connects your local cockpit with your pilot ID, cloud data and optionally the PC tracker.'
    }, {
        'pilot-id': ['Pilot ID', 'Your name in the system. The app uses it to know which data belongs to you.'],
        'pin': ['PIN', 'Protects your pilot ID. Without the matching PIN, sync stays locked.'],
        'login': ['Login', 'Signs you in with pilot ID and PIN and unlocks the cloud features.'],
        'pc-tracker': ['PC tracker', 'Downloads the small Windows tool that can send live position and flight state from MSFS.'],
        'auto-sync': ['Auto-Sync', 'Saves and loads data automatically while you are signed in.'],
        'push-pull': ['Push / Pull', 'Push sends your data to the cloud. Pull fetches the saved state back.'],
        'live-gps': ['Live GPS', 'Shows whether live data from the tracker is arriving.'],
        'missionsstatus': ['Mission status', 'Shows what the running mission expects right now, for example ground stabilization or the next step.'],
        'mission-reset': ['Mission reset', 'Resets the running mission without deleting anything else.'],
        'auto-load': ['Auto load', 'Loads mission cargo automatically when this option is on.']
    });

    section('crew-board', {
        intro: 'Connect to a shared crew board here so others can see the same flight context.'
    }, {
        'crew-code': ['Crew code', 'The shared group name, for example an airfield code. Everyone with the same code ends up on the same board.'],
        'anzeigename': ['Display name', 'The name shown for you. If it stays empty, the app uses your pilot ID.'],
        'beitreten-update': ['Join / Update', 'Joins the crew or updates your name and status.'],
        'verlassen': ['Leave', 'Removes you from the current crew group.'],
        'status': ['Status', 'Shows whether you are connected right now.']
    });

    section('aircraft-presets', {
        intro: 'Aircraft presets store the key planning values of your aircraft so missions and times become more realistic.'
    }, {
        'preset-liste': ['Preset list', 'Up to 10 aircraft presets. + creates a new one, clicking a preset opens the editor. You can also delete it there.'],
        'schnellwahl': ['Quick slots', 'The three buttons next to the mission parameters are quick slots. A click selects the assigned preset. Right-click or long press opens a list where you assign a different preset to the button.'],
        'boarding-szene': ['Boarding scene', 'Boarding points are saved per preset. Choose the preset in the selector above the boarding editor.'],
        'name': ['Name', 'Free display name for the aircraft.'],
        'tas': ['TAS', 'True airspeed in knots. This value sets the planned cruise speed.'],
        'gph': ['GPH', 'Fuel flow in gallons per hour. The app uses it to estimate fuel burn.'],
        'sitze': ['Seats', 'Total number of seats for mission planning, including the pilot seat.'],
        'max-zuladung': ['Max. payload', 'Maximum payload in kilograms. Stored as aircraft metadata and can later be used for payload checks.'],
        'klasse': ['Class', 'Technical class such as SEP, MEP, turboprop, jet or heli.'],
        'einsatzprofile': ['Mission profiles', 'Private/travel, business/charter, cargo, utility/work, bush/STOL and training only limit the random rotation. Without a selection, Auto stays unrestricted; picking a specific mission in the mission picker always remains possible.'],
        'preset-speichern': ['Save preset', 'Saves all values of the preset. When signed in, presets and quick slots are synced with your pilot ID.']
    });

    section('boarding-scene', {
        title: 'Boarding scene',
        intro: 'These tools decide where passengers, markers and the boarding path appear relative to the aircraft.'
    }, {
        'tuer': ['Door', 'Controls whether the boarding scene is planned with the door open.'],
        'marker': ['Marker', 'Shows a visible marker for the boarding position.'],
        'punkt-auswahl': ['Point selection', 'Selects the waypoint you want to edit.'],
        'wegpunkt': ['+ Waypoint', 'Inserts a new waypoint after the selected point.'],
        'punktanzeige': ['Point readout', 'Shows the current position of the selected point relative to the aircraft.'],
        'pfeile': ['Arrows', 'Move the point forward, back, left or right.'],
        'punkt-zurueck-vor': ['Point earlier / later', 'Changes the order of the selected waypoint.'],
        'loeschen': ['Delete', 'Removes the selected waypoint from the boarding path.'],
        'reset': ['Reset', 'Resets the boarding configuration for this slot to default values.'],
        'szene-neu-setzen': ['Place scene again', 'Applies the current boarding configuration to the scene right away.']
    });

    section('appearance', {
        kicker: 'Appearance',
        title: 'Appearance',
        intro: 'This group only changes how the app looks. Your mission and aircraft data stay the same.'
    }, {
        'modern': ['Modern', 'Clean, current look with glass and gradient elements.'],
        'analog': ['Analog', 'More classic panel look with an instrument feel.'],
        'navcom': ['NavCom', 'Radio look with a dark control surface.'],
        'ops-1940': ['Ops 1940', 'Retro control surface with a military touch.'],
        'win95': ['Win95', 'Window frames, buttons and desktop look in the style of early Windows.'],
        'schieberegler': ['Slider', 'Switches between the five looks.'],
        'seitengrosse': ['Page size', 'Scales the whole web app in the browser from 30% to 150%. Minus and plus change the value in 5% steps; Reset returns to 100%.'],
        'wofuer-gut': ['What is it for?', 'Helps when the app looks too large or too small in the browser, for example on Quest/VR, tablet, phone, small windows or very high-resolution monitors.'],
        'schaerfe-grenze': ['Sharpness limit', 'This setting enlarges or shrinks the app but does not create extra physical pixels. If a VR browser only upscales its window, the content stays soft even when shown larger.'],
        'geraete': ['Devices', 'The setting is not VR-specific. It works on every device whose browser supports CSS zoom and is stored locally per browser.']
    });

    root.GAI18n.register('en', entries);
})(typeof globalThis !== 'undefined' ? globalThis : this);
