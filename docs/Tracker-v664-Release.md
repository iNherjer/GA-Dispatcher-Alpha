# Tracker v664 Alpha – Direct To mit Umweg, EFB-Kartenleistung, Kartensuche

Der Tracker liefert EFB-Webassets mit Revision 66401. Der zugehörige Web-Cache ist v2555.

- **Direct To während einer Mission** (Fähigkeit `navigation.detour.v1`): Die App und das EFB fragen, ob die
  Mission verworfen oder erhalten werden soll. „Erhalten“ legt einen Umweg neben den Missionslauf
  (`navigation-detour-v1.json`, an die `runId` gebunden). Führung, Profil, Warnungen und Flugplan-Export folgen dem
  Umweg. Run, Hashes und `navigationRevision` der Mission bleiben unverändert. Route Reset leuchtet während eines
  Umwegs, fragt nach und führt zurück zur Missionsroute. Endet die Mission, wird der Umweg gelöscht. Neue Intents:
  `navigation_detour_set` und `airport_direct_to` mit `keepMission`. Siehe `docs/Mission Runtime Authority Contract.md`,
  Abschnitt vom 26.11.2026.
- **EFB-Karte:** Flugplatz- und Funkfeuer-Symbole bleiben beim Verschieben erhalten. Das Höhenprofil wird bei
  Kartenbewegung gedrosselt. `airports.json` wird vorgefiltert.
- **Kartensuche (Lupe) und „Was ist hier?“ als Panel** jetzt auch im EFB.
- **Funkfeuer als ICAO-Symbole** im EFB-Overlay.
- **DWD-Stundenwahl** endet am veröffentlichten Bestand.

## Im Simulator prüfen

- Mit laufender Tracker-Mission im EFB auf einen Flugplatz tippen und „Direct to“ wählen. Mit „Mission erhalten“
  erscheint der Umweg cyan, die Missionsroute blass dahinter. Route Reset leuchtet, fragt nach und kehrt zurück.
  Den Flugplan in die Avionik laden: Es kommt der Umweg. Mit „Mission verwerfen“ wird die Mission abgebrochen,
  danach steht die Direct-To-Route.
- Symbole beim Verschieben und Zoomen (nichts doppelt, nichts bleibt hängen), Höhenprofil beim Verschieben ruhiger.
- Suche mit der Sim-Tastatur, Panel „Was ist hier?“ in 2D und VR.
- Funkfeuer-Symbole und Farbfelder, DWD-Zeitleiste endet am Bestand.

## Tests

- Tracker-Gesamtlauf: 1645 bestanden, 2 übersprungen, 0 Fehler (inklusive der neuen
  `tracker-navigation-detour.test.js`).
- Web im Browser: Dialog, Start per „📍 Start hier“, Ziel per Suche, Umweg bearbeiten, Route Reset mit Rückfrage,
  Verwerfen, Wiederherstellen nach Neuladen, Missionsende, Hilfe auf Deutsch und Englisch.

## Artefakt

- [Tracker v664 Alpha](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v664)
  aus Commit `c97b82e97`. Windows-x64-EXE mit 177231897 Bytes.
- SHA-256 `015b375dd905411d03e49de624e8b8741041ac8b33c4659857b2afa04d5c8674`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
