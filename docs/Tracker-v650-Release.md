# Tracker v650 Alpha – Passagierstimme in der Missionssprache

Zusammen ausgeliefert mit Web v2465 (19.11.2026). Phase 4 der englischen Übersetzung, Details:
`docs/English Translation Plan.md` 2.24.

## Änderungen

- **Sprachquelle:** `currentMissionData.outputLanguage` der laufenden Mission
  (`createMissionVoiceLanguage` in `tracker-mission-voice-scope.js`, Option `missionLanguage` des
  Sprachdiensts). Englisch nur bei KI-Missionen aus englischer Oberfläche; sonst Deutsch wie bisher.
- **Sprachdienst** (`tracker-voice-service.js`): englische Ausgabevorgabe an jedem KI-Prompt (Gemini und
  OpenAI), feste deutsche Zeilen und Rückfallsätze werden vor dem Sprechen übersetzt, deutsche
  Fertig-Clips (Survey/Training) entfallen zugunsten der Live-Stimme, englische Sprechweise für Übelkeit,
  Verein und Sightseeing.
- **Charter-/Reporter-Rückblick:** englischer Prompt und Ersatztext bei englischer Hinflug-Mission
  (`mission-charter-continuation-core.js`, auch Web).
- **Trainings-Begrüßung:** Prüfung kennt englische Trainingswörter (`mission-boarding-voice-core.js`).
- Deutsch: Prompts, Effekt-Fingerabdrücke und Ablauf unverändert.
- `EFB_WEB_ASSET_REVISION` 65001.

## Build

- Tag `v650` auf `fa5244f66`, EXE 175300630 Bytes, SHA-256
  `9e0880e9f565da66f24acf051874527aa2a6ad1018b802a080620d3034773f12`, öffentlicher Download geprüft.

## Tests

- Neu: `ga-tracker-client/tracker-voice-language.test.js` (7), `tools/mission-charter-continuation.test.cjs`
  (englischer Rückblick). Live-Abruf (nur Text): deutsche Mission unverändert deutsch, englische Mission
  englischer Abschied und übersetzte Trainingsanweisung.

## Prüfen im Feld

- Englische Oberfläche, KI-Mission erstellen, fliegen: Begrüßung, Ansagen, Abschied englisch.
- Trainings-/Survey-Mission englisch: Anweisungen englisch live gesprochen (kein deutscher Clip).
- Deutsche Mission: alles wie bisher, keine Zusatzabrufe.
- Noch deutsch (Phase 5): fertige Clips in `audio-pax/` und `audio-warnings/`, Zahlenzusammensetzung.
