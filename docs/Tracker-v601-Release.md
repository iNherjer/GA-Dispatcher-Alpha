# Tracker v601 Alpha / Web v2268 – Lauf mit Cloud-Aktivierung verknüpft

## Änderungen

- Tracker: Die Lauf-Meldung an die App (`publicRun`) enthält `cloudActivation: { epoch, revision }` aus
  `resumeBundle.cloudMissionControl`, also die Cloud-Aktivierung, aus der der Lauf geladen wurde.
- Web (bereits live): Die App merkt sich den Lauf zusammen mit dieser Aktivierung. Zeigt die Cloud eine andere
  Aktivierung oder ein Löschen, ist der gemerkte Lauf vorbei („Mission läuft noch“ verschwindet), ohne Zeitvergleich.
  Läufe ohne Aktivierung (ältere Tracker, Legacy-Profile, nicht aus der Cloud geladene Läufe) nutzen weiter die
  Zeitregel mit 5 Minuten Puffer.
- Stimmig mit dem Tracker: Jede neue Revision desselben Slots bricht im Tracker den alten Lauf ab und lädt die
  Mission neu als geplant (`tracker-cloud-mission-reconcile.js`).

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `930efbdc2`): 174665703 Bytes; SHA-256 `4ec8becc09807fdfcbdd3964b340987e44ef34ad384ad4462657d8b689e442fd`.
Öffentlicher Download geprüft.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Tracker-Tests zu `mission-authority-core`/`getPublicSnapshot`: 417 grün.
- Web: `tools/tracker-run-cloud-forget.test.mjs` (Aktivierung gleich/neu/andere Epoche, Rückfall-Zeitregel, Live-Lauf).

## Im Feld prüfen

- Mission annehmen und im Tracker beginnen; zweites Gerät ohne Tracker zeigt „Mission läuft noch“.
- Mission löschen und gleich wieder aus der Pinnwand annehmen: Hinweis verschwindet beim nächsten Cloud-Abgleich.
