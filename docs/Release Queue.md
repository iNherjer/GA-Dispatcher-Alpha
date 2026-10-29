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

### 2026-10-29 · Routen-Hindernis-Cache auf Handys kleiner
- **Artefakt:** Tracker-EXE (nur die generierte EFB-Kopie von `profile.js`); Web ist seit `77fa27e0f` live
- **Dateien:** `profile.js` (`VP_OBS_COMBO_MAX_ENTRIES`), generiert `ga-tracker-client/efb-web-assets/profile.js`
- **Was:** Auf Handys (`pointer: coarse`, bis 900 px) bleiben höchstens 3 statt 8 `ga_obs_combo_*`-Einträge.
- **Warum:** Jede Routenänderung erzeugt einen eigenen Eintrag (30–90 KB); Safari-localStorage ~5 MB.
- **Tests:** Browser mit Handy-Simulation; im EFB keine Verhaltensänderung (dort weiter 8).
- **Doku beim Release:** keine.
- **Pruefen im Feld:** -

## Ausgeliefert

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
