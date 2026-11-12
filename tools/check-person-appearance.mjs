#!/usr/bin/env node
// Prüft eine Steckbrief-Datei person-appearance.json (für Artist- und SDK-Agenten).
//   node check-person-appearance.mjs <person-appearance.json> [mission-person-vocabulary.json]
// Ohne zweites Argument wird die Wortliste neben diesem Skript oder unter ../data/ gesucht.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAppearanceFile } from './homebase-person-rules.mjs';

const [file, vocabArg] = process.argv.slice(2);
if (!file) { console.error('Aufruf: node check-person-appearance.mjs <person-appearance.json> [mission-person-vocabulary.json]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const vocabPath = vocabArg || [path.join(here, 'mission-person-vocabulary.json'), path.join(here, '..', 'data', 'mission-person-vocabulary.json')].find((p) => fs.existsSync(p));
if (!vocabPath) { console.error('Wortliste mission-person-vocabulary.json nicht gefunden.'); process.exit(2); }
let doc;
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`Keine gültige JSON-Datei: ${error.message}`); process.exit(1); }
const { errors, warnings } = checkAppearanceFile(doc, JSON.parse(fs.readFileSync(vocabPath, 'utf8')));
errors.forEach((m) => console.log(`FEHLER  ${m}`));
warnings.forEach((m) => console.log(`HINWEIS ${m}`));
console.log(`${errors.length ? 'Nicht bestanden' : 'Bestanden'}: ${(doc.figures || []).length} Figur(en), ${errors.length} Fehler, ${warnings.length} Hinweis(e).`);
process.exit(errors.length ? 1 : 0);
