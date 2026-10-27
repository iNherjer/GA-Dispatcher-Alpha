# Tracker v596 Alpha / Web v2229 – Crew-Status, Flug-Zettel, weniger Crew-Abfragen

Nutzerwunsch: Crew-Mitglieder sehen, wer online ist und wer gerade fliegt, auch wenn jemand nur mit
Tracker und EFB fliegt. Freigaben per Zettel auf dem Crew-Brett. Cloudflare-Last klein halten.

## Änderungen

- `crew-presence-core.js` (neu, gemeinsam für Worker, Tracker, App): Freigaben `crewShare
  {online, flight, at}` (Standard an, neueste Wahl gewinnt), Flugphase, Fortschritt entlang der Route,
  Flug-Snapshot mit Position und ≤ 40 Routenpunkten, Sende- und Schreibbremse, Sichtbarkeit
  (online = Meldung < 12 min, gelandet 30 min sichtbar), Auftrag ohne Laufzeitfelder.
- Worker 7086caeb (deployed 27.10.2026): `/api/crew-presence-v1/<Crew>` mit Durable Object
  `CrewPresence` je Crew (Migration `crew-presence-v1`), Auftragsablage je Flug. Keine KV-Writes;
  Anmeldung/Mitgliedschaft 10 min je Isolate zwischengespeichert. Details: `tools/cloudflare-worker/README.md`.
- `tracker-crew-presence.js` (neu): Tracker meldet sich alle 5 min (Gruppe und Freigaben aus dem Profil,
  alle 10 min gelesen), Flugereignisse frühestens nach 1 min; Missionsflug aus dem aktiven Lauf, freier
  Flug vom Abheben bis zum Stillstand nach der Landung (Aufsetzen und Durchstarten bleibt derselbe Flug);
  Auftrag einmal je Flug hochgeladen (≤ 60 KB); Abmeldung beim Beenden.
- `tracker-homebase-crew.js` / `homebase-integration.js`: Crew-Homebases alle 10 min statt 45 s
  (je Abruf mehrere KV-Reads je Mitglied); App fragt im Hintergrund nicht mehr ab.
- Web v2229: Zettel „Meine Freigaben“ (Homebase, Online-Status, aktueller Flug), Status in der Crew-Liste,
  Flug-Zettel mit Start → Ziel, Auftrag, Status, Startzeit, Fortschrittsbalken mit Flugzeug, NEU-Markierung
  am Pinnwand-Symbol; Detailansicht mit Karte (Route, Wegpunkte, Position nach Kurs, Kartenebenen) und
  „Diesen Auftrag selbst fliegen“ (Lade-Weg der Pinnwand). Ausgeblendete Crew-Zettel bleiben über das
  Profil auf allen Geräten ausgeblendet.

EFB-Assets unverändert. Nur Alpha-Runtime umstellen, Stable unverändert.

EXE (Windows-x64, pkg 6.18.1 / Node18, Cross-Build `--no-bytecode --public --public-packages '*'` aus sauberem
Worktree von `1f9e6cabc`): 174640866 Bytes; SHA-256 `d6760db2214d5865d056598434db9251d8848dfdc0da529c805a76803290b050`.
Öffentlicher Download geprüft (gleiche Größe und Prüfsumme).

## Prüfung

- Tracker-Gesamtsuite: 1520 Tests, 1518 bestanden nach Anpassung des Quelltext-Tests für `loadPinnedFlight` (`mission-control-ui-core.test.js`); `tracker-mission-fire-process.test.js` bleibt lastabhängig (einzeln 2/3).
- Neu: `tools/cloudflare-worker/crew-presence.test.mjs` (11), `ga-tracker-client/tracker-crew-presence.test.js` (7),
  `tracker-homebase-crew.test.js` angepasst (8). Worker-Gesamtsuite grün.
- Web im Browser mit simulierten Antworten: Crew-Liste, Zettel, Schalter, NEU-Markierung, Detailkarte,
  Kurs-Drehung, Wegpunkte, Lade-Knopf. Nicht mit zwei echten Konten getestet.

## Im Feld prüfen

- Zwei Konten in derselben Crew: Tracker an → anderer sieht „Online“; Abflug → Flug-Zettel und NEU.
- Debug-Log: `CREW_PRESENCE_GROUP`, `CREW_PRESENCE_FLIGHT … phase=…`, `CREW_PRESENCE_MISSION … bytes=…`.
- Details öffnen, Position/Kurs plausibel; „Diesen Auftrag selbst fliegen“ lädt den Auftrag als Planung.
- Freigabe „Aktueller Flug“ aus → Zettel verschwindet beim anderen nach dem nächsten Abruf (≤ 3 min).
