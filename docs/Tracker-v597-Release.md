# Tracker v597 Alpha / Web v2231 – Crew-Status: Durchsicht, Auftrag komprimiert, Aktualisieren-Knopf

Durchsicht von v596 nach Nutzerwunsch („Bugs, Edge Cases, Performance?“).

## Änderungen

- Auftrag zum Selbstfliegen: Ankunftsplan (Platzierungs-Geometrie, oft 60 KB) nur einmal, gzip + Base64
  (`encoding: 'gzip-base64'`). Ein lokaler Sightseeing-Auftrag: 144 KB → ~20 KB; vorher lag fast jeder Auftrag
  über der 60-KB-Grenze und wurde nie geteilt. Web entpackt mit `DecompressionStream` und setzt den Plan wieder
  an den Vertrag (`restoreSharedMissionState`). Worker nimmt das alte v596-Format weiter an.
- Tracker: gespeicherte Direct-To-Route wird für freie Flüge ignoriert, wenn das Flugzeug > 15 NM entfernt ist
  (vorher falsches Ziel und Fortschritt aus alter Sitzung).
- Tracker: neue Flugphase muss 30 s anhalten (Landung sofort); verhindert Steig-/Reiseflug-Flackern und
  Schreibzugriffe im Minutentakt beim Handfliegen.
- Web: Wegpunkt-Namen im Karten-Tooltip als Text statt HTML (Namen kommen von anderen Piloten).
- Web: Platzhalter `GPS`, `POI`, `HOMEBASE`, `OUR-…` zeigen den Platznamen.
- Web: kompakte Ebenen-Auswahl in der Detailkarte; ab vier Flügen zweite Reihe in der Brettmitte.
- Web: 🔄 in der Crew-Liste aktualisiert Crew-Zettel, Status und Homebases sofort (höchstens alle 15 s, nur
  Lesezugriffe). Worker 9fc99173: `?fresh=1` prüft die Mitgliedschaft sofort statt nach bis zu 10 min.

EFB-Assets unverändert. Nur Alpha-Runtime umstellen, Stable unverändert.

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `df82cda29`): 174643966 Bytes; SHA-256 `fea24c3fcac6e9a00c63ad6fe33d40f2ed271024bb0fb86dd4817b3826158f8b`.
Öffentlicher Download geprüft.

## Prüfung

- Worker-Gesamtsuite grün (Crew-Status 12 Tests), Tracker `tracker-crew-presence` 8, `tracker-homebase-crew` 8,
  `mission-control-ui-core` 19.
- Browser: echter lokal erzeugter Auftrag → Stufe-3-Kompression → gzip → Laden über „Diesen Auftrag selbst fliegen“:
  Titel, Überschrift, Start/Ziel, Route, Story, Ankunftsplan inkl. Geometrie am Vertrag, kein Entwurf.
  Präparierter Wegpunkt-Name bleibt Text. 🔄 lädt neue Mitglieder sofort.

## Im Feld prüfen

- Debug-Log `CREW_PRESENCE_MISSION … raw=… bytes=…` statt `CREW_PRESENCE_MISSION_SKIPPED`.
- POI-/Bush-Auftrag eines Crew-Mitglieds übernehmen und nachfliegen (Stufe-3-Daten ohne MissionTruth/Wiki).
