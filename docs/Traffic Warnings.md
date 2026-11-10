# Verkehrswarnungen

Stand: 06.11.2026. Ausgeliefert mit Tracker v617 Alpha, Desktop 1.6.40, Web v2349; Worker deployed. Release: `docs/Tracker-v617-Release.md`.

## Verhalten

- **Warnung** „Achtung, Verkehr, elf Uhr, unterhalb“, sobald ein Kontakt in die
  Warnstufe kommt: höchstens 1 NM und ±600 ft entfernt, oder Annäherung auf
  höchstens 0,5 NM innerhalb von 40 s (Höhe zum Annäherungspunkt aus beiden
  Steig-/Sinkraten).
  - Uhrzeit relativ zum eigenen Steuerkurs (12 = voraus, 3 = rechts).
  - Höhe: „gleiche Höhe“ unter 300 ft Unterschied, sonst „oberhalb“/„unterhalb“.
- **Ausweichen** „Verkehr, ausweichen! Verkehr, ausweichen!“, wenn die
  Annäherung auf höchstens 0,3 NM und 500 ft innerhalb von 20 s vorhergesagt
  ist (oder der Kontakt schon unter 0,3 NM / 300 ft ist und sich nähert).
  Ersetzt eine noch nicht gesprochene Warnung desselben Moments.
- Pro Kontakt eine Warnung; neu erst, wenn er die Warnstufe 8 s verlassen hat
  und seit der letzten Warnung eine Minute vergangen ist. „Ausweichen“ frühestens
  wieder nach 25 s. Zwischen zwei Verkehrsansagen mindestens 4 s.
- Keine Warnung für Flugzeuge am Boden und solange das eigene Flugzeug am Boden
  steht. Verkehrsliste älter als 12 s: keine Warnung.
- Die Liste kommt alle 5 s (SimConnect-Last). Für die Auswertung (1 Hz) werden
  die Kontakte entlang Kurs, Geschwindigkeit und Steigrate auf „jetzt“
  vorgerechnet.

## Anzeige

- Seit v620 bestimmt der Tracker die Stufe je Kontakt (`trafficLevels`); Karte (Web/EFB, `traffic-map-layer.js`) und Höhenband zeichnen nur.

- Karte: Warnung blinkt orange, Ausweichen blinkt schnell rot (`styles.css`
  `trfBlinkAlert`/`trfBlinkResolve`).
- Höhenband: Seitenansichten je Klasse (`drawTrafficSide` in
  `map-live-presentation.js`, reine Polygone für den MSFS-EFB), gleiche Farben,
  Blinken, Gegenverkehr gespiegelt. Größe folgt Anzeige → Traffic Icons.
- Kontakte, vor denen der Tracker gerade warnt (`trafficAlerting` im Snapshot),
  blinken auf allen Geräten, auch wenn der Ton aus ist.

## Aufbau

- Einstufung und Uhrzeit: `classifyTraffic`/`trafficClock`/`trafficDisplayLevel`
  in `map-live-presentation.js` (Karte, Höhenband und Ansage nutzen dieselbe).
- Entscheidung, wann gesprochen wird: `traffic-warning-core.js`
  (`createTrafficWarningDetector`), Tests `traffic-warning-core.test.js`.
- Tracker: `tracker-navigation-warnings.js` `observeTraffic`, Warntyp `traffic`.
  Wie die vertikalen Luftraumwarnungen Tracker-owned: läuft auch bei
  web-autoritativen Missionen und ohne offene Web-App.
- `ga.navigation-warnings.v1` meldet `capabilities.traffic`, `trafficActive` und
  `trafficAlerting`. Ältere Tracker: Schalter gesperrt, Blinken nur aus der
  lokalen Einstufung.
- Schalter `traffic` (Audio-Einstellungen): Tracker-Steuerung, Worker
  `audio-settings.mjs`, Web/EFB `awmTrafficWarnCheck` (`awm_warn_traffic`),
  Desktop `audioTraffic`.

## Sprachbausteine

15 neue Clips je Stimme (`tools/traffic-warning-voice-clips.mjs`):
`aw-verkehr`, `aw-ausweichen`, `aw-gleiche-hoehe`, `aw-uhr-1` … `aw-uhr-12`.
„Achtung“, „oberhalb“, „unterhalb“ gab es schon. Anna (lokal, `say`), Ava EN
(lokal), Matilda/Hannah/Liam (ElevenLabs). Alle 75 Dateien mit ffprobe und
vollständigem Decodieren geprüft. Hörproben: `analysis/traffic-warnings-2026-11-06/`.
Erlaubte Namen: `navigation-warning-audio.js` (Kopie in `desktop/ui`).

## Ausrollen

1. Worker mit `traffic` in `audio-settings.mjs` deployen.
2. Web-Push mit den 75 Clips, `sw.js` erhöhen. Clips müssen unter GitHub Pages
   abrufbar sein, bevor der Tracker live geht.
3. Tracker v617 bauen und als Alpha veröffentlichen.
4. Desktop-App (Schalter, Player) als Alpha veröffentlichen.
5. Im Sim prüfen: Ansage bei KI-Verkehr, Uhrzeit-Richtung, Ausweichen bei
   Gegenverkehr, Schalter aus, Blinken auf Karte/Höhenband/EFB.

## Lokale Nachweise

```bash
node --test navigation-warning-core.test.js navigation-warning-vertical.test.js map-live-presentation.test.js traffic-warning-core.test.js ga-tracker-client/tracker-navigation-warnings.test.js ga-tracker-client/tracker-navigation-audio.test.js ga-tracker-client/tracker-audio-client.test.js ga-tracker-client/tracker-audio-player.test.js ga-tracker-client/tracker-audio-control-core.test.js ga-tracker-client/tracker-audio-menu-stability.test.js tools/cloudflare-worker/audio-settings.test.mjs
```


## Crew-Flugzeuge (seit Tracker v630, 10.11.2026)

Crew-Flugzeuge kommen aus dem Crew-Live-Raum des Relays (`tracker-crew-live.js`), nicht
aus SimConnect. Sie tragen `crew: 1` und die ID `crew:<pilotId>`, stehen vorne in jeder
Verkehrsliste (keine 20er-Grenze) und werden bis 10 s hochgerechnet.

- **Warnsperre pro Crew-Flugzeug:** „Achtung, Verkehr“ einmal und „ausweichen“ einmal je
  Begegnung; erneut erst, nachdem beide mehr als 3 NM auseinander waren
  (`traffic-warning-core.js`, `crewRearmNm`). Zustand bleibt 10 min, auch wenn das Flugzeug
  kurz fehlt. KI-Verkehr unverändert.
- **Anzeige:** grün `#30d158` mit weißem Rand, Rufzeichen und Name immer sichtbar, nie zu
  Sammelpunkten zusammengefasst; bei Warnung oranger bzw. roter Ring
  (`traffic-map-layer.js`). Kein Eigenfilter über die Position.
