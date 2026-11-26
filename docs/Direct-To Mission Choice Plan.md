# Direct-To bei vorhandener Mission: Verwerfen oder Erhalten (Entwurf 26.11.2026)

Status: umgesetzt am 26.11.2026 (lokal, noch nicht gepusht). Basis `72bb5103d`. Vertrag: `docs/Mission Runtime Authority Contract.md`, Abschnitt vom 26.11.2026.

User-Entscheidungen 26.11.2026: Web und Tracker/EFB zusammen; Umweg voll editierbar; Umweg wird am Missionsende gelöscht.
Zusatz: Im Direct-To-Modus ist der Start die eigene Position (Knopf „📍 Start hier“ neben dem Flugzeug), ein Kartenpunkt oder ein Treffer der Kartensuche. Das Ziel ist ein Kartenpunkt oder ein Suchtreffer. Gefragt wird beim Einschalten, verworfen wird erst beim Festlegen des Ziels.

## Problem (Ist-Stand)

Alle Direct-To-Wege (`freeflightDirectTo` über den Kartenmodus, `applyAirportDirectTo` über das
Flugplatz-Popup, POI-Freiflugplanung) überschreiben `routeWaypoints` und `currentMissionData` mit einem
„Privater Flug“ und rufen `markDirectToFreeflightMissionData` auf. Dieser Aufruf löscht Contract, Passagier und
Runtime aus `localStorage`.

Die einzige Rückfrage ist `confirmMissionAuthorityReplacement` (`sync.js`). Sie greift nur, wenn
1. der Tracker Mission Authority kann **und**
2. ein Authority-Run existiert (Mission angenommen/gestartet).

Deshalb wird **ohne Warnung** verworfen:
- eine disponierte, noch nicht gestartete Mission (Briefing, Passagier, Contract, Szene),
- jede Mission ohne Tracker bzw. mit Web-Autorität,
- Szene und Ladung werden dabei nicht sauber über den normalen Löschpfad abgeräumt.

Mit Tracker-Run gibt es zwar eine Rückfrage, der Abbruch läuft aber asynchron. Direct-To bricht danach ab
(„Du kannst Direct-to jetzt erneut starten“), man muss also zweimal klicken.

## Zielbild

Sobald Direct-To aktiviert wird (Knopf „✈️ Direct To“, „Direct to“ im Flugplatz-Popup, Kartenkontext) **und**
eine echte Mission vorhanden ist (nicht schon Freiflug/`routeOnly`), erscheint ein eigener Dialog statt
`confirm()`:

| Knopf | Wirkung |
|---|---|
| **Mission verwerfen** | Löscht Mission, Route, Runtime, Szene und Ladung über den bestehenden Löschpfad (`clearAppMissionState` bzw. `gaAbortTrackerMission`, mit Warten auf die Bestätigung). Danach läuft Direct-To wie heute. |
| **Mission erhalten** | Die Mission bleibt unverändert aktiv und läuft weiter. Die Direct-To-Route wird als **temporäre Umweg-Route** darübergelegt. |
| Abbrechen | Nichts passiert, der Direct-To-Modus geht wieder aus. |

Ohne Mission gibt es keinen Dialog, das Verhalten bleibt wie heute.

### Modus „Mission verwerfen“

- Vollständiges Abräumen wie „Mission löschen“: Runtime-Reset (`authorityOutcome: 'aborted'`), Szene,
  Passagier, Contract, Cargo, Briefing.
- Bei Tracker-Run: `gaAbortTrackerMission` abwarten und danach automatisch mit Direct-To weitermachen, ohne
  zweiten Klick.
- Die erste Direct-To-Route wird zur Route-Reset-Basis (`setRouteResetBaseline`, geschieht heute schon über
  `updateMap`).
- **Route zurücksetzen** führt zurück auf diesen ersten Direct-To-Plan. Das ist bestehendes Verhalten.

### Modus „Mission erhalten“ (Umweg-Route)

Kernregel: **`routeWaypoints`, `currentMissionData` und alles, was die Mission speichert, bleiben unberührt.**
Diese Werte lesen Missionsspeicher (`sync.js` ~1618), Seed, Voice-Kontext, Szenenanker und Fortschritt.
Würde die Umweg-Route dort hineingeschrieben, würde die Mission verfälscht.

- Neuer reiner Kern `map-detour-route-core.js` (wie `map-direct-to-core.js`, ohne Missionseffekte):
  `create(start, dest, missionId)`, `normalize`, `isActive`, `clear`. Zustand
  `{ schema: 'ga.detour-route.v1', id, missionId, createdAt, points }`.
- Gespeichert lokal (`ga_detour_route_v1`, überlebt Neuladen) und an die `missionId` gebunden. Ist die Mission
  weg oder eine andere geladen, wird die Umweg-Route verworfen.
- Darstellung:
  - Die Missionsroute wird blass gezeichnet (Linie und Marker ca. 25 % Deckkraft), ist nicht ziehbar, nimmt keine
    Wegpunkte an und hat kein Kontextmenü „Wegpunkt einfügen“.
  - Die Umweg-Route liegt im Vordergrund (cyan, durchgezogen), mit Start-/Zielmarker und Kurs/Distanz.
  - Kein eigenes Band (User-Entscheidung 26.11.2026): Route Reset ist der Weg zurück; sein Tooltip lautet während eines
    Umwegs „Zurück zur Missionsroute (Umweg beenden)“. Erklärt in der Kartentisch-Hilfe „?“ (de/en).
  - Route Reset leuchtet während eines Umwegs (`route-reset--detour`, Web und EFB) und fragt vor dem Zurückkehren nach.
  - Im Direct-To-Auswahlmodus leuchtet die Lupe (`map-search-btn--pick`), weil Suchtreffer Start/Ziel sein können.
- „Fliegbar“, also Navigationsanzeigen: ein Accessor `gaActiveNavigationRoute()` liefert die Umweg-Route,
  solange sie aktiv ist, sonst `routeWaypoints`. Umgestellt werden **nur** die reinen Anzeige-Leser:
  Nächster-WP/Restdistanz/ETA (`sync.js` ~18956–19750), Höhenprofil der Karte, Flugplan-Export in den Sim.
  Die Missionslogik (Ankunft, POI, Voice, Cargo, Szene) liest weiter die Missionsroute bzw. ihre eigenen
  Ziele.
- **Route zurücksetzen** löscht im Umweg-Modus nur die Umweg-Route, die Missionsroute wird wieder normal und
  editierbar. Es gibt keine Rückfrage, weil nichts von der Mission verloren geht.
- Ein erneutes Direct-To während eines aktiven Umwegs ersetzt nur die Umweg-Route, ohne erneuten Dialog.
- Endet die Mission (Abschluss/Abbruch), während ein Umweg aktiv ist, wird die Umweg-Route zur normalen
  privaten Direct-To-Route, damit der Pilot nicht ohne Route dasteht.

## Tracker / EFB

- Der Tracker lehnt `airport_direct_to` während eines Runs schon heute ab (`tracker-cockpit-tools.js`,
  `mission_authority_conflict`). Im EFB wird also nichts still verworfen.
- **Phase 1 (nur Web, kein Tracker-Release):** Dialog, sauberes Verwerfen und Umweg-Route in der Web-Karte.
  Bei Tracker-Autorität zeigen EFB und Sim-GPS weiter die Missionsroute, das Web-Band sagt das dazu.
- **Phase 2 (Tracker-Release, eigene Freigabe):** Umweg als eigenes Feld neben der Run-`navigationRoute`
  (`detourRoute`, eigene Revision, eigene Capability `navigation.detour.v1`). Damit kann das EFB denselben Dialog
  zeigen und Sim-GPS sowie Flugplan-Export auf den Umweg schalten. Das betrifft den Vertrag in
  `docs/Mission Runtime Authority Contract.md` und kommt dort als eigener Abschnitt hinein.

## Betroffene Dateien (Phase 1)

- `map.js`: Dialog-Einstieg in `toggleFreeflightMode`, `freeflightDirectTo`, `applyAirportDirectTo`,
  POI-Freiflug. Umweg-Rendering, Sperre der Missionsroute, `resetMainRoute`.
- `sync.js`: `confirmMissionAuthorityReplacement` → neue Variante mit Rückgabe `discard|keep|cancel` und
  Abbruch mit Warten. Anzeige-Leser auf `gaActiveNavigationRoute()`.
- neu `map-detour-route-core.js` + Test, `index.html` einbinden, i18n-Texte (de/en), `sw.js` Cache-Version.

## Umsetzung (abweichend vom Entwurf)

- Die Phasen wurden zusammengelegt: Tracker-Umweg (`navigation.detour.v1`, `navigation-detour-v1.json`) und
  EFB-Dialog sind gleich dabei.
- Am Missionsende wird der Umweg gelöscht und nicht zur normalen Route.
- Der Umweg ist voll editierbar, weil `routeWaypoints` die Route im Vordergrund bleibt und der bestehende Editor
  sie bearbeitet.
- Weitere Einstiege: Homebase-Besuch (Erhalten = Umweg). Die POI-Freiflugplanung bleibt unverändert.
- Tests: `ga-tracker-client/tracker-navigation-detour.test.js`. Im Browser geprüft: Dialog, Start per Positions-Knopf,
  Ziel per Suche, Umweg editieren, Route Reset, Verwerfen, Wiederherstellen und Missionsende.
- Nachbesserung Web v2556: Das Höhenprofil schaltet komplett um. Start- und Zielbeschriftung kommen vom Umweg
  (`gaDetourEndpointLabel`, auch in `getWpDisplayName`). Höhenpunkte, Teilstrecken-Höhen und Gelände der Mission
  werden beim Einstieg beiseitegelegt (`missionProfile` im Umweg-Zustand) und beim Zurückkehren wieder angelegt.
  Der Missionsstand speichert während des Umwegs das Missionsprofil. Die Hervorhebung von Lupe und Route Reset
  wird zusätzlich direkt am Element gesetzt (Skins).
- Offen: Feldtest im Sim (EFB-Dialog, Sim-GPS-Export des Umwegs).
