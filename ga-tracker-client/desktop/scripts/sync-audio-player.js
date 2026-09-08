'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.copyFileSync(path.resolve(__dirname, '../../tracker-audio-player.js'), path.resolve(__dirname, '../ui/tracker-audio-player.js'));
