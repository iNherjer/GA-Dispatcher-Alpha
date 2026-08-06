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
   - Jede Version als eigenen unveraenderlichen Release `v<code>` veroeffentlichen.
   - Nur die gebaute Datei `ga-tracker-client/VFR-Multitool-Tracker.exe` als Release-Asset veroeffentlichen.
   - `ga-tracker-client/channel/stable.json` auf denselben Tag, die exakte Dateigroesse und SHA-256 setzen.
   - Der dauerhafte App-Link `/api/tracker/download` liest diesen Kanal; `index.html` muss bei kuenftigen Tracker-Releases nicht erneut angepasst werden.

## 3) Prioritaet

Wenn `tracker.js` geaendert wurde, gilt beides:
1. normaler Push-Workflow (inkl. SW hochzaehlen)
2. plus EXE-Build und Release auf `origin`.

## 3a) Tracker-Desktop-App und Autoupdater

Die installierbare Desktop-App liegt unter `ga-tracker-client/desktop`. Sie
ist ein schlanker Bootstrapper und buendelt keine Tracker-EXE. Die Runtime wird
beim ersten Start aus `ga-tracker-client/channel/stable.json` geladen, geprueft
und versioniert in LocalAppData abgelegt.

1. Vor einem Desktop-Release:
   - `version` in `ga-tracker-client/desktop/package.json` als SemVer erhoehen.
   - Der Tracker-Kanal muss auf ein vorhandenes, vollstaendig getestetes
     origin-Release nach Abschnitt 2 zeigen.
2. Desktop-Tests und Build:
   - `cd ga-tracker-client/desktop`
   - `npm test`
   - `npm run build:win`
3. Release:
   - Unveraenderlichen Tag `tracker-desktop-v<version>` verwenden.
   - Installer, Blockmap und die zugehoerigen Update-Metadaten gemeinsam hochladen.
   - Bei vorhandenem Authenticode-Zertifikat zuerst die separat veroeffentlichte
     Tracker-Runtime, dann App und Installer signieren und alle Signaturen vor
     dem Upload pruefen.
4. Stable-Kanal zuletzt umschalten:
   - `npm run prepare:channel` erzeugt den Release-spezifischen Stable-Zeiger.
   - `ga-tracker-client/channel/desktop/latest.yml` muss auf die exakten
     GitHub-Release-Artefakte dieses Tags zeigen.
   - Erst nach Download-, Hash-, Installations-, Start- und Update-Test committen.

Ohne oeffentlich vertrauenswuerdiges Zertifikat ist der Build funktionsfaehig,
kann aber dieselbe SmartScreen-Warnung wie die bisherige portable EXE ausloesen.
Ein selbst signiertes Entwicklungszertifikat darf nicht als produktive
Vertrauensloesung dargestellt werden.

## 3b) AccuSim-Bridge und Tracker-Integration

Die optionale Bridge liegt unter `ga-tracker-client/accusim-router-desktop` und
wird im separaten oeffentlichen Repository
`iNherjer/AccuSim-DRSM-Telemetry-Router` veroeffentlicht. Seit Bridge `1.12.0`
steuert der Tracker sie ueber ein versioniertes lokales Protokoll.

Bei gemeinsamen Releases gilt zwingend diese Reihenfolge:

1. Bridge-Version in `accusim-router-desktop/package.json` erhoehen, Tests und
   `npm run build:win` ausfuehren.
2. Bridge-Release mit Bootstrapper, passendem NSIS-Payload und `latest.yml`
   vollstaendig veroeffentlichen und den Download pruefen.
3. Erst danach die Tracker-Desktop-Version bauen und veroeffentlichen. Der
   Tracker-Button laedt immer das neueste stabile Bridge-Release und darf daher
   nicht vor der von ihm mindestens verlangten Bridge-Version live gehen.

Normale spaetere Bridge-Updates benoetigen keine Tracker-Aenderung, solange
`CONTROL_PROTOCOL_VERSION` kompatibel bleibt. Die laufende Bridge meldet ihre
App-Version selbst; im gestoppten Zustand liest der Tracker die installierte
Version aus Windows-Registry beziehungsweise EXE-Dateiinformationen. Die
Konstante `MIN_BRIDGE_INTEGRATION_VERSION` darf nur angehoben werden, wenn der
Tracker eine tatsaechlich neuere Bridge-Funktion zwingend benoetigt.

## 4) Beta- und Stable-Synchronisierung

`beta/main` und `stable/main` liegen auf separaten Remotes und sollen jeweils exakt
dem aktuellen `origin/main`-Commit entsprechen. Es gibt keine Stable-spezifische
`CNAME`- oder Custom-Domain-Ausnahme.

1. Aktuellen Origin-Commit und Ziel-Branches live pruefen:
   - `git ls-remote origin refs/heads/main`
   - `git ls-remote beta refs/heads/main`
   - `git ls-remote stable refs/heads/main`
2. Bei einem Fast-Forward den exakten Origin-SHA auf beide Ziele pushen:
   - `git push beta <origin-main-sha>:refs/heads/main`
   - `git push stable <origin-main-sha>:refs/heads/main`
3. Danach die Refs und Pages-Runs live pruefen:
   - `git ls-remote beta refs/heads/main`
   - `git ls-remote stable refs/heads/main`
   - `gh run list -R iNherjer/GA-Dispatcher-beta --limit 5`
   - `gh run list -R iNherjer/VFR-Multitool --limit 5`
