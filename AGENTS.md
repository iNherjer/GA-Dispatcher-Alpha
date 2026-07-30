# GA Dispatcher Agent Instructions

Diese Datei ist der verbindliche Einstiegspunkt fuer Codex/AI-Arbeit in diesem Repository. Zu Beginn eines neuen Chats in diesem Projekt diese Datei zuerst beachten und die unten genannten Referenzen passend zur Aufgabe lesen, bevor Code geaendert wird.

## Start-Routine

1. `README.md` lesen, wenn der allgemeine Produktkontext im aktuellen Chat noch nicht klar ist.
2. Vor Codeaenderungen `git status --short` pruefen und fremde/unerklaerte Worktree-Aenderungen nicht anfassen.
3. Bei groesseren Aenderungen zuerst die betroffenen Dateien und die passende Doku lesen, dann erst editieren.
4. Bestehende Architektur und lokale Patterns bevorzugen. Keine grossen Refactors, wenn die Aufgabe mit einer gezielten Aenderung loesbar ist.

## Pflichtlekture nach Arbeitsbereich

- Missionslogik, neue Missionstypen, Bush/POI/APT, Runtime, Manifest, Cargo, Ground Actions:
  - `docs/Mission Flow Reference.md`
  - `docs/Mission Building Instructions.md`
  - `docs/Mission Semantics Rules V4.md`
  - `docs/Mission Roadmap.md`, wenn Prioritaeten oder neue Missionsideen betroffen sind
- Mission-Szenen, SimObjects, MSFS-Assets, SAR-/Unfall-/Pickup-Szenen:
  - `data/mission-scene-asset-strategy.md`
  - zusaetzlich die Missionsdoku oben, wenn die Szene Teil einer Mission ist
- Hindernisse, Terrain-/Obstacle-Chunks, Tile-Workbench:
  - `obstacles/README.md`
  - `tools/chunk-unification-plan.md`, wenn Chunk-Architektur oder Build-Pipeline betroffen ist
- Voice/Passenger-Audio:
  - `tools/VOICE_GENERATION.md`
  - relevante Stellen in `passenger-voice.js`
- Cloudflare Worker, AIP Chart Proxy, Sync-/Worker-Endpoints:
  - `tools/cloudflare-worker/README.md`
- GAFOR-Sektor-Editor:
  - `tools/gafor-sector-editor.md`
- GitHub Push, Release, Tracker-EXE:
  - `docs/github-push-workflow.md`

## Missions-Guardrails

- Neue Missionen zuerst als Komposition bestehender Bausteine bauen.
- `sync.js` orchestriert UI/Ablauf; fachliche Entscheidungen gehoeren nach Moeglichkeit in die Core-Dateien.
- Manifest/Cargo-Erfolgskriterien ueber `mission-cargo-core.js` modellieren, nicht als lose UI-Sonderfaelle.
- Runtime-Phasen und Voice-Layer nicht vermischen. `passenger-voice.js` darf Kontext erzaehlerisch nutzen, aber keine versteckte Missions-State-Machine werden.
- Fuer die V4-Pipeline gilt `docs/Mission Semantics Rules V4.md`: Zieltyp und TaskDomain bleiben der Primaerfokus; Geo-Kontext darf nur ergaenzen.

## Drift- und Datenbasis-Regeln

- Bei Missionsdrift nicht zuerst nachtraegliche Verbotslisten bauen. Zuerst Ursache und Datenbasis pruefen: Zieltyp, TaskDomain, Rollenprofil, Contract, MissionTruth, SceneIntent, Parser/Regex-Heuristiken und Seed-Daten.
- Guardrails sollen stabile Vertraege absichern, nicht falsch gewaehlte Grundlagen kaschieren. Wenn eine Regel nur Symptome unterdrueckt, ist meistens die Klassifikation, das Profil, der Basiskontrakt oder ein Datenanker zu unscharf.
- Keine eigenmaechtigen Aenderungen an zentraler Datenverarbeitung, Klassifikation, Parsern, Regex-Heuristiken oder Profil-/Contract-Logik, wenn dadurch andere Missionstypen betroffen sein koennen.
- Wenn bei der Analyse ein uebergreifender Fehler gefunden wird, zuerst Problem, vermutete Ursache, betroffene Missionsarten und erwarteten Impact benennen. Danach eine gezielte Loesung vorschlagen und vor Umsetzung die Freigabe des Users abwarten.
- Positive Basis verbessern statt Fall fuer Fall Drift verbieten: Profile, Seeds, MissionTruth, Arrival-/Scene-Rollen und Contracts so schaerfen, dass die richtige Mission stabil aus der Grundlage entsteht.

## Push-/Release-Regeln

- Bei normalen Pushes nach `origin/main` vorab `sw.js` Cache-Version erhoehen.
- In gemischten Worktrees niemals `git add -A` nutzen; nur explizit gewuenschte Dateien stagen.
- Wenn `ga-tracker-client/tracker.js` geaendert wurde, muss die Tracker-EXE neu gebaut und als Release-Asset veroeffentlicht werden. Details stehen in `docs/github-push-workflow.md`.
