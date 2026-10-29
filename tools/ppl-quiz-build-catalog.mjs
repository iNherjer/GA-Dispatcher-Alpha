#!/usr/bin/env node
// Builds the compact PPL quiz catalog for the pinboard from the full exchange JSON
// (schema 1.x, see docs/PPL Quiz.md).
//
//   node tools/ppl-quiz-build-catalog.mjs <PPL_A_Fragenkatalog_Edition_N.json> [<Zusatzmodul.json> ...] [--out=data/ppl-quiz-catalog.json]
//
// Additional modules (type "question_batch") either bring their own subject (e.g. the official
// BZF I/II catalogue, with its own IDs, source and licence notice) or, without a category, add
// questions to the existing subjects (e.g. the Edition 16 picture questions).
//
// The app keeps learning progress per question ID, so IDs must stay stable between editions.
// The script refuses catalogs that break the basic contract (one correct answer, four
// distinct answers, known category and source).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const outputPath = (args.find(a => a.startsWith('--out=')) || '--out=data/ppl-quiz-catalog.json').slice(6);
const [inputPath, ...modulePaths] = args.filter(a => !a.startsWith('--'));
if (!inputPath) {
    console.error('Aufruf: node tools/ppl-quiz-build-catalog.mjs <katalog.json> [<zusatzmodul.json> ...] [--out=ziel.json]');
    process.exit(1);
}
const mediaDir = join(dirname(outputPath), 'ppl-quiz-media');

const full = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!String(full.schemaVersion || '').startsWith('1.')) throw new Error(`Unbekanntes Austauschformat ${full.schemaVersion}`);

const categories = full.categories.map(c => [c.id, c.name]);
const sources = Object.fromEntries(full.sources.map(s => [s.id, [s.title, s.url]]));
// Per-subject notices shown in the app, e.g. the licence attribution of an official catalogue.
const notices = {};
const seen = new Set();
const errors = [];
let mediaCount = 0;

function convert(q, opts = {}) {
    if (seen.has(q.id)) errors.push(`${q.id}: doppelte ID`);
    seen.add(q.id);
    if (!categories.some(c => c[0] === q.categoryId)) errors.push(`${q.id}: unbekanntes Fach ${q.categoryId}`);
    const answers = q.answers || [];
    const correct = answers.filter(a => a.isCorrect);
    if (answers.length !== 4) errors.push(`${q.id}: ${answers.length} statt 4 Antworten`);
    if (correct.length !== 1 || correct[0].id !== q.correctAnswerId) errors.push(`${q.id}: Schlüssel unklar`);
    if (new Set(answers.map(a => a.text.trim().toLowerCase())).size !== answers.length) errors.push(`${q.id}: gleiche Antworttexte`);
    const refs = (q.sourceReferences || []).map(r => {
        if (!sources[r.sourceId]) errors.push(`${q.id}: unbekannte Quelle ${r.sourceId}`);
        return [r.sourceId, opts.topic ? opts.topic(q) : (r.locator || ''), r.pdfPages?.[0] || 0];
    });
    const out = {
        id: q.id,
        c: q.categoryId,
        t: opts.topic ? opts.topic(q) : (q.topic || ''),
        r: q.bankSegment === 'arithmetic' ? 1 : 0,
        q: q.question,
        // Answer IDs end in the original option label; the app shuffles the order itself.
        // "official_key_only" texts only repeat the key with the original letter, which would
        // be wrong after shuffling, so they are dropped.
        a: answers.map(a => [a.id.slice(q.id.length + 1), a.text, a.explanationType === 'official_key_only' ? '' : (a.explanation || '')]),
        k: q.correctAnswerId.slice(q.id.length + 1),
        s: refs
    };
    const image = (q.media || []).find(m => m.type === 'image' && m.dataUrl);
    if (image) {
        const bytes = Buffer.from(image.dataUrl.split(',')[1], 'base64');
        const sha = createHash('sha256').update(bytes).digest('hex');
        if (image.sha256 && image.sha256 !== sha) errors.push(`${q.id}: Bild-Prüfsumme passt nicht`);
        const name = (image.filename || `${q.id}.png`).split('/').pop();
        mkdirSync(mediaDir, { recursive: true });
        writeFileSync(join(mediaDir, name), bytes);
        // ?v=<hash> lets the service worker cache each image until its content changes.
        out.m = ['data/ppl-quiz-media/' + name + '?v=' + sha.slice(0, 8), image.alt || ''];
        mediaCount++;
    }
    return out;
}

const questions = full.questions.map(q => convert(q));

let edition = full.edition;
for (const path of modulePaths) {
    const mod = JSON.parse(readFileSync(path, 'utf8'));
    if (mod.type !== 'question_batch') throw new Error(`${path}: kein Fragenmodul`);
    // Supplement batch for the existing subjects (e.g. the Edition 16 picture questions):
    // questions keep their own categories; the catalog takes over the newer edition number.
    if (!mod.category?.id) {
        if (mod.catalogId && mod.catalogId !== full.catalogId) throw new Error(`${path}: anderer Katalog ${mod.catalogId}`);
        for (const s of mod.sources || []) sources[s.id] = [s.title, s.url];
        for (const q of mod.questions) questions.push(convert(q));
        if (mod.edition > edition) edition = mod.edition;
        continue;
    }
    const official = mod.questions.every(q => q.bankSegment === 'official');
    categories.push([mod.category.id, official ? 'BZF I/II (amtlich)' : mod.category.name]);
    for (const s of mod.sources || []) {
        sources[s.id] = [s.title, s.url];
        if (s.license) {
            notices[mod.category.id] = {
                short: '© Bundesnetzagentur · BZF I/II, gültig ab 01.05.2024 · CC BY-ND 4.0 · technisch nach JSON übertragen, Antworten zur Anzeige gemischt',
                full: s.license.attribution,
                source: s.url,
                license: s.license.url
            };
        }
    }
    const topic = official ? (q => 'Amtliche Frage ' + (q.origin?.originalQuestionNumber ?? q.id)) : null;
    for (const q of mod.questions) questions.push(convert(q, { topic }));
}

if (errors.length) {
    console.error(`${errors.length} Fehler im Katalog:\n` + errors.slice(0, 40).join('\n'));
    process.exit(1);
}

const out = {
    format: 1,
    catalogId: full.catalogId,
    catalogVersion: full.catalogVersion,
    edition,
    checkedAt: full.checkedAt,
    note: 'PPL: eigenständig formulierte Lernfragen, keine offiziellen ECQB-Fragen. Quellenabgleich durch KI, unabhängige Fachfreigabe ausstehend.',
    categories,
    sources,
    notices,
    questions
};

const json = JSON.stringify(out);
writeFileSync(outputPath, json);
const bytes = Buffer.byteLength(json);

// The app loads the catalog as ...json?v=<version> from a long-lived cache. Stamp the new
// version into ppl-quiz.js so devices fetch it once after the next release.
const version = `${edition}-${createHash('sha256').update(json).digest('hex').slice(0, 8)}`;
const appPath = join(dirname(outputPath), '..', 'ppl-quiz.js');
try {
    const app = readFileSync(appPath, 'utf8');
    const stamped = app.replace(/const CATALOG_VERSION = '[^']*';/, `const CATALOG_VERSION = '${version}';`);
    if (stamped === app && !app.includes(`'${version}'`)) console.warn(`Hinweis: CATALOG_VERSION in ${appPath} nicht gefunden.`);
    writeFileSync(appPath, stamped);
    console.log(`Katalogversion ${version} in ${appPath} eingetragen.`);
} catch (err) {
    console.warn(`Hinweis: ${appPath} nicht aktualisiert (${err.message}).`);
}
console.log(`${questions.length} Fragen, ${categories.length} Fächer, ${mediaCount} Bilder -> ${outputPath} (${Math.round(bytes / 1024)} KB)`);
