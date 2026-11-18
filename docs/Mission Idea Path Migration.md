# Umbau der Missionsarten auf den Ideen-Weg – Klärungsstand

Stand 18.11.2026 (Basis `15277d796`). Offene Planung, noch nichts umgebaut. Anlass ist Phase 4 der
englischen Übersetzung (`docs/English Translation Plan.md`), die Entscheidung soll in einer eigenen
Sitzung fallen.

## 1. Worum es geht

Die Missionserzeugung hat heute zwei Bauarten:

- **Ideen-Weg:** Ein Ideen-Kern lässt Gemini strukturierte Vorschläge als JSON planen
  (`*-idea.v1`, `*-proposal.v1`), prüft Felder, Fakten-IDs und Verträge und baut daraus Briefing,
  Ladung, Passagiere und Szene. Der Text ist Ergebnis, nicht Datenquelle.
- **Alte Pipeline (V4-Planner + V5-Writer):** `_missionPipelineV4*` und `_missionWriterV5*` in
  `app.js`. Der Writer schreibt Fließtext; viele Prüfungen und Folgeschritte lesen diesen Text
  mit deutschen Mustern aus.

Für die Übersetzung ist das der entscheidende Unterschied (Abschnitt 4): Missionsarten auf dem
Ideen-Weg können direkt auf Englisch schreiben, die alte Pipeline nicht ohne zweisprachige Prüfungen.

## 2. Bestand

### Schon auf dem Ideen-Weg

| Bereich | Kerne / Schemata | Doku |
|---|---|---|
| APT Charter | `mission-charter-ideas-core.js`, `charter-idea.v1` | `Mission Charter Ideas V1.md` |
| APT Besichtigung | `mission-sightseeing-ideas-core.js`, `sightseeing-idea.v1` | `Mission Sightseeing Visits V1.md` |
| APT Reporter | `mission-apt-news-ideas-core.js`, `apt-news-idea.v1` | `POI Reporter Briefing Migration.md` |
| APT Medizin-Transfer | `mission-medical-transfer-ideas-core.js`, `medical-transfer-idea.v1` | Roadmap |
| APT Verein/Utility | `mission-club-ideas-core.js`, `club-idea.v1` | `Mission Club Utility Ideas V1.md` |
| APT Fracht, zerbrechliche Fracht, Tiertransport | `mission-cargo-ideas-core.js`, `mission-fragile-cargo-ideas-core.js`, `mission-animal-transport-ideas-core.js` | `Mission Cargo Ideas V1.md`, `Mission Fragile Cargo Ideas V1.md` |
| Privat | `mission-private-episode-v6.js` (`private-proposal.v1`), `mission-private-outing-core.js`, `mission-private-return-core.js` | `Mission Episode Writer V6.md` |
| POI-Briefings | `sar-proposal.v2`, `infra-proposal.v1`, `mapping-proposal.v1`, `knowledge-proposal.v1`, `geo-proposal.v1`, `poi-photo-proposal.v1`, `news-proposal.v1` (Briefing-Kerne `mission-*-briefing-browser.js`) | `POI Shared Briefing Guide.md` u. a. |

Gemessen (AST-Zählung, Regex mit deutschen Wörtern): die Ideen-Kerne haben **0–1** solcher
Prüfungen je Datei. Deutsch ist dort nur die Sprachvorgabe im Prompt.

### Noch alte Pipeline

- **Bush, alle sechs Profile** (Versorgung, Charter, Abenteuer, Personen-/Frachtabholung,
  Erkundung): V4-Planner + V5-Writer. Laut `Mission Semantics Rules V4.md` lösen die alten
  semantischen Prosaheuristiken dort **nur noch Diagnose** aus, keinen Ersatztext. Struktur-,
  Vertrags-, Szenen- und Laufzeitprüfungen bleiben.
- **Übrige Legacy-APT-/POI-Pfade**, für die die Ausnahme nicht gilt (genaue Liste offen, siehe 5).

Deutsche Textmuster in `app.js` nach Funktionsgruppe: `_missionPipelineV4*` 162,
`_missionWriterV5*` 127, `_storyAlreadyCoversProfileCue` 21, `_poi*` 17, Privat-Ausflug-Helfer
~40, `missionMatchesTaskProfile` 12, `_deriveTaskDomain` 6 (Rest kleiner). Gesamt in den
Missionsdateien gut 830, davon rund 130 in Qualitätsprüfungen (`NeedsRepair`, `Looks…`,
`sanitize…`). Seit dem 05.11. kaum gesunken.

## 3. Wo der deutsche Text nach dem Schreiben weiterverwendet wird

Diese Stellen müssen bei einem Umbau auf strukturierte Felder umziehen (oder zweisprachig werden):

- Fracht-SimObject-Auswahl aus dem Frachttext (`sync.js` um `pickPrimary`, ~Z. 7198)
- SAR-Erkennung „vermisste Person …“ (`sync.js` ~Z. 8785, `_missionSarLooksLikePersonSearch`)
- `_missionTargetSceneKind` mischt `taskDomain` mit Text (`sync.js`)
- Infrastruktur-Ergebnisklassen (`mission-infra-outcome-core.js`)
- Rückfall-Klassifizierer `_deriveTaskDomain`, `_deriveRoleProfileFromRole` (nur ohne Felder)
- Fracht-Auswahl aus Story (`_pickPrivateOutingCargo`, `_pickClubUtilityCargo`,
  `_pickCargoFragileCargoFromStory`, `_animalTransportCargoSignalFromText`)
- Passagierstimme: `_isLandingPhaseEvent` / Trainings-Erkennung lesen den gesprochenen Satz
  (`passenger-voice.js`), Erzählgedächtnis nutzt deutsche Ereignistitel als Schlüssel (bleibt, siehe
  Übersetzungsplan 2.10)

## 4. Bezug zur Übersetzung (Phase 4)

| Weg | Englisch bei Bedarf | Mehrkosten |
|---|---|---|
| Ideen-Weg | Writer schreibt direkt Englisch (Sprachparameter im Prompt), Prüfungen bleiben strukturell | ~0 (kein Zusatzaufruf); feste deutsche Rückfallsätze brauchen englische Fassung |
| Alte Pipeline | Deutsch erzeugen und prüfen, Englisch nachreichen (Variante C) | ein Übersetzungsaufruf je Mission |
| Schon erstellte Missionen | Übersetzung bei Bedarf, Ergebnis gespeichert | einmalig je Mission |

Kostenschätzung aus dem Messlauf einer kompletten Bush-Mission (Oktober,
`analysis/gemini-parameter-migration/full-bush-release.json`): 8 Aufrufe, ~48.000 Eingabe-,
~4.000 Text- und ~6.500 Denk-Tokens. Eine Übersetzung kostet ~2.000–4.500 Eingabe- und etwa gleich
viele Ausgabe-Tokens ohne Denken: grob +25–35 % je Mission mit demselben Modell, +5–10 % mit einem
kleinen Modell (Flash-Lite). Nur bei englischer Oberfläche. Schätzung, Preise nicht nachgemessen.

Jeder Missionsart, die auf den Ideen-Weg wechselt, kann danach ohne Zusatzaufruf englisch schreiben.

## 5. In der eigenen Sitzung zu klären

1. **Vollständige Liste:** Welche Missionsarten/Profile laufen produktiv noch über V4/V5 (Bush
   sicher; welche APT-/POI-Pfade noch)? Dispatch-Routing in `app.js` nachverfolgen.
2. **Bush direkt englisch?** Da die Prosaheuristiken bei Bush nur noch diagnostisch sind: Reicht es,
   die Folgeschritte aus Abschnitt 3 auf Felder umzustellen, damit der V5-Writer direkt Englisch
   schreiben darf – oder soll Bush komplett auf einen Ideen-Kern (`bush-idea.v1`) wechseln?
3. **Zielbild und Reihenfolge:** Welche Art zuerst (Vorschlag: die mit den meisten Textfolge-
   schritten zuletzt; Bush vor SAR/Infrastruktur, weil die Prüfungen dort schon entschärft sind).
4. **Was bleibt Legacy?** Sim-Modus-Pfad (`docs/Mission Runtime Authority Contract.md`, Web-Laufzeit
   ist Legacy) nicht mit umbauen.
5. **Freigabe:** Änderungen an Klassifizierung, Parsern, Regex-Heuristiken und Contracts betreffen
   mehrere Missionsarten → laut `AGENTS.md` erst Problem/Ursache/Impact nennen, Freigabe abwarten.
6. **Messung:** Vor dem Umbau je Missionsart Aufrufe und Tokens neu messen
   (`tools/gemini-mission-release-live.mjs` o. ä.), damit der Kostenvergleich auf aktuellem Stand ist.

Pflichtlektüre für die Sitzung: `docs/Mission Flow Reference.md`, `docs/Mission Building
Instructions.md`, `docs/Mission Semantics Rules V4.md`, `docs/Mission Roadmap.md`, dieses Dokument.
