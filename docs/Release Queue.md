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

(keine)

## Ausgeliefert

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
