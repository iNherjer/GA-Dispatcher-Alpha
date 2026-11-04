#!/usr/bin/env node
// Checks the UI translation (see docs/English Translation Plan.md).
//   node tools/i18n-check.mjs                    report, exit 1 on dictionary errors
//   node tools/i18n-check.mjs --update-baseline  accept today's German literals as the baseline
//   node tools/i18n-check.mjs --files            also print the count per file
//
// Dictionary errors: a key used in index.html (data-i18n*) has no English text,
//                    placeholders like {name} differ between German and English.
// Literal warnings:  German text written directly into the code that is not in the
//                    baseline yet (new or changed). Warnings never fail the run.
//                    The detection is a heuristic: place names or German search terms
//                    in mission logic can show up too and may stay as they are.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_FILE = path.join(ROOT, 'i18n', 'literal-baseline.json');
const args = new Set(process.argv.slice(2));

// ---------- dictionaries ----------

function loadDictionaries() {
    const dictionaries = { de: {}, en: {} };
    const sandbox = { GAI18n: {
        register: (lang, entries) => Object.assign(dictionaries[lang], entries),
        registerPhrases: (lang, entries) => Object.assign(dictionaries.phrases, entries)
    } };
    dictionaries.phrases = {};
    sandbox.globalThis = sandbox;
    // i18n/de.js, i18n/en.js and topic files like i18n/en-help.js.
    const files = fs.readdirSync(path.join(ROOT, 'i18n')).filter(f => /^(de|en)(-[a-z0-9-]+)?\.js$/.test(f)).sort();
    for (const name of files) {
        const file = path.join(ROOT, 'i18n', name);
        vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    }
    return dictionaries;
}

function htmlKeys(file) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const keys = new Map();
    const re = /data-i18n(?:-title|-aria-label|-placeholder|-src|-alt)?="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
        if (!keys.has(m[1])) keys.set(m[1], `${file}:${lineAt(html, m.index)}`);
    }
    return keys;
}

// Valid help.* keys, derived from SETTINGS_HELP_CONTENT in app.js (same slug rule as _settingsHelpSlug).
function helpKeys() {
    const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = src.indexOf('const SETTINGS_HELP_CONTENT = {');
    if (start < 0) return null;
    const end = src.indexOf('\n};\n', start) + 3;
    const box = {};
    vm.runInNewContext(src.slice(start, end).replace('const SETTINGS_HELP_CONTENT', 'SETTINGS_HELP_CONTENT') + ';', box);
    const slug = t => String(t || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const keys = new Set(['help.close']);
    for (const [helpKey, data] of Object.entries(box.SETTINGS_HELP_CONTENT)) {
        ['kicker', 'title', 'intro'].forEach(k => keys.add(`help.${helpKey}.${k}`));
        (data.items || []).forEach(item => {
            keys.add(`help.${helpKey}.${slug(item.term)}.term`);
            keys.add(`help.${helpKey}.${slug(item.term)}.text`);
        });
    }
    return keys;
}

const placeholders = s => [...String(s).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(x => x[1]).sort().join(',');

function lineAt(text, index) {
    let line = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
}

// ---------- German literals ----------

// Web app files in the project root. Tests, local harness pages, data-only files and
// the dictionaries themselves are left out.
const LITERAL_EXCLUDE = new Set(['cities.js', 'datenbank.js', 'sw.js']);
function literalFiles() {
    return fs.readdirSync(ROOT)
        .filter(f => /\.(js|html)$/.test(f))
        .filter(f => !/\.test\.js$/.test(f) && !f.startsWith('zz-') && !LITERAL_EXCLUDE.has(f))
        .sort();
}

const UMLAUT = /[äöüÄÖÜß]/;
const GERMAN_WORD = /\b(und|der|die|das|nicht|bitte|kein|keine|wird|ist|mit|für|fuer|auf|oder|noch|jetzt|wurde|zum|zur|eine|einen|Sie|du|dein|Dein|Deine|Flug|Ziel|Start|Landung|Wetter|Passagier|Fehler|aktiv|Abbrechen|Speichern|Laden|Einstellungen)\b/;
const TWO_WORDS = /[A-Za-zÄÖÜäöüß]{3,} [A-Za-zÄÖÜäöüß]{2,}/;
const looksGerman = s => UMLAUT.test(s) || (GERMAN_WORD.test(s) && TWO_WORDS.test(s));

const STRING_RE = /'(?:[^'\\\n]|\\.){3,}'|"(?:[^"\\\n]|\\.){3,}"|`(?:[^`\\]|\\.){3,}`/g;
const HTML_TEXT_RE = />([^<>{}]{3,})</g;
const HTML_ATTR_RE = /\s(title|aria-label|placeholder|alt)="([^"]{3,})"/g;

// Markup that already carries a key counts as translated: the German stays in the HTML on purpose.
function tagAround(text, index) {
    const start = text.lastIndexOf('<', index);
    const end = text.indexOf('>', index);
    return start < 0 || end < 0 ? '' : text.slice(start, end + 1);
}

const TRANSLATED_CALL_RE = /(?:GAI18n\.t|GAI18n\.phrase|_[a-zA-Z]+UiText|_[a-zA-Z]+UiPhrase|\btr|\btx|\btxPhrase|\bphrase|_[a-zA-Z]+Text|\b(?:cs|rt)Text|_mpT|_(?:ap|sc|mc)[TK])\((?:[^;(){}]|\{[^{}]*\}|\([^()]*\))*$/;

function germanLiterals(file) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const found = [];
    const take = (value, index) => {
        const clean = value.replace(/\s+/g, ' ').trim();
        if (clean.length >= 3 && looksGerman(clean)) found.push({ text: clean, index });
    };
    let m;
    // In HTML, inline <script> bodies are scanned as code and everything else as markup.
    // Both views keep the original offsets (the other part is blanked out) so line numbers fit.
    let code = text;
    let markup = '';
    if (file.endsWith('.html')) {
        const blank = s => s.replace(/[^\n]/g, ' ');
        code = '';
        markup = '';
        let last = 0;
        const scriptRe = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi;
        while ((m = scriptRe.exec(text))) {
            const bodyStart = m.index + m[1].length;
            const bodyEnd = bodyStart + m[2].length;
            code += blank(text.slice(last, bodyStart)) + m[2];
            markup += text.slice(last, bodyStart) + blank(m[2]);
            last = bodyEnd;
        }
        code += blank(text.slice(last));
        markup += text.slice(last);
    }
    STRING_RE.lastIndex = 0;
    while ((m = STRING_RE.exec(code))) {
        // German fallback inside a translation call counts as translated:
        // GAI18n.t(key, vars, 'Deutsch'), GAI18n.phrase('Deutsch'), _xxxUiText(...), _xxxUiPhrase(...).
        const before = code.slice(Math.max(0, m.index - 240), m.index);
        if (TRANSLATED_CALL_RE.test(before)) continue;
        take(m[0].slice(1, -1), m.index);
    }
    if (markup) {
        HTML_TEXT_RE.lastIndex = 0;
        while ((m = HTML_TEXT_RE.exec(markup))) {
            if (!/\sdata-i18n(?:-initial)?[\s=>]/.test(tagAround(markup, m.index))) take(m[1], m.index + 1);
        }
        HTML_ATTR_RE.lastIndex = 0;
        while ((m = HTML_ATTR_RE.exec(markup))) {
            if (!new RegExp(`\\sdata-i18n-${m[1]}="`).test(tagAround(markup, m.index))) take(m[2], m.index);
        }
    }
    // Line numbers only for what gets printed; computing them for every hit is slow.
    found.forEach(f => { f.file = file; f.hash = crypto.createHash('sha1').update(f.text).digest('hex').slice(0, 10); });
    found.lineOf = item => lineAt(text, item.index);
    return found;
}

function readBaseline() {
    try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); }
    catch (_) { return null; }
}

function writeBaseline(scan) {
    const files = {};
    for (const [file, items] of scan) {
        if (!items.length) continue;
        files[file] = [...new Set(items.map(i => i.hash))].sort();
    }
    const total = [...scan.values()].reduce((n, items) => n + items.length, 0);
    const data = {
        note: 'German literals accepted as known. Created by node tools/i18n-check.mjs --update-baseline.',
        created: new Date().toISOString().slice(0, 10),
        total,
        files
    };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(data, null, 1)}\n`);
    return total;
}

// ---------- run ----------

const dict = loadDictionaries();
const used = htmlKeys('index.html');
const validHelp = helpKeys();
// picker.<value>.<field> keys, derived from MISSION_PICKER_OPTIONS in app.js.
const pickerKeys = (() => {
    const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = src.indexOf('const MISSION_PICKER_OPTIONS = {');
    const block = start < 0 ? '' : src.slice(start, src.indexOf('\n};\n', start));
    const keys = new Set();
    for (const line of block.split('\n')) {
        if (!/classic:/.test(line)) continue;
        const value = (line.match(/value: '([^']+)'/) || [])[1] || 'byTarget';
        ['classic', 'radioShort', 'radioFull'].forEach(f => keys.add(`picker.${value}.${f}`));
    }
    return keys;
})();
const airportTypeIds = new Set([...fs.readFileSync(path.join(ROOT, 'airport-type-filter.js'), 'utf8').matchAll(/id: '([a-z]+)'/g)].map(m => m[1]).concat(['trafficGa', 'count']));
const jsCode = literalFiles().filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const errors = [];
const warnings = [];

for (const [key, where] of used) {
    if (!(key in dict.en)) errors.push(`${where}  "${key}" has no English text`);
}
for (const key of Object.keys(dict.en)) {
    if (key in dict.de && placeholders(dict.de[key]) !== placeholders(dict.en[key])) {
        errors.push(`i18n: "${key}" placeholders differ (de: {${placeholders(dict.de[key])}} en: {${placeholders(dict.en[key])}})`);
    }
    if (key.startsWith('picker.')) {
        if (!pickerKeys.has(key)) warnings.push(`i18n  "${key}" matches no option in MISSION_PICKER_OPTIONS (renamed?)`);
        continue;
    }
    if (key.startsWith('airportTypes.group.') || key.startsWith('airportTypes.radio.')) {
        const id = key.split('.')[2];
        if (!airportTypeIds.has(id)) warnings.push(`i18n  "${key}" matches no group in airport-type-filter.js`);
        continue;
    }
    if (key.startsWith('help.')) {
        if (validHelp && !validHelp.has(key)) warnings.push(`i18n  "${key}" matches no entry in SETTINGS_HELP_CONTENT (renamed?)`);
        continue;
    }
    // Keys built from a prefix in code, e.g. tr('skins.dir.' + dir, ...), count as used.
    const parts = key.split('.');
    const prefixUsed = parts.slice(1).some((_, i) => {
        const prefix = parts.slice(0, i + 1).join('.');
        return jsCode.includes(`'${prefix}.'`) || jsCode.includes(`\`${prefix}.`);
    });
    if (!used.has(key) && !(key in dict.de) && !jsCode.includes(`'${key}'`) && !prefixUsed) warnings.push(`i18n/en.js  "${key}" is used neither in index.html nor in JS`);
}
// Start texts marked data-i18n-initial need a phrase entry.
{
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const m of html.matchAll(/<[^>]*\sdata-i18n-initial\b[^>]*>([^<]*)</g)) {
        const text = String(m[1] || '').trim();
        if (text && !(text in dict.phrases)) errors.push(`index.html:${lineAt(html, m.index)}  data-i18n-initial "${text}" has no phrase in i18n/en-phrases.js`);
    }
}
// Phrases must still exist as German text somewhere in the web code, otherwise they are stale.
{
    const code = `${jsCode}\n${fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')}`;
    for (const german of Object.keys(dict.phrases)) {
        // Source code writes line breaks as \n, so also look for the escaped form.
        if (!code.includes(german) && !code.includes(JSON.stringify(german).slice(1, -1))) warnings.push(`i18n/en-phrases.js  "${german}" no longer appears in the code`);
    }
}
for (const key of Object.keys(dict.de)) {
    if (!(key in dict.en)) warnings.push(`i18n/de.js  "${key}" has no English text`);
}

const scan = new Map(literalFiles().map(f => [f, germanLiterals(f)]));
const literalTotal = [...scan.values()].reduce((n, items) => n + items.length, 0);

console.log(`i18n: ${used.size} keys in index.html, ${Object.keys(dict.en).length} English, ${Object.keys(dict.de).length} German (JS only), ${Object.keys(dict.phrases).length} phrases`);
warnings.forEach(w => console.log(`warn   ${w}`));

if (args.has('--update-baseline')) {
    const total = writeBaseline(scan);
    console.log(`literals: baseline written, ${total} German literals in ${scan.size} files`);
} else {
    const baseline = readBaseline();
    if (!baseline) {
        console.log('literals: no baseline yet, run with --update-baseline once');
    } else {
        let fresh = 0;
        for (const [file, items] of scan) {
            const known = new Set(baseline.files[file] || []);
            const newItems = items.filter(i => !known.has(i.hash));
            fresh += newItems.length;
            newItems.slice(0, 20).forEach(i => {
                const shown = i.text.length > 90 ? `${i.text.slice(0, 87)}...` : i.text;
                console.log(`new    ${file}:${items.lineOf(i)}  ${shown}`);
            });
            if (newItems.length > 20) console.log(`new    ${file}: ${newItems.length - 20} more`);
        }
        const diff = literalTotal - baseline.total;
        const trend = diff < 0 ? `${-diff} fewer` : diff > 0 ? `${diff} more` : 'unchanged';
        console.log(`literals: ${literalTotal} German literals (baseline ${baseline.total}, ${trend}), ${fresh} not in baseline`);
    }
}
if (args.has('--files')) {
    [...scan].filter(([, items]) => items.length).sort((a, b) => b[1].length - a[1].length)
        .forEach(([file, items]) => console.log(`       ${String(items.length).padStart(5)}  ${file}`));
}

errors.forEach(e => console.log(`error  ${e}`));
console.log(errors.length ? `${errors.length} error(s)` : 'ok');
process.exit(errors.length ? 1 : 0);
