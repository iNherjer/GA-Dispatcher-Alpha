# Release-Warteschlange (Tracker, Desktop, EFB-Paket)

Fertige, getestete Aenderungen, die erst mit dem naechsten Build ausgeliefert
werden. Jeder Agent kann hier einreichen; wer den naechsten Build macht,
liefert alles Offene mit aus.

## Regeln

1. **Einreichen:** Aenderung fertig bauen und testen, nur die eigenen Dateien
   committen (nie `git add -A`), `sw.js` wie bei jedem Push erhoehen und nach
   `origin/main` pushen. Dann unten unter „Offen“ einen Eintrag anlegen
   (Vorlage am Ende). Version, Tag, EXE und `channel/*.json` bleiben
   unveraendert.
2. **Kein eigener Build fuer Wartendes:** Ein Eintrag in „Offen“ bedeutet:
   Code liegt auf `main`, aber in keinem veroeffentlichten Artefakt.
   Aenderungen an `ga-tracker-client/tracker.js` gehoeren nicht in die
   Warteschlange; sie folgen weiter `docs/github-push-workflow.md` Abschnitt 2
   (sofortiger EXE-Release).
3. **Freigabe:** Ein Build/Release passiert nur nach Freigabe durch den User
   (oder wenn er vorher ausdruecklich „gleich ausrollen“ gesagt hat).
4. **Ausliefern:** Wer den naechsten Build macht, liest vorher diese Datei,
   prueft, dass alle offenen Eintraege auf dem Build-Commit liegen, uebertraegt
   die „Doku beim Release“-Hinweise in die genannten Dokumente und verschiebt
   die Eintraege nach „Ausgeliefert“ mit Version und Datum.
5. **Zurueckziehen:** Ein Eintrag, der nicht mit soll, wird vor dem Build
   ausdruecklich zurueckgenommen (Revert-Commit) und hier gestrichen.

## Offen

(leer)

## Ausgeliefert

### 2026-11-24 · Wetterseite und Favoritenleiste im EFB – Tracker v662 Alpha

- **Artefakt:** Tracker-EXE mit gemeinsam genutzten EFB-Webassets.
- **Änderungen:** Routenwetter im Seitenmenü mit DWD, Open-Meteo, METAR und DWD-Stundenwahl. Der Menübutton sitzt mit den Favoriten in derselben Leiste.
- **Tests:** EFB-Webasset-Synchronisierung, Coherent-Syntax und Wettertransport. Browser-Selbsttest für Wetterseite und Favoritenleiste.
- **Im Feld prüfen:** Wetterdaten und Stundenwahl in Coherent, Menüleiste mit verschiedenen Skalierungen im EFB und Toolbar-Panel.
- **Details:** [Tracker v662](Tracker-v662-Release.md).

### 2026-11-24 · Satellit, GAFOR und METAR im EFB – Tracker v661 Alpha

- **Artefakte:** Tracker-EXE mit EFB-Assets 66101, Web-Cache v2521.
- **Änderungen:** Transparente Satelliten-Wolkenkacheln aus dem Tracker, GAFOR-Sektoren für Deutschland im VFR-Index und METAR als Kartenwetterquelle.
- **Im Feld prüfen:** Sichtbarkeit von „Nur Wolken“ und Infrarot, Wechsel zwischen Sektoren und Kacheln sowie METAR-Wetterfelder im MSFS-EFB.
- **Details:** [Tracker v661](Tracker-v661-Release.md).

### 2026-11-24 · Cloudflare-DWD-Wetter und Touch-Höhenlinie – Tracker v660 Alpha

- **Artefakte:** Tracker-EXE mit EFB-Assets 66001, Web-Cache v2520.
- **Änderungen:** DWD-Kartenwetter, Höhenband und Punktwetter aus Cloudflare-Kacheln ohne lokalen Python-Dienst. Kompaktes Punktwetter mit WMO-Symbol und Wolkenbasis. Höhenlinie und Höhenpunkte nach 500 ms Halten zum Ziehen freigeben.
- **Im Feld prüfen:** DWD-Betrieb ohne Python, Punktwetter, Höhenband und Höhenbearbeitung im MSFS-EFB.
- **Details:** [Tracker v660](Tracker-v660-Release.md).

### 2026-11-23 · Kartenwetter und Höhenband – Tracker v659 Alpha

- **Artefakte:** Tracker-EXE mit EFB-Assets 65901, Web-Cache v2510.
- **Änderung:** Wetter-Schnellschalter, Stundenwahl und SIG, DWD-Punktwetter mit Wolkenuntergrenzen, Favoritenstern als SVG.
- **Im Feld prüfen:** Coherent-Darstellung und FPS mit sichtbarem Wetterprofil, Kartenwetter und DWD-Wetterdienst.
- **Details:** [Tracker v659](Tracker-v659-Release.md).

### 2026-11-23 · Classic-Wolken im EFB ohne weiche Schatten – Tracker v658 Alpha

- **Artefakte:** Tracker-EXE mit EFB-Assets 65801, Web-Cache v2509.
- **Änderung:** Classic zeichnet seine Wolkenformen im EFB ohne weiche Canvas-Schatten pro Element.
- **Im Feld prüfen:** Im selben Simulator-Menü mit identischer Wetterlage Classic und Abstrakt bei sichtbaren Wolken vergleichen.
- **Details:** [Tracker v658](Tracker-v658-Release.md).

### 2026-11-23 · Routen-Höhenband und Vektorkarte – Tracker v657 Alpha und Desktop 1.6.43 Alpha

- **Artefakte:** Tracker-EXE (EFB-Assets 65701), Desktop-Installer mit Freigabe über den gemeinsamen Autoupdater und Web v2508.
- **Änderungen:** Statische Wolkenbasis bei normaler Profilrate. Das Desktop-Renderfenster schließt nach dem Wechsel der letzten Vektoransicht, sobald die laufenden Aufträge fertig sind.
- **Im Feld prüfen:** Simulator-FPS mit sichtbarer Wolkenbasis sowie Fensterschluss und RAM nach Kartenwechsel auf Windows.
- **Details:** [Tracker v657](Tracker-v657-Release.md), [Desktop 1.6.43](Tracker-Desktop-1.6.43-Release.md).

### 2026-11-22 · EFB: „VFR Vektor (OSM)“ über die Desktop-App — ausgeliefert in Tracker v656 Alpha + Desktop 1.6.42 (22.11.2026)
- **Artefakt:** Desktop-Installer **und** Tracker-EXE (Kachel-Proxy, HTTP-Server, EFB-Katalog/Host). Ohne neue Desktop-App bleibt der Eintrag im EFB unsichtbar; ohne neuen Tracker bleibt die Desktop-Neuerung ungenutzt.
- **Dateien:** `ga-tracker-client/desktop/lib/vector-tile-renderer.js`, `desktop/lib/vector-render/*` (render.html, render-page.js, per Sync: maplibre-gl.js, MAPLIBRE-LICENSE.txt, vfr-vector.json), `desktop/main.js`, `desktop/lib/tracker-process.js`, `desktop/scripts/sync-audio-player.js`, `desktop/tests/vector-tile-renderer.test.js`, `ga-tracker-client/tracker-efb-tile-proxy.js`, `tracker-efb-http-server.js`, `tracker-efb-kartentisch-host.js`, `efb-app/map-shell-core.js` (+ Tests).
- **Was:** Die Desktop-App zeichnet den Web-Stil „VFR Vektor (OSM)“ in einem unsichtbaren Offscreen-Fenster mit MapLibre/WebGL (eigene Session `vector-render`) in 4×4-Blöcken mit 256 px Rand und liefert 256-px-JPEG-Kacheln über einen Loopback-Server (Port/Token per Umgebung `VFR_MULTITOOL_MAP_RENDER_PORT/_TOKEN` an den Tracker, wie die Media-Bridge). Der Tracker holt sie als Kachelquelle `vfr-vector` (Zoom 3–16) mit Plattenspeicher; unvollständige Bilder (`no-store`) werden nicht gespeichert. `GET /api/v1/map-render/status` meldet `vfrVector`; das EFB listet „VFR Vektor (OSM, über Desktop-App)“ nur dann und fällt sonst auf Topo zurück. Fenster schließt nach 10 min ohne Abruf.
- **Tests:** `desktop/tests/*.test.js` (154), `tracker-efb-tile-proxy.test.js`, `efb-app/map-shell-core.test.js`, `efb-app/map-shell-source.test.js`, `tracker-efb-http-server.test.js`, `tracker-efb-asset-syntax.test.js`; Electron-Ende-zu-Ende am Mac (Renderer → Tracker-Server → EFB-Host, Menü mit/ohne Dienst, Nahtstellen geprüft; Block 0,2–1,9 s, Kachel ~25 KB).
- **Doku beim Release:** `docs/EFB-Development-Plan.md` (Abschnitt steht schon), Release-Notiz Tracker/Desktop.
- **Pruefen im Feld:** Windows-GPU/Offscreen-WebGL in der installierten Desktop-App, Darstellung und Ladezeit im EFB (2D/VR), RAM der Desktop-App.
- **Nachtrag 22.11.2026 · Farben lokal im EFB:** Abschnitt „VFR Vektor: Farben“ im EFB-Kartenmenü (aufklappbar, nur mit Desktop-Dienst): Orte/Wald/Gewässer/Autobahn/Bundesstraße/Bahn per Farbfeld aus kleiner Palette (kein Farbwähler in Coherent), Deckkraft Orte/Wald, Relief, Schriftgröße per −/+, „Standardfarben“. Gespeichert in den EFB-Einstellungen des Geräts (`vectorStyle`, `efb-app/map-shell-core.js` normalizeVectorStyle/encodeVectorStyle); als `?s=` an der Kachel-URL, Tracker validiert und legt je Farbsatz einen eigenen Cache-Ordner `vfr-vector~<satz>` an, Desktop wendet die Farben wie die Web-App an (`gaVectorApplyStyle`).

### 2026-11-20 · Hindernis-Cache gepackt (EFB-Kopie von profile.js) — ausgeliefert in Tracker v656 Alpha (22.11.2026)
- **Artefakt:** Tracker (EFB-Web-Assets)
- **Dateien:** `ga-tracker-client/efb-web-assets/profile.js` (Sync aus `profile.js`, Web v2481)
- **Was:** Hindernis-Pool und Routen-Cache gzip-gepackt (`gz1:<ts>:<base64>`), synchrone Aufrufer lesen aus dem Speicher. Ohne `CompressionStream` (vermutlich Coherent im EFB) bleibt es ungepackt wie bisher.
- **Tests:** `tracker-efb-asset-syntax.test.js`, `tracker-efb-web-client.test.js`.
- **Pruefen im Feld:** EFB-Karte zeigt Hindernisse/Fluesse wie vorher.

### 2026-11-20 · EFB: OSM-, OSM.de-, OSM-Swiss-, CyclOSM- und NASA-Karten — ausgeliefert in Tracker v655 Alpha (20.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Kartenkatalog, Host, Kachel-Proxy). Web live mit v2474.
- **Dateien:** `ga-tracker-client/efb-app/map-shell-core.js` (+ Test), `ga-tracker-client/tracker-efb-kartentisch-host.js`, `ga-tracker-client/tracker-efb-tile-proxy.js`, `ga-tracker-client/tracker-efb-tile-loading.test.js`; für den nächsten EFB-Paket-Build `efb-app/PackageSources/VfrMultitool/src/VfrMultitool.tsx` (überspringt `proxyOnly`).
- **Was:** Sechs neue globale Basiskarten; die vier OSM-Karten nur über den Tracker (App-Kennung mit Kontakt, Plattenspeicher), NASA bis Zoom 8 direkt mit Tracker-Rückfall.
- **Warum:** Kartenauswahl wie FSPM/OSM VFR Map, OSM-Regeln eingehalten.
- **Tests:** Tracker-Suite 1625/1627 (2 übersprungen), `efb-app/map-shell-core.test.js` (15), `tracker-efb-tile-loading.test.js` (6).
- **Freigabe:** erst nach dem Feldtest „Kartenspeicher“ (Kacheln über den Tracker in Coherent nicht schwarz), sonst sind die OSM-Karten im EFB leer.
- **Doku beim Release:** `docs/EFB-Development-Plan.md` Abschnitt 20.11.2026 um Version ergänzen.
- **Pruefen im Feld:** Jede neue Karte im EFB wählen; OSM-Karten nach Cache-Leeren neu laden; NASA ab Zoom 9 vergrößert.

### 2026-11-19 · EFB-/Toolbar-Paket 0.4.28: Flugplan aus Simulator holen — ausgeliefert als EFB 0.4.28 Alpha (20.11.2026)
- **Artefakt:** EFB-Paket (offizieller Windows-SDK-Bau, nicht auf dem Mac)
- **Dateien:** `ga-tracker-client/efb-app/flightplan-bridge-core.js`, `ga-tracker-client/efb-app/native-flightplan-bridge.js` und die identischen Toolbar-Kopien unter `toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/`; Version 0.4.28 in `PackageDefinitions/vfr-multitool-efb.xml`, `package.json`, `package-lock.json`.
- **Was:** Route aus EFB-Planung (`GET_EFB_ROUTE`), Flugsicherung (`GET_ATC_ROUTE`) und Avionik (`REQUEST_AVIONICS_ROUTE` + Ereignis, Rückfall `AvionicsRouteSync`) lesen und als Navigationsroute melden; Fixe über die Facility-Datenbank aufgelöst, Verfahren/Airways nur als Hinweis. Neue Nachricht `ga-flightplan-fetch`, Fähigkeit `fetch`.
- **Warum:** Rückweg zu „Flugplan senden“ (Anregung FSPM/OSM VFR Map).
- **Tests:** `efb-app/flightplan-bridge-core.test.js` (15), `efb-app/flightplan-native.test.js` (7), `tracker-efb-asset-syntax.test.js`.
- **Doku beim Release:** `docs/EFB-0.4.28-SDK-Handoff.md` mit Build-Hash ergänzen, `docs/EFB-Community-Package.md`.
- **Pruefen im Feld:** siehe Handoff (EFB und Toolbar, Avionik mit/ohne Antwort).

### 2026-11-19 · Korrekturen der Losroll-Warnung — ausgeliefert in Tracker v654 Alpha (19.11.2026)
- **Artefakt:** Tracker-EXE (Missions-Prozess). Web v2473 nur Cache.
- **Dateien:** `ga-tracker-client/tracker-mission-premature-taxi-core.js` (+ Test), `ga-tracker-client/tracker-mission-execution-runtime.js`.
- **Was:** Keine Warnung, wenn die Verladung bestätigt und der Passagier eingestiegen ist (nur die Begrüßung läuft), keine in `prepare` vor der Startszene; nach einem Neustart während des Rollens kommt die zweite Warnung erst nach einem Halt.
- **Warum:** Durchsicht der Logik nach v653.
- **Tests:** Tracker-Suite 1624/1626 (2 übersprungen, 0 Fehler).
- **Doku beim Release:** erledigt (Vertrag, Nachtrag 19.11.2026; `docs/Tracker-v654-Release.md`).
- **Pruefen im Feld:** Verladung bestätigen, während der Passagier noch spricht losrollen: keine Warnung, danach startet die Mission per Taxi-Auto-Start.

### 2026-11-19 · Warnung beim Losrollen vor dem Start — ausgeliefert in Tracker v653 Alpha (19.11.2026)
- **Artefakt:** Tracker-EXE (Missions-Prozess, Voice). Web v2472 (Banner, Pax-Fenster, englische Texte).
- **Dateien:** `ga-tracker-client/tracker-mission-premature-taxi-core.js` (neu, + Test), `ga-tracker-client/tracker-mission-execution-runtime.js` (+ Test), `ga-tracker-client/tracker-mission-execution-adapter.js`, `ga-tracker-client/tracker-mission-boarding-voice.js` (+ Test), `ga-tracker-client/tracker-voice-service.js`, `mission-execution-core.js` (+ Test), `mission-apt-ui-core.js` (+ Test), `passenger-voice.js`, `i18n/en-phrases.js` (+ EFB-Kopie).
- **Was:** In `prepare`/`boarding` ruft nach zwei Paketen Rollen (mindestens 2 kt, mindestens 3 m vom Standplatz) der Passagier oder, ohne Passagier am Abflugort, der Dispatcher per Funk zum Anhalten auf; nach einem Halt höchstens noch eine Bodenwarnung, beim Abheben eine Meldung zum Umkehren. Banner „Halt! Anhalten“ bzw. „Umkehren“, bis das Flugzeug wieder steht. Mission bleibt unverändert.
- **Warum:** Tester ist vor Abschluss der Verladung losgeflogen.
- **Tests:** Tracker-Suite 1623/1625 (2 übersprungen, 0 Fehler), Web-Testdateien einzeln grün; Details in `docs/Tracker-v653-Release.md`.
- **Doku beim Release:** erledigt (Vertrag Abschnitt 19.11.2026, Release-Notiz).
- **Pruefen im Feld:** siehe Release-Notiz, Abschnitt Feldtest.

### 2026-11-19 · Geteilter Crew-Auftrag bis 1 MiB — ausgeliefert in Tracker v652 Alpha (19.11.2026)
- **Was:** siehe `docs/Tracker-v652-Release.md` (Worker ga-proxy `757af9ba` vorab deployed, Web v2470).
- **Pruefen im Feld:** `CREW_PRESENCE_MISSION` statt `_SKIPPED`, „Selbst fliegen“ durch ein anderes Crew-Mitglied.

### 2026-11-19 · Desktop-App: Knopf „Karten-Cache leeren“ — ausgeliefert in Desktop 1.6.41 (19.11.2026)
- **Artefakt:** Desktop-App (nächste Version nach 1.6.40)
- **Dateien:** `ga-tracker-client/desktop/lib/map-tile-cache.js` (neu), `lib/tracker-process.js`, `main.js`, `preload.js`, `ui/index.html`, `ui/renderer.js`, `ui/i18n-en.js`, `tests/map-tile-cache.test.js`.
- **Was:** Knopf neben „Datenordner“, Rückfrage mit Größe und Kachelzahl; bei laufendem Tracker über dessen Endpunkt, sonst Ordner löschen.
- **Tests:** `cd ga-tracker-client/desktop && npm test` (152 bestanden, 3 übersprungen).
- **Doku beim Release:** `docs/EFB-Development-Plan.md` Abschnitt 19.11.2026 um Desktop-Version ergänzen.
- **Pruefen im Feld:** Knopf mit leerem und gefülltem Speicher, Tracker an und aus.

### 2026-11-19 · Passagierstimme in der Missionssprache — ausgeliefert in Tracker v650 Alpha (19.11.2026)
- **Was:** siehe `docs/Tracker-v650-Release.md`.
- **Doku beim Release:** `docs/Tracker-v650-Release.md`, `docs/English Translation Plan.md` 2.24.
- **Pruefen im Feld:** siehe `docs/Tracker-v650-Release.md`.

### 2026-11-19 · Rückblick-Vorprüfung, SAR/Brand ohne Abschieds-Vorbereitung, Abkürzungen — ausgeliefert in Tracker v649 Alpha (19.11.2026)
- **Was:** siehe `docs/Tracker-v649-Release.md`.
- **Doku beim Release:** `docs/Tracker-v649-Release.md`, `docs/Mission Runtime Authority Contract.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v649-Release.md`.

### 2026-11-19 · Infrastruktur-Ergebnis: Zielkategorie vor Text, englische Wörter — ausgeliefert in Tracker v649 Alpha (19.11.2026)
- **Artefakt:** Tracker-EXE (`tracker-mission-followup.js` lädt `mission-infra-outcome-core.js`)
- **Dateien:** `mission-infra-outcome-core.js`
- **Was:** Eindeutige Zielkategorie entscheidet die Zielfamilie, der Missionstext nur noch bei „allgemein“; englische Wörter in den Mustern (Phase 4 der Übersetzung).
- **Warum:** `docs/English Translation Plan.md` 2.15. Web ist schon live.
- **Tests:** `tools/mission-infra-briefing.test.mjs`, Tracker-Folge-/Bush-/POI-Ketten-Tests grün.
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** Infrastruktur-Folgeauftrag nach einer Inspektion (Ergebnis passt zur Zielart).

### 2026-11-18 · EFB-Trainingsbanner auf Englisch — ausgeliefert in Tracker v649 Alpha (19.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Kopie von `mission-training-guidance-ui.js`, `mission-control-ui-core.js`, EFB-Kopie von `i18n/en-phrases.js`)
- **Dateien:** `mission-training-guidance-ui.js`, `ga-tracker-client/efb-web-assets/mission-training-guidance-ui.js`, `ga-tracker-client/mission-control-ui-core.js`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js` (+ Test `mission-training-guidance-ui.test.js`)
- **Was:** Trainingsbanner (Titel/Phase, Zeilen mit Sollwerten, Details, Hinweise, Knöpfe, Rückfragen, Verlauf-Knopf) bei englischer Oberfläche englisch; Übersetzung des gezeichneten Banners (`translateDom`) mit Trainingsmustern.
- **Warum:** Phase 3 der englischen Übersetzung, letzter Schritt (`docs/English Translation Plan.md` 2.14). Web ist schon live (v2452).
- **Tests:** alle `tracker-mission-training*`-Tests, Kern-/EFB-Tests grün; 121 echte Bannerzeilen (Kurve, Höhenwechsel, Stall) vollständig englisch; Banner in der echten EFB-Seite (Electron) inkl. Neuzeichnen und Zurückschalten geprüft.
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** EFB auf Englisch: Trainingsmission (Freischalten, Übung starten, Kurve/Höhenwechsel/Stall), Sprachwechsel bei offenem Banner.

### 2026-11-18 · EFB-Passagierfenster: Titel auf Englisch — ausgeliefert in Tracker v648 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Host und EFB-Kopie von `i18n/en-phrases.js`)
- **Dateien:** `ga-tracker-client/tracker-efb-kartentisch-host.js`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js`
- **Was:** Passagierfenster im EFB zeigt Titel, Platzhalter „Passagier“ und „Noch keine Nachricht.“ bei englischer Oberfläche englisch (nur Anzeige, `_hT`).
- **Warum:** Phase 3 der englischen Übersetzung, Schritt 1 (`docs/English Translation Plan.md` 2.10). Web war schon live (v2447).
- **Tests:** `tracker-efb-poi-actions`, `efb-web-assets-sync`, `tracker-efb-asset-syntax`, alle Tests mit `tracker-efb-kartentisch-host` grün.
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** EFB auf Englisch: Passagierfenster vor der ersten Nachricht „Passenger“ / „No message yet.“

### 2026-11-18 · EFB-Missionskarte auf Englisch — ausgeliefert in Tracker v648 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (EFB lädt `ga-tracker-client/mission-control-ui-core.js` und die EFB-Kopie von `i18n/en-phrases.js`)
- **Dateien:** `ga-tracker-client/mission-control-ui-core.js`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js`
- **Was:** Missionskarte, Bedienknöpfe, Unterbrechungshinweise, Aktionsmeldungen, Bordbuch-Erinnerung und Abbruch-Rückfrage erscheinen bei englischer Oberfläche englisch. Übersetzt wird nur beim Zeichnen (`displayText`); die Tracker-Ansicht bleibt deutsch.
- **Warum:** Phase 3 der englischen Übersetzung (`docs/English Translation Plan.md` 2.11). Web war schon live (v2448).
- **Tests:** `mission-control-ui-core`, `tracker-efb-web-client`, `efb-web-assets-sync`, `tracker-efb-asset-syntax`, `tools/efb-interruption-host`, `tools/tracker-sim-interruption-web` grün; deutsche Ausgabe zeichengleich zum Vorstand geprüft.
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** EFB auf Englisch: Missionskarte (Abschnittstitel, aktueller Auftrag, Fortschritt), Mission abbrechen (Rückfrage), Unterbrechung nach Sim-Neustart.

### 2026-11-18 · EFB-Verlade-Manager und Missionsbanner auf Englisch — ausgeliefert in Tracker v648 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Host, `mission-control-ui-core.js`, EFB-Kopie von `i18n/en-phrases.js`)
- **Dateien:** `ga-tracker-client/tracker-efb-kartentisch-host.js`, `ga-tracker-client/mission-control-ui-core.js`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js` (+ Tests `mission-transport-size`, `tracker-flightplan-host`)
- **Was:** Verlade-Manager (Frachtgutliste, Unterschrift, Knöpfe, Hinweise, Zuladung), Missionsbanner mit Flugplan-/Unterbrechungsknöpfen und Entlade-Rückfrage erscheinen bei englischer Oberfläche englisch. Übersetzt wird das fertig gezeichnete Fenster (`translateDom`), deutsche Quelle bleibt erhalten; Sprachwechsel zeichnet neu.
- **Warum:** Phase 3 der englischen Übersetzung (`docs/English Translation Plan.md` 2.12). Web war schon live (v2449).
- **Tests:** alle Host-/Kern-Tests grün, Browser-Test mit nachgebautem Fenster (Englisch vollständig, Zurückschalten stellt Deutsch exakt her).
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** EFB auf Englisch: Verlade-Manager beim Boarding und Entladen, Missionsbanner (Start, Taxi-Countdown, Ankunft), Sprachwechsel bei offenem Fenster.

### 2026-11-18 · EFB-Missionskarte: POI-Statuszeilen auf Englisch — ausgeliefert in Tracker v648 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (`mission-control-ui-core.js`, EFB-Kopie von `i18n/en-phrases.js`)
- **Dateien:** `ga-tracker-client/mission-control-ui-core.js`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js`
- **Was:** „Aktueller Auftrag“ und Detailzeile bei POI-, SAR-, Survey-, Ketten- und Trainingsmissionen (`control.poiStatus`) erscheinen englisch.
- **Warum:** Phase 3 der englischen Übersetzung (`docs/English Translation Plan.md` 2.13). Web war schon live (v2450).
- **Tests:** Kern-/Host-Tests grün, deutsche Ausgabe zeichengleich.
- **Doku beim Release:** keine weitere.
- **Pruefen im Feld:** EFB auf Englisch: POI-Mission (Arbeitszeit, Nächster Schritt), SAR-Heli.

### 2026-11-18 · Tolerante Rückblick-Prüfung, Folgemission immer baubar — ausgeliefert in Tracker v647 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (gemeinsame Prüfung im Hintergrund-Schreiber), Web v2446.
- **Dateien:** `mission-charter-continuation-core.js`, `mission-charter-browser.js`, `mission-apt-news-browser.js`, `mission-followup.js`, `ga-tracker-client/tracker-mission-charter-recap.js` (+ Tests).
- **Was:** siehe `docs/Tracker-v647-Release.md`.
- **Doku beim Release:** `docs/Tracker-v647-Release.md`, `docs/Mission Runtime Authority Contract.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v647-Release.md`.

### 2026-11-18 · Vorläufige Rückblick-Entwürfe sofort aufräumen — ausgeliefert in Tracker v646 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (`ga-tracker-client/mission-authority-core.js`).
- **Dateien:** `ga-tracker-client/mission-authority-core.js`, `ga-tracker-client/tracker-mission-charter-recap.test.js`.
- **Was:** Ein beim Aufsetzen angelegter vorläufiger Rückblick-Auftrag wird bei Abschluss ohne Angebot und bei Abbruch sofort aus `followupRecapQueue` entfernt (bisher bis zu 2 Tage in der Zustandsdatei).
- **Doku beim Release:** `docs/Mission Runtime Authority Contract.md` (Abschnitt Rückflug-Rückblick: „Ohne Angebot verfällt er nach 2 Tagen“ → „wird beim Abschluss ohne Angebot und beim Abbruch sofort entfernt“).
- **Pruefen im Feld:** Mission nach dem Aufsetzen abbrechen: kein `MISSION_FOLLOWUP_RECAP_WRITTEN` danach.

### 2026-11-18 · Abschied beim Aufsetzen, Rückblick ab dem Aufsetzen — ausgeliefert in Tracker v645 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (Missionsprozess-Verdrahtung, Abschieds-Vorbereitung, Rückblick), Web v2442.
- **Dateien:** `ga-tracker-client/tracker.js`, `tracker-mission-worker.js`, `tracker-mission-process.js`, `tracker-mission-farewell-voice.js` (+ Test), `tracker-mission-farewell-prewarm-wiring.test.js`, `mission-authority-core.js`, `tracker-mission-followup.js`, `tracker-mission-charter-recap.js` (+ Test).
- **Was:** siehe `docs/Tracker-v645-Release.md`.
- **Doku beim Release:** `docs/Tracker-v645-Release.md`, `docs/Mission Runtime Authority Contract.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v645-Release.md`.

### 2026-11-18 · Rückflug-Rückblick nach der Landung — ausgeliefert in Tracker v644 Alpha (18.11.2026)
- **Artefakt:** Tracker-EXE (Folgeauftrag-Rückblick im Hintergrund), Web v2441.
- **Dateien:** `ga-tracker-client/tracker.js`, `ga-tracker-client/mission-authority-core.js`, `ga-tracker-client/tracker-mission-followup.js`, `ga-tracker-client/tracker-mission-charter-recap.js` (+ Test), `mission-charter-continuation-core.js`, `mission-followup.js` (+ `tools/mission-followup-ui.test.mjs`).
- **Was:** siehe `docs/Tracker-v644-Release.md`.
- **Doku beim Release:** `docs/Tracker-v644-Release.md`, `docs/Mission Runtime Authority Contract.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v644-Release.md`.

### 2026-11-17 · PIN-Pflicht für Relay-Befehle, EFB-Server-Herkunft, Crew-Beitritt — ausgeliefert in Tracker v643 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (Relay-Befehle, lokaler EFB-Server). Worker `ga-proxy` 08e22ae3 deployt, Web v2438.
- **Dateien:** `ga-tracker-client/tracker.js`, `ga-tracker-client/tracker-relay-routing-core.js` (+ Test), `ga-tracker-client/tracker-efb-http-server.js` (+ Test), `board.js`, `sync.js`, `i18n/en.js`, `i18n/en-phrases.js`, `tools/cloudflare-worker/worker-merged-full.js` (+ Test).
- **Was:** siehe `docs/Tracker-v643-Release.md`.
- **Doku beim Release:** `docs/Tracker-v643-Release.md`, `tools/cloudflare-worker/README.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v643-Release.md`.

### 2026-11-17 · Relay-PIN-Grund und Knöpfe nach Tracker-Neustart — ausgeliefert in Tracker v642 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (Relay-Verbindung, Cockpit-Sitzungsclient für EFB/Toolbar/Web). Relay `ga-relay` c39be7aa deployt, Web v2437.
- **Dateien:** `ga-tracker-client/tracker.js`, `ga-tracker-client/tracker-cockpit-session-client.js` (+ Test), `tools/cloudflare-relay/relay-worker.js` (+ Test, `wrangler.toml`, README).
- **Was:** Relay prüft PIN beim Beitritt gegen das Konto; Tracker nennt den Ablehnungsgrund; EFB/Toolbar melden sich nach 401 neu an und senden den Befehl einmal nach.
- **Doku beim Release:** `docs/Tracker-v642-Release.md`, `tools/cloudflare-relay/README.md`.
- **Pruefen im Feld:** siehe `docs/Tracker-v642-Release.md`.

### 2026-11-17 · Missionsstart beim Losrollen (Taxi-Auto-Start) — ausgeliefert in Tracker v641 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (Missions-Prozess). Web zeigt den Countdown über den gemeinsamen UI-Kern, sobald der Tracker ihn liefert.
- **Dateien:** `ga-tracker-client/tracker-mission-start-readiness.js` (+ Test), `ga-tracker-client/tracker-mission-execution-runtime.js` (+ Test), `ga-tracker-client/tracker-mission-execution-adapter.js`, `mission-apt-ui-core.js` (+ Test).
- **Was:** Nur der letzte Start (Phase `boarded`: Manifest unterschrieben, Verladung bestätigt). Rollt der Pilot dort am Boden mit mindestens 1 kt drei Readiness-Pakete am Stück (3 s), startet der Tracker die Mission selbst (`start_mission`, `controllerSession.role=tracker`, Kommando `taxi-autostart:<run>:<zeit>`). Der Banner bleibt sichtbar: „Taxi gestartet, Mission beginnt automatisch in“, Knopf zählt „3 Sek.“, „2 Sek.“, „1 Sek.“ (deaktiviert). Danach 3 s „Mission gestartet. Guten Flug!“. Anhalten, Pause, Menü, Slew oder Abheben setzen den Countdown zurück, beim nächsten Losrollen beginnt er wieder bei 3. Entfällt nur die Stillstand-Pflicht der Startfreigabe (auch die Bush-Grenze 2 kt) und nur für diesen tracker-internen Start; Sim-, Cockpit-, Positions- und Bodenprüfung bleiben. Status reist als `startReadiness.taxiAutoStart` mit. Log: `MISSION_TAXI_AUTOSTART status=counting|idle|starting|started|failed`. Abschaltbar per Laufzeit-Option `taxiAutoStart:false`.
- **Warum:** Tester vergessen nach der Verladung den zweiten Startknopf; nach dem Losrollen war er wegen der Stillstand-Pflicht nicht mehr erreichbar.
- **Tests:** `tracker-mission-start-readiness.test.js` (31), `tracker-mission-execution-runtime.test.js` (56, neu: Taxi-Start Ende-zu-Ende), `tracker-mission-execution-adapter.test.js`, `mission-apt-ui-core.test.js` (18), `tracker-efb-mission-view-core.test.js`, `tracker-mission-process.test.js`; alle Testdateien einzeln grün (`tracker-mission-sar-integration.test.js` ist nur unter Parallellast flackernd, auch ohne diese Änderung).
- **Doku beim Release:** erledigt, `docs/Mission Runtime Authority Contract.md` Abschnitt 17.11.2026; `docs/Tracker-v641-Release.md`.
- **Pruefen im Feld:** Nach „Verladung bestätigen“ losrollen: Countdown 3-2-1 im EFB und im Web, Mission startet, 3 s Hinweis. Kurz anrollen und wieder stehen: Countdown verschwindet, normaler Knopf kommt zurück. Bush-Mission ebenso.

### 2026-11-17 · EFB-Kartenmenü: Esri Topo, regionale Basiskarten, Abblendstufen — ausgeliefert in Tracker v640 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Host, Kachel-Proxy, EFB-Web-Assets). Web live mit v2433.
- **Dateien:** `ga-tracker-client/efb-app/map-shell-core.js` (+ Test), `ga-tracker-client/tracker-efb-kartentisch-host.js`, `ga-tracker-client/tracker-efb-tile-proxy.js`, `ga-tracker-client/efb-web-assets/styles.css`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js`.
- **Was:** Globale Basiskarte „Esri Topo (Welt)“ zusätzlich; regionale Basiskarten basemap.de (DE) und swisstopo (CH) als kombinierbare Einträge über der globalen Karte und unter allen Overlays, basemap.de liegt immer über swisstopo; Auswahl und Reihenfolge in den EFB-Einstellungen gespeichert. Abblenden beim VFR-Overlay gilt jetzt für die ganze Basiskarten-Ebene (`gaBasePane`-Opacity statt Opacity je Kachel-Layer), Stärke 0–90 % per −/+ in 10er-Stufen (kein Range-Regler wegen Coherent/VR), Standard 50 % wie bisher. Menü mit Gruppenüberschriften (Klasse `ga-layer-groups` statt `:has()`). Proxy kennt die drei neuen Quellen als letzte Ausweichstufe. OSM/CyclOSM bewusst nicht im EFB (OSM-Kachelregeln verlangen Referrer bzw. App-Kennung, Coherent-Direktabruf erfüllt das nicht). Ersetzt beim Ausliefern den Feld-Hinweis des Eintrags „EFB-Kopien fuer das Web-Kartenmenue“.
- **Warum:** OpenTopoMap/Top-O-Map blendet im EFB Werbebanner ein; Alternativen ohne Schlüssel.
- **Tests:** `efb-app/map-shell-core.test.js` (13), `efb-app/map-shell-source.test.js`, `tracker-efb-web-client.test.js`, `tracker-efb-http-server.test.js`, `tracker-efb-asset-syntax.test.js`, `efb-web-assets-sync.test.js`, `tracker-efb-tile-proxy.test.js`, `tracker-efb-tile-loading.test.js`; EFB-Seite lokal im Browser (Gruppen, Stapelung nach Neuladen, Speichern, Abblendstufen).
- **Doku beim Release:** `docs/EFB-Development-Plan.md` Abschnitt „17.11.2026 – EFB-Kartenmenü“ um Version ergänzen.
- **Pruefen im Feld:** In MSFS/Coherent: Basiskarte bei VFR-Overlay abgeblendet, nicht schwarz (neu: Opacity auf der Ebene statt je Layer); basemap.de und swisstopo laden direkt; DE+CH an der Grenze Schaffhausen; −/+ in VR bedienbar.

### 2026-11-16 · EFB-Kopien fuer das Web-Kartenmenue — ausgeliefert in Tracker v640 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets). Web live mit v2432.
- **Dateien:** `ga-tracker-client/efb-web-assets/styles.css`, `ga-tracker-client/efb-web-assets/i18n/en-phrases.js` (generiert per `sync-efb-web-assets.js`).
- **Was:** Synchronisiert die gemeinsamen Styles und englischen Texte für die Kartenmenüs. Der Abblendregler und die Stapelung der regionalen Basiskarten gehören zur Web-App.
- **Tests:** `efb-web-assets-sync.test.js`, `tracker-efb-asset-syntax.test.js`.
- **Doku beim Release:** keine.
- **Pruefen im Feld:** keine neue EFB-Funktion.

### 2026-11-16 · EFB-Kopie profile.js: Diagnosezeile „APT Platzdaten“ — ausgeliefert in Tracker v640 Alpha (17.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets); Web live mit v2422
- **Dateien:** `ga-tracker-client/efb-web-assets/profile.js` (Kopie per `sync-efb-web-assets.js`)
- **Was:** Diagnosezeile zur Herkunft der Platzdaten (Cloud-Vorrat/OSM, Alter, Upload, Erneuerung). Im EFB ohne Wirkung; nur Gleichstand der Kopie.
- **Tests:** `efb-web-assets-sync.test.js`, `tracker-efb-asset-syntax.test.js`.
- **Doku beim Release:** keine.
- **Pruefen im Feld:** nichts.

### 2026-11-15 · EFB-Kopie profile.js: Diagnosezeile „APT Empfangsszene“ nennt die OSM-Abruffehler — ausgeliefert in Tracker v639 Alpha (16.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets); Web live mit v2405
- **Dateien:** `ga-tracker-client/efb-web-assets/profile.js` (Kopie per `sync-efb-web-assets.js`)
- **Was:** Die Zeile bekommt `abruf=` (Server und Fehler je Versuch) bzw. `osm-map=<Radius> m`. Im EFB ohne Wirkung; nur Gleichstand der Kopie.
- **Tests:** `efb-web-assets-sync.test.js`, `tracker-efb-asset-syntax.test.js`.
- **Doku beim Release:** keine.
- **Pruefen im Feld:** nichts.

### 2026-11-15 · Boarding-Punkte nach dem Szenenaufbau verschieben — ausgeliefert in Tracker v638 Alpha / Web v2404 (15.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `ga-tracker-client/tracker-mission-boarding-layout-core.js` (neu), `mission-authority-core.js`, `tracker-mission-execution-runtime.js`, `tracker.js`, `sync.js`, `app.js`, `i18n/en-phrases.js`
- **Was:** Unter Tracker-Authority gehen Boarding-Editor, „Szene neu setzen“ und Marker-Schalter als `update_boarding_layout` an den Tracker; der baut die Startszene bis zum Boarding-Start neu auf und setzt die Pylonen selbst.
- **Tests:** `tracker-mission-boarding-layout.test.js`; Tracker-Suite 1574/1576.
- **Doku beim Release:** `docs/Mission Runtime Authority Contract.md` 7.1, `docs/Tracker-v638-Release.md`.
- **Pruefen im Feld:** Nach Szenenaufbau Cargo-Punkt verschieben, „Szene neu setzen“, Marker an/aus, danach Boarding; Log `MISSION_BOARDING_LAYOUT`.

### 2026-11-15 · EFB-Kopie profile.js: Diagnose-Abschnitt Boden-Composer — ausgeliefert in Tracker v638 Alpha (15.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets); Web live mit v2400
- **Dateien:** `ga-tracker-client/efb-web-assets/profile.js` (Kopie per `sync-efb-web-assets.js`)
- **Was:** Diagnosebericht bekommt den Abschnitt „Boden-Composer“ (Plan-Quelle, je Szene Fahrzeug/Plätze/Besetzungsquelle, Personen aus Idee und Composer, gewählte Figuren und Fahrzeugmodell, tatsächliche Zielszene mit „steigt-ein“). Im EFB ohne Wirkung; nur Gleichstand der Kopie.
- **Tests:** `efb-web-assets-sync.test.js`, `tracker-efb-asset-syntax.test.js`.
- **Doku beim Release:** keine.
- **Pruefen im Feld:** nichts.

### 2026-11-14 · Schwellen-Meldungen Übelkeit (<50/<30 %) und Ladungsschaden (≤50/≤35 %) — ausgeliefert in Tracker v637 Alpha / Web v2400 (14.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `ga-tracker-client/tracker-mission-distress-voice-core.js` (neu), `tracker-mission-execution-runtime.js`, `tracker-mission-execution-adapter.js`, `tracker-mission-boarding-voice.js`, `tracker-voice-service.js`, `mission-authority-core.js`, `tracker-efb-mission-view-core.js`, `mission-boarding-voice-core.js`, `passenger-voice.js`
- **Was:** Einmalige Pax-Meldungen bei Komfort unter 50 % / 30 % (hörbar elend per TTS-Stil) und Ladungsmeldungen bei ≤ 50 % / ≤ 35 % (Pflichtladung = Auftragsproblem); EFB-Zeile auch ohne Pax.
- **Tests:** `tracker-mission-distress-voice-core.test.js`, Ende-zu-Ende in `tracker-mission-execution-runtime.test.js`, TTS-Stil in `tracker-voice-service.test.js`; Tracker-Suite 1567/1569.
- **Doku beim Release:** `docs/Mission Runtime Authority Contract.md` (14.11.2026), `docs/Tracker-v637-Release.md`.
- **Pruefen im Feld:** Mit harten Manövern fliegen: Übelkeit, Spucktüte, Ladungsmeldungen; Log `MISSION_DISTRESS_VOICE`.

### 2026-11-14 · Composer-Diagnose zeigt Fahrzeug und Bringer/Empfänger je Szene — ausgeliefert in Tracker v636 Alpha / Web v2399 (14.11.2026)
- **Artefakt:** Tracker-EXE; Web live mit v2392
- **Dateien:** `ga-tracker-client/tracker-ground-composer-log.js`
- **Was:** Die Zeile `GROUND_COMPOSER` bekommt `scenes=start:<Fahrzeug>(composer|capacity)/<Personen>;arrival:…` (Etappe E). Nur Diagnose, keine Wirkung auf den Ablauf.
- **Tests:** `tracker-ground-composer-log.test.js` 3/3.
- **Doku beim Release:** keine (Fahrplan, Etappe E).
- **Pruefen im Feld:** Log einer Mission mit Bringer/Empfänger enthält `scenes=`.

### 2026-11-14 · Charter-Fortsetzung spiegelt die Bodenbesetzung (mitgepackter Kern) — ausgeliefert in Tracker v636 Alpha (14.11.2026)
- **Artefakt:** Tracker-EXE bündelt `mission-charter-continuation-core.js` per require; Web live mit v2396
- **Dateien:** `mission-charter-continuation-core.js`
- **Was:** `mirrorGround` tauscht bei Rückreisen `groundCast` und `groundVisual.scenes` (Start ↔ Ziel). Im Tracker ohne Wirkung (er nutzt nur `voiceLeg` und `request`); nur Gleichstand der Kopie.
- **Tests:** `tools/mission-charter-continuation.test.cjs` 13/13, `tracker-mission-followup.test.js` grün.
- **Doku beim Release:** keine (Fahrplan, Etappe E).
- **Pruefen im Feld:** Charter hin und zurück: der Empfänger vom Hinflug bringt beim Rückflug.

### 2026-11-14 · Privat-Rückflug spiegelt die Bodenbesetzung (mitgepackter Kern) — ausgeliefert in Tracker v636 Alpha (14.11.2026)
- **Artefakt:** Tracker-EXE bündelt `mission-private-return-core.js`; Web live mit v2397
- **Dateien:** `mission-private-return-core.js`
- **Was:** `privateReturn.outing` trägt `groundCast` und `groundVisual.scenes` mit getauschtem Start/Ziel. Vom Tracker gebaute Rückflug-Anträge spiegeln erst ab diesem Build; bis dahin steht die Besetzung beim Rückflug seitenverkehrt (nur Optik).
- **Tests:** `tools/mission-private-return.test.cjs` 18/18, `tracker-mission-followup.test.js` grün.
- **Doku beim Release:** keine (Fahrplan, Etappe E).
- **Pruefen im Feld:** Privatflug hin und zurück: wer am Ziel abgeholt hat, bringt beim Rückflug.

### 2026-11-14 · Geschlossene Mission räumt ihre Szenen ab, Composer-Diagnose im Log — ausgeliefert in Tracker v635 Alpha / Web v2391 (14.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `ga-tracker-client/tracker.js`, `ga-tracker-client/tracker-ground-composer-log.js`, `mission-ground-visual-core.js`, `mission-ground-composer-browser.js`, `app.js`, `sync.js`
- **Was:** Löscht die Cloud eine schon geschlossene Mission (Debriefing), räumt der Tracker vorher deren Szenen ab (ausgeladene Fracht und Gepäck blieben stehen, Feldtest 13.11.). Neue Log-Zeilen `GROUND_COMPOSER` / `GROUND_COMPOSER_MANIFEST` beim Laden der Mission: Status (ai/fallback/übersprungen mit Grund), Quelle, Looks, Packstücke, Fehler, und was die Ladeliste tatsächlich nutzt.
- **Tests:** `tracker-closed-mission-scene-cleanup.test.js` 2/2, `tracker-ground-composer-log.test.js` 2/2, Tracker-Suite 1563/1565 (2 übersprungen).
- **Doku beim Release:** `docs/Tracker-v635-Release.md`.
- **Pruefen im Feld:** Mission mit Fracht bis zum Debriefing fliegen und schließen: nichts bleibt am Ziel liegen; Log enthält `GROUND_COMPOSER`.

### 2026-11-13 · Privat-Rückflug übernimmt die Composer-Wahl (mitgepackter Kern) — ausgeliefert in Tracker v635 Alpha (14.11.2026)
- **Artefakt:** Tracker-EXE (bündelt `mission-private-return-core.js` und `mission-cargo-visual-core.js` per require); Web live mit v2381
- **Dateien:** `mission-private-return-core.js`, `mission-cargo-visual-core.js`
- **Was:** `privateReturn.outing` trägt `groundVisual`/`cargoVisual` des Hinflugs, damit die Begleitung beim Rückflug gleich aussieht; der Rückblick-Prompt lässt beides weg. `postFromIdea` kennt den Privatflug. Seit v2382 kennt `postFromIdea`/`ideaOf` auch die allgemeine Composer-Quelle `groundComposer` (im Tracker ohne Wirkung, er nutzt nur `pieceObjectKeys`/`expandSceneItem`). Seit v2383 ebenso die Vereinsidee `clubIdea` (gleiche Einschränkung); seit v2384 kennt `mission-onboard-core.js` die Medizin-Idee (Tracker bündelt die Datei nicht). Seit v2386 kennt `postFromIdea`/`ideaOf` Fracht und zerbrechliche Fracht, und `validate` kappt mehr als drei Packstücke statt die Wahl zu verwerfen (im Tracker ungenutzt).
- **Tests:** `tools/mission-private-return.test.cjs` 17/17, `tools/mission-cargo-visual.test.mjs` 16/16.
- **Doku beim Release:** keine (steht im Fahrplan, Etappe C).
- **Pruefen im Feld:** Privatflug hin und zurück mit Schalter: gleiche Figur.

### 2026-11-14 · EFB-Kopien i18n/en.js und profile.js: Figuren-Schalter entfernt — ausgeliefert in Tracker v635 Alpha (14.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets); Web live mit v2388
- **Dateien:** `ga-tracker-client/efb-web-assets/i18n/en.js`, `ga-tracker-client/efb-web-assets/profile.js` (Kopien per `sync-efb-web-assets.js`)
- **Was:** Schlüssel `settings.boarding.figures`/`figuresHint` entfernt, Diagnosezeile „PAX-Figuren“ wertet den Schalter als „an, außer `off`“. Die Kopie von `profile.js` übernimmt dabei auch die Crew-Live-Diagnose aus Web v2387 (2988d7860), die noch nicht synchronisiert war. Im EFB ohne Wirkung; nur Gleichstand der Kopien.
- **Tests:** `efb-web-assets-sync.test.js`, Tracker-Suite 1559/1561 (2 übersprungen).
- **Doku beim Release:** keine.
- **Pruefen im Feld:** nichts.

### 2026-11-14 · Folgemissionen behalten die Figur der Hauptperson (mitgepackter Kern) — ausgeliefert in Tracker v635 Alpha / Web v2391 (14.11.2026)
- **Artefakt:** Tracker-EXE (bündelt `mission-followup.js` per require für Folgeanfragen nach Missionsende); Web live mit v2390
- **Dateien:** `mission-followup.js`
- **Was:** Neue Folgeanfragen tragen `groundCarry` (Look, Alter, Losschlüssel der Hauptperson aus `md.groundComposer`). Bis zum Build legt der Tracker Anfragen ohne das Feld an; die Folgemission wählt dann wie bisher neu.
- **Tests:** `tools/bush-followup-narrative.test.cjs` 7/7, `tools/mission-ground-composer-browser.test.cjs` 6/6, Tracker-Suite 1559/1561 (2 übersprungen).
- **Doku beim Release:** keine (Fahrplan „Rückflüge und Fortsetzungen“).
- **Pruefen im Feld:** Bush-Charter-Gast hinfliegen, Abholung als Folgemission: gleiche Figur.

### 2026-11-13 · Empfang am Zielplatz: Fahrzeugregel v2, Aufräumen, EFB-Abholpunkt — ausgeliefert in Tracker v634 Alpha / Web v2380 (13.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `ga-tracker-client/tracker.js`, `tracker-mission-simulator-effects.js`, `mission-scene-group-core.js`, `tracker-efb-map-snapshot-core.js`, `tracker-efb-kartentisch-host.js`, `sync.js`
- **Was:** 2 Pax Pkw, 3–5 Van, große Fracht Van; nicht übernommene Empfangsszene wird abgeräumt; Abholpunkt im EFB.
- **Tests:** siehe `docs/Tracker-v634-Release.md`.
- **Doku beim Release:** `docs/Mission Ground Composer Fahrplan.md` „Empfang am Zielplatz“.
- **Pruefen im Feld:** 2 Pax → Pkw, 3 Pax → Van, 1 Pax mit 150 lbs → Van; nichts bleibt stehen; Punkt im EFB.

### 2026-11-13 · Bush-Briefing-Rezepte Adventure, Supply, Cargo-Pickup, Recon (mitgepackter Kern) — ausgeliefert in Tracker v634 Alpha (13.11.2026)
- **Artefakt:** Tracker-EXE (bündelt `mission-bush-narrative-core.js` per require); Web bereits live mit v2367–v2371
- **Dateien:** `mission-bush-narrative-core.js` (Commits seit v633: 59fe5d963, 9ce6ddcd5, 7cd8eb541 und der Recon-Commit); Web-seitig zusätzlich `app.js`
- **Was:** Eigene Writer-Rezepte und Planner-Zusätze für vier Bush-Stränge. Im Tracker ohne Wirkung, weil Runtime und Voice nur die unveränderten Teile nutzen (Gleichstand der Datei).
- **Tests:** `tracker-mission-bush-narrative.test.js` 3/3, `tracker-mission-boarding-voice.test.js` 29/29, `tools/bush-recon-information.test.cjs` 8/8.
- **Doku beim Release:** keine (steht in `docs/Bush Narrative Voices.md`).
- **Pruefen im Feld:** nichts im Tracker; Briefings im Web-Realbetrieb beobachten (Wiederholungen, künstlicher Druck).

### 2026-11-12 · EFB-Kopien i18n/en.js und profile.js: Figuren-Testschalter und Diagnosezeile — ausgeliefert in Tracker v634 Alpha (13.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Web-Assets)
- **Dateien:** `ga-tracker-client/efb-web-assets/i18n/en.js`, `ga-tracker-client/efb-web-assets/profile.js` (Kopien per `sync-efb-web-assets.js`)
- **Was:** Neue Schlüssel `settings.boarding.figures` / `figuresHint` und Diagnosezeile „PAX-Figuren“ aus der Web-App. Im EFB ohne Wirkung; nur Gleichstand der Kopien.
- **Tests:** `efb-web-assets-sync.test.js` 1/1.
- **Doku beim Release:** keine.
- **Pruefen im Feld:** nichts.

### 2026-11-12 · Boden-Composer Etappe A + Lauftempo je Figur — ausgeliefert in Tracker v633 Alpha / Web v2364 (12.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push (hinter `ga_person_figures_v1`, Standard aus)
- **Dateien:** `ga-tracker-client/tracker.js`, `sync.js`, `mission-cargo-core.js`, `mission-person-figure-core.js`, `mission-onboard-core.js`, `mission-ground-visual-core.js`, `data/mission-person-assets.js`, Browser-Adapter Charter/Sightseeing/Reporter
- **Was:** Figur je Pax nach Look/Geschlecht/Jahreszeit, gemeinsamer Pax-und-Cargo-Composer für drei Pilot-Stränge, Tracker begrenzt Tempo auf `maxWalkKts`.
- **Tests:** siehe `docs/Tracker-v633-Release.md`.
- **Doku beim Release:** `docs/Mission Ground Composer Fahrplan.md` 3a.
- **Pruefen im Feld:** Schalter an, Charter mit Gruppe: passende Figuren, Wanderin erreicht die Tür.

### 2026-11-12 · Homebase: eigene Figuren als Mitarbeiter — ausgeliefert in Tracker v632 Alpha / Web v2363 / ga-proxy (12.11.2026)
- **Artefakt:** Tracker-EXE; Web und Proxy mit diesem Push
- **Dateien:** `ga-tracker-client/homebase-asset-catalog.js`, `homebase-object-manager.js`, `homebase-package-service.js`, `homebase-asset-updater.js`, `homebase-scene-core.js`, `homebase-integration.js`, `homebase/homebase-workbench.js`, Proxy `worker-merged-full.js`
- **Was:** Figuren mit `person`-Block aus dem installierten Assetpaket (Wanderin, Pack 0.6.26) als Homebase-Mitarbeiter, Tarmac-Ersatz ohne Pack oder für alte Tracker, Tempo je Figur.
- **Tests:** `homebase-pack-people.test.js` 3/3, `homebase-scene-core.test.cjs` 9/9, Worker `npm test`.
- **Doku beim Release:** `docs/Mission Person Asset Plan.md` 7a, `docs/Tracker-v632-Release.md`.
- **Pruefen im Feld:** Workbench „Eigene Figuren“ → Wanderin wählen, Homebase im Sim: läuft sie ihre Ziele ab?

### 2026-11-10 · EFB: Flugplan-Meldung obenauf — ausgeliefert in Tracker v631 Alpha (10.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Host)
- **Dateien:** `ga-tracker-client/tracker-efb-kartentisch-host.js`
- **Was:** Die Meldung nach „Route laden“ lag unter anderen Anzeigen. Jetzt oben, über allem, mit farbigem Rand (grün bestätigt, orange Hinweis), schließt per Antippen.
- **Tests:** `tracker-flightplan-host.test.js` 16/16 inkl. Syntaxprüfung.
- **Doku beim Release:** Release-Doku des nächsten Trackers.
- **Pruefen im Feld:** Meldung nach „Route laden“ gut sichtbar.

### 2026-11-10 · Flugplanbrücke: ATC-Variante mit Wegpunkt-Kennungen (EFB-Paket 0.4.27) — ausgeliefert in EFB-/Toolbar-Paket 0.4.27 Alpha (10.11.2026)
- **Artefakt:** EFB-Community-Package (und Toolbar-Panel-Kopie) – Build mit MSFS-SDK unter Windows
- **Dateien:** `ga-tracker-client/efb-app/flightplan-bridge-core.js`, Toolbar-Kopie `toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/flightplan-bridge-core.js` (identisch), Test `efb-app/flightplan-bridge-core.test.js`
- **Was:** Feldbefund 10.11. mit 0.4.26: ATC liefert LOWZ→EDTW mit 0 von 9 Wegpunkten. Nur die bei der ATC eingereichte Route bekommt jetzt Flugplätze als echte Flugplatz-Fixes und alle übrigen Punkte als Benutzer-Wegpunkte mit eindeutiger Kennung (WP01…); EFB-Planer und Avionik behalten die bewährte Lat/Lon-Route. ATC-Readback mit eigener Frist 15 s (vorher Zeitüberschreitung nach 8 s); `atcReadback` enthält auch die gesendete Route.
- **Tests:** `node --test ga-tracker-client/efb-app/flightplan-bridge-core.test.js` 12/12.
- **Doku beim Release:** `docs/EFB-Development-Plan.md`, `docs/EFB-Community-Package.md`.
- **Pruefen im Feld:** World Map „Route laden“: Wegpunkte auf der Weltkarte sichtbar? Sonst `atcReadback` (sent/got) aus dem Log.

### 2026-11-10 · Flugplanbrücke: ATC-Readback-Diagnose, Wartezeit, Toleranz — ausgeliefert in EFB-/Toolbar-Paket 0.4.26 Alpha (10.11.2026)
- **Artefakt:** EFB-Community-Package (und Toolbar-Panel-Kopie) – Build mit MSFS-SDK unter Windows
- **Dateien:** `ga-tracker-client/efb-app/flightplan-bridge-core.js`, `ga-tracker-client/toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/flightplan-bridge-core.js` (identisch), Test `efb-app/flightplan-bridge-core.test.js`
- **Was:** ATC-Plan bis ≈ 5 s zurücklesen (20 × 250 ms), 50-m-Toleranz statt ≈ 1 m, bei Abweichung `atcReadback` (erwartete Punktzahl, Start/Ziel, erste 16 Punkte) im Ergebnis/Log.
- **Tests:** `node --test ga-tracker-client/efb-app/flightplan-bridge-core.test.js` 11/11.
- **Doku beim Release:** `docs/EFB-Community-Package.md` (Paketversion, Änderung), `docs/Tracker-v628-Release.md` Abschnitt EFB-Paket.
- **Pruefen im Feld:** Weltkarte „Route laden“ mit mehreren Wegpunkten; bei Abweichung `atcReadback` im Tracker-Log auswerten.

### 2026-11-10 · Crew-Live-Verkehr — ausgeliefert in Tracker v630 Alpha / Web v2360 / ga-relay / ga-proxy (10.11.2026)
- **Artefakt:** Tracker-EXE; Web, Relay und Proxy mit diesem Push
- **Dateien:** `tracker-crew-live.js`, `tracker.js`, `tracker-crew-presence.js`, `traffic-warning-core.js`, `traffic-map-layer.js`, `map-live-presentation.js`, `crew-live-client.js`, `crew-presence-client.js`, `sync.js`, Relay `crew-live-room.js`, Proxy `crew-presence.mjs`
- **Was:** Crew-Flugzeuge live auf Karte und in Warnungen (grün, Warnsperre), Zuschauer-Modus in der Web-App.
- **Tests:** siehe `docs/Tracker-v630-Release.md`.
- **Doku beim Release:** `docs/Tracker-v630-Release.md`, `docs/Traffic Warnings.md`, `tools/cloudflare-relay/README.md`.
- **Pruefen im Feld:** Zwei bis drei Crew-Piloten mit v630: gegenseitig grün sichtbar, Formation ohne Dauerwarnung, Web-App zeigt Crew ohne eigenen Flug.

### 2026-11-10 · Preset-Symbol im EFB, eigenes Flugzeug per Objekt-ID — ausgeliefert in Tracker v629 Alpha / Web v2359 (10.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `tracker.js`, `tracker-aircraft-icons.js`, `tracker-efb-http-server.js`, `tracker-efb-kartentisch-host.js`, `app.js`
- **Was:** EFB zeigt das Preset-Symbol (Mission bzw. Hauptmenü-Auswahl); Eigenfilter über die echte Objekt-ID.
- **Tests:** siehe `docs/Tracker-v629-Release.md`.
- **Doku beim Release:** `docs/Tracker-v629-Release.md`.
- **Pruefen im Feld:** EFB-Flugzeugsymbol entspricht dem Preset; Log `TRAFFIC_SNAPSHOT own=` zeigt eine ID.

### 2026-11-10 · ATC-Umbau-Meldung, Verkehrs-Fehlalarm, Formationsfilter — ausgeliefert in Tracker v628 Alpha / Web v2358 (10.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.js`, `map-live-presentation.js`
- **Was:** Meldung + empfohlener Avionik-Start nach umgebauter ATC-Route, parkende KI als Boden, engere Eigenfilterung.
- **Tests:** siehe `docs/Tracker-v628-Release.md`.
- **Doku beim Release:** `docs/Tracker-v628-Release.md`.
- **Pruefen im Feld:** Start neben geparkten KI-Flugzeugen ohne Warnung; ATC-Meldung auf der Weltkarte.

### 2026-11-10 · Befunde Testflug 09.11. — ausgeliefert in Tracker v627 Alpha / Web v2357 (10.11.2026)
- **Artefakt:** Tracker-EXE; Web und Worker mit diesem Push
- **Dateien:** `tracker-mission-execution-runtime.js`, `tracker-flight-voice-core.js` (+ Generator), `app.js`, `board.js`, `sync.js`, `i18n/*`, Worker `crew-presence.mjs`/`worker-merged-full.js`
- **Was:** Touch-and-go-Ansagen, Crew-Pinnwand-Upload, Crew-Missionsabruf, Quest-Tastatur.
- **Tests:** siehe `docs/Tracker-v627-Release.md`.
- **Doku beim Release:** `docs/Tracker-v627-Release.md`.
- **Pruefen im Feld:** Touch-and-go an fremdem Platz, Crew-Flug teilen und laden, Quest-Tastatur.

### 2026-11-09 · EFB ohne Milchglas — ausgeliefert in Tracker v626 Alpha (09.11.2026)
- **Artefakt:** Tracker-EXE
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.css`, `tracker-efb-web-client.js`
- **Was:** Kein `backdrop-filter` im EFB, deckende Kopfleiste/Zeichen-Knopf in allen Designs.
- **Tests:** siehe `docs/Tracker-v626-Release.md`.
- **Doku beim Release:** `docs/Tracker-v626-Release.md`.
- **Pruefen im Feld:** VR: Panel nicht mehr durchscheinend, Kartenknöpfe bleiben sichtbar.

### 2026-11-07 · EFB-Kartenknöpfe in VR auf eigener Ebene — ausgeliefert in Tracker v625 Alpha (07.11.2026)
- **Artefakt:** Tracker-EXE
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.js`/`.css`, `tracker-efb-web-client.js`
- **Was:** Knöpfe mit `translateZ(0)` über der Karte in VR; v624-Deckkraft-Anstoß zurückgenommen.
- **Tests:** siehe `docs/Tracker-v625-Release.md`.
- **Doku beim Release:** `docs/Tracker-v625-Release.md`.
- **Pruefen im Feld:** In VR mit und ohne VFR-Overlay verschieben/zoomen, Knöpfe bleiben sichtbar.

### 2026-11-07 · EFB-Bedienknöpfe in VR nach Zoom — ausgeliefert in Tracker v624 Alpha (07.11.2026)
- **Artefakt:** Tracker-EXE
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.js`, `tracker-efb-web-client.js`
- **Was:** Neuzeichnen-Anstoß für Zoom/Ebenen/Zentrieren nach Zoom/Verschieben (VR-Coherent).
- **Tests:** siehe `docs/Tracker-v624-Release.md`.
- **Doku beim Release:** `docs/Tracker-v624-Release.md`.
- **Pruefen im Feld:** In VR zoomen mit den Tasten, Knöpfe bleiben sichtbar.

### 2026-11-06 · Verkehr im Ruhemodus, EFB-UI-Korrekturen — ausgeliefert in Tracker v623 Alpha / Web v2356 (06.11.2026)
- **Artefakt:** Tracker-EXE; Web mit diesem Push
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.js`/`.css`, `checklists.js`, `map-display-controls.js`, `index.html`, `styles.css`, `i18n/en.js`, `efb-web-assets/*`
- **Was:** Verkehrsabfrage auch im Ruhemodus und ohne Relay, Traffic-Diagnose im Log, sechs EFB-UI-Korrekturen.
- **Tests:** siehe `docs/Tracker-v623-Release.md`.
- **Doku beim Release:** `docs/Tracker-v623-Release.md`.
- **Pruefen im Feld:** Verkehr nach 5 min am Boden, UI-Punkte im MSFS-EFB.

### 2026-11-06 · EFB wieder lauffähig (Objekt-Spread entfernt) — ausgeliefert in Tracker v622 Alpha / Web v2355 (06.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Dateien); Web mit diesem Push
- **Dateien:** `map-live-presentation.js`, neu `ga-tracker-client/tracker-efb-asset-syntax.test.js`
- **Was:** `{ ...x }` in einer unverändert ans EFB gelieferten Datei hat seit v617 EFB und Toolbar gestoppt; entfernt, Test verhindert Wiederholung.
- **Tests:** siehe `docs/Tracker-v622-Release.md`.
- **Doku beim Release:** `docs/Tracker-v622-Release.md`.
- **Pruefen im Feld:** EFB und Toolbar zeigen Karte, Verkehr, Schatten.

### 2026-11-06 · Schatten auf iPhone, frische Updates — ausgeliefert in Tracker v621 Alpha / Web v2354 (06.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Host); Web live mit diesem Push (Service-Worker-Fix schon in v2353)
- **Dateien:** `map-live-presentation.js` (+ Test), `sync.js`, `map.js`, `sw.js`, `tracker-efb-kartentisch-host.js`
- **Was:** Rand und Schatten des eigenen Flugzeugs direkt auf der gedrehten Grafik (iOS Safari), Service Worker lädt frisch.
- **Tests:** siehe `docs/Tracker-v621-Release.md`.
- **Doku beim Release:** `docs/Tracker-v621-Release.md`.
- **Pruefen im Feld:** Schatten auf iPhone, nach Updates sofort neuer Stand.

### 2026-11-06 · Verkehr im EFB, Stufen vom Tracker, Entzerren beim Zoomen — ausgeliefert in Tracker v620 Alpha / Web v2352 (06.11.2026)
- **Artefakt:** Tracker-EXE (Stufen, EFB-Dateien); Web live mit diesem Push
- **Dateien:** neu `traffic-map-layer.js` (+ Test), `map-live-presentation.js`, `sync.js`, `profile.js`, `taws.js`, `index.html`, `sw.js`, `testboard.html`, `tracker-navigation-warnings.js`, `tracker-audio-client.js`, `tracker-efb-kartentisch-host.js`, `tracker-efb-web-client.js`, `package.json`, `efb-web-assets/*`
- **Was:** Verkehr auf der EFB-Karte, Stufe pro Kontakt zentral vom Tracker, Verkleinern/Ausblenden/Zusammenfassen beim Herauszoomen.
- **Tests:** siehe `docs/Tracker-v620-Release.md`.
- **Doku beim Release:** `docs/Tracker-v620-Release.md`, Testboard-Bereich „Traffic“.
- **Pruefen im Feld:** EFB-Verkehr, gleiche Stufe überall, Sammelpunkte beim Herauszoomen.

### 2026-11-06 · Schattenwurf der Flugzeug-Icons — ausgeliefert in Tracker v619 Alpha / Web v2351 (06.11.2026)
- **Artefakt:** Tracker-EXE (Traffic-AGL, EFB-Dateien); Web live mit diesem Push
- **Dateien:** `map-live-presentation.js`, `map-display-controls.js`, `sync.js`, `index.html`, `i18n/en.js`, `tracker.js`, `tracker-efb-kartentisch-host.js`, `efb-web-assets/*`
- **Was:** Schatten nach Höhe über Grund, Labels im Vordergrund, Regler Dunkelheit/Schärfe/Versatz (50 % = Standard), AGL pro Kontakt vom Tracker.
- **Tests:** siehe `docs/Tracker-v619-Release.md`.
- **Doku beim Release:** `docs/Tracker-v619-Release.md`.
- **Pruefen im Feld:** Schatten über Berg/Tal, AGL-Wert bei KI-Verkehr.

### 2026-11-06 · Eigenes Flugzeug-Icon wählbar, auch pro Profil — ausgeliefert in Tracker v618 Alpha / Web v2350 (06.11.2026)
- **Artefakt:** Tracker-EXE (EFB-Dateien); Web live mit diesem Push
- **Dateien:** `map-live-presentation.js`, `map-display-controls.js`, `app.js`, `sync.js`, `profile.js`, `index.html`, `styles.css`, `i18n/*`, `tracker-efb-kartentisch-host.js`, `efb-web-assets/*`
- **Was:** Icon-Auswahl (Klassik, 1-mot, 2-mot, Jet, Heavy, Heli) global im Karten-Menü und pro Flugzeug-Profil mit Schalter „Eigenes Icon verwenden“; Hinweis global/Profil.
- **Tests:** siehe `docs/Tracker-v618-Release.md`.
- **Doku beim Release:** `docs/Tracker-v618-Release.md`.
- **Pruefen im Feld:** Profilwechsel im Hauptmenü wechselt das Icon; EFB zeigt die globale Auswahl.

### 2026-11-06 · Verkehrswarnungen (Ansage, Ausweichen, Blinken, Schalter) — ausgeliefert in Tracker v617 Alpha / Desktop 1.6.40 / Web v2349 (06.11.2026)
- **Artefakt:** Worker (deployed), Web mit 75 Clips, Tracker-EXE, Desktop-App
- **Dateien:** `traffic-warning-core.js`, `map-live-presentation.js`, `navigation-warning-audio.js`, `tracker-navigation-warnings.js`, `tracker-voice-service.js`, `tracker-audio-*.js`, `tracker.js`, Desktop `ui/audio.js`/`index.html`, Worker `audio-settings.mjs`, Web `sync.js`, `profile.js`, `taws.js`, `styles.css`, `index.html`, `audio-warnings/**/aw-{verkehr,ausweichen,gleiche-hoehe,uhr-*}`
- **Was:** Verkehrswarnung mit Uhrzeit und Höhe, „Verkehr, ausweichen!“ bei Kollision in 20 s, Blinken auf Karte/Höhenband, eigener Schalter.
- **Tests:** siehe `docs/Tracker-v617-Release.md`.
- **Doku beim Release:** `docs/Traffic Warnings.md`, `docs/Tracker-v617-Release.md`.
- **Pruefen im Feld:** Ansage bei KI-Verkehr, Uhrzeit-Richtung, Ausweichen bei Gegenverkehr, Schalter, Blinken.

### 2026-11-05 · Traffic-Anzeige neu (Geisterkontakte, Symbole, Warnstufen) — ausgeliefert in Tracker v616 Alpha / Web v2347 (05.11.2026)
- **Artefakt:** Tracker-EXE (Engine + EFB-Dateien); Web live mit diesem Push
- **Dateien:** `tracker.js`, `tracker-efb-kartentisch-host.js`, `tracker-efb-web-client.js`, `efb-web-assets/*` (Sync); Web: `sync.js`, `map-live-presentation.js`, `map-display-controls.js`, `index.html`, `i18n/en.js`
- **Was:** stabile Objekt-ID statt Nähe-Zuordnung, leere Liste und 15-s-Ablauf, nur Luftfahrzeuge, Bodenverkehr ohne Warnung, Warnstufen, neue Symbole je Klasse, Größe/Umrandung im Anzeige-Menü.
- **Warum:** gestapelte stehende Kontakte und unbrauchbare Warnfarbe.
- **Tests:** siehe `docs/Tracker-v616-Release.md`.
- **Doku beim Release:** `docs/Tracker-v616-Release.md`.
- **Pruefen im Feld:** Log `IDs wie zuvor x/y`, Mitspieler sichtbar, Symbolklassen bei KI-Modellen.

### 2026-11-05 · Sprache für EFB/Toolbar aus der Desktop-App — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** Tracker-EXE (Engine + EFB-Dateien) **und** Desktop-App
- **Dateien:** `tracker.js`, `tracker-efb-display-settings.js`, `tracker-efb-web-client.js`, `tracker-efb-kartentisch-host.js`, `sync-efb-web-assets.js`, `package.json`, neu `efb-web-assets/i18n-core.js` + `efb-web-assets/i18n/*`; Desktop: `lib/config-store.js`, `lib/tracker-process.js`, `main.js`, `preload.js`, `ui/index.html`, `ui/renderer.js`, `ui/styles.css`
- **Was:** DE/EN-Schalter oben rechts im Desktop-Fenster; Tracker speichert `ui.language` in den EFB-Anzeige-Einstellungen; EFB und Toolbar schalten live um.
- **Dazu (gleicher Build):** EFB-Host-Texte (ohne Missionstexte), Desktop-Fenster übersetzt (`desktop/ui/i18n-en.js`, `i18n-core.js`-Kopie, `renderer.js`, `radio-hold.js`, `media.js`, `audio.js`), Audio-Menü `tracker-audio-client.js` (**auch Web** – geht mit dem nächsten Web-Push live).
- **Warum:** Englische Oberfläche Phase 2 (docs/English Translation Plan.md 2.5a).
- **Tests:** Desktop 150/150, Tracker/EFB 148/148, Anzeige-Einstellungen 12/12; lokaler EFB-Server DE→EN→DE identisch.
- **Verträglichkeit:** alte Desktop-App + neuer Tracker → Deutsch; neue Desktop-App + alter Tracker → Live-Wechsel wird abgelehnt (400), EFB bleibt deutsch.
- **Doku beim Release:** Release-Notiz „EFB/Toolbar folgen der Sprache der Desktop-App (Schalter oben rechts)“.
- **Pruefen im Feld:** Umschalten im laufenden Sim, EFB und Toolbar; Start mit Englisch.

### 2026-11-05 · Breakout/iPod-Texte und Screenreader-Attribute — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** generierte EFB-Kopien `efb-web-assets/media-player-ipod.js`, `efb-web-assets/kartentisch-fragment.html`; Web live mit diesem Push
- **Dateien:** `media-player-ipod.js` (+ `efb-media-source/`), `index.html`
- **Was:** Breakout-/iPod-Texte über `_mpT`; im Kartentisch-Fragment nur zusätzliche `data-i18n-*`-Attribute. Ohne `GAI18n` (EFB) exakt deutsch.
- **Warum:** Englische Oberfläche.
- **Tests:** EFB-Sync/Web-Client 26/26, iPod-/Media-/Watch-Selbsttests.
- **Doku beim Release:** keine. Im EFB ohne sichtbare Änderung.
- **Pruefen im Feld:** -

### 2026-11-05 · UI-Reste (Uhr-Timer, Wegpunkt-Popup) — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** generierte EFB-Kopien `efb-web-assets/media-player-watch-face.js`, `efb-web-assets/map-route-edit-core.js`; Web live mit diesem Push
- **Dateien:** `media-player-watch-face.js` (+ `efb-media-source/`-Kopie), `map-route-edit-core.js`
- **Was:** „Minuten“, „Polartag/Polarnacht“ und das Wegpunkt-Popup („Wegpunkt“, „🗑️ Löschen“) über die Satz-Tabelle; ohne `GAI18n` (EFB/Tracker) exakt deutsch.
- **Warum:** Englische Oberfläche.
- **Tests:** Watch-/iPod-/Win95-Selbsttests, Tracker EFB-Web-Client + Navigation 40/40.
- **Doku beim Release:** keine. Im EFB ohne sichtbare Änderung.
- **Pruefen im Feld:** -

### 2026-11-04 · Debrief übersetzbar — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** generierte EFB-Kopie `efb-web-assets/flight-debrief.js`; Web live mit diesem Push
- **Dateien:** `flight-debrief.js` (+ Web: `flight-logbook-view.js`, `app.js`, `board.js`, `index.html`)
- **Was:** Debrief-Texte über `_fdT/_fdK`; ohne `GAI18n` (EFB) exakt deutsch.
- **Warum:** Englische Oberfläche (Flugbuch/Debrief).
- **Tests:** EFB-Sync/Web-Client 26/26, Gegenprobe identisch.
- **Doku beim Release:** keine. Im EFB ohne sichtbare Änderung.
- **Pruefen im Feld:** -

### 2026-11-04 · Zahlen-/Datumsformat der UI-Sprache — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** generierte EFB-Kopien `efb-web-assets/map-context-popup.js`, `efb-web-assets/flight-debrief.js`; Web live mit diesem Push
- **Dateien:** `i18n-core.js`, `map-context-popup.js`, `flight-logbook-view.js`, `flight-debrief.js`, `app.js`
- **Was:** Anzeige von Zahlen und Datum im Format der UI-Sprache; ohne `GAI18n` (EFB) unverändert `de-DE`.
- **Warum:** Englische Oberfläche zeigte „5.000 ft“ und deutsche Datumsangaben.
- **Tests:** i18n-core 12/12, Tracker 1540/1542 (zeitabhängige Integrationstests einzeln grün), Browser DE/EN/DE.
- **Doku beim Release:** keine. Im EFB ohne Wirkung.
- **Pruefen im Feld:** -

### 2026-11-03 · Vollbild-Pinnwand/Kartentisch bei Seitengröße ≠ 100 % (Web) — ausgeliefert in Tracker v615 Alpha / Desktop 1.6.39 (05.11.2026)
- **Artefakt:** nur die generierte EFB-Kopie `ga-tracker-client/efb-web-assets/styles.css`; Web ist mit diesem Push live
- **Dateien:** `styles.css`, `index.html` (Stylesheet-Version), generiert `efb-web-assets/styles.css`
- **Was:** Unter `body.app-ui-scaled` teilen Pinnwand, Kartentisch, Vollbild-Kartentisch und `--drawer-mobile-shift` vw/vh durch `--ga-ui-scale`.
- **Warum:** Bei Seitengröße 75 % auf dem Handy füllten die Vollbild-Panels nur ~75 % des Bildschirms.
- **Tests:** Browser 375×812 bei 75/100/125 %: Kartentisch und Pinnwand 375×812; EFB-Sync- und Web-Client-Tests grün.
- **Doku beim Release:** keine. Im EFB ohne Wirkung (dort keine `app-ui-scaled`-Klasse).
- **Pruefen im Feld:** Handy mit Seitengröße < 100 %: Pinnwand und Kartentisch öffnen, Vollbild-Karte.

### 2026-11-03 · Langer Klick öffnet „Was ist hier?“ am Mauspunkt — ausgeliefert in Tracker v614 Alpha (03.11.2026)
- **Artefakt:** Tracker-EXE (`tracker-efb-kartentisch-host.js`); Web-Teil (`map.js`) mit demselben Push live
- **Dateien:** `ga-tracker-client/tracker-efb-kartentisch-host.js`, `map.js`, Tests in `tracker-efb-web-client.test.js`
- **Was:** Umrechnung der Mausposition berücksichtigt EFB-UI-Skalierung bzw. Web-Seitengröße.
- **Warum:** Punkt lag bei skaliertem EFB versetzt (Feldtest EDDS).
- **Tests:** Tracker 1540/1542 (2 übersprungen), Browser-Test Web 80/100/120 %.
- **Doku beim Release:** `docs/Tracker-v614-Release.md`.
- **Pruefen im Feld:** Langer Klick im EFB auf einen Flugplatz, auch bei geänderter EFB-Größe.

### 2026-11-03 · EFB-Dateien der englischen UI-Übersetzung — ausgeliefert in Tracker v612 Alpha (03.11.2026)
- **Artefakt:** Tracker-EXE (generierte EFB-Kopien); Web ist seit `935be0a0d` (v2318) und `2e07ce0ef` (v2319) live
- **Dateien:** `ga-tracker-client/efb-web-assets/*` (generiert), `ga-tracker-client/efb-media-source/media-player-watch*.js`
- **Was:** EFB-Kopien neu erzeugt; ohne `GAI18n` bleibt das EFB exakt deutsch. `EFB_WEB_ASSET_REVISION` 61201.
- **Warum:** Web-Übersetzung Phase 0/1; Watch-Quellen müssen der Web-Fassung entsprechen.
- **Tests:** Tracker 1539/1541 (2 übersprungen), EFB-Sync- und Web-Client-Tests grün.
- **Doku beim Release:** `docs/Tracker-v612-Release.md`.
- **Pruefen im Feld:** Watch (Zurück/Halten), „Was ist hier?“ mit METAR, Kartentisch allgemein.

### 2026-10-29 · Routen-Hindernis-Cache auf Handys kleiner — ausgeliefert in Tracker v605 (29.10.2026)
- **Artefakt:** Tracker-EXE (nur die generierte EFB-Kopie von `profile.js`); Web ist seit `77fa27e0f` live
- **Dateien:** `profile.js` (`VP_OBS_COMBO_MAX_ENTRIES`), generiert `ga-tracker-client/efb-web-assets/profile.js`
- **Was:** Auf Handys (`pointer: coarse`, bis 900 px) bleiben höchstens 3 statt 8 `ga_obs_combo_*`-Einträge.
- **Warum:** Jede Routenänderung erzeugt einen eigenen Eintrag (30–90 KB); Safari-localStorage ~5 MB.
- **Tests:** Browser mit Handy-Simulation; im EFB keine Verhaltensänderung (dort weiter 8).
- **Doku beim Release:** keine.
- **Pruefen im Feld:** -

### 2026-10-29 · Debug-Log schlüsselt ga_active_mission auf — ausgeliefert in Tracker v604 (29.10.2026)
- **Artefakt:** Tracker-EXE (EFB-Kopie von `profile.js`); Web ist mit diesem Push live (`sw.js` v2290)
- **Dateien:** `profile.js` (`vpBuildActiveMissionStorageBreakdownLines`), generiert `ga-tracker-client/efb-web-assets/profile.js`
- **Was:** Der Speicherabschnitt im Debug-Log zeigt die größten Felder von `ga_active_mission`, von
  `currentMissionData` und vom Missionsvertrag sowie, ob der Vertrag mehrfach identisch gespeichert ist.
- **Warum:** Ursachenanalyse für 1,78 MB `ga_active_mission` auf dem iPhone (Safari-Limit ~5 MB).
- **Tests:** Browser mit künstlicher Mission; nur Diagnose, keine Laufzeitwirkung.
- **Doku beim Release:** Tracker-Release-Notiz ergänzen.
- **Pruefen im Feld:** Debug-Log im EFB zeigt den Abschnitt „Aufschluesselung ga_active_mission“.

### 2026-10-29 · Tracker-Lauf meldet seine Cloud-Aktivierung — ausgeliefert in Tracker v601 (29.10.2026)
- **Artefakt:** Tracker-EXE
- **Dateien:** `ga-tracker-client/mission-authority-core.js` (`publicRun` → `cloudActivation`); Web-Gegenstück in
  `sync.js` ist mit diesem Push live
- **Was:** Die Lauf-Meldung an die App enthält `cloudActivation: { epoch, revision }` aus
  `resumeBundle.cloudMissionControl`. Die App merkt sich den Lauf zusammen mit dieser Aktivierung und verwirft ihn,
  sobald die Cloud eine andere Aktivierung oder ein Löschen zeigt, ohne Zeitvergleich.
- **Warum:** Auf einem Gerät ohne laufenden Tracker blieb „Mission läuft noch“ stehen, wenn dieselbe Mission gelöscht
  und (z. B. aus der Pinnwand) neu angenommen wurde. Die Zwischenlösung vergleicht Zeiten mit 5 Minuten Puffer; sie
  bleibt nur als Rückfall für Läufe ohne Aktivierung (ältere Tracker, nicht aus der Cloud geladene Läufe).
- **Tests:** `tools/tracker-run-cloud-forget.test.mjs`; Tracker-Tests zu `mission-authority-core`/`getPublicSnapshot`
  (417 grün).
- **Doku beim Release:** `docs/Cloud Profile Sync V2.md` Abschnitt vom 29.10.2026 ist aktualisiert; Tracker-Release-Notiz
  ergänzen.
- **Pruefen im Feld:** Mission annehmen und im Tracker beginnen; auf einem zweiten Gerät ohne Tracker erscheint
  „Mission läuft noch“. Mission löschen, aus der Pinnwand neu annehmen: der Hinweis verschwindet beim nächsten
  Cloud-Abgleich, auch wenn beides innerhalb weniger Minuten passiert.

### 2026-10-21 · Testflug-Funde EDTF→EDTW: Startfreigabe, PAX-Fragen, Ladung, Ankunftsplatzierung — ausgeliefert in Tracker v583 (21.10.2026)
- **Artefakt:** Tracker-EXE (inkl. EFB-Host); die Web-App-Teile sind mit diesem Push live (`sw.js` v2185)
- **Dateien:** `sync.js`, `passenger-voice.js`, `app.js`, `mission-arrival-core.js`,
  `mission-pax-query-core.js` (generiert, `tools/generate-mission-pax-query-core.mjs`),
  `ga-tracker-client/tracker-efb-kartentisch-host.js`, `ga-tracker-client/mission-control-ui-core.js`,
  `ga-tracker-client/tracker-mission-execution-adapter.js`, `ga-tracker-client/tracker-mission-reset.js`,
  `ga-tracker-client/tracker-mission-cloud.js` (+ Tests, Fixtures `tools/fixtures/arrival-*-osm-20261021.json`)
- **Was:**
  - Web-Startbanner: Startfreigabe des Trackers nach lokaler Empfangszeit statt PC-Uhr (Quest hing bei „Warte auf aktuelle Simulatordaten“).
  - EFB-Verlade-Manager: lokale „Schließen“-Taste nie durch laufende Tracker-Aktion gesperrt.
  - Watch (Web + EFB): Position wird an die Uhr übergeben → QNH, Temperatur, SR/SS.
  - PAX-Fragen: Wetter immer beantwortbar (auch Lob bei Sonne), Ladung kommentiert Fracht/Pflicht-Items mit Schäden in Worten, Wohlbefinden ohne Score/Prozent; Verfügbarkeit nur aus Missionsfakten (Angebot = Prüfung); EFB zeigt Ablehnungen im PAX-Fenster.
  - Neuer Lauf einer noch nicht gestarteten Mission beginnt mit Missionsladung draußen (App beim Acquire, Tracker beim Cloud-Laden); Flugzeug-Inventar bleibt.
  - Ankunftsszene: ungeprüfter Flughafen-Ersatzpunkt spawnt nie, alte Pläne werden vor der Übergabe nachträglich platziert; Vorfeld freigegeben (4 m zur Rollweg-Mitte), Hangar-Vorzone freigegeben und bevorzugt, nächster Hangar entscheidet, Rettungsstationen abgewertet, Rollweg-Nähe bevorzugt, GA-Bereich (GAT/GA-Vorfeld/FBO) bevorzugt; Bahnpuffer aus kartierter Breite; Bush-Fallback sucht entlang der Piste (Pufferrand, nahe Hütte); räumliches Raster für große Plätze.
- **Warum:** Funde aus dem Testflug vom 20.10.2026 (Charter-/Reporter-Rückflug EDTF→EDTW, Quest-Web + EFB).
- **Tests:** `tools/apt-arrival-hangar-front.test.mjs` (EDTW, EDTQ, EDDS, Big Creek, Soldier Bar), `tools/apt-arrival-composer.test.mjs`, `tools/flight-report-20261017.test.mjs`, `ga-tracker-client/tracker-mission-pax-query.test.js`, `tracker-mission-execution-runtime.test.js`, `tracker-mission-cloud.test.js`, `tools/mission-precipitation.test.cjs`.
- **Beim Release noch einchecken:** kleiner `ga-tracker-client/tracker.js`-Teil liegt lokal (nicht in der Warteschlange erlaubt): Spawn-Sperre für ungeprüfte Flughafen-Ersatzpunkte (`planSource`) und `hangarFront`-Kandidaten in `resolveAptArrivalLivePlacement`. `EFB_WEB_ASSET_REVISION` erhöhen (EFB-Host geändert).
- **Doku beim Release:** `docs/Arrival Scene Placement.md` und `docs/Tracker Mission Migration Guide.md` sind aktualisiert; Tracker-Release-Notiz ergänzen.
- **Pruefen im Feld:** Startbanner auf der Quest; PAX-Ladung/Wetter im EFB; Watch-QNH; Ankunftsszene in EDTW/EDTQ vor dem Hangar, EDDS am GA-Vorfeld, Big Creek neben der Hütte; Ladung bei neuem Lauf draußen.

### 2026-10-21 · Gepäckdarstellung über den Cargo-Composer, Gepäckgruppen — ausgeliefert in Tracker v583 (21.10.2026)
- **Artefakt:** Tracker-EXE (Laden/Entladen/Abwurf von Gruppen); die Web-App-Teile sind mit dem Push live
- **Dateien:** `mission-cargo-visual-core.js` (neu), `data/mission-cargo-asset-profiles.json` (neu),
  `data/mission-cargo-assets.js` (generiert, `tools/generate-mission-cargo-assets.mjs`), `mission-cargo-core.js`,
  `mission-apt-news-browser.js`, `mission-charter-browser.js`, `mission-sightseeing-browser.js`, `sync.js`,
  `index.html`, `sw.js`, `ga-tracker-client/tracker-mission-simulator-effects.js` (+ Tests)
- **Was:**
  - Reporter-, Charter- und Sightseeing-Gepäck: Ein Composer-Schritt (parallel zum Writer) ordnet die frei geschriebene Beschreibung 1–3 Packstücken aus dem Cargo-Katalog zu; Größe und Variante wählt der Code nach Gewicht, Farbe/Modell wird gestreut. Ideen-Prompts bleiben ohne Katalog und ohne Beispiele.
  - Dynamischer Katalog: Form, Größe, Lastbereich und Verwendung pro Pack-Asset in `data/mission-cargo-asset-profiles.json`; neue Assets brauchen nur einen Profil-Eintrag.
  - Gruppen: ein Manifest-Posten, mehrere Stücke mit eigenem Objektschlüssel (`:p2`, `:p3`); Startszene, Pickup-Szene, Laden, Entladen und Abwurf gemeinsam.
  - Rückflug übernimmt die Auswahl des Hinflugs.
  - Reporter: generischer Zusatzposten „Akkukoffer und Speicherkarten“ entfällt.
  - Ohne gültige Composer-Wahl bleibt die bisherige Text-Zuordnung.
- **Warum:** Rückflug vom 20.10.2026 zeigte die Reporter-Ausrüstung als zwei Kartons statt Kamera-Equipment; Live-Proben: heutige Stichwort-Zuordnung lag bei Reportern 5 von 10 daneben.
- **Tests:** `node --test tools/mission-cargo-visual.test.mjs`, `ga-tracker-client/tracker-mission-simulator-effects.test.js` (Gruppenfall), `tools/mission-scene-cargo-selftest.mjs`, `tools/mission-apt-news-ideas.test.cjs` (angepasst); Live-Check 15/15 gültig (`analysis/cargo-visual-core-live-20261021.json`, lokal).
- **Doku beim Release:** `data/mission-scene-asset-strategy.md` Abschnitt „Gepäckdarstellung über den Cargo-Composer“ ist aktualisiert; Tracker-Release-Notiz ergänzen.
- **Pruefen im Feld:** Reporter-/Charter-/Sightseeing-Mission neu erstellen: Gepäckgruppe an der Startposition, gemeinsames Laden, Entladen am Ziel, gleiche Stücke auf dem Rückflug; Pickup-Rückflug: Gruppe wartet am Zielplatz; Abstände und Optik der Stücke.

### 2026-10-20 · Kameraansicht im Debug-Log — ausgeliefert in Tracker v581 (20.10.2026)
- **Artefakt:** Tracker-EXE
- **Dateien:** `ga-tracker-client/tracker-camera-telemetry.js`,
  `ga-tracker-client/tracker-mission-interruption-controller.js` (+ Tests)
- **Was:** `SIM_CAMERA_STATE from=… to=…` bei jedem Wechsel der MSFS-
  Kameraansicht (mit Namen, z. B. `12=world_map`, `11=waiting`,
  `2=cockpit`); `MISSION_INTERRUPTION_DECISION … camera=…`.
- **Warum:** Nachweis, dass Szenen/Zuladung nach einer Unterbrechung erst
  nach „Fliegen“ (Cockpit) neu aufgebaut werden, nicht im „Bereit zum
  Fliegen“-Bildschirm.
- **Tests:** `tracker-camera-telemetry.test.js`,
  `tracker-mission-interruption-controller.test.js`
- **Doku beim Release:** Zeile in `docs/Mission Runtime Authority Contract.md`
  (Unterbrechung, Abschnitt der neuen Tracker-Version).
- **Pruefen im Feld:** Welche Kameraansicht MSFS 2024 im „Bereit zum
  Fliegen“-Bildschirm meldet.

## Vorlage

```
### JJJJ-MM-TT · Kurztitel
- **Artefakt:** Tracker-EXE | Desktop-App | EFB-Paket
- **Dateien:** …
- **Was:** …
- **Warum:** …
- **Tests:** …
- **Doku beim Release:** …
- **Pruefen im Feld:** …
```
