# GitHub Push Workflow (verbindlich)

Diese Regeln gelten als Standard fuer normale Pushes in diesem Repo.

## 1) Normaler Push nach `origin/main`

1. Vor dem Push immer zuerst die SW-Version in `sw.js` erhoehen:
   - `const CACHE = 'ga-dispatcher-vXXX';`
   - `XXX` um `+1` erhoehen.
2. Nur gewuenschte Dateien committen.
3. Ausgeschlossene Dateien nicht committen/pushen (z. B. laut `.gitignore` wie `*.exe`, `.DS_Store`, `.env*`).
4. Nach `origin main` pushen.

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
