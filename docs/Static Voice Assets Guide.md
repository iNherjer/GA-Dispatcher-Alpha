# Static Voice Assets Guide

Diese Anleitung beschreibt, wie wiederholte Passenger-Voice-Saetze einmal mit Gemini TTS gerendert und danach lokal aus dem Repo abgespielt werden. Ziel ist nicht, die dynamische Pax-Voice zu ersetzen. Ziel ist, haeufig getriggerte Standardsaetze aus Hot Paths herauszunehmen, ohne Klang, Stimme und Intercom-Stil zu verlieren.

## Wann das sinnvoll ist

Statische Voice Assets passen fuer Saetze, die:

- deterministisch sind oder nur aus wenigen stabilen Varianten bestehen
- oft pro Mission oder pro Flug getriggert werden
- keinen lokalen Kontext wie Namen, Wetter, konkrete POI-Fakten oder Missionsergebnis brauchen
- klanglich zur Gemini-Pax-Voice passen sollen
- bei Ausfall trotzdem sauber auf Live-TTS zurueckfallen duerfen

Gute Kandidaten:

- Survey-/Mapping-Events: Arbeitszone erreicht, Linie/Kreis fertig, Reset wegen Hoehe oder Offtrack, Survey abgeschlossen
- Arbeitszonen: Einflug in Zone, Verlassen der Zone, erneuter Anflug, Datenaufnahme laeuft
- Training: Uebung gestartet, sauberer Durchlauf, Wiederholung noetig, Abschluss
- spaetere stark getriggerte Runtime-Hinweise mit festem Wortlaut

Keine guten Kandidaten:

- Briefings, Begruessungen und Farewells mit Namen, Wetter, Zielstory oder Missionsergebnis
- Knowledge-Guide-Fakten oder POI-Erklaerungen
- Saetze, bei denen die Persona spontan auf Missionsdrift reagieren soll

## Aktueller Stand

Die erste Integration liegt unter:

`audio-pax/gemini-survey-v1/`

Die Runtime laedt optional:

`audio-pax/gemini-survey-v1/catalog.json`

Wenn der Katalog fehlt oder ein passender Clip fehlt, laeuft alles wie vorher ueber Gemini TTS. Dadurch sind Teilsets erlaubt.

## Runtime-Ablauf

1. Ein Missionsevent erzeugt einen stabilen Clip-Key, zum Beispiel `line_complete`.
2. `passenger-voice.js` laedt den statischen Katalog, falls vorhanden.
3. Die Runtime bestimmt die gleiche Gemini-Stimmenreihenfolge wie Live-TTS:
   - male: `Charon`, `Puck`
   - female: `Kore`, `Leda`, `Aoede`
4. Es wird zuerst ein Clip der primaeren Kandidatenstimme gesucht.
5. Wenn mehrere Takes fuer diese Stimme existieren, waehlt die Runtime deterministisch einen Take passend zur Mission/Passenger-Kombination.
6. Der lokale WAV-Clip wird durch denselben AudioContext-Player geschickt wie Live-TTS.
7. Intercom, Distortion und Rauschen entstehen beim Playback, nicht in der Datei.
8. Wenn kein passender lokaler Clip existiert, faellt die Runtime auf Gemini TTS zurueck.

Wichtig: Die WAV-Dateien bleiben clean. Nicht vorab Rauschen oder Funkfilter in die Datei rendern, sonst wird der Effekt doppelt oder inkonsistent.

## Generator-Workflow

Request-Plan ohne API-Calls:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all
```

Gezielt rendern:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices Kore,Leda,Aoede --clips line_complete --takes 2 --write
```

Vollstaendig rendern:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices all --clips all --takes 2 --write
```

Das Script nutzt `GEMINI_API_KEY` aus der Shell oder aus `key.env.local`.

## Quota-schonendes Rendern

Nicht direkt mit der vollen Matrix anfangen, wenn die Quote unsicher ist.

Empfohlene Reihenfolge:

1. Ein fehlender Take als Probe:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices Charon --clips line_complete --takes 1 --write
```

2. Kleine Pakete mit 10 bis 20 Requests:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices all --clips scan_survey_area_entered,line_complete --takes 2 --write
```

3. Am Ende einmal die volle Matrix laufen lassen. Wenn alle Dateien existieren, macht das 0 TTS-Requests und schreibt nur den vollstaendigen Katalog neu:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices all --clips all --takes 2 --write
```

## Neue Missionen anschliessen

Fuer eine neue Mission oder Mission-Familie immer in dieser Reihenfolge arbeiten:

1. Standardsaetze identifizieren
   - Nur Saetze nehmen, die wirklich stabil bleiben.
   - Kontextvarianten als eigene Keys modellieren, nicht im Dateinamen verstecken.
   - Beispiel: `workzone_entered`, `workzone_exit`, `training_pass_clean`.

2. Clip-Keys und Texte im Generator ergaenzen
   - Aktuell stehen die Survey-Texte in `tools/generate-gemini-pax-voice-assets.mjs`.
   - Fuer groessere Sets sollte der Generator spaeter ein externes Manifest lesen, damit Missionen ihre Cliplisten ohne Code-Duplikate pflegen koennen.

3. Runtime-Key-Mapping bauen
   - Das Missionsevent muss denselben Key liefern wie der Katalog.
   - Beispiel: Event `line_complete` -> Clip-Key `line_complete`.
   - Bei Varianten explizit mappen, zum Beispiel `survey_area_entered` -> `scan_survey_area_entered` oder `orbit_survey_area_entered`.

4. Static-first, Gemini-fallback verwenden
   - Lokalen Clip zuerst versuchen.
   - Nur wenn Katalog, Stimme oder Datei fehlen: Live-TTS anfragen.
   - Keine Retry-Schleifen bauen.

5. Voice-Auswahl gleich halten
   - Immer denselben Speaker-Snapshot und dieselben Kandidatenstimmen verwenden wie Live-TTS.
   - Keine zufaellige Stimme ueber das ganze Set waehlen.

6. Katalog teilset-tolerant halten
   - Unvollstaendige Sets sind okay.
   - Fehlende Stimmen/Takes fallen automatisch auf Live-TTS zurueck.

7. Push sauber halten
   - `.DS_Store` und lokale Key-Dateien nie committen.
   - `sw.js` bei normalem Webapp-Push bumpen.
   - Nur die gewuenschten Audio-Dateien und den Katalog stage'n.

## Kandidaten fuer naechste Ausbaustufe

Arbeitszonen:

- Zone erreicht
- Stabil in Zone
- Zone verlassen
- Neuer Pass noetig
- Aufnahme abgeschlossen

Training:

- Uebung beginnt
- Sauberer Durchlauf
- Kriterium verfehlt
- Wiederholung ansetzen
- Training abgeschlossen

Mapping/Survey Rest:

- Vollstaendige fehlende Takes nachrendern
- Eventuell weitere Varianten fuer andere Survey-Arten nur dann, wenn sie wirklich haeufig triggern

## Pruefcheckliste

- `catalog.json` enthaelt die erwarteten Keys.
- Jeder Katalogeintrag zeigt auf existierende Dateien.
- Keine `.DS_Store`-Dateien sind staged.
- `node --check passenger-voice.js` ist sauber, wenn Runtime-Code geaendert wurde.
- `node --check tools/generate-gemini-pax-voice-assets.mjs` ist sauber, wenn der Generator geaendert wurde.
- `git diff --cached --check` ist sauber.
