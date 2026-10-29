// PPL theory quiz as a large note on the private pinboard.
// One batch per local day, wrong answers come back the next day, progress per question ID.
// Catalog: data/ppl-quiz-catalog.json (built by tools/ppl-quiz-build-catalog.mjs).
// Docs: docs/PPL Quiz.md
(function () {
    'use strict';

    const STATE_KEY = 'ga_ppl_quiz_v1';
    // Set by tools/ppl-quiz-build-catalog.mjs; a new value makes devices download the catalog once.
    const CATALOG_VERSION = '15-434cf8e3';
    const CATALOG_URL = 'data/ppl-quiz-catalog.json?v=' + CATALOG_VERSION;
    const COUNTS = [5, 10, 15];
    // Days until a question is due again after 1, 2, 3, 4, 5+ correct answers in a row.
    const INTERVALS = [1, 3, 7, 14, 30];
    const MASTERED_STREAK = 3;
    const LETTERS = ['A', 'B', 'C', 'D'];

    let catalog = null;
    let catalogPromise = null;
    let catalogError = '';
    let byId = {};
    let view = 'quiz';
    let card = null;

    // ---------- state ----------
    // p[id] = [attempts, correct, streak, lastDay, lastWrong]
    // b = { d: day, ids: [...], ans: { id: answerKey }, cur: index }
    function defaults() {
        return { v: 1, on: false, cfg: { n: 5, cats: null, retry: true, calc: true, daily: true }, p: {}, b: null, pos: null, seen: 0 };
    }
    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
            if (!raw || raw.v !== 1) return defaults();
            const s = defaults();
            s.on = raw.on === true;
            const cfg = raw.cfg || {};
            s.cfg.n = COUNTS.includes(cfg.n) ? cfg.n : 5;
            s.cfg.cats = Array.isArray(cfg.cats) ? cfg.cats.filter(c => typeof c === 'string') : null;
            s.cfg.retry = cfg.retry !== false;
            s.cfg.calc = cfg.calc !== false;
            s.cfg.daily = cfg.daily !== false;
            if (raw.p && typeof raw.p === 'object') {
                for (const [id, row] of Object.entries(raw.p)) {
                    if (Array.isArray(row) && row.length === 5 && row.every(Number.isFinite)) s.p[id] = row;
                }
            }
            const b = raw.b;
            if (b && Number.isInteger(b.d) && Array.isArray(b.ids) && b.ans && typeof b.ans === 'object') {
                s.b = { d: b.d, ids: b.ids.filter(id => typeof id === 'string'), ans: b.ans, cur: Number.isInteger(b.cur) ? b.cur : 0 };
            }
            if (Number.isInteger(raw.seen)) s.seen = raw.seen;
            if (raw.pos && Number.isFinite(raw.pos.x) && Number.isFinite(raw.pos.y)) s.pos = { x: raw.pos.x, y: raw.pos.y };
            return s;
        } catch (_) {
            return defaults();
        }
    }
    let state = load();
    function save() {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function today() {
        const now = new Date();
        return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    }

    // ---------- catalog ----------
    function loadCatalog() {
        if (catalog) return Promise.resolve(catalog);
        if (!catalogPromise) {
            catalogPromise = fetch(CATALOG_URL)
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(data => {
                    if (data.format !== 1 || !Array.isArray(data.questions)) throw new Error('Unbekanntes Katalogformat');
                    catalog = data;
                    byId = Object.fromEntries(data.questions.map(q => [q.id, q]));
                    catalogError = '';
                    return catalog;
                })
                .catch(err => {
                    catalogError = 'Fragenkatalog nicht verfügbar (' + (err.message || err) + ').';
                    catalogPromise = null;
                    throw err;
                });
        }
        return catalogPromise;
    }

    function activeCats() {
        const all = catalog.categories.map(c => c[0]);
        if (!state.cfg.cats) return all;
        return all.filter(c => state.cfg.cats.includes(c));
    }
    function catName(id) {
        return catalog?.categories.find(c => c[0] === id)?.[1] || id;
    }

    // ---------- batch selection ----------
    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }
    function dueDay(row) {
        const streak = row[2];
        if (!streak) return row[3];
        return row[3] + INTERVALS[Math.min(streak, INTERVALS.length) - 1];
    }

    // Order of priority: wrong answers from earlier days (if enabled), due repeats, unseen,
    // then anything else. Arithmetic variants are capped so one family does not fill the note.
    function pickBatch(day, excludeToday) {
        const cats = new Set(activeCats());
        const n = state.cfg.n;
        const pool = catalog.questions.filter(q => cats.has(q.c) && (state.cfg.calc || !q.r)
            && !(excludeToday && state.p[q.id]?.[3] === day));
        const wrong = [], due = [], fresh = [], rest = [];
        for (const q of pool) {
            const row = state.p[q.id];
            if (!row) fresh.push(q);
            else if (row[4] && row[3] < day) (state.cfg.retry ? wrong : due).push(q);
            else if (dueDay(row) <= day) due.push(q);
            else rest.push(q);
        }
        wrong.sort((a, b) => state.p[a.id][3] - state.p[b.id][3]);
        due.sort((a, b) => dueDay(state.p[a.id]) - dueDay(state.p[b.id]));
        shuffle(fresh); shuffle(rest);

        const picked = wrong.slice(0, n);
        const calcCap = Math.max(1, Math.round(n * 0.2));
        let calcCount = picked.filter(q => q.r).length;
        const take = (list, limit) => {
            for (const q of list) {
                if (picked.length >= n || limit <= 0) return;
                if (picked.includes(q)) continue;
                if (q.r && calcCount >= calcCap) continue;
                picked.push(q); limit--;
                if (q.r) calcCount++;
            }
        };
        const open = n - picked.length;
        take(due, Math.ceil(open / 2));
        take(fresh, n);
        take(due, n);
        take(rest, n);
        if (picked.length < n) { calcCount = -Infinity; take(fresh.concat(due, rest), n); }
        return shuffle(picked).map(q => q.id);
    }

    function newBatch(excludeToday) {
        const day = today();
        state.b = { d: day, ids: pickBatch(day, excludeToday), ans: {}, cur: 0 };
        save();
    }
    function ensureBatch() {
        const b = state.b;
        const stale = state.cfg.daily && b && b.d !== today();
        if (!b || stale || !b.ids.length || b.ids.some(id => !byId[id])) newBatch(false);
    }
    // Daily mode: a new day brings a new note and shows the quiz on the pinboard again.
    function dailyDue() {
        // Only for people who have used the quiz before (a batch exists).
        return state.cfg.daily && !!state.b && state.b.d !== today();
    }
    function applyDailyOpen() {
        if (dailyDue() && !state.on) { state.on = true; save(); }
    }
    // Daily mode: badge on the pinboard buttons until the private board was opened today.
    function hasNew() {
        return state.cfg.daily && !!state.b && state.seen !== today();
    }
    function pinboardVisible() {
        return !!document.getElementById('pinboardOverlay')?.classList.contains('active');
    }
    function markSeen() {
        if (state.seen === today()) return;
        state.seen = today();
        save();
        updateButton();
    }
    function restart() {
        const b = state.b;
        const answered = b ? Object.keys(b.ans).length : 0;
        const text = answered
            ? 'Laufendes Quiz abbrechen und neue Fragen ziehen? Bereits gegebene Antworten bleiben in der Statistik.'
            : 'Diesen Zettel verwerfen und neue Fragen ziehen?';
        if (!confirm(text)) return;
        view = 'quiz';
        newBatch(true);
        if (!state.b.ids.length) newBatch(false);
        draw();
    }
    function batchUntouched() {
        return state.b && Object.keys(state.b.ans).length === 0;
    }

    // Stable answer order per question and day without storing it.
    function answerOrder(q) {
        let h = 2166136261;
        for (const ch of q.id + ':' + (state.b?.d || 0)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
        const order = q.a.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
            const j = h % (i + 1);
            [order[i], order[j]] = [order[j], order[i]];
        }
        return order.map(i => q.a[i]);
    }

    function answer(id, key) {
        const b = state.b;
        if (!b || b.ans[id] !== undefined) return;
        const q = byId[id];
        const ok = key === q.k;
        const day = today();
        const old = state.p[id] || [0, 0, 0, 0, 0];
        state.p[id] = [old[0] + 1, old[1] + (ok ? 1 : 0), ok ? old[2] + 1 : 0, day, ok ? 0 : 1];
        b.ans[id] = key;
        save();
        draw();
    }

    // ---------- DOM helpers ----------
    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }
    function button(cls, text, onClick, title) {
        const node = el('button', 'ppl-quiz-ui ' + cls, text);
        node.type = 'button';
        if (title) { node.title = title; node.setAttribute('aria-label', title); }
        node.addEventListener('click', event => { event.stopPropagation(); onClick(event); });
        return node;
    }

    // ---------- views ----------
    function drawQuiz(body) {
        const b = state.b;
        if (!b.ids.length) {
            body.append(el('p', 'ppl-quiz-empty', 'Gerade keine passenden Fragen offen. Morgen gibt es einen neuen Zettel, oder über das Zahnrad weitere Fächer wählen.'));
            return;
        }
        const answered = b.ids.filter(id => b.ans[id] !== undefined);
        if (answered.length === b.ids.length && b.cur >= b.ids.length) return drawSummary(body);
        b.cur = Math.min(Math.max(0, b.cur), b.ids.length - 1);

        const dots = el('div', 'ppl-quiz-dots');
        b.ids.forEach((id, i) => {
            const given = b.ans[id];
            const state_ = given === undefined ? 'is-open' : (given === byId[id].k ? 'is-ok' : 'is-wrong');
            const dot = button('ppl-quiz-dot ' + state_ + (i === b.cur ? ' is-current' : ''), String(i + 1), () => { b.cur = i; save(); draw(); }, 'Frage ' + (i + 1));
            dots.append(dot);
        });
        body.append(dots);

        const q = byId[b.ids[b.cur]];
        const given = b.ans[q.id];
        body.append(el('div', 'ppl-quiz-topic', catName(q.c) + (q.t ? ' · ' + q.t : '')));
        body.append(el('div', 'ppl-quiz-question', q.q));
        if (q.m) {
            const img = el('img', 'ppl-quiz-media');
            img.src = q.m[0];
            img.alt = q.m[1] || '';
            img.loading = 'lazy';
            body.append(img);
        }

        const list = el('div', 'ppl-quiz-answers');
        answerOrder(q).forEach((a, i) => {
            let cls = 'ppl-quiz-answer';
            if (given !== undefined) {
                if (a[0] === q.k) cls += ' is-correct';
                else if (a[0] === given) cls += ' is-chosen-wrong';
                else cls += ' is-dim';
            }
            const row = button(cls, '', () => answer(q.id, a[0]));
            row.append(el('b', '', LETTERS[i]), el('span', '', a[1]));
            if (given !== undefined) row.disabled = true;
            list.append(row);
        });
        body.append(list);

        if (given !== undefined) {
            const ok = given === q.k;
            const box = el('div', 'ppl-quiz-feedback ' + (ok ? 'is-ok' : 'is-wrong'));
            box.append(el('strong', '', ok ? '✓ Richtig. ' : '✗ Leider falsch. '));
            const chosen = q.a.find(a => a[0] === given);
            const right = q.a.find(a => a[0] === q.k);
            if (!ok && chosen?.[2]) box.append(el('span', '', chosen[2] + ' '));
            if (right?.[2]) box.append(el('span', '', (ok ? '' : 'Richtig: ') + right[2]));
            else if (!ok && right) box.append(el('span', '', 'Richtig ist: ' + right[1]));
            const src = q.s?.[0];
            const meta = catalog.sources[src?.[0]];
            if (src && meta) {
                const link = el('a', 'ppl-quiz-ui ppl-quiz-source', '🔗');
                link.href = meta[1] + (src[2] && !meta[1].includes('#') ? '#page=' + src[2] : '');
                link.target = '_blank';
                link.rel = 'noopener';
                link.title = 'Quelle: ' + meta[0] + (src[1] ? ' – ' + src[1] : '');
                link.setAttribute('aria-label', link.title);
                box.append(' ', link);
            }
            body.append(box);
            const notice = catalog.notices?.[q.c];
            if (notice) body.append(noticeLine(notice));
            const nextOpen = b.ids.findIndex((id, i) => i > b.cur && b.ans[id] === undefined);
            const firstOpen = b.ids.findIndex(id => b.ans[id] === undefined);
            const target = nextOpen >= 0 ? nextOpen : firstOpen;
            const nav = el('div', 'ppl-quiz-nav');
            nav.append(target >= 0
                ? button('ppl-quiz-btn', 'Weiter ›', () => { b.cur = target; save(); draw(); })
                : button('ppl-quiz-btn is-primary', 'Auswertung ›', () => { b.cur = b.ids.length; save(); draw(); }));
            body.append(nav);
        }
    }

    // Licence attribution for official catalogues (e.g. BZF, CC BY-ND 4.0).
    function noticeLine(notice) {
        const line = el('p', 'ppl-quiz-notice', notice.short + ' · ');
        line.title = notice.full || '';
        const src = el('a', 'ppl-quiz-ui', 'Original');
        src.href = notice.source; src.target = '_blank'; src.rel = 'noopener';
        const lic = el('a', 'ppl-quiz-ui', 'Lizenz');
        lic.href = notice.license; lic.target = '_blank'; lic.rel = 'noopener';
        line.append(src, ' · ', lic);
        return line;
    }

    function drawSummary(body) {
        const b = state.b;
        const right = b.ids.filter(id => b.ans[id] === byId[id].k).length;
        const wrong = b.ids.length - right;
        body.append(el('div', 'ppl-quiz-score', `${right} von ${b.ids.length} richtig`));
        if (wrong && state.cfg.retry) body.append(el('p', 'ppl-quiz-hint', `Die ${wrong === 1 ? 'falsche Frage kommt' : wrong + ' falschen Fragen kommen'} morgen wieder.`));
        else if (!wrong) body.append(el('p', 'ppl-quiz-hint', 'Alles richtig. Sauber geflogen!'));
        const list = el('div', 'ppl-quiz-dots');
        b.ids.forEach((id, i) => list.append(button('ppl-quiz-dot ' + (b.ans[id] === byId[id].k ? 'is-ok' : 'is-wrong'), String(i + 1), () => { b.cur = i; save(); draw(); }, 'Frage ' + (i + 1) + ' ansehen')));
        body.append(list);
        const nav = el('div', 'ppl-quiz-nav');
        nav.append(button('ppl-quiz-btn is-primary', `🔄 ${state.cfg.n} neue ziehen`, () => {
            newBatch(true);
            if (!state.b.ids.length) body.replaceChildren(el('p', 'ppl-quiz-empty', 'Für heute sind alle passenden Fragen durch.'));
            else draw();
        }));
        body.append(nav);
    }

    function catStats() {
        const rows = catalog.categories.map(([id, name]) => ({ id, name, total: 0, seen: 0, attempts: 0, correct: 0, mastered: 0 }));
        const byCat = Object.fromEntries(rows.map(r => [r.id, r]));
        for (const q of catalog.questions) {
            const r = byCat[q.c];
            if (!r || (!state.cfg.calc && q.r)) continue;
            r.total++;
            const p = state.p[q.id];
            if (!p) continue;
            r.seen++; r.attempts += p[0]; r.correct += p[1];
            if (p[2] >= MASTERED_STREAK) r.mastered++;
        }
        return rows;
    }

    function drawSettings(body) {
        const section = (title) => { const s = el('div', 'ppl-quiz-section'); s.append(el('div', 'ppl-quiz-section-title', title)); body.append(s); return s; };

        const countSec = section('Fragen pro Zettel');
        const seg = el('div', 'ppl-quiz-seg');
        COUNTS.forEach(n => seg.append(button('ppl-quiz-seg-btn' + (state.cfg.n === n ? ' is-on' : ''), String(n), () => {
            state.cfg.n = n;
            if (batchUntouched()) newBatch(false); else save();
            draw();
        })));
        countSec.append(seg);

        const catSec = section('Fächer');
        const cats = new Set(activeCats());
        const grid = el('div', 'ppl-quiz-cats');
        catalog.categories.forEach(([id, name]) => {
            grid.append(button('ppl-quiz-cat' + (cats.has(id) ? ' is-on' : ''), name, () => {
                const next = new Set(activeCats());
                if (next.has(id)) next.delete(id); else next.add(id);
                if (!next.size) return;
                state.cfg.cats = next.size === catalog.categories.length ? null : [...next];
                if (batchUntouched()) newBatch(false); else save();
                draw();
            }));
        });
        catSec.append(grid);

        const optSec = section('Optionen');
        const toggle = (label, key, affectsQuestions = true) => {
            const row = button('ppl-quiz-toggle' + (state.cfg[key] ? ' is-on' : ''), '', () => {
                state.cfg[key] = !state.cfg[key];
                if (affectsQuestions && batchUntouched()) newBatch(false); else save();
                draw();
            });
            row.append(el('span', '', label), el('span', 'ppl-quiz-toggle-state', state.cfg[key] ? 'AN' : 'AUS'));
            optSec.append(row);
        };
        toggle('Tägliche Aufgaben', 'daily', false);
        toggle('Falsche am nächsten Tag erneut', 'retry');
        toggle('Rechenaufgaben einmischen', 'calc');
        optSec.append(el('p', 'ppl-quiz-hint', state.cfg.daily
            ? 'Täglich: Jeden Tag ein neuer Zettel, der Quiz-Zettel hängt dann automatisch an der Pinnwand.'
            : 'Ohne tägliche Aufgaben bleibt der Zettel zu, bis du ihn über 🎓 Quiz öffnest. Neue Fragen gibt es mit ↻.'));
        optSec.append(el('p', 'ppl-quiz-hint', 'Änderungen an Anzahl und Fächern gelten ab dem nächsten Zettel, solange der aktuelle schon angefangen ist.'));

        const statSec = section('Statistik');
        const rows = catStats();
        const sum = rows.reduce((a, r) => ({ total: a.total + r.total, seen: a.seen + r.seen, attempts: a.attempts + r.attempts, correct: a.correct + r.correct, mastered: a.mastered + r.mastered }), { total: 0, seen: 0, attempts: 0, correct: 0, mastered: 0 });
        const table = el('div', 'ppl-quiz-stats');
        const statRow = (r, cls) => {
            const rate = r.attempts ? Math.round(r.correct / r.attempts * 100) : null;
            const line = el('div', 'ppl-quiz-stat ' + (cls || ''));
            line.append(el('span', 'ppl-quiz-stat-name', r.name));
            const bar = el('span', 'ppl-quiz-bar');
            const seenFill = el('i', 'ppl-quiz-bar-seen'); seenFill.style.width = (r.total ? r.seen / r.total * 100 : 0) + '%';
            const masteredFill = el('i', 'ppl-quiz-bar-mastered'); masteredFill.style.width = (r.total ? r.mastered / r.total * 100 : 0) + '%';
            bar.append(seenFill, masteredFill);
            line.append(bar, el('span', 'ppl-quiz-stat-num', `${r.seen}/${r.total} · ${rate === null ? '–' : rate + ' %'}`));
            line.title = `${r.seen} von ${r.total} Fragen gesehen, ${r.mastered} gefestigt (${MASTERED_STREAK}× in Folge richtig), Trefferquote ${rate === null ? '–' : rate + ' %'}`;
            return line;
        };
        rows.forEach(r => table.append(statRow(r)));
        table.append(statRow({ ...sum, name: 'Gesamt' }, 'is-total'));
        statSec.append(table);
        statSec.append(el('p', 'ppl-quiz-hint', 'Balken: hell = gesehen, dunkel = gefestigt. Zahl: gesehen/gesamt · Trefferquote.'));
        statSec.append(button('ppl-quiz-btn is-danger', 'Statistik zurücksetzen', () => {
            if (!confirm('Lernstand des PPL-Quiz wirklich zurücksetzen? Alle Antworten und die Statistik werden gelöscht.')) return;
            state.p = {};
            newBatch(false);
            draw();
        }));

        body.append(el('p', 'ppl-quiz-foot', `Katalog Edition ${catalog.edition} (${catalog.questions.length} Fragen, Stand ${catalog.checkedAt}). ${catalog.note}`));
        Object.values(catalog.notices || {}).forEach(notice => body.append(noticeLine(notice)));
    }

    function draw() {
        if (!card) return;
        if (catalog) ensureBatch();
        card.replaceChildren();
        card.append(el('div', 'post-it-pin'));
        const head = el('div', 'ppl-quiz-head');
        const title = el('div', 'ppl-quiz-title', view === 'settings' ? '⚙️ QUIZ-EINSTELLUNGEN' : '🎓 PPL-THEORIE');
        head.append(title);
        if (catalog && state.b && view === 'quiz') {
            const done = state.b.ids.filter(id => state.b.ans[id] !== undefined).length;
            head.append(el('span', 'ppl-quiz-count', `${done}/${state.b.ids.length}`));
        }
        if (catalog && view === 'quiz') head.append(button('ppl-quiz-gear ppl-quiz-restart', '↻', restart, 'Quiz abbrechen und neue Fragen ziehen'));
        head.append(button('ppl-quiz-gear', view === 'settings' ? '✕' : '⚙', () => { view = view === 'settings' ? 'quiz' : 'settings'; draw(); }, view === 'settings' ? 'Einstellungen schließen' : 'Einstellungen und Statistik'));
        card.append(head);

        const body = el('div', 'ppl-quiz-body');
        card.append(body);
        if (!catalog) {
            body.append(el('p', 'ppl-quiz-empty', catalogError || 'Fragen werden geladen …'));
            if (catalogError) body.append(button('ppl-quiz-btn', 'Erneut versuchen', () => { catalogError = ''; draw(); start(); }));
            return;
        }
        if (view === 'settings') drawSettings(body); else drawQuiz(body);
    }

    function start() {
        loadCatalog().then(() => draw()).catch(() => draw());
    }

    // ---------- pinboard integration ----------
    function savePosition() {
        const board = document.getElementById('pinboard');
        if (!card || !board || !board.offsetWidth) return;
        state.pos = { x: card.offsetLeft / board.offsetWidth * 100, y: card.offsetTop / board.offsetHeight * 100 };
        save();
    }

    function renderBoard(board) {
        card = null;
        applyDailyOpen();
        updateButton();
        if (!state.on || !board) return;
        card = el('div', 'post-it ppl-quiz-card');
        const pos = state.pos || { x: 50, y: 4 };
        card.style.left = pos.x + '%';
        card.style.top = pos.y + '%';
        card.style.transform = 'rotate(-1deg)';
        if (typeof makeDraggable === 'function') makeDraggable(card, 'ppl-quiz', false);
        card.addEventListener('mouseup', savePosition);
        card.addEventListener('touchend', savePosition);
        board.appendChild(card);
        draw();
        if (!catalog) start();
        if (pinboardVisible()) markSeen();
    }

    function toggle() {
        if (typeof currentBoardMode !== 'undefined' && currentBoardMode === 'group') {
            alert('Das Quiz hängt auf dem privaten Brett. Bitte zuerst auf „Privat“ wechseln.');
            return;
        }
        state.on = !state.on;
        view = 'quiz';
        save();
        updateButton();
        if (typeof renderNotes === 'function') renderNotes();
    }

    function updateButton() {
        const btn = document.getElementById('pplQuizToggleBtn');
        if (btn) {
            // The quiz only lives on the private board.
            const groupMode = typeof currentBoardMode !== 'undefined' && currentBoardMode === 'group';
            btn.style.display = groupMode ? 'none' : '';
            btn.classList.toggle('is-on', state.on);
            btn.classList.toggle('has-new', hasNew());
        }
        if (typeof updateGroupBadgeUI === 'function') updateGroupBadgeUI();
    }

    // The app may stay open over midnight: check the day when it comes back and once a minute.
    let lastDay = today();
    function checkDay() {
        const day = today();
        if (day === lastDay) return;
        lastDay = day;
        if (pinboardVisible() && typeof renderNotes === 'function') renderNotes();
        else updateButton();
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
    window.addEventListener('focus', checkDay);
    setInterval(checkDay, 60000);

    // Other tabs or a future cloud sync may change the stored state.
    window.addEventListener('storage', event => {
        if (event.key !== STATE_KEY) return;
        state = load();
        updateButton();
        if (card?.isConnected) draw();
    });
    applyDailyOpen();
    document.addEventListener('DOMContentLoaded', updateButton);
    // Preload the catalog in the background for people who use the quiz, so the note opens at once.
    if (state.on || dailyDue()) {
        window.addEventListener('load', () => setTimeout(() => { loadCatalog().catch(() => {}); }, 3000), { once: true });
    }

    window.gaPplQuiz = { renderBoard, toggle, isOn: () => state.on, hasNew, updateButton };
})();
