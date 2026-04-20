## GA Dispatcher — Copilot instructions

This file explains the project structure, runtime behavior, and code patterns an AI coding agent should know before making changes.

- **Big picture:** Single-page, client-side app that runs entirely in the browser. UI, state and data generation live in plain JavaScript files: [index.html](index.html), [app.js](app.js#L1), [datenbank.js](datenbank.js#L1) and [missions.js](missions.js#L1). Leaflet is included via CDN for the map UI.

- **How to run / test locally:** No build step. Serve the folder over HTTP and open `index.html` in a browser. Example quick command:

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

- **State & persistence:** The app uses `localStorage` extensively. Important keys:
  - `ga_active_mission` — JSON snapshot saved by `saveMissionState()` / loaded by `restoreMissionState()` in `app.js`.
  - `ga_theme`, `ga_panel_theme` — UI theme choices.
  - `ga_gemini_key`, `ga_ai_enabled` — optional Gemini API key and AI toggle.
  - `ga_pinboard`, `ga_pinboard_init`, `ga_poi_history` — pinboard and POI history.

- **Primary responsibilities of files:**
  - [app.js](app.js#L1): UI logic, DOM manipulation, persistence, map integration, drag-knobs, drum counters and mission save/restore. Many global functions and variables live here — edit carefully.
  - [datenbank.js](datenbank.js#L1): Static database fallback containing `coreDB`, `missions`, `poiMissions`, and `fallbackPOIs`. Use this file to add or adjust static content and core airports.
  - [missions.js](missions.js#L1): Dynamic POI mission generator (`generateDynamicPOIMission`). Modify templates here when you want richer POI descriptions or payload logic.
  - [index.html](index.html#L1): The DOM and many element `id`s referenced from `app.js` (e.g. `startLoc`, `destLoc`, `tasSlider`, `tasRadioDisplay`, `briefingBox`). If you rename an element, update all direct references in `app.js`.

- **Conventions & patterns to preserve:**
  - Many functions directly query elements by `id`. Prefer updating both the HTML and `app.js` together — avoid silent renames.
  - LocalStorage keys and the `ga_` prefix are used consistently; preserve keys when refactoring or migrating state.
  - Theme values: `classic`, `retro`, `navcom` — these are used for CSS class toggles and conditional UI logic (`setTheme`, `applySavedPanelTheme`).
  - Mission state shape: `saveMissionState()` writes a specific object (fields like `mTitle`, `mStory`, `mDepICAO`, `currentMissionData`, `routeWaypoints`, `currentStartICAO`, `currentDestICAO`). When changing state fields, update both save/restore functions.

- **Integration points & external deps:**
  - Leaflet: loaded from CDN in `index.html` and expected by `app.js` to build `map` / route rendering. Keep the CDN link or replace coherently.
  - Optional Gemini API: `apiKeyInput` and `ga_gemini_key` enable serverless dynamic mission generation (local-only). If adding server-side components, clearly separate them and avoid leaking keys.

- **What to watch out for when modifying code:**
  - `app.js` is large and full of global state — prefer small, local changes. If extracting modules, update `index.html` script order to preserve globals.
  - UI uses many hard-coded IDs and class names referenced from JS and CSS. Search for the `id` before renaming.
  - `missions.js` uses `localStorage` history (`ga_poi_history`) to avoid repetition — preserve that logic if you change selection behavior.

- **Examples (how to perform common tasks):**
  - Add a new airport fallback: edit [datenbank.js](datenbank.js#L1) inside `coreDB`.
  - Add a new POI mission template for a castle: add templates in `missions.js` inside the `burg|schloss` branch of `generateDynamicPOIMission`.
  - Add a new UI control bound to mission state: add element to [index.html](index.html#L1) and add `document.getElementById('newId')` usage in `saveMissionState()` / `restoreMissionState()`.

- **Debugging & quick checks:**
  - Use browser DevTools console and `localStorage` inspector. `console.log` is the fastest verification method.
  - To reset app state, run `localStorage.clear()` or the in-app `resetApp()` UI control.
  - To test mission generation, click the `Auftrag generieren`/`DISPATCH` buttons (calls `generateMission()`).

- **Merging guidance (for AI agents):**
  - Prioritize minimal, local edits. When touching `app.js`, run the app in a browser to confirm UI IDs and localStorage behavior remain stable.
  - If converting globals into modules, update `index.html` script order and test map initialization (Leaflet integration) and `window.onload` behavior.

If any section is unclear or you'd like more precise examples (e.g. exact `ga_active_mission` JSON sample or a short test harness to run mission generation headlessly), tell me which piece to expand.
