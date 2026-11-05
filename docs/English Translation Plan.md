# Englische Übersetzung – Erste Ausarbeitung

Stand: 2026-11-02 · Basis: `main` = `origin/main` (9237af63b) · Status: Phase 0 und Einstellungs-Panel lokal umgesetzt, nicht committet

Ziel: Die App (Web, Kartentisch/EFB, Tracker-Desktop, Homebase) soll später wahlweise
auf Englisch laufen. Deutsch bleibt Standard und Rückfallsprache.

## 1. Bestandsaufnahme

Gezählt wurden Textstellen im Code, die nach deutschem Text aussehen (Heuristik:
Umlaute oder typische deutsche Wörter in Strings/HTML). Die Zahlen sind
Größenordnungen, keine exakten Werte.

| Bereich | Dateien (Auswahl) | Textstellen ca. | Bemerkung |
|---|---|---|---|
| Web-App Kern | `app.js` (≈2300), `sync.js` (≈370), `index.html` (≈250), `profile.js`, `board.js`, `map*.js`, `checklists.js` | ≈4000 | `app.js` allein ist über die Hälfte |
| Missionen | `mission-*-core.js`, `mission-*-browser.js`, `missions.js`, `mission-followup.js`, `mission-variety-core.js` | ≈2500 | viel Fließtext, Bausteine für Briefings |
| Passagier-Stimme | `passenger-voice.js`, `mission-*-voice-core.js` | ≈1300 | Dialogtexte, Gemini-Prompts |
| Seiten | `onboarding.html`, `willkommen.html`, `readme.html`, `legal.html`, `testboard.html`, `tutorial.js` | ≈850 | eher Fließtext |
| Tracker/EFB/Desktop | `tracker.js`, `tracker-efb-kartentisch-host.js`, `desktop/ui/*`, `homebase-*.js`, `efb-app/.../VfrMultitool.tsx` | ≈700 | Änderung an `tracker.js` = EXE-Release |
| Homebase-Workbench | `homebase/*` | ≈300 | internes Werkzeug, niedrige Priorität |
| Audio | `audio-pax/` (Gemini-Packs), `audio-warnings/` (Stimmen-Packs) | ≈630 Clips | fertig gesprochene deutsche Dateien |
| Nicht übersetzen | `cities.js` (≈1050), Flugplatz-/Navaid-Daten, ICAO-Kürzel | – | Eigennamen bleiben |

Grob geschätzt: **6000–8000 Textstellen**, davon etwa die Hälfte kurze
Bedien-Texte (Buttons, Labels, Meldungen), der Rest Fließtext und Bausteine.

`ga-tracker-client/efb-web-assets/` wird beim Tracker-Build aus `index.html`
und den Web-Dateien erzeugt. Dort muss nichts separat übersetzt werden, sobald die
Web-Quellen umgestellt sind.

### Vorhandenes Vorbild

`ga-tracker-client/accusim-router-desktop/lib/i18n.js` hat schon ein schlankes,
funktionierendes Muster: ein Wörterbuch pro Sprache (`'status.connected': 'Verbunden'`),
Platzhalter wie `{version}`, Rückfall auf Deutsch, dann auf den Schlüssel. Dieses
Muster passt auch für die Hauptapp und braucht keine externe Bibliothek.

Für die Warnstimmen gibt es bereits eine englische Stimme (lokale Ava-EN, siehe
`tools/VOICE_GENERATION.md`).

## 2. Die eigentlichen Hürden

### 2.1 Kein Sprachgerüst, Texte überall verstreut

Texte stecken direkt in `innerHTML`-Templates, `textContent`-Zuweisungen, Toasts,
`confirm()`-Dialogen und statisch in `index.html`. Jede Stelle muss einzeln
angefasst werden. Das ist Fleißarbeit, aber gut planbar und in Etappen machbar.

### 2.2 Deutscher Text wird als Programmlogik benutzt (größtes Risiko)

An vielen Stellen prüft der Code deutschen Text mit regulären Ausdrücken, vor allem
den Text, den Gemini für Briefings erzeugt:

- `app.js`: ca. 270 solche Prüfungen, z. B. Monatsnamen, „Rückkehr:“,
  Straßenbezeichnungen, Begründungswörter wie „wegen/anlässlich“, Fachwörter wie
  „Wartung/Prüfung“
- `sync.js` ca. 35, `passenger-voice.js` ca. 16, dazu einzelne Core-Dateien
  (`mission-infra-outcome-core.js`, `mission-definition-core.js`, Voice-Cores)
- `mission-variety-core.js` prüft schon zweisprachig (`wald|forest`), andere nicht

Wenn Briefings auf Englisch erzeugt werden, laufen diese Prüfungen ins Leere.
Folgen: Qualitätsprüfungen schlagen nicht an, Tags fehlen, Missionsdrift wird nicht
erkannt. Laut `AGENTS.md` ist das zentrale Klassifikation/Parser-Logik und darf
nicht nebenbei geändert werden. **Dafür braucht es eine eigene Freigabe.**

Mögliche Wege (Entscheidung offen):

- **A – Logik arbeitet nur auf strukturierten Daten.** Gemini liefert Felder/JSON,
  Prüfungen laufen auf Feldern statt auf Fließtext. Sauberste Lösung, aber der
  größte Umbau.
- **B – Prüfungen zweisprachig machen.** Jede Regex bekommt die englischen Begriffe
  dazu (wie in `mission-variety-core.js`). Schneller, aber doppelte Pflege.
- **C – Intern deutsch, Ausgabe englisch.** Gemini erzeugt und geprüft wird wie heute
  auf Deutsch, danach wird der fertige Text übersetzt. Kaum Umbau an der Logik,
  kostet aber einen zusätzlichen KI-Aufruf und etwas Wartezeit pro Briefing.

**Entscheidung (2026-11-02): Variante C** für generierte Missionsinhalte, mit einer
Ausnahme für die Live-Passagierstimme (siehe unten).

Hinweis zur Zählung: Bei der Missionsgenerierung wurden bereits viele semantische
Textprüfungen auf strukturierte Variablen umgestellt (Zieltyp, TaskDomain,
MissionTruth, Contracts). Ein Teil der gezählten Regex-Stellen ist daher vermutlich
nur noch Rückfall- oder Altpfad. Vor Phase 4 eine genaue Bestandsaufnahme machen:
Welche Prüfungen entscheiden noch aktiv, welche greifen nur, wenn strukturierte
Daten fehlen? Teile, die schon vollständig strukturiert prüfen, könnten Gemini
später direkt auf Englisch schreiben lassen (Richtung A).

So funktioniert C sicher:

1. Gemini erzeugt wie heute auf Deutsch, alle Prüfungen laufen auf Deutsch.
2. Ein zweiter Aufruf übersetzt den geprüften Text ins Englische.
3. Die englische Fassung wird **zusätzlich** gespeichert (z. B. `textEn`). Der
   deutsche Text bleibt intern der Bezugspunkt für alle Logik.
4. Nur Anzeige und Sprachausgabe nutzen die englische Fassung.
5. **Übersetzung nur bei gewählter Sprache Englisch anfordern.** Ist Deutsch
   eingestellt, entfällt der zweite Aufruf komplett, es entstehen keine zusätzlichen
   Tokens. Wechselt jemand später auf Englisch, wird bei Bedarf nachübersetzt
   (z. B. beim Öffnen des Briefings) und das Ergebnis zwischengespeichert, damit
   dasselbe Briefing nicht zweimal übersetzt wird.

Warum der deutsche Text nicht ersetzt werden darf: Er wird nach der Prüfung noch
weiter ausgewertet, unter anderem

- Fracht-SimObject-Auswahl aus dem Frachttext (`sync.js` um Zeile 7198 ff.)
- SAR-Erkennung „vermisste Person …“ (`sync.js` um Zeile 8785)
- Infrastruktur-Ergebnisklassen (`mission-infra-outcome-core.js` um Zeile 128 ff.)
- Erzählgedächtnis und Rollenableitung der Passagierstimme
  (`passenger-voice.js` um Zeile 774, 804, 1549)

#### Erste Durchsicht der Textprüfungen (2026-11-02)

Erfasst wurden `app.js`, `sync.js`, `passenger-voice.js` und `mission-*-core.js`:
ca. 570 Prüfstellen in ca. 255 Funktionen. Die Einordnung erfolgte über
Funktionsnamen und Stichproben, ist also grob. Aufrufer wurden nur bei den
wichtigsten Klassifizierern gelesen.

| Gruppe | Funktionen | Stellen | Beispiele | Folge für C |
|---|---|---|---|---|
| 1 Qualitätsprüfung KI-Text | ~78 | ~200 | `_missionWriterV5*NeedsRepair`, `_missionPipelineV4Looks*`, `*LooksGeneric`, `sanitize*` | unverändert, läuft auf Deutsch |
| 2 Klassifizierer mit Variablen-Vorrang | ~6 | ~33 | `_deriveTaskDomain`, `_deriveRoleProfileFromRole` (nur wenn `taskDomain`/`roleProfile` fehlen, `app.js:17418`), `classifyAptMissionCategory` (erst `cat`) | reiner Rückfallpfad |
| 3 Klassifizierer noch aktiv auf Text | ~57 | ~140 | `_missionTargetSceneKind` (`sync.js:9042`, mischt `taskDomain` mit Text), Fracht-Objektwahl `pickPrimary` (`sync.js:7198`), `_missionSarLooksLikePersonSearch`, `mission-infra-outcome-core.js` | unverändert; vor einer direkten englischen Ausgabe (A) bräuchten diese strukturierte Felder |
| 4 Deutsche Datenquellen | ~26 | ~43 | POI-/OSM-Namen, Wikipedia-Fakten, Klinik-Kandidaten (`_poi*`, `_poiKnowledge*`) | nie betroffen, die Daten sind unabhängig von der UI-Sprache |
| 5 Textbausteine | ~58 | ~94 | `*Compose*Story`, `*Sentence`, `*Phrase`, `_missionWriterV5PossessiveForGender` | erzeugen deutschen Text, danach wird übersetzt |
| 6 Laufzeit-Ereignisse | ~22 | ~49 | `_isLandingPhaseEvent`, `_capture*NarrativeMemory`, `_trainingProcedureEventKind` (`passenger-voice.js:774 ff.`) | **Achtung in Phase 3**, siehe unten |
| 7 Kleine Normalisierer | ~8 | ~10 | Geschlecht „männlich“, Testmodus-Werte | trivial |

Ein Teil von Gruppe 3 arbeitet faktisch schon strukturiert: `_missionSceneTaskDomain`
(`sync.js:7052`) liest nur `taskDomain`/`missionContract`/`cat`. Die deutschen Wörter
dort sind Synonyme für Werte, kein Fließtext.

Ergebnis: Variante C ist sicher. Für einen späteren Wechsel einzelner Missionsarten
auf direkte englische Ausgabe (Richtung A) wären vor allem Gruppe 1 und Gruppe 3
die Baustellen.

**Neuer Punkt, Gruppe 6:** Die Passagierstimme reagiert auf deutsche
Ereignistexte der Laufzeit (z. B. „Ziel erfüllt“, „Rückflug“, Landephasen). Wenn in
Phase 3 Laufzeitmeldungen übersetzt werden, dürfen diese Ereignistexte nicht
einfach mitübersetzt werden. Vorher Ereignis-Schlüssel einführen, auf die die
Stimme reagiert, und nur die Anzeige übersetzen.

**Ausnahme Live-Passagierstimme:** Spontane Passagiersätze im Flug würden durch
einen Übersetzungsschritt spürbar verzögert. Dort schreibt Gemini direkt auf
Englisch (Variante B). Die wenigen Prüfungen direkt auf dieser Ausgabe werden
zweisprachig gemacht, z. B. Prompt-Leak- und Trainings-Erkennung in
`passenger-voice.js` um Zeile 4645 und `mission-boarding-voice-core.js` um Zeile 182.
Der Kontext, den die Stimme bekommt (Briefing, Rolle, Story), bleibt deutsch.

### 2.3 KI-erzeugte Inhalte

Gemini-Prompts sind deutsch und erzwingen Deutsch („Antworte ausschließlich auf
Deutsch …“, z. B. `app.js` um Zeile 33708 und 33791). Betroffen: Briefings,
Passagier-Dialoge, Vereins-Events (`mission-club-events-core.js`). Je nach Weg aus
2.2 entweder Prompts mit Sprachparameter oder ein Übersetzungsschritt danach.

### 2.4 Audio

- `audio-pax/` und `audio-warnings/`: ca. 630 fertig gesprochene deutsche Clips.
  Für Englisch braucht es eigene Packs pro Stimme (ElevenLabs hat englische
  Stimmen; Generator `tools/generate-elevenlabs-voice-packs.mjs` existiert).
- Zahlen werden aus Wort-Clips zusammengesetzt (`aw-zwei`, `aw-hundert`, „zwo“ für
  Frequenzen). Englisch braucht eine eigene Zusammensetzungsregel
  („two thousand five hundred“, „one two three decimal four five“).
- Live-Stimme (TTS) braucht Sprachcode und passende Stimmenwahl pro Sprache.

### 2.5 Tracker, EFB und Desktop

- `tracker.js` schickt eigene Statuszeilen und Meldungen an EFB und Web. Jede
  Änderung dort heißt EXE-Neubau und Release (nur nach Freigabe).
- Besser: Tracker schickt Schlüssel + Werte (`{key:'start.blocked', vars:{…}}`),
  die Anzeige übersetzt. Dann ist der Tracker sprachneutral und muss für neue
  Sprachen nicht neu gebaut werden.
- Desktop-App (`desktop/ui/`) und EFB-Paket (`VfrMultitool.tsx`) brauchen jeweils
  den Sprachschalter, können aber dasselbe Wörterbuch nutzen.

### 2.5a Sprachschalter für Tracker, EFB und Toolbar (Plan, 2026-11-05)

Entschieden (User): **Ein Schalter in der Windows-Desktop-App** stellt alles um, was
der Tracker ausliefert: Desktop-Fenster, EFB-Tablet und Toolbar-Panel. Umsetzung erst
nach den restlichen Web-UI-Bereichen, nicht dazwischen.

**Bedienung**
- Kleiner Umschalter `EN | DE` oben rechts im Desktop-Fenster (`desktop/ui/index.html`).
- Standard Deutsch. Die Wahl gilt sofort, ohne Neustart von Desktop oder Tracker.
- EFB und Toolbar bekommen keinen eigenen Schalter.

**Weg der Einstellung (Ist-Stand geprüft)**
1. Desktop speichert `uiLanguage` in seiner Konfiguration (`desktop/lib/config-store.js`).
2. Beim Start der Engine als Umgebungsvariable mitgeben, wie die anderen Schalter in
   `desktop/lib/tracker-process.js` (z. B. `VFR_MULTITOOL_UI_LANGUAGE=en`).
3. Bei Wechsel zur Laufzeit: Aufruf an den Tracker über den vorhandenen
   Desktop-Steuerweg (lokaler HTTP-Server Port 49880, abgesichert mit
   `VFR_MULTITOOL_DESKTOP_CONTROL_TOKEN`, wie `/api/v1/tracker/shutdown`).
4. Der Tracker legt die Sprache in die EFB-Anzeige-Einstellungen
   (`tracker-efb-display-settings.js`, neues Feld `ui.language`: nur `de`/`en`,
   alles andere fällt auf `de`). Diese Einstellungen gehen schon heute im
   EFB-Zustand mit (`display` im Status von `tracker-efb-http-server.js`).
5. EFB und Toolbar laden dieselbe Oberfläche (`/efb/v1/…`; die Toolbar mit
   `host=toolbar` in `Panel.js`). Ein Mechanismus deckt also beide ab: bei
   geänderter Sprache `GAI18n.setLanguage(...)` aufrufen, die Anzeige baut sich neu.

**Was im EFB dazukommt**
- `i18n-core.js`, `i18n/en.js`, `i18n/en-phrases.js` (+ `en-help.js`, falls nötig) über
  `sync-efb-web-assets.js` als EFB-Dateien ausliefern. Ohne diese Dateien bleibt
  alles wie heute deutsch, alte EFB-Stände brechen nicht.
- Damit wirken alle schon übersetzten, gespiegelten Web-Dateien automatisch (Uhr,
  Media-Player, Kartenpopups, Profil, Checklisten-Werkzeuge, Debrief, Wegpunkt …).
- Noch nicht vorbereitet und der eigentliche Aufwand: eigene EFB-Texte
  (`tracker-efb-kartentisch-host.js` ca. 3900 Zeilen, Menüs/Toolbar-Leiste,
  `efb-app/…/VfrMultitool.tsx`), Desktop-Fenster (`desktop/ui/index.html`,
  `renderer.js`, `radio-hold.js` …) und Tracker-Meldungen aus `tracker.js`
  (besser Schlüssel + Werte, siehe 2.5).

**Grenzen / Verträglichkeit**
- Missionen, Funk und Passagierstimme bleiben in dieser Etappe deutsch (eigene Phase).
- Web und Tracker bleiben zunächst getrennt (Web hat seinen eigenen Schalter).
  Kopplung über das Pilotenprofil = offene Entscheidung 4.
- Alte Desktop-App + neuer Tracker: keine Variable → Deutsch. Neue Desktop-App + alter
  Tracker: Steueraufruf unbekannt → Desktop-Fenster wechselt, EFB bleibt deutsch.
- Zwei Artefakte: Tracker-EXE (Engine + EFB-Dateien) und Desktop-Installer. Beide nur
  nach Freigabe bauen/veröffentlichen; die offenen EFB-Kopien aus `docs/Release Queue.md`
  gehen mit dem Tracker-Build mit.

**Reihenfolge bei der Umsetzung**
1. EFB: i18n-Dateien ausliefern + Sprache aus `display` übernehmen (sichtbar: die schon
   übersetzten Teile werden englisch).
2. Tracker: `ui.language` in den Anzeige-Einstellungen + Steueraufruf + Umgebungsvariable.
3. Desktop: Schalter, Speichern, Weitergabe; Desktop-Fenster übersetzen.
4. Eigene EFB-Texte (Kartentisch-Host, Menüs, Toolbar) Bereich für Bereich.
5. Tracker-Meldungen auf Schlüssel + Werte umstellen.

### 2.6 Gespeicherte Daten

Logbuch, Cloud-Sync, Missionsentwürfe und Crew-Zettel speichern teils fertigen
Text. Alte Einträge bleiben deutsch. Für neue Einträge möglichst Schlüssel + Werte
speichern statt fertiger Sätze. Der Feld-Abgleich im Cloud-Sync darf dadurch nicht
berührt werden.

### 2.7 Formatierung und Layout

- Datum, Uhrzeit, Dezimalkomma: einige `toLocale…`-Aufrufe, teils feste deutsche
  Formate. Zentral über die gewählte Sprache formatieren.
- Analog-Skins (Fernschreiber, Tower, NavCom) haben feste Beschriftungen und knappe
  Flächen. Englisch ist meist kürzer, trotzdem einmal pro Skin prüfen.
- `<html lang="de">` muss mitwechseln (Silbentrennung, Screenreader).

### 2.8 Was bewusst deutsch bleibt oder ausgeblendet wird

- Eigennamen, Ortsnamen, ICAO-Kürzel, Flugplatz- und AIP-Daten
- PPL-Quiz (`data/ppl-quiz-catalog.json`): bezieht sich auf deutsches Recht.
  Vorschlag: auf Englisch ausblenden oder als „nur Deutsch“ kennzeichnen
- GAFOR: deutsches Produkt, Begriff bleibt, Erklärtexte werden übersetzt
- `legal.html`: englische Fassung als Lesehilfe, deutsche Fassung bleibt verbindlich
- Interne Werkzeuge (Workbenches, Testboard, Harness) zuletzt oder gar nicht

## 3. Vorgeschlagene Architektur

1. **Ein gemeinsames Modul** `i18n-core.js` nach dem Muster des AccuSim-Routers:
   `t(key, vars)`, Rückfall DE → Schlüssel, Platzhalter `{name}`, einfache
   Pluralregel (`{count}`), Formatierer für Datum/Zahl/Einheit.
2. **Wörterbücher pro Bereich und Sprache**, z. B. `i18n/de/ui.js`, `i18n/en/ui.js`,
   `i18n/en/missions.js`. Schlüssel nach Bereich benannt (`map.layers.title`,
   `mission.cargo.loadDone`).
3. **Statisches HTML** über Attribute: `data-i18n="map.layers.title"`,
   `data-i18n-title`, `data-i18n-placeholder`. Ein Durchlauf beim Start und beim
   Sprachwechsel.
4. **Sprachwahl** im Profil/Einstellungen, Standard aus `navigator.language`,
   mit Cloud-Sync übertragen, an Tracker/EFB weitergegeben.
5. **Prüfskript** (als Test): findet Schlüssel ohne englischen Text, unbenutzte
   Schlüssel und neue deutsche Literale außerhalb der Wörterbücher. So wächst der
   Berg nicht weiter.
6. **Service Worker**: Wörterbücher in `sw.js` cachen.

## 4. Etappen

| Phase | Inhalt | Größe | Abhängig von |
|---|---|---|---|
| 0 | Gerüst: `i18n-core.js`, Sprachschalter, `data-i18n`-Durchlauf, Prüfskript, Regel „neue Texte nur noch über `t()`“ | S | – |
| 1 | App-Hülle: `index.html`, Menüs, Einstellungen, Dialoge, Toasts, Karte/Kartentisch, Checklisten-UI, Board | L | 0 |
| 2 | Tracker/EFB/Desktop: Schlüssel statt fertiger Sätze, Desktop-UI, EFB-Paket | M | 0, EXE-Release |
| 3 | Missionen, fester Text: Titel, Phasen-Hinweise, Cargo/Manifest, Debrief, Logbuch; vorher Ereignis-Schlüssel für die Passagierstimme (2.2, Gruppe 6) | L | 1 |
| 4 | Generierte Inhalte: Weg aus 2.2 umsetzen, Prompts, Passagier-Dialoge | L | Freigabe zu 2.2 |
| 5 | Audio: englische Stimmen-Packs, englische Zahlenzusammensetzung, TTS-Sprache | M | 4 (für Pax) |
| 6 | Seiten: Onboarding, Willkommen, Readme, Tutorial, Legal | M | 1 |

Größen grob: S = wenige Sitzungen, M = ein bis zwei Wochen nebenher, L = mehrere
Wochen nebenher. Nach Phase 1 ist schon eine benutzbare englische Oberfläche da,
auch wenn Missionstexte noch deutsch sind. Das wäre ein sinnvoller erster
Test-Stand für englischsprachige Tester.

Phase 1 und 3 lassen sich dateiweise in kleine Commits teilen (eine Datei bzw. ein
Bereich pro Schritt), damit nichts kaputtgeht und Rückfallpunkte klar bleiben.

### Stand Phase 0 (2026-11-02, lokal, nicht committet)

- `i18n-core.js` (global `GAI18n`): `t(key, vars, fallback)`, `setLanguage`,
  `getLanguage`, `onChange`, Ereignis `ga:languagechange`, `apply()` für
  `data-i18n`, `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-placeholder`.
  Speicher `ga_language_v1`, nur auf dem Gerät (kein Cloud-Sync).
- Sicherheitsprinzip: Bei Deutsch und ohne Umschalten fasst `apply()` nichts an.
  Der deutsche Text bleibt im HTML. Beim ersten Umschalten wird er in
  `data-i18n-orig` gemerkt und beim Zurückschalten exakt wiederhergestellt.
  Schlüssel ohne englischen Text lassen das Element deutsch.
- Wörterbücher: `i18n/de.js` (nur Texte, die aus JS kommen), `i18n/en.js`.
- Sprachschalter unter Einstellungen → Darstellung. Seit Web v2319 (03.11.2026) für alle
  sichtbar. Davor nur lokal oder mit `localStorage.ga_i18n_preview = '1'`; die Sperre lässt sich
  über `data-i18n-preview-only` am Element wieder einschalten.
- Probe-Bereich: Einstellungen → Darstellung ist zweisprachig.
- Bewusst keine globale Kurzfunktion `t` (mögliche Namenskonflikte), Aufruf über
  `GAI18n.t`.
- `styles.css` bleibt unverändert, weil sie ins EFB gespiegelt wird
  (`efb-web-assets-sync.test.js`). Skin-Anpassung nur in `settings-toolroll.css`.
- Tests: `node --test i18n-core.test.js`, Prüfskript `node tools/i18n-check.mjs`
  (fehlende englische Texte, abweichende Platzhalter).
- Literal-Prüfung im selben Skript: Deutsche Texte direkt im Code (Web-Dateien im
  Projektordner, ohne Tests, `zz-*`, `cities.js`, `datenbank.js`, `sw.js`) werden
  gegen `i18n/literal-baseline.json` verglichen. Neue oder geänderte deutsche Texte
  erscheinen als `new datei:zeile`, sie bremsen aber nichts. HTML-Text mit
  `data-i18n*`-Schlüssel zählt als übersetzt. Ausgangswert am 2026-11-02:
  8281 Stellen in 194 Dateien. Nach bewusst akzeptierten Änderungen
  `node tools/i18n-check.mjs --update-baseline`; `--files` zeigt die Zahl pro Datei.
- Beim Push: `sw.js`-Cache-Version erhöhen.

### Stand Phase 1 – Einstellungs-Panel (2026-11-02, lokal)

Erledigt:
- Feste Beschriftungen im Panel (`index.html`, `.settings-shell`) haben Schlüssel,
  englisch in `i18n/en.js`. Texte, die auf Englisch gleich bleiben (Cloud & Mission,
  Crew Board, Presets, Push/Pull, Login, Marker, Reset …), haben keinen Schlüssel.
- Hilfe-Popups („?“): `_localizedSettingsHelp()` in `app.js` vor
  `SETTINGS_HELP_CONTENT`. Englisch in `i18n/en-help.js` für dispatcher,
  pilot-sync, crew-board, aircraft-presets, boarding-scene und appearance. Das
  Prüfskript warnt, wenn ein Hilfe-Schlüssel zu keinem deutschen Eintrag mehr passt.
- Geprüft: Bei Deutsch keinerlei Änderung, Panel-HTML nach EN→DE zeichengenau
  gleich, dynamische Statusfelder unberührt.

Bewusst ohne Schlüssel (werden von JS beschrieben oder ausgelesen):
- `apiKeyStatus`, `openAiApiKeyStatus`, `loginText`, `syncStatus`, `loginHint`,
  `loginSyncBtn`, `liveGpsIndicator` (`setSyncLoginState` in `sync.js`)
- `missionRuntimeStatus/Detail/NextStep` – **`checklists.js` liest diesen Text
  zurück** (`missionRuntimeText`). Vor einer Übersetzung auf Zustands-Schlüssel
  umstellen.
- `groupStatus`, `aircraftPresetStatus`, Preset-Liste (`settingsPresetButtons`,
  „Neues Preset“, „Sitze“), Boarding-Anzeige („Spawn: vorn …“)
- Tracker-Download-Link: enthält die Version und wird bei Releases von Hand
  gepflegt.

### Stand Phase 1 – Statustexte im Einstellungs-Panel (2026-11-02, lokal)

Drei Werkzeuge, je nach Art des Textes:
- `GAI18n.t(key, vars, 'Deutsch {var}')` für Texte mit Variablen. Der deutsche Text
  steht als Rückfall direkt im Aufruf. In `app.js`, `sync.js` und `board.js` gibt es
  dafür kleine Helfer `_appUiText`, `_syncUiText` und `_boardUiText`, die auch ohne
  `GAI18n` funktionieren.
- `GAI18n.phrase('Deutscher Satz')` für fertige Sätze, die durch den Code gereicht
  werden. Tabelle in `i18n/en-phrases.js`, nur exakte Treffer, sonst bleibt Deutsch.
  So bleiben z. B. die ca. 40 Aufrufer von `updateSyncStatus` im Cloud-Sync
  unverändert, nur die Anzeige übersetzt.
- `data-i18n-initial` im HTML für Statusfelder mit deutschem Starttext: Übersetzt
  wird nur, solange der Text noch der Starttext ist. Was JS hineinschreibt, wird
  nie überschrieben.

Umgestellt: Login/Sync-Status und Login-Meldungen (`sync.js`), Crew beitreten und
verlassen (`board.js`), API-Key-Status, Preset-Liste und Preset-Status,
Schnellwahl-Menü-Kurzinfo, Boarding-Anzeige (`app.js`). Beim Sprachwechsel werden
Preset-Liste und Boarding-Editor neu gezeichnet. Statuszeilen wechseln bei ihrer
nächsten Aktualisierung (ein Neuzeichnen könnte Sync bzw. eine Key-Prüfung auslösen).

Bewusst nicht übersetzt:
- Boarding-Punktnamen in den Daten (`boardingRoutePointList().label`): gehen als
  `pathLabels` in die Missionsszene. Übersetzt wird nur die Anzeige
  (`boardingPointDisplayLabel`).
- Sichtbarer Text des Tracker-Indikators (LIVE/LINK/OFF): `map.js` liest ihn aus.
- Missionsstatus (`missionRuntime*`): wird von `checklists.js` zurückgelesen.
- Zusammengesetzte Sync-Meldungen wie `Cloud: Fehler ${msg}` bleiben deutsch.

Prüfskript ergänzt: Sätze in `en-phrases.js`, die im Code nicht mehr vorkommen,
`data-i18n-initial` ohne Satz-Eintrag (Fehler), Schlüssel, die weder im HTML noch
im JS vorkommen. Deutsche Rückfalltexte in Übersetzungsaufrufen zählen als
übersetzt. Ausgangswert jetzt 8249.

### Phase 1 – Dispatch-Bereich: umgesetzt (2026-11-02, lokal)

- 59 Schlüssel in `index.html` (klassisch, Ops 1940, NavCom-Tooltips,
  Hauptmenü, Platztyp-Popup), englisch in `i18n/en.js`.
- Typ-Liste: `_missionPickerDisplayLabels()` in `app.js`, Texte in
  `i18n/en-picker.js` (nach `value`). Prüfskript warnt bei Schlüsseln ohne Option.
- Platztypen: Anzeige-Übersetzung in `airport-type-filter.js` (`tr`, `groupText`),
  Popup-Optionen werden beim Sprachwechsel neu beschriftet, ohne doppelte Listener.
  Selbsttests `tools/airport-search-data-selftest.mjs`,
  `airports-database-selftest.mjs` und `mission-airport-pool-selftest.mjs` laufen.
- RDM/PICK-Tooltips und Vorschläge-Knopf über `_appUiText`; Generieren-Knopf über
  `data-i18n-initial` + Sätze.
- Sprachwechsel zeichnet Typ-Liste, Ops-Kopien, RDM/PICK und Platztypen neu.
  `i18n-core.js` ruft beim Start mit Englisch die Listener einmal auf (nach den
  Start-Routinen), sonst blieben vorab befüllte Ops-Listen deutsch.
- Geprüft: Deutsch unverändert, Bereich und Popup nach EN→DE zeichengenau gleich,
  gewählte Missionsart bleibt, Start mit Englisch korrekt.
- Offen: Statuszeile `searchIndicator` (Missionsphase), „KI Mode“-Knopf und
  Pinnwand-Knopf (Kind-Elemente), Skins `analog-skins.js` / `navcom-skins.js`.

### Phase 1 – Briefing-PDF, Fehlerbericht, Fußbereich (2026-11-05)

- Briefing Pack (`board.js`): feste Überschriften und Leer-Texte über die Satz-Tabelle
  (FREQUENZEN, FRACHT, STRECKE, KURS, DATUM, ZIELPUNKT INFO, PLATZKARTE, „Route frei …“),
  „Seite x / y“ (`pdf.pageOf`, gilt auch für das Debrief-PDF), „… und n weitere“.
  Englische Beschriftungen (PAYLOAD, RUNWAYS, ROUTE & NAVIGATION …) waren schon englisch.
- Datum im PDF über `displayDate` in der UI-Sprache; **`date` bleibt deutsch**, weil der
  Dateiname daraus gebaut wird (en-GB hätte Schrägstriche).
- Missionstitel, Geschichte, Zuladung und Briefing-Felder kommen aus dem Briefing-Bereich
  und bleiben bis zur Missionsphase deutsch. Die Vergleiche auf Ladetexte
  („Sucht Pisten-Infos...“, „Warte auf Daten...“, „Sucht lokales“) bleiben unverändert,
  weil diese Felder noch nicht übersetzt sind. **Beim Übersetzen des Briefing-Bereichs
  diese Vergleiche mitziehen.**
- Statuszeile beim Export („Erstelle Briefing Pack PDF...“) bleibt deutsch (Missionsphase,
  exakte Textvergleiche).
- Fehlerbericht: Knopf + Tooltip, erste Zeile des E-Mail-Entwurfs. Geräte-/Debug-Teil und
  Betreff bleiben deutsch (für den Entwickler). Die Testboard-Seite ist eine Begleitseite.
- Fußbereich: Rechtliches-Links (Ziel bleiben die deutschen Rechtsseiten), Spendenblock
  inkl. Hinweistext (Übersetzung zur Information), PayPal-Ersatzlink, Discord-Tooltip.

### Phase 1 – UI-Reste: Knöpfe, Uhr, Wegpunkt, VFR-Index (2026-11-05)

- NavCom „KI Mode“ (Text in `<span data-i18n>`, LED bleibt Kind-Element), Win95-Desktop-Symbole
  und Taskleiste (`dispatch.win95.*`). Kein Code liest diese Texte.
- Uhr-Timer: „Minuten“, „Polartag/Polarnacht“ (`media-player-watch-face.js`, EFB-Quelle mitgezogen).
- Wegpunkt-Popup (`map-route-edit-core.js`, Core-Datei): eigener Helfer `tr()` über
  `globalThis.GAI18n`; im Tracker/EFB (kein `GAI18n`) unverändert deutsch.
- VFR-Index-Tooltips (`map.js`): Anzeige-Helfer `_vpVfrModelLabelText`, `_vpVfrCatLabelText`,
  `_vpVfrWarningText`. **Klassen-Labels und Warnhinweise bleiben in den Daten deutsch**; übersetzt
  wird nur beim Zusammenbau des Tooltips (Klammerwörter und Warnteile zwischen „ • “ über die
  Satz-Tabelle). „METAR-Guardrail“, „MOSMIX“, „Score“, „VIS“, „Base“ bleiben.
- Nicht übersetzt (Missionsphase/Debug): Missions-Szenen-Debug-Tooltips, „Abholteam“,
  Missions-Banner.
- Bekannt kaputt, unabhängig davon: `tools/web-media-integration-selftest.mjs` (Relay-Anfrage nach
  dem Schließen, scheitert auch auf dem unveränderten Stand).

### Phase 1 – Flugbuch, Debrief, Einstellungs-Grafik (2026-11-04)

- **Einstellungs-Rolle:** `roll-head-suede-v2-en.webp` mit „Settings“-Prägung. Neues Attribut
  `data-i18n-src` (Bildpfad aus dem Wörterbuch, Original wird gemerkt) und `data-i18n-alt`.
- **Logbuch-Tabelle** (`renderLog()` in `app.js`): Spalten, Freie-Flüge-Schalter, Leer-Hinweis,
  Seitenangabe, Unterzeile; Markup-Knöpfe über `logbook.*`. Wird beim Sprachwechsel neu gezeichnet.
- **Flugbuch-Ansicht** (`flight-logbook-view.js`): Flugweg-Status, Linienfarbe/Legende, Karten-
  Marker, Höhenprofil-Anzeige, Luftraumliste, Missionsergebnis, Löschen, PDF-Flugwegseite.
- **Debrief** (`flight-debrief.js`) und **Debrief-PDF** (`board.js`): Kennzahlen, Abschnitte,
  Bewertungssätze (Höhe, Komfort, Ladung, Flug), Knöpfe. Kopftexte werden beim Öffnen neu gesetzt.
- **Datenbezüge:**
  - Namen der Kartenebenen bleiben deutsch (in den Ebenen-Einstellungen gespeichert).
  - Die Flugbuch-Ansicht erkennt Debrief-Abschnitte am Titel: Regex kennt jetzt auch
    „Passenger comfort|Cargo safety“.
  - PDF filtert die Ergebniszeile über `row.key === 'result'` statt über den Text.
  - Passagier-Stimmung (`mission-comfort-core.js`) bleibt im Kern deutsch, Anzeige über Sätze.
- Geprüft: Rückverwandlung gegen Sicherung (bis auf die genannten Stellen identisch), jeder
  eingewickelte Text hat Englisch, Browser: Debrief und Logbuch DE/EN/DE, Deutsch identisch.
  Die Flugweg-Karte selbst wurde nicht live geöffnet (braucht einen Cloud-Flug).
- Flugbuch-Deckel: `closed-tall-v2-en.webp` („Logbook“, 1345×1169) über
  `data-i18n-src="logbook.cover.image"`; die Flugweg-Karte wurde vom User auf Englisch geprüft.
  Missionstitel und Abschiedsworte des Passagiers sind generierte Inhalte (Variante C).

### Phase 1 – Zahlen- und Datumsformate (2026-11-04)

- `GAI18n.locale()` liefert `de-DE` bzw. `en-GB`; `formatNumber()` nutzt es. Auf Englisch
  „5,500 ft“ und „03/11/2026“, auf Deutsch unverändert „5.500 ft“ und „03.11.2026“.
- Umgestellt (nur Anzeige): Höhenband, eigene Flughöhe und Geländelabel in „Was ist hier?“
  (`_mcLocale`), Flugweg-Ansicht im Flugbuch (`fmt`, `clockText`, Datum freier Flüge),
  Datum in Debrief und Logbuch-Tabelle. Der Crew-Status nutzte die Sprache schon.
- **Gespeicherte Labels bleiben deutsch:** `dateLabel`/`date` in Flugbuch-Einträgen
  (Tracker, Sim, Cloud). Auf Englisch zeigen Debrief, Logbuch-Tabelle und Flugbuch-Ansicht
  das Datum aus dem Zeitstempel (`createdAt`/`endedAt`/`endTs`); fehlt er, bleibt das Label.
- Bewusst deutsch: Datums-/Zeitangaben im Gemini-Prompt (`app.js` Missionszeit),
  Fehlerbericht, Debug-/Exportzeilen, Missions-Panel in `checklists.js` (Missionsphase),
  Missions-Cores.
- Uhrzeiten mit Stunde:Minute sind in beiden Formaten gleich („14:05“).
- Gefunden: Die Flugbuch-/Debrief-Ansicht (`flight-logbook-view.js`, Logbuch-Tabelle in
  `app.js`, `flight-debrief.js`) ist bis auf zwei Rückfragen noch nicht übersetzt.

### Phase 1 – Restliche Dialoge (2026-11-02, lokal)

- **API-Key-Fenster** (`#dispatchApiKeyDialog` in `index.html`, `requestDispatchApiKey()` in
  `app.js`): Markup über `apiKeyDialog.*`. Texte neben Checkboxen bzw. um den Anbieternamen
  stecken in eigenen `<span data-i18n>`, damit `apply()` die Eingaben nicht überschreibt.
  Der Passwortmanager-Eintrag „GA Dispatcher … API-Key“ bleibt bewusst deutsch/gleich,
  sonst findet der Passwortmanager gespeicherte Keys nicht wieder.
- **alert/confirm/prompt** in `app.js`, `sync.js`, `board.js`, `map.js`, `profile.js`,
  `flight-logbook-view.js`, `ppl-quiz.js`, `sim-route.js`, `sim-manual-flight.js`,
  `flight-debrief.js`: per Babel-Skript eingewickelt (feste Sätze → Satz-Helfer der Datei,
  Texte mit Variablen → Schlüssel `dialog.<bereich>.<anfang>` mit Platzhaltern). Neue Helfer:
  `_mapUiPhrase`, `_vpUiPhrase`, `_flvT/_flvK`, `_pqT/_pqK`, `_srT/_srK`, `_smT/_smK`, `_fdT/_fdK`.
- Meldungen aus Variablen: wo ein fester deutscher Text hineinläuft (Auto-Sync-Warnung,
  Tracker-Übergabe, Abbruch-Fehler, Route-Reset, Quiz-Neustart), wird am Aufruf über die
  Satz-Tabelle übersetzt; Server- und Fehlertexte (`error.message`) laufen unverändert durch.
- Tests, die einzelne Funktionen ausschneiden (`tools/mission-export-lossless.test.cjs`,
  `tools/tracker-sim-interruption-web.test.cjs`), bekommen den Helfer als Durchreiche im Sandbox-Kontext.
- **Prüfskript-Falle:** Strings mit weniger als drei Zeichen (z. B. `'\n'`) bringen die
  Anführungszeichen-Zählung von `tools/i18n-check.mjs` aus dem Tritt. Zeilenumbrüche deshalb
  als Template schreiben (`` `\n${…}` ``).
- Geprüft: beidseitige Rückverwandlung aller Übersetzungsaufrufe gegen die Sicherung (identisch,
  bis auf eine gleichwertige Schreibweise „Template + Text“); jede eingewickelte Meldung hat einen
  englischen Eintrag (maschinell, auch frühere Etappen); API-Key-Fenster und Stichproben-Dialoge
  im Browser DE/EN/DE; EFB neu erzeugt, Tests grün. Verbleibende Testfehler bestehen auch ohne
  diese Arbeit (fehlender Playwright-Browser, fremde untracked Testdatei, Missions-Tests).
- Offen (Missionsphase): `mission-followup.js` und Missions-Cores, zusammengesetzte
  Missions-Rückfragen in `sync.js` (Übernahme-/Konflikt-Prompts aus `join()`, Cloud-Update-Hinweis),
  `homebase/homebase-workbench.js` (eigenes Werkzeug), Ausgaben von `GAMissionControlUiCore`.

### Phase 1 – Kartenpopups (2026-11-02, lokal)

- Flugplatz-Popup (`map-airport-popup.js`), Tooltips und Funkfeuer-/VRP-Popups
  (`map-single-click.js`), „Was ist hier?“ (`map-context-popup.js`) und die Frage
  „… als Ziel übernehmen?“ (`map.js`). Helfer je Datei: `_apT/_apK`, `_scT/_scK`, `_mcT/_mcK`
  (`T` = Satz, `K` = Schlüssel mit Platzhaltern). Ohne `GAI18n` (EFB) bleibt alles deutsch.
- **Daten bleiben deutsch:** `getOpenAipNavaidTypeLabel()` liefert weiter „Funkfeuer“/„NDB“ …,
  weil `GARadioTuningCore.navaidKind()` daraus ADF oder NAV ableitet; übersetzt wird nur die
  Anzeige. Ebenso `runwayCache`-Merker „Keine Daten gefunden“, Namens-Ersatz „Flugplatz“ /
  „Funkfeuer“ in den Normalisierern und der Luftraum-Typ „LUFTRAUM“ (dient zum Abschneiden des
  Namenspräfixes, angezeigt als „AIRSPACE“).
- Beim Funkfeuer vergleicht die Anzeige die Zeile „Funk …“ mit sich selbst; Erzeugung und
  Vergleich nutzen denselben übersetzten Ausdruck.
- **Lade-Erkennung erweitert:** `captureMapContextAirportWidgetState()` erkennt am HTML, ob das
  Wetter noch lädt. Die Regex kennt jetzt auch „Weather loading“, „Searching local weather“ und
  „Loading point weather“ (betraf auch Teil 5). Das ist die einzige Logikänderung.
- Windrosen: „O“ wird auf Englisch zu „E“ (`mapContext.compass.east`, auch in `airport-weather.js`).
- Geprüft: Rückverwandlung aller Aufrufe gegen die Sicherung, identisch (außer der Regex);
  alle Popup-Bausteine in DE/EN/DE gebaut, Deutsch identisch; echtes „Was ist hier?“ bei EDDS
  auf Englisch und Deutsch geöffnet, METAR wird geladen und übernommen; EFB neu erzeugt, Tests grün.
- Offen: Zahlen mit deutschem Tausenderpunkt („5.000“) und Datumsformate – betrifft die ganze
  App (Checklisten, Flugbuch …), eigener Durchgang. Pistentexte aus `runwayCache`, das
  abgeschaltete AIP-Overlay (`AIP_CHART_UI_ENABLED = false`), der „Löschen“-Knopf im
  Wegpunkt-Popup und die GAFOR-Tooltips sind seit 2026-11-05 erledigt.

### Phase 1 – Kartentisch, Teil 5: Media-Player, Uhr, Kleinkram (2026-11-02, lokal)

- Media-Player (alle fünf `media-player-*.js`): Helfer `_mpT()` am Dateianfang, deutsche
  Texte als Sätze in `i18n/en-phrases.js`. Ohne `GAI18n` (EFB) kommt exakt das alte Deutsch.
- **Vergleiche bleiben deutsch:** `row()` in der Watch prüft weiter `label === 'Zurück'`
  und übersetzt erst bei der Anzeige. Die iPod-Ansichten werden über IDs (`library`,
  `settings`) unterschieden, nicht über Texte.
- Die Watch-Dateien liegen für das EFB in `ga-tracker-client/efb-media-source` und müssen
  dort gleich wie im Web sein (Test in `tracker-efb-web-client.test.js`). Darum sind
  beide dort mit `_mpT` übernommen. `client`, `ui` und `ipod` bleiben dort unverändert.
- Uhr (`display-clock.js`, `clock-skins.js`), Gelände (`map-terrain-avoid.js`), Autozoom,
  Zoom-Knopf, Basiskarten-Hinweis, Platzwetter (`airport-weather.js`) und Funk-Dialog
  (`radio-tuning-ui.js`). `clock-skins.js` beschriftet den Stoppuhr-Knopf beim
  Sprachwechsel neu (`GAI18n.onChange`).
- Funk-Modusnamen: `labelsDe` bleibt die deutsche Quelle, angezeigt wird über
  `radio.mode.*`.
- Nachgezogen: Die Löschfunktion der Vereinsflotte (`crew-fleet-client.js`,
  Desktop 1.6.37) kam erst nach dem Crew-Durchgang und hat jetzt `fleet.remove.*`.
- Das Prüfskript erkennt jetzt auch `_mpT`, `csText` und `rtText`.
- Geprüft: Babel-Gegenprobe der Media-Dateien gegen die Sicherung (identisch); alle drei
  Player in DE/EN/DE gebaut (Deutsch identisch); Stoppuhr-Knopf, Funk-Dialog und die
  ganze Seite EN→DE identisch; EFB neu erzeugt, Tests grün (EFB 25, Kern/Uhr/Funk 23).
- Bewusst gleich: HOLD, MENU, Timer, Start, Reset, PAUSE, WINAMP. Noch deutsch: der
  Krone-Hinweis „mehr/weniger Sekunden“ im Timer, „Prozent/Sekunden“ in Screenreader-
  Werten, das Breakout-Spiel im iPod.

### Phase 1 – Kartentisch, Teil 4b: Route-Werkzeuge (2026-11-02, lokal)

- Wetter, Warnungen, Funk, Orte, Nearest, Platz-Info in `checklists.js`.
- **Wetterdaten bleiben deutsch:** `weatherRiskRank()` durchsucht `r.wx` in
  Großbuchstaben nach METAR-Kürzeln (SH, SN, RA, TS …). Englische Texte wie
  „SHOWERS“/„SNOW“ würden die Risikostufe verändern. Außerdem speisen die Zeilen
  und die Vorbewertung den Gemini-Wetterprompt. Übersetzt wird nur die Anzeige:
  `wxShow()` (Wettercodes über Sätze, „ca.“ → „approx.“), Feldnamen,
  Vorbewertung, Alter, Fehler/Leer-Zustände.
- Zentral über die Satz-Tabelle: `renderToolEmpty`, `locateButton`, Fehlertexte im
  Werkzeug-Zustand, Labels von `placeCard`/`renderFreqBlock` (die Labels selbst
  bleiben deutsch, weil sie in IDs und Menü-Schlüsseln stecken).
- KI-Wettereinschätzung bleibt deutsch (Variante C, kommt mit generierten Inhalten).
- Geprüft: Babel- und Rückverwandlungs-Gegenprobe; alle Werkzeug-Ansichten EN→DE
  identisch; Wetterkarte in einer Sandbox mit echten Funktionen gezeichnet (DE/EN),
  Risikostufe in beiden Sprachen gleich.
- Offen: „Sucht lokales Wetter…“ (`airport-weather.js`, Teil 5), Luftraum-Kategorien
  (`getAirspaceStyle` in `map.js`, mit den Karten-Popups), Missions-/Cargo-Kacheln.

### Phase 1 – Kartentisch, Teil 4a: Checklisten (2026-11-02, lokal)

`checklists.js` (EFB-gespiegelt) enthält Checklisten, Route-Werkzeuge und ein
Missions-/Cargo-Panel. Aufteilung: **4a** Checklisten (erledigt), **4b**
Route-Werkzeuge Wetter/Warnungen/Funk/Orte/Nearest (offen, inkl. Wettercode-Tabelle
und Gemini-Wetterprompt → Variante C), **Missions-/Cargo-Panel → Missionsphase**
(liest `missionRuntime*`-Texte aus).

- Helfer `tx(key, deutsch, vars)` und `txPhrase()` im IIFE; `setStatus`/`setTitle`
  zeigen über die Satz-Tabelle an (Aufrufer unverändert).
- Eingebaute Listen: `localizedBuiltins()` liefert eine übersetzte Kopie, IDs und
  damit Häkchen bleiben (geprüft: auf EN gesetztes Häkchen bleibt auf DE erhalten).
  Nur „VFR Briefing“ war deutsch; die beiden anderen Listen sind englisch.
- Startansicht-Kacheln, Liste, Auswahl-Verwaltung, Viewer, Aktionsmenü, Editor,
  Import, Validierungs- und Community-Meldungen. Neue Liste/Kopie/Kapitel bekommen
  Standardnamen in der UI-Sprache (das sind Nutzerdaten-Vorgaben).
- Absicherung: Babel-Prüfung, dass kein `${tx(` in einem normalen String-Literal
  steht; Rückverwandlung aller `tx()`-Aufrufe ergibt bis auf die gewollten Stellen
  die alte Datei; Browser: Startansicht, Liste, Verwaltung, Viewer nach EN→DE
  identisch.
- Bekannt und unabhängig: `tools/gemini-generation-compat.test.mjs` scheitert mit
  6 Fehlern bereits auf unverändertem `origin/main` (alter Vergleichsstand,
  `_paxCanGenerateVoice is not defined`).
- Offen im Kartentisch-Rahmen: Kopf „NAV STATION (KARTENTISCH)“, „Tools“-Zeile der
  Schublade.

### Phase 1 – Kartentisch, Teil 3: Höhenprofil (2026-11-02, lokal)

- `profile.js` (EFB-gespiegelt, mit `canvasFontPlugin`): alle Profil-Schalter über
  `_vpUiText` und den Knopf-Schlüssel (`profile.toggle.<id>`), Luftraum-Modi,
  Wetterquelle, Statuszeile `verticalProfileStatus`. Starttext „Lade Höhendaten…“
  in `index.html` über `data-i18n-initial`.
- Canvas-Beschriftungen sind bereits englisch (TOC, TOD, ALT, NM, CRZ, NOW, HDG),
  Tooltips mit Text gibt es nicht.
- **Bewusst deutsch:** Konsolen- und Diagnose-Texte (`[Overpass]`, `[Wetter]`,
  Debug-Report für den Fehlerbericht) – für den Entwickler.
- Geprüft: erzeugte EFB-`profile.js` liefert ohne `GAI18n` exakt das alte Deutsch;
  zwölf Profil-Schalter DE→EN→DE identisch, `#mapProfileStrip` zeichengenau gleich.

### Phase 1 – Kartentisch, Teil 2: Karte und Werkzeuge (2026-11-02, lokal)

- `map-display-controls.js` (EFB-gespiegelt): alle An/Aus-Schalter des
  Anzeige-Menüs, Einzelklick, Legs-Umschalter über `_mdcText`; Beschriftungen über
  den Schalter-Schlüssel (`map.hint.<key>`).
- `map.js` (nur Web): Snapping, METARs, Direct To, Wetterquelle, Attribution,
  VFR-Index-Panel (Status, Planungsland, Zeitfenster, Ampel, Modell-Beschreibungen,
  Länderauswahl). Ländernamen auf Englisch über `Intl.DisplayNames`.
- `map-drawing.js` (EFB-gespiegelt): „Messen“; **`showMapToast` übersetzt zentral
  über die Satz-Tabelle**, damit sind alle festen Karten-Meldungen abgedeckt.
- `map-utility-tools.js` (nur Web, EFB hat eigenen Fork): Formel-Hilfe über
  `localizedFormulaHelp()` + `i18n/en-formula.js`, Größen-Tooltip, „Nächste Variable“.
- **Korrektur an Teil 1:** Die klickbaren Formel-Zeilen (`span[data-formula-expr]`)
  haben wieder keinen Schlüssel. Der Rechner sucht die Variablennamen aus
  `data-formula-vars` im angezeigten Text (`renderCalcFormula`); auf Englisch wären
  Hervorhebung und Einheiten ausgefallen. Die Formeln bleiben vorerst deutsch.
  Eine echte Übersetzung braucht übersetzte Variablennamen pro Sprache.
- Nachgezogen aus Teil 1: 16 weitere feste Texte im Anzeige-Menü (VFR-Index,
  Terrain, Autozoom, Uhr, Helligkeit, Flugzeug-Icon).
- Geprüft: EFB-Helfer liefern ohne `GAI18n` exakt das alte Deutsch (an den
  erzeugten EFB-Dateien getestet); Kartentisch EN→DE zeichengenau gleich (außer
  laufender Uhr); Rechner erkennt Variablen auf DE und EN; EFB-Abgleich und
  Karten-/EFB-Tests grün.
- Offen im Kartentisch: Helligkeit-/NavCom-Wert (`app.js`), Terrain-Avoid-Status,
  Autozoom-Status, Uhr-Statuszeilen, Karten-Popups (Flugplatz, Kontext, AIP,
  VFR-Sektor-Tooltips), Höhenprofil, Checklisten, Media-Player.

### Phase 1 – Kartentisch, Teil 1: Rahmen und Menüs (2026-11-02, lokal)

Entscheidung: **erst nur Web.** Der Kartentisch-Abschnitt von `index.html`
(`#mapTableOverlay` bis zum nächsten `<script>`) und ca. 30 JS-Dateien werden von
`ga-tracker-client/sync-efb-web-assets.js` ins EFB gespiegelt. Das EFB lädt
`i18n-core.js` nicht: `data-i18n*` ist dort wirkungslos, JS-Helfer fallen auf
Deutsch zurück. EFB-Dateien werden lokal neu erzeugt (`node sync-efb-web-assets.js`),
damit `efb-web-assets-sync.test.js` grün bleibt; kein Build, kein Release. EFB auf
Englisch kommt mit Phase 2 (Sprache vom Tracker ans EFB).

- 56 Elemente mit Schlüsseln (`map.*` in `i18n/en.js`): Anzeige-/Info-/Zeit-Menü,
  Audio-Menü (Optionen Modus/Humor/TTS/Pax-Audio), Formel-Leiste, Schließen,
  Tooltips von Stoppuhr, Rechner, Höhenprofil, Live-Boxen. Fünf lose Checkbox-Texte
  im Audio-Menü stehen jetzt in einem `<span>` (Layout unverändert, Win95-Farbe
  identisch).
- Geprüft: HTML nach Entfernen der Schlüssel byte-gleich zum alten Stand;
  `#mapTableOverlay` nach EN→DE zeichengenau gleich; EFB-Abgleich grün,
  15 EFB/Tracker-Tests grün (`efb-app/frame-recovery.test.js` scheitert lokal am
  fehlenden `typescript`-Paket, unabhängig davon).
- Bewusst ohne Schlüssel (JS schreibt/liest): alle An/Aus-Schalter (`map.js`,
  `map-display-controls.js`, `profile.js`, `map-drawing.js` „Messen“), Legs-Umschalter,
  Uhr-Statuszeilen (`display-clock.js`), Missions-Banner, Cargo-Tooltip,
  Skalierungs-Knöpfe, Checklisten-Inhalt (`checklists.js`), Media-Player-Teil des
  Audio-Menüs. Beschriftungen mit ZOOM/MAX/FT/ALT im Profil bleiben (mobile
  Ausblendung in `map-profile-controls.js` sucht diese Wörter).
- Nächste Teile: 2 Karte/Werkzeuge (Schalter in `map.js` & Co.), 3 Höhenprofil
  (`profile.js`), 4 Checklisten, 5 Media-Player/Uhr/Kleinkram.

### Phase 1 – Crew-Module (2026-11-02, lokal)

- `crew-presence-client.js` (Freigabe-Zettel, Flug-Zettel, Flug-Detail) und
  `crew-fleet-client.js` (Vereinsflotte, Flottenkarte, Hinweis) über lokale
  `tr(key, deutsch, vars)`. Uhrzeit/Zahlen in der UI-Sprache (`en-GB`/`de-DE`).
- **Core-Dateien unverändert:** `crew-presence-core.js` (Phasen) und
  `wili-fleet-core.js` (`LOCK_LABEL`, `noticeText`) werden von Tracker und Worker
  mitbenutzt. Übersetzt wird über den Zustands-Schlüssel (`crew.phase.<phase>`,
  `fleet.lock.<state>`), die Core-Texte bleiben deutscher Rückfall. Der Hinweistext
  bei Flottenänderungen (`noticeText`) bleibt deutsch.
- Kartenebenen-Namen („✈️ VFR-Overlay“ …) bleiben: sie sind Schlüssel und werden
  in `ga_crew_flight_map_layers_v1` gespeichert.
- Geprüft: Tracker-Tests `tracker-crew-fleet-watch`, `tracker-crew-presence`,
  `tracker-homebase-crew`, Worker `crew-presence.test.mjs`; Flottenkarte und
  Hinweis im Browser DE/EN/DE. Flug-Zettel und Flottenliste konnten lokal nicht
  gezeichnet werden (keine Crew verbunden); Gegenprobe: alle bisherigen deutschen
  Texte stehen unverändert als Rückfall im Code.

### Phase 1 – Pinnwand (2026-11-02, lokal)

- Kopfzeile, Tabs, Knöpfe (`.pb-label`), Anheft-/Transfer-/Import-Dialog und der
  Pinnwand-Knopf im Hauptmenü (Text jetzt in eigenem `<span>`) haben Schlüssel.
- `board.js`: feste `alert`/`confirm`/`prompt` im Pinnwand-Teil laufen über
  `_boardUiPhrase` (Sätze in `en-phrases.js`); Zettel-Bedienelemente, Crew-Liste,
  Homebase-Verzeichnis, Behördeneintrag-Anzeige über `_boardUiText`.
- **Daten bleiben unverändert:** Tipp-Zettel sind deutsch gespeichert und werden nur
  bei der Anzeige per ID übersetzt (`pinboard.tip.<id>`); angeheftete Flüge sind ein
  Briefing-Schnappschuss (Missionsinhalt); das deutsche Präfix
  „BEHOERDENEINTRAG“ im gespeicherten Text wird weiter wie bisher entfernt.
  Geprüft: `ga_pinboard` nach EN→DE byte-gleich.
- Crew-Status aus `crew-presence-client.js` wird in der Crew-Liste über Sätze
  übersetzt (Online, Aktiv, Verborgen, Fliegt).
- Offen: PPL-Quiz-Inhalt bleibt deutsch (Entscheidung offen); PDF-Briefing-Pack,
  Fehlerbericht und der API-Key-Startdialog (`dispatchApiKeyDialog`).

### Phase 1 – Skins Tower/Fernschreiber/NavCom (2026-11-02, lokal)

- `analog-skins.js`: Markup-Bausteine sind jetzt Funktionen (`deskHtml`,
  `telexHtml`) mit `tr(key, deutsch)`. Bei Deutsch byte-gleich zum alten Markup
  (geprüft: Tower 5248, Fernschreiber 4108 Zeichen). Laufzeit-Texte (Richtung,
  Distanz, Funkgerät-LCD, Telegramm-Wörter, Quittung, Platztyp-Klappe) über `tr`.
  Sprachwechsel = `teardown()` + `apply()` (derselbe Weg wie ein Skin-Wechsel).
- `navcom-skins.js`: Vorlagen unverändert; `translateTitles()` übersetzt beim
  Aufbau einer Einheit die Tooltips über die Satz-Tabelle. Sprachwechsel baut
  Bendix/KX neu auf. Geprüft: nach EN→DE und Rückkehr zu Klassik ist
  `#navcomInputs` identisch.
- Schnellwahl-Tooltips (`describeAircraftPresetSummary`, `app.js`) übersetzt.
  **Die Teile „<n> TAS“ und „<n> GPH“ bleiben unverändert**: Der Tower-Skin liest
  sie aus dem Tooltip.
- Prüfskript: erkennt Schlüssel-Präfixe (`'a.b.' + x`, `` `a.b.${x}` ``) und den
  Helfer `tr()`.
- Offen: Meldungen der Skins in der Statuszeile („System bereit.“) – Missionsphase.

### Phase 1 – Dispatch-Bereich: Analyse

Bereich: `index.html` Zeilen ca. 240–650 (klassisch, Ops 1940, NavCom, Statuszeile)
und das Platztyp-Popup (ca. 2766–2785).

Ergebnisse:
- Typ-Liste: wird aus `MISSION_PICKER_OPTIONS` (`app.js`) in
  `_populateMissionTypeSelects` gebaut; Beschriftungen sind reine Anzeige, Logik
  hängt am `value`. Übersetzen beim Befüllen, per Schlüssel aus dem `value`; beim
  Sprachwechsel `refreshMissionPickerOptions()` + `updateOps1940Panel()`.
  `syncOpsSelectOptions` kopiert Texte und erkennt Änderungen selbst (Signatur).
- Platztypen (`airport-type-filter.js`): `GROUPS` bleibt deutsch (API, Selbsttests),
  nur `summary`/`radioSummary`/`renderOptions`/aria-Texte übersetzen;
  `renderOptions` rendert nur einmal (`dataset.rendered`) – beim Sprachwechsel
  zurücksetzen.
- RDM/PICK-Tooltips: `updateMissionProposalModeButtonUi` (`app.js`), reine Anzeige,
  beim Sprachwechsel neu aufrufen.
- Generieren-Knopf: `data-i18n-initial` + Sätze („Auftrag generieren“,
  „Sucht Route & Daten...“, `app.js` ca. 11124/44510).
- Statuszeile `searchIndicator`: 39 Schreiber, meist Missionsablauf;
  `app.js:5092` prüft `includes('Mission Picker:')`, `analog-skins.js:945` und
  `navcom-skins.js:420` vergleichen auf exakten Text → **zur Missionsphase**.
- Nicht per `data-i18n`: Elemente mit Kind-Elementen (`btnToggleAI` „KI Mode“,
  Pinnwand-Knopf mit Badge), von JS gesetzte Titel (`navcomTestBtn`, `com2Knob`,
  RDM/PICK-Labels), Platztyp-Zusammenfassungen.
- Ops 1940 Richtungsknopf „O“ (Osten) → auf Englisch „E“.
- Eigener Folgeschritt: `analog-skins.js` (Tower/Fernschreiber, ca. 30 Texte in
  HTML-Strings) und `navcom-skins.js` (ca. 8) – nach dem Einfügen `GAI18n.apply(el)`.

## 5. Offene Entscheidungen

1. ~~Weg für generierte Inhalte (2.2)~~ entschieden: C, Live-Stimme B.
2. Sollen englische Missionen nur für dieselben Gebiete laufen, oder auch
   englischsprachige Regionen bekommen (z. B. FAA-Plätze)? Das ändert Phase 3/4 stark.
3. Funk-Phraseologie in der englischen Fassung: ICAO-Englisch statt deutscher
   Sprechgruppen?
4. Sprache pro Gerät oder pro Pilotenprofil (Cloud)?
5. PPL-Quiz auf Englisch ausblenden?
6. Welche Stimmen für Englisch (ElevenLabs-Auswahl, Kosten pro Pack)?

## 6. Sofort sinnvoll, auch ohne festen Starttermin

Phase 0 einführen und ab dann jeden neuen Text über `t()` schreiben. Das kostet
pro neuer Funktion kaum Zeit und verhindert, dass die Menge bis zum eigentlichen
Start weiter wächst.
