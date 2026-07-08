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
4. Ausgeschlossene Dateien nicht committen/pushen. Details stehen in Abschnitt 1b.
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

## 1b) Dateien, die beim normalen Push ausgeschlossen bleiben

Diese Dateien duerfen bei normalen Fixes nicht gestaged werden:

- OS-/Editor-Metadaten: `.DS_Store`, `.claude/`
- Secrets und lokale Keys: `.env`, `.env.*`, `key.env.local`, `key.env.*`
- Gebaute Tracker-EXE: `ga-tracker-client/VFR-Multitool-Tracker.exe`
- Cloudflare/Wrangler-Zustand und Cache: `tools/cloudflare-worker/.wrangler/`
- temporaere Analyse- und Dry-run-Artefakte: neue Ad-hoc/SAR/Bush-JSONs unter `analysis/`
- lokale Zwischenablagen und extrahierte Arbeitsdateien: `tmp/`, `SimObjects_Visuals.pdf`
- Workbench-Caches: `.workbench-cache/`, `tools/workbench-cache/`, `workbench-cache/`

Wenn ein Analyse-Snapshot ausnahmsweise als Beleg in den Commit gehoert, muss er
absichtlich und einzeln mit `git add -f <datei>` gestaged werden. Vor jedem Commit
den staged Diff mit `git diff --cached --stat` und bei Bedarf mit
`git diff --cached -- <datei>` kontrollieren.

## 1c) Tile-Workbench-Branch

Die Tile-Workbench pusht Tile-Daten nicht direkt nach `origin/main`, sondern nach
`origin/tile-workbench` (konfigurierbar ueber `OBS_WORKBENCH_PUSH_BRANCH` oder
`tools/workbench.config.json`).

Auf dem Linux-/Workbench-Rechner soll deshalb dauerhaft dieser Branch aktiv sein:

```bash
git fetch origin
git switch tile-workbench || git switch -c tile-workbench origin/main
```

Die Workbench blockt Tile-Pushes, wenn sie auf `main` laeuft oder wenn ein
Merge-/Rebase-Konflikt offen ist.

Vor einem normalen App-Push nach `origin/main` sollen vorhandene Tile-Commits
kontrolliert mitgenommen werden:

```bash
git fetch origin main tile-workbench
git merge --no-ff origin/tile-workbench -m "Merge tile workbench updates"
```

Danach den normalen App-Push fortsetzen. In einem gemischten Worktree diesen
Merge nur ausfuehren, wenn die betroffenen App-Aenderungen bereits bewusst
committed sind oder der Release in einem separaten sauberen Worktree gebaut wird.

## 2) Sonderfall: `ga-tracker-client/tracker.js` wurde geaendert

1. Tracker-Version vor dem Build erhoehen:
   - In `ga-tracker-client/tracker.js`:
     - `TRACKER_VERSION` und `TRACKER_VERSION_CODE` um `+1` erhoehen.
   - In `sync.js`:
     - `MIN_TRACKER_VERSION_CODE` und `MIN_TRACKER_VERSION_LABEL` auf dieselbe neue Tracker-Version setzen, damit alte EXEs die Update-Warnung ausloesen.
2. EXE neu bauen:
   - Im Ordner `ga-tracker-client`:
   - `npm run build:tracker`
3. Danach zusaetzlich auf `origin` releasen:
   - Nur die gebaute Datei `ga-tracker-client/VFR-Multitool-Tracker.exe` als Release-Asset veroeffentlichen.

## 3) Prioritaet

Wenn `tracker.js` geaendert wurde, gilt beides:
1. normaler Push-Workflow (inkl. SW hochzaehlen)
2. plus EXE-Build und Release auf `origin`.

## 4) Stable-Deploy mit Custom Domain

`stable/main` liegt auf dem separaten Remote `stable` (`iNherjer/VFR-Multitool`) und
veroeffentlicht die Custom Domain `www.vfr-multitool.de`.

Wichtig: `stable/main` darf deshalb nicht mehr hart und bytegenau auf `origin/main`
gesetzt werden. Ein exakter Force-Sync entfernt die `CNAME`-Datei aus Stable und
loescht damit die Custom-Domain-Bindung bei GitHub Pages.

Der richtige Stable-Deploy ist:

1. Beta wie bisher auf den aktuellen `origin/main`-SHA nachziehen.
2. Stable mit dem Overlay-Helper deployen:
   - `node tools/deploy-stable-pages.mjs`
3. Danach die Refs und den Pages-Run live pruefen:
   - `git ls-remote origin refs/heads/main refs/heads/beta`
   - `git ls-remote beta refs/heads/main`
   - `git ls-remote stable refs/heads/main`
   - `gh run list -R iNherjer/VFR-Multitool --limit 5`

Der Helper erstellt aus dem aktuellen `origin/main`-Commit einen temporaeren
Stable-Deploy-Commit mit nur einer zusaetzlichen Datei:

- `CNAME` mit `www.vfr-multitool.de`

Dann pusht er diesen Commit per `--force-with-lease` nach `stable/main` und stoesst
einen GitHub-Pages-Build fuer `iNherjer/VFR-Multitool` an. Stable ist dadurch
inhaltlich auf Origin-Stand, behaelt aber sein notwendiges Pages-Metadatum.

Wenn `stable/main` lokale Stable-only Commits enthaelt, die mehr als `CNAME`
aendern, bricht der Helper ab. Nur wenn diese Ueberschreibung bewusst gewollt ist,
darf `--allow-overwrite` verwendet werden.
