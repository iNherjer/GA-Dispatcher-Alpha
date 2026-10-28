#!/usr/bin/env node
// Builds the compact PPL quiz catalog for the pinboard from the full exchange JSON
// (schema 1.x, see docs/PPL Quiz.md).
//
//   node tools/ppl-quiz-build-catalog.mjs <PPL_A_Fragenkatalog_Edition_N.json> [data/ppl-quiz-catalog.json]
//
// The app keeps learning progress per question ID, so IDs must stay stable between editions.
// The script refuses catalogs that break the basic contract (one correct answer, four
// distinct answers, known category and source).

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath = 'data/ppl-quiz-catalog.json'] = process.argv;
if (!inputPath) {
    console.error('Aufruf: node tools/ppl-quiz-build-catalog.mjs <katalog.json> [ziel.json]');
    process.exit(1);
}

const full = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!String(full.schemaVersion || '').startsWith('1.')) throw new Error(`Unbekanntes Austauschformat ${full.schemaVersion}`);

const categoryIds = new Set(full.categories.map(c => c.id));
const sourceIds = new Set(full.sources.map(s => s.id));
const seen = new Set();
const errors = [];

const questions = full.questions.map(q => {
    if (seen.has(q.id)) errors.push(`${q.id}: doppelte ID`);
    seen.add(q.id);
    if (!categoryIds.has(q.categoryId)) errors.push(`${q.id}: unbekanntes Fach ${q.categoryId}`);
    const answers = q.answers || [];
    const correct = answers.filter(a => a.isCorrect);
    if (answers.length !== 4) errors.push(`${q.id}: ${answers.length} statt 4 Antworten`);
    if (correct.length !== 1 || correct[0].id !== q.correctAnswerId) errors.push(`${q.id}: Schlüssel unklar`);
    if (new Set(answers.map(a => a.text.trim().toLowerCase())).size !== answers.length) errors.push(`${q.id}: gleiche Antworttexte`);
    const refs = (q.sourceReferences || []).map(r => {
        if (!sourceIds.has(r.sourceId)) errors.push(`${q.id}: unbekannte Quelle ${r.sourceId}`);
        return [r.sourceId, r.locator || '', r.pdfPages?.[0] || 0];
    });
    // Answer IDs end in the original option index; the app shuffles the order itself.
    return {
        id: q.id,
        c: q.categoryId,
        t: q.topic || '',
        r: q.bankSegment === 'arithmetic' ? 1 : 0,
        q: q.question,
        a: answers.map(a => [a.id.slice(q.id.length + 1), a.text, a.explanation || '']),
        k: q.correctAnswerId.slice(q.id.length + 1),
        s: refs
    };
});

if (errors.length) {
    console.error(`${errors.length} Fehler im Katalog:\n` + errors.slice(0, 40).join('\n'));
    process.exit(1);
}

const out = {
    format: 1,
    catalogId: full.catalogId,
    catalogVersion: full.catalogVersion,
    edition: full.edition,
    checkedAt: full.checkedAt,
    note: 'Eigenständig formulierte Lernfragen, keine offiziellen ECQB-Fragen. Quellenabgleich durch KI, unabhängige Fachfreigabe ausstehend.',
    categories: full.categories.map(c => [c.id, c.name]),
    sources: Object.fromEntries(full.sources.map(s => [s.id, [s.title, s.url]])),
    questions
};

writeFileSync(outputPath, JSON.stringify(out));
const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`${questions.length} Fragen, ${out.categories.length} Fächer -> ${outputPath} (${Math.round(bytes / 1024)} KB)`);
