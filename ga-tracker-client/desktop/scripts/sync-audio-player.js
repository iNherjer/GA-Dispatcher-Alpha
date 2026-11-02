'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.copyFileSync(path.resolve(__dirname, '../../tracker-media-core.js'), path.resolve(__dirname, '../lib/media-core.js'));
fs.copyFileSync(path.resolve(__dirname, '../../tracker-audio-player.js'), path.resolve(__dirname, '../ui/tracker-audio-player.js'));

fs.copyFileSync(path.resolve(__dirname, '../../../navigation-warning-audio.js'), path.resolve(__dirname, '../ui/navigation-warning-audio.js'));

fs.copyFileSync(path.resolve(__dirname, '../../../audio-warnings/voices/catalog.json'), path.resolve(__dirname, '../ui/warning-voices.json'));

fs.copyFileSync(path.resolve(__dirname, '../../../pax-audio-style.js'), path.resolve(__dirname, '../ui/pax-audio-style.js'));

// Crew fleet (Where I Left It): shared merge rules and the cloud profile reader for the crew name.
for (const name of ['wili-fleet-core.js', 'cloud-sync-client.js', 'cloud-sync-core.js', 'mission-cloud-control-core.js']) {
  fs.copyFileSync(path.resolve(__dirname, '../../../' + name), path.resolve(__dirname, '../lib/' + name));
}
