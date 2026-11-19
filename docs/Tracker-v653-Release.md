# Tracker v653 Alpha – Warnung beim Losrollen vor dem Start

Zusammen ausgeliefert mit Web v2472 (Banner, Pax-Fenster, englische Texte).

## Anlass

Ein Tester ist losgeflogen, bevor die Verladung abgeschlossen war. Der Taxi-Auto-Start
(v641) greift erst nach bestätigter Verladung.

## Änderungen

- `tracker-mission-premature-taxi-core.js` (neu): Erkennung in den Phasen `prepare` und
  `boarding` (zwei Readiness-Pakete am Boden mit mindestens 2 kt und mindestens 3 m vom
  Standplatz, bzw. zwei Pakete in der Luft), Stufen `taxi`, `taxi_again` und `airborne`, Sprecherwahl
  (Passagier oder Dispatcher per Funk), feste Sätze, KI-Prompt, Sprechstil DE/EN.
- `tracker-mission-execution-runtime.js`: Beobachtung an der Startfreigabe, Meldung als
  `voice.flight` `premature_taxi`, Status `startReadiness.prematureTaxi`, Logs
  `MISSION_PREMATURE_TAXI*`.
- `mission-execution-core.js`: `premature_taxi` als einzige Flug-Meldung vor dem Start (nur
  `prepare`/`boarding`).
- `tracker-mission-execution-adapter.js`: Felder der neuen Meldung.
- `tracker-mission-boarding-voice.js`: eigener Zweig, Sprecher Passagier (Stimme wie beim
  Boarding) oder „Dispatch“, Bereich `run`, verworfen sobald die Mission läuft.
- `tracker-voice-service.js`: neue Meldungsart, englischer Sprechstil.
- `mission-apt-ui-core.js`: Warnbanner „Halt! Anhalten“ bzw. „Umkehren“.
- `passenger-voice.js`: Titel „Verladung offen“ im Pax-Fenster. `i18n/en-phrases.js` und
  EFB-Kopie: englische Texte.
- Vertrag: `docs/Mission Runtime Authority Contract.md`, Abschnitt 19.11.2026.
- `EFB_WEB_ASSET_REVISION` 65301.

## Tests

- Tracker-Suite `node --test *.test.js`: 1623/1625 bestanden, 2 übersprungen, 0 Fehler; Web-Testdateien alle einzeln grün.
- Neu: `tracker-mission-premature-taxi-core.test.js` (Erkennung, Schwankungen, Stufen,
  Sprecher), Laufzeit Ende-zu-Ende (Frachtmission: Dispatcher, Abheben, Rückkehr),
  Sprachausgabe (Dispatcher, Passagier, nach dem Start verworfen), Kern-Freigabe, Banner.
- Im MSFS noch nicht geprüft.

## Feldtest

1. Während des Verladens losrollen: nach etwa 2 s ruft der Passagier „Halt, stopp! Wir haben
   das Verladen noch nicht abgeschlossen!“, der Banner zeigt „Halt! Anhalten“.
2. Anhalten, wieder losrollen: zweite, schärfere Meldung. Danach keine weitere Bodenwarnung.
3. Abheben: Meldung zum Umkehren, Banner „Umkehren“. Landen und an der Parkposition halten:
   Banner verschwindet.
4. Reine Frachtmission: Dispatcher per Funk.
5. An der Parkposition rangieren oder Bremsen lösen: keine Meldung.

## Artefakt

- Tag `v653`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175352295 Bytes
- SHA-256: b5e62752631bb20cd39fff82cd8250749120cc556787474ffd189be65be427bb (öffentlicher Download geprüft)
