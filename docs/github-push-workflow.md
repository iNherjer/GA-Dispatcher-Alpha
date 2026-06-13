# GitHub Push Workflow (verbindlich)

Diese Regeln gelten als Standard fuer normale Pushes in diesem Repo. Das Standardziel ist immer
`origin/main`, ausser der User verlangt ausdruecklich einen separaten Branch oder PR.

## 1) Normaler Push nach `origin/main`

1. Vor dem Push immer zuerst die SW-Version in `sw.js` erhoehen:
   - `const CACHE = 'ga-dispatcher-vXXX';`
   - `XXX` um `+1` erhoehen.
2. Preflight:
   - `git status -sb`
   - `git diff --stat`
3. Nur gewuenschte Dateien committen:
   - Bei gemischtem Worktree niemals `git add -A`.
   - Stattdessen explizit nur die Fix-Dateien stage'n, z. B. `git add sw.js index.html sync.js`.
4. Ausgeschlossene Dateien nicht committen/pushen (z. B. laut `.gitignore` wie `*.exe`, `.DS_Store`, `.env*`, `.wrangler/state`, temporaere `analysis/*.json`).
5. Nach `origin/main` pushen:
   - Wenn der aktuelle Branch `main` ist: `git push origin main`
   - Wenn Codex auf einem Arbeitsbranch steht, der Stand aber direkt nach `main` soll: zuerst Fast-Forward pruefen, dann `git push origin HEAD:main`
   - Nicht nur den Arbeitsbranch pushen, wenn der User "main" oder den normalen Push meint.

## 1a) Codex-Hinweise

1. Wenn Codex in einer Sandbox laeuft, koennen Branch-/Upstream-Schritte Freigaben brauchen, weil sie in `.git` schreiben.
2. Das ist kein inhaltlicher Blocker: nach Freigabe normal mit `git switch`, `git push origin HEAD:main` oder `git branch --set-upstream-to=...` fortfahren. `git push -u origin <branch>` nur nutzen, wenn wirklich ein separater Branch/PR gewuenscht ist.
3. Wenn der Remote-Push erfolgreich war, aber das lokale Upstream-Tracking wegen `.git/config` scheitert:
   - Remote-Branch kurz mit `git ls-remote --heads origin <branch>` pruefen.
   - Danach bei Bedarf `git fetch origin <branch>:refs/remotes/origin/<branch>` und `git branch --set-upstream-to=origin/<branch> <branch>` ausfuehren.

## 2) Sonderfall: `ga-tracker-client/tracker.js` wurde geaendert

1. EXE neu bauen:
   - Im Ordner `ga-tracker-client`:
   - `npm run build:tracker`
2. Danach zusaetzlich auf `origin` releasen:
   - Nur die gebaute Datei `ga-tracker-client/VFR-Multitool-Tracker.exe` als Release-Asset veroeffentlichen.

## 3) Prioritaet

Wenn `tracker.js` geaendert wurde, gilt beides:
1. normaler Push-Workflow (inkl. SW hochzaehlen)
2. plus EXE-Build und Release auf `origin`.
